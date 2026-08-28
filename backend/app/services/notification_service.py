# backend/app/services/notification_service.py
"""
Central notification dispatcher for communication and support events.
Ensures tenant isolation and user-specific notification rows.
"""

from app import db
from app.models.communication import SupportNotification


def send_notification(user_id, title, message, ticket_id=None, school_id=None, notif_type='SYSTEM'):
    """
    Creates and stages a SupportNotification row.
    
    Args:
        user_id (int): Target user who receives the notification.
        title (str): Short header/title.
        message (str): Body/content summary.
        ticket_id (int, optional): Associated ticket ID if applicable.
        school_id (int, optional): School scope.
        notif_type (str): 'TICKET' | 'CHAT' | 'MEETING' | 'ANNOUNCEMENT' | 'SYSTEM'
    """
    if not user_id:
        return None

    notification = SupportNotification(
        user_id=user_id,
        ticket_id=ticket_id,
        school_id=school_id,
        title=(title or '').strip()[:200],
        message=(message or '').strip()[:500],
        notif_type=(notif_type or 'SYSTEM').upper(),
        is_read=False,
    )
    db.session.add(notification)
    return notification
