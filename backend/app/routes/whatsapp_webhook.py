import re
from flask import Blueprint, request, jsonify, Response
from app.models.whatsapp import SchoolWhatsAppSettings

webhook_bp = Blueprint('whatsapp_webhook', __name__)

CHALLENGE_PATTERN = re.compile(r'^[a-zA-Z0-9_\-\.]{1,256}$')


@webhook_bp.route('/whatsapp/<int:school_id>', methods=['GET'])
def verify_webhook(school_id):
    """
    Meta verification handshake — GET request with hub.mode, hub.verify_token, hub.challenge.
    Must return hub.challenge as PLAIN TEXT (not JSON) with status 200 if token matches.
    Sanitized against Reflected XSS (pythonsecurity:S5131).
    """
    mode      = request.args.get('hub.mode')
    token     = request.args.get('hub.verify_token')
    challenge = request.args.get('hub.challenge')

    if not challenge or not CHALLENGE_PATTERN.match(challenge):
        return 'Bad Request', 400

    settings = SchoolWhatsAppSettings.query.filter_by(school_id=school_id).first()

    if not settings or not settings.verify_token:
        return 'Forbidden', 403

    if mode == 'subscribe' and token == settings.verify_token:
        # IMPORTANT: plain text return, no jsonify — Meta expects raw challenge string
        response = Response(challenge, mimetype='text/plain', status=200)
        response.headers['Content-Type'] = 'text/plain; charset=utf-8'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    return 'Forbidden', 403


@webhook_bp.route('/whatsapp/<int:school_id>', methods=['POST'])
def receive_webhook(school_id):
    """
    Incoming message status updates / replies from Meta.
    Ye Phase 4/6 (Message Logs) mein poora use hoga — abhi bas 200 return karke
    acknowledge kar rahe hain taaki Meta retry na kare.
    """
    data = request.get_json(silent=True) or {}

    # TODO (later phase): parse 'statuses' (delivered/read/failed) and 'messages'
    # (incoming replies) — update MessageLog table accordingly.
    print(f"[WhatsApp Webhook] school_id={school_id} payload={data}")

    return jsonify({'status': 'received'}), 200
