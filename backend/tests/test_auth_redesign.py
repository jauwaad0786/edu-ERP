"""
Test Suite: Unified Authentication & Password Reset Architecture Verification
Tests:
1. Unified email login (Super Admin, Principal, Teacher)
2. Unified mobile number login (Driver, Staff, Student)
3. Shared mobile number disambiguation (siblings sharing parent phone)
4. User enumeration protection (timing & identical error messages)
5. Session invalidation via token_version after password change/reset
6. Principal password reset authorization & multi-tenant isolation
7. Hierarchy guard: Principal cannot reset Principal or Super Admin
8. Self-reset prevention via reset endpoints
9. Zero password / hash leakage in responses
"""

import unittest
from datetime import date
from flask_jwt_extended import decode_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher
from app.models.transport import Driver


class TestAuthRedesign(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # School A (Active)
        self.school_a = School(
            name="Delhi Public Academy",
            code="DPA-001",
            current_session="2024-25",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_a)
        db.session.flush()

        # School B (Active - different tenant)
        self.school_b = School(
            name="St Xavier Convent",
            code="SXC-002",
            current_session="2024-25",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school_b)
        db.session.flush()

        # Super Admin
        self.superadmin = User(
            name="Super Admin",
            email="superadmin@oneplatform360.com",
            phone="9876543000",
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        self.superadmin.set_password("SuperSecret@2026")
        db.session.add(self.superadmin)

        # Principal School A
        self.principal_a = User(
            name="Principal School A",
            email="principal.a@dpa.edu",
            phone="9876543001",
            role=UserRole.PRINCIPAL,
            school_id=self.school_a.id,
            is_active=True
        )
        self.principal_a.set_password("PrincipalA@2026")
        db.session.add(self.principal_a)

        # Principal School B
        self.principal_b = User(
            name="Principal School B",
            email="principal.b@sxc.edu",
            phone="9876543002",
            role=UserRole.PRINCIPAL,
            school_id=self.school_b.id,
            is_active=True
        )
        self.principal_b.set_password("PrincipalB@2026")
        db.session.add(self.principal_b)

        # Teacher School A
        self.teacher_a_user = User(
            name="Math Teacher",
            email="teacher.math@dpa.edu",
            phone="9876543003",
            role=UserRole.TEACHER,
            school_id=self.school_a.id,
            is_active=True
        )
        self.teacher_a_user.set_password("TeacherPass@123")
        db.session.add(self.teacher_a_user)
        db.session.flush()

        self.teacher_a = Teacher(
            user_id=self.teacher_a_user.id,
            school_id=self.school_a.id,
            employee_id="TCH-001"
        )
        db.session.add(self.teacher_a)

        # Teacher School B
        self.teacher_b_user = User(
            name="Science Teacher B",
            email="teacher.sci@sxc.edu",
            phone="9876543004",
            role=UserRole.TEACHER,
            school_id=self.school_b.id,
            is_active=True
        )
        self.teacher_b_user.set_password("TeacherBPass@123")
        db.session.add(self.teacher_b_user)
        db.session.flush()

        self.teacher_b = Teacher(
            user_id=self.teacher_b_user.id,
            school_id=self.school_b.id,
            employee_id="TCH-002"
        )
        db.session.add(self.teacher_b)

        # Driver School A
        self.driver_user = User(
            name="Ramesh Driver",
            email="ramesh.driver@dpa.edu",
            phone="9876543005",
            role=UserRole.DRIVER,
            school_id=self.school_a.id,
            is_active=True
        )
        self.driver_user.set_password("DriverPass@123")
        db.session.add(self.driver_user)
        db.session.flush()

        self.driver = Driver(
            school_id=self.school_a.id,
            user_id=self.driver_user.id,
            name="Ramesh Driver",
            mobile_number="9876543005",
            license_number="DL-12345-DEL"
        )
        db.session.add(self.driver)

        # Two Sibling Students sharing parent phone: 9998887770
        self.student1_user = User(
            name="Aarav Sharma",
            email="aarav.s@dpa.edu",
            phone="",
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.student1_user.set_password("AaravPass@123")
        db.session.add(self.student1_user)
        db.session.flush()

        self.student1 = Student(
            user_id=self.student1_user.id,
            school_id=self.school_a.id,
            admission_no="ADM-2024-001",
            roll_number="01",
            parent_name="Rajesh Sharma",
            parent_phone="9998887770"
        )
        db.session.add(self.student1)

        self.student2_user = User(
            name="Ananya Sharma",
            email="ananya.s@dpa.edu",
            phone="",
            role=UserRole.STUDENT,
            school_id=self.school_a.id,
            is_active=True
        )
        self.student2_user.set_password("AnanyaPass@456")
        db.session.add(self.student2_user)
        db.session.flush()

        self.student2 = Student(
            user_id=self.student2_user.id,
            school_id=self.school_a.id,
            admission_no="ADM-2024-002",
            roll_number="02",
            parent_name="Rajesh Sharma",
            parent_phone="9998887770"
        )
        db.session.add(self.student2)

        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_unified_login_email(self):
        """Verify login using email identifier across multiple roles."""
        # 1. Super Admin
        res = self.client.post('/api/auth/login', json={
            'identifier': 'superadmin@oneplatform360.com',
            'password': 'SuperSecret@2026'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('access_token', data)
        self.assertEqual(data['user']['role'].upper(), 'SUPER_ADMIN')
        self.assertNotIn('password', data['user'])
        self.assertNotIn('password_hash', data['user'])
        self.assertNotIn('plain_password_temp', data['user'])

        # 2. Principal
        res = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@dpa.edu',
            'password': 'PrincipalA@2026'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['user']['role'].upper(), 'PRINCIPAL')

        # 3. Teacher
        res = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.math@dpa.edu',
            'password': 'TeacherPass@123'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['user']['role'].upper(), 'TEACHER')

    def test_02_unified_login_phone_and_driver(self):
        """Verify login using 10-digit mobile number for Driver and Staff."""
        # Driver login with mobile number
        res = self.client.post('/api/auth/login', json={
            'identifier': '9876543005',
            'password': 'DriverPass@123'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['user']['role'].upper(), 'DRIVER')
        self.assertEqual(data['user']['name'], 'Ramesh Driver')

        # Teacher login with phone number formatted with +91 prefix
        res = self.client.post('/api/auth/login', json={
            'identifier': '+91 9876543003',
            'password': 'TeacherPass@123'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['user']['name'], 'Math Teacher')

    def test_03_shared_mobile_disambiguation(self):
        """Verify that siblings sharing parent phone number are resolved by password."""
        # Parent phone + Aarav's password -> logs in as Aarav
        res1 = self.client.post('/api/auth/login', json={
            'identifier': '9998887770',
            'password': 'AaravPass@123'
        })
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.get_json()['user']['name'], 'Aarav Sharma')

        # Parent phone + Ananya's password -> logs in as Ananya
        res2 = self.client.post('/api/auth/login', json={
            'identifier': '9998887770',
            'password': 'AnanyaPass@456'
        })
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()['user']['name'], 'Ananya Sharma')

        # Parent phone + Wrong password -> 401 Invalid credentials
        res3 = self.client.post('/api/auth/login', json={
            'identifier': '9998887770',
            'password': 'WrongPassword123'
        })
        self.assertEqual(res3.status_code, 401)
        err_msg = res3.get_json().get('error') or res3.get_json().get('message')
        self.assertEqual(err_msg, 'Invalid credentials')

    def test_04_user_enumeration_protection(self):
        """Ensure unknown users receive identical error messages to prevent enumeration."""
        # Nonexistent email
        res1 = self.client.post('/api/auth/login', json={
            'identifier': 'nonexistent.ghost@example.com',
            'password': 'SomeRandomPassword999'
        })
        self.assertEqual(res1.status_code, 401)
        err1 = res1.get_json().get('error') or res1.get_json().get('message')
        self.assertEqual(err1, 'Invalid credentials')

        # Nonexistent phone
        res2 = self.client.post('/api/auth/login', json={
            'identifier': '9990000000',
            'password': 'SomeRandomPassword999'
        })
        self.assertEqual(res2.status_code, 401)
        err2 = res2.get_json().get('error') or res2.get_json().get('message')
        self.assertEqual(err2, 'Invalid credentials')

        # Existing user with wrong password
        res3 = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.math@dpa.edu',
            'password': 'WrongPassword999'
        })
        self.assertEqual(res3.status_code, 401)
        err3 = res3.get_json().get('error') or res3.get_json().get('message')
        self.assertEqual(err3, 'Invalid credentials')

    def test_05_session_invalidation_via_token_version(self):
        """Verify token_version increments on password reset and invalidates existing JWT sessions."""
        # 1. Login teacher and obtain access token
        login_res = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.math@dpa.edu',
            'password': 'TeacherPass@123'
        })
        self.assertEqual(login_res.status_code, 200)
        old_access_token = login_res.get_json()['access_token']
        headers_old = {'Authorization': f'Bearer {old_access_token}'}

        # 2. Verify token is currently valid on protected route
        me_res = self.client.get('/api/auth/me', headers=headers_old)
        self.assertEqual(me_res.status_code, 200)

        # 3. Principal logs in and resets Teacher's password
        princ_login = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@dpa.edu',
            'password': 'PrincipalA@2026'
        })
        princ_token = princ_login.get_json()['access_token']
        headers_princ = {'Authorization': f'Bearer {princ_token}'}

        reset_res = self.client.post(
            f'/api/principal/users/{self.teacher_a_user.id}/reset-password',
            headers=headers_princ,
            json={'new_password': 'NewTeacherPass@2026'}
        )
        self.assertEqual(reset_res.status_code, 200)
        self.assertNotIn('plain_password_temp', reset_res.get_json())

        # 4. Old access token MUST now be rejected (token_version mismatch)
        me_res_after = self.client.get('/api/auth/me', headers=headers_old)
        self.assertIn(me_res_after.status_code, [401])

        # 5. Teacher can now login with NEW password
        new_login = self.client.post('/api/auth/login', json={
            'identifier': 'teacher.math@dpa.edu',
            'password': 'NewTeacherPass@2026'
        })
        self.assertEqual(new_login.status_code, 200)
        new_access_token = new_login.get_json()['access_token']
        headers_new = {'Authorization': f'Bearer {new_access_token}'}

        # New token works on protected route
        me_res_new = self.client.get('/api/auth/me', headers=headers_new)
        self.assertEqual(me_res_new.status_code, 200)

    def test_06_principal_reset_multi_tenant_idor_protection(self):
        """Verify that Principal of School A CANNOT reset passwords of users in School B."""
        princ_login = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@dpa.edu',
            'password': 'PrincipalA@2026'
        })
        headers_princ_a = {'Authorization': f"Bearer {princ_login.get_json()['access_token']}"}

        # Attempt to reset Teacher in School B
        res = self.client.post(
            f'/api/principal/users/{self.teacher_b_user.id}/reset-password',
            headers=headers_princ_a,
            json={'new_password': 'HackedPassword@123'}
        )
        self.assertEqual(res.status_code, 403)
        err = res.get_json().get('error') or res.get_json().get('message') or ''
        self.assertIn('Access denied', err)

    def test_07_principal_hierarchy_protection(self):
        """Verify Principal cannot reset passwords of other Principals or Super Admins."""
        princ_login = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@dpa.edu',
            'password': 'PrincipalA@2026'
        })
        headers_princ = {'Authorization': f"Bearer {princ_login.get_json()['access_token']}"}

        # Attempt to reset Super Admin
        res_sa = self.client.post(
            f'/api/principal/users/{self.superadmin.id}/reset-password',
            headers=headers_princ,
            json={'new_password': 'HackedPassword@123'}
        )
        self.assertEqual(res_sa.status_code, 403)

        # Attempt to reset Principal B
        res_pb = self.client.post(
            f'/api/principal/users/{self.principal_b.id}/reset-password',
            headers=headers_princ,
            json={'new_password': 'HackedPassword@123'}
        )
        self.assertEqual(res_pb.status_code, 403)

    def test_08_self_reset_prevention_on_management_endpoints(self):
        """Verify Principal cannot reset their own password via management reset endpoint."""
        princ_login = self.client.post('/api/auth/login', json={
            'identifier': 'principal.a@dpa.edu',
            'password': 'PrincipalA@2026'
        })
        headers_princ = {'Authorization': f"Bearer {princ_login.get_json()['access_token']}"}

        # Self-reset attempt
        res = self.client.post(
            f'/api/principal/users/{self.principal_a.id}/reset-password',
            headers=headers_princ,
            json={'new_password': 'NewPrincipalPass@2026'}
        )
        self.assertEqual(res.status_code, 403)
        err = res.get_json().get('error') or res.get_json().get('message') or ''
        self.assertIn('Cannot reset your own password', err)

    def test_09_super_admin_can_reset_principal_password(self):
        """Verify Super Admin can reset Principal password but cannot self-reset via admin endpoint."""
        sa_login = self.client.post('/api/auth/login', json={
            'identifier': 'superadmin@oneplatform360.com',
            'password': 'SuperSecret@2026'
        })
        headers_sa = {'Authorization': f"Bearer {sa_login.get_json()['access_token']}"}

        # Reset Principal A password
        res = self.client.post(
            f'/api/admin/users/{self.principal_a.id}/reset-password',
            headers=headers_sa,
            json={'new_password': 'NewPrincipalA@2026'}
        )
        self.assertEqual(res.status_code, 200)

        # Super Admin self-reset attempt via admin endpoint -> 403
        res_self = self.client.post(
            f'/api/admin/users/{self.superadmin.id}/reset-password',
            headers=headers_sa,
            json={'new_password': 'NewSuperAdminPass@2026'}
        )
        self.assertEqual(res_self.status_code, 403)
        err = res_self.get_json().get('error') or res_self.get_json().get('message') or ''
        self.assertIn('Cannot reset', err)


if __name__ == '__main__':
    unittest.main()
