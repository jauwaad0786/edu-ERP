from flask import Blueprint, request, jsonify
from app import db
from app.models.financial import FeeRecord
from app.models.finance import (
    Expense, EXPENSE_CATEGORIES, PAYMENT_METHODS, EXPENSE_STATUSES,
    InventoryItem, INVENTORY_CATEGORIES, INVENTORY_UNITS, ITEM_CONDITIONS, ITEM_STATUSES,
    StockMovement, STOCK_MOVEMENT_TYPES,
    PurchaseOrder, PurchaseOrderItem, PURCHASE_ORDER_STATUSES,
    GoodsReceiptNote, GoodsReceiptItem,
    VendorBill, VendorPayment, VENDOR_BILL_STATUSES,
    SchoolAsset, AssetAssignmentHistory, AssetConditionLog, AssetMaintenanceRecord,
    ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES,
    Vendor, VENDOR_CATEGORIES,
)
from app.services.procurement_service import (
    create_purchase_order, approve_purchase_order, cancel_purchase_order,
    process_goods_receipt, record_vendor_bill_payment,
    issue_inventory_stock, adjust_inventory_stock
)
from app.services.asset_service import (
    create_asset, assign_or_transfer_asset, record_asset_condition,
    record_asset_maintenance, dispose_or_retire_asset, get_assets_summary
)
from app.utils.decorators import role_required, get_current_user
from sqlalchemy import func, extract
from datetime import date, datetime
import cloudinary.uploader

finance_bp = Blueprint('finance', __name__)


def _school_id():
    return get_current_user().school_id


def _month_label(d):
    """date object -> 'July 2026'"""
    return d.strftime('%B %Y')


def _month_bounds(month_str):
    """'July 2026' -> (year, month_number). Return None if invalid."""
    try:
        parsed = datetime.strptime(month_str, '%B %Y')
        return parsed.year, parsed.month
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════════════
#  1. EXPENSES — CRUD & APPROVAL WORKFLOW
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/expenses', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_expenses():
    sid        = _school_id()
    month      = request.args.get('month')
    category   = request.args.get('category')
    department = request.args.get('department')
    status     = request.args.get('status')
    source     = request.args.get('source')

    q = Expense.query.filter_by(school_id=sid)
    if month:
        q = q.filter_by(month=month)
    if category:
        q = q.filter_by(category=category)
    if department:
        q = q.filter_by(department=department)
    if status:
        q = q.filter_by(status=status)
    if source:
        q = q.filter_by(source=source)

    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 100)
    paginated = q.order_by(Expense.payment_date.desc(), Expense.created_at.desc())\
                  .paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'data':     [e.to_dict() for e in paginated.items],
        'total':    paginated.total,
        'page':     paginated.page,
        'pages':    paginated.pages,
        'has_next': paginated.has_next,
    }), 200


@finance_bp.route('/expenses', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def create_expense():
    data = request.get_json() or {}
    user = get_current_user()

    category = data.get('category')
    title    = (data.get('title') or '').strip()
    amount   = data.get('amount')

    if category not in EXPENSE_CATEGORIES:
        return jsonify({'error': f'Invalid category. Allowed: {EXPENSE_CATEGORIES}'}), 400
    if not title:
        return jsonify({'error': 'Title is required.'}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({'error': 'Amount must be a number.'}), 400
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0.'}), 400

    pay_date = date.fromisoformat(data['payment_date']) if data.get('payment_date') else date.today()

    # Principal creates directly as APPROVED/PAID; other staff defaults to PENDING_APPROVAL
    initial_status = data.get('status')
    if not initial_status:
        initial_status = 'PAID' if user.role in ['PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT'] else 'PENDING_APPROVAL'

    sid = _school_id()
    year = date.today().year
    exp_count = Expense.query.filter_by(school_id=sid).count() + 1
    expense_number = f"EXP-{year}-{exp_count:05d}"

    exp = Expense(
        school_id        = sid,
        expense_number   = expense_number,
        category         = category,
        title            = title,
        vendor_name      = (data.get('vendor_name') or '').strip(),
        department       = data.get('department', 'ACCOUNTS'),
        amount           = amount,
        invoice_number   = (data.get('invoice_number') or '').strip(),
        payment_method   = data.get('payment_method', 'CASH'),
        payment_date     = pay_date,
        month            = _month_label(pay_date),
        status           = initial_status,
        approved_by      = user.id if initial_status in ['APPROVED', 'PAID'] else None,
        approved_at      = datetime.utcnow() if initial_status in ['APPROVED', 'PAID'] else None,
        source           = 'MANUAL',
        remarks          = data.get('remarks', ''),
        created_by       = user.id,
    )
    db.session.add(exp)
    db.session.commit()
    return jsonify(exp.to_dict()), 201


@finance_bp.route('/expenses/<int:exp_id>', methods=['PATCH', 'PUT'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ACCOUNTANT')
def update_expense(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    if data.get('category') and data['category'] in EXPENSE_CATEGORIES:
        exp.category = data['category']
    if data.get('title'):
        exp.title = data['title'].strip()
    if 'vendor_name' in data:
        exp.vendor_name = (data['vendor_name'] or '').strip()
    if 'department' in data:
        exp.department = data['department']
    if data.get('amount'):
        try:
            exp.amount = float(data['amount'])
        except (TypeError, ValueError):
            return jsonify({'error': 'Amount must be a number.'}), 400
    if 'invoice_number' in data:
        exp.invoice_number = (data['invoice_number'] or '').strip()
    if data.get('payment_method'):
        exp.payment_method = data['payment_method']
    if data.get('payment_date'):
        exp.payment_date = date.fromisoformat(data['payment_date'])
        exp.month        = _month_label(exp.payment_date)
    if data.get('status'):
        exp.status = data['status']
    if 'remarks' in data:
        exp.remarks = data['remarks']

    db.session.commit()
    return jsonify(exp.to_dict()), 200


@finance_bp.route('/expenses/<int:exp_id>/approve', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def approve_expense(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    user = get_current_user()
    exp.status = 'APPROVED'
    exp.approved_by = user.id
    exp.approved_at = datetime.utcnow()
    exp.rejection_reason = None
    db.session.commit()
    return jsonify(exp.to_dict()), 200


@finance_bp.route('/expenses/<int:exp_id>/reject', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def reject_expense(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    reason = (data.get('reason') or 'Rejected by Principal').strip()

    exp.status = 'REJECTED'
    exp.rejection_reason = reason
    db.session.commit()
    return jsonify(exp.to_dict()), 200


@finance_bp.route('/expenses/<int:exp_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def delete_expense(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    db.session.delete(exp)
    db.session.commit()
    return jsonify({'message': 'Expense record removed'}), 200


@finance_bp.route('/expenses/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def expense_summary():
    sid   = _school_id()
    month = request.args.get('month')

    q = db.session.query(
        Expense.category,
        func.sum(Expense.amount).label('total'),
        func.count(Expense.id).label('count'),
    ).filter(Expense.school_id == sid, Expense.status.in_(['APPROVED', 'PAID']))

    if month:
        q = q.filter(Expense.month == month)

    rows  = q.group_by(Expense.category).all()
    total = sum(r.total for r in rows) or 0.0

    return jsonify({
        'month': month,
        'total_expense': round(total, 2),
        'categories': [
            {
                'category': r.category,
                'amount':   round(r.total, 2),
                'count':    r.count,
                'pct':      round(r.total / total * 100, 1) if total else 0,
            }
            for r in sorted(rows, key=lambda r: r.total, reverse=True)
        ],
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  2. PURCHASES & PROCUREMENT FLOW (PO, GRN, VENDOR BILLS, PAYMENTS)
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/purchases/orders', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_purchase_orders():
    sid       = _school_id()
    status    = request.args.get('status')
    vendor_id = request.args.get('vendor_id', type=int)

    q = PurchaseOrder.query.filter_by(school_id=sid)
    if status:
        q = q.filter_by(status=status)
    if vendor_id:
        q = q.filter_by(vendor_id=vendor_id)

    orders = q.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.created_at.desc()).all()
    return jsonify([po.to_dict() for po in orders]), 200


@finance_bp.route('/purchases/orders', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_create_purchase_order():
    data = request.get_json() or {}
    user = get_current_user()
    try:
        po = create_purchase_order(
            school_id=_school_id(),
            vendor_id=data.get('vendor_id'),
            items_data=data.get('items', []),
            target_type=data.get('target_type', 'INVENTORY'),
            expected_delivery_date=date.fromisoformat(data['expected_delivery_date']) if data.get('expected_delivery_date') else None,
            notes=data.get('notes', ''),
            user=user
        )
        return jsonify(po.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/purchases/orders/<int:po_id>/approve', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def api_approve_purchase_order(po_id):
    user = get_current_user()
    try:
        po = approve_purchase_order(po_id, _school_id(), user)
        return jsonify(po.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/purchases/orders/<int:po_id>/cancel', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def api_cancel_purchase_order(po_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        po = cancel_purchase_order(po_id, _school_id(), user, reason=data.get('reason', ''))
        return jsonify(po.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/purchases/orders/<int:po_id>/grn', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_process_goods_receipt(po_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        grn, bill = process_goods_receipt(
            po_id=po_id,
            school_id=_school_id(),
            received_items=data.get('items', []),
            challan_no=data.get('challan_no', ''),
            notes=data.get('notes', ''),
            user=user
        )
        return jsonify({
            'grn': grn.to_dict(),
            'bill': bill.to_dict(),
            'message': 'Goods receipt verified. Inventory/Assets and Vendor Bill updated.'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/purchases/bills', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_vendor_bills():
    sid       = _school_id()
    status    = request.args.get('status')
    vendor_id = request.args.get('vendor_id', type=int)

    q = VendorBill.query.filter_by(school_id=sid)
    if status:
        q = q.filter_by(status=status)
    if vendor_id:
        q = q.filter_by(vendor_id=vendor_id)

    bills = q.order_by(VendorBill.bill_date.desc()).all()
    return jsonify([b.to_dict() for b in bills]), 200


@finance_bp.route('/purchases/bills/<int:bill_id>/pay', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_pay_vendor_bill(bill_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        pay = record_vendor_bill_payment(
            bill_id=bill_id,
            school_id=_school_id(),
            amount=data.get('amount'),
            payment_mode=data.get('payment_mode', 'BANK_TRANSFER'),
            reference_no=data.get('reference_no', ''),
            notes=data.get('notes', ''),
            user=user
        )
        return jsonify({
            'payment': pay.to_dict(),
            'message': f"Payment of ₹{pay.amount} recorded successfully. Expense synchronized with Central Finance."
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ═══════════════════════════════════════════════════════════════════════════
#  3. INVENTORY (CONSUMABLES, STOCK MOVEMENTS, ISSUES, ADJUSTMENTS)
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/inventory', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_inventory():
    sid       = _school_id()
    category  = request.args.get('category')
    status    = request.args.get('status')
    low_stock = request.args.get('low_stock')
    search    = (request.args.get('search') or '').strip()

    q = InventoryItem.query.filter_by(school_id=sid)
    if category:
        q = q.filter_by(category=category)
    if status:
        q = q.filter_by(status=status)
    if search:
        q = q.filter(InventoryItem.name.ilike(f'%{search}%'))

    items = q.order_by(InventoryItem.created_at.desc()).all()
    if low_stock == 'true':
        items = [i for i in items if (i.quantity or 0) <= (i.min_stock or 0)]

    return jsonify([i.to_dict() for i in items]), 200


@finance_bp.route('/inventory', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def create_inventory_item():
    data = request.get_json() or {}
    user = get_current_user()

    name     = (data.get('name') or '').strip()
    category = data.get('category')
    if not name:
        return jsonify({'error': 'Item name is required.'}), 400

    try:
        quantity   = int(data.get('quantity', 0))
        unit_price = float(data.get('unit_price', 0.0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Quantity and Unit Price must be numbers.'}), 400

    sid = _school_id()
    count = InventoryItem.query.filter_by(school_id=sid).count() + 1
    item_code = data.get('item_code') or f"ITM-{count:04d}"

    p_date = date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else date.today()

    item = InventoryItem(
        school_id        = sid,
        item_code        = item_code,
        name             = name,
        category         = category or 'STATIONERY',
        subcategory      = (data.get('subcategory') or '').strip(),
        unit             = data.get('unit', 'PIECES'),
        brand            = (data.get('brand') or '').strip(),
        description      = (data.get('description') or '').strip(),
        sku              = (data.get('sku') or item_code).strip(),
        vendor_id        = data.get('vendor_id'),
        vendor_name      = (data.get('vendor_name') or '').strip(),
        quantity         = quantity,
        unit_price       = unit_price,
        selling_price    = float(data.get('selling_price', 0.0)),
        min_stock        = int(data.get('min_stock', 5)),
        reorder_level    = int(data.get('reorder_level', 10)),
        purchase_date    = p_date,
        location         = data.get('location', 'Store Room'),
        storage_location = data.get('storage_location', data.get('location', 'Store Room')),
        condition        = data.get('condition', 'NEW'),
        status           = 'ACTIVE',
        remarks          = data.get('remarks', ''),
        created_by       = user.id if user else None,
    )
    db.session.add(item)
    db.session.flush()

    # If opening stock > 0, log opening stock movement
    if quantity > 0:
        movement = StockMovement(
            school_id=sid,
            item_id=item.id,
            movement_type='STOCK_IN',
            quantity=quantity,
            previous_stock=0,
            new_stock=quantity,
            unit_price=unit_price,
            movement_date=p_date,
            reference_no="OPENING-STOCK",
            reason="Opening stock registration",
            performed_by=user.id if user else None,
        )
        db.session.add(movement)

    db.session.commit()
    return jsonify(item.to_dict()), 201


@finance_bp.route('/inventory/<int:item_id>', methods=['PATCH', 'PUT'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def update_inventory_item(item_id):
    item = InventoryItem.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    for f in ['name', 'category', 'subcategory', 'unit', 'brand', 'description', 'sku',
              'location', 'storage_location', 'condition', 'status', 'remarks']:
        if f in data:
            setattr(item, f, data[f])

    if 'unit_price' in data:
        item.unit_price = float(data['unit_price'])
    if 'selling_price' in data:
        item.selling_price = float(data['selling_price'])
    if 'min_stock' in data:
        item.min_stock = int(data['min_stock'])
    if 'reorder_level' in data:
        item.reorder_level = int(data['reorder_level'])

    db.session.commit()
    return jsonify(item.to_dict()), 200


@finance_bp.route('/inventory/issue', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_issue_inventory():
    data = request.get_json() or {}
    user = get_current_user()
    try:
        movement = issue_inventory_stock(
            item_id=data.get('item_id'),
            school_id=_school_id(),
            quantity=data.get('quantity'),
            issued_to_user_id=data.get('issued_to_user_id'),
            issued_to_name=data.get('issued_to_name', ''),
            department=data.get('department', ''),
            target_class_id=data.get('target_class_id'),
            class_name=data.get('class_name', ''),
            reason=data.get('reason', ''),
            user=user
        )
        return jsonify({
            'movement': movement.to_dict(),
            'message': f"Issued {movement.quantity} units successfully. Stock reduced."
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/inventory/adjust', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_adjust_inventory():
    data = request.get_json() or {}
    user = get_current_user()
    try:
        movement = adjust_inventory_stock(
            item_id=data.get('item_id'),
            school_id=_school_id(),
            adjustment_qty=data.get('adjustment_qty'),
            reason=data.get('reason', ''),
            user=user
        )
        return jsonify({
            'movement': movement.to_dict(),
            'message': f"Stock adjusted ({movement.quantity} units). Audit log created."
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/inventory/<int:item_id>/movements', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_item_movements(item_id):
    sid = _school_id()
    item = InventoryItem.query.filter_by(id=item_id, school_id=sid).first_or_404()
    movements = item.movements.order_by(StockMovement.movement_date.desc(), StockMovement.created_at.desc()).all()
    return jsonify([m.to_dict() for m in movements]), 200


@finance_bp.route('/inventory/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def inventory_summary():
    sid   = _school_id()
    items = InventoryItem.query.filter_by(school_id=sid, status='ACTIVE').all()

    total_value = sum((i.quantity or 0) * (i.unit_price or 0.0) for i in items)
    low_stock   = [i for i in items if (i.quantity or 0) <= (i.min_stock or 0)]
    out_of_stock = [i for i in items if (i.quantity or 0) == 0]

    cat_map = {}
    for i in items:
        cat_map.setdefault(i.category, {'count': 0, 'value': 0.0})
        cat_map[i.category]['count'] += 1
        cat_map[i.category]['value'] += (i.quantity or 0) * (i.unit_price or 0.0)

    return jsonify({
        'total_items':        len(items),
        'total_stock_value':  round(total_value, 2),
        'low_stock_count':    len(low_stock),
        'out_of_stock_count': len(out_of_stock),
        'low_stock_items':    [i.to_dict() for i in low_stock],
        'by_category': [
            {'category': k, 'count': v['count'], 'value': round(v['value'], 2)}
            for k, v in sorted(cat_map.items(), key=lambda x: x[1]['value'], reverse=True)
        ],
    }), 200


@finance_bp.route('/inventory/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def inventory_meta():
    return jsonify({
        'categories':      INVENTORY_CATEGORIES,
        'units':           INVENTORY_UNITS,
        'conditions':      ITEM_CONDITIONS,
        'statuses':        ITEM_STATUSES,
        'movement_types':  STOCK_MOVEMENT_TYPES,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  4. VENDORS & SUPPLIERS
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/vendors', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_vendors():
    sid      = _school_id()
    category = request.args.get('category')
    search   = (request.args.get('search') or '').strip()

    q = Vendor.query.filter_by(school_id=sid, is_active=True)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Vendor.name.ilike(f'%{search}%'))

    vendors = q.order_by(Vendor.name.asc()).all()
    return jsonify([v.to_dict() for v in vendors]), 200


@finance_bp.route('/vendors', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def create_vendor():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Vendor name is required.'}), 400

    sid = _school_id()
    count = Vendor.query.filter_by(school_id=sid).count() + 1
    vendor_code = data.get('vendor_code') or f"VND-{count:04d}"

    vendor = Vendor(
        school_id       = sid,
        vendor_code     = vendor_code,
        name            = name,
        contact_person  = data.get('contact_person', ''),
        phone           = data.get('phone', ''),
        email           = data.get('email', ''),
        address         = data.get('address', ''),
        gst_number      = data.get('gst_number', ''),
        pan_number      = data.get('pan_number', ''),
        payment_terms   = data.get('payment_terms', 'Net 30'),
        bank_name       = data.get('bank_name', ''),
        bank_account_no = data.get('bank_account_no', ''),
        bank_ifsc       = data.get('bank_ifsc', ''),
        category        = data.get('category', 'OTHER'),
        rating          = int(data.get('rating', 0)),
        notes           = data.get('notes', ''),
        created_by      = get_current_user().id,
    )
    db.session.add(vendor)
    db.session.commit()
    return jsonify(vendor.to_dict()), 201


@finance_bp.route('/vendors/<int:vendor_id>', methods=['PATCH', 'PUT'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def update_vendor(vendor_id):
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    for field in ['name', 'contact_person', 'phone', 'email', 'address', 'gst_number',
                  'pan_number', 'payment_terms', 'bank_name', 'bank_account_no', 'bank_ifsc',
                  'category', 'notes']:
        if field in data:
            setattr(vendor, field, data[field])
    if 'rating' in data:
        vendor.rating = max(0, min(5, int(data['rating'])))

    db.session.commit()
    return jsonify(vendor.to_dict()), 200


@finance_bp.route('/vendors/<int:vendor_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def delete_vendor(vendor_id):
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    vendor.is_active = False
    db.session.commit()
    return jsonify({'message': 'Vendor deactivated'}), 200


@finance_bp.route('/vendors/<int:vendor_id>/history', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def vendor_history(vendor_id):
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    bills = [b.to_dict() for b in vendor.bills.order_by(VendorBill.bill_date.desc()).all()]
    payments = [p.to_dict() for p in vendor.payments.order_by(VendorPayment.payment_date.desc()).all()]
    pos = [po.to_dict() for po in vendor.purchase_orders.order_by(PurchaseOrder.order_date.desc()).all()]

    return jsonify({
        'vendor':              vendor.to_dict(),
        'total_purchases':     vendor.total_purchases,
        'total_paid':          vendor.total_paid,
        'outstanding_balance': vendor.outstanding_balance,
        'bills':               bills,
        'payments':            payments,
        'purchase_orders':     pos,
    }), 200


@finance_bp.route('/vendors/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def vendors_meta():
    return jsonify({'categories': VENDOR_CATEGORIES}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  5. SCHOOL ASSET MANAGEMENT (CAPITAL EQUIPMENT, ASSIGNMENTS, REPAIRS)
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/assets', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def list_assets():
    sid        = _school_id()
    category   = request.args.get('category')
    status     = request.args.get('status')
    condition  = request.args.get('condition')
    department = request.args.get('department')
    search     = (request.args.get('search') or '').strip()

    q = SchoolAsset.query.filter_by(school_id=sid)
    if category:
        q = q.filter_by(category=category)
    if status:
        q = q.filter_by(status=status)
    if condition:
        q = q.filter_by(condition=condition)
    if department:
        q = q.filter_by(department=department)
    if search:
        q = q.filter(
            (SchoolAsset.name.ilike(f'%{search}%')) |
            (SchoolAsset.asset_tag.ilike(f'%{search}%')) |
            (SchoolAsset.serial_number.ilike(f'%{search}%')) |
            (SchoolAsset.assigned_to_name.ilike(f'%{search}%'))
        )

    assets = q.order_by(SchoolAsset.purchase_date.desc()).all()
    return jsonify([a.to_dict() for a in assets]), 200


@finance_bp.route('/assets', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_create_asset():
    data = request.get_json() or {}
    user = get_current_user()
    try:
        asset = create_asset(_school_id(), data, user=user)
        return jsonify(asset.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/assets/<int:asset_id>', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def get_asset_detail(asset_id):
    sid = _school_id()
    asset = SchoolAsset.query.filter_by(id=asset_id, school_id=sid).first_or_404()

    assignments = [a.to_dict() for a in asset.assignments.order_by(AssetAssignmentHistory.transfer_date.desc()).all()]
    condition_logs = [c.to_dict() for c in asset.condition_logs.order_by(AssetConditionLog.inspected_date.desc()).all()]
    maintenance = [m.to_dict() for m in asset.maintenance_records.order_by(AssetMaintenanceRecord.maintenance_date.desc()).all()]

    result = asset.to_dict()
    result['assignments'] = assignments
    result['condition_logs'] = condition_logs
    result['maintenance_records'] = maintenance
    return jsonify(result), 200


@finance_bp.route('/assets/<int:asset_id>/transfer', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_transfer_asset(asset_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        asset = assign_or_transfer_asset(
            asset_id=asset_id,
            school_id=_school_id(),
            to_user_id=data.get('to_user_id'),
            to_user_name=data.get('to_user_name', ''),
            to_location=data.get('to_location', ''),
            to_department=data.get('to_department', ''),
            reason=data.get('reason', ''),
            user=user
        )
        return jsonify(asset.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/assets/<int:asset_id>/condition', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_record_asset_condition(asset_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        asset = record_asset_condition(
            asset_id=asset_id,
            school_id=_school_id(),
            new_condition=data.get('condition'),
            notes=data.get('notes', ''),
            user=user
        )
        return jsonify(asset.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/assets/<int:asset_id>/maintenance', methods=['POST'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_record_asset_maintenance(asset_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        maint = record_asset_maintenance(
            asset_id=asset_id,
            school_id=_school_id(),
            title=data.get('title', 'Maintenance / Repair'),
            description=data.get('description', ''),
            cost=data.get('cost', 0.0),
            vendor_id=data.get('vendor_id'),
            vendor_name=data.get('vendor_name', ''),
            performed_by=data.get('performed_by', ''),
            user=user
        )
        return jsonify({
            'maintenance': maint.to_dict(),
            'message': f"Maintenance recorded. Linked expense ₹{maint.cost} synchronized with Finance."
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/assets/<int:asset_id>/dispose', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def api_dispose_asset(asset_id):
    data = request.get_json() or {}
    user = get_current_user()
    try:
        asset = dispose_or_retire_asset(
            asset_id=asset_id,
            school_id=_school_id(),
            disposal_method=data.get('disposal_method', 'RETIRED'),
            disposal_amount=data.get('disposal_amount', 0.0),
            reason=data.get('reason', ''),
            user=user
        )
        return jsonify(asset.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@finance_bp.route('/assets/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def api_assets_summary():
    return jsonify(get_assets_summary(_school_id())), 200


@finance_bp.route('/assets/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def assets_meta():
    return jsonify({
        'categories': ASSET_CATEGORIES,
        'conditions': ASSET_CONDITIONS,
        'statuses':   ASSET_STATUSES,
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  6. REPORTS (STOCK, VENDOR OUTSTANDING, ASSET REGISTER)
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/reports/stock', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def report_stock():
    sid = _school_id()
    items = InventoryItem.query.filter_by(school_id=sid).order_by(InventoryItem.name.asc()).all()
    return jsonify([
        {
            'item_code':   i.item_code or i.sku,
            'name':        i.name,
            'category':    i.category,
            'unit':        i.unit,
            'stock':       i.quantity,
            'unit_price':  i.unit_price,
            'total_value': round((i.quantity or 0) * (i.unit_price or 0.0), 2),
            'min_stock':   i.min_stock,
            'status':      'LOW_STOCK' if (i.quantity or 0) <= (i.min_stock or 0) else 'IN_STOCK',
            'location':    i.storage_location or i.location,
        }
        for i in items
    ]), 200


@finance_bp.route('/reports/vendor-outstanding', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def report_vendor_outstanding():
    sid = _school_id()
    vendors = Vendor.query.filter_by(school_id=sid, is_active=True).all()
    return jsonify([
        {
            'vendor_code':         v.vendor_code or f"VND-{v.id:04d}",
            'name':                v.name,
            'category':            v.category,
            'phone':               v.phone,
            'total_purchases':     v.total_purchases,
            'total_paid':          v.total_paid,
            'outstanding_balance': v.outstanding_balance,
        }
        for v in vendors
    ]), 200


@finance_bp.route('/reports/asset-register', methods=['GET'])
@role_required('PRINCIPAL', 'ACCOUNTANT', 'SUPER_ADMIN')
def report_asset_register():
    sid = _school_id()
    assets = SchoolAsset.query.filter_by(school_id=sid).order_by(SchoolAsset.asset_tag.asc()).all()
    return jsonify([
        {
            'asset_tag':     a.asset_tag,
            'name':          a.name,
            'category':      a.category,
            'serial_number': a.serial_number,
            'purchase_date': str(a.purchase_date) if a.purchase_date else None,
            'purchase_cost': a.purchase_cost,
            'location':      a.location,
            'department':    a.department,
            'assigned_to':   a.assigned_to_name or 'Unassigned',
            'condition':     a.condition,
            'status':        a.status,
            'warranty_end':  str(a.warranty_end) if a.warranty_end else None,
        }
        for a in assets
    ]), 200


# ═══════════════════════════════════════════════════════════════════════════
#  7. EXECUTIVE PROFIT / LOSS & METADATA
# ═══════════════════════════════════════════════════════════════════════════

@finance_bp.route('/profit-summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def profit_summary():
    sid   = _school_id()
    month = request.args.get('month') or _month_label(date.today())

    bounds = _month_bounds(month)
    if not bounds:
        return jsonify({'error': 'month format must be like "July 2026"'}), 400
    year, month_num = bounds

    revenue = db.session.query(func.sum(FeeRecord.amount_paid))\
        .filter(
            FeeRecord.school_id == sid,
            FeeRecord.paid_date.isnot(None),
            extract('year',  FeeRecord.paid_date) == year,
            extract('month', FeeRecord.paid_date) == month_num,
        ).scalar() or 0.0

    expenses = db.session.query(func.sum(Expense.amount))\
        .filter(Expense.school_id == sid, Expense.month == month, Expense.status.in_(['APPROVED', 'PAID'])).scalar() or 0.0

    salary_expense = db.session.query(func.sum(Expense.amount))\
        .filter(
            Expense.school_id == sid, Expense.month == month,
            Expense.category.in_(['TEACHER_SALARY', 'STAFF_SALARY']),
            Expense.status.in_(['APPROVED', 'PAID'])
        ).scalar() or 0.0

    profit = round(revenue - expenses, 2)

    return jsonify({
        'month':           month,
        'revenue':         round(revenue, 2),
        'expenses':        round(expenses, 2),
        'salary_expense':  round(salary_expense, 2),
        'profit':          profit,
        'profit_margin_pct': round(profit / revenue * 100, 1) if revenue else 0.0,
        'expense_ratio_pct': round(expenses / revenue * 100, 1) if revenue else 0.0,
        'salary_pct_of_expense': round(salary_expense / expenses * 100, 1) if expenses else 0.0,
    }), 200


@finance_bp.route('/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def finance_meta():
    return jsonify({
        'categories':      EXPENSE_CATEGORIES,
        'payment_methods': PAYMENT_METHODS,
        'statuses':        EXPENSE_STATUSES,
    }), 200


@finance_bp.route('/monthly-trend', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT', 'SUPER_ADMIN')
def monthly_trend():
    """
    Returns monthly financial trend for the school over the last N months.
    """
    sid = _school_id()
    months_count = request.args.get('months', default=6, type=int)

    fee_agg = db.session.query(
        FeeRecord.month,
        func.sum(FeeRecord.amount_due).label('expected'),
        func.sum(FeeRecord.amount_paid).label('collected')
    ).filter(
        FeeRecord.school_id == sid,
        FeeRecord.month.isnot(None)
    ).group_by(FeeRecord.month).order_by(FeeRecord.month.desc()).limit(months_count).all()

    result = []
    for r in reversed(fee_agg):
        exp = float(r.expected or 0)
        col = float(r.collected or 0)
        result.append({
            'month': r.month,
            'expected': exp,
            'collected': col,
            'pending': max(0.0, exp - col),
            'collection_pct': round((col / exp * 100), 1) if exp > 0 else 0.0
        })

    return jsonify(result), 200
