from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import (
    Class, Teacher, Student, Subject, Marks,
    Attendance, TeacherAttendance, TeacherAttendanceRequest, Note
)
from app.models.financial import (
    FeeRecord, FeeStructure, FeeTransaction, FeeGenerationBatch,
    ExamSchedule, ExamTimetable, ExamClass, ExamSubject, ExamTeacherDelegation, ResultVersion,
    Holiday, Timetable, TimetablePeriod,
    FeeReceiptGroup,
)
from app.models.documents import (
    IssuedDocument, StudentDocument, SchoolDocumentRequirement,
    get_school_doc_requirements, STUDENT_DOC_TYPE_LABELS, ISSUED_DOC_TYPE_LABELS,
    DEFAULT_DOC_REQUIREMENTS, CERTIFICATE_TEMPLATES
)
import json

STUDENT_DOC_TYPES = list(STUDENT_DOC_TYPE_LABELS.keys())
ISSUED_DOC_TYPES  = list(ISSUED_DOC_TYPE_LABELS.keys())


from app.utils.decorators import role_required, get_current_user
from app.services.permission_resolver import permission_required, role_or_permission_required
from app.utils.feature_gate import feature_required
from app.utils.pdf_generator import (
    generate_admit_card, generate_result_card,
    generate_bulk_admit_cards, generate_bulk_result_cards
)
from app.routes.admin import FEATURE_CATALOG, PLAN_PRESETS, PLAN_PRICING

from sqlalchemy import func
from datetime import date, datetime, timedelta
import random, string, re
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
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN', 'ADMIN')
def list_classes():
    classes = Class.query.filter_by(school_id=_school_id()).order_by(Class.name.asc(), Class.section.asc()).all()
    result = []
    for c in classes:
        d = c.to_dict()
        d['student_count'] = c.students.count()
        d['subjects_count'] = c.subjects.count()
        t_name = ''
        if c.teacher_id:
            t = Teacher.query.get(c.teacher_id)
            if t and t.user:
                t_name = t.user.name
        d['teacher_name'] = t_name
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

    # ── Class Subjects list with teacher details ──
    subjects_list = [s.to_dict() for s in cls.subjects.order_by(Subject.name.asc()).all()]

    return jsonify({
        'class_id':       cls.id,
        'class_name':     cls.name,
        'section':        cls.section,
        'session':        cls.session,
        'total_students': total_students,
        'subjects':       subjects_list,
        'subjects_count': len(subjects_list),
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
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
@feature_required('teacher_management')
def list_teachers():
    teachers = Teacher.query.filter_by(school_id=_school_id()).filter(Teacher.is_deleted == False).all()
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
        dob          = date.fromisoformat(data['dob']) if data.get('dob') else None,
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
        'dob':          str(t.dob) if t.dob else '',
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
@role_or_permission_required(
    roles=['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT'],
    permissions=['staff.payroll.view', 'staff.payroll.manage'],
)
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
            'id':               r.id,
            'type':             'TEACHER',
            'person_id':        r.teacher_id,
            'person_name':      t.user.name if (t and t.user) else 'Unknown',
            'employee_id':      t.employee_id if t else '',
            'role_label':       'Teacher',
            'month':            r.month,
            'amount':           r.amount,
            'status':           r.status,
            'payment_date':     str(r.payment_date) if r.payment_date else None,
            'note':             r.note or '',
            'is_acknowledged':  r.is_acknowledged,
            'acknowledged_at':  r.acknowledged_at.isoformat() if r.acknowledged_at else None,
        })
    for r in staff_records:
        u = User.query.get(r.user_id)
        out.append({
            'id':               r.id,
            'type':             'STAFF',
            'person_id':        r.user_id,
            'person_name':      u.name if u else 'Unknown',
            'employee_id':      '',
            'role_label':       u.role.value if u else '',
            'month':            r.month,
            'amount':           r.amount,
            'status':           r.status,
            'payment_date':     str(r.payment_date) if r.payment_date else None,
            'note':             r.note or '',
            'is_acknowledged':  r.is_acknowledged,
            'acknowledged_at':  r.acknowledged_at.isoformat() if r.acknowledged_at else None,
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
    q = Student.query.filter_by(school_id=_school_id()).filter(Student.is_deleted == False)
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


@principal_bp.route('/students/check-duplicate', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'RECEPTIONIST')
def check_duplicate_student():
    """
    Pre-admission duplicate student check:
    Searches within the authenticated school for potential duplicates by:
    - Student Name + DOB
    - Parent Mobile Number
    - Aadhaar Number
    """
    sid = _school_id()
    name = (request.args.get('name') or '').strip().lower()
    dob_str = (request.args.get('dob') or '').strip()
    parent_phone = re.sub(r'\D', '', request.args.get('parent_phone') or '')
    aadhar_no = (request.args.get('aadhar_no') or '').strip()

    matches = []
    query = Student.query.join(User, Student.user_id == User.id).filter(
        Student.school_id == sid,
        Student.is_deleted == False
    )

    conditions = []
    if name and dob_str:
        try:
            d_val = date.fromisoformat(dob_str[:10])
            conditions.append(db.and_(func.lower(User.name) == name, Student.dob == d_val))
        except Exception:
            pass
    if parent_phone and len(parent_phone) >= 10:
        conditions.append(Student.parent_phone.endswith(parent_phone[-10:]))
    if aadhar_no and len(aadhar_no) >= 6:
        conditions.append(Student.aadhar_no == aadhar_no)

    if conditions:
        query = query.filter(db.or_(*conditions))
        found = query.limit(5).all()
        for s in found:
            matches.append({
                'id': s.id,
                'name': s.user.name if s.user else '',
                'admission_no': s.admission_no or '',
                'class_display': f"{s.class_ref.name} - {s.class_ref.section}".strip(' -') if s.class_ref else '',
                'parent_name': s.parent_name or s.father_name or '',
                'parent_phone': s.parent_phone or '',
                'dob': str(s.dob) if s.dob else ''
            })

    return jsonify({
        'has_duplicate': len(matches) > 0,
        'matches': matches
    }), 200


@principal_bp.route('/students', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_student():
    from app.utils.plan_limits import get_limit, get_school_plan

    data   = request.get_json() or {}
    sid    = _school_id()
    plan   = get_school_plan(sid)
    limit  = get_limit(plan, 'students')

    current_count = Student.query.filter_by(school_id=sid).filter(Student.is_deleted == False).count()
    if current_count >= limit:
        return jsonify({
            'error':   'student_limit_reached',
            'message': f'Aapke {plan} plan mein sirf {limit} students allowed hain. '
                       f'Abhi {current_count} students hain. Upgrade karo aage badhne ke liye.',
            'current': current_count,
            'limit':   limit,
            'plan':    plan,
        }), 403

    # 15s Idempotency protection against rapid double-clicks
    recent_cutoff = datetime.utcnow() - timedelta(seconds=15)
    name_clean = (data.get('name') or '').strip()
    phone_clean = (data.get('parent_phone') or '').strip()
    if name_clean and phone_clean:
        dup_recent = Student.query.join(User, Student.user_id == User.id).filter(
            Student.school_id == sid,
            func.lower(User.name) == name_clean.lower(),
            Student.parent_phone == phone_clean,
            Student.class_id == data.get('class_id'),
            User.created_at >= recent_cutoff
        ).first()
        if dup_recent:
            return jsonify(dup_recent.to_dict()), 200

    try:
        raw_email = (data.get('email') or '').strip().lower()
        first = ''.join(c for c in (name_clean or 'student').lower().split()[0] if c.isalnum()) or 'student'
        if not raw_email:
            raw_email = f"{first}{random.randint(100, 999)}@eduerp.com"

        final_email = raw_email
        counter = 1
        while User.query.filter_by(email=final_email).first():
            base = raw_email.split('@')[0]
            domain = raw_email.split('@')[1] if '@' in raw_email else 'eduerp.com'
            final_email = f"{base}_{random.randint(100, 999)}@{domain}"
            counter += 1
            if counter > 10:
                final_email = f"{first}_{int(datetime.utcnow().timestamp())}@{domain}"
                break

        user = User(
            name=name_clean or 'Student',
            email=final_email,
            role=UserRole.STUDENT,
            school_id=sid
        )
        user.set_password(data.get('password', 'Student@123'), store_plain=True)
        db.session.add(user)
        db.session.flush()

        # Parse dates safely
        dob_val = None
        if data.get('dob'):
            try:
                dob_val = date.fromisoformat(str(data['dob'])[:10])
            except Exception:
                dob_val = None

        adm_date_val = None
        if data.get('admission_date') or data.get('date_of_joining'):
            try:
                raw_adm = data.get('admission_date') or data.get('date_of_joining')
                adm_date_val = date.fromisoformat(str(raw_adm)[:10])
            except Exception:
                adm_date_val = date.today()
        else:
            adm_date_val = date.today()

        tc_date_val = None
        if data.get('previous_tc_date'):
            try:
                tc_date_val = date.fromisoformat(str(data['previous_tc_date'])[:10])
            except Exception:
                tc_date_val = None

        # Safe monotonic admission_no
        session_str = data.get('session', '2024-25')
        year_prefix = session_str[:4] if session_str else '2024'
        adm_no = (data.get('admission_no') or '').strip()
        if not adm_no:
            count_all = Student.query.filter_by(school_id=sid).count()
            seq = count_all + 1
            candidate = f"ADM-{year_prefix}-{seq:04d}"
            while Student.query.filter_by(school_id=sid, admission_no=candidate).first():
                seq += 1
                candidate = f"ADM-{year_prefix}-{seq:04d}"
            adm_no = candidate
        else:
            if Student.query.filter_by(school_id=sid, admission_no=adm_no).first():
                adm_no = f"{adm_no}-{random.randint(10, 99)}"

        roll_no = (data.get('roll_number') or '').strip()
        if not roll_no and data.get('class_id'):
            count_in_cls = Student.query.filter_by(school_id=sid, class_id=data.get('class_id')).count()
            roll_no = str(count_in_cls + 1)

        is_first = bool(data.get('is_first_school'))

        student = Student(
            user_id=user.id,
            school_id=sid,
            class_id=data.get('class_id'),
            roll_number=roll_no,
            admission_no=adm_no,
            parent_name=data.get('parent_name') or data.get('father_name'),
            parent_phone=phone_clean,
            parent_email=data.get('parent_email'),
            father_name=data.get('father_name'),
            father_occupation=data.get('father_occupation'),
            mother_name=data.get('mother_name'),
            mother_occupation=data.get('mother_occupation'),
            guardian_name=data.get('guardian_name'),
            guardian_relation=data.get('guardian_relation') or data.get('emergency_relation'),
            guardian_phone=data.get('guardian_phone') or data.get('emergency_phone'),
            gender=data.get('gender'),
            dob=dob_val,
            blood_group=data.get('blood_group'),
            category=data.get('category', 'General'),
            nationality=data.get('nationality', 'Indian'),
            religion=data.get('religion'),
            address=data.get('address'),
            session=session_str,
            admission_date=adm_date_val,
            aadhar_no=data.get('aadhar_no'),
            parent_aadhar_no=data.get('parent_aadhar_no'),
            is_first_school=is_first,
            previous_school_name=None if is_first else (data.get('previous_school_name') or data.get('previous_school')),
            previous_class=None if is_first else data.get('previous_class'),
            previous_tc_no=None if is_first else data.get('previous_tc_no'),
            previous_tc_date=None if is_first else tc_date_val,
            previous_reason=None if is_first else data.get('previous_reason'),
        )
        db.session.add(student)
        db.session.flush()

        # Optional Transport Assignment
        if data.get('transport_route_id') or data.get('transport_stop_id'):
            try:
                from app.models.transport_student import StudentTransport
                trans = StudentTransport(
                    school_id=sid,
                    student_id=student.id,
                    route_id=data.get('transport_route_id'),
                    stop_id=data.get('transport_stop_id'),
                    pickup_stop_id=data.get('transport_stop_id'),
                    drop_stop_id=data.get('transport_stop_id'),
                    academic_year=session_str,
                    status='ACTIVE',
                    created_by=get_current_user().id if get_current_user() else None
                )
                db.session.add(trans)
            except Exception as trans_err:
                print(f'[WARN] Transport assignment error: {trans_err}')

        # Optional Hostel Allocation
        if data.get('hostel_bed_id'):
            try:
                from app.models.hostel import HostelBedAllocation, HostelBed
                bed = HostelBed.query.filter_by(id=data.get('hostel_bed_id'), school_id=sid).first()
                if bed and bed.status == 'AVAILABLE':
                    alloc = HostelBedAllocation(
                        school_id=sid,
                        student_id=student.id,
                        bed_id=bed.id,
                        room_id=bed.room_id,
                        status='ACTIVE',
                        allocated_at=datetime.utcnow()
                    )
                    bed.status = 'OCCUPIED'
                    db.session.add(alloc)
            except Exception as hostel_err:
                print(f'[WARN] Hostel allocation error: {hostel_err}')

        # Integrated Fee Structure & Charge
        try:
            admission_fs = FeeStructure.query.filter_by(
                school_id=sid, class_id=student.class_id, fee_type='ADMISSION',
                frequency='ONE_TIME', status='ACTIVE'
            ).first() or FeeStructure.query.filter_by(
                school_id=sid, class_id=None, fee_type='ADMISSION',
                frequency='ONE_TIME', status='ACTIVE'
            ).first()

            adm_fee_amt = 0.0
            if data.get('admission_fee'):
                try:
                    adm_fee_amt = float(data.get('admission_fee'))
                except (ValueError, TypeError):
                    adm_fee_amt = 0.0
            if adm_fee_amt <= 0 and admission_fs:
                adm_fee_amt = float(admission_fs.amount or 0.0)

            if adm_fee_amt > 0:
                rec = FeeRecord(
                    school_id=sid, student_id=student.id, fee_type='ADMISSION',
                    amount_due=adm_fee_amt, amount_paid=0, status='PENDING',
                    due_date=date.today() + timedelta(days=7),
                    session=student.session, remarks='Admission Fee — auto-generated',
                    source='ADMISSION', source_ref_id=student.id,
                )
                db.session.add(rec)

                try:
                    from app.services.fee_ledger_service import register_or_sync_service_charge
                    register_or_sync_service_charge(
                        school_id=sid,
                        student_id=student.id,
                        amount=adm_fee_amt,
                        fee_head_code='ADMISSION',
                        department='ACCOUNTS',
                        source_module='ADMISSION',
                        source_type='ADMISSION_FEE',
                        source_ref_id=student.id,
                        description='Admission Fee — auto-generated',
                        session=student.session,
                        actor_user_id=get_current_user().id if get_current_user() else None
                    )
                except Exception:
                    pass
        except Exception:
            pass

        db.session.commit()
        return jsonify(student.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to admit student: {str(e)}'}), 500
    


# ─── Fees ─────────────────────────────────────────────────────────────────────


# ─── Fees ─────────────────────────────────────────────────────────────────────

@principal_bp.route('/fees/summary', methods=['GET'])
@permission_required('fees.reports.view')
def fees_summary():
    sid = _school_id()
    # NEW
    total_due  = db.session.query(func.sum(FeeRecord.amount_due))\
        .filter(FeeRecord.school_id == sid, FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])).scalar() or 0
    total_paid = db.session.query(func.sum(FeeRecord.amount_paid))\
        .filter(FeeRecord.school_id == sid, FeeRecord.status.notin_(['DRAFT', 'CANCELLED'])).scalar() or 0
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

    # Department/Service breakdown of Today's collection in a single joined query
    today_txns = db.session.query(
        FeeTransaction.amount,
        FeeRecord.source,
        FeeRecord.fee_type
    ).outerjoin(
        FeeRecord, FeeTransaction.fee_record_id == FeeRecord.id
    ).filter(
        FeeTransaction.school_id == sid,
        FeeTransaction.transaction_date == today
    ).all()

    today_by_dept = {
        'academic': 0.0,
        'hostel': 0.0,
        'transport': 0.0,
        'library': 0.0,
        'admission': 0.0,
        'other': 0.0,
        'total': float(today_collection or 0.0),
    }
    for amt_val, rec_source, rec_type in today_txns:
        src = (rec_source if rec_source else (rec_type if rec_type else 'ACADEMIC')).upper()
        amt = float(amt_val or 0.0)
        if 'HOSTEL' in src:
            today_by_dept['hostel'] += amt
        elif 'TRANSPORT' in src:
            today_by_dept['transport'] += amt
        elif 'LIBRARY' in src:
            today_by_dept['library'] += amt
        elif 'ADMISSION' in src:
            today_by_dept['admission'] += amt
        elif any(k in src for k in ['ACADEMIC', 'TUITION', 'EXAM']):
            today_by_dept['academic'] += amt
        else:
            today_by_dept['other'] += amt

    for k in ['academic', 'hostel', 'transport', 'library', 'admission', 'other']:
        today_by_dept[k] = round(today_by_dept[k], 2)

    return jsonify({
        'total_due': total_due, 'total_collected': total_paid,
        'pending_count': pending, 'overdue_count': overdue,
        'collection_rate': round(total_paid / total_due * 100, 1) if total_due else 0,

        'today_collection':      today_collection,
        'today_breakdown':       today_by_dept,
        'this_month':            this_month,
        'this_month_collection': month_collection,
        'cash_collection':       mode_map.get('CASH', 0),
        'upi_collection':        mode_map.get('UPI', 0),
        'online_collection':     mode_map.get('ONLINE', 0),
        'cheque_collection':     mode_map.get('CHEQUE', 0),
    }), 200


@principal_bp.route('/fees/recent-collections', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN', 'TEACHER')
def recent_fee_collections():
    sid = _school_id()
    try:
        from app.models.fee_finance import FeePayment
        now = datetime.utcnow()
        result = []

        # 1. Fetch recent central payments
        payments = FeePayment.query.filter_by(school_id=sid, status='VALID')\
            .order_by(FeePayment.id.desc()).limit(10).all()

        if payments:
            for p in payments:
                student = p.student or (Student.query.get(p.student_id) if p.student_id else None)
                user = student.user if student else None
                cls = student.class_ref if student and hasattr(student, 'class_ref') and student.class_ref else None
                class_name = f"{cls.name} - {cls.section}" if cls else '—'
                student_name = user.name if user else 'Student'

                diff = now - (p.created_at or datetime.combine(p.payment_date, datetime.min.time()))
                mins = int(diff.total_seconds() / 60)
                if mins < 1:
                    time_ago = 'Just now'
                elif mins < 60:
                    time_ago = f"{mins} mins ago"
                elif mins < 1440:
                    time_ago = f"{mins // 60} hours ago"
                else:
                    time_ago = f"{diff.days} days ago"

                col_user = p.collector
                col_name = col_user.name if col_user else 'Counter Staff'
                col_role = getattr(col_user.role, 'value', str(col_user.role)) if (col_user and hasattr(col_user, 'role')) else 'Staff'

                # Clean role label (e.g. HOSTEL -> Warden, LIBRARIAN -> Librarian, PRINCIPAL -> Principal)
                role_label = 'Warden' if col_role == 'HOSTEL' else ('Librarian' if col_role == 'LIBRARIAN' else ('Accountant' if col_role in ('ACCOUNTANT', 'FINANCE') else col_role.title()))

                result.append({
                    'id': p.id,
                    'receipt_no': p.receipt_no,
                    'student_name': student_name,
                    'class_name': class_name,
                    'amount': float(p.total_paid or 0),
                    'department': p.department or 'ACCOUNTS',
                    'service': p.department or 'Tuition',
                    'collector_name': col_name,
                    'collector_role': role_label,
                    'time_ago': time_ago,
                    'date': p.payment_date.strftime('%d %b %Y') if p.payment_date else 'Today',
                    'status': 'Paid'
                })
        else:
            # Fallback to FeeTransaction / FeeRecord
            txns = FeeTransaction.query.filter_by(school_id=sid)\
                .order_by(FeeTransaction.id.desc()).limit(10).all()
            for t in txns:
                student = Student.query.get(t.student_id) if t.student_id else None
                cls = Class.query.get(student.class_id) if (student and student.class_id) else None
                class_name = f"{cls.name}{' - ' + cls.section if cls.section else ''}" if cls else '—'
                student_name = student.user.name if (student and student.user) else 'Student'
                col_user = User.query.get(t.collected_by) if t.collected_by else None
                col_role = getattr(col_user.role, 'value', str(col_user.role)) if (col_user and hasattr(col_user, 'role')) else 'Staff'
                role_label = 'Warden' if col_role == 'HOSTEL' else ('Librarian' if col_role == 'LIBRARIAN' else ('Accountant' if col_role in ('ACCOUNTANT', 'FINANCE') else col_role.title()))

                result.append({
                    'id': t.id,
                    'receipt_no': t.receipt_no or f"RCPT/{t.id:04d}",
                    'student_name': student_name,
                    'class_name': class_name,
                    'amount': float(t.amount or 0),
                    'department': 'ACCOUNTS',
                    'service': 'School Fee',
                    'collector_name': col_user.name if col_user else 'Counter Staff',
                    'collector_role': role_label,
                    'time_ago': 'Recent',
                    'date': t.transaction_date.strftime('%d %b %Y') if t.transaction_date else 'Today',
                    'status': 'Paid'
                })

        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify([]), 200


@principal_bp.route('/fees/records', methods=['GET'])
@permission_required('fees.receipt.view')
def fee_records():
    sid        = _school_id()
    class_id   = request.args.get('class_id')
    status     = request.args.get('status')
    student_id = request.args.get('student_id')
    month      = request.args.get('month')
    fee_type   = request.args.get('fee_type')

    # NEW
    q = FeeRecord.query.filter_by(school_id=sid)

    if status:
        q = q.filter_by(status=status)
    else:
        q = q.filter(FeeRecord.status != 'DRAFT')
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
@permission_required('fees.collect')
def collect_fee():
    """
    Collect fee for a student.
    Body: record_id, amount_paid, payment_mode
    """
    try:
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
        record.amount_paid  = (record.amount_paid or 0) + new_payment
        record.payment_mode = data.get('payment_mode', 'CASH')
        record.paid_date    = date.today()
        record.collected_by = get_current_user().id
        record.remarks      = data.get('remarks', '')

        # Auto status
        if record.amount_paid >= record.effective_due():
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

        today = date.today()
        txn = FeeTransaction(
            fee_record_id    = record.id,
            student_id       = record.student_id,
            school_id        = _school_id(),
            amount           = new_payment,
            payment_mode     = record.payment_mode,
            transaction_date = today,
            txn_month        = today.strftime('%B %Y'),
            receipt_no       = record.receipt_no,
            remarks          = data.get('remarks', ''),
            collected_by     = get_current_user().id,
        )
        db.session.add(txn)
        db.session.flush()

        if record.source == 'LIBRARY':
            from app.services.library_fee_service import sync_library_fine_from_fee_record
            sync_library_fine_from_fee_record(record, txn)
        elif record.source == 'HOSTEL_FINE':
            from app.services.hostel_fee_service import sync_hostel_fine_from_fee_record
            sync_hostel_fine_from_fee_record(record, txn)
        elif record.source in ('TRANSPORT', 'TRANSPORT_FINE'):
            from app.services.transport_fee_service import sync_transport_from_fee_record
            sync_transport_from_fee_record(record, txn)

        # ── Canonical Central Finance Ledger Sync ──
        try:
            from app.services.fee_ledger_service import collect_fee_payment
            central_pmt = collect_fee_payment(
                student_id=record.student_id,
                amount_paid=new_payment,
                payment_mode=record.payment_mode,
                collected_by=get_current_user(),
                department=record.source or 'ACCOUNTS',
                remarks=data.get('remarks', '') or f"Fee collected via Principal / Accounts Counter",
                session=getattr(record, 'session', '2026-27') or '2026-27',
                allocations=[]
            )
            if central_pmt:
                record.receipt_no = central_pmt.receipt_no
                txn.receipt_no = central_pmt.receipt_no
        except Exception as e:
            import traceback
            traceback.print_exc()

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
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# NEW — paste right after existing collect_fee() function



@principal_bp.route('/fees/collect-multiple', methods=['POST'])
@permission_required('fees.collect')
def collect_fee_multiple():
    """
    Body: { payments: [{record_id, amount}], payment_mode, remarks, mode: 'COMBINED'|'SEPARATE' }
    COMBINED → ek receipt_no, ek PDF sab records ke saath.
    SEPARATE → source ke hisaab se group karke (ACADEMIC alag, HOSTEL alag)
               har group ka apna receipt_no + apna PDF.
    """
    data     = request.get_json() or {}
    payments = data.get('payments') or []
    mode     = (data.get('mode') or 'COMBINED').upper()
    if not payments:
        return jsonify({'error': 'payments list zaroori hai'}), 400

    sid          = _school_id()
    payment_mode = data.get('payment_mode', 'CASH')
    remarks      = data.get('remarks', '')
    today        = date.today()

    # Records ko fetch karke source ke hisaab se group karo
    recs_with_amt = []
    student_id_check = None
    for p in payments:
        record = FeeRecord.query.get(p.get('record_id'))
        if not record or record.school_id != sid:
            continue
        if record.status == 'DRAFT':
            return jsonify({'error': f'Fee record #{record.id} abhi DRAFT hai'}), 400
        if student_id_check is None:
            student_id_check = record.student_id
        elif record.student_id != student_id_check:
            return jsonify({'error': 'Combined payment sirf ek student ke liye'}), 400
        try:
            amount = float(p.get('amount'))
        except (TypeError, ValueError):
            continue
        if amount > 0:
            recs_with_amt.append((record, amount))

    if not recs_with_amt:
        return jsonify({'error': 'Koi valid payment nahi mila'}), 400

    # ── Grouping strategy ──
    if mode == 'SEPARATE':
        groups = {}
        for record, amount in recs_with_amt:
            groups.setdefault(record.source or 'ACADEMIC', []).append((record, amount))
    else:
        groups = {'COMBINED': recs_with_amt}

    receipts = []
    for source_key, items in groups.items():
        while True:
            receipt_no = _gen_receipt()
            if not FeeTransaction.query.filter_by(receipt_no=receipt_no).first():
                break

        total = 0
        for record, amount in items:
            record.amount_paid  = (record.amount_paid or 0) + amount
            record.payment_mode = payment_mode
            record.paid_date    = today
            record.collected_by = get_current_user().id
            record.remarks      = remarks
            record.status       = 'PAID' if record.amount_paid >= record.effective_due() else 'PARTIAL'
            txn = FeeTransaction(
                fee_record_id=record.id, student_id=record.student_id, school_id=sid,
                amount=amount, payment_mode=payment_mode, transaction_date=today,
                txn_month=today.strftime('%B %Y'), receipt_no=receipt_no,
                remarks=remarks, collected_by=get_current_user().id,
            )
            db.session.add(txn)
            db.session.flush()

            if record.source == 'LIBRARY':
                from app.services.library_fee_service import sync_library_fine_from_fee_record
                sync_library_fine_from_fee_record(record, txn)
            elif record.source == 'HOSTEL_FINE':
                from app.services.hostel_fee_service import sync_hostel_fine_from_fee_record
                sync_hostel_fine_from_fee_record(record, txn)
            elif record.source in ('TRANSPORT', 'TRANSPORT_FINE'):
                from app.services.transport_fee_service import sync_transport_from_fee_record
                sync_transport_from_fee_record(record, txn)

            total += amount

        # ── Canonical Central Finance Ledger Sync ──
        try:
            from app.services.fee_ledger_service import collect_fee_payment
            central_pmt = collect_fee_payment(
                student_id=student_id_check,
                amount_paid=total,
                payment_mode=payment_mode,
                collected_by=get_current_user(),
                department=source_key if source_key != 'ALL' else 'ACCOUNTS',
                remarks=remarks or f"Multiple Fee Collection ({source_key})",
                session='2026-27',
                allocations=[]
            )
            if central_pmt:
                receipt_no = central_pmt.receipt_no
        except Exception as e:
            import traceback
            traceback.print_exc()

        db.session.add(FeeReceiptGroup(
            receipt_no=receipt_no, school_id=sid, student_id=student_id_check,
            mode=mode, sources=','.join({(r.source or 'ACADEMIC') for r, _ in items}),
            created_by=get_current_user().id,
        ))
        receipts.append({
            'receipt_no': receipt_no, 'source_group': source_key, 'total': total,
            'items': [{'fee_type': r.fee_type, 'amount': a} for r, a in items],
        })

    db.session.commit()
    student = Student.query.get(student_id_check)
    return jsonify({
        'student_id': student_id_check,
        'student_name': student.user.name if student and student.user else '',
        'mode': mode, 'receipts': receipts,
    }), 200

@principal_bp.route('/fees/notices/bulk', methods=['GET'])
@permission_required('fees.receipt.view')
def bulk_fee_notice_pdf():
    """
    GET /api/principal/fees/notices/bulk?class_id=1&month=2026-07
    Ek hi PDF — class ke saare students, roll-number order mein,
    har student ek page pe — consolidated dues (tuition+hostel+
    library+sports+exam sab uss student ke liye ek page pe).
    """
    sid      = _school_id()
    class_id = request.args.get('class_id')
    month    = request.args.get('month') or date.today().strftime('%Y-%m')
    if not class_id:
        return jsonify({'error': 'class_id zaroori hai'}), 400

    from app.models.school import School
    school   = School.query.get(sid)
    students = Student.query.filter_by(school_id=sid, class_id=class_id)\
                 .order_by(Student.roll_number).all()
    if not students:
        return jsonify({'error': 'Class mein koi student nahi'}), 404

    from app.utils.pdf_generator import generate_bulk_notice_pdf
    # generate_bulk_notice_pdf internally har student ke liye
    # FeeRecord.query.filter_by(student_id=s.id, month=month) sab
    # sources sahit fetch karta hai aur ek page render karta hai
    buf = generate_bulk_notice_pdf(students, school, month, FeeRecord, Attendance)

    cls = Class.query.get(class_id)
    label = f"{cls.name}-{cls.section}" if cls else class_id
    return send_file(buf, mimetype='application/pdf', as_attachment=True,
                      download_name=f'FeeNotices_{label}_{month}.pdf')


@principal_bp.route('/fees/collection-report/pdf', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN', 'TEACHER')
def fee_collection_report_pdf():
    """
    Generates and downloads or streams a Fee Collection Report PDF.
    Filters supported: month (YYYY-MM), session (e.g. 2024-25), class_id, fee_type, status.
    """
    sid = _school_id()
    month = request.args.get('month')
    session_param = request.args.get('session')
    class_id = request.args.get('class_id')
    fee_type = request.args.get('fee_type')
    status = request.args.get('status')

    from app.models.school import School
    from app.utils.pdf_generator import generate_fee_collection_report_pdf

    school = School.query.get(sid)
    q = FeeRecord.query.filter(FeeRecord.school_id == sid, FeeRecord.status != 'DRAFT')

    if month:
        # Match 'YYYY-MM' or 'Month YYYY'
        try:
            y, m = map(int, month.split('-'))
            month_name = date(y, m, 1).strftime('%B %Y')
            q = q.filter(db.or_(FeeRecord.month == month, FeeRecord.month == month_name))
        except Exception:
            q = q.filter(FeeRecord.month == month)

    if session_param:
        q = q.filter(FeeRecord.session == session_param)
    if class_id:
        q = q.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == class_id)
    if fee_type:
        q = q.filter(FeeRecord.fee_type == fee_type)
    if status and status != 'ALL':
        q = q.filter(FeeRecord.status == status)

    records = q.order_by(FeeRecord.paid_date.desc(), FeeRecord.id.desc()).all()

    total_billed = sum(r.effective_due() for r in records)
    total_paid = sum(r.amount_paid or 0 for r in records)
    total_pending = max(0.0, total_billed - total_paid)

    summary = {
        'total_billed': total_billed,
        'total_collected': total_paid,
        'total_pending': total_pending,
    }

    formatted_records = []
    for r in records:
        st = Student.query.get(r.student_id) if r.student_id else None
        cls = Class.query.get(st.class_id) if (st and st.class_id) else None
        cls_name = f"{cls.name}{' - ' + cls.section if cls.section else ''}" if cls else '—'
        st_name = st.user.name if (st and st.user) else 'Student'
        p_date = r.paid_date.strftime('%d-%m-%Y') if r.paid_date else (r.created_at.strftime('%d-%m-%Y') if getattr(r, 'created_at', None) else '—')

        formatted_records.append({
            'receipt_no': r.receipt_no or f"REC/{r.id:04d}",
            'student_name': st_name,
            'class_name': cls_name,
            'fee_type': r.fee_type or 'General Fee',
            'payment_mode': r.payment_mode or 'CASH',
            'paid_date': p_date,
            'amount': float(r.amount_paid or 0),
        })

    title = "Fee Collection & Revenue Report"
    subtitle_parts = []
    if month:
        subtitle_parts.append(f"Month: {month}")
    if session_param:
        subtitle_parts.append(f"Session: {session_param}")
    if fee_type:
        subtitle_parts.append(f"Category: {fee_type}")
    if not subtitle_parts:
        subtitle_parts.append(f"Generated on {date.today().strftime('%d %B %Y')}")

    subtitle = " | ".join(subtitle_parts)

    buf = generate_fee_collection_report_pdf(
        school=school,
        summary=summary,
        transactions_or_records=formatted_records,
        report_title=title,
        subtitle=subtitle
    )

    filename = f"Fee_Collection_Report_{month or session_param or 'All'}.pdf"
    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name=filename)

# NEW
@principal_bp.route('/fees/generate', methods=['POST'])
@permission_required('fees.structure.manage')
def generate_fees():
    """
    Body: {
        class_id, fee_type, month,          -- month format: "2026-07"
        window_start,                        -- OPTIONAL "2026-06-25" — kab se collection start
        window_end                           -- OPTIONAL "2026-07-01" — kab tak due (parents ko yahi dikhega)
    }
    Amount ab manual nahi — FeeStructure (class + fee_type) se resolve hota hai.
    Records DRAFT status mein bante hain — Principal review karke /fees/batches/<id>/publish
    karega tabhi parent portal / late-fine clock activate hoga.

    Due date priority:
      1. window_end diya hai   → wahi due_date banega (real-world: "1 July tak pay karo")
      2. window_end nahi diya  → FeeStructure.due_date_day se fallback (purana behaviour)

    Same class+fee_type+month ke liye dobara generate karne pe 409 (already_generated).
    """
    data     = request.get_json() or {}
    sid      = _school_id()
    class_id = data.get('class_id')
    fee_type = (data.get('fee_type') or '').strip().upper()
    month    = data.get('month')
    window_start_raw = data.get('window_start')   # "2026-06-25"
    window_end_raw   = data.get('window_end')     # "2026-07-01"

    if not class_id or not fee_type or not month:
        return jsonify({'error': 'class_id, fee_type, month zaroori hai'}), 400

    fs = FeeStructure.query.filter_by(
        school_id=sid, class_id=class_id, fee_type=fee_type, status='ACTIVE'
    ).first()
    if not fs:
        return jsonify({
            'error': 'no_fee_structure',
            'message': f'Is class ke liye {fee_type} ki fee structure define nahi hai. Pehle Fee Structures page se banao.',
        }), 400

    # ── No Duplicate Fees ──
    existing_batch = FeeGenerationBatch.query.filter_by(
        school_id=sid, class_id=class_id, fee_type=fee_type, month=month
    ).filter(FeeGenerationBatch.status != 'CANCELLED').first()
    if existing_batch:
        return jsonify({
            'error':   'already_generated',
            'message': f'{month} ke liye is class/{fee_type} ki fees already generate ho chuki hain (batch status: {existing_batch.status})',
            'batch_id': existing_batch.id,
        }), 409

    # ── NEW: window_start / window_end parse + validate ──
    window_start = window_end = None
    if window_start_raw:
        try:
            window_start = date.fromisoformat(window_start_raw)
        except (ValueError, TypeError):
            return jsonify({'error': 'window_start format "YYYY-MM-DD" jaisa hona chahiye'}), 400
    if window_end_raw:
        try:
            window_end = date.fromisoformat(window_end_raw)
        except (ValueError, TypeError):
            return jsonify({'error': 'window_end format "YYYY-MM-DD" jaisa hona chahiye'}), 400
    if window_start and window_end and window_start > window_end:
        return jsonify({'error': 'window_start, window_end se pehle honi chahiye'}), 400

    # ── Due date: window_end mile to wahi due_date, warna structure ka default ──
    if window_end:
        due_date = window_end
    else:
        try:
            y, m = map(int, month.split('-'))
            due_date = date(y, m, min(fs.due_date_day or 10, 28))
        except (ValueError, TypeError):
            return jsonify({'error': 'month format "YYYY-MM" jaisa hona chahiye'}), 400

    batch = FeeGenerationBatch(
        school_id=sid, class_id=class_id, fee_type=fee_type, month=month,
        session=fs.session, status='DRAFT', generated_by=get_current_user().id,
        window_start=window_start,   # NEW — batch pe store, notice PDF isse "collection kab se" dikhayega
        window_end=window_end,       # NEW — batch pe store, notice PDF isse "last date" dikhayega
    )
    db.session.add(batch)
    db.session.flush()

    students = Student.query.filter_by(school_id=sid, class_id=class_id).all()
    created = skipped = 0

    for s in students:
        # Extra safety — kisi wajah se already koi record ho (manual/legacy)
        exists = FeeRecord.query.filter_by(student_id=s.id, month=month, fee_type=fee_type).first()
        if exists:
            skipped += 1
            continue

        rec = FeeRecord(
            school_id=sid, student_id=s.id, fee_type=fee_type, month=month,
            amount_due=fs.amount, amount_paid=0, status='DRAFT',
            due_date=due_date, session=fs.session, batch_id=batch.id,
        )
        db.session.add(rec)
        created += 1

    batch.generated_count = created
    batch.skipped_count   = skipped
    db.session.commit()

    return jsonify({
        'message':      f'{created} fee records DRAFT mein generate hue — review karke publish karo',
        'batch_id':     batch.id,
        'created':      created,
        'skipped':      skipped,
        'status':       'DRAFT',
        'due_date':     str(due_date),                                   # NEW — frontend confirm kar sake
        'window_start': str(window_start) if window_start else None,     # NEW
        'window_end':   str(window_end)   if window_end   else None,     # NEW
    }), 201

# NEW

@principal_bp.route('/fees/batches', methods=['GET'])
@permission_required('fees.reports.view')
def list_fee_batches():
    sid    = _school_id()
    status = request.args.get('status')  # DRAFT / PUBLISHED / CANCELLED
    q = FeeGenerationBatch.query.filter_by(school_id=sid)
    if status:
        q = q.filter_by(status=status)
    batches = q.order_by(FeeGenerationBatch.generated_at.desc()).limit(100).all()
    result = []
    for b in batches:
        d = b.to_dict()
        cls = Class.query.get(b.class_id) if b.class_id else None
        d['class_name'] = f"{cls.name} - {cls.section}" if cls else 'All Classes'
        result.append(d)
    return jsonify(result), 200


@principal_bp.route('/fees/batches/<int:batch_id>/records', methods=['GET'])
@permission_required('fees.structure.manage')
def list_batch_records(batch_id):
    """Review screen — publish se pehle admin sab records dekh/edit kare."""
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    records = FeeRecord.query.filter_by(batch_id=batch.id).all()
    result = []
    for r in records:
        d = r.to_dict()
        student = Student.query.get(r.student_id)
        d['student_name'] = student.user.name if student and student.user else ''
        d['roll_number']  = student.roll_number if student else ''
        result.append(d)
    return jsonify({'batch': batch.to_dict(), 'records': result}), 200
# NEW — paste right after list_batch_records()

@principal_bp.route('/fees/batches/<int:batch_id>/missing-students', methods=['GET'])
@permission_required('fees.structure.manage')
def batch_missing_students(batch_id):
    """Class ke wo students jo abhi is batch mein include nahi hain (naya admission/transfer)."""
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if not batch.class_id:
        return jsonify([]), 200

    included_ids = {r.student_id for r in FeeRecord.query.filter_by(batch_id=batch.id).all()}
    students = Student.query.filter_by(school_id=batch.school_id, class_id=batch.class_id).all()
    missing  = [s for s in students if s.id not in included_ids]

    return jsonify([{
        'id': s.id, 'name': s.user.name if s.user else '',
        'roll_number': s.roll_number or '',
    } for s in missing]), 200


@principal_bp.route('/fees/batches/<int:batch_id>/add-student', methods=['POST'])
@permission_required('fees.structure.manage')
def batch_add_student(batch_id):
    """Missed student ko draft batch mein add karo — FeeStructure se hi amount resolve hota hai."""
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if batch.status != 'DRAFT':
        return jsonify({'error': 'Sirf DRAFT batch mein student add ho sakta hai'}), 400

    data = request.get_json() or {}
    student_id = data.get('student_id')
    student = Student.query.get_or_404(student_id)
    if student.school_id != batch.school_id:
        return jsonify({'error': 'Unauthorized'}), 403

    exists = FeeRecord.query.filter_by(
        student_id=student.id, month=batch.month, fee_type=batch.fee_type
    ).first()
    if exists:
        return jsonify({'error': 'Is student ka record already exist karta hai'}), 409

    fs = FeeStructure.query.filter_by(
        school_id=batch.school_id, class_id=batch.class_id,
        fee_type=batch.fee_type, status='ACTIVE'
    ).first()
    if not fs:
        return jsonify({'error': 'Fee structure nahi mili is class/fee-type ke liye'}), 400

    try:
        y, m = map(int, batch.month.split('-'))
        due_date = date(y, m, min(fs.due_date_day or 10, 28))
    except (ValueError, TypeError):
        due_date = None

    rec = FeeRecord(
        school_id=batch.school_id, student_id=student.id, fee_type=batch.fee_type,
        month=batch.month, amount_due=fs.amount, amount_paid=0, status='DRAFT',
        due_date=due_date, session=batch.session, batch_id=batch.id,
    )
    db.session.add(rec)
    batch.generated_count = (batch.generated_count or 0) + 1
    db.session.commit()

    d = rec.to_dict()
    d['student_name'] = student.user.name if student.user else ''
    d['roll_number']  = student.roll_number or ''
    return jsonify(d), 201

@principal_bp.route('/fees/batches/<int:batch_id>/publish', methods=['POST'])
@permission_required('fees.structure.manage')
def publish_fee_batch(batch_id):
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if batch.status != 'DRAFT':
        return jsonify({'error': f'Batch already {batch.status}'}), 400

    FeeRecord.query.filter_by(batch_id=batch.id, status='DRAFT')\
        .update({'status': 'PENDING'})

    batch.status       = 'PUBLISHED'
    batch.published_by = get_current_user().id
    batch.published_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Batch published — ab parents ko dikhega', 'batch': batch.to_dict()}), 200


@principal_bp.route('/fees/batches/<int:batch_id>', methods=['DELETE'])
@permission_required('fees.structure.manage')
def delete_fee_batch(batch_id):
    """Sirf DRAFT batch delete ho sakti hai — Published records audit trail ke liye protected hain."""
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if batch.status != 'DRAFT':
        return jsonify({'error': 'Sirf DRAFT batch delete ho sakti hai'}), 400

    FeeRecord.query.filter_by(batch_id=batch.id).delete()
    db.session.delete(batch)
    db.session.commit()
    return jsonify({'message': 'Draft batch deleted'}), 200


@principal_bp.route('/fees/records/<int:record_id>', methods=['PATCH'])
@permission_required('fees.structure.manage')
def update_fee_record(record_id):
    """DRAFT record ka amount/due_date edit karo — publish ke baad edit yahan se allowed nahi."""
    rec = FeeRecord.query.get_or_404(record_id)
    if rec.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if rec.status != 'DRAFT':
        return jsonify({'error': 'Sirf DRAFT record edit ho sakta hai'}), 400
    data = request.get_json() or {}
    if 'amount_due' in data:
        rec.amount_due = float(data['amount_due'])
    if 'due_date' in data:
        rec.due_date = date.fromisoformat(data['due_date'])
    if 'remarks' in data:
        rec.remarks = data['remarks']
    db.session.commit()
    return jsonify(rec.to_dict()), 200

# NEW — paste right after update_fee_record()

@principal_bp.route('/fees/records/<int:record_id>/adjust', methods=['POST'])
@permission_required('fees.discount.apply')
def adjust_fee_record(record_id):
    """
    Fine (extra charge) ya Discount/Waiver (maafi) lagao — reason ke saath.
    DRAFT aur PUBLISHED (PENDING/PARTIAL/OVERDUE) dono pe kaam karta hai.
    amount_due kabhi mutate nahi hota — original preserve rehta hai, sirf
    fine/discount layer upar chadhti hai. Audit trail: adjusted_by/adjusted_at.

    Body: { type: 'FINE' | 'DISCOUNT', amount, reason }
    """
    rec = FeeRecord.query.get_or_404(record_id)
    if rec.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if rec.status in ('CANCELLED', 'REFUNDED'):
        return jsonify({'error': f'{rec.status} record pe adjustment nahi lag sakta'}), 400

    data = request.get_json() or {}
    adj_type = (data.get('type') or '').strip().upper()
    reason   = (data.get('reason') or '').strip()

    if adj_type not in ('FINE', 'DISCOUNT'):
        return jsonify({'error': "type 'FINE' ya 'DISCOUNT' hona chahiye"}), 400
    if not reason:
        return jsonify({'error': 'reason zaroori hai — audit trail ke liye'}), 400
    try:
        amount = float(data.get('amount'))
    except (TypeError, ValueError):
        return jsonify({'error': 'amount number honi chahiye'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount 0 se zyada honi chahiye'}), 400

    if adj_type == 'FINE':
        rec.fine   = (rec.fine or 0) + amount
        rec.fine_reason = reason
    else:  # DISCOUNT
        rec.discount = (rec.discount or 0) + amount
        rec.discount_reason = reason

    rec.adjusted_by = get_current_user().id
    rec.adjusted_at = datetime.utcnow()

    # Status recompute — DRAFT record DRAFT hi rahega (publish se pehle),
    # baaki records ka status effective_due ke against refresh ho
    if rec.status != 'DRAFT':
        if rec.amount_paid >= rec.effective_due():
            rec.status = 'PAID'
        elif rec.amount_paid > 0:
            rec.status = 'PARTIAL'
        elif rec.status == 'PAID':   # discount se ab underpaid ho gaya
            rec.status = 'PENDING'

    db.session.commit()
    return jsonify(rec.to_dict()), 200

@principal_bp.route('/fees/adjustments', methods=['GET'])
@permission_required('fees.reports.view')
def list_fee_adjustments():
    """
    Saare fine/discount lagaye records — ek jagah, filterable.
    Query: class_id, month (YYYY-MM), type (FINE|DISCOUNT|ALL, default ALL)
    """
    sid      = _school_id()
    class_id = request.args.get('class_id')
    month    = request.args.get('month')
    adj_type = request.args.get('type', 'ALL')

    q = FeeRecord.query.filter_by(school_id=sid)
    if adj_type == 'FINE':
        q = q.filter(FeeRecord.fine > 0)
    elif adj_type == 'DISCOUNT':
        q = q.filter(FeeRecord.discount > 0)
    else:
        q = q.filter(db.or_(FeeRecord.fine > 0, FeeRecord.discount > 0))
    if month:
        q = q.filter(FeeRecord.month == month)
    if class_id:
        q = q.join(Student, FeeRecord.student_id == Student.id).filter(Student.class_id == class_id)

    records = q.order_by(FeeRecord.adjusted_at.desc()).limit(300).all()
    result = []
    for r in records:
        student = Student.query.get(r.student_id)
        cls = Class.query.get(student.class_id) if student and student.class_id else None
        d = r.to_dict()
        d['student_name'] = student.user.name if student and student.user else ''
        d['roll_number']  = student.roll_number if student else ''
        d['class_name']   = f"{cls.name} - {cls.section}" if cls else ''
        result.append(d)
    return jsonify(result), 200
@principal_bp.route('/fees/records/<int:record_id>/adjust/<string:field>', methods=['DELETE'])
@permission_required('fees.discount.apply')
def remove_fee_adjustment(record_id, field):
    """Fine ya discount galti se lag gaya ho toh remove karo. field = 'fine' | 'discount'"""
    rec = FeeRecord.query.get_or_404(record_id)
    if rec.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if field not in ('fine', 'discount'):
        return jsonify({'error': "field 'fine' ya 'discount' hona chahiye"}), 400

    setattr(rec, field, 0)
    setattr(rec, f'{field}_reason', None)
    rec.adjusted_by = get_current_user().id
    rec.adjusted_at = datetime.utcnow()
    db.session.commit()
    return jsonify(rec.to_dict()), 200


@principal_bp.route('/fees/records/<int:record_id>', methods=['DELETE'])
@permission_required('fees.structure.manage')
def delete_fee_record(record_id):
    """Sirf DRAFT record individually delete ho sakta hai."""
    rec = FeeRecord.query.get_or_404(record_id)
    if rec.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if rec.status != 'DRAFT':
        return jsonify({'error': 'Published fee record delete nahi ho sakta — /cancel route use karo'}), 400
    if rec.batch_id:
        batch = FeeGenerationBatch.query.get(rec.batch_id)
        if batch:
            batch.generated_count = max(0, (batch.generated_count or 1) - 1)
    db.session.delete(rec)
    db.session.commit()
    return jsonify({'message': 'Draft fee record deleted'}), 200
# NEW — paste in Fees section, kahin bhi

@principal_bp.route('/fees/student-search', methods=['GET'])
@permission_required('fees.receipt.view')
def fees_student_search():
    """
    Adjustment panel ka student picker — class + naam/roll se search.
    Query: class_id (optional), q (search text, optional)
    """
    sid      = _school_id()
    class_id = request.args.get('class_id')
    q        = (request.args.get('q') or '').strip()

    query = Student.query.filter_by(school_id=sid)
    if class_id:
        query = query.filter_by(class_id=class_id)
    if q:
        query = query.join(User, Student.user_id == User.id).filter(db.or_(
            User.name.ilike(f'%{q}%'),
            Student.roll_number.ilike(f'%{q}%'),
            Student.admission_no.ilike(f'%{q}%'),
        ))

    students = query.limit(30).all()
    result = []
    for s in students:
        cls = Class.query.get(s.class_id) if s.class_id else None
        result.append({
            'id':           s.id,
            'name':         s.user.name if s.user else '',
            'roll_number':  s.roll_number or '',
            'admission_no': s.admission_no or '',
            'class_name':   f"{cls.name} - {cls.section}" if cls else '',
        })
    return jsonify(result), 200


@principal_bp.route('/fees/student-records/<int:student_id>', methods=['GET'])
@permission_required('fees.receipt.view')
def fees_student_records(student_id):
    """
    Student select hone ke baad uske saare fee records — DRAFT + PUBLISHED
    dono, taaki adjustment (fine/waiver) kisi bhi record pe lag sake.
    CANCELLED/REFUNDED bhi dikhte hain (read-only, history ke liye).
    """
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    cls = Class.query.get(student.class_id) if student.class_id else None
    records = FeeRecord.query.filter_by(student_id=student_id)\
                .order_by(FeeRecord.created_at.desc()).all()

    return jsonify({
        'student': {
            'id':          student.id,
            'name':        student.user.name if student.user else '',
            'roll_number': student.roll_number or '',
            'class_name':  f"{cls.name} - {cls.section}" if cls else '',
        },
        'records': [r.to_dict() for r in records],
    }), 200

@principal_bp.route('/fees/records/<int:record_id>/cancel', methods=['POST'])
@permission_required('fees.structure.manage')
def cancel_fee_record(record_id):
    """Published record cancel karo (delete nahi — audit trail preserve rehta hai)."""
    rec = FeeRecord.query.get_or_404(record_id)
    if rec.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if rec.amount_paid > 0:
        return jsonify({'error': 'Payment ho chuki hai — Cancel nahi, Refund process karo'}), 400
    rec.status = 'CANCELLED'
    db.session.commit()
    return jsonify(rec.to_dict()), 200

@principal_bp.route('/fees/monthly-trend', methods=['GET'])
@permission_required('fees.reports.view')
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
@permission_required('fees.reports.view')
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

# NEW — Class-wise Fee Structure CRUD (mirrors HostelFeeStructure pattern)

# principal.py — list_fee_structures() ko replace karo isse

@principal_bp.route('/fee-structures', methods=['GET'])
@permission_required('fees.structure.manage')
def list_fee_structures():
    """
    Unified view — Academic (is table se, editable) + Hostel/Library
    (unke apne module se, read-only reference) — sab ek jagah dikhte hain
    taaki principal ko pata rahe 'total kitni fee categories active hain'.
    """
    sid      = _school_id()
    source   = request.args.get('source', 'ACADEMIC')  # ACADEMIC / HOSTEL / LIBRARY
    class_id = request.args.get('class_id')

    if source == 'HOSTEL':
        from app.models.hostel import HostelFeeStructure
        q = HostelFeeStructure.query.filter_by(school_id=sid, status='ACTIVE')
        return jsonify({
            'editable': False,
            'manage_url': '/hostel/fee-structures',
            'items': [h.to_dict() for h in q.all()],
        }), 200

    if source == 'LIBRARY':
        # Agar LibraryFeeStructure model hai to waisa hi pattern —
        # abhi placeholder, jab library fines/membership fee model banega
        return jsonify({'editable': False, 'manage_url': '/library/settings', 'items': []}), 200

    # ── ACADEMIC (default) — editable, existing behaviour ──
    q = FeeStructure.query.filter_by(school_id=sid, source='ACADEMIC')
    if class_id:
        q = q.filter_by(class_id=class_id)
    result = []
    for fs in q.order_by(FeeStructure.class_id).all():
        d = fs.to_dict()
        cls = Class.query.get(fs.class_id) if fs.class_id else None
        d['class_name'] = f"{cls.name} - {cls.section}" if cls else (
            'One-Time (All Classes)' if fs.frequency == 'ONE_TIME' else 'All Classes'
        )
        result.append(d)
    return jsonify({'editable': True, 'items': result}), 200


@principal_bp.route('/fee-structures', methods=['POST'])
@permission_required('fees.structure.manage')
def create_fee_structure():
    data     = request.get_json() or {}
    sid      = _school_id()
    fee_type = (data.get('fee_type') or '').strip().upper()
    class_id = data.get('class_id') or None

    if not fee_type or data.get('amount') is None:
        return jsonify({'error': 'fee_type aur amount zaroori hai'}), 400
    try:
        amount = float(data['amount'])
    except (TypeError, ValueError):
        return jsonify({'error': 'amount number honi chahiye'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount 0 se zyada honi chahiye'}), 400

    existing = FeeStructure.query.filter_by(
        school_id=sid, class_id=class_id, fee_type=fee_type
    ).first()
    if existing:
        return jsonify({'error': f'Is class ke liye {fee_type} structure already bana hai — usko edit karo'}), 409

    fs = FeeStructure(
        school_id=sid, class_id=class_id, fee_type=fee_type, amount=amount,
        frequency=data.get('frequency', 'MONTHLY'),
        due_date_day=int(data.get('due_date_day', 10)),
        session=data.get('session', '2024-25'),
        status='ACTIVE', created_by=get_current_user().id,
    )
    db.session.add(fs)
    db.session.commit()
    return jsonify(fs.to_dict()), 201


@principal_bp.route('/fee-structures/<int:fs_id>', methods=['PATCH'])
@permission_required('fees.structure.manage')
def update_fee_structure(fs_id):
    fs = FeeStructure.query.get_or_404(fs_id)
    if fs.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    if 'amount' in data:
        fs.amount = float(data['amount'])
    if 'frequency' in data:
        fs.frequency = data['frequency']
    if 'due_date_day' in data:
        fs.due_date_day = int(data['due_date_day'])
    if 'status' in data:
        fs.status = data['status']
    db.session.commit()
    return jsonify(fs.to_dict()), 200


@principal_bp.route('/fee-structures/<int:fs_id>', methods=['DELETE'])
@permission_required('fees.structure.manage')
def delete_fee_structure(fs_id):
    fs = FeeStructure.query.get_or_404(fs_id)
    if fs.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    in_use = FeeGenerationBatch.query.filter_by(
        school_id=fs.school_id, class_id=fs.class_id, fee_type=fs.fee_type
    ).count()
    if in_use:
        return jsonify({'error': 'Is structure se fees already generate ho chuki hain — history preserve karne ke liye pehle INACTIVE karo, delete mat karo'}), 400
    db.session.delete(fs)
    db.session.commit()
    return jsonify({'message': 'Fee structure deleted'}), 200


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
@principal_bp.route('/fees/batches/<int:batch_id>/bulk-adjust', methods=['POST'])
@permission_required('fees.discount.apply')
def batch_bulk_adjust(batch_id):
    """
    Publish se PEHLE, poori batch (ya select student_ids) pe ek sath
    discount/fine — 'sab scholarship students ko 20% off' jaisa case.
    Body: { student_ids: [...] (empty = sab), type: FINE|DISCOUNT, amount, reason, is_percent }
    """
    batch = FeeGenerationBatch.query.get_or_404(batch_id)
    if batch.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if batch.status != 'DRAFT':
        return jsonify({'error': 'Sirf DRAFT batch pe bulk adjustment ho sakta hai'}), 400

    data = request.get_json() or {}
    adj_type    = (data.get('type') or '').upper()
    reason      = (data.get('reason') or '').strip()
    is_percent  = bool(data.get('is_percent'))
    student_ids = data.get('student_ids') or []

    if adj_type not in ('FINE', 'DISCOUNT') or not reason:
        return jsonify({'error': "type aur reason zaroori hai"}), 400

    q = FeeRecord.query.filter_by(batch_id=batch.id)
    if student_ids:
        q = q.filter(FeeRecord.student_id.in_(student_ids))

    updated = 0
    for rec in q.all():
        amount = round(rec.amount_due * float(data['amount']) / 100, 2) if is_percent else float(data['amount'])
        if adj_type == 'FINE':
            rec.fine, rec.fine_reason = (rec.fine or 0) + amount, reason
        else:
            rec.discount, rec.discount_reason = (rec.discount or 0) + amount, reason
        rec.adjusted_by, rec.adjusted_at = get_current_user().id, datetime.utcnow()
        updated += 1

    db.session.commit()
    return jsonify({'message': f'{updated} records adjust hue', 'updated': updated}), 200

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

@principal_bp.route('/exams', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR', 'ACCOUNTANT'],
    permissions=['exams.schedule.manage']
)
def list_exams():
    status = request.args.get('status')  # DRAFT / PUBLISHED / ARCHIVED / etc.
    session_filter = request.args.get('session')
    curr = get_current_user()
    sid = curr.school_id if curr else _school_id()
    q = ExamSchedule.query.filter_by(school_id=sid)
    if curr and getattr(curr.role, 'value', str(curr.role)) in ('STUDENT', 'PARENT') and not status:
        q = q.filter((ExamSchedule.status == 'PUBLISHED') | (ExamSchedule.is_published == True))
    elif status:
        q = q.filter_by(status=status)
    if session_filter:
        q = q.filter_by(session=session_filter)
    exams = q.order_by(ExamSchedule.created_at.desc()).all()
    result = []
    for e in exams:
        d = e.to_dict()
        d['timetable_count'] = e.timetable.count()
        # Participating classes from ExamClass or fallback to Timetable
        p_classes = e.participating_classes.all()
        if p_classes:
            d['classes'] = [pc.to_dict() for pc in p_classes]
            d['class_ids'] = [pc.class_id for pc in p_classes]
        else:
            class_ids = list({t.class_id for t in e.timetable.all()})
            classes = Class.query.filter(Class.id.in_(class_ids)).all() if class_ids else []
            d['classes'] = [{'id': c.id, 'name': c.name, 'section': c.section, 'class_id': c.id, 'class_name': c.name} for c in classes]
            d['class_ids'] = class_ids
        
        d['subject_count'] = e.subjects_config.count()
        result.append(d)
    return jsonify(result), 200


@principal_bp.route('/exams/<int:exam_id>', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR'],
    permissions=['exams.schedule.manage']
)
def get_exam_detail(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    curr = get_current_user()
    if not getattr(curr, 'is_super', False) and curr.school_id and exam.school_id != curr.school_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    d = exam.to_dict()
    d['timetable'] = [t.to_dict() for t in exam.timetable.order_by(ExamTimetable.exam_date.asc()).all()]
    d['participating_classes'] = [pc.to_dict() for pc in exam.participating_classes.all()]
    d['subjects_config'] = [sc.to_dict() for sc in exam.subjects_config.all()]
    return jsonify(d), 200


@principal_bp.route('/exams', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def create_exam():
    data = request.get_json() or {}
    sid = _school_id()
    if not data.get('exam_name') or not data.get('start_date') or not data.get('end_date'):
        return jsonify({'error': 'Exam Name, Start Date, and End Date are required'}), 400

    try:
        start_d = date.fromisoformat(str(data['start_date']).split('T')[0])
        end_d = date.fromisoformat(str(data['end_date']).split('T')[0])
    except Exception:
        return jsonify({'error': 'Invalid start_date or end_date format (YYYY-MM-DD)'}), 400

    if end_d < start_d:
        return jsonify({'error': 'End date cannot be earlier than start date'}), 400

    exam = ExamSchedule(
        school_id             = sid,
        exam_name             = data['exam_name'].strip(),
        exam_type             = data.get('exam_type', 'MID_TERM'),
        session               = data.get('session', '2024-25'),
        academic_year         = data.get('academic_year') or (data.get('session', '2024-25').split('-')[0]),
        start_date            = start_d,
        end_date              = end_d,
        description           = data.get('description', ''),
        instructions          = data.get('instructions', ''),
        result_published_date = date.fromisoformat(str(data['result_published_date']).split('T')[0]) if data.get('result_published_date') else None,
        grading_system        = data.get('grading_system', 'STANDARD'),
        status                = 'DRAFT',
        is_published          = False,
        created_by            = get_current_user().id
    )
    db.session.add(exam)
    db.session.flush()

    # Link participating classes if provided
    class_ids = data.get('class_ids', [])
    for cid in class_ids:
        cls = Class.query.get(cid)
        if cls and cls.school_id == sid:
            db.session.add(ExamClass(school_id=sid, exam_id=exam.id, class_id=cid))

    # Log audit
    from app.services.audit_service import log_action
    try:
        log_action('exam', 'management', 'CREATE', user=get_current_user(), new_value=exam.to_dict(), remarks=f"Created Exam {exam.exam_name}")
    except Exception:
        pass

    db.session.commit()
    return jsonify(exam.to_dict()), 201


@principal_bp.route('/exams/<int:exam_id>', methods=['PATCH', 'PUT'])
@role_required('PRINCIPAL', 'TEACHER')
def update_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()

    # If exam is already published, require reason for modification
    if exam.status == 'PUBLISHED' and not reason:
        return jsonify({'error': 'Reason is required when modifying an already published exam.'}), 400

    old_val = exam.to_dict()

    if data.get('exam_name'):     exam.exam_name     = data['exam_name'].strip()
    if data.get('exam_type'):     exam.exam_type     = data['exam_type']
    if data.get('session'):       exam.session       = data['session']
    if data.get('academic_year'): exam.academic_year = data['academic_year']
    if data.get('grading_system'):exam.grading_system= data['grading_system']
    if data.get('description') is not None:
        exam.description = data['description']
    if data.get('instructions') is not None:
        exam.instructions = data['instructions']
    if data.get('result_published_date'):
        try:
            exam.result_published_date = date.fromisoformat(str(data['result_published_date']).split('T')[0])
        except Exception:
            pass

    if data.get('start_date'):
        exam.start_date = date.fromisoformat(str(data['start_date']).split('T')[0])
    if data.get('end_date'):
        exam.end_date = date.fromisoformat(str(data['end_date']).split('T')[0])

    if exam.start_date and exam.end_date and exam.end_date < exam.start_date:
        return jsonify({'error': 'End date cannot be earlier than start date'}), 400

    # Update participating classes if supplied
    if 'class_ids' in data:
        class_ids = data['class_ids'] or []
        ExamClass.query.filter_by(exam_id=exam.id).delete()
        for cid in class_ids:
            cls = Class.query.get(cid)
            if cls and cls.school_id == sid:
                db.session.add(ExamClass(school_id=sid, exam_id=exam.id, class_id=cid))

    # Log audit
    from app.services.audit_service import log_action
    try:
        log_action('exam', 'management', 'UPDATE', user=get_current_user(),
                   old_value=old_val, new_value=exam.to_dict(),
                   remarks=reason or f"Updated exam {exam.exam_name}")
    except Exception:
        pass

    db.session.commit()
    return jsonify(exam.to_dict()), 200


@principal_bp.route('/exams/<int:exam_id>/classes', methods=['GET', 'POST'])
@role_required('PRINCIPAL', 'TEACHER')
def manage_exam_classes(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    if request.method == 'GET':
        classes = exam.participating_classes.all()
        return jsonify([c.to_dict() for c in classes]), 200

    data = request.get_json() or {}
    class_ids = data.get('class_ids', [])
    ExamClass.query.filter_by(exam_id=exam.id).delete()
    for cid in class_ids:
        cls = Class.query.get(cid)
        if cls and cls.school_id == sid:
            db.session.add(ExamClass(school_id=sid, exam_id=exam.id, class_id=cid))
    db.session.commit()
    return jsonify({'message': 'Participating classes updated', 'classes': [c.to_dict() for c in exam.participating_classes.all()]}), 200


@principal_bp.route('/exams/<int:exam_id>/subjects', methods=['GET', 'POST'])
@role_required('PRINCIPAL', 'TEACHER')
def manage_exam_subjects(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    class_id = request.args.get('class_id', type=int)

    if request.method == 'GET':
        q = ExamSubject.query.filter_by(exam_id=exam.id)
        if class_id:
            q = q.filter_by(class_id=class_id)
        return jsonify([s.to_dict() for s in q.all()]), 200

    data = request.get_json() or {}
    configs = data.get('subjects', [])
    for cfg in configs:
        cid = cfg.get('class_id')
        sub_id = cfg.get('subject_id')
        if not cid or not sub_id:
            continue
        row = ExamSubject.query.filter_by(exam_id=exam.id, class_id=cid, subject_id=sub_id).first()
        if not row:
            row = ExamSubject(school_id=sid, exam_id=exam.id, class_id=cid, subject_id=sub_id)
            db.session.add(row)
        
        row.max_marks             = float(cfg.get('max_marks', 100))
        row.pass_marks            = float(cfg.get('pass_marks', 33))
        row.theory_marks          = float(cfg.get('theory_marks', 80))
        row.practical_marks       = float(cfg.get('practical_marks', 20))
        row.internal_marks        = float(cfg.get('internal_marks', 0))
        row.weightage             = float(cfg.get('weightage', 100))
        row.grade_scheme          = cfg.get('grade_scheme', 'STANDARD')
        row.is_included_in_result = bool(cfg.get('is_included_in_result', True))
        row.subject_code          = cfg.get('subject_code', '')

    db.session.commit()
    return jsonify({'message': 'Exam subjects configuration saved'}), 200


@principal_bp.route('/exams/<int:exam_id>/validate', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def validate_exam(exam_id):
    """
    Step 6 — Pre-publish Exam Validation.
    Comprehensive validation engine checking all prerequisites before allowing publish.
    """
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    blockers = []
    warnings = []

    # 1. Exam basic info checks
    if not exam.exam_name or len(exam.exam_name.strip()) < 2:
        blockers.append("Exam Name is missing or too short.")
    if not exam.session:
        blockers.append("Academic session is not defined.")
    if not exam.start_date or not exam.end_date:
        blockers.append("Exam start and end dates must be configured.")
    elif exam.end_date < exam.start_date:
        blockers.append("Exam end date cannot be earlier than start date.")

    # 2. Participating classes
    participating = exam.participating_classes.all()
    class_ids = [p.class_id for p in participating]
    if not class_ids:
        # Check if timetable has classes
        class_ids = list({t.class_id for t in exam.timetable.all()})

    if not class_ids:
        blockers.append("No classes selected. Select at least one participating class.")
    else:
        for cid in class_ids:
            cls = Class.query.get(cid)
            c_name = f"{cls.name} - {cls.section}" if cls else f"Class #{cid}"
            
            # 3. Student enrollment check
            students_count = Student.query.filter_by(class_id=cid, school_id=sid).count()
            if students_count == 0:
                warnings.append(f"{c_name} has no enrolled active students.")

            # 4. Subjects check
            subjects = Subject.query.filter_by(class_id=cid).all()
            if not subjects:
                blockers.append(f"{c_name} has no subjects configured in the school curriculum.")
            else:
                for sub in subjects:
                    if not sub.teacher_id:
                        warnings.append(f"{c_name} -> {sub.name} has no assigned subject teacher.")

            # 5. Timetable check for class
            tt_items = ExamTimetable.query.filter_by(exam_id=exam.id, class_id=cid).all()
            if not tt_items:
                blockers.append(f"{c_name} has no exam timetable/papers configured.")
            else:
                tt_subject_ids = {t.subject_id for t in tt_items}
                for sub in subjects:
                    if sub.id not in tt_subject_ids:
                        warnings.append(f"{c_name} -> {sub.name} is missing from the exam timetable.")

    # 6. Timing conflict checks across timetable
    all_tt = exam.timetable.all()
    date_subj_map = {}
    for item in all_tt:
        key = (item.class_id, str(item.exam_date), item.subject_id)
        if key in date_subj_map:
            cls = Class.query.get(item.class_id)
            c_name = f"{cls.name} - {cls.section}" if cls else ""
            blockers.append(f"Duplicate subject paper in {c_name} on {item.exam_date}.")
        date_subj_map[key] = True

        # Check date range
        if exam.start_date and exam.end_date:
            if item.exam_date < exam.start_date or item.exam_date > exam.end_date:
                sub_name = item.subject.name if item.subject else f"Subject #{item.subject_id}"
                cls = Class.query.get(item.class_id)
                c_name = f" ({cls.name} - {cls.section})" if cls else ""
                blockers.append(f"Paper for {sub_name}{c_name} on {item.exam_date} falls outside the exam period ({exam.start_date} to {exam.end_date}). Edit paper date to be within exam range.")

    can_publish = len(blockers) == 0
    return jsonify({
        'exam_id':          exam.id,
        'exam_name':        exam.exam_name,
        'status':           exam.status,
        'ready_to_publish': can_publish,
        'blockers':         blockers,
        'warnings':         warnings,
        'summary': {
            'classes_count':   len(class_ids),
            'papers_count':    len(all_tt),
            'blockers_count':  len(blockers),
            'warnings_count':  len(warnings),
        }
    }), 200


@principal_bp.route('/exams/<int:exam_id>/publish', methods=['POST'])
@role_required('PRINCIPAL')
def publish_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json(silent=True) or {}
    force = bool(data.get('force', False))
    reason = (data.get('reason') or '').strip()

    # Pre-publish validation check
    participating = exam.participating_classes.all()
    class_ids = [p.class_id for p in participating] or list({t.class_id for t in exam.timetable.all()})
    if not class_ids and not force:
        return jsonify({'error': 'Cannot publish exam: At least one class must be configured.'}), 400

    exam.status       = 'PUBLISHED'
    exam.is_published = True
    exam.published_at = datetime.utcnow()
    exam.published_by = get_current_user().id

    # Auto-initialize participating classes if missing
    if not participating and class_ids:
        for cid in class_ids:
            db.session.add(ExamClass(school_id=sid, exam_id=exam.id, class_id=cid))

    # Send in-app notification to school staff & teachers
    from app.models.communication import SupportNotification
    from app.models.user import User, UserRole
    teachers = User.query.filter_by(school_id=sid, role=UserRole.TEACHER, is_active=True).all()
    for t in teachers:
        db.session.add(SupportNotification(
            user_id=t.id, school_id=sid,
            title=f"Exam Published: {exam.exam_name}",
            message=f"The examination '{exam.exam_name}' ({exam.session}) has been published. Timetable and mark assignments are now active.",
            notif_type='EXAM'
        ))

    # Log audit
    from app.services.audit_service import log_action
    try:
        log_action('exam', 'management', 'PUBLISH', user=get_current_user(), new_value=exam.to_dict(), remarks=f"Published exam {exam.exam_name}")
    except Exception:
        pass

    db.session.commit()
    return jsonify({'message': 'Exam published successfully', 'exam': exam.to_dict()}), 200


@principal_bp.route('/exams/<int:exam_id>/reopen', methods=['POST'])
@role_required('PRINCIPAL')
def reopen_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'Reason is mandatory to reopen/edit a published exam.'}), 400

    old_val = exam.to_dict()
    exam.status       = 'DRAFT'
    exam.is_published = False

    # Log audit
    from app.services.audit_service import log_action
    try:
        log_action('exam', 'management', 'REOPEN', user=get_current_user(),
                   old_value=old_val, new_value=exam.to_dict(), remarks=f"Reopened exam {exam.exam_name}. Reason: {reason}")
    except Exception:
        pass

    db.session.commit()
    return jsonify({'message': 'Exam reopened to Draft for modifications', 'exam': exam.to_dict()}), 200


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


@principal_bp.route('/exams/<int:exam_id>', methods=['DELETE'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR'],
    permissions=['exams.schedule.manage']
)
def delete_exam(exam_id):
    exam = ExamSchedule.query.get_or_404(exam_id)
    curr = get_current_user()
    if not getattr(curr, 'is_super', False) and curr.school_id and exam.school_id != curr.school_id:
        return jsonify({'error': 'Unauthorized'}), 403

    force = request.args.get('force', 'false').lower() in ('true', '1')
    if exam.status == 'PUBLISHED' and not force:
        return jsonify({'error': 'Published exam delete nahi ho sakta. Pehle reopen/unpublish karo ya delete confirm karo.'}), 400

    try:
        # 1. Delete Marks Audit Logs referencing this exam
        try:
            from app.routes.result_management import MarksAuditLog
            MarksAuditLog.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 5. Delete Result Return Items & Result Subject Status
        try:
            from app.routes.result_management import ResultReturnItem, ResultSubjectStatus
            status_ids = [
                row.id for row in
                ResultSubjectStatus.query.filter_by(exam_id=exam_id)
                .with_entities(ResultSubjectStatus.id).all()
            ]
            if status_ids:
                ResultReturnItem.query.filter(
                    ResultReturnItem.subject_status_id.in_(status_ids)
                ).delete(synchronize_session=False)
            ResultSubjectStatus.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 6. Delete Class Result Publication
        try:
            from app.routes.result_management import ClassResultPublication
            ClassResultPublication.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 7. Delete Marks
        try:
            Marks.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 8. Delete Exam Teacher Delegations
        try:
            ExamTeacherDelegation.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 9. Delete Timetable, Classes, Subjects
        try:
            ExamTimetable.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
            ExamClass.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
            ExamSubject.query.filter_by(exam_id=exam_id).delete(synchronize_session=False)
        except Exception:
            pass

        # 10. Fallback raw SQL cleanup in case any extra FK references exam_id
        from sqlalchemy import text
        cleanup_statements = [
            text("DELETE FROM marks_audit_logs WHERE exam_id = :eid"),
            text("DELETE FROM result_audit_logs WHERE exam_id = :eid"),
            text("DELETE FROM result_locks WHERE exam_id = :eid"),
            text("DELETE FROM result_versions WHERE exam_id = :eid"),
            text("DELETE FROM result_return_items WHERE exam_id = :eid"),
            text("DELETE FROM result_subject_status WHERE exam_id = :eid"),
            text("DELETE FROM class_result_publication WHERE exam_id = :eid"),
            text("DELETE FROM marks WHERE exam_id = :eid"),
            text("DELETE FROM exam_teacher_delegations WHERE exam_id = :eid"),
            text("DELETE FROM exam_timetable WHERE exam_id = :eid"),
            text("DELETE FROM exam_classes WHERE exam_id = :eid"),
            text("DELETE FROM exam_subjects WHERE exam_id = :eid"),
        ]
        for stmt in cleanup_statements:
            try:
                db.session.execute(stmt, {'eid': exam_id})
            except Exception:
                pass

        db.session.delete(exam)
        db.session.commit()
        return jsonify({'message': f"Exam '{exam.exam_name}' deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f"Delete failed: {str(e)}"}), 500


@principal_bp.route('/exams/<int:exam_id>/timetable', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN'],
    permissions=['exams.timetable.manage', 'exams.results.publish', 'exams.schedules.view']
)
def get_exam_timetable(exam_id):
    try:
        exam = ExamSchedule.query.get_or_404(exam_id)
        curr = get_current_user()
        if not curr.is_super and curr.school_id and exam.school_id != curr.school_id:
            return jsonify({'error': 'Unauthorized'}), 403
        class_id = request.args.get('class_id')
        q = ExamTimetable.query.filter_by(exam_id=exam_id)
        if class_id:
            try:
                c_id = int(class_id)
                q = q.filter_by(class_id=c_id)
            except (ValueError, TypeError):
                q = q.filter_by(class_id=class_id)
        items = q.order_by(ExamTimetable.exam_date.asc()).all()
        return jsonify([i.to_dict() for i in items]), 200
    except Exception as e:
        return jsonify([]), 200


@principal_bp.route('/exams/<int:exam_id>/timetable', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def add_timetable_item(exam_id):
    """Add subject-wise paper to exam timetable with conflict validation."""
    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}

    class_id = data.get('class_id')
    if not class_id:
        return jsonify({'error': 'class_id is required'}), 400

    subject_id = data.get('subject_id') or None
    if not subject_id and data.get('subject_name_manual'):
        existing = Subject.query.filter_by(
            name=data['subject_name_manual'],
            class_id=class_id
        ).first()
        if existing:
            subject_id = existing.id
        else:
            new_subj = Subject(
                name=data['subject_name_manual'],
                class_id=class_id,
                school_id=sid
            )
            db.session.add(new_subj)
            db.session.flush()
            subject_id = new_subj.id

    if not subject_id:
        return jsonify({'error': 'Subject select karo ya naam type karo'}), 400

    try:
        ex_date = date.fromisoformat(str(data['exam_date']).split('T')[0])
    except Exception:
        return jsonify({'error': 'Invalid exam_date'}), 400

    # Conflict check: same subject on same date in same class
    conflict = ExamTimetable.query.filter_by(
        exam_id=exam_id, class_id=class_id, subject_id=subject_id, exam_date=ex_date
    ).first()
    if conflict:
        return jsonify({'error': 'This subject paper is already scheduled on this date for this class'}), 400

    item = ExamTimetable(
        exam_id          = exam_id,
        class_id         = class_id,
        subject_id       = subject_id,
        exam_date        = ex_date,
        start_time       = data.get('start_time', '10:00 AM'),
        end_time         = data.get('end_time',   '01:00 PM'),
        venue            = data.get('venue') or data.get('room') or 'Main Hall',
        room             = data.get('room') or data.get('venue') or '',
        invigilator_id   = data.get('invigilator_id') or None,
        invigilator_name = data.get('invigilator_name') or '',
        max_marks        = int(data.get('max_marks',  100)),
        pass_marks       = int(data.get('pass_marks', 33)),
        instructions     = data.get('instructions', ''),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@principal_bp.route('/exams/timetable/<int:item_id>', methods=['PATCH', 'PUT'])
@role_required('PRINCIPAL', 'TEACHER')
def update_timetable_item(item_id):
    item = ExamTimetable.query.get_or_404(item_id)
    data = request.get_json() or {}
    if data.get('exam_date'):
        item.exam_date = date.fromisoformat(str(data['exam_date']).split('T')[0])
    if data.get('start_time'):       item.start_time       = data['start_time']
    if data.get('end_time'):         item.end_time         = data['end_time']
    if data.get('venue'):            item.venue            = data['venue']
    if data.get('room'):             item.room             = data['room']
    if data.get('invigilator_id'):   item.invigilator_id   = data['invigilator_id']
    if data.get('invigilator_name'): item.invigilator_name = data['invigilator_name']
    if data.get('max_marks'):        item.max_marks        = int(data['max_marks'])
    if data.get('pass_marks'):       item.pass_marks       = int(data['pass_marks'])
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
    return jsonify({'message': 'Timetable paper deleted'}), 200


# ─── Single & Bulk Admit Card PDF ─────────────────────────────────────────────

@principal_bp.route('/admit-card/<int:student_id>/<int:exam_id>', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR'],
    permissions=['exams.admitcard.generate']
)
def admit_card_pdf(student_id, exam_id):
    curr = get_current_user()
    student = Student.query.get_or_404(student_id)
    if curr and getattr(curr.role, 'value', str(curr.role)) in ('STUDENT', 'PARENT'):
        if student.user_id != curr.id:
            # Check parent link
            if getattr(curr.role, 'value', str(curr.role)) == 'PARENT':
                if student.parent_email != curr.email and student.parent_phone != curr.phone:
                    return jsonify({'error': 'Unauthorized'}), 403
            else:
                return jsonify({'error': 'Unauthorized'}), 403
    elif not getattr(curr, 'is_super', False) and curr.school_id and student.school_id != curr.school_id:
        return jsonify({'error': 'Unauthorized'}), 403
    exam = ExamSchedule.query.get_or_404(exam_id)
    from app.models.school import School
    school = School.query.get(student.school_id)
    timetable = ExamTimetable.query.filter_by(
        exam_id=exam_id, class_id=student.class_id
    ).order_by(ExamTimetable.exam_date.asc()).all()
    buf = generate_admit_card(student, school, exam, timetable)
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'AdmitCard_{student.roll_number or student.id}_{exam.exam_name}.pdf')


@principal_bp.route('/admit-card/class/<int:class_id>/<int:exam_id>', methods=['GET'])
@principal_bp.route('/exams/<int:exam_id>/admit-cards/bulk', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'TEACHER')
def bulk_admit_cards(exam_id, class_id=None):
    """Generate bulk class-wise or entire-exam admit cards."""
    if not class_id:
        class_id = request.args.get('class_id', type=int)

    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    from app.models.school import School
    school = School.query.get(sid)

    # Find students
    q = Student.query.filter_by(school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    else:
        p_classes = exam.participating_classes.all()
        if p_classes:
            cids = [pc.class_id for pc in p_classes]
            q = q.filter(Student.class_id.in_(cids))

    students = q.order_by(Student.class_id.asc(), Student.roll_number.asc()).all()
    if not students:
        return jsonify({'error': 'No enrolled active students found for admit cards'}), 404

    # Build student + timetable pairs
    pairs = []
    for s in students:
        tt = ExamTimetable.query.filter_by(exam_id=exam_id, class_id=s.class_id).order_by(ExamTimetable.exam_date.asc()).all()
        pairs.append((s, tt))

    buf = generate_bulk_admit_cards(pairs, school, exam)
    cls_suffix = f"_Class_{class_id}" if class_id else "_AllClasses"
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'BulkAdmitCards_{exam.exam_name}{cls_suffix}.pdf')


# ─── Single & Bulk Result Card PDF ─────────────────────────────────────────────

@principal_bp.route('/result-card/<int:student_id>/<int:exam_id>', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR'],
    permissions=['exams.results.publish']
)
def result_card_pdf(student_id, exam_id):
    curr = get_current_user()
    student = Student.query.get_or_404(student_id)
    
    # Check publication gating for Student / Parent
    from app.routes.result_management import ClassResultPublication
    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=student.class_id).first()
    is_published = (pub and pub.status == 'PUBLISHED') or bool(getattr(ExamSchedule.query.get(exam_id), 'is_published', False))

    if curr and getattr(curr.role, 'value', str(curr.role)) in ('STUDENT', 'PARENT'):
        if not is_published:
            return jsonify({'error': 'Result is not published yet'}), 403
        if getattr(curr.role, 'value', str(curr.role)) == 'STUDENT' and student.user_id != curr.id:
            return jsonify({'error': 'Unauthorized'}), 403
        elif getattr(curr.role, 'value', str(curr.role)) == 'PARENT':
            if student.parent_email != curr.email and student.parent_phone != curr.phone and student.user_id != curr.id:
                return jsonify({'error': 'Unauthorized'}), 403
    elif not getattr(curr, 'is_super', False) and curr.school_id and student.school_id != curr.school_id:
        return jsonify({'error': 'Unauthorized'}), 403

    exam = ExamSchedule.query.get_or_404(exam_id)
    from app.models.school import School
    school = School.query.get(student.school_id)
    marks = Marks.query.filter_by(student_id=student_id).filter(
        (Marks.exam_id == exam_id) | (Marks.exam_type == exam.exam_name)
    ).all()
    marks_data = [{
        'subject_name':   m.subject.name if m.subject else 'N/A',
        'max_marks':      m.max_marks or 100,
        'marks_obtained': m.marks_obtained or 0,
        'grade':          m.grade or '-'
    } for m in marks]

    # For FINAL/ANNUAL exams: fetch previous mid-term marks for cumulative result
    prev_marks_data = None
    prev_exam_id = request.args.get('prev_exam_id', type=int)
    if prev_exam_id:
        prev_marks = Marks.query.filter_by(student_id=student_id, exam_id=prev_exam_id).all()
        prev_marks_data = [{
            'subject_name':   m.subject.name if m.subject else 'N/A',
            'max_marks':      m.max_marks or 100,
            'marks_obtained': m.marks_obtained or 0,
            'grade':          m.grade or '-'
        } for m in prev_marks]
    elif (exam.exam_type or '').upper() in ('FINAL', 'ANNUAL', 'FINAL_TERM'):
        prev_exam = ExamSchedule.query.filter_by(
            school_id=exam.school_id, session=exam.session
        ).filter(
            ExamSchedule.exam_type.in_(['MID_TERM', 'HALF_YEARLY', 'UNIT_TEST'])
        ).order_by(ExamSchedule.start_date.desc()).first()
        if prev_exam:
            prev_marks = Marks.query.filter_by(student_id=student_id).filter(
                (Marks.exam_id == prev_exam.id) | (Marks.exam_type == prev_exam.exam_name)
            ).all()
            if prev_marks:
                prev_marks_data = [{
                    'subject_name':   m.subject.name if m.subject else 'N/A',
                    'max_marks':      m.max_marks or 100,
                    'marks_obtained': m.marks_obtained or 0,
                    'grade':          m.grade or '-'
                } for m in prev_marks]

    ver_no = (pub.republish_count + 1) if pub else 1
    buf = generate_result_card(student, school, exam, marks_data, prev_marks_data=prev_marks_data, version_number=ver_no)
    student_name = student.user.name if (student.user and student.user.name) else f"Student_{student.id}"
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'ResultCard_{student.roll_number or student.id}_{student_name}.pdf')


@principal_bp.route('/result-card/class/<int:class_id>/<int:exam_id>', methods=['GET'])
@principal_bp.route('/exams/<int:exam_id>/result-cards/bulk', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'TEACHER')
def bulk_result_cards(exam_id, class_id=None):
    """Generate bulk class-wise or exam-wide result cards."""
    if not class_id:
        class_id = request.args.get('class_id', type=int)

    exam = ExamSchedule.query.get_or_404(exam_id)
    sid = _school_id()
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    from app.models.school import School
    school = School.query.get(sid)

    # Students list
    q = Student.query.filter_by(school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    else:
        p_classes = exam.participating_classes.all()
        if p_classes:
            cids = [pc.class_id for pc in p_classes]
            q = q.filter(Student.class_id.in_(cids))

    students = q.order_by(Student.class_id.asc(), Student.roll_number.asc()).all()
    if not students:
        return jsonify({'error': 'No students found for result card generation'}), 404

    # Build student + marks tuples
    tuples = []
    for s in students:
        marks = Marks.query.filter_by(student_id=s.id).filter(
            (Marks.exam_id == exam_id) | (Marks.exam_type == exam.exam_name)
        ).all()
        marks_data = [{
            'subject_name':   m.subject.name if m.subject else 'N/A',
            'max_marks':      m.max_marks or 100,
            'marks_obtained': m.marks_obtained or 0,
            'grade':          m.grade or '-'
        } for m in marks]
        tuples.append((s, marks_data, None))

    from app.routes.result_management import ClassResultPublication
    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first() if class_id else None
    ver_no = (pub.republish_count + 1) if pub else 1

    buf = generate_bulk_result_cards(tuples, school, exam, version_number=ver_no)
    cls_suffix = f"_Class_{class_id}" if class_id else "_AllClasses"
    return send_file(buf, mimetype='application/pdf',
                     download_name=f'BulkResultCards_{exam.exam_name}{cls_suffix}.pdf')


@principal_bp.route('/result-card/<int:student_id>/<int:exam_id>/data', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR', 'ADMIN'],
    permissions=['exams.results.publish', 'exams.results.view', 'exams.schedules.view']
)
def result_card_data(student_id, exam_id):
    try:
        curr = get_current_user()
        student = Student.query.get_or_404(student_id)
        if curr and curr.role == 'STUDENT' and student.user_id != curr.id:
            return jsonify({'error': 'Unauthorized'}), 403
        if curr and not curr.is_super and curr.school_id and student.school_id != curr.school_id:
            return jsonify({'error': 'Unauthorized'}), 403
        exam = ExamSchedule.query.get_or_404(exam_id)
        from app.models.school import School
        school = School.query.get(student.school_id)
        
        marks = Marks.query.filter_by(student_id=student_id).filter(
            (Marks.exam_id == exam_id) | (Marks.exam_type == exam.exam_name)
        ).all()
        
        marks_data = []
        for m in marks:
            s_name = 'Subject'
            if m.subject and m.subject.name:
                s_name = m.subject.name
            elif getattr(m, 'subject_name', None):
                s_name = m.subject_name
            marks_data.append({
                'id':             m.id,
                'subject_name':   s_name,
                'max_marks':      int(m.max_marks or 100),
                'marks_obtained': float(m.marks_obtained or 0),
                'grade':          m.grade or '-'
            })

        # Also fetch previous mid-term marks if this is a FINAL exam
        prev_marks_data = []
        prev_exam_id = request.args.get('prev_exam_id', type=int)
        if prev_exam_id:
            prev_marks = Marks.query.filter_by(student_id=student_id, exam_id=prev_exam_id).all()
            for m in prev_marks:
                s_name = m.subject.name if m.subject else 'Subject'
                prev_marks_data.append({
                    'subject_name':   s_name,
                    'max_marks':      int(m.max_marks or 100),
                    'marks_obtained': float(m.marks_obtained or 0),
                    'grade':          m.grade or '-'
                })
        elif (exam.exam_type or '').upper() in ('FINAL', 'ANNUAL', 'FINAL_TERM'):
            prev_exam = ExamSchedule.query.filter_by(
                school_id=exam.school_id, session=exam.session
            ).filter(
                ExamSchedule.exam_type.in_(['MID_TERM', 'HALF_YEARLY', 'UNIT_TEST'])
            ).order_by(ExamSchedule.start_date.desc()).first()
            if prev_exam:
                prev_marks = Marks.query.filter_by(student_id=student_id).filter(
                    (Marks.exam_id == prev_exam.id) | (Marks.exam_type == prev_exam.exam_name)
                ).all()
                for m in prev_marks:
                    s_name = m.subject.name if m.subject else 'Subject'
                    prev_marks_data.append({
                        'subject_name':   s_name,
                        'max_marks':      int(m.max_marks or 100),
                        'marks_obtained': float(m.marks_obtained or 0),
                        'grade':          m.grade or '-'
                    })

        total_max = sum(m['max_marks'] for m in marks_data)
        total_obtained = sum(m['marks_obtained'] for m in marks_data)
        overall_pct = round((total_obtained / total_max * 100), 1) if total_max else 0
        overall_result = 'PASS' if overall_pct >= 33 else ('FAIL' if marks_data else 'N/A')

        return jsonify({
            'student': student.to_dict(),
            'school': school.to_dict() if school else {},
            'exam': exam.to_dict(),
            'marks': marks_data,
            'prev_marks': prev_marks_data,
            'total_max': total_max,
            'total_obtained': total_obtained,
            'overall_percentage': overall_pct,
            'overall_result': overall_result,
        }), 200
    except Exception as e:
        return jsonify({
            'student': {},
            'school': {},
            'exam': {},
            'marks': [],
            'prev_marks': [],
            'total_max': 0,
            'total_obtained': 0,
            'overall_percentage': 0,
            'overall_result': 'N/A',
        }), 200



# NEW — paste near admit_card_pdf / result_card_pdf routes

@principal_bp.route('/fees/receipt/<string:receipt_no>/pdf', methods=['GET'])
@permission_required('fees.receipt.view')
def fee_receipt_pdf(receipt_no):
    """Ek receipt_no ke saare linked transactions (single ya combined) ka ek PDF."""
    sid  = _school_id()
    txns = FeeTransaction.query.filter_by(receipt_no=receipt_no, school_id=sid).all()
    if not txns:
        return jsonify({'error': 'Receipt not found'}), 404

    student = Student.query.get(txns[0].student_id)
    if not student or student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    from app.models.school import School
    school = School.query.get(sid)
    from app.utils.pdf_generator import generate_fee_receipt_pdf
    buf = generate_fee_receipt_pdf(student, school, txns, receipt_no)
    return send_file(buf, mimetype='application/pdf',
                      download_name=f'Receipt_{receipt_no}.pdf')


@principal_bp.route('/students/<int:student_id>/notice/pdf', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def student_notice_pdf(student_id):
    """
    Ek hi PDF — 'ghar jaane wali' consolidated notice: pending fees (sab types),
    attendance summary, is month ke due dates. Payment receipt se ALAG hai.
    Query param: month=2026-07 (default current month)
    """
    student = Student.query.get_or_404(student_id)
    sid     = _school_id()
    if student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    month = request.args.get('month') or date.today().strftime('%Y-%m')

    from app.models.school import School
    school = School.query.get(sid)

    fee_records = FeeRecord.query.filter_by(student_id=student_id, month=month)\
                    .filter(FeeRecord.status != 'DRAFT').all()

    att_records   = Attendance.query.filter_by(student_id=student_id).all()
    present       = sum(1 for a in att_records if a.status == 'PRESENT')
    total_marked  = len(att_records)

    from app.utils.pdf_generator import generate_student_notice_pdf
    buf = generate_student_notice_pdf(student, school, fee_records, {
        'present': present, 'total': total_marked,
        'percentage': round(present / total_marked * 100, 1) if total_marked else 0,
    }, month)

    return send_file(buf, mimetype='application/pdf',
                      download_name=f'Notice_{student.roll_number or student_id}_{month}.pdf')

@principal_bp.route('/students/<int:student_id>/profile', methods=['GET'])
@principal_bp.route('/students/<int:student_id>', methods=['GET'])
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
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
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
    s_late    = sum(1 for a in att_today if a.status == 'LATE')

    # Today's teacher attendance
    total_teachers = Teacher.query.filter_by(school_id=sid).count()
    t_att_today    = TeacherAttendance.query.filter_by(
                         school_id=sid, date=today
                     ).all()
    t_present = sum(1 for a in t_att_today if a.status == 'PRESENT')
    t_absent  = sum(1 for a in t_att_today if a.status == 'ABSENT')

    # ── Class-wise student attendance breakdown today ────────────────────────
    classes = Class.query.filter_by(school_id=sid).order_by(Class.name, Class.section).all()
    class_att_list = []
    for c in classes:
        cls_students = c.students.all()
        cls_total = len(cls_students)
        cls_sids = [s.id for s in cls_students]
        cls_att = [a for a in att_today if a.student_id in cls_sids]
        cls_p = sum(1 for a in cls_att if a.status == 'PRESENT')
        cls_a = sum(1 for a in cls_att if a.status == 'ABSENT')
        cls_l = sum(1 for a in cls_att if a.status == 'LATE')
        cls_pct = round((cls_p / cls_total) * 100, 1) if cls_total > 0 else 0
        cls_name_full = f"{c.name}{' - ' + c.section if c.section else ''}"
        class_att_list.append({
            'class_id':    c.id,
            'class_name':  cls_name_full,
            'total':       cls_total,
            'present':     cls_p,
            'absent':      cls_a,
            'late':        cls_l,
            'not_marked':  cls_total - len(cls_att),
            'percentage':  cls_pct
        })

    # Best attendance class today
    best_class = None
    classes_with_students = [c for c in class_att_list if c['total'] > 0]
    if classes_with_students:
        sorted_by_pct = sorted(classes_with_students, key=lambda x: (x['percentage'], x['present']), reverse=True)
        if sorted_by_pct:
            best_class = sorted_by_pct[0]

    # ── Attendance trend — last 7 calendar days, % present of marked ──────────
    attendance_trend = []
    for i in range(6, -1, -1):
        d   = today - timedelta(days=i)
        day = Attendance.query.join(
                  Student, Attendance.student_id == Student.id
              ).filter(Student.school_id == sid, Attendance.date == d).all()
        marked  = len(day)
        present = sum(1 for a in day if a.status == 'PRESENT')
        attendance_trend.append({
            'date':    d.isoformat(),
            'label':   d.strftime('%a'),
            'percent': round(present / marked * 100, 1) if marked else 0,
        })

    # ── Fee collection trend — last 6 weeks (Mon–Sun), amount actually paid ──
    fee_trend = []
    week_start = today - timedelta(days=today.weekday())  # is week ka Monday
    for i in range(5, -1, -1):
        w_start = week_start - timedelta(weeks=i)
        w_end   = w_start + timedelta(days=6)
        total   = db.session.query(func.sum(FeeRecord.amount_paid)).filter(
                      FeeRecord.school_id  == sid,
                      FeeRecord.paid_date  >= w_start,
                      FeeRecord.paid_date  <= w_end,
                  ).scalar() or 0
        fee_trend.append({
            'label':  f'{w_start.strftime("%d %b")}',
            'amount': round(total, 2),
        })

    # ── Students by class — real class + section names ───────────────────────
    class_rows = db.session.query(
                     Class.name, Class.section, func.count(Student.id)
                 ).outerjoin(
                     Student, Student.class_id == Class.id
                 ).filter(Class.school_id == sid).group_by(Class.id).all()
    class_distribution = [
        {
            'name':  f'{name}' + (f' - {section}' if section else ''),
            'count': count,
        }
        for name, section, count in class_rows
    ]

    # ── Quick stats — Library / Hostel / Circulars (only real, wired modules) ─
    from app.models.library import BookIssue
    from app.models.hostel import HostelBed
    from app.models.communication import Announcement

    library_issued  = BookIssue.query.filter_by(school_id=sid, status='ISSUED').count()
    hostel_occupied = HostelBed.query.filter_by(school_id=sid, status='OCCUPIED').count()
    hostel_total    = HostelBed.query.filter_by(school_id=sid).count()
    active_circulars = Announcement.query.filter(
                            db.or_(Announcement.school_id == sid, Announcement.school_id.is_(None)),
                            Announcement.is_active == True,
                        ).count()

    # ── Teacher Celebrations: Birthdays & Work Anniversaries today ─────────────
    teachers_all = Teacher.query.filter_by(school_id=sid).all()
    today_birthdays = []
    today_anniversaries = []

    for t in teachers_all:
        t_name = t.user.name if (t.user and t.user.name) else 'Faculty Member'
        dept = t.department or t.designation or 'Faculty'
        
        # Birthday Check
        if t.dob and t.dob.month == today.month and t.dob.day == today.day:
            today_birthdays.append({
                'id': t.id,
                'name': t_name,
                'department': dept,
                'designation': t.designation or 'Teacher',
                'photo_url': t.photo_url,
                'type': 'BIRTHDAY',
                'message': f"Wishing {t_name} a very Happy Birthday! 🎂🎉"
            })
        
        # Work Anniversary Check
        if t.joining_date and t.joining_date.month == today.month and t.joining_date.day == today.day:
            years = today.year - t.joining_date.year
            if years >= 1:
                today_anniversaries.append({
                    'id': t.id,
                    'name': t_name,
                    'department': dept,
                    'designation': t.designation or 'Teacher',
                    'photo_url': t.photo_url,
                    'years': years,
                    'type': 'ANNIVERSARY',
                    'message': f"Happy {years}{'st' if years==1 else 'nd' if years==2 else 'rd' if years==3 else 'th'} Work Anniversary to {t_name}! 🌟"
                })

    # ── Fee Intelligence Metrics (This Month, This Year/Session, All Time) ─────
    curr_month_str = today.strftime('%Y-%m')
    curr_month_name = today.strftime('%B %Y')
    curr_session = '2024-25'
    school_obj = School.query.get(sid)
    if school_obj and hasattr(school_obj, 'session') and school_obj.session:
        curr_session = school_obj.session

    # This Month
    # Match both '2026-08' and 'August 2026' or paid_date in current month
    m_start = date(today.year, today.month, 1)
    if today.month == 12:
        m_end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        m_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

    month_fee_records = FeeRecord.query.filter(
        FeeRecord.school_id == sid,
        FeeRecord.status != 'DRAFT',
        db.or_(
            FeeRecord.month == curr_month_str,
            FeeRecord.month == curr_month_name,
            db.and_(FeeRecord.due_date >= m_start, FeeRecord.due_date <= m_end)
        )
    ).all()

    month_fees_generated = sum(r.effective_due() for r in month_fee_records)
    # Month collection from transactions or records
    month_fees_collected = db.session.query(func.sum(FeeTransaction.amount)).filter(
        FeeTransaction.school_id == sid,
        FeeTransaction.transaction_date >= m_start,
        FeeTransaction.transaction_date <= m_end
    ).scalar() or 0
    if not month_fees_collected:
        month_fees_collected = sum(r.amount_paid or 0 for r in month_fee_records)

    month_fees_pending = max(0.0, round(float(month_fees_generated) - float(month_fees_collected), 2))
    month_col_pct = round((float(month_fees_collected) / float(month_fees_generated) * 100), 1) if month_fees_generated > 0 else 0.0

    # This Year / Academic Session
    session_fee_records = FeeRecord.query.filter(
        FeeRecord.school_id == sid,
        FeeRecord.status != 'DRAFT',
        FeeRecord.session == curr_session
    ).all()

    if not session_fee_records:
        # Fallback to all records in current year
        y_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
        session_fee_records = FeeRecord.query.filter(
            FeeRecord.school_id == sid,
            FeeRecord.status != 'DRAFT',
            FeeRecord.created_at >= y_start
        ).all()

    year_fees_generated = sum(r.effective_due() for r in session_fee_records)
    year_fees_collected = sum(r.amount_paid or 0 for r in session_fee_records)
    year_fees_pending = max(0.0, round(float(year_fees_generated) - float(year_fees_collected), 2))
    year_col_pct = round((float(year_fees_collected) / float(year_fees_generated) * 100), 1) if year_fees_generated > 0 else 0.0

    # All-Time
    all_time_generated = db.session.query(func.sum(FeeRecord.amount_due + func.coalesce(FeeRecord.fine, 0) - func.coalesce(FeeRecord.discount, 0))).filter(
        FeeRecord.school_id == sid, FeeRecord.status != 'DRAFT'
    ).scalar() or 0
    fee_collected_total = db.session.query(func.sum(FeeRecord.amount_paid)).filter(
        FeeRecord.school_id == sid, FeeRecord.status != 'DRAFT'
    ).scalar() or 0
    fee_pending_total = max(0.0, round(float(all_time_generated) - float(fee_collected_total), 2))
    all_time_col_pct = round((float(fee_collected_total) / float(all_time_generated) * 100), 1) if all_time_generated > 0 else 0.0

    teachers_marked_count = len(t_att_today)
    teachers_pct = round((t_present / total_teachers * 100), 1) if total_teachers > 0 else 0

    return jsonify({
        'total_students':          total_students,
        'total_teachers':          total_teachers,
        'total_classes':           len(classes),

        # Comprehensive Fee Intelligence Breakdown
        'fee_intelligence': {
            'current_month_label':   curr_month_name,
            'current_session':       curr_session,
            # Month
            'month_generated':       round(float(month_fees_generated), 2),
            'month_collected':       round(float(month_fees_collected), 2),
            'month_pending':         round(float(month_fees_pending), 2),
            'month_percentage':      month_col_pct,
            # Year / Session
            'year_generated':        round(float(year_fees_generated), 2),
            'year_collected':        round(float(year_fees_collected), 2),
            'year_pending':          round(float(year_fees_pending), 2),
            'year_percentage':       year_col_pct,
            # All Time
            'all_time_generated':    round(float(all_time_generated), 2),
            'all_time_collected':    round(float(fee_collected_total), 2),
            'all_time_pending':      round(float(fee_pending_total), 2),
            'all_time_percentage':   all_time_col_pct,
        },

        'fee_collected':           float(fee_collected_total),
        'fee_pending':             float(fee_pending_total),
        'fee_generated':           float(all_time_generated),
        'attendance_trend':        attendance_trend,
        'fee_trend':               fee_trend,
        'class_distribution':      class_distribution,
        'library_issued':          library_issued,
        'hostel_occupied':         hostel_occupied,
        'hostel_total':            hostel_total,
        'active_circulars':        active_circulars,
        # student attendance today
        'students_present':        s_present,
        'students_absent':         s_absent,
        'students_late':           s_late,
        'students_marked':         len(att_today),
        # teacher attendance today
        'teachers_present':        t_present,
        'teachers_absent':         t_absent,
        'teachers_marked':         teachers_marked_count,
        'teachers_percentage':     teachers_pct,
        # class-wise intelligence
        'class_attendance_today':  class_att_list,
        'best_attendance_class':   best_class,
        # celebrations
        'today_birthdays':         today_birthdays,
        'today_anniversaries':     today_anniversaries,
    }), 200


@principal_bp.route('/admission-card/<int:student_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def admission_card_pdf(student_id):
    student = Student.query.get_or_404(student_id)
    # Security: student isi school ka hona chahiye
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
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
    """Soft delete / archive a teacher into DELETED ITEMS (1-year retention)."""
    from app.services.archive_service import soft_delete_teacher
    sid = _school_id()
    actor = get_current_user()
    reason = request.args.get('reason') or (request.get_json(silent=True) or {}).get('reason', '')
    try:
        archived_item = soft_delete_teacher(teacher_id=t_id, school_id=sid, actor_user=actor, reason=reason)
        return jsonify({
            'message': f"{archived_item.name} has been moved to Deleted Items for 1 year.",
            'item': archived_item.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete teacher: {str(e)}'}), 500


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
    try:
        from app.utils.file_security import validate_and_sanitize_upload
        validate_and_sanitize_upload(file, allowed_types=('image',), max_size_bytes=5 * 1024 * 1024)
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400

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
    try:
        from app.utils.file_security import validate_and_sanitize_upload
        validate_and_sanitize_upload(file, allowed_types=('image',), max_size_bytes=5 * 1024 * 1024)
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400

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



@principal_bp.route('/classes/<int:class_id>/subjects', methods=['GET'])
@role_or_permission_required(
    roles=['PRINCIPAL', 'TEACHER', 'SUPER_ADMIN', 'ADMIN', 'STUDENT', 'PARENT', 'VICE_PRINCIPAL', 'DIRECTOR', 'ACCOUNTANT'],
    permissions=['academics.subjects.view', 'exams.timetable.manage']
)
def class_subjects(class_id):
    cls = Class.query.get_or_404(class_id)
    curr = get_current_user()
    if not getattr(curr, 'is_super', False) and curr.school_id and cls.school_id != curr.school_id:
        return jsonify({'error': 'Unauthorized'}), 403
    subjects = Subject.query.filter_by(class_id=class_id).order_by(Subject.name.asc()).all()
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
    data       = request.get_json() or {}
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
            code       = data.get('code', '').strip(),
            class_id   = int(class_id),
            school_id  = _school_id(),
            teacher_id = int(teacher_id) if teacher_id else None,
            max_marks  = int(data.get('max_marks', 100)),
            pass_marks = int(data.get('pass_marks', 33)),
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
@role_required('PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
def generate_student_id_card(student_id):
    """
    Generate and download ID card PDF for a single student.
    GET /api/principal/students/<id>/id-card
    """
    from app.models.school import School
    from app.utils.id_card_generator import generate_id_card_pdf

    student = Student.query.get_or_404(student_id)
    cur_user = get_current_user()
    if cur_user and getattr(cur_user.role, 'value', str(cur_user.role)) in ('STUDENT', 'PARENT'):
        if student.user_id != cur_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
    elif student.school_id != _school_id():
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
    """
    Non-teacher staff (Librarian, Accountant, etc.) — used by ID card module,
    Staff Access (RBAC) page, AND now Payroll page.

    Deliberately NOT behind @feature_required('role_based_access') — this is
    a plain staff directory, not an RBAC feature. Payroll previously fetched
    staff via /principal/users, which IS gated by role_based_access; on any
    school where that feature isn't enabled the call 403'd silently and
    staff (Accountant, Hostel Warden, Transport/driver, etc.) vanished from
    the Payroll dropdown — only Teachers (fetched separately) showed up.
    """
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
        # Added for Payroll: base salary (pre-fills amount), role (grouping),
        # is_active (Payroll shouldn't offer inactive staff as payees).
        'role':         u.role.value,
        'salary':       u.salary,
        'is_active':    u.is_active,
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
    try:
        from app.utils.file_security import validate_and_sanitize_upload
        validate_and_sanitize_upload(file, allowed_types=('image',), max_size_bytes=5 * 1024 * 1024)
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400

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
    try:
        from app.utils.file_security import validate_and_sanitize_upload
        validate_and_sanitize_upload(file, allowed_types=('image',), max_size_bytes=5 * 1024 * 1024)
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400

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
    try:
        from app.utils.file_security import validate_and_sanitize_upload
        validate_and_sanitize_upload(file, allowed_types=('image',), max_size_bytes=5 * 1024 * 1024)
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400

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
from app.models.rbac import get_user_roles, can_manage_role


def _norm(s):
    return _re.sub(r'\s+', ' ', (s or '').strip()).lower()


def _gen_username_p(name: str, role: str) -> str:
    """Same logic as admin version but scoped here to avoid circular import."""
    role_suffix = {
        'VICE_PRINCIPAL': 'vp', 'TEACHER': 'tchr', 'ACCOUNTANT': 'acct',
        'RECEPTIONIST': 'rcpt', 'LIBRARIAN': 'lib', 'HOSTEL': 'hstl',
        'TRANSPORT': 'trns', 'HR': 'hr', 'STUDENT': 'stu', 'PARENT': 'prnt',
        'ACADEMIC_COORDINATOR': 'acoord', 'CLASS_TEACHER': 'ctchr',
        'ASSISTANT_TEACHER': 'atchr', 'EXAM_CONTROLLER': 'exam',
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

def _actor_can_manage_target(actor, target):
    """
    True if actor may delete/deactivate/edit target, using the same
    platform_roles hierarchy as admin.py's delete_user(). Falls back to
    the old hardcoded block (nobody may touch SUPER_ADMIN/PRINCIPAL) if
    either side has no UserRoleAssignment yet -- fail-safe, not fail-open,
    since a legacy account without a platform role link can't have its
    hierarchy verified.
    """
    if target.role == UserRole.SUPER_ADMIN:
        return False
    target_roles = get_user_roles(target)
    actor_roles = get_user_roles(actor)
    if not target_roles or not actor_roles:
        return target.role not in (UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.DIRECTOR)
    return can_manage_role(actor_roles, target_roles)
# ── List users of own school ───────────────────────────────────────────────────
@principal_bp.route('/users', methods=['GET'])
@role_or_permission_required(roles=['PRINCIPAL'], permissions=['staff.profile.manage'])
@feature_required('role_based_access')
def principal_list_users():
    """
    GET /api/principal/users
    Query: role, status, search, page, per_page
    Returns only users belonging to the principal's school.
    """
    from app.models.user import User, UserRole
    sid = _school_id()

    q       = User.query.filter(User.school_id == sid, User.is_deleted == False)
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
        'users':    [u.to_dict() for u in users],
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

    # Link the new legacy role to its matching platform Role right away —
    # without this, the user has zero UserRoleAssignment rows until the
    # next server boot's backfill, meaning no default permissions AND any
    # override granted via the Staff Access page is a no-op until then.
    from app.services.permission_resolver import ensure_role_assignment_for_user
    ensure_role_assignment_for_user(user)
    db.session.commit()

    return jsonify(user.to_dict_with_credentials()), 201


# ── Reset password (own school only) ──────────────────────────────────────────
# NEW
@principal_bp.route('/users/<int:user_id>/reset-password', methods=['PUT'])
@role_required('PRINCIPAL')
def principal_reset_password(user_id):
    from app.models.user import User, UserRole
    sid   = _school_id()
    actor = get_current_user()
    user  = User.query.get_or_404(user_id)

    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized: user belongs to a different school'}), 403
    if not _actor_can_manage_target(actor, user):
        return jsonify({'error': 'You do not have sufficient hierarchy to reset this user\'s password'}), 403

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


# NEW
@principal_bp.route('/users/<int:user_id>/toggle', methods=['PUT'])
@role_required('PRINCIPAL')
def principal_toggle_user(user_id):
    from app.models.user import User, UserRole
    sid    = _school_id()
    actor  = get_current_user()
    user   = User.query.get_or_404(user_id)

    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if not _actor_can_manage_target(actor, user):
        return jsonify({'error': 'You do not have sufficient hierarchy to deactivate this user'}), 403

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
# NEW
@principal_bp.route('/users/<int:user_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
@feature_required('role_based_access')
def principal_update_user(user_id):
    from app.models.user import User, UserRole
    sid   = _school_id()
    actor = get_current_user()
    user  = User.query.get_or_404(user_id)
    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if not _actor_can_manage_target(actor, user):
        return jsonify({'error': 'You do not have sufficient hierarchy to edit this user'}), 403

    data = request.get_json() or {}
    for field in ['name', 'phone', 'department', 'designation']:
        if field in data:
            setattr(user, field, (data[field] or '').strip() or None)

    db.session.commit()
    return jsonify(user.to_dict_with_credentials()), 200

@principal_bp.route('/users/<int:user_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def principal_delete_user(user_id):
    """Soft delete / archive a staff account into DELETED ITEMS (1-year retention)."""
    from app.models.user import User
    from app.services.archive_service import soft_delete_staff
    sid   = _school_id()
    actor = get_current_user()
    user  = User.query.get_or_404(user_id)

    if user.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if user.id == actor.id:
        return jsonify({'error': 'Cannot delete your own account'}), 403
    if not _actor_can_manage_target(actor, user):
        return jsonify({'error': 'You do not have sufficient hierarchy to delete this user'}), 403

    reason = request.args.get('reason') or (request.get_json(silent=True) or {}).get('reason', '')
    try:
        archived_item = soft_delete_staff(user_id=user_id, school_id=sid, actor_user=actor, reason=reason)
        return jsonify({
            'message': f"{archived_item.name} has been moved to Deleted Items for 1 year.",
            'item': archived_item.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete staff member: {str(e)}'}), 500


@principal_bp.route('/students/<int:student_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_student(student_id):
    """Soft delete / archive a student into DELETED ITEMS (1-year retention)."""
    from app.services.archive_service import soft_delete_student
    sid = _school_id()
    actor = get_current_user()
    reason = request.args.get('reason') or (request.get_json(silent=True) or {}).get('reason', '')
    try:
        archived_item = soft_delete_student(student_id=student_id, school_id=sid, actor_user=actor, reason=reason)
        return jsonify({
            'message': f"{archived_item.name} has been moved to Deleted Items for 1 year.",
            'item': archived_item.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete student: {str(e)}'}), 500


# ─── DELETED ITEMS ARCHIVE & RECOVERY API (Centralized Trash System) ─────────

@principal_bp.route('/deleted-items', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def list_deleted_items():
    """
    List archived deleted items (Students, Teachers, Staff) with 1-year retention.
    Supports filtering by item_type ('STUDENT', 'TEACHER', 'STAFF', or empty for all),
    search term, and pagination.
    """
    from app.models.deleted_item import DeletedItem, DeletedItemStatus
    sid = _school_id()

    item_type = (request.args.get('type') or '').strip().upper()
    search = (request.args.get('search') or '').strip().lower()
    status = (request.args.get('status') or 'ARCHIVED').strip().upper()
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(100, int(request.args.get('per_page', 50)))

    q = DeletedItem.query.filter_by(school_id=sid)
    if status != 'ALL':
        q = q.filter_by(status=status)
    if item_type in ['STUDENT', 'TEACHER', 'STAFF']:
        q = q.filter_by(item_type=item_type)

    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(
            DeletedItem.name.ilike(like),
            DeletedItem.identifier.ilike(like),
            DeletedItem.class_name.ilike(like),
            DeletedItem.department.ilike(like),
            DeletedItem.designation.ilike(like),
        ))

    paginated = q.order_by(DeletedItem.deleted_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    # Breakdown metrics for tabs
    counts = {
        'students': DeletedItem.query.filter_by(school_id=sid, item_type='STUDENT', status='ARCHIVED').count(),
        'teachers': DeletedItem.query.filter_by(school_id=sid, item_type='TEACHER', status='ARCHIVED').count(),
        'staff':    DeletedItem.query.filter_by(school_id=sid, item_type='STAFF', status='ARCHIVED').count(),
        'total':    DeletedItem.query.filter_by(school_id=sid, status='ARCHIVED').count(),
    }

    return jsonify({
        'data':     [item.to_dict() for item in paginated.items],
        'counts':   counts,
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
        'has_prev': paginated.has_prev,
    }), 200


@principal_bp.route('/deleted-items/<int:item_id>/recover', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def recover_item_endpoint(item_id):
    """
    Restores an archived person back to active status.
    Gracefully validates class existence for students without crashing.
    """
    from app.services.archive_service import recover_deleted_item
    sid = _school_id()
    actor = get_current_user()
    try:
        res = recover_deleted_item(item_id=item_id, school_id=sid, actor_user=actor)
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Recovery failed: {str(e)}'}), 500


@principal_bp.route('/deleted-items/<int:item_id>/permanent', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def permanent_delete_item_endpoint(item_id):
    """
    Permanently purges an archived person.
    Requires strong confirmation: user must send confirmation_name matching person's exact name.
    Preserves and anonymizes financial history if student/user has transaction history.
    """
    from app.services.archive_service import permanently_purge_item
    sid = _school_id()
    actor = get_current_user()
    payload = request.get_json(silent=True) or {}
    confirmation_name = payload.get('confirmation_name') or request.args.get('confirmation_name', '')

    try:
        res = permanently_purge_item(
            item_id=item_id,
            school_id=sid,
            actor_user=actor,
            confirmation_name=confirmation_name,
            force=False
        )
        return jsonify(res), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Permanent deletion failed: {str(e)}'}), 500


@principal_bp.route('/deleted-items/cleanup', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def trigger_archive_cleanup():
    """
    Manually triggers 1-year auto-cleanup job (also runs daily via APScheduler).
    """
    from app.services.archive_service import run_one_year_cleanup_job
    try:
        summary = run_one_year_cleanup_job()
        return jsonify({
            'message': f"Cleanup executed successfully. {summary['purged_count']} expired records purged.",
            'summary': summary
        }), 200
    except Exception as e:
        return jsonify({'error': f'Cleanup job error: {str(e)}'}), 500

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


# ─── Documents (Student KYC + School-Issued + Analytics) ──────────────────────

def _current_academic_year():
    """Auto-detect academic year from school settings, fallback to calendar math."""
    try:
        from app.models.school import School
        school = School.query.get(_school_id())
        if school and getattr(school, 'current_session', None):
            return school.current_session
    except Exception:
        pass
    from datetime import date
    today = date.today()
    if today.month >= 4:
        return f"{today.year}-{str(today.year + 1)[2:]}"
    return f"{today.year - 1}-{str(today.year)[2:]}"


def _upload_file_to_cloudinary(file, folder):
    """Upload file to cloudinary and return (url, filename, size_bytes)."""
    from app.utils.file_security import validate_and_sanitize_upload
    filename, ext, size = validate_and_sanitize_upload(
        file,
        allowed_types=('image', 'pdf', 'document'),
        max_size_bytes=10 * 1024 * 1024
    )
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        resource_type='auto',
        use_filename=True,
        unique_filename=True,
    )
    return result['secure_url'], filename, size


# ─── 1. Documents Analytics Dashboard ──────────────────────────────────────────

@principal_bp.route('/documents/analytics', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_documents_analytics():
    """
    Overview analytics for Principal dashboard:
    - Total Students
    - Students with all required documents (Completed)
    - Students with pending/missing documents
    - Total documents uploaded
    - Document-wise upload / pending breakdown
    - Class-wise completion percentage
    - Configured document requirements
    """
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)

    # 1. Fetch active requirements for this school
    req_configs = get_school_doc_requirements(sid)
    req_dict = [r.to_dict() for r in req_configs]
    required_types = [r.doc_type for r in req_configs if r.is_required]

    # Fallback to defaults if required_types empty
    if not required_types:
        required_types = ['AADHAR_STUDENT', 'BIRTH_CERTIFICATE', 'PHOTO']

    # 2. Get students
    student_q = Student.query.filter_by(school_id=sid)
    if class_id:
        student_q = student_q.filter_by(class_id=class_id)
    students = student_q.all()
    total_students = len(students)

    if total_students == 0:
        return jsonify({
            'total_students': 0,
            'completed_students': 0,
            'pending_students': 0,
            'completion_pct': 0,
            'total_documents_uploaded': 0,
            'document_wise_stats': [],
            'class_wise_stats': [],
            'requirements': req_dict,
        }), 200

    student_ids = [s.id for s in students]

    # 3. Get all student documents for these students
    docs = StudentDocument.query.filter(
        StudentDocument.school_id == sid,
        StudentDocument.student_id.in_(student_ids)
    ).all()
    total_docs_uploaded = len(docs)

    # Map student_id -> set of doc_types
    student_docs_map = {}
    doc_type_counts = {}
    for d in docs:
        if d.student_id not in student_docs_map:
            student_docs_map[d.student_id] = set()
        student_docs_map[d.student_id].add(d.doc_type)
        doc_type_counts[d.doc_type] = doc_type_counts.get(d.doc_type, 0) + 1

    # 4. Count complete vs pending students
    completed_students = 0
    for s in students:
        s_docs = student_docs_map.get(s.id, set())
        if all(rt in s_docs for rt in required_types):
            completed_students += 1

    pending_students = total_students - completed_students
    overall_pct = round((completed_students / total_students * 100), 1) if total_students else 0

    # 5. Document-wise breakdown
    doc_wise_stats = []
    for r in req_configs:
        up_count = doc_type_counts.get(r.doc_type, 0)
        # Unique students having this doc
        unique_students_with_doc = sum(1 for s in students if r.doc_type in student_docs_map.get(s.id, set()))
        doc_wise_stats.append({
            'doc_type':       r.doc_type,
            'label':          r.label or STUDENT_DOC_TYPE_LABELS.get(r.doc_type, r.doc_type),
            'is_required':    r.is_required,
            'uploaded_count': unique_students_with_doc,
            'missing_count':  total_students - unique_students_with_doc,
            'percentage':     round((unique_students_with_doc / total_students * 100), 1) if total_students else 0,
        })

    # 6. Class-wise breakdown
    all_classes = Class.query.filter_by(school_id=sid).order_by(Class.name.asc(), Class.section.asc()).all()
    class_wise_stats = []
    for c in all_classes:
        c_students = [s for s in students if s.class_id == c.id]
        c_total = len(c_students)
        if c_total == 0:
            continue
        c_complete = 0
        for cs in c_students:
            cs_docs = student_docs_map.get(cs.id, set())
            if all(rt in cs_docs for rt in required_types):
                c_complete += 1
        class_wise_stats.append({
            'class_id':           c.id,
            'class_name':         f"{c.name} - {c.section}".strip(' -'),
            'total_students':     c_total,
            'completed_students': c_complete,
            'pending_students':   c_total - c_complete,
            'completion_pct':     round((c_complete / c_total * 100), 1) if c_total else 0,
        })

    return jsonify({
        'total_students':           total_students,
        'completed_students':       completed_students,
        'pending_students':         pending_students,
        'completion_pct':           overall_pct,
        'total_documents_uploaded': total_docs_uploaded,
        'document_wise_stats':      doc_wise_stats,
        'class_wise_stats':         class_wise_stats,
        'requirements':             req_dict,
    }), 200


# ─── 2. Class & Student Document Status Matrix ────────────────────────────────

@principal_bp.route('/documents/students-status', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_students_document_status():
    """
    Get students with their complete document status list for in-table actions and quick uploads.
    Query params: class_id, search, status (ALL / COMPLETE / PARTIAL / MISSING)
    """
    sid      = _school_id()
    class_id = request.args.get('class_id', type=int)
    search   = request.args.get('search', '').strip()
    status_f = request.args.get('status', 'ALL').upper()

    # Active requirements
    req_configs = get_school_doc_requirements(sid)
    required_types = [r.doc_type for r in req_configs if r.is_required]
    if not required_types:
        required_types = ['AADHAR_STUDENT', 'BIRTH_CERTIFICATE', 'PHOTO']

    q = db.session.query(Student, User)\
        .join(User, Student.user_id == User.id)\
        .filter(Student.school_id == sid)

    if class_id:
        q = q.filter(Student.class_id == class_id)

    if search:
        like = f"%{search}%"
        q = q.filter(
            db.or_(
                User.name.ilike(like),
                Student.admission_no.ilike(like),
                Student.roll_number.ilike(like),
                Student.parent_name.ilike(like),
                Student.father_name.ilike(like),
            )
        )

    results = q.order_by(Student.roll_number.asc(), User.name.asc()).all()
    if not results:
        return jsonify({'students': [], 'total': 0}), 200

    student_ids = [s.id for s, u in results]

    # Fetch all documents for these students
    docs = StudentDocument.query.filter(
        StudentDocument.school_id == sid,
        StudentDocument.student_id.in_(student_ids)
    ).order_by(StudentDocument.uploaded_at.desc()).all()

    docs_by_student = {}
    for d in docs:
        if d.student_id not in docs_by_student:
            docs_by_student[d.student_id] = []
        docs_by_student[d.student_id].append(d.to_dict())

    student_list = []
    for student, user in results:
        uploaded = docs_by_student.get(student.id, [])
        uploaded_types = {d['doc_type'] for d in uploaded}
        missing_required = [rt for rt in required_types if rt not in uploaded_types]

        if not uploaded:
            st = 'MISSING'
            pct = 0
        elif not missing_required:
            st = 'COMPLETE'
            pct = 100
        else:
            st = 'PARTIAL'
            matched = len(required_types) - len(missing_required)
            pct = round((matched / len(required_types) * 100), 1) if required_types else 100

        # Filter by status if requested
        if status_f != 'ALL':
            if status_f == 'COMPLETE' and st != 'COMPLETE':
                continue
            if status_f == 'PENDING' and st == 'COMPLETE':
                continue
            if status_f == 'MISSING' and st != 'MISSING':
                continue
            if status_f == 'PARTIAL' and st != 'PARTIAL':
                continue

        cls_name = ''
        if student.class_ref:
            cls_name = f"{student.class_ref.name} - {student.class_ref.section}".strip(' -')

        student_list.append({
            'student_id':             student.id,
            'name':                   user.name,
            'email':                  user.email or '',
            'admission_no':           student.admission_no or '—',
            'roll_number':            student.roll_number or '—',
            'parent_name':            student.parent_name or student.father_name or '—',
            'class_id':               student.class_id,
            'class_name':             cls_name,
            'photo_url':              student.photo_url or None,
            'uploaded_documents':     uploaded,
            'uploaded_count':         len(uploaded),
            'uploaded_types':         list(uploaded_types),
            'missing_required_types': missing_required,
            'status':                 st,
            'completion_pct':         pct,
        })

    return jsonify({
        'students':     student_list,
        'total':        len(student_list),
        'requirements': [r.to_dict() for r in req_configs],
    }), 200


# ─── 3. Configurable Document Requirements API ────────────────────────────────

@principal_bp.route('/documents/config', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_documents_config():
    """Get active document types and requirements for the school."""
    sid = _school_id()
    reqs = get_school_doc_requirements(sid)
    return jsonify({
        'requirements': [r.to_dict() for r in reqs],
        'available_doc_types': [{'value': k, 'label': v} for k, v in STUDENT_DOC_TYPE_LABELS.items()],
        'issued_doc_types':    [{'value': k, 'label': v} for k, v in ISSUED_DOC_TYPE_LABELS.items()],
    }), 200


@principal_bp.route('/documents/config', methods=['POST'])
@role_required('PRINCIPAL')
def update_documents_config():
    """
    Principal configures which documents are mandatory.
    Payload: { "requirements": [ { "doc_type": "...", "label": "...", "is_required": true/false } ] }
    """
    sid = _school_id()
    data = request.get_json() or {}
    items = data.get('requirements', [])

    if not items:
        return jsonify({'error': 'Requirements list cannot be empty'}), 400

    # Delete existing configs for this school
    SchoolDocumentRequirement.query.filter_by(school_id=sid).delete()

    created = []
    for idx, item in enumerate(items):
        doc_type = (item.get('doc_type') or '').strip().upper()
        if not doc_type:
            continue
        label = (item.get('label') or STUDENT_DOC_TYPE_LABELS.get(doc_type, doc_type)).strip()
        is_req = bool(item.get('is_required', False))

        obj = SchoolDocumentRequirement(
            school_id=sid,
            doc_type=doc_type,
            label=label,
            is_required=is_req,
            is_active=True,
            order_index=idx + 1
        )
        db.session.add(obj)
        created.append(obj)

    db.session.commit()
    return jsonify({
        'message': 'Document configuration updated successfully',
        'requirements': [r.to_dict() for r in created]
    }), 200


# ─── 4. Student-Specific Document List & Upload ───────────────────────────────

@principal_bp.route('/students/<int:student_id>/documents', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_student_documents(student_id):
    """Both school-issued and student-uploaded documents for a student."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    issued = IssuedDocument.query.filter_by(
        student_id=student_id, school_id=_school_id()
    ).order_by(IssuedDocument.issued_at.desc()).all()

    student_docs = StudentDocument.query.filter_by(
        student_id=student_id, school_id=_school_id()
    ).order_by(StudentDocument.uploaded_at.desc()).all()

    current_class = ''
    if student.class_ref:
        current_class = f"{student.class_ref.name} - {student.class_ref.section}".strip(' -')

    reqs = get_school_doc_requirements(_school_id())

    return jsonify({
        'issued_documents':      [d.to_dict() for d in issued],
        'student_documents':     [d.to_dict() for d in student_docs],
        'issued_doc_types':      ISSUED_DOC_TYPES,
        'student_doc_types':     STUDENT_DOC_TYPES,
        'student_current_class': current_class,
        'student_class_id':      student.class_id,
        'current_academic_year': _current_academic_year(),
        'requirements':          [r.to_dict() for r in reqs],
    }), 200


@principal_bp.route('/students/<int:student_id>/documents/student', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def upload_student_document(student_id):
    """Upload a KYC document for a student. PRINCIPAL + TEACHER can upload."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    doc_type = (request.form.get('doc_type') or '').strip().upper()
    if not doc_type:
        return jsonify({'error': 'doc_type is required'}), 400

    custom_label = (request.form.get('custom_label') or '').strip()
    if doc_type == 'OTHER' and not custom_label:
        return jsonify({'error': 'custom_label zaroori hai jab doc_type OTHER ho'}), 400

    title   = (request.form.get('title') or '').strip()
    remarks = (request.form.get('remarks') or '').strip()

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: file'}), 400

    try:
        file_url, file_name, file_size = _upload_file_to_cloudinary(
            file, f'eduerp/schools/{_school_id()}/students/{student_id}/kyc_documents'
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as ex:
        return jsonify({'error': f'Upload failed: {str(ex)}'}), 500

    curr = get_current_user()
    curr_role = getattr(curr.role, 'value', str(curr.role))

    # Replace existing document of same doc_type if exists (except for OTHER)
    if doc_type != 'OTHER':
        existing = StudentDocument.query.filter_by(
            school_id=_school_id(), student_id=student_id, doc_type=doc_type
        ).first()
    else:
        existing = None

    if existing:
        existing.file_url          = file_url
        existing.file_name         = file_name
        existing.file_size         = file_size
        existing.custom_label      = custom_label
        existing.title             = title or existing.title
        existing.remarks           = remarks or existing.remarks
        existing.uploaded_by       = curr.id
        existing.uploaded_by_role  = curr_role
        existing.uploaded_at       = datetime.utcnow()
        doc = existing
    else:
        doc = StudentDocument(
            school_id          = _school_id(),
            student_id         = student_id,
            doc_type           = doc_type,
            custom_label       = custom_label,
            title              = title,
            file_url           = file_url,
            file_name          = file_name,
            file_size          = file_size,
            class_id_at_upload = student.class_id,
            academic_year      = _current_academic_year(),
            uploaded_by        = curr.id,
            uploaded_by_role   = curr_role,
            remarks            = remarks,
        )
        db.session.add(doc)

    db.session.commit()
    return jsonify(doc.to_dict()), 201


@principal_bp.route('/documents/student/<int:doc_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_student_document(doc_id):
    """Only PRINCIPAL can delete student KYC documents."""
    doc = StudentDocument.query.get_or_404(doc_id)
    if doc.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'message': 'Document deleted successfully'}), 200


@principal_bp.route('/students/<int:student_id>/documents/issued', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def upload_issued_document(student_id):
    """School issues an official document to a student. PRINCIPAL + TEACHER can issue."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    doc_type = (request.form.get('doc_type') or '').strip().upper()
    if doc_type not in ISSUED_DOC_TYPES:
        return jsonify({'error': f'doc_type must be one of {ISSUED_DOC_TYPES}'}), 400

    custom_label = (request.form.get('custom_label') or '').strip()
    if doc_type == 'OTHER' and not custom_label:
        return jsonify({'error': 'custom_label zaroori hai jab doc_type OTHER ho'}), 400

    title   = (request.form.get('title') or '').strip()
    remarks = (request.form.get('remarks') or '').strip()
    is_visible = request.form.get('is_visible_to_student', 'true').lower() != 'false'

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: file'}), 400

    try:
        file_url, file_name, file_size = _upload_file_to_cloudinary(
            file, f'eduerp/schools/{_school_id()}/students/{student_id}/issued_documents'
        )
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as ex:
        return jsonify({'error': f'Upload failed: {str(ex)}'}), 500

    curr = get_current_user()
    doc = IssuedDocument(
        school_id             = _school_id(),
        student_id            = student_id,
        doc_type              = doc_type,
        custom_label          = custom_label,
        title                 = title,
        file_url              = file_url,
        file_name             = file_name,
        file_size             = file_size,
        class_id_at_issue     = student.class_id,
        academic_year         = _current_academic_year(),
        issued_by             = curr.id,
        remarks               = remarks,
        is_visible_to_student = is_visible,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc.to_dict()), 201


@principal_bp.route('/documents/issued/<int:doc_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_issued_document(doc_id):
    """Only PRINCIPAL can delete school-issued documents."""
    doc = IssuedDocument.query.get_or_404(doc_id)
    if doc.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'message': 'Document deleted successfully'}), 200


@principal_bp.route('/documents/students/all', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def list_all_students_documents():
    """
    Master repository: all KYC + issued docs across all students.
    Filters: search, doc_type, class_id, academic_year, category (kyc|issued|all)
    """
    sid             = _school_id()
    search          = request.args.get('search', '').strip()
    doc_type_filter = request.args.get('doc_type', '').strip().upper()
    class_id_filter = request.args.get('class_id', type=int)
    year_filter     = request.args.get('academic_year', '').strip()
    category        = request.args.get('category', 'all').lower()

    items = []

    if category in ('kyc', 'all'):
        q = db.session.query(StudentDocument, Student, User)\
            .join(Student, StudentDocument.student_id == Student.id)\
            .join(User, Student.user_id == User.id)\
            .filter(StudentDocument.school_id == sid)
        if doc_type_filter:
            q = q.filter(StudentDocument.doc_type == doc_type_filter)
        if class_id_filter:
            q = q.filter(Student.class_id == class_id_filter)
        if year_filter:
            q = q.filter(StudentDocument.academic_year == year_filter)
        if search:
            like = f"%{search}%"
            q = q.filter(db.or_(
                User.name.ilike(like),
                Student.admission_no.ilike(like),
                Student.roll_number.ilike(like),
                Student.parent_name.ilike(like),
                Student.father_name.ilike(like),
            ))
        for doc, student, user in q.order_by(StudentDocument.uploaded_at.desc()).limit(400).all():
            d = doc.to_dict()
            d['category']      = 'kyc'
            d['student_name']  = user.name
            d['admission_no']  = student.admission_no or '—'
            d['roll_number']   = student.roll_number or '—'
            d['parent_name']   = student.parent_name or student.father_name or '—'
            d['current_class'] = (
                f"{student.class_ref.name} - {student.class_ref.section}".strip(' -')
                if student.class_ref else '—'
            )
            items.append(d)

    if category in ('issued', 'all'):
        q2 = db.session.query(IssuedDocument, Student, User)\
            .join(Student, IssuedDocument.student_id == Student.id)\
            .join(User, Student.user_id == User.id)\
            .filter(IssuedDocument.school_id == sid)
        if doc_type_filter and doc_type_filter in ISSUED_DOC_TYPES:
            q2 = q2.filter(IssuedDocument.doc_type == doc_type_filter)
        if class_id_filter:
            q2 = q2.filter(Student.class_id == class_id_filter)
        if year_filter:
            q2 = q2.filter(IssuedDocument.academic_year == year_filter)
        if search:
            like = f"%{search}%"
            q2 = q2.filter(db.or_(
                User.name.ilike(like),
                Student.admission_no.ilike(like),
                Student.roll_number.ilike(like),
                Student.parent_name.ilike(like),
            ))
        for doc, student, user in q2.order_by(IssuedDocument.issued_at.desc()).limit(400).all():
            d = doc.to_dict()
            d['category']      = 'issued'
            d['student_name']  = user.name
            d['admission_no']  = student.admission_no or '—'
            d['roll_number']   = student.roll_number or '—'
            d['parent_name']   = student.parent_name or student.father_name or '—'
            d['current_class'] = (
                f"{student.class_ref.name} - {student.class_ref.section}".strip(' -')
                if student.class_ref else '—'
            )
            items.append(d)

    return jsonify({'documents': items, 'total': len(items)}), 200


# ─── 5. Issue Documents Workspace & Certificate Generator ─────────────────────

@principal_bp.route('/documents/templates', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_certificate_templates():
    """Get all available certificate templates with field configurations."""
    return jsonify({
        'templates': CERTIFICATE_TEMPLATES,
        'issued_doc_types': ISSUED_DOC_TYPES,
    }), 200


@principal_bp.route('/documents/issue-workspace', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_issue_documents_workspace():
    """
    Workspace endpoint for Issue Documents UI:
    - Filters by class_id, section, doc_type, status (ALL / ISSUED / NOT_ISSUED), search
    - Returns full student details, school branding info, class list, and issued certificates history
    """
    sid      = _school_id()
    class_id = request.args.get('class_id', type=int)
    section  = request.args.get('section', '').strip()
    doc_type = request.args.get('doc_type', '').strip().upper()
    status_f = request.args.get('status', 'ALL').upper()
    search   = request.args.get('search', '').strip()

    from app.models.school import School
    school = School.query.get(sid)
    school_info = school.to_dict() if school else {}

    # Query Classes
    all_classes = Class.query.filter_by(school_id=sid).order_by(Class.name.asc(), Class.section.asc()).all()
    classes_list = [{'id': c.id, 'name': c.name, 'section': c.section, 'display': f"{c.name} - {c.section}".strip(' -')} for c in all_classes]

    # Query Students
    q = db.session.query(Student, User)\
        .join(User, Student.user_id == User.id)\
        .filter(Student.school_id == sid)

    if class_id:
        q = q.filter(Student.class_id == class_id)
    if section and not class_id:
        q = q.join(Class, Student.class_id == Class.id).filter(Class.section == section)

    if search:
        like = f"%{search}%"
        q = q.filter(
            db.or_(
                User.name.ilike(like),
                Student.admission_no.ilike(like),
                Student.roll_number.ilike(like),
                Student.parent_name.ilike(like),
                Student.father_name.ilike(like),
                Student.mother_name.ilike(like),
            )
        )

    results = q.order_by(Student.roll_number.asc(), User.name.asc()).all()
    if not results:
        return jsonify({
            'students': [],
            'total': 0,
            'school': school_info,
            'classes': classes_list,
            'templates': CERTIFICATE_TEMPLATES,
            'current_session': _current_academic_year(),
        }), 200

    student_ids = [s.id for s, u in results]

    # Fetch all issued documents for these students
    issued_docs = IssuedDocument.query.filter(
        IssuedDocument.school_id == sid,
        IssuedDocument.student_id.in_(student_ids)
    ).order_by(IssuedDocument.issued_at.desc()).all()

    issued_by_student = {}
    for d in issued_docs:
        if d.student_id not in issued_by_student:
            issued_by_student[d.student_id] = []
        issued_by_student[d.student_id].append(d.to_dict())

    student_items = []
    for student, user in results:
        student_issued = issued_by_student.get(student.id, [])
        issued_types = {d['doc_type'] for d in student_issued}

        # Status filtering
        if status_f == 'ISSUED':
            if doc_type:
                if doc_type not in issued_types:
                    continue
            elif not student_issued:
                continue
        elif status_f == 'NOT_ISSUED':
            if doc_type:
                if doc_type in issued_types:
                    continue
            elif student_issued:
                continue

        cls_name = ''
        sec_name = ''
        if student.class_ref:
            cls_name = student.class_ref.name or ''
            sec_name = student.class_ref.section or ''

        student_items.append({
            'student_id':        student.id,
            'name':              user.name,
            'email':             user.email or '',
            'roll_number':       student.roll_number or '—',
            'admission_no':      student.admission_no or '—',
            'admission_date':    student.admission_date.isoformat() if student.admission_date else None,
            'dob':               student.dob.isoformat() if student.dob else None,
            'gender':            student.gender or '—',
            'blood_group':       student.blood_group or '—',
            'category':          student.category or 'General',
            'nationality':       student.nationality or 'Indian',
            'religion':          student.religion or '—',
            'parent_name':       student.parent_name or student.father_name or '—',
            'father_name':       student.father_name or student.parent_name or '—',
            'mother_name':       student.mother_name or '—',
            'father_occupation': student.father_occupation or '—',
            'mother_occupation': student.mother_occupation or '—',
            'parent_phone':      student.parent_phone or student.phone or '—',
            'address':           student.address or '—',
            'photo_url':         student.photo_url or None,
            'class_id':          student.class_id,
            'class_name':        cls_name,
            'section':           sec_name,
            'class_display':     f"{cls_name} - {sec_name}".strip(' -'),
            'issued_documents':  student_issued,
            'issued_count':      len(student_issued),
            'issued_types':      list(issued_types),
        })

    curr_yr = _current_academic_year()
    next_cert_numbers = {
        t['key']: _generate_next_certificate_no(sid, t['key'], curr_yr)
        for t in CERTIFICATE_TEMPLATES
    }

    return jsonify({
        'students':          student_items,
        'total':             len(student_items),
        'school':            school_info,
        'classes':           classes_list,
        'templates':         CERTIFICATE_TEMPLATES,
        'current_session':   curr_yr,
        'next_cert_numbers': next_cert_numbers,
    }), 200



def _generate_next_certificate_no(school_id, doc_type, academic_year=None):
    """
    Generate next auto-incrementing certificate number strictly scoped to school_id (multi-tenant).
    Format: {SCHOOL_CODE}/{TYPE_ABBR}/{YEAR}/{SEQ:04d}
    Monotonically increments based on highest sequence number issued so far, preventing duplicates.
    """
    from app.models.school import School
    school = School.query.get(school_id)
    scode = (school.code if school and school.code else f"{school_id:03d}").upper()
    type_abbr = doc_type.replace('_CERTIFICATE', '').replace('_', '')[:4]
    year = (academic_year or _current_academic_year() or '2026').replace('-', '')[:4]
    prefix = f"{scode}/{type_abbr}/{year}/"

    existing_docs = IssuedDocument.query.filter(
        IssuedDocument.school_id == school_id,
        IssuedDocument.certificate_no.like(f"{prefix}%")
    ).all()

    max_num = 0
    for d in existing_docs:
        if d.certificate_no and d.certificate_no.startswith(prefix):
            try:
                num_str = d.certificate_no[len(prefix):]
                num = int(num_str)
                if num > max_num:
                    max_num = num
            except Exception:
                pass

    next_seq = max_num + 1
    return f"{prefix}{next_seq:04d}"


@principal_bp.route('/students/<int:student_id>/issue-certificate', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def issue_student_certificate(student_id):
    """
    Issue an official certificate with dynamic fields, serial number, and live printable data.
    """
    sid = _school_id()
    student = Student.query.get_or_404(student_id)
    if student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # Accept either JSON or Form data (with optional file)
    if request.is_json:
        data = request.get_json() or {}
        file = None
    else:
        data = request.form.to_dict() or {}
        # Parse payload if sent as string
        if 'payload' in data and isinstance(data['payload'], str):
            try:
                data['payload'] = json.loads(data['payload'])
            except Exception:
                pass
        file = request.files.get('file')

    doc_type = (data.get('doc_type') or '').strip().upper()
    if not doc_type:
        return jsonify({'error': 'doc_type is required'}), 400

    title = (data.get('title') or '').strip()
    if not title:
        title = ISSUED_DOC_TYPE_LABELS.get(doc_type, doc_type.replace('_', ' ').title())

    custom_label = (data.get('custom_label') or '').strip()
    remarks      = (data.get('remarks') or '').strip()
    is_visible   = str(data.get('is_visible_to_student', 'true')).lower() != 'false'
    payload      = data.get('payload') or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}

    academic_year = _current_academic_year()
    cert_no = _generate_next_certificate_no(sid, doc_type, academic_year)

    # Handle file upload if provided
    file_url = ''
    file_name = ''
    file_size = None
    if file:
        try:
            file_url, file_name, file_size = _upload_file_to_cloudinary(
                file, f'eduerp/schools/{sid}/students/{student_id}/issued_documents'
            )
        except Exception as ex:
            return jsonify({'error': f'File upload failed: {str(ex)}'}), 400

    curr = get_current_user()

    doc = IssuedDocument(
        school_id             = sid,
        student_id            = student_id,
        doc_type              = doc_type,
        custom_label          = custom_label,
        title                 = title,
        certificate_no        = cert_no,
        file_url              = file_url,
        file_name             = file_name,
        file_size             = file_size,
        class_id_at_issue     = student.class_id,
        academic_year         = academic_year,
        issued_by             = curr.id,
        remarks               = remarks,
        is_visible_to_student = is_visible,
        payload_data          = json.dumps(payload),
    )
    db.session.add(doc)
    db.session.commit()

    return jsonify({
        'message': f'✅ {title} issued successfully!',
        'document': doc.to_dict(),
        'certificate_no': cert_no,
    }), 201



@principal_bp.route('/documents/issued/<int:doc_id>/certificate-data', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_issued_certificate_data(doc_id):
    """
    Returns complete printable & downloadable certificate data with school branding and student info.
    """
    sid = _school_id()
    doc = IssuedDocument.query.get_or_404(doc_id)
    if doc.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    student = Student.query.get(doc.student_id)
    user = User.query.get(student.user_id) if student else None
    from app.models.school import School
    school = School.query.get(sid)

    # Match template definition
    template = next((t for t in CERTIFICATE_TEMPLATES if t['key'] == doc.doc_type), None)

    return jsonify({
        'document': doc.to_dict(),
        'student': {
            'id':             student.id,
            'name':           user.name if user else '',
            'admission_no':   student.admission_no or '—',
            'roll_number':    student.roll_number or '—',
            'dob':            student.dob.isoformat() if student.dob else None,
            'gender':         student.gender or '—',
            'parent_name':    student.parent_name or student.father_name or '—',
            'father_name':    student.father_name or student.parent_name or '—',
            'mother_name':    student.mother_name or '—',
            'nationality':    student.nationality or 'Indian',
            'religion':       student.religion or '—',
            'class_name':     student.class_ref.name if student.class_ref else '',
            'section':        student.class_ref.section if student.class_ref else '',
            'class_display':  f"{student.class_ref.name} - {student.class_ref.section}".strip(' -') if student.class_ref else '',
            'photo_url':      student.photo_url or None,
            'admission_date': student.admission_date.isoformat() if student.admission_date else None,
        },
        'school': school.to_dict() if school else {},
        'template': template,
        'payload': doc.get_payload(),
    }), 200



# ═══════════════════════════════════════════════════════════════════════════
#  DATA HEALTH — Receipt Reconciliation

# ═══════════════════════════════════════════════════════════════════════════
# Yeh permanent maintenance tool hai — production mein safe hai, idempotent hai
# (dobara chalane se kuch nahi badalta agar already sahi ho). Purpose: kabhi
# bhi agar kisi collect-fee flow (hostel/principal/future modules) mein
# receipt_no generation ka bug aa jaye aur FeeRecord.receipt_no vs
# FeeTransaction.receipt_no mismatch ho jaye, isse ek click mein fix ho jata hai.

# ═══════════════════════════════════════════════════════════════════════════
#  NEW — Dashboard Widget Counts (Tasks & Approvals sidebar cards)
# ═══════════════════════════════════════════════════════════════════════════

@principal_bp.route('/fees/concessions/pending-count', methods=['GET'])
@permission_required('fees.reports.view')
def fee_concessions_pending_count():
    """
    Dashboard tile — 'Fee Concessions'.
    Definition (koi naya column/migration nahi chahiye): FeeRecord jinpe
    discount lag chuka hai (discount > 0), record abhi bhi unpaid/partial
    hai, aur discount ISI calendar month mein apply hua hai — matlab
    'recently granted, payment abhi settle nahi hua' cases.

    Agar tumhe ek REAL approval-workflow chahiye (jahan Teacher/Accountant
    discount REQUEST kare aur Principal Approve/Reject kare), to FeeRecord
    mein naya column chahiye hoga: concession_status
    ENUM('REQUESTED','APPROVED','REJECTED') — bata dena, migration bhi
    bana dunga.
    """
    sid = _school_id()
    today = date.today()
    month_start = date(today.year, today.month, 1)

    count = FeeRecord.query.filter(
        FeeRecord.school_id == sid,
        FeeRecord.discount > 0,
        FeeRecord.status.in_(['PENDING', 'PARTIAL']),
        FeeRecord.adjusted_at.isnot(None),
        FeeRecord.adjusted_at >= month_start,
    ).count()

    return jsonify({'count': count}), 200


@principal_bp.route('/admissions/recent-count', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def admissions_recent_count():
    """
    Dashboard tile — 'New Admissions'.
    Definition: is school mein last N din (default 7) mein banaye gaye
    students ki count — User.created_at use karke (Student ka apna
    created_at field nahi hai, User se aata hai).
    Query param ?days=14 se window badal sakte ho.
    """
    sid  = _school_id()
    days = request.args.get('days', 7, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    count = Student.query.join(User, Student.user_id == User.id) \
        .filter(Student.school_id == sid, User.created_at >= since) \
        .count()

    return jsonify({'count': count, 'days': days}), 200


@principal_bp.route('/documents/requests/pending-count', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def document_requests_pending_count():
    """
    Dashboard tile — 'Document Requests'.
    Definition (koi naya schema nahi chahiye): un students ki count jinke
    paas MANDATORY KYC documents (Aadhar, Birth Certificate) StudentDocument
    table mein abhi tak upload nahi hue — 'follow-up needed' count hai,
    ek TRUE request-approval count nahi.

    Agar tumhe actual 'student/parent ne document ke liye REQUEST daali,
    Principal approve kare' wala feature chahiye (jaise TC/Bonafide),
    wo ek NAYA feature hai — DocumentRequest model (student_id, doc_type,
    status, requested_at) + create/list/approve routes chahiye honge.
    Bol do, wo bhi bana dunga.
    """
    sid = _school_id()
    MANDATORY_DOC_TYPES = ['AADHAR', 'BIRTH_CERTIFICATE']

    student_tuples = db.session.query(Student.id).filter_by(school_id=sid).all()
    if not student_tuples:
        return jsonify({'count': 0}), 200

    student_ids = [s_id for (s_id,) in student_tuples]
    have_docs = db.session.query(
        StudentDocument.student_id, StudentDocument.doc_type
    ).filter(
        StudentDocument.school_id == sid,
        StudentDocument.student_id.in_(student_ids),
        StudentDocument.doc_type.in_(MANDATORY_DOC_TYPES),
    ).all()

    submitted_map = {}
    for sid_, dtype in have_docs:
        submitted_map.setdefault(sid_, set()).add(dtype)

    missing_count = sum(
        1 for s_id in student_ids
        if len(submitted_map.get(s_id, set())) < len(MANDATORY_DOC_TYPES)
    )

    return jsonify({'count': missing_count}), 200


@principal_bp.route('/fees/reconcile-receipts', methods=['POST'])
@permission_required('fees.structure.manage')
def reconcile_fee_receipts():
    """
    Har FeeRecord jiska receipt_no set hai, uske saare linked FeeTransaction
    rows ka receipt_no usi se match karta hai (agar mismatch ho). Ye sirf
    fix karta hai — data delete/create nahi karta, isliye production-safe hai.
    """
    sid = _school_id()

    records = FeeRecord.query.filter(
        FeeRecord.school_id == sid,
        FeeRecord.receipt_no.isnot(None),
    ).all()

    fixed_records = 0
    fixed_transactions = 0

    for rec in records:
        txns = FeeTransaction.query.filter_by(fee_record_id=rec.id).all()
        record_touched = False
        for txn in txns:
            if txn.receipt_no != rec.receipt_no:
                txn.receipt_no = rec.receipt_no
                fixed_transactions += 1
                record_touched = True
        if record_touched:
            fixed_records += 1

    db.session.commit()

    return jsonify({
        'message': f'{fixed_transactions} transaction(s) reconciled across {fixed_records} fee record(s)',
        'fixed_records': fixed_records,
        'fixed_transactions': fixed_transactions,
    }), 200
