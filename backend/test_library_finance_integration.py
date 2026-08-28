import unittest
import os
from datetime import date, timedelta
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student, Class
from app.models.library import (
    BookCategory, Book, BookCopy, LibraryMember, BookIssue,
    BookReservation, FineTransaction, LibrarySettings
)
from app.models.financial import FeeRecord, FeeTransaction
from flask_jwt_extended import create_access_token


class LibraryFinanceIntegrationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

    def setUp(self):
        with self.app.app_context():
            db.create_all()
            # Clean tables
            for table in reversed(db.metadata.sorted_tables):
                db.session.execute(table.delete())
            db.session.commit()

            # Create School 1 & School 2
            school1 = School(name="Delhi Public School", code="DPS01")
            school2 = School(name="St. Xavier High School", code="STX02")
            db.session.add_all([school1, school2])
            db.session.commit()

            # Create Users
            p1 = User(name="Principal DPS", email="principal1@dps.com", role=UserRole.PRINCIPAL, school_id=school1.id)
            l1 = User(name="Librarian DPS", email="librarian1@dps.com", role=UserRole.LIBRARIAN, school_id=school1.id)
            s1 = User(name="Rahul Sharma", email="rahul@dps.com", role=UserRole.STUDENT, school_id=school1.id)

            p2 = User(name="Principal STX", email="principal2@stx.com", role=UserRole.PRINCIPAL, school_id=school2.id)
            s2 = User(name="Amit Kumar", email="amit@stx.com", role=UserRole.STUDENT, school_id=school2.id)

            for u in [p1, l1, s1, p2, s2]:
                u.set_password("Password123!")
            db.session.add_all([p1, l1, s1, p2, s2])
            db.session.commit()

            # Create Class & Student records
            cls1 = Class(school_id=school1.id, name="Class 10", section="A")
            db.session.add(cls1)
            db.session.commit()

            st1 = Student(
                school_id=school1.id, user_id=s1.id,
                class_id=cls1.id, roll_number="101"
            )
            st2 = Student(
                school_id=school2.id, user_id=s2.id,
                roll_number="201"
            )
            db.session.add_all([st1, st2])
            db.session.commit()

            # Create Library Members
            mem1 = LibraryMember(
                school_id=school1.id, user_id=s1.id,
                card_number="LIB-DPS-001", member_type="STUDENT", status="ACTIVE"
            )
            mem2 = LibraryMember(
                school_id=school2.id, user_id=s2.id,
                card_number="LIB-STX-001", member_type="STUDENT", status="ACTIVE"
            )
            db.session.add_all([mem1, mem2])
            db.session.commit()

            # Create Library Settings
            settings1 = LibrarySettings(
                school_id=school1.id,
                fine_per_day=5.0,
                max_fine_cap=100.0,
                issue_duration_days=7
            )
            db.session.add(settings1)
            db.session.commit()

            # Create Book & Copies
            bk1 = Book(
                school_id=school1.id, title="Concepts of Physics Vol 1",
                author="H.C. Verma", mrp=450.0, purchase_price=380.0
            )
            db.session.add(bk1)
            db.session.commit()

            cp1 = BookCopy(
                book_id=bk1.id, school_id=school1.id,
                copy_accession_no="ACC-DPS-001", barcode="8901234567001",
                status="AVAILABLE"
            )
            cp2 = BookCopy(
                book_id=bk1.id, school_id=school1.id,
                copy_accession_no="ACC-DPS-002", barcode="8901234567002",
                status="AVAILABLE"
            )
            db.session.add_all([cp1, cp2])
            db.session.commit()

            self.school1_id = school1.id
            self.school2_id = school2.id
            self.principal1_id = p1.id
            self.librarian1_id = l1.id
            self.student1_id = s1.id
            self.principal2_id = p2.id
            self.student2_id = s2.id
            self.member1_id = mem1.id
            self.member2_id = mem2.id
            self.book1_id = bk1.id
            self.copy1_id = cp1.id
            self.copy2_id = cp2.id
            self.student_rec_id = st1.id

    def _auth_headers(self, user_id):
        with self.app.app_context():
            token = create_access_token(identity=str(user_id))
            return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    def test_overdue_fine_creates_outstanding_and_syncs_fee_record(self):
        """Rule 1: Late return must create OUTSTANDING fine (not paid) and link to FeeRecord."""
        with self.app.app_context():
            issue = BookIssue(
                school_id=self.school1_id, copy_id=self.copy1_id, book_id=self.book1_id,
                member_id=self.member1_id, issue_date=date.today() - timedelta(days=17),
                due_date=date.today() - timedelta(days=10), status="ISSUED"
            )
            copy = BookCopy.query.get(self.copy1_id)
            copy.status = "ISSUED"
            db.session.add(issue)
            db.session.commit()
            issue_id = issue.id

        headers = self._auth_headers(self.librarian1_id)
        res = self.client.post('/api/library/return', json={'issue_id': issue_id}, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn('fine', data)
        fine_data = data['fine']
        self.assertEqual(fine_data['status'], 'OUTSTANDING')
        self.assertEqual(fine_data['paid_amount'], 0.0)
        self.assertEqual(fine_data['outstanding_amount'], 50.0)  # 10 days * ₹5/day = ₹50

        with self.app.app_context():
            rec = FeeRecord.query.filter_by(source='LIBRARY', source_ref_id=fine_data['id']).first()
            self.assertIsNotNone(rec)
            self.assertEqual(rec.amount_due, 50.0)
            self.assertEqual(rec.amount_paid, 0.0)
            self.assertEqual(rec.status, 'PENDING')

    def test_pay_fine_via_fee_management_reflects_in_library_with_double_payment_block(self):
        """Rule 2: Payment in Fee Management reflects immediately in Library and blocks double payment."""
        with self.app.app_context():
            fine = FineTransaction(
                school_id=self.school1_id, member_id=self.member1_id,
                reason='OVERDUE', amount=50.0, amount_paid=0.0, status='OUTSTANDING'
            )
            db.session.add(fine)
            db.session.commit()

            fee_rec = FeeRecord(
                school_id=self.school1_id, student_id=self.student_rec_id,
                fee_type='LIBRARY', source='LIBRARY', source_ref_id=fine.id,
                amount_due=50.0, amount_paid=0.0, status='PENDING'
            )
            db.session.add(fee_rec)
            db.session.commit()
            fee_rec_id = fee_rec.id
            fine_id = fine.id

        # 1. Principal collects fee in Fee Management
        p_headers = self._auth_headers(self.principal1_id)
        res = self.client.post('/api/principal/fees/collect', json={
            'record_id': fee_rec_id,
            'amount_paid': 50.0,
            'payment_mode': 'CASH'
        }, headers=p_headers)
        self.assertEqual(res.status_code, 200)

        # 2. Check Library Fine status
        with self.app.app_context():
            updated_fine = FineTransaction.query.get(fine_id)
            self.assertEqual(updated_fine.status, 'PAID')
            self.assertEqual(updated_fine.amount_paid, 50.0)
            self.assertEqual(updated_fine.outstanding_amount, 0.0)

        # 3. Librarian attempts to collect same fine -> MUST BE BLOCKED (Double Payment Protection)
        l_headers = self._auth_headers(self.librarian1_id)
        res2 = self.client.post(f'/api/library/fines/{fine_id}/collect', json={'amount': 50.0}, headers=l_headers)
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already settled', res2.get_json()['error'].lower())

    def test_pay_fine_via_library_creates_fee_transaction_and_syncs_fee_record(self):
        """Rule 3: Payment in Library creates FeeTransaction and marks FeeRecord as PAID."""
        with self.app.app_context():
            fine = FineTransaction(
                school_id=self.school1_id, member_id=self.member1_id,
                reason='DAMAGED', amount=100.0, amount_paid=0.0, status='OUTSTANDING'
            )
            db.session.add(fine)
            db.session.commit()
            fine_id = fine.id

        # Librarian collects fine in Library
        l_headers = self._auth_headers(self.librarian1_id)
        res = self.client.post(f'/api/library/fines/{fine_id}/collect', json={
            'amount': 100.0,
            'payment_mode': 'UPI',
            'remarks': 'Paid at library counter'
        }, headers=l_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'PAID')
        self.assertEqual(data['outstanding_amount'], 0.0)

        # Verify FeeRecord and FeeTransaction in Finance
        with self.app.app_context():
            rec = FeeRecord.query.filter_by(source='LIBRARY', source_ref_id=fine_id).first()
            self.assertIsNotNone(rec)
            self.assertEqual(rec.status, 'PAID')
            self.assertEqual(rec.amount_paid, 100.0)

            txns = FeeTransaction.query.filter_by(fee_record_id=rec.id).all()
            self.assertEqual(len(txns), 1)
            self.assertEqual(txns[0].amount, 100.0)
            self.assertEqual(txns[0].payment_mode, 'UPI')

    def test_fine_waiver(self):
        """Rule 4: Fine waiver updates status to WAIVED, stores audit trail, and syncs FeeRecord."""
        with self.app.app_context():
            fine = FineTransaction(
                school_id=self.school1_id, member_id=self.member1_id,
                reason='LOST', amount=200.0, amount_paid=0.0, status='OUTSTANDING'
            )
            db.session.add(fine)
            db.session.commit()
            fine_id = fine.id

        p_headers = self._auth_headers(self.principal1_id)
        res = self.client.post(f'/api/library/fines/{fine_id}/waive', json={
            'reason': 'Genuine medical emergency during exam week'
        }, headers=p_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'WAIVED')
        self.assertEqual(data['waived_amount'], 200.0)
        self.assertEqual(data['outstanding_amount'], 0.0)
        self.assertIn('medical emergency', data['waive_reason'])

    def test_multi_tenant_cross_school_isolation(self):
        """Rule 5: Multi-tenant security prevents School 2 from seeing or modifying School 1 records."""
        with self.app.app_context():
            fine = FineTransaction(
                school_id=self.school1_id, member_id=self.member1_id,
                reason='OVERDUE', amount=50.0, status='OUTSTANDING'
            )
            db.session.add(fine)
            db.session.commit()
            fine_id = fine.id

        # Principal of School 2 tries to collect fine of School 1
        headers2 = self._auth_headers(self.principal2_id)
        res = self.client.post(f'/api/library/fines/{fine_id}/collect', json={'amount': 50.0}, headers=headers2)
        self.assertEqual(res.status_code, 403)

        # Principal of School 2 lists fines -> should be empty
        res_list = self.client.get('/api/library/fines', headers=headers2)
        self.assertEqual(res_list.status_code, 200)
        self.assertEqual(len(res_list.get_json()), 0)

    def test_student_self_service_my_library(self):
        """Rule 6: Student accesses their own loans, fines, and reservations."""
        with self.app.app_context():
            issue = BookIssue(
                school_id=self.school1_id, copy_id=self.copy1_id, book_id=self.book1_id,
                member_id=self.member1_id, issue_date=date.today() - timedelta(days=2),
                due_date=date.today() + timedelta(days=5), status="ISSUED"
            )
            db.session.add(issue)
            db.session.commit()

        s_headers = self._auth_headers(self.student1_id)
        res = self.client.get('/api/library/my-library', headers=s_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data['currently_issued']), 1)
        self.assertEqual(data['currently_issued'][0]['book_title'], 'Concepts of Physics Vol 1')
        self.assertEqual(data['summary']['issued_count'], 1)


if __name__ == '__main__':
    unittest.main()
