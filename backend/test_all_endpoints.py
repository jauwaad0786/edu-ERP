import os
import sys
import json
from datetime import date, datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add current directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['SUPER_ADMIN_PASSWORD'] = 'SuperAdmin@123'

from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Class, Subject, Student, Teacher, Attendance, Marks
from app.models.financial import FeeRecord, ExamSchedule, ExamTimetable
from app.models.rbac import Role, UserRoleAssignment
from flask_jwt_extended import create_access_token

def run_tests():
    app = create_app('development')
    app.config['TESTING'] = True
    
    with app.app_context():
        # Ensure tables exist
        db.create_all()

        # 1. Setup or retrieve test School
        school = School.query.first()
        if not school:
            school = School(name="Greenwood International School", code="GWIS001", address="Main Campus", email="info@greenwood.edu")
            db.session.add(school)
            db.session.commit()

        # 2. Setup or retrieve test Principal User
        principal_user = User.query.filter_by(role=UserRole.PRINCIPAL).first()
        if not principal_user:
            principal_user = User(
                name="Dr. Alok Verma",
                email="principal_test@greenwood.edu",
                role=UserRole.PRINCIPAL,
                school_id=school.id
            )
            principal_user.set_password("Admin@123")
            db.session.add(principal_user)
            db.session.commit()

        # 3. Setup or retrieve test Teacher User
        teacher_user = User.query.filter_by(role=UserRole.TEACHER).first()
        if not teacher_user:
            teacher_user = User(
                name="Suman Sharma",
                email="teacher_test@greenwood.edu",
                role=UserRole.TEACHER,
                school_id=school.id
            )
            teacher_user.set_password("Teacher@123")
            db.session.add(teacher_user)
            db.session.commit()

        teacher_record = Teacher.query.filter_by(user_id=teacher_user.id).first()
        if not teacher_record:
            teacher_record = Teacher(
                user_id=teacher_user.id,
                school_id=school.id,
                employee_id="TCH-001",
                department="Science",
                designation="Senior Teacher",
                dob=date(1988, 5, 15),
                joining_date=date(2021, 8, 10),
                qualification="M.Sc, B.Ed"
            )
            db.session.add(teacher_record)
            db.session.commit()

        # 4. Setup or retrieve test Class & Subject
        cls = Class.query.filter_by(school_id=school.id).first()
        if not cls:
            cls = Class(name="Class 10", section="A", school_id=school.id)
            db.session.add(cls)
            db.session.commit()

        subj = Subject.query.filter_by(class_id=cls.id).first()
        if not subj:
            subj = Subject(name="Mathematics", class_id=cls.id, teacher_id=teacher_record.id, school_id=school.id, max_marks=100, pass_marks=33)
            db.session.add(subj)
            db.session.commit()

        # 5. Setup Student
        student_user = User.query.filter_by(role=UserRole.STUDENT).first()
        if not student_user:
            student_user = User(
                name="Aarav Gupta",
                email="aarav_test@greenwood.edu",
                role=UserRole.STUDENT,
                school_id=school.id
            )
            student_user.set_password("Student@123")
            db.session.add(student_user)
            db.session.commit()

        student_record = Student.query.filter_by(user_id=student_user.id).first()
        if not student_record:
            student_record = Student(
                user_id=student_user.id,
                school_id=school.id,
                class_id=cls.id,
                roll_number="101",
                admission_no="ADM-2024-001"
            )
            db.session.add(student_record)
            db.session.commit()

        # 6. Setup Exam
        exam = ExamSchedule.query.filter_by(school_id=school.id).first()
        if not exam:
            exam = ExamSchedule(
                school_id=school.id,
                exam_name="Mid Term Examination 2026",
                exam_type="MID_TERM",
                session="2024-25",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=10),
                is_published=True
            )
            db.session.add(exam)
            db.session.commit()

        # 7. Setup Fee Record
        fee = FeeRecord.query.filter_by(school_id=school.id).first()
        if not fee:
            fee = FeeRecord(
                student_id=student_record.id,
                school_id=school.id,
                fee_type="Tuition Fee",
                amount_due=5000.0,
                amount_paid=5000.0,
                status="PAID",
                receipt_no="RCPT-TEST-001",
                paid_date=date.today()
            )
            db.session.add(fee)
            db.session.commit()

        # Create JWT Tokens
        principal_token = create_access_token(identity=str(principal_user.id))
        teacher_token = create_access_token(identity=str(teacher_user.id))

        client = app.test_client()

        p_headers = {'Authorization': f'Bearer {principal_token}', 'Content-Type': 'application/json'}
        t_headers = {'Authorization': f'Bearer {teacher_token}', 'Content-Type': 'application/json'}

        endpoints_to_test = [
            # ── Auth & Profile
            ("GET", "/api/auth/me", p_headers, None, 200),
            
            # ── Principal Dashboard & Telemetry
            ("GET", "/api/principal/dashboard", p_headers, None, 200),
            ("GET", "/api/principal/classes", p_headers, None, 200),
            ("GET", "/api/principal/teachers", p_headers, None, 200),
            ("GET", f"/api/principal/teachers/{teacher_record.id}/profile", p_headers, None, 200),
            ("GET", "/api/principal/fees/recent-collections", p_headers, None, 200),
            ("GET", "/api/principal/fees/class-summary", p_headers, None, 200),
            ("GET", "/api/principal/attendance/class-summary", p_headers, None, 200),
            ("GET", "/api/principal/teachers/attendance/today", p_headers, None, 200),
            ("GET", "/api/principal/exams", p_headers, None, 200),
            ("GET", "/api/principal/holidays", p_headers, None, 200),
            
            # ── Results & Exam Analytics
            ("GET", "/api/results/analytics/filters", p_headers, None, 200),
            ("GET", "/api/results/analytics/overview", p_headers, None, 200),
            ("GET", f"/api/results/analytics/class-students?class_id={cls.id}&exam_id={exam.id}", p_headers, None, 200),
            ("GET", "/api/results/my-assignments", t_headers, None, 200),
            ("GET", f"/api/results/roster?class_id={cls.id}&exam_id={exam.id}&subject_id={subj.id}", p_headers, None, 200),

            # ── RBAC
            ("GET", "/api/rbac/roles", p_headers, None, 200),
            ("GET", "/api/rbac/permissions", p_headers, None, 200),
            ("GET", "/api/rbac/delegations", p_headers, None, 200),

            # ── Finance
            ("GET", "/api/finance/monthly-trend?months=6", p_headers, None, 200),
            ("GET", "/api/finance/profit-summary", p_headers, None, 200),
            ("GET", "/api/finance/expenses", p_headers, None, 200),

            # ── Hostel
            ("GET", "/api/hostel/dashboard", p_headers, None, 200),
            ("GET", "/api/hostel/hostels", p_headers, None, 200),

            # ── Library
            ("GET", "/api/library/dashboard", p_headers, None, 200),
            ("GET", "/api/library/books", p_headers, None, 200),

            # ── Transport
            ("GET", "/api/transport/dashboard", p_headers, None, 200),
            ("GET", "/api/transport/vehicles", p_headers, None, 200),
            ("GET", "/api/transport/routes", p_headers, None, 200),
        ]

        passed = 0
        failed = 0
        errors_list = []

        print(f"\n{'='*70}\nSTARTING ENDPOINT VALIDATION & TELEMETRY CHECKS\n{'='*70}\n")

        for method, url, headers, data, expected_status in endpoints_to_test:
            try:
                if method == "GET":
                    res = client.get(url, headers=headers)
                elif method == "POST":
                    res = client.post(url, headers=headers, data=json.dumps(data) if data else None)
                elif method == "DELETE":
                    res = client.delete(url, headers=headers)
                
                status_ok = (res.status_code == expected_status or (expected_status == 200 and res.status_code in (200, 201)))
                if status_ok:
                    passed += 1
                    print(f"✅ [{method}] {url:<55} -> Status: {res.status_code} OK")
                else:
                    failed += 1
                    err_msg = f"❌ [{method}] {url:<55} -> Status: {res.status_code} (Expected: {expected_status}) | Body: {res.get_data(as_text=True)[:160]}"
                    print(err_msg)
                    errors_list.append(err_msg)
            except Exception as e:
                failed += 1
                err_msg = f"💥 [{method}] {url:<55} -> EXCEPTION: {str(e)}"
                print(err_msg)
                errors_list.append(err_msg)

        print(f"\n{'='*70}\nTEST SUMMARY: {passed} PASSED, {failed} FAILED\n{'='*70}\n")

        if failed == 0:
            print("🎉 ALL ENDPOINTS WORKING 100% CLEANLY WITH ZERO 500/502 ERRORS!")
        else:
            print(f"⚠️ {failed} endpoints require attention.")
            return 1
    return 0

if __name__ == '__main__':
    sys.exit(run_tests())
