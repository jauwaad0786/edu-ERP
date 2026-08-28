from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, UserRole
from app.models.communication import SupportPlan, SupportUsage
from app.services.notification_service import send_notification
from app.utils.decorators import role_required, get_current_user
from datetime import datetime, date, timedelta

support_plans_bp = Blueprint('support_plans', __name__)


# ─── Helper ───────────────────────────────────────────────────────────────────

def _notify(user_id, title, message, school_id=None):
    send_notification(
        user_id    = user_id,
        school_id  = school_id,
        title      = title,
        message    = message,
        notif_type = 'SYSTEM',
    )


def _get_active_plan(school_id):
    """
    School ka current plan return karo.
    Expired PREMIUM → BASIC treat karo.
    """
    if not school_id:
        return None, 'BASIC'

    plan = SupportPlan.query.filter_by(school_id=school_id).first()
    if not plan:
        return None, 'BASIC'
    if not plan.is_active:
        return plan, 'BASIC'
    if plan.expires_at and plan.expires_at < datetime.utcnow():
        return plan, 'BASIC'   # expired
    return plan, plan.plan


# ─── 1. My Plan Details ───────────────────────────────────────────────────────

@support_plans_bp.route('/my-plan', methods=['GET'])
@role_required('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL',
               'TEACHER', 'STUDENT', 'PARENT',
               'ACCOUNTANT', 'RECEPTIONIST', 'LIBRARIAN',
               'HOSTEL', 'TRANSPORT', 'HR')
def my_plan():
    """
    GET /api/support/plans/my-plan
    Apna current plan + weekly usage + upgrade info dekho.
    Principal dashboard pe plan status card ke liye.
    """
    user      = get_current_user()
    school_id = user.school_id

    plan_obj, plan_name = _get_active_plan(school_id)

    # Weekly usage
    week_key = date.today().strftime('%Y-W%W')
    usage    = SupportUsage.query.filter_by(
        school_id=school_id, week_key=week_key
    ).first() if school_id else None

    used  = usage.ticket_count if usage else 0
    limit = 1 if plan_name == 'BASIC' else 999

    # Usage history — last 8 weeks
    usage_history = SupportUsage.query.filter_by(
        school_id=school_id
    ).order_by(SupportUsage.week_key.desc()).limit(8).all() if school_id else []

    return jsonify({
        'school_id':       school_id,
        'plan':            plan_name,
        'is_premium':      plan_name == 'PREMIUM',
        'is_active':       plan_obj.is_active if plan_obj else False,

        # Expiry
        'expires_at':      plan_obj.expires_at.isoformat()
                           if plan_obj and plan_obj.expires_at else None,
        'days_remaining':  (
            (plan_obj.expires_at - datetime.utcnow()).days
            if plan_obj and plan_obj.expires_at and plan_obj.expires_at > datetime.utcnow()
            else 0
        ),

        # Weekly usage
        'week_key':        week_key,
        'used_this_week':  used,
        'limit':           limit,
        'remaining':       max(0, limit - used),

        # Upgrade info
        'upgrade_price':   299,
        'upgrade_benefits': [
            'Unlimited support requests',
            'Priority response — same day',
            'Video meetings (Google Meet / Zoom)',
            'WhatsApp support',
            'Remote desktop assistance',
            'Dedicated account manager',
        ],

        # Usage history
        'usage_history': [u.to_dict() for u in usage_history],
    }), 200


# ─── 2. All Plans (SUPER_ADMIN — sab schools) ─────────────────────────────────

@support_plans_bp.route('', methods=['GET'])
@role_required('SUPER_ADMIN')
def list_all_plans():
    """
    GET /api/support/plans
    SUPER_ADMIN — sab schools ke plans dekho.
    Query params: plan (BASIC/PREMIUM), is_active, product_type, page, per_page
    """
    q = SupportPlan.query

    if request.args.get('plan'):
        q = q.filter_by(plan=request.args.get('plan').upper())
    if request.args.get('is_active') == 'true':
        q = q.filter_by(is_active=True)
    elif request.args.get('is_active') == 'false':
        q = q.filter_by(is_active=False)
    if request.args.get('product_type'):
        q = q.filter_by(product_type=request.args.get('product_type'))

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(
        SupportPlan.updated_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for p in paginated.items:
        d = p.to_dict()

        # School name add karo
        try:
            from app.models.school import School
            school = School.query.get(p.school_id)
            d['school_name'] = school.name if school else ''
        except Exception:
            d['school_name'] = ''

        # Is it actually active (not expired)?
        is_expired = (
            p.expires_at and p.expires_at < datetime.utcnow()
        )
        d['is_expired']      = bool(is_expired)
        d['effective_plan']  = 'BASIC' if (not p.is_active or is_expired) else p.plan

        # Current week usage
        week_key = date.today().strftime('%Y-W%W')
        usage = SupportUsage.query.filter_by(
            school_id=p.school_id, week_key=week_key
        ).first()
        d['used_this_week'] = usage.ticket_count if usage else 0

        result.append(d)

    return jsonify({
        'data':     result,
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 3. Activate / Upgrade Plan (SUPER_ADMIN) ────────────────────────────────

@support_plans_bp.route('/activate', methods=['POST'])
@role_required('SUPER_ADMIN')
def activate_plan():
    """
    POST /api/support/plans/activate
    Body: { school_id, plan, months, product_type, amount }
    SUPER_ADMIN kisi school ka plan activate / renew kare.
    """
    data         = request.get_json() or {}
    school_id    = data.get('school_id')
    plan         = (data.get('plan') or 'PREMIUM').upper()
    months       = max(1, int(data.get('months', 1)))
    product_type = data.get('product_type', 'EduERP')
    amount       = float(data.get('amount', 299 * months))

    if not school_id:
        return jsonify({'error': 'school_id is required'}), 400
    if plan not in ('BASIC', 'PREMIUM'):
        return jsonify({'error': 'plan must be BASIC or PREMIUM'}), 400

    expires_at = datetime.utcnow() + timedelta(days=30 * months)

    existing = SupportPlan.query.filter_by(school_id=school_id).first()
    if existing:
        # Renew — extend from now
        existing.plan         = plan
        existing.product_type = product_type
        existing.is_active    = True
        existing.amount       = amount
        existing.expires_at   = expires_at
        existing.billing_date = date.today()
        existing.updated_at   = datetime.utcnow()
        plan_obj = existing
    else:
        plan_obj = SupportPlan(
            school_id    = school_id,
            product_type = product_type,
            plan         = plan,
            is_active    = True,
            amount       = amount,
            billing_date = date.today(),
            expires_at   = expires_at,
        )
        db.session.add(plan_obj)

    # Notify principal of the school
    principal = User.query.filter_by(
        school_id=school_id, role=UserRole.PRINCIPAL
    ).first()
    if principal:
        _notify(
            user_id   = principal.id,
            title     = f'{"🎉 Premium" if plan == "PREMIUM" else "📋 Basic"} Support Activated',
            message   = (
                f'Aapka {plan} Support Plan {months} month(s) ke liye activate ho gaya. '
                f'Valid till: {expires_at.strftime("%d %b %Y")}. '
                + ('Ab aap unlimited support requests raise kar sakte hain.'
                   if plan == 'PREMIUM' else '')
            ),
            school_id = school_id,
        )

    db.session.commit()
    return jsonify({
        'message':    f'{plan} plan activated for {months} month(s)',
        'school_id':  school_id,
        'plan':       plan,
        'expires_at': expires_at.isoformat(),
        'amount':     amount,
    }), 200


# ─── 4. Deactivate Plan (SUPER_ADMIN) ────────────────────────────────────────

@support_plans_bp.route('/<int:plan_id>/deactivate', methods=['POST'])
@role_required('SUPER_ADMIN')
def deactivate_plan(plan_id):
    """
    POST /api/support/plans/<id>/deactivate
    Plan band karo — school BASIC pe fall back kar jayegi.
    """
    plan_obj = SupportPlan.query.get_or_404(plan_id)
    plan_obj.is_active  = False
    plan_obj.updated_at = datetime.utcnow()

    # Notify principal
    principal = User.query.filter_by(
        school_id=plan_obj.school_id, role=UserRole.PRINCIPAL
    ).first()
    if principal:
        _notify(
            user_id   = principal.id,
            title     = 'Support Plan Deactivated',
            message   = (
                'Aapka Premium Support plan deactivate ho gaya hai. '
                'Aap ab BASIC plan pe hain — sirf 1 ticket/week allowed hai. '
                'Renewal ke liye support se contact karo.'
            ),
            school_id = plan_obj.school_id,
        )

    db.session.commit()
    return jsonify({'message': 'Plan deactivated', 'plan': plan_obj.to_dict()}), 200


# ─── 5. Expiring Soon (SUPER_ADMIN — renewal reminders) ──────────────────────

@support_plans_bp.route('/expiring-soon', methods=['GET'])
@role_required('SUPER_ADMIN')
def expiring_soon():
    """
    GET /api/support/plans/expiring-soon?days=7
    Plans jo next N days mein expire honge — renewal reminder ke liye.
    Default: next 7 days.
    """
    days       = request.args.get('days', 7, type=int)
    cutoff     = datetime.utcnow() + timedelta(days=days)
    now        = datetime.utcnow()

    plans = SupportPlan.query.filter(
        SupportPlan.is_active   == True,
        SupportPlan.plan        == 'PREMIUM',
        SupportPlan.expires_at  != None,
        SupportPlan.expires_at  >  now,
        SupportPlan.expires_at  <= cutoff,
    ).order_by(SupportPlan.expires_at.asc()).all()

    result = []
    for p in plans:
        d = p.to_dict()
        try:
            from app.models.school import School
            school = School.query.get(p.school_id)
            d['school_name'] = school.name if school else ''
        except Exception:
            d['school_name'] = ''
        d['days_remaining'] = (p.expires_at - now).days
        result.append(d)

    return jsonify({
        'count':  len(result),
        'days':   days,
        'plans':  result,
    }), 200


# ─── 6. Usage Summary — All Schools (SUPER_ADMIN) ────────────────────────────

@support_plans_bp.route('/usage-summary', methods=['GET'])
@role_required('SUPER_ADMIN')
def usage_summary():
    """
    GET /api/support/plans/usage-summary
    Har school ka is week ka ticket usage — admin dashboard ke liye.
    """
    from sqlalchemy import func

    week_key = date.today().strftime('%Y-W%W')

    rows = db.session.query(
        SupportUsage.school_id,
        SupportUsage.ticket_count,
    ).filter_by(week_key=week_key)\
     .order_by(SupportUsage.ticket_count.desc()).all()

    result = []
    for r in rows:
        try:
            from app.models.school import School
            school = School.query.get(r.school_id)
            school_name = school.name if school else ''
        except Exception:
            school_name = ''

        _, plan_name = _get_active_plan(r.school_id)
        limit = 1 if plan_name == 'BASIC' else 999

        result.append({
            'school_id':    r.school_id,
            'school_name':  school_name,
            'plan':         plan_name,
            'used':         r.ticket_count,
            'limit':        limit,
            'at_limit':     r.ticket_count >= limit,
        })

    return jsonify({
        'week_key': week_key,
        'total_schools': len(result),
        'data':     result,
    }), 200


# ─── 7. Reset Weekly Usage (SUPER_ADMIN — manual override) ───────────────────

@support_plans_bp.route('/reset-usage', methods=['POST'])
@role_required('SUPER_ADMIN')
def reset_usage():
    """
    POST /api/support/plans/reset-usage
    Body: { school_id }
    Kisi school ka is week ka usage manually reset karo.
    Useful jab principal galti se limit hit kar le.
    """
    data      = request.get_json() or {}
    school_id = data.get('school_id')

    if not school_id:
        return jsonify({'error': 'school_id is required'}), 400

    week_key = date.today().strftime('%Y-W%W')
    usage    = SupportUsage.query.filter_by(
        school_id=school_id, week_key=week_key
    ).first()

    if usage:
        usage.ticket_count = 0
        usage.updated_at   = datetime.utcnow()
        db.session.commit()

    # Notify principal
    principal = User.query.filter_by(
        school_id=school_id, role=UserRole.PRINCIPAL
    ).first()
    if principal:
        _notify(
            user_id   = principal.id,
            title     = 'Weekly Support Limit Reset',
            message   = (
                'Aapka is hafte ka support limit reset kar diya gaya hai. '
                'Ab aap naya support request raise kar sakte hain.'
            ),
            school_id = school_id,
        )
        db.session.commit()

    return jsonify({
        'message':   f'Usage reset for school_id={school_id}, week={week_key}',
        'school_id': school_id,
        'week_key':  week_key,
    }), 200
