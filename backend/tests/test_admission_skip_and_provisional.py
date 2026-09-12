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

    # 2. Verify initial status is PROVISIONAL
    with app.app_context():
        student = Student.query.get(student_id)
        assert student.status == 'PROVISIONAL'
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

    # 4. Verify student status transitioned automatically to ACTIVE!
    with app.app_context():
        student = Student.query.get(student_id)
        assert student.status == 'ACTIVE', f"Expected student status to be ACTIVE, got {student.status}"
        enr = StudentEnrollment.query.filter_by(student_id=student_id).first()
        if enr:
            assert enr.enrollment_status == 'ACTIVE'
