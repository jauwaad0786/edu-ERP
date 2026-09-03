from app import db
from datetime import datetime


# NEW
# app/models/financial.py — FeeStructure class mein add karo

class FeeStructure(db.Model):
    __tablename__ = 'fee_structures'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    session      = db.Column(db.String(20), default='2024-25')
    fee_type     = db.Column(db.String(50))
    amount       = db.Column(db.Float, nullable=False)
    frequency    = db.Column(db.String(20), default='MONTHLY')   # MONTHLY / QUARTERLY / YEARLY / ONE_TIME  ← NEW usage
    due_date_day = db.Column(db.Integer, default=10)

    # NEW — source tag, taaki Fee Structures page pe Hostel/Library
    # bhi list mein dikh sake bina duplicate create kiye
    source       = db.Column(db.String(20), default='ACADEMIC', index=True)  # ACADEMIC/HOSTEL/LIBRARY/TRANSPORT

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
    fee_type     = db.Column(db.String(50))
    amount_due   = db.Column(db.Float, nullable=False)
    amount_paid  = db.Column(db.Float, default=0.0)

    # ── Source tracking — same pattern as Expense.source/source_ref_id ──
    # 'ACADEMIC' (default, existing behaviour untouched) / 'HOSTEL' / 'TRANSPORT' / 'LIBRARY'
    # NEW
    source        = db.Column(db.String(20), default='ACADEMIC', index=True)
    source_ref_id = db.Column(db.Integer)   # e.g. HostelBedAllocation.id, FineTransaction.id

    # NEW — links a record to the batch that generated it (null for hostel/library/manual records)
    batch_id      = db.Column(db.Integer, db.ForeignKey('fee_generation_batches.id'), nullable=True, index=True)

    # NEW
    discount        = db.Column(db.Float, default=0.0)
    fine            = db.Column(db.Float, default=0.0)
    discount_reason = db.Column(db.String(200))
    fine_reason     = db.Column(db.String(200))
    adjusted_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    adjusted_at     = db.Column(db.DateTime, nullable=True)
    status            = db.Column(db.String(20), default='PENDING')
    month             = db.Column(db.String(20))
    billing_frequency = db.Column(db.String(20), default='MONTHLY', index=True)
    period_start      = db.Column(db.Date, nullable=True, index=True)
    period_end        = db.Column(db.Date, nullable=True, index=True)
    coverage_label    = db.Column(db.String(100), nullable=True)
    due_date          = db.Column(db.Date)
    paid_date         = db.Column(db.Date)
    receipt_no        = db.Column(db.String(50), index=True)
    payment_mode      = db.Column(db.String(30))
    collected_by      = db.Column(db.Integer, db.ForeignKey('users.id'))
    session           = db.Column(db.String(20), default='2024-25')
    remarks           = db.Column(db.String(300))
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)
    student           = db.relationship('Student', foreign_keys=[student_id], backref='fee_records_rel', overlaps="fee_records_rel,student_ref,fees")

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


class ExamSchedule(db.Model):
    """Exam schedule — full enterprise workflow with draft/publish/archive."""
    __tablename__ = 'exam_schedules'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_name            = db.Column(db.String(100), nullable=False)
    exam_type            = db.Column(db.String(50), default='MID_TERM')
    # UNIT_TEST / MID_TERM / FINAL / PRE_BOARD / PRACTICALS / CLASS_TEST / ANNUAL / QUARTERLY / HALF_YEARLY
    session              = db.Column(db.String(20), default='2024-25', index=True)
    academic_year        = db.Column(db.String(20), nullable=True)
    start_date           = db.Column(db.Date)
    end_date             = db.Column(db.Date)
    description          = db.Column(db.Text, default='')
    instructions         = db.Column(db.Text, default='')
    result_published_date= db.Column(db.Date, nullable=True)
    grading_system       = db.Column(db.String(50), default='STANDARD')  # STANDARD / PERCENTAGE / GPA / CBSE
    # status: DRAFT / READY_FOR_REVIEW / PUBLISHED / ONGOING / COMPLETED / CANCELLED / ARCHIVED
    status               = db.Column(db.String(30), default='DRAFT', index=True)
    is_published         = db.Column(db.Boolean, default=False, index=True)  # backward compat
    published_at         = db.Column(db.DateTime, nullable=True)
    published_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at           = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    timetable            = db.relationship('ExamTimetable', backref='exam',
                                           lazy='dynamic', cascade='all, delete-orphan')
    participating_classes= db.relationship('ExamClass', backref='exam_rel',
                                           lazy='dynamic', cascade='all, delete-orphan')
    subjects_config      = db.relationship('ExamSubject', backref='exam_rel',
                                           lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        classes = []
        try:
            classes = [ec.to_dict() for ec in self.participating_classes.all()]
        except Exception:
            pass
        return {
            'id':                    self.id,
            'school_id':             self.school_id,
            'exam_name':             self.exam_name,
            'exam_type':             self.exam_type or 'MID_TERM',
            'session':               self.session,
            'academic_year':         self.academic_year or (self.session.split('-')[0] if self.session and '-' in self.session else str(self.start_date.year if self.start_date else '2026')),
            'start_date':            str(self.start_date) if self.start_date else None,
            'end_date':              str(self.end_date)   if self.end_date   else None,
            'description':           self.description or '',
            'instructions':          self.instructions or '',
            'result_published_date': str(self.result_published_date) if self.result_published_date else None,
            'grading_system':        self.grading_system or 'STANDARD',
            'status':                self.status or 'DRAFT',
            'is_published':          bool(self.is_published),
            'published_at':          self.published_at.isoformat() if self.published_at else None,
            'published_by':          self.published_by,
            'created_by':            self.created_by,
            'created_at':            self.created_at.isoformat()  if self.created_at  else None,
            'updated_at':            self.updated_at.isoformat()  if self.updated_at  else None,
            'participating_classes': classes,
        }


class ExamClass(db.Model):
    """Explicit mapping of classes participating in an exam."""
    __tablename__ = 'exam_classes'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id    = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id   = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('exam_id', 'class_id', name='uq_exam_class'),
    )

    class_ref  = db.relationship('Class', lazy='select')

    def to_dict(self):
        cls_name = self.class_ref.name if self.class_ref else ''
        cls_sec  = self.class_ref.section if self.class_ref else ''
        return {
            'id':         self.id,
            'exam_id':    self.exam_id,
            'class_id':   self.class_id,
            'class_name': cls_name,
            'section':    cls_sec,
            'display_name': f"{cls_name} - {cls_sec}".strip(' -'),
        }


class ExamSubject(db.Model):
    """Per-exam-class subject configurations and grading parameters."""
    __tablename__ = 'exam_subjects'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id              = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id             = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id           = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    subject_code         = db.Column(db.String(20), nullable=True)
    max_marks            = db.Column(db.Float, default=100.0)
    pass_marks           = db.Column(db.Float, default=33.0)
    theory_marks         = db.Column(db.Float, default=80.0)
    practical_marks      = db.Column(db.Float, default=20.0)
    internal_marks       = db.Column(db.Float, default=0.0)
    weightage            = db.Column(db.Float, default=100.0)
    grade_scheme         = db.Column(db.String(50), default='STANDARD')
    is_included_in_result= db.Column(db.Boolean, default=True)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('exam_id', 'class_id', 'subject_id', name='uq_exam_class_subject'),
    )

    subject_ref = db.relationship('Subject', lazy='select')

    def to_dict(self):
        s_name = self.subject_ref.name if self.subject_ref else ''
        s_code = self.subject_code or (self.subject_ref.code if self.subject_ref else '')
        return {
            'id':                    self.id,
            'exam_id':               self.exam_id,
            'class_id':              self.class_id,
            'subject_id':            self.subject_id,
            'subject_name':          s_name,
            'subject_code':          s_code or '',
            'max_marks':             float(self.max_marks or 100),
            'pass_marks':            float(self.pass_marks or 33),
            'theory_marks':          float(self.theory_marks or 0),
            'practical_marks':       float(self.practical_marks or 0),
            'internal_marks':        float(self.internal_marks or 0),
            'weightage':             float(self.weightage or 100),
            'grade_scheme':          self.grade_scheme or 'STANDARD',
            'is_included_in_result': bool(self.is_included_in_result),
        }


class ExamTimetable(db.Model):
    """Subject-wise exam schedule — per class per subject."""
    __tablename__ = 'exam_timetable'

    id           = db.Column(db.Integer, primary_key=True)
    exam_id      = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    exam_date    = db.Column(db.Date, nullable=False, index=True)
    start_time   = db.Column(db.String(10))   # "10:00 AM"
    end_time     = db.Column(db.String(10))   # "01:00 PM"
    venue        = db.Column(db.String(100),  default='Main Hall')
    room         = db.Column(db.String(50),   nullable=True)
    invigilator_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    invigilator_name = db.Column(db.String(120), nullable=True)
    max_marks    = db.Column(db.Integer,      default=100)
    pass_marks   = db.Column(db.Integer,      default=33)
    instructions = db.Column(db.Text,         default='')
    created_at   = db.Column(db.DateTime,     default=datetime.utcnow)

    subject      = db.relationship('Subject', backref='exam_timetables')
    invigilator  = db.relationship('Teacher', foreign_keys=[invigilator_id], lazy='select')

    def to_dict(self):
        inv_name = self.invigilator_name or ''
        if not inv_name and self.invigilator and self.invigilator.user:
            inv_name = self.invigilator.user.name
        return {
            'id':               self.id,
            'exam_id':          self.exam_id,
            'class_id':         self.class_id,
            'subject_id':       self.subject_id,
            'subject_name':     self.subject.name if self.subject else '',
            'subject_code':     getattr(self.subject, 'code', '') or '',
            'exam_date':        str(self.exam_date),
            'start_time':       self.start_time or '10:00 AM',
            'end_time':         self.end_time or '01:00 PM',
            'venue':            self.venue or self.room or 'Main Hall',
            'room':             self.room or self.venue or '',
            'invigilator_id':   self.invigilator_id,
            'invigilator_name': inv_name,
            'max_marks':        self.max_marks,
            'pass_marks':       self.pass_marks,
            'instructions':     self.instructions or '',
        }


class ExamTeacherDelegation(db.Model):
    """Temporary delegation for mark entry when assigned teacher is absent."""
    __tablename__ = 'exam_teacher_delegations'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id              = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id             = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id           = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    original_teacher_id  = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    delegated_teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)
    start_date           = db.Column(db.DateTime, default=datetime.utcnow)
    end_date             = db.Column(db.DateTime, nullable=False)
    reason               = db.Column(db.String(500), nullable=False)
    status               = db.Column(db.String(20), default='ACTIVE', index=True)  # ACTIVE / REVOKED / EXPIRED
    created_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at           = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    delegated_teacher    = db.relationship('Teacher', foreign_keys=[delegated_teacher_id], lazy='select')
    original_teacher     = db.relationship('Teacher', foreign_keys=[original_teacher_id], lazy='select')
    subject_ref          = db.relationship('Subject', lazy='select')
    class_ref            = db.relationship('Class', lazy='select')
    exam_ref             = db.relationship('ExamSchedule', lazy='select')

    def is_active(self):
        return self.status == 'ACTIVE' and self.end_date >= datetime.utcnow()

    def to_dict(self):
        del_user_name = self.delegated_teacher.user.name if self.delegated_teacher and self.delegated_teacher.user else ''
        orig_user_name = self.original_teacher.user.name if self.original_teacher and self.original_teacher.user else ''
        return {
            'id':                     self.id,
            'school_id':              self.school_id,
            'exam_id':                self.exam_id,
            'exam_name':              self.exam_ref.exam_name if self.exam_ref else '',
            'class_id':               self.class_id,
            'class_name':             f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else '',
            'subject_id':             self.subject_id,
            'subject_name':           self.subject_ref.name if self.subject_ref else '',
            'original_teacher_id':    self.original_teacher_id,
            'original_teacher_name':  orig_user_name,
            'delegated_teacher_id':   self.delegated_teacher_id,
            'delegated_teacher_name': del_user_name,
            'start_date':             self.start_date.isoformat() if self.start_date else None,
            'end_date':               self.end_date.isoformat() if self.end_date else None,
            'reason':                 self.reason,
            'status':                 'EXPIRED' if (self.status == 'ACTIVE' and self.end_date < datetime.utcnow()) else self.status,
            'is_currently_active':    self.is_active(),
            'created_at':             self.created_at.isoformat() if self.created_at else None,
        }


class ResultVersion(db.Model):
    """Archived published result versions for audit and comparison."""
    __tablename__ = 'result_versions'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id         = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id        = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    version_number  = db.Column(db.Integer, default=1, index=True)
    published_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    published_at    = db.Column(db.DateTime, default=datetime.utcnow)
    reopened_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reopened_at     = db.Column(db.DateTime, nullable=True)
    reason          = db.Column(db.String(500), nullable=True)
    snapshot_json   = db.Column(db.Text, nullable=True)  # JSON snapshot of marks/grades
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        import json
        snapshot = []
        try:
            if self.snapshot_json:
                snapshot = json.loads(self.snapshot_json)
        except Exception:
            pass
        return {
            'id':             self.id,
            'exam_id':        self.exam_id,
            'class_id':       self.class_id,
            'version_number': self.version_number,
            'published_by':   self.published_by,
            'published_at':   self.published_at.isoformat() if self.published_at else None,
            'reopened_by':    self.reopened_by,
            'reopened_at':    self.reopened_at.isoformat() if self.reopened_at else None,
            'reason':         self.reason or '',
            'snapshot':       snapshot,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }


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
class Holiday(db.Model):
    """School holidays — visible to teachers and students."""
    __tablename__ = 'holidays'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    title       = db.Column(db.String(200), nullable=False)
    date        = db.Column(db.Date, nullable=False)
    end_date    = db.Column(db.Date, nullable=True)   # for multi-day holidays
    holiday_type= db.Column(db.String(30), default='HOLIDAY')
    # HOLIDAY / FESTIVAL / EXAM / EVENT / OTHER
    applies_to  = db.Column(db.String(20), default='ALL')
    # ALL / STUDENT / TEACHER
    description = db.Column(db.String(300), default='')
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'title':        self.title,
            'date':         str(self.date),
            'end_date':     str(self.end_date) if self.end_date else None,
            'holiday_type': self.holiday_type,
            'applies_to':   self.applies_to,
            'description':  self.description,
        }


# ─── Weekly Class Timetable ───────────────────────────────────────────────────

class Timetable(db.Model):
    """Weekly class timetable — draft/publish workflow."""
    __tablename__ = 'timetables'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    session      = db.Column(db.String(20), default='2024-25')
    title        = db.Column(db.String(100), default='Weekly Timetable')
    status       = db.Column(db.String(20), default='DRAFT')  # DRAFT / PUBLISHED
    published_at = db.Column(db.DateTime, nullable=True)
    published_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    periods      = db.relationship('TimetablePeriod', backref='timetable',
                                   lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'class_id':     self.class_id,
            'session':      self.session,
            'title':        self.title,
            'status':       self.status,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


class TimetablePeriod(db.Model):
    """Single period slot in a timetable."""
    __tablename__ = 'timetable_periods'

    id           = db.Column(db.Integer, primary_key=True)
    timetable_id = db.Column(db.Integer, db.ForeignKey('timetables.id'), nullable=False)
    day          = db.Column(db.String(10), nullable=False)   # MON/TUE/WED/THU/FRI/SAT
    period_no    = db.Column(db.Integer, nullable=False)       # 1,2,3...8
    subject_id   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True)
    teacher_id   = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    start_time   = db.Column(db.String(10))   # "08:00 AM"
    end_time     = db.Column(db.String(10))   # "08:45 AM"
    room         = db.Column(db.String(50), default='')
    is_break     = db.Column(db.Boolean, default=False)   # lunch/recess
    break_label  = db.Column(db.String(30), default='')   # "Lunch Break"

    subject = db.relationship('Subject', backref='timetable_periods')
    teacher = db.relationship('Teacher', backref='timetable_periods')

    def to_dict(self):
        return {
            'id':           self.id,
            'timetable_id': self.timetable_id,
            'day':          self.day,
            'period_no':    self.period_no,
            'subject_id':   self.subject_id,
            'subject_name': self.subject.name if self.subject else '',
            'teacher_id':   self.teacher_id,
            'teacher_name': self.teacher.user.name if self.teacher and self.teacher.user else '',
            'start_time':   self.start_time,
            'end_time':     self.end_time,
            'room':         self.room or '',
            'is_break':     self.is_break,
            'break_label':  self.break_label or '',
        }


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
    fee_type        = db.Column(db.String(50), nullable=False)
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
