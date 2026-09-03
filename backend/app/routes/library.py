from flask import Blueprint, request, jsonify, send_file
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.library import (
    BookCategory, Book, BookCopy, LibraryMember, BookIssue,
    BookReservation, FineTransaction, LibrarySettings, LibraryActivityLog, log_activity,
    LibraryVisit
)
from app.models.academic import Class, Student
from app.models.user import User, UserRole
from app.services.library_fee_service import (
    generate_library_fine_fee_record, record_library_fine_payment
)
from datetime import datetime, date
import random
import string

library_bp = Blueprint('library', __name__)

LIBRARY_ROLES = ('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'LIBRARIAN', 'TEACHER', 'SUPER_ADMIN')
LIBRARY_ADMIN_ROLES = ('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'LIBRARIAN', 'SUPER_ADMIN')
WAIVER_ROLES = ('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN', 'LIBRARIAN')


def _school_id():
    user = get_current_user()
    if not user:
        return None
    return user.school_id


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


def _gen_card_number(sid):
    """LIB-2026-001234 style card number."""
    year = date.today().year
    prefix = f"LIB-{year}-"
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
    return f"{prefix}{n:06d}"


# ═══════════════════════════════════════════════════════════════════════════
#  Dashboard KPI Summary
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/dashboard', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def get_dashboard():
    sid = _school_id()
    today = date.today()
    first_day_of_month = date(today.year, today.month, 1)

    total_books = Book.query.filter_by(school_id=sid, is_active=True).count()
    
    copies = BookCopy.query.filter_by(school_id=sid).all()
    available_books = sum(1 for c in copies if c.status == 'AVAILABLE')
    issued_books    = sum(1 for c in copies if c.status == 'ISSUED')
    reserved_books  = sum(1 for c in copies if c.status == 'RESERVED')
    lost_books      = sum(1 for c in copies if c.status in ('LOST', 'DAMAGED'))

    overdue_books = BookIssue.query.filter(
        BookIssue.school_id == sid,
        BookIssue.status == 'ISSUED',
        BookIssue.due_date < today
    ).count()

    total_members = LibraryMember.query.filter_by(school_id=sid, status='ACTIVE').count()

    # Financials
    fines = FineTransaction.query.filter_by(school_id=sid).all()
    outstanding_fines = sum(f.outstanding_amount for f in fines if f.outstanding_amount > 0)
    total_waived = sum(f.waived_amount or 0.0 for f in fines)

    today_fine = sum(
        f.amount_paid or 0.0 for f in fines
        if f.collected_at and (f.collected_at.date() if hasattr(f.collected_at, 'date') else f.collected_at) == today
    )

    month_fine = sum(
        f.amount_paid or 0.0 for f in fines
        if f.collected_at and (f.collected_at.date() if hasattr(f.collected_at, 'date') else f.collected_at) >= first_day_of_month
    )

    new_books_month = Book.query.filter(
        Book.school_id == sid,
        Book.created_at >= datetime.combine(first_day_of_month, datetime.min.time())
    ).count()

    return jsonify({
        'total_books':       total_books,
        'available_books':   available_books,
        'issued_books':      issued_books,
        'overdue_books':     overdue_books,
        'reserved_books':    reserved_books,
        'lost_books':        lost_books,
        'total_members':     total_members,
        'outstanding_fines': round(outstanding_fines, 2),
        'today_fine':        round(today_fine, 2),
        'month_fine':        round(month_fine, 2),
        'total_waived':      round(total_waived, 2),
        'new_books_month':   new_books_month,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Categories
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/categories', methods=['GET'])
@role_required(*LIBRARY_ROLES, 'STUDENT', 'PARENT')
def list_categories():
    sid = _school_id()
    cats = BookCategory.query.filter_by(school_id=sid).order_by(BookCategory.name).all()
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
        return jsonify({'error': f'{cat.books.count()} books are linked to this category — reassign them first'}), 400
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'message': 'Category deleted successfully'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Books (Master) & Copies (Inventory)
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/books', methods=['GET'])
@role_required(*LIBRARY_ROLES, 'STUDENT', 'PARENT')
def list_books():
    sid      = _school_id()
    search   = (request.args.get('search') or '').strip()
    cat_id   = request.args.get('category_id')
    subject  = request.args.get('subject')
    rack     = request.args.get('rack')
    class_id = request.args.get('class_id')
    active   = request.args.get('is_active')

    q = Book.query.filter_by(school_id=sid)
    if active is not None:
        q = q.filter_by(is_active=(active.lower() == 'true' or active == '1'))
    if cat_id:
        q = q.filter_by(category_id=cat_id)
    if subject:
        q = q.filter_by(subject=subject)
    if rack:
        q = q.filter_by(rack=rack)
    if class_id:
        q = q.filter_by(class_id=class_id)
    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                Book.title.ilike(like),
                Book.author.ilike(like),
                Book.isbn.ilike(like),
                Book.publisher.ilike(like),
                Book.keywords.ilike(like),
            )
        )

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    paginated = q.order_by(Book.title.asc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':  [b.to_dict() for b in paginated.items],
        'total': paginated.total,
        'page':  paginated.page,
        'pages': paginated.pages,
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
    Creates Book Master and optionally creates N initial physical copies (BookCopy).
    """
    data  = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400

    sid = _school_id()
    user_id = get_current_user().id

    purchase_date = None
    if data.get('purchase_date'):
        try:
            purchase_date = date.fromisoformat(data['purchase_date'])
        except ValueError:
            pass

    book = Book(
        school_id     = sid,
        title         = title,
        subtitle      = (data.get('subtitle') or '').strip(),
        isbn          = (data.get('isbn') or '').strip(),
        accession_no  = (data.get('accession_no') or '').strip(),
        category_id   = data.get('category_id'),
        subject       = (data.get('subject') or '').strip(),
        author        = (data.get('author') or '').strip(),
        publisher     = (data.get('publisher') or '').strip(),
        edition       = (data.get('edition') or '').strip(),
        language      = (data.get('language') or 'English').strip(),
        class_id      = data.get('class_id'),
        rack          = (data.get('rack') or '').strip(),
        shelf         = (data.get('shelf') or '').strip(),
        purchase_date = purchase_date,
        vendor_name   = (data.get('vendor_name') or '').strip(),
        purchase_price= float(data.get('purchase_price') or 0.0),
        mrp           = float(data.get('mrp') or 0.0),
        cover_url     = data.get('cover_url'),
        description   = (data.get('description') or '').strip(),
        keywords      = (data.get('keywords') or '').strip(),
        created_by    = user_id,
    )
    db.session.add(book)
    db.session.flush()

    # Initial physical copies creation
    copies_to_add = int(data.get('initial_copies') or 0)
    for _ in range(copies_to_add):
        copy = BookCopy(
            book_id=book.id,
            school_id=sid,
            copy_accession_no=_gen_accession_no(sid),
            barcode=_gen_barcode(),
            status='AVAILABLE',
            condition_note='Brand new on registration',
        )
        db.session.add(copy)

    db.session.commit()
    log_activity(sid, user_id, 'BOOK_ADDED', f'{title} ({copies_to_add} copies)')
    db.session.commit()
    return jsonify(book.to_dict()), 201


@library_bp.route('/books/<int:book_id>', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    for f in ('title', 'subtitle', 'isbn', 'accession_no', 'subject', 'author',
              'publisher', 'edition', 'language', 'rack', 'shelf',
              'vendor_name', 'cover_url', 'description', 'keywords'):
        if f in data:
            setattr(book, f, (data[f] or '').strip())

    if 'category_id' in data:    book.category_id    = data['category_id']
    if 'class_id' in data:       book.class_id       = data['class_id']
    if 'purchase_price' in data: book.purchase_price = float(data['purchase_price'] or 0.0)
    if 'mrp' in data:            book.mrp            = float(data['mrp'] or 0.0)
    if 'is_active' in data:      book.is_active      = bool(data['is_active'])

    if data.get('purchase_date'):
        try:
            book.purchase_date = date.fromisoformat(data['purchase_date'])
        except ValueError:
            pass

    db.session.commit()
    return jsonify(book.to_dict()), 200


@library_bp.route('/books/<int:book_id>', methods=['DELETE'])
@role_required(*LIBRARY_ADMIN_ROLES)
def delete_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    # Check if any copies are currently issued
    issued_count = BookIssue.query.filter_by(book_id=book.id, status='ISSUED').count()
    if issued_count > 0:
        return jsonify({'error': f'Cannot delete book: {issued_count} copies are currently issued out.'}), 400

    db.session.delete(book)
    db.session.commit()
    log_activity(_school_id(), get_current_user().id, 'BOOK_DELETED', book.title)
    db.session.commit()
    return jsonify({'message': 'Book deleted successfully'}), 200


# ── Copies / Physical Inventory ──

@library_bp.route('/books/<int:book_id>/copies', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def add_book_copies(book_id):
    book = Book.query.get_or_404(book_id)
    sid  = _school_id()
    if book.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data  = request.get_json() or {}
    count = int(data.get('count') or 1)
    condition_note = (data.get('condition_note') or 'New physical copy').strip()

    created_copies = []
    for _ in range(count):
        copy = BookCopy(
            book_id=book.id,
            school_id=sid,
            copy_accession_no=_gen_accession_no(sid),
            barcode=_gen_barcode(),
            status='AVAILABLE',
            condition_note=condition_note,
        )
        db.session.add(copy)
        created_copies.append(copy)

    db.session.commit()
    log_activity(sid, get_current_user().id, 'COPIES_ADDED', f'{book.title} (+{count} copies)')
    db.session.commit()
    return jsonify([c.to_dict() for c in created_copies]), 201


@library_bp.route('/copies/<int:copy_id>', methods=['PATCH'])
@role_required(*LIBRARY_ADMIN_ROLES)
def update_copy(copy_id):
    copy = BookCopy.query.get_or_404(copy_id)
    if copy.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    if 'status' in data and data['status'] in ('AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED', 'MAINTENANCE', 'REMOVED'):
        copy.status = data['status']
    if 'condition_note' in data:
        copy.condition_note = (data['condition_note'] or '').strip()
    if 'shelf_location' in data:
        copy.shelf_location = (data['shelf_location'] or '').strip()

    db.session.commit()
    return jsonify(copy.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Library Members
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/members', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_members():
    sid    = _school_id()
    search = (request.args.get('search') or '').strip()
    m_type = request.args.get('member_type')
    status = request.args.get('status')

    q = LibraryMember.query.filter_by(school_id=sid)
    if m_type:
        q = q.filter_by(member_type=m_type)
    if status:
        q = q.filter_by(status=status)

    if search:
        like = f'%{search}%'
        q = q.join(User, LibraryMember.user_id == User.id).filter(
            db.or_(User.name.ilike(like), User.email.ilike(like), LibraryMember.card_number.ilike(like))
        )

    members = q.all()
    return jsonify([m.to_dict() for m in members]), 200


@library_bp.route('/members/search-eligible', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def search_eligible_users():
    """
    Search Students/Teachers who are NOT yet library members, to enroll them.
    """
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
    ).limit(20).all()

    return jsonify([
        {'user_id': u.id, 'name': u.name, 'email': u.email, 'is_member': u.id in existing_user_ids}
        for u in users
    ]), 200


@library_bp.route('/members', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def create_member():
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
        return jsonify({'error': 'User is already enrolled as a library member'}), 409

    member = LibraryMember(
        school_id   = sid,
        user_id     = user_id,
        card_number = _gen_card_number(sid),
        member_type = m_type,
        status      = 'ACTIVE',
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
    sid = _school_id()
    if member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    issues = BookIssue.query.filter_by(member_id=member_id).order_by(BookIssue.issue_date.desc()).all()
    fines  = FineTransaction.query.filter_by(member_id=member_id).order_by(FineTransaction.created_at.desc()).all()

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
    Issues a book copy to an active library member.
    Body: { member_id, barcode } OR { member_id, book_id }
    """
    data      = request.get_json() or {}
    member_id = data.get('member_id')
    barcode   = data.get('barcode')
    book_id   = data.get('book_id')

    if not member_id or (not barcode and not book_id):
        return jsonify({'error': 'member_id and (barcode or book_id) are required'}), 400

    sid    = _school_id()
    member = LibraryMember.query.get_or_404(member_id)
    if member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    if member.status != 'ACTIVE':
        return jsonify({'error': f'Member account is {member.status} — cannot issue books'}), 400

    settings = _get_or_create_settings(sid)

    # 1. Pending Fine Check
    pending_fines = FineTransaction.query.filter_by(member_id=member_id).filter(
        FineTransaction.status.in_(['OUTSTANDING', 'PARTIALLY_PAID', 'PENDING', 'PARTIAL'])
    ).all()
    pending_fine_amt = sum(f.outstanding_amount for f in pending_fines)
    if pending_fine_amt > 0 and pending_fine_amt >= settings.max_fine_cap:
        return jsonify({
            'error': f'Member has outstanding fines of ₹{pending_fine_amt:.0f} (exceeds cap ₹{settings.max_fine_cap:.0f}) — please clear dues before issuing new books'
        }), 400

    # 2. Max Books Limit Check
    current_issued = BookIssue.query.filter_by(member_id=member_id, status='ISSUED').count()
    max_allowed = _max_books_for(member, settings)
    if current_issued >= max_allowed:
        return jsonify({
            'error': f'Member already has {current_issued} books issued (maximum limit: {max_allowed})'
        }), 400

    # 3. Find Physical Copy
    if barcode:
        copy = BookCopy.query.filter_by(barcode=barcode, school_id=sid).first()
        if not copy:
            return jsonify({'error': 'Physical copy barcode not found in school catalog'}), 404
        if copy.status != 'AVAILABLE':
            return jsonify({'error': f'Physical copy is currently {copy.status} and not available for issue'}), 400
    else:
        copy = BookCopy.query.filter_by(book_id=book_id, school_id=sid, status='AVAILABLE').first()
        if not copy:
            return jsonify({'error': 'No physical copy of this title is currently available — please reserve it.'}), 400

    # 4. Reservation Queue Check
    top_reservation = BookReservation.query.filter_by(
        book_id=copy.book_id, status='WAITING'
    ).order_by(BookReservation.queue_position.asc()).first()
    if top_reservation and top_reservation.member_id != member_id:
        reserver_name = top_reservation.member.user.name if top_reservation.member and top_reservation.member.user else "another member"
        return jsonify({
            'error': f'This book is currently reserved by {reserver_name} (position #1 in queue).'
        }), 409

    # 5. Issue Book
    issue_date = date.today()
    due_date   = date.fromordinal(issue_date.toordinal() + settings.issue_duration_days)

    issue = BookIssue(
        school_id  = sid,
        copy_id    = copy.id,
        book_id    = copy.book_id,
        member_id  = member_id,
        issue_date = issue_date,
        due_date   = due_date,
        status     = 'ISSUED',
        issued_by  = get_current_user().id,
        remarks    = data.get('remarks', ''),
    )
    copy.status = 'ISSUED'
    db.session.add(issue)

    # Fulfill reservation if this issue is for the reserving member
    if top_reservation and top_reservation.member_id == member_id:
        top_reservation.status = 'FULFILLED'
        remaining = BookReservation.query.filter_by(book_id=copy.book_id, status='WAITING').order_by(BookReservation.queue_position.asc()).all()
        for idx, r in enumerate(remaining, start=1):
            r.queue_position = idx

    db.session.commit()
    log_activity(sid, get_current_user().id, 'BOOK_ISSUED',
                 f'{copy.book.title} → {member.user.name if member.user else ""} (Due: {due_date})')
    db.session.commit()

    return jsonify(issue.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════════
#  Book Return + Fine Calculation
# ═══════════════════════════════════════════════════════════════════════════

def _calc_overdue_fine(issue, settings, return_date):
    if return_date <= issue.due_date:
        return 0.0
    overdue_days = (return_date - issue.due_date).days
    fine = overdue_days * (settings.fine_per_day or 2.0)
    return min(fine, settings.max_fine_cap or 200.0)


@library_bp.route('/return', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def return_book():
    """
    Returns a book copy.
    Calculates overdue/lost/damage fines. Fines are created as OUTSTANDING (never auto-paid).
    If collect_fine_now is true, generates a real financial payment transaction atomically.
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
            return jsonify({'error': 'This copy is not currently issued out'}), 400
    else:
        return jsonify({'error': 'issue_id or barcode is required'}), 400

    if issue.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if issue.status != 'ISSUED':
        return jsonify({'error': f'Issue record is already marked as {issue.status}'}), 400

    settings    = _get_or_create_settings(sid)
    return_date = date.today()
    copy        = issue.copy

    mark_lost    = bool(data.get('mark_lost'))
    mark_damaged = bool(data.get('mark_damaged'))

    fine_created = None

    if mark_lost:
        issue.status      = 'LOST'
        issue.return_date = return_date
        issue.returned_by = get_current_user().id
        copy.status       = 'LOST'

        default_lost_fine = (copy.book.mrp or copy.book.purchase_price or 0.0) * (settings.lost_book_fine_multiplier or 1.0)
        lost_fine = float(data.get('fine_amount')) if data.get('fine_amount') is not None and str(data.get('fine_amount')).strip() != '' else default_lost_fine
        fine_created = FineTransaction(
            school_id     = sid,
            issue_id      = issue.id,
            member_id     = issue.member_id,
            reason        = 'LOST',
            amount        = max(0.0, lost_fine),
            amount_paid   = 0.0,
            waived_amount = 0.0,
            status        = 'OUTSTANDING',
        )
        db.session.add(fine_created)
        log_activity(sid, get_current_user().id, 'BOOK_LOST', f'{copy.book.title} (Fine: ₹{lost_fine:.0f})')

    else:
        issue.status      = 'RETURNED'
        issue.return_date = return_date
        issue.returned_by = get_current_user().id

        if mark_damaged:
            copy.status = 'DAMAGED'
            copy.condition_note = data.get('condition_note', 'Marked damaged upon return')
            default_damage_fine = (copy.book.mrp or copy.book.purchase_price or 0.0) * (settings.damaged_book_fine_multiplier or 0.5)
            damage_fine = float(data.get('fine_amount')) if data.get('fine_amount') is not None and str(data.get('fine_amount')).strip() != '' else default_damage_fine
            fine_created = FineTransaction(
                school_id     = sid,
                issue_id      = issue.id,
                member_id     = issue.member_id,
                reason        = 'DAMAGED',
                amount        = max(0.0, damage_fine),
                amount_paid   = 0.0,
                waived_amount = 0.0,
                status        = 'OUTSTANDING',
            )
            db.session.add(fine_created)
        else:
            copy.status = 'AVAILABLE'

        overdue_fine = _calc_overdue_fine(issue, settings, return_date)
        if overdue_fine > 0:
            fine_created = FineTransaction(
                school_id     = sid,
                issue_id      = issue.id,
                member_id     = issue.member_id,
                reason        = 'OVERDUE',
                amount        = overdue_fine,
                amount_paid   = 0.0,
                waived_amount = 0.0,
                status        = 'OUTSTANDING',
            )
            db.session.add(fine_created)

        log_activity(sid, get_current_user().id, 'BOOK_RETURNED', f'{copy.book.title} (Status: {copy.status})')

    db.session.flush()

    # Create / Sync FeeRecord in Fee Management
    if fine_created:
        generate_library_fine_fee_record(fine_created, created_by=get_current_user().id)
        db.session.flush()

        # If Librarian collected payment right at return counter, record the financial transaction
        if data.get('collect_fine_now'):
            payment_mode = data.get('payment_mode', 'CASH')
            record_library_fine_payment(
                fine_created,
                payment_amount=fine_created.amount,
                payment_mode=payment_mode,
                collected_by_user_id=get_current_user().id,
                remarks='Collected at library return counter'
            )

    # Notify top reservation if copy became available
    if copy.status == 'AVAILABLE':
        top_res = BookReservation.query.filter_by(book_id=copy.book_id, status='WAITING').order_by(BookReservation.queue_position.asc()).first()
        if top_res:
            top_res.status = 'NOTIFIED'

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
        return jsonify({'error': 'Only currently-issued books can be renewed'}), 400

    settings = _get_or_create_settings(sid)

    if issue.renewal_count >= settings.max_renewals:
        return jsonify({'error': f'Maximum renewal limit ({settings.max_renewals}) reached'}), 400

    # Block renewal if someone else is waiting for this book in reservation queue
    waiting = BookReservation.query.filter_by(book_id=issue.book_id, status='WAITING').first()
    if waiting:
        return jsonify({'error': 'Cannot renew: this book is reserved by another reader.'}), 409

    issue.due_date = date.fromordinal(issue.due_date.toordinal() + settings.issue_duration_days)
    issue.renewal_count += 1
    db.session.commit()

    log_activity(sid, get_current_user().id, 'BOOK_RENEWED', f'{issue.book.title} (New Due: {issue.due_date})')
    db.session.commit()
    return jsonify(issue.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Fine / Penalty Lifecycle Management
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/fines', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_fines():
    sid       = _school_id()
    status    = request.args.get('status')
    member_id = request.args.get('member_id')
    reason    = request.args.get('reason')

    q = FineTransaction.query.filter_by(school_id=sid)
    if status:
        if status == 'OUTSTANDING':
            q = q.filter(FineTransaction.status.in_(['OUTSTANDING', 'PENDING']))
        elif status == 'PARTIALLY_PAID':
            q = q.filter(FineTransaction.status.in_(['PARTIALLY_PAID', 'PARTIAL']))
        else:
            q = q.filter_by(status=status)
    if member_id:
        q = q.filter_by(member_id=member_id)
    if reason:
        q = q.filter_by(reason=reason.upper())

    fines = q.order_by(FineTransaction.created_at.desc()).limit(500).all()

    result = []
    for f in fines:
        d = f.to_dict()
        issue = BookIssue.query.get(f.issue_id) if f.issue_id else None
        if issue:
            d['book_title']    = issue.book.title if issue.book else ''
            d['book_mrp']      = issue.book.mrp if issue.book else 0
            d['due_date']      = str(issue.due_date)
            d['return_date']   = str(issue.return_date) if issue.return_date else None
            d['overdue_days']  = issue.to_dict()['overdue_days']
            d['issue_status']  = issue.status
        else:
            d['book_title'] = d['book_mrp'] = d['due_date'] = d['return_date'] = d['overdue_days'] = None
            d['issue_status'] = None

        member = LibraryMember.query.get(f.member_id)
        if member and member.member_type == 'STUDENT':
            student = Student.query.filter_by(user_id=member.user_id, school_id=sid).first()
            if student:
                cls = Class.query.get(student.class_id) if student.class_id else None
                d['class_name']  = f"{cls.name} - {cls.section}" if cls else ''
                d['roll_number'] = student.roll_number or ''
                d['student_id']  = student.id
        else:
            d['class_name'] = d['roll_number'] = ''
        result.append(d)

    return jsonify(result), 200


@library_bp.route('/fines/manual', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def create_manual_fine():
    """
    Creates a manual penalty (e.g. Lost Library Card, Missing Pages, Damaged Spine, etc.).
    Fine is created as OUTSTANDING.
    """
    data      = request.get_json() or {}
    member_id = data.get('member_id')
    amount    = data.get('amount')
    reason    = (data.get('reason') or 'MANUAL').strip().upper()[:50]
    remarks   = (data.get('remarks') or '').strip()

    if not member_id or amount is None:
        return jsonify({'error': 'member_id and amount are required'}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({'error': 'amount must be a valid number'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount must be greater than 0'}), 400

    sid    = _school_id()
    member = LibraryMember.query.get_or_404(member_id)
    if member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    issue_id = data.get('issue_id') or None
    if issue_id:
        issue = BookIssue.query.get(issue_id)
        if not issue or issue.school_id != sid:
            return jsonify({'error': 'Invalid issue_id'}), 400

    fine = FineTransaction(
        school_id     = sid,
        issue_id      = issue_id,
        member_id     = member_id,
        reason        = reason,
        amount        = amount,
        amount_paid   = 0.0,
        waived_amount = 0.0,
        status        = 'OUTSTANDING',
    )
    db.session.add(fine)
    db.session.flush()

    generate_library_fine_fee_record(fine, created_by=get_current_user().id)

    db.session.commit()
    log_activity(sid, get_current_user().id, 'FINE_MANUAL_ADDED',
                 f'{member.user.name if member.user else ""} — ₹{amount:.0f} ({reason})')
    db.session.commit()

    return jsonify(fine.to_dict()), 201


@library_bp.route('/fines/<int:fine_id>/collect', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def collect_fine(fine_id):
    """
    Collect payment for a library penalty.
    Uses centralized finance service: updates FeeRecord, creates FeeTransaction,
    and updates FineTransaction with double-payment protection.
    """
    fine = FineTransaction.query.get_or_404(fine_id)
    if fine.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    if fine.outstanding_amount <= 0 or fine.status in ('PAID', 'WAIVED', 'CANCELLED'):
        return jsonify({'error': 'Fine is already settled. Outstanding balance is ₹0.'}), 400

    data         = request.get_json() or {}
    amount       = float(data.get('amount', fine.outstanding_amount))
    payment_mode = data.get('payment_mode', 'CASH')
    remarks      = data.get('remarks', '')

    try:
        res = record_library_fine_payment(
            fine_txn=fine,
            payment_amount=amount,
            payment_mode=payment_mode,
            collected_by_user_id=get_current_user().id,
            remarks=remarks
        )
        db.session.commit()
        log_activity(_school_id(), get_current_user().id, 'FINE_COLLECTED', f'₹{amount:.0f} (Fine #{fine.id})')
        db.session.commit()
        return jsonify(fine.to_dict()), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@library_bp.route('/fines/<int:fine_id>/waive', methods=['POST'])
@role_required(*WAIVER_ROLES)
def waive_fine(fine_id):
    """
    Waive or forgive a library fine.
    Allows partial or full waiver. Records waiver reason and authorized user without deleting history.
    """
    fine = FineTransaction.query.get_or_404(fine_id)
    if fine.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if fine.outstanding_amount <= 0 or fine.status in ('PAID', 'WAIVED', 'CANCELLED'):
        return jsonify({'error': f'Fine is already {fine.canonical_status}'}), 400

    data = request.get_json() or {}
    requested_waive_amt = data.get('waived_amount')
    if requested_waive_amt is not None:
        try:
            waive_amt = min(float(requested_waive_amt), fine.outstanding_amount)
        except (TypeError, ValueError):
            waive_amt = fine.outstanding_amount
    else:
        waive_amt = fine.outstanding_amount

    if waive_amt <= 0:
        return jsonify({'error': 'Waiver amount must be greater than 0'}), 400

    reason = (data.get('reason') or 'Approved by Principal/Admin').strip()

    fine.waived_amount = round((fine.waived_amount or 0.0) + waive_amt, 2)
    fine.waived_by     = get_current_user().id
    fine.waived_at     = datetime.utcnow()
    fine.waive_reason  = reason

    if fine.outstanding_amount <= 0:
        fine.status = 'WAIVED'
    else:
        fine.status = 'PARTIALLY_PAID'

    # Sync to FeeRecord
    from app.models.financial import FeeRecord
    linked_rec = FeeRecord.query.filter_by(source='LIBRARY', source_ref_id=fine.id).first()
    if linked_rec:
        linked_rec.discount = fine.waived_amount
        linked_rec.discount_reason = reason
        if linked_rec.amount_paid >= linked_rec.effective_due():
            linked_rec.status = 'PAID' if linked_rec.amount_paid > 0 else 'CANCELLED'
            linked_rec.remarks = (linked_rec.remarks or '') + f' [Waiver: ₹{waive_amt:.0f} - {reason}]'

    db.session.commit()
    log_activity(_school_id(), get_current_user().id, 'FINE_WAIVED',
                 f'Fine #{fine.id} — Waived ₹{waive_amt:.0f} ({reason})')
    db.session.commit()
    return jsonify(fine.to_dict()), 200


@library_bp.route('/fines/<int:fine_id>/resolve-replacement', methods=['POST'])
@role_required(*LIBRARY_ADMIN_ROLES)
def resolve_fine_with_replacement(fine_id):
    """
    Student brings a replacement physical copy for a lost book.
    Fine is marked WAIVED, and a new physical copy is inventoried into the system.
    """
    fine = FineTransaction.query.get_or_404(fine_id)
    sid  = _school_id()
    if fine.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if fine.status in ('PAID', 'WAIVED', 'CANCELLED'):
        return jsonify({'error': f'Fine already {fine.canonical_status}'}), 400
    if fine.reason != 'LOST':
        return jsonify({'error': 'Replacement is only applicable for LOST book penalties'}), 400

    data     = request.get_json() or {}
    add_copy = data.get('add_replacement_copy', True)
    remarks  = (data.get('remarks') or 'Replaced with new physical copy').strip()

    fine.waived_amount = fine.amount
    fine.status        = 'WAIVED'
    fine.waived_by     = get_current_user().id
    fine.waived_at     = datetime.utcnow()
    fine.waive_reason  = remarks

    from app.models.financial import FeeRecord
    linked_rec = FeeRecord.query.filter_by(source='LIBRARY', source_ref_id=fine.id).first()
    if linked_rec:
        linked_rec.discount = fine.amount
        linked_rec.status   = 'CANCELLED'
        linked_rec.remarks  = (linked_rec.remarks or '') + f' [Replaced with copy: {remarks}]'

    new_copy = None
    if add_copy and fine.issue_id:
        issue = BookIssue.query.get(fine.issue_id)
        if issue:
            new_copy = BookCopy(
                book_id=issue.book_id, school_id=sid,
                copy_accession_no=_gen_accession_no(sid),
                barcode=_gen_barcode(), status='AVAILABLE',
                condition_note=f'Replacement copy for lost book (Issue #{issue.id})',
            )
            db.session.add(new_copy)

    db.session.commit()
    log_activity(sid, get_current_user().id, 'FINE_RESOLVED_REPLACEMENT', f'Fine #{fine.id} — {remarks}')
    db.session.commit()

    result = fine.to_dict()
    if new_copy:
        result['new_copy'] = new_copy.to_dict()
    return jsonify(result), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Reservations
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/reservations', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_reservations():
    sid     = _school_id()
    status  = request.args.get('status', 'WAITING')
    book_id = request.args.get('book_id')

    q = BookReservation.query.filter_by(school_id=sid)
    if status and status != 'ALL':
        q = q.filter_by(status=status)
    if book_id:
        q = q.filter_by(book_id=book_id)

    reservations = q.order_by(BookReservation.queue_position.asc()).all()
    return jsonify([r.to_dict() for r in reservations]), 200


@library_bp.route('/reservations', methods=['POST'])
@role_required(*LIBRARY_ROLES, 'STUDENT')
def create_reservation():
    data      = request.get_json() or {}
    book_id   = data.get('book_id')
    member_id = data.get('member_id')

    sid = _school_id()
    current_user = get_current_user()

    # Self-service member resolution for Students/Teachers
    if not member_id and current_user.role.value in ('STUDENT', 'TEACHER'):
        mem = LibraryMember.query.filter_by(school_id=sid, user_id=current_user.id).first()
        if not mem:
            mem = LibraryMember(
                school_id=sid, user_id=current_user.id,
                card_number=_gen_card_number(sid),
                member_type=current_user.role.value,
                status='ACTIVE'
            )
            db.session.add(mem)
            db.session.flush()
        member_id = mem.id

    if not book_id or not member_id:
        return jsonify({'error': 'book_id and member_id are required'}), 400

    book   = Book.query.get_or_404(book_id)
    member = LibraryMember.query.get_or_404(member_id)
    if book.school_id != sid or member.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    if current_user.role.value == 'STUDENT' and member.user_id != current_user.id:
        return jsonify({'error': 'You can only reserve books for yourself'}), 403

    if member.status != 'ACTIVE':
        return jsonify({'error': f'Member status is {member.status}'}), 400

    # Prevent duplicate reservation in WAITING queue
    existing = BookReservation.query.filter_by(
        book_id=book_id, member_id=member_id, status='WAITING'
    ).first()
    if existing:
        return jsonify({'error': 'You already have an active reservation for this book'}), 409

    settings = _get_or_create_settings(sid)
    active_count = BookReservation.query.filter_by(member_id=member_id, status='WAITING').count()
    if active_count >= settings.reservation_limit_per_member:
        return jsonify({'error': f'Maximum reservation limit ({settings.reservation_limit_per_member}) reached'}), 400

    last_position = db.session.query(db.func.max(BookReservation.queue_position))\
        .filter_by(book_id=book_id, status='WAITING').scalar() or 0

    reservation = BookReservation(
        school_id      = sid,
        book_id        = book_id,
        member_id      = member_id,
        status         = 'WAITING',
        queue_position = last_position + 1,
    )
    db.session.add(reservation)
    db.session.commit()

    log_activity(sid, current_user.id, 'BOOK_RESERVED',
                 f'{book.title} — {member.user.name if member.user else ""} (Queue #{reservation.queue_position})')
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
        return jsonify({'error': 'You can only cancel your own reservation'}), 403

    if reservation.status not in ('WAITING', 'NOTIFIED'):
        return jsonify({'error': f'Reservation is already {reservation.status}'}), 400

    reservation.status = 'CANCELLED'
    db.session.flush()

    # Re-sequence remaining queue positions
    remaining = BookReservation.query.filter_by(book_id=reservation.book_id, status='WAITING').order_by(BookReservation.queue_position.asc()).all()
    for idx, r in enumerate(remaining, start=1):
        r.queue_position = idx

    db.session.commit()
    return jsonify({'message': 'Reservation cancelled successfully'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Student / Teacher Self-Service My Library
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/my-library', methods=['GET'])
@role_required('STUDENT', 'TEACHER', 'PARENT')
def my_library():
    """
    Self-service hub for Students and Teachers.
    Returns currently issued books, overdue status, fine summary, and reservations.
    """
    user = get_current_user()
    sid  = user.school_id

    member = LibraryMember.query.filter_by(school_id=sid, user_id=user.id).first()
    if not member:
        return jsonify({
            'member': None,
            'currently_issued': [],
            'history': [],
            'fines': [],
            'reservations': [],
            'summary': {
                'issued_count': 0,
                'overdue_count': 0,
                'total_fines': 0.0,
                'paid_fines': 0.0,
                'waived_fines': 0.0,
                'outstanding_fines': 0.0,
            }
        }), 200

    settings = _get_or_create_settings(sid)
    today = date.today()

    all_issues = BookIssue.query.filter_by(member_id=member.id).order_by(BookIssue.issue_date.desc()).all()
    currently_issued = []
    history = []

    for issue in all_issues:
        d = issue.to_dict()
        d['estimated_fine'] = _calc_overdue_fine(issue, settings, today) if d['overdue_days'] > 0 else 0.0
        if issue.status == 'ISSUED':
            currently_issued.append(d)
        else:
            history.append(d)

    all_fines = FineTransaction.query.filter_by(member_id=member.id).order_by(FineTransaction.created_at.desc()).all()
    fines_data = [f.to_dict() for f in all_fines]

    tot_fine = sum(float(f.amount or 0.0) for f in all_fines)
    tot_paid = sum(float(f.amount_paid or 0.0) for f in all_fines)
    tot_waived = sum(float(f.waived_amount or 0.0) for f in all_fines)
    tot_outstanding = sum(f.outstanding_amount for f in all_fines)

    reservations = BookReservation.query.filter_by(member_id=member.id).order_by(BookReservation.reserved_at.desc()).all()

    return jsonify({
        'member': member.to_dict(),
        'currently_issued': currently_issued,
        'history': history,
        'fines': fines_data,
        'reservations': [r.to_dict() for r in reservations],
        'summary': {
            'issued_count': len(currently_issued),
            'overdue_count': sum(1 for i in currently_issued if i['overdue_days'] > 0),
            'total_fines': round(tot_fine, 2),
            'paid_fines': round(tot_paid, 2),
            'waived_fines': round(tot_waived, 2),
            'outstanding_fines': round(tot_outstanding, 2),
        }
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Issues / Loan History
# ═══════════════════════════════════════════════════════════════════════════

def _enrich_issue_dict(issue, settings):
    d = issue.to_dict()
    member = issue.member
    d['class_name']  = ''
    d['roll_number'] = ''
    if member and member.member_type == 'STUDENT':
        student = Student.query.filter_by(user_id=member.user_id, school_id=issue.school_id).first()
        if student:
            cls = Class.query.get(student.class_id) if student.class_id else None
            d['class_name']  = f"{cls.name} - {cls.section}" if cls else ''
            d['roll_number'] = student.roll_number or ''
    d['estimated_fine'] = _calc_overdue_fine(issue, settings, date.today()) if d['overdue_days'] > 0 else 0.0
    return d


@library_bp.route('/issues', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def list_issues():
    sid = _school_id()
    q = BookIssue.query.filter_by(school_id=sid)

    status = request.args.get('status')
    if status and status != 'ALL':
        q = q.filter_by(status=status)

    member_id = request.args.get('member_id')
    if member_id:
        q = q.filter_by(member_id=member_id)

    if request.args.get('overdue_only') == '1':
        q = q.filter(BookIssue.status == 'ISSUED', BookIssue.due_date < date.today())

    class_id = request.args.get('class_id')
    if class_id:
        students   = Student.query.filter_by(school_id=sid, class_id=class_id).all()
        user_ids   = [s.user_id for s in students]
        member_ids = [m.id for m in LibraryMember.query.filter(
            LibraryMember.school_id == sid, LibraryMember.user_id.in_(user_ids)
        ).all()] if user_ids else []
        q = q.filter(BookIssue.member_id.in_(member_ids)) if member_ids else q.filter(db.false())

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    paginated = q.order_by(BookIssue.issue_date.desc()).paginate(page=page, per_page=per_page, error_out=False)

    settings = _get_or_create_settings(sid)

    return jsonify({
        'data':  [_enrich_issue_dict(i, settings) for i in paginated.items],
        'total': paginated.total,
        'page':  paginated.page,
        'pages': paginated.pages,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Dashboard (Librarian & Principal)
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
    damaged        = sum(1 for c in all_copies if c.status == 'DAMAGED')

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

    # Financial Stats
    all_fines = FineTransaction.query.filter_by(school_id=sid).all()
    outstanding_fines = sum(f.outstanding_amount for f in all_fines)
    total_waived = sum(float(f.waived_amount or 0.0) for f in all_fines)

    today_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount_paid), 0)).filter(
        FineTransaction.school_id == sid,
        db.func.date(FineTransaction.collected_at) == today
    ).scalar() or 0.0

    month_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount_paid), 0)).filter(
        FineTransaction.school_id == sid,
        FineTransaction.collected_at >= month_start
    ).scalar() or 0.0

    new_books_month = Book.query.filter(
        Book.school_id == sid, Book.created_at >= month_start
    ).count()

    return jsonify({
        'total_books':        total_books,
        'total_copies':       len(all_copies),
        'available_books':    available,
        'issued_books':       issued,
        'overdue_books':      overdue_count,
        'reserved_books':     reserved_count,
        'lost_books':         lost,
        'damaged_books':      damaged,
        'total_members':      total_members,
        'today_issued':       today_issued,
        'today_returned':     today_returned,
        'today_fine':         today_fine,
        'month_fine':         month_fine,
        'outstanding_fines':  round(outstanding_fines, 2),
        'total_waived':       round(total_waived, 2),
        'new_books_month':    new_books_month,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Settings & Fine Rules Master
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/settings', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def get_library_settings():
    sid = _school_id()
    settings = _get_or_create_settings(sid)
    return jsonify(settings.to_dict()), 200


@library_bp.route('/settings', methods=['PATCH'])
@role_required('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN')
def update_library_settings():
    sid = _school_id()
    settings = _get_or_create_settings(sid)
    data = request.get_json() or {}

    if 'max_books_student' in data:            settings.max_books_student            = int(data['max_books_student'])
    if 'max_books_teacher' in data:            settings.max_books_teacher            = int(data['max_books_teacher'])
    if 'issue_duration_days' in data:          settings.issue_duration_days          = int(data['issue_duration_days'])
    if 'fine_per_day' in data:                 settings.fine_per_day                 = float(data['fine_per_day'])
    if 'max_fine_cap' in data:                 settings.max_fine_cap                 = float(data['max_fine_cap'])
    if 'lost_book_fine_multiplier' in data:    settings.lost_book_fine_multiplier    = float(data['lost_book_fine_multiplier'])
    if 'damaged_book_fine_multiplier' in data: settings.damaged_book_fine_multiplier = float(data['damaged_book_fine_multiplier'])
    if 'lost_card_fine' in data:               settings.lost_card_fine               = float(data['lost_card_fine'])
    if 'missing_pages_fine' in data:           settings.missing_pages_fine           = float(data['missing_pages_fine'])
    if 'max_renewals' in data:                 settings.max_renewals                 = int(data['max_renewals'])
    if 'reservation_limit_per_member' in data: settings.reservation_limit_per_member = int(data['reservation_limit_per_member'])

    db.session.commit()
    log_activity(sid, get_current_user().id, 'SETTINGS_UPDATED', 'Library policy settings updated')
    db.session.commit()
    return jsonify(settings.to_dict()), 200


@library_bp.route('/fine-types', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def get_fine_types():
    """Returns configurable fine/penalty types with current default rates."""
    sid = _school_id()
    s = _get_or_create_settings(sid)
    types = [
        {'code': 'OVERDUE',       'label': 'Late Return Overdue Fine',  'type': 'PER_DAY', 'rate': s.fine_per_day, 'max_cap': s.max_fine_cap},
        {'code': 'LOST',          'label': 'Lost Book Penalty',         'type': 'MULTIPLIER', 'rate': s.lost_book_fine_multiplier, 'description': f'{s.lost_book_fine_multiplier}x Book MRP'},
        {'code': 'DAMAGED',       'label': 'Damaged Book Penalty',      'type': 'MULTIPLIER', 'rate': s.damaged_book_fine_multiplier, 'description': f'{s.damaged_book_fine_multiplier}x Book MRP'},
        {'code': 'LOST_CARD',     'label': 'Lost Library Card Re-issue','type': 'FIXED', 'rate': s.lost_card_fine},
        {'code': 'MISSING_PAGES', 'label': 'Missing / Torn Pages Fine', 'type': 'FIXED', 'rate': s.missing_pages_fine},
        {'code': 'MANUAL',        'label': 'Other Library Fine',        'type': 'CUSTOM', 'rate': 0.0},
    ]
    return jsonify(types), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Reports
# ═══════════════════════════════════════════════════════════════════════════

@library_bp.route('/reports/inventory', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_inventory():
    sid = _school_id()
    books = Book.query.filter_by(school_id=sid, is_active=True).all()
    return jsonify([b.to_dict(include_counts=True) for b in books]), 200


@library_bp.route('/reports/currently-issued', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_currently_issued():
    sid = _school_id()
    settings = _get_or_create_settings(sid)
    issues = BookIssue.query.filter_by(school_id=sid, status='ISSUED').order_by(BookIssue.due_date.asc()).all()
    return jsonify([_enrich_issue_dict(i, settings) for i in issues]), 200


@library_bp.route('/reports/overdue', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_overdue():
    sid = _school_id()
    settings = _get_or_create_settings(sid)
    issues = BookIssue.query.filter(
        BookIssue.school_id == sid, BookIssue.status == 'ISSUED',
        BookIssue.due_date < date.today()
    ).order_by(BookIssue.due_date.asc()).all()
    return jsonify([_enrich_issue_dict(i, settings) for i in issues]), 200


@library_bp.route('/reports/lost-damaged', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_lost_damaged():
    sid = _school_id()
    copies = BookCopy.query.filter(
        BookCopy.school_id == sid,
        BookCopy.status.in_(['LOST', 'DAMAGED'])
    ).all()
    return jsonify([c.to_dict() for c in copies]), 200


@library_bp.route('/reports/fine-collection', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_fine_collection():
    sid       = _school_id()
    from_date = request.args.get('from_date')
    to_date   = request.args.get('to_date')

    q = FineTransaction.query.filter(FineTransaction.school_id == sid, FineTransaction.amount_paid > 0)
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


@library_bp.route('/reports/outstanding-fines', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_outstanding_fines():
    sid = _school_id()
    fines = FineTransaction.query.filter(
        FineTransaction.school_id == sid,
        FineTransaction.status.in_(['OUTSTANDING', 'PARTIALLY_PAID', 'PENDING', 'PARTIAL'])
    ).order_by(FineTransaction.created_at.desc()).all()
    outstanding_fines = [f for f in fines if f.outstanding_amount > 0]
    total = sum(f.outstanding_amount for f in outstanding_fines)
    return jsonify({
        'total_outstanding': round(total, 2),
        'count':             len(outstanding_fines),
        'data':              [f.to_dict() for f in outstanding_fines],
    }), 200


@library_bp.route('/reports/waived-fines', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def report_waived_fines():
    sid = _school_id()
    fines = FineTransaction.query.filter(
        FineTransaction.school_id == sid,
        FineTransaction.waived_amount > 0
    ).order_by(FineTransaction.waived_at.desc()).all()
    total = sum(f.waived_amount for f in fines)
    return jsonify({
        'total_waived': round(total, 2),
        'count':        len(fines),
        'data':         [f.to_dict() for f in fines],
    }), 200


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


@library_bp.route('/reports/activity-log', methods=['GET'])
@role_required(*LIBRARY_ADMIN_ROLES)
def report_activity_log():
    sid   = _school_id()
    limit = request.args.get('limit', 100, type=int)
    logs  = LibraryActivityLog.query.filter_by(school_id=sid)\
                .order_by(LibraryActivityLog.created_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs]), 200


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

    copy_match = BookCopy.query.filter_by(barcode=q, school_id=sid).first()

    members = LibraryMember.query.filter_by(school_id=sid).join(
        User, LibraryMember.user_id == User.id
    ).filter(
        db.or_(User.name.ilike(like), LibraryMember.card_number.ilike(like))
    ).limit(10).all()

    return jsonify({
        'books':       [b.to_dict() for b in books],
        'members':     [m.to_dict() for m in members],
        'barcode_hit': copy_match.to_dict() if copy_match else None,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  LIBRARY ATTENDANCE & IN/OUT VISIT MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_student(school_id, identifier):
    """Finds a student by student_id, admission_no, or library card_number."""
    if not identifier:
        return None

    # Try by numeric ID
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        st = Student.query.filter_by(school_id=school_id, id=int(identifier)).first()
        if st:
            return st

    clean_id = str(identifier).strip()

    # Try admission_no
    st = Student.query.filter_by(school_id=school_id, admission_no=clean_id).first()
    if st:
        return st

    # Try library card number
    mem = LibraryMember.query.filter_by(school_id=school_id, card_number=clean_id).first()
    if mem:
        st = Student.query.filter_by(school_id=school_id, user_id=mem.user_id).first()
        if st:
            return st

    # Case-insensitive admission_no or roll_number match
    st = Student.query.filter(
        Student.school_id == school_id,
        db.or_(Student.admission_no.ilike(clean_id), Student.roll_number.ilike(clean_id))
    ).first()
    return st


@library_bp.route('/attendance/check-in', methods=['POST'])
@role_required(*LIBRARY_ROLES)
def library_check_in():
    """
    Records a student's entry into the library.
    Body: { identifier (student_id / admission_no / card_number), entry_method, remarks }
    """
    sid = _school_id()
    data = request.get_json() or {}
    identifier = data.get('identifier') or data.get('student_id')
    if not identifier:
        return jsonify({'error': 'Student identifier is required (Student ID, Admission No, or Card No)'}), 400

    student = _resolve_student(sid, identifier)
    if not student:
        return jsonify({'error': f'Student "{identifier}" not found.'}), 404

    # Check if student is already inside
    active_visit = LibraryVisit.query.filter_by(
        school_id=sid, student_id=student.id, status='INSIDE'
    ).first()
    if active_visit:
        return jsonify({
            'error': f'{student.user.name if student.user else "Student"} is already inside the library (Checked in at {active_visit.entry_time.strftime("%I:%M %p")}).',
            'visit': active_visit.to_dict()
        }), 409

    entry_method = data.get('entry_method', 'MANUAL').upper()
    visit = LibraryVisit(
        school_id=sid,
        student_id=student.id,
        visit_date=date.today(),
        entry_time=datetime.utcnow(),
        entry_method=entry_method,
        recorded_by=get_current_user().id,
        status='INSIDE',
        remarks=data.get('remarks', '')
    )
    db.session.add(visit)
    log_activity(sid, get_current_user().id, 'LIBRARY_CHECKIN', f'Student #{student.id} checked in ({entry_method})')
    db.session.commit()

    return jsonify({
        'message': f'Welcome, {student.user.name if student.user else "Student"}! Checked in successfully.',
        'visit': visit.to_dict()
    }), 201


@library_bp.route('/attendance/check-out', methods=['POST'])
@role_required(*LIBRARY_ROLES)
def library_check_out():
    """
    Records a student's exit from the library and computes visit duration.
    Body: { visit_id or identifier (student_id / admission_no / card_number), remarks }
    """
    sid = _school_id()
    data = request.get_json() or {}
    visit_id = data.get('visit_id')

    visit = None
    if visit_id:
        visit = LibraryVisit.query.filter_by(id=visit_id, school_id=sid).first()
    else:
        identifier = data.get('identifier') or data.get('student_id')
        if not identifier:
            return jsonify({'error': 'visit_id or student identifier is required'}), 400
        student = _resolve_student(sid, identifier)
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        visit = LibraryVisit.query.filter_by(
            school_id=sid, student_id=student.id, status='INSIDE'
        ).order_by(LibraryVisit.id.desc()).first()

    if not visit:
        return jsonify({'error': 'No active library check-in session found for this student.'}), 404

    if visit.status == 'EXITED':
        return jsonify({'message': 'Student has already checked out.', 'visit': visit.to_dict()}), 200

    visit.checkout()
    if data.get('remarks'):
        visit.remarks = (visit.remarks or '') + f" | {data.get('remarks')}".strip(' |')

    log_activity(sid, get_current_user().id, 'LIBRARY_CHECKOUT', f'Student #{visit.student_id} checked out (Duration: {visit.duration_minutes}m)')
    db.session.commit()

    return jsonify({
        'message': f'Checkout recorded! Duration: {visit.duration_minutes} minutes.',
        'visit': visit.to_dict()
    }), 200


@library_bp.route('/attendance/scan', methods=['POST'])
@role_required(*LIBRARY_ROLES)
def library_scan():
    """
    Smart Scanner: auto-detects check-in vs check-out upon barcode / QR / RFID scan.
    If student is already INSIDE -> check them out.
    If student is OUTSIDE -> check them in.
    """
    sid = _school_id()
    data = request.get_json() or {}
    barcode = (data.get('barcode') or data.get('identifier') or '').strip()
    if not barcode:
        return jsonify({'error': 'Barcode or identifier string is required'}), 400

    student = _resolve_student(sid, barcode)
    if not student:
        return jsonify({'error': f'No student found matching barcode "{barcode}".'}), 404

    active_visit = LibraryVisit.query.filter_by(
        school_id=sid, student_id=student.id, status='INSIDE'
    ).first()

    method = data.get('entry_method', 'BARCODE').upper()
    if active_visit:
        active_visit.checkout()
        db.session.commit()
        return jsonify({
            'action': 'CHECK_OUT',
            'message': f'Checked OUT: {student.user.name if student.user else "Student"}. Duration: {active_visit.duration_minutes} mins.',
            'visit': active_visit.to_dict()
        }), 200
    else:
        new_visit = LibraryVisit(
            school_id=sid,
            student_id=student.id,
            visit_date=date.today(),
            entry_time=datetime.utcnow(),
            entry_method=method,
            recorded_by=get_current_user().id,
            status='INSIDE',
        )
        db.session.add(new_visit)
        db.session.commit()
        return jsonify({
            'action': 'CHECK_IN',
            'message': f'Checked IN: {student.user.name if student.user else "Student"} at {new_visit.entry_time.strftime("%I:%M %p")}.',
            'visit': new_visit.to_dict()
        }), 201


@library_bp.route('/attendance/live', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def library_attendance_live():
    """
    Returns live counters: Currently Inside, Total Today Entries, Today Exits, and active visitors list.
    """
    sid = _school_id()
    today = date.today()

    active_visits = LibraryVisit.query.filter_by(school_id=sid, status='INSIDE')\
        .order_by(LibraryVisit.entry_time.asc()).all()

    today_entries = LibraryVisit.query.filter_by(school_id=sid, visit_date=today).count()
    today_exits = LibraryVisit.query.filter(
        LibraryVisit.school_id == sid,
        LibraryVisit.visit_date == today,
        LibraryVisit.status == 'EXITED'
    ).count()

    return jsonify({
        'currently_inside_count': len(active_visits),
        'today_entries_count':    today_entries,
        'today_exits_count':      today_exits,
        'currently_inside':       [v.to_dict() for v in active_visits],
    }), 200


@library_bp.route('/attendance/logs', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def library_attendance_logs():
    """
    Filterable attendance logs with search, class, date, and status filters.
    """
    sid = _school_id()
    q = LibraryVisit.query.filter_by(school_id=sid)

    date_param = request.args.get('date')
    if date_param:
        try:
            q = q.filter_by(visit_date=date.fromisoformat(date_param))
        except ValueError:
            pass

    status_param = request.args.get('status')
    if status_param and status_param != 'ALL':
        q = q.filter_by(status=status_param.upper())

    student_id = request.args.get('student_id', type=int)
    if student_id:
        q = q.filter_by(student_id=student_id)

    class_id = request.args.get('class_id', type=int)
    if class_id:
        q = q.join(Student, LibraryVisit.student_id == Student.id).filter(Student.class_id == class_id)

    search = (request.args.get('search') or '').strip().lower()
    visits = q.order_by(LibraryVisit.entry_time.desc()).limit(150).all()

    results = []
    for v in visits:
        d = v.to_dict()
        if search:
            st_name = (d.get('student_name') or '').lower()
            adm_no  = (d.get('admission_no') or '').lower()
            if search not in st_name and search not in adm_no:
                continue
        results.append(d)

    return jsonify(results), 200


@library_bp.route('/attendance/reports', methods=['GET'])
@role_required(*LIBRARY_ROLES)
def library_attendance_reports():
    """
    Daily, weekly, and monthly aggregate reports for library visits and average study duration.
    """
    sid = _school_id()
    today = date.today()

    all_today = LibraryVisit.query.filter_by(school_id=sid, visit_date=today).all()
    durations = [v.duration_minutes for v in all_today if v.duration_minutes]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    # Hourly distribution for today
    hourly = {f"{h:02d}:00": 0 for h in range(8, 19)}
    for v in all_today:
        if v.entry_time:
            hr_key = f"{v.entry_time.hour:02d}:00"
            if hr_key in hourly:
                hourly[hr_key] += 1

    return jsonify({
        'date':                  str(today),
        'total_visits_today':    len(all_today),
        'average_duration_mins': avg_duration,
        'hourly_footfall':       [{'hour': k, 'visits': v} for k, v in hourly.items()],
    }), 200

