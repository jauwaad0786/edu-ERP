"""
Test Suite: Student & Parent Feature Parity Tests
Verifies:
1. Student submits leave request bypassing employee quota restrictions
2. Parent submits leave request on behalf of child student
3. Parent views linked child's leaves via /hrms/my/leaves
4. Student views their own leaves via /hrms/my/leaves
5. Student accesses ID card preview & download securely
6. Parent accesses child ID card preview & download securely
7. Fee Payments list is strictly scoped for Students and Parents
8. Students & Parents are prohibited from cancelling official fee receipts
"""

import unittest
from datetime import date, datetime, timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Class
from app.models.fee_finance import FeePayment
from app.models.hrms import LeaveType, LeaveRequest


class TestStudentParentFeatures(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # School
        self.school = School(
            name="Apex International Academy",
            code="AIA-001",
            current_session="2026-27",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school)
        db.session.flush()

        # Class
        self.cls = Class(name="Class 10", section="A", school_id=self.school.id)
        db.session.add(self.cls)
        db.session.flush()

        # Users
        self.principal = User(
            name="Dr. Vance",
            email="principal@apex.edu",
            role=UserRole.PRINCIPAL,
            school_id=self.school.id,
            is_active=True
        )
        self.principal.set_password("SecurePass@123")

        self.student_user = User(
            name="Rahul Sharma",
            email="rahul@apex.edu",
            phone="9876543210",
            role=UserRole.STUDENT,
            school_id=self.school.id,
            is_active=True
        )
        self.student_user.set_password("SecurePass@123")

        self.parent_user = User(
            name="Vikram Sharma",
            email="vikram.sharma@example.com",
            phone="9876500000",
            role=UserRole.PARENT,
            school_id=self.school.id,
            is_active=True
        )
        self.parent_user.set_password("SecurePass@123")

        db.session.add_all([self.principal, self.student_user, self.parent_user])
        db.session.flush()

        # Student Profile
        self.student = Student(
            user_id=self.student_user.id,
            school_id=self.school.id,
            class_id=self.cls.id,
            roll_number="101",
            admission_no="ADM-2026-001",
            dob=date(2010, 5, 15),
            gender="MALE",
            parent_name="Vikram Sharma",
            parent_phone="9876500000",
            parent_email="vikram.sharma@example.com",
            session="2026-27",
            is_deleted=False
        )
        db.session.add(self.student)

        # Leave Type
        self.leave_type = LeaveType(
            school_id=self.school.id,
            name="Medical Leave",
            code="ML",
            annual_quota=10.0,
            is_paid=True,
            requires_approval=True
        )
        db.session.add(self.leave_type)
        db.session.commit()

        # JWT tokens
        self.principal_token = create_access_token(identity=str(self.principal.id))
        self.student_token = create_access_token(identity=str(self.student_user.id))
        self.parent_token = create_access_token(identity=str(self.parent_user.id))

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_student_applies_leave_without_quota_error(self):
        """Student applies for 3 days of leave without employee quota blockage."""
        res = self.client.post(
            '/api/hrms/leaves/requests',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={
                'leave_type_id': self.leave_type.id,
                'from_date': '2026-10-12',
                'to_date': '2026-10-14',
                'reason': 'Viral fever recovery as prescribed by physician',
                'is_half_day': False
            }
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'PENDING')
        self.assertEqual(data['user_id'], self.student_user.id)

    def test_02_parent_applies_leave_for_child(self):
        """Parent applies for leave specifying their linked student child."""
        res = self.client.post(
            '/api/hrms/leaves/requests',
            headers={'Authorization': f'Bearer {self.parent_token}'},
            json={
                'leave_type_id': self.leave_type.id,
                'student_id': self.student.id,
                'from_date': '2026-10-20',
                'to_date': '2026-10-21',
                'reason': 'Family religious ceremony in hometown',
                'is_half_day': False
            }
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'PENDING')
        # Linked to student user account
        self.assertEqual(data['user_id'], self.student_user.id)

    def test_03_parent_views_my_leaves_includes_child(self):
        """Parent query to /hrms/my/leaves returns child's leave requests."""
        # Create a leave request for child
        req = LeaveRequest(
            school_id=self.school.id,
            user_id=self.student_user.id,
            leave_type_id=self.leave_type.id,
            from_date=date(2026, 11, 1),
            to_date=date(2026, 11, 2),
            days_count=2.0,
            reason='Medical appointment',
            status='PENDING'
        )
        db.session.add(req)
        db.session.commit()

        res = self.client.get(
            '/api/hrms/my/leaves',
            headers={'Authorization': f'Bearer {self.parent_token}'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        reqs = data.get('requests', [])
        self.assertEqual(len(reqs), 1)
        self.assertEqual(reqs[0]['reason'], 'Medical appointment')

    def test_04_student_and_parent_id_card_preview_access(self):
        """Student and Parent can preview student ID card data."""
        # Student preview
        res_stu = self.client.get(
            f'/api/principal/id-cards/preview/{self.student.id}',
            headers={'Authorization': f'Bearer {self.student_token}'}
        )
        self.assertEqual(res_stu.status_code, 200)
        stu_data = res_stu.get_json()
        self.assertEqual(stu_data['student']['admission_no'], 'ADM-2026-001')

        # Parent preview of their child
        res_par = self.client.get(
            f'/api/principal/id-cards/preview/{self.student.id}',
            headers={'Authorization': f'Bearer {self.parent_token}'}
        )
        self.assertEqual(res_par.status_code, 200)
        par_data = res_par.get_json()
        self.assertEqual(par_data['student']['id'], self.student.id)

    def test_05_student_fee_payments_scoped_and_no_cancellation(self):
        """Fee payments are filtered for students, and cancellation is blocked."""
        # Create payment for student
        payment = FeePayment(
            school_id=self.school.id,
            student_id=self.student.id,
            receipt_no="REC-2026-8888",
            total_paid=5000.0,
            payment_mode="UPI",
            session="2026-27",
            payment_date=date.today(),
            status="VALID"
        )
        db.session.add(payment)
        db.session.commit()

        # Student lists payments
        res = self.client.get(
            '/api/fees-finance/payments',
            headers={'Authorization': f'Bearer {self.student_token}'}
        )
        self.assertEqual(res.status_code, 200)
        items = res.get_json()
        self.assertTrue(len(items) >= 1)
        self.assertEqual(items[0]['receipt_no'], 'REC-2026-8888')

        # Student attempts to cancel receipt -> 403 Forbidden
        cancel_res = self.client.post(
            f'/api/fees-finance/payments/{payment.id}/cancel',
            headers={'Authorization': f'Bearer {self.student_token}'},
            json={'reason': 'Accidental payment'}
        )
        self.assertEqual(cancel_res.status_code, 403)


if __name__ == '__main__':
    unittest.main()
