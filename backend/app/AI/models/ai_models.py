"""
AI Database Models
All AI-related tables. Isolated from core ERP models.
"""
from app import db
from datetime import datetime
import json


class AIProviderConfig(db.Model):
    """
    Global AI provider configuration. Managed by Super Admin only.
    ONE active provider at a time. API keys stored encrypted at rest.
    """
    __tablename__ = 'ai_provider_config'

    id             = db.Column(db.Integer, primary_key=True)
    is_active      = db.Column(db.Boolean, default=True, index=True)

    # Provider: 'GROQ' | 'OPENAI'
    provider       = db.Column(db.String(20), nullable=False, default='GROQ')

    # Model identifier — fully configurable (not hardcoded anywhere else)
    model          = db.Column(db.String(80), nullable=False, default='llama-3.3-70b-versatile')

    # AES-256 encrypted key — NEVER store or return plaintext
    encrypted_api_key = db.Column(db.Text, nullable=True)
    key_configured    = db.Column(db.Boolean, default=False)  # True when key is set

    # Temperature / generation settings
    temperature    = db.Column(db.Float, default=0.3)
    max_tokens     = db.Column(db.Integer, default=800)

    # Fallback provider (architecture ready, not active by default)
    fallback_provider  = db.Column(db.String(20), nullable=True)
    fallback_model     = db.Column(db.String(80), nullable=True)
    fallback_encrypted_key = db.Column(db.Text, nullable=True)
    fallback_enabled   = db.Column(db.Boolean, default=False)

    created_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def to_dict_safe(self):
        """Return config WITHOUT any key material — safe for frontend."""
        return {
            'id':               self.id,
            'is_active':        self.is_active,
            'provider':         self.provider,
            'model':            self.model,
            'key_configured':   bool(self.key_configured),
            'temperature':      self.temperature,
            'max_tokens':       self.max_tokens,
            'fallback_provider': self.fallback_provider,
            'fallback_model':    self.fallback_model,
            'fallback_enabled':  bool(self.fallback_enabled),
            'updated_at':       self.updated_at.isoformat() if self.updated_at else None,
        }


class AIRoleQuota(db.Model):
    """
    Per-role (and optionally per-school) daily AI query quotas.
    Configurable by Super Admin. Does NOT hardcode any limits.
    """
    __tablename__ = 'ai_role_quota'

    id         = db.Column(db.Integer, primary_key=True)
    # school_id=None means global default for all schools
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    role       = db.Column(db.String(30), nullable=False)  # 'PRINCIPAL', 'TEACHER', etc.
    daily_limit = db.Column(db.Integer, nullable=False, default=50)
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'role', name='uq_ai_quota_school_role'),
    )

    def to_dict(self):
        return {
            'id':          self.id,
            'school_id':   self.school_id,
            'role':        self.role,
            'daily_limit': self.daily_limit,
            'is_active':   self.is_active,
        }


class AIUsage(db.Model):
    """
    Per-request usage tracking. Aggregated for analytics.
    Does NOT store full prompt text — only intent/metadata.
    """
    __tablename__ = 'ai_usage'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    role           = db.Column(db.String(30), nullable=False, index=True)

    date           = db.Column(db.Date, nullable=False, default=datetime.utcnow, index=True)

    # Intent — e.g. 'FEE_COLLECTION', 'ATTENDANCE_TODAY', 'TEACHER_LESSON_PLAN'
    intent         = db.Column(db.String(50), nullable=True, index=True)

    provider       = db.Column(db.String(20), nullable=True)
    model          = db.Column(db.String(80), nullable=True)

    # Latency tracking
    intent_ms      = db.Column(db.Integer, nullable=True)   # ms for intent classification
    db_ms          = db.Column(db.Integer, nullable=True)   # ms for analytics DB query
    llm_ms         = db.Column(db.Integer, nullable=True)   # ms for LLM call
    total_ms       = db.Column(db.Integer, nullable=True)   # ms total

    # Token usage (from provider response)
    prompt_tokens  = db.Column(db.Integer, nullable=True)
    completion_tokens = db.Column(db.Integer, nullable=True)
    total_tokens   = db.Column(db.Integer, nullable=True)

    # Estimated cost in USD (not exact billing)
    estimated_cost = db.Column(db.Float, nullable=True)

    cache_hit      = db.Column(db.Boolean, default=False, index=True)
    success        = db.Column(db.Boolean, default=True, index=True)
    error_type     = db.Column(db.String(50), nullable=True)

    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'user_id':          self.user_id,
            'role':             self.role,
            'date':             str(self.date),
            'intent':           self.intent,
            'provider':         self.provider,
            'model':            self.model,
            'intent_ms':        self.intent_ms,
            'db_ms':            self.db_ms,
            'llm_ms':           self.llm_ms,
            'total_ms':         self.total_ms,
            'prompt_tokens':    self.prompt_tokens,
            'completion_tokens': self.completion_tokens,
            'total_tokens':     self.total_tokens,
            'estimated_cost':   self.estimated_cost,
            'cache_hit':        self.cache_hit,
            'success':          self.success,
            'error_type':       self.error_type,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


class AIQueryCache(db.Model):
    """
    School-scoped query response cache. Tenant isolation is ENFORCED
    via (school_id + permission_scope + normalized_query).
    School A's answer NEVER returned to School B.
    """
    __tablename__ = 'ai_query_cache'

    id                = db.Column(db.Integer, primary_key=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    # 'SCHOOL' = school-wide (Principal). 'USER' = user-specific (Teacher class queries).
    permission_scope  = db.Column(db.String(20), default='SCHOOL', nullable=False)
    # For USER scope: user_id of the owner, so Teacher A's cache ≠ Teacher B's
    scope_user_id     = db.Column(db.Integer, nullable=True, index=True)

    normalized_query  = db.Column(db.String(200), nullable=False)  # e.g. 'fee_collection|2026|02'
    intent            = db.Column(db.String(50), nullable=True)
    parameters_hash   = db.Column(db.String(64), nullable=True)  # sha256 of params dict

    response_json     = db.Column(db.Text, nullable=False)        # Full structured response
    answer_text       = db.Column(db.Text, nullable=True)         # Pre-formatted answer text

    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at        = db.Column(db.DateTime, nullable=False, index=True)
    hit_count         = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index('idx_cache_lookup', 'school_id', 'permission_scope', 'normalized_query'),
    )

    def is_valid(self):
        return datetime.utcnow() < self.expires_at

    def get_response(self):
        try:
            return json.loads(self.response_json)
        except Exception:
            return {}

    def to_dict(self):
        return {
            'id':              self.id,
            'school_id':       self.school_id,
            'normalized_query': self.normalized_query,
            'intent':          self.intent,
            'expires_at':      self.expires_at.isoformat() if self.expires_at else None,
            'hit_count':       self.hit_count,
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }


class AIConversation(db.Model):
    """
    User-scoped conversation session. Each user sees only their own history.
    Super Admin does NOT automatically see conversation content — only aggregated analytics.
    """
    __tablename__ = 'ai_conversations'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    role        = db.Column(db.String(30), nullable=False)
    title       = db.Column(db.String(200), nullable=True)  # Auto-generated from first message
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active   = db.Column(db.Boolean, default=True)
    message_count = db.Column(db.Integer, default=0)

    messages    = db.relationship('AIMessage', backref='conversation',
                                   lazy='dynamic', cascade='all, delete-orphan',
                                   order_by='AIMessage.created_at')

    def to_dict(self, include_messages=False):
        d = {
            'id':            self.id,
            'user_id':       self.user_id,
            'role':          self.role,
            'title':         self.title or 'New Conversation',
            'message_count': self.message_count or 0,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
            'updated_at':    self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_messages:
            d['messages'] = [m.to_dict() for m in self.messages.limit(50).all()]
        return d


class AIMessage(db.Model):
    """
    Individual chat message. role: 'user' | 'assistant'.
    metadata_json stores intent, cache_hit, source, etc. — NOT full DB results.
    """
    __tablename__ = 'ai_messages'

    id              = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('ai_conversations.id'), nullable=False, index=True)
    role            = db.Column(db.String(15), nullable=False)   # 'user' | 'assistant'
    content         = db.Column(db.Text, nullable=False)
    intent          = db.Column(db.String(50), nullable=True)
    cached          = db.Column(db.Boolean, default=False)
    source          = db.Column(db.String(30), nullable=True)    # 'ERP_DATA' | 'DOCUMENT' | 'GENERAL'
    metadata_json   = db.Column(db.Text, nullable=True)          # {intent, latency, provider, ...}
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def get_metadata(self):
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except Exception:
            return {}

    def to_dict(self):
        return {
            'id':              self.id,
            'conversation_id': self.conversation_id,
            'role':            self.role,
            'content':         self.content,
            'intent':          self.intent,
            'cached':          self.cached,
            'source':          self.source,
            'metadata':        self.get_metadata(),
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }


class AIDocument(db.Model):
    """
    Teacher-uploaded documents for RAG. Strictly tenant-scoped:
    school_id + uploaded_by enforced on every retrieval.
    """
    __tablename__ = 'ai_documents'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    uploaded_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    filename      = db.Column(db.String(255), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    file_type     = db.Column(db.String(10), nullable=False)   # 'pdf', 'docx', 'txt'
    file_size     = db.Column(db.Integer, nullable=True)       # bytes
    file_url      = db.Column(db.String(500), nullable=True)   # Cloudinary / local path

    # Optional metadata for smarter retrieval
    subject       = db.Column(db.String(100), nullable=True)
    class_name    = db.Column(db.String(50), nullable=True)
    unit_topic    = db.Column(db.String(200), nullable=True)

    chunk_count   = db.Column(db.Integer, default=0)
    status        = db.Column(db.String(20), default='PROCESSING')  # PROCESSING | READY | FAILED

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = db.relationship('AIDocumentChunk', backref='document',
                              lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'uploaded_by':  self.uploaded_by,
            'filename':     self.filename,
            'original_name': self.original_name,
            'file_type':    self.file_type,
            'file_size':    self.file_size,
            'subject':      self.subject or '',
            'class_name':   self.class_name or '',
            'unit_topic':   self.unit_topic or '',
            'chunk_count':  self.chunk_count or 0,
            'status':       self.status,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


class AIDocumentChunk(db.Model):
    """
    Text chunks from teacher-uploaded documents for RAG retrieval.
    keyword_text used for fast SQL LIKE search (no vector DB needed initially).
    """
    __tablename__ = 'ai_document_chunks'

    id          = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('ai_documents.id'), nullable=False, index=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    chunk_index = db.Column(db.Integer, nullable=False)
    chunk_text  = db.Column(db.Text, nullable=False)
    page_number = db.Column(db.Integer, nullable=True)

    # Keyword extraction for fast LIKE-based retrieval (avoids vector DB dependency initially)
    keywords    = db.Column(db.String(500), nullable=True)

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'document_id': self.document_id,
            'chunk_index': self.chunk_index,
            'chunk_text':  self.chunk_text[:200] + '...' if len(self.chunk_text) > 200 else self.chunk_text,
            'page_number': self.page_number,
            'keywords':    self.keywords or '',
        }
