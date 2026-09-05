"""
Staff Attendance — business logic layer.
Keeps routes thin: routes only handle request/response, all rules live here.
"""

from datetime import datetime, date, timedelta
from calendar import monthrange

from app import db
from app.models.staff_attendance import (
    StaffAttendance, StaffAttendanceSettings, StaffAttendanceRegularization,
    StaffAttendanceAuditLog, StaffMonthlyAttendanceSummary,
    haversine_distance_meters,
)
from app.utils.request_context import capture_request_context


# ═══════════════════════════════════════════════════════════════════════
#  AUDIT LOGGING
# ═══════════════════════════════════════════════════════════════════════

def log_audit(school_id, action, user_id=None, action_by=None,
              old_value=None, new_value=None, reason=None):
    ctx = {}
    try:
        ctx = capture_request_context()
    except Exception:
        pass
    entry = StaffAttendanceAuditLog(
        school_id=school_id,
        user_id=user_id,
        action_by=action_by,
        action=action,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        reason=reason,
        ip_address=ctx.get('ip_address'),
        browser=ctx.get('browser'),
        device=ctx.get('os'),
    )
    db.session.add(entry)
    # caller commits — keeps this part of the same transaction as the change


# ═══════════════════════════════════════════════════════════════════════
#  GPS STATUS
# ═══════════════════════════════════════════════════════════════════════

def compute_gps_status(distance, radius_meters):
    """INSIDE_CAMPUS / NEAR_BOUNDARY / OUTSIDE_CAMPUS"""
    if distance is None:
        return 'OUTSIDE_CAMPUS'
    if distance <= radius_meters:
        return 'INSIDE_CAMPUS'
    if distance <= radius_meters * 1.5:
        return 'NEAR_BOUNDARY'
    return 'OUTSIDE_CAMPUS'


# ═══════════════════════════════════════════════════════════════════════
#  TIME RULE HELPERS
# ═══════════════════════════════════════════════════════════════════════

def _parse_hhmm(value, on_date):
    """'08:00' + a date -> datetime on that date."""
    h, m = [int(x) for x in value.split(':')]
    return datetime(on_date.year, on_date.month, on_date.day, h, m)


def compute_checkin_status(check_in_time, settings):
    """
    Returns 'PRESENT' or 'LATE' based on school_start_time + grace_minutes.
    """
    on_date = check_in_time.date()
    start = _parse_hhmm(settings.school_start_time, on_date)
    grace_cutoff = start + timedelta(minutes=settings.grace_minutes or 0)
    return 'LATE' if check_in_time > grace_cutoff else 'PRESENT'


def compute_working_minutes(check_in_time, check_out_time):
    if not check_in_time or not check_out_time or check_out_time <= check_in_time:
        return 0
    return int((check_out_time - check_in_time).total_seconds() // 60)


def finalize_working_status(record, settings):
    """
    After checkout, decide final status: PRESENT / LATE / HALF_DAY, and
    split overtime out of working_minutes.
    Called after check-out AND after regularization edits.
    """
    minutes = record.working_minutes or 0

    if minutes and minutes < (settings.half_day_after_minutes or 240):
        record.status = 'HALF_DAY'
    elif record.check_in_time and compute_checkin_status(record.check_in_time, settings) == 'LATE':
        record.status = 'LATE'
    else:
        record.status = 'PRESENT'

    ot_threshold = settings.overtime_after_minutes or 480
    record.overtime_minutes = max(0, minutes - ot_threshold)


def get_user_shift_timings(user, on_date=None):
    """Retrieves user's assigned Shift or falls back to global StaffAttendanceSettings."""
    on_date = on_date or date.today()
    from app.models.hrms import EmployeeShiftAssignment, Shift
    assignment = EmployeeShiftAssignment.query.filter(
        EmployeeShiftAssignment.user_id == user.id,
        EmployeeShiftAssignment.valid_from <= on_date,
        db.or_(
            EmployeeShiftAssignment.valid_to == None,
            EmployeeShiftAssignment.valid_to >= on_date
        )
    ).first()

    if assignment and assignment.shift:
        s = assignment.shift
        return {
            'start_time': s.start_time or '08:00',
            'end_time': s.end_time or '14:00',
            'grace_minutes': s.grace_minutes if s.grace_minutes is not None else 10,
            'half_day_after_minutes': s.half_day_after_minutes or 240,
            'overtime_after_minutes': s.full_day_minutes or 480,
            'shift_name': s.name,
        }

    settings = StaffAttendanceSettings.get_or_create(user.school_id)
    return {
        'start_time': settings.school_start_time or '08:00',
        'end_time': settings.school_end_time or '14:00',
        'grace_minutes': settings.grace_minutes if settings.grace_minutes is not None else 10,
        'half_day_after_minutes': settings.half_day_after_minutes or 240,
        'overtime_after_minutes': settings.overtime_after_minutes or 480,
        'shift_name': 'Default School Hours',
    }


def check_in(user, latitude, longitude, accuracy=None, is_mock=False, device=None):
    """
    Creates (or returns existing) today's StaffAttendance row for this user.
    Validates location against school campus coordinates and radius,
    accounting for GPS accuracy, Official Duty exemptions, and shift timings.
    """
    settings = StaffAttendanceSettings.get_or_create(user.school_id)
    today = date.today()
    existing = StaffAttendance.query.filter_by(user_id=user.id, attendance_date=today).first()
    if existing and existing.check_in_time:
        raise ValueError('Aaj ka check-in already ho chuka hai.')

    # Check for approved Official Duty (OD)
    from app.models.hrms import OfficialDuty
    active_od = OfficialDuty.query.filter(
        OfficialDuty.user_id == user.id,
        OfficialDuty.status == 'APPROVED',
        OfficialDuty.from_date <= today,
        OfficialDuty.to_date >= today,
    ).first()

    distance = None
    if settings.latitude is not None and settings.longitude is not None and latitude is not None and longitude is not None:
        distance = haversine_distance_meters(latitude, longitude, settings.latitude, settings.longitude)

    gps_status = compute_gps_status(distance, settings.radius_meters or 100)

    # If on Official Duty, override GPS restriction
    if active_od:
        gps_status = 'OFFICIAL_DUTY'

    # Check GPS accuracy: if accuracy > 200m and not on OD, require approval / warn
    accuracy_poor = (accuracy is not None and accuracy > 200 and not active_od)

    if gps_status == 'OUTSIDE_CAMPUS' and settings.approval_required is False and not active_od:
        raise ValueError(f'Aap school se {int(distance)}m door hain — allowed radius {settings.radius_meters}m hai.')

    if settings.mock_location_detection and is_mock:
        raise ValueError('Mock/Fake GPS location detect hui — attendance allowed nahi.')

    now = datetime.utcnow()
    ctx = {}
    try:
        ctx = capture_request_context()
    except Exception:
        pass

    shift_info = get_user_shift_timings(user, today)
    start_dt = _parse_hhmm(shift_info['start_time'], today)
    grace_cutoff = start_dt + timedelta(minutes=shift_info['grace_minutes'] or 0)
    calculated_status = 'LATE' if now > grace_cutoff else 'PRESENT'

    record = existing or StaffAttendance(school_id=user.school_id, user_id=user.id, attendance_date=today)
    record.check_in_time     = now
    record.check_in_lat      = latitude
    record.check_in_lng      = longitude
    record.check_in_distance = distance
    record.check_in_accuracy = accuracy
    record.check_in_mock     = bool(is_mock)
    record.check_in_device   = device
    record.check_in_ip       = ctx.get('ip_address')
    record.check_in_browser  = ctx.get('browser')

    # Approval decision
    if active_od:
        record.approval_status = 'APPROVED'
        record.status = 'PRESENT'
        record.rejection_reason = f'Official Duty: {active_od.duty_type} ({active_od.location})'
    elif settings.approval_required or accuracy_poor or gps_status == 'OUTSIDE_CAMPUS':
        record.approval_status = 'PENDING'
        record.status = calculated_status if gps_status != 'OUTSIDE_CAMPUS' else 'ABSENT'
        if accuracy_poor:
            record.rejection_reason = f'Low GPS accuracy ({int(accuracy)}m)'
    else:
        record.approval_status = 'NOT_REQUIRED'
        record.status = calculated_status

    record.gps_status = gps_status

    db.session.add(record)
    db.session.flush()

    log_audit(user.school_id, 'REQUESTED', user_id=user.id, action_by=user.id,
              new_value=f'check_in at {now.isoformat()}, distance={distance}, gps_status={gps_status}')
    db.session.commit()
    return record


# ═══════════════════════════════════════════════════════════════════════
#  CHECK-OUT  (never requires approval)
# ═══════════════════════════════════════════════════════════════════════

def check_out(user, latitude=None, longitude=None):
    today = date.today()
    record = StaffAttendance.query.filter_by(user_id=user.id, attendance_date=today).first()
    if not record or not record.check_in_time:
        raise ValueError('Aapne aaj check-in nahi kiya hai.')
    if record.check_out_time:
        raise ValueError('Check-out already ho chuka hai.')

    settings = StaffAttendanceSettings.get_or_create(user.school_id)
    now = datetime.utcnow()
    ctx = {}
    try:
        ctx = capture_request_context()
    except Exception:
        pass

    record.check_out_time = now
    record.check_out_lat  = latitude
    record.check_out_lng  = longitude
    if settings.latitude is not None and latitude is not None:
        record.check_out_distance = haversine_distance_meters(
            latitude, longitude, settings.latitude, settings.longitude
        )
    record.check_out_ip = ctx.get('ip_address')
    record.working_minutes = compute_working_minutes(record.check_in_time, now)

    if record.approval_status != 'PENDING':
        finalize_working_status(record, settings)

    db.session.flush()
    log_audit(user.school_id, 'EDITED', user_id=user.id, action_by=user.id,
              new_value=f'check_out at {now.isoformat()}, worked_minutes={record.working_minutes}')
    db.session.commit()
    return record


def mark_missing_checkouts(school_id, on_date=None):
    """
    Run at/after auto_checkout_time (e.g. via a scheduler) — anyone who
    checked in but never checked out gets flagged so they can regularize.
    """
    on_date = on_date or date.today()
    settings = StaffAttendanceSettings.get_or_create(school_id)
    rows = StaffAttendance.query.filter_by(
        school_id=school_id, attendance_date=on_date
    ).filter(
        StaffAttendance.check_in_time.isnot(None),
        StaffAttendance.check_out_time.is_(None),
    ).all()

    for r in rows:
        r.status = 'MISSING_CHECKOUT'
        log_audit(school_id, 'EDITED', user_id=r.user_id,
                  new_value='status=MISSING_CHECKOUT (auto, no checkout recorded)')
    db.session.commit()
    return len(rows)


# ═══════════════════════════════════════════════════════════════════════
#  APPROVAL
# ═══════════════════════════════════════════════════════════════════════

def approve_attendance(record, approver, reason=None):
    settings = StaffAttendanceSettings.get_or_create(record.school_id)
    old_status = record.approval_status
    record.approval_status = 'APPROVED'
    record.approved_by = approver.id
    record.approved_at = datetime.utcnow()

    if record.check_out_time:
        finalize_working_status(record, settings)
    else:
        record.status = compute_checkin_status(record.check_in_time, settings) if record.check_in_time else 'ABSENT'

    log_audit(record.school_id, 'APPROVED', user_id=record.user_id, action_by=approver.id,
              old_value=old_status, new_value='APPROVED', reason=reason)
    db.session.commit()
    return record


def reject_attendance(record, approver, reason=None):
    old_status = record.approval_status
    record.approval_status = 'REJECTED'
    record.approved_by = approver.id
    record.approved_at = datetime.utcnow()
    record.rejection_reason = reason
    record.status = 'ABSENT'

    log_audit(record.school_id, 'REJECTED', user_id=record.user_id, action_by=approver.id,
              old_value=old_status, new_value='REJECTED', reason=reason)
    db.session.commit()
    return record


def bulk_approve(record_ids, approver, reason=None):
    records = StaffAttendance.query.filter(StaffAttendance.id.in_(record_ids)).all()
    for r in records:
        approve_attendance(r, approver, reason=reason)
    return records


def bulk_reject(record_ids, approver, reason=None):
    records = StaffAttendance.query.filter(StaffAttendance.id.in_(record_ids)).all()
    for r in records:
        reject_attendance(r, approver, reason=reason)
    return records


# ═══════════════════════════════════════════════════════════════════════
#  REGULARIZATION
# ═══════════════════════════════════════════════════════════════════════

def submit_regularization(user, attendance_date, reason_type, reason_text,
                           requested_check_in=None, requested_check_out=None):
    record = StaffAttendance.query.filter_by(user_id=user.id, attendance_date=attendance_date).first()
    reg = StaffAttendanceRegularization(
        school_id=user.school_id,
        user_id=user.id,
        attendance_id=record.id if record else None,
        attendance_date=attendance_date,
        reason_type=reason_type,
        reason_text=reason_text,
        requested_check_in=requested_check_in,
        requested_check_out=requested_check_out,
    )
    db.session.add(reg)
    db.session.flush()
    log_audit(user.school_id, 'REQUESTED', user_id=user.id, action_by=user.id,
              new_value=f'regularization: {reason_type}', reason=reason_text)
    db.session.commit()
    return reg


def review_regularization(reg, approver, approve, review_note=None):
    settings = StaffAttendanceSettings.get_or_create(reg.school_id)
    reg.status = 'APPROVED' if approve else 'REJECTED'
    reg.reviewed_by = approver.id
    reg.reviewed_at = datetime.utcnow()
    reg.review_note = review_note

    if approve:
        record = StaffAttendance.query.get(reg.attendance_id) if reg.attendance_id else None
        if not record:
            record = StaffAttendance.query.filter_by(
                user_id=reg.user_id, attendance_date=reg.attendance_date
            ).first()
        if not record:
            record = StaffAttendance(
                school_id=reg.school_id, user_id=reg.user_id,
                attendance_date=reg.attendance_date,
            )
            db.session.add(record)

        old_snapshot = record.to_dict() if record.id else {}

        if reg.requested_check_in:
            record.check_in_time = reg.requested_check_in
        if reg.requested_check_out:
            record.check_out_time = reg.requested_check_out

        record.working_minutes = compute_working_minutes(record.check_in_time, record.check_out_time)
        record.approval_status = 'APPROVED'
        record.is_regularized = True
        if record.check_out_time:
            finalize_working_status(record, settings)
        elif record.check_in_time:
            record.status = compute_checkin_status(record.check_in_time, settings)

        db.session.flush()
        reg.attendance_id = record.id

        log_audit(reg.school_id, 'REGULARIZED', user_id=reg.user_id, action_by=approver.id,
                  old_value=old_snapshot, new_value=record.to_dict(), reason=review_note)
    else:
        log_audit(reg.school_id, 'REJECTED', user_id=reg.user_id, action_by=approver.id,
                  new_value='regularization rejected', reason=review_note)

    db.session.commit()
    return reg


# ═══════════════════════════════════════════════════════════════════════
#  MONTHLY SUMMARY (rebuild) + PAYROLL IMPACT
# ═══════════════════════════════════════════════════════════════════════

def _working_days_in_month(school_id, month, year):
    settings = StaffAttendanceSettings.get_or_create(school_id)
    allowed = set((settings.working_days or '').split(','))
    days_in_month = monthrange(year, month)[1]
    count = 0
    for d in range(1, days_in_month + 1):
        wd = date(year, month, d).strftime('%a')  # 'Mon', 'Tue', ...
        if wd in allowed:
            count += 1
    return count


def rebuild_monthly_summary(school_id, user, month, year):
    """
    Recomputes one employee's monthly rollup from staff_attendance rows
    and upserts into staff_monthly_attendance_summary. Cheap enough to call
    on every dashboard read for one employee; for the whole-school table,
    call once per employee in a loop (routes layer handles pagination).
    """
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    rows = StaffAttendance.query.filter(
        StaffAttendance.user_id == user.id,
        StaffAttendance.attendance_date >= start,
        StaffAttendance.attendance_date <= end,
    ).all()

    present = sum(1 for r in rows if r.status == 'PRESENT')
    late    = sum(1 for r in rows if r.status == 'LATE')
    half    = sum(1 for r in rows if r.status == 'HALF_DAY')
    absent  = sum(1 for r in rows if r.status in ('ABSENT', 'MISSING_CHECKOUT'))
    total_minutes = sum(r.working_minutes or 0 for r in rows)
    ot_minutes    = sum(r.overtime_minutes or 0 for r in rows)

    reg_count = StaffAttendanceRegularization.query.filter(
        StaffAttendanceRegularization.user_id == user.id,
        StaffAttendanceRegularization.attendance_date >= start,
        StaffAttendanceRegularization.attendance_date <= end,
        StaffAttendanceRegularization.status == 'APPROVED',
    ).count()

    working_days = _working_days_in_month(school_id, month, year)
    marked_days = present + late + half + absent
    attendance_pct = round(((present + late + half) / working_days) * 100, 2) if working_days else 0.0

    # Query approved leaves in month
    from app.models.hrms import LeaveRequest, LeaveStatus
    approved_leaves = LeaveRequest.query.filter(
        LeaveRequest.user_id == user.id,
        LeaveRequest.status == LeaveStatus.APPROVED.value,
        LeaveRequest.from_date <= end,
        LeaveRequest.to_date >= start,
    ).all()

    paid_leaves = 0.0
    unpaid_leaves = 0.0
    for lr in approved_leaves:
        l_start = max(lr.from_date, start)
        l_end = min(lr.to_date, end)
        days = (l_end - l_start).days + 1
        if lr.is_half_day:
            days = 0.5
        if lr.leave_type and lr.leave_type.is_paid:
            paid_leaves += days
        else:
            unpaid_leaves += days

    # Total loss of pay = unexcused absences + unpaid leaves + 0.5 * half_days
    monthly_salary = float(getattr(user, 'salary', 0.0) or 0.0)
    if not monthly_salary and hasattr(user, 'teacher_profile') and user.teacher_profile and getattr(user.teacher_profile, 'salary', None):
        monthly_salary = float(user.teacher_profile.salary or 0.0)
    per_day_salary = (monthly_salary / working_days) if (working_days and monthly_salary > 0) else 0.0
    total_lop = absent + unpaid_leaves + (0.5 * half)
    salary_impact = round(per_day_salary * total_lop, 2)

    summary = StaffMonthlyAttendanceSummary.query.filter_by(
        user_id=user.id, month=month, year=year
    ).first()
    if not summary:
        summary = StaffMonthlyAttendanceSummary(
            school_id=school_id, user_id=user.id, month=month, year=year
        )
        db.session.add(summary)

    summary.working_days          = working_days
    summary.present_days          = present
    summary.absent_days           = absent
    summary.late_days             = late
    summary.half_days             = half
    summary.paid_leave_days       = int(paid_leaves)
    summary.unpaid_leave_days     = int(unpaid_leaves)
    summary.total_working_minutes = total_minutes
    summary.overtime_minutes      = ot_minutes
    summary.regularization_count  = reg_count
    summary.attendance_percent    = attendance_pct
    summary.salary_impact         = salary_impact

    db.session.commit()
    return summary


def rebuild_monthly_summary_for_school(school_id, month, year):
    """Bulk rebuild — used by the Monthly Summary screen and by a nightly job."""
    from app.models.user import User, UserRole
    employees = User.query.filter(
        User.school_id == school_id,
        User.role != UserRole.STUDENT,
        User.role != UserRole.PARENT,
        User.is_active == True,
    ).all()
    return [rebuild_monthly_summary(school_id, u, month, year) for u in employees]
