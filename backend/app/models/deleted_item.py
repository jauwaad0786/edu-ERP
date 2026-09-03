"""
Deleted Items Archive Model
EduERP / OnePlatform360 — Centralized Soft-Delete & 1-Year Retention System
"""

from app import db
from datetime import datetime, timedelta
import enum


class DeletedItemType(str, enum.Enum):
    STUDENT = 'STUDENT'
    TEACHER = 'TEACHER'
    STAFF   = 'STAFF'


class DeletedItemStatus(str, enum.Enum):
    ARCHIVED  = 'ARCHIVED'   # In Deleted Items trash (1-year retention)
    RECOVERED = 'RECOVERED'  # Restored to active roster
    PURGED    = 'PURGED'     # Permanently removed after 1 year or force delete


class DeletedItem(db.Model):
    __tablename__ = 'deleted_items'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    item_type        = db.Column(db.String(20), nullable=False, index=True)   # STUDENT, TEACHER, STAFF
    original_id      = db.Column(db.Integer, nullable=False, index=True)       # Student.id / Teacher.id / User.id
    original_user_id = db.Column(db.Integer, nullable=True)                  # Linked User.id

    # ── Minimal Archive Profile (Requirement #3 — Data Minimization) ──
    name             = db.Column(db.String(120), nullable=False)
    identifier       = db.Column(db.String(50), nullable=True)  # admission_no (students) or employee_id (teachers/staff)
    class_id         = db.Column(db.Integer, nullable=True)     # For student recovery verification
    class_name       = db.Column(db.String(100), nullable=True) # Snapshot: e.g. "Class 8 - A"
    section          = db.Column(db.String(20), nullable=True)
    department       = db.Column(db.String(100), nullable=True) # For teacher/staff
    designation      = db.Column(db.String(100), nullable=True) # For teacher/staff
    role             = db.Column(db.String(50), nullable=True)  # UserRole string
    session          = db.Column(db.String(50), nullable=True)  # Academic session
    student_type     = db.Column(db.String(50), nullable=True)  # Regular, Boarder, Day Scholar

    # ── Recovery Metadata (Lightweight snapshot without sensitive passwords/KYC docs) ──
    recovery_data    = db.Column(db.JSON, nullable=True)

    # ── Lifecycle Timestamps (Requirement #4 — 1 Year Retention) ──
    deleted_at       = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    deleted_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    deleted_by_name  = db.Column(db.String(120), nullable=True)
    delete_reason    = db.Column(db.String(255), nullable=True)
    auto_delete_at   = db.Column(db.DateTime, nullable=False)   # exactly deleted_at + 365 days
    status           = db.Column(db.String(20), default=DeletedItemStatus.ARCHIVED.value, nullable=False, index=True)
    purged_at        = db.Column(db.DateTime, nullable=True)

    created_at       = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at       = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    school           = db.relationship('School', foreign_keys=[school_id])
    actor_user       = db.relationship('User', foreign_keys=[deleted_by])

    def to_dict(self):
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'item_type':        self.item_type,
            'original_id':      self.original_id,
            'original_user_id': self.original_user_id,
            'name':             self.name,
            'identifier':       self.identifier or '',
            'class_id':         self.class_id,
            'class_name':       self.class_name or '',
            'section':          self.section or '',
            'department':       self.department or '',
            'designation':      self.designation or '',
            'role':             self.role or '',
            'session':          self.session or '',
            'student_type':     self.student_type or '',
            'deleted_at':       self.deleted_at.strftime('%Y-%m-%d %H:%M') if self.deleted_at else '',
            'deleted_date':     self.deleted_at.strftime('%d %b %Y') if self.deleted_at else '',
            'deleted_by':       self.deleted_by,
            'deleted_by_name':  self.deleted_by_name or (self.actor_user.name if self.actor_user else 'Principal'),
            'delete_reason':    self.delete_reason or '',
            'auto_delete_at':   self.auto_delete_at.strftime('%Y-%m-%d %H:%M') if self.auto_delete_at else '',
            'auto_delete_date': self.auto_delete_at.strftime('%d %b %Y') if self.auto_delete_at else '',
            'status':           self.status,
            'purged_at':        self.purged_at.strftime('%Y-%m-%d %H:%M') if self.purged_at else None,
            'days_remaining':   max(0, (self.auto_delete_at - datetime.utcnow()).days) if self.auto_delete_at else 0,
        }
