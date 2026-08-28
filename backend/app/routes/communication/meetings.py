# backend/app/routes/communication/meetings.py
"""
Meeting Request APIs with tenant isolation, Principal school-level oversight, and status transitions.
"""

from datetime import datetime, date
from flask import Blueprint, request, jsonify

from app import db
from app.models.user import User, UserRole
from app.models.communication import MeetingRequest
from app.services.notification_service import send_notification
from app.utils.decorators import role_required, get_current_user

meetings_bp = Blueprint('meetings', __name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _get_school_name(school_id):
    if not school_id:
        return ''
    try:
        from app.models.school import School
        s = School.query.get(school_id)
        return s.name if s else ''
    except Exception:
        return ''


def _can_access_meeting(user, meeting):
    if not user or not meeting:
        return False
    if user.role == UserRole.SUPER_ADMIN:
        return True
    if user.school_id is None or meeting.school_id != user.school_id:
        return False
    if user.role in (UserRole.PRINCIPAL, UserRole.VICE_PRINCIPAL):
        return True
    return meeting.requested_by == user.id


# ─── 1. Request Meeting ───────────────────────────────────────────────────────

@meetings_bp.route('', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST',
               'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR')
def request_meeting():
    """
    POST /api/support/meetings
    Body: {
        topic, description,
        meeting_date (YYYY-MM-DD), meeting_time (HH:MM AM/PM),
        priority, preferred_mode, product_type
    }
    """
    user      = get_current_user()
    school_id = user.school_id
    data      = request.get_json() or {}

    topic        = (data.get('topic') or '').strip()
    meeting_date = (data.get('meeting_date') or '').strip()
    meeting_time = (data.get('meeting_time') or '').strip()

    if not topic:
        return jsonify({'error': 'topic is required'}), 400
    if not meeting_date:
        return jsonify({'error': 'meeting_date is required (YYYY-MM-DD)'}), 400
    if not meeting_time:
        return jsonify({'error': 'meeting_time is required'}), 400

    try:
        m_date = date.fromisoformat(meeting_date)
    except ValueError:
        return jsonify({'error': 'Invalid meeting_date format — YYYY-MM-DD required'}), 400

    if m_date < date.today():
        return jsonify({'error': 'Cannot book a meeting for a past date'}), 400

    school_name = _get_school_name(school_id)

    meeting = MeetingRequest(
        school_id      = school_id,
        school_name    = school_name,
        product_type   = data.get('product_type', 'EduERP'),
        requested_by   = user.id,
        requester_name = user.name,
        requester_role = user.role.value,
        topic          = topic,
        description    = data.get('description', ''),
        meeting_date   = m_date,
        meeting_time   = meeting_time,
        priority       = (data.get('priority') or 'MEDIUM').upper(),
        preferred_mode = (data.get('preferred_mode') or 'GOOGLE_MEET').upper(),
        status         = 'PENDING',
    )
    db.session.add(meeting)
    db.session.flush()

    # Notify SUPER_ADMINs
    admins = User.query.filter_by(role=UserRole.SUPER_ADMIN).all()
    for admin in admins:
        send_notification(
            user_id    = admin.id,
            title      = f'Meeting Request — {school_name or "Company"}',
            message    = (
                f'{user.name} ({user.role.value}) requested a meeting. '
                f'Topic: {topic} | Date: {meeting_date} {meeting_time} | '
                f'Mode: {meeting.preferred_mode}'
            ),
            school_id  = school_id,
            notif_type = 'MEETING',
        )

    # Confirm to requester
    send_notification(
        user_id    = user.id,
        title      = 'Meeting Request Submitted',
        message    = (
            f'Aapki meeting request submit ho gayi. '
            f'Topic: {topic} | Date: {meeting_date} {meeting_time}.'
        ),
        school_id  = school_id,
        notif_type = 'MEETING',
    )

    db.session.commit()
    return jsonify(meeting.to_dict()), 201


# ─── 2. List Meetings ─────────────────────────────────────────────────────────

@meetings_bp.route('', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST',
               'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR')
def list_meetings():
    """
    GET /api/support/meetings
    - SUPER_ADMIN: all schools (or filtered by school_id)
    - PRINCIPAL / VICE_PRINCIPAL: all meetings in their school
    - Others: only their own requested meetings
    """
    user = get_current_user()
    q    = MeetingRequest.query

    if user.role == UserRole.SUPER_ADMIN:
        if request.args.get('school_id'):
            q = q.filter_by(school_id=request.args.get('school_id', type=int))
        if request.args.get('product_type'):
            q = q.filter_by(product_type=request.args.get('product_type'))
    elif user.role in (UserRole.PRINCIPAL, UserRole.VICE_PRINCIPAL):
        q = q.filter_by(school_id=user.school_id)
    else:
        q = q.filter_by(requested_by=user.id, school_id=user.school_id)

    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status').upper())
    if request.args.get('priority'):
        q = q.filter_by(priority=request.args.get('priority').upper())

    date_from = request.args.get('date_from')
    date_to   = request.args.get('date_to')
    if date_from:
        try:
            q = q.filter(MeetingRequest.meeting_date >= date.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(MeetingRequest.meeting_date <= date.fromisoformat(date_to))
        except ValueError:
            pass

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(
        MeetingRequest.meeting_date.asc(),
        MeetingRequest.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':     [m.to_dict() for m in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 3. Meeting Detail ────────────────────────────────────────────────────────

@meetings_bp.route('/<int:meeting_id>', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST',
               'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR')
def meeting_detail(meeting_id):
    """
    GET /api/support/meetings/<id>
    Enforces tenant access: School A cannot view School B meetings.
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if not _can_access_meeting(user, meeting):
        return jsonify({'error': 'Unauthorized to view this meeting request'}), 403

    return jsonify(meeting.to_dict()), 200


# ─── 4. Accept Meeting (SUPER_ADMIN only) ────────────────────────────────────

@meetings_bp.route('/<int:meeting_id>/accept', methods=['POST'])
@role_required('SUPER_ADMIN')
def accept_meeting(meeting_id):
    """
    POST /api/support/meetings/<id>/accept
    Body: { meeting_link (optional), response_note (optional) }
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if meeting.status not in ('PENDING', 'RESCHEDULED'):
        return jsonify({
            'error': f'Cannot accept meeting with status {meeting.status}'
        }), 400

    data = request.get_json() or {}

    meeting.status        = 'ACCEPTED'
    meeting.meeting_link  = data.get('meeting_link', '')
    meeting.response_note = data.get('response_note', '')
    meeting.handled_by    = user.id
    meeting.updated_at    = datetime.utcnow()

    mode_labels = {
        'GOOGLE_MEET': 'Google Meet',
        'ZOOM':        'Zoom',
        'PHONE':       'Phone Call',
        'REMOTE':      'Remote Support',
        'ONSITE':      'On-site Visit',
    }
    mode_label = mode_labels.get(meeting.preferred_mode, meeting.preferred_mode)
    link_text  = f' Meeting link: {meeting.meeting_link}' if meeting.meeting_link else ''

    send_notification(
        user_id    = meeting.requested_by,
        title      = '✅ Meeting Confirmed!',
        message    = (
            f'Aapki meeting confirm ho gayi. '
            f'Date: {meeting.meeting_date} {meeting.meeting_time} | '
            f'Mode: {mode_label}.{link_text}'
        ),
        school_id  = meeting.school_id,
        notif_type = 'MEETING',
    )

    db.session.commit()
    return jsonify({
        'message': 'Meeting accepted',
        'meeting': meeting.to_dict(),
    }), 200


# ─── 5. Reject Meeting (SUPER_ADMIN only) ────────────────────────────────────

@meetings_bp.route('/<int:meeting_id>/reject', methods=['POST'])
@role_required('SUPER_ADMIN')
def reject_meeting(meeting_id):
    """
    POST /api/support/meetings/<id>/reject
    Body: { response_note }
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if meeting.status == 'COMPLETED':
        return jsonify({'error': 'Completed meeting cannot be rejected'}), 400

    data = request.get_json() or {}

    meeting.status        = 'REJECTED'
    meeting.response_note = data.get('response_note', '')
    meeting.handled_by    = user.id
    meeting.updated_at    = datetime.utcnow()

    send_notification(
        user_id    = meeting.requested_by,
        title      = 'Meeting Request Rejected',
        message    = f'Meeting reject ho gayi. Reason: {meeting.response_note or "Not specified"}',
        school_id  = meeting.school_id,
        notif_type = 'MEETING',
    )

    db.session.commit()
    return jsonify({
        'message': 'Meeting rejected',
        'meeting': meeting.to_dict(),
    }), 200


# ─── 6. Reschedule Meeting (SUPER_ADMIN only) ─────────────────────────────────

@meetings_bp.route('/<int:meeting_id>/reschedule', methods=['POST'])
@role_required('SUPER_ADMIN')
def reschedule_meeting(meeting_id):
    """
    POST /api/support/meetings/<id>/reschedule
    Body: { reschedule_date, reschedule_time, response_note }
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if meeting.status == 'COMPLETED':
        return jsonify({'error': 'Completed meeting cannot be rescheduled'}), 400

    data = request.get_json() or {}

    r_date = (data.get('reschedule_date') or '').strip()
    r_time = (data.get('reschedule_time') or '').strip()

    if not r_date or not r_time:
        return jsonify({'error': 'reschedule_date and reschedule_time are required'}), 400

    try:
        new_date = date.fromisoformat(r_date)
    except ValueError:
        return jsonify({'error': 'Invalid reschedule_date format — YYYY-MM-DD required'}), 400

    if new_date < date.today():
        return jsonify({'error': 'Cannot reschedule to a past date'}), 400

    meeting.status          = 'RESCHEDULED'
    meeting.reschedule_date = new_date
    meeting.reschedule_time = r_time
    meeting.response_note   = data.get('response_note', '')
    meeting.handled_by      = user.id
    meeting.updated_at      = datetime.utcnow()

    send_notification(
        user_id    = meeting.requested_by,
        title      = '📅 Meeting Rescheduled',
        message    = (
            f'Aapki meeting reschedule ho gayi. '
            f'Nayi date: {r_date} {r_time}. '
            f'Note: {meeting.response_note or ""}'
        ),
        school_id  = meeting.school_id,
        notif_type = 'MEETING',
    )

    db.session.commit()
    return jsonify({
        'message': 'Meeting rescheduled',
        'meeting': meeting.to_dict(),
    }), 200


# ─── 7. Mark Completed (SUPER_ADMIN only) ────────────────────────────────────

@meetings_bp.route('/<int:meeting_id>/complete', methods=['POST'])
@role_required('SUPER_ADMIN')
def complete_meeting(meeting_id):
    """
    POST /api/support/meetings/<id>/complete
    Body: { response_note }
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if meeting.status not in ('ACCEPTED', 'RESCHEDULED'):
        return jsonify({
            'error': f'Only accepted/rescheduled meetings can be completed — current: {meeting.status}'
        }), 400

    data = request.get_json() or {}

    meeting.status        = 'COMPLETED'
    meeting.response_note = data.get('response_note', '')
    meeting.handled_by    = user.id
    meeting.updated_at    = datetime.utcnow()

    send_notification(
        user_id    = meeting.requested_by,
        title      = '✅ Meeting Completed',
        message    = f'Meeting successfully completed. Summary: {meeting.response_note or "No summary provided."}',
        school_id  = meeting.school_id,
        notif_type = 'MEETING',
    )

    db.session.commit()
    return jsonify({
        'message': 'Meeting marked as completed',
        'meeting': meeting.to_dict(),
    }), 200


# ─── 8. Today's Meetings (SUPER_ADMIN dashboard) ─────────────────────────────

@meetings_bp.route('/today', methods=['GET'])
@role_required('SUPER_ADMIN')
def todays_meetings():
    """
    GET /api/support/meetings/today
    Developer dashboard — today's scheduled meetings.
    """
    today    = date.today()
    meetings = MeetingRequest.query.filter(
        MeetingRequest.meeting_date == today
    ).order_by(MeetingRequest.meeting_time.asc()).all()

    return jsonify({
        'date':     str(today),
        'total':    len(meetings),
        'meetings': [m.to_dict() for m in meetings],
    }), 200


# ─── 9. Cancel Meeting ────────────────────────────────────────────────────────

@meetings_bp.route('/<int:meeting_id>/cancel', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST',
               'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR')
def cancel_meeting(meeting_id):
    """
    POST /api/support/meetings/<id>/cancel
    Allows requester (or SUPER_ADMIN) to cancel a pending meeting.
    """
    user    = get_current_user()
    meeting = MeetingRequest.query.get_or_404(meeting_id)

    if user.role != UserRole.SUPER_ADMIN:
        if meeting.requested_by != user.id or (user.school_id and meeting.school_id != user.school_id):
            return jsonify({'error': 'Unauthorized to cancel this meeting'}), 403
        if meeting.status not in ('PENDING',):
            return jsonify({
                'error': 'Only PENDING meetings can be cancelled directly.'
            }), 400

    meeting.status        = 'REJECTED'
    meeting.response_note = 'Cancelled by requester'
    meeting.updated_at    = datetime.utcnow()

    # Notify SUPER_ADMINs
    admins = User.query.filter_by(role=UserRole.SUPER_ADMIN).all()
    for admin in admins:
        send_notification(
            user_id    = admin.id,
            title      = f'Meeting Cancelled — {meeting.school_name or "Company"}',
            message    = f'{meeting.requester_name} cancelled meeting. Topic: {meeting.topic}',
            school_id  = meeting.school_id,
            notif_type = 'MEETING',
        )

    db.session.commit()
    return jsonify({'message': 'Meeting cancelled', 'meeting': meeting.to_dict()}), 200
