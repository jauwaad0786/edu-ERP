from app import db
from datetime import datetime


class FeeStructure(db.Model):
    """Defines fee structure per class per school."""
    __tablename__ = 'fee_structures'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    session      = db.Column(db.String(20), default='2024-25')
    fee_type     = db.Column(db.String(50))
    amount       = db.Column(db.Float, nullable=False)
    frequency    = db.Column(db.String(20), default='MONTHLY')
    due_date_day = db.Column(db.Integer, default=10)

    def to_dict(self):
        return {
            'id': self.id,
            'class_id': self.class_id,
            'fee_type': self.fee_type,
            'amount': self.amount,
            'frequency': self.frequency
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
    source        = db.Column(db.String(20), default='ACADEMIC', index=True)
    source_ref_id = db.Column(db.Integer)   # e.g. HostelBedAllocation.id
    discount     = db.Column(db.Float, default=0.0)
    fine         = db.Column(db.Float, default=0.0)
    status       = db.Column(db.String(20), default='PENDING')
    month        = db.Column(db.String(20))
    due_date     = db.Column(db.Date)
    paid_date    = db.Column(db.Date)
    receipt_no   = db.Column(db.String(50), unique=True)
    payment_mode = db.Column(db.String(30))
    collected_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    session      = db.Column(db.String(20), default='2024-25')
    remarks      = db.Column(db.String(300))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    student      = db.relationship('Student', foreign_keys=[student_id], backref='fee_records_rel')

    def to_dict(self):
        return {
            'id':           self.id,
            'student_id':   self.student_id,
            'fee_type':     self.fee_type,
            'amount_due':   self.amount_due,
            'amount_paid':  self.amount_paid,
            'status':       self.status,
            'month':        self.month,
            'session':      self.session,
            'discount':     self.discount or 0,
            'fine':         self.fine or 0,
            'due_date':     str(self.due_date)  if self.due_date  else None,
            'paid_date':    str(self.paid_date) if self.paid_date else None,
            'receipt_no':   self.receipt_no,
            'payment_mode': self.payment_mode,
            # NEW
            'remarks':      self.remarks or '',
            'collected_by': self.collected_by,
            'source':         self.source or 'ACADEMIC',
            'source_ref_id':  self.source_ref_id,
        }


class ExamSchedule(db.Model):
    """Exam schedule — full enterprise workflow with draft/publish/archive."""
    __tablename__ = 'exam_schedules'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    exam_name    = db.Column(db.String(100), nullable=False)
    exam_type    = db.Column(db.String(50))
    # MID_TERM / FINAL / UNIT_TEST / PRE_BOARD
    session      = db.Column(db.String(20), default='2024-25')
    start_date   = db.Column(db.Date)
    end_date     = db.Column(db.Date)
    instructions = db.Column(db.Text, default='')
    # status: DRAFT / PUBLISHED / ARCHIVED
    status       = db.Column(db.String(20), default='DRAFT')
    is_published = db.Column(db.Boolean, default=False)  # backward compat
    published_at = db.Column(db.DateTime, nullable=True)
    published_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    timetable    = db.relationship('ExamTimetable', backref='exam',
                                   lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'exam_name':    self.exam_name,
            'exam_type':    self.exam_type,
            'session':      self.session,
            'start_date':   str(self.start_date) if self.start_date else None,
            'end_date':     str(self.end_date)   if self.end_date   else None,
            'instructions': self.instructions    or '',
            'status':       self.status,
            'is_published': self.is_published,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'created_at':   self.created_at.isoformat()  if self.created_at  else None,
        }

class ExamTimetable(db.Model):
    """Subject-wise exam schedule — per class per subject."""
    __tablename__ = 'exam_timetable'

    id           = db.Column(db.Integer, primary_key=True)
    exam_id      = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    subject_id   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)
    exam_date    = db.Column(db.Date, nullable=False)
    start_time   = db.Column(db.String(10))   # "10:00 AM"
    end_time     = db.Column(db.String(10))   # "01:00 PM"
    venue        = db.Column(db.String(100),  default='Main Hall')
    max_marks    = db.Column(db.Integer,      default=100)
    pass_marks   = db.Column(db.Integer,      default=33)
    instructions = db.Column(db.Text,         default='')
    created_at   = db.Column(db.DateTime,     default=datetime.utcnow)

    subject      = db.relationship('Subject', backref='exam_timetables')

    def to_dict(self):
        return {
            'id':           self.id,
            'exam_id':      self.exam_id,
            'class_id':     self.class_id,
            'subject_id':   self.subject_id,
            'subject_name': self.subject.name if self.subject else '',
            'exam_date':    str(self.exam_date),
            'start_time':   self.start_time,
            'end_time':     self.end_time,
            'venue':        self.venue        or 'Main Hall',
            'max_marks':    self.max_marks,
            'pass_marks':   self.pass_marks,
            'instructions': self.instructions or '',
        
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

    receipt_no      = db.Column(db.String(50), unique=True)   # per-transaction receipt
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

    teacher = db.relationship('Teacher', backref='salary_records')

    def to_dict(self):
        return {
            'id':           self.id,
            'teacher_id':   self.teacher_id,
            'month':        self.month,
            'amount':       self.amount,
            'status':       self.status,
            'payment_date': str(self.payment_date) if self.payment_date else None,
            'note':         self.note,
            'created_at':   self.created_at.isoformat(),
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
