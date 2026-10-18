"""
Examinations Domain Models
Enterprise examination workflow, schedules, timetable, class configurations,
teacher delegations, and archived published result versions.
"""

from datetime import datetime, date
from app import db
from app.utils.timezone_util import utc_now


class ExamSchedule(db.Model):
    """Exam schedule — full enterprise workflow with draft/publish/archive."""
    __tablename__ = 'exam_schedules'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_name            = db.Column(db.String(100), nullable=False)
    exam_type            = db.Column(db.String(50), default='MID_TERM')
    session              = db.Column(db.String(20), default='2024-25', index=True)
    academic_year        = db.Column(db.String(20), nullable=True)
    start_date           = db.Column(db.Date)
    end_date             = db.Column(db.Date)
    description          = db.Column(db.Text, default='')
    instructions         = db.Column(db.Text, default='')
    result_published_date= db.Column(db.Date, nullable=True)
    grading_system       = db.Column(db.String(50), default='STANDARD')
    status               = db.Column(db.String(30), default='DRAFT', index=True)
    is_published         = db.Column(db.Boolean, default=False, index=True)
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
            'subject_code':          s_code,
            'max_marks':             self.max_marks,
            'pass_marks':            self.pass_marks,
            'theory_marks':          self.theory_marks,
            'practical_marks':       self.practical_marks,
            'internal_marks':        self.internal_marks,
            'weightage':             self.weightage,
            'grade_scheme':          self.grade_scheme,
            'is_included_in_result': self.is_included_in_result,
        }


class ExamTimetable(db.Model):
    """Individual exam slot/schedule per subject."""
    __tablename__ = 'exam_timetable'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id      = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    exam_date    = db.Column(db.Date, nullable=False)
    start_time   = db.Column(db.String(10), default='10:00 AM')
    end_time     = db.Column(db.String(10), default='01:00 PM')
    venue        = db.Column(db.String(100), default='Main Hall')
    room         = db.Column(db.String(50), default='')
    invigilator_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    invigilator_name = db.Column(db.String(150), default='')
    max_marks    = db.Column(db.Integer, default=100)
    pass_marks   = db.Column(db.Integer, default=33)
    instructions = db.Column(db.Text, default='')
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

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
    status               = db.Column(db.String(20), default='ACTIVE', index=True)
    created_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at           = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    delegated_teacher    = db.relationship('Teacher', foreign_keys=[delegated_teacher_id], lazy='select')
    original_teacher     = db.relationship('Teacher', foreign_keys=[original_teacher_id], lazy='select')
    subject_ref          = db.relationship('Subject', lazy='select')
    class_ref            = db.relationship('Class', lazy='select')
    exam_ref             = db.relationship('ExamSchedule', lazy='select')

    def is_active(self):
        return self.status == 'ACTIVE' and self.end_date >= utc_now()

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
            'status':                 'EXPIRED' if (self.status == 'ACTIVE' and self.end_date < utc_now()) else self.status,
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
    snapshot_json   = db.Column(db.Text, nullable=True)
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
