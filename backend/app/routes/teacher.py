from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename
from app import db
from app.models.academic import Attendance, Marks, Note, Student, Class
from app.utils.decorators import role_required, get_current_user
from datetime import date
import os
import cloudinary.uploader
teacher_bp = Blueprint('teacher', __name__)


# ─── Attendance ───────────────────────────────────────────────────────────────

@teacher_bp.route('/attendance', methods=['POST'])
@role_required('TEACHER')
def mark_attendance():
    """Mark attendance for entire class for a date."""
    data = request.get_json() or {}
    class_id    = data.get('class_id')
    raw_date    = data.get('date')
    records     = data.get('records', [])   # [{'student_id': 1, 'status': 'PRESENT'}, ...]
    user        = get_current_user()

    if not class_id or not raw_date or not records:
        return jsonify({'error': 'class_id, date, and records are required'}), 400

    # Multi-tenant scoping: verify class belongs to teacher's school
    cls = Class.query.filter_by(id=class_id, school_id=user.school_id).first()
    if not cls:
        return jsonify({'error': 'Class not found or unauthorized'}), 403

    try:
        att_date = date.fromisoformat(raw_date)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid date format'}), 400

    marked_count = 0
    for rec in records:
        s_id = rec.get('student_id')
        if not s_id:
            continue
        # Verify student belongs to this school
        student = Student.query.filter_by(id=s_id, school_id=user.school_id).first()
        if not student:
            return jsonify({'error': f'Student ID {s_id} does not belong to this school'}), 400

        existing = Attendance.query.filter_by(student_id=s_id, date=att_date).first()
        if existing:
            existing.status = rec.get('status', 'PRESENT')
        else:
            a = Attendance(student_id=s_id, class_id=class_id,
                           date=att_date, status=rec.get('status', 'PRESENT'), marked_by=user.id,
                           remarks=rec.get('remarks', ''))
            db.session.add(a)
        marked_count += 1

    db.session.commit()
    return jsonify({'message': f'Attendance marked for {marked_count} students'}), 200


@teacher_bp.route('/attendance/<int:class_id>', methods=['GET'])
@role_required('TEACHER')
def get_attendance(class_id):
    user = get_current_user()
    cls = Class.query.filter_by(id=class_id, school_id=user.school_id).first()
    if not cls:
        return jsonify({'error': 'Class not found or unauthorized'}), 403

    att_date = request.args.get('date', str(date.today()))
    records = Attendance.query.filter_by(class_id=class_id, date=att_date).all()
    return jsonify([r.to_dict() for r in records]), 200


@teacher_bp.route('/attendance/monthly/<int:student_id>', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def monthly_attendance(student_id):
    user = get_current_user()
    student = Student.query.filter_by(id=student_id, school_id=user.school_id).first()
    if not student:
        return jsonify({'error': 'Student not found or unauthorized'}), 404

    month = request.args.get('month')  # e.g. "2024-04"
    records = Attendance.query.filter_by(student_id=student_id).all()
    if month:
        records = [r for r in records if str(r.date).startswith(month)]
    total   = len(records)
    present = sum(1 for r in records if r.status == 'PRESENT')
    return jsonify({
        'total_days': total, 'present': present,
        'absent': total - present,
        'percentage': round(present / total * 100, 1) if total else 0,
        'records': [r.to_dict() for r in records]
    }), 200


# ─── Marks ────────────────────────────────────────────────────────────────────

@teacher_bp.route('/marks', methods=['POST'])
@role_required('TEACHER')
def enter_marks():
    """
    DEPRECATED — superseded by POST /api/marks/save, which is exam-linked
    (exam_id), supports is_absent, and is validated through /api/marks/roster.
    Kept only for backward compatibility with any old frontend calls.
    Tenant check + denormalized columns added so old entries stay consistent
    with the new Marks Management module.
    """
    data    = request.get_json()
    user    = get_current_user()
    entries = data['entries']  # [{'student_id':1,'subject_id':2,'marks_obtained':85,'max_marks':100}, ...]
    exam_type = data.get('exam_type', 'Mid Term')

    saved = 0
    for e in entries:
        student = Student.query.get(e['student_id'])
        if not student or student.school_id != user.school_id:
            continue  # tenant check — skip rows that don't belong to this school

        existing = Marks.query.filter_by(
            student_id=e['student_id'], subject_id=e['subject_id'],
            exam_type=exam_type, exam_id=None
        ).first()
        if existing:
            existing.marks_obtained = e['marks_obtained']
            existing.max_marks      = e['max_marks']
            existing.grade          = _grade(e['marks_obtained'], e['max_marks'])
        else:
            m = Marks(student_id=e['student_id'], subject_id=e['subject_id'],
                      exam_type=exam_type, marks_obtained=e['marks_obtained'],
                      max_marks=e['max_marks'], grade=_grade(e['marks_obtained'], e['max_marks']),
                      class_id=student.class_id, school_id=student.school_id,
                      entered_by=user.id)
            db.session.add(m)
        saved += 1
    db.session.commit()
    return jsonify({'message': f'{saved} marks saved'}), 200


@teacher_bp.route('/marks/<int:class_id>', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def get_marks(class_id):
    """
    DEPRECATED — superseded by GET /api/marks/roster, which is exam-linked
    and pre-fills existing marks for the entry grid.
    Kept only for backward compatibility. Tenant check added (previously
    any logged-in teacher/principal could read another school's class by ID).
    """
    user = get_current_user()
    exam_type = request.args.get('exam_type')
    from sqlalchemy.orm import joinedload
    from app.models.academic import Class as ClassModel

    cls = ClassModel.query.get_or_404(class_id)
    if cls.school_id != user.school_id:
        return jsonify({'error': 'Unauthorized'}), 403

    students = Student.query.options(
        joinedload(Student.user)
    ).filter_by(class_id=class_id).all()

    student_ids = [s.id for s in students]

    # Single query for all marks
    marks_q = Marks.query.filter(Marks.student_id.in_(student_ids))
    if exam_type:
        marks_q = marks_q.filter_by(exam_type=exam_type)
    all_marks = marks_q.all()

    # Group marks by student_id in memory
    from collections import defaultdict
    marks_map = defaultdict(list)
    for m in all_marks:
        marks_map[m.student_id].append(m.to_dict())

    result = [
        {'student': s.to_dict(), 'marks': marks_map[s.id]}
        for s in students
    ]
    return jsonify(result), 200


# ─── Notes Upload ─────────────────────────────────────────────────────────────

ALLOWED_EXT = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'png', 'jpg'}

def _allowed(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT


@teacher_bp.route('/notes', methods=['POST'])
@role_required('TEACHER')
def upload_note():
    

    
    user       = get_current_user()
    title      = request.form.get('title')
    subject_id = request.form.get('subject_id')
    class_id   = request.form.get('class_id')
    description= request.form.get('description', '')
    file       = request.files.get('file')

    if not file or not _allowed(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    filename = secure_filename(file.filename)

    # Upload to Cloudinary as raw file (PDF, DOC etc.)
    result = cloudinary.uploader.upload(
        file,
        folder        = 'eduerp/notes',
        public_id     = f'note_{user.school_id}_{filename}',
        resource_type = 'raw',
        overwrite     = True,
    )
    file_url = result['secure_url']

    from app.models.academic import Teacher as TeacherModel
    teacher = TeacherModel.query.filter_by(user_id=user.id).first()
    school_id = teacher.school_id if teacher else user.school_id

    note = Note(
        title       = title,
        description = description,
        file_url    = file_url,
        file_name   = filename,
        subject_id  = subject_id,
        class_id    = class_id,
        school_id   = school_id,
        uploaded_by = user.id,
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@teacher_bp.route('/notes', methods=['GET'])
@role_required('TEACHER', 'STUDENT', 'PRINCIPAL')
def list_notes():
    user     = get_current_user()
    class_id = request.args.get('class_id')
    from app.models.academic import Teacher as TeacherModel
    teacher = TeacherModel.query.filter_by(user_id=user.id).first()
    school_id = teacher.school_id if teacher else getattr(user, 'school_id', None)
    q = Note.query.filter_by(school_id=school_id)
    if class_id:
        q = q.filter_by(class_id=class_id)
    return jsonify([n.to_dict() for n in q.all()]), 200


def _grade(marks, max_marks):
    pct = marks / max_marks * 100 if max_marks else 0
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B+'
    if pct >= 60: return 'B'
    if pct >= 50: return 'C'
    if pct >= 33: return 'D'
    return 'F'
