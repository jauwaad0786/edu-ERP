"""
Encryption utility for API keys.
Uses Fernet (AES-128 CBC + HMAC-SHA256) derived from SECRET_KEY.
API keys NEVER stored or returned as plaintext.
"""
import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _get_fernet() -> Fernet:
    """Derive a Fernet key from Flask's SECRET_KEY."""
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

    # Use a fixed salt for key derivation
    salt = b'1p360-ai-salt-v1'

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def encrypt_secret(plain_text: str) -> str:
    """Encrypt an API key. Returns base64 ciphertext."""
    if not plain_text:
        return ''
    f = _get_fernet()
    return f.encrypt(plain_text.encode('utf-8')).decode('utf-8')


def decrypt_secret(cipher_text: str) -> str:
    """Decrypt an encrypted API key. Returns plaintext, or '' on failure."""
    if not cipher_text:
        return ''
    try:
        f = _get_fernet()
        return f.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception:
        return ''
