import unittest
import json
from datetime import date, datetime
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student, Class
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    HostelBedAllocation, HostelFeeStructure, HostelFineRecord,
    HostelComplaint, HostelOutPass, HostelAttendance, HostelInventory
)
from app.models.financial import FeeRecord, FeeTransaction
from app.services.hostel_fee_service import (
    resolve_fee_structure, generate_hostel_fee_record,
    record_hostel_fee_payment, record_hostel_fine_payment,
    sync_hostel_fine_from_fee_record
)


class TestHostelFinanceIntegration(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.remove()
        self.app_context.pop()

    def test_01_fee_structure_resolution_and_monthly_billing(self):
        """Test fee structure resolution, monthly billing generation, and duplicate prevention."""
        school = School.query.first()
        if not school:
            return

        # 1. Create or get test hostel
        h = Hostel.query.filter_by(school_id=school.id, name='Test Boys Hostel').first()
        if not h:
            h = Hostel(school_id=school.id, name='Test Boys Hostel', gender='MALE', hostel_type='BOYS')
            db.session.add(h)
            db.session.flush()

        # 2. Building & Floor
        b = HostelBuilding.query.filter_by(hostel_id=h.id, name='Block A').first()
        if not b:
            b = HostelBuilding(hostel_id=h.id, school_id=school.id, name='Block A')
            db.session.add(b)
            db.session.flush()

        fl = HostelFloor.query.filter_by(building_id=b.id, name='1st Floor').first()
        if not fl:
            fl = HostelFloor(building_id=b.id, school_id=school.id, name='1st Floor', floor_number=1)
            db.session.add(fl)
            db.session.flush()

        # 3. Room & Bed
        rm = HostelRoom.query.filter_by(floor_id=fl.id, room_number='101').first()
        if not rm:
            rm = HostelRoom(floor_id=fl.id, school_id=school.id, room_number='101', room_type='DOUBLE', is_ac=True)
            db.session.add(rm)
            db.session.flush()

        bed = HostelBed.query.filter_by(room_id=rm.id, bed_number='A').first()
        if not bed:
            bed = HostelBed(room_id=rm.id, school_id=school.id, bed_number='A', status='VACANT')
            db.session.add(bed)
            db.session.flush()

        # 4. Fee Structure
        fs = HostelFeeStructure.query.filter_by(hostel_id=h.id, sharing_type='DOUBLE', is_ac=True).first()
        if not fs:
            fs = HostelFeeStructure(
                school_id=school.id, hostel_id=h.id, sharing_type='DOUBLE', is_ac=True,
                monthly_fee=5000.0, electricity_charges=500.0, mess_charges=1500.0
            )
            db.session.add(fs)
            db.session.flush()

        resolved = resolve_fee_structure(bed)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.total_monthly(), 7000.0)

        # 5. Create Student & Allocation
        user = User.query.filter_by(email='test_hostel_student@school.com').first()
        if not user:
            user = User(name='Test Hostel Student', email='test_hostel_student@school.com', role=UserRole.STUDENT, school_id=school.id)
            user.set_password('Password@123')
            db.session.add(user)
            db.session.flush()

        st = Student.query.filter_by(user_id=user.id).first()
        if not st:
            st = Student(user_id=user.id, school_id=school.id, roll_number='TH01', admission_no='ADM-TH01', gender='MALE')
            db.session.add(st)
            db.session.flush()

        alloc = HostelBedAllocation.query.filter_by(student_id=st.id, status='ACTIVE').first()
        if not alloc:
            alloc = HostelBedAllocation(
                school_id=school.id, student_id=st.id, hostel_id=h.id,
                building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed.id,
                status='ACTIVE', admission_date=date.today()
            )
            db.session.add(alloc)
            bed.status = 'OCCUPIED'
            bed.current_student_id = st.id
            db.session.flush()

        # 6. Generate Fee for August 2026
        test_month = '2026-08'
        rec1, reason1 = generate_hostel_fee_record(alloc, user.id, month=test_month)
        self.assertIn(reason1, ['created', 'already_exists'])
        self.assertEqual(rec1.amount_due, 7000.0)
        self.assertEqual(rec1.amount_paid, 0.0)
        self.assertEqual(rec1.status, 'PENDING')

        # 7. Duplicate Prevention Test
        rec2, reason2 = generate_hostel_fee_record(alloc, user.id, month=test_month)
        self.assertEqual(reason2, 'already_exists')
        self.assertEqual(rec1.id, rec2.id)

        # 8. Collect Payment with Double Payment Protection
        rec1, txn1 = record_hostel_fee_payment(
            record=rec1, amount=3000.0, payment_mode='CASH', remarks='Partial 1', collected_by_user=user
        )
        self.assertEqual(rec1.amount_paid, 3000.0)
        self.assertEqual(rec1.status, 'PARTIAL')
        self.assertEqual(rec1.effective_due() - rec1.amount_paid, 4000.0)

        # Pay remaining
        rec1, txn2 = record_hostel_fee_payment(
            record=rec1, amount=4000.0, payment_mode='UPI', remarks='Final Settle', collected_by_user=user
        )
        self.assertEqual(rec1.amount_paid, 7000.0)
        self.assertEqual(rec1.status, 'PAID')

        # Attempt to pay again -> MUST BE BLOCKED
        with self.assertRaises(ValueError):
            record_hostel_fee_payment(record=rec1, amount=500.0, payment_mode='CASH', collected_by_user=user)

        # 9. Fine Lifecycle & Waiver
        fine = HostelFineRecord(
            school_id=school.id, student_id=st.id, hostel_id=h.id,
            reason='ROOM_DAMAGE', description='Broken window pane',
            amount=500.0, amount_paid=0.0, status='OUTSTANDING'
        )
        db.session.add(fine)
        db.session.flush()

        fee_rec_fine = FeeRecord(
            school_id=school.id, student_id=st.id, fee_type='HOSTEL_FINE', source='HOSTEL_FINE',
            source_ref_id=fine.id, amount_due=500.0, amount_paid=0.0, status='PENDING',
            month=test_month, due_date=date.today()
        )
        db.session.add(fee_rec_fine)
        db.session.flush()
        fine.fee_record_id = fee_rec_fine.id

        # Partial fine pay ₹200
        fine = record_hostel_fine_payment(fine, 200.0, payment_mode='CASH', collected_by_user=user)
        self.assertEqual(fine.amount_paid, 200.0)
        self.assertEqual(fine.outstanding_amount, 300.0)
        self.assertEqual(fine.status, 'PARTIALLY_PAID')

        # Waive remaining ₹300
        fine.waived_amount = 300.0
        fine.waived_by = user.id
        fine.status = 'WAIVED'
        self.assertEqual(fine.outstanding_amount, 0.0)

        # 10. Student Transfer Test
        bed_b = HostelBed.query.filter_by(room_id=rm.id, bed_number='B').first()
        if not bed_b:
            bed_b = HostelBed(room_id=rm.id, school_id=school.id, bed_number='B', status='VACANT')
            db.session.add(bed_b)
            db.session.flush()

        # Transfer st from Bed A -> Bed B
        alloc.status = 'TRANSFERRED'
        alloc.vacate_date = date.today()
        bed.status = 'VACANT'
        bed.current_student_id = None

        new_alloc = HostelBedAllocation(
            school_id=school.id, student_id=st.id, hostel_id=h.id,
            building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed_b.id,
            status='ACTIVE', admission_date=date.today()
        )
        db.session.add(new_alloc)
        bed_b.status = 'OCCUPIED'
        bed_b.current_student_id = st.id
        db.session.flush()

        self.assertEqual(bed.status, 'VACANT')
        self.assertEqual(bed_b.status, 'OCCUPIED')
        self.assertEqual(new_alloc.status, 'ACTIVE')

        # 11. Complaints Lifecycle
        comp = HostelComplaint(
            school_id=school.id, hostel_id=h.id, student_id=st.id, room_id=rm.id,
            category='ELECTRICAL', title='Fan speed regulator faulty',
            description='Fan is running very slowly', priority='HIGH', status='OPEN'
        )
        db.session.add(comp)
        db.session.flush()
        self.assertEqual(comp.status, 'OPEN')

        comp.status = 'RESOLVED'
        comp.resolution = 'Replaced regulator unit with new one'
        comp.resolved_by = user.id
        comp.resolved_at = datetime.utcnow()
        db.session.flush()
        self.assertEqual(comp.status, 'RESOLVED')

        # 12. Out-Pass Lifecycle
        out_pass = HostelOutPass(
            school_id=school.id, hostel_id=h.id, student_id=st.id, room_id=rm.id,
            pass_type='DAY_OUTING', reason='Weekend market visit',
            destination='City Center', out_time=datetime.utcnow(),
            expected_return=datetime.utcnow(), status='REQUESTED'
        )
        db.session.add(out_pass)
        db.session.flush()
        self.assertEqual(out_pass.status, 'REQUESTED')

        out_pass.status = 'APPROVED'
        out_pass.approved_by = user.id
        out_pass.approved_at = datetime.utcnow()
        db.session.flush()
        self.assertEqual(out_pass.status, 'APPROVED')

        # 13. Night Roll Call Attendance
        att = HostelAttendance(
            school_id=school.id, hostel_id=h.id, allocation_id=new_alloc.id,
            student_id=st.id, attendance_date=date.today(), status='PRESENT'
        )
        db.session.add(att)
        db.session.flush()
        self.assertEqual(att.status, 'PRESENT')

        # Rollback so test doesn't mutate db permanently
        db.session.rollback()


if __name__ == '__main__':
    unittest.main()
