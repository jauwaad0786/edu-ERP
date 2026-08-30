"""
Fee Analytics Service
All financial calculations done by the DB — never by the LLM.
Returns compact, structured dicts that are safe to send to LLM.
"""
from datetime import date
from sqlalchemy import func, and_
from app import db


def get_fee_collection_summary(school_id: int, month: int = None, year: int = None,
                                session: str = None) -> dict:
    """
    Authoritative fee collection summary using DB aggregation.
    Uses FeeRecord table from financial.py.
    """
    from app.models.financial import FeeRecord

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month

    # Build month string e.g. '2026-02' used in FeeRecord.month column
    month_str = f"{year}-{month:02d}"

    # Base query for this school and month
    q = FeeRecord.query.filter(
        FeeRecord.school_id == school_id,
        FeeRecord.month     == month_str,
    )

    # DB-level aggregations
    aggs = db.session.query(
        func.count(FeeRecord.id).label('total_records'),
        func.sum(FeeRecord.amount_due).label('total_due'),
        func.sum(FeeRecord.amount_paid).label('total_paid'),
        func.sum(FeeRecord.fine).label('total_fine'),
        func.sum(FeeRecord.discount).label('total_discount'),
    ).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.month     == month_str,
    ).first()

    total_due      = float(aggs.total_due or 0)
    total_paid     = float(aggs.total_paid or 0)
    total_fine     = float(aggs.total_fine or 0)
    total_discount = float(aggs.total_discount or 0)
    total_records  = aggs.total_records or 0

    outstanding    = max(0, total_due + total_fine - total_discount - total_paid)
    collection_pct = round(total_paid / total_due * 100, 1) if total_due > 0 else 0

    paid_count = db.session.query(func.count(FeeRecord.id)).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.month     == month_str,
        FeeRecord.status    == 'PAID',
    ).scalar() or 0

    return {
        'month':              month_str,
        'month_name':         date(year, month, 1).strftime('%B %Y'),
        'total_records':      total_records,
        'total_due':          round(total_due, 2),
        'total_collected':    round(total_paid, 2),
        'total_outstanding':  round(outstanding, 2),
        'total_fine':         round(total_fine, 2),
        'total_discount':     round(total_discount, 2),
        'collection_rate':    collection_pct,
        'paid_count':         paid_count,
        'pending_count':      total_records - paid_count,
    }


def get_fee_outstanding_summary(school_id: int) -> dict:
    """Total outstanding fees across all time (all pending/partial records)."""
    from app.models.financial import FeeRecord

    aggs = db.session.query(
        func.count(FeeRecord.id).label('pending_records'),
        func.sum(FeeRecord.amount_due).label('total_due'),
        func.sum(FeeRecord.amount_paid).label('total_paid'),
    ).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.status.in_(['PENDING', 'PARTIAL']),
    ).first()

    total_due  = float(aggs.total_due  or 0)
    total_paid = float(aggs.total_paid or 0)
    outstanding = max(0, total_due - total_paid)

    return {
        'pending_records': aggs.pending_records or 0,
        'total_outstanding': round(outstanding, 2),
        'total_due':         round(total_due, 2),
        'total_paid':        round(total_paid, 2),
    }


def get_monthly_fee_trend(school_id: int, months: int = 6) -> list:
    """Last N months fee collection trend for trend analysis."""
    from app.models.financial import FeeRecord
    from datetime import date
    import calendar

    today  = date.today()
    result = []

    for i in range(months - 1, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1

        month_str = f"{y}-{m:02d}"
        aggs = db.session.query(
            func.sum(FeeRecord.amount_paid).label('collected'),
            func.sum(FeeRecord.amount_due).label('due'),
        ).filter(
            FeeRecord.school_id == school_id,
            FeeRecord.month     == month_str,
        ).first()

        collected = float(aggs.collected or 0)
        due       = float(aggs.due or 0)
        result.append({
            'month':       month_str,
            'month_label': date(y, m, 1).strftime('%b %Y'),
            'collected':   round(collected, 2),
            'due':         round(due, 2),
            'outstanding': round(max(0, due - collected), 2),
            'rate':        round(collected / due * 100, 1) if due > 0 else 0,
        })

    return result


def get_pending_fee_students(school_id: int, month: int = None, year: int = None,
                              limit: int = 20) -> list:
    """Students with pending/partial fees — returns compact list for LLM."""
    from app.models.financial import FeeRecord
    from app.models.academic import Student, Class

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    rows = db.session.query(
        Student.id,
        func.coalesce(db.session.query(db.Model.metadata.tables['users'].c.name)
                      .filter(db.Model.metadata.tables['users'].c.id == Student.user_id)
                      .scalar_subquery(), 'Unknown').label('name'),
        Class.name.label('class_name'),
        Class.section,
        func.sum(FeeRecord.amount_due).label('due'),
        func.sum(FeeRecord.amount_paid).label('paid'),
    ).join(FeeRecord, FeeRecord.student_id == Student.id)\
     .join(Class, Class.id == Student.class_id, isouter=True)\
     .filter(
        Student.school_id  == school_id,
        FeeRecord.school_id == school_id,
        FeeRecord.month     == month_str,
        FeeRecord.status.in_(['PENDING', 'PARTIAL']),
    ).group_by(Student.id, Class.name, Class.section)\
     .order_by(func.sum(FeeRecord.amount_due - FeeRecord.amount_paid).desc())\
     .limit(limit).all()

    result = []
    for r in rows:
        due  = float(r.due  or 0)
        paid = float(r.paid or 0)
        outstanding = max(0, due - paid)
        result.append({
            'student_id':   r.id,
            'name':         r.name,
            'class':        f"{r.class_name or ''} {r.section or ''}".strip(),
            'outstanding':  round(outstanding, 2),
        })
    return result


def get_transport_fee_summary(school_id: int, month: int = None, year: int = None) -> dict:
    """Transport fee collection summary."""
    from app.models.financial import FeeRecord

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    aggs = db.session.query(
        func.count(FeeRecord.id).label('count'),
        func.sum(FeeRecord.amount_due).label('due'),
        func.sum(FeeRecord.amount_paid).label('paid'),
    ).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.source    == 'TRANSPORT',
        FeeRecord.month     == month_str,
    ).first()

    due  = float(aggs.due  or 0)
    paid = float(aggs.paid or 0)
    return {
        'month':       month_str,
        'records':     aggs.count or 0,
        'total_due':   round(due, 2),
        'collected':   round(paid, 2),
        'outstanding': round(max(0, due - paid), 2),
        'rate':        round(paid / due * 100, 1) if due > 0 else 0,
    }


def get_hostel_fee_summary(school_id: int, month: int = None, year: int = None) -> dict:
    """Hostel fee collection summary."""
    from app.models.financial import FeeRecord

    today = date.today()
    if not year:  year  = today.year
    if not month: month = today.month
    month_str = f"{year}-{month:02d}"

    aggs = db.session.query(
        func.count(FeeRecord.id).label('count'),
        func.sum(FeeRecord.amount_due).label('due'),
        func.sum(FeeRecord.amount_paid).label('paid'),
    ).filter(
        FeeRecord.school_id == school_id,
        FeeRecord.source    == 'HOSTEL',
        FeeRecord.month     == month_str,
    ).first()

    due  = float(aggs.due  or 0)
    paid = float(aggs.paid or 0)
    return {
        'month':       month_str,
        'records':     aggs.count or 0,
        'total_due':   round(due, 2),
        'collected':   round(paid, 2),
        'outstanding': round(max(0, due - paid), 2),
        'rate':        round(paid / due * 100, 1) if due > 0 else 0,
    }


def get_student_fee_status(school_id: int, student_name: str) -> dict:
    """Get complete fee payment & pending dues for a student by name."""
    from app.models.academic import Student, Class
    from app.models.financial import FeeRecord

    clean_name = student_name.strip()
    # Search student in this school (or any school if school_id is 0 / Super Admin)
    q = Student.query
    if school_id > 0:
        q = q.filter(Student.school_id == school_id)
    students = q.filter(Student.name.ilike(f'%{clean_name}%')).all()

    if not students:
        return {'found': False, 'searched_name': student_name}

    results = []
    for s in students:
        cls = Class.query.get(s.class_id) if s.class_id else None
        records = FeeRecord.query.filter_by(student_id=s.id).all()
        
        total_due   = sum(r.amount_due for r in records)
        total_paid  = sum(r.amount_paid for r in records)
        outstanding = max(0, total_due - total_paid)

        fee_details = []
        for r in records[-6:]:
            fee_details.append({
                'fee_type':    r.fee_type or 'Tuition Fee',
                'amount_due':  r.amount_due,
                'amount_paid': r.amount_paid,
                'status':      r.status,
                'month':       r.month,
            })

        results.append({
            'student_id':     s.id,
            'name':           s.name,
            'roll_number':    s.roll_number,
            'class_name':     cls.name if cls else 'N/A',
            'total_due':      round(total_due, 2),
            'total_paid':     round(total_paid, 2),
            'outstanding_due': round(outstanding, 2),
            'status':         'PAID' if outstanding == 0 and total_due > 0 else ('PARTIAL' if total_paid > 0 else 'UNPAID'),
            'recent_records': fee_details,
        })

    return {
        'found':          True,
        'total_matched':  len(results),
        'students':       results,
    }


def get_expense_summary(school_id: int, month: int = None, year: int = None) -> dict:
    """Get school operational expenses summary."""
    from app.models.finance import Expense

    q = Expense.query
    if school_id > 0:
        q = q.filter(Expense.school_id == school_id)
    if year and month:
        month_str = f"{year}-{month:02d}"
        q = q.filter(Expense.expense_date.like(f"{month_str}%"))

    expenses = q.all()
    total_amount = sum(float(e.amount or 0) for e in expenses)

    by_category = {}
    for e in expenses:
        cat = e.category or 'MISCELLANEOUS'
        by_category[cat] = by_category.get(cat, 0.0) + float(e.amount or 0)

    recent = []
    for e in sorted(expenses, key=lambda x: str(x.expense_date or ''), reverse=True)[:5]:
        recent.append({
            'title':          e.title or e.category,
            'category':       e.category,
            'amount':         float(e.amount or 0),
            'date':           str(e.expense_date),
            'payment_method': e.payment_method,
        })

    return {
        'total_expenses': round(total_amount, 2),
        'count':          len(expenses),
        'by_category':    by_category,
        'recent_expenses': recent,
    }


def get_staff_salary_status(school_id: int, staff_name: str = None) -> dict:
    """Get staff or teacher salary details and payment status."""
    from app.models.user import User
    from app.models.academic import Teacher
    from app.models.finance import StaffSalaryRecord
    from app.models.financial import SalaryRecord

    matched_staff = []

    # Search Staff Users
    user_q = User.query
    if school_id > 0:
        user_q = user_q.filter(User.school_id == school_id)
    if staff_name:
        user_q = user_q.filter(User.name.ilike(f'%{staff_name.strip()}%'))
    users = user_q.all()

    for u in users:
        sal_rec = StaffSalaryRecord.query.filter_by(user_id=u.id).order_by(StaffSalaryRecord.id.desc()).first()
        matched_staff.append({
            'name':                u.name,
            'role':                u.role.value if hasattr(u.role, 'value') else str(u.role),
            'monthly_salary':      sal_rec.amount if sal_rec else getattr(u, 'salary', 0),
            'last_payment_status': sal_rec.status if sal_rec else 'PENDING',
            'last_paid_month':     sal_rec.month if sal_rec else 'N/A',
        })

    # Search Teachers
    t_q = Teacher.query
    if school_id > 0:
        t_q = t_q.filter(Teacher.school_id == school_id)
    if staff_name:
        t_q = t_q.filter(Teacher.name.ilike(f'%{staff_name.strip()}%'))
    teachers = t_q.all()

    for t in teachers:
        t_sal = SalaryRecord.query.filter_by(teacher_id=t.id).order_by(SalaryRecord.id.desc()).first()
        matched_staff.append({
            'name':                t.name,
            'role':                'TEACHER',
            'monthly_salary':      t.salary if hasattr(t, 'salary') else (t_sal.amount if t_sal else 0),
            'last_payment_status': t_sal.status if t_sal else 'PENDING',
            'last_paid_month':     t_sal.month if t_sal else 'N/A',
        })

    return {
        'total_found':   len(matched_staff),
        'staff_members': matched_staff,
    }

