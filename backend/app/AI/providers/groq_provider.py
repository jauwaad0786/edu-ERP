"""
Groq Provider Implementation
Ultra-fast inference using Llama 3.3 70B and Mixtral models.
"""
import time
from app.AI.providers.base_provider import AIProvider, AIProviderError


class GroqProvider(AIProvider):
    """Groq LPU inference engine — fastest available for school ERP queries."""

    def __init__(self, api_key: str, model: str = 'llama-3.3-70b-versatile',
                 temperature: float = 0.3, max_tokens: int = 800):
        if not api_key:
            raise AIProviderError('Groq API key not configured.', 'NO_CONFIG')
        self._api_key = api_key
        self._model   = model
        self._temperature = temperature
        self._max_tokens  = max_tokens

    @property
    def provider_name(self) -> str:
        return 'GROQ'

    @property
    def model_name(self) -> str:
        return self._model

    def _get_client(self):
        try:
            from groq import Groq
            return Groq(api_key=self._api_key)
        except ImportError:
            raise AIProviderError(
                'Groq Python library not installed. Run: pip install groq',
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

        # Add compact conversation history (last 6 turns max to save tokens)
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
            if 'api_key' in err_str or 'authentication' in err_str or 'unauthorized' in err_str or '401' in err_str:
                raise AIProviderError(f'Invalid Groq API key: {str(e)}', 'INVALID_API_KEY')
            if 'rate_limit' in err_str or 'rate limit' in err_str or '429' in err_str:
                raise AIProviderError('Groq rate limit exceeded. Please wait a moment.', 'RATE_LIMIT', retryable=True)
            if 'timeout' in err_str or 'timed out' in err_str:
                raise AIProviderError('Groq connection timed out. Please try again.', 'TIMEOUT', retryable=True)
            raise AIProviderError(f'Groq provider error: {str(e)}', 'PROVIDER_ERROR')

        latency_ms = int((time.monotonic() - t_start) * 1000)
        choice     = resp.choices[0]
        usage      = resp.usage

        return {
            'content':           choice.message.content,
            'prompt_tokens':     getattr(usage, 'prompt_tokens', 0),
            'completion_tokens': getattr(usage, 'completion_tokens', 0),
            'total_tokens':      getattr(usage, 'total_tokens', 0),
            'model':             self._model,
            'provider':          'GROQ',
            'latency_ms':        latency_ms,
        }

    def list_available_models(self) -> list:
        """Fetch active models from Groq account."""
        try:
            client = self._get_client()
            models_res = client.models.list()
            chat_models = []
            for m in getattr(models_res, 'data', []):
                mid = getattr(m, 'id', str(m))
                if not any(x in mid.lower() for x in ['whisper', 'embed', 'guard', 'tts', 'audio']):
                    chat_models.append({'id': mid, 'label': mid})
            return sorted(chat_models, key=lambda x: x['id'])
        except Exception:
            return []

    def test_connection(self) -> dict:
        t_start = time.monotonic()
        
        # 1. First try configured model
        try:
            result = self.generate(
                system_prompt='You are a test assistant.',
                user_message='Reply with exactly: OK',
                max_tokens=10,
                temperature=0,
            )
            latency_ms = int((time.monotonic() - t_start) * 1000)
            avail_models = self.list_available_models()
            return {
                'success':          True,
                'latency_ms':       latency_ms,
                'message':          f"Connected ✓ | Model: {self._model} | Response: {result['content'][:30].strip()}",
                'model':            self._model,
                'provider':         'GROQ',
                'available_models': avail_models,
            }
        except Exception as initial_err:
            # 2. If model not found or decommissioned, discover available models from Groq
            avail_models = self.list_available_models()
            if avail_models:
                # Try testing with the first discovered active model
                for cand in avail_models:
                    try:
                        self._model = cand['id']
                        result = self.generate(
                            system_prompt='You are a test assistant.',
                            user_message='Reply with exactly: OK',
                            max_tokens=10,
                            temperature=0,
                        )
                        latency_ms = int((time.monotonic() - t_start) * 1000)
                        return {
                            'success':          True,
                            'latency_ms':       latency_ms,
                            'message':          f"Connected ✓ (Switched to active model: {cand['id']})",
                            'model':            cand['id'],
                            'provider':         'GROQ',
                            'available_models': avail_models,
                        }
                    except Exception:
                        continue

            return {
                'success':          False,
                'latency_ms':       int((time.monotonic() - t_start) * 1000),
                'message':          str(initial_err),
                'provider':         'GROQ',
                'available_models': avail_models,
            }


