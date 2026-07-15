from app import db
from datetime import datetime, date


class BookCategory(db.Model):
    __tablename__ = 'book_categories'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    name       = db.Column(db.String(100), nullable=False)
    description= db.Column(db.String(300))
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    books = db.relationship('Book', backref='category_ref', lazy='dynamic')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'name', name='uq_category_school_name'),
    )

    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'description': self.description or '',
            'is_active':   self.is_active,
            'book_count':  self.books.count(),
        }


class Book(db.Model):
    """
    Book Master — one row per title.
    Actual physical copies are tracked separately in BookCopy
    (so 'available_copies' is always derived, never trusted as a raw counter
    that can drift out of sync).
    """
    __tablename__ = 'books'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)

    title         = db.Column(db.String(300), nullable=False)
    subtitle      = db.Column(db.String(300))
    isbn          = db.Column(db.String(20), index=True)
    accession_no  = db.Column(db.String(30))  # prefix; per-copy accession stored on BookCopy

    category_id   = db.Column(db.Integer, db.ForeignKey('book_categories.id'), nullable=True)
    subject       = db.Column(db.String(100))
    author        = db.Column(db.String(200))
    publisher     = db.Column(db.String(200))
    edition       = db.Column(db.String(50))
    language      = db.Column(db.String(50), default='English')

    class_id      = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)  # optional class-level relevance

    rack          = db.Column(db.String(30))
    shelf         = db.Column(db.String(30))

    purchase_date = db.Column(db.Date)
    vendor_name   = db.Column(db.String(150))
    purchase_price= db.Column(db.Float, default=0)
    mrp           = db.Column(db.Float, default=0)

    cover_url     = db.Column(db.String(500))
    description   = db.Column(db.Text)
    keywords      = db.Column(db.String(300))  # comma-separated, used for search

    is_active     = db.Column(db.Boolean, default=True)
    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    copies = db.relationship('BookCopy', backref='book', lazy='dynamic', cascade='all, delete-orphan')

    def counts(self):
        """Live counts derived from BookCopy — never stale."""
        all_copies = self.copies.all()
        total    = len(all_copies)
        available = sum(1 for c in all_copies if c.status == 'AVAILABLE')
        issued    = sum(1 for c in all_copies if c.status == 'ISSUED')
        lost      = sum(1 for c in all_copies if c.status == 'LOST')
        damaged   = sum(1 for c in all_copies if c.status == 'DAMAGED')
        return {
            'total_copies':     total,
            'available_copies': available,
            'issued_copies':    issued,
            'lost_copies':      lost,
            'damaged_copies':   damaged,
        }

    def to_dict(self, include_counts=True):
        d = {
            'id':            self.id,
            'title':         self.title,
            'subtitle':      self.subtitle or '',
            'isbn':          self.isbn or '',
            'accession_no':  self.accession_no or '',
            'category_id':   self.category_id,
            'category_name': self.category_ref.name if self.category_id and self.category_ref else '',
            'subject':       self.subject or '',
            'author':        self.author or '',
            'publisher':     self.publisher or '',
            'edition':       self.edition or '',
            'language':      self.language or '',
            'class_id':      self.class_id,
            'rack':          self.rack or '',
            'shelf':         self.shelf or '',
            'purchase_date': str(self.purchase_date) if self.purchase_date else None,
            'vendor_name':   self.vendor_name or '',
            'purchase_price':self.purchase_price or 0,
            'mrp':           self.mrp or 0,
            'cover_url':     self.cover_url,
            'description':   self.description or '',
            'keywords':      self.keywords or '',
            'is_active':     self.is_active,
        }
        if include_counts:
            d.update(self.counts())
        return d


class BookCopy(db.Model):
    """
    One row per physical copy — this is what actually gets issued/returned.
    Barcode lives here (each physical copy has its own barcode), not on Book.
    """
    __tablename__ = 'book_copies'

    id           = db.Column(db.Integer, primary_key=True)
    book_id      = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)

    copy_accession_no = db.Column(db.String(30), unique=True)   # e.g. ACC-2026-000123
    barcode           = db.Column(db.String(50), unique=True, index=True)

    status       = db.Column(db.String(20), default='AVAILABLE')
    # AVAILABLE / ISSUED / LOST / DAMAGED / WITHDRAWN

    condition_note = db.Column(db.String(300))
    added_at       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                self.id,
            'book_id':           self.book_id,
            'book_title':        self.book.title if self.book else '',
            'copy_accession_no': self.copy_accession_no or '',
            'barcode':           self.barcode or '',
            'status':            self.status,
            'condition_note':    self.condition_note or '',
        }


class LibraryMember(db.Model):
    """
    Library-specific membership wrapper. Reuses existing User/Student/Teacher
    records (no duplicate name/phone/email) — this table only stores
    library-specific state: card number, status, per-member limit override.
    """
    __tablename__ = 'library_members'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    card_number   = db.Column(db.String(30), unique=True)
    member_type   = db.Column(db.String(20))  # STUDENT / TEACHER / STAFF
    max_books_override = db.Column(db.Integer, nullable=True)  # null → use LibrarySettings default

    status        = db.Column(db.String(20), default='ACTIVE')  # ACTIVE / BLOCKED / SUSPENDED
    joined_at     = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'user_id', name='uq_library_member_user'),
    )

    user   = db.relationship('User', foreign_keys=[user_id])
    issues = db.relationship('BookIssue', backref='member', lazy='dynamic')

    def to_dict(self):
        u = self.user
        current_issues = self.issues.filter_by(status='ISSUED').count()
        pending_fine = db.session.query(db.func.coalesce(db.func.sum(FineTransaction.amount), 0))\
            .filter_by(member_id=self.id, status='PENDING').scalar() or 0
        return {
            'id':              self.id,
            'user_id':         self.user_id,
            'name':            u.name if u else '',
            'email':           u.email if u else '',
            'phone':           u.phone if u else '',
            'card_number':     self.card_number or '',
            'member_type':     self.member_type,
            'status':          self.status,
            'current_issues':  current_issues,
            'pending_fine':    pending_fine,
            'max_books_override': self.max_books_override,
        }


class BookIssue(db.Model):
    """
    One row per issue transaction (also covers the eventual return —
    a return is an UPDATE on this row, not a separate table, since
    issue/return is always a 1:1 pair for a given loan).
    """
    __tablename__ = 'book_issues'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    copy_id      = db.Column(db.Integer, db.ForeignKey('book_copies.id'), nullable=False)
    book_id      = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    member_id    = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False)

    issue_date   = db.Column(db.Date, nullable=False, default=date.today)
    due_date     = db.Column(db.Date, nullable=False)
    return_date  = db.Column(db.Date, nullable=True)

    status       = db.Column(db.String(20), default='ISSUED')  # ISSUED / RETURNED / LOST
    renewal_count= db.Column(db.Integer, default=0)

    issued_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    returned_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    remarks      = db.Column(db.String(300))

    copy = db.relationship('BookCopy')
    book = db.relationship('Book')

    def to_dict(self):
        today = date.today()
        overdue_days = (today - self.due_date).days if self.status == 'ISSUED' and today > self.due_date else 0
        return {
            'id':            self.id,
            'copy_id':       self.copy_id,
            'book_id':       self.book_id,
            'book_title':    self.book.title if self.book else '',
            'barcode':       self.copy.barcode if self.copy else '',
            'member_id':     self.member_id,
            'member_name':   self.member.user.name if self.member and self.member.user else '',
            'issue_date':    str(self.issue_date),
            'due_date':      str(self.due_date),
            'return_date':   str(self.return_date) if self.return_date else None,
            'status':        self.status,
            'overdue_days':  overdue_days,
            'renewal_count': self.renewal_count,
            'remarks':       self.remarks or '',
        }


class BookReservation(db.Model):
    __tablename__ = 'book_reservations'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    book_id     = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False)
    member_id   = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False)

    reserved_at = db.Column(db.DateTime, default=datetime.utcnow)
    status      = db.Column(db.String(20), default='WAITING')  # WAITING / NOTIFIED / FULFILLED / CANCELLED
    queue_position = db.Column(db.Integer, default=1)

    book   = db.relationship('Book')
    member = db.relationship('LibraryMember')

    def to_dict(self):
        return {
            'id':             self.id,
            'book_id':        self.book_id,
            'book_title':     self.book.title if self.book else '',
            'member_id':      self.member_id,
            'member_name':    self.member.user.name if self.member and self.member.user else '',
            'reserved_at':    self.reserved_at.isoformat(),
            'status':         self.status,
            'queue_position': self.queue_position,
        }



class FineTransaction(db.Model):
    __tablename__ = 'library_fine_transactions'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    issue_id    = db.Column(db.Integer, db.ForeignKey('book_issues.id'), nullable=True)
    member_id   = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False)

    reason      = db.Column(db.String(30))  # OVERDUE / LOST / DAMAGED
    amount      = db.Column(db.Float, default=0)
    amount_paid = db.Column(db.Float, default=0)
    status      = db.Column(db.String(20), default='PENDING')  # PENDING / PAID / WAIVED / PARTIAL

    waived_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    waive_reason= db.Column(db.String(300))

    collected_by= db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    collected_at= db.Column(db.DateTime, nullable=True)

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    member = db.relationship('LibraryMember')   # NEW — to_dict() mein self.member.user.name chahiye, relationship missing thi

    def to_dict(self):
        return {
            'id':           self.id,
            'issue_id':     self.issue_id,
            'member_id':    self.member_id,
            'member_name':  self.member.user.name if self.member and self.member.user else '',
            'reason':       self.reason,
            'amount':       self.amount,
            'amount_paid':  self.amount_paid,
            'status':       self.status,
            'waive_reason': self.waive_reason or '',
            'collected_at': self.collected_at.isoformat() if self.collected_at else None,
            'created_at':   self.created_at.isoformat(),
        }


class LibrarySettings(db.Model):
    __tablename__ = 'library_settings'

    id                  = db.Column(db.Integer, primary_key=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), unique=True, nullable=False)

    max_books_student   = db.Column(db.Integer, default=2)
    max_books_teacher   = db.Column(db.Integer, default=5)
    issue_duration_days = db.Column(db.Integer, default=14)
    fine_per_day        = db.Column(db.Float, default=2.0)
    max_fine_cap        = db.Column(db.Float, default=200.0)
    lost_book_fine_multiplier = db.Column(db.Float, default=1.0)  # x MRP
    max_renewals        = db.Column(db.Integer, default=1)
    reservation_limit_per_member = db.Column(db.Integer, default=2)

    def to_dict(self):
        return {
            'max_books_student':   self.max_books_student,
            'max_books_teacher':   self.max_books_teacher,
            'issue_duration_days': self.issue_duration_days,
            'fine_per_day':        self.fine_per_day,
            'max_fine_cap':        self.max_fine_cap,
            'lost_book_fine_multiplier': self.lost_book_fine_multiplier,
            'max_renewals':        self.max_renewals,
            'reservation_limit_per_member': self.reservation_limit_per_member,
        }


class LibraryActivityLog(db.Model):
    __tablename__ = 'library_activity_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'))
    action     = db.Column(db.String(50))   # BOOK_ADDED / ISSUED / RETURNED / FINE_COLLECTED / ...
    details    = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'action':     self.action,
            'details':    self.details or '',
            'created_at': self.created_at.isoformat(),
        }


def log_activity(school_id, user_id, action, details=''):
    entry = LibraryActivityLog(school_id=school_id, user_id=user_id, action=action, details=details)
    db.session.add(entry)
