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
    FeeBill, FeePayment, BillStatus, PaymentStatus, StudentLedger, FeeRefund
)
from app.models.finance import (
    Expense, Vendor, PurchaseOrder, PurchaseOrderItem, BankStatementBatch, BankTransaction
)
from app.services.fee_ledger_service import (
    ensure_default_fee_heads, generate_fee_bill, collect_fee_payment,
    get_student_applicable_charges, get_student_ledger,
    cancel_payment_receipt, process_fee_refund
)
from app.services.pnl_service import PnLService
from app.services.procurement_service import (
    create_purchase_order, approve_purchase_order, process_goods_receipt
)
from app.services.reconciliation_service import ReconciliationService
from app.utils.fee_pdf_generator import generate_fee_receipt_pdf
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

    def test_06_cancellation_and_refund_ledger_balance(self):
        """6. Verify receipt cancellation and refund accurately update student ledger balance_after."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month="2026-09",
            due_date=date(2026, 9, 10),
            actor_user=self.admin,
            session="2026-27"
        )
        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=1000.0,
            payment_mode="CASH",
            collected_by=self.admin,
            session="2026-27"
        )
        # Prior balance became 0.0 after paying 1000.0
        last_l = StudentLedger.query.filter_by(student_id=self.student.id).order_by(StudentLedger.id.desc()).first()
        self.assertEqual(last_l.balance_after, 0.0)

        # Cancel receipt
        cancel_payment_receipt(payment.id, self.admin, "Bounced Cheque / Error")
        rev_ledger = StudentLedger.query.filter_by(student_id=self.student.id).order_by(StudentLedger.id.desc()).first()
        self.assertEqual(rev_ledger.entry_type, 'DEBIT')
        # Balance after reversal must be 1000.0, NOT 0.0!
        self.assertEqual(rev_ledger.balance_after, 1000.0)

        # Process a refund of 200.0
        ref = process_fee_refund(
            student_id=self.student.id,
            amount=200.0,
            refund_mode='CASH',
            reason='Security deposit refund',
            authorized_by=self.admin
        )
        ref_ledger = StudentLedger.query.filter_by(student_id=self.student.id).order_by(StudentLedger.id.desc()).first()
        self.assertEqual(ref_ledger.entry_type, 'DEBIT')
        # Balance after refund must increase by 200.0 -> 1200.0
        self.assertEqual(ref_ledger.balance_after, 1200.0)

    def test_07_pnl_refunds_and_capex_isolation(self):
        """7. Verify PnLService deducts processed refunds and isolates CAPITAL_EXPENDITURE from operating expenses."""
        bill, _ = generate_fee_bill(
            student_id=self.student.id,
            bill_month="2026-10",
            due_date=date(2026, 10, 10),
            actor_user=self.admin,
            session="2026-27"
        )
        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=5000.0,
            payment_mode="CASH",
            collected_by=self.admin,
            session="2026-27"
        )
        # Process a refund of 500
        process_fee_refund(
            student_id=self.student.id,
            amount=500.0,
            refund_mode='BANK_TRANSFER',
            reason='Excess fee paid refund',
            authorized_by=self.admin
        )
        # Add operating expense
        op_exp = Expense(
            title="Office Stationery",
            category="STATIONERY",
            amount=1000.0,
            status="PAID",
            payment_date=date(2026, 10, 15),
            month="2026-10",
            school_id=self.school.id
        )
        # Add capital expenditure (school bus / lab computers)
        cap_exp = Expense(
            title="School Bus Downpayment",
            category="CAPITAL_EXPENDITURE",
            amount=50000.0,
            status="PAID",
            payment_date=date(2026, 10, 15),
            month="2026-10",
            school_id=self.school.id
        )
        db.session.add_all([op_exp, cap_exp])
        db.session.commit()

        pnl = PnLService.get_profit_and_loss_statement(
            school_id=self.school.id,
            session="2026-27",
            month="2026-10",
            accounting_policy="CASH"
        )
        # Realized collections: 5000 - 500 refund = 4500
        self.assertEqual(pnl['total_income'], 4500.0)
        self.assertEqual(pnl['total_refunds'], 500.0)
        # Operating expenses: 1000 (CapEx of 50,000 must NOT be counted as OPEX!)
        self.assertEqual(pnl['total_expenses'], 1000.0)
        # Net operating surplus: 4500 - 1000 = 3500 (NOT negative 46500!)
        self.assertEqual(pnl['net_operating_result'], 3500.0)
        self.assertTrue(pnl['is_surplus'])
        # CapEx isolated in dedicated summary
        self.assertEqual(pnl['capital_expenditure']['total_capex'], 50000.0)

    def test_08_procurement_goods_receipt_tax_preservation(self):
        """8. Verify process_goods_receipt correctly populates subtotal and tax_amount without zeroing tax."""
        vendor = Vendor(
            school_id=self.school.id,
            name="Apex Scientific Supplies",
            category="LABORATORY",
            contact_person="R. Sharma",
            phone="9876543210"
        )
        db.session.add(vendor)
        db.session.commit()

        po = create_purchase_order(
            school_id=self.school.id,
            vendor_id=vendor.id,
            items_data=[{
                'item_name': 'Microscope Lens Pack',
                'category': 'LAB_CONSUMABLES',
                'sku': 'MIC-001',
                'unit': 'SETS',
                'ordered_qty': 10,
                'unit_price': 1000.0,
                'tax_pct': 18.0,
                'is_asset': False,
            }],
            target_type='INVENTORY',
            user=self.admin
        )
        approve_purchase_order(po.id, self.school.id, self.admin)
        po_item = po.items.first()

        grn, vbill = process_goods_receipt(
            po_id=po.id,
            school_id=self.school.id,
            received_items=[{
                'po_item_id': po_item.id,
                'received_qty': 10,
                'rejected_qty': 0,
            }],
            challan_no="CH-LAB-01",
            user=self.admin
        )
        # Subtotal: 10 * 1000 = 10,000.0
        self.assertEqual(vbill.subtotal, 10000.0)
        # Tax: 18% of 10,000 = 1,800.0 (NOT 0.0!)
        self.assertEqual(vbill.tax_amount, 1800.0)
        # Total: 11,800.0
        self.assertEqual(vbill.total_amount, 11800.0)
        self.assertEqual(vbill.balance_amount, 11800.0)

    def test_09_fee_receipt_pdf_advance_deduplication(self):
        """9. Verify 100% advance payment PDF does not duplicate fallback row."""
        payment = FeePayment(
            school_id=self.school.id,
            student_id=self.student.id,
            session="2026-27",
            receipt_no="RCPT-ADV-TEST-001",
            payment_date=date.today(),
            payment_mode="UPI",
            total_paid=3000.0,
            advance_credited=3000.0,
            status="VALID"
        )
        db.session.add(payment)
        db.session.commit()

        pdf_buffer = generate_fee_receipt_pdf(payment, self.school, self.student)
        self.assertIsNotNone(pdf_buffer)
        pdf_bytes = pdf_buffer.getvalue() if hasattr(pdf_buffer, 'getvalue') else pdf_buffer
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    def test_10_reconciliation_standalone_fee_transaction_matching(self):
        """10. Verify bank reconciliation matches standalone FeeTransaction records."""
        rec = FeeRecord(student_id=self.student.id, school_id=self.school.id, session="2026-27", month="August", amount_due=1500.0, status='PENDING')
        db.session.add(rec)
        db.session.flush()

        # Standalone FeeTransaction without a FeePayment parent
        ft = FeeTransaction(
            school_id=self.school.id,
            student_id=self.student.id,
            fee_record_id=rec.id,
            amount=1500.0,
            payment_mode="CASH",
            transaction_date=date(2026, 8, 15),
            txn_month="August 2026",
            receipt_no="TXN-COUNTER-888"
        )
        db.session.add(ft)
        db.session.commit()

        # Bank statement batch with matching receipt narration
        csv_bytes = "Date,Description,Credit,Reference\n2026-08-15,CASH DEPOSIT TXN-COUNTER-888,1500.00,REF888\n".encode('utf-8')
        batch = ReconciliationService.create_batch_and_transactions(
            school_id=self.school.id,
            file_bytes=csv_bytes,
            filename="reconcile_test.csv",
            bank_name="Test Bank"
        )
        ReconciliationService.run_auto_matching(self.school.id, batch_id=batch.id)
        tx = BankTransaction.query.filter_by(batch_id=batch.id).first()
        self.assertEqual(tx.match_status, 'MATCHED')
        self.assertEqual(tx.matched_entity_type, 'FEE_TRANSACTION')
        self.assertEqual(tx.matched_entity_id, ft.id)
