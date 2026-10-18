"""
Timetable & Calendar Domain Models
Weekly class timetables, period slots, daily teacher substitutions, and school holidays.
"""

from datetime import datetime, date
from app import db


class Holiday(db.Model):
    """School holidays — visible to teachers and students."""
    __tablename__ = 'holidays'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    title       = db.Column(db.String(200), nullable=False)
    date        = db.Column(db.Date, nullable=False)
    end_date    = db.Column(db.Date, nullable=True)
    holiday_type= db.Column(db.String(30), default='HOLIDAY')
    applies_to  = db.Column(db.String(20), default='ALL')
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


class Timetable(db.Model):
    """Weekly class timetable — draft/publish workflow."""
    __tablename__ = 'timetables'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    session      = db.Column(db.String(20), default='2024-25')
    title        = db.Column(db.String(100), default='Weekly Timetable')
    status       = db.Column(db.String(20), default='DRAFT')
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
    day          = db.Column(db.String(10), nullable=False)
    period_no    = db.Column(db.Integer, nullable=False)
    subject_id   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True)
    teacher_id   = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    start_time   = db.Column(db.String(10))
    end_time     = db.Column(db.String(10))
    room         = db.Column(db.String(50), default='')
    is_break     = db.Column(db.Boolean, default=False)
    break_label  = db.Column(db.String(30), default='')
    period_type  = db.Column(db.String(20), default='LECTURE')

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
            'period_type':  self.period_type or ('BREAK' if self.is_break else 'LECTURE'),
        }


class TimetableSubstitution(db.Model):
    """
    Daily substitute assignment for a scheduled timetable period.
    Tracks original absent teacher, substitute teacher, approval status, and reason.
    """
    __tablename__ = 'timetable_substitutions'

    id                    = db.Column(db.Integer, primary_key=True)
    school_id             = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    date                  = db.Column(db.Date, nullable=False, index=True)
    timetable_period_id   = db.Column(db.Integer, db.ForeignKey('timetable_periods.id'), nullable=False, index=True)
    original_teacher_id   = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)
    substitute_teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)

    status                = db.Column(db.String(20), default='CONFIRMED', index=True)
    reason                = db.Column(db.String(255), default='Teacher Absence')
    notes                 = db.Column(db.Text, default='')

    assigned_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at            = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at            = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    timetable_period      = db.relationship('TimetablePeriod', backref=db.backref('substitutions', lazy='dynamic'))
    original_teacher      = db.relationship('Teacher', foreign_keys=[original_teacher_id])
    substitute_teacher    = db.relationship('Teacher', foreign_keys=[substitute_teacher_id])
    assigner              = db.relationship('User', foreign_keys=[assigned_by])

    __table_args__ = (
        db.UniqueConstraint('school_id', 'date', 'timetable_period_id', name='uq_substitution_slot_date'),
        db.Index('idx_subst_lookup', 'school_id', 'date', 'substitute_teacher_id'),
    )

    def to_dict(self):
        orig_name = self.original_teacher.user.name if (self.original_teacher and self.original_teacher.user) else ''
        sub_name = self.substitute_teacher.user.name if (self.substitute_teacher and self.substitute_teacher.user) else ''
        assigner_name = self.assigner.name if self.assigner else ''
        tp = self.timetable_period

        cls_name = ''
        class_id = None
        if tp and tp.timetable:
            class_id = tp.timetable.class_id
            from app.models.academic import Class
            cls = Class.query.get(class_id)
            if cls:
                cls_name = f"{cls.name} {cls.section}".strip()

        return {
            'id':                     self.id,
            'school_id':              self.school_id,
            'date':                   self.date.isoformat() if self.date else None,
            'timetable_period_id':    self.timetable_period_id,
            'period_no':              tp.period_no if tp else None,
            'day':                    tp.day if tp else '',
            'start_time':             tp.start_time if tp else '',
            'end_time':               tp.end_time if tp else '',
            'room':                   tp.room if tp else '',
            'subject_id':             tp.subject_id if tp else None,
            'subject_name':           tp.subject.name if (tp and tp.subject) else '',
            'class_id':               class_id,
            'class_name':             cls_name,
            'original_teacher_id':    self.original_teacher_id,
            'original_teacher_name':  orig_name,
            'substitute_teacher_id':  self.substitute_teacher_id,
            'substitute_teacher_name': sub_name,
            'status':                 self.status,
            'reason':                 self.reason or '',
            'notes':                  self.notes or '',
            'assigned_by':            self.assigned_by,
            'assigner_name':          assigner_name,
            'created_at':             self.created_at.isoformat() if self.created_at else None,
        }
