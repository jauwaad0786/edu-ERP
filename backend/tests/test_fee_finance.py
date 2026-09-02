"""
Comprehensive Automated Test Suite for Fee Management & School Finance System
Tests:
- FeeHead Master & FeeStructure creation
- Student-specific charges & Concession calculation
- Advance Demand Bill generation with duplicate prevention
- Payment Collection with Multi-Fee-Head distribution & Receipt Generation
- Receipt Cancellation & Student Ledger Reversal
- Fee Refunds & Audit Logging
- Executive Finance Dashboard & Net Surplus (Income - Expenses)
- ReportLab PDF Generation for Fee Bill & Official Receipt
"""

import unittest
from datetime import date, datetime
from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.finance import Expense
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentFeeAssignment,
    StudentConcession, FeeBill, FeeBillItem, StudentLedger, FeePayment,
    FeePaymentAllocation, FeeRefund, FinancialAuditLog,
    BillStatus, PaymentStatus
)
from app.services.fee_ledger_service import (
    ensure_default_fee_heads, get_student_applicable_charges,
    generate_fee_bill, collect_fee_payment, cancel_payment_receipt,
    process_fee_refund, get_student_ledger, get_finance_dashboard_metrics
)
from app.utils.fee_pdf_generator import generate_fee_bill_pdf, generate_fee_receipt_pdf


class FeeFinanceTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School
        self.school = School(
            name="Delhi Public Academy",
            code="DPA01",
            address="Sector 14, Rohini, New Delhi",
            phone="011-27891234",
            email="accounts@dpa.edu.in"
        )
        db.session.add(self.school)
        db.session.commit()

        # Seed Admin User
        self.admin = User(
            name="Principal Sharma",
            email="principal@dpa.edu.in",
            role="PRINCIPAL",
            school_id=self.school.id
        )
        self.admin.set_password("Admin@123")
        db.session.add(self.admin)
        db.session.commit()

        # Seed Class
        self.cls = Class(name="Class 8", section="A", school_id=self.school.id)
        db.session.add(self.cls)
        db.session.commit()

        # Seed Student User & Student Record
        self.stu_user = User(
            name="Ahmed Khan",
            email="ahmed.khan@dpa.edu.in",
            role="STUDENT",
            school_id=self.school.id
        )
        self.stu_user.set_password("Student@123")
        db.session.add(self.stu_user)
        db.session.commit()

        self.student = Student(
            user_id=self.stu_user.id,
            school_id=self.school.id,
            class_id=self.cls.id,
            admission_no="STU-1023",
            father_name="Tariq Khan",
            parent_phone="9876543210",
        )
        db.session.add(self.student)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_fee_heads_and_rate_card_creation(self):
        """Verify default fee heads and class rate card creation."""
        ensure_default_fee_heads(self.school.id)
        heads = FeeHead.query.filter_by(school_id=self.school.id).all()
        self.assertGreaterEqual(len(heads), 6)

        tuition_head = FeeHead.query.filter_by(school_id=self.school.id, code='TUITION').first()
        self.assertIsNotNone(tuition_head)
        self.assertEqual(tuition_head.department, 'ACCOUNTS')

        # Create Rate Card for Class 8
        struct = FeeStructureV2(
            school_id=self.school.id,
            class_id=self.cls.id,
            session='2026-27',
            name="Class 8 Standard Fee 2026-27",
            frequency='MONTHLY',
            due_date_day=10,
        )
        db.session.add(struct)
        db.session.flush()

        item1 = FeeStructureItemV2(structure_id=struct.id, fee_head_id=tuition_head.id, amount=3000.0)
        db.session.add(item1)
        db.session.commit()

        self.assertEqual(struct.total_amount(), 3000.0)

    def test_02_applicable_charges_and_concessions(self):
        """Verify student applicable charges calculation with scholarship concession."""
        ensure_default_fee_heads(self.school.id)
        tuition_head = FeeHead.query.filter_by(school_id=self.school.id, code='TUITION').first()

        # Apply Merit Scholarship Concession of ₹500 on Tuition
        conc = StudentConcession(
            school_id=self.school.id,
            student_id=self.student.id,
            fee_head_id=tuition_head.id,
            session='2026-27',
            concession_type='SCHOLARSHIP',
            discount_type='FIXED',
            discount_value=500.0,
            reason="Merit Scholarship Top 5%",
            approved_by=self.admin.id,
            approval_status='APPROVED',
        )
        db.session.add(conc)
        db.session.commit()

        charges = get_student_applicable_charges(self.student.id, session='2026-27')
        tuition_charge = next((c for c in charges if c['fee_head_code'] == 'TUITION'), None)

        self.assertIsNotNone(tuition_charge)
        self.assertEqual(tuition_charge['original_amount'], 3000.0)
        self.assertEqual(tuition_charge['discount_amount'], 500.0)
        self.assertEqual(tuition_charge['net_amount'], 2500.0)

    def test_03_advance_fee_bill_generation_and_duplicate_prevention(self):
        """Verify pre-due demand bill generation for September 2026 with duplicate prevention."""
        bill, created = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )
        self.assertTrue(created)
        self.assertIsNotNone(bill.bill_no)
        self.assertEqual(bill.bill_month, '2026-09')
        self.assertEqual(bill.status, BillStatus.ISSUED.value)
        self.assertGreater(bill.total_payable, 0)

        # Ensure duplicate bill generation is prevented
        duplicate_bill, created_again = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27',
            force_regenerate=False
        )
        self.assertFalse(created_again)
        self.assertEqual(bill.id, duplicate_bill.id)

    def test_04_payment_collection_multi_head_allocation_and_receipt(self):
        """Verify fee payment collection, exact allocation across services, and receipt generation."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )

        tuition_item = bill.items[0]
        allocations = [{
            'bill_id': bill.id,
            'bill_item_id': tuition_item.id,
            'fee_head_id': tuition_item.fee_head_id,
            'amount': tuition_item.net_amount
        }]

        # Collect Payment via UPI
        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=tuition_item.net_amount,
            payment_mode='UPI',
            transaction_ref='UPI-UTR-9988776655',
            allocations=allocations,
            collected_by=self.admin,
            remarks="Paid by father at accounts desk",
            department='ACCOUNTS',
            session='2026-27'
        )

        self.assertIsNotNone(payment.receipt_no)
        self.assertTrue(payment.receipt_no.startswith('REC-'))
        self.assertEqual(payment.status, PaymentStatus.VALID.value)
        self.assertEqual(payment.total_paid, tuition_item.net_amount)

        # Verify bill item and bill are updated to PAID
        db.session.refresh(tuition_item)
        db.session.refresh(bill)
        self.assertEqual(tuition_item.balance_amount, 0.0)
        self.assertEqual(bill.status, BillStatus.PAID.value)

        # Verify student ledger
        ledger = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger['outstanding'], 0.0)
        self.assertEqual(ledger['total_paid'], tuition_item.net_amount)

    def test_05_receipt_cancellation_and_refunds(self):
        """Verify payment receipt cancellation reverses ledger balance and refund processing."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )

        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=bill.total_payable,
            payment_mode='CASH',
            transaction_ref='',
            allocations=[], # Auto allocate
            collected_by=self.admin,
            session='2026-27'
        )

        # Cancel Receipt
        cancelled_payment = cancel_payment_receipt(
            payment_id=payment.id,
            actor_user=self.admin,
            cancel_reason="Wrong amount entered by cashier"
        )
        self.assertEqual(cancelled_payment.status, PaymentStatus.CANCELLED.value)

        # Verify ledger has reinstated outstanding balance
        ledger = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger['outstanding'], bill.total_payable)

        # Test Process Refund
        refund = process_fee_refund(
            student_id=self.student.id,
            amount=500.0,
            refund_mode='BANK_TRANSFER',
            reason="Transport service discontinued mid-term",
            authorized_by=self.admin,
            reference_no='REF-TXN-001'
        )
        self.assertEqual(refund.status, 'PROCESSED')
        self.assertEqual(refund.amount, 500.0)

    def test_06_finance_dashboard_and_net_surplus(self):
        """Verify executive dashboard calculations: Billed, Collected, Outstanding, Expenses, and Net Surplus."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )

        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=bill.total_payable,
            payment_mode='UPI',
            transaction_ref='UPI-12345',
            allocations=[],
            collected_by=self.admin,
            session='2026-27'
        )

        # Add an Expense record
        exp = Expense(
            school_id=self.school.id,
            category='ELECTRICITY',
            title='Campus Electricity Bill',
            amount=1000.0,
            payment_method='UPI',
            payment_date=date.today(),
            month='September 2026',
            status='PAID'
        )
        db.session.add(exp)
        db.session.commit()

        metrics = get_finance_dashboard_metrics(self.school.id, session='2026-27')
        self.assertEqual(metrics['total_billed'], bill.total_payable)
        self.assertEqual(metrics['total_collected'], bill.total_payable)
        self.assertEqual(metrics['outstanding'], 0.0)
        self.assertEqual(metrics['total_expenses'], 1000.0)
        self.assertEqual(metrics['net_surplus'], round(bill.total_payable - 1000.0, 2))

    def test_07_reportlab_pdf_generation_bill_and_receipt(self):
        """Verify ReportLab PDF generation for both Demand Notice and Fee Receipt."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )

        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=bill.total_payable,
            payment_mode='UPI',
            transaction_ref='UPI-12345',
            allocations=[],
            collected_by=self.admin,
            session='2026-27'
        )

        # Generate Demand Notice PDF
        bill_pdf_buf = generate_fee_bill_pdf(bill, self.school, self.student)
        self.assertIsNotNone(bill_pdf_buf)
        bill_pdf_bytes = bill_pdf_buf.getvalue()
        self.assertTrue(len(bill_pdf_bytes) > 1000)
        self.assertTrue(bill_pdf_bytes.startswith(b'%PDF-'))

        # Generate Fee Receipt PDF
        rcpt_pdf_buf = generate_fee_receipt_pdf(payment, self.school, self.student, ledger_balance=0.0)
        self.assertIsNotNone(rcpt_pdf_buf)
        rcpt_pdf_bytes = rcpt_pdf_buf.getvalue()
        self.assertTrue(len(rcpt_pdf_bytes) > 1000)
        self.assertTrue(rcpt_pdf_bytes.startswith(b'%PDF-'))


if __name__ == '__main__':
    unittest.main()
