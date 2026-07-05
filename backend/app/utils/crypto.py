"""
Symmetric encryption for sensitive credentials (WhatsApp access tokens, app secrets, etc.)
Uses Fernet (AES-128-CBC + HMAC) — industry-standard for this use case.

IMPORTANT: Set ENCRYPTION_KEY in your .env / Render environment variables.
Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

If ENCRYPTION_KEY is missing, encrypt/decrypt will raise at call-time (not at import-time),
so the rest of the app keeps working until someone actually tries to save a credential.
"""
import os
from cryptography.fernet import Fernet, InvalidToken


def _get_cipher():
    key = os.environ.get('ENCRYPTION_KEY')
    if not key:
        raise RuntimeError(
            'ENCRYPTION_KEY env var is not set. Generate one with: '
            'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" '
            'and add it to your environment variables.'
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(plain_text):
    if plain_text is None or plain_text == '':
        return None
    cipher = _get_cipher()
    return cipher.encrypt(plain_text.encode()).decode()


def decrypt_value(encrypted_text):
    if not encrypted_text:
        return None
    cipher = _get_cipher()
    try:
        return cipher.decrypt(encrypted_text.encode()).decode()
    except InvalidToken:
        # Key changed or data corrupted — don't crash the whole request
        return None


def mask_token(plain_text, keep_start=4, keep_end=4):
    """EAAG**********************X3T style masking for UI display."""
    if not plain_text:
        return None
    if len(plain_text) <= keep_start + keep_end:
        return '*' * len(plain_text)
    middle = '*' * (len(plain_text) - keep_start - keep_end)
    return plain_text[:keep_start] + middle + plain_text[-keep_end:]
