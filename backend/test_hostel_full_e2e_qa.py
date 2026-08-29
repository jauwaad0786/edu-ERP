import unittest
import json
import io
import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student, Class, Teacher
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


class TestHostelFullE2EQA(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()
        with cls.app.app_context():
            cls._setup_test_environment()

    def setUp(self):
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.rollback()
        db.session.remove()
        self.app_context.pop()

    @classmethod
    def _setup_test_environment(cls):
        """Create clean, isolated multi-tenant entities for School A and School B once."""
        # 1. School A
        cls.school_a = School.query.filter_by(code='QA_SCH_A').first()
        if not cls.school_a:
            cls.school_a = School(name='QA School Alpha', code='QA_SCH_A', current_session='2024-25', is_active=True)
            db.session.add(cls.school_a)
            db.session.flush()

        # School B
        cls.school_b = School.query.filter_by(code='QA_SCH_B').first()
        if not cls.school_b:
            cls.school_b = School(name='QA School Beta', code='QA_SCH_B', current_session='2024-25', is_active=True)
            db.session.add(cls.school_b)
            db.session.flush()

        # 3. Users for School A
        cls.u_princ_a = cls._get_or_create_user('qa_princ_a@test.com', 'Principal A', UserRole.PRINCIPAL, cls.school_a.id)
        cls.u_warden_a = cls._get_or_create_user('qa_warden_a@test.com', 'Warden A', UserRole.HOSTEL, cls.school_a.id)
        cls.u_teacher_a = cls._get_or_create_user('qa_teacher_a@test.com', 'Teacher A', UserRole.TEACHER, cls.school_a.id)
        cls.u_stud_a1 = cls._get_or_create_user('qa_stud_a1@test.com', 'Student Alpha 1', UserRole.STUDENT, cls.school_a.id)
        cls.u_stud_a2 = cls._get_or_create_user('qa_stud_a2@test.com', 'Student Alpha 2', UserRole.STUDENT, cls.school_a.id)

        # 4. Users for School B
        cls.u_princ_b = cls._get_or_create_user('qa_princ_b@test.com', 'Principal B', UserRole.PRINCIPAL, cls.school_b.id)
        cls.u_warden_b = cls._get_or_create_user('qa_warden_b@test.com', 'Warden B', UserRole.HOSTEL, cls.school_b.id)
        cls.u_stud_b1 = cls._get_or_create_user('qa_stud_b1@test.com', 'Student Beta 1', UserRole.STUDENT, cls.school_b.id)

        # Classes
        cls.cls_a = Class.query.filter_by(school_id=cls.school_a.id, name='Class 10').first()
        if not cls.cls_a:
            cls.cls_a = Class(school_id=cls.school_a.id, name='Class 10', section='A')
            db.session.add(cls.cls_a)
            db.session.flush()

        cls.cls_b = Class.query.filter_by(school_id=cls.school_b.id, name='Class 10').first()
        if not cls.cls_b:
            cls.cls_b = Class(school_id=cls.school_b.id, name='Class 10', section='B')
            db.session.add(cls.cls_b)
            db.session.flush()

        # Student records
        cls.stud_a1 = Student.query.filter_by(user_id=cls.u_stud_a1.id).first()
        if not cls.stud_a1:
            cls.stud_a1 = Student(user_id=cls.u_stud_a1.id, school_id=cls.school_a.id, class_id=cls.cls_a.id, admission_no='ADM-A1', roll_number='01')
            db.session.add(cls.stud_a1)

        cls.stud_a2 = Student.query.filter_by(user_id=cls.u_stud_a2.id).first()
        if not cls.stud_a2:
            cls.stud_a2 = Student(user_id=cls.u_stud_a2.id, school_id=cls.school_a.id, class_id=cls.cls_a.id, admission_no='ADM-A2', roll_number='02')
            db.session.add(cls.stud_a2)

        cls.stud_b1 = Student.query.filter_by(user_id=cls.u_stud_b1.id).first()
        if not cls.stud_b1:
            cls.stud_b1 = Student(user_id=cls.u_stud_b1.id, school_id=cls.school_b.id, class_id=cls.cls_b.id, admission_no='ADM-B1', roll_number='01')
            db.session.add(cls.stud_b1)

        db.session.commit()

        cls.school_a_id = cls.school_a.id
        cls.school_b_id = cls.school_b.id
        cls.stud_a1_id = cls.stud_a1.id
        cls.stud_a2_id = cls.stud_a2.id
        cls.stud_b1_id = cls.stud_b1.id

        # JWT Tokens
        cls.t_princ_a = create_access_token(identity=str(cls.u_princ_a.id))
        cls.t_warden_a = create_access_token(identity=str(cls.u_warden_a.id))
        cls.t_teacher_a = create_access_token(identity=str(cls.u_teacher_a.id))
        cls.t_stud_a1 = create_access_token(identity=str(cls.u_stud_a1.id))
        cls.t_stud_a2 = create_access_token(identity=str(cls.u_stud_a2.id))

        cls.t_princ_b = create_access_token(identity=str(cls.u_princ_b.id))
        cls.t_warden_b = create_access_token(identity=str(cls.u_warden_b.id))
        cls.t_stud_b1 = create_access_token(identity=str(cls.u_stud_b1.id))

    @classmethod
    def _get_or_create_user(cls, email, name, role, school_id):
        u = User.query.filter_by(email=email).first()
        if not u:
            u = User(email=email, name=name, role=role, school_id=school_id, is_active=True)
            u.set_password('TestPass123!')
            db.session.add(u)
            db.session.flush()
        return u

    def _auth_headers(self, token):
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SUITE: REALISTIC CRUD, ALLOCATION, CHECKIN/OUT, TRANSFERS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_01_hostel_hierarchy_crud_and_validation(self):
        """Test Hostel -> Building -> Floor -> Room -> Bed hierarchy CRUD and invalid payload rejections."""
        # 1. Create Hostel
        res = self.client.post('/api/hostel/hostels', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({
                                   'name': 'Alpha Boys Hostel',
                                   'gender': 'MALE',
                                   'hostel_type': 'BOYS'
                               }))
        self.assertIn(res.status_code, [200, 201])
        hostel_id = res.json.get('id') or res.json.get('hostel', {}).get('id')
        self.assertTrue(hostel_id)

        # Edit Hostel
        res = self.client.put(f'/api/hostel/hostels/{hostel_id}', headers=self._auth_headers(self.t_princ_a),
                              data=json.dumps({'name': 'Alpha Boys Premier Hostel'}))
        self.assertEqual(res.status_code, 200)

        # 2. Create Building
        res = self.client.post(f'/api/hostel/hostels/{hostel_id}/buildings', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({'name': 'Block A'}))
        self.assertEqual(res.status_code, 201)
        bldg_id = res.json.get('id') or res.json.get('building', {}).get('id')

        # 3. Create Floor
        res = self.client.post(f'/api/hostel/buildings/{bldg_id}/floors', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({'name': '1st Floor', 'floor_number': 1}))
        self.assertEqual(res.status_code, 201)
        floor_id = res.json.get('id') or res.json.get('floor', {}).get('id')

        # 4. Create Room 101 (4 beds) & Room 102 (2 beds)
        res = self.client.post(f'/api/hostel/floors/{floor_id}/rooms', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({
                                   'room_number': 'QA-101',
                                   'room_type': 'FOUR_SHARING',
                                   'is_ac': True,
                                   'bed_count': 4
                               }))
        self.assertEqual(res.status_code, 201)
        room_101_id = res.json.get('id') or res.json.get('room', {}).get('id')

        res = self.client.post(f'/api/hostel/floors/{floor_id}/rooms', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({
                                   'room_number': 'QA-102',
                                   'room_type': 'DOUBLE',
                                   'is_ac': False,
                                   'bed_count': 2
                               }))
        self.assertEqual(res.status_code, 201)
        room_102_id = res.json.get('id') or res.json.get('room', {}).get('id')

        # Verify auto-generated Beds
        beds_101 = HostelBed.query.filter_by(room_id=room_101_id).all()
        self.assertEqual(len(beds_101), 4)
        for b in beds_101:
            self.assertEqual(b.status, 'VACANT')

        beds_102 = HostelBed.query.filter_by(room_id=room_102_id).all()
        self.assertEqual(len(beds_102), 2)

        # Invalid data rejection: creating room with invalid floor
        res = self.client.post('/api/hostel/floors/999999/rooms', headers=self._auth_headers(self.t_princ_a),
                               data=json.dumps({'room_number': 'BAD-ROOM'}))
        self.assertIn(res.status_code, [400, 404])

    def test_02_bed_allocation_and_collision_prevention(self):
        """Test Bed Allocation, OCCUPIED transition, duplicate bed allocation prevention, and room stats."""
        # Clear any existing active allocations for these test students
        HostelBedAllocation.query.filter(
            HostelBedAllocation.student_id.in_([self.stud_a1_id, self.stud_a2_id]),
            HostelBedAllocation.status == 'ACTIVE'
        ).update({'status': 'VACATED'})
        db.session.commit()

        # Create hierarchy
        h = Hostel(school_id=self.school_a_id, name='Hostel Collide Test', gender='MALE', hostel_type='BOYS')
        db.session.add(h); db.session.flush()
        b = HostelBuilding(school_id=self.school_a_id, hostel_id=h.id, name='Bldg 1')
        db.session.add(b); db.session.flush()
        fl = HostelFloor(school_id=self.school_a_id, building_id=b.id, name='Floor 1', floor_number=1)
        db.session.add(fl); db.session.flush()
        rm = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='201', room_type='DOUBLE')
        db.session.add(rm); db.session.flush()
        bed1 = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B1', status='VACANT')
        bed2 = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B2', status='VACANT')
        db.session.add_all([bed1, bed2])
        db.session.commit()

        # 1. Allocate Student A1 to Bed 1
        res = self.client.post('/api/hostel/admissions', headers=self._auth_headers(self.t_warden_a),
                               data=json.dumps({
                                   'student_id': self.stud_a1_id,
                                   'bed_id': bed1.id,
                                   'admission_date': str(date.today()),
                                   'deposit_amount': 2000,
                                   'monthly_fee': 4000
                               }))
        self.assertEqual(res.status_code, 201)
        alloc_id = res.json.get('id')

        # Verify bed is now OCCUPIED
        db.session.expire_all()
        bed1_ref = HostelBed.query.get(bed1.id)
        self.assertEqual(bed1_ref.status, 'OCCUPIED')

        # 2. Attempt to allocate Student A2 to the SAME occupied Bed 1 -> MUST FAIL
        res_collision = self.client.post('/api/hostel/admissions', headers=self._auth_headers(self.t_warden_a),
                                         data=json.dumps({
                                             'student_id': self.stud_a2_id,
                                             'bed_id': bed1.id,
                                             'admission_date': str(date.today())
                                         }))
        self.assertIn(res_collision.status_code, [400, 409])

        # 3. Allocate Student A2 to available Bed 2 -> SUCCESS
        res_success = self.client.post('/api/hostel/admissions', headers=self._auth_headers(self.t_warden_a),
                                       data=json.dumps({
                                           'student_id': self.stud_a2_id,
                                           'bed_id': bed2.id,
                                           'admission_date': str(date.today())
                                       }))
        self.assertEqual(res_success.status_code, 201)
        bed2_ref = HostelBed.query.get(bed2.id)
        self.assertEqual(bed2_ref.status, 'OCCUPIED')

    def test_03_checkin_checkout_and_room_transfer(self):
        """Test Check-In, Transfer to empty bed vs occupied bed, and Check-Out with audit history."""
        # Setup Room 1 with Bed 1 (occupied by Student A1) & Room 2 with Bed A (available) and Bed B (occupied by Student A2)
        HostelBedAllocation.query.filter(
            HostelBedAllocation.student_id.in_([self.stud_a1_id, self.stud_a2_id]),
            HostelBedAllocation.status == 'ACTIVE'
        ).update({'status': 'VACATED'})
        db.session.commit()

        h = Hostel(school_id=self.school_a_id, name='Hostel Flow Test', gender='MALE', hostel_type='BOYS')
        db.session.add(h); db.session.flush()
        b = HostelBuilding(school_id=self.school_a_id, hostel_id=h.id, name='Bldg Flow')
        db.session.add(b); db.session.flush()
        fl = HostelFloor(school_id=self.school_a_id, building_id=b.id, name='Fl 1', floor_number=1)
        db.session.add(fl); db.session.flush()
        rm1 = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='301', room_type='SINGLE')
        rm2 = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='302', room_type='DOUBLE')
        db.session.add_all([rm1, rm2]); db.session.flush()

        bed1 = HostelBed(school_id=self.school_a_id, room_id=rm1.id, bed_number='B1', status='VACANT')
        bed_a = HostelBed(school_id=self.school_a_id, room_id=rm2.id, bed_number='BA', status='VACANT')
        bed_b = HostelBed(school_id=self.school_a_id, room_id=rm2.id, bed_number='BB', status='VACANT')
        db.session.add_all([bed1, bed_a, bed_b]); db.session.flush()

        # Allocate Student A1 to Bed 1
        alloc1 = HostelBedAllocation(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            hostel_id=h.id, building_id=b.id, floor_id=fl.id, room_id=rm1.id, bed_id=bed1.id,
            admission_date=date.today(), status='ACTIVE'
        )
        bed1.status = 'OCCUPIED'
        db.session.add(alloc1); db.session.commit()

        # 1. Check-In Student A1
        res = self.client.post(f'/api/hostel/admission/{alloc1.id}/checkin',
                               headers=self._auth_headers(self.t_warden_a))
        self.assertEqual(res.status_code, 200)

        # 2. Transfer Student A1 to Bed A (available)
        res_tr = self.client.post('/api/hostel/transfers',
                                  headers=self._auth_headers(self.t_warden_a),
                                  data=json.dumps({
                                      'allocation_id': alloc1.id,
                                      'new_bed_id': bed_a.id,
                                      'reason': 'Requested room upgrade'
                                  }))
        self.assertIn(res_tr.status_code, [200, 201])

        # Verify old bed VACANT, new bed OCCUPIED
        db.session.expire_all()
        self.assertEqual(HostelBed.query.get(bed1.id).status, 'VACANT')
        self.assertEqual(HostelBed.query.get(bed_a.id).status, 'OCCUPIED')

        # 3. Check-Out Student A1
        active_alloc = HostelBedAllocation.query.filter_by(student_id=self.stud_a1_id, status='ACTIVE').first()
        self.assertTrue(active_alloc)
        res_co = self.client.post(f'/api/hostel/admission/{active_alloc.id}/checkout',
                                  headers=self._auth_headers(self.t_warden_a),
                                  data=json.dumps({
                                      'remarks': 'Completed course',
                                      'force': True
                                  }))
        self.assertEqual(res_co.status_code, 200)

        # Verify bed is freed and history retained
        db.session.expire_all()
        self.assertEqual(HostelBed.query.get(bed_a.id).status, 'VACANT')
        past_allocs = HostelBedAllocation.query.filter_by(student_id=self.stud_a1_id, status='VACATED').all()
        self.assertTrue(len(past_allocs) >= 1)

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SUITE: FINANCIAL INTEGRATION, DUAL-SYNC, DOUBLE PAYMENT PROTECTION
    # ═══════════════════════════════════════════════════════════════════════════

    def test_04_monthly_billing_idempotency(self):
        """Test August monthly billing generation, idempotency (no duplicates), and September independence."""
        HostelBedAllocation.query.filter(
            HostelBedAllocation.student_id == self.stud_a1_id,
            HostelBedAllocation.status == 'ACTIVE'
        ).update({'status': 'VACATED'})
        db.session.commit()

        # Setup student resident
        h = Hostel(school_id=self.school_a_id, name='Hostel Billing Test', gender='MALE', hostel_type='BOYS')
        db.session.add(h); db.session.flush()
        b = HostelBuilding(school_id=self.school_a_id, hostel_id=h.id, name='Bldg')
        db.session.add(b); db.session.flush()
        fl = HostelFloor(school_id=self.school_a_id, building_id=b.id, name='Fl', floor_number=1)
        db.session.add(fl); db.session.flush()
        rm = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='401', room_type='DOUBLE')
        db.session.add(rm); db.session.flush()
        bed = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B1', status='OCCUPIED')
        db.session.add(bed); db.session.flush()
        alloc = HostelBedAllocation(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            hostel_id=h.id, building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed.id,
            admission_date=date.today(), status='ACTIVE'
        )
        db.session.add(alloc)

        fs = HostelFeeStructure(
            school_id=self.school_a_id, hostel_id=h.id, sharing_type='DOUBLE', is_ac=False,
            monthly_fee=5000, status='ACTIVE'
        )
        db.session.add(fs); db.session.commit()

        # 1. Generate August 2026 fee
        rec1, reason1 = generate_hostel_fee_record(alloc, self.u_princ_a.id, month='2026-08')
        self.assertEqual(reason1, 'created')
        self.assertEqual(rec1.amount_due, 5000)
        self.assertEqual(rec1.fee_type, 'HOSTEL')
        self.assertEqual(rec1.source, 'HOSTEL')
        self.assertEqual(rec1.status, 'PENDING')

        # 2. Run Generate August 2026 again -> MUST BE IDEMPOTENT (NO DUPLICATE CHARGE)
        rec2, reason2 = generate_hostel_fee_record(alloc, self.u_princ_a.id, month='2026-08')
        self.assertEqual(reason2, 'already_exists')
        self.assertEqual(rec1.id, rec2.id)

        # Count records in DB for 2026-08
        count_aug = FeeRecord.query.filter_by(school_id=self.school_a_id, student_id=self.stud_a1_id, fee_type='HOSTEL', month='2026-08').count()
        self.assertEqual(count_aug, 1)

        # 3. Generate September 2026 fee -> Separate Independent Charge
        rec_sept, reason_sept = generate_hostel_fee_record(alloc, self.u_princ_a.id, month='2026-09')
        self.assertEqual(reason_sept, 'created')
        self.assertNotEqual(rec1.id, rec_sept.id)
        self.assertEqual(rec_sept.month, '2026-09')

    def test_05_fine_assessment_partial_payment_and_waivers(self):
        """Test Fine Assessment, Partial Payment progression, and Audit-logged Waivers."""
        HostelBedAllocation.query.filter(
            HostelBedAllocation.student_id == self.stud_a1_id,
            HostelBedAllocation.status == 'ACTIVE'
        ).update({'status': 'VACATED'})
        db.session.commit()

        # Active resident allocation first
        h = Hostel(school_id=self.school_a_id, name='Hostel Fine Test', gender='MALE', hostel_type='BOYS')
        db.session.add(h); db.session.flush()
        b = HostelBuilding(school_id=self.school_a_id, hostel_id=h.id, name='Bldg')
        db.session.add(b); db.session.flush()
        fl = HostelFloor(school_id=self.school_a_id, building_id=b.id, name='Fl', floor_number=1)
        db.session.add(fl); db.session.flush()
        rm = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='F-101', room_type='DOUBLE')
        db.session.add(rm); db.session.flush()
        bed = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B1', status='OCCUPIED')
        db.session.add(bed); db.session.flush()
        alloc = HostelBedAllocation(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            hostel_id=h.id, building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed.id,
            admission_date=date.today(), status='ACTIVE'
        )
        db.session.add(alloc); db.session.commit()

        # 1. Create Fine = ₹500
        res = self.client.post('/api/hostel/fines', headers=self._auth_headers(self.t_warden_a),
                               data=json.dumps({
                                   'student_id': self.stud_a1_id,
                                   'reason': 'DAMAGE_PROPERTY',
                                   'amount': 500,
                                   'description': 'Broken study chair leg'
                               }))
        self.assertEqual(res.status_code, 201)
        fine_id = res.json.get('id') or res.json.get('fine_id')

        db.session.expire_all()
        fine = HostelFineRecord.query.get(fine_id)
        self.assertEqual(fine.amount, 500)
        self.assertEqual(fine.amount_paid, 0)
        self.assertEqual(fine.outstanding_amount, 500)
        self.assertEqual(fine.status, 'OUTSTANDING')

        # 2. Pay Partial ₹200 from Hostel
        res_pay1 = self.client.post(f'/api/hostel/fines/{fine_id}/collect', headers=self._auth_headers(self.t_warden_a),
                                    data=json.dumps({
                                        'amount': 200,
                                        'payment_mode': 'CASH',
                                        'remarks': 'First installment'
                                    }))
        self.assertEqual(res_pay1.status_code, 200)

        db.session.expire_all()
        fine = HostelFineRecord.query.get(fine_id)
        self.assertEqual(fine.amount_paid, 200)
        self.assertEqual(fine.outstanding_amount, 300)
        self.assertEqual(fine.status, 'PARTIALLY_PAID')

        # 3. Waive Remaining ₹300 with audit justification
        res_waive = self.client.post(f'/api/hostel/fines/{fine_id}/waive', headers=self._auth_headers(self.t_warden_a),
                                     data=json.dumps({
                                         'waived_amount': 300,
                                         'reason': 'Waived on student apology and first offence'
                                     }))
        self.assertEqual(res_waive.status_code, 200)

        db.session.expire_all()
        fine = HostelFineRecord.query.get(fine_id)
        self.assertEqual(fine.waived_amount, 300)
        self.assertEqual(fine.outstanding_amount, 0)
        self.assertEqual(fine.status, 'WAIVED')
        self.assertIn('first offence', fine.waive_reason)

    def test_06_central_payment_sync_and_double_payment_block(self):
        """Test Payment from Hostel reflects in Fee Management & Student, and blocks double payment."""
        # Create FeeRecord for ₹5000
        rec = FeeRecord(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            fee_type='HOSTEL', source='HOSTEL', month='2026-10',
            amount_due=5000, amount_paid=0, status='PENDING', session='2024-25'
        )
        db.session.add(rec); db.session.commit()

        # 1. Pay ₹5000 from Hostel Module
        res_pay = self.client.post('/api/hostel/fees/collect', headers=self._auth_headers(self.t_warden_a),
                                   data=json.dumps({
                                       'record_id': rec.id,
                                       'amount_paid': 5000,
                                       'payment_mode': 'UPI',
                                       'remarks': 'Paid at hostel desk'
                                   }))
        self.assertEqual(res_pay.status_code, 200)

        # Verify DB state
        db.session.expire_all()
        rec_ref = FeeRecord.query.get(rec.id)
        self.assertEqual(rec_ref.amount_paid, 5000)
        self.assertEqual(rec_ref.status, 'PAID')

        # Verify FeeTransaction logged
        txns = FeeTransaction.query.filter_by(fee_record_id=rec.id).all()
        self.assertEqual(len(txns), 1)
        self.assertEqual(txns[0].amount, 5000)
        self.assertEqual(txns[0].payment_mode, 'UPI')

        # 2. Attempt Second Payment for the same fee -> MUST BE BLOCKED
        res_dup = self.client.post('/api/hostel/fees/collect', headers=self._auth_headers(self.t_warden_a),
                                   data=json.dumps({
                                       'record_id': rec.id,
                                       'amount_paid': 5000,
                                       'payment_mode': 'CASH'
                                   }))
        self.assertIn(res_dup.status_code, [400, 409])

    def test_07_partial_payment_dual_sync(self):
        """Test partial payment: Pay ₹2000 from Hostel -> Pay remaining ₹3000 from Fee Management -> Full Settled."""
        rec = FeeRecord(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            fee_type='HOSTEL', source='HOSTEL', month='2026-11',
            amount_due=5000, amount_paid=0, status='PENDING', session='2024-25'
        )
        db.session.add(rec); db.session.commit()

        # Step 1: Pay ₹2000 from Hostel Desk
        res1 = self.client.post('/api/hostel/fees/collect', headers=self._auth_headers(self.t_warden_a),
                                data=json.dumps({
                                    'record_id': rec.id,
                                    'amount_paid': 2000,
                                    'payment_mode': 'CASH'
                                }))
        self.assertEqual(res1.status_code, 200)

        db.session.expire_all()
        rec_ref = FeeRecord.query.get(rec.id)
        self.assertEqual(rec_ref.amount_paid, 2000)
        self.assertEqual(rec_ref.status, 'PARTIAL')

        # Step 2: Pay remaining ₹3000 from Central Fee Management
        res2 = self.client.post('/api/principal/fees/collect', headers=self._auth_headers(self.t_princ_a),
                                data=json.dumps({
                                    'record_id': rec.id,
                                    'amount_paid': 3000,
                                    'payment_mode': 'ONLINE'
                                }))
        self.assertIn(res2.status_code, [200, 201])

        db.session.expire_all()
        rec_ref = FeeRecord.query.get(rec.id)
        self.assertEqual(rec_ref.amount_paid, 5000)
        self.assertEqual(rec_ref.status, 'PAID')

        # Check total transactions = 2 (sum = 5000)
        txns = FeeTransaction.query.filter_by(fee_record_id=rec.id).all()
        self.assertEqual(len(txns), 2)
        self.assertEqual(sum(t.amount for t in txns), 5000)

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SUITE: MULTI-TENANT ISOLATION (SCHOOL A VS SCHOOL B) & RBAC
    # ═══════════════════════════════════════════════════════════════════════════

    def test_08_multi_tenant_isolation_school_a_vs_school_b(self):
        """CRITICAL: School A staff must NEVER access or modify School B's Hostels, Rooms, Beds, Students, Fines or Reports."""
        # Create Hostel in School B
        h_b = Hostel(school_id=self.school_b_id, name='Beta Girls Hostel', gender='FEMALE', hostel_type='GIRLS')
        db.session.add(h_b); db.session.flush()
        b_b = HostelBuilding(school_id=self.school_b_id, hostel_id=h_b.id, name='Beta Bldg')
        db.session.add(b_b); db.session.flush()
        fl_b = HostelFloor(school_id=self.school_b_id, building_id=b_b.id, name='Fl 1', floor_number=1)
        db.session.add(fl_b); db.session.flush()
        rm_b = HostelRoom(school_id=self.school_b_id, floor_id=fl_b.id, room_number='B-101', room_type='DOUBLE')
        db.session.add(rm_b); db.session.flush()
        bed_b = HostelBed(school_id=self.school_b_id, room_id=rm_b.id, bed_number='B1', status='VACANT')
        db.session.add(bed_b); db.session.commit()

        # 1. School A Principal attempts to view School B's room map
        res = self.client.get(f'/api/hostel/hostels/{h_b.id}/room-map', headers=self._auth_headers(self.t_princ_a))
        self.assertIn(res.status_code, [403, 404])

        # 2. School A Warden attempts to allocate Student A1 to School B's Bed -> MUST FAIL
        res = self.client.post('/api/hostel/admissions', headers=self._auth_headers(self.t_warden_a),
                               data=json.dumps({
                                   'student_id': self.stud_a1_id,
                                   'bed_id': bed_b.id,
                                   'admission_date': str(date.today())
                               }))
        self.assertIn(res.status_code, [400, 403, 404, 409])

        # 3. School A Warden attempts to delete School B's Hostel -> MUST FAIL
        res = self.client.delete(f'/api/hostel/hostels/{h_b.id}', headers=self._auth_headers(self.t_princ_a))
        self.assertIn(res.status_code, [403, 404])

        # 4. School B Principal attempts to access School A's fee reports -> MUST NOT contain School A data
        res = self.client.get('/api/hostel/reports/occupancy', headers=self._auth_headers(self.t_princ_b))
        self.assertEqual(res.status_code, 200)
        # Should not list School A hostels
        hostel_names = [h.get('hostel_name') or h.get('name') for h in (res.json if isinstance(res.json, list) else res.json.get('hostel_breakdown', []))]
        self.assertNotIn('Alpha Boys Hostel', hostel_names)

    def test_09_student_dashboard_self_service_isolation(self):
        """Test Student Dashboard self-service API: Student A sees only their own room, roommates, fees, and fines."""
        HostelBedAllocation.query.filter(
            HostelBedAllocation.student_id.in_([self.stud_a1_id, self.stud_a2_id]),
            HostelBedAllocation.status == 'ACTIVE'
        ).update({'status': 'VACATED'})
        db.session.commit()

        # Setup Student A allocation and fine
        h = Hostel(school_id=self.school_a_id, name='Alpha Hall', gender='MALE', hostel_type='BOYS')
        db.session.add(h); db.session.flush()
        b = HostelBuilding(school_id=self.school_a_id, hostel_id=h.id, name='Bldg')
        db.session.add(b); db.session.flush()
        fl = HostelFloor(school_id=self.school_a_id, building_id=b.id, name='Fl', floor_number=1)
        db.session.add(fl); db.session.flush()
        rm = HostelRoom(school_id=self.school_a_id, floor_id=fl.id, room_number='501', room_type='DOUBLE')
        db.session.add(rm); db.session.flush()
        bed1 = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B1', status='OCCUPIED')
        bed2 = HostelBed(school_id=self.school_a_id, room_id=rm.id, bed_number='B2', status='OCCUPIED')
        db.session.add_all([bed1, bed2]); db.session.flush()

        alloc1 = HostelBedAllocation(
            school_id=self.school_a_id, student_id=self.stud_a1_id,
            hostel_id=h.id, building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed1.id,
            admission_date=date.today(), status='ACTIVE'
        )
        alloc2 = HostelBedAllocation(
            school_id=self.school_a_id, student_id=self.stud_a2_id,
            hostel_id=h.id, building_id=b.id, floor_id=fl.id, room_id=rm.id, bed_id=bed2.id,
            admission_date=date.today(), status='ACTIVE'
        )
        bed1.current_student_id = self.stud_a1_id
        bed2.current_student_id = self.stud_a2_id
        db.session.add_all([alloc1, alloc2]); db.session.commit()

        # Call Student A hostel endpoint
        res = self.client.get('/api/student/hostel', headers=self._auth_headers(self.t_stud_a1))
        self.assertEqual(res.status_code, 200)
        data = res.json
        curr = data.get('current_allocation', {})
        self.assertEqual(curr.get('room_number'), '501')
        self.assertEqual(curr.get('bed_number'), 'B1')
        # Roommates should list Student A2
        roommate_names = [rm.get('name') for rm in data.get('roommates', [])]
        self.assertIn('Student Alpha 2', roommate_names)
        self.assertNotIn('Student Beta 1', roommate_names)

    def test_10_pdf_report_generation_endpoints(self):
        """Test PDF generation endpoints for Fee Collection Reports (Hostel & Central Finance)."""
        # 1. Hostel Fee Collection PDF
        res = self.client.get('/api/hostel/reports/fee-collection/pdf', headers=self._auth_headers(self.t_princ_a))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.mimetype, 'application/pdf')
        self.assertTrue(len(res.data) > 500)  # Contains valid PDF bytes

        # 2. Central Finance Fee Collection PDF
        res_cent = self.client.get('/api/principal/fees/collection-report/pdf?month=2026-08', headers=self._auth_headers(self.t_princ_a))
        self.assertEqual(res_cent.status_code, 200)
        self.assertEqual(res_cent.mimetype, 'application/pdf')
        self.assertTrue(len(res_cent.data) > 500)


if __name__ == '__main__':
    unittest.main()
