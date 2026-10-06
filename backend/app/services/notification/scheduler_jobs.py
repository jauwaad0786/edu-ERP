"""
Background Scheduler Jobs for Notification System.
Handles scheduled/delayed notifications and retention cleanups.
"""

import json
import logging
from datetime import datetime, timedelta

from app import db
from app.utils.timezone_util import utc_now
from app.models.notification import ScheduledNotification, NotificationDeliveryLog
from app.models.communication import SupportNotification

logger = logging.getLogger('notification_scheduler')


def process_scheduled_notifications_job():
    """
    Pulls pending scheduled notifications whose scheduled_at timestamp has arrived,
    and executes them via emit_notification_event.
    """
    from app.services.notification.event_emitter import emit_notification_event

    try:
        now = utc_now()
        pending_items = ScheduledNotification.query.filter(
            ScheduledNotification.status == 'PENDING',
            ScheduledNotification.scheduled_at <= now
        ).order_by(ScheduledNotification.scheduled_at.asc()).limit(50).all()

        if not pending_items:
            return

        logger.info(f"Processing {len(pending_items)} scheduled notification(s)")

        for item in pending_items:
            item.status = 'PROCESSING'
            item.attempts += 1
            db.session.commit()

            try:
                payload = json.loads(item.payload_json) if item.payload_json else {}
                success = emit_notification_event(
                    event_name=item.event_name,
                    school_id=item.school_id,
                    payload=payload,
                    delay_minutes=0
                )
                if success:
                    item.status = 'COMPLETED'
                    item.processed_at = utc_now()
                else:
                    item.status = 'FAILED' if item.attempts >= 3 else 'PENDING'
                    item.last_error = 'emit_notification_event returned False'
            except Exception as item_err:
                item.status = 'FAILED' if item.attempts >= 3 else 'PENDING'
                item.last_error = str(item_err)
                logger.error(f"Error processing scheduled notification #{item.id}: {item_err}")

            db.session.commit()

    except Exception as e:
        logger.error(f"Scheduled notifications runner error: {e}", exc_info=True)


def cleanup_old_notifications_job():
    """
    Retention cleanup:
    - Purges read in-app notifications older than 90 days
    - Purges delivery logs older than 180 days
    """
    try:
        cutoff_90d = utc_now() - timedelta(days=90)
        cutoff_180d = utc_now() - timedelta(days=180)

        # 1. Purge read notifications > 90d
        deleted_notifs = SupportNotification.query.filter(
            SupportNotification.is_read == True,
            SupportNotification.created_at < cutoff_90d
        ).delete(synchronize_session=False)

        # 2. Purge delivery logs > 180d
        deleted_logs = NotificationDeliveryLog.query.filter(
            NotificationDeliveryLog.created_at < cutoff_180d
        ).delete(synchronize_session=False)

        db.session.commit()
        if deleted_notifs or deleted_logs:
            logger.info(f"Cleaned up {deleted_notifs} old notifications and {deleted_logs} old delivery logs")
    except Exception as e:
        db.session.rollback()
        logger.warning(f"Error in cleanup_old_notifications_job: {e}")
