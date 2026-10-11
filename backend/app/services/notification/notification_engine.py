"""
Central Notification Engine.
Orchestrates multi-channel delivery (In-App Bell, Expo Mobile Push, Web Push),
checks user preferences and quiet hours, logs delivery audit trials, and updates device statuses.
"""

import json
import logging
from typing import List, Dict, Any, Optional

from app import db
from app.utils.timezone_util import utc_now
from app.models.user import User
from app.models.device import UserDevice
from app.models.communication import SupportNotification
from app.models.notification import NotificationDeliveryLog
from app.services.notification.preference_checker import PreferenceChecker
from app.services.notification.push_provider import push_dispatcher

logger = logging.getLogger('notification_engine')


class NotificationEngine:
    @classmethod
    def dispatch_single(
        cls,
        user_id: int,
        title: str,
        message: str,
        school_id: Optional[int] = None,
        category: str = 'GENERAL',
        deep_link: str = '',
        priority: str = 'MEDIUM',
        channels: Optional[List[str]] = None,
        action_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[int] = None,
        ticket_id: Optional[int] = None,
        commit: bool = True
    ) -> Optional[SupportNotification]:
        """
        Deliver a notification to an individual user across enabled channels.
        """
        if not user_id:
            return None

        channels = [c.lower().strip() for c in (channels or ['in_app', 'push'])]
        cat = (category or 'GENERAL').upper()
        prio = (priority or 'MEDIUM').upper()

        # 1. Evaluate User Preferences
        pref = PreferenceChecker.check_user_preference(user_id, cat)

        # 2. In-App Bell Record
        notif_record = None
        if 'in_app' in channels and pref['in_app_allowed']:
            action_json = json.dumps(action_data or {})
            notif_record = SupportNotification(
                user_id=user_id,
                ticket_id=ticket_id,
                school_id=school_id,
                created_by=created_by,
                title=(title or '').strip()[:200],
                message=(message or '').strip()[:500],
                notif_type=cat if cat in ('TICKET', 'CHAT', 'MEETING', 'ANNOUNCEMENT', 'SYSTEM') else 'SYSTEM',
                category=cat,
                priority=prio,
                deep_link=deep_link or '',
                action_data=action_json,
                metadata_json=action_json,
                channel='multi' if ('push' in channels and pref['push_allowed']) else 'in_app',
                is_read=False,
                created_at=utc_now()
            )
            db.session.add(notif_record)
            db.session.flush()  # to obtain notif_record.id

            # Delivery log for in_app
            log_entry = NotificationDeliveryLog(
                school_id=school_id,
                notification_id=notif_record.id,
                user_id=user_id,
                channel='in_app',
                status='SENT',
                recipient_target=f"user:{user_id}",
                sent_at=utc_now()
            )
            db.session.add(log_entry)

        # 3. Push Channel (Mobile Expo + Web Push)
        should_push = any(c in channels for c in ('push', 'expo_push', 'web_push'))
        if should_push and pref['push_allowed']:
            devices = UserDevice.query.filter_by(
                user_id=user_id,
                is_active=True
            ).all()

            if devices:
                push_payload = {
                    'deep_link': deep_link or '',
                    'category': cat,
                    'notification_id': notif_record.id if notif_record else None,
                    **(action_data or {})
                }
                push_results = push_dispatcher.dispatch_for_devices(
                    devices=devices,
                    title=title,
                    body=message,
                    data=push_payload
                )

                for res in push_results:
                    log_entry = NotificationDeliveryLog(
                        school_id=school_id,
                        notification_id=notif_record.id if notif_record else None,
                        user_id=user_id,
                        channel=res.get('channel', 'expo_push'),
                        status=res.get('status', 'SENT'),
                        recipient_target=res.get('token', ''),
                        provider_response=str(res.get('ticket_id') or ''),
                        error_message=res.get('error') or '',
                        sent_at=utc_now()
                    )
                    db.session.add(log_entry)
            else:
                log_entry = NotificationDeliveryLog(
                    school_id=school_id,
                    notification_id=notif_record.id if notif_record else None,
                    user_id=user_id,
                    channel='expo_push',
                    status='DEVICE_NOT_FOUND',
                    recipient_target='none',
                    sent_at=utc_now()
                )
                db.session.add(log_entry)

        if commit:
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logger.error(f"Error committing notification dispatch: {e}")
                return None

        return notif_record

    @classmethod
    def dispatch_bulk(
        cls,
        user_ids: List[int],
        title: str,
        message: str,
        school_id: Optional[int] = None,
        category: str = 'GENERAL',
        deep_link: str = '',
        priority: str = 'MEDIUM',
        channels: Optional[List[str]] = None,
        action_data: Optional[Dict[str, Any]] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Dispatches to multiple recipients with batched database writes and push aggregation.
        """
        if not user_ids:
            return {'total': 0, 'sent': 0}

        channels = [c.lower().strip() for c in (channels or ['in_app', 'push'])]
        cat = (category or 'GENERAL').upper()
        prio = (priority or 'MEDIUM').upper()
        action_json = json.dumps(action_data or {})

        unique_user_ids = list(set(user_ids))
        created_notifications = []

        # Pre-fetch all devices for all users to prevent N+1 queries
        devices_by_user = {}
        all_devices = UserDevice.query.filter(
            UserDevice.user_id.in_(unique_user_ids),
            UserDevice.is_active == True
        ).all()
        for d in all_devices:
            devices_by_user.setdefault(d.user_id, []).append(d)

        # Aggregate devices for a single batch push call
        all_push_devices = []

        for uid in unique_user_ids:
            pref = PreferenceChecker.check_user_preference(uid, cat)

            # In-App
            notif = None
            if 'in_app' in channels and pref['in_app_allowed']:
                notif = SupportNotification(
                    user_id=uid,
                    school_id=school_id,
                    created_by=created_by,
                    title=(title or '').strip()[:200],
                    message=(message or '').strip()[:500],
                    notif_type=cat if cat in ('TICKET', 'CHAT', 'MEETING', 'ANNOUNCEMENT', 'SYSTEM') else 'SYSTEM',
                    category=cat,
                    priority=prio,
                    deep_link=deep_link or '',
                    action_data=action_json,
                    metadata_json=action_json,
                    channel='multi' if ('push' in channels and pref['push_allowed']) else 'in_app',
                    is_read=False,
                    created_at=utc_now()
                )
                db.session.add(notif)
                created_notifications.append(notif)

            # Push
            if any(c in channels for c in ('push', 'expo_push', 'web_push')) and pref['push_allowed']:
                user_devs = devices_by_user.get(uid, [])
                if user_devs:
                    all_push_devices.extend(user_devs)

        # Flush in-app notifications
        db.session.flush()

        # Batch push execution
        if all_push_devices:
            push_payload = {
                'deep_link': deep_link or '',
                'category': cat,
                **(action_data or {})
            }
            push_results = push_dispatcher.dispatch_for_devices(
                devices=all_push_devices,
                title=title,
                body=message,
                data=push_payload
            )
            for res in push_results:
                log_entry = NotificationDeliveryLog(
                    school_id=school_id,
                    user_id=res.get('user_id'),
                    channel=res.get('channel', 'expo_push'),
                    status=res.get('status', 'SENT'),
                    recipient_target=res.get('token', ''),
                    provider_response=str(res.get('ticket_id') or ''),
                    error_message=res.get('error') or '',
                    sent_at=utc_now()
                )
                db.session.add(log_entry)

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error during bulk notification dispatch commit: {e}")
            return {'total': len(unique_user_ids), 'sent': 0, 'error': str(e)}

        return {
            'total': len(unique_user_ids),
            'sent': len(created_notifications),
            'notifications_created': len(created_notifications)
        }
