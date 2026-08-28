# backend/app/routes/communication/tickets.py
"""
Support Ticket Management APIs with tenant isolation, Principal oversight, and attachment security.

Multi-Tenancy & Authorization Rules:
- SUPER_ADMIN / company-side support can view all tickets or filter by school.
- PRINCIPAL and VICE_PRINCIPAL can view and respond to all tickets within their own school.
- Other school roles (Teachers, Students, Parents, Staff) can view only tickets raised by themselves within their school.
- Cross-tenant ticket access between schools is strictly forbidden.
- File attachments are validated against executable types, size limits, and path traversal.
"""

from datetime import datetime, date
import random
import string
import cloudinary.uploader
from flask import Blueprint, request, jsonify

from app import db
from app.models.user import User, UserRole
from app.models.communication import (
    SupportTicket, TicketReply, SupportAttachment,
    SupportPlan, SupportUsage
)
from app.services.notification_service import send_notification
from app.utils.decorators import role_required, get_current_user
from app.utils.file_security import validate_uploaded_file

tickets_bp = Blueprint('tickets', __name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _gen_ticket_no():
    """Generates TKT-YYYYMMDD-XXXX unique ticket code."""
    today  = date.today().strftime('%Y%m%d')
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"TKT-{today}-{suffix}"


def _get_school_name(school_id):
    """Fetches school name for denormalized display."""
    if not school_id:
        return ''
    try:
        from app.models.school import School
        s = School.query.get(school_id)
        return s.name if s else ''
    except Exception:
        return ''


def _get_plan(school_id):
    """Retrieves current support plan (BASIC / PREMIUM) for school."""
    if not school_id:
        return 'BASIC'
    plan = SupportPlan.query.filter_by(school_id=school_id).first()
    if not plan or not plan.is_active:
        return 'BASIC'
    if plan.expires_at and plan.expires_at < datetime.utcnow():
        return 'BASIC'
    return plan.plan


def _check_weekly_limit(school_id):
    """
    Checks weekly ticket limit for school:
    BASIC plan: 1 ticket/week. PREMIUM: unlimited.
    """
    plan = _get_plan(school_id)
    if plan == 'PREMIUM':
        return True, 0, 999

    week_key = date.today().strftime('%Y-W%W')
    usage = SupportUsage.query.filter_by(
        school_id=school_id, week_key=week_key
    ).first()
    used = usage.ticket_count if usage else 0
    limit = 1

    return used < limit, used, limit


def _increment_usage(school_id):
    """Increments weekly ticket count for school."""
    week_key = date.today().strftime('%Y-W%W')
    usage = SupportUsage.query.filter_by(
        school_id=school_id, week_key=week_key
    ).first()
    if usage:
        usage.ticket_count += 1
    else:
        usage = SupportUsage(
            school_id=school_id,
            week_key=week_key,
            ticket_count=1
        )
        db.session.add(usage)


def _can_access_ticket(user, ticket):
    """
    Tenant & ownership authorization check:
    - SUPER_ADMIN: full access
    - PRINCIPAL / VICE_PRINCIPAL: access all tickets within own school
    - Others: access only own raised tickets within own school
    """
    if not user or not ticket:
        return False

    if user.role == UserRole.SUPER_ADMIN:
        return True

    # School must match
    if user.school_id is None or ticket.school_id != user.school_id:
        return False

    # Principal and VP have school-wide oversight
    if user.role in (UserRole.PRINCIPAL, UserRole.VICE_PRINCIPAL):
        return True

    # Other roles must be the raiser
    return ticket.raised_by == user.id


# ─── 1. Create Ticket ─────────────────────────────────────────────────────────

@tickets_bp.route('', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def create_ticket():
    """
    POST /api/support/tickets
    Creates a new support ticket with tenant context and plan limit enforcement.
    """
    user      = get_current_user()
    school_id = user.school_id

    # Weekly limit check for BASIC plan schools
    if school_id and user.role != UserRole.SUPER_ADMIN:
        allowed, used, limit = _check_weekly_limit(school_id)
        if not allowed:
            plan = _get_plan(school_id)
            return jsonify({
                'error':        'weekly_limit_reached',
                'plan':         plan,
                'used':         used,
                'limit':        limit,
                'message':      (
                    f'Aapne is hafte ka support limit ({limit} ticket) use kar liya hai. '
                    'Premium Support upgrade karo unlimited assistance ke liye.'
                ),
                'upgrade_cta':  True,
            }), 429

    data = request.get_json() or {}

    subject = (data.get('subject') or '').strip()
    if not subject:
        return jsonify({'error': 'subject is required'}), 400

    # Generate unique ticket number
    while True:
        tno = _gen_ticket_no()
        if not SupportTicket.query.filter_by(ticket_no=tno).first():
            break

    school_name = _get_school_name(school_id)

    # Optional linked error log (for developer triage)
    linked_error_id = data.get('linked_error_id')
    if linked_error_id:
        try:
            linked_error_id = int(linked_error_id)
        except (ValueError, TypeError):
            linked_error_id = None

    ticket = SupportTicket(
        ticket_no        = tno,
        product_type     = data.get('product_type', 'EduERP'),
        school_id        = school_id,
        school_name      = school_name,
        raised_by        = user.id,
        raiser_name      = user.name,
        raiser_role      = user.role.value,
        category         = data.get('category', 'GENERAL'),
        subject          = subject,
        description      = data.get('description', ''),
        module_name      = data.get('module_name', ''),
        send_to          = data.get('send_to', 'ERP_SUPPORT'),
        priority         = data.get('priority', 'MEDIUM'),
        status           = 'OPEN',
        linked_error_id  = linked_error_id,
    )
    db.session.add(ticket)
    db.session.flush()

    if school_id and user.role != UserRole.SUPER_ADMIN:
        _increment_usage(school_id)

    # Notify Super Admins / Support Engineers
    admins = User.query.filter_by(role=UserRole.SUPER_ADMIN).all()
    for admin in admins:
        send_notification(
            user_id    = admin.id,
            title      = f'New Ticket: {tno}',
            message    = f'{school_name or "Company"} — {subject} [{ticket.priority}]',
            ticket_id  = ticket.id,
            school_id  = school_id,
            notif_type = 'TICKET',
        )

    # Confirm to raiser
    send_notification(
        user_id    = user.id,
        title      = f'Ticket Raised: {tno}',
        message    = 'Aapka ticket successfully submit ho gaya. Hum jald respond karenge.',
        ticket_id  = ticket.id,
        school_id  = school_id,
        notif_type = 'TICKET',
    )

    db.session.commit()
    return jsonify(ticket.to_dict()), 201


# ─── 2. List Tickets ──────────────────────────────────────────────────────────

@tickets_bp.route('', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def list_tickets():
    """
    GET /api/support/tickets
    - SUPER_ADMIN: all schools (or filtered by ?school_id=...)
    - PRINCIPAL / VICE_PRINCIPAL: all tickets raised in their school
    - Others: only their own raised tickets
    Query params: status, priority, category, product_type, school_id, page, per_page, search
    """
    user = get_current_user()
    q    = SupportTicket.query

    # ── Tenant Scope ──────────────────────────────────────────────────────────
    if user.role == UserRole.SUPER_ADMIN:
        if request.args.get('school_id'):
            q = q.filter_by(school_id=request.args.get('school_id', type=int))
        if request.args.get('product_type'):
            q = q.filter_by(product_type=request.args.get('product_type'))
    elif user.role in (UserRole.PRINCIPAL, UserRole.VICE_PRINCIPAL):
        # Principal & VP have oversight of all tickets within their school
        q = q.filter_by(school_id=user.school_id)
    else:
        # Standard school users see only their own tickets
        q = q.filter_by(raised_by=user.id, school_id=user.school_id)

    # ── Filters ───────────────────────────────────────────────────────────────
    if request.args.get('status'):
        q = q.filter_by(status=request.args.get('status').upper())
    if request.args.get('priority'):
        q = q.filter_by(priority=request.args.get('priority').upper())
    if request.args.get('category'):
        q = q.filter_by(category=request.args.get('category').upper())

    # ── Search ────────────────────────────────────────────────────────────────
    search = (request.args.get('search') or '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                SupportTicket.subject.ilike(like),
                SupportTicket.ticket_no.ilike(like),
                SupportTicket.school_name.ilike(like),
                SupportTicket.raiser_name.ilike(like),
            )
        )

    # ── Pagination ────────────────────────────────────────────────────────────
    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(
        SupportTicket.created_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':     [t.to_dict() for t in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev,
    }), 200


# ─── 3. Ticket Detail ─────────────────────────────────────────────────────────

@tickets_bp.route('/<int:ticket_id>', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def ticket_detail(ticket_id):
    """
    GET /api/support/tickets/<id>
    Returns ticket details, replies, and attachments with strict tenant verification.
    """
    user   = get_current_user()
    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Multi-tenant access verification
    if not _can_access_ticket(user, ticket):
        return jsonify({'error': 'Unauthorized to view this ticket'}), 403

    # Replies query
    replies_q = TicketReply.query.filter_by(ticket_id=ticket_id)

    # Internal notes visible only to company support (SUPER_ADMIN)
    if user.role != UserRole.SUPER_ADMIN:
        replies_q = replies_q.filter_by(is_internal=False)

    replies = replies_q.order_by(TicketReply.created_at.asc()).all()

    replies_data = []
    for r in replies:
        d = r.to_dict()
        d['attachments'] = [
            a.to_dict() for a in
            SupportAttachment.query.filter_by(reply_id=r.id).all()
        ]
        replies_data.append(d)

    # Root ticket attachments
    attachments = SupportAttachment.query.filter_by(
        ticket_id=ticket_id, reply_id=None
    ).all()

    result = ticket.to_dict()
    result['replies']     = replies_data
    result['attachments'] = [a.to_dict() for a in attachments]

    return jsonify(result), 200


# ─── 4. Reply to Ticket ───────────────────────────────────────────────────────

@tickets_bp.route('/<int:ticket_id>/reply', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def reply_ticket(ticket_id):
    """
    POST /api/support/tickets/<id>/reply
    Body: { message, is_internal (admin only) }
    """
    user   = get_current_user()
    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Multi-tenant check
    if not _can_access_ticket(user, ticket):
        return jsonify({'error': 'Unauthorized to reply to this ticket'}), 403

    data    = request.get_json() or {}
    message = (data.get('message') or '').strip()
    if not message:
        return jsonify({'error': 'message is required'}), 400

    is_internal = bool(data.get('is_internal', False)) if user.role == UserRole.SUPER_ADMIN else False

    reply = TicketReply(
        ticket_id  = ticket_id,
        replied_by = user.id,
        reply_name = user.name,
        reply_role = user.role.value,
        message    = message,
        is_internal= is_internal,
    )
    db.session.add(reply)

    # Auto status update
    if user.role == UserRole.SUPER_ADMIN:
        if ticket.status == 'OPEN':
            ticket.status = 'IN_PROGRESS'
    else:
        if ticket.status in ('IN_PROGRESS', 'WAITING'):
            ticket.status = 'WAITING'

    ticket.updated_at = datetime.utcnow()
    db.session.flush()

    # Dispatch notifications
    if user.role == UserRole.SUPER_ADMIN:
        # Notify raiser
        send_notification(
            user_id    = ticket.raised_by,
            title      = f'Reply on Ticket {ticket.ticket_no}',
            message    = 'Support team ne aapke ticket pe reply kiya hai.',
            ticket_id  = ticket_id,
            school_id  = ticket.school_id,
            notif_type = 'TICKET',
        )
    else:
        # Notify Super Admins
        admins = User.query.filter_by(role=UserRole.SUPER_ADMIN).all()
        for admin in admins:
            send_notification(
                user_id    = admin.id,
                title      = f'User Reply: {ticket.ticket_no}',
                message    = f'{user.name} ({user.role.value}) ne reply kiya.',
                ticket_id  = ticket_id,
                school_id  = ticket.school_id,
                notif_type = 'TICKET',
            )

    db.session.commit()
    return jsonify(reply.to_dict()), 201


# ─── 5. Assign Ticket (SUPER_ADMIN only) ─────────────────────────────────────

@tickets_bp.route('/<int:ticket_id>/assign', methods=['POST'])
@role_required('SUPER_ADMIN')
def assign_ticket(ticket_id):
    """
    POST /api/support/tickets/<id>/assign
    Body: { engineer_id }
    """
    ticket = SupportTicket.query.get_or_404(ticket_id)
    data   = request.get_json() or {}

    engineer_id = data.get('engineer_id')
    if not engineer_id:
        return jsonify({'error': 'engineer_id required'}), 400

    engineer = User.query.get_or_404(engineer_id)

    ticket.assigned_to = engineer_id
    ticket.assigned_at = datetime.utcnow()
    ticket.status      = 'IN_PROGRESS'
    ticket.updated_at  = datetime.utcnow()

    send_notification(
        user_id    = engineer_id,
        title      = f'Ticket Assigned: {ticket.ticket_no}',
        message    = f'{ticket.school_name or "Company"} — {ticket.subject}',
        ticket_id  = ticket_id,
        school_id  = ticket.school_id,
        notif_type = 'TICKET',
    )

    db.session.commit()
    return jsonify({
        'message': f'Ticket assigned to {engineer.name}',
        'ticket':  ticket.to_dict(),
    }), 200


# ─── 6. Update Status ─────────────────────────────────────────────────────────

@tickets_bp.route('/<int:ticket_id>/status', methods=['PATCH'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def update_ticket_status(ticket_id):
    """
    PATCH /api/support/tickets/<id>/status
    Body: { status, resolution_notes (optional) }
    SUPER_ADMIN can set any status.
    School user can close or reopen their own school ticket.
    """
    ticket = SupportTicket.query.get_or_404(ticket_id)
    data   = request.get_json() or {}
    user   = get_current_user()

    valid_statuses = {
        'OPEN', 'PENDING', 'IN_PROGRESS',
        'WAITING', 'RESOLVED', 'CLOSED', 'REJECTED'
    }
    new_status = (data.get('status') or '').upper()
    if new_status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Valid: {valid_statuses}'}), 400

    # Authorization
    if user.role != UserRole.SUPER_ADMIN:
        if not _can_access_ticket(user, ticket):
            return jsonify({'error': 'Unauthorized to change ticket status'}), 403
        if new_status not in ('CLOSED', 'OPEN'):
            return jsonify({'error': 'School users may only close or reopen tickets'}), 403

    old_status    = ticket.status
    ticket.status = new_status

    if data.get('resolution_notes'):
        ticket.resolution_notes = data['resolution_notes']

    if new_status in ('RESOLVED', 'CLOSED'):
        ticket.resolved_at = datetime.utcnow()
        ticket.resolved_by = user.id

    ticket.updated_at = datetime.utcnow()

    status_messages = {
        'RESOLVED':    'Aapka ticket resolve ho gaya hai. Please confirm karo.',
        'CLOSED':      'Ticket closed kar diya gaya hai.',
        'REJECTED':    'Ticket reject kar diya gaya. Details ke liye ticket open karo.',
        'IN_PROGRESS': 'Aapka ticket par kaam shuru ho gaya hai.',
        'WAITING':     'Hum aapke response ka intezaar kar rahe hain.',
    }
    msg = status_messages.get(new_status, f'Ticket status: {new_status}')

    send_notification(
        user_id    = ticket.raised_by,
        title      = f'Ticket {ticket.ticket_no} — {new_status}',
        message    = msg,
        ticket_id  = ticket_id,
        school_id  = ticket.school_id,
        notif_type = 'TICKET',
    )

    db.session.commit()
    return jsonify({
        'message': f'Status changed: {old_status} → {new_status}',
        'ticket':  ticket.to_dict(),
    }), 200


# ─── 7. Upload Attachment ─────────────────────────────────────────────────────

@tickets_bp.route('/<int:ticket_id>/attachment', methods=['POST'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def upload_attachment(ticket_id):
    """
    POST /api/support/tickets/<id>/attachment
    multipart/form-data — field: 'file', optional: 'reply_id'
    Validates file against executable script types, size limits, and path traversal.
    """
    user   = get_current_user()
    ticket = SupportTicket.query.get_or_404(ticket_id)

    # Multi-tenant access check
    if not _can_access_ticket(user, ticket):
        return jsonify({'error': 'Unauthorized to upload attachments to this ticket'}), 403

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'file required — field name: file'}), 400

    reply_id = request.form.get('reply_id', type=int)
    if reply_id:
        reply = TicketReply.query.filter_by(id=reply_id, ticket_id=ticket_id).first()
        if not reply:
            return jsonify({'error': 'Invalid reply_id for this ticket'}), 400

    # Security validation
    is_valid, err_msg, safe_name, file_category = validate_uploaded_file(file)
    if not is_valid:
        return jsonify({'error': err_msg}), 400

    try:
        result = cloudinary.uploader.upload(
            file,
            folder        = f'eduerp/support/ticket_{ticket_id}',
            resource_type = 'auto',
            overwrite     = False,
        )
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

    attachment = SupportAttachment(
        ticket_id   = ticket_id,
        reply_id    = reply_id,
        uploaded_by = user.id,
        file_url    = result['secure_url'],
        file_name   = safe_name,
        file_type   = file_category,
        file_size   = result.get('bytes', 0),
    )
    db.session.add(attachment)
    db.session.commit()

    return jsonify(attachment.to_dict()), 201


# ─── 8. Developer Dashboard Summary (SUPER_ADMIN only) ────────────────────────

@tickets_bp.route('/dashboard/summary', methods=['GET'])
@role_required('SUPER_ADMIN')
def developer_dashboard():
    """
    GET /api/support/tickets/dashboard/summary
    Aggregates ticket stats for developers across products and schools.
    """
    from sqlalchemy import func

    product_type = request.args.get('product_type')
    q = SupportTicket.query
    if product_type:
        q = q.filter_by(product_type=product_type)

    total    = q.count()
    open_c   = q.filter(SupportTicket.status == 'OPEN').count()
    pending  = q.filter(SupportTicket.status.in_(['PENDING', 'IN_PROGRESS', 'WAITING'])).count()
    resolved = q.filter(SupportTicket.status.in_(['RESOLVED', 'CLOSED'])).count()
    critical = q.filter(SupportTicket.priority == 'CRITICAL').count()

    today    = date.today()
    today_c  = q.filter(func.date(SupportTicket.created_at) == today).count()

    product_breakdown = db.session.query(
        SupportTicket.product_type,
        func.count(SupportTicket.id).label('count'),
    ).group_by(SupportTicket.product_type).all()

    school_breakdown = db.session.query(
        SupportTicket.school_name,
        SupportTicket.school_id,
        func.count(SupportTicket.id).label('count'),
    ).group_by(
        SupportTicket.school_name,
        SupportTicket.school_id,
    ).order_by(func.count(SupportTicket.id).desc()).limit(10).all()

    return jsonify({
        'summary': {
            'total':    total,
            'open':     open_c,
            'pending':  pending,
            'resolved': resolved,
            'critical': critical,
            'today':    today_c,
        },
        'by_product': [
            {'product_type': r.product_type, 'count': r.count}
            for r in product_breakdown
        ],
        'by_school': [
            {
                'school_id':   r.school_id,
                'school_name': r.school_name,
                'count':       r.count,
            }
            for r in school_breakdown
        ],
    }), 200
