from flask import Blueprint, request, jsonify
from datetime import datetime
import json
from werkzeug.utils import secure_filename
import cloudinary.uploader

from app import db
from app.models.academic import (
    Note, Assignment, AssignmentSubmission, InternalMarks,
    Class, Subject, Teacher, Student
)
from app.models.user import User
from app.utils.decorators import role_required, get_current_user


academic_resources_bp = Blueprint('academic_resources', __name__, url_prefix='/api/academic')

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'png', 'jpg', 'jpeg', 'zip'}
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _get_school_id(user):
    from app.models.academic import Teacher as TeacherModel, Student as StudentModel
    if user.role in ['TEACHER', 'STAFF']:
        t = TeacherModel.query.filter_by(user_id=user.id).first()
        if t and t.school_id:
            return t.school_id
    elif user.role in ['STUDENT', 'PARENT']:
        s = StudentModel.query.filter_by(user_id=user.id).first()
        if s and s.school_id:
            return s.school_id
    return getattr(user, 'school_id', None)


def _upload_to_storage(file, folder_name):
    filename = secure_filename(file.filename or 'file')
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    
    # Read file size
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File size exceeds 25 MB limit ({file_size // (1024*1024)} MB)")

    result = cloudinary.uploader.upload(
        file,
        folder=folder_name,
        resource_type='auto',
        overwrite=True,
    )
    return result.get('secure_url'), filename, file_size, ext


# ═══════════════════════════════════════════════════════════════════════════════
# 1. NOTES & STUDY MATERIAL ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@academic_resources_bp.route('/notes', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'STUDENT', 'PARENT')
def list_notes():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    class_id      = request.args.get('class_id', type=int)
    subject_id    = request.args.get('subject_id', type=int)
    teacher_id    = request.args.get('teacher_id', type=int)
    academic_year = request.args.get('academic_year')
    search        = (request.args.get('search') or '').strip()

    q = Note.query.filter_by(school_id=sid)

    # Student / Parent filtering: restrict to student's enrolled class
    if curr.role in ['STUDENT', 'PARENT']:
        student = Student.query.filter_by(user_id=curr.id).first()
        if not student and curr.role == 'PARENT':
            student = Student.query.filter(
                (Student.parent_email == curr.email) | (Student.parent_phone == curr.phone)
            ).first()
        if student and student.class_id:
            q = q.filter(db.or_(Note.class_id == student.class_id, Note.class_id.is_(None)))
        else:
            return jsonify({'notes': [], 'total': 0}), 200
    else:
        if class_id:
            q = q.filter_by(class_id=class_id)

    if subject_id:
        q = q.filter_by(subject_id=subject_id)
    if teacher_id:
        q = q.filter_by(teacher_id=teacher_id)
    if academic_year:
        q = q.filter_by(academic_year=academic_year)

    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(
            Note.title.ilike(like),
            Note.description.ilike(like),
            Note.file_name.ilike(like)
        ))

    notes = q.order_by(Note.uploaded_at.desc()).all()
    return jsonify({
        'notes': [n.to_dict() for n in notes],
        'total': len(notes),
    }), 200


@academic_resources_bp.route('/notes', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def upload_note():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    title       = (request.form.get('title') or '').strip()
    description = (request.form.get('description') or '').strip()
    class_id    = request.form.get('class_id', type=int)
    subject_id  = request.form.get('subject_id', type=int)
    academic_yr = (request.form.get('academic_year') or '2026').strip()
    file        = request.files.get('file')

    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if not file or not _allowed_file(file.filename):
        return jsonify({'error': 'Valid file (PDF, DOCX, PPT, Image, etc.) is required'}), 400

    teacher = Teacher.query.filter_by(user_id=curr.id).first()
    teacher_id = teacher.id if teacher else None

    # If teacher uploaded, verify class/subject if assigned
    if curr.role == 'TEACHER' and not teacher_id:
        return jsonify({'error': 'Teacher profile not found'}), 403

    try:
        folder = f"eduerp/schools/{sid}/notes"
        file_url, file_name, file_size, file_type = _upload_to_storage(file, folder)
    except Exception as ex:
        return jsonify({'error': f"Upload failed: {str(ex)}"}), 400

    note = Note(
        school_id     = sid,
        class_id      = class_id,
        subject_id    = subject_id,
        teacher_id    = teacher_id,
        uploaded_by   = curr.id,
        title         = title,
        description   = description,
        file_url      = file_url,
        file_name     = file_name,
        file_size     = file_size,
        file_type     = file_type,
        academic_year = academic_yr,
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        'message': 'Study material uploaded successfully!',
        'note': note.to_dict(),
    }), 201


@academic_resources_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def delete_note(note_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    note = Note.query.get_or_404(note_id)

    if note.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # If teacher, can only delete own notes
    if curr.role == 'TEACHER' and note.uploaded_by != curr.id:
        return jsonify({'error': 'You can only delete study material uploaded by yourself'}), 403

    db.session.delete(note)
    db.session.commit()
    return jsonify({'message': 'Study material deleted successfully'}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# 2. ASSIGNMENTS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@academic_resources_bp.route('/assignments', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'STUDENT', 'PARENT')
def list_assignments():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    class_id      = request.args.get('class_id', type=int)
    subject_id    = request.args.get('subject_id', type=int)
    teacher_id    = request.args.get('teacher_id', type=int)
    status        = request.args.get('status')
    academic_year = request.args.get('academic_year')
    search        = (request.args.get('search') or '').strip()

    q = Assignment.query.filter_by(school_id=sid)

    # 1. STUDENT / PARENT VIEW
    if curr.role in ['STUDENT', 'PARENT']:
        student = Student.query.filter_by(user_id=curr.id).first()
        if not student and curr.role == 'PARENT':
            student = Student.query.filter(
                (Student.parent_email == curr.email) | (Student.parent_phone == curr.phone)
            ).first()

        if not student or not student.class_id:
            return jsonify({'assignments': [], 'total': 0}), 200

        q = q.filter_by(class_id=student.class_id)
        if subject_id:
            q = q.filter_by(subject_id=subject_id)
        if status:
            q = q.filter_by(status=status)

        assignments = q.order_by(Assignment.due_date.asc(), Assignment.created_at.desc()).all()
        
        # Fetch this student's submissions for these assignments
        sub_map = {
            s.assignment_id: s.to_dict()
            for s in AssignmentSubmission.query.filter_by(student_id=student.id).all()
        }

        results = []
        for a in assignments:
            item = a.to_dict(include_stats=False)
            my_sub = sub_map.get(a.id)
            item['my_submission'] = my_sub
            item['submission_status'] = my_sub['status'] if my_sub else ('EXPIRED' if a.due_date and a.due_date < datetime.utcnow() else 'PENDING')
            results.append(item)

        return jsonify({'assignments': results, 'total': len(results)}), 200

    # 2. TEACHER / PRINCIPAL VIEW
    if class_id:
        q = q.filter_by(class_id=class_id)
    if subject_id:
        q = q.filter_by(subject_id=subject_id)
    if teacher_id:
        q = q.filter_by(teacher_id=teacher_id)
    if status:
        q = q.filter_by(status=status)
    if academic_year:
        q = q.filter_by(academic_year=academic_year)

    if search:
        like = f"%{search}%"
        q = q.filter(db.or_(
            Assignment.title.ilike(like),
            Assignment.description.ilike(like),
            Assignment.assignment_uid.ilike(like)
        ))

    assignments = q.order_by(Assignment.created_at.desc()).all()
    return jsonify({
        'assignments': [a.to_dict(include_stats=True) for a in assignments],
        'total': len(assignments),
    }), 200


@academic_resources_bp.route('/assignments', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def create_assignment():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    title         = (request.form.get('title') or '').strip()
    description   = (request.form.get('description') or '').strip()
    class_id      = request.form.get('class_id', type=int)
    subject_id    = request.form.get('subject_id', type=int)
    max_marks_raw = request.form.get('max_marks', '20')
    due_date_str  = request.form.get('due_date')
    academic_yr   = (request.form.get('academic_year') or '2026').strip()
    file          = request.files.get('attachment')

    if not title or not class_id or not subject_id or not due_date_str:
        return jsonify({'error': 'Title, Class, Subject, and Due Date are required'}), 400

    try:
        max_marks = float(max_marks_raw)
        if max_marks <= 0:
            return jsonify({'error': 'Maximum marks must be greater than 0'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid maximum marks value'}), 400

    try:
        # Parse ISO or Date string
        if 'T' in due_date_str:
            due_date = datetime.fromisoformat(due_date_str.replace('Z', ''))
        else:
            due_date = datetime.strptime(due_date_str, '%Y-%m-%d')
    except Exception:
        return jsonify({'error': 'Invalid due date format (YYYY-MM-DD)'}), 400

    teacher = Teacher.query.filter_by(user_id=curr.id).first()
    teacher_id = teacher.id if teacher else None

    # Handle attachment upload if provided
    att_url, att_name, att_size = None, None, None
    if file and file.filename:
        if not _allowed_file(file.filename):
            return jsonify({'error': 'Invalid file attachment format'}), 400
        try:
            folder = f"eduerp/schools/{sid}/assignments"
            att_url, att_name, att_size, _ = _upload_to_storage(file, folder)
        except Exception as ex:
            return jsonify({'error': f"Attachment upload failed: {str(ex)}"}), 400

    # Auto-generate unique Assignment UID per school
    seq = Assignment.query.filter_by(school_id=sid).count() + 1
    assignment_uid = f"ASN-{academic_yr[:4]}-{seq:04d}"

    assignment = Assignment(
        assignment_uid  = assignment_uid,
        school_id       = sid,
        class_id        = class_id,
        subject_id      = subject_id,
        teacher_id      = teacher_id,
        created_by      = curr.id,
        title           = title,
        description     = description,
        attachment_url  = att_url,
        attachment_name = att_name,
        attachment_size = att_size,
        max_marks       = max_marks,
        due_date        = due_date,
        academic_year   = academic_yr,
        status          = 'ACTIVE',
    )
    db.session.add(assignment)
    db.session.commit()

    return jsonify({
        'message': f'Assignment #{assignment_uid} created successfully!',
        'assignment': assignment.to_dict(include_stats=True),
    }), 201


@academic_resources_bp.route('/assignments/<int:assignment_id>', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'STUDENT')
def get_assignment_details(assignment_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # If student, return assignment + their submission
    if curr.role == 'STUDENT':
        student = Student.query.filter_by(user_id=curr.id).first()
        if not student or student.class_id != assignment.class_id:
            return jsonify({'error': 'Assignment not available for your class'}), 403

        sub = AssignmentSubmission.query.filter_by(
            assignment_id=assignment.id, student_id=student.id
        ).first()

        data = assignment.to_dict(include_stats=False)
        data['my_submission'] = sub.to_dict() if sub else None
        return jsonify(data), 200

    # If Teacher / Principal: Return assignment + complete enrolled student list with submissions
    students = Student.query.filter_by(
        school_id=sid, class_id=assignment.class_id
    ).order_by(Student.roll_number.asc()).all()

    submissions = {
        s.student_id: s.to_dict()
        for s in assignment.submissions.all()
    }

    student_items = []
    for st in students:
        sub = submissions.get(st.id)
        student_items.append({
            'student_id':     st.id,
            'name':           st.user.name if st.user else '',
            'roll_number':    st.roll_number or '—',
            'admission_no':   st.admission_no or '—',
            'photo_url':      st.photo_url,
            'is_submitted':   sub is not None,
            'submission':     sub,
            'status':         sub['status'] if sub else ('OVERDUE' if assignment.due_date < datetime.utcnow() else 'PENDING'),
            'marks_obtained': sub['marks_obtained'] if sub else None,
            'feedback':       sub['teacher_feedback'] if sub else None,
        })

    res = assignment.to_dict(include_stats=True)
    res['student_submissions'] = student_items
    return jsonify(res), 200


@academic_resources_bp.route('/assignments/<int:assignment_id>', methods=['PUT'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def update_assignment(assignment_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if curr.role == 'TEACHER' and assignment.created_by != curr.id:
        return jsonify({'error': 'You can only edit assignments created by yourself'}), 403

    data = request.get_json() or {}
    if 'title' in data and data['title'].strip():
        assignment.title = data['title'].strip()
    if 'description' in data:
        assignment.description = data['description'].strip()
    if 'max_marks' in data:
        try:
            assignment.max_marks = float(data['max_marks'])
        except ValueError:
            pass
    if 'due_date' in data and data['due_date']:
        try:
            due_str = data['due_date']
            assignment.due_date = datetime.fromisoformat(due_str.replace('Z', '')) if 'T' in due_str else datetime.strptime(due_str, '%Y-%m-%d')
        except Exception:
            pass
    if 'status' in data and data['status'] in ['ACTIVE', 'CLOSED', 'ARCHIVED']:
        assignment.status = data['status']

    db.session.commit()
    return jsonify({
        'message': 'Assignment updated successfully',
        'assignment': assignment.to_dict(include_stats=True)
    }), 200


@academic_resources_bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def delete_assignment(assignment_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    assignment = Assignment.query.get_or_404(assignment_id)

    if assignment.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if curr.role == 'TEACHER' and assignment.created_by != curr.id:
        return jsonify({'error': 'You can only delete assignments created by yourself'}), 403

    db.session.delete(assignment)
    db.session.commit()
    return jsonify({'message': 'Assignment deleted successfully'}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# 3. STUDENT SUBMISSION & GRADING
# ═══════════════════════════════════════════════════════════════════════════════

@academic_resources_bp.route('/assignments/<int:assignment_id>/submit', methods=['POST'])
@role_required('STUDENT')
def submit_assignment(assignment_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    student = Student.query.filter_by(user_id=curr.id).first()
    if not student:
        return jsonify({'error': 'Student profile not found'}), 404

    assignment = Assignment.query.get_or_404(assignment_id)
    if assignment.school_id != sid or assignment.class_id != student.class_id:
        return jsonify({'error': 'Assignment does not belong to your class'}), 403

    file = request.files.get('file')
    comment = (request.form.get('student_comment') or '').strip()

    if not file or not _allowed_file(file.filename):
        return jsonify({'error': 'Valid assignment submission file (PDF, DOCX, Image, etc.) is required'}), 400

    try:
        folder = f"eduerp/schools/{sid}/students/{student.id}/assignments/{assignment_id}"
        file_url, file_name, file_size, file_type = _upload_to_storage(file, folder)
    except Exception as ex:
        return jsonify({'error': f"Submission upload failed: {str(ex)}"}), 400

    # Determine status: SUBMITTED or LATE
    status = 'LATE' if assignment.due_date and datetime.utcnow() > assignment.due_date else 'SUBMITTED'

    # Check if existing submission (re-submission)
    sub = AssignmentSubmission.query.filter_by(
        assignment_id=assignment.id, student_id=student.id
    ).first()

    if sub:
        sub.file_url = file_url
        sub.file_name = file_name
        sub.file_size = file_size
        sub.file_type = file_type
        sub.student_comment = comment
        sub.submitted_at = datetime.utcnow()
        sub.status = status if status == 'LATE' else 'RESUBMITTED'
    else:
        sub = AssignmentSubmission(
            assignment_id   = assignment.id,
            student_id      = student.id,
            school_id       = sid,
            file_url        = file_url,
            file_name       = file_name,
            file_size       = file_size,
            file_type       = file_type,
            student_comment = comment,
            submitted_at    = datetime.utcnow(),
            status          = status,
        )
        db.session.add(sub)

    db.session.commit()
    return jsonify({
        'message': '✅ Assignment submitted successfully!',
        'submission': sub.to_dict()
    }), 201


@academic_resources_bp.route('/assignments/<int:assignment_id>/submissions/<int:submission_id>/grade', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def grade_submission(assignment_id, submission_id):
    curr = get_current_user()
    sid = _get_school_id(curr)
    assignment = Assignment.query.get_or_404(assignment_id)
    submission = AssignmentSubmission.query.get_or_404(submission_id)

    if assignment.school_id != sid or submission.assignment_id != assignment.id:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    marks_raw = data.get('marks_obtained')
    feedback  = (data.get('teacher_feedback') or '').strip()

    if marks_raw is None:
        return jsonify({'error': 'Marks obtained is required'}), 400

    try:
        marks = float(marks_raw)
        if marks < 0 or marks > assignment.max_marks:
            return jsonify({'error': f"Marks must be between 0 and {assignment.max_marks}"}), 400
    except ValueError:
        return jsonify({'error': 'Invalid numeric marks format'}), 400

    submission.marks_obtained   = marks
    submission.teacher_feedback = feedback
    submission.marked_by        = curr.id
    submission.marked_at        = datetime.utcnow()
    submission.status           = 'MARKED'

    db.session.commit()
    return jsonify({
        'message': 'Evaluation saved successfully!',
        'submission': submission.to_dict()
    }), 200


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CONTINUOUS INTERNAL MARKS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@academic_resources_bp.route('/internal-marks', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def get_internal_marks():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    class_id      = request.args.get('class_id', type=int)
    subject_id    = request.args.get('subject_id', type=int)
    academic_year = (request.args.get('academic_year') or '2026').strip()
    term          = (request.args.get('term') or 'Continuous Assessment').strip()

    if not class_id or not subject_id:
        return jsonify({'students': [], 'total': 0}), 200

    # Get all students enrolled in this class
    students = Student.query.filter_by(
        school_id=sid, class_id=class_id
    ).order_by(Student.roll_number.asc()).all()

    # Get existing internal marks for this subject, academic_year, and term
    marks_records = {
        m.student_id: m.to_dict()
        for m in InternalMarks.query.filter_by(
            school_id=sid, class_id=class_id, subject_id=subject_id,
            academic_year=academic_year, term=term
        ).all()
    }

    subject = Subject.query.get(subject_id)
    default_max = 20.0

    items = []
    for st in students:
        m = marks_records.get(st.id)
        items.append({
            'student_id':     st.id,
            'name':           st.user.name if st.user else '',
            'roll_number':    st.roll_number or '—',
            'admission_no':   st.admission_no or '—',
            'marks_obtained': m['marks_obtained'] if m else 0.0,
            'max_marks':      m['max_marks'] if m else default_max,
            'percentage':     m['percentage'] if m else 0.0,
            'remarks':        m['remarks'] if m else '',
            'has_record':     m is not None,
        })

    return jsonify({
        'students':      items,
        'total':         len(items),
        'subject_name':  subject.name if subject else '',
        'academic_year': academic_year,
        'term':          term,
        'default_max':   default_max,
    }), 200


@academic_resources_bp.route('/internal-marks/batch-save', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def batch_save_internal_marks():
    curr = get_current_user()
    sid = _get_school_id(curr)
    if not sid:
        return jsonify({'error': 'School context not found'}), 400

    data = request.get_json() or {}
    class_id      = data.get('class_id')
    subject_id    = data.get('subject_id')
    academic_year = (data.get('academic_year') or '2026').strip()
    term          = (data.get('term') or 'Continuous Assessment').strip()
    marks_list    = data.get('marks') or []

    if not class_id or not subject_id:
        return jsonify({'error': 'Class and Subject are required'}), 400

    teacher = Teacher.query.filter_by(user_id=curr.id).first()
    teacher_id = teacher.id if teacher else None

    updated_count = 0
    for entry in marks_list:
        st_id = entry.get('student_id')
        if not st_id:
            continue

        try:
            m_obt = float(entry.get('marks_obtained', 0))
            m_max = float(entry.get('max_marks', 20))
        except (ValueError, TypeError):
            continue

        remarks = (entry.get('remarks') or '').strip()

        # Find or create
        rec = InternalMarks.query.filter_by(
            school_id=sid, student_id=st_id, subject_id=subject_id,
            academic_year=academic_year, term=term
        ).first()

        if rec:
            rec.marks_obtained = m_obt
            rec.max_marks      = m_max
            rec.remarks        = remarks
            rec.class_id       = class_id
            rec.entered_by     = curr.id
            rec.teacher_id     = teacher_id or rec.teacher_id
            rec.updated_at     = datetime.utcnow()
        else:
            rec = InternalMarks(
                school_id      = sid,
                student_id     = st_id,
                class_id       = class_id,
                subject_id     = subject_id,
                teacher_id     = teacher_id,
                entered_by     = curr.id,
                academic_year  = academic_year,
                term           = term,
                marks_obtained = m_obt,
                max_marks      = m_max,
                remarks        = remarks,
            )
            db.session.add(rec)
        updated_count += 1

    db.session.commit()
    return jsonify({
        'message': f'✅ Internal marks for {updated_count} students saved and now active for student viewing!',
        'updated_count': updated_count,
    }), 200


@academic_resources_bp.route('/student/internal-marks', methods=['GET'])
@role_required('STUDENT', 'PARENT')
def my_internal_marks():
    curr = get_current_user()
    sid = _get_school_id(curr)
    student = Student.query.filter_by(user_id=curr.id).first()
    if not student and curr.role == 'PARENT':
        student = Student.query.filter(
            (Student.parent_email == curr.email) | (Student.parent_phone == curr.phone)
        ).first()

    if not student:
        return jsonify({'error': 'Student profile not found'}), 404

    records = InternalMarks.query.filter_by(
        student_id=student.id
    ).order_by(InternalMarks.updated_at.desc()).all()

    return jsonify({
        'internal_marks': [r.to_dict() for r in records],
        'total': len(records),
        'student_name': student.user.name if student.user else '',
        'class_display': f"{student.class_ref.name} - {student.class_ref.section}" if student.class_ref else '',
    }), 200
