from flask import Blueprint, request, jsonify
from datetime import datetime, date
import math

from app import db
from app.models.academic import Student
from app.models.transport import Vehicle, Driver, Route, RouteStop, Stop
from app.models.transport_student import StudentTransport
from app.models.transport_gps import TripLog, GPSLog, TRIP_STATUSES
from app.utils.decorators import role_required, get_current_user

transport_gps_bp = Blueprint('transport_gps', __name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _school_id():
    return get_current_user().school_id


def bad_request(msg):
    return jsonify({'success': False, 'message': msg}), 400


def not_found(msg='Not found'):
    return jsonify({'success': False, 'message': msg}), 404


def _current_driver():
    """Driver row for the logged-in user, or None if this user isn't a driver."""
    return Driver.query.filter_by(user_id=get_current_user().id).first()


def _driver_vehicle(driver):
    return Vehicle.query.filter_by(driver_id=driver.id, school_id=driver.school_id).first()


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _trip_distance_km(trip):
    points = list(trip.gps_logs.order_by(GPSLog.recorded_at).all())
    if len(points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(points)):
        total += _haversine_km(points[i - 1].latitude, points[i - 1].longitude,
                                points[i].latitude, points[i].longitude)
    return round(total, 2)


def _open_trip_for_vehicle(vehicle_id, sid):
    return TripLog.query.filter(
        TripLog.school_id == sid, TripLog.vehicle_id == vehicle_id,
        TripLog.status.in_(['RUNNING', 'PAUSED'])
    ).first()


# ═══════════════════════════════════════════════════════════════════════════
#  DRIVER MOBILE APP
# ═══════════════════════════════════════════════════════════════════════════

@transport_gps_bp.route('/driver/today', methods=['GET'])
@role_required('DRIVER')
def driver_today():
    """Home screen data: today's vehicle, route, students count, current trip (if any)."""
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found for this login')

    vehicle = _driver_vehicle(driver)
    if not vehicle:
        return jsonify({'success': True, 'data': {'has_vehicle': False}})

    route = vehicle.route
    students_count = StudentTransport.query.filter_by(
        vehicle_id=vehicle.id, status='ACTIVE'
    ).count()

    open_trip = _open_trip_for_vehicle(vehicle.id, driver.school_id)

    return jsonify({'success': True, 'data': {
        'has_vehicle':     True,
        'vehicle_id':      vehicle.id,
        'vehicle_number':  vehicle.vehicle_number,
        'route_id':        route.id if route else None,
        'route_name':      route.name if route else '',
        'students_count':  students_count,
        'current_trip':    open_trip.to_dict() if open_trip else None,
    }})


@transport_gps_bp.route('/driver/trip/start', methods=['POST'])
@role_required('DRIVER')
def start_trip():
    """Body: { latitude, longitude }"""
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    vehicle = _driver_vehicle(driver)
    if not vehicle:
        return bad_request('No vehicle assigned to this driver')

    if _open_trip_for_vehicle(vehicle.id, driver.school_id):
        return bad_request('A trip is already running for this vehicle')

    data = request.get_json() or {}
    lat, lng = data.get('latitude'), data.get('longitude')
    if lat is None or lng is None:
        return bad_request('latitude and longitude are required')

    students_count = StudentTransport.query.filter_by(vehicle_id=vehicle.id, status='ACTIVE').count()

    trip = TripLog(
        school_id=driver.school_id, vehicle_id=vehicle.id, driver_id=driver.id,
        route_id=vehicle.route.id if vehicle.route else None,
        trip_date=date.today(), status='RUNNING',
        start_time=datetime.utcnow(), start_latitude=lat, start_longitude=lng,
        students_count=students_count,
    )
    db.session.add(trip)
    db.session.flush()

    db.session.add(GPSLog(
        school_id=driver.school_id, trip_id=trip.id, vehicle_id=vehicle.id,
        latitude=lat, longitude=lng, recorded_at=datetime.utcnow(),
    ))
    db.session.commit()
    return jsonify({'success': True, 'data': trip.to_dict()}), 201


@transport_gps_bp.route('/driver/trip/<int:trip_id>/gps', methods=['POST'])
@role_required('DRIVER')
def ping_gps(trip_id):
    """
    Body: { latitude, longitude, speed, heading, battery_level, network_status }
    Called every few seconds by the app while a trip is RUNNING.
    """
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    trip = TripLog.query.filter_by(id=trip_id, school_id=driver.school_id, driver_id=driver.id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status != 'RUNNING':
        return bad_request(f'Trip is {trip.status}, not RUNNING — cannot log GPS')

    data = request.get_json() or {}
    lat, lng = data.get('latitude'), data.get('longitude')
    if lat is None or lng is None:
        return bad_request('latitude and longitude are required')

    log = GPSLog(
        school_id=driver.school_id, trip_id=trip.id, vehicle_id=trip.vehicle_id,
        latitude=lat, longitude=lng, speed=data.get('speed', 0), heading=data.get('heading'),
        battery_level=data.get('battery_level'), network_status=data.get('network_status', 'ONLINE'),
        recorded_at=datetime.utcnow(),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'success': True, 'data': log.to_dict()}), 201


@transport_gps_bp.route('/driver/trip/<int:trip_id>/pause', methods=['POST'])
@role_required('DRIVER')
def pause_trip(trip_id):
    return _set_trip_status(trip_id, from_statuses=['RUNNING'], to_status='PAUSED')


@transport_gps_bp.route('/driver/trip/<int:trip_id>/resume', methods=['POST'])
@role_required('DRIVER')
def resume_trip(trip_id):
    return _set_trip_status(trip_id, from_statuses=['PAUSED'], to_status='RUNNING')


@transport_gps_bp.route('/driver/trip/<int:trip_id>/end', methods=['POST'])
@role_required('DRIVER')
def end_trip(trip_id):
    """Body: { latitude, longitude } — optional, frontend abhi ye nahi bhejta."""
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    trip = TripLog.query.filter_by(id=trip_id, school_id=driver.school_id, driver_id=driver.id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status not in ('RUNNING', 'PAUSED'):
        return bad_request(f'Trip is already {trip.status}')

    # silent=True: koi body/Content-Type na ho to bhi 415 nahi dega, bas {} treat karega
    data = request.get_json(silent=True) or {}
    trip.end_latitude = data.get('latitude')
    trip.end_longitude = data.get('longitude')
    trip.end_time = datetime.utcnow()
    trip.status = 'COMPLETED'
    trip.total_distance_km = _trip_distance_km(trip)
    if trip.start_time:
        trip.duration_minutes = int((trip.end_time - trip.start_time).total_seconds() // 60)

    db.session.commit()
    return jsonify({'success': True, 'data': trip.to_dict()})


@transport_gps_bp.route('/driver/trip/<int:trip_id>/sos', methods=['POST'])
@role_required('DRIVER')
def trigger_sos(trip_id):
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id, school_id=driver.school_id, driver_id=driver.id).first() if driver else None
    if not trip:
        return not_found('Trip not found')

    trip.status = 'SOS'
    trip.sos_triggered_at = datetime.utcnow()
    db.session.commit()
    # NOTE: actual alert dispatch (SMS/push to Principal & Transport Manager) wired in File 7 (reports/alerts)
    return jsonify({'success': True, 'message': 'SOS triggered', 'data': trip.to_dict()})


@transport_gps_bp.route('/driver/trip/<int:trip_id>/breakdown', methods=['POST'])
@role_required('DRIVER')
def report_breakdown(trip_id):
    """Body: { remarks }"""
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id, school_id=driver.school_id, driver_id=driver.id).first() if driver else None
    if not trip:
        return not_found('Trip not found')

    data = request.get_json(silent=True) or {}
    trip.status = 'BREAKDOWN'
    trip.breakdown_reported_at = datetime.utcnow()
    trip.remarks = data.get('remarks', trip.remarks)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Breakdown reported', 'data': trip.to_dict()})


def _set_trip_status(trip_id, from_statuses, to_status):
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    trip = TripLog.query.filter_by(id=trip_id, school_id=driver.school_id, driver_id=driver.id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status not in from_statuses:
        return bad_request(f'Trip is {trip.status}, cannot move to {to_status}')

    trip.status = to_status
    db.session.commit()
    return jsonify({'success': True, 'data': trip.to_dict()})


# ═══════════════════════════════════════════════════════════════════════════
#  PRINCIPAL / TRANSPORT MANAGER — LIVE VIEW
# ═══════════════════════════════════════════════════════════════════════════

@transport_gps_bp.route('/live', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def live_vehicles():
    """All vehicles currently on a RUNNING/PAUSED/SOS/BREAKDOWN trip, with latest ping."""
    sid = _school_id()
    trips = TripLog.query.filter(
        TripLog.school_id == sid,
        TripLog.status.in_(['RUNNING', 'PAUSED', 'SOS', 'BREAKDOWN'])
    ).all()
    return jsonify({'success': True, 'data': [t.to_dict() for t in trips]})


@transport_gps_bp.route('/trips/<int:trip_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def get_trip_detail(trip_id):
    sid = _school_id()
    trip = TripLog.query.filter_by(id=trip_id, school_id=sid).first()
    if not trip:
        return not_found('Trip not found')

    include_trail = request.args.get('include_trail', 'false').lower() == 'true'
    data = trip.to_dict()
    if include_trail:
        data['gps_trail'] = [g.to_dict() for g in trip.gps_logs.order_by(GPSLog.recorded_at).all()]
    return jsonify({'success': True, 'data': data})


@transport_gps_bp.route('/trips', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def list_trips():
    """Filters: vehicle_id, driver_id, status, trip_date."""
    sid = _school_id()
    q = TripLog.query.filter_by(school_id=sid)

    vehicle_id = request.args.get('vehicle_id', type=int)
    if vehicle_id:
        q = q.filter_by(vehicle_id=vehicle_id)

    driver_id = request.args.get('driver_id', type=int)
    if driver_id:
        q = q.filter_by(driver_id=driver_id)

    status = request.args.get('status', '').upper()
    if status in TRIP_STATUSES:
        q = q.filter_by(status=status)

    trip_date = request.args.get('trip_date', '').strip()
    if trip_date:
        try:
            q = q.filter_by(trip_date=datetime.strptime(trip_date, '%Y-%m-%d').date())
        except ValueError:
            return bad_request('trip_date must be YYYY-MM-DD')

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 100)
    p = q.order_by(TripLog.trip_date.desc(), TripLog.start_time.desc()) \
         .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True, 'data': [t.to_dict(include_latest_gps=False) for t in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages,
    })


# ═══════════════════════════════════════════════════════════════════════════
#  PARENT VIEW — own child only
# ═══════════════════════════════════════════════════════════════════════════

def _own_student_ids():
    """Both STUDENT and PARENT logins resolve to Student.user_id == user.id
    (single login flow, see auth.py /student-login) — so both roles use the
    same resolution: user.student_profile."""
    user = get_current_user()
    student = getattr(user, 'student_profile', None)
    return [student.id] if student else []


@transport_gps_bp.route('/parent/child/<int:student_id>/trip', methods=['GET'])
@role_required('PARENT', 'STUDENT')
def parent_child_trip(student_id):
    """
    Returns only what a parent/student should see: live location, speed,
    next stop, ETA, trip status, driver name/phone. No other students on
    the vehicle are ever included in this response.
    """
    if student_id not in _own_student_ids():
        return jsonify({'success': False, 'message': 'Not authorized for this student'}), 403

    sid = _school_id()
    assignment = StudentTransport.query.filter_by(
        school_id=sid, student_id=student_id, status='ACTIVE'
    ).first()
    if not assignment or not assignment.vehicle_id:
        return jsonify({'success': True, 'data': {'has_transport': False}})

    trip = _open_trip_for_vehicle(assignment.vehicle_id, sid)
    if not trip:
        return jsonify({'success': True, 'data': {
            'has_transport': True, 'trip_status': 'NOT_STARTED',
            'vehicle_number': assignment.vehicle.vehicle_number if assignment.vehicle else '',
            'driver_name': assignment.vehicle.driver.name if (assignment.vehicle and assignment.vehicle.driver) else '',
            'driver_mobile': assignment.vehicle.driver.mobile_number if (assignment.vehicle and assignment.vehicle.driver) else '',
        }})

    latest_gps = trip.latest_gps()
    next_stop = _resolve_next_stop(trip, assignment.stop_id)

    return jsonify({'success': True, 'data': {
        'has_transport':  True,
        'trip_status':    trip.status,
        'vehicle_number': trip.vehicle.vehicle_number if trip.vehicle else '',
        'driver_name':    trip.driver.name if trip.driver else '',
        'driver_mobile':  trip.driver.mobile_number if trip.driver else '',
        'latitude':       latest_gps.latitude if latest_gps else None,
        'longitude':      latest_gps.longitude if latest_gps else None,
        'speed':          latest_gps.speed if latest_gps else 0,
        'last_updated':   latest_gps.recorded_at.isoformat() if latest_gps else None,
        'next_stop':      next_stop['name'] if next_stop else None,
        'eta':            next_stop['eta'] if next_stop else None,
    }})


def _resolve_next_stop(trip, student_stop_id):
    """
    Simple heuristic: nearest not-yet-passed route stop by straight-line
    distance from the latest GPS ping. Good enough for MVP ETA display —
    a proper geofence-sequence tracker can replace this later without
    touching the response shape.
    """
    if not trip.route_id:
        return None
    latest = trip.latest_gps()
    if not latest:
        return None

    stops = RouteStop.query.filter_by(route_id=trip.route_id).order_by(RouteStop.sequence).all()
    if not stops:
        return None

    nearest = min(stops, key=lambda rs: _haversine_km(
        latest.latitude, latest.longitude, rs.stop.latitude or 0, rs.stop.longitude or 0
    ))
    return {'name': nearest.stop.name if nearest.stop else '', 'eta': nearest.estimated_time}
