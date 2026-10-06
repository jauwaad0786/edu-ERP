"""
User Notification Preference Checker.
Evaluates per-user and per-category notification opt-outs and quiet hours.
"""

from datetime import datetime, time
import logging
from typing import Dict, Any

from app.models.notification import NotificationPreference

logger = logging.getLogger('preference_checker')


class PreferenceChecker:
    @classmethod
    def check_user_preference(cls, user_id: int, category: str) -> Dict[str, bool]:
        """
        Check if user allows in-app and push notifications for a given category,
        and whether current time falls within user's quiet hours.
        """
        if not user_id:
            return {'in_app_allowed': True, 'push_allowed': True, 'in_quiet_hours': False}

        cat = (category or 'GENERAL').upper()
        pref = NotificationPreference.query.filter_by(
            user_id=user_id,
            category=cat
        ).first()

        if not pref:
            return {'in_app_allowed': True, 'push_allowed': True, 'in_quiet_hours': False}

        in_quiet = False
        if pref.quiet_hours_start and pref.quiet_hours_end:
            try:
                now_time = datetime.utcnow().time()
                start_h, start_m = map(int, pref.quiet_hours_start.split(':'))
                end_h, end_m = map(int, pref.quiet_hours_end.split(':'))
                start_t = time(start_h, start_m)
                end_t = time(end_h, end_m)

                if start_t <= end_t:
                    in_quiet = start_t <= now_time <= end_t
                else:  # Over midnight (e.g. 22:00 to 07:00)
                    in_quiet = now_time >= start_t or now_time <= end_t
            except Exception as e:
                logger.warning(f"Error parsing quiet hours for user {user_id}: {e}")

        # If user disabled push, or if it is quiet hours, suppress push
        push_allowed = pref.push_enabled and not in_quiet
        in_app_allowed = pref.in_app_enabled

        return {
            'in_app_allowed': in_app_allowed,
            'push_allowed': push_allowed,
            'in_quiet_hours': in_quiet
        }
