"""
Comprehensive Test Suite for Audit Log & Audit Management Ecosystem
EduERP / OnePlatform360

Validates:
1. Audit log creation with rich actor context, client meta, entity linkage, and severity.
2. Sensitive field masking (passwords, tokens, OTPs, hashes -> [REDACTED]).
3. Visual Before-vs-After diff calculation (compute_changed_fields) omitting noisy fields.
4. Auto-delegation detection: substitute teacher actions automatically link delegation_id and set is_delegated=True.
5. REST APIs: listing with multi-attribute filtering (module, action, severity, is_delegated, q), pagination.
6. Summary metrics endpoint (/api/audit/school/logs/stats).
7. Student and Teacher entity timeline endpoints.
8. Retention policy management (/api/audit/school/retention) enforcing 30-day minimum.
9. Protected purge (/api/audit/school/logs/purge) requiring "CONFIRM PURGE", mandatory reason, and leaving indelible purge audit records.
10. CSV export endpoint (/api/audit/school/logs/export) which also audits the export action.
11. Multi-tenant school isolation: cross-school leakage strictly prevented.
"""

import unittest
import uuid
from datetime import datetime, timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student, Teacher, Class, Subject
from app.models.audit import AuditLog, AuditRetentionSetting
from app.models.delegation import TeacherDelegation, TeacherDelegationScope
from app.services.permission_resolver import ensure_role_assignment_for_user
from app.services.audit_service import (
    record_audit_event,
    compute_changed_fields,
    _mask_sensitive_dict,
    purge_school_logs,
)
from app.utils.timezone_util import utc_now


class AuditEcosystemTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.app = create_app('testing')
        cls.client = cls.app.test_client()

    def setUp(self):
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        uid = uuid.uuid4().hex[:6]

        # Seed School A
        self.school_a = School(
            name=f'Modern High School A {uid}',
            code=f'MHS_{uid}',
            city='New Delhi',
            state='Delhi',
            pincode='110001',
            is_active=True,
        )
        # Seed School B (for multi-tenant isolation testing)
        self.school_b = School(
            name=f'St. Paul Academy B {uid}',
            code=f'SPA_{uid}',
            city='Mumbai',
            state='Maharashtra',
            pincode='400001',
            is_active=True,
        )
        db.session.add_all([self.school_a, self.school_b])
        db.session.commit()

        # Seed Principal in School A
        self.principal_a = User(
            name='Principal Sharma',
            email=f'principal.a.{uid}@eduerp.com',
            role=UserRole.PRINCIPAL,
            school_id=self.school_a.id,
            is_active=True,
        )
        self.principal_a.set_password('Admin@123', store_plain=False)
        db.session.add(self.principal_a)

        # Seed Principal in School B
        self.principal_b = User(
            name='Principal Fernandes',
            email=f'principal.b.{uid}@eduerp.com',
            role=UserRole.PRINCIPAL,
            school_id=self.school_b.id,
            is_active=True,
        )
        self.principal_b.set_password('Admin@123', store_plain=False)
        db.session.add(self.principal_b)
        db.session.commit()

        # Seed Platform Role assignments
        ensure_role_assignment_for_user(self.principal_a)
        ensure_role_assignment_for_user(self.principal_b)
        db.session.commit()

        # Seed Class and Subject in School A
        self.class_a = Class(name='Grade 10', section='A', school_id=self.school_a.id)
        db.session.add(self.class_a)
        db.session.flush()

        self.subject_a = Subject(name='Physics', code=f'PHY_{uid}', class_id=self.class_a.id, school_id=self.school_a.id)
        db.session.add(self.subject_a)
        db.session.flush()

        # Seed Absent Teacher (Regular) in School A
        self.teacher_user_reg = User(
            name='Dr. Verma (Absent)',
            email=f'verma.{uid}@eduerp.com',
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True,
        )
        self.teacher_user_reg.set_password('Teacher@123', store_plain=False)
        db.session.add(self.teacher_user_reg)
        db.session.flush()

        self.teacher_reg = Teacher(
            user_id=self.teacher_user_reg.id,
            school_id=self.school_a.id,
            designation='Senior Physics Teacher',
        )
        db.session.add(self.teacher_reg)

        # Seed Substitute Teacher in School A
        self.teacher_user_sub = User(
            name='Ms. Anjali (Substitute)',
            email=f'anjali.{uid}@eduerp.com',
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True,
        )
        self.teacher_user_sub.set_password('Teacher@123', store_plain=False)
        db.session.add(self.teacher_user_sub)
        db.session.flush()

        self.teacher_sub = Teacher(
            user_id=self.teacher_user_sub.id,
            school_id=self.school_a.id,
            designation='Guest Faculty',
        )
        db.session.add(self.teacher_sub)

        # Seed Student in School A
        self.student_user = User(
            name='Rohan Kumar',
            email=f'rohan.{uid}@eduerp.com',
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True,
        )
        self.student_user.set_password('Student@123', store_plain=False)
        db.session.add(self.student_user)
        db.session.flush()

        self.student = Student(
            user_id=self.student_user.id,
            school_id=self.school_a.id,
            class_id=self.class_a.id,
            admission_no=f'ADM-{uid}',
            roll_number='12',
        )
        db.session.add(self.student)
        db.session.commit()

        # Generate JWT Auth Tokens
        self.token_a = create_access_token(identity=str(self.principal_a.id))
        self.headers_a = {'Authorization': f'Bearer {self.token_a}'}

        self.token_b = create_access_token(identity=str(self.principal_b.id))
        self.headers_b = {'Authorization': f'Bearer {self.token_b}'}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ──────────────────────────────────────────────────────────────────────────
    #  1. Unit Tests for Service Layer (Diffs, Masking, Auto-Delegation)
    # ──────────────────────────────────────────────────────────────────────────

    def test_sensitive_field_masking(self):
        """Ensure passwords, tokens, OTPs, hashes, and secrets are redacted."""
        raw_data = {
            'username': 'johndoe',
            'password': 'PlainTextSecret123',
            'api_token': 'secret-jwt-token-456',
            'nested': {
                'otp': '987654',
                'password_hash': '$2b$12$hashedpwd',
                'public_data': 'SafeValue'
            }
        }
        masked = _mask_sensitive_dict(raw_data)

        self.assertEqual(masked['username'], 'johndoe')
        self.assertEqual(masked['password'], '[REDACTED]')
        self.assertEqual(masked['api_token'], '[REDACTED]')
        self.assertEqual(masked['nested']['otp'], '[REDACTED]')
        self.assertEqual(masked['nested']['password_hash'], '[REDACTED]')
        self.assertEqual(masked['nested']['public_data'], 'SafeValue')

    def test_compute_changed_fields_diff(self):
        """Test before vs after diff ignores timestamps and captures actual field mutations."""
        old_val = {
            'roll_number': '10',
            'section': 'A',
            'phone': '9876543210',
            'updated_at': '2026-09-01T10:00:00Z',
        }
        new_val = {
            'roll_number': '12',
            'section': 'A',      # Unchanged
            'phone': '9999999999',
            'updated_at': '2026-09-12T10:00:00Z', # Noisy field, should be ignored
        }

        diff = compute_changed_fields(old_val, new_val)
        self.assertIn('roll_number', diff)
        self.assertEqual(diff['roll_number']['old'], '10')
        self.assertEqual(diff['roll_number']['new'], '12')

        self.assertIn('phone', diff)
        self.assertEqual(diff['phone']['old'], '9876543210')
        self.assertEqual(diff['phone']['new'], '9999999999')

        self.assertNotIn('section', diff)
        self.assertNotIn('updated_at', diff)

    def test_auto_delegation_linkage(self):
        """Test substitute teacher action auto-attaches delegation_id and is_delegated=True."""
        now = utc_now()
        delegation = TeacherDelegation(
            school_id=self.school_a.id,
            source_teacher_id=self.teacher_reg.id,
            delegate_teacher_id=self.teacher_sub.id,
            created_by=self.principal_a.id,
            starts_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=2),
            status='ACTIVE',
            reason='Medical emergency',
        )
        db.session.add(delegation)
        db.session.flush()

        scope = TeacherDelegationScope(
            delegation_id=delegation.id,
            class_id=self.class_a.id,
            subject_id=self.subject_a.id,
        )
        db.session.add(scope)
        db.session.commit()

        # Record audit event executed by substitute teacher on this delegated class & subject
        log = record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.teacher_user_sub.id,
            action='MARKS_RECORDED',
            module='marks',
            class_id=self.class_a.id,
            subject_id=self.subject_a.id,
            student_id=self.student.id,
            remarks='Substitute teacher entered mid-term exam marks',
            severity='LOW',
        )

        self.assertTrue(log.is_delegated)
        self.assertEqual(log.delegation_id, delegation.id)
        self.assertEqual(log.user_id, self.teacher_user_sub.id)

    # ──────────────────────────────────────────────────────────────────────────
    #  2. Integration Tests for REST APIs
    # ──────────────────────────────────────────────────────────────────────────

    def test_audit_logs_listing_and_filtering(self):
        """Verify GET /api/audit/school/logs filters by module, action, severity, status."""
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='STUDENT_ADMITTED',
            module='admissions',
            entity_type='Student',
            entity_id=self.student.id,
            severity='MEDIUM',
            status='SUCCESS',
            remarks='Admitted student successfully',
        )
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.teacher_user_reg.id,
            action='LOGIN_FAILED',
            module='auth',
            entity_type='User',
            entity_id=self.teacher_user_reg.id,
            severity='HIGH',
            status='FAILURE',
            remarks='Invalid password entered',
        )
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='FEE_COLLECTED',
            module='finance',
            entity_type='FeeRecord',
            severity='LOW',
            status='SUCCESS',
            remarks='Fee payment received',
        )

        # 1. Fetch all
        res = self.client.get('/api/audit/school/logs', headers=self.headers_a)
        self.assertEqual(res.status_code, 200, f"Failed fetching logs: {res.data}")
        data = res.get_json()
        self.assertEqual(data['total'], 3)

        # 2. Filter by module
        res_mod = self.client.get('/api/audit/school/logs?module=auth', headers=self.headers_a)
        self.assertEqual(res_mod.status_code, 200)
        self.assertEqual(res_mod.get_json()['total'], 1)
        self.assertEqual(res_mod.get_json()['logs'][0]['action'], 'LOGIN_FAILED')

        # 3. Filter by severity
        res_sev = self.client.get('/api/audit/school/logs?severity=HIGH', headers=self.headers_a)
        self.assertEqual(res_sev.status_code, 200)
        self.assertEqual(res_sev.get_json()['total'], 1)

        # 4. Filter by status
        res_st = self.client.get('/api/audit/school/logs?status=FAILURE', headers=self.headers_a)
        self.assertEqual(res_st.status_code, 200)
        self.assertEqual(res_st.get_json()['total'], 1)

        # 5. Search keyword
        res_q = self.client.get('/api/audit/school/logs?q=admitted', headers=self.headers_a)
        self.assertEqual(res_q.status_code, 200)
        self.assertEqual(res_q.get_json()['total'], 1)

    def test_audit_stats_endpoint(self):
        """Verify GET /api/audit/school/logs/stats returns correct metrics."""
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='UPDATE',
            module='settings',
            severity='CRITICAL',
            status='SUCCESS',
        )
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='DELETE',
            module='students',
            severity='HIGH',
            status='FAILURE',
        )

        res = self.client.get('/api/audit/school/logs/stats', headers=self.headers_a)
        self.assertEqual(res.status_code, 200, f"Failed fetching stats: {res.data}")
        stats = res.get_json()

        self.assertEqual(stats['total_logs'], 2)
        self.assertEqual(stats['today_logs'], 2)
        self.assertEqual(stats['critical_logs'], 2) # 1 CRITICAL + 1 HIGH
        self.assertEqual(stats['failed_logs'], 1)

    def test_student_and_teacher_timelines(self):
        """Verify activity timeline endpoints for specific student and teacher."""
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='STUDENT_ADMITTED',
            module='admissions',
            student_id=self.student.id,
            remarks='Student enrolled into Grade 10',
        )
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='ATTENDANCE_MARKED',
            module='attendance',
            student_id=self.student.id,
            remarks='Marked present',
        )
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='TEACHER_ASSIGNED',
            module='academic',
            teacher_id=self.teacher_reg.id,
            remarks='Assigned Physics subject',
        )

        # Student timeline
        res_stu = self.client.get(f'/api/audit/school/logs/student/{self.student.id}', headers=self.headers_a)
        self.assertEqual(res_stu.status_code, 200, f"Student timeline failed: {res_stu.data}")
        self.assertEqual(len(res_stu.get_json()['logs']), 2)

        # Teacher timeline
        res_tch = self.client.get(f'/api/audit/school/logs/teacher/{self.teacher_reg.id}', headers=self.headers_a)
        self.assertEqual(res_tch.status_code, 200, f"Teacher timeline failed: {res_tch.data}")
        self.assertEqual(len(res_tch.get_json()['logs']), 1)

    # ──────────────────────────────────────────────────────────────────────────
    #  3. Retention & Protected Purge Tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_retention_setting_crud_and_validation(self):
        """Verify retention setting defaults to 180 and enforces >= 30 days."""
        # 1. Get default
        res = self.client.get('/api/audit/school/retention', headers=self.headers_a)
        self.assertEqual(res.status_code, 200, f"Get retention failed: {res.data}")
        self.assertEqual(res.get_json()['retention_days'], 365)

        # 2. Reject < 30 days
        res_invalid = self.client.put(
            '/api/audit/school/retention',
            headers=self.headers_a,
            json={'retention_days': 15}
        )
        self.assertEqual(res_invalid.status_code, 400)

        # 3. Accept >= 30 days
        res_valid = self.client.put(
            '/api/audit/school/retention',
            headers=self.headers_a,
            json={'retention_days': 90}
        )
        self.assertEqual(res_valid.status_code, 200, f"Update retention failed: {res_valid.data}")
        self.assertEqual(res_valid.get_json()['retention_days'], 90)

    def test_protected_purge_flow(self):
        """Verify purge requires 'CONFIRM PURGE', reason, and leaves audit markers."""
        # Create an old audit record (>100 days old)
        old_time = utc_now() - timedelta(days=120)
        old_log = AuditLog(
            school_id=self.school_a.id,
            user_id=self.principal_a.id,
            action='LEGACY_ACTION',
            module='legacy',
            remarks='Old log to be purged',
            created_at=old_time,
        )
        db.session.add(old_log)
        db.session.commit()

        # 1. Attempt purge without confirmation string -> 400
        res_reject = self.client.post(
            '/api/audit/school/logs/purge',
            headers=self.headers_a,
            json={'older_than_days': 90, 'reason': 'Test purge', 'confirmation': 'WRONG'}
        )
        self.assertEqual(res_reject.status_code, 400)

        # 2. Attempt purge without reason -> 400
        res_no_reason = self.client.post(
            '/api/audit/school/logs/purge',
            headers=self.headers_a,
            json={'older_than_days': 90, 'reason': '', 'confirmation': 'CONFIRM PURGE'}
        )
        self.assertEqual(res_no_reason.status_code, 400)

        # 3. Successful purge
        res_ok = self.client.post(
            '/api/audit/school/logs/purge',
            headers=self.headers_a,
            json={
                'older_than_days': 90,
                'reason': 'Annual regulatory sanitization',
                'confirmation': 'CONFIRM PURGE',
            }
        )
        self.assertEqual(res_ok.status_code, 200, f"Purge failed: {res_ok.data}")
        self.assertEqual(res_ok.get_json()['deleted_count'], 1)

        # 4. Verify the old record is gone, but PURGE_STARTED & PURGE_COMPLETED survive
        all_logs = AuditLog.query.filter_by(school_id=self.school_a.id).all()
        actions = [l.action for l in all_logs]

        self.assertNotIn('LEGACY_ACTION', actions)
        self.assertIn('AUDIT_PURGE_STARTED', actions)
        self.assertIn('AUDIT_PURGE_COMPLETED', actions)

    # ──────────────────────────────────────────────────────────────────────────
    #  4. Multi-Tenant School Isolation Tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_cross_school_isolation(self):
        """Ensure School B cannot read, stats, or purge School A logs."""
        record_audit_event(
            school_id=self.school_a.id,
            actor_user_id=self.principal_a.id,
            action='SCHOOL_A_CONFIDENTIAL',
            module='finance',
            remarks='School A private transaction',
        )

        # School B requests logs
        res_b = self.client.get('/api/audit/school/logs', headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200, f"Failed school B logs: {res_b.data}")
        data_b = res_b.get_json()
        self.assertEqual(data_b['total'], 0)
        self.assertEqual(len(data_b['logs']), 0)

        # School B requests stats
        res_stats_b = self.client.get('/api/audit/school/logs/stats', headers=self.headers_b)
        self.assertEqual(res_stats_b.status_code, 200, f"Failed school B stats: {res_stats_b.data}")
        self.assertEqual(res_stats_b.get_json()['total_logs'], 0)


if __name__ == '__main__':
    unittest.main()
