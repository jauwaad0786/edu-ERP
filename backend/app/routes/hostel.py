from flask import Blueprint, request, jsonify
from app import db
from app.models.user import User, UserRole
from app.models.academic import Student, Class
# NEW
from app.models.hostel import (
    Hostel, HostelBuilding, HostelFloor, HostelWing, HostelRoom, HostelBed,
    HostelBedAllocation, HostelActivityLog, HostelSettings, log_hostel_activity,
    HostelFeeStructure,
    HOSTEL_TYPES, HOSTEL_GENDERS, ROOM_TYPES, BED_STATUSES, TRANSFER_TYPES,
)
from app.models.financial import FeeRecord
from app.services.hostel_fee_service import resolve_fee_structure, generate_hostel_fee_record
from sqlalchemy import func
from app.utils.decorators import role_required, get_current_user
from datetime import date, datetime

hostel_bp = Blueprint('hostel', __name__)


def _school_id():
    return get_current_user().school_id


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


@hostel_bp.route('/hostels/<int:hostel_id>', methods=['PATCH'])
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
@role_required('PRINCIPAL', 'HOSTEL')
def transfer_student(allocation_id):
    """
    Body: { new_bed_id, transfer_type, reason }
    Closes current allocation (status=TRANSFERRED), opens new one on new bed.
    """
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

    return jsonify({
        'current': active.to_dict() if active else None,
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
        monthly_fee=float(data.get('monthly_fee', 0)),
        quarterly_fee=float(data.get('quarterly_fee', 0)),
        yearly_fee=float(data.get('yearly_fee', 0)),
        security_deposit=float(data.get('security_deposit', 0)),
        electricity_charges=float(data.get('electricity_charges', 0)),
        laundry_charges=float(data.get('laundry_charges', 0)),
        mess_charges=float(data.get('mess_charges', 0)),
        maintenance_charges=float(data.get('maintenance_charges', 0)),
        late_fine=float(data.get('late_fine', 0)),
        discount=float(data.get('discount', 0)),
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
            setattr(fs, f, float(data[f]))
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
