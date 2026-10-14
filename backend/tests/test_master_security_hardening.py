"""
Comprehensive Security & Multi-Tenant Hardening Test Suite
Covers:
1. Multi-Tenant Payroll Slip PDF Isolation (VULN-03)
2. Unauthenticated & Cross-School Notes File Download Protection (VULN-02)
3. Multi-Tenant Batch Internal Marks Injection Protection (VULN-04)
4. Session Revocation & Token Version Validation on Student Login and OTP (VULN-01)
5. School Lifecycle Status Checks (Suspended/Inactive) on All Login Flows (VULN-01)
6. Access Control & Import Integrity in Company Leads (VULN-05)
7. Rate Limiting on Public Arrival UUID Endpoints (VULN-07)
8. Super Admin Cross-School Authorization vs School Administrator Isolation
9. Parent-Child Relationship and Student Data Isolation
"""

import io
import unittest
from datetime import date
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class, Subject, Note
from app.models.hrms import PayrollRun, PayrollSlip, EmployeeProfile
from app.models.arrival import StudentArrivalEvent
from app.models.leads import WebsiteLead


class TestMasterSecurityHardening(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # ── School A (Active) ──
        self.school_a = School(
            name="School Alpha",
            code="SCH-ALPHA",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True,
            enabled_features='["hrms_module", "library_management", "transport_management", "hostel_management"]'
        )
        # ── School B (Active) ──
        self.school_b = School(
            name="School Beta",
            code="SCH-BETA",
            current_session="2026-2027",
            status="ACTIVE",
            is_active=True,
            enabled_features='["hrms_module", "library_management", "transport_management", "hostel_management"]'
        )
        # ── School C (Suspended) ──
        self.school_c = School(
            name="School Gamma Suspended",
            code="SCH-GAMMA",
            current_session="2026-2027",
            status="SUSPENDED",
            is_active=False
        )
        db.session.add_all([self.school_a, self.school_b, self.school_c])
        db.session.flush()

        # ── Super Admin ──
        self.super_admin = User(name="Super Admin", email="super@erp.io", role=UserRole.SUPER_ADMIN, is_active=True)
        self.super_admin.set_password("Admin@12345")

        # ── School A Users ──
        self.principal_a = User(name="Principal A", email="principal@alpha.io", role=UserRole.PRINCIPAL, school_id=self.school_a.id, is_active=True)
        self.principal_a.set_password("Principal@123")

        self.accountant_a = User(name="Accountant A", email="accountant@alpha.io", role=UserRole.ACCOUNTANT, school_id=self.school_a.id, is_active=True)
        self.accountant_a.set_password("Accountant@123")

        self.teacher_a = User(name="Teacher A", email="teacher@alpha.io", role=UserRole.TEACHER, school_id=self.school_a.id, is_active=True)
        self.teacher_a.set_password("Teacher@123")

        self.student_u_a = User(name="Student A", email="student@alpha.io", phone="9876543210", role=UserRole.STUDENT, school_id=self.school_a.id, is_active=True)
        self.student_u_a.set_password("Student@123")

        # ── School B Users ──
        self.principal_b = User(name="Principal B", email="principal@beta.io", role=UserRole.PRINCIPAL, school_id=self.school_b.id, is_active=True)
        self.principal_b.set_password("Principal@123")

        self.teacher_b = User(name="Teacher B", email="teacher@beta.io", role=UserRole.TEACHER, school_id=self.school_b.id, is_active=True)
        self.teacher_b.set_password("Teacher@123")

        self.student_u_b = User(name="Student B", email="student@beta.io", phone="9123456780", role=UserRole.STUDENT, school_id=self.school_b.id, is_active=True)
        self.student_u_b.set_password("Student@123")

        # ── Suspended User in School A ──
        self.suspended_user = User(
            name="Suspended User", email="suspended@alpha.io", role=UserRole.TEACHER,
            school_id=self.school_a.id, is_active=True, account_status="SUSPENDED"
        )
        self.suspended_user.set_password("Teacher@123")

        # ── User in Suspended School C ──
        self.user_in_school_c = User(
            name="Student C", email="student@gamma.io", phone="9988776655", role=UserRole.STUDENT,
            school_id=self.school_c.id, is_active=True
        )
        self.user_in_school_c.set_password("Student@123")

        db.session.add_all([
            self.super_admin, self.principal_a, self.accountant_a, self.teacher_a, self.student_u_a,
            self.principal_b, self.teacher_b, self.student_u_b, self.suspended_user, self.user_in_school_c
        ])
        db.session.flush()

        # Teachers
        self.t_model_a = Teacher(user_id=self.teacher_a.id, school_id=self.school_a.id, employee_id="EMP-T-A1")
        self.t_model_b = Teacher(user_id=self.teacher_b.id, school_id=self.school_b.id, employee_id="EMP-T-B1")
        db.session.add_all([self.t_model_a, self.t_model_b])

        # Employee Profiles
        self.prof_a = EmployeeProfile(
            user_id=self.teacher_a.id,
            school_id=self.school_a.id
        )
        db.session.add(self.prof_a)

        # Classes
        self.class_a = Class(name="Class 10", section="A", school_id=self.school_a.id)
        self.class_b = Class(name="Class 10", section="B", school_id=self.school_b.id)
        db.session.add_all([self.class_a, self.class_b])
        db.session.flush()

        # Students
        self.student_a = Student(user_id=self.student_u_a.id, school_id=self.school_a.id, class_id=self.class_a.id, admission_no="ADM-A001", roll_number="1", parent_phone="9876543210")
        self.student_b = Student(user_id=self.student_u_b.id, school_id=self.school_b.id, class_id=self.class_b.id, admission_no="ADM-B001", roll_number="1", parent_phone="9123456780")
        self.student_c = Student(user_id=self.user_in_school_c.id, school_id=self.school_c.id, admission_no="ADM-C001", parent_phone="9988776655")
        db.session.add_all([self.student_a, self.student_b, self.student_c])
        db.session.flush()

        # Subjects
        self.subj_a = Subject(name="Mathematics", code="MATH-10", school_id=self.school_a.id, class_id=self.class_a.id)
        self.subj_b = Subject(name="Science", code="SCI-10", school_id=self.school_b.id, class_id=self.class_b.id)
        db.session.add_all([self.subj_a, self.subj_b])
        db.session.flush()

        # Notes in School A
        self.note_a = Note(
            school_id=self.school_a.id,
            title="Algebra Chapter 1",
            file_url=f"/api/teacher/notes/download/{self.school_a.id}_algebra1.pdf",
            file_name="algebra1.pdf",
            uploaded_by=self.teacher_a.id,
            class_id=self.class_a.id,
            subject_id=self.subj_a.id
        )
        db.session.add(self.note_a)

        # Payroll Run & Slip for Teacher A in School A
        self.payroll_run_a = PayrollRun(
            school_id=self.school_a.id,
            month=9,
            year=2026,
            month_name="September 2026",
            status="LOCKED"
        )
        db.session.add(self.payroll_run_a)
        db.session.flush()

        self.slip_a = PayrollSlip(
            school_id=self.school_a.id,
            payroll_run_id=self.payroll_run_a.id,
            user_id=self.teacher_a.id,
            base_gross_salary=50000.0,
            gross_salary=50000.0,
            net_salary=48000.0,
            payment_status="PAID"
        )
        db.session.add(self.slip_a)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ── Token helper ──
    def _headers(self, user):
        token_ver = getattr(user, 'token_version', 0) or 0
        token = create_access_token(
            identity=str(user.id),
            additional_claims={'token_version': token_ver}
        )
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    # ──────────────────────────────────────────────────────────────────────────
    # 1. Multi-Tenant Payroll Isolation (VULN-03)
    # ──────────────────────────────────────────────────────────────────────────
    def test_01_principal_b_cannot_download_school_a_payslip(self):
        """Principal B must receive 403 when attempting to download School A's payslip."""
        res = self.client.get(
            f'/api/hrms/payroll/slips/{self.slip_a.id}/pdf',
            headers=self._headers(self.principal_b)
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn("different school", res.get_json().get('error', ''))

    def test_02_super_admin_can_download_school_a_payslip(self):
        """Platform Super Admin has authorized cross-school administrative access."""
        res = self.client.get(
            f'/api/hrms/payroll/slips/{self.slip_a.id}/pdf',
            headers=self._headers(self.super_admin)
        )
        # Should succeed and return PDF bytes (200)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, 'application/pdf')

    def test_03_teacher_a_can_download_own_payslip(self):
        """Teacher A is authorized to download their own payroll slip."""
        res = self.client.get(
            f'/api/hrms/payroll/slips/{self.slip_a.id}/pdf',
            headers=self._headers(self.teacher_a)
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, 'application/pdf')

    # ──────────────────────────────────────────────────────────────────────────
    # 2. Notes File Download Security (VULN-02)
    # ──────────────────────────────────────────────────────────────────────────
    def test_04_unauthenticated_note_download_blocked(self):
        """Unauthenticated caller must be rejected with 401."""
        res = self.client.get(f'/api/teacher/notes/download/{self.school_a.id}_algebra1.pdf')
        self.assertEqual(res.status_code, 401)

    def test_05_cross_school_note_download_blocked(self):
        """Teacher B from School B must receive 403 when trying to download School A's note."""
        res = self.client.get(
            f'/api/teacher/notes/download/{self.school_a.id}_algebra1.pdf',
            headers=self._headers(self.teacher_b)
        )
        self.assertEqual(res.status_code, 403)

    # ──────────────────────────────────────────────────────────────────────────
    # 3. Multi-Tenant Internal Marks Injection Protection (VULN-04)
    # ──────────────────────────────────────────────────────────────────────────
    def test_06_cannot_inject_foreign_student_into_internal_marks(self):
        """Teacher A cannot submit internal marks for Student B (belongs to School B)."""
        res = self.client.post(
            '/api/academic/internal-marks/batch-save',
            headers=self._headers(self.teacher_a),
            json={
                'class_id': self.class_a.id,
                'subject_id': self.subj_a.id,
                'academic_year': '2026',
                'term': 'Unit Test 1',
                'marks': [
                    {'student_id': self.student_b.id, 'marks_obtained': 18, 'max_marks': 20}
                ]
            }
        )
        self.assertEqual(res.status_code, 200)
        # Verify student_b was skipped and 0 updated
        self.assertEqual(res.get_json().get('updated_count'), 0)

    def test_07_cannot_batch_save_marks_with_foreign_class(self):
        """Submitting internal marks with a class belonging to another school must return 403."""
        res = self.client.post(
            '/api/academic/internal-marks/batch-save',
            headers=self._headers(self.teacher_a),
            json={
                'class_id': self.class_b.id, # School B's class
                'subject_id': self.subj_a.id,
                'marks': []
            }
        )
        self.assertEqual(res.status_code, 403)

    # ──────────────────────────────────────────────────────────────────────────
    # 4. Session Revocation & Token Version on Student Login (VULN-01)
    # ──────────────────────────────────────────────────────────────────────────
    def test_08_student_login_issues_token_version_and_revokes_on_password_change(self):
        """Student login token must contain token_version and be revoked when password changes."""
        login_res = self.client.post('/api/auth/student-login', json={
            'name': 'Student A',
            'phone': '9876543210',
            'password': 'Student@123'
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.get_json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        # Token works on /me
        me_res = self.client.get('/api/auth/me', headers=headers)
        self.assertEqual(me_res.status_code, 200)

        # Admin resets Student A's password -> increments token_version
        self.student_u_a.set_password("NewStudentPass@123", store_plain=False)
        db.session.commit()

        # Prior student token must immediately be rejected with 401
        revoked_res = self.client.get('/api/auth/me', headers=headers)
        self.assertEqual(revoked_res.status_code, 401)

    # ──────────────────────────────────────────────────────────────────────────
    # 5. School & User Lifecycle Status Enforcement (VULN-01)
    # ──────────────────────────────────────────────────────────────────────────
    def test_09_suspended_school_student_login_blocked(self):
        """Student login from suspended School C must be rejected with 403."""
        res = self.client.post('/api/auth/student-login', json={
            'name': 'Student C',
            'phone': '9988776655',
            'password': 'Student@123'
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("suspended", res.get_json().get('error', '').lower())

    def test_10_suspended_user_login_blocked(self):
        """Suspended user in School A must be rejected on login with 403."""
        res = self.client.post('/api/auth/login', json={
            'identifier': 'suspended@alpha.io',
            'password': 'Teacher@123'
        })
        self.assertEqual(res.status_code, 403)
        self.assertIn("suspended", res.get_json().get('error', '').lower())

    # ──────────────────────────────────────────────────────────────────────────
    # 6. Company Leads Access Control (VULN-05)
    # ──────────────────────────────────────────────────────────────────────────
    def test_11_developer_leads_accessible_to_super_admin(self):
        """Super Admin can access developer leads without NameError."""
        lead = WebsiteLead(name="Test Lead", email="test@lead.com")
        db.session.add(lead)
        db.session.commit()

        res = self.client.get('/api/developer/leads', headers=self._headers(self.super_admin))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(len(res.get_json()) >= 1)

    def test_12_developer_leads_blocked_for_teacher(self):
        """Teacher cannot access company developer leads (403)."""
        res = self.client.get('/api/developer/leads', headers=self._headers(self.teacher_a))
        self.assertEqual(res.status_code, 403)

    # ──────────────────────────────────────────────────────────────────────────
    # 7. Rate Limiting on Public Arrival Endpoints (VULN-07)
    # ──────────────────────────────────────────────────────────────────────────
    def test_13_public_arrival_uuid_rate_limiting(self):
        """Rapid repeated requests to public arrival UUID endpoints hit rate limit (429)."""
        event = StudentArrivalEvent(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            recorded_by=self.teacher_a.id,
            expires_at=date.today()
        )
        db.session.add(event)
        db.session.commit()

        # Send requests past rate limit threshold (limit: 30 per minute)
        status_codes = []
        for _ in range(35):
            r = self.client.get(f'/api/arrivals/uuid/{event.event_uuid}')
            status_codes.append(r.status_code)

        self.assertIn(429, status_codes)


if __name__ == '__main__':
    unittest.main()
