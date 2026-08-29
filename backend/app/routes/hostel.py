from flask import Blueprint, request, jsonify, Response, send_file
from app import db
from app.models.user import User, UserRole
from app.models.academic import Student, Class

# NEW
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelWing, HostelRoom, HostelBed,
    HostelBedAllocation, HostelActivityLog, HostelSettings, log_hostel_activity,
    HostelFeeStructure, HostelFineRecord, FINE_REASONS,
    HostelComplaint, COMPLAINT_CATEGORIES, COMPLAINT_STATUSES,
    HostelOutPass, OUTPASS_TYPES, OUTPASS_STATUSES,
    HostelVisitorLog,
    HostelAttendance, ATTENDANCE_STATUSES,
    HostelInventory, INVENTORY_CATEGORIES, INVENTORY_CONDITIONS,
    HOSTEL_TYPES, HOSTEL_GENDERS, ROOM_TYPES, BED_STATUSES, TRANSFER_TYPES,
)
from app.models.financial import FeeRecord, FeeTransaction
from app.services.hostel_fee_service import (
    resolve_fee_structure, generate_hostel_fee_record,
    record_hostel_fee_payment, record_hostel_fine_payment,
    sync_hostel_fine_from_fee_record
)
from sqlalchemy import func
from app.utils.decorators import role_required, get_current_user
from datetime import date, datetime

hostel_bp = Blueprint('hostel', __name__)


def _school_id():
    return get_current_user().school_id

def _safe_float(value, default=0.0):
    """Empty string ya None ko bhi safely handle karta hai."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ═══════════════════════════════════════════════════════════════════════════
#  HOSTEL
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/hostels', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_hostels():
    sid = _school_id()
    hostels = Hostel.query.filter_by(school_id=sid).all()
    return jsonify([h.to_dict() for h in hostels]), 200


@hostel_bp.route('/hostels', methods=['POST'])
@role_required('PRINCIPAL')
def create_hostel():
    data = request.get_json() or {}
    sid  = _school_id()

    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name zaroori hai'}), 400

    h = Hostel(
        school_id      = sid,
        name           = data['name'].strip(),
        code           = (data.get('code') or '').strip() or None,
        hostel_type    = data.get('hostel_type', 'BOYS'),
        gender         = data.get('gender', 'MALE'),
        description    = data.get('description', ''),
        address        = data.get('address', ''),
        warden_id      = int(data['warden_id']) if data.get('warden_id') else None,
        contact_number = data.get('contact_number', ''),
        contact_email  = data.get('contact_email', ''),
        created_by     = get_current_user().id,
    )
    db.session.add(h)
    db.session.flush()
    log_hostel_activity(sid, get_current_user().id, 'HOSTEL_CREATED', f'Hostel: {h.name}')
    db.session.commit()
    return jsonify(h.to_dict()), 201


@hostel_bp.route('/hostels/<int:hostel_id>', methods=['PUT', 'PATCH'])
@role_required('PRINCIPAL')
def update_hostel(hostel_id):
    h = Hostel.query.get_or_404(hostel_id)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    for field in ['name', 'code', 'hostel_type', 'gender', 'description',
                  'address', 'contact_number', 'contact_email', 'status']:
        if field in data:
            setattr(h, field, data[field])
    if 'warden_id' in data:
        h.warden_id = int(data['warden_id']) if data['warden_id'] else None
    db.session.commit()
    return jsonify(h.to_dict()), 200


@hostel_bp.route('/hostels/<int:hostel_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_hostel(hostel_id):
    h = Hostel.query.get_or_404(hostel_id)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if h.counts()['occupied_beds'] > 0:
        return jsonify({'error': 'Occupied beds hain — pehle sab students vacate/transfer karo'}), 400
    db.session.delete(h)
    db.session.commit()
    return jsonify({'message': 'Hostel deleted'}), 200


@hostel_bp.route('/wardens', methods=['GET'])
@role_required('PRINCIPAL')
def list_wardens():
    """Users with role=HOSTEL — for the warden-assign dropdown."""
    sid = _school_id()
    users = User.query.filter_by(school_id=sid, role=UserRole.HOSTEL).all()
    return jsonify([{'id': u.id, 'name': u.name, 'email': u.email} for u in users]), 200


# ═══════════════════════════════════════════════════════════════════════════
#  BUILDING
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/hostels/<int:hostel_id>/buildings', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_buildings(hostel_id):
    h = Hostel.query.get_or_404(hostel_id)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify([b.to_dict() for b in h.buildings.all()]), 200


@hostel_bp.route('/hostels/<int:hostel_id>/buildings', methods=['POST'])
@role_required('PRINCIPAL')
def create_building(hostel_id):
    h = Hostel.query.get_or_404(hostel_id)
    sid = _school_id()
    if h.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name zaroori hai'}), 400
    b = HostelBuilding(
        hostel_id=hostel_id, school_id=sid,
        name=data['name'].strip(), code=data.get('code', ''),
        description=data.get('description', ''),
    )
    db.session.add(b)
    log_hostel_activity(sid, get_current_user().id, 'BUILDING_CREATED', f'{h.name} → {b.name}')
    db.session.commit()
    return jsonify(b.to_dict()), 201


@hostel_bp.route('/buildings/<int:building_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_building(building_id):
    b = HostelBuilding.query.get_or_404(building_id)
    if b.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    for field in ['name', 'code', 'description', 'status']:
        if field in data:
            setattr(b, field, data[field])
    db.session.commit()
    return jsonify(b.to_dict()), 200


@hostel_bp.route('/buildings/<int:building_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_building(building_id):
    b = HostelBuilding.query.get_or_404(building_id)
    if b.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if b.counts()['occupied_beds'] > 0:
        return jsonify({'error': 'Occupied beds hain — pehle vacate/transfer karo'}), 400
    db.session.delete(b)
    db.session.commit()
    return jsonify({'message': 'Building deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  FLOOR
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/buildings/<int:building_id>/floors', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_floors(building_id):
    b = HostelBuilding.query.get_or_404(building_id)
    if b.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    floors = b.floors.order_by(HostelFloor.floor_number).all()
    return jsonify([f.to_dict() for f in floors]), 200


@hostel_bp.route('/buildings/<int:building_id>/floors', methods=['POST'])
@role_required('PRINCIPAL')
def create_floor(building_id):
    b   = HostelBuilding.query.get_or_404(building_id)
    sid = _school_id()
    if b.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name zaroori hai'}), 400
    f = HostelFloor(
        building_id=building_id, school_id=sid,
        name=data['name'].strip(),
        floor_number=data.get('floor_number', 0),
        description=data.get('description', ''),
    )
    db.session.add(f)
    db.session.commit()
    return jsonify(f.to_dict()), 201

# NEW — paste right after create_room() function

@hostel_bp.route('/floors/<int:floor_id>/rooms/bulk', methods=['POST'])
@role_required('PRINCIPAL')
def create_rooms_bulk(floor_id):
    """
    Body: { count, start_number, room_type, is_ac, has_attached_bath,
            has_wifi, bed_count(only for CUSTOM) }
    Creates `count` rooms numbered start_number..start_number+count-1,
    auto-generating beds for each — same rule as single create_room.
    """
    f   = HostelFloor.query.get_or_404(floor_id)
    sid = _school_id()
    if f.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data  = request.get_json() or {}
    count = int(data.get('count', 0))
    start_number = data.get('start_number')
    if count <= 0 or start_number is None:
        return jsonify({'error': 'count aur start_number zaroori hai'}), 400

    room_type = data.get('room_type', 'DOUBLE')
    bed_count = ROOM_TYPE_BED_COUNT.get(room_type) or int(data.get('bed_count', 2))

    created_count = 0
    skipped_room_numbers = []

    for i in range(count):
        room_number = str(int(start_number) + i)
        if HostelRoom.query.filter_by(floor_id=floor_id, room_number=room_number).first():
            skipped_room_numbers.append(room_number)
            continue

        room = HostelRoom(
            floor_id=floor_id, school_id=sid,
            room_number=room_number, room_type=room_type,
            is_ac=bool(data.get('is_ac', False)),
            has_attached_bath=bool(data.get('has_attached_bath', False)),
            has_wifi=bool(data.get('has_wifi', False)),
        )
        db.session.add(room)
        db.session.flush()

        for label in [chr(65 + j) for j in range(bed_count)]:
            db.session.add(HostelBed(room_id=room.id, school_id=sid, bed_number=label))
        created_count += 1

    log_hostel_activity(sid, get_current_user().id, 'ROOMS_BULK_CREATED',
                         f'Floor #{floor_id} → {created_count} rooms')
    db.session.commit()

    return jsonify({
        'created_count': created_count,
        'skipped_room_numbers': skipped_room_numbers,
    }), 201
# NEW — paste right after create_floor() function

@hostel_bp.route('/buildings/<int:building_id>/floors/bulk', methods=['POST'])
@role_required('PRINCIPAL')
def create_floors_bulk(building_id):
    """Body: { floors: [{name, floor_number}, ...] } — used by BulkFloorForm."""
    b   = HostelBuilding.query.get_or_404(building_id)
    sid = _school_id()
    if b.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    floors_list = data.get('floors', [])
    if not floors_list:
        return jsonify({'error': 'floors list zaroori hai'}), 400

    created = []
    for item in floors_list:
        name = (item.get('name') or '').strip()
        if not name:
            continue
        if HostelFloor.query.filter_by(building_id=building_id, name=name).first():
            continue  # duplicate floor name — skip silently
        f = HostelFloor(
            building_id=building_id, school_id=sid,
            name=name, floor_number=item.get('floor_number', 0),
        )
        db.session.add(f)
        created.append(f)

    db.session.flush()
    result = [f.to_dict() for f in created]
    log_hostel_activity(sid, get_current_user().id, 'FLOORS_BULK_CREATED',
                         f'{b.name} → {len(created)} floors')
    db.session.commit()
    return jsonify(result), 201

@hostel_bp.route('/floors/<int:floor_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_floor(floor_id):
    f = HostelFloor.query.get_or_404(floor_id)
    if f.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    for field in ['name', 'floor_number', 'description']:
        if field in data:
            setattr(f, field, data[field])
    db.session.commit()
    return jsonify(f.to_dict()), 200


@hostel_bp.route('/floors/<int:floor_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_floor(floor_id):
    f = HostelFloor.query.get_or_404(floor_id)
    if f.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(f)
    db.session.commit()
    return jsonify({'message': 'Floor deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  WING (optional layer)
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/floors/<int:floor_id>/wings', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_wings(floor_id):
    f = HostelFloor.query.get_or_404(floor_id)
    if f.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify([w.to_dict() for w in f.wings.all()]), 200


@hostel_bp.route('/floors/<int:floor_id>/wings', methods=['POST'])
@role_required('PRINCIPAL')
def create_wing(floor_id):
    f   = HostelFloor.query.get_or_404(floor_id)
    sid = _school_id()
    if f.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name zaroori hai'}), 400
    w = HostelWing(floor_id=floor_id, school_id=sid,
                    name=data['name'].strip(), description=data.get('description', ''))
    db.session.add(w)
    db.session.commit()
    return jsonify(w.to_dict()), 201


@hostel_bp.route('/wings/<int:wing_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_wing(wing_id):
    w = HostelWing.query.get_or_404(wing_id)
    if w.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(w)
    db.session.commit()
    return jsonify({'message': 'Wing deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ROOM  (+ auto-generate beds)
# ═══════════════════════════════════════════════════════════════════════════

ROOM_TYPE_BED_COUNT = {
    'SINGLE': 1, 'DOUBLE': 2, 'TRIPLE': 3,
    'FOUR_SHARING': 4, 'SIX_SHARING': 6, 'CUSTOM': None,
}


@hostel_bp.route('/floors/<int:floor_id>/rooms', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_rooms(floor_id):
    f = HostelFloor.query.get_or_404(floor_id)
    if f.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    wing_id = request.args.get('wing_id')
    q = f.rooms
    if wing_id:
        q = q.filter_by(wing_id=wing_id)
    return jsonify([r.to_dict() for r in q.all()]), 200


@hostel_bp.route('/floors/<int:floor_id>/rooms', methods=['POST'])
@role_required('PRINCIPAL')
def create_room(floor_id):
    """
    Creating a room also auto-generates its beds (Bed A, Bed B, ...)
    based on room_type — matches ROOM_TYPE_BED_COUNT. For CUSTOM type,
    pass bed_count explicitly.
    """
    f   = HostelFloor.query.get_or_404(floor_id)
    sid = _school_id()
    if f.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    if not (data.get('room_number') or '').strip():
        return jsonify({'error': 'room_number zaroori hai'}), 400

    existing = HostelRoom.query.filter_by(floor_id=floor_id, room_number=data['room_number']).first()
    if existing:
        return jsonify({'error': 'Is floor pe ye room number already hai'}), 409

    room_type = data.get('room_type', 'DOUBLE')
    bed_count = ROOM_TYPE_BED_COUNT.get(room_type) or int(data.get('bed_count', 2))

    room = HostelRoom(
        floor_id=floor_id, wing_id=data.get('wing_id'), school_id=sid,
        room_number=data['room_number'].strip(),
        room_name=data.get('room_name', ''),
        room_type=room_type,
        is_ac=bool(data.get('is_ac', False)),
        has_attached_bath=bool(data.get('has_attached_bath', False)),
        has_study_table=bool(data.get('has_study_table', True)),
        has_cupboard=bool(data.get('has_cupboard', True)),
        has_balcony=bool(data.get('has_balcony', False)),
        has_wifi=bool(data.get('has_wifi', False)),
        description=data.get('description', ''),
    )
    db.session.add(room)
    db.session.flush()

    bed_labels = [chr(65 + i) for i in range(bed_count)]  # A, B, C, D...
    for label in bed_labels:
        db.session.add(HostelBed(room_id=room.id, school_id=sid, bed_number=label))

    log_hostel_activity(sid, get_current_user().id, 'ROOM_CREATED',
                         f'Room {room.room_number} with {bed_count} beds')
    db.session.commit()
    return jsonify(room.to_dict()), 201


@hostel_bp.route('/rooms/<int:room_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_room(room_id):
    r = HostelRoom.query.get_or_404(room_id)
    if r.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    for field in ['room_number', 'room_name', 'room_type', 'description', 'status',
                  'is_ac', 'has_attached_bath', 'has_study_table', 'has_cupboard',
                  'has_balcony', 'has_wifi', 'wing_id']:
        if field in data:
            setattr(r, field, data[field])
    db.session.commit()
    return jsonify(r.to_dict()), 200


@hostel_bp.route('/rooms/<int:room_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_room(room_id):
    r = HostelRoom.query.get_or_404(room_id)
    if r.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if r.counts()['occupied'] > 0:
        return jsonify({'error': 'Room mein students hain — pehle vacate/transfer karo'}), 400
    db.session.delete(r)
    db.session.commit()
    return jsonify({'message': 'Room deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  BED (manual add/remove — auto-created ones can also be adjusted)
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/rooms/<int:room_id>/beds', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_beds(room_id):
    r = HostelRoom.query.get_or_404(room_id)
    if r.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify([b.to_dict() for b in r.beds.all()]), 200


@hostel_bp.route('/rooms/<int:room_id>/beds', methods=['POST'])
@role_required('PRINCIPAL')
def add_bed(room_id):
    r   = HostelRoom.query.get_or_404(room_id)
    sid = _school_id()
    if r.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    bed_number = (data.get('bed_number') or '').strip()
    if not bed_number:
        return jsonify({'error': 'bed_number zaroori hai'}), 400
    if HostelBed.query.filter_by(room_id=room_id, bed_number=bed_number).first():
        return jsonify({'error': 'Ye bed number is room mein already hai'}), 409
    bed = HostelBed(room_id=room_id, school_id=sid, bed_number=bed_number)
    db.session.add(bed)
    db.session.commit()
    return jsonify(bed.to_dict()), 201


@hostel_bp.route('/beds/<int:bed_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'HOSTEL')
def update_bed(bed_id):
    """Mainly used to mark bed as MAINTENANCE/BLOCKED/VACANT manually (not for allocation)."""
    b = HostelBed.query.get_or_404(bed_id)
    if b.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status:
        if new_status == 'OCCUPIED':
            return jsonify({'error': 'OCCUPIED status admission flow se hi set hota hai'}), 400
        if b.status == 'OCCUPIED' and new_status != 'OCCUPIED':
            return jsonify({'error': 'Occupied bed pehle vacate karo (Admission → Vacate)'}), 400
        b.status = new_status
    if 'condition_note' in data:
        b.condition_note = data['condition_note']
    db.session.commit()
    return jsonify(b.to_dict()), 200


@hostel_bp.route('/beds/<int:bed_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_bed(bed_id):
    b = HostelBed.query.get_or_404(bed_id)
    if b.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if b.status == 'OCCUPIED':
        return jsonify({'error': 'Occupied bed delete nahi ho sakta'}), 400
    db.session.delete(b)
    db.session.commit()
    return jsonify({'message': 'Bed deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ROOM MAP — graphical Building → Floor → Room → Beds view
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/hostels/<int:hostel_id>/room-map', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def room_map(hostel_id):
    h = Hostel.query.get_or_404(hostel_id)
    if h.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    result = []
    for building in h.buildings.all():
        b_out = {'id': building.id, 'name': building.name, 'floors': []}
        for floor in building.floors.order_by(HostelFloor.floor_number).all():
            f_out = {'id': floor.id, 'name': floor.name, 'rooms': []}
            for room in floor.rooms.all():
                beds_out = []
                for bed in room.beds.all():
                    active_alloc = None
                    if bed.status == 'OCCUPIED':
                        active_alloc = HostelBedAllocation.query.filter_by(
                            bed_id=bed.id, status='ACTIVE'
                        ).first()
                    beds_out.append({
                        'id': bed.id, 'bed_number': bed.bed_number, 'status': bed.status,
                        'student_id': bed.current_student_id,
                        'student_name': bed.current_student.user.name
                                         if bed.current_student and bed.current_student.user else None,
                        'allocation_id': active_alloc.id if active_alloc else None,
                    })
                f_out['rooms'].append({
                    'id': room.id, 'room_number': room.room_number,
                    'room_type': room.room_type, 'beds': beds_out,
                })
            b_out['floors'].append(f_out)
        result.append(b_out)

    return jsonify(result), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ADMISSION — search eligible students / quick-create / allocate bed
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/students/search-eligible', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def search_eligible_students():
    """
    Students of this school who do NOT currently have an ACTIVE hostel
    allocation — used by the "Select Existing Student" tab on Admission page.
    Query: search (name/roll/admission_no), class_id, gender
    """
    sid    = _school_id()
    search = (request.args.get('search') or '').strip()
    class_id = request.args.get('class_id')
    gender   = request.args.get('gender')  # optional filter matching hostel gender

    active_student_ids = {
        r.student_id for r in HostelBedAllocation.query.filter_by(
            school_id=sid, status='ACTIVE'
        ).with_entities(HostelBedAllocation.student_id).all()
    }

    q = Student.query.filter_by(school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    if gender:
        q = q.filter_by(gender=gender)
    if search:
        q = q.join(User, Student.user_id == User.id).filter(db.or_(
            User.name.ilike(f'%{search}%'),
            Student.roll_number.ilike(f'%{search}%'),
            Student.admission_no.ilike(f'%{search}%'),
        ))

    students = q.limit(50).all()
    result = []
    for s in students:
        if s.id in active_student_ids:
            continue
        cls = Class.query.get(s.class_id) if s.class_id else None
        result.append({
            'student_id':   s.id,
            'name':         s.user.name if s.user else '',
            'roll_number':  s.roll_number or '',
            'admission_no': s.admission_no or '',
            'gender':       s.gender or '',
            'class_name':   f"{cls.name} - {cls.section}" if cls else '',
            'parent_phone': s.parent_phone or '',
        })
    return jsonify(result), 200


@hostel_bp.route('/students/quick-create', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def quick_create_student_for_hostel():
    """
    "Enroll New Student" tab — creates a fresh Student (same logic as
    principal_bp.create_student) and returns student_id, ready to be
    passed straight into /hostel/admission in the same UI flow.
    """
    from app.utils.plan_limits import get_limit, get_school_plan

    data = request.get_json() or {}
    sid  = _school_id()

    plan  = get_school_plan(sid)
    limit = get_limit(plan, 'students')
    current_count = Student.query.filter_by(school_id=sid).count()
    if current_count >= limit:
        return jsonify({
            'error': 'student_limit_reached',
            'message': f'Aapke {plan} plan mein sirf {limit} students allowed hain.',
            'current': current_count, 'limit': limit, 'plan': plan,
        }), 403

    if not (data.get('name') or '').strip():
        return jsonify({'error': 'name zaroori hai'}), 400
    if not (data.get('email') or '').strip():
        return jsonify({'error': 'email zaroori hai'}), 400
    if User.query.filter_by(email=data['email'].lower()).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(name=data['name'], email=data['email'].lower(),
                role=UserRole.STUDENT, school_id=sid)
    user.set_password(data.get('password', 'Student@123'), store_plain=True)
    db.session.add(user)
    db.session.flush()

    student = Student(
        user_id=user.id, school_id=sid,
        class_id=data.get('class_id'),
        roll_number=data.get('roll_number'),
        admission_no=data.get('admission_no'),
        parent_name=data.get('parent_name'),
        parent_phone=data.get('parent_phone'),
        parent_email=data.get('parent_email'),
        father_name=data.get('father_name'),
        mother_name=data.get('mother_name'),
        gender=data.get('gender'),
        dob=date.fromisoformat(data['dob']) if data.get('dob') else None,
        address=data.get('address'),
        session=data.get('session', '2024-25'),
    )
    db.session.add(student)
    db.session.commit()
    return jsonify(student.to_dict()), 201


@hostel_bp.route('/admission', methods=['POST'])
@hostel_bp.route('/admissions', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def create_admission():
    """
    Body: { student_id, hostel_id, building_id, floor_id, room_id, bed_id }
    Validates: gender match, bed vacant, student not already active elsewhere.
    """
    sid  = _school_id()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    bed_id     = data.get('bed_id')
    if not student_id or not bed_id:
        return jsonify({'error': 'student_id aur bed_id zaroori hai'}), 400

    student = Student.query.get_or_404(student_id)
    if student.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    already_active = HostelBedAllocation.query.filter_by(
        student_id=student_id, status='ACTIVE'
    ).first()
    if already_active:
        return jsonify({'error': 'Student already ek hostel mein allocated hai. Transfer use karo.'}), 409

    bed = HostelBed.query.get_or_404(bed_id)
    if bed.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if bed.status != 'VACANT':
        return jsonify({'error': f'Bed {bed.bed_number} currently {bed.status} hai'}), 409

    room     = HostelRoom.query.get(bed.room_id)
    floor    = HostelFloor.query.get(room.floor_id)
    building = HostelBuilding.query.get(floor.building_id)
    hostel   = Hostel.query.get(building.hostel_id)

    # Gender validation — skip for CO_ED hostels
    if hostel.gender != 'CO_ED' and student.gender and student.gender.upper() != hostel.gender:
        return jsonify({
            'error': f'Gender mismatch: {hostel.name} sirf {hostel.gender} students ke liye hai'
        }), 400

    today = date.today()
    allocation = HostelBedAllocation(
        school_id=sid, student_id=student_id,
        hostel_id=hostel.id, building_id=building.id, floor_id=floor.id,
        room_id=room.id, bed_id=bed.id,
        admission_date=today, status='ACTIVE',
        allocated_by=get_current_user().id,
    )
    db.session.add(allocation)

    bed.status = 'OCCUPIED'
    bed.current_student_id = student_id
    bed.allocation_date = today

    # NEW
    log_hostel_activity(sid, get_current_user().id, 'STUDENT_ALLOCATED',
                         f'{student.user.name if student.user else student_id} → {hostel.name}/{room.room_number}/{bed.bed_number}')

    db.session.flush()   # allocation.id chahiye fee record link karne ke liye
    fee_record, fee_reason = generate_hostel_fee_record(allocation, get_current_user().id)

    db.session.commit()

    return jsonify({
        'message':     'Hostel admission successful',
        'allocation':  allocation.to_dict(),
        'bed':         bed.to_dict(),
        'fee_record':  fee_record.to_dict() if fee_record else None,
        'fee_warning': 'Koi fee structure define nahi hai is room type ke liye — fee manually generate karo'
                       if fee_reason == 'no_fee_structure' else None,
    }), 201


@hostel_bp.route('/admission/<int:allocation_id>/vacate', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def vacate_bed(allocation_id):
    alloc = HostelBedAllocation.query.get_or_404(allocation_id)
    if alloc.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    if alloc.status != 'ACTIVE':
        return jsonify({'error': 'Ye allocation already closed hai'}), 400

    data = request.get_json() or {}
    alloc.status = 'VACATED'
    alloc.vacate_date = date.today()
    alloc.transfer_reason = data.get('reason', '')

    bed = HostelBed.query.get(alloc.bed_id)
    bed.status = 'VACANT'
    bed.current_student_id = None
    bed.allocation_date = None

    log_hostel_activity(_school_id(), get_current_user().id, 'VACATED',
                         f'Allocation #{alloc.id} vacated')
    db.session.commit()
    return jsonify({'message': 'Bed vacated', 'allocation': alloc.to_dict()}), 200


@hostel_bp.route('/admission/<int:allocation_id>/transfer', methods=['POST'])
@hostel_bp.route('/transfers', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def transfer_student(allocation_id=None):
    """
    Body: { allocation_id (optional if in URL), new_bed_id, transfer_type, reason }
    Closes current allocation (status=TRANSFERRED), opens new one on new bed.
    """
    data = request.get_json() or {}
    if allocation_id is None:
        allocation_id = data.get('allocation_id')
    if not allocation_id:
        return jsonify({'error': 'allocation_id is required'}), 400

    old = HostelBedAllocation.query.get_or_404(allocation_id)
    sid = _school_id()
    if old.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if old.status != 'ACTIVE':
        return jsonify({'error': 'Ye allocation already closed hai'}), 400

    data = request.get_json() or {}
    new_bed_id = data.get('new_bed_id')
    if not new_bed_id:
        return jsonify({'error': 'new_bed_id zaroori hai'}), 400

    new_bed = HostelBed.query.get_or_404(new_bed_id)
    if new_bed.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if new_bed.status != 'VACANT':
        return jsonify({'error': f'Naya bed {new_bed.bed_number} vacant nahi hai'}), 409

    # Close old
    old.status = 'TRANSFERRED'
    old.vacate_date = date.today()
    old.transfer_type = data.get('transfer_type', 'BED')
    old.transfer_reason = data.get('reason', '')

    old_bed = HostelBed.query.get(old.bed_id)
    old_bed.status = 'VACANT'
    old_bed.current_student_id = None
    old_bed.allocation_date = None

    # Open new
    room     = HostelRoom.query.get(new_bed.room_id)
    floor    = HostelFloor.query.get(room.floor_id)
    building = HostelBuilding.query.get(floor.building_id)
    hostel   = Hostel.query.get(building.hostel_id)

    new_alloc = HostelBedAllocation(
        school_id=sid, student_id=old.student_id,
        hostel_id=hostel.id, building_id=building.id, floor_id=floor.id,
        room_id=room.id, bed_id=new_bed.id,
        admission_date=date.today(), status='ACTIVE',
        allocated_by=get_current_user().id,
    )
    db.session.add(new_alloc)

    # NEW
    new_bed.status = 'OCCUPIED'
    new_bed.current_student_id = old.student_id
    new_bed.allocation_date = date.today()

    log_hostel_activity(sid, get_current_user().id, 'TRANSFERRED',
                         f'Student #{old.student_id}: {old_bed.bed_number} → {new_bed.bed_number}')

    db.session.flush()   # new_alloc.id chahiye

    # ── Fee auto-adjust agar room category (AC/Non-AC ya sharing type) badla ──
    old_fs = resolve_fee_structure(old_bed)
    new_fs = resolve_fee_structure(new_bed)
    fee_adjusted = False
    if new_fs and (not old_fs or new_fs.id != old_fs.id):
        current_month = date.today().strftime('%Y-%m')
        pending_rec = FeeRecord.query.filter_by(
            student_id=old.student_id, month=current_month,
            fee_type='HOSTEL', source='HOSTEL', status='PENDING',
        ).first()
        if pending_rec:
            pending_rec.amount_due = new_fs.total_monthly()
            pending_rec.remarks = (pending_rec.remarks or '') + \
                f' [Transfer ke baad adjusted → {new_fs.sharing_type} / {"AC" if new_fs.is_ac else "Non-AC"}]'
            pending_rec.source_ref_id = new_alloc.id
        else:
            generate_hostel_fee_record(new_alloc, get_current_user().id, month=current_month)
        fee_adjusted = True

    db.session.commit()

    return jsonify({
        'message':      'Transfer successful',
        'old_allocation': old.to_dict(),
        'new_allocation': new_alloc.to_dict(),
        'fee_adjusted':   fee_adjusted,
    }), 201


@hostel_bp.route('/students/<int:student_id>/hostel-status', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL', 'TEACHER')
def student_hostel_status(student_id):
    """Current + history — used on Student Profile page and Admission search results."""
    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    active = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
    history = HostelBedAllocation.query.filter_by(student_id=student_id)\
                .order_by(HostelBedAllocation.created_at.desc()).all()

    current_dict = None
    if active:
        current_dict = active.to_dict()
        fee_rec = FeeRecord.query.filter_by(
            student_id=student_id, fee_type='HOSTEL', source='HOSTEL'
        ).order_by(FeeRecord.created_at.desc()).first()
        current_dict['fee_amount_due'] = fee_rec.amount_due if fee_rec else None
        current_dict['fee_status']     = fee_rec.status if fee_rec else None

    return jsonify({
        'current': current_dict,
        'history': [a.to_dict() for a in history],
    }), 200

# ═══════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/dashboard', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def hostel_dashboard():
    sid   = _school_id()
    today = date.today()

    total_hostels   = Hostel.query.filter_by(school_id=sid).count()
    total_buildings = HostelBuilding.query.filter_by(school_id=sid).count()
    total_rooms     = HostelRoom.query.filter_by(school_id=sid).count()

    all_beds = HostelBed.query.filter_by(school_id=sid).all()
    total_beds = len(all_beds)
    occupied   = sum(1 for b in all_beds if b.status == 'OCCUPIED')
    vacant     = sum(1 for b in all_beds if b.status == 'VACANT')
    reserved   = sum(1 for b in all_beds if b.status == 'RESERVED')
    maintenance= sum(1 for b in all_beds if b.status == 'MAINTENANCE')

    hostel_students = HostelBedAllocation.query.filter_by(school_id=sid, status='ACTIVE').count()

    todays_admissions = HostelBedAllocation.query.filter_by(
        school_id=sid, admission_date=today, status='ACTIVE'
    ).count()
    todays_transfers = HostelBedAllocation.query.filter_by(
        school_id=sid, admission_date=today
    ).filter(HostelBedAllocation.transfer_type.isnot(None)).count()
    todays_vacate = HostelBedAllocation.query.filter_by(
        school_id=sid, vacate_date=today, status='VACATED'
    ).count()

    # Per-hostel occupancy breakdown for chart
    hostels = Hostel.query.filter_by(school_id=sid).all()
    hostel_breakdown = [
        {
            'id':   h.id,
            'name': h.name,
            **h.counts(),
        }
        for h in hostels
    ]

    # NEW
    hostel_fee_due  = db.session.query(func.sum(FeeRecord.amount_due)).filter_by(
        school_id=sid, fee_type='HOSTEL', source='HOSTEL').scalar() or 0
    hostel_fee_paid = db.session.query(func.sum(FeeRecord.amount_paid)).filter_by(
        school_id=sid, fee_type='HOSTEL', source='HOSTEL').scalar() or 0

    return jsonify({
        'total_hostels':    total_hostels,
        'total_buildings':  total_buildings,
        'total_rooms':      total_rooms,
        'total_beds':       total_beds,
        'occupied_beds':    occupied,
        'vacant_beds':      vacant,
        'reserved_beds':    reserved,
        'maintenance_beds': maintenance,
        'hostel_students':  hostel_students,
        'todays_admissions':todays_admissions,
        'todays_transfers': todays_transfers,
        'todays_vacate':    todays_vacate,
        'occupancy_pct':    round(occupied / total_beds * 100, 1) if total_beds else 0,
        'hostel_breakdown': hostel_breakdown,
        'hostel_fee_collected': hostel_fee_paid,
        'hostel_fee_pending':   hostel_fee_due - hostel_fee_paid,
        'students_fee_paid':    FeeRecord.query.filter_by(
            school_id=sid, fee_type='HOSTEL', source='HOSTEL', status='PAID').count(),
        'students_fee_pending': FeeRecord.query.filter(
            FeeRecord.school_id == sid, FeeRecord.fee_type == 'HOSTEL',
            FeeRecord.source == 'HOSTEL', FeeRecord.status.in_(['PENDING', 'PARTIAL']),
        ).count(),
    }), 200


@hostel_bp.route('/warden-dashboard', methods=['GET'])
@role_required('HOSTEL')
def warden_dashboard():
    """
    Warden sees only their assigned hostel(s).
    Matches Hostel.warden_id == current logged-in user.
    """
    user = get_current_user()
    sid  = _school_id()

    my_hostels = Hostel.query.filter_by(school_id=sid, warden_id=user.id).all()
    if not my_hostels:
        return jsonify({'error': 'Koi hostel assign nahi hai aapko'}), 404

    hostel_ids = [h.id for h in my_hostels]
    today = date.today()

    beds = HostelBed.query.join(HostelRoom).join(HostelFloor).join(HostelBuilding)\
             .filter(HostelBuilding.hostel_id.in_(hostel_ids)).all()
    total    = len(beds)
    occupied = sum(1 for b in beds if b.status == 'OCCUPIED')

    active_students = HostelBedAllocation.query.filter(
        HostelBedAllocation.hostel_id.in_(hostel_ids),
        HostelBedAllocation.status == 'ACTIVE',
    ).count()

    return jsonify({
        'hostels':        [h.to_dict() for h in my_hostels],
        'total_beds':     total,
        'occupied_beds':  occupied,
        'vacant_beds':    total - occupied,
        'occupancy_pct':  round(occupied / total * 100, 1) if total else 0,
        'active_students':active_students,
        # Leave/Visitors/Complaints/Attendance cards will populate once
        # those modules (Phase 3) exist — placeholders for now:
        'leave_requests_pending': 0,
        'visitors_today':         0,
        'complaints_open':        0,
        'attendance_marked_today': False,
    }), 200


# NEW — append at end of app/routes/hostel.py

# ═══════════════════════════════════════════════════════════════════════════
#  HOSTEL FEE STRUCTURE
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/fee-structures', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_fee_structures():
    sid = _school_id()
    hostel_id = request.args.get('hostel_id')
    q = HostelFeeStructure.query.filter_by(school_id=sid)
    if hostel_id:
        q = q.filter_by(hostel_id=hostel_id)
    return jsonify([f.to_dict() for f in q.order_by(HostelFeeStructure.created_at.desc()).all()]), 200


@hostel_bp.route('/fee-structures', methods=['POST'])
@role_required('PRINCIPAL')
def create_fee_structure():
    """
    Body: { hostel_id, building_id, floor_id, is_ac, sharing_type,
            monthly_fee, quarterly_fee, yearly_fee, security_deposit,
            electricity_charges, laundry_charges, mess_charges,
            maintenance_charges, late_fine, discount }
    """
    sid  = _school_id()
    data = request.get_json() or {}

    hostel_id = data.get('hostel_id')
    sharing_type = data.get('sharing_type')
    if not hostel_id or not sharing_type:
        return jsonify({'error': 'hostel_id aur sharing_type zaroori hai'}), 400

    h = Hostel.query.get_or_404(hostel_id)
    if h.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    building_id = data.get('building_id') or None
    floor_id    = data.get('floor_id') or None
    is_ac       = bool(data.get('is_ac', False))

    existing = HostelFeeStructure.query.filter_by(
        hostel_id=hostel_id, building_id=building_id, floor_id=floor_id,
        is_ac=is_ac, sharing_type=sharing_type,
    ).first()
    if existing:
        return jsonify({'error': 'Is exact combination ke liye fee structure already bani hui hai — usko edit karo'}), 409

    fs = HostelFeeStructure(
        school_id=sid, hostel_id=hostel_id, building_id=building_id, floor_id=floor_id,
        is_ac=is_ac, sharing_type=sharing_type,
        monthly_fee=_safe_float(data.get('monthly_fee')),
        quarterly_fee=_safe_float(data.get('quarterly_fee')),
        yearly_fee=_safe_float(data.get('yearly_fee')),
        security_deposit=_safe_float(data.get('security_deposit')),
        electricity_charges=_safe_float(data.get('electricity_charges')),
        laundry_charges=_safe_float(data.get('laundry_charges')),
        mess_charges=_safe_float(data.get('mess_charges')),
        maintenance_charges=_safe_float(data.get('maintenance_charges')),
        late_fine=_safe_float(data.get('late_fine')),
        discount=_safe_float(data.get('discount')),
        created_by=get_current_user().id,
    )
    db.session.add(fs)
    log_hostel_activity(sid, get_current_user().id, 'FEE_STRUCTURE_CREATED',
                         f'{h.name} — {sharing_type} / {"AC" if is_ac else "Non-AC"} → ₹{fs.total_monthly()}/mo')
    db.session.commit()
    return jsonify(fs.to_dict()), 201


@hostel_bp.route('/fee-structures/<int:fs_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_fee_structure(fs_id):
    fs = HostelFeeStructure.query.get_or_404(fs_id)
    if fs.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json() or {}
    numeric_fields = ['monthly_fee', 'quarterly_fee', 'yearly_fee', 'security_deposit',
                       'electricity_charges', 'laundry_charges', 'mess_charges',
                       'maintenance_charges', 'late_fine', 'discount']
    for f in numeric_fields:
        if f in data:
            setattr(fs, f, _safe_float(data[f]))
    if 'status' in data:
        fs.status = data['status']
    db.session.commit()
    return jsonify(fs.to_dict()), 200


@hostel_bp.route('/fee-structures/<int:fs_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_fee_structure(fs_id):
    fs = HostelFeeStructure.query.get_or_404(fs_id)
    if fs.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(fs)
    db.session.commit()
    return jsonify({'message': 'Fee structure deleted'}), 200


@hostel_bp.route('/fees/generate-monthly', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def generate_monthly_hostel_fees():
    """
    Bulk-generate this/next month's hostel fee for every ACTIVE allocation —
    same intent as principal.generate_fees() but hostel-scoped and structure-driven
    (no amount input needed — resolve_fee_structure decides it per student).
    Body: { month: "2026-08" }  (optional — defaults to current month)
    """
    sid   = _school_id()
    data  = request.get_json() or {}
    month = data.get('month') or date.today().strftime('%Y-%m')

    allocations = HostelBedAllocation.query.filter_by(school_id=sid, status='ACTIVE').all()
    created, skipped, no_structure = 0, 0, 0

    for alloc in allocations:
        rec, reason = generate_hostel_fee_record(alloc, get_current_user().id, month=month)
        if reason == 'created':
            created += 1
        elif reason == 'already_exists':
            skipped += 1
        else:
            no_structure += 1

    db.session.commit()
    return jsonify({
        'message':      f'{created} hostel fee records generated for {month}',
        'created':      created,
        'skipped':      skipped,
        'no_structure': no_structure,
    }), 201
# NEW — append at end of file

@hostel_bp.route('/rooms/<int:room_id>/detail', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def room_detail(room_id):
    """Full room detail: hostel/building/floor path + all beds + occupancy — used by HostelRoomDetail.jsx"""
    r = HostelRoom.query.get_or_404(room_id)
    if r.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    floor    = r.floor
    building = floor.building if floor else None
    hostel   = building.hostel if building else None

    beds_out = []
    for bed in r.beds.all():
        active_alloc = None
        if bed.status == 'OCCUPIED':
            active_alloc = HostelBedAllocation.query.filter_by(bed_id=bed.id, status='ACTIVE').first()
        beds_out.append({
            'id':             bed.id,
            'bed_number':     bed.bed_number,
            'status':         bed.status,
            'student_id':     bed.current_student_id,
            'student_name':   bed.current_student.user.name
                               if bed.current_student and bed.current_student.user else None,
            'allocation_id':  active_alloc.id if active_alloc else None,
            'allocation_date':str(bed.allocation_date) if bed.allocation_date else None,
        })

    counts = r.counts()

    return jsonify({
        'id':            r.id,
        'room_number':   r.room_number,
        'room_type':     r.room_type,
        'is_ac':         r.is_ac,
        'status':        r.status,
        'capacity':      counts['capacity'],
        'occupied':      counts['occupied'],
        'available':     counts['available_beds'],
        'hostel_id':     hostel.id   if hostel   else None,
        'hostel_name':   hostel.name if hostel   else '',
        'building_id':   building.id if building else None,
        'building_name': building.name if building else '',
        'floor_id':      floor.id    if floor    else None,
        'floor_name':    floor.name  if floor    else '',
        'beds':          beds_out,
    }), 200



# NEW — append at end of file

# ═══════════════════════════════════════════════════════════════════════════
#  REPORTS
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/reports/occupancy', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def report_occupancy():
    """Hostel/Building-wise occupancy + room type / AC / gender distribution."""
    sid = _school_id()
    hostel_id = request.args.get('hostel_id')

    q = Hostel.query.filter_by(school_id=sid)
    if hostel_id:
        q = q.filter_by(id=hostel_id)
    hostels = q.all()

    hostel_rows   = []
    building_rows = []
    room_type_dist = {}
    ac_dist = {'AC': 0, 'Non-AC': 0}
    gender_dist = {}

    for h in hostels:
        counts = h.counts()
        hostel_rows.append({'id': h.id, 'name': h.name, 'gender': h.gender, **counts})
        gender_dist[h.gender] = gender_dist.get(h.gender, 0) + counts['total_beds']

        for b in h.buildings.all():
            b_counts = b.counts()
            building_rows.append({'id': b.id, 'hostel_name': h.name, 'name': b.name, **b_counts})

    hostel_ids = [h.id for h in hostels]
    if hostel_ids:
        rooms = HostelRoom.query.join(HostelFloor).join(HostelBuilding)\
                  .filter(HostelBuilding.hostel_id.in_(hostel_ids)).all()
        for r in rooms:
            room_type_dist[r.room_type] = room_type_dist.get(r.room_type, 0) + 1
            ac_dist['AC' if r.is_ac else 'Non-AC'] += 1

    return jsonify({
        'hostel_breakdown':       hostel_rows,
        'building_breakdown':     building_rows,
        'room_type_distribution': room_type_dist,
        'ac_distribution':        ac_dist,
        'gender_distribution':    gender_dist,
    }), 200


@hostel_bp.route('/reports/fee-collection', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def report_fee_collection():
    """Hostel fee collection summary + record list. Query: from_date, to_date, status"""
    sid = _school_id()
    from_date = request.args.get('from_date')
    to_date   = request.args.get('to_date')
    status    = request.args.get('status')

    q = FeeRecord.query.filter_by(school_id=sid, fee_type='HOSTEL', source='HOSTEL')
    if status and status != 'ALL':
        q = q.filter_by(status=status)
    if from_date:
        q = q.filter(FeeRecord.created_at >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(FeeRecord.created_at <= datetime.fromisoformat(to_date))

    records = q.order_by(FeeRecord.created_at.desc()).all()

    total_due  = sum(r.amount_due  or 0 for r in records)
    total_paid = sum(r.amount_paid or 0 for r in records)

    rows = []
    for r in records:
        student = Student.query.get(r.student_id)
        rows.append({
            'student_id':   r.student_id,
            'student_name': student.user.name if student and student.user else '',
            'admission_no': student.admission_no if student else '',
            'month':        r.month,
            'amount_due':   r.amount_due,
            'amount_paid':  r.amount_paid,
            'pending':      (r.amount_due or 0) - (r.amount_paid or 0),
            'status':       r.status,
            'paid_date':    str(r.paid_date) if r.paid_date else None,
            'receipt_no':   r.receipt_no,
        })

    return jsonify({
        'summary': {
            'total_due':      total_due,
            'total_paid':     total_paid,
            'total_pending':  total_due - total_paid,
            'collection_pct': round(total_paid / total_due * 100, 1) if total_due else 0,
            'record_count':   len(records),
        },
        'records': rows,
    }), 200


@hostel_bp.route('/reports/fee-collection/export', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def export_fee_collection_csv():
    """CSV export of hostel fee collection records."""
    import csv, io
    sid = _school_id()
    records = FeeRecord.query.filter_by(school_id=sid, fee_type='HOSTEL', source='HOSTEL')\
                .order_by(FeeRecord.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Student Name', 'Admission No', 'Month', 'Amount Due', 'Amount Paid',
                      'Pending', 'Status', 'Paid Date', 'Receipt No'])
    for r in records:
        student = Student.query.get(r.student_id)
        writer.writerow([
            student.user.name if student and student.user else '',
            student.admission_no if student else '',
            r.month, r.amount_due, r.amount_paid,
            (r.amount_due or 0) - (r.amount_paid or 0),
            r.status, str(r.paid_date) if r.paid_date else '', r.receipt_no or '',
        ])

    output.seek(0)
    return Response(output.getvalue(), mimetype='text/csv', headers={
        'Content-Disposition': 'attachment; filename=hostel_fee_collection.csv'
    })


@hostel_bp.route('/reports/fee-collection/pdf', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL', 'SUPER_ADMIN')
def export_fee_collection_pdf():
    """PDF export of hostel fee collection report with summary & ledger."""
    sid = _school_id()
    status_filter = request.args.get('status', 'ALL')

    from app.models.school import School
    from app.utils.pdf_generator import generate_fee_collection_report_pdf

    school = School.query.get(sid)
    q = FeeRecord.query.filter_by(school_id=sid, fee_type='HOSTEL', source='HOSTEL')
    if status_filter and status_filter != 'ALL':
        q = q.filter_by(status=status_filter)

    records = q.order_by(FeeRecord.created_at.desc()).all()

    total_due = sum(r.amount_due or 0 for r in records)
    total_paid = sum(r.amount_paid or 0 for r in records)
    total_pending = max(0, total_due - total_paid)

    summary = {
        'total_billed': total_due,
        'total_collected': total_paid,
        'total_pending': total_pending,
    }

    formatted_records = []
    for r in records:
        student = Student.query.get(r.student_id) if r.student_id else None
        st_name = student.user.name if (student and student.user) else 'Resident'
        adm_no = student.admission_no if student else '—'

        formatted_records.append({
            'receipt_no': r.receipt_no or f"HSTL/{r.id:04d}",
            'student_name': st_name,
            'class_name': f"Adm: {adm_no}",
            'fee_type': f"Hostel ({r.month or 'Monthly'})",
            'payment_mode': r.payment_mode or 'CASH',
            'paid_date': r.paid_date.strftime('%d-%m-%Y') if r.paid_date else '—',
            'amount': float(r.amount_paid or 0),
        })

    buf = generate_fee_collection_report_pdf(
        school=school,
        summary=summary,
        transactions_or_records=formatted_records,
        report_title="Hostel Fee Collection & Revenue Statement",
        subtitle=f"Hostel Residency Dues & Collections | Status: {status_filter}"
    )

    return send_file(buf, mimetype='application/pdf', as_attachment=True, download_name='Hostel_Fee_Collection_Report.pdf')


@hostel_bp.route('/reports/history', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def report_history():
    """Admission/Transfer/Vacate history. Query: action = ACTIVE/TRANSFERRED/VACATED/ALL"""
    sid    = _school_id()
    action = request.args.get('action', 'ALL')

    q = HostelBedAllocation.query.filter_by(school_id=sid)
    if action != 'ALL':
        q = q.filter_by(status=action)

    allocations = q.order_by(HostelBedAllocation.created_at.desc()).limit(500).all()
    return jsonify([a.to_dict() for a in allocations]), 200



# NEW — append at end of file

@hostel_bp.route('/admissions', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_hostel_admissions():
    """All completed hostel admissions with full context — for the Admission page table."""
    sid = _school_id()
    search = (request.args.get('search') or '').strip()

    allocations = HostelBedAllocation.query.filter_by(school_id=sid, status='ACTIVE')\
                    .order_by(HostelBedAllocation.created_at.desc()).all()

    result = []
    for a in allocations:
        student = Student.query.get(a.student_id)
        if not student:
            continue
        if search:
            s_low = search.lower()
            name = (student.user.name if student.user else '').lower()
            if s_low not in name and s_low not in (student.admission_no or '').lower():
                continue

        cls  = Class.query.get(student.class_id) if student.class_id else None
        room = HostelRoom.query.get(a.room_id)
        floor    = HostelFloor.query.get(a.floor_id)
        building = HostelBuilding.query.get(a.building_id)
        bed  = HostelBed.query.get(a.bed_id)

        fee_rec = FeeRecord.query.filter_by(
            student_id=student.id, fee_type='HOSTEL', source='HOSTEL'
        ).order_by(FeeRecord.created_at.desc()).first()

        total_due  = fee_rec.amount_due if fee_rec else 0
        total_paid = fee_rec.amount_paid if fee_rec else 0
        f_status = fee_rec.status if fee_rec else ('NOT_GENERATED' if total_due == 0 else 'PENDING')

        result.append({
            'allocation_id':   a.id,
            'student_id':      student.id,
            'student_name':    student.user.name if student.user else '',
            'admission_no':    student.admission_no or '',
            'class_name':      f"{cls.name} - {cls.section}" if cls else '',
            'room_number':     room.room_number if room else '',
            'bed_number':      bed.bed_number if bed else '',
            'building_name':   building.name if building else '',
            'floor_name':      floor.name if floor else '',
            'is_ac':           room.is_ac if room else False,
            'guardian_name':   student.parent_name or '',
            'guardian_phone':  student.parent_phone or '',
            'admission_date':  str(a.admission_date) if a.admission_date else None,
            'fee_status':      f_status,
            'total_due':       total_due,
            'total_paid':      total_paid,
            'pending':         total_due - total_paid,
            'fee_record_id':   fee_rec.id if fee_rec else None,   # NEW — collect-fee call ke liye zaroori
        })

    return jsonify(result), 200


# NEW — append at end of app/routes/hostel.py

# ═══════════════════════════════════════════════════════════════════════════
#  CHECK-IN & CHECK-OUT LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/admission/<int:allocation_id>/checkin', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def checkin_student(allocation_id):
    """
    Check-in flow for an active/approved allocation.
    """
    alloc = HostelBedAllocation.query.get_or_404(allocation_id)
    sid   = _school_id()
    if alloc.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if alloc.status == 'VACATED':
        return jsonify({'error': 'Vacated allocation cannot be checked in'}), 400

    alloc.checkin_date = date.today()
    alloc.status = 'ACTIVE'
    log_hostel_activity(sid, get_current_user().id, 'CHECKED_IN', f'Allocation #{alloc.id} checked in')
    db.session.commit()
    return jsonify({'message': 'Student checked in successfully', 'allocation': alloc.to_dict()}), 200


@hostel_bp.route('/admission/<int:allocation_id>/checkout-inspection', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def checkout_inspection(allocation_id):
    """
    Returns financial obligations (pending monthly hostel fees + unpaid fines) before checkout.
    """
    alloc = HostelBedAllocation.query.get_or_404(allocation_id)
    sid   = _school_id()
    if alloc.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    unpaid_fees = FeeRecord.query.filter(
        FeeRecord.school_id == sid,
        FeeRecord.student_id == alloc.student_id,
        FeeRecord.source == 'HOSTEL',
        FeeRecord.status.in_(['PENDING', 'PARTIAL'])
    ).all()

    unpaid_fines = HostelFineRecord.query.filter(
        HostelFineRecord.school_id == sid,
        HostelFineRecord.student_id == alloc.student_id,
        HostelFineRecord.status.in_(['OUTSTANDING', 'PENDING', 'PARTIALLY_PAID', 'PARTIAL'])
    ).all()

    total_fee_dues = sum(r.effective_due() - (r.amount_paid or 0) for r in unpaid_fees)
    total_fine_dues = sum(f.outstanding_amount for f in unpaid_fines)

    return jsonify({
        'allocation': alloc.to_dict(),
        'total_dues': total_fee_dues + total_fine_dues,
        'unpaid_fees': [r.to_dict() for r in unpaid_fees],
        'unpaid_fines': [f.to_dict() for f in unpaid_fines],
        'can_checkout': (total_fee_dues + total_fine_dues) == 0,
    }), 200


@hostel_bp.route('/admission/<int:allocation_id>/checkout', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def checkout_student(allocation_id):
    """
    Performs formal checkout, records remarks, updates bed to VACANT, preserves full history.
    """
    alloc = HostelBedAllocation.query.get_or_404(allocation_id)
    sid   = _school_id()
    if alloc.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if alloc.status == 'VACATED':
        return jsonify({'error': 'Allocation is already vacated'}), 400

    data  = request.get_json() or {}
    force = bool(data.get('force', False))

    if not force:
        unpaid_fees = FeeRecord.query.filter(
            FeeRecord.school_id == sid,
            FeeRecord.student_id == alloc.student_id,
            FeeRecord.source.in_(['HOSTEL', 'HOSTEL_FINE']),
            FeeRecord.status.in_(['PENDING', 'PARTIAL', 'OUTSTANDING'])
        ).count()
        if unpaid_fees > 0:
            return jsonify({
                'error': 'Outstanding dues pending. Settle dues first or check force override.',
                'unpaid_count': unpaid_fees
            }), 400

    alloc.status = 'VACATED'
    alloc.vacate_date = date.today()
    alloc.checkout_remarks = data.get('remarks', '')
    alloc.checkout_approved_by = get_current_user().id

    bed = HostelBed.query.get(alloc.bed_id)
    if bed:
        bed.status = 'VACANT'
        bed.current_student_id = None
        bed.allocation_date = None

    log_hostel_activity(sid, get_current_user().id, 'CHECKED_OUT', f'Allocation #{alloc.id} checked out')
    db.session.commit()
    return jsonify({'message': 'Checkout completed successfully', 'allocation': alloc.to_dict()}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  MONTHLY HOSTEL FEES & DUES
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/fees/dues', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_hostel_dues():
    """
    Filterable ledger of all monthly hostel fee records.
    Query: month, status, hostel_id, search
    """
    sid    = _school_id()
    month  = request.args.get('month')
    status = request.args.get('status')
    search = (request.args.get('search') or '').strip().lower()

    q = FeeRecord.query.filter_by(school_id=sid, fee_type='HOSTEL', source='HOSTEL')
    if month and month != 'ALL':
        q = q.filter_by(month=month)
    if status and status != 'ALL':
        if status == 'PENDING':
            q = q.filter(FeeRecord.status.in_(['PENDING', 'PARTIAL']))
        else:
            q = q.filter_by(status=status)

    records = q.order_by(FeeRecord.created_at.desc()).all()
    results = []
    for r in records:
        student = Student.query.get(r.student_id)
        if not student:
            continue
        st_name = (student.user.name if student.user else '').lower()
        adm_no  = (student.admission_no or '').lower()
        if search and search not in st_name and search not in adm_no:
            continue

        alloc = HostelBedAllocation.query.get(r.source_ref_id) if r.source_ref_id else None
        hostel_name = ''
        room_number = ''
        bed_number = ''
        if alloc:
            h = Hostel.query.get(alloc.hostel_id)
            rm = HostelRoom.query.get(alloc.room_id)
            bd = HostelBed.query.get(alloc.bed_id)
            hostel_name = h.name if h else ''
            room_number = rm.room_number if rm else ''
            bed_number = bd.bed_number if bd else ''

        cls = Class.query.get(student.class_id) if student.class_id else None
        effective_due = r.effective_due()
        paid = r.amount_paid or 0.0
        outstanding = max(0.0, round(effective_due - paid, 2))

        results.append({
            'record_id':    r.id,
            'student_id':   student.id,
            'student_name': student.user.name if student.user else '',
            'admission_no': student.admission_no or '',
            'class_name':   f"{cls.name} - {cls.section}" if cls else '',
            'month':        r.month,
            'hostel_name':  hostel_name,
            'room_number':  room_number,
            'bed_number':   bed_number,
            'amount_due':   effective_due,
            'amount_paid':  paid,
            'outstanding':  outstanding,
            'status':       r.status,
            'due_date':     str(r.due_date) if r.due_date else '',
            'paid_date':    str(r.paid_date) if r.paid_date else '',
            'receipt_no':   r.receipt_no or '',
            'payment_mode': r.payment_mode or '',
            'remarks':      r.remarks or '',
        })

    return jsonify(results), 200


@hostel_bp.route('/fees/collect', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def collect_hostel_fee():
    """
    Centralized payment collection for monthly hostel charges with double-payment protection.
    Body: { record_id, amount_paid, payment_mode, remarks }
    """
    sid  = _school_id()
    data = request.get_json() or {}
    record_id = data.get('record_id')
    if not record_id:
        return jsonify({'error': 'record_id is required'}), 400

    record = FeeRecord.query.get_or_404(record_id)
    if record.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403
    if record.source not in ('HOSTEL', 'HOSTEL_FINE'):
        return jsonify({'error': 'This is not a hostel fee record'}), 400

    user = get_current_user()
    try:
        updated_rec, txn = record_hostel_fee_payment(
            record=record,
            amount=data.get('amount_paid'),
            payment_mode=data.get('payment_mode', 'CASH'),
            remarks=data.get('remarks', ''),
            collected_by_user=user,
        )
        db.session.commit()
        return jsonify({
            'message': 'Payment recorded successfully',
            'fee_record': updated_rec.to_dict(),
            'transaction': txn.to_dict() if txn else None,
        }), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Payment failed: {str(e)}'}), 500


# ═══════════════════════════════════════════════════════════════════════════
#  FINES, PENALTIES & WAIVERS
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/fines', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_hostel_fines():
    """Query: student_id, hostel_id, status"""
    sid = _school_id()
    q = HostelFineRecord.query.filter_by(school_id=sid)

    user = get_current_user()
    if user.role.value == 'HOSTEL':
        my_hostel_ids = [h.id for h in Hostel.query.filter_by(school_id=sid, warden_id=user.id).all()]
        if my_hostel_ids:
            q = q.filter(HostelFineRecord.hostel_id.in_(my_hostel_ids))

    if request.args.get('student_id'):
        q = q.filter_by(student_id=request.args['student_id'])
    if request.args.get('status') and request.args['status'] != 'ALL':
        q = q.filter_by(status=request.args['status'])

    return jsonify([f.to_dict() for f in q.order_by(HostelFineRecord.raised_date.desc()).all()]), 200


@hostel_bp.route('/fines', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def create_hostel_fine():
    """
    Raise fine on resident, auto-creates linked FeeRecord(source='HOSTEL_FINE').
    Body: { student_id, reason, description, amount }
    """
    sid  = _school_id()
    data = request.get_json() or {}
    student_id = data.get('student_id')
    if not student_id:
        return jsonify({'error': 'student_id is required'}), 400

    try:
        amount = float(data.get('amount'))
    except (TypeError, ValueError):
        return jsonify({'error': 'amount must be a valid number'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount must be greater than 0'}), 400

    alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
    if not alloc:
        return jsonify({'error': 'Student does not have an active hostel allocation'}), 400

    hostel = Hostel.query.get(alloc.hostel_id)
    user = get_current_user()

    reason = data.get('reason', 'OTHER')
    if reason not in FINE_REASONS:
        reason = 'OTHER'

    fine = HostelFineRecord(
        school_id=sid, student_id=student_id, hostel_id=hostel.id,
        reason=reason, description=data.get('description', ''),
        amount=amount, amount_paid=0.0, status='OUTSTANDING',
        raised_by=user.id, raised_date=date.today(),
    )
    db.session.add(fine)
    db.session.flush()

    fee_rec = FeeRecord(
        school_id=sid, student_id=student_id,
        fee_type='HOSTEL_FINE', source='HOSTEL_FINE', source_ref_id=fine.id,
        amount_due=amount, amount_paid=0.0, status='PENDING',
        month=date.today().strftime('%Y-%m'), due_date=date.today(),
        remarks=f"{reason.replace('_', ' ').title()} — {data.get('description', '')}",
    )
    db.session.add(fee_rec)
    db.session.flush()
    fine.fee_record_id = fee_rec.id

    log_hostel_activity(sid, user.id, 'FINE_RAISED', f'₹{amount} fine on student #{student_id} — {reason}')
    db.session.commit()
    return jsonify(fine.to_dict()), 201


@hostel_bp.route('/fines/<int:fine_id>/collect', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def collect_hostel_fine_payment(fine_id):
    """
    Collect fine payment directly at Hostel Counter, updating FeeRecord and FeeTransaction.
    """
    fine = HostelFineRecord.query.get_or_404(fine_id)
    sid  = _school_id()
    if fine.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    user = get_current_user()
    try:
        updated_fine = record_hostel_fine_payment(
            fine=fine,
            amount=data.get('amount'),
            payment_mode=data.get('payment_mode', 'CASH'),
            remarks=data.get('remarks', ''),
            collected_by_user=user,
        )
        db.session.commit()
        return jsonify({'message': 'Fine payment recorded successfully', 'fine': updated_fine.to_dict()}), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Collection failed: {str(e)}'}), 500


@hostel_bp.route('/fines/<int:fine_id>/waive', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def waive_hostel_fine(fine_id):
    """
    Waive fine (partial or full) with mandatory reason and audit record.
    Body: { waived_amount, reason }
    """
    fine = HostelFineRecord.query.get_or_404(fine_id)
    sid  = _school_id()
    if fine.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'Waiver reason is required'}), 400

    waived_amt = float(data.get('waived_amount', fine.outstanding_amount))
    if waived_amt <= 0:
        return jsonify({'error': 'Waived amount must be greater than 0'}), 400
    if waived_amt > fine.outstanding_amount:
        return jsonify({'error': f'Waived amount ₹{waived_amt} exceeds outstanding ₹{fine.outstanding_amount}'}), 400

    user = get_current_user()
    fine.waived_amount = round((fine.waived_amount or 0.0) + waived_amt, 2)
    fine.waived_by = user.id
    fine.waived_at = datetime.utcnow()
    fine.waive_reason = reason

    if fine.outstanding_amount <= 0:
        fine.status = 'WAIVED'
    else:
        fine.status = 'PARTIALLY_PAID'

    if fine.fee_record_id:
        fee_rec = FeeRecord.query.get(fine.fee_record_id)
        if fee_rec:
            if fine.outstanding_amount <= 0:
                fee_rec.status = 'WAIVED'
            fee_rec.remarks = (fee_rec.remarks or '') + f" | Waived ₹{waived_amt}: {reason}"

    log_hostel_activity(sid, user.id, 'FINE_WAIVED', f'Fine #{fine.id} waived ₹{waived_amt}: {reason}')
    db.session.commit()
    return jsonify(fine.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  COMPLAINTS & MAINTENANCE REQUESTS
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/complaints', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
def list_complaints():
    sid  = _school_id()
    user = get_current_user()
    q    = HostelComplaint.query.filter_by(school_id=sid)

    if user.role.value == 'STUDENT':
        student = Student.query.filter_by(user_id=user.id).first()
        if student:
            q = q.filter_by(student_id=student.id)
        else:
            return jsonify([]), 200
    elif user.role.value == 'HOSTEL':
        my_hostel_ids = [h.id for h in Hostel.query.filter_by(school_id=sid, warden_id=user.id).all()]
        if my_hostel_ids:
            q = q.filter(HostelComplaint.hostel_id.in_(my_hostel_ids))

    if request.args.get('status') and request.args['status'] != 'ALL':
        q = q.filter_by(status=request.args['status'])
    if request.args.get('category'):
        q = q.filter_by(category=request.args['category'])

    return jsonify([c.to_dict() for c in q.order_by(HostelComplaint.created_at.desc()).all()]), 200


@hostel_bp.route('/complaints', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
def create_complaint():
    sid  = _school_id()
    user = get_current_user()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    if user.role.value == 'STUDENT':
        student = Student.query.filter_by(user_id=user.id).first()
        student_id = student.id if student else None

    if not student_id:
        return jsonify({'error': 'student_id is required'}), 400

    alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
    if not alloc:
        return jsonify({'error': 'Active hostel allocation required to lodge a complaint'}), 400

    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400

    category = data.get('category', 'MAINTENANCE')
    if category not in COMPLAINT_CATEGORIES:
        category = 'MAINTENANCE'

    comp = HostelComplaint(
        school_id=sid,
        hostel_id=alloc.hostel_id,
        student_id=student_id,
        room_id=alloc.room_id,
        category=category,
        title=title,
        description=data.get('description', ''),
        priority=data.get('priority', 'MEDIUM'),
        attachment_url=data.get('attachment_url'),
        status='OPEN',
    )
    db.session.add(comp)
    log_hostel_activity(sid, user.id, 'COMPLAINT_CREATED', f'Complaint: {title}')
    db.session.commit()
    return jsonify(comp.to_dict()), 201


@hostel_bp.route('/complaints/<int:complaint_id>/status', methods=['PATCH'])
@role_required('PRINCIPAL', 'HOSTEL')
def update_complaint_status(complaint_id):
    comp = HostelComplaint.query.get_or_404(complaint_id)
    sid  = _school_id()
    if comp.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    if new_status and new_status in COMPLAINT_STATUSES:
        comp.status = new_status
        if new_status in ('RESOLVED', 'CLOSED'):
            comp.resolution = data.get('resolution', comp.resolution)
            comp.resolved_by = get_current_user().id
            comp.resolved_at = datetime.utcnow()

    log_hostel_activity(sid, get_current_user().id, 'COMPLAINT_UPDATED', f'Complaint #{comp.id} status → {comp.status}')
    db.session.commit()
    return jsonify(comp.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  OUT PASS & GATE PASS
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/out-passes', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
def list_out_passes():
    sid  = _school_id()
    user = get_current_user()
    q    = HostelOutPass.query.filter_by(school_id=sid)

    if user.role.value == 'STUDENT':
        student = Student.query.filter_by(user_id=user.id).first()
        if student:
            q = q.filter_by(student_id=student.id)
        else:
            return jsonify([]), 200

    if request.args.get('status') and request.args['status'] != 'ALL':
        q = q.filter_by(status=request.args['status'])

    return jsonify([p.to_dict() for p in q.order_by(HostelOutPass.created_at.desc()).all()]), 200


@hostel_bp.route('/out-passes', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL', 'STUDENT')
def request_out_pass():
    sid  = _school_id()
    user = get_current_user()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    if user.role.value == 'STUDENT':
        student = Student.query.filter_by(user_id=user.id).first()
        student_id = student.id if student else None

    if not student_id:
        return jsonify({'error': 'student_id is required'}), 400

    alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
    if not alloc:
        return jsonify({'error': 'Active hostel allocation required for out-pass'}), 400

    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'reason is required'}), 400

    try:
        out_time = datetime.fromisoformat(data['out_time'])
        expected_return = datetime.fromisoformat(data['expected_return'])
    except Exception:
        return jsonify({'error': 'Valid out_time and expected_return timestamps are required'}), 400

    pass_entry = HostelOutPass(
        school_id=sid,
        hostel_id=alloc.hostel_id,
        student_id=student_id,
        room_id=alloc.room_id,
        pass_type=data.get('pass_type', 'DAY_OUTING'),
        reason=reason,
        destination=data.get('destination', ''),
        guardian_contact=data.get('guardian_contact', ''),
        out_time=out_time,
        expected_return=expected_return,
        status='REQUESTED',
    )
    db.session.add(pass_entry)
    log_hostel_activity(sid, user.id, 'OUTPASS_REQUESTED', f'Out-pass for student #{student_id}')
    db.session.commit()
    return jsonify(pass_entry.to_dict()), 201


@hostel_bp.route('/out-passes/<int:pass_id>/status', methods=['PATCH'])
@role_required('PRINCIPAL', 'HOSTEL')
def update_out_pass_status(pass_id):
    pass_entry = HostelOutPass.query.get_or_404(pass_id)
    sid = _school_id()
    if pass_entry.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    user = get_current_user()

    if new_status in ('APPROVED', 'REJECTED'):
        pass_entry.status = new_status
        pass_entry.approved_by = user.id
        pass_entry.approved_at = datetime.utcnow()
        if new_status == 'REJECTED':
            pass_entry.rejection_reason = data.get('rejection_reason', '')
    elif new_status == 'OUT':
        pass_entry.status = 'OUT'
    elif new_status == 'RETURNED':
        pass_entry.status = 'RETURNED'
        pass_entry.actual_return = datetime.utcnow()

    log_hostel_activity(sid, user.id, 'OUTPASS_UPDATED', f'Out-pass #{pass_entry.id} → {pass_entry.status}')
    db.session.commit()
    return jsonify(pass_entry.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  VISITOR REGISTER
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/visitors', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_visitors():
    sid = _school_id()
    q   = HostelVisitorLog.query.filter_by(school_id=sid)
    if request.args.get('hostel_id'):
        q = q.filter_by(hostel_id=request.args['hostel_id'])
    if request.args.get('visit_date'):
        q = q.filter_by(visit_date=date.fromisoformat(request.args['visit_date']))
    return jsonify([v.to_dict() for v in q.order_by(HostelVisitorLog.in_time.desc()).all()]), 200


@hostel_bp.route('/visitors', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def create_visitor_entry():
    sid  = _school_id()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    visitor_name = (data.get('visitor_name') or '').strip()
    visitor_phone = (data.get('visitor_phone') or '').strip()

    if not student_id or not visitor_name or not visitor_phone:
        return jsonify({'error': 'student_id, visitor_name, and visitor_phone are required'}), 400

    alloc = HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').first()
    if not alloc:
        return jsonify({'error': 'Student is not actively residing in any hostel'}), 400

    v = HostelVisitorLog(
        school_id=sid,
        hostel_id=alloc.hostel_id,
        student_id=student_id,
        visitor_name=visitor_name,
        visitor_phone=visitor_phone,
        relation=data.get('relation', 'PARENT'),
        id_proof_type=data.get('id_proof_type', 'AADHAAR'),
        id_proof_no=data.get('id_proof_no', ''),
        visit_date=date.today(),
        in_time=datetime.utcnow(),
        purpose=data.get('purpose', ''),
        recorded_by=get_current_user().id,
    )
    db.session.add(v)
    log_hostel_activity(sid, get_current_user().id, 'VISITOR_ENTRY', f'Visitor {visitor_name} for student #{student_id}')
    db.session.commit()
    return jsonify(v.to_dict()), 201


@hostel_bp.route('/visitors/<int:visitor_id>/checkout', methods=['PATCH'])
@role_required('PRINCIPAL', 'HOSTEL')
def checkout_visitor(visitor_id):
    v = HostelVisitorLog.query.get_or_404(visitor_id)
    if v.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    v.out_time = datetime.utcnow()
    db.session.commit()
    return jsonify(v.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════════
#  NIGHT ROLL CALL / ATTENDANCE
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/attendance', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def get_hostel_attendance():
    """
    Returns night roll call status for all active residents for a specific date and hostel.
    """
    sid       = _school_id()
    hostel_id = request.args.get('hostel_id')
    att_date  = date.fromisoformat(request.args.get('date', date.today().isoformat()))

    alloc_q = HostelBedAllocation.query.filter_by(school_id=sid, status='ACTIVE')
    if hostel_id:
        alloc_q = alloc_q.filter_by(hostel_id=hostel_id)
    allocations = alloc_q.all()

    att_map = {
        a.student_id: a for a in HostelAttendance.query.filter_by(
            school_id=sid, attendance_date=att_date
        ).all()
    }

    results = []
    for alloc in allocations:
        student = Student.query.get(alloc.student_id)
        if not student:
            continue
        room = HostelRoom.query.get(alloc.room_id)
        bed  = HostelBed.query.get(alloc.bed_id)
        att  = att_map.get(alloc.student_id)

        results.append({
            'allocation_id':   alloc.id,
            'student_id':      student.id,
            'student_name':    student.user.name if student.user else '',
            'admission_no':    student.admission_no or '',
            'hostel_id':       alloc.hostel_id,
            'room_number':     room.room_number if room else '',
            'bed_number':      bed.bed_number if bed else '',
            'status':          att.status if att else 'PRESENT',
            'remarks':         att.remarks if att else '',
            'attendance_date': str(att_date),
            'marked':          bool(att),
        })

    return jsonify(results), 200


@hostel_bp.route('/attendance', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def mark_hostel_attendance():
    """
    Bulk submit night roll call attendance.
    Body: { hostel_id, date, entries: [{student_id, allocation_id, status, remarks}] }
    """
    sid  = _school_id()
    data = request.get_json() or {}
    entries = data.get('entries', [])
    att_date = date.fromisoformat(data.get('date', date.today().isoformat()))
    user_id = get_current_user().id

    for item in entries:
        student_id = item.get('student_id')
        alloc_id   = item.get('allocation_id')
        status     = item.get('status', 'PRESENT')
        remarks    = item.get('remarks', '')

        att = HostelAttendance.query.filter_by(
            school_id=sid, student_id=student_id, attendance_date=att_date
        ).first()

        if att:
            att.status = status
            att.remarks = remarks
            att.recorded_by = user_id
        else:
            alloc = HostelBedAllocation.query.get(alloc_id) if alloc_id else None
            hostel_id = alloc.hostel_id if alloc else (data.get('hostel_id') or 1)
            att = HostelAttendance(
                school_id=sid,
                hostel_id=hostel_id,
                allocation_id=alloc_id or alloc.id if alloc else 1,
                student_id=student_id,
                attendance_date=att_date,
                status=status,
                remarks=remarks,
                recorded_by=user_id,
            )
            db.session.add(att)

    log_hostel_activity(sid, user_id, 'ATTENDANCE_MARKED', f'Night roll call for {att_date} ({len(entries)} students)')
    db.session.commit()
    return jsonify({'message': f'Attendance marked for {len(entries)} students', 'date': str(att_date)}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  ROOM ASSET INVENTORY
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/inventory', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def list_inventory():
    sid = _school_id()
    q   = HostelInventory.query.filter_by(school_id=sid)
    if request.args.get('hostel_id'):
        q = q.filter_by(hostel_id=request.args['hostel_id'])
    if request.args.get('room_id'):
        q = q.filter_by(room_id=request.args['room_id'])
    return jsonify([i.to_dict() for i in q.order_by(HostelInventory.created_at.desc()).all()]), 200


@hostel_bp.route('/inventory', methods=['POST'])
@role_required('PRINCIPAL', 'HOSTEL')
def add_inventory():
    sid  = _school_id()
    data = request.get_json() or {}

    item_name = (data.get('item_name') or '').strip()
    hostel_id = data.get('hostel_id')
    if not item_name or not hostel_id:
        return jsonify({'error': 'item_name and hostel_id are required'}), 400

    item = HostelInventory(
        school_id=sid,
        hostel_id=hostel_id,
        room_id=data.get('room_id'),
        item_name=item_name,
        item_code=data.get('item_code', ''),
        category=data.get('category', 'FURNITURE'),
        quantity=int(data.get('quantity', 1)),
        condition=data.get('condition', 'GOOD'),
        assigned_student_id=data.get('assigned_student_id'),
        remarks=data.get('remarks', ''),
    )
    db.session.add(item)
    log_hostel_activity(sid, get_current_user().id, 'INVENTORY_ADDED', f'Asset: {item_name}')
    db.session.commit()
    return jsonify(item.to_dict()), 201


@hostel_bp.route('/inventory/<int:item_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'HOSTEL')
def update_inventory(item_id):
    item = HostelInventory.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    for f in ['item_name', 'item_code', 'category', 'quantity', 'condition', 'room_id', 'assigned_student_id', 'remarks']:
        if f in data:
            setattr(item, f, data[f])

    db.session.commit()
    return jsonify(item.to_dict()), 200


@hostel_bp.route('/inventory/<int:item_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_inventory(item_id):
    item = HostelInventory.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Inventory item deleted'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  HOSTEL SETTINGS
# ═══════════════════════════════════════════════════════════════════════════

@hostel_bp.route('/settings', methods=['GET'])
@role_required('PRINCIPAL', 'HOSTEL')
def get_hostel_settings():
    sid = _school_id()
    settings = HostelSettings.query.filter_by(school_id=sid).first()
    if not settings:
        settings = HostelSettings(school_id=sid)
        db.session.add(settings)
        db.session.commit()
    return jsonify(settings.to_dict()), 200


@hostel_bp.route('/settings', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_hostel_settings():
    sid = _school_id()
    settings = HostelSettings.query.filter_by(school_id=sid).first()
    if not settings:
        settings = HostelSettings(school_id=sid)
        db.session.add(settings)

    data = request.get_json() or {}
    for f in ['late_entry_cutoff_time', 'gate_pass_requires_principal_approval', 'max_leave_days_per_month', 'default_mess_charge', 'default_electricity_charge']:
        if f in data:
            setattr(settings, f, data[f])

    db.session.commit()
    return jsonify(settings.to_dict()), 200

