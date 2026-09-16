from app import db
from datetime import datetime
from app.utils.timezone_util import utc_now


class MigrationBatch(db.Model):
    """
    Tracks data migration batches for an existing school onboarding onto Edu-ERP.
    Allows auditability, pre-go-live reconciliation, spot checking, and rollback.
    """
    __tablename__ = 'migration_batches'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    batch_no           = db.Column(db.String(50), nullable=False, unique=True, index=True)
    source_type        = db.Column(db.String(50), default='EXCEL')  # EXCEL, CSV, REGISTER, OLD_ERP, TALLY, MIXED
    session            = db.Column(db.String(20), default='2026-27', index=True)
    
    total_records      = db.Column(db.Integer, default=0)
    imported_count     = db.Column(db.Integer, default=0)
    updated_count      = db.Column(db.Integer, default=0)
    failed_count       = db.Column(db.Integer, default=0)
    
    total_opening_dues = db.Column(db.Float, default=0.0)
    total_legacy_paid  = db.Column(db.Float, default=0.0)
    
    is_pilot           = db.Column(db.Boolean, default=False)
    status             = db.Column(db.String(30), default='DRAFT', index=True)  # DRAFT, VALIDATED, PILOT_TESTED, COMMITTED, ROLLED_BACK
    
    source_filename    = db.Column(db.String(255), nullable=True)
    source_file_url    = db.Column(db.String(500), nullable=True)
    column_mapping     = db.Column(db.JSON, nullable=True)
    
    created_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    committed_at       = db.Column(db.DateTime, nullable=True)
    rolled_back_at     = db.Column(db.DateTime, nullable=True)

    records            = db.relationship('MigrationRecord', backref='batch', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':                 self.id,
            'school_id':          self.school_id,
            'batch_no':           self.batch_no,
            'source_type':        self.source_type,
            'session':            self.session,
            'total_records':      self.total_records or 0,
            'imported_count':     self.imported_count or 0,
            'updated_count':      self.updated_count or 0,
            'failed_count':       self.failed_count or 0,
            'total_opening_dues': round(float(self.total_opening_dues or 0.0), 2),
            'total_legacy_paid':  round(float(self.total_legacy_paid or 0.0), 2),
            'is_pilot':           bool(self.is_pilot),
            'status':             self.status,
            'source_filename':    self.source_filename or '',
            'created_at':         self.created_at.isoformat() if self.created_at else None,
            'committed_at':       self.committed_at.isoformat() if self.committed_at else None,
            'rolled_back_at':     self.rolled_back_at.isoformat() if self.rolled_back_at else None,
        }


class MigrationRecord(db.Model):
    """
    Individual row mapping within a migration batch.
    Links the migrated student and stores original raw legacy data for audit and spot check.
    """
    __tablename__ = 'migration_records'

    id                  = db.Column(db.Integer, primary_key=True)
    batch_id            = db.Column(db.Integer, db.ForeignKey('migration_batches.id'), nullable=False, index=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id          = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True, index=True)
    
    legacy_admission_no = db.Column(db.String(100), nullable=True, index=True)
    student_name        = db.Column(db.String(150), nullable=True)
    class_name          = db.Column(db.String(50), nullable=True)
    section             = db.Column(db.String(20), nullable=True)
    
    opening_balance     = db.Column(db.Float, default=0.0)
    legacy_paid_amount  = db.Column(db.Float, default=0.0)
    
    raw_data            = db.Column(db.JSON, nullable=True)
    status              = db.Column(db.String(20), default='SUCCESS')  # SUCCESS, UPDATED, SKIPPED, ERROR
    error_message       = db.Column(db.Text, nullable=True)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    student             = db.relationship('Student', foreign_keys=[student_id])

    def to_dict(self):
        return {
            'id':                  self.id,
            'batch_id':            self.batch_id,
            'student_id':          self.student_id,
            'legacy_admission_no': self.legacy_admission_no or '',
            'student_name':        self.student_name or '',
            'class_name':          self.class_name or '',
            'section':             self.section or '',
            'opening_balance':     round(float(self.opening_balance or 0.0), 2),
            'legacy_paid_amount':  round(float(self.legacy_paid_amount or 0.0), 2),
            'raw_data':            self.raw_data or {},
            'status':              self.status,
            'error_message':       self.error_message or '',
            'created_at':          self.created_at.isoformat() if self.created_at else None,
        }
