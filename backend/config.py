import os
import secrets
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or secrets.token_hex(32)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=9)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///eduErp.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,   # test connection before using it; reconnect if dead
        'pool_recycle': 280,     # recycle connections before Neon's idle timeout kicks in
        'pool_size': 3,          # keep base connections low for Render 512MB RAM
        'max_overflow': 2,       # cap max burst connections to 5 total per process
        'pool_timeout': 20,      # fail fast if connection cannot be acquired
    } if not (os.environ.get('DATABASE_URL', 'sqlite:///eduErp.db')).startswith('sqlite') else {}
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads/')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload

    # MSG91 Communication Configuration
    MSG91_AUTH_KEY = os.environ.get('MSG91_AUTH_KEY')
    MSG91_OTP_TEMPLATE_ID = os.environ.get('MSG91_OTP_TEMPLATE_ID')
    MSG91_SMS_FLOW_ID = os.environ.get('MSG91_SMS_FLOW_ID')
    MSG91_SENDER_ID = os.environ.get('MSG91_SENDER_ID')
    MSG91_EMAIL_DOMAIN = os.environ.get('MSG91_EMAIL_DOMAIN')
    MSG91_EMAIL_FROM_EMAIL = os.environ.get('MSG91_EMAIL_FROM_EMAIL')
    MSG91_EMAIL_FROM_NAME = os.environ.get('MSG91_EMAIL_FROM_NAME', 'Edu ERP')
    MSG91_EMAIL_TEMPLATE_ID = os.environ.get('MSG91_EMAIL_TEMPLATE_ID')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    try:
        from sqlalchemy.pool import StaticPool
        SQLALCHEMY_ENGINE_OPTIONS = {
            'poolclass': StaticPool,
            'connect_args': {'check_same_thread': False},
        }
    except Exception:
        SQLALCHEMY_ENGINE_OPTIONS = {}

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
