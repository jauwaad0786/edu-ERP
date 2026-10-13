from app import db
from datetime import datetime
from app.utils.timezone_util import utc_now


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
    website     = db.Column(db.String(255))
    affiliation_board = db.Column(db.String(100))
    established_year  = db.Column(db.Integer)
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

    def set_features(self, feature_list):
        import json
        self.enabled_features = json.dumps(feature_list or [])

    def get_effective_modules(self):
        """Single source of truth for effective module entitlements."""
        try:
            from app.models.subscription import calculate_effective_entitlements
            return list(calculate_effective_entitlements(self.id)['effective_modules'])
        except Exception:
            return self.get_features()

    def has_feature(self, key):
        """
        Calculates effective feature entitlement using the subscription engine.
        Returns False for modules not included in plan or granted individually.
        """
        try:
            from app.models.subscription import is_school_entitled_to_module
            return is_school_entitled_to_module(self.id, key)
        except Exception:
            features = self.get_features()
            return key in features

    

    # Relationships
    classes  = db.relationship('Class',   backref='school', lazy='dynamic')
    teachers = db.relationship('Teacher', backref='school', lazy='dynamic')
    students = db.relationship('Student', backref='school', lazy='dynamic')

    def to_dict(self):
        now = utc_now()
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
            'website':                      self.website  or '',
            'affiliation_board':            self.affiliation_board or '',
            'established_year':             self.established_year,
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
            'effective_modules':            self.get_effective_modules(),
        }

