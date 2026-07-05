from flask import Blueprint, request, jsonify, send_file
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.library import (
    BookCategory, Book, BookCopy, LibraryMember, BookIssue,
    BookReservation, FineTransaction, LibrarySettings, log_activity
)

from app.models.academic import Class
from app.models.user import User
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


# ═══════════════════════════════════════════════════════════════════════════
#  Library Members
# ═══════════════════════════════════════════════════════════════════════════

def _gen_card_number(sid):
    prefix = f"LIB-{sid}-"
    last = LibraryMember.query.filter(
        LibraryMember.school_id == sid,
        LibraryMember.card_number.like(f'{prefix}%')
    ).order_by(LibraryMember.id.desc()).first()
    if last and last.card_number:
        try:
            n = int(last.card_number.split('-')[-1]) + 1
        except (ValueError, IndexError):
            n = 1
    else:
        n = 1
    return f"{prefix}{n:05d}"


@library_bp.route('/members', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_members():
    sid    = _school_id()
    search = (request.args.get('search') or '').strip()
    m_type = request.args.get('member_type')

    q = LibraryMember.query.filter_by(school_id=sid)
    if m_type:
        q = q.filter_by(member_type=m_type)

    members = q.all()
    result = [m.to_dict() for m in members]

    if search:
        s = search.lower()
        result = [r for r in result if s in r['name'].lower() or s in r['card_number'].lower()]

    return jsonify(result), 200


@library_bp.route('/members/search-eligible', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def search_eligible_users():
    """
    Search Students/Teachers who are NOT yet library members, to onboard them.
    Query: search, type (STUDENT/TEACHER)
    """
    from app.models.user import User, UserRole
    sid    = _school_id()
    search = (request.args.get('search') or '').strip()
    u_type = request.args.get('type', 'STUDENT')

    if not search:
        return jsonify([]), 200

    role_enum = UserRole.STUDENT if u_type == 'STUDENT' else UserRole.TEACHER
    like = f'%{search}%'

    existing_user_ids = {m.user_id for m in LibraryMember.query.filter_by(school_id=sid).all()}

    users = User.query.filter(
        User.school_id == sid, User.role == role_enum,
        db.or_(User.name.ilike(like), User.email.ilike(like))
    ).limit(15).all()

    return jsonify([
        {'user_id': u.id, 'name': u.name, 'email': u.email, 'is_member': u.id in existing_user_ids}
        for u in users
    ]), 200


@library_bp.route('/members', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def create_member():
    """
    Enroll an existing Student/Teacher as a library member.
    Body: { user_id, member_type }
    """
    from app.models.user import User

    data    = request.get_json() or {}
    user_id = data.get('user_id')
    m_type  = data.get('member_type', 'STUDENT')

    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    sid  = _school_id()
    user = User.query.get_or_404(user_id)
    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    if LibraryMember.query.filter_by(school_id=sid, user_id=user_id).first():
        return jsonify({'error': 'User already a library member'}), 409

    member = LibraryMember(
        school_id=sid, user_id=user_id,
        card_number=_gen_card_number(sid),
        member_type=m_type, status='ACTIVE',
    )
    db.session.add(member)
    db.session.commit()
    log_activity(sid, get_current_user().id, 'MEMBER_ENROLLED', f'{user.name} ({m_type})')
    db.session.commit()
    return jsonify(member.to_dict()), 201


@library_bp.route('/members/<int:member_id>', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_member(member_id):
    member = LibraryMember.query.get_or_404(member_id)
    if member.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    if 'status' in data and data['status'] in ('ACTIVE', 'BLOCKED', 'SUSPENDED'):
        member.status = data['status']
    if 'max_books_override' in data:
        member.max_books_override = data['max_books_override']

    db.session.commit()
    return jsonify(member.to_dict()), 200


@library_bp.route('/members/<int:member_id>/history', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def member_history(member_id):
    member = LibraryMember.query.get_or_404(member_id)
    if member.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    issues = BookIssue.query.filter_by(member_id=member_id)\
                 .order_by(BookIssue.issue_date.desc()).all()
    fines  = FineTransaction.query.filter_by(member_id=member_id)\
                 .order_by(FineTransaction.created_at.desc()).all()

    return jsonify({
        'member': member.to_dict(),
        'issues': [i.to_dict() for i in issues],
        'fines':  [f.to_dict() for f in fines],
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Book Issue
# ═══════════════════════════════════════════════════════════════════════════

def _max_books_for(member, settings):
    if member.max_books_override is not None:
        return member.max_books_override
    return settings.max_books_teacher if member.member_type == 'TEACHER' else settings.max_books_student


@library_bp.route('/issue', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def issue_book():
    """
    Body: { member_id, barcode }  OR  { member_id, book_id }  (auto-picks an available copy)
    """
    data      = request.get_json() or {}
    member_id = data.get('member_id')
    barcode   = data.get('barcode')
    book_id   = data.get('book_id')

    if not member_id or (not barcode and not book_id):
        return jsonify({'error': 'member_id and (barcode or book_id) required'}), 400

    sid    = _school_id()
    member = LibraryMember.query.get_or_404(member_id)
    if member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    if member.status != 'ACTIVE':
        return jsonify({'error': f'Member is {member.status} — issue nahi ho sakta'}), 400

    settings = _get_or_create_settings(sid)

    # ── Pending fine check ──
    pending_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount - FineTransaction.amount_paid), 0))\
        .filter_by(member_id=member_id).filter(FineTransaction.status.in_(['PENDING', 'PARTIAL'])).scalar() or 0
    if pending_fine > 0 and pending_fine >= settings.max_fine_cap:
        return jsonify({
            'error': f'Member ka pending fine ₹{pending_fine:.0f} hai (max cap ₹{settings.max_fine_cap:.0f} tak pahunch gaya) — pehle fine clear karo'
        }), 400

    # ── Max books limit check ──
    current_issued = BookIssue.query.filter_by(member_id=member_id, status='ISSUED').count()
    max_allowed = _max_books_for(member, settings)
    if current_issued >= max_allowed:
        return jsonify({
            'error': f'Member already {current_issued} books issued hai (max limit {max_allowed})'
        }), 400

    # ── Find the copy ──
    if barcode:
        copy = BookCopy.query.filter_by(barcode=barcode, school_id=sid).first()
        if not copy:
            return jsonify({'error': 'Barcode not found'}), 404
        if copy.status != 'AVAILABLE':
            return jsonify({'error': f'Copy currently {copy.status} — available nahi hai'}), 400
    else:
        copy = BookCopy.query.filter_by(book_id=book_id, school_id=sid, status='AVAILABLE').first()
        if not copy:
            return jsonify({'error': 'Is book ki koi copy available nahi hai — Reserve karo'}), 400

    # ── Reservation priority check ──
    # Agar kisi aur member ne is book ko reserve kar rakha hai aur queue mein aage hai,
    # to normal walk-in issue block karo (unless issuing to that same reserving member).
    top_reservation = BookReservation.query.filter_by(
        book_id=copy.book_id, status='WAITING'
    ).order_by(BookReservation.queue_position.asc()).first()
    if top_reservation and top_reservation.member_id != member_id:
        return jsonify({
            'error': f'Is book pe reservation queue hai ({top_reservation.member.user.name if top_reservation.member.user else "another member"} first in line) — unhe pehle issue karo'
        }), 409

    # ── Issue ──
    issue_date = date.today()
    due_date   = date.fromordinal(issue_date.toordinal() + settings.issue_duration_days)

    issue = BookIssue(
        school_id=sid, copy_id=copy.id, book_id=copy.book_id, member_id=member_id,
        issue_date=issue_date, due_date=due_date, status='ISSUED',
        issued_by=get_current_user().id,
        remarks=data.get('remarks', ''),
    )
    copy.status = 'ISSUED'
    db.session.add(issue)

    # If this member had a fulfilled reservation for this book, mark it fulfilled
    if top_reservation and top_reservation.member_id == member_id:
        top_reservation.status = 'FULFILLED'
        # shift queue positions down for remaining
        remaining = BookReservation.query.filter_by(
            book_id=copy.book_id, status='WAITING'
        ).order_by(BookReservation.queue_position.asc()).all()
        for idx, r in enumerate(remaining, start=1):
            r.queue_position = idx

    db.session.commit()
    log_activity(sid, get_current_user().id, 'BOOK_ISSUED',
                 f'{copy.book.title} → {member.user.name if member.user else ""} (due {due_date})')
    db.session.commit()

    return jsonify(issue.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════════
#  Book Return + Fine calculation
# ═══════════════════════════════════════════════════════════════════════════

def _calc_overdue_fine(issue, settings, return_date):
    if return_date <= issue.due_date:
        return 0
    overdue_days = (return_date - issue.due_date).days
    fine = overdue_days * settings.fine_per_day
    return min(fine, settings.max_fine_cap)


@library_bp.route('/return', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def return_book():
    """
    Body: { issue_id } OR { barcode }
    Optional: { mark_lost: bool, mark_damaged: bool, collect_fine_now: bool }
    """
    data = request.get_json() or {}
    sid  = _school_id()

    issue = None
    if data.get('issue_id'):
        issue = BookIssue.query.get_or_404(data['issue_id'])
    elif data.get('barcode'):
        copy = BookCopy.query.filter_by(barcode=data['barcode'], school_id=sid).first()
        if not copy:
            return jsonify({'error': 'Barcode not found'}), 404
        issue = BookIssue.query.filter_by(copy_id=copy.id, status='ISSUED').first()
        if not issue:
            return jsonify({'error': 'Ye copy currently issued nahi hai'}), 400
    else:
        return jsonify({'error': 'issue_id or barcode required'}), 400

    if issue.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if issue.status != 'ISSUED':
        return jsonify({'error': f'Ye issue already {issue.status} hai'}), 400

    settings    = _get_or_create_settings(sid)
    return_date = date.today()
    copy        = issue.copy

    mark_lost    = bool(data.get('mark_lost'))
    mark_damaged = bool(data.get('mark_damaged'))

    fine_created = None

    if mark_lost:
        issue.status      = 'LOST'
        issue.return_date = return_date
        copy.status        = 'LOST'
        lost_fine = (copy.book.mrp or 0) * settings.lost_book_fine_multiplier
        fine_created = FineTransaction(
            school_id=sid, issue_id=issue.id, member_id=issue.member_id,
            reason='LOST', amount=lost_fine, status='PENDING',
        )
        db.session.add(fine_created)
        log_activity(sid, get_current_user().id, 'BOOK_LOST',
                     f'{copy.book.title} — fine ₹{lost_fine:.0f}')

    else:
        issue.status      = 'RETURNED'
        issue.return_date = return_date
        issue.returned_by = get_current_user().id

        if mark_damaged:
            copy.status = 'DAMAGED'
            copy.condition_note = data.get('condition_note', 'Marked damaged on return')
            damage_fine = (copy.book.mrp or 0) * 0.5  # 50% of MRP — configurable later if needed
            fine_created = FineTransaction(
                school_id=sid, issue_id=issue.id, member_id=issue.member_id,
                reason='DAMAGED', amount=damage_fine, status='PENDING',
            )
            db.session.add(fine_created)
        else:
            copy.status = 'AVAILABLE'

        # Overdue fine (separate from damage fine, both can apply)
        overdue_fine = _calc_overdue_fine(issue, settings, return_date)
        if overdue_fine > 0:
            fine_created = FineTransaction(
                school_id=sid, issue_id=issue.id, member_id=issue.member_id,
                reason='OVERDUE', amount=overdue_fine, status='PENDING',
            )
            db.session.add(fine_created)

        log_activity(sid, get_current_user().id, 'BOOK_RETURNED',
                     f'{copy.book.title} (overdue fine: ₹{overdue_fine:.0f})')

    db.session.flush()

    # ── Optional: collect fine immediately at return counter ──
    if fine_created and data.get('collect_fine_now'):
        fine_created.amount_paid = fine_created.amount
        fine_created.status      = 'PAID'
        fine_created.collected_by = get_current_user().id
        fine_created.collected_at = datetime.utcnow()

    # ── If book becomes available again, notify top reservation ──
    if copy.status == 'AVAILABLE':
        top_reservation = BookReservation.query.filter_by(
            book_id=copy.book_id, status='WAITING'
        ).order_by(BookReservation.queue_position.asc()).first()
        if top_reservation:
            top_reservation.status = 'NOTIFIED'
            # TODO: hook into notification system (email/SMS/push) here in a later phase

    db.session.commit()

    result = issue.to_dict()
    if fine_created:
        result['fine'] = fine_created.to_dict()
    return jsonify(result), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Renewal
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/issue/<int:issue_id>/renew', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def renew_issue(issue_id):
    issue = BookIssue.query.get_or_404(issue_id)
    sid   = _school_id()
    if issue.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if issue.status != 'ISSUED':
        return jsonify({'error': 'Sirf currently-issued book hi renew ho sakti hai'}), 400

    settings = _get_or_create_settings(sid)

    if issue.renewal_count >= settings.max_renewals:
        return jsonify({'error': f'Max renewal limit ({settings.max_renewals}) already reach ho chuka hai'}), 400

    # Block renewal if someone else is waiting for this book
    waiting = BookReservation.query.filter_by(
        book_id=issue.book_id, status='WAITING'
    ).first()
    if waiting:
        return jsonify({'error': 'Is book pe reservation queue hai — renewal allow nahi'}), 409

    issue.due_date = date.fromordinal(issue.due_date.toordinal() + settings.issue_duration_days)
    issue.renewal_count += 1
    db.session.commit()

    log_activity(sid, get_current_user().id, 'BOOK_RENEWED',
                 f'{issue.book.title} → new due {issue.due_date}')
    db.session.commit()
    return jsonify(issue.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Fine Management
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/fines', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_fines():
    sid    = _school_id()
    status = request.args.get('status')
    member_id = request.args.get('member_id')

    q = FineTransaction.query.filter_by(school_id=sid)
    if status:
        q = q.filter_by(status=status)
    if member_id:
        q = q.filter_by(member_id=member_id)

    fines = q.order_by(FineTransaction.created_at.desc()).limit(500).all()
    return jsonify([f.to_dict() for f in fines]), 200


@library_bp.route('/fines/<int:fine_id>/collect', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def collect_fine(fine_id):
    fine = FineTransaction.query.get_or_404(fine_id)
    if fine.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if fine.status in ('PAID', 'WAIVED'):
        return jsonify({'error': f'Fine already {fine.status}'}), 400

    data   = request.get_json() or {}
    amount = float(data.get('amount', fine.amount - fine.amount_paid))

    fine.amount_paid += amount
    if fine.amount_paid >= fine.amount:
        fine.status = 'PAID'
    else:
        fine.status = 'PARTIAL'

    fine.collected_by = get_current_user().id
    fine.collected_at  = datetime.utcnow()
    db.session.commit()

    log_activity(_school_id(), get_current_user().id, 'FINE_COLLECTED', f'₹{amount:.0f} (fine #{fine.id})')
    db.session.commit()
    return jsonify(fine.to_dict()), 200


@library_bp.route('/fines/<int:fine_id>/waive', methods=['POST'])
@role_required('PRINCIPAL', 'LIBRARIAN')
def waive_fine(fine_id):
    fine = FineTransaction.query.get_or_404(fine_id)
    if fine.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if fine.status in ('PAID', 'WAIVED'):
        return jsonify({'error': f'Fine already {fine.status}'}), 400

    data = request.get_json() or {}
    fine.status       = 'WAIVED'
    fine.waived_by    = get_current_user().id
    fine.waive_reason = (data.get('reason') or '').strip()
    db.session.commit()

    log_activity(_school_id(), get_current_user().id, 'FINE_WAIVED',
                 f'Fine #{fine.id} — {fine.waive_reason}')
    db.session.commit()
    return jsonify(fine.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Currently-Issued / Overdue lists (used by dashboard + return screen)
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/issues', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_issues():
    """
    Query: status (ISSUED/RETURNED/LOST), overdue_only=1, member_id, page, per_page
    """
    sid = _school_id()
    q = BookIssue.query.filter_by(school_id=sid)

    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)

    member_id = request.args.get('member_id')
    if member_id:
        q = q.filter_by(member_id=member_id)

    if request.args.get('overdue_only') == '1':
        q = q.filter(BookIssue.status == 'ISSUED', BookIssue.due_date < date.today())

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    paginated = q.order_by(BookIssue.issue_date.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':  [i.to_dict() for i in paginated.items],
        'total': paginated.total,
        'page':  paginated.page,
        'pages': paginated.pages,
    }), 200





# ═══════════════════════════════════════════════════════════════════════════
#  Reservations
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/reservations', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_reservations():
    sid    = _school_id()
    status = request.args.get('status', 'WAITING')
    book_id = request.args.get('book_id')

    q = BookReservation.query.filter_by(school_id=sid)
    if status:
        q = q.filter_by(status=status)
    if book_id:
        q = q.filter_by(book_id=book_id)

    reservations = q.order_by(BookReservation.queue_position.asc()).all()
    return jsonify([r.to_dict() for r in reservations]), 200


@library_bp.route('/reservations', methods=['POST'])
@role_required(*LIBRARY_ROLES, 'STUDENT')
def create_reservation():
    """
    A member reserves a book (typically because all copies are currently issued).
    Body: { book_id, member_id }
    Students can self-reserve for themselves; librarian can reserve on behalf of anyone.
    """
    data      = request.get_json() or {}
    book_id   = data.get('book_id')
    member_id = data.get('member_id')

    if not book_id or not member_id:
        return jsonify({'error': 'book_id and member_id required'}), 400

    sid    = _school_id()
    book   = Book.query.get_or_404(book_id)
    member = LibraryMember.query.get_or_404(member_id)
    if book.school_id != sid or member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    current_user = get_current_user()
    # Students can only reserve for themselves
    if current_user.role.value == 'STUDENT' and member.user_id != current_user.id:
        return jsonify({'error': 'Apne liye hi reserve kar sakte ho'}), 403

    if member.status != 'ACTIVE':
        return jsonify({'error': f'Member is {member.status}'}), 400

    # Don't allow reserving a book that has an available copy right now
    available_copy = BookCopy.query.filter_by(book_id=book_id, status='AVAILABLE').first()
    if available_copy:
        return jsonify({'error': 'Book abhi available hai — seedha issue karwao, reserve karne ki zaroorat nahi'}), 400

    # Prevent duplicate reservation by same member for same book
    existing = BookReservation.query.filter_by(
        book_id=book_id, member_id=member_id, status='WAITING'
    ).first()
    if existing:
        return jsonify({'error': 'Already is book ke liye reservation queue mein ho'}), 409

    settings = _get_or_create_settings(sid)
    active_reservation_count = BookReservation.query.filter_by(
        member_id=member_id, status='WAITING'
    ).count()
    if active_reservation_count >= settings.reservation_limit_per_member:
        return jsonify({
            'error': f'Max reservation limit ({settings.reservation_limit_per_member}) reach ho chuka hai'
        }), 400

    last_position = db.session.query(db.func.max(BookReservation.queue_position))\
        .filter_by(book_id=book_id, status='WAITING').scalar() or 0

    reservation = BookReservation(
        school_id=sid, book_id=book_id, member_id=member_id,
        status='WAITING', queue_position=last_position + 1,
    )
    db.session.add(reservation)
    db.session.commit()

    log_activity(sid, current_user.id, 'BOOK_RESERVED',
                 f'{book.title} — {member.user.name if member.user else ""} (position {reservation.queue_position})')
    db.session.commit()
    return jsonify(reservation.to_dict()), 201


@library_bp.route('/reservations/<int:res_id>/cancel', methods=['POST'])
@role_required(*LIBRARY_ROLES, 'STUDENT')
def cancel_reservation(res_id):
    reservation = BookReservation.query.get_or_404(res_id)
    sid = _school_id()
    if reservation.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    current_user = get_current_user()
    if current_user.role.value == 'STUDENT' and reservation.member.user_id != current_user.id:
        return jsonify({'error': 'Sirf apna reservation cancel kar sakte ho'}), 403

    if reservation.status != 'WAITING':
        return jsonify({'error': f'Reservation already {reservation.status}'}), 400

    reservation.status = 'CANCELLED'
    db.session.flush()

    # Re-sequence remaining queue positions
    remaining = BookReservation.query.filter_by(
        book_id=reservation.book_id, status='WAITING'
    ).order_by(BookReservation.queue_position.asc()).all()
    for idx, r in enumerate(remaining, start=1):
        r.queue_position = idx

    db.session.commit()
    return jsonify({'message': 'Reservation cancelled'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Dashboard
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/dashboard', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def library_dashboard():
    sid   = _school_id()
    today = date.today()
    month_start = today.replace(day=1)

    total_books    = Book.query.filter_by(school_id=sid, is_active=True).count()
    all_copies     = BookCopy.query.filter_by(school_id=sid).all()
    available      = sum(1 for c in all_copies if c.status == 'AVAILABLE')
    issued         = sum(1 for c in all_copies if c.status == 'ISSUED')
    lost           = sum(1 for c in all_copies if c.status == 'LOST')

    overdue_count  = BookIssue.query.filter(
        BookIssue.school_id == sid, BookIssue.status == 'ISSUED',
        BookIssue.due_date < today
    ).count()

    reserved_count = BookReservation.query.filter_by(school_id=sid, status='WAITING').count()
    total_members  = LibraryMember.query.filter_by(school_id=sid, status='ACTIVE').count()

    today_issued = BookIssue.query.filter_by(school_id=sid, issue_date=today).count()
    today_returned = BookIssue.query.filter(
        BookIssue.school_id == sid, BookIssue.return_date == today
    ).count()

    today_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount_paid), 0)).filter(
        FineTransaction.school_id == sid,
        db.func.date(FineTransaction.collected_at) == today
    ).scalar() or 0

    month_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount_paid), 0)).filter(
        FineTransaction.school_id == sid,
        FineTransaction.collected_at >= month_start
    ).scalar() or 0

    new_books_month = Book.query.filter(
        Book.school_id == sid, Book.created_at >= month_start
    ).count()

    return jsonify({
        'total_books':       total_books,
        'available_books':   available,
        'issued_books':      issued,
        'overdue_books':     overdue_count,
        'reserved_books':    reserved_count,
        'lost_books':        lost,
        'total_members':     total_members,
        'today_issued':      today_issued,
        'today_returned':    today_returned,
        'today_fine':        today_fine,
        'month_fine':        month_fine,
        'new_books_month':   new_books_month,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Global Search (books + members combined — used by top search bar)
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/search', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def global_search():
    q = (request.args.get('q') or '').strip()
    if not q or len(q) < 2:
        return jsonify({'books': [], 'members': []}), 200

    sid  = _school_id()
    like = f'%{q}%'

    books = Book.query.filter(
        Book.school_id == sid, Book.is_active == True,
        db.or_(
            Book.title.ilike(like), Book.isbn.ilike(like),
            Book.author.ilike(like), Book.publisher.ilike(like),
            Book.rack.ilike(like), Book.subject.ilike(like),
        )
    ).limit(10).all()

    # Barcode exact match (fast path for scanner input)
    copy_match = BookCopy.query.filter_by(barcode=q, school_id=sid).first()

    members = LibraryMember.query.filter_by(school_id=sid).join(
        User, LibraryMember.user_id == User.id
    ).filter(
        db.or_(User.name.ilike(like), LibraryMember.card_number.ilike(like))
    ).limit(10).all()

    return jsonify({
        'books':        [b.to_dict() for b in books],
        'members':      [m.to_dict() for m in members],
        'barcode_hit':  copy_match.to_dict() if copy_match else None,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Reports
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/reports/popular-books', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_popular_books():
    sid   = _school_id()
    limit = request.args.get('limit', 10, type=int)

    agg = db.session.query(
        BookIssue.book_id,
        db.func.count(BookIssue.id).label('issue_count')
    ).filter_by(school_id=sid).group_by(BookIssue.book_id)\
     .order_by(db.func.count(BookIssue.id).desc()).limit(limit).all()

    result = []
    for book_id, count in agg:
        book = Book.query.get(book_id)
        if book:
            result.append({'book_id': book_id, 'title': book.title, 'author': book.author, 'issue_count': count})
    return jsonify(result), 200


@library_bp.route('/reports/overdue', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_overdue():
    sid = _school_id()
    issues = BookIssue.query.filter(
        BookIssue.school_id == sid, BookIssue.status == 'ISSUED',
        BookIssue.due_date < date.today()
    ).order_by(BookIssue.due_date.asc()).all()
    return jsonify([i.to_dict() for i in issues]), 200


@library_bp.route('/reports/fine-collection', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_fine_collection():
    """Query: from_date, to_date (YYYY-MM-DD)"""
    sid = _school_id()
    q = FineTransaction.query.filter_by(school_id=sid, status='PAID')

    from_date = request.args.get('from_date')
    to_date   = request.args.get('to_date')
    if from_date:
        q = q.filter(FineTransaction.collected_at >= date.fromisoformat(from_date))
    if to_date:
        q = q.filter(FineTransaction.collected_at <= date.fromisoformat(to_date))

    fines = q.order_by(FineTransaction.collected_at.desc()).all()
    total = sum(f.amount_paid for f in fines)

    return jsonify({
        'total_collected': total,
        'count':           len(fines),
        'data':            [f.to_dict() for f in fines],
    }), 200


@library_bp.route('/reports/activity-log', methods=['GET'])
@role_required(*LIBRARY_ADMIN_ROLES)
def report_activity_log():
    from app.models.library import LibraryActivityLog
    sid   = _school_id()
    limit = request.args.get('limit', 100, type=int)
    logs  = LibraryActivityLog.query.filter_by(school_id=sid)\
                .order_by(LibraryActivityLog.created_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs]), 200
