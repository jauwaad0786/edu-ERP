# backend/app/services/notification_service.py
"""
Central notification dispatcher for communication and support events.
Ensures tenant isolation and user-specific notification rows.
"""

from app.services.communication.notification_service import (
    NotificationService,
    notification_service,
    send_notification,
)

__all__ = ['NotificationService', 'notification_service', 'send_notification']
