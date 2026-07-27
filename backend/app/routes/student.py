from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func
from app import db
from app.models.academic import Student, Attendance, Marks
from app.models.financial import FeeRecord, ExamSchedule
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


@student_bp.route('/marks', methods=['GET'])
@role_required('STUDENT')
def my_marks():
    user    = get_current_user()
    student = Student.query.filter_by(user_id=user.id).first()
    if not student:
        return jsonify({'error': 'Not found'}), 404

    exam_id   = request.args.get('exam_id', type=int)
    exam_type = request.args.get('exam_type')

    # ── Detailed report-card view for one exam ──
    if exam_id:
        if not _class_result_is_published(exam_id, student.class_id):
            return jsonify({'error': 'Result is not published yet', 'published': False}), 403
        marks = Marks.query.filter_by(student_id=student.id, exam_id=exam_id).all()
        total_obtained = sum(m.marks_obtained for m in marks if not m.is_absent)
        total_max      = sum(m.max_marks for m in marks if not m.is_absent)
        pct  = round(total_obtained / total_max * 100, 2) if total_max else 0
        exam = ExamSchedule.query.get(exam_id)
        return jsonify({
            'exam':           exam.to_dict() if exam else None,
            'subjects':       [m.to_dict() for m in marks],
            'total_obtained': total_obtained,
            'total_max':      total_max,
            'percentage':     pct,
            'grade':          _grade(total_obtained, total_max),
            'result':         'PASS' if pct >= 33 else 'FAIL',
        }), 200

    # ── Legacy: flat list filtered by exam_type string (old frontend calls) ──
    # NOTE: these rows predate the exam_id/publish-workflow link, so there is
    # no per-class publication row to check — kept as-is for back-compat.
    if exam_type:
        q = Marks.query.filter_by(student_id=student.id, exam_type=exam_type)
        return jsonify([m.to_dict() for m in q.all()]), 200

    # ── Default: summary across every PUBLISHED exam this student has marks for ──
    rows = db.session.query(
        Marks.exam_id,
        func.sum(Marks.marks_obtained),
        func.sum(Marks.max_marks),
    ).filter(
        Marks.student_id == student.id,
        Marks.exam_id.isnot(None),
        Marks.is_absent == False,
    ).group_by(Marks.exam_id).all()

    exams_summary = []
    for ex_id, total_obtained, total_max in rows:
        if not _class_result_is_published(ex_id, student.class_id):
            continue
        exam = ExamSchedule.query.get(ex_id)
        pct  = round(total_obtained / total_max * 100, 2) if total_max else 0
        exams_summary.append({
            'exam_id':        ex_id,
            'exam_name':      exam.exam_name if exam else '',
            'session':        exam.session   if exam else '',
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
