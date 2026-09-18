# backend/app/routes/delegations.py
"""
Teacher Delegations & Temporary Access REST APIs.

Endpoints for Principals to create, monitor, and revoke substitute teacher delegations,
and for Teachers to view their active delegated access in real time.
"""

from datetime import datetime, timedelta
from app.utils.timezone_util import utc_now
from flask import Blueprint, request, jsonify
from app import db
from app.models.academic import Teacher, Class, Subject
from app.models.delegation import TeacherDelegation
from app.utils.decorators import role_required, get_current_user
from app.services.teacher_delegation_service import (
    create_teacher_delegation, revoke_teacher_delegation,
    check_delegation_conflicts, get_active_teacher_delegations_for_user
)

delegations_bp = Blueprint('delegations', __name__)


# ═══════════════════════════════════════════════════════════════════════════
#  PRINCIPAL DELEGATION APIS
# ═══════════════════════════════════════════════════════════════════════════

@delegations_bp.route('/principal/delegations', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def list_delegations():
    """
    List delegations for the school with filter tabs, search, and metric summary.
    """
    user = get_current_user()
    school_id = user.school_id

    # Sync status flags
    now = utc_now()
    expiring_threshold = now + timedelta(days=2)

    # Base query scoped strictly to tenant school
    q = TeacherDelegation.query.filter_by(school_id=school_id)

    # Status filter
    status_filter = request.args.get('status', 'ALL').upper()
    search = request.args.get('search', '').strip().lower()
    class_id = request.args.get('class_id', type=int)

    all_items = q.order_by(TeacherDelegation.created_at.desc()).all()

    # Calculate metrics across all tenant records
    metrics = {
        'total': len(all_items),
        'active': 0,
        'scheduled': 0,
        'expiring_soon': 0,
        'expired': 0,
        'revoked': 0,
    }

    filtered = []
    for item in all_items:
        c_status = item.compute_current_status(now)
        if c_status == 'ACTIVE':
            metrics['active'] += 1
            if item.expires_at <= expiring_threshold:
                metrics['expiring_soon'] += 1
        elif c_status == 'SCHEDULED':
            metrics['scheduled'] += 1
        elif c_status == 'EXPIRED':
            metrics['expired'] += 1
        elif c_status == 'REVOKED':
            metrics['revoked'] += 1

        # Check tab match
        if status_filter != 'ALL':
            if status_filter == 'EXPIRING_SOON':
                if not (c_status == 'ACTIVE' and item.expires_at <= expiring_threshold):
                    continue
            elif c_status != status_filter:
                continue

        # Check class filter
        if class_id:
            has_class = any(sc.class_id == class_id for sc in (item.scopes or []))
            if not has_class:
                continue

        # Check search query
        if search:
            s_name = (item.source_teacher.user.name if item.source_teacher and item.source_teacher.user else '').lower()
            d_name = (item.delegate_teacher.user.name if item.delegate_teacher and item.delegate_teacher.user else '').lower()
            s_emp = (item.source_teacher.employee_id or '').lower() if item.source_teacher else ''
            d_emp = (item.delegate_teacher.employee_id or '').lower() if item.delegate_teacher else ''
            reason_txt = (item.reason or '').lower()

            if not any(search in field for field in [s_name, d_name, s_emp, d_emp, reason_txt]):
                continue

        filtered.append(item.to_dict())

    return jsonify({
        'metrics': metrics,
        'delegations': filtered,
    }), 200


@delegations_bp.route('/principal/delegations', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def create_delegation_endpoint():
    """
    Creates a new delegation with scoped classes, subjects, and granular permissions.
    """
    user = get_current_user()
    data = request.get_json() or {}

    source_teacher_id = data.get('source_teacher_id')
    delegate_teacher_id = data.get('delegate_teacher_id')
    session = data.get('session') or '2024-25'
    starts_at_raw = data.get('starts_at')
    expires_at_raw = data.get('expires_at')
    reason = data.get('reason')
    notes = data.get('notes')
    scopes = data.get('scopes', [])
    permissions = data.get('permissions', [])

    if not source_teacher_id or not delegate_teacher_id or not starts_at_raw or not expires_at_raw:
        return jsonify({'error': 'Source teacher, substitute teacher, start date, and end date are required.'}), 400

    try:
        # Parse ISO datetime
        starts_at = datetime.fromisoformat(starts_at_raw.replace('Z', '+00:00')).replace(tzinfo=None)
        expires_at = datetime.fromisoformat(expires_at_raw.replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception:
        return jsonify({'error': 'Invalid ISO datetime format for start or end date.'}), 400

    try:
        delegation = create_teacher_delegation(
            school_id=user.school_id,
            creator_user_id=user.id,
            session=session,
            source_teacher_id=int(source_teacher_id),
            delegate_teacher_id=int(delegate_teacher_id),
            starts_at=starts_at,
            expires_at=expires_at,
            reason=reason,
            notes=notes,
            scopes=scopes,
            permissions=permissions,
        )
        return jsonify({
            'message': 'Delegation created successfully.',
            'delegation': delegation.to_dict()
        }), 201
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except Exception as ex:
        db.session.rollback()
        return jsonify({'error': f'Failed to create delegation: {str(ex)}'}), 500


@delegations_bp.route('/principal/delegations/check-conflicts', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def check_conflicts_endpoint():
    """
    Checks for conflicts before submitting a delegation.
    """
    user = get_current_user()
    data = request.get_json() or {}

    delegate_teacher_id = data.get('delegate_teacher_id')
    starts_at_raw = data.get('starts_at')
    expires_at_raw = data.get('expires_at')
    scopes = data.get('scopes', [])

    if not delegate_teacher_id or not starts_at_raw or not expires_at_raw:
        return jsonify({'conflicts': []}), 200

    try:
        starts_at = datetime.fromisoformat(starts_at_raw.replace('Z', '+00:00')).replace(tzinfo=None)
        expires_at = datetime.fromisoformat(expires_at_raw.replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception:
        return jsonify({'conflicts': []}), 200

    conflicts = check_delegation_conflicts(
        school_id=user.school_id,
        delegate_teacher_id=int(delegate_teacher_id),
        starts_at=starts_at,
        expires_at=expires_at,
        scopes=scopes
    )
    return jsonify({'conflicts': conflicts}), 200


@delegations_bp.route('/principal/delegations/teachers-lookup', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def teachers_lookup():
    """
    Returns active eligible teachers and their classes/subjects for selection dropdowns.
    """
    user = get_current_user()
    teachers = Teacher.query.filter_by(school_id=user.school_id, is_deleted=False).all()

    result = []
    for t in teachers:
        if not t.user or not t.user.is_active:
            continue
        # Get permanently assigned subjects
        subjs = Subject.query.filter_by(teacher_id=t.id, school_id=user.school_id).all()
        assigned_scopes = []
        for s in subjs:
            cls = s.class_ref
            if cls:
                assigned_scopes.append({
                    'class_id': cls.id,
                    'class_name': f"{cls.name} {cls.section}",
                    'subject_id': s.id,
                    'subject_name': s.name,
                })

        result.append({
            'id': t.id,
            'user_id': t.user_id,
            'name': t.user.name,
            'email': t.user.email,
            'phone': t.user.phone,
            'employee_id': t.employee_id,
            'department': t.department,
            'designation': t.designation,
            'photo_url': t.photo_url,
            'assignments': assigned_scopes,
        })

    return jsonify(result), 200


@delegations_bp.route('/principal/delegations/<int:delegation_id>', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def get_delegation_detail(delegation_id):
    """
    Get a single delegation record with its scopes and permissions.
    """
    user = get_current_user()
    delegation = TeacherDelegation.query.filter_by(id=delegation_id, school_id=user.school_id).first_or_404()
    return jsonify(delegation.to_dict()), 200


@delegations_bp.route('/principal/delegations/<int:delegation_id>/revoke', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def revoke_delegation_endpoint(delegation_id):
    """
    Revokes a delegation immediately.
    """
    user = get_current_user()
    data = request.get_json() or {}
    reason = data.get('reason', 'Revoked by school principal')

    delegation, err = revoke_teacher_delegation(
        delegation_id=delegation_id,
        revoker_user_id=user.id,
        school_id=user.school_id,
        revoke_reason=reason
    )
    if err:
        return jsonify({'error': err}), 400

    return jsonify({
        'message': 'Delegation revoked successfully.',
        'delegation': delegation.to_dict()
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  TEACHER ACTIVE DELEGATIONS API
# ═══════════════════════════════════════════════════════════════════════════

@delegations_bp.route('/teacher/delegations/active', methods=['GET'])
@role_required('TEACHER')
def teacher_active_delegations():
    """
    Returns active delegations where the logged-in teacher is the substitute.
    Used by TeacherDashboard to display temporary access notifications and cards.
    """
    user = get_current_user()
    active_dels = get_active_teacher_delegations_for_user(user)

    result = [d.to_dict() for d in active_dels]
    return jsonify(result), 200
