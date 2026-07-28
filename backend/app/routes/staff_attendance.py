"""
Staff Attendance — API routes.
All endpoints are school_id scoped via the logged-in user's own school_id
(never trust a school_id from the request body/query for writes).
"""

from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app import db
from app.models.user import User, UserRole
from app.models.staff_attendance import (
    StaffAttendance, StaffAttendanceSettings, StaffAttendanceRegularization,
    StaffAttendanceAuditLog, StaffMonthlyAttendanceSummary, generate_employee_id,
)
from app.services import staff_attendance_service as svc
from app.utils.decorators import role_required

staff_attendance_bp = Blueprint('staff_attendance', __name__)


def _current_user():
    user_id = int(get_jwt_identity())
    return User.query.get(user_id)


def _parse_date(value, default=None):
    if not value:
        return default
    return datetime.strptime(value, '%Y-%m-%d').date()


# ═══════════════════════════════════════════════════════════════════════
#  SETTINGS
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/settings', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def get_settings():
    user = _current_user()
    settings = StaffAttendanceSettings.get_or_create(user.school_id)
    return jsonify(settings.to_dict())


@staff_attendance_bp.route('/settings', methods=['PUT'])
@role_required('PRINCIPAL', 'HR')
def update_settings():
    user = _current_user()
    settings = StaffAttendanceSettings.get_or_create(user.school_id)
    data = request.get_json() or {}

    old_snapshot = settings.to_dict()

    fields = [
        'school_address', 'latitude', 'longitude', 'radius_meters',
        'school_start_time', 'school_end_time', 'grace_minutes',
        'half_day_after_minutes', 'late_after_minutes', 'overtime_after_minutes',
        'auto_checkout_time', 'approval_required', 'mock_location_detection',
        'device_restriction', 'payroll_sync_enabled', 'attendance_cutoff_day',
    ]
    for f in fields:
        if f in data:
            setattr(settings, f, data[f])

    if 'working_days' in data and isinstance(data['working_days'], list):
        settings.working_days = ','.join(data['working_days'])

    if 'attendance_lock_date' in data:
        settings.attendance_lock_date = _parse_date(data['attendance_lock_date'])

    settings.updated_by = user.id
    db.session.commit()

    svc.log_audit(user.school_id, 'SETTINGS_CHANGED', action_by=user.id,
                  old_value=old_snapshot, new_value=settings.to_dict())
    db.session.commit()

    return jsonify(settings.to_dict())


# ═══════════════════════════════════════════════════════════════════════
#  CHECK-IN / CHECK-OUT  (teacher/staff self-service)
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/check-in', methods=['POST'])
@jwt_required()
def do_check_in():
    user = _current_user()
    data = request.get_json() or {}
    try:
        record = svc.check_in(
            user,
            latitude=data.get('latitude'),
            longitude=data.get('longitude'),
            accuracy=data.get('accuracy'),
            is_mock=data.get('is_mock', False),
            device=data.get('device'),
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(record.to_dict()), 201


@staff_attendance_bp.route('/check-out', methods=['POST'])
@jwt_required()
def do_check_out():
    user = _current_user()
    data = request.get_json() or {}
    try:
        record = svc.check_out(user, latitude=data.get('latitude'), longitude=data.get('longitude'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(record.to_dict())


@staff_attendance_bp.route('/my-status', methods=['GET'])
@jwt_required()
def my_today_status():
    user = _current_user()
    record = StaffAttendance.query.filter_by(user_id=user.id, attendance_date=date.today()).first()
    return jsonify(record.to_dict() if record else None)


# ═══════════════════════════════════════════════════════════════════════
#  DASHBOARD  (top cards)
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/dashboard', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def dashboard():
    user = _current_user()
    on_date = _parse_date(request.args.get('date'), date.today())

    total_employees = User.query.filter(
        User.school_id == user.school_id,
        User.role != UserRole.STUDENT, User.role != UserRole.PARENT,
        User.is_active == True,
    ).count()

    rows = StaffAttendance.query.filter_by(school_id=user.school_id, attendance_date=on_date).all()

    present = sum(1 for r in rows if r.status == 'PRESENT')
    late    = sum(1 for r in rows if r.status == 'LATE')
    half    = sum(1 for r in rows if r.status == 'HALF_DAY')
    absent_marked = sum(1 for r in rows if r.status == 'ABSENT')
    pending = sum(1 for r in rows if r.approval_status == 'PENDING')
    marked_users = {r.user_id for r in rows}
    not_marked = total_employees - len(marked_users)
    absent_total = absent_marked + max(0, not_marked)

    reg_pending = StaffAttendanceRegularization.query.filter_by(
        school_id=user.school_id, status='PENDING'
    ).count()

    checkins = [r.check_in_time for r in rows if r.check_in_time]
    avg_checkin = None
    if checkins:
        avg_seconds = sum(c.hour * 3600 + c.minute * 60 + c.second for c in checkins) / len(checkins)
        avg_checkin = f'{int(avg_seconds // 3600):02d}:{int((avg_seconds % 3600) // 60):02d}'

    total_minutes = sum(r.working_minutes or 0 for r in rows if r.check_out_time)
    checked_out_count = sum(1 for r in rows if r.check_out_time)
    avg_working_hours = round((total_minutes / checked_out_count) / 60, 2) if checked_out_count else 0

    attendance_pct = round(((present + late + half) / total_employees) * 100, 2) if total_employees else 0

    return jsonify({
        'date': on_date.isoformat(),
        'total_employees': total_employees,
        'present_today': present,
        'absent_today': absent_total,
        'late_today': late,
        'half_day_today': half,
        'on_leave_today': 0,   # wired once Leave module integration lands
        'pending_approval': pending,
        'regularization_requests': reg_pending,
        'average_check_in': avg_checkin,
        'average_working_hours': avg_working_hours,
        'attendance_percent': attendance_pct,
    })


# ═══════════════════════════════════════════════════════════════════════
#  TODAY ATTENDANCE LIST  (card click -> filtered list)
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/today', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def today_list():
    user = _current_user()
    on_date = _parse_date(request.args.get('date'), date.today())
    status_filter    = request.args.get('status')            # PRESENT/LATE/ABSENT/HALF_DAY/MISSING_CHECKOUT
    approval_filter  = request.args.get('approval_status')   # PENDING/APPROVED/REJECTED
    search           = request.args.get('search', '').strip()
    role_filter      = request.args.get('role')
    page     = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    q = StaffAttendance.query.filter_by(school_id=user.school_id, attendance_date=on_date)
    if status_filter:
        q = q.filter(StaffAttendance.status == status_filter)
    if approval_filter:
        q = q.filter(StaffAttendance.approval_status == approval_filter)

    q = q.join(User, StaffAttendance.user_id == User.id)
    if role_filter:
        q = q.filter(User.role == role_filter)
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(User.name.ilike(like), User.employee_id.ilike(like)))

    total = q.count()
    rows = q.order_by(StaffAttendance.check_in_time.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'total': total, 'page': page, 'per_page': per_page,
        'items': [r.to_dict() for r in rows],
    })


# ═══════════════════════════════════════════════════════════════════════
#  APPROVAL
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/approve/<int:record_id>', methods=['POST'])
@role_required('PRINCIPAL', 'HR')
def approve_one(record_id):
    approver = _current_user()
    record = StaffAttendance.query.get_or_404(record_id)
    if record.school_id != approver.school_id:
        return jsonify({'error': 'Not found'}), 404
    reason = (request.get_json() or {}).get('reason')
    svc.approve_attendance(record, approver, reason=reason)
    return jsonify(record.to_dict())


@staff_attendance_bp.route('/reject/<int:record_id>', methods=['POST'])
@role_required('PRINCIPAL', 'HR')
def reject_one(record_id):
    approver = _current_user()
    record = StaffAttendance.query.get_or_404(record_id)
    if record.school_id != approver.school_id:
        return jsonify({'error': 'Not found'}), 404
    reason = (request.get_json() or {}).get('reason')
    svc.reject_attendance(record, approver, reason=reason)
    return jsonify(record.to_dict())


@staff_attendance_bp.route('/approve-bulk', methods=['POST'])
@role_required('PRINCIPAL', 'HR')
def approve_bulk():
    approver = _current_user()
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        # "Approve All" — every PENDING row for today at this school
        on_date = _parse_date(data.get('date'), date.today())
        ids = [r.id for r in StaffAttendance.query.filter_by(
            school_id=approver.school_id, attendance_date=on_date, approval_status='PENDING'
        ).all()]
    records = svc.bulk_approve(ids, approver, reason=data.get('reason'))
    return jsonify({'updated': len(records)})


@staff_attendance_bp.route('/reject-bulk', methods=['POST'])
@role_required('PRINCIPAL', 'HR')
def reject_bulk():
    approver = _current_user()
    data = request.get_json() or {}
    ids = data.get('ids', [])
    if not ids:
        on_date = _parse_date(data.get('date'), date.today())
        ids = [r.id for r in StaffAttendance.query.filter_by(
            school_id=approver.school_id, attendance_date=on_date, approval_status='PENDING'
        ).all()]
    records = svc.bulk_reject(ids, approver, reason=data.get('reason'))
    return jsonify({'updated': len(records)})


# ═══════════════════════════════════════════════════════════════════════
#  REGULARIZATION
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/regularization', methods=['POST'])
@jwt_required()
def create_regularization():
    user = _current_user()
    data = request.get_json() or {}
    att_date = _parse_date(data.get('date'), date.today())

    def _parse_dt(v):
        return datetime.fromisoformat(v) if v else None

    reg = svc.submit_regularization(
        user, att_date,
        reason_type=data.get('reason_type'),
        reason_text=data.get('reason_text'),
        requested_check_in=_parse_dt(data.get('requested_check_in')),
        requested_check_out=_parse_dt(data.get('requested_check_out')),
    )
    return jsonify(reg.to_dict()), 201


@staff_attendance_bp.route('/regularization', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def list_regularization():
    user = _current_user()
    status_filter = request.args.get('status')
    q = StaffAttendanceRegularization.query.filter_by(school_id=user.school_id)
    if status_filter:
        q = q.filter_by(status=status_filter)
    rows = q.order_by(StaffAttendanceRegularization.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rows])


@staff_attendance_bp.route('/regularization/<int:reg_id>/review', methods=['POST'])
@role_required('PRINCIPAL', 'HR')
def review_regularization(reg_id):
    approver = _current_user()
    reg = StaffAttendanceRegularization.query.get_or_404(reg_id)
    if reg.school_id != approver.school_id:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json() or {}
    approve = bool(data.get('approve'))
    updated = svc.review_regularization(reg, approver, approve, review_note=data.get('review_note'))
    return jsonify(updated.to_dict())


# ═══════════════════════════════════════════════════════════════════════
#  MONTHLY SUMMARY
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/monthly-summary', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def monthly_summary():
    user = _current_user()
    month = int(request.args.get('month', date.today().month))
    year  = int(request.args.get('year', date.today().year))

    summaries = svc.rebuild_monthly_summary_for_school(user.school_id, month, year)
    return jsonify([s.to_dict() for s in summaries])


@staff_attendance_bp.route('/monthly-summary/<int:target_user_id>', methods=['GET'])
@jwt_required()
def monthly_summary_one(target_user_id):
    requester = _current_user()
    target = User.query.get_or_404(target_user_id)
    if target.school_id != requester.school_id:
        return jsonify({'error': 'Not found'}), 404
    # Self, or Principal/HR viewing anyone
    if requester.id != target.id and requester.role.value not in ('PRINCIPAL', 'HR', 'DIRECTOR', 'VICE_PRINCIPAL'):
        return jsonify({'error': 'Access denied'}), 403

    month = int(request.args.get('month', date.today().month))
    year  = int(request.args.get('year', date.today().year))
    summary = svc.rebuild_monthly_summary(requester.school_id, target, month, year)
    return jsonify(summary.to_dict())


# ═══════════════════════════════════════════════════════════════════════
#  EMPLOYEE ATTENDANCE PROFILE
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/employee/<int:target_user_id>/history', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def employee_history(target_user_id):
    user = _current_user()
    target = User.query.get_or_404(target_user_id)
    if target.school_id != user.school_id:
        return jsonify({'error': 'Not found'}), 404

    from_date = _parse_date(request.args.get('from_date'))
    to_date   = _parse_date(request.args.get('to_date'), date.today())

    q = StaffAttendance.query.filter_by(user_id=target.id)
    if from_date:
        q = q.filter(StaffAttendance.attendance_date >= from_date)
    q = q.filter(StaffAttendance.attendance_date <= to_date)
    rows = q.order_by(StaffAttendance.attendance_date.desc()).all()

    reg_rows = StaffAttendanceRegularization.query.filter_by(user_id=target.id).order_by(
        StaffAttendanceRegularization.created_at.desc()
    ).limit(50).all()

    return jsonify({
        'employee': {
            'user_id': target.id,
            'employee_id': target.employee_id,
            'name': target.name,
            'role': target.role.value,
            'designation': target.designation,
            'photo_url': target.avatar_url,
        },
        'daily_history': [r.to_dict() for r in rows],
        'regularization_history': [r.to_dict() for r in reg_rows],
    })


# ═══════════════════════════════════════════════════════════════════════
#  EMPLOYEE LIST  (used by Add-Staff-style pages; ensures employee_id exists)
# ═══════════════════════════════════════════════════════════════════════

@staff_attendance_bp.route('/employees', methods=['GET'])
@role_required('PRINCIPAL', 'HR')
def list_employees():
    user = _current_user()
    employees = User.query.filter(
        User.school_id == user.school_id,
        User.role != UserRole.STUDENT, User.role != UserRole.PARENT,
    ).order_by(User.name).all()

    changed = False
    for e in employees:
        if not e.employee_id:
            e.employee_id = generate_employee_id(user.school_id)
            changed = True
    if changed:
        db.session.commit()

    return jsonify([{
        'user_id': e.id, 'employee_id': e.employee_id, 'name': e.name,
        'role': e.role.value, 'designation': e.designation, 'photo_url': e.avatar_url,
        'is_active': e.is_active,
    } for e in employees])
