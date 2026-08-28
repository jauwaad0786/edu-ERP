"""
Symmetric encryption for sensitive credentials and direct chat messages.
Uses Fernet (AES-128-CBC + HMAC) — industry-standard for this use case.

Key resolution:
1. Uses `ENCRYPTION_KEY` from environment variables if present.
2. Derives a deterministic Fernet key from `SECRET_KEY` as a secure fallback.
"""
import base64
import hashlib
import os
from cryptography.fernet import Fernet, InvalidToken


def _get_cipher():
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        secret = os.environ.get('SECRET_KEY', 'eduerp-production-secret-encryption-salt-2026')
        derived = hashlib.sha256(secret.encode('utf-8')).digest()
        key = base64.urlsafe_b64encode(derived).decode('utf-8')
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plain_text):
    if plain_text is None or plain_text == '':
        return None
    cipher = _get_cipher()
    return cipher.encrypt(plain_text.encode('utf-8')).decode('utf-8')


def decrypt_value(encrypted_text):
    if not encrypted_text:
        return None
    cipher = _get_cipher()
    try:
        return cipher.decrypt(encrypted_text.encode('utf-8')).decode('utf-8')
    except (InvalidToken, Exception):
        # Key changed or data is legacy plaintext — return None for safe fallback
        return None


def mask_token(plain_text, keep_start=4, keep_end=4):
    """EAAG**********************X3T style masking for UI display."""
    if not plain_text:
        return None
    if len(plain_text) <= keep_start + keep_end:
        return '*' * len(plain_text)
    middle = '*' * (len(plain_text) - keep_start - keep_end)
    return plain_text[:keep_start] + middle + plain_text[-keep_end:]
