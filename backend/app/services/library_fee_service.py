from datetime import date, datetime
from app import db
from app.models.financial import FeeRecord, FeeTransaction
from app.models.academic import Student
from app.models.library import FineTransaction, LibraryMember


def generate_library_fine_fee_record(fine_txn, created_by=None):
    """
    Creates or updates the corresponding FeeRecord (source='LIBRARY', source_ref_id=fine_txn.id)
    in Fee Management when a FineTransaction is created.
    The fine is created as OUTSTANDING / PENDING — never automatically marked as paid.
    """
    existing = FeeRecord.query.filter_by(
        source='LIBRARY', source_ref_id=fine_txn.id
    ).first()
    if existing:
        existing.amount_due = fine_txn.amount
        existing.amount_paid = fine_txn.amount_paid or 0.0
        existing.discount = fine_txn.waived_amount or 0.0
        return existing, 'updated'

    member  = fine_txn.member or LibraryMember.query.get(fine_txn.member_id)
    student = Student.query.filter_by(user_id=member.user_id).first() if member else None
    if not student:
        return None, 'not_a_student'  # Teacher/Staff fine

    rec = FeeRecord(
        school_id=fine_txn.school_id,
        student_id=student.id,
        fee_type='LIBRARY',
        source='LIBRARY',
        source_ref_id=fine_txn.id,
        amount_due=fine_txn.amount,
        amount_paid=fine_txn.amount_paid or 0.0,
        discount=fine_txn.waived_amount or 0.0,
        discount_reason=fine_txn.waive_reason or '',
        status='PENDING' if fine_txn.status in ('OUTSTANDING', 'PENDING') else fine_txn.canonical_status,
        month=date.today().strftime('%Y-%m'),
        due_date=date.today(),
        remarks=f'Library penalty — {fine_txn.reason or "FINE"}',
    )
    db.session.add(rec)
    return rec, 'created'


def record_library_fine_payment(fine_txn, payment_amount, payment_mode='CASH', collected_by_user_id=None, remarks=''):
    """
    Single source of truth for payment collection:
    Collects payment on a library fine, creates a real FeeTransaction ledger entry,
    and atomically updates both FeeRecord and FineTransaction.
    """
    if fine_txn.outstanding_amount <= 0 or fine_txn.status in ('PAID', 'WAIVED', 'CANCELLED'):
        raise ValueError('Fine is already fully settled or waived. No payment required.')

    # Cap payment to current outstanding
    collect_amt = min(float(payment_amount), float(fine_txn.outstanding_amount))
    if collect_amt <= 0:
        raise ValueError('Payment amount must be greater than 0.')

    sid = fine_txn.school_id
    today = date.today()
    now = datetime.utcnow()

    # 1. Update FineTransaction
    fine_txn.amount_paid = round((fine_txn.amount_paid or 0.0) + collect_amt, 2)
    if fine_txn.outstanding_amount <= 0:
        fine_txn.status = 'PAID'
    else:
        fine_txn.status = 'PARTIALLY_PAID'

    fine_txn.collected_by = collected_by_user_id
    fine_txn.collected_at = now
    fine_txn.payment_mode = payment_mode

    # 2. Sync to FeeRecord and create FeeTransaction if member is a student
    fee_rec = FeeRecord.query.filter_by(source='LIBRARY', source_ref_id=fine_txn.id).first()
    if not fee_rec:
        fee_rec, _ = generate_library_fine_fee_record(fine_txn, created_by=collected_by_user_id)
        db.session.flush()

    if fee_rec:
        fee_rec.amount_paid = fine_txn.amount_paid
        fee_rec.payment_mode = payment_mode
        fee_rec.paid_date = today
        fee_rec.collected_by = collected_by_user_id
        fee_rec.remarks = remarks or f'Collected via Library (Fine #{fine_txn.id})'

        if fee_rec.amount_paid >= fee_rec.effective_due():
            fee_rec.status = 'PAID'
        elif fee_rec.amount_paid > 0:
            fee_rec.status = 'PARTIAL'

        # Generate receipt_no if not present
        if not fee_rec.receipt_no:
            import random
            import string
            rno = f"LIB-REC-{today.strftime('%Y%m')}-{fine_txn.id:04d}-{''.join(random.choices(string.digits, k=4))}"
            fee_rec.receipt_no = rno

        fine_txn.receipt_no = fee_rec.receipt_no

        # 3. Create real FeeTransaction entry in ledger
        txn = FeeTransaction(
            fee_record_id=fee_rec.id,
            student_id=fee_rec.student_id,
            school_id=sid,
            amount=collect_amt,
            payment_mode=payment_mode,
            transaction_date=today,
            txn_month=today.strftime('%B %Y'),
            receipt_no=fee_rec.receipt_no,
            remarks=remarks or f'Library Fine Payment — Fine #{fine_txn.id} ({fine_txn.reason})',
            collected_by=collected_by_user_id,
        )
        db.session.add(txn)
        db.session.flush()
        fine_txn.fee_transaction_id = txn.id

    return {
        'fine_id':            fine_txn.id,
        'paid_amount':        fine_txn.amount_paid,
        'outstanding_amount': fine_txn.outstanding_amount,
        'status':             fine_txn.status,
        'receipt_no':         fine_txn.receipt_no,
        'fee_transaction_id': fine_txn.fee_transaction_id,
    }


def sync_library_fine_from_fee_record(fee_record, fee_transaction=None):
    """
    Called whenever Fee Management collects payment for a FeeRecord where source='LIBRARY'.
    Syncs the payment into FineTransaction immediately and atomically.
    """
    if fee_record.source != 'LIBRARY' or not fee_record.source_ref_id:
        return

    fine_txn = FineTransaction.query.get(fee_record.source_ref_id)
    if not fine_txn:
        return

    fine_txn.amount_paid = float(fee_record.amount_paid or 0.0)
    fine_txn.waived_amount = float(fee_record.discount or 0.0)

    if fine_txn.outstanding_amount <= 0:
        fine_txn.status = 'PAID'
    elif fine_txn.amount_paid > 0:
        fine_txn.status = 'PARTIALLY_PAID'
    else:
        fine_txn.status = 'OUTSTANDING'

    if fee_record.paid_date:
        fine_txn.collected_at = datetime.combine(fee_record.paid_date, datetime.min.time())
    fine_txn.payment_mode = fee_record.payment_mode or fine_txn.payment_mode
    fine_txn.receipt_no = fee_record.receipt_no or fine_txn.receipt_no
    fine_txn.collected_by = fee_record.collected_by or fine_txn.collected_by
    if fee_transaction:
        fine_txn.fee_transaction_id = fee_transaction.id
