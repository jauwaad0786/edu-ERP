from flask import Blueprint, request, jsonify
from app import limiter
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from sqlalchemy import func as sqlfunc
from app import db
from app.models.user import User, UserRole
from app.models.academic import Student
from app.models.rbac import resolve_platform_permissions, get_user_roles, get_active_role
from app.services.permission_resolver import ensure_role_assignment_for_user
from datetime import datetime
import re

auth_bp = Blueprint('auth', __name__)


def _serialize_user(user):
    # Heal any user still missing a UserRoleAssignment (e.g. staff created
    # before this fix, or created via a flow that doesn't wire it yet) —
    # idempotent, cheap (one query, only writes if actually missing).
    if ensure_role_assignment_for_user(user):
        db.session.commit()

    data = user.to_dict()
    roles = get_user_roles(user)
    data['is_super']    = any(r.is_super for r in roles)
    data['permissions'] = sorted(resolve_platform_permissions(user, school_id=user.school_id))

    # user.role (legacy enum) is ALWAYS 'SUPER_ADMIN' for every company
    # employee -- CEO, Intern, Sales, Developer, all of them (see admin.py's
    # _resolve_creation_role, which uses it as a generic "company account"
    # marker). Frontend code that switched on user.role to decide dashboard/
    # sidebar/permission-bypass was therefore treating every company
    # employee as a Super Admin. active_role is the real identity, from
    # platform_roles via UserRoleAssignment -- this is what DashboardRouter,
    # Sidebar, and usePermission should key off for company-side users.
    active_role = get_active_role(user)
    data['active_role'] = active_role.to_dict() if active_role else None

    return data


def _normalise(s):
    """Lowercase + collapse all whitespace to single space + strip."""
    return re.sub(r'\s+', ' ', (s or '').strip()).lower()


# ── Regular login (staff / principal / admin / driver) ────────────────────────
@auth_bp.route('/login', methods=['POST'])
@limiter.limit("20 per minute")
def login():
    """
    Accepts email, username, or phone / mobile number in the 'identifier' field.
    Also accepts legacy 'email' or 'mobile_number' field for backward compatibility.
    """
    from app.models.transport import Driver

    data = request.get_json() or {}

    raw_identifier = (
        data.get('identifier') or data.get('email') or data.get('mobile_number') or data.get('phone') or ''
    ).strip()
    identifier = raw_identifier.lower()
    password = data.get('password', '')

    if not raw_identifier or not password:
        return jsonify({'error': 'Identifier and password required'}), 400

    # 1. Try email first
    user = User.query.filter(
        sqlfunc.lower(User.email) == identifier
    ).first()

    # 2. Try username
    if not user:
        user = User.query.filter(
            sqlfunc.lower(User.username) == identifier
        ).first()

    # 3. Try phone/mobile number on User model
    if not user:
        clean_phone = re.sub(r'\D', '', raw_identifier)
        user = User.query.filter(User.phone == raw_identifier).first()
        if not user and clean_phone and len(clean_phone) >= 10:
            user = User.query.filter(User.phone.endswith(clean_phone[-10:])).first()

    # 4. Try Driver profile mobile_number lookup
    if not user:
        clean_phone = re.sub(r'\D', '', raw_identifier)
        driver = Driver.query.filter(Driver.mobile_number == raw_identifier).first()
        if not driver and clean_phone and len(clean_phone) >= 10:
            driver = Driver.query.filter(Driver.mobile_number.endswith(clean_phone[-10:])).first()
        if driver and driver.user_id:
            user = db.session.get(User, driver.user_id)

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account deactivated. Contact your administrator.'}), 403

    user.touch_last_login()
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        
        'user':          _serialize_user(user),
    }), 200


# ── Student login ─────────────────────────────────────────────────────────────
@auth_bp.route('/student-login', methods=['POST'])
@limiter.limit("10 per minute")
def student_login():
    """
    Login via: parent mobile + student name + password.

    Handles same-phone siblings correctly:
      - parent_phone uniquely finds all students under that phone
      - student name matched after normalising (lowercase + collapse spaces)
      - father_name is NOT required anymore (name alone distinguishes siblings)
        but still accepted as an optional tiebreaker if two kids have the same name.
    """
    data = request.get_json() or {}

    phone    = (data.get('phone') or '').strip()
    raw_name = data.get('name') or ''
    password = data.get('password', '')

    # optional tiebreaker
    father_raw = data.get('father_name') or ''

    if not phone or not raw_name or not password:
        return jsonify({'error': 'Phone, name, and password are required'}), 400

    norm_name   = _normalise(raw_name)
    norm_father = _normalise(father_raw)

    # All students whose parent uses this phone number
    candidates = (
        Student.query
        .filter_by(parent_phone=phone)
        .all()
    )

    if not candidates:
        return jsonify({'error': 'No student found with this mobile number'}), 404

    matched = []
    for s in candidates:
        s_name = _normalise(s.user.name if s.user else '')
        if s_name == norm_name:
            matched.append(s)

    if len(matched) == 0:
        return jsonify({'error': 'Student name does not match. Check spelling.'}), 404

    # Multiple students with identical name under same phone → use father_name
    if len(matched) > 1:
        if not norm_father:
            return jsonify({
                'error': 'Multiple students found with this name. '
                         'Please provide father_name to identify correctly.'
            }), 409

        refined = []
        for s in matched:
            s_father = _normalise(s.father_name or '')
            if s_father == norm_father:
                refined.append(s)

        if len(refined) == 0:
            return jsonify({'error': 'Father name does not match any record.'}), 404
        if len(refined) > 1:
            return jsonify({
                'error': 'Could not uniquely identify student. Contact school admin.'
            }), 409

        matched = refined

    student = matched[0]
    user    = User.query.get(student.user_id)

    if not user:
        return jsonify({'error': 'User account not found. Contact school admin.'}), 404

    if not user.check_password(password):
        return jsonify({'error': 'Incorrect password'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account deactivated. Contact your school.'}), 403

    user.touch_last_login()
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'access_token':  access_token,
        'refresh_token': refresh_token,
        'user':          user.to_dict(),
    }), 200


# ── /me ───────────────────────────────────────────────────────────────────────
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(_serialize_user(user)), 200


# ── Refresh ───────────────────────────────────────────────────────────────────
@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id      = get_jwt_identity()
    access_token = create_access_token(identity=str(user_id))
    return jsonify({'access_token': access_token}), 200


# ── My salary records (Teacher OR any non-teaching staff) ─────────────────────
# NEW — "Payment ke baad ek button jo staff/teacher 'yes, received' bol sake."
# Role-agnostic on purpose: a Teacher has a Teacher profile (SalaryRecord),
# everyone else (Accountant, Hostel Warden, etc.) is a plain User row
# (StaffSalaryRecord). Ownership is checked by matching to the JWT-identified
# user, never by trusting an id the client sends without a match.
@auth_bp.route('/me/salary-records', methods=['GET'])
@jwt_required()
def my_salary_records():
    from app.models.academic import Teacher
    from app.models.financial import SalaryRecord
    from app.models.finance import StaffSalaryRecord

    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    out = []
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if teacher:
        for r in SalaryRecord.query.filter_by(teacher_id=teacher.id) \
                 .order_by(SalaryRecord.payment_date.desc()).all():
            d = r.to_dict()
            d['type'] = 'TEACHER'
            out.append(d)
    else:
        for r in StaffSalaryRecord.query.filter_by(user_id=user.id) \
                 .order_by(StaffSalaryRecord.payment_date.desc()).all():
            d = r.to_dict()
            d['type'] = 'STAFF'
            out.append(d)

    return jsonify(out), 200


@auth_bp.route('/me/salary-records/<record_type>/<int:record_id>/acknowledge', methods=['POST'])
@jwt_required()
def acknowledge_salary_record(record_type, record_id):
    """record_type: 'teacher' or 'staff' — matches which table to check."""
    from app.models.academic import Teacher
    from app.models.financial import SalaryRecord
    from app.models.finance import StaffSalaryRecord

    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if record_type.upper() == 'TEACHER':
        teacher = Teacher.query.filter_by(user_id=user.id).first()
        rec = SalaryRecord.query.get(record_id) if teacher else None
        if not rec or not teacher or rec.teacher_id != teacher.id:
            return jsonify({'error': 'Record not found or does not belong to you'}), 404
    elif record_type.upper() == 'STAFF':
        rec = StaffSalaryRecord.query.get(record_id)
        if not rec or rec.user_id != user.id:
            return jsonify({'error': 'Record not found or does not belong to you'}), 404
    else:
        return jsonify({'error': 'Invalid record_type'}), 400

    rec.is_acknowledged = True
    rec.acknowledged_at = datetime.utcnow()
    db.session.commit()

    return jsonify(rec.to_dict()), 200


# ── Change own password ───────────────────────────────────────────────────────
@auth_bp.route('/change-password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    data    = request.get_json() or {}

    old_pw = data.get('old_password', '')
    new_pw = data.get('new_password', '')

    if not new_pw or len(new_pw) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    if not user.check_password(old_pw):
        return jsonify({'error': 'Current password is incorrect'}), 400

    # store_plain=False → clears plain_password_temp
    user.set_password(new_pw, store_plain=False)
    db.session.commit()

    return jsonify({'message': 'Password updated successfully'}), 200


# ── Forgot password (admin-handled) ──────────────────────────────────────────
@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password():
    return jsonify({
        'message': (
            'Password resets are handled by your administrator. '
            'Please contact your school admin to reset your password.'
        )
    }), 200
