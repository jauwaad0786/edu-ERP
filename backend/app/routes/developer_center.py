# backend/app/routes/developer_center.py
"""
Developer Error Center APIs — company-side only (Backend/Frontend/QA/DevOps
team, Super Admin, CEO). No school-side actor, no matter their permission
overrides, reaches this file: same reasoning as CompanyActivityLog in
audit.py — this data is internal ops, not tenant data, and mixing the two
concerns (school RBAC permission catalog vs internal error triage) would
force every future product (Inventory/HRM/Hospital) to register a fake
school-permission just to let its own dev team see its own bugs. So
authorization here is a direct scope check (`actor.school_id is None`),
not `permission_required(...)` — this file is deliberately NOT wired into
the platform permission catalog.

Endpoints:
  GET    /api/developer/errors                 -> list + filter + paginate
  GET    /api/developer/errors/<id>             -> full detail (stack trace, payload, headers)
  POST   /api/developer/errors/<id>/assign       -> create IssueAssignment row, status -> ASSIGNED
  PATCH  /api/developer/errors/<id>/status       -> move along ERROR_STATUSES lifecycle
  POST   /api/developer/errors/<id>/resolve      -> shortcut: resolution note + status -> RESOLVED
  GET    /api/developer/errors/summary           -> dashboard cards (open/critical/resolved-today counts)
  GET    /api/developer/issues                   -> same ErrorLog rows, reshaped for IssueBoard.jsx's
                                                      Jira-style kanban (was 404ing -- frontend page was
                                                      already written against a shape that never existed
                                                      as an endpoint)
  PUT    /api/developer/issues/<id>/status       -> same lifecycle move as PATCH errors/<id>/status,
                                                      just the verb/path IssueBoard.jsx already calls
  GET    /api/developer/health                   -> SystemHealthDashboard.jsx cards: CPU/RAM (psutil),
                                                      DB ping, basic service status. Does NOT include
                                                      queue stats (Mail/WhatsApp) -- those need Redis/
                                                      Celery, still not set up; 'queues' key is sent as
                                                      null and the frontend already renders its own
                                                      "No queue system configured" message for that case.
"""

from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify

try:
    import psutil
except ImportError:
    psutil = None

from app import db
from app.models.developer_center import (
    ErrorLog, IssueAssignment, ERROR_STATUSES, ASSIGNMENT_TEAMS, PRIORITY_LEVELS,
    ERROR_TYPES, make_fingerprint, log_error,
)
from app.models.school import School
from app.models.user import User
from app.models.audit import log_company_action
from app.utils.decorators import get_current_user

developer_center_bp = Blueprint('developer_center', __name__)


# ── Authorization ────────────────────────────────────────────────────────

def _require_company_actor():
    """
    Error board sirf company-side actors ke liye — school_id set hote hi
    403, chahe woh Principal ho ya kitni bhi platform permission rakhta ho.
    """
    actor = get_current_user()
    if not actor:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if getattr(actor, 'school_id', None) is not None:
        return None, (jsonify({'error': 'Developer Error Center is company-side only'}), 403)
    return actor, None


# ── Helpers ──────────────────────────────────────────────────────────────

def _error_detail_dict(row):
    """to_dict() list-safe hai (heavy fields skip karta hai) — detail view
    ke liye stack_trace/payload/headers/ip/browser/os yahin add karte hain,
    model ko touch kiye bina."""
    data = row.to_dict()
    data.update({
        'payload': row.payload,
        'headers': row.headers,
        'stack_trace': row.stack_trace,
        'ip_address': row.ip_address,
        'browser': row.browser,
        'os': row.os,
    })
    latest = (IssueAssignment.query
              .filter_by(error_id=row.id)
              .order_by(IssueAssignment.created_at.desc())
              .first())
    data['assignment'] = latest.to_dict() if latest else None
    return data


def _paginate_args():
    try:
        page = max(int(request.args.get('page', 1)), 1)
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = min(max(int(request.args.get('per_page', 25)), 1), 100)
    except (TypeError, ValueError):
        per_page = 25
    return page, per_page


# ── List + filter ────────────────────────────────────────────────────────

@developer_center_bp.route('/errors', methods=['GET'])
def list_errors():
    actor, error = _require_company_actor()
    if error:
        return error

    query = ErrorLog.query

    status = request.args.get('status')
    if status:
        query = query.filter(ErrorLog.status == status)

    severity = request.args.get('severity')
    if severity:
        query = query.filter(ErrorLog.severity == severity)

    error_type = request.args.get('error_type')
    if error_type:
        query = query.filter(ErrorLog.error_type == error_type)

    product_id = request.args.get('product_id')
    if product_id:
        query = query.filter(ErrorLog.product_id == product_id)

    school_id = request.args.get('school_id')
    if school_id:
        query = query.filter(ErrorLog.school_id == school_id)

    module = request.args.get('module')
    if module:
        query = query.filter(ErrorLog.module == module)

    search = request.args.get('q')
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(
            ErrorLog.exception_message.ilike(like),
            ErrorLog.api_endpoint.ilike(like),
            ErrorLog.exception_type.ilike(like),
        ))

    since_days = request.args.get('since_days')
    if since_days:
        try:
            cutoff = datetime.utcnow() - timedelta(days=int(since_days))
            query = query.filter(ErrorLog.last_seen_at >= cutoff)
        except ValueError:
            pass

    query = query.order_by(ErrorLog.last_seen_at.desc())

    page, per_page = _paginate_args()
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'errors': [r.to_dict() for r in rows],
        'page': page,
        'per_page': per_page,
        'total': total,
    }), 200


# ── Detail ───────────────────────────────────────────────────────────────

@developer_center_bp.route('/errors/<int:error_id>', methods=['GET'])
def get_error(error_id):
    actor, error = _require_company_actor()
    if error:
        return error

    row = ErrorLog.query.get(error_id)
    if not row:
        return jsonify({'error': 'Error not found'}), 404

    return jsonify(_error_detail_dict(row)), 200


# ── Assign ───────────────────────────────────────────────────────────────

@developer_center_bp.route('/errors/<int:error_id>/assign', methods=['POST'])
def assign_error(error_id):
    """Body: {"assigned_team": "BACKEND", "assigned_to_user_id": null,
              "priority": "P1_HIGH", "deadline": "2026-07-20T00:00:00"}"""
    actor, error = _require_company_actor()
    if error:
        return error

    row = ErrorLog.query.get(error_id)
    if not row:
        return jsonify({'error': 'Error not found'}), 404

    data = request.get_json() or {}
    assigned_team = data.get('assigned_team')
    priority = data.get('priority', 'P2_MEDIUM')

    if assigned_team and assigned_team not in ASSIGNMENT_TEAMS:
        return jsonify({'error': f'Invalid assigned_team, must be one of {ASSIGNMENT_TEAMS}'}), 400
    if priority not in PRIORITY_LEVELS:
        return jsonify({'error': f'Invalid priority, must be one of {PRIORITY_LEVELS}'}), 400

    deadline = None
    if data.get('deadline'):
        try:
            deadline = datetime.fromisoformat(data['deadline'])
        except ValueError:
            return jsonify({'error': 'deadline must be ISO-8601'}), 400

    old_status = row.status

    assignment = IssueAssignment(
        error_id=row.id,
        assigned_team=assigned_team,
        assigned_to_user_id=data.get('assigned_to_user_id'),
        assigned_by_user_id=actor.id,
        priority=priority,
        deadline=deadline,
    )
    db.session.add(assignment)

    if row.status == 'NEW':
        row.status = 'ASSIGNED'

    db.session.commit()

    log_company_action(
        actor_user=actor, module='developer_center', action='ERROR_ASSIGNED',
        old_value={'status': old_status},
        new_value={'status': row.status, 'assigned_team': assigned_team, 'priority': priority},
        affected_school_id=row.school_id,
        remarks=f'Error #{row.id} assigned to {assigned_team or "unassigned"}',
    )
    db.session.commit()

    return jsonify({
        'message': 'Assignment saved',
        'assignment': assignment.to_dict(),
        'error_status': row.status,
    }), 200


# ── Status lifecycle ─────────────────────────────────────────────────────

@developer_center_bp.route('/errors/<int:error_id>/status', methods=['PATCH'])
def update_error_status(error_id):
    """Body: {"status": "IN_PROGRESS"}"""
    actor, error = _require_company_actor()
    if error:
        return error

    row = ErrorLog.query.get(error_id)
    if not row:
        return jsonify({'error': 'Error not found'}), 404

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ERROR_STATUSES:
        return jsonify({'error': f'Invalid status, must be one of {ERROR_STATUSES}'}), 400

    old_status = row.status
    row.status = new_status
    if new_status == 'RESOLVED' and not row.resolved_at:
        row.resolved_at = datetime.utcnow()
    if new_status == 'REOPENED':
        row.resolved_at = None

    db.session.commit()

    log_company_action(
        actor_user=actor, module='developer_center', action='ERROR_STATUS_CHANGE',
        old_value={'status': old_status}, new_value={'status': new_status},
        affected_school_id=row.school_id,
        remarks=f'Error #{row.id} status: {old_status} -> {new_status}',
    )
    db.session.commit()

    return jsonify({'message': 'Status updated', 'status': row.status}), 200


# ── Resolve shortcut ─────────────────────────────────────────────────────

@developer_center_bp.route('/errors/<int:error_id>/resolve', methods=['POST'])
def resolve_error(error_id):
    """Body: {"resolution_note": "Fixed null-check in fee split"}"""
    actor, error = _require_company_actor()
    if error:
        return error

    row = ErrorLog.query.get(error_id)
    if not row:
        return jsonify({'error': 'Error not found'}), 404

    data = request.get_json() or {}
    note = data.get('resolution_note')
    if not note:
        return jsonify({'error': 'resolution_note is required'}), 400

    old_status = row.status
    row.status = 'RESOLVED'
    row.resolved_at = datetime.utcnow()

    latest = (IssueAssignment.query
              .filter_by(error_id=row.id)
              .order_by(IssueAssignment.created_at.desc())
              .first())
    if latest:
        latest.resolution_note = note
        latest.resolved_by_user_id = actor.id
        latest.resolved_at = row.resolved_at

    db.session.commit()

    log_company_action(
        actor_user=actor, module='developer_center', action='ERROR_RESOLVED',
        old_value={'status': old_status},
        new_value={'status': 'RESOLVED', 'resolution_note': note},
        affected_school_id=row.school_id,
        remarks=f'Error #{row.id} resolved',
    )
    db.session.commit()

    return jsonify({'message': 'Error marked resolved'}), 200


# ── Dashboard summary ────────────────────────────────────────────────────

@developer_center_bp.route('/errors/summary', methods=['GET'])
def error_summary():
    actor, error = _require_company_actor()
    if error:
        return error

    open_statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'REOPENED']
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    open_count = ErrorLog.query.filter(ErrorLog.status.in_(open_statuses)).count()
    critical_open = ErrorLog.query.filter(
        ErrorLog.status.in_(open_statuses), ErrorLog.severity == 'CRITICAL'
    ).count()
    resolved_today = ErrorLog.query.filter(
        ErrorLog.status == 'RESOLVED', ErrorLog.resolved_at >= today_start
    ).count()
    new_today = ErrorLog.query.filter(ErrorLog.first_seen_at >= today_start).count()

    by_severity = dict(
        db.session.query(ErrorLog.severity, db.func.count(ErrorLog.id))
        .filter(ErrorLog.status.in_(open_statuses))
        .group_by(ErrorLog.severity).all()
    )
    by_error_type = dict(
        db.session.query(ErrorLog.error_type, db.func.count(ErrorLog.id))
        .filter(ErrorLog.status.in_(open_statuses))
        .group_by(ErrorLog.error_type).all()
    )

    return jsonify({
        'open_count': open_count,
        'critical_open': critical_open,
        'resolved_today': resolved_today,
        'new_today': new_today,
        'by_severity': by_severity,
        'by_error_type': by_error_type,
    }), 200


# ── Issue Board (Jira-style) — same ErrorLog data, different shape ────────
# IssueBoard.jsx was already written against fields ErrorLog.to_dict()
# doesn't expose as-is: 'created_at' (model only has first_seen_at/
# last_seen_at), and 'assigned_to'/'resolution_note' (those live on the
# separate IssueAssignment row, one-to-many per error, not on ErrorLog
# itself). Reshaping server-side here instead of touching the frontend,
# since /errors' own shape is already relied on by ErrorDashboard.jsx and
# changing it would break that page instead.

def _issue_dict(row, school_names, user_names):
    data = row.to_dict()
    data['created_at'] = row.first_seen_at.isoformat() if row.first_seen_at else None
    latest = (IssueAssignment.query
              .filter_by(error_id=row.id)
              .order_by(IssueAssignment.created_at.desc())
              .first())
    data['assigned_to'] = latest.assigned_team if latest else None
    data['resolution_note'] = latest.resolution_note if latest else None
    # Same soft-degrade ErrorDashboard.jsx already relies on when a name
    # isn't available -- it falls back to `School ${school_id}` itself,
    # so leaving these None on a miss is a safe, already-handled case.
    data['school_name'] = school_names.get(row.school_id)
    data['user_name'] = user_names.get(row.user_id)
    return data


@developer_center_bp.route('/issues', methods=['GET'])
def list_issues():
    actor, error = _require_company_actor()
    if error:
        return error

    rows = ErrorLog.query.order_by(ErrorLog.last_seen_at.desc()).limit(300).all()

    # Batch-fetch names instead of querying School/User per row.
    school_ids = {r.school_id for r in rows if r.school_id}
    user_ids   = {r.user_id for r in rows if r.user_id}
    school_names = dict(
        db.session.query(School.id, School.name).filter(School.id.in_(school_ids)).all()
    ) if school_ids else {}
    user_names = dict(
        db.session.query(User.id, User.name).filter(User.id.in_(user_ids)).all()
    ) if user_ids else {}

    return jsonify([_issue_dict(r, school_names, user_names) for r in rows]), 200


@developer_center_bp.route('/issues/<int:error_id>/status', methods=['PUT'])
def update_issue_status(error_id):
    """Same body/lifecycle as PATCH /errors/<id>/status -- IssueBoard.jsx's
    drag/move buttons call PUT on this path, so this just mirrors that
    endpoint's logic under the path the frontend already uses."""
    actor, error = _require_company_actor()
    if error:
        return error

    row = ErrorLog.query.get(error_id)
    if not row:
        return jsonify({'error': 'Error not found'}), 404

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status not in ERROR_STATUSES:
        return jsonify({'error': f'Invalid status, must be one of {ERROR_STATUSES}'}), 400

    old_status = row.status
    row.status = new_status
    if new_status == 'RESOLVED' and not row.resolved_at:
        row.resolved_at = datetime.utcnow()
    if new_status == 'REOPENED':
        row.resolved_at = None

    db.session.commit()

    log_company_action(
        actor_user=actor, module='developer_center', action='ISSUE_STATUS_CHANGE',
        old_value={'status': old_status}, new_value={'status': new_status},
        affected_school_id=row.school_id,
        remarks=f'Issue #{row.id} status: {old_status} -> {new_status}',
    )
    db.session.commit()

    return jsonify({'message': 'Status updated', 'status': row.status}), 200


# ── Client-side crash capture ────────────────────────────────────────────
# Backend 500s already auto-capture via error_middleware.py -- this is the
# missing counterpart for a pure frontend crash (e.g. the React error #31
# seen on the audit button, which never touches the backend at all, so
# error_middleware.py never sees it). Deliberately NOT gated by
# _require_company_actor(): a crash can happen to ANY logged-in user
# (Teacher, Student, Parent...), not just company-side staff -- this file's
# module docstring restricts the *viewing/triage* endpoints to company
# actors, not error *reporting*, which has to accept from everyone.
# Also deliberately tolerant of a missing/expired session (get_current_user()
# returning None) -- a crash is exactly the moment auth state might itself
# be broken, and refusing to log it because of that would lose the report.

@developer_center_bp.route('/errors/report', methods=['POST'])
def report_client_error():
    """Body: {"error_type": "UNKNOWN", "exception_type": "TypeError",
              "exception_message": "...", "stack_trace": "...",
              "module": "audit", "page": "/audit/school/logs",
              "button_clicked": "View Details"}"""
    actor = get_current_user()

    data = request.get_json(silent=True) or {}

    error_type = data.get('error_type') or 'UNKNOWN'
    if error_type not in ERROR_TYPES:
        error_type = 'UNKNOWN'

    exception_type = (data.get('exception_type') or 'UnknownError')[:120]
    exception_message = data.get('exception_message')
    stack_trace = data.get('stack_trace')
    module = (data.get('module') or None)
    page = (data.get('page') or None)
    button_clicked = (data.get('button_clicked') or None)

    stack_top_line = ''
    if stack_trace:
        stack_top_line = stack_trace.strip().split('\n')[0][:200]

    fingerprint = make_fingerprint(
        error_type=error_type,
        api_endpoint=page or 'FRONTEND',
        exception_type=exception_type,
        stack_top_line=stack_top_line,
    )

    from app.models.platform import Product
    school_product = Product.query.filter_by(key='SCHOOL_ERP').first()

    defaults = {
        'product_id': school_product.id if school_product else None,
        'school_id': getattr(actor, 'school_id', None) if actor else None,
        'user_id': actor.id if actor else None,
        'role_snapshot': (actor.role.value if actor and actor.role else None),
        'module': module,
        'page': page,
        'button_clicked': button_clicked,
        'exception_type': exception_type,
        'exception_message': exception_message,
        'stack_trace': stack_trace,
        'error_type': error_type,
        'severity': 'MEDIUM',
        'status': 'NEW',
        'ip_address': request.remote_addr,
        'browser': request.headers.get('User-Agent', '')[:100],
    }

    row = log_error(fingerprint, defaults)
    db.session.commit()

    return jsonify({'message': 'Error reported', 'error_id': row.id}), 201


# ── System Health ─────────────────────────────────────────────────────────

@developer_center_bp.route('/health', methods=['GET'])
def system_health():
    actor, error = _require_company_actor()
    if error:
        return error

    start = datetime.utcnow()
    db_ok = True
    try:
        db.session.execute(db.text('SELECT 1'))
    except Exception:
        db_ok = False
    api_response_time = int((datetime.utcnow() - start).total_seconds() * 1000)

    if psutil:
        cpu_usage = round(psutil.cpu_percent(interval=0.3), 1)
        mem = psutil.virtual_memory()
        memory_usage = round(mem.percent, 1)
        total_memory = f'{round(mem.total / (1024 ** 3), 1)} GB'
    else:
        # psutil not installed -- don't fabricate numbers, surface the gap instead.
        cpu_usage = None
        memory_usage = None
        total_memory = 'psutil not installed'

    if not db_ok:
        overall_status = 'down'
    elif cpu_usage is not None and (cpu_usage > 85 or memory_usage > 85):
        overall_status = 'degraded'
    else:
        overall_status = 'healthy'

    schools_online = School.query.count()

    return jsonify({
        'overall_status': overall_status,
        # No session/last-active tracking exists on User yet to compute a
        # real "currently active" count -- returning 0 honestly instead of
        # guessing a field that may not exist on the model.
        'active_users': 0,
        'schools_online': schools_online,
        'api_response_time': api_response_time,
        'system': {
            'cpu_usage': cpu_usage,
            'memory_usage': memory_usage,
            'total_memory': total_memory,
        },
        'services': {
            'database': 'up' if db_ok else 'down',
            'application': 'up',
        },
        'queues': None,
        'last_updated': datetime.utcnow().isoformat(),
    }), 200
