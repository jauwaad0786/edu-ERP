from flask import Blueprint, request, jsonify, send_file
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.library import (
    BookCategory, Book, BookCopy, LibraryMember, BookIssue,
    BookReservation, FineTransaction, LibrarySettings, log_activity
)
from app.models.academic import Class
from datetime import datetime, date
import random
import string
import io

library_bp = Blueprint('library', __name__)

LIBRARY_ROLES = ('PRINCIPAL', 'LIBRARIAN', 'TEACHER')
LIBRARY_ADMIN_ROLES = ('PRINCIPAL', 'LIBRARIAN')


def _school_id():
    return get_current_user().school_id


def _get_or_create_settings(sid):
    settings = LibrarySettings.query.filter_by(school_id=sid).first()
    if not settings:
        settings = LibrarySettings(school_id=sid)
        db.session.add(settings)
        db.session.commit()
    return settings


def _gen_accession_no(sid):
    """ACC-2026-000123 style, unique per school+year."""
    year = date.today().year
    prefix = f"ACC-{year}-"
    last = BookCopy.query.filter(
        BookCopy.school_id == sid,
        BookCopy.copy_accession_no.like(f'{prefix}%')
    ).order_by(BookCopy.id.desc()).first()
    if last and last.copy_accession_no:
        try:
            n = int(last.copy_accession_no.split('-')[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:06d}"


def _gen_barcode():
    """13-digit numeric barcode, EAN-13 style — collision-checked."""
    while True:
        code = ''.join(random.choices(string.digits, k=13))
        if not BookCopy.query.filter_by(barcode=code).first():
            return code


# ─── Categories ───────────────────────────────────────────────────────────────

@library_bp.route('/categories', methods=['GET'])
@role_required(*LIBRARY_ROLES, 'STUDENT', 'PARENT')
def list_categories():
    cats = BookCategory.query.filter_by(school_id=_school_id()).order_by(BookCategory.name).all()
    return jsonify([c.to_dict() for c in cats]), 200


@library_bp.route('/categories', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def create_category():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400

    sid = _school_id()
    if BookCategory.query.filter_by(school_id=sid, name=name).first():
        return jsonify({'error': 'Category already exists'}), 409

    cat = BookCategory(
        school_id=sid, name=name,
        description=(data.get('description') or '').strip()
    )
    db.session.add(cat)
    db.session.commit()
    log_activity(sid, get_current_user().id, 'CATEGORY_ADDED', name)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@library_bp.route('/categories/<int:cat_id>', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_category(cat_id):
    cat = BookCategory.query.get_or_404(cat_id)
    if cat.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    if data.get('name'):        cat.name        = data['name'].strip()
    if 'description' in data:   cat.description = (data['description'] or '').strip()
    if 'is_active' in data:     cat.is_active   = bool(data['is_active'])
    db.session.commit()
    return jsonify(cat.to_dict()), 200


@library_bp.route('/categories/<int:cat_id>', methods=['DELETE'])
@role_required(*LIBRARY_ADMIN_ROLES)
def delete_category(cat_id):
    cat = BookCategory.query.get_or_404(cat_id)
    if cat.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if cat.books.count() > 0:
        return jsonify({'error': f'{cat.books.count()} books is category mein hain — pehle unhe reassign karo'}), 400
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'message': 'Category deleted'}), 200


# ─── Books (Master) ───────────────────────────────────────────────────────────

@library_bp.route('/books', methods=['GET'])
@role_required(*LIBRARY_ROLES, 'STUDENT', 'PARENT')
def list_books():
    """
    Search + filter + pagination.
    Query params: search, category_id, class_id, language, status(available/all), page, per_page
    """
    sid = _school_id()
    q = Book.query.filter_by(school_id=sid, is_active=True)

    search = (request.args.get('search') or '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(
            Book.title.ilike(like),
            Book.author.ilike(like),
            Book.isbn.ilike(like),
            Book.publisher.ilike(like),
            Book.keywords.ilike(like),
            Book.rack.ilike(like),
            Book.subject.ilike(like),
        ))

    category_id = request.args.get('category_id')
    if category_id:
        q = q.filter_by(category_id=category_id)

    class_id = request.args.get('class_id')
    if class_id:
        q = q.filter_by(class_id=class_id)

    language = request.args.get('language')
    if language:
        q = q.filter_by(language=language)

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 24, type=int), 100)
    paginated = q.order_by(Book.title).paginate(page=page, per_page=per_page, error_out=False)

    result = [b.to_dict() for b in paginated.items]

    # Optional: filter only-available in Python (counts are derived, not a DB column)
    only_available = request.args.get('available_only') == '1'
    if only_available:
        result = [b for b in result if b['available_copies'] > 0]

    return jsonify({
        'data':     result,
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


@library_bp.route('/books/<int:book_id>', methods=['GET'])
@role_required(*LIBRARY_ROLES, 'STUDENT', 'PARENT')
def get_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    d = book.to_dict()
    d['copies'] = [c.to_dict() for c in book.copies.all()]
    return jsonify(d), 200


@library_bp.route('/books', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def create_book():
    """
    Create book master + auto-generate N physical copies (BookCopy rows),
    each with its own accession number + barcode.
    Body: { ...book fields..., total_copies: 5 }
    """
    data = request.get_json() or {}
    sid  = _school_id()

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    total_copies = int(data.get('total_copies', 1))
    if total_copies < 1:
        return jsonify({'error': 'total_copies must be at least 1'}), 400

    book = Book(
        school_id    = sid,
        title        = title,
        subtitle     = (data.get('subtitle') or '').strip(),
        isbn         = (data.get('isbn') or '').strip(),
        accession_no = (data.get('accession_no') or '').strip(),
        category_id  = data.get('category_id') or None,
        subject      = (data.get('subject') or '').strip(),
        author       = (data.get('author') or '').strip(),
        publisher    = (data.get('publisher') or '').strip(),
        edition      = (data.get('edition') or '').strip(),
        language     = data.get('language', 'English'),
        class_id     = data.get('class_id') or None,
        rack         = (data.get('rack') or '').strip(),
        shelf        = (data.get('shelf') or '').strip(),
        purchase_date= date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else None,
        vendor_name  = (data.get('vendor_name') or '').strip(),
        purchase_price = float(data.get('purchase_price', 0) or 0),
        mrp          = float(data.get('mrp', 0) or 0),
        cover_url    = data.get('cover_url'),
        description  = (data.get('description') or '').strip(),
        keywords     = (data.get('keywords') or '').strip(),
        created_by   = get_current_user().id,
    )
    db.session.add(book)
    db.session.flush()  # book.id chahiye copies banane ke liye

    for _ in range(total_copies):
        copy = BookCopy(
            book_id           = book.id,
            school_id         = sid,
            copy_accession_no = _gen_accession_no(sid),
            barcode           = _gen_barcode(),
            status            = 'AVAILABLE',
        )
        db.session.add(copy)

    db.session.commit()
    log_activity(sid, get_current_user().id, 'BOOK_ADDED', f'{title} ({total_copies} copies)')
    db.session.commit()

    d = book.to_dict()
    d['copies'] = [c.to_dict() for c in book.copies.all()]
    return jsonify(d), 201


@library_bp.route('/books/<int:book_id>', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    text_fields = ['title', 'subtitle', 'isbn', 'accession_no', 'subject', 'author',
                   'publisher', 'edition', 'language', 'rack', 'shelf', 'vendor_name',
                   'description', 'keywords', 'cover_url']
    for f in text_fields:
        if f in data:
            setattr(book, f, (data[f] or '').strip() if isinstance(data[f], str) else data[f])

    if 'category_id' in data: book.category_id = data['category_id'] or None
    if 'class_id' in data:    book.class_id     = data['class_id'] or None
    if 'purchase_date' in data:
        book.purchase_date = date.fromisoformat(data['purchase_date']) if data['purchase_date'] else None
    if 'purchase_price' in data: book.purchase_price = float(data['purchase_price'] or 0)
    if 'mrp' in data:            book.mrp            = float(data['mrp'] or 0)
    if 'is_active' in data:      book.is_active      = bool(data['is_active'])

    db.session.commit()
    return jsonify(book.to_dict()), 200


@library_bp.route('/books/<int:book_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_book(book_id):
    """Soft delete only if no active issues; otherwise block."""
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    active_issues = BookIssue.query.filter_by(book_id=book_id, status='ISSUED').count()
    if active_issues > 0:
        return jsonify({'error': f'{active_issues} copies abhi issued hain — pehle return karwao'}), 400

    book.is_active = False
    db.session.commit()
    log_activity(_school_id(), get_current_user().id, 'BOOK_DELETED', book.title)
    db.session.commit()
    return jsonify({'message': 'Book deactivated'}), 200


# ─── Book Copies (add more copies to existing title, mark lost/damaged) ──────

@library_bp.route('/books/<int:book_id>/copies', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def add_copies(book_id):
    """Add more physical copies to an existing book title."""
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data  = request.get_json() or {}
    count = int(data.get('count', 1))
    if count < 1:
        return jsonify({'error': 'count must be at least 1'}), 400

    sid = _school_id()
    new_copies = []
    for _ in range(count):
        copy = BookCopy(
            book_id=book.id, school_id=sid,
            copy_accession_no=_gen_accession_no(sid),
            barcode=_gen_barcode(), status='AVAILABLE',
        )
        db.session.add(copy)
        new_copies.append(copy)

    db.session.commit()
    log_activity(sid, get_current_user().id, 'COPIES_ADDED', f'{book.title} +{count}')
    db.session.commit()
    return jsonify([c.to_dict() for c in new_copies]), 201


@library_bp.route('/copies/<int:copy_id>/status', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_copy_status(copy_id):
    """Mark a specific copy LOST / DAMAGED / WITHDRAWN / AVAILABLE."""
    copy = BookCopy.query.get_or_404(copy_id)
    if copy.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ('AVAILABLE', 'LOST', 'DAMAGED', 'WITHDRAWN'):
        return jsonify({'error': 'Invalid status'}), 400

    if copy.status == 'ISSUED' and new_status != 'AVAILABLE':
        return jsonify({'error': 'Copy currently issued hai — pehle return/lost-process se guzaro'}), 400

    copy.status = new_status
    copy.condition_note = (data.get('condition_note') or '').strip()
    db.session.commit()
    log_activity(_school_id(), get_current_user().id, 'COPY_STATUS_CHANGED',
                 f'{copy.barcode} → {new_status}')
    db.session.commit()
    return jsonify(copy.to_dict()), 200


# ─── Barcode / QR lookup (used by Issue & Return scanner) ────────────────────

@library_bp.route('/copies/barcode/<string:barcode>', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def lookup_by_barcode(barcode):
    copy = BookCopy.query.filter_by(barcode=barcode, school_id=_school_id()).first()
    if not copy:
        return jsonify({'error': 'Barcode not found'}), 404
    d = copy.to_dict()
    d['book'] = copy.book.to_dict() if copy.book else None
    return jsonify(d), 200


# ─── Settings ─────────────────────────────────────────────────────────────────

@library_bp.route('/settings', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def get_settings():
    settings = _get_or_create_settings(_school_id())
    return jsonify(settings.to_dict()), 200


@library_bp.route('/settings', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_settings():
    settings = _get_or_create_settings(_school_id())
    data = request.get_json() or {}
    numeric_fields = [
        'max_books_student', 'max_books_teacher', 'issue_duration_days',
        'fine_per_day', 'max_fine_cap', 'lost_book_fine_multiplier',
        'max_renewals', 'reservation_limit_per_member',
    ]
    for f in numeric_fields:
        if f in data:
            setattr(settings, f, float(data[f]) if 'fine' in f or 'multiplier' in f else int(data[f]))
    db.session.commit()
    return jsonify(settings.to_dict()), 200
