import pytest
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Student, StudentEnrollment, Class
from app.models.financial import FeeRecord
from app.models.fee_finance import StudentLedger, FeeBill
from app.models.migration import MigrationBatch, MigrationRecord
from app.services.fee_ledger_service import generate_fee_bill
from datetime import date


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        # Seed Super Admin
        sa = User(
            name='Platform Super Admin',
            email='superadmin@eduerp.com',
            role=UserRole.SUPER_ADMIN,
            is_active=True
        )
        sa.set_password('Admin@123')
        db.session.add(sa)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def get_token(client, identifier, password):
    res = client.post('/api/auth/login', json={'identifier': identifier, 'password': password})
    if res.status_code == 200:
        return res.get_json()['access_token']
    return None


def setup_migrating_school(client):
    sa_token = get_token(client, 'superadmin@eduerp.com', 'Admin@123')
    headers = {'Authorization': f'Bearer {sa_token}'}

    onboard_payload = {
        'name': 'Heritage Public Academy',
        'code': 'HPA01',
        'principal_name': 'Mr. R. K. Mishra',
        'principal_email': 'mishra@heritage.edu',
        'principal_phone': '9876543210',
        'principal_password': 'Mishra@123'
    }
    res = client.post('/api/admin/schools/onboard', json=onboard_payload, headers=headers)
    assert res.status_code == 201

    p_token = get_token(client, 'mishra@heritage.edu', 'Mishra@123')
    assert p_token is not None
    p_headers = {'Authorization': f'Bearer {p_token}'}

    return p_headers


class TestSchoolDataMigration:

    def test_01_sources_and_column_detection(self, client):
        headers = setup_migrating_school(client)

        # 1. Check sources endpoint
        src_res = client.get('/api/principal/migration/sources', headers=headers)
        assert src_res.status_code == 200
        data = src_res.get_json()
        assert len(data['sources']) >= 4
        assert any(s['id'] == 'EXCEL' for s in data['sources'])
        assert any(s['id'] == 'REGISTER' for s in data['sources'])

        # 2. Check template download
        tpl_res = client.get('/api/principal/migration/sample-template')
        assert tpl_res.status_code == 200
        assert 'Scholar No' in tpl_res.data.decode('utf-8')

    def test_02_legacy_admission_number_preservation_and_active_status(self, client, app):
        """
        Critical Rule: Existing students retain legacy admission numbers (e.g. 2019/0456)
        and are marked ACTIVE with enrollment_type='MIGRATED', never PROVISIONAL!
        """
        headers = setup_migrating_school(client)

        legacy_rows = [
            {
                'Scholar No': '2019/0456',
                'Student Name': 'Rohan Sharma',
                'Class': 'Class 7',
                'Section': 'A',
                'Roll No': '14',
                'Father Name': 'Kailash Sharma',
                'Mobile Number': '9876500001',
                'Opening Dues (Rs)': '8500',
                'Amount Paid (Rs)': '12000'
            },
            {
                'Scholar No': '2020/0812',
                'Student Name': 'Pooja Verma',
                'Class': 'Class 7',
                'Section': 'A',
                'Roll No': '15',
                'Father Name': 'Deepak Verma',
                'Mobile Number': '9876500002',
                'Opening Dues (Rs)': '0',
                'Amount Paid (Rs)': '20000'
            }
        ]

        mapping = {
            'admission_no': 'Scholar No',
            'name': 'Student Name',
            'class_name': 'Class',
            'section': 'Section',
            'roll_number': 'Roll No',
            'father_name': 'Father Name',
            'parent_phone': 'Mobile Number',
            'opening_balance': 'Opening Dues (Rs)',
            'legacy_paid_amount': 'Amount Paid (Rs)'
        }

        # Validate
        val_res = client.post('/api/principal/migration/validate', json={
            'rows': legacy_rows,
            'mapping': mapping,
            'session': '2026-27'
        }, headers=headers)
        assert val_res.status_code == 200
        val_data = val_res.get_json()
        assert val_data['valid_count'] == 2
        assert val_data['total_opening_dues'] == 8500.0

        # Execute Migration
        exec_res = client.post('/api/principal/migration/execute', json={
            'rows': legacy_rows,
            'mapping': mapping,
            'session': '2026-27',
            'source_type': 'EXCEL',
            'filename': 'Legacy_Students_2026.xlsx'
        }, headers=headers)
        assert exec_res.status_code == 201
        exec_data = exec_res.get_json()
        assert exec_data['imported_new'] == 2
        assert exec_data['total_opening_dues'] == 8500.0

        batch_id = exec_data['batch_id']

        # Verify DB Models & Business Rules
        with app.app_context():
            st1 = Student.query.filter_by(admission_no='2019/0456').first()
            assert st1 is not None, "Legacy admission number must be preserved!"
            assert st1.admission_no == '2019/0456'
            assert st1.status == 'ACTIVE', "Migrated student must be ACTIVE, never PROVISIONAL!"
            assert st1.is_first_school is False

            enr1 = StudentEnrollment.query.filter_by(student_id=st1.id).first()
            assert enr1 is not None
            assert enr1.enrollment_type == 'MIGRATED', "Enrollment type must be MIGRATED!"
            assert enr1.enrollment_status == 'ACTIVE'

            # Student 2
            st2 = Student.query.filter_by(admission_no='2020/0812').first()
            assert st2 is not None
            assert st2.status == 'ACTIVE'

            # Check Students Directory endpoint strictly includes migrated students
            dir_res = client.get('/api/principal/students', headers=headers)
            assert dir_res.status_code == 200
            dir_data = dir_res.get_json()['data']
            adm_nos = [d['admission_no'] for d in dir_data]
            assert '2019/0456' in adm_nos
            assert '2020/0812' in adm_nos

            # Check Provisional endpoint does NOT contain migrated students
            prov_res = client.get('/api/principal/students?status=PROVISIONAL', headers=headers)
            assert prov_res.status_code == 200
            assert len(prov_res.get_json()['data']) == 0

    def test_03_opening_balance_ledger_integration(self, client, app):
        """
        Critical Rule: Legacy opening balance is injected as OPENING_BALANCE FeeRecord & StudentLedger DEBIT.
        Future fee bills automatically carry it as previous_dues without fake invoices.
        """
        headers = setup_migrating_school(client)

        rows = [{
            'admission_no': '2018/0099',
            'name': 'Amitabh Roy',
            'class_name': 'Class 9',
            'section': 'A',
            'parent_phone': '9899887766',
            'opening_balance': '6200'
        }]
        mapping = {k: k for k in rows[0].keys()}

        client.post('/api/principal/migration/execute', json={
            'rows': rows,
            'mapping': mapping,
            'session': '2026-27'
        }, headers=headers)

        with app.app_context():
            student = Student.query.filter_by(admission_no='2018/0099').first()
            assert student is not None

            # 1. Verify FeeRecord
            ob_record = FeeRecord.query.filter_by(student_id=student.id, source='OPENING_BALANCE').first()
            assert ob_record is not None
            assert ob_record.amount_due == 6200.0
            assert ob_record.amount_paid == 0.0
            assert ob_record.status == 'PENDING'

            # 2. Verify StudentLedger DEBIT
            ledger = StudentLedger.query.filter_by(student_id=student.id, entry_type='DEBIT').first()
            assert ledger is not None
            assert ledger.amount == 6200.0
            assert 'Opening Balance' in ledger.period_label

            # 3. Future monthly fee generation carries forward opening balance as previous_dues
            actor = User.query.filter_by(email='mishra@heritage.edu').first()
            bill_res = generate_fee_bill(
                student_id=student.id,
                bill_month='2026-10',
                due_date=date(2026, 10, 10),
                actor_user=actor,
                session='2026-27'
            )
            bill = bill_res[0] if isinstance(bill_res, tuple) else bill_res
            assert bill is not None
            assert bill.previous_dues >= 6200.0, f"Expected previous_dues >= 6200, got {bill.previous_dues}"
            assert bill.total_payable >= 6200.0

    def test_04_reconciliation_and_spot_check(self, client):
        headers = setup_migrating_school(client)

        rows = [
            {'admission_no': 'SCH-01', 'name': 'Student One', 'class_name': 'Class 5', 'opening_balance': '1000'},
            {'admission_no': 'SCH-02', 'name': 'Student Two', 'class_name': 'Class 5', 'opening_balance': '2000'},
            {'admission_no': 'SCH-03', 'name': 'Student Three', 'class_name': 'Class 6', 'opening_balance': '1500'}
        ]
        mapping = {k: k for k in ['admission_no', 'name', 'class_name', 'opening_balance']}

        exec_res = client.post('/api/principal/migration/execute', json={
            'rows': rows,
            'mapping': mapping,
            'session': '2026-27',
            'filename': 'Test_Reconciliation.csv'
        }, headers=headers)
        assert exec_res.status_code == 201
        batch_id = exec_res.get_json()['batch_id']

        # 1. Check Reconciliation Report
        rec_res = client.get(f'/api/principal/migration/reconciliation/{batch_id}', headers=headers)
        assert rec_res.status_code == 200
        rec_data = rec_res.get_json()
        assert rec_data['is_reconciled'] is True
        assert rec_data['legacy']['total_students'] == 3
        assert rec_data['erp']['live_active_students'] == 3
        assert rec_data['legacy']['total_opening_dues'] == 4500.0
        assert rec_data['erp']['live_opening_due'] == 4500.0

        # 2. Check Spot-Check sample
        spot_res = client.get(f'/api/principal/migration/spot-check/{batch_id}?size=2', headers=headers)
        assert spot_res.status_code == 200
        spot_data = spot_res.get_json()
        assert len(spot_data['students']) == 2
        for s in spot_data['students']:
            assert s['matches'] is True
            assert s['erp']['status'] == 'ACTIVE'

    def test_05_manual_register_tabular_entry(self, client):
        headers = setup_migrating_school(client)

        manual_entries = [
            {
                'admission_no': 'REG-2024-001',
                'name': 'Nikhil Tiwari',
                'class_name': 'Class 10',
                'section': 'B',
                'roll_number': '09',
                'parent_phone': '9822334455',
                'opening_balance': 3000,
                'legacy_paid_amount': 15000
            }
        ]

        res = client.post('/api/principal/migration/manual-entry', json={
            'students': manual_entries,
            'session': '2026-27'
        }, headers=headers)
        assert res.status_code == 201
        data = res.get_json()
        assert data['imported_new'] == 1
        assert data['total_opening_dues'] == 3000.0
