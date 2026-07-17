# backend/app/models/permission_catalog.py
"""
File 7 — actual Permission rows + default RolePermission templates for the
new rbac.py engine. Without this, `permission_required(...)` denies every
request (fail-closed, see permission_resolver.py docstring) because
Permission/RolePermission tables are empty.

Scope boundary (important): Hostel and Library already have working
permission granularity via the LEGACY engine (permissions.py). This file
deliberately does NOT re-declare hostel.*/library.* keys here — two
systems both claiming authority over the same module would be confusing
and eventually contradictory. This catalog only covers modules that
currently have ZERO permission granularity (just a hardcoded
@role_required(...) at the route).

Object-level scoping caveat: permission_required() answers "can this user
do X at all", not "can this user do X to THIS record". STUDENT/PARENT
routes need their own school_id/student_id filtering regardless of what's
granted here -- that's why STUDENT/PARENT get no rows in this file. Their
self-service routes (routes/student.py) should keep doing explicit
ownership checks, not rely on this catalog.
"""

from app import db

# ═══════════════════════════════════════════════════════════════════════════
#  PERMISSION CATALOG
# ═══════════════════════════════════════════════════════════════════════════
# Same lowercase dotted convention as the legacy catalog
# (permissions.py -> 'hostel.dashboard.view') for consistency across the
# codebase, even though this lives in a different table.

PERMISSION_CATALOG = [
    # ── Fees ──
    {'key': 'fees.structure.manage', 'label': 'Create/Edit Fee Structures',        'module': 'fees'},
    {'key': 'fees.collect',          'label': 'Collect Fee Payments',              'module': 'fees'},
    {'key': 'fees.discount.apply',   'label': 'Apply Fee Discounts/Waivers',       'module': 'fees'},
    {'key': 'fees.receipt.view',     'label': 'View/Reprint Fee Receipts',         'module': 'fees'},
    {'key': 'fees.reports.view',     'label': 'View Fee Collection Reports',       'module': 'fees'},

    # ── Exams ──
    {'key': 'exams.schedule.manage',  'label': 'Create/Edit Exam Schedules',        'module': 'exams'},
    {'key': 'exams.timetable.manage', 'label': 'Manage Exam Timetable',             'module': 'exams'},
    {'key': 'exams.results.publish',  'label': 'Publish/Archive Exam Results',      'module': 'exams'},
    {'key': 'exams.admitcard.generate', 'label': 'Generate Admit Cards',            'module': 'exams'},

    # ── Marks ──
    {'key': 'marks.entry',            'label': 'Enter/Edit Student Marks',          'module': 'marks'},
    {'key': 'marks.bulk_save',        'label': 'Bulk-Save Marks for a Class',       'module': 'marks'},
    {'key': 'marks.analytics.view',   'label': 'View Topper/Class Analytics',       'module': 'marks'},

    # ── Students ──
    {'key': 'students.admission.manage', 'label': 'Admit New Students',             'module': 'students'},
    {'key': 'students.profile.view',     'label': 'View Student Profiles',          'module': 'students'},
    {'key': 'students.profile.edit',     'label': 'Edit Student Profiles',          'module': 'students'},
    {'key': 'students.delete',           'label': 'Delete/Deactivate Students',     'module': 'students'},

    # ── Staff ──
    {'key': 'staff.profile.manage',   'label': 'Manage Staff Profiles',             'module': 'staff'},
    {'key': 'staff.payroll.view',     'label': 'View Payroll',                      'module': 'staff'},
    {'key': 'staff.payroll.manage',   'label': 'Process/Edit Payroll',              'module': 'staff'},

    # ── Finance ──
    {'key': 'finance.expense.manage',  'label': 'Record/Edit Expenses',             'module': 'finance'},
    {'key': 'finance.inventory.manage','label': 'Manage Inventory & Restocking',    'module': 'finance'},
    {'key': 'finance.pnl.view',        'label': 'View Profit & Loss',               'module': 'finance'},

    # ── Documents ──
    {'key': 'documents.issue', 'label': 'Issue Bonafide/TC/Character Certificates', 'module': 'documents'},
    {'key': 'documents.view',  'label': 'View Issued Documents',                    'module': 'documents'},

    # ── Communication ──
    {'key': 'communication.announcement.post', 'label': 'Post Announcements',       'module': 'communication'},
    {'key': 'communication.ticket.manage',     'label': 'Manage Support Tickets',   'module': 'communication'},

    # ── Admin (school-level settings, not company-level) ──
    {'key': 'admin.school.settings',    'label': 'Edit School Settings',            'module': 'admin'},
    {'key': 'admin.user.manage',        'label': 'Create/Edit/Deactivate Staff Users', 'module': 'admin'},
    {'key': 'admin.whatsapp.settings',  'label': 'Manage WhatsApp Integration',     'module': 'admin'},
]

PERMISSION_KEYS = {p['key'] for p in PERMISSION_CATALOG}


# ═══════════════════════════════════════════════════════════════════════════
#  DEFAULT ROLE → PERMISSION TEMPLATE  (school-side roles only, for now)
# ═══════════════════════════════════════════════════════════════════════════
# DIRECTOR/PRINCIPAL are is_super=True in rbac.py -> they bypass this
# entirely (see resolve_platform_permissions), so they're not listed here
# on purpose -- same reasoning as the legacy PRINCIPAL hardcoded bypass.
#
# STUDENT/PARENT intentionally absent -- see module docstring (object-level
# scoping caveat). HOSTEL/TRANSPORT/LIBRARIAN intentionally absent here --
# they stay on the legacy engine until those modules migrate too.

DEFAULT_SCHOOL_ROLE_PERMISSIONS = {
    'VICE_PRINCIPAL': [
        'fees.structure.manage', 'fees.collect', 'fees.discount.apply', 'fees.receipt.view', 'fees.reports.view',
        'exams.schedule.manage', 'exams.timetable.manage', 'exams.results.publish', 'exams.admitcard.generate',
        'marks.entry', 'marks.bulk_save', 'marks.analytics.view',
        'students.admission.manage', 'students.profile.view', 'students.profile.edit',
        'staff.profile.manage', 'staff.payroll.view',
        'finance.expense.manage', 'finance.inventory.manage', 'finance.pnl.view',
        'documents.issue', 'documents.view',
        'communication.announcement.post', 'communication.ticket.manage',
        'admin.school.settings', 'admin.user.manage', 'admin.whatsapp.settings',
        # 'students.delete' and 'staff.payroll.manage' intentionally NOT default —
        # destructive/financial-sign-off actions stay Principal/Director-only by design.
    ],
    'ACADEMIC_COORDINATOR': [
        'exams.schedule.manage', 'exams.timetable.manage', 'exams.results.publish', 'exams.admitcard.generate',
        'marks.entry', 'marks.bulk_save', 'marks.analytics.view',
        'students.profile.view',
    ],
    'ACCOUNTANT': [
        'fees.structure.manage', 'fees.collect', 'fees.discount.apply', 'fees.receipt.view', 'fees.reports.view',
        'finance.expense.manage', 'finance.inventory.manage', 'finance.pnl.view',
        'staff.payroll.view', 'staff.payroll.manage',
    ],
    'RECEPTIONIST': [
        'students.admission.manage', 'students.profile.view',
        'documents.issue', 'documents.view',
    ],
    'EXAM_CONTROLLER': [
        'exams.schedule.manage', 'exams.timetable.manage', 'exams.results.publish', 'exams.admitcard.generate',
        'marks.entry', 'marks.analytics.view',
    ],
    'TEACHER': [
        'marks.entry', 'students.profile.view',
        # fees.collect deliberately NOT default — only PRINCIPAL (is_super
        # bypass) and ACCOUNTANT get it by default. A Principal can grant
        # fees.collect to one specific teacher via UserPermissionOverride
        # (see routes/rbac.py) without opening it up for every teacher.
    ],
    'CLASS_TEACHER': [
        'marks.entry', 'students.profile.view', 'students.profile.edit', 'documents.view',
    ],
    'ASSISTANT_TEACHER': [
        'marks.entry',
    ],
}


# ═══════════════════════════════════════════════════════════════════════════
#  SEED FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def seed_permission_catalog():
    """Idempotent. Inserts Permission rows scoped to the SCHOOL_ERP product."""
    from app.models.rbac import Permission
    from app.models.platform import Product

    school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
    if not school_product:
        return 0   # platform.py hasn't seeded yet -- retried next boot

    existing_keys = {
        p.key for p in Permission.query.filter_by(product_id=school_product.id).all()
    }

    created = 0
    for item in PERMISSION_CATALOG:
        if item['key'] in existing_keys:
            continue
        db.session.add(Permission(
            product_id=school_product.id,
            key=item['key'], label=item['label'], module=item['module'],
        ))
        created += 1

    if created:
        db.session.commit()
    return created


def seed_role_permission_templates():
    """
    Idempotent. Links each role in DEFAULT_SCHOOL_ROLE_PERMISSIONS to its
    Permission rows via a global (school_id=None) RolePermission template
    row. Returns a summary so unmapped roles/permissions are visible
    instead of silently skipped.
    """
    from app.models.rbac import Role, Permission, RolePermission
    from app.models.platform import Product

    school_product = Product.query.filter_by(key='SCHOOL_ERP').first()
    if not school_product:
        return {'created': 0, 'unmapped_roles': [], 'unmapped_permissions': []}

    roles_by_key = {
        r.key: r for r in Role.query.filter_by(scope='TENANT', product_id=school_product.id).all()
    }
    perms_by_key = {
        p.key: p for p in Permission.query.filter_by(product_id=school_product.id).all()
    }

    existing = {
        (rp.role_id, rp.permission_id) for rp in RolePermission.query.filter_by(school_id=None).all()
    }

    created = 0
    unmapped_roles, unmapped_permissions = [], []

    for role_key, permission_keys in DEFAULT_SCHOOL_ROLE_PERMISSIONS.items():
        role = roles_by_key.get(role_key)
        if not role:
            unmapped_roles.append(role_key)
            continue

        for perm_key in permission_keys:
            perm = perms_by_key.get(perm_key)
            if not perm:
                unmapped_permissions.append(perm_key)
                continue

            if (role.id, perm.id) in existing:
                continue

            db.session.add(RolePermission(
                role_id=role.id, permission_id=perm.id, school_id=None, is_enabled=True,
            ))
            created += 1

    if created:
        db.session.commit()

    return {
        'created': created,
        'unmapped_roles': unmapped_roles,
        'unmapped_permissions': list(set(unmapped_permissions)),
    }
