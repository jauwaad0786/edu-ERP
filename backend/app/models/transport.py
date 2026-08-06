from app import db
from datetime import datetime


# ─── Constants ──────────────────────────────────────────────────────────────

VEHICLE_TYPES     = ['BUS', 'VAN', 'CAR']
VEHICLE_STATUSES  = ['ACTIVE', 'INACTIVE', 'MAINTENANCE']

DRIVER_STATUSES    = ['ACTIVE', 'INACTIVE']
CONDUCTOR_STATUSES = ['ACTIVE', 'INACTIVE']

ROUTE_STATUSES = ['ACTIVE', 'INACTIVE']

MAINTENANCE_STATUSES = ['REPORTED', 'IN_PROGRESS', 'COMPLETED']


class Vehicle(db.Model):
    """
    Master vehicle record. capacity/status are stored directly (not derived) —
    unlike Hostel beds, vehicle count is small enough per school that live
    rollups aren't needed; dashboard aggregates via simple queries.
    """
    __tablename__ = 'transport_vehicles'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    vehicle_number = db.Column(db.String(30), nullable=False)
    vehicle_name   = db.Column(db.String(100), default='')
    vehicle_type   = db.Column(db.String(10), default='BUS')   # BUS / VAN / CAR
    capacity       = db.Column(db.Integer, default=0)

    driver_id      = db.Column(db.Integer, db.ForeignKey('transport_drivers.id'), nullable=True)
    conductor_id   = db.Column(db.Integer, db.ForeignKey('transport_conductors.id'), nullable=True)

    status         = db.Column(db.String(20), default='ACTIVE')   # ACTIVE / INACTIVE / MAINTENANCE

    purchase_date    = db.Column(db.Date, nullable=True)
    insurance_expiry = db.Column(db.Date, nullable=True)

    photo_url = db.Column(db.String(500), default='')
    notes     = db.Column(db.String(500), default='')

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    driver    = db.relationship('Driver', foreign_keys=[driver_id])
    conductor = db.relationship('Conductor', foreign_keys=[conductor_id])
    route     = db.relationship('Route', backref='vehicle', uselist=False)
    maintenance_logs = db.relationship('VehicleMaintenance', backref='vehicle', lazy='dynamic',
                                        cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'vehicle_number', name='uq_vehicle_school_number'),
    )

    def student_count(self):
        from app.models.transport_student import StudentTransport
        return StudentTransport.query.filter_by(vehicle_id=self.id, status='ACTIVE').count()

    def to_dict(self, include_counts=True):
        d = {
            'id':                self.id,
            'vehicle_number':    self.vehicle_number,
            'vehicle_name':      self.vehicle_name or '',
            'vehicle_type':      self.vehicle_type,
            'capacity':          self.capacity or 0,
            'driver_id':         self.driver_id,
            'driver_name':       self.driver.name if self.driver else '',
            'driver_mobile':     self.driver.mobile_number if self.driver else '',
            'conductor_id':      self.conductor_id,
            'conductor_name':    self.conductor.name if self.conductor else '',
            'status':            self.status,
            'purchase_date':     self.purchase_date.isoformat() if self.purchase_date else None,
            'insurance_expiry':  self.insurance_expiry.isoformat() if self.insurance_expiry else None,
            'photo_url':         self.photo_url or '',
            'notes':             self.notes or '',
            'route_id':          self.route.id if self.route else None,
            'route_name':        self.route.name if self.route else '',
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }
        if include_counts:
            d['students_assigned'] = self.student_count()
        return d


class Driver(db.Model):
    __tablename__ = 'transport_drivers'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)   # login for Driver Mobile App

    name           = db.Column(db.String(120), nullable=False)
    mobile_number  = db.Column(db.String(20), nullable=False)
    address        = db.Column(db.String(300), default='')
    photo_url      = db.Column(db.String(500), default='')
    experience_years = db.Column(db.Integer, default=0)

    has_license      = db.Column(db.Boolean, default=False)
    license_number   = db.Column(db.String(50), default='')
    license_expiry   = db.Column(db.Date, nullable=True)
    license_photo_url = db.Column(db.String(500), default='')

    emergency_contact = db.Column(db.String(20), default='')
    remarks            = db.Column(db.String(500), default='')

    status     = db.Column(db.String(20), default='ACTIVE')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        vehicle = Vehicle.query.filter_by(driver_id=self.id).first()
        return {
            'id':                self.id,
            'user_id':           self.user_id,
            'name':              self.name,
            'mobile_number':     self.mobile_number,
            'address':           self.address or '',
            'photo_url':         self.photo_url or '',
            'experience_years':  self.experience_years or 0,
            'has_license':       self.has_license,
            'license_number':    self.license_number or '',
            'license_expiry':    self.license_expiry.isoformat() if self.license_expiry else None,
            'license_photo_url': self.license_photo_url or '',
            'emergency_contact': self.emergency_contact or '',
            'remarks':           self.remarks or '',
            'status':            self.status,
            'assigned_vehicle_id':     vehicle.id if vehicle else None,
            'assigned_vehicle_number': vehicle.vehicle_number if vehicle else '',
            'assigned_route_id':       vehicle.route.id if (vehicle and vehicle.route) else None,
            'assigned_route_name':     vehicle.route.name if (vehicle and vehicle.route) else '',
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class Conductor(db.Model):
    __tablename__ = 'transport_conductors'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    name          = db.Column(db.String(120), nullable=False)
    mobile_number = db.Column(db.String(20), nullable=False)
    address       = db.Column(db.String(300), default='')
    photo_url     = db.Column(db.String(500), default='')
    experience_years = db.Column(db.Integer, default=0)

    emergency_contact = db.Column(db.String(20), default='')
    remarks            = db.Column(db.String(500), default='')

    status     = db.Column(db.String(20), default='ACTIVE')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        vehicle = Vehicle.query.filter_by(conductor_id=self.id).first()
        return {
            'id':                self.id,
            'user_id':           self.user_id,
            'name':              self.name,
            'mobile_number':     self.mobile_number,
            'address':           self.address or '',
            'photo_url':         self.photo_url or '',
            'experience_years':  self.experience_years or 0,
            'emergency_contact': self.emergency_contact or '',
            'remarks':           self.remarks or '',
            'status':            self.status,
            'assigned_vehicle_id':     vehicle.id if vehicle else None,
            'assigned_vehicle_number': vehicle.vehicle_number if vehicle else '',
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class Stop(db.Model):
    """
    Master stop list for the school (reusable across routes).
    """
    __tablename__ = 'transport_stops'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name        = db.Column(db.String(150), nullable=False)
    latitude    = db.Column(db.Float, nullable=True)
    longitude   = db.Column(db.Float, nullable=True)
    radius      = db.Column(db.Integer, default=200)   # meters, used for geofence arrival detection
    description = db.Column(db.String(300), default='')

    status     = db.Column(db.String(20), default='ACTIVE')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('school_id', 'name', name='uq_stop_school_name'),
    )

    def students_count(self):
        from app.models.transport_student import StudentTransport
        return StudentTransport.query.filter_by(stop_id=self.id, status='ACTIVE').count()

    def to_dict(self, include_counts=True):
        d = {
            'id':          self.id,
            'name':        self.name,
            'latitude':    self.latitude,
            'longitude':   self.longitude,
            'radius':      self.radius or 200,
            'description': self.description or '',
            'status':      self.status,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }
        if include_counts:
            d['students_count'] = self.students_count()
        return d


class Route(db.Model):
    """
    A route belongs to exactly one vehicle at a time (School -> Stop1 -> Stop2 -> ... -> School).
    Ordered stops live in RouteStop.
    """
    __tablename__ = 'transport_routes'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name       = db.Column(db.String(150), nullable=False)
    code       = db.Column(db.String(30), default='')
    vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=True)

    status     = db.Column(db.String(20), default='ACTIVE')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stops = db.relationship('RouteStop', backref='route', lazy='dynamic',
                             cascade='all, delete-orphan', order_by='RouteStop.sequence')

    __table_args__ = (
        db.UniqueConstraint('school_id', 'name', name='uq_route_school_name'),
    )

    def students_count(self):
        from app.models.transport_student import StudentTransport
        return StudentTransport.query.filter_by(route_id=self.id, status='ACTIVE').count()

    def to_dict(self, include_stops=True, include_counts=True):
        d = {
            'id':             self.id,
            'name':           self.name,
            'code':           self.code or '',
            'vehicle_id':     self.vehicle_id,
            'vehicle_number': self.vehicle.vehicle_number if self.vehicle else '',
            'status':         self.status,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }
        if include_stops:
            d['stops'] = [s.to_dict() for s in self.stops.order_by(RouteStop.sequence)]
        if include_counts:
            d['students_count'] = self.students_count()
        return d


class RouteStop(db.Model):
    """Ordered join between a Route and a master Stop, with per-route ETA offset."""
    __tablename__ = 'transport_route_stops'

    id       = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=False, index=True)
    stop_id  = db.Column(db.Integer, db.ForeignKey('transport_stops.id'), nullable=False, index=True)

    sequence       = db.Column(db.Integer, nullable=False, default=0)
    estimated_time = db.Column(db.String(20), default='')   # e.g. "07:45 AM" or "+12 min"

    stop = db.relationship('Stop')

    __table_args__ = (
        db.UniqueConstraint('route_id', 'sequence', name='uq_routestop_route_sequence'),
    )

    def to_dict(self):
        return {
            'id':             self.id,
            'route_id':       self.route_id,
            'stop_id':        self.stop_id,
            'stop_name':      self.stop.name if self.stop else '',
            'latitude':       self.stop.latitude if self.stop else None,
            'longitude':      self.stop.longitude if self.stop else None,
            'sequence':       self.sequence,
            'estimated_time': self.estimated_time or '',
        }


class VehicleMaintenance(db.Model):
    __tablename__ = 'transport_vehicle_maintenance'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=False, index=True)

    problem              = db.Column(db.String(500), nullable=False)
    reported_date         = db.Column(db.Date, default=datetime.utcnow)
    expected_completion   = db.Column(db.Date, nullable=True)
    completed_date         = db.Column(db.Date, nullable=True)

    status = db.Column(db.String(20), default='REPORTED')   # REPORTED / IN_PROGRESS / COMPLETED
    cost   = db.Column(db.Float, default=0)
    remarks   = db.Column(db.String(500), default='')
    photo_url = db.Column(db.String(500), default='')

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                  self.id,
            'vehicle_id':          self.vehicle_id,
            'vehicle_number':      self.vehicle.vehicle_number if self.vehicle else '',
            'problem':             self.problem,
            'reported_date':       self.reported_date.isoformat() if self.reported_date else None,
            'expected_completion': self.expected_completion.isoformat() if self.expected_completion else None,
            'completed_date':      self.completed_date.isoformat() if self.completed_date else None,
            'status':              self.status,
            'cost':                self.cost or 0,
            'remarks':             self.remarks or '',
            'photo_url':           self.photo_url or '',
            'created_at':          self.created_at.isoformat() if self.created_at else None,
        }
