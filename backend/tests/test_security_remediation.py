"""
Test Suite: SonarQube & Security Remediation Verification
Tests:
1. SEC-01 & SEC-13: CORS allowlist validation and HTTP security headers
2. SEC-02: Plaintext password elimination and safe serialization
3. SEC-03: Multi-tenant IDOR/BOLA authorization checks on attendance endpoints
4. SEC-04: Active school lifecycle and active user account checks in RBAC decorators
5. SEC-05: Financial mass assignment protection on expense status
6. SEC-06 & SEC-07: AI Chatbot RBAC isolation and API key masking
7. SEC-08 & SEC-09: File upload security, magic byte validation, and SSRF prevention
"""

import io
import unittest
from datetime import date
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class
from app.models.finance import Expense
from app.AI.models.ai_models import AIProviderConfig
from app.AI.core.chatbot_service import process_chat
from app.AI.core.intent_router import Intent
from app.utils.file_security import (
    validate_and_sanitize_upload,
    is_safe_public_url,
    ALLOWED_IMAGE_EXTENSIONS
)
from app.utils.security_headers import is_cors_origin_allowed


class TestSecurityRemediation(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # School A (Active)
        self.school_a = School(
            name="Security Alpha Academy",
            code="SAA-001",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_a)
        db.session.flush()

        # School B (Active)
        self.school_b = School(
            name="Security Beta Academy",
            code="SBA-002",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_b)
        db.session.flush()

        # Users
        self.super_admin = User(name="Root Admin", email="root@sec.io", role=UserRole.SUPER_ADMIN, is_active=True)
        self.super_admin.set_password("Admin@12345")

        self.principal_a = User(name="Principal Alpha", email="principal@saa.io", role=UserRole.PRINCIPAL, school_id=self.school_a.id, is_active=True)
        self.principal_a.set_password("Principal@123")

        self.teacher_a = User(name="Teacher Alpha", email="teacher@saa.io", role=UserRole.TEACHER, school_id=self.school_a.id, is_active=True)
        self.teacher_a.set_password("Teacher@123")

        self.teacher_b = User(name="Teacher Beta", email="teacher@sba.io", role=UserRole.TEACHER, school_id=self.school_b.id, is_active=True)
        self.teacher_b.set_password("Teacher@123")

        db.session.add_all([self.super_admin, self.principal_a, self.teacher_a, self.teacher_b])
        db.session.flush()

        # Teacher models
        self.t_model_a = Teacher(user_id=self.teacher_a.id, school_id=self.school_a.id, employee_id="T-A-01")
        self.t_model_b = Teacher(user_id=self.teacher_b.id, school_id=self.school_b.id, employee_id="T-B-01")
        db.session.add_all([self.t_model_a, self.t_model_b])

        # Classes
        self.class_a = Class(name="Grade 10", section="A", school_id=self.school_a.id)
        self.class_b = Class(name="Grade 10", section="B", school_id=self.school_b.id)
        db.session.add_all([self.class_a, self.class_b])
        db.session.flush()

        # Students
        self.student_u_a = User(name="Student A", email="stud_a@saa.io", role=UserRole.STUDENT, school_id=self.school_a.id, is_active=True)
        self.student_u_a.set_password("Student@123")
        self.student_u_b = User(name="Student B", email="stud_b@sba.io", role=UserRole.STUDENT, school_id=self.school_b.id, is_active=True)
        self.student_u_b.set_password("Student@123")
        db.session.add_all([self.student_u_a, self.student_u_b])
        db.session.flush()

        self.student_a = Student(user_id=self.student_u_a.id, school_id=self.school_a.id, class_id=self.class_a.id, admission_no="ADM-A-1", roll_number="101")
        self.student_b = Student(user_id=self.student_u_b.id, school_id=self.school_b.id, class_id=self.class_b.id, admission_no="ADM-B-1", roll_number="102")
        db.session.add_all([self.student_a, self.student_b])
        db.session.commit()

        # Tokens
        self.teacher_a_token = create_access_token(identity=str(self.teacher_a.id))
        self.teacher_a_headers = {'Authorization': f'Bearer {self.teacher_a_token}', 'Content-Type': 'application/json'}

        self.principal_a_token = create_access_token(identity=str(self.principal_a.id))
        self.principal_a_headers = {'Authorization': f'Bearer {self.principal_a_token}', 'Content-Type': 'application/json'}

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
    # 1. SEC-01 & SEC-13: CORS & Security Headers
    # ──────────────────────────────────────────────────────────────────────────
    def test_01_cors_allowlist_rejection(self):
        """Disallowed external origin must NOT be reflected in Access-Control-Allow-Origin."""
        # Allowed origin
        self.assertTrue(is_cors_origin_allowed('http://localhost:3000'))
        self.assertTrue(is_cors_origin_allowed('http://127.0.0.1:5173'))

        # Disallowed origin
        self.assertFalse(is_cors_origin_allowed('https://evil-hacker-site.com'))
        self.assertFalse(is_cors_origin_allowed('http://malicious.org'))

        # HTTP request test
        resp = self.client.get('/health', headers={'Origin': 'https://evil-hacker-site.com'})
        self.assertNotEqual(resp.headers.get('Access-Control-Allow-Origin'), 'https://evil-hacker-site.com')

    def test_02_security_headers_present(self):
        """Standard HTTP responses must include hardened security headers."""
        resp = self.client.get('/health')
        self.assertEqual(resp.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(resp.headers.get('X-Frame-Options'), 'SAMEORIGIN')
        self.assertEqual(resp.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        self.assertIn('Permissions-Policy', resp.headers)

    # ──────────────────────────────────────────────────────────────────────────
    # 2. SEC-02: Password Scrubbing & Safe Serialization
    # ──────────────────────────────────────────────────────────────────────────
    def test_03_plaintext_passwords_scrubbed_and_not_leaked(self):
        """set_password must never store plain_password_temp and to_dict must not expose passwords."""
        u = User(name="Test User", email="test_pass@sec.io", role=UserRole.TEACHER, school_id=self.school_a.id)
        u.set_password("SecretPlainPassword123")
        self.assertIsNone(u.plain_password_temp)
        self.assertTrue(u.check_password("SecretPlainPassword123"))

        d = u.to_dict()
        self.assertNotIn('password', d)
        self.assertNotIn('password_hash', d)
        self.assertNotIn('plain_password_temp', d)

        d_cred = u.to_dict_with_credentials()
        self.assertIsNone(d_cred.get('plain_password_temp'))

    # ──────────────────────────────────────────────────────────────────────────
    # 3. SEC-03: Multi-tenant IDOR/BOLA Protection
    # ──────────────────────────────────────────────────────────────────────────
    def test_04_teacher_cannot_mark_attendance_for_other_school_class(self):
        """Teacher from School A cannot mark attendance for a Class belonging to School B."""
        payload = {
            'class_id': self.class_b.id,  # School B's class
            'date': str(date.today()),
            'records': [
                {'student_id': self.student_b.id, 'status': 'PRESENT'}
            ]
        }
        resp = self.client.post('/api/teacher/attendance', json=payload, headers=self.teacher_a_headers)
        self.assertIn(resp.status_code, [403, 404])

    def test_05_teacher_cannot_submit_other_school_student(self):
        """Teacher from School A cannot inject a student from School B even if class belongs to School A."""
        payload = {
            'class_id': self.class_a.id,  # School A's class
            'date': str(date.today()),
            'records': [
                {'student_id': self.student_b.id, 'status': 'PRESENT'}  # School B's student
            ]
        }
        resp = self.client.post('/api/teacher/attendance', json=payload, headers=self.teacher_a_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('does not belong to this school', resp.get_json().get('error', ''))

    # ──────────────────────────────────────────────────────────────────────────
    # 4. SEC-04: Lifecycle Gating in RBAC
    # ──────────────────────────────────────────────────────────────────────────
    def test_06_suspended_school_token_rejected(self):
        """When school status is SUSPENDED, tenant requests must be rejected with 403."""
        self.school_a.status = 'SUSPENDED'
        db.session.commit()

        resp = self.client.get(f'/api/teacher/attendance/{self.class_a.id}', headers=self.teacher_a_headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn('suspended', resp.get_json().get('error', '').lower())

    def test_07_suspended_user_account_rejected(self):
        """When user account_status is SUSPENDED, requests must be rejected with 403."""
        self.teacher_a.account_status = 'SUSPENDED'
        db.session.commit()

        resp = self.client.get(f'/api/teacher/attendance/{self.class_a.id}', headers=self.teacher_a_headers)
        self.assertEqual(resp.status_code, 403)
        self.assertIn('suspended', resp.get_json().get('error', '').lower())

    # ──────────────────────────────────────────────────────────────────────────
    # 5. SEC-05: Financial Mass Assignment Protection
    # ──────────────────────────────────────────────────────────────────────────
    def test_08_expense_status_mass_assignment_prevented(self):
        """Non-financial staff cannot force expense status to APPROVED."""
        payload = {
            'category': 'OFFICE_SUPPLIES',
            'amount': 2500,
            'description': 'Office pens',
            'expense_date': str(date.today()),
            'status': 'APPROVED'  # Attempting unauthorized pre-approval
        }
        resp = self.client.post('/api/finance/expenses', json=payload, headers=self.teacher_a_headers)
        if resp.status_code == 201:
            data = resp.get_json()
            exp = Expense.query.get(data['expense']['id'])
            # Must be forced to PENDING_APPROVAL for non-financial roles
            self.assertEqual(exp.status, 'PENDING_APPROVAL')

    # ──────────────────────────────────────────────────────────────────────────
    # 6. SEC-06 & SEC-07: AI Chatbot Isolation & API Key Masking
    # ──────────────────────────────────────────────────────────────────────────
    def test_09_ai_chatbot_financial_intent_rbac(self):
        """Teachers cannot query financial intents via AI Chatbot."""
        # Teacher requesting fee collection
        result = process_chat(
            user_id=self.teacher_a.id,
            role='TEACHER',
            school_id=self.school_a.id,
            message="What is the total fee collection for this month?"
        )
        self.assertEqual(result.get('error'), 'UNAUTHORIZED')
        self.assertIn('permission', result.get('answer', '').lower())

    def test_10_ai_config_api_key_masking(self):
        """AI config to_dict_safe must not leak raw decrypted key characters."""
        cfg = AIProviderConfig(
            provider='GEMINI',
            model='gemini-1.5-flash',
            key_configured=True,
            encrypted_api_key='encrypted_blob_data'
        )
        safe = cfg.to_dict_safe()
        self.assertEqual(safe.get('masked_key'), 'Configured ✓')
        self.assertNotIn('encrypted_blob_data', str(safe))

    # ──────────────────────────────────────────────────────────────────────────
    # 7. SEC-08 & SEC-09: File Security & SSRF
    # ──────────────────────────────────────────────────────────────────────────
    def test_11_disallowed_file_extensions_blocked(self):
        """Dangerous executable and script files must be rejected."""
        class MockFile:
            def __init__(self, filename, content=b'malicious'):
                self.filename = filename
                self._buf = io.BytesIO(content)
            def seek(self, *args):
                self._buf.seek(*args)
            def tell(self):
                return self._buf.tell()
            def read(self, *args):
                return self._buf.read(*args)

        # SVG/HTML/EXE should be blocked
        for bad_ext in ['evil.exe', 'script.php', 'xss.svg', 'page.html', 'payload.bat']:
            mock = MockFile(bad_ext)
            with self.assertRaises(ValueError):
                validate_and_sanitize_upload(mock, allowed_types=('image', 'document'))

    def test_12_magic_byte_verification(self):
        """Spoofed file extension with mismatched magic bytes must be rejected."""
        class MockFile:
            def __init__(self, filename, content):
                self.filename = filename
                self._buf = io.BytesIO(content)
            def seek(self, *args):
                self._buf.seek(*args)
            def tell(self):
                return self._buf.tell()
            def read(self, *args):
                return self._buf.read(*args)

        # File named .pdf but containing random plaintext
        fake_pdf = MockFile('fake.pdf', b'This is plain text and not a pdf file')
        with self.assertRaises(ValueError):
            validate_and_sanitize_upload(fake_pdf, allowed_types=('pdf',))

        # Real PDF magic bytes '%PDF-1.5'
        valid_pdf = MockFile('valid.pdf', b'%PDF-1.5 test content')
        name, ext, size = validate_and_sanitize_upload(valid_pdf, allowed_types=('pdf',))
        self.assertEqual(ext, 'pdf')

    def test_13_ssrf_url_validation(self):
        """Private, loopback, and cloud metadata URLs must be rejected by SSRF guard."""
        self.assertFalse(is_safe_public_url('http://127.0.0.1:8080/admin'))
        self.assertFalse(is_safe_public_url('http://localhost:5000/keys'))
        self.assertFalse(is_safe_public_url('http://169.254.169.254/latest/meta-data/'))
        self.assertFalse(is_safe_public_url('http://metadata.google.internal/'))
        self.assertFalse(is_safe_public_url('ftp://example.com/file'))
        self.assertFalse(is_safe_public_url('file:///etc/passwd'))


if __name__ == '__main__':
    unittest.main()
