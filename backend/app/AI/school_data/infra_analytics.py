"""
Transport, Hostel, Library Analytics
"""
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

def get_hostel_summary(school_id: int) -> dict:
    """Occupancy across all hostels."""
    from app.models.hostel import Hostel, HostelBed, HostelRoom, HostelFloor, HostelBuilding

    hostels = Hostel.query.filter_by(school_id=school_id, status='ACTIVE').all()
    total_beds = 0
    occupied   = 0

    for h in hostels:
        beds = HostelBed.query.join(HostelRoom).join(HostelFloor).join(HostelBuilding)\
                  .filter(HostelBuilding.hostel_id == h.id).all()
        total_beds += len(beds)
        occupied   += sum(1 for b in beds if b.status == 'OCCUPIED')

    vacant     = total_beds - occupied
    occ_pct    = round(occupied / total_beds * 100, 1) if total_beds > 0 else 0

    return {
        'total_hostels':    len(hostels),
        'total_beds':       total_beds,
        'occupied_beds':    occupied,
        'vacant_beds':      vacant,
        'occupancy_pct':    occ_pct,
        'residents':        occupied,
    }


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

