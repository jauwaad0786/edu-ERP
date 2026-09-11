"""
Timezone and datetime utility.
Provides Python 3.12+ compliant UTC datetime retrieval (python:S6925)
while preserving naive UTC compatibility with database TIMESTAMP columns.
"""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Return current UTC time as a naive datetime object.
    Replaces deprecated datetime.utcnow() to prevent datetime pitfalls (python:S6925).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
