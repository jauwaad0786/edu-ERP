from app.models.user import User, UserRole
from app.models.school import School
from app.models.platform import Product
from app.models.rbac import Role, Permission, RolePermission, UserRoleAssignment, UserPermissionOverride

from app.models.financial import FeeStructure, FeeRecord, ExamSchedule, ExamTimetable
from app.models.academic import Class, Teacher, Student, Subject, Marks, Attendance, Note, TeacherAttendance

__all__ = [
    'User', 'UserRole', 'School', 'Product',
    'Role', 'Permission', 'RolePermission', 'UserRoleAssignment', 'UserPermissionOverride',
    'Class', 'Subject', 'Teacher', 'Student', 'Attendance', 'Marks', 'Note',
    'FeeStructure', 'FeeRecord', 'ExamSchedule', 'ExamTimetable'
]
