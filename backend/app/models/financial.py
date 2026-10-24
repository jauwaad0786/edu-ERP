from app import db
from datetime import datetime, date
from app.utils.timezone_util import utc_now


# NEW
# app/models/financial.py — FeeStructure class mein add karo

class FeeStructure(db.Model):
    __tablename__ = 'fee_structures'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    session      = db.Column(db.String(20), default='2024-25')
    fee_type     = db.Column(db.String(255))
    amount       = db.Column(db.Float, nullable=False)
    frequency    = db.Column(db.String(50), default='MONTHLY')   # MONTHLY / QUARTERLY / YEARLY / ONE_TIME  ← NEW usage
    due_date_day = db.Column(db.Integer, default=10)

    # NEW — source tag, taaki Fee Structures page pe Hostel/Library
    # bhi list mein dikh sake bina duplicate create kiye
    source       = db.Column(db.String(100), default='ACADEMIC', index=True)  # ACADEMIC/HOSTEL/LIBRARY/TRANSPORT

    status       = db.Column(db.String(20), default='ACTIVE')
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'class_id': self.class_id, 'fee_type': self.fee_type,
            'amount': self.amount, 'frequency': self.frequency,
            'due_date_day': self.due_date_day, 'session': self.session,
            'status': self.status or 'ACTIVE', 'source': self.source or 'ACADEMIC',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# NEW
class FeeRecord(db.Model):
    __tablename__ = 'fee_records'

    id           = db.Column(db.Integer, primary_key=True)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    fee_type     = db.Column(db.String(255))
    amount_due   = db.Column(db.Float, nullable=False)
    amount_paid  = db.Column(db.Float, default=0.0)

    # ── Source tracking — same pattern as Expense.source/source_ref_id ──
    # 'ACADEMIC' (default, existing behaviour untouched) / 'HOSTEL' / 'TRANSPORT' / 'LIBRARY'
    # NEW
    source        = db.Column(db.String(100), default='ACADEMIC', index=True)
    source_ref_id = db.Column(db.Integer)   # e.g. HostelBedAllocation.id, FineTransaction.id

    # NEW — links a record to the batch that generated it (null for hostel/library/manual records)
    batch_id      = db.Column(db.Integer, db.ForeignKey('fee_generation_batches.id'), nullable=True, index=True)

    # NEW
    discount        = db.Column(db.Float, default=0.0)
    fine            = db.Column(db.Float, default=0.0)
    discount_reason = db.Column(db.String(300))
    fine_reason     = db.Column(db.String(300))
    adjusted_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    adjusted_at     = db.Column(db.DateTime, nullable=True)
    status            = db.Column(db.String(20), default='PENDING')
    month             = db.Column(db.String(20))
    billing_frequency = db.Column(db.String(50), default='MONTHLY', index=True)
    period_start      = db.Column(db.Date, nullable=True, index=True)
    period_end        = db.Column(db.Date, nullable=True, index=True)
    coverage_label    = db.Column(db.String(255), nullable=True)
    due_date          = db.Column(db.Date)
    paid_date         = db.Column(db.Date)
    receipt_no        = db.Column(db.String(100), index=True)
    payment_mode      = db.Column(db.String(30))
    collected_by      = db.Column(db.Integer, db.ForeignKey('users.id'))
    session           = db.Column(db.String(20), default='2024-25')
    remarks           = db.Column(db.String(500))
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    student           = db.relationship('Student', foreign_keys=[student_id], backref='fee_records_rel', overlaps="fee_records_rel,student_ref,fees")

    __table_args__ = (
        db.Index('idx_feerec_school_id', 'school_id'),
        db.Index('idx_feerec_school_session_status', 'school_id', 'session', 'status'),
        db.Index('idx_feerec_school_student', 'school_id', 'student_id'),
        db.Index('idx_feerec_school_month', 'school_id', 'month'),
        db.Index('idx_feerec_school_paid_date', 'school_id', 'paid_date'),
    )

    def to_dict(self):
        return {
            'id':                self.id,
            'student_id':        self.student_id,
            'fee_type':          self.fee_type,
            'amount_due':        self.amount_due,
            'amount_paid':       self.amount_paid,
            'status':            self.status,
            'month':             self.month,
            'billing_frequency': self.billing_frequency or 'MONTHLY',
            'period_start':      str(self.period_start) if self.period_start else None,
            'period_end':        str(self.period_end) if self.period_end else None,
            'coverage_label':    self.coverage_label or '',
            'session':           self.session,
            'discount':          self.discount or 0,
            'fine':              self.fine or 0,
            'discount_reason':   self.discount_reason or '',
            'fine_reason':       self.fine_reason or '',
            'effective_due':     self.effective_due(),
            'balance':           round(self.effective_due() - (self.amount_paid or 0), 2),
            'adjusted_at':       self.adjusted_at.isoformat() if self.adjusted_at else None,
            'due_date':          str(self.due_date)  if self.due_date  else None,
            'paid_date':         str(self.paid_date) if self.paid_date else None,
            'receipt_no':        self.receipt_no,
            'payment_mode':      self.payment_mode,
            'remarks':           self.remarks or '',
            'collected_by':      self.collected_by,
            'source':            self.source or 'ACADEMIC',
            'source_ref_id':     self.source_ref_id,
        }
# NEW — add this method inside FeeRecord class, right after to_dict()
    def effective_due(self):
        """Actual payable amount after fine/discount adjustments."""
        return round((self.amount_due or 0) + (self.fine or 0) - (self.discount or 0), 2)



# ─── Examinations Domain Models (Canonical: app.models.examinations) ────────
# Re-exported for seamless backward compatibility across existing routes and services
from app.models.examinations import (
    ExamSchedule, ExamClass, ExamSubject, ExamTimetable,
    ExamTeacherDelegation, ResultVersion
)


class FeeTransaction(db.Model):
    """
    Har individual fee payment ka ledger entry — FeeRecord.amount_paid sirf
    RUNNING TOTAL rakhta hai (kab collect hua ye pata nahi chalta), isliye
    month-wise / date-wise collection report (Today's Collection, This Month's
    Collection, Cash vs UPI breakdown) sahi se nahi ban sakti thi.

    Ye table FeeRecord ko REPLACE nahi karti — sirf uske saath-saath har
    payment installment ko apni date/mode ke saath record karti hai.
    collect_fee route ab har payment pe ek FeeTransaction row bhi banayega,
    bilkul waise jaise Salary → Expense auto-link hota hai.
    """
    __tablename__ = 'fee_transactions'

    id              = db.Column(db.Integer, primary_key=True)
    fee_record_id   = db.Column(db.Integer, db.ForeignKey('fee_records.id'), nullable=False, index=True)
    student_id      = db.Column(db.Integer, db.ForeignKey('students.id'),   nullable=False, index=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'),    nullable=False, index=True)

    amount          = db.Column(db.Float, nullable=False)
    payment_mode    = db.Column(db.String(30))
    transaction_date= db.Column(db.Date, nullable=False, default=datetime.utcnow)
    # "July 2026" — auto-set from transaction_date, isi se month-wise report chalega
    txn_month       = db.Column(db.String(20), index=True)

    receipt_no      = db.Column(db.String(50), index=True)   # per-transaction receipt
    remarks         = db.Column(db.String(300), default='')
    collected_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    fee_record = db.relationship('FeeRecord', backref='transactions')

    def to_dict(self):
        return {
            'id':               self.id,
            'fee_record_id':    self.fee_record_id,
            'student_id':       self.student_id,
            'amount':           self.amount,
            'payment_mode':     self.payment_mode,
            'transaction_date': str(self.transaction_date) if self.transaction_date else None,
            'txn_month':        self.txn_month,
            'receipt_no':       self.receipt_no,
            'remarks':          self.remarks or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }

# NEW class — financial.py mein add karo, FeeTransaction ke baad

class FeeReceiptGroup(db.Model):
    """
    Ek receipt_no ke against kaunse FeeTransaction combine hue — is table
    ke bina hume PDF banate waqt pata nahi chalta ki accountant ne
    'combine karo' bola tha ya 'separate karo'. FeeTransaction.receipt_no
    already same rehta hai agar combine kiya, lekin ye table explicit
    intent store karti hai — 'COMBINED' ya 'SEPARATE' — audit/UI ke liye.
    """
    __tablename__ = 'fee_receipt_groups'

    id          = db.Column(db.Integer, primary_key=True)
    receipt_no  = db.Column(db.String(50), nullable=False, index=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    mode        = db.Column(db.String(20), default='COMBINED')   # COMBINED / SEPARATE
    sources     = db.Column(db.String(200), default='')          # "ACADEMIC,HOSTEL" — comma list
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'receipt_no': self.receipt_no, 'mode': self.mode,
            'sources': self.sources.split(',') if self.sources else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

class SalaryRecord(db.Model):
    """Manual salary payment records per teacher."""
    __tablename__ = 'salary_records'

    id           = db.Column(db.Integer, primary_key=True)
    teacher_id   = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False)
    month        = db.Column(db.String(20))        # e.g. "May 2026"
    amount       = db.Column(db.Float, default=0)
    status       = db.Column(db.String(20), default='PAID')   # PAID / PENDING
    payment_date = db.Column(db.Date)
    note         = db.Column(db.String(300), default='')
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    # NEW — lets the teacher confirm "yes, I received this payment" from
    # their own dashboard. Separate from `status` (which is the Principal's
    # PAID/PENDING marking) -- a record can be PAID but not yet
    # acknowledged by the teacher.
    is_acknowledged   = db.Column(db.Boolean, default=False)
    acknowledged_at   = db.Column(db.DateTime, nullable=True)

    teacher = db.relationship('Teacher', backref='salary_records')

    def to_dict(self):
        return {
            'id':               self.id,
            'teacher_id':       self.teacher_id,
            'month':            self.month,
            'amount':           self.amount,
            'status':           self.status,
            'payment_date':     str(self.payment_date) if self.payment_date else None,
            'note':             self.note,
            'created_at':       self.created_at.isoformat(),
            'is_acknowledged':  self.is_acknowledged,
            'acknowledged_at':  self.acknowledged_at.isoformat() if self.acknowledged_at else None,
        }
# ─── Timetable & Calendar Domain Models (Canonical: app.models.timetable) ───
# Re-exported for seamless backward compatibility across existing routes and services
from app.models.timetable import (
    Holiday, Timetable, TimetablePeriod, TimetableSubstitution
)


# NEW — add this new class anywhere in financial.py, after FeeRecord

class FeeGenerationBatch(db.Model):
    """
    Ek 'Generate Fees' click = ek batch row. Isi se Draft → Review → Publish
    workflow control hota hai — poori batch ek saath publish/delete ho sakti hai.
    Bilkul ExamSchedule/Timetable jaisa hi draft/publish pattern.
    """
    __tablename__ = 'fee_generation_batches'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    class_id        = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)  # null = multi-class (hostel jaisa)
    fee_type        = db.Column(db.String(255), nullable=False)
    month           = db.Column(db.String(20), nullable=False)   # "2026-07"
    session         = db.Column(db.String(20), default='2024-25')

    status          = db.Column(db.String(20), default='DRAFT')  # DRAFT / PUBLISHED / CANCELLED
    generated_count = db.Column(db.Integer, default=0)
    skipped_count   = db.Column(db.Integer, default=0)

    generated_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    generated_at    = db.Column(db.DateTime, default=datetime.utcnow)
    published_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    published_at    = db.Column(db.DateTime, nullable=True)
    window_start = db.Column(db.Date, nullable=True)   # e.g. 2026-06-25 — kab se collect shuru
    window_end   = db.Column(db.Date, nullable=True)

    records = db.relationship('FeeRecord', backref='batch', lazy='dynamic')

    def to_dict(self):
        return {
            'id':               self.id,
            'class_id':         self.class_id,
            'fee_type':         self.fee_type,
            'month':            self.month,
            'session':          self.session,
            'status':           self.status,
            'generated_count':  self.generated_count or 0,
            'skipped_count':    self.skipped_count or 0,
            'generated_at':     self.generated_at.isoformat() if self.generated_at else None,
            'published_at':     self.published_at.isoformat() if self.published_at else None,
        }
