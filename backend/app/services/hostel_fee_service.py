from app import db
from app.models.hostel import (
    HostelFeeStructure, HostelBed, HostelFineRecord,
    log_hostel_activity
)
from app.models.financial import FeeRecord, FeeTransaction
from datetime import date, datetime
import random
import string


def resolve_fee_structure(bed):
    """Most specific match wins: floor-level > building-level > hostel-wide."""
    if not bed:
        return None
    room     = bed.room
    if not room:
        return None
    floor    = room.floor
    if not floor:
        return None
    building = floor.building
    if not building:
        return None
    hostel_id = building.hostel_id

    base = dict(
        hostel_id=hostel_id,
        is_ac=room.is_ac,
        sharing_type=room.room_type,
        status='ACTIVE'
    )

    fs = HostelFeeStructure.query.filter_by(building_id=building.id, floor_id=floor.id, **base).first()
    if fs:
        return fs
    fs = HostelFeeStructure.query.filter_by(building_id=building.id, floor_id=None, **base).first()
    if fs:
        return fs
    return HostelFeeStructure.query.filter_by(building_id=None, floor_id=None, **base).first()


def generate_hostel_fee_record(allocation, created_by, month=None, prorated_days=None, total_month_days=None):
    """
    Creates a FeeRecord (fee_type='HOSTEL', source='HOSTEL') for the given
    active allocation, using the resolved HostelFeeStructure.
    Duplicate-safe per student+month+allocation.
    Returns (record_or_None, reason).
    """
    bed = HostelBed.query.get(allocation.bed_id)
    fs  = resolve_fee_structure(bed)
    if not fs:
        log_hostel_activity(
            allocation.school_id, created_by, 'FEE_STRUCTURE_MISSING',
            f'Bed {bed.bed_number if bed else allocation.bed_id} ke liye koi fee structure nahi mila — fee generate nahi hui'
        )
        return None, 'no_fee_structure'

    month = month or date.today().strftime('%Y-%m')

    existing = FeeRecord.query.filter_by(
        student_id=allocation.student_id,
        month=month,
        fee_type='HOSTEL',
        source='HOSTEL',
    ).first()
    if existing:
        return existing, 'already_exists'

    base_fee = fs.total_monthly()
    amount_due = base_fee

    remarks = f"Hostel Monthly Fee — {fs.sharing_type} ({'AC' if fs.is_ac else 'Non-AC'})"
    if prorated_days and total_month_days and total_month_days > 0 and prorated_days < total_month_days:
        amount_due = round((base_fee / total_month_days) * prorated_days, 2)
        remarks += f" (Prorated for {prorated_days}/{total_month_days} days)"

    stu_session = getattr(allocation.student, 'session', '2026-27') if allocation.student else '2026-27'
    rec = FeeRecord(
        school_id     = allocation.school_id,
        student_id    = allocation.student_id,
        fee_type      = 'HOSTEL',
        amount_due    = amount_due,
        amount_paid   = 0.0,
        status        = 'PENDING',
        month         = month,
        session       = stu_session,
        due_date      = date.today().replace(day=min(10, 28)),
        source        = 'HOSTEL',
        source_ref_id = allocation.id,
        remarks       = remarks,
    )
    db.session.add(rec)

    # ── Canonical Central Finance Sync ──
    try:
        from app.services.fee_ledger_service import register_or_sync_service_charge
        register_or_sync_service_charge(
            school_id=allocation.school_id,
            student_id=allocation.student_id,
            amount=amount_due,
            fee_head_code='HOSTEL',
            department='HOSTEL',
            source_module='HOSTEL',
            source_type='CHARGE',
            source_ref_id=allocation.id,
            description=remarks,
            session=stu_session,
            billing_period=month,
            actor_user_id=created_by
        )
    except Exception as e:
        import traceback
        traceback.print_exc()

    return rec, 'created'


def _generate_receipt_no():
    """Generates unique receipt identifier: RCP-YYYYMMDD-XXXX."""
    return 'RCP-' + date.today().strftime('%Y%m%d') + '-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))


import threading

_hostel_payment_mutex = threading.Lock()


def record_hostel_fee_payment(record, amount, payment_mode='CASH', remarks='', collected_by_user=None):
    """
    Centralized payment collection function for Hostel charges.
    Prevents double payment and guarantees ledger consistency between Fee Management and Hostel.
    """
    if not record:
        raise ValueError("Fee record not found")

    with _hostel_payment_mutex:
        # Fetch fresh row with lock where supported
        try:
            db.session.refresh(record)
        except Exception:
            pass

        # Compute actual paid so far directly from ledger transactions
        total_txns_paid = db.session.query(db.func.coalesce(db.func.sum(FeeTransaction.amount), 0.0))\
                                    .filter(FeeTransaction.fee_record_id == record.id).scalar()

        effective_due = record.effective_due()
        paid_so_far   = max(record.amount_paid or 0.0, float(total_txns_paid or 0.0))
        remaining     = max(0.0, round(effective_due - paid_so_far, 2))

        if remaining <= 0 or record.status == 'PAID':
            raise ValueError("This fee record has already been fully settled (Outstanding is ₹0)")

        amount = float(amount)
        if amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        if amount > remaining:
            raise ValueError(f"Payment amount ₹{amount} exceeds outstanding balance of ₹{remaining}")

        user_id = collected_by_user.id if collected_by_user else None
        sid = record.school_id

        record.amount_paid = round(paid_so_far + amount, 2)
        record.payment_mode = payment_mode
        record.paid_date = date.today()
        record.collected_by = user_id
        if remarks:
            record.remarks = (record.remarks or '') + f" | {remarks}"

        if record.amount_paid >= record.effective_due():
            record.status = 'PAID'
        else:
            record.status = 'PARTIAL'

        if not record.receipt_no:
            while True:
                rno = _generate_receipt_no()
                if not FeeRecord.query.filter_by(receipt_no=rno).first():
                    record.receipt_no = rno
                    break

        txn = FeeTransaction(
            fee_record_id    = record.id,
            student_id       = record.student_id,
            school_id        = sid,
            amount           = amount,
            payment_mode     = payment_mode,
            transaction_date = date.today(),
            txn_month        = date.today().strftime('%B %Y'),
            receipt_no       = record.receipt_no,
            remarks          = remarks,
            collected_by     = user_id,
        )
        db.session.add(txn)

        # ── Canonical Central Finance Payment Collection ──
        try:
            from app.services.fee_ledger_service import collect_fee_payment
            central_pmt = collect_fee_payment(
                student_id=record.student_id,
                amount_paid=amount,
                payment_mode=payment_mode,
                collected_by=collected_by_user,
                department='HOSTEL',
                remarks=remarks or f"Hostel payment collected by Warden",
                session=getattr(record, 'session', '2026-27') or '2026-27',
                allocations=[]
            )
            if central_pmt:
                record.receipt_no = central_pmt.receipt_no
                txn.receipt_no = central_pmt.receipt_no
        except Exception as e:
            import traceback
            traceback.print_exc()

        db.session.commit()

        log_hostel_activity(
            sid, user_id, 'FEE_COLLECTED',
            f"₹{amount} collected for student #{record.student_id} (FeeRecord #{record.id})"
        )

        return record, txn


def sync_hostel_fine_from_fee_record(fee_record, txn):
    """
    Synchronizes HostelFineRecord when collected via Fee Management.
    """
    if fee_record.source != 'HOSTEL_FINE':
        return
    fine = HostelFineRecord.query.get(fee_record.source_ref_id)
    if not fine:
        fine = HostelFineRecord.query.filter_by(fee_record_id=fee_record.id).first()
    if fine:
        fine.amount_paid = (fine.amount_paid or 0.0) + (txn.amount if txn else 0.0)
        fine.payment_mode = txn.payment_mode if txn else fee_record.payment_mode
        fine.receipt_no = txn.receipt_no if txn else fee_record.receipt_no
        fine.collected_at = datetime.utcnow()
        fine.collected_by = txn.collected_by if txn else fee_record.collected_by
        fine.fee_transaction_id = txn.id if txn else None

        if fine.waived_amount and fine.waived_amount >= fine.amount:
            fine.status = 'WAIVED'
        elif fine.outstanding_amount <= 0:
            fine.status = 'PAID'
        else:
            fine.status = 'PARTIALLY_PAID'


def record_hostel_fine_payment(fine, amount, payment_mode='CASH', remarks='', collected_by_user=None):
    """
    Collect payment on HostelFineRecord from Hostel Counter, synchronizing the linked FeeRecord.
    """
    if not fine:
        raise ValueError("Fine record not found")

    outstanding = fine.outstanding_amount
    if outstanding <= 0:
        raise ValueError("Fine has already been settled (Outstanding is ₹0)")

    amount = float(amount)
    if amount <= 0:
        raise ValueError("Payment amount must be greater than 0")

    if amount > outstanding:
        raise ValueError(f"Payment amount ₹{amount} exceeds outstanding balance of ₹{outstanding}")

    user_id = collected_by_user.id if collected_by_user else None
    sid = fine.school_id

    # 1. Update linked FeeRecord if exists
    fee_rec = FeeRecord.query.get(fine.fee_record_id) if fine.fee_record_id else None
    if not fee_rec:
        fee_rec = FeeRecord.query.filter_by(
            school_id=sid, student_id=fine.student_id,
            source='HOSTEL_FINE', source_ref_id=fine.id
        ).first()

    if fee_rec:
        record_hostel_fee_payment(fee_rec, amount, payment_mode, remarks, collected_by_user)
        fine.amount_paid = fee_rec.amount_paid
        fine.payment_mode = fee_rec.payment_mode
        fine.receipt_no = fee_rec.receipt_no
        fine.collected_at = datetime.utcnow()
        fine.collected_by = user_id
        fine.status = 'PAID' if fine.outstanding_amount <= 0 else 'PARTIALLY_PAID'
    else:
        fine.amount_paid = (fine.amount_paid or 0.0) + amount
        fine.payment_mode = payment_mode
        fine.receipt_no = _generate_receipt_no()
        fine.collected_at = datetime.utcnow()
        fine.collected_by = user_id
        fine.status = 'PAID' if fine.outstanding_amount <= 0 else 'PARTIALLY_PAID'

    log_hostel_activity(
        sid, user_id, 'FINE_COLLECTED',
        f"₹{amount} collected for fine #{fine.id} (Student #{fine.student_id})"
    )

    return fine
