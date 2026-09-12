import pytest
from app import create_app, db
from app.models.user import User, UserRole
from app.models.academic import Student, StudentEnrollment
from app.models.financial import FeeRecord


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
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


def setup_school_and_principal(client):
    sa_res = client.post('/api/auth/login', json={'identifier': 'superadmin@eduerp.com', 'password': 'Admin@123'})
    assert sa_res.status_code == 200
    sa_token = sa_res.get_json()['access_token']
    sa_headers = {'Authorization': f'Bearer {sa_token}'}

    onboard_res = client.post('/api/admin/schools/onboard', json={
        'name': 'Cambridge International School',
        'code': 'CIS101',
        'principal_name': 'Dr. A. K. Sharma',
        'principal_email': 'principal@cis.edu',
        'principal_phone': '9876543210',
        'principal_password': 'School@123'
    }, headers=sa_headers)
    assert onboard_res.status_code == 201

    p_res = client.post('/api/auth/login', json={'identifier': 'principal@cis.edu', 'password': 'School@123'})
    assert p_res.status_code == 200
    p_token = p_res.get_json()['access_token']
    p_headers = {'Authorization': f'Bearer {p_token}'}

    cls_res = client.get('/api/principal/classes', headers=p_headers)
    assert cls_res.status_code == 200
    classes = cls_res.get_json()
    class_id = classes[0]['id']

    return p_headers, class_id


def test_quick_admission_skip_fee_creates_provisional(client, app):
    headers, class_id = setup_school_and_principal(client)

    # 1. Quick Admission: skipped steps, fee payment skipped
    payload = {
        'name': 'Rahul Verma',
        'class_id': class_id,
        'session': '2026-27',
        'is_first_school': True,
        'fee_setup': {
            'is_provisional': True,
            'payment_status': 'DUE',
            'initial_payment_amount': 0,
            'transport_fee': 0,
            'hostel_fee': 0,
            'library_fee': 0,
            'manual_waiver': 0,
        },
        'status': 'PROVISIONAL'
    }

    res = client.post('/api/principal/students', json=payload, headers=headers)
    assert res.status_code in [200, 201]
    data = res.get_json()
    student_id = data['id']
    assert data['status'] == 'PROVISIONAL'

    # Verify student model in db
    with app.app_context():
        student = Student.query.get(student_id)
        assert student is not None
        assert student.status == 'PROVISIONAL'

        enrollment = StudentEnrollment.query.filter_by(student_id=student_id).first()
        assert enrollment is not None
        assert enrollment.enrollment_status == 'PROVISIONAL'


def test_admission_with_direct_fee_payment_creates_active(client, app):
    headers, class_id = setup_school_and_principal(client)

    # 2. Admission with direct fee paid
    payload = {
        'name': 'Ananya Roy',
        'class_id': class_id,
        'session': '2026-27',
        'parent_phone': '9876543211',
        'admission_fee': 5000,
        'fee_setup': {
            'is_provisional': False,
            'payment_status': 'PAID',
            'initial_payment_amount': 5000,
            'payment_mode': 'UPI',
            'payment_reference': 'UPI-TEST-123456',
        },
        'status': 'ACTIVE'
    }

    res = client.post('/api/principal/students', json=payload, headers=headers)
    assert res.status_code in [200, 201]
    data = res.get_json()
    student_id = data['id']
    assert data['status'] == 'ACTIVE'

    with app.app_context():
        student = Student.query.get(student_id)
        assert student.status == 'ACTIVE'


def test_paying_fee_auto_confirms_provisional_student(client, app):
    headers, class_id = setup_school_and_principal(client)

    # 1. Admit as provisional
    payload = {
        'name': 'Kunal Sen',
        'class_id': class_id,
        'session': '2026-27',
        'admission_fee': 4000,
        'fee_setup': {
            'is_provisional': True,
            'payment_status': 'DUE',
            'initial_payment_amount': 0,
        },
        'status': 'PROVISIONAL'
    }

    res = client.post('/api/principal/students', json=payload, headers=headers)
    assert res.status_code in [200, 201]
    student_id = res.get_json()['id']

    # 2. Verify initial status is PROVISIONAL and has PROV- number
    with app.app_context():
        student = Student.query.get(student_id)
        assert student.status == 'PROVISIONAL'
        assert student.admission_no.startswith('PROV-')
        assert student.provisional_no.startswith('PROV-')
        fr = FeeRecord.query.filter_by(student_id=student_id).first()
        assert fr is not None
        rec_id = fr.id

    # 3. Collect fee on the pending record
    pay_res = client.post('/api/principal/fees/collect', json={
        'record_id': rec_id,
        'amount_paid': 4000,
        'payment_mode': 'CASH',
        'remarks': 'Settling admission fee at counter'
    }, headers=headers)
    assert pay_res.status_code == 200

    # 4. Verify student status transitioned automatically to ACTIVE and received official ADM- number!
    with app.app_context():
        student = Student.query.get(student_id)
        assert student.status == 'ACTIVE', f"Expected student status to be ACTIVE, got {student.status}"
        assert student.admission_no.startswith('ADM-'), f"Expected official ADM- number, got {student.admission_no}"
        assert student.provisional_no.startswith('PROV-')
        enr = StudentEnrollment.query.filter_by(student_id=student_id).first()
        if enr:
            assert enr.enrollment_status == 'ACTIVE'


def test_student_list_and_dashboard_exclude_provisional_students(client, app):
    headers, class_id = setup_school_and_principal(client)

    # 1. Admit 1 active student
    client.post('/api/principal/students', json={
        'name': 'Active Student One',
        'class_id': class_id,
        'parent_phone': '9991112221',
        'status': 'ACTIVE',
        'fee_setup': {'is_provisional': False, 'payment_status': 'PAID', 'initial_payment_amount': 5000}
    }, headers=headers)

    # 2. Admit 1 provisional student
    client.post('/api/principal/students', json={
        'name': 'Provisional Student Pending',
        'class_id': class_id,
        'parent_phone': '9991112222',
        'status': 'PROVISIONAL',
        'fee_setup': {'is_provisional': True, 'payment_status': 'DUE', 'initial_payment_amount': 0}
    }, headers=headers)

    # 3. Regular student directory should only return 1 active student
    res_list = client.get('/api/principal/students', headers=headers)
    assert res_list.status_code == 200
    items = res_list.get_json()['data']
    assert len(items) == 1
    assert items[0]['name'] == 'Active Student One'

    # 4. ?status=PROVISIONAL should return only the provisional student
    res_prov = client.get('/api/principal/students?status=PROVISIONAL', headers=headers)
    assert res_prov.status_code == 200
    items_prov = res_prov.get_json()['data']
    assert len(items_prov) == 1
    assert items_prov[0]['name'] == 'Provisional Student Pending'
    assert items_prov[0]['admission_no'].startswith('PROV-')

    # 5. Dashboard should count only 1 total student, and 1 unconfirmed admission
    res_dash = client.get('/api/principal/dashboard', headers=headers)
    assert res_dash.status_code == 200
    dash_data = res_dash.get_json()
    assert dash_data['total_students'] == 1
    assert dash_data.get('unconfirmed_admissions_count') == 1


def test_monthly_fee_generation_skips_unconfirmed_provisional_students(app, client):
    """Verifies that bulk fee generation skips PROVISIONAL students and generate_fee_bill refuses to bill them."""
    headers, class_id = setup_school_and_principal(client)

    # 1. Admit a provisional student (skip fee payment)
    payload = {
        'name': 'Provisional Bill Skip Student',
        'class_id': class_id,
        'father_name': 'Father Skip',
        'parent_phone': '9876543219',
        'manual_admission_no': 'SKIP-BILL-001',
        'fee_setup': {
            'is_provisional': True,
            'payment_status': 'DUE',
            'initial_payment_amount': 0,
        },
        'status': 'PROVISIONAL'
    }

    res = client.post('/api/principal/students', json=payload, headers=headers)
    assert res.status_code in [200, 201]
    student_id = res.get_json()['id']

    with app.app_context():
        from app.services.fee_ledger_service import bulk_generate_fee_bills, generate_fee_bill
        from app.models.fee_finance import FeeBill
        from app.models.academic import Student
        from datetime import date

        student = Student.query.get(student_id)
        school_id = student.school_id

        # Verify bulk generation does NOT include this provisional student
        res_bulk = bulk_generate_fee_bills(
            school_id=school_id,
            bill_month='2026-10',
            due_date=date(2026, 10, 10),
            class_id=class_id,
        )

        # Ensure no FeeBill was generated for the provisional student
        bill = FeeBill.query.filter_by(student_id=student_id, bill_month='2026-10').first()
        assert bill is None, "Monthly FeeBill should NEVER be generated for unconfirmed provisional student"

        # Also verify generate_fee_bill explicitly raises ValueError
        actor_user = User.query.filter_by(school_id=school_id).first()
        try:
            generate_fee_bill(student_id=student_id, bill_month='2026-10', due_date=date(2026, 10, 10), actor_user=actor_user)
            assert False, "Should have raised ValueError when attempting to generate fee for PROVISIONAL student"
        except ValueError as err:
            assert "UNCONFIRMED" in str(err) or "PROVISIONAL" in str(err)

