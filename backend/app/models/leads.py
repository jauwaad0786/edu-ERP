# backend/app/routes/leads.py
"""
Website Leads APIs.

Public side  (koi bhi, bina login — OmniSphere 365 website yahan se hit karti hai):
  POST /api/public/leads                  -> Demo Request ya Contact form submit

Company side (CEO / Super Admin / Developer team — developer_center.py
wala hi "company-side only" gate, _require_company_actor):
  GET   /api/developer/leads               -> list + filter (lead_type, status)
  GET   /api/developer/leads/summary       -> dashboard counters
  PATCH /api/developer/leads/<id>/status   -> NEW -> CONTACTED -> CLOSED
"""

from flask import Blueprint, request, jsonify

from app import db, limiter
from app.models.leads import WebsiteLead, LEAD_TYPES, LEAD_STATUSES
from app.utils.decorators import get_current_user
from app.utils.emailer import send_lead_notification_email

leads_bp = Blueprint('leads', __name__)


def _require_company_actor():
    """developer_center.py jaisa hi gate — school_id set hote hi 403."""
    actor = get_current_user()
    if not actor:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if getattr(actor, 'school_id', None) is not None:
        return None, (jsonify({'error': 'Leads panel is company-side only'}), 403)
    return actor, None


# ── PUBLIC: website submits a lead ──────────────────────────────────────────

@leads_bp.route('/public/leads', methods=['POST'])
@limiter.limit('10 per hour')   # spam/bot protection — ek IP baar baar spam na kare
def create_lead():
    data = request.get_json(silent=True) or {}

    lead_type = (data.get('lead_type') or 'DEMO').upper()
    if lead_type not in LEAD_TYPES:
        lead_type = 'DEMO'

    name  = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()

    if not name or not email:
        return jsonify({'error': 'name aur email zaroori hain'}), 400

    lead = WebsiteLead(
        lead_type  = lead_type,
        source     = (data.get('source') or 'omnisphere365').strip()[:50],
        name       = name[:120],
        company    = (data.get('company') or '').strip()[:150] or None,
        email      = email[:120],
        phone      = (data.get('phone') or '').strip()[:30] or None,
        city       = (data.get('city') or '').strip()[:80] or None,
        service    = (data.get('service') or '').strip()[:80] or None,
        org_size   = (data.get('size') or data.get('org_size') or '').strip()[:30] or None,
        message    = (data.get('message') or '').strip() or None,
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr),
    )
    db.session.add(lead)
    db.session.commit()

    # Best-effort — email fail ho bhi jaye to lead already DB me save ho chuki hai
    try:
        send_lead_notification_email(lead)
    except Exception as e:
        print(f'⚠️  Lead email notification error: {e}')

    return jsonify({'success': True, 'id': lead.id}), 201


# ── COMPANY SIDE: CEO / Super Admin panel ───────────────────────────────────

@leads_bp.route('/developer/leads', methods=['GET'])
def list_leads():
    actor, err = _require_company_actor()
    if err:
        return err

    query = WebsiteLead.query

    lead_type = request.args.get('lead_type')
    if lead_type in LEAD_TYPES:
        query = query.filter_by(lead_type=lead_type)

    status = request.args.get('status')
    if status in LEAD_STATUSES:
        query = query.filter_by(status=status)

    leads = query.order_by(WebsiteLead.created_at.desc()).limit(200).all()
    return jsonify([l.to_dict() for l in leads]), 200


@leads_bp.route('/developer/leads/summary', methods=['GET'])
def leads_summary():
    actor, err = _require_company_actor()
    if err:
        return err

    return jsonify({
        'total':             WebsiteLead.query.count(),
        'new':               WebsiteLead.query.filter_by(status='NEW').count(),
        'demo_requests':     WebsiteLead.query.filter_by(lead_type='DEMO').count(),
        'contact_messages':  WebsiteLead.query.filter_by(lead_type='CONTACT').count(),
    }), 200


@leads_bp.route('/developer/leads/<int:lead_id>/status', methods=['PATCH'])
def update_lead_status(lead_id):
    actor, err = _require_company_actor()
    if err:
        return err

    lead = WebsiteLead.query.get_or_404(lead_id)
    new_status = (request.get_json(silent=True) or {}).get('status')
    if new_status not in LEAD_STATUSES:
        return jsonify({'error': f'status must be one of {LEAD_STATUSES}'}), 400

    lead.status = new_status
    db.session.commit()
    return jsonify(lead.to_dict()), 200
