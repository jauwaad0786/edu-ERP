"""
Secure OTP Service for Edu ERP.
Manages cryptographically strong OTP generation, hashing, rate limiting,
cooldown enforcement, and verification lifecycle.
"""

import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from flask import current_app
from app import db
from app.models.otp import OTPVerification, OTPPurpose


class OTPService:
    DEFAULT_EXPIRY_MINUTES = 10
    DEFAULT_COOLDOWN_SECONDS = 60
    DEFAULT_MAX_ATTEMPTS = 5

    @classmethod
    def _get_secret_salt(cls):
        """Retrieve backend secret key to salt OTP hashes."""
        try:
            if current_app and current_app.config.get('SECRET_KEY'):
                return current_app.config.get('SECRET_KEY').encode('utf-8')
        except Exception:
            pass
        return os.getenv('SECRET_KEY', 'default-edu-erp-otp-salt').encode('utf-8')

    @classmethod
    def generate_otp(cls, length=6):
        """Generates cryptographically random N-digit numeric OTP."""
        digits = '0123456789'
        return ''.join(secrets.choice(digits) for _ in range(length))

    @classmethod
    def hash_otp(cls, otp):
        """Hashes OTP using HMAC-SHA256 with application secret salt."""
        salt = cls._get_secret_salt()
        return hmac.new(salt, str(otp).encode('utf-8'), hashlib.sha256).hexdigest()

    @classmethod
    def verify_otp_hash(cls, raw_otp, stored_hash):
        """Constant-time comparison of candidate OTP against stored hash."""
        if not raw_otp or not stored_hash:
            return False
        candidate_hash = cls.hash_otp(raw_otp)
        return hmac.compare_digest(candidate_hash, stored_hash)

    @classmethod
    def get_remaining_cooldown(cls, identifier, purpose=OTPPurpose.LOGIN, cooldown_seconds=DEFAULT_COOLDOWN_SECONDS):
        """Returns remaining seconds if identifier is currently on resend cooldown."""
        norm_id = str(identifier).strip().lower()
        latest = (
            OTPVerification.query
            .filter_by(identifier=norm_id, purpose=purpose)
            .order_by(OTPVerification.created_at.desc())
            .first()
        )
        if not latest:
            return 0

        elapsed = (datetime.utcnow() - latest.created_at).total_seconds()
        remaining = cooldown_seconds - elapsed
        return max(0, int(remaining))

    @classmethod
    def create_otp(cls, identifier, purpose=OTPPurpose.LOGIN, user_id=None, school_id=None,
                   expiry_minutes=DEFAULT_EXPIRY_MINUTES, cooldown_seconds=DEFAULT_COOLDOWN_SECONDS):
        """
        Creates and stores a new secure OTP record.
        Enforces resend cooldown and invalidates old active OTPs.
        
        Returns:
            tuple: (plain_otp, otp_record, error_message)
        """
        norm_id = str(identifier).strip().lower()

        # 1. Check cooldown
        remaining = cls.get_remaining_cooldown(norm_id, purpose, cooldown_seconds)
        if remaining > 0:
            return None, None, f"Please wait {remaining} seconds before requesting a new OTP."

        # 2. Invalidate previous active OTPs for this identifier & purpose
        OTPVerification.query.filter_by(
            identifier=norm_id,
            purpose=purpose,
            is_used=False
        ).update({'is_used': True, 'used_at': datetime.utcnow()})

        # 3. Generate new 6-digit OTP
        plain_otp = cls.generate_otp(6)
        otp_hash = cls.hash_otp(plain_otp)
        expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)

        otp_record = OTPVerification(
            identifier=norm_id,
            user_id=user_id,
            school_id=school_id,
            purpose=purpose,
            otp_hash=otp_hash,
            expires_at=expires_at,
            attempts=0,
            max_attempts=cls.DEFAULT_MAX_ATTEMPTS,
            is_used=False,
            created_at=datetime.utcnow()
        )

        db.session.add(otp_record)
        db.session.commit()

        return plain_otp, otp_record, None

    @classmethod
    def verify_otp(cls, identifier, raw_otp, purpose=OTPPurpose.LOGIN):
        """
        Verifies entered OTP against stored active hash.
        
        Returns:
            tuple: (is_valid: bool, message: str, otp_record: OTPVerification or None)
        """
        norm_id = str(identifier).strip().lower()
        clean_otp = str(raw_otp).strip()

        # Find latest OTP record for this identifier and purpose
        record = (
            OTPVerification.query
            .filter_by(identifier=norm_id, purpose=purpose)
            .order_by(OTPVerification.created_at.desc())
            .first()
        )

        if not record:
            return False, "No OTP request found. Please request an OTP first.", None

        if record.is_used:
            return False, "This OTP has already been used. Please request a new one.", record

        if datetime.utcnow() > record.expires_at:
            return False, "OTP has expired. Please request a new one.", record

        if record.attempts >= record.max_attempts:
            return False, "Maximum verification attempts exceeded. Please request a new OTP.", record

        # Increment attempt count
        record.attempts += 1

        # Check hash
        if not cls.verify_otp_hash(clean_otp, record.otp_hash):
            db.session.commit()
            remaining_attempts = max(0, record.max_attempts - record.attempts)
            if remaining_attempts > 0:
                msg = f"Invalid OTP. {remaining_attempts} attempt(s) remaining."
            else:
                msg = "Invalid OTP. Maximum attempts exceeded."
            return False, msg, record

        # Mark OTP as successfully verified and consumed
        record.is_used = True
        record.used_at = datetime.utcnow()
        db.session.commit()

        return True, "OTP verified successfully.", record


otp_service = OTPService
