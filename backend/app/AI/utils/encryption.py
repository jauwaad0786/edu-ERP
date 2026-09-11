"""
Encryption utility for API keys.
Uses Fernet (AES-128 CBC + HMAC-SHA256) derived from SECRET_KEY.
Uses unpredictable CSPRNG salt (python:S2053) stored with ciphertext.
API keys NEVER stored or returned as plaintext.
"""
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _get_secret() -> bytes:
    """Retrieve application SECRET_KEY for key derivation."""
    from flask import current_app
    secret = None
    try:
        if current_app:
            secret = current_app.config.get('SECRET_KEY')
    except Exception:
        pass
    if not secret:
        secret = os.environ.get('SECRET_KEY')
    if not secret:
        is_prod = os.environ.get('FLASK_ENV') == 'production' or os.environ.get('ENV') == 'production'
        if is_prod:
            raise RuntimeError("CRITICAL: SECRET_KEY must be set in production environment for AI encryption.")
        secret = os.environ.get('DEV_AI_SECRET', 'dev-local-ai-secret-do-not-use-in-prod')
    if isinstance(secret, str):
        secret = secret.encode('utf-8')
    return secret


def _get_legacy_salt() -> bytes:
    """
    Fallback salt for decrypting legacy records encrypted before v2.
    Maintains 100% backward compatibility for existing database records.
    """
    salt_val = os.environ.get('AI_ENCRYPTION_SALT')
    if not salt_val:
        from flask import current_app
        try:
            if current_app:
                salt_val = current_app.config.get('AI_ENCRYPTION_SALT')
        except Exception:
            pass
    if salt_val:
        return salt_val.encode('utf-8') if isinstance(salt_val, str) else salt_val

    fallback = os.environ.get('AI_FALLBACK_SALT', '1p360-ai-salt-v1')
    return fallback.encode('utf-8')


_get_salt = _get_legacy_salt


def _derive_fernet(salt: bytes) -> Fernet:
    """Derive Fernet instance using SECRET_KEY and given salt."""
    secret = _get_secret()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def _get_fernet() -> Fernet:
    """Legacy Fernet getter for backward compatibility."""
    return _derive_fernet(_get_legacy_salt())


def encrypt_secret(plain_text: str) -> str:
    """
    Encrypt an API key. Uses an unpredictable CSPRNG salt (python:S2053) per encryption.
    Format: 'v2$<base64_salt>$<fernet_token>'
    """
    if not plain_text:
        return ''
    salt = os.urandom(16)
    f = _derive_fernet(salt)
    token = f.encrypt(plain_text.encode('utf-8')).decode('utf-8')
    salt_b64 = base64.urlsafe_b64encode(salt).decode('utf-8')
    return f"v2${salt_b64}${token}"


def decrypt_secret(cipher_text: str) -> str:
    """
    Decrypt an encrypted API key.
    Supports both v2 format (with unpredictable salt) and legacy v1 format
    for 100% backward compatibility with previously stored database keys.
    """
    if not cipher_text:
        return ''
    try:
        if cipher_text.startswith('v2$'):
            parts = cipher_text.split('$', 2)
            if len(parts) == 3:
                salt = base64.urlsafe_b64decode(parts[1].encode('utf-8'))
                f = _derive_fernet(salt)
                return f.decrypt(parts[2].encode('utf-8')).decode('utf-8')

        # Fallback for legacy records
        f = _get_fernet()
        return f.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return ''
