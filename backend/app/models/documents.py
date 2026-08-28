from app import db
from datetime import datetime


STUDENT_DOC_TYPE_LABELS = {
    'AADHAR':               'Aadhaar Card',
    'AADHAR_STUDENT':       'Student Aadhaar Card',
    'AADHAR_PARENT':        'Parent / Guardian Aadhaar Card',
    'BIRTH_CERTIFICATE':    'Birth Certificate',
    'PHOTO':                'Student Passport Photo',
    'TRANSFER_CERTIFICATE': 'Transfer Certificate (TC)',
    'REPORT_CARD':          'Previous Class Report Card',
    'ADDRESS_PROOF':        'Address Proof',
    'CASTE_CERTIFICATE':    'Caste / Category Certificate',
    'MEDICAL_CERTIFICATE':  'Medical Fitness Certificate',
    'RATION_CARD':          'Ration Card',
    'OTHER':                'Other Document',
}

ISSUED_DOC_TYPE_LABELS = {
    'SCHOOL_LEAVING_CERTIFICATE': 'School Leaving Certificate (SLC)',
    'TRANSFER_CERTIFICATE':       'Transfer Certificate (TC)',
    'TC':                         'Transfer Certificate (TC)',
    'CHARACTER_CERTIFICATE':      'Character Certificate',
    'BONAFIDE':                   'Bonafide Certificate',
    'SPORTS_ACHIEVEMENT':         'Sports Achievement Certificate',
    'ACADEMIC_EXCELLENCE':        'Academic Excellence Certificate',
    'COMPETITION_CERTIFICATE':    'Competition Certificate',
    'CULTURAL_ACTIVITY':          'Cultural Activity Certificate',
    'DEBATE_OLYMPIAD':            'Debate / Quiz / Olympiad Certificate',
    'ATTENDANCE_CERTIFICATE':     'Attendance Certificate',
    'BEST_STUDENT':               'Best Student / Student of the Year',
    'LEADERSHIP_CERTIFICATE':     'Leadership Certificate',
    'PARTICIPATION_CERTIFICATE':  'Participation Certificate',
    'APPRECIATION_CERTIFICATE':   'Appreciation Certificate',
    'FEE_RECEIPT':                'Fee Receipt / Certificate',
    'ID_CARD':                    'School ID Card',
    'MIGRATION':                  'Migration Certificate',
    'OTHER':                      'Other Document',
}

CERTIFICATE_TEMPLATES = [
    {
        'key': 'SCHOOL_LEAVING_CERTIFICATE',
        'title': 'School Leaving Certificate (SLC)',
        'category': 'Transfer & Leaving',
        'theme_color': '#1e3a8a',
        'accent_color': '#2563eb',
        'icon': 'ti-file-export',
        'badge_text': 'OFFICIAL SLC',
        'default_fields': [
            {'key': 'reason_for_leaving', 'label': 'Reason for Leaving', 'type': 'text', 'default': 'On parent\'s own accord / Relocation', 'required': True},
            {'key': 'date_of_leaving', 'label': 'Date of Leaving', 'type': 'date', 'default': '', 'required': True},
            {'key': 'last_class_studied', 'label': 'Class in which last studied', 'type': 'text', 'default': '', 'required': True},
            {'key': 'promoted_to_next', 'label': 'Whether qualified for promotion', 'type': 'select', 'options': ['Yes', 'No', 'N/A - Mid Session'], 'default': 'Yes', 'required': True},
            {'key': 'conduct', 'label': 'General Conduct', 'type': 'select', 'options': ['Exemplary', 'Very Good', 'Good', 'Satisfactory'], 'default': 'Good', 'required': True},
            {'key': 'dues_paid', 'label': 'Month up to which school dues paid', 'type': 'text', 'default': 'All Dues Cleared', 'required': True},
            {'key': 'tc_book_no', 'label': 'Book No. / Sl. No.', 'type': 'text', 'default': '', 'required': False},
        ]
    },
    {
        'key': 'TRANSFER_CERTIFICATE',
        'title': 'Transfer Certificate (TC)',
        'category': 'Transfer & Leaving',
        'theme_color': '#0f766e',
        'accent_color': '#0d9488',
        'icon': 'ti-transfer',
        'badge_text': 'OFFICIAL TC',
        'default_fields': [
            {'key': 'reason_for_leaving', 'label': 'Reason for Leaving', 'type': 'text', 'default': 'Transferred to another school / Family Relocation', 'required': True},
            {'key': 'date_of_leaving', 'label': 'Date of Application for Certificate', 'type': 'date', 'default': '', 'required': True},
            {'key': 'last_class_studied', 'label': 'Class in which last studied', 'type': 'text', 'default': '', 'required': True},
            {'key': 'conduct', 'label': 'General Conduct', 'type': 'select', 'options': ['Very Good', 'Good', 'Satisfactory'], 'default': 'Good', 'required': True},
            {'key': 'dues_paid', 'label': 'School Dues Status', 'type': 'text', 'default': 'Cleared - No Dues Pending', 'required': True},
            {'key': 'total_meetings', 'label': 'Total No. of Working Days', 'type': 'number', 'default': '210', 'required': False},
            {'key': 'attended_meetings', 'label': 'Total No. of Days Present', 'type': 'number', 'default': '195', 'required': False},
        ]
    },
    {
        'key': 'CHARACTER_CERTIFICATE',
        'title': 'Character Certificate',
        'category': 'Conduct & Character',
        'theme_color': '#1d4ed8',
        'accent_color': '#3b82f6',
        'icon': 'ti-certificate',
        'badge_text': 'BONAFIDE & CONDUCT',
        'default_fields': [
            {'key': 'conduct', 'label': 'Conduct & Character', 'type': 'select', 'options': ['Exemplary', 'Very Good', 'Good', 'Satisfactory'], 'default': 'Very Good', 'required': True},
            {'key': 'remarks', 'label': 'Moral / Academic Remarks', 'type': 'text', 'default': 'He/She bears a good moral character and demonstrated keen interest in school activities.', 'required': False},
            {'key': 'purpose', 'label': 'Purpose of Issuance', 'type': 'text', 'default': 'For Higher Studies / Admission', 'required': False},
        ]
    },
    {
        'key': 'BONAFIDE',
        'title': 'Bonafide Certificate',
        'category': 'Academic',
        'theme_color': '#4338ca',
        'accent_color': '#6366f1',
        'icon': 'ti-school',
        'badge_text': 'STUDENT BONAFIDE',
        'default_fields': [
            {'key': 'purpose', 'label': 'Purpose (e.g. Bus Pass, Bank Account, Passport)', 'type': 'text', 'default': 'For Official / Verification Purpose', 'required': True},
            {'key': 'academic_session', 'label': 'Academic Session', 'type': 'text', 'default': '', 'required': True},
            {'key': 'remarks', 'label': 'Additional Remarks', 'type': 'text', 'default': 'This certificate is issued on the request of parent/guardian.', 'required': False},
        ]
    },
    {
        'key': 'SPORTS_ACHIEVEMENT',
        'title': 'Sports Achievement Certificate',
        'category': 'Co-Curricular & Sports',
        'theme_color': '#15803d',
        'accent_color': '#22c55e',
        'icon': 'ti-trophy',
        'badge_text': 'SPORTS AWARD',
        'default_fields': [
            {'key': 'sport_name', 'label': 'Sport / Discipline (e.g. Cricket, Athletics, Football)', 'type': 'text', 'default': 'Athletics', 'required': True},
            {'key': 'event_name', 'label': 'Event / Tournament Name', 'type': 'text', 'default': 'Annual Inter-School Sports Meet', 'required': True},
            {'key': 'position_rank', 'label': 'Position Secured (e.g. 1st Position / Gold Medal)', 'type': 'text', 'default': 'First Position (Gold Medal)', 'required': True},
            {'key': 'held_on_date', 'label': 'Date of Event', 'type': 'date', 'default': '', 'required': False},
            {'key': 'organized_by', 'label': 'Organized By', 'type': 'text', 'default': 'Sports & Physical Education Dept.', 'required': False},
        ]
    },
    {
        'key': 'ACADEMIC_EXCELLENCE',
        'title': 'Academic Excellence Certificate',
        'category': 'Recognition & Awards',
        'theme_color': '#b45309',
        'accent_color': '#f59e0b',
        'icon': 'ti-award',
        'badge_text': 'ACADEMIC MERIT',
        'default_fields': [
            {'key': 'achievement_title', 'label': 'Title of Excellence / Honor', 'type': 'text', 'default': 'Outstanding Academic Performance & Top Rank', 'required': True},
            {'key': 'position_rank', 'label': 'Rank / Grade / Score Secured', 'type': 'text', 'default': 'First Rank (98% Score)', 'required': True},
            {'key': 'academic_session', 'label': 'Academic Session', 'type': 'text', 'default': '', 'required': True},
            {'key': 'subject_name', 'label': 'Subject / All Subjects', 'type': 'text', 'default': 'Overall Academic Performance', 'required': False},
        ]
    },
    {
        'key': 'COMPETITION_CERTIFICATE',
        'title': 'Competition Certificate',
        'category': 'Co-Curricular & Sports',
        'theme_color': '#7c2d12',
        'accent_color': '#ea580c',
        'icon': 'ti-medal',
        'badge_text': 'COMPETITION WINNER',
        'default_fields': [
            {'key': 'competition_name', 'label': 'Competition Title (e.g. Science Exhibition, Painting)', 'type': 'text', 'default': 'Inter-House Science Exhibition', 'required': True},
            {'key': 'position_rank', 'label': 'Position / Award Secured', 'type': 'text', 'default': 'Winner - First Prize', 'required': True},
            {'key': 'organized_by', 'label': 'Organized By', 'type': 'text', 'default': 'Department of Co-Curricular Activities', 'required': False},
            {'key': 'held_on_date', 'label': 'Date of Competition', 'type': 'date', 'default': '', 'required': False},
        ]
    },
    {
        'key': 'CULTURAL_ACTIVITY',
        'title': 'Cultural Activity Certificate',
        'category': 'Co-Curricular & Sports',
        'theme_color': '#c2410c',
        'accent_color': '#f97316',
        'icon': 'ti-masks-theater',
        'badge_text': 'CULTURAL EXCELLENCE',
        'default_fields': [
            {'key': 'activity_name', 'label': 'Activity / Event (Drama, Music, Classical Dance)', 'type': 'text', 'default': 'Annual Cultural Fest - Drama & Music', 'required': True},
            {'key': 'contribution_role', 'label': 'Role / Performance Highlight', 'type': 'text', 'default': 'Lead Performer / Exceptional Contribution', 'required': True},
            {'key': 'organized_by', 'label': 'Organized By', 'type': 'text', 'default': 'Cultural Committee', 'required': False},
            {'key': 'held_on_date', 'label': 'Date', 'type': 'date', 'default': '', 'required': False},
        ]
    },
    {
        'key': 'DEBATE_OLYMPIAD',
        'title': 'Debate / Quiz / Olympiad Certificate',
        'category': 'Recognition & Awards',
        'theme_color': '#0369a1',
        'accent_color': '#0284c7',
        'icon': 'ti-bulb',
        'badge_text': 'OLYMPIAD MERIT',
        'default_fields': [
            {'key': 'event_name', 'label': 'Event Title (e.g. National Math Olympiad, Inter-School Debate)', 'type': 'text', 'default': 'Inter-School Debate Championship', 'required': True},
            {'key': 'position_rank', 'label': 'Position / Percentile / Rank', 'type': 'text', 'default': 'First Place (Best Speaker)', 'required': True},
            {'key': 'organized_by', 'label': 'Organized By', 'type': 'text', 'default': 'Literary & Quiz Society', 'required': False},
            {'key': 'held_on_date', 'label': 'Date of Event', 'type': 'date', 'default': '', 'required': False},
        ]
    },
    {
        'key': 'ATTENDANCE_CERTIFICATE',
        'title': 'Attendance Certificate',
        'category': 'Academic',
        'theme_color': '#047857',
        'accent_color': '#10b981',
        'icon': 'ti-clipboard-check',
        'badge_text': '100% ATTENDANCE',
        'default_fields': [
            {'key': 'attendance_pct', 'label': 'Attendance Percentage Achieved', 'type': 'text', 'default': '100% Regular Attendance', 'required': True},
            {'key': 'academic_session', 'label': 'Session / Term', 'type': 'text', 'default': '', 'required': True},
            {'key': 'working_days', 'label': 'Total Working Days', 'type': 'number', 'default': '220', 'required': False},
            {'key': 'present_days', 'label': 'Days Present', 'type': 'number', 'default': '220', 'required': False},
        ]
    },
    {
        'key': 'BEST_STUDENT',
        'title': 'Best Student / Student of the Year',
        'category': 'Recognition & Awards',
        'theme_color': '#a16207',
        'accent_color': '#eab308',
        'icon': 'ti-star',
        'badge_text': 'STUDENT OF THE YEAR',
        'default_fields': [
            {'key': 'award_title', 'label': 'Award Title', 'type': 'text', 'default': 'Best Student of the Year Award', 'required': True},
            {'key': 'academic_session', 'label': 'Academic Session', 'type': 'text', 'default': '', 'required': True},
            {'key': 'citation', 'label': 'Special Citation / Commendation', 'type': 'text', 'default': 'In recognition of outstanding academic performance, exemplary discipline, and active leadership.', 'required': True},
        ]
    },
    {
        'key': 'LEADERSHIP_CERTIFICATE',
        'title': 'Leadership Certificate',
        'category': 'Conduct & Character',
        'theme_color': '#1e40af',
        'accent_color': '#3b82f6',
        'icon': 'ti-users-group',
        'badge_text': 'LEADERSHIP EXCELLENCE',
        'default_fields': [
            {'key': 'designation_role', 'label': 'Leadership Role (Head Boy/Girl, Prefect, House Captain)', 'type': 'text', 'default': 'School Head Boy / House Captain', 'required': True},
            {'key': 'academic_session', 'label': 'Tenure / Session', 'type': 'text', 'default': '', 'required': True},
            {'key': 'citation', 'label': 'Contribution Summary', 'type': 'text', 'default': 'Demonstrated excellent leadership qualities, integrity, and proactive initiative in all school activities.', 'required': True},
        ]
    },
    {
        'key': 'PARTICIPATION_CERTIFICATE',
        'title': 'Participation Certificate',
        'category': 'Co-Curricular & Sports',
        'theme_color': '#166534',
        'accent_color': '#22c55e',
        'icon': 'ti-rosette',
        'badge_text': 'CERTIFICATE OF PARTICIPATION',
        'default_fields': [
            {'key': 'event_name', 'label': 'Event / Activity Name', 'type': 'text', 'default': 'Annual Science & Art Exhibition', 'required': True},
            {'key': 'organized_by', 'label': 'Organized By', 'type': 'text', 'default': 'School Event Committee', 'required': False},
            {'key': 'held_on_date', 'label': 'Date', 'type': 'date', 'default': '', 'required': False},
            {'key': 'remarks', 'label': 'Appreciation Note', 'type': 'text', 'default': 'We appreciate the active participation, enthusiasm, and dedication demonstrated.', 'required': False},
        ]
    },
    {
        'key': 'APPRECIATION_CERTIFICATE',
        'title': 'Appreciation Certificate',
        'category': 'Recognition & Awards',
        'theme_color': '#831843',
        'accent_color': '#db2777',
        'icon': 'ti-heart-handshake',
        'badge_text': 'SPECIAL APPRECIATION',
        'default_fields': [
            {'key': 'reason', 'label': 'Reason for Appreciation / Special Service', 'type': 'text', 'default': 'Exemplary Dedication, Helpfulness & Positive Attitude', 'required': True},
            {'key': 'citation', 'label': 'Appreciation Message', 'type': 'text', 'default': 'The school leadership values his/her sincere efforts, integrity, and positive contribution to the institution.', 'required': True},
            {'key': 'academic_session', 'label': 'Academic Session', 'type': 'text', 'default': '', 'required': False},
        ]
    },
    {
        'key': 'OTHER',
        'title': 'Custom Certificate / Letter',
        'category': 'Academic',
        'theme_color': '#334155',
        'accent_color': '#64748b',
        'icon': 'ti-file-text',
        'badge_text': 'CUSTOM DOCUMENT',
        'default_fields': [
            {'key': 'custom_title', 'label': 'Certificate / Document Title', 'type': 'text', 'default': 'Official School Certificate', 'required': True},
            {'key': 'custom_body', 'label': 'Certificate Text / Statement', 'type': 'textarea', 'default': 'This is to certify that {student_name} is a student of this school in Class {class_name}.', 'required': True},
            {'key': 'remarks', 'label': 'Remarks / Reference No.', 'type': 'text', 'default': '', 'required': False},
        ]
    }
]

DEFAULT_DOC_REQUIREMENTS = [
    {'doc_type': 'AADHAR_STUDENT',       'label': 'Student Aadhaar Card',       'is_required': True,  'order_index': 1},
    {'doc_type': 'BIRTH_CERTIFICATE',    'label': 'Birth Certificate',          'is_required': True,  'order_index': 2},
    {'doc_type': 'PHOTO',                'label': 'Student Passport Photo',     'is_required': True,  'order_index': 3},
    {'doc_type': 'TRANSFER_CERTIFICATE', 'label': 'Transfer Certificate (TC)',  'is_required': False, 'order_index': 4},
    {'doc_type': 'REPORT_CARD',          'label': 'Previous Class Report Card', 'is_required': False, 'order_index': 5},
    {'doc_type': 'AADHAR_PARENT',        'label': 'Parent Aadhaar Card',        'is_required': False, 'order_index': 6},
    {'doc_type': 'CASTE_CERTIFICATE',    'label': 'Caste / Category Cert',      'is_required': False, 'order_index': 7},
    {'doc_type': 'ADDRESS_PROOF',        'label': 'Address Proof',              'is_required': False, 'order_index': 8},
    {'doc_type': 'MEDICAL_CERTIFICATE',  'label': 'Medical Certificate',        'is_required': False, 'order_index': 9},
    {'doc_type': 'RATION_CARD',          'label': 'Ration Card',                'is_required': False, 'order_index': 10},
    {'doc_type': 'OTHER',                'label': 'Other Document',             'is_required': False, 'order_index': 99},
]



class SchoolDocumentRequirement(db.Model):

    """
    Configurable document requirements per school.
    Allows Principal to set which document types are mandatory for students.
    """
    __tablename__ = 'school_document_requirements'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    doc_type    = db.Column(db.String(50), nullable=False)
    label       = db.Column(db.String(120), nullable=False)
    is_required = db.Column(db.Boolean, default=True)
    is_active   = db.Column(db.Boolean, default=True)
    order_index = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            'id':          self.id,
            'school_id':   self.school_id,
            'doc_type':    self.doc_type,
            'label':       self.label or STUDENT_DOC_TYPE_LABELS.get(self.doc_type, self.doc_type),
            'is_required': self.is_required,
            'is_active':   self.is_active,
            'order_index': self.order_index,
        }


def get_school_doc_requirements(school_id):
    """Fetch active document requirements for a school, initializing defaults if none configured."""
    reqs = SchoolDocumentRequirement.query.filter_by(
        school_id=school_id, is_active=True
    ).order_by(SchoolDocumentRequirement.order_index.asc()).all()

    if not reqs:
        # Seed defaults for this school
        created = []
        for item in DEFAULT_DOC_REQUIREMENTS:
            obj = SchoolDocumentRequirement(
                school_id=school_id,
                doc_type=item['doc_type'],
                label=item['label'],
                is_required=item['is_required'],
                order_index=item['order_index'],
                is_active=True
            )
            db.session.add(obj)
            created.append(obj)
        try:
            db.session.commit()
            return created
        except Exception:
            db.session.rollback()
            return [SchoolDocumentRequirement(**item, school_id=school_id) for item in DEFAULT_DOC_REQUIREMENTS]

    return reqs



class StudentDocument(db.Model):
    """
    KYC documents belonging to the student.
    Permanently tied to student — promotions do NOT remove these.
    class_id_at_upload + academic_year give historical context.
    """
    __tablename__ = 'student_documents'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False, index=True)
    student_id         = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    doc_type           = db.Column(db.String(30),  nullable=False)
    custom_label       = db.Column(db.String(150), default='')
    title              = db.Column(db.String(200), default='')

    file_url           = db.Column(db.String(500), nullable=False)
    file_name          = db.Column(db.String(200), default='')
    file_size          = db.Column(db.Integer,     nullable=True)

    class_id_at_upload = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    academic_year      = db.Column(db.String(10), default='')

    uploaded_by        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploaded_by_role   = db.Column(db.String(30), default='')
    uploaded_at        = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    remarks            = db.Column(db.String(300), default='')

    class_ref  = db.relationship('Class', foreign_keys=[class_id_at_upload], lazy='joined')
    uploader   = db.relationship('User',  foreign_keys=[uploaded_by],        lazy='joined')

    def label(self):
        if self.doc_type == 'OTHER' and self.custom_label:
            return self.custom_label
        return STUDENT_DOC_TYPE_LABELS.get(self.doc_type, self.doc_type.replace('_', ' ').title())

    def to_dict(self):
        class_name = ''
        if self.class_ref:
            class_name = f"{self.class_ref.name} - {self.class_ref.section}".strip(' -')
        return {
            'id':                   self.id,
            'student_id':           self.student_id,
            'doc_type':             self.doc_type,
            'custom_label':         self.custom_label or '',
            'title':                self.title or '',
            'label':                self.label(),
            'file_url':             self.file_url,
            'file_name':            self.file_name or '',
            'file_size':            self.file_size,
            'class_id_at_upload':   self.class_id_at_upload,
            'class_name_at_upload': class_name,
            'academic_year':        self.academic_year or '',
            'uploaded_by':          self.uploaded_by,
            'uploaded_by_name':     (self.uploader.name if self.uploader else ''),
            'uploaded_by_role':     self.uploaded_by_role or '',
            'uploaded_at':          self.uploaded_at.isoformat() if self.uploaded_at else None,
            'remarks':              self.remarks or '',
        }


class IssuedDocument(db.Model):
    """
    Official documents the SCHOOL issues TO a student (TC, Character, Sports, Excellence, etc.).
    Only PRINCIPAL (or TEACHER) can create.
    Student can VIEW their own issued docs.
    Only PRINCIPAL can delete.
    """
    __tablename__ = 'issued_documents'

    id                    = db.Column(db.Integer, primary_key=True)
    school_id             = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False, index=True)
    student_id            = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    doc_type              = db.Column(db.String(50),  nullable=False)
    custom_label          = db.Column(db.String(150), default='')
    title                 = db.Column(db.String(200), default='')
    certificate_no        = db.Column(db.String(100), default='', nullable=True)

    file_url              = db.Column(db.String(500), nullable=True, default='')
    file_name             = db.Column(db.String(200), default='')
    file_size             = db.Column(db.Integer,     nullable=True)

    class_id_at_issue     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    academic_year         = db.Column(db.String(10), default='')

    issued_by             = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    issued_at             = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    remarks               = db.Column(db.String(300), default='')
    is_visible_to_student = db.Column(db.Boolean, default=True)
    payload_data          = db.Column(db.Text, default='{}', nullable=True)  # JSON payload of custom certificate parameters

    class_ref  = db.relationship('Class', foreign_keys=[class_id_at_issue], lazy='joined')
    issuer     = db.relationship('User',  foreign_keys=[issued_by],         lazy='joined')

    def label(self):
        if self.custom_label:
            return self.custom_label
        return ISSUED_DOC_TYPE_LABELS.get(self.doc_type, self.doc_type.replace('_', ' ').title())

    def get_payload(self):
        import json
        try:
            return json.loads(self.payload_data or '{}')
        except Exception:
            return {}

    def to_dict(self):
        class_name = ''
        if self.class_ref:
            class_name = f"{self.class_ref.name} - {self.class_ref.section}".strip(' -')
        return {
            'id':                    self.id,
            'student_id':            self.student_id,
            'doc_type':              self.doc_type,
            'custom_label':          self.custom_label or '',
            'title':                 self.title or '',
            'certificate_no':        self.certificate_no or '',
            'label':                 self.label(),
            'file_url':              self.file_url or '',
            'file_name':             self.file_name or '',
            'file_size':             self.file_size,
            'class_id_at_issue':     self.class_id_at_issue,
            'class_name_at_issue':   class_name,
            'academic_year':         self.academic_year or '',
            'issued_by':             self.issued_by,
            'issued_by_name':        (self.issuer.name if self.issuer else ''),
            'issued_at':             self.issued_at.isoformat() if self.issued_at else None,
            'remarks':               self.remarks or '',
            'is_visible_to_student': self.is_visible_to_student,
            'payload':               self.get_payload(),
        }

