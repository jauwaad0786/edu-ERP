from datetime import datetime
import json
from app import db
from app.utils.timezone_util import utc_now


class NotificationTemplate(db.Model):
    """
    Template for multi-channel notifications (In-App, Expo Push, Web Push).
    Can be platform-wide (school_id is None) or customized per school.
    Supports token placeholders e.g. {student_name}, {amount}, {date}, etc.
    """
    __tablename__ = 'notification_templates'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    code               = db.Column(db.String(80), nullable=False, index=True)  # e.g. 'FEE_REMINDER', 'ATTENDANCE_ABSENT'
    name               = db.Column(db.String(150), nullable=False)
    category           = db.Column(db.String(50), nullable=False, index=True)  # FEES, ATTENDANCE, EXAMS, RESULTS, HOSTEL, TRANSPORT, HRMS, ADMISSION, COMMUNICATION
    title_template     = db.Column(db.String(250), nullable=False)
    body_template      = db.Column(db.Text, nullable=False)
    supported_channels = db.Column(db.String(100), default='in_app,push')  # comma-separated: in_app,push,web_push
    default_priority   = db.Column(db.String(20), default='MEDIUM')        # LOW, MEDIUM, HIGH, CRITICAL
    deep_link_template = db.Column(db.String(300), default='')             # e.g. /fees, /attendance, /exams/{exam_id}
    is_active          = db.Column(db.Boolean, default=True, nullable=False, index=True)
    is_system          = db.Column(db.Boolean, default=False, nullable=False) # system defaults cannot be deleted
    created_at         = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at         = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'code', name='uq_school_template_code'),
    )

    school = db.relationship('School', foreign_keys=[school_id], backref='notification_templates', lazy='joined')

    def to_dict(self):
        return {
            'id':                 self.id,
            'school_id':          self.school_id,
            'code':               self.code,
            'name':               self.name,
            'category':           self.category,
            'title_template':     self.title_template,
            'body_template':      self.body_template,
            'supported_channels': [c.strip() for c in (self.supported_channels or 'in_app,push').split(',') if c.strip()],
            'default_priority':   self.default_priority or 'MEDIUM',
            'deep_link_template': self.deep_link_template or '',
            'is_active':          self.is_active,
            'is_system':          self.is_system,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
            'updated_at':         self.updated_at.isoformat() if self.updated_at else None,
        }


class NotificationRule(db.Model):
    """
    Automated triggers mapping domain events to templates, roles, and conditions.
    """
    __tablename__ = 'notification_rules'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    event_name     = db.Column(db.String(80), nullable=False, index=True)  # e.g. 'attendance.absent', 'fees.collected', 'exams.published'
    template_id    = db.Column(db.Integer, db.ForeignKey('notification_templates.id'), nullable=True)
    target_roles   = db.Column(db.String(200), default='ALL')              # comma-separated roles e.g. 'PARENT,STUDENT'
    channels       = db.Column(db.String(100), default='in_app,push')      # comma-separated
    is_enabled     = db.Column(db.Boolean, default=True, nullable=False, index=True)
    delay_minutes  = db.Column(db.Integer, default=0)                      # 0 = instant, >0 = delayed
    condition_json = db.Column(db.Text, default='{}')                      # JSON string of criteria (e.g. {"min_days_due": 3})
    created_at     = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at     = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    template = db.relationship('NotificationTemplate', foreign_keys=[template_id], backref='rules', lazy='joined')
    school   = db.relationship('School', foreign_keys=[school_id], backref='notification_rules', lazy='joined')

    def to_dict(self):
        conditions = {}
        try:
            if self.condition_json:
                conditions = json.loads(self.condition_json)
        except Exception:
            conditions = {}

        return {
            'id':             self.id,
            'school_id':      self.school_id,
            'event_name':     self.event_name,
            'template_id':    self.template_id,
            'template_name':  self.template.name if self.template else None,
            'template_code':  self.template.code if self.template else None,
            'target_roles':   [r.strip() for r in (self.target_roles or 'ALL').split(',') if r.strip()],
            'channels':       [c.strip() for c in (self.channels or 'in_app,push').split(',') if c.strip()],
            'is_enabled':     self.is_enabled,
            'delay_minutes':  self.delay_minutes or 0,
            'conditions':     conditions,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
            'updated_at':     self.updated_at.isoformat() if self.updated_at else None,
        }


class NotificationPreference(db.Model):
    """
    Per-user notification channel preferences & quiet hours.
    Allows user to mute push notifications for specific categories or during night hours.
    """
    __tablename__ = 'notification_preferences'

    id                 = db.Column(db.Integer, primary_key=True)
    user_id            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    category           = db.Column(db.String(50), nullable=False, index=True)  # 'FEES', 'ATTENDANCE', 'EXAMS', 'RESULTS', 'HOSTEL', 'TRANSPORT', 'HRMS', 'COMMUNICATION'
    in_app_enabled     = db.Column(db.Boolean, default=True, nullable=False)
    push_enabled       = db.Column(db.Boolean, default=True, nullable=False)
    quiet_hours_start  = db.Column(db.String(10), nullable=True) # '22:00'
    quiet_hours_end    = db.Column(db.String(10), nullable=True) # '07:00'
    created_at         = db.Column(db.DateTime, default=utc_now, nullable=False)
    updated_at         = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'category', name='uq_user_category_preference'),
    )

    user   = db.relationship('User', foreign_keys=[user_id], backref='notification_preferences', lazy='joined')
    school = db.relationship('School', foreign_keys=[school_id], backref='user_notification_preferences', lazy='joined')

    def to_dict(self):
        return {
            'id':                self.id,
            'user_id':           self.user_id,
            'school_id':         self.school_id,
            'category':          self.category,
            'in_app_enabled':    self.in_app_enabled,
            'push_enabled':      self.push_enabled,
            'quiet_hours_start': self.quiet_hours_start,
            'quiet_hours_end':   self.quiet_hours_end,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
            'updated_at':        self.updated_at.isoformat() if self.updated_at else None,
        }


class NotificationDeliveryLog(db.Model):
    """
    Audit log for notification deliveries across all channels.
    Tracks success, failure, provider response, and latency.
    """
    __tablename__ = 'notification_delivery_logs'

    id                = db.Column(db.Integer, primary_key=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    notification_id   = db.Column(db.Integer, db.ForeignKey('support_notifications.id'), nullable=True, index=True)
    user_id           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    channel           = db.Column(db.String(30), nullable=False) # 'in_app', 'expo_push', 'web_push'
    status            = db.Column(db.String(30), default='PENDING', index=True) # 'PENDING', 'SENT', 'FAILED', 'READ', 'DEVICE_NOT_FOUND', 'INVALID_TOKEN'
    recipient_target  = db.Column(db.String(250), default='')    # push token or user phone/email
    provider_response = db.Column(db.Text, default='')           # raw provider ticket or receipt
    error_message     = db.Column(db.Text, default='')
    sent_at           = db.Column(db.DateTime, nullable=True)
    delivered_at      = db.Column(db.DateTime, nullable=True)
    created_at        = db.Column(db.DateTime, default=utc_now, nullable=False, index=True)

    notification = db.relationship('SupportNotification', foreign_keys=[notification_id], backref='delivery_logs', lazy='joined')
    user         = db.relationship('User', foreign_keys=[user_id], backref='notification_delivery_logs', lazy='joined')
    school       = db.relationship('School', foreign_keys=[school_id], backref='notification_delivery_logs', lazy='joined')

    def to_dict(self):
        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'notification_id':   self.notification_id,
            'user_id':           self.user_id,
            'recipient_name':    self.user.name if self.user else None,
            'channel':           self.channel,
            'status':            self.status,
            'recipient_target':  self.recipient_target,
            'error_message':     self.error_message,
            'sent_at':           self.sent_at.isoformat() if self.sent_at else None,
            'delivered_at':      self.delivered_at.isoformat() if self.delivered_at else None,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class ScheduledNotification(db.Model):
    """
    Queue for delayed or scheduled notifications (e.g. fee reminder in 3 days, announcement at 8 AM).
    Processed by APScheduler background runner.
    """
    __tablename__ = 'scheduled_notifications'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    event_name   = db.Column(db.String(80), nullable=False)
    payload_json = db.Column(db.Text, nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False, index=True)
    status       = db.Column(db.String(20), default='PENDING', index=True) # PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
    attempts     = db.Column(db.Integer, default=0)
    last_error   = db.Column(db.Text, default='')
    created_at   = db.Column(db.DateTime, default=utc_now, nullable=False)
    processed_at = db.Column(db.DateTime, nullable=True)

    school = db.relationship('School', foreign_keys=[school_id], backref='scheduled_notifications', lazy='joined')

    def to_dict(self):
        payload = {}
        try:
            if self.payload_json:
                payload = json.loads(self.payload_json)
        except Exception:
            payload = {}

        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'event_name':   self.event_name,
            'payload':      payload,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'status':       self.status,
            'attempts':     self.attempts,
            'last_error':   self.last_error,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
        }
