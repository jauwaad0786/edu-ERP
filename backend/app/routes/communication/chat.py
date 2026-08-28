# backend/app/routes/communication/chat.py
"""
Chat and Direct Messaging APIs with tenant isolation and message encryption at rest.

Security:
- Strict school_id tenant isolation for all school users.
- Message encryption using Fernet symmetric key before database storage.
- Safe backward compatibility for existing unencrypted messages.
- File upload validation against executable scripts, path traversal, and size limits.
"""

from datetime import datetime
from flask import Blueprint, request, jsonify
import cloudinary.uploader

from app import db
from app.models.user import User, UserRole
from app.models.communication import ChatMessage
from app.services.notification_service import send_notification
from app.utils.decorators import role_required, get_current_user
from app.utils.crypto import encrypt_value, decrypt_value
from app.utils.file_security import validate_uploaded_file

chat_bp = Blueprint('chat', __name__)


# ─── Tenant & Encryption Helpers ──────────────────────────────────────────────

def _can_communicate(user_a, user_b):
    """
    Validates whether two users can exchange messages.
    - SUPER_ADMIN (company-side / support) can communicate across schools.
    - All school-side users (Principal, Teacher, Student, Parent, Staff) can ONLY
      communicate with users belonging to the exact same school.
    """
    if not user_a or not user_b:
        return False
    if user_a.id == user_b.id:
        return False  # Cannot message self

    # SUPER_ADMIN / company-side support bypass
    if user_a.role == UserRole.SUPER_ADMIN or user_b.role == UserRole.SUPER_ADMIN:
        return True

    # Both must belong to a school and have matching school_id
    if user_a.school_id is None or user_b.school_id is None:
        return False

    return user_a.school_id == user_b.school_id


def _safe_encrypt_text(plain_text):
    """Encrypts message text. Falls back to original text if encryption is unavailable."""
    if not plain_text:
        return ''
    try:
        encrypted = encrypt_value(plain_text)
        return encrypted if encrypted else plain_text
    except Exception:
        return plain_text


def _safe_decrypt_text(stored_text):
    """Decrypts message text safely with backward compatibility for plaintext records."""
    if not stored_text:
        return ''
    try:
        decrypted = decrypt_value(stored_text)
        return decrypted if decrypted is not None else stored_text
    except Exception:
        return stored_text


# ─── 1. Send Message ──────────────────────────────────────────────────────────

@chat_bp.route('', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def send_message():
    """
    POST /api/support/chat
    Body: { receiver_id, message, message_type (optional) }
    message_type: TEXT (default) | IMAGE | PDF | DOCUMENT
    """
    user = get_current_user()
    data = request.get_json() or {}

    receiver_id = data.get('receiver_id')
    raw_message = (data.get('message') or '').strip()

    if not receiver_id:
        return jsonify({'error': 'receiver_id is required'}), 400
    if not raw_message:
        return jsonify({'error': 'message is required'}), 400

    receiver = User.query.get_or_404(receiver_id)

    if not receiver.is_active:
        return jsonify({'error': 'Receiver account is inactive'}), 400

    # Multi-tenant cross-school isolation check
    if not _can_communicate(user, receiver):
        return jsonify({'error': 'Cross-school communication is not permitted'}), 403

    # Encrypt at rest before storing
    encrypted_msg = _safe_encrypt_text(raw_message)

    # Tenant context: if user is SUPER_ADMIN messaging a school user, associate receiver's school
    msg_school_id = user.school_id or receiver.school_id

    msg = ChatMessage(
        school_id    = msg_school_id,
        sender_id    = user.id,
        receiver_id  = receiver_id,
        message      = encrypted_msg,
        message_type = (data.get('message_type') or 'TEXT').upper(),
        is_read      = False,
    )
    db.session.add(msg)
    db.session.flush()

    # Receiver bell notification (never log or notify full raw secret, send short snippet)
    snippet = raw_message[:100] + ('...' if len(raw_message) > 100 else '')
    send_notification(
        user_id   = receiver_id,
        title     = f'Message from {user.name}',
        message   = snippet,
        school_id = msg_school_id,
        notif_type= 'CHAT',
    )

    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ─── 2. Get Conversation (between two users) ──────────────────────────────────

@chat_bp.route('/conversation/<int:other_user_id>', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def get_conversation(other_user_id):
    """
    GET /api/support/chat/conversation/<other_user_id>
    Fetches messages between current user and other_user_id.
    Enforces same-school access for school users.
    Query params: page, per_page
    """
    user = get_current_user()
    other_user = User.query.get_or_404(other_user_id)

    # Multi-tenant check
    if not _can_communicate(user, other_user):
        return jsonify({'error': 'Unauthorized to view this conversation'}), 403

    q = ChatMessage.query.filter(
        db.or_(
            db.and_(
                ChatMessage.sender_id   == user.id,
                ChatMessage.receiver_id == other_user_id,
            ),
            db.and_(
                ChatMessage.sender_id   == other_user_id,
                ChatMessage.receiver_id == user.id,
            ),
        )
    )

    # If both belong to the same school, enforce school_id filter
    if user.school_id and other_user.school_id and user.school_id == other_user.school_id:
        q = q.filter(ChatMessage.school_id == user.school_id)

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)

    paginated = q.order_by(
        ChatMessage.created_at.asc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    # Auto mark incoming messages as read
    unread_ids = [
        m.id for m in paginated.items
        if m.receiver_id == user.id and not m.is_read
    ]
    if unread_ids:
        now = datetime.utcnow()
        ChatMessage.query.filter(
            ChatMessage.id.in_(unread_ids)
        ).update({'is_read': True, 'read_at': now}, synchronize_session=False)
        db.session.commit()

    return jsonify({
        'data':     [m.to_dict() for m in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 3. My Conversations List (inbox) ────────────────────────────────────────

@chat_bp.route('/inbox', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def inbox():
    """
    GET /api/support/chat/inbox
    Returns recent conversations for the logged in user with decrypted snippets.
    """
    user = get_current_user()
    from sqlalchemy import func, case as sa_case

    # Subquery: latest message id per conversation
    latest_subq = db.session.query(
        func.max(ChatMessage.id).label('max_id')
    ).filter(
        db.or_(
            ChatMessage.sender_id   == user.id,
            ChatMessage.receiver_id == user.id,
        )
    )

    if user.role != UserRole.SUPER_ADMIN and user.school_id:
        latest_subq = latest_subq.filter(ChatMessage.school_id == user.school_id)

    latest_subq = latest_subq.group_by(
        sa_case(
            (ChatMessage.sender_id == user.id, ChatMessage.receiver_id),
            else_=ChatMessage.sender_id
        )
    ).subquery()

    latest_msgs = ChatMessage.query.filter(
        ChatMessage.id.in_(db.select(latest_subq.c.max_id))
    ).order_by(ChatMessage.created_at.desc()).all()

    result = []
    for msg in latest_msgs:
        other_id   = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
        other_user = User.query.get(other_id)
        if not other_user or not other_user.is_active:
            continue

        # For non-admin, skip if other user is in a different school
        if user.role != UserRole.SUPER_ADMIN and other_user.role != UserRole.SUPER_ADMIN:
            if user.school_id != other_user.school_id:
                continue

        # Unread count
        unread = ChatMessage.query.filter_by(
            sender_id   = other_id,
            receiver_id = user.id,
            is_read     = False,
        ).count()

        decrypted_last = _safe_decrypt_text(msg.message)

        result.append({
            'user_id':      other_id,
            'name':         other_user.name,
            'role':         other_user.role.value,
            'last_message': decrypted_last,
            'last_type':    msg.message_type,
            'last_time':    msg.created_at.isoformat() if msg.created_at else None,
            'unread_count': unread,
            'is_read':      msg.is_read,
        })

    return jsonify(result), 200


# ─── 4. Unread Message Count ──────────────────────────────────────────────────

@chat_bp.route('/unread-count', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def unread_count():
    """
    GET /api/support/chat/unread-count
    Total unread messages for navbar badge.
    """
    user  = get_current_user()
    count = ChatMessage.query.filter_by(
        receiver_id = user.id,
        is_read     = False,
    ).count()

    return jsonify({
        'unread': count,
        'badge':  '99+' if count > 99 else str(count),
    }), 200


# ─── 5. Mark Conversation Read ────────────────────────────────────────────────

@chat_bp.route('/conversation/<int:other_user_id>/read', methods=['PATCH'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def mark_conversation_read(other_user_id):
    """
    PATCH /api/support/chat/conversation/<other_user_id>/read
    Marks all unread messages from other_user_id as read.
    """
    user = get_current_user()
    now  = datetime.utcnow()

    ChatMessage.query.filter_by(
        sender_id   = other_user_id,
        receiver_id = user.id,
        is_read     = False,
    ).update({'is_read': True, 'read_at': now}, synchronize_session=False)

    db.session.commit()
    return jsonify({'message': 'Conversation marked as read'}), 200


# ─── 6. Send File / Image ─────────────────────────────────────────────────────

@chat_bp.route('/send-file', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def send_file():
    """
    POST /api/support/chat/send-file
    multipart/form-data fields: receiver_id, file, caption (optional)
    """
    user        = get_current_user()
    receiver_id = request.form.get('receiver_id', type=int)
    caption     = (request.form.get('caption') or '').strip()
    file        = request.files.get('file')

    if not receiver_id:
        return jsonify({'error': 'receiver_id is required'}), 400
    if not file:
        return jsonify({'error': 'file is required'}), 400

    receiver = User.query.get_or_404(receiver_id)

    # Multi-tenant cross-school check
    if not _can_communicate(user, receiver):
        return jsonify({'error': 'Cross-school file sharing is not permitted'}), 403

    # File validation & security checks
    is_valid, err_msg, safe_name, file_category = validate_uploaded_file(file)
    if not is_valid:
        return jsonify({'error': err_msg}), 400

    # Cloudinary upload
    try:
        result = cloudinary.uploader.upload(
            file,
            folder        = f'eduerp/chat/user_{user.id}',
            resource_type = 'auto',
            overwrite     = False,
        )
    except Exception as e:
        return jsonify({'error': f'File upload failed: {str(e)}'}), 500

    msg_school_id = user.school_id or receiver.school_id
    raw_caption = caption or safe_name or 'File shared'
    encrypted_caption = _safe_encrypt_text(raw_caption)

    msg = ChatMessage(
        school_id    = msg_school_id,
        sender_id    = user.id,
        receiver_id  = receiver_id,
        message      = encrypted_caption,
        message_type = file_category,
        file_url     = result['secure_url'],
        file_name    = safe_name,
        is_read      = False,
    )
    db.session.add(msg)
    db.session.flush()

    send_notification(
        user_id   = receiver_id,
        title     = f'{user.name} sent a {file_category.lower()}',
        message   = raw_caption[:100],
        school_id = msg_school_id,
        notif_type= 'CHAT',
    )

    db.session.commit()
    return jsonify(msg.to_dict()), 201


# ─── 7. Delete Message (sender only) ─────────────────────────────────────────

@chat_bp.route('/<int:msg_id>', methods=['DELETE'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def delete_message(msg_id):
    """
    DELETE /api/support/chat/<msg_id>
    Allows sender (or SUPER_ADMIN) to delete their message.
    """
    user = get_current_user()
    msg  = ChatMessage.query.get_or_404(msg_id)

    if msg.sender_id != user.id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Unauthorized to delete this message'}), 403

    db.session.delete(msg)
    db.session.commit()
    return jsonify({'message': 'Message deleted'}), 200


# ─── 8. Search Users to Chat With ────────────────────────────────────────────

@chat_bp.route('/users', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def searchable_users():
    """
    GET /api/support/chat/users?search=name
    Returns users available for messaging within the same tenant context.
    """
    user      = get_current_user()
    school_id = user.school_id
    search    = (request.args.get('search') or '').strip()

    if user.role == UserRole.SUPER_ADMIN and not school_id:
        # SUPER_ADMIN without school can search all company users or users across schools
        q = User.query.filter(User.is_active == True, User.id != user.id)
    else:
        # School users can ONLY search active users within their own school
        if not school_id:
            return jsonify([]), 200
        q = User.query.filter(
            User.school_id == school_id,
            User.is_active == True,
            User.id        != user.id,
        )

    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                User.name.ilike(like),
                User.email.ilike(like),
            )
        )

    users = q.order_by(User.name.asc()).limit(25).all()

    return jsonify([
        {
            'id':   u.id,
            'name': u.name,
            'role': u.role.value,
        }
        for u in users
    ]), 200
