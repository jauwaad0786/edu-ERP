from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.transport import (
    Vehicle, Driver, Conductor, Stop, Route, RouteStop, VehicleMaintenance,
    VEHICLE_TYPES, VEHICLE_STATUSES, MAINTENANCE_STATUSES
)
import re as _re, string as _string, random as _random
from app.models.user import User, UserRole
from app.services.permission_resolver import ensure_role_assignment_for_user

transport_bp = Blueprint('transport', __name__, url_prefix='/api/transport')


# ─── Helpers ────────────────────────────────────────────────────────────────

def get_current_school_id():
    return get_current_user().school_id


def paginate(query, default_per_page=25):
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', default_per_page, type=int), 100)
    p = query.paginate(page=page, per_page=per_page, error_out=False)
    return p


def bad_request(msg):
    return jsonify({'success': False, 'message': msg}), 400


def _gen_driver_username(name: str) -> str:
    """Driver Mobile App login username — same pattern as principal.py's
    _gen_username_p, kept local to avoid circular import."""
    clean = _re.sub(r'[^a-z0-9 ]', '', (name or '').lower().strip())
    parts = clean.split()[:2]
    base  = ('.'.join(parts) if parts else 'driver') + '.drv'

    if not User.query.filter_by(username=base).first():
        return base
    for _ in range(20):
        candidate = base + '.' + ''.join(_random.choices(_string.digits, k=3))
        if not User.query.filter_by(username=candidate).first():
            return candidate
    return base + '.' + ''.join(_random.choices(_string.digits, k=6))


from datetime import datetime, date


def parse_date(val):
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
    except Exception:
        return None


def not_found(msg='Not found'):
    return jsonify({'success': False, 'message': msg}), 404


# ─── Vehicles ───────────────────────────────────────────────────────────────

@transport_bp.route('/vehicles', methods=['GET'])
@jwt_required()
def list_vehicles():
    school_id = get_current_school_id()
    q = Vehicle.query.filter_by(school_id=school_id)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Vehicle.vehicle_number.ilike(like), Vehicle.vehicle_name.ilike(like)))

    vehicle_type = request.args.get('vehicle_type')
    if vehicle_type in VEHICLE_TYPES:
        q = q.filter_by(vehicle_type=vehicle_type)

    status = request.args.get('status')
    if status in VEHICLE_STATUSES:
        q = q.filter_by(status=status)

    q = q.order_by(Vehicle.vehicle_number)
    p = paginate(q)
    return jsonify({
        'success': True,
        'data': [v.to_dict() for v in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages
    })


@transport_bp.route('/vehicles/<int:vehicle_id>', methods=['GET'])
@jwt_required()
def get_vehicle(vehicle_id):
    school_id = get_current_school_id()
    v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
    if not v:
        return not_found('Vehicle not found')
    return jsonify({'success': True, 'data': v.to_dict()})


@transport_bp.route('/vehicles/<int:vehicle_id>/students', methods=['GET'])
@jwt_required()
def get_vehicle_students(vehicle_id):
    """
    Shows all students currently assigned to this vehicle/bus:
    Capacity, Assigned count, Available capacity, and student roster
    with class, section, pickup stop, drop stop, and live fee status.
    """
    school_id = get_current_school_id()
    v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
    if not v:
        return not_found('Vehicle not found')

    from app.models.transport_student import StudentTransport
    from app.models.financial import FeeRecord

    assignments = StudentTransport.query.filter_by(
        vehicle_id=v.id, school_id=school_id, status='ACTIVE'
    ).all()

    student_list = []
    for a in assignments:
        student = a.student
        if not student:
            continue

        cls_name = f"{student.class_ref.name} {student.class_ref.section or ''}".strip() if student.class_ref else ''

        # Fetch latest transport fee record status
        latest_fee = FeeRecord.query.filter(
            FeeRecord.school_id == school_id,
            FeeRecord.student_id == student.id,
            FeeRecord.source.in_(['TRANSPORT', 'TRANSPORT_FINE'])
        ).order_by(FeeRecord.created_at.desc()).first()

        fee_status = latest_fee.status if latest_fee else 'NO_FEES'

        pickup_name = a.pickup_stop.name if a.pickup_stop else (a.stop.name if a.stop else '')
        drop_name = a.drop_stop.name if a.drop_stop else (a.stop.name if a.stop else '')

        student_list.append({
            'student_id':       student.id,
            'admission_no':     student.admission_no or '',
            'student_name':     student.user.name if student.user else '',
            'class_name':       cls_name,
            'father_name':      student.father_name or '',
            'father_mobile':    student.parent_phone or '',
            'photo_url':        student.photo_url or '',
            'pickup_stop_id':   a.pickup_stop_id or a.stop_id,
            'pickup_stop_name': pickup_name,
            'drop_stop_id':     a.drop_stop_id or a.stop_id,
            'drop_stop_name':   drop_name,
            'transport_status': a.status,
            'fee_status':       fee_status,
            'assigned_date':    a.assigned_date.isoformat() if a.assigned_date else None,
        })

    capacity = v.capacity or 0
    assigned_count = len(student_list)
    available_capacity = max(0, capacity - assigned_count)

    return jsonify({
        'success': True,
        'data': {
            'vehicle': v.to_dict(),
            'capacity': capacity,
            'assigned_count': assigned_count,
            'available_capacity': available_capacity,
            'students': student_list,
        }
    })


@transport_bp.route('/vehicles', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_vehicle():
    school_id = get_current_school_id()
    data = request.get_json() or {}

    vehicle_number = (data.get('vehicle_number') or '').strip()
    if not vehicle_number:
        return bad_request('vehicle_number is required')

    if data.get('vehicle_type') and data['vehicle_type'] not in VEHICLE_TYPES:
        return bad_request(f'vehicle_type must be one of {VEHICLE_TYPES}')

    exists = Vehicle.query.filter_by(school_id=school_id, vehicle_number=vehicle_number).first()
    if exists:
        return bad_request('Vehicle number already exists')

    raw_driver_id = data.get('driver_id')
    raw_conductor_id = data.get('conductor_id')
    driver_id = int(raw_driver_id) if raw_driver_id not in (None, '', 'null') else None
    conductor_id = int(raw_conductor_id) if raw_conductor_id not in (None, '', 'null') else None

    v = Vehicle(
        school_id=school_id,
        vehicle_number=vehicle_number,
        vehicle_name=data.get('vehicle_name', ''),
        vehicle_type=data.get('vehicle_type', 'BUS'),
        capacity=data.get('capacity', 0),
        driver_id=driver_id,
        conductor_id=conductor_id,
        purchase_date=parse_date(data.get('purchase_date')),
        insurance_expiry=parse_date(data.get('insurance_expiry')),
        photo_url=data.get('photo_url', ''),
        notes=data.get('notes', ''),
        created_by=get_jwt_identity(),
    )
    db.session.add(v)
    db.session.commit()
    return jsonify({'success': True, 'data': v.to_dict()}), 201


@transport_bp.route('/vehicles/<int:vehicle_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_vehicle(vehicle_id):
    school_id = get_current_school_id()
    v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
    if not v:
        return not_found('Vehicle not found')

    data = request.get_json() or {}

    if 'vehicle_number' in data:
        new_number = data['vehicle_number'].strip()
        dup = Vehicle.query.filter(
            Vehicle.school_id == school_id,
            Vehicle.vehicle_number == new_number,
            Vehicle.id != v.id
        ).first()
        if dup:
            return bad_request('Vehicle number already exists')
        v.vehicle_number = new_number

    if 'vehicle_type' in data and data['vehicle_type'] not in VEHICLE_TYPES:
        return bad_request(f'vehicle_type must be one of {VEHICLE_TYPES}')

    for field in ['vehicle_name', 'vehicle_type', 'capacity', 'photo_url', 'notes', 'status']:
        if field in data:
            setattr(v, field, data[field])

    if 'driver_id' in data:
        raw_driver_id = data.get('driver_id')
        v.driver_id = int(raw_driver_id) if raw_driver_id not in (None, '', 'null') else None
    if 'conductor_id' in data:
        raw_conductor_id = data.get('conductor_id')
        v.conductor_id = int(raw_conductor_id) if raw_conductor_id not in (None, '', 'null') else None

    if 'purchase_date' in data:
        v.purchase_date = parse_date(data['purchase_date'])
    if 'insurance_expiry' in data:
        v.insurance_expiry = parse_date(data['insurance_expiry'])

    v.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'data': v.to_dict()})


@transport_bp.route('/vehicles/<int:vehicle_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_vehicle(vehicle_id):
    school_id = get_current_school_id()
    v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
    if not v:
        return not_found('Vehicle not found')

    if v.student_count() > 0:
        return bad_request('Cannot delete vehicle with active student assignments. Reassign students first.')

    db.session.delete(v)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Vehicle deleted'})


# ─── Drivers ────────────────────────────────────────────────────────────────

@transport_bp.route('/drivers', methods=['GET'])
@jwt_required()
def list_drivers():
    school_id = get_current_school_id()
    q = Driver.query.filter_by(school_id=school_id)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Driver.name.ilike(like), Driver.mobile_number.ilike(like)))

    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)

    q = q.order_by(Driver.name)
    p = paginate(q)
    return jsonify({
        'success': True,
        'data': [d.to_dict() for d in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages
    })


@transport_bp.route('/drivers/<int:driver_id>', methods=['GET'])
@jwt_required()
def get_driver(driver_id):
    school_id = get_current_school_id()
    d = Driver.query.filter_by(id=driver_id, school_id=school_id).first()
    if not d:
        return not_found('Driver not found')
    return jsonify({'success': True, 'data': d.to_dict()})


@transport_bp.route('/drivers', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_driver():
    school_id = get_current_school_id()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    mobile = (data.get('mobile_number') or '').strip()
    if not name or not mobile:
        return bad_request('name and mobile_number are required')

    has_license = bool(data.get('has_license', False))

    # ── Driver Mobile App login account ─────────────────────────────────
    # Driver form email nahi collect karta, isliye synthetic-but-unique
    # email banate hain (username khud unique-checked hai, so ye bhi
    # unique rahega). Principal/Transport head ko ye credentials response
    # mein wapas milte hain (ek hi baar, jaise staff creation mein hota hai).
    username = (data.get('username') or '').strip().lower() or _gen_driver_username(name)
    email = (data.get('email') or '').strip().lower() or f'{username}@driver.eduerp.local'
    plain_pw = (data.get('password') or '').strip() or 'Driver@123'

    if User.query.filter(db.func.lower(User.email) == email).first():
        return bad_request('Email already exists')
    if User.query.filter_by(username=username).first():
        return bad_request('Username already taken')

    user = User(
        name=name, email=email, username=username,
        role=UserRole.DRIVER, school_id=school_id,
        phone=mobile, is_active=True,
    )
    user.set_password(plain_pw, store_plain=True)
    db.session.add(user)
    db.session.flush()   # user.id chahiye Driver row link karne ke liye

    ensure_role_assignment_for_user(user)

    d = Driver(
        school_id=school_id,
        user_id=user.id,
        name=name,
        mobile_number=mobile,
        address=data.get('address', ''),
        photo_url=data.get('photo_url', ''),
        experience_years=data.get('experience_years', 0),
        has_license=has_license,
        license_number=data.get('license_number', '') if has_license else '',
        license_expiry=parse_date(data.get('license_expiry')) if has_license else None,
        license_photo_url=data.get('license_photo_url', '') if has_license else '',
        emergency_contact=data.get('emergency_contact', ''),
        remarks=data.get('remarks', ''),
        created_by=get_jwt_identity(),
    )
    db.session.add(d)
    db.session.commit()

    # optional: assign to vehicle at creation time
    vehicle_id = data.get('assign_vehicle_id')
    if vehicle_id:
        v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
        if v:
            v.driver_id = d.id
            db.session.commit()

    return jsonify({
        'success': True,
        'data': d.to_dict(),
        'login': {'username': username, 'email': email, 'password': plain_pw},
    }), 201


@transport_bp.route('/drivers/<int:driver_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_driver(driver_id):
    school_id = get_current_school_id()
    d = Driver.query.filter_by(id=driver_id, school_id=school_id).first()
    if not d:
        return not_found('Driver not found')

    data = request.get_json() or {}
    for field in ['name', 'mobile_number', 'address', 'photo_url', 'experience_years',
                  'emergency_contact', 'remarks', 'status']:
        if field in data:
            setattr(d, field, data[field])

    if 'has_license' in data:
        d.has_license = bool(data['has_license'])
        if d.has_license:
            if 'license_number' in data:
                d.license_number = data['license_number']
            if 'license_expiry' in data:
                d.license_expiry = parse_date(data['license_expiry'])
            if 'license_photo_url' in data:
                d.license_photo_url = data['license_photo_url']
        else:
            d.license_number, d.license_expiry, d.license_photo_url = '', None, ''

    d.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'data': d.to_dict()})


@transport_bp.route('/drivers/<int:driver_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_driver(driver_id):
    school_id = get_current_school_id()
    d = Driver.query.filter_by(id=driver_id, school_id=school_id).first()
    if not d:
        return not_found('Driver not found')

    assigned = Vehicle.query.filter_by(driver_id=d.id).first()
    if assigned:
        return bad_request(f'Driver is assigned to vehicle {assigned.vehicle_number}. Unassign first.')

    linked_user = User.query.get(d.user_id) if d.user_id else None
    db.session.delete(d)
    if linked_user:
        db.session.delete(linked_user)   # orphan login account na reh jaye
    db.session.commit()
    return jsonify({'success': True, 'message': 'Driver deleted'})


# ─── Conductors ─────────────────────────────────────────────────────────────

@transport_bp.route('/conductors', methods=['GET'])
@jwt_required()
def list_conductors():
    school_id = get_current_school_id()
    q = Conductor.query.filter_by(school_id=school_id)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Conductor.name.ilike(like), Conductor.mobile_number.ilike(like)))

    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)

    q = q.order_by(Conductor.name)
    p = paginate(q)
    return jsonify({
        'success': True,
        'data': [c.to_dict() for c in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages
    })


@transport_bp.route('/conductors', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_conductor():
    school_id = get_current_school_id()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    mobile = (data.get('mobile_number') or '').strip()
    if not name or not mobile:
        return bad_request('name and mobile_number are required')

    c = Conductor(
        school_id=school_id,
        name=name,
        mobile_number=mobile,
        address=data.get('address', ''),
        photo_url=data.get('photo_url', ''),
        experience_years=data.get('experience_years', 0),
        emergency_contact=data.get('emergency_contact', ''),
        remarks=data.get('remarks', ''),
        created_by=get_jwt_identity(),
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'success': True, 'data': c.to_dict()}), 201


@transport_bp.route('/conductors/<int:conductor_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_conductor(conductor_id):
    school_id = get_current_school_id()
    c = Conductor.query.filter_by(id=conductor_id, school_id=school_id).first()
    if not c:
        return not_found('Conductor not found')

    data = request.get_json() or {}
    for field in ['name', 'mobile_number', 'address', 'photo_url', 'experience_years',
                  'emergency_contact', 'remarks', 'status']:
        if field in data:
            setattr(c, field, data[field])

    c.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'data': c.to_dict()})


@transport_bp.route('/conductors/<int:conductor_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_conductor(conductor_id):
    school_id = get_current_school_id()
    c = Conductor.query.filter_by(id=conductor_id, school_id=school_id).first()
    if not c:
        return not_found('Conductor not found')

    assigned = Vehicle.query.filter_by(conductor_id=c.id).first()
    if assigned:
        return bad_request(f'Conductor is assigned to vehicle {assigned.vehicle_number}. Unassign first.')

    db.session.delete(c)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Conductor deleted'})


# ─── Stops ──────────────────────────────────────────────────────────────────

@transport_bp.route('/stops', methods=['GET'])
@jwt_required()
def list_stops():
    school_id = get_current_school_id()
    q = Stop.query.filter_by(school_id=school_id)

    search = request.args.get('search', '').strip()
    if search:
        q = q.filter(Stop.name.ilike(f'%{search}%'))

    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)

    stops = q.order_by(Stop.name).all()   # stops list usually small, no pagination needed
    return jsonify({'success': True, 'data': [s.to_dict() for s in stops]})


@transport_bp.route('/stops', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_stop():
    school_id = get_current_school_id()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return bad_request('name is required')

    if Stop.query.filter_by(school_id=school_id, name=name).first():
        return bad_request('Stop with this name already exists')

    s = Stop(
        school_id=school_id,
        name=name,
        latitude=data.get('latitude'),
        longitude=data.get('longitude'),
        radius=data.get('radius', 200),
        description=data.get('description', ''),
        created_by=get_jwt_identity(),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify({'success': True, 'data': s.to_dict()}), 201


@transport_bp.route('/stops/<int:stop_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_stop(stop_id):
    school_id = get_current_school_id()
    s = Stop.query.filter_by(id=stop_id, school_id=school_id).first()
    if not s:
        return not_found('Stop not found')

    data = request.get_json() or {}
    for field in ['name', 'latitude', 'longitude', 'radius', 'description', 'status']:
        if field in data:
            setattr(s, field, data[field])

    db.session.commit()
    return jsonify({'success': True, 'data': s.to_dict()})


@transport_bp.route('/stops/<int:stop_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_stop(stop_id):
    school_id = get_current_school_id()
    s = Stop.query.filter_by(id=stop_id, school_id=school_id).first()
    if not s:
        return not_found('Stop not found')

    in_use = RouteStop.query.filter_by(stop_id=s.id).first()
    if in_use:
        return bad_request('Stop is used in one or more routes. Remove from routes first.')

    db.session.delete(s)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Stop deleted'})


# ─── Routes ─────────────────────────────────────────────────────────────────

@transport_bp.route('/routes', methods=['GET'])
@jwt_required()
def list_routes():
    school_id = get_current_school_id()
    q = Route.query.filter_by(school_id=school_id)

    search = request.args.get('search', '').strip()
    if search:
        q = q.filter(Route.name.ilike(f'%{search}%'))

    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)

    routes = q.order_by(Route.name).all()
    include_stops = request.args.get('include_stops', 'true').lower() != 'false'
    return jsonify({'success': True, 'data': [r.to_dict(include_stops=include_stops) for r in routes]})


@transport_bp.route('/routes/<int:route_id>', methods=['GET'])
@jwt_required()
def get_route(route_id):
    school_id = get_current_school_id()
    r = Route.query.filter_by(id=route_id, school_id=school_id).first()
    if not r:
        return not_found('Route not found')
    return jsonify({'success': True, 'data': r.to_dict()})


@transport_bp.route('/routes', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_route():
    """
    Body: { name, code, vehicle_id, stops: [{stop_id, estimated_time}, ...] }
    `stops` order in the array = sequence (1-indexed), matches drag-drop builder output.
    """
    school_id = get_current_school_id()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return bad_request('name is required')

    if Route.query.filter_by(school_id=school_id, name=name).first():
        return bad_request('Route with this name already exists')

    vehicle_id = data.get('vehicle_id')
    if vehicle_id:
        existing_route = Route.query.filter_by(vehicle_id=vehicle_id, school_id=school_id).first()
        if existing_route:
            return bad_request(f'Vehicle is already assigned to route "{existing_route.name}"')

    r = Route(
        school_id=school_id,
        name=name,
        code=data.get('code', ''),
        vehicle_id=vehicle_id,
        created_by=get_jwt_identity(),
    )
    db.session.add(r)
    db.session.flush()   # get r.id before adding stops

    for idx, stop_data in enumerate(data.get('stops', []), start=1):
        rs = RouteStop(
            route_id=r.id,
            stop_id=stop_data['stop_id'],
            sequence=idx,
            estimated_time=stop_data.get('estimated_time', ''),
        )
        db.session.add(rs)

    db.session.commit()
    return jsonify({'success': True, 'data': r.to_dict()}), 201


@transport_bp.route('/routes/<int:route_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_route(route_id):
    """Updates route meta fields. Use /routes/<id>/stops for stop reorder/add/remove."""
    school_id = get_current_school_id()
    r = Route.query.filter_by(id=route_id, school_id=school_id).first()
    if not r:
        return not_found('Route not found')

    data = request.get_json() or {}

    if 'vehicle_id' in data and data['vehicle_id']:
        dup = Route.query.filter(
            Route.vehicle_id == data['vehicle_id'],
            Route.school_id == school_id,
            Route.id != r.id
        ).first()
        if dup:
            return bad_request(f'Vehicle is already assigned to route "{dup.name}"')

    for field in ['name', 'code', 'vehicle_id', 'status']:
        if field in data:
            setattr(r, field, data[field])

    r.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'data': r.to_dict()})


@transport_bp.route('/routes/<int:route_id>/stops', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def replace_route_stops(route_id):
    """
    Full replace of a route's stop list — matches the drag-drop builder's
    'save' action (send the whole reordered list, not incremental diffs).
    Body: { stops: [{stop_id, estimated_time}, ...] } — array order = sequence.
    """
    school_id = get_current_school_id()
    r = Route.query.filter_by(id=route_id, school_id=school_id).first()
    if not r:
        return not_found('Route not found')

    data = request.get_json() or {}
    stops_data = data.get('stops', [])
    if not stops_data:
        return bad_request('At least one stop is required')

    RouteStop.query.filter_by(route_id=r.id).delete()
    db.session.flush()

    for idx, stop_data in enumerate(stops_data, start=1):
        rs = RouteStop(
            route_id=r.id,
            stop_id=stop_data['stop_id'],
            sequence=idx,
            estimated_time=stop_data.get('estimated_time', ''),
        )
        db.session.add(rs)

    db.session.commit()
    return jsonify({'success': True, 'data': r.to_dict()})


@transport_bp.route('/routes/<int:route_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_route(route_id):
    school_id = get_current_school_id()
    r = Route.query.filter_by(id=route_id, school_id=school_id).first()
    if not r:
        return not_found('Route not found')

    if r.students_count() > 0:
        return bad_request('Cannot delete route with active student assignments. Reassign students first.')

    db.session.delete(r)   # cascades RouteStop rows
    db.session.commit()
    return jsonify({'success': True, 'message': 'Route deleted'})


# ─── Vehicle Maintenance ────────────────────────────────────────────────────

@transport_bp.route('/maintenance', methods=['GET'])
@jwt_required()
def list_maintenance():
    school_id = get_current_school_id()
    q = VehicleMaintenance.query.filter_by(school_id=school_id)

    vehicle_id = request.args.get('vehicle_id', type=int)
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    status = request.args.get('status')
    if status in MAINTENANCE_STATUSES:
        q = q.filter_by(status=status)

    q = q.order_by(VehicleMaintenance.reported_date.desc())
    p = paginate(q)
    return jsonify({
        'success': True,
        'data': [m.to_dict() for m in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages
    })


@transport_bp.route('/maintenance', methods=['POST'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def create_maintenance():
    school_id = get_current_school_id()
    data = request.get_json() or {}

    vehicle_id = data.get('vehicle_id')
    problem = (data.get('problem') or '').strip()
    if not vehicle_id or not problem:
        return bad_request('vehicle_id and problem are required')

    v = Vehicle.query.filter_by(id=vehicle_id, school_id=school_id).first()
    if not v:
        return bad_request('Invalid vehicle_id')

    m = VehicleMaintenance(
        school_id=school_id,
        vehicle_id=vehicle_id,
        problem=problem,
        reported_date=parse_date(data.get('reported_date')) or datetime.utcnow().date(),
        expected_completion=parse_date(data.get('expected_completion')),
        cost=data.get('cost', 0),
        remarks=data.get('remarks', ''),
        photo_url=data.get('photo_url', ''),
        created_by=get_jwt_identity(),
    )
    db.session.add(m)

    # auto-flip vehicle to MAINTENANCE status
    v.status = 'MAINTENANCE'

    db.session.commit()
    return jsonify({'success': True, 'data': m.to_dict()}), 201


@transport_bp.route('/maintenance/<int:record_id>', methods=['PUT'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL', 'TRANSPORT')
def update_maintenance(record_id):
    school_id = get_current_school_id()
    m = VehicleMaintenance.query.filter_by(id=record_id, school_id=school_id).first()
    if not m:
        return not_found('Maintenance record not found')

    data = request.get_json() or {}

    if 'status' in data:
        if data['status'] not in MAINTENANCE_STATUSES:
            return bad_request(f'status must be one of {MAINTENANCE_STATUSES}')
        m.status = data['status']
        if data['status'] == 'COMPLETED' and not m.completed_date:
            m.completed_date = datetime.utcnow().date()
            # auto-flip vehicle back to ACTIVE if no other open maintenance
            other_open = VehicleMaintenance.query.filter(
                VehicleMaintenance.vehicle_id == m.vehicle_id,
                VehicleMaintenance.status != 'COMPLETED',
                VehicleMaintenance.id != m.id
            ).first()
            if not other_open:
                v = Vehicle.query.get(m.vehicle_id)
                if v and v.status == 'MAINTENANCE':
                    v.status = 'ACTIVE'

    for field in ['problem', 'expected_completion', 'cost', 'remarks', 'photo_url']:
        if field in data:
            if field == 'expected_completion':
                m.expected_completion = parse_date(data[field])
            else:
                setattr(m, field, data[field])

    db.session.commit()
    return jsonify({'success': True, 'data': m.to_dict()})


@transport_bp.route('/maintenance/<int:record_id>', methods=['DELETE'])
@jwt_required()
@role_required('ADMIN', 'PRINCIPAL')
def delete_maintenance(record_id):
    school_id = get_current_school_id()
    m = VehicleMaintenance.query.filter_by(id=record_id, school_id=school_id).first()
    if not m:
        return not_found('Maintenance record not found')

    db.session.delete(m)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Maintenance record deleted'})


# ─── Shared util ─────────────────────────────────────────────────────────────

def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None
