from app import db
from datetime import datetime


# ─── Constants ──────────────────────────────────────────────────────────────

TRIP_STATUSES = ['NOT_STARTED', 'RUNNING', 'PAUSED', 'COMPLETED', 'SOS', 'BREAKDOWN']

NETWORK_STATUSES = ['ONLINE', 'OFFLINE', 'WEAK']


class TripLog(db.Model):
    """
    One row per trip (driver presses Start Trip -> End Trip). GPSLog rows
    reference this via trip_id. Live location shown to Principal/Parent is
    just the latest GPSLog for the trip currently RUNNING/PAUSED — no
    separate 'live location' table needed.
    """
    __tablename__ = 'transport_trip_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=False, index=True)
    driver_id  = db.Column(db.Integer, db.ForeignKey('transport_drivers.id'), nullable=False, index=True)
    route_id   = db.Column(db.Integer, db.ForeignKey('transport_routes.id'), nullable=True, index=True)

    trip_date  = db.Column(db.Date, default=datetime.utcnow)

    status = db.Column(db.String(20), default='NOT_STARTED')   # NOT_STARTED / RUNNING / PAUSED / COMPLETED / SOS / BREAKDOWN

    start_time = db.Column(db.DateTime, nullable=True)
    end_time   = db.Column(db.DateTime, nullable=True)

    start_latitude  = db.Column(db.Float, nullable=True)
    start_longitude = db.Column(db.Float, nullable=True)
    end_latitude    = db.Column(db.Float, nullable=True)
    end_longitude   = db.Column(db.Float, nullable=True)

    total_distance_km  = db.Column(db.Float, default=0)   # computed from GPSLog trail on End Trip
    duration_minutes    = db.Column(db.Integer, default=0)

    students_count = db.Column(db.Integer, default=0)   # snapshot of active students on this vehicle at trip start

    sos_triggered_at   = db.Column(db.DateTime, nullable=True)
    breakdown_reported_at = db.Column(db.DateTime, nullable=True)
    remarks = db.Column(db.String(500), default='')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    vehicle = db.relationship('Vehicle', foreign_keys=[vehicle_id])
    driver  = db.relationship('Driver', foreign_keys=[driver_id])
    route   = db.relationship('Route', foreign_keys=[route_id])

    gps_logs = db.relationship('GPSLog', backref='trip', lazy='dynamic',
                                cascade='all, delete-orphan', order_by='GPSLog.recorded_at')

    def latest_gps(self):
        return self.gps_logs.order_by(GPSLog.recorded_at.desc()).first()

    def next_stop(self):
        """
        Naive next-stop resolution: first route stop whose sequence is
        beyond the count of stops already 'reached' — actual arrival
        detection (geofence radius check against Stop.radius) happens in
        routes/transport_gps.py on each GPS ping, which advances a
        last_stop_sequence pointer. Kept here as a simple fallback only.
        """
        if not self.route_id:
            return None
        from app.models.transport import RouteStop
        return RouteStop.query.filter_by(route_id=self.route_id) \
            .order_by(RouteStop.sequence).first()

    def to_dict(self, include_latest_gps=True):
        d = {
            'id':                self.id,
            'vehicle_id':        self.vehicle_id,
            'vehicle_number':    self.vehicle.vehicle_number if self.vehicle else '',
            'driver_id':         self.driver_id,
            'driver_name':       self.driver.name if self.driver else '',
            'driver_mobile':     self.driver.mobile_number if self.driver else '',
            'route_id':          self.route_id,
            'route_name':        self.route.name if self.route else '',
            'trip_date':         self.trip_date.isoformat() if self.trip_date else None,
            'status':            self.status,
            'start_time':        self.start_time.isoformat() if self.start_time else None,
            'end_time':          self.end_time.isoformat() if self.end_time else None,
            'total_distance_km': self.total_distance_km or 0,
            'duration_minutes':  self.duration_minutes or 0,
            'students_count':    self.students_count or 0,
            'remarks':           self.remarks or '',
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }
        if include_latest_gps:
            gps = self.latest_gps()
            d['latest_gps'] = gps.to_dict() if gps else None
        return d


class GPSLog(db.Model):
    """
    One row per location ping from the Driver Mobile App during a RUNNING
    trip. High write volume by design (every few seconds) — kept lean,
    no relationship back-references beyond trip/vehicle FKs, and indexed
    on (trip_id, recorded_at) for fast 'latest ping' / trail queries.
    """
    __tablename__ = 'transport_gps_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    trip_id    = db.Column(db.Integer, db.ForeignKey('transport_trip_logs.id'), nullable=False, index=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey('transport_vehicles.id'), nullable=False, index=True)

    latitude  = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    speed     = db.Column(db.Float, default=0)        # km/h, reported by device or derived from consecutive pings
    heading   = db.Column(db.Float, nullable=True)     # degrees, optional

    battery_level   = db.Column(db.Integer, nullable=True)     # 0-100
    network_status  = db.Column(db.String(10), default='ONLINE')   # ONLINE / OFFLINE / WEAK

    recorded_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        db.Index('ix_gpslog_trip_recorded', 'trip_id', 'recorded_at'),
    )

    def to_dict(self):
        return {
            'id':              self.id,
            'trip_id':         self.trip_id,
            'vehicle_id':      self.vehicle_id,
            'latitude':        self.latitude,
            'longitude':       self.longitude,
            'speed':           self.speed or 0,
            'heading':         self.heading,
            'battery_level':   self.battery_level,
            'network_status':  self.network_status,
            'recorded_at':     self.recorded_at.isoformat() if self.recorded_at else None,
        }
