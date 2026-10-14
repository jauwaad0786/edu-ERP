import pytest
from datetime import date, datetime, timedelta
from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import (
    Class, Student, StudentEnrollment, Teacher, Subject, Attendance, AttendanceCorrection
)
from app.models.delegation import TeacherDelegation, TeacherDelegationPermission, TeacherDelegationScope
from app.services.student_attendance_service import (
    process_attendance_submission,
    calculate_attendance_metrics,
    get_low_attendance_students,
    get_missing_attendance_classes
)


@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()

        # 1. Seed School 1 & School 2
        s1 = School(name='Grandview Public School', code='GPS01', current_session='2024-25', is_active=True)
        s2 = School(name='Oakridge High School', code='OHS02', current_session='2024-25', is_active=True)
        db.session.add_all([s1, s2])
        db.session.flush()

        # 2. Seed Users
        principal = User(name='Principal Vance', email='principal@gps.edu', role=UserRole.PRINCIPAL, school_id=s1.id, is_active=True)
        principal.set_password('Admin@123')

        teacher1_user = User(name='Mr. Clark (Class Teacher)', email='clark@gps.edu', role=UserRole.TEACHER, school_id=s1.id, is_active=True)
        teacher1_user.set_password('Teacher@123')

        teacher2_user = User(name='Ms. Davis (Other Teacher)', email='davis@gps.edu', role=UserRole.TEACHER, school_id=s1.id, is_active=True)
        teacher2_user.set_password('Teacher@123')

        parent_user = User(name='John Doe (Parent)', email='johndoe@gmail.com', phone='9876543210', role=UserRole.PARENT, school_id=s1.id, is_active=True)
        parent_user.set_password('Parent@123')

        stu1_user = User(name='Alice Doe', email='alice@gps.edu', role=UserRole.STUDENT, school_id=s1.id, is_active=True)
        stu1_user.set_password('Student@123')

        stu2_user = User(name='Bob Smith', email='bob@gps.edu', role=UserRole.STUDENT, school_id=s1.id, is_active=True)
        stu2_user.set_password('Student@123')

        s2_user = User(name='Charlie Oakridge', email='charlie@ohs.edu', role=UserRole.STUDENT, school_id=s2.id, is_active=True)
        s2_user.set_password('Student@123')

        db.session.add_all([principal, teacher1_user, teacher2_user, parent_user, stu1_user, stu2_user, s2_user])
        db.session.flush()

        # 3. Seed Teachers
        t1 = Teacher(user_id=teacher1_user.id, school_id=s1.id, employee_id='EMP-001', designation='Senior Teacher')
        t2 = Teacher(user_id=teacher2_user.id, school_id=s1.id, employee_id='EMP-002', designation='Junior Teacher')
        db.session.add_all([t1, t2])
        db.session.flush()

        # 4. Seed Classes
        c5a = Class(name='Grade 5', section='A', session='2024-25', school_id=s1.id, teacher_id=t1.id)
        c5b = Class(name='Grade 5', section='B', session='2024-25', school_id=s1.id, teacher_id=None)
        c_s2 = Class(name='Grade 10', section='A', session='2024-25', school_id=s2.id, teacher_id=None)
        db.session.add_all([c5a, c5b, c_s2])
        db.session.flush()

        # 5. Seed Students
        today = date.today()
        student1 = Student(
            user_id=stu1_user.id,
            school_id=s1.id,
            class_id=c5a.id,
            admission_no='ADM-2024-0001',
            roll_number='5A-01',
            dob=date(2014, 5, 10),
            parent_name='John Doe',
            parent_phone='9876543210',
            parent_user_id=parent_user.id,
            session='2024-25',
            admission_date=today - timedelta(days=60),
            status='ACTIVE'
        )
        student2 = Student(
            user_id=stu2_user.id,
            school_id=s1.id,
            class_id=c5a.id,
            admission_no='ADM-2024-0002',
            roll_number='5A-02',
            dob=date(2014, 8, 15),
            parent_name='Robert Smith',
            parent_phone='9123456789',
            session='2024-25',
            admission_date=today - timedelta(days=50),
            status='ACTIVE'
        )
        student_s2 = Student(
            user_id=s2_user.id,
            school_id=s2.id,
            class_id=c_s2.id,
            admission_no='ADM-OHS-001',
            session='2024-25',
            status='ACTIVE'
        )
        db.session.add_all([student1, student2, student_s2])
        db.session.flush()

        # Enrollments
        enr1 = StudentEnrollment(school_id=s1.id, student_id=student1.id, session='2024-25', class_id=c5a.id, section='A', roll_number='5A-01', enrollment_status='ACTIVE')
        enr2 = StudentEnrollment(school_id=s1.id, student_id=student2.id, session='2024-25', class_id=c5a.id, section='A', roll_number='5A-02', enrollment_status='ACTIVE')
        db.session.add_all([enr1, enr2])
        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def get_token(client, email, password):
    resp = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.get_json()}"
    return resp.get_json()['access_token']


class TestStudentAndAttendanceE2E:

    def test_01_student_directory_search_filter_and_sorting(self, client):
        token = get_token(client, 'principal@gps.edu', 'Admin@123')
        headers = {'Authorization': f'Bearer {token}'}

        # 1. Search by student name
        res = client.get('/api/principal/students?search=Alice', headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['total'] == 1
        assert data['data'][0]['name'] == 'Alice Doe'

        # 2. Search by admission number
        res = client.get('/api/principal/students?search=ADM-2024-0002', headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['total'] == 1
        assert data['data'][0]['name'] == 'Bob Smith'

        # 3. Filter by session
        res = client.get('/api/principal/students?session=2024-25', headers=headers)
        assert res.status_code == 200
        assert res.get_json()['total'] == 2

        # 4. Filter by section
        res = client.get('/api/principal/students?section=A', headers=headers)
        assert res.status_code == 200
        assert res.get_json()['total'] == 2

        # 5. Sorting by roll_number desc
        res = client.get('/api/principal/students?sort_by=roll_number&sort_order=desc', headers=headers)
        assert res.status_code == 200
        data = res.get_json()['data']
        assert data[0]['roll_number'] == '5A-02'
        assert data[1]['roll_number'] == '5A-01'

    def test_02_teacher_attendance_authorization_matrix(self, client):
        t1_token = get_token(client, 'clark@gps.edu', 'Teacher@123')
        t2_token = get_token(client, 'davis@gps.edu', 'Teacher@123')
        p_token = get_token(client, 'principal@gps.edu', 'Admin@123')

        c5a = Class.query.filter_by(name='Grade 5', section='A').first()
        s1 = Student.query.filter_by(admission_no='ADM-2024-0001').first()
        today = str(date.today())

        # A. Unassigned teacher t2 tries to mark attendance for c5a -> 403 Forbidden
        res = client.post('/api/teacher/attendance', headers={'Authorization': f'Bearer {t2_token}'}, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'PRESENT'}]
        })
        assert res.status_code == 403
        assert 'not assigned' in res.get_json()['error']

        # B. Assigned class teacher t1 marks attendance for c5a -> 200 OK
        res = client.post('/api/teacher/attendance', headers={'Authorization': f'Bearer {t1_token}'}, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'PRESENT'}]
        })
        assert res.status_code == 200
        assert res.get_json()['success'] is True

        # C. Principal marks attendance for any class -> 200 OK
        res = client.post('/api/principal/attendance/mark', headers={'Authorization': f'Bearer {p_token}'}, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'PRESENT'}]
        })
        assert res.status_code == 200
        assert res.get_json()['success'] is True

    def test_03_attendance_validation_and_future_date_rejection(self, client):
        t1_token = get_token(client, 'clark@gps.edu', 'Teacher@123')
        headers = {'Authorization': f'Bearer {t1_token}'}
        c5a = Class.query.filter_by(name='Grade 5', section='A').first()
        s1 = Student.query.filter_by(admission_no='ADM-2024-0001').first()
        s2_other_school = Student.query.filter_by(admission_no='ADM-OHS-001').first()

        tomorrow = str(date.today() + timedelta(days=1))
        today = str(date.today())

        # A. Future date rejected
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': tomorrow,
            'records': [{'student_id': s1.id, 'status': 'PRESENT'}]
        })
        assert res.status_code == 400
        assert 'future' in res.get_json()['error']

        # B. Invalid status rejected
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'INVALID_STATUS'}]
        })
        assert res.status_code == 400
        assert 'Invalid status' in res.get_json()['error']

        # C. Cross-school student submission blocked
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s2_other_school.id, 'status': 'PRESENT'}]
        })
        assert res.status_code == 400
        assert 'does not belong to this school' in res.get_json()['error']

    def test_04_attendance_correction_audit_logging_and_idempotency(self, client):
        t1_token = get_token(client, 'clark@gps.edu', 'Teacher@123')
        p_token = get_token(client, 'principal@gps.edu', 'Admin@123')
        headers = {'Authorization': f'Bearer {t1_token}'}

        c5a = Class.query.filter_by(name='Grade 5', section='A').first()
        s1 = Student.query.filter_by(admission_no='ADM-2024-0001').first()
        today = str(date.today())

        # 1. Initial mark: PRESENT
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'PRESENT', 'remarks': 'On time'}]
        })
        assert res.status_code == 200
        assert res.get_json()['created'] == 1

        # 2. Correction: change to ABSENT with reason
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'ABSENT', 'reason': 'Medical leave approved'}]
        })
        assert res.status_code == 200
        data = res.get_json()
        assert data['corrected'] == 1
        assert data['created'] == 0

        # Verify AttendanceCorrection record exists
        corr = AttendanceCorrection.query.filter_by(student_id=s1.id, date=date.today()).first()
        assert corr is not None
        assert corr.previous_status == 'PRESENT'
        assert corr.new_status == 'ABSENT'
        assert corr.reason == 'Medical leave approved'

        # 3. Idempotent retry: re-submit same status (ABSENT)
        res = client.post('/api/teacher/attendance', headers=headers, json={
            'class_id': c5a.id,
            'date': today,
            'records': [{'student_id': s1.id, 'status': 'ABSENT', 'reason': 'Medical leave approved'}]
        })
        assert res.status_code == 200
        assert res.get_json()['unchanged'] == 1
        assert res.get_json()['corrected'] == 0

        # Verify no duplicate correction was created
        corrections_count = AttendanceCorrection.query.filter_by(student_id=s1.id, date=date.today()).count()
        assert corrections_count == 1

        # 4. View corrections audit log via principal endpoint
        res = client.get('/api/principal/attendance/corrections', headers={'Authorization': f'Bearer {p_token}'})
        assert res.status_code == 200
        assert res.get_json()['total'] >= 1
        item = res.get_json()['corrections'][0]
        assert item['student_name'] == 'Alice Doe'
        assert item['previous_status'] == 'PRESENT'
        assert item['new_status'] == 'ABSENT'

    def test_05_attendance_metrics_and_zero_division_safety(self, app):
        with app.app_context():
            # A. Empty records calculation
            empty_metrics = calculate_attendance_metrics([])
            assert empty_metrics['total_days'] == 0
            assert empty_metrics['percentage'] == 0.0

            # B. Multiple status records
            s1 = Student.query.filter_by(admission_no='ADM-2024-0001').first()
            c5a = Class.query.filter_by(name='Grade 5', section='A').first()

            # Seed 4 days: 2 PRESENT, 1 HALF_DAY, 1 ABSENT
            d1 = date.today() - timedelta(days=10)
            d2 = date.today() - timedelta(days=9)
            d3 = date.today() - timedelta(days=8)
            d4 = date.today() - timedelta(days=7)

            records = [
                Attendance(student_id=s1.id, class_id=c5a.id, date=d1, status='PRESENT'),
                Attendance(student_id=s1.id, class_id=c5a.id, date=d2, status='PRESENT'),
                Attendance(student_id=s1.id, class_id=c5a.id, date=d3, status='HALF_DAY'),
                Attendance(student_id=s1.id, class_id=c5a.id, date=d4, status='ABSENT'),
            ]
            metrics = calculate_attendance_metrics(records)
            assert metrics['total_days'] == 4
            assert metrics['present'] == 2
            assert metrics['half_day'] == 1
            assert metrics['absent'] == 1
            # Effective present = 2 + 0.5*1 = 2.5. 2.5 / 4 * 100 = 62.5%
            assert metrics['percentage'] == 62.5

    def test_06_low_attendance_and_missing_attendance_reports(self, client):
        p_token = get_token(client, 'principal@gps.edu', 'Admin@123')
        headers = {'Authorization': f'Bearer {p_token}'}

        c5a = Class.query.filter_by(name='Grade 5', section='A').first()
        s2 = Student.query.filter_by(admission_no='ADM-2024-0002').first()

        # Seed attendance for student 2 with low attendance (1 PRESENT out of 4 days = 25%)
        for i in range(1, 5):
            d = date.today() - timedelta(days=20 + i)
            st = 'PRESENT' if i == 1 else 'ABSENT'
            db.session.add(Attendance(student_id=s2.id, class_id=c5a.id, date=d, status=st))
        db.session.commit()

        # A. Low attendance report (< 75%)
        res = client.get('/api/principal/attendance/low-attendance?threshold=75', headers=headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data['total_low_attendance'] >= 1
        found_s2 = any(s['student_id'] == s2.id for s in data['students'])
        assert found_s2 is True

        # B. Missing attendance classes for past date with no submissions
        past_date = str(date.today() - timedelta(days=100))
        res = client.get(f'/api/principal/attendance/missing?date={past_date}', headers=headers)
        assert res.status_code == 200
        missing_data = res.get_json()
        assert missing_data['total_missing'] >= 1

    def test_07_parent_portal_scoping_and_idor_prevention(self, client):
        parent_token = get_token(client, 'johndoe@gmail.com', 'Parent@123')
        headers = {'Authorization': f'Bearer {parent_token}'}

        s1 = Student.query.filter_by(admission_no='ADM-2024-0001').first()
        s2 = Student.query.filter_by(admission_no='ADM-2024-0002').first()

        # A. Parent accesses own child's (Alice Doe) attendance -> 200 OK
        res = client.get(f'/api/student/attendance?student_id={s1.id}', headers=headers)
        assert res.status_code == 200
        assert 'total_days' in res.get_json()

        # B. Parent attempts to access unrelated child (Bob Smith) -> 404 (IDOR blocked)
        res = client.get(f'/api/student/attendance?student_id={s2.id}', headers=headers)
        assert res.status_code == 404
        assert 'not found' in res.get_json()['error']
