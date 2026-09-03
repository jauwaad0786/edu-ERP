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

    # Soft-delete & Archive metadata
    is_deleted    = db.Column(db.Boolean, default=False, nullable=False, index=True)
    deleted_at    = db.Column(db.DateTime, nullable=True)
    deleted_by    = db.Column(db.Integer, nullable=True)
    delete_reason = db.Column(db.String(255), nullable=True)
    is_anonymized = db.Column(db.Boolean, default=False, nullable=False)

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
            'is_deleted':    getattr(self, 'is_deleted', False),
            'deleted_at':    self.deleted_at.isoformat() if getattr(self, 'deleted_at', None) else None,
            'is_anonymized': getattr(self, 'is_anonymized', False),
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

    # Soft-delete & Archive metadata
    is_deleted           = db.Column(db.Boolean, default=False, nullable=False, index=True)
    deleted_at           = db.Column(db.DateTime, nullable=True)
    deleted_by           = db.Column(db.Integer, nullable=True)
    delete_reason        = db.Column(db.String(255), nullable=True)
    is_anonymized        = db.Column(db.Boolean, default=False, nullable=False)

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
            'is_deleted':           getattr(self, 'is_deleted', False),
            'deleted_at':           self.deleted_at.isoformat() if getattr(self, 'deleted_at', None) else None,
            'is_anonymized':        getattr(self, 'is_anonymized', False),
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

    id            = db.Column(db.Integer, primary_key=True)
    title         = db.Column(db.String(200), nullable=False)
    description   = db.Column(db.Text, default='')
    file_url      = db.Column(db.String(500), nullable=False)
    file_name     = db.Column(db.String(255))
    file_size     = db.Column(db.Integer, nullable=True)
    file_type     = db.Column(db.String(50), nullable=True)
    subject_id    = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True, index=True)
    class_id      = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True, index=True)
    teacher_id    = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True, index=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    academic_year = db.Column(db.String(20), default='2026')
    uploaded_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    uploaded_at   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    class_ref   = db.relationship('Class', backref='notes', lazy='select')
    teacher_ref = db.relationship('Teacher', backref='notes', lazy='select')
    subject_ref = db.relationship('Subject', foreign_keys=[subject_id], lazy='select', overlaps="notes,subject")
    uploader    = db.relationship('User', foreign_keys=[uploaded_by], lazy='select')

    def to_dict(self):
        # Subject nested info
        sub_obj = self.subject_ref
        if not sub_obj and self.subject_id:
            try:
                sub_obj = Subject.query.get(self.subject_id)
            except Exception:
                sub_obj = None

        sub_dict = {
            'id': sub_obj.id,
            'name': sub_obj.name,
            'code': getattr(sub_obj, 'code', '') or ''
        } if sub_obj else None

        # Class nested info
        cls_obj = self.class_ref
        if not cls_obj and self.class_id:
            try:
                cls_obj = Class.query.get(self.class_id)
            except Exception:
                cls_obj = None

        cls_dict = {
            'id': cls_obj.id,
            'name': cls_obj.name,
            'section': getattr(cls_obj, 'section', '') or ''
        } if cls_obj else None

        # Teacher / Uploader nested info
        teacher_dict = None
        if self.teacher_ref and self.teacher_ref.user:
            teacher_dict = {
                'id': self.teacher_ref.id,
                'name': self.teacher_ref.user.name,
                'email': self.teacher_ref.user.email,
                'phone': getattr(self.teacher_ref.user, 'phone', '') or '',
                'designation': getattr(self.teacher_ref, 'designation', 'Teacher') or 'Teacher',
            }
        elif self.uploader:
            teacher_dict = {
                'id': None,
                'name': self.uploader.name,
                'email': self.uploader.email,
                'phone': getattr(self.uploader, 'phone', '') or '',
                'designation': getattr(self.uploader, 'role', 'Staff') or 'Staff',
            }

        class_name_str = f"{cls_dict['name']} - {cls_dict['section']}" if (cls_dict and cls_dict.get('section')) else (cls_dict['name'] if cls_dict else 'All Classes')
        subject_name_str = sub_dict['name'] if sub_dict else 'General'
        teacher_name_str = teacher_dict['name'] if teacher_dict else 'School Staff'

        return {
            'id':            self.id,
            'title':         self.title,
            'description':   self.description or '',
            'file_url':      self.file_url,
            'file_name':     self.file_name or '',
            'file_size':     self.file_size or 0,
            'file_type':     self.file_type or '',
            'subject_id':    self.subject_id,
            'subject_name':  subject_name_str,
            'subject':       sub_dict,
            'class_id':      self.class_id,
            'class_name':    class_name_str,
            'class':         cls_dict,
            'teacher_id':    self.teacher_id,
            'teacher_name':  teacher_name_str,
            'teacher':       teacher_dict,
            'school_id':     self.school_id,
            'academic_year': self.academic_year or '2026',
            'uploaded_by':   self.uploaded_by,
            'uploaded_at':   self.uploaded_at.isoformat() if self.uploaded_at else None,
            'updated_at':   self.updated_at.isoformat() if self.updated_at else None,
        }


class Assignment(db.Model):
    """
    Dedicated academic assignment given by Teacher or Principal.
    """
    __tablename__ = 'assignments'

    id              = db.Column(db.Integer, primary_key=True)
    assignment_uid  = db.Column(db.String(30), nullable=True, index=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    class_id        = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id      = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    teacher_id      = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True, index=True)
    created_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title           = db.Column(db.String(250), nullable=False)
    description     = db.Column(db.Text, default='')
    attachment_url  = db.Column(db.String(500), nullable=True)
    attachment_name = db.Column(db.String(255), nullable=True)
    attachment_size = db.Column(db.Integer, nullable=True)
    max_marks       = db.Column(db.Float, default=20.0, nullable=False)
    due_date        = db.Column(db.DateTime, nullable=False)
    academic_year   = db.Column(db.String(20), default='2026')
    status          = db.Column(db.String(20), default='ACTIVE')
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    class_ref   = db.relationship('Class', backref='assignments', lazy='select')
    subject     = db.relationship('Subject', backref='assignments', lazy='select')
    teacher     = db.relationship('Teacher', backref='assignments', lazy='select')
    creator     = db.relationship('User', foreign_keys=[created_by], lazy='select')
    submissions = db.relationship('AssignmentSubmission', backref='assignment', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_stats=False):
        cls_name = f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else ''
        sub_name = self.subject.name if self.subject else ''
        t_name   = self.teacher.user.name if (self.teacher and self.teacher.user) else (self.creator.name if self.creator else 'Teacher')

        data = {
            'id':              self.id,
            'assignment_uid':  self.assignment_uid or f"ASN-{self.id:04d}",
            'school_id':       self.school_id,
            'class_id':        self.class_id,
            'class_name':      cls_name,
            'subject_id':      self.subject_id,
            'subject_name':    sub_name,
            'teacher_id':      self.teacher_id,
            'teacher_name':    t_name,
            'created_by':      self.created_by,
            'title':           self.title,
            'description':     self.description or '',
            'attachment_url':  self.attachment_url,
            'attachment_name': self.attachment_name,
            'attachment_size': self.attachment_size,
            'max_marks':       self.max_marks,
            'due_date':        self.due_date.isoformat() if self.due_date else None,
            'academic_year':   self.academic_year or '2026',
            'status':          self.status or 'ACTIVE',
            'created_at':      self.created_at.isoformat() if self.created_at else None,
            'updated_at':      self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_stats:
            total_students = Student.query.filter_by(school_id=self.school_id, class_id=self.class_id).count()
            subs = self.submissions.all()
            submitted_count = len(subs)
            marked_count = sum(1 for s in subs if s.status == 'MARKED' and s.marks_obtained is not None)
            pending_count = max(0, total_students - submitted_count)
            avg_marks = round(sum(s.marks_obtained for s in subs if s.marks_obtained is not None) / marked_count, 2) if marked_count > 0 else 0
            data['stats'] = {
                'total_students':  total_students,
                'submitted_count': submitted_count,
                'marked_count':    marked_count,
                'pending_count':   pending_count,
                'average_marks':   avg_marks,
            }
        return data


class AssignmentSubmission(db.Model):
    """
    Student submission strictly linked to one specific assignment_id.
    """
    __tablename__ = 'assignment_submissions'

    id              = db.Column(db.Integer, primary_key=True)
    assignment_id   = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False, index=True)
    student_id      = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    file_url        = db.Column(db.String(500), nullable=False)
    file_name       = db.Column(db.String(255), nullable=True)
    file_size       = db.Column(db.Integer, nullable=True)
    file_type       = db.Column(db.String(50), nullable=True)
    student_comment = db.Column(db.Text, default='')
    submitted_at    = db.Column(db.DateTime, default=datetime.utcnow)
    status          = db.Column(db.String(20), default='SUBMITTED')
    marks_obtained  = db.Column(db.Float, nullable=True)
    teacher_feedback= db.Column(db.Text, nullable=True)
    marked_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    marked_at       = db.Column(db.DateTime, nullable=True)

    student = db.relationship('Student', backref='assignment_submissions', lazy='select')
    grader  = db.relationship('User', foreign_keys=[marked_by], lazy='select')

    __table_args__ = (
        db.UniqueConstraint('assignment_id', 'student_id', name='uq_assignment_student_submission'),
    )

    def to_dict(self):
        st_name = self.student.user.name if (self.student and self.student.user) else 'Student'
        st_roll = self.student.roll_number if self.student else ''
        st_adm  = self.student.admission_no if self.student else ''
        grader_name = self.grader.name if self.grader else ''

        return {
            'id':               self.id,
            'assignment_id':    self.assignment_id,
            'student_id':       self.student_id,
            'student_name':     st_name,
            'roll_number':      st_roll,
            'admission_no':     st_adm,
            'school_id':        self.school_id,
            'file_url':         self.file_url,
            'file_name':        self.file_name or '',
            'file_size':        self.file_size,
            'file_type':        self.file_type or '',
            'student_comment':  self.student_comment or '',
            'submitted_at':     self.submitted_at.isoformat() if self.submitted_at else None,
            'status':           self.status,
            'marks_obtained':   self.marks_obtained,
            'teacher_feedback': self.teacher_feedback or '',
            'marked_by':        self.marked_by,
            'marked_by_name':   grader_name,
            'marked_at':        self.marked_at.isoformat() if self.marked_at else None,
        }


class InternalMarks(db.Model):
    """
    Continuous internal assessment marks per subject & academic session.
    Immediately visible to students without requiring explicit exam publishing.
    """
    __tablename__ = 'internal_marks'

    id                  = db.Column(db.Integer, primary_key=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id          = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    class_id            = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id          = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    teacher_id          = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True, index=True)
    entered_by          = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    academic_year       = db.Column(db.String(20), default='2026', nullable=False)
    term                = db.Column(db.String(50), default='Continuous Assessment')
    marks_obtained      = db.Column(db.Float, default=0.0, nullable=False)
    max_marks           = db.Column(db.Float, default=20.0, nullable=False)
    component_breakdown = db.Column(db.Text, default='{}')
    remarks             = db.Column(db.String(250), default='')
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = db.relationship('Student', backref='internal_marks_records', lazy='select')
    subject = db.relationship('Subject', backref='internal_marks_records', lazy='select')
    class_ref = db.relationship('Class', backref='internal_marks_records', lazy='select')
    teacher = db.relationship('Teacher', backref='internal_marks_records', lazy='select')
    evaluator = db.relationship('User', foreign_keys=[entered_by], lazy='select')

    __table_args__ = (
        db.UniqueConstraint('student_id', 'subject_id', 'academic_year', 'term', name='uq_student_subject_internal_marks'),
    )

    def to_dict(self):
        import json
        pct = round(self.marks_obtained / self.max_marks * 100, 2) if self.max_marks else 0
        try:
            breakdown = json.loads(self.component_breakdown) if self.component_breakdown else {}
        except Exception:
            breakdown = {}

        st_name = self.student.user.name if (self.student and self.student.user) else ''
        st_roll = self.student.roll_number if self.student else ''
        st_adm  = self.student.admission_no if self.student else ''
        sub_name = self.subject.name if self.subject else ''
        t_name   = self.teacher.user.name if (self.teacher and self.teacher.user) else (self.evaluator.name if self.evaluator else '')

        return {
            'id':                  self.id,
            'school_id':           self.school_id,
            'student_id':          self.student_id,
            'student_name':        st_name,
            'roll_number':         st_roll,
            'admission_no':        st_adm,
            'class_id':            self.class_id,
            'class_name':          f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else '',
            'subject_id':          self.subject_id,
            'subject_name':        sub_name,
            'teacher_id':          self.teacher_id,
            'teacher_name':        t_name,
            'academic_year':       self.academic_year,
            'term':                self.term,
            'marks_obtained':      self.marks_obtained,
            'max_marks':           self.max_marks,
            'percentage':          pct,
            'component_breakdown': breakdown,
            'remarks':             self.remarks or '',
            'updated_at':          self.updated_at.isoformat() if self.updated_at else None,
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
