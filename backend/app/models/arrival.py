"""
Student Arrival Event Model
Part of EduERP Parent Arrival Confirmation Workflow.
Stores physical arrival events marked by school staff and parent interactive responses (YES / NO / NO_RESPONSE).
"""

from datetime import datetime, date
from uuid import uuid4
from app import db
from app.utils.timezone_util import utc_now


class StudentArrivalEvent(db.Model):
    """
    Lifecycle:
    ARRIVAL_RECORDED -> NOTIFICATION_QUEUED -> SENT/DELIVERED -> CONFIRMED_YES / REPORTED_NO / NO_RESPONSE
    """
    __tablename__ = 'student_arrival_events'

    id           = db.Column(db.Integer, primary_key=True)
    event_uuid   = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()), index=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True, index=True)
    session      = db.Column(db.String(20), nullable=True)

    # Timing
    arrival_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    arrival_time = db.Column(db.DateTime, nullable=False, default=utc_now)
    recorded_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # Parent linkage snapshot
    parent_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    parent_phone   = db.Column(db.String(20), nullable=True)
    parent_name    = db.Column(db.String(120), nullable=True)

    # Delivery & Response Status
    # delivery_status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'
    delivery_status   = db.Column(db.String(30), default='DELIVERED', nullable=False)
    # response_status: 'AWAITING_RESPONSE' | 'CONFIRMED_YES' | 'REPORTED_NO' | 'NO_RESPONSE'
    response_status   = db.Column(db.String(30), default='AWAITING_RESPONSE', nullable=False, index=True)
    response_timestamp = db.Column(db.DateTime, nullable=True)
    responded_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    response_notes    = db.Column(db.String(255), nullable=True)

    # Expiration (default 120 minutes from arrival)
    expires_at        = db.Column(db.DateTime, nullable=False, index=True)

    # Discrepancy handling (when parent taps NO)
    is_discrepancy_resolved     = db.Column(db.Boolean, default=False, nullable=False)
    discrepancy_resolved_at     = db.Column(db.DateTime, nullable=True)
    discrepancy_resolved_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    discrepancy_resolution_notes = db.Column(db.String(255), nullable=True)

    # In-app notification linkage
    notification_id   = db.Column(db.Integer, db.ForeignKey('support_notifications.id'), nullable=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    student           = db.relationship('Student', backref=db.backref('arrival_events', lazy='dynamic'))
    recorder          = db.relationship('User', foreign_keys=[recorded_by])
    responder         = db.relationship('User', foreign_keys=[responded_by_user_id])
    resolver          = db.relationship('User', foreign_keys=[discrepancy_resolved_by])
    parent_user       = db.relationship('User', foreign_keys=[parent_user_id])
    class_ref         = db.relationship('Class', foreign_keys=[class_id])

    __table_args__ = (
        db.UniqueConstraint('school_id', 'student_id', 'arrival_date', name='uq_arrival_event_student_date'),
        db.Index('idx_arrival_school_date', 'school_id', 'arrival_date'),
        db.Index('idx_arrival_school_status', 'school_id', 'response_status'),
        db.Index('idx_arrival_student_date', 'student_id', 'arrival_date'),
    )

    def is_expired(self):
        """Returns True if current time is past expiration deadline and still awaiting response."""
        now = utc_now()
        now_naive = now.replace(tzinfo=None) if now.tzinfo else now
        exp_naive = self.expires_at.replace(tzinfo=None) if (self.expires_at and self.expires_at.tzinfo) else self.expires_at
        return bool(exp_naive and now_naive > exp_naive and self.response_status == 'AWAITING_RESPONSE')

    @property
    def effective_status(self):
        """Returns NO_RESPONSE if deadline has expired without an explicit answer."""
        if self.is_expired():
            return 'NO_RESPONSE'
        return self.response_status

    @property
    def recorded_by_id(self):
        return self.recorded_by

    @recorded_by_id.setter
    def recorded_by_id(self, val):
        self.recorded_by = val

    @property
    def uuid_token(self):
        return self.event_uuid

    @uuid_token.setter
    def uuid_token(self, val):
        self.event_uuid = val

    @property
    def response_at(self):
        return self.response_timestamp

    @response_at.setter
    def response_at(self, val):
        self.response_timestamp = val

    @property
    def responded_by_id(self):
        return self.responded_by_user_id

    @responded_by_id.setter
    def responded_by_id(self, val):
        self.responded_by_user_id = val

    @property
    def discrepancy_resolved(self):
        return self.is_discrepancy_resolved

    @discrepancy_resolved.setter
    def discrepancy_resolved(self, val):
        self.is_discrepancy_resolved = val

    @property
    def resolved_by_id(self):
        return self.discrepancy_resolved_by

    @resolved_by_id.setter
    def resolved_by_id(self, val):
        self.discrepancy_resolved_by = val

    @property
    def resolution_notes(self):
        return self.discrepancy_resolution_notes

    @resolution_notes.setter
    def resolution_notes(self, val):
        self.discrepancy_resolution_notes = val

    def to_dict(self):
        now = utc_now()
        now_naive = now.replace(tzinfo=None) if now.tzinfo else now
        exp_naive = self.expires_at.replace(tzinfo=None) if (self.expires_at and self.expires_at.tzinfo) else self.expires_at
        is_exp = bool(exp_naive and now_naive > exp_naive)
        eff_status = 'NO_RESPONSE' if (is_exp and self.response_status == 'AWAITING_RESPONSE') else self.response_status

        # Student details
        stu_name = ''
        stu_roll = ''
        stu_adm  = ''
        cls_name = ''
        cls_sec  = ''
        if self.student:
            stu_name = self.student.user.name if self.student.user else ''
            stu_roll = self.student.roll_number or ''
            stu_adm  = self.student.admission_no or ''
            if self.student.class_ref:
                cls_name = self.student.class_ref.name or ''
                cls_sec  = self.student.class_ref.section or ''
        elif self.class_ref:
            cls_name = self.class_ref.name or ''
            cls_sec  = self.class_ref.section or ''

        return {
            'id':                          self.id,
            'event_uuid':                  self.event_uuid,
            'uuid_token':                  self.event_uuid,
            'token':                       self.event_uuid,
            'school_id':                   self.school_id,
            'student_id':                  self.student_id,
            'student_name':                stu_name,
            'roll_number':                 stu_roll,
            'admission_no':                stu_adm,
            'class_id':                    self.class_id,
            'class_name':                  cls_name,
            'section':                     cls_sec,
            'class_display':               f"{cls_name} - {cls_sec}".strip(' -') if cls_name else '',
            'session':                     self.session or '',
            'arrival_date':                self.arrival_date.isoformat() if self.arrival_date else None,
            'arrival_time':                self.arrival_time.isoformat() if self.arrival_time else None,
            'recorded_by':                 self.recorded_by,
            'recorder_name':               self.recorder.name if self.recorder else '',
            'parent_user_id':              self.parent_user_id,
            'parent_name':                 self.parent_name or '',
            'parent_phone':                self.parent_phone or '',
            'delivery_status':             self.delivery_status,
            'response_status':             eff_status,
            'raw_response_status':         self.response_status,
            'response_timestamp':          self.response_timestamp.isoformat() if self.response_timestamp else None,
            'response_at':                 self.response_timestamp.isoformat() if self.response_timestamp else None,
            'responded_by_user_id':        self.responded_by_user_id,
            'responded_by_id':             self.responded_by_user_id,
            'responder_name':              self.responder.name if self.responder else '',
            'response_notes':              self.response_notes or '',
            'expires_at':                  self.expires_at.isoformat() if self.expires_at else None,
            'is_expired':                  is_exp,
            'is_discrepancy_resolved':     self.is_discrepancy_resolved,
            'discrepancy_resolved':        self.is_discrepancy_resolved,
            'discrepancy_resolved_at':     self.discrepancy_resolved_at.isoformat() if self.discrepancy_resolved_at else None,
            'resolver_name':               self.resolver.name if self.resolver else '',
            'discrepancy_resolution_notes': self.discrepancy_resolution_notes or '',
            'resolution_notes':            self.discrepancy_resolution_notes or '',
            'notification_id':             self.notification_id,
            'created_at':                  self.created_at.isoformat() if self.created_at else None,
        }
