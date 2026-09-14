from app import db
from datetime import datetime, date
from app.utils.timezone_util import utc_now


# ─── Enums & Constants ─────────────────────────────────────────────────────────

CURRICULUM_STATUSES = ['ACTIVE', 'ARCHIVED', 'DRAFT']

CHAPTER_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']

TOPIC_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']

TEACHING_STATUSES = [
    'STARTED', 'IN_PROGRESS', 'COMPLETED',
    'REVISION', 'REMEDIAL', 'ASSESSMENT'
]

UNDERSTANDING_LEVELS = ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_SUPPORT']

ASSESSMENT_TYPES = [
    'ORAL_QUESTIONS', 'QUIZ', 'CLASS_TEST',
    'WORKSHEET_CHECK', 'OBSERVATION', 'PRACTICE', 'OTHER'
]

WORKSHEET_TYPES = [
    'PRACTICE_WORKSHEET', 'CLASS_ACTIVITY', 'HOMEWORK_WORKSHEET',
    'REVISION_WORKSHEET', 'ASSESSMENT_WORKSHEET', 'REMEDIAL_WORKSHEET',
    'PROJECT', 'ASSIGNMENT', 'OTHER'
]

WORKSHEET_STATUSES = ['GIVEN', 'SUBMITTED', 'CHECKED', 'CLOSED']


# ─── 1. Curriculum / Syllabus Master ──────────────────────────────────────────

class Curriculum(db.Model):
    """
    Curriculum/Syllabus master container.
    Strictly session-aware and scoped to (school_id, session, class_id, subject_id).
    Links the textbook/curriculum structure for that specific academic session.
    """
    __tablename__ = 'curriculums'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    session            = db.Column(db.String(20), default='2026-27', nullable=False, index=True)
    class_id           = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id         = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)

    book_name          = db.Column(db.String(200), nullable=False)   # e.g., "NCERT Mathematics", "Honeycomb"
    publisher          = db.Column(db.String(150), default='')
    book_code          = db.Column(db.String(50), default='')        # ISBN or syllabus code
    total_chapters     = db.Column(db.Integer, default=0)
    estimated_periods  = db.Column(db.Integer, default=0)            # Total planned periods for year
    description        = db.Column(db.Text, default='')
    status             = db.Column(db.String(20), default='ACTIVE', index=True) # ACTIVE / ARCHIVED / DRAFT

    created_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    class_ref          = db.relationship('Class', backref=db.backref('curriculums', lazy='dynamic'))
    subject_ref        = db.relationship('Subject', backref=db.backref('curriculums', lazy='dynamic'))
    creator            = db.relationship('User', foreign_keys=[created_by])
    chapters           = db.relationship(
        'CurriculumChapter', backref='curriculum',
        lazy='dynamic', cascade='all, delete-orphan',
        order_by='CurriculumChapter.sort_order.asc(), CurriculumChapter.chapter_no.asc()'
    )

    __table_args__ = (
        db.UniqueConstraint('school_id', 'session', 'class_id', 'subject_id', name='uq_curriculum_session_class_sub'),
        db.Index('idx_curriculum_lookup', 'school_id', 'session', 'class_id', 'subject_id'),
    )

    def to_dict(self, include_chapters=False, include_progress=False):
        cls_name = f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else ''
        sub_name = self.subject_ref.name if self.subject_ref else ''
        sub_code = self.subject_ref.code if self.subject_ref else ''

        data = {
            'id':                self.id,
            'school_id':         self.school_id,
            'session':           self.session,
            'class_id':          self.class_id,
            'class_name':        cls_name,
            'subject_id':        self.subject_id,
            'subject_name':      sub_name,
            'subject_code':      sub_code,
            'book_name':         self.book_name,
            'publisher':         self.publisher or '',
            'book_code':         self.book_code or '',
            'total_chapters':    self.total_chapters or self.chapters.count(),
            'estimated_periods': self.estimated_periods or 0,
            'description':       self.description or '',
            'status':            self.status,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
            'updated_at':        self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_chapters:
            data['chapters'] = [ch.to_dict(include_topics=True) for ch in self.chapters.all()]

        if include_progress:
            from app.services.curriculum_service import calculate_curriculum_coverage
            data['progress'] = calculate_curriculum_coverage(self.id)

        return data


# ─── 2. Curriculum Chapter ───────────────────────────────────────────────────

class CurriculumChapter(db.Model):
    """
    Chapter/Unit within a Curriculum.
    Maintains planned vs. actual schedule, estimated periods, and completion status.
    """
    __tablename__ = 'curriculum_chapters'

    id                      = db.Column(db.Integer, primary_key=True)
    school_id               = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    curriculum_id           = db.Column(db.Integer, db.ForeignKey('curriculums.id'), nullable=False, index=True)

    chapter_no              = db.Column(db.Integer, nullable=False)       # 1, 2, 3...
    title                   = db.Column(db.String(250), nullable=False)   # e.g., "Fractions & Decimals"
    description             = db.Column(db.Text, default='')
    estimated_periods       = db.Column(db.Integer, default=1)            # e.g. 10 periods
    weightage               = db.Column(db.Float, default=0.0)            # Exam marks weightage if any

    planned_start_date      = db.Column(db.Date, nullable=True)
    planned_completion_date = db.Column(db.Date, nullable=True)
    actual_start_date       = db.Column(db.Date, nullable=True)
    actual_completion_date  = db.Column(db.Date, nullable=True)

    status                  = db.Column(db.String(20), default='NOT_STARTED', index=True) # NOT_STARTED, IN_PROGRESS, COMPLETED
    learning_outcomes       = db.Column(db.Text, default='')
    sort_order              = db.Column(db.Integer, default=0)
    is_active               = db.Column(db.Boolean, default=True)

    created_at              = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at              = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    topics                  = db.relationship(
        'CurriculumTopic', backref='chapter',
        lazy='dynamic', cascade='all, delete-orphan',
        order_by='CurriculumTopic.sort_order.asc(), CurriculumTopic.topic_no.asc()'
    )
    teaching_logs           = db.relationship('TeachingLog', backref='chapter', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('curriculum_id', 'chapter_no', name='uq_curriculum_chapter_no'),
        db.Index('idx_chapter_curriculum_status', 'curriculum_id', 'status'),
    )

    def to_dict(self, include_topics=False):
        topic_list = self.topics.all() if include_topics else []
        total_topics = len(topic_list) if include_topics else self.topics.count()
        completed_topics = sum(1 for t in topic_list if t.status == 'COMPLETED') if include_topics else self.topics.filter_by(status='COMPLETED').count()

        data = {
            'id':                      self.id,
            'school_id':               self.school_id,
            'curriculum_id':           self.curriculum_id,
            'chapter_no':              self.chapter_no,
            'title':                   self.title,
            'description':             self.description or '',
            'estimated_periods':       self.estimated_periods or 1,
            'weightage':               self.weightage or 0.0,
            'planned_start_date':      self.planned_start_date.isoformat() if self.planned_start_date else None,
            'planned_completion_date': self.planned_completion_date.isoformat() if self.planned_completion_date else None,
            'actual_start_date':       self.actual_start_date.isoformat() if self.actual_start_date else None,
            'actual_completion_date':  self.actual_completion_date.isoformat() if self.actual_completion_date else None,
            'status':                  self.status,
            'learning_outcomes':       self.learning_outcomes or '',
            'sort_order':              self.sort_order or 0,
            'is_active':               self.is_active,
            'total_topics':            total_topics,
            'completed_topics':        completed_topics,
            'completion_pct':          round((completed_topics / total_topics * 100), 1) if total_topics else (100.0 if self.status == 'COMPLETED' else 0.0),
        }

        if include_topics:
            data['topics'] = [t.to_dict() for t in topic_list]

        return data


# ─── 3. Curriculum Topic ─────────────────────────────────────────────────────

class CurriculumTopic(db.Model):
    """
    Specific topic under a chapter.
    Teachers map daily teaching entries directly to topics for granular tracking.
    """
    __tablename__ = 'curriculum_topics'

    id                      = db.Column(db.Integer, primary_key=True)
    school_id               = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    chapter_id              = db.Column(db.Integer, db.ForeignKey('curriculum_chapters.id'), nullable=False, index=True)

    topic_no                = db.Column(db.Integer, nullable=False)       # 1, 2, 3...
    title                   = db.Column(db.String(250), nullable=False)   # e.g., "Equivalent Fractions"
    description             = db.Column(db.Text, default='')
    sub_topics              = db.Column(db.Text, default='')              # Optional comma/newline separated sub-topics
    estimated_periods       = db.Column(db.Integer, default=1)            # e.g. 2 periods

    planned_start_date      = db.Column(db.Date, nullable=True)
    planned_completion_date = db.Column(db.Date, nullable=True)
    actual_start_date       = db.Column(db.Date, nullable=True)
    actual_completion_date  = db.Column(db.Date, nullable=True)

    learning_objectives     = db.Column(db.Text, default='')
    status                  = db.Column(db.String(20), default='NOT_STARTED', index=True) # NOT_STARTED, IN_PROGRESS, COMPLETED
    sort_order              = db.Column(db.Integer, default=0)
    is_active               = db.Column(db.Boolean, default=True)

    created_at              = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at              = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    teaching_logs           = db.relationship('TeachingLog', backref='topic', lazy='dynamic')
    worksheets              = db.relationship('TeachingWorksheet', backref='topic', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('chapter_id', 'topic_no', name='uq_chapter_topic_no'),
        db.Index('idx_topic_chapter_status', 'chapter_id', 'status'),
    )

    def to_dict(self):
        logs_count = self.teaching_logs.count()
        periods_spent = sum(log.periods_used or 1 for log in self.teaching_logs.all())

        return {
            'id':                      self.id,
            'school_id':               self.school_id,
            'chapter_id':              self.chapter_id,
            'topic_no':                self.topic_no,
            'title':                   self.title,
            'description':             self.description or '',
            'sub_topics':              self.sub_topics or '',
            'estimated_periods':       self.estimated_periods or 1,
            'planned_start_date':      self.planned_start_date.isoformat() if self.planned_start_date else None,
            'planned_completion_date': self.planned_completion_date.isoformat() if self.planned_completion_date else None,
            'actual_start_date':       self.actual_start_date.isoformat() if self.actual_start_date else None,
            'actual_completion_date':  self.actual_completion_date.isoformat() if self.actual_completion_date else None,
            'learning_objectives':     self.learning_objectives or '',
            'status':                  self.status,
            'sort_order':              self.sort_order or 0,
            'is_active':               self.is_active,
            'teaching_logs_count':     logs_count,
            'periods_spent':           periods_spent,
        }


# ─── 4. Teacher Daily Diary / Teaching Log ────────────────────────────────────

class TeachingLog(db.Model):
    """
    Daily teaching record entered by a teacher for a specific period.
    Tracks exact classroom delivery, classwork, homework, worksheets, and pedagogy.
    """
    __tablename__ = 'teaching_logs'

    id                           = db.Column(db.Integer, primary_key=True)
    school_id                    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    session                      = db.Column(db.String(20), default='2026-27', nullable=False, index=True)

    teacher_id                   = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=False, index=True)
    class_id                     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id                   = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    chapter_id                   = db.Column(db.Integer, db.ForeignKey('curriculum_chapters.id'), nullable=True, index=True)
    topic_id                     = db.Column(db.Integer, db.ForeignKey('curriculum_topics.id'), nullable=True, index=True)
    sub_topic                    = db.Column(db.String(250), default='')

    date                         = db.Column(db.Date, default=date.today, nullable=False, index=True)
    period_no                    = db.Column(db.Integer, default=1, nullable=False)
    timetable_period_id          = db.Column(db.Integer, db.ForeignKey('timetable_periods.id'), nullable=True)

    periods_used                 = db.Column(db.Integer, default=1, nullable=False)
    teaching_status              = db.Column(db.String(20), default='IN_PROGRESS') # STARTED, IN_PROGRESS, COMPLETED, REVISION, REMEDIAL, ASSESSMENT
    topic_completion_status      = db.Column(db.String(20), default='IN_PROGRESS') # IN_PROGRESS, COMPLETED

    what_was_taught              = db.Column(db.Text, nullable=False)              # Narrative content taught
    learning_objectives          = db.Column(db.Text, default='')                  # Specific outcome for this period
    teaching_pedagogy            = db.Column(db.String(300), default='Explanation / Lecture') # Lecture, Activity, Smart Class etc.
    classwork_done               = db.Column(db.Text, default='')                  # e.g. "Exercise 3.2 Q1-5"

    # Homework
    homework_given               = db.Column(db.Boolean, default=False)
    homework_description         = db.Column(db.Text, default='')
    homework_due_date            = db.Column(db.Date, nullable=True)
    homework_attachment_url      = db.Column(db.String(500), default='')

    # Worksheet
    worksheet_given              = db.Column(db.Boolean, default=False)

    # Check for understanding / Assessment
    quick_assessment_done        = db.Column(db.Boolean, default=False)
    assessment_type              = db.Column(db.String(50), default='')            # Oral, Quiz, Test, etc.
    assessment_remarks           = db.Column(db.Text, default='')
    student_understanding_level  = db.Column(db.String(30), default='GOOD')       # EXCELLENT, GOOD, AVERAGE, NEEDS_SUPPORT
    students_needing_support     = db.Column(db.Text, default='')                  # Names / roll numbers of struggling students

    # Resource Attachment
    attachment_url               = db.Column(db.String(500), default='')
    attachment_name              = db.Column(db.String(255), default='')
    attachment_type              = db.Column(db.String(50), default='')

    created_by                   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    updated_by                   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at                   = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at                   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    class_ref                    = db.relationship('Class', backref='teaching_logs')
    subject_ref                  = db.relationship('Subject', backref='teaching_logs')
    teacher_ref                  = db.relationship('Teacher', backref='teaching_logs')
    timetable_period_ref         = db.relationship('TimetablePeriod', backref='teaching_logs')
    worksheets                   = db.relationship('TeachingWorksheet', backref='teaching_log', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'teacher_id', 'date', 'period_no', 'class_id', 'subject_id', name='uq_teaching_log_slot'),
        db.Index('idx_teaching_log_query', 'school_id', 'session', 'date', 'teacher_id'),
        db.Index('idx_teaching_log_subject', 'school_id', 'session', 'class_id', 'subject_id'),
    )

    def to_dict(self):
        cls_name = f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else ''
        sub_name = self.subject_ref.name if self.subject_ref else ''
        t_name   = self.teacher_ref.user.name if (self.teacher_ref and self.teacher_ref.user) else ''

        return {
            'id':                          self.id,
            'school_id':                   self.school_id,
            'session':                     self.session,
            'teacher_id':                  self.teacher_id,
            'teacher_name':                t_name,
            'class_id':                    self.class_id,
            'class_name':                  cls_name,
            'subject_id':                  self.subject_id,
            'subject_name':                sub_name,
            'chapter_id':                  self.chapter_id,
            'chapter_title':               self.chapter.title if self.chapter else '',
            'chapter_no':                  self.chapter.chapter_no if self.chapter else None,
            'topic_id':                    self.topic_id,
            'topic_title':                 self.topic.title if self.topic else '',
            'topic_no':                    self.topic.topic_no if self.topic else None,
            'sub_topic':                   self.sub_topic or '',
            'date':                        self.date.isoformat() if self.date else None,
            'period_no':                   self.period_no,
            'periods_used':                self.periods_used or 1,
            'timetable_period_id':         self.timetable_period_id,
            'teaching_status':             self.teaching_status,
            'topic_completion_status':     self.topic_completion_status,
            'what_was_taught':             self.what_was_taught,
            'learning_objectives':         self.learning_objectives or '',
            'teaching_pedagogy':           self.teaching_pedagogy or 'Explanation / Lecture',
            'classwork_done':              self.classwork_done or '',
            'homework_given':              self.homework_given,
            'homework_description':      self.homework_description or '',
            'homework_due_date':           self.homework_due_date.isoformat() if self.homework_due_date else None,
            'homework_attachment_url':     self.homework_attachment_url or '',
            'worksheet_given':             self.worksheet_given,
            'quick_assessment_done':       self.quick_assessment_done,
            'assessment_type':             self.assessment_type or '',
            'assessment_remarks':          self.assessment_remarks or '',
            'student_understanding_level': self.student_understanding_level or 'GOOD',
            'students_needing_support':    self.students_needing_support or '',
            'attachment_url':              self.attachment_url or '',
            'attachment_name':             self.attachment_name or '',
            'attachment_type':             self.attachment_type or '',
            'worksheets':                  [w.to_dict() for w in self.worksheets.all()],
            'created_at':                  self.created_at.isoformat() if self.created_at else None,
            'updated_at':                  self.updated_at.isoformat() if self.updated_at else None,
        }


# ─── 5. Teaching Worksheet / Classroom Activity ───────────────────────────────

class TeachingWorksheet(db.Model):
    """
    Topic-specific worksheet or classroom activity given by a teacher.
    Linked to the Curriculum chapter, topic, and optional daily teaching log.
    """
    __tablename__ = 'teaching_worksheets'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    session            = db.Column(db.String(20), default='2026-27', nullable=False, index=True)

    teaching_log_id    = db.Column(db.Integer, db.ForeignKey('teaching_logs.id'), nullable=True, index=True)
    class_id           = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id         = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    chapter_id         = db.Column(db.Integer, db.ForeignKey('curriculum_chapters.id'), nullable=True, index=True)
    topic_id           = db.Column(db.Integer, db.ForeignKey('curriculum_topics.id'), nullable=True, index=True)

    title              = db.Column(db.String(250), nullable=False)   # e.g., "Fractions Practice Set 1"
    worksheet_type     = db.Column(db.String(30), default='PRACTICE_WORKSHEET', index=True)
    description        = db.Column(db.Text, default='')
    instructions       = db.Column(db.Text, default='')

    given_date         = db.Column(db.Date, default=date.today, nullable=False)
    due_date           = db.Column(db.Date, nullable=True)
    attachment_url     = db.Column(db.String(500), default='')
    attachment_name    = db.Column(db.String(255), default='')
    max_marks          = db.Column(db.Float, nullable=True)
    completion_status  = db.Column(db.String(20), default='GIVEN')   # GIVEN / SUBMITTED / CHECKED / CLOSED

    created_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at         = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    class_ref          = db.relationship('Class')
    subject_ref        = db.relationship('Subject')
    chapter_ref        = db.relationship('CurriculumChapter')
    creator            = db.relationship('User', foreign_keys=[created_by])

    __table_args__ = (
        db.Index('idx_worksheet_query', 'school_id', 'session', 'class_id', 'subject_id'),
    )

    def to_dict(self):
        cls_name = f"{self.class_ref.name} - {self.class_ref.section}" if self.class_ref else ''
        sub_name = self.subject_ref.name if self.subject_ref else ''

        return {
            'id':                self.id,
            'school_id':         self.school_id,
            'session':           self.session,
            'teaching_log_id':   self.teaching_log_id,
            'class_id':          self.class_id,
            'class_name':        cls_name,
            'subject_id':        self.subject_id,
            'subject_name':      sub_name,
            'chapter_id':        self.chapter_id,
            'chapter_title':     self.chapter_ref.title if self.chapter_ref else '',
            'topic_id':          self.topic_id,
            'topic_title':       self.topic.title if self.topic else '',
            'title':             self.title,
            'worksheet_type':    self.worksheet_type,
            'description':       self.description or '',
            'instructions':      self.instructions or '',
            'given_date':        self.given_date.isoformat() if self.given_date else None,
            'due_date':          self.due_date.isoformat() if self.due_date else None,
            'attachment_url':    self.attachment_url or '',
            'attachment_name':   self.attachment_name or '',
            'max_marks':         self.max_marks,
            'completion_status': self.completion_status,
            'created_by':        self.created_by,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }
