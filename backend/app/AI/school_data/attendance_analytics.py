"""
Attendance Analytics Service
Real attendance data from the DB — backend calculates all statistics.
"""
from datetime import date, timedelta
from sqlalchemy import func, and_
from app import db


def get_attendance_today(school_id: int, class_id: int = None) -> dict:
    """Today's attendance summary across the school or for a specific class."""
    from app.models.academic import Attendance, Student, Class

    today = date.today()

    student_q = db.session.query(Student.id).filter(Student.school_id == school_id)
    if class_id:
        student_q = student_q.filter(Student.class_id == class_id)
    total_students = student_q.count()

    att_q = db.session.query(
        Attendance.status,
        func.count(Attendance.id).label('cnt'),
    ).join(Student, Student.id == Attendance.student_id)\
     .filter(
        Student.school_id == school_id,
        Attendance.date   == today,
    )
    if class_id:
        att_q = att_q.filter(Student.class_id == class_id)

    att_q = att_q.group_by(Attendance.status).all()

    counts = {'PRESENT': 0, 'ABSENT': 0, 'LATE': 0}
    for row in att_q:
        status = (row.status or 'PRESENT').upper()
        counts[status] = row.cnt

    marked   = sum(counts.values())
    present  = counts['PRESENT'] + counts.get('LATE', 0)  # Late = partially present
    absent   = counts['ABSENT']
    pct      = round(present / total_students * 100, 1) if total_students > 0 else 0

    return {
        'date':            str(today),
        'total_students':  total_students,
        'marked':          marked,
        'present':         counts['PRESENT'],
        'late':            counts['LATE'],
        'absent':          absent,
        'not_marked':      max(0, total_students - marked),
        'attendance_pct':  pct,
    }


def get_classwise_attendance(school_id: int, target_date: date = None) -> list:
    """Attendance breakdown by class — returns ranked list (lowest first)."""
    from app.models.academic import Attendance, Student, Class

    target_date = target_date or date.today()

    classes = Class.query.filter_by(school_id=school_id).all()
    result  = []

    for cls in classes:
        total = Student.query.filter_by(school_id=school_id, class_id=cls.id).count()
        if total == 0:
            continue

        att = db.session.query(
            Attendance.status,
            func.count(Attendance.id).label('cnt'),
        ).join(Student, Student.id == Attendance.student_id)\
         .filter(
            Student.class_id  == cls.id,
            Attendance.date   == target_date,
        ).group_by(Attendance.status).all()

        counts = {'PRESENT': 0, 'ABSENT': 0, 'LATE': 0}
        for row in att:
            counts[(row.status or 'PRESENT').upper()] = row.cnt

        present = counts['PRESENT'] + counts['LATE']
        absent  = counts['ABSENT']
        pct     = round(present / total * 100, 1)

        result.append({
            'class_id':       cls.id,
            'class_name':     f"{cls.name} {cls.section or ''}".strip(),
            'total_students': total,
            'present':        present,
            'absent':         absent,
            'attendance_pct': pct,
        })

    return sorted(result, key=lambda x: x['attendance_pct'])  # lowest first


def get_attendance_trend(school_id: int, days: int = 7, class_id: int = None) -> list:
    """Last N days attendance trend."""
    from app.models.academic import Attendance, Student

    today  = date.today()
    result = []

    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)

        total_q = db.session.query(func.count(Student.id)).filter(
            Student.school_id == school_id,
        )
        if class_id:
            total_q = total_q.filter(Student.class_id == class_id)
        total = total_q.scalar() or 0

        present_q = db.session.query(func.count(Attendance.id)).join(
            Student, Student.id == Attendance.student_id
        ).filter(
            Student.school_id == school_id,
            Attendance.date   == d,
            Attendance.status.in_(['PRESENT', 'LATE']),
        )
        if class_id:
            present_q = present_q.filter(Student.class_id == class_id)
        present = present_q.scalar() or 0

        result.append({
            'date':  str(d),
            'label': d.strftime('%a %d %b'),
            'total': total,
            'present': present,
            'pct':   round(present / total * 100, 1) if total > 0 else 0,
        })

    return result


def get_low_attendance_students(school_id: int, threshold_pct: float = 75,
                                 class_id: int = None, limit: int = 20) -> list:
    """Students with attendance below threshold_pct over last 30 days."""
    from app.models.academic import Attendance, Student, Class
    from app.models.user import User

    thirty_days_ago = date.today() - timedelta(days=30)

    q = db.session.query(
        Student.id,
        User.name,
        Class.name.label('class_name'),
        Class.section,
        func.count(Attendance.id).label('marked_days'),
        func.sum(
            db.case((Attendance.status.in_(['PRESENT', 'LATE']), 1), else_=0)
        ).label('present_days'),
    ).join(User, User.id == Student.user_id)\
     .join(Class, Class.id == Student.class_id, isouter=True)\
     .outerjoin(
        Attendance,
        and_(
            Attendance.student_id == Student.id,
            Attendance.date       >= thirty_days_ago,
        )
    ).filter(Student.school_id == school_id)

    if class_id:
        q = q.filter(Student.class_id == class_id)

    rows = q.group_by(Student.id, User.name, Class.name, Class.section)\
            .having(
                func.sum(db.case((Attendance.status.in_(['PRESENT', 'LATE']), 1), else_=0)) * 100.0
                / func.nullif(func.count(Attendance.id), 0)
                < threshold_pct
            ).order_by(
                func.sum(db.case((Attendance.status.in_(['PRESENT', 'LATE']), 1), else_=0)) * 100.0
                / func.nullif(func.count(Attendance.id), 0)
            ).limit(limit).all()

    result = []
    for r in rows:
        marked  = r.marked_days or 0
        present = r.present_days or 0
        pct     = round(present / marked * 100, 1) if marked > 0 else 0
        result.append({
            'student_id':    r.id,
            'name':          r.name,
            'class':         f"{r.class_name or ''} {r.section or ''}".strip(),
            'present_days':  present,
            'marked_days':   marked,
            'attendance_pct': pct,
        })

    return result
