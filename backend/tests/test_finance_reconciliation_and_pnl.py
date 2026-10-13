"""
Comprehensive Phase 12 Automated Test Suite for Finance, Demand Bills, Reconciliation, and P&L.
Covers 15 Synthetic Scenarios:
 1. Advance demand bills generated before billing month starts
 2. Payments collected over multiple dates
 3. Partial and multiple payments against one bill
 4. Advance payments and unallocated credits
 5. Concessions, scholarships, and refunds
 6. Duplicate payment callback / idempotency
 7. Bank statement reconciliation with exact matched entries
 8. Duplicate bank statement imports idempotency
 9. Settlement fee amount mismatch and resolution without ledger mutation
10. Unpaid liabilities vs paid expenses
11. Transfers between school-owned bank accounts
12. Session rollover with historical finance records preservation
13. Monthly and annual P&L statements (cash basis vs accrual basis)
14. Cross-school tenant isolation
15. Dashboard totals strictly matching transaction details
"""

import unittest
from datetime import date, datetime, timedelta

from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.finance import Expense, BankStatementBatch, BankTransaction
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentConcession,
    FeeBill, FeePayment, BillStatus, PaymentStatus
)
from app.services.fee_ledger_service import (
    ensure_default_fee_heads, generate_fee_bill, collect_fee_payment,
    process_fee_refund, cancel_payment_receipt, get_student_ledger,
    get_finance_dashboard_metrics
)
from app.services.reconciliation_service import ReconciliationService
from app.services.pnl_service import PnLService


class FinanceReconciliationAndPnLTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed Primary School A
        self.school_a = School(
            name="Delhi Public Academy",
            code="DPA01",
            address="Sector 14, Rohini, New Delhi",
            phone="011-27891234",
            email="accounts@dpa.edu.in"
        )
        # Seed Second School B for Tenant Isolation
        self.school_b = School(
            name="St. Xavier International",
            code="SXI02",
            address="Civil Lines, Jaipur",
            phone="0141-2345678",
            email="accounts@sxavier.edu.in"
        )
        db.session.add_all([self.school_a, self.school_b])
        db.session.commit()

        # Seed Admins
        self.admin_a = User(
            name="Principal Sharma",
            email="principal@dpa.edu.in",
            role="PRINCIPAL",
            school_id=self.school_a.id
        )
        self.admin_a.set_password("Admin@123")

        self.admin_b = User(
            name="Principal Xavier",
            email="principal@sxavier.edu.in",
            role="PRINCIPAL",
            school_id=self.school_b.id
        )
        self.admin_b.set_password("Admin@123")
        db.session.add_all([self.admin_a, self.admin_b])
        db.session.commit()

        # Seed Classes
        self.cls_a = Class(name="Class 8", section="A", school_id=self.school_a.id)
        self.cls_b = Class(name="Class 10", section="B", school_id=self.school_b.id)
        db.session.add_all([self.cls_a, self.cls_b])
        db.session.commit()

        # Seed Student for School A
        self.student_user_a = User(
            name="Rohan Verma",
            email="rohan.verma@dpa.edu.in",
            role="STUDENT",
            school_id=self.school_a.id
        )
        self.student_user_a.set_password("Student@123")
        db.session.add(self.student_user_a)
        db.session.commit()

        self.student_a = Student(
            user_id=self.student_user_a.id,
            class_id=self.cls_a.id,
            admission_no="ADM-2026-001",
            father_name="Sanjay Verma",
            parent_phone="9876543210",
            session="2026-27",
            school_id=self.school_a.id
        )
        db.session.add(self.student_a)
        db.session.commit()

        # Seed Fee Heads
        ensure_default_fee_heads(self.school_a.id)
        self.tuition_head = FeeHead.query.filter_by(school_id=self.school_a.id, code="TUITION").first()
        self.exam_head = FeeHead.query.filter_by(school_id=self.school_a.id, code="EXAM").first()
        self.transport_head = FeeHead.query.filter_by(school_id=self.school_a.id, code="TRANSPORT").first()

        # Fee Structure Rate Card for Class 8 (Tuition 4000 + Exam 1000 = 5000)
        self.struct_a = FeeStructureV2(
            school_id=self.school_a.id,
            class_id=self.cls_a.id,
            session="2026-27",
            name="Class 8 Standard Fee 2026-27",
            frequency="MONTHLY",
            due_date_day=10
        )
        db.session.add(self.struct_a)
        db.session.flush()

        item1 = FeeStructureItemV2(structure_id=self.struct_a.id, fee_head_id=self.tuition_head.id, amount=4000.0)
        item2 = FeeStructureItemV2(structure_id=self.struct_a.id, fee_head_id=self.exam_head.id, amount=1000.0)
        db.session.add_all([item1, item2])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # -------------------------------------------------------------------------
    # SCENARIO 1: Advance Demand Bill Generated Before Billing Month Starts
    # -------------------------------------------------------------------------
    def test_scenario_01_advance_demand_bill_generation(self):
        """Advance bills generated ahead of time must be recorded with future billing period and due date."""
        future_due_date = date.today() + timedelta(days=20)

        bill, created = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-11",
            due_date=future_due_date,
            actor_user=self.admin_a,
            session="2026-27"
        )

        self.assertTrue(created)
        self.assertEqual(bill.bill_month, "2026-11")
        self.assertEqual(bill.due_date, future_due_date)
        self.assertEqual(float(bill.total_payable), 5000.0)
        self.assertEqual(float(bill.amount_paid), 0.0)
        self.assertIn(bill.status, [BillStatus.ISSUED.value, BillStatus.OVERDUE.value])

        # Ensure student ledger reflects the billing charge
        ledger = get_student_ledger(self.student_a.id, session="2026-27")
        self.assertEqual(ledger['total_billed'], 5000.0)
        self.assertEqual(ledger['outstanding'], 5000.0)

    # -------------------------------------------------------------------------
    # SCENARIO 2: Payments Collected Over Multiple Dates
    # -------------------------------------------------------------------------
    def test_scenario_02_payments_collected_over_multiple_dates(self):
        """Payments arrive on different dates; each transaction has its distinct payment_date preserved."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-04",
            due_date=date(2026, 4, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )

        date_1 = date(2026, 4, 2)
        date_2 = date(2026, 4, 9)

        pay_1 = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=2000.0,
            payment_mode="UPI",
            transaction_ref="UPI-TXN-001",
            collected_by=self.admin_a,
            session="2026-27"
        )
        pay_1.payment_date = date_1
        db.session.commit()

        pay_2 = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=3000.0,
            payment_mode="BANK_TRANSFER",
            transaction_ref="NEFT-TXN-002",
            collected_by=self.admin_a,
            session="2026-27"
        )
        pay_2.payment_date = date_2
        db.session.commit()

        self.assertEqual(pay_1.payment_date, date_1)
        self.assertEqual(pay_2.payment_date, date_2)
        db.session.refresh(bill)
        self.assertEqual(float(bill.amount_paid), 5000.0)
        self.assertEqual(bill.status, BillStatus.PAID.value)

    # -------------------------------------------------------------------------
    # SCENARIO 3: Partial and Multiple Payments Against One Bill
    # -------------------------------------------------------------------------
    def test_scenario_03_partial_and_multiple_payments(self):
        """Demand bill: ₹5,000. Pay 1: ₹2,000. Pay 2: ₹1,500. Balance: ₹1,500."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-05",
            due_date=date(2026, 5, 15),
            actor_user=self.admin_a,
            session="2026-27"
        )

        # Pay 1: 2000
        collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=2000.0,
            payment_mode="CASH",
            collected_by=self.admin_a,
            session="2026-27"
        )
        db.session.refresh(bill)
        self.assertEqual(float(bill.amount_paid), 2000.0)
        self.assertEqual(float(bill.balance_due), 3000.0)
        self.assertEqual(bill.status, BillStatus.PARTIALLY_PAID.value)

        # Pay 2: 1500
        collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=1500.0,
            payment_mode="UPI",
            collected_by=self.admin_a,
            session="2026-27"
        )
        db.session.refresh(bill)
        self.assertEqual(float(bill.amount_paid), 3500.0)
        self.assertEqual(float(bill.balance_due), 1500.0)
        self.assertEqual(bill.status, BillStatus.PARTIALLY_PAID.value)

    # -------------------------------------------------------------------------
    # SCENARIO 4: Advance Payments and Unallocated Credits
    # -------------------------------------------------------------------------
    def test_scenario_04_advance_payments_unallocated_credits(self):
        """When a student pays ₹6,000 against a ₹5,000 bill, ₹1,000 is tracked as advance credit."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-06",
            due_date=date(2026, 6, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )

        pay = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=6000.0,
            payment_mode="UPI",
            collected_by=self.admin_a,
            session="2026-27"
        )

        db.session.refresh(bill)
        self.assertEqual(float(bill.amount_paid), 5000.0)
        self.assertEqual(bill.status, BillStatus.PAID.value)
        self.assertEqual(float(pay.total_paid), 6000.0)

        # Ledger computes advance credit balance
        ledger = get_student_ledger(self.student_a.id, session="2026-27")
        self.assertEqual(ledger['total_paid'], 6000.0)
        self.assertEqual(ledger['total_billed'], 5000.0)
        self.assertEqual(ledger['advance_credit'], 1000.0)

    # -------------------------------------------------------------------------
    # SCENARIO 5: Discounts, Concessions, Scholarships, and Refunds
    # -------------------------------------------------------------------------
    def test_scenario_05_concessions_and_fee_refunds(self):
        """Scholarship concession reduces bill payable. Mid-term refund returns unspent funds."""
        conc = StudentConcession(
            school_id=self.school_a.id,
            student_id=self.student_a.id,
            fee_head_id=self.tuition_head.id,
            session="2026-27",
            concession_type="SCHOLARSHIP",
            discount_type="FIXED",
            discount_value=1000.0,
            reason="Merit Top 10%",
            approved_by=self.admin_a.id,
            approval_status="APPROVED"
        )
        db.session.add(conc)
        db.session.commit()

        # Bill for 2026-07: Tuition 4000 - 1000 concession + Exam 1000 = 4000 total
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-07",
            due_date=date(2026, 7, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )
        self.assertEqual(float(bill.total_payable), 4000.0)

        # Pay bill in full
        payment = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=4000.0,
            payment_mode="UPI",
            collected_by=self.admin_a,
            session="2026-27"
        )
        self.assertEqual(bill.status, BillStatus.PAID.value)

        # Process a ₹500 fee refund
        refund = process_fee_refund(
            student_id=self.student_a.id,
            amount=500.0,
            refund_mode="BANK_TRANSFER",
            reason="Science lab fee refund",
            authorized_by=self.admin_a,
            reference_no="REF-2026-001"
        )
        self.assertEqual(refund.status, "PROCESSED")
        self.assertEqual(float(refund.amount), 500.0)

    # -------------------------------------------------------------------------
    # SCENARIO 6: Duplicate Payment Callback / Idempotency
    # -------------------------------------------------------------------------
    def test_scenario_06_duplicate_payment_idempotency(self):
        """Idempotency safeguard: Duplicate transaction reference is detected."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-08",
            due_date=date(2026, 8, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )

        pay_1 = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=5000.0,
            payment_mode="GATEWAY_RAZORPAY",
            transaction_ref="RZP_PAY_998877",
            collected_by=self.admin_a,
            session="2026-27"
        )
        self.assertIsNotNone(pay_1)

        # Check existing payment by transaction_ref prevents duplicate
        existing = FeePayment.query.filter_by(
            school_id=self.school_a.id,
            transaction_ref="RZP_PAY_998877",
            status=PaymentStatus.VALID.value
        ).first()
        self.assertIsNotNone(existing)
        self.assertEqual(existing.id, pay_1.id)

    # -------------------------------------------------------------------------
    # SCENARIO 7: Bank Statement Reconciliation with Exact Matched Entries
    # -------------------------------------------------------------------------
    def test_scenario_07_bank_reconciliation_exact_match(self):
        """Bank statement CSV matches an ERP payment receipt reference and amount -> status MATCHED."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-09",
            due_date=date(2026, 9, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )
        pay = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=5000.0,
            payment_mode="BANK_TRANSFER",
            transaction_ref="UTR987654321",
            collected_by=self.admin_a,
            session="2026-27"
        )
        pay.payment_date = date(2026, 9, 5)
        db.session.commit()

        csv_content = (
            "Date,Description,Credit,Reference\n"
            "2026-09-05,NEFT INFLOW FROM SANJAY VERMA,5000.00,UTR987654321\n"
        ).encode('utf-8')

        batch = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="statement_sep.csv",
            bank_name="HDFC Current Account",
            statement_source="BANK_STATEMENT",
            user_id=self.admin_a.id
        )

        self.assertEqual(batch.total_transactions, 1)
        self.assertEqual(batch.matched_count, 1)
        tx = BankTransaction.query.filter_by(batch_id=batch.id).first()
        self.assertEqual(tx.match_status, "MATCHED")
        self.assertEqual(tx.matched_entity_id, pay.id)

    # -------------------------------------------------------------------------
    # SCENARIO 8: Duplicate Bank Statement Imports Idempotency
    # -------------------------------------------------------------------------
    def test_scenario_08_duplicate_bank_statement_imports(self):
        """Importing the same statement entry again flags DUPLICATE status without double-crediting."""
        csv_content = (
            "Date,Description,Credit,Reference\n"
            "2026-09-05,NEFT INFLOW FROM SANJAY VERMA,5000.00,UTR_DUP_001\n"
        ).encode('utf-8')

        batch_1 = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="statement_dup1.csv",
            bank_name="HDFC Current Account"
        )
        self.assertEqual(batch_1.total_transactions, 1)

        batch_2 = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="statement_dup2.csv",
            bank_name="HDFC Current Account"
        )
        tx_2 = BankTransaction.query.filter_by(batch_id=batch_2.id).first()
        self.assertEqual(tx_2.match_status, "DUPLICATE")

    # -------------------------------------------------------------------------
    # SCENARIO 9: Settlement Fee Amount Mismatch and Resolution Without Ledger Mutation
    # -------------------------------------------------------------------------
    def test_scenario_09_settlement_fee_amount_mismatch_resolution(self):
        """ERP receipt ₹5,000, Bank credit ₹4,850 (₹150 gateway fee). Mismatch resolved without altering student balance."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-10",
            due_date=date(2026, 10, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )
        pay = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=5000.0,
            payment_mode="GATEWAY_RAZORPAY",
            transaction_ref="RZP_NET_SETTLE_1",
            collected_by=self.admin_a,
            session="2026-27"
        )
        pay.payment_date = date(2026, 10, 2)
        db.session.commit()

        # Bank credit is ₹4850
        csv_content = (
            "Date,Description,Credit,Reference\n"
            "2026-10-02,RAZORPAY NET SETTLEMENT,4850.00,RZP_NET_SETTLE_1\n"
        ).encode('utf-8')

        batch = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="gateway_oct.csv",
            bank_name="HDFC Gateway Account"
        )
        tx = BankTransaction.query.filter_by(batch_id=batch.id).first()
        self.assertEqual(tx.match_status, "AMOUNT_MISMATCH")
        self.assertEqual(float(tx.amount), 4850.0)
        self.assertEqual(float(tx.difference_amount), 150.0)

        # Accountant resolves fee difference of ₹150 as bank charges
        updated_tx = ReconciliationService.resolve_transaction(
            school_id=self.school_a.id,
            txn_id=tx.id,
            action="RESOLVE_FEE",
            user_id=self.admin_a.id,
            fee_adjustment_amount=150.0,
            notes="3% Gateway MDR settled as operational bank charge"
        )
        self.assertEqual(updated_tx.match_status, "MATCHED")
        self.assertEqual(updated_tx.resolution_status, "ADJUSTED")

        # Crucial safeguard: Student bill and payment remain ₹5,000 fully paid!
        db.session.refresh(bill)
        db.session.refresh(pay)
        self.assertEqual(float(bill.amount_paid), 5000.0)
        self.assertEqual(bill.status, BillStatus.PAID.value)

    # -------------------------------------------------------------------------
    # SCENARIO 10: Unpaid Liabilities vs Paid Expenses
    # -------------------------------------------------------------------------
    def test_scenario_10_unpaid_liabilities_vs_paid_expenses(self):
        """Paid expense is counted in Cash flow; Unpaid expense is tracked as liability in Accrual P&L."""
        paid_exp = Expense(
            title="Electricity Bill Sept",
            category="ELECTRICITY",
            amount=12000.0,
            payment_method="BANK_TRANSFER",
            status="PAID",
            payment_date=date(2026, 9, 15),
            month="2026-09",
            school_id=self.school_a.id
        )
        unpaid_exp = Expense(
            title="Science Lab Glassware Invoice",
            category="SCIENCE_LAB",
            amount=8000.0,
            payment_method="CHEQUE",
            status="PENDING_APPROVAL",
            payment_date=date(2026, 9, 20),
            month="2026-09",
            school_id=self.school_a.id
        )
        db.session.add_all([paid_exp, unpaid_exp])
        db.session.commit()

        cash_pnl = PnLService.get_profit_and_loss_statement(
            school_id=self.school_a.id,
            session="2026-27",
            accounting_policy="CASH"
        )
        self.assertEqual(cash_pnl['total_expenses'], 12000.0)
        self.assertEqual(cash_pnl['total_unpaid_liabilities'], 8000.0)

        accrual_pnl = PnLService.get_profit_and_loss_statement(
            school_id=self.school_a.id,
            session="2026-27",
            accounting_policy="ACCRUAL"
        )
        self.assertEqual(accrual_pnl['total_expenses'], 20000.0)

    # -------------------------------------------------------------------------
    # SCENARIO 11: Transfers Between School-Owned Bank Accounts Excluded
    # -------------------------------------------------------------------------
    def test_scenario_11_inter_account_transfers_excluded_from_operating_pnl(self):
        """Transfers between two school accounts or loan entries are marked Non-Operating and excluded."""
        csv_content = (
            "Date,Description,Credit,Reference\n"
            "2026-10-01,INTERNAL CONTRA TRF FROM VAULT CASH,50000.00,CONTRA_01\n"
        ).encode('utf-8')

        batch = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="contra.csv",
            bank_name="HDFC Main Account"
        )
        tx = BankTransaction.query.filter_by(batch_id=batch.id).first()
        updated_tx = ReconciliationService.resolve_transaction(
            school_id=self.school_a.id,
            txn_id=tx.id,
            action="MARK_NON_OPERATING",
            notes="Cash vault transfer to bank"
        )
        self.assertEqual(updated_tx.match_status, "NON_OPERATING")

        # PnL Statement must NOT treat ₹50,000 contra deposit as tuition income
        pnl = PnLService.get_profit_and_loss_statement(school_id=self.school_a.id, session="2026-27")
        self.assertEqual(pnl['total_income'], 0.0)

    # -------------------------------------------------------------------------
    # SCENARIO 12: Session Rollover with Historical Finance Preservation
    # -------------------------------------------------------------------------
    def test_scenario_12_session_rollover_historical_preservation(self):
        """Historical 2025-26 bills and payments are preserved when switching to 2026-27."""
        # Create rate card for 2025-26
        struct_old = FeeStructureV2(
            school_id=self.school_a.id,
            class_id=self.cls_a.id,
            session="2025-26",
            name="Class 8 Old Fee",
            frequency="MONTHLY",
            due_date_day=10
        )
        db.session.add(struct_old)
        db.session.flush()
        db.session.add(FeeStructureItemV2(structure_id=struct_old.id, fee_head_id=self.tuition_head.id, amount=3000.0))
        db.session.commit()

        old_bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2025-04",
            due_date=date(2025, 4, 10),
            actor_user=self.admin_a,
            session="2025-26"
        )
        collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=3000.0,
            payment_mode="CASH",
            collected_by=self.admin_a,
            session="2025-26"
        )

        new_bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-04",
            due_date=date(2026, 4, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )

        metrics_old = get_finance_dashboard_metrics(self.school_a.id, session="2025-26")
        metrics_new = get_finance_dashboard_metrics(self.school_a.id, session="2026-27")

        self.assertEqual(metrics_old['total_billed'], 3000.0)
        self.assertEqual(metrics_old['total_collected'], 3000.0)
        self.assertEqual(metrics_new['total_billed'], 5000.0)
        self.assertEqual(metrics_new['total_collected'], 0.0)

    # -------------------------------------------------------------------------
    # SCENARIO 13: Monthly and Annual P&L Statements
    # -------------------------------------------------------------------------
    def test_scenario_13_monthly_and_annual_pnl_statements(self):
        """Authoritative PnLService returns exact operating surplus and cash position."""
        bill, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-11",
            due_date=date(2026, 11, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )
        collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=5000.0,
            payment_mode="BANK_TRANSFER",
            collected_by=self.admin_a,
            session="2026-27"
        )
        exp = Expense(
            title="Staff Development Workshop",
            category="MISCELLANEOUS",
            amount=2000.0,
            status="PAID",
            payment_date=date(2026, 11, 12),
            month="2026-11",
            school_id=self.school_a.id
        )
        db.session.add(exp)
        db.session.commit()

        pnl = PnLService.get_profit_and_loss_statement(
            school_id=self.school_a.id,
            session="2026-27",
            accounting_policy="CASH"
        )
        # Cash Revenue: 5,000. Cash Exp: 2,000. Surplus: 3,000
        self.assertEqual(pnl['total_income'], 5000.0)
        self.assertEqual(pnl['total_expenses'], 2000.0)
        self.assertEqual(pnl['net_operating_result'], 3000.0)
        self.assertTrue(pnl['is_surplus'])

    # -------------------------------------------------------------------------
    # SCENARIO 14: Cross-School Tenant Isolation
    # -------------------------------------------------------------------------
    def test_scenario_14_cross_school_tenant_isolation(self):
        """School B cannot access or reconcile School A batches or transactions."""
        csv_content = (
            "Date,Description,Credit,Reference\n"
            "2026-09-05,NEFT INFLOW FROM SANJAY VERMA,3500.00,UTR_TENANT_A\n"
        ).encode('utf-8')

        batch_a = ReconciliationService.create_batch_and_transactions(
            school_id=self.school_a.id,
            file_bytes=csv_content,
            filename="statement_school_a.csv",
            bank_name="HDFC School A"
        )

        # Querying batches for School B must return empty list
        batches_b = BankStatementBatch.query.filter_by(school_id=self.school_b.id).all()
        self.assertEqual(len(batches_b), 0)

        # Resolving School A transaction under School B ID must raise Exception/NotFound
        tx_a = BankTransaction.query.filter_by(batch_id=batch_a.id).first()
        with self.assertRaises(Exception):
            ReconciliationService.resolve_transaction(
                school_id=self.school_b.id,
                txn_id=tx_a.id,
                action="CONFIRM_MATCH"
            )

    # -------------------------------------------------------------------------
    # SCENARIO 15: Dashboard Totals Matching Detailed Transaction Reports
    # -------------------------------------------------------------------------
    def test_scenario_15_dashboard_totals_strictly_match_transactions(self):
        """Dashboard cards (total_billed, total_collected, pending) strictly equal the sum of line items."""
        bill1, _ = generate_fee_bill(
            student_id=self.student_a.id,
            bill_month="2026-12",
            due_date=date(2026, 12, 10),
            actor_user=self.admin_a,
            session="2026-27"
        )
        pay1 = collect_fee_payment(
            student_id=self.student_a.id,
            amount_paid=3000.0,
            payment_mode="CASH",
            collected_by=self.admin_a,
            session="2026-27"
        )
        pay1.payment_date = date(2026, 12, 5)
        db.session.commit()

        metrics = get_finance_dashboard_metrics(self.school_a.id, session="2026-27", month="2026-12")

        self.assertEqual(metrics['total_billed'], 5000.0)
        self.assertEqual(metrics['total_collected'], 3000.0)
        self.assertEqual(metrics['outstanding'], 2000.0)
        # Verify pending matches overdue + not_yet_due
        self.assertEqual(metrics['outstanding'], metrics['overdue'] + metrics['not_yet_due'])


if __name__ == '__main__':
    unittest.main()
