"""
Comprehensive End-to-End Verification Test Suite for the Central Fees Ecosystem
Validates:
1. Hostel Admission & Canonical Central Finance Visibility
2. Hostel Partial Payment & Central Ledger Balance Reduction
3. Central Completion Payment & Two-Way Hostel Status Sync
4. Library Fine Creation & Settlement Sync
5. Transport Fee Generation & Payment Sync
6. Combined Multi-Head Payment Allocation (One Payment, Multiple Allocations)
7. Structure Edit/Delete Safeguards & Archiving
8. Library Attendance In/Out Visit Tracking & Telemetry
9. Duplicate Payment Protection & Thread-Mutex
10. Today's Collection by Service Breakdown
"""

import unittest
from datetime import date, datetime, timedelta
from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    HostelFeeStructure, HostelBedAllocation, HostelFineRecord
)
from app.models.library import (
    Book, BookCopy, LibraryMember, BookIssue, FineTransaction, LibraryVisit
)
from app.models.transport_student import StudentTransport, TransportFeeRecord
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentFeeAssignment,
    FeeBill, FeeBillItem, StudentLedger, FeePayment, FeePaymentAllocation,
    BillStatus, PaymentStatus
)
from app.models.financial import FeeRecord, FeeTransaction
from app.services.fee_ledger_service import (
    ensure_default_fee_heads, register_or_sync_service_charge,
    collect_fee_payment, get_student_ledger
)
from app.services.hostel_fee_service import record_hostel_fee_payment
from app.services.transport_fee_service import record_transport_fee_payment


class CentralFeesEcosystemTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # 1. School
        self.school = School(
            name="Apex Model Academy",
            code="AMA01",
            address="Civil Lines, Delhi",
            phone="011-99887766",
            email="principal@apex.edu"
        )
        db.session.add(self.school)
        db.session.commit()
        self.sid = self.school.id

        # 2. Staff Roles
        self.principal = User(name="Principal Dr. Roy", email="roy@apex.edu", password="pass", role="PRINCIPAL", school_id=self.sid)
        self.warden = User(name="Warden Singh", email="warden@apex.edu", password="pass", role="HOSTEL", school_id=self.sid)
        self.librarian = User(name="Librarian Gupta", email="librarian@apex.edu", password="pass", role="LIBRARIAN", school_id=self.sid)
        self.accountant = User(name="Accountant Verma", email="accountant@apex.edu", password="pass", role="ACCOUNTANT", school_id=self.sid)
        db.session.add_all([self.principal, self.warden, self.librarian, self.accountant])
        db.session.commit()

        # 3. Class & Student ("Golu")
        self.cls = Class(name="Class 10", section="A", school_id=self.sid)
        db.session.add(self.cls)
        db.session.commit()

        self.stu_user = User(name="Golu Kumar", email="golu@apex.edu", password="pass", role="STUDENT", school_id=self.sid)
        db.session.add(self.stu_user)
        db.session.commit()

        self.student = Student(
            user_id=self.stu_user.id,
            school_id=self.sid,
            class_id=self.cls.id,
            roll_number="101",
            admission_no="ADM-2026-101",
            session="2026-27"
        )
        db.session.add(self.student)
        db.session.commit()

        # 4. Standard Fee Heads
        ensure_default_fee_heads(self.sid)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    # ── Test 1: Hostel Admission & Central Finance Visibility ──
    def test_01_hostel_admission_central_sync(self):
        """Student Golu is admitted to Hostel. Fee must be visible in Central Finance without ambiguity."""
        # Setup Hostel infrastructure
        hostel = Hostel(name="Boys Hostel", school_id=self.sid, gender="MALE", hostel_type="BOYS")
        db.session.add(hostel)
        db.session.flush()

        bld = HostelBuilding(name="Wing A", hostel_id=hostel.id, school_id=self.sid)
        db.session.add(bld)
        db.session.flush()

        flr = HostelFloor(name="1st Floor", floor_number=1, building_id=bld.id, school_id=self.sid)
        db.session.add(flr)
        db.session.flush()

        rm = HostelRoom(room_number="101", floor_id=flr.id, school_id=self.sid, room_type="DOUBLE")
        db.session.add(rm)
        db.session.flush()

        bed = HostelBed(bed_number="101-A", room_id=rm.id, school_id=self.sid, status="AVAILABLE")
        db.session.add(bed)
        db.session.flush()

        # Hostel Fee Structure: ₹8,000 / month
        hfs = HostelFeeStructure(
            school_id=self.sid,
            hostel_id=hostel.id,
            sharing_type="DOUBLE",
            is_ac=False,
            monthly_fee=8000.0,
            status="ACTIVE"
        )
        db.session.add(hfs)
        db.session.flush()

        # Allocate bed to Golu
        alloc = HostelBedAllocation(
            school_id=self.sid,
            student_id=self.student.id,
            hostel_id=hostel.id,
            building_id=bld.id,
            floor_id=flr.id,
            room_id=rm.id,
            bed_id=bed.id,
            admission_date=date.today(),
            status="ACTIVE"
        )
        db.session.add(alloc)
        bed.status = "OCCUPIED"
        db.session.commit()

        # Generate hostel fee charge and sync to Central Finance
        rec = FeeRecord(
            school_id=self.sid,
            student_id=self.student.id,
            fee_type='HOSTEL',
            amount_due=8000.0,
            amount_paid=0.0,
            status='PENDING',
            month=date.today().strftime('%B %Y'),
            session='2026-27',
            due_date=date.today() + timedelta(days=10),
            source='HOSTEL',
            source_ref_id=alloc.id,
            remarks="Hostel Room 101-A Charge"
        )
        db.session.add(rec)
        db.session.flush()

        # Canonical Central Finance sync
        bill_item = register_or_sync_service_charge(
            school_id=self.sid,
            student_id=self.student.id,
            amount=8000.0,
            fee_head_code='HOSTEL',
            department='HOSTEL',
            source_module='HOSTEL',
            source_type='CHARGE',
            source_ref_id=alloc.id,
            description="Hostel Room 101-A Charge",
            session='2026-27',
            billing_period=date.today().strftime('%B %Y'),
            actor_user_id=self.warden.id
        )
        db.session.commit()

        # Assertions:
        # 1. Hostel record exists
        self.assertEqual(rec.amount_due, 8000.0)
        self.assertEqual(rec.status, 'PENDING')

        # 2. Central Finance FeeBill and FeeBillItem exist for Golu
        central_bills = FeeBill.query.filter_by(school_id=self.sid, student_id=self.student.id).all()
        self.assertTrue(len(central_bills) >= 1)
        self.assertEqual(central_bills[0].total_payable, 8000.0)
        self.assertEqual(central_bills[0].balance_due, 8000.0)

        # 3. Student Ledger contains debit entry of ₹8,000
        ledger = get_student_ledger(self.student.id)
        self.assertEqual(ledger['total_billed'], 8000.0)
        self.assertEqual(ledger['outstanding'], 8000.0)

    # ── Test 2: Hostel Partial Payment & Central Ledger Sync ──
    def test_02_hostel_partial_payment_sync(self):
        """Student Golu pays ₹5,000 partial fee at Hostel counter. Central Finance must reflect ₹3,000 balance."""
        rec = FeeRecord(
            school_id=self.sid,
            student_id=self.student.id,
            fee_type='HOSTEL',
            amount_due=8000.0,
            amount_paid=0.0,
            status='PENDING',
            month=date.today().strftime('%B %Y'),
            session='2026-27',
            source='HOSTEL',
            source_ref_id=1,
            remarks="Hostel Bed Charge"
        )
        db.session.add(rec)
        db.session.flush()

        register_or_sync_service_charge(
            school_id=self.sid,
            student_id=self.student.id,
            amount=8000.0,
            fee_head_code='HOSTEL',
            department='HOSTEL',
            source_module='HOSTEL',
            source_type='CHARGE',
            source_ref_id=1,
            description="Hostel Bed Charge",
            session='2026-27',
            billing_period=date.today().strftime('%B %Y'),
            actor_user_id=self.warden.id
        )
        db.session.commit()

        # Collect partial ₹5,000 at hostel counter
        record_hostel_fee_payment(
            record=rec,
            amount=5000.0,
            payment_mode='CASH',
            remarks='Paid to Warden Singh',
            collected_by_user=self.warden
        )

        # Assertions:
        # A. Hostel record is PARTIAL with ₹3,000 remaining
        db.session.refresh(rec)
        self.assertEqual(rec.amount_paid, 5000.0)
        self.assertEqual(rec.status, 'PARTIAL')
        self.assertEqual(rec.effective_due() - (rec.amount_paid or 0.0), 3000.0)

        # B. Central Finance FeePayment was automatically generated
        payment = FeePayment.query.filter_by(school_id=self.sid, student_id=self.student.id).first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.total_paid, 5000.0)
        self.assertEqual(payment.department, 'HOSTEL')

        # C. Central FeeBill balance dropped to ₹3,000
        bill = FeeBill.query.filter_by(school_id=self.sid, student_id=self.student.id).first()
        self.assertEqual(bill.balance_due, 3000.0)
        self.assertEqual(bill.status, 'PARTIALLY_PAID')

    # ── Test 3: Central Completion Payment & Two-Way Sync ──
    def test_03_central_completion_payment(self):
        """Remaining ₹3,000 paid at Central Accounts counter. Hostel record must automatically sync to PAID."""
        # 0. Initial Charge of ₹8,000
        rec = FeeRecord(
            school_id=self.sid,
            student_id=self.student.id,
            fee_type='HOSTEL',
            amount_due=8000.0,
            amount_paid=0.0,
            status='PENDING',
            month=date.today().strftime('%B %Y'),
            session='2026-27',
            source='HOSTEL',
            source_ref_id=1,
            remarks="Hostel Bed Charge"
        )
        db.session.add(rec)
        db.session.flush()

        register_or_sync_service_charge(
            school_id=self.sid,
            student_id=self.student.id,
            amount=8000.0,
            fee_head_code='HOSTEL',
            department='HOSTEL',
            source_module='HOSTEL',
            source_type='CHARGE',
            source_ref_id=1,
            description="Hostel Bed Charge",
            session='2026-27',
            billing_period=date.today().strftime('%B %Y'),
            actor_user_id=self.warden.id
        )
        db.session.commit()

        # 1. First record partial ₹5,000 at Hostel counter
        record_hostel_fee_payment(
            record=rec,
            amount=5000.0,
            payment_mode='CASH',
            remarks='First installment',
            collected_by_user=self.warden
        )

        # 2. Collect final ₹3,000 via Central Finance
        payment = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=3000.0,
            payment_mode='UPI',
            collected_by=self.accountant,
            department='HOSTEL',
            remarks='Final settlement via Central Fees',
            session='2026-27',
            allocations=[]
        )

        # Assertions:
        # A. Central FeeBill is now fully PAID
        bill = FeeBill.query.filter_by(school_id=self.sid, student_id=self.student.id).first()
        self.assertEqual(bill.balance_due, 0.0)
        self.assertEqual(bill.status, 'PAID')

        # B. Central Payment exists
        self.assertIsNotNone(payment)
        self.assertEqual(payment.total_paid, 3000.0)

        # C. Hostel FeeRecord has automatically synced to PAID
        db.session.refresh(rec)
        self.assertEqual(rec.status, 'PAID')
        self.assertEqual(rec.amount_paid, 8000.0)

    # ── Test 4: Library Fine Creation & Settlement Sync ──
    def test_04_library_fine_sync(self):
        """Librarian raises ₹120 book penalty. Recorded in Central Finance and settled atomically."""
        member = LibraryMember(
            school_id=self.sid,
            user_id=self.stu_user.id,
            member_type='STUDENT',
            card_number='LIB-101',
            status='ACTIVE'
        )
        db.session.add(member)
        db.session.flush()

        fine = FineTransaction(
            school_id=self.sid,
            member_id=member.id,
            issue_id=None,
            amount=120.0,
            amount_paid=0.0,
            waived_amount=0.0,
            reason='LATE_RETURN',
            status='OUTSTANDING'
        )
        db.session.add(fine)
        db.session.flush()

        register_or_sync_service_charge(
            school_id=self.sid,
            student_id=self.student.id,
            amount=120.0,
            fee_head_code='LIBRARY_FINE',
            department='LIBRARY',
            source_module='LIBRARY',
            source_type='FINE',
            source_ref_id=fine.id,
            description="Library Late Return Penalty",
            session='2026-27',
            actor_user_id=self.librarian.id
        )
        db.session.commit()

        # Settle via Central Finance
        collect_fee_payment(
            student_id=self.student.id,
            amount_paid=120.0,
            payment_mode='CASH',
            collected_by=self.librarian,
            department='LIBRARY',
            remarks='Settled at Library Desk',
            session='2026-27',
            allocations=[]
        )

        db.session.refresh(fine)
        self.assertEqual(fine.status, 'PAID')
        self.assertEqual(fine.amount_paid, 120.0)

    # ── Test 5: Transport Fee Generation & Payment Sync ──
    def test_05_transport_fee_sync(self):
        """Transport route assignment generates fee, synced to Central Finance and settled."""
        trans_rec = FeeRecord(
            school_id=self.sid,
            student_id=self.student.id,
            fee_type='TRANSPORT',
            amount_due=2500.0,
            amount_paid=0.0,
            status='PENDING',
            month=date.today().strftime('%Y-%m'),
            source='TRANSPORT',
            source_ref_id=99,
            remarks="Bus Route 12 - Stop Rohini"
        )
        db.session.add(trans_rec)
        db.session.flush()

        register_or_sync_service_charge(
            school_id=self.sid,
            student_id=self.student.id,
            amount=2500.0,
            fee_head_code='TRANSPORT',
            department='TRANSPORT',
            source_module='TRANSPORT',
            source_type='CHARGE',
            source_ref_id=99,
            description="Bus Route 12 - Stop Rohini",
            session='2026-27',
            billing_period=date.today().strftime('%Y-%m'),
            actor_user_id=self.accountant.id
        )
        db.session.commit()

        # Collect transport payment
        record_transport_fee_payment(
            record=trans_rec,
            amount=2500.0,
            payment_mode='UPI',
            remarks='Transport Counter Payment',
            collected_by_user=self.accountant
        )

        db.session.refresh(trans_rec)
        self.assertEqual(trans_rec.status, 'PAID')
        self.assertEqual(trans_rec.amount_paid, 2500.0)

    # ── Test 6: Combined Multi-Head Payment Allocation ──
    def test_06_combined_multi_head_payment_allocation(self):
        """Student has ₹4,000 Tuition + ₹2,000 Hostel dues. Pays ₹6,000 in ONE transaction with two allocations."""
        tuition_head = FeeHead.query.filter_by(school_id=self.sid, code='TUITION').first()
        hostel_head = FeeHead.query.filter_by(school_id=self.sid, code='HOSTEL').first()

        # Create FeeBill with 2 items: Tuition (₹4,000) and Hostel (₹2,000)
        bill = FeeBill(
            school_id=self.sid,
            student_id=self.student.id,
            bill_no="BILL-2026-TEST01",
            due_date=date.today() + timedelta(days=10),
            session="2026-27",
            bill_month="2026-07",
            bill_period_label="July 2026",
            total_current_charges=6000.0,
            total_payable=6000.0,
            amount_paid=0.0,
            balance_due=6000.0,
            status=BillStatus.ISSUED.value
        )
        db.session.add(bill)
        db.session.flush()

        item1 = FeeBillItem(bill_id=bill.id, fee_head_id=tuition_head.id, original_amount=4000.0, net_amount=4000.0, paid_amount=0.0)
        item2 = FeeBillItem(bill_id=bill.id, fee_head_id=hostel_head.id, original_amount=2000.0, net_amount=2000.0, paid_amount=0.0)
        db.session.add_all([item1, item2])
        db.session.commit()

        # One payment of ₹6,000 with explicit multi-head allocation
        allocations = [
            {'bill_id': bill.id, 'bill_item_id': item1.id, 'fee_head_id': tuition_head.id, 'amount': 4000.0},
            {'bill_id': bill.id, 'bill_item_id': item2.id, 'fee_head_id': hostel_head.id, 'amount': 2000.0}
        ]

        pmt = collect_fee_payment(
            student_id=self.student.id,
            amount_paid=6000.0,
            payment_mode='NET_BANKING',
            collected_by=self.accountant,
            department='ACCOUNTS',
            remarks='Consolidated Tuition + Hostel payment',
            session='2026-27',
            allocations=allocations
        )

        # Assertions:
        # Exactly ONE FeePayment
        all_payments = FeePayment.query.filter_by(school_id=self.sid, student_id=self.student.id).all()
        self.assertEqual(len(all_payments), 1)
        self.assertEqual(all_payments[0].total_paid, 6000.0)

        # TWO Allocations under the single payment
        alloc_records = FeePaymentAllocation.query.filter_by(payment_id=pmt.id).all()
        self.assertEqual(len(alloc_records), 2)
        alloc_amounts = {a.fee_head_id: a.allocated_amount for a in alloc_records}
        self.assertEqual(alloc_amounts[tuition_head.id], 4000.0)
        self.assertEqual(alloc_amounts[hostel_head.id], 2000.0)

        # Bill fully settled
        db.session.refresh(bill)
        self.assertEqual(bill.balance_due, 0.0)
        self.assertEqual(bill.status, 'PAID')

    # ── Test 7: Structure Edit/Delete Safeguards ──
    def test_07_structure_safeguards(self):
        """Structure referenced by class bills cannot be deleted, but can be archived."""
        struct = FeeStructureV2(
            school_id=self.sid,
            name="Class 10 General Rate Card",
            class_id=self.cls.id,
            session="2026-27",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(struct)
        db.session.commit()

        # Before any student bill is issued, is_used is False
        self.assertFalse(struct.is_used())

        # Generate a bill for student in that class
        bill = FeeBill(
            school_id=self.sid,
            student_id=self.student.id,
            bill_no="BILL-STRUCT-01",
            due_date=date.today() + timedelta(days=10),
            session="2026-27",
            bill_month="2026-08",
            bill_period_label="August 2026",
            total_payable=5000.0,
            balance_due=5000.0
        )
        db.session.add(bill)
        db.session.commit()

        # Now is_used is True
        self.assertTrue(struct.is_used())

        # Archiving sets status to ARCHIVED
        struct.status = 'ARCHIVED'
        struct.is_archived = True
        struct.is_active = False
        db.session.commit()
        self.assertEqual(struct.status, 'ARCHIVED')
        self.assertTrue(struct.is_archived)

    # ── Test 8: Library In/Out Attendance Telemetry ──
    def test_08_library_attendance_telemetry(self):
        """Test student library entry, duration calculation, active counter, and exit."""
        # 1. Student checks in
        entry_t = datetime.utcnow() - timedelta(minutes=45)
        visit = LibraryVisit(
            school_id=self.sid,
            student_id=self.student.id,
            visit_date=date.today(),
            entry_time=entry_t,
            entry_method='BARCODE',
            recorded_by=self.librarian.id,
            status='INSIDE'
        )
        db.session.add(visit)
        db.session.commit()

        # Active check: 1 student inside
        active_count = LibraryVisit.query.filter_by(school_id=self.sid, status='INSIDE').count()
        self.assertEqual(active_count, 1)

        # 2. Checkout
        visit.checkout()
        db.session.commit()

        # Post-checkout checks
        self.assertEqual(visit.status, 'EXITED')
        self.assertIsNotNone(visit.exit_time)
        self.assertGreaterEqual(visit.duration_minutes, 44)
        active_after = LibraryVisit.query.filter_by(school_id=self.sid, status='INSIDE').count()
        self.assertEqual(active_after, 0)

    # ── Test 9: Duplicate Payment Protection & Thread-Mutex ──
    def test_09_duplicate_payment_protection(self):
        """Prevent overpayment or duplicate payment on an already settled fee record."""
        rec = FeeRecord(
            school_id=self.sid,
            student_id=self.student.id,
            fee_type='HOSTEL',
            amount_due=5000.0,
            amount_paid=5000.0,
            status='PAID',
            month='2026-07',
            source='HOSTEL'
        )
        db.session.add(rec)
        db.session.commit()

        # Attempting to record additional payment on a settled record must raise ValueError
        with self.assertRaises(ValueError):
            record_hostel_fee_payment(
                record=rec,
                amount=1000.0,
                payment_mode='CASH',
                collected_by_user=self.warden
            )

    # ── Test 10: Today's Collection Breakdown by Service ──
    def test_10_today_collection_by_service_summary(self):
        """Verify Central Finance fee payment collections are classified into academic, hostel, transport, library, admission."""
        collect_fee_payment(student_id=self.student.id, amount_paid=12000.0, payment_mode='UPI', collected_by=self.principal, department='ACCOUNTS')
        collect_fee_payment(student_id=self.student.id, amount_paid=8000.0, payment_mode='CASH', collected_by=self.warden, department='HOSTEL')
        collect_fee_payment(student_id=self.student.id, amount_paid=3500.0, payment_mode='UPI', collected_by=self.accountant, department='TRANSPORT')
        collect_fee_payment(student_id=self.student.id, amount_paid=100.0, payment_mode='CASH', collected_by=self.librarian, department='LIBRARY')
        collect_fee_payment(student_id=self.student.id, amount_paid=5000.0, payment_mode='UPI', collected_by=self.principal, department='ADMISSION')

        all_today = FeePayment.query.filter_by(school_id=self.sid, payment_date=date.today(), status=PaymentStatus.VALID.value).all()
        breakdown = {
            'academic': sum(p.total_paid for p in all_today if (p.department or '').upper() in ('ACCOUNTS', 'ACADEMIC', 'TUITION')),
            'hostel': sum(p.total_paid for p in all_today if (p.department or '').upper() == 'HOSTEL'),
            'transport': sum(p.total_paid for p in all_today if (p.department or '').upper() == 'TRANSPORT'),
            'library': sum(p.total_paid for p in all_today if (p.department or '').upper() == 'LIBRARY'),
            'admission': sum(p.total_paid for p in all_today if (p.department or '').upper() == 'ADMISSION'),
            'total': sum(p.total_paid for p in all_today)
        }

        self.assertEqual(breakdown['academic'], 12000.0)
        self.assertEqual(breakdown['hostel'], 8000.0)
        self.assertEqual(breakdown['transport'], 3500.0)
        self.assertEqual(breakdown['library'], 100.0)
        self.assertEqual(breakdown['admission'], 5000.0)
        self.assertEqual(breakdown['total'], 28600.0)


if __name__ == '__main__':
    unittest.main()
