"""
Provider Factory
Resolves active provider from DB configuration.
Application code ONLY calls get_active_provider() — never OpenAI/Groq directly.
"""
from app.AI.providers.base_provider import AIProvider, AIProviderError
from app.AI.utils.encryption import decrypt_secret


def get_active_provider() -> AIProvider:
    """
    Load active AI provider config from DB (or env var fallback) and return a ready provider instance.
    This is the ONLY way to get a provider — keeps provider switching transparent.
    Raises AIProviderError if not configured.
    """
    import os
    from app.AI.models.ai_models import AIProviderConfig
    config = AIProviderConfig.query.filter_by(is_active=True).first()

    api_key = None
    provider_name = 'GROQ'
    model = 'llama-3.1-8b-instant'
    temperature = 0.3
    max_tokens = 800

    if config and config.key_configured and config.encrypted_api_key:
        api_key = decrypt_secret(config.encrypted_api_key)
        provider_name = (config.provider or 'GROQ').upper()
        model = config.model or 'llama-3.1-8b-instant'
        temperature = config.temperature if config.temperature is not None else 0.3
        max_tokens = config.max_tokens or 800

    # Fallback to environment variables if not configured in DB
    if not api_key:
        groq_env = os.environ.get('GROQ_API_KEY', '').strip()
        openai_env = os.environ.get('OPENAI_API_KEY', '').strip()
        if groq_env:
            api_key = groq_env
            provider_name = 'GROQ'
        elif openai_env:
            api_key = openai_env
            provider_name = 'OPENAI'
            model = 'gpt-4o-mini'

    if not api_key:
        raise AIProviderError(
            '1P360 BOT is not configured yet. Super Admin needs to set an API key in Developer Tools > 1P360 BOT Config.',
            'NO_CONFIG'
        )

    if provider_name == 'GROQ':
        from app.AI.providers.groq_provider import GroqProvider
        return GroqProvider(api_key=api_key, model=model,
                            temperature=temperature, max_tokens=max_tokens)
    elif provider_name == 'OPENAI':
        from app.AI.providers.openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=api_key, model=model,
                              temperature=temperature, max_tokens=max_tokens)
    else:
        raise AIProviderError(f'Unknown provider: {provider_name}', 'PROVIDER_ERROR')



def get_provider_for_config(provider_name: str, model: str, api_key: str) -> AIProvider:
    """Build a provider directly from given params — used for test_connection only."""
    provider_name = provider_name.upper()
    if provider_name == 'GROQ':
        from app.AI.providers.groq_provider import GroqProvider
        return GroqProvider(api_key=api_key, model=model)
    elif provider_name == 'OPENAI':
        from app.AI.providers.openai_provider import OpenAIProvider
        return OpenAIProvider(api_key=api_key, model=model)
    else:
        raise AIProviderError(f'Unknown provider: {provider_name}', 'PROVIDER_ERROR')
