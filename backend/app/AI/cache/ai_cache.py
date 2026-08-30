"""
AI Query Cache Service
School-scoped 2-layer cache (exact + normalized).
School A's cache NEVER returned to School B.
"""
import json
import hashlib
from datetime import datetime, timedelta
from app import db
from app.AI.models.ai_models import AIQueryCache
from app.AI.config.ai_config import CACHE_TTL_SECONDS


def _make_cache_key(normalized_query: str) -> str:
    return normalized_query.lower().strip()


def _params_hash(params: dict) -> str:
    s = json.dumps(params, sort_keys=True)
    return hashlib.sha256(s.encode()).hexdigest()[:16]


def get_ttl_seconds(intent: str) -> int:
    """Get TTL for an intent category."""
    ttl_map = {
        'FEE_COLLECTION':       CACHE_TTL_SECONDS['FEES'],
        'FEE_OUTSTANDING':      CACHE_TTL_SECONDS['FEES'],
        'FEE_COMPARISON':       CACHE_TTL_SECONDS['FEES'],
        'FEE_PENDING_STUDENTS': CACHE_TTL_SECONDS['FEES'],
        'TRANSPORT_FEE':        CACHE_TTL_SECONDS['FEES'],
        'HOSTEL_FEE':           CACHE_TTL_SECONDS['FEES'],
        'LIBRARY_FINES':        CACHE_TTL_SECONDS['LIBRARY'],
        'ATTENDANCE_TODAY':     CACHE_TTL_SECONDS['ATTENDANCE'],
        'ATTENDANCE_CLASSWISE': CACHE_TTL_SECONDS['ATTENDANCE'],
        'ATTENDANCE_TREND':     CACHE_TTL_SECONDS['ATTENDANCE'],
        'LOW_ATTENDANCE_STUDENTS': CACHE_TTL_SECONDS['ATTENDANCE'],
        'TOP_STUDENTS':         CACHE_TTL_SECONDS['ACADEMIC'],
        'WEAK_STUDENTS':        CACHE_TTL_SECONDS['ACADEMIC'],
        'CLASS_PERFORMANCE':    CACHE_TTL_SECONDS['ACADEMIC'],
        'EXAM_RESULTS':         CACHE_TTL_SECONDS['ACADEMIC'],
        'TRANSPORT_SUMMARY':    CACHE_TTL_SECONDS['TRANSPORT'],
        'HOSTEL_SUMMARY':       CACHE_TTL_SECONDS['HOSTEL'],
        'LIBRARY_SUMMARY':      CACHE_TTL_SECONDS['LIBRARY'],
        'SCHOOL_SUMMARY':       CACHE_TTL_SECONDS['GENERAL'],
    }
    return ttl_map.get(intent, CACHE_TTL_SECONDS['GENERAL'])


def lookup_cache(school_id: int, normalized_query: str,
                 params: dict = None, permission_scope: str = 'SCHOOL',
                 scope_user_id: int = None) -> AIQueryCache | None:
    """
    Look up a valid cache entry.
    CRITICAL: school_id + permission_scope + scope_user_id enforced.
    Returns None if not found or expired.
    """
    key  = _make_cache_key(normalized_query)
    phash = _params_hash(params or {})

    q = AIQueryCache.query.filter(
        AIQueryCache.school_id        == school_id,
        AIQueryCache.normalized_query == key,
        AIQueryCache.parameters_hash  == phash,
        AIQueryCache.permission_scope == permission_scope,
        AIQueryCache.expires_at       >  datetime.utcnow(),
    )

    # For USER-scoped cache, match user exactly
    if permission_scope == 'USER' and scope_user_id:
        q = q.filter(AIQueryCache.scope_user_id == scope_user_id)
    elif permission_scope == 'SCHOOL':
        # School-level cache — no user scope needed
        pass

    entry = q.first()

    if entry:
        # Increment hit count
        entry.hit_count = (entry.hit_count or 0) + 1
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
        return entry

    return None


def write_cache(school_id: int, normalized_query: str, intent: str,
                response_json: dict, answer_text: str = None,
                params: dict = None, permission_scope: str = 'SCHOOL',
                scope_user_id: int = None) -> AIQueryCache:
    """Write a new cache entry, or update existing one."""
    key    = _make_cache_key(normalized_query)
    phash  = _params_hash(params or {})
    ttl    = get_ttl_seconds(intent)
    exp    = datetime.utcnow() + timedelta(seconds=ttl)

    # Upsert — replace if exists for same key
    existing = AIQueryCache.query.filter(
        AIQueryCache.school_id        == school_id,
        AIQueryCache.normalized_query == key,
        AIQueryCache.parameters_hash  == phash,
        AIQueryCache.permission_scope == permission_scope,
    )
    if permission_scope == 'USER' and scope_user_id:
        existing = existing.filter(AIQueryCache.scope_user_id == scope_user_id)
    existing = existing.first()

    if existing:
        existing.response_json  = json.dumps(response_json)
        existing.answer_text    = answer_text
        existing.expires_at     = exp
        existing.intent         = intent
        existing.hit_count      = 0
        entry = existing
    else:
        entry = AIQueryCache(
            school_id        = school_id,
            normalized_query = key,
            intent           = intent,
            parameters_hash  = phash,
            response_json    = json.dumps(response_json),
            answer_text      = answer_text,
            permission_scope = permission_scope,
            scope_user_id    = scope_user_id,
            expires_at       = exp,
            hit_count        = 0,
        )
        db.session.add(entry)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return entry


def build_normalized_key(intent: str, params: dict) -> str:
    """Build a deterministic cache key from intent + params."""
    parts = [intent.lower()]
    for k in sorted(params.keys()):
        v = params[k]
        if v is not None:
            parts.append(f"{k}={v}")
    return '|'.join(parts)


def purge_expired_cache(school_id: int = None):
    """Remove expired cache entries (can be run periodically)."""
    q = AIQueryCache.query.filter(AIQueryCache.expires_at <= datetime.utcnow())
    if school_id:
        q = q.filter(AIQueryCache.school_id == school_id)
    count = q.delete()
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
    return count
