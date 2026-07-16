from app import db
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════
#  SCHOOL-SIDE AUDIT LOG
# ═══════════════════════════════════════════════════════════════════════════
# Har Create/Edit/Delete/Login yahan aayega — Principal dashboard isi table
# ko filter/search/export karega. school_id required hai kyuki ye purely
# tenant-scoped data hai (school ka apna business data).
#
# Scale note (10,000+ schools): ye table sabse tezi se grow karegi. Production
# me isko created_at par MONTHLY range-partition karna chahiye (Postgres
# native partitioning) — abhi single table rakh rahe hain kyuki partitioning
# migration alag concern hai, lekin index isi assumption ke saath design kiya
# hai (school_id + created_at composite, jo partition pruning ke saath bhi
# kaam karega).

AUDIT_ACTIONS = [
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PASSWORD_CHANGE', 'PASSWORD_RESET', 'ROLE_CHANGE', 'PERMISSION_CHANGE',
    'EXPORT', 'API_ERROR',
]


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id               = db.Column(db.Integer, primary_key=True)

    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id          = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)

    # Role/department snapshot AT THE TIME of the action — deliberately not
    # a live FK lookup. If the user's role changes next week, this row must
    # still say what they were when they did it (that's the whole point of
    # an audit trail — it can't retroactively change).
    role_snapshot    = db.Column(db.String(50), nullable=True)
    department       = db.Column(db.String(100), nullable=True)

    module           = db.Column(db.String(50), nullable=False, index=True)   # e.g. 'fees', 'hostel'
    submodule        = db.Column(db.String(50), nullable=True)                # e.g. 'fee_collection'
    action           = db.Column(db.String(30), nullable=False, index=True)   # AUDIT_ACTIONS

    # JSON-serialized snapshots. Text column (not JSON type) for portability
    # across Postgres/SQLite in local dev — app layer handles json.dumps/loads.
    old_value        = db.Column(db.Text, nullable=True)
    new_value        = db.Column(db.Text, nullable=True)

    ip_address       = db.Column(db.String(45), nullable=True)   # IPv6-safe length
    browser          = db.Column(db.String(100), nullable=True)
    os               = db.Column(db.String(100), nullable=True)
    session_id       = db.Column(db.String(100), nullable=True, index=True)

    api_endpoint     = db.Column(db.String(200), nullable=True)
    http_method      = db.Column(db.String(10), nullable=True)
    status_code      = db.Column(db.Integer, nullable=True)
    execution_time_ms = db.Column(db.Integer, nullable=True)

    # Correlates one audit row with an ErrorLog row for the same request
    # (see the future error_logs table) — same request_id on both sides.
    request_id       = db.Column(db.String(64), nullable=True, index=True)
    remarks          = db.Column(db.String(255), nullable=True)

    created_at       = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        db.Index('ix_audit_school_created', 'school_id', 'created_at'),
        db.Index('ix_audit_school_module', 'school_id', 'module'),
    )

    def to_dict(self):
        import json
        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'user_id':           self.user_id,
            'role_snapshot':     self.role_snapshot,
            'department':        self.department,
            'module':            self.module,
            'submodule':         self.submodule,
            'action':            self.action,
            'old_value':         json.loads(self.old_value) if self.old_value else None,
            'new_value':         json.loads(self.new_value) if self.new_value else None,
            'ip_address':        self.ip_address,
            'browser':           self.browser,
            'os':                self.os,
            'api_endpoint':      self.api_endpoint,
            'http_method':       self.http_method,
            'status_code':       self.status_code,
            'execution_time_ms': self.execution_time_ms,
            'request_id':        self.request_id,
            'remarks':           self.remarks,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  COMPANY-SIDE ACTIVITY LOG  (section 9 — NEVER mixed with school logs)
# ═══════════════════════════════════════════════════════════════════════════
# Deliberately a SEPARATE table with no school_id-required column and no
# shared query surface with AuditLog. This is what stops a future "just
# add a WHERE clause" shortcut from accidentally leaking company/developer
# activity into a Principal's school log view, or vice versa.
#
# affected_school_id is optional metadata for accountability only (e.g. "a
# support engineer accessed School X's account on this date") — it never
# stores what they saw or changed inside that school; that stays in the
# school's own AuditLog, which company staff do not get a bulk export of.

class CompanyActivityLog(db.Model):
    __tablename__ = 'company_activity_logs'

    id                  = db.Column(db.Integer, primary_key=True)

    actor_user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    role_snapshot        = db.Column(db.String(50), nullable=True)

    module              = db.Column(db.String(50), nullable=False, index=True)
    action              = db.Column(db.String(30), nullable=False)

    old_value           = db.Column(db.Text, nullable=True)
    new_value           = db.Column(db.Text, nullable=True)

    # Accountability-only reference — see docstring above.
    affected_school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)

    ip_address          = db.Column(db.String(45), nullable=True)
    browser             = db.Column(db.String(100), nullable=True)
    os                  = db.Column(db.String(100), nullable=True)

    request_id          = db.Column(db.String(64), nullable=True, index=True)
    remarks             = db.Column(db.String(255), nullable=True)

    created_at          = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        import json
        return {
            'id':                 self.id,
            'actor_user_id':      self.actor_user_id,
            'role_snapshot':      self.role_snapshot,
            'module':             self.module,
            'action':             self.action,
            'old_value':          json.loads(self.old_value) if self.old_value else None,
            'new_value':          json.loads(self.new_value) if self.new_value else None,
            'affected_school_id': self.affected_school_id,
            'ip_address':         self.ip_address,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  LOGIN HISTORY  (every attempt, success or failure)
# ═══════════════════════════════════════════════════════════════════════════
# user_id is nullable on purpose — a failed login with a wrong/unknown
# email still needs to be logged (brute-force detection needs the attempt,
# not just successful ones), so we keep the raw identifier they typed too.

LOGIN_FAILURE_REASONS = ['INVALID_PASSWORD', 'USER_NOT_FOUND', 'ACCOUNT_DEACTIVATED']


class LoginHistory(db.Model):
    __tablename__ = 'login_history'

    id                  = db.Column(db.Integer, primary_key=True)
    user_id             = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    identifier_attempted = db.Column(db.String(120), nullable=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)

    success             = db.Column(db.Boolean, nullable=False, index=True)
    failure_reason      = db.Column(db.String(30), nullable=True)

    ip_address          = db.Column(db.String(45), nullable=True)
    browser             = db.Column(db.String(100), nullable=True)
    os                  = db.Column(db.String(100), nullable=True)

    created_at          = db.Column(db.DateTime, default=datetime.utcnow, index=True)


# ═══════════════════════════════════════════════════════════════════════════
#  SESSION HISTORY  (active sessions + logout tracking)
# ═══════════════════════════════════════════════════════════════════════════

class SessionHistory(db.Model):
    __tablename__ = 'session_history'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    # Store the JWT's jti claim here — lets us mark a specific token's
    # session as logged-out without needing a token blocklist elsewhere.
    session_id   = db.Column(db.String(100), nullable=False, unique=True, index=True)

    ip_address   = db.Column(db.String(45), nullable=True)
    browser      = db.Column(db.String(100), nullable=True)
    os           = db.Column(db.String(100), nullable=True)

    login_at     = db.Column(db.DateTime, default=datetime.utcnow)
    logout_at    = db.Column(db.DateTime, nullable=True)
    is_active    = db.Column(db.Boolean, default=True, index=True)


# ═══════════════════════════════════════════════════════════════════════════
#  DELETED LOGS ARCHIVE  (accountability without content — section 8)
# ═══════════════════════════════════════════════════════════════════════════
# When a Principal purges logs older than N months, we hard-delete the
# matching AuditLog rows (so they're gone from the developer portal too,
# as required) and write ONE summary row here — metadata about the purge
# event itself, never the purged rows' content. This is what lets Company
# answer "did School X's Principal delete logs, and when" without Company
# ever being able to see what was in them.

class DeletedLogsArchive(db.Model):
    __tablename__ = 'deleted_logs_archive'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    deleted_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    range_start      = db.Column(db.DateTime, nullable=False)
    range_end        = db.Column(db.DateTime, nullable=False)
    record_count     = db.Column(db.Integer, nullable=False)
    reason           = db.Column(db.String(255), nullable=True)

    created_at       = db.Column(db.DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════════
#  WRITE HELPERS
# ═══════════════════════════════════════════════════════════════════════════
# Thin helpers only — the middleware/service file (next file in the
# sequence) will call these from a single place instead of every route
# doing its own db.session.add(AuditLog(...)).

def log_school_action(school_id, user=None, module='', submodule=None, action='UPDATE',
                       old_value=None, new_value=None, request_meta=None, remarks=None):
    import json
    meta = request_meta or {}
    row = AuditLog(
        school_id=school_id,
        user_id=user.id if user else None,
        role_snapshot=user.role.value if user and getattr(user, 'role', None) else None,
        department=getattr(user, 'department', None) if user else None,
        module=module, submodule=submodule, action=action,
        old_value=json.dumps(old_value) if old_value is not None else None,
        new_value=json.dumps(new_value) if new_value is not None else None,
        ip_address=meta.get('ip_address'), browser=meta.get('browser'), os=meta.get('os'),
        session_id=meta.get('session_id'), api_endpoint=meta.get('api_endpoint'),
        http_method=meta.get('http_method'), status_code=meta.get('status_code'),
        execution_time_ms=meta.get('execution_time_ms'), request_id=meta.get('request_id'),
        remarks=remarks,
    )
    db.session.add(row)
    return row


def log_company_action(actor_user, module='', action='UPDATE', old_value=None, new_value=None,
                        affected_school_id=None, request_meta=None, remarks=None):
    import json
    meta = request_meta or {}
    row = CompanyActivityLog(
        actor_user_id=actor_user.id,
        role_snapshot=actor_user.role.value if getattr(actor_user, 'role', None) else None,
        module=module, action=action,
        old_value=json.dumps(old_value) if old_value is not None else None,
        new_value=json.dumps(new_value) if new_value is not None else None,
        affected_school_id=affected_school_id,
        ip_address=meta.get('ip_address'), browser=meta.get('browser'), os=meta.get('os'),
        request_id=meta.get('request_id'), remarks=remarks,
    )
    db.session.add(row)
    return row


def purge_school_logs(school_id, older_than, deleted_by_user_id, reason=None):
    """
    Hard-deletes AuditLog rows for this school older than the given cutoff
    datetime, and writes exactly one DeletedLogsArchive summary row.
    Returns the number of rows deleted.
    """
    from sqlalchemy import func

    query = AuditLog.query.filter(
        AuditLog.school_id == school_id, AuditLog.created_at < older_than
    )
    count = query.count()
    if count == 0:
        return 0

    earliest = db.session.query(func.min(AuditLog.created_at)).filter(
        AuditLog.school_id == school_id, AuditLog.created_at < older_than
    ).scalar()

    query.delete(synchronize_session=False)

    db.session.add(DeletedLogsArchive(
        school_id=school_id, deleted_by=deleted_by_user_id,
        range_start=earliest, range_end=older_than,
        record_count=count, reason=reason,
    ))
    db.session.commit()
    return count
