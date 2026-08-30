# backend/app/services/transport_fee_service.py
"""
Central Financial Service for School Transport Management.
Guarantees single source of financial truth:
  Transport Charge -> Central FeeRecord (source='TRANSPORT') -> Central FeeTransaction (ledger)
  Transport Fine   -> Central FeeRecord (source='TRANSPORT_FINE') -> Central FeeTransaction (ledger)

Features:
- Thread-safe payment collection with double-payment prevention mutex
- Partial payment support
- Seamless two-way sync between central Fee Management and Transport Counter
- Fine creation, collection, and permanent audit-trailed waiver lifecycle
"""

import random
import string
import threading
from datetime import date, datetime
from app import db
from app.models.financial import FeeRecord, FeeTransaction
from app.models.transport_student import (
    StudentTransport, TransportFeeStructure, TransportFeeRecord,
    TransportFeeTransaction, TransportFineRecord
)
from app.models.academic import Student

_transport_payment_mutex = threading.Lock()


def _generate_receipt_no():
    """Generates unique receipt identifier: RCP-YYYYMMDD-TRN-XXXX."""
    return 'RCP-' + date.today().strftime('%Y%m%d') + '-T' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))


def generate_transport_fee_record(assignment, created_by_id=None, month=None, fee_structure_id=None, due_date=None):
    """
    Generates a billable monthly/periodic transport fee for an active student assignment.
    Creates a central FeeRecord (source='TRANSPORT', fee_type='TRANSPORT') and syncs local TransportFeeRecord.
    Duplicate-safe: will not generate a second record for the same student + month + source='TRANSPORT'.
    Returns (fee_record, status_reason).
    """
    if not assignment or assignment.status != 'ACTIVE':
        return None, 'inactive_assignment'

    month_str = month or date.today().strftime('%Y-%m')
    period_label = datetime.strptime(month_str, '%Y-%m').strftime('%B %Y') if len(month_str) == 7 and '-' in month_str else month_str

    # Check if central FeeRecord already exists
    existing = FeeRecord.query.filter_by(
        school_id=assignment.school_id,
        student_id=assignment.student_id,
        month=month_str,
        fee_type='TRANSPORT',
        source='TRANSPORT',
    ).first()
    if existing:
        return existing, 'already_exists'

    # Resolve amount from fee structure or route
    amount = 0.0
    fs = None
    if fee_structure_id:
        fs = TransportFeeStructure.query.filter_by(id=fee_structure_id, school_id=assignment.school_id).first()
    elif assignment.route_id:
        fs = TransportFeeStructure.query.filter_by(
            school_id=assignment.school_id, route_id=assignment.route_id, status='ACTIVE'
        ).first()

    if not fs:
        # Fallback to general school-wide structure
        fs = TransportFeeStructure.query.filter_by(
            school_id=assignment.school_id, route_id=None, status='ACTIVE'
        ).first()

    if fs:
        amount = float(fs.amount or 0.0)
    else:
        amount = 1500.0  # standard school default fallback

    route_name = assignment.route.name if assignment.route else 'Assigned Route'
    stop_name = assignment.pickup_stop.name if assignment.pickup_stop else (assignment.stop.name if assignment.stop else '')
    remarks = f"Transport Monthly Fee — {route_name}" + (f" ({stop_name})" if stop_name else '')

    calc_due_date = due_date or date.today().replace(day=min(10, 28))

    # 1. Create central FeeRecord
    fee_rec = FeeRecord(
        school_id=assignment.school_id,
        student_id=assignment.student_id,
        fee_type='TRANSPORT',
        amount_due=amount,
        amount_paid=0.0,
        status='PENDING',
        month=month_str,
        due_date=calc_due_date,
        source='TRANSPORT',
        source_ref_id=assignment.id,
        remarks=remarks,
        collected_by=created_by_id,
    )
    db.session.add(fee_rec)
    db.session.flush()

    # 2. Also keep TransportFeeRecord in sync if fee structure is present
    if fs:
        local_rec = TransportFeeRecord.query.filter_by(
            school_id=assignment.school_id,
            student_id=assignment.student_id,
            period_label=period_label,
        ).first()
        if not local_rec:
            local_rec = TransportFeeRecord(
                school_id=assignment.school_id,
                student_id=assignment.student_id,
                fee_structure_id=fs.id,
                period_label=period_label,
                due_date=calc_due_date,
                amount=amount,
                status='PENDING',
            )
            db.session.add(local_rec)

    return fee_rec, 'created'


def record_transport_fee_payment(record, amount, payment_mode='CASH', remarks='', collected_by_user=None, transaction_ref='', receipt_number=''):
    """
    Centralized payment collection function for Transport charges.
    Prevents double payment via thread-mutex and ledger verification.
    Guarantees consistency across Fee Management, Transport Counter, and Student Portal.
    """
    if not record:
        raise ValueError("Fee record not found")

    with _transport_payment_mutex:
        try:
            db.session.refresh(record)
        except Exception:
            pass

        # Compute actual paid directly from central FeeTransaction ledger
        total_txns_paid = db.session.query(db.func.coalesce(db.func.sum(FeeTransaction.amount), 0.0))\
                                    .filter(FeeTransaction.fee_record_id == record.id).scalar()

        effective_due = record.effective_due()
        paid_so_far   = max(record.amount_paid or 0.0, float(total_txns_paid or 0.0))
        remaining     = max(0.0, round(effective_due - paid_so_far, 2))

        if remaining <= 0 or record.status == 'PAID':
            raise ValueError("This transport fee has already been fully paid (Outstanding balance is ₹0)")

        amount = float(amount)
        if amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        if amount > remaining:
            raise ValueError(f"Payment amount ₹{amount} exceeds outstanding balance of ₹{remaining}")

        user_id = collected_by_user.id if (collected_by_user and hasattr(collected_by_user, 'id')) else (collected_by_user if isinstance(collected_by_user, int) else None)
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
            if receipt_number:
                record.receipt_no = receipt_number
            else:
                while True:
                    rno = _generate_receipt_no()
                    if not FeeRecord.query.filter_by(receipt_no=rno).first():
                        record.receipt_no = rno
                        break

        # Create central FeeTransaction entry
        txn = FeeTransaction(
            fee_record_id    = record.id,
            student_id       = record.student_id,
            school_id        = sid,
            amount           = amount,
            payment_mode     = payment_mode,
            transaction_date = date.today(),
            txn_month        = date.today().strftime('%B %Y'),
            receipt_no       = record.receipt_no,
            remarks          = remarks or f"Transport Fee Payment — Ref: {transaction_ref}".strip(),
            collected_by     = user_id,
        )
        db.session.add(txn)
        db.session.flush()

        # Synchronize local TransportFeeRecord if exists
        period_label = datetime.strptime(record.month, '%Y-%m').strftime('%B %Y') if (record.month and len(record.month) == 7 and '-' in record.month) else (record.month or '')
        local_rec = TransportFeeRecord.query.filter_by(
            school_id=sid, student_id=record.student_id, period_label=period_label
        ).first()
        if local_rec:
            local_rec.paid_amount = record.amount_paid
            local_rec.status = record.status
            db.session.add(TransportFeeTransaction(
                school_id=sid,
                fee_record_id=local_rec.id,
                amount_paid=amount,
                payment_mode=payment_mode,
                transaction_ref=transaction_ref or txn.receipt_no,
                receipt_number=txn.receipt_no,
                payment_date=datetime.utcnow(),
                collected_by=user_id,
                remarks=remarks,
            ))

        db.session.commit()
        return record, txn


def create_transport_fine(school_id, student_id, amount, fine_type='LATE_PAYMENT', reason='', created_by_user=None):
    """
    Creates a transport penalty/fine and links it with a central FeeRecord (source='TRANSPORT_FINE').
    Fine starts as OUTSTANDING until paid or waived.
    """
    amount = float(amount)
    if amount <= 0:
        raise ValueError("Fine amount must be greater than 0")

    user_id = created_by_user.id if (created_by_user and hasattr(created_by_user, 'id')) else (created_by_user if isinstance(created_by_user, int) else None)

    # 1. Create central FeeRecord
    fee_rec = FeeRecord(
        school_id=school_id,
        student_id=student_id,
        fee_type='TRANSPORT_FINE',
        amount_due=amount,
        amount_paid=0.0,
        status='PENDING',
        month=date.today().strftime('%Y-%m'),
        due_date=date.today(),
        source='TRANSPORT_FINE',
        remarks=f"Transport Penalty: {reason or fine_type}",
        collected_by=user_id,
    )
    db.session.add(fee_rec)
    db.session.flush()

    # 2. Create TransportFineRecord
    fine = TransportFineRecord(
        school_id=school_id,
        student_id=student_id,
        fee_record_id=fee_rec.id,
        amount=amount,
        amount_paid=0.0,
        waived_amount=0.0,
        fine_type=fine_type,
        reason=reason,
        status='OUTSTANDING',
        created_by=user_id,
    )
    db.session.add(fine)
    db.session.flush()

    fee_rec.source_ref_id = fine.id
    db.session.commit()
    return fine


def record_transport_fine_payment(fine, amount, payment_mode='CASH', remarks='', collected_by_user=None):
    """
    Collect payment against a TransportFineRecord, synchronizing with the linked central FeeRecord and FeeTransaction.
    """
    if not fine:
        raise ValueError("Fine record not found")

    outstanding = fine.outstanding_amount
    if outstanding <= 0 or fine.status in ('PAID', 'WAIVED'):
        raise ValueError("Fine is already settled (Outstanding is ₹0)")

    amount = float(amount)
    if amount <= 0:
        raise ValueError("Payment amount must be greater than 0")
    if amount > outstanding:
        raise ValueError(f"Payment amount ₹{amount} exceeds fine outstanding ₹{outstanding}")

    user_id = collected_by_user.id if (collected_by_user and hasattr(collected_by_user, 'id')) else (collected_by_user if isinstance(collected_by_user, int) else None)

    # Find linked central FeeRecord
    fee_rec = FeeRecord.query.get(fine.fee_record_id) if fine.fee_record_id else None
    if not fee_rec:
        fee_rec = FeeRecord.query.filter_by(
            school_id=fine.school_id, student_id=fine.student_id,
            source='TRANSPORT_FINE', source_ref_id=fine.id
        ).first()

    if fee_rec:
        record_transport_fee_payment(fee_rec, amount, payment_mode, remarks, collected_by_user)
        fine.amount_paid = fee_rec.amount_paid
        fine.payment_mode = fee_rec.payment_mode
        fine.receipt_no = fee_rec.receipt_no
        fine.collected_at = datetime.utcnow()
        fine.collected_by = user_id
        fine.status = 'PAID' if fine.outstanding_amount <= 0 else 'PARTIALLY_PAID'
    else:
        fine.amount_paid = round((fine.amount_paid or 0.0) + amount, 2)
        fine.payment_mode = payment_mode
        fine.receipt_no = _generate_receipt_no()
        fine.collected_at = datetime.utcnow()
        fine.collected_by = user_id
        fine.status = 'PAID' if fine.outstanding_amount <= 0 else 'PARTIALLY_PAID'

    db.session.commit()
    return fine


def waive_transport_fine(fine, waiver_amount, reason='', waived_by_user=None):
    """
    Waives transport fine partially or fully. Never deletes financial history.
    """
    if not fine:
        raise ValueError("Fine record not found")

    outstanding = fine.outstanding_amount
    if outstanding <= 0:
        raise ValueError("Fine is already settled")

    waiver_amount = float(waiver_amount)
    if waiver_amount <= 0:
        raise ValueError("Waiver amount must be greater than 0")
    if waiver_amount > outstanding:
        raise ValueError(f"Waiver amount ₹{waiver_amount} cannot exceed outstanding ₹{outstanding}")

    user_id = waived_by_user.id if (waived_by_user and hasattr(waived_by_user, 'id')) else (waived_by_user if isinstance(waived_by_user, int) else None)

    fine.waived_amount = round((fine.waived_amount or 0.0) + waiver_amount, 2)
    fine.waived_by = user_id
    fine.waived_at = datetime.utcnow()
    fine.waive_reason = reason or 'Waived by Principal/Authorized Admin'

    if fine.outstanding_amount <= 0:
        fine.status = 'WAIVED'
    else:
        fine.status = 'PARTIALLY_PAID'

    # Update linked FeeRecord
    fee_rec = FeeRecord.query.get(fine.fee_record_id) if fine.fee_record_id else None
    if not fee_rec:
        fee_rec = FeeRecord.query.filter_by(
            school_id=fine.school_id, student_id=fine.student_id,
            source='TRANSPORT_FINE', source_ref_id=fine.id
        ).first()

    if fee_rec:
        fee_rec.discount = (fee_rec.discount or 0.0) + waiver_amount
        fee_rec.discount_reason = fine.waive_reason
        fee_rec.adjusted_by = user_id
        fee_rec.adjusted_at = datetime.utcnow()
        if (fee_rec.amount_paid or 0.0) >= fee_rec.effective_due():
            fee_rec.status = 'WAIVED' if (fee_rec.amount_paid or 0.0) == 0 else 'PAID'

    db.session.commit()
    return fine


def sync_transport_from_fee_record(fee_record, txn):
    """
    Called from Fee Management / principal.py whenever a payment is collected against a FeeRecord
    where source in ('TRANSPORT', 'TRANSPORT_FINE').
    Guarantees instant sync of Transport module state without manual refresh.
    """
    if not fee_record or fee_record.source not in ('TRANSPORT', 'TRANSPORT_FINE'):
        return

    sid = fee_record.school_id
    student_id = fee_record.student_id

    if fee_record.source == 'TRANSPORT':
        period_label = datetime.strptime(fee_record.month, '%Y-%m').strftime('%B %Y') if (fee_record.month and len(fee_record.month) == 7 and '-' in fee_record.month) else (fee_record.month or '')
        local_rec = TransportFeeRecord.query.filter_by(
            school_id=sid, student_id=student_id, period_label=period_label
        ).first()
        if local_rec:
            local_rec.paid_amount = fee_record.amount_paid
            local_rec.status = fee_record.status
            if txn:
                db.session.add(TransportFeeTransaction(
                    school_id=sid,
                    fee_record_id=local_rec.id,
                    amount_paid=txn.amount,
                    payment_mode=txn.payment_mode or fee_record.payment_mode or 'CASH',
                    transaction_ref=txn.receipt_no or fee_record.receipt_no,
                    receipt_number=txn.receipt_no or fee_record.receipt_no,
                    payment_date=txn.transaction_date or datetime.utcnow(),
                    collected_by=txn.collected_by,
                    remarks=txn.remarks or 'Paid via Fee Management',
                ))

    elif fee_record.source == 'TRANSPORT_FINE':
        fine = TransportFineRecord.query.get(fee_record.source_ref_id) if fee_record.source_ref_id else None
        if not fine:
            fine = TransportFineRecord.query.filter_by(fee_record_id=fee_record.id).first()

        if fine:
            fine.amount_paid = (fine.amount_paid or 0.0) + (txn.amount if txn else fee_record.amount_paid or 0.0)
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
