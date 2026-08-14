# backend/app/models/leads.py
"""
Website Leads — company ke public marketing site (OmniSphere 365) se aane
wale Demo Request aur Contact form submissions yahan store hote hain.
Developer Error Center (developer_center.py) ke exact wahi "company-side
only" pattern follow karta hai — is table ka koi school_id/product_id nahi
hota, kyunki yeh leads kisi bhi tenant se pehle, sales-funnel ke top pe
aate hain.
"""

from app import db
from datetime import datetime

LEAD_TYPES = ['DEMO', 'CONTACT']
LEAD_STATUSES = ['NEW', 'CONTACTED', 'CLOSED']


class WebsiteLead(db.Model):
    __tablename__ = 'website_leads'

    id            = db.Column(db.Integer, primary_key=True)

    lead_type     = db.Column(db.String(10), nullable=False, default='DEMO', index=True)  # DEMO | CONTACT
    source        = db.Column(db.String(50), nullable=False, default='omnisphere365')     # jis website se aaya

    name          = db.Column(db.String(120), nullable=False)
    company       = db.Column(db.String(150), nullable=True)
    email         = db.Column(db.String(120), nullable=False)
    phone         = db.Column(db.String(30), nullable=True)
    city          = db.Column(db.String(80), nullable=True)
    service       = db.Column(db.String(80), nullable=True)   # interested service/module
    org_size      = db.Column(db.String(30), nullable=True)   # students/employees range (demo form only)
    message       = db.Column(db.Text, nullable=True)

    status        = db.Column(db.String(15), nullable=False, default='NEW', index=True)

    ip_address    = db.Column(db.String(45), nullable=True)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id':          self.id,
            'lead_type':   self.lead_type,
            'source':      self.source,
            'name':        self.name,
            'company':     self.company or '',
            'email':       self.email,
            'phone':       self.phone or '',
            'city':        self.city or '',
            'service':     self.service or '',
            'org_size':    self.org_size or '',
            'message':     self.message or '',
            'status':      self.status,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }
