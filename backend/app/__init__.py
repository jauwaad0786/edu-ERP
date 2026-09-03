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

    from app.routes.hrms import hrms_bp
    app.register_blueprint(hrms_bp, url_prefix='/api/hrms')

    from app.routes.fees_finance import fees_finance_bp
    app.register_blueprint(fees_finance_bp, url_prefix='/api/fees-finance')

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
    from app.routes.academic_resources import academic_resources_bp
    app.register_blueprint(academic_resources_bp)

    # ── 1P360 BOT — AI Blueprint ─────────────────────────────────────────────
    try:
        from app.AI.routes.ai_routes import ai_bp
        app.register_blueprint(ai_bp)
    except Exception as e:
        app.logger.warning(f'AI blueprint registration skipped: {e}')

    # ── Startup sequence (ORDER IS CRITICAL on PostgreSQL) ──────────────────
    with app.app_context():
        try:
            from app.models import hrms as hrms_models  # noqa: F401
            from app.models import fee_finance as fee_finance_models  # noqa: F401
            from app.models import finance as finance_models  # noqa: F401
            _ensure_school_columns()
            _ensure_user_columns()
            _ensure_teacher_columns()
            _ensure_student_columns()
            _ensure_communication_columns()
            _ensure_academic_resource_columns()
            _ensure_fee_record_columns()
            _ensure_salary_acknowledgement_columns()
            _ensure_marks_columns()
            _ensure_exam_columns()
            _ensure_document_columns()
            _ensure_library_columns()
            _ensure_hostel_columns()
            _ensure_transport_columns()
            _ensure_finance_phase2_columns()
            # ── Import AI models so db.create_all() creates their tables ──
            try:
                from app.AI.models.ai_models import (  # noqa: F401
                    AIProviderConfig, AIRoleQuota, AIUsage,
                    AIQueryCache, AIConversation, AIMessage,
                    AIDocument, AIDocumentChunk,
                )
            except Exception as ai_e:
                app.logger.warning(f'AI models import skipped: {ai_e}')
            db.create_all()
            _seed_super_admin()
            _ensure_deleted_items_schema()

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

            # ── 1-YEAR DELETED ITEMS RETENTION CLEANUP JOB (Requirement #4 & #16) ──
            def _archive_cleanup_runner():
                with app.app_context():
                    from app.services.archive_service import run_one_year_cleanup_job
                    run_one_year_cleanup_job()

            scheduler.add_job(
                func=_archive_cleanup_runner,
                trigger='interval',
                hours=24,
                id='deleted_items_retention_cleanup',
                replace_existing=True
            )
            app.logger.info('✅ 1-Year Deleted Items Auto-Cleanup scheduler started (runs daily)')

            # Shutdown scheduler when app context tears down
            import atexit
            atexit.register(lambda: scheduler.shutdown())
        except Exception as e:
            app.logger.warning(f'Delegation scheduler skipped: {e}')
        # ── END DELEGATION AUTO-EXPIRY SCHEDULER ──

    return app


def _ensure_document_columns():
    """
    Ensure all columns exist for student_documents and issued_documents in PostgreSQL.
    Prevents undefined column errors and crashes on Render.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    table_names = inspector.get_table_names()

    if 'student_documents' in table_names:
        existing = {c['name'] for c in inspector.get_columns('student_documents')}
        to_add = {
            'custom_label':       'VARCHAR(150)',
            'title':              'VARCHAR(200)',
            'file_size':          'INTEGER',
            'class_id_at_upload': 'INTEGER',
            'academic_year':      'VARCHAR(20)',
            'uploaded_by_role':   'VARCHAR(30)',
            'remarks':            'VARCHAR(300)',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE student_documents ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column student_documents.{col}')
                    except Exception as e:
                        print(f'[WARN] student_documents.{col}: {e}')

    if 'issued_documents' in table_names:
        existing = {c['name'] for c in inspector.get_columns('issued_documents')}
        to_add = {
            'custom_label':          'VARCHAR(150)',
            'title':                 'VARCHAR(200)',
            'certificate_no':        'VARCHAR(100)',
            'file_size':             'INTEGER',
            'class_id_at_issue':     'INTEGER',
            'academic_year':         'VARCHAR(20)',
            'remarks':               'VARCHAR(300)',
            'is_visible_to_student': 'BOOLEAN DEFAULT TRUE',
            'payload_data':          'TEXT DEFAULT \'{}\'',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE issued_documents ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column issued_documents.{col}')
                    except Exception as e:
                        print(f'[WARN] issued_documents.{col}: {e}')




def _ensure_academic_resource_columns():
    """
    Auto-migrate columns for notes, assignments, assignment_submissions, and internal_marks.
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    table_names = inspector.get_table_names()

    if 'notes' in table_names:
        existing = {c['name'] for c in inspector.get_columns('notes')}
        to_add = {
            'file_size':     'INTEGER',
            'file_type':     'VARCHAR(50)',
            'teacher_id':    'INTEGER',
            'academic_year': 'VARCHAR(20)',
            'updated_at':    'TIMESTAMP',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE notes ADD COLUMN {col} {defn}'))
                        conn.commit()
                    except Exception as e:
                        print(f'[WARN] notes.{col}: {e}')


def _ensure_library_columns():
    """Ensure newly added columns exist in library tables."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        # 1. library_fine_transactions
        if 'library_fine_transactions' in table_names:
            existing = {c['name'] for c in inspector.get_columns('library_fine_transactions')}
            to_add = {
                'waived_amount':      'FLOAT DEFAULT 0.0',
                'waived_at':          'DATETIME',
                'payment_mode':       'VARCHAR(30)',
                'receipt_no':         'VARCHAR(50)',
                'fee_transaction_id': 'INTEGER',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE library_fine_transactions ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column library_fine_transactions.{col}')
                        except Exception as e:
                            print(f'[WARN] library_fine_transactions.{col}: {e}')

        # 2. library_settings
        if 'library_settings' in table_names:
            existing = {c['name'] for c in inspector.get_columns('library_settings')}
            to_add = {
                'damaged_book_fine_multiplier': 'FLOAT DEFAULT 0.5',
                'lost_card_fine':               'FLOAT DEFAULT 50.0',
                'missing_pages_fine':           'FLOAT DEFAULT 20.0',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE library_settings ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column library_settings.{col}')
                        except Exception as e:
                            print(f'[WARN] library_settings.{col}: {e}')

        # 3. book_copies
        if 'book_copies' in table_names:
            existing = {c['name'] for c in inspector.get_columns('book_copies')}
            to_add = {
                'shelf_location': 'VARCHAR(50)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE book_copies ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column book_copies.{col}')
                        except Exception as e:
                            print(f'[WARN] book_copies.{col}: {e}')
    except Exception as e:
        print(f'[WARN] _ensure_library_columns error: {e}')


def _ensure_hostel_columns():
    """Ensure newly added columns exist in hostel tables."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        # 1. hostel_bed_allocations
        if 'hostel_bed_allocations' in table_names:
            existing = {c['name'] for c in inspector.get_columns('hostel_bed_allocations')}
            to_add = {
                'checkin_date':           'DATE',
                'expected_checkout_date': 'DATE',
                'checkout_remarks':       'VARCHAR(300)',
                'checkout_approved_by':   'INTEGER',
                'billing_frequency':      "VARCHAR(20) DEFAULT 'MONTHLY'",
                'custom_fee':             'FLOAT',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE hostel_bed_allocations ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column hostel_bed_allocations.{col}')
                        except Exception as e:
                            print(f'[WARN] hostel_bed_allocations.{col}: {e}')

        # 1b. hostel_fee_structures
        if 'hostel_fee_structures' in table_names:
            existing_fs = {c['name'] for c in inspector.get_columns('hostel_fee_structures')}
            to_add_fs = {
                'half_yearly_fee': 'FLOAT DEFAULT 0.0',
                'one_time_fee':    'FLOAT DEFAULT 0.0',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add_fs.items():
                    if col not in existing_fs:
                        try:
                            conn.execute(text(f'ALTER TABLE hostel_fee_structures ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column hostel_fee_structures.{col}')
                        except Exception as e:
                            print(f'[WARN] hostel_fee_structures.{col}: {e}')

        # 2. hostel_fine_records
        if 'hostel_fine_records' in table_names:
            existing = {c['name'] for c in inspector.get_columns('hostel_fine_records')}
            to_add = {
                'amount_paid':        'FLOAT DEFAULT 0.0',
                'waived_amount':      'FLOAT DEFAULT 0.0',
                'waived_by':          'INTEGER',
                'waived_at':          'TIMESTAMP',
                'waive_reason':       'VARCHAR(300)',
                'collected_by':       'INTEGER',
                'collected_at':       'TIMESTAMP',
                'payment_mode':       'VARCHAR(30)',
                'receipt_no':         'VARCHAR(50)',
                'fee_transaction_id': 'INTEGER',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE hostel_fine_records ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column hostel_fine_records.{col}')
                        except Exception as e:
                            print(f'[WARN] hostel_fine_records.{col}: {e}')
    except Exception as e:
        print(f'[WARN] _ensure_hostel_columns error: {e}')


def _ensure_transport_columns():
    """
    Ensure newly added columns and tables exist in transport tables for PostgreSQL/SQLite:
    - transport_student_assignments (pickup_stop_id, drop_stop_id)
    - transport_trip_logs (students_count, sos_triggered_at, breakdown_reported_at, remarks)
    - transport_fine_records
    - transport_trip_student_attendance
    """
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()

        if 'transport_student_assignments' in tables:
            existing = {c['name'] for c in inspector.get_columns('transport_student_assignments')}
            to_add = {
                'pickup_stop_id': 'INTEGER REFERENCES transport_stops(id)',
                'drop_stop_id':   'INTEGER REFERENCES transport_stops(id)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE transport_student_assignments ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column transport_student_assignments.{col}')
                        except Exception as e:
                            print(f'[WARN] transport_student_assignments.{col}: {e}')

        if 'transport_trip_logs' in tables:
            existing = {c['name'] for c in inspector.get_columns('transport_trip_logs')}
            to_add = {
                'students_count':        'INTEGER DEFAULT 0',
                'sos_triggered_at':      'TIMESTAMP',
                'breakdown_reported_at': 'TIMESTAMP',
                'remarks':               'VARCHAR(500)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE transport_trip_logs ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column transport_trip_logs.{col}')
                        except Exception as e:
                            print(f'[WARN] transport_trip_logs.{col}: {e}')
    except Exception as e:
        print(f'[WARN] _ensure_transport_columns error: {e}')


def _ensure_finance_phase2_columns():
    """Ensure newly added columns exist in expenses, vendors, and inventory_items across PostgreSQL/SQLite."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        if 'expenses' in table_names:
            existing = {c['name'] for c in inspector.get_columns('expenses')}
            to_add = {
                'expense_number':   'VARCHAR(40)',
                'department':       "VARCHAR(50) DEFAULT 'ACCOUNTS'",
                'approved_by':      'INTEGER',
                'approved_at':      'TIMESTAMP',
                'rejection_reason': 'VARCHAR(300)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE expenses ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column expenses.{col}')
                        except Exception as e:
                            print(f'[WARN] expenses.{col}: {e}')

        if 'vendors' in table_names:
            existing = {c['name'] for c in inspector.get_columns('vendors')}
            to_add = {
                'vendor_code':     'VARCHAR(40)',
                'payment_terms':   "VARCHAR(50) DEFAULT 'Net 30'",
                'bank_name':       'VARCHAR(100)',
                'bank_account_no': 'VARCHAR(50)',
                'bank_ifsc':       'VARCHAR(30)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE vendors ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column vendors.{col}')
                        except Exception as e:
                            print(f'[WARN] vendors.{col}: {e}')

        if 'inventory_items' in table_names:
            existing = {c['name'] for c in inspector.get_columns('inventory_items')}
            to_add = {
                'item_code':        'VARCHAR(50)',
                'subcategory':      'VARCHAR(60)',
                'unit':             "VARCHAR(30) DEFAULT 'PIECES'",
                'brand':            'VARCHAR(100)',
                'description':      'VARCHAR(300)',
                'selling_price':    'FLOAT DEFAULT 0.0',
                'reorder_level':    'INTEGER DEFAULT 10',
                'vendor_id':        'INTEGER',
                'storage_location': 'VARCHAR(150)',
            }
            with db.engine.connect() as conn:
                for col, defn in to_add.items():
                    if col not in existing:
                        try:
                            conn.execute(text(f'ALTER TABLE inventory_items ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column inventory_items.{col}')
                        except Exception as e:
                            print(f'[WARN] inventory_items.{col}: {e}')
    except Exception as e:
        print(f'[WARN] _ensure_finance_phase2_columns error: {e}')


def _ensure_communication_columns():
    """
    Ensure communication table migrations:
    - support_tickets.linked_error_id column
    - chat_messages indexes (idx_chat_school_sender, idx_chat_school_receiver)
    """
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        # 1. support_tickets.linked_error_id
        if 'support_tickets' in table_names:
            existing_cols = {c['name'] for c in inspector.get_columns('support_tickets')}
            if 'linked_error_id' not in existing_cols:
                with db.engine.connect() as conn:
                    try:
                        conn.execute(text('ALTER TABLE support_tickets ADD COLUMN linked_error_id INTEGER REFERENCES error_logs(id)'))
                        conn.commit()
                        print('[OK] Added column support_tickets.linked_error_id')
                    except Exception as e:
                        print(f'[WARN] support_tickets.linked_error_id: {e}')

        # 2. chat_messages indexes
        if 'chat_messages' in table_names:
            with db.engine.connect() as conn:
                try:
                    conn.execute(text('CREATE INDEX IF NOT EXISTS idx_chat_school_sender ON chat_messages (school_id, sender_id)'))
                    conn.execute(text('CREATE INDEX IF NOT EXISTS idx_chat_school_receiver ON chat_messages (school_id, receiver_id)'))
                    conn.commit()
                except Exception as e:
                    print(f'[WARN] chat_messages index creation: {e}')
    except Exception as e:
        print(f'[WARN] _ensure_communication_columns error: {e}')


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
        'source':            "VARCHAR(20) DEFAULT 'ACADEMIC'",
        'source_ref_id':     'INTEGER',
        'billing_frequency': "VARCHAR(20) DEFAULT 'MONTHLY'",
        'period_start':      'DATE',
        'period_end':        'DATE',
        'coverage_label':    'VARCHAR(100)',
    }
    with db.engine.connect() as conn:
        # Drop PostgreSQL unique constraint on receipt_no if present
        try:
            conn.execute(text('ALTER TABLE fee_records DROP CONSTRAINT IF EXISTS fee_records_receipt_no_key'))
            conn.commit()
        except Exception:
            pass

        for col, defn in to_add.items():
            if col not in existing:
                try:
                    conn.execute(text(f'ALTER TABLE fee_records ADD COLUMN {col} {defn}'))
                    conn.commit()
                    print(f'[OK] Added column fee_records.{col}')
                except Exception as e:
                    print(f'[WARN] fee_records.{col}: {e}')

    # Also ensure fee_bill_items has billing_frequency and coverage columns
    if 'fee_bill_items' in inspector.get_table_names():
        existing_bi = {c['name'] for c in inspector.get_columns('fee_bill_items')}
        bi_to_add = {
            'billing_frequency': "VARCHAR(20) DEFAULT 'MONTHLY'",
            'period_start':      'DATE',
            'period_end':        'DATE',
            'coverage_label':    'VARCHAR(100)',
        }
        with db.engine.connect() as conn:
            for col, defn in bi_to_add.items():
                if col not in existing_bi:
                    try:
                        conn.execute(text(f'ALTER TABLE fee_bill_items ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column fee_bill_items.{col}')
                    except Exception as e:
                        print(f'[WARN] fee_bill_items.{col}: {e}')


def _ensure_library_columns():
    """
    Ensure newly added columns exist in library tables:
    - library_fine_transactions (waived_amount, waived_at, waive_reason, collected_by, collected_at, payment_mode, receipt_no, fee_transaction_id)
    - library_settings (damaged_book_fine_multiplier, lost_card_fine, missing_pages_fine)
    - book_copies (condition_note, shelf_location)
    """
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()

    if 'library_fine_transactions' in tables:
        existing = {c['name'] for c in inspector.get_columns('library_fine_transactions')}
        to_add = {
            'waived_amount':      'FLOAT DEFAULT 0.0',
            'waived_at':          'TIMESTAMP',
            'waive_reason':       'VARCHAR(300)',
            'collected_by':       'INTEGER',
            'collected_at':       'TIMESTAMP',
            'payment_mode':       'VARCHAR(30)',
            'receipt_no':         'VARCHAR(50)',
            'fee_transaction_id': 'INTEGER',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE library_fine_transactions ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column library_fine_transactions.{col}')
                    except Exception as e:
                        print(f'[WARN] library_fine_transactions.{col}: {e}')

    if 'library_settings' in tables:
        existing = {c['name'] for c in inspector.get_columns('library_settings')}
        to_add = {
            'damaged_book_fine_multiplier': 'FLOAT DEFAULT 0.5',
            'lost_card_fine':               'FLOAT DEFAULT 50.0',
            'missing_pages_fine':           'FLOAT DEFAULT 100.0',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE library_settings ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column library_settings.{col}')
                    except Exception as e:
                        print(f'[WARN] library_settings.{col}: {e}')

    if 'book_copies' in tables:
        existing = {c['name'] for c in inspector.get_columns('book_copies')}
        to_add = {
            'condition_note': 'VARCHAR(300)',
            'shelf_location': 'VARCHAR(50)',
        }
        with db.engine.connect() as conn:
            for col, defn in to_add.items():
                if col not in existing:
                    try:
                        conn.execute(text(f'ALTER TABLE book_copies ADD COLUMN {col} {defn}'))
                        conn.commit()
                        print(f'[OK] Added column book_copies.{col}')
                    except Exception as e:
                        print(f'[WARN] book_copies.{col}: {e}')


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
                        print(f'[OK] Added column marks.{col}')
                    except Exception as e:
                        print(f'[WARN] marks.{col}: {e}')


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
                        print(f'[OK] Added column {table}.{col}')
                    except Exception as e:
                        print(f'[WARN] {table}.{col}: {e}')


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
                    print(f'[OK] Added column schools.{col}')
                except Exception as e:
                    print(f'[WARN] schools.{col}: {e}')


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
                    print(f'[OK] Added column users.{col}')
                except Exception as e:
                    print(f'[WARN] users.{col}: {e}')

        # PostgreSQL: add UNIQUE constraint on username if not present
        

        # PostgreSQL: add UNIQUE constraint on employee_id if not present
        if db.engine.dialect.name == 'postgresql' and 'employee_id' not in existing:
            try:
                conn.execute(text(
                    'ALTER TABLE users ADD CONSTRAINT uq_users_employee_id UNIQUE (employee_id)'
                ))
                conn.commit()
                print('[OK] Added UNIQUE constraint on users.employee_id')
            except Exception as e:
                print(f'[WARN] UNIQUE constraint (employee_id): {e}')

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
                    print(f'[OK] Added enum value userrole.{label}')
                except Exception as e:
                    print(f'[WARN] enum {label}: {e}')


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
                    print(f'[OK] Added column students.{col}')
                except Exception as e:
                    print(f'[WARN] students.{col}: {e}')


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


def _ensure_deleted_items_schema():
    """
    Ensure soft delete columns exist on students, teachers, users,
    and all columns exist on deleted_items table across both SQLite and PostgreSQL.
    """
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        common_cols = {
            'is_deleted':    'BOOLEAN DEFAULT FALSE',
            'deleted_at':    'TIMESTAMP',
            'deleted_by':    'INTEGER',
            'delete_reason': 'VARCHAR(255)',
            'is_anonymized': 'BOOLEAN DEFAULT FALSE',
        }

        with db.engine.connect() as conn:
            for tbl in ['students', 'teachers', 'users']:
                if tbl in table_names:
                    existing = {c['name'] for c in inspector.get_columns(tbl)}
                    for col, defn in common_cols.items():
                        if col not in existing:
                            try:
                                conn.execute(text(f'ALTER TABLE {tbl} ADD COLUMN {col} {defn}'))
                                conn.commit()
                                print(f'[OK] Added column {tbl}.{col}')
                            except Exception as ex:
                                print(f'[WARN] Failed to add {tbl}.{col}: {ex}')

            if 'deleted_items' in table_names:
                existing_di = {c['name'] for c in inspector.get_columns('deleted_items')}
                di_cols = {
                    'purged_at':       'TIMESTAMP',
                    'recovery_data':   'JSON',
                    'status':          "VARCHAR(20) DEFAULT 'ARCHIVED'",
                    'student_type':    'VARCHAR(50)',
                    'department':      'VARCHAR(100)',
                    'designation':     'VARCHAR(100)',
                    'role':            'VARCHAR(50)',
                    'session':         'VARCHAR(50)',
                    'deleted_by_name': 'VARCHAR(120)',
                    'delete_reason':   'VARCHAR(255)',
                    'identifier':      'VARCHAR(50)',
                    'class_name':      'VARCHAR(100)',
                    'section':         'VARCHAR(20)',
                    'auto_delete_at':  'TIMESTAMP',
                }
                for col, defn in di_cols.items():
                    if col not in existing_di:
                        try:
                            conn.execute(text(f'ALTER TABLE deleted_items ADD COLUMN {col} {defn}'))
                            conn.commit()
                            print(f'[OK] Added column deleted_items.{col}')
                        except Exception as ex:
                            print(f'[WARN] Failed to add deleted_items.{col}: {ex}')
    except Exception as e:
        print(f'[WARN] _ensure_deleted_items_schema: {e}')


