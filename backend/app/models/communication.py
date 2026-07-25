from app import db
from datetime import datetime


# ─── Enums as plain strings (SQLite + PostgreSQL dono ke liye safe) ───────────

# product_type values  : 'EduERP' | 'CollegeERP' | 'HotelERP' | 'HospitalERP' | 'HRMERP' | 'SalesERP'
# ticket status values : 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' | 'REJECTED'
# priority values      : 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
# category values      : 'COMPLAINT' | 'SUGGESTION' | 'FEEDBACK' | 'TECHNICAL' | 'ACADEMIC'
#                        'FEE' | 'TEACHER' | 'STUDENT' | 'PARENT_QUERY' | 'WEBSITE_BUG'
#                        'ERP_BUG' | 'FEATURE_REQUEST' | 'GENERAL' | 'EMERGENCY'
# plan values          : 'BASIC' | 'PREMIUM'
# meeting mode values  : 'GOOGLE_MEET' | 'ZOOM' | 'PHONE' | 'REMOTE' | 'ONSITE'
# meeting status values: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'RESCHEDULED' | 'COMPLETED'
# announcement audience: 'ALL' | 'TEACHERS' | 'STUDENTS' | 'PARENTS' | 'STAFF'


# ─── 1. Support Ticket ────────────────────────────────────────────────────────

class SupportTicket(db.Model):
    """
    Central ticket for all customer service requests.
    Works across EduERP, HotelERP, HospitalERP, HRM, Sales ERP etc.
    Developer dashboard pe product_type + school_name se instantly
    pata chalta hai — kis product ka, kis client ka issue hai.
    """
    __tablename__ = 'support_tickets'

    id           = db.Column(db.Integer, primary_key=True)

    # ── Ticket Identity ──────────────────────────────────────────────────────
    ticket_no    = db.Column(db.String(30), unique=True, nullable=False)
    # e.g. TKT-20260624-AB12

    # ── Multi-Product Context (developer ke liye critical) ───────────────────
    product_type = db.Column(db.String(30), default='EduERP')
    # EduERP / CollegeERP / HotelERP / HospitalERP / HRMERP / SalesERP

    # ── School / Organisation Info ───────────────────────────────────────────
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    school_name  = db.Column(db.String(200), default='')
    # denormalized — developer dashboard filter ke liye, school delete hone pe bhi visible rahe

    # ── Who Raised It ────────────────────────────────────────────────────────
    raised_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    raiser_name  = db.Column(db.String(120), default='')   # denormalized
    raiser_role  = db.Column(db.String(30),  default='')   # PRINCIPAL / TEACHER etc.

    # ── Ticket Details ────────────────────────────────────────────────────────
    category     = db.Column(db.String(30),  default='GENERAL')
    subject      = db.Column(db.String(300), nullable=False)
    description  = db.Column(db.Text,        default='')
    module_name  = db.Column(db.String(100), default='')
    # e.g. 'Fees Management', 'Attendance', 'Payroll', 'Room Booking'
    # helps developer know exactly which module has the bug

    # ── Routing ──────────────────────────────────────────────────────────────
    send_to      = db.Column(db.String(30),  default='ERP_SUPPORT')
    # PRINCIPAL / TEACHER / SCHOOL_ADMIN / ERP_SUPPORT / DEVELOPER / SUPER_ADMIN

    # ── Priority & Status ────────────────────────────────────────────────────
    priority     = db.Column(db.String(20),  default='MEDIUM')
    status       = db.Column(db.String(30),  default='OPEN')

    # ── Assignment (developer/engineer) ──────────────────────────────────────
    assigned_to  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_at  = db.Column(db.DateTime, nullable=True)

    # ── Resolution ───────────────────────────────────────────────────────────
    resolution_notes = db.Column(db.Text, default='')
    resolved_at      = db.Column(db.DateTime, nullable=True)
    resolved_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # ── Timestamps ───────────────────────────────────────────────────────────
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    replies      = db.relationship('TicketReply',  backref='ticket',
                                   lazy='dynamic', cascade='all, delete-orphan')
    attachments  = db.relationship('SupportAttachment', backref='ticket',
                                   lazy='dynamic', cascade='all, delete-orphan')
    notifications = db.relationship('SupportNotification', backref='ticket',
                                    lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':               self.id,
            'ticket_no':        self.ticket_no,
            'product_type':     self.product_type,
            'school_id':        self.school_id,
            'school_name':      self.school_name,
            'raised_by':        self.raised_by,
            'raiser_name':      self.raiser_name,
            'raiser_role':      self.raiser_role,
            'category':         self.category,
            'subject':          self.subject,
            'description':      self.description,
            'module_name':      self.module_name,
            'send_to':          self.send_to,
            'priority':         self.priority,
            'status':           self.status,
            'assigned_to':      self.assigned_to,
            'assigned_at':      self.assigned_at.isoformat()  if self.assigned_at  else None,
            'resolution_notes': self.resolution_notes or '',
            'resolved_at':      self.resolved_at.isoformat()  if self.resolved_at  else None,
            'created_at':       self.created_at.isoformat()   if self.created_at   else None,
            'updated_at':       self.updated_at.isoformat()   if self.updated_at   else None,
            'reply_count':      self.replies.count(),
        }


# ─── 2. Ticket Reply (conversation thread) ────────────────────────────────────

class TicketReply(db.Model):
    """
    Threaded replies on a ticket.
    Works like email thread — raiser aur engineer dono reply kar sakte hain.
    """
    __tablename__ = 'ticket_replies'

    id         = db.Column(db.Integer, primary_key=True)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('support_tickets.id'), nullable=False)
    replied_by = db.Column(db.Integer, db.ForeignKey('users.id'),           nullable=False)
    reply_name = db.Column(db.String(120), default='')   # denormalized
    reply_role = db.Column(db.String(30),  default='')   # PRINCIPAL / ENGINEER etc.
    message    = db.Column(db.Text,        nullable=False)
    is_internal= db.Column(db.Boolean,     default=False)
    # internal=True → sirf staff dekhega, client ko nahi (like Freshdesk private note)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)

    attachments = db.relationship('SupportAttachment', backref='reply',
                                  lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':          self.id,
            'ticket_id':   self.ticket_id,
            'replied_by':  self.replied_by,
            'reply_name':  self.reply_name,
            'reply_role':  self.reply_role,
            'message':     self.message,
            'is_internal': self.is_internal,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }


# ─── 3. Direct Chat Message ───────────────────────────────────────────────────

class ChatMessage(db.Model):
    """
    Real-time style direct messages between users.
    WhatsApp / Instagram style — read receipts, sender/receiver.
    """
    __tablename__ = 'chat_messages'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=True)
    sender_id    = db.Column(db.Integer, db.ForeignKey('users.id'),    nullable=False)
    receiver_id  = db.Column(db.Integer, db.ForeignKey('users.id'),    nullable=False)
    message      = db.Column(db.Text,    nullable=False)
    message_type = db.Column(db.String(20), default='TEXT')
    # TEXT / IMAGE / PDF / DOCUMENT / VOICE (future)
    file_url     = db.Column(db.String(500), nullable=True)
    file_name    = db.Column(db.String(200), nullable=True)
    is_read      = db.Column(db.Boolean, default=False)
    read_at      = db.Column(db.DateTime, nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    sender   = db.relationship('User', foreign_keys=[sender_id],   backref='sent_messages')
    receiver = db.relationship('User', foreign_keys=[receiver_id],  backref='received_messages')

    def to_dict(self):
        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'sender_id':    self.sender_id,
            'sender_name':  self.sender.name  if self.sender   else '',
            'receiver_id':  self.receiver_id,
            'receiver_name':self.receiver.name if self.receiver else '',
            'message':      self.message,
            'message_type': self.message_type,
            'file_url':     self.file_url  or None,
            'file_name':    self.file_name or None,
            'is_read':      self.is_read,
            'read_at':      self.read_at.isoformat()   if self.read_at   else None,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# ─── 4. In-App Notification ───────────────────────────────────────────────────

class SupportNotification(db.Model):
    """
    Bell icon notifications — unread badge count.
    Har ticket action pe ek row banta hai.
    """
    __tablename__ = 'support_notifications'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'),           nullable=False)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('support_tickets.id'), nullable=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'),         nullable=True)
    title      = db.Column(db.String(200), nullable=False)
    message    = db.Column(db.String(500), default='')
    notif_type = db.Column(db.String(30),  default='TICKET')
    # TICKET / CHAT / MEETING / ANNOUNCEMENT / SYSTEM
    is_read    = db.Column(db.Boolean,  default=False)
    read_at    = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'ticket_id':  self.ticket_id,
            'school_id':  self.school_id,
            'title':      self.title,
            'message':    self.message,
            'notif_type': self.notif_type,
            'is_read':    self.is_read,
            'read_at':    self.read_at.isoformat()   if self.read_at   else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ─── 5. Meeting Request ───────────────────────────────────────────────────────

class MeetingRequest(db.Model):
    """
    Principal → Developer/Admin meeting book kare.
    Google Meet / Zoom / Phone / Remote / Onsite.
    """
    __tablename__ = 'meeting_requests'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    school_name  = db.Column(db.String(200), default='')   # denormalized
    product_type = db.Column(db.String(30),  default='EduERP')
    requested_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    requester_name = db.Column(db.String(120), default='')
    requester_role = db.Column(db.String(30),  default='')

    # ── Meeting Details ───────────────────────────────────────────────────────
    topic        = db.Column(db.String(300), nullable=False)
    description  = db.Column(db.Text,        default='')
    meeting_date = db.Column(db.Date,         nullable=False)
    meeting_time = db.Column(db.String(10),   nullable=False)   # "10:30 AM"
    priority     = db.Column(db.String(20),   default='MEDIUM')
    preferred_mode = db.Column(db.String(20), default='GOOGLE_MEET')
    # GOOGLE_MEET / ZOOM / PHONE / REMOTE / ONSITE

    # ── Status & Response ─────────────────────────────────────────────────────
    status         = db.Column(db.String(20), default='PENDING')
    # PENDING / ACCEPTED / REJECTED / RESCHEDULED / COMPLETED
    meeting_link   = db.Column(db.String(500), nullable=True)
    # Google Meet / Zoom link — filled by developer on accept
    response_note  = db.Column(db.String(500), default='')
    handled_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # ── Reschedule ────────────────────────────────────────────────────────────
    reschedule_date = db.Column(db.Date,      nullable=True)
    reschedule_time = db.Column(db.String(10), nullable=True)

    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'school_name':      self.school_name,
            'product_type':     self.product_type,
            'requested_by':     self.requested_by,
            'requester_name':   self.requester_name,
            'requester_role':   self.requester_role,
            'topic':            self.topic,
            'description':      self.description,
            'meeting_date':     str(self.meeting_date)  if self.meeting_date  else None,
            'meeting_time':     self.meeting_time,
            'priority':         self.priority,
            'preferred_mode':   self.preferred_mode,
            'status':           self.status,
            'meeting_link':     self.meeting_link  or None,
            'response_note':    self.response_note or '',
            'reschedule_date':  str(self.reschedule_date) if self.reschedule_date else None,
            'reschedule_time':  self.reschedule_time or None,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
            'updated_at':       self.updated_at.isoformat() if self.updated_at else None,
        }


# ─── 6. Announcement ──────────────────────────────────────────────────────────

class Announcement(db.Model):
    """
    Principal → broadcast to Teachers / Students / Parents / All.
    Schedule, pin, expire support.
    """
    __tablename__ = 'announcements'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    # NULL = platform-wide (Developer/Super Admin → ALL_SCHOOLS). Set = either a
    # school's own announcement OR a Super Admin announcement targeted at ONE
    # specific school. Never trust this from the frontend for school users —
    # see create_announcement() in routes/communication/announcements.py.
    product_type = db.Column(db.String(30), default='EduERP')
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'),   nullable=False)
    creator_name = db.Column(db.String(120), default='')
    creator_role = db.Column(db.String(30),  default='')

    # ── Content ───────────────────────────────────────────────────────────────
    title        = db.Column(db.String(300), nullable=False)
    body         = db.Column(db.Text,        nullable=False)
    audience     = db.Column(db.String(30),  default='ALL')
    # ALL / TEACHERS / STUDENTS / PARENTS / STAFF
    priority     = db.Column(db.String(20),  default='MEDIUM')

    # ── Scheduling & Pinning ──────────────────────────────────────────────────
    is_pinned    = db.Column(db.Boolean, default=False)
    is_active    = db.Column(db.Boolean, default=True)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    # NULL = publish now, datetime = future schedule
    expires_at   = db.Column(db.DateTime, nullable=True)
    # NULL = never expires

    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        school_name = None
        if self.school_id:
            from app.models.school import School
            s = School.query.get(self.school_id)
            school_name = s.name if s else None
        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'school_name':  school_name,
            'is_platform':  self.school_id is None,
            'product_type': self.product_type,
            'created_by':   self.created_by,
            'creator_name': self.creator_name,
            'creator_role': self.creator_role,
            'title':        self.title,
            'body':         self.body,
            'audience':     self.audience,
            'priority':     self.priority,
            'is_pinned':    self.is_pinned,
            'is_active':    self.is_active,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'expires_at':   self.expires_at.isoformat()   if self.expires_at   else None,
            'created_at':   self.created_at.isoformat()   if self.created_at   else None,
        }



# ─── 7. Support Plan ──────────────────────────────────────────────────────────

class SupportPlan(db.Model):
    """
    Per-school support subscription.
    BASIC = 1 ticket/week. PREMIUM = unlimited.
    """
    __tablename__ = 'support_plans'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'),
                             nullable=False, unique=True)
    product_type = db.Column(db.String(30), default='EduERP')
    plan         = db.Column(db.String(20), default='BASIC')
    # BASIC / PREMIUM
    is_active    = db.Column(db.Boolean, default=True)
    # Premium billing
    amount       = db.Column(db.Float,   default=0.0)
    billing_date = db.Column(db.Date,    nullable=True)
    expires_at   = db.Column(db.DateTime, nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'school_id':    self.school_id,
            'product_type': self.product_type,
            'plan':         self.plan,
            'is_active':    self.is_active,
            'amount':       self.amount,
            'billing_date': str(self.billing_date) if self.billing_date else None,
            'expires_at':   self.expires_at.isoformat() if self.expires_at else None,
        }


# ─── 8. Support Usage (weekly limit tracker) ──────────────────────────────────

class SupportUsage(db.Model):
    """
    Tracks how many tickets a school raised this week.
    BASIC plan = max 1 per week.
    week_key format: '2026-W25' (ISO week)
    """
    __tablename__ = 'support_usage'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    week_key   = db.Column(db.String(10), nullable=False)   # '2026-W25'
    ticket_count = db.Column(db.Integer, default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'week_key', name='uq_support_usage_school_week'),
    )

    def to_dict(self):
        return {
            'school_id':    self.school_id,
            'week_key':     self.week_key,
            'ticket_count': self.ticket_count,
        }


# ─── 9. Knowledge Base ────────────────────────────────────────────────────────

class KnowledgeBase(db.Model):
    """
    Help Center — articles, FAQs, video links, PDF manuals.
    Searchable by all users.
    """
    __tablename__ = 'knowledge_base'

    id           = db.Column(db.Integer, primary_key=True)
    product_type = db.Column(db.String(30), default='EduERP')
    # NULL product_type = visible to all products
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # ── Content ───────────────────────────────────────────────────────────────
    title        = db.Column(db.String(300), nullable=False)
    body         = db.Column(db.Text,        nullable=False)
    article_type = db.Column(db.String(20),  default='ARTICLE')
    # ARTICLE / FAQ / VIDEO / PDF_MANUAL
    video_url    = db.Column(db.String(500), nullable=True)
    file_url     = db.Column(db.String(500), nullable=True)
    tags         = db.Column(db.String(300), default='')
    # comma-separated: 'fees,attendance,marks'
    module_name  = db.Column(db.String(100), default='')
    # 'Fees Management', 'Attendance' etc. — same as ticket module_name
    is_published = db.Column(db.Boolean, default=True)
    views        = db.Column(db.Integer, default=0)

    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'product_type': self.product_type,
            'title':        self.title,
            'body':         self.body,
            'article_type': self.article_type,
            'video_url':    self.video_url  or None,
            'file_url':     self.file_url   or None,
            'tags':         self.tags       or '',
            'module_name':  self.module_name or '',
            'is_published': self.is_published,
            'views':        self.views,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
        }


# ─── 10. Attachment ───────────────────────────────────────────────────────────

class SupportAttachment(db.Model):
    """
    Files attached to tickets or ticket replies.
    Cloudinary se upload hoga — same as student/teacher photo upload.
    """
    __tablename__ = 'support_attachments'

    id          = db.Column(db.Integer, primary_key=True)
    ticket_id   = db.Column(db.Integer, db.ForeignKey('support_tickets.id'), nullable=True)
    reply_id    = db.Column(db.Integer, db.ForeignKey('ticket_replies.id'),   nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'),            nullable=False)
    file_url    = db.Column(db.String(500), nullable=False)
    file_name   = db.Column(db.String(200), default='')
    file_type   = db.Column(db.String(30),  default='')
    # 'IMAGE' / 'PDF' / 'DOCUMENT' / 'OTHER'
    file_size   = db.Column(db.Integer, default=0)   # bytes
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'ticket_id':   self.ticket_id,
            'reply_id':    self.reply_id,
            'uploaded_by': self.uploaded_by,
            'file_url':    self.file_url,
            'file_name':   self.file_name,
            'file_type':   self.file_type,
            'file_size':   self.file_size,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }
