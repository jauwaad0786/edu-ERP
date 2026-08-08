# backend/app/utils/plan_limits.py

from app.models.school import School

# ─── Plan-wise limits ─────────────────────────────────────────────────────────
PLAN_LIMITS = {
    'BASIC': {
        'students':       200,
        'teachers':        20,
        'admin_accounts':   5,
        'classes':         20,
    },
    'PROFESSIONAL': {
        'students':       500,
        'teachers':       100,
        'admin_accounts':   10,
        'classes':        100,
    },
    'ENTERPRISE': {
        'students':     99999,
        'teachers':     99999,
        'admin_accounts':   15,
        'classes':      99999,
    },
}

# Roles jo "admin account" mein count honge
from app.models.user import UserRole
ADMIN_TYPE_ROLES = {
    UserRole.ACCOUNTANT,
    UserRole.RECEPTIONIST,
    UserRole.LIBRARIAN,
    UserRole.VICE_PRINCIPAL,
    UserRole.HOSTEL,
    UserRole.TRANSPORT,
    UserRole.HR,
    # DRIVER jaan-boojh kar yahan NAHI hai — drivers ki count bade schools
    # mein 10-15+ ho sakti hai, unhe is 1-3 wale admin slot se kaat denge
    # to Transport department kabhi drivers add hi nahi kar payega.
}

def get_limit(plan: str, resource: str) -> int:
    """Return limit for a resource in a given plan."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS['BASIC']).get(resource, 0)

def get_school_plan(school_id: int) -> str:
    """Fetch school's current plan from DB."""
    school = School.query.get(school_id)
    return (school.plan or 'BASIC') if school else 'BASIC'
