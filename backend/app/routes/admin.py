# backend/app/routes/admin.py — FULL REPLACE

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func as sqlfunc
from datetime import datetime
from app import db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Class
from app.models.financial import FeeRecord
from app.models.service_charge import ServiceCharge
from app.utils.decorators import role_required, get_current_user
from app.models.rbac import (
    Role, UserRoleAssignment, get_user_roles, can_manage_role,
)

admin_bp = Blueprint('admin', __name__)


# ─── Feature Catalog (reference only — actual enablement is per-school) ──────
FEATURE_CATALOG = [
    # key, label, tier
    {'key': 'up_to_200_students',   'label': 'Up to 200 Students',     'tier': 'BASIC'},
    {'key': 'single_admin',         'label': '1 Admin Account',        'tier': 'BASIC'},
    {'key': 'weekly_support',       'label': 'Weekly Support',         'tier': 'BASIC'},
    {'key': 'student_management',   'label': 'Student Management',     'tier': 'BASIC'},
    {'key': 'attendance_tracking',  'label': 'Attendance Tracking',    'tier': 'BASIC'},
    {'key': 'fee_management',       'label': 'Fee Management',         'tier': 'BASIC'},
    {'key': 'result_management',    'label': 'Result Management',      'tier': 'BASIC'},
    {'key': 'basic_reports',        'label': 'Basic Reports',          'tier': 'BASIC'},

    {'key': 'hrms_module',          'label': 'HRMS Module',            'tier': 'PROFESSIONAL'},
    {'key': 'multi_admin_3',        'label': '3 Admin Accounts',       'tier': 'PROFESSIONAL'},
    {'key': 'support_247',          'label': '24/7 Support',           'tier': 'PROFESSIONAL'},
    {'key': 'teacher_management',   'label': 'Teacher Management',     'tier': 'PROFESSIONAL'},
    {'key': 'payroll_system',       'label': 'Payroll System',         'tier': 'PROFESSIONAL'},
    {'key': 'advanced_analytics',   'label': 'Advanced Analytics',     'tier': 'PROFESSIONAL'},
    {'key': 'role_based_access',    'label': 'Role-based Access',      'tier': 'PROFESSIONAL'},

    {'key': 'whatsapp_notifications','label': 'WhatsApp Notifications','tier': 'ENTERPRISE'},
    {'key': 'multi_admin_5',        'label': '5 Admin Accounts',       'tier': 'ENTERPRISE'},
    {'key': 'priority_support_247', 'label': '24/7 Priority Support',  'tier': 'ENTERPRISE'},
    {'key': 'ai_reports',           'label': 'AI-powered Reports',     'tier': 'ENTERPRISE'},
    {'key': 'cloud_erp_dashboard',  'label': 'Cloud ERP Dashboard',    'tier': 'ENTERPRISE'},
    {'key': 'custom_integrations',  'label': 'Custom Integrations',    'tier': 'ENTERPRISE'},
    {'key': 'advanced_security',    'label': 'Advanced Security',      'tier': 'ENTERPRISE'},
    {'key': 'real_time_alerts',     'label': 'Real-time Alerts',       'tier': 'ENTERPRISE'},
]

PLAN_PRESETS = {
    'BASIC':        [f['key'] for f in FEATURE_CATALOG if f['tier'] == 'BASIC'],
    'PROFESSIONAL': [f['key'] for f in FEATURE_CATALOG if f['tier'] in ('BASIC', 'PROFESSIONAL')],
    'ENTERPRISE':   [f['key'] for f in FEATURE_CATALOG],   # everything
}

PLAN_PRICING = {
    'BASIC':        {'price': 1799, 'label': 'Basic'},
    'PROFESSIONAL': {'price': 2999, 'label': 'Professional'},
    'ENTERPRISE':   {'price': 5999, 'label': 'Enterprise'},
}


@admin_bp.route('/features/catalog', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_feature_catalog():
    return jsonify({
        'catalog':  FEATURE_CATALOG,
        'presets':  PLAN_PRESETS,
        'pricing':  PLAN_PRICING,
    }), 200

# ─── Schools ──────────────────────────────────────────────────────────────────

@admin_bp.route('/schools', methods=['GET'])
@role_required('SUPER_ADMIN')
def list_schools():
    schools = School.query.all()
    this_month = datetime.utcnow().replace(day=1)
    result = []
    for s in schools:
        d = s.to_dict()
        # total students for chart
        d['total_students'] = User.query.filter_by(
            school_id=s.id, role=UserRole.STUDENT
        ).count()
        # service charge paid this month
        charges = ServiceCharge.query.filter_by(school_id=s.id).all()
        d['paid_this_month'] = any(
            c for c in charges
            if c.charge_date >= this_month and c.is_paid
        )
        result.append(d)
    return jsonify(result), 200


@admin_bp.route('/schools', methods=['POST'])
@role_required('SUPER_ADMIN')
def create_school():
    data = request.get_json()
    school = School(
        name=data['name'],
        code=data['code'].upper(),
        address=data.get('address'),
        city=data.get('city'),
        state=data.get('state'),
        pincode=data.get('pincode'),
        phone=data.get('phone'),
        email=data.get('email'),
        type=data.get('type', 'SCHOOL'),
        current_session=data.get('current_session', '2024-25')
    )
    db.session.add(school)
    db.session.flush()

    default_classes = [
        'Nursery','LKG','UKG',
        'Class 1','Class 2','Class 3','Class 4','Class 5',
        'Class 6','Class 7','Class 8','Class 9',
        'Class 10','Class 11','Class 12'
    ]
    for class_name in default_classes:
        db.session.add(Class(
            name=class_name,
            section='A',
            session=school.current_session,
            school_id=school.id
        ))
    db.session.commit()
    return jsonify({
        'message': 'School created with default classes',
        'school': school.to_dict()
    }), 201


@admin_bp.route('/schools/<int:school_id>', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_school_detail(school_id):
    school = School.query.get_or_404(school_id)

    total_students = User.query.filter_by(
        school_id=school_id, role=UserRole.STUDENT
    ).count()
    total_teachers = User.query.filter_by(
        school_id=school_id, role=UserRole.TEACHER
    ).count()
    total_classes = Class.query.filter_by(school_id=school_id).count()

    # Fee stats
    fee_records = FeeRecord.query.join(
        User, FeeRecord.student_id == User.id
    ).filter(User.school_id == school_id).all()
    total_due  = sum(r.amount_due  for r in fee_records)
    total_paid = sum(r.amount_paid for r in fee_records)

    # Service charges
    charges = ServiceCharge.query.filter_by(school_id=school_id)\
                .order_by(ServiceCharge.charge_date.desc()).all()
    this_month = datetime.utcnow().replace(day=1)
    paid_this_month = any(
        c for c in charges
        if c.charge_date >= this_month and c.is_paid
    )

    return jsonify({
        **school.to_dict(),
        'total_students':  total_students,
        'total_teachers':  total_teachers,
        'total_classes':   total_classes,
        'fees_collected':  total_paid,
        'fees_pending':    total_due - total_paid,
        'service_charges': [c.to_dict() for c in charges],
        'paid_this_month': paid_this_month,
    }), 200


@admin_bp.route('/schools/<int:school_id>', methods=['PUT'])
@role_required('SUPER_ADMIN')
def update_school(school_id):
    school = School.query.get_or_404(school_id)
    data = request.get_json()
    for field in ['name', 'address', 'city', 'state', 'phone', 'email', 'current_session', 'is_active', 'plan']:
        if field in data:
            setattr(school, field, data[field])
    db.session.commit()
    return jsonify(school.to_dict()), 200

@admin_bp.route('/schools/<int:school_id>/features', methods=['PUT'])
@role_required('SUPER_ADMIN')
def update_school_features(school_id):
    """
    Set the exact list of enabled feature keys for a school.
    Body: { features: ['student_management', 'hrms_module', ...] }
    This is fully manual/override — independent of plan label.
    """
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}
    features = data.get('features', [])

    valid_keys = {f['key'] for f in FEATURE_CATALOG}
    features = [f for f in features if f in valid_keys]   # sanitize

    school.set_features(features)
    if 'plan' in data:
        school.plan = data['plan']
    db.session.commit()
    return jsonify(school.to_dict()), 200


@admin_bp.route('/schools/<int:school_id>/features/apply-preset', methods=['POST'])
@role_required('SUPER_ADMIN')
def apply_plan_preset(school_id):
    """Quick-fill: apply a plan's default feature set (still editable after)."""
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}
    plan = data.get('plan', 'BASIC')
    if plan not in PLAN_PRESETS:
        return jsonify({'error': 'Invalid plan'}), 400
    school.plan = plan
    school.set_features(PLAN_PRESETS[plan])
    db.session.commit()
    return jsonify(school.to_dict()), 200


@admin_bp.route('/schools/<int:school_id>/toggle', methods=['PUT'])
@role_required('SUPER_ADMIN')
def toggle_school(school_id):
    school = School.query.get_or_404(school_id)
    school.is_active = not school.is_active
    db.session.commit()
    return jsonify({
        'is_active': school.is_active,
        'message': f"School {'activated' if school.is_active else 'deactivated'}"
    }), 200


# ─── Service Charges ──────────────────────────────────────────────────────────

@admin_bp.route('/schools/<int:school_id>/service-charges', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_service_charges(school_id):
    School.query.get_or_404(school_id)
    charges = ServiceCharge.query.filter_by(school_id=school_id)\
                .order_by(ServiceCharge.charge_date.desc()).all()
    return jsonify([c.to_dict() for c in charges]), 200


@admin_bp.route('/schools/<int:school_id>/service-charges', methods=['POST'])
@role_required('SUPER_ADMIN')
def add_service_charge(school_id):
    School.query.get_or_404(school_id)
    data = request.get_json()
    charge = ServiceCharge(
        school_id=school_id,
        amount=data['amount'],
        label=data.get('label', 'Monthly Service Charge'),
        charge_date=datetime.strptime(data['charge_date'], '%Y-%m-%d')
                    if data.get('charge_date') else datetime.utcnow(),
        is_paid=data.get('is_paid', False),
        note=data.get('note', '')
    )
    db.session.add(charge)
    db.session.commit()
    return jsonify(charge.to_dict()), 201


@admin_bp.route('/service-charges/<int:charge_id>/toggle-paid', methods=['PUT'])
@role_required('SUPER_ADMIN')
def toggle_charge_paid(charge_id):
    charge = ServiceCharge.query.get_or_404(charge_id)
    charge.is_paid = not charge.is_paid
    db.session.commit()
    return jsonify(charge.to_dict()), 200


# ─── User helpers ─────────────────────────────────────────────────────────────

import re as _re
import string as _string
import random as _random


def _gen_username(name: str, role: str, school_id=None) -> str:
    """
    Generate a unique username like: rajesh.kumar.tchr or priya.student
    Role suffix keeps usernames self-descriptive.
    Appends a random 3-digit number if a collision exists.
    """
    role_suffix = {
        'SUPER_ADMIN':   'admin',
        'PRINCIPAL':     'prin',
        'VICE_PRINCIPAL':'vp',
        'TEACHER':       'tchr',
        'ACCOUNTANT':    'acct',
        'RECEPTIONIST':  'rcpt',
        'LIBRARIAN':     'lib',
        'HOSTEL':        'hstl',
        'TRANSPORT':     'trns',
        'HR':            'hr',
        'STUDENT':       'stu',
        'PARENT':        'prnt',
    }.get(role, 'usr')

    # clean name: lower, keep only alphanum+space, replace spaces with dots
    clean = _re.sub(r'[^a-z0-9 ]', '', name.lower().strip())
    parts = clean.split()[:2]          # first + last name only
    base  = '.'.join(parts) + '.' + role_suffix

    if not User.query.filter_by(username=base).first():
        return base

    for _ in range(20):
        candidate = base + '.' + ''.join(_random.choices(_string.digits, k=3))
        if not User.query.filter_by(username=candidate).first():
            return candidate

    # absolute fallback
    return base + '.' + ''.join(_random.choices(_string.digits, k=6))


def _validate_create_payload_loose(data: dict):
    if not (data.get('name') or '').strip():
        return 'name is required'
    if not (data.get('email') or '').strip():
        return 'email is required'
    if not (data.get('role') or '').strip():
        return 'role is required'
    return None

# ─── Users ────────────────────────────────────────────────────────────────────

@admin_bp.route('/users', methods=['GET'])
@role_required('SUPER_ADMIN')
def list_users():
    """
    GET /api/admin/users
    Query params:
      school_id   filter by school (explicit only — see default-scope note)
      role        filter by role
      status      active | inactive
      search      searches name, email, username, phone
      page        default 1
      per_page    default 50 (max 200)

    Default scope: company-side users ONLY (school_id IS NULL). This is the
    Super Admin / developer panel — it must never show a school's students,
    teachers, or parents by default. Pass an explicit school_id if you need
    to look up a specific school's users (e.g. for support/debugging).
    """
    q          = User.query
    school_id  = request.args.get('school_id')
    role_f     = request.args.get('role')
    status_f   = request.args.get('status')
    search     = (request.args.get('search') or '').strip().lower()
    page       = max(1, int(request.args.get('page', 1)))
    per_page   = min(200, int(request.args.get('per_page', 50)))

    if school_id:
        q = q.filter(User.school_id == int(school_id))
    else:
        q = q.filter(User.school_id.is_(None))
    if role_f:
        try:
            q = q.filter(User.role == UserRole(role_f))
        except ValueError:
            pass
    if status_f == 'active':
        q = q.filter(User.is_active == True)
    elif status_f == 'inactive':
        q = q.filter(User.is_active == False)
    if search:
        like = f'%{search}%'
        q = q.filter(
            db.or_(
                User.name.ilike(like),
                User.email.ilike(like),
                User.username.ilike(like),
                User.phone.ilike(like),
            )
        )

    total   = q.count()
    users   = q.order_by(User.created_at.desc())\
               .offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'users':    [_serialize_user_with_platform_role(u) for u in users],
        'total':    total,
        'page':     page,
        'per_page': per_page,
        'pages':    (total + per_page - 1) // per_page,
    }), 200


def _serialize_user_with_platform_role(user):
    """
    to_dict_with_credentials() only exposes the legacy `role` enum, which is
    always 'SUPER_ADMIN' for every company employee (CEO, Sales, Intern,
    Developer, ...) — the real distinction lives in platform_roles via
    UserRoleAssignment. Attach it so the panel can tell company employees
    apart instead of badging all of them "SUPER_ADMIN".
    """
    d = user.to_dict_with_credentials()
    d['platform_roles'] = [{'key': r.key, 'name': r.name} for r in get_user_roles(user)]
    return d


# NEW
def _resolve_creation_role(role_str, school_id):
    """
    Returns (legacy_enum_value, platform_role_or_None, error_or_None).

    Three paths:
      - role_str matches the legacy UserRole enum (school-side staff, or
        old-style SUPER_ADMIN) -> use it directly, no platform role.
      - role_str matches a COMPANY-scope Role.key in platform_roles
        (CEO, SUB_ADMIN, MANAGER, SOFTWARE_ENGINEER, DEVELOPER, QA,
        CALL_CENTER, ...) -> legacy enum falls back to SUPER_ADMIN as a
        generic "company account" marker; the real identity is the
        platform Role, linked via UserRoleAssignment after the User row
        is created.
      - role_str matches a TENANT-scope Role.key that has NO legacy enum
        counterpart (currently only 'DIRECTOR' -- seeded in rbac.py but
        never added to the UserRole enum, so the old
        `UserRole(role_str)` lookup above always raised and this whole
        branch was unreachable, making "Assign School Head -> Director"
        fail with "Invalid role: DIRECTOR" every time). Spec section 1
        says "Director & Principal have same dashboard", and
        roleEquivalence.js/resolveMenuRole() already treat them as
        dashboard-equivalent on the frontend -- so PRINCIPAL is the
        correct legacy mirror here, not SUPER_ADMIN. Real identity is
        still the platform Role via UserRoleAssignment, same as the
        COMPANY branch.
    """
    try:
        return UserRole(role_str), None, None
    except ValueError:
        pass

    platform_role = Role.query.filter_by(key=role_str).first()
    if not platform_role:
        return None, None, f"Invalid role: {role_str}"

    if platform_role.scope == 'COMPANY':
        if school_id:
            return None, None, "Company-scope roles cannot have a school_id"
        return UserRole.SUPER_ADMIN, platform_role, None

    # TENANT-scope role with no legacy enum entry (e.g. DIRECTOR)
    if not school_id:
        return None, None, f"'{role_str}' requires a school_id"
    return UserRole.PRINCIPAL, platform_role, None


@admin_bp.route('/users', methods=['POST'])
@role_required('SUPER_ADMIN')
def create_user():
    """
    Create any user. Returns credentials including plain password.

    role can be either a legacy UserRole enum value (school staff) OR a
    COMPANY-scope platform Role key (CEO/SUB_ADMIN/DEVELOPER/...) -- see
    _resolve_creation_role(). Company roles never touch the Postgres enum;
    they're tracked purely via UserRoleAssignment, so adding a new company
    role (e.g. a new department) never needs a DB migration.
    """
    actor = get_current_user()
    data = request.get_json() or {}

    err = _validate_create_payload_loose(data)
    if err:
        return jsonify({'error': err}), 400

    email = data['email'].strip().lower()
    if User.query.filter(sqlfunc.lower(User.email) == email).first():
        return jsonify({'error': 'Email already exists'}), 409

    role_str  = data['role'].strip()
    school_id = data.get('school_id') or None

    legacy_role, platform_role, err = _resolve_creation_role(role_str, school_id)
    if err:
        return jsonify({'error': err}), 400

    # Hierarchy check: only enforced for COMPANY-scope creations. School-side
    # role creation keeps existing behaviour (SUPER_ADMIN can create any
    # school role — Principal-side creation has its own separate hierarchy
    # check in principal.py's PRINCIPAL_ALLOWED_ROLES).
    if platform_role:
        actor_roles = get_user_roles(actor)
        if not can_manage_role(actor_roles, [platform_role]):
            return jsonify({
                'error': f"You do not have sufficient hierarchy to create a '{role_str}' user"
            }), 403

    plain_pw = data.get('password') or 'EduErp@123'

    username = (data.get('username') or '').strip().lower() or None
    if username:
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already taken'}), 409
    else:
        username = _gen_username(data['name'], role_str, school_id)

    user = User(
        name        = data['name'].strip(),
        email       = email,
        username    = username,
        role        = legacy_role,
        school_id   = int(school_id) if school_id else None,
        phone       = (data.get('phone') or '').strip() or None,
        department  = (data.get('department') or '').strip() or None,
        designation = (data.get('designation') or '').strip() or None,
        is_active   = data.get('is_active', True),
    )
    user.set_password(plain_pw, store_plain=True)
    db.session.add(user)
    db.session.flush()   # need user.id before linking the role assignment

    if platform_role:
        db.session.add(UserRoleAssignment(
            user_id=user.id, role_id=platform_role.id,
            is_active=True, assigned_by=actor.id,
        ))

    db.session.commit()

    result = user.to_dict_with_credentials()
    if platform_role:
        result['platform_role'] = platform_role.to_dict()
    return jsonify(result), 201


@admin_bp.route('/users/<int:user_id>', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict_with_credentials()), 200


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@role_required('SUPER_ADMIN')
def update_user(user_id):
    """Edit name, email, username, phone, department, designation, role, school, status."""
    actor = get_current_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    if 'name' in data and data['name'].strip():
        user.name = data['name'].strip()

    if 'email' in data:
        new_email = data['email'].strip().lower()
        conflict  = User.query.filter(
            sqlfunc.lower(User.email) == new_email,
            User.id != user_id
        ).first()
        if conflict:
            return jsonify({'error': 'Email already used by another user'}), 409
        user.email = new_email

    if 'username' in data:
        new_uname = (data['username'] or '').strip().lower() or None
        if new_uname:
            conflict = User.query.filter(
                sqlfunc.lower(User.username) == new_uname,
                User.id != user_id
            ).first()
            if conflict:
                return jsonify({'error': 'Username already taken'}), 409
        user.username = new_uname

    for field in ('phone', 'department', 'designation'):
        if field in data:
            setattr(user, field, (data[field] or '').strip() or None)

    if 'role' in data:
        try:
            user.role = UserRole(data['role'])
        except ValueError:
            return jsonify({'error': f"Invalid role: {data['role']}"}), 400

    if 'school_id' in data:
        user.school_id = int(data['school_id']) if data['school_id'] else None

    if 'is_active' in data:
        new_is_active = bool(data['is_active'])
        if new_is_active != user.is_active:
            # Only run the guard when the status is actually changing --
            # re-saving the form with the same value shouldn't 403 just
            # because the actor can't manage this target's status.
            blocked = _hierarchy_guard(actor, user, action='activate/deactivate')
            if blocked:
                return blocked
        user.is_active = new_is_active

    db.session.commit()
    return jsonify(user.to_dict_with_credentials()), 200


# NEW
def _hierarchy_guard(actor, user, action='modify'):
    """
    Shared hierarchy + protected-role guard for ANY action that changes a
    user's standing (delete, activate/deactivate, ...). Returns None if the
    action is allowed, or a (response, status) tuple to return immediately
    if it's blocked.

    BUGFIX (2026-07): this used to live only inside delete_user() -- toggle_user
    and update_user's is_active branch had *no* check at all beyond the route's
    @role_required('SUPER_ADMIN'), which only proves the actor holds the
    SUPER_ADMIN key -- including via a TEMPORARY DELEGATION. A Team Lead
    delegated SUPER_ADMIN for one task could therefore activate/deactivate
    a CEO or the real Super Admin, because nothing compared actual
    hierarchy_level or checked is_protected on the target. Centralizing the
    check here and calling it from all three places closes that gap
    everywhere at once, instead of three separate copies drifting apart.

    Company-side target (school_id is None): checked via can_manage_role()
    using their UserRoleAssignment roles -- this is what makes CEO
    un-modifiable-by-anyone-except-CEO and lets a Sub Admin manage a
    Developer but never a CEO, without any hardcoded role-name check here.
    can_manage_role() compares real hierarchy_level and blocks is_protected
    targets outright, so a temporarily-delegated SUPER_ADMIN still can't
    out-rank an actual CEO/Super Admin the way a bare role-name check would.

    School-side targets keep the simpler legacy guard (unchanged) since
    Principal-side management has its own dedicated flow in principal.py.
    """
    if user.id == actor.id:
        return jsonify({'error': f'Cannot {action} your own account'}), 403

    if user.school_id is None:
        target_roles = get_user_roles(user)
        if not target_roles:
            # No platform role assigned yet — fall back to the old rule
            # rather than allowing an unchecked action.
            if user.role == UserRole.SUPER_ADMIN:
                return jsonify({'error': f'Cannot {action} this account — no role assignment found to verify hierarchy'}), 403
        else:
            actor_roles = get_user_roles(actor)
            if not can_manage_role(actor_roles, target_roles):
                return jsonify({'error': f'You do not have sufficient hierarchy to {action} this user'}), 403
    else:
        if user.role == UserRole.SUPER_ADMIN:
            return jsonify({'error': f'Cannot {action} Super Admin'}), 403

    return None


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@role_required('SUPER_ADMIN')
def delete_user(user_id):
    """Hierarchy-gated delete -- see _hierarchy_guard() docstring above."""
    actor = get_current_user()
    user = User.query.get_or_404(user_id)

    blocked = _hierarchy_guard(actor, user, action='delete')
    if blocked:
        return blocked

    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'}), 200


@admin_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
@role_required('SUPER_ADMIN')
def toggle_user(user_id):
    """Hierarchy-gated activate/deactivate -- see _hierarchy_guard() docstring above."""
    actor = get_current_user()
    user = User.query.get_or_404(user_id)

    blocked = _hierarchy_guard(actor, user, action='activate/deactivate')
    if blocked:
        return blocked

    user.is_active = not user.is_active
    db.session.commit()
    return jsonify({
        'is_active': user.is_active,
        'message': 'User ' + ('activated' if user.is_active else 'deactivated'),
    }), 200


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['PUT'])
@role_required('SUPER_ADMIN')
def reset_user_password(user_id):
    """
    Admin resets a user's password.
    Body: { "password": "NewPass@123" }  (optional — defaults to EduErp@123)
    Returns the plain password so admin can share with user.
    """
    user     = User.query.get_or_404(user_id)
    data     = request.get_json() or {}
    plain_pw = (data.get('password') or '').strip() or 'EduErp@123'

    user.set_password(plain_pw, store_plain=True)
    db.session.commit()

    return jsonify({
        'message':           'Password reset successful',
        'plain_password_temp': user.plain_password_temp,
        'username':          user.username,
        'email':             user.email,
    }), 200


@admin_bp.route('/users/<int:user_id>/assign-role', methods=['PUT'])
@role_required('SUPER_ADMIN')
def assign_role(user_id):
    """
    Quick role change without full edit.

    BUGFIX (2026-07): previously had ZERO checks beyond @role_required
    ('SUPER_ADMIN') -- same class of gap as toggle_user/update_user before
    they were fixed. Role reassignment is actually the MOST sensitive of
    the three (it can hand someone SUPER_ADMIN outright), so it needs both:
      1. _hierarchy_guard() -- actor must outrank the TARGET's current
         standing (blocks touching a senior/protected user, and self-change).
      2. An escalation check -- actor must also outrank the NEW role being
         assigned, otherwise a borderline actor could "promote" someone
         into a role senior to themselves even without being able to touch
         their current role.
    """
    actor = get_current_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    try:
        new_role = UserRole(data['role'])
    except (ValueError, KeyError):
        return jsonify({'error': 'Invalid role'}), 400

    blocked = _hierarchy_guard(actor, user, action='change the role of')
    if blocked:
        return blocked

    # Escalation check: can the actor manage the role being ASSIGNED, not
    # just the user's current role? Only meaningful for roles that exist
    # in the new platform_roles table (company-scope roles, e.g.
    # SUPER_ADMIN/CEO/... via _resolve_creation_role's key convention) --
    # legacy school-side enum values with no platform Role row (most
    # TEACHER/STUDENT/etc. assignments) fall through unchecked, same as
    # before this fix, since they were never part of the hierarchy engine.
    target_platform_role = Role.query.filter_by(key=new_role.value).first()
    if target_platform_role:
        actor_roles = get_user_roles(actor)
        if not can_manage_role(actor_roles, [target_platform_role]):
            return jsonify({
                'error': f"You do not have sufficient hierarchy to assign the '{new_role.value}' role"
            }), 403

    user.role = new_role

    # SUPER_ADMIN has no school
    if user.role == UserRole.SUPER_ADMIN:
        user.school_id = None

    db.session.commit()
    return jsonify(user.to_dict()), 200



# ─── Stats ────────────────────────────────────────────────────────────────────

@admin_bp.route('/stats', methods=['GET'])
@role_required('SUPER_ADMIN')
def admin_stats():
    return jsonify({
        'total_schools':  School.query.filter_by(is_active=True).count(),
        'total_users':    User.query.count(),
        'total_students': User.query.filter_by(role=UserRole.STUDENT).count(),
        'total_teachers': User.query.filter_by(role=UserRole.TEACHER).count(),
    }), 200
