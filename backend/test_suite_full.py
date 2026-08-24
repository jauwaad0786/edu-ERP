import os
import sys
import json
from datetime import date, datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['SUPER_ADMIN_PASSWORD'] = 'SuperAdmin@123'

from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Class, Subject, Student, Teacher, Attendance, Marks, Note
from app.models.financial import FeeRecord, FeeStructure, FeeTransaction, ExamSchedule, ExamTimetable, Holiday
from app.models.finance import Expense, InventoryItem, Vendor
from app.models.hostel import Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed, HostelBedAllocation
from app.models.library import Book, BookCategory, LibraryMember, BookIssue
from app.models.transport import Vehicle, Driver, Route, Stop, RouteStop
from app.models.transport_student import StudentTransport
from app.models.rbac import Role, UserRoleAssignment
from app.models.communication import SupportTicket, SupportNotification, Announcement, MeetingRequest
from flask_jwt_extended import create_access_token

def run_comprehensive_tests():
    app = create_app('development')
    app.config['TESTING'] = True

    with app.app_context():
        db.create_all()

        # Seed super admin
        super_admin = User.query.filter_by(role=UserRole.SUPER_ADMIN).first()
        if not super_admin:
            super_admin = User(name='Super Admin', email='admin@eduErp.com', role=UserRole.SUPER_ADMIN)
            super_admin.set_password('SuperAdmin@123')
            db.session.add(super_admin)
            db.session.commit()

        # Create or find School
        school = School.query.filter_by(code='TEST_SCH_01').first()
        if not school:
            school = School(
                name="Test High School",
                code="TEST_SCH_01",
                address="123 Test Street",
                city="Metropolis",
                state="State",
                phone="9876543210",
                email="admin@testhigh.edu",
                plan="ENTERPRISE",
                enabled_features=json.dumps(['student_management', 'attendance_tracking', 'fee_management', 'result_management', 'hrms_module', 'whatsapp_notifications', 'library_management', 'hostel_management', 'transport_management'])
            )
            db.session.add(school)
            db.session.commit()

        # Create Principal
        principal = User.query.filter_by(email='principal@testhigh.edu').first()
        if not principal:
            principal = User(
                name="Principal John Doe",
                email="principal@testhigh.edu",
                role=UserRole.PRINCIPAL,
                school_id=school.id,
                phone="9876543211"
            )
            principal.set_password("Principal@123")
            db.session.add(principal)
            db.session.commit()

        # Create Teacher
        teacher_user = User.query.filter_by(email='teacher@testhigh.edu').first()
        if not teacher_user:
            teacher_user = User(
                name="Prof. Alan Smith",
                email="teacher@testhigh.edu",
                role=UserRole.TEACHER,
                school_id=school.id,
                phone="9876543212"
            )
            teacher_user.set_password("Teacher@123")
            db.session.add(teacher_user)
            db.session.commit()

        teacher_rec = Teacher.query.filter_by(user_id=teacher_user.id).first()
        if not teacher_rec:
            teacher_rec = Teacher(
                user_id=teacher_user.id,
                school_id=school.id,
                employee_id="TCH-TEST-001",
                department="Science",
                designation="Senior PGT",
                dob=date(1985, 3, 20),
                joining_date=date(2020, 1, 15),
                salary=45000.0
            )
            db.session.add(teacher_rec)
            db.session.commit()

        # Create Class
        cls = Class.query.filter_by(school_id=school.id, name="Grade 10").first()
        if not cls:
            cls = Class(name="Grade 10", section="A", session="2024-25", school_id=school.id, teacher_id=teacher_rec.id)
            db.session.add(cls)
            db.session.commit()

        # Create Subject
        subj = Subject.query.filter_by(class_id=cls.id, name="Physics").first()
        if not subj:
            subj = Subject(name="Physics", code="PHY101", class_id=cls.id, teacher_id=teacher_rec.id, school_id=school.id, max_marks=100, pass_marks=33)
            db.session.add(subj)
            db.session.commit()

        # Create Student
        student_user = User.query.filter_by(email='student@testhigh.edu').first()
        if not student_user:
            student_user = User(
                name="John Junior",
                email="student@testhigh.edu",
                role=UserRole.STUDENT,
                school_id=school.id,
                phone="9876543213"
            )
            student_user.set_password("Student@123")
            db.session.add(student_user)
            db.session.commit()

        student_rec = Student.query.filter_by(user_id=student_user.id).first()
        if not student_rec:
            student_rec = Student(
                user_id=student_user.id,
                school_id=school.id,
                class_id=cls.id,
                roll_number="10",
                admission_no="ADM-2024-999",
                parent_name="Robert Doe",
                parent_phone="9998887770",
                father_name="Robert Doe"
            )
            db.session.add(student_rec)
            db.session.commit()

        # Create Exam
        exam = ExamSchedule.query.filter_by(school_id=school.id).first()
        if not exam:
            exam = ExamSchedule(
                school_id=school.id,
                exam_name="Annual Exam 2026",
                exam_type="FINAL",
                session="2024-25",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=7),
                is_published=True
            )
            db.session.add(exam)
            db.session.commit()

        # Create Timetable item
        tt_item = ExamTimetable.query.filter_by(exam_id=exam.id, class_id=cls.id, subject_id=subj.id).first()
        if not tt_item:
            tt_item = ExamTimetable(
                exam_id=exam.id,
                class_id=cls.id,
                subject_id=subj.id,
                exam_date=date.today() + timedelta(days=2),
                start_time="09:00",
                end_time="12:00",
                max_marks=100,
                pass_marks=33
            )
            db.session.add(tt_item)
            db.session.commit()

        # Tokens
        super_token = create_access_token(identity=str(super_admin.id))
        principal_token = create_access_token(identity=str(principal.id))
        teacher_token = create_access_token(identity=str(teacher_user.id))
        student_token = create_access_token(identity=str(student_user.id))

        admin_h = {'Authorization': f'Bearer {super_token}', 'Content-Type': 'application/json'}
        prin_h = {'Authorization': f'Bearer {principal_token}', 'Content-Type': 'application/json'}
        teach_h = {'Authorization': f'Bearer {teacher_token}', 'Content-Type': 'application/json'}
        stud_h = {'Authorization': f'Bearer {student_token}', 'Content-Type': 'application/json'}

        client = app.test_client()

        test_cases = [
            # ── Auth & Identity ──
            ("POST", "/api/auth/login", None, {"identifier": "principal@testhigh.edu", "password": "Principal@123"}, 200, "Principal login"),
            ("POST", "/api/auth/student-login", None, {"phone": "9998887770", "name": "John Junior", "password": "Student@123"}, 200, "Student mobile login"),
            ("GET", "/api/auth/me", prin_h, None, 200, "Auth /me endpoint"),
            ("GET", "/api/auth/me/salary-records", teach_h, None, 200, "Teacher salary records"),
            
            # ── Admin Routes ──
            ("GET", "/api/admin/features/catalog", admin_h, None, 200, "Admin feature catalog"),
            ("GET", "/api/admin/schools", admin_h, None, 200, "Admin schools list"),
            ("GET", f"/api/admin/schools/{school.id}", admin_h, None, 200, "Admin school detail"),
            ("GET", f"/api/admin/schools/{school.id}/service-charges", admin_h, None, 200, "Admin service charges list"),

            # ── Principal Routes ──
            ("GET", "/api/principal/dashboard", prin_h, None, 200, "Principal dashboard"),
            ("GET", "/api/principal/classes", prin_h, None, 200, "Principal classes list"),
            ("GET", "/api/principal/teachers", prin_h, None, 200, "Principal teachers list"),
            ("GET", f"/api/principal/teachers/{teacher_rec.id}/profile", prin_h, None, 200, "Teacher profile view"),
            ("GET", "/api/principal/students", prin_h, None, 200, "Principal students list"),
            ("GET", f"/api/principal/students/{student_rec.id}", prin_h, None, 200, "Student REST /students/<id> view"),
            ("GET", f"/api/principal/students/{student_rec.id}/profile", prin_h, None, 200, "Student profile view"),
            ("GET", "/api/principal/subjects", prin_h, None, 200, "Principal subjects list"),
            ("GET", "/api/principal/fees/summary", prin_h, None, 200, "Fees summary"),
            ("GET", "/api/principal/fees/class-summary", prin_h, None, 200, "Fees class summary"),
            ("GET", "/api/principal/attendance/class-summary", prin_h, None, 200, "Attendance class summary"),
            ("GET", "/api/principal/teachers/attendance/today", prin_h, None, 200, "Teacher attendance today"),
            ("GET", "/api/principal/holidays", prin_h, None, 200, "Holidays list"),
            ("GET", "/api/principal/timetables", prin_h, None, 200, "Timetables list"),
            ("GET", f"/api/principal/admit-card/{student_rec.id}/{exam.id}", stud_h, None, 200, "Student self-download Admit Card PDF"),
            ("GET", f"/api/principal/result-card/{student_rec.id}/{exam.id}", stud_h, None, 200, "Student self-download Result Card PDF"),
            ("GET", f"/api/principal/students/{student_rec.id}/id-card", stud_h, None, 200, "Student self-download ID Card PDF"),

            # ── Marks & Results ──
            ("GET", f"/api/marks/grid?class_id={cls.id}&exam_id={exam.id}", prin_h, None, 200, "Marks grid view"),
            ("GET", "/api/results/analytics/filters", prin_h, None, 200, "Result analytics filters"),
            ("GET", "/api/results/analytics/overview", prin_h, None, 200, "Result analytics overview"),
            ("GET", "/api/results/my-assignments", teach_h, None, 200, "Teacher result assignments"),

            # ── Finance ──
            ("GET", "/api/finance/expenses", prin_h, None, 200, "Finance expenses"),
            ("GET", "/api/finance/profit-summary", prin_h, None, 200, "Finance profit summary"),
            ("GET", "/api/finance/monthly-trend", prin_h, None, 200, "Finance monthly trend"),
            ("GET", "/api/finance/inventory", prin_h, None, 200, "Finance inventory"),
            ("GET", "/api/finance/vendors", prin_h, None, 200, "Finance vendors"),

            # ── Hostel ──
            ("GET", "/api/hostel/dashboard", prin_h, None, 200, "Hostel dashboard"),
            ("GET", "/api/hostel/hostels", prin_h, None, 200, "Hostel list"),
            ("GET", "/api/hostel/reports/occupancy", prin_h, None, 200, "Hostel occupancy report"),

            # ── Library ──
            ("GET", "/api/library/dashboard", prin_h, None, 200, "Library dashboard"),
            ("GET", "/api/library/books", prin_h, None, 200, "Library books"),
            ("GET", "/api/library/members", prin_h, None, 200, "Library members"),
            ("GET", "/api/library/categories", prin_h, None, 200, "Library categories"),

            # ── Transport ──
            ("GET", "/api/transport/dashboard", prin_h, None, 200, "Transport dashboard"),
            ("GET", "/api/transport/vehicles", prin_h, None, 200, "Transport vehicles"),
            ("GET", "/api/transport/drivers", prin_h, None, 200, "Transport drivers"),
            ("GET", "/api/transport/routes", prin_h, None, 200, "Transport routes"),

            # ── Staff Attendance ──
            ("GET", "/api/staff-attendance/settings", prin_h, None, 200, "Staff attendance settings"),
            ("GET", "/api/staff-attendance/employees", prin_h, None, 200, "Staff attendance employees list"),
            ("GET", "/api/staff-attendance/regularization", prin_h, None, 200, "Staff attendance regularization list"),

            # ── RBAC ──
            ("GET", "/api/rbac/roles", prin_h, None, 200, "RBAC roles list"),
            ("GET", "/api/rbac/permissions", prin_h, None, 200, "RBAC permissions list"),
            ("GET", "/api/rbac/delegations", prin_h, None, 200, "RBAC delegations list"),

            # ── Communication ──
            ("GET", "/api/support/tickets", prin_h, None, 200, "Support tickets list"),
            ("GET", "/api/support/notifications", prin_h, None, 200, "Support notifications list"),
            ("GET", "/api/support/announcements", prin_h, None, 200, "Announcements list"),
            ("GET", "/api/support/meetings", prin_h, None, 200, "Meetings list"),
            ("GET", "/api/support/kb", prin_h, None, 200, "Knowledge base articles list"),
            ("GET", "/api/support/chat/inbox", prin_h, None, 200, "Chat inbox"),

            # ── Developer Center & Audit ──
            ("GET", "/api/developer/health", admin_h, None, 200, "Developer health status"),
            ("GET", "/api/developer/errors", admin_h, None, 200, "Developer errors list"),
            ("GET", "/api/developer/issues", admin_h, None, 200, "Developer issues board"),
            ("GET", "/api/audit/school/logs", prin_h, None, 200, "School audit logs"),
            ("GET", "/api/audit/company/logs", admin_h, None, 200, "Company audit logs"),
        ]

        passed = 0
        failed = 0
        failures = []

        print(f"\n{'='*75}\nRUNNING COMPREHENSIVE ERP MODULE & ENDPOINT TEST SUITE\n{'='*75}\n")

        for method, url, headers, data, expected_status, name in test_cases:
            try:
                if method == "GET":
                    res = client.get(url, headers=headers)
                elif method == "POST":
                    res = client.post(url, headers=headers, json=data)
                elif method == "PUT":
                    res = client.put(url, headers=headers, json=data)
                elif method == "DELETE":
                    res = client.delete(url, headers=headers)

                status_ok = (res.status_code == expected_status or (expected_status == 200 and res.status_code in (200, 201)))
                if status_ok:
                    passed += 1
                    print(f"✅ {name:<48} [{method} {url:<48}] -> {res.status_code}")
                else:
                    failed += 1
                    err = f"❌ {name:<48} [{method} {url:<48}] -> {res.status_code} (Expected {expected_status}) | Body: {res.get_data(as_text=True)[:180]}"
                    print(err)
                    failures.append(err)
            except Exception as ex:
                failed += 1
                err = f"💥 {name:<48} [{method} {url:<48}] -> EXCEPTION: {ex}"
                print(err)
                failures.append(err)

        print(f"\n{'='*75}\nTEST RESULTS: {passed} PASSED, {failed} FAILED\n{'='*75}\n")
        return failed

if __name__ == '__main__':
    err_count = run_comprehensive_tests()
    sys.exit(err_count)
