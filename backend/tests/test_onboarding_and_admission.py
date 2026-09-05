import pytest
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Class
from app.models.financial import FeeRecord, FeeStructure
from app.models.rbac import Role, UserRoleAssignment


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


class TestOnboardingAndAdmission:

    def test_01_super_admin_school_onboarding_validation_and_creation(self, client):
        sa_token = get_token(client, 'superadmin@eduerp.com', 'Admin@123')
        assert sa_token is not None

        headers = {'Authorization': f'Bearer {sa_token}'}

        # 1. Missing required fields
        res = client.post('/api/admin/schools/onboard', json={'name': ''}, headers=headers)
        assert res.status_code == 400
        assert 'name is required' in res.get_json()['error']

        # 2. Successful complete onboarding
        payload = {
            'name': 'Delhi Public School International',
            'code': 'DPSI01',
            'type': 'SCHOOL',
            'affiliation_board': 'CBSE',
            'established_year': 2005,
            'address': 'Sector 45, Expressway',
            'city': 'Noida',
            'state': 'Uttar Pradesh',
            'pincode': '201301',
            'phone': '9876543210',
            'email': 'contact@dpsi.edu',
            'website': 'https://dpsi.edu',
            'current_session': '2024-25',
            'plan': 'PROFESSIONAL',
            'principal_name': 'Dr. Alok Verma',
            'principal_email': 'alok.verma@dpsi.edu',
            'principal_phone': '+91 9876543210',
            'principal_password': 'Principal@123',
            'principal_status': 'ACTIVE'
        }
        res = client.post('/api/admin/schools/onboard', json=payload, headers=headers)
        assert res.status_code == 201, res.get_json()
        data = res.get_json()
        assert data['school']['code'] == 'DPSI01'
        assert data['school']['name'] == 'Delhi Public School International'
        assert data['principal']['email'] == 'alok.verma@dpsi.edu'
        assert data['principal']['phone'] == '9876543210'

        school_id = data['school']['id']

        # 3. Duplicate school code rejected
        res_dup = client.post('/api/admin/schools/onboard', json=payload, headers=headers)
        assert res_dup.status_code == 409

        # 4. Duplicate principal email rejected
        dup_email_payload = dict(payload, code='NEWCODE99')
        res_dup_email = client.post('/api/admin/schools/onboard', json=dup_email_payload, headers=headers)
        assert res_dup_email.status_code == 409

        # 5. Verify default classes were seeded
        classes = Class.query.filter_by(school_id=school_id).all()
        assert len(classes) >= 12

        # 6. Verify default fee structures were seeded
        fees = FeeStructure.query.filter_by(school_id=school_id).all()
        assert len(fees) >= 2

    def test_02_dual_identifier_login_and_lifecycle_rejection(self, client):
        sa_token = get_token(client, 'superadmin@eduerp.com', 'Admin@123')
        headers = {'Authorization': f'Bearer {sa_token}'}

        # Onboard school
        payload = {
            'name': 'St. Xavier High School',
            'code': 'STXAV01',
            'principal_name': 'Fr. Joseph',
            'principal_email': 'joseph@stxavier.edu',
            'principal_phone': '9123456789',
            'principal_password': 'Father@123'
        }
        res = client.post('/api/admin/schools/onboard', json=payload, headers=headers)
        assert res.status_code == 201
        school_id = res.get_json()['school']['id']

        # 1. Login via EMAIL
        email_res = client.post('/api/auth/login', json={
            'identifier': 'joseph@stxavier.edu',
            'password': 'Father@123'
        })
        assert email_res.status_code == 200
        user_from_email = email_res.get_json()['user']

        # 2. Login via 10-DIGIT MOBILE NUMBER
        mobile_res = client.post('/api/auth/login', json={
            'identifier': '9123456789',
            'password': 'Father@123'
        })
        assert mobile_res.status_code == 200
        user_from_mobile = mobile_res.get_json()['user']

        # BOTH authenticate the EXACT SAME user record!
        assert user_from_email['id'] == user_from_mobile['id']
        assert user_from_email['email'] == 'joseph@stxavier.edu'
        assert user_from_mobile['phone'] == '9123456789'

        # 3. Wrong password
        bad_pw_res = client.post('/api/auth/login', json={
            'identifier': '9123456789',
            'password': 'WrongPassword!'
        })
        assert bad_pw_res.status_code == 401

        # 4. Inactive / Suspended Principal rejection
        client.put(f'/api/admin/schools/{school_id}/principal/status', json={'status': 'SUSPENDED'}, headers=headers)
        suspended_res = client.post('/api/auth/login', json={
            'identifier': 'joseph@stxavier.edu',
            'password': 'Father@123'
        })
        assert suspended_res.status_code == 403
        assert 'suspended' in suspended_res.get_json()['error'].lower()

        # Reactivate principal
        client.put(f'/api/admin/schools/{school_id}/principal/status', json={'status': 'ACTIVE'}, headers=headers)

        # 5. Suspended School rejection
        client.put(f'/api/admin/schools/{school_id}', json={'status': 'SUSPENDED'}, headers=headers)
        school_suspended_res = client.post('/api/auth/login', json={
            'identifier': 'joseph@stxavier.edu',
            'password': 'Father@123'
        })
        assert school_suspended_res.status_code == 403
        assert 'suspended' in school_suspended_res.get_json()['error'].lower()

    def test_03_student_admission_flow_and_duplicate_check(self, client):
        sa_token = get_token(client, 'superadmin@eduerp.com', 'Admin@123')
        headers = {'Authorization': f'Bearer {sa_token}'}

        # Onboard school
        res = client.post('/api/admin/schools/onboard', json={
            'name': 'Greenfield Model School',
            'code': 'GMS01',
            'principal_name': 'Mrs. Sharma',
            'principal_email': 'sharma@greenfield.edu',
            'principal_phone': '9811223344',
            'principal_password': 'Sharma@123'
        }, headers=headers)
        assert res.status_code == 201

        # Login as Principal
        prin_token = get_token(client, 'sharma@greenfield.edu', 'Sharma@123')
        assert prin_token is not None
        prin_headers = {'Authorization': f'Bearer {prin_token}'}

        # Get classes
        cls_res = client.get('/api/principal/classes', headers=prin_headers)
        assert cls_res.status_code == 200
        class_id = cls_res.get_json()[0]['id']

        # 1. Admit student with is_first_school = True
        student_a_payload = {
            'name': 'Aarav Patel',
            'dob': '2016-08-15',
            'gender': 'Male',
            'class_id': class_id,
            'parent_name': 'Ramesh Patel',
            'father_name': 'Ramesh Patel',
            'parent_phone': '9988776655',
            'address': 'Flat 202, Sunshine Apts',
            'is_first_school': True,
            'previous_school_name': 'Should Be Cleared',
            'previous_class': 'Should Be Cleared',
            'admission_fee': 5000
        }
        res_adm1 = client.post('/api/principal/students', json=student_a_payload, headers=prin_headers)
        assert res_adm1.status_code == 201, res_adm1.get_json()
        student1 = res_adm1.get_json()
        assert student1['is_first_school'] is True
        assert student1['previous_school_name'] == ''
        assert student1['previous_class'] == ''
        assert student1['admission_no'].startswith('ADM-')

        # Verify admission fee record was created
        fee_rec = FeeRecord.query.filter_by(student_id=student1['id'], fee_type='ADMISSION').first()
        assert fee_rec is not None
        assert fee_rec.amount_due == 5000
        assert fee_rec.status == 'PENDING'

        # 2. Check Duplicate Student endpoint
        dup_check = client.get(
            '/api/principal/students/check-duplicate?name=Aarav%20Patel&dob=2016-08-15',
            headers=prin_headers
        )
        assert dup_check.status_code == 200
        assert dup_check.get_json()['has_duplicate'] is True
        assert len(dup_check.get_json()['matches']) >= 1

        # 3. Admit student with is_first_school = False
        student_b_payload = {
            'name': 'Diya Sengupta',
            'dob': '2014-04-10',
            'gender': 'Female',
            'class_id': class_id,
            'parent_name': 'Subhash Sengupta',
            'father_name': 'Subhash Sengupta',
            'parent_phone': '9955443322',
            'is_first_school': False,
            'previous_school_name': 'National Public School',
            'previous_class': 'Class 3',
            'previous_tc_no': 'TC-8899',
            'previous_reason': 'Father relocated to city'
        }
        res_adm2 = client.post('/api/principal/students', json=student_b_payload, headers=prin_headers)
        assert res_adm2.status_code == 201
        student2 = res_adm2.get_json()
        assert student2['is_first_school'] is False
        assert student2['previous_school_name'] == 'National Public School'
        assert student2['previous_class'] == 'Class 3'
        assert student2['previous_tc_no'] == 'TC-8899'

        # 4. Rapid double submission (idempotency check)
        res_dup_click = client.post('/api/principal/students', json=student_b_payload, headers=prin_headers)
        assert res_dup_click.status_code == 200
        assert res_dup_click.get_json()['id'] == student2['id']

    def test_04_multi_tenant_security_isolation(self, client):
        sa_token = get_token(client, 'superadmin@eduerp.com', 'Admin@123')
        headers = {'Authorization': f'Bearer {sa_token}'}

        # School 1
        client.post('/api/admin/schools/onboard', json={
            'name': 'Alpha Academy',
            'code': 'ALPHA01',
            'principal_name': 'Principal Alpha',
            'principal_email': 'alpha@alpha.edu',
            'principal_phone': '9000000001',
            'principal_password': 'Alpha@123'
        }, headers=headers)

        # School 2
        client.post('/api/admin/schools/onboard', json={
            'name': 'Beta Academy',
            'code': 'BETA01',
            'principal_name': 'Principal Beta',
            'principal_email': 'beta@beta.edu',
            'principal_phone': '9000000002',
            'principal_password': 'Beta@123'
        }, headers=headers)

        # Principal Alpha admits student in School 1
        alpha_token = get_token(client, 'alpha@alpha.edu', 'Alpha@123')
        alpha_headers = {'Authorization': f'Bearer {alpha_token}'}
        cls_alpha = client.get('/api/principal/classes', headers=alpha_headers).get_json()[0]['id']

        stud_alpha = client.post('/api/principal/students', json={
            'name': 'Alpha Student',
            'class_id': cls_alpha,
            'parent_phone': '9111111111'
        }, headers=alpha_headers).get_json()

        # Principal Beta tries to access Alpha Student
        beta_token = get_token(client, 'beta@beta.edu', 'Beta@123')
        beta_headers = {'Authorization': f'Bearer {beta_token}'}

        # Direct access to student profile
        res_steal = client.get(f'/api/principal/students/{stud_alpha["id"]}/profile', headers=beta_headers)
        assert res_steal.status_code in (403, 404)

        # Direct access to admission card PDF
        res_card = client.get(f'/api/principal/admission-card/{stud_alpha["id"]}', headers=beta_headers)
        assert res_card.status_code in (403, 404)
