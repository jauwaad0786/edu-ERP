# backend/app/routes/audit.py
"""
Centralized Enterprise Audit Log APIs — School & Company Surfaces.

Endpoints:
  /api/audit/school/logs             -> Paginated school audit logs with advanced filters
  /api/audit/school/logs/stats       -> Metrics summary cards (total, today, critical, delegated, etc.)
  /api/audit/school/logs/<id>        -> Single audit event detail with field diffs
  /api/audit/school/logs/student/<id>-> Student-specific activity timeline
  /api/audit/school/logs/teacher/<id>-> Teacher-specific operational activity timeline
  /api/audit/school/logs/export      -> CSV export (audited upon execution)
  /api/audit/school/retention        -> GET / PUT retention policies
  /api/audit/school/logs/purge       -> Protected permanent purge (with pre & post security events)
  /api/audit/company/*               -> Company-side activity logs (Super Admin only)
"""

import csv
import io
import json
from datetime import datetime, timedelta
from app.utils.timezone_util import utc_now

from flask import Blueprint, request, jsonify, Response
from sqlalchemy import func

from app import db
from app.models.audit import AuditLog, CompanyActivityLog, AuditRetentionSetting, purge_school_logs
from app.models.user import User
from app.services.permission_resolver import permission_required
from app.utils.decorators import get_current_user

audit_bp = Blueprint('audit', __name__)


# ── Authorization helpers ────────────────────────────────────────────────

def _require_school_actor():
    actor = get_current_user()
    if not actor:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if not getattr(actor, 'school_id', None):
        return None, (jsonify({'error': 'School-side audit logs require a school-scoped account'}), 403)
    return actor, None


def _require_company_admin_actor():
    actor = get_current_user()
    if not actor:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if getattr(actor, 'school_id', None) is not None:
        return None, (jsonify({'error': 'Company-side audit logs are not available to school-scoped accounts'}), 403)

    legacy_role = getattr(actor, 'role', None)
    if getattr(legacy_role, 'value', None) == 'SUPER_ADMIN':
        return actor, None

    from app.models.rbac import get_user_roles
    roles = get_user_roles(actor)
    if any(r.is_super or r.hierarchy_level <= 1 for r in roles):
        return actor, None

    return None, (jsonify({'error': 'CEO/Super Admin access required'}), 403)


# ── Shared helpers ───────────────────────────────────────────────────────

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


def _parse_date_arg(name):
    raw = request.args.get(name)
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _csv_response(rows, fieldnames, filename):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return Response(
        buffer.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )


AUDIT_CSV_FIELDS = [
    'id', 'created_at', 'user_id', 'user_name', 'employee_id', 'role_snapshot',
    'department', 'module', 'submodule', 'action', 'entity_type', 'entity_id',
    'student_name', 'class_name', 'subject_name', 'is_delegated', 'status',
    'severity', 'changed_fields', 'ip_address', 'remarks',
]

COMPANY_CSV_FIELDS = [
    'id', 'created_at', 'actor_user_id', 'role_snapshot', 'module', 'action',
    'old_value', 'new_value', 'affected_school_id', 'ip_address',
]


def _flatten_for_csv(row_dict):
    row_dict = dict(row_dict)
    for k in ['old_value', 'new_value', 'changed_fields', 'delegation_info']:
        if row_dict.get(k) is not None:
            row_dict[k] = json.dumps(row_dict[k]) if isinstance(row_dict[k], (dict, list)) else str(row_dict[k])
        else:
            row_dict[k] = ''
    return row_dict


# ═══════════════════════════════════════════════════════════════════════════
#  SCHOOL-SIDE AUDIT LOGS
# ═══════════════════════════════════════════════════════════════════════════

def _build_school_query(actor):
    query = AuditLog.query.filter(AuditLog.school_id == actor.school_id)

    module = request.args.get('module')
    if module:
        query = query.filter(AuditLog.module == module.strip().upper())

    submodule = request.args.get('submodule')
    if submodule:
        query = query.filter(AuditLog.submodule == submodule.strip())

    action = request.args.get('action')
    if action:
        query = query.filter(AuditLog.action.ilike(f'%{action.strip()}%'))

    severity = request.args.get('severity')
    if severity:
        query = query.filter(AuditLog.severity == severity.strip().upper())

    status = request.args.get('status')
    if status:
        query = query.filter(AuditLog.status == status.strip().upper())

    is_delegated = request.args.get('is_delegated')
    if is_delegated is not None and is_delegated != '':
        is_del_bool = is_delegated.lower() in ('true', '1', 'yes')
        query = query.filter(AuditLog.is_delegated == is_del_bool)

    user_id = request.args.get('user_id')
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    student_id = request.args.get('student_id')
    if student_id:
        query = query.filter(AuditLog.student_id == student_id)

    teacher_id = request.args.get('teacher_id')
    if teacher_id:
        query = query.filter(AuditLog.teacher_id == teacher_id)

    class_id = request.args.get('class_id')
    if class_id:
        query = query.filter(AuditLog.class_id == class_id)

    from_date = _parse_date_arg('from_date')
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)

    to_date = _parse_date_arg('to_date')
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    search = request.args.get('q')
    if search:
        like = f'%{search.strip()}%'
        query = query.filter(db.or_(
            AuditLog.remarks.ilike(like),
            AuditLog.action.ilike(like),
            AuditLog.module.ilike(like),
            AuditLog.entity_type.ilike(like),
            AuditLog.ip_address.ilike(like),
        ))

    return query.order_by(AuditLog.created_at.desc())


@audit_bp.route('/school/logs', methods=['GET'])
@permission_required('audit.logs.view')
def list_school_logs():
    actor, error = _require_school_actor()
    if error:
        return error

    query = _build_school_query(actor)
    page, per_page = _paginate_args()
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    logs = [r.to_dict() for r in rows]

    return jsonify({
        'logs': logs,
        'page': page,
        'per_page': per_page,
        'total': total,
    }), 200


@audit_bp.route('/school/logs/stats', methods=['GET'])
@permission_required('audit.logs.view')
def get_school_audit_stats():
    actor, error = _require_school_actor()
    if error:
        return error

    today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    total_events = AuditLog.query.filter(AuditLog.school_id == actor.school_id).count()
    today_events = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.created_at >= today_start
    ).count()
    critical_events = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.severity.in_(['CRITICAL', 'HIGH'])
    ).count()
    failed_events = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.status.in_(['FAILED', 'FAILURE', 'DENIED'])
    ).count()
    delegated_events = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.is_delegated == True
    ).count()

    ret = AuditRetentionSetting.query.filter_by(school_id=actor.school_id).first()
    ret_days = ret.retention_days if ret else 365
    cutoff = utc_now() - timedelta(days=ret_days)
    purge_eligible = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.created_at < cutoff
    ).count()

    return jsonify({
        'total_events': total_events,
        'today_events': today_events,
        'critical_events': critical_events,
        'failed_events': failed_events,
        'delegated_events': delegated_events,
        'retention_days': ret_days,
        'purge_eligible': purge_eligible,
        # Aliases for UI & API consistency
        'total_logs': total_events,
        'today_logs': today_events,
        'critical_logs': critical_events,
        'failed_logs': failed_events,
        'delegated_logs': delegated_events,
        'purge_eligible_logs': purge_eligible,
    }), 200


@audit_bp.route('/school/logs/<int:log_id>', methods=['GET'])
@permission_required('audit.logs.view')
def get_school_log_detail(log_id):
    actor, error = _require_school_actor()
    if error:
        return error

    row = AuditLog.query.filter_by(id=log_id, school_id=actor.school_id).first_or_404()
    return jsonify(row.to_dict()), 200


@audit_bp.route('/school/logs/student/<int:student_id>', methods=['GET'])
@permission_required('audit.logs.view')
def get_student_audit_timeline(student_id):
    actor, error = _require_school_actor()
    if error:
        return error

    page, per_page = _paginate_args()
    query = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id,
        AuditLog.student_id == student_id
    ).order_by(AuditLog.created_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    logs = [r.to_dict() for r in rows]

    return jsonify({
        'student_id': student_id,
        'logs': logs,
        'page': page,
        'per_page': per_page,
        'total': total
    }), 200


@audit_bp.route('/school/logs/teacher/<int:teacher_id>', methods=['GET'])
@permission_required('audit.logs.view')
def get_teacher_audit_timeline(teacher_id):
    actor, error = _require_school_actor()
    if error:
        return error

    from app.models.academic import Teacher
    teacher = Teacher.query.filter_by(id=teacher_id, school_id=actor.school_id).first_or_404()

    page, per_page = _paginate_args()
    query = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id,
        db.or_(AuditLog.teacher_id == teacher_id, AuditLog.user_id == teacher.user_id)
    ).order_by(AuditLog.created_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    logs = [r.to_dict() for r in rows]

    return jsonify({
        'teacher_id': teacher_id,
        'logs': logs,
        'page': page,
        'per_page': per_page,
        'total': total
    }), 200


@audit_bp.route('/school/retention', methods=['GET'])
@permission_required('audit.logs.view')
def get_school_retention():
    actor, error = _require_school_actor()
    if error:
        return error

    ret = AuditRetentionSetting.query.filter_by(school_id=actor.school_id).first()
    ret_days = ret.retention_days if ret else 365
    auto_purge = ret.auto_purge_enabled if ret else False

    cutoff = utc_now() - timedelta(days=ret_days)
    eligible_count = AuditLog.query.filter(
        AuditLog.school_id == actor.school_id, AuditLog.created_at < cutoff
    ).count()

    oldest = db.session.query(func.min(AuditLog.created_at)).filter(
        AuditLog.school_id == actor.school_id
    ).scalar()

    return jsonify({
        'retention_days': ret_days,
        'auto_purge_enabled': auto_purge,
        'eligible_purge_count': eligible_count,
        'oldest_record_date': oldest.isoformat() if oldest else None,
        'cutoff_date': cutoff.isoformat(),
    }), 200


@audit_bp.route('/school/retention', methods=['PUT'])
@permission_required('audit.retention.manage')
def update_school_retention():
    actor, error = _require_school_actor()
    if error:
        return error

    data = request.get_json() or {}
    days = data.get('retention_days')
    if not isinstance(days, int) or days < 30:
        return jsonify({'error': 'retention_days must be an integer >= 30'}), 400

    ret = AuditRetentionSetting.query.filter_by(school_id=actor.school_id).first()
    old_val = ret.to_dict() if ret else None
    if not ret:
        ret = AuditRetentionSetting(school_id=actor.school_id, retention_days=days)
        db.session.add(ret)
    else:
        ret.retention_days = days

    if 'auto_purge_enabled' in data:
        ret.auto_purge_enabled = bool(data['auto_purge_enabled'])

    ret.updated_by = actor.id
    ret.updated_at = utc_now()
    db.session.commit()

    from app.services.audit_service import record_audit_event
    record_audit_event(
        module='AUDIT',
        action='RETENTION_POLICY_CHANGED',
        old_value=old_val,
        new_value=ret.to_dict(),
        severity='HIGH',
        remarks=f"Audit retention set to {days} days",
        user=actor
    )

    return jsonify({
        'message': 'Retention settings updated',
        'setting': ret.to_dict(),
        'retention_days': ret.retention_days
    }), 200


@audit_bp.route('/school/logs/export', methods=['GET'])
@permission_required('audit.logs.export')
def export_school_logs():
    actor, error = _require_school_actor()
    if error:
        return error

    rows = _build_school_query(actor).limit(5000).all()
    logs = [r.to_dict() for r in rows]
    csv_rows = [_flatten_for_csv(d) for d in logs]
    filename = f'audit_log_school_{actor.school_id}_{utc_now().strftime("%Y%m%d_%H%M%S")}.csv'

    # Audit the export operation itself
    from app.services.audit_service import record_audit_event
    record_audit_event(
        module='AUDIT',
        action='AUDIT_LOG_EXPORTED',
        severity='MEDIUM',
        remarks=f"Exported {len(rows)} audit log records to CSV",
        user=actor
    )

    return _csv_response(csv_rows, AUDIT_CSV_FIELDS, filename)


@audit_bp.route('/school/logs/purge', methods=['POST', 'DELETE'])
@permission_required('audit.purge')
def purge_school_logs_route():
    """Body: {"older_than_days": 180, "reason": "...", "confirmation": "CONFIRM PURGE"}"""
    actor, error = _require_school_actor()
    if error:
        return error

    data = request.get_json() or {}
    older_than_days = data.get('older_than_days')
    if not isinstance(older_than_days, int) or older_than_days < 30:
        return jsonify({'error': 'older_than_days is required and must be an integer >= 30'}), 400

    confirmation = (data.get('confirmation') or '').strip()
    if confirmation != 'CONFIRM PURGE':
        return jsonify({'error': 'Explicit confirmation required. Please type "CONFIRM PURGE".'}), 400

    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'A valid justification/reason is required for audit log purge'}), 400

    cutoff = utc_now() - timedelta(days=older_than_days)

    from app.services.audit_service import record_audit_event
    # 1. Critical Pre-Purge Security Record
    record_audit_event(
        module='AUDIT',
        action='AUDIT_PURGE_STARTED',
        severity='CRITICAL',
        old_value=None,
        new_value={'cutoff': cutoff.isoformat(), 'days': older_than_days, 'reason': reason},
        remarks=f"Permanent purge initiated by {actor.name}: records older than {older_than_days} days",
        user=actor
    )

    # 2. Execute Purge (exempts protected purge security events)
    deleted_count = purge_school_logs(
        school_id=actor.school_id,
        older_than=cutoff,
        deleted_by_user_id=actor.id,
        reason=reason,
    )

    # 3. Critical Post-Purge Security Record
    record_audit_event(
        module='AUDIT',
        action='AUDIT_PURGE_COMPLETED',
        severity='CRITICAL',
        old_value=None,
        new_value={'deleted_count': deleted_count, 'cutoff': cutoff.isoformat()},
        remarks=f"Purge completed: {deleted_count} logs permanently deleted. Reason: {reason}",
        user=actor
    )

    return jsonify({
        'message': f'{deleted_count} logs permanently purged',
        'deleted_count': deleted_count,
        'cutoff': cutoff.isoformat(),
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  COMPANY-SIDE ACTIVITY LOGS (Super Admin only)
# ═══════════════════════════════════════════════════════════════════════════

def _build_company_query():
    query = CompanyActivityLog.query

    module = request.args.get('module')
    if module:
        query = query.filter(CompanyActivityLog.module == module)

    action = request.args.get('action')
    if action:
        query = query.filter(CompanyActivityLog.action == action)

    actor_user_id = request.args.get('actor_user_id')
    if actor_user_id:
        query = query.filter(CompanyActivityLog.actor_user_id == actor_user_id)

    affected_school_id = request.args.get('affected_school_id')
    if affected_school_id:
        query = query.filter(CompanyActivityLog.affected_school_id == affected_school_id)

    from_date = _parse_date_arg('from_date')
    if from_date:
        query = query.filter(CompanyActivityLog.created_at >= from_date)

    to_date = _parse_date_arg('to_date')
    if to_date:
        query = query.filter(CompanyActivityLog.created_at <= to_date)

    return query.order_by(CompanyActivityLog.created_at.desc())


@audit_bp.route('/company/logs', methods=['GET'])
def list_company_logs():
    actor, error = _require_company_admin_actor()
    if error:
        return error

    query = _build_company_query()
    page, per_page = _paginate_args()
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'logs': [r.to_dict() for r in rows],
        'page': page,
        'per_page': per_page,
        'total': total,
    }), 200


@audit_bp.route('/company/logs/export', methods=['GET'])
def export_company_logs():
    actor, error = _require_company_admin_actor()
    if error:
        return error

    rows = _build_company_query().limit(5000).all()
    csv_rows = [_flatten_for_csv(r.to_dict()) for r in rows]
    filename = f'company_activity_log_{utc_now().strftime("%Y%m%d_%H%M%S")}.csv'
    return _csv_response(csv_rows, COMPANY_CSV_FIELDS, filename)
