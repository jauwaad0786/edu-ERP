from flask import Blueprint, request, jsonify
from datetime import datetime, date
from app import db
from app.models.academic import Student, Class
from app.models.transport import Vehicle, Route, Stop
from app.models.financial import FeeRecord, FeeTransaction
from app.models.transport_student import (
    StudentTransport, TransportTransferHistory,
    TransportFeeStructure, TransportFeeRecord, TransportFeeTransaction, TransportFineRecord,
    FEE_FREQUENCIES, FEE_RECORD_STATUSES, PAYMENT_MODES
)
from app.services.transport_fee_service import (
    generate_transport_fee_record, record_transport_fee_payment,
    create_transport_fine, record_transport_fine_payment, waive_transport_fine
)
from app.utils.decorators import role_required, get_current_user

transport_student_bp = Blueprint('transport_student', __name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _school_id():
    return get_current_user().school_id


def bad_request(msg):
    return jsonify({'success': False, 'message': msg}), 400


def not_found(msg='Not found'):
    return jsonify({'success': False, 'message': msg}), 404


def _active_assignment(student_id, sid):
    return StudentTransport.query.filter_by(
        school_id=sid, student_id=student_id, status='ACTIVE'
    ).first()


# ═══════════════════════════════════════════════════════════════════════════
#  STUDENT BROWSE — powers "Add Student to Transport" screen
# ═══════════════════════════════════════════════════════════════════════════

@transport_student_bp.route('/students', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def browse_students():
    """
    Filters: academic_year, class_id, section, search (name/admission_no),
    transport_status (WITH / WITHOUT / ALL, default ALL), vehicle_id, route_id,
    stop_id, fee_status (PENDING/PARTIAL/PAID/OVERDUE/WAIVED).

    Left-joins StudentTransport so students with no assignment still show up
    (needed for the "students without transport" filter) — Student stays the
    driving table, not StudentTransport.
    """
    sid = _school_id()
    q = db.session.query(Student).filter(Student.school_id == sid)

    academic_year = request.args.get('academic_year', '').strip()
    if academic_year:
        q = q.filter(Student.session == academic_year)

    class_id = request.args.get('class_id', type=int)
    if class_id:
        q = q.filter(Student.class_id == class_id)

    section = request.args.get('section', '').strip()
    if section:
        q = q.join(Class, Student.class_id == Class.id).filter(Class.section == section)

    search = request.args.get('search', '').strip()
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Student.admission_no.ilike(like), Student.father_name.ilike(like)))
        # name lives on User; join only when actually searching, keeps the common path light
        from app.models.user import User
        q = q.outerjoin(User, Student.user_id == User.id).filter(
            db.or_(Student.admission_no.ilike(like), User.name.ilike(like))
        )

    transport_status = request.args.get('transport_status', 'ALL').upper()
    vehicle_id = request.args.get('vehicle_id', type=int)
    route_id = request.args.get('route_id', type=int)
    stop_id = request.args.get('stop_id', type=int)

    student_ids_with_transport = None
    if transport_status in ('WITH', 'WITHOUT') or vehicle_id or route_id or stop_id:
        assign_q = StudentTransport.query.filter_by(school_id=sid, status='ACTIVE')
        if vehicle_id:
            assign_q = assign_q.filter_by(vehicle_id=vehicle_id)
        if route_id:
            assign_q = assign_q.filter_by(route_id=route_id)
        if stop_id:
            assign_q = assign_q.filter_by(stop_id=stop_id)
        student_ids_with_transport = {a.student_id for a in assign_q.all()}

        if transport_status == 'WITH' or vehicle_id or route_id or stop_id:
            q = q.filter(Student.id.in_(student_ids_with_transport or {-1}))
        elif transport_status == 'WITHOUT':
            all_active = {a.student_id for a in
                          StudentTransport.query.filter_by(school_id=sid, status='ACTIVE').all()}
            q = q.filter(~Student.id.in_(all_active or {-1}))

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 200)
    total = q.count()
    students = q.order_by(Student.admission_no).offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for s in students:
        assignment = _active_assignment(s.id, sid)
        fee_status = None
        if assignment:
            latest_fee = TransportFeeRecord.query.filter_by(
                school_id=sid, student_id=s.id
            ).order_by(TransportFeeRecord.created_at.desc()).first()
            fee_status = latest_fee.status if latest_fee else None

        results.append({
            'student_id':      s.id,
            'admission_no':    s.admission_no,
            'name':            s.user.name if s.user else '',
            'class_id':        s.class_id,
            'class_name':      f"{s.class_ref.name} {s.class_ref.section or ''}".strip() if s.class_ref else '',
            'father_name':     s.father_name or '',
            'father_mobile':   s.parent_phone or '',
            'photo_url':       s.photo_url or '',
            'has_transport':   assignment is not None,
            'vehicle_id':      assignment.vehicle_id if assignment else None,
            'vehicle_number':  assignment.vehicle.vehicle_number if (assignment and assignment.vehicle) else '',
            'route_id':        assignment.route_id if assignment else None,
            'route_name':      assignment.route.name if (assignment and assignment.route) else '',
            'stop_id':         assignment.stop_id if assignment else None,
            'stop_name':       assignment.stop.name if (assignment and assignment.stop) else '',
            'fee_status':      fee_status,
        })

    fee_status_filter = request.args.get('fee_status', '').upper()
    if fee_status_filter in FEE_RECORD_STATUSES:
        results = [r for r in results if r['fee_status'] == fee_status_filter]

    return jsonify({'success': True, 'data': results, 'total': total, 'page': page})


# ═══════════════════════════════════════════════════════════════════════════
#  ASSIGN / TRANSFER / REMOVE
# ═══════════════════════════════════════════════════════════════════════════

@transport_student_bp.route('/students/assign', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def assign_students():
    """
    Bulk assign — checkbox multi-select + Assign button on the frontend.
    Body: { student_ids: [...], vehicle_id, route_id, stop_id, pickup_stop_id, drop_stop_id, academic_year }
    """
    sid = _school_id()
    data = request.get_json() or {}

    student_ids = data.get('student_ids') or []
    if not student_ids:
        return bad_request('student_ids is required')

    vehicle_id = data.get('vehicle_id')
    route_id = data.get('route_id')
    stop_id = data.get('stop_id')
    pickup_stop_id = data.get('pickup_stop_id') or stop_id
    drop_stop_id = data.get('drop_stop_id') or stop_id
    academic_year = data.get('academic_year', '')

    if vehicle_id and not Vehicle.query.filter_by(id=vehicle_id, school_id=sid).first():
        return bad_request('Invalid vehicle_id')
    if route_id and not Route.query.filter_by(id=route_id, school_id=sid).first():
        return bad_request('Invalid route_id')
    if pickup_stop_id and not Stop.query.filter_by(id=pickup_stop_id, school_id=sid).first():
        return bad_request('Invalid pickup_stop_id')
    if drop_stop_id and not Stop.query.filter_by(id=drop_stop_id, school_id=sid).first():
        return bad_request('Invalid drop_stop_id')

    user = get_current_user()
    assigned, transferred = [], []

    for student_id in student_ids:
        student = Student.query.filter_by(id=student_id, school_id=sid).first()
        if not student:
            continue

        existing = _active_assignment(student_id, sid)

        if not existing:
            row = StudentTransport(
                school_id=sid, student_id=student_id,
                vehicle_id=vehicle_id, route_id=route_id,
                stop_id=pickup_stop_id or stop_id,
                pickup_stop_id=pickup_stop_id,
                drop_stop_id=drop_stop_id,
                academic_year=academic_year, assigned_date=date.today(),
                status='ACTIVE', created_by=user.id,
            )
            db.session.add(row)
            db.session.add(TransportTransferHistory(
                school_id=sid, student_id=student_id, transfer_type='ADDED',
                to_vehicle_id=vehicle_id, to_route_id=route_id, to_stop_id=pickup_stop_id or stop_id,
                remarks='Added to transport', created_by=user.id,
            ))
            assigned.append(student_id)
        else:
            changes = []
            if vehicle_id and vehicle_id != existing.vehicle_id:
                changes.append(('VEHICLE_CHANGE', 'from_vehicle_id', 'to_vehicle_id', existing.vehicle_id, vehicle_id))
            if route_id and route_id != existing.route_id:
                changes.append(('ROUTE_CHANGE', 'from_route_id', 'to_route_id', existing.route_id, route_id))
            if pickup_stop_id and pickup_stop_id != (existing.pickup_stop_id or existing.stop_id):
                changes.append(('STOP_CHANGE', 'from_stop_id', 'to_stop_id', existing.pickup_stop_id or existing.stop_id, pickup_stop_id))

            for transfer_type, from_field, to_field, from_val, to_val in changes:
                db.session.add(TransportTransferHistory(**{
                    'school_id': sid, 'student_id': student_id, 'transfer_type': transfer_type,
                    from_field: from_val, to_field: to_val,
                    'remarks': 'Updated via Assign', 'created_by': user.id,
                }))

            existing.vehicle_id = vehicle_id or existing.vehicle_id
            existing.route_id = route_id or existing.route_id
            existing.stop_id = pickup_stop_id or stop_id or existing.stop_id
            existing.pickup_stop_id = pickup_stop_id or existing.pickup_stop_id
            existing.drop_stop_id = drop_stop_id or existing.drop_stop_id
            existing.academic_year = academic_year or existing.academic_year
            existing.updated_at = datetime.utcnow()
            if changes:
                transferred.append(student_id)

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'{len(assigned)} assigned, {len(transferred)} transferred',
        'assigned': assigned, 'transferred': transferred,
    })


@transport_student_bp.route('/students/<int:student_id>/transfer', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def transfer_student(student_id):
    """Single-student change of vehicle/route/stop, with an explicit remark (transfer reason)."""
    sid = _school_id()
    existing = _active_assignment(student_id, sid)
    if not existing:
        return not_found('Student has no active transport assignment')

    data = request.get_json() or {}
    user = get_current_user()

    vehicle_id = data.get('vehicle_id', existing.vehicle_id)
    route_id = data.get('route_id', existing.route_id)
    stop_id = data.get('stop_id', existing.stop_id)
    pickup_stop_id = data.get('pickup_stop_id', existing.pickup_stop_id or stop_id)
    drop_stop_id = data.get('drop_stop_id', existing.drop_stop_id or stop_id)
    remarks = data.get('remarks', '')

    if vehicle_id and vehicle_id != existing.vehicle_id and \
       not Vehicle.query.filter_by(id=vehicle_id, school_id=sid).first():
        return bad_request('Invalid vehicle_id')
    if route_id and route_id != existing.route_id and \
       not Route.query.filter_by(id=route_id, school_id=sid).first():
        return bad_request('Invalid route_id')
    if pickup_stop_id and not Stop.query.filter_by(id=pickup_stop_id, school_id=sid).first():
        return bad_request('Invalid pickup_stop_id')
    if drop_stop_id and not Stop.query.filter_by(id=drop_stop_id, school_id=sid).first():
        return bad_request('Invalid drop_stop_id')

    if vehicle_id != existing.vehicle_id:
        db.session.add(TransportTransferHistory(
            school_id=sid, student_id=student_id, transfer_type='VEHICLE_CHANGE',
            from_vehicle_id=existing.vehicle_id, to_vehicle_id=vehicle_id,
            remarks=remarks, created_by=user.id,
        ))
    if route_id != existing.route_id:
        db.session.add(TransportTransferHistory(
            school_id=sid, student_id=student_id, transfer_type='ROUTE_CHANGE',
            from_route_id=existing.route_id, to_route_id=route_id,
            remarks=remarks, created_by=user.id,
        ))
    if pickup_stop_id != (existing.pickup_stop_id or existing.stop_id):
        db.session.add(TransportTransferHistory(
            school_id=sid, student_id=student_id, transfer_type='STOP_CHANGE',
            from_stop_id=existing.pickup_stop_id or existing.stop_id, to_stop_id=pickup_stop_id,
            remarks=remarks, created_by=user.id,
        ))

    existing.vehicle_id, existing.route_id = vehicle_id, route_id
    existing.stop_id = pickup_stop_id or stop_id
    existing.pickup_stop_id = pickup_stop_id
    existing.drop_stop_id = drop_stop_id
    existing.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'data': existing.to_dict()})


@transport_student_bp.route('/students/<int:student_id>/remove', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def remove_student(student_id):
    sid = _school_id()
    existing = _active_assignment(student_id, sid)
    if not existing:
        return not_found('Student has no active transport assignment')

    data = request.get_json() or {}
    remarks = data.get('remarks', '')
    user = get_current_user()

    db.session.add(TransportTransferHistory(
        school_id=sid, student_id=student_id, transfer_type='REMOVED',
        from_vehicle_id=existing.vehicle_id, from_route_id=existing.route_id,
        from_stop_id=existing.stop_id, remarks=remarks, created_by=user.id,
    ))
    existing.status = 'REMOVED'
    existing.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'success': True, 'message': 'Removed from transport'})


@transport_student_bp.route('/students/<int:student_id>/transport', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def get_student_transport(student_id):
    sid = _school_id()
    existing = _active_assignment(student_id, sid)
    return jsonify({'success': True, 'data': existing.to_dict() if existing else None})


@transport_student_bp.route('/students/<int:student_id>/history', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def get_student_transfer_history(student_id):
    sid = _school_id()
    rows = TransportTransferHistory.query.filter_by(
        school_id=sid, student_id=student_id
    ).order_by(TransportTransferHistory.transfer_date.desc()).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in rows]})


# ═══════════════════════════════════════════════════════════════════════════
#  FEE STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════

@transport_student_bp.route('/fee-structures', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def list_fee_structures():
    sid = _school_id()
    q = TransportFeeStructure.query.filter_by(school_id=sid)
    route_id = request.args.get('route_id', type=int)
    if route_id:
        q = q.filter_by(route_id=route_id)
    rows = q.order_by(TransportFeeStructure.name).all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in rows]})


@transport_student_bp.route('/fee-structures', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def create_fee_structure():
    sid = _school_id()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    if not name:
        return bad_request('name is required')
    if data.get('frequency') and data['frequency'] not in FEE_FREQUENCIES:
        return bad_request(f'frequency must be one of {FEE_FREQUENCIES}')

    row = TransportFeeStructure(
        school_id=sid, name=name,
        frequency=data.get('frequency', 'MONTHLY'),
        amount=data.get('amount', 0),
        route_id=data.get('route_id'),
        academic_year=data.get('academic_year', ''),
        created_by=get_current_user().id,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({'success': True, 'data': row.to_dict()}), 201


@transport_student_bp.route('/fee-structures/<int:fs_id>', methods=['PUT'])
@role_required('PRINCIPAL', 'TRANSPORT')
def update_fee_structure(fs_id):
    sid = _school_id()
    row = TransportFeeStructure.query.filter_by(id=fs_id, school_id=sid).first()
    if not row:
        return not_found('Fee structure not found')

    data = request.get_json() or {}
    if 'frequency' in data and data['frequency'] not in FEE_FREQUENCIES:
        return bad_request(f'frequency must be one of {FEE_FREQUENCIES}')

    for field in ['name', 'frequency', 'amount', 'route_id', 'academic_year', 'status']:
        if field in data:
            setattr(row, field, data[field])

    db.session.commit()
    return jsonify({'success': True, 'data': row.to_dict()})


@transport_student_bp.route('/fee-structures/<int:fs_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_fee_structure(fs_id):
    sid = _school_id()
    row = TransportFeeStructure.query.filter_by(id=fs_id, school_id=sid).first()
    if not row:
        return not_found('Fee structure not found')

    in_use = TransportFeeRecord.query.filter_by(fee_structure_id=row.id).first()
    if in_use:
        return bad_request('Fee structure has generated records and cannot be deleted. Mark inactive instead.')

    db.session.delete(row)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Fee structure deleted'})


# ═══════════════════════════════════════════════════════════════════════════
#  FEE RECORDS + COLLECTION
# ═══════════════════════════════════════════════════════════════════════════

@transport_student_bp.route('/fee-records', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def list_fee_records():
    sid = _school_id()
    q = TransportFeeRecord.query.filter_by(school_id=sid)

    student_id = request.args.get('student_id', type=int)
    if student_id:
        q = q.filter_by(student_id=student_id)

    status = request.args.get('status', '').upper()
    if status in FEE_RECORD_STATUSES:
        q = q.filter_by(status=status)

    period_label = request.args.get('period_label', '').strip()
    if period_label:
        q = q.filter_by(period_label=period_label)

    vehicle_id = request.args.get('vehicle_id', type=int)
    route_id = request.args.get('route_id', type=int)
    if vehicle_id or route_id:
        assign_q = StudentTransport.query.filter_by(school_id=sid, status='ACTIVE')
        if vehicle_id:
            assign_q = assign_q.filter_by(vehicle_id=vehicle_id)
        if route_id:
            assign_q = assign_q.filter_by(route_id=route_id)
        student_ids = {a.student_id for a in assign_q.all()} or {-1}
        q = q.filter(TransportFeeRecord.student_id.in_(student_ids))

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 200)
    p = q.order_by(TransportFeeRecord.due_date).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': [r.to_dict() for r in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages,
    })


@transport_student_bp.route('/fee-records/generate', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def generate_fee_records():
    """
    Body: { fee_structure_id, period_label, due_date }
    Generates one central FeeRecord (source='TRANSPORT') and TransportFeeRecord per ACTIVE student.
    Skips students who already have a record for this exact period_label — safe to re-run.
    """
    sid = _school_id()
    data = request.get_json() or {}

    fs = TransportFeeStructure.query.filter_by(
        id=data.get('fee_structure_id'), school_id=sid
    ).first()
    if not fs:
        return bad_request('Invalid fee_structure_id')

    period_label = (data.get('period_label') or '').strip()
    if not period_label:
        return bad_request('period_label is required')

    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        except ValueError:
            return bad_request('due_date must be YYYY-MM-DD')

    assign_q = StudentTransport.query.filter_by(school_id=sid, status='ACTIVE')
    if fs.route_id:
        assign_q = assign_q.filter_by(route_id=fs.route_id)
    assignments = assign_q.all()

    user = get_current_user()
    created, skipped = 0, 0
    for a in assignments:
        rec, status = generate_transport_fee_record(
            assignment=a,
            created_by_id=user.id,
            month=period_label,
            fee_structure_id=fs.id,
            due_date=due_date
        )
        if status == 'created':
            created += 1
        else:
            skipped += 1

    db.session.commit()
    return jsonify({
        'success': True,
        'message': f'{created} fee record(s) generated, {skipped} already existed or skipped',
        'created': created, 'skipped': skipped,
    })


@transport_student_bp.route('/fee-records/<int:record_id>/collect', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def collect_fee(record_id):
    """
    Body: { amount_paid, payment_mode, transaction_ref, receipt_number, remarks }
    Collects payment into central financial ledger with mutex-locked double-payment protection.
    """
    sid = _school_id()
    record = TransportFeeRecord.query.filter_by(id=record_id, school_id=sid).first()
    if not record:
        return not_found('Fee record not found')

    data = request.get_json() or {}
    try:
        amount_paid = float(data.get('amount_paid', 0))
    except (TypeError, ValueError):
        return bad_request('amount_paid must be a valid number')

    if amount_paid <= 0:
        return bad_request('amount_paid must be greater than 0')

    payment_mode = data.get('payment_mode', 'CASH')
    if payment_mode not in PAYMENT_MODES:
        return bad_request(f'payment_mode must be one of {PAYMENT_MODES}')

    # Find or link corresponding central FeeRecord
    fee_rec = FeeRecord.query.filter_by(
        school_id=sid, student_id=record.student_id,
        source='TRANSPORT'
    ).order_by(FeeRecord.created_at.desc()).first()

    if not fee_rec:
        fee_rec = FeeRecord(
            school_id=sid,
            student_id=record.student_id,
            fee_type='TRANSPORT',
            amount_due=record.amount,
            amount_paid=0.0,
            status='PENDING',
            month=record.period_label,
            due_date=record.due_date,
            source='TRANSPORT',
            remarks=f"Transport Fee ({record.period_label})",
            collected_by=get_current_user().id,
        )
        db.session.add(fee_rec)
        db.session.flush()

    try:
        updated_rec, txn = record_transport_fee_payment(
            fee_rec,
            amount_paid,
            payment_mode=payment_mode,
            remarks=data.get('remarks', ''),
            collected_by_user=get_current_user(),
            transaction_ref=data.get('transaction_ref', ''),
            receipt_number=data.get('receipt_number', '')
        )
        # Refresh local record
        db.session.refresh(record)
        return jsonify({
            'success': True,
            'message': 'Payment collected successfully',
            'data': record.to_dict(),
            'central_fee_record': updated_rec.to_dict(),
            'transaction': txn.to_dict(),
        }), 201
    except ValueError as e:
        return bad_request(str(e))


@transport_student_bp.route('/fee-records/<int:record_id>/waive', methods=['POST'])
@role_required('PRINCIPAL')
def waive_fee(record_id):
    """Body: { waiver, remarks } — Principal-only."""
    sid = _school_id()
    record = TransportFeeRecord.query.filter_by(id=record_id, school_id=sid).first()
    if not record:
        return not_found('Fee record not found')

    data = request.get_json() or {}
    try:
        waiver = float(data.get('waiver', 0))
    except (TypeError, ValueError):
        return bad_request('waiver must be a non-negative number')

    if waiver < 0:
        return bad_request('waiver must be a non-negative number')

    record.waiver = waiver
    if record.balance() <= 0:
        record.status = 'WAIVED' if waiver >= (record.amount or 0) else 'PAID'

    # Sync linked central FeeRecord
    fee_rec = FeeRecord.query.filter_by(
        school_id=sid, student_id=record.student_id, source='TRANSPORT'
    ).order_by(FeeRecord.created_at.desc()).first()

    if fee_rec:
        fee_rec.discount = (fee_rec.discount or 0.0) + waiver
        fee_rec.discount_reason = data.get('remarks', 'Transport Fee Waiver')
        fee_rec.adjusted_by = get_current_user().id
        fee_rec.adjusted_at = datetime.utcnow()
        if (fee_rec.amount_paid or 0.0) >= fee_rec.effective_due():
            fee_rec.status = 'WAIVED' if (fee_rec.amount_paid or 0.0) == 0 else 'PAID'

    db.session.commit()
    return jsonify({'success': True, 'data': record.to_dict()})


@transport_student_bp.route('/fee-records/<int:record_id>/transactions', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def list_fee_transactions(record_id):
    sid = _school_id()
    record = TransportFeeRecord.query.filter_by(id=record_id, school_id=sid).first()
    if not record:
        return not_found('Fee record not found')

    rows = record.transactions.order_by(TransportFeeTransaction.payment_date.desc()).all()
    return jsonify({'success': True, 'data': [t.to_dict() for t in rows]})


# ═══════════════════════════════════════════════════════════════════════════
#  TRANSPORT FINES & PENALTIES (Damage, Late fee, Misconduct)
# ═══════════════════════════════════════════════════════════════════════════

@transport_student_bp.route('/fines', methods=['GET'])
@role_required('PRINCIPAL', 'TRANSPORT')
def list_transport_fines():
    sid = _school_id()
    q = TransportFineRecord.query.filter_by(school_id=sid)

    student_id = request.args.get('student_id', type=int)
    if student_id:
        q = q.filter_by(student_id=student_id)

    status = request.args.get('status', '').upper()
    if status:
        q = q.filter_by(status=status)

    fine_type = request.args.get('fine_type')
    if fine_type:
        q = q.filter_by(fine_type=fine_type)

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 25, type=int), 100)
    p = q.order_by(TransportFineRecord.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'success': True,
        'data': [f.to_dict() for f in p.items],
        'total': p.total, 'page': p.page, 'pages': p.pages
    })


@transport_student_bp.route('/fines', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def create_fine():
    """
    Body: { student_id, amount, fine_type, reason }
    Creates a transport fine and links central FeeRecord (source='TRANSPORT_FINE').
    """
    sid = _school_id()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    if not student_id:
        return bad_request('student_id is required')

    student = Student.query.filter_by(id=student_id, school_id=sid).first()
    if not student:
        return not_found('Student not found')

    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return bad_request('amount must be a positive number')

    if amount <= 0:
        return bad_request('amount must be greater than 0')

    fine_type = data.get('fine_type', 'LATE_PAYMENT')
    reason = data.get('reason', '')

    try:
        fine = create_transport_fine(
            school_id=sid,
            student_id=student_id,
            amount=amount,
            fine_type=fine_type,
            reason=reason,
            created_by_user=get_current_user(),
        )
        return jsonify({'success': True, 'message': 'Transport fine created', 'data': fine.to_dict()}), 201
    except ValueError as e:
        return bad_request(str(e))


@transport_student_bp.route('/fines/<int:fine_id>/collect', methods=['POST'])
@role_required('PRINCIPAL', 'TRANSPORT')
def collect_fine_payment(fine_id):
    """Body: { amount_paid, payment_mode, remarks }"""
    sid = _school_id()
    fine = TransportFineRecord.query.filter_by(id=fine_id, school_id=sid).first()
    if not fine:
        return not_found('Fine record not found')

    data = request.get_json() or {}
    try:
        amount = float(data.get('amount_paid') or data.get('amount', 0))
    except (TypeError, ValueError):
        return bad_request('amount must be a valid number')

    if amount <= 0:
        return bad_request('amount must be greater than 0')

    payment_mode = data.get('payment_mode', 'CASH')
    remarks = data.get('remarks', '')

    try:
        updated_fine = record_transport_fine_payment(
            fine, amount, payment_mode=payment_mode, remarks=remarks, collected_by_user=get_current_user()
        )
        return jsonify({'success': True, 'message': 'Fine payment collected', 'data': updated_fine.to_dict()})
    except ValueError as e:
        return bad_request(str(e))


@transport_student_bp.route('/fines/<int:fine_id>/waive', methods=['POST'])
@role_required('PRINCIPAL')
def waive_transport_fine_route(fine_id):
    """Body: { waiver_amount, reason } — Principal only."""
    sid = _school_id()
    fine = TransportFineRecord.query.filter_by(id=fine_id, school_id=sid).first()
    if not fine:
        return not_found('Fine record not found')

    data = request.get_json() or {}
    try:
        waiver_amount = float(data.get('waiver_amount') or data.get('waiver', 0))
    except (TypeError, ValueError):
        return bad_request('waiver_amount must be a positive number')

    if waiver_amount <= 0:
        return bad_request('waiver_amount must be greater than 0')

    reason = data.get('reason', '')
    try:
        updated_fine = waive_transport_fine(
            fine, waiver_amount=waiver_amount, reason=reason, waived_by_user=get_current_user()
        )
        return jsonify({'success': True, 'message': 'Fine waived successfully', 'data': updated_fine.to_dict()})
    except ValueError as e:
        return bad_request(str(e))

