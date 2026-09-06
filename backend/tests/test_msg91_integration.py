"""
Automated Test Suite for MSG91 Integration in Edu ERP.
Covers:
- Standard Password Login
- Mobile OTP Login (Send via MSG91, Verify, Resend, Cooldown, Expiry, Lockout)
- Email OTP safely disabled when domain is unconfigured
- Fixing HTTP 200 bug: Non-200 (502) returned when MSG91 dispatch fails
- Account Enumeration Prevention (Generic responses for unknown accounts)
- Forgot & Reset Password using Mobile OTP
- Email Forgot Password returns safe unavailable response
- In-app & Multichannel Notification Dispatch
- Multi-Tenant Isolation (Principal vs Super Admin scopes)
- Device Push Token Registration & Unregistration
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
        # Set test environment with only MSG91_AUTH_KEY
        os.environ['MSG91_AUTH_KEY'] = 'test-mock-msg91-authkey-do-not-log'
        os.environ.pop('MSG91_EMAIL_DOMAIN', None)
        os.environ.pop('MSG91_OTP_TEMPLATE_ID', None)
        self.app = create_app('testing')
        self.app.config['RATELIMIT_ENABLED'] = False
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
    # 2. Send Mobile OTP Login (Successful dispatch via MSG91 mock)
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_send_mobile_otp_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"message": "OTP sent successfully"}'
        mock_resp.json.return_value = {"message": "OTP sent successfully"}
        mock_post.return_value = mock_resp

        # Give mock template_id for live dispatch mock
        with patch.object(MSG91Service, 'get_config_val', return_value='test-template-id'):
            res = self.client.post('/api/v1/auth/send-login-otp', json={
                'identifier': '9876543210'
            })
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['success'])
            self.assertIn("OTP has been sent", data['message'])
            self.assertNotIn('otp', data)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. MSG91 Failure Returns Non-200 (Fixing HTTP 200 bug)
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_send_mobile_otp_failure_returns_502(self, mock_post):
        """When MSG91 fails (e.g. 403, 500, timeout), backend must NOT return 200."""
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.text = '{"status":"fail","errors":["Plan expired"],"code":403}'
        mock_post.return_value = mock_resp

        with patch.object(MSG91Service, 'get_config_val', return_value='test-template-id'):
            res = self.client.post('/api/v1/auth/send-login-otp', json={
                'identifier': '9876543210'
            })
            self.assertEqual(res.status_code, 502)
            data = res.get_json()
            self.assertFalse(data['success'])
            self.assertEqual(data['message'], "Unable to send OTP at this time.")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Email OTP Disabled Without Domain Configuration
    # ──────────────────────────────────────────────────────────────────────────
    def test_send_email_otp_disabled_without_domain(self):
        """If user tries email OTP without verified domain, return safe 400 error."""
        res = self.client.post('/api/v1/auth/send-login-otp', json={
            'identifier': 'teacher.raman@greenwood.edu'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertEqual(data['message'], "Email OTP is currently unavailable. Please use mobile OTP.")

    # ──────────────────────────────────────────────────────────────────────────
    # 5. Anti-Enumeration Generic Response
    # ──────────────────────────────────────────────────────────────────────────
    def test_send_otp_non_existent_account_generic_response(self):
        """Ensure non-existent mobile returns generic success to prevent enumeration."""
        res = self.client.post('/api/v1/auth/send-login-otp', json={
            'identifier': '9999999999'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertNotIn('otp', data)

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Verify Valid Mobile OTP
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_otp_success(self):
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

        # One-time use verification
        rec_after = db.session.get(OTPVerification, rec.id)
        self.assertTrue(rec_after.is_used)

        # Re-use attempt must fail
        reuse_res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(reuse_res.status_code, 400)

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Verify Invalid OTP
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
    # 8. Verify Expired OTP
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_expired_otp(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
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
    # 9. Maximum Attempts Lockout
    # ──────────────────────────────────────────────────────────────────────────
    def test_verify_otp_max_attempts_lockout(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        for _ in range(5):
            self.client.post('/api/v1/auth/verify-otp', json={
                'identifier': '9876543210',
                'otp': '999999'
            })

        res = self.client.post('/api/v1/auth/verify-otp', json={
            'identifier': '9876543210',
            'otp': plain_otp
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Maximum verification attempts exceeded", data['error'])

    # ──────────────────────────────────────────────────────────────────────────
    # 10. Resend OTP Cooldown
    # ──────────────────────────────────────────────────────────────────────────
    def test_resend_otp_cooldown(self):
        plain_otp, rec, err = OTPService.create_otp(
            identifier='9876543210',
            purpose=OTPPurpose.LOGIN,
            user_id=self.principal_a.id
        )
        self.assertIsNone(err)

        res = self.client.post('/api/v1/auth/resend-otp', json={
            'identifier': '9876543210',
            'purpose': 'LOGIN'
        })
        self.assertEqual(res.status_code, 429)
        data = res.get_json()
        self.assertIn("Please wait", data['message'])

    # ──────────────────────────────────────────────────────────────────────────
    # 11. Mobile Forgot Password & Reset Flow
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_forgot_and_reset_password_via_mobile(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"message": "OTP sent successfully"}'
        mock_resp.json.return_value = {"message": "OTP sent successfully"}
        mock_post.return_value = mock_resp

        with patch.object(MSG91Service, 'get_config_val', return_value='test-template-id'):
            # 1. Request forgot password OTP via mobile number
            res = self.client.post('/api/v1/auth/forgot-password', json={
                'identifier': '9876543211'
            })
            self.assertEqual(res.status_code, 200)

        # 2. Reset password using valid OTP
        test_plain, test_rec, _ = OTPService.create_otp(
            identifier='9876543211',
            purpose=OTPPurpose.PASSWORD_RESET,
            user_id=self.teacher_a.id,
            cooldown_seconds=0
        )

        new_pass = "BrandNewTeacherPass2026!"
        reset_res = self.client.post('/api/v1/auth/reset-password', json={
            'identifier': '9876543211',
            'otp': test_plain,
            'new_password': new_pass
        })
        self.assertEqual(reset_res.status_code, 200)

        # 3. Verify teacher can now log in with new password
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.raman@greenwood.edu',
            'password': new_pass
        })
        self.assertEqual(login_res.status_code, 200)

    # ──────────────────────────────────────────────────────────────────────────
    # 12. Email Forgot Password Disabled
    # ──────────────────────────────────────────────────────────────────────────
    def test_forgot_password_email_unavailable(self):
        res = self.client.post('/api/v1/auth/forgot-password', json={
            'identifier': 'teacher.raman@greenwood.edu'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("Email password reset is currently unavailable", data['message'])

    # ──────────────────────────────────────────────────────────────────────────
    # 13. Tenant Isolation
    # ──────────────────────────────────────────────────────────────────────────
    def test_principal_notification_tenant_isolation(self):
        res = self.client.post('/api/v1/notifications/send', headers=self.headers_principal_a, json={
            'title': 'School A Meeting',
            'message': 'Staff meeting at 10 AM.',
            'audience': 'TEACHERS',
            'channels': ['in_app']
        })
        self.assertEqual(res.status_code, 201)

        teacher_notifs = SupportNotification.query.filter_by(user_id=self.teacher_a.id).all()
        self.assertTrue(any(n.title == 'School A Meeting' for n in teacher_notifs))

        school_b_notifs = SupportNotification.query.filter_by(user_id=self.principal_b.id).all()
        self.assertFalse(any(n.title == 'School A Meeting' for n in school_b_notifs))

    # ──────────────────────────────────────────────────────────────────────────
    # 14. Super Admin Platform Notification
    # ──────────────────────────────────────────────────────────────────────────
    def test_super_admin_cross_school_notification(self):
        res = self.client.post('/api/v1/notifications/send', headers=self.headers_super_admin, json={
            'title': 'Scheduled ERP Maintenance',
            'message': 'Tonight at 11 PM.',
            'target_school_ids': 'ALL',
            'channels': ['in_app']
        })
        self.assertEqual(res.status_code, 201)

        notif_a = SupportNotification.query.filter_by(user_id=self.principal_a.id).first()
        notif_b = SupportNotification.query.filter_by(user_id=self.principal_b.id).first()
        self.assertIsNotNone(notif_a)
        self.assertIsNotNone(notif_b)

    # ──────────────────────────────────────────────────────────────────────────
    # 15. Device Push Token Registration & Unregister
    # ──────────────────────────────────────────────────────────────────────────
    def test_device_registration_and_unregister(self):
        reg_res = self.client.post('/api/v1/notifications/devices/register',
                                   headers=self.headers_principal_a,
                                   json={'device_token': 'sample-token-123', 'platform': 'web'})
        self.assertEqual(reg_res.status_code, 200)

        device = UserDevice.query.filter_by(device_token='sample-token-123').first()
        self.assertIsNotNone(device)
        self.assertTrue(device.is_active)

        unreg_res = self.client.post('/api/v1/notifications/devices/unregister',
                                     headers=self.headers_principal_a,
                                     json={'device_token': 'sample-token-123'})
        self.assertEqual(unreg_res.status_code, 200)
        db.session.refresh(device)
        self.assertFalse(device.is_active)

    # ──────────────────────────────────────────────────────────────────────────
    # 16. Notification Read & Unread Count
    # ──────────────────────────────────────────────────────────────────────────
    def test_notification_read_and_unread_count(self):
        n = NotificationService.send_notification(
            user_id=self.principal_a.id,
            title="Fee Reminder",
            message="Please review collections.",
            school_id=self.school_a.id
        )
        db.session.commit()

        count_res = self.client.get('/api/v1/notifications/unread-count', headers=self.headers_principal_a)
        self.assertEqual(count_res.status_code, 200)
        self.assertGreaterEqual(count_res.get_json()['unread'], 1)

        read_res = self.client.patch(f'/api/v1/notifications/{n.id}/read', headers=self.headers_principal_a)
        self.assertEqual(read_res.status_code, 200)

        db.session.refresh(n)
        self.assertTrue(n.is_read)

    # ──────────────────────────────────────────────────────────────────────────
    # 17. Single Authkey Environment Safety
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_single_auth_key_environment_safety(self, mock_post):
        """Backend safely handles send_otp without crashing when MSG91_OTP_TEMPLATE_ID is absent."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = '{"message": "OTP sent successfully"}'
        mock_resp.json.return_value = {"message": "OTP sent successfully"}
        mock_post.return_value = mock_resp

        result = MSG91Service.send_otp(mobile="9876543210", otp="123456")
        self.assertTrue(result['success'])
        called_params = mock_post.call_args[1].get('params', {})
        self.assertNotIn('template_id', called_params)
        self.assertEqual(called_params['mobile'], '919876543210')

    # ──────────────────────────────────────────────────────────────────────────
    # 18. Finance Monthly Trend Endpoint
    # ──────────────────────────────────────────────────────────────────────────
    def test_finance_monthly_trend(self):
        res = self.client.get('/api/finance/monthly-trend?months=6', headers=self.headers_principal_a)
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.get_json(), list)

    # ──────────────────────────────────────────────────────────────────────────
    # 19. MSG91 Widget OTP Access Token Verification
    # ──────────────────────────────────────────────────────────────────────────
    @patch('app.services.communication.msg91_service.requests.post')
    def test_widget_otp_verification_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "message": "Access Token Verified Successfully",
            "type": "success",
            "data": "919876543210"
        }
        mock_post.return_value = mock_resp

        res = self.client.post('/api/v1/auth/verify-widget-otp', json={
            'access_token': 'sample.jwt.widget.token',
            'identifier': '9876543210'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['phone'], '9876543210')

    @patch('app.services.communication.msg91_service.requests.post')
    def test_widget_otp_verification_invalid(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "message": "Token expired or invalid",
            "type": "error"
        }
        mock_post.return_value = mock_resp

        res = self.client.post('/api/v1/auth/verify-widget-otp', json={
            'access_token': 'invalid.token'
        })
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn('error', data)


if __name__ == '__main__':
    unittest.main()

