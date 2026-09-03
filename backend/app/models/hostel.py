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

    checkin_date           = db.Column(db.Date, nullable=True)
    expected_checkout_date = db.Column(db.Date, nullable=True)
    checkout_remarks       = db.Column(db.String(300), default='')
    checkout_approved_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    status         = db.Column(db.String(20), default='ACTIVE')  # ACTIVE / TRANSFERRED / VACATED / CHECKED_IN
    transfer_type  = db.Column(db.String(20), nullable=True)      # BED/ROOM/FLOOR/BUILDING/HOSTEL (set on close)
    transfer_reason= db.Column(db.String(300), default='')

    allocated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', foreign_keys=[student_id])

    def to_dict(self):
        student  = self.student
        room     = HostelRoom.query.get(self.room_id)
        floor    = HostelFloor.query.get(self.floor_id)
        building = HostelBuilding.query.get(self.building_id)
        hostel   = Hostel.query.get(self.hostel_id)
        bed      = HostelBed.query.get(self.bed_id)
        return {
            'id':                     self.id,
            'student_id':             self.student_id,
            'student_name':           student.user.name if student and student.user else '',
            'hostel_id':              self.hostel_id,
            'hostel_name':            hostel.name if hostel else '',
            'building_id':            self.building_id,
            'building_name':          building.name if building else '',
            'floor_id':               self.floor_id,
            'floor_name':             floor.name if floor else '',
            'room_id':                self.room_id,
            'room_number':            room.room_number if room else '',
            'room_type':              room.room_type if room else '',
            'is_ac':                  room.is_ac if room else False,
            'bed_id':                 self.bed_id,
            'bed_number':             bed.bed_number if bed else '',
            'admission_date':         str(self.admission_date) if self.admission_date else None,
            'checkin_date':           str(self.checkin_date) if self.checkin_date else None,
            'expected_checkout_date': str(self.expected_checkout_date) if self.expected_checkout_date else None,
            'vacate_date':            str(self.vacate_date) if self.vacate_date else None,
            'status':                 self.status,
            'transfer_type':          self.transfer_type,
            'transfer_reason':        self.transfer_reason or '',
            'checkout_remarks':       self.checkout_remarks or '',
            'created_at':             self.created_at.isoformat() if self.created_at else None,
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

    late_entry_cutoff_time                = db.Column(db.String(10), default='21:00')   # "HH:MM"
    gate_pass_requires_principal_approval = db.Column(db.Boolean, default=False)
    max_leave_days_per_month              = db.Column(db.Integer, default=4)
    default_mess_charge                   = db.Column(db.Float, default=0.0)
    default_electricity_charge            = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'late_entry_cutoff_time':                self.late_entry_cutoff_time,
            'gate_pass_requires_principal_approval': self.gate_pass_requires_principal_approval,
            'max_leave_days_per_month':              self.max_leave_days_per_month,
            'default_mess_charge':                   self.default_mess_charge,
            'default_electricity_charge':            self.default_electricity_charge,
        }


FEE_ROOM_TYPES = ['AC', 'NON_AC']  # maps to HostelRoom.is_ac True/False


class HostelFeeStructure(db.Model):
    """
    Pricing rule per Hostel → Building(optional) → Floor(optional) → AC/Non-AC → Sharing type.
    Most specific match wins at resolution time (floor > building > hostel-wide).
    This table NEVER stores actual student fee amounts — it's config only.
    Actual billing happens in FeeRecord (source='HOSTEL') via hostel_fee_service.
    """
    __tablename__ = 'hostel_fee_structures'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    building_id = db.Column(db.Integer, db.ForeignKey('hostel_buildings.id'), nullable=True)
    floor_id    = db.Column(db.Integer, db.ForeignKey('hostel_floors.id'), nullable=True)

    is_ac         = db.Column(db.Boolean, nullable=False, default=False)   # matches HostelRoom.is_ac
    sharing_type  = db.Column(db.String(20), nullable=False)                # matches HostelRoom.room_type

    monthly_fee         = db.Column(db.Float, nullable=False, default=0)
    quarterly_fee       = db.Column(db.Float, default=0)
    yearly_fee          = db.Column(db.Float, default=0)
    security_deposit    = db.Column(db.Float, default=0)
    electricity_charges = db.Column(db.Float, default=0)
    laundry_charges     = db.Column(db.Float, default=0)
    mess_charges        = db.Column(db.Float, default=0)
    maintenance_charges = db.Column(db.Float, default=0)
    late_fine           = db.Column(db.Float, default=0)
    discount            = db.Column(db.Float, default=0)

    status      = db.Column(db.String(20), default='ACTIVE')
    created_by  = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    hostel   = db.relationship('Hostel', foreign_keys=[hostel_id])
    building = db.relationship('HostelBuilding', foreign_keys=[building_id])
    floor    = db.relationship('HostelFloor', foreign_keys=[floor_id])

    def total_monthly(self):
        return round(
            (self.monthly_fee or 0) + (self.electricity_charges or 0) +
            (self.laundry_charges or 0) + (self.mess_charges or 0) +
            (self.maintenance_charges or 0) - (self.discount or 0), 2
        )

    def is_used(self):
        """Checks whether any hostel resident or fee record is currently bound to this structure."""
        from app.models.hostel import HostelBedAllocation
        from app.models.financial import FeeRecord
        # Check active allocations
        alloc = HostelBedAllocation.query.filter_by(hostel_id=self.hostel_id, status='ACTIVE').first()
        if alloc:
            return True
        # Check if fee records exist
        fee = FeeRecord.query.filter_by(school_id=self.school_id, source='HOSTEL').first()
        return fee is not None

    def to_dict(self):
        used = self.is_used()
        return {
            'id':                  self.id,
            'hostel_id':           self.hostel_id,
            'hostel_name':         self.hostel.name if self.hostel else '',
            'building_id':         self.building_id,
            'building_name':       self.building.name if self.building else 'All Buildings',
            'floor_id':            self.floor_id,
            'floor_name':          self.floor.name if self.floor else 'All Floors',
            'is_ac':               self.is_ac,
            'sharing_type':        self.sharing_type,
            'monthly_fee':         self.monthly_fee,
            'quarterly_fee':       self.quarterly_fee or 0,
            'yearly_fee':          self.yearly_fee or 0,
            'security_deposit':    self.security_deposit or 0,
            'electricity_charges': self.electricity_charges or 0,
            'laundry_charges':     self.laundry_charges or 0,
            'mess_charges':        self.mess_charges or 0,
            'maintenance_charges': self.maintenance_charges or 0,
            'late_fine':           self.late_fine or 0,
            'discount':            self.discount or 0,
            'total_monthly':       self.total_monthly(),
            'status':              self.status,
            'is_used':             used,
            'can_delete':          not used,
        }


FINE_REASONS = ['FURNITURE_DAMAGE', 'PROPERTY_LOSS', 'RULE_VIOLATION', 'ROOM_DAMAGE', 'LATE_ENTRY', 'CLEANLINESS', 'OTHER']
FINE_STATUSES = ['OUTSTANDING', 'PENDING', 'PARTIALLY_PAID', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELLED']


class HostelFineRecord(db.Model):
    """
    Warden-raised fine/damage charge on a student. Mirrors FeeRecord.source_ref_id
    pattern used by Library fines — a matching FeeRecord(source='HOSTEL_FINE')
    is auto-created so it shows up in Fee Management too.
    """
    __tablename__ = 'hostel_fine_records'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False)

    reason      = db.Column(db.String(30), nullable=False, default='OTHER')
    description = db.Column(db.String(300), default='')
    amount      = db.Column(db.Float, nullable=False, default=0.0)
    amount_paid = db.Column(db.Float, default=0.0)

    waived_amount = db.Column(db.Float, default=0.0)
    waived_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    waived_at     = db.Column(db.DateTime, nullable=True)
    waive_reason  = db.Column(db.String(300), nullable=True)

    collected_by       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    collected_at       = db.Column(db.DateTime, nullable=True)
    payment_mode       = db.Column(db.String(30), nullable=True)
    receipt_no         = db.Column(db.String(50), nullable=True)
    fee_transaction_id = db.Column(db.Integer, nullable=True)

    status      = db.Column(db.String(20), default='OUTSTANDING')  # OUTSTANDING / PARTIALLY_PAID / PAID / WAIVED
    raised_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    raised_date = db.Column(db.Date, default=date.today)

    fee_record_id = db.Column(db.Integer, db.ForeignKey('fee_records.id'), nullable=True)

    student = db.relationship('Student', foreign_keys=[student_id])
    hostel  = db.relationship('Hostel', foreign_keys=[hostel_id])

    @property
    def outstanding_amount(self):
        return max(0.0, round((self.amount or 0.0) - (self.amount_paid or 0.0) - (self.waived_amount or 0.0), 2))

    @property
    def canonical_status(self):
        if self.status == 'WAIVED' or (self.waived_amount and self.waived_amount >= self.amount):
            return 'WAIVED'
        if self.outstanding_amount <= 0:
            return 'PAID'
        if self.amount_paid and self.amount_paid > 0:
            return 'PARTIALLY_PAID'
        return 'OUTSTANDING'

    def to_dict(self):
        student = self.student
        return {
            'id':                 self.id,
            'student_id':         self.student_id,
            'student_name':       student.user.name if student and student.user else '',
            'hostel_id':          self.hostel_id,
            'hostel_name':        self.hostel.name if self.hostel else '',
            'reason':             self.reason,
            'description':        self.description or '',
            'amount':             self.amount,
            'amount_paid':        self.amount_paid or 0.0,
            'waived_amount':      self.waived_amount or 0.0,
            'outstanding_amount': self.outstanding_amount,
            'waive_reason':       self.waive_reason or '',
            'waived_at':          self.waived_at.isoformat() if self.waived_at else None,
            'status':             self.canonical_status,
            'payment_mode':       self.payment_mode or '',
            'receipt_no':         self.receipt_no or '',
            'collected_at':       self.collected_at.isoformat() if self.collected_at else None,
            'raised_date':        str(self.raised_date) if self.raised_date else None,
            'fee_record_id':      self.fee_record_id,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  COMPLAINTS & MAINTENANCE REQUESTS
# ═══════════════════════════════════════════════════════════════════════════

COMPLAINT_CATEGORIES = ['MAINTENANCE', 'ELECTRICAL', 'PLUMBING', 'CLEANING', 'FOOD', 'SAFETY', 'WIFI', 'OTHER']
COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']


class HostelComplaint(db.Model):
    """
    Resident / Warden maintenance requests and complaints.
    """
    __tablename__ = 'hostel_complaints'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    room_id     = db.Column(db.Integer, db.ForeignKey('hostel_rooms.id'), nullable=True)

    category    = db.Column(db.String(30), default='MAINTENANCE')  # MAINTENANCE, ELECTRICAL, etc.
    title       = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, default='')
    priority    = db.Column(db.String(20), default='MEDIUM')       # LOW / MEDIUM / HIGH / URGENT
    status      = db.Column(db.String(20), default='OPEN')         # OPEN / IN_PROGRESS / RESOLVED / CLOSED

    attachment_url = db.Column(db.String(500), nullable=True)
    resolution     = db.Column(db.Text, default='')
    resolved_by    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resolved_at    = db.Column(db.DateTime, nullable=True)

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', foreign_keys=[student_id])
    hostel  = db.relationship('Hostel', foreign_keys=[hostel_id])
    room    = db.relationship('HostelRoom', foreign_keys=[room_id])

    def to_dict(self):
        student = self.student
        return {
            'id':             self.id,
            'school_id':      self.school_id,
            'hostel_id':      self.hostel_id,
            'hostel_name':    self.hostel.name if self.hostel else '',
            'student_id':     self.student_id,
            'student_name':   student.user.name if student and student.user else '',
            'room_id':        self.room_id,
            'room_number':    self.room.room_number if self.room else '',
            'category':       self.category,
            'title':          self.title,
            'description':    self.description,
            'priority':       self.priority,
            'status':         self.status,
            'attachment_url': self.attachment_url,
            'resolution':     self.resolution,
            'resolved_at':    self.resolved_at.isoformat() if self.resolved_at else None,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  OUT PASS & GATE PASS
# ═══════════════════════════════════════════════════════════════════════════

OUTPASS_TYPES = ['DAY_OUTING', 'NIGHT_STAY', 'HOME_LEAVE', 'EMERGENCY']
OUTPASS_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'OUT', 'RETURNED', 'OVERDUE']


class HostelOutPass(db.Model):
    """
    Hostel Out-Pass / Gate-Pass for day outings, night stays, and home leave.
    """
    __tablename__ = 'hostel_out_passes'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)
    room_id     = db.Column(db.Integer, db.ForeignKey('hostel_rooms.id'), nullable=True)

    pass_type   = db.Column(db.String(30), default='DAY_OUTING')  # DAY_OUTING / NIGHT_STAY / HOME_LEAVE / EMERGENCY
    reason      = db.Column(db.String(300), nullable=False)
    destination = db.Column(db.String(200), default='')
    guardian_contact = db.Column(db.String(30), default='')

    out_time        = db.Column(db.DateTime, nullable=False)
    expected_return = db.Column(db.DateTime, nullable=False)
    actual_return   = db.Column(db.DateTime, nullable=True)

    status      = db.Column(db.String(20), default='REQUESTED')  # REQUESTED / APPROVED / REJECTED / OUT / RETURNED / OVERDUE
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.String(300), default='')

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', foreign_keys=[student_id])
    hostel  = db.relationship('Hostel', foreign_keys=[hostel_id])

    def to_dict(self):
        student = self.student
        return {
            'id':               self.id,
            'school_id':        self.school_id,
            'hostel_id':        self.hostel_id,
            'hostel_name':      self.hostel.name if self.hostel else '',
            'student_id':       self.student_id,
            'student_name':     student.user.name if student and student.user else '',
            'pass_type':        self.pass_type,
            'reason':           self.reason,
            'destination':      self.destination,
            'guardian_contact': self.guardian_contact,
            'out_time':         self.out_time.isoformat() if self.out_time else None,
            'expected_return':  self.expected_return.isoformat() if self.expected_return else None,
            'actual_return':    self.actual_return.isoformat() if self.actual_return else None,
            'status':           self.status,
            'approved_at':      self.approved_at.isoformat() if self.approved_at else None,
            'rejection_reason': self.rejection_reason,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  VISITOR LOG
# ═══════════════════════════════════════════════════════════════════════════

class HostelVisitorLog(db.Model):
    """
    Hostel visitor gate entry register.
    """
    __tablename__ = 'hostel_visitor_logs'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    student_id  = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    visitor_name  = db.Column(db.String(120), nullable=False)
    visitor_phone = db.Column(db.String(30), nullable=False)
    relation      = db.Column(db.String(50), default='PARENT')  # FATHER / MOTHER / GUARDIAN / SIBLING / OTHER
    id_proof_type = db.Column(db.String(50), default='AADHAAR')
    id_proof_no   = db.Column(db.String(50), default='')

    visit_date    = db.Column(db.Date, default=date.today)
    in_time       = db.Column(db.DateTime, default=datetime.utcnow)
    out_time      = db.Column(db.DateTime, nullable=True)
    purpose       = db.Column(db.String(300), default='')

    recorded_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('Student', foreign_keys=[student_id])
    hostel  = db.relationship('Hostel', foreign_keys=[hostel_id])

    def to_dict(self):
        student = self.student
        return {
            'id':            self.id,
            'school_id':     self.school_id,
            'hostel_id':     self.hostel_id,
            'hostel_name':   self.hostel.name if self.hostel else '',
            'student_id':    self.student_id,
            'student_name':  student.user.name if student and student.user else '',
            'visitor_name':  self.visitor_name,
            'visitor_phone': self.visitor_phone,
            'relation':      self.relation,
            'id_proof_type': self.id_proof_type,
            'id_proof_no':   self.id_proof_no,
            'visit_date':    str(self.visit_date),
            'in_time':       self.in_time.isoformat() if self.in_time else None,
            'out_time':      self.out_time.isoformat() if self.out_time else None,
            'purpose':       self.purpose,
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  NIGHT ATTENDANCE / ROLL CALL
# ═══════════════════════════════════════════════════════════════════════════

ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'ON_LEAVE', 'OUT_PASS']


class HostelAttendance(db.Model):
    """
    Daily / Night Roll Call Attendance for active hostel residents.
    """
    __tablename__ = 'hostel_attendance'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id      = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    allocation_id  = db.Column(db.Integer, db.ForeignKey('hostel_bed_allocations.id'), nullable=False)
    student_id     = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False, index=True)

    attendance_date = db.Column(db.Date, nullable=False, default=date.today)
    status          = db.Column(db.String(20), default='PRESENT')  # PRESENT / ABSENT / ON_LEAVE / OUT_PASS
    remarks         = db.Column(db.String(200), default='')
    recorded_by     = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('hostel_id', 'student_id', 'attendance_date', name='uq_hostel_student_date_attendance'),
    )

    student = db.relationship('Student', foreign_keys=[student_id])

    def to_dict(self):
        student = self.student
        return {
            'id':              self.id,
            'school_id':       self.school_id,
            'hostel_id':       self.hostel_id,
            'allocation_id':   self.allocation_id,
            'student_id':      self.student_id,
            'student_name':    student.user.name if student and student.user else '',
            'attendance_date': str(self.attendance_date),
            'status':          self.status,
            'remarks':         self.remarks,
            'created_at':      self.created_at.isoformat() if self.created_at else None,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  ROOM ASSET & INVENTORY TRACKING
# ═══════════════════════════════════════════════════════════════════════════

INVENTORY_CATEGORIES = ['FURNITURE', 'ELECTRICAL', 'FIXTURE', 'BEDDING', 'OTHER']
INVENTORY_CONDITIONS = ['GOOD', 'DAMAGED', 'REPAIR_NEEDED', 'LOST']


class HostelInventory(db.Model):
    """
    Room asset and furniture inventory tracker.
    """
    __tablename__ = 'hostel_inventory'

    id          = db.Column(db.Integer, primary_key=True)
    school_id   = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    hostel_id   = db.Column(db.Integer, db.ForeignKey('hostels.id'), nullable=False, index=True)
    room_id     = db.Column(db.Integer, db.ForeignKey('hostel_rooms.id'), nullable=True)

    item_name   = db.Column(db.String(100), nullable=False)
    item_code   = db.Column(db.String(50), nullable=True)
    category    = db.Column(db.String(30), default='FURNITURE')
    quantity    = db.Column(db.Integer, default=1)
    condition   = db.Column(db.String(30), default='GOOD')  # GOOD / DAMAGED / REPAIR_NEEDED / LOST

    assigned_student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True)
    remarks             = db.Column(db.String(300), default='')
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    hostel  = db.relationship('Hostel', foreign_keys=[hostel_id])
    room    = db.relationship('HostelRoom', foreign_keys=[room_id])
    student = db.relationship('Student', foreign_keys=[assigned_student_id])

    def to_dict(self):
        return {
            'id':                  self.id,
            'school_id':           self.school_id,
            'hostel_id':           self.hostel_id,
            'hostel_name':         self.hostel.name if self.hostel else '',
            'room_id':             self.room_id,
            'room_number':         self.room.room_number if self.room else '',
            'item_name':           self.item_name,
            'item_code':           self.item_code or '',
            'category':            self.category,
            'quantity':            self.quantity,
            'condition':           self.condition,
            'assigned_student_id': self.assigned_student_id,
            'assigned_student_name': self.student.user.name if self.student and self.student.user else '',
            'remarks':             self.remarks or '',
            'created_at':          self.created_at.isoformat() if self.created_at else None,
        }

