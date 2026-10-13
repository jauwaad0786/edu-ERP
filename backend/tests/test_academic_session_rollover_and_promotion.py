import pytest
from datetime import date, datetime
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Class, Student, StudentEnrollment, Attendance, Marks, Subject
from app.models.financial import FeeRecord, FeeStructure
from app.models.audit import AuditLog


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()

        # Seed School 1 (Main)
        school1 = School(
            name='Springfield International School',
            code='SIS01',
            current_session='2024-25',
            is_active=True
        )
        db.session.add(school1)
        db.session.flush()

        # Seed School 2 (Tenant Isolation Check)
        school2 = School(
            name='Shelbyville Academy',
            code='SA01',
            current_session='2024-25',
            is_active=True
        )
        db.session.add(school2)
        db.session.flush()

        # Users: Principal, Teacher, Parent
        principal = User(
            name='Principal Skinner',
            email='principal@sis.edu',
            role=UserRole.PRINCIPAL,
            school_id=school1.id,
            is_active=True
        )
        principal.set_password('School@123')

        teacher = User(
            name='Mrs. Krabappel',
            email='teacher@sis.edu',
            role=UserRole.TEACHER,
            school_id=school1.id,
            is_active=True
        )
        teacher.set_password('Teacher@123')

        parent_user = User(
            name='Homer Simpson',
            email='homer@simpson.org',
            phone='9876543210',
            role=UserRole.PARENT,
            school_id=school1.id,
            is_active=True
        )
        parent_user.set_password('Parent@123')

        # Student user 1 (Bart - Class 5-A)
        stu_user_1 = User(
            name='Bart Simpson',
            email='bart@sis.edu',
            role=UserRole.STUDENT,
            school_id=school1.id,
            is_active=True
        )
        stu_user_1.set_password('Student@123')

        # Student user 2 (Lisa - Class 4-A)
        stu_user_2 = User(
            name='Lisa Simpson',
            email='lisa@sis.edu',
            role=UserRole.STUDENT,
            school_id=school1.id,
            is_active=True
        )
        stu_user_2.set_password('Student@123')

        # Student user 3 (Nelson - Class 12-A)
        stu_user_3 = User(
            name='Nelson Muntz',
            email='nelson@sis.edu',
            role=UserRole.STUDENT,
            school_id=school1.id,
            is_active=True
        )
        stu_user_3.set_password('Student@123')

        # Foreign student user (School 2)
        foreign_user = User(
            name='Foreign Kid',
            email='foreign@sa.edu',
            role=UserRole.STUDENT,
            school_id=school2.id,
            is_active=True
        )
        foreign_user.set_password('Student@123')

        db.session.add_all([principal, teacher, parent_user, stu_user_1, stu_user_2, stu_user_3, foreign_user])
        db.session.flush()

        # Classes for School 1
        c4a = Class(name='Class 4', section='A', session='2024-25', school_id=school1.id)
        c5a = Class(name='Class 5', section='A', session='2024-25', school_id=school1.id)
        c5b = Class(name='Class 5', section='B', session='2024-25', school_id=school1.id)
        c6a = Class(name='Class 6', section='A', session='2025-26', school_id=school1.id)
        c6b = Class(name='Class 6', section='B', session='2025-26', school_id=school1.id)
        c12a = Class(name='Class 12', section='A', session='2024-25', school_id=school1.id)
        db.session.add_all([c4a, c5a, c5b, c6a, c6b, c12a])
        db.session.flush()

        # Fee Structure for Target Session (Class 6)
        fs_6 = FeeStructure(
            school_id=school1.id,
            class_id=c6a.id,
            session='2025-26',
            fee_type='Tuition Fee',
            amount=6000.0,
            frequency='MONTHLY',
            status='ACTIVE'
        )
        db.session.add(fs_6)

        # Student 1: Bart in Class 5-A
        bart = Student(
            user_id=stu_user_1.id,
            parent_user_id=parent_user.id,
            school_id=school1.id,
            class_id=c5a.id,
            roll_number='12',
            admission_no='ADM-2024-001',
            admission_date=date(2022, 4, 1),
            original_admission_year='2022',
            parent_phone='9876543210',
            parent_name='Homer Simpson',
            session='2024-25',
            status='ACTIVE'
        )
        # Student 2: Lisa in Class 4-A
        lisa = Student(
            user_id=stu_user_2.id,
            parent_user_id=parent_user.id,
            school_id=school1.id,
            class_id=c4a.id,
            roll_number='01',
            admission_no='ADM-2024-002',
            admission_date=date(2023, 4, 1),
            original_admission_year='2023',
            parent_phone='9876543210',
            parent_name='Homer Simpson',
            session='2024-25',
            status='ACTIVE'
        )
        # Student 3: Nelson in Class 12-A
        nelson = Student(
            user_id=stu_user_3.id,
            school_id=school1.id,
            class_id=c12a.id,
            roll_number='99',
            admission_no='ADM-2024-003',
            admission_date=date(2018, 4, 1),
            original_admission_year='2018',
            session='2024-25',
            status='ACTIVE'
        )
        # Student 4: Foreign in School 2
        foreign_student = Student(
            user_id=foreign_user.id,
            school_id=school2.id,
            admission_no='ADM-SA-999',
            session='2024-25',
            status='ACTIVE'
        )

        db.session.add_all([bart, lisa, nelson, foreign_student])
        db.session.flush()

        # Enrollments in 2024-25
        en_bart = StudentEnrollment(
            school_id=school1.id,
            student_id=bart.id,
            session='2024-25',
            class_id=c5a.id,
            section='A',
            roll_number='12',
            enrollment_status='ACTIVE',
            enrollment_type='REGULAR'
        )
        en_lisa = StudentEnrollment(
            school_id=school1.id,
            student_id=lisa.id,
            session='2024-25',
            class_id=c4a.id,
            section='A',
            roll_number='01',
            enrollment_status='ACTIVE',
            enrollment_type='REGULAR'
        )
        en_nelson = StudentEnrollment(
            school_id=school1.id,
            student_id=nelson.id,
            session='2024-25',
            class_id=c12a.id,
            section='A',
            roll_number='99',
            enrollment_status='ACTIVE',
            enrollment_type='REGULAR'
        )
        db.session.add_all([en_bart, en_lisa, en_nelson])

        # Bart historical fees: 1 paid, 1 unpaid dues
        fr_paid = FeeRecord(
            school_id=school1.id,
            student_id=bart.id,
            fee_type='Term 1 Tuition',
            amount_due=5000.0,
            amount_paid=5000.0,
            status='PAID',
            session='2024-25'
        )
        fr_unpaid = FeeRecord(
            school_id=school1.id,
            student_id=bart.id,
            fee_type='Term 2 Tuition',
            amount_due=5000.0,
            amount_paid=2000.0,
            status='PARTIAL',
            session='2024-25'
        )
        # Bart historical attendance
        att = Attendance(
            student_id=bart.id,
            class_id=c5a.id,
            date=date(2024, 9, 1),
            status='PRESENT'
        )
        # Bart historical marks
        sub = Subject(name='Mathematics', class_id=c5a.id)
        db.session.add(sub)
        db.session.flush()

        marks = Marks(
            student_id=bart.id,
            subject_id=sub.id,
            class_id=c5a.id,
            exam_type='Final',
            marks_obtained=75.0,
            max_marks=100.0
        )
        db.session.add_all([fr_paid, fr_unpaid, att, marks])

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


class TestAcademicSessionRolloverAndPromotion:

    def test_01_sessions_switch_and_create(self, client):
        """Test creating a new session format and switching active session."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        # 1. Register new session 2026-27
        res = client.post('/api/principal/students/sessions/create', json={
            'session': '2026-27'
        }, headers=headers)
        assert res.status_code == 200
        assert '2026-27' in res.get_json()['sessions']

        # 2. Switch current session to 2025-26
        res_sw = client.post('/api/principal/students/sessions/switch', json={
            'session': '2025-26'
        }, headers=headers)
        assert res_sw.status_code == 200
        assert res_sw.get_json()['current_session'] == '2025-26'

        # Verify DB updated
        sch = School.query.filter_by(code='SIS01').first()
        assert sch.current_session == '2025-26'

    def test_02_class_mappings_endpoint(self, client):
        """Test automated class progression mapping deduction."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        res = client.get('/api/principal/students/promote/class-mappings?source_session=2024-25', headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert 'mappings' in data
        assert len(data['mappings']) >= 4

        # Check Class 5 -> Class 6 mapping
        c5_map = next((m for m in data['mappings'] if m['source_class_name'] == 'Class 5' and m['source_section'] == 'A'), None)
        assert c5_map is not None
        assert c5_map['suggested_action'] == 'PROMOTE'
        assert c5_map['target_class_name'] == 'Class 6'

        # Check Class 12 -> GRADUATE mapping
        c12_map = next((m for m in data['mappings'] if m['source_class_name'] == 'Class 12'), None)
        assert c12_map is not None
        assert c12_map['suggested_action'] == 'GRADUATE'

    def test_03_preview_with_fee_dues_and_dual_format(self, client):
        """Verify preview calculates historical dues and returns both 'preview' and 'students' keys."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        c5a = Class.query.filter_by(name='Class 5', section='A').first()

        res = client.post('/api/principal/students/promote/preview', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'class_id': c5a.id
        }, headers=headers)
        assert res.status_code == 200
        data = res.get_json()

        # Both keys present for frontend and backend compatibility
        assert 'students' in data
        assert 'preview' in data
        assert len(data['students']) == len(data['preview'])

        bart_item = next((p for p in data['students'] if p['admission_no'] == 'ADM-2024-001'), None)
        assert bart_item is not None
        assert bart_item['name'] == 'Bart Simpson'
        assert bart_item['student_name'] == 'Bart Simpson'
        assert bart_item['admission_no'] == 'ADM-2024-001'
        assert bart_item['admission_number'] == 'ADM-2024-001'
        # Outstanding dues: 5000 due - 2000 paid = 3000
        assert bart_item['outstanding_dues'] == 3000.0
        assert bart_item['academic_standing']['passed'] is True
        assert bart_item['recommended_action'] == 'PROMOTE'
        assert data['summary']['total_outstanding_dues'] >= 3000.0

    def test_04_bulk_promotion_and_target_fee_generation(self, client):
        """
        Scenario: Promote Bart to Class 6-A with target fee demand generated.
        Ensures:
        - Source enrollment marked PROMOTED
        - Target enrollment created ACTIVE with previous class reference
        - Student record updated
        - Target FeeRecord generated without altering old fees
        - Original admission date and identity intact
        """
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'generate_target_fees': True,
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6a.id,
                'target_section': 'A',
                'target_roll_no': '25'
            }]
        }, headers=headers)
        assert res.status_code == 200
        summary = res.get_json()['summary']
        assert summary['promoted'] == 1
        assert summary['fees_generated'] == 1

        # Check DB state
        bart_updated = Student.query.get(bart.id)
        assert bart_updated.class_id == c6a.id
        assert bart_updated.roll_number == '25'
        assert bart_updated.session == '2025-26'
        assert bart_updated.admission_date == date(2022, 4, 1)  # Preserved!
        assert bart_updated.original_admission_year == '2022'   # Preserved!

        # Check source enrollment
        src_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert src_en.enrollment_status == 'PROMOTED'

        # Check target enrollment
        tgt_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert tgt_en.enrollment_status == 'ACTIVE'
        assert tgt_en.class_id == c6a.id
        assert tgt_en.previous_class_id == src_en.class_id

        # Verify old fee unpaid dues remain intact
        old_unpaid = FeeRecord.query.filter_by(student_id=bart.id, session='2024-25', fee_type='Term 2 Tuition').first()
        assert old_unpaid.status == 'PARTIAL'
        assert old_unpaid.amount_due == 5000.0
        assert old_unpaid.amount_paid == 2000.0

        # Verify new session fee demand
        new_fee = FeeRecord.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert new_fee is not None
        assert new_fee.amount_due == 6000.0
        assert new_fee.amount_paid == 0.0
        assert new_fee.status == 'PENDING'

    def test_05_idempotent_rollover_retry(self, client):
        """Re-running promotion for already promoted student does NOT create duplicate records."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'generate_target_fees': True,
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6a.id,
                'target_section': 'A',
                'target_roll_no': '25'
            }]
        }, headers=headers)
        assert res.status_code == 200

        # Verify exactly ONE target enrollment exists
        enrollments = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').all()
        assert len(enrollments) == 1

        # Verify fee demands are NOT duplicated
        target_fees = FeeRecord.query.filter_by(student_id=bart.id, session='2025-26').all()
        assert len(target_fees) == 1

    def test_06_retention_and_terminal_outcomes(self, client):
        """
        Verify:
        - Lisa retained in Class 4-A
        - Nelson passed out / graduated (does NOT create target enrollment)
        """
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        lisa = Student.query.filter_by(admission_no='ADM-2024-002').first()
        nelson = Student.query.filter_by(admission_no='ADM-2024-003').first()
        c4a = Class.query.filter_by(name='Class 4', section='A').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [
                {
                    'student_id': lisa.id,
                    'action': 'RETAIN',
                    'target_class_id': c4a.id,
                    'target_section': 'A'
                },
                {
                    'student_id': nelson.id,
                    'action': 'GRADUATE'
                }
            ]
        }, headers=headers)
        assert res.status_code == 200
        summary = res.get_json()['summary']
        assert summary['retained'] == 1
        assert summary['graduated'] == 1

        # Lisa retained
        lisa_en_tgt = StudentEnrollment.query.filter_by(student_id=lisa.id, session='2025-26').first()
        assert lisa_en_tgt is not None
        assert lisa_en_tgt.enrollment_type == 'RETENTION'
        assert lisa_en_tgt.enrollment_status == 'ACTIVE'

        # Nelson graduated
        nelson_updated = Student.query.get(nelson.id)
        assert nelson_updated.status == 'GRADUATED'
        nelson_en_tgt = StudentEnrollment.query.filter_by(student_id=nelson.id, session='2025-26').first()
        assert nelson_en_tgt is None  # Terminal: no target enrollment created!

    def test_07_tenant_isolation_skips_foreign_student(self, client):
        """Foreign student cannot be touched by School 1 admin."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        foreign = Student.query.filter_by(admission_no='ADM-SA-999').first()

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': foreign.id,
                'action': 'PROMOTE'
            }]
        }, headers=headers)
        assert res.status_code == 200
        summary = res.get_json()['summary']
        assert summary['total_processed'] == 0
        assert summary['skipped'] == 1

        # Foreign student enrollment unchanged
        f_en = StudentEnrollment.query.filter_by(student_id=foreign.id, session='2025-26').first()
        assert f_en is None

    def test_08_unauthorized_role_rejected(self, client):
        """Teacher cannot execute rollover confirmation."""
        token = get_token(client, 'teacher@sis.edu', 'Teacher@123')
        headers = {'Authorization': f'Bearer {token}'}

        res = client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{'student_id': 1, 'action': 'PROMOTE'}]
        }, headers=headers)
        assert res.status_code == 403

    def test_09_correction_endpoint(self, client):
        """Correct promotion details (e.g. change section from A to B and roll number)."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()
        c6b = Class.query.filter_by(name='Class 6', section='B').first()

        # First promote Bart to Class 6-A
        client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6a.id,
                'target_section': 'A',
                'target_roll_no': '25'
            }]
        }, headers=headers)

        # Now test correction endpoint to Class 6-B, section B, roll 30
        res = client.post('/api/principal/students/promote/correct', json={
            'student_id': bart.id,
            'session': '2025-26',
            'target_class_id': c6b.id,
            'target_section': 'B',
            'target_roll_no': '30',
            'action': 'PROMOTE',
            'reason': 'Student requested section change'
        }, headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['success'] is True

        # Check DB update
        tgt_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert tgt_en.class_id == c6b.id
        assert tgt_en.section == 'B'
        assert tgt_en.roll_number == '30'

        # Check audit log
        audit = AuditLog.query.filter_by(action='PROMOTION_CORRECTION', student_id=bart.id).first()
        assert audit is not None
        assert 'Student requested section change' in audit.remarks

    def test_10_revert_promotion(self, client):
        """Safely revert student promotion back to source session state."""
        token = get_token(client, 'principal@sis.edu', 'School@123')
        headers = {'Authorization': f'Bearer {token}'}

        bart = Student.query.filter_by(admission_no='ADM-2024-001').first()
        c5a = Class.query.filter_by(name='Class 5', section='A').first()
        c6a = Class.query.filter_by(name='Class 6', section='A').first()

        # First promote Bart to Class 6-A with target fee
        client.post('/api/principal/students/promote/confirm', json={
            'source_session': '2024-25',
            'target_session': '2025-26',
            'generate_target_fees': True,
            'promotions': [{
                'student_id': bart.id,
                'action': 'PROMOTE',
                'target_class_id': c6a.id,
                'target_section': 'A',
                'target_roll_no': '25'
            }]
        }, headers=headers)

        res = client.post('/api/principal/students/promote/revert', json={
            'student_id': bart.id,
            'source_session': '2024-25',
            'target_session': '2025-26',
            'reason': 'Accidental rollover execution'
        }, headers=headers)
        assert res.status_code == 200

        # Check target enrollment deleted
        tgt_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert tgt_en is None

        # Check source enrollment restored to ACTIVE
        src_en = StudentEnrollment.query.filter_by(student_id=bart.id, session='2024-25').first()
        assert src_en.enrollment_status == 'ACTIVE'

        # Check student pointer restored
        bart_reverted = Student.query.get(bart.id)
        assert bart_reverted.session == '2024-25'
        assert bart_reverted.class_id == c5a.id

        # Check target fee record removed
        target_fee = FeeRecord.query.filter_by(student_id=bart.id, session='2025-26').first()
        assert target_fee is None

        # Check audit log
        audit = AuditLog.query.filter_by(action='PROMOTION_REVERT', student_id=bart.id).first()
        assert audit is not None
