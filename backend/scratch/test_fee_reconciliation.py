"""
Comprehensive Fee & Finance Reconciliation Test Suite
Validates:
1. Multi-service fee generation (Tuition, Transport, Hostel, Library)
2. Domain-specific idempotency (duplicate prevention)
3. Partial & full payment ledger updates
4. Discount and fine net due calculations
5. Strict session isolation (2026-27 vs 2027-28)
6. Multi-tenant school isolation (School A vs School B)
7. Exact reconciliation: Dashboard Total == Sum(Detail Records)
8. Exact User Test Scenario (Tuition 10k, Transport 2k, Hostel 5k, Library 500 = 17,500 due; 8,500 paid; 9,000 balance)
"""

import os
import sys
from datetime import date, datetime

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\admin\edu-ERP\backend")

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Class
from app.models.financial import FeeRecord, FeeTransaction, FeeStructure
from app.models.fee_finance import FeeHead, FeeBill, FeeBillItem, StudentLedger, FeePayment
from app.services.fee_central_service import FeeCentralService
from app.services.finance_aggregation_service import FinanceAggregationService


def run_tests():
    app = create_app('development')
    with app.app_context():
        db.create_all()
        print("\n" + "="*70)
        print("STARTING COMPLETE FEES + FINANCE RECONCILIATION AUDIT TEST SUITE")
        print("="*70)

        # ── Setup Test School & Students ──────────────────────────────────
        school = School.query.filter_by(code='TEST_FIN_SCH').first()
        if not school:
            school = School(name='Test Finance Academy', code='TEST_FIN_SCH')
            db.session.add(school)
            db.session.flush()

        school_b = School.query.filter_by(code='TEST_SCH_B').first()
        if not school_b:
            school_b = School(name='School B Isolated', code='TEST_SCH_B')
            db.session.add(school_b)
            db.session.flush()

        # Clean existing test data for test school
        FeeTransaction.query.filter_by(school_id=school.id).delete()
        FeeRecord.query.filter_by(school_id=school.id).delete()
        StudentLedger.query.filter_by(school_id=school.id).delete()
        FeeBillItem.query.filter(FeeBillItem.bill_id.in_(
            [b.id for b in FeeBill.query.filter_by(school_id=school.id).all()]
        )).delete(synchronize_session=False)
        FeeBill.query.filter_by(school_id=school.id).delete()
        FeePayment.query.filter_by(school_id=school.id).delete()
        db.session.commit()

        # Create or fetch Class and Student
        cls = Class.query.filter_by(school_id=school.id, name='Class 10').first()
        if not cls:
            cls = Class(school_id=school.id, name='Class 10', section='A')
            db.session.add(cls)
            db.session.flush()

        user = User.query.filter_by(email='student_fin_test@school.com').first()
        if not user:
            user = User(school_id=school.id, name='Aryan Sharma', email='student_fin_test@school.com', role=UserRole.STUDENT, password='Password@123')
            db.session.add(user)
            db.session.flush()

        student = Student.query.filter_by(user_id=user.id).first()
        if not student:
            student = Student(school_id=school.id, user_id=user.id, class_id=cls.id, admission_no='ADM-FIN-001', status='ACTIVE')
            db.session.add(student)
            db.session.flush()
        db.session.commit()

        # ──────────────────────────────────────────────────────────────────
        # TEST 1: Service-based Fee Generation (Tuition, Transport, Hostel, Library)
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 1: Service-Based Fee Generation ---")
        tuition_rec, created1 = FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Tuition Fee',
            amount_due=10000.0, month='2026-09', session='2026-27', source='ACADEMIC'
        )
        assert created1 is True
        assert tuition_rec.amount_due == 10000.0

        trans_rec, created2 = FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Transport Fee',
            amount_due=2000.0, month='2026-09', session='2026-27', source='TRANSPORT'
        )
        assert created2 is True
        assert trans_rec.amount_due == 2000.0

        hostel_rec, created3 = FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Hostel Fee',
            amount_due=5000.0, month='2026-09', session='2026-27', source='HOSTEL'
        )
        assert created3 is True
        assert hostel_rec.amount_due == 5000.0

        lib_rec, created4 = FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Library Fine',
            amount_due=500.0, month='2026-09', session='2026-27', source='LIBRARY'
        )
        assert created4 is True
        assert lib_rec.amount_due == 500.0
        print("[OK] All 4 service fees successfully generated (Total Rs. 17,500).")

        # ──────────────────────────────────────────────────────────────────
        # TEST 2: Idempotency / Duplicate Prevention
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 2: Idempotency (Duplicate Prevention) ---")
        dup_rec, was_created = FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Tuition Fee',
            amount_due=10000.0, month='2026-09', session='2026-27', source='ACADEMIC'
        )
        assert was_created is False
        assert dup_rec.id == tuition_rec.id
        print("[OK] Re-running fee generation safely returned existing record without duplicating.")

        # ──────────────────────────────────────────────────────────────────
        # TEST 3: Verification of Central Ledger & Dashboard Totals
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 3: Initial Dashboard Reconciliation ---")
        summary = FinanceAggregationService.get_fee_summary(school.id, session='2026-27')
        assert summary['total_due'] == 17500.0, f"Expected 17500, got {summary['total_due']}"
        assert summary['total_paid'] == 0.0
        assert summary['outstanding'] == 17500.0
        assert summary['pending_count'] == 4
        print(f"[OK] Summary verified: Due Rs. {summary['total_due']:,.2f}, Outstanding Rs. {summary['outstanding']:,.2f}")

        # ──────────────────────────────────────────────────────────────────
        # TEST 4: Partial and Full Payment Processing (User Scenario)
        # Payments: Tuition Rs. 5,000 (partial), Transport Rs. 2,000 (full),
        # Hostel Rs. 1,000 (partial), Library Rs. 500 (full) -> Total Paid = Rs. 8,500
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 4: Payment Collections ---")
        r1, p1 = FeeCentralService.collect_payment(
            school_id=school.id, record_id=tuition_rec.id, amount_paid=5000.0, payment_mode='UPI'
        )
        assert r1.status == 'PARTIAL'
        assert r1.amount_paid == 5000.0

        r2, p2 = FeeCentralService.collect_payment(
            school_id=school.id, record_id=trans_rec.id, amount_paid=2000.0, payment_mode='ONLINE'
        )
        assert r2.status == 'PAID'
        assert r2.amount_paid == 2000.0

        r3, p3 = FeeCentralService.collect_payment(
            school_id=school.id, record_id=hostel_rec.id, amount_paid=1000.0, payment_mode='CASH'
        )
        assert r3.status == 'PARTIAL'
        assert r3.amount_paid == 1000.0

        r4, p4 = FeeCentralService.collect_payment(
            school_id=school.id, record_id=lib_rec.id, amount_paid=500.0, payment_mode='CASH'
        )
        assert r4.status == 'PAID'
        assert r4.amount_paid == 500.0

        # Verify summary after payments
        summary_after_pay = FinanceAggregationService.get_fee_summary(school.id, session='2026-27')
        assert summary_after_pay['total_due'] == 17500.0
        assert summary_after_pay['total_paid'] == 8500.0
        assert summary_after_pay['outstanding'] == 9000.0
        assert summary_after_pay['paid_count'] == 2
        assert summary_after_pay['partial_count'] == 2
        print(f"[OK] Post-Payment Verified: Due Rs. {summary_after_pay['total_due']:,.2f}, Paid Rs. {summary_after_pay['total_paid']:,.2f}, Outstanding Rs. {summary_after_pay['outstanding']:,.2f}")

        # ──────────────────────────────────────────────────────────────────
        # TEST 5: Apply Discount & Fine
        # Discount = Rs. 500 on Tuition, Fine = Rs. 200 on Hostel
        # Net Due = 17,500 - 500 + 200 = 17,200
        # Outstanding = 17,200 - 8,500 = 8,700
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 5: Discount & Fine Calculations ---")
        tuition_rec.discount = 500.0
        hostel_rec.fine = 200.0
        db.session.commit()

        summary_adj = FinanceAggregationService.get_fee_summary(school.id, session='2026-27')
        assert summary_adj['total_discount'] == 500.0
        assert summary_adj['total_fine'] == 200.0
        assert summary_adj['total_due'] == 17200.0
        assert summary_adj['total_paid'] == 8500.0
        assert summary_adj['outstanding'] == 8700.0
        print(f"[OK] Adjusted Summary Verified: Net Due Rs. {summary_adj['total_due']:,.2f}, Outstanding Rs. {summary_adj['outstanding']:,.2f}")

        # ──────────────────────────────────────────────────────────────────
        # TEST 6: Strict Session Isolation
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 6: Session Isolation ---")
        FeeCentralService.generate_fee(
            school_id=school.id, student_id=student.id, fee_type='Tuition Fee',
            amount_due=12000.0, month='2027-04', session='2027-28', source='ACADEMIC'
        )
        # Session 2026-27 should remain completely untouched
        summary_2026 = FinanceAggregationService.get_fee_summary(school.id, session='2026-27')
        assert summary_2026['total_due'] == 17200.0
        assert summary_2026['outstanding'] == 8700.0

        summary_2027 = FinanceAggregationService.get_fee_summary(school.id, session='2027-28')
        assert summary_2027['total_due'] == 12000.0
        assert summary_2027['outstanding'] == 12000.0
        print("[OK] Session isolation passed: 2026-27 and 2027-28 are completely separated.")

        # ──────────────────────────────────────────────────────────────────
        # TEST 7: Multi-Tenant School Isolation
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 7: Multi-Tenant School Isolation ---")
        summary_b = FinanceAggregationService.get_fee_summary(school_b.id, session='2026-27')
        assert summary_b['total_due'] == 0.0
        assert summary_b['total_paid'] == 0.0
        print("[OK] School B cannot view or aggregate School A's financial records.")

        # ──────────────────────────────────────────────────────────────────
        # TEST 8: Full Data Integrity & Anomaly Audit
        # ──────────────────────────────────────────────────────────────────
        print("\n--- TEST 8: Data Reconciliation Audit ---")
        audit_res = FinanceAggregationService.audit_reconciliation(school.id, session='2026-27')
        assert audit_res['anomalies_count'] == 0
        assert audit_res['is_fully_reconciled'] is True
        print(f"[OK] Reconciliation Audit Passed: {audit_res['total_fee_records']} records checked, 0 anomalies.")

        print("\n" + "="*70)
        print("ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY! 100% RECONCILED.")
        print("="*70)


if __name__ == '__main__':
    run_tests()
