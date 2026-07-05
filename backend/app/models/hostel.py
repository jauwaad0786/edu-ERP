from app import db
from datetime import datetime, date


# ─── Constants ──────────────────────────────────────────────────────────────

HOSTEL_TYPES   = ['BOYS', 'GIRLS', 'JUNIOR', 'SENIOR', 'STAFF', 'INTERNATIONAL']
HOSTEL_GENDERS = ['MALE', 'FEMALE', 'CO_ED']
HOSTEL_STATUSES = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']

ROOM_TYPES = ['SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'SIX_SHARING', 'CUSTOM']
ROOM_STATUSES = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']

BED_STATUSES = ['VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED']

ALLOCATION_STATUSES = ['ACTIVE', 'TRANSFERRED', 'VACATED']
TRANSFER_TYPES = ['BED', 'ROOM', 'FLOOR', 'BUILDING', 'HOSTEL']


class Hostel(db.Model):
    """
    Top of the hierarchy. One school can have multiple hostels
    (Boys Hostel, Girls Hostel, Staff Hostel, etc).
    Capacity/occupancy are NEVER stored counters — always derived live
    from HostelBed.status via counts(), same discipline as Book/BookCopy.
    """
    __tablename__ = 'hostels'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name        = db.Column(db.String(150), nullable=False)
    code        = db.Column(db.String(30))
    hostel_type = db.Column(db.String(30), default='BOYS')   # BOYS / GIRLS / JUNIOR / SENIOR / STAFF / INTERNATIONAL
    gender      = db.Column(db.String(10), default='MALE')   # MALE / FEMALE / CO_ED — used to validate admissions

    description = db.Column(db.String(500), default='')
    address     = db.Column(db.String(300), default='')

    warden_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # User with role=HOSTEL
    contact_number = db.Column(db.String(20), default='')
    contact_email   = db.Column(db.String(120), default='')

    status      = db.Column(db.String(30), default='ACTIVE')
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    buildings = db.relationship('HostelBuilding', backref='hostel', lazy='dynamic', cascade='all, delete-orphan')
    warden    = db.relationship('User', foreign_keys=[warden_id])

    __table_args__ = (
        db.UniqueConstraint('school_id', 'code', name='uq_hostel_school_code'),
    )

    def counts(self):
        """Live rollup across all buildings→floors→rooms→beds under this hostel."""
        beds = HostelBed.query.join(HostelRoom).join(HostelFloor).join(HostelBuilding)\
                 .filter(HostelBuilding.hostel_id == self.id).all()
        total     = len(beds)
        occupied  = sum(1 for b in beds if b.status == 'OCCUPIED')
        vacant    = sum(1 for b in beds if b.status == 'VACANT')
        reserved  = sum(1 for b in beds if b.status == 'RESERVED')
        maint     = sum(1 for b in beds if b.status == 'MAINTENANCE')
        blocked   = sum(1 for b in beds if b.status == 'BLOCKED')
        return {
            'total_beds':       total,
            'occupied_beds':    occupied,
            'vacant_beds':      vacant,
            'reserved_beds':    reserved,
            'maintenance_beds': maint,
            'blocked_beds':     blocked,
            'occupancy_pct':    round(occupied / total * 100, 1) if total else 0,
        }

    def to_dict(self, include_counts=True):
        warden = self.warden
        d = {
            'id':              self.id,
            'name':            self.name,
            'code':            self.code or '',
            'hostel_type':     self.hostel_type,
            'gender':          self.gender,
            'description':     self.description or '',
            'address':         self.address or '',
            'warden_id':       self.warden_id,
            'warden_name':     warden.name if warden else '',
            'contact_number':  self.contact_number or '',
            'contact_email':   self.contact_email or '',
            'status':          self.status,
            'building_count':  self.buildings.count(),
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }
        if include_counts:
            d.update(self.counts())
        return d


class HostelBuilding(db.Model):
    __tablename__ = 'hostel_buildings'

    id          = db.Column(db.Integer, primary_key=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name        = db.Column(db.String(100), nullable=False)   # "Building A"
    code        = db.Column(db.String(30))
    description = db.Column(db.String(300), default='')
    status      = db.Column(db.String(30), default='ACTIVE')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    floors = db.relationship('HostelFloor', backref='building', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('hostel_id', 'name', name='uq_building_hostel_name'),
    )

    def counts(self):
        beds = HostelBed.query.join(HostelRoom).join(HostelFloor)\
                 .filter(HostelFloor.building_id == self.id).all()
        total    = len(beds)
        occupied = sum(1 for b in beds if b.status == 'OCCUPIED')
        vacant   = sum(1 for b in beds if b.status == 'VACANT')
        return {
            'total_beds': total, 'occupied_beds': occupied, 'vacant_beds': vacant,
            'occupancy_pct': round(occupied / total * 100, 1) if total else 0,
        }

    def to_dict(self, include_counts=True):
        d = {
            'id':          self.id,
            'hostel_id':   self.hostel_id,
            'name':        self.name,
            'code':        self.code or '',
            'description': self.description or '',
            'status':      self.status,
            'floor_count': self.floors.count(),
        }
        if include_counts:
            d.update(self.counts())
        return d


class HostelFloor(db.Model):
    __tablename__ = 'hostel_floors'

    id          = db.Column(db.Integer, primary_key=True)
    building_id = db.Column(db.Integer, db.ForeignKey('hostel_buildings.id'), nullable=False, index=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name        = db.Column(db.String(100), nullable=False)   # "Ground Floor" / "VIP Floor"
    floor_number= db.Column(db.Integer, default=0)             # for sorting: 0=Ground, 1=First...
    description = db.Column(db.String(300), default='')

    wings = db.relationship('HostelWing', backref='floor', lazy='dynamic', cascade='all, delete-orphan')
    rooms = db.relationship('HostelRoom', backref='floor', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'building_id':  self.building_id,
            'name':         self.name,
            'floor_number': self.floor_number,
            'description':  self.description or '',
            'wing_count':   self.wings.count(),
            'room_count':   self.rooms.count(),
        }


class HostelWing(db.Model):
    """Optional layer — a Room may belong to a Wing, or skip it and link Floor directly."""
    __tablename__ = 'hostel_wings'

    id        = db.Column(db.Integer, primary_key=True)
    floor_id  = db.Column(db.Integer, db.ForeignKey('hostel_floors.id'), nullable=False, index=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name        = db.Column(db.String(50), nullable=False)   # "East Wing"
    description = db.Column(db.String(300), default='')

    rooms = db.relationship('HostelRoom', backref='wing', lazy='dynamic')

    def to_dict(self):
        return {
            'id':          self.id,
            'floor_id':    self.floor_id,
            'name':        self.name,
            'description': self.description or '',
            'room_count':  self.rooms.count(),
        }


class HostelRoom(db.Model):
    __tablename__ = 'hostel_rooms'

    id        = db.Column(db.Integer, primary_key=True)
    floor_id  = db.Column(db.Integer, db.ForeignKey('hostel_floors.id'), nullable=False, index=True)
    wing_id   = db.Column(db.Integer, db.ForeignKey('hostel_wings.id'), nullable=True, index=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    room_number = db.Column(db.String(20), nullable=False)
    room_name   = db.Column(db.String(100), default='')
    room_type   = db.Column(db.String(30), default='DOUBLE')  # SINGLE/DOUBLE/TRIPLE/FOUR_SHARING/SIX_SHARING/CUSTOM

    is_ac              = db.Column(db.Boolean, default=False)
    has_attached_bath  = db.Column(db.Boolean, default=False)
    has_study_table    = db.Column(db.Boolean, default=True)
    has_cupboard       = db.Column(db.Boolean, default=True)
    has_balcony        = db.Column(db.Boolean, default=False)
    has_wifi           = db.Column(db.Boolean, default=False)

    description = db.Column(db.String(300), default='')
    status      = db.Column(db.String(30), default='ACTIVE')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    beds = db.relationship('HostelBed', backref='room', lazy='dynamic', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('floor_id', 'room_number', name='uq_room_floor_number'),
    )

    def counts(self):
        all_beds = self.beds.all()
        total    = len(all_beds)
        occupied = sum(1 for b in all_beds if b.status == 'OCCUPIED')
        vacant   = sum(1 for b in all_beds if b.status == 'VACANT')
        return {'capacity': total, 'occupied': occupied, 'available_beds': vacant}

    def to_dict(self, include_counts=True):
        d = {
            'id':                self.id,
            'floor_id':          self.floor_id,
            'wing_id':           self.wing_id,
            'room_number':       self.room_number,
            'room_name':         self.room_name or '',
            'room_type':         self.room_type,
            'is_ac':             self.is_ac,
            'has_attached_bath': self.has_attached_bath,
            'has_study_table':   self.has_study_table,
            'has_cupboard':      self.has_cupboard,
            'has_balcony':       self.has_balcony,
            'has_wifi':          self.has_wifi,
            'description':       self.description or '',
            'status':            self.status,
        }
        if include_counts:
            d.update(self.counts())
        return d


class HostelBed(db.Model):
    """
    One row per physical bed. current_student_id is a denormalized fast-lookup
    pointer (mirrors the ACTIVE row in HostelBedAllocation) — source of truth
    for history is always HostelBedAllocation, never this column alone.
    """
    __tablename__ = 'hostel_beds'

    id        = db.Column(db.Integer, primary_key=True)
    room_id   = db.Column(db.Integer, db.ForeignKey('hostel_rooms.id'), nullable=False, index=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    bed_number = db.Column(db.String(10), nullable=False)   # "A" / "B" / "1" / "2"
    status     = db.Column(db.String(20), default='VACANT')  # VACANT/OCCUPIED/RESERVED/MAINTENANCE/BLOCKED

    current_student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    allocation_date     = db.Column(db.Date, nullable=True)

    condition_note = db.Column(db.String(300), default='')

    __table_args__ = (
        db.UniqueConstraint('room_id', 'bed_number', name='uq_bed_room_number'),
    )

    current_student = db.relationship('Student', foreign_keys=[current_student_id])

    def to_dict(self):
        room = self.room
        return {
            'id':                  self.id,
            'room_id':             self.room_id,
            'room_number':         room.room_number if room else '',
            'bed_number':          self.bed_number,
            'status':              self.status,
            'current_student_id':  self.current_student_id,
            'current_student_name': self.current_student.user.name
                                      if self.current_student and self.current_student.user else '',
            'allocation_date':     str(self.allocation_date) if self.allocation_date else None,
            'condition_note':      self.condition_note or '',
        }


class HostelBedAllocation(db.Model):
    """
    Permanent record of every admission / transfer / vacate.
    One ACTIVE row per student at a time. Transfers close the old row
    (status=TRANSFERRED) and open a new one — full history preserved,
    which is what powers Room/Bed/Floor/Building/Hostel Transfer Report.
    """
    __tablename__ = 'hostel_bed_allocations'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False)
    building_id = db.Column(db.Integer, db.ForeignKey('hostel_buildings.id'), nullable=False)
    floor_id    = db.Column(db.Integer, db.ForeignKey('hostel_floors.id'), nullable=False)
    room_id     = db.Column(db.Integer, db.ForeignKey('hostel_rooms.id'), nullable=False)
    bed_id      = db.Column(db.Integer, db.ForeignKey('hostel_beds.id'), nullable=False)

    admission_date = db.Column(db.Date, default=date.today)
    vacate_date    = db.Column(db.Date, nullable=True)

    status         = db.Column(db.String(20), default='ACTIVE')  # ACTIVE / TRANSFERRED / VACATED
    transfer_type  = db.Column(db.String(20), nullable=True)      # BED/ROOM/FLOOR/BUILDING/HOSTEL (set on close)
    transfer_reason= db.Column(db.String(300), default='')

    allocated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', foreign_keys=[student_id])

    def to_dict(self):
        student = self.student
        return {
            'id':              self.id,
            'student_id':      self.student_id,
            'student_name':    student.user.name if student and student.user else '',
            'hostel_id':       self.hostel_id,
            'building_id':     self.building_id,
            'floor_id':        self.floor_id,
            'room_id':         self.room_id,
            'bed_id':          self.bed_id,
            'admission_date':  str(self.admission_date) if self.admission_date else None,
            'vacate_date':     str(self.vacate_date) if self.vacate_date else None,
            'status':          self.status,
            'transfer_type':   self.transfer_type,
            'transfer_reason': self.transfer_reason or '',
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }


class HostelActivityLog(db.Model):
    """Audit trail — same pattern as LibraryActivityLog."""
    __tablename__ = 'hostel_activity_logs'

    id         = db.Column(db.Integer, primary_key=True)
    school_id  = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'))
    action     = db.Column(db.String(50))   # HOSTEL_CREATED / ROOM_CREATED / STUDENT_ALLOCATED / TRANSFERRED / VACATED / FEE_COLLECTED ...
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


def log_hostel_activity(school_id, user_id, action, details=''):
    entry = HostelActivityLog(school_id=school_id, user_id=user_id, action=action, details=details)
    db.session.add(entry)


class HostelSettings(db.Model):
    """Per-school defaults — same shape as LibrarySettings."""
    __tablename__ = 'hostel_settings'

    id        = db.Column(db.Integer, primary_key=True)
    school_id = db.Column(db.Integer, db.ForeignKey('schools.id'), unique=True, nullable=False)

    late_entry_cutoff_time = db.Column(db.String(10), default='21:00')   # "HH:MM"
    gate_pass_requires_principal_approval = db.Column(db.Boolean, default=False)
    max_leave_days_per_month = db.Column(db.Integer, default=4)
    default_mess_charge      = db.Column(db.Float, default=0.0)
    default_electricity_charge = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'late_entry_cutoff_time': self.late_entry_cutoff_time,
            'gate_pass_requires_principal_approval': self.gate_pass_requires_principal_approval,
            'max_leave_days_per_month': self.max_leave_days_per_month,
            'default_mess_charge':      self.default_mess_charge,
            'default_electricity_charge': self.default_electricity_charge,
        }
