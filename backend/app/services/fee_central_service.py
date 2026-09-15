"""
Centralized Fee Synchronization & Unified Financial Engine
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Guarantees:
1. SINGLE CANONICAL SOURCE OF TRUTH across all modules (Principal, Finance, Student, Parent, Transport, Hostel, Library).
2. Bi-directional synchronization between FeeRecord (financial.py) and FeeBill/FeeBillItem/StudentLedger (fee_finance.py).
3. Domain-specific idempotency to prevent duplicate charges.
4. Decimal-safe monetary calculations:
   - Gross Due = amount_due
   - Net Due = amount_due + fine - discount
   - Balance = max(0, Net Due - amount_paid)
5. Multi-tenant school_id and session isolation.
"""

from datetime import datetime, date
import calendar
from decimal import Decimal, ROUND_HALF_UP
from app import db
from app.models.financial import FeeRecord, FeeTransaction
from app.models.fee_finance import (
    FeeHead, FeeBill, FeeBillItem, StudentLedger, FeePayment,
    FeePaymentAllocation, BillStatus, PaymentStatus, PaymentMode
)
from app.models.academic import Student, Class
from app.models.user import User


def round_curr(val):
    """Safe rounding for currency values to 2 decimal places."""
    if val is None:
        return 0.0
    d = Decimal(str(val))
    return float(d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def normalize_service_code(source_or_dept):
    """
    Normalizes service/department strings into canonical categories and codes.
    """
    if not source_or_dept:
        return 'ACADEMIC', 'ACCOUNTS', 'TUITION'
    s = str(source_or_dept).strip().upper()
    if 'HOSTEL_FINE' in s:
        return 'HOSTEL', 'HOSTEL', 'HOSTEL_FINE'
    if 'HOSTEL' in s:
        return 'HOSTEL', 'HOSTEL', 'HOSTEL'
    if 'TRANSPORT_FINE' in s:
        return 'TRANSPORT', 'TRANSPORT', 'TRANSPORT_FINE'
    if 'TRANSPORT' in s:
        return 'TRANSPORT', 'TRANSPORT', 'TRANSPORT'
    if 'LIB' in s:
        return 'LIBRARY', 'LIBRARY', 'LIBRARY_FINE' if 'FINE' in s else 'LIBRARY'
    if 'EXAM' in s:
        return 'EXAM', 'ACCOUNTS', 'EXAM'
    if 'ADMISSION' in s:
        return 'ACADEMIC', 'ACCOUNTS', 'ADMISSION'
    if 'ACTIVITY' in s or 'SPORTS' in s:
        return 'ACTIVITY', 'ACCOUNTS', 'ACTIVITY'
    if 'LAB' in s:
        return 'ACADEMIC', 'ACCOUNTS', 'LAB'
    if 'TUITION' in s or 'ACADEMIC' in s or 'SCHOOL' in s:
        return 'ACADEMIC', 'ACCOUNTS', 'TUITION'
    return 'OTHER', 'ACCOUNTS', s


def ensure_fee_head(school_id, code, name=None, department='ACCOUNTS', category='ACADEMIC'):
    """Ensures a FeeHead exists for the given code in the school."""
    fh = FeeHead.query.filter_by(school_id=school_id, code=code).first()
    if not fh:
        fh = FeeHead(
            school_id=school_id,
            code=code,
            name=name or code.replace('_', ' ').title(),
            department=department,
            category=category,
            is_recurring=True if code in ('TUITION', 'TRANSPORT', 'HOSTEL') else False,
            default_frequency='MONTHLY' if code in ('TUITION', 'TRANSPORT', 'HOSTEL') else 'ONE_TIME',
            is_active=True
        )
        db.session.add(fh)
        db.session.flush()
    return fh


def sync_fee_record_to_bill(fee_record):
    """
    Given a FeeRecord, ensures a matching FeeBill, FeeBillItem, and StudentLedger
    entry exist in the Unified Finance architecture.
    """
    if not fee_record or not fee_record.student_id:
        return None

    school_id = fee_record.school_id
    student_id = fee_record.student_id
    session = fee_record.session or '2026-27'
    month = fee_record.month or date.today().strftime('%Y-%m')

    # Resolve category, department, and head code
    cat, dept, head_code = normalize_service_code(fee_record.source or fee_record.fee_type)
    fee_head = ensure_fee_head(
        school_id=school_id,
        code=head_code,
        name=fee_record.fee_type or head_code.title(),
        department=dept,
        category=cat
    )

    # Normalize month label
    try:
        if '-' in month and len(month.split('-')) == 2:
            yr, mo = map(int, month.split('-'))
            month_label = f"{calendar.month_name[mo]} {yr}"
        else:
            month_label = str(month)
    except Exception:
        month_label = str(month)

    # Find or create FeeBill
    bill = FeeBill.query.filter_by(
        school_id=school_id,
        student_id=student_id,
        bill_month=month
    ).first()

    if not bill:
        count = FeeBill.query.filter_by(school_id=school_id).count() + 1
        while True:
            cand_no = f"BILL-{date.today().year}-{count:06d}"
            if not FeeBill.query.filter_by(bill_no=cand_no).first():
                bill_no = cand_no
                break
            count += 1

        bill = FeeBill(
            bill_no=bill_no,
            school_id=school_id,
            student_id=student_id,
            session=session,
            bill_month=month,
            bill_period_label=month_label,
            generation_date=date.today(),
            due_date=fee_record.due_date or date.today(),
            status=BillStatus.ISSUED.value if fee_record.status != 'DRAFT' else BillStatus.DRAFT.value,
            total_current_charges=0.0,
            total_discount=0.0,
            total_late_fine=0.0,
            total_payable=0.0,
            amount_paid=0.0,
            balance_due=0.0,
        )
        db.session.add(bill)
        db.session.flush()

    # Find or create FeeBillItem
    item = FeeBillItem.query.filter_by(bill_id=bill.id, fee_head_id=fee_head.id).first()
    amt_due = round_curr(fee_record.amount_due)
    discount = round_curr(fee_record.discount or 0.0)
    fine = round_curr(fee_record.fine or 0.0)
    net_amt = round_curr(amt_due + fine - discount)
    paid_amt = round_curr(fee_record.amount_paid or 0.0)
    bal_amt = round_curr(max(0.0, net_amt - paid_amt))

    if not item:
        item = FeeBillItem(
            bill_id=bill.id,
            fee_head_id=fee_head.id,
            department=dept,
            original_amount=amt_due,
            discount_amount=discount,
            fine_amount=fine,
            net_amount=net_amt,
            paid_amount=paid_amt,
            balance_amount=bal_amt,
            billing_frequency=fee_record.billing_frequency or 'MONTHLY',
            period_start=fee_record.period_start,
            period_end=fee_record.period_end,
            coverage_label=fee_record.coverage_label or month_label
        )
        db.session.add(item)
    else:
        item.original_amount = amt_due
        item.discount_amount = discount
        item.fine_amount = fine
        item.net_amount = net_amt
        item.paid_amount = paid_amt
        item.balance_amount = bal_amt
        item.department = dept
        if fee_record.billing_frequency:
            item.billing_frequency = fee_record.billing_frequency

    db.session.flush()
    bill.calculate_totals()

    # Post StudentLedger DEBIT entry if not exists for this fee_record
    ref_key = f"REC-{fee_record.id}"
    existing_ledger = StudentLedger.query.filter_by(
        school_id=school_id,
        student_id=student_id,
        bill_id=bill.id,
        fee_head_id=fee_head.id,
        entry_type='DEBIT'
    ).first()

    if not existing_ledger and fee_record.status != 'DRAFT':
        ledger_entry = StudentLedger(
            school_id=school_id,
            student_id=student_id,
            fee_head_id=fee_head.id,
            department=dept,
            entry_type='DEBIT',
            entry_date=date.today(),
            period_label=month_label,
            session=session,
            amount=net_amt,
            balance_after=bal_amt,
            bill_id=bill.id,
            reference_no=bill.bill_no,
            description=f"{fee_record.fee_type or fee_head.name} ({month_label})",
            created_by=fee_record.collected_by
        )
        db.session.add(ledger_entry)

    return bill


def sync_bill_item_to_fee_record(bill_item, bill):
    """
    Given a FeeBillItem and FeeBill, ensures a matching FeeRecord exists in models/financial.py.
    """
    if not bill_item or not bill:
        return None

    school_id = bill.school_id
    student_id = bill.student_id
    session = bill.session or '2026-27'
    month = bill.bill_month or date.today().strftime('%Y-%m')

    head_code = bill_item.fee_head.code if bill_item.fee_head else 'TUITION'
    cat, dept, norm_code = normalize_service_code(bill_item.department or head_code)
    fee_type_name = bill_item.fee_head.name if bill_item.fee_head else norm_code.replace('_', ' ').title()

    # Look up existing FeeRecord by student, session, month, and source/head
    record = FeeRecord.query.filter_by(
        school_id=school_id,
        student_id=student_id,
        session=session,
        month=month,
        fee_type=fee_type_name
    ).first()

    if not record:
        record = FeeRecord.query.filter_by(
            school_id=school_id,
            student_id=student_id,
            session=session,
            month=month,
            source=norm_code
        ).first()

    amt_due = round_curr(bill_item.original_amount)
    discount = round_curr(bill_item.discount_amount or 0.0)
    fine = round_curr(bill_item.fine_amount or 0.0)
    paid_amt = round_curr(bill_item.paid_amount or 0.0)
    net_amt = round_curr(amt_due + fine - discount)

    # Status derivation
    today = date.today()
    if paid_amt >= net_amt and net_amt > 0:
        st = 'PAID'
    elif paid_amt > 0:
        st = 'PARTIAL'
    elif bill.due_date and bill.due_date < today and net_amt > 0:
        st = 'OVERDUE'
    elif bill.status == BillStatus.DRAFT.value:
        st = 'DRAFT'
    else:
        st = 'PENDING'

    if not record:
        record = FeeRecord(
            school_id=school_id,
            student_id=student_id,
            fee_type=fee_type_name,
            amount_due=amt_due,
            amount_paid=paid_amt,
            discount=discount,
            fine=fine,
            status=st,
            month=month,
            billing_frequency=bill_item.billing_frequency or 'MONTHLY',
            period_start=bill_item.period_start,
            period_end=bill_item.period_end,
            coverage_label=bill_item.coverage_label or bill.bill_period_label,
            due_date=bill.due_date,
            session=session,
            source=norm_code,
            remarks=f"Bill Ref: {bill.bill_no}"
        )
        db.session.add(record)
    else:
        record.amount_due = amt_due
        record.discount = discount
        record.fine = fine
        record.amount_paid = paid_amt
        record.status = st
        record.source = norm_code
        record.due_date = bill.due_date

    db.session.flush()
    return record


class FeeCentralService:
    """Authoritative service for generating, updating and collecting student fees."""

    @staticmethod
    def generate_fee(
        school_id,
        student_id,
        fee_type,
        amount_due,
        month,
        session='2026-27',
        due_date=None,
        source='ACADEMIC',
        discount=0.0,
        fine=0.0,
        billing_frequency='MONTHLY',
        period_start=None,
        period_end=None,
        coverage_label=None,
        status='PENDING',
        batch_id=None,
        actor_user_id=None,
        force=False
    ):
        """
        Creates or updates a FeeRecord with strict domain-specific idempotency,
        and atomically synchronizes it with FeeBill, FeeBillItem, and StudentLedger.
        """
        student = Student.query.get(student_id)
        if not student:
            raise ValueError(f"Student #{student_id} not found.")

        amount_due = round_curr(amount_due)
        discount = round_curr(discount)
        fine = round_curr(fine)
        net_due = round_curr(amount_due + fine - discount)

        d_date = due_date or date.today()
        if isinstance(d_date, str):
            d_date = datetime.strptime(d_date, '%Y-%m-%d').date()

        cat, dept, norm_source = normalize_service_code(source or fee_type)

        # Idempotency check: student + session + month + (source / fee_type)
        existing = FeeRecord.query.filter_by(
            school_id=school_id,
            student_id=student_id,
            session=session,
            month=month,
            fee_type=fee_type
        ).filter(FeeRecord.status != 'CANCELLED').first()

        if not existing and norm_source != 'ACADEMIC':
            existing = FeeRecord.query.filter_by(
                school_id=school_id,
                student_id=student_id,
                session=session,
                month=month,
                source=norm_source
            ).filter(FeeRecord.status != 'CANCELLED').first()

        if existing and not force:
            return existing, False

        today = date.today()
        if status == 'DRAFT':
            rec_status = 'DRAFT'
        elif d_date < today and net_due > 0:
            rec_status = 'OVERDUE'
        else:
            rec_status = 'PENDING'

        if existing and force:
            rec = existing
            rec.amount_due = amount_due
            rec.discount = discount
            rec.fine = fine
            rec.due_date = d_date
            rec.source = norm_source
            rec.billing_frequency = billing_frequency
            rec.status = rec_status
            if batch_id:
                rec.batch_id = batch_id
        else:
            rec = FeeRecord(
                school_id=school_id,
                student_id=student_id,
                fee_type=fee_type,
                amount_due=amount_due,
                amount_paid=0.0,
                discount=discount,
                fine=fine,
                status=rec_status,
                month=month,
                billing_frequency=billing_frequency,
                period_start=period_start,
                period_end=period_end,
                coverage_label=coverage_label,
                due_date=d_date,
                session=session,
                source=norm_source,
                batch_id=batch_id,
                collected_by=actor_user_id
            )
            db.session.add(rec)

        db.session.flush()

        # Synchronize into Unified Finance tables (FeeBill, FeeBillItem, StudentLedger)
        sync_fee_record_to_bill(rec)
        db.session.commit()

        return rec, True

    @staticmethod
    def collect_payment(
        school_id,
        record_id=None,
        student_id=None,
        amount_paid=0.0,
        payment_mode='CASH',
        collected_by=None,
        remarks='',
        payment_date=None,
        receipt_no=None,
        transaction_ref=''
    ):
        """
        Processes a payment installment across both FeeRecord and FeeBill/FeePayment.
        Creates immutable FeeTransaction, FeePayment, and FeePaymentAllocation rows.
        """
        amount_paid = round_curr(amount_paid)
        if amount_paid <= 0:
            raise ValueError("Payment amount must be greater than zero.")

        p_date = payment_date or date.today()
        if isinstance(p_date, str):
            p_date = datetime.strptime(p_date, '%Y-%m-%d').date()

        collector_id = collected_by.id if (collected_by and hasattr(collected_by, 'id')) else collected_by

        # If record_id is supplied, look up the target FeeRecord
        rec = None
        if record_id:
            rec = FeeRecord.query.filter_by(id=record_id, school_id=school_id).first()
            if not rec:
                raise ValueError(f"FeeRecord #{record_id} not found.")
            student_id = rec.student_id

        student = Student.query.filter_by(id=student_id, school_id=school_id).first()
        if not student:
            raise ValueError(f"Student #{student_id} not found.")

        # Generate unique receipt number if not provided
        if not receipt_no:
            seq = FeePayment.query.filter_by(school_id=school_id).count() + 1
            while True:
                candidate = f"REC-{p_date.year}-{seq:06d}"
                if not FeePayment.query.filter_by(receipt_no=candidate).first() and not FeeRecord.query.filter_by(receipt_no=candidate).first():
                    receipt_no = candidate
                    break
                seq += 1

        session = rec.session if rec else '2026-27'
        dept = rec.source if rec else 'ACCOUNTS'

        # 1. Update target FeeRecord (if specified) or auto-distribute to oldest pending records
        records_to_settle = []
        if rec:
            records_to_settle = [rec]
        else:
            records_to_settle = FeeRecord.query.filter(
                FeeRecord.school_id == school_id,
                FeeRecord.student_id == student_id,
                FeeRecord.status.in_(['PENDING', 'PARTIAL', 'OVERDUE'])
            ).order_by(FeeRecord.due_date.asc(), FeeRecord.id.asc()).all()

        rem_to_apply = amount_paid
        created_txns = []

        for r in records_to_settle:
            if rem_to_apply <= 0:
                break
            net = r.effective_due()
            already_paid = round_curr(r.amount_paid or 0.0)
            balance = round_curr(max(0.0, net - already_paid))

            if balance <= 0:
                continue

            settle_slice = min(rem_to_apply, balance)
            r.amount_paid = round_curr(already_paid + settle_slice)
            r.payment_mode = payment_mode
            r.paid_date = p_date
            r.collected_by = collector_id
            r.receipt_no = receipt_no
            r.remarks = remarks or r.remarks

            if r.amount_paid >= net:
                r.status = 'PAID'
            elif r.amount_paid > 0:
                r.status = 'PARTIAL'

            txn = FeeTransaction(
                fee_record_id=r.id,
                student_id=student_id,
                school_id=school_id,
                amount=settle_slice,
                payment_mode=payment_mode,
                transaction_date=p_date,
                txn_month=p_date.strftime('%B %Y'),
                receipt_no=receipt_no,
                remarks=remarks or f"Payment slice for {r.fee_type}",
                collected_by=collector_id
            )
            db.session.add(txn)
            created_txns.append(txn)
            rem_to_apply = round_curr(rem_to_apply - settle_slice)

        # 2. Create Central FeePayment
        central_payment = FeePayment(
            receipt_no=receipt_no,
            school_id=school_id,
            student_id=student_id,
            session=session,
            payment_date=p_date,
            total_paid=amount_paid,
            payment_mode=payment_mode,
            transaction_ref=transaction_ref or '',
            collected_by=collector_id,
            department=dept,
            remarks=remarks,
            status=PaymentStatus.VALID.value
        )
        db.session.add(central_payment)
        db.session.flush()

        # 3. Allocate towards FeeBills & FeeBillItems
        unpaid_bills = FeeBill.query.filter(
            FeeBill.school_id == school_id,
            FeeBill.student_id == student_id,
            FeeBill.status.in_([BillStatus.ISSUED.value, BillStatus.PARTIALLY_PAID.value, BillStatus.OVERDUE.value])
        ).order_by(FeeBill.due_date.asc(), FeeBill.id.asc()).all()

        rem_bill_alloc = amount_paid
        for bill in unpaid_bills:
            if rem_bill_alloc <= 0:
                break
            for it in bill.items:
                if rem_bill_alloc <= 0:
                    break
                it_bal = round_curr(it.net_amount - (it.paid_amount or 0.0))
                if it_bal <= 0:
                    continue
                alloc_slice = min(rem_bill_alloc, it_bal)
                it.paid_amount = round_curr((it.paid_amount or 0.0) + alloc_slice)
                it.balance_amount = round_curr(max(0.0, it.net_amount - it.paid_amount))

                alloc_rec = FeePaymentAllocation(
                    payment_id=central_payment.id,
                    bill_id=bill.id,
                    bill_item_id=it.id,
                    fee_head_id=it.fee_head_id,
                    department=it.department,
                    allocated_amount=alloc_slice
                )
                db.session.add(alloc_rec)
                rem_bill_alloc = round_curr(rem_bill_alloc - alloc_slice)

            bill.amount_paid = round_curr(sum(i.paid_amount or 0.0 for i in bill.items))
            bill.calculate_totals()

        # 4. Post StudentLedger CREDIT entry
        ledger_credit = StudentLedger(
            school_id=school_id,
            student_id=student_id,
            department=dept,
            entry_type='CREDIT',
            entry_date=p_date,
            period_label=f"Payment {p_date.strftime('%b %Y')}",
            session=session,
            amount=amount_paid,
            balance_after=0.0,
            payment_id=central_payment.id,
            reference_no=receipt_no,
            description=f"Fee Payment Collected ({payment_mode}) - Receipt #{receipt_no}",
            created_by=collector_id
        )
        db.session.add(ledger_credit)

        # 5. Check if student is PROVISIONAL and promote if fee paid
        if student.status == 'PROVISIONAL':
            try:
                from app.services.admission_service import promote_provisional_student
                promote_provisional_student(student)
            except Exception as e:
                print(f"[FeeCentralService] Error promoting provisional student: {e}")

        db.session.commit()
        return rec or records_to_settle[0] if records_to_settle else None, central_payment

    @staticmethod
    def sync_all_existing_records(school_id, session=None):
        """
        Reconciliation script: ensures all historical FeeRecords have matching FeeBillItems,
        and all FeeBills have matching FeeRecords.
        """
        fee_records = FeeRecord.query.filter_by(school_id=school_id)
        if session:
            fee_records = fee_records.filter_by(session=session)
        fee_records = fee_records.all()

        synced_records = 0
        for r in fee_records:
            try:
                sync_fee_record_to_bill(r)
                synced_records += 1
            except Exception as e:
                print(f"[FeeCentralService] Error syncing FeeRecord #{r.id}: {e}")

        # Scan FeeBills to FeeRecords
        bills = FeeBill.query.filter_by(school_id=school_id)
        if session:
            bills = bills.filter_by(session=session)
        bills = bills.all()

        synced_bills = 0
        for b in bills:
            for item in b.items:
                try:
                    sync_bill_item_to_fee_record(item, b)
                    synced_bills += 1
                except Exception as e:
                    print(f"[FeeCentralService] Error syncing FeeBillItem #{item.id}: {e}")

        db.session.commit()
        return {
            'synced_fee_records': synced_records,
            'synced_bill_items': synced_bills
        }
