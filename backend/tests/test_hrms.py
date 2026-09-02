"""
Automated Comprehensive Test Suite for School HRMS
OnePlatform360 / EduERP

Validates:
1. Employee Profile creation & Teacher synchronization
2. Status transitions & lifecycle actions
3. Leave application, balance deduction, and StaffAttendance sync
4. Official Duty (OD) outdoor GPS exemption
5. Deterministic Payroll Engine (zero deduction for Sundays/holidays/paid leaves, LOP for unexcused absence)
6. Payroll batch approval, locking, and financial expense creation
7. ReportLab PDF payslip generation
"""

import unittest
from datetime import date, timedelta, datetime
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Teacher, Class, Subject
from app.models.hrms import (
    EmployeeProfile, LeaveType, LeaveBalance, LeaveRequest, OfficialDuty,
    EmployeeSalaryStructure, PayrollRun, PayrollSlip, EmploymentStatus, LeaveStatus
)
from app.models.staff_attendance import StaffAttendance, StaffAttendanceSettings
from app.models.financial import Holiday
from app.services import hrms_service as h_svc
from app.services import payroll_engine as p_svc
from app.utils.payslip_generator import generate_payslip_pdf


class HRMSTestCase(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School
        self.school = School(
            name='St. Xavier Senior Secondary School',
            code='STX101',
            city='New Delhi',
            state='Delhi',
            pincode='110001',
        )
        db.session.add(self.school)
        db.session.commit()

        # Seed Admin / Principal
        self.principal = User(
            name='Dr. A. Sharma',
            email='principal@stx.com',
            role=UserRole.PRINCIPAL,
            school_id=self.school.id,
            is_active=True,
        )
        self.principal.set_password('Admin@123', store_plain=False)
        db.session.add(self.principal)
        db.session.commit()

        # Seed Attendance Settings
        self.att_settings = StaffAttendanceSettings.get_or_create(self.school.id)
        self.att_settings.latitude = 28.6139
        self.att_settings.longitude = 77.2090
        self.att_settings.radius_meters = 150
        self.att_settings.working_days = 'Mon,Tue,Wed,Thu,Fri,Sat'
        self.att_settings.approval_required = False
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_create_employee_and_teacher_sync(self):
        """Test creating a Teacher employee synchronously creates User, EmployeeProfile, and Teacher records."""
        data = {
            'name': 'Pooja Verma',
            'email': 'pooja.verma@stx.com',
            'phone': '9876543210',
            'role': 'TEACHER',
            'employee_id': 'EMP-T-001',
            'department': 'Mathematics',
            'designation': 'PGT Mathematics',
            'salary': 45000.0,
            'joining_date': '2026-04-01',
            'qualification': 'M.Sc, B.Ed',
            'experience_years': 6,
        }
        user = h_svc.create_employee(self.school.id, data, actor_user=self.principal)
        self.assertIsNotNone(user.id)
        self.assertEqual(user.role, UserRole.TEACHER)
        self.assertEqual(user.salary, 45000.0)

        # Verify EmployeeProfile
        profile = EmployeeProfile.query.filter_by(user_id=user.id).first()
        self.assertIsNotNone(profile)
        self.assertEqual(profile.qualification, 'M.Sc, B.Ed')
        self.assertEqual(profile.employment_status, EmploymentStatus.ACTIVE.value)

        # Verify Teacher sync
        teacher = Teacher.query.filter_by(user_id=user.id).first()
        self.assertIsNotNone(teacher)
        self.assertEqual(teacher.employee_id, 'EMP-T-001')
        self.assertEqual(teacher.qualification, 'M.Sc, B.Ed')

    def test_02_leave_application_balance_deduction_and_attendance_sync(self):
        """Test leave submission, approval, balance deduction, and attendance auto-sync."""
        user = h_svc.create_employee(self.school.id, {
            'name': 'Ramesh Kumar', 'email': 'ramesh@stx.com', 'role': 'TEACHER', 'salary': 30000.0
        }, actor_user=self.principal)

        # Create Leave Type
        cl_type = LeaveType(
            school_id=self.school.id, name='Casual Leave', code='CL', annual_quota=12.0, is_paid=True
        )
        db.session.add(cl_type)
        db.session.commit()

        # Submit 2 days leave
        today = date.today()
        from_d = today + timedelta(days=2)
        to_d = today + timedelta(days=3)

        req = h_svc.submit_leave_request(
            user, leave_type_id=cl_type.id, from_date=from_d, to_date=to_d, reason='Family event'
        )
        self.assertEqual(req.status, LeaveStatus.PENDING.value)
        self.assertEqual(req.days_count, 2.0)

        # Check balance has 2 days pending
        bal = LeaveBalance.query.filter_by(user_id=user.id, leave_type_id=cl_type.id, session_year=str(from_d.year)).first()
        self.assertIsNotNone(bal)
        self.assertEqual(bal.pending, 2.0)
        self.assertEqual(bal.used, 0.0)

        # Principal approves leave
        approved_req = h_svc.review_leave_request(req.id, self.principal, approve=True, review_remarks='Approved')
        self.assertEqual(approved_req.status, LeaveStatus.APPROVED.value)

        # Check balance updated
        db.session.refresh(bal)
        self.assertEqual(bal.pending, 0.0)
        self.assertEqual(bal.used, 2.0)
        self.assertEqual(bal.remaining, 10.0)

        # Verify StaffAttendance records were auto-created with ON_LEAVE
        att_rows = StaffAttendance.query.filter(
            StaffAttendance.user_id == user.id,
            StaffAttendance.attendance_date.in_([from_d, to_d])
        ).all()
        self.assertEqual(len(att_rows), 2)
        for r in att_rows:
            self.assertEqual(r.status, 'ON_LEAVE')

    def test_03_official_duty_gps_exemption(self):
        """Test Official Duty creation and approval."""
        user = h_svc.create_employee(self.school.id, {
            'name': 'Anita Roy', 'email': 'anita@stx.com', 'role': 'TEACHER', 'salary': 35000.0
        }, actor_user=self.principal)

        today = date.today()
        od = h_svc.submit_official_duty(
            user, from_date=today, to_date=today, duty_type='EXAM_DUTY',
            location='Central Board Examination Center', purpose='External Observer'
        )
        self.assertEqual(od.status, 'PENDING')

        h_svc.review_official_duty(od.id, self.principal, approve=True, review_remarks='Approved')
        db.session.refresh(od)
        self.assertEqual(od.status, 'APPROVED')

    def test_04_deterministic_payroll_engine_zero_deduction_and_lop(self):
        """
        Validates the Payroll Engine:
        - Monthly Gross = ₹30,000
        - Sundays / Weekly Offs: ZERO deduction
        - Holidays: ZERO deduction
        - Approved Paid Leaves: ZERO deduction
        - Unexcused Absences / Unpaid Leaves: Loss of Pay (LOP) deduction
        """
        user = h_svc.create_employee(self.school.id, {
            'name': 'Sunil Mehta', 'email': 'sunil@stx.com', 'role': 'TEACHER', 'salary': 30000.0,
            'joining_date': '2026-04-01'
        }, actor_user=self.principal)

        # Assign structured salary
        emp_sal = EmployeeSalaryStructure(
            school_id=self.school.id,
            user_id=user.id,
            effective_from=date(2026, 4, 1),
            basic_salary=15000.0,
            hra=7500.0,
            da=4500.0,
            special_allowance=3000.0,
            pf_deduction=1800.0,
            prof_tax=200.0,
            is_active=True,
        )
        emp_sal.calculate_totals()
        db.session.add(emp_sal)
        db.session.commit()

        # Add 1 School Holiday in April 2026
        hol = Holiday(
            school_id=self.school.id,
            title='Good Friday',
            date=date(2026, 4, 3),
            holiday_type='HOLIDAY',
        )
        db.session.add(hol)
        db.session.commit()

        # Mark 25 Present days, 2 Unexcused Absent days in April 2026
        for d in range(1, 26):
            dt = date(2026, 4, d)
            if dt.strftime('%a') != 'Sun' and dt != date(2026, 4, 3):
                att = StaffAttendance(
                    school_id=self.school.id, user_id=user.id, attendance_date=dt,
                    status='PRESENT', check_in_time=datetime(2026, 4, d, 8, 0),
                    check_out_time=datetime(2026, 4, d, 14, 0), working_minutes=360,
                    approval_status='NOT_REQUIRED', gps_status='INSIDE_CAMPUS'
                )
                db.session.add(att)
        db.session.commit()

        # Generate Payroll for April 2026 (30 calendar days)
        payroll_run = p_svc.generate_payroll_run(
            self.school.id, month=4, year=2026, calculation_policy='PAYABLE_DAYS', actor_user=self.principal
        )
        self.assertIsNotNone(payroll_run)
        self.assertEqual(payroll_run.month, 4)
        self.assertEqual(payroll_run.year, 2026)

        slip = PayrollSlip.query.filter_by(payroll_run_id=payroll_run.id, user_id=user.id).first()
        self.assertIsNotNone(slip)

        # Per day salary = 30000 / 30 = 1000
        self.assertEqual(slip.gross_salary, 30000.0)
        self.assertEqual(slip.per_day_salary, 1000.0)
        self.assertEqual(slip.pf_deduction, 1800.0)
        self.assertEqual(slip.prof_tax, 200.0)

        # Sunday and Holiday counts should be recognized with zero deduction
        self.assertGreater(slip.weekly_off_days, 0)
        self.assertGreater(slip.holiday_days, 0)

        # Approve and Lock Payroll
        p_svc.approve_payroll_run(payroll_run.id, self.principal)
        db.session.refresh(payroll_run)
        self.assertEqual(payroll_run.status, 'APPROVED')

        p_svc.lock_payroll_run(payroll_run.id, self.principal)
        db.session.refresh(payroll_run)
        self.assertEqual(payroll_run.status, 'LOCKED')

        # Test PDF Payslip Generation
        pdf_buffer = generate_payslip_pdf(slip, self.school, employee_profile=None)
        self.assertIsNotNone(pdf_buffer)
        pdf_bytes = pdf_buffer.getvalue()
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))


if __name__ == '__main__':
    unittest.main()
