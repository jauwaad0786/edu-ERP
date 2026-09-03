from app import db
from datetime import date, datetime

# ─── Constants ──────────────────────────────────────────────────────────────

EXPENSE_CATEGORIES = [
    'TEACHER_SALARY',
    'STAFF_SALARY',
    'ELECTRICITY',
    'WATER',
    'INTERNET',
    'RENT',
    'MAINTENANCE',
    'REPAIRS',
    'STATIONERY',
    'CLEANING',
    'TRANSPORT_FUEL',
    'BOOKS_LIBRARY',
    'SPORTS_EQUIPMENT',
    'COMPUTER_LAB',
    'SCIENCE_LAB',
    'FURNITURE',
    'PRINTER_STATIONERY',
    'MARKETING',
    'SMS_WHATSAPP',
    'ERP_SUBSCRIPTION',
    'INVENTORY_PURCHASE',
    'EVENTS',
    'FOOD',
    'HOSTEL',
    'LIBRARY',
    'LABORATORY',
    'SECURITY',
    'MISCELLANEOUS',
    'OTHER',
]

PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD']

EXPENSE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID']

EXPENSE_SOURCES = ['MANUAL', 'INVENTORY_AUTO', 'SALARY_AUTO', 'VENDOR_BILL', 'ASSET_MAINTENANCE']

INVENTORY_CATEGORIES = [
    'STATIONERY',
    'UNIFORMS',
    'BOOKS',
    'CHALK_MARKERS',
    'PAPER',
    'CLEANING_SUPPLIES',
    'COMPUTER_ACCESSORIES',
    'ELECTRICAL',
    'SPORTS_EQUIPMENT',
    'LAB_CONSUMABLES',
    'OFFICE_SUPPLIES',
    'FURNITURE_CONSUMABLES',
    'OTHER',
]

INVENTORY_UNITS = [
    'PIECES', 'REAMS', 'BOXES', 'PACKETS', 'SETS', 'KG', 'LITERS', 'METERS', 'ROLLS', 'DOZEN', 'OTHER'
]

ITEM_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED']
ITEM_STATUSES   = ['ACTIVE', 'DAMAGED', 'SCRAPPED']

STOCK_MOVEMENT_TYPES = [
    'PURCHASE', 'STOCK_IN', 'ISSUE', 'STOCK_OUT', 'RETURN', 'DAMAGE', 'LOSS', 'ADJUSTMENT', 'TRANSFER'
]

PURCHASE_ORDER_STATUSES = [
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
]

VENDOR_BILL_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'VOID']

ASSET_CATEGORIES = [
    'LAPTOPS', 'DESKTOPS', 'MONITORS', 'PROJECTORS', 'PRINTERS', 'CCTV',
    'BIOMETRIC_DEVICES', 'SMART_BOARDS', 'BENCHES_DESKS', 'CHAIRS_TABLES',
    'CUPBOARDS', 'AIR_CONDITIONERS', 'FANS', 'GENERATORS', 'UPS',
    'WATER_PURIFIERS', 'LAB_EQUIPMENT', 'SPORTS_EQUIPMENT',
    'MUSICAL_INSTRUMENTS', 'VEHICLES', 'HOSTEL_FURNITURE',
    'LIBRARY_FURNITURE', 'OTHER'
]

ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'CRITICAL', 'UNDER_REPAIR']

ASSET_STATUSES = [
    'AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'IN_REPAIR', 'LOST', 'DAMAGED', 'DISPOSED', 'RETIRED'
]

VENDOR_CATEGORIES = [
    'STATIONERY', 'COMPUTERS', 'FURNITURE', 'MAINTENANCE', 'TRANSPORT',
    'BOOKS_LIBRARY', 'SPORTS', 'ELECTRICAL', 'CLEANING', 'LABORATORY', 'UNIFORMS', 'OTHER',
]

STAFF_SALARY_STATUSES = ['PAID', 'PENDING']


# ─── 1. Staff Salary Records ────────────────────────────────────────────────

class StaffSalaryRecord(db.Model):
    """
    Non-teaching staff salary payments.
    """
    __tablename__ = 'staff_salary_records'

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    month           = db.Column(db.String(20))
    amount          = db.Column(db.Float, nullable=False)
    status          = db.Column(db.String(20), default='PAID')
    payment_date    = db.Column(db.Date, default=date.today)
    note            = db.Column(db.String(300), default='')

    created_by      = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    is_acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id':               self.id,
            'user_id':          self.user_id,
            'month':            self.month,
            'amount':           self.amount,
            'status':           self.status,
            'payment_date':     str(self.payment_date) if self.payment_date else None,
            'note':             self.note or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
            'is_acknowledged':  self.is_acknowledged,
            'acknowledged_at':  self.acknowledged_at.isoformat() if self.acknowledged_at else None,
        }


# ─── 2. Expenses Management ─────────────────────────────────────────────────

class Expense(db.Model):
    """
    Core school expense tracking with approval workflow and multi-department tagging.
    """
    __tablename__ = 'expenses'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    expense_number   = db.Column(db.String(40), index=True)
    category         = db.Column(db.String(40), nullable=False)
    title            = db.Column(db.String(200), nullable=False)
    vendor_name      = db.Column(db.String(150))
    department       = db.Column(db.String(50), default='ACCOUNTS')

    amount           = db.Column(db.Float, nullable=False)

    invoice_number   = db.Column(db.String(80))
    bill_url         = db.Column(db.String(500))

    payment_method   = db.Column(db.String(20), default='CASH')
    payment_date     = db.Column(db.Date, default=date.today)
    month            = db.Column(db.String(20), index=True)
    status           = db.Column(db.String(30), default='PAID')  # DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PAID

    approved_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at      = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.String(300), nullable=True)

    source           = db.Column(db.String(30), default='MANUAL', index=True)
    source_ref_id    = db.Column(db.Integer)

    remarks          = db.Column(db.String(300), default='')
    created_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'expense_number':   self.expense_number or f"EXP-{self.id:05d}",
            'category':         self.category,
            'title':            self.title,
            'vendor_name':      self.vendor_name or '',
            'department':       self.department or 'ACCOUNTS',
            'amount':           self.amount,
            'invoice_number':   self.invoice_number or '',
            'bill_url':         self.bill_url or None,
            'payment_method':   self.payment_method,
            'payment_date':     str(self.payment_date) if self.payment_date else None,
            'month':            self.month,
            'status':           self.status,
            'approved_by':      self.approved_by,
            'approved_at':      self.approved_at.isoformat() if self.approved_at else None,
            'rejection_reason': self.rejection_reason or '',
            'source':           self.source,
            'source_ref_id':    self.source_ref_id,
            'remarks':          self.remarks or '',
            'created_by':       self.created_by,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# ─── 3. Vendor Management ───────────────────────────────────────────────────

class Vendor(db.Model):
    """
    Vendor / Supplier master data.
    """
    __tablename__ = 'vendors'

    id              = db.Column(db.Integer, primary_key=True)
    school_id       = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    vendor_code     = db.Column(db.String(40), index=True)
    name            = db.Column(db.String(150), nullable=False)
    contact_person  = db.Column(db.String(120), default='')
    phone           = db.Column(db.String(20), default='')
    email           = db.Column(db.String(120), default='')
    address         = db.Column(db.String(300), default='')

    gst_number      = db.Column(db.String(30), default='')
    pan_number      = db.Column(db.String(20), default='')
    payment_terms   = db.Column(db.String(50), default='Net 30')

    bank_name       = db.Column(db.String(100), default='')
    bank_account_no = db.Column(db.String(50), default='')
    bank_ifsc       = db.Column(db.String(30), default='')

    category        = db.Column(db.String(40), default='OTHER')
    rating          = db.Column(db.Integer, default=0)
    notes           = db.Column(db.String(300), default='')

    is_active       = db.Column(db.Boolean, default=True)
    created_by      = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    purchase_orders = db.relationship('PurchaseOrder', backref='vendor', lazy='dynamic')
    bills           = db.relationship('VendorBill', backref='vendor', lazy='dynamic')
    payments        = db.relationship('VendorPayment', backref='vendor', lazy='dynamic')

    @property
    def total_purchases(self):
        return sum(b.total_amount for b in self.bills if b.status != 'VOID')

    @property
    def total_paid(self):
        return sum(p.amount for p in self.payments)

    @property
    def outstanding_balance(self):
        return round(max(0.0, self.total_purchases - self.total_paid), 2)

    def to_dict(self):
        return {
            'id':                  self.id,
            'vendor_code':         self.vendor_code or f"VND-{self.id:04d}",
            'name':                self.name,
            'contact_person':      self.contact_person or '',
            'phone':               self.phone or '',
            'email':               self.email or '',
            'address':             self.address or '',
            'gst_number':          self.gst_number or '',
            'pan_number':          self.pan_number or '',
            'payment_terms':       self.payment_terms or 'Net 30',
            'bank_name':           self.bank_name or '',
            'bank_account_no':     self.bank_account_no or '',
            'bank_ifsc':           self.bank_ifsc or '',
            'category':            self.category,
            'rating':              self.rating or 0,
            'notes':               self.notes or '',
            'is_active':           self.is_active,
            'total_purchases':     self.total_purchases,
            'total_paid':          self.total_paid,
            'outstanding_balance': self.outstanding_balance,
            'created_at':          self.created_at.isoformat() if self.created_at else None,
        }


# ─── 4. Inventory Management (Consumables & Supplies) ────────────────────────

class InventoryItem(db.Model):
    """
    Consumable and stock-based supplies (Notebooks, Stationery, Uniforms, Chalk, Paper).
    """
    __tablename__ = 'inventory_items'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    item_code        = db.Column(db.String(50), index=True)
    name             = db.Column(db.String(200), nullable=False)
    category         = db.Column(db.String(40), nullable=False)
    subcategory      = db.Column(db.String(60), default='')
    unit             = db.Column(db.String(30), default='PIECES')
    brand            = db.Column(db.String(100), default='')
    description      = db.Column(db.String(300), default='')

    sku              = db.Column(db.String(80))
    vendor_id        = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=True)
    vendor_name      = db.Column(db.String(150))

    quantity         = db.Column(db.Integer, nullable=False, default=0)
    unit_price       = db.Column(db.Float, nullable=False, default=0.0)
    selling_price    = db.Column(db.Float, default=0.0)
    min_stock        = db.Column(db.Integer, default=5)
    reorder_level    = db.Column(db.Integer, default=10)

    purchase_date    = db.Column(db.Date, default=date.today)
    location         = db.Column(db.String(150), default='')
    storage_location = db.Column(db.String(150), default='')
    assigned_to      = db.Column(db.String(150), default='')

    condition        = db.Column(db.String(20), default='NEW')
    status           = db.Column(db.String(20), default='ACTIVE')

    remarks          = db.Column(db.String(300), default='')
    created_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    movements        = db.relationship('StockMovement', backref='item', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        total_value = round((self.quantity or 0) * (self.unit_price or 0.0), 2)
        return {
            'id':               self.id,
            'item_code':        self.item_code or self.sku or f"ITEM-{self.id:04d}",
            'name':             self.name,
            'category':         self.category,
            'subcategory':      self.subcategory or '',
            'unit':             self.unit or 'PIECES',
            'brand':            self.brand or '',
            'description':      self.description or '',
            'sku':              self.sku or self.item_code or '',
            'vendor_id':        self.vendor_id,
            'vendor_name':      self.vendor_name or '',
            'quantity':         self.quantity or 0,
            'current_stock':    self.quantity or 0,
            'unit_price':       self.unit_price or 0.0,
            'selling_price':    self.selling_price or 0.0,
            'total_value':      total_value,
            'min_stock':        self.min_stock or 5,
            'reorder_level':    self.reorder_level or 10,
            'low_stock':        (self.quantity or 0) <= (self.min_stock or 0),
            'purchase_date':    str(self.purchase_date) if self.purchase_date else None,
            'location':         self.location or self.storage_location or '',
            'storage_location': self.storage_location or self.location or '',
            'assigned_to':      self.assigned_to or '',
            'condition':        self.condition,
            'status':           self.status,
            'remarks':          self.remarks or '',
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }


# ─── 5. Stock Movements (Full Inventory Audit Trail) ────────────────────────

class StockMovement(db.Model):
    """
    Tracks every addition, deduction, issue, adjustment, and transfer of stock.
    """
    __tablename__ = 'stock_movements'

    id                 = db.Column(db.Integer, primary_key=True)
    school_id          = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    item_id            = db.Column(db.Integer, db.ForeignKey('inventory_items.id'), nullable=False, index=True)

    movement_type      = db.Column(db.String(30), nullable=False) # PURCHASE, STOCK_IN, ISSUE, STOCK_OUT, DAMAGE, ADJUSTMENT, RETURN
    quantity           = db.Column(db.Integer, nullable=False)
    previous_stock     = db.Column(db.Integer, nullable=False)
    new_stock          = db.Column(db.Integer, nullable=False)
    unit_price         = db.Column(db.Float, default=0.0)

    movement_date      = db.Column(db.Date, default=date.today)
    reference_no       = db.Column(db.String(60), index=True)

    issued_to_user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    issued_to_name     = db.Column(db.String(150), default='')
    department         = db.Column(db.String(50), default='')
    target_class_id    = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    class_name         = db.Column(db.String(50), default='')

    reason             = db.Column(db.String(300), default='')
    performed_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                self.id,
            'item_id':           self.item_id,
            'movement_type':     self.movement_type,
            'quantity':          self.quantity,
            'previous_stock':    self.previous_stock,
            'new_stock':         self.new_stock,
            'unit_price':        self.unit_price,
            'movement_date':     str(self.movement_date) if self.movement_date else None,
            'reference_no':      self.reference_no or '',
            'issued_to_user_id': self.issued_to_user_id,
            'issued_to_name':    self.issued_to_name or '',
            'department':        self.department or '',
            'target_class_id':   self.target_class_id,
            'class_name':        self.class_name or '',
            'reason':            self.reason or '',
            'performed_by':      self.performed_by,
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


# ─── 6. Purchase Orders & Procurement Flow ──────────────────────────────────

class PurchaseOrder(db.Model):
    """
    Formal Purchase Orders raised with vendors.
    """
    __tablename__ = 'purchase_orders'

    id                     = db.Column(db.Integer, primary_key=True)
    school_id              = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    po_number              = db.Column(db.String(40), unique=True, index=True, nullable=False)

    vendor_id              = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=False, index=True)
    order_date             = db.Column(db.Date, default=date.today)
    expected_delivery_date = db.Column(db.Date, nullable=True)

    status                 = db.Column(db.String(30), default='PENDING_APPROVAL') # DRAFT, PENDING_APPROVAL, APPROVED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED
    target_type            = db.Column(db.String(30), default='INVENTORY') # INVENTORY, ASSET, MIXED

    subtotal               = db.Column(db.Float, default=0.0)
    tax_amount             = db.Column(db.Float, default=0.0)
    discount_amount        = db.Column(db.Float, default=0.0)
    total_amount           = db.Column(db.Float, default=0.0)

    notes                  = db.Column(db.String(500), default='')
    created_by             = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_by            = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at            = db.Column(db.DateTime, nullable=True)
    created_at             = db.Column(db.DateTime, default=datetime.utcnow)

    items                  = db.relationship('PurchaseOrderItem', backref='order', lazy='dynamic', cascade='all, delete-orphan')
    receipts               = db.relationship('GoodsReceiptNote', backref='order', lazy='dynamic')
    bills                  = db.relationship('VendorBill', backref='order', lazy='dynamic')

    def to_dict(self):
        return {
            'id':                     self.id,
            'po_number':              self.po_number,
            'vendor_id':              self.vendor_id,
            'vendor_name':            self.vendor.name if self.vendor else '',
            'order_date':             str(self.order_date) if self.order_date else None,
            'expected_delivery_date': str(self.expected_delivery_date) if self.expected_delivery_date else None,
            'status':                 self.status,
            'target_type':            self.target_type,
            'subtotal':               self.subtotal,
            'tax_amount':             self.tax_amount,
            'discount_amount':        self.discount_amount,
            'total_amount':           self.total_amount,
            'notes':                  self.notes or '',
            'created_by':             self.created_by,
            'approved_by':            self.approved_by,
            'approved_at':            self.approved_at.isoformat() if self.approved_at else None,
            'items':                  [i.to_dict() for i in self.items],
            'created_at':             self.created_at.isoformat() if self.created_at else None,
        }


class PurchaseOrderItem(db.Model):
    __tablename__ = 'purchase_order_items'

    id                = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False, index=True)

    item_name         = db.Column(db.String(200), nullable=False)
    category          = db.Column(db.String(40), default='OTHER')
    sku               = db.Column(db.String(80), default='')
    unit              = db.Column(db.String(30), default='PIECES')

    ordered_qty       = db.Column(db.Integer, nullable=False, default=1)
    received_qty      = db.Column(db.Integer, default=0)
    unit_price        = db.Column(db.Float, nullable=False, default=0.0)
    tax_pct           = db.Column(db.Float, default=0.0)
    total_price       = db.Column(db.Float, nullable=False, default=0.0)

    is_asset          = db.Column(db.Boolean, default=False) # True -> creates individual SchoolAsset records

    def to_dict(self):
        return {
            'id':                self.id,
            'purchase_order_id': self.purchase_order_id,
            'item_name':         self.item_name,
            'category':          self.category,
            'sku':               self.sku or '',
            'unit':              self.unit or 'PIECES',
            'ordered_qty':       self.ordered_qty,
            'received_qty':      self.received_qty or 0,
            'unit_price':        self.unit_price,
            'tax_pct':           self.tax_pct or 0.0,
            'total_price':       self.total_price,
            'is_asset':          self.is_asset,
        }


# ─── 7. Goods Receipt Notes (GRN) ───────────────────────────────────────────

class GoodsReceiptNote(db.Model):
    """
    Records arrival of goods against a Purchase Order.
    Only verified received quantities enter stock or asset registry.
    """
    __tablename__ = 'goods_receipt_notes'

    id                = db.Column(db.Integer, primary_key=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    grn_number        = db.Column(db.String(40), unique=True, index=True, nullable=False)

    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False, index=True)
    vendor_id         = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=False, index=True)

    receipt_date      = db.Column(db.Date, default=date.today)
    challan_no        = db.Column(db.String(80), default='')
    status            = db.Column(db.String(30), default='VERIFIED')

    received_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes             = db.Column(db.String(500), default='')
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    items             = db.relationship('GoodsReceiptItem', backref='receipt', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':                self.id,
            'grn_number':        self.grn_number,
            'purchase_order_id': self.purchase_order_id,
            'vendor_id':         self.vendor_id,
            'receipt_date':      str(self.receipt_date) if self.receipt_date else None,
            'challan_no':        self.challan_no or '',
            'status':            self.status,
            'received_by':       self.received_by,
            'notes':             self.notes or '',
            'items':             [i.to_dict() for i in self.items],
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class GoodsReceiptItem(db.Model):
    __tablename__ = 'goods_receipt_items'

    id               = db.Column(db.Integer, primary_key=True)
    grn_id           = db.Column(db.Integer, db.ForeignKey('goods_receipt_notes.id'), nullable=False, index=True)
    po_item_id       = db.Column(db.Integer, db.ForeignKey('purchase_order_items.id'), nullable=True)
    item_id          = db.Column(db.Integer, db.ForeignKey('inventory_items.id'), nullable=True)

    item_name        = db.Column(db.String(200), nullable=False)
    ordered_qty      = db.Column(db.Integer, nullable=False, default=1)
    received_qty     = db.Column(db.Integer, nullable=False, default=1)
    rejected_qty     = db.Column(db.Integer, default=0)
    unit_price       = db.Column(db.Float, default=0.0)
    rejection_reason = db.Column(db.String(300), default='')

    def to_dict(self):
        return {
            'id':               self.id,
            'grn_id':           self.grn_id,
            'po_item_id':       self.po_item_id,
            'item_id':          self.item_id,
            'item_name':        self.item_name,
            'ordered_qty':      self.ordered_qty,
            'received_qty':     self.received_qty,
            'rejected_qty':     self.rejected_qty or 0,
            'unit_price':       self.unit_price or 0.0,
            'rejection_reason': self.rejection_reason or '',
        }


# ─── 8. Vendor Bills & Payments ─────────────────────────────────────────────

class VendorBill(db.Model):
    """
    Invoices received from vendors for goods received.
    """
    __tablename__ = 'vendor_bills'

    id                = db.Column(db.Integer, primary_key=True)
    school_id         = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    bill_number       = db.Column(db.String(50), unique=True, index=True, nullable=False)

    vendor_id         = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=False, index=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=True)
    grn_id            = db.Column(db.Integer, db.ForeignKey('goods_receipt_notes.id'), nullable=True)

    bill_date         = db.Column(db.Date, default=date.today)
    due_date          = db.Column(db.Date, nullable=True)

    subtotal          = db.Column(db.Float, default=0.0)
    tax_amount        = db.Column(db.Float, default=0.0)
    total_amount      = db.Column(db.Float, nullable=False, default=0.0)
    paid_amount       = db.Column(db.Float, default=0.0)
    balance_amount    = db.Column(db.Float, default=0.0)

    status            = db.Column(db.String(30), default='PENDING') # PENDING, PARTIAL, PAID, VOID
    invoice_file_url  = db.Column(db.String(500), nullable=True)
    notes             = db.Column(db.String(300), default='')

    created_by        = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at        = db.Column(db.DateTime, default=datetime.utcnow)

    payments          = db.relationship('VendorPayment', backref='bill', lazy='dynamic')

    def to_dict(self):
        return {
            'id':                self.id,
            'bill_number':       self.bill_number,
            'vendor_id':         self.vendor_id,
            'vendor_name':       self.vendor.name if self.vendor else '',
            'purchase_order_id': self.purchase_order_id,
            'grn_id':            self.grn_id,
            'bill_date':         str(self.bill_date) if self.bill_date else None,
            'due_date':          str(self.due_date) if self.due_date else None,
            'subtotal':          self.subtotal,
            'tax_amount':        self.tax_amount,
            'total_amount':      self.total_amount,
            'paid_amount':       self.paid_amount or 0.0,
            'balance_amount':    round(self.total_amount - (self.paid_amount or 0.0), 2),
            'status':            self.status,
            'invoice_file_url':  self.invoice_file_url or None,
            'notes':             self.notes or '',
            'created_at':        self.created_at.isoformat() if self.created_at else None,
        }


class VendorPayment(db.Model):
    """
    Payments made to vendors against specific bills.
    """
    __tablename__ = 'vendor_payments'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    payment_number = db.Column(db.String(50), unique=True, index=True, nullable=False)

    vendor_id      = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=False, index=True)
    vendor_bill_id = db.Column(db.Integer, db.ForeignKey('vendor_bills.id'), nullable=True, index=True)

    amount         = db.Column(db.Float, nullable=False)
    payment_date   = db.Column(db.Date, default=date.today)
    payment_mode   = db.Column(db.String(30), default='BANK_TRANSFER')
    reference_no   = db.Column(db.String(80), default='')

    paid_by        = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes          = db.Column(db.String(300), default='')
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'payment_number': self.payment_number,
            'vendor_id':      self.vendor_id,
            'vendor_name':    self.vendor.name if self.vendor else '',
            'vendor_bill_id': self.vendor_bill_id,
            'amount':         self.amount,
            'payment_date':   str(self.payment_date) if self.payment_date else None,
            'payment_mode':   self.payment_mode,
            'reference_no':   self.reference_no or '',
            'paid_by':        self.paid_by,
            'notes':          self.notes or '',
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }


# ─── 9. School Asset Management (Capital Property & Equipment) ───────────────

class SchoolAsset(db.Model):
    """
    Long-term school assets tracked by unique Tag ID & Serial Number (Laptops, Projectors, Benches).
    """
    __tablename__ = 'school_assets'

    id                  = db.Column(db.Integer, primary_key=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    asset_tag           = db.Column(db.String(50), unique=True, index=True, nullable=False) # e.g. AST-LAP-001
    name                = db.Column(db.String(200), nullable=False)
    category            = db.Column(db.String(50), nullable=False)
    serial_number       = db.Column(db.String(100), default='')
    model_number        = db.Column(db.String(100), default='')
    brand               = db.Column(db.String(100), default='')

    purchase_date       = db.Column(db.Date, default=date.today)
    purchase_cost       = db.Column(db.Float, default=0.0)
    vendor_id           = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=True)
    vendor_name         = db.Column(db.String(150), default='')
    invoice_no          = db.Column(db.String(80), default='')

    warranty_start      = db.Column(db.Date, nullable=True)
    warranty_end        = db.Column(db.Date, nullable=True)

    location            = db.Column(db.String(150), default='Main Campus')
    department          = db.Column(db.String(50), default='ADMIN')

    assigned_to_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    assigned_to_name    = db.Column(db.String(150), default='')
    assigned_date       = db.Column(db.Date, nullable=True)

    condition           = db.Column(db.String(30), default='NEW')
    status              = db.Column(db.String(30), default='AVAILABLE')

    disposal_date       = db.Column(db.Date, nullable=True)
    disposal_reason     = db.Column(db.String(300), nullable=True)
    disposal_method     = db.Column(db.String(60), nullable=True)
    disposal_amount     = db.Column(db.Float, default=0.0)

    notes               = db.Column(db.String(500), default='')
    created_by          = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    assignments         = db.relationship('AssetAssignmentHistory', backref='asset', lazy='dynamic', cascade='all, delete-orphan')
    condition_logs      = db.relationship('AssetConditionLog', backref='asset', lazy='dynamic', cascade='all, delete-orphan')
    maintenance_records = db.relationship('AssetMaintenanceRecord', backref='asset', lazy='dynamic', cascade='all, delete-orphan')

    @property
    def total_maintenance_cost(self):
        return sum(m.cost for m in self.maintenance_records if m.cost)

    @property
    def is_warranty_expiring_soon(self):
        if not self.warranty_end:
            return False
        delta = (self.warranty_end - date.today()).days
        return 0 <= delta <= 45

    def to_dict(self):
        return {
            'id':                       self.id,
            'asset_tag':                self.asset_tag,
            'name':                     self.name,
            'category':                 self.category,
            'serial_number':            self.serial_number or '',
            'model_number':             self.model_number or '',
            'brand':                    self.brand or '',
            'purchase_date':            str(self.purchase_date) if self.purchase_date else None,
            'purchase_cost':            self.purchase_cost or 0.0,
            'vendor_id':                self.vendor_id,
            'vendor_name':              self.vendor_name or '',
            'invoice_no':               self.invoice_no or '',
            'warranty_start':           str(self.warranty_start) if self.warranty_start else None,
            'warranty_end':             str(self.warranty_end) if self.warranty_end else None,
            'is_warranty_expiring':     self.is_warranty_expiring_soon,
            'location':                 self.location or '',
            'department':               self.department or '',
            'assigned_to_user_id':      self.assigned_to_user_id,
            'assigned_to_name':         self.assigned_to_name or '',
            'assigned_date':            str(self.assigned_date) if self.assigned_date else None,
            'condition':                self.condition,
            'status':                   self.status,
            'disposal_date':            str(self.disposal_date) if self.disposal_date else None,
            'disposal_reason':          self.disposal_reason or '',
            'disposal_method':          self.disposal_method or '',
            'disposal_amount':          self.disposal_amount or 0.0,
            'total_maintenance_cost':   self.total_maintenance_cost,
            'notes':                    self.notes or '',
            'created_at':               self.created_at.isoformat() if self.created_at else None,
        }


class AssetAssignmentHistory(db.Model):
    __tablename__ = 'asset_assignment_history'

    id             = db.Column(db.Integer, primary_key=True)
    asset_id       = db.Column(db.Integer, db.ForeignKey('school_assets.id'), nullable=False, index=True)

    from_user_id   = db.Column(db.Integer, nullable=True)
    from_user_name = db.Column(db.String(150), default='')
    to_user_id     = db.Column(db.Integer, nullable=True)
    to_user_name   = db.Column(db.String(150), default='')

    from_location  = db.Column(db.String(150), default='')
    to_location    = db.Column(db.String(150), default='')

    transfer_date  = db.Column(db.Date, default=date.today)
    transferred_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    reason         = db.Column(db.String(300), default='')
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'asset_id':       self.asset_id,
            'from_user_name': self.from_user_name or 'Unassigned',
            'to_user_name':   self.to_user_name or 'Unassigned',
            'from_location':  self.from_location or '',
            'to_location':    self.to_location or '',
            'transfer_date':  str(self.transfer_date) if self.transfer_date else None,
            'reason':         self.reason or '',
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }


class AssetConditionLog(db.Model):
    __tablename__ = 'asset_condition_logs'

    id                 = db.Column(db.Integer, primary_key=True)
    asset_id           = db.Column(db.Integer, db.ForeignKey('school_assets.id'), nullable=False, index=True)

    previous_condition = db.Column(db.String(30))
    new_condition      = db.Column(db.String(30), nullable=False)

    inspected_date     = db.Column(db.Date, default=date.today)
    inspected_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    notes              = db.Column(db.String(300), default='')
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                 self.id,
            'asset_id':           self.asset_id,
            'previous_condition': self.previous_condition,
            'new_condition':      self.new_condition,
            'inspected_date':     str(self.inspected_date) if self.inspected_date else None,
            'notes':              self.notes or '',
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


class AssetMaintenanceRecord(db.Model):
    """
    Asset maintenance records automatically post to Finance Expenses!
    """
    __tablename__ = 'asset_maintenance_records'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    asset_id         = db.Column(db.Integer, db.ForeignKey('school_assets.id'), nullable=False, index=True)

    maintenance_date = db.Column(db.Date, default=date.today)
    title            = db.Column(db.String(200), nullable=False)
    description      = db.Column(db.String(500), default='')

    vendor_id        = db.Column(db.Integer, db.ForeignKey('vendors.id'), nullable=True)
    vendor_name      = db.Column(db.String(150), default='')
    cost             = db.Column(db.Float, default=0.0)

    performed_by     = db.Column(db.String(150), default='')
    status           = db.Column(db.String(30), default='COMPLETED')

    expense_id       = db.Column(db.Integer, db.ForeignKey('expenses.id'), nullable=True)
    created_by       = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'asset_id':         self.asset_id,
            'maintenance_date': str(self.maintenance_date) if self.maintenance_date else None,
            'title':            self.title,
            'description':      self.description or '',
            'vendor_name':      self.vendor_name or '',
            'cost':             self.cost or 0.0,
            'performed_by':     self.performed_by or '',
            'status':           self.status,
            'expense_id':       self.expense_id,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }
