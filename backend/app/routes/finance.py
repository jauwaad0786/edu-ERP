from flask import Blueprint, request, jsonify
from app import db
from app.models.financial import FeeRecord
from app.models.finance import (
    Expense, EXPENSE_CATEGORIES, PAYMENT_METHODS,
    InventoryItem, INVENTORY_CATEGORIES, ITEM_CONDITIONS, ITEM_STATUSES,
    Vendor, VENDOR_CATEGORIES,
)
from app.utils.decorators import role_required, get_current_user
from sqlalchemy import func, extract
from datetime import date, datetime
import cloudinary.uploader

finance_bp = Blueprint('finance', __name__)


def _school_id():
    return get_current_user().school_id


def _month_label(d):
    """date object -> 'July 2026' — FeeRecord.month se hi consistent format"""
    return d.strftime('%B %Y')


def _month_bounds(month_str):
    """'July 2026' -> (year, month_number). Return None agar invalid."""
    try:
        parsed = datetime.strptime(month_str, '%B %Y')
        return parsed.year, parsed.month
    except (ValueError, TypeError):
        return None


# ─── Expenses — CRUD ────────────────────────────────────────────────────────

@finance_bp.route('/expenses', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def list_expenses():
    sid      = _school_id()
    month    = request.args.get('month')       # "July 2026"
    category = request.args.get('category')
    status   = request.args.get('status')
    source   = request.args.get('source')

    q = Expense.query.filter_by(school_id=sid)
    if month:
        q = q.filter_by(month=month)
    if category:
        q = q.filter_by(category=category)
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
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def create_expense():
    """
    Body: { category, title, vendor_name, amount, invoice_number,
            payment_method, payment_date, status, remarks }
    """
    data = request.get_json() or {}

    category = data.get('category')
    title    = (data.get('title') or '').strip()
    amount   = data.get('amount')

    if category not in EXPENSE_CATEGORIES:
        return jsonify({'error': f'Invalid category. Allowed: {EXPENSE_CATEGORIES}'}), 400
    if not title:
        return jsonify({'error': 'title zaroori hai'}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({'error': 'amount must be a number'}), 400
    if amount <= 0:
        return jsonify({'error': 'amount 0 se zyada hona chahiye'}), 400

    pay_date = date.fromisoformat(data['payment_date']) if data.get('payment_date') else date.today()

    exp = Expense(
        school_id      = _school_id(),
        category       = category,
        title          = title,
        vendor_name    = (data.get('vendor_name') or '').strip(),
        amount         = amount,
        invoice_number = (data.get('invoice_number') or '').strip(),
        payment_method = data.get('payment_method', 'CASH'),
        payment_date   = pay_date,
        month          = _month_label(pay_date),
        status         = data.get('status', 'PAID'),
        source         = 'MANUAL',
        remarks        = data.get('remarks', ''),
        created_by     = get_current_user().id,
    )
    db.session.add(exp)
    db.session.commit()
    return jsonify(exp.to_dict()), 201


@finance_bp.route('/expenses/<int:exp_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
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
    if data.get('amount'):
        try:
            exp.amount = float(data['amount'])
        except (TypeError, ValueError):
            return jsonify({'error': 'amount must be a number'}), 400
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


@finance_bp.route('/expenses/<int:exp_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_expense(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(exp)
    db.session.commit()
    return jsonify({'message': 'Expense deleted'}), 200


@finance_bp.route('/expenses/<int:exp_id>/bill', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def upload_expense_bill(exp_id):
    exp = Expense.query.get_or_404(exp_id)
    if exp.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    file = request.files.get('bill')
    if not file:
        return jsonify({'error': 'File nahi mila — field name: bill'}), 400

    result = cloudinary.uploader.upload(
        file,
        folder='eduerp/expenses',
        public_id=f'expense_{exp_id}',
        overwrite=True,
        resource_type='auto',
    )
    exp.bill_url = result['secure_url']
    db.session.commit()
    return jsonify({'bill_url': exp.bill_url}), 200


# ─── Category-wise Summary (for pie chart) ──────────────────────────────────

@finance_bp.route('/expenses/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def expense_category_summary():
    sid   = _school_id()
    month = request.args.get('month')

    q = db.session.query(
        Expense.category,
        func.sum(Expense.amount).label('total'),
        func.count(Expense.id).label('count'),
    ).filter(Expense.school_id == sid)

    if month:
        q = q.filter(Expense.month == month)

    rows  = q.group_by(Expense.category).all()
    total = sum(r.total for r in rows) or 0

    return jsonify({
        'month': month,
        'total_expense': total,
        'categories': [
            {
                'category': r.category,
                'amount':   r.total,
                'count':    r.count,
                'pct':      round(r.total / total * 100, 1) if total else 0,
            }
            for r in sorted(rows, key=lambda r: r.total, reverse=True)
        ],
    }), 200


# ─── Profit & Loss — the core "iss month kitna profit hua" endpoint ─────────

@finance_bp.route('/profit-summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def profit_summary():
    """
    Query param: month=July 2026 (default: current month)

    Revenue  = FeeRecord.amount_paid jinka paid_date is month mein hai
               (Note: partial/installment payments approximate ho sakte hain —
               accurate ledger ke liye FeeTransaction table chahiye, abhi
               paid_date-based approximation use ho raha hai)
    Expenses = Expense.amount jinka month field match karta hai
    Profit   = Revenue - Expenses
    """
    sid   = _school_id()
    month = request.args.get('month') or _month_label(date.today())

    bounds = _month_bounds(month)
    if not bounds:
        return jsonify({'error': 'month format "July 2026" jaisa hona chahiye'}), 400
    year, month_num = bounds

    revenue = db.session.query(func.sum(FeeRecord.amount_paid))\
        .filter(
            FeeRecord.school_id == sid,
            FeeRecord.paid_date.isnot(None),
            extract('year',  FeeRecord.paid_date) == year,
            extract('month', FeeRecord.paid_date) == month_num,
        ).scalar() or 0

    expenses = db.session.query(func.sum(Expense.amount))\
        .filter(Expense.school_id == sid, Expense.month == month).scalar() or 0

    salary_expense = db.session.query(func.sum(Expense.amount))\
        .filter(
            Expense.school_id == sid, Expense.month == month,
            Expense.category.in_(['TEACHER_SALARY', 'STAFF_SALARY']),
        ).scalar() or 0

    profit = revenue - expenses

    return jsonify({
        'month':           month,
        'revenue':         revenue,
        'expenses':        expenses,
        'salary_expense':  salary_expense,
        'profit':          profit,
        'profit_margin_pct': round(profit / revenue * 100, 1) if revenue else 0,
        'expense_ratio_pct': round(expenses / revenue * 100, 1) if revenue else 0,
        'salary_pct_of_expense': round(salary_expense / expenses * 100, 1) if expenses else 0,
    }), 200


# ─── Monthly Trend (for line/bar charts — last N months) ────────────────────

@finance_bp.route('/monthly-trend', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def monthly_trend():
    """Query param: months=6 (default 6) -> last N months revenue/expense/profit"""
    sid    = _school_id()
    n      = min(request.args.get('months', 6, type=int), 24)

    today  = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(n):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()

    result = []
    for (y, m) in months:
        label = date(y, m, 1).strftime('%B %Y')

        revenue = db.session.query(func.sum(FeeRecord.amount_paid))\
            .filter(
                FeeRecord.school_id == sid,
                FeeRecord.paid_date.isnot(None),
                extract('year',  FeeRecord.paid_date) == y,
                extract('month', FeeRecord.paid_date) == m,
            ).scalar() or 0

        expenses = db.session.query(func.sum(Expense.amount))\
            .filter(Expense.school_id == sid, Expense.month == label).scalar() or 0

        result.append({
            'month':    label,
            'revenue':  revenue,
            'expenses': expenses,
            'profit':   revenue - expenses,
        })

    return jsonify(result), 200

@finance_bp.route('/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def finance_meta():
    """Frontend dropdowns ke liye category/payment-method list."""
    return jsonify({
        'categories':      EXPENSE_CATEGORIES,
        'payment_methods': PAYMENT_METHODS,
    }), 200


# ─── Inventory ───────────────────────────────────────────────────────────────

def _make_purchase_expense(item, qty, unit_price, vendor_name, note=''):
    """Har naya purchase (ya restock) yahan se ek Expense banata hai —
    isi function ki wajah se Inventory aur Finance hamesha real-time sync rehte hain."""
    amount = round((qty or 0) * (unit_price or 0), 2)
    exp = Expense(
        school_id      = item.school_id,
        category       = 'INVENTORY_PURCHASE',
        title          = f'Inventory — {item.name} ({qty} units)',
        vendor_name    = vendor_name or item.vendor_name,
        amount         = amount,
        payment_method = 'CASH',
        payment_date   = item.purchase_date or date.today(),
        month          = _month_label(item.purchase_date or date.today()),
        status         = 'PAID',
        source         = 'INVENTORY_AUTO',
        source_ref_id  = item.id,
        remarks        = note,
        created_by     = get_current_user().id,
    )
    db.session.add(exp)
    return exp


@finance_bp.route('/inventory', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def list_inventory():
    sid      = _school_id()
    category = request.args.get('category')
    status   = request.args.get('status')
    low_stock = request.args.get('low_stock')
    search   = (request.args.get('search') or '').strip()

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
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def create_inventory_item():
    """
    Body: { name, category, sku, vendor_name, quantity, unit_price,
            min_stock, purchase_date, location, assigned_to, condition, remarks }

    Naya item save hote hi isi request mein ek linked Expense bhi ban jaati hai —
    real-time, koi alag step nahi.
    """
    data = request.get_json() or {}

    name     = (data.get('name') or '').strip()
    category = data.get('category')
    if not name:
        return jsonify({'error': 'Item ka naam likhna zaroori hai'}), 400
    if category not in INVENTORY_CATEGORIES:
        return jsonify({'error': f'Invalid category. Allowed: {INVENTORY_CATEGORIES}'}), 400

    try:
        quantity   = int(data.get('quantity', 1))
        unit_price = float(data.get('unit_price', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'quantity/unit_price number hone chahiye'}), 400
    if quantity <= 0:
        return jsonify({'error': 'quantity 0 se zyada honi chahiye'}), 400

    p_date = date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else date.today()

    item = InventoryItem(
        school_id     = _school_id(),
        name          = name,
        category      = category,
        sku           = (data.get('sku') or '').strip(),
        vendor_name   = (data.get('vendor_name') or '').strip(),
        quantity      = quantity,
        unit_price    = unit_price,
        min_stock     = int(data.get('min_stock', 5)),
        purchase_date = p_date,
        location      = data.get('location', ''),
        assigned_to   = data.get('assigned_to', ''),
        condition     = data.get('condition', 'NEW'),
        status        = 'ACTIVE',
        remarks       = data.get('remarks', ''),
        created_by    = get_current_user().id,
    )
    db.session.add(item)
    db.session.flush()   # item.id chahiye Expense link karne ke liye

    exp = _make_purchase_expense(item, quantity, unit_price, item.vendor_name, note='Initial purchase')
    db.session.commit()

    result = item.to_dict()
    result['expense_id'] = exp.id
    return jsonify(result), 201


@finance_bp.route('/inventory/<int:item_id>', methods=['PATCH'])
@role_required('PRINCIPAL', 'TEACHER')
def update_inventory_item(item_id):
    """
    Item ki details edit karo (naam, location, condition, status, etc).
    Note: quantity/unit_price yahan se change karne se koi nayi Expense NAHI banti —
    ye sirf record-correction ke liye hai. Naya stock aane par /restock use karo.
    """
    item = InventoryItem.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    if data.get('name'):
        item.name = data['name'].strip()
    if data.get('category') and data['category'] in INVENTORY_CATEGORIES:
        item.category = data['category']
    if 'sku' in data:
        item.sku = (data['sku'] or '').strip()
    if 'vendor_name' in data:
        item.vendor_name = (data['vendor_name'] or '').strip()
    if 'quantity' in data:
        item.quantity = int(data['quantity'])
    if 'unit_price' in data:
        item.unit_price = float(data['unit_price'])
    if 'min_stock' in data:
        item.min_stock = int(data['min_stock'])
    if 'location' in data:
        item.location = data['location']
    if 'assigned_to' in data:
        item.assigned_to = data['assigned_to']
    if data.get('condition') in ITEM_CONDITIONS:
        item.condition = data['condition']
    if data.get('status') in ITEM_STATUSES:
        item.status = data['status']
    if 'remarks' in data:
        item.remarks = data['remarks']

    db.session.commit()
    return jsonify(item.to_dict()), 200


@finance_bp.route('/inventory/<int:item_id>/restock', methods=['POST'])
@role_required('PRINCIPAL', 'TEACHER')
def restock_inventory_item(item_id):
    """
    Existing item mein naya stock aaya (dobara purchase).
    Body: { quantity, unit_price (optional — default purana price), vendor_name, purchase_date }
    Quantity total mein add hoti hai AUR isi purchase ke liye ek nayi Expense bhi banti hai —
    yahi 'real-time' purchase-to-expense flow hai.
    """
    item = InventoryItem.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    try:
        add_qty = int(data.get('quantity', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'quantity number honi chahiye'}), 400
    if add_qty <= 0:
        return jsonify({'error': 'quantity 0 se zyada honi chahiye'}), 400

    unit_price = float(data['unit_price']) if data.get('unit_price') else item.unit_price
    p_date     = date.fromisoformat(data['purchase_date']) if data.get('purchase_date') else date.today()
    vendor     = data.get('vendor_name') or item.vendor_name

    item.quantity   = (item.quantity or 0) + add_qty
    item.unit_price = unit_price
    item.purchase_date = p_date
    if vendor:
        item.vendor_name = vendor

    exp = _make_purchase_expense(item, add_qty, unit_price, vendor, note=f'Restock (+{add_qty} units)')
    db.session.commit()

    result = item.to_dict()
    result['expense_id'] = exp.id
    return jsonify(result), 200


@finance_bp.route('/inventory/<int:item_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_inventory_item(item_id):
    """Item delete karo. Linked Expense history intentionally waise hi rehti hai — audit trail preserve rehta hai."""
    item = InventoryItem.query.get_or_404(item_id)
    if item.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Item deleted'}), 200


@finance_bp.route('/inventory/summary', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def inventory_summary():
    sid   = _school_id()
    items = InventoryItem.query.filter_by(school_id=sid, status='ACTIVE').all()

    total_value = sum((i.quantity or 0) * (i.unit_price or 0) for i in items)
    low_stock   = [i for i in items if (i.quantity or 0) <= (i.min_stock or 0)]

    cat_map = {}
    for i in items:
        cat_map.setdefault(i.category, {'count': 0, 'value': 0})
        cat_map[i.category]['count'] += 1
        cat_map[i.category]['value'] += (i.quantity or 0) * (i.unit_price or 0)

    return jsonify({
        'total_items':     len(items),
        'total_value':     round(total_value, 2),
        'low_stock_count': len(low_stock),
        'low_stock_items': [i.to_dict() for i in low_stock],
        'by_category': [
            {'category': k, 'count': v['count'], 'value': round(v['value'], 2)}
            for k, v in sorted(cat_map.items(), key=lambda x: x[1]['value'], reverse=True)
        ],
    }), 200


@finance_bp.route('/inventory/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def inventory_meta():
    return jsonify({
        'categories':  INVENTORY_CATEGORIES,
        'conditions':  ITEM_CONDITIONS,
        'statuses':    ITEM_STATUSES,
    }), 200


# ─── Vendors ─────────────────────────────────────────────────────────────────

@finance_bp.route('/vendors', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
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
@role_required('PRINCIPAL')
def create_vendor():
    """Body: { name, contact_person, phone, email, address, gst_number, pan_number, category, notes }"""
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Vendor ka naam likhna zaroori hai'}), 400

    sid = _school_id()
    existing = Vendor.query.filter(
        Vendor.school_id == sid, Vendor.is_active == True,
        db.func.lower(Vendor.name) == name.lower(),
    ).first()
    if existing:
        return jsonify({'error': f'"{name}" naam ka vendor pehle se maujood hai'}), 400

    category = data.get('category', 'OTHER')
    if category not in VENDOR_CATEGORIES:
        category = 'OTHER'

    vendor = Vendor(
        school_id      = sid,
        name           = name,
        contact_person = data.get('contact_person', ''),
        phone          = data.get('phone', ''),
        email          = data.get('email', ''),
        address        = data.get('address', ''),
        gst_number     = data.get('gst_number', ''),
        pan_number     = data.get('pan_number', ''),
        category       = category,
        notes          = data.get('notes', ''),
        created_by     = get_current_user().id,
    )
    db.session.add(vendor)
    db.session.commit()
    return jsonify(vendor.to_dict()), 201


@finance_bp.route('/vendors/<int:vendor_id>', methods=['PATCH'])
@role_required('PRINCIPAL')
def update_vendor(vendor_id):
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    for field in ['contact_person', 'phone', 'email', 'address', 'gst_number', 'pan_number', 'notes']:
        if field in data:
            setattr(vendor, field, data[field])
    if data.get('name'):
        vendor.name = data['name'].strip()
    if data.get('category') in VENDOR_CATEGORIES:
        vendor.category = data['category']
    if 'rating' in data:
        vendor.rating = max(0, min(5, int(data['rating'])))

    db.session.commit()
    return jsonify(vendor.to_dict()), 200


@finance_bp.route('/vendors/<int:vendor_id>', methods=['DELETE'])
@role_required('PRINCIPAL')
def delete_vendor(vendor_id):
    """Soft delete — purchase history (Expense/InventoryItem) audit ke liye waise hi rehti hai."""
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403
    vendor.is_active = False
    db.session.commit()
    return jsonify({'message': 'Vendor removed'}), 200


@finance_bp.route('/vendors/<int:vendor_id>/history', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER')
def vendor_history(vendor_id):
    """Vendor ke naam se match karke Expense aur Inventory purchases dono nikaalta hai."""
    vendor = Vendor.query.get_or_404(vendor_id)
    if vendor.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    sid = _school_id()
    expenses = Expense.query.filter(
        Expense.school_id == sid,
        db.func.lower(Expense.vendor_name) == vendor.name.lower(),
    ).order_by(Expense.payment_date.desc()).all()

    items = InventoryItem.query.filter(
        InventoryItem.school_id == sid,
        db.func.lower(InventoryItem.vendor_name) == vendor.name.lower(),
    ).order_by(InventoryItem.purchase_date.desc()).all()

    total_spent   = sum(e.amount for e in expenses)
    total_pending = sum(e.amount for e in expenses if e.status != 'PAID')

    return jsonify({
        'vendor':         vendor.to_dict(),
        'total_spent':    round(total_spent, 2),
        'total_pending':  round(total_pending, 2),
        'expenses':       [e.to_dict() for e in expenses],
        'inventory_items':[i.to_dict() for i in items],
    }), 200


@finance_bp.route('/vendors/meta', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
def vendors_meta():
    return jsonify({'categories': VENDOR_CATEGORIES}), 200
