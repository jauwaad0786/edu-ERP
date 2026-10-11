"""
Arrival Service
Handles recording physical arrival events, dispatching multi-channel notifications to parents,
processing interactive YES / NO responses, discrepancy alerts, auto-expiry to NO_RESPONSE,
and live school monitoring dashboards.
"""

from datetime import datetime, date, timedelta
import logging
from uuid import uuid4
from sqlalchemy import or_, and_, func

from app import db
from app.models.arrival import StudentArrivalEvent
from app.models.academic import Student, Class
from app.models.user import User, UserRole
from app.models.communication import SupportNotification
from app.services.communication.notification_service import NotificationService
from app.utils.timezone_util import utc_now

logger = logging.getLogger('arrival_service')


def _clean_phone(phone_str):
    if not phone_str:
        return ''
    cleaned = ''.join(c for c in str(phone_str) if c.isdigit())
    return cleaned[-10:] if len(cleaned) >= 10 else cleaned


def _find_linked_parent(student, school_id):
    """
    Finds linked parent User account for the student within the school.
    Matches by:
    1. Parent phone (exact or last 10 digits)
    2. Parent email
    3. Student's own user account if assigned role PARENT
    """
    clean_p_phone = _clean_phone(student.parent_phone)
    p_email = (student.parent_email or '').strip().lower()

    parent_users = User.query.filter(
        User.school_id == school_id,
        User.role == UserRole.PARENT,
        User.is_active == True,
        User.is_deleted == False
    ).all()

    for u in parent_users:
        if p_email and u.email and u.email.strip().lower() == p_email:
            return u
        u_clean_phone = _clean_phone(u.phone)
        if clean_p_phone and u_clean_phone and clean_p_phone == u_clean_phone:
            return u

    return None


class ArrivalService:

    @classmethod
    def record_arrival(cls, school_id, student_id, recorded_by_user=None, recorded_by_id=None, arrival_time=None, arrival_date=None, notes=None):
        """
        Record a student's physical arrival and dispatch parent notification.
        Prevents accidental duplicates for the same student on the same date.
        """
        student = Student.query.filter_by(id=student_id, school_id=school_id, is_deleted=False).first()
        if not student:
            raise ValueError(f"Student ID {student_id} not found in school {school_id}")

        recorder_id = None
        if hasattr(recorded_by_user, 'id'):
            recorder_id = recorded_by_user.id
        elif isinstance(recorded_by_user, int):
            recorder_id = recorded_by_user
        elif recorded_by_id:
            recorder_id = recorded_by_id
        if not recorder_id:
            recorder_id = 1

        if not arrival_date:
            arrival_date = date.today()
        elif isinstance(arrival_date, str):
            arrival_date = datetime.strptime(arrival_date[:10], '%Y-%m-%d').date()

        if not arrival_time:
            arrival_time = utc_now()
        elif isinstance(arrival_time, str):
            try:
                arrival_time = datetime.fromisoformat(arrival_time.replace('Z', '+00:00'))
            except Exception:
                arrival_time = utc_now()

        # Idempotency check: duplicate prevention
        existing = StudentArrivalEvent.query.filter_by(
            school_id=school_id,
            student_id=student_id,
            arrival_date=arrival_date
        ).first()

        if existing:
            return existing, False  # (event, created=False)

        # Expiration window: 120 minutes from arrival time
        expires_at = arrival_time + timedelta(minutes=120)

        # Parent linkage
        parent_user = _find_linked_parent(student, school_id)
        parent_user_id = parent_user.id if parent_user else None
        parent_phone = student.parent_phone or (parent_user.phone if parent_user else None)
        parent_name = student.parent_name or student.father_name or (parent_user.name if parent_user else None)

        event = StudentArrivalEvent(
            event_uuid=str(uuid4()),
            school_id=school_id,
            student_id=student_id,
            class_id=student.class_id,
            session=student.session or '2026-27',
            arrival_date=arrival_date,
            arrival_time=arrival_time,
            recorded_by=recorder_id,
            parent_user_id=parent_user_id,
            parent_phone=parent_phone,
            parent_name=parent_name,
            delivery_status='DELIVERED',
            response_status='AWAITING_RESPONSE',
            expires_at=expires_at,
            created_at=utc_now(),
        )
        db.session.add(event)
        db.session.flush()

        # Dispatch Parent Notification
        student_name = student.user.name if (student.user and student.user.name) else f"Student #{student.roll_number or student.id}"
        formatted_time = arrival_time.strftime('%I:%M %p')
        title = f"School Arrival: {student_name}"
        message = f"Your child, {student_name}, has been marked as arrived at school today at {formatted_time}. Please confirm."

        metadata = {
            'arrival_event_id': event.id,
            'event_uuid': event.event_uuid,
            'student_id': student.id,
            'student_name': student_name,
            'arrival_date': arrival_date.isoformat(),
            'arrival_time': arrival_time.isoformat(),
            'expires_at': expires_at.isoformat(),
            'actions': ['YES', 'NO'],
        }

        # Send to parent user if account exists
        notif_record = None
        if parent_user:
            try:
                notif_record = NotificationService.send_notification(
                    user_id=parent_user.id,
                    title=title,
                    message=message,
                    school_id=school_id,
                    notif_type='ARRIVAL_CONFIRMATION',
                    priority='HIGH',
                    created_by=recorded_by_user.id,
                    metadata=metadata,
                    channels=['in_app', 'push', 'sms']
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch arrival notification to parent user {parent_user.id}: {e}")
                event.delivery_status = 'FAILED'

        if notif_record:
            event.notification_id = notif_record.id

        # Audit log
        try:
            from app.models.audit import log_school_action
            from app.routes.auth import _extract_client_meta
            log_school_action(
                school_id=school_id,
                user=recorded_by_user,
                module='arrival',
                submodule='student_arrival',
                action='ARRIVAL_RECORDED',
                remarks=f"Marked arrival for {student_name} at {formatted_time}",
                request_meta=_extract_client_meta()
            )
        except Exception:
            pass

        db.session.commit()
        return event, True

    @classmethod
    def record_bulk_arrivals(cls, school_id, student_ids, recorded_by_user, arrival_date=None):
        """Record arrival for multiple students in one batch."""
        if not student_ids:
            return {'recorded': 0, 'already_existing': 0, 'events': []}

        recorded_count = 0
        existing_count = 0
        events_list = []

        for sid in student_ids:
            try:
                event, created = cls.record_arrival(
                    school_id=school_id,
                    student_id=sid,
                    recorded_by_user=recorded_by_user,
                    arrival_date=arrival_date
                )
                if created:
                    recorded_count += 1
                else:
                    existing_count += 1
                events_list.append(event.to_dict())
            except Exception as e:
                logger.warning(f"Error recording arrival for student {sid}: {e}")

        return {
            'recorded': recorded_count,
            'created_count': recorded_count,
            'already_existing': existing_count,
            'duplicate_count': existing_count,
            'total_processed': len(student_ids),
            'events': events_list
        }

    @classmethod
    def record_parent_response(cls, event_id_or_uuid, response_value, parent_user, response_notes=None):
        """
        Handles interactive parent response (YES or NO).
        Enforces:
        1. Role & ownership validation (parent authorized for this child).
        2. Idempotency (already confirmed/rejected returns current state).
        3. Expiration guard (past deadline cannot alter expired state).
        4. NO response immediate discrepancy staff notification.
        """
        response_clean = str(response_value or '').strip().upper()
        if response_clean not in ('YES', 'NO'):
            raise ValueError("Response must be exactly 'YES' or 'NO'")

        # Query by ID or UUID
        query = StudentArrivalEvent.query
        if isinstance(event_id_or_uuid, StudentArrivalEvent):
            event = event_id_or_uuid
        elif isinstance(event_id_or_uuid, int) or (isinstance(event_id_or_uuid, str) and event_id_or_uuid.isdigit()):
            event = query.filter_by(id=int(event_id_or_uuid)).first()
        else:
            event = query.filter_by(event_uuid=str(event_id_or_uuid)).first()

        if not event:
            raise ValueError("Arrival event not found")

        # Resolve parent user if integer ID passed
        if isinstance(parent_user, int):
            parent_user = User.query.get(parent_user)

        # Multi-tenant & Parent Authorization Check
        if parent_user:
            # Super admin bypass
            is_super = getattr(parent_user, 'role', None) == UserRole.SUPER_ADMIN
            if not is_super:
                if event.school_id != parent_user.school_id:
                    raise PermissionError("Access denied: Event belongs to a different school")

                # Verify student belongs to this parent
                student = event.student
                clean_p_phone = _clean_phone(parent_user.phone)
                clean_stu_parent_phone = _clean_phone(student.parent_phone) if student else ''
                clean_stu_guard_phone = _clean_phone(student.guardian_phone) if student else ''

                is_authorized = (
                    (event.parent_user_id == parent_user.id) or
                    (student and student.user_id == parent_user.id) or
                    (student and student.parent_email and student.parent_email.strip().lower() == (parent_user.email or '').strip().lower()) or
                    (clean_p_phone and clean_stu_parent_phone and clean_p_phone == clean_stu_parent_phone) or
                    (clean_p_phone and clean_stu_guard_phone and clean_p_phone == clean_stu_guard_phone) or
                    (getattr(parent_user.role, 'value', str(parent_user.role)) in ('PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'))
                )
                if not is_authorized:
                    raise PermissionError("You are not authorized to respond for this student")

        # Expiry Check
        now = utc_now()
        now_naive = now.replace(tzinfo=None) if now.tzinfo else now
        exp_naive = event.expires_at.replace(tzinfo=None) if (event.expires_at and event.expires_at.tzinfo) else event.expires_at

        if exp_naive and now_naive > exp_naive and event.response_status == 'AWAITING_RESPONSE':
            event.response_status = 'NO_RESPONSE'
            db.session.commit()
            return {
                'success': False,
                'expired': True,
                'status': 'NO_RESPONSE',
                'event': event.to_dict(),
                'error': 'Arrival confirmation window has expired'
            }

        # Idempotency Check
        if event.response_status in ('CONFIRMED_YES', 'REPORTED_NO'):
            return {
                'success': True,
                'already_responded': True,
                'status': event.response_status,
                'event': event.to_dict(),
                'message': f"Response has already been recorded as {event.response_status}"
            }

        # Update Event
        event.response_timestamp = now
        event.responded_by_user_id = parent_user.id if parent_user else None
        event.response_notes = (response_notes or '').strip()[:255]

        student_name = event.student.user.name if (event.student and event.student.user) else f"Student #{event.student_id}"

        if response_clean == 'YES':
            event.response_status = 'CONFIRMED_YES'
        else:
            event.response_status = 'REPORTED_NO'
            event.is_discrepancy_resolved = False

            # Alert authorized school staff immediately of discrepancy!
            principals = User.query.filter_by(
                school_id=event.school_id,
                role=UserRole.PRINCIPAL,
                is_active=True
            ).all()

            for princ in principals:
                try:
                    NotificationService.send_notification(
                        user_id=princ.id,
                        title=f"URGENT DISCREPANCY: {student_name} Not Reached School Reported!",
                        message=f"Parent reported that student {student_name} did NOT reach school today, despite staff marking arrival. Immediate verification required.",
                        school_id=event.school_id,
                        notif_type='SYSTEM',
                        priority='CRITICAL',
                        metadata={
                            'discrepancy': True,
                            'arrival_event_id': event.id,
                            'student_id': event.student_id,
                            'parent_phone': event.parent_phone,
                        },
                        channels=['in_app', 'push', 'sms']
                    )
                except Exception as ex:
                    logger.warning(f"Failed to alert principal {princ.id} of arrival discrepancy: {ex}")

        # Update in-app notification state if linked
        if event.notification_id:
            notif = SupportNotification.query.get(event.notification_id)
            if notif:
                notif.is_read = True
                notif.read_at = now

        # Audit log
        try:
            from app.models.audit import log_school_action
            from app.routes.auth import _extract_client_meta
            log_school_action(
                school_id=event.school_id,
                user=parent_user,
                module='arrival',
                submodule='parent_response',
                action='ARRIVAL_RESPONSE_' + event.response_status,
                remarks=f"Parent recorded {event.response_status} for {student_name}",
                request_meta=_extract_client_meta()
            )
        except Exception:
            pass

        db.session.commit()
        return {
            'success': True,
            'status': event.response_status,
            'response_at': event.response_timestamp.isoformat() if event.response_timestamp else None,
            'response_timestamp': event.response_timestamp.isoformat() if event.response_timestamp else None,
            'event': event.to_dict(),
            'message': "Thank you. Your response has been recorded."
        }

    @classmethod
    def resolve_discrepancy(cls, event_id, staff_user, resolution_notes):
        """Staff resolves a reported discrepancy after verifying physical presence."""
        event = StudentArrivalEvent.query.filter_by(id=event_id, school_id=staff_user.school_id).first()
        if not event:
            raise ValueError("Arrival event not found")

        event.is_discrepancy_resolved = True
        event.discrepancy_resolved_at = utc_now()
        event.discrepancy_resolved_by = staff_user.id
        event.discrepancy_resolution_notes = (resolution_notes or 'Verified by staff').strip()[:255]

        db.session.commit()
        return event.to_dict()

    @classmethod
    def sweep_expired_events(cls, school_id=None):
        """
        Sweeps all events that have expired past deadline and still have response_status == 'AWAITING_RESPONSE'.
        Transitions them to 'NO_RESPONSE'.
        """
        now = utc_now()
        q = StudentArrivalEvent.query.filter(
            StudentArrivalEvent.response_status == 'AWAITING_RESPONSE',
            StudentArrivalEvent.expires_at < now
        )
        if school_id:
            q = q.filter(StudentArrivalEvent.school_id == school_id)
        count = q.update({'response_status': 'NO_RESPONSE'}, synchronize_session=False)
        if count > 0:
            db.session.commit()
        return count

    @classmethod
    def process_parent_response(cls, event_id_or_uuid, response_value, parent_user=None, parent_id=None, response_notes=None):
        """Convenience alias for test suites and background handlers."""
        target_parent = parent_user or parent_id
        return cls.record_parent_response(
            event_id_or_uuid=event_id_or_uuid,
            response_value=response_value,
            parent_user=target_parent,
            response_notes=response_notes
        )

    @classmethod
    def get_school_dashboard(cls, school_id, arrival_date=None, class_id=None, section=None, response_status=None, student_id=None, page=1, per_page=50):
        """
        Aggregated arrival metrics and individual event drilldown for School Staff.
        """
        if not arrival_date:
            arrival_date = date.today()
        elif isinstance(arrival_date, str):
            arrival_date = datetime.strptime(arrival_date[:10], '%Y-%m-%d').date()

        # Sweep expired awaiting responses to NO_RESPONSE
        now = utc_now()
        expired_q = StudentArrivalEvent.query.filter(
            StudentArrivalEvent.school_id == school_id,
            StudentArrivalEvent.arrival_date == arrival_date,
            StudentArrivalEvent.response_status == 'AWAITING_RESPONSE',
            StudentArrivalEvent.expires_at < now
        )
        expired_count = expired_q.update({'response_status': 'NO_RESPONSE'}, synchronize_session=False)
        if expired_count > 0:
            db.session.commit()

        base_q = StudentArrivalEvent.query.filter_by(school_id=school_id, arrival_date=arrival_date)

        if class_id:
            base_q = base_q.filter(StudentArrivalEvent.class_id == class_id)
        if student_id:
            base_q = base_q.filter(StudentArrivalEvent.student_id == student_id)

        # Calculate metrics in single aggregate query
        stats_rows = db.session.query(
            StudentArrivalEvent.response_status,
            StudentArrivalEvent.delivery_status,
            StudentArrivalEvent.is_discrepancy_resolved,
            func.count(StudentArrivalEvent.id)
        ).filter(
            StudentArrivalEvent.school_id == school_id,
            StudentArrivalEvent.arrival_date == arrival_date
        ).group_by(
            StudentArrivalEvent.response_status,
            StudentArrivalEvent.delivery_status,
            StudentArrivalEvent.is_discrepancy_resolved
        ).all()

        total_events = 0
        confirmed_yes = 0
        reported_no = 0
        awaiting_response = 0
        no_response = 0
        delivery_failures = 0
        unresolved_discrepancies = 0

        for r_stat, d_stat, is_res, cnt in stats_rows:
            total_events += cnt
            if r_stat == 'CONFIRMED_YES':
                confirmed_yes += cnt
            elif r_stat == 'REPORTED_NO':
                reported_no += cnt
                if not is_res:
                    unresolved_discrepancies += cnt
            elif r_stat == 'AWAITING_RESPONSE':
                awaiting_response += cnt
            elif r_stat == 'NO_RESPONSE':
                no_response += cnt

            if d_stat == 'FAILED':
                delivery_failures += cnt

        # Filter events list
        list_q = base_q
        if response_status:
            list_q = list_q.filter(StudentArrivalEvent.response_status == response_status.upper())

        paginated = list_q.order_by(StudentArrivalEvent.arrival_time.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        metrics_dict = {
            'total_arrivals': total_events,
            'total_events': total_events,
            'confirmed_yes': confirmed_yes,
            'reported_no': reported_no,
            'awaiting_response': awaiting_response,
            'no_response': no_response,
            'delivery_failures': delivery_failures,
            'unresolved_discrepancies': unresolved_discrepancies,
            'confirmation_rate': round((confirmed_yes / total_events * 100), 1) if total_events > 0 else 0.0,
        }
        return {
            'date': arrival_date.isoformat(),
            'metrics': metrics_dict,
            'summary': metrics_dict,
            'events': [e.to_dict() for e in paginated.items],
            'page': paginated.page,
            'pages': paginated.pages,
            'total': paginated.total,
        }

    @classmethod
    def get_parent_pending_confirmations(cls, parent_user):
        """
        Returns all arrival events for the parent's children for today.
        """
        if not parent_user:
            return []

        school_id = parent_user.school_id
        today = date.today()

        # Find children
        clean_p_phone = _clean_phone(parent_user.phone)
        p_email = (parent_user.email or '').strip().lower()

        students = Student.query.filter(
            Student.school_id == school_id,
            Student.is_deleted == False
        ).all()

        matched_student_ids = []
        for s in students:
            stu_phone = _clean_phone(s.parent_phone)
            stu_guard = _clean_phone(s.guardian_phone)
            stu_email = (s.parent_email or '').strip().lower()
            if (
                s.user_id == parent_user.id or
                (clean_p_phone and stu_phone and clean_p_phone == stu_phone) or
                (clean_p_phone and stu_guard and clean_p_phone == stu_guard) or
                (p_email and stu_email and p_email == stu_email)
            ):
                matched_student_ids.append(s.id)

        if not matched_student_ids:
            return []

        # Sweep expired
        now = utc_now()
        StudentArrivalEvent.query.filter(
            StudentArrivalEvent.student_id.in_(matched_student_ids),
            StudentArrivalEvent.arrival_date == today,
            StudentArrivalEvent.response_status == 'AWAITING_RESPONSE',
            StudentArrivalEvent.expires_at < now
        ).update({'response_status': 'NO_RESPONSE'}, synchronize_session=False)
        db.session.commit()

        events = StudentArrivalEvent.query.filter(
            StudentArrivalEvent.student_id.in_(matched_student_ids),
            StudentArrivalEvent.arrival_date == today
        ).order_by(StudentArrivalEvent.arrival_time.desc()).all()

        return [e.to_dict() for e in events]
