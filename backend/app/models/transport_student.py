from app import db
from datetime import datetime


# ─── Constants ──────────────────────────────────────────────────────────────

TRANSPORT_ASSIGNMENT_STATUSES = ['ACTIVE', 'REMOVED']

TRANSFER_TYPES = ['ADDED', 'VEHICLE_CHANGE', 'ROUTE_CHANGE', 'STOP_CHANGE', 'REMOVED']

FEE_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']

FEE_RECORD_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED']

PAYMENT_MODES = ['CASH', 'CARD', 'UPI', 'NETBANKING', 'CHEQUE', 'OTHER']


class StudentTransport(db.Model):
    """
    Current transport assignment for a student. One ACTIVE row per student —
    changing vehicle/route/stop updates this row and writes a
    TransportTransferHistory entry; it does not create a new row.
    """
    __tablename__ = 'transport_student_assignments'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=True)
    route_id   = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=True)
    stop_id    = db.Column(db.Integer, db.ForeignKey('transport_stops.id'), nullable=True)

    academic_year = db.Column(db.String(20), default='')
    assigned_date = db.Column(db.Date, default=datetime.utcnow)

    status = db.Column(db.String(20), default='ACTIVE')   # ACTIVE / REMOVED

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicle = db.relationship('Vehicle', foreign_keys=[vehicle_id])
    route   = db.relationship('Route', foreign_keys=[route_id])
    stop    = db.relationship('Stop', foreign_keys=[stop_id])

    def to_dict(self):
        from app.models.academic import Student
        student = Student.query.get(self.student_id)
        return {
            'id':              self.id,
            'student_id':      self.student_id,
            'student_name':    student.user.name if (student and student.user) else '',
            'admission_no':    student.admission_no if student else '',
            'class_id':        student.class_id if student else None,
            'father_name':     student.father_name if student else '',
            'father_mobile':   student.parent_phone if student else '',
            'photo_url':       student.photo_url if student else '',
            'vehicle_id':      self.vehicle_id,
            'vehicle_number':  self.vehicle.vehicle_number if self.vehicle else '',
            'route_id':        self.route_id,
            'route_name':      self.route.name if self.route else '',
            'stop_id':         self.stop_id,
            'stop_name':       self.stop.name if self.stop else '',
            'academic_year':   self.academic_year or '',
            'assigned_date':   self.assigned_date.isoformat() if self.assigned_date else None,
            'status':          self.status,
        }


class TransportTransferHistory(db.Model):
    """Immutable audit trail of every add/transfer/removal for a student's transport."""
    __tablename__ = 'transport_transfer_history'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    transfer_type = db.Column(db.String(20), nullable=False)   # ADDED / VEHICLE_CHANGE / ROUTE_CHANGE / STOP_CHANGE / REMOVED

    from_vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=True)
    to_vehicle_id   = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=True)
    from_route_id   = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=True)
    to_route_id     = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=True)
    from_stop_id    = db.Column(db.Integer, db.ForeignKey('transport_stops.id'), nullable=True)
    to_stop_id      = db.Column(db.Integer, db.ForeignKey('transport_stops.id'), nullable=True)

    remarks      = db.Column(db.String(500), default='')
    transfer_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'))

    def to_dict(self):
        def veh(vid):
            from app.models.transport import Vehicle
            v = Vehicle.query.get(vid) if vid else None
            return v.vehicle_number if v else ''

        def rte(rid):
            from app.models.transport import Route
            r = Route.query.get(rid) if rid else None
            return r.name if r else ''

        def stp(sid):
            from app.models.transport import Stop
            s = Stop.query.get(sid) if sid else None
            return s.name if s else ''

        return {
            'id':                  self.id,
            'student_id':          self.student_id,
            'transfer_type':       self.transfer_type,
            'from_vehicle_number': veh(self.from_vehicle_id),
            'to_vehicle_number':   veh(self.to_vehicle_id),
            'from_route_name':     rte(self.from_route_id),
            'to_route_name':       rte(self.to_route_id),
            'from_stop_name':      stp(self.from_stop_id),
            'to_stop_name':        stp(self.to_stop_id),
            'remarks':             self.remarks or '',
            'transfer_date':       self.transfer_date.isoformat() if self.transfer_date else None,
        }


class TransportFeeStructure(db.Model):
    """Fee slab — optionally scoped to a route (route-wise pricing) or applies school-wide."""
    __tablename__ = 'transport_fee_structures'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name          = db.Column(db.String(120), nullable=False)
    frequency     = db.Column(db.String(20), default='MONTHLY')   # MONTHLY / QUARTERLY / HALF_YEARLY / YEARLY
    amount        = db.Column(db.Float, nullable=False, default=0)
    route_id      = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=True)
    academic_year = db.Column(db.String(20), default='')

    status     = db.Column(db.String(20), default='ACTIVE')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    route = db.relationship('Route', foreign_keys=[route_id])

    def to_dict(self):
        return {
            'id':            self.id,
            'name':          self.name,
            'frequency':     self.frequency,
            'amount':        self.amount or 0,
            'route_id':      self.route_id,
            'route_name':    self.route.name if self.route else 'All Routes',
            'academic_year': self.academic_year or '',
            'status':        self.status,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }


class TransportFeeRecord(db.Model):
    """One billable period (e.g. 'April 2026') for one student, mirrors FeeRecord's discipline."""
    __tablename__ = 'transport_fee_records'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id         = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    fee_structure_id   = db.Column(db.Integer, db.ForeignKey('transport_fee_structures.id'), nullable=False)

    period_label = db.Column(db.String(50), nullable=False)   # "April 2026" / "Q1 2026-27"
    due_date     = db.Column(db.Date, nullable=True)

    amount       = db.Column(db.Float, nullable=False, default=0)
    discount     = db.Column(db.Float, default=0)
    waiver       = db.Column(db.Float, default=0)
    paid_amount  = db.Column(db.Float, default=0)

    status = db.Column(db.String(20), default='PENDING')   # PENDING / PARTIAL / PAID / OVERDUE / WAIVED

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    transactions = db.relationship('TransportFeeTransaction', backref='fee_record', lazy='dynamic',
                                    cascade='all, delete-orphan')

    def balance(self):
        return round((self.amount or 0) - (self.discount or 0) - (self.waiver or 0) - (self.paid_amount or 0), 2)

    def to_dict(self):
        from app.models.academic import Student
        student = Student.query.get(self.student_id)
        return {
            'id':               self.id,
            'student_id':       self.student_id,
            'student_name':     student.user.name if (student and student.user) else '',
            'admission_no':     student.admission_no if student else '',
            'fee_structure_id': self.fee_structure_id,
            'period_label':     self.period_label,
            'due_date':         self.due_date.isoformat() if self.due_date else None,
            'amount':           self.amount or 0,
            'discount':         self.discount or 0,
            'waiver':           self.waiver or 0,
            'paid_amount':      self.paid_amount or 0,
            'balance':          self.balance(),
            'status':           self.status,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


class TransportFeeTransaction(db.Model):
    """A single payment/receipt against a TransportFeeRecord."""
    __tablename__ = 'transport_fee_transactions'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    fee_record_id = db.Column(db.Integer, db.ForeignKey('transport_fee_records.id'), nullable=False, index=True)

    amount_paid     = db.Column(db.Float, nullable=False, default=0)
    payment_mode    = db.Column(db.String(20), default='CASH')
    transaction_ref = db.Column(db.String(100), default='')
    receipt_number  = db.Column(db.String(50), default='')

    payment_date = db.Column(db.DateTime, default=datetime.utcnow)
    collected_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    remarks      = db.Column(db.String(300), default='')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'fee_record_id':    self.fee_record_id,
            'amount_paid':      self.amount_paid or 0,
            'payment_mode':     self.payment_mode,
            'transaction_ref':  self.transaction_ref or '',
            'receipt_number':   self.receipt_number or '',
            'payment_date':     self.payment_date.isoformat() if self.payment_date else None,
            'remarks':          self.remarks or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }
