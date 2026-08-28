from app import db
from datetime import datetime, date


class BookCategory(db.Model):
    __tablename__ = 'book_categories'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    name        = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300))
    is_active   = db.Column(db.Boolean, default=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

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
    Physical copies are tracked separately in BookCopy.
    """
    __tablename__ = 'books'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    title         = db.Column(db.String(300), nullable=False)
    subtitle      = db.Column(db.String(300))
    isbn          = db.Column(db.String(30), index=True)
    accession_no  = db.Column(db.String(50))  # Master prefix

    category_id   = db.Column(db.Integer, db.ForeignKey('book_categories.id'), nullable=True)
    subject       = db.Column(db.String(100))
    author        = db.Column(db.String(200))
    publisher     = db.Column(db.String(200))
    edition       = db.Column(db.String(50))
    language      = db.Column(db.String(50), default='English')

    class_id      = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)

    rack          = db.Column(db.String(30))
    shelf         = db.Column(db.String(30))

    purchase_date = db.Column(db.Date)
    vendor_name   = db.Column(db.String(150))
    purchase_price= db.Column(db.Float, default=0.0)
    mrp           = db.Column(db.Float, default=0.0)

    cover_url     = db.Column(db.String(500))
    description   = db.Column(db.Text)
    keywords      = db.Column(db.String(300))

    is_active     = db.Column(db.Boolean, default=True)
    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    copies = db.relationship('BookCopy', backref='book', lazy='dynamic', cascade='all, delete-orphan')

    def counts(self):
        """Live counts derived from physical copies in BookCopy."""
        all_copies = self.copies.all()
        total     = len(all_copies)
        available = sum(1 for c in all_copies if c.status == 'AVAILABLE')
        issued    = sum(1 for c in all_copies if c.status == 'ISSUED')
        lost      = sum(1 for c in all_copies if c.status == 'LOST')
        damaged   = sum(1 for c in all_copies if c.status == 'DAMAGED')
        reserved  = sum(1 for c in all_copies if c.status == 'RESERVED')
        return {
            'total_copies':     total,
            'available_copies': available,
            'issued_copies':    issued,
            'lost_copies':      lost,
            'damaged_copies':   damaged,
            'reserved_copies':  reserved,
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
            'purchase_price':self.purchase_price or 0.0,
            'mrp':           self.mrp or 0.0,
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
    Physical Copy Inventory — tracks each physical unit with barcode and accession number.
    Statuses: AVAILABLE / ISSUED / RESERVED / LOST / DAMAGED / MAINTENANCE / REMOVED
    """
    __tablename__ = 'book_copies'

    id                = db.Column(db.Integer, primary_key=True)
    book_id           = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False, index=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    copy_accession_no = db.Column(db.String(50), unique=True)
    barcode           = db.Column(db.String(50), unique=True, index=True)

    status            = db.Column(db.String(20), default='AVAILABLE')
    condition_note    = db.Column(db.String(300))
    shelf_location    = db.Column(db.String(50))
    added_at          = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                self.id,
            'book_id':           self.book_id,
            'book_title':        self.book.title if self.book else '',
            'copy_accession_no': self.copy_accession_no or '',
            'barcode':           self.barcode or '',
            'status':            self.status,
            'condition_note':    self.condition_note or '',
            'shelf_location':    self.shelf_location or (f"{self.book.rack}/{self.book.shelf}" if self.book and (self.book.rack or self.book.shelf) else ''),
            'added_at':          self.added_at.isoformat() if self.added_at else None,
        }


class LibraryMember(db.Model):
    """
    Library Member Profile. Reuses existing User records.
    """
    __tablename__ = 'library_members'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    card_number        = db.Column(db.String(50), unique=True)
    member_type        = db.Column(db.String(20))  # STUDENT / TEACHER / STAFF
    max_books_override = db.Column(db.Integer, nullable=True)

    status             = db.Column(db.String(20), default='ACTIVE')  # ACTIVE / BLOCKED / SUSPENDED
    joined_at          = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'user_id', name='uq_library_member_user'),
    )

    user   = db.relationship('User', foreign_keys=[user_id])
    issues = db.relationship('BookIssue', backref='member', lazy='dynamic')
    fines  = db.relationship('FineTransaction', backref='member_ref', lazy='dynamic')

    def to_dict(self):
        u = self.user
        current_issues = self.issues.filter_by(status='ISSUED').count()
        # Outstanding fines calculation
        pending_fines = self.fines.filter(FineTransaction.status.in_(['OUTSTANDING', 'PARTIALLY_PAID', 'PENDING', 'PARTIAL'])).all()
        pending_fine_amt = sum(f.outstanding_amount for f in pending_fines)

        return {
            'id':                 self.id,
            'user_id':            self.user_id,
            'name':               u.name if u else '',
            'email':              u.email if u else '',
            'phone':              u.phone if u else '',
            'card_number':        self.card_number or '',
            'member_type':        self.member_type,
            'status':             self.status,
            'current_issues':     current_issues,
            'pending_fine':       round(pending_fine_amt, 2),
            'max_books_override': self.max_books_override,
            'joined_at':          self.joined_at.isoformat() if self.joined_at else None,
        }


class BookIssue(db.Model):
    """
    Loan & Return record for a specific copy and member.
    """
    __tablename__ = 'book_issues'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    copy_id      = db.Column(db.Integer, db.ForeignKey('book_copies.id'), nullable=False, index=True)
    book_id      = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False, index=True)
    member_id    = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False, index=True)

    issue_date   = db.Column(db.Date, nullable=False, default=date.today)
    due_date     = db.Column(db.Date, nullable=False)
    return_date  = db.Column(db.Date, nullable=True)

    status       = db.Column(db.String(20), default='ISSUED')  # ISSUED / RETURNED / LOST / DAMAGED
    renewal_count= db.Column(db.Integer, default=0)

    issued_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    returned_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    remarks      = db.Column(db.String(300))

    copy = db.relationship('BookCopy')
    book = db.relationship('Book')

    def to_dict(self):
        today = date.today()
        overdue_days = (today - self.due_date).days if self.status == 'ISSUED' and today > self.due_date else 0
        book_mrp = float((self.book.mrp if self.book and self.book.mrp else (self.book.purchase_price if self.book and self.book.purchase_price else 0.0)) or 0.0)
        return {
            'id':                  self.id,
            'copy_id':             self.copy_id,
            'book_id':             self.book_id,
            'book_title':          self.book.title if self.book else '',
            'book_mrp':            book_mrp,
            'book_price':          book_mrp,
            'book_purchase_price': float(self.book.purchase_price or 0.0) if self.book else 0.0,
            'barcode':             self.copy.barcode if self.copy else '',
            'accession_no':        self.copy.copy_accession_no if self.copy else '',
            'author':              self.book.author if self.book else '',
            'member_id':           self.member_id,
            'member_name':         self.member.user.name if self.member and self.member.user else '',
            'issue_date':          str(self.issue_date),
            'due_date':            str(self.due_date),
            'return_date':         str(self.return_date) if self.return_date else None,
            'status':              self.status,
            'overdue_days':        overdue_days,
            'renewal_count':       self.renewal_count,
            'remarks':             self.remarks or '',
        }


class BookReservation(db.Model):
    __tablename__ = 'book_reservations'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    book_id        = db.Column(db.Integer, db.ForeignKey('books.id'), nullable=False, index=True)
    member_id      = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False, index=True)

    reserved_at    = db.Column(db.DateTime, default=datetime.utcnow)
    status         = db.Column(db.String(20), default='WAITING')  # WAITING / NOTIFIED / FULFILLED / CANCELLED / EXPIRED
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
            'reserved_at':    self.reserved_at.isoformat() if self.reserved_at else None,
            'status':         self.status,
            'queue_position': self.queue_position,
        }


class FineTransaction(db.Model):
    """
    Library Fine / Penalty Ledger.
    Single financial source of truth:
    - On creation: status = OUTSTANDING, paid_amount = 0, waived_amount = 0.
    - Linked to FeeRecord in Fee Management.
    - Status lifecycle: OUTSTANDING, PARTIALLY_PAID, PAID, WAIVED, CANCELLED.
    """
    __tablename__ = 'library_fine_transactions'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    issue_id           = db.Column(db.Integer, db.ForeignKey('book_issues.id'), nullable=True, index=True)
    member_id          = db.Column(db.Integer, db.ForeignKey('library_members.id'), nullable=False, index=True)

    reason             = db.Column(db.String(50))  # OVERDUE / LOST / DAMAGED / MANUAL / MISSING_PAGES / LOST_CARD
    amount             = db.Column(db.Float, default=0.0)
    amount_paid        = db.Column(db.Float, default=0.0)
    waived_amount      = db.Column(db.Float, default=0.0)
    status             = db.Column(db.String(30), default='OUTSTANDING')  # OUTSTANDING / PARTIALLY_PAID / PAID / WAIVED / CANCELLED

    waived_by          = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    waived_at          = db.Column(db.DateTime, nullable=True)
    waive_reason       = db.Column(db.String(300))

    collected_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    collected_at       = db.Column(db.DateTime, nullable=True)
    payment_mode       = db.Column(db.String(30))  # CASH / ONLINE / UPI / CHEQUE
    receipt_no         = db.Column(db.String(50))
    fee_transaction_id = db.Column(db.Integer, nullable=True)

    created_at         = db.Column(db.DateTime, default=datetime.utcnow)

    member             = db.relationship('LibraryMember', foreign_keys=[member_id], overlaps="fines,member_ref")
    issue              = db.relationship('BookIssue', foreign_keys=[issue_id])

    @property
    def outstanding_amount(self):
        """Calculates current unpaid and non-waived balance."""
        tot = float(self.amount or 0.0)
        pd  = float(self.amount_paid or 0.0)
        wv  = float(self.waived_amount or 0.0)
        return max(0.0, round(tot - pd - wv, 2))

    @property
    def canonical_status(self):
        """Maps legacy status codes (PENDING/PARTIAL) to canonical enterprise statuses."""
        if self.status in ('PENDING',):
            return 'OUTSTANDING'
        if self.status in ('PARTIAL',):
            return 'PARTIALLY_PAID'
        return self.status

    def to_dict(self):
        return {
            'id':                 self.id,
            'issue_id':           self.issue_id,
            'member_id':          self.member_id,
            'member_name':        self.member.user.name if self.member and self.member.user else '',
            'card_number':        self.member.card_number if self.member else '',
            'reason':             self.reason,
            'fine_amount':        self.amount,
            'amount':             self.amount,
            'paid_amount':        self.amount_paid or 0.0,
            'amount_paid':        self.amount_paid or 0.0,
            'waived_amount':      self.waived_amount or 0.0,
            'outstanding_amount': self.outstanding_amount,
            'status':             self.canonical_status,
            'waived_by':          self.waived_by,
            'waived_at':          self.waived_at.isoformat() if self.waived_at else None,
            'waive_reason':       self.waive_reason or '',
            'collected_by':       self.collected_by,
            'collected_at':       self.collected_at.isoformat() if self.collected_at else None,
            'payment_mode':       self.payment_mode or '',
            'receipt_no':         self.receipt_no or '',
            'fee_transaction_id': self.fee_transaction_id,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


class LibrarySettings(db.Model):
    __tablename__ = 'library_settings'

    id                           = db.Column(db.Integer, primary_key=True)
    school_id                    = db.Column(db.Integer, db.ForeignKey('schools.id'), unique=True, nullable=False, index=True)

    max_books_student            = db.Column(db.Integer, default=2)
    max_books_teacher            = db.Column(db.Integer, default=5)
    issue_duration_days          = db.Column(db.Integer, default=14)
    fine_per_day                 = db.Column(db.Float, default=2.0)
    max_fine_cap                 = db.Column(db.Float, default=200.0)
    lost_book_fine_multiplier    = db.Column(db.Float, default=1.0)  # x MRP
    damaged_book_fine_multiplier = db.Column(db.Float, default=0.5)  # x MRP
    lost_card_fine               = db.Column(db.Float, default=50.0)
    missing_pages_fine           = db.Column(db.Float, default=20.0)
    max_renewals                 = db.Column(db.Integer, default=1)
    reservation_limit_per_member = db.Column(db.Integer, default=2)

    def to_dict(self):
        return {
            'max_books_student':            self.max_books_student,
            'max_books_teacher':            self.max_books_teacher,
            'issue_duration_days':          self.issue_duration_days,
            'fine_per_day':                 self.fine_per_day,
            'max_fine_cap':                 self.max_fine_cap,
            'lost_book_fine_multiplier':    self.lost_book_fine_multiplier,
            'damaged_book_fine_multiplier': self.damaged_book_fine_multiplier or 0.5,
            'lost_card_fine':               self.lost_card_fine or 50.0,
            'missing_pages_fine':           self.missing_pages_fine or 20.0,
            'max_renewals':                 self.max_renewals,
            'reservation_limit_per_member': self.reservation_limit_per_member,
        }


class LibraryActivityLog(db.Model):
    __tablename__ = 'library_activity_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    action     = db.Column(db.String(50))
    details    = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':         self.id,
            'user_id':    self.user_id,
            'action':     self.action,
            'details':    self.details or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


def log_activity(school_id, user_id, action, details=''):
    entry = LibraryActivityLog(school_id=school_id, user_id=user_id, action=action, details=details)
    db.session.add(entry)
