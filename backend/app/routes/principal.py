from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User, UserRole
from app.models.academic import (
    Class, Teacher, Student, Subject, Marks,
    Attendance, TeacherAttendance, TeacherAttendanceRequest, Note
)
from app.models.financial import FeeRecord, FeeStructure, FeeTransaction, ExamSchedule, ExamTimetable, Holiday, Timetable, TimetablePeriod

from app.utils.decorators import role_required, get_current_user
from app.utils.feature_gate import feature_required
from app.utils.pdf_generator import generate_admit_card, generate_result_card
from app.routes.admin import FEATURE_CATALOG, PLAN_PRESETS, PLAN_PRICING

from sqlalchemy import func
from datetime import date, datetime
import random, string
import cloudinary.uploader
import os
principal_bp = Blueprint('principal', __name__)
import io

def _school_id():
    return get_current_user().school_id


def _gen_receipt():
    """Generate unique receipt number like RCP-20240518-AB12"""
    today = date.today().strftime('%Y%m%d')
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"RCP-{today}-{suffix}"


# ─── Classes ──────────────────────────────────────────────────────────────────

@principal_bp.route('/classes', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_classes():
    classes = Class.query.filter_by(school_id=_school_id()).all()
    result = []
    for c in classes:
        d = c.to_dict()
        d['student_count'] = c.students.count()
        result.append(d)
    return jsonify(result), 200
@principal_bp.route('/classes/<int:class_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'TEACHER')
def update_class(class_id):
    cls = Class.query.get_or_404(class_id)
    if cls.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if data.get('name'):    cls.name    = data['name']
    if data.get('section'): cls.section = data['section']
    if data.get('session'): cls.session = data['session']
    db.session.commit()
    return jsonify(cls.to_dict()), 200

@principal_bp.route('/classes', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_class():
    data = request.get_json()
    cls = Class(
        name=data['name'],
        section=data.get('section', 'A'),
        session=data.get('session', '2024-25'),
        school_id=_school_id()
    )
    db.session.add(cls)
    db.session.commit()
    return jsonify(cls.to_dict()), 201

@principal_bp.route('/classes/<int:class_id>/detail', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
@feature_required('advanced_analytics')
def class_detail(class_id):
    sid = _school_id()
    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    from sqlalchemy.orm import joinedload
    students = Student.query.options(
        joinedload(Student.user)
    ).filter_by(class_id=class_id).all()
    total_students = len(students)

    # ── Fee summary ──
    student_ids = [s.id for s in students]
    total_due  = db.session.query(func.sum(FeeRecord.amount_due))\
                   .filter(FeeRecord.student_id.in_(student_ids)).scalar() or 0 if student_ids else 0
    total_paid = db.session.query(func.sum(FeeRecord.amount_paid))\
                   .filter(FeeRecord.student_id.in_(student_ids)).scalar() or 0 if student_ids else 0

    # Single query — per student fee aggregates
    from sqlalchemy import case
    fee_agg = db.session.query(
        FeeRecord.student_id,
        func.sum(FeeRecord.amount_due).label('due'),
        func.sum(FeeRecord.amount_paid).label('paid'),
    ).filter(FeeRecord.student_id.in_(student_ids))\
     .group_by(FeeRecord.student_id).all() if student_ids else []
    
    fee_paid_count    = 0
    fee_pending_count = 0
    fee_agg_map = {r.student_id: r for r in fee_agg}
    for s in students:
        r = fee_agg_map.get(s.id)
        if r and r.due > 0 and r.paid >= r.due:
            fee_paid_count += 1
        else:
            fee_pending_count += 1

    # ── Marks / Topper ──
    from collections import defaultdict
    from sqlalchemy import desc

    all_marks = Marks.query.filter(Marks.student_id.in_(student_ids)).all() if student_ids else []

    # Per-student aggregate: total obtained / total max → percentage
    student_marks_map = defaultdict(lambda: {'obtained': 0, 'max': 0})
    for m in all_marks:
        student_marks_map[m.student_id]['obtained'] += m.marks_obtained or 0
        student_marks_map[m.student_id]['max']      += m.max_marks or 0

    # Exam types available
    exam_types = list({m.exam_type for m in all_marks})

    # Overall topper (all exams combined)
    topper = None
    best_pct = -1
    for s in students:
        rec = student_marks_map.get(s.id)
        if rec and rec['max'] > 0:
            pct = round(rec['obtained'] / rec['max'] * 100, 1)
            if pct > best_pct:
                best_pct = pct
                topper = {
                    'student_id': s.id,
                    'name':       s.user.name if s.user else '',
                    'roll_number': s.roll_number or '',
                    'percentage': pct,
                    'obtained':   rec['obtained'],
                    'max':        rec['max'],
                }

    # Subject-wise toppers
    subject_toppers = {}
    subjects = cls.subjects.all()
    for subj in subjects:
        subj_marks = [m for m in all_marks if m.subject_id == subj.id]
        if not subj_marks:
            continue
        top_m = max(subj_marks, key=lambda m: m.marks_obtained or 0)
        # student already loaded in memory — no extra DB call
        top_student = next((s for s in students if s.id == top_m.student_id), None)
        subject_toppers[subj.name] = {
            'student_id':   top_m.student_id,
            'name':         top_student.user.name if top_student and top_student.user else '',
            'marks':        top_m.marks_obtained,
            'max_marks':    top_m.max_marks,
            'percentage':   round(top_m.marks_obtained / top_m.max_marks * 100, 1) if top_m.max_marks else 0,
        }

    # Class avg percentage
    all_pcts = []
    for s in students:
        rec = student_marks_map.get(s.id)
        if rec and rec['max'] > 0:
            all_pcts.append(rec['obtained'] / rec['max'] * 100)
    avg_percentage = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0

    # ── Class Teacher ──
    class_teacher = None
    if cls.teacher_id:
        t = Teacher.query.get(cls.teacher_id)
        if t:
            class_teacher = {
                'teacher_id':  t.id,
                'name':        t.user.name if t.user else '',
                'email':       t.user.email if t.user else '',
                'designation': t.designation or 'Teacher',
                'department':  t.department or '',
                'employee_id': t.employee_id or '',
                'salary':      t.salary or 0,
            }

    # ── Today's attendance ──
    today = date.today()
    att_today = Attendance.query.filter(
        Attendance.student_id.in_(student_ids),
        Attendance.date == today
    ).all() if student_ids else []
    present_today = sum(1 for a in att_today if a.status == 'PRESENT')
    absent_today  = sum(1 for a in att_today if a.status == 'ABSENT')

    return jsonify({
        'class_id':       cls.id,
        'class_name':     cls.name,
        'section':        cls.section,
        'session':        cls.session,
        'total_students': total_students,
        'fees': {
            'total_due':    total_due,
            'total_paid':   total_paid,
            'pending':      total_due - total_paid,
            'paid_count':   fee_paid_count,
            'pending_count':fee_pending_count,
            'collection_pct': round(total_paid / total_due * 100, 1) if total_due else 0,
        },
        'marks': {
            'avg_percentage': avg_percentage,
            'exam_types':     exam_types,
            'topper':         topper,
            'subject_toppers': subject_toppers,
        },
        'attendance_today': {
            'present':    present_today,
            'absent':     absent_today,
            'not_marked': total_students - len(att_today),
        },
        'class_teacher': class_teacher,
    }), 200


@principal_bp.route('/classes/<int:class_id>/assign-teacher', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def assign_class_teacher(class_id):
    """Assign a class teacher to a class."""
    cls = Class.query.get_or_404(class_id)
    data = request.get_json()
    cls.teacher_id = data.get('teacher_id')
    db.session.commit()
    return jsonify({'message': 'Class teacher assigned'}), 200
# ─── Teachers ─────────────────────────────────────────────────────────────────

@principal_bp.route('/teachers', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
@feature_required('teacher_management')
def list_teachers():
    teachers = Teacher.query.filter_by(school_id=_school_id()).all()
    return jsonify([t.to_dict() for t in teachers]), 200


@principal_bp.route('/teachers', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
@feature_required('teacher_management')
def create_teacher():
    from app.utils.plan_limits import get_limit, get_school_plan
    from app.models.academic import Teacher as TeacherModel

    data  = request.get_json()
    sid   = _school_id()
    plan  = get_school_plan(sid)
    limit = get_limit(plan, 'teachers')

    current_count = TeacherModel.query.filter_by(school_id=sid).count()
    if current_count >= limit:
        return jsonify({
            'error':   'teacher_limit_reached',
            'message': f'Aapke {plan} plan mein sirf {limit} teachers allowed hain. '
                       f'Abhi {current_count} teachers hain. Upgrade karo.',
            'current': current_count,
            'limit':   limit,
            'plan':    plan,
        }), 403

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    user = User(
        name=data['name'], email=data['email'].lower(),
        role=UserRole.TEACHER, school_id=sid,
        phone=data.get('phone')
    )
    user.set_password(data.get('password', 'Teacher@123'))
    db.session.add(user)
    db.session.flush()
    
    teacher = Teacher(
        user_id      = user.id,
        school_id    = _school_id(),
        employee_id  = data.get('employee_id'),
        department   = data.get('department'),
        designation  = data.get('designation', 'Teacher'),
        salary       = float(data['salary']) if data.get('salary') else 0.0,
        joining_date = date.fromisoformat(data['joining_date']) if data.get('joining_date') else None,
        qualification= data.get('qualification', ''),
    )
    db.session.add(teacher)
    db.session.commit()
    return jsonify(teacher.to_dict()), 201


@principal_bp.route('/teachers/<int:t_id>/assign', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def assign_teacher(t_id):
    data = request.get_json()
    subject = Subject.query.get_or_404(data['subject_id'])
    subject.teacher_id = t_id
    db.session.commit()
    return jsonify({'message': 'Teacher assigned'}), 200

@principal_bp.route('/teachers/<int:teacher_id>/profile', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
@feature_required('teacher_management')
def teacher_profile(teacher_id):
    sid = _school_id()
    t   = Teacher.query.get_or_404(teacher_id)
    if t.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    current_user  = get_current_user()
    can_see_salary = (
        current_user.role == UserRole.PRINCIPAL or t.user_id == current_user.id
    )

    user = t.user

    # ── Basic Info ──
    info = {
        'id':           t.id,
        'name':         user.name        if user else '',
        'email':        user.email       if user else '',
        'phone':        user.phone       if user else '',
        'employee_id':  t.employee_id    or '',
        'department':   t.department     or '',
        'designation':  t.designation    or 'Teacher',
        'joining_date': str(t.joining_date) if t.joining_date else '',
        'qualification':t.qualification  or '',
        'salary':       (t.salary or 0) if can_see_salary else None,
        'subjects_count': t.classes_taught.count(),
        'photo_url': t.photo_url or '',
    }

    # ── Classes & Subjects taught ──
    subjects      = t.classes_taught.all()
    classes_taught = []
    seen_classes   = set()

    for subj in subjects:
        cls = Class.query.get(subj.class_id)
        if not cls:
            continue
        is_class_teacher = (cls.teacher_id == t.id)
        classes_taught.append({
            'class_id':         cls.id,
            'class_name':       cls.name,
            'section':          cls.section,
            'session':          cls.session,
            'subject_name':     subj.name,
            'subject_id':       subj.id,
            'student_count':    cls.students.count(),
            'is_class_teacher': is_class_teacher,
        })
        seen_classes.add(cls.id)

    # Also check if class teacher of any class not in subjects
    class_teacher_of = Class.query.filter_by(
        school_id=sid, teacher_id=t.id
    ).all()
    for cls in class_teacher_of:
        if cls.id not in seen_classes:
            classes_taught.append({
                'class_id':         cls.id,
                'class_name':       cls.name,
                'section':          cls.section,
                'session':          cls.session,
                'subject_name':     'Class Teacher',
                'subject_id':       None,
                'student_count':    cls.students.count(),
                'is_class_teacher': True,
            })

    # ── Attendance ──
    all_att = TeacherAttendance.query.filter_by(
        teacher_id=teacher_id
    ).all()

    present   = sum(1 for a in all_att if a.status == 'PRESENT')
    absent    = sum(1 for a in all_att if a.status == 'ABSENT')
    half_day  = sum(1 for a in all_att if a.status == 'HALF_DAY')
    on_leave  = sum(1 for a in all_att if a.status == 'ON_LEAVE')
    total_marked = len(all_att)

    # Month-wise breakdown
    from collections import defaultdict
    month_map = defaultdict(lambda: {'present':0,'absent':0,'half_day':0,'on_leave':0})
    for a in all_att:
        key = a.date.strftime('%Y-%m')
        if   a.status == 'PRESENT':  month_map[key]['present']  += 1
        elif a.status == 'ABSENT':   month_map[key]['absent']   += 1
        elif a.status == 'HALF_DAY': month_map[key]['half_day'] += 1
        elif a.status == 'ON_LEAVE': month_map[key]['on_leave'] += 1

    monthly = [
        {
            'month':    k,
            'present':  v['present'],
            'absent':   v['absent'],
            'half_day': v['half_day'],
            'on_leave': v['on_leave'],
        }
        for k, v in sorted(month_map.items(), reverse=True)
    ]

    attendance = {
        'total_marked': total_marked,
        'present':      present,
        'absent':       absent,
        'half_day':     half_day,
        'on_leave':     on_leave,
        'percentage':   round(present / total_marked * 100, 1) if total_marked else 0,
        'monthly':      monthly,
    }

    # ── Salary History ──
    salary_history = []
    if can_see_salary:
        from app.models.financial import SalaryRecord
        sal_records = SalaryRecord.query.filter_by(
            teacher_id=teacher_id
        ).order_by(SalaryRecord.created_at.desc()).all() \
        if hasattr(SalaryRecord, 'query') else []

        salary_history = [
            {
                'month':        s.month,
                'amount':       s.amount,
                'status':       s.status,
                'payment_date': str(s.payment_date) if s.payment_date else None,
                'note':         s.note or '',
            }
            for s in sal_records
        ]

    return jsonify({
        'info':           info,
        'classes_taught': classes_taught,
        'attendance':     attendance,
        'salary_history': salary_history,
    }), 200


@principal_bp.route('/teachers/<int:teacher_id>/salary', methods=['PATCH'])
@role_required('PRINCIPAL')
@feature_required('payroll_system')
def update_teacher_salary(teacher_id):
    """Principal manually update kare teacher ki salary."""
    t = Teacher.query.get_or_404(teacher_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data       = request.get_json()
    old_salary = t.salary or 0
    new_salary = float(data.get('salary', 0))
    t.salary   = new_salary
    db.session.commit()

    return jsonify({
        'message':    'Salary updated',
        'old_salary': old_salary,
        'new_salary': new_salary,
    }), 200


@principal_bp.route('/teachers/<int:teacher_id>/salary/record', methods=['POST'])
@role_required('PRINCIPAL')
@feature_required('payroll_system')
def add_salary_record(teacher_id):
    """
    Manually add a salary payment record.
    Body: { month, amount, status, payment_date, note }
    Isi transaction mein ek linked Expense bhi auto-create hoti hai
    taaki Profit & Loss mein salary turant reflect ho jaye.
    """
    t = Teacher.query.get_or_404(teacher_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    from app.models.financial import SalaryRecord
    from app.models.finance import Expense

    pay_date = date.fromisoformat(data['payment_date']) \
               if data.get('payment_date') else date.today()
    amount   = float(data.get('amount', t.salary or 0))
    status   = data.get('status', 'PAID')

    rec = SalaryRecord(
        teacher_id=teacher_id,
        school_id=_school_id(),
        month=data.get('month'),
        amount=amount,
        status=status,
        payment_date=pay_date,
        note=data.get('note', ''),
        created_by=get_current_user().id,
    )
    db.session.add(rec)
    db.session.flush()   # rec.id chahiye Expense link karne ke liye, commit se pehle

    teacher_name = t.user.name if t.user else 'Teacher'
    exp = Expense(
        school_id      = _school_id(),
        category        = 'TEACHER_SALARY',
        title           = f'Salary — {teacher_name} — {rec.month or pay_date.strftime("%B %Y")}',
        vendor_name     = teacher_name,
        amount          = amount,
        payment_method  = 'BANK_TRANSFER',
        payment_date    = pay_date,
        month           = pay_date.strftime('%B %Y'),
        status          = 'PAID' if status == 'PAID' else 'PENDING',
        source          = 'SALARY_AUTO',
        source_ref_id   = rec.id,
        remarks         = data.get('note', ''),
        created_by      = get_current_user().id,
    )
    db.session.add(exp)
    db.session.commit()

    return jsonify({
        'message':    'Salary record added',
        'id':         rec.id,
        'expense_id': exp.id,
    }), 201

@principal_bp.route('/payroll/records', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
@feature_required('payroll_system')
def list_payroll_records():
    """
    Teacher + Staff dono ke recent salary payments — centralized Payroll page ke liye.
    Query param: ?month=July 2026 (optional filter)
    """
    sid   = _school_id()
    month = request.args.get('month')

    from app.models.financial import SalaryRecord
    from app.models.finance import StaffSalaryRecord

    tq = SalaryRecord.query.filter_by(school_id=sid)
    if month:
        tq = tq.filter_by(month=month)
    teacher_records = tq.order_by(SalaryRecord.payment_date.desc()).limit(200).all()

    sq = StaffSalaryRecord.query.filter_by(school_id=sid)
    if month:
        sq = sq.filter_by(month=month)
    staff_records = sq.order_by(StaffSalaryRecord.payment_date.desc()).limit(200).all()

    out = []
    for r in teacher_records:
        t = Teacher.query.get(r.teacher_id)
        out.append({
            'id':            r.id,
            'type':          'TEACHER',
            'person_id':     r.teacher_id,
            'person_name':   t.user.name if (t and t.user) else 'Unknown',
            'employee_id':   t.employee_id if t else '',
            'role_label':    'Teacher',
            'month':         r.month,
            'amount':        r.amount,
            'status':        r.status,
            'payment_date':  str(r.payment_date) if r.payment_date else None,
            'note':          r.note or '',
        })
    for r in staff_records:
        u = User.query.get(r.user_id)
        out.append({
            'id':            r.id,
            'type':          'STAFF',
            'person_id':     r.user_id,
            'person_name':   u.name if u else 'Unknown',
            'employee_id':   '',
            'role_label':    u.role.value if u else '',
            'month':         r.month,
            'amount':        r.amount,
            'status':        r.status,
            'payment_date':  str(r.payment_date) if r.payment_date else None,
            'note':          r.note or '',
        })

    out.sort(key=lambda x: x['payment_date'] or '', reverse=True)
    return jsonify(out), 200


@principal_bp.route('/users/<int:user_id>/salary/record', methods=['POST'])
@role_required('PRINCIPAL')
@feature_required('payroll_system')
def add_staff_salary_record(user_id):
    """
    Non-teaching staff (Accountant, Librarian, Receptionist, Hostel, Transport, HR, Vice Principal)
    ke liye salary payment record karta hai. Isi transaction mein linked Expense bhi auto-create
    hoti hai — Teacher salary wale route jaisa hi pattern.
    Body: { month, amount, status, payment_date, note }
    """
    u = User.query.get_or_404(user_id)
    if u.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if u.role == UserRole.TEACHER:
        return jsonify({'error': 'Teacher salary /teachers/<id>/salary/record route se record karo'}), 400

    data = request.get_json() or {}

    from app.models.finance import StaffSalaryRecord, Expense

    pay_date = date.fromisoformat(data['payment_date']) if data.get('payment_date') else date.today()
    amount   = float(data.get('amount', u.salary or 0))
    status   = data.get('status', 'PAID')

    rec = StaffSalaryRecord(
        user_id      = user_id,
        school_id    = _school_id(),
        month        = data.get('month'),
        amount       = amount,
        status       = status,
        payment_date = pay_date,
        note         = data.get('note', ''),
        created_by   = get_current_user().id,
    )
    db.session.add(rec)
    db.session.flush()

    exp = Expense(
        school_id      = _school_id(),
        category       = 'STAFF_SALARY',
        title          = f'Salary — {u.name} — {rec.month or pay_date.strftime("%B %Y")}',
        vendor_name    = u.name,
        amount         = amount,
        payment_method = 'BANK_TRANSFER',
        payment_date   = pay_date,
        month          = pay_date.strftime('%B %Y'),
        status         = 'PAID' if status == 'PAID' else 'PENDING',
        source         = 'SALARY_AUTO',
        source_ref_id  = rec.id,
        remarks        = data.get('note', ''),
        created_by     = get_current_user().id,
    )
    db.session.add(exp)
    db.session.commit()

    return jsonify({
        'message':    'Salary record added',
        'id':         rec.id,
        'expense_id': exp.id,
    }), 201
# ─── Students ─────────────────────────────────────────────────────────────────

@principal_bp.route('/students', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_students():
    class_id = request.args.get('class_id')
    search   = (request.args.get('search') or '').strip()
    q = Student.query.filter_by(school_id=_school_id())
    if class_id:
        q = q.filter_by(class_id=class_id)
    if search:
        q = q.join(User, Student.user_id == User.id).filter(db.or_(
            User.name.ilike(f'%{search}%'),
            Student.roll_number.ilike(f'%{search}%'),
            Student.admission_no.ilike(f'%{search}%'),
        ))
    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    paginated = q.order_by(Student.id).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'data':     [s.to_dict() for s in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev,
    }), 200


@principal_bp.route('/students', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_student():
    from app.utils.plan_limits import get_limit, get_school_plan

    data   = request.get_json()
    sid    = _school_id()
    plan   = get_school_plan(sid)
    limit  = get_limit(plan, 'students')

    current_count = Student.query.filter_by(school_id=sid).count()
    if current_count >= limit:
        return jsonify({
            'error':   'student_limit_reached',
            'message': f'Aapke {plan} plan mein sirf {limit} students allowed hain. '
                       f'Abhi {current_count} students hain. Upgrade karo aage badhne ke liye.',
            'current': current_count,
            'limit':   limit,
            'plan':    plan,
        }), 403

    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    user = User(
        name=data['name'], email=data['email'].lower(),
        role=UserRole.STUDENT, school_id=sid
    )
    user.set_password(data.get('password', 'Student@123'), store_plain=True)
    db.session.add(user)
    db.session.flush()
    student = Student(
        user_id=user.id, school_id=_school_id(),
        class_id=data.get('class_id'),
        roll_number=data.get('roll_number'),
        admission_no=data.get('admission_no'),
        parent_name=data.get('parent_name'),
        parent_phone=data.get('parent_phone'),
        parent_email=data.get('parent_email'),
        gender=data.get('gender'),
        dob=date.fromisoformat(data['dob']) if data.get('dob') else None,
        address=data.get('address'),
        session=data.get('session', '2024-25')
    )
    db.session.add(student)
    db.session.commit()
    return jsonify(student.to_dict()), 201


# ─── Fees ─────────────────────────────────────────────────────────────────────

@principal_bp.route('/fees/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def fees_summary():
    sid = _school_id()
    total_due  = db.session.query(func.sum(FeeRecord.amount_due)).filter_by(school_id=sid).scalar() or 0
    total_paid = db.session.query(func.sum(FeeRecord.amount_paid)).filter_by(school_id=sid).scalar() or 0
    pending    = db.session.query(func.count(FeeRecord.id)).filter_by(school_id=sid, status='PENDING').scalar() or 0
    overdue    = db.session.query(func.count(FeeRecord.id)).filter_by(school_id=sid, status='OVERDUE').scalar() or 0

    # ── FeeTransaction-based cards ──
    # record.amount_paid sirf running total hai, isliye "kab collect hua" ye
    # FeeTransaction se nikalta hai — ab date/month/mode-wise sahi hai.
    today = date.today()

    # optional month filter — "YYYY-MM" (top filter se aata hai)
    # diya hai to usi month ka label banao, warna current month use karo.
    month_param = request.args.get('month')
    if month_param:
        try:
            y, m = map(int, month_param.split('-'))
            this_month = date(y, m, 1).strftime('%B %Y')
        except (ValueError, TypeError):
            this_month = today.strftime('%B %Y')
    else:
        this_month = today.strftime('%B %Y')

    # "Today's Collection" hamesha actual aaj ka din hi rahega — filter se independent
    today_collection = db.session.query(func.sum(FeeTransaction.amount)).filter_by(
        school_id=sid, transaction_date=today
    ).scalar() or 0

    month_collection = db.session.query(func.sum(FeeTransaction.amount)).filter_by(
        school_id=sid, txn_month=this_month
    ).scalar() or 0

    mode_agg = db.session.query(
        FeeTransaction.payment_mode,
        func.sum(FeeTransaction.amount)
    ).filter_by(school_id=sid, txn_month=this_month)\
     .group_by(FeeTransaction.payment_mode).all()
    mode_map = {mode: amt for mode, amt in mode_agg}

    return jsonify({
        'total_due': total_due, 'total_collected': total_paid,
        'pending_count': pending, 'overdue_count': overdue,
        'collection_rate': round(total_paid / total_due * 100, 1) if total_due else 0,

        'today_collection':    today_collection,
        'this_month':          this_month,
        'this_month_collection': month_collection,
        'cash_collection':      mode_map.get('CASH', 0),
        'upi_collection':       mode_map.get('UPI', 0),
        'online_collection':    mode_map.get('ONLINE', 0),
        'cheque_collection':    mode_map.get('CHEQUE', 0),
    }), 200


@principal_bp.route('/fees/records', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def fee_records():
    sid        = _school_id()
    class_id   = request.args.get('class_id')
    status     = request.args.get('status')
    student_id = request.args.get('student_id')
    month      = request.args.get('month')
    fee_type   = request.args.get('fee_type')

    q = FeeRecord.query.filter_by(school_id=sid)

    if status:
        q = q.filter_by(status=status)
    if student_id:
        q = q.filter_by(student_id=student_id)
    if month:
        q = q.filter(FeeRecord.month == month)
    if fee_type:
        q = q.filter(FeeRecord.fee_type == fee_type.upper())

    if class_id:
        q = q.join(Student, FeeRecord.student_id == Student.id)\
             .filter(Student.class_id == class_id)

    

    from sqlalchemy.orm import joinedload, contains_eager

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)

    # Eager load student + user + class in one shot
    q = q.join(Student, FeeRecord.student_id == Student.id)\
         .join(User, Student.user_id == User.id)\
         .options(
             contains_eager(FeeRecord.student).contains_eager(Student.user),
         ).order_by(FeeRecord.created_at.desc()) if not class_id else q.order_by(FeeRecord.created_at.desc())

    paginated = q.paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for r in paginated.items:
        d = r.to_dict()
        student = r.student if hasattr(r, 'student') and r.student else Student.query.get(r.student_id)
        if student:
            cls = Class.query.get(student.class_id)
            d['student_id']   = student.id  # frontend navigation ke liye guaranteed
            d['student_name'] = student.user.name if student.user else ''
            d['father_name']  = student.parent_name or ''
            d['roll_number']  = student.roll_number or ''
            d['class_name']   = f"{cls.name} - {cls.section}" if cls else ''
        result.append(d)
    

    return jsonify({
        'data':     result,
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


@principal_bp.route('/fees/collect', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def collect_fee():
    """
    Collect fee for a student.
    Body: record_id, amount_paid, payment_mode
    """
    data      = request.get_json() or {}
    record_id = data.get('record_id')
    if not record_id:
        return jsonify({'error': 'record_id is required'}), 400

    record = FeeRecord.query.get_or_404(record_id)
    if record.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        new_payment = float(data.get('amount_paid'))
    except (TypeError, ValueError):
        return jsonify({'error': 'amount_paid must be a number'}), 400
    if new_payment <= 0:
        return jsonify({'error': 'amount_paid must be greater than 0'}), 400

    # Accumulate — this is a new installment, not the new total
    # Accumulate — this is a new installment, not the new total
    record.amount_paid  = (record.amount_paid or 0) + new_payment
    record.payment_mode = data.get('payment_mode', 'CASH')
    record.paid_date    = date.today()
    record.collected_by = get_current_user().id
    record.remarks      = data.get('remarks', '')

    # Auto status
    if record.amount_paid >= record.amount_due:
        record.status = 'PAID'
    elif record.amount_paid > 0:
        record.status = 'PARTIAL'

    # Auto receipt number if not already set
    if not record.receipt_no:
        while True:
            rno = _gen_receipt()
            if not FeeRecord.query.filter_by(receipt_no=rno).first():
                record.receipt_no = rno
                break

    # ── FeeTransaction ledger entry ──
    # Har payment ka apna receipt + date + mode — isi se ab month-wise /
    # date-wise / mode-wise collection report accurately ban sakti hai,
    # record.amount_paid (running total) pe depend kiye bina.
    today = date.today()
    while True:
        txn_receipt = _gen_receipt()
        if not FeeTransaction.query.filter_by(receipt_no=txn_receipt).first():
            break

    txn = FeeTransaction(
        fee_record_id    = record.id,
        student_id       = record.student_id,
        school_id        = _school_id(),
        amount           = new_payment,
        payment_mode     = record.payment_mode,
        transaction_date = today,
        txn_month        = today.strftime('%B %Y'),
        receipt_no       = txn_receipt,
        remarks          = data.get('remarks', ''),
        collected_by     = get_current_user().id,
    )
    db.session.add(txn)

    db.session.commit()

    # Return full record with student info
    d = record.to_dict()
    student = Student.query.get(record.student_id)
    if student:
        cls = Class.query.get(student.class_id)
        d['student_name'] = student.user.name if student.user else ''
        d['father_name']  = student.parent_name or ''
        d['class_name']   = f"{cls.name} - {cls.section}" if cls else ''
    return jsonify(d), 200

@principal_bp.route('/fees/generate', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def generate_fees():
    """
    Generate monthly fee records for a class.
    Body:
    {
        class_id,
        month,
        fee_type,
        amount,
        due_date
    }
    """

    data = request.get_json()

    class_id = data.get('class_id')
    month    = data.get('month')
    fee_type = data.get('fee_type', 'TUITION')
    amount   = float(data.get('amount', 0))
    due_date = data.get('due_date')

    if not class_id or not month or amount <= 0:
        return jsonify({'error': 'Missing required fields'}), 400

    students = Student.query.filter_by(
        school_id=_school_id(),
        class_id=class_id
    ).all()

    created = 0
    skipped = 0

    for s in students:

        # duplicate prevention
        exists = FeeRecord.query.filter_by(
            student_id=s.id,
            month=month,
            fee_type=fee_type
        ).first()

        if exists:
            skipped += 1
            continue

        rec = FeeRecord(
            school_id=_school_id(),
            student_id=s.id,
            fee_type=fee_type,
            month=month,
            amount_due=amount,
            amount_paid=0,
            status='PENDING',
            due_date=date.fromisoformat(due_date) if due_date else None
        )

        db.session.add(rec)
        created += 1

    db.session.commit()

    return jsonify({
        'message': f'{created} fee records generated',
        'created': created,
        'skipped': skipped
    }), 201

@principal_bp.route('/fees/monthly-trend', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def fees_monthly_trend():
    """
    Month-wise Expected vs Collected vs Pending — FeeRecord.month based
    (jis month record generate hua, wahi group-by key — records/generate
    flow mein already yahi field use ho raha hai, isliye consistent hai).
    """
    sid = _school_id()
    agg = db.session.query(
        FeeRecord.month,
        func.sum(FeeRecord.amount_due).label('due'),
        func.sum(FeeRecord.amount_paid).label('paid'),
    ).filter(FeeRecord.school_id == sid, FeeRecord.month.isnot(None))\
     .group_by(FeeRecord.month).all()

    result = []
    for r in agg:
        due, paid = r.due or 0, r.paid or 0
        result.append({
            'month':           r.month,
            'expected':        due,
            'collected':       paid,
            'pending':         due - paid,
            'collection_pct':  round(paid / due * 100, 1) if due else 0,
        })
    result.sort(key=lambda x: x['month'])
    return jsonify(result), 200

@principal_bp.route('/fees/class-summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def fees_class_summary():
    sid     = _school_id()
    month   = request.args.get('month')  # optional — "YYYY-MM"
    classes = Class.query.filter_by(school_id=sid).all()
    # ONE query: aggregate per student
    from sqlalchemy import case
    agg_q = db.session.query(
        Student.class_id,
        func.sum(FeeRecord.amount_due).label('total_due'),
        func.sum(FeeRecord.amount_paid).label('total_paid'),
    ).join(FeeRecord, FeeRecord.student_id == Student.id)\
     .filter(Student.school_id == sid)
    if month:
        agg_q = agg_q.filter(FeeRecord.month == month)
    agg = agg_q.group_by(Student.class_id).all()

    agg_map = {r.class_id: {'due': r.total_due or 0, 'paid': r.total_paid or 0}
               for r in agg}

    result = []
    for c in classes:
        totals = agg_map.get(c.id, {'due': 0, 'paid': 0})
        result.append({
            'class_id': c.id, 'class_name': c.name, 'section': c.section,
            'student_count': c.students.count(),
            'total_due': totals['due'], 'total_collected': totals['paid'],
            'pending': totals['due'] - totals['paid'],
            'collection_pct': round(totals['paid'] / totals['due'] * 100, 1)
                              if totals['due'] else 0,
        })
    return jsonify(result), 200


# ─── Attendance ───────────────────────────────────────────────────────────────

@principal_bp.route('/attendance/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def attendance_summary():
    """
    School-wide attendance summary.
    Query params: date (YYYY-MM-DD), month (YYYY-MM)
    """
    sid        = _school_id()
    date_param = request.args.get('date')
    month_param= request.args.get('month')  # e.g. "2024-04"

    # All students in this school
    total_students = Student.query.filter_by(school_id=sid).count()

    q = Attendance.query.join(Student, Attendance.student_id == Student.id)\
                        .filter(Student.school_id == sid)

    if date_param:
        target = date.fromisoformat(date_param)
        q = q.filter(Attendance.date == target)
    elif month_param:
        year, month = map(int, month_param.split('-'))
        from sqlalchemy import extract
        q = q.filter(
            extract('year',  Attendance.date) == year,
            extract('month', Attendance.date) == month
        )
    else:
        # Default: today
        target = date.today()
        q = q.filter(Attendance.date == target)

    records   = q.all()
    present   = sum(1 for r in records if r.status == 'PRESENT')
    absent    = sum(1 for r in records if r.status == 'ABSENT')
    late      = sum(1 for r in records if r.status == 'LATE')
    marked    = len(records)

    return jsonify({
        'total_students': total_students,
        'marked':         marked,
        'present':        present,
        'absent':         absent,
        'late':           late,
        'not_marked':     total_students - marked,
        'present_pct':    round(present / total_students * 100, 1) if total_students else 0,
    }), 200


@principal_bp.route('/attendance/class-summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def attendance_class_summary():
    """
    Class-wise attendance breakdown.
    Query params: date (YYYY-MM-DD)  [default: today]
    """
    sid        = _school_id()
    date_param = request.args.get('date')
    target     = date.fromisoformat(date_param) if date_param else date.today()

    classes = Class.query.filter_by(school_id=sid).all()
    result  = []

    for c in classes:
        students    = c.students.all()
        total       = len(students)
        student_ids = [s.id for s in students]

        att = Attendance.query.filter(
            Attendance.student_id.in_(student_ids),
            Attendance.date == target
        ).all()

        present  = sum(1 for a in att if a.status == 'PRESENT')
        absent   = sum(1 for a in att if a.status == 'ABSENT')
        late     = sum(1 for a in att if a.status == 'LATE')
        marked   = len(att)

        # Student-wise detail
        att_map = {a.student_id: a.status for a in att}
        students_detail = []
        for s in students:
            students_detail.append({
                'student_id':   s.id,
                'student_name': s.user.name if s.user else '',
                'roll_number':  s.roll_number or '',
                'status':       att_map.get(s.id, 'NOT_MARKED')
            })

        result.append({
            'class_id':    c.id,
            'class_name':  c.name,
            'section':     c.section,
            'total':       total,
            'present':     present,
            'absent':      absent,
            'late':        late,
            'not_marked':  total - marked,
            'present_pct': round(present / total * 100, 1) if total else 0,
            'students':    students_detail
        })

    return jsonify(result), 200


@principal_bp.route('/attendance/mark', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def mark_attendance():
    """
    Mark attendance for multiple students.
    Body: { class_id, date, records: [{student_id, status}] }
    """
    data      = request.get_json()
    class_id  = data.get('class_id')
    att_date  = date.fromisoformat(data.get('date', str(date.today())))
    records   = data.get('records', [])
    marker_id = get_current_user().id

    for rec in records:
        existing = Attendance.query.filter_by(
            student_id=rec['student_id'], date=att_date
        ).first()
        if existing:
            existing.status    = rec['status']
            existing.marked_by = marker_id
        else:
            att = Attendance(
                student_id=rec['student_id'],
                class_id=class_id,
                date=att_date,
                status=rec['status'],
                marked_by=marker_id,
                remarks=rec.get('remarks', '')
            )
            db.session.add(att)

    db.session.commit()
    return jsonify({'message': f'{len(records)} attendance records saved'}), 200
@principal_bp.route('/teachers/attendance/today', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def teacher_attendance_today():
    """
    Today's teacher attendance summary.
    Returns: present/absent counts + absent teacher name list.
    Query param: date (YYYY-MM-DD), default today
    """
    sid        = _school_id()
    date_param = request.args.get('date')
    target     = date.fromisoformat(date_param) if date_param else date.today()

    teachers   = Teacher.query.filter_by(school_id=sid).all()
    total      = len(teachers)

    att_map = {
        a.teacher_id: a
        for a in TeacherAttendance.query.filter_by(
            school_id=sid, date=target
        ).all()
    }

    present    = 0
    absent     = 0
    half_day   = 0
    on_leave   = 0
    not_marked = 0
    absent_list = []

    for t in teachers:
        rec = att_map.get(t.id)
        if not rec:
            not_marked += 1
            continue
        if rec.status == 'PRESENT':
            present += 1
        elif rec.status == 'ABSENT':
            absent += 1
            absent_list.append({
                'teacher_id':  t.id,
                'name':        t.user.name if t.user else '',
                'designation': t.designation or 'Teacher',
                'department':  t.department or '',
            })
        elif rec.status == 'HALF_DAY':
            half_day += 1
        elif rec.status == 'ON_LEAVE':
            on_leave += 1
            absent_list.append({
                'teacher_id':  t.id,
                'name':        t.user.name if t.user else '',
                'designation': t.designation or 'Teacher',
                'department':  t.department or '',
                'on_leave':    True,
            })

    return jsonify({
        'date':        str(target),
        'total':       total,
        'present':     present,
        'absent':      absent,
        'half_day':    half_day,
        'on_leave':    on_leave,
        'not_marked':  not_marked,
        'absent_list': absent_list,
    }), 200


@principal_bp.route('/teachers/attendance/mark', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def mark_teacher_attendance():
    """
    Mark attendance for multiple teachers.
    Body: { date, records: [{teacher_id, status, check_in, check_out, remarks}] }
    """
    data      = request.get_json()
    att_date  = date.fromisoformat(data.get('date', str(date.today())))
    records   = data.get('records', [])
    marker_id = get_current_user().id
    sid       = _school_id()

    for rec in records:
        existing = TeacherAttendance.query.filter_by(
            teacher_id=rec['teacher_id'], date=att_date
        ).first()
        if existing:
            existing.status    = rec.get('status', 'PRESENT')
            existing.check_in  = rec.get('check_in')
            existing.check_out = rec.get('check_out')
            existing.remarks   = rec.get('remarks', '')
            existing.marked_by = marker_id
        else:
            att = TeacherAttendance(
                teacher_id=rec['teacher_id'],
                school_id=sid,
                date=att_date,
                status=rec.get('status', 'PRESENT'),
                check_in=rec.get('check_in'),
                check_out=rec.get('check_out'),
                remarks=rec.get('remarks', ''),
                marked_by=marker_id,
            )
            db.session.add(att)

    db.session.commit()
    return jsonify({'message': f'{len(records)} teacher attendance records saved'}), 200

# ─── Exams & PDF ──────────────────────────────────────────────────────────────

# ─── Exams & PDF ──────────────────────────────────────────────────────────────

@principal_bp.route('/exams', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_exams():
    status = request.args.get('status')  # DRAFT / PUBLISHED / ARCHIVED
    q = ExamSchedule.query.filter_by(school_id=_school_id())
    if status:
        q = q.filter_by(status=status)
    exams = q.order_by(ExamSchedule.created_at.desc()).all()
    result = []
    for e in exams:
        d = e.to_dict()
        d['timetable_count'] = e.timetable.count()
        # class list jo is exam mein hain
        class_ids = list({t.class_id for t in e.timetable.all()})
        classes = Class.query.filter(Class.id.in_(class_ids)).all() if class_ids else []
        d['classes'] = [{'id': c.id, 'name': c.name, 'section': c.section} for c in classes]
        result.append(d)
    return jsonify(result), 200


@principal_bp.route('/exams', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_exam():
    data = request.get_json()
    exam = ExamSchedule(
        school_id    = _school_id(),
        exam_name    = data['exam_name'],
        exam_type    = data.get('exam_type', 'MID_TERM'),
        session      = data.get('session', '2024-25'),
        start_date   = date.fromisoformat(data['start_date']),
        end_date     = date.fromisoformat(data['end_date']),
        instructions = data.get('instructions', ''),
        status       = 'DRAFT',
        is_published = False,
        created_by   = get_current_user().id
    )
    db.session.add(exam)
    db.session.commit()
    return jsonify(exam.to_dict()), 201


@principal_bp.route('/exams/<int:exam_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'TEACHER')
def update_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if exam.status == 'PUBLISHED':
        return jsonify({'error': 'Published exam edit nahi ho sakta. Pehle unpublish karo.'}), 400
    data = request.get_json()
    if data.get('exam_name'):    exam.exam_name    = data['exam_name']
    if data.get('exam_type'):    exam.exam_type    = data['exam_type']
    if data.get('session'):      exam.session      = data['session']
    if data.get('start_date'):   exam.start_date   = date.fromisoformat(data['start_date'])
    if data.get('end_date'):     exam.end_date     = date.fromisoformat(data['end_date'])
    if data.get('instructions') is not None:
                                 exam.instructions = data['instructions']
    db.session.commit()
    return jsonify(exam.to_dict()), 200


@principal_bp.route('/exams/<int:exam_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if exam.status == 'PUBLISHED':
        return jsonify({'error': 'Published exam delete nahi ho sakta'}), 400
    db.session.delete(exam)
    db.session.commit()
    return jsonify({'message': 'Exam deleted'}), 200


@principal_bp.route('/exams/<int:exam_id>/publish', methods=['POST'])
@role_required('PRINCIPAL')
def publish_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    exam.status       = 'PUBLISHED'
    exam.is_published = True
    exam.published_at = datetime.utcnow()
    exam.published_by = get_current_user().id
    db.session.commit()
    return jsonify({'message': 'Exam published', 'exam': exam.to_dict()}), 200


@principal_bp.route('/exams/<int:exam_id>/unpublish', methods=['POST'])
@role_required('PRINCIPAL')
def unpublish_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    exam.status       = 'DRAFT'
    exam.is_published = False
    exam.published_at = None
    db.session.commit()
    return jsonify({'message': 'Exam unpublished', 'exam': exam.to_dict()}), 200


@principal_bp.route('/exams/<int:exam_id>/archive', methods=['POST'])
@role_required('PRINCIPAL')
def archive_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    exam.status       = 'ARCHIVED'
    exam.is_published = False
    db.session.commit()
    return jsonify({'message': 'Exam archived'}), 200


# ─── Exam Timetable (Subject-wise papers) ─────────────────────────────────────

@principal_bp.route('/exams/<int:exam_id>/timetable', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_exam_timetable(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    class_id = request.args.get('class_id')
    q = ExamTimetable.query.filter_by(exam_id=exam_id)
    if class_id:
        q = q.filter_by(class_id=class_id)
    items = q.order_by(ExamTimetable.exam_date.asc()).all()
    return jsonify([i.to_dict() for i in items]), 200


@principal_bp.route('/exams/<int:exam_id>/timetable', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def add_timetable_item(exam_id):
    """Add subject-wise paper to exam timetable."""
    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()

    subject_id = data.get('subject_id') or None

    if not subject_id and data.get('subject_name_manual'):
        existing = Subject.query.filter_by(
            name=data['subject_name_manual'],
            class_id=data['class_id']
        ).first()
        if existing:
            subject_id = existing.id
        else:
            new_subj = Subject(
                name=data['subject_name_manual'],
                class_id=data['class_id'],
                school_id=_school_id()
            )
            db.session.add(new_subj)
            db.session.flush()
            subject_id = new_subj.id

    if not subject_id:
        return jsonify({'error': 'Subject select karo ya naam type karo'}), 400

    item = ExamTimetable(
        exam_id      = exam_id,
        class_id     = data['class_id'],
        subject_id   = subject_id,
        exam_date    = date.fromisoformat(data['exam_date']),
        start_time   = data.get('start_time', '10:00 AM'),
        end_time     = data.get('end_time',   '01:00 PM'),
        venue        = data.get('venue',      'Main Hall'),
        max_marks    = data.get('max_marks',  100),
        pass_marks   = data.get('pass_marks', 33),
        instructions = data.get('instructions', ''),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@principal_bp.route('/exams/timetable/<int:item_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'TEACHER')
def update_timetable_item(item_id):
    item = ExamTimetable.query.get_or_404(item_id)
    data = request.get_json()
    if data.get('exam_date'):    item.exam_date    = date.fromisoformat(data['exam_date'])
    if data.get('start_time'):   item.start_time   = data['start_time']
    if data.get('end_time'):     item.end_time     = data['end_time']
    if data.get('venue'):        item.venue        = data['venue']
    if data.get('max_marks'):    item.max_marks    = data['max_marks']
    if data.get('pass_marks'):   item.pass_marks   = data['pass_marks']
    if data.get('instructions') is not None:
                                 item.instructions = data['instructions']
    db.session.commit()
    return jsonify(item.to_dict()), 200


@principal_bp.route('/exams/timetable/<int:item_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'TEACHER')
def delete_timetable_item(item_id):
    item = ExamTimetable.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


# ─── Admit Card & Result Card PDF ─────────────────────────────────────────────

@principal_bp.route('/admit-card/<int:student_id>/<int:exam_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def admit_card_pdf(student_id, exam_id):
    student   = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    exam      = ExamSchedule.query.get_or_404(exam_id)
    from app.models.school import School
    school    = School.query.get(student.school_id)
    timetable = ExamTimetable.query.filter_by(
        exam_id=exam_id, class_id=student.class_id
    ).order_by(ExamTimetable.exam_date.asc()).all()
    buf = generate_admit_card(student, school, exam, timetable)
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'AdmitCard_{student.roll_number}_{exam.exam_name}.pdf')


@principal_bp.route('/result-card/<int:student_id>/<int:exam_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def result_card_pdf(student_id, exam_id):
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    exam    = ExamSchedule.query.get_or_404(exam_id)
    from app.models.school import School
    school  = School.query.get(student.school_id)
    marks   = Marks.query.filter_by(student_id=student_id, exam_type=exam.exam_name).all()
    marks_data = [{
        'subject_name':   m.subject.name if m.subject else 'N/A',
        'max_marks':      m.max_marks,
        'marks_obtained': m.marks_obtained,
        'grade':          m.grade
    } for m in marks]
    buf = generate_result_card(student, school, exam, marks_data)
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'ResultCard_{student.roll_number}_{exam.exam_name}.pdf')

@principal_bp.route('/students/<int:student_id>/profile', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def student_profile(student_id):
    """
    Full student profile — basic info + attendance + fees + marks.
    """
    student = Student.query.get_or_404(student_id)
    sid     = _school_id()

    # Security: student must belong to this school
    if student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    cls  = Class.query.get(student.class_id) if student.class_id else None
    user = student.user

    # ── Basic Info ──────────────────────────────────────────
    info = {
        'id':           student.id,
        'name':         user.name       if user else '',
        'email':        user.email      if user else '',
        'roll_number':  student.roll_number  or '',
        'admission_no': student.admission_no or '',
        'gender':       student.gender       or '',
        'dob':          str(student.dob)     if student.dob else '',
        'address':      student.address      or '',
        'session':      student.session      or '',
        'parent_name':  student.parent_name  or '',
        'parent_phone': student.parent_phone or '',
        'parent_email': student.parent_email or '',
        'class_name':   f"{cls.name} - {cls.section}" if cls else '',
        'class_id':     student.class_id,
        'father_name':  student.father_name  or '',
        'mother_name':  student.mother_name  or '',
        'photo_url':    student.photo_url    or '',
    }

    # ── Attendance Summary ───────────────────────────────────
    all_att = Attendance.query.filter_by(student_id=student_id).all()
    present  = sum(1 for a in all_att if a.status == 'PRESENT')
    absent   = sum(1 for a in all_att if a.status == 'ABSENT')
    late     = sum(1 for a in all_att if a.status == 'LATE')
    total_marked = len(all_att)

    # Month-wise breakdown
    from collections import defaultdict
    month_map = defaultdict(lambda: {'present': 0, 'absent': 0, 'late': 0})
    for a in all_att:
        key = a.date.strftime('%Y-%m')
        month_map[key][a.status.lower()] += 1

    monthly = [
        {
            'month':   k,
            'present': v['present'],
            'absent':  v['absent'],
            'late':    v['late'],
            'total':   v['present'] + v['absent'] + v['late'],
        }
        for k, v in sorted(month_map.items(), reverse=True)
    ]

    # Recent 30 days calendar dots
    from datetime import timedelta
    today      = date.today()
    last_30    = [today - timedelta(days=i) for i in range(30)]
    att_date_map = {a.date: a.status for a in all_att}
    calendar_30 = [
        {
            'date':   str(d),
            'status': att_date_map.get(d, 'NOT_MARKED'),
            'day':    d.strftime('%a'),
        }
        for d in reversed(last_30)
    ]

    attendance = {
        'total_marked': total_marked,
        'present':      present,
        'absent':       absent,
        'late':         late,
        'percentage':   round(present / total_marked * 100, 1) if total_marked else 0,
        'monthly':      monthly,
        'calendar_30':  calendar_30,
    }

    # ── Fee Records ─────────────────────────────────────────
    fee_records = FeeRecord.query.filter_by(student_id=student_id)\
                                 .order_by(FeeRecord.created_at.desc()).all()
    total_due   = sum(f.amount_due  for f in fee_records)
    total_paid  = sum(f.amount_paid for f in fee_records)
    pending     = total_due - total_paid

    # This month's fees
    # This month's fees — FeeRecord.month DB mein "YYYY-MM" format mein store
    # hota hai (Generate Fees flow), isliye comparison bhi usi format mein
    # honi chahiye. Display ke liye alag se human-readable label banaya.
    today             = date.today()
    this_month_key    = today.strftime('%Y-%m')   # matches FeeRecord.month
    this_month_label  = today.strftime('%B %Y')   # sirf UI display ke liye

    month_fees  = [f for f in fee_records if f.month == this_month_key]
    month_paid  = sum(f.amount_paid for f in month_fees)
    month_due   = sum(f.amount_due  for f in month_fees)

    fees = {
        'total_due':    total_due,
        'total_paid':   total_paid,
        'pending':      pending,
        'this_month':   this_month_label,
        'month_due':    month_due,
        'month_paid':   month_paid,
        'month_status': 'PAID' if month_paid >= month_due and month_due > 0
                        else 'PARTIAL' if month_paid > 0
                        else 'NO_RECORD' if month_due == 0
                        else 'PENDING',
        'records': [
            {
                'id':           r.id,
                'month':        r.month,
                'fee_type':     r.fee_type,
                'amount_due':   r.amount_due,
                'amount_paid':  r.amount_paid,
                'status':       r.status,
                'due_date':     str(r.due_date)  if r.due_date  else None,
                'paid_date':    str(r.paid_date) if r.paid_date else None,
                'receipt_no':   r.receipt_no,
                'payment_mode': r.payment_mode,
            }
            for r in fee_records
        ],
    }

    # ── Marks / Results ─────────────────────────────────────
    marks_records = Marks.query.filter_by(student_id=student_id).all()

    # Group by exam_type
    exam_map = defaultdict(list)
    for m in marks_records:
        exam_map[m.exam_type].append({
            'subject':         m.subject.name if m.subject else 'N/A',
            'marks_obtained':  m.marks_obtained,
            'max_marks':       m.max_marks,
            'grade':           m.grade,
            'percentage':      round(m.marks_obtained / m.max_marks * 100, 1)
                               if m.max_marks else 0,
        })

    exams = [
        {
            'exam_type': exam,
            'subjects':  subj_list,
            'total_obtained': sum(s['marks_obtained'] for s in subj_list),
            'total_max':      sum(s['max_marks']      for s in subj_list),
            'avg_pct':        round(
                sum(s['percentage'] for s in subj_list) / len(subj_list), 1
            ) if subj_list else 0,
        }
        for exam, subj_list in exam_map.items()
    ]

    return jsonify({
        'info':       info,
        'attendance': attendance,
        'fees':       fees,
        'exams':      exams,
    }), 200

# ─── Holidays ─────────────────────────────────────────────────────────────────

@principal_bp.route('/holidays', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'STUDENT')
def list_holidays():
    sid        = _school_id()
    applies_to = request.args.get('applies_to')  # ALL / STUDENT / TEACHER
    q          = Holiday.query.filter_by(school_id=sid)
    if applies_to and applies_to != 'ALL':
        q = q.filter(Holiday.applies_to.in_([applies_to, 'ALL']))
    holidays = q.order_by(Holiday.date.asc()).all()
    return jsonify([h.to_dict() for h in holidays]), 200


@principal_bp.route('/holidays', methods=['POST'])
@role_required('PRINCIPAL')
def create_holiday():
    data = request.get_json()
    h = Holiday(
        school_id   = _school_id(),
        title       = data['title'],
        date        = date.fromisoformat(data['date']),
        end_date    = date.fromisoformat(data['end_date']) if data.get('end_date') else None,
        holiday_type= data.get('holiday_type', 'HOLIDAY'),
        applies_to  = data.get('applies_to', 'ALL'),
        description = data.get('description', ''),
        created_by  = get_current_user().id,
    )
    db.session.add(h)
    db.session.commit()
    return jsonify(h.to_dict()), 201


@principal_bp.route('/holidays/<int:hid>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_holiday(hid):
    h = Holiday.query.get_or_404(hid)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(h)
    db.session.commit()
    return jsonify({'message': 'Holiday deleted'}), 200


@principal_bp.route('/holidays/<int:hid>', methods=['PUT'])
@role_required('PRINCIPAL')
def update_holiday(hid):
    h    = Holiday.query.get_or_404(hid)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if data.get('title'):        h.title        = data['title']
    if data.get('date'):         h.date         = date.fromisoformat(data['date'])
    if data.get('end_date'):     h.end_date     = date.fromisoformat(data['end_date'])
    if data.get('holiday_type'): h.holiday_type = data['holiday_type']
    if data.get('applies_to'):   h.applies_to   = data['applies_to']
    if data.get('description') is not None: h.description = data['description']
    db.session.commit()
    return jsonify(h.to_dict()), 200


# ─── Teacher Attendance Approval ──────────────────────────────────────────────

@principal_bp.route('/teachers/attendance/requests', methods=['GET'])
@role_required('PRINCIPAL')
def list_attendance_requests():
    """All pending teacher attendance requests."""
    sid      = _school_id()
    approval = request.args.get('approval', 'PENDING')
    reqs     = TeacherAttendanceRequest.query.filter_by(
        school_id=sid, approval=approval
    ).order_by(TeacherAttendanceRequest.date.desc()).all()

    result = []
    for r in reqs:
        d = r.to_dict()
        t = Teacher.query.get(r.teacher_id)
        d['teacher_name']  = t.user.name if t and t.user else ''
        d['employee_id']   = t.employee_id or ''
        d['designation']   = t.designation or 'Teacher'
        result.append(d)
    return jsonify(result), 200


@principal_bp.route('/teachers/attendance/requests/<int:req_id>/approve', methods=['POST'])
@role_required('PRINCIPAL')
def approve_attendance_request(req_id):
    """Approve a teacher attendance request → creates TeacherAttendance record."""
    req = TeacherAttendanceRequest.query.get_or_404(req_id)
    if req.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    req.approval    = 'APPROVED'
    req.reviewed_by = get_current_user().id
    req.reviewed_at = datetime.utcnow()

    # Upsert into TeacherAttendance
    existing = TeacherAttendance.query.filter_by(
        teacher_id=req.teacher_id, date=req.date
    ).first()
    if existing:
        existing.status    = req.status
        existing.check_in  = req.check_in
        existing.check_out = req.check_out
        existing.remarks   = req.remarks
        existing.marked_by = get_current_user().id
    else:
        att = TeacherAttendance(
            teacher_id = req.teacher_id,
            school_id  = req.school_id,
            date       = req.date,
            status     = req.status,
            check_in   = req.check_in,
            check_out  = req.check_out,
            remarks    = req.remarks,
            marked_by  = get_current_user().id,
        )
        db.session.add(att)

    db.session.commit()
    return jsonify({'message': 'Approved', 'request': req.to_dict()}), 200


@principal_bp.route('/teachers/attendance/requests/<int:req_id>/deny', methods=['POST'])
@role_required('PRINCIPAL')
def deny_attendance_request(req_id):
    """Deny a teacher attendance request."""
    req = TeacherAttendanceRequest.query.get_or_404(req_id)
    if req.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    req.approval    = 'DENIED'
    req.reviewed_by = get_current_user().id
    req.reviewed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Denied', 'request': req.to_dict()}), 200
# ─── Dashboard ────────────────────────────────────────────────────────────────

@principal_bp.route('/dashboard', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def dashboard():
    sid    = _school_id()
    today  = date.today()

    # Today's student attendance
    total_students = Student.query.filter_by(school_id=sid).count()
    att_today      = Attendance.query.join(
                         Student, Attendance.student_id == Student.id
                     ).filter(
                         Student.school_id == sid,
                         Attendance.date == today
                     ).all()
    s_present = sum(1 for a in att_today if a.status == 'PRESENT')
    s_absent  = sum(1 for a in att_today if a.status == 'ABSENT')

    # Today's teacher attendance
    total_teachers = Teacher.query.filter_by(school_id=sid).count()
    t_att_today    = TeacherAttendance.query.filter_by(
                         school_id=sid, date=today
                     ).all()
    t_present = sum(1 for a in t_att_today if a.status == 'PRESENT')
    t_absent  = sum(1 for a in t_att_today if a.status == 'ABSENT')

    return jsonify({
        'total_students':    total_students,
        'total_teachers':    total_teachers,
        'total_classes':     Class.query.filter_by(school_id=sid).count(),
        'fee_collected':     db.session.query(func.sum(FeeRecord.amount_paid)).filter_by(school_id=sid).scalar() or 0,
        'fee_pending':       db.session.query(
                                 func.sum(FeeRecord.amount_due - FeeRecord.amount_paid)
                             ).filter_by(school_id=sid).scalar() or 0,
        # attendance today
        'students_present':  s_present,
        'students_absent':   s_absent,
        'students_marked':   len(att_today),
        'teachers_present':  t_present,
        'teachers_absent':   t_absent,
        'teachers_marked':   len(t_att_today),
    }), 200


@principal_bp.route('/admission-card/<int:student_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def admission_card_pdf(student_id):
    student = Student.query.get_or_404(student_id)
    from app.models.school import School
    school  = School.query.get(student.school_id)
    from app.utils.pdf_generator import generate_admission_card
    buf = generate_admission_card(student, school)
    return send_file(
        buf,
        mimetype='application/pdf',
        download_name=f'AdmissionCard_{student.admission_no or student_id}.pdf'
    )

# ─── Teacher Self-Routes (teacher apna attendance submit kare) ────────────────

teacher_bp = Blueprint('teacher_self', __name__)

@teacher_bp.route('/self-attendance', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def get_self_attendance():
    """Today's self-attendance request for logged-in teacher."""
    user    = get_current_user()
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if not teacher:
        return jsonify(None), 200
    date_param = request.args.get('date', str(date.today()))
    req = TeacherAttendanceRequest.query.filter_by(
        teacher_id=teacher.id,
        date=date.fromisoformat(date_param)
    ).first()
    return jsonify(req.to_dict() if req else None), 200


@teacher_bp.route('/self-attendance', methods=['POST'])
@role_required('TEACHER', 'PRINCIPAL')
def submit_self_attendance():
    """Teacher submits own attendance request."""
    user    = get_current_user()
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if not teacher:
        return jsonify({'error': 'Teacher profile nahi mila'}), 404

    data     = request.get_json()
    att_date = date.fromisoformat(data.get('date', str(date.today())))

    existing = TeacherAttendanceRequest.query.filter_by(
        teacher_id=teacher.id, date=att_date
    ).first()

    if existing:
        existing.status    = data.get('status', 'PRESENT')
        existing.check_in  = data.get('check_in', '')
        existing.check_out = data.get('check_out', '')
        existing.remarks   = data.get('remarks', '')
        existing.approval  = 'PENDING'   # re-submit → back to pending
        existing.reviewed_by = None
        existing.reviewed_at = None
    else:
        req = TeacherAttendanceRequest(
            teacher_id = teacher.id,
            school_id  = teacher.school_id,
            date       = att_date,
            status     = data.get('status', 'PRESENT'),
            check_in   = data.get('check_in', ''),
            check_out  = data.get('check_out', ''),
            remarks    = data.get('remarks', ''),
            approval   = 'PENDING',
        )
        db.session.add(req)

    db.session.commit()
    result = TeacherAttendanceRequest.query.filter_by(
        teacher_id=teacher.id, date=att_date
    ).first()
    return jsonify(result.to_dict()), 201

@principal_bp.route('/teachers/<int:t_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
@feature_required('teacher_management')
def update_teacher(t_id):
    t    = Teacher.query.get_or_404(t_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    if data.get('department'):   t.department   = data['department']
    if data.get('designation'):  t.designation  = data['designation']
    if data.get('qualification'):t.qualification= data['qualification']
    if data.get('salary'):       t.salary       = float(data['salary'])
    if data.get('joining_date'): t.joining_date = date.fromisoformat(data['joining_date'])
    if t.user:
        if data.get('name'):  t.user.name  = data['name']
        if data.get('phone'): t.user.phone = data['phone']
    db.session.commit()
    return jsonify(t.to_dict()), 200

@principal_bp.route('/teachers/<int:t_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_teacher(t_id):
    t = Teacher.query.get_or_404(t_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    # Unlink from classes and subjects
    Class.query.filter_by(teacher_id=t_id).update({'teacher_id': None})
    Subject.query.filter_by(teacher_id=t_id).update({'teacher_id': None})

    # Delete attendance records
    TeacherAttendance.query.filter_by(teacher_id=t_id).delete()
    TeacherAttendanceRequest.query.filter_by(teacher_id=t_id).delete()
    db.session.flush()

    user = t.user
    db.session.delete(t)
    db.session.flush()

    if user:
        Note.query.filter_by(uploaded_by=user.id).update({'uploaded_by': None})
        db.session.flush()
        db.session.delete(user)

    db.session.commit()
    return jsonify({'message': 'Teacher removed'}), 200


@principal_bp.route('/attendance/weekly', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def attendance_weekly():
    """Last 7 days student + teacher attendance for charts."""
    from datetime import timedelta
    sid   = _school_id()
    today = date.today()
    days  = [today - timedelta(days=i) for i in range(6, -1, -1)]

    total_students = Student.query.filter_by(school_id=sid).count()
    total_teachers = Teacher.query.filter_by(school_id=sid).count()
    classes        = Class.query.filter_by(school_id=sid).all()

    student_weekly = []
    teacher_weekly = []

    from sqlalchemy import case as sa_case

    # All 7 days student att — 1 query
    s_week_agg = db.session.query(
        Attendance.date,
        func.sum(sa_case((Attendance.status == 'PRESENT', 1), else_=0)).label('present'),
        func.sum(sa_case((Attendance.status == 'ABSENT',  1), else_=0)).label('absent'),
        func.sum(sa_case((Attendance.status == 'LATE',    1), else_=0)).label('late'),
    ).join(Student, Attendance.student_id == Student.id)\
     .filter(Student.school_id == sid, Attendance.date.in_(days))\
     .group_by(Attendance.date).all()
    s_week_map = {r.date: r for r in s_week_agg}

    # All 7 days teacher att — 1 query
    t_week_agg = db.session.query(
        TeacherAttendance.date,
        func.sum(sa_case((TeacherAttendance.status == 'PRESENT', 1), else_=0)).label('present'),
        func.sum(sa_case((TeacherAttendance.status == 'ABSENT',  1), else_=0)).label('absent'),
    ).filter(TeacherAttendance.school_id == sid, TeacherAttendance.date.in_(days))\
     .group_by(TeacherAttendance.date).all()
    t_week_map = {r.date: r for r in t_week_agg}

    for d in days:
        sr = s_week_map.get(d)
        student_weekly.append({
            'date':    str(d), 'day': d.strftime('%a'),
            'total':   total_students,
            'present': sr.present if sr else 0,
            'absent':  sr.absent  if sr else 0,
            'late':    sr.late    if sr else 0,
        })
        tr = t_week_map.get(d)
        teacher_weekly.append({
            'date':    str(d), 'day': d.strftime('%a'),
            'total':   total_teachers,
            'present': tr.present if tr else 0,
            'absent':  tr.absent  if tr else 0,
        })

        # Teachers
        

    # Class-wise today
    # Class-wise today — single aggregated query
    from sqlalchemy import case as sa_case
    class_att_agg = db.session.query(
        Student.class_id,
        func.count(Student.id).label('total'),
        func.sum(sa_case((Attendance.status == 'PRESENT', 1), else_=0)).label('present'),
        func.sum(sa_case((Attendance.status == 'ABSENT',  1), else_=0)).label('absent'),
        func.sum(sa_case((Attendance.status == 'LATE',    1), else_=0)).label('late'),
    ).outerjoin(Attendance, (Attendance.student_id == Student.id) & (Attendance.date == today))\
     .filter(Student.school_id == sid)\
     .group_by(Student.class_id).all()

    agg_by_class = {r.class_id: r for r in class_att_agg}

    class_today = []
    for c in classes:
        r = agg_by_class.get(c.id)
        class_today.append({
            'class_id':   c.id,
            'class_name': f"{c.name} {c.section}",
            'total':      r.total   if r else 0,
            'present':    r.present if r else 0,
            'absent':     r.absent  if r else 0,
            'late':       r.late    if r else 0,
        })

    return jsonify({
        'student_weekly': student_weekly,
        'teacher_weekly': teacher_weekly,
        'class_today':    class_today,
    }), 200




@principal_bp.route('/students/<int:student_id>/photo', methods=['POST', 'DELETE'])
@role_required('PRINCIPAL', 'TEACHER')
def student_photo(student_id):
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        student.photo_url = None
        db.session.commit()
        return jsonify({'message': 'Photo deleted'}), 200

    file = request.files.get('photo')
    if not file:
        return jsonify({'error': 'No file'}), 400
    result = cloudinary.uploader.upload(
        file,
        folder=f'eduerp/students',
        public_id=f'student_{student_id}',
        overwrite=True,
        resource_type='image'
    )
    student.photo_url = result['secure_url']
    db.session.commit()
    return jsonify({'photo_url': student.photo_url}), 200


@principal_bp.route('/teachers/<int:teacher_id>/photo', methods=['POST', 'DELETE'])
@role_required('PRINCIPAL')
def teacher_photo(teacher_id):
    t = Teacher.query.get_or_404(teacher_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'DELETE':
        t.photo_url = None
        db.session.commit()
        return jsonify({'message': 'Photo deleted'}), 200

    file = request.files.get('photo')
    if not file:
        return jsonify({'error': 'No file'}), 400
    result = cloudinary.uploader.upload(
        file,
        folder=f'eduerp/teachers',
        public_id=f'teacher_{teacher_id}',
        overwrite=True,
        resource_type='image'
    )
    t.photo_url = result['secure_url']
    db.session.commit()
    return jsonify({'photo_url': t.photo_url}), 200



# ─── Classes subjects route ───────────────────────────────────────────────────

@principal_bp.route('/classes/<int:class_id>/subjects', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def class_subjects(class_id):
    cls = Class.query.get_or_404(class_id)
    if cls.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    subjects = cls.subjects.all()
    return jsonify([s.to_dict() for s in subjects]), 200


# ─── Weekly Timetable ─────────────────────────────────────────────────────────

@principal_bp.route('/timetables', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_timetables():
    class_id = request.args.get('class_id')
    q = Timetable.query.filter_by(school_id=_school_id())
    if class_id:
        q = q.filter_by(class_id=class_id)
    timetables = q.order_by(Timetable.created_at.desc()).all()
    result = []
    for t in timetables:
        d = t.to_dict()
        cls = Class.query.get(t.class_id)
        d['class_name'] = f"{cls.name} {cls.section}" if cls else ''
        d['period_count'] = t.periods.count()
        result.append(d)
    return jsonify(result), 200


@principal_bp.route('/timetables', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_timetable():
    data = request.get_json()
    # Only one active timetable per class per session
    existing = Timetable.query.filter_by(
        school_id=_school_id(),
        class_id=data['class_id'],
        session=data.get('session', '2024-25'),
        status='DRAFT'
    ).first()
    if existing:
        return jsonify({'error': 'Draft timetable already exists for this class. Edit that instead.'}), 409
    tt = Timetable(
        school_id  = _school_id(),
        class_id   = data['class_id'],
        session    = data.get('session', '2024-25'),
        title      = data.get('title', 'Weekly Timetable'),
        status     = 'DRAFT',
        created_by = get_current_user().id,
    )
    db.session.add(tt)
    db.session.commit()
    return jsonify(tt.to_dict()), 201


@principal_bp.route('/timetables/<int:tt_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_timetable(tt_id):
    tt = Timetable.query.get_or_404(tt_id)
    if tt.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(tt)
    db.session.commit()
    return jsonify({'message': 'Deleted'}), 200


@principal_bp.route('/timetables/<int:tt_id>/publish', methods=['POST'])
@role_required('PRINCIPAL')
def publish_timetable(tt_id):
    tt = Timetable.query.get_or_404(tt_id)
    if tt.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    tt.status       = 'PUBLISHED'
    tt.published_at = datetime.utcnow()
    tt.published_by = get_current_user().id
    db.session.commit()
    return jsonify({'message': 'Timetable published', 'timetable': tt.to_dict()}), 200


@principal_bp.route('/timetables/<int:tt_id>/unpublish', methods=['POST'])
@role_required('PRINCIPAL')
def unpublish_timetable(tt_id):
    tt = Timetable.query.get_or_404(tt_id)
    if tt.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    tt.status       = 'DRAFT'
    tt.published_at = None
    db.session.commit()
    return jsonify({'message': 'Unpublished'}), 200


@principal_bp.route('/timetables/<int:tt_id>/periods', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_periods(tt_id):
    tt = Timetable.query.get_or_404(tt_id)
    if tt.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    periods = tt.periods.order_by(TimetablePeriod.day, TimetablePeriod.period_no).all()
    return jsonify([p.to_dict() for p in periods]), 200


@principal_bp.route('/timetables/<int:tt_id>/periods', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def add_period(tt_id):
    tt = Timetable.query.get_or_404(tt_id)
    if tt.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json()
    # upsert — same day + period_no → replace
    existing = TimetablePeriod.query.filter_by(
        timetable_id=tt_id,
        day=data['day'],
        period_no=data['period_no']
    ).first()
    if existing:
        existing.subject_id  = data.get('subject_id')
        existing.teacher_id  = data.get('teacher_id')
        existing.start_time  = data.get('start_time', '')
        existing.end_time    = data.get('end_time', '')
        existing.room        = data.get('room', '')
        existing.is_break    = data.get('is_break', False)
        existing.break_label = data.get('break_label', '')
        db.session.commit()
        return jsonify(existing.to_dict()), 200
    p = TimetablePeriod(
        timetable_id = tt_id,
        day          = data['day'],
        period_no    = data['period_no'],
        subject_id   = data.get('subject_id'),
        teacher_id   = data.get('teacher_id'),
        start_time   = data.get('start_time', ''),
        end_time     = data.get('end_time', ''),
        room         = data.get('room', ''),
        is_break     = data.get('is_break', False),
        break_label  = data.get('break_label', ''),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@principal_bp.route('/timetables/periods/<int:period_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'TEACHER')
def delete_period(period_id):
    p = TimetablePeriod.query.get_or_404(period_id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Period deleted'}), 200


@principal_bp.route('/subjects', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_subjects():
    sid      = _school_id()
    class_id = request.args.get('class_id')
    try:
        q = Subject.query.join(Class, Subject.class_id == Class.id)\
                         .filter(Class.school_id == sid)
        if class_id:
            q = q.filter(Subject.class_id == class_id)
        subjects = q.all()
        return jsonify([s.to_dict() for s in subjects]), 200
    except Exception as e:
        return jsonify({'error': str(e), 'subjects': []}), 500




@principal_bp.route('/subjects', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_subject():
    data       = request.get_json()
    name       = data.get('name', '').strip()
    class_id   = data.get('class_id')
    teacher_id = data.get('teacher_id') or None
    if not name or not class_id:
        return jsonify({'error': 'name aur class_id zaroori hai'}), 400
    cls = Class.query.get_or_404(class_id)
    if cls.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    existing = Subject.query.filter_by(name=name, class_id=class_id).first()
    if existing:
        return jsonify({'error': 'Yeh subject is class mein already hai'}), 409
    try:
        subj = Subject(
            name       = name,
            class_id   = int(class_id),
            school_id  = _school_id(),
            teacher_id = int(teacher_id) if teacher_id else None,
        )
        db.session.add(subj)
        db.session.commit()
        return jsonify(subj.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@principal_bp.route('/subjects/<int:subj_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_subject(subj_id):
    subj = Subject.query.get_or_404(subj_id)
    db.session.delete(subj)
    db.session.commit()
    return jsonify({'message': 'Subject deleted'}), 200


# ─── ID Card Routes ───────────────────────────────────────────────────────────
# Yeh code principal.py ke BILKUL NEECHE add karo (last line ke baad)

@principal_bp.route('/students/<int:student_id>/id-card', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def generate_student_id_card(student_id):
    """
    Generate and download ID card PDF for a single student.
    GET /api/principal/students/<id>/id-card
    """
    from app.models.school import School
    from app.utils.id_card_generator import generate_id_card_pdf

    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    school = School.query.get(student.school_id)
    cls    = Class.query.get(student.class_id) if student.class_id else None

    student_dict = {
        'id':           student.id,
        'name':         student.user.name if student.user else '',
        'roll_number':  student.roll_number  or '',
        'admission_no': student.admission_no or '',
        'session':      student.session      or '',
        'dob':          str(student.dob)     if student.dob else '',
        'blood_group':  student.blood_group  or '',
        'gender':       student.gender       or '',
        'father_name':  student.father_name  or student.parent_name or '',
        'parent_phone': student.parent_phone or '',
        'photo_url':    student.photo_url    or None,
    }
    school_dict = {
        'name':    school.name     if school else '',
        'city':    school.city     if school else '',
        'address': school.address  if school else '',
        'phone':   school.phone    if school else '',
        'email':   school.email    if school else '',
        'logo_url':school.logo_url if school else None,
        'principal_signature_url': school.principal_signature_url if school else None,
    }
    cls_name = (f"{cls.name} - {cls.section}" if cls else '')

    buf = generate_id_card_pdf(student_dict, school_dict, cls_name)
    safe_name = (student.user.name or 'student').replace(' ', '_')
    filename  = f"IDCard_{safe_name}_{student.roll_number or student_id}.pdf"

    return send_file(
        buf,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=filename
    )


@principal_bp.route('/id-cards/bulk', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def bulk_id_cards():
    """
    Generate ZIP of ID card PDFs for a class or entire school.
    GET /api/principal/id-cards/bulk?class_id=1
    """
    import zipfile
    from app.models.school import School
    from app.utils.id_card_generator import generate_id_card_pdf

    sid      = _school_id()
    class_id = request.args.get('class_id')

    school   = School.query.get(sid)
    school_dict = {
        'name':    school.name     if school else '',
        'city':    school.city     if school else '',
        'address': school.address  if school else '',
        'phone':   school.phone    if school else '',
        'email':   school.email    if school else '',
        'logo_url':school.logo_url if school else None,
    }

    q = Student.query.filter_by(school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    students = q.all()

    if not students:
        return jsonify({'error': 'Koi student nahi mila'}), 404

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for s in students:
            cls      = Class.query.get(s.class_id) if s.class_id else None
            cls_name = f"{cls.name}-{cls.section}" if cls else 'No-Class'
            cls_folder = cls_name.replace(' ', '_')

            student_dict = {
                'id':           s.id,
                'name':         s.user.name if s.user else '',
                'roll_number':  s.roll_number  or '',
                'admission_no': s.admission_no or '',
                'session':      s.session      or '',
                'dob':          str(s.dob)     if s.dob else '',
                'blood_group':  s.blood_group  or '',
                'gender':       s.gender       or '',
                'father_name':  s.father_name  or s.parent_name or '',
                'parent_phone': s.parent_phone or '',
                'photo_url':    s.photo_url    or None,
            }

            pdf_buf  = generate_id_card_pdf(student_dict, school_dict,
                                            f"{cls.name} - {cls.section}" if cls else '')
            safe_n   = (s.user.name or 'student').replace(' ', '_')
            filename = f"{cls_folder}/Roll-{s.roll_number or s.id}/{safe_n}_IDCard.pdf"
            zf.writestr(filename, pdf_buf.read())

    zip_buf.seek(0)
    label = f"IDCards_Class{class_id}" if class_id else "IDCards_All"
    return send_file(
        zip_buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f"{label}_{date.today()}.zip"
    )


@principal_bp.route('/id-cards/preview/<int:student_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def preview_id_card_data(student_id):
    """
    Return JSON data for frontend live preview.
    GET /api/principal/id-cards/preview/<student_id>
    """
    from app.models.school import School

    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    school = School.query.get(student.school_id)
    cls    = Class.query.get(student.class_id) if student.class_id else None

    return jsonify({
        'student': {
            'id':           student.id,
            'name':         student.user.name if student.user else '',
            'roll_number':  student.roll_number  or '',
            'admission_no': student.admission_no or '',
            'session':      student.session      or '',
            'dob':          str(student.dob)     if student.dob else '',
            'blood_group':  student.blood_group  or '',
            'gender':       student.gender       or '',
            'father_name':  student.father_name  or student.parent_name or '',
            'parent_phone': student.parent_phone or '',
            'photo_url':    student.photo_url    or None,
            'class_name':   f"{cls.name} - {cls.section}" if cls else '',
        },
        'school': {
            'name':     school.name     if school else '',
            'city':     school.city     if school else '',
            'address':  school.address  if school else '',
            'phone':    school.phone    if school else '',
            'email':    school.email    if school else '',
            'logo_url': school.logo_url if school else None,
        }
    }), 200
# ── Employee ID Card Route — principal.py ke ID Card section mein add karo ──

@principal_bp.route('/teachers/<int:teacher_id>/id-card', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def generate_employee_id_card(teacher_id):
    """
    Generate Employee ID card PDF.
    GET /api/principal/teachers/<id>/id-card
    """
    from app.models.school import School
    from app.utils.id_card_generator import generate_id_card_pdf

    t = Teacher.query.get_or_404(teacher_id)
    if t.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    school = School.query.get(t.school_id)

    employee_dict = {
        'id':           t.id,
        'name':         t.user.name        if t.user else '',
        'employee_id':  t.employee_id      or '',
        'designation':  t.designation      or '',
        'department':   t.department       or '',
        'phone':        t.user.phone       if t.user else '',
        'joining_date': str(t.joining_date) if t.joining_date else '',
        'photo_url':    t.photo_url        or None,
        'session':      str(date.today().year),
    }
    school_dict = {
        'name':     school.name     if school else '',
        'city':     school.city     if school else '',
        'address':  school.address  if school else '',
        'phone':    school.phone    if school else '',
        'email':    school.email    if school else '',
        'logo_url': school.logo_url if school else None,
    }

    buf = generate_id_card_pdf(employee_dict, school_dict, card_type='employee')
    safe_name = (t.user.name if t.user else 'employee').replace(' ', '_')
    filename  = f"EmployeeIDCard_{safe_name}_{t.employee_id or teacher_id}.pdf"

    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=filename)


@principal_bp.route('/students/<int:student_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'TEACHER')
def update_student(student_id):
    """Edit student details from ID card management page."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json()

    # Update user name if provided
    if data.get('name') and student.user:
        student.user.name = data['name']

    # Update student fields
    for field in ['roll_number', 'gender', 'dob', 'address', 'session',
                  'blood_group', 'father_name', 'mother_name', 'parent_name',
                  'parent_phone', 'parent_email']:
        if field in data:
            val = data[field]
            if field == 'dob' and val:
                try:
                    val = date.fromisoformat(val)
                except Exception:
                    val = None
            setattr(student, field, val)

    db.session.commit()

    # Return updated preview data
    cls = Class.query.get(student.class_id) if student.class_id else None
    return jsonify({
        'id':           student.id,
        'name':         student.user.name if student.user else '',
        'roll_number':  student.roll_number  or '',
        'admission_no': student.admission_no or '',
        'session':      student.session      or '',
        'blood_group':  student.blood_group  or '',
        'gender':       student.gender       or '',
        'father_name':  student.father_name  or '',
        'parent_phone': student.parent_phone or '',
        'class_name':   f"{cls.name} - {cls.section}" if cls else '',
        'photo_url':    student.photo_url    or None,
    }), 200
@principal_bp.route('/staff-list', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def staff_list_for_id_cards():
    """Non-teacher staff (Librarian, Accountant, etc.) for ID card module."""
    from app.models.user import User, UserRole
    staff_roles = [UserRole.LIBRARIAN, UserRole.ACCOUNTANT, UserRole.RECEPTIONIST,
                   UserRole.HOSTEL, UserRole.TRANSPORT, UserRole.HR, UserRole.VICE_PRINCIPAL]
    users = User.query.filter(
        User.school_id == _school_id(),
        User.role.in_(staff_roles),
    ).all()
    return jsonify([{
        'id':           u.id,
        'name':         u.name,
        'employee_id':  u.username or str(u.id),
        'department':   u.department,
        'designation':  u.designation or u.role.value.replace('_', ' ').title(),
        'phone':        u.phone,
        'photo_url':    None,
        'joining_date': u.created_at.date().isoformat() if u.created_at else None,
    } for u in users]), 200


@principal_bp.route('/staff-list/<int:user_id>/id-card', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def generate_staff_id_card(user_id):
    from app.models.user import User
    from app.models.school import School
    from app.utils.id_card_generator import generate_id_card_pdf

    u = User.query.get_or_404(user_id)
    if u.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    school = School.query.get(u.school_id)
    employee_dict = {
        'id':           u.id,
        'name':         u.name,
        'employee_id':  u.username or str(u.id),
        'designation':  u.designation or u.role.value.replace('_', ' ').title(),
        'department':   u.department or '',
        'phone':        u.phone or '',
        'joining_date': u.created_at.date().isoformat() if u.created_at else '',
        'photo_url':    None,
        'session':      str(date.today().year),
    }
    school_dict = {
        'name':     school.name     if school else '',
        'city':     school.city     if school else '',
        'address':  school.address  if school else '',
        'phone':    school.phone    if school else '',
        'email':    school.email    if school else '',
        'logo_url': school.logo_url if school else None,
        'principal_signature_url': school.principal_signature_url if school else None,
    }

    buf = generate_id_card_pdf(employee_dict, school_dict, card_type='employee')
    safe_name = u.name.replace(' ', '_')
    filename  = f"StaffIDCard_{safe_name}_{u.id}.pdf"
    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=filename)





# ─── School Settings Routes ───────────────────────────────────────────────────
# Yeh poora block principal.py ke BILKUL END mein paste karo
# (delete_student route ke baad)

import cloudinary.uploader  # already imported hai principal.py mein — skip karo agar duplicate ho


@principal_bp.route('/school/settings', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_school_settings():
    """
    Apni school ki settings fetch karo.
    GET /api/principal/school/settings
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404
    return jsonify(school.to_dict()), 200


@principal_bp.route('/school/settings', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_school_settings():
    """
    School ki basic info update karo (text fields only).
    PATCH /api/principal/school/settings
    Body: { name, address, city, state, pincode, phone, email, current_session }
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404

    data = request.get_json()
    for field in ['name', 'address', 'city', 'state', 'pincode',
                  'phone', 'email', 'current_session']:
        if field in data:
            setattr(school, field, data[field])

    db.session.commit()
    return jsonify(school.to_dict()), 200


@principal_bp.route('/school/logo', methods=['POST', 'DELETE'])
@role_required('PRINCIPAL')
def school_logo():
    """
    Upload ya delete school logo.
    POST /api/principal/school/logo  — multipart/form-data, field: 'logo'
    DELETE /api/principal/school/logo
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404

    if request.method == 'DELETE':
        school.logo_url = None
        db.session.commit()
        return jsonify({'message': 'Logo deleted'}), 200

    file = request.files.get('logo')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: logo'}), 400

    result = cloudinary.uploader.upload(
        file,
        folder='eduerp/schools',
        public_id=f'school_{_school_id()}_logo',
        overwrite=True,
        resource_type='image',
    )
    school.logo_url = result['secure_url']
    db.session.commit()
    return jsonify({'logo_url': school.logo_url}), 200


@principal_bp.route('/school/principal-signature', methods=['POST', 'DELETE'])
@role_required('PRINCIPAL')
def school_principal_signature():
    """
    Upload ya delete principal signature image.
    POST /api/principal/school/principal-signature — field: 'signature'
    DELETE /api/principal/school/principal-signature

    Note: Sirf signature wala area crop hokar aata hai — white background
    automatically transparent ho jaata hai PDF mein (mask='auto').
    Teacher/Principal apna signature white paper pe likhkar photo le,
    crop karke upload kare — sirf signature dikhega, page nahi.
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404

    if request.method == 'DELETE':
        school.principal_signature_url = None
        db.session.commit()
        return jsonify({'message': 'Principal signature deleted'}), 200

    file = request.files.get('signature')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: signature'}), 400

    result = cloudinary.uploader.upload(
        file,
        folder='eduerp/schools',
        public_id=f'school_{_school_id()}_principal_sig',
        overwrite=True,
        resource_type='image',
    )
    school.principal_signature_url = result['secure_url']
    db.session.commit()
    return jsonify({'principal_signature_url': school.principal_signature_url}), 200


@principal_bp.route('/school/director-signature', methods=['POST', 'DELETE'])
@role_required('PRINCIPAL')
def school_director_signature():
    """
    Upload ya delete director/chairman signature image.
    POST /api/principal/school/director-signature — field: 'signature'
    DELETE /api/principal/school/director-signature
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404

    if request.method == 'DELETE':
        school.director_signature_url = None
        db.session.commit()
        return jsonify({'message': 'Director signature deleted'}), 200

    file = request.files.get('signature')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: signature'}), 400

    result = cloudinary.uploader.upload(
        file,
        folder='eduerp/schools',
        public_id=f'school_{_school_id()}_director_sig',
        overwrite=True,
        resource_type='image',
    )
    school.director_signature_url = result['secure_url']
    db.session.commit()
    return jsonify({'director_signature_url': school.director_signature_url}), 200



@principal_bp.route('/my-services', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def my_services():
    """
    School ki apni service list — kaunsi active hain, kaunsi locked
    (upgrade ke liye), pricing ke saath. Read-only, ChatGPT/Claude-style.
    """
    from app.models.school import School
    school = School.query.get(_school_id())
    if not school:
        return jsonify({'error': 'School nahi mili'}), 404

    enabled = set(school.get_features())
    plan    = school.plan or 'BASIC'

    result = []
    for f in FEATURE_CATALOG:
        is_active = f['key'] in enabled
        result.append({
            'key':         f['key'],
            'label':       f['label'],
            'tier':        f['tier'],
            'is_active':   is_active,
            'tier_price':  PLAN_PRICING.get(f['tier'], {}).get('price'),
            'tier_label':  PLAN_PRICING.get(f['tier'], {}).get('label'),
        })

    return jsonify({
        'current_plan':  plan,
        'current_price': PLAN_PRICING.get(plan, {}).get('price'),
        'features':      result,
        'pricing':       PLAN_PRICING,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════════
#  Principal — User & Credential Management
# ═══════════════════════════════════════════════════════════════════════════════

import re   as _re
import string as _string
import random  as _random
from app.models.user import PRINCIPAL_ALLOWED_ROLES


def _norm(s):
    return _re.sub(r'\s+', ' ', (s or '').strip()).lower()


def _gen_username_p(name: str, role: str) -> str:
    """Same logic as admin version but scoped here to avoid circular import."""
    role_suffix = {
        'VICE_PRINCIPAL': 'vp', 'TEACHER': 'tchr', 'ACCOUNTANT': 'acct',
        'RECEPTIONIST': 'rcpt', 'LIBRARIAN': 'lib', 'HOSTEL': 'hstl',
        'TRANSPORT': 'trns', 'HR': 'hr', 'STUDENT': 'stu', 'PARENT': 'prnt',
    }.get(role, 'usr')

    from app.models.user import User
    clean = _re.sub(r'[^a-z0-9 ]', '', name.lower().strip())
    parts = clean.split()[:2]
    base  = '.'.join(parts) + '.' + role_suffix

    if not User.query.filter_by(username=base).first():
        return base

    for _ in range(20):
        candidate = base + '.' + ''.join(_random.choices(_string.digits, k=3))
        if not User.query.filter_by(username=candidate).first():
            return candidate

    return base + '.' + ''.join(_random.choices(_string.digits, k=6))


# ── List users of own school ───────────────────────────────────────────────────
@principal_bp.route('/users', methods=['GET'])
@role_required('PRINCIPAL')
@feature_required('role_based_access')
def principal_list_users():
    """
    GET /api/principal/users
    Query: role, status, search, page, per_page
    Returns only users belonging to the principal's school.
    """
    from app.models.user import User, UserRole
    sid = _school_id()

    q       = User.query.filter(User.school_id == sid)
    role_f  = request.args.get('role')
    status_f = request.args.get('status')
    search  = (request.args.get('search') or '').strip().lower()
    page    = max(1, int(request.args.get('page', 1)))
    per_page = min(200, int(request.args.get('per_page', 50)))

    if role_f:
        try:
            q = q.filter(User.role == UserRole(role_f))
        except ValueError:
            pass
    if status_f == 'active':
        q = q.filter(User.is_active == True)
    elif status_f == 'inactive':
        q = q.filter(User.is_active == False)
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(
            User.name.ilike(like),
            User.email.ilike(like),
            User.username.ilike(like),
            User.phone.ilike(like),
        ))

    total = q.count()
    users = q.order_by(User.created_at.desc())\
              .offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'users':    [u.to_dict_with_credentials() for u in users],
        'total':    total,
        'page':     page,
        'per_page': per_page,
        'pages':    (total + per_page - 1) // per_page,
    }), 200


# ── Create user (restricted roles only) ───────────────────────────────────────
@principal_bp.route('/users', methods=['POST'])
@role_required('PRINCIPAL')
@feature_required('role_based_access')
def principal_create_user():
    """
    Principal can only create users for THEIR school.
    Cannot create SUPER_ADMIN or another PRINCIPAL.
    """
    from app.models.user import User, UserRole
    from sqlalchemy import func as sqlfunc

    sid  = _school_id()
    data = request.get_json() or {}

    # Role guard
    role_str = (data.get('role') or '').strip()
    try:
        requested_role = UserRole(role_str)
    except ValueError:
        return jsonify({'error': f'Invalid role: {role_str}'}), 400

    if requested_role not in PRINCIPAL_ALLOWED_ROLES:
        return jsonify({
            'error': f'Principal cannot create users with role {role_str}'
        }), 403

    # ── Admin account limit check ─────────────────────────────────────────
    from app.utils.plan_limits import (
        get_limit, get_school_plan, ADMIN_TYPE_ROLES
    )
    if requested_role in ADMIN_TYPE_ROLES:
        plan          = get_school_plan(sid)
        limit         = get_limit(plan, 'admin_accounts')
        current_admins = User.query.filter(
            User.school_id == sid,
            User.role.in_(list(ADMIN_TYPE_ROLES)),
            User.is_active == True
        ).count()
        if current_admins >= limit:
            return jsonify({
                'error':   'admin_limit_reached',
                'message': f'Aapke {plan} plan mein sirf {limit} admin-type accounts '
                           f'allowed hain. Abhi {current_admins} active hain. Upgrade karo.',
                'current': current_admins,
                'limit':   limit,
                'plan':    plan,
            }), 403
    # ─────────────────────────────────────────────────────────────────────

    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name is required'}), 400
    if not (data.get('email') or '').strip():
        return jsonify({'error': 'email is required'}), 400

    email = data['email'].strip().lower()
    if User.query.filter(sqlfunc.lower(User.email) == email).first():
        return jsonify({'error': 'Email already exists'}), 409

    plain_pw = (data.get('password') or '').strip() or 'EduErp@123'

    username = (data.get('username') or '').strip().lower() or None
    if username:
        if User.query.filter_by(username=username).first():
            return jsonify({'error': 'Username already taken'}), 409
    else:
        username = _gen_username_p(data['name'], role_str)

    user = User(
        name        = data['name'].strip(),
        email       = email,
        username    = username,
        role        = requested_role,
        school_id   = sid,
        phone       = (data.get('phone') or '').strip() or None,
        department  = (data.get('department') or '').strip() or None,
        designation = (data.get('designation') or '').strip() or None,
        is_active   = True,
    )
    user.set_password(plain_pw, store_plain=True)

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict_with_credentials()), 201


# ── Reset password (own school only) ──────────────────────────────────────────
@principal_bp.route('/users/<int:user_id>/reset-password', methods=['PUT'])
@role_required('PRINCIPAL')
def principal_reset_password(user_id):
    from app.models.user import User, UserRole
    sid  = _school_id()
    user = User.query.get_or_404(user_id)

    # Must belong to same school
    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized: user belongs to a different school'}), 403

    # Cannot reset SUPER_ADMIN or another PRINCIPAL (optional safety guard)
    if user.role in (UserRole.SUPER_ADMIN, UserRole.PRINCIPAL):
        return jsonify({'error': 'Cannot reset password for this role'}), 403

    data     = request.get_json() or {}
    plain_pw = (data.get('password') or '').strip() or 'EduErp@123'

    user.set_password(plain_pw, store_plain=True)
    db.session.commit()

    return jsonify({
        'message':             'Password reset successful',
        'plain_password_temp': user.plain_password_temp,
        'username':            user.username,
        'email':               user.email,
    }), 200


# ── Toggle active/inactive (own school only) ───────────────────────────────────
@principal_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
@role_required('PRINCIPAL')
def principal_toggle_user(user_id):
    from app.models.user import User, UserRole
    sid  = _school_id()
    user = User.query.get_or_404(user_id)

    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if user.role in (UserRole.SUPER_ADMIN, UserRole.PRINCIPAL):
        return jsonify({'error': 'Cannot deactivate this role'}), 403

    user.is_active = not user.is_active
    db.session.commit()
    return jsonify({
        'is_active': user.is_active,
        'message':   'User ' + ('activated' if user.is_active else 'deactivated'),
    }), 200




# ── Get single user profile (own school only) ──────────────────────────────
@principal_bp.route('/users/<int:user_id>/profile', methods=['GET'])
@role_required('PRINCIPAL')
@feature_required('role_based_access')
def principal_user_profile(user_id):
    from app.models.user import User
    sid  = _school_id()
    user = User.query.get_or_404(user_id)
    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(user.to_dict_with_credentials()), 200


# ── Update user profile fields (own school only) ────────────────────────────
@principal_bp.route('/users/<int:user_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
@feature_required('role_based_access')
def principal_update_user(user_id):
    from app.models.user import User, UserRole
    sid  = _school_id()
    user = User.query.get_or_404(user_id)
    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if user.role in (UserRole.SUPER_ADMIN, UserRole.PRINCIPAL):
        return jsonify({'error': 'Cannot edit this role'}), 403

    data = request.get_json() or {}
    for field in ['name', 'phone', 'department', 'designation']:
        if field in data:
            setattr(user, field, (data[field] or '').strip() or None)


@principal_bp.route('/students/<int:student_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_student(student_id):
    """Delete a student — cascades through academic records + Communication Hub."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    user = student.user

    # ── Academic / financial records tied to student_id ──
    Attendance.query.filter_by(student_id=student_id).delete()
    FeeRecord.query.filter_by(student_id=student_id).delete()
    Marks.query.filter_by(student_id=student_id).delete()

    try:
        from app.models.financial import FeeTransaction
        FeeTransaction.query.filter_by(student_id=student_id).delete()
    except Exception:
        pass

    db.session.flush()

    # ── Communication Hub — NOT NULL FKs to users.id must be deleted, not nullified ──
    if user:
        from app.models.communication import (
            SupportTicket, TicketReply, ChatMessage,
            SupportNotification, MeetingRequest, SupportAttachment
        )

        # Ticket replies authored by this user (replied_by NOT NULL)
        TicketReply.query.filter_by(replied_by=user.id).delete(synchronize_session=False)

        # Attachments uploaded by this user (uploaded_by NOT NULL)
        SupportAttachment.query.filter_by(uploaded_by=user.id).delete(synchronize_session=False)

        # Tickets raised by this user (raised_by NOT NULL) — cascades to that
        # ticket's own replies/attachments/notifications via model-level cascade
        SupportTicket.query.filter_by(raised_by=user.id).delete(synchronize_session=False)

        # Nullable FKs on tickets — clear references without deleting the ticket
        SupportTicket.query.filter_by(assigned_to=user.id)\
            .update({'assigned_to': None}, synchronize_session=False)
        SupportTicket.query.filter_by(resolved_by=user.id)\
            .update({'resolved_by': None}, synchronize_session=False)

        # Chat messages — sender_id / receiver_id both NOT NULL
        ChatMessage.query.filter(
            db.or_(ChatMessage.sender_id == user.id, ChatMessage.receiver_id == user.id)
        ).delete(synchronize_session=False)

        # In-app notifications (user_id NOT NULL)
        SupportNotification.query.filter_by(user_id=user.id).delete(synchronize_session=False)

        # Meeting requests raised by this user (requested_by NOT NULL)
        MeetingRequest.query.filter_by(requested_by=user.id).delete(synchronize_session=False)
        # Nullable handled_by reference
        MeetingRequest.query.filter_by(handled_by=user.id)\
            .update({'handled_by': None}, synchronize_session=False)

        db.session.flush()

    db.session.delete(student)
    db.session.flush()
    if user:
        db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Student deleted'}), 200

@principal_bp.route('/teacher/my-assignments', methods=['GET'])
@role_required('TEACHER')
def my_teaching_assignments():
    """Teacher ko sirf wahi classes+subjects dikhao jo unhe assign hain."""
    from app.models.academic import Teacher
    user = get_current_user()
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if not teacher:
        return jsonify([]), 200
    subjects = Subject.query.filter_by(teacher_id=teacher.id).all()
    result = []
    for s in subjects:
        cls = Class.query.get(s.class_id)
        if cls:
            result.append({
                'class_id':    cls.id,
                'class_name':  f"{cls.name} {cls.section}",
                'subject_id':  s.id,
                'subject_name': s.name,
            })
    return jsonify(result), 200

    db.session.commit()
    return jsonify(user.to_dict_with_credentials()), 200
