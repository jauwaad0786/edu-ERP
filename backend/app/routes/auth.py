from flask import Blueprint, request, jsonify
from app import limiter, db, bcrypt
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from sqlalchemy import func as sqlfunc
from app.models.user import User, UserRole
from app.models.academic import Student
from app.models.rbac import resolve_platform_permissions, get_user_roles, get_active_role
from app.services.permission_resolver import ensure_role_assignment_for_user
import logging
import re
from datetime import datetime
from app.utils.timezone_util import utc_now

from app.models.otp import OTPPurpose
from app.services.communication.msg91_service import MSG91Service
from app.services.communication.otp_service import OTPService

logger = logging.getLogger('auth')
auth_bp = Blueprint('auth', __name__)

# Pre-computed dummy hash to prevent timing-based user enumeration attacks
DUMMY_BCRYPT_HASH = "$2b$12$e8YQ3L8R7F6dY5Vv4C3b2uK1o9I8U7Y6T5R4E3W2Q1Z0P9O8N7M6L"


def _extract_client_meta():
    """Extract client IP, browser, and OS for audit and security tracking."""
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or '')
    if ',' in ip:
        ip = ip.split(',')[0].strip()
    ua = request.headers.get('User-Agent', '')
    browser = 'Unknown'
    os_name = 'Unknown'
    if 'Chrome' in ua and 'Edg' not in ua:
        browser = 'Chrome'
    elif 'Safari' in ua and 'Chrome' not in ua:
        browser = 'Safari'
    elif 'Firefox' in ua:
        browser = 'Firefox'
    elif 'Edg' in ua:
        browser = 'Edge'

    if 'Windows' in ua:
        os_name = 'Windows'
    elif 'Macintosh' in ua:
        os_name = 'macOS'
    elif 'Linux' in ua and 'Android' not in ua:
        os_name = 'Linux'
    elif 'Android' in ua:
        os_name = 'Android'
    elif 'iPhone' in ua or 'iPad' in ua:
        os_name = 'iOS'

    return {'ip_address': ip[:45], 'browser': browser, 'os': os_name}


def _record_login_attempt(user=None, identifier='', success=False, failure_reason=None, school_id=None):
    """Safely log every login attempt without failing the request if logging table fails."""
    try:
        from app.models.audit import LoginHistory
        meta = _extract_client_meta()
        history = LoginHistory(
            user_id=user.id if user else None,
            identifier_attempted=str(identifier)[:120],
            school_id=school_id or (user.school_id if user else None),
            success=success,
            failure_reason=failure_reason,
            ip_address=meta.get('ip_address'),
            browser=meta.get('browser'),
            os=meta.get('os')
        )
        db.session.add(history)
        db.session.commit()
    except Exception as ex:
        logger.warning(f"Login history logging failed: {ex}")
        try:
            db.session.rollback()
        except Exception:
            pass

    # Enterprise Audit Trail integration
    try:
        eff_school_id = school_id or (user.school_id if user else None)
        if eff_school_id and user:
            from app.services.audit_service import record_audit_event
            if success:
                record_audit_event(
                    school_id=eff_school_id,
                    actor_user_id=user.id,
                    action='LOGIN_SUCCESS',
                    module='auth',
                    entity_type='User',
                    entity_id=user.id,
                    remarks=f"User {user.name or user.username} logged in successfully",
                    status='SUCCESS',
                    severity='LOW'
                )
            else:
                record_audit_event(
                    school_id=eff_school_id,
                    actor_user_id=user.id,
                    action='LOGIN_FAILED',
                    module='auth',
                    entity_type='User',
                    entity_id=user.id,
                    remarks=f"Login failed for identifier '{str(identifier)[:60]}': {failure_reason or 'UNKNOWN'}",
                    status='FAILURE',
                    severity='MEDIUM'
                )
    except Exception as ex:
        logger.warning(f"Audit log recording in _record_login_attempt failed: {ex}")


def _is_email(identifier):
    """Detect whether identifier is an email address."""
    s = str(identifier or '').strip()
    return '@' in s and '.' in s


def _find_user_by_identifier(raw_identifier):
    """Find user by email, username, phone, Driver mobile number, or Student parent phone."""
    from app.models.transport import Driver
    from app.models.academic import Student

    if not raw_identifier:
        return None

    raw_str = str(raw_identifier).strip()
    identifier = raw_str.lower()

    # 1. Try email
    user = User.query.filter(sqlfunc.lower(User.email) == identifier).first()
    if user:
        return user

    # 2. Try username
    user = User.query.filter(sqlfunc.lower(User.username) == identifier).first()
    if user:
        return user

    # 3. Try phone/mobile number on User model
    clean_phone = re.sub(r'\D', '', raw_str)
    user = User.query.filter(User.phone == raw_str).first()
    if not user and clean_phone and len(clean_phone) >= 10:
        last10 = clean_phone[-10:]
        user = User.query.filter(
            User.phone.endswith(last10),
            User.role.in_([UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.VICE_PRINCIPAL, UserRole.TEACHER, UserRole.ACCOUNTANT])
        ).first()
        if not user:
            user = User.query.filter(User.phone.endswith(last10)).first()
        if not user:
            user = User.query.filter(User.phone.ilike(f"%{last10}")).first()
    if user:
        return user

    # 3.5 Try Employee ID on User or Teacher
    user_emp = User.query.filter(sqlfunc.lower(User.employee_id) == identifier).first()
    if user_emp:
        return user_emp

    from app.models.academic import Teacher
    teacher_emp = Teacher.query.filter(sqlfunc.lower(Teacher.employee_id) == identifier).first()
    if teacher_emp and teacher_emp.user_id:
        tu = db.session.get(User, teacher_emp.user_id) if hasattr(db.session, 'get') else User.query.get(teacher_emp.user_id)
        if tu:
            return tu

    # 4. Try Driver profile mobile_number lookup
    if clean_phone and len(clean_phone) >= 10:
        last10 = clean_phone[-10:]
        driver = Driver.query.filter(Driver.mobile_number == raw_str).first()
        if not driver:
            driver = Driver.query.filter(Driver.mobile_number.endswith(last10)).first()
        if driver and driver.user_id:
            user = db.session.get(User, driver.user_id)
            if user:
                return user

        # Try EmployeeProfile emergency_contact
        from app.models.hrms import EmployeeProfile
        emp_prof = EmployeeProfile.query.filter(
            (EmployeeProfile.emergency_contact == raw_str) |
            (EmployeeProfile.emergency_contact.endswith(last10))
        ).first()
        if emp_prof and emp_prof.user_id:
            user = db.session.get(User, emp_prof.user_id) if hasattr(db.session, 'get') else User.query.get(emp_prof.user_id)
            if user:
                return user

    # 5. Try Student parent_phone / guardian_phone lookup
    if clean_phone and len(clean_phone) >= 10:
        last10 = clean_phone[-10:]
        student = Student.query.filter(
            (Student.parent_phone == raw_str) |
            (Student.parent_phone.endswith(last10)) |
            (Student.guardian_phone == raw_str) |
            (Student.guardian_phone.endswith(last10))
        ).first()
        if student and student.user_id:
            user = db.session.get(User, student.user_id)
            if user:
                return user

    return None


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

    if user.school:
        data['school'] = user.school.to_dict()
        data['current_session'] = user.school.current_session
        data['school_name'] = user.school.name
        data['school_code'] = user.school.code
        data['school_city'] = user.school.city

    return data


def _normalise(s):
    """Lowercase + collapse all whitespace to single space + strip."""
    return re.sub(r'\s+', ' ', (s or '').strip()).lower()


# ── Unified login (all roles: Student, Parent, Teacher, Staff, Driver, Principal, Admin) ────
@auth_bp.route('/login', methods=['POST'])
@limiter.limit("20 per minute")
def login():
    """
    Unified authentication for ALL ERP roles.
    Accepts Email, Mobile Number, or Username in the 'identifier' field.
    Resolves Staff, Teachers, Principals, Super Admins, Drivers, and Students/Parents.
    """
    from app.models.transport import Driver
    from app.models.academic import Student

    data = request.get_json() or {}

    raw_identifier = (
        data.get('identifier') or data.get('email') or data.get('mobile_number') or data.get('phone') or ''
    ).strip()
    identifier = raw_identifier.lower()
    password = data.get('password', '')

    if not raw_identifier or not password:
        return jsonify({'error': 'Identifier and password required'}), 400

    candidates = []

    # 1. Direct email lookup
    user_email = User.query.filter(sqlfunc.lower(User.email) == identifier).first()
    if user_email and user_email not in candidates:
        candidates.append(user_email)

    # 2. Direct username lookup
    user_uname = User.query.filter(sqlfunc.lower(User.username) == identifier).first()
    if user_uname and user_uname not in candidates:
        candidates.append(user_uname)

    # 2.5 Direct Employee ID lookup on User and Teacher
    emp_users = User.query.filter(sqlfunc.lower(User.employee_id) == identifier).all()
    for u in emp_users:
        if u not in candidates:
            candidates.append(u)

    from app.models.academic import Teacher
    t_emps = Teacher.query.filter(sqlfunc.lower(Teacher.employee_id) == identifier).all()
    for t in t_emps:
        if t.user_id:
            tu = db.session.get(User, t.user_id) if hasattr(db.session, 'get') else User.query.get(t.user_id)
            if tu and tu not in candidates:
                candidates.append(tu)

    # 3. Direct User phone lookup
    clean_phone = re.sub(r'\D', '', raw_identifier)
    phone_users = User.query.filter(User.phone == raw_identifier).all()
    for u in phone_users:
        if u not in candidates:
            candidates.append(u)

    if clean_phone and len(clean_phone) >= 10:
        last10 = clean_phone[-10:]
        p_users = User.query.filter(
            (User.phone.endswith(last10)) | (User.phone == clean_phone)
        ).all()
        for u in p_users:
            if u not in candidates:
                candidates.append(u)

        # 3.5 EmployeeProfile emergency contact lookup
        from app.models.hrms import EmployeeProfile
        emp_profs = EmployeeProfile.query.filter(
            (EmployeeProfile.emergency_contact == raw_identifier) |
            (EmployeeProfile.emergency_contact.endswith(last10))
        ).all()
        for ep in emp_profs:
            if ep.user_id:
                ep_u = db.session.get(User, ep.user_id) if hasattr(db.session, 'get') else User.query.get(ep.user_id)
                if ep_u and ep_u not in candidates:
                    candidates.append(ep_u)

        # 4. Driver profile mobile lookup
        drivers = Driver.query.filter(
            (Driver.mobile_number == raw_identifier) |
            (Driver.mobile_number.endswith(last10)) |
            (Driver.mobile_number == clean_phone)
        ).all()
        for d in drivers:
            if d.user_id:
                du = db.session.get(User, d.user_id) if hasattr(db.session, 'get') else User.query.get(d.user_id)
                if du and du not in candidates:
                    candidates.append(du)

        # 5. Student parent/guardian phone lookup (handles sibling accounts with shared parent phone)
        students = Student.query.filter(
            (Student.parent_phone == raw_identifier) |
            (Student.parent_phone.endswith(last10)) |
            (Student.guardian_phone == raw_identifier) |
            (Student.guardian_phone.endswith(last10))
        ).all()
        for s in students:
            if s.user_id:
                su = db.session.get(User, s.user_id) if hasattr(db.session, 'get') else User.query.get(s.user_id)
                if su and su not in candidates:
                    candidates.append(su)

    # Find the candidate matching the password
    matched_user = None
    if candidates:
        for c in candidates:
            if c.check_password(password):
                matched_user = c
                break
            elif password == '12345' and (c.check_password('Staff@123') or c.check_password('Teacher@123') or c.check_password('Student@123')):
                # Automatically migrate legacy default password to requested 12345
                c.set_password('12345', store_plain=True)
                try:
                    db.session.commit()
                except Exception as ex:
                    db.session.rollback()
                    logger.warning(f"Failed to auto-migrate password to 12345: {ex}")
                matched_user = c
                break
            elif password in ('Staff@123', 'Teacher@123', 'Student@123') and c.check_password('12345'):
                matched_user = c
                break

    if not matched_user:
        # Constant-time dummy verification to protect against timing analysis attacks
        try:
            bcrypt.check_password_hash(DUMMY_BCRYPT_HASH, password)
        except Exception:
            pass
        _record_login_attempt(user=None, identifier=raw_identifier, success=False, failure_reason='INVALID_CREDENTIALS')
        return jsonify({'error': 'Invalid credentials'}), 401

    user = matched_user

    # School status check
    if user.school_id:
        from app.models.school import School
        user_school = db.session.get(School, user.school_id) if hasattr(db.session, 'get') else School.query.get(user.school_id)
        if user_school:
            status = (getattr(user_school, 'status', None) or '').upper()
            if status == 'SUSPENDED':
                _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='SCHOOL_SUSPENDED')
                return jsonify({'error': 'This school account has been suspended. Please contact the administrator.'}), 403
            if status == 'ARCHIVED':
                _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='SCHOOL_ARCHIVED')
                return jsonify({'error': 'This school account is currently archived. Please contact the administrator.'}), 403
            if status == 'INACTIVE':
                _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='SCHOOL_INACTIVE')
                return jsonify({'error': 'This school account is inactive. Please contact the administrator.'}), 403
            if status in ('DRAFT', 'ONBOARDING'):
                _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='SCHOOL_ONBOARDING')
                return jsonify({'error': 'This school onboarding is not complete. Please contact the administrator.'}), 403
            if not user_school.is_active:
                _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='SCHOOL_DEACTIVATED')
                return jsonify({'error': 'This school is currently deactivated. Please contact the administrator.'}), 403

    user_status = (getattr(user, 'account_status', None) or ('ACTIVE' if user.is_active else 'INACTIVE')).upper()
    if user_status == 'SUSPENDED':
        _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='ACCOUNT_SUSPENDED')
        return jsonify({'error': 'Account suspended. Contact your administrator.'}), 403
    if user_status in ('INACTIVE', 'DEACTIVATED') or not user.is_active or getattr(user, 'is_deleted', False):
        _record_login_attempt(user=user, identifier=raw_identifier, success=False, failure_reason='ACCOUNT_DEACTIVATED')
        return jsonify({'error': 'Account deactivated. Contact your administrator.'}), 403

    user.touch_last_login()
    _record_login_attempt(user=user, identifier=raw_identifier, success=True, failure_reason=None)
    db.session.commit()

    token_ver = getattr(user, 'token_version', 0) or 0
    access_token  = create_access_token(identity=str(user.id), additional_claims={'token_version': token_ver})
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims={'token_version': token_ver})

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

    if student.school_id:
        from app.models.school import School
        student_school = School.query.get(student.school_id)
        if student_school and getattr(student_school, 'status', None) == 'ARCHIVED':
            return jsonify({'error': 'This school account is currently archived. Please contact the administrator.'}), 403

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
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id)) if hasattr(db.session, 'get') else User.query.get(int(user_id))
    token_ver = getattr(user, 'token_version', 0) or 0 if user else 0
    access_token = create_access_token(identity=str(user_id), additional_claims={'token_version': token_ver})
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
    rec.acknowledged_at = utc_now()
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

    # store_plain=False → clears plain_password_temp and increments token_version
    user.set_password(new_pw, store_plain=False)
    db.session.commit()

    try:
        from app.services.audit_service import record_audit_event
        if user.school_id:
            record_audit_event(
                school_id=user.school_id,
                actor_user_id=user.id,
                action='PASSWORD_CHANGE',
                module='auth',
                entity_type='User',
                entity_id=user.id,
                remarks='User changed own password',
                status='SUCCESS',
                severity='MEDIUM'
            )
        else:
            from app.models.audit import log_company_action
            log_company_action(
                actor_user=user,
                module='auth',
                action='PASSWORD_CHANGE',
                remarks='Company user changed own password',
                request_meta=_extract_client_meta()
            )
            db.session.commit()
    except Exception as ex:
        logger.warning(f"Audit log failed for password change: {ex}")

    return jsonify({'message': 'Password updated successfully'}), 200


# ── Send Login OTP ────────────────────────────────────────────────────────────
@auth_bp.route('/send-login-otp', methods=['POST'])
@limiter.limit("10 per minute")
def send_login_otp():
    """
    POST /api/v1/auth/send-login-otp
    Accepts identifier (mobile or email).
    Sends 6-digit OTP via MSG91 Mobile OTP API.
    Returns safe generic message or non-200 if MSG91 fails.
    """
    logger.info("[OTP] Request received: /send-login-otp")
    data = request.get_json() or {}
    raw_identifier = (data.get('identifier') or data.get('mobile_number') or data.get('email') or '').strip()

    if not raw_identifier:
        logger.warning("[OTP] Missing identifier in send-login-otp")
        return jsonify({'success': False, 'message': 'Mobile number is required'}), 400

    # 1. If email is provided, check if email service is available
    if _is_email(raw_identifier):
        if not MSG91Service.is_email_configured():
            logger.info("[OTP] Email OTP attempted while domain unconfigured")
            return jsonify({
                'success': False,
                'message': 'Email OTP is currently unavailable. Please use mobile OTP.'
            }), 400

    # 2. Find user
    user = _find_user_by_identifier(raw_identifier)
    if not user or not user.is_active:
        logger.warning("[OTP] Account not found or inactive for identifier")
        return jsonify({
            'success': False,
            'message': 'No account found with this mobile number. Please contact your school administrator.'
        }), 404

    # 3. Mobile OTP is the primary channel
    target_mobile = user.phone or (None if _is_email(raw_identifier) else raw_identifier)
    if target_mobile:
        logger.info("[OTP] Sending OTP request to MSG91")
        dispatch_res = OTPService.send_mobile_otp(
            mobile=target_mobile,
            purpose=OTPPurpose.LOGIN,
            user_id=user.id,
            school_id=user.school_id
        )
        success = dispatch_res[0]
        msg = dispatch_res[1]
        status_code = dispatch_res[2]
        dev_otp = getattr(dispatch_res, 'dev_otp', None)

        if not success:
            return jsonify({'success': False, 'message': msg}), status_code

        resp_data = {
            'success': True,
            'message': 'If the mobile number is registered, an OTP has been sent.'
        }
        if dev_otp:
            resp_data['dev_otp'] = dev_otp
            resp_data['message'] = f'OTP sent successfully. (Dev OTP: {dev_otp})'

        return jsonify(resp_data), 200

    # 4. If only email exists and email is configured
    if user.email and MSG91Service.is_email_configured():
        success, msg, status_code = OTPService.send_email_otp(
            email=user.email,
            purpose=OTPPurpose.LOGIN,
            user_id=user.id,
            school_id=user.school_id
        )
        if not success:
            return jsonify({'success': False, 'message': msg}), status_code

        return jsonify({
            'success': True,
            'message': 'If the account exists, an OTP has been sent.'
        }), 200

    return jsonify({
        'success': False,
        'message': 'Email OTP is currently unavailable. Please use mobile OTP.'
    }), 400


# ── Verify Login OTP ──────────────────────────────────────────────────────────
@auth_bp.route('/verify-otp', methods=['POST'])
@limiter.limit("20 per minute")
def verify_otp():
    """
    POST /api/v1/auth/verify-otp
    Accepts identifier and 6-digit otp.
    Validates attempt limits, expiration, consumes OTP.
    Returns access_token, refresh_token, and serialized user.
    """
    logger.info("[OTP] Request received: /verify-otp")
    data = request.get_json() or {}
    raw_identifier = (data.get('identifier') or data.get('mobile_number') or data.get('email') or '').strip()
    otp = (data.get('otp') or '').strip()

    if not raw_identifier or not otp:
        return jsonify({'error': 'Identifier and OTP are required'}), 400

    user = _find_user_by_identifier(raw_identifier)
    user_id = user.id if user else None

    is_valid, msg, record = OTPService.verify_otp(
        identifier=raw_identifier,
        raw_otp=otp,
        purpose=OTPPurpose.LOGIN,
        user_id=user_id
    )

    if not is_valid:
        return jsonify({'error': msg}), 400

    if not user and record and record.user_id:
        user = User.query.get(record.user_id)
    if not user:
        user = _find_user_by_identifier(raw_identifier)

    if not user:
        return jsonify({'error': 'Account not found. Please contact your school administrator.'}), 404

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


# ── Verify MSG91 Widget OTP Access Token ────────────────────────────────────────
@auth_bp.route('/verify-widget-otp', methods=['POST'])
@limiter.limit("20 per minute")
def verify_widget_otp():
    """
    POST /api/v1/auth/verify-widget-otp
    Accepts access_token from client-side MSG91 OTP Widget.
    Verifies token server-side via MSG91 verifyAccessToken API.
    Resolves user by verified mobile and creates authenticated session.
    """
    logger.info("[OTP] Request received: /verify-widget-otp")
    data = request.get_json() or {}
    access_token = (data.get('access_token') or data.get('accessToken') or data.get('token') or '').strip()
    client_identifier = (data.get('identifier') or data.get('mobile_number') or '').strip()

    if not access_token:
        logger.warning("[OTP] Widget verification attempt missing access_token")
        return jsonify({'error': 'Widget access token is required'}), 400

    verify_res = MSG91Service.verify_widget_access_token(access_token)
    if not verify_res.get('success'):
        logger.error(f"[OTP] Widget token verification rejected: {verify_res.get('message')}")
        return jsonify({'error': verify_res.get('message', 'Invalid OTP verification token')}), 400

    verified_mobile = verify_res.get('mobile') or client_identifier
    logger.info("[OTP] MSG91 Widget access token successfully verified")

    user = None
    if verified_mobile:
        user = _find_user_by_identifier(verified_mobile)
    if not user and client_identifier:
        user = _find_user_by_identifier(client_identifier)

    if not user:
        logger.warning("[OTP] Account lookup failed for verified mobile number")
        return jsonify({
            'error': f'Verified mobile ({verified_mobile or "unknown"}) is not linked to any registered active account. Please contact your administrator.'
        }), 404

    if not user.is_active:
        logger.warning("[OTP] Account deactivated for verified user")
        return jsonify({'error': 'Account deactivated. Contact your administrator.'}), 403

    user.touch_last_login()
    db.session.commit()

    jwt_access  = create_access_token(identity=str(user.id))
    jwt_refresh = create_refresh_token(identity=str(user.id))

    logger.info(f"[OTP] Widget login completed successfully for user ID {user.id}")
    return jsonify({
        'access_token':  jwt_access,
        'refresh_token': jwt_refresh,
        'user':          _serialize_user(user),
    }), 200


# ── Resend OTP ────────────────────────────────────────────────────────────────
@auth_bp.route('/resend-otp', methods=['POST'])
@limiter.limit("10 per minute")
def resend_otp():
    """
    POST /api/v1/auth/resend-otp
    Resends OTP with cooldown enforcement.
    """
    data = request.get_json() or {}
    raw_identifier = (data.get('identifier') or data.get('mobile_number') or data.get('email') or '').strip()
    purpose = (data.get('purpose') or OTPPurpose.LOGIN).upper()

    if not raw_identifier:
        return jsonify({'success': False, 'message': 'Mobile number is required'}), 400

    if _is_email(raw_identifier):
        if not MSG91Service.is_email_configured():
            return jsonify({
                'success': False,
                'message': 'Email OTP is currently unavailable. Please use mobile OTP.'
            }), 400

    user = _find_user_by_identifier(raw_identifier)
    if not user or not user.is_active:
        return jsonify({
            'success': True,
            'message': 'If the mobile number is registered, a new OTP has been sent.'
        }), 200

    target_mobile = user.phone or (None if _is_email(raw_identifier) else raw_identifier)
    if target_mobile:
        dispatch_res = OTPService.send_mobile_otp(
            mobile=target_mobile,
            purpose=purpose,
            user_id=user.id,
            school_id=user.school_id
        )
        success = dispatch_res[0]
        msg = dispatch_res[1]
        status_code = dispatch_res[2]
        dev_otp = getattr(dispatch_res, 'dev_otp', None)

        if not success:
            return jsonify({'success': False, 'message': msg}), status_code

        resp_data = {
            'success': True,
            'message': 'If the mobile number is registered, a new OTP has been sent.'
        }
        if dev_otp:
            resp_data['dev_otp'] = dev_otp
            resp_data['message'] = f'OTP sent successfully. (Dev OTP: {dev_otp})'

        return jsonify(resp_data), 200

    if user.email and MSG91Service.is_email_configured():
        success, msg, status_code = OTPService.send_email_otp(
            email=user.email,
            purpose=purpose,
            user_id=user.id,
            school_id=user.school_id
        )
        if not success:
            return jsonify({'success': False, 'message': msg}), status_code

        return jsonify({
            'success': True,
            'message': 'If the account exists, a new OTP has been sent.'
        }), 200

    return jsonify({
        'success': False,
        'message': 'Email OTP is currently unavailable. Please use mobile OTP.'
    }), 400


# ── Forgot password (OTP-powered self-service) ───────────────────────────────
@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("5 per minute")
def forgot_password():
    """
    POST /api/v1/auth/forgot-password
    Generates password reset OTP for registered mobile number.
    """
    data = request.get_json() or {}
    raw_identifier = (data.get('identifier') or data.get('mobile_number') or data.get('email') or '').strip()

    if not raw_identifier:
        return jsonify({'success': False, 'message': 'Mobile number is required'}), 400

    if _is_email(raw_identifier):
        return jsonify({
            'success': False,
            'message': 'Email password reset is currently unavailable. Please use your registered mobile number.'
        }), 400

    user = _find_user_by_identifier(raw_identifier)
    if not user or not user.is_active:
        return jsonify({
            'success': True,
            'message': 'If the mobile number is registered, a password reset OTP has been sent.'
        }), 200

    target_mobile = user.phone or raw_identifier
    dispatch_res = OTPService.send_mobile_otp(
        mobile=target_mobile,
        purpose=OTPPurpose.PASSWORD_RESET,
        user_id=user.id,
        school_id=user.school_id
    )
    success = dispatch_res[0]
    msg = dispatch_res[1]
    status_code = dispatch_res[2]
    dev_otp = getattr(dispatch_res, 'dev_otp', None)

    if not success:
        return jsonify({'success': False, 'message': msg}), status_code

    resp_data = {
        'success': True,
        'message': 'If the mobile number is registered, a password reset OTP has been sent.'
    }
    if dev_otp:
        resp_data['dev_otp'] = dev_otp
        resp_data['message'] = f'Password reset OTP sent. (Dev OTP: {dev_otp})'

    return jsonify(resp_data), 200


# ── Reset password via OTP ───────────────────────────────────────────────────
@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("5 per minute")
def reset_password():
    """
    POST /api/v1/auth/reset-password
    Resets password after verifying PASSWORD_RESET OTP.
    """
    data = request.get_json() or {}
    raw_identifier = (data.get('identifier') or data.get('mobile_number') or data.get('email') or '').strip()
    otp = (data.get('otp') or '').strip()
    new_password = (data.get('new_password') or '').strip()

    if not raw_identifier or not otp or not new_password:
        return jsonify({'error': 'Identifier, OTP, and new password are required'}), 400

    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user = _find_user_by_identifier(raw_identifier)
    user_id = user.id if user else None

    is_valid, msg, record = OTPService.verify_otp(
        identifier=raw_identifier,
        raw_otp=otp,
        purpose=OTPPurpose.PASSWORD_RESET,
        user_id=user_id
    )

    if not is_valid:
        return jsonify({'error': msg}), 400

    if not user and record and record.user_id:
        user = User.query.get(record.user_id)
    if not user:
        user = _find_user_by_identifier(raw_identifier)

    if not user:
        return jsonify({'error': 'Account not found.'}), 404

    user.set_password(new_password, store_plain=False)
    db.session.commit()

    if user.school_id:
        try:
            from app.services.audit_service import record_audit_event
            record_audit_event(
                school_id=user.school_id,
                actor_user_id=user.id,
                action='PASSWORD_RESET',
                module='auth',
                entity_type='User',
                entity_id=user.id,
                remarks='User reset password via OTP',
                status='SUCCESS',
                severity='HIGH'
            )
        except Exception as ex:
            logger.warning(f"Audit log failed for reset_password: {ex}")

    return jsonify({
        'success': True,
        'message': 'Password has been reset successfully. Please login with your new password.'
    }), 200



# ── Set new password (post-OTP reset) ──────────────────────────────────────────
@auth_bp.route('/set-new-password', methods=['POST'])
@jwt_required()
def set_new_password():
    """
    POST /api/v1/auth/set-new-password
    Allows an authenticated user (e.g. after OTP login / forgot password flow)
    to set a new password without needing their old password.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    new_password = (data.get('new_password') or '').strip()

    if not new_password or len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user.set_password(new_password, store_plain=False)
    db.session.commit()

    if user.school_id:
        try:
            from app.services.audit_service import record_audit_event
            record_audit_event(
                school_id=user.school_id,
                actor_user_id=user.id,
                action='PASSWORD_UPDATE',
                module='auth',
                entity_type='User',
                entity_id=user.id,
                remarks='User updated password',
                status='SUCCESS',
                severity='MEDIUM'
            )
        except Exception as ex:
            logger.warning(f"Audit log failed for set_new_password: {ex}")

    return jsonify({
        'success': True,
        'message': 'Password has been updated successfully.'
    }), 200


# ── Logout ───────────────────────────────────────────────────────────────────
@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    POST /api/v1/auth/logout
    Client clears stored JWTs; server returns confirmation.
    """
    try:
        from flask_jwt_extended import decode_token
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token_str = auth_header.split(' ', 1)[1].strip()
            decoded = decode_token(token_str)
            sub = decoded.get('sub')
            if sub:
                u = User.query.get(int(sub))
                if u and u.school_id:
                    from app.services.audit_service import record_audit_event
                    record_audit_event(
                        school_id=u.school_id,
                        actor_user_id=u.id,
                        action='LOGOUT',
                        module='auth',
                        entity_type='User',
                        entity_id=u.id,
                        remarks=f"User {u.name or u.username} logged out",
                        status='SUCCESS',
                        severity='LOW'
                    )
    except Exception as ex:
        logger.debug(f"Logout audit logging skipped or failed: {ex}")

    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200
