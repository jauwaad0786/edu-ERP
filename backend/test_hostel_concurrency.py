import uuid
import unittest
import threading
from datetime import date
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student
from app.models.financial import FeeRecord, FeeTransaction
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    HostelBedAllocation, HostelFineRecord
)
from app.services.hostel_fee_service import record_hostel_fee_payment, record_hostel_fine_payment


class TestHostelConcurrencyRace(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app_context = self.app.app_context()
        self.app_context.push()

        u_id = uuid.uuid4().hex[:6]
        # Create isolated school and users
        self.school = School(name=f"Race Test School {u_id}", code=f"RC_{u_id}", is_active=True, current_session="2024-25")
        db.session.add(self.school)
        db.session.flush()

        self.warden1 = User(name="Warden 1", email=f"w1_{u_id}@test.com", role=UserRole.HOSTEL, school_id=self.school.id)
        self.warden1.set_password("Warden@123")
        self.warden2 = User(name="Warden 2", email=f"w2_{u_id}@test.com", role=UserRole.HOSTEL, school_id=self.school.id)
        self.warden2.set_password("Warden@123")
        self.stud_u = User(name="Race Student", email=f"st_{u_id}@test.com", role=UserRole.STUDENT, school_id=self.school.id)
        self.stud_u.set_password("Student@123")
        db.session.add_all([self.warden1, self.warden2, self.stud_u])
        db.session.flush()

        self.student = Student(user_id=self.stud_u.id, school_id=self.school.id, admission_no=f"RACE-{u_id}", session="2024-25")
        db.session.add(self.student)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        self.app_context.pop()

    def test_concurrent_fee_payment_double_spend_prevented(self):
        """Two wardens attempt to collect full payment for the exact same FeeRecord concurrently."""
        fee_rec = FeeRecord(
            school_id=self.school.id, student_id=self.student.id,
            fee_type='HOSTEL', source='HOSTEL', month='2026-08',
            amount_due=5000.0, amount_paid=0.0, status='PENDING', session='2024-25'
        )
        db.session.add(fee_rec)
        db.session.commit()
        rec_id = fee_rec.id

        results = []
        errors = []

        def pay_worker(warden_id, amount):
            with self.app.app_context():
                w = db.session.get(User, warden_id)
                rec = db.session.get(FeeRecord, rec_id)
                try:
                    res, txn = record_hostel_fee_payment(
                        rec,
                        amount,
                        payment_mode='UPI',
                        collected_by_user=w
                    )
                    db.session.commit()
                    results.append(res)
                except Exception as e:
                    db.session.rollback()
                    errors.append(str(e))

        # Launch 2 simultaneous threads
        t1 = threading.Thread(target=pay_worker, args=(self.warden1.id, 5000.0))
        t2 = threading.Thread(target=pay_worker, args=(self.warden2.id, 5000.0))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Assert exactly one succeeded and one was blocked
        db.session.expire_all()
        refreshed_rec = db.session.get(FeeRecord, rec_id)
        self.assertEqual(refreshed_rec.amount_paid, 5000.0)
        self.assertEqual(refreshed_rec.status, 'PAID')

        txns = FeeTransaction.query.filter_by(fee_record_id=rec_id).all()
        self.assertEqual(len(txns), 1, "Exactly one transaction must be logged; double payment must be rejected")
        print("\n[SUCCESS] Concurrent double-spend attempt strictly blocked by backend transactional checks.")


if __name__ == '__main__':
    unittest.main()
