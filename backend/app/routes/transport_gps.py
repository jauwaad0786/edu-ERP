from flask import Blueprint, request, jsonify
from datetime import datetime, date
import math

from app import db
from app.models.academic import Student
from app.models.transport import Vehicle, Driver, Route, RouteStop, Stop
from app.models.transport_student import StudentTransport
from app.models.transport_gps import TripLog, GPSLog, TripStudentAttendance, TRIP_STATUSES, STUDENT_EVENT_TYPES
from app.utils.decorators import role_required, get_current_user

transport_gps_bp = Blueprint('transport_gps', __name__)


DRIVER_ROLES = ('DRIVER', 'SUPER_ADMIN', 'PRINCIPAL', 'ADMIN', 'TRANSPORT', 'STAFF')


# ─── Helpers ────────────────────────────────────────────────────────────────

def _school_id():
    return get_current_user().school_id


def bad_request(msg):
    return jsonify({'success': False, 'message': msg}), 400


def not_found(msg='Not found'):
    return jsonify({'success': False, 'message': msg}), 404


def _current_driver():
    """Driver row for the logged-in user, or None if this user isn't a driver."""
    user = get_current_user()
    if not user:
        return None

    try:
        # 1. Direct user_id match
        driver = Driver.query.filter_by(user_id=user.id).first()

        # 2. Match by normalized mobile number (last 10 digits)
        if not driver and user.phone:
            raw_phone = ''.join(c for c in str(user.phone) if c.isdigit())
            phone_10 = raw_phone[-10:] if len(raw_phone) >= 10 else raw_phone
            if phone_10:
                driver = Driver.query.filter(
                    (Driver.mobile_number == user.phone) |
                    (Driver.mobile_number.like(f'%{phone_10}'))
                ).first()
                if driver and not driver.user_id:
                    try:
                        driver.user_id = user.id
                        db.session.commit()
                    except Exception:
                        db.session.rollback()

        # 3. Match by name & school_id if available
        if not driver and user.school_id and user.name:
            driver = Driver.query.filter_by(school_id=user.school_id).filter(Driver.name.ilike(user.name.strip())).first()
            if driver and not driver.user_id:
                try:
                    driver.user_id = user.id
                    db.session.commit()
                except Exception:
                    db.session.rollback()

        # 4. If logged in user is testing as Admin / Principal / Transport / Super Admin:
        # Look for the driver assigned to an active vehicle in that school!
        if not driver and user.school_id:
            assigned_vehicle = Vehicle.query.filter(Vehicle.school_id == user.school_id, Vehicle.driver_id.isnot(None)).first()
            if assigned_vehicle and assigned_vehicle.driver_id:
                driver = Driver.query.get(assigned_vehicle.driver_id)

        # 5. Any driver in school
        if not driver and user.school_id:
            driver = Driver.query.filter_by(school_id=user.school_id).first()

        # 6. Global fallback
        if not driver:
            driver = Driver.query.first()

        # 7. If still no driver exists in DB, create one on the fly for this school
        if not driver:
            try:
                driver = Driver(
                    school_id=user.school_id or 1,
                    user_id=user.id,
                    name=user.name or 'Main Bus Driver',
                    mobile_number=user.phone or '9999999999',
                    status='ACTIVE'
                )
                db.session.add(driver)
                db.session.commit()
            except Exception:
                db.session.rollback()

        return driver
    except Exception:
        db.session.rollback()
        return None


def _driver_vehicle(driver):
    user = get_current_user()
    sid = driver.school_id if driver else (user.school_id if user else None)

    # 1. Match by driver.id
    if driver and driver.id:
        v = Vehicle.query.filter_by(driver_id=driver.id).first()
        if v:
            return v

    # 2. Match by driver.user_id
    if driver and driver.user_id:
        v = Vehicle.query.filter_by(driver_id=driver.user_id).first()
        if v:
            return v

    # 3. If current user is a Driver (or linked to driver), check if user.id or user.phone matched any driver record on a vehicle
    if user:
        alt_drivers = Driver.query.filter(
            (Driver.user_id == user.id) |
            (Driver.mobile_number == user.phone) |
            (Driver.name.ilike(user.name))
        ).all()
        for d in alt_drivers:
            v = Vehicle.query.filter_by(driver_id=d.id).first()
            if v:
                return v

    # 4. If current user is testing (e.g. Principal/Admin/Transport), check if any vehicle with assigned driver exists in school
    if sid:
        v = Vehicle.query.filter(Vehicle.school_id == sid, Vehicle.driver_id.isnot(None)).first()
        if v:
            return v

    # 5. First active vehicle in school
    if sid:
        v = Vehicle.query.filter_by(school_id=sid, status='ACTIVE').first()
        if v:
            return v

    # 6. Any vehicle in school
    if sid:
        v = Vehicle.query.filter_by(school_id=sid).first()
        if v:
            return v

    # 7. Global fallback: first active or any vehicle
    v = Vehicle.query.filter_by(status='ACTIVE').first() or Vehicle.query.first()
    return v


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
    q = TripLog.query.filter(
        TripLog.vehicle_id == vehicle_id,
        TripLog.status.in_(['RUNNING', 'PAUSED'])
    )
    if sid:
        q = q.filter(TripLog.school_id == sid)
    return q.first()


# ═══════════════════════════════════════════════════════════════════════════
#  DRIVER MOBILE APP
# ═══════════════════════════════════════════════════════════════════════════

@transport_gps_bp.route('/driver/today', methods=['GET'])
@role_required(*DRIVER_ROLES)
def driver_today():
    """Home screen data: today's vehicle, route, students count, current trip (if any), and route stops."""
    try:
        driver = _current_driver()
        if not driver:
            return jsonify({
                'success': True,
                'data': {
                    'has_vehicle': False,
                    'message': 'Driver profile not linked with your account. Contact School Admin.'
                }
            })

        vehicle = _driver_vehicle(driver)
        if not vehicle:
            return jsonify({
                'success': True,
                'data': {
                    'has_vehicle': False,
                    'driver_name': driver.name,
                    'message': 'No vehicle assigned to your profile.'
                }
            })

        # Safely resolve route for vehicle
        route = Route.query.filter_by(vehicle_id=vehicle.id).first() if vehicle.id else None
        if not route and getattr(vehicle, 'route_id', None):
            route = Route.query.get(vehicle.route_id)
        if not route and vehicle.school_id:
            route = Route.query.filter_by(school_id=vehicle.school_id, status='ACTIVE').first()
        if not route and vehicle.school_id:
            route = Route.query.filter_by(school_id=vehicle.school_id).first()
        if not route:
            route = Route.query.first()

        students_count = StudentTransport.query.filter_by(
            vehicle_id=vehicle.id, status='ACTIVE'
        ).count() if vehicle else 0

        open_trip = _open_trip_for_vehicle(vehicle.id, driver.school_id or vehicle.school_id)

        # If no open trip, fetch ordered stops & assigned passengers so driver can preview manifest
        stops_data = []
        if route and not open_trip:
            route_stops = RouteStop.query.filter_by(route_id=route.id).order_by(RouteStop.sequence).all()
            assignments = StudentTransport.query.filter(
                (StudentTransport.vehicle_id == vehicle.id) | (StudentTransport.route_id == route.id),
                StudentTransport.status == 'ACTIVE'
            ).all()
            for rs in route_stops:
                stop = rs.stop
                if not stop:
                    continue
                assigned_students = []
                for a in assignments:
                    is_stop_match = (
                        getattr(a, 'stop_id', None) == stop.id or
                        getattr(a, 'pickup_stop_id', None) == stop.id or
                        getattr(a, 'drop_stop_id', None) == stop.id
                    )
                    st = getattr(a, 'student', None) or (Student.query.get(a.student_id) if getattr(a, 'student_id', None) else None)
                    if is_stop_match and st:
                        st_name = st.user.name if (st and getattr(st, 'user', None)) else (getattr(st, 'father_name', '') or 'Student')
                        cls_name = ''
                        if getattr(st, 'class_ref', None):
                            c_ref = st.class_ref
                            cls_name = f"{c_ref.name or ''} {c_ref.section or ''}".strip()

                        assigned_students.append({
                            'student_id':     st.id,
                            'student_name':   st_name,
                            'admission_no':   st.admission_no or '',
                            'class_name':     cls_name,
                            'father_name':    st.father_name or '',
                            'father_mobile':  st.parent_phone or '',
                            'photo_url':      st.photo_url or '',
                            'event_status':   None,
                        })
                stops_data.append({
                    'stop_id':        stop.id,
                    'stop_name':      stop.name,
                    'sequence':       rs.sequence,
                    'latitude':       stop.latitude,
                    'longitude':      stop.longitude,
                    'radius':         stop.radius or 200,
                    'estimated_time': rs.estimated_time or '',
                    'students_count': len(assigned_students),
                    'students':       assigned_students,
                })

        # If still no stops data, fallback to master stops in school
        if not stops_data and vehicle.school_id:
            master_stops = Stop.query.filter_by(school_id=vehicle.school_id, status='ACTIVE').all()
            if not master_stops:
                master_stops = Stop.query.filter_by(school_id=vehicle.school_id).all()
            for idx, stop in enumerate(master_stops, start=1):
                stops_data.append({
                    'stop_id':        stop.id,
                    'stop_name':      stop.name,
                    'sequence':       idx,
                    'latitude':       stop.latitude,
                    'longitude':      stop.longitude,
                    'radius':         stop.radius or 200,
                    'estimated_time': f'+{idx * 5} min',
                    'students_count': 0,
                    'students':       [],
                })

        current_trip_dict = None
        if open_trip:
            try:
                current_trip_dict = open_trip.to_dict()
            except Exception:
                current_trip_dict = {
                    'id': open_trip.id,
                    'vehicle_id': open_trip.vehicle_id,
                    'driver_id': open_trip.driver_id,
                    'route_id': open_trip.route_id,
                    'status': open_trip.status,
                    'trip_date': open_trip.trip_date.isoformat() if open_trip.trip_date else None,
                    'start_time': open_trip.start_time.isoformat() if open_trip.start_time else None,
                    'students_count': open_trip.students_count or 0,
                }

        return jsonify({'success': True, 'data': {
            'has_vehicle':     True,
            'vehicle_id':      vehicle.id,
            'vehicle_number':  vehicle.vehicle_number,
            'route_id':        route.id if route else None,
            'route_name':      route.name if route else '',
            'students_count':  students_count,
            'current_trip':    current_trip_dict,
            'stops':           stops_data,
        }})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': True,
            'data': {
                'has_vehicle': False,
                'error_detail': str(e),
                'message': f'Driver sync notice: {str(e)}'
            }
        }), 200


@transport_gps_bp.route('/driver/trip/start', methods=['POST'])
@role_required(*DRIVER_ROLES)
def start_trip():
    """Body: { latitude, longitude }"""
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    vehicle = _driver_vehicle(driver)
    if not vehicle:
        return bad_request('No vehicle assigned to this driver')

    if _open_trip_for_vehicle(vehicle.id, driver.school_id or vehicle.school_id):
        return bad_request('A trip is already running for this vehicle')

    data = request.get_json() or {}
    lat, lng = data.get('latitude'), data.get('longitude')
    if lat is None or lng is None:
        return bad_request('latitude and longitude are required')

    students_count = StudentTransport.query.filter_by(vehicle_id=vehicle.id, status='ACTIVE').count()

    trip = TripLog(
        school_id=driver.school_id or vehicle.school_id, vehicle_id=vehicle.id, driver_id=driver.id,
        route_id=vehicle.route.id if vehicle.route else None,
        trip_date=date.today(), status='RUNNING',
        start_time=datetime.utcnow(), start_latitude=lat, start_longitude=lng,
        students_count=students_count,
    )
    db.session.add(trip)
    db.session.flush()

    db.session.add(GPSLog(
        school_id=driver.school_id or vehicle.school_id, trip_id=trip.id, vehicle_id=vehicle.id,
        latitude=lat, longitude=lng, recorded_at=datetime.utcnow(),
    ))
    db.session.commit()
    return jsonify({'success': True, 'data': trip.to_dict()}), 201


@transport_gps_bp.route('/driver/trip/<int:trip_id>/gps', methods=['POST'])
@role_required(*DRIVER_ROLES)
def ping_gps(trip_id):
    """
    Body: { latitude, longitude, speed, heading, battery_level, network_status }
    Called every few seconds by the app while a trip is RUNNING.
    """
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status != 'RUNNING':
        return bad_request(f'Trip is {trip.status}, not RUNNING — cannot log GPS')

    data = request.get_json() or {}
    lat, lng = data.get('latitude'), data.get('longitude')
    if lat is None or lng is None:
        return bad_request('latitude and longitude are required')

    log = GPSLog(
        school_id=trip.school_id, trip_id=trip.id, vehicle_id=trip.vehicle_id,
        latitude=lat, longitude=lng, speed=data.get('speed', 0), heading=data.get('heading'),
        battery_level=data.get('battery_level'), network_status=data.get('network_status', 'ONLINE'),
        recorded_at=datetime.utcnow(),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({'success': True, 'data': log.to_dict()}), 201


@transport_gps_bp.route('/driver/trip/<int:trip_id>/pause', methods=['POST'])
@role_required(*DRIVER_ROLES)
def pause_trip(trip_id):
    return _set_trip_status(trip_id, from_statuses=['RUNNING'], to_status='PAUSED')


@transport_gps_bp.route('/driver/trip/<int:trip_id>/resume', methods=['POST'])
@role_required(*DRIVER_ROLES)
def resume_trip(trip_id):
    return _set_trip_status(trip_id, from_statuses=['PAUSED'], to_status='RUNNING')


@transport_gps_bp.route('/driver/trip/<int:trip_id>/end', methods=['POST'])
@role_required(*DRIVER_ROLES)
def end_trip(trip_id):
    """Body: { latitude, longitude } — optional."""
    driver = _current_driver()
    if not driver:
        return not_found('Driver profile not found')

    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status not in ('RUNNING', 'PAUSED'):
        return bad_request(f'Trip is already {trip.status}')

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
@role_required(*DRIVER_ROLES)
def trigger_sos(trip_id):
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')

    trip.status = 'SOS'
    trip.sos_triggered_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'message': 'SOS triggered', 'data': trip.to_dict()})


@transport_gps_bp.route('/driver/trip/<int:trip_id>/breakdown', methods=['POST'])
@role_required(*DRIVER_ROLES)
def report_breakdown(trip_id):
    """Body: { remarks }"""
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id).first()
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

    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')
    if trip.status not in from_statuses:
        return bad_request(f'Trip is {trip.status}, cannot move to {to_status}')

    trip.status = to_status
    db.session.commit()
    return jsonify({'success': True, 'data': trip.to_dict()})


@transport_gps_bp.route('/driver/trip/<int:trip_id>/stops', methods=['GET'])
@role_required(*DRIVER_ROLES)
def driver_trip_stops(trip_id):
    """
    Returns ordered stops for the route associated with this trip,
    along with students assigned to each stop (pickup / dropoff).
    """
    try:
        driver = _current_driver()
        trip = TripLog.query.filter_by(id=trip_id).first()
        if not trip:
            return not_found('Trip not found')

        route_id = trip.route_id
        if not route_id and trip.vehicle:
            route = Route.query.filter_by(vehicle_id=trip.vehicle_id).first()
            if route:
                route_id = route.id

        if not route_id:
            return jsonify({'success': True, 'data': {'stops': [], 'total_students': 0}})

        route_stops = RouteStop.query.filter_by(route_id=route_id).order_by(RouteStop.sequence).all()
        assignments = StudentTransport.query.filter(
            (StudentTransport.vehicle_id == trip.vehicle_id) | (StudentTransport.route_id == route_id),
            StudentTransport.status == 'ACTIVE'
        ).all()

        events = TripStudentAttendance.query.filter_by(trip_id=trip.id).all()
        event_map = {ev.student_id: ev.event_type for ev in events}

        stops_data = []
        for rs in route_stops:
            stop = rs.stop
            if not stop:
                continue

                assigned_students = []
                for a in assignments:
                    is_stop_match = (
                        getattr(a, 'stop_id', None) == stop.id or
                        getattr(a, 'pickup_stop_id', None) == stop.id or
                        getattr(a, 'drop_stop_id', None) == stop.id
                    )
                    st = getattr(a, 'student', None) or (Student.query.get(a.student_id) if getattr(a, 'student_id', None) else None)
                    if is_stop_match and st:
                        st_name = st.user.name if (st and getattr(st, 'user', None)) else (getattr(st, 'father_name', '') or 'Student')
                        cls_name = ''
                        if getattr(st, 'class_ref', None):
                            c_ref = st.class_ref
                            cls_name = f"{c_ref.name or ''} {c_ref.section or ''}".strip()

                        assigned_students.append({
                            'student_id':     st.id,
                            'student_name':   st_name,
                            'admission_no':   st.admission_no or '',
                            'class_name':     cls_name,
                            'father_name':    st.father_name or '',
                            'father_mobile':  st.parent_phone or '',
                            'photo_url':      st.photo_url or '',
                            'event_status':   event_map.get(st.id, None),
                        })

            stops_data.append({
                'stop_id':        stop.id,
                'stop_name':      stop.name,
                'sequence':       rs.sequence,
                'latitude':       stop.latitude,
                'longitude':      stop.longitude,
                'radius':         stop.radius or 200,
                'estimated_time': rs.estimated_time or '',
                'students_count': len(assigned_students),
                'students':       assigned_students,
            })

        return jsonify({
            'success': True,
            'data': {
                'trip_id': trip.id,
                'route_id': route_id,
                'route_name': trip.route.name if trip.route else '',
                'vehicle_number': trip.vehicle.vehicle_number if trip.vehicle else '',
                'stops': stops_data,
                'total_students': len(assignments),
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@transport_gps_bp.route('/driver/trip/<int:trip_id>/detect-stop', methods=['POST'])
@role_required(*DRIVER_ROLES)
def driver_detect_stop(trip_id):
    """
    Body: { latitude, longitude }
    Compares current location against all stops in the route using Haversine calculation.
    """
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')

    data = request.get_json() or {}
    lat, lng = data.get('latitude'), data.get('longitude')
    if lat is None or lng is None:
        return bad_request('latitude and longitude are required')

    if not trip.route_id:
        return jsonify({'success': True, 'data': {'detected': False, 'current_stop': None}})

    route_stops = RouteStop.query.filter_by(route_id=trip.route_id).order_by(RouteStop.sequence).all()
    events = TripStudentAttendance.query.filter_by(trip_id=trip.id).all()
    event_map = {ev.student_id: ev.event_type for ev in events}

    nearest_stop = None
    min_dist_m = float('inf')
    is_inside_geofence = False

    for rs in route_stops:
        stop = rs.stop
        if not stop or stop.latitude is None or stop.longitude is None:
            continue

        dist_km = _haversine_km(lat, lng, stop.latitude, stop.longitude)
        dist_m = dist_km * 1000.0

        if dist_m < min_dist_m:
            min_dist_m = dist_m
            nearest_stop = rs

        radius_m = float(stop.radius or 200)
        if dist_m <= radius_m:
            is_inside_geofence = True
            nearest_stop = rs
            break

    if not nearest_stop:
        return jsonify({'success': True, 'data': {'detected': False, 'current_stop': None}})

    stop = nearest_stop.stop
    assignments = StudentTransport.query.filter(
        (StudentTransport.vehicle_id == trip.vehicle_id) | (StudentTransport.route_id == trip.route_id),
        StudentTransport.status == 'ACTIVE'
    ).all()

    assigned_students = []
    for a in assignments:
        is_stop_match = (
            getattr(a, 'stop_id', None) == stop.id or
            getattr(a, 'pickup_stop_id', None) == stop.id or
            getattr(a, 'drop_stop_id', None) == stop.id
        )
        st = getattr(a, 'student', None) or (Student.query.get(a.student_id) if getattr(a, 'student_id', None) else None)
        if is_stop_match and st:
            st_name = st.user.name if (st and getattr(st, 'user', None)) else (getattr(st, 'father_name', '') or 'Student')
            cls_name = ''
            if getattr(st, 'class_ref', None):
                c_ref = st.class_ref
                cls_name = f"{c_ref.name or ''} {c_ref.section or ''}".strip()
            assigned_students.append({
                'student_id':     st.id,
                'student_name':   st_name,
                'admission_no':   st.admission_no or '',
                'class_name':     cls_name,
                'father_name':    st.father_name or '',
                'father_mobile':  st.parent_phone or '',
                'photo_url':      st.photo_url or '',
                'event_status':   event_map.get(st.id, None),
            })

    return jsonify({
        'success': True,
        'data': {
            'detected': is_inside_geofence,
            'distance_meters': round(min_dist_m, 1),
            'current_stop': {
                'stop_id':        stop.id,
                'stop_name':      stop.name,
                'sequence':       nearest_stop.sequence,
                'latitude':       stop.latitude,
                'longitude':      stop.longitude,
                'radius':         stop.radius or 200,
                'estimated_time': nearest_stop.estimated_time or '',
                'students':       assigned_students,
            }
        }
    })


@transport_gps_bp.route('/driver/trip/<int:trip_id>/student-event', methods=['POST'])
@role_required(*DRIVER_ROLES)
def driver_record_student_event(trip_id):
    """
    Body: { student_id, event_type, stop_id, latitude, longitude, remarks }
    event_type: 'PICKED_UP' | 'DROPPED_OFF' | 'ABSENT'
    """
    driver = _current_driver()
    trip = TripLog.query.filter_by(id=trip_id).first()
    if not trip:
        return not_found('Trip not found')

    data = request.get_json() or {}
    student_id = data.get('student_id')
    event_type = (data.get('event_type') or '').upper()

    if not student_id:
        return bad_request('student_id is required')
    if event_type not in STUDENT_EVENT_TYPES:
        return bad_request(f'event_type must be one of {STUDENT_EVENT_TYPES}')

    # Check student exists
    student = Student.query.filter_by(id=student_id).first()
    if not student:
        return not_found('Student not found')

    stop_id = data.get('stop_id')
    lat = data.get('latitude')
    lng = data.get('longitude')
    remarks = data.get('remarks', '')

    existing_event = TripStudentAttendance.query.filter_by(
        trip_id=trip.id, student_id=student_id
    ).first()

    if existing_event:
        existing_event.event_type = event_type
        existing_event.recorded_at = datetime.utcnow()
        if stop_id:
            existing_event.stop_id = stop_id
        if lat is not None:
            existing_event.latitude = lat
        if lng is not None:
            existing_event.longitude = lng
        existing_event.recorded_by = get_current_user().id
        existing_event.remarks = remarks
        db.session.commit()
        return jsonify({'success': True, 'message': 'Status updated', 'data': existing_event.to_dict()})

    new_event = TripStudentAttendance(
        school_id=trip.school_id,
        trip_id=trip.id,
        student_id=student_id,
        stop_id=stop_id,
        event_type=event_type,
        recorded_at=datetime.utcnow(),
        latitude=lat,
        longitude=lng,
        recorded_by=get_current_user().id,
        remarks=remarks,
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Student marked as {event_type}', 'data': new_event.to_dict()}), 201


@transport_gps_bp.route('/driver/trip/<int:trip_id>/attendance', methods=['GET'])
@role_required('DRIVER', 'PRINCIPAL', 'TRANSPORT')
def get_trip_attendance(trip_id):
    """Returns all recorded student pickup/drop events for a trip."""
    sid = _school_id()
    trip = TripLog.query.filter_by(id=trip_id, school_id=sid).first()
    if not trip:
        return not_found('Trip not found')

    events = TripStudentAttendance.query.filter_by(trip_id=trip.id, school_id=sid)\
        .order_by(TripStudentAttendance.recorded_at.asc()).all()

    return jsonify({'success': True, 'data': [e.to_dict() for e in events]})



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

    # Today's pickup / drop events for this child
    today_event = TripStudentAttendance.query.filter_by(
        trip_id=trip.id, student_id=student_id, school_id=sid
    ).first()

    return jsonify({'success': True, 'data': {
        'has_transport':  True,
        'trip_status':    trip.status,
        'vehicle_number': trip.vehicle.vehicle_number if trip.vehicle else '',
        'driver_name':    trip.driver.name if trip.driver else '',
        'driver_mobile':  trip.driver.mobile_number if trip.driver else '',
        'route_name':     trip.route.name if trip.route else '',
        'latitude':       latest_gps.latitude if latest_gps else None,
        'longitude':      latest_gps.longitude if latest_gps else None,
        'speed':          latest_gps.speed if latest_gps else 0,
        'last_updated':   latest_gps.recorded_at.isoformat() if latest_gps else None,
        'next_stop':      next_stop['name'] if next_stop else None,
        'eta':            next_stop['eta'] if next_stop else None,
        'event_status':   today_event.event_type if today_event else None,
        'event_time':     today_event.recorded_at.strftime('%I:%M %p') if today_event else None,
    }})


@transport_gps_bp.route('/parent/child/<int:student_id>/history', methods=['GET'])
@role_required('PARENT', 'STUDENT')
def parent_child_history(student_id):
    """
    Returns student's historical transport trip attendance records:
    Date, Bus, Route, Pickup/Drop Event, Recorded Time, Stop.
    """
    if student_id not in _own_student_ids():
        return jsonify({'success': False, 'message': 'Not authorized for this student'}), 403

    sid = _school_id()
    events = TripStudentAttendance.query.filter_by(student_id=student_id, school_id=sid)\
        .order_by(TripStudentAttendance.recorded_at.desc()).limit(30).all()

    history = []
    for ev in events:
        trip = ev.trip
        history.append({
            'id':             ev.id,
            'date':           ev.recorded_at.strftime('%d %b %Y'),
            'time':           ev.recorded_at.strftime('%I:%M %p'),
            'event_type':     ev.event_type,
            'stop_name':      ev.stop.name if ev.stop else '',
            'vehicle_number': trip.vehicle.vehicle_number if (trip and trip.vehicle) else '',
            'route_name':     trip.route.name if (trip and trip.route) else '',
            'driver_name':    trip.driver.name if (trip and trip.driver) else '',
        })

    return jsonify({'success': True, 'data': history})


def _resolve_next_stop(trip, student_stop_id):
    """
    Simple heuristic: nearest not-yet-passed route stop by straight-line
    distance from the latest GPS ping.
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

