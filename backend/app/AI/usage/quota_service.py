"""
Quota & Usage Service
Backend-enforced daily limits. Frontend enforcement alone is NOT accepted.
Tracks per-user, per-role, per-school usage.
"""
from datetime import datetime, date
from app import db
from app.AI.models.ai_models import AIUsage, AIRoleQuota
from app.AI.config.ai_config import DEFAULT_QUOTAS
from app.AI.providers.base_provider import AIProviderError


def get_daily_limit(role: str, school_id: int = None) -> int:
    """
    Get the daily AI query limit for a given role.
    Precedence: school-specific override > global default from DB > hardcoded fallback.
    """
    # 1. School-specific override
    if school_id:
        quota = AIRoleQuota.query.filter_by(school_id=school_id, role=role, is_active=True).first()
        if quota:
            return quota.daily_limit

    # 2. Global default from DB
    quota = AIRoleQuota.query.filter_by(school_id=None, role=role, is_active=True).first()
    if quota:
        return quota.daily_limit

    # 3. Hardcoded config fallback
    return DEFAULT_QUOTAS.get(role, 20)


def get_usage_today(user_id: int) -> int:
    """Count how many successful AI queries this user has made today."""
    today = date.today()
    count = AIUsage.query.filter(
        AIUsage.user_id == user_id,
        AIUsage.date == today,
        AIUsage.success == True,
        AIUsage.cache_hit == False,  # Cache hits don't count against quota
    ).count()
    return count


def check_quota(user_id: int, role: str, school_id: int = None) -> dict:
    """
    Check if user has remaining quota.
    Returns: {'allowed': bool, 'used': int, 'limit': int, 'remaining': int}
    """
    limit = get_daily_limit(role, school_id)
    used  = get_usage_today(user_id)
    remaining = max(0, limit - used)
    return {
        'allowed':   used < limit,
        'used':      used,
        'limit':     limit,
        'remaining': remaining,
    }


def enforce_quota(user_id: int, role: str, school_id: int = None):
    """
    Raise AIProviderError with QUOTA_EXCEEDED if limit is reached.
    Call this BEFORE making any AI provider call.
    """
    quota = check_quota(user_id, role, school_id)
    if not quota['allowed']:
        raise AIProviderError(
            f"Daily AI query limit reached ({quota['used']}/{quota['limit']}). "
            f"Please try again tomorrow.",
            'QUOTA_EXCEEDED'
        )


def log_usage(user_id: int, role: str, school_id: int = None,
              intent: str = None, provider: str = None, model: str = None,
              intent_ms: int = None, db_ms: int = None,
              llm_ms: int = None, total_ms: int = None,
              prompt_tokens: int = None, completion_tokens: int = None,
              total_tokens: int = None, estimated_cost: float = None,
              cache_hit: bool = False, success: bool = True,
              error_type: str = None) -> AIUsage:
    """Log a single AI query event for analytics and quota tracking."""
    # Estimate cost from token usage if possible
    if not estimated_cost and total_tokens and provider and model:
        from app.AI.config.ai_config import PROVIDERS
        provider_info = PROVIDERS.get(provider, {})
        models_list   = provider_info.get('models', [])
        model_info    = next((m for m in models_list if m['id'] == model), None)
        if model_info and prompt_tokens and completion_tokens:
            cost = (
                prompt_tokens     / 1000 * model_info.get('cost_per_1k_prompt', 0) +
                completion_tokens / 1000 * model_info.get('cost_per_1k_completion', 0)
            )
            estimated_cost = round(cost, 8)

    usage = AIUsage(
        school_id=school_id,
        user_id=user_id,
        role=role,
        date=date.today(),
        intent=intent,
        provider=provider,
        model=model,
        intent_ms=intent_ms,
        db_ms=db_ms,
        llm_ms=llm_ms,
        total_ms=total_ms,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost,
        cache_hit=cache_hit,
        success=success,
        error_type=error_type,
    )
    db.session.add(usage)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
    return usage
