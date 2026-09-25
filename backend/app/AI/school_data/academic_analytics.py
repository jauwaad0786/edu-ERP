"""
Academic Analytics Service
Marks, exams, class performance — all calculated by DB.
"""
from sqlalchemy import func, and_
from app import db


def get_top_students(school_id: int, class_id: int = None,
                     exam_id: int = None, limit: int = 10) -> dict:
    """
    Top performing students by average marks.
    Criteria: average marks_obtained / max_marks percentage across all subjects.
    Always states the basis — never fabricates criteria.
    """
    from app.models.academic import Marks, Student, Class
    from app.models.user import User

    q = db.session.query(
        Student.id,
        User.name,
        Class.name.label('class_name'),
        Class.section,
        func.avg(
            Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
        ).label('avg_pct'),
        func.count(Marks.id).label('subjects'),
    ).join(User,    User.id   == Student.user_id)\
     .join(Marks,   Marks.student_id == Student.id)\
     .join(Class,   Class.id  == Student.class_id, isouter=True)\
     .filter(
        Student.school_id == school_id,
        Marks.is_absent   == False,
    )

    if class_id:
        q = q.filter(Student.class_id == class_id)
    if exam_id:
        q = q.filter(Marks.exam_id == exam_id)
    else:
        # Use most recent exam for the school if no specific exam
        from app.models.financial import ExamSchedule
        latest_exam = ExamSchedule.query.filter(
            ExamSchedule.school_id == school_id,
            ExamSchedule.is_published == True,
        ).order_by(ExamSchedule.created_at.desc()).first()
        if latest_exam:
            q = q.filter(Marks.exam_id == latest_exam.id)

    rows = q.group_by(Student.id, User.name, Class.name, Class.section)\
            .order_by(func.avg(
                Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
            ).desc())\
            .limit(limit).all()

    students = [{
        'rank':      i + 1,
        'student_id': r.id,
        'name':       r.name,
        'class':      f"{r.class_name or ''} {r.section or ''}".strip(),
        'avg_pct':    round(float(r.avg_pct or 0), 1),
        'subjects':   r.subjects,
    } for i, r in enumerate(rows)]

    exam_label = 'Most Recent Published Exam'
    if exam_id:
        from app.models.financial import ExamSchedule
        ex = ExamSchedule.query.get(exam_id)
        exam_label = ex.exam_name if ex else exam_label

    return {'students': students, 'basis': exam_label, 'criteria': 'Average marks percentage'}


def get_weak_students(school_id: int, class_id: int = None,
                      exam_id: int = None, threshold_pct: float = 40,
                      limit: int = 20) -> dict:
    """Students with average below threshold_pct."""
    from app.models.academic import Marks, Student, Class
    from app.models.user import User

    q = db.session.query(
        Student.id,
        User.name,
        Class.name.label('class_name'),
        Class.section,
        func.avg(
            Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
        ).label('avg_pct'),
    ).join(User,  User.id == Student.user_id)\
     .join(Marks, Marks.student_id == Student.id)\
     .join(Class, Class.id == Student.class_id, isouter=True)\
     .filter(Student.school_id == school_id, Marks.is_absent == False)

    if class_id:
        q = q.filter(Student.class_id == class_id)
    if exam_id:
        q = q.filter(Marks.exam_id == exam_id)
    else:
        from app.models.financial import ExamSchedule
        latest_exam = ExamSchedule.query.filter(
            ExamSchedule.school_id == school_id,
            ExamSchedule.is_published == True,
        ).order_by(ExamSchedule.created_at.desc()).first()
        if latest_exam:
            q = q.filter(Marks.exam_id == latest_exam.id)

    rows = q.group_by(Student.id, User.name, Class.name, Class.section)\
            .having(func.avg(
                Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
            ) < threshold_pct)\
            .order_by(func.avg(
                Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
            )).limit(limit).all()

    students = [{
        'student_id': r.id,
        'name':       r.name,
        'class':      f"{r.class_name or ''} {r.section or ''}".strip(),
        'avg_pct':    round(float(r.avg_pct or 0), 1),
    } for r in rows]

    return {'students': students, 'threshold_pct': threshold_pct, 'criteria': 'Average marks percentage'}


def get_class_performance(school_id: int, exam_id: int = None) -> list:
    """Class-wise average marks and pass percentage."""
    from app.models.academic import Marks, Student, Class, Subject
    from app.models.financial import ExamSchedule

    classes = Class.query.filter_by(school_id=school_id).all()
    result  = []

    if not exam_id:
        latest = ExamSchedule.query.filter(
            ExamSchedule.school_id == school_id,
            ExamSchedule.is_published == True,
        ).order_by(ExamSchedule.created_at.desc()).first()
        exam_id = latest.id if latest else None

    exam_label = 'Most Recent Published Exam'
    if exam_id:
        ex = ExamSchedule.query.get(exam_id)
        exam_label = ex.exam_name if ex else exam_label

    for cls in classes:
        aggs = db.session.query(
            func.count(Marks.id).label('entries'),
            func.avg(
                Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
            ).label('avg_pct'),
        ).join(Student, Student.id == Marks.student_id)\
         .filter(
            Student.school_id == school_id,
            Marks.class_id    == cls.id,
            Marks.is_absent   == False,
        )
        if exam_id:
            aggs = aggs.filter(Marks.exam_id == exam_id)
        row = aggs.first()

        if not row or not row.entries:
            continue

        # Pass count
        from app.models.academic import Subject
        pass_q = db.session.query(func.count(Marks.id)).join(
            Student, Student.id == Marks.student_id
        ).join(
            Subject, Subject.id == Marks.subject_id, isouter=True
        ).filter(
            Student.school_id == school_id,
            Marks.class_id    == cls.id,
            Marks.is_absent   == False,
            Marks.marks_obtained >= func.coalesce(Subject.pass_marks, 33),
        )
        if exam_id:
            pass_q = pass_q.filter(Marks.exam_id == exam_id)
        pass_count = pass_q.scalar() or 0

        total       = row.entries
        pass_pct    = round(pass_count / total * 100, 1) if total > 0 else 0
        avg_pct     = round(float(row.avg_pct or 0), 1)

        result.append({
            'class_id':    cls.id,
            'class_name':  f"{cls.name} {cls.section or ''}".strip(),
            'avg_pct':     avg_pct,
            'pass_pct':    pass_pct,
            'total_marks': total,
            'exam':        exam_label,
        })

    return sorted(result, key=lambda x: x['avg_pct'])  # lowest first


def get_school_student_count(school_id: int) -> dict:
    """Total and class-wise student counts."""
    from app.models.academic import Student, Class

    total = Student.query.filter_by(school_id=school_id, is_deleted=False).filter(Student.status != 'PROVISIONAL').count()
    classes = db.session.query(
        Class.name,
        Class.section,
        func.count(Student.id).label('count'),
    ).join(Student, Student.class_id == Class.id)\
     .filter(Student.school_id == school_id, Student.is_deleted == False, Student.status != 'PROVISIONAL')\
     .group_by(Class.id, Class.name, Class.section)\
     .order_by(Class.name)\
     .all()

    return {
        'total_students': total,
        'by_class': [{
            'class': f"{r.name} {r.section or ''}".strip(),
            'count': r.count,
        } for r in classes],
    }


def get_subject_performance(school_id: int, class_id: int = None,
                            exam_id: int = None) -> list:
    """
    Subject-wise average marks. Ordered by average ascending (worst first).
    Canonical: AVG(marks_obtained * 100 / max_marks)
    """
    from app.models.academic import Marks, Student, Subject, Class
    from app.models.financial import ExamSchedule

    if not exam_id:
        latest = ExamSchedule.query.filter(
            ExamSchedule.school_id == school_id,
            ExamSchedule.is_published == True,
        ).order_by(ExamSchedule.created_at.desc()).first()
        exam_id = latest.id if latest else None

    q = db.session.query(
        Subject.id.label('subject_id'),
        Subject.name.label('subject_name'),
        func.count(Marks.id).label('entries'),
        func.avg(
            Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
        ).label('avg_pct'),
        func.min(
            Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
        ).label('min_pct'),
        func.max(
            Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
        ).label('max_pct'),
    ).join(Student, Student.id == Marks.student_id)\
     .join(Subject, Subject.id == Marks.subject_id)\
     .filter(
        Student.school_id == school_id,
        Marks.is_absent   == False,
    )

    if class_id:
        q = q.filter(Marks.class_id == class_id)
    if exam_id:
        q = q.filter(Marks.exam_id == exam_id)

    rows = q.group_by(Subject.id, Subject.name)\
            .order_by(func.avg(
                Marks.marks_obtained * 100.0 / func.nullif(Marks.max_marks, 0)
            )).all()

    return [{
        'subject_id':   r.subject_id,
        'subject':      r.subject_name,
        'entries':      r.entries,
        'avg_pct':      round(float(r.avg_pct or 0), 1),
        'min_pct':      round(float(r.min_pct or 0), 1),
        'max_pct':      round(float(r.max_pct or 0), 1),
    } for r in rows]


def get_failing_students_by_subject(school_id: int, subject_name: str,
                                    class_id: int = None, exam_id: int = None,
                                    limit: int = 20) -> dict:
    """
    Students who failed a specific subject.
    Canonical fail condition: marks_obtained < Subject.pass_marks (or < 33% default).
    """
    from app.models.academic import Marks, Student, Class, Subject
    from app.models.user import User
    from app.models.financial import ExamSchedule

    if not exam_id:
        latest = ExamSchedule.query.filter(
            ExamSchedule.school_id == school_id,
            ExamSchedule.is_published == True,
        ).order_by(ExamSchedule.created_at.desc()).first()
        exam_id = latest.id if latest else None

    q = db.session.query(
        Student.id,
        User.name,
        Class.name.label('class_name'),
        Class.section,
        Marks.marks_obtained,
        Marks.max_marks,
        Subject.name.label('subj_name'),
    ).join(User,    User.id   == Student.user_id)\
     .join(Class,   Class.id  == Student.class_id, isouter=True)\
     .join(Marks,   Marks.student_id == Student.id)\
     .join(Subject, Subject.id == Marks.subject_id)\
     .filter(
        Student.school_id == school_id,
        Marks.is_absent   == False,
        Subject.name.ilike(f'%{subject_name}%'),
        Marks.marks_obtained < func.coalesce(Subject.pass_marks, Marks.max_marks * 0.33),
    )

    if class_id:
        q = q.filter(Student.class_id == class_id)
    if exam_id:
        q = q.filter(Marks.exam_id == exam_id)

    rows = q.order_by(Marks.marks_obtained).limit(limit).all()

    return {
        'subject':  subject_name,
        'count':    len(rows),
        'students': [{
            'student_id': r.id,
            'name':       r.name,
            'class':      f"{r.class_name or ''} {r.section or ''}".strip(),
            'obtained':   round(float(r.marks_obtained or 0), 1),
            'max_marks':  round(float(r.max_marks or 0), 1),
        } for r in rows],
    }
