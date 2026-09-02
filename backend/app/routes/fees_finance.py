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
    BillStatus, PaymentStatus
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
    return User.query.get(user_id)


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

    q = FeeStructureV2.query.filter_by(school_id=user.school_id, session=session, is_active=True)
    if class_id:
        q = q.filter(db.or_(FeeStructureV2.class_id == class_id, FeeStructureV2.class_id == None))

    structures = q.order_by(FeeStructureV2.class_id.asc()).all()
    return jsonify([s.to_dict() for s in structures]), 200


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

    struct = FeeStructureV2(
        school_id=user.school_id,
        class_id=class_id if class_id else None,
        session=session,
        name=name,
        frequency=data.get('frequency', 'MONTHLY'),
        due_date_day=int(data.get('due_date_day', 10)),
        is_active=True,
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

    if 'items' in data:
        # Replace items
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


@fees_finance_bp.route('/structures/<int:struct_id>', methods=['DELETE'])
@jwt_required()
def delete_fee_structure(struct_id):
    user = _get_current_user()
    if not user or not user.school_id:
        return jsonify({'error': 'Unauthorized'}), 401

    struct = FeeStructureV2.query.filter_by(id=struct_id, school_id=user.school_id).first_or_404()
    FeeStructureItemV2.query.filter_by(structure_id=struct.id).delete()
    db.session.delete(struct)
    db.session.commit()
    return jsonify({'message': 'Rate card deleted successfully.'}), 200


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

    month   = request.args.get('month')
    class_id= request.args.get('class_id')
    status  = request.args.get('status')
    search  = (request.args.get('search') or '').strip()
    session = request.args.get('session', '2026-27')

    q = FeeBill.query.filter_by(school_id=user.school_id, session=session).filter(FeeBill.status != BillStatus.CANCELLED.value)

    if month:
        q = q.filter_by(bill_month=month)
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

    bills = q.order_by(FeeBill.due_date.asc(), FeeBill.id.desc()).all()
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
    log_type = request.args.get('type', 'ALL').upper() # ALL, INCOME, EXPENSE, SALARY

    results = []

    # 1. Money IN (Student Fee Collections)
    if log_type in ['ALL', 'INCOME']:
        q = FeePayment.query.filter_by(school_id=user.school_id, session=session)
        if status:
            q = q.filter_by(status=status)
        if mode:
            q = q.filter_by(payment_mode=mode)
        if department:
            q = q.filter_by(department=department)

        if search:
            q = q.join(Student).join(User, Student.user_id == User.id).filter(
                db.or_(
                    User.name.ilike(f"%{search}%"),
                    Student.admission_no.ilike(f"%{search}%"),
                    FeePayment.receipt_no.ilike(f"%{search}%"),
                    FeePayment.transaction_ref.ilike(f"%{search}%")
                )
            )

        payments = q.order_by(FeePayment.payment_date.desc(), FeePayment.id.desc()).all()
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
        eq = Expense.query.filter_by(school_id=user.school_id)
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

        expenses = eq.order_by(Expense.payment_date.desc(), Expense.id.desc()).all()
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

    slips = q.order_by(PayrollSlip.id.desc()).all()
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
