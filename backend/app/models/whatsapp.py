from app import db
from datetime import datetime


class SchoolWhatsAppSettings(db.Model):
    """
    Multi-tenant WhatsApp Cloud API config — one row per school.
    access_token & app_secret are stored ENCRYPTED (via app.utils.crypto).
    Never expose decrypted values in to_dict() — only masked previews.
    """
    __tablename__ = 'school_whatsapp_settings'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), unique=True, nullable=False)

    # ── Business Information ──
    business_name       = db.Column(db.String(150))
    business_phone      = db.Column(db.String(20))
    phone_number_id      = db.Column(db.String(50))
    business_account_id  = db.Column(db.String(50))

    # ── Authentication (ENCRYPTED at rest) ──
    access_token_encrypted = db.Column(db.Text)       # Permanent Access Token
    app_secret_encrypted   = db.Column(db.Text)        # optional
    verify_token           = db.Column(db.String(150)) # not secret-sensitive, needed for webhook setup
    app_id                 = db.Column(db.String(50))
    api_version            = db.Column(db.String(10), default='v21.0')

    # ── Status ──
    is_active          = db.Column(db.Boolean, default=False)
    connection_status  = db.Column(db.String(20), default='DISCONNECTED')  # CONNECTED / DISCONNECTED / FAILED
    last_sync          = db.Column(db.DateTime, nullable=True)
    last_test          = db.Column(db.DateTime, nullable=True)
    last_test_result    = db.Column(db.String(300))  # short human-readable result of last test

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        from app.utils.crypto import decrypt_value, mask_token

        access_token_plain = decrypt_value(self.access_token_encrypted) if self.access_token_encrypted else None
        app_secret_plain    = decrypt_value(self.app_secret_encrypted) if self.app_secret_encrypted else None

        return {
            'id':                  self.id,
            'business_name':       self.business_name or '',
            'business_phone':      self.business_phone or '',
            'phone_number_id':     self.phone_number_id or '',
            'business_account_id': self.business_account_id or '',

            'access_token_masked': mask_token(access_token_plain) if access_token_plain else None,
            'app_secret_masked':   mask_token(app_secret_plain) if app_secret_plain else None,
            'has_access_token':    bool(access_token_plain),
            'has_app_secret':      bool(app_secret_plain),

            'verify_token': self.verify_token or '',
            'app_id':       self.app_id or '',
            'api_version':  self.api_version or 'v21.0',

            'is_active':         self.is_active,
            'connection_status': self.connection_status,
            'last_sync':         self.last_sync.isoformat() if self.last_sync else None,
            'last_test':         self.last_test.isoformat() if self.last_test else None,
            'last_test_result':  self.last_test_result or '',

            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

    def get_decrypted_access_token(self):
        from app.utils.crypto import decrypt_value
        return decrypt_value(self.access_token_encrypted)

    def get_decrypted_app_secret(self):
        from app.utils.crypto import decrypt_value
        return decrypt_value(self.app_secret_encrypted)
