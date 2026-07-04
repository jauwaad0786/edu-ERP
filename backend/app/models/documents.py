from app import db
from datetime import datetime


# doc_type values (Issued):  'BONAFIDE' | 'TC' | 'CHARACTER_CERTIFICATE' | 'FEE_RECEIPT' | 'OTHER'
# doc_type values (Student): 'AADHAR' | 'RATION_CARD' | 'BIRTH_CERTIFICATE' | 'CASTE_CERTIFICATE' | 'OTHER'


class IssuedDocument(db.Model):
    """
    Official documents the SCHOOL issues TO a student
    (Bonafide Certificate, TC, Character Certificate, Fee Receipt, etc.)
    Multi-tenant scoped via school_id — every query must filter by it.
    """
    __tablename__ = 'issued_documents'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)

    doc_type     = db.Column(db.String(30),  nullable=False)   # see values above
    custom_label = db.Column(db.String(150), default='')       # used when doc_type == 'OTHER'

    file_url     = db.Column(db.String(500), nullable=False)
    file_name    = db.Column(db.String(200), default='')

    issued_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    issued_at    = db.Column(db.DateTime, default=datetime.utcnow)
    remarks      = db.Column(db.String(300), default='')

    def to_dict(self):
        return {
            'id':           self.id,
            'student_id':   self.student_id,
            'doc_type':     self.doc_type,
            'custom_label': self.custom_label or '',
            'label':        self.custom_label if self.doc_type == 'OTHER' else self.doc_type.replace('_', ' ').title(),
            'file_url':     self.file_url,
            'file_name':    self.file_name or '',
            'issued_by':    self.issued_by,
            'issued_at':    self.issued_at.isoformat() if self.issued_at else None,
            'remarks':      self.remarks or '',
        }


class StudentDocument(db.Model):
    """
    KYC-type documents belonging TO the student themselves
    (Aadhar Card, Ration Card, Birth Certificate, Caste Certificate, Other).
    Multi-tenant scoped via school_id — every query must filter by it.
    """
    __tablename__ = 'student_documents'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'),  nullable=False)
    student_id   = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)

    doc_type     = db.Column(db.String(30),  nullable=False)   # see values above
    custom_label = db.Column(db.String(150), default='')       # used when doc_type == 'OTHER'

    file_url     = db.Column(db.String(500), nullable=False)
    file_name    = db.Column(db.String(200), default='')

    uploaded_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploaded_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':           self.id,
            'student_id':   self.student_id,
            'doc_type':     self.doc_type,
            'custom_label': self.custom_label or '',
            'label':        self.custom_label if self.doc_type == 'OTHER' else self.doc_type.replace('_', ' ').title(),
            'file_url':     self.file_url,
            'file_name':    self.file_name or '',
            'uploaded_by':  self.uploaded_by,
            'uploaded_at':  self.uploaded_at.isoformat() if self.uploaded_at else None,
        }
