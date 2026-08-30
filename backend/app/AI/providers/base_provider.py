"""
Provider Abstraction Base Class
All providers (OpenAI, Groq) must implement this interface.
Application code calls AIProvider.generate() — never OpenAI/Groq directly.
"""
from abc import ABC, abstractmethod
from typing import Optional, Generator


class AIProvider(ABC):
    """Abstract base class. All providers implement this interface."""

    @abstractmethod
    def generate(self,
                 system_prompt: str,
                 user_message: str,
                 conversation_history: list = None,
                 temperature: float = 0.3,
                 max_tokens: int = 800) -> dict:
        """
        Generate a non-streaming response.

        Returns:
        {
            'content': str,       # The generated text
            'prompt_tokens': int,
            'completion_tokens': int,
            'total_tokens': int,
            'model': str,
            'provider': str,
            'latency_ms': int,
        }
        Raises: AIProviderError on any failure.
        """
        pass

    @abstractmethod
    def test_connection(self) -> dict:
        """
        Send a trivial test prompt ('Reply with OK.') to verify API key and connectivity.
        Returns: {'success': bool, 'latency_ms': int, 'message': str, 'model': str}
        MUST NOT raise — returns error details in dict.
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """e.g. 'GROQ' or 'OPENAI'"""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """e.g. 'llama-3.3-70b-versatile'"""
        pass


class AIProviderError(Exception):
    """Base exception for all AI provider errors."""
    def __init__(self, message: str, error_type: str = 'PROVIDER_ERROR', retryable: bool = False):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable

    def to_user_message(self) -> str:
        """Safe user-facing message — NEVER exposes API keys, stack traces, or internals."""
        type_messages = {
            'INVALID_API_KEY':   'AI service configuration error. Please contact your administrator.',
            'RATE_LIMIT':        'AI service is busy. Please try again in a moment.',
            'TIMEOUT':           'AI response took too long. Please try again.',
            'QUOTA_EXCEEDED':    'Daily AI query limit reached. Please try again tomorrow.',
            'NO_CONFIG':         'AI service is not configured yet. Please contact your administrator.',
            'PROVIDER_ERROR':    'AI service temporarily unavailable. Please try again shortly.',
        }
        return type_messages.get(self.error_type, 'AI service temporarily unavailable.')
