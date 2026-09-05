"""
Automated Test Suite for Super Admin School Lifecycle System
EduERP / OnePlatform360
Tests:
1. School creation & default ACTIVE lifecycle state
2. Super Admin archiving school (soft delete with 1-year retention)
3. Preserving school records and verifying archive summary counts
4. Suspension of tenant user logins (Principal, Teacher, Student) with 403 archived message
5. School filtering (/admin/schools vs /admin/schools/archived)
6. School recovery: status restored to ACTIVE, accounts reactivated, audit log created
7. Re-activation of logins upon recovery
8. Preventing invalid lifecycle operations (recovering active school, deleting active school)
9. Confirmation validation on permanent delete (strict DELETE <NAME> phrase)
10. Retention window enforcement (force flag required before 365 days)
11. Permanent deletion execution: cascades child records, unlinks company audit logs, logs immutable SCHOOL_PERMANENTLY_DELETED
12. Isolation: ensuring School B's data remains 100% intact after School A is permanently deleted
13. RBAC: non-Super Admin users blocked with 403
"""

import unittest
from datetime import datetime, timedelta
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class, Subject
from app.models.financial import FeeRecord
from app.models.audit import CompanyActivityLog
from app.services.school_lifecycle_service import (
    get_school_archive_summary,
    archive_school,
    recover_school,
    permanently_delete_school,
)
from flask_jwt_extended import create_access_token


class TestSchoolLifecycle(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # 1. Super Admin User
        self.super_admin = User(
            name="Super Admin John",
            email="superadmin@eduerp.io",
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        self.super_admin.set_password("Admin@1234")
        db.session.add(self.super_admin)
        db.session.flush()

        # 2. School A (Target School)
        self.school_a = School(
            name="Apex International School",
            code="AIS-001",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_a)
        db.session.flush()

        # Principal for School A
        self.principal_a = User(
            name="Principal Apex",
            email="principal@apex.edu",
            role=UserRole.PRINCIPAL,
            school_id=self.school_a.id,
            is_active=True
        )
        self.principal_a.set_password("Apex@123")
        db.session.add(self.principal_a)

        # Teacher for School A
        self.teacher_a = User(
            name="Teacher Raman",
            email="raman@apex.edu",
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True
        )
        self.teacher_a.set_password("Teacher@123")
        db.session.add(self.teacher_a)
        db.session.flush()

        self.teacher_model_a = Teacher(
            user_id=self.teacher_a.id,
            school_id=self.school_a.id,
            employee_id="EMP-A-01"
        )
        db.session.add(self.teacher_model_a)

        # Class for School A
        self.class_a = Class(name="Grade 10", section="A", school_id=self.school_a.id)
        db.session.add(self.class_a)
        db.session.flush()

        # Student for School A
        self.student_user_a = User(
            name="Rohan Sharma",
            email="rohan@apex.edu",
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.student_user_a.set_password("Student@123")
        db.session.add(self.student_user_a)
        db.session.flush()

        self.student_a = Student(
            user_id=self.student_user_a.id,
            school_id=self.school_a.id,
            class_id=self.class_a.id,
            roll_number="1001",
            admission_no="ADM-1001"
        )
        db.session.add(self.student_a)

        # 3. School B (Isolated Companion School)
        self.school_b = School(
            name="Beacon Valley School",
            code="BVS-002",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_b)
        db.session.flush()

        self.class_b = Class(name="Grade 8", section="B", school_id=self.school_b.id)
        db.session.add(self.class_b)
        db.session.flush()

        self.student_user_b = User(
            name="Anita Verma",
            email="anita@beacon.edu",
            role=UserRole.STUDENT,
            school_id=self.school_b.id,
            is_active=True
        )
        self.student_user_b.set_password("Student@123")
        db.session.add(self.student_user_b)
        db.session.flush()

        self.student_b = Student(
            user_id=self.student_user_b.id,
            school_id=self.school_b.id,
            class_id=self.class_b.id,
            roll_number="8001",
            admission_no="ADM-8001"
        )
        db.session.add(self.student_b)

        db.session.commit()

        # Tokens
        self.admin_token = create_access_token(identity=str(self.super_admin.id))
        self.admin_headers = {'Authorization': f'Bearer {self.admin_token}', 'Content-Type': 'application/json'}

        self.principal_token = create_access_token(identity=str(self.principal_a.id))
        self.principal_headers = {'Authorization': f'Bearer {self.principal_token}', 'Content-Type': 'application/json'}

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

    def test_01_default_lifecycle_state(self):
        """Verify school initializes in ACTIVE status with all lifecycle columns intact."""
        s = School.query.get(self.school_a.id)
        self.assertEqual(s.status, 'ACTIVE')
        self.assertTrue(s.is_active)
        self.assertIsNone(s.archived_at)
        self.assertIsNone(s.archived_by)
        self.assertIsNone(s.archive_reason)
        self.assertIsNone(s.permanent_delete_eligible_at)

        s_dict = s.to_dict()
        self.assertEqual(s_dict['status'], 'ACTIVE')
        self.assertEqual(s_dict['effective_status'], 'ACTIVE')
        self.assertFalse(s_dict['is_permanent_delete_eligible'])

    def test_02_archive_summary(self):
        """Verify get_school_archive_summary aggregates counts without altering records."""
        summary = get_school_archive_summary(self.school_a.id)
        self.assertEqual(summary['school_id'], self.school_a.id)
        self.assertEqual(summary['school_name'], "Apex International School")
        self.assertEqual(summary['counts']['students'], 1)
        self.assertEqual(summary['counts']['classes'], 1)
        self.assertEqual(summary['counts']['users'], 3)  # principal_a + teacher_a + student_user_a

    def test_03_archive_school(self):
        """Verify Super Admin can archive a school, setting 1-year retention and suspending users."""
        res = self.client.post(
            f'/api/admin/schools/{self.school_a.id}/archive',
            headers=self.admin_headers,
            json={'reason': 'Annual contract expired; school requested freeze'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ARCHIVED')
        self.assertEqual(data['archive_reason'], 'Annual contract expired; school requested freeze')
        self.assertIsNotNone(data['archived_at'])
        self.assertIsNotNone(data['permanent_delete_eligible_at'])

        # Verify DB state
        s = School.query.get(self.school_a.id)
        self.assertEqual(s.status, 'ARCHIVED')
        self.assertFalse(s.is_active)

        # Verify users are deactivated
        p = User.query.get(self.principal_a.id)
        t = User.query.get(self.teacher_a.id)
        self.assertFalse(p.is_active)
        self.assertFalse(t.is_active)

        # Verify audit log was recorded
        log = CompanyActivityLog.query.filter_by(action='SCHOOL_ARCHIVED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.affected_school_id, self.school_a.id)

    def test_04_login_blocked_for_archived_school(self):
        """Verify school users are blocked from logging in when school is archived."""
        # Archive school
        archive_school(self.school_a.id, self.super_admin, "Temporary Freeze")

        # Attempt principal login
        res = self.client.post('/api/auth/login', json={
            'email': 'principal@apex.edu',
            'password': 'Apex@123'
        })
        self.assertEqual(res.status_code, 403)
        data = res.get_json()
        self.assertIn("currently archived", data.get('error', ''))

    def test_05_school_filtering_active_and_archived(self):
        """Verify /admin/schools filters active schools by default and /admin/schools/archived lists archived."""
        # Archive School A
        archive_school(self.school_a.id, self.super_admin, "Maintenance")

        # Default GET /admin/schools should only return School B (ACTIVE)
        res_active = self.client.get('/api/admin/schools', headers=self.admin_headers)
        self.assertEqual(res_active.status_code, 200)
        active_list = res_active.get_json()
        active_ids = [s['id'] for s in active_list]
        self.assertNotIn(self.school_a.id, active_ids)
        self.assertIn(self.school_b.id, active_ids)

        # GET /admin/schools/archived should return School A
        res_archived = self.client.get('/api/admin/schools/archived', headers=self.admin_headers)
        self.assertEqual(res_archived.status_code, 200)
        archived_list = res_archived.get_json()
        archived_ids = [s['id'] for s in archived_list]
        self.assertIn(self.school_a.id, archived_ids)
        self.assertNotIn(self.school_b.id, archived_ids)

    def test_06_recover_school(self):
        """Verify recovering an archived school restores ACTIVE status and reactivates users."""
        archive_school(self.school_a.id, self.super_admin, "To be restored")

        # Recover school
        res = self.client.post(
            f'/api/admin/schools/{self.school_a.id}/recover',
            headers=self.admin_headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'ACTIVE')
        self.assertTrue(data['is_active'])
        self.assertIsNone(data['archived_at'])
        self.assertIn(data.get('archive_reason'), [None, ''])

        # Check DB
        s = School.query.get(self.school_a.id)
        self.assertEqual(s.status, 'ACTIVE')
        self.assertTrue(s.is_active)

        # Check user accounts reactivated
        p = User.query.get(self.principal_a.id)
        self.assertTrue(p.is_active)

        # Verify login succeeds now
        login_res = self.client.post('/api/auth/login', json={
            'email': 'principal@apex.edu',
            'password': 'Apex@123'
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertIn('access_token', login_res.get_json())

        # Check audit log
        log = CompanyActivityLog.query.filter_by(action='SCHOOL_RECOVERED').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.affected_school_id, self.school_a.id)

    def test_07_invalid_lifecycle_transitions(self):
        """Verify invalid operations like recovering an active school or deleting active school fail."""
        # 1. Recovering already active school
        res = self.client.post(
            f'/api/admin/schools/{self.school_a.id}/recover',
            headers=self.admin_headers
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("not currently archived", res.get_json()['error'])

        # 2. Permanently deleting active school
        res_del = self.client.delete(
            f'/api/admin/schools/{self.school_a.id}/permanent',
            headers=self.admin_headers,
            json={'confirm_name': f"DELETE {self.school_a.name}", 'force': True}
        )
        self.assertEqual(res_del.status_code, 400)
        self.assertIn("cannot be permanently deleted", res_del.get_json()['error'])

    def test_08_permanent_delete_confirmation_and_retention_checks(self):
        """Verify strict confirmation phrase and force flag requirements for permanent delete."""
        archive_school(self.school_a.id, self.super_admin, "To be deleted")

        # 1. Incorrect confirmation phrase
        res_bad_confirm = self.client.delete(
            f'/api/admin/schools/{self.school_a.id}/permanent',
            headers=self.admin_headers,
            json={'confirm_name': 'DELETE WRONG NAME', 'force': True}
        )
        self.assertEqual(res_bad_confirm.status_code, 400)
        self.assertIn("Confirmation mismatch", res_bad_confirm.get_json()['error'])

        # 2. Deleting within 1-year retention without force
        res_no_force = self.client.delete(
            f'/api/admin/schools/{self.school_a.id}/permanent',
            headers=self.admin_headers,
            json={'confirm_name': f"DELETE {self.school_a.name}", 'force': False}
        )
        self.assertEqual(res_no_force.status_code, 400)
        self.assertIn("retention window", res_no_force.get_json()['error'])

    def test_09_permanent_delete_execution_and_tenant_isolation(self):
        """Verify permanent deletion removes all School A records, leaves School B intact, and records immutable audit log."""
        school_a_id = self.school_a.id
        school_a_name = self.school_a.name
        school_b_id = self.school_b.id

        archive_school(school_a_id, self.super_admin, "Permanent Wipe Request")

        # Call permanent delete
        res = self.client.delete(
            f'/api/admin/schools/{school_a_id}/permanent',
            headers=self.admin_headers,
            json={'confirm_name': f"DELETE {school_a_name}", 'force': True}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])

        # Refresh test session so it reads freshly committed database state
        db.session.remove()

        # Verify School A is completely gone
        s_a = db.session.get(School, school_a_id) if hasattr(db.session, 'get') else School.query.get(school_a_id)
        self.assertIsNone(s_a)

        # Verify School A users and children are deleted
        self.assertEqual(User.query.filter_by(school_id=school_a_id).count(), 0)
        self.assertEqual(Class.query.filter_by(school_id=school_a_id).count(), 0)
        self.assertEqual(Student.query.filter_by(school_id=school_a_id).count(), 0)

        # Verify ISOLATION: School B is 100% intact!
        s_b = School.query.get(school_b_id)
        self.assertIsNotNone(s_b)
        self.assertEqual(s_b.status, 'ACTIVE')
        self.assertEqual(Class.query.filter_by(school_id=school_b_id).count(), 1)
        self.assertEqual(Student.query.filter_by(school_id=school_b_id).count(), 1)

        # Verify audit logs:
        # Previous logs have affected_school_id = NULL
        old_logs = CompanyActivityLog.query.filter_by(action='SCHOOL_ARCHIVED').all()
        for log in old_logs:
            self.assertIsNone(log.affected_school_id)

        # Immutable SCHOOL_PERMANENTLY_DELETED log exists
        perm_log = CompanyActivityLog.query.filter_by(action='SCHOOL_PERMANENTLY_DELETED').first()
        self.assertIsNotNone(perm_log)
        self.assertIn("Apex International School", perm_log.remarks)

    def test_10_rbac_access_control(self):
        """Verify non-SuperAdmin roles (e.g. Principal) cannot perform lifecycle actions."""
        # Principal trying to archive
        res = self.client.post(
            f'/api/admin/schools/{self.school_a.id}/archive',
            headers=self.principal_headers,
            json={'reason': 'Illegal attempt'}
        )
        self.assertEqual(res.status_code, 403)

        # Principal trying to recover
        res_rec = self.client.post(
            f'/api/admin/schools/{self.school_a.id}/recover',
            headers=self.principal_headers
        )
        self.assertEqual(res_rec.status_code, 403)

        # Principal trying to permanently delete
        res_del = self.client.delete(
            f'/api/admin/schools/{self.school_a.id}/permanent',
            headers=self.principal_headers,
            json={'confirm_name': f"DELETE {self.school_a.name}", 'force': True}
        )
        self.assertEqual(res_del.status_code, 403)


if __name__ == '__main__':
    unittest.main()
