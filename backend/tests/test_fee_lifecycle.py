"""
Automated Test Suite for Academic Session Fee Preparation, Mapping, Payment Cadence, and Admission Lifecycle
Tests:
1. FeeStructureV2 Draft vs Published lifecycle & versioning
2. Bulk cloning FeeStructureV2 across multiple classes
3. Session-to-session fee plan copying without mutating past sessions
4. Payment Plans & Advance Discounts with category eligibility
5. Academic Session Fee Readiness Scorecard
6. Admission Fee Plan API
7. New Admission end-to-end integration:
   - Auto-loading published fee structure
   - Advance payment discount calculation
   - Authorized manual waiver with mandatory reason
   - Receipt generation and ledger credit
"""

import unittest
from datetime import date
from app import create_app, db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.financial import FeeRecord
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2,
    FeePaymentPlan, StudentConcession, StudentLedger, FeePayment
)
from app.services.fee_ledger_service import ensure_default_fee_heads


class FeeLifecycleTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School
        self.school = School(
            name="Apex World School",
            code="AWS01",
            address="Vasant Kunj, New Delhi",
            phone="011-26890001",
            email="admin@apexworld.edu.in"
        )
        db.session.add(self.school)
        db.session.commit()

        # Seed Principal
        self.principal = User(
            name="Dr. Sunita Kapoor",
            email="principal@apexworld.edu.in",
            role="PRINCIPAL",
            school_id=self.school.id
        )
        self.principal.set_password("Password@123")
        db.session.add(self.principal)

        # Seed Classes
        self.class1 = Class(name="Class 1", section="A", school_id=self.school.id)
        self.class2 = Class(name="Class 2", section="A", school_id=self.school.id)
        self.class3 = Class(name="Class 3", section="A", school_id=self.school.id)
        db.session.add_all([self.class1, self.class2, self.class3])
        db.session.commit()

        # Seed standard fee heads
        ensure_default_fee_heads(self.school.id)
        self.tuition_head = FeeHead.query.filter_by(school_id=self.school.id, code='TUITION').first()
        self.adm_head = FeeHead.query.filter_by(school_id=self.school.id, code='ADMISSION').first()

        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def _login_token(self):
        res = self.client.post('/api/auth/login', json={
            'email': 'principal@apexworld.edu.in',
            'password': 'Password@123'
        })
        return res.get_json().get('access_token')

    def test_fee_structure_draft_and_published_lifecycle(self):
        """Test creating a structure in DRAFT, checking publish_status, and toggling to PUBLISHED."""
        token = self._login_token()
        headers = {'Authorization': f'Bearer {token}'}

        # Create DRAFT structure
        res = self.client.post('/api/fees-finance/structures', headers=headers, json={
            'name': 'Class 1 Draft Plan 2026-27',
            'session': '2026-27',
            'class_id': self.class1.id,
            'frequency': 'MONTHLY',
            'publish_status': 'DRAFT',
            'items': [
                {'fee_head_id': self.tuition_head.id, 'amount': 3000.0},
                {'fee_head_id': self.adm_head.id, 'amount': 5000.0}
            ]
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['publish_status'], 'DRAFT')
        self.assertFalse(data['is_published'])
        self.assertEqual(data['total_amount'], 8000.0)
        struct_id = data['id']

        # Toggle to PUBLISHED
        res_pub = self.client.patch(f'/api/fees-finance/structures/{struct_id}/publish', headers=headers, json={
            'publish_status': 'PUBLISHED'
        })
        self.assertEqual(res_pub.status_code, 200)
        self.assertEqual(res_pub.get_json()['structure']['publish_status'], 'PUBLISHED')
        self.assertTrue(res_pub.get_json()['structure']['is_published'])

    def test_bulk_clone_structure_to_classes(self):
        """Test cloning a fee structure to other classes in bulk."""
        token = self._login_token()
        headers = {'Authorization': f'Bearer {token}'}

        # Create template structure for Class 1
        st = FeeStructureV2(
            school_id=self.school.id,
            class_id=self.class1.id,
            session='2026-27',
            name='Class 1 Master Plan 2026-27',
            frequency='MONTHLY',
            publish_status='PUBLISHED',
            created_by=self.principal.id
        )
        db.session.add(st)
        db.session.flush()
        db.session.add(FeeStructureItemV2(structure_id=st.id, fee_head_id=self.tuition_head.id, amount=4000.0))
        db.session.commit()

        # Clone to Class 2 and Class 3
        res = self.client.post(f'/api/fees-finance/structures/{st.id}/clone-to-classes', headers=headers, json={
            'target_class_ids': [self.class2.id, self.class3.id],
            'session': '2026-27',
            'publish_now': True
        })
        self.assertEqual(res.status_code, 201)
        cloned = res.get_json()['structures']
        self.assertEqual(len(cloned), 2)
        for s in cloned:
            self.assertEqual(s['publish_status'], 'PUBLISHED')
            self.assertEqual(s['total_amount'], 4000.0)
            self.assertEqual(s['copied_from_id'], st.id)

    def test_copy_session_fee_structures(self):
        """Test copying entire academic session structures to next year as DRAFT."""
        token = self._login_token()
        headers = {'Authorization': f'Bearer {token}'}

        # Create 2025-26 structure
        st = FeeStructureV2(
            school_id=self.school.id,
            class_id=self.class1.id,
            session='2025-26',
            name='Class 1 Fee Plan 2025-26',
            frequency='MONTHLY',
            publish_status='PUBLISHED'
        )
        db.session.add(st)
        db.session.flush()
        db.session.add(FeeStructureItemV2(structure_id=st.id, fee_head_id=self.tuition_head.id, amount=3500.0))
        db.session.commit()

        # Copy to 2026-27 as DRAFT
        res = self.client.post('/api/fees-finance/structures/copy-session', headers=headers, json={
            'from_session': '2025-26',
            'to_session': '2026-27',
            'as_draft': True
        })
        self.assertEqual(res.status_code, 201)
        copied = res.get_json()['structures']
        self.assertEqual(len(copied), 1)
        self.assertEqual(copied[0]['session'], '2026-27')
        self.assertEqual(copied[0]['publish_status'], 'DRAFT')
        self.assertEqual(copied[0]['total_amount'], 3500.0)

        # Ensure original 2025-26 remains untouched
        orig = FeeStructureV2.query.filter_by(id=st.id).first()
        self.assertEqual(orig.session, '2025-26')
        self.assertEqual(orig.publish_status, 'PUBLISHED')

    def test_payment_plans_and_readiness_scorecard(self):
        """Test payment plans auto-seeding and academic session readiness scorecard."""
        token = self._login_token()
        headers = {'Authorization': f'Bearer {token}'}

        # Check readiness before any published structure
        res_r = self.client.get('/api/fees-finance/readiness?session=2026-27', headers=headers)
        self.assertEqual(res_r.status_code, 200)
        data_r = res_r.get_json()
        self.assertFalse(data_r['is_ready_for_admissions'])
        self.assertEqual(data_r['missing_classes_count'], 3)
        self.assertGreaterEqual(data_r['payment_plans_count'], 4) # Auto-seeded default plans

        # Publish plan for all 3 classes
        for c in [self.class1, self.class2, self.class3]:
            st = FeeStructureV2(
                school_id=self.school.id, class_id=c.id, session='2026-27',
                name=f"{c.name} Plan 2026-27", publish_status='PUBLISHED'
            )
            db.session.add(st)
            db.session.flush()
            db.session.add(FeeStructureItemV2(structure_id=st.id, fee_head_id=self.tuition_head.id, amount=3000.0))
        db.session.commit()

        # Re-check readiness
        res_r2 = self.client.get('/api/fees-finance/readiness?session=2026-27', headers=headers)
        data_r2 = res_r2.get_json()
        self.assertTrue(data_r2['is_ready_for_admissions'])
        self.assertEqual(data_r2['published_classes_count'], 3)
        self.assertEqual(data_r2['missing_classes_count'], 0)

    def test_new_admission_dynamic_fee_calculation_and_payment(self):
        """Test admitting a student with quarterly advance payment plan, 5% advance discount, manual waiver, and receipt."""
        token = self._login_token()
        headers = {'Authorization': f'Bearer {token}'}

        # Setup published fee plan for Class 1:
        # Tuition: 3000/month, Admission: 5000 one-time
        st = FeeStructureV2(
            school_id=self.school.id,
            class_id=self.class1.id,
            session='2026-27',
            name='Class 1 Plan 2026-27',
            frequency='MONTHLY',
            publish_status='PUBLISHED'
        )
        db.session.add(st)
        db.session.flush()
        db.session.add(FeeStructureItemV2(structure_id=st.id, fee_head_id=self.tuition_head.id, amount=3000.0))
        db.session.add(FeeStructureItemV2(structure_id=st.id, fee_head_id=self.adm_head.id, amount=5000.0))
        db.session.commit()

        # Fetch admission fee plan for Class 1
        res_plan = self.client.get(f'/api/fees-finance/admission-fee-plan?class_id={self.class1.id}&session=2026-27', headers=headers)
        self.assertEqual(res_plan.status_code, 200)
        p_data = res_plan.get_json()
        self.assertTrue(p_data['has_published_plan'])
        self.assertIsNotNone(p_data['class_fee_structure'])

        # Find quarterly payment plan (3 months, 5% discount on ACADEMIC)
        q_plan = next((p for p in p_data['payment_plans'] if p['code'] == 'QUARTERLY'), None)
        self.assertIsNotNone(q_plan)
        self.assertEqual(q_plan['months_count'], 3)
        self.assertEqual(q_plan['discount_value'], 5.0)

        # Calculation breakdown:
        # Tuition = 3000 * 3 = 9000
        # Admission = 5000 (one-time)
        # Gross = 14000
        # 5% discount on 14000 (both ACADEMIC) = 700.0
        # Manual waiver = 300.0
        # Net payable = 14000 - 700 - 300 = 13000.0

        # Submit new admission with fee_setup
        res_adm = self.client.post('/api/principal/students', headers=headers, json={
            'name': 'Aarav Mehta',
            'gender': 'Male',
            'dob': '2019-05-15',
            'class_id': self.class1.id,
            'session': '2026-27',
            'parent_name': 'Rajesh Mehta',
            'parent_phone': '9876543210',
            'fee_setup': {
                'fee_structure_id': st.id,
                'payment_plan_id': q_plan['id'],
                'manual_waiver': 300.0,
                'waiver_reason': 'Merit Scholarship Consideration',
                'payment_mode': 'UPI',
                'payment_status': 'PAID',
                'initial_payment_amount': 13000.0,
                'payment_reference': 'UPI-REF-998877'
            }
        })
        self.assertEqual(res_adm.status_code, 201)
        adm_res = res_adm.get_json()
        student_id = adm_res['id']
        self.assertIsNotNone(adm_res.get('fee_summary'))

        fee_sum = adm_res['fee_summary']
        self.assertEqual(fee_sum['gross_total'], 14000.0)
        self.assertEqual(fee_sum['advance_discount'], 700.0)
        self.assertEqual(fee_sum['manual_waiver'], 300.0)
        self.assertEqual(fee_sum['net_payable'], 13000.0)
        self.assertEqual(fee_sum['amount_paid'], 13000.0)
        self.assertEqual(fee_sum['payment_status'], 'PAID')
        self.assertTrue(fee_sum['receipt_no'].startswith('REC-'))

        # Verify FeeRecord entries in DB
        records = FeeRecord.query.filter_by(student_id=student_id).all()
        self.assertEqual(len(records), 2) # Tuition and Admission
        total_paid_in_records = sum(r.amount_paid for r in records)
        self.assertEqual(total_paid_in_records, 13000.0)

        # Verify StudentLedger entry
        ledger_entry = StudentLedger.query.filter_by(student_id=student_id, reference_no=fee_sum['receipt_no']).first()
        self.assertIsNotNone(ledger_entry)
        self.assertEqual(ledger_entry.amount, 13000.0)
        self.assertEqual(ledger_entry.entry_type, 'CREDIT')

        # Verify StudentConcession entry for manual waiver
        conc = StudentConcession.query.filter_by(student_id=student_id).first()
        self.assertIsNotNone(conc)
        self.assertEqual(conc.discount_value, 300.0)
        self.assertEqual(conc.reason, 'Merit Scholarship Consideration')

        # Verify FeePayment receipt entry
        payment = FeePayment.query.filter_by(receipt_no=fee_sum['receipt_no']).first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.total_paid, 13000.0)
        self.assertEqual(payment.payment_mode, 'UPI')


if __name__ == '__main__':
    unittest.main()
