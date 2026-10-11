"""
Arrival Blueprint
Provides REST API endpoints for Student School Arrival Notifications and Parent Interactive Confirmations (YES / NO).
"""

from flask import Blueprint, request, jsonify
from app import db
from app.services.arrival_service import ArrivalService
from app.models.arrival import StudentArrivalEvent
from app.utils.decorators import role_required, get_current_user
from app.models.user import UserRole

arrival_bp = Blueprint('arrival', __name__)

STAFF_ROLES = ('PRINCIPAL', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER', 'SUPER_ADMIN')
PARENT_ROLES = ('PARENT', 'STUDENT', 'SUPER_ADMIN')
ALL_ARRIVAL_ROLES = STAFF_ROLES + PARENT_ROLES


# ─── 1. Staff: Record Physical Student Arrival ───────────────────────────────
@arrival_bp.route('/record', methods=['POST'])
@role_required(*STAFF_ROLES)
def record_arrival():
    """
    POST /api/arrivals/record
    Body: { student_id, arrival_time (optional), arrival_date (optional), notes (optional) }
    """
    actor = get_current_user()
    data = request.get_json() or {}

    student_id = data.get('student_id')
    if not student_id:
        return jsonify({'error': 'student_id is required'}), 400

    try:
        event, created = ArrivalService.record_arrival(
            school_id=actor.school_id,
            student_id=int(student_id),
            recorded_by_user=actor,
            arrival_time=data.get('arrival_time'),
            arrival_date=data.get('arrival_date'),
            notes=data.get('notes')
        )
        if not created:
            return jsonify({
                'success': False,
                'created': False,
                'error': 'Arrival already marked for this student today',
                'event': event.to_dict()
            }), 409
        return jsonify({
            'success': True,
            'created': True,
            'message': "Arrival notification dispatched to parent",
            'event': event.to_dict()
        }), 201
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 404
    except Exception as e:
        return jsonify({'error': f"Failed to record arrival: {str(e)}"}), 500


# ─── 2. Staff: Record Bulk Arrivals ──────────────────────────────────────────
@arrival_bp.route('/bulk-record', methods=['POST'])
@role_required(*STAFF_ROLES)
def record_bulk_arrivals():
    """
    POST /api/arrivals/bulk-record
    Body: { student_ids: [1, 2, ...], arrival_date (optional) }
    """
    actor = get_current_user()
    data = request.get_json() or {}
    student_ids = data.get('student_ids') or []

    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({'error': 'student_ids list is required'}), 400

    result = ArrivalService.record_bulk_arrivals(
        school_id=actor.school_id,
        student_ids=student_ids,
        recorded_by_user=actor,
        arrival_date=data.get('arrival_date')
    )
    return jsonify({'success': True, **result}), 201


# ─── 3. Staff: Live School Arrival Dashboard ─────────────────────────────────
@arrival_bp.route('/dashboard', methods=['GET'])
@role_required(*STAFF_ROLES)
def arrival_dashboard():
    """
    GET /api/arrivals/dashboard
    Query params: date, class_id, status, student_id, page, per_page
    """
    actor = get_current_user()
    arrival_date = request.args.get('date')
    class_id = request.args.get('class_id', type=int)
    response_status = request.args.get('status')
    student_id = request.args.get('student_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    data = ArrivalService.get_school_dashboard(
        school_id=actor.school_id,
        arrival_date=arrival_date,
        class_id=class_id,
        response_status=response_status,
        student_id=student_id,
        page=page,
        per_page=per_page
    )
    return jsonify(data), 200


# ─── 4. Staff: Resolve Discrepancy (Parent reported NO) ──────────────────────
@arrival_bp.route('/<int:event_id>/resolve', methods=['POST', 'PATCH'])
@role_required(*STAFF_ROLES)
def resolve_discrepancy(event_id):
    """
    POST /api/arrivals/<event_id>/resolve
    Body: { notes: "Verified physical presence in classroom" }
    """
    actor = get_current_user()
    data = request.get_json() or {}
    notes = data.get('notes') or data.get('resolution_notes') or ''

    try:
        updated = ArrivalService.resolve_discrepancy(
            event_id=event_id,
            staff_user=actor,
            resolution_notes=notes
        )
        return jsonify({
            'success': True,
            'message': 'Discrepancy marked as resolved',
            'event': updated
        }), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── 5. Parent: Fetch Pending & Today's Arrival Confirmations ─────────────────
@arrival_bp.route('/parent/pending', methods=['GET'])
@role_required(*PARENT_ROLES)
def parent_pending_arrivals():
    """
    GET /api/arrivals/parent/pending
    Returns arrival notification cards for the logged-in parent's child(ren).
    """
    user = get_current_user()
    events = ArrivalService.get_parent_pending_confirmations(user)
    return jsonify({'success': True, 'events': events}), 200


# ─── 6. Parent: Interactive Response Submission (YES / NO) ───────────────────
@arrival_bp.route('/<int:event_id>/respond', methods=['POST'])
@role_required(*PARENT_ROLES)
def respond_arrival(event_id):
    """
    POST /api/arrivals/<event_id>/respond
    Body: { response: 'YES' | 'NO', notes (optional) }
    """
    user = get_current_user()
    data = request.get_json() or {}
    response_val = data.get('response') or data.get('action') or ''

    if not response_val:
        return jsonify({'error': 'response is required (must be YES or NO)'}), 400

    try:
        result = ArrivalService.record_parent_response(
            event_id_or_uuid=event_id,
            response_value=response_val,
            parent_user=user,
            response_notes=data.get('notes')
        )
        if result.get('already_responded'):
            return jsonify({
                'error': f"Arrival already confirmed as {result.get('status')}",
                **result
            }), 409
        if result.get('expired'):
            return jsonify({
                'error': 'Arrival confirmation window has expired',
                **result
            }), 410
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except PermissionError as pe:
        return jsonify({'error': str(pe)}), 403
    except Exception as e:
        return jsonify({'error': f"Failed to record response: {str(e)}"}), 500


# ─── 7. Public / Direct UUID Response (From SMS / WhatsApp / Push link) ──────
@arrival_bp.route('/uuid/<string:event_uuid>/respond', methods=['POST'])
def respond_arrival_by_uuid(event_uuid):
    """
    POST /api/arrivals/uuid/<event_uuid>/respond
    Allows answering via direct secure token link.
    """
    user = get_current_user() # May be None if unauthenticated
    data = request.get_json() or {}
    response_val = data.get('response') or data.get('action') or ''

    if not response_val:
        return jsonify({'error': 'response is required (must be YES or NO)'}), 400

    try:
        result = ArrivalService.record_parent_response(
            event_id_or_uuid=event_uuid,
            response_value=response_val,
            parent_user=user,
            response_notes=data.get('notes')
        )
        if result.get('already_responded'):
            return jsonify({
                'error': f"Arrival already confirmed as {result.get('status')}",
                **result
            }), 409
        if result.get('expired'):
            return jsonify({
                'error': 'Arrival confirmation window has expired',
                **result
            }), 410
        return jsonify(result), 200
    except ValueError as ve:
        return jsonify({'error': str(ve)}), 400
    except PermissionError as pe:
        return jsonify({'error': str(pe)}), 403
    except Exception as e:
        return jsonify({'error': f"Failed to record response: {str(e)}"}), 500


# ─── 8. Query Event by UUID ──────────────────────────────────────────────────
@arrival_bp.route('/uuid/<string:event_uuid>', methods=['GET'])
def get_arrival_by_uuid(event_uuid):
    """
    GET /api/arrivals/uuid/<event_uuid>
    """
    event = StudentArrivalEvent.query.filter_by(event_uuid=event_uuid).first_or_404()
    d = event.to_dict()
    return jsonify({'success': True, 'event': d, **d}), 200
