from app import db
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════════
#  PRODUCT REGISTRY
# ═══════════════════════════════════════════════════════════════════════════
# OnePlatform360 ek single company ke multiple products hoste hain — abhi
# sirf School Management (EduERP) live hai, future me Inventory/HRM/Hospital
# add honge. Ye table CEO/Super Admin portal ka product-switcher isi se
# populate hoga. Naya product add karna = ek row insert karna, koi schema
# change nahi (RBAC/Audit/Error tables product_id se isko reference karenge).

PRODUCT_STATUSES = ['ACTIVE', 'COMING_SOON', 'DISABLED']


class Product(db.Model):
    __tablename__ = 'products'

    id          = db.Column(db.Integer, primary_key=True)

    # Stable machine key — code me isi se refer karo, naam badal sakta hai
    # (e.g. 'SCHOOL_ERP', 'INVENTORY', 'HRM', 'HOSPITAL')
    key         = db.Column(db.String(40), unique=True, nullable=False, index=True)

    name        = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    icon        = db.Column(db.String(60), nullable=True)   # Tabler icon name, e.g. 'ti-school'

    status      = db.Column(db.String(20), default='COMING_SOON', nullable=False)

    # Frontend route jaha ye product khulta hai, e.g. '/school' — product
    # switcher card click hone par isi path pe navigate karega.
    base_url    = db.Column(db.String(200), nullable=True)

    sort_order  = db.Column(db.Integer, default=0)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'key':         self.key,
            'name':        self.name,
            'description': self.description,
            'icon':        self.icon,
            'status':      self.status,
            'base_url':    self.base_url,
            'sort_order':  self.sort_order,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  SEED DEFAULTS
# ═══════════════════════════════════════════════════════════════════════════
# Idempotent — app boot pe har baar chalta hai (jaise permissions.py ka
# seed_default_permissions_all_schools()), sirf missing keys insert karta hai.

DEFAULT_PRODUCTS = [
    {'key': 'SCHOOL_ERP', 'name': 'School Management', 'description': 'EduERP — schools, students, fees, hostel, exams',
     'icon': 'ti-school',     'status': 'ACTIVE',      'base_url': '/school',    'sort_order': 1},
    {'key': 'INVENTORY',  'name': 'Inventory',          'description': 'Stock, purchase orders, warehouses',
     'icon': 'ti-boxes',      'status': 'COMING_SOON', 'base_url': '/inventory', 'sort_order': 2},
    {'key': 'HRM',        'name': 'HRM',                'description': 'Payroll, attendance, recruitment',
     'icon': 'ti-users',      'status': 'COMING_SOON', 'base_url': '/hrm',       'sort_order': 3},
    {'key': 'HOSPITAL',   'name': 'Hospital',           'description': 'Patients, appointments, billing',
     'icon': 'ti-stethoscope','status': 'COMING_SOON', 'base_url': '/hospital',  'sort_order': 4},
]


def seed_default_products():
    """
    Safe to call on every app startup. Only inserts products that don't
    already exist by key — never overwrites a manually-edited status/name.
    """
    existing_keys = {p.key for p in Product.query.all()}

    created = 0
    for item in DEFAULT_PRODUCTS:
        if item['key'] in existing_keys:
            continue
        db.session.add(Product(**item))
        created += 1

    if created:
        db.session.commit()
    return created
