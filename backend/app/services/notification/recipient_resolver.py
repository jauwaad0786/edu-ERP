"""
Recipient Resolver for Multi-Tenant Notifications.
Resolves audiences, roles, classes, and specific user IDs to concrete User IDs.
"""

import logging
from typing import List, Optional, Dict, Any

from app.models.user import User, UserRole
from app.models.academic import Student, Teacher

logger = logging.getLogger('recipient_resolver')


class RecipientResolver:
    ROLE_MAPPING = {
        'ALL': None,  # All active users in school
        'TEACHERS': [UserRole.TEACHER, UserRole.VICE_PRINCIPAL, UserRole.ACADEMIC_COORDINATOR],
        'STUDENTS': [UserRole.STUDENT],
        'PARENTS': [UserRole.PARENT],
        'STAFF': [
            UserRole.ACCOUNTANT, UserRole.RECEPTIONIST, UserRole.LIBRARIAN,
            UserRole.HOSTEL, UserRole.TRANSPORT, UserRole.HR, UserRole.DRIVER
        ],
        'PRINCIPAL': [UserRole.PRINCIPAL],
        'ADMIN': [UserRole.SUPER_ADMIN, UserRole.PRINCIPAL],
        'SUPER_ADMIN': [UserRole.SUPER_ADMIN],
    }

    @classmethod
    def resolve(cls, school_id: Optional[int], target: Dict[str, Any]) -> List[int]:
        """
        target can specify:
        - user_ids: List[int]
        - roles: List[str] or str (e.g. 'PARENTS,STUDENTS' or 'TEACHERS')
        - class_ids: List[int] or int
        - student_ids: List[int]
        - include_parents: bool (when targeting classes/students)
        Returns unique, active user_ids within the tenant.
        """
        if not target:
            return []

        resolved_ids = set()

        # 1. Direct user_ids
        direct_user_ids = target.get('user_ids')
        if direct_user_ids:
            if isinstance(direct_user_ids, (int, str)):
                direct_user_ids = [int(direct_user_ids)]
            q = User.query.filter(
                User.id.in_(direct_user_ids),
                User.is_active == True,
                User.is_deleted == False
            )
            if school_id:
                q = q.filter(User.school_id == school_id)
            resolved_ids.update([u.id for u in q.all()])

        # 2. Roles target
        roles = target.get('roles') or target.get('target_roles')
        if roles:
            if isinstance(roles, str):
                role_list = [r.strip().upper() for r in roles.split(',') if r.strip()]
            else:
                role_list = [str(r).strip().upper() for r in roles]

            q = User.query.filter(
                User.is_active == True,
                User.is_deleted == False
            )
            if school_id:
                q = q.filter(User.school_id == school_id)

            if 'ALL' not in role_list:
                matched_enums = []
                for r in role_list:
                    if r in cls.ROLE_MAPPING and cls.ROLE_MAPPING[r]:
                        matched_enums.extend(cls.ROLE_MAPPING[r])
                    else:
                        try:
                            matched_enums.append(UserRole(r))
                        except ValueError:
                            pass
                if matched_enums:
                    q = q.filter(User.role.in_(matched_enums))

            resolved_ids.update([u.id for u in q.all()])

        # 3. Class target
        class_ids = target.get('class_ids') or target.get('class_id')
        if class_ids:
            if isinstance(class_ids, (int, str)):
                class_ids = [int(class_ids)]

            sq = Student.query.filter(
                Student.class_id.in_(class_ids),
                Student.is_deleted == False
            )
            if school_id:
                sq = sq.filter(Student.school_id == school_id)

            students = sq.all()
            for s in students:
                if s.user_id:
                    resolved_ids.add(s.user_id)

            # Optionally resolve parents of these students
            if target.get('include_parents', False):
                parent_phones = [s.parent_phone for s in students if s.parent_phone]
                parent_emails = [s.parent_email for s in students if s.parent_email]

                if parent_phones or parent_emails:
                    pq = User.query.filter(
                        User.role == UserRole.PARENT,
                        User.is_active == True,
                        User.is_deleted == False
                    )
                    if school_id:
                        pq = pq.filter(User.school_id == school_id)

                    conds = []
                    if parent_phones:
                        conds.append(User.phone.in_(parent_phones))
                    if parent_emails:
                        conds.append(User.email.in_(parent_emails))

                    if conds:
                        from sqlalchemy import or_
                        pq = pq.filter(or_(*conds))
                        resolved_ids.update([u.id for u in pq.all()])

        # 4. Student IDs target
        student_ids = target.get('student_ids')
        if student_ids:
            if isinstance(student_ids, (int, str)):
                student_ids = [int(student_ids)]
            sq = Student.query.filter(Student.id.in_(student_ids))
            if school_id:
                sq = sq.filter(Student.school_id == school_id)
            students = sq.all()
            for s in students:
                if s.user_id:
                    resolved_ids.add(s.user_id)

        return list(resolved_ids)
