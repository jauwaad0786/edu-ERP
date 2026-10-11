"""
Automated Test Suite for Fees & Finance Management — Web vs Mobile Parity
Covers all 20 core requirements specified in Section 11:
1. Pay one month.
2. Pay three months.
3. Pay six months.
4. Pay twelve months (annual).
5. Select custom months.
6. Attempt to pay an already-paid month (fails with validation error).
7. Pay a partially outstanding fee.
8. Pay multiple fee heads together.
9. Generate a demand bill without making payment (labeled DEMAND BILL / PAYMENT REQUEST).
10. Send a demand bill before the due date (delivery logging).
11. Generate an overdue notice.
12. Make a successful payment and generate a receipt.
13. Verify a failed payment does not mark fees as paid.
14. Verify duplicate submission does not create duplicate transactions (idempotency protection).
15. Reopen and download a historical receipt PDF.
16. Print and share a PDF with token query string or header authentication.
17. Verify Web and Mobile show consistent fee and finance totals (reconciliation).
18. Verify unauthorized roles and cross-school access are rejected.
19. Verify that session filters and date filters work correctly.
20. Verify repeated requests with idempotency key do not double-bill or corrupt balances.
"""

import unittest
from datetime import date, datetime, timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentFeeAssignment,
    FeeBill, FeeBillItem, StudentLedger, FeePayment,
    FeePaymentAllocation, BillStatus, PaymentStatus
)
from app.services.fee_central_service import FeeCentralService
from app.services.fee_ledger_service import ensure_default_fee_heads, get_finance_dashboard_metrics


class TestMultiMonthAndMobileParity(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # 1. Seed School 1
        self.school1 = School(
            name="Apex International Academy",
            code="AIA01",
            address="Knowledge Park, Greater Noida",
            phone="0120-4567890",
            email="accounts@apexacademy.edu.in"
        )
        db.session.add(self.school1)

        # 2. Seed School 2 (for cross-school tenant isolation tests)
        self.school2 = School(
            name="Beacon Valley School",
            code="BVS02",
            address="Civil Lines, Jaipur",
            phone="0141-2345678",
            email="admin@beaconvalley.edu.in"
        )
        db.session.add(self.school2)
        db.session.commit()

        # 3. Seed Users
        self.admin = User(
            name="Principal Verma",
            email="principal@apexacademy.edu.in",
            role="PRINCIPAL",
            school_id=self.school1.id
        )
        self.admin.set_password("Admin@123")
        db.session.add(self.admin)

        self.other_school_admin = User(
            name="Principal Sharma",
            email="principal@beaconvalley.edu.in",
            role="PRINCIPAL",
            school_id=self.school2.id
        )
        self.other_school_admin.set_password("Admin@123")
        db.session.add(self.other_school_admin)
        db.session.commit()

        # 4. Seed Classes
        self.cls1 = Class(name="Grade 9", section="A", school_id=self.school1.id)
        db.session.add(self.cls1)

        # 5. Seed Student
        self.student_user = User(
            name="Rohan Mehra",
            email="rohan.mehra@apexacademy.edu.in",
            role="STUDENT",
            school_id=self.school1.id
        )
        self.student_user.set_password("Student@123")
        db.session.add(self.student_user)
        db.session.commit()

        self.student = Student(
            user_id=self.student_user.id,
            school_id=self.school1.id,
            class_id=self.cls1.id,
            admission_no="STU-2026-001",
            father_name="Vikram Mehra",
            parent_phone="9811223344",
            session="2026-27"
        )
        db.session.add(self.student)
        db.session.commit()

        # 6. Seed Fee Heads & Structure (Tuition: 2000/mo, Exam: 500/mo)
        ensure_default_fee_heads(self.school1.id)
        self.head_tuition = FeeHead.query.filter_by(school_id=self.school1.id, name="Tuition Fee").first()
        self.head_exam = FeeHead.query.filter_by(school_id=self.school1.id, name="Examination Fee").first()

        self.structure = FeeStructureV2(
            school_id=self.school1.id,
            class_id=self.cls1.id,
            session="2026-27",
            name="Grade 9 Standard Fee Plan"
        )
        db.session.add(self.structure)
        db.session.commit()

        item_t = FeeStructureItemV2(
            structure_id=self.structure.id,
            fee_head_id=self.head_tuition.id,
            amount=2000.0
        )
        item_e = FeeStructureItemV2(
            structure_id=self.structure.id,
            fee_head_id=self.head_exam.id,
            amount=500.0
        )
        db.session.add_all([item_t, item_e])
        db.session.commit()

        # FeeStructureV2 is automatically linked to self.student via class_id=self.cls1.id
        self.structure.is_active = True
        db.session.commit()

        # Helper tokens
        self.token = create_access_token(identity=str(self.admin.id))
        self.other_token = create_access_token(identity=str(self.other_school_admin.id))
        self.headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}
        self.other_headers = {'Authorization': f'Bearer {self.other_token}', 'Content-Type': 'application/json'}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_pay_one_month(self):
        """1. Pay one month fee."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['total_paid'], 2500.0)
        self.assertIn('2026-04', data['months_covered'])

        # Verify bill status is PAID
        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()
        self.assertIsNotNone(bill)
        self.assertEqual(bill.status, BillStatus.PAID.value)
        self.assertEqual(bill.balance_due, 0.0)

    def test_02_pay_three_months(self):
        """2. Pay three months (Quarterly) in a single consolidated transaction."""
        months = ['2026-04', '2026-05', '2026-06']
        expected_total = 2500.0 * 3  # 7500.0
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': months, 'amount_paid': expected_total, 'payment_mode': 'BANK_TRANSFER'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['total_paid'], expected_total)
        self.assertEqual(len(data['months_covered']), 3)

        # Check all 3 months are marked PAID
        for m in months:
            b = FeeBill.query.filter_by(student_id=self.student.id, bill_month=m).first()
            self.assertIsNotNone(b)
            self.assertEqual(b.status, BillStatus.PAID.value)
            self.assertEqual(b.balance_due, 0.0)

    def test_03_pay_six_months(self):
        """3. Pay six months (Half-Yearly) together."""
        months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
        expected_total = 2500.0 * 6  # 15000.0
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': months, 'amount_paid': expected_total, 'payment_mode': 'CARD'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['total_paid'], expected_total)
        self.assertEqual(len(data['months_covered']), 6)

    def test_04_pay_twelve_months_annual(self):
        """4. Pay twelve months (Annual) in full."""
        sched_res = self.client.get(
            f'/api/fees-finance/students/{self.student.id}/multi-month-schedule',
            headers=self.headers
        )
        self.assertEqual(sched_res.status_code, 200)
        sched = sched_res.get_json()
        preset_12 = sched['presets']['12_months']
        months = preset_12['months']
        expected_total = preset_12['amount_payable']

        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': months, 'amount_paid': expected_total, 'payment_mode': 'CHEQUE', 'transaction_ref': 'CHQ-998811'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['total_paid'], expected_total)
        self.assertEqual(len(data['months_covered']), 12)

    def test_05_select_custom_months(self):
        """5. Select custom months (e.g., April, July, October)."""
        custom_months = ['2026-04', '2026-07', '2026-10']
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': custom_months, 'amount_paid': 7500.0, 'payment_mode': 'UPI'}
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['months_covered'], custom_months)

        # Check April, July, October are PAID, but May is still unpaid
        b_apr = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()
        b_may = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-05').first()
        self.assertEqual(b_apr.status, BillStatus.PAID.value)
        self.assertIsNone(b_may)  # Not billed or paid

    def test_06_attempt_to_pay_already_paid_month_fails(self):
        """6. Attempt to pay an already-paid month returns validation error."""
        # First pay April
        self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )

        # Attempt to pay April again
        res2 = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'CASH'}
        )
        self.assertEqual(res2.status_code, 400)
        data = res2.get_json()
        self.assertIn('already fully paid', data.get('error', '').lower())

    def test_07_pay_partially_outstanding_fee(self):
        """7. Pay a partially outstanding fee."""
        # Bill April: 2500. Pay 1500 first.
        res1 = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 1500.0, 'payment_mode': 'CASH'}
        )
        self.assertEqual(res1.status_code, 201)

        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()
        self.assertEqual(bill.status, BillStatus.PARTIALLY_PAID.value)
        self.assertEqual(bill.balance_due, 1000.0)

        # Now pay the remaining 1000
        res2 = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 1000.0, 'payment_mode': 'UPI'}
        )
        self.assertEqual(res2.status_code, 201)
        db.session.refresh(bill)
        self.assertEqual(bill.status, BillStatus.PAID.value)
        self.assertEqual(bill.balance_due, 0.0)

    def test_08_pay_multiple_fee_heads_together(self):
        """8. Pay multiple fee heads together and verify itemized allocations."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        payment_id = res.get_json()['payment_id']
        allocs = FeePaymentAllocation.query.filter_by(payment_id=payment_id).all()
        head_names = [a.fee_head.name for a in allocs]
        self.assertIn("Tuition Fee", head_names)
        self.assertIn("Examination Fee", head_names)
        self.assertEqual(sum(a.allocated_amount for a in allocs), 2500.0)

    def test_09_generate_demand_bill_without_making_payment(self):
        """9. Generate a demand bill without making payment (status ISSUED, balance due remains)."""
        future_due = (date.today() + timedelta(days=15)).strftime('%Y-%m-%d')
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/generate-demand-notice',
            headers=self.headers,
            json={'months': ['2026-04', '2026-05'], 'due_date': future_due}
        )
        self.assertEqual(res.status_code, 200)

        # Verify bills are created with status ISSUED, NOT PAID
        bills = FeeBill.query.filter_by(student_id=self.student.id).all()
        self.assertEqual(len(bills), 2)
        for b in bills:
            self.assertEqual(b.status, BillStatus.ISSUED.value)
            self.assertEqual(b.amount_paid, 0.0)
            self.assertEqual(b.balance_due, 2500.0)

    def test_10_send_demand_bill_before_due_date(self):
        """10. Send a demand bill before due date and track delivery status."""
        self.client.post(
            f'/api/fees-finance/students/{self.student.id}/generate-demand-notice',
            headers=self.headers,
            json={'months': ['2026-04'], 'due_date': '2026-04-20'}
        )
        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()

        # Send delivery notification
        res = self.client.post(
            f'/api/fees-finance/bills/{bill.id}/send',
            headers=self.headers,
            json={'delivery_channel': 'IN_APP_AND_SMS'}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['delivery_status'], 'DELIVERED')

    def test_11_generate_overdue_notice(self):
        """11. Verify overdue notice status when due date is in the past."""
        past_due = (date.today() - timedelta(days=5)).isoformat()
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/generate-demand-notice',
            headers=self.headers,
            json={'months': ['2026-04'], 'due_date': past_due}
        )
        self.assertEqual(res.status_code, 200)
        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()
        # Bill with past due date and positive balance
        self.assertTrue(bill.is_overdue)

    def test_12_successful_payment_receipt_generation(self):
        """12. Make successful payment and verify receipt format & number."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        data = res.get_json()
        receipt_no = data['receipt_no']
        self.assertTrue(receipt_no.startswith('REC-'))
        payment = FeePayment.query.get(data['payment_id'])
        self.assertEqual(payment.receipt_no, receipt_no)
        self.assertEqual(payment.status, PaymentStatus.VALID.value)

    def test_13_failed_payment_does_not_mark_fees_paid(self):
        """13. Verify failed payment (e.g. invalid amount <= 0) does not mark fees as paid."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': -500.0, 'payment_mode': 'UPI'}
        )
        self.assertEqual(res.status_code, 400)
        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()
        self.assertIsNone(bill)

    def test_14_idempotency_prevents_duplicate_payments(self):
        """14. Repeated submission with same idempotency_key returns identical transaction without double billing."""
        key = "idemp_test_unique_key_001"
        payload = {
            'months': ['2026-04'],
            'amount_paid': 2500.0,
            'payment_mode': 'UPI',
            'idempotency_key': key
        }

        # First request
        res1 = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json=payload
        )
        self.assertEqual(res1.status_code, 201)
        data1 = res1.get_json()

        # Second request with identical idempotency key
        res2 = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json=payload
        )
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()
        self.assertTrue(data2.get('is_duplicate'))
        self.assertEqual(data1['payment_id'], data2['payment_id'])
        self.assertEqual(data1['receipt_no'], data2['receipt_no'])

        # Total payments in database must be exactly 1
        count = FeePayment.query.filter_by(student_id=self.student.id).count()
        self.assertEqual(count, 1)

    def test_15_reopen_and_download_historical_receipt_pdf(self):
        """15. Reopen and download historical receipt PDF."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        payment_id = res.get_json()['payment_id']

        pdf_res = self.client.get(
            f'/api/fees-finance/payments/{payment_id}/receipt-pdf',
            headers=self.headers
        )
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.content_type, 'application/pdf')
        self.assertTrue(pdf_res.data.startswith(b'%PDF'))

    def test_16_mobile_pdf_token_query_string(self):
        """16. Verify PDF download succeeds using ?token=<jwt> for Mobile file viewers."""
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        payment_id = res.get_json()['payment_id']

        # Call without Authorization header, passing token in query string
        pdf_res = self.client.get(f'/api/fees-finance/payments/{payment_id}/receipt-pdf?token={self.token}')
        self.assertEqual(pdf_res.status_code, 200)
        self.assertEqual(pdf_res.content_type, 'application/pdf')
        self.assertTrue(pdf_res.data.startswith(b'%PDF'))

    def test_17_reconciliation_web_vs_mobile_metrics(self):
        """17. Verify fee collection and dashboard metrics reconcile accurately."""
        # Collect 2 months: 5000.0
        res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04', '2026-05'], 'amount_paid': 5000.0, 'payment_mode': 'UPI', 'session': '2026-27'}
        )
        self.assertEqual(res.status_code, 201)

        metrics = get_finance_dashboard_metrics(self.school1.id, session='2026-27')
        self.assertEqual(metrics['total_collected'], 5000.0)

        dash_res = self.client.get('/api/fees-finance/dashboard?session=2026-27', headers=self.headers)
        self.assertEqual(dash_res.status_code, 200)
        dash = dash_res.get_json()
        self.assertEqual(dash['total_collected'], 5000.0)

    def test_18_tenant_isolation_cross_school_rejected(self):
        """18. Verify cross-school access is strictly rejected with 403/404."""
        # User from school 2 attempts to access student from school 1
        res = self.client.get(
            f'/api/fees-finance/students/{self.student.id}/multi-month-schedule',
            headers=self.other_headers
        )
        self.assertIn(res.status_code, [403, 404])

        # User from school 2 attempts to pay student from school 1
        pay_res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.other_headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'CASH'}
        )
        self.assertIn(pay_res.status_code, [403, 404])

    def test_19_session_and_date_filtering(self):
        """19. Verify academic session filtering correctly isolates records."""
        # Pay 2026-27 session
        self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI', 'session': '2026-27'}
        )

        # Query 2027-28 session
        sched_2728 = self.client.get(
            f'/api/fees-finance/students/{self.student.id}/multi-month-schedule?session=2027-28',
            headers=self.headers
        ).get_json()
        # 2027-28 should have no paid records
        for m in sched_2728['months']:
            self.assertFalse(m['is_paid'])

    def test_20_financial_documents_suite(self):
        """20. Test complete financial PDF document suite (Receipt, Bill, Ledger, Outstanding, Collection Report)."""
        # Make a payment first
        pay_res = self.client.post(
            f'/api/fees-finance/students/{self.student.id}/pay-multi-month',
            headers=self.headers,
            json={'months': ['2026-04'], 'amount_paid': 2500.0, 'payment_mode': 'UPI'}
        )
        payment_id = pay_res.get_json()['payment_id']
        bill = FeeBill.query.filter_by(student_id=self.student.id, bill_month='2026-04').first()

        # 1. Receipt PDF
        r1 = self.client.get(f'/api/fees-finance/payments/{payment_id}/receipt-pdf', headers=self.headers)
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.content_type, 'application/pdf')

        # 2. Bill PDF
        r2 = self.client.get(f'/api/fees-finance/bills/{bill.id}/pdf', headers=self.headers)
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.content_type, 'application/pdf')

        # 3. Student Ledger Statement PDF
        r3 = self.client.get(f'/api/fees-finance/students/{self.student.id}/ledger/pdf', headers=self.headers)
        self.assertEqual(r3.status_code, 200)
        self.assertEqual(r3.content_type, 'application/pdf')

        # 4. Outstanding Defaulters PDF
        r4 = self.client.get('/api/fees-finance/outstanding/pdf', headers=self.headers)
        self.assertEqual(r4.status_code, 200)
        self.assertEqual(r4.content_type, 'application/pdf')

        # 5. Collection Summary Report PDF
        r5 = self.client.get('/api/fees-finance/reports/collection-report/pdf?session=2026-27', headers=self.headers)
        self.assertEqual(r5.status_code, 200)
        self.assertEqual(r5.content_type, 'application/pdf')


if __name__ == '__main__':
    unittest.main()
