from app import db
from datetime import date, datetime

# ─── Constants ──────────────────────────────────────────────────────────────
# Frontend dropdown isi list se banega. Naya category add karna ho to bas
# yahan add karo — DB schema change nahi karna padega (plain string column hai).

EXPENSE_CATEGORIES = [
    'TEACHER_SALARY',
    'STAFF_SALARY',
    'ELECTRICITY',
    'WATER',
    'INTERNET',
    'RENT',
    'MAINTENANCE',
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
    'INVENTORY_PURCHASE',   # Inventory page se auto-generate hoga
    'MISCELLANEOUS',
]

PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD']

# source field batata hai expense kahan se aayi — isse hum kabhi bhi
# "sirf manual entries dikhao" ya "sirf inventory se aayi expenses dikhao"
# jaisa filter laga sakte hain, aur double-linking bhi trace kar sakte hain.
EXPENSE_SOURCES = ['MANUAL', 'INVENTORY_AUTO', 'SALARY_AUTO']

INVENTORY_CATEGORIES = [
    'STATIONERY', 'FURNITURE', 'COMPUTERS', 'PROJECTORS', 'PRINTERS',
    'SMART_BOARDS', 'SPORTS', 'SCIENCE_LAB', 'LIBRARY_ASSETS',
    'ELECTRICAL', 'CLEANING_SUPPLIES', 'BUS_SPARE_PARTS', 'OTHER',
]

ITEM_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'DAMAGED']
ITEM_STATUSES   = ['ACTIVE', 'DAMAGED', 'SCRAPPED']

VENDOR_CATEGORIES = [
    'STATIONERY', 'COMPUTERS', 'FURNITURE', 'MAINTENANCE', 'TRANSPORT',
    'BOOKS_LIBRARY', 'SPORTS', 'ELECTRICAL', 'CLEANING', 'OTHER',
]

STAFF_SALARY_STATUSES = ['PAID', 'PENDING']


class StaffSalaryRecord(db.Model):
    """
    Non-teaching staff (Accountant, Librarian, Receptionist, Hostel, Transport, HR, Vice Principal)
    salary payments. Teacher salary continues to use the existing SalaryRecord table —
    this is a separate table because staff are User rows, not Teacher rows.
    Same auto-Expense-linking pattern as Teacher SalaryRecord.
    """
    __tablename__ = 'staff_salary_records'

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    month         = db.Column(db.String(20))
    amount        = db.Column(db.Float, nullable=False)
    status        = db.Column(db.String(20), default='PAID')
    payment_date  = db.Column(db.Date, default=date.today)
    note          = db.Column(db.String(300), default='')

    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    # NEW — lets the staff member confirm "yes, I received this payment"
    # from their own dashboard. Same pattern as SalaryRecord (teachers).
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


class Expense(db.Model):
    """
    Har rupaya jo school kharch karta hai — isi table se Profit & Loss,
    Cash Flow aur Expense Analytics charts feed honge.
    """
    __tablename__ = 'expenses'

    id             = db.Column(db.Integer, primary_key=True)
    school_id      = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    category       = db.Column(db.String(40), nullable=False)
    title          = db.Column(db.String(200), nullable=False)     # e.g. "July Electricity Bill"
    vendor_name    = db.Column(db.String(150))                     # free text — full Vendor model baad mein

    amount         = db.Column(db.Float, nullable=False)

    invoice_number = db.Column(db.String(80))
    bill_url       = db.Column(db.String(500))                     # Cloudinary — bill/invoice photo

    payment_method = db.Column(db.String(20), default='CASH')
    payment_date   = db.Column(db.Date, default=date.today)
    month          = db.Column(db.String(20), index=True)          # "July 2026" — auto-set from payment_date
    status         = db.Column(db.String(20), default='PAID')      # PAID / PENDING

    source         = db.Column(db.String(20), default='MANUAL', index=True)
    source_ref_id  = db.Column(db.Integer)   # SalaryRecord.id ya InventoryItem.id jisne ye expense banayi (agar auto)

    remarks        = db.Column(db.String(300), default='')
    created_by     = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'category':       self.category,
            'title':          self.title,
            'vendor_name':    self.vendor_name or '',
            'amount':         self.amount,
            'invoice_number': self.invoice_number or '',
            'bill_url':       self.bill_url or None,
            'payment_method': self.payment_method,
            'payment_date':   str(self.payment_date) if self.payment_date else None,
            'month':          self.month,
            'status':         self.status,
            'source':         self.source,
            'source_ref_id':  self.source_ref_id,
            'remarks':        self.remarks or '',
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }

class Vendor(db.Model):
    """
    Vendor master data. Expense aur InventoryItem abhi bhi free-text vendor_name
    use karte hain (koi FK migration risk nahi) — ye table sirf vendor ki
    GST/PAN/contact details aur purchase history ke liye 'source of truth' hai.
    Matching vendor_name (case-insensitive) se purchase history nikalti hai.
    """
    __tablename__ = 'vendors'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name          = db.Column(db.String(150), nullable=False)
    contact_person= db.Column(db.String(120), default='')
    phone         = db.Column(db.String(20), default='')
    email         = db.Column(db.String(120), default='')
    address       = db.Column(db.String(300), default='')

    gst_number    = db.Column(db.String(20), default='')
    pan_number    = db.Column(db.String(15), default='')

    category      = db.Column(db.String(40), default='OTHER')   # e.g. STATIONERY, COMPUTERS, MAINTENANCE
    rating        = db.Column(db.Integer, default=0)             # 0-5, principal manually set kar sakta hai
    notes         = db.Column(db.String(300), default='')

    is_active     = db.Column(db.Boolean, default=True)
    created_by    = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':             self.id,
            'name':           self.name,
            'contact_person': self.contact_person or '',
            'phone':          self.phone or '',
            'email':          self.email or '',
            'address':        self.address or '',
            'gst_number':     self.gst_number or '',
            'pan_number':     self.pan_number or '',
            'category':       self.category,
            'rating':         self.rating or 0,
            'notes':          self.notes or '',
            'is_active':      self.is_active,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
        }
class InventoryItem(db.Model):
    """
    School assets aur consumables. Har naya item purchase Expense mein
    khud-ba-khud add ho jaata hai (category=INVENTORY_PURCHASE, source=INVENTORY_AUTO)
    — isiliye Inventory aur Finance hamesha sync mein rehte hain, koi manual double-entry nahi.
    """
    __tablename__ = 'inventory_items'

    id           = db.Column(db.Integer, primary_key=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)

    name         = db.Column(db.String(200), nullable=False)   # user khud type karta hai
    category     = db.Column(db.String(40), nullable=False)
    sku          = db.Column(db.String(80))                    # optional — user khud type kare
    vendor_name  = db.Column(db.String(150))

    quantity     = db.Column(db.Integer, nullable=False, default=1)
    unit_price   = db.Column(db.Float, nullable=False, default=0)
    min_stock    = db.Column(db.Integer, default=5)             # is se neeche jaye to low-stock alert

    purchase_date= db.Column(db.Date, default=date.today)
    location     = db.Column(db.String(150), default='')        # e.g. "Computer Lab"
    assigned_to  = db.Column(db.String(150), default='')        # e.g. "Class 8-A" / teacher name

    condition    = db.Column(db.String(20), default='NEW')
    status       = db.Column(db.String(20), default='ACTIVE')   # ACTIVE / DAMAGED / SCRAPPED

    remarks      = db.Column(db.String(300), default='')
    created_by   = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        total_value = round((self.quantity or 0) * (self.unit_price or 0), 2)
        return {
            'id':            self.id,
            'name':          self.name,
            'category':      self.category,
            'sku':           self.sku or '',
            'vendor_name':   self.vendor_name or '',
            'quantity':      self.quantity,
            'unit_price':    self.unit_price,
            'total_value':   total_value,
            'min_stock':     self.min_stock,
            'low_stock':     (self.quantity or 0) <= (self.min_stock or 0),
            'purchase_date': str(self.purchase_date) if self.purchase_date else None,
            'location':      self.location or '',
            'assigned_to':   self.assigned_to or '',
            'condition':     self.condition,
            'status':        self.status,
            'remarks':       self.remarks or '',
            'created_at':    self.created_at.isoformat() if self.created_at else None,
        }
            
        
