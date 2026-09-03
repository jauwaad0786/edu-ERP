"""
Automated Test Suite: Hostel Flexible Billing, Coverage Windows & Receipt Uniqueness Fix
Validates:
1. Fix for fee_records_receipt_no_key: Multiple fee records paid on same receipt without unique violation
2. Half-Yearly Billing Calculation: ₹8,000/mo * 6 = ₹48,000 covering 01 Sep 2026 to 28 Feb 2027
3. Overlapping Duplicate Prevention: October/November bills automatically skipped when covered by Sep-Feb
4. Partial Payment Handling: Parent pays ₹20,000 towards ₹48,000 (status PARTIAL, balance ₹28,000, coverage intact)
5. Settlement of Remaining Balance: Parent pays remaining ₹28,000 (status transitions to PAID)
6. Yearly Advance Billing: ₹8,000/mo * 12 = ₹96,000 covering 12 months (e.g. 01 Apr 2026 to 31 Mar 2027)
7. Mixed Frequency History: Switching from Half-Yearly to Monthly after coverage expires
"""

import unittest
from datetime import date, datetime
from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    HostelFeeStructure, HostelBedAllocation
)
from app.models.fee_finance import FeeBill, FeeBillItem, StudentLedger, FeePayment
from app.models.financial import FeeRecord, FeeTransaction
from app.services.hostel_fee_service import (
    generate_hostel_fee_record, record_hostel_fee_payment, compute_coverage_period
)
from app.services.fee_ledger_service import collect_fee_payment


class TestHostelFlexibleBilling(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # 1. School
        self.school = School(name="Flexible Billing Academy", code="FBA01")
        db.session.add(self.school)
        db.session.flush()

        # 2. Users (Admin & Golu)
        self.admin = User(school_id=self.school.id, name="Principal Sharma", email="sharma@fba.edu", password="password123", role="PRINCIPAL")
        self.golu_user = User(school_id=self.school.id, name="Golu Kumar", email="golu@fba.edu", password="password123", role="STUDENT")
        db.session.add_all([self.admin, self.golu_user])
        db.session.flush()

        # 3. Class & Student Golu
        self.cls = Class(school_id=self.school.id, name="Class 8", section="A")
        db.session.add(self.cls)
        db.session.flush()

        self.golu = Student(
            school_id=self.school.id,
            user_id=self.golu_user.id,
            admission_no="ADM-GOLU-001",
            class_id=self.cls.id,
            session="2026-27"
        )
        db.session.add(self.golu)
        db.session.flush()

        # 4. Hostel, Building, Room, Bed
        self.hostel = Hostel(school_id=self.school.id, name="Tagore Hall", hostel_type="BOYS", gender="BOYS")
        db.session.add(self.hostel)
        db.session.flush()

        self.bldg = HostelBuilding(school_id=self.school.id, hostel_id=self.hostel.id, name="Block A")
        db.session.add(self.bldg)
        db.session.flush()

        self.floor = HostelFloor(school_id=self.school.id, building_id=self.bldg.id, floor_number=1, name="First Floor")
        db.session.add(self.floor)
        db.session.flush()

        self.room = HostelRoom(
            school_id=self.school.id, floor_id=self.floor.id,
            room_number="101", room_type="DOUBLE", is_ac=False
        )
        db.session.add(self.room)
        db.session.flush()

        self.bed = HostelBed(school_id=self.school.id, room_id=self.room.id, bed_number="101-A", status="OCCUPIED")
        db.session.add(self.bed)
        db.session.flush()

        # 5. Fee Structure: ₹8,000/month, with half-yearly and yearly options
        self.fs = HostelFeeStructure(
            school_id=self.school.id,
            hostel_id=self.hostel.id,
            sharing_type="DOUBLE",
            is_ac=False,
            monthly_fee=8000.0,
            quarterly_fee=24000.0,
            half_yearly_fee=48000.0,
            yearly_fee=96000.0,
            status="ACTIVE"
        )
        db.session.add(self.fs)
        db.session.flush()

        # 6. Allocation for Golu
        self.alloc = HostelBedAllocation(
            school_id=self.school.id,
            hostel_id=self.hostel.id,
            building_id=self.bldg.id,
            floor_id=self.floor.id,
            room_id=self.room.id,
            bed_id=self.bed.id,
            student_id=self.golu.id,
            admission_date=date(2026, 9, 1),
            status="ACTIVE",
            billing_frequency="HALF_YEARLY",
            allocated_by=self.admin.id
        )
        db.session.add(self.alloc)
        db.session.commit()

        from app.services.fee_ledger_service import ensure_default_fee_heads
        ensure_default_fee_heads(self.school.id)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_compute_coverage_period_math(self):
        """Validates date math for Monthly, Quarterly, Half-Yearly, and Yearly periods."""
        # Monthly
        s, e, lbl = compute_coverage_period('2026-09', 'MONTHLY')
        self.assertEqual(s, date(2026, 9, 1))
        self.assertEqual(e, date(2026, 9, 30))
        self.assertEqual(lbl, "September 2026")

        # Quarterly (3 months: Sep, Oct, Nov)
        s, e, lbl = compute_coverage_period('2026-09', 'QUARTERLY')
        self.assertEqual(s, date(2026, 9, 1))
        self.assertEqual(e, date(2026, 11, 30))
        self.assertEqual(lbl, "Sep 2026 – Nov 2026")

        # Half-Yearly (6 months: Sep 2026 to Feb 2027)
        s, e, lbl = compute_coverage_period('2026-09', 'HALF_YEARLY')
        self.assertEqual(s, date(2026, 9, 1))
        self.assertEqual(e, date(2027, 2, 28))
        self.assertEqual(lbl, "Sep 2026 – Feb 2027")

        # Yearly (12 months: Apr 2026 to Mar 2027)
        s, e, lbl = compute_coverage_period('2026-04', 'YEARLY')
        self.assertEqual(s, date(2026, 4, 1))
        self.assertEqual(e, date(2027, 3, 31))
        self.assertEqual(lbl, "Apr 2026 – Mar 2027")

    def test_02_half_yearly_billing_generation_and_central_sync(self):
        """Generates Half-Yearly hostel bill for Golu (₹48,000 for Sep 2026 - Feb 2027) and verifies sync."""
        rec, reason = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-09', frequency='HALF_YEARLY'
        )
        self.assertEqual(reason, 'created')
        self.assertIsNotNone(rec)
        self.assertEqual(rec.amount_due, 48000.0)
        self.assertEqual(rec.billing_frequency, 'HALF_YEARLY')
        self.assertEqual(rec.period_start, date(2026, 9, 1))
        self.assertEqual(rec.period_end, date(2027, 2, 28))
        self.assertEqual(rec.coverage_label, "Sep 2026 – Feb 2027")

        db.session.commit()

        # Check Central FeeBillItem sync
        bill = FeeBill.query.filter_by(student_id=self.golu.id, bill_month='2026-09').first()
        self.assertIsNotNone(bill)
        self.assertEqual(bill.total_payable, 48000.0)

        item = FeeBillItem.query.filter_by(bill_id=bill.id, department='HOSTEL').first()
        self.assertIsNotNone(item)
        self.assertEqual(item.net_amount, 48000.0)
        self.assertEqual(item.billing_frequency, 'HALF_YEARLY')
        self.assertEqual(item.coverage_label, "Sep 2026 – Feb 2027")

        # Check Student Financial Ledger
        ledger = StudentLedger.query.filter_by(student_id=self.golu.id, department='HOSTEL').first()
        self.assertIsNotNone(ledger)
        self.assertEqual(ledger.amount, 48000.0)
        self.assertEqual(ledger.entry_type, 'DEBIT')
        self.assertEqual(ledger.period_label, "Sep 2026 – Feb 2027")

    def test_03_duplicate_prevention_for_covered_months(self):
        """Verifies that October and November bills are NOT generated because Sep-Feb is already covered."""
        # 1. Generate Half-Yearly (Sep 2026 - Feb 2027)
        rec, reason = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-09', frequency='HALF_YEARLY'
        )
        db.session.commit()
        self.assertEqual(reason, 'created')

        # 2. Attempt to generate October 2026 bill
        rec_oct, reason_oct = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-10', frequency='MONTHLY'
        )
        self.assertEqual(reason_oct, 'already_covered')
        self.assertEqual(rec_oct.id, rec.id)

        # 3. Attempt to generate November 2026 bill
        rec_nov, reason_nov = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-11', frequency='MONTHLY'
        )
        self.assertEqual(reason_nov, 'already_covered')

        # 4. Attempt to generate January 2027 bill
        rec_jan, reason_jan = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2027-01', frequency='MONTHLY'
        )
        self.assertEqual(reason_jan, 'already_covered')

        # Total fee records must still be exactly 1
        total_recs = FeeRecord.query.filter_by(student_id=self.golu.id, source='HOSTEL').count()
        self.assertEqual(total_recs, 1)

    def test_04_partial_payment_and_coverage_preservation(self):
        """Parent pays ₹20,000 towards ₹48,000. Status becomes PARTIAL, ₹28,000 remaining, coverage intact."""
        rec, _ = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-09', frequency='HALF_YEARLY'
        )
        db.session.commit()

        # Pay ₹20,000
        updated_rec, txn = record_hostel_fee_payment(
            record=rec,
            amount=20000.0,
            payment_mode='CASH',
            remarks='First installment for Half-Yearly hostel',
            collected_by_user=self.admin
        )
        db.session.commit()

        self.assertEqual(updated_rec.status, 'PARTIAL')
        self.assertEqual(updated_rec.amount_paid, 20000.0)
        self.assertEqual(round(updated_rec.effective_due() - updated_rec.amount_paid, 2), 28000.0)
        self.assertEqual(updated_rec.period_start, date(2026, 9, 1))
        self.assertEqual(updated_rec.period_end, date(2027, 2, 28))
        self.assertEqual(updated_rec.coverage_label, "Sep 2026 – Feb 2027")

        # Now pay remaining ₹28,000
        final_rec, txn2 = record_hostel_fee_payment(
            record=updated_rec,
            amount=28000.0,
            payment_mode='UPI',
            remarks='Remaining balance settled',
            collected_by_user=self.admin
        )
        db.session.commit()

        self.assertEqual(final_rec.status, 'PAID')
        self.assertEqual(final_rec.amount_paid, 48000.0)
        self.assertEqual(round(final_rec.effective_due() - final_rec.amount_paid, 2), 0.0)

    def test_05_multi_fee_record_receipt_uniqueness(self):
        """
        Validates fix for PostgreSQL unique constraint on receipt_no:
        Multiple FeeRecord rows (e.g. October Hostel + Tuition) updated under one receipt
        must NOT trigger UniqueViolation!
        """
        # Create Record 1 (Tuition)
        rec1 = FeeRecord(
            school_id=self.school.id,
            student_id=self.golu.id,
            fee_type='TUITION',
            amount_due=5000.0,
            amount_paid=0.0,
            status='PENDING',
            month='2026-10',
            session='2026-27'
        )
        # Create Record 2 (Hostel)
        rec2 = FeeRecord(
            school_id=self.school.id,
            student_id=self.golu.id,
            fee_type='HOSTEL',
            amount_due=8000.0,
            amount_paid=0.0,
            status='PENDING',
            month='2026-10',
            session='2026-27',
            source='HOSTEL',
            source_ref_id=self.alloc.id
        )
        db.session.add_all([rec1, rec2])
        db.session.commit()

        # Both records share the SAME receipt number
        shared_receipt = "REC-2026-000002"
        rec1.receipt_no = shared_receipt
        rec1.status = 'PAID'
        rec1.amount_paid = 5000.0
        rec1.paid_date = date.today()

        rec2.receipt_no = shared_receipt
        rec2.status = 'PAID'
        rec2.amount_paid = 8000.0
        rec2.paid_date = date.today()

        # This commit MUST succeed without UniqueViolation
        try:
            db.session.commit()
            success = True
        except Exception as e:
            db.session.rollback()
            success = False
            self.fail(f"UniqueViolation occurred when multiple fee records share receipt: {e}")

        self.assertTrue(success)
        self.assertEqual(rec1.receipt_no, shared_receipt)
        self.assertEqual(rec2.receipt_no, shared_receipt)

    def test_06_yearly_billing_and_post_coverage_transition(self):
        """Student pays 1 Year in advance; verifies full 12 month coverage and transition to monthly after."""
        rec_yr, reason_yr = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2026-04', frequency='YEARLY'
        )
        db.session.commit()
        self.assertEqual(reason_yr, 'created')
        self.assertEqual(rec_yr.amount_due, 96000.0)
        self.assertEqual(rec_yr.period_start, date(2026, 4, 1))
        self.assertEqual(rec_yr.period_end, date(2027, 3, 31))

        # Trying to bill any month within Apr 2026 - Mar 2027 is covered
        _, r_dec = generate_hostel_fee_record(self.alloc, self.admin.id, month='2026-12', frequency='MONTHLY')
        self.assertEqual(r_dec, 'already_covered')

        _, r_feb = generate_hostel_fee_record(self.alloc, self.admin.id, month='2027-02', frequency='MONTHLY')
        self.assertEqual(r_feb, 'already_covered')

        # April 2027 (outside the 1-year coverage window) can be billed
        rec_next_yr, r_next_yr = generate_hostel_fee_record(
            self.alloc, self.admin.id, month='2027-04', frequency='MONTHLY'
        )
        self.assertEqual(r_next_yr, 'created')
        self.assertEqual(rec_next_yr.amount_due, 8000.0)
        self.assertEqual(rec_next_yr.billing_frequency, 'MONTHLY')


if __name__ == '__main__':
    unittest.main()
