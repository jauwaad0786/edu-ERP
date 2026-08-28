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
    'BONAFIDE':              'Bonafide Certificate',
    'TC':                    'Transfer Certificate (TC)',
    'CHARACTER_CERTIFICATE': 'Character Certificate',
    'FEE_RECEIPT':           'Fee Receipt',
    'ID_CARD':               'School ID Card',
    'MIGRATION':             'Migration Certificate',
    'OTHER':                 'Other Document',
}

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
    Official documents the SCHOOL issues TO a student.
    Only PRINCIPAL (or TEACHER) can create.
    Student can VIEW their own issued docs.
    Only PRINCIPAL can delete.
    """
    __tablename__ = 'issued_documents'

    id                    = db.Column(db.Integer, primary_key=True)
    school_id             = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False, index=True)
    student_id            = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    doc_type              = db.Column(db.String(30),  nullable=False)
    custom_label          = db.Column(db.String(150), default='')
    title                 = db.Column(db.String(200), default='')

    file_url              = db.Column(db.String(500), nullable=False)
    file_name             = db.Column(db.String(200), default='')
    file_size             = db.Column(db.Integer,     nullable=True)

    class_id_at_issue     = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    academic_year         = db.Column(db.String(10), default='')

    issued_by             = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    issued_at             = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    remarks               = db.Column(db.String(300), default='')
    is_visible_to_student = db.Column(db.Boolean, default=True)

    class_ref  = db.relationship('Class', foreign_keys=[class_id_at_issue], lazy='joined')
    issuer     = db.relationship('User',  foreign_keys=[issued_by],         lazy='joined')

    def label(self):
        if self.doc_type == 'OTHER' and self.custom_label:
            return self.custom_label
        return ISSUED_DOC_TYPE_LABELS.get(self.doc_type, self.doc_type.replace('_', ' ').title())

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
            'label':                 self.label(),
            'file_url':              self.file_url,
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
        }
