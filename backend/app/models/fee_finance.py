"""
Unified Fee & School Finance Data Models
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Normalized Entities:
- FeeHead: Configurable service heads (Tuition, Transport, Hostel, Library Fine, Exam, Admission, Lab, Activity)
- FeeStructure & FeeStructureItem: Class/Section/Session rate cards
- StudentFeeAssignment: Student-specific fee customisations
- StudentConcession: Scholarships, sibling discounts, staff child concessions with audit trail
- FeeBill & FeeBillItem: Pre-due demand notices / bills (e.g. September 2026 bill generated on 25 August)
- StudentLedger: Central single-source-of-truth financial ledger for every student
- FeePayment & FeePaymentAllocation: Payment collection with multi-fee-head distribution
- FeeRefund: Authorized fee refunds
- FinancialAuditLog: Immutable financial audit trail
"""

from datetime import datetime, date
from enum import Enum
from app import db


# ── Enums & Constants ────────────────────────────────────────────────────────

class FeeCategory(str, Enum):
    ACADEMIC   = 'ACADEMIC'
    TRANSPORT  = 'TRANSPORT'
    HOSTEL     = 'HOSTEL'
    LIBRARY    = 'LIBRARY'
    EXAM       = 'EXAM'
    ACTIVITY   = 'ACTIVITY'
    OTHER      = 'OTHER'


class FeeDepartment(str, Enum):
    ACCOUNTS   = 'ACCOUNTS'
    TRANSPORT  = 'TRANSPORT'
    HOSTEL     = 'HOSTEL'
    LIBRARY    = 'LIBRARY'


class FeeFrequency(str, Enum):
    MONTHLY     = 'MONTHLY'
    QUARTERLY   = 'QUARTERLY'
    HALF_YEARLY = 'HALF_YEARLY'
    ANNUAL      = 'ANNUAL'
    ONE_TIME    = 'ONE_TIME'


class BillStatus(str, Enum):
    DRAFT          = 'DRAFT'
    ISSUED         = 'ISSUED'
    PARTIALLY_PAID = 'PARTIALLY_PAID'
    PAID           = 'PAID'
    OVERDUE        = 'OVERDUE'
    CANCELLED      = 'CANCELLED'


class PaymentMode(str, Enum):
    CASH          = 'CASH'
    UPI           = 'UPI'
    CARD          = 'CARD'
    BANK_TRANSFER = 'BANK_TRANSFER'
    CHEQUE        = 'CHEQUE'
    ONLINE        = 'ONLINE'


class PaymentStatus(str, Enum):
    VALID     = 'VALID'
    CANCELLED = 'CANCELLED'
    REFUNDED  = 'REFUNDED'


class ConcessionType(str, Enum):
    SCHOLARSHIP       = 'SCHOLARSHIP'
    SIBLING           = 'SIBLING'
    STAFF_CHILD       = 'STAFF_CHILD'
    PRINCIPAL_SPECIAL = 'PRINCIPAL_SPECIAL'
    FULL_WAIVER       = 'FULL_WAIVER'
    PARTIAL_WAIVER    = 'PARTIAL_WAIVER'


# ═══════════════════════════════════════════════════════════════════════
#  1. CONFIGURABLE FEE HEADS (SERVICE MASTER)
# ═══════════════════════════════════════════════════════════════════════

class FeeHead(db.Model):
    """
    Configurable services & fee heads. Allows any department (Transport, Library, Hostel,
    Academic, Lab, Sports) to define billable heads without schema alterations.
    """
    __tablename__ = 'fee_heads'

    id                = db.Column(db.Integer, primary_key=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name              = db.Column(db.String(120), nullable=False)   # e.g., Tuition Fee, Transport Fee, Library Fine
    code              = db.Column(db.String(50), nullable=False)    # TUITION, TRANSPORT, HOSTEL_FEE, LIB_FINE
    category          = db.Column(db.String(30), default=FeeCategory.ACADEMIC.value)
    department        = db.Column(db.String(30), default=FeeDepartment.ACCOUNTS.value)
    income_account    = db.Column(db.String(100), default='General School Income')

    is_recurring      = db.Column(db.Boolean, default=True)
    default_frequency = db.Column(db.String(30), default=FeeFrequency.MONTHLY.value)
    is_taxable        = db.Column(db.Boolean, default=False)
    is_refundable     = db.Column(db.Boolean, default=False)
    description       = db.Column(db.String(250), nullable=True)
    is_active         = db.Column(db.Boolean, default=True)
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'code', name='uq_fee_head_school_code'),
    )

    def to_dict(self):
        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'name':              self.name,
            'code':              self.code,
            'category':          self.category,
            'department':        self.department,
            'income_account':    self.income_account,
            'is_recurring':      self.is_recurring,
            'default_frequency': self.default_frequency,
            'is_taxable':        self.is_taxable,
            'is_refundable':     self.is_refundable,
            'description':       self.description or '',
            'is_active':         self.is_active,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  2. FEE STRUCTURE (RATE CARDS)
# ═══════════════════════════════════════════════════════════════════════

class FeeStructureV2(db.Model):
    """
    Class/Section/Session rate card template. Contains itemized FeeHead rates.
    """
    __tablename__ = 'fee_structures_v2'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)  # Null = school-wide default
    session      = db.Column(db.String(20), default='2026-27', index=True)
    name         = db.Column(db.String(150), nullable=False)   # e.g., "Class 8 Standard Fee 2026-27"
    frequency    = db.Column(db.String(30), default=FeeFrequency.MONTHLY.value)
    due_date_day = db.Column(db.Integer, default=10)           # 10th of every month
    is_active    = db.Column(db.Boolean, default=True)
    status       = db.Column(db.String(20), default='ACTIVE')  # ACTIVE / INACTIVE / ARCHIVED
    is_archived  = db.Column(db.Boolean, default=False)
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    class_ref    = db.relationship('Class', foreign_keys=[class_id])
    items        = db.relationship('FeeStructureItemV2', backref='structure_v2', cascade='all, delete-orphan')

    def total_amount(self):
        return sum(it.amount or 0.0 for it in self.items)

    def is_used(self):
        """
        Safeguard check: returns True if bills have already been issued for its class/session,
        or if it is manually flagged or referenced.
        """
        if self.class_id:
            from app.models.academic import Student
            from app.models.fee_finance import FeeBill
            st_ids = [s.id for s in Student.query.filter_by(school_id=self.school_id, class_id=self.class_id).all()]
            if st_ids:
                has_bills = FeeBill.query.filter(FeeBill.student_id.in_(st_ids), FeeBill.session == self.session).first() is not None
                if has_bills:
                    return True
        return False

    def to_dict(self):
        used = self.is_used()
        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'class_id':     self.class_id,
            'class_name':   f"{self.class_ref.name} {self.class_ref.section or ''}".strip() if self.class_ref else 'All Classes',
            'session':      self.session,
            'name':         self.name,
            'frequency':    self.frequency,
            'due_date_day': self.due_date_day,
            'total_amount': self.total_amount(),
            'is_active':    self.is_active and not self.is_archived and self.status == 'ACTIVE',
            'status':       'ARCHIVED' if self.is_archived else self.status,
            'is_archived':  bool(self.is_archived or self.status == 'ARCHIVED'),
            'is_used':      used,
            'can_delete':   not used,
            'items':        [it.to_dict() for it in self.items],
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


class FeeStructureItemV2(db.Model):
    """Itemized rate for a single FeeHead within a structure."""
    __tablename__ = 'fee_structure_items_v2'

    id           = db.Column(db.Integer, primary_key=True)
    structure_id = db.Column(db.Integer, db.ForeignKey('fee_structures_v2.id'), nullable=False, index=True)
    fee_head_id  = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=False)
    amount       = db.Column(db.Float, nullable=False, default=0.0)

    fee_head     = db.relationship('FeeHead', foreign_keys=[fee_head_id])

    def to_dict(self):
        return {
            'id':             self.id,
            'structure_id':   self.structure_id,
            'fee_head_id':    self.fee_head_id,
            'fee_head_name':  self.fee_head.name if self.fee_head else '',
            'fee_head_code':  self.fee_head.code if self.fee_head else '',
            'department':     self.fee_head.department if self.fee_head else 'ACCOUNTS',
            'amount':         self.amount,
        }


# ═══════════════════════════════════════════════════════════════════════
#  3. STUDENT FEE ASSIGNMENTS & CONCESSIONS
# ═══════════════════════════════════════════════════════════════════════

class StudentFeeAssignment(db.Model):
    """
    Individual student customized fee overrides (e.g. customized tuition,
    hostel slab, transport assignment).
    """
    __tablename__ = 'student_fee_assignments'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    fee_head_id  = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=False)
    session      = db.Column(db.String(20), default='2026-27', index=True)

    custom_amount= db.Column(db.Float, nullable=True)          # Overrides structure rate if set
    is_exempt    = db.Column(db.Boolean, default=False)        # E.g. No transport for non-bus student
    is_active    = db.Column(db.Boolean, default=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    fee_head     = db.relationship('FeeHead', foreign_keys=[fee_head_id])

    def to_dict(self):
        return {
            'id':            self.id,
            'student_id':    self.student_id,
            'fee_head_id':   self.fee_head_id,
            'fee_head_name': self.fee_head.name if self.fee_head else '',
            'fee_head_code': self.fee_head.code if self.fee_head else '',
            'session':       self.session,
            'custom_amount': self.custom_amount,
            'is_exempt':     self.is_exempt,
            'is_active':     self.is_active,
        }


class StudentConcession(db.Model):
    """
    Authorized student discount / concession / scholarship with full audit trail.
    Preserves original amount and never destroys history.
    """
    __tablename__ = 'student_concessions'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id      = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    fee_head_id     = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=True) # Null = applies to total bill
    session         = db.Column(db.String(20), default='2026-27', index=True)

    concession_type = db.Column(db.String(40), default=ConcessionType.SCHOLARSHIP.value)
    discount_type   = db.Column(db.String(20), default='FIXED')   # FIXED (₹) or PERCENTAGE (%)
    discount_value  = db.Column(db.Float, nullable=False, default=0.0)

    reason          = db.Column(db.String(300), nullable=False)
    requested_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approval_status = db.Column(db.String(20), default='APPROVED') # APPROVED / PENDING / REJECTED
    approved_at     = db.Column(db.DateTime, default=datetime.utcnow)
    is_active       = db.Column(db.Boolean, default=True)

    student         = db.relationship('Student', foreign_keys=[student_id])
    fee_head        = db.relationship('FeeHead', foreign_keys=[fee_head_id])
    approver        = db.relationship('User', foreign_keys=[approved_by])

    def to_dict(self):
        return {
            'id':              self.id,
            'student_id':      self.student_id,
            'student_name':    self.student.user.name if self.student and self.student.user else '',
            'admission_no':    self.student.admission_no if self.student else '',
            'fee_head_id':     self.fee_head_id,
            'fee_head_name':   self.fee_head.name if self.fee_head else 'All Fees',
            'session':         self.session,
            'concession_type': self.concession_type,
            'discount_type':   self.discount_type,
            'discount_value':  self.discount_value,
            'reason':          self.reason,
            'approved_by_name':self.approver.name if self.approver else 'Admin',
            'approved_at':     self.approved_at.isoformat() if self.approved_at else None,
            'approval_status': self.approval_status,
            'is_active':       self.is_active,
        }


# ═══════════════════════════════════════════════════════════════════════
#  4. FEE BILL / DEMAND SLIP (ADVANCE DEMAND NOTICE)
# ═══════════════════════════════════════════════════════════════════════

class FeeBill(db.Model):
    """
    Advance Fee Bill / Demand Notice generated before fee due date
    (e.g., September 2026 fee bill generated on 25 August, due on 5 September).
    """
    __tablename__ = 'fee_bills'

    id                 = db.Column(db.Integer, primary_key=True)
    bill_no            = db.Column(db.String(50), nullable=False, unique=True, index=True) # BILL-2026-000123
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id         = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    session            = db.Column(db.String(20), default='2026-27', index=True)

    bill_month         = db.Column(db.String(20), nullable=False, index=True) # "2026-09"
    bill_period_label  = db.Column(db.String(50), nullable=False)             # "September 2026"
    generation_date    = db.Column(db.Date, nullable=False, default=date.today)
    due_date           = db.Column(db.Date, nullable=False)

    total_current_charges = db.Column(db.Float, default=0.0)
    previous_dues         = db.Column(db.Float, default=0.0)
    total_discount        = db.Column(db.Float, default=0.0)
    total_late_fine       = db.Column(db.Float, default=0.0)
    total_payable         = db.Column(db.Float, nullable=False, default=0.0)

    amount_paid        = db.Column(db.Float, default=0.0)
    balance_due        = db.Column(db.Float, default=0.0)
    status             = db.Column(db.String(30), default=BillStatus.ISSUED.value, index=True)

    generated_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student            = db.relationship('Student', foreign_keys=[student_id])
    items              = db.relationship('FeeBillItem', backref='bill', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'student_id', 'bill_month', name='uq_fee_bill_student_month'),
    )

    def calculate_totals(self):
        curr = sum(it.net_amount or 0.0 for it in self.items)
        self.total_current_charges = round(sum(it.original_amount or 0.0 for it in self.items), 2)
        self.total_discount = round(sum(it.discount_amount or 0.0 for it in self.items), 2)
        self.total_late_fine = round(sum(it.fine_amount or 0.0 for it in self.items), 2)
        self.total_payable = round(curr + (self.previous_dues or 0.0), 2)
        self.balance_due = round(max(0.0, self.total_payable - (self.amount_paid or 0.0)), 2)

        if self.balance_due <= 0.0 and self.total_payable > 0:
            self.status = BillStatus.PAID.value
        elif (self.amount_paid or 0.0) > 0.0:
            self.status = BillStatus.PARTIALLY_PAID.value
        elif date.today() > self.due_date and self.balance_due > 0:
            self.status = BillStatus.OVERDUE.value
        else:
            self.status = BillStatus.ISSUED.value

    def to_dict(self):
        return {
            'id':                    self.id,
            'bill_no':               self.bill_no,
            'school_id':             self.school_id,
            'student_id':            self.student_id,
            'student_name':          self.student.user.name if self.student and self.student.user else '',
            'admission_no':          self.student.admission_no if self.student else '',
            'class_name':            f"{self.student.class_ref.name} {self.student.class_ref.section or ''}".strip() if self.student and self.student.class_ref else '',
            'session':               self.session,
            'bill_month':            self.bill_month,
            'bill_period_label':     self.bill_period_label,
            'generation_date':       self.generation_date.isoformat() if self.generation_date else None,
            'due_date':              self.due_date.isoformat() if self.due_date else None,
            'total_current_charges': self.total_current_charges,
            'previous_dues':         self.previous_dues,
            'total_discount':        self.total_discount,
            'total_late_fine':       self.total_late_fine,
            'total_payable':         self.total_payable,
            'amount_paid':           self.amount_paid or 0.0,
            'balance_due':           self.balance_due,
            'status':                self.status,
            'items':                 [it.to_dict() for it in self.items],
            'created_at':            self.created_at.isoformat() if self.created_at else None,
        }


class FeeBillItem(db.Model):
    """Itemized service charge on a student's monthly fee bill."""
    __tablename__ = 'fee_bill_items'

    id              = db.Column(db.Integer, primary_key=True)
    bill_id         = db.Column(db.Integer, db.ForeignKey('fee_bills.id'), nullable=False, index=True)
    fee_head_id     = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=False)
    department      = db.Column(db.String(30), default='ACCOUNTS') # ACCOUNTS / TRANSPORT / HOSTEL / LIBRARY

    original_amount   = db.Column(db.Float, nullable=False, default=0.0)
    discount_amount   = db.Column(db.Float, default=0.0)
    fine_amount       = db.Column(db.Float, default=0.0)
    net_amount        = db.Column(db.Float, nullable=False, default=0.0)
    paid_amount       = db.Column(db.Float, default=0.0)
    balance_amount    = db.Column(db.Float, default=0.0)
    billing_frequency = db.Column(db.String(20), default='MONTHLY')
    period_start      = db.Column(db.Date, nullable=True)
    period_end        = db.Column(db.Date, nullable=True)
    coverage_label    = db.Column(db.String(100), nullable=True)

    fee_head        = db.relationship('FeeHead', foreign_keys=[fee_head_id])

    def to_dict(self):
        return {
            'id':                self.id,
            'bill_id':           self.bill_id,
            'fee_head_id':       self.fee_head_id,
            'fee_head_name':     self.fee_head.name if self.fee_head else '',
            'fee_head_code':     self.fee_head.code if self.fee_head else '',
            'department':        self.department,
            'original_amount':   self.original_amount,
            'discount_amount':   self.discount_amount,
            'fine_amount':       self.fine_amount,
            'net_amount':        self.net_amount,
            'paid_amount':       self.paid_amount,
            'balance_amount':    self.balance_amount,
            'billing_frequency': self.billing_frequency or 'MONTHLY',
            'period_start':      str(self.period_start) if self.period_start else None,
            'period_end':        str(self.period_end) if self.period_end else None,
            'coverage_label':    self.coverage_label or '',
        }


# ═══════════════════════════════════════════════════════════════════════
#  5. CENTRAL STUDENT FINANCIAL LEDGER
# ═══════════════════════════════════════════════════════════════════════

class StudentLedger(db.Model):
    """
    Central financial transaction ledger. Every debit charge (tuition, transport,
    hostel, library fine) and credit (payment, concession, refund) creates an entry.
    """
    __tablename__ = 'student_ledgers'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id     = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    fee_head_id    = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=True)
    department     = db.Column(db.String(30), default='ACCOUNTS') # ACCOUNTS / TRANSPORT / HOSTEL / LIBRARY

    entry_type     = db.Column(db.String(20), nullable=False)     # DEBIT (Charge) / CREDIT (Payment/Discount)
    entry_date     = db.Column(db.Date, nullable=False, default=date.today)
    period_label   = db.Column(db.String(50), default='')         # e.g., "September 2026"
    session        = db.Column(db.String(20), default='2026-27')

    amount         = db.Column(db.Float, nullable=False, default=0.0)
    balance_after  = db.Column(db.Float, default=0.0)

    bill_id        = db.Column(db.Integer, db.ForeignKey('fee_bills.id'), nullable=True)
    payment_id     = db.Column(db.Integer, db.ForeignKey('fee_payments.id'), nullable=True)
    refund_id      = db.Column(db.Integer, nullable=True)

    reference_no   = db.Column(db.String(80), default='')         # Bill No / Receipt No / Fine Ref
    description    = db.Column(db.String(300), nullable=False)
    created_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    fee_head       = db.relationship('FeeHead', foreign_keys=[fee_head_id])

    def to_dict(self):
        return {
            'id':            self.id,
            'student_id':    self.student_id,
            'fee_head_id':   self.fee_head_id,
            'fee_head_name': self.fee_head.name if self.fee_head else 'General',
            'department':    self.department,
            'entry_type':    self.entry_type,
            'entry_date':    self.entry_date.isoformat() if self.entry_date else None,
            'period_label':  self.period_label,
            'session':       self.session,
            'amount':        self.amount,
            'balance_after': self.balance_after,
            'reference_no':  self.reference_no,
            'description':   self.description,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════
#  6. PAYMENT COLLECTION & MULTI-HEAD ALLOCATION
# ═══════════════════════════════════════════════════════════════════════

class FeePayment(db.Model):
    """
    Central payment transaction. Supports combined payment across multiple
    services (Tuition + Transport + Library) or single department payments.
    """
    __tablename__ = 'fee_payments'

    id              = db.Column(db.Integer, primary_key=True)
    receipt_no      = db.Column(db.String(50), nullable=False, unique=True, index=True) # REC-2026-000452
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id      = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    session         = db.Column(db.String(20), default='2026-27', index=True)

    payment_date    = db.Column(db.Date, nullable=False, default=date.today)
    total_paid      = db.Column(db.Float, nullable=False, default=0.0)
    payment_mode    = db.Column(db.String(30), default=PaymentMode.CASH.value)
    transaction_ref = db.Column(db.String(100), default='')       # UPI UTR / Cheque No / Bank Ref

    collected_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    department      = db.Column(db.String(30), default='ACCOUNTS') # Collecting Department
    remarks         = db.Column(db.String(300), default='')
    status          = db.Column(db.String(20), default=PaymentStatus.VALID.value) # VALID / CANCELLED

    advance_adjusted= db.Column(db.Float, default=0.0)
    advance_credited= db.Column(db.Float, default=0.0)

    cancelled_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    cancelled_at    = db.Column(db.DateTime, nullable=True)
    cancel_reason   = db.Column(db.String(300), nullable=True)

    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    student         = db.relationship('Student', foreign_keys=[student_id])
    collector       = db.relationship('User', foreign_keys=[collected_by])
    canceller       = db.relationship('User', foreign_keys=[cancelled_by])
    allocations     = db.relationship('FeePaymentAllocation', backref='payment', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':               self.id,
            'receipt_no':       self.receipt_no,
            'school_id':        self.school_id,
            'student_id':       self.student_id,
            'student_name':     self.student.user.name if self.student and self.student.user else '',
            'admission_no':     self.student.admission_no if self.student else '',
            'class_name':       f"{self.student.class_ref.name} {self.student.class_ref.section or ''}".strip() if self.student and self.student.class_ref else '',
            'session':          self.session,
            'payment_date':     self.payment_date.isoformat() if self.payment_date else None,
            'total_paid':       self.total_paid,
            'payment_mode':     self.payment_mode,
            'transaction_ref':  self.transaction_ref or '',
            'collected_by_name':self.collector.name if self.collector else 'Counter Staff',
            'collector_role':   self.collector.role if self.collector else 'STAFF',
            'department':       self.department,
            'remarks':          self.remarks or '',
            'status':           self.status,
            'allocations':      [a.to_dict() for a in self.allocations],
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


class FeePaymentAllocation(db.Model):
    """Exact distribution of a payment into individual FeeHeads / Services."""
    __tablename__ = 'fee_payment_allocations'

    id           = db.Column(db.Integer, primary_key=True)
    payment_id   = db.Column(db.Integer, db.ForeignKey('fee_payments.id'), nullable=False, index=True)
    bill_id      = db.Column(db.Integer, db.ForeignKey('fee_bills.id'), nullable=True)
    bill_item_id = db.Column(db.Integer, db.ForeignKey('fee_bill_items.id'), nullable=True)
    fee_head_id  = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=False)
    department   = db.Column(db.String(30), default='ACCOUNTS')

    allocated_amount = db.Column(db.Float, nullable=False, default=0.0)

    fee_head     = db.relationship('FeeHead', foreign_keys=[fee_head_id])

    def to_dict(self):
        return {
            'id':               self.id,
            'payment_id':       self.payment_id,
            'bill_id':          self.bill_id,
            'bill_item_id':     self.bill_item_id,
            'fee_head_id':      self.fee_head_id,
            'fee_head_name':    self.fee_head.name if self.fee_head else '',
            'fee_head_code':    self.fee_head.code if self.fee_head else '',
            'department':       self.department,
            'allocated_amount': self.allocated_amount,
        }


# ═══════════════════════════════════════════════════════════════════════
#  7. FEE REFUND & AUDIT LOGS
# ═══════════════════════════════════════════════════════════════════════

class FeeRefund(db.Model):
    """Refund workflow for cancelled transport/hostel or overpayments."""
    __tablename__ = 'fee_refunds'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id    = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    payment_id    = db.Column(db.Integer, db.ForeignKey('fee_payments.id'), nullable=True)
    fee_head_id   = db.Column(db.Integer, db.ForeignKey('fee_heads.id'), nullable=True)

    amount        = db.Column(db.Float, nullable=False)
    refund_date   = db.Column(db.Date, nullable=False, default=date.today)
    refund_mode   = db.Column(db.String(30), default='BANK_TRANSFER')
    reference_no  = db.Column(db.String(80), default='')
    reason        = db.Column(db.String(300), nullable=False)

    authorized_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status        = db.Column(db.String(20), default='PROCESSED')
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    student       = db.relationship('Student', foreign_keys=[student_id])
    authorizer    = db.relationship('User', foreign_keys=[authorized_by])

    def to_dict(self):
        return {
            'id':                 self.id,
            'student_id':         self.student_id,
            'student_name':       self.student.user.name if self.student and self.student.user else '',
            'admission_no':       self.student.admission_no if self.student else '',
            'amount':             self.amount,
            'refund_date':        self.refund_date.isoformat() if self.refund_date else None,
            'refund_mode':        self.refund_mode,
            'reference_no':       self.reference_no,
            'reason':             self.reason,
            'authorized_by_name': self.authorizer.name if self.authorizer else 'Admin',
            'status':             self.status,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


class FinancialAuditLog(db.Model):
    """Tamper-evident audit log of all financial movements and operations."""
    __tablename__ = 'financial_audit_logs'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    action       = db.Column(db.String(50), nullable=False)   # BILL_GENERATED, PAYMENT_COLLECTED, RECEIPT_CANCELLED, CONCESSION_APPROVED, REFUND_ISSUED
    actor_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    old_value    = db.Column(db.Text, nullable=True)
    new_value    = db.Column(db.Text, nullable=True)
    reason       = db.Column(db.String(300), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    actor        = db.relationship('User', foreign_keys=[actor_id])

    def to_dict(self):
        return {
            'id':         self.id,
            'action':     self.action,
            'actor_name': self.actor.name if self.actor else 'System',
            'old_value':  self.old_value,
            'new_value':  self.new_value,
            'reason':     self.reason or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
