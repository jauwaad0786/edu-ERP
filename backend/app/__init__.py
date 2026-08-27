from flask import Flask, request
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os
from dotenv import load_dotenv
import cloudinary


cloudinary.config(
    cloud_name = os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key    = os.environ.get('CLOUDINARY_API_KEY'),
    api_secret = os.environ.get('CLOUDINARY_API_SECRET'),
)

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()
migrate = Migrate()
load_dotenv()
limiter = Limiter(get_remote_address)


def create_app(config_name='default'):
    app = Flask(__name__)

    from config import config
    app.config.from_object(config[config_name])
    print("DB URI:", app.config['SQLALCHEMY_DATABASE_URI'])

    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    _extra_origins = [o.strip() for o in os.environ.get('EXTRA_CORS_ORIGINS', '').split(',') if o.strip()]

    CORS(app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        expose_headers=["Content-Type", "Authorization"],
        max_age=3600,
    )

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
        return response

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.admin import admin_bp
    from app.routes.principal import principal_bp, teacher_bp as teacher_self_bp
    from app.routes.teacher import teacher_bp
    from app.routes.student import student_bp
    from app.routes.marks import marks_bp
    from app.routes.result_management import result_bp
    from app.models import communication
    from app.middleware.audit_middleware import register_audit_middleware
    register_audit_middleware(app)
    from app.middleware.error_middleware import register_error_middleware
    register_error_middleware(app)
    from app.routes.communication.tickets       import tickets_bp
    from app.routes.communication.notifications import notifications_bp
    from app.routes.communication.meetings      import meetings_bp
    from app.routes.communication.announcements import announcements_bp
    from app.routes.communication.chat          import chat_bp
    from app.routes.communication.support_plans import support_plans_bp
    app.register_blueprint(support_plans_bp, url_prefix='/api/support/plans')
    from app.routes.communication.knowledge_base import knowledge_base_bp
    app.register_blueprint(knowledge_base_bp, url_prefix='/api/support/kb')
    from app.routes.finance import finance_bp
    app.register_blueprint(finance_bp, url_prefix='/api/finance')
    
    from app.routes.library import library_bp
    app.register_blueprint(library_bp, url_prefix='/api/library')
    from app.routes.hostel import hostel_bp
    app.register_blueprint(hostel_bp, url_prefix='/api/hostel')

    from app.routes.transport import transport_bp
    app.register_blueprint(transport_bp)   # url_prefix already baked in ('/api/transport')
    from app.routes.transport_student import transport_student_bp
    app.register_blueprint(transport_student_bp, url_prefix='/api/transport')
    from app.routes.transport_gps import transport_gps_bp
    app.register_blueprint(transport_gps_bp, url_prefix='/api/transport')
    from app.routes.transport_reports import transport_reports_bp
    app.register_blueprint(transport_reports_bp, url_prefix='/api/transport')

    from app.routes.rbac import rbac_bp
    app.register_blueprint(rbac_bp, url_prefix='/api/rbac')
    from app.routes.developer_center import developer_center_bp
    app.register_blueprint(developer_center_bp, url_prefix='/api/developer')
    from app.routes.leads import leads_bp
    app.register_blueprint(leads_bp, url_prefix='/api')
    from app.routes.audit import audit_bp
    app.register_blueprint(audit_bp, url_prefix='/api/audit')

    from app.routes.staff_attendance import staff_attendance_bp
    app.register_blueprint(staff_attendance_bp, url_prefix='/api/staff-attendance')

    from app.routes.whatsapp_settings import whatsapp_settings_bp
    app.register_blueprint(whatsapp_settings_bp, url_prefix='/api/principal/whatsapp')

    from app.routes.whatsapp_webhook import webhook_bp
    app.register_blueprint(webhook_bp, url_prefix='/api/webhooks')
    app.register_blueprint(tickets_bp,       url_prefix='/api/support/tickets')
    app.register_blueprint(notifications_bp, url_prefix='/api/support/notifications')
    app.register_blueprint(meetings_bp,      url_prefix='/api/support/meetings')
    app.register_blueprint(announcements_bp, url_prefix='/api/support/announcements')
    app.register_blueprint(chat_bp,          url_prefix='/api/support/chat')
    
    app.register_blueprint(marks_bp,        url_prefix='/api/marks')
    app.register_blueprint(result_bp,       url_prefix='/api/results')
    app.register_blueprint(auth_bp,         url_prefix='/api/auth')
    app.register_blueprint(admin_bp,        url_prefix='/api/admin')
    app.register_blueprint(principal_bp,    url_prefix='/api/principal')
    app.register_blueprint(teacher_bp,      url_prefix='/api/teacher')
    app.register_blueprint(teacher_self_bp, url_prefix='/api/teacher')
    app.register_blueprint(student_bp,      url_prefix='/api/student')

    # ── Startup sequence (ORDER IS CRITICAL on PostgreSQL) ──────────────────
    with app.app_context():
        try:
            _ensure_school_columns()
            _ensure_user_columns()
            _ensure_teacher_columns()
            _ensure_student_columns()
            _ensure_communication_columns()
            _ensure_fee_record_columns()
            _ensure_salary_acknowledgement_columns()
            _ensure_marks_columns()
            _ensure_exam_columns()
            db.create_all()
            _seed_super_admin()
        except Exception as e:
            app.logger.error(f'Startup schema initialization error: {e}')

        # ── RBAC: seed default role-permissions for all schools on boot ──
        try:
            from app.models.permissions import seed_default_permissions_all_schools
            seed_default_permissions_all_schools()
        except Exception as e:
            app.logger.warning(f'Permission seed skipped: {e}')

        try:
            from app.models.platform import seed_default_products
            seed_default_products()
        except Exception as e:
            app.logger.warning(f'Product seed skipped: {e}')

        try:
            from app.models.rbac import seed_default_roles
            seed_default_roles()
        except Exception as e:
            app.logger.warning(f'Role seed skipped: {e}')

        try:
            from app.models.permission_catalog import seed_permission_catalog, seed_role_permission_templates
            seed_permission_catalog()
            template_result = seed_role_permission_templates()
            if template_result['unmapped_roles'] or template_result['unmapped_permissions']:
                app.logger.warning(f'Permission template seed had gaps: {template_result}')
        except Exception as e:
            app.logger.warning(f'Permission catalog seed skipped: {e}')

        try:
            from app.services.permission_resolver import sync_legacy_role_assignments
            sync_result = sync_legacy_role_assignments()
            if sync_result['unmapped']:
                app.logger.warning(f"Role backfill: {len(sync_result['unmapped'])} user(s) unmapped: {sync_result['unmapped']}")
        except Exception as e:
            app.logger.warning(f'Role backfill skipped: {e}')

        # ── START DELEGATION AUTO-EXPIRY SCHEDULER ──
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from app.services.delegation_service import auto_expire_delegations

            scheduler = BackgroundScheduler()
            scheduler.add_job(
                func=auto_expire_delegations,
                trigger='interval',
                minutes=5,
                id='delegation_expiry',
                replace_existing=True
            )
            scheduler.start()
            app.logger.info('✅ Delegation auto-expiry scheduler started (runs every 5 min)')

            # Shutdown scheduler when app context tears down
            import atexit
            atexit.register(lambda: scheduler.shutdown())
        except Exception as e:
            app.logger.warning(f'Delegation scheduler skipped: {e}')
        # ── END DELEGATION AUTO-EXPIRY SCHEDULER ──

    return app

    

def _ensure_communication_columns():
    """New tables ke liye — pehli deploy pe auto-create."""
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    # Tables db.create_all() se ban jayenge automatically
    # Yeh function future column additions ke liye placeholder hai
    pass

# NEW — add after _ensure_communication_columns()

def _ensure_fee_record_columns():
    """
    fee_records table mein 'source' aur 'source_ref_id' columns add karo —
    Hostel/Library/Transport modules ab FeeRecord ko share karte hain
    (Expense model ke source/source_ref_id pattern jaisa).
    Existing rows automatically source='ACADEMIC' fallback lete hain.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'fee_records' not in inspector.get_table_names():
        return  # brand-new DB — create_all() handles it fully

    existing = {c['name'] for c in inspector.get_columns('fee_records')}
    to_add = {
        'source':        "VARCHAR(20) DEFAULT 'ACADEMIC'",
        'source_ref_id': 'INTEGER',
    }
    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE fee_records ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'✅ Added column fee_records.{col}')
                except Exception as e:
                    print(f'⚠️  fee_records.{col}: {e}')
def _ensure_marks_columns():
    """
    NEW — Result Management System.
    marks table mein 'version' (optimistic locking) aur 'student_status'
    (Pass/Fail/Absent/Medical Leave/Not Evaluated override) add karo.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'marks' not in inspector.get_table_names():
        return

    existing = {c['name'] for c in inspector.get_columns('marks')}
    to_add = {
        'version':        'INTEGER DEFAULT 0',
        'student_status': 'VARCHAR(20)',
    }
    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE marks ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'✅ Added column marks.{col}')
                except Exception as e:
                    print(f'⚠️  marks.{col}: {e}')


def _ensure_exam_columns():
    """Ensure newly added columns exist in exam_schedules and exam_timetable."""
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'exam_schedules' in inspector.get_table_names():
        existing = {c['name'] for c in inspector.get_columns('exam_schedules')}
        to_add = {
            'academic_year': 'VARCHAR(20)',
            'description': 'TEXT',
            'result_published_date': 'DATE',
            'grading_system': "VARCHAR(50) DEFAULT 'STANDARD'",
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE exam_schedules ADD COLUMN {col} {defn}'))
                        conn.commit()
                    except Exception:
                        pass

    if 'exam_timetable' in inspector.get_table_names():
        existing = {c['name'] for c in inspector.get_columns('exam_timetable')}
        to_add = {
            'room': 'VARCHAR(50)',
            'invigilator_id': 'INTEGER',
            'invigilator_name': 'VARCHAR(120)',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE exam_timetable ADD COLUMN {col} {defn}'))
                        conn.commit()
                    except Exception:
                        pass


def _ensure_salary_acknowledgement_columns():
    """
    salary_records (teachers) aur staff_salary_records (non-teaching staff)
    dono mein is_acknowledged / acknowledged_at add karo — Payroll
    "acknowledge payment" feature ke liye. Existing rows automatically
    is_acknowledged=False fallback lete hain (unread/unconfirmed).
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    for table in ('salary_records', 'staff_salary_records'):
        if table not in inspector.get_table_names():
            continue
        existing = {c['name'] for c in inspector.get_columns(table)}
        to_add = {
            'is_acknowledged': 'BOOLEAN DEFAULT FALSE',
            'acknowledged_at': 'TIMESTAMP',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'✅ Added column {table}.{col}')
                    except Exception as e:
                        print(f'⚠️  {table}.{col}: {e}')


# ── School columns ────────────────────────────────────────────────────────────

def _ensure_school_columns():
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'schools' not in inspector.get_table_names():
        return

    existing = {c['name'] for c in inspector.get_columns('schools')}
    to_add = {
        'plan':             "VARCHAR(20) DEFAULT 'BASIC'",
        'enabled_features': "TEXT DEFAULT '[]'",
    }
    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE schools ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'✅ Added column schools.{col}')
                except Exception as e:
                    print(f'⚠️  schools.{col}: {e}')


# ── User columns ──────────────────────────────────────────────────────────────

def _ensure_user_columns():
    """
    Run raw ALTER TABLE before SQLAlchemy ORM touches the users table.
    This prevents "column does not exist" on first deploy after adding fields.
    Safe to run every startup — skips columns that already exist.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)

    if 'users' not in inspector.get_table_names():
        # Brand-new DB: create_all() will build the full schema. Nothing to do.
        return

    existing = {c['name'] for c in inspector.get_columns('users')}

    to_add = {
        'username':            'VARCHAR(80)',
        'last_login':          'TIMESTAMP NULL',
        'department':          'VARCHAR(100)',
        'designation':         'VARCHAR(100)',
        'plain_password_temp': 'VARCHAR(256)',
        'employee_id':         'VARCHAR(30)',
    }

    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE users ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'✅ Added column users.{col}')
                except Exception as e:
                    print(f'⚠️  users.{col}: {e}')

        # PostgreSQL: add UNIQUE constraint on username if not present
        

        # PostgreSQL: add UNIQUE constraint on employee_id if not present
        if db.engine.dialect.name == 'postgresql' and 'employee_id' not in existing:
            try:
                conn.execute(text(
                    'ALTER TABLE users ADD CONSTRAINT uq_users_employee_id UNIQUE (employee_id)'
                ))
                conn.commit()
                print('✅ Added UNIQUE constraint on users.employee_id')
            except Exception as e:
                print(f'⚠️  UNIQUE constraint (employee_id): {e}')

    # PostgreSQL only: add new enum values to userrole type
    _ensure_userrole_enum()


def _ensure_userrole_enum():
    """PostgreSQL: extend the userrole enum with new role values."""
    if db.engine.dialect.name != 'postgresql':
        return  # SQLite stores enums as plain VARCHAR — no action needed

    new_values = [
        'VICE_PRINCIPAL', 'ACCOUNTANT', 'RECEPTIONIST',
        'LIBRARIAN', 'HOSTEL', 'TRANSPORT', 'HR',
        'DIRECTOR', 'ACADEMIC_COORDINATOR', 'CLASS_TEACHER',
        'ASSISTANT_TEACHER', 'EXAM_CONTROLLER',
        # NEW — Transport Driver login (Driver Mobile App)
        'DRIVER',
    ]
    from sqlalchemy import text
    with db.engine.connect() as conn:
        result = conn.execute(text(
            "SELECT enumlabel FROM pg_enum "
            "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
            "WHERE pg_type.typname = 'userrole'"
        ))
        existing_labels = {row[0] for row in result}

        for label in new_values:
            if label not in existing_labels:
                try:
                    conn.execute(text(
                        f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{label}'"
                    ))
                    conn.commit()
                    print(f'✅ Added enum value userrole.{label}')
                except Exception as e:
                    print(f'⚠️  enum {label}: {e}')


def _ensure_teacher_columns():
    """
    teachers table mein 'dob' (Date of Birth) column add karo.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'teachers' not in inspector.get_table_names():
        return
    existing = {c['name'] for c in inspector.get_columns('teachers')}
    to_add = {
        'dob': 'DATE',
    }
    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE teachers ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'[OK] Added column teachers.{col}')
                except Exception as e:
                    print(f'[WARN] teachers.{col}: {e}')


def _ensure_student_columns():
    """
    Run raw ALTER TABLE before SQLAlchemy ORM touches the students table.
    This prevents 'column does not exist' on PostgreSQL/Render when deployed.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    if 'students' not in inspector.get_table_names():
        return

    existing = {c['name'] for c in inspector.get_columns('students')}
    to_add = {
        'admission_date':       'DATE',
        'aadhar_no':            'VARCHAR(30)',
        'parent_aadhar_no':     'VARCHAR(30)',
        'category':             "VARCHAR(50) DEFAULT 'General'",
        'nationality':          "VARCHAR(50) DEFAULT 'Indian'",
        'religion':             'VARCHAR(50)',
        'father_occupation':    'VARCHAR(100)',
        'mother_occupation':    'VARCHAR(100)',
        'guardian_name':        'VARCHAR(120)',
        'guardian_relation':    'VARCHAR(50)',
        'guardian_phone':       'VARCHAR(20)',
        'is_first_school':      'BOOLEAN DEFAULT FALSE',
        'previous_school_name': 'VARCHAR(200)',
        'previous_class':       'VARCHAR(50)',
        'previous_tc_no':       'VARCHAR(100)',
        'previous_tc_date':     'DATE',
        'previous_reason':      'VARCHAR(250)',
    }
    with db.engine.connect() as conn:
        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE students ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'✅ Added column students.{col}')
                except Exception as e:
                    print(f'⚠️  students.{col}: {e}')


# ── Seed super admin ──────────────────────────────────────────────────────────

def _seed_super_admin():
    from app.models.user import User, UserRole
    from sqlalchemy import text

    # Use raw SQL count to avoid ORM touching any column that might
    # still be missing in a partial migration edge case.
    with db.engine.connect() as conn:
        row = conn.execute(text(
            "SELECT COUNT(*) FROM users WHERE role = 'SUPER_ADMIN'"
        )).scalar()

    if row and row > 0:
        return  # already seeded

    email    = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@eduErp.com')
    password = os.environ.get('SUPER_ADMIN_PASSWORD', 'SuperAdmin@123')

    admin = User(name='Super Admin', email=email, role=UserRole.SUPER_ADMIN)
    admin.set_password(password, store_plain=False)
    db.session.add(admin)
    db.session.commit()
    print('[OK] Super Admin seeded')
