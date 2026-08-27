from app import db
from datetime import datetime


class Class(db.Model):
    __tablename__ = 'classes'

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(50), nullable=False)
    section    = db.Column(db.String(10))
    session    = db.Column(db.String(20), default='2024-25')
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)

    students  = db.relationship('Student', backref='class_ref', lazy='dynamic')
    subjects  = db.relationship('Subject', backref='class_ref', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'section': self.section, 'session': self.session,
            'school_id': self.school_id,
            'teacher_id': self.teacher_id,
        }


class Subject(db.Model):
    __tablename__ = 'subjects'

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    code       = db.Column(db.String(20))
    class_id   = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)
    max_marks  = db.Column(db.Integer, default=100)
    pass_marks = db.Column(db.Integer, default=33)
    # Line ~42, Subject class mein add karo:
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)
    marks             = db.relationship('Marks', backref='subject', lazy='dynamic')
    notes             = db.relationship('Note', backref='subject', lazy='dynamic')
    assigned_teacher  = db.relationship('Teacher', foreign_keys=[teacher_id], lazy='select', overlaps="classes_taught,teacher_ref")

    def to_dict(self):
        teacher_name = ''
        try:
            if self.teacher_id and self.assigned_teacher:
                teacher_name = self.assigned_teacher.user.name if self.assigned_teacher.user else ''
        except Exception:
            pass
        return {
            'id':           self.id,
            'name':         self.name,
            'code':         getattr(self, 'code', '') or '',
            'class_id':     self.class_id,
            'teacher_id':   self.teacher_id,
            'teacher_name': teacher_name,
            'max_marks':    getattr(self, 'max_marks', 100) or 100,
            'pass_marks':   getattr(self, 'pass_marks', 33) or 33,
            'school_id':    self.school_id,
        }


class Teacher(db.Model):
    __tablename__ = 'teachers'

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    employee_id   = db.Column(db.String(30), unique=True)
    department    = db.Column(db.String(100))
    designation   = db.Column(db.String(100), default='Teacher')
    dob           = db.Column(db.Date)
    joining_date  = db.Column(db.Date)
    qualification = db.Column(db.String(200))
    salary        = db.Column(db.Float, default=0.0)
    photo_url     = db.Column(db.String(500))

    classes_taught = db.relationship('Subject', backref='teacher_ref', lazy='dynamic',
                                     foreign_keys='Subject.teacher_id', overlaps="assigned_teacher,teacher_ref")

    def to_dict(self):
        return {
            'id':            self.id,
            'user_id':       self.user_id,
            'employee_id':   self.employee_id,
            'department':    self.department,
            'designation':   self.designation,
            'school_id':     self.school_id,
            'name':          self.user.name  if self.user else '',
            'email':         self.user.email if self.user else '',
            'phone':         self.user.phone if self.user else '',
            'photo_url':     self.photo_url,
            'dob':           self.dob.isoformat() if self.dob else None,
            'joining_date':  self.joining_date.isoformat() if self.joining_date else None,
            'qualification': self.qualification,
            'salary':        self.salary,
        }


class Student(db.Model):
    __tablename__ = 'students'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    class_id     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    roll_number  = db.Column(db.String(20))
    admission_no = db.Column(db.String(30), unique=True)
    dob          = db.Column(db.Date)
    gender       = db.Column(db.String(10))
    address      = db.Column(db.String(500))
    parent_name  = db.Column(db.String(120))
    parent_phone = db.Column(db.String(20))
    parent_email = db.Column(db.String(120))
    blood_group  = db.Column(db.String(5))
    session      = db.Column(db.String(20), default='2024-25')
    father_name  = db.Column(db.String(120))
    mother_name  = db.Column(db.String(120))
    photo_url    = db.Column(db.String(500))

    # Admission & Profile metadata
    admission_date      = db.Column(db.Date)
    aadhar_no           = db.Column(db.String(30))
    parent_aadhar_no    = db.Column(db.String(30))
    category            = db.Column(db.String(50), default='General')
    nationality         = db.Column(db.String(50), default='Indian')
    religion            = db.Column(db.String(50))
    father_occupation   = db.Column(db.String(100))
    mother_occupation   = db.Column(db.String(100))
    guardian_name       = db.Column(db.String(120))
    guardian_relation   = db.Column(db.String(50))
    guardian_phone      = db.Column(db.String(20))

    # First School / Previous School Details
    is_first_school      = db.Column(db.Boolean, default=False)
    previous_school_name = db.Column(db.String(200))
    previous_class       = db.Column(db.String(50))
    previous_tc_no       = db.Column(db.String(100))
    previous_tc_date     = db.Column(db.Date)
    previous_reason      = db.Column(db.String(250))

    attendance = db.relationship('Attendance', backref='student', lazy='dynamic')
    marks      = db.relationship('Marks', backref='student', lazy='dynamic')
    fees = db.relationship('FeeRecord', backref=db.backref('student_ref', overlaps="fee_records_rel,student"), lazy='dynamic', overlaps="fee_records_rel,student")
    documents  = db.relationship('StudentDocument', backref='student_ref', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        c_name = self.class_ref.name if self.class_ref else ''
        c_sec  = self.class_ref.section if self.class_ref else ''
        return {
            'id':                   self.id,
            'roll_number':          self.roll_number or '',
            'admission_no':         self.admission_no or '',
            'admission_number':     self.admission_no or '',
            'admission_date':       self.admission_date.strftime('%Y-%m-%d') if self.admission_date else '',
            'class_id':             self.class_id,
            'class_name':           c_name,
            'section':              c_sec,
            'class_display':        f"{c_name} - {c_sec}".strip(' -') if c_name else '',
            'school_id':            self.school_id,
            'session':              self.session,
            'dob':                  self.dob.strftime('%Y-%m-%d') if self.dob else '',
            'gender':               self.gender or '',
            'blood_group':          self.blood_group or '',
            'address':              self.address or '',
            'name':                 self.user.name  if self.user else '',
            'email':                self.user.email if self.user else '',
            'parent_name':          self.parent_name or self.father_name or '',
            'parent_phone':         self.parent_phone or '',
            'parent_email':         self.parent_email or '',
            'father_name':          self.father_name or '',
            'father_occupation':    self.father_occupation or '',
            'mother_name':          self.mother_name or '',
            'mother_occupation':    self.mother_occupation or '',
            'guardian_name':        self.guardian_name or '',
            'guardian_relation':    self.guardian_relation or '',
            'guardian_phone':       self.guardian_phone or '',
            'aadhar_no':            self.aadhar_no or '',
            'parent_aadhar_no':     self.parent_aadhar_no or '',
            'category':             self.category or 'General',
            'nationality':          self.nationality or 'Indian',
            'religion':             self.religion or '',
            'is_first_school':      bool(self.is_first_school),
            'previous_school_name': self.previous_school_name or '',
            'previous_class':       self.previous_class or '',
            'previous_tc_no':       self.previous_tc_no or '',
            'previous_tc_date':     self.previous_tc_date.strftime('%Y-%m-%d') if self.previous_tc_date else '',
            'previous_reason':      self.previous_reason or '',
            'photo_url':            self.photo_url,
        }


class Attendance(db.Model):
    __tablename__ = 'attendance'

    id         = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id   = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    date       = db.Column(db.Date, nullable=False)
    status     = db.Column(db.String(10), default='PRESENT')
    marked_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    remarks    = db.Column(db.String(200))

    __table_args__ = (db.UniqueConstraint('student_id', 'date', name='uq_attendance'),)

    def to_dict(self):
        return {
            'id':         self.id,
            'student_id': self.student_id,
            'date':       str(self.date),
            'status':     self.status,
        }


class Marks(db.Model):
    __tablename__ = 'marks'

    id             = db.Column(db.Integer, primary_key=True)
    student_id     = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    subject_id     = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False)

    # NEW: proper link to ExamSchedule (replaces relying only on exam_type string match)
    exam_id        = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=True)

    # NEW: denormalized for fast tenant-scoped + topper-aggregation queries
    class_id       = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True)

    # kept for backward compat with existing result-card lookup (Marks.exam_type == exam.exam_name)
    exam_type      = db.Column(db.String(50))

    marks_obtained = db.Column(db.Float, default=0)
    max_marks      = db.Column(db.Float, default=100)
    grade          = db.Column(db.String(5))

    # NEW: explicit absent flag (so 0 marks vs "did not appear" aren't confused in analytics)
    is_absent      = db.Column(db.Boolean, default=False)
    is_locked      = db.Column(db.Boolean, default=False)

    # NEW — Result Management System (RMS):
    # explicit status override for the mark-entry table's "Status" column —
    # PASS / FAIL / ABSENT / MEDICAL_LEAVE / NOT_EVALUATED. Kept separate from
    # is_absent (back-compat) because "Medical Leave" is not the same as a
    # plain absence for reporting purposes. Null = derive from marks (legacy rows).
    student_status = db.Column(db.String(20), nullable=True)

    # NEW — RMS optimistic locking: incremented on every save. save-draft
    # calls pass the version they last read; a mismatch means someone else
    # (teacher + principal editing at once) saved in between → 409 conflict
    # instead of one silently overwriting the other's change.
    version        = db.Column(db.Integer, default=0)

    remarks        = db.Column(db.String(200))
    entered_by     = db.Column(db.Integer, db.ForeignKey('users.id'))
    entered_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # NEW: one mark entry per student+subject+exam (prevents duplicate rows on re-save)
    __table_args__ = (
        db.UniqueConstraint('student_id', 'subject_id', 'exam_id', name='uq_marks_student_subject_exam'),
    )

    def to_dict(self):
        pct = round(self.marks_obtained / self.max_marks * 100, 2) if self.max_marks else 0
        return {
            'id':             self.id,
            'student_id':     self.student_id,
            'subject_id':     self.subject_id,
            'subject_name':   self.subject.name if self.subject else 'N/A',
            'exam_id':        self.exam_id,
            'class_id':       self.class_id,
            'exam_type':      self.exam_type,
            'marks_obtained': self.marks_obtained,
            'max_marks':      self.max_marks,
            'percentage':     pct,
            'grade':          self.grade,
            'is_absent':      self.is_absent,
            'student_status': self.student_status,   # NEW
            'version':        self.version or 0,       # NEW
            'remarks':        self.remarks or '',
        }


class Note(db.Model):
    __tablename__ = 'notes'

    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    file_url    = db.Column(db.String(500))
    file_name   = db.Column(db.String(200))
    subject_id  = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True)
    class_id    = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'title':       self.title,
            'description': self.description,
            'file_url':    self.file_url,
            'file_name':   self.file_name,
            'subject_id':  self.subject_id,
            'uploaded_at': self.uploaded_at.isoformat(),
        }


class TeacherAttendance(db.Model):
    """Daily attendance record for teachers/staff."""
    __tablename__ = 'teacher_attendance'

    id         = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False)
    date       = db.Column(db.Date, nullable=False)
    status     = db.Column(db.String(20), default='PRESENT')
    check_in   = db.Column(db.String(10))
    check_out  = db.Column(db.String(10))
    marked_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    remarks    = db.Column(db.String(200))

    teacher = db.relationship('Teacher', backref='attendance_records')

    __table_args__ = (
        db.UniqueConstraint('teacher_id', 'date', name='uq_teacher_attendance'),
    )

    def to_dict(self):
        return {
            'id':         self.id,
            'teacher_id': self.teacher_id,
            'date':       str(self.date),
            'status':     self.status,
            'check_in':   self.check_in,
            'check_out':  self.check_out,
            'remarks':    self.remarks,
        }


class TeacherAttendanceRequest(db.Model):
    """Teacher self-marks attendance → principal approves/denies."""
    __tablename__ = 'teacher_attendance_requests'

    id          = db.Column(db.Integer, primary_key=True)
    teacher_id  = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False)
    date        = db.Column(db.Date, nullable=False)
    status      = db.Column(db.String(20), default='PRESENT')
    check_in    = db.Column(db.String(10))
    check_out   = db.Column(db.String(10))
    remarks     = db.Column(db.String(200), default='')
    approval    = db.Column(db.String(20), default='PENDING')
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    teacher = db.relationship('Teacher', backref='attendance_requests')

    __table_args__ = (
        db.UniqueConstraint('teacher_id', 'date', name='uq_teacher_att_request'),
    )

    def to_dict(self):
        return {
            'id':          self.id,
            'teacher_id':  self.teacher_id,
            'date':        str(self.date),
            'status':      self.status,
            'check_in':    self.check_in,
            'check_out':   self.check_out,
            'remarks':     self.remarks,
            'approval':    self.approval,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
        }
