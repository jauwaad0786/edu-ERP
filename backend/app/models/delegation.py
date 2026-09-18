# backend/app/models/delegation.py
"""
Teacher Delegation & Temporary Access Models.

Provides scoped, time-bound delegation from an unavailable teacher to a substitute teacher.
Supports class-level, subject-level, and period-level scoping with granular permission codes.
"""

from datetime import datetime`nfrom app.utils.timezone_util import utc_now
from app import db


class TeacherDelegation(db.Model):
    """
    Master record for a teacher substitution delegation.
    Scoped to a specific school and academic session.
    """
    __tablename__ = 'teacher_delegations'

    id                   = db.Column(db.Integer, primary_key=True)
    school_id            = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    source_teacher_id    = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)
    delegate_teacher_id  = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)
    session              = db.Column(db.String(20), default='2024-25', nullable=False)

    starts_at            = db.Column(db.DateTime, nullable=False, index=True)
    expires_at           = db.Column(db.DateTime, nullable=False, index=True)

    # Status: 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED'
    status               = db.Column(db.String(20), default='SCHEDULED', nullable=False, index=True)

    reason               = db.Column(db.String(500), nullable=True)
    notes                = db.Column(db.Text, nullable=True)

    created_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at           = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at           = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    revoked_by           = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    revoked_at           = db.Column(db.DateTime, nullable=True)
    revoke_reason        = db.Column(db.String(500), nullable=True)

    # Relationships
    source_teacher       = db.relationship('Teacher', foreign_keys=[source_teacher_id], backref='delegations_out')
    delegate_teacher     = db.relationship('Teacher', foreign_keys=[delegate_teacher_id], backref='delegations_in')
    creator              = db.relationship('User', foreign_keys=[created_by])
    revoker              = db.relationship('User', foreign_keys=[revoked_by])

    scopes               = db.relationship('TeacherDelegationScope', backref='delegation', cascade='all, delete-orphan', lazy='joined')
    permissions          = db.relationship('TeacherDelegationPermission', backref='delegation', cascade='all, delete-orphan', lazy='joined')

    __table_args__ = (
        db.Index('idx_td_school_delegate_status', 'school_id', 'delegate_teacher_id', 'status'),
        db.Index('idx_td_time_window', 'starts_at', 'expires_at'),
        db.Index('idx_td_school_session', 'school_id', 'session'),
    )

    def compute_current_status(self, now=None):
        """
        Dynamically resolves the true status based on time window and revocation.
        """
        if self.revoked_at is not None or self.status == 'REVOKED':
            return 'REVOKED'
        if now is None:
            now = utc_now()
        if now < self.starts_at:
            return 'SCHEDULED'
        if self.starts_at <= now <= self.expires_at:
            return 'ACTIVE'
        return 'EXPIRED'

    @property
    def is_currently_active(self):
        return self.compute_current_status() == 'ACTIVE'

    def to_dict(self, include_details=True):
        computed_status = self.compute_current_status()
        res = {
            'id':                  self.id,
            'school_id':           self.school_id,
            'source_teacher_id':   self.source_teacher_id,
            'delegate_teacher_id': self.delegate_teacher_id,
            'source_teacher_name': self.source_teacher.user.name if (self.source_teacher and self.source_teacher.user) else 'Unknown',
            'delegate_teacher_name': self.delegate_teacher.user.name if (self.delegate_teacher and self.delegate_teacher.user) else 'Unknown',
            'source_employee_id':  self.source_teacher.employee_id if self.source_teacher else None,
            'delegate_employee_id': self.delegate_teacher.employee_id if self.delegate_teacher else None,
            'source_department':   self.source_teacher.department if self.source_teacher else None,
            'delegate_department': self.delegate_teacher.department if self.delegate_teacher else None,
            'session':             self.session,
            'starts_at':           self.starts_at.isoformat() if self.starts_at else None,
            'expires_at':          self.expires_at.isoformat() if self.expires_at else None,
            'status':              computed_status,
            'raw_status':          self.status,
            'reason':              self.reason,
            'notes':               self.notes,
            'created_by':          self.created_by,
            'creator_name':        self.creator.name if self.creator else None,
            'created_at':          self.created_at.isoformat() if self.created_at else None,
            'revoked_by':          self.revoked_by,
            'revoker_name':        self.revoker.name if self.revoker else None,
            'revoked_at':          self.revoked_at.isoformat() if self.revoked_at else None,
            'revoke_reason':       self.revoke_reason,
        }

        if include_details:
            res['scopes'] = [s.to_dict() for s in (self.scopes or [])]
            res['permissions'] = [p.permission_code for p in (self.permissions or [])]

        return res


class TeacherDelegationScope(db.Model):
    """
    Specifies which class, subject, and optional timetable period a delegation covers.
    """
    __tablename__ = 'teacher_delegation_scopes'

    id            = db.Column(db.Integer, primary_key=True)
    delegation_id = db.Column(db.Integer, db.ForeignKey('teacher_delegations.id', ondelete='CASCADE'), nullable=False, index=True)
    class_id      = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id    = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True, index=True)
    period_id     = db.Column(db.Integer, db.ForeignKey('timetable_periods.id'), nullable=True)

    class_ref     = db.relationship('Class')
    subject_ref   = db.relationship('Subject')
    period_ref    = db.relationship('TimetablePeriod')

    __table_args__ = (
        db.Index('idx_td_scope_class_subject', 'class_id', 'subject_id'),
    )

    def to_dict(self):
        return {
            'id':           self.id,
            'delegation_id': self.delegation_id,
            'class_id':     self.class_id,
            'class_name':   f"{self.class_ref.name} {self.class_ref.section}" if self.class_ref else '',
            'subject_id':   self.subject_id,
            'subject_name': self.subject_ref.name if self.subject_ref else 'All Subjects in Class',
            'period_id':    self.period_id,
            'period_label': f"Period {self.period_ref.period_no} ({self.period_ref.day})" if self.period_ref else None,
        }


class TeacherDelegationPermission(db.Model):
    """
    Granular permission codes granted under a delegation.
    """
    __tablename__ = 'teacher_delegation_permissions'

    id              = db.Column(db.Integer, primary_key=True)
    delegation_id   = db.Column(db.Integer, db.ForeignKey('teacher_delegations.id', ondelete='CASCADE'), nullable=False, index=True)
    permission_code = db.Column(db.String(50), nullable=False, index=True)

    # Defined allowed permission codes
    VALID_PERMISSIONS = {
        # Academic operations
        'ATTENDANCE_MARK',
        'ATTENDANCE_EDIT',
        'MARKS_ENTER',
        'MARKS_EDIT',
        'STUDENT_VIEW',
        'NOTES_MANAGE',
        # Timetable
        'TIMETABLE_VIEW',
        # Fees / Finance operations (strictly operational)
        'FEE_VIEW',
        'FEE_COLLECT',
        'FEE_RECEIPT',
        # Exams
        'EXAM_VIEW',
    }

    # Forbidden high-privilege codes that normal teacher delegation can NEVER grant
    FORBIDDEN_PERMISSIONS = {
        'TEACHER_MANAGE', 'TEACHER_CREATE', 'TEACHER_DELETE',
        'PRINCIPAL_MANAGE', 'CLASS_MANAGE', 'SCHOOL_SETTINGS',
        'USER_ROLE_CHANGE', 'USER_ACTIVATE', 'USER_DEACTIVATE',
        'STUDENT_DELETE', 'SESSION_ROLLOVER', 'STUDENT_PROMOTION',
        'FEE_STRUCTURE_MANAGE', 'PAYROLL_MANAGE', 'INVENTORY_MANAGE',
        'VENDOR_MANAGE', 'EXPENSE_APPROVE', 'AUDIT_DELETE',
        'DELEGATION_MANAGE', 'DELEGATION_CREATE', 'SUPER_ADMIN',
    }

    __table_args__ = (
        db.UniqueConstraint('delegation_id', 'permission_code', name='uq_delegation_perm'),
    )

    def to_dict(self):
        return {
            'id':              self.id,
            'delegation_id':   self.delegation_id,
            'permission_code': self.permission_code,
        }
