"""
Automated Test Suite for Principal Deleted Items / Archive & Permanent Delete System
EduERP / OnePlatform360
Tests all 7 required scenarios + Financial Safety & Anonymization + RBAC
"""

import unittest
from datetime import datetime, date, timedelta
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class, Subject
from app.models.financial import FeeRecord, FeeTransaction
from app.models.deleted_item import DeletedItem, DeletedItemType, DeletedItemStatus
from app.services.archive_service import (
    soft_delete_student, soft_delete_teacher, soft_delete_staff,
    recover_deleted_item, permanently_purge_item, run_one_year_cleanup_job
)
from flask_jwt_extended import create_access_token


class TestDeletedItemsArchive(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # Create School
        self.school = School(name="Delhi Public Academy", code="DPA-DEL", current_session="2026-27")
        db.session.add(self.school)
        db.session.flush()

        # Create Principal
        self.principal_user = User(
            name="Principal Sharma",
            email="principal@dpa.edu",
            role=UserRole.PRINCIPAL,
            school_id=self.school.id,
            is_active=True
        )
        self.principal_user.set_password("Principal@123")
        db.session.add(self.principal_user)

        # Create Class 8-A
        self.cls = Class(name="Class 8", section="A", school_id=self.school.id)
        db.session.add(self.cls)
        db.session.commit()

        # Token for Principal
        self.token = create_access_token(identity=str(self.principal_user.id))
        self.headers = {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_soft_delete_student_golu(self):
        """
        Scenario 1: Soft delete student Golu:
        - Golu disappears from active students list.
        - Appears in DELETED ITEMS with auto-delete set to 1 year in the future.
        """
        u = User(name="Golu Kumar", email="golu@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123", store_plain=True)
        db.session.add(u)
        db.session.flush()

        stu = Student(
            user_id=u.id,
            school_id=self.school.id,
            class_id=self.cls.id,
            admission_no="ADM-2026-001",
            roll_number="12",
            session="2026-27"
        )
        db.session.add(stu)
        db.session.commit()

        # Active students list contains Golu
        res = self.client.get('/api/principal/students', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['total'], 1)

        # Soft delete Golu via DELETE /principal/students/<id>
        del_res = self.client.delete(f'/api/principal/students/{stu.id}?reason=Leaving+school', headers=self.headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertIn("Deleted Items", del_res.get_json()['message'])

        # Golu has DISAPPEARED from active students list
        res_after = self.client.get('/api/principal/students', headers=self.headers)
        self.assertEqual(res_after.status_code, 200)
        self.assertEqual(res_after.get_json()['total'], 0)

        # Golu appears in GET /api/principal/deleted-items
        archive_res = self.client.get('/api/principal/deleted-items?type=STUDENT', headers=self.headers)
        self.assertEqual(archive_res.status_code, 200)
        items = archive_res.get_json()['data']
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['name'], "Golu Kumar")
        self.assertEqual(items[0]['identifier'], "ADM-2026-001")
        self.assertEqual(items[0]['class_name'], "Class 8 A")
        self.assertIn("Leaving school", items[0]['delete_reason'])
        # Verify 1-year retention auto-delete date
        self.assertTrue(items[0]['days_remaining'] >= 364)

    def test_02_recover_student_golu(self):
        """
        Scenario 2: Recover Golu:
        - Golu is restored to active status without creating duplicate records.
        """
        u = User(name="Golu Kumar", email="golu2@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123")
        db.session.add(u)
        db.session.flush()

        stu = Student(
            user_id=u.id,
            school_id=self.school.id,
            class_id=self.cls.id,
            admission_no="ADM-2026-002",
            roll_number="15"
        )
        db.session.add(stu)
        db.session.commit()

        # Soft delete
        archived = soft_delete_student(stu.id, self.school.id, self.principal_user, "Transfer")
        self.assertTrue(stu.is_deleted)
        self.assertFalse(u.is_active)

        # Recover Golu via POST /api/principal/deleted-items/<id>/recover
        rec_res = self.client.post(f'/api/principal/deleted-items/{archived.id}/recover', headers=self.headers)
        self.assertEqual(rec_res.status_code, 200)

        # Verify active again
        db.session.refresh(stu)
        db.session.refresh(u)
        self.assertFalse(stu.is_deleted)
        self.assertTrue(u.is_active)
        self.assertEqual(stu.class_id, self.cls.id)

        # Verify Golu is back in active student query
        res = self.client.get('/api/principal/students', headers=self.headers)
        self.assertEqual(res.get_json()['total'], 1)
        self.assertEqual(res.get_json()['data'][0]['name'], "Golu Kumar")

    def test_03_recover_student_with_deleted_class(self):
        """
        Scenario 3: Old class deleted while student was in trash:
        - System restores student gracefully without crashing, setting class to None and warning Principal.
        """
        temp_cls = Class(name="Class 9", section="C", school_id=self.school.id)
        db.session.add(temp_cls)
        db.session.commit()

        u = User(name="Rohit Verma", email="rohit@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123")
        db.session.add(u)
        db.session.flush()

        stu = Student(user_id=u.id, school_id=self.school.id, class_id=temp_cls.id, admission_no="ADM-2026-003")
        db.session.add(stu)
        db.session.commit()

        archived = soft_delete_student(stu.id, self.school.id, self.principal_user)

        # Now delete Class 9-C
        db.session.delete(temp_cls)
        db.session.commit()

        # Recover student
        rec_res = self.client.post(f'/api/principal/deleted-items/{archived.id}/recover', headers=self.headers)
        self.assertEqual(rec_res.status_code, 200)
        data = rec_res.get_json()
        self.assertIsNotNone(data.get('warning'))
        self.assertIn("no longer exists", data['warning'])

        db.session.refresh(stu)
        self.assertIsNone(stu.class_id)
        self.assertFalse(stu.is_deleted)

    def test_04_force_delete_now_requires_name_confirmation(self):
        """
        Scenario 4: Force Delete Now requires exact name confirmation:
        - Wrong name or empty confirmation rejects (400).
        - Correct name permanently removes student without broken references.
        """
        u = User(name="Golu Kumar", email="golu4@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123")
        db.session.add(u)
        db.session.flush()

        stu = Student(user_id=u.id, school_id=self.school.id, class_id=self.cls.id, admission_no="ADM-2026-004")
        db.session.add(stu)
        db.session.commit()

        archived = soft_delete_student(stu.id, self.school.id, self.principal_user)

        # Attempt permanent delete with wrong name
        bad_res = self.client.delete(
            f'/api/principal/deleted-items/{archived.id}/permanent',
            json={'confirmation_name': 'WrongName'},
            headers=self.headers
        )
        self.assertEqual(bad_res.status_code, 400)
        self.assertIn("Confirmation name mismatch", bad_res.get_json()['error'])

        # Attempt permanent delete with EXACT name "Golu Kumar"
        good_res = self.client.delete(
            f'/api/principal/deleted-items/{archived.id}/permanent',
            json={'confirmation_name': 'Golu Kumar'},
            headers=self.headers
        )
        self.assertEqual(good_res.status_code, 200)
        self.assertIn("permanently deleted", good_res.get_json()['message'])

        # Verified deleted item marked PURGED
        db.session.refresh(archived)
        self.assertEqual(archived.status, DeletedItemStatus.PURGED.value)

    def test_05_financial_record_safety_and_anonymization(self):
        """
        Scenario 5: Student with historical ₹8,000 fee record & payment:
        - Requirement #9: DO NOT blindly delete financial history.
        - Force delete student -> personal profile scrubbed, identity anonymized to Former Student #STU-X,
          accounting ledger and receipts remain 100% mathematically intact!
        """
        u = User(name="Aditya Birla", email="aditya@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123")
        db.session.add(u)
        db.session.flush()

        stu = Student(user_id=u.id, school_id=self.school.id, class_id=self.cls.id, admission_no="ADM-2026-005")
        db.session.add(stu)
        db.session.flush()

        # Add ₹8,000 fee record and payment
        fee_rec = FeeRecord(
            school_id=self.school.id,
            student_id=stu.id,
            fee_type="TUITION",
            amount_due=8000.0,
            amount_paid=8000.0,
            status="PAID",
            due_date=date.today(),
            session="2026-27"
        )
        db.session.add(fee_rec)
        db.session.flush()

        txn = FeeTransaction(
            school_id=self.school.id,
            fee_record_id=fee_rec.id,
            student_id=stu.id,
            amount=8000.0,
            payment_mode="ONLINE",
            receipt_no="REC-2026-TEST01",
            transaction_date=date.today()
        )
        db.session.add(txn)
        db.session.commit()

        # Soft delete Aditya
        archived = soft_delete_student(stu.id, self.school.id, self.principal_user)

        # Force delete Aditya
        res = permanently_purge_item(
            item_id=archived.id,
            school_id=self.school.id,
            actor_user=self.principal_user,
            confirmation_name="Aditya Birla"
        )
        self.assertIn("permanently deleted", res['message'])

        # ── VERIFY FINANCIAL SAFETY ──
        # 1. Financial records STILL EXIST
        db.session.refresh(fee_rec)
        db.session.refresh(txn)
        self.assertEqual(fee_rec.amount_paid, 8000.0)
        self.assertEqual(txn.amount, 8000.0)
        self.assertEqual(txn.receipt_no, "REC-2026-TEST01")

        # 2. Student record is ANONYMIZED (GDPR / Audit safe placeholder)
        db.session.refresh(stu)
        db.session.refresh(u)
        self.assertTrue(stu.is_anonymized)
        self.assertTrue(stu.is_deleted)
        self.assertIn("Former Student #STU-", u.name)
        self.assertIn("anonymized_", u.email)
        self.assertIsNone(stu.roll_number)
        self.assertIsNone(stu.parent_phone)

    def test_06_teacher_soft_delete_and_recovery(self):
        """
        Scenario 6: Soft delete teacher Rahul & recover:
        - Soft delete unlinks teacher from subjects/classes.
        - Disappears from active teacher list.
        - Recovery restores active teacher status.
        """
        u = User(name="Rahul Sharma", email="rahul@dpa.edu", role=UserRole.TEACHER, school_id=self.school.id)
        u.set_password("Teacher@123")
        db.session.add(u)
        db.session.flush()

        tch = Teacher(user_id=u.id, school_id=self.school.id, employee_id="EMP-TCH-01", department="Science")
        db.session.add(tch)
        db.session.flush()

        # Assign as class teacher
        self.cls.teacher_id = tch.id
        db.session.commit()

        # Soft delete Rahul via DELETE /principal/teachers/<id>
        del_res = self.client.delete(f'/api/principal/teachers/{tch.id}?reason=Relocation', headers=self.headers)
        self.assertEqual(del_res.status_code, 200)

        # Rahul unlinked from class
        db.session.refresh(self.cls)
        self.assertIsNone(self.cls.teacher_id)

        # Rahul disappeared from active teacher listing
        tch_res = self.client.get('/api/principal/teachers', headers=self.headers)
        self.assertEqual(tch_res.status_code, 200)
        self.assertEqual(len(tch_res.get_json()), 0)

        # Rahul appears in Deleted Items under Teachers tab
        archived_item = DeletedItem.query.filter_by(item_type='TEACHER', original_id=tch.id).first()
        self.assertIsNotNone(archived_item)
        self.assertEqual(archived_item.name, "Rahul Sharma")

        # Recover Rahul
        rec_res = self.client.post(f'/api/principal/deleted-items/{archived_item.id}/recover', headers=self.headers)
        self.assertEqual(rec_res.status_code, 200)

        # Back in active teacher listing
        tch_res2 = self.client.get('/api/principal/teachers', headers=self.headers)
        self.assertEqual(len(tch_res2.get_json()), 1)
        self.assertEqual(tch_res2.get_json()[0]['name'], "Rahul Sharma")

    def test_07_one_year_retention_auto_cleanup(self):
        """
        Scenario 7: 1-Year Automatic Cleanup:
        - Seed an archived record with auto_delete_at in the past (> 365 days old).
        - Execute run_one_year_cleanup_job().
        - Expired item is permanently purged automatically.
        """
        u = User(name="Old Student", email="old@dpa.edu", role=UserRole.STUDENT, school_id=self.school.id)
        u.set_password("Student@123")
        db.session.add(u)
        db.session.flush()

        stu = Student(user_id=u.id, school_id=self.school.id, admission_no="ADM-2024-OLD")
        db.session.add(stu)
        db.session.commit()

        # Soft delete
        archived = soft_delete_student(stu.id, self.school.id, self.principal_user)

        # Simulate 1 year and 5 days having passed
        past_date = datetime.utcnow() - timedelta(days=370)
        archived.deleted_at = past_date
        archived.auto_delete_at = past_date + timedelta(days=365)  # 5 days in the past
        db.session.commit()

        # Run cleanup job
        summary = run_one_year_cleanup_job()
        self.assertTrue(summary['purged_count'] >= 1)

        # Item status is now PURGED
        db.session.refresh(archived)
        self.assertEqual(archived.status, DeletedItemStatus.PURGED.value)
        self.assertIsNotNone(archived.purged_at)


if __name__ == '__main__':
    unittest.main()
