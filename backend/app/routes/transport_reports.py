from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from sqlalchemy import func

from app import db
from app.models.academic import Student, Class
from app.models.transport import Vehicle, Driver, Conductor, Route, Stop, VehicleMaintenance
from app.models.transport_student import (
    StudentTransport, TransportFeeRecord, TransportFeeTransaction, TransportTransferHistory
)
from app.models.transport_gps import TripLog
from app.utils.decorators import role_required, get_current_user

transport_reports_bp = Blueprint('transport_reports', __name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _school_id():
    return get_current_user().school_id


def bad_request(msg):
    return jsonify({'success': False, 'message': msg}), 400


# ═══════════════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

@transport_reports_bp.route('/dashboard', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def dashboard():
    sid = _school_id()

    total_vehicles = Vehicle.query.filter_by(school_id=sid).count()
    total_drivers = Driver.query.filter_by(school_id=sid, status='ACTIVE').count()
    total_conductors = Conductor.query.filter_by(school_id=sid, status='ACTIVE').count()

    students_with_transport = StudentTransport.query.filter_by(school_id=sid, status='ACTIVE').count()
    total_students = Student.query.filter_by(school_id=sid).count()
    students_without_transport = max(total_students - students_with_transport, 0)

    vehicle_type_counts = dict(
        db.session.query(Vehicle.vehicle_type, func.count(Vehicle.id))
        .filter(Vehicle.school_id == sid).group_by(Vehicle.vehicle_type).all()
    )

    active_routes = Route.query.filter_by(school_id=sid, status='ACTIVE').count()

    fee_pending = db.session.query(
        func.coalesce(func.sum(TransportFeeRecord.amount - TransportFeeRecord.discount
                                - TransportFeeRecord.waiver - TransportFeeRecord.paid_amount), 0)
    ).filter(
        TransportFeeRecord.school_id == sid,
        TransportFeeRecord.status.in_(['PENDING', 'PARTIAL', 'OVERDUE'])
    ).scalar() or 0

    fee_collected = db.session.query(
        func.coalesce(func.sum(TransportFeeRecord.paid_amount), 0)
    ).filter(TransportFeeRecord.school_id == sid).scalar() or 0

    vehicles_under_maintenance = Vehicle.query.filter_by(school_id=sid, status='MAINTENANCE').count()

    today_trips = TripLog.query.filter_by(school_id=sid, trip_date=date.today()).count()
    live_trips_now = TripLog.query.filter(
        TripLog.school_id == sid, TripLog.status.in_(['RUNNING', 'PAUSED'])
    ).count()

    return jsonify({'success': True, 'data': {
        'total_vehicles':              total_vehicles,
        'total_drivers':               total_drivers,
        'total_conductors':            total_conductors,
        'students_using_transport':    students_with_transport,
        'students_not_using_transport': students_without_transport,
        'bus_count':                   vehicle_type_counts.get('BUS', 0),
        'van_count':                   vehicle_type_counts.get('VAN', 0),
        'car_count':                   vehicle_type_counts.get('CAR', 0),
        'active_routes':               active_routes,
        'transport_fee_pending':       round(fee_pending, 2),
        'transport_fee_collected':     round(fee_collected, 2),
        'vehicles_under_maintenance':  vehicles_under_maintenance,
        'today_running_trips':         today_trips,
        'live_trips_now':              live_trips_now,
    }})


@transport_reports_bp.route('/dashboard/monthly-collection', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def monthly_collection_graph():
    """Last 12 months of transport fee collection, for the dashboard bar/line chart."""
    sid = _school_id()
    twelve_months_ago = date.today().replace(day=1) - timedelta(days=365)

    rows = db.session.query(
        func.to_char(TransportFeeTransaction.payment_date, 'YYYY-MM').label('month'),
        func.sum(TransportFeeTransaction.amount_paid).label('total')
    ).filter(
        TransportFeeTransaction.school_id == sid,
        TransportFeeTransaction.payment_date >= twelve_months_ago
    ).group_by('month').order_by('month').all()

    return jsonify({'success': True, 'data': [{'month': r.month, 'amount': round(r.total or 0, 2)} for r in rows]})


@transport_reports_bp.route('/dashboard/vehicle-distribution', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def vehicle_distribution_graph():
    sid = _school_id()
    rows = db.session.query(Vehicle.vehicle_type, func.count(Vehicle.id)) \
        .filter(Vehicle.school_id == sid).group_by(Vehicle.vehicle_type).all()
    return jsonify({'success': True, 'data': [{'type': t, 'count': c} for t, c in rows]})


@transport_reports_bp.route('/dashboard/students-by-vehicle', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def students_by_vehicle_graph():
    sid = _school_id()
    rows = db.session.query(
        Vehicle.vehicle_number, func.count(StudentTransport.id)
    ).join(
        StudentTransport, StudentTransport.vehicle_id == Vehicle.id
    ).filter(
        Vehicle.school_id == sid, StudentTransport.status == 'ACTIVE'
    ).group_by(Vehicle.vehicle_number).order_by(Vehicle.vehicle_number).all()

    return jsonify({'success': True, 'data': [{'vehicle_number': v, 'students': c} for v, c in rows]})


@transport_reports_bp.route('/dashboard/route-wise-students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def route_wise_students_graph():
    sid = _school_id()
    rows = db.session.query(
        Route.name, func.count(StudentTransport.id)
    ).join(
        StudentTransport, StudentTransport.route_id == Route.id
    ).filter(
        Route.school_id == sid, StudentTransport.status == 'ACTIVE'
    ).group_by(Route.name).order_by(Route.name).all()

    return jsonify({'success': True, 'data': [{'route_name': r, 'students': c} for r, c in rows]})


@transport_reports_bp.route('/dashboard/class-wise-transport-users', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def class_wise_transport_users_graph():
    sid = _school_id()
    rows = db.session.query(
        Class.name, Class.section, func.count(StudentTransport.id)
    ).join(
        Student, Student.class_id == Class.id
    ).join(
        StudentTransport, StudentTransport.student_id == Student.id
    ).filter(
        Class.school_id == sid, StudentTransport.status == 'ACTIVE'
    ).group_by(Class.name, Class.section).order_by(Class.name).all()

    return jsonify({'success': True, 'data': [
        {'class_name': f"{n} {s or ''}".strip(), 'students': c} for n, s, c in rows
    ]})


@transport_reports_bp.route('/dashboard/recent-activities', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def recent_activities():
    """Last N transfer-history entries — added/transferred/removed, newest first."""
    sid = _school_id()
    limit = min(request.args.get('limit', 10, type=int), 50)
    rows = TransportTransferHistory.query.filter_by(school_id=sid) \
        .order_by(TransportTransferHistory.transfer_date.desc()).limit(limit).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in rows]})


@transport_reports_bp.route('/dashboard/upcoming-maintenance', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def upcoming_maintenance():
    """Vehicles with an open (non-COMPLETED) maintenance record, soonest expected_completion first."""
    sid = _school_id()
    rows = VehicleMaintenance.query.filter(
        VehicleMaintenance.school_id == sid,
        VehicleMaintenance.status != 'COMPLETED'
    ).order_by(VehicleMaintenance.expected_completion.asc().nulls_last()).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in rows]})


# ═══════════════════════════════════════════════════════════════════════════
#  REPORTS
# ═══════════════════════════════════════════════════════════════════════════

@transport_reports_bp.route('/reports/vehicle-wise-students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_vehicle_wise_students():
    sid = _school_id()
    vehicles = Vehicle.query.filter_by(school_id=sid).order_by(Vehicle.vehicle_number).all()
    data = [{
        'vehicle_id': v.id, 'vehicle_number': v.vehicle_number, 'vehicle_type': v.vehicle_type,
        'capacity': v.capacity or 0, 'students_assigned': v.student_count(),
    } for v in vehicles]
    return jsonify({'success': True, 'data': data})


@transport_reports_bp.route('/reports/driver-wise-students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_driver_wise_students():
    sid = _school_id()
    drivers = Driver.query.filter_by(school_id=sid).order_by(Driver.name).all()
    data = []
    for d in drivers:
        vehicle = Vehicle.query.filter_by(driver_id=d.id, school_id=sid).first()
        data.append({
            'driver_id': d.id, 'driver_name': d.name, 'mobile_number': d.mobile_number,
            'vehicle_number': vehicle.vehicle_number if vehicle else '',
            'students_assigned': vehicle.student_count() if vehicle else 0,
        })
    return jsonify({'success': True, 'data': data})


@transport_reports_bp.route('/reports/route-wise-students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_route_wise_students():
    sid = _school_id()
    routes = Route.query.filter_by(school_id=sid).order_by(Route.name).all()
    data = [{
        'route_id': r.id, 'route_name': r.name, 'vehicle_number': r.vehicle.vehicle_number if r.vehicle else '',
        'students_count': r.students_count(),
    } for r in routes]
    return jsonify({'success': True, 'data': data})


@transport_reports_bp.route('/reports/stop-wise-students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_stop_wise_students():
    sid = _school_id()
    stops = Stop.query.filter_by(school_id=sid).order_by(Stop.name).all()
    data = [{'stop_id': s.id, 'stop_name': s.name, 'students_count': s.students_count()} for s in stops]
    return jsonify({'success': True, 'data': data})


@transport_reports_bp.route('/reports/students-without-transport', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_students_without_transport():
    sid = _school_id()
    assigned_ids = {a.student_id for a in
                    StudentTransport.query.filter_by(school_id=sid, status='ACTIVE').all()}
    q = Student.query.filter(Student.school_id == sid)
    if assigned_ids:
        q = q.filter(~Student.id.in_(assigned_ids))

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    p = q.order_by(Student.admission_no).paginate(page=page, per_page=per_page, error_out=False)

    data = [{
        'student_id': s.id, 'admission_no': s.admission_no,
        'name': s.user.name if s.user else '', 'class_id': s.class_id,
        'father_name': s.father_name or '', 'father_mobile': s.parent_phone or '',
    } for s in p.items]

    return jsonify({'success': True, 'data': data, 'total': p.total, 'page': p.page, 'pages': p.pages})


@transport_reports_bp.route('/reports/transport-fee', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_transport_fee():
    """Filters: from_date, to_date, status. Summary + record list."""
    sid = _school_id()
    q = TransportFeeRecord.query.filter_by(school_id=sid)

    status = request.args.get('status', '').upper()
    from app.models.transport_student import FEE_RECORD_STATUSES
    if status in FEE_RECORD_STATUSES:
        q = q.filter_by(status=status)

    from_date = request.args.get('from_date', '').strip()
    to_date = request.args.get('to_date', '').strip()
    if from_date:
        q = q.filter(TransportFeeRecord.due_date >= from_date)
    if to_date:
        q = q.filter(TransportFeeRecord.due_date <= to_date)

    records = q.order_by(TransportFeeRecord.due_date).all()
    total_amount = sum(r.amount or 0 for r in records)
    total_collected = sum(r.paid_amount or 0 for r in records)
    total_pending = sum(r.balance() for r in records)

    return jsonify({'success': True, 'summary': {
        'total_amount': round(total_amount, 2),
        'total_collected': round(total_collected, 2),
        'total_pending': round(total_pending, 2),
        'record_count': len(records),
    }, 'data': [r.to_dict() for r in records]})


@transport_reports_bp.route('/reports/collection', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_collection():
    """Vehicle-wise and route-wise collection totals. Filters: from_date, to_date."""
    sid = _school_id()

    from_date = request.args.get('from_date', '').strip()
    to_date = request.args.get('to_date', '').strip()

    txn_q = db.session.query(TransportFeeTransaction).filter(TransportFeeTransaction.school_id == sid)
    if from_date:
        txn_q = txn_q.filter(TransportFeeTransaction.payment_date >= from_date)
    if to_date:
        txn_q = txn_q.filter(TransportFeeTransaction.payment_date <= to_date)
    transactions = txn_q.all()

    vehicle_totals, route_totals = {}, {}
    for t in transactions:
        record = t.fee_record
        if not record:
            continue
        assignment = StudentTransport.query.filter_by(
            school_id=sid, student_id=record.student_id, status='ACTIVE'
        ).first()
        if assignment and assignment.vehicle:
            vehicle_totals[assignment.vehicle.vehicle_number] = \
                vehicle_totals.get(assignment.vehicle.vehicle_number, 0) + (t.amount_paid or 0)
        if assignment and assignment.route:
            route_totals[assignment.route.name] = \
                route_totals.get(assignment.route.name, 0) + (t.amount_paid or 0)

    return jsonify({'success': True, 'data': {
        'vehicle_wise': [{'vehicle_number': k, 'amount': round(v, 2)} for k, v in vehicle_totals.items()],
        'route_wise':   [{'route_name': k, 'amount': round(v, 2)} for k, v in route_totals.items()],
    }})


@transport_reports_bp.route('/reports/maintenance', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_maintenance():
    """Filters: from_date, to_date, status."""
    sid = _school_id()
    q = VehicleMaintenance.query.filter_by(school_id=sid)

    status = request.args.get('status', '').upper()
    from app.models.transport import MAINTENANCE_STATUSES
    if status in MAINTENANCE_STATUSES:
        q = q.filter_by(status=status)

    from_date = request.args.get('from_date', '').strip()
    to_date = request.args.get('to_date', '').strip()
    if from_date:
        q = q.filter(VehicleMaintenance.reported_date >= from_date)
    if to_date:
        q = q.filter(VehicleMaintenance.reported_date <= to_date)

    rows = q.order_by(VehicleMaintenance.reported_date.desc()).all()
    total_cost = sum(r.cost or 0 for r in rows)

    return jsonify({'success': True, 'summary': {'total_cost': round(total_cost, 2), 'record_count': len(rows)},
                     'data': [r.to_dict() for r in rows]})


@transport_reports_bp.route('/reports/vehicle-utilization', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_vehicle_utilization():
    """capacity vs students_assigned, per vehicle — highlights under/over-utilized buses."""
    sid = _school_id()
    vehicles = Vehicle.query.filter_by(school_id=sid).order_by(Vehicle.vehicle_number).all()
    data = []
    for v in vehicles:
        assigned = v.student_count()
        capacity = v.capacity or 0
        utilization_pct = round((assigned / capacity) * 100, 1) if capacity > 0 else None
        data.append({
            'vehicle_id': v.id, 'vehicle_number': v.vehicle_number, 'capacity': capacity,
            'students_assigned': assigned, 'utilization_pct': utilization_pct, 'status': v.status,
        })
    return jsonify({'success': True, 'data': data})


@transport_reports_bp.route('/reports/transfer-history', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def report_transfer_history():
    """Filters: student_id, transfer_type, from_date, to_date."""
    sid = _school_id()
    q = TransportTransferHistory.query.filter_by(school_id=sid)

    student_id = request.args.get('student_id', type=int)
    if student_id:
        q = q.filter_by(student_id=student_id)

    from app.models.transport_student import TRANSFER_TYPES
    transfer_type = request.args.get('transfer_type', '').upper()
    if transfer_type in TRANSFER_TYPES:
        q = q.filter_by(transfer_type=transfer_type)

    from_date = request.args.get('from_date', '').strip()
    to_date = request.args.get('to_date', '').strip()
    if from_date:
        q = q.filter(TransportTransferHistory.transfer_date >= from_date)
    if to_date:
        q = q.filter(TransportTransferHistory.transfer_date <= to_date)

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    p = q.order_by(TransportTransferHistory.transfer_date.desc()) \
         .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({'success': True, 'data': [r.to_dict() for r in p.items],
                     'total': p.total, 'page': p.page, 'pages': p.pages})
