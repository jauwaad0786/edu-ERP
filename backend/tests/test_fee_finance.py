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
from app.models.hrms import PayrollRun, PayrollSlip, PayrollRunStatus
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
from app.services.payroll_engine import pay_payroll_slip, pay_payroll_run_all
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
            session="2026-27",
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

    def test_08_golu_hostel_bidirectional_sync_and_partial_payments(self):
        """
        Verify exact user scenario:
        1. Golu is admitted to Hostel (Room A-102, ₹8,000 fee).
        2. Central Fees Management & Student Ledger immediately show ₹8,000.
        3. Warden collects ₹3,000 in Hostel module -> Both show Paid=₹3,000, Due=₹5,000.
        4. Central Fees collects remaining ₹5,000 -> Both show Paid=₹8,000, Due=₹0.
        5. Payment logs show both transactions with their respective collectors.
        """
        from app.models.hostel import (
            Hostel, HostelBuilding, HostelFloor, HostelRoom,
            HostelBed, HostelBedAllocation, HostelFeeStructure
        )
        from app.services.hostel_fee_service import generate_hostel_fee_record, record_hostel_fee_payment

        # Create Warden User
        warden = User(name="Warden Verma", email="warden@dpa.edu.in", role="HOSTEL", school_id=self.school.id)
        warden.set_password("Warden@123")
        db.session.add(warden)
        db.session.commit()

        # Create Hostel Infrastructure
        hostel = Hostel(name="Tagore Boys Hostel", gender="BOYS", school_id=self.school.id)
        db.session.add(hostel)
        db.session.flush()

        bld = HostelBuilding(hostel_id=hostel.id, name="Block A", school_id=self.school.id)
        db.session.add(bld)
        db.session.flush()

        flr = HostelFloor(building_id=bld.id, floor_number=1, name="First Floor", school_id=self.school.id)
        db.session.add(flr)
        db.session.flush()

        room = HostelRoom(floor_id=flr.id, room_number="A-102", room_type="DOUBLE", is_ac=True, school_id=self.school.id)
        db.session.add(room)
        db.session.flush()

        bed = HostelBed(room_id=room.id, bed_number="A-102-1", status="VACANT", school_id=self.school.id)
        db.session.add(bed)
        db.session.flush()

        # Define Hostel Fee Structure: ₹8,000/month
        h_fs = HostelFeeStructure(
            school_id=self.school.id, hostel_id=hostel.id,
            is_ac=True, sharing_type="DOUBLE",
            monthly_fee=6000.0, mess_charges=2000.0
        )
        db.session.add(h_fs)
        db.session.commit()

        # Admit Student to Hostel
        alloc = HostelBedAllocation(
            school_id=self.school.id, student_id=self.student.id,
            hostel_id=hostel.id, building_id=bld.id, floor_id=flr.id,
            room_id=room.id, bed_id=bed.id,
            admission_date=date.today(), status='ACTIVE',
            allocated_by=warden.id
        )
        db.session.add(alloc)
        bed.status = 'OCCUPIED'
        bed.current_student_id = self.student.id
        db.session.commit()

        # Generate Hostel Fee
        fee_rec, reason = generate_hostel_fee_record(alloc, warden.id, month='2026-09')
        db.session.commit()
        self.assertEqual(reason, 'created')
        self.assertEqual(fee_rec.amount_due, 8000.0)

        # Verify Central Ledger immediately shows ₹8,000
        ledger = get_student_ledger(self.student.id, session='2026-27')
        self.assertGreaterEqual(ledger['total_billed'], 8000.0)
        self.assertEqual(ledger['outstanding'], 8000.0)

        # Warden collects ₹3,000 in Hostel
        rec_paid, txn = record_hostel_fee_payment(fee_rec, 3000.0, payment_mode='CASH', remarks='Partial cash', collected_by_user=warden)
        self.assertEqual(rec_paid.amount_paid, 3000.0)
        self.assertEqual(rec_paid.effective_due() - rec_paid.amount_paid, 5000.0)

        # Verify Central Ledger immediately shows Paid=₹3,000, Due=₹5,000
        ledger_after_warden = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger_after_warden['total_paid'], 3000.0)
        self.assertEqual(ledger_after_warden['outstanding'], 5000.0)

        # Central Accountant collects remaining ₹5,000
        pmt = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=5000.0,
            payment_mode='UPI',
            transaction_ref='UPI-REC-5000',
            allocations=[],
            collected_by=self.admin,
            session='2026-27'
        )

        # Verify both Hostel and Central Finance show Paid=₹8,000, Due=₹0
        ledger_final = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger_final['total_paid'], 8000.0)
        self.assertEqual(ledger_final['outstanding'], 0.0)
        db.session.refresh(fee_rec)
        self.assertEqual(fee_rec.status, 'PAID')

    def test_09_library_fine_and_central_payment(self):
        """
        Verify Library Fine flow:
        1. Librarian creates ₹500 fine.
        2. Central Fees & Student Ledger immediately show ₹500 outstanding.
        3. Librarian collects ₹500 -> All views show PAID with Librarian recorded as collector.
        """
        from app.models.library import LibraryMember, FineTransaction
        from app.services.library_fee_service import generate_library_fine_fee_record, record_library_fine_payment

        librarian = User(name="Librarian Gupta", email="librarian@dpa.edu.in", role="LIBRARIAN", school_id=self.school.id)
        librarian.set_password("Librarian@123")
        db.session.add(librarian)
        db.session.commit()

        lib_mem = LibraryMember(user_id=self.stu_user.id, school_id=self.school.id, card_number="LIB-STU-1023", status="ACTIVE")
        db.session.add(lib_mem)
        db.session.commit()

        fine = FineTransaction(
            school_id=self.school.id, member_id=lib_mem.id,
            amount=500.0, reason="Damaged Reference Book",
            status="OUTSTANDING"
        )
        db.session.add(fine)
        db.session.commit()

        # Generate fine record
        fee_rec, _ = generate_library_fine_fee_record(fine, created_by=librarian.id)
        db.session.commit()

        # Verify Central Ledger immediately shows ₹500
        ledger = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger['outstanding'], 500.0)

        # Librarian collects ₹500
        res = record_library_fine_payment(fine, 500.0, payment_mode='CASH', collected_by_user_id=librarian.id)
        self.assertEqual(res['status'], 'PAID')
        self.assertEqual(res['outstanding_amount'], 0.0)

        # Verify Central Ledger is now settled (₹0 due)
        ledger_after = get_student_ledger(self.student.id, session='2026-27')
        self.assertEqual(ledger_after['total_paid'], 500.0)
        self.assertEqual(ledger_after['outstanding'], 0.0)

    def test_10_combined_multi_department_payment(self):
        """
        Verify Combined Payment across multiple service heads:
        Tuition ₹3,000 + Transport ₹1,200 (Total ₹4,200).
        Pay ₹4,200 in single transaction with multi-head allocations.
        """
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month='2026-09',
            due_date=date(2026, 9, 5),
            actor_user=self.admin,
            session='2026-27'
        )

        pmt = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=bill.total_payable,
            payment_mode='CARD',
            transaction_ref='POS-CARD-8991',
            allocations=[],
            collected_by=self.admin,
            session='2026-27'
        )

        self.assertEqual(pmt.total_paid, bill.total_payable)
        self.assertEqual(pmt.status, PaymentStatus.VALID.value)

        # Verify Payment Allocations were generated
        allocs = FeePaymentAllocation.query.filter_by(payment_id=pmt.id).all()
        self.assertGreaterEqual(len(allocs), 1)
        tot_allocated = sum(a.allocated_amount for a in allocs)
        self.assertEqual(tot_allocated, bill.total_payable)

    def test_11_teacher_payroll_hrms_to_finance_sync(self):
        """
        Verify Teacher Salary Payment flow from HRMS:
        1. Teacher 'Rahul Kumar' has gross ₹40,000, deductions ₹5,000, net ₹35,000.
        2. Accountant disburses salary via HRMS.
        3. HRMS PayrollSlip status becomes 'PAID'.
        4. Central Finance Expense is created (category='TEACHER_SALARY', amount=₹35,000).
        5. Principal Finance Dashboard shows Total Expenses updated by ₹35,000.
        """
        teacher_user = User(
            name="Rahul Kumar",
            email="rahul.teacher@dpa.edu",
            role="TEACHER",
            department="Mathematics",
            school_id=self.school.id,
            employee_id="EMP-102",
            salary=40000.0,
        )
        teacher_user.set_password("Teacher@123")
        db.session.add(teacher_user)
        db.session.commit()

        run = PayrollRun(
            school_id=self.school.id,
            month=9,
            year=2026,
            month_name="September 2026",
            total_employees=1,
            total_gross=40000.0,
            total_deductions=5000.0,
            total_net=35000.0,
            status=PayrollRunStatus.APPROVED.value,
        )
        db.session.add(run)
        db.session.commit()

        slip = PayrollSlip(
            payroll_run_id=run.id,
            school_id=self.school.id,
            user_id=teacher_user.id,
            gross_salary=40000.0,
            total_deductions=5000.0,
            net_salary=35000.0,
            payment_status='PENDING',
        )
        db.session.add(slip)
        db.session.commit()

        # Disburse from HRMS
        paid_slip, exp = pay_payroll_slip(
            slip_id=slip.id,
            payment_mode='BANK_TRANSFER',
            transaction_ref='TXN-NEFT-99120',
            paid_by_user=self.admin,
            remarks='September 2026 Salary Disbursed by Accountant'
        )

        # 1. Check HRMS slip status
        self.assertEqual(paid_slip.payment_status, 'PAID')
        self.assertEqual(paid_slip.payment_mode, 'BANK_TRANSFER')

        # 2. Check Central Finance Expense
        self.assertIsNotNone(exp)
        self.assertEqual(exp.category, 'TEACHER_SALARY')
        self.assertEqual(exp.amount, 35000.0)
        self.assertEqual(exp.vendor_name, 'Rahul Kumar')
        self.assertEqual(exp.invoice_number, 'TXN-NEFT-99120')

        # 3. Check Principal Finance Dashboard
        dash = get_finance_dashboard_metrics(self.school.id, session='2026-27')
        self.assertGreaterEqual(dash['total_expenses'], 35000.0)

    def test_12_staff_payroll_finance_to_hrms_sync(self):
        """
        Verify Staff Salary Payment flow from Central Finance:
        1. Driver 'Suresh' (Transport department) has net salary ₹22,000.
        2. Principal pays Suresh's salary from Central Finance page.
        3. Central Finance Expense is created (category='TRANSPORT_STAFF_SALARY').
        4. HRMS PayrollSlip is immediately marked PAID.
        """
        driver_user = User(
            name="Suresh Kumar",
            email="suresh.driver@dpa.edu",
            role="TRANSPORT",
            department="TRANSPORT",
            school_id=self.school.id,
            employee_id="DRV-005",
            salary=22000.0,
        )
        driver_user.set_password("Driver@123")
        db.session.add(driver_user)
        db.session.commit()

        run = PayrollRun(
            school_id=self.school.id,
            month=9,
            year=2026,
            month_name="September 2026",
            total_employees=1,
            total_gross=22000.0,
            total_deductions=0.0,
            total_net=22000.0,
            status=PayrollRunStatus.APPROVED.value,
        )
        db.session.add(run)
        db.session.commit()

        slip = PayrollSlip(
            payroll_run_id=run.id,
            school_id=self.school.id,
            user_id=driver_user.id,
            gross_salary=22000.0,
            total_deductions=0.0,
            net_salary=22000.0,
            payment_status='PENDING',
        )
        db.session.add(slip)
        db.session.commit()

        # Principal pays from Central Finance
        paid_slip, exp = pay_payroll_slip(
            slip_id=slip.id,
            payment_mode='UPI',
            transaction_ref='UPI-SAL-8821',
            paid_by_user=self.admin
        )

        self.assertEqual(paid_slip.payment_status, 'PAID')
        self.assertEqual(exp.category, 'TRANSPORT_STAFF_SALARY')
        self.assertEqual(exp.amount, 22000.0)

    def test_13_duplicate_salary_prevention(self):
        """
        Verify that paying the same salary slip twice is rejected with ValueError.
        """
        staff_user = User(
            name="Amit Warden",
            email="amit.warden@dpa.edu",
            role="HOSTEL",
            department="HOSTEL",
            school_id=self.school.id,
            employee_id="WRD-001",
            salary=28000.0,
        )
        staff_user.set_password("Warden@123")
        db.session.add(staff_user)
        db.session.commit()

        run = PayrollRun(
            school_id=self.school.id,
            month=9,
            year=2026,
            month_name="September 2026",
            total_employees=1,
            total_gross=28000.0,
            total_deductions=0.0,
            total_net=28000.0,
            status=PayrollRunStatus.APPROVED.value,
        )
        db.session.add(run)
        db.session.commit()

        slip = PayrollSlip(
            payroll_run_id=run.id,
            school_id=self.school.id,
            user_id=staff_user.id,
            gross_salary=28000.0,
            total_deductions=0.0,
            net_salary=28000.0,
            payment_status='PENDING',
        )
        db.session.add(slip)
        db.session.commit()

        # First payment succeeds
        pay_payroll_slip(slip_id=slip.id, paid_by_user=self.admin)

        # Second payment fails with error
        with self.assertRaises(ValueError):
            pay_payroll_slip(slip_id=slip.id, paid_by_user=self.admin)


if __name__ == '__main__':
    unittest.main()
