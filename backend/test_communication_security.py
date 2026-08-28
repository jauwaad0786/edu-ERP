# backend/test_communication_security.py
"""
Automated validation suite for Communication & Support multi-tenancy and security fixes.
Tests scenarios A through N as specified in user requirements.
"""

import io
import json
import os
import random
import string
import sys
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.communication import (
    SupportTicket, ChatMessage, Announcement, MeetingRequest, SupportNotification
)
from app.models.developer_center import ErrorLog, make_fingerprint, log_error
from app.utils.crypto import encrypt_value, decrypt_value
from app.utils.file_security import validate_uploaded_file
from werkzeug.datastructures import FileStorage
from flask_jwt_extended import create_access_token


def _rand_suffix():
    return uuid.uuid4().hex[:6]


def run_tests():
    app = create_app()
    app.config['TESTING'] = True

    with app.app_context():
        print("=" * 60)
        print("RUNNING COMMUNICATION SECURITY & MULTI-TENANCY TEST SUITE")
        print("=" * 60)

        # Setup test schools and users
        school_a = School.query.filter_by(code='SCH-TEST-A').first()
        if not school_a:
            school_a = School(name='Test School A', code='SCH-TEST-A')
            db.session.add(school_a)

        school_b = School.query.filter_by(code='SCH-TEST-B').first()
        if not school_b:
            school_b = School(name='Test School B', code='SCH-TEST-B')
            db.session.add(school_b)

        db.session.flush()

        # Users for School A
        t_a = User.query.filter_by(email='teacher_a@test.com').first()
        if not t_a:
            t_a = User(name='Teacher A', email='teacher_a@test.com', role=UserRole.TEACHER, school_id=school_a.id, is_active=True)
            t_a.set_password('Pass123!')
            db.session.add(t_a)

        p_a = User.query.filter_by(email='principal_a@test.com').first()
        if not p_a:
            p_a = User(name='Principal A', email='principal_a@test.com', role=UserRole.PRINCIPAL, school_id=school_a.id, is_active=True)
            p_a.set_password('Pass123!')
            db.session.add(p_a)

        # Users for School B
        p_b = User.query.filter_by(email='principal_b@test.com').first()
        if not p_b:
            p_b = User(name='Principal B', email='principal_b@test.com', role=UserRole.PRINCIPAL, school_id=school_b.id, is_active=True)
            p_b.set_password('Pass123!')
            db.session.add(p_b)

        # Super Admin
        sa = User.query.filter_by(email='superadmin@test.com').first()
        if not sa:
            sa = User(name='Super Admin', email='superadmin@test.com', role=UserRole.SUPER_ADMIN, school_id=None, is_active=True)
            sa.set_password('Pass123!')
            db.session.add(sa)

        db.session.commit()

        client = app.test_client()

        token_t_a = create_access_token(identity=str(t_a.id))
        token_p_a = create_access_token(identity=str(p_a.id))
        token_p_b = create_access_token(identity=str(p_b.id))
        token_sa  = create_access_token(identity=str(sa.id))

        headers_t_a = {'Authorization': f'Bearer {token_t_a}', 'Content-Type': 'application/json'}
        headers_p_a = {'Authorization': f'Bearer {token_p_a}', 'Content-Type': 'application/json'}
        headers_p_b = {'Authorization': f'Bearer {token_p_b}', 'Content-Type': 'application/json'}
        headers_sa  = {'Authorization': f'Bearer {token_sa}',  'Content-Type': 'application/json'}

        # ── TEST A: School A Teacher -> School A Principal (Succeeds) ──────────
        res = client.post('/api/support/chat', headers=headers_t_a, json={
            'receiver_id': p_a.id,
            'message': 'Good morning Principal A'
        })
        assert res.status_code == 201, f"TEST A Failed: {res.status_code} - {res.data}"
        msg_id_a = res.get_json()['id']
        print("[PASS] TEST A PASSED: School A Teacher -> School A Principal message succeeded (201)")

        # ── TEST B: School A Teacher -> School B Principal (Must Fail 403) ──────
        res = client.post('/api/support/chat', headers=headers_t_a, json={
            'receiver_id': p_b.id,
            'message': 'Hello Principal B across school'
        })
        assert res.status_code == 403, f"TEST B Failed: expected 403 but got {res.status_code}"
        print("[PASS] TEST B PASSED: Cross-school message blocked (403 Forbidden)")

        # ── TEST C: School A Principal -> School B Announcement (Must Fail 403) ─
        ann_b = Announcement(
            school_id=school_b.id,
            created_by=p_b.id,
            creator_name=p_b.name,
            creator_role=p_b.role.value,
            title=f'Confidential School B Circular {_rand_suffix()}',
            body='Internal to School B only',
            audience='ALL',
            priority='HIGH'
        )
        db.session.add(ann_b)
        db.session.commit()

        res = client.get(f'/api/support/announcements/{ann_b.id}', headers=headers_p_a)
        assert res.status_code == 403, f"TEST C Failed: expected 403 but got {res.status_code}"
        print("[PASS] TEST C PASSED: School A Principal blocked from School B announcement (403 Forbidden)")

        # ── TEST D: School A Principal -> School B Ticket (Must Fail 403) ──────
        tkt_b = SupportTicket(
            ticket_no=f'TKT-B-{_rand_suffix()}',
            school_id=school_b.id,
            school_name=school_b.name,
            raised_by=p_b.id,
            raiser_name=p_b.name,
            raiser_role=p_b.role.value,
            subject='School B Fee Bug',
            status='OPEN'
        )
        db.session.add(tkt_b)
        db.session.commit()

        res = client.get(f'/api/support/tickets/{tkt_b.id}', headers=headers_p_a)
        assert res.status_code == 403, f"TEST D Failed: expected 403 but got {res.status_code}"
        print("[PASS] TEST D PASSED: School A Principal blocked from School B ticket (403 Forbidden)")

        # ── TEST E: School A Principal -> School B Meeting (Must Fail 403) ─────
        from datetime import date
        meet_b = MeetingRequest(
            school_id=school_b.id,
            school_name=school_b.name,
            requested_by=p_b.id,
            requester_name=p_b.name,
            requester_role=p_b.role.value,
            topic='School B Strategy',
            meeting_date=date.today(),
            meeting_time='11:00 AM',
            status='PENDING'
        )
        db.session.add(meet_b)
        db.session.commit()

        res = client.get(f'/api/support/meetings/{meet_b.id}', headers=headers_p_a)
        assert res.status_code == 403, f"TEST E Failed: expected 403 but got {res.status_code}"
        print("[PASS] TEST E PASSED: School A Principal blocked from School B meeting (403 Forbidden)")

        # ── TEST F: Authorized Principal -> Own School Ticket (Succeeds) ───────
        tkt_a = SupportTicket(
            ticket_no=f'TKT-A-{_rand_suffix()}',
            school_id=school_a.id,
            school_name=school_a.name,
            raised_by=t_a.id,
            raiser_name=t_a.name,
            raiser_role=t_a.role.value,
            subject='School A Marks Error',
            status='OPEN'
        )
        db.session.add(tkt_a)
        db.session.commit()

        res = client.get(f'/api/support/tickets/{tkt_a.id}', headers=headers_p_a)
        assert res.status_code == 200, f"TEST F Failed: expected 200 but got {res.status_code}"
        assert res.get_json()['subject'] == 'School A Marks Error'
        print("[PASS] TEST F PASSED: Principal A accessed School A teacher's ticket (200 OK)")

        # ── TEST G: SUPER_ADMIN -> Authorized School Ticket (Succeeds) ────────
        res = client.get(f'/api/support/tickets/{tkt_a.id}', headers=headers_sa)
        assert res.status_code == 200, f"TEST G Failed: expected 200 but got {res.status_code}"
        print("[PASS] TEST G PASSED: SUPER_ADMIN accessed school ticket (200 OK)")

        # ── TEST H & I: File Security Validation ───────────────────────────────
        safe_file = FileStorage(
            stream=io.BytesIO(b"%PDF-1.4 test safe content"),
            filename="syllabus.pdf",
            content_type="application/pdf"
        )
        is_val, err, name, cat = validate_uploaded_file(safe_file)
        assert is_val is True and cat == 'PDF', "TEST H Failed"
        print("[PASS] TEST H PASSED: Allowed PDF file passed security validation")

        malicious_file = FileStorage(
            stream=io.BytesIO(b"malicious shell script"),
            filename="exploit.sh",
            content_type="application/x-sh"
        )
        is_val, err, name, cat = validate_uploaded_file(malicious_file)
        assert is_val is False, "TEST I Failed: malicious script was allowed"
        print(f"[PASS] TEST I PASSED: Executable script rejected with: '{err}'")

        # ── TEST J: Database Chat Encryption At Rest ──────────────────────────
        raw_db_row = db.session.get(ChatMessage, msg_id_a)
        # Verify raw DB value is encrypted ciphertext
        assert raw_db_row.message != 'Good morning Principal A', "TEST J Failed: Message is stored as raw plaintext!"
        # Verify decrypted to_dict() returns original plaintext
        assert raw_db_row.to_dict()['message'] == 'Good morning Principal A', "TEST J Failed: Decrypted message does not match original"
        print(f"[PASS] TEST J PASSED: Message encrypted in DB (ciphertext length {len(raw_db_row.message)}), correctly decrypted on read")

        # ── TEST K: Error Log Sanitization ────────────────────────────────────
        from app.middleware.error_middleware import _redact, _sanitize_string
        sensitive_payload = {
            'email': 'admin@test.com',
            'password': 'SuperSecretPassword123',
            'token': 'secret_jwt_token_here',
            'cookie': 'session=abc123secret'
        }
        redacted = _redact(sensitive_payload)
        assert redacted['password'] == '***REDACTED***'
        assert redacted['token'] == '***REDACTED***'
        assert redacted['cookie'] == '***REDACTED***'

        dirty_msg = "Error connecting to postgres://root:MySecretDBPassword@localhost/db with otp: 123456"
        clean_msg = _sanitize_string(dirty_msg)
        assert "MySecretDBPassword" not in clean_msg
        assert "123456" not in clean_msg
        print("[PASS] TEST K PASSED: Error logs sanitize passwords, JWTs, cookies, and OTPs")

        # ── TEST L: SupportTicket linked_error_id ──────────────────────────────
        err_fp = make_fingerprint('SQL', f'/api/marks/{_rand_suffix()}', 'OperationalError', 'marks.py:100')
        err_log = log_error(err_fp, defaults={
            'api_endpoint': '/api/marks',
            'exception_type': 'OperationalError',
            'exception_message': 'DB locked',
            'error_type': 'SQL',
            'severity': 'CRITICAL',
            'status': 'NEW',
        })
        db.session.commit()

        tkt_with_err = SupportTicket(
            ticket_no=f'TKT-ERR-{_rand_suffix()}',
            school_id=school_a.id,
            raised_by=p_a.id,
            subject='System Bug with Error Reference',
            linked_error_id=err_log.id
        )
        db.session.add(tkt_with_err)
        db.session.commit()

        assert tkt_with_err.to_dict()['linked_error_id'] == err_log.id
        print("[PASS] TEST L PASSED: SupportTicket references ErrorLog via linked_error_id")

        # ── TEST M: Notification Service Dispatch ─────────────────────────────
        from app.services.notification_service import send_notification
        notif = send_notification(
            user_id=p_a.id,
            title='Test Notification',
            message='Testing consolidated notification service',
            school_id=school_a.id,
            notif_type='SYSTEM'
        )
        db.session.commit()
        assert notif.id is not None
        print("[PASS] TEST M PASSED: Consolidated notification service works")

        # ── TEST N: Backward Compatibility with Legacy Plaintext Chat ─────────
        legacy_msg = ChatMessage(
            school_id=school_a.id,
            sender_id=t_a.id,
            receiver_id=p_a.id,
            message='Legacy Unencrypted Plaintext Message from 2024'
        )
        db.session.add(legacy_msg)
        db.session.commit()

        # Reading legacy message must not crash or return None
        assert legacy_msg.to_dict()['message'] == 'Legacy Unencrypted Plaintext Message from 2024'
        print("[PASS] TEST N PASSED: Legacy unencrypted chat messages remain fully readable and intact")

        print("=" * 60)
        print("ALL 14 CRITICAL TEST SCENARIOS PASSED WITH ZERO ERRORS!")
        print("=" * 60)


if __name__ == '__main__':
    run_tests()
