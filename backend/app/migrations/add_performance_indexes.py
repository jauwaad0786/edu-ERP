"""
Performance Indexes Migration Module
1P360 School ERP / EduERP

Creates high-impact single-column and composite indexes across multi-tenant tables.
Idempotent and dialect-agnostic (supports SQLite and PostgreSQL).
"""

import logging
from sqlalchemy import text, inspect
from app import db

logger = logging.getLogger(__name__)

INDEXES_TO_CREATE = [
    # Table, Index Name, Columns
    ('students', 'idx_students_school_id', ['school_id']),
    ('students', 'idx_students_school_class', ['school_id', 'class_id']),
    ('students', 'idx_students_school_deleted', ['school_id', 'is_deleted']),
    ('teachers', 'idx_teachers_school_id', ['school_id']),
    ('teachers', 'idx_teachers_school_deleted', ['school_id', 'is_deleted']),
    ('users', 'idx_users_school_id', ['school_id']),
    ('users', 'idx_users_school_role_active', ['school_id', 'role', 'is_active']),
    ('classes', 'idx_classes_school_id', ['school_id']),
    ('classes', 'idx_classes_school_name_sec', ['school_id', 'name', 'section']),
    ('subjects', 'idx_subjects_school_id', ['school_id']),
    ('subjects', 'idx_subjects_school_class', ['school_id', 'class_id']),
    ('marks', 'idx_marks_school_id', ['school_id']),
    ('marks', 'idx_marks_school_exam_class', ['school_id', 'exam_id', 'class_id']),
    ('attendance', 'idx_attendance_class_date', ['class_id', 'date']),
    ('attendance', 'idx_attendance_student_date', ['student_id', 'date']),
    ('fee_records', 'idx_feerec_school_id', ['school_id']),
    ('fee_records', 'idx_feerec_school_session_status', ['school_id', 'session', 'status']),
    ('fee_records', 'idx_feerec_school_student', ['school_id', 'student_id']),
    ('fee_records', 'idx_feerec_school_month', ['school_id', 'month']),
    ('fee_records', 'idx_feerec_school_paid_date', ['school_id', 'paid_date']),
    ('fee_bills', 'idx_feebills_school_session_status', ['school_id', 'session', 'status']),
    ('fee_payments', 'idx_feepayments_school_session_status', ['school_id', 'session', 'status']),
    ('salary_records', 'idx_salary_records_school_id', ['school_id']),
    ('timetables', 'idx_timetables_school_id', ['school_id']),
    ('support_tickets', 'idx_support_tickets_school_status', ['school_id', 'status']),
    ('hostel_beds', 'idx_hostel_beds_school_status', ['school_id', 'status']),
    ('announcements', 'idx_announcements_school_active', ['school_id', 'is_active']),
    ('meeting_requests', 'idx_meeting_requests_school_id', ['school_id']),
    ('teacher_attendance', 'idx_teacher_att_school_date', ['school_id', 'date']),
]


def ensure_performance_indexes():
    """
    Checks table columns and safely creates composite and foreign-key supporting
    indexes to eliminate sequential table scans on multi-tenant workloads.
    """
    try:
        inspector = inspect(db.engine)
        table_names = set(inspector.get_table_names())
        
        with db.engine.connect() as conn:
            for table_name, index_name, cols in INDEXES_TO_CREATE:
                if table_name not in table_names:
                    continue
                
                # Verify all requested columns actually exist in the table schema
                existing_cols = {c['name'] for c in inspector.get_columns(table_name)}
                if not all(col in existing_cols for col in cols):
                    continue
                
                # Check if index already exists
                existing_indexes = {idx['name'] for idx in inspector.get_indexes(table_name)}
                if index_name in existing_indexes:
                    continue
                
                col_list_str = ', '.join(cols)
                sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({col_list_str})"
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    logger.info(f"Created performance index: {index_name} on {table_name}({col_list_str})")
                except Exception as idx_err:
                    logger.debug(f"Index creation note for {index_name}: {idx_err}")
    except Exception as e:
        logger.warning(f"Performance index initialization note: {e}")
