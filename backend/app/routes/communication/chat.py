from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, UserRole
from app.models.communication import ChatMessage, SupportNotification
from app.utils.decorators import role_required, get_current_user
from datetime import datetime
import cloudinary.uploader

chat_bp = Blueprint('chat', __name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _notify(user_id, title, message, school_id=None):
    db.session.add(SupportNotification(
        user_id    = user_id,
        school_id  = school_id,
        title      = title,
        message    = message,
        notif_type = 'CHAT',
    ))


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
    message     = (data.get('message') or '').strip()

    if not receiver_id:
        return jsonify({'error': 'receiver_id is required'}), 400
    if not message:
        return jsonify({'error': 'message is required'}), 400

    receiver = User.query.get_or_404(receiver_id)

    # Apne aap ko message nahi kar sakte
    if receiver_id == user.id:
        return jsonify({'error': 'Apne aap ko message nahi kar sakte'}), 400

    msg = ChatMessage(
        school_id    = user.school_id,
        sender_id    = user.id,
        receiver_id  = receiver_id,
        message      = message,
        message_type = (data.get('message_type') or 'TEXT').upper(),
        is_read      = False,
    )
    db.session.add(msg)
    db.session.flush()

    # Receiver ko bell notification
    _notify(
        user_id   = receiver_id,
        title     = f'Message from {user.name}',
        message   = message[:100] + ('...' if len(message) > 100 else ''),
        school_id = user.school_id,
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
    Do users ke beech ke sab messages — oldest first.
    Query params: page, per_page
    """
    user = get_current_user()

    # Dono directions ke messages
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

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)

    paginated = q.order_by(
        ChatMessage.created_at.asc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    # Auto mark as read — jo messages user ko aaye hain
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
    Sab conversations list — latest message pehle.
    WhatsApp style chat list.
    """
    user = get_current_user()

    # All unique users jisse maine ya jisne mujhse baat ki
    from sqlalchemy import func, case as sa_case

    # Subquery: har conversation ka latest message id
    latest_subq = db.session.query(
        func.max(ChatMessage.id).label('max_id')
    ).filter(
        db.or_(
            ChatMessage.sender_id   == user.id,
            ChatMessage.receiver_id == user.id,
        )
    ).group_by(
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
        # Other user kaun hai
        other_id   = msg.receiver_id if msg.sender_id == user.id else msg.sender_id
        other_user = User.query.get(other_id)
        if not other_user:
            continue

        # Unread count from this person
        unread = ChatMessage.query.filter_by(
            sender_id   = other_id,
            receiver_id = user.id,
            is_read     = False,
        ).count()

        result.append({
            'user_id':      other_id,
            'name':         other_user.name,
            'role':         other_user.role.value,
            'last_message': msg.message,
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
    Total unread messages — navbar message icon badge ke liye.
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
    Is user ke sab unread messages read mark karo.
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

    # Cloudinary upload
    result = cloudinary.uploader.upload(
        file,
        folder        = f'eduerp/chat/user_{user.id}',
        resource_type = 'auto',
        overwrite     = False,
    )

    # File type detect
    content_type = file.content_type or ''
    if 'image' in content_type:
        msg_type = 'IMAGE'
    elif 'pdf' in content_type:
        msg_type = 'PDF'
    elif 'word' in content_type or 'document' in content_type:
        msg_type = 'DOCUMENT'
    else:
        msg_type = 'DOCUMENT'

    msg = ChatMessage(
        school_id    = user.school_id,
        sender_id    = user.id,
        receiver_id  = receiver_id,
        message      = caption or file.filename or 'File shared',
        message_type = msg_type,
        file_url     = result['secure_url'],
        file_name    = file.filename or '',
        is_read      = False,
    )
    db.session.add(msg)
    db.session.flush()

    _notify(
        user_id   = receiver_id,
        title     = f'{user.name} ne ek {msg_type.lower()} bheja',
        message   = caption or file.filename or 'File shared',
        school_id = user.school_id,
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
    Sirf sender apna message delete kar sakta hai.
    """
    user = get_current_user()
    msg  = ChatMessage.query.get_or_404(msg_id)

    if msg.sender_id != user.id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Sirf apna message delete kar sakte ho'}), 403

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
    Apne school ke users search karo — new chat start karne ke liye.
    """
    user      = get_current_user()
    school_id = user.school_id
    search    = (request.args.get('search') or '').strip()

    q = User.query.filter(
        User.school_id == school_id,
        User.is_active == True,
        User.id        != user.id,   # apne aap ko nahi
    )

    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                User.name.ilike(like),
                User.email.ilike(like),
            )
        )

    users = q.order_by(User.name.asc()).limit(20).all()

    return jsonify([
        {
            'id':   u.id,
            'name': u.name,
            'role': u.role.value,
        }
        for u in users
    ]), 200
