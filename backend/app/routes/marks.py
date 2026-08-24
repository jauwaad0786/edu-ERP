from flask import Blueprint, request, jsonify
from sqlalchemy import func
from app import db
from app.models.academic import Class, Subject, Student, Marks
from app.models.financial import ExamSchedule, ExamTimetable
from app.utils.decorators import role_required, get_current_user

marks_bp = Blueprint('marks', __name__)


def _school_id():
    return get_current_user().school_id
    
def _teacher_subject_ids(user, class_id=None):
    """Returns set of subject_ids this teacher is assigned to (optionally within one class).
       Returns None if user is PRINCIPAL / administrative role (no restriction)."""
    role_val = getattr(user.role, 'value', str(user.role))
    if role_val in ('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN'):
        return None
    from app.models.academic import Teacher
    teacher = Teacher.query.filter_by(user_id=user.id).first()
    if not teacher:
        return set()
    q = Subject.query.filter_by(teacher_id=teacher.id)
    if class_id:
        q = q.filter_by(class_id=class_id)
    return {s.id for s in q.all()}

# ─── Grid View (ALL subjects at once) ────────────────────────────────────────

@marks_bp.route('/grid', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_marks_grid():
    """
    Return all students + all subjects for a class+exam in ONE call.
    Frontend grid ban sake: rows=students, cols=subjects
    Query params: class_id, exam_id
    """
    sid      = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id  = request.args.get('exam_id',  type=int)

    if not class_id or not exam_id:
        return jsonify({'error': 'class_id aur exam_id required hain'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # All subjects for this class
    # All subjects for this class
    subjects = Subject.query.filter_by(class_id=class_id).all()

    # TEACHER: sirf apne assigned subjects dekh sake
    user = get_current_user()
    allowed_ids = _teacher_subject_ids(user, class_id)
    if allowed_ids is not None:
        subjects = [s for s in subjects if s.id in allowed_ids]
        if not subjects:
            return jsonify({'error': 'Aapko is class mein koi subject assign nahi hai'}), 403

    # Per-subject max/pass marks — prefer ExamTimetable, fallback to Subject
    subject_meta = []
    for s in subjects:
        tt = ExamTimetable.query.filter_by(
            exam_id=exam_id, class_id=class_id, subject_id=s.id
        ).first()
        subject_meta.append({
            'id':          s.id,
            'name':        s.name,
            'max_marks':   float(tt.max_marks  if tt else (s.max_marks  or 100)),
            'pass_marks':  float(tt.pass_marks if tt else (s.pass_marks or 33)),
        })

    # All students in class
    students = Student.query.filter_by(
        class_id=class_id, school_id=sid
    ).order_by(Student.roll_number).all()

    # All existing marks for this class+exam — single query
    existing = {}
    all_marks = Marks.query.filter_by(
        exam_id=exam_id, class_id=class_id
    ).all()
    for m in all_marks:
        existing[(m.student_id, m.subject_id)] = m

    # Build grid rows
    rows = []
    for s in students:
        cells = {}
        total_obtained = 0
        total_max      = 0
        for subj in subject_meta:
            m = existing.get((s.id, subj['id']))
            mo = float(m.marks_obtained) if m and m.marks_obtained is not None else None
            cells[str(subj['id'])] = {
                'marks_obtained': mo,
                'is_absent':      bool(m.is_absent)  if m else False,
                'is_locked':      bool(m.is_locked)  if m else False,
                'grade':          m.grade             if m else None,
                'remarks':        m.remarks           if m else '',
            }
            if mo is not None and not (m and m.is_absent):
                total_obtained += mo
                total_max      += subj['max_marks']

        pct = round(total_obtained / total_max * 100, 1) if total_max else 0
        rows.append({
            'student_id':      s.id,
            'name':            s.user.name if s.user else '',
            'roll_number':     s.roll_number or '',
            'cells':           cells,
            'total_obtained':  total_obtained,
            'total_max':       total_max,
            'percentage':      pct,
            'overall_grade':   _grade(total_obtained, total_max) if total_max else '—',
        })

    # Sort by percentage desc (topper first)
    rows.sort(key=lambda r: -r['percentage'])

    # Is entire grid locked?
    all_locked = all(
        cells.get('is_locked', False)
        for row in rows
        for cells in row['cells'].values()
    ) if rows and any(row['cells'] for row in rows) else False

    return jsonify({
        'class':       cls.to_dict(),
        'exam':        exam.to_dict(),
        'subjects':    subject_meta,
        'rows':        rows,
        'is_locked':   all_locked,
        'is_published': exam.is_published,
    }), 200


def _grade(marks, max_marks):
    pct = marks / max_marks * 100 if max_marks else 0
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B+'
    if pct >= 60: return 'B'
    if pct >= 50: return 'C'
    if pct >= 33: return 'D'
    return 'F'


# ─── Marks Entry ────────────────────────────────────────────────────────────

@marks_bp.route('/roster', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def get_marks_roster():
    """
    Fetch the student list for a Class + Exam + Subject, with any marks
    already entered, so the frontend entry grid can pre-fill values.
    Query params: class_id, exam_id, subject_id
    """
    sid = _school_id()
    class_id   = request.args.get('class_id', type=int)
    exam_id    = request.args.get('exam_id', type=int)
    subject_id = request.args.get('subject_id', type=int)

    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id and subject_id are required'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    subject = Subject.query.get_or_404(subject_id)
    if subject.school_id and subject.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # Prefer max/pass marks defined in the exam timetable for this subject; fall back to Subject defaults
    tt = ExamTimetable.query.filter_by(
        exam_id=exam_id, class_id=class_id, subject_id=subject_id
    ).first()
    max_marks  = tt.max_marks  if tt else (subject.max_marks  or 100)
    pass_marks = tt.pass_marks if tt else (subject.pass_marks or 33)

    students = Student.query.filter_by(
        class_id=class_id, school_id=sid
    ).order_by(Student.roll_number).all()

    existing = {
        m.student_id: m for m in Marks.query.filter_by(
            exam_id=exam_id, subject_id=subject_id, class_id=class_id
        ).all()
    }

    roster = []
    for s in students:
        m = existing.get(s.id)
        roster.append({
            'student_id':     s.id,
            'name':           s.user.name if s.user else '',
            'roll_number':    s.roll_number or '',
            'marks_obtained': float(m.marks_obtained) if m and m.marks_obtained is not None else None,
            'is_absent':      bool(m.is_absent) if m else False,
            'is_locked':      bool(m.is_locked) if m else False,
            'remarks':        m.remarks if m else '',
            'grade':          m.grade if m else None,
        })

    is_locked = all(r.get('is_locked') for r in roster) if roster else False
    return jsonify({
        'class':      cls.to_dict(),
        'exam':       exam.to_dict(),
        'subject':    subject.to_dict(),
        'max_marks':  max_marks,
        'pass_marks': pass_marks,
        'students':   roster,
        'is_locked':  is_locked,
    }), 200


@marks_bp.route('/save', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def save_marks():
    """
    Bulk save/update marks for Class + Exam + Subject.
    Body: {
      class_id, exam_id, subject_id,
      entries: [{student_id, marks_obtained, is_absent, remarks}, ...]
    }
    """
    sid  = _school_id()
    data = request.get_json() or {}

    class_id   = data.get('class_id')
    exam_id    = data.get('exam_id')
    subject_id = data.get('subject_id')
    entries    = data.get('entries', [])

    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id and subject_id are required'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    subject = Subject.query.get_or_404(subject_id)

    user_check = get_current_user()
    allowed_check = _teacher_subject_ids(user_check, class_id)
    if allowed_check is not None and subject_id not in allowed_check:
        return jsonify({'error': 'Aapko is subject ke marks daalne ki permission nahi hai'}), 403

    tt = ExamTimetable.query.filter_by(
        exam_id=exam_id, class_id=class_id, subject_id=subject_id
    ).first()
    default_max = tt.max_marks if tt else (subject.max_marks or 100)

    user  = get_current_user()
    saved = 0

    for e in entries:
        student = Student.query.get(e.get('student_id'))
        # Skip any row that doesn't belong to this school/class (defense against tampered payloads)
        if not student or student.school_id != sid or student.class_id != class_id:
            continue

        is_absent      = bool(e.get('is_absent'))
        marks_obtained = 0 if is_absent else float(e.get('marks_obtained') or 0)
        max_marks       = float(e.get('max_marks') or default_max)

        # clamp to valid range
        marks_obtained = max(0, min(marks_obtained, max_marks))

        record = Marks.query.filter_by(
            student_id=student.id, subject_id=subject_id, exam_id=exam_id
        ).first()
        if record and getattr(record, 'is_locked', False):
            continue  # locked rows skip
        if not record:
            record = Marks(
                student_id=student.id, subject_id=subject_id, exam_id=exam_id,
                class_id=class_id, school_id=sid,
            )
            db.session.add(record)

        record.marks_obtained = marks_obtained
        record.max_marks      = max_marks
        record.is_absent      = bool(is_absent)
        record.remarks        = e.get('remarks', '')
        record.grade          = 'AB' if is_absent else _grade(marks_obtained, max_marks)
        record.entered_by     = user.id
        record.exam_type       = exam.exam_name   # keep in sync for legacy result-card matching

        saved += 1

    db.session.commit()
    return jsonify({'message': f'Marks saved for {saved} students'}), 200


# ─── Topper Analytics ───────────────────────────────────────────────────────

def _rank_toppers(rows, limit=3):
    """rows: list of (student_id, total_obtained, total_max) -> ranked topper dicts."""
    ranked = []
    for student_id, total_obtained, total_max in rows:
        if not total_max:
            continue
        pct = round(total_obtained / total_max * 100, 2)
        ranked.append((student_id, total_obtained or 0, total_max, pct))

    # Highest percentage first; tie-break by raw total marks
    ranked.sort(key=lambda r: (-r[3], -r[1]))

    result = []
    for rank, (student_id, total_obtained, total_max, pct) in enumerate(ranked[:limit], start=1):
        student = Student.query.get(student_id)
        if not student:
            continue
        result.append({
            'rank':           rank,
            'student_id':     student.id,
            'name':           student.user.name if student.user else '',
            'roll_number':    student.roll_number or '',
            'class_id':       student.class_id,
            'class_name':     f"{student.class_ref.name} - {student.class_ref.section}" if student.class_ref else '',
            'photo_url':      student.photo_url,
            'total_obtained': total_obtained,
            'total_max':      total_max,
            'percentage':     pct,
            'grade':          _grade(total_obtained, total_max),
        })
    return result


@marks_bp.route('/toppers/school', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
def school_toppers():
    """Top 3 students across the entire school for a given exam."""
    sid     = _school_id()
    exam_id = request.args.get('exam_id', type=int)
    if not exam_id:
        return jsonify({'error': 'exam_id is required'}), 400

    rows = db.session.query(
        Marks.student_id,
        func.sum(Marks.marks_obtained),
        func.sum(Marks.max_marks),
    ).filter(
        Marks.exam_id == exam_id, Marks.school_id == sid, Marks.is_absent == False
    ).group_by(Marks.student_id).all()

    return jsonify(_rank_toppers(rows)), 200


@marks_bp.route('/toppers/class', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
def class_toppers():
    """Top 3 students in a specific class for a given exam."""
    sid      = _school_id()
    exam_id  = request.args.get('exam_id', type=int)
    class_id = request.args.get('class_id', type=int)
    if not exam_id or not class_id:
        return jsonify({'error': 'exam_id and class_id are required'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    rows = db.session.query(
        Marks.student_id,
        func.sum(Marks.marks_obtained),
        func.sum(Marks.max_marks),
    ).filter(
        Marks.exam_id == exam_id, Marks.class_id == class_id, Marks.is_absent == False
    ).group_by(Marks.student_id).all()

    return jsonify(_rank_toppers(rows)), 200


@marks_bp.route('/toppers/subject', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT')
def subject_toppers():
    """Top 3 students for a subject in a given exam (optionally within one class)."""
    sid        = _school_id()
    exam_id    = request.args.get('exam_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    class_id   = request.args.get('class_id', type=int)  # optional

    if not exam_id or not subject_id:
        return jsonify({'error': 'exam_id and subject_id are required'}), 400

    q = Marks.query.filter_by(
        exam_id=exam_id, subject_id=subject_id, school_id=sid, is_absent=False
    )
    if class_id:
        q = q.filter_by(class_id=class_id)

    top = q.order_by(Marks.marks_obtained.desc()).limit(3).all()

    result = []
    for rank, m in enumerate(top, start=1):
        student = m.student
        if not student:
            continue
        result.append({
            'rank':           rank,
            'student_id':     student.id,
            'name':           student.user.name if student.user else '',
            'roll_number':    student.roll_number or '',
            'class_id':       student.class_id,
            'class_name':     f"{student.class_ref.name} - {student.class_ref.section}" if student.class_ref else '',
            'photo_url':      student.photo_url,
            'marks_obtained': m.marks_obtained,
            'max_marks':      m.max_marks,
            'percentage':     round(m.marks_obtained / m.max_marks * 100, 2) if m.max_marks else 0,
            'grade':          m.grade,
            'subject_name':   m.subject.name if m.subject else '',
        })
    return jsonify(result), 200


@marks_bp.route('/lock', methods=['POST'])
@role_required('PRINCIPAL')
def lock_marks():
    """Lock marks for a class+exam+subject — no further edits allowed."""
    sid  = _school_id()
    data = request.get_json() or {}
    class_id   = data.get('class_id')
    exam_id    = data.get('exam_id')
    subject_id = data.get('subject_id')

    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id, subject_id required'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    updated = Marks.query.filter_by(
        class_id=class_id, exam_id=exam_id, subject_id=subject_id
    ).update({'is_locked': True})
    db.session.commit()
    return jsonify({'message': f'{updated} marks locked'}), 200


@marks_bp.route('/grid/save', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def save_grid_marks():
    """
    Grid se bulk save — ek call mein saare subjects ke marks save.
    Body: {
      class_id, exam_id,
      entries: [{
        student_id,
        subjects: [{subject_id, marks_obtained, max_marks, is_absent, remarks}]
      }]
    }
    """
    sid  = _school_id()
    data = request.get_json() or {}

    class_id = int(data.get('class_id') or 0)
    exam_id  = int(data.get('exam_id') or 0)
    entries  = data.get('entries', [])

    if not class_id or not exam_id:
        return jsonify({'error': 'class_id aur exam_id required'}), 400

    cls = Class.query.get_or_404(class_id)
    if cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    user  = get_current_user()
    allowed_ids = _teacher_subject_ids(user, class_id)
    saved = 0

    for entry in entries:
        student = Student.query.get(entry.get('student_id'))
        if not student or student.school_id != sid or int(student.class_id or 0) != class_id:
            continue

        for subj_entry in entry.get('subjects', []):
            subject_id     = subj_entry.get('subject_id')

            # TEACHER: sirf apne assigned subjects pe likh sake
            if allowed_ids is not None and subject_id not in allowed_ids:
                continue
            is_absent      = bool(subj_entry.get('is_absent'))
            raw_marks      = subj_entry.get('marks_obtained')
            max_marks      = float(subj_entry.get('max_marks') or 100)

            # Skip empty cells (teacher ne kuch enter hi nahi kiya)
            
            if (raw_marks is None or raw_marks == '') and not is_absent:
                continue

            marks_obtained = 0.0 if is_absent else float(raw_marks or 0)
            marks_obtained = max(0, min(marks_obtained, max_marks))

            subject = Subject.query.get(subject_id)
            if not subject:
                continue

            record = Marks.query.filter_by(
                student_id=student.id,
                subject_id=subject_id,
                exam_id=exam_id
            ).first()

            if record and getattr(record, 'is_locked', False):
                continue  # locked skip

            if not record:
                record = Marks(
                    student_id=student.id,
                    subject_id=subject_id,
                    exam_id=exam_id,
                    class_id=class_id,
                    school_id=sid,
                )
                db.session.add(record)

            record.marks_obtained = marks_obtained
            record.max_marks      = max_marks
            record.is_absent      = is_absent
            record.remarks        = subj_entry.get('remarks', '')
            record.grade          = 'AB' if is_absent else _grade(marks_obtained, max_marks)
            record.entered_by     = user.id
            record.exam_type      = exam.exam_name

            saved += 1

    db.session.commit()
    return jsonify({'message': f'{saved} marks saved'}), 200


@marks_bp.route('/publish', methods=['POST'])
@role_required('PRINCIPAL')
def publish_results():
    """
    Principal results publish kare — tab student/parent dashboard update ho.
    Body: { exam_id, class_id (optional — sirf ek class publish karna ho) }
    After publish: exam.is_published = True, exam.status = PUBLISHED
    Students/Parents /student/marks endpoint se published marks dekh sakte hain.
    """
    sid  = _school_id()
    data = request.get_json() or {}
    exam_id  = data.get('exam_id')
    class_id = data.get('class_id')  # optional

    if not exam_id:
        return jsonify({'error': 'exam_id required'}), 400

    exam = ExamSchedule.query.get_or_404(exam_id)
    if exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # Check karo ki saare marks enter hue hain
    q = Marks.query.filter_by(exam_id=exam_id, school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    total_marks = q.count()

    if total_marks == 0:
        return jsonify({'error': 'Koi marks enter nahi hue — pehle marks save karo'}), 400

    from datetime import datetime
    exam.is_published = True
    exam.status       = 'PUBLISHED'
    exam.published_at = datetime.utcnow()
    exam.published_by = get_current_user().id
    db.session.commit()

    return jsonify({
        'message':      'Results published successfully',
        'exam_id':      exam_id,
        'published_at': exam.published_at.isoformat(),
        'total_marks_published': total_marks,
    }), 200


@marks_bp.route('/student/<int:student_id>/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def student_marks_summary(student_id):
    """Principal/Teacher kisi bhi student ke marks dekh sake."""
    sid     = _school_id()
    student = Student.query.get_or_404(student_id)
    if student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    from collections import defaultdict
    all_marks = Marks.query.filter_by(student_id=student_id).all()

    exam_map = defaultdict(list)
    for m in all_marks:
        exam_map[m.exam_type].append({
            'subject':        m.subject.name if m.subject else 'N/A',
            'marks_obtained': m.marks_obtained or 0,
            'max_marks':      m.max_marks or 100,
            'grade':          m.grade or '—',
            'is_absent':      bool(m.is_absent),
            'percentage':     round(m.marks_obtained / m.max_marks * 100, 1)
                              if m.max_marks else 0,
        })

    result = []
    for exam_type, subjects in exam_map.items():
        total_obt = sum(s['marks_obtained'] for s in subjects if not s['is_absent'])
        total_max = sum(s['max_marks']      for s in subjects if not s['is_absent'])
        avg_pct   = round(total_obt / total_max * 100, 1) if total_max else 0
        result.append({
            'exam_type':      exam_type,
            'subjects':       subjects,
            'total_obtained': total_obt,
            'total_max':      total_max,
            'avg_pct':        avg_pct,
        })

    return jsonify(result), 200
