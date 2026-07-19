from app import db
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════
#  PLATFORM RBAC CORE
# ═══════════════════════════════════════════════════════════════════════════
# This is the shared, product-agnostic role/permission engine described in
# the platform architecture (Product -> Role/Permission -> User).
#
# IMPORTANT: this coexists with app/models/permissions.py (RolePermission /
# UserPermission / resolve_permissions()) which already powers the Hostel
# and Library modules through the legacy single-role User.role enum. We are
# NOT deleting or rewiring that yet — doing so in one shot would break every
# @role_required(...) decorator across hostel.py / finance.py in a single
# deploy. This file is the new engine growing alongside the old one; routes
# get migrated to it module by module, not all at once.
#
# Scope split:
#   COMPANY -> platform-wide roles (CEO down to Intern). product_id is NULL
#              because a CEO is not scoped to one product.
#   TENANT  -> product-scoped roles (Director down to Parent, under
#              SCHOOL_ERP today; future products register their own).

ROLE_SCOPES = ['COMPANY', 'TENANT']


class Role(db.Model):
    """
    A dynamic role. Unlike the legacy UserRole Python enum, new roles are
    added by inserting a row -- no code deploy needed.
    """
    __tablename__ = 'platform_roles'

    id              = db.Column(db.Integer, primary_key=True)

    # NULL for COMPANY-scope roles (CEO, Super Admin, ...). Set for
    # TENANT-scope roles, pointing at products.id (e.g. SCHOOL_ERP).
    product_id      = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True, index=True)

    scope           = db.Column(db.String(10), nullable=False, index=True)   # COMPANY / TENANT

    # Stable machine key, matches legacy UserRole.value where one already
    # exists (e.g. 'PRINCIPAL', 'HOSTEL') so a future migration script can
    # map old User.role -> new Role by key without guessing.
    key             = db.Column(db.String(40), nullable=False, index=True)
    name            = db.Column(db.String(100), nullable=False)

    # Lower number = more senior. Used for "can actor manage target" checks
    # (see can_manage_role below), not for permission resolution directly.
    hierarchy_level = db.Column(db.Integer, nullable=False, default=99)

    # CEO-style bypass: this role gets every permission in its accessible
    # products without needing explicit RolePermission rows. Mirrors the
    # existing hardcoded PRINCIPAL bypass in permissions.py.resolve_permissions().
    is_super        = db.Column(db.Boolean, default=False)

    # Roles seeded by the platform (see DEFAULT_COMPANY_ROLES / DEFAULT_SCHOOL_ROLES
    # below) can never be deleted via the RBAC API, regardless of who's asking.
    # "Nobody can delete CEO" needs to be an absolute rule, not just a
    # hierarchy comparison that a bug could get around.
    is_protected    = db.Column(db.Boolean, default=False)

    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_role_scope_product', 'scope', 'product_id'),
    )

    def to_dict(self):
        return {
            'id':              self.id,
            'product_id':      self.product_id,
            'scope':           self.scope,
            'key':             self.key,
            'name':            self.name,
            'hierarchy_level': self.hierarchy_level,
            'is_super':        self.is_super,
            'is_protected':    self.is_protected,
        }


class Permission(db.Model):
    """
    Permission catalog entry. Dotted key convention: 'Module.Action'
    (e.g. 'Fees.Collect', 'Student.Delete') -- matches the pattern already
    used by PERMISSION_CATALOG in permissions.py, just DB-driven instead
    of a hardcoded Python list, so new products can register their own
    catalog at install time without a code change here.
    """
    __tablename__ = 'platform_permissions'

    id          = db.Column(db.Integer, primary_key=True)

    # NULL = platform-wide permission (e.g. 'User.Manage' at company level).
    # Set = belongs to one product's catalog.
    product_id  = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True, index=True)

    key         = db.Column(db.String(100), nullable=False, index=True)
    label       = db.Column(db.String(150), nullable=False)
    module      = db.Column(db.String(50), nullable=False, index=True)

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'product_id': self.product_id,
            'key':        self.key,
            'label':      self.label,
            'module':     self.module,
        }


class RolePermission(db.Model):
    """
    Default permission template for a role.

    NOTE: this is deliberately named the same concept as, but a DIFFERENT
    table from, permissions.RolePermission (that one is Hostel/Library-only
    and keyed by the legacy string role value). To avoid an import collision
    if both are ever imported in the same file, import this one as
    `from app.models.rbac import RolePermission as PlatformRolePermission`.

    school_id NULL = global default for this role (applies to every tenant
    using it). school_id set = one school's Principal has customized the
    template for their tenant only, without affecting others.
    """
    __tablename__ = 'platform_role_permissions'

    id             = db.Column(db.Integer, primary_key=True)
    role_id        = db.Column(db.Integer, db.ForeignKey('platform_roles.id'), nullable=False, index=True)
    permission_id  = db.Column(db.Integer, db.ForeignKey('platform_permissions.id'), nullable=False, index=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    is_enabled     = db.Column(db.Boolean, default=True)

    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('role_id', 'permission_id', 'school_id', name='uq_platform_role_perm'),
    )


class UserRoleAssignment(db.Model):
    """
    Many-to-many: which roles a user currently holds. A user can hold
    several roles at once (Teacher + Hostel Warden + Exam Controller) --
    resolve_platform_permissions() below unions all of them.

    is_active marks which ONE role is the user's current "acting" role for
    dashboard/UI purposes (the role-switch dropdown). This is a display
    concern only -- it does NOT gate permissions. Permission resolution
    always uses the full merged set from every held role, so switching the
    active role can never silently grant or hide access; it only changes
    which dashboard the user lands on.
    """
    __tablename__ = 'user_role_assignments'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    role_id      = db.Column(db.Integer, db.ForeignKey('platform_roles.id'), nullable=False, index=True)

    is_active    = db.Column(db.Boolean, default=False)   # current dashboard context
    assigned_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_at  = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'role_id', name='uq_user_role'),
    )


class UserPermissionOverride(db.Model):
    """
    Per-user override on top of the merged role permissions. If a row
    exists here for (user_id, permission_id), it wins over every role
    default -- this is what lets a Principal grant or revoke one specific
    permission for one specific staff member without creating a whole new
    role just for them.
    """
    __tablename__ = 'user_permission_overrides'

    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    permission_id  = db.Column(db.Integer, db.ForeignKey('platform_permissions.id'), nullable=False, index=True)
    is_enabled     = db.Column(db.Boolean, default=True)

    granted_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'permission_id', name='uq_user_perm_override'),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  RESOLVER
# ═══════════════════════════════════════════════════════════════════════════

def get_user_roles(user, school_id=None):
    """All Role rows currently held by this user (not just the active one)."""
    assignments = UserRoleAssignment.query.filter_by(user_id=user.id).all()
    role_ids = [a.role_id for a in assignments]
    if not role_ids:
        return []
    return Role.query.filter(Role.id.in_(role_ids)).all()


def get_active_role(user):
    """The one role currently driving the user's dashboard/UI context."""
    assignment = UserRoleAssignment.query.filter_by(user_id=user.id, is_active=True).first()
    return Role.query.get(assignment.role_id) if assignment else None


def resolve_platform_permissions(user, school_id=None):
    """
    Returns the full set of permission keys this user effectively has,
    merged across every role they hold (see UserRoleAssignment docstring
    for why this is a union, not just the active role).

    Resolution order per permission: user override (if a row exists) wins
    over every role default. Among role defaults, a school-specific
    RolePermission row wins over the global (school_id=NULL) template.
    Any role with is_super=True short-circuits to full access.
    """
    roles = get_user_roles(user, school_id=school_id)
    if not roles:
        return set()

    if any(r.is_super for r in roles):
        # CEO-style bypass -- full catalog, scoped to products these roles cover.
        product_ids = {r.product_id for r in roles if r.product_id is not None}
        q = Permission.query
        if product_ids:
            q = q.filter(db.or_(Permission.product_id.in_(product_ids), Permission.product_id.is_(None)))
        return {p.key for p in q.all()}

    role_ids = [r.id for r in roles]

    # Global templates first
    global_rows = RolePermission.query.filter(
        RolePermission.role_id.in_(role_ids), RolePermission.school_id.is_(None)
    ).all()
    effective = {}
    for row in global_rows:
        perm = Permission.query.get(row.permission_id)
        if perm:
            effective[perm.key] = row.is_enabled

    # School-specific overrides of the template win
    if school_id is not None:
        scoped_rows = RolePermission.query.filter(
            RolePermission.role_id.in_(role_ids), RolePermission.school_id == school_id
        ).all()
        for row in scoped_rows:
            perm = Permission.query.get(row.permission_id)
            if perm:
                effective[perm.key] = row.is_enabled

    # Per-user overrides win over everything above
    overrides = UserPermissionOverride.query.filter_by(user_id=user.id).all()
    for row in overrides:
        perm = Permission.query.get(row.permission_id)
        if perm:
            effective[perm.key] = row.is_enabled

    return {key for key, enabled in effective.items() if enabled}


def has_platform_permission(user, permission_key, school_id=None):
    return permission_key in resolve_platform_permissions(user, school_id=school_id)


def can_manage_role(actor_roles, target_roles):
    """
    Hierarchy-based management check, e.g. "can this actor delete/edit a
    user holding these target roles?"

    Rule: actor must be strictly senior (lower hierarchy_level) than every
    target role, AND no target role can be is_protected (CEO can never be
    deleted or demoted by anyone, full stop -- not even by hierarchy math).
    """
    if any(t.is_protected for t in target_roles):
        return False
    if not actor_roles or not target_roles:
        return False
    actor_best = min(r.hierarchy_level for r in actor_roles)
    target_best = min(r.hierarchy_level for r in target_roles)
    return actor_best < target_best


# ═══════════════════════════════════════════════════════════════════════════
#  SEED DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════
# Keys for roles that already exist as UserRole enum values reuse the exact
# same string (e.g. 'PRINCIPAL', 'HOSTEL') so a later migration can match
# an existing User.role to the new Role table by key, not by guessing.

DEFAULT_COMPANY_ROLES = [
    # key, name, level, is_super, is_protected
    ('CEO',                 'CEO',                 0,  True,  True),
    ('SUPER_ADMIN',         'Super Admin',         1,  False, True),
    ('SUB_ADMIN',           'Sub Admin',           2,  False, False),
    ('MANAGER',             'Manager',             3,  False, False),
    ('TEAM_LEAD',           'Team Lead',           4,  False, False),
    ('SOFTWARE_ENGINEER',   'Software Engineer',   5,  False, False),
    ('BACKEND_DEVELOPER',   'Backend Developer',   6,  False, False),
    ('FRONTEND_DEVELOPER',  'Frontend Developer',  6,  False, False),
    ('QA',                  'QA',                  7,  False, False),
    ('CUSTOMER_SUPPORT',    'Customer Support',    8,  False, False),
    ('CALL_CENTER',         'Call Center',         8,  False, False),
    ('SALES',               'Sales',               9,  False, False),
    ('ACCOUNTS',            'Accounts',            9,  False, False),
    ('COMPANY_HR',          'HR',                  9,  False, False),
    ('MARKETING',           'Marketing',           9,  False, False),
    ('INTERN',              'Intern',              10, False, False),
]

DEFAULT_SCHOOL_ROLES = [
    # key, name, level, is_super, is_protected
    ('DIRECTOR',             'Director',             0, True,  False),
    ('PRINCIPAL',            'Principal',            0, True,  False),
    ('VICE_PRINCIPAL',       'Vice Principal',       1, False, False),
    ('ACADEMIC_COORDINATOR', 'Academic Coordinator', 2, False, False),
    ('ACCOUNTANT',           'Accountant',           3, False, False),
    ('RECEPTIONIST',         'Receptionist',         4, False, False),
    ('HOSTEL',               'Hostel Warden',        5, False, False),
    ('TRANSPORT',            'Transport Manager',    6, False, False),
    ('LIBRARIAN',            'Librarian',            7, False, False),
    ('EXAM_CONTROLLER',      'Exam Controller',      8, False, False),
    # NEW — was only 'COMPANY_HR' before; school-side legacy HR users had
    # no matching Role row and stayed "unmapped" in sync_legacy_role_assignments().
    ('HR',                   'HR',                   8, False, False),
    ('TEACHER',              'Teacher',              9, False, False),
    ('CLASS_TEACHER',        'Class Teacher',        9, False, False),
    ('ASSISTANT_TEACHER',    'Assistant Teacher',    10, False, False),
    ('STUDENT',              'Student',              11, False, False),
    ('PARENT',               'Parent',               12, False, False),
]


def seed_default_roles():
    """
    Idempotent, same pattern as seed_default_products() / the legacy
    seed_default_permissions_for_school(). Only inserts roles that don't
    already exist by (scope, product_id, key) -- checked in Python because
    Postgres treats NULL != NULL in unique constraints, so a DB-level
    unique constraint alone would not stop duplicate COMPANY-scope roles.
    """
    from app.models.platform import Product

    existing = {
        (r.scope, r.product_id, r.key) for r in Role.query.all()
    }
    created = 0

    for key, name, level, is_super, is_protected in DEFAULT_COMPANY_ROLES:
        sig = ('COMPANY', None, key)
        if sig in existing:
            continue
        db.session.add(Role(
            product_id=None, scope='COMPANY', key=key, name=name,
            hierarchy_level=level, is_super=is_super, is_protected=is_protected,
        ))
        created += 1

    school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
    if school_product:
        for key, name, level, is_super, is_protected in DEFAULT_SCHOOL_ROLES:
            sig = ('TENANT', school_product.id, key)
            if sig in existing:
                continue
            db.session.add(Role(
                product_id=school_product.id, scope='TENANT', key=key, name=name,
                hierarchy_level=level, is_super=is_super, is_protected=is_protected,
            ))
            created += 1

    if created:
        db.session.commit()
    return created


class TemporaryRoleDelegation(db.Model):
    __tablename__ = 'temporary_role_delegations'
    
    id = db.Column(db.Integer, primary_key=True)
    delegator_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    delegatee_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('platform_roles.id'), nullable=False)  # ✅ CORRECT
    
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=False)  # mandatory expiry
    reason = db.Column(db.String(500))
    status = db.Column(db.Enum('ACTIVE', 'EXPIRED', 'REVOKED', name='delegation_status'), default='ACTIVE')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    delegator = db.relationship('User', foreign_keys=[delegator_user_id])
    delegatee = db.relationship('User', foreign_keys=[delegatee_user_id])
    role = db.relationship('Role', foreign_keys=[role_id]) 
    
    __table_args__ = (
        db.Index('idx_delegation_delegatee_status', 'delegatee_user_id', 'status'),
        db.Index('idx_delegation_end_date', 'end_date'),
    )
