"""
School HRMS Business Logic Service Layer
OnePlatform360 / EduERP

Handles:
- Employee Lifecycle (Create, Update Profile, Status Transitions, Teacher & Staff compatibility)
- Departments & Designations management
- Shifts & Multi-shift Employee Assignments
- Employee Documents & Verification Workflow
- Leave Management (Leave Types, Balances, Requests, Approvals & Sync to Attendance)
- Official Duty (OD) / Outdoor Attendance Exceptions
- Audit Logging
"""

from datetime import datetime, date, timedelta
from app import db, bcrypt
from app.models.user import User, UserRole
from app.models.academic import Teacher
from app.models.hrms import (
    EmployeeProfile, EmployeeDepartment, EmployeeDesignation,
    Shift, EmployeeShiftAssignment, EmployeeDocument,
    LeaveType, LeaveBalance, LeaveRequest, OfficialDuty,
    SalaryComponent, SalaryStructure, SalaryStructureItem, EmployeeSalaryStructure,
    HRMSAuditLog, EmploymentStatus, EmploymentType, DocumentVerificationStatus,
    LeaveStatus
)
from app.models.staff_attendance import generate_employee_id
from app.utils.request_context import capture_request_context


# ═══════════════════════════════════════════════════════════════════════
#  AUDIT LOGGING
# ═══════════════════════════════════════════════════════════════════════

def log_hrms_audit(school_id, action, target_user_id=None, actor_id=None,
                   old_value=None, new_value=None, remarks=None):
    ctx = {}
    try:
        ctx = capture_request_context()
    except Exception:
        pass
    entry = HRMSAuditLog(
        school_id=school_id,
        target_user_id=target_user_id,
        actor_id=actor_id,
        action=action,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        remarks=remarks,
        ip_address=ctx.get('ip_address'),
        browser=ctx.get('browser'),
        device=ctx.get('os'),
    )
    db.session.add(entry)


# ═══════════════════════════════════════════════════════════════════════
#  1. EMPLOYEE LIFECYCLE & MASTER
# ═══════════════════════════════════════════════════════════════════════

def get_or_create_employee_profile(user):
    """Ensures an EmployeeProfile exists for this user."""
    profile = EmployeeProfile.query.filter_by(user_id=user.id).first()
    if not profile:
        profile = EmployeeProfile(
            user_id=user.id,
            school_id=user.school_id,
            employment_status=EmploymentStatus.ACTIVE.value if user.is_active else EmploymentStatus.INACTIVE.value,
            employment_type=EmploymentType.PERMANENT.value,
        )
        db.session.add(profile)
        db.session.commit()
    return profile


def create_employee(school_id, data, actor_user=None):
    """
    Creates a new employee (Teacher or Staff).
    Handles User creation, EmployeeProfile, and TeacherProfile (if TEACHER).
    """
    email = data.get('email', '').strip().lower()
    if not email:
        raise ValueError('Email is required.')

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        raise ValueError(f'User with email {email} already exists.')

    # Ensure role is valid
    role_str = (data.get('role') or 'TEACHER').upper()
    try:
        user_role = UserRole(role_str)
    except ValueError:
        user_role = UserRole.TEACHER

    # Generate employee_id if not provided
    emp_id = data.get('employee_id') or generate_employee_id(school_id)

    # Check if employee_id is taken within school
    existing_emp = User.query.filter_by(school_id=school_id, employee_id=emp_id).first()
    if existing_emp:
        emp_id = generate_employee_id(school_id)

    # Create User
    plain_password = data.get('password') or 'Staff@123'
    user = User(
        school_id=school_id,
        name=data.get('name', '').strip(),
        username=data.get('username') or emp_id,
        employee_id=emp_id,
        email=email,
        phone=data.get('phone'),
        role=user_role,
        department=data.get('department'),
        designation=data.get('designation'),
        salary=float(data.get('salary', 0.0)) if data.get('salary') else 0.0,
        is_active=True,
    )
    user.set_password(plain_password, store_plain=True)
    db.session.add(user)
    db.session.flush()

    # Parse Dates
    def _pdate(k):
        v = data.get(k)
        if not v:
            return None
        return date.fromisoformat(v) if isinstance(v, str) else v

    # Create EmployeeProfile
    profile = EmployeeProfile(
        user_id=user.id,
        school_id=school_id,
        gender=data.get('gender', 'MALE'),
        dob=_pdate('dob'),
        blood_group=data.get('blood_group'),
        marital_status=data.get('marital_status'),
        father_husband_name=data.get('father_husband_name'),
        emergency_contact=data.get('emergency_contact'),
        emergency_relation=data.get('emergency_relation'),
        current_address=data.get('current_address'),
        permanent_address=data.get('permanent_address'),
        city=data.get('city'),
        state=data.get('state'),
        pincode=data.get('pincode'),
        employment_type=data.get('employment_type', EmploymentType.PERMANENT.value),
        employment_status=data.get('employment_status', EmploymentStatus.ACTIVE.value),
        department_id=data.get('department_id'),
        designation_id=data.get('designation_id'),
        joining_date=_pdate('joining_date') or date.today(),
        probation_end_date=_pdate('probation_end_date'),
        confirmation_date=_pdate('confirmation_date'),
        reporting_manager_id=data.get('reporting_manager_id'),
        work_location=data.get('work_location', 'Main Campus'),
        qualification=data.get('qualification'),
        experience_years=float(data.get('experience_years', 0.0)),
        specialization=data.get('specialization'),
        bank_name=data.get('bank_name'),
        account_number=data.get('account_number'),
        ifsc_code=data.get('ifsc_code'),
        branch_name=data.get('branch_name'),
        pan_number=data.get('pan_number'),
        aadhaar_number=data.get('aadhaar_number'),
        uan_number=data.get('uan_number'),
        pf_number=data.get('pf_number'),
        esi_number=data.get('esi_number'),
    )
    db.session.add(profile)

    # If TEACHER role, also create/sync Teacher record for academic backward compatibility
    if user_role == UserRole.TEACHER:
        teacher = Teacher(
            user_id=user.id,
            school_id=school_id,
            employee_id=emp_id,
            department=data.get('department'),
            designation=data.get('designation', 'Teacher'),
            dob=_pdate('dob'),
            joining_date=_pdate('joining_date') or date.today(),
            qualification=data.get('qualification'),
            salary=float(data.get('salary', 0.0)) if data.get('salary') else 0.0,
            photo_url=data.get('avatar_url'),
        )
        db.session.add(teacher)

    # Initialize standard Leave Balances for the current session
    session_year = str(date.today().year)
    default_leave_types = LeaveType.query.filter_by(school_id=school_id, is_active=True).all()
    for lt in default_leave_types:
        bal = LeaveBalance(
            school_id=school_id,
            user_id=user.id,
            leave_type_id=lt.id,
            session_year=session_year,
            allocated=lt.annual_quota or 0.0,
            used=0.0,
            pending=0.0,
        )
        db.session.add(bal)

    # Initialize Base Salary Structure
    if data.get('salary') and float(data.get('salary')) > 0:
        base_sal = float(data.get('salary'))
        emp_sal = EmployeeSalaryStructure(
            school_id=school_id,
            user_id=user.id,
            effective_from=_pdate('joining_date') or date.today(),
            basic_salary=round(base_sal * 0.5, 2),
            hra=round(base_sal * 0.25, 2),
            da=round(base_sal * 0.15, 2),
            special_allowance=round(base_sal * 0.1, 2),
            gross_salary=base_sal,
            net_salary=base_sal,
            is_active=True,
        )
        emp_sal.calculate_totals()
        db.session.add(emp_sal)

    db.session.flush()

    log_hrms_audit(
        school_id=school_id,
        action='EMPLOYEE_CREATED',
        target_user_id=user.id,
        actor_id=actor_user.id if actor_user else None,
        new_value=f'Created {user.name} ({user.role.value}) - ID: {emp_id}',
    )
    db.session.commit()
    return user


def update_employee(user_id, school_id, data, actor_user=None):
    """Updates User, EmployeeProfile, and TeacherProfile (if applicable)."""
    user = User.query.filter_by(id=user_id, school_id=school_id).first_or_404()
    profile = get_or_create_employee_profile(user)

    old_snapshot = {
        'user': user.to_dict(),
        'profile': profile.to_dict(include_sensitive=True),
    }

    # User fields
    if 'name' in data:        user.name = data['name'].strip()
    if 'phone' in data:       user.phone = data['phone']
    if 'avatar_url' in data:  user.avatar_url = data['avatar_url']
    if 'department' in data:  user.department = data['department']
    if 'designation' in data: user.designation = data['designation']
    if 'salary' in data and data['salary'] is not None:
        user.salary = float(data['salary'])

    # Profile fields
    def _pdate(k):
        v = data.get(k)
        if not v:
            return None
        return date.fromisoformat(v) if isinstance(v, str) else v

    direct_fields = [
        'gender', 'blood_group', 'marital_status', 'father_husband_name',
        'emergency_contact', 'emergency_relation', 'current_address', 'permanent_address',
        'city', 'state', 'pincode', 'employment_type', 'employment_status',
        'department_id', 'designation_id', 'reporting_manager_id', 'work_location',
        'qualification', 'specialization', 'bank_name', 'account_number', 'ifsc_code',
        'branch_name', 'pan_number', 'aadhaar_number', 'uan_number', 'pf_number', 'esi_number',
    ]
    for f in direct_fields:
        if f in data:
            setattr(profile, f, data[f])

    if 'experience_years' in data and data['experience_years'] is not None:
        profile.experience_years = float(data['experience_years'])

    date_fields = ['dob', 'joining_date', 'probation_end_date', 'confirmation_date', 'exit_date']
    for df in date_fields:
        if df in data:
            setattr(profile, df, _pdate(df))

    if 'exit_reason' in data:
        profile.exit_reason = data['exit_reason']

    # Sync to Teacher profile if exists
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if teacher:
        teacher.department = user.department
        teacher.designation = user.designation or 'Teacher'
        if profile.dob:          teacher.dob = profile.dob
        if profile.joining_date: teacher.joining_date = profile.joining_date
        if profile.qualification:teacher.qualification = profile.qualification
        if user.salary:          teacher.salary = user.salary
        if user.avatar_url:      teacher.photo_url = user.avatar_url

    log_hrms_audit(
        school_id=school_id,
        action='EMPLOYEE_UPDATED',
        target_user_id=user.id,
        actor_id=actor_user.id if actor_user else None,
        old_value=old_snapshot,
        new_value={'user': user.to_dict(), 'profile': profile.to_dict(include_sensitive=True)},
    )
    db.session.commit()
    return user


def change_employee_status(user_id, school_id, new_status, exit_date=None, exit_reason=None, actor_user=None):
    """Transitions employee lifecycle status (ACTIVE, PROBATION, NOTICE_PERIOD, RESIGNED, TERMINATED, etc.)."""
    user = User.query.filter_by(id=user_id, school_id=school_id).first_or_404()
    profile = get_or_create_employee_profile(user)

    old_status = profile.employment_status
    profile.employment_status = new_status

    if new_status in (EmploymentStatus.RESIGNED.value, EmploymentStatus.TERMINATED.value, EmploymentStatus.RETIRED.value, EmploymentStatus.INACTIVE.value):
        user.is_active = False
        profile.exit_date = date.fromisoformat(exit_date) if isinstance(exit_date, str) else (exit_date or date.today())
        profile.exit_reason = exit_reason
    else:
        user.is_active = True
        profile.exit_date = None
        profile.exit_reason = None

    log_hrms_audit(
        school_id=school_id,
        action='EMPLOYMENT_STATUS_CHANGED',
        target_user_id=user.id,
        actor_id=actor_user.id if actor_user else None,
        old_value=old_status,
        new_value=new_status,
        remarks=exit_reason,
    )
    db.session.commit()
    return user


# ═══════════════════════════════════════════════════════════════════════
#  2. LEAVE MANAGEMENT SERVICES
# ═══════════════════════════════════════════════════════════════════════

def submit_leave_request(user, leave_type_id, from_date, to_date, reason,
                         is_half_day=False, half_day_session=None, attachment_url=None):
    """Validates and creates an employee leave application."""
    lt = LeaveType.query.filter_by(id=leave_type_id, school_id=user.school_id).first_or_404()
    if not lt.is_active:
        raise ValueError('Selected leave type is not active.')

    if from_date > to_date:
        raise ValueError('From Date cannot be after To Date.')

    # Calculate days
    if is_half_day:
        days_count = 0.5
    else:
        days_count = float((to_date - from_date).days + 1)

    # Check for overlapping pending/approved leave requests
    overlap = LeaveRequest.query.filter(
        LeaveRequest.user_id == user.id,
        LeaveRequest.status.in_([LeaveStatus.PENDING.value, LeaveStatus.APPROVED.value]),
        LeaveRequest.from_date <= to_date,
        LeaveRequest.to_date >= from_date,
    ).first()
    if overlap:
        raise ValueError(f'A leave request already exists for this date range ({overlap.from_date} to {overlap.to_date}).')

    # Verify balance if leave requires quota check
    session_year = str(from_date.year)
    bal = LeaveBalance.query.filter_by(user_id=user.id, leave_type_id=lt.id, session_year=session_year).first()
    if not bal:
        bal = LeaveBalance(
            school_id=user.school_id,
            user_id=user.id,
            leave_type_id=lt.id,
            session_year=session_year,
            allocated=lt.annual_quota or 0.0,
            used=0.0,
            pending=0.0,
        )
        db.session.add(bal)
        db.session.flush()

    if lt.is_paid and bal and bal.remaining < days_count:
        raise ValueError(f'Insufficient leave balance. Remaining: {bal.remaining} days, Requested: {days_count} days.')

    req = LeaveRequest(
        school_id=user.school_id,
        user_id=user.id,
        leave_type_id=lt.id,
        from_date=from_date,
        to_date=to_date,
        days_count=days_count,
        is_half_day=is_half_day,
        half_day_session=half_day_session,
        reason=reason,
        attachment_url=attachment_url,
        status=LeaveStatus.PENDING.value if lt.requires_approval else LeaveStatus.APPROVED.value,
    )
    db.session.add(req)

    # Update pending count in balance
    if bal:
        bal.pending = (bal.pending or 0.0) + days_count

    db.session.flush()

    # If auto-approved (no approval required)
    if not lt.requires_approval:
        _apply_approved_leave_to_attendance(req)
        if bal:
            bal.used = (bal.used or 0.0) + days_count
            bal.pending = max(0.0, (bal.pending or 0.0) - days_count)

    log_hrms_audit(
        school_id=user.school_id,
        action='LEAVE_REQUESTED',
        target_user_id=user.id,
        actor_id=user.id,
        new_value=f'{lt.name} from {from_date} to {to_date} ({days_count} days)',
        remarks=reason,
    )
    db.session.commit()
    return req


def review_leave_request(request_id, reviewer, approve=True, review_remarks=None):
    """Principal / HR reviews leave application."""
    req = LeaveRequest.query.get_or_404(request_id)
    if req.school_id != reviewer.school_id:
        raise ValueError('Unauthorized.')

    if req.status != LeaveStatus.PENDING.value:
        raise ValueError(f'Leave request is already {req.status}.')

    req.status = LeaveStatus.APPROVED.value if approve else LeaveStatus.REJECTED.value
    req.reviewed_by = reviewer.id
    req.reviewed_at = datetime.utcnow()
    req.review_remarks = review_remarks

    # Update balance
    session_year = str(req.from_date.year)
    bal = LeaveBalance.query.filter_by(user_id=req.user_id, leave_type_id=req.leave_type_id, session_year=session_year).first()
    if bal:
        bal.pending = max(0.0, (bal.pending or 0.0) - req.days_count)
        if approve:
            bal.used = (bal.used or 0.0) + req.days_count

    if approve:
        _apply_approved_leave_to_attendance(req)

    log_hrms_audit(
        school_id=req.school_id,
        action='LEAVE_REVIEWED',
        target_user_id=req.user_id,
        actor_id=reviewer.id,
        new_value=req.status,
        remarks=review_remarks,
    )
    db.session.commit()
    return req


def _apply_approved_leave_to_attendance(leave_request):
    """Synchronizes approved leave into daily staff attendance records."""
    from app.models.staff_attendance import StaffAttendance
    curr = leave_request.from_date
    while curr <= leave_request.to_date:
        rec = StaffAttendance.query.filter_by(user_id=leave_request.user_id, attendance_date=curr).first()
        if not rec:
            rec = StaffAttendance(
                school_id=leave_request.school_id,
                user_id=leave_request.user_id,
                attendance_date=curr,
            )
            db.session.add(rec)
        rec.status = 'ON_LEAVE'
        rec.approval_status = 'APPROVED'
        rec.rejection_reason = f"Approved Leave ({leave_request.leave_type.code if leave_request.leave_type else 'LEAVE'})"
        curr += timedelta(days=1)


# ═══════════════════════════════════════════════════════════════════════
#  3. OFFICIAL DUTY (OUTDOOR GPS EXEMPTION)
# ═══════════════════════════════════════════════════════════════════════

def submit_official_duty(user, from_date, to_date, duty_type, location, purpose):
    """Submits official duty / tour request."""
    if from_date > to_date:
        raise ValueError('From Date cannot be after To Date.')

    od = OfficialDuty(
        school_id=user.school_id,
        user_id=user.id,
        from_date=from_date,
        to_date=to_date,
        duty_type=duty_type,
        location=location,
        purpose=purpose,
        status='PENDING',
    )
    db.session.add(od)
    db.session.commit()
    return od


def review_official_duty(duty_id, reviewer, approve=True, review_remarks=None):
    """Principal approves/rejects official duty."""
    od = OfficialDuty.query.get_or_404(duty_id)
    if od.school_id != reviewer.school_id:
        raise ValueError('Unauthorized.')

    od.status = 'APPROVED' if approve else 'REJECTED'
    od.reviewed_by = reviewer.id
    od.reviewed_at = datetime.utcnow()
    od.review_remarks = review_remarks

    log_hrms_audit(
        school_id=od.school_id,
        action='OFFICIAL_DUTY_REVIEWED',
        target_user_id=od.user_id,
        actor_id=reviewer.id,
        new_value=od.status,
        remarks=review_remarks,
    )
    db.session.commit()
    return od


# ═══════════════════════════════════════════════════════════════════════
#  4. DOCUMENT VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

def verify_employee_document(doc_id, verifier, approve=True, verification_notes=None):
    doc = EmployeeDocument.query.get_or_404(doc_id)
    if doc.school_id != verifier.school_id:
        raise ValueError('Unauthorized.')

    doc.verification_status = DocumentVerificationStatus.VERIFIED.value if approve else DocumentVerificationStatus.REJECTED.value
    doc.verified_by = verifier.id
    doc.verified_at = datetime.utcnow()
    doc.verification_notes = verification_notes

    log_hrms_audit(
        school_id=doc.school_id,
        action='DOCUMENT_VERIFIED',
        target_user_id=doc.user_id,
        actor_id=verifier.id,
        new_value=doc.verification_status,
        remarks=verification_notes,
    )
    db.session.commit()
    return doc
