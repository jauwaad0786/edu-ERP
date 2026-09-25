"""
Extended Fee Analytics — Class-wise, Late Payments, On-time Payments,
Transport Pending, Cross-domain (Low Attendance + Pending Fees).
All calculations are DB-side only — never Python-side aggregation of raw rows.
"""
from datetime import date
from sqlalchemy import func, and_, case
from app import db


def get_classwise_fee_summary(school_id: int, month: int = None, year: int = None) -> list:
    """
    Class-wise fee collection, pending, and collection rate.
    Ordered by outstanding DESC (highest pending first).
    """
    from app.models.financial import FeeRecord
    from app.models.academic import Student, Class

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    rows = db.session.query(
        Class.id.label('class_id'),
        Class.name.label('class_name'),
        Class.section,
        func.count(func.distinct(FeeRecord.student_id)).label('student_count'),
        func.sum(FeeRecord.amount_due).label('total_due'),
        func.sum(FeeRecord.amount_paid).label('total_paid'),
        func.sum(FeeRecord.fine).label('total_fine'),
        func.sum(FeeRecord.discount).label('total_discount'),
    ).join(Student, Student.class_id == Class.id)\
     .join(FeeRecord, FeeRecord.student_id == Student.id)\
     .filter(
        Class.school_id     == school_id,
        Student.school_id   == school_id,
        FeeRecord.school_id == school_id,
        FeeRecord.month     == month_str,
    ).group_by(Class.id, Class.name, Class.section)\
     .order_by(func.sum(FeeRecord.amount_due - FeeRecord.amount_paid).desc())\
     .all()

    result = []
    for r in rows:
        due      = float(r.total_due or 0)
        paid     = float(r.total_paid or 0)
        fine     = float(r.total_fine or 0)
        discount = float(r.total_discount or 0)
        outstanding = max(0, due + fine - discount - paid)
        rate        = round(paid / due * 100, 1) if due > 0 else 0
        result.append({
            'class_id':    r.class_id,
            'class_name':  f"{r.class_name} {r.section or ''}".strip(),
            'students':    r.student_count or 0,
            'total_due':   round(due, 2),
            'collected':   round(paid, 2),
            'outstanding': round(outstanding, 2),
            'rate':        rate,
            'month':       month_str,
        })
    return result


def get_new_admissions(school_id: int, session: str = None) -> dict:
    """
    Count and list new student admissions for the given session.
    Falls back to current academic year session if not specified.
    """
    from app.models.academic import Student, Class
    from app.models.user import User
    from datetime import date

    today = date.today()
    if not session:
        # Standard Indian academic session (April–March)
        year_start = today.year if today.month >= 4 else today.year - 1
        session = f"{year_start}-{str(year_start + 1)[-2:]}"

    # Students whose session matches
    q = db.session.query(
        func.count(Student.id).label('total'),
    ).filter(
        Student.school_id == school_id,
        Student.is_deleted == False,
    )

    # Try session field
    try:
        q_session = q.filter(Student.session == session)
        total = q_session.scalar() or 0
    except Exception:
        total = 0

    # Classwise breakdown
    classwise = []
    try:
        rows = db.session.query(
            Class.name.label('class_name'),
            Class.section,
            func.count(Student.id).label('count'),
        ).join(Student, Student.class_id == Class.id)\
         .filter(
            Class.school_id   == school_id,
            Student.school_id == school_id,
            Student.is_deleted == False,
            Student.session   == session,
        ).group_by(Class.id, Class.name, Class.section)\
         .order_by(func.count(Student.id).desc())\
         .all()

        classwise = [{
            'class': f"{r.class_name} {r.section or ''}".strip(),
            'count': r.count,
        } for r in rows]
    except Exception:
        pass

    return {
        'session':         session,
        'total_admissions': total,
        'top_classes':     classwise[:5],
    }


def get_late_payers(school_id: int, month: int = None, year: int = None,
                    limit: int = 20) -> list:
    """
    Students who paid fees AFTER the due date (late payers).
    Canonical definition: paid_date > due_date AND status in (PAID, PARTIAL).
    """
    from app.models.financial import FeeRecord
    from app.models.academic import Student, Class
    from app.models.user import User

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    try:
        rows = db.session.query(
            Student.id,
            User.name,
            Class.name.label('class_name'),
            Class.section,
            FeeRecord.amount_paid,
            FeeRecord.amount_due,
            FeeRecord.paid_date,
            FeeRecord.due_date,
        ).join(User,      User.id   == Student.user_id)\
         .join(Class,     Class.id  == Student.class_id, isouter=True)\
         .join(FeeRecord, FeeRecord.student_id == Student.id)\
         .filter(
            Student.school_id   == school_id,
            FeeRecord.school_id == school_id,
            FeeRecord.month     == month_str,
            FeeRecord.status.in_(['PAID', 'PARTIAL']),
            FeeRecord.paid_date != None,
            FeeRecord.due_date  != None,
            FeeRecord.paid_date > FeeRecord.due_date,
        ).order_by(FeeRecord.paid_date.desc())\
         .limit(limit).all()
    except Exception:
        return []

    return [{
        'student_id':  r.id,
        'name':        r.name,
        'class':       f"{r.class_name or ''} {r.section or ''}".strip(),
        'amount_paid': round(float(r.amount_paid or 0), 2),
        'amount_due':  round(float(r.amount_due or 0), 2),
        'paid_date':   str(r.paid_date) if r.paid_date else 'N/A',
        'due_date':    str(r.due_date)  if r.due_date  else 'N/A',
    } for r in rows]


def get_ontime_payers(school_id: int, month: int = None, year: int = None,
                      limit: int = 20) -> list:
    """
    Students who paid fees ON or BEFORE the due date.
    Canonical definition: paid_date <= due_date AND status in (PAID, PARTIAL).
    """
    from app.models.financial import FeeRecord
    from app.models.academic import Student, Class
    from app.models.user import User

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    try:
        rows = db.session.query(
            Student.id,
            User.name,
            Class.name.label('class_name'),
            Class.section,
            FeeRecord.amount_paid,
            FeeRecord.paid_date,
        ).join(User,      User.id   == Student.user_id)\
         .join(Class,     Class.id  == Student.class_id, isouter=True)\
         .join(FeeRecord, FeeRecord.student_id == Student.id)\
         .filter(
            Student.school_id   == school_id,
            FeeRecord.school_id == school_id,
            FeeRecord.month     == month_str,
            FeeRecord.status.in_(['PAID', 'PARTIAL']),
            FeeRecord.paid_date != None,
            FeeRecord.due_date  != None,
            FeeRecord.paid_date <= FeeRecord.due_date,
        ).order_by(FeeRecord.paid_date)\
         .limit(limit).all()
    except Exception:
        return []

    return [{
        'student_id':  r.id,
        'name':        r.name,
        'class':       f"{r.class_name or ''} {r.section or ''}".strip(),
        'amount_paid': round(float(r.amount_paid or 0), 2),
        'paid_date':   str(r.paid_date) if r.paid_date else 'N/A',
    } for r in rows]


def get_transport_pending_students(school_id: int, month: int = None,
                                   year: int = None, limit: int = 20) -> dict:
    """
    Students using transport who have pending transport fees.
    Cross-domain: StudentTransport JOIN FeeRecord(source='TRANSPORT').
    """
    from app.models.transport_student import StudentTransport
    from app.models.financial import FeeRecord
    from app.models.academic import Student, Class
    from app.models.user import User

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    # Total transport-enrolled students
    total_transport = StudentTransport.query.filter_by(
        school_id=school_id, status='ACTIVE'
    ).count()

    try:
        rows = db.session.query(
            Student.id,
            User.name,
            Class.name.label('class_name'),
            Class.section,
            func.sum(FeeRecord.amount_due).label('due'),
            func.sum(FeeRecord.amount_paid).label('paid'),
        ).join(User,      User.id == Student.user_id)\
         .join(Class,     Class.id == Student.class_id, isouter=True)\
         .join(FeeRecord, FeeRecord.student_id == Student.id)\
         .join(StudentTransport, StudentTransport.student_id == Student.id)\
         .filter(
            Student.school_id      == school_id,
            FeeRecord.school_id    == school_id,
            StudentTransport.school_id == school_id,
            StudentTransport.status == 'ACTIVE',
            FeeRecord.month        == month_str,
            FeeRecord.source       == 'TRANSPORT',
            FeeRecord.status.in_(['PENDING', 'PARTIAL']),
        ).group_by(Student.id, User.name, Class.name, Class.section)\
         .order_by(func.sum(FeeRecord.amount_due - FeeRecord.amount_paid).desc())\
         .limit(limit).all()
    except Exception:
        return {
            'month': month_str,
            'total_transport_students': total_transport,
            'pending_count': 0,
            'students': [],
        }

    students = []
    for r in rows:
        due  = float(r.due  or 0)
        paid = float(r.paid or 0)
        students.append({
            'student_id':   r.id,
            'name':         r.name,
            'class':        f"{r.class_name or ''} {r.section or ''}".strip(),
            'outstanding':  round(max(0, due - paid), 2),
        })

    return {
        'month':                    month_str,
        'total_transport_students': total_transport,
        'pending_count':            len(students),
        'students':                 students,
    }


def get_low_attendance_pending_fees(school_id: int, att_threshold: float = 75,
                                    month: int = None, year: int = None,
                                    limit: int = 20) -> dict:
    """
    Cross-domain: Students with BOTH low attendance (<75%) AND pending fees.
    This is a high-priority alert list for principals.
    """
    from datetime import timedelta
    from app.models.academic import Student, Class, Attendance
    from app.models.financial import FeeRecord
    from app.models.user import User

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str    = f"{year}-{month:02d}"
    thirty_days_ago = today - timedelta(days=30)

    try:
        # Step 1: Get students with low attendance
        att_q = db.session.query(
            Student.id.label('student_id'),
        ).join(User, User.id == Student.user_id)\
         .outerjoin(
            Attendance,
            and_(Attendance.student_id == Student.id,
                 Attendance.date >= thirty_days_ago)
         ).filter(Student.school_id == school_id)\
          .group_by(Student.id)\
          .having(
            func.sum(case((Attendance.status.in_(['PRESENT', 'LATE']), 1), else_=0)) * 100.0
            / func.nullif(func.count(Attendance.id), 0) < att_threshold
         ).subquery()

        # Step 2: Join with pending fees
        rows = db.session.query(
            Student.id,
            User.name,
            Class.name.label('class_name'),
            Class.section,
            func.sum(FeeRecord.amount_due).label('fee_due'),
            func.sum(FeeRecord.amount_paid).label('fee_paid'),
        ).join(att_q, att_q.c.student_id == Student.id)\
         .join(User,      User.id  == Student.user_id)\
         .join(Class,     Class.id == Student.class_id, isouter=True)\
         .join(FeeRecord, FeeRecord.student_id == Student.id)\
         .filter(
            Student.school_id   == school_id,
            FeeRecord.school_id == school_id,
            FeeRecord.month     == month_str,
            FeeRecord.status.in_(['PENDING', 'PARTIAL']),
         ).group_by(Student.id, User.name, Class.name, Class.section)\
          .order_by(func.sum(FeeRecord.amount_due - FeeRecord.amount_paid).desc())\
          .limit(limit).all()
    except Exception:
        return {
            'month':           month_str,
            'att_threshold':   att_threshold,
            'total_at_risk':   0,
            'students':        [],
        }

    students = []
    for r in rows:
        due  = float(r.fee_due  or 0)
        paid = float(r.fee_paid or 0)
        students.append({
            'student_id':  r.id,
            'name':        r.name,
            'class':       f"{r.class_name or ''} {r.section or ''}".strip(),
            'outstanding': round(max(0, due - paid), 2),
        })

    return {
        'month':         month_str,
        'att_threshold': att_threshold,
        'total_at_risk': len(students),
        'students':      students,
    }
