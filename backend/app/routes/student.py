from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from app import db
from app.models.academic import Student, Attendance, Marks, Class
from app.models.financial import FeeRecord, ExamSchedule
from app.models.documents import StudentDocument, IssuedDocument
from app.utils.decorators import role_required, get_current_user
from app.routes.marks import _grade


student_bp = Blueprint('student', __name__)


@student_bp.route('/profile', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_profile():
    user    = get_current_user()
    student = Student.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({'error': 'Student profile not found'}), 404
    return jsonify(student.to_dict()), 200


@student_bp.route('/attendance', methods=['GET'])
@role_required('STUDENT')
def my_attendance():
    user    = get_current_user()
    student = Student.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({'error': 'Not found'}), 404
    records = Attendance.query.filter_by(student_id=student.id).order_by(Attendance.date.desc()).all()
    total   = len(records)
    present = sum(1 for r in records if r.status == 'PRESENT')
    return jsonify({
        'total_days': total, 'present': present, 'absent': total - present,
        'percentage': round(present / total * 100, 1) if total else 0,
        'records': [r.to_dict() for r in records[:30]]  # last 30 days
    }), 200


def _class_result_is_published(exam_id, class_id):
    """
    RMS visibility gate (Result Management spec section 12/13): a
    student/parent may only see marks once the Principal has published
    that class's result for that exam.
    ClassResultPublication (app.routes.result_management) is the source of
    truth. If no row exists yet for an exam (e.g. marks entered the old way,
    before this table existed), we fall back to ExamSchedule.is_published so
    nothing that was already visible before this fix silently disappears.
    """
    from app.routes.result_management import ClassResultPublication
    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first()
    if pub:
        return pub.status == 'PUBLISHED'
    exam = ExamSchedule.query.get(exam_id)
    return bool(exam and exam.is_published)


@student_bp.route('/children', methods=['GET'])
@role_required('PARENT', 'STUDENT')
def my_children():
    user = get_current_user()
    if getattr(user.role, 'value', str(user.role)) == 'STUDENT':
        s = Student.query.filter_by(user_id=user.id).first()
        return jsonify([s.to_dict()] if s else []), 200

    # Parent: find all students matching email or phone or user_id
    students = Student.query.filter(
        (Student.parent_email == user.email) |
        (Student.parent_phone == user.phone) |
        (Student.user_id == user.id)
    ).all()
    return jsonify([s.to_dict() for s in students]), 200


@student_bp.route('/marks', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_marks():
    user = get_current_user()
    student_id = request.args.get('student_id', type=int)

    if getattr(user.role, 'value', str(user.role)) == 'PARENT':
        if student_id:
            student = Student.query.get(student_id)
            if not student or (student.parent_email != user.email and student.parent_phone != user.phone and student.user_id != user.id):
                return jsonify({'error': 'Unauthorized child access'}), 403
        else:
            student = Student.query.filter(
                (Student.parent_email == user.email) |
                (Student.parent_phone == user.phone) |
                (Student.user_id == user.id)
            ).first()
    else:
        student = Student.query.filter_by(user_id=user.id).first()

    if not student:
        return jsonify({'error': 'Student profile not found'}), 404

    exam_id   = request.args.get('exam_id', type=int)
    exam_type = request.args.get('exam_type')
    session_filter = request.args.get('session')

    # ── Detailed report-card view for one exam ──
    if exam_id:
        marks = Marks.query.filter_by(student_id=student.id, exam_id=exam_id).all()
        # Find the historical class_id where exam was taken (marks.class_id or student.class_id)
        effective_class_id = (marks[0].class_id if marks and marks[0].class_id else student.class_id)
        
        if not _class_result_is_published(exam_id, effective_class_id):
            return jsonify({'error': 'Result is not published yet', 'published': False}), 403

        total_obtained = sum(m.marks_obtained for m in marks if not m.is_absent and m.marks_obtained is not None)
        total_max      = sum(m.max_marks for m in marks if not m.is_absent and m.max_marks is not None)
        pct  = round(total_obtained / total_max * 100, 2) if total_max else 0
        exam = ExamSchedule.query.get(exam_id)
        return jsonify({
            'exam':           exam.to_dict() if exam else None,
            'student':        student.to_dict(),
            'subjects':       [m.to_dict() for m in marks],
            'total_obtained': total_obtained,
            'total_max':      total_max,
            'percentage':     pct,
            'grade':          _grade(total_obtained, total_max),
            'result':         'PASS' if pct >= 33 else 'FAIL',
        }), 200

    # ── Legacy: flat list filtered by exam_type string (old frontend calls) ──
    if exam_type:
        q = Marks.query.filter_by(student_id=student.id, exam_type=exam_type)
        return jsonify([m.to_dict() for m in q.all()]), 200

    # ── Default: summary across every PUBLISHED exam this student has marks for ──
    q_marks = Marks.query.filter(
        Marks.student_id == student.id,
        Marks.exam_id.isnot(None),
        Marks.is_absent == False,
    )
    
    rows = db.session.query(
        Marks.exam_id,
        Marks.class_id,
        func.sum(Marks.marks_obtained),
        func.sum(Marks.max_marks),
    ).filter(
        Marks.student_id == student.id,
        Marks.exam_id.isnot(None),
        Marks.is_absent == False,
    ).group_by(Marks.exam_id, Marks.class_id).all()

    exams_summary = []
    for ex_id, cls_id, total_obtained, total_max in rows:
        target_class_id = cls_id or student.class_id
        if not _class_result_is_published(ex_id, target_class_id):
            continue
        exam = ExamSchedule.query.get(ex_id)
        if session_filter and exam and exam.session != session_filter:
            continue
        pct  = round(total_obtained / total_max * 100, 2) if total_max else 0
        cls_obj = Class.query.get(target_class_id)
        exams_summary.append({
            'exam_id':        ex_id,
            'exam_name':      exam.exam_name if exam else '',
            'session':        exam.session   if exam else '',
            'class_id':       target_class_id,
            'class_name':     f"{cls_obj.name} - {cls_obj.section}" if cls_obj else '',
            'total_obtained': total_obtained,
            'total_max':      total_max,
            'percentage':     pct,
            'grade':          _grade(total_obtained, total_max),
        })

    return jsonify(exams_summary), 200


@student_bp.route('/fees', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_fees():
    user    = get_current_user()
    student = Student.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({'error': 'Not found'}), 404
    # NEW
    records  = FeeRecord.query.filter_by(student_id=student.id)\
                 .filter(FeeRecord.status != 'DRAFT').all()
    total_due   = sum(r.amount_due for r in records if r.status != 'CANCELLED')
    total_paid  = sum(r.amount_paid for r in records if r.status != 'CANCELLED')
    return jsonify({
        'total_due': total_due, 'total_paid': total_paid,
        'balance': total_due - total_paid,
        'records': [r.to_dict() for r in records]
    }), 200


# ─── Student / Parent: My Documents ────────────────────────────────────────────

@student_bp.route('/documents', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_documents():
    """
    Student sees their own KYC documents + school-issued documents.
    Parent sees documents of their linked child(ren).
    """
    user = get_current_user()
    role = getattr(user.role, 'value', str(user.role))

    if role == 'STUDENT':
        student = Student.query.filter_by(user_id=user.id).first()
        if not student:
            return jsonify({'error': 'Student profile not found'}), 404
        students = [student]
    else:  # PARENT
        student_id = request.args.get('student_id', type=int)
        if student_id:
            student = Student.query.get(student_id)
            if not student or (
                student.parent_email != user.email and
                student.parent_phone != user.phone and
                student.user_id != user.id
            ):
                return jsonify({'error': 'Unauthorized'}), 403
            students = [student]
        else:
            students = Student.query.filter(
                (Student.parent_email == user.email) |
                (Student.parent_phone == user.phone) |
                (Student.user_id == user.id)
            ).all()

    result = []
    for student in students:
        kyc_docs = StudentDocument.query.filter_by(student_id=student.id).order_by(StudentDocument.uploaded_at.desc()).all()
        issued_docs = IssuedDocument.query.filter_by(
            student_id=student.id, is_visible_to_student=True
        ).order_by(IssuedDocument.issued_at.desc()).all()

        current_class = ''
        if student.class_ref:
            current_class = f"{student.class_ref.name} - {student.class_ref.section}".strip(' -')

        result.append({
            'student_id':        student.id,
            'student_name':      student.user.name if student.user else '',
            'current_class':     current_class,
            'kyc_documents':     [d.to_dict() for d in kyc_docs],
            'issued_documents':  [d.to_dict() for d in issued_docs],
        })

    return jsonify({'data': result, 'count': len(result)}), 200


@student_bp.route('/documents/upload', methods=['POST'])
@role_required('STUDENT')
def upload_my_document():
    """Student uploads their own KYC document (Aadhaar, birth cert, etc.)."""
    import os, cloudinary.uploader
    from datetime import datetime

    user = get_current_user()
    student = Student.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({'error': 'Student profile not found'}), 404

    STUDENT_DOC_TYPES = [
        'AADHAR', 'AADHAR_STUDENT', 'AADHAR_PARENT', 'RATION_CARD',
        'BIRTH_CERTIFICATE', 'CASTE_CERTIFICATE', 'TRANSFER_CERTIFICATE',
        'REPORT_CARD', 'ADDRESS_PROOF', 'MEDICAL_CERTIFICATE', 'OTHER'
    ]

    doc_type = (request.form.get('doc_type') or '').strip().upper()
    if doc_type not in STUDENT_DOC_TYPES:
        return jsonify({'error': f'doc_type must be one of {STUDENT_DOC_TYPES}'}), 400

    custom_label = (request.form.get('custom_label') or '').strip()
    if doc_type == 'OTHER' and not custom_label:
        return jsonify({'error': 'custom_label required for OTHER type'}), 400

    title   = (request.form.get('title') or '').strip()
    remarks = (request.form.get('remarks') or '').strip()

    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'File required — field name: file'}), 400

    # 10 MB limit
    try:
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 10 * 1024 * 1024:
            return jsonify({'error': 'File size must be under 10 MB'}), 400
    except Exception:
        size = None

    result = cloudinary.uploader.upload(
        file,
        folder=f'eduerp/schools/{student.school_id}/students/{student.id}/kyc_self_uploaded',
        resource_type='auto',
        use_filename=True,
        unique_filename=True,
    )

    # Auto-detect academic year
    from datetime import date
    today = date.today()
    academic_year = (f"{today.year}-{str(today.year+1)[2:]}" if today.month >= 4
                     else f"{today.year-1}-{str(today.year)[2:]}")

    # Replace if same doc_type already exists
    existing = StudentDocument.query.filter_by(
        school_id=student.school_id,
        student_id=student.id,
        doc_type=doc_type
    ).first()

    if existing:
        existing.file_url        = result['secure_url']
        existing.file_name       = file.filename
        existing.file_size       = size
        existing.custom_label    = custom_label
        existing.title           = title or existing.title
        existing.remarks         = remarks or existing.remarks
        existing.uploaded_by     = user.id
        existing.uploaded_by_role = 'STUDENT'
        existing.uploaded_at     = datetime.utcnow()
        doc = existing
    else:
        doc = StudentDocument(
            school_id          = student.school_id,
            student_id         = student.id,
            doc_type           = doc_type,
            custom_label       = custom_label,
            title              = title,
            file_url           = result['secure_url'],
            file_name          = file.filename,
            file_size          = size,
            class_id_at_upload = student.class_id,
            academic_year      = academic_year,
            uploaded_by        = user.id,
            uploaded_by_role   = 'STUDENT',
            remarks            = remarks,
        )
        db.session.add(doc)

    db.session.commit()
    return jsonify(doc.to_dict()), 201


@student_bp.route('/library', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_student_library():
    """Returns the student's active library loans, overdue books, penalties, and history."""
    from app.routes.library import my_library
    return my_library()


@student_bp.route('/hostel', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_student_hostel():
    """
    Returns the student's active hostel allocation, room info, roommates,
    monthly fee ledger, fines, out-passes, complaints, and attendance summary.
    """
    from app.models.hostel import (
        Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
        HostelBedAllocation, HostelFineRecord, HostelComplaint,
        HostelOutPass, HostelAttendance
    )
    user = get_current_user()
    student_id = request.args.get('student_id')

    if user.role.value == 'PARENT':
        if not student_id:
            return jsonify({'error': 'student_id is required for parent'}), 400
        student = Student.query.get_or_404(student_id)
        if student.school_id != user.school_id:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        student = Student.query.filter_by(user_id=user.id).first()
        if not student:
            return jsonify({'error': 'Student record not found'}), 404

    sid = student.school_id
    active_alloc = HostelBedAllocation.query.filter_by(
        student_id=student.id, status='ACTIVE'
    ).first()

    current_allocation = None
    roommates = []

    if active_alloc:
        h = Hostel.query.get(active_alloc.hostel_id)
        b = HostelBuilding.query.get(active_alloc.building_id)
        f = HostelFloor.query.get(active_alloc.floor_id)
        r = HostelRoom.query.get(active_alloc.room_id)
        bd = HostelBed.query.get(active_alloc.bed_id)

        warden = h.warden if h else None

        current_allocation = {
            'allocation_id':          active_alloc.id,
            'hostel_id':              h.id if h else None,
            'hostel_name':            h.name if h else '',
            'hostel_type':            h.hostel_type if h else '',
            'building_name':          b.name if b else '',
            'floor_name':             f.name if f else '',
            'room_id':                r.id if r else None,
            'room_number':            r.room_number if r else '',
            'room_type':              r.room_type if r else '',
            'is_ac':                  r.is_ac if r else False,
            'has_attached_bath':      r.has_attached_bath if r else False,
            'has_wifi':               r.has_wifi if r else False,
            'has_study_table':        r.has_study_table if r else False,
            'has_cupboard':           r.has_cupboard if r else False,
            'has_balcony':            r.has_balcony if r else False,
            'bed_number':             bd.bed_number if bd else '',
            'admission_date':         str(active_alloc.admission_date) if active_alloc.admission_date else None,
            'checkin_date':           str(active_alloc.checkin_date) if active_alloc.checkin_date else None,
            'expected_checkout_date': str(active_alloc.expected_checkout_date) if active_alloc.expected_checkout_date else None,
            'warden_name':            warden.name if warden else (h.warden_id or 'Assigned Warden'),
            'warden_contact':         h.contact_number if h else '',
            'warden_email':           h.contact_email if h else '',
        }

        # Room mates in the same room
        if r:
            other_beds = HostelBed.query.filter(
                HostelBed.room_id == r.id,
                HostelBed.current_student_id.isnot(None),
                HostelBed.current_student_id != student.id
            ).all()
            for ob in other_beds:
                mate_student = Student.query.get(ob.current_student_id)
                if mate_student and mate_student.user:
                    mate_cls = Class.query.get(mate_student.class_id) if mate_student.class_id else None
                    roommates.append({
                        'name':        mate_student.user.name,
                        'roll_number': mate_student.roll_number or '',
                        'class_name':  f"{mate_cls.name} - {mate_cls.section}" if mate_cls else '',
                        'bed_number':  ob.bed_number,
                    })

    # Monthly fee records
    fee_records = FeeRecord.query.filter_by(
        school_id=sid, student_id=student.id, fee_type='HOSTEL', source='HOSTEL'
    ).order_by(FeeRecord.created_at.desc()).all()

    fees_list = []
    total_fee_dues = 0.0
    for fr in fee_records:
        eff_due = fr.effective_due()
        paid = fr.amount_paid or 0.0
        pending = max(0.0, round(eff_due - paid, 2))
        if fr.status in ('PENDING', 'PARTIAL'):
            total_fee_dues += pending
        fees_list.append({
            'id':           fr.id,
            'month':        fr.month,
            'amount_due':   eff_due,
            'amount_paid':  paid,
            'pending':      pending,
            'status':       fr.status,
            'due_date':     str(fr.due_date) if fr.due_date else '',
            'paid_date':    str(fr.paid_date) if fr.paid_date else '',
            'receipt_no':   fr.receipt_no or '',
            'payment_mode': fr.payment_mode or '',
        })

    # Fines & Penalties
    fines = HostelFineRecord.query.filter_by(
        school_id=sid, student_id=student.id
    ).order_by(HostelFineRecord.raised_date.desc()).all()

    fines_list = [f.to_dict() for f in fines]
    total_fine_dues = sum(f.outstanding_amount for f in fines)

    # Out-passes
    out_passes = HostelOutPass.query.filter_by(
        school_id=sid, student_id=student.id
    ).order_by(HostelOutPass.created_at.desc()).limit(30).all()

    # Complaints
    complaints = HostelComplaint.query.filter_by(
        school_id=sid, student_id=student.id
    ).order_by(HostelComplaint.created_at.desc()).limit(30).all()

    # Attendance
    att_records = HostelAttendance.query.filter_by(
        school_id=sid, student_id=student.id
    ).order_by(HostelAttendance.attendance_date.desc()).limit(60).all()

    att_total = len(att_records)
    att_present = sum(1 for a in att_records if a.status == 'PRESENT')

    return jsonify({
        'has_hostel':             bool(active_alloc),
        'current_allocation':     current_allocation,
        'roommates':              roommates,
        'total_outstanding_dues': round(total_fee_dues + total_fine_dues, 2),
        'total_fee_dues':         round(total_fee_dues, 2),
        'total_fine_dues':        round(total_fine_dues, 2),
        'monthly_fees':           fees_list,
        'fines':                  fines_list,
        'out_passes':             [op.to_dict() for op in out_passes],
        'complaints':             [c.to_dict() for c in complaints],
        'attendance': {
            'total_nights':  att_total,
            'present_count': att_present,
            'percentage':    round((att_present / att_total) * 100, 1) if att_total else 100.0,
            'recent_records': [a.to_dict() for a in att_records[:15]],
        }
    }), 200

