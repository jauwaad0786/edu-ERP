from app import db
from datetime import datetime


STUDENT_DOC_TYPE_LABELS = {
    'AADHAR':               'Aadhaar Card',
    'AADHAR_STUDENT':       'Student Aadhaar Card',
    'AADHAR_PARENT':        'Parent / Guardian Aadhaar Card',
    'RATION_CARD':          'Ration Card',
    'BIRTH_CERTIFICATE':    'Birth Certificate',
    'CASTE_CERTIFICATE':    'Caste / Category Certificate',
    'TRANSFER_CERTIFICATE': 'Transfer Certificate (TC)',
    'REPORT_CARD':          'Previous Class Report Card',
    'ADDRESS_PROOF':        'Address Proof',
    'MEDICAL_CERTIFICATE':  'Medical Fitness Certificate',
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
