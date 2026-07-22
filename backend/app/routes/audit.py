# backend/app/routes/audit.py
"""
Audit log APIs — two completely separate surfaces, never sharing a query:

  /api/audit/school/*   -> a school's own AuditLog. Gated by
                            permission_required('audit.logs.view' /
                            'audit.logs.delete') -- this genuinely is a
                            school-level RBAC decision (a Principal might
                            allow a Vice Principal to view logs but not
                            purge them), so unlike developer_center.py this
                            goes through the platform permission catalog,
                            not a hardcoded scope check.

                            NOTE: 'audit.logs.view' and 'audit.logs.delete'
                            need adding to permission_catalog.py (with a
                            sensible default template, e.g. PRINCIPAL/
                            DIRECTOR get both, VICE_PRINCIPAL gets view
                            only) -- same pattern as when 'fees.collect'
                            was added for TEACHER. Until that catalog entry
                            exists, permission_required denies by default
                            (fails closed), so nobody gets accidentally
                            locked out of the wrong thing -- they just get
                            403 until the catalog is updated.

  /api/audit/company/*  -> CompanyActivityLog. CEO/Super Admin only. Not
                            permission-catalog-gated -- SUPER_ADMIN has
                            is_super=False in DEFAULT_COMPANY_ROLES (only
                            CEO does), so this checks hierarchy_level <= 1
                            directly, with a legacy User.role fallback in
                            case a Super Admin's UserRoleAssignment backfill
                            (sync_legacy_role_assignments) hasn't run yet.

Tenant isolation: a school-scoped actor NEVER gets to pass in a school_id
-- their own actor.school_id is always what's queried. This is checked
explicitly here (not left to fall out of the permission check), same
principle routes/rbac.py's docstring already states.
"""

import csv
import io
import json
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, Response

from app import db
from app.models.audit import AuditLog, CompanyActivityLog, purge_school_logs
from app.models.user import User
from app.services.audit_service import log_action
from app.services.permission_resolver import permission_required
from app.utils.decorators import get_current_user

audit_bp = Blueprint('audit', __name__)


# ── Authorization helpers ────────────────────────────────────────────────

def _require_school_actor():
    """
    School-side audit endpoints require an actor WITH a school_id.
    permission_required() alone would not catch a company-side actor who
    happens to hold a global (school_id=None) 'audit.logs.view' template
    row -- explicit check here, per routes/rbac.py's stated convention of
    not leaving tenant-scoping to fall out of a permission lookup.
    """
    actor = get_current_user()
    if not actor:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if not getattr(actor, 'school_id', None):
        return None, (jsonify({'error': 'School-side audit logs require a school-scoped account'}), 403)
    return actor, None


def _require_company_admin_actor():
    """CEO/Super Admin only -- see module docstring for why this isn't a permission-key check."""
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


# NEW — BUGFIX (2026-07): AuditLog.to_dict()/CompanyActivityLog.to_dict()
# only ever expose the raw *_id integer, never a name. The frontend
# (SchoolAuditLogs.jsx / CompanyAuditLogs.jsx) already expects
# `user_name` / `actor_name` respectively and falls back to showing
# "User {id}" — which is what always rendered, for every row, because
# that field never actually got sent. Fixed here at the route layer
# (not inside to_dict()) with ONE batched query per page instead of a
# query per row, so listing 25/100 log rows doesn't turn into 25/100
# extra SELECTs.
def _attach_actor_names(rows, dicts, id_field, name_key):
    """
    rows:  the ORM objects for this page (AuditLog or CompanyActivityLog)
    dicts: the matching list of to_dict() results, same order as rows
    id_field: 'user_id' or 'actor_user_id' — the FK column on the row
    name_key: 'user_name' or 'actor_name' — the key the frontend reads

    Mutates `dicts` in place and returns them for convenience.
    """
    ids = {getattr(r, id_field) for r in rows if getattr(r, id_field) is not None}
    names_by_id = {}
    if ids:
        names_by_id = dict(
            db.session.query(User.id, User.name).filter(User.id.in_(ids)).all()
        )
    for row, d in zip(rows, dicts):
        uid = getattr(row, id_field)
        # System-initiated rows (e.g. delegation auto-expiry) have no
        # human actor at all — label them instead of leaving a blank
        # that would render as "User None" on the frontend fallback.
        d[name_key] = names_by_id.get(uid) if uid is not None else 'System'
    return dicts


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
    'id', 'created_at', 'user_id', 'user_name', 'role_snapshot', 'department',
    'module', 'submodule', 'action', 'old_value', 'new_value',
    'api_endpoint', 'http_method', 'status_code', 'execution_time_ms',
    'ip_address', 'remarks',
]

COMPANY_CSV_FIELDS = [
    'id', 'created_at', 'actor_user_id', 'actor_name', 'role_snapshot', 'module', 'action',
    'old_value', 'new_value', 'affected_school_id', 'ip_address',
]


def _flatten_for_csv(row_dict):
    row_dict = dict(row_dict)
    row_dict['old_value'] = json.dumps(row_dict['old_value']) if row_dict.get('old_value') is not None else ''
    row_dict['new_value'] = json.dumps(row_dict['new_value']) if row_dict.get('new_value') is not None else ''
    return row_dict


# ═══════════════════════════════════════════════════════════════════════════
#  SCHOOL-SIDE
# ═══════════════════════════════════════════════════════════════════════════

def _build_school_query(actor):
    query = AuditLog.query.filter(AuditLog.school_id == actor.school_id)

    module = request.args.get('module')
    if module:
        query = query.filter(AuditLog.module == module)

    submodule = request.args.get('submodule')
    if submodule:
        query = query.filter(AuditLog.submodule == submodule)

    action = request.args.get('action')
    if action:
        query = query.filter(AuditLog.action == action)

    user_id = request.args.get('user_id')
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    from_date = _parse_date_arg('from_date')
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)

    to_date = _parse_date_arg('to_date')
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    search = request.args.get('q')
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(
            AuditLog.remarks.ilike(like),
            AuditLog.api_endpoint.ilike(like),
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
    logs = _attach_actor_names(rows, [r.to_dict() for r in rows], 'user_id', 'user_name')

    return jsonify({
        'logs': logs,
        'page': page,
        'per_page': per_page,
        'total': total,
    }), 200


@audit_bp.route('/school/logs/export', methods=['GET'])
@permission_required('audit.logs.view')
def export_school_logs():
    actor, error = _require_school_actor()
    if error:
        return error

    # Export caps at 5000 rows per request -- a Principal filtering a
    # narrower date range for a bigger pull is safer than one endpoint
    # trying to stream an unbounded table.
    rows = _build_school_query(actor).limit(5000).all()
    logs = _attach_actor_names(rows, [r.to_dict() for r in rows], 'user_id', 'user_name')
    csv_rows = [_flatten_for_csv(d) for d in logs]
    filename = f'audit_log_school_{actor.school_id}_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    return _csv_response(csv_rows, AUDIT_CSV_FIELDS, filename)


@audit_bp.route('/school/logs/purge', methods=['DELETE'])
@permission_required('audit.logs.delete')
def purge_school_logs_route():
    """Body: {"older_than_days": 180, "reason": "Quarterly cleanup"}"""
    actor, error = _require_school_actor()
    if error:
        return error

    data = request.get_json() or {}
    older_than_days = data.get('older_than_days')
    if not isinstance(older_than_days, int) or older_than_days < 30:
        return jsonify({'error': 'older_than_days is required and must be an integer >= 30'}), 400

    reason = data.get('reason')
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)

    deleted_count = purge_school_logs(
        school_id=actor.school_id,
        older_than=cutoff,
        deleted_by_user_id=actor.id,
        reason=reason,
    )

    # This row is created AFTER the purge, so it's outside the deleted
    # range and survives -- the purge event itself must stay auditable.
    log_action(
        module='audit', submodule='purge', action='DELETE', user=actor,
        old_value=None,
        new_value={'deleted_count': deleted_count, 'cutoff': cutoff.isoformat()},
        remarks=reason,
    )

    return jsonify({
        'message': 'Logs purged',
        'deleted_count': deleted_count,
        'cutoff': cutoff.isoformat(),
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  COMPANY-SIDE
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
    logs = _attach_actor_names(rows, [r.to_dict() for r in rows], 'actor_user_id', 'actor_name')

    return jsonify({
        'logs': logs,
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
    logs = _attach_actor_names(rows, [r.to_dict() for r in rows], 'actor_user_id', 'actor_name')
    csv_rows = [_flatten_for_csv(d) for d in logs]
    filename = f'company_activity_log_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv'
    return _csv_response(csv_rows, COMPANY_CSV_FIELDS, filename)
