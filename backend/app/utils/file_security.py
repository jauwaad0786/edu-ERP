"""
File Upload Security & Content Validation Layer
Enforces:
1. Strict file extension allowlists by media type (image, document, pdf, etc.)
2. Filename sanitization via secure_filename (prevents path traversal)
3. File size limits (rejects oversized payloads)
4. Magic byte signature verification (prevents MIME spoofing & executable uploads)
5. Explicit blocklist for dangerous/executable files (SVG/HTML/PHP/EXE/etc.)
"""
import os
from werkzeug.utils import secure_filename

# Default limits
DEFAULT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024    # 5 MB
DEFAULT_DOC_MAX_SIZE_BYTES   = 25 * 1024 * 1024   # 25 MB

ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
ALLOWED_PDF_EXTENSIONS   = {'pdf'}
ALLOWED_DOC_EXTENSIONS   = {'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'csv', 'zip'}

# Explicitly disallowed extensions (XSS / RCE vectors)
DISALLOWED_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5', 'py', 'pl',
    'cgi', 'js', 'vbs', 'jar', 'msi', 'com', 'scr', 'hta', 'ps1', 'dll', 'so',
    'bin', 'apk', 'app', 'dmg', 'iso', 'jsp', 'asp', 'aspx', 'svg', 'html', 'htm'
}

# Magic signatures
MAGIC_SIGNATURES = {
    'png': [b'\x89PNG\r\n\x1a\n'],
    'jpg': [b'\xff\xd8\xff'],
    'jpeg': [b'\xff\xd8\xff'],
    'gif': [b'GIF87a', b'GIF89a'],
    'pdf': [b'%PDF-'],
    'docx': [b'PK\x03\x04'],
    'xlsx': [b'PK\x03\x04'],
    'pptx': [b'PK\x03\x04'],
    'zip': [b'PK\x03\x04'],
    'doc': [b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'],
    'xls': [b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'],
    'ppt': [b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'],
}


def validate_and_sanitize_upload(file_storage, allowed_types=('image',), max_size_bytes=None):
    """
    Validates an uploaded file:
      - Non-empty filename
      - secure_filename sanitization
      - Extension allowlist verification
      - File size limit
      - Magic byte signature checking
    Returns (sanitized_filename, extension, size_bytes).
    Raises ValueError on validation failure.
    """
    if not file_storage or not getattr(file_storage, 'filename', None):
        raise ValueError("No file uploaded or missing filename")

    raw_filename = file_storage.filename.strip()
    if not raw_filename or '.' not in raw_filename:
        raise ValueError("File must have a valid filename with an extension")

    sanitized = secure_filename(raw_filename)
    if not sanitized or '.' not in sanitized:
        raise ValueError("Invalid file name")

    ext = sanitized.rsplit('.', 1)[1].lower()

    if ext in DISALLOWED_EXTENSIONS:
        raise ValueError(f"File extension .{ext} is prohibited for security reasons")

    # Build allowed extensions set
    allowed_extensions = set()
    for cat in allowed_types:
        cat_lower = cat.lower()
        if cat_lower == 'image':
            allowed_extensions.update(ALLOWED_IMAGE_EXTENSIONS)
        elif cat_lower == 'pdf':
            allowed_extensions.update(ALLOWED_PDF_EXTENSIONS)
        elif cat_lower in ('doc', 'document'):
            allowed_extensions.update(ALLOWED_DOC_EXTENSIONS)

    if ext not in allowed_extensions:
        raise ValueError(f"File extension .{ext} is not allowed. Permitted: {sorted(list(allowed_extensions))}")

    # Determine size limit
    if max_size_bytes is None:
        if 'document' in allowed_types or 'doc' in allowed_types:
            max_size_bytes = DEFAULT_DOC_MAX_SIZE_BYTES
        else:
            max_size_bytes = DEFAULT_IMAGE_MAX_SIZE_BYTES

    # Check size
    file_storage.seek(0, os.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)

    if size == 0:
        raise ValueError("Uploaded file is empty (0 bytes)")

    if size > max_size_bytes:
        mb_limit = max_size_bytes // (1024 * 1024)
        raise ValueError(f"File size exceeds the {mb_limit} MB limit ({size // (1024 * 1024)} MB)")

    # Check magic byte signatures (if applicable)
    header = file_storage.read(16)
    file_storage.seek(0)

    if ext == 'webp':
        if not (header.startswith(b'RIFF') and header[8:12] == b'WEBP'):
            raise ValueError("File contents do not match WebP image signature")
    elif ext in MAGIC_SIGNATURES:
        signatures = MAGIC_SIGNATURES[ext]
        if not any(header.startswith(sig) for sig in signatures):
            raise ValueError(f"File contents do not match expected signature for .{ext}")

    return sanitized, ext, size


def validate_uploaded_file(file_storage, allowed_types=('image', 'pdf', 'document'), max_size_bytes=None):
    """
    Convenience wrapper returning (is_valid: bool, err_msg: str, safe_name: str, file_category: str).
    Matches caller contract in chat and tickets routes.
    """
    try:
        safe_name, ext, size = validate_and_sanitize_upload(
            file_storage,
            allowed_types=allowed_types,
            max_size_bytes=max_size_bytes
        )
        cat = 'image' if ext in ALLOWED_IMAGE_EXTENSIONS else ('pdf' if ext in ALLOWED_PDF_EXTENSIONS else 'document')
        return True, None, safe_name, cat
    except ValueError as ve:
        return False, str(ve), None, None
    except Exception as ex:
        return False, f"Invalid file: {str(ex)}", None, None


def is_safe_public_url(url: str) -> bool:
    """Validate that the URL is public and does not point to internal networks or loopback (SSRF protection)."""
    if not url or not isinstance(url, str):
        return False
    try:
        import socket
        import ipaddress
        from urllib.parse import urlparse
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        host = parsed.hostname
        if not host:
            return False
        host_lower = host.lower()
        if host_lower in ('localhost', 'metadata.google.internal') or host_lower.endswith('.internal') or host_lower.endswith('.local'):
            return False
        addr_info = socket.getaddrinfo(host, None)
        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


def fetch_safe_remote_image(url: str, timeout: int = 3, max_bytes: int = 5 * 1024 * 1024):
    """
    Safely fetch remote image bytes with SSRF checks, timeout, and size limits.
    Returns bytes or None on failure.
    """
    if not url or not is_safe_public_url(url):
        return None
    try:
        import requests
        resp = requests.get(
            url,
            timeout=timeout,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
            stream=True
        )
        if resp.status_code == 200:
            content = b''
            for chunk in resp.iter_content(chunk_size=32768):
                content += chunk
                if len(content) > max_bytes:
                    return None
            return content
    except Exception:
        pass
    return None


