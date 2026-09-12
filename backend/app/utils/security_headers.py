"""
Security Headers and CORS Validation Utility for 1P360 / EduERP
Protects against:
- Arbitrary origin reflection (CWE-942 / SonarQube S5122)
- Clickjacking (X-Frame-Options)
- MIME sniffing (X-Content-Type-Options)
- Insecure referrer leakage (Referrer-Policy)
"""

import os

DEFAULT_ALLOWED_ORIGINS = {
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
}


def get_allowed_origins():
    origins = set(DEFAULT_ALLOWED_ORIGINS)
    for env_var in ('FRONTEND_URL', 'CORS_ALLOWED_ORIGINS', 'EXTRA_CORS_ORIGINS'):
        val = os.environ.get(env_var, '').strip()
        if val:
            for item in val.split(','):
                cleaned = item.strip().rstrip('/')
                if cleaned:
                    origins.add(cleaned)
    return origins


import re

# Strict regex matching authorized deployment prefixes on vercel.app and onrender.com
# Example: https://edu-erp.vercel.app, https://edu-erp-prod.vercel.app, https://1p360-app.onrender.com
# Rejecting arbitrary attacker domains like attacker-edu-erp.com or random words
STRICT_HOSTING_PATTERN = re.compile(
    r'^https://(edu-erp|1p360)(-[a-zA-Z0-9]+)?\.(vercel\.app|onrender\.com)$',
    re.IGNORECASE
)


def is_cors_origin_allowed(origin):
    """Validate if the Origin header is an explicitly trusted domain."""
    if not origin:
        return False
    clean_origin = origin.strip().rstrip('/')
    allowed = get_allowed_origins()
    if clean_origin in allowed:
        return True
    # Allow official verified Render and Vercel school ERP deployments strictly matching approved pattern
    if STRICT_HOSTING_PATTERN.match(clean_origin):
        return True
    return False


def apply_security_headers(response):
    """Apply standard HTTP security hardening headers."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=()'
    return response
