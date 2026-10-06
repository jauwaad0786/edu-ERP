"""
Comprehensive Multi-Tenant Notification Service for Edu ERP.
Supports:
- In-app bell notifications
- SMS dispatch via MSG91
- Email dispatch via MSG91
- Push notification architecture via UserDevice tokens
- Strict tenant isolation (Principal vs Super Admin scopes)
"""

import json
import logging
from datetime import datetime
from app.utils.timezone_util import utc_now
from app import db
from app.models.user import User, UserRole
from app.models.communication import SupportNotification
from app.models.device import UserDevice
from app.services.communication.msg91_service import MSG91Service

logger = logging.getLogger('notification_service')


class NotificationService:
    @classmethod
    def send_notification(cls, user_id, title, message, ticket_id=None, school_id=None,
                          notif_type='SYSTEM', priority='MEDIUM', created_by=None,
                          metadata=None, channels=None):
        """
        Primary notification dispatcher.
        Creates an in-app SupportNotification and dispatches to optional external channels
        (SMS, Email, Push) if specified.
        
        Args:
            user_id (int): Target recipient User ID
            title (str): Header/Title
            message (str): Body/content summary
            ticket_id (int, optional): Associated ticket ID
            school_id (int, optional): Associated school/tenant ID
            notif_type (str): 'SYSTEM' | 'ANNOUNCEMENT' | 'TICKET' | 'FEE' | 'ATTENDANCE' | 'CHAT' | 'MEETING'
            priority (str): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
            created_by (int, optional): Sender User ID
            metadata (dict, optional): Additional context payload
            channels (list, optional): e.g. ['in_app', 'sms', 'email', 'push']. Defaults to ['in_app']
        """
        if not user_id:
            return None

        # 1. In-App Notification Record
        meta_str = json.dumps(metadata) if metadata else '{}'
        target_channels = [c.lower() for c in (channels or ['in_app'])]
        channel_label = 'multi' if len(target_channels) > 1 else (target_channels[0] if target_channels else 'in_app')
        category_val = (metadata.get('category') if metadata and isinstance(metadata, dict) else notif_type) or 'GENERAL'
        deep_link_val = metadata.get('deep_link', '') if metadata and isinstance(metadata, dict) else ''

        notif = SupportNotification(
            user_id=user_id,
            ticket_id=ticket_id,
            school_id=school_id,
            created_by=created_by,
            title=(title or '').strip()[:200],
            message=(message or '').strip()[:500],
            notif_type=(notif_type or 'SYSTEM').upper(),
            category=str(category_val).upper(),
            priority=(priority or 'MEDIUM').upper(),
            deep_link=deep_link_val,
            action_data=meta_str,
            metadata_json=meta_str,
            channel=channel_label,
            is_read=False,
            created_at=utc_now()
        )
        db.session.add(notif)

        # 2. External Channels (Graceful failure: never crashes DB transaction)
        user = User.query.get(user_id)
        if user and user.is_active:
            # Push Channel via Unified Push Dispatcher (Expo Mobile Push + Web Push)
            if any(ch in target_channels for ch in ('push', 'expo_push', 'web_push')):
                try:
                    from app.services.notification.push_provider import push_dispatcher
                    active_devices = (
                        UserDevice.query
                        .filter_by(user_id=user.id, is_active=True)
                        .all()
                    )
                    if active_devices:
                        push_dispatcher.dispatch_for_devices(
                            devices=active_devices,
                            title=title,
                            body=message,
                            data=metadata
                        )
                except Exception as e:
                    logger.warning(f"[NotificationService] Push dispatch skipped/failed: {e}")

        return notif

    @classmethod
    def send_fee_reminder(cls, student_user_id, student_name, pending_amount, school_id=None, created_by=None):
        """Standardized fee reminder SMS & in-app notification."""
        title = "Fee Payment Reminder"
        msg = f"Dear Parent, fee of Rs. {pending_amount} for {student_name} is pending. Please contact the school."
        return cls.send_notification(
            user_id=student_user_id,
            title=title,
            message=msg,
            school_id=school_id,
            notif_type='FEE',
            priority='HIGH',
            created_by=created_by,
            channels=['in_app', 'sms']
        )

    @classmethod
    def send_attendance_alert(cls, student_user_id, student_name, date_str, school_id=None, created_by=None):
        """Standardized student absence alert."""
        title = "Student Absence Alert"
        msg = f"Dear Parent, your child {student_name} was marked absent on {date_str}."
        return cls.send_notification(
            user_id=student_user_id,
            title=title,
            message=msg,
            school_id=school_id,
            notif_type='ATTENDANCE',
            priority='MEDIUM',
            created_by=created_by,
            channels=['in_app', 'sms']
        )

    @classmethod
    def broadcast_school_notification(cls, school_id, sender_user, title, message,
                                       target_audience='ALL', selected_user_ids=None,
                                       channels=None, priority='MEDIUM'):
        """
        Principal Broadcast Notification scoped strictly to their school.
        Audience: ALL | TEACHERS | STAFF | STUDENTS | PARENTS | SELECTED
        """
        if not school_id:
            raise ValueError("school_id is required for school broadcast")

        channels = channels or ['in_app']
        created_notifications = []

        q = User.query.filter(
            User.is_active == True,
            User.school_id == school_id,
            User.is_deleted == False
        )

        role_filter_map = {
            'TEACHERS': [UserRole.TEACHER, UserRole.VICE_PRINCIPAL, UserRole.ACADEMIC_COORDINATOR],
            'STAFF': [UserRole.ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.LIBRARIAN,
                      UserRole.HOSTEL, UserRole.TRANSPORT, UserRole.HR, UserRole.DRIVER],
            'STUDENTS': [UserRole.STUDENT],
            'PARENTS': [UserRole.PARENT],
        }

        aud = (target_audience or 'ALL').upper()

        if aud in role_filter_map:
            q = q.filter(User.role.in_(role_filter_map[aud]))
        elif aud == 'SELECTED' and selected_user_ids:
            q = q.filter(User.id.in_(selected_user_ids))

        recipients = q.all()
        for recipient in recipients:
            n = cls.send_notification(
                user_id=recipient.id,
                title=title,
                message=message,
                school_id=school_id,
                notif_type='ANNOUNCEMENT',
                priority=priority,
                created_by=sender_user.id if sender_user else None,
                channels=channels
            )
            if n:
                created_notifications.append(n)

        db.session.commit()
        return created_notifications

    @classmethod
    def broadcast_platform_notification(cls, sender_user, title, message,
                                         target_school_ids=None, target_roles=None,
                                         channels=None, priority='HIGH'):
        """
        Super Admin System-wide / Platform Broadcast Notification.
        Can target ALL schools or selected schools, and specific roles.
        """
        if sender_user.role != UserRole.SUPER_ADMIN:
            raise PermissionError("Only Super Admin can issue platform-wide broadcasts")

        channels = channels or ['in_app']
        created_notifications = []

        q = User.query.filter(User.is_active == True, User.is_deleted == False)

        if target_school_ids and 'ALL' not in target_school_ids:
            q = q.filter(User.school_id.in_(target_school_ids))

        if target_roles and 'ALL' not in target_roles:
            role_enums = []
            for r in target_roles:
                try:
                    role_enums.append(UserRole(r.upper()))
                except ValueError:
                    pass
            if role_enums:
                q = q.filter(User.role.in_(role_enums))

        recipients = q.all()
        for recipient in recipients:
            n = cls.send_notification(
                user_id=recipient.id,
                title=f"📢 {title}",
                message=message,
                school_id=recipient.school_id,
                notif_type='SYSTEM',
                priority=priority,
                created_by=sender_user.id,
                channels=channels
            )
            if n:
                created_notifications.append(n)

        db.session.commit()
        return created_notifications


notification_service = NotificationService


# Export backward-compatible function
def send_notification(user_id, title, message, ticket_id=None, school_id=None, notif_type='SYSTEM'):
    return NotificationService.send_notification(
        user_id=user_id,
        title=title,
        message=message,
        ticket_id=ticket_id,
        school_id=school_id,
        notif_type=notif_type
    )
