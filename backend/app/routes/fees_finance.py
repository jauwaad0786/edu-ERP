"""
Fees & School Finance REST API Blueprint
OnePlatform360 / EduERP (Multi-tenant, school_id scoped)

Routes:
- Dashboard: GET /api/fees-finance/dashboard
- Fee Heads: GET / POST / PATCH /api/fees-finance/heads
- Structures: GET / POST /api/fees-finance/structures
- Student Ledger: GET /api/fees-finance/students/<id>/ledger
- Applicable Charges: GET /api/fees-finance/students/<id>/applicable-charges
- Demand Bills: POST /api/fees-finance/bills/generate, GET /api/fees-finance/bills, GET /api/fees-finance/bills/<id>/pdf
- Payment Collection: POST /api/fees-finance/payments/collect, GET /api/fees-finance/payments, GET /api/fees-finance/payments/<id>/receipt-pdf, POST /api/fees-finance/payments/<id>/cancel
- Concessions & Refunds: GET / POST /api/fees-finance/concessions, GET / POST /api/fees-finance/refunds
- Outstanding Dues: GET /api/fees-finance/outstanding
- Reports: GET /api/fees-finance/reports/...
"""

from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date
from app import db
from app.models.user import User
from app.models.school import School
from app.models.academic import Student, Class
from app.models.finance import Expense
from app.models.hrms import PayrollRun, PayrollSlip, PayrollRunStatus
from app.models.fee_finance import (
    FeeHead, FeeStructureV2, FeeStructureItemV2, StudentFeeAssignment,
    StudentConcession, FeeBill, FeeBillItem, StudentLedger, FeePayment,
    FeePaymentAllocation, FeeRefund, FinancialAuditLog,
    BillStatus, PaymentStatus, FeePaymentPlan
)
from app.services.fee_ledger_service import (
    get_student_ledger, get_student_applicable_charges,
    generate_fee_bill, bulk_generate_fee_bills,
    collect_fee_payment, cancel_payment_receipt,
    process_fee_refund, get_finance_dashboard_metrics,
    ensure_default_fee_heads, apply_concession_and_adjust_bills
)
from app.services import payroll_engine as p_svc
from app.utils.fee_pdf_generator import generate_fee_bill_pdf, generate_fee_receipt_pdf

fees_finance_bp = Blueprint('fees_finance', __name__)


def _get_current_user():
    ident = get_jwt_identity()
    user_id = ident.get('id') if isinstance(ident, dict) else ident
    user = User.query.get(user_id)
    if user and not user.school_id:
        role_name = getattr(user.role, 'value', str(user.role))
        if role_name == 'SUPER_ADMIN':
            sid = request.args.get('school_id', type=int)
            if not sid:
                hdr_sid = request.headers.get('X-School-Id')
                if hdr_sid and str(hdr_sid).isdigit():
                    sid = int(hdr_sid)
            if not sid:
                first_s = School.query.first()
                sid = first_s.id if first_s else None
            if sid:
                user.school_id = sid
    return user


# ═══════════════════════════════════════════════════════════════════════
#  1. EXECUTIVE FINANCE DASHBOARD
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    month   = request.args.get('month', None) # e.g. "2026-09"

    data = get_finance_dashboard_metrics(user.school_id, session=session, month=month)
    return jsonify(data), 200


# ═══════════════════════════════════════════════════════════════════════
#  2. CONFIGURABLE FEE HEADS
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/heads', methods=['GET'])
@jwt_required()
def get_fee_heads():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    ensure_default_fee_heads(user.school_id)
    heads = FeeHead.query.filter_by(school_id=user.school_id).order_by(FeeHead.id.asc()).all()
    return jsonify([h.to_dict() for h in heads]), 200


@fees_finance_bp.route('/heads', methods=['POST'])
@jwt_required()
def create_fee_head():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper().replace(' ', '_')

    if not name or not code:
        return jsonify({'error': 'Name and Code are required.'}), 400

    existing = FeeHead.query.filter_by(school_id=user.school_id, code=code).first()
    if existing:
        return jsonify({'error': f"Fee Head with code '{code}' already exists."}), 400

    fh = FeeHead(
        school_id=user.school_id,
        name=name,
        code=code,
        category=data.get('category', 'ACADEMIC'),
        department=data.get('department', 'ACCOUNTS'),
        income_account=data.get('income_account', 'General School Income'),
        is_recurring=data.get('is_recurring', True),
        default_frequency=data.get('default_frequency', 'MONTHLY'),
        is_refundable=data.get('is_refundable', False),
        description=data.get('description', ''),
        is_active=True,
    )
    db.session.add(fh)
    db.session.commit()
    return jsonify(fh.to_dict()), 201


@fees_finance_bp.route('/heads/<int:head_id>', methods=['PATCH'])
@jwt_required()
def update_fee_head(head_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    fh = FeeHead.query.filter_by(id=head_id, school_id=user.school_id).first_or_404()
    data = request.get_json() or {}

    if 'name' in data:
        fh.name = data['name'].strip()
    if 'category' in data:
        fh.category = data['category']
    if 'department' in data:
        fh.department = data['department']
    if 'income_account' in data:
        fh.income_account = data['income_account']
    if 'is_recurring' in data:
        fh.is_recurring = data['is_recurring']
    if 'default_frequency' in data:
        fh.default_frequency = data['default_frequency']
    if 'is_active' in data:
        fh.is_active = data['is_active']
    if 'description' in data:
        fh.description = data['description']

    db.session.commit()
    return jsonify(fh.to_dict()), 200


# ═══════════════════════════════════════════════════════════════════════
#  3. FEE STRUCTURES (RATE CARDS)
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/structures', methods=['GET'])
@jwt_required()
def get_fee_structures():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    class_id = request.args.get('class_id', None)

    try:
        q = FeeStructureV2.query.filter_by(school_id=user.school_id, session=session, is_active=True)
        if class_id:
            q = q.filter(db.or_(FeeStructureV2.class_id == class_id, FeeStructureV2.class_id.is_(None)))

        structures = q.order_by(FeeStructureV2.class_id.asc()).all()
        results = []
        for s in structures:
            try:
                results.append(s.to_dict())
            except Exception as item_err:
                print(f"[WARN] Error serializing fee structure {s.id}: {item_err}")
        return jsonify(results), 200
    except Exception as ex:
        print(f"[ERROR] get_fee_structures failed: {ex}")
        return jsonify([]), 200


@fees_finance_bp.route('/structures', methods=['POST'])
@jwt_required()
def create_fee_structure():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Structure name is required.'}), 400

    class_id = data.get('class_id')
    session = data.get('session', '2026-27')

    publish_status = data.get('publish_status', 'PUBLISHED')
    if publish_status not in ('PUBLISHED', 'DRAFT'):
        publish_status = 'PUBLISHED'

    struct = FeeStructureV2(
        school_id=user.school_id,
        class_id=class_id if class_id else None,
        session=session,
        name=name,
        frequency=data.get('frequency', 'MONTHLY'),
        due_date_day=int(data.get('due_date_day', 10)),
        is_active=True,
        publish_status=publish_status,
        version=int(data.get('version', 1)),
        created_by=user.id,
    )
    db.session.add(struct)
    db.session.flush()

    # Add items
    for item in data.get('items', []):
        fhi = FeeStructureItemV2(
            structure_id=struct.id,
            fee_head_id=item['fee_head_id'],
            amount=float(item.get('amount', 0.0)),
        )
        db.session.add(fhi)

    db.session.commit()
    return jsonify(struct.to_dict()), 201


@fees_finance_bp.route('/heads/<int:head_id>', methods=['DELETE'])
@jwt_required()
def delete_fee_head(head_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    fh = FeeHead.query.filter_by(id=head_id, school_id=user.school_id).first_or_404()
    # Check if used in active rate cards or bills
    used_items = FeeStructureItemV2.query.filter_by(fee_head_id=head_id).first()
    if used_items:
        # Soft delete
        fh.is_active = False
        db.session.commit()
        return jsonify({'message': f'Fee head {fh.name} marked inactive (referenced in existing rate cards).'}), 200

    db.session.delete(fh)
    db.session.commit()
    return jsonify({'message': 'Fee head deleted successfully.'}), 200


@fees_finance_bp.route('/structures/<int:struct_id>', methods=['PUT', 'PATCH'])
@jwt_required()
def update_fee_structure(struct_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    data = request.get_json() or {}

    if 'name' in data:
        struct.name = data['name'].strip()
    if 'session' in data:
        struct.session = data['session']
    if 'class_id' in data:
        struct.class_id = data['class_id']
    if 'frequency' in data:
        struct.frequency = data['frequency']
    if 'due_date_day' in data:
        try:
            struct.due_date_day = int(data['due_date_day'])
        except (ValueError, TypeError):
            pass
    if 'publish_status' in data:
        if data['publish_status'] in ('PUBLISHED', 'DRAFT'):
            struct.publish_status = data['publish_status']

    if 'items' in data:
        # If structure is already in use by active bills, prevent modifying base amounts
        if struct.is_used():
            old_items = {it.fee_head_id: it.amount for it in struct.items}
            new_items = {int(it['fee_head_id']): float(it.get('amount', 0.0)) for it in data.get('items', [])}
            if old_items != new_items:
                return jsonify({
                    'error': 'Cannot alter base amounts on an in-use Fee Structure with active bills. Please create a new rate card version or archive this structure.',
                    'can_archive': True
                }), 409

        # Replace items if safe
        FeeStructureItemV2.query.filter_by(structure_id=struct.id).delete()
        for item in data.get('items', []):
            fhi = FeeStructureItemV2(
                structure_id=struct.id,
                fee_head_id=item['fee_head_id'],
                amount=float(item.get('amount', 0.0)),
            )
            db.session.add(fhi)

    db.session.commit()
    return jsonify(struct.to_dict()), 200


@fees_finance_bp.route('/structures/<int:struct_id>/archive', methods=['POST', 'PATCH'])
@jwt_required()
def archive_fee_structure(struct_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    struct.is_archived = True
    struct.status = 'ARCHIVED'
    struct.is_active = False
    db.session.commit()
    return jsonify({'message': f'Fee Structure "{struct.name}" archived successfully.', 'structure': struct.to_dict()}), 200


@fees_finance_bp.route('/structures/<int:struct_id>', methods=['DELETE'])
@jwt_required()
def delete_fee_structure(struct_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    if struct.is_used():
        return jsonify({
            'error': f'Rate Card "{struct.name}" is in active use by students or issued bills. Hard delete is disabled to protect financial audit integrity.',
            'can_archive': True,
            'suggestion': 'Please Archive / Deactivate this rate card instead.'
        }), 409

    FeeStructureItemV2.query.filter_by(structure_id=struct.id).delete()
    db.session.delete(struct)
    db.session.commit()
    return jsonify({'message': 'Rate card deleted successfully.'}), 200


# ═══════════════════════════════════════════════════════════════════════
#  3.1 FEE READINESS, CLONING & PAYMENT PLANS LIFECYCLE
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/readiness', methods=['GET'])
@jwt_required()
def get_fee_setup_readiness():
    """Returns academic session fee readiness scorecard for admission planning."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    try:
        classes = Class.query.filter_by(school_id=user.school_id).order_by(Class.name.asc(), Class.section.asc()).all()

        # Get published fee structures for this session
        published_structs = FeeStructureV2.query.filter(
            FeeStructureV2.school_id == user.school_id,
            FeeStructureV2.session == session,
            FeeStructureV2.is_active == True,
            FeeStructureV2.is_archived == False,
            FeeStructureV2.publish_status == 'PUBLISHED'
        ).all()

        school_wide = next((s for s in published_structs if s.class_id is None), None)
        class_map = {s.class_id: s for s in published_structs if s.class_id is not None}

        classes_with_plan = []
        classes_missing_plan = []

        for c in classes:
            c_dict = {'id': c.id, 'name': c.name, 'section': c.section or '', 'display_name': f"{c.name} {c.section or ''}".strip()}
            st = class_map.get(c.id) or school_wide
            if st:
                c_dict['structure_id'] = st.id
                c_dict['structure_name'] = st.name
                c_dict['total_amount'] = st.total_amount()
                c_dict['frequency'] = st.frequency
                classes_with_plan.append(c_dict)
            else:
                classes_missing_plan.append(c_dict)

        # Seed payment plans if none
        try:
            _seed_default_payment_plans(user.school_id, session)
        except Exception as seed_err:
            print(f"[WARN] Error seeding payment plans: {seed_err}")

        try:
            payment_plans = FeePaymentPlan.query.filter_by(
                school_id=user.school_id, session=session, is_active=True
            ).all()
        except Exception:
            payment_plans = []

        # Transport structures & routes
        try:
            from app.models.transport_student import TransportFeeStructure
            from app.models.transport import Route
            tfs_list = TransportFeeStructure.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
            transport_structures = [t.to_dict() for t in tfs_list]
            routes_list = Route.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
            transport_routes = [r.to_dict(include_stops=True, include_counts=True) for r in routes_list]
        except Exception:
            transport_structures = []
            transport_routes = []

        # Hostel structures & hostels
        try:
            from app.models.hostel import HostelFeeStructure, Hostel
            hfs_list = HostelFeeStructure.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
            hostel_structures = [h.to_dict() for h in hfs_list]
            hostel_list = Hostel.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
            hostels = [h.to_dict(include_counts=True) for h in hostel_list]
        except Exception:
            hostel_structures = []
            hostels = []

        return jsonify({
            'session': session,
            'total_classes': len(classes),
            'published_classes_count': len(classes_with_plan),
            'missing_classes_count': len(classes_missing_plan),
            'classes_with_plan': classes_with_plan,
            'classes_missing_plan': classes_missing_plan,
            'is_ready_for_admissions': (len(classes) == 0 or len(classes_missing_plan) == 0) and len(published_structs) > 0,
            'payment_plans_count': len(payment_plans),
            'hostel_fee_count': len(hostel_structures),
            'transport_fee_count': len(transport_structures),
            'transport_structures': transport_structures,
            'transport_routes': transport_routes,
            'hostel_structures': hostel_structures,
            'hostels': hostels,
        }), 200
    except Exception as ex:
        print(f"[ERROR] get_fee_setup_readiness failed: {ex}")
        return jsonify({
            'session': session,
            'total_classes': 0,
            'published_classes_count': 0,
            'missing_classes_count': 0,
            'classes_with_plan': [],
            'classes_missing_plan': [],
            'is_ready_for_admissions': False,
            'payment_plans_count': 0,
            'hostel_fee_count': 0,
            'transport_fee_count': 0,
            'transport_structures': [],
            'transport_routes': [],
            'hostel_structures': [],
            'hostels': [],
        }), 200


@fees_finance_bp.route('/optional-services/transport-fee', methods=['POST'])
@jwt_required()
def create_optional_transport_fee():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Fee slab name is required'}), 400
    try:
        from app.models.transport_student import TransportFeeStructure
        row = TransportFeeStructure(
            school_id=user.school_id,
            name=name,
            frequency=data.get('frequency', 'MONTHLY'),
            amount=float(data.get('amount', 0)),
            route_id=int(data.get('route_id')) if data.get('route_id') else None,
            academic_year=data.get('academic_year', ''),
            created_by=user.id
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({'message': 'Transport fee slab created and synchronized', 'data': row.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@fees_finance_bp.route('/optional-services/transport-fee/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_optional_transport_fee(id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        from app.models.transport_student import TransportFeeStructure
        row = TransportFeeStructure.query.filter_by(id=id, school_id=user.school_id).first_or_404()
        row.status = 'INACTIVE'
        db.session.commit()
        return jsonify({'message': 'Transport fee slab removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@fees_finance_bp.route('/optional-services/hostel-fee', methods=['POST'])
@jwt_required()
def create_optional_hostel_fee():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.get_json() or {}
    hostel_id = data.get('hostel_id')
    if not hostel_id:
        return jsonify({'error': 'Hostel selection is required'}), 400
    try:
        from app.models.hostel import HostelFeeStructure
        row = HostelFeeStructure(
            school_id=user.school_id,
            hostel_id=int(hostel_id),
            sharing_type=data.get('sharing_type', 'DOUBLE'),
            is_ac=bool(data.get('is_ac', False)),
            monthly_fee=float(data.get('monthly_fee', 0)),
            mess_charges=float(data.get('mess_charges', 0)),
            electricity_charges=float(data.get('electricity_charges', 0)),
            created_by=user.id
        )
        db.session.add(row)
        db.session.commit()
        return jsonify({'message': 'Hostel fee slab created and synchronized', 'data': row.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400


@fees_finance_bp.route('/optional-services/hostel-fee/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_optional_hostel_fee(id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        from app.models.hostel import HostelFeeStructure
        row = HostelFeeStructure.query.filter_by(id=id, school_id=user.school_id).first_or_404()
        row.status = 'INACTIVE'
        db.session.commit()
        return jsonify({'message': 'Hostel fee slab removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as ex:
        print(f"[ERROR] get_fee_setup_readiness failed: {ex}")
        return jsonify({
            'session': session,
            'total_classes': 0,
            'published_classes_count': 0,
            'missing_classes_count': 0,
            'classes_with_plan': [],
            'classes_missing_plan': [],
            'is_ready_for_admissions': False,
            'payment_plans_count': 0,
            'hostel_fee_count': 0,
            'transport_fee_count': 0,
        }), 200


@fees_finance_bp.route('/structures/<int:struct_id>/publish', methods=['PATCH'])
@jwt_required()
def toggle_publish_fee_structure(struct_id):
    """Toggle FeeStructureV2 between PUBLISHED and DRAFT."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    data = request.get_json(silent=True) or {}

    target = data.get('publish_status')
    if target in ('PUBLISHED', 'DRAFT'):
        struct.publish_status = target
    else:
        struct.publish_status = 'DRAFT' if struct.publish_status == 'PUBLISHED' else 'PUBLISHED'

    db.session.commit()
    return jsonify({
        'message': f'Structure "{struct.name}" is now {struct.publish_status}.',
        'structure': struct.to_dict()
    }), 200


@fees_finance_bp.route('/structures/<int:struct_id>/clone-to-classes', methods=['POST'])
@jwt_required()
def clone_structure_to_classes(struct_id):
    """Bulk copy a fee structure rate card to one or more other classes."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    source_struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    data = request.get_json() or {}
    target_class_ids = data.get('target_class_ids', [])
    target_session = data.get('session', source_struct.session)
    publish_now = data.get('publish_now', True)

    if not target_class_ids or not isinstance(target_class_ids, list):
        return jsonify({'error': 'target_class_ids array is required.'}), 400

    created_structures = []
    for cid in target_class_ids:
        c_obj = Class.query.filter_by(id=cid, school_id=user.school_id).first()
        c_name = f"{c_obj.name} {c_obj.section or ''}".strip() if c_obj else f"Class {cid}"
        new_name = f"{c_name} Fee Plan {target_session}"

        new_struct = FeeStructureV2(
            school_id=user.school_id,
            class_id=cid,
            session=target_session,
            name=new_name,
            frequency=source_struct.frequency,
            due_date_day=source_struct.due_date_day,
            is_active=True,
            publish_status='PUBLISHED' if publish_now else 'DRAFT',
            version=1,
            copied_from_id=source_struct.id,
            created_by=user.id,
        )
        db.session.add(new_struct)
        db.session.flush()

        for item in source_struct.items:
            db.session.add(FeeStructureItemV2(
                structure_id=new_struct.id,
                fee_head_id=item.fee_head_id,
                amount=item.amount,
            ))

        created_structures.append(new_struct)

    db.session.commit()
    return jsonify({
        'message': f'Successfully created {len(created_structures)} fee structures from "{source_struct.name}".',
        'structures': [s.to_dict() for s in created_structures]
    }), 201


@fees_finance_bp.route('/structures/copy-session', methods=['POST'])
@jwt_required()
def copy_structures_from_session():
    """Copy all fee structures from an earlier session to a new session in DRAFT or PUBLISHED status."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    from_session = data.get('from_session')
    to_session = data.get('to_session')
    as_draft = data.get('as_draft', True)

    if not from_session or not to_session:
        return jsonify({'error': 'Both from_session and to_session are required.'}), 400

    if from_session == to_session:
        return jsonify({'error': 'Target session must be different from source session.'}), 400

    sources = FeeStructureV2.query.filter_by(
        school_id=user.school_id, session=from_session, is_active=True, is_archived=False
    ).all()

    if not sources:
        return jsonify({'error': f'No active fee structures found for session {from_session}.'}), 404

    copied = []
    for src in sources:
        new_name = src.name.replace(from_session, to_session) if from_session in src.name else f"{src.name} ({to_session})"
        new_struct = FeeStructureV2(
            school_id=user.school_id,
            class_id=src.class_id,
            session=to_session,
            name=new_name,
            frequency=src.frequency,
            due_date_day=src.due_date_day,
            is_active=True,
            publish_status='DRAFT' if as_draft else 'PUBLISHED',
            version=1,
            copied_from_id=src.id,
            created_by=user.id,
        )
        db.session.add(new_struct)
        db.session.flush()

        for it in src.items:
            db.session.add(FeeStructureItemV2(
                structure_id=new_struct.id,
                fee_head_id=it.fee_head_id,
                amount=it.amount,
            ))
        copied.append(new_struct)

    db.session.commit()
    return jsonify({
        'message': f'Successfully copied {len(copied)} fee structures from {from_session} to {to_session}.',
        'structures': [s.to_dict() for s in copied]
    }), 201


def _seed_default_payment_plans(school_id, session):
    """Seed initial configurable payment cadence plans for a session if none exist."""
    existing = FeePaymentPlan.query.filter_by(school_id=school_id, session=session).first()
    if existing:
        return

    defaults = [
        {
            'name': 'Monthly Standard',
            'code': 'MONTHLY',
            'months_count': 1,
            'discount_type': 'PERCENTAGE',
            'discount_value': 0.0,
            'eligible_categories': '["ACADEMIC"]',
            'description': 'Standard 1-month payment with no advance concession.',
            'sort_order': 1,
        },
        {
            'name': 'Quarterly Advance (3 Months)',
            'code': 'QUARTERLY',
            'months_count': 3,
            'discount_type': 'PERCENTAGE',
            'discount_value': 5.0,
            'eligible_categories': '["ACADEMIC"]',
            'description': 'Pay 3 months in advance to receive 5% advance concession on tuition.',
            'sort_order': 2,
        },
        {
            'name': 'Half-Yearly Advance (6 Months)',
            'code': 'HALF_YEARLY',
            'months_count': 6,
            'discount_type': 'PERCENTAGE',
            'discount_value': 10.0,
            'eligible_categories': '["ACADEMIC"]',
            'description': 'Pay 6 months in advance to receive 10% advance concession on tuition.',
            'sort_order': 3,
        },
        {
            'name': 'Full Annual Advance (12 Months)',
            'code': 'ANNUAL',
            'months_count': 12,
            'discount_type': 'PERCENTAGE',
            'discount_value': 15.0,
            'eligible_categories': '["ACADEMIC"]',
            'description': 'Pay full academic session in advance to receive 15% advance concession on tuition.',
            'sort_order': 4,
        },
    ]

    for d in defaults:
        plan = FeePaymentPlan(
            school_id=school_id,
            session=session,
            name=d['name'],
            code=d['code'],
            months_count=d['months_count'],
            discount_type=d['discount_type'],
            discount_value=d['discount_value'],
            eligible_categories=d['eligible_categories'],
            description=d['description'],
            sort_order=d['sort_order'],
            is_active=True,
        )
        db.session.add(plan)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()


@fees_finance_bp.route('/payment-plans', methods=['GET'])
@jwt_required()
def get_payment_plans():
    """Get all payment plans for a given academic session."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    _seed_default_payment_plans(user.school_id, session)

    plans = FeePaymentPlan.query.filter_by(
        school_id=user.school_id, session=session
    ).order_by(FeePaymentPlan.sort_order.asc(), FeePaymentPlan.months_count.asc()).all()

    return jsonify([p.to_dict() for p in plans]), 200


@fees_finance_bp.route('/payment-plans', methods=['POST'])
@jwt_required()
def create_payment_plan():
    """Create a new configurable payment plan."""
    import json
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper()
    if not name or not code:
        return jsonify({'error': 'Name and unique code are required.'}), 400

    session = data.get('session', '2026-27')
    cats = data.get('eligible_categories', ['ACADEMIC'])
    if not isinstance(cats, list):
        cats = ['ACADEMIC']

    plan = FeePaymentPlan(
        school_id=user.school_id,
        session=session,
        name=name,
        code=code,
        months_count=int(data.get('months_count', 1)),
        discount_type=data.get('discount_type', 'PERCENTAGE'),
        discount_value=float(data.get('discount_value', 0.0)),
        eligible_categories=json.dumps(cats),
        description=data.get('description', ''),
        sort_order=int(data.get('sort_order', 0)),
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(plan)
    db.session.commit()
    return jsonify(plan.to_dict()), 201


@fees_finance_bp.route('/payment-plans/<int:plan_id>', methods=['PATCH', 'PUT'])
@jwt_required()
def update_payment_plan(plan_id):
    """Update payment plan details (cadence, discount, eligible categories)."""
    import json
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    plan = FeePaymentPlan.query.filter_by(id=plan_id, school_id=user.school_id).first_or_404()
    data = request.get_json() or {}

    if 'name' in data:
        plan.name = data['name'].strip()
    if 'months_count' in data:
        plan.months_count = int(data['months_count'])
    if 'discount_type' in data:
        plan.discount_type = data['discount_type']
    if 'discount_value' in data:
        plan.discount_value = float(data['discount_value'])
    if 'eligible_categories' in data:
        cats = data['eligible_categories'] if isinstance(data['eligible_categories'], list) else ['ACADEMIC']
        plan.eligible_categories = json.dumps(cats)
    if 'description' in data:
        plan.description = data['description']
    if 'is_active' in data:
        plan.is_active = bool(data['is_active'])
    if 'sort_order' in data:
        plan.sort_order = int(data['sort_order'])

    db.session.commit()
    return jsonify(plan.to_dict()), 200


@fees_finance_bp.route('/payment-plans/<int:plan_id>', methods=['DELETE'])
@jwt_required()
def delete_payment_plan(plan_id):
    """Deactivate or delete payment plan."""
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    plan = FeePaymentPlan.query.filter_by(id=plan_id, school_id=user.school_id).first_or_404()
    # Soft delete / deactivate
    plan.is_active = False
    db.session.commit()
    return jsonify({'message': f'Payment plan "{plan.name}" deactivated.'}), 200


@fees_finance_bp.route('/admission-fee-plan', methods=['GET'])
@jwt_required()
def get_admission_fee_plan():
    """
    Fetch comprehensive class-wise published fee plan, payment options,
    and optional service rates for the New Admission form.
    """
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    class_id = request.args.get('class_id', type=int)
    session = request.args.get('session', '2026-27')

    _seed_default_payment_plans(user.school_id, session)

    # 1. Find class-specific published fee structure
    struct = None
    if class_id:
        struct = FeeStructureV2.query.filter_by(
            school_id=user.school_id, class_id=class_id, session=session,
            is_active=True, is_archived=False, publish_status='PUBLISHED'
        ).first()

    # If no class-specific, check school-wide published
    if not struct:
        struct = FeeStructureV2.query.filter_by(
            school_id=user.school_id, class_id=None, session=session,
            is_active=True, is_archived=False, publish_status='PUBLISHED'
        ).first()

    # 2. Get active payment plans
    payment_plans = FeePaymentPlan.query.filter_by(
        school_id=user.school_id, session=session, is_active=True
    ).order_by(FeePaymentPlan.sort_order.asc(), FeePaymentPlan.months_count.asc()).all()

    # 3. Optional hostel fee structures & hostels list
    hostel_plans = []
    hostels_list = []
    try:
        from app.models.hostel import HostelFeeStructure, Hostel
        hfs_list = HostelFeeStructure.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
        hostel_plans = [h.to_dict() for h in hfs_list]
        h_all = Hostel.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
        hostels_list = [h.to_dict(include_counts=False) for h in h_all]
    except Exception:
        pass

    # 4. Optional transport routes & fee structures
    transport_plans = []
    transport_routes = []
    try:
        from app.models.transport_student import TransportFeeStructure
        from app.models.transport import Route
        tfs_list = TransportFeeStructure.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
        transport_plans = [t.to_dict() for t in tfs_list]
        r_list = Route.query.filter_by(school_id=user.school_id, status='ACTIVE').all()
        transport_routes = [r.to_dict(include_stops=True, include_counts=False) for r in r_list]
    except Exception:
        pass

    # 5. Active Fee Heads
    heads = FeeHead.query.filter_by(school_id=user.school_id, is_active=True).all()

    return jsonify({
        'session': session,
        'class_id': class_id,
        'has_published_plan': struct is not None,
        'class_fee_structure': struct.to_dict() if struct else None,
        'payment_plans': [p.to_dict() for p in payment_plans],
        'hostels': hostels_list,
        'hostel_plans': hostel_plans,
        'transport_plans': transport_plans,
        'transport_routes': transport_routes,
        'fee_heads': [h.to_dict() for h in heads],
    }), 200


@fees_finance_bp.route('/concessions/<int:conc_id>', methods=['DELETE'])
@jwt_required()
def delete_concession(conc_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    conc = StudentConcession.query.filter_by(id=conc_id, school_id=user.school_id).first_or_404()
    db.session.delete(conc)
    db.session.commit()
    return jsonify({'message': 'Concession deleted successfully.'}), 200


# ═══════════════════════════════════════════════════════════════════════
#  4. STUDENT 360° FINANCIAL LEDGER & APPLICABLE CHARGES
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/students/search', methods=['GET'])
@jwt_required()
def search_students():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    class_id = request.args.get('class_id', type=int)
    query = (request.args.get('query') or request.args.get('search') or '').strip()
    session = request.args.get('session', None)
    only_pending = request.args.get('only_pending', 'false').lower() in ('true', '1')

    q = Student.query.join(User, Student.user_id == User.id).filter(Student.school_id == user.school_id)

    if class_id:
        q = q.filter(Student.class_id == class_id)

    if query:
        pattern = f"%{query}%"
        q = q.filter(db.or_(
            User.name.ilike(pattern),
            Student.admission_no.ilike(pattern),
            Student.roll_number.ilike(pattern),
            Student.father_name.ilike(pattern),
            Student.parent_name.ilike(pattern),
            Student.parent_phone.ilike(pattern),
        ))

    students = q.order_by(Student.class_id.asc(), Student.roll_number.asc()).limit(60).all()

    results = []
    for s in students:
        bill_q = FeeBill.query.filter_by(student_id=s.id, school_id=user.school_id).filter(FeeBill.status != BillStatus.CANCELLED.value)
        if session:
            bill_session = bill_q.filter_by(session=session).all()
            bills = bill_session if bill_session else bill_q.all()
        else:
            bills = bill_q.all()

        total_billed = sum(b.total_payable for b in bills)
        total_paid   = sum(b.amount_paid for b in bills)
        outstanding  = sum(b.balance_due for b in bills)

        if only_pending and outstanding <= 0:
            continue

        results.append({
            'id':           s.id,
            'name':         s.user.name if s.user else '',
            'admission_no': s.admission_no or '',
            'roll_no':      getattr(s, 'roll_number', '') or '',
            'class_id':     s.class_id,
            'class_name':   f"{s.class_ref.name} {s.class_ref.section or ''}".strip() if s.class_ref else '—',
            'father_name':  s.father_name or s.parent_name or '',
            'parent_phone': s.parent_phone or '',
            'total_billed': round(total_billed, 2),
            'total_paid':   round(total_paid, 2),
            'outstanding':  round(outstanding, 2),
            'status':       'HAS_DUES' if outstanding > 0 else 'CLEARED',
        })

    return jsonify({'students': results}), 200


@fees_finance_bp.route('/students/<int:student_id>/ledger', methods=['GET'])
@jwt_required()
def get_student_financial_ledger(student_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', None)
    ledger_data = get_student_ledger(student_id, session=session)
    if not ledger_data:
        return jsonify({'error': 'Student not found.'}), 404

    return jsonify(ledger_data), 200


@fees_finance_bp.route('/students/<int:student_id>/applicable-charges', methods=['GET'])
@jwt_required()
def get_applicable_charges(student_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    charges = get_student_applicable_charges(student_id, session=session)
    return jsonify(charges), 200


# ═══════════════════════════════════════════════════════════════════════
#  5. ADVANCE DEMAND BILLS (GENERATION & MANAGEMENT)
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/bills/generate', methods=['POST'])
@jwt_required()
def generate_bills():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    bill_month = data.get('bill_month') # e.g. "2026-09"
    due_date   = data.get('due_date')   # e.g. "2026-09-05"
    session    = data.get('session', '2026-27')
    force_regen= data.get('force_regenerate', False)

    if not bill_month or not due_date:
        return jsonify({'error': 'bill_month (YYYY-MM) and due_date (YYYY-MM-DD) are required.'}), 400

    student_id = data.get('student_id')
    student_ids = data.get('student_ids')
    class_id = data.get('class_id')

    # Single student generation
    if student_id:
        try:
            bill, created = generate_fee_bill(
                student_id=student_id,
                bill_month=bill_month,
                due_date=due_date,
                actor_user=user,
                session=session,
                force_regenerate=force_regen
            )
            return jsonify({
                'message': 'Bill generated successfully' if created else 'Bill already exists for this month',
                'bill': bill.to_dict(),
                'created': created
            }), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 400

    # Bulk generation
    result = bulk_generate_fee_bills(
        school_id=user.school_id,
        bill_month=bill_month,
        due_date=due_date,
        class_id=class_id,
        student_ids=student_ids,
        actor_user=user,
        session=session,
        force_regenerate=force_regen
    )
    return jsonify(result), 200


@fees_finance_bp.route('/bills', methods=['GET'])
@jwt_required()
def list_bills():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    month      = request.args.get('month')
    class_id   = request.args.get('class_id')
    status     = request.args.get('status')
    search     = (request.args.get('search') or '').strip()
    session    = request.args.get('session')
    department = request.args.get('department')

    from sqlalchemy.orm import joinedload
    q = FeeBill.query.options(
        joinedload(FeeBill.student).joinedload(Student.user),
        joinedload(FeeBill.student).joinedload(Student.class_ref),
        joinedload(FeeBill.items)
    ).filter_by(school_id=user.school_id).filter(FeeBill.status != BillStatus.CANCELLED.value)

    if session:
        q = q.filter(db.or_(FeeBill.session == session, FeeBill.session.is_(None), FeeBill.session == ''))

    if department:
        from app.models.fee_finance import FeeBillItem
        q = q.join(FeeBill.items).filter(FeeBillItem.department == department.upper())

    if month:
        import calendar
        try:
            yr, mo = map(int, month.split('-'))
            m_label = f"{calendar.month_name[mo]} {yr}"
            q = q.filter(db.or_(FeeBill.bill_month == month, FeeBill.bill_month == m_label, FeeBill.bill_period_label.ilike(f"%{m_label}%")))
        except Exception:
            q = q.filter(FeeBill.bill_month == month)
    if status:
        q = q.filter_by(status=status)

    if class_id:
        q = q.join(Student).filter(Student.class_id == class_id)

    if search:
        q = q.join(Student).join(User, Student.user_id == User.id).filter(
            db.or_(
                User.name.ilike(f"%{search}%"),
                Student.admission_no.ilike(f"%{search}%"),
                FeeBill.bill_no.ilike(f"%{search}%")
            )
        )

    # Safe pagination: if page is provided or per_page requested, paginate; else return list capped at 150
    page = request.args.get('page', type=int)
    per_page = request.args.get('per_page', type=int) or request.args.get('limit', type=int)

    if page is not None:
        per_page = min(per_page or 50, 100)
        p = q.order_by(FeeBill.due_date.asc(), FeeBill.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'data': [b.to_dict() for b in p.items],
            'total': p.total,
            'page': p.page,
            'pages': p.pages,
            'has_next': p.has_next,
            'has_prev': p.has_prev
        }), 200

    limit = min(per_page or 100, 100)
    bills = q.order_by(FeeBill.due_date.asc(), FeeBill.id.desc()).limit(limit).all()
    return jsonify([b.to_dict() for b in bills]), 200


@fees_finance_bp.route('/bills/<int:bill_id>', methods=['GET'])
@jwt_required()
def get_bill_detail(bill_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    bill = FeeBill.query.filter_by(id=bill_id, school_id=user.school_id).first_or_404()
    return jsonify(bill.to_dict()), 200


@fees_finance_bp.route('/bills/<int:bill_id>/pdf', methods=['GET'])
@jwt_required()
def download_bill_pdf(bill_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    bill = FeeBill.query.filter_by(id=bill_id, school_id=user.school_id).first_or_404()
    school = School.query.get(user.school_id)

    pdf_buffer = generate_fee_bill_pdf(bill, school)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=False,
        download_name=f"{bill.bill_no}_{bill.student.admission_no}.pdf"
    )


# ═══════════════════════════════════════════════════════════════════════
#  6. PAYMENT COLLECTION & RECEIPTS
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/payments/collect', methods=['POST'])
@jwt_required()
def collect_payment():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    student_id = data.get('student_id')
    amount = data.get('amount') if data.get('amount') is not None else data.get('amount_paid')
    if amount is None:
        amount = data.get('total_amount')
        
    mode = data.get('payment_mode', 'CASH')
    txn_ref = data.get('transaction_ref', '')
    allocations = data.get('allocations', [])
    remarks = data.get('remarks', '')
    department = data.get('department', 'ACCOUNTS')
    session = data.get('session', '2026-27')

    if not student_id or amount is None or float(amount) <= 0:
        return jsonify({'error': 'Valid student_id and payment amount (> 0) are required.'}), 400

    try:
        payment = collect_fee_payment(
            student_id=student_id,
            amount_paid=amount,
            payment_mode=mode,
            transaction_ref=txn_ref,
            allocations=allocations,
            collected_by=user,
            remarks=remarks,
            department=department,
            session=session
        )
        return jsonify({
            'message':      'Payment collected successfully',
            'receipt_no':   payment.receipt_no,
            'payment_id':   payment.id,
            'total_paid':   payment.total_paid,
            'payment':      payment.to_dict(),
            'allocations':  [a.to_dict() for a in payment.allocations],
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@fees_finance_bp.route('/payments', methods=['GET'])
@jwt_required()
def list_payments():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    search  = (request.args.get('search') or '').strip()
    status  = request.args.get('status')
    mode    = request.args.get('payment_mode')
    department = request.args.get('department')
    collector_id = request.args.get('collector_id', type=int)
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    log_type = request.args.get('type', 'ALL').upper() # ALL, INCOME, EXPENSE, SALARY

    results = []

    limit = min(request.args.get('limit', 150, type=int), 200)

    # 1. Money IN (Student Fee Collections)
    if log_type in ['ALL', 'INCOME']:
        from sqlalchemy.orm import joinedload
        q = FeePayment.query.options(
            joinedload(FeePayment.student).joinedload(Student.user),
            joinedload(FeePayment.student).joinedload(Student.class_ref),
            joinedload(FeePayment.allocations)
        ).filter_by(school_id=user.school_id, session=session)
        if status:
            q = q.filter_by(status=status)
        if mode:
            q = q.filter_by(payment_mode=mode)
        if department:
            q = q.filter_by(department=department)
        if collector_id:
            q = q.filter_by(collected_by=collector_id)
        if date_from:
            try:
                q = q.filter(FeePayment.payment_date >= date.fromisoformat(date_from))
            except ValueError:
                pass
        if date_to:
            try:
                q = q.filter(FeePayment.payment_date <= date.fromisoformat(date_to))
            except ValueError:
                pass

        if search:
            q = q.join(Student).join(User, Student.user_id == User.id).filter(
                db.or_(
                    User.name.ilike(f"%{search}%"),
                    Student.admission_no.ilike(f"%{search}%"),
                    FeePayment.receipt_no.ilike(f"%{search}%"),
                    FeePayment.transaction_ref.ilike(f"%{search}%")
                )
            )

        payments = q.order_by(FeePayment.payment_date.desc(), FeePayment.id.desc()).limit(limit).all()
        for p in payments:
            stu_name = p.student.user.name if p.student and p.student.user else f"Student #{p.student_id}"
            cls_name = p.student.class_ref.name if p.student and p.student.class_ref else ''
            adm_no   = p.student.admission_no if p.student else ''
            d = p.to_dict()
            d['direction'] = 'IN'
            d['transaction_type'] = 'STUDENT_FEE'
            d['party_name'] = stu_name
            d['party_subtext'] = f"Class {cls_name} • Adm: {adm_no}" if cls_name else adm_no
            d['party_type'] = 'STUDENT'
            results.append(d)

    # 2. Money OUT (Staff/Teacher Salaries & Expenses)
    if log_type in ['ALL', 'EXPENSE', 'SALARY']:
        from sqlalchemy.orm import joinedload
        eq = Expense.query.options(
            joinedload(Expense.creator)
        ).filter_by(school_id=user.school_id)
        if status:
            eq = eq.filter_by(status=status)
        if mode:
            eq = eq.filter_by(payment_method=mode)
        if log_type == 'SALARY':
            eq = eq.filter(Expense.category.ilike('%SALARY%'))

        if department:
            if department == 'ACCOUNTS':
                eq = eq.filter(Expense.category.in_(['STAFF_SALARY', 'ELECTRICITY', 'MAINTENANCE', 'MISCELLANEOUS']))
            elif department == 'HOSTEL':
                eq = eq.filter(Expense.category.in_(['HOSTEL_STAFF_SALARY', 'HOSTEL_EXPENSE']))
            elif department == 'TRANSPORT':
                eq = eq.filter(Expense.category.in_(['TRANSPORT_STAFF_SALARY', 'TRANSPORT_FUEL']))
            elif department == 'LIBRARY':
                eq = eq.filter(Expense.category.in_(['LIBRARY_STAFF_SALARY', 'BOOKS_LIBRARY']))

        if search:
            eq = eq.filter(
                db.or_(
                    Expense.vendor_name.ilike(f"%{search}%"),
                    Expense.title.ilike(f"%{search}%"),
                    Expense.invoice_number.ilike(f"%{search}%")
                )
            )

        expenses = eq.order_by(Expense.payment_date.desc(), Expense.id.desc()).limit(limit).all()
        for e in expenses:
            is_sal = 'SALARY' in (e.category or '').upper()
            creator_name = e.creator.name if hasattr(e, 'creator') and e.creator else 'Accountant'
            creator_role = e.creator.role.value if hasattr(e, 'creator') and e.creator and e.creator.role else 'Staff'
            results.append({
                'id': e.id,
                'direction': 'OUT',
                'transaction_type': 'SALARY_PAYMENT' if is_sal else 'EXPENSE',
                'receipt_no': e.invoice_number or f"EXP-{e.id:06d}",
                'party_name': e.vendor_name or e.title,
                'party_subtext': e.category.replace('_', ' ').title(),
                'party_type': 'STAFF' if is_sal else 'VENDOR',
                'total_paid': e.amount,
                'amount_paid': e.amount,
                'payment_mode': e.payment_method,
                'payment_date': str(e.payment_date) if e.payment_date else None,
                'department': 'TRANSPORT' if 'TRANSPORT' in (e.category or '') else ('HOSTEL' if 'HOSTEL' in (e.category or '') else ('LIBRARY' if 'LIBRARY' in (e.category or '') else 'ACCOUNTS')),
                'status': e.status or 'PAID',
                'collector_name': creator_name,
                'collector_role': creator_role,
                'remarks': e.remarks or e.title,
                'created_at': e.created_at.isoformat() if e.created_at else None,
                'allocations': [],
            })

    # Sort combined results by payment_date / timestamp descending
    results.sort(key=lambda x: (x.get('payment_date') or '', x.get('created_at') or ''), reverse=True)
    return jsonify(results), 200


# ═══════════════════════════════════════════════════════════════════════
#  6.1 PAYROLL & SALARY DISBURSEMENT FROM CENTRAL FINANCE
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/payroll/slips', methods=['GET'])
@jwt_required()
def get_payroll_slips_for_finance():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    run_id = request.args.get('payroll_run_id')
    month = request.args.get('month')
    year = request.args.get('year')
    status = request.args.get('status')
    search = (request.args.get('search') or '').strip()
    role = request.args.get('role')
    department = request.args.get('department')

    q = PayrollSlip.query.filter_by(school_id=user.school_id)
    if run_id:
        q = q.filter_by(payroll_run_id=int(run_id))
    if status:
        q = q.filter_by(payment_status=status)
    if month or year:
        q = q.join(PayrollRun)
        if month:
            q = q.filter(PayrollRun.month == int(month))
        if year:
            q = q.filter(PayrollRun.year == int(year))

    if role or department or search:
        q = q.join(User, PayrollSlip.user_id == User.id)
        if role:
            q = q.filter(User.role == role)
        if department:
            q = q.filter(User.department.ilike(f"%{department}%"))
        if search:
            q = q.filter(
                db.or_(
                    User.name.ilike(f"%{search}%"),
                    User.employee_id.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%")
                )
            )

        from sqlalchemy.orm import joinedload
    limit = min(request.args.get('limit', 150, type=int), 200)
    slips = q.options(joinedload(PayrollSlip.payroll_run), joinedload(PayrollSlip.user)).order_by(PayrollSlip.id.desc()).limit(limit).all()
    res = []
    for s in slips:
        d = s.to_dict()
        d['month_name'] = s.payroll_run.month_name if s.payroll_run else ''
        d['run_status'] = s.payroll_run.status if s.payroll_run else ''
        res.append(d)
    return jsonify(res), 200


@fees_finance_bp.route('/payroll/slips/<int:slip_id>/pay', methods=['POST'])
@jwt_required()
def pay_payroll_slip_from_finance(slip_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    mode = data.get('payment_mode', 'BANK_TRANSFER')
    txn_ref = (data.get('transaction_ref') or '').strip()
    remarks = data.get('remarks')

    try:
        slip, exp = p_svc.pay_payroll_slip(
            slip_id=slip_id,
            payment_mode=mode,
            transaction_ref=txn_ref,
            paid_by_user=user,
            remarks=remarks
        )
        return jsonify({
            'message': f'Salary payment of ₹{slip.net_salary:,.2f} for {slip.user.name} completed successfully!',
            'slip': slip.to_dict(),
            'expense': exp.to_dict(),
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fees_finance_bp.route('/payroll/runs/<int:run_id>/pay-all', methods=['POST'])
@jwt_required()
def pay_payroll_run_all_from_finance(run_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    mode = data.get('payment_mode', 'BANK_TRANSFER')
    remarks = data.get('remarks')

    try:
        run, count = p_svc.pay_payroll_run_all(
            payroll_run_id=run_id,
            payment_mode=mode,
            paid_by_user=user,
            remarks=remarks
        )
        return jsonify({
            'message': f'Disbursed {count} salary payments for {run.month_name} successfully!',
            'run': run.to_dict(),
            'paid_count': count,
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@fees_finance_bp.route('/expenses/by-category', methods=['GET'])
@jwt_required()
def get_expenses_by_category():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    month = request.args.get('month')
    q = Expense.query.filter_by(school_id=user.school_id, status='PAID')
    if month:
        q = q.filter(Expense.month.ilike(f"%{month}%"))

    expenses = q.order_by(Expense.payment_date.desc()).all()

    categories_map = {
        'TEACHER_SALARY':         {'label': 'Teacher Salaries',           'department': 'ACADEMIC',    'total': 0.0, 'count': 0},
        'STAFF_SALARY':           {'label': 'Staff & Admin Salaries',     'department': 'ADMIN',       'total': 0.0, 'count': 0},
        'TRANSPORT_STAFF_SALARY': {'label': 'Transport Staff & Drivers',  'department': 'TRANSPORT',   'total': 0.0, 'count': 0},
        'HOSTEL_STAFF_SALARY':    {'label': 'Hostel Wardens & Staff',     'department': 'HOSTEL',      'total': 0.0, 'count': 0},
        'LIBRARY_STAFF_SALARY':   {'label': 'Library Staff',              'department': 'LIBRARY',     'total': 0.0, 'count': 0},
        'ELECTRICITY':            {'label': 'Electricity Bills',          'department': 'UTILITY',     'total': 0.0, 'count': 0},
        'MAINTENANCE':            {'label': 'Campus Maintenance',         'department': 'MAINTENANCE', 'total': 0.0, 'count': 0},
        'TRANSPORT_FUEL':         {'label': 'Vehicle Fuel & Maintenance', 'department': 'TRANSPORT',   'total': 0.0, 'count': 0},
        'BOOKS_LIBRARY':          {'label': 'Books & Publications',       'department': 'LIBRARY',     'total': 0.0, 'count': 0},
        'INVENTORY_PURCHASE':     {'label': 'Vendor & Inventory Purchases','department': 'OPERATIONS',  'total': 0.0, 'count': 0},
        'MISCELLANEOUS':          {'label': 'Miscellaneous Expenses',     'department': 'OTHER',       'total': 0.0, 'count': 0},
    }

    for exp in expenses:
        cat = exp.category or 'MISCELLANEOUS'
        if cat not in categories_map:
            categories_map[cat] = {'label': cat.replace('_', ' ').title(), 'department': 'OTHER', 'total': 0.0, 'count': 0}
        categories_map[cat]['total'] = round(categories_map[cat]['total'] + exp.amount, 2)
        categories_map[cat]['count'] += 1

    return jsonify({
        'total_expenses': sum(c['total'] for c in categories_map.values() if isinstance(c, dict)),
        'categories': categories_map,
        'recent_expenses': [e.to_dict() for e in expenses[:50]]
    }), 200


@fees_finance_bp.route('/payments/<int:payment_id>/receipt-pdf', methods=['GET'])
@jwt_required()
def download_receipt_pdf(payment_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    payment = FeePayment.query.filter_by(id=payment_id, school_id=user.school_id).first_or_404()
    school  = School.query.get(user.school_id)

    # Remaining student ledger balance
    ledger_data = get_student_ledger(payment.student_id, session=payment.session)
    rem_bal = ledger_data['outstanding'] if ledger_data else 0.0

    pdf_buffer = generate_fee_receipt_pdf(payment, school, ledger_balance=rem_bal)
    return send_file(
        pdf_buffer,
        mimetype='application/pdf',
        as_attachment=False,
        download_name=f"{payment.receipt_no}.pdf"
    )


@fees_finance_bp.route('/payments/<int:payment_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_receipt(payment_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'Cancellation reason is required.'}), 400

    try:
        payment = cancel_payment_receipt(payment_id, actor_user=user, cancel_reason=reason)
        return jsonify({'message': 'Receipt cancelled successfully', 'payment': payment.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ═══════════════════════════════════════════════════════════════════════
#  7. CONCESSIONS & REFUNDS
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/concessions', methods=['GET'])
@jwt_required()
def get_concessions():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    session = request.args.get('session', '2026-27')
    concessions = StudentConcession.query.filter_by(school_id=user.school_id, session=session).all()
    return jsonify([c.to_dict() for c in concessions]), 200


@fees_finance_bp.route('/concessions', methods=['POST'])
@jwt_required()
def apply_concession():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    student_id = data.get('student_id')
    c_type = data.get('concession_type', 'SCHOLARSHIP')
    d_type = data.get('discount_type', 'FIXED')
    d_val  = float(data.get('discount_value', 0.0))
    reason = (data.get('reason') or '').strip()

    if not student_id or d_val <= 0 or not reason:
        return jsonify({'error': 'student_id, discount_value > 0 and reason are required.'}), 400

    try:
        conc = apply_concession_and_adjust_bills(
            school_id=user.school_id,
            student_id=student_id,
            fee_head_id=data.get('fee_head_id'),
            concession_type=c_type,
            discount_type=d_type,
            discount_value=d_val,
            reason=reason,
            session=data.get('session', '2026-27'),
            actor_user=user
        )
        return jsonify(conc.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@fees_finance_bp.route('/refunds', methods=['GET'])
@jwt_required()
def get_refunds():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    refunds = FeeRefund.query.filter_by(school_id=user.school_id).order_by(FeeRefund.refund_date.desc()).all()
    return jsonify([r.to_dict() for r in refunds]), 200


@fees_finance_bp.route('/refunds', methods=['POST'])
@jwt_required()
def issue_refund():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    student_id = data.get('student_id')
    amount = data.get('amount')
    reason = (data.get('reason') or '').strip()
    mode = data.get('refund_mode', 'BANK_TRANSFER')

    if not student_id or not amount or not reason:
        return jsonify({'error': 'student_id, amount and reason are required.'}), 400

    try:
        ref = process_fee_refund(
            student_id=student_id,
            amount=amount,
            refund_mode=mode,
            reason=reason,
            authorized_by=user,
            payment_id=data.get('payment_id'),
            fee_head_id=data.get('fee_head_id'),
            reference_no=data.get('reference_no'),
        )
        return jsonify({'message': 'Refund processed successfully', 'refund': ref.to_dict()}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ═══════════════════════════════════════════════════════════════════════
#  8. OUTSTANDING DUES & DEFAULTERS
# ═══════════════════════════════════════════════════════════════════════

@fees_finance_bp.route('/outstanding', methods=['GET'])
@jwt_required()
def get_outstanding():
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    class_id = request.args.get('class_id')
    session  = request.args.get('session', '2026-27')
    month    = request.args.get('month')

    q = FeeBill.query.filter_by(school_id=user.school_id, session=session).filter(
        FeeBill.balance_due > 0,
        FeeBill.status.in_([BillStatus.ISSUED.value, BillStatus.PARTIALLY_PAID.value, BillStatus.OVERDUE.value])
    )

    if month:
        q = q.filter_by(bill_month=month)
    if class_id:
        q = q.join(Student).filter(Student.class_id == class_id)

    bills = q.order_by(FeeBill.balance_due.desc()).all()
    return jsonify([b.to_dict() for b in bills]), 200
