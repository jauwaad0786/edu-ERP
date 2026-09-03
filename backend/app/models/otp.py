from app import db
from datetime import datetime


class OTPPurpose:
    LOGIN = 'LOGIN'
    PASSWORD_RESET = 'PASSWORD_RESET'


class OTPVerification(db.Model):
    """
    Model for tracking OTP requests, cryptographic hashes,
    attempt limits, and verification states across SMS and Email.
    """
    __tablename__ = 'otp_verifications'

    id           = db.Column(db.Integer, primary_key=True)
    identifier   = db.Column(db.String(120), nullable=False, index=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    purpose      = db.Column(db.String(30), default=OTPPurpose.LOGIN, nullable=False, index=True)
    otp_hash     = db.Column(db.String(256), nullable=False)
    expires_at   = db.Column(db.DateTime, nullable=False, index=True)
    attempts     = db.Column(db.Integer, default=0, nullable=False)
    max_attempts = db.Column(db.Integer, default=5, nullable=False)
    is_used      = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    used_at      = db.Column(db.DateTime, nullable=True)

    user   = db.relationship('User', foreign_keys=[user_id], backref='otp_requests', lazy='joined')
    school = db.relationship('School', foreign_keys=[school_id], backref='otp_requests', lazy='joined')

    def to_dict(self):
        return {
            'id':           self.id,
            'identifier':   self.identifier,
            'user_id':      self.user_id,
            'school_id':    self.school_id,
            'purpose':      self.purpose,
            'expires_at':   self.expires_at.isoformat() if self.expires_at else None,
            'attempts':     self.attempts,
            'max_attempts': self.max_attempts,
            'is_used':      self.is_used,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
            'used_at':      self.used_at.isoformat() if self.used_at else None,
        }
