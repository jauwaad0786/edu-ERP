# backend/app/models/subscription.py
"""
OnePlatform360 Campus — Dynamic Subscription Plans, Module Catalog & Entitlements Engine.

This module provides the database-backed models and source of truth for:
  1. PlatformModule — Catalog of functional ERP modules (Transport, Hostel, Library, etc.)
  2. SubscriptionPlan — Dynamic SaaS plans (Basic, Professional, Enterprise, Custom)
  3. SchoolSubscription — Active subscription record and renewal/expiry status
  4. SchoolSubscriptionHistory — Immutable snapshot of all plan changes and billing adjustments
  5. SchoolModuleGrant — Individual module grants and revocations with audit tracking
  6. calculate_effective_entitlements — Consolidated precedence resolver for tenant access
"""

import json
from datetime import datetime
from app import db
from app.utils.timezone_util import utc_now


# ═══════════════════════════════════════════════════════════════════════════
#  1. PLATFORM MODULE CATALOG
# ═══════════════════════════════════════════════════════════════════════════

class PlatformModule(db.Model):
    """
    Catalog of all functional SaaS modules offered across OnePlatform360.
    Code is the machine key (e.g. 'transport_management', 'library_management').
    """
    __tablename__ = 'platform_modules'

    id          = db.Column(db.Integer, primary_key=True)
    code        = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name        = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    category    = db.Column(db.String(50), default='CORE', index=True)  # CORE, ACADEMIC, OPERATIONS, EXTENSION, AI
    icon        = db.Column(db.String(60), default='ti-box')
    is_core     = db.Column(db.Boolean, default=False)                  # Core cannot be removed (e.g. student/staff management)
    is_active   = db.Column(db.Boolean, default=True)                   # Whether available in plan builder
    sort_order  = db.Column(db.Integer, default=0)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'code':        self.code,
            'name':        self.name,
            'description': self.description or '',
            'category':    self.category,
            'icon':        self.icon,
            'is_core':     self.is_core,
            'is_active':   self.is_active,
            'sort_order':  self.sort_order,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  2. DYNAMIC SUBSCRIPTION PLAN CATALOG
# ═══════════════════════════════════════════════════════════════════════════

class SubscriptionPlan(db.Model):
    """
    Configurable subscription plans created and managed by the platform owner.
    Does not require code changes to add new tiers, adjust prices, or alter included modules.
    """
    __tablename__ = 'subscription_plans'

    id                 = db.Column(db.Integer, primary_key=True)
    code               = db.Column(db.String(50), unique=True, nullable=False, index=True)  # e.g. 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'
    name               = db.Column(db.String(100), nullable=False)
    description        = db.Column(db.Text, nullable=True)
    billing_period     = db.Column(db.String(20), default='MONTHLY')                        # MONTHLY, ANNUAL, QUARTERLY, CUSTOM
    price              = db.Column(db.Float, default=0.0, nullable=False)
    currency           = db.Column(db.String(10), default='INR')
    included_modules   = db.Column(db.Text, default='[]')                                   # JSON array of module codes
    usage_limits_json  = db.Column(db.Text, default='{}')                                   # e.g. {"max_students": 500, "max_admins": 2}
    is_active          = db.Column(db.Boolean, default=True, index=True)
    is_trial_supported = db.Column(db.Boolean, default=False)
    trial_days         = db.Column(db.Integer, default=14)
    sort_order         = db.Column(db.Integer, default=0)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def get_modules(self):
        try:
            return json.loads(self.included_modules or '[]')
        except Exception:
            return []

    def set_modules(self, module_list):
        self.included_modules = json.dumps(module_list or [])

    def get_limits(self):
        try:
            return json.loads(self.usage_limits_json or '{}')
        except Exception:
            return {}

    def set_limits(self, limits_dict):
        self.usage_limits_json = json.dumps(limits_dict or {})

    def to_dict(self):
        return {
            'id':                 self.id,
            'code':               self.code,
            'name':               self.name,
            'description':        self.description or '',
            'billing_period':     self.billing_period,
            'price':              self.price,
            'currency':           self.currency,
            'included_modules':   self.get_modules(),
            'usage_limits':       self.get_limits(),
            'is_active':          self.is_active,
            'is_trial_supported': self.is_trial_supported,
            'trial_days':         self.trial_days,
            'sort_order':         self.sort_order,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
            'updated_at':         self.updated_at.isoformat() if self.updated_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  3. SCHOOL SUBSCRIPTION & LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════════

class SchoolSubscription(db.Model):
    """
    Active subscription binding a school to a specific SubscriptionPlan.
    """
    __tablename__ = 'school_subscriptions'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, unique=True, index=True)
    plan_id      = db.Column(db.Integer, db.ForeignKey('subscription_plans.id'), nullable=False, index=True)
    status       = db.Column(db.String(20), default='ACTIVE', index=True)  # ACTIVE, TRIAL, EXPIRED, SUSPENDED, GRACE_PERIOD
    start_date   = db.Column(db.DateTime, default=datetime.utcnow)
    end_date     = db.Column(db.DateTime, nullable=True)                  # Nullable for perpetual / rolling subscriptions
    expiry_date  = db.Column(db.DateTime, nullable=True)                  # Alias for end_date
    billing_period = db.Column(db.String(20), default='MONTHLY')
    auto_renew   = db.Column(db.Boolean, default=True)
    amount_paid  = db.Column(db.Float, default=0.0)
    notes        = db.Column(db.String(255), nullable=True)
    assigned_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    school = db.relationship('School', foreign_keys=[school_id], backref=db.backref('subscription', uselist=False))
    plan   = db.relationship('SubscriptionPlan', foreign_keys=[plan_id])

    def to_dict(self):
        exp = self.expiry_date or self.end_date
        return {
            'id':             self.id,
            'school_id':      self.school_id,
            'school_name':    self.school.name if self.school else None,
            'plan_id':        self.plan_id,
            'plan_code':      self.plan.code if self.plan else None,
            'plan_name':      self.plan.name if self.plan else None,
            'status':         self.status,
            'start_date':     self.start_date.isoformat() if self.start_date else None,
            'end_date':       exp.isoformat() if exp else None,
            'expiry_date':    exp.isoformat() if exp else None,
            'billing_period': self.billing_period or 'MONTHLY',
            'auto_renew':     self.auto_renew,
            'amount_paid':    self.amount_paid,
            'notes':          self.notes or '',
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }


class SchoolSubscriptionHistory(db.Model):
    """
    Immutable audit history of plan upgrades, downgrades, renewals, and cancellations.
    """
    __tablename__ = 'school_subscription_history'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    from_plan_id       = db.Column(db.Integer, nullable=True)
    to_plan_id         = db.Column(db.Integer, nullable=True)
    previous_plan_code = db.Column(db.String(50), nullable=True)
    new_plan_code      = db.Column(db.String(50), nullable=True)
    action             = db.Column(db.String(30), nullable=True)  # INITIAL_ASSIGNMENT, UPGRADE, DOWNGRADE, RENEWAL, SUSPENSION
    change_type        = db.Column(db.String(30), nullable=True)
    reason             = db.Column(db.String(255), nullable=True)
    notes              = db.Column(db.String(255), nullable=True)
    changed_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    changed_by_user_id = db.Column(db.Integer, nullable=True)
    effective_date     = db.Column(db.DateTime, default=datetime.utcnow)
    snapshot_json      = db.Column(db.Text, default='{}')

    def to_dict(self):
        return {
            'id':                 self.id,
            'school_id':          self.school_id,
            'from_plan_id':       self.from_plan_id,
            'to_plan_id':         self.to_plan_id,
            'previous_plan_code': self.previous_plan_code,
            'new_plan_code':      self.new_plan_code,
            'action':             self.action or self.change_type,
            'change_type':        self.change_type or self.action,
            'reason':             self.reason or '',
            'notes':              self.notes or '',
            'changed_by':         self.changed_by or self.changed_by_user_id,
            'effective_date':     self.effective_date.isoformat() if self.effective_date else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  4. INDIVIDUAL MODULE GRANTS & REVOCATIONS
# ═══════════════════════════════════════════════════════════════════════════

class SchoolModuleGrant(db.Model):
    """
    Enables individual module addon grants (or explicit denials) without altering
    the school's base subscription plan.
    """
    __tablename__ = 'school_module_grants'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    module_code        = db.Column(db.String(50), nullable=False, index=True)
    status             = db.Column(db.String(20), default='GRANTED', index=True)  # GRANTED, REVOKED, ACTIVE
    is_active          = db.Column(db.Boolean, default=True, index=True)
    grant_type         = db.Column(db.String(30), default='MANUAL_ADDON')         # MANUAL_ADDON, TRIAL, COMPLIMENTARY, INDIVIDUAL
    start_date         = db.Column(db.DateTime, default=datetime.utcnow)
    end_date           = db.Column(db.DateTime, nullable=True)                   # Nullable for permanent addon
    expires_at         = db.Column(db.DateTime, nullable=True)                   # Alias for end_date
    granted_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    granted_by_user_id = db.Column(db.Integer, nullable=True)
    revoked_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    revoked_by_user_id = db.Column(db.Integer, nullable=True)
    revoked_at         = db.Column(db.DateTime, nullable=True)
    reason             = db.Column(db.String(255), nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'module_code', name='uq_school_module_grant'),
    )

    def to_dict(self):
        exp = self.expires_at or self.end_date
        return {
            'id':          self.id,
            'school_id':   self.school_id,
            'module_code': self.module_code,
            'status':      self.status,
            'is_active':   self.is_active,
            'grant_type':  self.grant_type,
            'start_date':  self.start_date.isoformat() if self.start_date else None,
            'end_date':    exp.isoformat() if exp else None,
            'expires_at':  exp.isoformat() if exp else None,
            'is_expired':  bool(exp and exp < utc_now()),
            'reason':      self.reason or '',
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  5. CONSOLIDATED ENTITLEMENT RESOLVER (SINGLE SOURCE OF TRUTH)
# ═══════════════════════════════════════════════════════════════════════════

def calculate_effective_entitlements(school_id):
    """
    Computes the effective enabled module set for a given school according
    to the strict precedence rules:
      1. Active subscription plan provides its configured included modules.
      2. Valid individual module grants (status='GRANTED', not expired) are added.
      3. Explicit individual revocations (status='REVOKED') take precedence and deny access.
      4. If subscription is SUSPENDED or EXPIRED, access is restricted according to policy.
      5. Core modules required for basic platform operation remain accessible.

    Returns:
      dict: {
        'plan_code': str,
        'plan_name': str,
        'subscription_status': str,
        'included_in_plan': set,
        'individually_granted': set,
        'explicitly_revoked': set,
        'effective_modules': set,
      }
    """
    from app.models.school import School
    school = School.query.get(school_id)
    if not school:
        return {
            'plan_code': 'NONE',
            'plan_name': 'None',
            'subscription_status': 'INACTIVE',
            'included_in_plan': set(),
            'individually_granted': set(),
            'explicitly_revoked': set(),
            'effective_modules': set(),
        }

    # Fetch active subscription or fallback to school.plan
    sub = SchoolSubscription.query.filter_by(school_id=school_id).first()
    plan_code = sub.plan.code if (sub and sub.plan) else (school.plan or 'BASIC').upper()
    plan = sub.plan if (sub and sub.plan) else SubscriptionPlan.query.filter_by(code=plan_code).first()

    now = utc_now()
    sub_status = sub.status if sub else ('ACTIVE' if school.is_active else 'INACTIVE')
    if sub and sub.end_date and sub.end_date < now and sub_status == 'ACTIVE':
        sub_status = 'EXPIRED'

    included_in_plan = set(plan.get_modules()) if plan else set()

    # If no plan row exists in DB yet, pull from school's legacy enabled_features
    if not included_in_plan:
        legacy_features = school.get_features()
        if legacy_features:
            included_in_plan = set(legacy_features)

    # Core modules that cannot be locked out
    core_modules = {m.code for m in PlatformModule.query.filter_by(is_core=True).all()}
    if not core_modules:
        core_modules = {'student_management', 'teacher_management', 'attendance_management'}

    # If subscription is SUSPENDED or EXPIRED, only basic core operations remain accessible
    if sub_status in ('SUSPENDED', 'EXPIRED'):
        return {
            'plan_code': plan_code,
            'plan_name': plan.name if plan else plan_code,
            'subscription_status': sub_status,
            'included_in_plan': included_in_plan,
            'individually_granted': set(),
            'explicitly_revoked': set(),
            'effective_modules': core_modules,
        }

    # Load individual grants for this school
    grants = SchoolModuleGrant.query.filter_by(school_id=school_id).all()
    individually_granted = set()
    explicitly_revoked   = set()

    for g in grants:
        eff_end = getattr(g, 'expires_at', None) or g.end_date
        is_active_flag = getattr(g, 'is_active', True)
        if (g.status in ('GRANTED', 'ACTIVE')) and is_active_flag:
            # Check expiry if end_date set
            if not eff_end or eff_end >= now:
                individually_granted.add(g.module_code)
        elif g.status == 'REVOKED' or not is_active_flag:
            explicitly_revoked.add(g.module_code)

    # Merge: (Plan + Grants + Core) - Revocations
    effective = (included_in_plan | individually_granted | core_modules) - explicitly_revoked

    return {
        'plan_code': plan_code,
        'current_plan_code': plan_code,
        'plan_name': plan.name if plan else plan_code,
        'subscription_status': sub_status,
        'included_in_plan': included_in_plan,
        'included_modules': included_in_plan,
        'individually_granted': individually_granted,
        'explicitly_revoked': explicitly_revoked,
        'effective_modules': effective,
    }


def is_school_entitled_to_module(school_id, module_code):
    """Convenience boolean check for a specific school and module code."""
    res = calculate_effective_entitlements(school_id)
    return module_code in res['effective_modules']


# ═══════════════════════════════════════════════════════════════════════════
#  6. SEED DEFAULT PLATFORM MODULES & DEFAULT PLANS
# ═══════════════════════════════════════════════════════════════════════════

DEFAULT_MODULES = [
    {
        'code': 'student_management',
        'name': 'Student Lifecycle & Admissions',
        'description': 'Student directory, admissions, identity cards, promotions',
        'category': 'CORE',
        'icon': 'ti-address-book',
        'is_core': True,
        'sort_order': 1,
    },
    {
        'code': 'teacher_management',
        'name': 'Teacher & Academic Staff',
        'description': 'Teacher profiles, designations, department allocation',
        'category': 'CORE',
        'icon': 'ti-chalkboard',
        'is_core': True,
        'sort_order': 2,
    },
    {
        'code': 'attendance_management',
        'name': 'Attendance Tracking',
        'description': 'Daily student roll-call, leave applications, analytics',
        'category': 'CORE',
        'icon': 'ti-clipboard-check',
        'is_core': True,
        'sort_order': 3,
    },
    {
        'code': 'academics',
        'name': 'Academics & Timetable',
        'description': 'Classes, sections, subjects, timetable scheduling, curriculum',
        'category': 'ACADEMIC',
        'icon': 'ti-books',
        'is_core': False,
        'sort_order': 4,
    },
    {
        'code': 'fee_management',
        'name': 'Fees & Financial Accounts',
        'description': 'Fee structures, receipts, dues, expense tracking, invoices',
        'category': 'OPERATIONS',
        'icon': 'ti-currency-rupee',
        'is_core': False,
        'sort_order': 5,
    },
    {
        'code': 'exam_management',
        'name': 'Examinations & Marks',
        'description': 'Exam schedules, mark entry, report cards, admit cards',
        'category': 'ACADEMIC',
        'icon': 'ti-pencil',
        'is_core': False,
        'sort_order': 6,
    },
    {
        'code': 'hrms_module',
        'name': 'HRMS & Staff Management',
        'description': 'Employee directory, GPS staff attendance, payroll processing, leaves',
        'category': 'OPERATIONS',
        'icon': 'ti-briefcase',
        'is_core': False,
        'sort_order': 7,
    },
    {
        'code': 'transport_management',
        'name': 'Transport & Fleet Management',
        'description': 'Bus fleet, driver roster, routes, stops, live tracking, transport fees',
        'category': 'EXTENSION',
        'icon': 'ti-bus',
        'is_core': False,
        'sort_order': 8,
    },
    {
        'code': 'hostel_management',
        'name': 'Hostel & Residential Management',
        'description': 'Hostel blocks, room/bed mapping, admissions, night roll call, gate passes',
        'category': 'EXTENSION',
        'icon': 'ti-bed',
        'is_core': False,
        'sort_order': 9,
    },
    {
        'code': 'library_management',
        'name': 'Library & Catalog System',
        'description': 'Book inventory, barcodes, circulation, reservations, overdue fines',
        'category': 'EXTENSION',
        'icon': 'ti-books',
        'is_core': False,
        'sort_order': 10,
    },
    {
        'code': 'communication_module',
        'name': 'Communication & Circulars',
        'description': 'Platform notifications, school announcements, SMS/WhatsApp alerts',
        'category': 'OPERATIONS',
        'icon': 'ti-speakerphone',
        'is_core': False,
        'sort_order': 11,
    },
    {
        'code': 'ai_copilot',
        'name': '1P360 AI Campus Copilot',
        'description': 'AI analytics assistant, policy Q&A, automated report insights',
        'category': 'AI',
        'icon': 'ti-robot',
        'is_core': False,
        'sort_order': 12,
    },
]

DEFAULT_PLANS = [
    {
        'code': 'BASIC',
        'name': 'Basic Plan',
        'description': 'Ideal for smaller schools managing core students, attendance, fees, and marks.',
        'billing_period': 'MONTHLY',
        'price': 1799.0,
        'currency': 'INR',
        'included_modules': [
            'student_management',
            'teacher_management',
            'attendance_management',
            'academics',
            'fee_management',
            'exam_management',
        ],
        'usage_limits': {'max_students': 300, 'max_staff': 30},
        'is_active': True,
        'is_trial_supported': True,
        'trial_days': 14,
        'sort_order': 1,
    },
    {
        'code': 'PROFESSIONAL',
        'name': 'Professional Plan',
        'description': 'Complete school management suite with HRMS, Library, and automated communications.',
        'billing_period': 'MONTHLY',
        'price': 2999.0,
        'currency': 'INR',
        'included_modules': [
            'student_management',
            'teacher_management',
            'attendance_management',
            'academics',
            'fee_management',
            'exam_management',
            'hrms_module',
            'library_management',
            'communication_module',
        ],
        'usage_limits': {'max_students': 1000, 'max_staff': 100},
        'is_active': True,
        'is_trial_supported': True,
        'trial_days': 14,
        'sort_order': 2,
    },
    {
        'code': 'ENTERPRISE',
        'name': 'Enterprise Plan',
        'description': 'Full-featured enterprise suite including Transport GPS, Hostel Management, and AI Copilot.',
        'billing_period': 'MONTHLY',
        'price': 5999.0,
        'currency': 'INR',
        'included_modules': [
            'student_management',
            'teacher_management',
            'attendance_management',
            'academics',
            'fee_management',
            'exam_management',
            'hrms_module',
            'library_management',
            'communication_module',
            'transport_management',
            'hostel_management',
            'ai_copilot',
        ],
        'usage_limits': {'max_students': 5000, 'max_staff': 500},
        'is_active': True,
        'is_trial_supported': True,
        'trial_days': 30,
        'sort_order': 3,
    },
]


def seed_default_subscription_data():
    """
    Idempotent database seeder for default module catalog and subscription plans.
    """
    created_modules = 0
    existing_mod_codes = {m.code for m in PlatformModule.query.all()}
    for mod_data in DEFAULT_MODULES:
        if mod_data['code'] not in existing_mod_codes:
            m = PlatformModule(**mod_data)
            db.session.add(m)
            created_modules += 1

    created_plans = 0
    existing_plan_codes = {p.code for p in SubscriptionPlan.query.all()}
    for plan_data in DEFAULT_PLANS:
        if plan_data['code'] not in existing_plan_codes:
            p = SubscriptionPlan(
                code=plan_data['code'],
                name=plan_data['name'],
                description=plan_data['description'],
                billing_period=plan_data['billing_period'],
                price=plan_data['price'],
                currency=plan_data['currency'],
                included_modules=json.dumps(plan_data['included_modules']),
                usage_limits_json=json.dumps(plan_data['usage_limits']),
                is_active=plan_data['is_active'],
                is_trial_supported=plan_data['is_trial_supported'],
                trial_days=plan_data['trial_days'],
                sort_order=plan_data['sort_order'],
            )
            db.session.add(p)
            created_plans += 1

    if created_modules or created_plans:
        db.session.commit()

    return {'created_modules': created_modules, 'created_plans': created_plans}
