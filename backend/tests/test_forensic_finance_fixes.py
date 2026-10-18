"""
Forensic Accounting & Architecture Fix Verification Test Suite
Validates:
1. Linear non-compounding previous dues across consecutive unpaid bills.
2. FIFO decremented settlement of legacy FeeRecords (stopping phantom multi-settlements).
3. StudentLedger running balance tracking on partial/full CREDIT entries.
4. Archive service safety checks with correct model imports.
"""

import unittest
from datetime import date, datetime, timedelta

from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.financial import FeeRecord, FeeTransaction, SalaryRecord
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2,
    FeeBill, FeePayment, BillStatus, PaymentStatus, StudentLedger
)
from app.services.fee_ledger_service import (
    ensure_default_fee_heads, generate_fee_bill, collect_fee_payment,
    get_student_applicable_charges, get_student_ledger
)
from app.services.archive_service import _check_teacher_payroll_history, _check_staff_financial_history


class ForensicFinanceFixesTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School
        self.school = School(
            name="Forensic Academy",
            code="FA001",
            address="Audit Road, New Delhi",
            email="audit@fa.edu.in"
        )
        db.session.add(self.school)
        db.session.commit()

        # Seed Admin
        self.admin = User(
            name="Audit Administrator",
            email="admin@fa.edu.in",
            role="PRINCIPAL",
            school_id=self.school.id
        )
        self.admin.set_password("Admin@123")
        db.session.add(self.admin)

        # Seed Teacher
        self.teacher_user = User(
            name="Teacher Raman",
            email="raman@fa.edu.in",
            role="TEACHER",
            school_id=self.school.id
        )
        self.teacher_user.set_password("Teacher@123")
        db.session.add(self.teacher_user)
        db.session.commit()

        from app.models.academic import Teacher
        self.teacher = Teacher(
            user_id=self.teacher_user.id,
            school_id=self.school.id,
            employee_id="EMP-T-001"
        )
        db.session.add(self.teacher)
        db.session.commit()

        # Seed Class
        self.cls = Class(name="Class 10", section="A", school_id=self.school.id)
        db.session.add(self.cls)
        db.session.commit()

        # Seed Student
        self.student_user = User(
            name="Aditya Verma",
            email="aditya@fa.edu.in",
            role="STUDENT",
            school_id=self.school.id
        )
        self.student_user.set_password("Student@123")
        db.session.add(self.student_user)
        db.session.commit()

        self.student = Student(
            user_id=self.student_user.id,
            admission_no="ADM-FA-001",
            roll_number="101",
            class_id=self.cls.id,
            school_id=self.school.id,
            session="2026-27"
        )
        db.session.add(self.student)
        db.session.commit()

        # Setup Default Fee Heads & Fee Structure
        ensure_default_fee_heads(self.school.id)
        t_head = FeeHead.query.filter_by(school_id=self.school.id, code='TUITION').first()
        self.structure = FeeStructureV2(
            name="Class 10 Fee Structure",
            school_id=self.school.id,
            class_id=self.cls.id,
            session="2026-27",
            status="PUBLISHED"
        )
        db.session.add(self.structure)
        db.session.commit()

        self.item = FeeStructureItemV2(
            structure_id=self.structure.id,
            fee_head_id=t_head.id,
            amount=1000.0
        )
        db.session.add(self.item)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_linear_previous_dues_no_exponential_compounding(self):
        """1. Verify consecutive unpaid bills grow linearly, NOT exponentially."""
        months = ['2026-04', '2026-05', '2026-06', '2026-07']
        bills = []
        for m in months:
            bill, created = generate_fee_bill(
                student_id=self.student.id,
                bill_month=m,
                due_date=date(2026, int(m.split('-')[1]), 10),
                actor_user=self.admin,
                session="2026-27"
            )
            self.assertTrue(created)
            bills.append(bill)

        # Month 1: 1000 current, 0 prev -> total 1000, balance 1000
        self.assertEqual(bills[0].previous_dues, 0.0)
        self.assertEqual(bills[0].total_payable, 1000.0)
        self.assertEqual(bills[0].balance_due, 1000.0)

        # Month 2: 1000 current, 1000 prev -> total 2000, balance 2000
        self.assertEqual(bills[1].previous_dues, 1000.0)
        self.assertEqual(bills[1].total_payable, 2000.0)
        self.assertEqual(bills[1].balance_due, 2000.0)

        # Month 3: 1000 current, 2000 prev -> total 3000, balance 3000 (NOT 4000)
        self.assertEqual(bills[2].previous_dues, 2000.0)
        self.assertEqual(bills[2].total_payable, 3000.0)
        self.assertEqual(bills[2].balance_due, 3000.0)

        # Month 4: 1000 current, 3000 prev -> total 4000, balance 4000 (NOT 8000)
        self.assertEqual(bills[3].previous_dues, 3000.0)
        self.assertEqual(bills[3].total_payable, 4000.0)
        self.assertEqual(bills[3].balance_due, 4000.0)

    def test_02_fifo_legacy_fee_record_settlement(self):
        """2. Verify paying ₹1,000 against multiple ₹1,000 legacy records settles ONLY 1 record, not all 3."""
        rec1 = FeeRecord(student_id=self.student.id, school_id=self.school.id, session="2026-27", month="April", amount_due=1000.0, status='PENDING')
        rec2 = FeeRecord(student_id=self.student.id, school_id=self.school.id, session="2026-27", month="May", amount_due=1000.0, status='PENDING')
        rec3 = FeeRecord(student_id=self.student.id, school_id=self.school.id, session="2026-27", month="June", amount_due=1000.0, status='PENDING')
        db.session.add_all([rec1, rec2, rec3])
        db.session.commit()

        # Collect ₹1,000
        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=1000.0,
            payment_mode="CASH",
            collected_by=self.admin,
            session="2026-27"
        )
        self.assertIsNotNone(payment)

        db.session.refresh(rec1)
        db.session.refresh(rec2)
        db.session.refresh(rec3)

        # Record 1 must be PAID
        self.assertEqual(rec1.status, 'PAID')
        self.assertEqual(rec1.amount_paid, 1000.0)

        # Record 2 and 3 must REMAIN PENDING (no phantom settlements)
        self.assertEqual(rec2.status, 'PENDING')
        self.assertEqual(rec2.amount_paid or 0.0, 0.0)
        self.assertEqual(rec3.status, 'PENDING')
        self.assertEqual(rec3.amount_paid or 0.0, 0.0)

    def test_03_partial_legacy_fee_record_update(self):
        """3. Verify partial payment against legacy FeeRecord updates amount_paid and marks PARTIAL."""
        rec = FeeRecord(student_id=self.student.id, school_id=self.school.id, session="2026-27", month="July", amount_due=2000.0, status='PENDING')
        db.session.add(rec)
        db.session.commit()

        # Pay partial ₹600
        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=600.0,
            payment_mode="UPI",
            collected_by=self.admin,
            session="2026-27"
        )

        db.session.refresh(rec)
        self.assertEqual(rec.amount_paid, 600.0)
        self.assertEqual(rec.status, 'PARTIAL')

    def test_04_student_ledger_running_balance(self):
        """4. Verify StudentLedger running balance tracks debt - credit correctly."""
        # Post Debit (1000 bill)
        generate_fee_bill(
            student_id=self.student.id,
            bill_month="2026-08",
            due_date=date(2026, 8, 10),
            actor_user=self.admin,
            session="2026-27"
        )

        # Check last ledger row after bill
        debit_ledger = StudentLedger.query.filter_by(student_id=self.student.id, entry_type='DEBIT').first()
        self.assertIsNotNone(debit_ledger)
        self.assertEqual(debit_ledger.amount, 1000.0)

        # Pay partial ₹400
        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=400.0,
            payment_mode="CASH",
            collected_by=self.admin,
            session="2026-27"
        )

        credit_ledger = StudentLedger.query.filter_by(student_id=self.student.id, entry_type='CREDIT').first()
        self.assertIsNotNone(credit_ledger)
        self.assertEqual(credit_ledger.amount, 400.0)
        # Running balance should be 600.0, NOT 0.0
        self.assertEqual(credit_ledger.balance_after, 600.0)

    def test_05_archive_service_safety_checks(self):
        """5. Verify archive_service checks execute without crashing on missing models/attributes."""
        # Test teacher payroll check initially false
        res_t = _check_teacher_payroll_history(self.teacher.id)
        self.assertFalse(res_t)

        # Add SalaryRecord
        sr = SalaryRecord(
            teacher_id=self.teacher.id,
            school_id=self.school.id,
            month="April 2026",
            amount=45000.0,
            status="PAID"
        )
        db.session.add(sr)
        db.session.commit()

        res_t_after = _check_teacher_payroll_history(self.teacher.id)
        self.assertTrue(res_t_after)

        # Test staff fee collection check
        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=500.0,
            payment_mode="CASH",
            collected_by=self.admin,
            session="2026-27"
        )
        res_s = _check_staff_financial_history(self.admin.id)
        self.assertTrue(res_s)
