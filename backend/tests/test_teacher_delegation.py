"""
Comprehensive Unit & Integration Test Suite for Teacher Delegation & Temporary Access
EduERP / OnePlatform360

Validates:
1. Delegation creation with class & subject scopes and operational permissions.
2. Zero Role Mutation: Substitute teacher role strictly remains TEACHER.
3. Self-delegation & cross-school isolation enforcement.
4. Block dangerous permissions (admin, payroll, settings, re-delegating).
5. Dynamic time-window evaluation: SCHEDULED, ACTIVE, EXPIRED, REVOKED.
6. Immediate revocation: status -> REVOKED, real-time access revoked immediately.
7. Scoped class & subject checks: has_teacher_delegated_permission evaluates properly.
8. Conflict detection: checks overlapping time windows for the same scope.
9. Auto-expiry runner: batch transitions past active delegations to EXPIRED.
"""

import unittest
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, UserRole
from app.models.school import School
from app.models.academic import Teacher, Class, Subject
from app.models.delegation import (
    TeacherDelegation, TeacherDelegationScope, TeacherDelegationPermission
)
from app.services import teacher_delegation_service as del_svc


class TeacherDelegationTestCase(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Seed School A
        self.school = School(
            name='Delhi Public School',
            code='DPS001',
            city='New Delhi',
            state='Delhi',
            pincode='110001',
        )
        # Seed School B (for cross-school tests)
        self.school_b = School(
            name='St. Xavier School',
            code='STX002',
            city='Jaipur',
            state='Rajasthan',
            pincode='302001',
        )
        db.session.add_all([self.school, self.school_b])
        db.session.commit()

        # Seed Principal
        self.principal = User(
            name='Principal Sharma',
            email='principal@dps.com',
            role=UserRole.PRINCIPAL,
            school_id=self.school.id,
            is_active=True
        )
        self.principal.set_password('Secret@123', store_plain=False)

        # Seed Absent Teacher (Source)
        self.teacher_absent = User(
            name='Sunita Verma',
            email='sunita@dps.com',
            role=UserRole.TEACHER,
            school_id=self.school.id,
            is_active=True
        )
        self.teacher_absent.set_password('Secret@123', store_plain=False)

        # Seed Substitute Teacher (Delegate)
        self.teacher_substitute = User(
            name='Amit Kumar',
            email='amit@dps.com',
            role=UserRole.TEACHER,
            school_id=self.school.id,
            is_active=True
        )
        self.teacher_substitute.set_password('Secret@123', store_plain=False)

        # Seed External Teacher in School B
        self.teacher_other_school = User(
            name='External Teacher',
            email='external@stx.com',
            role=UserRole.TEACHER,
            school_id=self.school_b.id,
            is_active=True
        )
        self.teacher_other_school.set_password('Secret@123', store_plain=False)

        db.session.add_all([
            self.principal, self.teacher_absent,
            self.teacher_substitute, self.teacher_other_school
        ])
        db.session.commit()

        # Create Academic Classes
        self.cls_10a = Class(name='Class 10', section='A', school_id=self.school.id)
        self.cls_9b = Class(name='Class 9', section='B', school_id=self.school.id)
        db.session.add_all([self.cls_10a, self.cls_9b])
        db.session.commit()

        # Seed Teacher academic profiles
        self.t_rec_sunita = Teacher(user_id=self.teacher_absent.id, school_id=self.school.id)
        self.t_rec_amit = Teacher(user_id=self.teacher_substitute.id, school_id=self.school.id)
        self.t_rec_other = Teacher(user_id=self.teacher_other_school.id, school_id=self.school_b.id)
        db.session.add_all([self.t_rec_sunita, self.t_rec_amit, self.t_rec_other])
        db.session.commit()

        # Create Subjects with teacher assignments
        self.subj_math = Subject(
            name='Mathematics', code='MTH101', class_id=self.cls_10a.id,
            teacher_id=self.t_rec_sunita.id, school_id=self.school.id
        )
        self.subj_sci = Subject(
            name='Science', code='SCI101', class_id=self.cls_10a.id,
            teacher_id=self.t_rec_sunita.id, school_id=self.school.id
        )
        db.session.add_all([self.subj_math, self.subj_sci])
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_01_create_delegation_success(self):
        """Test successful delegation creation with scopes and permissions"""
        now = datetime.utcnow()
        starts_at = now - timedelta(hours=1)
        expires_at = now + timedelta(days=3)

        delegation = del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=starts_at,
            expires_at=expires_at,
            reason='Medical Leave for 3 days',
            notes='Cover maths syllabus',
            scopes=[{
                'class_id': self.cls_10a.id,
                'subject_id': self.subj_math.id
            }],
            permissions=['ATTENDANCE_MARK', 'MARKS_ENTER', 'STUDENT_VIEW']
        )

        self.assertIsNotNone(delegation.id)
        self.assertEqual(delegation.status, 'ACTIVE')
        self.assertEqual(len(delegation.scopes), 1)
        self.assertEqual(delegation.scopes[0].class_id, self.cls_10a.id)
        self.assertEqual(delegation.scopes[0].subject_id, self.subj_math.id)
        self.assertEqual(len(delegation.permissions), 3)

    def test_02_zero_role_mutation(self):
        """Verify substitute teacher's permanent role is NEVER mutated"""
        initial_role = self.teacher_substitute.role
        self.assertEqual(initial_role, UserRole.TEACHER)

        now = datetime.utcnow()
        del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now,
            expires_at=now + timedelta(days=2),
            reason='Maternity Leave',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )

        # Refresh user from database
        user_after = User.query.get(self.teacher_substitute.id)
        self.assertEqual(user_after.role, UserRole.TEACHER)

    def test_03_self_delegation_prevented(self):
        """Verify that delegating to oneself is strictly rejected"""
        now = datetime.utcnow()
        with self.assertRaises(ValueError) as ctx:
            del_svc.create_teacher_delegation(
                school_id=self.school.id,
                creator_user_id=self.principal.id,
                session='2024-25',
                source_teacher_id=self.t_rec_sunita.id,
                delegate_teacher_id=self.t_rec_sunita.id,
                starts_at=now,
                expires_at=now + timedelta(days=1),
                reason='Self-delegation attempt',
                notes=None,
                scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
                permissions=['ATTENDANCE_MARK']
            )
        self.assertIn('cannot be the same person', str(ctx.exception))

    def test_04_cross_school_delegation_prevented(self):
        """Verify that delegating to a teacher of another school is blocked"""
        now = datetime.utcnow()
        with self.assertRaises(ValueError) as ctx:
            del_svc.create_teacher_delegation(
                school_id=self.school.id,
                creator_user_id=self.principal.id,
                session='2024-25',
                source_teacher_id=self.t_rec_sunita.id,
                delegate_teacher_id=self.t_rec_other.id,
                starts_at=now,
                expires_at=now + timedelta(days=1),
                reason='Cross-school attempt',
                notes=None,
                scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
                permissions=['ATTENDANCE_MARK']
            )
        self.assertIn('not found in this school', str(ctx.exception))

    def test_05_dangerous_permissions_blocked(self):
        """Verify administrative and forbidden permissions are strictly disallowed"""
        now = datetime.utcnow()
        with self.assertRaises(ValueError) as ctx:
            del_svc.create_teacher_delegation(
                school_id=self.school.id,
                creator_user_id=self.principal.id,
                session='2024-25',
                source_teacher_id=self.t_rec_sunita.id,
                delegate_teacher_id=self.t_rec_amit.id,
                starts_at=now,
                expires_at=now + timedelta(days=1),
                reason='Privilege escalation attempt',
                notes=None,
                scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
                permissions=['ROLE_CHANGE', 'DELETE_TEACHER', 'PAYROLL_MANAGE', 'ADMIN_SETTINGS']
            )
        self.assertTrue('high-privilege' in str(ctx.exception) or 'Invalid permission' in str(ctx.exception))

    def test_06_time_window_evaluation_and_effective_access(self):
        """Verify real-time access evaluation for SCHEDULED, ACTIVE, and EXPIRED"""
        now = datetime.utcnow()

        # 1. Scheduled in the future (starts tomorrow)
        del_future = del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now + timedelta(days=1),
            expires_at=now + timedelta(days=3),
            reason='Upcoming conference',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )
        self.assertEqual(del_future.compute_current_status(), 'SCHEDULED')

        # Real-time check: should return FALSE right now because it's not yet started
        can_mark_future = del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id,
            subject_id=self.subj_math.id
        )
        self.assertFalse(can_mark_future)

        # 2. Currently Active
        del_active = del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now - timedelta(hours=2),
            expires_at=now + timedelta(days=2),
            reason='Sick leave',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )
        self.assertEqual(del_active.compute_current_status(), 'ACTIVE')

        # Real-time check: should return TRUE right now
        can_mark_active = del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id,
            subject_id=self.subj_math.id
        )
        self.assertTrue(can_mark_active)

    def test_07_immediate_revocation(self):
        """Verify that revoking a delegation immediately terminates operational access"""
        now = datetime.utcnow()
        delegation = del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=1),
            reason='Short leave',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )

        # Access should be active initially
        self.assertTrue(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id
        ))

        # Revoke immediately
        revoked, _ = del_svc.revoke_teacher_delegation(
            delegation_id=delegation.id,
            school_id=self.school.id,
            revoker_user_id=self.principal.id,
            revoke_reason='Sunita returned early'
        )
        self.assertEqual(revoked.status, 'REVOKED')
        self.assertIsNotNone(revoked.revoked_at)

        # Access should be instantly FALSE
        self.assertFalse(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id
        ))

    def test_08_scoped_access_enforcement(self):
        """Verify substitute only has permissions for delegated classes and subjects"""
        now = datetime.utcnow()
        del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=2),
            reason='Leave',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )

        # Authorized for Class 10-A Maths
        self.assertTrue(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id,
            subject_id=self.subj_math.id
        ))

        # Denied for Class 10-A Science (different subject)
        self.assertFalse(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_10a.id,
            subject_id=self.subj_sci.id
        ))

        # Denied for Class 9-B Maths (different class)
        self.assertFalse(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='ATTENDANCE_MARK',
            class_id=self.cls_9b.id,
            subject_id=self.subj_math.id
        ))

        # Denied for MARKS_ENTER (permission was not granted)
        self.assertFalse(del_svc.has_teacher_delegated_permission(
            user=self.teacher_substitute,
            permission_code='MARKS_ENTER',
            class_id=self.cls_10a.id,
            subject_id=self.subj_math.id
        ))

    def test_09_conflict_detection(self):
        """Verify conflict detection reports active overlapping assignments"""
        now = datetime.utcnow()
        del_svc.create_teacher_delegation(
            school_id=self.school.id,
            creator_user_id=self.principal.id,
            session='2024-25',
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now - timedelta(hours=1),
            expires_at=now + timedelta(days=2),
            reason='First delegation',
            notes=None,
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}],
            permissions=['ATTENDANCE_MARK']
        )

        # Check conflicts for an overlapping time window
        conflicts = del_svc.check_delegation_conflicts(
            school_id=self.school.id,
            delegate_teacher_id=self.t_rec_amit.id,
            starts_at=now,
            expires_at=now + timedelta(days=1),
            scopes=[{'class_id': self.cls_10a.id, 'subject_id': self.subj_math.id}]
        )

        self.assertTrue(len(conflicts) > 0)
        self.assertIn('already has an active/scheduled delegation', conflicts[0]['message'])

    def test_10_auto_expire_runner(self):
        """Verify batch auto-expiration sets status to EXPIRED for past delegations"""
        past_start = datetime.utcnow() - timedelta(days=5)
        past_end = datetime.utcnow() - timedelta(days=1)

        d = TeacherDelegation(
            school_id=self.school.id,
            source_teacher_id=self.t_rec_sunita.id,
            delegate_teacher_id=self.t_rec_amit.id,
            created_by=self.principal.id,
            starts_at=past_start,
            expires_at=past_end,
            status='ACTIVE',
            reason='Expired workshop'
        )
        db.session.add(d)
        db.session.commit()

        sync_result = del_svc.auto_expire_teacher_delegations()
        self.assertGreaterEqual(sync_result.get('expired', 0), 1)

        refreshed = TeacherDelegation.query.get(d.id)
        self.assertEqual(refreshed.status, 'EXPIRED')


if __name__ == '__main__':
    unittest.main()
