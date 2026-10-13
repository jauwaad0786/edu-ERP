"""
Comprehensive Integration Test Suite:
1. Teacher Teaching Diary & Syllabus Tracker (Edumerge-inspired approvals, telemetry, topic updates)
2. Smart Timetable & Substitute Management (Cross-timetable teacher/room conflict validation, absence detection, candidate ranking, substitution lifecycle)
3. Parent Portal & Multi-Child Security Isolation (parent_user_id resolution, child switcher authorization, timetable/homework access)
"""

import unittest
from datetime import date, datetime, timedelta
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import Student, Class, Subject, Teacher
from app.models.financial import Timetable, TimetablePeriod, TimetableSubstitution
from app.models.staff_attendance import StaffAttendance
from app.models.curriculum import (
    Curriculum, CurriculumChapter, CurriculumTopic, TeachingLog
)
from app.services.substitute_service import (
    validate_timetable_conflict,
    get_affected_periods_for_date,
    get_eligible_substitutes,
    assign_substitute,
    cancel_substitute
)
from app.services.notification.recipient_resolver import RecipientResolver


class TestTeachingDiaryTimetableAndParentPortal(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()

        # 1. School
        self.school = School(
            name="Apex World Academy",
            code="AWA-001",
            current_session="2026-27",
            status="ACTIVE",
            is_active=True
        )
        db.session.add(self.school)
        db.session.flush()

        # 2. Classes
        self.cls_10a = Class(name="Class 10", section="A", school_id=self.school.id)
        self.cls_9b  = Class(name="Class 9",  section="B", school_id=self.school.id)
        self.cls_8c  = Class(name="Class 8",  section="C", school_id=self.school.id)
        db.session.add_all([self.cls_10a, self.cls_9b, self.cls_8c])
        db.session.flush()

        # 3. Users
        self.principal_user = User(
            name="Principal Miller",
            email="principal@apexworld.edu",
            role=UserRole.PRINCIPAL,
            school_id=self.school.id,
            is_active=True
        )
        self.principal_user.set_password("AdminPass@123")

        self.teacher_user_1 = User(
            name="Alice Smith",
            email="alice@apexworld.edu",
            role=UserRole.TEACHER,
            school_id=self.school.id,
            is_active=True
        )
        self.teacher_user_1.set_password("TeacherPass@123")

        self.teacher_user_2 = User(
            name="Bob Jones",
            email="bob@apexworld.edu",
            role=UserRole.TEACHER,
            school_id=self.school.id,
            is_active=True
        )
        self.teacher_user_2.set_password("TeacherPass@123")

        self.parent_user = User(
            name="Vikram Sharma",
            email="vikram@parent.com",
            phone="9876500001",
            role=UserRole.PARENT,
            school_id=self.school.id,
            is_active=True
        )
        self.parent_user.set_password("ParentPass@123")

        self.student_user_1 = User(
            name="Rohan Sharma",
            email="rohan@student.com",
            role=UserRole.STUDENT,
            school_id=self.school.id,
            is_active=True
        )
        self.student_user_1.set_password("StudentPass@123")

        self.student_user_2 = User(
            name="Riya Sharma",
            email="riya@student.com",
            role=UserRole.STUDENT,
            school_id=self.school.id,
            is_active=True
        )
        self.student_user_2.set_password("StudentPass@123")

        self.other_parent_user = User(
            name="Unrelated Parent",
            email="other@parent.com",
            role=UserRole.PARENT,
            school_id=self.school.id,
            is_active=True
        )
        self.other_parent_user.set_password("OtherPass@123")

        self.unrelated_student_user = User(
            name="Other Student",
            email="otherstudent@student.com",
            role=UserRole.STUDENT,
            school_id=self.school.id,
            is_active=True
        )
        self.unrelated_student_user.set_password("StudentPass@123")

        db.session.add_all([
            self.principal_user, self.teacher_user_1, self.teacher_user_2,
            self.parent_user, self.student_user_1, self.student_user_2,
            self.other_parent_user, self.unrelated_student_user
        ])
        db.session.flush()

        # 4. Teachers
        self.teacher_1 = Teacher(
            user_id=self.teacher_user_1.id,
            school_id=self.school.id,
            employee_id="TCH-001",
            department="Mathematics"
        )
        self.teacher_2 = Teacher(
            user_id=self.teacher_user_2.id,
            school_id=self.school.id,
            employee_id="TCH-002",
            department="Mathematics"
        )
        db.session.add_all([self.teacher_1, self.teacher_2])
        db.session.flush()

        # 5. Subjects
        self.sub_math = Subject(name="Mathematics", code="MTH-10", school_id=self.school.id, class_id=self.cls_10a.id, teacher_id=self.teacher_1.id)
        self.sub_sci  = Subject(name="Science", code="SCI-10", school_id=self.school.id, class_id=self.cls_10a.id, teacher_id=self.teacher_2.id)
        db.session.add_all([self.sub_math, self.sub_sci])
        db.session.flush()

        # 6. Students (Linked to parent_user)
        self.student_1 = Student(
            user_id=self.student_user_1.id,
            parent_user_id=self.parent_user.id,
            school_id=self.school.id,
            class_id=self.cls_10a.id,
            roll_number="101",
            admission_no="ADM-101",
            dob=date(2010, 1, 1),
            gender="MALE",
            parent_name="Vikram Sharma",
            parent_phone="9876500001",
            session="2026-27"
        )
        self.student_2 = Student(
            user_id=self.student_user_2.id,
            parent_user_id=self.parent_user.id,
            school_id=self.school.id,
            class_id=self.cls_9b.id,
            roll_number="201",
            admission_no="ADM-201",
            dob=date(2011, 2, 2),
            gender="FEMALE",
            parent_name="Vikram Sharma",
            parent_phone="9876500001",
            session="2026-27"
        )
        self.unrelated_student = Student(
            user_id=self.unrelated_student_user.id,
            school_id=self.school.id,
            parent_user_id=self.other_parent_user.id,
            class_id=self.cls_8c.id,
            roll_number="301",
            admission_no="ADM-301",
            dob=date(2012, 3, 3),
            gender="MALE",
            parent_name="Other Parent",
            session="2026-27"
        )
        db.session.add_all([self.student_1, self.student_2, self.unrelated_student])
        db.session.flush()

        # 7. Timetables
        self.tt_10a = Timetable(
            school_id=self.school.id,
            class_id=self.cls_10a.id,
            session="2026-27",
            title="Class 10A Regular",
            status="PUBLISHED"
        )
        self.tt_9b = Timetable(
            school_id=self.school.id,
            class_id=self.cls_9b.id,
            session="2026-27",
            title="Class 9B Regular",
            status="PUBLISHED"
        )
        db.session.add_all([self.tt_10a, self.tt_9b])
        db.session.flush()

        # 8. Timetable Periods
        self.period_10a_p1 = TimetablePeriod(
            timetable_id=self.tt_10a.id,
            day="MON",
            period_no=1,
            subject_id=self.sub_math.id,
            teacher_id=self.teacher_1.id,
            start_time="09:00 AM",
            end_time="09:45 AM",
            room="Room 101",
            period_type="LECTURE"
        )
        self.period_10a_p2 = TimetablePeriod(
            timetable_id=self.tt_10a.id,
            day="MON",
            period_no=2,
            subject_id=self.sub_sci.id,
            teacher_id=self.teacher_2.id,
            start_time="09:45 AM",
            end_time="10:30 AM",
            room="Room 101",
            period_type="LECTURE"
        )
        db.session.add_all([self.period_10a_p1, self.period_10a_p2])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def _get_headers(self, user):
        token = create_access_token(identity=str(user.id))
        return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    # ═══════════════════════════════════════════════════════════════════════════
    # 1. TEACHER TEACHING DIARY + SYLLABUS TRACKER TESTS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_record_teaching_log_and_approval_lifecycle(self):
        """Test teacher records daily teaching log, HOD approves it, and overview updates."""
        # Setup Curriculum with 1 Chapter and 1 Topic
        curr = Curriculum(
            school_id=self.school.id,
            class_id=self.cls_10a.id,
            subject_id=self.sub_math.id,
            session="2026-27",
            book_name="NCERT Math",
            estimated_periods=40
        )
        db.session.add(curr)
        db.session.flush()

        ch = CurriculumChapter(
            curriculum_id=curr.id,
            chapter_no=1,
            title="Real Numbers",
            estimated_periods=10
        )
        db.session.add(ch)
        db.session.flush()

        top = CurriculumTopic(
            chapter_id=ch.id,
            topic_no=1,
            title="Fundamental Theorem of Arithmetic",
            planned_periods=2
        )
        db.session.add(top)
        db.session.commit()

        # Teacher posts a daily diary log
        payload = {
            "class_id": self.cls_10a.id,
            "subject_id": self.sub_math.id,
            "period_no": 1,
            "date": "2026-10-13",
            "session": "2026-27",
            "chapter_id": ch.id,
            "topic_id": top.id,
            "subtopic_title": "Prime Factorisation",
            "periods_spent": 1.0,
            "topic_completion_status": "COMPLETED",
            "teaching_methodology": "Interactive / Discussion",
            "classwork_summary": "Solved Exercise 1.2 questions 1-5.",
            "has_homework": True,
            "homework_title": "Exercise 1.2 Practice",
            "homework_description": "Complete remaining Q6-Q8 in homework notebook.",
            "homework_due_date": "2026-10-14"
        }

        resp = self.client.post(
            '/curriculum/teaching-diary/entry',
            headers=self._get_headers(self.teacher_user_1),
            json=payload
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        log_id = data['log']['id']
        self.assertEqual(data['log']['approval_status'], 'PENDING')
        self.assertEqual(data['log']['homework_title'], 'Exercise 1.2 Practice')

        # Check curriculum overview telemetry before approval
        resp_overview = self.client.get(
            '/api/curriculum/overview?session=2026-27',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_overview.status_code, 200)
        ov_data = resp_overview.get_json()
        self.assertEqual(ov_data['kpi_cards']['total_lesson_plans'], 1)
        self.assertEqual(ov_data['kpi_cards']['pending_approval'], 1)
        self.assertEqual(ov_data['kpi_cards']['approved'], 0)

        # Principal approves the teaching log
        resp_appr = self.client.post(
            f'/api/curriculum/teaching-logs/{log_id}/approval',
            headers=self._get_headers(self.principal_user),
            json={'approval_status': 'APPROVED', 'remarks': 'Great lesson coverage'}
        )
        self.assertEqual(resp_appr.status_code, 200)
        self.assertEqual(resp_appr.get_json()['log']['approval_status'], 'APPROVED')

        # Check curriculum overview telemetry after approval
        resp_overview_after = self.client.get(
            '/api/curriculum/overview?session=2026-27',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_overview_after.status_code, 200)
        ov_after = resp_overview_after.get_json()
        self.assertEqual(ov_after['kpi_cards']['approved'], 1)
        self.assertEqual(ov_after['kpi_cards']['pending_approval'], 0)

    # ═══════════════════════════════════════════════════════════════════════════
    # 2. SMART TIMETABLE + SUBSTITUTE MANAGEMENT TESTS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_timetable_conflict_validation_detects_teacher_and_room_collision(self):
        """Test conflict check rejects cross-timetable teacher double-booking & room clashes."""
        # 1. Teacher Collision:
        # Teacher 1 is already booked in tt_10a at MON Period 1.
        # Attempt to book Teacher 1 in tt_9b at MON Period 1:
        conflict = validate_timetable_conflict(
            school_id=self.school.id,
            timetable_id=self.tt_9b.id,
            day="MON",
            period_no=1,
            teacher_id=self.teacher_1.id,
            room="Room 202"
        )
        self.assertIsNotNone(conflict)
        self.assertEqual(conflict['type'], 'TEACHER_COLLISION')
        self.assertIn("Teacher Alice Smith is already assigned", conflict['message'])

        # API endpoint should return HTTP 409
        resp = self.client.post(
            f'/principal/timetables/{self.tt_9b.id}/periods',
            headers=self._get_headers(self.principal_user),
            json={
                "day": "MON",
                "period_no": 1,
                "teacher_id": self.teacher_1.id,
                "subject_id": self.sub_math.id,
                "room": "Room 202"
            }
        )
        self.assertEqual(resp.status_code, 409)

        # 2. Room Collision:
        # Room 101 is already booked at MON Period 1.
        # Attempt to book Room 101 with Teacher 2 in tt_9b:
        room_conflict = validate_timetable_conflict(
            school_id=self.school.id,
            timetable_id=self.tt_9b.id,
            day="MON",
            period_no=1,
            teacher_id=self.teacher_2.id,
            room="Room 101"
        )
        self.assertIsNotNone(room_conflict)
        self.assertEqual(room_conflict['type'], 'ROOM_COLLISION')
        self.assertIn("Room Room 101 is already allocated", room_conflict['message'])

        # 3. No Conflict when free:
        # Teacher 2 in Room 202 at MON Period 1:
        no_conflict = validate_timetable_conflict(
            school_id=self.school.id,
            timetable_id=self.tt_9b.id,
            day="MON",
            period_no=1,
            teacher_id=self.teacher_2.id,
            room="Room 202"
        )
        self.assertIsNone(no_conflict)

    def test_daily_substitute_workflow_and_period_enrichment(self):
        """Test absent teacher detection, candidate ranking, substitute assignment, and grid enrichment."""
        target_date = "2026-10-19" # A Monday

        # 1. Record Teacher 1 absent in StaffAttendance
        att = StaffAttendance(
            school_id=self.school.id,
            user_id=self.teacher_user_1.id,
            attendance_date=date(2026, 10, 19),
            status="ABSENT"
        )
        db.session.add(att)
        db.session.commit()

        # 2. Daily affected periods endpoint detects Teacher 1's period (Period 1 in Class 10A)
        resp_daily = self.client.get(
            f'/api/principal/substitutes/daily?date={target_date}',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_daily.status_code, 200)
        affected = resp_daily.get_json()
        self.assertEqual(len(affected), 1)
        self.assertEqual(affected[0]['period_id'], self.period_10a_p1.id)
        self.assertEqual(affected[0]['original_teacher_name'], "Alice Smith")

        # 3. Candidate ranking endpoint recommends Teacher 2 (who is free during Period 1)
        resp_cand = self.client.get(
            f'/api/principal/substitutes/candidates?period_id={self.period_10a_p1.id}&date={target_date}',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_cand.status_code, 200)
        candidates = resp_cand.get_json()
        self.assertTrue(len(candidates) >= 1)
        cand_ids = [c['teacher_id'] for c in candidates]
        self.assertIn(self.teacher_2.id, cand_ids)

        # 4. Assign Teacher 2 as substitute
        resp_assign = self.client.post(
            '/api/principal/substitutes/assign',
            headers=self._get_headers(self.principal_user),
            json={
                "date": target_date,
                "period_id": self.period_10a_p1.id,
                "substitute_teacher_id": self.teacher_2.id,
                "reason": "Teacher on sick leave",
                "notes": "Cover chapter 1 exercises"
            }
        )
        self.assertEqual(resp_assign.status_code, 200)
        subst_data = resp_assign.get_json()['substitution']
        subst_id = subst_data['id']
        self.assertEqual(subst_data['substitute_teacher_id'], self.teacher_2.id)

        # 5. Check timetable periods endpoint returns enriched substitution data
        resp_periods = self.client.get(
            f'/principal/timetables/{self.tt_10a.id}/periods?date={target_date}',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_periods.status_code, 200)
        periods_data = resp_periods.get_json()
        p1 = next(p for p in periods_data if p['id'] == self.period_10a_p1.id)
        self.assertTrue(p1['is_substituted'])
        self.assertIsNotNone(p1['substitution'])
        self.assertEqual(p1['substitution']['substitute_teacher_name'], "Bob Jones")

        # 6. Cancel substitution
        resp_del = self.client.delete(
            f'/api/principal/substitutes/{subst_id}',
            headers=self._get_headers(self.principal_user)
        )
        self.assertEqual(resp_del.status_code, 200)

        # Verify no longer active
        resp_periods_after = self.client.get(
            f'/principal/timetables/{self.tt_10a.id}/periods?date={target_date}',
            headers=self._get_headers(self.principal_user)
        )
        p1_after = next(p for p in resp_periods_after.get_json() if p['id'] == self.period_10a_p1.id)
        self.assertFalse(p1_after['is_substituted'])

    # ═══════════════════════════════════════════════════════════════════════════
    # 3. PARENT PORTAL & SMART NOTIFICATIONS TESTS
    # ═══════════════════════════════════════════════════════════════════════════

    def test_parent_multi_child_switching_and_access_isolation(self):
        """Test parent views linked children, accesses their timetables, and cannot access other children."""
        # Parent requests /children
        resp_children = self.client.get(
            '/api/student/children',
            headers=self._get_headers(self.parent_user)
        )
        self.assertEqual(resp_children.status_code, 200)
        children = resp_children.get_json()
        self.assertEqual(len(children), 2)
        child_ids = [c['id'] for c in children]
        self.assertIn(self.student_1.id, child_ids)
        self.assertIn(self.student_2.id, child_ids)
        self.assertNotIn(self.unrelated_student.id, child_ids)

        # Parent accesses Timetable for Child 1 (Class 10A)
        resp_tt1 = self.client.get(
            f'/api/student/timetable?student_id={self.student_1.id}',
            headers=self._get_headers(self.parent_user)
        )
        self.assertEqual(resp_tt1.status_code, 200)
        self.assertEqual(resp_tt1.get_json()['student_id'], self.student_1.id)
        self.assertEqual(len(resp_tt1.get_json()['periods']), 2)

        # Parent attempts to access Timetable for Unrelated Student -> HTTP 403 Forbidden!
        resp_forbidden = self.client.get(
            f'/api/student/timetable?student_id={self.unrelated_student.id}',
            headers=self._get_headers(self.parent_user)
        )
        self.assertEqual(resp_forbidden.status_code, 403)
        self.assertIn("Unauthorized child access", resp_forbidden.get_json()['error'])

    def test_notification_recipient_resolver_resolves_parent_user_id(self):
        """Test RecipientResolver finds parent user via student's parent_user_id."""
        targets = {
            "type": "student_ids",
            "student_ids": [self.student_1.id]
        }
        recipients = RecipientResolver.resolve(self.school.id, targets)
        # Parent user ID must be in resolved recipients
        self.assertIn(self.parent_user.id, recipients)


if __name__ == '__main__':
    unittest.main()
