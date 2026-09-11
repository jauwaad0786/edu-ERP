import pytest
from datetime import date, datetime
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Class, Student, StudentEnrollment, Attendance, Marks, Subject
from app.models.financial import FeeRecord, ExamSchedule
from app.models.transport_student import StudentTransport


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()

        # Seed School
        school = School(
            name='Springfield International School',
            code='SIS01',
            current_session='2024-25',
            is_active=True
        )
        db.session.add(school)
        db.session.flush()

        # Seed Principal
        principal = User(
            name='Principal Skinner',
            email='principal@sis.edu',
            role=UserRole.PRINCIPAL,
            school_id=school.id,
            is_active=True
        )
        principal.set_password('School@123')
        db.session.add(principal)

        # Seed Teacher
        teacher = User(
            name='Mrs. Krabappel',
            email='teacher@sis.edu',
            role=UserRole.TEACHER,
            school_id=school.id,
            is_active=True
        )
        teacher.set_password('Teacher@123')
        db.session.add(teacher)

        # Seed Student user
        stu_user = User(
            name='Bart Simpson',
            email='bart@sis.edu',
            role=UserRole.STUDENT,
            school_id=school.id,
            is_active=True
        )
        stu_user.set_password('Student@123')
        db.session.add(stu_user)
        db.session.flush()

        # Seed Classes: Class 5-A, Class 5-B, Class 6-A, Class 6-B
        c5a = Class(name='Class 5', section='A', session='2024-25', school_id=school.id)
        c5b = Class(name='Class 5', section='B', session='2024-25', school_id=school.id)
        c6a = Class(name='Class 6', section='A', session='2025-26', school_id=school.id)
        c6b = Class(name='Class 6', section='B', session='2025-26', school_id=school.id)
        c12 = Class(name='Class 12', section='A', session='2024-25', school_id=school.id)
        db.session.add_all([c5a, c5b, c6a, c6b, c12])
        db.session.flush()

        # Seed Student record
        student = Student(
            user_id=stu_user.id,
            school_id=school.id,
            class_id=c5a.id,
            roll_number='12',
            admission_no='ADM-2024-001',
            admission_date=date(2024, 4, 1),
            original_admission_year='2024',
            dob=date(2014, 2, 23),
            gender='Male',
            blood_group='O+',
            father_name='Homer Simpson',
            mother_name='Marge Simpson',
            parent_phone='9876543210',
            address='742 Evergreen Terrace',
            session='2024-25',
            house='Red',
            stream='General',
            status='ACTIVE'
        )
        db.session.add(student)
        db.session.flush()

        # Baseline enrollment for 2024-25
        enrollment = StudentEnrollment(
            school_id=school.id,
            student_id=student.id,
            session='2024-25',
            class_id=c5a.id,
            section='A',
            roll_number='12',
            stream='General',
            house='Red',
            enrollment_status='ACTIVE',
            enrollment_type='NEW_ADMISSION',
            enrolled_date=date(2024, 4, 1),
            created_by=principal.id
        )
        db.session.add(enrollment)

        # Historical attendance & fees in 2024-25
        att = Attendance(
            student_id=student.id,
            class_id=c5a.id,
            date=date(2024, 5, 10),
            status='PRESENT'
        )
        fee = FeeRecord(
            student_id=student.id,
            school_id=school.id,
            fee_type='Tuition Fee',
            amount_due=5000.0,
            amount_paid=5000.0,
            status='PAID',
            session='2024-25',
            month='2024-05'
        )
        db.session.add_all([att, fee])

        # Second school for tenant isolation
        school2 = School(name='Shelbyville Academy', code='SA01', is_active=True)
        db.session.add(school2)

        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def get_token(client, email, password):
    res = client.post('/api/auth/login', json={'identifier': email, 'password': password})
    if res.status_code == 200:
        return res.get_json()['access_token']
    return None


class TestStudentLifecycle:

    def test_01_new_student_admission_creates_permanent_profile_and_enrollment(self, client):
        """Scenario 1: Fresh admission sets permanent info once and creates initial StudentEnrollment."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        res = client.post('/api/principal/students', json={
            'name': 'Lisa Simpson',
            'email': 'lisa@sis.edu',
            'password': 'Student@123',
            'admission_no': 'ADM-2024-002',
            'admission_date': '2024-04-05',
            'dob': '2016-05-09',
            'gender': 'Female',
            'class_id': c5a.id,
            'roll_number': '1',
            'father_name': 'Homer Simpson',
            'mother_name': 'Marge Simpson',
            'parent_phone': '9876543210',
            'address': '742 Evergreen Terrace',
            'session': '2024-25',
            'house': 'Blue',
            'stream': 'General'
        }, headers=headers)

        assert res.status_code == 201
        data = res.get_json()
        student_id = data['id']

        # Verify permanent student record
        student = Student.query.get(student_id)
        assert student.original_admission_year == '2024'
        assert student.father_name == 'Homer Simpson'
        assert student.gender == 'Female'

        # Verify baseline StudentEnrollment
        enrollments = StudentEnrollment.query.filter_by(student_id=student_id).all()
        assert len(enrollments) == 1
        assert enrollments[0].session == '2024-25'
        assert enrollments[0].enrollment_status == 'ACTIVE'
        assert enrollments[0].enrollment_type == 'NEW_ADMISSION'

    def test_02_annual_registration_existing_student_no_duplicate(self, client):
        """Scenario 2: Annual registration for existing student reuses profile and creates new enrollment."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()
        initial_student_count = Student.query.count()

        res = client.post('/api/principal/students/annual-register', json={
            'student_id': bart.id,
            'session': '2025-26',
            'class_id': c6a.id,
            'section': 'A',
            'roll_number': '18',
            'house': 'Red',
            'stream': 'Science',
            'action': 'PROMOTION',
            'remarks': 'Annual registration for 2025-26'
        }, headers=headers)

        assert res.status_code == 200
        # Student count must NOT increase (no duplicate student!)
        assert Student.query.count() == initial_student_count

        # Check enrollments: student now has 2 distinct enrollments
        enrollments = StudentEnrollment.query.filter_by(student_id=bart.id).order_by(StudentEnrollment.id.asc()).all()
        assert len(enrollments) == 2
        assert enrollments[0].session == '2024-25'
        assert enrollments[1].session == '2025-26'
        assert enrollments[1].class_id == c6a.id
        assert enrollments[1].roll_number == '18'

        # Check active pointer updated on student
        bart_updated = Student.query.get(bart.id)
        assert bart_updated.session == '2025-26'
        assert bart_updated.class_id == c6a.id
        assert bart_updated.roll_number == '18'
        # Permanent identity remains 2024
        assert bart_updated.original_admission_year == '2024'

    def test_03_promotion_workflow_class_5_to_class_6(self, client):
        """Scenario 3: Promotion Class 5 -> Class 6 marks source PROMOTED, target ACTIVE."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()

        # 1. Preview
        res_prev = client.post('/api/principal/students/promote/preview', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'class_id': c5a.id
        }, headers=headers)
        assert res_prev.status_code == 200
        preview_data = res_prev.get_json()
        assert preview_data['total_students'] >= 1
        assert preview_data['students'][0]['recommended_action'] == 'PROMOTE'

        # 2. Confirm
        res_conf = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6a.id,
                'target_section': 'A',
                'target_roll_no': '18',
                'target_house': 'Red',
                'target_stream': 'General'
            }]
        }, headers=headers)
        assert res_conf.status_code == 200
        summary = res_conf.get_json()['summary']
        assert summary['promoted'] == 1

        # Verify source enrollment status
        src_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert src_en.enrollment_status == 'PROMOTED'

        # Verify target enrollment
        tgt_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert tgt_en.enrollment_status == 'ACTIVE'
        assert tgt_en.class_id == c6a.id

    def test_04_retention_in_same_class(self, client):
        """Scenario 4: Student retained in Class 5 creates retention enrollment in Class 5."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'RETAIN',
                'target_class_id': c5a.id,
                'target_section': 'A',
                'target_roll_no': '12'
            }]
        }, headers=headers)
        assert res.status_code == 200

        src_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert src_en.enrollment_status == 'RETAINED'

        tgt_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert tgt_en.enrollment_type == 'RETENTION'
        assert tgt_en.class_id == c5a.id

    def test_05_student_withdrawal(self, client):
        """Scenario 5: Marking student as withdrawn preserves history and updates status."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'WITHDRAW'
            }]
        }, headers=headers)
        assert res.status_code == 200

        student = Student.query.get(bart.id)
        assert student.status == 'WITHDRAWN'

        # Previous enrollment remains intact
        src_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert src_en.enrollment_status == 'WITHDRAWN'

    def test_06_student_graduation(self, client):
        """Scenario 6: Terminal class student marked as graduated."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'GRADUATE'
            }]
        }, headers=headers)
        assert res.status_code == 200

        student = Student.query.get(bart.id)
        assert student.status == 'GRADUATED'

    def test_07_section_shuffle_6a_to_6b(self, client):
        """Scenario 7: Shuffle redistributes sections within a class without creating duplicates."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        res = client.post('/api/principal/students/shuffle/confirm', json={
            'session': '2024-25',
            'class_id': c5a.id,
            'moves': [{
                'student_id': bart.id,
                'target_section': 'B'
            }]
        }, headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['updated_count'] == 1
        assert 'rollback_token' in data

        # Check section updated
        student = Student.query.get(bart.id)
        assert student.class_ref.section == 'B'

        # Check enrollment updated
        en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert en.section == 'B'
        assert en.enrollment_type == 'SHUFFLED'

    def test_08_smart_balanced_shuffle(self, client):
        """Scenario 8: Smart shuffle previews balanced gender and count distribution."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        res = client.post('/api/principal/students/shuffle/preview', json={
            'session': '2024-25',
            'class_id': c5a.id,
            'mode': 'SMART',
            'target_sections': ['A', 'B']
        }, headers=headers)

        assert res.status_code == 200
        data = res.get_json()
        assert data['mode'] == 'SMART'
        assert 'before_distribution' in data
        assert 'after_distribution' in data

    def test_09_section_shuffle_rollback(self, client):
        """Scenario 9: Rollback safely restores previous section assignments."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        # Execute shuffle A -> B
        res_shuff = client.post('/api/principal/students/shuffle/confirm', json={
            'session': '2024-25',
            'class_id': c5a.id,
            'moves': [{'student_id': bart.id, 'target_section': 'B'}]
        }, headers=headers)
        token_rb = res_shuff.get_json()['rollback_token']

        # Execute rollback
        res_rb = client.post('/api/principal/students/shuffle/rollback', json={
            'rollback_token': token_rb
        }, headers=headers)
        assert res_rb.status_code == 200
        assert res_rb.get_json()['reverted_count'] == 1

        # Verify reverted to section A
        student = Student.query.get(bart.id)
        assert student.class_ref.section == 'A'

    def test_10_bulk_edit_academic_fields(self, client):
        """Scenario 10: Bulk edit updates academic fields without modifying historical records."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()

        # Preview
        res_prev = client.post('/api/principal/students/bulk-edit/preview', json={
            'student_ids': [bart.id],
            'field': 'house',
            'value': 'Yellow',
            'session': '2024-25'
        }, headers=headers)
        assert res_prev.status_code == 200
        assert res_prev.get_json()['is_academic_year'] is True

        # Confirm
        res_conf = client.post('/api/principal/students/bulk-edit/confirm', json={
            'student_ids': [bart.id],
            'field': 'house',
            'value': 'Yellow',
            'session': '2024-25'
        }, headers=headers)
        assert res_conf.status_code == 200

        student = Student.query.get(bart.id)
        assert student.house == 'Yellow'
        en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert en.house == 'Yellow'

    def test_11_bulk_edit_permanent_fields_with_warning(self, client):
        """Scenario 11: Bulk edit permanent fields provides warning."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()

        res_prev = client.post('/api/principal/students/bulk-edit/preview', json={
            'student_ids': [bart.id],
            'field': 'blood_group',
            'value': 'AB+',
            'session': '2024-25'
        }, headers=headers)
        assert res_prev.status_code == 200
        assert res_prev.get_json()['is_academic_year'] is False
        assert 'permanent' in res_prev.get_json()['warning'].lower()

    def test_12_historical_progression_over_three_years(self, client):
        """Scenario 12: Simulates 3 years of enrollment: 2024-25 -> 2025-26 -> 2026-27."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()
        c6b = Class.query.filter_by(name='Class 6', section='B').first()

        # Year 2 (2025-26): Promote to Class 6-B Roll 18
        client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6b.id,
                'target_section': 'B',
                'target_roll_no': '18'
            }]
        }, headers=headers)

        # Year 3 (2026-27): Re-register in Class 7-A Roll 9
        c7a = Class(name='Class 7', section='A', session='2026-27', school_id=bart.school_id)
        db.session.add(c7a)
        db.session.commit()

        client.post('/api/principal/students/annual-register', json={
            'student_id': bart.id,
            'session': '2026-27',
            'class_id': c7a.id,
            'section': 'A',
            'roll_number': '9'
        }, headers=headers)

        # Verify Student permanent identity is preserved
        student = Student.query.get(bart.id)
        assert student.original_admission_year == '2024'
        assert student.admission_no == 'ADM-2024-001'

        # Verify all 3 academic session enrollments exist
        enrollments = StudentEnrollment.query.filter_by(student_id=bart.id).order_by(StudentEnrollment.id.asc()).all()
        assert len(enrollments) == 3

        assert enrollments[0].session == '2024-25'
        assert enrollments[0].class_id == c5a.id
        assert enrollments[0].roll_number == '12'

        assert enrollments[1].session == '2025-26'
        assert enrollments[1].class_id == c6b.id
        assert enrollments[1].roll_number == '18'

        assert enrollments[2].session == '2026-27'
        assert enrollments[2].class_id == c7a.id
        assert enrollments[2].roll_number == '9'

    def test_13_historical_fee_integrity_preserved(self, client):
        """Scenario 13: Fees from prior years remain tied to prior session."""
        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        fees = FeeRecord.query.filter_by(student_id=bart.id, session='2024-25').all()
        assert len(fees) == 1
        assert fees[0].amount_paid == 5000.0

    def test_14_historical_attendance_integrity_preserved(self, client):
        """Scenario 14: Attendance from prior years remains tied to prior class."""
        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()
        att = Attendance.query.filter_by(student_id=bart.id, class_id=c5a.id).first()
        assert att is not None
        assert att.status == 'PRESENT'

    def test_15_duplicate_enrollment_prevention(self, client):
        """Scenario 15: Constraint rejects duplicate enrollment in same session."""
        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        dup = StudentEnrollment(
            school_id=bart.school_id,
            student_id=bart.id,
            session='2024-25',  # Already exists!
            class_id=c5a.id
        )
        db.session.add(dup)
        with pytest.raises(Exception):
            db.session.commit()
        db.session.rollback()

    def test_16_unauthorized_user_rejected(self, client):
        """Scenario 16: Non-admin user cannot execute promotion or shuffle."""
        stu_token = get_token(client, 'bart@sis.edu', 'Student@123')
        headers = {'Authorization': f'Bearer {stu_token}'}

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': []
        }, headers=headers)
        assert res.status_code == 403

    def test_17_cross_tenant_isolation(self, client):
        """Scenario 17: Admin cannot promote student belonging to another school."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        # Create student in school 2
        sch2 = School.query.filter_by(code='SA01').first()
        user2 = User(name='Foreign Student', email='foreign@sa.edu', role=UserRole.STUDENT, school_id=sch2.id)
        user2.set_password('Pass@123')
        db.session.add(user2)
        db.session.flush()

        foreign_student = Student(
            user_id=user2.id,
            school_id=sch2.id,
            admission_no='ADM-SA-001',
            session='2024-25'
        )
        db.session.add(foreign_student)
        db.session.commit()

        # Try to promote student from school 2
        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': foreign_student.id,
                'action': 'PROMOTE'
            }]
        }, headers=headers)
        assert res.status_code == 200
        # Student was silently skipped because of tenant isolation
        assert res.get_json()['summary']['total_processed'] == 0

    def test_18_student_history_timeline_endpoint(self, client):
        """Scenario 18: Complete lifetime academic dossier API."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()

        res = client.get(f'/api/principal/students/{bart.id}/history', headers=headers)
        if res.status_code != 200:
            print("ERROR RESPONSE:", res.get_data(as_text=True))
        assert res.status_code == 200
        data = res.get_json()

        # Permanent profile
        assert data['profile']['name'] == 'Bart Simpson'
        assert data['profile']['original_admission_year'] == '2024'
        assert data['profile']['admission_no'] == 'ADM-2024-001'

        # Timeline
        assert len(data['timeline']) >= 1
        assert data['timeline'][0]['session'] == '2024-25'
        assert data['timeline'][0]['fee_summary']['total_paid'] == 5000.0

    def test_19_export_students_csv(self, client):
        """Scenario 19: Export students CSV."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        res = client.get('/api/principal/students/export?session=2024-25', headers=headers)
        assert res.status_code == 200
        assert 'text/csv' in res.content_type
        assert b'Admission No' in res.data
        assert b'Bart Simpson' in res.data

    def test_20_import_students_reuse_existing_profiles(self, client):
        """Scenario 20: Import CSV reuses existing student profile without duplicates."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        initial_student_count = Student.query.count()

        # Import 1 existing student + 1 brand new student
        res = client.post('/api/principal/students/import/confirm', json={
            'session': '2025-26',
            'rows': [
                {
                    'name': 'Bart Simpson',
                    'admission_no': 'ADM-2024-001',  # Existing student
                    'class_name': 'Class 6',
                    'section': 'A',
                    'roll_number': '12',
                    'session': '2025-26',
                    'parent_phone': '9876543210',
                    'is_existing_student': True
                },
                {
                    'name': 'Milhouse Van Houten',
                    'admission_no': 'ADM-2025-099',  # Brand new student
                    'class_name': 'Class 6',
                    'section': 'A',
                    'roll_number': '15',
                    'session': '2025-26',
                    'parent_phone': '9112233445',
                    'is_existing_student': False
                }
            ]
        }, headers=headers)

        assert res.status_code == 200
        data = res.get_json()
        assert data['updated_existing'] == 1
        assert data['imported_new'] == 1

        # Only 1 new student row was added to Student table
        assert Student.query.count() == initial_student_count + 1
