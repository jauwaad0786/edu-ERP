from app import db
from datetime import datetime


class UserDevice(db.Model):
    """
    Device token registration model for push notification delivery.
    Supports Web, PWA, Android, and iOS devices.
    """
    __tablename__ = 'user_devices'

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    school_id    = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=True, index=True)
    device_token = db.Column(db.String(500), nullable=False)
    platform     = db.Column(db.String(30), default='web', nullable=False)  # 'web' | 'pwa' | 'android' | 'ios'
    is_active    = db.Column(db.Boolean, default=True, nullable=False, index=True)
    last_seen    = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at   = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('user_id', 'device_token', name='uq_user_device_token'),
    )

    user   = db.relationship('User', foreign_keys=[user_id], backref='devices', lazy='joined')
    school = db.relationship('School', foreign_keys=[school_id], backref='registered_devices', lazy='joined')

    def to_dict(self):
        return {
            'id':           self.id,
            'user_id':      self.user_id,
            'school_id':    self.school_id,
            'device_token': self.device_token,
            'platform':     self.platform,
            'is_active':    self.is_active,
            'last_seen':    self.last_seen.isoformat() if self.last_seen else None,
            'created_at':   self.created_at.isoformat() if self.created_at else None,
            'updated_at':   self.updated_at.isoformat() if self.updated_at else None,
        }
