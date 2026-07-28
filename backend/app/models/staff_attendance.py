"""
Staff & Teacher Attendance Management System — Models
OnePlatform360 School ERP (multi-tenant, school_id scoped everywhere)

Tables:
  - staff_attendance_settings         (per-school config)
  - staff_attendance                  (core daily record — request+approval+attendance in ONE row/table)
  - staff_attendance_regularization
  - staff_attendance_audit_logs
  - staff_monthly_attendance_summary   (cached rollup for performance at 10L+ records)

NOTE: prefixed with `staff_` on purpose — this project already has
`attendance` (students, app/models/academic.py) and `teacher_attendance`
(legacy, teacher-only, no GPS). This is a fresh, richer system covering
ALL employees (teaching + non-teaching), so we don't collide with either.
"""

from app import db
from datetime import datetime, date
import math


# ═══════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════

def generate_employee_id(school_id):
    """
    Next sequential EMP-XXXX for a school. Looks at the highest existing
    numeric suffix (not COUNT), so IDs are never reused even after a
    staff member is deleted/deactivated.
    """
    from app.models.user import User
    rows = (
        User.query
        .filter(User.school_id == school_id, User.employee_id.isnot(None))
        .with_entities(User.employee_id)
        .all()
    )
    max_num = 0
    for (emp_id,) in rows:
        if emp_id and emp_id.startswith('EMP-'):
            try:
                max_num = max(max_num, int(emp_id.split('-')[1]))
            except (IndexError, ValueError):
                continue
    return f'EMP-{max_num + 1:04d}'


def haversine_distance_meters(lat1, lng1, lat2, lng2):
    """Straight-line distance between two GPS points, in meters."""
    if None in (lat1, lng1, lat2, lng2):
        return None
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ═══════════════════════════════════════════════════════════════════════
#  ATTENDANCE SETTINGS  (one row per school)
# ═══════════════════════════════════════════════════════════════════════

class StaffAttendanceSettings(db.Model):
    __tablename__ = 'staff_attendance_settings'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, unique=True)

    # Location
    school_address = db.Column(db.String(500))
    latitude        = db.Column(db.Float)
    longitude       = db.Column(db.Float)
    radius_meters   = db.Column(db.Integer, default=100)   # 50/100/150/200/300

    # Timing rules
    school_start_time     = db.Column(db.String(5), default='08:00')   # HH:MM
    school_end_time       = db.Column(db.String(5), default='14:00')
    grace_minutes          = db.Column(db.Integer, default=10)
    half_day_after_minutes = db.Column(db.Integer, default=240)   # < this worked = HALF_DAY
    late_after_minutes     = db.Column(db.Integer, default=10)    # after grace = LATE
    overtime_after_minutes = db.Column(db.Integer, default=480)   # after this = overtime starts
    auto_checkout_time     = db.Column(db.String(5), default='18:00')

    # Toggles
    approval_required        = db.Column(db.Boolean, default=True)
    mock_location_detection  = db.Column(db.Boolean, default=True)
    device_restriction       = db.Column(db.Boolean, default=False)

    # Payroll / calendar
    attendance_lock_date   = db.Column(db.Date, nullable=True)
    working_days            = db.Column(db.String(50), default='Mon,Tue,Wed,Thu,Fri,Sat')
    payroll_sync_enabled     = db.Column(db.Boolean, default=True)
    attendance_cutoff_day    = db.Column(db.Integer, default=25)

    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id, 'school_id': self.school_id,
            'school_address': self.school_address,
            'latitude': self.latitude, 'longitude': self.longitude,
            'radius_meters': self.radius_meters,
            'school_start_time': self.school_start_time,
            'school_end_time': self.school_end_time,
            'grace_minutes': self.grace_minutes,
            'half_day_after_minutes': self.half_day_after_minutes,
            'late_after_minutes': self.late_after_minutes,
            'overtime_after_minutes': self.overtime_after_minutes,
            'auto_checkout_time': self.auto_checkout_time,
            'approval_required': self.approval_required,
            'mock_location_detection': self.mock_location_detection,
            'device_restriction': self.device_restriction,
            'attendance_lock_date': self.attendance_lock_date.isoformat() if self.attendance_lock_date else None,
            'working_days': [d for d in (self.working_days or '').split(',') if d],
            'payroll_sync_enabled': self.payroll_sync_enabled,
            'attendance_cutoff_day': self.attendance_cutoff_day,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def get_or_create(school_id):
        s = StaffAttendanceSettings.query.filter_by(school_id=school_id).first()
        if not s:
            s = StaffAttendanceSettings(school_id=school_id)
            db.session.add(s)
            db.session.commit()
        return s


# ═══════════════════════════════════════════════════════════════════════
#  CORE ATTENDANCE TABLE — one row per employee per day.
#  Pending -> Approved/Rejected updates happen IN PLACE. Never a second table.
# ═══════════════════════════════════════════════════════════════════════

class StaffAttendance(db.Model):
    __tablename__ = 'staff_attendance'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    attendance_date = db.Column(db.Date, nullable=False, index=True, default=date.today)

    # Check-in
    check_in_time     = db.Column(db.DateTime, nullable=True)
    check_in_lat      = db.Column(db.Float)
    check_in_lng      = db.Column(db.Float)
    check_in_distance = db.Column(db.Float)     # meters from school
    check_in_accuracy = db.Column(db.Float)
    check_in_mock     = db.Column(db.Boolean, default=False)
    check_in_device   = db.Column(db.String(200))
    check_in_ip       = db.Column(db.String(64))
    check_in_browser  = db.Column(db.String(200))

    # Check-out
    check_out_time     = db.Column(db.DateTime, nullable=True)
    check_out_lat      = db.Column(db.Float)
    check_out_lng      = db.Column(db.Float)
    check_out_distance = db.Column(db.Float)
    check_out_ip       = db.Column(db.String(64))

    working_minutes  = db.Column(db.Integer, default=0)
    overtime_minutes = db.Column(db.Integer, default=0)

    # INSIDE_CAMPUS / NEAR_BOUNDARY / OUTSIDE_CAMPUS
    gps_status = db.Column(db.String(20), default='INSIDE_CAMPUS')

    # PENDING / APPROVED / REJECTED / NOT_REQUIRED
    approval_status  = db.Column(db.String(20), default='PENDING', index=True)
    approved_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at      = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.String(300))

    # PRESENT / ABSENT / LATE / HALF_DAY / ON_LEAVE / MISSING_CHECKOUT
    status = db.Column(db.String(20), default='ABSENT', index=True)

    is_regularized = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('user_id', 'attendance_date', name='uq_staff_attendance_user_date'),
    )

    def to_dict(self):
        u = self.user
        return {
            'id': self.id,
            'school_id': self.school_id,
            'user_id': self.user_id,
            'employee_id': getattr(u, 'employee_id', None) if u else None,
            'employee_name': u.name if u else '',
            'role': u.role.value if u and u.role else '',
            'designation': u.designation if u else '',
            'photo_url': u.avatar_url if u else None,
            'date': self.attendance_date.isoformat() if self.attendance_date else None,
            'check_in_time': self.check_in_time.isoformat() if self.check_in_time else None,
            'check_out_time': self.check_out_time.isoformat() if self.check_out_time else None,
            'check_in_distance': self.check_in_distance,
            'gps_status': self.gps_status,
            'working_minutes': self.working_minutes,
            'working_hours': round((self.working_minutes or 0) / 60, 2),
            'overtime_minutes': self.overtime_minutes,
            'approval_status': self.approval_status,
            'status': self.status,
            'is_regularized': self.is_regularized,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'rejection_reason': self.rejection_reason,
        }


# ═══════════════════════════════════════════════════════════════════════
#  REGULARIZATION REQUESTS
# ═══════════════════════════════════════════════════════════════════════

class StaffAttendanceRegularization(db.Model):
    __tablename__ = 'staff_attendance_regularization'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    attendance_id   = db.Column(db.Integer, db.ForeignKey('staff_attendance.id'), nullable=True)
    attendance_date = db.Column(db.Date, nullable=False)

    # FORGOT_CHECKOUT / LATE_CHECKIN / WRONG_ATTENDANCE / MEDICAL / NETWORK_ISSUE / GPS_ISSUE / OTHER
    reason_type = db.Column(db.String(30))
    reason_text = db.Column(db.String(500))

    requested_check_in  = db.Column(db.DateTime, nullable=True)
    requested_check_out = db.Column(db.DateTime, nullable=True)

    status      = db.Column(db.String(20), default='PENDING', index=True)  # PENDING/APPROVED/REJECTED
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_note = db.Column(db.String(300))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        u = self.user
        return {
            'id': self.id,
            'user_id': self.user_id,
            'employee_id': getattr(u, 'employee_id', None) if u else None,
            'employee_name': u.name if u else '',
            'designation': u.designation if u else '',
            'attendance_id': self.attendance_id,
            'date': self.attendance_date.isoformat() if self.attendance_date else None,
            'reason_type': self.reason_type,
            'reason_text': self.reason_text,
            'requested_check_in': self.requested_check_in.isoformat() if self.requested_check_in else None,
            'requested_check_out': self.requested_check_out.isoformat() if self.requested_check_out else None,
            'status': self.status,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════

class StaffAttendanceAuditLog(db.Model):
    __tablename__ = 'staff_attendance_audit_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)   # whose attendance
    action_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)   # who performed it

    # REQUESTED/APPROVED/REJECTED/EDITED/DELETED/REGULARIZED/PAYROLL_SYNCED/GPS_CHANGED/SETTINGS_CHANGED
    action     = db.Column(db.String(40))
    old_value  = db.Column(db.Text)
    new_value  = db.Column(db.Text)
    reason     = db.Column(db.String(300))

    ip_address = db.Column(db.String(64))
    browser    = db.Column(db.String(200))
    device     = db.Column(db.String(200))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action_by': self.action_by,
            'action': self.action,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'reason': self.reason,
            'ip_address': self.ip_address,
            'browser': self.browser,
            'device': self.device,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  MONTHLY SUMMARY  (cached rollup — keeps the 10L+ record report fast)
# ═══════════════════════════════════════════════════════════════════════

class StaffMonthlyAttendanceSummary(db.Model):
    __tablename__ = 'staff_monthly_attendance_summary'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    month     = db.Column(db.Integer, nullable=False)   # 1-12
    year      = db.Column(db.Integer, nullable=False)

    working_days          = db.Column(db.Integer, default=0)
    present_days          = db.Column(db.Integer, default=0)
    absent_days           = db.Column(db.Integer, default=0)
    late_days             = db.Column(db.Integer, default=0)
    half_days             = db.Column(db.Integer, default=0)
    paid_leave_days       = db.Column(db.Integer, default=0)
    unpaid_leave_days     = db.Column(db.Integer, default=0)
    total_working_minutes = db.Column(db.Integer, default=0)
    overtime_minutes      = db.Column(db.Integer, default=0)
    regularization_count  = db.Column(db.Integer, default=0)
    attendance_percent    = db.Column(db.Float, default=0.0)
    salary_impact         = db.Column(db.Float, default=0.0)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('user_id', 'month', 'year', name='uq_staff_monthly_summary'),
    )

    def to_dict(self):
        u = self.user
        return {
            'user_id': self.user_id,
            'employee_id': getattr(u, 'employee_id', None) if u else None,
            'employee_name': u.name if u else '',
            'role': u.role.value if u and u.role else '',
            'designation': u.designation if u else '',
            'month': self.month, 'year': self.year,
            'working_days': self.working_days,
            'present_days': self.present_days,
            'absent_days': self.absent_days,
            'late_days': self.late_days,
            'half_days': self.half_days,
            'paid_leave_days': self.paid_leave_days,
            'unpaid_leave_days': self.unpaid_leave_days,
            'working_hours': round((self.total_working_minutes or 0) / 60, 2),
            'overtime_hours': round((self.overtime_minutes or 0) / 60, 2),
            'regularization_count': self.regularization_count,
            'attendance_percent': self.attendance_percent,
            'salary_impact': self.salary_impact,
        }
