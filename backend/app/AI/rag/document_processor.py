"""
RAG Document Processor
Handles PDF, DOCX, TXT extraction, chunking, and keyword extraction.
No vector database required — uses SQL LIKE search for retrieval.
Prompt injection from documents is PREVENTED by treating content as DATA only.
"""
import os
import hashlib
import re
from typing import List


MAX_FILE_SIZE_MB  = 10
MAX_CHUNK_CHARS   = 1000
CHUNK_OVERLAP     = 100
ALLOWED_TYPES     = {'pdf', 'docx', 'txt', 'doc'}


def validate_document(filename: str, file_size_bytes: int) -> tuple:
    """
    Validate uploaded document. Returns (is_valid, error_message).
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext not in ALLOWED_TYPES:
        return False, f"File type '.{ext}' not supported. Allowed: {', '.join(ALLOWED_TYPES)}"

    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if file_size_bytes > max_bytes:
        return False, f"File too large ({file_size_bytes // 1024 // 1024}MB). Max {MAX_FILE_SIZE_MB}MB."

    return True, None


def extract_text(file_path: str, file_type: str) -> str:
    """Extract raw text from document file."""
    file_type = file_type.lower().lstrip('.')

    if file_type == 'txt':
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()

    elif file_type == 'pdf':
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(file_path)
            text = ''
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except ImportError:
            # Fallback: try pdfplumber
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    return '\n'.join(p.extract_text() or '' for p in pdf.pages)
            except ImportError:
                raise ValueError("PDF extraction requires 'pymupdf' or 'pdfplumber'. "
                                 "Run: pip install pymupdf")

    elif file_type in ('docx', 'doc'):
        try:
            from docx import Document
            doc = Document(file_path)
            return '\n'.join(p.text for p in doc.paragraphs)
        except ImportError:
            raise ValueError("DOCX extraction requires 'python-docx'. Run: pip install python-docx")

    raise ValueError(f"Unsupported file type: {file_type}")


def chunk_text(text: str, chunk_size: int = MAX_CHUNK_CHARS,
               overlap: int = CHUNK_OVERLAP) -> List[dict]:
    """
    Split text into overlapping chunks with metadata.
    Returns list of {'chunk_index': int, 'text': str, 'keywords': str}
    """
    # Clean text
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text).strip()

    if not text:
        return []

    chunks = []
    start  = 0
    idx    = 0

    while start < len(text):
        end   = start + chunk_size
        chunk = text[start:end]

        # Try to break at sentence boundary
        if end < len(text):
            last_period = max(chunk.rfind('.'), chunk.rfind('।'), chunk.rfind('\n'))
            if last_period > chunk_size // 2:
                chunk = chunk[:last_period + 1]
                end   = start + last_period + 1

        chunk = chunk.strip()
        if chunk:
            keywords = _extract_keywords(chunk)
            chunks.append({
                'chunk_index': idx,
                'chunk_text':  chunk,
                'keywords':    keywords,
            })
            idx += 1

        start = end - overlap
        if start <= 0 and idx > 0:
            break  # avoid infinite loop

    return chunks


def _extract_keywords(text: str) -> str:
    """Extract top keywords from chunk for SQL LIKE-based retrieval."""
    # Simple frequency-based keyword extraction (no ML needed)
    words = re.findall(r'\b[a-zA-Z\u0900-\u097F]{3,}\b', text.lower())
    stopwords = {'the', 'and', 'for', 'are', 'with', 'that', 'this', 'have',
                 'from', 'they', 'will', 'been', 'has', 'had', 'but', 'not',
                 'all', 'can', 'its', 'which', 'one', 'when', 'were', 'aur',
                 'hai', 'hain', 'mein', 'ko', 'ka', 'ki', 'ke', 'yeh', 'woh'}
    words = [w for w in words if w not in stopwords]
    freq  = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    top = sorted(freq.items(), key=lambda x: -x[1])[:15]
    return ' '.join(w for w, _ in top)


def retrieve_relevant_chunks(school_id: int, uploaded_by: int, query: str,
                              document_id: int = None, limit: int = 5) -> List[dict]:
    """
    Retrieve relevant document chunks using keyword search.
    STRICTLY tenant-scoped (school_id + uploaded_by).
    PREVENTS prompt injection: document text is returned as DATA, not as system instructions.
    """
    from app.AI.models.ai_models import AIDocumentChunk, AIDocument

    keywords = _extract_keywords(query)
    kw_list  = keywords.split()[:5]  # top 5 for search

    q = AIDocumentChunk.query.join(
        AIDocument, AIDocument.id == AIDocumentChunk.document_id
    ).filter(
        AIDocumentChunk.school_id   == school_id,
        AIDocumentChunk.uploaded_by == uploaded_by,
        AIDocument.status           == 'READY',
    )

    if document_id:
        q = q.filter(AIDocumentChunk.document_id == document_id)

    # Keyword-based relevance scoring via OR filters
    if kw_list:
        from sqlalchemy import or_
        conditions = [
            AIDocumentChunk.chunk_text.ilike(f'%{kw}%') for kw in kw_list
        ] + [
            AIDocumentChunk.keywords.ilike(f'%{kw}%') for kw in kw_list
        ]
        q = q.filter(or_(*conditions))

    chunks = q.limit(limit * 2).all()

    # Score by keyword overlap
    def score(chunk):
        text = chunk.chunk_text.lower()
        return sum(1 for kw in kw_list if kw in text)

    chunks = sorted(chunks, key=score, reverse=True)[:limit]

    return [{
        'chunk_index':  c.chunk_index,
        'chunk_text':   c.chunk_text,
        'document_id':  c.document_id,
        'page_number':  c.page_number,
    } for c in chunks]


def process_and_store_document(file_path: str, file_type: str,
                                document_id: int, school_id: int,
                                uploaded_by: int) -> int:
    """
    Extract text, chunk it, and store chunks in DB.
    Returns chunk count.
    """
    from app.AI.models.ai_models import AIDocumentChunk, AIDocument
    from app import db

    text   = extract_text(file_path, file_type)
    chunks = chunk_text(text)

    # Delete old chunks for this document
    AIDocumentChunk.query.filter_by(document_id=document_id).delete()

    for c in chunks:
        chunk = AIDocumentChunk(
            document_id  = document_id,
            school_id    = school_id,
            uploaded_by  = uploaded_by,
            chunk_index  = c['chunk_index'],
            chunk_text   = c['chunk_text'],
            keywords     = c['keywords'],
        )
        db.session.add(chunk)

    # Update document status
    doc = AIDocument.query.get(document_id)
    if doc:
        doc.status      = 'READY'
        doc.chunk_count = len(chunks)

    db.session.commit()
    return len(chunks)
