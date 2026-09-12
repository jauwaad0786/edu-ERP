import pytest
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Class
from app.models.financial import FeeRecord
from app.utils.timezone_util import ist_today, ist_now


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


def test_long_fee_type_admission_with_hostel_and_security_deposit(client):
    # 1. Login as Super Admin to onboard school
    sa_res = client.post('/api/auth/login', json={'identifier': 'superadmin@eduerp.com', 'password': 'Admin@123'})
    assert sa_res.status_code == 200
    sa_token = sa_res.get_json()['access_token']
    sa_headers = {'Authorization': f'Bearer {sa_token}'}

    # Onboard School
    onboard_res = client.post('/api/admin/schools/onboard', json={
        'name': 'Delhi Public Heritage School',
        'code': 'DPHS01',
        'principal_name': 'Dr. K. S. Verma',
        'principal_email': 'principal@dphs.edu',
        'principal_phone': '9876501234',
        'principal_password': 'Principal@123'
    }, headers=sa_headers)
    assert onboard_res.status_code == 201

    # Login as Principal
    p_res = client.post('/api/auth/login', json={'identifier': 'principal@dphs.edu', 'password': 'Principal@123'})
    assert p_res.status_code == 200
    p_token = p_res.get_json()['access_token']
    p_headers = {'Authorization': f'Bearer {p_token}'}

    # Get class
    cls_res = client.get('/api/principal/classes', headers=p_headers)
    assert cls_res.status_code == 200
    class_id = cls_res.get_json()[0]['id']

    # 2. Submit new admission with exact long fee type names that caused character varying(50) error
    long_hostel_name = 'Hostel Accommodation (ABC Hostel - DOUBLE (AC))'
    payload = {
        'name': 'Vikramaditya Roy',
        'dob': '2014-07-22',
        'gender': 'Male',
        'category': 'General',
        'class_id': class_id,
        'father_name': 'Bikramjit Roy',
        'parent_phone': '9876543210',
        'session': '2026-27',
        'fee_setup': {
            'payment_status': 'PAID',
            'payment_mode': 'CASH',
            'hostel_fee_name': long_hostel_name,
            'hostel_fee': 3500.0,
            'hostel_deposit': 1000.0,  # produces: "Hostel Accommodation (ABC Hostel - DOUBLE (AC)) (Security Deposit)" (68 chars)
            'additional_items': [
                {
                    'name': 'Very Long Enterprise Lab & Advanced Technology Infrastructure Maintenance Fee Component',
                    'category': 'ACADEMIC',
                    'amount': 1500.0
                }
            ]
        }
    }

    adm_res = client.post('/api/principal/students', json=payload, headers=p_headers)
    assert adm_res.status_code == 201, adm_res.get_json()
    student_data = adm_res.get_json()
    assert 'id' in student_data
    student_id = student_data['id']

    # 3. Verify fee records created in database with long fee_type strings
    fee_records = FeeRecord.query.filter_by(student_id=student_id).all()
    assert len(fee_records) >= 2

    # Check that the 68-char hostel deposit fee record was successfully stored
    deposit_rec = next((fr for fr in fee_records if 'Security Deposit' in (fr.fee_type or '')), None)
    assert deposit_rec is not None
    assert deposit_rec.fee_type == f"{long_hostel_name} (Security Deposit)"
    assert len(deposit_rec.fee_type) > 50  # explicitly > 50 characters

    # Check that the 80+ char lab fee was also stored
    lab_rec = next((fr for fr in fee_records if 'Enterprise Lab' in (fr.fee_type or '')), None)
    assert lab_rec is not None
    assert len(lab_rec.fee_type) > 50

    # 4. Verify admission card PDF download works with long fee names
    pdf_res = client.get(f'/api/principal/admission-card/{student_id}', headers=p_headers)
    assert pdf_res.status_code == 200
    assert pdf_res.mimetype == 'application/pdf'
    assert len(pdf_res.data) > 1000
