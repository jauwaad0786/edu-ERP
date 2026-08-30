from flask import Blueprint, request, jsonify
from app import db
from app.models.communication import SupportNotification
from app.utils.decorators import role_required, get_current_user
from datetime import datetime

notifications_bp = Blueprint('notifications', __name__)

ALL_COMMUNICATION_ROLES = (
    'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
    'TEACHER', 'STUDENT', 'PARENT',
    'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
    'HOSTEL', 'TRANSPORT', 'HR', 'DRIVER'
)


# ─── 1. My Notifications ──────────────────────────────────────────────────────

@notifications_bp.route('', methods=['GET'])
@role_required(*ALL_COMMUNICATION_ROLES)
def my_notifications():
    """
    GET /api/support/notifications
    Logged-in user ki apni notifications.
    Query params: is_read (true/false), type, page, per_page
    """
    user = get_current_user()
    q    = SupportNotification.query.filter_by(user_id=user.id)

    # Filter by read status
    is_read = request.args.get('is_read')
    if is_read == 'false':
        q = q.filter_by(is_read=False)
    elif is_read == 'true':
        q = q.filter_by(is_read=True)

    # Filter by type
    notif_type = request.args.get('type')
    if notif_type:
        q = q.filter_by(notif_type=notif_type.upper())

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(
        SupportNotification.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':     [n.to_dict() for n in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 2. Unread Count (navbar bell badge ke liye) ──────────────────────────────

@notifications_bp.route('/unread-count', methods=['GET'])
@role_required(*ALL_COMMUNICATION_ROLES)
def unread_count():
    """
    GET /api/support/notifications/unread-count
    Navbar bell badge ke liye — sirf count return karta hai.
    Frontend polling kar sakta hai har 30 seconds.
    """
    user  = get_current_user()
    count = SupportNotification.query.filter_by(
        user_id=user.id,
        is_read=False
    ).count()

    return jsonify({
        'unread': count,
        'badge':  '99+' if count > 99 else str(count),
        # badge directly navbar pe show karo
    }), 200


# ─── 3. Mark Single Notification Read ────────────────────────────────────────

@notifications_bp.route('/<int:notif_id>/read', methods=['PATCH'])
@role_required(*ALL_COMMUNICATION_ROLES)
def mark_read(notif_id):
    """
    PATCH /api/support/notifications/<id>/read
    Single notification read mark karo.
    """
    user  = get_current_user()
    notif = SupportNotification.query.get_or_404(notif_id)

    if notif.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': 'Marked as read', 'id': notif_id}), 200


# ─── 4. Mark All Read ─────────────────────────────────────────────────────────

@notifications_bp.route('/mark-all-read', methods=['PATCH'])
@role_required(*ALL_COMMUNICATION_ROLES)
def mark_all_read():
    """
    PATCH /api/support/notifications/mark-all-read
    Sab unread notifications ek saath read mark karo.
    Bell panel mein 'Mark all read' button ke liye.
    """
    user = get_current_user()
    now  = datetime.utcnow()

    SupportNotification.query.filter_by(
        user_id=user.id,
        is_read=False
    ).update({'is_read': True, 'read_at': now})

    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'}), 200


# ─── 5. Delete Single Notification ───────────────────────────────────────────

@notifications_bp.route('/<int:notif_id>', methods=['DELETE'])
@role_required(*ALL_COMMUNICATION_ROLES)
def delete_notification(notif_id):
    """
    DELETE /api/support/notifications/<id>
    Single notification delete karo.
    """
    user  = get_current_user()
    notif = SupportNotification.query.get_or_404(notif_id)

    if notif.user_id != user.id:
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(notif)
    db.session.commit()
    return jsonify({'message': 'Notification deleted'}), 200


# ─── 6. Clear All Notifications ───────────────────────────────────────────────

@notifications_bp.route('/clear-all', methods=['DELETE'])
@role_required(*ALL_COMMUNICATION_ROLES)
def clear_all():
    """
    DELETE /api/support/notifications/clear-all
    Apni sab notifications delete karo.
    """
    user = get_current_user()
    SupportNotification.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({'message': 'All notifications cleared'}), 200
