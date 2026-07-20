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
from app.models.rbac import resolve_platform_permissions, get_user_roles
import re

auth_bp = Blueprint('auth', __name__)


def _serialize_user(user):
    data = user.to_dict()
    roles = get_user_roles(user)
    data['is_super']    = any(r.is_super for r in roles)
    data['permissions'] = sorted(resolve_platform_permissions(user, school_id=user.school_id))
    return data


def _normalise(s):
    """Lowercase + collapse all whitespace to single space + strip."""
    return re.sub(r'\s+', ' ', (s or '').strip()).lower()


# ── Regular login (staff / principal / admin) ─────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """
    Accepts email OR username in the 'identifier' field.
    Also accepts legacy 'email' field for backward compatibility.
    """
    data = request.get_json() or {}

    identifier = (
        data.get('identifier') or data.get('email') or ''
    ).strip().lower()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Identifier and password required'}), 400

    # Try email first, then username
    user = User.query.filter(
        sqlfunc.lower(User.email) == identifier
    ).first()

    if not user:
        user = User.query.filter(
            sqlfunc.lower(User.username) == identifier
        ).first()

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
