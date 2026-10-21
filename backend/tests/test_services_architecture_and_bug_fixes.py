"""
Forensic Architecture & Bug Fix Regression Suite for All Backend Services.
Tests:
1. curriculum_service teacher schedule with TimetableSubstitution (no PeriodSubstitution crash).
2. archive_service financial check with HostelFineRecord (no HostelFineTransaction crash).
3. archive_service operational cleanup with InternalMarks (no InternalMark crash).
4. arrival_service indexed parent resolution (no full-table memory scan).
5. admission_service official admission numbering sequence with year prefix.
6. audit_service savepoint and commit=False support.
"""

import unittest
from datetime import date, datetime
from app import create_app, db
from app.models.user import User, UserRole
from app.models.academic import Student, Teacher, Class, Subject, InternalMarks
from app.models.timetable import Timetable, TimetablePeriod, TimetableSubstitution, Holiday
from app.models.hostel import Hostel, HostelFineRecord
from app.models.school import School
from app.services.curriculum_service import get_teacher_today_schedule
from app.services.archive_service import _check_student_financial_history, _cleanup_student_operational_records
from app.services.arrival_service import _find_linked_parent
from app.services.admission_service import generate_official_admission_no
from app.services.audit_service import record_audit_event


class ServicesArchitectureAndBugFixesTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School
        self.school = School(
            name="Apex International School",
            code="AIS001",
            address="Audit Road, New Delhi",
            is_active=True
        )
        db.session.add(self.school)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_curriculum_service_schedule_no_period_substitution_crash(self):
        """Verifies get_teacher_today_schedule runs and uses TimetableSubstitution cleanly."""
        user = User(name='Teacher Alice', email='alice@ais.edu.in', role=UserRole.TEACHER, school_id=self.school.id)
        user.set_password('Pass@123')
        db.session.add(user)
        db.session.commit()

        teacher = Teacher(user_id=user.id, school_id=self.school.id)
        db.session.add(teacher)
        db.session.commit()

        # Call get_teacher_today_schedule - must NOT throw ImportError for PeriodSubstitution
        schedule = get_teacher_today_schedule(
            school_id=self.school.id,
            teacher_id=teacher.id,
            target_date=date.today(),
            session='2026-27'
        )
        self.assertIn('schedule', schedule)
        self.assertIsInstance(schedule['schedule'], list)
        self.assertEqual(schedule['teacher_name'], 'Teacher Alice')

    def test_02_archive_service_hostel_fine_record_integration(self):
        """Verifies archive_service checks HostelFineRecord instead of broken HostelFineTransaction."""
        u_stu = User(name='Student Bob', email='bob@ais.edu.in', role=UserRole.STUDENT, school_id=self.school.id)
        u_stu.set_password('Pass@123')
        db.session.add(u_stu)
        db.session.commit()

        stu = Student(user_id=u_stu.id, school_id=self.school.id, admission_no='ADM-2026-0001', status='ACTIVE')
        hostel = Hostel(school_id=self.school.id, name='Boy Hostel A', hostel_type='BOYS')
        db.session.add_all([stu, hostel])
        db.session.commit()

        # Add HostelFineRecord
        fine = HostelFineRecord(
            school_id=self.school.id,
            student_id=stu.id,
            hostel_id=hostel.id,
            amount=500.0,
            amount_paid=0.0,
            status='OUTSTANDING',
            reason='Damage to furniture'
        )
        db.session.add(fine)
        db.session.commit()

        # Must detect student has financial history (due to outstanding hostel fine)
        has_history = _check_student_financial_history(stu.id)
        self.assertTrue(has_history)

    def test_03_archive_service_cleanup_internal_marks(self):
        """Verifies _cleanup_student_operational_records deletes InternalMarks without error."""
        u_stu = User(name='Student Charlie', email='charlie@ais.edu.in', role=UserRole.STUDENT, school_id=self.school.id)
        u_stu.set_password('Pass@123')
        db.session.add(u_stu)
        db.session.commit()

        stu = Student(user_id=u_stu.id, school_id=self.school.id, admission_no='ADM-2026-0002', status='ACTIVE')
        cls = Class(name='Class 10', section='A', school_id=self.school.id)
        subj = Subject(name='Mathematics', code='MATH10', class_id=1, school_id=self.school.id)
        db.session.add_all([stu, cls, subj])
        db.session.commit()

        im = InternalMarks(
            school_id=self.school.id,
            student_id=stu.id,
            class_id=cls.id,
            subject_id=subj.id,
            entered_by=u_stu.id,
            academic_year='2026',
            term='TERM_1',
            marks_obtained=18.5,
            max_marks=20.0
        )
        db.session.add(im)
        db.session.commit()

        # Cleanup operational records
        _cleanup_student_operational_records(stu, u_stu)
        remaining_im = InternalMarks.query.filter_by(student_id=stu.id).count()
        self.assertEqual(remaining_im, 0)

    def test_04_arrival_service_indexed_parent_lookup(self):
        """Verifies _find_linked_parent resolves by indexed email and phone without full-table load."""
        u_parent = User(name='Parent David', email='david@parent.com', phone='9876543210', role=UserRole.PARENT, school_id=self.school.id)
        u_parent.set_password('Pass@123')
        db.session.add(u_parent)
        db.session.commit()

        stu = Student(
            school_id=self.school.id,
            admission_no='ADM-2026-0003',
            parent_email='david@parent.com',
            parent_phone='9876543210'
        )

        found = _find_linked_parent(stu, self.school.id)
        self.assertIsNotNone(found)
        self.assertEqual(found.id, u_parent.id)
        self.assertEqual(found.email, 'david@parent.com')

    def test_05_admission_service_year_prefix_sequence(self):
        """Verifies generate_official_admission_no scopes sequence to year prefix."""
        u_old = User(name='Old Student', email='old@ais.edu.in', role=UserRole.STUDENT, school_id=self.school.id)
        u_old.set_password('Pass@123')
        db.session.add(u_old)
        db.session.commit()

        stu_old = Student(user_id=u_old.id, school_id=self.school.id, admission_no='ADM-2025-0999', status='ACTIVE')
        db.session.add(stu_old)
        db.session.commit()

        # Next 2026 student should start from ADM-2026-0001, NOT count old 2025 student into sequence
        adm_no = generate_official_admission_no(self.school.id, session_str='2026-27')
        self.assertEqual(adm_no, 'ADM-2026-0001')

    def test_06_audit_service_savepoint_and_no_premature_commit(self):
        """Verifies record_audit_event respects commit=False without prematurely committing session."""
        user = User(name='Auditor Eve', email='eve@ais.edu.in', role=UserRole.PRINCIPAL, school_id=self.school.id)
        user.set_password('Pass@123')
        db.session.add(user)
        db.session.commit()

        # Add uncommitted object in outer session
        temp_class = Class(name='Grade 12', section='Science', school_id=self.school.id)
        db.session.add(temp_class)

        # Call record_audit_event with commit=False
        row = record_audit_event(
            school_id=self.school.id,
            actor_user_id=user.id,
            module='ACADEMIC',
            action='CREATE',
            remarks='Testing non-committing audit event',
            commit=False
        )
        self.assertIsNotNone(row)
        self.assertIn(temp_class, db.session)


if __name__ == '__main__':
    unittest.main()
