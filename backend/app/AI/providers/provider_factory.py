"""
Provider Factory
Resolves active provider from DB configuration.
Application code ONLY calls get_active_provider() — never OpenAI/Groq directly.
"""
from app.AI.providers.base_provider import AIProvider, AIProviderError
from app.AI.utils.encryption import decrypt_secret


def get_active_provider() -> AIProvider:
    """
    Load active AI provider config from DB and return a ready provider instance.
    This is the ONLY way to get a provider — keeps provider switching transparent.
    Raises AIProviderError if not configured.
    """
    from app.AI.models.ai_models import AIProviderConfig
    config = AIProviderConfig.query.filter_by(is_active=True).first()

    if not config:
        raise AIProviderError('AI not configured yet.', 'NO_CONFIG')

    if not config.key_configured or not config.encrypted_api_key:
        raise AIProviderError('AI API key not configured.', 'NO_CONFIG')

    api_key = decrypt_secret(config.encrypted_api_key)
    if not api_key:
        raise AIProviderError('AI API key could not be decrypted.', 'NO_CONFIG')

    provider_name = (config.provider or 'GROQ').upper()
    model         = config.model or 'llama-3.3-70b-versatile'
    temperature   = config.temperature or 0.3
    max_tokens    = config.max_tokens or 800

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
