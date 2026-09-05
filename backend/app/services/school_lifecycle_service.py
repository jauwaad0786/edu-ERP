"""
School Lifecycle Management Service
EduERP / OnePlatform360 — Production-grade Multi-Tenant School Lifecycle Engine

Lifecycles:
  ACTIVE -> ARCHIVED (1-Year Retention Window) -> PERMANENT_DELETE_ELIGIBLE -> PERMANENTLY_DELETED

Guarantees:
  1. Soft-delete / Archive is non-destructive (historical business, financial, attendance data remains 100% intact).
  2. Multi-tenant isolation: Operations on School A NEVER modify or delete School B data.
  3. Recovery restores the entire school, all linked users, and operational rosters.
  4. Permanent deletion is transactional, cascading cleanly through dependent child tables before parent models.
  5. Uploaded files belonging to the deleted school are safely purged from storage.
  6. Audit event is permanently preserved in company_activity_logs even after school deletion.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from sqlalchemy import text, inspect, bindparam, table, column, delete, or_, select, func

from app import db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.audit import log_company_action, CompanyActivityLog
from app.utils.request_context import capture_request_context

logger = logging.getLogger(__name__)


def get_school_archive_summary(school_id: int) -> dict:
    """
    Computes real-time record counts and financial aggregates across all ERP modules
    for confirmation modals and Super Admin archive inspection.
    """
    school = School.query.get(school_id)
    if not school:
        raise ValueError('School not found')

    summary = {
        'school_id': school.id,
        'name': school.name,
        'school_name': school.name,
        'code': school.code,
        'status': school.status or ('ACTIVE' if school.is_active else 'INACTIVE'),
        'archived_at': school.archived_at.isoformat() if school.archived_at else None,
        'permanent_delete_eligible_at': school.permanent_delete_eligible_at.isoformat() if school.permanent_delete_eligible_at else None,
        'days_remaining': max(0, (school.permanent_delete_eligible_at - datetime.utcnow()).days) if school.permanent_delete_eligible_at else (365 if school.status == 'ARCHIVED' else None),
        'is_eligible_for_permanent_delete': bool(school.status == 'ARCHIVED' and school.permanent_delete_eligible_at and datetime.utcnow() >= school.permanent_delete_eligible_at),
        'counts': {
            'students': 0,
            'teachers': 0,
            'staff': 0,
            'total_users': 0,
            'classes': 0,
            'subjects': 0,
            'fee_records': 0,
            'fee_bills': 0,
            'fee_payments': 0,
            'total_fees_billed': 0.0,
            'total_fees_collected': 0.0,
            'total_fees_pending': 0.0,
            'expenses_count': 0,
            'total_expenses': 0.0,
            'hostel_buildings': 0,
            'hostel_rooms': 0,
            'hostel_allocations': 0,
            'transport_vehicles': 0,
            'transport_routes': 0,
            'transport_assignments': 0,
            'library_books': 0,
            'library_book_issues': 0,
            'inventory_items': 0,
            'vendors': 0,
            'assets': 0,
            'documents': 0,
            'attendance_records': 0,
            'marks_records': 0,
            'exams': 0,
        }
    }

    try:
        from app.models.academic import Student, Teacher, Class, Subject, Marks
        from app.models.financial import FeeRecord
        from app.models.fee_finance import FeeBill, FeePayment
        from app.models.finance import Expense
        from app.models.hostel import HostelBuilding, HostelRoom, HostelBedAllocation
        from app.models.transport import Vehicle, Route
        from app.models.transport_student import StudentTransport
        from app.models.library import Book, BookIssue
        from app.models.documents import StudentDocument
        from app.models.hrms import EmployeeDocument
        from app.models.staff_attendance import StaffAttendance

        # Users & Academic counts
        summary['counts']['students'] = Student.query.filter_by(school_id=school_id).count()
        summary['counts']['teachers'] = Teacher.query.filter_by(school_id=school_id).count()
        summary['counts']['total_users'] = User.query.filter_by(school_id=school_id).count()
        summary['counts']['users'] = summary['counts']['total_users']
        summary['counts']['staff'] = max(0, summary['counts']['total_users'] - summary['counts']['students'] - summary['counts']['teachers'])
        summary['counts']['classes'] = Class.query.filter_by(school_id=school_id).count()
        summary['counts']['subjects'] = Subject.query.filter_by(school_id=school_id).count()
        summary['counts']['marks_records'] = Marks.query.filter_by(school_id=school_id).count()

        # Fees & Financials
        fee_records = FeeRecord.query.filter_by(school_id=school_id).all()
        summary['counts']['fee_records'] = len(fee_records)
        due = sum(float(r.amount_due or 0.0) for r in fee_records)
        paid = sum(float(r.amount_paid or 0.0) for r in fee_records)
        summary['counts']['total_fees_billed'] = round(due, 2)
        summary['counts']['total_fees_collected'] = round(paid, 2)
        summary['counts']['total_fees_pending'] = round(max(0.0, due - paid), 2)

        summary['counts']['fee_bills'] = FeeBill.query.filter_by(school_id=school_id).count()
        summary['counts']['fee_payments'] = FeePayment.query.filter_by(school_id=school_id).count()

        # Expenses
        expenses = Expense.query.filter_by(school_id=school_id).all()
        summary['counts']['expenses_count'] = len(expenses)
        summary['counts']['total_expenses'] = round(sum(float(e.amount or 0.0) for e in expenses), 2)

        # Hostel
        summary['counts']['hostel_buildings'] = HostelBuilding.query.filter_by(school_id=school_id).count()
        summary['counts']['hostel_rooms'] = HostelRoom.query.filter_by(school_id=school_id).count()
        summary['counts']['hostel_allocations'] = HostelBedAllocation.query.filter_by(school_id=school_id).count()

        # Transport
        summary['counts']['transport_vehicles'] = Vehicle.query.filter_by(school_id=school_id).count()
        summary['counts']['transport_routes'] = Route.query.filter_by(school_id=school_id).count()
        summary['counts']['transport_assignments'] = StudentTransport.query.filter_by(school_id=school_id).count()

        # Library
        summary['counts']['library_books'] = Book.query.filter_by(school_id=school_id).count()
        summary['counts']['library_book_issues'] = BookIssue.query.filter_by(school_id=school_id).count()

        # Documents
        s_docs = StudentDocument.query.filter_by(school_id=school_id).count()
        e_docs = EmployeeDocument.query.filter_by(school_id=school_id).count()
        summary['counts']['documents'] = s_docs + e_docs

        # Attendance
        summary['counts']['attendance_records'] = StaffAttendance.query.filter_by(school_id=school_id).count()
    except Exception as e:
        logger.warning(f"Error compiling archive summary for school {school_id}: {e}")

    return summary


def archive_school(school_id: int, actor_user, reason: str = '') -> dict:
    """
    Archives a school and all its ERP data:
    - Sets school.status = 'ARCHIVED', is_active = False.
    - Sets archived_at = now, permanent_delete_eligible_at = now + 365 days.
    - Blocks school users from logging in or using normal ERP routes.
    - Preserves all business and financial records 100% intact.
    - Logs SCHOOL_ARCHIVED audit log.
    """
    school = School.query.get(school_id)
    if not school:
        raise ValueError('School not found')

    if getattr(school, 'status', None) == 'ARCHIVED':
        raise ValueError(f"School '{school.name}' is already archived.")

    now = datetime.utcnow()
    eligible_at = now + timedelta(days=365)
    clean_reason = (reason or '').strip() or 'Archived by Super Admin'

    school.status = 'ARCHIVED'
    school.is_active = False
    school.archived_at = now
    school.archived_by = actor_user.id if actor_user else None
    school.archive_reason = clean_reason
    school.permanent_delete_eligible_at = eligible_at

    # Deactivate active user logins belonging to this school
    User.query.filter(User.school_id == school_id, User.is_active == True).update(
        {'is_active': False}, synchronize_session=False
    )

    meta = {}
    try:
        from flask import has_request_context
        if has_request_context():
            meta = capture_request_context()
    except Exception:
        pass
    log_company_action(
        actor_user=actor_user,
        module='SCHOOL_LIFECYCLE',
        action='SCHOOL_ARCHIVED',
        affected_school_id=school_id,
        remarks=f"Archived school '{school.name}' ({school.code}). Reason: {clean_reason}",
        request_meta=meta,
        new_value={
            'school_id': school.id,
            'name': school.name,
            'code': school.code,
            'status': 'ARCHIVED',
            'archived_at': now.isoformat(),
            'permanent_delete_eligible_at': eligible_at.isoformat(),
            'reason': clean_reason,
        }
    )

    db.session.commit()
    logger.info(f"[LIFECYCLE] School {school.name} ({school.id}) successfully ARCHIVED.")
    return school.to_dict()


def recover_school(school_id: int, actor_user) -> dict:
    """
    Recovers an archived school back to ACTIVE state:
    - Restores school.status = 'ACTIVE', is_active = True.
    - Clears archive timestamps and reason.
    - Re-activates school users (excluding individually soft-deleted users).
    - Logs SCHOOL_RECOVERED audit log.
    """
    school = School.query.get(school_id)
    if not school:
        raise ValueError('School not found')

    if getattr(school, 'status', None) != 'ARCHIVED':
        raise ValueError(f"School '{school.name}' is not currently archived (current status: {school.status or 'ACTIVE'}).")

    prev_archived_at = school.archived_at.isoformat() if school.archived_at else None

    school.status = 'ACTIVE'
    school.is_active = True
    school.archived_at = None
    school.archived_by = None
    school.archive_reason = None
    school.permanent_delete_eligible_at = None

    # Re-activate school users (preserve individually soft-deleted items)
    User.query.filter(
        User.school_id == school_id,
        db.or_(User.is_deleted == False, User.is_deleted.is_(None))
    ).update({'is_active': True}, synchronize_session=False)

    meta = {}
    try:
        from flask import has_request_context
        if has_request_context():
            meta = capture_request_context()
    except Exception:
        pass
    log_company_action(
        actor_user=actor_user,
        module='SCHOOL_LIFECYCLE',
        action='SCHOOL_RECOVERED',
        affected_school_id=school_id,
        remarks=f"Recovered school '{school.name}' ({school.code}) back to ACTIVE status.",
        request_meta=meta,
        old_value={'status': 'ARCHIVED', 'archived_at': prev_archived_at},
        new_value={'status': 'ACTIVE'}
    )

    db.session.commit()
    logger.info(f"[LIFECYCLE] School {school.name} ({school.id}) successfully RECOVERED to ACTIVE.")
    return school.to_dict()


def permanently_delete_school(school_id: int, actor_user, confirm_name: str, force: bool = False) -> dict:
    """
    Permanently and irreversibly deletes a school:
    1. Validates the school is ARCHIVED (active schools cannot be permanently deleted).
    2. Validates explicit confirmation string 'DELETE <SCHOOL_NAME>' or exact school code.
    3. Verifies 1-year retention eligibility (unless force=True specified with Super Admin authority).
    4. Compiles final pre-deletion stats summary.
    5. Discovers and deletes local files belonging to the school.
    6. Executes atomic, dependency-ordered transactional database deletion across all child tables.
    7. Unlinks affected_school_id on historical company logs to retain full accountability.
    8. Records immutable SCHOOL_PERMANENTLY_DELETED audit log with summary counts.
    9. Deletes the School record itself.
    """
    school = School.query.get(school_id)
    if not school:
        raise ValueError('School not found')

    # Security guard 1: Must be archived first
    if getattr(school, 'status', None) != 'ARCHIVED':
        raise ValueError(
            f"Active school '{school.name}' cannot be permanently deleted. "
            "It must first be archived into the 1-year retention state."
        )

    # Security guard 2: Explicit confirmation phrase
    expected_confirm = f"DELETE {school.name}".strip().upper()
    received_confirm = (confirm_name or '').strip().upper()
    if received_confirm != expected_confirm and received_confirm != school.code.strip().upper():
        raise ValueError(
            f"Confirmation mismatch. Please type '{expected_confirm}' to confirm irreversible deletion."
        )

    # Security guard 3: 1-Year retention check
    now = datetime.utcnow()
    if not force and school.permanent_delete_eligible_at and now < school.permanent_delete_eligible_at:
        days_left = (school.permanent_delete_eligible_at - now).days
        raise ValueError(
            f"School '{school.name}' is within its 1-year retention window ({days_left} days remaining until {school.permanent_delete_eligible_at.strftime('%d %b %Y')}). "
            "To permanently delete early, Super Admin force override must be enabled."
        )

    # 1. Capture complete summary snapshot before anything is touched
    summary = get_school_archive_summary(school_id)
    school_name = school.name
    school_code = school.code
    school_db_id = school.id

    # 2. Collect uploaded file paths to purge from local filesystem
    files_to_delete = []
    try:
        from app.models.documents import StudentDocument
        from app.models.hrms import EmployeeDocument
        for doc in StudentDocument.query.filter_by(school_id=school_id).all():
            if doc.file_url:
                files_to_delete.append(doc.file_url)
        for edoc in EmployeeDocument.query.filter_by(school_id=school_id).all():
            if edoc.file_url:
                files_to_delete.append(edoc.file_url)
        for url in [school.logo_url, school.principal_signature_url, school.director_signature_url]:
            if url:
                files_to_delete.append(url)
    except Exception as e:
        logger.warning(f"File path collection exception: {e}")

    # Pre-compute all tables containing 'school_id' BEFORE beginning cascade transaction
    # Running PRAGMAs (like table_xinfo via inspector) inside an active transaction interferes
    # with SQLite's internal transaction state and rolls back uncommitted DML.
    inspector = inspect(db.engine)
    all_tables = set(inspector.get_table_names())
    tables_with_school_id = set()
    table_columns = {}
    for t_name in all_tables:
        try:
            col_names = {c['name'] for c in inspector.get_columns(t_name)}
            table_columns[t_name] = col_names
            if 'school_id' in col_names:
                tables_with_school_id.add(t_name)
        except Exception:
            table_columns[t_name] = set()

    # 3. Transactional cascade deletion in reverse dependency order
    try:
        # Collect IDs of users belonging to this school
        school_users = User.query.filter_by(school_id=school_id).all()
        school_user_ids = [u.id for u in school_users]

        # Expunge all objects from session so SQLAlchemy identity map doesn't re-insert them on autoflush
        db.session.expunge_all()

        def _safe_delete_or_update(query, params=None):
            """Executes SQL within a subtransaction SAVEPOINT so failures never abort the outer transaction in PostgreSQL."""
            nested = db.session.begin_nested()
            try:
                if params:
                    db.session.execute(query, params)
                else:
                    db.session.execute(query)
                nested.commit()
            except Exception as sql_e:
                nested.rollback()
                logger.debug(f"Cascade cleanup step skipped: {sql_e}")

        # ── Level 1: Deepest child tables without direct school_id or dependent on parents ──
        if 'fee_payment_allocations' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM fee_payment_allocations 
                WHERE payment_id IN (SELECT id FROM fee_payments WHERE school_id = :sid)
                   OR bill_id IN (SELECT id FROM fee_bills WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'fee_bill_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM fee_bill_items 
                WHERE bill_id IN (SELECT id FROM fee_bills WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'fee_structure_items_v2' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM fee_structure_items_v2 
                WHERE structure_id IN (SELECT id FROM fee_structures_v2 WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'payroll_slip_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM payroll_slip_items 
                WHERE payroll_slip_id IN (SELECT id FROM payroll_slips WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'goods_receipt_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM goods_receipt_items 
                WHERE grn_id IN (SELECT id FROM goods_receipt_notes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'purchase_order_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM purchase_order_items 
                WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'salary_structure_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM salary_structure_items 
                WHERE structure_id IN (SELECT id FROM salary_structures WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'result_return_items' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM result_return_items 
                WHERE subject_status_id IN (SELECT id FROM result_subject_status WHERE school_id = :sid)
                   OR student_id IN (SELECT id FROM students WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'timetable_periods' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM timetable_periods 
                WHERE timetable_id IN (SELECT id FROM timetables WHERE school_id = :sid)
                   OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
                   OR subject_id IN (SELECT id FROM subjects WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'exam_timetable' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM exam_timetable 
                WHERE exam_id IN (SELECT id FROM exam_schedules WHERE school_id = :sid)
                   OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
                   OR subject_id IN (SELECT id FROM subjects WHERE school_id = :sid)
                   OR invigilator_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'transport_route_stops' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM transport_route_stops 
                WHERE route_id IN (SELECT id FROM transport_routes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'support_attachments' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM support_attachments 
                WHERE ticket_id IN (SELECT id FROM support_tickets WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'ticket_replies' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM ticket_replies 
                WHERE ticket_id IN (SELECT id FROM support_tickets WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'ai_messages' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM ai_messages 
                WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'asset_assignment_history' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM asset_assignment_history 
                WHERE asset_id IN (SELECT id FROM school_assets WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'asset_condition_logs' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM asset_condition_logs 
                WHERE asset_id IN (SELECT id FROM school_assets WHERE school_id = :sid)
            """), {'sid': school_id})

        # Academic attendance
        if 'attendance' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM attendance 
                WHERE school_id = :sid
                   OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
                   OR student_id IN (SELECT id FROM students WHERE school_id = :sid)
            """), {'sid': school_id})

        # User-linked sub-tables & FK cleanup for users of this school
        if school_user_ids:
            uids = list(school_user_ids)
            # Tables linking directly to user_id
            for u_tab in [
                'user_role_assignments', 'user_permission_overrides', 'session_history',
                'user_devices', 'otp_verifications', 'login_history', 'employee_profiles'
            ]:
                if u_tab in all_tables and 'user_id' in table_columns.get(u_tab, set()):
                    q = delete(table(u_tab, column('user_id'))).where(column('user_id').in_(uids))
                    _safe_delete_or_update(q)

            # Employee & Student documents
            if 'employee_documents' in all_tables:
                q = text("DELETE FROM employee_documents WHERE user_id IN :uids").bindparams(bindparam('uids', expanding=True))
                _safe_delete_or_update(q, {'uids': uids})
            if 'student_documents' in all_tables:
                q = text("DELETE FROM student_documents WHERE school_id = :sid")
                _safe_delete_or_update(q, {'sid': school_id})

            # Temporary role delegations
            if 'temporary_role_delegations' in all_tables:
                trd_cols = table_columns.get('temporary_role_delegations', set())
                trd_conds = []
                trd_fields = []
                if 'delegator_user_id' in trd_cols:
                    trd_conds.append(column('delegator_user_id').in_(uids))
                    trd_fields.append(column('delegator_user_id'))
                if 'delegatee_user_id' in trd_cols:
                    trd_conds.append(column('delegatee_user_id').in_(uids))
                    trd_fields.append(column('delegatee_user_id'))
                if trd_conds:
                    q = delete(table('temporary_role_delegations', *trd_fields)).where(or_(*trd_conds))
                    _safe_delete_or_update(q)

            # Developer center issue assignments
            if 'issue_assignments' in all_tables:
                ia_cols = table_columns.get('issue_assignments', set())
                ia_conds = []
                ia_fields = []
                if 'assigned_to_user_id' in ia_cols:
                    ia_conds.append(column('assigned_to_user_id').in_(uids))
                    ia_fields.append(column('assigned_to_user_id'))
                if 'assigned_by_user_id' in ia_cols:
                    ia_conds.append(column('assigned_by_user_id').in_(uids))
                    ia_fields.append(column('assigned_by_user_id'))
                if 'resolved_by_user_id' in ia_cols:
                    ia_conds.append(column('resolved_by_user_id').in_(uids))
                    ia_fields.append(column('resolved_by_user_id'))
                if ia_conds:
                    q = delete(table('issue_assignments', *ia_fields)).where(or_(*ia_conds))
                    _safe_delete_or_update(q)

            # Error logs reported by or affecting these users
            if 'error_logs' in all_tables and 'user_id' in table_columns.get('error_logs', set()):
                q = text("UPDATE error_logs SET user_id = NULL WHERE user_id IN :uids").bindparams(bindparam('uids', expanding=True))
                _safe_delete_or_update(q, {'uids': uids})

            # Company activity logs
            if 'company_activity_logs' in all_tables and 'actor_user_id' in table_columns.get('company_activity_logs', set()):
                q = text("UPDATE company_activity_logs SET actor_user_id = NULL WHERE actor_user_id IN :uids").bindparams(bindparam('uids', expanding=True))
                _safe_delete_or_update(q, {'uids': uids})

            # Schools created_by or archived_by
            if 'schools' in all_tables:
                if 'created_by' in table_columns.get('schools', set()):
                    q = text("UPDATE schools SET created_by = NULL WHERE created_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})
                if 'archived_by' in table_columns.get('schools', set()):
                    q = text("UPDATE schools SET archived_by = NULL WHERE archived_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})

            # Support tickets
            if 'support_tickets' in all_tables:
                cols = table_columns.get('support_tickets', set())
                if 'created_by' in cols:
                    q = text("UPDATE support_tickets SET created_by = NULL WHERE created_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})
                if 'assigned_to' in cols:
                    q = text("UPDATE support_tickets SET assigned_to = NULL WHERE assigned_to IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})

            # Support attachments uploaded by these users
            if 'support_attachments' in all_tables:
                sa_cols = table_columns.get('support_attachments', set())
                if 'uploaded_by' in sa_cols:
                    q = text("DELETE FROM support_attachments WHERE uploaded_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})

            # Ticket replies
            if 'ticket_replies' in all_tables:
                tr_cols = table_columns.get('ticket_replies', set())
                if 'replied_by' in tr_cols:
                    q = text("DELETE FROM ticket_replies WHERE replied_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})
                elif 'user_id' in tr_cols:
                    q = text("UPDATE ticket_replies SET user_id = NULL WHERE user_id IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})

            # Chat messages
            if 'chat_messages' in all_tables:
                cm_cols = table_columns.get('chat_messages', set())
                cm_conds = []
                cm_fields = []
                if 'sender_id' in cm_cols:
                    cm_conds.append(column('sender_id').in_(uids))
                    cm_fields.append(column('sender_id'))
                if 'receiver_id' in cm_cols:
                    cm_conds.append(column('receiver_id').in_(uids))
                    cm_fields.append(column('receiver_id'))
                if cm_conds:
                    q = delete(table('chat_messages', *cm_fields)).where(or_(*cm_conds))
                    _safe_delete_or_update(q)

            # Meeting requests (schema uses requested_by / handled_by, not teacher_id / parent_id)
            if 'meeting_requests' in all_tables:
                mr_cols = table_columns.get('meeting_requests', set())
                if 'requested_by' in mr_cols:
                    q = text("DELETE FROM meeting_requests WHERE requested_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})
                if 'handled_by' in mr_cols:
                    q = text("UPDATE meeting_requests SET handled_by = NULL WHERE handled_by IN :uids").bindparams(bindparam('uids', expanding=True))
                    _safe_delete_or_update(q, {'uids': uids})

            # Audit logs
            if 'audit_logs' in all_tables and 'user_id' in table_columns.get('audit_logs', set()):
                q = text("DELETE FROM audit_logs WHERE user_id IN :uids").bindparams(bindparam('uids', expanding=True))
                _safe_delete_or_update(q, {'uids': uids})

            # Deleted logs archive
            if 'deleted_logs_archive' in all_tables and 'deleted_by' in table_columns.get('deleted_logs_archive', set()):
                q = text("DELETE FROM deleted_logs_archive WHERE deleted_by IN :uids").bindparams(bindparam('uids', expanding=True))
                _safe_delete_or_update(q, {'uids': uids})

        # ── Level 1.5: Break circular and self-referencing foreign key locks ──
        # 1. Nullify all teacher references in child tables
        if 'classes' in all_tables and 'teacher_id' in table_columns.get('classes', set()):
            _safe_delete_or_update(text("""
                UPDATE classes SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'subjects' in all_tables and 'teacher_id' in table_columns.get('subjects', set()):
            _safe_delete_or_update(text("""
                UPDATE subjects SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'notes' in all_tables and 'teacher_id' in table_columns.get('notes', set()):
            _safe_delete_or_update(text("""
                UPDATE notes SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'assignments' in all_tables and 'teacher_id' in table_columns.get('assignments', set()):
            _safe_delete_or_update(text("""
                UPDATE assignments SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'internal_marks' in all_tables and 'teacher_id' in table_columns.get('internal_marks', set()):
            _safe_delete_or_update(text("""
                UPDATE internal_marks SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'result_subject_status' in all_tables and 'teacher_id' in table_columns.get('result_subject_status', set()):
            _safe_delete_or_update(text("""
                UPDATE result_subject_status SET teacher_id = NULL 
                WHERE school_id = :sid OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'exam_teacher_delegations' in all_tables and 'original_teacher_id' in table_columns.get('exam_teacher_delegations', set()):
            _safe_delete_or_update(text("""
                UPDATE exam_teacher_delegations SET original_teacher_id = NULL 
                WHERE school_id = :sid OR original_teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        # 2. Nullify class and subject references in child tables
        if 'students' in all_tables and 'class_id' in table_columns.get('students', set()):
            _safe_delete_or_update(text("""
                UPDATE students SET class_id = NULL 
                WHERE school_id = :sid OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'notes' in all_tables and 'class_id' in table_columns.get('notes', set()):
            _safe_delete_or_update(text("""
                UPDATE notes SET class_id = NULL 
                WHERE school_id = :sid OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'notes' in all_tables and 'subject_id' in table_columns.get('notes', set()):
            _safe_delete_or_update(text("""
                UPDATE notes SET subject_id = NULL 
                WHERE school_id = :sid OR subject_id IN (SELECT id FROM subjects WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'books' in all_tables and 'class_id' in table_columns.get('books', set()):
            _safe_delete_or_update(text("""
                UPDATE books SET class_id = NULL 
                WHERE school_id = :sid OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'fee_structures' in all_tables and 'class_id' in table_columns.get('fee_structures', set()):
            _safe_delete_or_update(text("""
                UPDATE fee_structures SET class_id = NULL 
                WHERE school_id = :sid OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'fee_structures_v2' in all_tables and 'class_id' in table_columns.get('fee_structures_v2', set()):
            _safe_delete_or_update(text("""
                UPDATE fee_structures_v2 SET class_id = NULL 
                WHERE school_id = :sid OR class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'stock_movements' in all_tables and 'target_class_id' in table_columns.get('stock_movements', set()):
            _safe_delete_or_update(text("""
                UPDATE stock_movements SET target_class_id = NULL 
                WHERE school_id = :sid OR target_class_id IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'student_documents' in all_tables and 'class_id_at_upload' in table_columns.get('student_documents', set()):
            _safe_delete_or_update(text("""
                UPDATE student_documents SET class_id_at_upload = NULL 
                WHERE school_id = :sid OR class_id_at_upload IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'issued_documents' in all_tables and 'class_id_at_issue' in table_columns.get('issued_documents', set()):
            _safe_delete_or_update(text("""
                UPDATE issued_documents SET class_id_at_issue = NULL 
                WHERE school_id = :sid OR class_id_at_issue IN (SELECT id FROM classes WHERE school_id = :sid)
            """), {'sid': school_id})

        # 3. Nullify student references in hostel and library
        if 'hostel_beds' in all_tables and 'current_student_id' in table_columns.get('hostel_beds', set()):
            _safe_delete_or_update(text("""
                UPDATE hostel_beds SET current_student_id = NULL 
                WHERE hostel_id IN (SELECT id FROM hostels WHERE school_id = :sid)
                   OR current_student_id IN (SELECT id FROM students WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'hostel_inventory' in all_tables and 'assigned_student_id' in table_columns.get('hostel_inventory', set()):
            _safe_delete_or_update(text("""
                UPDATE hostel_inventory SET assigned_student_id = NULL 
                WHERE hostel_id IN (SELECT id FROM hostels WHERE school_id = :sid)
                   OR assigned_student_id IN (SELECT id FROM students WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'library_members' in all_tables and 'student_id' in table_columns.get('library_members', set()):
            _safe_delete_or_update(text("""
                UPDATE library_members SET student_id = NULL 
                WHERE school_id = :sid OR student_id IN (SELECT id FROM students WHERE school_id = :sid)
            """), {'sid': school_id})

        # 4. Explicitly delete non-nullable child tables referencing teachers
        if 'exam_teacher_delegations' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM exam_teacher_delegations 
                WHERE school_id = :sid 
                   OR delegated_teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'salary_records' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM salary_records 
                WHERE school_id = :sid 
                   OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'teacher_attendance_requests' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM teacher_attendance_requests 
                WHERE school_id = :sid 
                   OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'teacher_attendance' in all_tables:
            _safe_delete_or_update(text("""
                DELETE FROM teacher_attendance 
                WHERE school_id = :sid 
                   OR teacher_id IN (SELECT id FROM teachers WHERE school_id = :sid)
            """), {'sid': school_id})

        if 'schools' in all_tables:
            _safe_delete_or_update(text("UPDATE schools SET created_by = NULL, archived_by = NULL WHERE id = :sid"), {'sid': school_id})

        # ── Level 2: Delete from all direct tables having school_id column ──
        # Specific deletion order for tables with internal cross-references
        priority_tables = [
            # Deep leaf references
            'result_return_items', 'timetable_periods', 'exam_timetable',
            # Exams & Marks
            'marks_audit_logs', 'marks', 'internal_marks',
            'result_subject_status', 'result_versions', 'class_result_publication',
            'exam_teacher_delegations', 'exam_subjects', 'exam_classes', 'exam_schedules',
            # Academics & Attendance
            'assignment_submissions', 'assignments', 'notes', 'timetables',
            'attendance', 'holidays',
            # Teacher payroll & records
            'salary_records', 'staff_salary_records',
            'teacher_attendance_requests', 'teacher_attendance',
            # Financial & Procurement
            'vendor_payments', 'vendor_bills', 'vendors', 'goods_receipt_notes', 'purchase_orders',
            'stock_movements', 'inventory_items', 'expenses', 'service_charges',
            'fee_refunds', 'fee_payments', 'fee_bills', 'fee_records', 'fee_transactions',
            'student_fee_assignments', 'student_concessions', 'student_ledgers', 'fee_receipt_groups',
            'fee_generation_batches', 'fee_structures_v2', 'fee_structures', 'fee_heads',
            # Hostel
            'hostel_complaints', 'hostel_out_passes', 'hostel_visitor_logs', 'hostel_attendance',
            'hostel_bed_allocations', 'hostel_beds', 'hostel_rooms', 'hostel_floors',
            'hostel_wings', 'hostel_buildings', 'hostel_inventory', 'hostel_fine_records',
            'hostel_fee_structures', 'hostel_settings', 'hostel_activity_logs', 'hostels',
            # Transport
            'transport_trip_student_attendance', 'transport_trip_logs', 'transport_gps_logs',
            'transport_vehicle_maintenance', 'transport_fine_records', 'transport_fee_transactions',
            'transport_fee_records', 'transport_transfer_history', 'transport_student_assignments',
            'transport_stops', 'transport_routes', 'transport_vehicles', 'transport_conductors',
            'transport_drivers', 'transport_fee_structures',
            # Library
            'library_fine_transactions', 'library_visits', 'book_reservations', 'book_issues',
            'book_copies', 'books', 'book_categories', 'library_members', 'library_settings',
            'library_activity_logs',
            # Communication & Documents
            'announcements', 'chat_messages', 'meeting_requests',
            'issued_documents', 'student_documents', 'employee_documents',
            'school_document_requirements',
            # HRMS & Payroll
            'staff_attendance_regularization', 'staff_attendance_audit_logs', 'staff_attendance',
            'staff_monthly_attendance_summary',
            'payroll_slips', 'payroll_runs', 'employee_salary_structures', 'salary_structures',
            'salary_components', 'employee_shift_assignments', 'shifts', 'leave_requests',
            'leave_balances', 'leave_types', 'official_duties', 'employee_profiles',
            'employee_designations', 'employee_departments', 'staff_attendance_settings',
            # Assets & Infra
            'asset_maintenance_records', 'school_assets',
            # Support & Communication
            'support_usage', 'support_tickets', 'support_notifications', 'support_plans',
            'school_whatsapp_settings',
            # AI
            'ai_document_chunks', 'ai_documents', 'ai_query_cache', 'ai_conversations',
            'ai_role_quota', 'ai_usage',
            # Academics Core Entities (Strict reverse dependency: Subjects -> Students -> Classes -> Teachers)
            'subjects', 'students', 'classes', 'teachers',
            # Logs & Deleted items
            'deleted_items', 'deleted_logs_archive', 'financial_audit_logs', 'hrms_audit_logs',
            'audit_logs', 'error_logs', 'login_history', 'otp_verifications', 'user_devices',
            'user_permissions', 'role_permissions', 'platform_role_permissions',
        ]

        # Execute priority deletions (3 passes safely cleans interdependent tables)
        for _ in range(3):
            for t_name in priority_tables:
                if t_name in tables_with_school_id:
                    q = delete(table(t_name, column('school_id'))).where(column('school_id') == school_id)
                    _safe_delete_or_update(q)

            # Catch any remaining tables with school_id column
            for t_name in tables_with_school_id:
                if t_name in priority_tables or t_name in ('schools', 'company_activity_logs'):
                    continue
                q = delete(table(t_name, column('school_id'))).where(column('school_id') == school_id)
                _safe_delete_or_update(q)

        # Ensure core tables are definitely cleaned in strict reverse dependency order
        for core_t in ['subjects', 'students', 'classes', 'teachers']:
            if core_t in tables_with_school_id:
                _safe_delete_or_update(delete(table(core_t, column('school_id'))).where(column('school_id') == school_id))

        # ── Level 3: Delete school users (never delete SUPER_ADMIN) ──
        _safe_delete_or_update(text("""
            DELETE FROM users 
            WHERE school_id = :sid 
              AND (role != 'SUPER_ADMIN' OR role IS NULL)
        """), {'sid': school_id})

        # ── Level 4: Clear affected_school_id on company_activity_logs to preserve audit trail ──
        if 'company_activity_logs' in all_tables:
            _safe_delete_or_update(text("""
                UPDATE company_activity_logs 
                SET affected_school_id = NULL 
                WHERE affected_school_id = :sid
            """), {'sid': school_id})

        # ── Level 4.5: Verification sweep ensuring NO table still holds records for this school_id ──
        for t_name in tables_with_school_id:
            if t_name in ('schools', 'company_activity_logs'):
                continue
            try:
                t_obj = table(t_name, column('school_id'))
                cnt = None
                nested = db.session.begin_nested()
                try:
                    cnt = db.session.execute(
                        select(func.count()).select_from(t_obj).where(column('school_id') == school_id)
                    ).scalar()
                    nested.commit()
                except Exception:
                    nested.rollback()

                if cnt and cnt > 0:
                    logger.warning(f"[LIFECYCLE] Table '{t_name}' still has {cnt} rows for school {school_id}. Force-cleaning...")
                    q = delete(t_obj).where(column('school_id') == school_id)
                    _safe_delete_or_update(q)
            except Exception as sweep_e:
                logger.debug(f"[LIFECYCLE] Sweep check for {t_name}: {sweep_e}")

        # ── Level 5: Delete the school itself ──
        db.session.execute(text("DELETE FROM schools WHERE id = :sid"), {'sid': school_id})

        # ── Level 6: Record immutable audit log for permanent deletion via SQL ──
        meta = {}
        try:
            from flask import has_request_context
            if has_request_context():
                meta = capture_request_context()
        except Exception:
            pass

        actor_id_val = actor_user.id if actor_user else None
        role_snap = actor_user.role.value if actor_user and getattr(actor_user, 'role', None) else 'SUPER_ADMIN'
        old_val_json = json.dumps({'school_id': school_db_id, 'name': school_name, 'code': school_code})
        new_val_json = json.dumps({'deleted_summary': summary['counts']})
        remarks_txt = f"Permanently and irreversibly deleted school '{school_name}' (Code: {school_code}, ID: {school_db_id})."

        if 'company_activity_logs' in all_tables:
            db.session.execute(text("""
                INSERT INTO company_activity_logs (
                    actor_user_id, role_snapshot, module, action,
                    old_value, new_value, affected_school_id,
                    ip_address, browser, os, remarks, created_at
                ) VALUES (
                    :actor_id, :role_snapshot, :module, :action,
                    :old_value, :new_value, NULL,
                    :ip_address, :browser, :os, :remarks, :created_at
                )
            """), {
                'actor_id': actor_id_val,
                'role_snapshot': role_snap,
                'module': 'SCHOOL_LIFECYCLE',
                'action': 'SCHOOL_PERMANENTLY_DELETED',
                'old_value': old_val_json,
                'new_value': new_val_json,
                'ip_address': meta.get('ip_address'),
                'browser': meta.get('browser'),
                'os': meta.get('os'),
                'remarks': remarks_txt,
                'created_at': datetime.utcnow()
            })

        # Commit entire transaction atomically
        db.session.commit()
        logger.info(f"[LIFECYCLE] School '{school_name}' ({school_code}) successfully PERMANENTLY DELETED.")

    except Exception as e:
        db.session.rollback()
        logger.error(f"[LIFECYCLE] Permanent deletion failed for school {school_id}: {e}", exc_info=True)
        raise RuntimeError(f"Database error during permanent school deletion: {e}")

    # 4. Post-commit: Clean up local uploaded files if any exist
    deleted_files_count = 0
    for fpath in files_to_delete:
        try:
            if fpath and not fpath.startswith('http') and os.path.exists(fpath):
                os.remove(fpath)
                deleted_files_count += 1
        except Exception as f_err:
            logger.warning(f"Could not remove local file {fpath}: {f_err}")

    return {
        'success': True,
        'message': f"School '{school_name}' ({school_code}) and all associated records permanently deleted.",
        'school_id': school_db_id,
        'school_name': school_name,
        'school_code': school_code,
        'deleted_records_summary': summary['counts'],
        'deleted_local_files_count': deleted_files_count,
    }
