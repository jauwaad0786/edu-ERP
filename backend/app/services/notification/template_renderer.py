"""
Template Rendering Engine.
Loads NotificationTemplate with school-level override and renders token variables safely.
"""

import string
import logging
from typing import Dict, Any, Optional

from app.models.notification import NotificationTemplate

logger = logging.getLogger('template_renderer')


class SafeDict(dict):
    """Fallback dict to prevent KeyError on missing template variables."""
    def __missing__(self, key):
        return f"{{{key}}}"


class TemplateRenderer:
    @classmethod
    def get_template(cls, code: str, school_id: Optional[int] = None) -> Optional[NotificationTemplate]:
        """
        Fetch template by code. Priority:
        1. School-specific custom template (school_id == school_id)
        2. Platform default template (school_id is None)
        """
        if not code:
            return None

        # 1. School custom
        if school_id:
            custom_tpl = NotificationTemplate.query.filter_by(
                school_id=school_id,
                code=code,
                is_active=True
            ).first()
            if custom_tpl:
                return custom_tpl

        # 2. Platform default
        return NotificationTemplate.query.filter_by(
            school_id=None,
            code=code,
            is_active=True
        ).first()

    @classmethod
    def render(cls, code: str, context: Dict[str, Any], school_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Renders template using provided context dictionary.
        Returns a dict with rendered title, body, deep_link, priority, category, channels.
        If no template is found, generates fallback text from context.
        """
        tpl = cls.get_template(code, school_id=school_id)
        safe_ctx = SafeDict(context or {})

        if tpl:
            try:
                title = tpl.title_template.format_map(safe_ctx)
            except Exception as e:
                logger.warning(f"Error formatting title for {code}: {e}")
                title = tpl.title_template

            try:
                body = tpl.body_template.format_map(safe_ctx)
            except Exception as e:
                logger.warning(f"Error formatting body for {code}: {e}")
                body = tpl.body_template

            deep_link = ''
            if tpl.deep_link_template:
                try:
                    deep_link = tpl.deep_link_template.format_map(safe_ctx)
                except Exception:
                    deep_link = tpl.deep_link_template

            channels = [c.strip() for c in (tpl.supported_channels or 'in_app,push').split(',') if c.strip()]

            return {
                'title': title,
                'body': body,
                'category': tpl.category,
                'priority': tpl.default_priority or 'MEDIUM',
                'deep_link': deep_link,
                'channels': channels,
                'template_id': tpl.id,
                'template_code': tpl.code
            }

        # Fallback when no template exists
        title = context.get('title') or code.replace('_', ' ').title()
        body = context.get('message') or context.get('body') or f"Update for {code}"
        category = context.get('category') or 'GENERAL'
        priority = context.get('priority') or 'MEDIUM'
        deep_link = context.get('deep_link') or ''
        channels = context.get('channels') or ['in_app', 'push']

        return {
            'title': title,
            'body': body,
            'category': category,
            'priority': priority,
            'deep_link': deep_link,
            'channels': channels,
            'template_id': None,
            'template_code': code
        }
