from app import db, bcrypt
import enum
from datetime import datetime


class UserRole(str, enum.Enum):
    SUPER_ADMIN  = 'SUPER_ADMIN'
    PRINCIPAL    = 'PRINCIPAL'
    VICE_PRINCIPAL = 'VICE_PRINCIPAL'
    TEACHER      = 'TEACHER'
    ACCOUNTANT   = 'ACCOUNTANT'
    RECEPTIONIST = 'RECEPTIONIST'
    LIBRARIAN    = 'LIBRARIAN'
    HOSTEL       = 'HOSTEL'
    TRANSPORT    = 'TRANSPORT'
    HR           = 'HR'
    # NEW — these two already existed as platform Role rows (rbac.py's
    # DEFAULT_SCHOOL_ROLES) and the Postgres enum column already accepted
    # them (_ensure_userrole_enum in app/__init__.py), but this Python enum
    # never had them — so StaffPage.jsx offered "Academic Coordinator" /
    # "Exam Controller" in the Add Staff dropdown, and creating either one
    # always failed with "Invalid role" (UserRole(role_str) raised before
    # ever reaching the platform-role lookup).
    ACADEMIC_COORDINATOR = 'ACADEMIC_COORDINATOR'
    EXAM_CONTROLLER      = 'EXAM_CONTROLLER'
    DRIVER       = 'DRIVER'
    STUDENT      = 'STUDENT'
    PARENT       = 'PARENT'


# Roles that Principal is allowed to create (cannot create SUPER_ADMIN or PRINCIPAL)
PRINCIPAL_ALLOWED_ROLES = {
    UserRole.VICE_PRINCIPAL,
    UserRole.TEACHER,
    UserRole.ACCOUNTANT,
    UserRole.RECEPTIONIST,
    UserRole.LIBRARIAN,
    UserRole.HOSTEL,
    UserRole.TRANSPORT,
    UserRole.HR,
    UserRole.ACADEMIC_COORDINATOR,
    UserRole.EXAM_CONTROLLER,
    UserRole.STUDENT,
    UserRole.PARENT,
}


class User(db.Model):
    __tablename__ = 'users'

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(120), nullable=False)

    # username: unique login identifier (auto-generated if not provided)
    # nullable=True so existing rows don't break on migration
    # username: unique login identifier (auto-generated if not provided)
    # nullable=True so existing rows don't break on migration
    username    = db.Column(db.String(80), unique=True, nullable=True)

    # Employee ID for Staff Attendance module — EMP-0001 style, auto-generated,
    # nullable=True so existing rows don't break, backfilled on first read
    # (see routes/staff_attendance.py -> list_employees()).
    employee_id = db.Column(db.String(30), unique=True, nullable=True)

    email       = db.Column(db.String(120), unique=True, nullable=False)
    password    = db.Column(db.String(256), nullable=False)
    role        = db.Column(db.Enum(UserRole), nullable=False)
    is_active   = db.Column(db.Boolean, default=True)
    phone       = db.Column(db.String(20))
    avatar_url  = db.Column(db.String(255))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    last_login  = db.Column(db.DateTime, nullable=True)

    # Extra profile fields (staff/teacher use)
    # Extra profile fields (staff/teacher use)
    department  = db.Column(db.String(100), nullable=True)
    designation = db.Column(db.String(100), nullable=True)

    # Base monthly salary — used for non-teaching staff (Accountant, Librarian, etc.)
    # Teachers use Teacher.salary instead; this stays null for TEACHER/STUDENT/PARENT roles.
    salary      = db.Column(db.Float, nullable=True)

    # One-time plain-text password stored ONLY at creation / reset time.
    # Cleared when user changes their own password.
    # Allows admin to see/copy credentials for newly created accounts.
    plain_password_temp = db.Column(db.String(256), nullable=True)

    # FK to school (null for SUPER_ADMIN)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)

    # Relationships
    school          = db.relationship('School', foreign_keys=[school_id], backref='members')
    teacher_profile = db.relationship('Teacher', backref='user', uselist=False)
    student_profile = db.relationship('Student', backref='user', uselist=False)

    # ── Password helpers ────────────────────────────────────────────────────
    def set_password(self, plain_text, store_plain=False):
        """
        Hash and store password.
        store_plain=True  → also save plain text in plain_password_temp (creation / reset).
        store_plain=False → clear plain_password_temp (user changed own password).
        """
        self.password = bcrypt.generate_password_hash(plain_text).decode('utf-8')
        if store_plain:
            self.plain_password_temp = plain_text
        else:
            self.plain_password_temp = None

    def check_password(self, plain_text):
        return bcrypt.check_password_hash(self.password, plain_text)

    def touch_last_login(self):
        self.last_login = datetime.utcnow()

    # ── Serialisation ───────────────────────────────────────────────────────
    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'username':    self.username,
            'employee_id': self.employee_id,
            'email':       self.email,
            'role':        self.role.value,
            'school_id':   self.school_id,
            'is_active':   self.is_active,
            'phone':       self.phone,
            'department':  self.department,
            'designation': self.designation,
            'salary':      self.salary,
            'last_login':  self.last_login.isoformat() if self.last_login else None,
            'created_at':  self.created_at.isoformat(),
        }

    def to_dict_with_credentials(self):
        """Used only by admin/principal when returning newly created / reset user."""
        d = self.to_dict()
        d['plain_password_temp'] = self.plain_password_temp
        return d
