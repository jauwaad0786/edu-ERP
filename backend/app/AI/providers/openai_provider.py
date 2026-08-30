"""
OpenAI Provider Implementation
Supports GPT-4o-mini (default), GPT-4o, GPT-3.5-turbo
"""
import time
from app.AI.providers.base_provider import AIProvider, AIProviderError


class OpenAIProvider(AIProvider):
    """OpenAI GPT provider."""

    def __init__(self, api_key: str, model: str = 'gpt-4o-mini',
                 temperature: float = 0.3, max_tokens: int = 800):
        if not api_key:
            raise AIProviderError('OpenAI API key not configured.', 'NO_CONFIG')
        self._api_key    = api_key
        self._model      = model
        self._temperature = temperature
        self._max_tokens  = max_tokens

    @property
    def provider_name(self) -> str:
        return 'OPENAI'

    @property
    def model_name(self) -> str:
        return self._model

    def _get_client(self):
        try:
            from openai import OpenAI
            return OpenAI(api_key=self._api_key)
        except ImportError:
            raise AIProviderError(
                'OpenAI Python library not installed. Run: pip install openai',
                'PROVIDER_ERROR'
            )

    def generate(self, system_prompt: str, user_message: str,
                 conversation_history: list = None,
                 temperature: float = None,
                 max_tokens: int = None) -> dict:
        client = self._get_client()
        temp   = temperature if temperature is not None else self._temperature
        mtok   = max_tokens  if max_tokens  is not None else self._max_tokens

        messages = [{'role': 'system', 'content': system_prompt}]

        if conversation_history:
            for m in conversation_history[-6:]:
                messages.append({'role': m['role'], 'content': m['content']})

        messages.append({'role': 'user', 'content': user_message})

        t_start = time.monotonic()
        try:
            resp = client.chat.completions.create(
                model=self._model,
                messages=messages,
                temperature=temp,
                max_tokens=mtok,
            )
        except Exception as e:
            err_str = str(e).lower()
            if 'api_key' in err_str or 'authentication' in err_str or 'incorrect api key' in err_str:
                raise AIProviderError('Invalid OpenAI API key.', 'INVALID_API_KEY')
            if 'rate_limit' in err_str:
                raise AIProviderError('OpenAI rate limit.', 'RATE_LIMIT', retryable=True)
            if 'timeout' in err_str:
                raise AIProviderError('OpenAI timeout.', 'TIMEOUT', retryable=True)
            raise AIProviderError(f'OpenAI error: {type(e).__name__}', 'PROVIDER_ERROR')

        latency_ms = int((time.monotonic() - t_start) * 1000)
        choice     = resp.choices[0]
        usage      = resp.usage

        return {
            'content':           choice.message.content,
            'prompt_tokens':     getattr(usage, 'prompt_tokens', 0),
            'completion_tokens': getattr(usage, 'completion_tokens', 0),
            'total_tokens':      getattr(usage, 'total_tokens', 0),
            'model':             self._model,
            'provider':          'OPENAI',
            'latency_ms':        latency_ms,
        }

    def test_connection(self) -> dict:
        t_start = time.monotonic()
        try:
            result = self.generate(
                system_prompt='You are a test assistant.',
                user_message='Reply with exactly: OK',
                max_tokens=10,
                temperature=0,
            )
            latency_ms = int((time.monotonic() - t_start) * 1000)
            return {
                'success':    True,
                'latency_ms': latency_ms,
                'message':    f"Connected ✓ | Model: {self._model} | Response: {result['content'][:30]}",
                'model':      self._model,
                'provider':   'OPENAI',
            }
        except AIProviderError as e:
            return {
                'success':    False,
                'latency_ms': int((time.monotonic() - t_start) * 1000),
                'message':    e.to_user_message(),
                'provider':   'OPENAI',
            }
        except Exception:
            return {
                'success':    False,
                'latency_ms': int((time.monotonic() - t_start) * 1000),
                'message':    'Connection failed.',
                'provider':   'OPENAI',
            }
