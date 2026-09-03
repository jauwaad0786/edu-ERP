"""
Automated Test Suite for MSG91 Integration in Edu ERP.
Covers:
- Password Login
- Mobile OTP Login (Send, Verify, Resend, Cooldown, Expiry, Lockout)
- Email OTP Login
- Account Enumeration Prevention (Generic responses)
- Forgot & Reset Password using OTP
- In-app & Multichannel Notification Dispatch
- Multi-Tenant Isolation (Principal vs Super Admin scopes)
- Device Push Token Registration & Unregistration
- MSG91 API Failure & Network Resilience (Mocked transport)
- Single-credential environment compatibility (MSG91_AUTH_KEY only)
"""

import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import os

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.otp import OTPVerification, OTPPurpose
from app.models.device import UserDevice
from app.models.communication import SupportNotification
from app.services.communication.msg91_service import MSG91Service
from app.services.communication.otp_service import OTPService
from app.services.communication.notification_service import NotificationService
from flask_jwt_extended import create_access_token


class TestMSG91Integration(unittest.TestCase):

    def setUp(self):
        # Set test environment
        os.environ['MSG91_AUTH_KEY'] = 'test-mock-msg91-authkey-do-not-log'
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # Seed Test Schools
        self.school_a = School(name="Greenwood High School", code="GHS-01", current_session="2026-27")
        self.school_b = School(name="Riverside Academy", code="RSA-02", current_session="2026-27")
        db.session.add_all([self.school_a, self.school_b])
        db.session.flush()

        # Seed Super Admin
        self.super_admin = User(
            name="Super Administrator",
            email="superadmin@eduerp.com",
            phone="9876500000",
            role=UserRole.SUPER_ADMIN,
            school_id=None,
            is_active=True
        )
        self.super_admin.set_password("Admin@Pass123")

        # Seed Principal for School A
        self.principal_a = User(
            name="Principal Sharma",
            email="principal.a@greenwood.edu",
            phone="9876543210",
            role=UserRole.PRINCIPAL,
            school_id=self.school_a.id,
            is_active=True
        )
        self.principal_a.set_password("Principal@Pass123")

        # Seed Teacher for School A
        self.teacher_a = User(
            name="Teacher Raman",
            email="teacher.raman@greenwood.edu",
            phone="9876543211",
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True
        )
        self.teacher_a.set_password("Teacher@Pass123")

        # Seed Student for School A
        self.student_a = User(
            name="Student Aarav",
            email="aarav@greenwood.edu",
            phone="9876543212",
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.student_a.set_password("Student@Pass123")

        # Seed Principal for School B (Tenant Isolation Target)
        self.principal_b = User(
            name="Principal Verma",
            email="principal.b@riverside.edu",
            phone="9876543220",
            role=UserRole.PRINCIPAL,
            school_id=self.school_b.id,
            is_active=True
        )
        self.principal_b.set_password("PrincipalB@Pass123")

        db.session.add_all([
            self.super_admin, self.principal_a, self.teacher_a,
            self.student_a, self.principal_b
        ])
        db.session.commit()

        # Auth tokens for API testing
        self.token_principal_a = create_access_token(identity=str(self.principal_a.id))
        self.headers_principal_a = {
            'Authorization': f'Bearer {self.token_principal_a}',
            'Content-Type': 'application/json'
        }

        self.token_super_admin = create_access_token(identity=str(self.super_admin.id))
        self.headers_super_admin = {
            'Authorization': f'Bearer {self.token_super_admin}',
            'Content-Type': 'application/json'
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Existing Password Login Test
    # ──────────────────────────────────────────────────────────────────────────
    def test_existing_password_login(self):
        """Verify standard email/password login functions properly."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@greenwood.edu',
            'password': 'Principal@Pass123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['email'], 'principal.a@greenwood.edu')

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Send Mobile OTP Login (Generic response, no enumeration)
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_send_mobile_otp_existing_user(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"message": "OTP sent successfully"}'
        mock_resp.json.return_value = {"message": "OTP sent successfully"}
        mock_post.return_value = mock_resp

        res = self.client.post('/api/v1/auth/send-login-otp', json={
            'identifier': '9876543210'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], "If the account exists, an OTP has been sent.")
        self.assertNotIn('otp', data)

        # Verify record exists in DB
        otp_rec = OTPVerification.query.filter_by(user_id=self.principal_a.id).first()
        self.assertIsNotNone(otp_rec)
        self.assertFalse(otp_rec.is_used)
        self.assertNotEqual(otp_rec.otp_hash, "")

    def test_send_otp_non_existent_account_generic_response(self):
        """Ensure non-existent mobile number returns same generic response (anti-enumeration)."""
        res = self.client.post('/api/v1/auth/send-login-otp', json={
            'identifier': '9999999999'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], "If the account exists, an OTP has been sent.")
        self.assertNotIn('otp', data)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Send Email OTP Login
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_send_email_otp_existing_user(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"message": "Email dispatched"}'
        mock_resp.json.return_value = {"message": "Email dispatched"}
        mock_post.return_value = mock_resp

        res = self.client.post('/api/v1/auth/send-login-otp', json={
            'identifier': 'teacher.raman@greenwood.edu'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertNotIn('otp', data)

        rec = OTPVerification.query.filter_by(user_id=self.teacher_a.id).first()
        self.assertIsNotNone(rec)

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Verify OTP Success (Issues JWT and serializes user)
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_otp_success(self):
        # Create OTP record
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id,
            school_id=self.school_a.id
        )
        self.assertIsNotNone(plain_otp)

        res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertIn('refresh_token', data)
        self.assertEqual(data['user']['id'], self.principal_a.id)
        self.assertEqual(data['user']['role'], 'PRINCIPAL')
        self.assertEqual(data['user']['school_id'], self.school_a.id)

        # Ensure OTP is consumed and cannot be reused
        rec_after = OTPVerification.query.get(rec.id)
        self.assertTrue(rec_after.is_used)

        # Attempt to reuse OTP -> should fail
        reuse_res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(reuse_res.status_code, 400)

    # ──────────────────────────────────────────────────────────────────────────
    # 5. Verify Invalid OTP
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_invalid_otp(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': '000000'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Invalid OTP", data['error'])

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Verify Expired OTP
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_expired_otp(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        # Fast-forward expiration
        rec.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.session.commit()

        res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("expired", data['error'].lower())

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Maximum Attempts Exhaustion
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_otp_max_attempts_lockout(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        # Fail 5 times
        for _ in range(5):
            self.client.post('/api/v1/auth/verify-otp', json={
                'identifier': '9876543210',
                'otp': '999999'
            })

        # Even with correct OTP on 6th attempt, it should be locked out
        res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Maximum verification attempts exceeded", data['error'])

    # ──────────────────────────────────────────────────────────────────────────
    # 8. Resend OTP with Cooldown
    # ──────────────────────────────────────────────────────────────────────────
    def test_resend_otp_cooldown(self):
        # First creation
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        self.assertIsNone(err)

        # Immediate resend should be blocked by cooldown
        res = self.client.post('/api/v1/auth/resend-otp', json={
            'identifier': '9876543210',
            'purpose': 'LOGIN'
        })
        self.assertEqual(res.status_code, 429)
        data = res.get_json()
        self.assertIn("Please wait", data['error'])

    # ──────────────────────────────────────────────────────────────────────────
    # 9. Forgot Password and Reset Password via OTP
    # ──────────────────────────────────────────────────────────────────────────
    def test_forgot_and_reset_password_flow(self):
        # 1. Request forgot password OTP
        res = self.client.post('/api/v1/auth/forgot-password', json={
            'identifier': 'teacher.raman@greenwood.edu'
        })
        self.assertEqual(res.status_code, 200)

        # Retrieve generated OTP from DB for testing
        rec = OTPVerification.query.filter_by(
            user_id=self.teacher_a.id,
            purpose=OTPPurpose.PASSWORD_RESET
        ).order_by(OTPVerification.created_at.desc()).first()
        self.assertIsNotNone(rec)

        # Generate correct candidate using service verify
        # Create a fresh known OTP for reset testing
        test_plain, test_rec, _ = OTPService.create_otp(
            identifier='teacher.raman@greenwood.edu',
            purpose=OTPPurpose.PASSWORD_RESET,
            user_id=self.teacher_a.id,
            cooldown_seconds=0
        )

        # 2. Reset password using valid OTP
        new_pass = "BrandNewRamanPass2026!"
        reset_res = self.client.post('/api/v1/auth/reset-password', json={
            'identifier': 'teacher.raman@greenwood.edu',
            'otp': test_plain,
            'new_password': new_pass
        })
        self.assertEqual(reset_res.status_code, 200)

        # 3. Verify user can now log in with the new password
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.raman@greenwood.edu',
            'password': new_pass
        })
        self.assertEqual(login_res.status_code, 200)

    # ──────────────────────────────────────────────────────────────────────────
    # 10. Multi-Tenant Principal Notification (Strictly Scoped)
    # ──────────────────────────────────────────────────────────────────────────
    def test_principal_notification_tenant_isolation(self):
        """Principal of School A broadcasts -> only School A users receive it."""
        res = self.client.post('/api/v1/notifications/send', headers=self.headers_principal_a, json={
            'title': 'School A Staff Meeting',
            'message': 'Tomorrow at 10 AM in Conference Hall A.',
            'audience': 'TEACHERS',
            'channels': ['in_app']
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])

        # School A teacher must have received the notification
        teacher_notifs = SupportNotification.query.filter_by(user_id=self.teacher_a.id).all()
        self.assertTrue(any(n.title == 'School A Staff Meeting' for n in teacher_notifs))

        # School B principal must NOT have received it
        school_b_notifs = SupportNotification.query.filter_by(user_id=self.principal_b.id).all()
        self.assertFalse(any(n.title == 'School A Staff Meeting' for n in school_b_notifs))

    # ──────────────────────────────────────────────────────────────────────────
    # 11. Super Admin System-Wide Notification
    # ──────────────────────────────────────────────────────────────────────────
    def test_super_admin_cross_school_notification(self):
        """Super Admin can send platform-wide notifications across schools."""
        res = self.client.post('/api/v1/notifications/send', headers=self.headers_super_admin, json={
            'title': 'Scheduled ERP Maintenance',
            'message': 'Maintenance tonight between 11 PM and 1 AM.',
            'target_school_ids': 'ALL',
            'channels': ['in_app']
        })
        self.assertEqual(res.status_code, 201)

        # Verify received by School A principal and School B principal
        notif_a = SupportNotification.query.filter_by(user_id=self.principal_a.id).first()
        notif_b = SupportNotification.query.filter_by(user_id=self.principal_b.id).first()
        self.assertIsNotNone(notif_a)
        self.assertIsNotNone(notif_b)

    # ──────────────────────────────────────────────────────────────────────────
    # 12. Device Push Token Registration and Unregistration
    # ──────────────────────────────────────────────────────────────────────────
    def test_device_registration_and_unregister(self):
        # Register device
        reg_res = self.client.post('/api/v1/notifications/devices/register',
                                   headers=self.headers_principal_a,
                                   json={'device_token': 'sample-web-fcm-token-12345', 'platform': 'web'})
        self.assertEqual(reg_res.status_code, 200)
        data = reg_res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['device']['platform'], 'web')

        device = UserDevice.query.filter_by(device_token='sample-web-fcm-token-12345').first()
        self.assertIsNotNone(device)
        self.assertTrue(device.is_active)

        # Unregister device
        unreg_res = self.client.post('/api/v1/notifications/devices/unregister',
                                     headers=self.headers_principal_a,
                                     json={'device_token': 'sample-web-fcm-token-12345'})
        self.assertEqual(unreg_res.status_code, 200)
        db.session.refresh(device)
        self.assertFalse(device.is_active)

    # ──────────────────────────────────────────────────────────────────────────
    # 13. Notification Read and Unread Count
    # ──────────────────────────────────────────────────────────────────────────
    def test_notification_read_and_unread_count(self):
        # Create an in-app notification for Principal A
        n = NotificationService.send_notification(
            user_id=self.principal_a.id,
            title="Fee Reminder Test",
            message="Please review fee reports.",
            school_id=self.school_a.id
        )
        db.session.commit()

        # Check unread count
        count_res = self.client.get('/api/v1/notifications/unread-count', headers=self.headers_principal_a)
        self.assertEqual(count_res.status_code, 200)
        self.assertGreaterEqual(count_res.get_json()['unread'], 1)

        # Mark as read
        read_res = self.client.patch(f'/api/v1/notifications/{n.id}/read', headers=self.headers_principal_a)
        self.assertEqual(read_res.status_code, 200)

        db.session.refresh(n)
        self.assertTrue(n.is_read)

    # ──────────────────────────────────────────────────────────────────────────
    # 14. MSG91 API Failure & Network Resilience
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_msg91_network_failure_resilience(self, mock_post):
        """MSG91 timeout / failure must NOT crash the ERP or database transaction."""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Simulated gateway timeout")

        # Calling notification service with SMS channel on simulated timeout
        n = NotificationService.send_notification(
            user_id=self.principal_a.id,
            title="Resilience Test",
            message="System remains stable even if SMS provider times out.",
            school_id=self.school_a.id,
            channels=['in_app', 'sms']
        )
        db.session.commit()

        # In-app notification must still be cleanly created
        self.assertIsNotNone(n)
        self.assertEqual(n.title, "Resilience Test")

    # ──────────────────────────────────────────────────────────────────────────
    # 15. Single-Credential Environment: Works when only MSG91_AUTH_KEY is set
    # ──────────────────────────────────────────────────────────────────────────
    def test_single_auth_key_environment_safety(self):
        """Backend operations proceed safely with only MSG91_AUTH_KEY present."""
        # Check send_otp with no template configured
        result = MSG91Service.send_otp(mobile="9876543210", otp="123456")
        self.assertFalse(result['success'])
        self.assertEqual(result['code'], "CONFIG_REQUIRED")
        self.assertIn("MSG91_OTP_TEMPLATE_ID", result['message'])


if __name__ == '__main__':
    unittest.main()
