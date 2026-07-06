# NEW FILE
from app import db
from app.models.hostel import HostelFeeStructure, HostelBed, log_hostel_activity
from app.models.financial import FeeRecord
from datetime import date


def resolve_fee_structure(bed):
    """Most specific match wins: floor-level > building-level > hostel-wide."""
    room     = bed.room
    floor    = room.floor
    building = floor.building
    hostel_id = building.hostel_id

    base = dict(hostel_id=hostel_id, is_ac=room.is_ac,
                sharing_type=room.room_type, status='ACTIVE')

    fs = HostelFeeStructure.query.filter_by(building_id=building.id, floor_id=floor.id, **base).first()
    if fs:
        return fs
    fs = HostelFeeStructure.query.filter_by(building_id=building.id, floor_id=None, **base).first()
    if fs:
        return fs
    return HostelFeeStructure.query.filter_by(building_id=None, floor_id=None, **base).first()


def generate_hostel_fee_record(allocation, created_by, month=None):
    """
    Creates a FeeRecord (fee_type='HOSTEL', source='HOSTEL') for the given
    active allocation, using the resolved HostelFeeStructure. Duplicate-safe
    per student+month — same guard style as principal.generate_fees().
    Returns (record_or_None, reason).
    """
    bed = HostelBed.query.get(allocation.bed_id)
    fs  = resolve_fee_structure(bed)
    if not fs:
        log_hostel_activity(
            allocation.school_id, created_by, 'FEE_STRUCTURE_MISSING',
            f'Bed {bed.bed_number} ke liye koi fee structure nahi mila — fee generate nahi hui'
        )
        return None, 'no_fee_structure'

    month = month or date.today().strftime('%Y-%m')   # same format as FeeRecord.month elsewhere

    existing = FeeRecord.query.filter_by(
        student_id=allocation.student_id, month=month,
        fee_type='HOSTEL', source='HOSTEL',
    ).first()
    if existing:
        return existing, 'already_exists'

    rec = FeeRecord(
        school_id     = allocation.school_id,
        student_id    = allocation.student_id,
        fee_type      = 'HOSTEL',
        amount_due    = fs.total_monthly(),
        amount_paid   = 0,
        status        = 'PENDING',
        month         = month,
        due_date      = date.today().replace(day=10),
        source        = 'HOSTEL',
        source_ref_id = allocation.id,
    )
    db.session.add(rec)
    return rec, 'created'
