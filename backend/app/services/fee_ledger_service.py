"""
Central Student Financial Ledger & School Finance Service Engine
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Core Workflows:
- Real-time 360° Student Financial Ledger
- Advance Demand Billing (Pre-due fee notices with duplicate prevention)
- Multi-Department Fee Management & Synchronisation (Accounts, Transport, Hostel, Library)
- Payment Collection with Multi-Fee-Head Allocation
- Concessions & Scholarships with Audit Trails
- Receipt Cancellation & Authorized Refunds
- Executive Finance Reporting, Expense Reconciliation & Net Surplus
"""

from datetime import datetime, date
import calendar
from app import db
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentFeeAssignment,
    StudentConcession, FeeBill, FeeBillItem, StudentLedger, FeePayment,
    FeePaymentAllocation, FeeRefund, FinancialAuditLog,
    FeeCategory, FeeDepartment, FeeFrequency, BillStatus, PaymentMode, PaymentStatus
)
from app.models.academic import Student, Class
from app.models.finance import Expense
from app.models.user import User


# ── Default Fee Heads Initializer ────────────────────────────────────────────

DEFAULT_FEE_HEADS = [
    {
        'code': 'TUITION', 'name': 'Tuition Fee', 'category': FeeCategory.ACADEMIC.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Tuition Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.MONTHLY.value, 'is_refundable': False
    },
    {
        'code': 'TRANSPORT', 'name': 'Transport Fee', 'category': FeeCategory.TRANSPORT.value,
        'department': FeeDepartment.TRANSPORT.value, 'income_account': 'Transport Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.MONTHLY.value, 'is_refundable': False
    },
    {
        'code': 'HOSTEL', 'name': 'Hostel & Mess Fee', 'category': FeeCategory.HOSTEL.value,
        'department': FeeDepartment.HOSTEL.value, 'income_account': 'Hostel Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.MONTHLY.value, 'is_refundable': False
    },
    {
        'code': 'LIBRARY_FINE', 'name': 'Library Late Fine / Damage', 'category': FeeCategory.LIBRARY.value,
        'department': FeeDepartment.LIBRARY.value, 'income_account': 'Library Income',
        'is_recurring': False, 'default_frequency': FeeFrequency.ONE_TIME.value, 'is_refundable': False
    },
    {
        'code': 'EXAM', 'name': 'Examination Fee', 'category': FeeCategory.EXAM.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Exam Fee Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.QUARTERLY.value, 'is_refundable': False
    },
    {
        'code': 'ADMISSION', 'name': 'Admission / Registration Fee', 'category': FeeCategory.ACADEMIC.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Admission Income',
        'is_recurring': False, 'default_frequency': FeeFrequency.ONE_TIME.value, 'is_refundable': False
    },
    {
        'code': 'ACTIVITY', 'name': 'Activity & Sports Fee', 'category': FeeCategory.ACTIVITY.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Activity Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.ANNUAL.value, 'is_refundable': False
    },
    {
        'code': 'LAB', 'name': 'Science & Computer Lab Fee', 'category': FeeCategory.ACADEMIC.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Lab Income',
        'is_recurring': True, 'default_frequency': FeeFrequency.ANNUAL.value, 'is_refundable': False
    },
    {
        'code': 'MISC', 'name': 'Miscellaneous Charges', 'category': FeeCategory.OTHER.value,
        'department': FeeDepartment.ACCOUNTS.value, 'income_account': 'Misc Income',
        'is_recurring': False, 'default_frequency': FeeFrequency.ONE_TIME.value, 'is_refundable': False
    },
]


def ensure_default_fee_heads(school_id):
    """Ensures standard Fee Heads exist for a school."""
    existing_codes = {fh.code for fh in FeeHead.query.filter_by(school_id=school_id).all()}
    added = False
    for item in DEFAULT_FEE_HEADS:
        if item['code'] not in existing_codes:
            fh = FeeHead(
                school_id=school_id,
                code=item['code'],
                name=item['name'],
                category=item['category'],
                department=item['department'],
                income_account=item['income_account'],
                is_recurring=item['is_recurring'],
                default_frequency=item['default_frequency'],
                is_refundable=item['is_refundable'],
            )
            db.session.add(fh)
            added = True
    if added:
        db.session.commit()


# ═══════════════════════════════════════════════════════════════════════
#  1. STUDENT FINANCIAL LEDGER (360° VIEW)
# ═══════════════════════════════════════════════════════════════════════

def get_student_ledger(student_id, session=None):
    """
    Computes complete 360° financial status for a student:
    - Total Billed / Charged
    - Total Paid
    - Outstanding Balance
    - Advance Credit Balance
    - Itemized Bills, Payments, and Concessions
    """
    student = Student.query.get(student_id)
    if not student:
        return None

    # Filter by session if provided
    bill_query = FeeBill.query.filter_by(student_id=student_id).filter(FeeBill.status != BillStatus.CANCELLED.value)
    pay_query  = FeePayment.query.filter_by(student_id=student_id, status=PaymentStatus.VALID.value)
    ledger_query = StudentLedger.query.filter_by(student_id=student_id)
    concessions_query = StudentConcession.query.filter_by(student_id=student_id, is_active=True)

    if session:
        bills_session = bill_query.filter_by(session=session).order_by(FeeBill.bill_month.desc(), FeeBill.id.desc()).all()
        if bills_session:
            bills = bills_session
            pay_query = pay_query.filter_by(session=session)
            ledger_query = ledger_query.filter_by(session=session)
            concessions_query = concessions_query.filter_by(session=session)
        else:
            # Fallback to all active bills if no bills found for specific session tag
            bills = bill_query.order_by(FeeBill.bill_month.desc(), FeeBill.id.desc()).all()
    else:
        bills = bill_query.order_by(FeeBill.bill_month.desc(), FeeBill.id.desc()).all()

    payments = pay_query.order_by(FeePayment.payment_date.desc(), FeePayment.id.desc()).all()
    ledger_entries = ledger_query.order_by(StudentLedger.entry_date.desc(), StudentLedger.id.desc()).all()
    concessions = concessions_query.all()

    total_billed = sum(b.total_payable for b in bills)
    total_paid   = sum(p.total_paid for p in payments)
    outstanding  = sum(b.balance_due for b in bills)
    advance_credit = max(0.0, total_paid - total_billed) if total_paid > total_billed else 0.0

    class_name = f"{student.class_ref.name} {student.class_ref.section or ''}".strip() if student.class_ref else '—'
    father_name = student.father_name or student.parent_name or ''
    parent_phone = student.parent_phone or getattr(student, 'phone', '') or ''
    roll_number = getattr(student, 'roll_number', '') or getattr(student, 'roll_no', '') or ''

    bills_dict = [b.to_dict() for b in bills]
    pending_bills_dict = [b for b in bills_dict if (b.get('balance_due') or 0) > 0]

    student_dict = {
        'id':           student.id,
        'name':         student.user.name if student.user else '',
        'admission_no': student.admission_no or '',
        'roll_no':      roll_number,
        'roll_number':  roll_number,
        'class_id':     student.class_id,
        'class_name':   class_name,
        'father_name':  father_name,
        'mother_name':  getattr(student, 'mother_name', '') or '',
        'parent_name':  student.parent_name or father_name,
        'parent_phone': parent_phone,
        'parent_email': getattr(student, 'parent_email', '') or '',
        'photo_url':    getattr(student, 'photo_url', '') or '',
    }

    services_status = get_student_services_status(student_id)

    return {
        'student':        student_dict,
        'student_id':     student.id,
        'student_name':   student.user.name if student.user else '',
        'admission_no':   student.admission_no,
        'roll_no':        roll_number,
        'father_name':    father_name,
        'parent_phone':   parent_phone,
        'class_id':       student.class_id,
        'class_name':     class_name,
        'session':        session or getattr(student, 'session', '2026-27'),
        'services':       services_status,
        'total_billed':   round(total_billed, 2),
        'total_paid':     round(total_paid, 2),
        'outstanding':    round(outstanding, 2),
        'advance_credit': round(advance_credit, 2),
        'bills':          bills_dict,
        'pending_bills':  pending_bills_dict,
        'payments':       [p.to_dict() for p in payments],
        'ledger_entries': [e.to_dict() for e in ledger_entries],
        'concessions':    [c.to_dict() for c in concessions],
    }


# ═══════════════════════════════════════════════════════════════════════
#  2. STUDENT SERVICES & SUBSCRIPTIONS DETECTOR
# ═══════════════════════════════════════════════════════════════════════

def get_student_services_status(student_id):
    """
    Returns real-time enrollment status for all school services:
    - Academic (Class & Section)
    - Transport (Bus Route, Stop, Monthly Fare)
    - Hostel & Mess (Room, Bed, Fee)
    - Library Membership (Card No, Issues, Overdue Fines)
    - Scholarships / Concessions
    """
    student = Student.query.get(student_id)
    if not student:
        return {}

    # 1. Transport Service Status
    trans_info = {'active': False, 'status': 'INACTIVE', 'details': 'Day Scholar (No Transport)', 'monthly_fee': 0.0}
    try:
        from app.models.transport_student import StudentTransport
        st_trans = StudentTransport.query.filter_by(student_id=student_id, status='ACTIVE').first()
        if st_trans:
            r_name = st_trans.route.name if st_trans.route else 'Assigned Route'
            s_name = st_trans.pickup_stop.name if st_trans.pickup_stop else (st_trans.stop.name if st_trans.stop else 'Bus Stop')
            fare = 1200.0
            if st_trans.stop and hasattr(st_trans.stop, 'monthly_fee') and st_trans.stop.monthly_fee:
                fare = float(st_trans.stop.monthly_fee)
            elif st_trans.pickup_stop and hasattr(st_trans.pickup_stop, 'monthly_fee') and st_trans.pickup_stop.monthly_fee:
                fare = float(st_trans.pickup_stop.monthly_fee)

            trans_info = {
                'active':      True,
                'status':      'ACTIVE',
                'route_id':    st_trans.route_id,
                'route_name':  r_name,
                'stop_name':   s_name,
                'details':     f"{r_name} • {s_name}",
                'monthly_fee': fare,
            }
    except Exception:
        pass

    # 2. Hostel & Mess Service Status
    hostel_info = {'active': False, 'status': 'INACTIVE', 'details': 'Non-Hosteller (Day Scholar)', 'monthly_fee': 0.0}
    try:
        from app.models.hostel import HostelBedAllocation
        h_alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
        if h_alloc:
            room_no = h_alloc.bed.room.room_number if (h_alloc.bed and h_alloc.bed.room) else 'Room'
            bed_no  = h_alloc.bed.bed_number if h_alloc.bed else 'Bed'
            hostel_info = {
                'active':      True,
                'status':      'ACTIVE',
                'details':     f"Room {room_no} • Bed {bed_no}",
                'room_no':     room_no,
                'bed_no':      bed_no,
                'monthly_fee': 5000.0,
            }
    except Exception:
        pass

    # 3. Library Service Status
    library_info = {'active': False, 'status': 'INACTIVE', 'details': 'No Library Card', 'card_number': '', 'pending_fine': 0.0, 'issues_count': 0}
    try:
        from app.models.library import LibraryMember, FineTransaction
        lib_mem = LibraryMember.query.filter_by(user_id=student.user_id, school_id=student.school_id).first()
        if lib_mem and lib_mem.status == 'ACTIVE':
            issues_count = lib_mem.issues.filter_by(status='ISSUED').count()
            unpaid_fines = lib_mem.fines.filter(FineTransaction.status.in_(['OUTSTANDING', 'PENDING', 'PARTIAL', 'PARTIALLY_PAID'])).all()
            tot_fine = sum(f.outstanding_amount for f in unpaid_fines)
            library_info = {
                'active':       True,
                'status':       'ACTIVE',
                'card_number':  lib_mem.card_number or f"LIB-{student.id}",
                'issues_count': issues_count,
                'details':      f"Card: {lib_mem.card_number or 'Active'} • {issues_count} Books Borrowed",
                'pending_fine': round(tot_fine, 2),
                'monthly_fee':  150.0,
            }
    except Exception:
        pass

    # 4. Concessions & Scholarships
    concessions = StudentConcession.query.filter_by(
        student_id=student_id, approval_status='APPROVED', is_active=True
    ).all()
    conc_list = [c.to_dict() for c in concessions]

    return {
        'academic': {
            'class_id':   student.class_id,
            'class_name': f"{student.class_ref.name} {student.class_ref.section or ''}".strip() if student.class_ref else '—',
        },
        'transport':   trans_info,
        'hostel':      hostel_info,
        'library':     library_info,
        'concessions': conc_list,
    }


# ═══════════════════════════════════════════════════════════════════════
#  3. APPLICABLE CHARGES CALCULATOR (DYNAMIC MULTI-SERVICE ENGINE)
# ═══════════════════════════════════════════════════════════════════════

def get_student_applicable_charges(student_id, session='2026-27', bill_month=None):
    """
    Evaluates applicable charges for a student across all departments:
    1. Class default fee structure (Tuition, Development, etc.)
    2. Transport service charges (ONLY if actively enrolled in Transport)
    3. Hostel & Mess charges (ONLY if actively allocated a bed in Hostel)
    4. Library facility fee / late fines (ONLY if registered Library member)
    5. Deducts active Student Concessions / Scholarships / Waivers
    """
    student = Student.query.get(student_id)
    if not student:
        return []

    ensure_default_fee_heads(student.school_id)

    # Fetch active fee heads map
    fee_heads = {fh.code: fh for fh in FeeHead.query.filter_by(school_id=student.school_id, is_active=True).all()}
    fee_heads_by_id = {fh.id: fh for fh in fee_heads.values()}

    # Student custom overrides & exemptions
    custom_assignments = {
        ca.fee_head_id: ca for ca in StudentFeeAssignment.query.filter_by(
            student_id=student_id, session=session, is_active=True
        ).all()
    }

    # Active student concessions
    concessions = StudentConcession.query.filter_by(
        student_id=student_id, session=session, approval_status='APPROVED', is_active=True
    ).all()

    charges = []

    # ── 1. Academic & Class Structure Rates ──────────────────────────────
    struct = FeeStructureV2.query.filter_by(
        school_id=student.school_id, class_id=student.class_id, session=session, is_active=True
    ).first()

    if not struct:
        # Fallback to school-wide structure or any active structure for this class
        struct = FeeStructureV2.query.filter_by(
            school_id=student.school_id, class_id=student.class_id, is_active=True
        ).first() or FeeStructureV2.query.filter_by(
            school_id=student.school_id, class_id=None, is_active=True
        ).first()

    if struct and struct.items:
        for itm in struct.items:
            fh = fee_heads_by_id.get(itm.fee_head_id)
            if not fh:
                continue

            # Don't duplicate transport/hostel/library if already handled dynamically below
            if fh.category in ('TRANSPORT', 'HOSTEL', 'LIBRARY'):
                continue

            # Check for student specific exemption / custom override
            ca = custom_assignments.get(itm.fee_head_id)
            if ca and ca.is_exempt:
                continue # Student is exempt from this charge

            base_amt = ca.custom_amount if (ca and ca.custom_amount is not None) else itm.amount

            # Calculate concession for this specific head
            disc = 0.0
            for conc in concessions:
                if conc.fee_head_id is None or conc.fee_head_id == itm.fee_head_id:
                    if conc.discount_type == 'PERCENTAGE':
                        disc += (base_amt * conc.discount_value / 100.0)
                    else:
                        disc += conc.discount_value

            disc = min(disc, base_amt)
            net_amt = round(max(0.0, base_amt - disc), 2)

            charges.append({
                'fee_head_id':     fh.id,
                'fee_head_name':   fh.name,
                'fee_head_code':   fh.code,
                'department':      fh.department or 'ACCOUNTS',
                'original_amount': round(base_amt, 2),
                'discount_amount': round(disc, 2),
                'fine_amount':     0.0,
                'net_amount':      net_amt,
            })
    else:
        # Fallback default tuition if no structure exists
        tuition_head = fee_heads.get('TUITION')
        if tuition_head:
            ca = custom_assignments.get(tuition_head.id)
            if not (ca and ca.is_exempt):
                base_amt = ca.custom_amount if (ca and ca.custom_amount is not None) else 3000.0
                disc = 0.0
                for conc in concessions:
                    if conc.fee_head_id is None or conc.fee_head_id == tuition_head.id:
                        if conc.discount_type == 'PERCENTAGE':
                            disc += (base_amt * conc.discount_value / 100.0)
                        else:
                            disc += conc.discount_value
                disc = min(disc, base_amt)
                charges.append({
                    'fee_head_id':     tuition_head.id,
                    'fee_head_name':   tuition_head.name,
                    'fee_head_code':   tuition_head.code,
                    'department':      'ACCOUNTS',
                    'original_amount': round(base_amt, 2),
                    'discount_amount': round(disc, 2),
                    'fine_amount':     0.0,
                    'net_amount':      round(base_amt - disc, 2),
                })

    # ── 2. Transport Department Integration (ONLY IF ACTIVE IN TRANSPORT) ──
    try:
        from app.models.transport_student import StudentTransport
        st_trans = StudentTransport.query.filter_by(student_id=student_id, status='ACTIVE').first()
        if st_trans:
            trans_head = fee_heads.get('TRANSPORT')
            if trans_head:
                ca = custom_assignments.get(trans_head.id)
                if not (ca and ca.is_exempt):
                    trans_amt = 1200.0
                    if st_trans.stop and hasattr(st_trans.stop, 'monthly_fee') and st_trans.stop.monthly_fee:
                        trans_amt = float(st_trans.stop.monthly_fee)
                    elif st_trans.pickup_stop and hasattr(st_trans.pickup_stop, 'monthly_fee') and st_trans.pickup_stop.monthly_fee:
                        trans_amt = float(st_trans.pickup_stop.monthly_fee)
                    if ca and ca.custom_amount is not None:
                        trans_amt = ca.custom_amount

                    disc = 0.0
                    for conc in concessions:
                        if conc.fee_head_id == trans_head.id:
                            if conc.discount_type == 'PERCENTAGE':
                                disc += (trans_amt * conc.discount_value / 100.0)
                            else:
                                disc += conc.discount_value
                    disc = min(disc, trans_amt)

                    charges.append({
                        'fee_head_id':     trans_head.id,
                        'fee_head_name':   f"{trans_head.name} ({st_trans.route.name if st_trans.route else 'Bus'})",
                        'fee_head_code':   trans_head.code,
                        'department':      'TRANSPORT',
                        'original_amount': round(trans_amt, 2),
                        'discount_amount': round(disc, 2),
                        'fine_amount':     0.0,
                        'net_amount':      round(max(0.0, trans_amt - disc), 2),
                    })
    except Exception:
        pass

    # ── 3. Hostel Department Integration (ONLY IF ACTIVE IN HOSTEL) ───────
    try:
        from app.models.hostel import HostelBedAllocation
        h_alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
        if h_alloc:
            hostel_head = fee_heads.get('HOSTEL')
            if hostel_head:
                ca = custom_assignments.get(hostel_head.id)
                if not (ca and ca.is_exempt):
                    h_amt = 5000.0
                    if ca and ca.custom_amount is not None:
                        h_amt = ca.custom_amount

                    disc = 0.0
                    for conc in concessions:
                        if conc.fee_head_id == hostel_head.id:
                            if conc.discount_type == 'PERCENTAGE':
                                disc += (h_amt * conc.discount_value / 100.0)
                            else:
                                disc += conc.discount_value
                    disc = min(disc, h_amt)

                    charges.append({
                        'fee_head_id':     hostel_head.id,
                        'fee_head_name':   hostel_head.name,
                        'fee_head_code':   hostel_head.code,
                        'department':      'HOSTEL',
                        'original_amount': round(h_amt, 2),
                        'discount_amount': round(disc, 2),
                        'fine_amount':     0.0,
                        'net_amount':      round(max(0.0, h_amt - disc), 2),
                    })
    except Exception:
        pass

    # ── 4. Library Department Integration (ONLY IF ACTIVE MEMBER) ─────────
    try:
        from app.models.library import LibraryMember, FineTransaction
        lib_member = LibraryMember.query.filter_by(user_id=student.user_id, school_id=student.school_id).first()
        if lib_member and lib_member.status == 'ACTIVE':
            # 4a. Library Facility Subscription
            lib_head = fee_heads.get('LIBRARY')
            if lib_head:
                ca = custom_assignments.get(lib_head.id)
                if not (ca and ca.is_exempt):
                    lib_amt = 150.0
                    if ca and ca.custom_amount is not None:
                        lib_amt = ca.custom_amount
                    charges.append({
                        'fee_head_id':     lib_head.id,
                        'fee_head_name':   f"{lib_head.name} ({lib_member.card_number or 'Member'})",
                        'fee_head_code':   lib_head.code,
                        'department':      'LIBRARY',
                        'original_amount': round(lib_amt, 2),
                        'discount_amount': 0.0,
                        'fine_amount':     0.0,
                        'net_amount':      round(lib_amt, 2),
                    })

            # 4b. Unpaid Book Late Fines
            unpaid_fines = lib_member.fines.filter(
                FineTransaction.status.in_(['OUTSTANDING', 'PENDING', 'PARTIAL', 'PARTIALLY_PAID'])
            ).all()
            tot_fine = sum(f.outstanding_amount for f in unpaid_fines)
            if tot_fine > 0:
                fine_head = fee_heads.get('LIBRARY_FINE') or lib_head
                if fine_head:
                    charges.append({
                        'fee_head_id':     fine_head.id,
                        'fee_head_name':   'Library Overdue Book Fines',
                        'fee_head_code':   'LIBRARY_FINE',
                        'department':      'LIBRARY',
                        'original_amount': round(tot_fine, 2),
                        'discount_amount': 0.0,
                        'fine_amount':     0.0,
                        'net_amount':      round(tot_fine, 2),
                    })
    except Exception:
        pass

    return charges


# ═══════════════════════════════════════════════════════════════════════
#  3. ADVANCE DEMAND BILL GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_fee_bill(student_id, bill_month, due_date, actor_user, session='2026-27', force_regenerate=False):
    """
    Generates an advance Fee Bill / Demand Notice for a student for a specific month.
    e.g., September 2026 bill generated on 25 August, due 5 September 2026.
    """
    student = Student.query.get(student_id)
    if not student:
        raise ValueError(f"Student with ID {student_id} not found.")

    # Check for existing bill for this month
    existing_bill = FeeBill.query.filter_by(
        school_id=student.school_id, student_id=student_id, bill_month=bill_month
    ).first()

    if existing_bill and not force_regenerate:
        return existing_bill, False # Already generated

    # Parse Month Label e.g. "2026-09" -> "September 2026"
    try:
        yr, mo = map(int, bill_month.split('-'))
        month_label = f"{calendar.month_name[mo]} {yr}"
    except Exception:
        month_label = bill_month

    if isinstance(due_date, str):
        due_date = datetime.strptime(due_date, '%Y-%m-%d').date()

    # Calculate Previous Dues (sum of balance_due of previous bills)
    prev_bills = FeeBill.query.filter(
        FeeBill.student_id == student_id,
        FeeBill.bill_month < bill_month,
        FeeBill.status != BillStatus.CANCELLED.value
    ).all()
    previous_dues = sum(b.balance_due for b in prev_bills)

    # Fetch applicable charges
    applicable_charges = get_student_applicable_charges(student_id, session=session, bill_month=bill_month)

    if existing_bill and force_regenerate:
        # Update existing bill
        bill = existing_bill
        bill.due_date = due_date
        bill.previous_dues = round(previous_dues, 2)
        # Clear existing items
        FeeBillItem.query.filter_by(bill_id=bill.id).delete()
    else:
        # Create new bill with unique sequential bill number
        count = FeeBill.query.filter_by(school_id=student.school_id).count() + 1
        bill_no = f"BILL-{date.today().year}-{count:06d}"

        bill = FeeBill(
            bill_no=bill_no,
            school_id=student.school_id,
            student_id=student_id,
            session=session,
            bill_month=bill_month,
            bill_period_label=month_label,
            generation_date=date.today(),
            due_date=due_date,
            previous_dues=round(previous_dues, 2),
            generated_by=actor_user.id if actor_user else None,
            status=BillStatus.ISSUED.value
        )
        db.session.add(bill)
        db.session.flush()

    # Add bill items
    for ch in applicable_charges:
        item = FeeBillItem(
            bill_id=bill.id,
            fee_head_id=ch['fee_head_id'],
            department=ch['department'],
            original_amount=ch['original_amount'],
            discount_amount=ch['discount_amount'],
            fine_amount=ch['fine_amount'],
            net_amount=ch['net_amount'],
            paid_amount=0.0,
            balance_amount=ch['net_amount'],
        )
        db.session.add(item)

    bill.calculate_totals()
    db.session.flush()

    # Post Debit Ledger Entry for the bill
    ledger_entry = StudentLedger(
        school_id=student.school_id,
        student_id=student_id,
        fee_head_id=None,
        department='ACCOUNTS',
        entry_type='DEBIT',
        entry_date=date.today(),
        period_label=month_label,
        session=session,
        amount=bill.total_payable,
        balance_after=bill.total_payable,
        bill_id=bill.id,
        reference_no=bill.bill_no,
        description=f"Fee Bill Generated for {month_label}",
        created_by=actor_user.id if actor_user else None,
    )
    db.session.add(ledger_entry)

    # Log Audit
    audit = FinancialAuditLog(
        school_id=student.school_id,
        student_id=student_id,
        action='BILL_GENERATED',
        actor_id=actor_user.id if actor_user else None,
        new_value=f"Bill No: {bill.bill_no}, Amount: ₹{bill.total_payable:.2f}",
        reason=f"Monthly Fee Demand Notice for {month_label}",
    )
    db.session.add(audit)
    db.session.commit()

    return bill, True


def bulk_generate_fee_bills(school_id, bill_month, due_date, class_id=None, section=None, student_ids=None, actor_user=None, session='2026-27', force_regenerate=False):
    """Bulk generates fee demand bills for selected or all students in a class/school."""
    query = Student.query.filter_by(school_id=school_id)

    if student_ids:
        query = query.filter(Student.id.in_(student_ids))
    elif class_id:
        query = query.filter_by(class_id=class_id)

    students = query.all()
    generated_count = 0
    skipped_count = 0

    for std in students:
        try:
            _, created = generate_fee_bill(
                student_id=std.id,
                bill_month=bill_month,
                due_date=due_date,
                actor_user=actor_user,
                session=session,
                force_regenerate=force_regenerate
            )
            if created:
                generated_count += 1
            else:
                skipped_count += 1
        except Exception:
            skipped_count += 1

    return {
        'total_students': len(students),
        'generated_count': generated_count,
        'skipped_count': skipped_count,
    }


# ═══════════════════════════════════════════════════════════════════════
#  4. PAYMENT COLLECTION & MULTI-HEAD ALLOCATION
# ═══════════════════════════════════════════════════════════════════════

def collect_fee_payment(
    student_id, amount_paid, payment_mode, transaction_ref,
    allocations=None, collected_by=None, remarks=None,
    department='ACCOUNTS', session='2026-27'
):
    """
    Collects student fee payment, generates unique receipt number,
    distributes exact amount across FeeHeads, updates bills and student ledger.
    """
    student = Student.query.get(student_id)
    if not student:
        raise ValueError(f"Student with ID {student_id} not found.")

    amount_paid = round(float(amount_paid), 2)
    if amount_paid <= 0:
        raise ValueError("Payment amount must be greater than zero.")

    # Unique Receipt Number Generation (REC-2026-000452)
    rcpt_count = FeePayment.query.filter_by(school_id=student.school_id).count() + 1
    receipt_no = f"REC-{date.today().year}-{rcpt_count:06d}"

    payment = FeePayment(
        receipt_no=receipt_no,
        school_id=student.school_id,
        student_id=student_id,
        session=session,
        payment_date=date.today(),
        total_paid=amount_paid,
        payment_mode=payment_mode or PaymentMode.CASH.value,
        transaction_ref=transaction_ref or '',
        collected_by=collected_by.id if collected_by else None,
        department=department,
        remarks=remarks or '',
        status=PaymentStatus.VALID.value,
    )
    db.session.add(payment)
    db.session.flush()

    remaining_to_allocate = amount_paid

    # ── Case A: Explicit Allocations provided ────────────────────────────
    if allocations and len(allocations) > 0:
        for alc in allocations:
            head_id = alc.get('fee_head_id')
            alc_amt = round(float(alc.get('amount', 0.0)), 2)
            bill_item_id = alc.get('bill_item_id')

            if alc_amt <= 0:
                continue

            fh = FeeHead.query.get(head_id) if head_id else None
            dept = fh.department if fh else department

            alloc_rec = FeePaymentAllocation(
                payment_id=payment.id,
                bill_id=alc.get('bill_id'),
                bill_item_id=bill_item_id,
                fee_head_id=head_id,
                department=dept,
                allocated_amount=alc_amt,
            )
            db.session.add(alloc_rec)

            # Update Bill Item if linked
            if bill_item_id:
                bi = FeeBillItem.query.get(bill_item_id)
                if bi:
                    bi.paid_amount = round((bi.paid_amount or 0.0) + alc_amt, 2)
                    bi.balance_amount = round(max(0.0, bi.net_amount - bi.paid_amount), 2)
                    if bi.bill:
                        bi.bill.amount_paid = round((bi.bill.amount_paid or 0.0) + alc_amt, 2)
                        bi.bill.calculate_totals()

            remaining_to_allocate = round(remaining_to_allocate - alc_amt, 2)

    # ── Case B: Auto-allocate against unpaid bills ────────────────────────
    else:
        unpaid_bills = FeeBill.query.filter(
            FeeBill.student_id == student_id,
            FeeBill.status.in_([BillStatus.ISSUED.value, BillStatus.PARTIALLY_PAID.value, BillStatus.OVERDUE.value])
        ).order_by(FeeBill.bill_month.asc(), FeeBill.id.asc()).all()

        for bill in unpaid_bills:
            if remaining_to_allocate <= 0:
                break

            for item in bill.items:
                if remaining_to_allocate <= 0:
                    break

                due_on_item = round(item.net_amount - (item.paid_amount or 0.0), 2)
                if due_on_item > 0:
                    alc_amt = min(remaining_to_allocate, due_on_item)
                    item.paid_amount = round((item.paid_amount or 0.0) + alc_amt, 2)
                    item.balance_amount = round(max(0.0, item.net_amount - item.paid_amount), 2)

                    alloc_rec = FeePaymentAllocation(
                        payment_id=payment.id,
                        bill_id=bill.id,
                        bill_item_id=item.id,
                        fee_head_id=item.fee_head_id,
                        department=item.department,
                        allocated_amount=alc_amt,
                    )
                    db.session.add(alloc_rec)
                    remaining_to_allocate = round(remaining_to_allocate - alc_amt, 2)

            bill.amount_paid = round(sum(it.paid_amount or 0.0 for it in bill.items), 2)
            bill.calculate_totals()

    # If any overpayment remains, store as advance credited
    if remaining_to_allocate > 0:
        payment.advance_credited = round(remaining_to_allocate, 2)

    # Post Credit Ledger Entry
    ledger_entry = StudentLedger(
        school_id=student.school_id,
        student_id=student_id,
        fee_head_id=None,
        department=department,
        entry_type='CREDIT',
        entry_date=date.today(),
        period_label=f"Payment {date.today().strftime('%b %Y')}",
        session=session,
        amount=amount_paid,
        balance_after=0.0, # Computed on read
        payment_id=payment.id,
        reference_no=payment.receipt_no,
        description=f"Fee Payment Collected ({payment_mode}) - Receipt #{payment.receipt_no}",
        created_by=collected_by.id if collected_by else None,
    )
    db.session.add(ledger_entry)

    # Audit Log
    audit = FinancialAuditLog(
        school_id=student.school_id,
        student_id=student_id,
        action='PAYMENT_COLLECTED',
        actor_id=collected_by.id if collected_by else None,
        new_value=f"Receipt: {payment.receipt_no}, Amount: ₹{amount_paid:.2f}, Mode: {payment_mode}",
        reason="Fee payment collection",
    )
    db.session.add(audit)
    db.session.commit()

    return payment


# ═══════════════════════════════════════════════════════════════════════
#  5. RECEIPT CANCELLATION & REFUNDS
# ═══════════════════════════════════════════════════════════════════════

def cancel_payment_receipt(payment_id, actor_user, cancel_reason):
    """
    Cancels a payment receipt without deleting records.
    Reverses bill allocations and posts debit ledger adjustment.
    """
    payment = FeePayment.query.get(payment_id)
    if not payment:
        raise ValueError("Payment not found.")

    if payment.status == PaymentStatus.CANCELLED.value:
        raise ValueError("Payment is already cancelled.")

    payment.status = PaymentStatus.CANCELLED.value
    payment.cancelled_by = actor_user.id if actor_user else None
    payment.cancelled_at = datetime.utcnow()
    payment.cancel_reason = cancel_reason

    # Reverse bill items
    for alc in payment.allocations:
        if alc.bill_item_id:
            bi = FeeBillItem.query.get(alc.bill_item_id)
            if bi:
                bi.paid_amount = round(max(0.0, (bi.paid_amount or 0.0) - alc.allocated_amount), 2)
                bi.balance_amount = round(bi.net_amount - bi.paid_amount, 2)
                if bi.bill:
                    bi.bill.amount_paid = round(max(0.0, (bi.bill.amount_paid or 0.0) - alc.allocated_amount), 2)
                    bi.bill.calculate_totals()

    # Post Reversal Entry in Ledger
    ledger_entry = StudentLedger(
        school_id=payment.school_id,
        student_id=payment.student_id,
        fee_head_id=None,
        department=payment.department,
        entry_type='DEBIT',
        entry_date=date.today(),
        period_label=f"Reversal {date.today().strftime('%b %Y')}",
        session=payment.session,
        amount=payment.total_paid,
        balance_after=0.0,
        payment_id=payment.id,
        reference_no=payment.receipt_no,
        description=f"Reversal of Cancelled Receipt #{payment.receipt_no}. Reason: {cancel_reason}",
        created_by=actor_user.id if actor_user else None,
    )
    db.session.add(ledger_entry)

    # Audit Log
    audit = FinancialAuditLog(
        school_id=payment.school_id,
        student_id=payment.student_id,
        action='RECEIPT_CANCELLED',
        actor_id=actor_user.id if actor_user else None,
        old_value=f"Receipt: {payment.receipt_no}, Amount: ₹{payment.total_paid:.2f}",
        new_value="STATUS: CANCELLED",
        reason=cancel_reason,
    )
    db.session.add(audit)
    db.session.commit()

    return payment


def process_fee_refund(student_id, amount, refund_mode, reason, authorized_by, payment_id=None, fee_head_id=None, reference_no=None):
    """Processes an authorized fee refund with audit log."""
    student = Student.query.get(student_id)
    if not student:
        raise ValueError("Student not found.")

    amount = round(float(amount), 2)
    if amount <= 0:
        raise ValueError("Refund amount must be greater than zero.")

    refund = FeeRefund(
        school_id=student.school_id,
        student_id=student_id,
        payment_id=payment_id,
        fee_head_id=fee_head_id,
        amount=amount,
        refund_date=date.today(),
        refund_mode=refund_mode or 'BANK_TRANSFER',
        reference_no=reference_no or '',
        reason=reason,
        authorized_by=authorized_by.id if authorized_by else None,
        status='PROCESSED',
    )
    db.session.add(refund)
    db.session.flush()

    # Post Debit adjustment into student ledger
    ledger_entry = StudentLedger(
        school_id=student.school_id,
        student_id=student_id,
        fee_head_id=fee_head_id,
        department='ACCOUNTS',
        entry_type='DEBIT',
        entry_date=date.today(),
        period_label=f"Refund {date.today().strftime('%b %Y')}",
        amount=amount,
        refund_id=refund.id,
        reference_no=reference_no or f"REF-{refund.id}",
        description=f"Fee Refund Issued: ₹{amount:.2f}. Reason: {reason}",
        created_by=authorized_by.id if authorized_by else None,
    )
    db.session.add(ledger_entry)

    audit = FinancialAuditLog(
        school_id=student.school_id,
        student_id=student_id,
        action='REFUND_ISSUED',
        actor_id=authorized_by.id if authorized_by else None,
        new_value=f"Refund ID: {refund.id}, Amount: ₹{amount:.2f}",
        reason=reason,
    )
    db.session.add(audit)
    db.session.commit()

    return refund


# ═══════════════════════════════════════════════════════════════════════
#  6. EXECUTIVE FINANCE DASHBOARD & METRICS
# ═══════════════════════════════════════════════════════════════════════

def get_finance_dashboard_metrics(school_id, session='2026-27', month=None):
    """
    Calculates executive financial metrics:
    - Total Billed, Total Collected, Outstanding, Expenses, Net Surplus
    - Service-wise breakdown (Tuition, Transport, Hostel, Library, Exam, Other)
    - Month-by-month financial progression
    - Today's collection summary & payment mode distribution
    """
    ensure_default_fee_heads(school_id)

    # Base Queries
    bill_query = FeeBill.query.filter_by(school_id=school_id, session=session).filter(FeeBill.status != BillStatus.CANCELLED.value)
    pay_query  = FeePayment.query.filter_by(school_id=school_id, session=session, status=PaymentStatus.VALID.value)
    exp_query  = Expense.query.filter_by(school_id=school_id)

    if month:
        bill_query = bill_query.filter_by(bill_month=month)
        # Match payments in this month
        try:
            yr, mo = map(int, month.split('-'))
            last_day = calendar.monthrange(yr, mo)[1]
            pay_query = pay_query.filter(FeePayment.payment_date >= date(yr, mo, 1), FeePayment.payment_date <= date(yr, mo, last_day))
            exp_query = exp_query.filter(Expense.payment_date >= date(yr, mo, 1), Expense.payment_date <= date(yr, mo, last_day))
        except Exception:
            pass

    bills_in_session = bill_query.all()
    if not bills_in_session and not month:
        # If no bills exist under this specific session tag, fallback to all active school bills
        bills = FeeBill.query.filter_by(school_id=school_id).filter(FeeBill.status != BillStatus.CANCELLED.value).all()
        payments = FeePayment.query.filter_by(school_id=school_id, status=PaymentStatus.VALID.value).all()
    else:
        bills = bills_in_session
        payments = pay_query.all()

    expenses = exp_query.all()

    total_billed    = sum(b.total_payable for b in bills)
    total_collected = sum(p.total_paid for p in payments)
    outstanding     = sum(b.balance_due for b in bills)
    total_expenses  = sum(e.amount for e in expenses)
    net_surplus     = round(total_collected - total_expenses, 2)
    collection_pct  = round((total_collected / total_billed * 100.0), 1) if total_billed > 0 else 0.0

    # ── Service-wise Breakdown ──────────────────────────────────────────
    # Group allocations and bill items by department/category
    service_stats = {
        'ACADEMIC':  {'name': 'School / Tuition Fees', 'department': 'ACCOUNTS',  'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
        'TRANSPORT': {'name': 'Transport Service',     'department': 'TRANSPORT', 'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
        'HOSTEL':    {'name': 'Hostel & Mess',         'department': 'HOSTEL',    'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
        'LIBRARY':   {'name': 'Library & Fines',       'department': 'LIBRARY',   'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
        'EXAM':      {'name': 'Examinations',          'department': 'ACCOUNTS',  'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
        'OTHER':     {'name': 'Other & Activities',    'department': 'ACCOUNTS',  'billed': 0.0, 'collected': 0.0, 'outstanding': 0.0},
    }

    for b in bills:
        for itm in b.items:
            cat = itm.fee_head.category if itm.fee_head else 'ACADEMIC'
            if cat not in service_stats:
                cat = 'OTHER'
            service_stats[cat]['billed'] = round(service_stats[cat]['billed'] + itm.net_amount, 2)
            service_stats[cat]['collected'] = round(service_stats[cat]['collected'] + (itm.paid_amount or 0.0), 2)
            service_stats[cat]['outstanding'] = round(service_stats[cat]['outstanding'] + (itm.balance_amount or 0.0), 2)

    # ── Month-wise Financial Performance ─────────────────────────────────
    # Standard Indian academic year: April (04) to March (03)
    try:
        start_year = int(session.split('-')[0])
    except Exception:
        start_year = date.today().year

    academic_months = [
        (start_year, 4, f"{start_year}-04", f"April {start_year}"),
        (start_year, 5, f"{start_year}-05", f"May {start_year}"),
        (start_year, 6, f"{start_year}-06", f"June {start_year}"),
        (start_year, 7, f"{start_year}-07", f"July {start_year}"),
        (start_year, 8, f"{start_year}-08", f"August {start_year}"),
        (start_year, 9, f"{start_year}-09", f"September {start_year}"),
        (start_year, 10, f"{start_year}-10", f"October {start_year}"),
        (start_year, 11, f"{start_year}-11", f"November {start_year}"),
        (start_year, 12, f"{start_year}-12", f"December {start_year}"),
        (start_year + 1, 1, f"{start_year+1}-01", f"January {start_year+1}"),
        (start_year + 1, 2, f"{start_year+1}-02", f"February {start_year+1}"),
        (start_year + 1, 3, f"{start_year+1}-03", f"March {start_year+1}"),
    ]

    all_school_bills = FeeBill.query.filter_by(school_id=school_id, session=session).filter(FeeBill.status != BillStatus.CANCELLED.value).all()
    all_school_payments = FeePayment.query.filter_by(school_id=school_id, session=session, status=PaymentStatus.VALID.value).all()
    all_school_expenses = Expense.query.filter_by(school_id=school_id).all()

    monthly_summary = []
    for yr, mo, key, label in academic_months:
        m_billed = sum(b.total_payable for b in all_school_bills if b.bill_month == key)
        m_out    = sum(b.balance_due for b in all_school_bills if b.bill_month == key)
        
        # Filter payments and expenses falling in this calendar month
        m_coll   = sum(p.total_paid for p in all_school_payments if p.payment_date and p.payment_date.year == yr and p.payment_date.month == mo)
        m_exp    = sum(e.amount for e in all_school_expenses if e.payment_date and e.payment_date.year == yr and e.payment_date.month == mo)
        m_net    = round(m_coll - m_exp, 2)

        monthly_summary.append({
            'month_key':   key,
            'month_label': label,
            'billed':      round(m_billed, 2),
            'collected':   round(m_coll, 2),
            'outstanding': round(m_out, 2),
            'expenses':    round(m_exp, 2),
            'net_surplus': m_net,
        })

    # ── Today's Collection Reconciliation ────────────────────────────────
    today = date.today()
    today_payments = [p for p in payments if p.payment_date == today]
    today_total = sum(p.total_paid for p in today_payments)

    modes_breakdown = {'CASH': 0.0, 'UPI': 0.0, 'CARD': 0.0, 'CHEQUE': 0.0, 'BANK_TRANSFER': 0.0, 'ONLINE': 0.0}
    collectors_breakdown = {}

    for p in today_payments:
        mode = p.payment_mode or 'CASH'
        modes_breakdown[mode] = round(modes_breakdown.get(mode, 0.0) + p.total_paid, 2)

        col_name = p.collector.name if p.collector else 'Accounts Staff'
        collectors_breakdown[col_name] = round(collectors_breakdown.get(col_name, 0.0) + p.total_paid, 2)

    # ── Class-wise Fee Collection Summary ──────────────────────────────
    classes = Class.query.filter_by(school_id=school_id).all()
    class_stats = []
    for cls in classes:
        cls_students = Student.query.filter_by(class_id=cls.id, school_id=school_id).all()
        stu_ids = {s.id for s in cls_students}
        c_billed = sum(b.total_payable for b in bills if b.student_id in stu_ids)
        c_collected = sum(p.total_paid for p in payments if p.student_id in stu_ids)
        c_out = sum(b.balance_due for b in bills if b.student_id in stu_ids)
        c_pct = round((c_collected / c_billed * 100.0), 1) if c_billed > 0 else 0.0

        class_stats.append({
            'class_id':       cls.id,
            'class_name':     f"{cls.name} {cls.section or ''}".strip(),
            'students_count': len(cls_students),
            'billed':         round(c_billed, 2),
            'collected':      round(c_collected, 2),
            'outstanding':    round(c_out, 2),
            'collection_pct': c_pct,
        })

    return {
        'session':               session,
        'filter_month':          month,
        'total_billed':          round(total_billed, 2),
        'total_collected':       round(total_collected, 2),
        'outstanding':           round(outstanding, 2),
        'total_expenses':        round(total_expenses, 2),
        'net_surplus':           net_surplus,
        'collection_percentage': collection_pct,
        'service_wise':          list(service_stats.values()),
        'class_wise':            class_stats,
        'monthly_summary':       monthly_summary,
        'today_collection': {
            'date':              today.isoformat(),
            'total_amount':      round(today_total, 2),
            'by_mode':           modes_breakdown,
            'by_collector':      [{'collector': k, 'amount': v} for k, v in collectors_breakdown.items()],
        },
    }
