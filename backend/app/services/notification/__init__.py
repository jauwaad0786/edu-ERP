"""
Notification Module Services Package.
"""

from app.services.notification.push_provider import (
    BasePushProvider,
    ExpoPushProvider,
    WebPushProvider,
    PushDispatcher,
    push_dispatcher
)
from app.services.notification.template_renderer import TemplateRenderer
from app.services.notification.preference_checker import PreferenceChecker
from app.services.notification.recipient_resolver import RecipientResolver
from app.services.notification.notification_engine import NotificationEngine
from app.services.notification.event_emitter import emit_notification_event
from app.services.notification.scheduler_jobs import (
    process_scheduled_notifications_job,
    cleanup_old_notifications_job
)


def seed_default_notification_templates():
    """
    Seeds standard platform default templates (school_id = None) if not present.
    """
    from app import db
    from app.models.notification import NotificationTemplate

    default_templates = [
        {
            'code': 'FEE_REMINDER',
            'name': 'Fee Payment Reminder',
            'category': 'FEES',
            'title_template': 'Fee Reminder: {student_name}',
            'body_template': 'Dear Parent, fee of Rs. {amount} for {student_name} is due by {due_date}. Please pay promptly.',
            'supported_channels': 'in_app,push',
            'default_priority': 'HIGH',
            'deep_link_template': '/fees',
            'is_system': True
        },
        {
            'code': 'FEE_COLLECTED',
            'name': 'Fee Payment Received',
            'category': 'FEES',
            'title_template': 'Payment Received: Rs. {amount}',
            'body_template': 'Payment of Rs. {amount} for {student_name} received successfully. Receipt #{receipt_no}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/fees',
            'is_system': True
        },
        {
            'code': 'ATTENDANCE_ABSENT',
            'name': 'Student Absence Alert',
            'category': 'ATTENDANCE',
            'title_template': 'Absence Notice: {student_name}',
            'body_template': 'Dear Parent, {student_name} was marked absent on {date}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'HIGH',
            'deep_link_template': '/attendance',
            'is_system': True
        },
        {
            'code': 'EXAM_PUBLISHED',
            'name': 'Exam Schedule Published',
            'category': 'EXAMS',
            'title_template': 'Exam Schedule: {exam_title}',
            'body_template': 'The schedule for {exam_title} has been published. Exams commence on {start_date}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/exams',
            'is_system': True
        },
        {
            'code': 'RESULT_ANNOUNCED',
            'name': 'Exam Results Declared',
            'category': 'RESULTS',
            'title_template': 'Results Declared: {exam_title}',
            'body_template': 'Exam results for {student_name} in {exam_title} have been declared.',
            'supported_channels': 'in_app,push',
            'default_priority': 'HIGH',
            'deep_link_template': '/results',
            'is_system': True
        },
        {
            'code': 'HOSTEL_OUTPASS',
            'name': 'Hostel Outpass Status',
            'category': 'HOSTEL',
            'title_template': 'Hostel Outpass: {status}',
            'body_template': 'Outpass request for {student_name} has been {status}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/hostel',
            'is_system': True
        },
        {
            'code': 'TRANSPORT_DELAY',
            'name': 'Transport Delay Notice',
            'category': 'TRANSPORT',
            'title_template': 'Bus Route Alert: {route_name}',
            'body_template': 'School bus on route {route_name} is delayed by {delay_minutes} mins.',
            'supported_channels': 'in_app,push',
            'default_priority': 'HIGH',
            'deep_link_template': '/transport',
            'is_system': True
        },
        {
            'code': 'PAYROLL_GENERATED',
            'name': 'Salary Slip Processed',
            'category': 'HRMS',
            'title_template': 'Salary Slip: {month_year}',
            'body_template': 'Your salary slip for {month_year} has been processed. Net amount: Rs. {net_amount}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/payroll',
            'is_system': True
        },
        {
            'code': 'ADMISSION_CONFIRMED',
            'name': 'Admission Confirmed',
            'category': 'ADMISSION',
            'title_template': 'Admission Confirmed: {student_name}',
            'body_template': 'Welcome! Admission for {student_name} has been confirmed. Admission No: {admission_no}.',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/admissions',
            'is_system': True
        },
        {
            'code': 'ANNOUNCEMENT_BROADCAST',
            'name': 'School Announcement',
            'category': 'COMMUNICATION',
            'title_template': 'Announcement: {title}',
            'body_template': '{message}',
            'supported_channels': 'in_app,push',
            'default_priority': 'MEDIUM',
            'deep_link_template': '/announcements',
            'is_system': True
        },
    ]

    count = 0
    for tpl_data in default_templates:
        existing = NotificationTemplate.query.filter_by(
            school_id=None,
            code=tpl_data['code']
        ).first()
        if not existing:
            new_tpl = NotificationTemplate(
                school_id=None,
                code=tpl_data['code'],
                name=tpl_data['name'],
                category=tpl_data['category'],
                title_template=tpl_data['title_template'],
                body_template=tpl_data['body_template'],
                supported_channels=tpl_data['supported_channels'],
                default_priority=tpl_data['default_priority'],
                deep_link_template=tpl_data['deep_link_template'],
                is_system=True,
                is_active=True
            )
            db.session.add(new_tpl)
            count += 1

    if count > 0:
        db.session.commit()
        print(f"[OK] Seeded {count} default platform notification templates")


__all__ = [
    'BasePushProvider',
    'ExpoPushProvider',
    'WebPushProvider',
    'PushDispatcher',
    'push_dispatcher',
    'TemplateRenderer',
    'PreferenceChecker',
    'RecipientResolver',
    'NotificationEngine',
    'emit_notification_event',
    'process_scheduled_notifications_job',
    'cleanup_old_notifications_job',
    'seed_default_notification_templates',
]
