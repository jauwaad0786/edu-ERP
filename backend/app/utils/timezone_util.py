from datetime import datetime, timezone, timedelta, date

# Indian Standard Time (IST) is UTC+05:30 (Asia/Kolkata)
IST = timezone(timedelta(hours=5, minutes=30), name='Asia/Kolkata')


def utc_now() -> datetime:
    """
    Return current UTC time as a naive datetime object.
    Replaces deprecated datetime.utcnow() to prevent datetime pitfalls (python:S6925).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def ist_now() -> datetime:
    """Return current Indian Standard Time (IST, UTC+05:30) as timezone-aware datetime."""
    return datetime.now(IST)


def ist_naive_now() -> datetime:
    """Return current Indian Standard Time (IST) as naive datetime for database timestamp columns."""
    return datetime.now(IST).replace(tzinfo=None)


def ist_today() -> date:
    """Return current calendar date in Indian Standard Time (IST, UTC+05:30)."""
    return datetime.now(IST).date()


def to_ist(dt) -> datetime:
    """Convert a UTC or naive datetime to Indian Standard Time (IST)."""
    if dt is None:
        return None
    if isinstance(dt, date) and not isinstance(dt, datetime):
        return dt
    if getattr(dt, 'tzinfo', None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(IST)


def format_ist_datetime(dt, fmt: str = "%d-%m-%Y %I:%M %p") -> str:
    """Format a datetime in Indian standard format (DD-MM-YYYY hh:mm AM/PM)."""
    if not dt:
        return '—'
    try:
        return to_ist(dt).strftime(fmt)
    except Exception:
        return str(dt)


def format_ist_date(d, fmt: str = "%d-%m-%Y") -> str:
    """Format a date or datetime in Indian standard date format (DD-MM-YYYY)."""
    if not d:
        return '—'
    try:
        if isinstance(d, datetime):
            return to_ist(d).strftime(fmt)
        if isinstance(d, date):
            return d.strftime(fmt)
        return str(d)
    except Exception:
        return str(d)
