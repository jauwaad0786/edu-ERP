"""
Notification Center Management API.
Full administrative endpoints for School Principal & Administrators:
- Dashboard Statistics & Analytics
- Notification History & Filtering
- Broadcast / Compose Dispatcher
- Template Management
- Automation Rules Management
- Delivery Audit Logs
- Registered Devices Management
- User Channel Preferences
"""

import json
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_

from app import db
from app.utils.decorators import role_required, get_current_user
from app.utils.timezone_util import utc_now
from app.models.user import User, UserRole
from app.models.communication import SupportNotification
from app.models.device import UserDevice
from app.models.notification import (
    NotificationTemplate,
    NotificationRule,
    NotificationPreference,
    NotificationDeliveryLog,
    ScheduledNotification
)
from app.services.notification.notification_engine import NotificationEngine
from app.services.notification.recipient_resolver import RecipientResolver
from app.services.notification.template_renderer import TemplateRenderer

notification_center_bp = Blueprint('notification_center', __name__)

ADMIN_ROLES = ('SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SCHOOL_ADMIN')
ALL_USER_ROLES = (
    'SUPER_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'ADMIN', 'SCHOOL_ADMIN',
    'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT', 'RECEPTIONIST',
    'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR', 'DRIVER'
)


def _get_target_school_id(current_user):
    """Resolve active school_id considering Super Admin overrides."""
    if current_user.role == UserRole.SUPER_ADMIN:
        req_school = request.args.get('school_id') or (request.json.get('school_id') if request.is_json and request.json else None)
        if req_school:
            return int(req_school)
    return current_user.school_id


# ─── 1. Overview & Analytics Stats ───────────────────────────────────────────

@notification_center_bp.route('/stats', methods=['GET'])
@role_required(*ADMIN_ROLES)
def get_stats():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    today_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Notifications sent today
    sent_today_q = SupportNotification.query.filter(SupportNotification.created_at >= today_start)
    if school_id:
        sent_today_q = sent_today_q.filter(SupportNotification.school_id == school_id)
    sent_today = sent_today_q.count()

    # 2. Total all-time
    total_q = SupportNotification.query
    if school_id:
        total_q = total_q.filter(SupportNotification.school_id == school_id)
    total_sent = total_q.count()

    # 3. Unread count
    unread_q = SupportNotification.query.filter(SupportNotification.is_read == False)
    if school_id:
        unread_q = unread_q.filter(SupportNotification.school_id == school_id)
    unread_count = unread_q.count()

    # 4. Active push devices
    dev_q = UserDevice.query.filter(UserDevice.is_active == True)
    if school_id:
        dev_q = dev_q.filter(UserDevice.school_id == school_id)
    active_devices = dev_q.count()

    # Platform breakdown
    platform_breakdown = {}
    if school_id:
        p_stats = db.session.query(
            UserDevice.platform, func.count(UserDevice.id)
        ).filter(
            UserDevice.school_id == school_id,
            UserDevice.is_active == True
        ).group_by(UserDevice.platform).all()
        for p, count in p_stats:
            platform_breakdown[p or 'unknown'] = count

    # 5. Pending scheduled notifications
    sched_q = ScheduledNotification.query.filter(ScheduledNotification.status == 'PENDING')
    if school_id:
        sched_q = sched_q.filter(ScheduledNotification.school_id == school_id)
    pending_scheduled = sched_q.count()

    # 6. Delivery success rate from logs (last 7 days)
    last_7d = utc_now() - timedelta(days=7)
    log_q = NotificationDeliveryLog.query.filter(NotificationDeliveryLog.created_at >= last_7d)
    if school_id:
        log_q = log_q.filter(NotificationDeliveryLog.school_id == school_id)
    total_logs = log_q.count()
    successful_logs = log_q.filter(NotificationDeliveryLog.status == 'SENT').count()
    delivery_rate = round((successful_logs / total_logs * 100), 1) if total_logs > 0 else 100.0

    return jsonify({
        'sent_today': sent_today,
        'total_sent': total_sent,
        'unread_count': unread_count,
        'active_devices': active_devices,
        'platform_breakdown': platform_breakdown,
        'pending_scheduled': pending_scheduled,
        'delivery_rate': delivery_rate,
        'total_logged_deliveries_7d': total_logs
    }), 200


# ─── 2. Notification History ──────────────────────────────────────────────────

@notification_center_bp.route('/history', methods=['GET'])
@role_required(*ADMIN_ROLES)
def get_history():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    q = SupportNotification.query
    if school_id:
        q = q.filter(SupportNotification.school_id == school_id)

    category = request.args.get('category')
    if category and category != 'ALL':
        q = q.filter(SupportNotification.category == category.upper())

    priority = request.args.get('priority')
    if priority and priority != 'ALL':
        q = q.filter(SupportNotification.priority == priority.upper())

    channel = request.args.get('channel')
    if channel and channel != 'ALL':
        q = q.filter(SupportNotification.channel == channel.lower())

    search = request.args.get('search')
    if search:
        search_term = f"%{search}%"
        q = q.filter(or_(
            SupportNotification.title.ilike(search_term),
            SupportNotification.message.ilike(search_term)
        ))

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    paginated = q.order_by(SupportNotification.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'data': [n.to_dict() for n in paginated.items],
        'total': paginated.total,
        'page': paginated.page,
        'pages': paginated.pages,
        'has_next': paginated.has_next,
    }), 200


# ─── 3. Compose & Send Broadcast ──────────────────────────────────────────────

@notification_center_bp.route('/send', methods=['POST'])
@role_required(*ADMIN_ROLES)
def send_notification():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    message = (data.get('message') or '').strip()
    category = (data.get('category') or 'GENERAL').upper()
    priority = (data.get('priority') or 'MEDIUM').upper()
    deep_link = (data.get('deep_link') or '').strip()
    channels = data.get('channels') or ['in_app', 'push']
    scheduled_at_str = data.get('scheduled_at')

    if not title or not message:
        return jsonify({'error': 'Title and message are required'}), 400

    target_type = (data.get('target_type') or 'ALL').upper()
    target_info = {}

    if target_type == 'ALL':
        target_info = {'roles': 'ALL'}
    elif target_type == 'ROLE':
        target_info = {'roles': data.get('roles', ['ALL'])}
    elif target_type == 'CLASS':
        target_info = {
            'class_ids': data.get('class_ids', []),
            'include_parents': data.get('include_parents', True)
        }
    elif target_type == 'SPECIFIC':
        target_info = {'user_ids': data.get('user_ids', [])}
    else:
        target_info = {'roles': 'ALL'}

    recipient_user_ids = RecipientResolver.resolve(school_id, target_info)
    if not recipient_user_ids:
        return jsonify({'error': 'No recipients found for the selected audience criteria'}), 400

    # Handle scheduling
    if scheduled_at_str:
        try:
            scheduled_dt = datetime.fromisoformat(scheduled_at_str.replace('Z', '+00:00'))
            if scheduled_dt > utc_now():
                sched_entry = ScheduledNotification(
                    school_id=school_id,
                    event_name='custom.broadcast',
                    payload_json=json.dumps({
                        'title': title,
                        'message': message,
                        'category': category,
                        'priority': priority,
                        'deep_link': deep_link,
                        'channels': channels,
                        'user_ids': recipient_user_ids,
                        'created_by': user.id
                    }),
                    scheduled_at=scheduled_dt,
                    status='PENDING'
                )
                db.session.add(sched_entry)
                db.session.commit()
                return jsonify({
                    'message': f"Notification scheduled for {scheduled_dt.isoformat()} to {len(recipient_user_ids)} recipients",
                    'scheduled_id': sched_entry.id,
                    'recipients_count': len(recipient_user_ids)
                }), 201
        except Exception as e:
            return jsonify({'error': f'Invalid scheduled_at date format: {e}'}), 400

    # Instant delivery
    res = NotificationEngine.dispatch_bulk(
        user_ids=recipient_user_ids,
        title=title,
        message=message,
        school_id=school_id,
        category=category,
        deep_link=deep_link,
        priority=priority,
        channels=channels,
        created_by=user.id
    )

    return jsonify({
        'message': f"Notification sent successfully to {res.get('sent', 0)} recipients",
        'recipients_count': len(recipient_user_ids),
        'result': res
    }), 200


# ─── 4. Template Management ───────────────────────────────────────────────────

@notification_center_bp.route('/templates', methods=['GET'])
@role_required(*ADMIN_ROLES)
def list_templates():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    # Fetch platform defaults (school_id is None) and school custom templates
    q = NotificationTemplate.query.filter(
        or_(
            NotificationTemplate.school_id == None,
            NotificationTemplate.school_id == school_id
        )
    ).order_by(NotificationTemplate.category.asc(), NotificationTemplate.code.asc())

    templates = q.all()
    # Deduplicate: if a school custom exists for a code, it takes precedence
    merged_templates = {}
    for t in templates:
        code = t.code
        if code not in merged_templates or t.school_id == school_id:
            merged_templates[code] = t.to_dict()

    return jsonify({'data': list(merged_templates.values())}), 200


@notification_center_bp.route('/templates', methods=['POST'])
@role_required(*ADMIN_ROLES)
def create_or_override_template():
    user = get_current_user()
    school_id = _get_target_school_id(user)
    data = request.get_json() or {}

    code = (data.get('code') or '').strip().upper()
    name = (data.get('name') or '').strip()
    category = (data.get('category') or 'GENERAL').strip().upper()
    title_template = (data.get('title_template') or '').strip()
    body_template = (data.get('body_template') or '').strip()
    supported_channels = data.get('supported_channels') or 'in_app,push'
    default_priority = (data.get('default_priority') or 'MEDIUM').strip().upper()
    deep_link_template = (data.get('deep_link_template') or '').strip()

    if isinstance(supported_channels, list):
        supported_channels = ','.join(supported_channels)

    if not code or not name or not title_template or not body_template:
        return jsonify({'error': 'code, name, title_template, and body_template are required'}), 400

    # Check if school already has an override for this code
    existing = NotificationTemplate.query.filter_by(
        school_id=school_id,
        code=code
    ).first()

    if existing:
        existing.name = name
        existing.category = category
        existing.title_template = title_template
        existing.body_template = body_template
        existing.supported_channels = supported_channels
        existing.default_priority = default_priority
        existing.deep_link_template = deep_link_template
        existing.is_active = data.get('is_active', True)
        db.session.commit()
        return jsonify({'message': 'Template updated successfully', 'data': existing.to_dict()}), 200

    new_tpl = NotificationTemplate(
        school_id=school_id,
        code=code,
        name=name,
        category=category,
        title_template=title_template,
        body_template=body_template,
        supported_channels=supported_channels,
        default_priority=default_priority,
        deep_link_template=deep_link_template,
        is_active=data.get('is_active', True),
        is_system=False
    )
    db.session.add(new_tpl)
    db.session.commit()

    return jsonify({'message': 'Template created successfully', 'data': new_tpl.to_dict()}), 201


@notification_center_bp.route('/templates/<int:template_id>', methods=['PUT'])
@role_required(*ADMIN_ROLES)
def update_template(template_id):
    user = get_current_user()
    school_id = _get_target_school_id(user)
    data = request.get_json() or {}

    tpl = NotificationTemplate.query.get_or_404(template_id)

    # If it is a system template (school_id is None), fork it into a school override!
    if tpl.school_id is None:
        forked = NotificationTemplate(
            school_id=school_id,
            code=tpl.code,
            name=data.get('name', tpl.name),
            category=data.get('category', tpl.category),
            title_template=data.get('title_template', tpl.title_template),
            body_template=data.get('body_template', tpl.body_template),
            supported_channels=','.join(data.get('supported_channels')) if isinstance(data.get('supported_channels'), list) else data.get('supported_channels', tpl.supported_channels),
            default_priority=data.get('default_priority', tpl.default_priority),
            deep_link_template=data.get('deep_link_template', tpl.deep_link_template),
            is_active=data.get('is_active', tpl.is_active),
            is_system=False
        )
        db.session.add(forked)
        db.session.commit()
        return jsonify({'message': 'Template customized for school successfully', 'data': forked.to_dict()}), 200

    # If already a school template, ensure ownership
    if tpl.school_id != school_id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Unauthorized access to template'}), 403

    if 'name' in data:
        tpl.name = data['name']
    if 'title_template' in data:
        tpl.title_template = data['title_template']
    if 'body_template' in data:
        tpl.body_template = data['body_template']
    if 'supported_channels' in data:
        channels = data['supported_channels']
        tpl.supported_channels = ','.join(channels) if isinstance(channels, list) else channels
    if 'default_priority' in data:
        tpl.default_priority = data['default_priority']
    if 'deep_link_template' in data:
        tpl.deep_link_template = data['deep_link_template']
    if 'is_active' in data:
        tpl.is_active = data['is_active']

    db.session.commit()
    return jsonify({'message': 'Template updated successfully', 'data': tpl.to_dict()}), 200


@notification_center_bp.route('/templates/<int:template_id>', methods=['DELETE'])
@role_required(*ADMIN_ROLES)
def delete_template(template_id):
    user = get_current_user()
    school_id = _get_target_school_id(user)
    tpl = NotificationTemplate.query.get_or_404(template_id)

    if tpl.is_system or tpl.school_id is None:
        return jsonify({'error': 'System default templates cannot be deleted'}), 400

    if tpl.school_id != school_id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Unauthorized to delete this template'}), 403

    db.session.delete(tpl)
    db.session.commit()
    return jsonify({'message': 'Template deleted successfully'}), 200


# ─── 5. Automation Rules ──────────────────────────────────────────────────────

@notification_center_bp.route('/rules', methods=['GET'])
@role_required(*ADMIN_ROLES)
def list_rules():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    rules = NotificationRule.query.filter_by(school_id=school_id).all()
    return jsonify({'data': [r.to_dict() for r in rules]}), 200


@notification_center_bp.route('/rules', methods=['POST'])
@role_required(*ADMIN_ROLES)
def create_or_update_rule():
    user = get_current_user()
    school_id = _get_target_school_id(user)
    data = request.get_json() or {}

    event_name = (data.get('event_name') or '').strip().lower()
    if not event_name:
        return jsonify({'error': 'event_name is required'}), 400

    rule = NotificationRule.query.filter_by(school_id=school_id, event_name=event_name).first()
    if not rule:
        rule = NotificationRule(school_id=school_id, event_name=event_name)
        db.session.add(rule)

    rule.template_id = data.get('template_id')
    rule.target_roles = ','.join(data.get('target_roles')) if isinstance(data.get('target_roles'), list) else data.get('target_roles', 'ALL')
    rule.channels = ','.join(data.get('channels')) if isinstance(data.get('channels'), list) else data.get('channels', 'in_app,push')
    rule.is_enabled = data.get('is_enabled', True)
    rule.delay_minutes = data.get('delay_minutes', 0)
    rule.condition_json = json.dumps(data.get('conditions', {}))

    db.session.commit()
    return jsonify({'message': 'Rule saved successfully', 'data': rule.to_dict()}), 200


@notification_center_bp.route('/rules/<int:rule_id>/toggle', methods=['PATCH'])
@role_required(*ADMIN_ROLES)
def toggle_rule(rule_id):
    user = get_current_user()
    school_id = _get_target_school_id(user)
    rule = NotificationRule.query.get_or_404(rule_id)

    if rule.school_id != school_id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403

    rule.is_enabled = not rule.is_enabled
    db.session.commit()
    return jsonify({'message': f"Rule {'enabled' if rule.is_enabled else 'disabled'}", 'is_enabled': rule.is_enabled}), 200


@notification_center_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
@role_required(*ADMIN_ROLES)
def delete_rule(rule_id):
    user = get_current_user()
    school_id = _get_target_school_id(user)
    rule = NotificationRule.query.get_or_404(rule_id)

    if rule.school_id != school_id and user.role != UserRole.SUPER_ADMIN:
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(rule)
    db.session.commit()
    return jsonify({'message': 'Rule deleted successfully'}), 200


# ─── 6. Delivery Audit Logs ───────────────────────────────────────────────────

@notification_center_bp.route('/logs', methods=['GET'])
@role_required(*ADMIN_ROLES)
def get_delivery_logs():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    q = NotificationDeliveryLog.query
    if school_id:
        q = q.filter(NotificationDeliveryLog.school_id == school_id)

    status = request.args.get('status')
    if status and status != 'ALL':
        q = q.filter(NotificationDeliveryLog.status == status.upper())

    channel = request.args.get('channel')
    if channel and channel != 'ALL':
        q = q.filter(NotificationDeliveryLog.channel == channel.lower())

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 100)

    paginated = q.order_by(NotificationDeliveryLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        'data': [log.to_dict() for log in paginated.items],
        'total': paginated.total,
        'page': paginated.page,
        'pages': paginated.pages,
    }), 200


# ─── 7. Registered Devices ───────────────────────────────────────────────────

@notification_center_bp.route('/devices', methods=['GET'])
@role_required(*ADMIN_ROLES)
def get_registered_devices():
    user = get_current_user()
    school_id = _get_target_school_id(user)

    q = UserDevice.query.filter(UserDevice.is_active == True)
    if school_id:
        q = q.filter(UserDevice.school_id == school_id)

    platform = request.args.get('platform')
    if platform and platform != 'ALL':
        q = q.filter(UserDevice.platform == platform.lower())

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 100)

    paginated = q.order_by(UserDevice.last_seen.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    data = []
    for d in paginated.items:
        dict_val = d.to_dict()
        dict_val['user_name'] = d.user.name if d.user else 'Unknown'
        dict_val['user_role'] = d.user.role.value if d.user and hasattr(d.user.role, 'value') else str(d.user.role if d.user else '')
        data.append(dict_val)

    return jsonify({
        'data': data,
        'total': paginated.total,
        'page': paginated.page,
        'pages': paginated.pages,
    }), 200


# ─── 8. User Preferences (Self-Service) ───────────────────────────────────────

@notification_center_bp.route('/preferences', methods=['GET'])
@role_required(*ALL_USER_ROLES)
def get_preferences():
    user = get_current_user()
    prefs = NotificationPreference.query.filter_by(user_id=user.id).all()
    return jsonify({
        'data': [p.to_dict() for p in prefs],
        'user_id': user.id
    }), 200


@notification_center_bp.route('/preferences', methods=['PUT'])
@role_required(*ALL_USER_ROLES)
def update_preferences():
    user = get_current_user()
    data = request.get_json() or {}
    items = data.get('preferences', [data]) if isinstance(data, dict) and 'preferences' in data else [data]

    updated = []
    for item in items:
        cat = (item.get('category') or '').strip().upper()
        if not cat:
            continue

        pref = NotificationPreference.query.filter_by(
            user_id=user.id,
            category=cat
        ).first()

        if not pref:
            pref = NotificationPreference(
                user_id=user.id,
                school_id=user.school_id or 1,
                category=cat
            )
            db.session.add(pref)

        if 'in_app_enabled' in item:
            pref.in_app_enabled = bool(item['in_app_enabled'])
        if 'push_enabled' in item:
            pref.push_enabled = bool(item['push_enabled'])
        if 'quiet_hours_start' in item:
            pref.quiet_hours_start = item['quiet_hours_start']
        if 'quiet_hours_end' in item:
            pref.quiet_hours_end = item['quiet_hours_end']

        updated.append(pref)

    db.session.commit()
    return jsonify({
        'message': 'Notification preferences updated successfully',
        'data': [p.to_dict() for p in updated]
    }), 200
