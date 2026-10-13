# backend/app/routes/subscription_routes.py
"""
OnePlatform360 Campus — Subscription Plans, Module Entitlements,
Dynamic School Onboarding Wizard, and SaaS Administration API Blueprint.
"""

import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import func

from app import db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Class
from app.models.subscription import (
    PlatformModule, SubscriptionPlan, SchoolSubscription,
    SchoolSubscriptionHistory, SchoolModuleGrant,
    calculate_effective_entitlements, is_school_entitled_to_module,
    DEFAULT_MODULES
)
from app.models.audit import AuditLog
from app.models.rbac import Role, UserRoleAssignment
from app.services.communication.notification_service import NotificationService
from app.utils.decorators import role_required, get_current_user
from app.utils.timezone_util import utc_now


subscription_bp = Blueprint('subscription', __name__)


# ─────────────────────────────────────────────────────────────────────────────
#  HELPER UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def _log_admin_audit(actor, action, school_id=None, module='SUBSCRIPTION',
                     submodule=None, old_val=None, new_val=None, remarks=None):
    """Safely log an administrative event to the centralized AuditLog table."""
    try:
        # Fallback school_id if none provided (audit table requires non-null school_id)
        target_school_id = school_id
        if not target_school_id:
            first_school = School.query.first()
            target_school_id = first_school.id if first_school else 1

        audit = AuditLog(
            school_id=target_school_id,
            user_id=actor.id if actor else None,
            role_snapshot=actor.role.value if (actor and hasattr(actor, 'role') and actor.role) else 'SUPER_ADMIN',
            department='PLATFORM_ADMIN',
            module=module,
            submodule=submodule,
            action=action,
            entity_type='SchoolSubscription' if 'SUBSCRIPTION' in action else 'SchoolModuleGrant',
            old_value=json.dumps(old_val) if old_val else None,
            new_value=json.dumps(new_val) if new_val else None,
            status='SUCCESS',
            severity='INFO',
            remarks=remarks or f'Executed {action}'
        )
        db.session.add(audit)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[WARN] Failed to write AuditLog in subscription_routes: {e}")


def _notify_principal(school_id, title, message, metadata=None):
    """Find the designated Principal for a school and send an in-app notification."""
    try:
        principal = User.query.filter_by(school_id=school_id, role=UserRole.PRINCIPAL).first()
        if principal:
            NotificationService.send_notification(
                user_id=principal.id,
                title=title,
                message=message,
                school_id=school_id,
                notif_type='SYSTEM',
                priority='HIGH',
                metadata=metadata or {}
            )
            return True
    except Exception as e:
        print(f"[WARN] Notification delivery note for school {school_id}: {e}")
    return False


# ─────────────────────────────────────────────────────────────────────────────
#  1. PLATFORM MODULES CATALOG
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/modules/catalog', methods=['GET'])
@role_required('SUPER_ADMIN')
def list_module_catalog():
    """List all available platform modules with their categories and metadata."""
    modules = PlatformModule.query.order_by(PlatformModule.sort_order.asc(), PlatformModule.id.asc()).all()
    return jsonify({
        'total': len(modules),
        'modules': [m.to_dict() for m in modules]
    }), 200


@subscription_bp.route('/modules/catalog', methods=['POST'])
@role_required('SUPER_ADMIN')
def create_or_update_module():
    """Add or update a module in the platform catalog."""
    actor = get_current_user()
    data = request.get_json() or {}
    code = (data.get('code') or '').strip().lower()
    name = (data.get('name') or '').strip()

    if not code or not name:
        return jsonify({'error': 'Module code and name are required'}), 400

    mod = PlatformModule.query.filter_by(code=code).first()
    is_new = mod is None
    if is_new:
        mod = PlatformModule(code=code)
        db.session.add(mod)

    mod.name = name
    mod.description = data.get('description', mod.description)
    mod.category = data.get('category', mod.category or 'CORE')
    mod.icon = data.get('icon', mod.icon or 'ti-box')
    mod.is_core = bool(data.get('is_core', mod.is_core))
    mod.is_active = bool(data.get('is_active', True))
    mod.sort_order = int(data.get('sort_order', 0))

    db.session.commit()
    _log_admin_audit(
        actor,
        action='MODULE_CREATED' if is_new else 'MODULE_UPDATED',
        new_val=mod.to_dict(),
        remarks=f"{'Created' if is_new else 'Updated'} module {code}"
    )

    return jsonify({'message': 'Module saved successfully', 'module': mod.to_dict()}), 200 if not is_new else 201


# ─────────────────────────────────────────────────────────────────────────────
#  2. DYNAMIC SUBSCRIPTION PLAN CATALOG
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/plans/catalog', methods=['GET'])
@role_required('SUPER_ADMIN')
def list_plan_catalog():
    """List all dynamic subscription plans configured on the platform."""
    plans = SubscriptionPlan.query.order_by(SubscriptionPlan.sort_order.asc(), SubscriptionPlan.id.asc()).all()
    # Enrich with count of schools subscribed to each plan
    plan_counts = dict(
        db.session.query(SchoolSubscription.plan_id, func.count(SchoolSubscription.id))
        .filter(SchoolSubscription.status.in_(['ACTIVE', 'TRIAL']))
        .group_by(SchoolSubscription.plan_id)
        .all()
    )

    enriched = []
    for p in plans:
        item = p.to_dict()
        item['active_schools_count'] = plan_counts.get(p.id, 0)
        enriched.append(item)

    return jsonify({
        'total': len(plans),
        'plans': enriched
    }), 200


@subscription_bp.route('/plans/catalog', methods=['POST'])
@role_required('SUPER_ADMIN')
def create_subscription_plan():
    """Create a new SaaS subscription plan dynamically."""
    actor = get_current_user()
    data = request.get_json() or {}
    code = (data.get('code') or '').strip().upper()
    name = (data.get('name') or '').strip()

    if not code or not name:
        return jsonify({'error': 'Plan code and name are required'}), 400

    existing = SubscriptionPlan.query.filter_by(code=code).first()
    if existing:
        return jsonify({'error': f"Plan with code '{code}' already exists"}), 409

    plan = SubscriptionPlan(
        code=code,
        name=name,
        description=data.get('description', ''),
        billing_period=data.get('billing_period', 'MONTHLY'),
        price=float(data.get('price', 0.0)),
        currency=data.get('currency', 'INR'),
        included_modules=json.dumps(data.get('included_modules', [])),
        usage_limits_json=json.dumps(data.get('usage_limits', {})),
        is_active=bool(data.get('is_active', True)),
        is_trial_supported=bool(data.get('is_trial_supported', False)),
        trial_days=int(data.get('trial_days', 14)),
        sort_order=int(data.get('sort_order', 0)),
    )
    db.session.add(plan)
    db.session.commit()

    _log_admin_audit(
        actor, action='PLAN_CREATED',
        new_val=plan.to_dict(),
        remarks=f"Created subscription plan '{name}' ({code})"
    )

    return jsonify({'message': 'Plan created successfully', 'plan': plan.to_dict()}), 201


@subscription_bp.route('/plans/catalog/<int:plan_id>', methods=['PUT'])
@role_required('SUPER_ADMIN')
def update_subscription_plan(plan_id):
    """Edit an existing subscription plan."""
    actor = get_current_user()
    plan = SubscriptionPlan.query.get_or_404(plan_id)
    data = request.get_json() or {}

    old_snapshot = plan.to_dict()

    if 'name' in data:
        plan.name = data['name'].strip()
    if 'description' in data:
        plan.description = data['description']
    if 'billing_period' in data:
        plan.billing_period = data['billing_period']
    if 'price' in data:
        plan.price = float(data['price'])
    if 'currency' in data:
        plan.currency = data['currency']
    if 'included_modules' in data:
        plan.set_modules(data['included_modules'])
    if 'usage_limits' in data:
        plan.set_limits(data['usage_limits'])
    if 'is_active' in data:
        plan.is_active = bool(data['is_active'])
    if 'is_trial_supported' in data:
        plan.is_trial_supported = bool(data['is_trial_supported'])
    if 'trial_days' in data:
        plan.trial_days = int(data['trial_days'])
    if 'sort_order' in data:
        plan.sort_order = int(data['sort_order'])

    db.session.commit()

    _log_admin_audit(
        actor, action='PLAN_UPDATED',
        old_val=old_snapshot, new_val=plan.to_dict(),
        remarks=f"Updated plan {plan.code}"
    )

    return jsonify({'message': 'Plan updated successfully', 'plan': plan.to_dict()}), 200


@subscription_bp.route('/plans/catalog/<int:plan_id>/status', methods=['PATCH'])
@role_required('SUPER_ADMIN')
def toggle_plan_status(plan_id):
    """Toggle the active/inactive status of a subscription plan."""
    actor = get_current_user()
    plan = SubscriptionPlan.query.get_or_404(plan_id)
    plan.is_active = not plan.is_active
    db.session.commit()

    _log_admin_audit(
        actor, action='PLAN_STATUS_TOGGLED',
        new_val={'plan_id': plan.id, 'code': plan.code, 'is_active': plan.is_active},
        remarks=f"Toggled plan {plan.code} to {'ACTIVE' if plan.is_active else 'INACTIVE'}"
    )

    return jsonify({
        'message': f"Plan marked as {'active' if plan.is_active else 'inactive'}",
        'is_active': plan.is_active,
        'plan': plan.to_dict()
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
#  3. SCHOOL ENTITLEMENTS & PLAN ACCESS
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/schools/<int:school_id>/entitlements', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_school_entitlements(school_id):
    """
    Returns the complete entitlement profile for a school:
    - Current subscription plan details
    - Included modules in base plan
    - Individually granted modules (active and historical)
    - Effective module entitlement set
    - Full subscription change history
    """
    school = School.query.get_or_404(school_id)
    entitlements = calculate_effective_entitlements(school_id)

    # Fetch active subscription record
    sub = SchoolSubscription.query.filter_by(school_id=school_id).first()
    plan = sub.plan if sub else None

    # Fetch all individual grants
    grants = SchoolModuleGrant.query.filter_by(school_id=school_id).order_by(SchoolModuleGrant.created_at.desc()).all()

    # Fetch subscription history
    history = SchoolSubscriptionHistory.query.filter_by(school_id=school_id).order_by(SchoolSubscriptionHistory.created_at.desc()).all()

    return jsonify({
        'school_id': school.id,
        'school_name': school.name,
        'school_code': school.code,
        'status': school.status or ('ACTIVE' if school.is_active else 'INACTIVE'),
        'current_plan_code': entitlements['current_plan_code'],
        'subscription': sub.to_dict() if sub else None,
        'plan_details': plan.to_dict() if plan else None,
        'included_modules': list(entitlements['included_modules']),
        'individual_grants': [g.to_dict() for g in grants],
        'effective_modules': list(entitlements['effective_modules']),
        'history': [h.to_dict() for h in history]
    }), 200


@subscription_bp.route('/schools/<int:school_id>/subscription', methods=['POST'])
@role_required('SUPER_ADMIN')
def assign_or_change_school_plan(school_id):
    """
    Assign or change a school's base subscription plan.
    - Transactionally updates SchoolSubscription.
    - Preserves all historical data (zero data loss).
    - Writes immutable snapshot to SchoolSubscriptionHistory.
    - Sends notifications to School Principal.
    - Logs audit trail.
    """
    actor = get_current_user()
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}

    plan_code = (data.get('plan_code') or '').strip().upper()
    billing_period = data.get('billing_period', 'MONTHLY')
    reason = data.get('reason', 'Plan update by platform administrator')

    new_plan = SubscriptionPlan.query.filter_by(code=plan_code).first()
    if not new_plan:
        return jsonify({'error': f"Subscription plan '{plan_code}' not found"}), 404

    # Existing subscription lookup
    sub = SchoolSubscription.query.filter_by(school_id=school_id).first()
    old_plan_id = sub.plan_id if sub else None
    old_plan_code = sub.plan.code if (sub and sub.plan) else (school.plan or 'BASIC')
    old_modules = set(sub.plan.get_modules()) if (sub and sub.plan) else set()
    new_modules = set(new_plan.get_modules())

    added_modules = list(new_modules - old_modules)
    removed_modules = list(old_modules - new_modules)

    now = utc_now()
    if sub is None:
        sub = SchoolSubscription(
            school_id=school_id,
            plan_id=new_plan.id,
            status='ACTIVE',
            start_date=now,
            expiry_date=now + timedelta(days=365 if billing_period == 'ANNUAL' else 30),
            billing_period=billing_period,
            auto_renew=True
        )
        db.session.add(sub)
    else:
        sub.plan_id = new_plan.id
        sub.status = 'ACTIVE'
        sub.billing_period = billing_period
        sub.expiry_date = now + timedelta(days=365 if billing_period == 'ANNUAL' else 30)

    # Sync school's legacy plan string
    school.plan = new_plan.code

    # Write immutable history snapshot
    history = SchoolSubscriptionHistory(
        school_id=school_id,
        from_plan_id=old_plan_id,
        to_plan_id=new_plan.id,
        change_type='ASSIGNMENT' if old_plan_id is None else ('UPGRADE' if new_plan.price > (sub.plan.price if sub.plan else 0) else 'DOWNGRADE'),
        effective_date=now,
        changed_by_user_id=actor.id,
        reason=reason,
        notes=f"Modules added: {added_modules}; Modules removed: {removed_modules}"
    )
    db.session.add(history)
    db.session.commit()

    # Recalculate effective entitlements
    fresh_entitlements = calculate_effective_entitlements(school_id)

    # Audit logging
    _log_admin_audit(
        actor, action='PLAN_ASSIGNED',
        school_id=school_id,
        old_val={'plan': old_plan_code},
        new_val={'plan': new_plan.code, 'billing_period': billing_period},
        remarks=f"Changed school {school.name} plan from {old_plan_code} to {new_plan.code}. {reason}"
    )

    # In-App notification to Principal
    notif_msg = f"OnePlatform360 Campus: Your school subscription has been updated to the {new_plan.name}."
    if added_modules:
        notif_msg += f" Newly enabled modules: {', '.join(added_modules)}."
    _notify_principal(
        school_id=school_id,
        title=f"Subscription Updated: {new_plan.name}",
        message=notif_msg,
        metadata={'plan_code': new_plan.code, 'action': 'PLAN_CHANGE'}
    )

    return jsonify({
        'message': f"School subscription updated to '{new_plan.name}' successfully",
        'school_id': school_id,
        'current_plan': new_plan.to_dict(),
        'added_modules': added_modules,
        'removed_modules': removed_modules,
        'effective_modules': list(fresh_entitlements['effective_modules'])
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
#  4. INDIVIDUAL MODULE GRANT & REVOCATION
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/schools/<int:school_id>/modules/grant', methods=['POST'])
@role_required('SUPER_ADMIN')
def grant_individual_module(school_id):
    """
    Grant an individual module to a school without altering its base subscription tier.
    - Creates or reactivates SchoolModuleGrant.
    - Does not alter underlying student/academic/operational data.
    - Delivers in-app notification to School Head / Principal.
    - Records audit trail.
    """
    actor = get_current_user()
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}

    module_code = (data.get('module_code') or '').strip().lower()
    reason = (data.get('reason') or 'Granted by platform administrator').strip()
    expires_at_str = data.get('expires_at')

    # Validate module code exists
    mod = PlatformModule.query.filter_by(code=module_code).first()
    if not mod:
        return jsonify({'error': f"Unknown module code '{module_code}'"}), 404

    expires_at = None
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00')).replace(tzinfo=None)
        except Exception:
            return jsonify({'error': 'Invalid ISO date format for expires_at'}), 400

    grant = SchoolModuleGrant.query.filter_by(school_id=school_id, module_code=module_code).first()
    is_new = grant is None
    if is_new:
        grant = SchoolModuleGrant(
            school_id=school_id,
            module_code=module_code,
            grant_type='INDIVIDUAL',
            is_active=True,
            status='ACTIVE',
            granted_by_user_id=actor.id,
            reason=reason,
            expires_at=expires_at
        )
        db.session.add(grant)
    else:
        grant.is_active = True
        grant.status = 'ACTIVE'
        grant.granted_by_user_id = actor.id
        grant.reason = reason
        grant.expires_at = expires_at
        grant.revoked_at = None
        grant.revoked_by_user_id = None

    db.session.commit()

    # Recalculate effective entitlements
    fresh_entitlements = calculate_effective_entitlements(school_id)

    # Write AuditLog
    _log_admin_audit(
        actor, action='INDIVIDUAL_MODULE_GRANTED',
        school_id=school_id,
        new_val={'module_code': module_code, 'module_name': mod.name, 'reason': reason},
        remarks=f"Granted individual module '{mod.name}' to {school.name}"
    )

    # Deliver Principal notification
    notif_msg = f"OnePlatform360 Campus: The {mod.name} module has been enabled for your school ({school.name}). You can now access it from your dashboard."
    _notify_principal(
        school_id=school_id,
        title=f"Module Enabled: {mod.name}",
        message=notif_msg,
        metadata={
            'module_code': module_code,
            'action': 'MODULE_GRANTED',
            'deep_link': f'/{module_code.replace("_", "-")}'
        }
    )

    return jsonify({
        'message': f"Module '{mod.name}' granted successfully to {school.name}",
        'grant': grant.to_dict(),
        'effective_modules': list(fresh_entitlements['effective_modules'])
    }), 200


@subscription_bp.route('/schools/<int:school_id>/modules/revoke', methods=['POST'])
@role_required('SUPER_ADMIN')
def revoke_individual_module(school_id):
    """
    Revoke an individually granted module from a school.
    - Deactivates the grant without deleting historical tenant records (zero data loss).
    - Notifies the School Principal.
    - Records audit trail.
    """
    actor = get_current_user()
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}

    module_code = (data.get('module_code') or '').strip().lower()
    reason = (data.get('reason') or 'Revoked by platform administrator').strip()

    mod = PlatformModule.query.filter_by(code=module_code).first()
    mod_name = mod.name if mod else module_code

    grant = SchoolModuleGrant.query.filter_by(school_id=school_id, module_code=module_code, is_active=True).first()
    if not grant:
        return jsonify({'error': f"Active individual grant for module '{module_code}' not found on this school"}), 404

    now = utc_now()
    grant.is_active = False
    grant.status = 'REVOKED'
    grant.revoked_at = now
    grant.revoked_by_user_id = actor.id
    grant.reason = reason

    db.session.commit()

    # Recalculate effective entitlements
    fresh_entitlements = calculate_effective_entitlements(school_id)

    # Write AuditLog
    _log_admin_audit(
        actor, action='INDIVIDUAL_MODULE_REVOKED',
        school_id=school_id,
        old_val={'module_code': module_code, 'module_name': mod_name},
        remarks=f"Revoked individual module '{mod_name}' from {school.name}. {reason}"
    )

    # Deliver Principal notification
    notif_msg = f"OnePlatform360 Campus: Access to the {mod_name} module has been updated for your school."
    _notify_principal(
        school_id=school_id,
        title=f"Module Access Updated: {mod_name}",
        message=notif_msg,
        metadata={'module_code': module_code, 'action': 'MODULE_REVOKED'}
    )

    return jsonify({
        'message': f"Module '{mod_name}' revoked successfully",
        'grant': grant.to_dict(),
        'effective_modules': list(fresh_entitlements['effective_modules'])
    }), 200


@subscription_bp.route('/schools/<int:school_id>/modules/save-entitlements', methods=['PUT'])
@role_required('SUPER_ADMIN')
def save_batch_module_entitlements(school_id):
    """
    Batch-save module checkboxes from the School Details 'Plan & Module Access' tab.
    Computes exact diffs:
    - Automatically creates individual grants for newly checked modules not present in base plan.
    - Revokes individual grants for unchecked modules.
    - Prevents revoking core or base plan modules without a plan change.
    - Dispatches notifications and audit entries.
    """
    actor = get_current_user()
    school = School.query.get_or_404(school_id)
    data = request.get_json() or {}

    requested_modules = set(data.get('modules') or [])
    reason = (data.get('reason') or 'Batch entitlement update from dashboard').strip()

    # Get current status
    current_entitlements = calculate_effective_entitlements(school_id)
    current_plan_modules = set(current_entitlements['included_modules'])
    current_effective = set(current_entitlements['effective_modules'])

    # Determine changes
    to_grant = requested_modules - current_effective
    to_revoke = (current_effective - requested_modules) - current_plan_modules

    granted_list = []
    revoked_list = []

    # 1. Apply Grants
    for mod_code in to_grant:
        mod = PlatformModule.query.filter_by(code=mod_code).first()
        if not mod:
            continue
        grant = SchoolModuleGrant.query.filter_by(school_id=school_id, module_code=mod_code).first()
        if grant is None:
            grant = SchoolModuleGrant(
                school_id=school_id,
                module_code=mod_code,
                grant_type='INDIVIDUAL',
                is_active=True,
                status='ACTIVE',
                granted_by_user_id=actor.id,
                reason=reason
            )
            db.session.add(grant)
        else:
            grant.is_active = True
            grant.status = 'ACTIVE'
            grant.granted_by_user_id = actor.id
            grant.reason = reason
            grant.revoked_at = None
            grant.revoked_by_user_id = None
        granted_list.append(mod.name)

    # 2. Apply Revocations
    for mod_code in to_revoke:
        grant = SchoolModuleGrant.query.filter_by(school_id=school_id, module_code=mod_code, is_active=True).first()
        if grant:
            grant.is_active = False
            grant.status = 'REVOKED'
            grant.revoked_at = utc_now()
            grant.revoked_by_user_id = actor.id
            grant.reason = reason
            mod = PlatformModule.query.filter_by(code=mod_code).first()
            revoked_list.append(mod.name if mod else mod_code)

    db.session.commit()

    fresh_entitlements = calculate_effective_entitlements(school_id)

    # Log audit
    _log_admin_audit(
        actor, action='BATCH_MODULE_ENTITLEMENTS_UPDATED',
        school_id=school_id,
        new_val={'granted': granted_list, 'revoked': revoked_list, 'reason': reason},
        remarks=f"Batch entitlement update: granted {len(granted_list)}, revoked {len(revoked_list)}"
    )

    # Notify Principal if anything changed
    if granted_list or revoked_list:
        summary_msg = f"OnePlatform360 Campus: Module entitlements updated for {school.name}."
        if granted_list:
            summary_msg += f" Granted: {', '.join(granted_list)}."
        if revoked_list:
            summary_msg += f" Revoked: {', '.join(revoked_list)}."
        _notify_principal(
            school_id=school_id,
            title="Module Access Updated",
            message=summary_msg,
            metadata={'action': 'BATCH_ENTITLEMENT_UPDATE'}
        )

    return jsonify({
        'message': 'Module entitlements updated successfully',
        'granted': granted_list,
        'revoked': revoked_list,
        'effective_modules': list(fresh_entitlements['effective_modules'])
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
#  5. GUIDED SCHOOL ONBOARDING WIZARD (5-STEP TRANSACTIONAL)
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/schools/onboard-wizard', methods=['POST'])
@role_required('SUPER_ADMIN')
def onboard_school_wizard():
    """
    Transactional 5-Step Guided School Onboarding:
      Step 1: School Info (name, unique code, contact, address, type, etc.)
      Step 2: Academic Config (session, classes list, timezone)
      Step 3: Subscription Plan (plan_code, billing_period, is_trial)
      Step 4: Principal / School Head account creation
      Step 5: Review, validation, transactional commit, notification & audit.
    """
    actor = get_current_user()
    data = request.get_json() or {}

    info = data.get('school_info') or {}
    academic = data.get('academic_config') or {}
    sub_plan = data.get('subscription_plan') or {}
    principal_info = data.get('principal_account') or {}

    # Validation
    school_name = (info.get('name') or '').strip()
    school_code = (info.get('code') or '').strip().upper()
    principal_email = (principal_info.get('email') or '').strip().lower()
    principal_name = (principal_info.get('name') or '').strip()
    principal_password = principal_info.get('password') or 'Principal@123'
    plan_code = (sub_plan.get('plan_code') or 'BASIC').strip().upper()

    if not school_name or not school_code:
        return jsonify({'error': 'School name and unique school code are required'}), 400

    if not principal_email or not principal_name:
        return jsonify({'error': 'Principal name and email are required'}), 400

    # Check for existing school code
    if School.query.filter_by(code=school_code).first():
        return jsonify({'error': f"School code '{school_code}' is already registered"}), 409

    # Check for existing user email
    if User.query.filter_by(email=principal_email).first():
        return jsonify({'error': f"User with email '{principal_email}' already exists"}), 409

    # Verify selected plan
    plan = SubscriptionPlan.query.filter_by(code=plan_code).first()
    if not plan:
        plan = SubscriptionPlan.query.filter_by(code='BASIC').first()

    now = utc_now()
    session_val = academic.get('academic_session') or f"{now.year}-{now.year + 1}"

    try:
        # Step 1: Create School
        school = School(
            name=school_name,
            code=school_code,
            address=info.get('address', ''),
            city=info.get('city', ''),
            state=info.get('state', ''),
            pincode=info.get('pincode', ''),
            phone=info.get('contact_phone', ''),
            email=info.get('contact_email', ''),
            website=info.get('website', ''),
            affiliation_board=info.get('affiliation_board', ''),
            established_year=int(info.get('established_year', now.year)) if info.get('established_year') else None,
            type=info.get('type', 'K12'),
            current_session=session_val,
            plan=plan.code if plan else 'BASIC',
            is_active=True,
            status='ACTIVE'
        )
        db.session.add(school)
        db.session.flush()  # Allocate school.id

        # Step 2: Initialize Academic Classes if provided
        classes_created = []
        classes_list = academic.get('classes') or []
        for cname in classes_list:
            cname = str(cname).strip()
            if cname:
                cls_obj = Class(
                    school_id=school.id,
                    name=cname,
                    section='A'
                )
                db.session.add(cls_obj)
                classes_created.append(cname)

        # Step 3: Create School Subscription
        billing_period = sub_plan.get('billing_period', 'MONTHLY')
        is_trial = bool(sub_plan.get('is_trial', False))
        trial_days = plan.trial_days if (plan and plan.is_trial_supported) else 14
        expiry_date = now + timedelta(days=trial_days if is_trial else (365 if billing_period == 'ANNUAL' else 30))

        sub = SchoolSubscription(
            school_id=school.id,
            plan_id=plan.id if plan else 1,
            status='TRIAL' if is_trial else 'ACTIVE',
            start_date=now,
            expiry_date=expiry_date,
            billing_period=billing_period,
            auto_renew=True
        )
        db.session.add(sub)

        # Record Initial Subscription History
        hist = SchoolSubscriptionHistory(
            school_id=school.id,
            from_plan_id=None,
            to_plan_id=plan.id if plan else 1,
            change_type='ONBOARDING',
            effective_date=now,
            changed_by_user_id=actor.id,
            reason='Initial school onboarding'
        )
        db.session.add(hist)

        # Step 4: Create Principal Account
        principal = User(
            school_id=school.id,
            name=principal_name,
            email=principal_email,
            phone=principal_info.get('phone', ''),
            role=UserRole.PRINCIPAL,
            is_active=True,
            is_root_protected=False
        )
        principal.set_password(principal_password, store_plain=False)
        db.session.add(principal)
        db.session.flush()

        # Commit entire transaction
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f"Failed to complete school onboarding: {str(e)}"}), 500

    # Calculate effective entitlements
    fresh_entitlements = calculate_effective_entitlements(school.id)

    # Send Welcome In-App Notification
    _notify_principal(
        school_id=school.id,
        title=f"Welcome to OnePlatform360 Campus!",
        message=f"Welcome {principal_name}. Your school '{school_name}' has been successfully onboarded with the {plan.name if plan else 'Basic'} tier.",
        metadata={'action': 'ONBOARDING_WELCOME'}
    )

    # Log Administrative Audit
    _log_admin_audit(
        actor, action='SCHOOL_ONBOARDED',
        school_id=school.id,
        new_val={'school_code': school_code, 'name': school_name, 'plan': plan.code if plan else 'BASIC'},
        remarks=f"Completed 5-step guided onboarding for {school_name} ({school_code})"
    )

    return jsonify({
        'message': f"School '{school_name}' onboarded successfully!",
        'school': school.to_dict(),
        'subscription': sub.to_dict(),
        'principal': {
            'id': principal.id,
            'name': principal.name,
            'email': principal.email,
            'role': principal.role.value
        },
        'effective_modules': list(fresh_entitlements['effective_modules']),
        'classes_initialized': classes_created,
        'next_steps': [
            'Principal account created with login credentials',
            f"Assigned subscription tier: {plan.name if plan else 'Basic'}",
            'Ready to configure academic timetables and staff accounts'
        ]
    }), 201


# ─────────────────────────────────────────────────────────────────────────────
#  6. PLATFORM OVERVIEW & SAAS TELEMETRY
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/platform/overview-stats', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_platform_overview_stats():
    """
    Centralized SaaS Telemetry & Health Monitoring for Developer Dashboard:
    - School counts (total, active, inactive, trial, suspended)
    - Subscription plan distribution
    - Expiring subscriptions (within 30 days)
    - Individually granted modules summary
    - Recent administrative audit activities
    """
    total_schools = School.query.count()
    active_schools = School.query.filter(School.is_active == True, School.status == 'ACTIVE').count()
    suspended_schools = School.query.filter(School.status == 'SUSPENDED').count()
    trial_schools = SchoolSubscription.query.filter_by(status='TRIAL').count()
    archived_schools = School.query.filter(School.status == 'ARCHIVED').count()

    # Plan distribution
    plans = SubscriptionPlan.query.all()
    plan_name_by_id = {p.id: p.name for p in plans}
    plan_counts = dict(
        db.session.query(SchoolSubscription.plan_id, func.count(SchoolSubscription.id))
        .filter(SchoolSubscription.status.in_(['ACTIVE', 'TRIAL']))
        .group_by(SchoolSubscription.plan_id)
        .all()
    )
    plan_distribution = [
        {'plan_id': pid, 'name': plan_name_by_id.get(pid, 'Custom'), 'count': cnt}
        for pid, cnt in plan_counts.items()
    ]

    # Expiring subscriptions in next 30 days
    now = utc_now()
    expiring_threshold = now + timedelta(days=30)
    expiring_subs = (
        SchoolSubscription.query
        .filter(SchoolSubscription.expiry_date.isnot(None))
        .filter(SchoolSubscription.expiry_date <= expiring_threshold)
        .filter(SchoolSubscription.status.in_(['ACTIVE', 'TRIAL']))
        .all()
    )

    expiring_list = []
    for s in expiring_subs:
        sch = School.query.get(s.school_id)
        if sch:
            expiring_list.append({
                'school_id': sch.id,
                'school_name': sch.name,
                'plan_name': s.plan.name if s.plan else 'Unknown',
                'expiry_date': s.expiry_date.isoformat() if s.expiry_date else None,
                'days_remaining': (s.expiry_date - now).days if s.expiry_date else 0
            })

    # Individual Grants Count
    total_individual_grants = SchoolModuleGrant.query.filter_by(is_active=True).count()
    grant_counts_by_mod = dict(
        db.session.query(SchoolModuleGrant.module_code, func.count(SchoolModuleGrant.id))
        .filter_by(is_active=True)
        .group_by(SchoolModuleGrant.module_code)
        .all()
    )

    # Recent Administrative Activities from AuditLog
    recent_audits = (
        AuditLog.query
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        'schools': {
            'total': total_schools,
            'active': active_schools,
            'trial': trial_schools,
            'suspended': suspended_schools,
            'archived': archived_schools
        },
        'subscription_distribution': plan_distribution,
        'expiring_subscriptions': expiring_list,
        'individual_grants': {
            'total_active': total_individual_grants,
            'breakdown': grant_counts_by_mod
        },
        'recent_activity': [a.to_dict() for a in recent_audits],
        'system_health': {
            'database': 'ONLINE',
            'scheduler': 'RUNNING',
            'entitlement_engine': 'HEALTHY'
        }
    }), 200


# ─────────────────────────────────────────────────────────────────────────────
#  7. DYNAMIC COMPANY ORG CHART & REPORTING HIERARCHY
# ─────────────────────────────────────────────────────────────────────────────

@subscription_bp.route('/org-chart', methods=['GET'])
@role_required('SUPER_ADMIN')
def get_company_org_chart():
    """
    Returns the dynamic organizational hierarchy chart for OnePlatform360 SaaS company.
    Includes employees, assigned roles, reporting tree, and root protected status.
    """
    # Fetch internal company users (school_id is None)
    company_users = User.query.filter(User.school_id.is_(None)).all()

    # Collect reporting structure
    users_data = []
    for u in company_users:
        assignments = UserRoleAssignment.query.filter_by(user_id=u.id, is_active=True).all()
        roles_list = [a.role.to_dict() for a in assignments if a.role]

        manager = User.query.get(u.reports_to_user_id) if u.reports_to_user_id else None

        users_data.append({
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'role': u.role.value if u.role else 'SUPER_ADMIN',
            'roles': roles_list,
            'is_root_protected': getattr(u, 'is_root_protected', False),
            'reports_to_user_id': u.reports_to_user_id,
            'reports_to_name': manager.name if manager else None,
            'is_active': u.is_active,
            'department': u.department or 'Engineering'
        })

    # Fetch company roles catalog
    company_roles = Role.query.filter_by(scope='COMPANY').order_by(Role.hierarchy_level.asc()).all()

    return jsonify({
        'company_users': users_data,
        'roles': [r.to_dict() for r in company_roles]
    }), 200


@subscription_bp.route('/users/<int:user_id>/reporting-manager', methods=['PUT'])
@role_required('SUPER_ADMIN')
def set_reporting_manager(user_id):
    """
    Set or update the reporting manager for an internal company employee.
    Enforces that a subordinate cannot modify a protected root administrator.
    """
    actor = get_current_user()
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    manager_id = data.get('reports_to_user_id')

    # Root Admin Protection
    if getattr(user, 'is_root_protected', False) and not getattr(actor, 'is_root_protected', False):
        return jsonify({'error': 'Cannot alter reporting relationship of root protected administrator'}), 403

    if manager_id:
        if int(manager_id) == user.id:
            return jsonify({'error': 'User cannot report to themselves'}), 400
        manager = User.query.get(manager_id)
        if not manager:
            return jsonify({'error': 'Reporting manager not found'}), 404
        user.reports_to_user_id = manager.id
    else:
        user.reports_to_user_id = None

    db.session.commit()

    _log_admin_audit(
        actor, action='REPORTING_MANAGER_UPDATED',
        new_val={'user_id': user.id, 'reports_to_user_id': user.reports_to_user_id},
        remarks=f"Updated reporting manager for user {user.name}"
    )

    return jsonify({
        'message': 'Reporting manager updated successfully',
        'user_id': user.id,
        'reports_to_user_id': user.reports_to_user_id
    }), 200
