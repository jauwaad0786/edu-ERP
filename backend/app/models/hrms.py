"""
School HRMS & Staff/Teacher Management Models
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Entities:
- EmployeeProfile             (Unified profile extending User for both Teachers & Staff)
- EmployeeDepartment          (School departments: Science, Admin, Transport, etc.)
- EmployeeDesignation         (School designations: PGT, TGT, Accountant, etc.)
- Shift                       (Shift timings, grace period, break duration)
- EmployeeShiftAssignment     (Mapping of employee to shift)
- EmployeeDocument            (KYC & Employment docs: Aadhaar, PAN, Resume, Degrees, etc.)
- LeaveType                   (CL, SL, EL, Maternity, Paternity, Unpaid, etc.)
- LeaveBalance                (Employee leave balances per academic session/year)
- LeaveRequest                (Employee leave applications & approval workflow)
- OfficialDuty                (Outdoor / Official duty requests for GPS exemption)
- SalaryComponent             (Earnings & Deductions master)
- SalaryStructure             (Template structure with components)
- SalaryStructureItem         (Formula / fixed components in structure)
- EmployeeSalaryStructure     (Assigned salary structure with versioning & effective date)
- PayrollRun                  (Monthly payroll batch header: Draft -> Approved -> Locked)
- PayrollSlip                 (Employee payslip record for a payroll run)
- PayrollSlipItem             (Individual earning/deduction line items on payslip)
- HRMSAuditLog                (Audit trail for HR operations)
"""

from app import db
from datetime import datetime, date
import enum


# ═══════════════════════════════════════════════════════════════════════
#  ENUMS
# ═══════════════════════════════════════════════════════════════════════

class EmploymentStatus(str, enum.Enum):
    ACTIVE         = 'ACTIVE'
    PROBATION      = 'PROBATION'
    NOTICE_PERIOD  = 'NOTICE_PERIOD'
    RESIGNED       = 'RESIGNED'
    TERMINATED     = 'TERMINATED'
    RETIRED        = 'RETIRED'
    INACTIVE       = 'INACTIVE'


class EmploymentType(str, enum.Enum):
    PERMANENT  = 'PERMANENT'
    CONTRACT   = 'CONTRACT'
    TEMPORARY  = 'TEMPORARY'
    PART_TIME  = 'PART_TIME'
    INTERN     = 'INTERN'


class DocumentVerificationStatus(str, enum.Enum):
    PENDING   = 'PENDING'
    VERIFIED  = 'VERIFIED'
    REJECTED  = 'REJECTED'


class LeaveStatus(str, enum.Enum):
    PENDING   = 'PENDING'
    APPROVED  = 'APPROVED'
    REJECTED  = 'REJECTED'
    CANCELLED = 'CANCELLED'


class ComponentType(str, enum.Enum):
    EARNING   = 'EARNING'
    DEDUCTION = 'DEDUCTION'


class PayrollRunStatus(str, enum.Enum):
    DRAFT     = 'DRAFT'
    APPROVED  = 'APPROVED'
    LOCKED    = 'LOCKED'
    PAID      = 'PAID'


# ═══════════════════════════════════════════════════════════════════════
#  1. EMPLOYEE PROFILE & MASTER
# ═══════════════════════════════════════════════════════════════════════

class EmployeeProfile(db.Model):
    """
    Extends User to store comprehensive HR & lifecycle details for all employees
    (Teaching & Non-Teaching).
    """
    __tablename__ = 'employee_profiles'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), unique=True, nullable=False, index=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    # Personal Information
    gender               = db.Column(db.String(10), default='MALE')  # MALE, FEMALE, OTHER
    dob                  = db.Column(db.Date, nullable=True)
    blood_group          = db.Column(db.String(10), nullable=True)
    marital_status       = db.Column(db.String(20), nullable=True)   # SINGLE, MARRIED, etc.
    father_husband_name  = db.Column(db.String(120), nullable=True)
    emergency_contact    = db.Column(db.String(20), nullable=True)
    emergency_relation   = db.Column(db.String(50), nullable=True)

    # Address
    current_address      = db.Column(db.String(500), nullable=True)
    permanent_address    = db.Column(db.String(500), nullable=True)
    city                 = db.Column(db.String(100), nullable=True)
    state                = db.Column(db.String(100), nullable=True)
    pincode              = db.Column(db.String(10), nullable=True)

    # Employment Details
    employment_type      = db.Column(db.String(30), default=EmploymentType.PERMANENT.value)
    employment_status    = db.Column(db.String(30), default=EmploymentStatus.ACTIVE.value, index=True)
    department_id        = db.Column(db.Integer, db.ForeignKey('employee_departments.id'), nullable=True)
    designation_id       = db.Column(db.Integer, db.ForeignKey('employee_designations.id'), nullable=True)
    joining_date         = db.Column(db.Date, nullable=True)
    probation_end_date   = db.Column(db.Date, nullable=True)
    confirmation_date    = db.Column(db.Date, nullable=True)
    exit_date            = db.Column(db.Date, nullable=True)
    exit_reason          = db.Column(db.String(300), nullable=True)
    reporting_manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    work_location        = db.Column(db.String(150), default='Main Campus')

    # Academic & Professional
    qualification        = db.Column(db.String(250), nullable=True)
    experience_years     = db.Column(db.Float, default=0.0)
    specialization       = db.Column(db.String(200), nullable=True)

    # Bank Details
    bank_name            = db.Column(db.String(150), nullable=True)
    account_number       = db.Column(db.String(50), nullable=True)
    ifsc_code            = db.Column(db.String(30), nullable=True)
    branch_name          = db.Column(db.String(150), nullable=True)

    # Statutory & Tax Identification
    pan_number           = db.Column(db.String(20), nullable=True)
    aadhaar_number       = db.Column(db.String(20), nullable=True)
    uan_number           = db.Column(db.String(30), nullable=True)
    pf_number            = db.Column(db.String(50), nullable=True)
    esi_number           = db.Column(db.String(50), nullable=True)

    created_at           = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at           = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user               = db.relationship('User', foreign_keys=[user_id], backref=db.backref('employee_profile_rel', uselist=False))
    reporting_manager  = db.relationship('User', foreign_keys=[reporting_manager_id])
    department         = db.relationship('EmployeeDepartment', foreign_keys=[department_id])
    designation        = db.relationship('EmployeeDesignation', foreign_keys=[designation_id])

    def to_dict(self, include_sensitive=False):
        u = self.user
        dept_name = self.department.name if self.department else (u.department if u else '')
        desig_name = self.designation.name if self.designation else (u.designation if u else '')
        mgr_name = self.reporting_manager.name if self.reporting_manager else ''

        # Mask PAN/Aadhaar/Account unless include_sensitive is True
        acc_masked = (f'••••••••{self.account_number[-4:]}') if (self.account_number and len(self.account_number) >= 4 and not include_sensitive) else (self.account_number or '')
        aadhaar_masked = (f'••••••••{self.aadhaar_number[-4:]}') if (self.aadhaar_number and len(self.aadhaar_number) >= 4 and not include_sensitive) else (self.aadhaar_number or '')
        pan_masked = (f'••••{self.pan_number[-4:]}') if (self.pan_number and len(self.pan_number) >= 4 and not include_sensitive) else (self.pan_number or '')

        return {
            'id':                   self.id,
            'user_id':              self.user_id,
            'school_id':            self.school_id,
            'employee_id':          getattr(u, 'employee_id', '') or '',
            'name':                 u.name if u else '',
            'email':                u.email if u else '',
            'phone':                u.phone if u else '',
            'role':                 u.role.value if u and u.role else '',
            'avatar_url':           u.avatar_url if u else None,
            'gender':               self.gender or 'MALE',
            'dob':                  self.dob.isoformat() if self.dob else None,
            'blood_group':          self.blood_group or '',
            'marital_status':       self.marital_status or '',
            'father_husband_name':  self.father_husband_name or '',
            'emergency_contact':    self.emergency_contact or '',
            'emergency_relation':   self.emergency_relation or '',
            'current_address':      self.current_address or '',
            'permanent_address':    self.permanent_address or '',
            'city':                 self.city or '',
            'state':                self.state or '',
            'pincode':              self.pincode or '',
            'employment_type':      self.employment_type,
            'employment_status':    self.employment_status,
            'department_id':        self.department_id,
            'department':           dept_name,
            'designation_id':       self.designation_id,
            'designation':          desig_name,
            'joining_date':         self.joining_date.isoformat() if self.joining_date else None,
            'probation_end_date':   self.probation_end_date.isoformat() if self.probation_end_date else None,
            'confirmation_date':    self.confirmation_date.isoformat() if self.confirmation_date else None,
            'exit_date':            self.exit_date.isoformat() if self.exit_date else None,
            'exit_reason':          self.exit_reason or '',
            'reporting_manager_id': self.reporting_manager_id,
            'reporting_manager_name': mgr_name,
            'work_location':        self.work_location or 'Main Campus',
            'qualification':        self.qualification or '',
            'experience_years':     self.experience_years or 0.0,
            'specialization':       self.specialization or '',
            'bank_name':            self.bank_name or '',
            'account_number':       acc_masked,
            'ifsc_code':            self.ifsc_code or '',
            'branch_name':          self.branch_name or '',
            'pan_number':           pan_masked,
            'aadhaar_number':       aadhaar_masked,
            'uan_number':           self.uan_number or '',
            'pf_number':            self.pf_number or '',
            'esi_number':           self.esi_number or '',
            'created_at':           self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  2. DEPARTMENTS & DESIGNATIONS
# ═══════════════════════════════════════════════════════════════════════

class EmployeeDepartment(db.Model):
    __tablename__ = 'employee_departments'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name        = db.Column(db.String(100), nullable=False)
    code        = db.Column(db.String(30), nullable=True)
    description = db.Column(db.String(250), nullable=True)
    head_user_id= db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'name', name='uq_dept_school_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'school_id': self.school_id,
            'name': self.name,
            'code': self.code or '',
            'description': self.description or '',
            'head_user_id': self.head_user_id,
        }


class EmployeeDesignation(db.Model):
    __tablename__ = 'employee_designations'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    department_id = db.Column(db.Integer, db.ForeignKey('employee_departments.id'), nullable=True)
    name          = db.Column(db.String(100), nullable=False)
    code          = db.Column(db.String(30), nullable=True)
    description   = db.Column(db.String(250), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'name', name='uq_desig_school_name'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'school_id': self.school_id,
            'department_id': self.department_id,
            'name': self.name,
            'code': self.code or '',
            'description': self.description or '',
        }


# ═══════════════════════════════════════════════════════════════════════
#  3. SHIFTS & ASSIGNMENTS
# ═══════════════════════════════════════════════════════════════════════

class Shift(db.Model):
    __tablename__ = 'shifts'

    id                     = db.Column(db.Integer, primary_key=True)
    school_id              = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name                   = db.Column(db.String(100), nullable=False)   # e.g., "Morning Shift", "General Office"
    code                   = db.Column(db.String(30), nullable=True)
    start_time             = db.Column(db.String(5), default='08:00')    # HH:MM
    end_time               = db.Column(db.String(5), default='14:00')
    grace_minutes          = db.Column(db.Integer, default=10)
    half_day_after_minutes = db.Column(db.Integer, default=240)          # Less than this = half day
    full_day_minutes       = db.Column(db.Integer, default=360)          # Standard working duration
    break_duration_minutes = db.Column(db.Integer, default=30)
    is_default             = db.Column(db.Boolean, default=False)
    is_active              = db.Column(db.Boolean, default=True)
    created_at             = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                     self.id,
            'school_id':              self.school_id,
            'name':                   self.name,
            'code':                   self.code or '',
            'start_time':             self.start_time,
            'end_time':               self.end_time,
            'grace_minutes':          self.grace_minutes,
            'half_day_after_minutes': self.half_day_after_minutes,
            'full_day_minutes':       self.full_day_minutes,
            'break_duration_minutes': self.break_duration_minutes,
            'is_default':             self.is_default,
            'is_active':              self.is_active,
        }


class EmployeeShiftAssignment(db.Model):
    __tablename__ = 'employee_shift_assignments'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    shift_id    = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=False)
    valid_from  = db.Column(db.Date, nullable=False, default=date.today)
    valid_to    = db.Column(db.Date, nullable=True)   # Null = indefinite
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    user  = db.relationship('User', foreign_keys=[user_id])
    shift = db.relationship('Shift', foreign_keys=[shift_id])

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'employee_name': self.user.name if self.user else '',
            'shift_id':   self.shift_id,
            'shift_name': self.shift.name if self.shift else '',
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_to':   self.valid_to.isoformat() if self.valid_to else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  4. EMPLOYEE DOCUMENTS & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

EMPLOYEE_DOC_TYPES = {
    'AADHAAR':               'Aadhaar Card',
    'PAN':                   'PAN Card',
    'RESUME':                'Resume / CV',
    'QUALIFICATION':         'Educational Qualification Certificate',
    'EXPERIENCE':            'Experience Letter / Relieving Letter',
    'APPOINTMENT_LETTER':    'Appointment Letter',
    'CONTRACT':              'Employment Contract',
    'BANK_PROOF':            'Cancelled Cheque / Bank Passbook',
    'ADDRESS_PROOF':         'Address Proof',
    'POLICE_VERIFICATION':   'Police Verification / Background Check',
    'MEDICAL_FITNESS':       'Medical Fitness Certificate',
    'OTHER':                 'Other Document',
}

class EmployeeDocument(db.Model):
    __tablename__ = 'employee_documents'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    doc_type           = db.Column(db.String(40), nullable=False)   # AADHAAR, PAN, RESUME, etc.
    title              = db.Column(db.String(200), nullable=False)
    file_url           = db.Column(db.String(500), nullable=False)
    file_name          = db.Column(db.String(200), default='')
    file_size          = db.Column(db.Integer, nullable=True)
    issue_date         = db.Column(db.Date, nullable=True)
    expiry_date        = db.Column(db.Date, nullable=True)

    # Verification status
    verification_status= db.Column(db.String(20), default=DocumentVerificationStatus.PENDING.value, index=True)
    verified_by        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    verified_at        = db.Column(db.DateTime, nullable=True)
    verification_notes = db.Column(db.String(300), nullable=True)

    uploaded_by        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploaded_at        = db.Column(db.DateTime, default=datetime.utcnow)

    user     = db.relationship('User', foreign_keys=[user_id])
    verifier = db.relationship('User', foreign_keys=[verified_by])

    def to_dict(self):
        return {
            'id':                  self.id,
            'school_id':           self.school_id,
            'user_id':             self.user_id,
            'employee_name':       self.user.name if self.user else '',
            'doc_type':            self.doc_type,
            'doc_type_label':      EMPLOYEE_DOC_TYPES.get(self.doc_type, self.doc_type.replace('_', ' ').title()),
            'title':               self.title,
            'file_url':            self.file_url,
            'file_name':           self.file_name or '',
            'file_size':           self.file_size,
            'issue_date':          self.issue_date.isoformat() if self.issue_date else None,
            'expiry_date':         self.expiry_date.isoformat() if self.expiry_date else None,
            'verification_status': self.verification_status,
            'verified_by':         self.verified_by,
            'verified_by_name':    self.verifier.name if self.verifier else '',
            'verified_at':         self.verified_at.isoformat() if self.verified_at else None,
            'verification_notes':  self.verification_notes or '',
            'uploaded_at':         self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  5. LEAVE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

class LeaveType(db.Model):
    __tablename__ = 'leave_types'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name                 = db.Column(db.String(100), nullable=False)   # Casual Leave, Sick Leave, Earned Leave
    code                 = db.Column(db.String(20), nullable=False)    # CL, SL, EL, LOP, etc.
    description          = db.Column(db.String(250), nullable=True)
    annual_quota         = db.Column(db.Float, default=12.0)
    is_paid              = db.Column(db.Boolean, default=True)         # Paid leave vs LOP
    allow_half_day       = db.Column(db.Boolean, default=True)
    carry_forward_max    = db.Column(db.Float, default=0.0)
    requires_approval    = db.Column(db.Boolean, default=True)
    applicable_role      = db.Column(db.String(50), default='ALL')     # ALL / TEACHER / STAFF
    is_active            = db.Column(db.Boolean, default=True)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'code', name='uq_leave_type_school_code'),
    )

    def to_dict(self):
        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'name':              self.name,
            'code':              self.code,
            'description':       self.description or '',
            'annual_quota':      self.annual_quota,
            'is_paid':           self.is_paid,
            'allow_half_day':    self.allow_half_day,
            'carry_forward_max': self.carry_forward_max,
            'requires_approval': self.requires_approval,
            'applicable_role':   self.applicable_role,
            'is_active':         self.is_active,
        }


class LeaveBalance(db.Model):
    __tablename__ = 'leave_balances'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    leave_type_id = db.Column(db.Integer, db.ForeignKey('leave_types.id'), nullable=False)
    session_year  = db.Column(db.String(20), default='2024-25', index=True)   # or calendar year '2026'

    allocated     = db.Column(db.Float, default=0.0)
    carried_over  = db.Column(db.Float, default=0.0)
    used          = db.Column(db.Float, default=0.0)
    pending       = db.Column(db.Float, default=0.0)

    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leave_type    = db.relationship('LeaveType', foreign_keys=[leave_type_id])
    user          = db.relationship('User', foreign_keys=[user_id])

    __table_args__ = (
        db.UniqueConstraint('user_id', 'leave_type_id', 'session_year', name='uq_user_leave_balance_session'),
    )

    @property
    def remaining(self):
        return max(0.0, (self.allocated or 0.0) + (self.carried_over or 0.0) - (self.used or 0.0))

    def to_dict(self):
        return {
            'id':            self.id,
            'school_id':     self.school_id,
            'user_id':       self.user_id,
            'employee_name': self.user.name if self.user else '',
            'leave_type_id': self.leave_type_id,
            'leave_type_name': self.leave_type.name if self.leave_type else '',
            'leave_type_code': self.leave_type.code if self.leave_type else '',
            'is_paid':       self.leave_type.is_paid if self.leave_type else True,
            'session_year':  self.session_year,
            'allocated':     self.allocated,
            'carried_over':  self.carried_over,
            'used':          self.used,
            'pending':       self.pending,
            'remaining':     self.remaining,
        }


class LeaveRequest(db.Model):
    __tablename__ = 'leave_requests'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    leave_type_id = db.Column(db.Integer, db.ForeignKey('leave_types.id'), nullable=False)

    from_date     = db.Column(db.Date, nullable=False, index=True)
    to_date       = db.Column(db.Date, nullable=False, index=True)
    days_count    = db.Column(db.Float, default=1.0)
    is_half_day   = db.Column(db.Boolean, default=False)
    half_day_session = db.Column(db.String(10), nullable=True)  # FIRST_HALF / SECOND_HALF
    reason        = db.Column(db.String(500), nullable=False)
    attachment_url= db.Column(db.String(500), nullable=True)

    status        = db.Column(db.String(20), default=LeaveStatus.PENDING.value, index=True)
    reviewed_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at   = db.Column(db.DateTime, nullable=True)
    review_remarks= db.Column(db.String(300), nullable=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    user       = db.relationship('User', foreign_keys=[user_id])
    reviewer   = db.relationship('User', foreign_keys=[reviewed_by])
    leave_type = db.relationship('LeaveType', foreign_keys=[leave_type_id])

    def to_dict(self):
        lt = self.leave_type
        u = self.user
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'user_id':          self.user_id,
            'employee_id':      getattr(u, 'employee_id', '') if u else '',
            'employee_name':    u.name if u else '',
            'role':             u.role.value if u and u.role else '',
            'department':       u.department if u else '',
            'leave_type_id':    self.leave_type_id,
            'leave_type_name':  lt.name if lt else '',
            'leave_type_code':  lt.code if lt else '',
            'is_paid':          lt.is_paid if lt else True,
            'from_date':        self.from_date.isoformat() if self.from_date else None,
            'to_date':          self.to_date.isoformat() if self.to_date else None,
            'days_count':       self.days_count,
            'is_half_day':      self.is_half_day,
            'half_day_session': self.half_day_session,
            'reason':           self.reason,
            'attachment_url':   self.attachment_url,
            'status':           self.status,
            'reviewed_by':      self.reviewed_by,
            'reviewer_name':    self.reviewer.name if self.reviewer else '',
            'reviewed_at':      self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_remarks':   self.review_remarks or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  6. OFFICIAL DUTY / OUTDOOR EXCEPTION
# ═══════════════════════════════════════════════════════════════════════

class OfficialDuty(db.Model):
    """Official duty or tour requests allowing GPS radius exemption."""
    __tablename__ = 'official_duties'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    from_date     = db.Column(db.Date, nullable=False, index=True)
    to_date       = db.Column(db.Date, nullable=False, index=True)
    duty_type     = db.Column(db.String(50), default='SCHOOL_EVENT')  # EXAM_DUTY, TRAINING, SCHOOL_TRIP, MEETING, FIELD_WORK, OTHER
    location      = db.Column(db.String(250), nullable=False)
    purpose       = db.Column(db.String(500), nullable=False)

    status        = db.Column(db.String(20), default='PENDING', index=True)  # PENDING / APPROVED / REJECTED
    reviewed_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at   = db.Column(db.DateTime, nullable=True)
    review_remarks= db.Column(db.String(300), nullable=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    user     = db.relationship('User', foreign_keys=[user_id])
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])

    def to_dict(self):
        u = self.user
        return {
            'id':            self.id,
            'school_id':     self.school_id,
            'user_id':       self.user_id,
            'employee_name': u.name if u else '',
            'employee_id':   getattr(u, 'employee_id', '') if u else '',
            'from_date':     self.from_date.isoformat() if self.from_date else None,
            'to_date':       self.to_date.isoformat() if self.to_date else None,
            'duty_type':     self.duty_type,
            'location':      self.location,
            'purpose':       self.purpose,
            'status':        self.status,
            'reviewed_by':   self.reviewed_by,
            'reviewer_name': self.reviewer.name if self.reviewer else '',
            'reviewed_at':   self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_remarks':self.review_remarks or '',
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  7. SALARY STRUCTURE & COMPENSATION
# ═══════════════════════════════════════════════════════════════════════

class SalaryComponent(db.Model):
    __tablename__ = 'salary_components'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name         = db.Column(db.String(100), nullable=False)   # e.g., Basic Salary, HRA, DA, PF, ESI, TDS
    code         = db.Column(db.String(30), nullable=False)    # BASIC, HRA, DA, PF, ESI, TDS, LOP
    component_type = db.Column(db.String(20), default=ComponentType.EARNING.value) # EARNING / DEDUCTION
    is_taxable   = db.Column(db.Boolean, default=True)
    is_statutory = db.Column(db.Boolean, default=False)        # PF, ESI, PT
    description  = db.Column(db.String(250), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'code', name='uq_salary_comp_school_code'),
    )

    def to_dict(self):
        return {
            'id':             self.id,
            'school_id':      self.school_id,
            'name':           self.name,
            'code':           self.code,
            'component_type': self.component_type,
            'is_taxable':     self.is_taxable,
            'is_statutory':   self.is_statutory,
            'description':    self.description or '',
        }


class SalaryStructure(db.Model):
    """Template salary structure e.g. 'Senior PGT Scale', 'Admin Office Scale'."""
    __tablename__ = 'salary_structures'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name        = db.Column(db.String(150), nullable=False)
    description = db.Column(db.String(250), nullable=True)
    is_active   = db.Column(db.Boolean, default=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    items       = db.relationship('SalaryStructureItem', backref='structure', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':          self.id,
            'school_id':   self.school_id,
            'name':        self.name,
            'description': self.description or '',
            'is_active':   self.is_active,
            'items':       [it.to_dict() for it in self.items],
        }


class SalaryStructureItem(db.Model):
    __tablename__ = 'salary_structure_items'

    id            = db.Column(db.Integer, primary_key=True)
    structure_id  = db.Column(db.Integer, db.ForeignKey('salary_structures.id'), nullable=False)
    component_id  = db.Column(db.Integer, db.ForeignKey('salary_components.id'), nullable=False)
    amount_type   = db.Column(db.String(20), default='FIXED')  # FIXED or PERCENTAGE_OF_BASIC
    default_amount= db.Column(db.Float, default=0.0)

    component     = db.relationship('SalaryComponent')

    def to_dict(self):
        return {
            'id':             self.id,
            'component_id':   self.component_id,
            'component_name': self.component.name if self.component else '',
            'component_code': self.component.code if self.component else '',
            'component_type': self.component.component_type if self.component else 'EARNING',
            'amount_type':    self.amount_type,
            'default_amount': self.default_amount,
        }


class EmployeeSalaryStructure(db.Model):
    """Individual employee's active or historic salary configuration."""
    __tablename__ = 'employee_salary_structures'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    structure_id  = db.Column(db.Integer, db.ForeignKey('salary_structures.id'), nullable=True)

    effective_from= db.Column(db.Date, nullable=False, default=date.today)
    effective_to  = db.Column(db.Date, nullable=True)          # Null = currently active

    basic_salary  = db.Column(db.Float, default=0.0)
    hra           = db.Column(db.Float, default=0.0)
    da            = db.Column(db.Float, default=0.0)
    ta            = db.Column(db.Float, default=0.0)
    special_allowance = db.Column(db.Float, default=0.0)
    other_allowances  = db.Column(db.Float, default=0.0)

    pf_deduction  = db.Column(db.Float, default=0.0)
    esi_deduction = db.Column(db.Float, default=0.0)
    prof_tax      = db.Column(db.Float, default=0.0)
    tds           = db.Column(db.Float, default=0.0)
    other_deductions = db.Column(db.Float, default=0.0)

    gross_salary  = db.Column(db.Float, default=0.0)
    net_salary    = db.Column(db.Float, default=0.0)
    is_active     = db.Column(db.Boolean, default=True)

    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    user      = db.relationship('User', foreign_keys=[user_id])
    structure = db.relationship('SalaryStructure', foreign_keys=[structure_id])

    def calculate_totals(self):
        gross = (
            (self.basic_salary or 0.0) +
            (self.hra or 0.0) +
            (self.da or 0.0) +
            (self.ta or 0.0) +
            (self.special_allowance or 0.0) +
            (self.other_allowances or 0.0)
        )
        total_ded = (
            (self.pf_deduction or 0.0) +
            (self.esi_deduction or 0.0) +
            (self.prof_tax or 0.0) +
            (self.tds or 0.0) +
            (self.other_deductions or 0.0)
        )
        self.gross_salary = round(gross, 2)
        self.net_salary = round(max(0.0, gross - total_ded), 2)
        return self.gross_salary, self.net_salary

    def to_dict(self):
        u = self.user
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'user_id':          self.user_id,
            'employee_name':    u.name if u else '',
            'employee_id':      getattr(u, 'employee_id', '') if u else '',
            'structure_id':     self.structure_id,
            'structure_name':   self.structure.name if self.structure else 'Custom',
            'effective_from':   self.effective_from.isoformat() if self.effective_from else None,
            'effective_to':     self.effective_to.isoformat() if self.effective_to else None,
            'basic_salary':     self.basic_salary,
            'hra':              self.hra,
            'da':               self.da,
            'ta':               self.ta,
            'special_allowance': self.special_allowance,
            'other_allowances': self.other_allowances,
            'pf_deduction':     self.pf_deduction,
            'esi_deduction':    self.esi_deduction,
            'prof_tax':         self.prof_tax,
            'tds':              self.tds,
            'other_deductions': self.other_deductions,
            'gross_salary':     self.gross_salary,
            'net_salary':       self.net_salary,
            'is_active':        self.is_active,
        }


# ═══════════════════════════════════════════════════════════════════════
#  8. PAYROLL RUN & PAYSLIPS
# ═══════════════════════════════════════════════════════════════════════

class PayrollRun(db.Model):
    """Monthly payroll execution batch per school."""
    __tablename__ = 'payroll_runs'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    month          = db.Column(db.Integer, nullable=False)     # 1-12
    year           = db.Column(db.Integer, nullable=False)     # e.g., 2026
    month_name     = db.Column(db.String(30), nullable=False)  # e.g., "July 2026"

    calculation_policy = db.Column(db.String(30), default='PAYABLE_DAYS') # PAYABLE_DAYS, CALENDAR_DAYS, WORKING_DAYS

    total_employees= db.Column(db.Integer, default=0)
    total_gross    = db.Column(db.Float, default=0.0)
    total_deductions= db.Column(db.Float, default=0.0)
    total_net      = db.Column(db.Float, default=0.0)

    status         = db.Column(db.String(20), default=PayrollRunStatus.DRAFT.value, index=True)

    generated_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    generated_at   = db.Column(db.DateTime, default=datetime.utcnow)

    approved_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at    = db.Column(db.DateTime, nullable=True)

    locked_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    locked_at      = db.Column(db.DateTime, nullable=True)

    notes          = db.Column(db.String(500), nullable=True)

    slips          = db.relationship('PayrollSlip', backref='payroll_run', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'month', 'year', name='uq_payroll_run_month_year'),
    )

    def to_dict(self):
        return {
            'id':                 self.id,
            'school_id':          self.school_id,
            'month':              self.month,
            'year':               self.year,
            'month_name':         self.month_name,
            'calculation_policy': self.calculation_policy,
            'total_employees':    self.total_employees,
            'total_gross':        self.total_gross,
            'total_deductions':   self.total_deductions,
            'total_net':          self.total_net,
            'status':             self.status,
            'generated_at':       self.generated_at.isoformat() if self.generated_at else None,
            'approved_at':        self.approved_at.isoformat() if self.approved_at else None,
            'locked_at':          self.locked_at.isoformat() if self.locked_at else None,
            'notes':              self.notes or '',
        }


class PayrollSlip(db.Model):
    """Detailed payslip for an individual employee within a monthly payroll run."""
    __tablename__ = 'payroll_slips'

    id             = db.Column(db.Integer, primary_key=True)
    payroll_run_id = db.Column(db.Integer, db.ForeignKey('payroll_runs.id'), nullable=False, index=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    # Days accounting
    calendar_days  = db.Column(db.Integer, default=30)
    working_days   = db.Column(db.Integer, default=26)
    payable_days   = db.Column(db.Float, default=26.0)
    present_days   = db.Column(db.Float, default=0.0)
    half_days      = db.Column(db.Integer, default=0)
    late_days      = db.Column(db.Integer, default=0)
    paid_leave_days= db.Column(db.Float, default=0.0)
    unpaid_leave_days = db.Column(db.Float, default=0.0)
    weekly_off_days= db.Column(db.Integer, default=4)
    holiday_days   = db.Column(db.Integer, default=0)
    absent_days    = db.Column(db.Float, default=0.0)   # Unexcused absence

    # Salary computation
    base_gross_salary = db.Column(db.Float, default=0.0) # Master gross before deductions
    per_day_salary    = db.Column(db.Float, default=0.0)

    # Earnings
    basic_pay         = db.Column(db.Float, default=0.0)
    hra               = db.Column(db.Float, default=0.0)
    da                = db.Column(db.Float, default=0.0)
    ta                = db.Column(db.Float, default=0.0)
    special_allowance = db.Column(db.Float, default=0.0)
    other_allowances  = db.Column(db.Float, default=0.0)
    gross_salary      = db.Column(db.Float, default=0.0) # Actual calculated gross

    # Deductions
    lop_deduction     = db.Column(db.Float, default=0.0) # Loss of Pay for unpaid absence
    pf_deduction      = db.Column(db.Float, default=0.0)
    esi_deduction     = db.Column(db.Float, default=0.0)
    prof_tax          = db.Column(db.Float, default=0.0)
    tds               = db.Column(db.Float, default=0.0)
    other_deductions  = db.Column(db.Float, default=0.0)
    total_deductions  = db.Column(db.Float, default=0.0)

    net_salary        = db.Column(db.Float, default=0.0)
    payment_status    = db.Column(db.String(20), default='PENDING') # PENDING / PAID / HOLD
    payment_mode      = db.Column(db.String(30), default='BANK_TRANSFER')
    payment_date      = db.Column(db.Date, nullable=True)
    remarks           = db.Column(db.String(300), nullable=True)

    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    user  = db.relationship('User', foreign_keys=[user_id])
    items = db.relationship('PayrollSlipItem', backref='slip', cascade='all, delete-orphan')

    def to_dict(self):
        u = self.user
        return {
            'id':               self.id,
            'payroll_run_id':   self.payroll_run_id,
            'school_id':        self.school_id,
            'user_id':          self.user_id,
            'employee_name':    u.name if u else '',
            'employee_id':      getattr(u, 'employee_id', '') if u else '',
            'role':             u.role.value if u and u.role else '',
            'department':       u.department if u else '',
            'designation':      u.designation if u else '',
            'calendar_days':    self.calendar_days,
            'working_days':     self.working_days,
            'payable_days':     self.payable_days,
            'present_days':     self.present_days,
            'half_days':        self.half_days,
            'late_days':        self.late_days,
            'paid_leave_days':  self.paid_leave_days,
            'unpaid_leave_days':self.unpaid_leave_days,
            'weekly_off_days':  self.weekly_off_days,
            'holiday_days':     self.holiday_days,
            'absent_days':      self.absent_days,
            'base_gross_salary':self.base_gross_salary,
            'per_day_salary':   self.per_day_salary,
            'basic_pay':        self.basic_pay,
            'hra':              self.hra,
            'da':               self.da,
            'ta':               self.ta,
            'special_allowance':self.special_allowance,
            'other_allowances': self.other_allowances,
            'gross_salary':     self.gross_salary,
            'lop_deduction':    self.lop_deduction,
            'pf_deduction':     self.pf_deduction,
            'esi_deduction':    self.esi_deduction,
            'prof_tax':         self.prof_tax,
            'tds':              self.tds,
            'other_deductions': self.other_deductions,
            'total_deductions': self.total_deductions,
            'net_salary':       self.net_salary,
            'payment_status':   self.payment_status,
            'payment_mode':     self.payment_mode,
            'payment_date':     self.payment_date.isoformat() if self.payment_date else None,
            'remarks':          self.remarks or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


class PayrollSlipItem(db.Model):
    __tablename__ = 'payroll_slip_items'

    id             = db.Column(db.Integer, primary_key=True)
    payroll_slip_id= db.Column(db.Integer, db.ForeignKey('payroll_slips.id'), nullable=False)
    name           = db.Column(db.String(100), nullable=False)
    code           = db.Column(db.String(30), nullable=False)
    item_type      = db.Column(db.String(20), nullable=False) # EARNING / DEDUCTION
    amount         = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'id':        self.id,
            'name':      self.name,
            'code':      self.code,
            'item_type': self.item_type,
            'amount':    self.amount,
        }


# ═══════════════════════════════════════════════════════════════════════
#  9. HRMS AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════

class HRMSAuditLog(db.Model):
    __tablename__ = 'hrms_audit_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    target_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Employee affected
    actor_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)       # Who performed action

    action     = db.Column(db.String(50), nullable=False) # PROFILE_CREATED, SALARY_UPDATED, LEAVE_APPROVED, PAYROLL_LOCKED, etc.
    old_value  = db.Column(db.Text, nullable=True)
    new_value  = db.Column(db.Text, nullable=True)
    remarks    = db.Column(db.String(300), nullable=True)

    ip_address = db.Column(db.String(64), nullable=True)
    browser    = db.Column(db.String(200), nullable=True)
    device     = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id':             self.id,
            'target_user_id': self.target_user_id,
            'actor_id':       self.actor_id,
            'action':         self.action,
            'old_value':      self.old_value,
            'new_value':      self.new_value,
            'remarks':        self.remarks or '',
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }
