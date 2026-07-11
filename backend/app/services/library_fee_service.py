from datetime import date
from app import db
from app.models.financial import FeeRecord

def generate_library_fine_fee_record(fine_txn, created_by):
    """
    FineTransaction banne pe iske corresponding FeeRecord (source='LIBRARY')
    banata hai — Fee Management page pe bhi dikhega. source_ref_id se link
    rehta hai, taaki dono taraf se collect karne pe doosri taraf bhi sync ho.
    """
    existing = FeeRecord.query.filter_by(
        source='LIBRARY', source_ref_id=fine_txn.id
    ).first()
    if existing:
        return existing, 'already_exists'

    from app.models.academic import Student
    member  = fine_txn.member
    student = Student.query.filter_by(user_id=member.user_id).first() if member else None
    if not student:
        return None, 'not_a_student'   # teacher/staff fine — FeeRecord student-only hai

    rec = FeeRecord(
        school_id=fine_txn.school_id, student_id=student.id,
        fee_type='LIBRARY_FINE', source='LIBRARY', source_ref_id=fine_txn.id,
        amount_due=fine_txn.amount, amount_paid=fine_txn.amount_paid or 0,
        status='PENDING' if fine_txn.status == 'PENDING' else fine_txn.status,
        month=date.today().strftime('%Y-%m'), due_date=date.today(),
        remarks=f'{fine_txn.reason} fine — Library',
    )
    db.session.add(rec)
    return rec, 'created'
