# backend/app/models/developer_center.py
"""
Developer Error Center — koi bhi unhandled exception, chahe kisi bhi school
me ho ya company-side, yahan aake capture hota hai. error_middleware.py
(agla file) is model ko populate karega — global Flask errorhandler se.

Design decisions:
  - product_id yahan se hi correct rakha — audit_logs me yeh column miss
    ho gaya tha (Role/Permission me hai), yahan se galti repeat nahi karni.
  - Dedupe via fingerprint: production me same crash (same exception, same
    endpoint, same stack top-frame) minute me 500 baar aa sakta hai — agar
    har baar naya row banaya to table explode ho jayegi aur dashboard bhi
    unusable ho jayega. Isliye ek fingerprint hash column hai — same
    fingerprint dobara aaye to naya row nahi, occurrence_count++ aur
    last_seen_at update hota hai. Yehi Sentry/Bugsnag jaise tools ka core
    pattern hai.
  - severity auto-classify hoti hai status_code se (error_middleware me),
    yahan sirf column hai — koi hardcoded business rule model me nahi.
"""

from app import db
from datetime import datetime
import hashlib

ERROR_TYPES = [
    'SQL', 'AUTH', 'VALIDATION', 'EXTERNAL_API',
    'OTP', 'WHATSAPP', 'PAYMENT', 'EMAIL', 'CLOUDINARY', 'UNKNOWN',
]

SEVERITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

# Jira-style lifecycle — IssueAssignment isi status ko drive karega,
# ErrorLog.status hi single source of truth hai (IssueAssignment me
# duplicate status column jaan-boojh kar nahi rakha).
ERROR_STATUSES = [
    'NEW', 'ASSIGNED', 'IN_PROGRESS', 'TESTING', 'RESOLVED', 'CLOSED', 'REOPENED',
]

ASSIGNMENT_TEAMS = ['BACKEND', 'FRONTEND', 'QA', 'DEVOPS']
PRIORITY_LEVELS = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW']


# ═══════════════════════════════════════════════════════════════════════════
#  ERROR LOG
# ═══════════════════════════════════════════════════════════════════════════

class ErrorLog(db.Model):
    __tablename__ = 'error_logs'

    id                 = db.Column(db.Integer, primary_key=True)

    product_id         = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True, index=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    user_id            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    role_snapshot      = db.Column(db.String(50), nullable=True)

    module             = db.Column(db.String(50), nullable=True, index=True)   # e.g. 'fees', 'hostel'
    page               = db.Column(db.String(100), nullable=True)              # frontend route/screen
    button_clicked     = db.Column(db.String(100), nullable=True)              # frontend-supplied, optional

    api_endpoint       = db.Column(db.String(200), nullable=True)
    http_method        = db.Column(db.String(10), nullable=True)

    # Text (not JSON type) — same portability reasoning as AuditLog.
    payload            = db.Column(db.Text, nullable=True)   # request body, secrets redacted before storing
    headers            = db.Column(db.Text, nullable=True)   # request headers, Authorization redacted

    exception_type     = db.Column(db.String(120), nullable=True, index=True)   # e.g. 'IntegrityError'
    exception_message  = db.Column(db.Text, nullable=True)
    stack_trace        = db.Column(db.Text, nullable=True)

    error_type         = db.Column(db.String(20), nullable=False, default='UNKNOWN', index=True)
    severity           = db.Column(db.String(10), nullable=False, default='MEDIUM', index=True)
    status             = db.Column(db.String(20), nullable=False, default='NEW', index=True)

    # Dedupe key — sha256(error_type + api_endpoint + exception_type + top stack frame).
    fingerprint        = db.Column(db.String(64), nullable=True, index=True)
    occurrence_count   = db.Column(db.Integer, default=1, nullable=False)

    ip_address         = db.Column(db.String(45), nullable=True)
    browser            = db.Column(db.String(100), nullable=True)
    os                 = db.Column(db.String(100), nullable=True)

    # Same correlation key as AuditLog.request_id — ek hi request ka
    # audit row aur error row dono is id se jud sakte hain.
    request_id         = db.Column(db.String(64), nullable=True, index=True)

    first_seen_at      = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen_at        = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    resolved_at         = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index('ix_error_status_severity', 'status', 'severity'),
        db.Index('ix_error_product_status', 'product_id', 'status'),
    )

    def to_dict(self):
        import json
        return {
            'id':                self.id,
            'product_id':        self.product_id,
            'school_id':         self.school_id,
            'user_id':           self.user_id,
            'role_snapshot':     self.role_snapshot,
            'module':            self.module,
            'page':              self.page,
            'button_clicked':    self.button_clicked,
            'api_endpoint':      self.api_endpoint,
            'http_method':       self.http_method,
            'exception_type':    self.exception_type,
            'exception_message': self.exception_message,
            'error_type':        self.error_type,
            'severity':          self.severity,
            'status':            self.status,
            'occurrence_count':  self.occurrence_count,
            'request_id':        self.request_id,
            'first_seen_at':     self.first_seen_at.isoformat() if self.first_seen_at else None,
            'last_seen_at':      self.last_seen_at.isoformat() if self.last_seen_at else None,
            'resolved_at':       self.resolved_at.isoformat() if self.resolved_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  ISSUE ASSIGNMENT  (Jira-style board — who's fixing which error)
# ═══════════════════════════════════════════════════════════════════════════
# assigned_to_user_id nullable hai jaan-boojh kar: abhi UserRole enum me
# koi BACKEND/FRONTEND/QA developer role nahi hai (sirf school-side roles
# hain — user.py dekha). Jab tak rbac.py ka COMPANY-scope Role system
# developer team members register nahi karta, assigned_team (free string)
# hi primary field hai; assigned_to_user_id future-proofing ke liye hai.

class IssueAssignment(db.Model):
    __tablename__ = 'issue_assignments'

    id                   = db.Column(db.Integer, primary_key=True)
    error_id             = db.Column(db.Integer, db.ForeignKey('error_logs.id'), nullable=False, index=True)

    assigned_team        = db.Column(db.String(20), nullable=True)   # ASSIGNMENT_TEAMS
    assigned_to_user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_by_user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    priority             = db.Column(db.String(20), nullable=False, default='P2_MEDIUM')
    deadline             = db.Column(db.DateTime, nullable=True)

    resolution_note      = db.Column(db.Text, nullable=True)
    resolved_by_user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resolved_at          = db.Column(db.DateTime, nullable=True)

    created_at           = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'error_id':         self.error_id,
            'assigned_team':    self.assigned_team,
            'assigned_to_user_id': self.assigned_to_user_id,
            'priority':         self.priority,
            'deadline':         self.deadline.isoformat() if self.deadline else None,
            'resolution_note':  self.resolution_note,
            'resolved_at':      self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  WRITE HELPER  (error_middleware.py, agla file, isko call karega)
# ═══════════════════════════════════════════════════════════════════════════

def make_fingerprint(error_type, api_endpoint, exception_type, stack_top_line):
    raw = f'{error_type}|{api_endpoint}|{exception_type}|{stack_top_line}'
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def log_error(fingerprint, defaults):
    """
    Idempotent write: same fingerprint mile to existing row ka
    occurrence_count++ aur last_seen_at update, warna naya row.
    `defaults` ek dict hai jisme naya row banane ke liye saari fields hon.
    """
    existing = ErrorLog.query.filter(
        ErrorLog.fingerprint == fingerprint,
        ErrorLog.status.notin_(['RESOLVED', 'CLOSED', 'ARCHIVED'])
    ).first()
    if existing:
        existing.occurrence_count += 1
        existing.last_seen_at = datetime.utcnow()
        return existing

    row = ErrorLog(fingerprint=fingerprint, **defaults)
    db.session.add(row)
    return row
