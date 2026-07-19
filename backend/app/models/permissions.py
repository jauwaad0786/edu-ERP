from app import db
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════
#  PERMISSION CATALOG
# ═══════════════════════════════════════════════════════════════════════════
# Real-world pattern (same as ERPNext/Fedena role-permission matrices):
# every permission is a dotted key "module.resource.action". New modules just
# add new keys here — no schema change needed, since role_permissions/
# user_permissions store the key as a plain string column.

PERMISSION_CATALOG = [
    # ── Hostel Module ──
    {'key': 'hostel.dashboard.view',   'label': 'View Hostel Dashboard',        'module': 'hostel'},
    {'key': 'hostel.setup.manage',     'label': 'Manage Hostel/Building/Room/Bed Setup', 'module': 'hostel'},
    {'key': 'hostel.admission.manage', 'label': 'Admit / Vacate / Transfer Students',    'module': 'hostel'},
    {'key': 'hostel.beds.manage',      'label': 'Mark Bed Maintenance/Block Status',     'module': 'hostel'},
    {'key': 'hostel.reports.view',     'label': 'View Hostel Reports',           'module': 'hostel'},
    {'key': 'hostel.fees.manage',      'label': 'Collect / Manage Hostel Fees',  'module': 'hostel'},
    {'key': 'hostel.wardens.assign',   'label': 'Assign Wardens to Hostels',     'module': 'hostel'},

    # ── Library Module (future-proofing — same pattern) ──
    {'key': 'library.books.manage',    'label': 'Manage Book Catalog',           'module': 'library'},
    {'key': 'library.issue.manage',    'label': 'Issue / Return Books',          'module': 'library'},
    {'key': 'library.members.manage',  'label': 'Manage Library Members',        'module': 'library'},
    {'key': 'library.fines.manage',    'label': 'Collect / Waive Fines',         'module': 'library'},
]

PERMISSION_KEYS = {p['key'] for p in PERMISSION_CATALOG}


# ═══════════════════════════════════════════════════════════════════════════
#  ROLE PERMISSIONS  (default template per role)
# ═══════════════════════════════════════════════════════════════════════════

class RolePermission(db.Model):
    """
    Default permission template for a role, scoped per school (Principal
    of School A can customize HOSTEL role defaults without affecting School B).
    """
    __tablename__ = 'role_permissions'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    role           = db.Column(db.String(30), nullable=False, index=True)   # matches UserRole value
    permission_key = db.Column(db.String(100), nullable=False)
    is_enabled     = db.Column(db.Boolean, default=True)

    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'role', 'permission_key', name='uq_role_perm'),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  USER PERMISSIONS  (per-user override — Principal customizes individual staff)
# ═══════════════════════════════════════════════════════════════════════════

class UserPermission(db.Model):
    """
    Per-user override. If a row exists here for (user_id, permission_key),
    it WINS over the role default — this is what lets Principal give one
    specific warden extra/fewer rights than the HOSTEL role default.
    """
    __tablename__ = 'user_permissions'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    permission_key = db.Column(db.String(100), nullable=False)
    is_enabled     = db.Column(db.Boolean, default=True)

    granted_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'permission_key', name='uq_user_perm'),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  RESOLVER
# ═══════════════════════════════════════════════════════════════════════════

def resolve_permissions(user):
    """
    Returns the full set of permission keys a user effectively has.
    Resolution order: user_permissions override (if a row exists for that key)
    → else role_permissions default → else False (locked by default).

    PRINCIPAL always gets every catalog key — hardcoded bypass, not stored,
    so Principal access can never accidentally be revoked via bad data.
    """
    from app.models.user import UserRole
    if user.role in (UserRole.PRINCIPAL, UserRole.DIRECTOR, UserRole.VICE_PRINCIPAL):
        return set(PERMISSION_KEYS)

    role_defaults = {
        rp.permission_key: rp.is_enabled
        for rp in RolePermission.query.filter_by(
            school_id=user.school_id, role=user.role.value
        ).all()
    }
    user_overrides = {
        up.permission_key: up.is_enabled
        for up in UserPermission.query.filter_by(user_id=user.id).all()
    }

    effective = dict(role_defaults)
    effective.update(user_overrides)   # per-user overrides win

    return {key for key, enabled in effective.items() if enabled}


def has_permission(user, permission_key):
    from app.models.user import UserRole
    if user.role in (UserRole.PRINCIPAL, UserRole.DIRECTOR, UserRole.VICE_PRINCIPAL):
        return True
    return permission_key in resolve_permissions(user)


# ═══════════════════════════════════════════════════════════════════════════
#  SEED DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════
# Called once per school (idempotent — safe to call on every app startup).
# Sets sensible real-world defaults so nothing breaks for existing wardens:
# HOSTEL role gets full operational access by default (matches current
# hardcoded role_required('HOSTEL') behavior) — Principal can later DIAL
# DOWN specific wardens via per-user overrides, not the other way round.

DEFAULT_ROLE_PERMISSIONS = {
    'HOSTEL': [
        'hostel.dashboard.view',
        'hostel.setup.manage',
        'hostel.admission.manage',
        'hostel.beds.manage',
        'hostel.reports.view',
        'hostel.fees.manage',
        # 'hostel.wardens.assign' intentionally NOT default — Principal-only by design
    ],
    'LIBRARIAN': [
        'library.books.manage',
        'library.issue.manage',
        'library.members.manage',
        'library.fines.manage',
    ],
    'TEACHER': [
        'hostel.dashboard.view',   # read-only visibility, matches current TEACHER access on student_hostel_status
    ],
    'ACCOUNTANT': [
        'hostel.fees.manage',
        'library.fines.manage',
    ],
}


def seed_default_permissions_for_school(school_id):
    """
    Idempotent — only inserts rows that don't already exist. Safe to call
    on every app boot (app/__init__.py hook) without duplicating or
    overwriting Principal's manual customizations.
    """
    existing = {
        (rp.role, rp.permission_key)
        for rp in RolePermission.query.filter_by(school_id=school_id).all()
    }

    created = 0
    for role, keys in DEFAULT_ROLE_PERMISSIONS.items():
        for key in keys:
            if (role, key) in existing:
                continue
            db.session.add(RolePermission(
                school_id=school_id, role=role,
                permission_key=key, is_enabled=True,
            ))
            created += 1

    if created:
        db.session.commit()
    return created


def seed_default_permissions_all_schools():
    """Run for every existing school — called once at app startup."""
    from app.models.school import School
    schools = School.query.all()
    total = 0
    for s in schools:
        total += seed_default_permissions_for_school(s.id)
    return total
