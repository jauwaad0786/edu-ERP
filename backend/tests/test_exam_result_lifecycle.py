import unittest
import json
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Class, Subject, Student, Teacher, Marks
from app.models.financial import (
    ExamSchedule, ExamClass, ExamSubject, ExamTimetable,
    ExamTeacherDelegation, ResultVersion
)
from app.routes.result_management import ClassResultPublication, ResultSubjectStatus
from flask_jwt_extended import create_access_token


class ExamAndResultLifecycleTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # ── Setup Schools ──
        self.school_a = School(name='Springfield High', code='SCH-A', is_active=True)
        self.school_b = School(name='Shelbyville Academy', code='SCH-B', is_active=True)
        db.session.add_all([self.school_a, self.school_b])
        db.session.commit()

        # ── Setup Users ──
        # School A Principal
        self.u_princ_a = User(name='Principal Skinner', email='skinner@springfield.edu', role=UserRole.PRINCIPAL, school_id=self.school_a.id)
        self.u_princ_a.set_password('pass123')
        # School A Teacher 1 (Math)
        self.u_t1_a = User(name='Teacher Edna', email='edna@springfield.edu', role=UserRole.TEACHER, school_id=self.school_a.id)
        self.u_t1_a.set_password('pass123')
        # School A Teacher 2 (Science / Replacement)
        self.u_t2_a = User(name='Teacher Hoover', email='hoover@springfield.edu', role=UserRole.TEACHER, school_id=self.school_a.id)
        self.u_t2_a.set_password('pass123')
        # School A Student 1
        self.u_s1_a = User(name='Bart Simpson', email='bart@springfield.edu', role=UserRole.STUDENT, school_id=self.school_a.id)
        self.u_s1_a.set_password('pass123')
        # School A Student 2
        self.u_s2_a = User(name='Lisa Simpson', email='lisa@springfield.edu', role=UserRole.STUDENT, school_id=self.school_a.id)
        self.u_s2_a.set_password('pass123')
        # School A Parent (Homer)
        self.u_parent_a = User(name='Homer Simpson', email='homer@springfield.edu', phone='555-0199', role=UserRole.PARENT, school_id=self.school_a.id)
        self.u_parent_a.set_password('pass123')

        # School B Principal
        self.u_princ_b = User(name='Principal Shelby', email='shelby@shelby.edu', role=UserRole.PRINCIPAL, school_id=self.school_b.id)
        self.u_princ_b.set_password('pass123')

        db.session.add_all([
            self.u_princ_a, self.u_t1_a, self.u_t2_a, self.u_s1_a, self.u_s2_a, self.u_parent_a,
            self.u_princ_b
        ])
        db.session.commit()

        # ── Setup Academic Records (School A) ──
        self.t1_rec = Teacher(user_id=self.u_t1_a.id, school_id=self.school_a.id, employee_id='T001', department='Math')
        self.t2_rec = Teacher(user_id=self.u_t2_a.id, school_id=self.school_a.id, employee_id='T002', department='Science')
        db.session.add_all([self.t1_rec, self.t2_rec])
        db.session.commit()

        self.class_10a = Class(name='Class 10', section='A', school_id=self.school_a.id)
        self.class_9a  = Class(name='Class 9', section='A', school_id=self.school_a.id)
        db.session.add_all([self.class_10a, self.class_9a])
        db.session.commit()

        self.sub_math = Subject(name='Mathematics', code='MTH101', class_id=self.class_10a.id, teacher_id=self.t1_rec.id, school_id=self.school_a.id)
        self.sub_sci  = Subject(name='Science', code='SCI101', class_id=self.class_10a.id, teacher_id=self.t2_rec.id, school_id=self.school_a.id)
        db.session.add_all([self.sub_math, self.sub_sci])
        db.session.commit()

        self.student_bart = Student(user_id=self.u_s1_a.id, school_id=self.school_a.id, class_id=self.class_10a.id, roll_number='101', admission_no='ADM001', parent_email='homer@springfield.edu', parent_phone='555-0199')
        self.student_lisa = Student(user_id=self.u_s2_a.id, school_id=self.school_a.id, class_id=self.class_10a.id, roll_number='102', admission_no='ADM002', parent_email='homer@springfield.edu', parent_phone='555-0199')
        db.session.add_all([self.student_bart, self.student_lisa])
        db.session.commit()

        # JWT Tokens
        self.token_princ_a = create_access_token(identity=str(self.u_princ_a.id))
        self.token_t1_a     = create_access_token(identity=str(self.u_t1_a.id))
        self.token_t2_a     = create_access_token(identity=str(self.u_t2_a.id))
        self.token_s1_a     = create_access_token(identity=str(self.u_s1_a.id))
        self.token_parent_a = create_access_token(identity=str(self.u_parent_a.id))
        self.token_princ_b = create_access_token(identity=str(self.u_princ_b.id))

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def auth_header(self, token):
        return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SCENARIOS 1 to 5: Exam Creation & Validation & Multi-tenancy
    # ═══════════════════════════════════════════════════════════════════════════

    def test_01_create_exam_with_participating_classes(self):
        """Principal creates exam in draft status with start/end date and linked classes."""
        start_d = (datetime.utcnow() + timedelta(days=5)).strftime('%Y-%m-%d')
        end_d   = (datetime.utcnow() + timedelta(days=15)).strftime('%Y-%m-%d')
        res = self.client.post('/api/principal/exams', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'exam_name': 'Mid Term Exam 2026',
            'exam_type': 'MID_TERM',
            'session': '2025-26',
            'start_date': start_d,
            'end_date': end_d,
            'class_ids': [self.class_10a.id],
            'grading_system': 'STANDARD',
            'instructions': 'Carry Admit Card'
        }))
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['status'], 'DRAFT')
        self.assertEqual(data['exam_name'], 'Mid Term Exam 2026')
        self.assertEqual(len(data['participating_classes']), 1)

    def test_02_create_exam_date_validation(self):
        """End date before start date must be rejected with 400 error."""
        res = self.client.post('/api/principal/exams', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'exam_name': 'Invalid Date Exam',
            'start_date': '2026-06-20',
            'end_date': '2026-06-10',
            'session': '2025-26',
        }))
        self.assertEqual(res.status_code, 400)
        self.assertIn('End date cannot be earlier than start date', res.get_json()['error'])

    def test_03_multi_tenant_isolation(self):
        """Principal B from School B cannot see or modify School A's exam."""
        exam = ExamSchedule(
            school_id=self.school_a.id, exam_name='School A Finals', session='2025-26',
            start_date=datetime.utcnow().date(), end_date=(datetime.utcnow() + timedelta(days=10)).date(),
            status='DRAFT'
        )
        db.session.add(exam)
        db.session.commit()

        # Principal B attempts to fetch School A exam
        res = self.client.get(f'/api/principal/exams/{exam.id}', headers=self.auth_header(self.token_princ_b))
        self.assertEqual(res.status_code, 403)

        # Principal B attempts to update School A exam
        res2 = self.client.patch(f'/api/principal/exams/{exam.id}', headers=self.auth_header(self.token_princ_b), data=json.dumps({
            'exam_name': 'Hacked Exam'
        }))
        self.assertEqual(res2.status_code, 403)

    def test_04_pre_publish_validation_engine_blocks_empty_exam(self):
        """Pre-publish validation engine must report blockers when no classes/papers configured."""
        exam = ExamSchedule(
            school_id=self.school_a.id, exam_name='Incomplete Exam', session='2025-26',
            start_date=datetime.utcnow().date(), end_date=(datetime.utcnow() + timedelta(days=5)).date(),
            status='DRAFT'
        )
        db.session.add(exam)
        db.session.commit()

        res = self.client.get(f'/api/principal/exams/{exam.id}/validate', headers=self.auth_header(self.token_princ_a))
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data['ready_to_publish'])
        self.assertGreater(len(data['blockers']), 0)

    def test_05_timetable_duplicate_and_conflict_check(self):
        """Adding duplicate paper for same class on same day/time should be rejected or flagged."""
        exam = ExamSchedule(
            school_id=self.school_a.id, exam_name='Unit Test 1', session='2025-26',
            start_date=datetime.utcnow().date(), end_date=(datetime.utcnow() + timedelta(days=5)).date(),
            status='DRAFT'
        )
        db.session.add(exam)
        db.session.commit()

        exam_date = (datetime.utcnow() + timedelta(days=1)).strftime('%Y-%m-%d')

        # Add paper 1
        res1 = self.client.post(f'/api/principal/exams/{exam.id}/timetable', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id,
            'subject_id': self.sub_math.id,
            'exam_date': exam_date,
            'start_time': '10:00 AM',
            'end_time': '01:00 PM',
            'max_marks': 100,
            'pass_marks': 33
        }))
        self.assertEqual(res1.status_code, 201)

        # Attempt to add same subject again
        res2 = self.client.post(f'/api/principal/exams/{exam.id}/timetable', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id,
            'subject_id': self.sub_math.id,
            'exam_date': exam_date,
            'start_time': '02:00 PM',
            'end_time': '05:00 PM',
            'max_marks': 100,
            'pass_marks': 33
        }))
        self.assertEqual(res2.status_code, 400)
        self.assertIn('already scheduled', res2.get_json()['error'])

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SCENARIOS 6 to 12: Publish, Admit Cards & Teacher Scopes
    # ═══════════════════════════════════════════════════════════════════════════

    def _setup_ready_exam(self):
        """Helper to create a fully configured exam ready for publish & marks."""
        exam = ExamSchedule(
            school_id=self.school_a.id, exam_name='Half Yearly Exam', session='2025-26',
            start_date=datetime.utcnow().date(), end_date=(datetime.utcnow() + timedelta(days=10)).date(),
            status='DRAFT'
        )
        db.session.add(exam)
        db.session.commit()

        ec = ExamClass(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id)
        es1 = ExamSubject(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=self.sub_math.id, max_marks=100, pass_marks=33)
        es2 = ExamSubject(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=self.sub_sci.id, max_marks=100, pass_marks=33)
        
        t1 = ExamTimetable(exam_id=exam.id, class_id=self.class_10a.id, subject_id=self.sub_math.id, exam_date=datetime.utcnow().date() + timedelta(days=1), start_time='10:00 AM', end_time='01:00 PM', max_marks=100, pass_marks=33)
        t2 = ExamTimetable(exam_id=exam.id, class_id=self.class_10a.id, subject_id=self.sub_sci.id, exam_date=datetime.utcnow().date() + timedelta(days=2), start_time='10:00 AM', end_time='01:00 PM', max_marks=100, pass_marks=33)
        
        db.session.add_all([ec, es1, es2, t1, t2])
        db.session.commit()
        return exam

    def test_06_publish_exam_and_admit_card_generation(self):
        """Principal publishes exam and downloads admit cards."""
        exam = self._setup_ready_exam()

        # Publish exam
        res = self.client.post(f'/api/principal/exams/{exam.id}/publish', headers=self.auth_header(self.token_princ_a))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['exam']['status'], 'PUBLISHED')

        # Single Student Admit Card PDF
        res_pdf = self.client.get(f'/api/principal/admit-card/{self.student_bart.id}/{exam.id}', headers=self.auth_header(self.token_princ_a))
        self.assertEqual(res_pdf.status_code, 200)
        self.assertEqual(res_pdf.content_type, 'application/pdf')

        # Bulk Class Admit Cards PDF
        res_bulk = self.client.get(f'/api/principal/admit-card/class/{self.class_10a.id}/{exam.id}', headers=self.auth_header(self.token_princ_a))
        self.assertEqual(res_bulk.status_code, 200)
        self.assertEqual(res_bulk.content_type, 'application/pdf')

    def test_07_teacher_restricted_to_assigned_subject(self):
        """Teacher Edna (Math) cannot view or submit marks for Science (Teacher Hoover's subject)."""
        exam = self._setup_ready_exam()

        # Teacher Edna requests roster for Science
        res = self.client.get(
            f'/api/results/roster?class_id={self.class_10a.id}&exam_id={exam.id}&subject_id={self.sub_sci.id}',
            headers=self.auth_header(self.token_t1_a)
        )
        self.assertEqual(res.status_code, 403)
        self.assertIn('permission nahi hai', res.get_json()['error'])

    def test_08_teacher_mark_entry_draft_and_submit(self):
        """Teacher Edna enters marks for Math, saves Draft, and submits to Principal."""
        exam = self._setup_ready_exam()

        # 1. Save Draft
        entries = [
            {'student_id': self.student_bart.id, 'marks_obtained': 78, 'max_marks': 100, 'is_absent': False, 'student_status': 'PASS', 'version': 0},
            {'student_id': self.student_lisa.id, 'marks_obtained': 99, 'max_marks': 100, 'is_absent': False, 'student_status': 'PASS', 'version': 0}
        ]
        res_draft = self.client.post('/api/results/save-draft', headers=self.auth_header(self.token_t1_a), data=json.dumps({
            'class_id': self.class_10a.id,
            'exam_id': exam.id,
            'subject_id': self.sub_math.id,
            'entries': entries
        }))
        self.assertEqual(res_draft.status_code, 200)

        # 2. Submit
        res_sub = self.client.post('/api/results/submit', headers=self.auth_header(self.token_t1_a), data=json.dumps({
            'class_id': self.class_10a.id,
            'exam_id': exam.id,
            'subject_id': self.sub_math.id
        }))
        self.assertEqual(res_sub.status_code, 200)
        self.assertEqual(res_sub.get_json()['status']['status'], 'SUBMITTED')

    def test_09_teacher_delegation_when_on_leave(self):
        """When Teacher Hoover (Science) is on leave, Principal delegates Science to Teacher Edna."""
        exam = self._setup_ready_exam()

        # Principal creates delegation for Edna for Science
        end_date = (datetime.utcnow() + timedelta(days=3)).strftime('%Y-%m-%d')
        res_del = self.client.post('/api/results/delegations', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'exam_id': exam.id,
            'class_id': self.class_10a.id,
            'subject_id': self.sub_sci.id,
            'delegated_teacher_id': self.t1_rec.id,
            'end_date': end_date,
            'reason': 'Teacher Hoover on medical leave'
        }))
        self.assertEqual(res_del.status_code, 201)

        # Teacher Edna can now access and enter marks for Science!
        entries = [
            {'student_id': self.student_bart.id, 'marks_obtained': 65, 'max_marks': 100, 'is_absent': False, 'student_status': 'PASS', 'version': 0},
            {'student_id': self.student_lisa.id, 'marks_obtained': 98, 'max_marks': 100, 'is_absent': False, 'student_status': 'PASS', 'version': 0}
        ]
        res_save = self.client.post('/api/results/save-draft', headers=self.auth_header(self.token_t1_a), data=json.dumps({
            'class_id': self.class_10a.id,
            'exam_id': exam.id,
            'subject_id': self.sub_sci.id,
            'entries': entries
        }))
        self.assertEqual(res_save.status_code, 200)

    # ═══════════════════════════════════════════════════════════════════════════
    #  TEST SCENARIOS 13 to 20: Review, Return, Publish & Visibility Gate
    # ═══════════════════════════════════════════════════════════════════════════

    def test_10_principal_return_for_correction(self):
        """Principal returns submitted subject marks for correction with mandatory reason."""
        exam = self._setup_ready_exam()
        # Teacher submits
        entries = [{'student_id': self.student_bart.id, 'marks_obtained': 78, 'max_marks': 100, 'is_absent': False, 'student_status': 'PASS', 'version': 0}]
        self.client.post('/api/results/save-draft', headers=self.auth_header(self.token_t1_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': self.sub_math.id, 'entries': entries
        }))
        self.client.post('/api/results/submit', headers=self.auth_header(self.token_t1_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': self.sub_math.id
        }))

        # Principal returns without reason -> Error 400
        res_no_reason = self.client.post('/api/results/principal/return', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': self.sub_math.id, 'reason': ''
        }))
        self.assertEqual(res_no_reason.status_code, 400)

        # Principal returns with reason
        res_return = self.client.post('/api/results/principal/return', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': self.sub_math.id,
            'reason': 'Please recount question 4 marks for roll 101',
            'student_ids': [self.student_bart.id]
        }))
        self.assertEqual(res_return.status_code, 200)
        self.assertEqual(res_return.get_json()['status']['status'], 'RETURNED_FOR_CORRECTION')

    def test_11_student_and_parent_cannot_see_marks_before_publication(self):
        """Student & Parent cannot see marks when ClassResultPublication is not PUBLISHED."""
        exam = self._setup_ready_exam()
        # Marks exist in DB
        m = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=self.sub_math.id, student_id=self.student_bart.id, marks_obtained=85, max_marks=100, is_absent=False)
        db.session.add(m)
        db.session.commit()

        # Student query
        res_s = self.client.get(f'/api/student/marks?exam_id={exam.id}', headers=self.auth_header(self.token_s1_a))
        self.assertEqual(res_s.status_code, 403)

        # Parent query
        res_p = self.client.get(f'/api/student/marks?exam_id={exam.id}&student_id={self.student_bart.id}', headers=self.auth_header(self.token_parent_a))
        self.assertEqual(res_p.status_code, 403)

    def test_12_result_publication_and_visibility(self):
        """After all subjects approved, Principal publishes result; Student & Parent can now view."""
        exam = self._setup_ready_exam()

        # Approve both subjects
        for sub_id in [self.sub_math.id, self.sub_sci.id]:
            # populate marks
            m1 = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=sub_id, student_id=self.student_bart.id, marks_obtained=80, max_marks=100, is_absent=False)
            m2 = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=sub_id, student_id=self.student_lisa.id, marks_obtained=95, max_marks=100, is_absent=False)
            db.session.add_all([m1, m2])
            db.session.commit()
            self.client.post('/api/results/principal/approve', headers=self.auth_header(self.token_princ_a), data=json.dumps({
                'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': sub_id
            }))

        # Publish result
        res_pub = self.client.post('/api/results/publish', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id
        }))
        self.assertEqual(res_pub.status_code, 200)

        # Verify ResultVersion snapshot created
        ver = ResultVersion.query.filter_by(exam_id=exam.id, class_id=self.class_10a.id).first()
        self.assertIsNotNone(ver)
        self.assertEqual(ver.version_number, 1)

        # Student Bart can now view published report card
        res_s = self.client.get(f'/api/student/marks?exam_id={exam.id}', headers=self.auth_header(self.token_s1_a))
        self.assertEqual(res_s.status_code, 200)
        s_data = res_s.get_json()
        self.assertEqual(s_data['total_obtained'], 160)
        self.assertEqual(s_data['percentage'], 80.0)

        # Parent Homer can view Bart's marks
        res_p = self.client.get(f'/api/student/marks?exam_id={exam.id}&student_id={self.student_bart.id}', headers=self.auth_header(self.token_parent_a))
        self.assertEqual(res_p.status_code, 200)

    def test_13_reopen_and_republish_version_increment(self):
        """Principal reopens published result with reason, updates mark, and republishes -> Version 2."""
        exam = self._setup_ready_exam()

        # Approve and Publish v1
        for sub_id in [self.sub_math.id, self.sub_sci.id]:
            m = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=sub_id, student_id=self.student_bart.id, marks_obtained=80, max_marks=100, is_absent=False)
            db.session.add(m)
            db.session.commit()
            self.client.post('/api/results/principal/approve', headers=self.auth_header(self.token_princ_a), data=json.dumps({
                'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': sub_id
            }))
        self.client.post('/api/results/publish', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id
        }))

        # Reopen with reason
        res_reopen = self.client.post('/api/results/reopen', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id, 'reason': 'Re-evaluation requested for Math'
        }))
        self.assertEqual(res_reopen.status_code, 200)

        # Republish
        res_repub = self.client.post('/api/results/republish', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id
        }))
        self.assertEqual(res_repub.status_code, 200)

        # Verify ResultVersion 2 exists
        ver2 = ResultVersion.query.filter_by(exam_id=exam.id, class_id=self.class_10a.id, version_number=2).first()
        self.assertIsNotNone(ver2)

    def test_14_bulk_result_cards_pdf_download(self):
        """Bulk result cards download produces valid PDF containing all class students."""
        exam = self._setup_ready_exam()
        # Add marks and publish
        for sub_id in [self.sub_math.id, self.sub_sci.id]:
            m1 = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=sub_id, student_id=self.student_bart.id, marks_obtained=80, max_marks=100, is_absent=False)
            m2 = Marks(school_id=self.school_a.id, exam_id=exam.id, class_id=self.class_10a.id, subject_id=sub_id, student_id=self.student_lisa.id, marks_obtained=95, max_marks=100, is_absent=False)
            db.session.add_all([m1, m2])
            db.session.commit()
            self.client.post('/api/results/principal/approve', headers=self.auth_header(self.token_princ_a), data=json.dumps({
                'class_id': self.class_10a.id, 'exam_id': exam.id, 'subject_id': sub_id
            }))
        self.client.post('/api/results/publish', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'class_id': self.class_10a.id, 'exam_id': exam.id
        }))

        res_bulk_rc = self.client.get(f'/api/principal/result-card/class/{self.class_10a.id}/{exam.id}', headers=self.auth_header(self.token_princ_a))
        self.assertEqual(res_bulk_rc.status_code, 200)
        self.assertEqual(res_bulk_rc.content_type, 'application/pdf')

    def test_15_notify_teacher_remind_api(self):
        """Principal notifies teacher about pending marks submission."""
        exam = self._setup_ready_exam()
        res = self.client.post('/api/results/notify-teacher', headers=self.auth_header(self.token_princ_a), data=json.dumps({
            'exam_id': exam.id,
            'class_id': self.class_10a.id,
            'subject_id': self.sub_math.id
        }))
        self.assertEqual(res.status_code, 200)
        self.assertIn('Notification sent', res.get_json()['message'])


if __name__ == '__main__':
    unittest.main()
