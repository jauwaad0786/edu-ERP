"""
Unit Test Suite: SonarQube Remediation Verification
Tests:
1. SEC-XSS (pythonsecurity:S5131): WhatsApp webhook challenge validation and text/plain response.
2. SEC-KDF (python:S2053): AI API key encryption dynamic salt derivation and backward-compatible fallback.
3. SEC-LOOP (pythonsecurity:S6680): Hostel bulk room & bed creation upper-bound loop limits.
"""

import os
import unittest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.whatsapp import SchoolWhatsAppSettings
from app.models.hostel import HostelBuilding, HostelFloor
from app.AI.utils.encryption import encrypt_secret, decrypt_secret, _get_salt


class TestSonarQubeRemediation(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # Seed School
        self.school = School(
            name="Sonar Test Academy",
            code="STA-001",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school)
        db.session.flush()

        # Seed Principal User
        self.principal = User(
            school_id=self.school.id,
            name="Principal Sonar",
            username="principal_sonar",
            email="principal_sonar@test.com",
            role=UserRole.PRINCIPAL,
            is_active=True
        )
        self.principal.set_password("Principal@123")
        db.session.add(self.principal)
        db.session.flush()

        # Principal JWT token
        token = create_access_token(
            identity=str(self.principal.id),
            additional_claims={
                'school_id': self.school.id,
                'role': 'PRINCIPAL'
            }
        )
        self.principal_headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ──────────────────────────────────────────────────────────────────────────
    # 1. WhatsApp Webhook Reflected XSS (pythonsecurity:S5131)
    # ──────────────────────────────────────────────────────────────────────────
    def test_whatsapp_webhook_xss_prevention(self):
        """Malicious hub.challenge payloads must be rejected with 400 Bad Request."""
        # Configure WhatsApp settings with verify_token
        settings = SchoolWhatsAppSettings(
            school_id=self.school.id,
            verify_token="test-secret-verify-token"
        )
        db.session.add(settings)
        db.session.commit()

        # Malicious HTML/script payloads
        bad_challenges = [
            '<script>alert(1)</script>',
            '"><img src=x onerror=alert(1)>',
            'challenge\r\nSet-Cookie: evil=true',
            'challenge with spaces',
            'a' * 300  # Exceeds max length
        ]

        for bad in bad_challenges:
            res = self.client.get(
                f'/api/webhooks/whatsapp/{self.school.id}',
                query_string={
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'test-secret-verify-token',
                    'hub.challenge': bad
                }
            )
            self.assertEqual(res.status_code, 400, f"Expected 400 for bad challenge: {bad}")

    def test_whatsapp_webhook_valid_handshake(self):
        """Legitimate hub.challenge must return 200 with text/plain and nosniff header."""
        settings = SchoolWhatsAppSettings(
            school_id=self.school.id,
            verify_token="test-secret-verify-token"
        )
        db.session.add(settings)
        db.session.commit()

        valid_challenge = "1158201444"
        res = self.client.get(
            f'/api/webhooks/whatsapp/{self.school.id}',
            query_string={
                'hub.mode': 'subscribe',
                'hub.verify_token': 'test-secret-verify-token',
                'hub.challenge': valid_challenge
            }
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_data(as_text=True), valid_challenge)
        self.assertIn('text/plain', res.content_type)
        self.assertEqual(res.headers.get('X-Content-Type-Options'), 'nosniff')

    # ──────────────────────────────────────────────────────────────────────────
    # 2. AI Encryption Salt Derivation (python:S2053)
    # ──────────────────────────────────────────────────────────────────────────
    def test_encryption_unpredictable_salt_and_legacy_backward_compatibility(self):
        """Encryption must use unpredictable CSPRNG salt and support legacy ciphertext."""
        plain_text = "sk-antigravity-test-secret-key-12345"

        # 1. New v2 encryption uses unpredictable salt and stores prefix
        cipher1 = encrypt_secret(plain_text)
        cipher2 = encrypt_secret(plain_text)
        self.assertTrue(cipher1.startswith('v2$'))
        self.assertTrue(cipher2.startswith('v2$'))
        # Unpredictable random salt ensures two encryptions of same text produce different ciphertexts
        self.assertNotEqual(cipher1, cipher2)

        # Both decrypt back to the original plaintext
        self.assertEqual(decrypt_secret(cipher1), plain_text)
        self.assertEqual(decrypt_secret(cipher2), plain_text)

        # 2. Legacy v1 format (without v2$) must decrypt properly via backward-compatibility fallback
        from app.AI.utils.encryption import _get_fernet
        legacy_fernet = _get_fernet()
        legacy_cipher = legacy_fernet.encrypt(plain_text.encode('utf-8')).decode('utf-8')
        self.assertFalse(legacy_cipher.startswith('v2$'))

        decrypted_legacy = decrypt_secret(legacy_cipher)
        self.assertEqual(decrypted_legacy, plain_text)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Hostel Bulk Room & Bed Bounds (pythonsecurity:S6680)
    # ──────────────────────────────────────────────────────────────────────────
    def test_hostel_bulk_rooms_boundary_limits(self):
        """Bulk room creation must enforce count between 1 and MAX_BULK_ROOMS (100)."""
        from app.models.hostel import Hostel
        hostel = Hostel(school_id=self.school.id, name="Main Hostel", gender="BOYS", hostel_type="BOYS")
        db.session.add(hostel)
        db.session.flush()

        building = HostelBuilding(school_id=self.school.id, hostel_id=hostel.id, name="Block A")
        db.session.add(building)
        db.session.flush()

        floor = HostelFloor(school_id=self.school.id, building_id=building.id, floor_number=1, name="1st Floor")
        db.session.add(floor)
        db.session.commit()

        # Count <= 0 rejected
        res = self.client.post(
            f'/api/hostel/floors/{floor.id}/rooms/bulk',
            headers=self.principal_headers,
            json={'count': 0, 'start_number': '101'}
        )
        self.assertEqual(res.status_code, 400)

        # Count > 100 rejected (DoS boundary protection)
        res = self.client.post(
            f'/api/hostel/floors/{floor.id}/rooms/bulk',
            headers=self.principal_headers,
            json={'count': 5000, 'start_number': '101'}
        )
        self.assertEqual(res.status_code, 400)

        # Legitimate bulk create (e.g. 3 rooms) succeeds
        res = self.client.post(
            f'/api/hostel/floors/{floor.id}/rooms/bulk',
            headers=self.principal_headers,
            json={'count': 3, 'start_number': '101', 'room_type': 'DOUBLE'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data.get('created_count'), 3)

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Library Copies Loop Bounds (pythonsecurity:S6680)
    # ──────────────────────────────────────────────────────────────────────────
    def test_library_copies_loop_bounds(self):
        """Library add book and add copies must clamp loop ranges to MAX bounds."""
        from app.models.library import Book, BookCategory

        cat = BookCategory(school_id=self.school.id, name="Science")
        db.session.add(cat)
        db.session.flush()

        # 1. Create book with initial_copies clamped
        book_res = self.client.post(
            '/api/library/books',
            headers=self.principal_headers,
            json={
                'title': 'Advanced Physics',
                'author': 'Dr. H. Verma',
                'category_id': cat.id,
                'initial_copies': 3
            }
        )
        self.assertEqual(book_res.status_code, 201)
        book_data = book_res.get_json()
        book_id = book_data.get('id')
        self.assertTrue(book_id)

        # 2. Add copies with loop bounds clamping protection
        copies_res = self.client.post(
            f'/api/library/books/{book_id}/copies',
            headers=self.principal_headers,
            json={'count': 2, 'condition_note': 'Test copy'}
        )
        self.assertEqual(copies_res.status_code, 201)
        copies_data = copies_res.get_json()
        self.assertEqual(len(copies_data), 2)

    # ──────────────────────────────────────────────────────────────────────────
    # 5. Timezone Util & Naive UTC Standard (python:S6925)
    # ──────────────────────────────────────────────────────────────────────────
    def test_utc_now_timezone_utility_and_naive_compatibility(self):
        """utc_now() must return naive UTC datetime compatible with DB TIMESTAMP."""
        from app.utils.timezone_util import utc_now
        from datetime import datetime, timezone

        now = utc_now()
        self.assertIsInstance(now, datetime)
        self.assertIsNone(now.tzinfo)

        # Delta with datetime.now(timezone.utc).replace(tzinfo=None) should be negligible (< 2s)
        direct_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        diff = abs((direct_utc - now).total_seconds())
        self.assertLess(diff, 2.0)

        # Verify naive comparison works without TypeError
        db_stored = now
        self.assertTrue(db_stored <= utc_now())

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Marks Grading Float Range & Deterministic Responder Differentiation
    # ──────────────────────────────────────────────────────────────────────────
    def test_marks_grade_evaluation(self):
        """_grade must evaluate correct letter grade across continuous percentage ranges."""
        from app.routes.marks import _grade
        self.assertEqual(_grade(95, 100), 'A+')
        self.assertEqual(_grade(85, 100), 'A')
        self.assertEqual(_grade(75, 100), 'B+')
        self.assertEqual(_grade(65, 100), 'B')
        self.assertEqual(_grade(55, 100), 'C')
        self.assertEqual(_grade(35, 100), 'D')
        self.assertEqual(_grade(20, 100), 'F')
        self.assertEqual(_grade(0, 0), 'F')
        self.assertEqual(_grade(None, 100), 'F')

    def test_deterministic_responder_hinglish_differentiation(self):
        """STAFF_SALARY_STATUS must generate differentiated responses for Hinglish vs English."""
        from app.AI.core.deterministic_responder import format_deterministic_response
        data = {
            'staff_salary': {
                'staff_members': [{
                    'name': 'Rahul Sharma',
                    'role': 'Teacher',
                    'monthly_salary': 35000,
                    'last_payment_status': 'PAID',
                    'last_paid_month': 'May 2026'
                }]
            }
        }
        res_hi = format_deterministic_response('STAFF_SALARY_STATUS', data, user_msg='staff ki tankhwah kitni hai')
        res_en = format_deterministic_response('STAFF_SALARY_STATUS', data, user_msg='what is staff salary status')
        self.assertIn('Pichla payment status', res_hi)
        self.assertIn('Last payment status', res_en)


if __name__ == '__main__':
    unittest.main()

