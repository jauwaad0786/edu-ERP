"""
Test Suite: School Arrival Notification & Verification System (Phase 4)
Tests:
1. Staff records physical arrival & dispatches parent notification
2. Duplicate arrival marking prevention (same school, student, date)
3. Multi-tenant isolation: Staff from School B cannot mark student from School A
4. Parent YES confirmation updates status to CONFIRMED_YES with timestamp
5. Parent NO confirmation updates status to REPORTED_NO and triggers principal discrepancy alert
6. Unauthorized parent response attempt rejected with 403 Forbidden
7. Response idempotency / duplicate submission rejection
8. Secure token-based confirmation (SMS / WhatsApp link endpoint)
9. Expiration sweep transitions unresponded events to NO_RESPONSE
10. Principal arrival monitoring dashboard & discrepancy resolution workflow
"""

import unittest
from datetime import date, datetime, timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class
from app.models.arrival import StudentArrivalEvent
from app.models.communication import SupportNotification
from app.services.arrival_service import ArrivalService


class TestArrivalNotificationSystem(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # School A
        self.school_a = School(
            name="Springfield Academy",
            code="SPA-001",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_a)

        # School B
        self.school_b = School(
            name="Shelbyville Prep",
            code="SVP-002",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_b)
        db.session.flush()

        # Staff School A
        self.principal_a = User(
            name="Principal Skinner",
            email="principal@springfield.edu",
            phone="9876543001",
            role=UserRole.PRINCIPAL,
            school_id=self.school_a.id,
            is_active=True
        )
        self.principal_a.set_password("Pass@123")

        self.teacher_a = User(
            name="Ms. Krabappel",
            email="teacher@springfield.edu",
            phone="9876543002",
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True
        )
        self.teacher_a.set_password("Pass@123")

        # Staff School B
        self.teacher_b = User(
            name="Mr. Shelby",
            email="teacher@shelbyville.edu",
            phone="9876543003",
            role=UserRole.TEACHER,
            school_id=self.school_b.id,
            is_active=True
        )
        self.teacher_b.set_password("Pass@123")

        # Parent A (Linked to Student A)
        self.parent_a = User(
            name="Homer Simpson",
            email="homer@springfield.edu",
            phone="9876543100",
            role=UserRole.PARENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.parent_a.set_password("Pass@123")

        # Parent B (Linked to Student B)
        self.parent_b = User(
            name="Ned Flanders",
            email="flanders@shelbyville.edu",
            phone="9876543200",
            role=UserRole.PARENT,
            school_id=self.school_b.id,
            is_active=True
        )
        self.parent_b.set_password("Pass@123")

        db.session.add_all([
            self.principal_a, self.teacher_a, self.teacher_b,
            self.parent_a, self.parent_b
        ])
        db.session.flush()

        # Classes
        self.class_a = Class(name="Grade 4", section="A", school_id=self.school_a.id)
        self.class_b = Class(name="Grade 4", section="B", school_id=self.school_b.id)
        db.session.add_all([self.class_a, self.class_b])
        db.session.flush()

        # Student A (School A, parent Homer)
        self.student_u_a = User(
            name="Bart Simpson",
            email="bart@springfield.edu",
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.student_u_a.set_password("Pass@123")
        db.session.add(self.student_u_a)
        db.session.flush()

        self.student_a = Student(
            user_id=self.student_u_a.id,
            school_id=self.school_a.id,
            class_id=self.class_a.id,
            admission_no="ADM-SPA-001",
            roll_number="10",
            parent_name="Homer Simpson",
            parent_phone="9876543100",
            parent_email="homer@springfield.edu"
        )
        db.session.add(self.student_a)

        # Student B (School B, parent Flanders)
        self.student_u_b = User(
            name="Rod Flanders",
            email="rod@shelbyville.edu",
            role=UserRole.STUDENT,
            school_id=self.school_b.id,
            is_active=True
        )
        self.student_u_b.set_password("Pass@123")
        db.session.add(self.student_u_b)
        db.session.flush()

        self.student_b = Student(
            user_id=self.student_u_b.id,
            school_id=self.school_b.id,
            class_id=self.class_b.id,
            admission_no="ADM-SVP-001",
            roll_number="01",
            parent_name="Ned Flanders",
            parent_phone="9876543200",
            parent_email="flanders@shelbyville.edu"
        )
        db.session.add(self.student_b)
        db.session.commit()

        # Auth Tokens
        self.principal_a_token = create_access_token(identity=str(self.principal_a.id))
        self.principal_a_headers = {'Authorization': f'Bearer {self.principal_a_token}', 'Content-Type': 'application/json'}

        self.teacher_a_token = create_access_token(identity=str(self.teacher_a.id))
        self.teacher_a_headers = {'Authorization': f'Bearer {self.teacher_a_token}', 'Content-Type': 'application/json'}

        self.teacher_b_token = create_access_token(identity=str(self.teacher_b.id))
        self.teacher_b_headers = {'Authorization': f'Bearer {self.teacher_b_token}', 'Content-Type': 'application/json'}

        self.parent_a_token = create_access_token(identity=str(self.parent_a.id))
        self.parent_a_headers = {'Authorization': f'Bearer {self.parent_a_token}', 'Content-Type': 'application/json'}

        self.parent_b_token = create_access_token(identity=str(self.parent_b.id))
        self.parent_b_headers = {'Authorization': f'Bearer {self.parent_b_token}', 'Content-Type': 'application/json'}

    def tearDown(self):
        try:
            db.session.rollback()
            db.session.remove()
            with db.engine.connect() as conn:
                conn.execute(db.text("PRAGMA foreign_keys = OFF;"))
                conn.commit()
            db.drop_all()
        except Exception:
            pass
        self.app_context.pop()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Staff records physical arrival successfully
    # ──────────────────────────────────────────────────────────────────────────
    def test_01_staff_records_arrival_successfully(self):
        """Staff marks student physical arrival; event is created and parent notification is queued/dispatched."""
        today_str = date.today().isoformat()
        res = self.client.post(
            '/api/arrivals/record',
            headers=self.teacher_a_headers,
            json={
                'student_id': self.student_a.id,
                'arrival_date': today_str
            }
        )
        self.assertEqual(res.status_code, 201, f"Failed with {res.data}")
        data = res.get_json()
        self.assertIn('event', data)
        event_data = data['event']
        self.assertEqual(event_data['student_id'], self.student_a.id)
        self.assertEqual(event_data['delivery_status'], 'DELIVERED')
        self.assertEqual(event_data['response_status'], 'AWAITING_RESPONSE')
        self.assertIsNotNone(event_data['token'])

        # Verify DB persistence
        event = StudentArrivalEvent.query.get(event_data['id'])
        self.assertIsNotNone(event)
        self.assertEqual(event.school_id, self.school_a.id)
        self.assertEqual(event.recorded_by_id, self.teacher_a.id)

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Duplicate arrival marking prevention
    # ──────────────────────────────────────────────────────────────────────────
    def test_02_duplicate_arrival_prevention(self):
        """Cannot mark duplicate arrival for the same student on the same date."""
        today_str = date.today().isoformat()
        # First recording
        res1 = self.client.post(
            '/api/arrivals/record',
            headers=self.teacher_a_headers,
            json={'student_id': self.student_a.id, 'arrival_date': today_str}
        )
        self.assertEqual(res1.status_code, 201)

        # Second recording on same date must return 409 Conflict
        res2 = self.client.post(
            '/api/arrivals/record',
            headers=self.teacher_a_headers,
            json={'student_id': self.student_a.id, 'arrival_date': today_str}
        )
        self.assertEqual(res2.status_code, 409)
        self.assertIn('already marked', res2.get_json().get('error', '').lower())

        # Bulk record should cleanly skip duplicate
        bulk_res = self.client.post(
            '/api/arrivals/bulk-record',
            headers=self.teacher_a_headers,
            json={'student_ids': [self.student_a.id], 'arrival_date': today_str}
        )
        self.assertIn(bulk_res.status_code, [200, 201])
        bulk_data = bulk_res.get_json()
        self.assertEqual(bulk_data['created_count'], 0)
        self.assertEqual(bulk_data['duplicate_count'], 1)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Multi-tenant isolation
    # ──────────────────────────────────────────────────────────────────────────
    def test_03_multi_tenant_isolation_staff_cannot_mark_other_school(self):
        """Teacher from School B cannot record arrival for a student in School A."""
        today_str = date.today().isoformat()
        res = self.client.post(
            '/api/arrivals/record',
            headers=self.teacher_b_headers,  # School B
            json={'student_id': self.student_a.id, 'arrival_date': today_str}  # School A student
        )
        self.assertIn(res.status_code, [403, 404])

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Parent YES confirmation updates status
    # ──────────────────────────────────────────────────────────────────────────
    def test_04_parent_yes_confirmation(self):
        """Parent taps 'YES' -> status transitions to CONFIRMED_YES, response_at is stored."""
        today_str = date.today().isoformat()
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )

        res = self.client.post(
            f'/api/arrivals/{event.id}/respond',
            headers=self.parent_a_headers,
            json={'response': 'YES'}
        )
        self.assertEqual(res.status_code, 200, f"Error: {res.data}")
        data = res.get_json()
        self.assertEqual(data['status'], 'CONFIRMED_YES')
        self.assertIsNotNone(data['response_at'])

        # DB check
        refreshed = StudentArrivalEvent.query.get(event.id)
        self.assertEqual(refreshed.response_status, 'CONFIRMED_YES')
        self.assertEqual(refreshed.responded_by_id, self.parent_a.id)

    # ──────────────────────────────────────────────────────────────────────────
    # 5. Parent NO confirmation triggers discrepancy alert
    # ──────────────────────────────────────────────────────────────────────────
    def test_05_parent_no_confirmation_triggers_discrepancy_alert(self):
        """Parent taps 'NO' -> status transitions to REPORTED_NO and alert is dispatched to school principal."""
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )

        res = self.client.post(
            f'/api/arrivals/{event.id}/respond',
            headers=self.parent_a_headers,
            json={'response': 'NO'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'REPORTED_NO')

        refreshed = StudentArrivalEvent.query.get(event.id)
        self.assertEqual(refreshed.response_status, 'REPORTED_NO')
        self.assertFalse(refreshed.discrepancy_resolved)

        # Verify an urgent discrepancy notification was created for principal
        discrepancy_notifs = SupportNotification.query.filter(
            SupportNotification.school_id == self.school_a.id,
            SupportNotification.title.ilike('%Discrepancy%')
        ).all()
        self.assertGreaterEqual(len(discrepancy_notifs), 1)

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Unauthorized parent response attempt rejected
    # ──────────────────────────────────────────────────────────────────────────
    def test_06_unauthorized_parent_response_rejected(self):
        """Parent B (Ned Flanders) cannot confirm arrival for Student A (Bart Simpson)."""
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )

        res = self.client.post(
            f'/api/arrivals/{event.id}/respond',
            headers=self.parent_b_headers,  # Unrelated parent
            json={'response': 'YES'}
        )
        self.assertEqual(res.status_code, 403)
        err_msg = res.get_json().get('error', '').lower()
        self.assertTrue('not authorized' in err_msg or 'access denied' in err_msg)

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Response idempotency / duplicate submission
    # ──────────────────────────────────────────────────────────────────────────
    def test_07_idempotent_duplicate_response(self):
        """Parent cannot change response or duplicate submission after responding."""
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )

        # First YES
        res1 = self.client.post(
            f'/api/arrivals/{event.id}/respond',
            headers=self.parent_a_headers,
            json={'response': 'YES'}
        )
        self.assertEqual(res1.status_code, 200)

        # Second YES attempt must return 409 Conflict
        res2 = self.client.post(
            f'/api/arrivals/{event.id}/respond',
            headers=self.parent_a_headers,
            json={'response': 'YES'}
        )
        self.assertEqual(res2.status_code, 409)
        self.assertIn('already confirmed', res2.get_json().get('error', '').lower())

    # ──────────────────────────────────────────────────────────────────────────
    # 8. Secure token-based confirmation (SMS/WhatsApp link)
    # ──────────────────────────────────────────────────────────────────────────
    def test_08_public_token_link_response(self):
        """Parent responding via unique UUID token without needing app login."""
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )
        token = event.uuid_token

        # Fetch token details
        get_res = self.client.get(f'/api/arrivals/uuid/{token}')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()['student_name'], self.student_a.user.name)

        # Respond via token
        post_res = self.client.post(
            f'/api/arrivals/uuid/{token}/respond',
            json={'response': 'YES'}
        )
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.get_json()['status'], 'CONFIRMED_YES')

    # ──────────────────────────────────────────────────────────────────────────
    # 9. Expiration sweep transitions unresponded events to NO_RESPONSE
    # ──────────────────────────────────────────────────────────────────────────
    def test_09_expiration_sweep(self):
        """Unresponded events past the deadline transition to NO_RESPONSE."""
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=date.today()
        )
        # Set expires_at to 10 minutes in the past
        event.expires_at = datetime.utcnow() - timedelta(minutes=10)
        db.session.commit()

        # Run sweep
        expired_count = ArrivalService.sweep_expired_events()
        self.assertGreaterEqual(expired_count, 1)

        refreshed = StudentArrivalEvent.query.get(event.id)
        self.assertEqual(refreshed.response_status, 'NO_RESPONSE')

    # ──────────────────────────────────────────────────────────────────────────
    # 10. Principal arrival dashboard & discrepancy resolution workflow
    # ──────────────────────────────────────────────────────────────────────────
    def test_10_principal_dashboard_and_discrepancy_resolution(self):
        """Principal views arrival dashboard with KPIs and resolves discrepancy with audit notes."""
        today = date.today()
        event, _ = ArrivalService.record_arrival(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by_id=self.teacher_a.id,
            arrival_date=today
        )
        # Parent reported NO
        ArrivalService.process_parent_response(event, 'NO', parent_id=self.parent_a.id)

        # Principal views dashboard
        dash_res = self.client.get(
            f'/api/arrivals/dashboard?date={today.isoformat()}',
            headers=self.principal_a_headers
        )
        self.assertEqual(dash_res.status_code, 200)
        dash_data = dash_res.get_json()
        self.assertEqual(dash_data['summary']['total_events'], 1)
        self.assertEqual(dash_data['summary']['reported_no'], 1)

        # Principal resolves the discrepancy
        resolve_res = self.client.post(
            f'/api/arrivals/{event.id}/resolve',
            headers=self.principal_a_headers,
            json={'resolution_notes': 'Verified student arrived at 8:40 AM via bus #3. Parent notified.'}
        )
        self.assertEqual(resolve_res.status_code, 200)

        # Verify DB updated
        refreshed = StudentArrivalEvent.query.get(event.id)
        self.assertTrue(refreshed.discrepancy_resolved)
        self.assertEqual(refreshed.resolved_by_id, self.principal_a.id)
        self.assertIn('bus #3', refreshed.resolution_notes)


if __name__ == '__main__':
    unittest.main()
