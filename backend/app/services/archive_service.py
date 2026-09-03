"""
Archive & Deletion Management Service
EduERP / OnePlatform360 — Centralized Soft-Delete, 1-Year Retention, Recovery, & Safe Permanent Deletion
"""

from app import db
from app.models.academic import Student, Teacher, Class, Subject, Attendance, Marks
from app.models.user import User
from app.models.deleted_item import DeletedItem, DeletedItemType, DeletedItemStatus
from app.models.audit import AuditLog
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


def soft_delete_student(student_id, school_id, actor_user, reason=''):
    """
    Soft deletes student:
    - Moves record to DELETED ITEMS with 1-year retention.
    - Disappears immediately from active rosters (classes, attendance, hostel beds, transport, library).
    - Preserves recoverable profile data.
    """
    student = Student.query.filter_by(id=student_id, school_id=school_id).first()
    if not student:
        raise ValueError('Student not found')
    if getattr(student, 'is_deleted', False):
        raise ValueError('Student is already deleted/archived')

    user = student.user

    # 1. Mark soft delete on Student & User
    student.is_deleted = True
    student.deleted_at = datetime.utcnow()
    student.deleted_by = actor_user.id if actor_user else None
    student.delete_reason = reason

    if user:
        user.is_active = False
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        user.deleted_by = actor_user.id if actor_user else None
        user.delete_reason = reason
        user.plain_password_temp = None  # Security: clear temp credentials

    # 2. Deactivate active operational rosters (disappear from operational lists)
    # A. Hostel — Vacate active bed assignment so the bed becomes vacant for other students
    try:
        from app.models.hostel import HostelBed, HostelBedAllocation
        HostelBed.query.filter_by(current_student_id=student_id).update(
            {'current_student_id': None, 'status': 'VACANT'}, synchronize_session=False
        )
        HostelBedAllocation.query.filter_by(student_id=student_id, status='ACTIVE').update(
            {'status': 'VACATED'}, synchronize_session=False
        )
    except Exception as e:
        logger.warning(f"Hostel deactivation warning for student {student_id}: {e}")

    # B. Transport — Mark student transport inactive
    try:
        from app.models.transport_student import StudentTransport
        StudentTransport.query.filter_by(student_id=student_id).update(
            {'status': 'INACTIVE'}, synchronize_session=False
        )
    except Exception as e:
        logger.warning(f"Transport deactivation warning for student {student_id}: {e}")

    # C. Library — Mark membership inactive
    if user:
        try:
            from app.models.library import LibraryMember
            LibraryMember.query.filter_by(user_id=user.id).update(
                {'status': 'INACTIVE'}, synchronize_session=False
            )
        except Exception as e:
            logger.warning(f"Library deactivation warning for student {student_id}: {e}")

    # 3. Create lightweight DeletedItem Archive Record (1-Year Retention)
    class_name = f"{student.class_ref.name} {student.class_ref.section}" if student.class_ref else ''
    section = student.class_ref.section if student.class_ref else ''
    now = datetime.utcnow()
    auto_delete = now + timedelta(days=365)

    recovery_data = {
        'roll_number':       student.roll_number,
        'father_name':       student.father_name,
        'mother_name':       student.mother_name,
        'parent_phone':      student.parent_phone,
        'parent_email':      student.parent_email,
        'dob':               student.dob.isoformat() if student.dob else None,
        'gender':            student.gender,
        'original_class_id': student.class_id,
        'session':           student.session,
        'email':             user.email if user else None,
    }

    archive_item = DeletedItem(
        school_id=school_id,
        item_type=DeletedItemType.STUDENT.value,
        original_id=student.id,
        original_user_id=user.id if user else None,
        name=user.name if user else f"Student #{student.id}",
        identifier=student.admission_no or '',
        class_id=student.class_id,
        class_name=class_name,
        section=section,
        session=student.session or '',
        student_type='Student',
        recovery_data=recovery_data,
        deleted_at=now,
        deleted_by=actor_user.id if actor_user else None,
        deleted_by_name=actor_user.name if actor_user else 'Principal',
        delete_reason=reason or 'Soft deleted by Principal',
        auto_delete_at=auto_delete,
        status=DeletedItemStatus.ARCHIVED.value,
    )
    db.session.add(archive_item)

    # 4. Audit Log
    try:
        import json
        audit = AuditLog(
            school_id=school_id,
            user_id=actor_user.id if actor_user else None,
            action='DELETE',
            module='DELETED_ITEMS',
            new_value=json.dumps({'message': f"Soft-deleted student {archive_item.name} (Adm: {student.admission_no}) to Deleted Items. Reason: {reason}"}),
            ip_address='127.0.0.1'
        )
        db.session.add(audit)
    except Exception as e:
        logger.warning(f"Audit log skipped: {e}")

    db.session.commit()
    return archive_item


def soft_delete_teacher(teacher_id, school_id, actor_user, reason=''):
    """
    Soft deletes teacher:
    - Moves to Deleted Items with 1-year retention.
    - Unlinks from active classes and subjects.
    - Disappears from active teacher rosters.
    """
    teacher = Teacher.query.filter_by(id=teacher_id, school_id=school_id).first()
    if not teacher:
        raise ValueError('Teacher not found')
    if getattr(teacher, 'is_deleted', False):
        raise ValueError('Teacher is already deleted/archived')

    user = teacher.user

    # 1. Mark soft delete
    teacher.is_deleted = True
    teacher.deleted_at = datetime.utcnow()
    teacher.deleted_by = actor_user.id if actor_user else None
    teacher.delete_reason = reason

    if user:
        user.is_active = False
        user.is_deleted = True
        user.deleted_at = datetime.utcnow()
        user.deleted_by = actor_user.id if actor_user else None
        user.delete_reason = reason
        user.plain_password_temp = None

    # 2. Unlink from active classes and subjects so active curriculum is not blocked
    Class.query.filter_by(teacher_id=teacher_id).update({'teacher_id': None}, synchronize_session=False)
    Subject.query.filter_by(teacher_id=teacher_id).update({'teacher_id': None}, synchronize_session=False)

    # 3. Create DeletedItem archive record
    now = datetime.utcnow()
    auto_delete = now + timedelta(days=365)
    name = user.name if user else f"Teacher #{teacher.id}"

    archive_item = DeletedItem(
        school_id=school_id,
        item_type=DeletedItemType.TEACHER.value,
        original_id=teacher.id,
        original_user_id=user.id if user else None,
        name=name,
        identifier=teacher.employee_id or '',
        department=teacher.department or '',
        designation=teacher.designation or 'Teacher',
        role='TEACHER',
        recovery_data={
            'employee_id': teacher.employee_id,
            'department':  teacher.department,
            'designation': teacher.designation,
            'salary':      teacher.salary,
            'email':       user.email if user else None,
            'phone':       user.phone if user else None,
        },
        deleted_at=now,
        deleted_by=actor_user.id if actor_user else None,
        deleted_by_name=actor_user.name if actor_user else 'Principal',
        delete_reason=reason or 'Soft deleted by Principal',
        auto_delete_at=auto_delete,
        status=DeletedItemStatus.ARCHIVED.value,
    )
    db.session.add(archive_item)

    # 4. Audit Log
    try:
        import json
        audit = AuditLog(
            school_id=school_id,
            user_id=actor_user.id if actor_user else None,
            action='DELETE',
            module='DELETED_ITEMS',
            new_value=json.dumps({'message': f"Soft-deleted teacher {name} (Emp: {teacher.employee_id}) to Deleted Items. Reason: {reason}"}),
            ip_address='127.0.0.1'
        )
        db.session.add(audit)
    except Exception as e:
        logger.warning(f"Audit log skipped: {e}")

    db.session.commit()
    return archive_item


def soft_delete_staff(user_id, school_id, actor_user, reason=''):
    """
    Soft deletes non-teaching staff account:
    - Moves to Deleted Items with 1-year retention.
    - Disables login and active access.
    """
    user = User.query.filter_by(id=user_id, school_id=school_id).first()
    if not user:
        raise ValueError('Staff member not found')
    if actor_user and user.id == actor_user.id:
        raise ValueError('Cannot delete your own account')
    if getattr(user, 'is_deleted', False):
        raise ValueError('Staff member is already deleted/archived')

    # 1. Mark soft delete
    user.is_active = False
    user.is_deleted = True
    user.deleted_at = datetime.utcnow()
    user.deleted_by = actor_user.id if actor_user else None
    user.delete_reason = reason
    user.plain_password_temp = None

    # Revoke active delegations
    try:
        from app.models.rbac import RoleDelegation
        RoleDelegation.query.filter_by(delegatee_user_id=user.id, status='ACTIVE').update(
            {'status': 'REVOKED'}, synchronize_session=False
        )
    except Exception as e:
        logger.warning(f"Delegation revoke warning for user {user.id}: {e}")

    # 2. Create DeletedItem archive record
    now = datetime.utcnow()
    auto_delete = now + timedelta(days=365)
    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)

    archive_item = DeletedItem(
        school_id=school_id,
        item_type=DeletedItemType.STAFF.value,
        original_id=user.id,
        original_user_id=user.id,
        name=user.name,
        identifier=user.employee_id or '',
        department=user.department or '',
        designation=user.designation or role_str,
        role=role_str,
        recovery_data={
            'employee_id': user.employee_id,
            'department':  user.department,
            'designation': user.designation,
            'role':        role_str,
            'email':       user.email,
            'phone':       user.phone,
        },
        deleted_at=now,
        deleted_by=actor_user.id if actor_user else None,
        deleted_by_name=actor_user.name if actor_user else 'Principal',
        delete_reason=reason or 'Soft deleted by Principal',
        auto_delete_at=auto_delete,
        status=DeletedItemStatus.ARCHIVED.value,
    )
    db.session.add(archive_item)

    # 3. Audit Log
    try:
        import json
        audit = AuditLog(
            school_id=school_id,
            user_id=actor_user.id if actor_user else None,
            action='DELETE',
            module='DELETED_ITEMS',
            new_value=json.dumps({'message': f"Soft-deleted staff member {user.name} ({role_str}) to Deleted Items. Reason: {reason}"}),
            ip_address='127.0.0.1'
        )
        db.session.add(audit)
    except Exception as e:
        logger.warning(f"Audit log skipped: {e}")

    db.session.commit()
    return archive_item


def recover_deleted_item(item_id, school_id, actor_user):
    """
    Recovers an archived Student, Teacher, or Staff back to active status:
    - Restores active flags.
    - For students: validates whether previous class still exists.
      If old class was deleted, restores student without class and warns Principal.
    - Prevents duplicate / broken entries.
    """
    item = DeletedItem.query.filter_by(id=item_id, school_id=school_id).first()
    if not item:
        raise ValueError('Deleted item not found')
    if item.status != DeletedItemStatus.ARCHIVED.value:
        raise ValueError(f"Item cannot be recovered because its status is '{item.status}'")

    warning_message = None

    if item.item_type == DeletedItemType.STUDENT.value:
        student = Student.query.filter_by(id=item.original_id, school_id=school_id).first()
        if not student:
            raise ValueError('Original student record no longer exists in database')

        # Check if original class still exists
        if item.class_id:
            cls = Class.query.filter_by(id=item.class_id, school_id=school_id).first()
            if cls:
                student.class_id = cls.id
            else:
                student.class_id = None
                warning_message = f"Student '{student.user.name if student.user else student.id}' restored, but original Class ({item.class_name}) no longer exists. Please assign a new class."
        else:
            student.class_id = None

        student.is_deleted = False
        student.deleted_at = None
        student.deleted_by = None
        student.delete_reason = None

        if student.user:
            student.user.is_active = True
            student.user.is_deleted = False
            student.user.deleted_at = None
            student.user.delete_reason = None

    elif item.item_type == DeletedItemType.TEACHER.value:
        teacher = Teacher.query.filter_by(id=item.original_id, school_id=school_id).first()
        if not teacher:
            raise ValueError('Original teacher record no longer exists in database')

        teacher.is_deleted = False
        teacher.deleted_at = None
        teacher.deleted_by = None
        teacher.delete_reason = None

        if teacher.user:
            teacher.user.is_active = True
            teacher.user.is_deleted = False
            teacher.user.deleted_at = None
            teacher.user.delete_reason = None

    elif item.item_type == DeletedItemType.STAFF.value:
        user = User.query.filter_by(id=item.original_id, school_id=school_id).first()
        if not user:
            raise ValueError('Original staff user record no longer exists in database')

        user.is_active = True
        user.is_deleted = False
        user.deleted_at = None
        user.deleted_by = None
        user.delete_reason = None

    else:
        raise ValueError(f"Unknown item type: {item.item_type}")

    item.status = DeletedItemStatus.RECOVERED.value
    item.updated_at = datetime.utcnow()

    # Audit Log
    try:
        import json
        audit = AuditLog(
            school_id=school_id,
            user_id=actor_user.id if actor_user else None,
            action='UPDATE',
            module='DELETED_ITEMS',
            new_value=json.dumps({'message': f"Recovered {item.item_type} {item.name} (ID: {item.original_id}) from Deleted Items back to active."}),
            ip_address='127.0.0.1'
        )
        db.session.add(audit)
    except Exception as e:
        logger.warning(f"Audit log skipped: {e}")

    db.session.commit()
    return {
        'message': f"{item.name} recovered successfully",
        'warning': warning_message,
        'item': item.to_dict(),
    }


def _safe_exec(fn, desc=''):
    """
    Executes a database block inside a nested transaction (SAVEPOINT).
    In PostgreSQL, any failure inside a normal block aborts the entire transaction.
    A savepoint ensures that if an optional or dependent operation fails,
    only that savepoint is rolled back, and the parent transaction remains healthy.
    """
    try:
        with db.session.begin_nested():
            return fn()
    except Exception as e:
        logger.warning(f"[ArchiveSafeExec] {desc} skipped: {e}")
        return None


def permanently_purge_item(item_id, school_id, actor_user=None, confirmation_name='', force=False):
    """
    Permanently purges an archived item:
    - Requires typing confirmation name when initiated by human (Force Delete Now).
    - Checks financial history safety (Requirement #9):
      * If student has financial records (Fee bills, receipts, ledger entries, fines):
        ANONYMIZES personal profile data while keeping accounting history 100% mathematically intact!
      * If student has ZERO financial records:
        Fully removes student and user rows.
    - Cleans up non-financial module records (Hostel, Transport, Library, Attendance, Marks, Documents).
    - Sets DeletedItem.status = 'PURGED'.
    """
    item = DeletedItem.query.filter_by(id=item_id, school_id=school_id).first()
    if not item:
        raise ValueError('Deleted item not found')
    if item.status == DeletedItemStatus.PURGED.value:
        raise ValueError('Item has already been permanently deleted')

    # Confirmation validation
    if not force:
        if not confirmation_name or confirmation_name.strip().lower() != item.name.strip().lower():
            raise ValueError(f"Confirmation name mismatch. You must type '{item.name}' exactly to confirm permanent deletion.")

    now = datetime.utcnow()

    if item.item_type == DeletedItemType.STUDENT.value:
        student = Student.query.filter_by(id=item.original_id, school_id=school_id).first()
        if student:
            user = student.user
            sid = student.id

            # Check if student has financial records across Central Fees, Hostel, Transport, Library
            has_financials = _check_student_financial_history(sid)

            # Clean up non-financial operational records safely
            _cleanup_student_operational_records(student, user)

            if has_financials:
                # ── FINANCIAL RECORD SAFETY (Requirement #9): ANONYMIZE ──
                # Keep ledger / receipts intact, but scrub all personal identifying information
                student.roll_number = None
                student.dob = None
                student.address = None
                student.parent_name = None
                student.parent_phone = None
                student.parent_email = None
                student.father_name = None
                student.mother_name = None
                student.aadhar_no = None
                student.parent_aadhar_no = None
                student.photo_url = None
                student.category = 'General'
                student.religion = None
                student.guardian_name = None
                student.guardian_phone = None
                student.previous_school_name = None
                student.class_id = None
                # Free up admission_no by prefixing with ANON- so school can reuse it
                student.admission_no = f"ANON-{sid}-{now.strftime('%Y%m%d%H%M')}"
                student.is_deleted = True
                if hasattr(student, 'is_anonymized'):
                    student.is_anonymized = True

                if user:
                    user.name = f"Former Student #STU-{sid}"
                    user.email = f"anonymized_{user.id}_{now.strftime('%Y%m%d%H%M')}@eduerp.internal"
                    user.username = f"anon_stu_{user.id}_{now.strftime('%Y%m%d%H%M')}"
                    user.phone = None
                    user.is_active = False
                    user.is_deleted = True
                    if hasattr(user, 'is_anonymized'):
                        user.is_anonymized = True
                    user.plain_password_temp = None
            else:
                # ZERO financials: safe to completely hard delete
                _safe_exec(lambda: db.session.delete(student), 'delete_student')
                if user:
                    _safe_exec(lambda: db.session.delete(user), 'delete_user')

    elif item.item_type == DeletedItemType.TEACHER.value:
        teacher = Teacher.query.filter_by(id=item.original_id, school_id=school_id).first()
        if teacher:
            user = teacher.user
            # Unlink classes and subjects
            _safe_exec(lambda: Class.query.filter_by(teacher_id=teacher.id).update({'teacher_id': None}, synchronize_session=False), 'unlink_classes')
            _safe_exec(lambda: Subject.query.filter_by(teacher_id=teacher.id).update({'teacher_id': None}, synchronize_session=False), 'unlink_subjects')

            # Check if teacher has payroll/salary records
            has_payroll = _check_teacher_payroll_history(teacher.id)

            # Cleanup attendance & notes
            def _clean_teacher_ops():
                from app.models.academic import TeacherAttendance, Note
                TeacherAttendance.query.filter_by(teacher_id=teacher.id).delete(synchronize_session=False)
                if user:
                    Note.query.filter_by(uploaded_by=user.id).update({'uploaded_by': None}, synchronize_session=False)
            _safe_exec(_clean_teacher_ops, 'teacher_ops')

            if has_payroll:
                # Anonymize teacher and user
                teacher.employee_id = f"ANON-TCH-{teacher.id}-{now.strftime('%Y%m%d%H%M')}"
                teacher.is_deleted = True
                if hasattr(teacher, 'is_anonymized'):
                    teacher.is_anonymized = True
                if user:
                    user.name = f"Former Teacher #TCH-{teacher.id}"
                    user.email = f"anonymized_tch_{user.id}_{now.strftime('%Y%m%d%H%M')}@eduerp.internal"
                    user.username = f"anon_tch_{user.id}_{now.strftime('%Y%m%d%H%M')}"
                    user.phone = None
                    user.is_active = False
                    user.is_deleted = True
                    if hasattr(user, 'is_anonymized'):
                        user.is_anonymized = True
                    user.plain_password_temp = None
            else:
                _safe_exec(lambda: db.session.delete(teacher), 'delete_teacher')
                if user:
                    _safe_exec(lambda: db.session.delete(user), 'delete_teacher_user')

    elif item.item_type == DeletedItemType.STAFF.value:
        user = User.query.filter_by(id=item.original_id, school_id=school_id).first()
        if user:
            has_staff_financials = _check_staff_financial_history(user.id)
            if has_staff_financials:
                user.name = f"Former Staff #STF-{user.id}"
                user.email = f"anonymized_stf_{user.id}_{now.strftime('%Y%m%d%H%M')}@eduerp.internal"
                user.username = f"anon_stf_{user.id}_{now.strftime('%Y%m%d%H%M')}"
                user.employee_id = f"ANON-STF-{user.id}-{now.strftime('%Y%m%d%H%M')}"
                user.phone = None
                user.is_active = False
                user.is_deleted = True
                if hasattr(user, 'is_anonymized'):
                    user.is_anonymized = True
                user.plain_password_temp = None
            else:
                _safe_exec(lambda: db.session.delete(user), 'delete_staff_user')

    item.status = DeletedItemStatus.PURGED.value
    if hasattr(item, 'purged_at'):
        item.purged_at = now
    item.updated_at = now

    # Audit Log (wrapped in savepoint so audit failure never aborts deletion transaction)
    def _log_audit():
        import json
        audit = AuditLog(
            school_id=school_id,
            user_id=actor_user.id if actor_user else None,
            action='DELETE',
            module='DELETED_ITEMS',
            new_value=json.dumps({'message': f"Permanently purged {item.item_type} {item.name} (ID: {item.original_id}) from system. Financial records anonymized if present."}),
            ip_address='127.0.0.1'
        )
        db.session.add(audit)
    _safe_exec(_log_audit, 'audit_log')

    db.session.commit()
    return {
        'message': f"{item.name} has been permanently deleted from the system.",
        'item': item.to_dict(),
    }


def run_one_year_cleanup_job():
    """
    Automated Background Cron/Scheduled Job:
    Finds all archived items where auto_delete_at <= now() (older than 1 year)
    and permanently deletes them automatically.
    """
    now = datetime.utcnow()
    expired_items = DeletedItem.query.filter(
        DeletedItem.status == DeletedItemStatus.ARCHIVED.value,
        DeletedItem.auto_delete_at <= now
    ).all()

    purged_count = 0
    for item in expired_items:
        try:
            permanently_purge_item(
                item_id=item.id,
                school_id=item.school_id,
                actor_user=None,
                confirmation_name='',
                force=True
            )
            purged_count += 1
            logger.info(f"[AutoCleanup] Permanently purged 1-year expired item {item.id} ({item.name})")
        except Exception as e:
            logger.error(f"[AutoCleanup] Failed to purge item {item.id}: {e}")

    return {
        'timestamp': now.isoformat(),
        'expired_found': len(expired_items),
        'purged_count': purged_count
    }


# ── Internal Helper Functions ──────────────────────────────────────────

def _check_student_financial_history(student_id):
    """Checks if student has any past financial bills, payments, transactions, or ledger entries."""
    checks = []

    def _chk_fee_record():
        from app.models.financial import FeeRecord
        return FeeRecord.query.filter_by(student_id=student_id).first() is not None
    checks.append(('fee_record', _chk_fee_record))

    def _chk_fee_txn():
        from app.models.financial import FeeTransaction
        return FeeTransaction.query.filter_by(student_id=student_id).first() is not None
    checks.append(('fee_txn', _chk_fee_txn))

    def _chk_fee_bill():
        from app.models.fee_finance import FeeBill
        return FeeBill.query.filter_by(student_id=student_id).first() is not None
    checks.append(('fee_bill', _chk_fee_bill))

    def _chk_student_ledger():
        from app.models.fee_finance import StudentLedger
        return StudentLedger.query.filter_by(student_id=student_id).first() is not None
    checks.append(('student_ledger', _chk_student_ledger))

    def _chk_fee_payment():
        from app.models.fee_finance import FeePayment
        return FeePayment.query.filter_by(student_id=student_id).first() is not None
    checks.append(('fee_payment', _chk_fee_payment))

    def _chk_transport_fee():
        from app.models.transport_student import TransportFeeRecord
        return TransportFeeRecord.query.filter_by(student_id=student_id).first() is not None
    checks.append(('transport_fee', _chk_transport_fee))

    def _chk_hostel_fine():
        from app.models.hostel import HostelFineTransaction
        return HostelFineTransaction.query.filter_by(student_id=student_id).first() is not None
    checks.append(('hostel_fine', _chk_hostel_fine))

    for name, fn in checks:
        result = _safe_exec(fn, f"financial_check_{name}")
        if result is True:
            return True

    return False


def _check_teacher_payroll_history(teacher_id):
    """Checks if teacher has historical payroll records."""
    def _chk_salary():
        from app.models.financial import TeacherSalaryRecord
        return TeacherSalaryRecord.query.filter_by(teacher_id=teacher_id).first() is not None
    result = _safe_exec(_chk_salary, 'teacher_payroll_check')
    return bool(result)


def _check_staff_financial_history(user_id):
    """Checks if staff user collected fees or has payroll records."""
    def _chk_fee_collected():
        from app.models.fee_finance import FeePayment
        return FeePayment.query.filter_by(collected_by_id=user_id).first() is not None
    result = _safe_exec(_chk_fee_collected, 'staff_financial_check')
    return bool(result)


def _cleanup_student_operational_records(student, user):
    """Cleans up operational records: hostel, library, transport, attendance, marks, documents safely using savepoints."""
    sid = student.id

    # 1. Attendance & Marks
    _safe_exec(lambda: Attendance.query.filter_by(student_id=sid).delete(synchronize_session=False), 'attendance')
    _safe_exec(lambda: Marks.query.filter_by(student_id=sid).delete(synchronize_session=False), 'marks')

    # 2. Documents & KYC
    def _clean_docs():
        from app.models.documents import StudentDocument, IssuedDocument
        StudentDocument.query.filter_by(student_id=sid).delete(synchronize_session=False)
        IssuedDocument.query.filter_by(student_id=sid).delete(synchronize_session=False)
    _safe_exec(_clean_docs, 'documents')

    # 3. Academic logs (Assignment submissions)
    def _clean_academic_logs():
        from app.models.academic import AssignmentSubmission
        AssignmentSubmission.query.filter_by(student_id=sid).delete(synchronize_session=False)
        try:
            from app.models.academic_resources import InternalMark
            InternalMark.query.filter_by(student_id=sid).delete(synchronize_session=False)
        except Exception:
            pass
    _safe_exec(_clean_academic_logs, 'academic_logs')

    # 4. Hostel
    def _clean_hostel():
        from app.models.hostel import (
            HostelBed, HostelBedAllocation, HostelAttendance,
            HostelComplaint, HostelVisitorLog, HostelOutPass,
            HostelInventory
        )
        HostelBed.query.filter_by(current_student_id=sid).update(
            {'current_student_id': None, 'status': 'VACANT'}, synchronize_session=False
        )
        HostelInventory.query.filter_by(assigned_student_id=sid).update(
            {'assigned_student_id': None}, synchronize_session=False
        )
        HostelBedAllocation.query.filter_by(student_id=sid).delete(synchronize_session=False)
        HostelAttendance.query.filter_by(student_id=sid).delete(synchronize_session=False)
        HostelComplaint.query.filter_by(student_id=sid).delete(synchronize_session=False)
        HostelVisitorLog.query.filter_by(student_id=sid).delete(synchronize_session=False)
        HostelOutPass.query.filter_by(student_id=sid).delete(synchronize_session=False)
    _safe_exec(_clean_hostel, 'hostel')

    # 5. Transport
    def _clean_transport():
        from app.models.transport_student import StudentTransport, TransportTransferHistory
        from app.models.transport_gps import TripStudentAttendance
        StudentTransport.query.filter_by(student_id=sid).delete(synchronize_session=False)
        TransportTransferHistory.query.filter_by(student_id=sid).delete(synchronize_session=False)
        TripStudentAttendance.query.filter_by(student_id=sid).delete(synchronize_session=False)
    _safe_exec(_clean_transport, 'transport')

    # 6. Library
    if user:
        def _clean_library():
            from app.models.library import LibraryMember, LibraryVisit, BookIssue
            LibraryVisit.query.filter_by(student_id=sid).delete(synchronize_session=False)
            member = LibraryMember.query.filter_by(user_id=user.id).first()
            if member:
                has_active = BookIssue.query.filter_by(member_id=member.id, status='ISSUED').first() is not None
                if has_active:
                    member.status = 'SUSPENDED'
                else:
                    db.session.delete(member)
        _safe_exec(_clean_library, 'library')

    # 7. Communication
    if user:
        def _clean_communication():
            from app.models.communication import (
                SupportTicket, TicketReply, ChatMessage,
                SupportNotification, SupportAttachment
            )
            ChatMessage.query.filter(
                db.or_(ChatMessage.sender_id == user.id, ChatMessage.receiver_id == user.id)
            ).delete(synchronize_session=False)
            SupportNotification.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        _safe_exec(_clean_communication, 'communication')

