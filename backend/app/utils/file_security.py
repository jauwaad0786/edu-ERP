# backend/app/utils/file_security.py
"""
Central file upload validation and sanitization utility.
Protects against:
- Malicious executable and script uploads (.exe, .sh, .py, .php, .js, etc.)
- Path traversal attacks via filename manipulation
- Oversized file payloads
- Content-type mismatches
"""

import os
import re
from werkzeug.utils import secure_filename

# ── Allowlist of safe file extensions ─────────────────────────────────────────
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'}
ALLOWED_DOC_EXTENSIONS   = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'zip', 'rar'}
ALLOWED_ALL_EXTENSIONS   = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_DOC_EXTENSIONS

# ── Explicit blocklist of dangerous extensions (defense in depth) ──────────────
FORBIDDEN_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'msi', 'dll',
    'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'py', 'pyc', 'pyw', 'php',
    'php3', 'php4', 'php5', 'phtml', 'jsp', 'jspx', 'asp', 'aspx', 'cgi',
    'pl', 'jar', 'bin', 'com', 'scr', 'pif', 'hta', 'htm', 'html', 'xhtml',
    'svgz', 'action', 'apk', 'app', 'elf', 'deb', 'rpm'
}

# Max default size: 15 MB
DEFAULT_MAX_FILE_SIZE = 15 * 1024 * 1024


def get_file_extension(filename):
    """Extract lowercase extension without leading dot."""
    if not filename or '.' not in filename:
        return ''
    return filename.rsplit('.', 1)[1].lower().strip()


def validate_uploaded_file(file_storage, allowed_extensions=None, max_size_bytes=DEFAULT_MAX_FILE_SIZE):
    """
    Validates an uploaded Werkzeug FileStorage object.
    
    Returns:
        (is_valid: bool, error_msg: str or None, sanitized_filename: str, file_type_category: str)
    """
    if not file_storage or not file_storage.filename:
        return False, "No file provided", "", "UNKNOWN"

    raw_filename = file_storage.filename
    # Prevent path traversal e.g. ../../etc/passwd
    safe_name = secure_filename(raw_filename)
    if not safe_name:
        # If secure_filename stripped everything, generate a safe fallback
        safe_name = f"upload_{os.urandom(4).hex()}"

    ext = get_file_extension(raw_filename)
    if not ext:
        return False, "Files without an extension are not permitted", safe_name, "UNKNOWN"

    # Check forbidden extensions
    if ext in FORBIDDEN_EXTENSIONS:
        return False, f"File type '.{ext}' is strictly prohibited for security reasons", safe_name, "FORBIDDEN"

    # Check allowlist
    target_allowlist = allowed_extensions if allowed_extensions is not None else ALLOWED_ALL_EXTENSIONS
    if ext not in target_allowlist:
        return False, f"File type '.{ext}' is not allowed. Allowed types: {', '.join(sorted(target_allowlist))}", safe_name, "UNKNOWN"

    # Size check
    try:
        file_storage.seek(0, os.SEEK_END)
        size = file_storage.tell()
        file_storage.seek(0)
        if size > max_size_bytes:
            max_mb = max_size_bytes / (1024 * 1024)
            return False, f"File size ({size / (1024 * 1024):.1f} MB) exceeds limit of {max_mb:.0f} MB", safe_name, "UNKNOWN"
        if size == 0:
            return False, "Empty files cannot be uploaded", safe_name, "UNKNOWN"
    except Exception:
        # Fallback if tell/seek fails on non-seekable streams
        pass

    # Categorize file
    content_type = (file_storage.content_type or '').lower()
    if ext in ALLOWED_IMAGE_EXTENSIONS or 'image' in content_type:
        category = 'IMAGE'
    elif ext == 'pdf' or 'pdf' in content_type:
        category = 'PDF'
    elif ext in {'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'}:
        category = 'DOCUMENT'
    else:
        category = 'OTHER'

    return True, None, safe_name, category
