"""
School HRMS REST API Blueprint
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Routes:
- Dashboard:                 /api/hrms/dashboard
- Employee Directory & CRUD: /api/hrms/employees, /api/hrms/employees/<id>
- Status & Exit Management:  /api/hrms/employees/<id>/status
- Departments & Designations:/api/hrms/departments, /api/hrms/designations
- Shifts & Timing Policies:  /api/hrms/shifts, /api/hrms/shifts/assign
- Documents & Verification:  /api/hrms/employees/<id>/documents, /api/hrms/documents/<id>/verify
- Leave Management:          /api/hrms/leaves/types, /api/hrms/leaves/balances, /api/hrms/leaves/requests
- Official Duty (OD):        /api/hrms/official-duty
- Salary Structures:         /api/hrms/salary-structures, /api/hrms/employees/<id>/salary-structure
- Payroll Engine:            /api/hrms/payroll/calculate, /api/hrms/payroll/runs, /api/hrms/payroll/slips/<id>/pdf
- Employee Self-Service:     /api/hrms/my/profile, /api/hrms/my/leaves, /api/hrms/my/payslips
"""

from datetime import datetime, date, timedelta
from calendar import monthrange
import os
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import cloudinary.uploader

from app import db
from app.models.user import User, UserRole
from app.models.academic import Teacher, Class, Subject
from app.models.school import School
from app.models.hrms import (
    EmployeeProfile, EmployeeDepartment, EmployeeDesignation,
    Shift, EmployeeShiftAssignment, EmployeeDocument,
    LeaveType, LeaveBalance, LeaveRequest, OfficialDuty,
    SalaryComponent, SalaryStructure, SalaryStructureItem, EmployeeSalaryStructure,
    PayrollRun, PayrollSlip, PayrollSlipItem, HRMSAuditLog,
    EmploymentStatus, EmploymentType, DocumentVerificationStatus, LeaveStatus, PayrollRunStatus
)
from app.models.staff_attendance import StaffAttendance, StaffAttendanceSettings, StaffMonthlyAttendanceSummary
from app.services import hrms_service as h_svc
from app.services import payroll_engine as p_svc
from app.utils.decorators import role_required, get_current_user
from app.utils.payslip_generator import generate_payslip_pdf

hrms_bp = Blueprint('hrms', __name__)


def _school_id():
    return get_current_user().school_id


def _parse_date(value, default=None):
    if not value:
        return default
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


# ═══════════════════════════════════════════════════════════════════════
#  1. HRMS DASHBOARD (Principal / HR View)
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/dashboard', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'DIRECTOR', 'VICE_PRINCIPAL')
def get_hrms_dashboard():
    sid = _school_id()
    today = date.today()

    # Total Employees Breakdown via SQL count instead of loading all User models into RAM
    total_employees = User.query.filter(
        User.school_id == sid,
        User.role != UserRole.STUDENT,
        User.role != UserRole.PARENT,
    ).count()

    active_employees = User.query.filter(
        User.school_id == sid,
        User.role != UserRole.STUDENT,
        User.role != UserRole.PARENT,
        User.is_active == True
    ).count()

    teachers_count = User.query.filter(
        User.school_id == sid,
        User.role == UserRole.TEACHER,
        User.is_active == True
    ).count()

    staff_count = max(0, active_employees - teachers_count)

    # Today's Attendance stats
    att_rows = StaffAttendance.query.filter_by(school_id=sid, attendance_date=today).all()
    present_count = sum(1 for r in att_rows if r.status in ('PRESENT', 'LATE', 'HALF_DAY'))
    late_count = sum(1 for r in att_rows if r.status == 'LATE')
    half_day_count = sum(1 for r in att_rows if r.status == 'HALF_DAY')
    on_leave_count = sum(1 for r in att_rows if r.status == 'ON_LEAVE')
    pending_att_approvals = sum(1 for r in att_rows if r.approval_status == 'PENDING')

    marked_user_ids = {r.user_id for r in att_rows}
    absent_count = max(0, active_employees - present_count - on_leave_count)

    # Pending Leave Requests
    pending_leaves = LeaveRequest.query.filter_by(school_id=sid, status=LeaveStatus.PENDING.value).count()

    # Pending Official Duty Requests
    pending_od = OfficialDuty.query.filter_by(school_id=sid, status='PENDING').count()

    # Pending Document Verifications
    pending_docs = EmployeeDocument.query.filter_by(school_id=sid, verification_status=DocumentVerificationStatus.PENDING.value).count()

    # Current Month Payroll Status
    cur_month = today.month
    cur_year = today.year
    cur_payroll = PayrollRun.query.filter_by(school_id=sid, month=cur_month, year=cur_year).first()

    # Attendance Trend (Last 7 days) in a single grouped query
    start_dt = today - timedelta(days=6)
    history_counts = db.session.query(
        StaffAttendance.attendance_date,
        func.count(StaffAttendance.id)
    ).filter(
        StaffAttendance.school_id == sid,
        StaffAttendance.attendance_date >= start_dt,
        StaffAttendance.attendance_date <= today,
        StaffAttendance.status.in_(['PRESENT', 'LATE', 'HALF_DAY'])
    ).group_by(StaffAttendance.attendance_date).all()
    history_map = {dt: cnt for dt, cnt in history_counts}

    trend = []
    for i in range(6, -1, -1):
        dt = today - timedelta(days=i)
        p_ct = history_map.get(dt, 0)
        trend.append({
            'date': dt.strftime('%d %b'),
            'present': p_ct,
            'total': active_employees,
            'pct': round((p_ct / active_employees * 100), 1) if active_employees else 0,
        })

    # Department-wise Distribution
    depts = EmployeeDepartment.query.filter_by(school_id=sid).all()
    dept_distribution = []
    for d in depts:
        count = EmployeeProfile.query.filter_by(school_id=sid, department_id=d.id, employment_status=EmploymentStatus.ACTIVE.value).count()
        dept_distribution.append({'name': d.name, 'count': count})

    return jsonify({
        'date': today.isoformat(),
        'metrics': {
            'total_employees': total_employees,
            'active_employees': active_employees,
            'teachers_count': teachers_count,
            'staff_count': staff_count,
            'present_today': present_count,
            'absent_today': absent_count,
            'late_today': late_count,
            'half_day_today': half_day_count,
            'on_leave_today': on_leave_count,
            'pending_attendance_approvals': pending_att_approvals,
            'pending_leave_requests': pending_leaves,
            'pending_official_duties': pending_od,
            'pending_document_verifications': pending_docs,
        },
        'payroll_summary': {
            'month': cur_month,
            'year': cur_year,
            'status': cur_payroll.status if cur_payroll else 'NOT_GENERATED',
            'total_gross': cur_payroll.total_gross if cur_payroll else 0.0,
            'total_net': cur_payroll.total_net if cur_payroll else 0.0,
            'total_employees': cur_payroll.total_employees if cur_payroll else active_employees,
        },
        'attendance_trend': trend,
        'department_distribution': dept_distribution,
    }), 200


# ═══════════════════════════════════════════════════════════════════════
#  2. EMPLOYEE DIRECTORY & MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/employees', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT')
def list_employees():
    sid = _school_id()
    emp_type = request.args.get('type')             # ALL, TEACHER, STAFF
    dept_id  = request.args.get('department_id')
    status   = request.args.get('status', 'ACTIVE') # ACTIVE, ALL, PROBATION, RESIGNED, etc.
    search   = request.args.get('search', '').strip()

    q = User.query.filter(
        User.school_id == sid,
        User.role != UserRole.STUDENT,
        User.role != UserRole.PARENT,
    )

    if emp_type == 'TEACHER':
        q = q.filter(User.role == UserRole.TEACHER)
    elif emp_type == 'STAFF':
        q = q.filter(User.role != UserRole.TEACHER)

    if status != 'ALL':
        if status == 'ACTIVE':
            q = q.filter(User.is_active == True)
        elif status == 'INACTIVE':
            q = q.filter(User.is_active == False)

    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(User.name.ilike(like), User.email.ilike(like), User.employee_id.ilike(like), User.phone.ilike(like)))

    users = q.order_by(User.name.asc()).all()

    result = []
    for u in users:
        p = EmployeeProfile.query.filter_by(user_id=u.id).first()
        if dept_id and p and str(p.department_id) != str(dept_id):
            continue

        p_dict = p.to_dict() if p else {}
        result.append({
            'user_id':          u.id,
            'employee_id':      u.employee_id or '',
            'name':             u.name,
            'email':            u.email,
            'phone':            u.phone or '',
            'role':             u.role.value,
            'avatar_url':       u.avatar_url,
            'department':       p_dict.get('department') or u.department or '',
            'designation':      p_dict.get('designation') or u.designation or '',
            'joining_date':     p_dict.get('joining_date'),
            'employment_status':p_dict.get('employment_status') or ('ACTIVE' if u.is_active else 'INACTIVE'),
            'employment_type':  p_dict.get('employment_type') or 'PERMANENT',
            'salary':           u.salary or 0.0,
            'is_active':        u.is_active,
        })

    return jsonify(result), 200


@hrms_bp.route('/employees', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_employee_route():
    sid = _school_id()
    data = request.get_json() or {}
    actor = get_current_user()

    try:
        user = h_svc.create_employee(sid, data, actor_user=actor)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    profile = EmployeeProfile.query.filter_by(user_id=user.id).first()
    return jsonify({
        'message': 'Employee created successfully',
        'user': user.to_dict(),
        'profile': profile.to_dict(include_sensitive=True) if profile else None,
    }), 201


@hrms_bp.route('/employees/<int:user_id>', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'DIRECTOR', 'VICE_PRINCIPAL', 'ACCOUNTANT')
def get_employee_detail(user_id):
    sid = _school_id()
    user = User.query.filter_by(id=user_id, school_id=sid).first_or_404()
    profile = h_svc.get_or_create_employee_profile(user)

    # If teacher, get teaching classes and subjects
    academic_info = None
    if user.role == UserRole.TEACHER:
        teacher = Teacher.query.filter_by(user_id=user.id).first()
        if teacher:
            subjects = teacher.classes_taught.all()
            classes_assigned = []
            for s in subjects:
                c = s.class_ref
                if c:
                    classes_assigned.append({
                        'class_id': c.id,
                        'class_name': f"{c.name} - {c.section}".strip(' -'),
                        'subject_name': s.name,
                        'subject_id': s.id,
                    })
            class_teacher_classes = Class.query.filter_by(school_id=sid, teacher_id=teacher.id).all()
            ct_names = [f"{c.name} - {c.section}".strip(' -') for c in class_teacher_classes]

            academic_info = {
                'teacher_id': teacher.id,
                'classes_assigned': classes_assigned,
                'is_class_teacher_of': ct_names,
            }

    # Active Salary Structure
    sal_struct = EmployeeSalaryStructure.query.filter_by(user_id=user.id, is_active=True).first()

    # Leave Balances
    session_year = str(date.today().year)
    balances = LeaveBalance.query.filter_by(user_id=user.id, session_year=session_year).all()

    # Documents
    docs = EmployeeDocument.query.filter_by(user_id=user.id).all()

    # Shift Assignment
    shift_info = h_svc.Shift.query.get(1) # fallback
    assignment = EmployeeShiftAssignment.query.filter_by(user_id=user.id).order_by(EmployeeShiftAssignment.id.desc()).first()

    return jsonify({
        'user': user.to_dict(),
        'profile': profile.to_dict(include_sensitive=True),
        'academic': academic_info,
        'salary_structure': sal_struct.to_dict() if sal_struct else None,
        'leave_balances': [b.to_dict() for b in balances],
        'documents': [d.to_dict() for d in docs],
        'shift_assignment': assignment.to_dict() if assignment else None,
    }), 200


@hrms_bp.route('/employees/<int:user_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def update_employee_route(user_id):
    sid = _school_id()
    data = request.get_json() or {}
    actor = get_current_user()

    try:
        user = h_svc.update_employee(user_id, sid, data, actor_user=actor)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    profile = EmployeeProfile.query.filter_by(user_id=user.id).first()
    return jsonify({
        'message': 'Employee updated successfully',
        'user': user.to_dict(),
        'profile': profile.to_dict(include_sensitive=True) if profile else None,
    }), 200


@hrms_bp.route('/employees/<int:user_id>/status', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def change_employee_status_route(user_id):
    sid = _school_id()
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status:
        return jsonify({'error': 'Status is required'}), 400

    actor = get_current_user()
    try:
        user = h_svc.change_employee_status(
            user_id, sid, new_status,
            exit_date=data.get('exit_date'),
            exit_reason=data.get('exit_reason'),
            actor_user=actor
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({'message': f'Status updated to {new_status}'}), 200


# ═══════════════════════════════════════════════════════════════════════
#  3. DEPARTMENTS & DESIGNATIONS
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/departments', methods=['GET'])
@jwt_required()
def list_departments():
    sid = _school_id()
    depts = EmployeeDepartment.query.filter_by(school_id=sid).order_by(EmployeeDepartment.name.asc()).all()
    return jsonify([d.to_dict() for d in depts]), 200


@hrms_bp.route('/departments', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_department():
    sid = _school_id()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Department name is required'}), 400

    existing = EmployeeDepartment.query.filter_by(school_id=sid, name=name).first()
    if existing:
        return jsonify({'error': 'Department with this name already exists'}), 409

    dept = EmployeeDepartment(
        school_id=sid,
        name=name,
        code=data.get('code'),
        description=data.get('description'),
        head_user_id=data.get('head_user_id'),
    )
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@hrms_bp.route('/designations', methods=['GET'])
@jwt_required()
def list_designations():
    sid = _school_id()
    dept_id = request.args.get('department_id')
    q = EmployeeDesignation.query.filter_by(school_id=sid)
    if dept_id:
        q = q.filter_by(department_id=dept_id)
    desigs = q.order_by(EmployeeDesignation.name.asc()).all()
    return jsonify([d.to_dict() for d in desigs]), 200


@hrms_bp.route('/designations', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_designation():
    sid = _school_id()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Designation name is required'}), 400

    existing = EmployeeDesignation.query.filter_by(school_id=sid, name=name).first()
    if existing:
        return jsonify({'error': 'Designation with this name already exists'}), 409

    desig = EmployeeDesignation(
        school_id=sid,
        department_id=data.get('department_id'),
        name=name,
        code=data.get('code'),
        description=data.get('description'),
    )
    db.session.add(desig)
    db.session.commit()
    return jsonify(desig.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════
#  4. SHIFTS & TIMING POLICIES
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/shifts', methods=['GET'])
@jwt_required()
def list_shifts():
    sid = _school_id()
    shifts = Shift.query.filter_by(school_id=sid, is_active=True).all()
    return jsonify([s.to_dict() for s in shifts]), 200


@hrms_bp.route('/shifts', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_shift():
    sid = _school_id()
    data = request.get_json() or {}
    shift = Shift(
        school_id=sid,
        name=data.get('name', 'General Shift'),
        code=data.get('code'),
        start_time=data.get('start_time', '08:00'),
        end_time=data.get('end_time', '14:00'),
        grace_minutes=int(data.get('grace_minutes', 10)),
        half_day_after_minutes=int(data.get('half_day_after_minutes', 240)),
        full_day_minutes=int(data.get('full_day_minutes', 360)),
        break_duration_minutes=int(data.get('break_duration_minutes', 30)),
        is_default=bool(data.get('is_default', False)),
    )
    db.session.add(shift)
    db.session.commit()
    return jsonify(shift.to_dict()), 201


@hrms_bp.route('/shifts/assign', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def assign_shift():
    sid = _school_id()
    data = request.get_json() or {}
    user_id = data.get('user_id')
    shift_id = data.get('shift_id')
    valid_from = _parse_date(data.get('valid_from'), date.today())

    assignment = EmployeeShiftAssignment(
        school_id=sid,
        user_id=user_id,
        shift_id=shift_id,
        valid_from=valid_from,
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify(assignment.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════
#  5. EMPLOYEE DOCUMENTS & VERIFICATION
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/employees/<int:user_id>/documents', methods=['GET'])
@jwt_required()
def list_employee_documents(user_id):
    sid = _school_id()
    current_u = get_current_user()

    # Self or Admin check
    if current_u.id != user_id and current_u.role not in (UserRole.PRINCIPAL, UserRole.HR, UserRole.SUPER_ADMIN):
        return jsonify({'error': 'Unauthorized'}), 403

    docs = EmployeeDocument.query.filter_by(school_id=sid, user_id=user_id).order_by(EmployeeDocument.uploaded_at.desc()).all()
    return jsonify([d.to_dict() for d in docs]), 200


@hrms_bp.route('/employees/<int:user_id>/documents', methods=['POST'])
@jwt_required()
def upload_employee_document(user_id):
    sid = _school_id()
    current_u = get_current_user()

    if current_u.id != user_id and current_u.role not in (UserRole.PRINCIPAL, UserRole.HR, UserRole.SUPER_ADMIN):
        return jsonify({'error': 'Unauthorized'}), 403

    title = request.form.get('title')
    doc_type = request.form.get('doc_type', 'OTHER')
    file = request.files.get('file')

    if not title or not file:
        return jsonify({'error': 'Title and document file are required'}), 400

    filename = secure_filename(file.filename)
    try:
        upload_res = cloudinary.uploader.upload(
            file,
            folder=f'eduerp/hrms/{sid}/docs',
            public_id=f'empdoc_{user_id}_{filename}',
            resource_type='auto',
            overwrite=True,
        )
        file_url = upload_res['secure_url']
        file_size = upload_res.get('bytes')
    except Exception as e:
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

    doc = EmployeeDocument(
        school_id=sid,
        user_id=user_id,
        doc_type=doc_type,
        title=title,
        file_url=file_url,
        file_name=filename,
        file_size=file_size,
        issue_date=_parse_date(request.form.get('issue_date')),
        expiry_date=_parse_date(request.form.get('expiry_date')),
        verification_status=DocumentVerificationStatus.PENDING.value,
        uploaded_by=current_u.id,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc.to_dict()), 201


@hrms_bp.route('/documents/<int:doc_id>/verify', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def verify_document_route(doc_id):
    actor = get_current_user()
    data = request.get_json() or {}
    approve = bool(data.get('approve', True))
    notes = data.get('notes')

    try:
        doc = h_svc.verify_employee_document(doc_id, actor, approve=approve, verification_notes=notes)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(doc.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════
#  6. LEAVE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/leaves/types', methods=['GET'])
@jwt_required()
def list_leave_types():
    sid = _school_id()
    types = LeaveType.query.filter_by(school_id=sid, is_active=True).all()
    if not types:
        # Seed default leave types for this school
        defaults = [
            {'name': 'Casual Leave', 'code': 'CL', 'quota': 12.0, 'is_paid': True},
            {'name': 'Sick Leave', 'code': 'SL', 'quota': 10.0, 'is_paid': True},
            {'name': 'Earned Leave', 'code': 'EL', 'quota': 15.0, 'is_paid': True},
            {'name': 'Maternity Leave', 'code': 'ML', 'quota': 90.0, 'is_paid': True},
            {'name': 'Unpaid Leave (LOP)', 'code': 'LOP', 'quota': 30.0, 'is_paid': False},
        ]
        for d in defaults:
            lt = LeaveType(
                school_id=sid,
                name=d['name'],
                code=d['code'],
                annual_quota=d['quota'],
                is_paid=d['is_paid'],
            )
            db.session.add(lt)
        db.session.commit()
        types = LeaveType.query.filter_by(school_id=sid, is_active=True).all()

    return jsonify([t.to_dict() for t in types]), 200


@hrms_bp.route('/leaves/types', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_leave_type():
    sid = _school_id()
    data = request.get_json() or {}
    lt = LeaveType(
        school_id=sid,
        name=data.get('name'),
        code=data.get('code', '').upper(),
        description=data.get('description'),
        annual_quota=float(data.get('annual_quota', 12.0)),
        is_paid=bool(data.get('is_paid', True)),
        allow_half_day=bool(data.get('allow_half_day', True)),
        requires_approval=bool(data.get('requires_approval', True)),
    )
    db.session.add(lt)
    db.session.commit()
    return jsonify(lt.to_dict()), 201


@hrms_bp.route('/leaves/balances', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def list_leave_balances():
    sid = _school_id()
    session_year = request.args.get('session', str(date.today().year))
    balances = LeaveBalance.query.filter_by(school_id=sid, session_year=session_year).all()
    return jsonify([b.to_dict() for b in balances]), 200


@hrms_bp.route('/leaves/requests', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def list_leave_requests():
    sid = _school_id()
    status_filter = request.args.get('status')
    q = LeaveRequest.query.filter_by(school_id=sid)
    if status_filter:
        q = q.filter_by(status=status_filter)
    reqs = q.order_by(LeaveRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reqs]), 200


@hrms_bp.route('/leaves/requests', methods=['POST'])
@jwt_required()
def apply_leave():
    user = get_current_user()
    data = request.get_json() or {}

    leave_type_id = data.get('leave_type_id')
    from_date = _parse_date(data.get('from_date'))
    to_date = _parse_date(data.get('to_date'))
    reason = data.get('reason', '').strip()

    if not leave_type_id or not from_date or not to_date or not reason:
        return jsonify({'error': 'Leave type, date range, and reason are required.'}), 400

    try:
        req = h_svc.submit_leave_request(
            user,
            leave_type_id=leave_type_id,
            from_date=from_date,
            to_date=to_date,
            reason=reason,
            is_half_day=bool(data.get('is_half_day', False)),
            half_day_session=data.get('half_day_session'),
            attachment_url=data.get('attachment_url'),
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(req.to_dict()), 201


@hrms_bp.route('/leaves/requests/<int:req_id>/review', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def review_leave_route(req_id):
    actor = get_current_user()
    data = request.get_json() or {}
    approve = bool(data.get('approve', True))
    remarks = data.get('remarks')

    try:
        req = h_svc.review_leave_request(req_id, actor, approve=approve, review_remarks=remarks)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(req.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════
#  7. OFFICIAL DUTY (OD)
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/official-duty', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def list_official_duties():
    sid = _school_id()
    duties = OfficialDuty.query.filter_by(school_id=sid).order_by(OfficialDuty.created_at.desc()).all()
    return jsonify([d.to_dict() for d in duties]), 200


@hrms_bp.route('/official-duty', methods=['POST'])
@jwt_required()
def apply_official_duty():
    user = get_current_user()
    data = request.get_json() or {}

    from_date = _parse_date(data.get('from_date'))
    to_date = _parse_date(data.get('to_date'))
    location = (data.get('location') or '').strip()
    purpose = (data.get('purpose') or '').strip()

    if not from_date or not to_date or not location or not purpose:
        return jsonify({'error': 'Date range, location, and purpose are required.'}), 400

    try:
        od = h_svc.submit_official_duty(
            user,
            from_date=from_date,
            to_date=to_date,
            duty_type=data.get('duty_type', 'SCHOOL_EVENT'),
            location=location,
            purpose=purpose,
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(od.to_dict()), 201


@hrms_bp.route('/official-duty/<int:duty_id>/review', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def review_official_duty_route(duty_id):
    actor = get_current_user()
    data = request.get_json() or {}
    approve = bool(data.get('approve', True))
    remarks = data.get('remarks')

    try:
        od = h_svc.review_official_duty(duty_id, actor, approve=approve, review_remarks=remarks)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify(od.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════
#  8. SALARY STRUCTURE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/salary-structures', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'ACCOUNTANT')
def list_salary_structures():
    sid = _school_id()
    structs = SalaryStructure.query.filter_by(school_id=sid, is_active=True).all()
    return jsonify([s.to_dict() for s in structs]), 200


@hrms_bp.route('/salary-structures', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def create_salary_structure():
    sid = _school_id()
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Structure name is required'}), 400

    struct = SalaryStructure(
        school_id=sid,
        name=name,
        description=data.get('description'),
    )
    db.session.add(struct)
    db.session.flush()

    for item in data.get('items', []):
        s_item = SalaryStructureItem(
            structure_id=struct.id,
            component_id=item['component_id'],
            amount_type=item.get('amount_type', 'FIXED'),
            default_amount=float(item.get('default_amount', 0.0)),
        )
        db.session.add(s_item)

    db.session.commit()
    return jsonify(struct.to_dict()), 201


@hrms_bp.route('/employees/<int:user_id>/salary-structure', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN')
def assign_employee_salary_structure(user_id):
    sid = _school_id()
    user = User.query.filter_by(id=user_id, school_id=sid).first_or_404()
    data = request.get_json() or {}
    actor = get_current_user()

    effective_from = _parse_date(data.get('effective_from'), date.today())

    # Deactivate previous active structures
    prev_structs = EmployeeSalaryStructure.query.filter_by(user_id=user.id, is_active=True).all()
    for ps in prev_structs:
        ps.is_active = False
        ps.effective_to = effective_from - timedelta(days=1)

    emp_sal = EmployeeSalaryStructure(
        school_id=sid,
        user_id=user.id,
        structure_id=data.get('structure_id'),
        effective_from=effective_from,
        basic_salary=float(data.get('basic_salary', 0.0)),
        hra=float(data.get('hra', 0.0)),
        da=float(data.get('da', 0.0)),
        ta=float(data.get('ta', 0.0)),
        special_allowance=float(data.get('special_allowance', 0.0)),
        other_allowances=float(data.get('other_allowances', 0.0)),
        pf_deduction=float(data.get('pf_deduction', 0.0)),
        esi_deduction=float(data.get('esi_deduction', 0.0)),
        prof_tax=float(data.get('prof_tax', 0.0)),
        tds=float(data.get('tds', 0.0)),
        other_deductions=float(data.get('other_deductions', 0.0)),
        is_active=True,
        created_by=actor.id,
    )
    gross, net = emp_sal.calculate_totals()

    # Sync User.salary & Teacher.salary with new gross
    user.salary = gross
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if teacher:
        teacher.salary = gross

    db.session.add(emp_sal)
    h_svc.log_hrms_audit(
        school_id=sid,
        action='SALARY_STRUCTURE_ASSIGNED',
        target_user_id=user.id,
        actor_id=actor.id,
        new_value=f'Assigned Gross: ₹{gross:,.2f}, Net: ₹{net:,.2f}',
    )
    db.session.commit()
    return jsonify(emp_sal.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════
#  9. PAYROLL RUN & SLIPS
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/payroll/calculate', methods=['POST'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'ACCOUNTANT')
def calculate_monthly_payroll():
    sid = _school_id()
    data = request.get_json() or {}
    actor = get_current_user()

    month = int(data.get('month', date.today().month))
    year  = int(data.get('year', date.today().year))
    policy = data.get('calculation_policy', 'PAYABLE_DAYS')

    try:
        run = p_svc.generate_payroll_run(sid, month, year, calculation_policy=policy, actor_user=actor)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({
        'message': f'Payroll batch for {run.month_name} generated successfully.',
        'run': run.to_dict(),
        'slips_count': len(run.slips),
    }), 201


@hrms_bp.route('/payroll/runs', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'ACCOUNTANT')
def list_payroll_runs():
    sid = _school_id()
    year = request.args.get('year')
    q = PayrollRun.query.filter_by(school_id=sid)
    if year:
        q = q.filter_by(year=int(year))
    runs = q.order_by(PayrollRun.year.desc(), PayrollRun.month.desc()).all()
    return jsonify([r.to_dict() for r in runs]), 200


@hrms_bp.route('/payroll/runs/<int:run_id>', methods=['GET'])
@role_required('PRINCIPAL', 'HR', 'SUPER_ADMIN', 'ACCOUNTANT')
def get_payroll_run_detail(run_id):
    sid = _school_id()
    run = PayrollRun.query.filter_by(id=run_id, school_id=sid).first_or_404()
    slips = [s.to_dict() for s in run.slips]
    return jsonify({
        'run': run.to_dict(),
        'slips': slips,
    }), 200


@hrms_bp.route('/payroll/runs/<int:run_id>/approve', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def approve_payroll_run_route(run_id):
    actor = get_current_user()
    try:
        run = p_svc.approve_payroll_run(run_id, actor)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(run.to_dict()), 200


@hrms_bp.route('/payroll/runs/<int:run_id>/lock', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def lock_payroll_run_route(run_id):
    actor = get_current_user()
    try:
        run = p_svc.lock_payroll_run(run_id, actor)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(run.to_dict()), 200


@hrms_bp.route('/payroll/slips/<int:slip_id>/pay', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT', 'HR')
def pay_payroll_slip_route(slip_id):
    actor = get_current_user()
    data = request.get_json() or {}
    payment_mode = data.get('payment_mode', 'BANK_TRANSFER')
    transaction_ref = (data.get('transaction_ref') or '').strip()
    remarks = data.get('remarks')

    try:
        slip, exp = p_svc.pay_payroll_slip(
            slip_id=slip_id,
            payment_mode=payment_mode,
            transaction_ref=transaction_ref,
            paid_by_user=actor,
            remarks=remarks
        )
        return jsonify({
            'message': f'Salary for {slip.user.name} paid successfully!',
            'slip': slip.to_dict(),
            'expense': exp.to_dict(),
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hrms_bp.route('/payroll/runs/<int:run_id>/pay-all', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT')
def pay_payroll_run_all_route(run_id):
    actor = get_current_user()
    data = request.get_json() or {}
    payment_mode = data.get('payment_mode', 'BANK_TRANSFER')
    remarks = data.get('remarks')

    try:
        run, count = p_svc.pay_payroll_run_all(
            payroll_run_id=run_id,
            payment_mode=payment_mode,
            paid_by_user=actor,
            remarks=remarks
        )
        return jsonify({
            'message': f'Disbursed {count} salary payments for {run.month_name} successfully!',
            'run': run.to_dict(),
            'paid_count': count,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@hrms_bp.route('/payroll/slips/<int:slip_id>/pdf', methods=['GET'])
@jwt_required()
def download_payslip_pdf(slip_id):
    current_u = get_current_user()
    slip = PayrollSlip.query.get_or_404(slip_id)

    # Permission check: Self or Principal/HR/Accountant
    if slip.user_id != current_u.id and current_u.role not in (UserRole.PRINCIPAL, UserRole.HR, UserRole.SUPER_ADMIN, UserRole.ACCOUNTANT):
        return jsonify({'error': 'Unauthorized'}), 403

    school = School.query.get(slip.school_id)
    profile = EmployeeProfile.query.filter_by(user_id=slip.user_id).first()

    pdf_buf = generate_payslip_pdf(slip, school, employee_profile=profile)
    filename = f"Payslip_{slip.user.employee_id or slip.user_id}_{slip.payroll_run.month_name.replace(' ', '_')}.pdf"

    return send_file(
        pdf_buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename,
    )


# ═══════════════════════════════════════════════════════════════════════
#  10. EMPLOYEE SELF-SERVICE ("MY HR")
# ═══════════════════════════════════════════════════════════════════════

@hrms_bp.route('/my/profile', methods=['GET'])
@jwt_required()
def get_my_profile():
    user = get_current_user()
    profile = h_svc.get_or_create_employee_profile(user)
    sal_struct = EmployeeSalaryStructure.query.filter_by(user_id=user.id, is_active=True).first()

    session_year = str(date.today().year)
    balances = LeaveBalance.query.filter_by(user_id=user.id, session_year=session_year).all()

    return jsonify({
        'user': user.to_dict(),
        'profile': profile.to_dict(include_sensitive=True),
        'salary_structure': sal_struct.to_dict() if sal_struct else None,
        'leave_balances': [b.to_dict() for b in balances],
    }), 200


@hrms_bp.route('/my/leaves', methods=['GET'])
@jwt_required()
def get_my_leaves():
    user = get_current_user()
    session_year = str(date.today().year)

    balances = LeaveBalance.query.filter_by(user_id=user.id, session_year=session_year).all()
    requests = LeaveRequest.query.filter_by(user_id=user.id).order_by(LeaveRequest.created_at.desc()).all()

    return jsonify({
        'balances': [b.to_dict() for b in balances],
        'requests': [r.to_dict() for r in requests],
    }), 200


@hrms_bp.route('/my/payslips', methods=['GET'])
@jwt_required()
def get_my_payslips():
    user = get_current_user()
    slips = PayrollSlip.query.filter_by(user_id=user.id).join(PayrollRun).order_by(PayrollRun.year.desc(), PayrollRun.month.desc()).all()

    result = []
    for s in slips:
        d = s.to_dict()
        d['month_name'] = s.payroll_run.month_name
        d['payroll_status'] = s.payroll_run.status
        result.append(d)

    return jsonify(result), 200


@hrms_bp.route('/my/official-duty', methods=['GET'])
@jwt_required()
def get_my_official_duty():
    user = get_current_user()
    duties = OfficialDuty.query.filter_by(user_id=user.id).order_by(OfficialDuty.created_at.desc()).all()
    return jsonify([d.to_dict() for d in duties]), 200
