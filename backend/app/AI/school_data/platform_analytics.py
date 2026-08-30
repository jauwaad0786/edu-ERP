"""
Platform Analytics Service (For Super Admin / Developer Bot)
Enables Super Admin / Developer queries across all schools without LLM SQL hallucination.
"""
from sqlalchemy import func
from app import db
from app.models.school import School
from app.models.user import User, UserRole


def get_platform_schools_summary() -> dict:
    """Total enrolled schools, active vs inactive, and plan breakdown."""
    total_schools  = School.query.count()
    active_schools = School.query.filter_by(is_active=True).count()
    inactive_schools = total_schools - active_schools

    # Plans breakdown
    plans_q = db.session.query(
        School.plan,
        func.count(School.id)
    ).group_by(School.plan).all()

    plans = { (p[0] or 'BASIC'): p[1] for p in plans_q }

    # List of recent schools
    recent_schools = School.query.order_by(School.created_at.desc()).limit(10).all()
    schools_list = [{
        'id': s.id,
        'name': s.name,
        'code': s.code,
        'city': s.city or '',
        'plan': s.plan or 'BASIC',
        'is_active': s.is_active,
        'created_at': s.created_at.strftime('%Y-%m-%d') if s.created_at else '',
    } for s in recent_schools]

    return {
        'total_schools': total_schools,
        'active_schools': active_schools,
        'inactive_schools': inactive_schools,
        'plans_breakdown': plans,
        'recent_schools': schools_list,
    }


def get_platform_paid_schools() -> dict:
    """Schools with active paid plans and their subscription statuses."""
    schools = School.query.all()
    paid_schools = []
    free_schools = []

    for s in schools:
        info = {
            'id': s.id,
            'name': s.name,
            'code': s.code,
            'plan': s.plan or 'BASIC',
            'is_active': s.is_active,
            'city': s.city or '',
        }
        if s.plan and s.plan.upper() in ('PROFESSIONAL', 'ENTERPRISE', 'PAID', 'PRO'):
            paid_schools.append(info)
        else:
            free_schools.append(info)

    return {
        'total_schools': len(schools),
        'paid_count': len(paid_schools),
        'free_count': len(free_schools),
        'paid_schools': paid_schools,
        'free_schools': free_schools[:10],
    }


def get_platform_user_stats() -> dict:
    """Total users across the entire ERP platform grouped by role."""
    total_users  = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()

    roles_q = db.session.query(
        User.role,
        func.count(User.id)
    ).group_by(User.role).all()

    by_role = {}
    for r in roles_q:
        role_name = r[0].value if hasattr(r[0], 'value') else str(r[0])
        by_role[role_name] = r[1]

    return {
        'total_users': total_users,
        'active_users': active_users,
        'inactive_users': total_users - active_users,
        'by_role': by_role,
    }
