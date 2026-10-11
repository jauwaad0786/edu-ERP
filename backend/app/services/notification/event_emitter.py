"""
Event Emitter for Multi-Tenant School ERP.
Listens to business domain events and converts them into notifications using templates,
rules, and recipient resolvers. Never crashes caller database transactions.
"""

import json
import logging
from datetime import timedelta
from typing import Dict, Any, Optional

from app import db
from app.utils.timezone_util import utc_now
from app.models.notification import NotificationRule, ScheduledNotification
from app.services.notification.template_renderer import TemplateRenderer
from app.services.notification.recipient_resolver import RecipientResolver
from app.services.notification.notification_engine import NotificationEngine

logger = logging.getLogger('event_emitter')

# Default event-to-template fallback mapping
DEFAULT_EVENT_TEMPLATES = {
    'attendance.absent':     'ATTENDANCE_ABSENT',
    'fees.collected':        'FEE_COLLECTED',
    'fees.reminder':         'FEE_REMINDER',
    'exams.published':       'EXAM_PUBLISHED',
    'results.announced':     'RESULT_ANNOUNCED',
    'hostel.outpass':        'HOSTEL_OUTPASS',
    'transport.delay':       'TRANSPORT_DELAY',
    'payroll.processed':     'PAYROLL_GENERATED',
    'admission.confirmed':   'ADMISSION_CONFIRMED',
    'announcement.created':  'ANNOUNCEMENT_BROADCAST',
}


def emit_notification_event(
    event_name: str,
    school_id: Optional[int],
    payload: Dict[str, Any],
    delay_minutes: int = 0
) -> bool:
    """
    Fire-and-forget event emitter for notification triggers.
    Safe execution: never raises an exception back to caller.
    """
    try:
        if not event_name:
            return False

        payload = payload or {}

        # 1. Check for Active Notification Rule
        rule = None
        if school_id:
            rule = NotificationRule.query.filter_by(
                school_id=school_id,
                event_name=event_name
            ).first()

        # If a rule exists and is explicitly disabled, drop event
        if rule and not rule.is_enabled:
            logger.info(f"Notification rule for event '{event_name}' in school {school_id} is disabled. Skipping.")
            return True

        # Check conditions if specified in rule
        if rule and rule.condition_json:
            try:
                conds = json.loads(rule.condition_json)
                if 'min_amount' in conds and float(payload.get('amount', 0)) < float(conds['min_amount']):
                    logger.info(f"Condition min_amount not met for event '{event_name}'")
                    return True
            except Exception as cond_err:
                logger.warning(f"Error evaluating rule condition for '{event_name}': {cond_err}")

        # Determine delay
        effective_delay = delay_minutes or (rule.delay_minutes if rule else 0)

        # 2. Delayed execution -> Schedule for background worker
        if effective_delay > 0:
            scheduled_time = utc_now() + timedelta(minutes=effective_delay)
            sched = ScheduledNotification(
                school_id=school_id,
                event_name=event_name,
                payload_json=json.dumps(payload),
                scheduled_at=scheduled_time,
                status='PENDING'
            )
            db.session.add(sched)
            db.session.commit()
            logger.info(f"Scheduled notification event '{event_name}' for school {school_id} at {scheduled_time}")
            return True

        # 3. Determine Template Code
        template_code = None
        if rule and rule.template:
            template_code = rule.template.code
        elif rule and rule.template_id:
            # Look up template code
            from app.models.notification import NotificationTemplate
            t = NotificationTemplate.query.get(rule.template_id)
            if t:
                template_code = t.code

        if not template_code:
            template_code = payload.get('template_code') or DEFAULT_EVENT_TEMPLATES.get(event_name)

        # 4. Render Template
        rendered = TemplateRenderer.render(
            code=template_code or event_name,
            context=payload,
            school_id=school_id
        )

        title = payload.get('title') or rendered['title']
        body = payload.get('message') or payload.get('body') or rendered['body']
        category = payload.get('category') or rendered['category']
        priority = payload.get('priority') or rendered['priority']
        deep_link = payload.get('deep_link') or rendered['deep_link']
        channels = rule.channels.split(',') if rule and rule.channels else rendered.get('channels')

        # 5. Resolve Recipients
        target_info = {
            'user_ids':        payload.get('user_ids') or ([payload.get('user_id')] if payload.get('user_id') else None),
            'roles':           (rule.target_roles if rule and rule.target_roles else payload.get('target_roles')),
            'class_ids':       payload.get('class_ids') or payload.get('class_id'),
            'student_ids':     payload.get('student_ids') or payload.get('student_id'),
            'include_parents': payload.get('include_parents', True)
        }

        recipient_user_ids = RecipientResolver.resolve(school_id, target_info)
        if not recipient_user_ids:
            logger.info(f"No recipients resolved for event '{event_name}' in school {school_id}")
            return True

        # 6. Dispatch Notifications
        NotificationEngine.dispatch_bulk(
            user_ids=recipient_user_ids,
            title=title,
            message=body,
            school_id=school_id,
            category=category,
            deep_link=deep_link,
            priority=priority,
            channels=channels,
            action_data=payload.get('action_data') or payload,
            created_by=payload.get('created_by')
        )

        logger.info(f"Dispatched notification event '{event_name}' to {len(recipient_user_ids)} recipient(s)")
        return True

    except Exception as ex:
        logger.error(f"Error in emit_notification_event for '{event_name}': {ex}", exc_info=True)
        return False
