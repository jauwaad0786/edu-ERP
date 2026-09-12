from app import db
from datetime import datetime
import json

# ═══════════════════════════════════════════════════════════════════════════
#  CENTRALIZED AUDIT LOG ENUMS & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

AUDIT_ACTIONS = [
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PASSWORD_CHANGE', 'PASSWORD_RESET', 'ROLE_CHANGE', 'PERMISSION_CHANGE',
    'EXPORT', 'API_ERROR', 'VIEW', 'APPROVE', 'REJECT', 'SHUFFLE', 'PROMOTION',
    'PURGE_STARTED', 'PURGE_COMPLETED'
]

AUDIT_MODULES = [
    'AUTH', 'USER_MANAGEMENT', 'SCHOOL', 'TEACHER', 'STUDENT', 'ADMISSION',
    'ATTENDANCE', 'MARKS', 'EXAM', 'FEES', 'FINANCE', 'INVENTORY',
    'DOCUMENTS', 'COMMUNICATION', 'DELEGATION', 'SECURITY', 'SYSTEM', 'AUDIT'
]

AUDIT_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
AUDIT_STATUSES   = ['SUCCESS', 'FAILED', 'DENIED']


class AuditLog(db.Model):
    """
    Centralized, enterprise-wide Audit Log for OnePlatform360 / EduERP.
    Append-only repository of all critical domain events across every school.
    """
    __tablename__ = 'audit_logs'

    id               = db.Column(db.Integer, primary_key=True)

    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id          = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)

    # Role snapshot AT THE TIME of the action (immutable audit history)
    role_snapshot    = db.Column(db.String(50), nullable=True)
    department       = db.Column(db.String(100), nullable=True)

    module           = db.Column(db.String(50), nullable=False, index=True)   # e.g. 'STUDENT', 'FEES', 'ATTENDANCE'
    submodule        = db.Column(db.String(50), nullable=True)                # e.g. 'fee_collection'
    action           = db.Column(db.String(50), nullable=False, index=True)   # e.g. 'STUDENT_UPDATED'

    # Target Entity Details
    entity_type      = db.Column(db.String(50), nullable=True, index=True)   # e.g. 'Student', 'Attendance', 'FeeRecord'
    entity_id        = db.Column(db.Integer, nullable=True, index=True)

    # Scoped FK references for rapid timeline & entity-level audit queries
    student_id       = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True, index=True)
    teacher_id       = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True, index=True)
    class_id         = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True, index=True)
    subject_id       = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True, index=True)

    # Delegation traceability (Absent Teacher -> Substitute Teacher)
    delegation_id    = db.Column(db.Integer, db.ForeignKey('teacher_delegations.id'), nullable=True, index=True)
    is_delegated     = db.Column(db.Boolean, default=False, nullable=False, index=True)

    # JSON-serialized snapshots & field-level diffs
    old_value        = db.Column(db.Text, nullable=True)
    new_value        = db.Column(db.Text, nullable=True)
    changed_fields   = db.Column(db.Text, nullable=True) # {"field_name": {"old": ..., "new": ...}}

    # Result Status & Severity
    status           = db.Column(db.String(20), default='SUCCESS', nullable=False, index=True) # SUCCESS, FAILED, DENIED
    severity         = db.Column(db.String(20), default='INFO', nullable=False, index=True)    # INFO, LOW, MEDIUM, HIGH, CRITICAL

    # Network & Device Context
    ip_address       = db.Column(db.String(45), nullable=True)   # IPv6-safe length
    browser          = db.Column(db.String(100), nullable=True)
    os               = db.Column(db.String(100), nullable=True)
    user_agent       = db.Column(db.String(255), nullable=True)
    session_id       = db.Column(db.String(100), nullable=True, index=True)

    api_endpoint     = db.Column(db.String(200), nullable=True)
    http_method      = db.Column(db.String(10), nullable=True)
    status_code      = db.Column(db.Integer, nullable=True)
    execution_time_ms = db.Column(db.Integer, nullable=True)

    # Correlates one audit row with an ErrorLog row for the same request
    request_id       = db.Column(db.String(64), nullable=True, index=True)
    remarks          = db.Column(db.String(255), nullable=True)

    created_at       = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Relationships (lazy='select')
    actor            = db.relationship('User', foreign_keys=[user_id], lazy='select')
    student          = db.relationship('Student', foreign_keys=[student_id], lazy='select')
    teacher          = db.relationship('Teacher', foreign_keys=[teacher_id], lazy='select')
    class_ref        = db.relationship('Class', foreign_keys=[class_id], lazy='select')
    subject_ref      = db.relationship('Subject', foreign_keys=[subject_id], lazy='select')
    delegation       = db.relationship('TeacherDelegation', foreign_keys=[delegation_id], lazy='select')

    __table_args__ = (
        db.Index('ix_audit_school_created', 'school_id', 'created_at'),
        db.Index('ix_audit_school_module', 'school_id', 'module'),
        db.Index('ix_audit_school_student', 'school_id', 'student_id'),
        db.Index('ix_audit_school_teacher', 'school_id', 'teacher_id'),
        db.Index('ix_audit_school_class', 'school_id', 'class_id'),
        db.Index('ix_audit_school_severity', 'school_id', 'severity'),
        db.Index('ix_audit_school_delegated', 'school_id', 'is_delegated'),
    )

    def to_dict(self):
        old_v = None
        new_v = None
        chg_f = None
        try:
            if self.old_value:
                old_v = json.loads(self.old_value)
        except Exception:
            old_v = self.old_value
        try:
            if self.new_value:
                new_v = json.loads(self.new_value)
        except Exception:
            new_v = self.new_value
        try:
            if self.changed_fields:
                chg_f = json.loads(self.changed_fields)
        except Exception:
            chg_f = self.changed_fields

        # Delegation details helper
        del_info = None
        if self.is_delegated and self.delegation:
            try:
                src_name = self.delegation.source_teacher.user.name if (self.delegation.source_teacher and self.delegation.source_teacher.user) else 'Absent Teacher'
                del_name = self.delegation.delegate_teacher.user.name if (self.delegation.delegate_teacher and self.delegation.delegate_teacher.user) else 'Substitute'
                del_info = {
                    'delegation_id': self.delegation_id,
                    'source_teacher_name': src_name,
                    'delegate_teacher_name': del_name,
                    'reason': self.delegation.reason,
                }
            except Exception:
                del_info = {'delegation_id': self.delegation_id}

        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'user_id':           self.user_id,
            'user_name':         self.actor.name if self.actor else None,
            'employee_id':       getattr(self.actor, 'employee_id', None) if self.actor else None,
            'role_snapshot':     self.role_snapshot,
            'department':        self.department,
            'module':            self.module,
            'submodule':         self.submodule,
            'action':            self.action,
            'entity_type':       self.entity_type,
            'entity_id':         self.entity_id,
            'student_id':        self.student_id,
            'student_name':      (self.student.user.name if (self.student and self.student.user) else getattr(self.student, 'name', None)) if self.student else None,
            'teacher_id':        self.teacher_id,
            'teacher_name':      self.teacher.user.name if (self.teacher and self.teacher.user) else None,
            'class_id':          self.class_id,
            'class_name':        f"{self.class_ref.name} {self.class_ref.section}" if self.class_ref else None,
            'subject_id':        self.subject_id,
            'subject_name':      self.subject_ref.name if self.subject_ref else None,
            'delegation_id':     self.delegation_id,
            'is_delegated':      self.is_delegated,
            'delegation_info':   del_info,
            'old_value':         old_v,
            'new_value':         new_v,
            'changed_fields':    chg_f,
            'status':            self.status,
            'severity':          self.severity,
            'ip_address':        self.ip_address,
            'browser':           self.browser,
            'os':                self.os,
            'user_agent':        self.user_agent,
            'api_endpoint':      self.api_endpoint,
            'http_method':       self.http_method,
            'status_code':       self.status_code,
            'execution_time_ms': self.execution_time_ms,
            'request_id':        self.request_id,
            'remarks':           self.remarks,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class AuditRetentionSetting(db.Model):
    """
    Per-school audit retention policy configuration.
    Defines how long audit logs are retained before becoming eligible for permanent purge.
    """
    __tablename__ = 'audit_retention_settings'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), unique=True, nullable=False, index=True)
    retention_days     = db.Column(db.Integer, default=365, nullable=False) # e.g. 30, 60, 90, 180, 365, 730
    auto_purge_enabled = db.Column(db.Boolean, default=False, nullable=False)
    updated_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                 self.id,
            'school_id':          self.school_id,
            'retention_days':     self.retention_days,
            'auto_purge_enabled': self.auto_purge_enabled,
            'updated_by':         self.updated_by,
            'updated_at':         self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  COMPANY-SIDE ACTIVITY LOG
# ═══════════════════════════════════════════════════════════════════════════

class CompanyActivityLog(db.Model):
    __tablename__ = 'company_activity_logs'

    id                  = db.Column(db.Integer, primary_key=True)

    actor_user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    role_snapshot       = db.Column(db.String(50), nullable=True)

    module              = db.Column(db.String(50), nullable=False, index=True)
    action              = db.Column(db.String(50), nullable=False)

    old_value           = db.Column(db.Text, nullable=True)
    new_value           = db.Column(db.Text, nullable=True)

    affected_school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)

    ip_address          = db.Column(db.String(45), nullable=True)
    browser             = db.Column(db.String(100), nullable=True)
    os                  = db.Column(db.String(100), nullable=True)

    request_id          = db.Column(db.String(64), nullable=True, index=True)
    remarks             = db.Column(db.String(255), nullable=True)

    created_at          = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
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
#  LOGIN HISTORY & SESSIONS
# ═══════════════════════════════════════════════════════════════════════════

LOGIN_FAILURE_REASONS = ['INVALID_PASSWORD', 'USER_NOT_FOUND', 'ACCOUNT_DEACTIVATED']


class LoginHistory(db.Model):
    __tablename__ = 'login_history'

    id                   = db.Column(db.Integer, primary_key=True)
    user_id              = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    identifier_attempted = db.Column(db.String(120), nullable=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)

    success              = db.Column(db.Boolean, nullable=False, index=True)
    failure_reason       = db.Column(db.String(30), nullable=True)

    ip_address           = db.Column(db.String(45), nullable=True)
    browser              = db.Column(db.String(100), nullable=True)
    os                   = db.Column(db.String(100), nullable=True)

    created_at           = db.Column(db.DateTime, default=datetime.utcnow, index=True)


class SessionHistory(db.Model):
    __tablename__ = 'session_history'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    session_id   = db.Column(db.String(100), nullable=False, unique=True, index=True)

    ip_address   = db.Column(db.String(45), nullable=True)
    browser      = db.Column(db.String(100), nullable=True)
    os           = db.Column(db.String(100), nullable=True)

    login_at     = db.Column(db.DateTime, default=datetime.utcnow)
    logout_at    = db.Column(db.DateTime, nullable=True)
    is_active    = db.Column(db.Boolean, default=True, index=True)


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

def log_school_action(school_id, user=None, module='', submodule=None, action='UPDATE',
                       entity_type=None, entity_id=None,
                       student_id=None, teacher_id=None, class_id=None, subject_id=None,
                       delegation_id=None, is_delegated=False,
                       old_value=None, new_value=None, changed_fields=None,
                       status='SUCCESS', severity='INFO',
                       request_meta=None, remarks=None):
    meta = request_meta or {}
    row = AuditLog(
        school_id=school_id,
        user_id=user.id if user else None,
        role_snapshot=user.role.value if user and getattr(user, 'role', None) else None,
        department=getattr(user, 'department', None) if user else None,
        module=module,
        submodule=submodule,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        student_id=student_id,
        teacher_id=teacher_id,
        class_id=class_id,
        subject_id=subject_id,
        delegation_id=delegation_id,
        is_delegated=is_delegated,
        old_value=json.dumps(old_value) if (old_value is not None and not isinstance(old_value, str)) else old_value,
        new_value=json.dumps(new_value) if (new_value is not None and not isinstance(new_value, str)) else new_value,
        changed_fields=json.dumps(changed_fields) if (changed_fields is not None and not isinstance(changed_fields, str)) else changed_fields,
        status=status,
        severity=severity,
        ip_address=meta.get('ip_address'),
        browser=meta.get('browser'),
        os=meta.get('os'),
        user_agent=meta.get('user_agent'),
        session_id=meta.get('session_id'),
        api_endpoint=meta.get('api_endpoint'),
        http_method=meta.get('http_method'),
        status_code=meta.get('status_code'),
        execution_time_ms=meta.get('execution_time_ms'),
        request_id=meta.get('request_id'),
        remarks=remarks,
    )
    db.session.add(row)
    return row


def log_company_action(actor_user, module='', action='UPDATE', old_value=None, new_value=None,
                        affected_school_id=None, request_meta=None, remarks=None):
    meta = request_meta or {}
    row = CompanyActivityLog(
        actor_user_id=actor_user.id if actor_user else None,
        role_snapshot=actor_user.role.value if actor_user and getattr(actor_user, 'role', None) else 'SYSTEM',
        module=module, action=action,
        old_value=json.dumps(old_value) if (old_value is not None and not isinstance(old_value, str)) else old_value,
        new_value=json.dumps(new_value) if (new_value is not None and not isinstance(new_value, str)) else new_value,
        affected_school_id=affected_school_id,
        ip_address=meta.get('ip_address'), browser=meta.get('browser'), os=meta.get('os'),
        request_id=meta.get('request_id'), remarks=remarks,
    )
    db.session.add(row)
    return row


def purge_school_logs(school_id, older_than, deleted_by_user_id, reason=None):
    """
    Hard-deletes AuditLog rows for this school older than cutoff,
    EXCEPT critical purge security events (PURGE_STARTED, PURGE_COMPLETED),
    and records a DeletedLogsArchive summary row.
    """
    from sqlalchemy import func

    # Protected security action types that must NEVER be purged
    protected_actions = ['PURGE_STARTED', 'PURGE_COMPLETED', 'AUDIT_PURGE_STARTED', 'AUDIT_PURGE_COMPLETED']

    query = AuditLog.query.filter(
        AuditLog.school_id == school_id,
        AuditLog.created_at < older_than,
        ~AuditLog.action.in_(protected_actions)
    )
    count = query.count()
    if count == 0:
        return 0

    earliest = db.session.query(func.min(AuditLog.created_at)).filter(
        AuditLog.school_id == school_id,
        AuditLog.created_at < older_than,
        ~AuditLog.action.in_(protected_actions)
    ).scalar()

    query.delete(synchronize_session=False)

    db.session.add(DeletedLogsArchive(
        school_id=school_id, deleted_by=deleted_by_user_id,
        range_start=earliest or older_than, range_end=older_than,
        record_count=count, reason=reason,
    ))
    db.session.commit()
    return count
