from flask import Blueprint, request, jsonify
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.whatsapp import SchoolWhatsAppSettings
from app.utils.crypto import encrypt_value
from datetime import datetime
import requests

whatsapp_settings_bp = Blueprint('whatsapp_settings', __name__)


def _school_id():
    return get_current_user().school_id


def _get_or_create(sid):
    settings = SchoolWhatsAppSettings.query.filter_by(school_id=sid).first()
    if not settings:
        settings = SchoolWhatsAppSettings(school_id=sid)
        db.session.add(settings)
        db.session.commit()
    return settings


# ═══════════════════════════════════════════════════════════════════════════
#  Settings CRUD
# ═══════════════════════════════════════════════════════════════════════════

@whatsapp_settings_bp.route('/settings', methods=['GET'])
@role_required('PRINCIPAL')
def get_settings():
    settings = _get_or_create(_school_id())
    d = settings.to_dict()
    d['webhook_url'] = f"{request.host_url.rstrip('/')}/api/webhooks/whatsapp/{settings.school_id}"
    return jsonify(d), 200


@whatsapp_settings_bp.route('/settings', methods=['POST'])
@role_required('PRINCIPAL')
def save_settings():
    """
    Body: business_name, business_phone, phone_number_id, business_account_id,
          access_token (optional — only if user is setting/changing it),
          app_secret (optional), verify_token, app_id, api_version
    Note: access_token/app_secret sirf tab bhejo jab naya value set/change karna ho —
    frontend masked value ko wapas nahi bhejta.
    """
    sid  = _school_id()
    data = request.get_json() or {}
    settings = _get_or_create(sid)

    text_fields = ['business_name', 'business_phone', 'phone_number_id',
                   'business_account_id', 'verify_token', 'app_id', 'api_version']
    for f in text_fields:
        if f in data:
            setattr(settings, f, (data[f] or '').strip())

    if data.get('access_token'):
        settings.access_token_encrypted = encrypt_value(data['access_token'].strip())
        settings.connection_status = 'DISCONNECTED'  # naya token — re-verify chahiye

    if data.get('app_secret'):
        settings.app_secret_encrypted = encrypt_value(data['app_secret'].strip())

    settings.updated_at = datetime.utcnow()
    db.session.commit()

    d = settings.to_dict()
    d['webhook_url'] = f"{request.host_url.rstrip('/')}/api/webhooks/whatsapp/{sid}"
    return jsonify(d), 200


@whatsapp_settings_bp.route('/settings', methods=['DELETE'])
@role_required('PRINCIPAL')
def disconnect():
    """Disconnect — credentials clear kar do, config fields rehne do (re-connect asaan ho)."""
    sid = _school_id()
    settings = _get_or_create(sid)

    settings.access_token_encrypted = None
    settings.app_secret_encrypted   = None
    settings.is_active         = False
    settings.connection_status = 'DISCONNECTED'
    settings.last_test_result  = 'Disconnected by Principal'
    settings.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': 'WhatsApp disconnected', 'connection_status': 'DISCONNECTED'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  Verify / Test Connection — actual Meta Graph API call
# ═══════════════════════════════════════════════════════════════════════════

@whatsapp_settings_bp.route('/settings/verify', methods=['POST'])
@role_required('PRINCIPAL')
def verify_connection():
    """
    Calls Meta Graph API: GET /{api_version}/{phone_number_id}
    with the saved (decrypted) access token, to confirm credentials are valid.
    """
    sid = _school_id()
    settings = SchoolWhatsAppSettings.query.filter_by(school_id=sid).first()

    if not settings or not settings.phone_number_id:
        return jsonify({'error': 'Phone Number ID pehle save karo'}), 400

    access_token = settings.get_decrypted_access_token()
    if not access_token:
        return jsonify({'error': 'Access Token pehle save karo'}), 400

    api_version = settings.api_version or 'v21.0'
    url = f"https://graph.facebook.com/{api_version}/{settings.phone_number_id}"

    try:
        resp = requests.get(url, params={'access_token': access_token}, timeout=10)
        payload = resp.json()
    except requests.RequestException as e:
        settings.connection_status = 'FAILED'
        settings.last_test         = datetime.utcnow()
        settings.last_test_result  = f'Network error: {str(e)[:200]}'
        db.session.commit()
        return jsonify({'error': 'Meta API tak pahunch nahi paya', 'details': str(e)}), 502

    if resp.status_code == 200 and 'id' in payload:
        settings.connection_status = 'CONNECTED'
        settings.is_active         = True
        settings.last_sync         = datetime.utcnow()
        settings.last_test         = datetime.utcnow()
        settings.last_test_result  = f"Verified — {payload.get('display_phone_number', settings.business_phone)}"
        # Auto-fill business phone if Meta returns it and it's not set yet
        if payload.get('display_phone_number') and not settings.business_phone:
            settings.business_phone = payload['display_phone_number']
        db.session.commit()
        return jsonify({
            'connection_status': 'CONNECTED',
            'message': 'Connection successful!',
            'display_phone_number': payload.get('display_phone_number'),
            'verified_name': payload.get('verified_name'),
        }), 200
    else:
        error_msg = payload.get('error', {}).get('message', 'Authentication failed — token ya Phone Number ID galat hai')
        settings.connection_status = 'FAILED'
        settings.is_active         = False
        settings.last_test         = datetime.utcnow()
        settings.last_test_result  = error_msg[:300]
        db.session.commit()
        return jsonify({'connection_status': 'FAILED', 'error': error_msg}), 400
