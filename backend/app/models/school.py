from app import db
from datetime import datetime


class School(db.Model):
    __tablename__ = 'schools'
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(200), nullable=False)
    code        = db.Column(db.String(20), unique=True, nullable=False)
    address     = db.Column(db.String(500))
    city        = db.Column(db.String(100))
    state       = db.Column(db.String(100))
    pincode     = db.Column(db.String(10))
    phone       = db.Column(db.String(20))
    email       = db.Column(db.String(120))
    logo_url               = db.Column(db.String(500))   # School logo
    principal_signature_url= db.Column(db.String(500))   # Principal signature image
    director_signature_url = db.Column(db.String(500))   # Director/Chairman signature image
    is_active   = db.Column(db.Boolean, default=True)
    status      = db.Column(db.String(30), default='ACTIVE', index=True)   # ACTIVE / ARCHIVED / PERMANENT_DELETE_ELIGIBLE
    archived_at = db.Column(db.DateTime, nullable=True)
    archived_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    archive_reason = db.Column(db.String(255), nullable=True)
    permanent_delete_eligible_at = db.Column(db.DateTime, nullable=True)
    type        = db.Column(db.String(30), default='SCHOOL')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    current_session = db.Column(db.String(20), default='2024-25')
    plan             = db.Column(db.String(20), default='BASIC')   # BASIC / PROFESSIONAL / ENTERPRISE
    enabled_features = db.Column(db.Text, default='[]')            # JSON list of feature keys

    def get_features(self):
        import json
        try:
            return json.loads(self.enabled_features or '[]')
        except Exception:
            return []

    DEFAULT_CORE_FEATURES = {
        'teacher_management', 'student_management', 'attendance_management',
        'fee_management', 'exam_management', 'timetable_management',
        'library_management', 'hostel_management', 'transport_management',
        'communication_module', 'hrms_module', 'reports_module'
    }

    def has_feature(self, key):
        features = self.get_features()
        if not features:
            return True
        return key in features or key in self.DEFAULT_CORE_FEATURES

    

    # Relationships
    classes  = db.relationship('Class',   backref='school', lazy='dynamic')
    teachers = db.relationship('Teacher', backref='school', lazy='dynamic')
    students = db.relationship('Student', backref='school', lazy='dynamic')

    def to_dict(self):
        now = datetime.utcnow()
        effective_status = self.status or ('ACTIVE' if self.is_active else 'INACTIVE')
        days_remaining = None
        is_eligible = False

        if effective_status == 'ARCHIVED':
            if self.permanent_delete_eligible_at:
                days_diff = (self.permanent_delete_eligible_at - now).days
                days_remaining = max(0, days_diff)
                is_eligible = now >= self.permanent_delete_eligible_at
            else:
                days_remaining = 365
                is_eligible = False
            if is_eligible:
                effective_status = 'PERMANENT_DELETE_ELIGIBLE'

        return {
            'id':                           self.id,
            'name':                         self.name,
            'code':                         self.code,
            'address':                      self.address  or '',
            'city':                         self.city     or '',
            'state':                        self.state    or '',
            'pincode':                      self.pincode  or '',
            'phone':                        self.phone    or '',
            'email':                        self.email    or '',
            'type':                         self.type,
            'is_active':                    self.is_active,
            'status':                       effective_status,
            'effective_status':             effective_status,
            'archived_at':                  self.archived_at.isoformat() if self.archived_at else None,
            'archived_by':                  self.archived_by,
            'archive_reason':               self.archive_reason or '',
            'permanent_delete_eligible_at': self.permanent_delete_eligible_at.isoformat() if self.permanent_delete_eligible_at else None,
            'days_remaining_to_permanent_delete': days_remaining,
            'is_permanent_delete_eligible': is_eligible,
            'current_session':              self.current_session,
            'logo_url':                     self.logo_url                or None,
            'principal_signature_url':      self.principal_signature_url or None,
            'director_signature_url':       self.director_signature_url  or None,
            'plan':                         self.plan or 'BASIC',
            'enabled_features':             self.get_features(),
        }
