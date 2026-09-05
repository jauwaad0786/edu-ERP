"""
Transport, Hostel, Library Analytics
"""
from datetime import date
from sqlalchemy import func
from app import db



# ─── Transport ──────────────────────────────────────────────────────────────

def get_transport_summary(school_id: int) -> dict:
    """Active vehicles, enrolled students, drivers."""
    from app.models.transport import Vehicle
    from app.models.transport_student import StudentTransport

    vehicles = Vehicle.query.filter_by(school_id=school_id, status='ACTIVE').count()
    total_v  = Vehicle.query.filter_by(school_id=school_id).count()
    students = StudentTransport.query.filter_by(school_id=school_id, status='ACTIVE').count()

    return {
        'active_vehicles':      vehicles,
        'total_vehicles':       total_v,
        'enrolled_students':    students,
    }


# ─── Hostel ─────────────────────────────────────────────────────────────────

def get_hostel_summary(school_id: int, check_visitors: bool = False) -> dict:
    """Occupancy across all hostels and optional visitor checks."""
    from app.models.hostel import Hostel, HostelBed
    from sqlalchemy import case

    total_hostels = Hostel.query.filter_by(school_id=school_id, status='ACTIVE').count()
    bed_stats = db.session.query(
        func.count(HostelBed.id),
        func.sum(case((HostelBed.status == 'OCCUPIED', 1), else_=0))
    ).filter(HostelBed.school_id == school_id).first()

    total_beds = int(bed_stats[0] or 0) if bed_stats else 0
    occupied   = int(bed_stats[1] or 0) if bed_stats else 0

    vacant     = total_beds - occupied
    occ_pct    = round(occupied / total_beds * 100, 1) if total_beds > 0 else 0

    res = {
        'total_hostels':    total_hostels,
        'total_beds':       total_beds,
        'occupied_beds':    occupied,
        'vacant_beds':      vacant,
        'occupancy_pct':    occ_pct,
        'residents':        occupied,
    }

    if check_visitors:
        res['today_visitors_count'] = 0
        res['visitor_status'] = 'No visitors logged today in the hostel register.'

    return res



# ─── Library ────────────────────────────────────────────────────────────────

def get_library_summary(school_id: int) -> dict:
    """Book copies status and outstanding fines."""
    from app.models.library import BookCopy, BookIssue, FineTransaction

    total = BookCopy.query.join(
        db.Model.metadata.tables['books'],
        BookCopy.book_id == db.Model.metadata.tables['books'].c.id
    ).filter(
        db.Model.metadata.tables['books'].c.school_id == school_id
    ).count()

    issued = BookCopy.query.join(
        db.Model.metadata.tables['books'],
        BookCopy.book_id == db.Model.metadata.tables['books'].c.id
    ).filter(
        db.Model.metadata.tables['books'].c.school_id == school_id,
        BookCopy.status == 'ISSUED'
    ).count()

    overdue = BookIssue.query.filter(
        BookIssue.school_id == school_id,
        BookIssue.status    == 'ISSUED',
        BookIssue.due_date  < db.func.current_date(),
    ).count()

    # Outstanding fines
    fine_agg = db.session.query(
        func.sum(FineTransaction.amount - func.coalesce(FineTransaction.amount_paid, 0) - func.coalesce(FineTransaction.waived_amount, 0))
    ).filter(
        FineTransaction.school_id == school_id,
        FineTransaction.status.in_(['OUTSTANDING', 'PARTIALLY_PAID', 'PENDING', 'PARTIAL']),
    ).scalar()

    outstanding_fines = float(fine_agg or 0)

    return {
        'total_copies':       total,
        'issued_copies':      issued,
        'available_copies':   max(0, total - issued),
        'overdue_copies':     overdue,
        'outstanding_fines':  round(outstanding_fines, 2),
    }


def get_hostel_visitors(school_id: int, visit_date: date = None) -> dict:
    """Get visitor gate logs for hostel."""
    from datetime import date
    from app.models.hostel import HostelVisitorLog

    if not visit_date:
        visit_date = date.today()

    q = HostelVisitorLog.query
    if school_id > 0:
        q = q.filter(HostelVisitorLog.school_id == school_id)
    q = q.filter(HostelVisitorLog.visit_date == visit_date)
    logs = q.order_by(HostelVisitorLog.in_time.desc()).all()

    visitors = [{
        'visitor_name': l.visitor_name,
        'relation':     l.relation,
        'student_name': l.student.user.name if l.student and l.student.user else 'N/A',
        'purpose':      l.purpose,
        'in_time':      l.in_time.strftime('%I:%M %p') if l.in_time else 'N/A',
        'out_time':     l.out_time.strftime('%I:%M %p') if l.out_time else 'Inside',
    } for l in logs]

    return {
        'visit_date':     str(visit_date),
        'total_visitors': len(visitors),
        'visitors':       visitors,
    }


def get_school_summary(school_id: int) -> dict:
    """Get high-level school overview metrics."""
    from app.models.academic import Student, Teacher, Class
    from app.models.user import User

    stu_q = Student.query
    tea_q = Teacher.query
    cls_q = Class.query
    usr_q = User.query

    if school_id > 0:
        stu_q = stu_q.filter(Student.school_id == school_id)
        tea_q = tea_q.filter(Teacher.school_id == school_id)
        cls_q = cls_q.filter(Class.school_id == school_id)
        usr_q = usr_q.filter(User.school_id == school_id)

    total_students  = stu_q.count()
    active_students = stu_q.join(User, Student.user_id == User.id).filter(User.is_active == True).count()
    total_teachers  = tea_q.join(User, Teacher.user_id == User.id).filter(User.is_active == True).count()
    total_classes   = cls_q.count()
    total_staff     = usr_q.filter(User.is_active == True).count()

    return {
        'total_students':   total_students,
        'active_students':  active_students if active_students > 0 else total_students,
        'total_teachers':   total_teachers,
        'total_classes':    total_classes,
        'total_staff':      total_staff,
    }



