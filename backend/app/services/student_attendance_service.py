# backend/app/services/student_attendance_service.py
"""
Student Attendance Service — Enterprise Multi-Tenant Attendance Engine.

Enforces:
- Strict multi-tenant isolation and school scoping.
- Teacher class assignment, subject teaching, and delegation validation.
- Active student enrollment verification in class and session.
- Prevention of future date attendance marking.
- Strict validation of attendance statuses (PRESENT, ABSENT, LATE, HALF_DAY, ON_LEAVE, EXCUSED).
- Idempotent marking and re-submission handling.
- Audit history logging for all attendance corrections via AttendanceCorrection.
- Deduplicated parent notification triggers for absent and corrected events.
- Division-by-zero protected attendance metric calculations.
- Comprehensive low-attendance and missing attendance analytics.
"""

from datetime import date, datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app import db
from app.models.academic import (
    Class, Student, StudentEnrollment, Teacher, Subject,
    Attendance, AttendanceCorrection
)
from app.models.user import User, UserRole
from app.utils.timezone_util import utc_now


ALLOWED_STATUSES = {'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'EXCUSED'}


def validate_teacher_class_assignment(user: User, cls: Class) -> Tuple[bool, Optional[str]]:
    """
    Validates if a TEACHER user is authorized to mark or update attendance for a class.
    Allowed if:
    1. User is Principal, Admin, or Super Admin.
    2. Class has no designated class teacher assigned (cls.teacher_id is None) and user belongs to school.
    3. User is the designated class teacher (cls.teacher_id == teacher.id).
    4. User teaches a subject in this class.
    5. User holds an active, unrevoked delegation for this class with ATTENDANCE_MARK permission.
    """
    user_role_str = getattr(user.role, 'value', str(user.role)).upper()
    if user_role_str in ('PRINCIPAL', 'ADMIN', 'SUPER_ADMIN'):
        return True, None

    if cls.school_id != user.school_id:
        return False, "Class does not belong to your school."

    teacher = Teacher.query.filter_by(user_id=user.id, school_id=user.school_id).first()
    if not teacher or getattr(teacher, 'is_deleted', False):
        return False, "Teacher profile not found or inactive in this school."

    # If class has no explicit class teacher assigned, allow teachers in the same school
    if cls.teacher_id is None:
        return True, None

    # Check if assigned class teacher
    if cls.teacher_id == teacher.id:
        return True, None

    # Check if teacher teaches any subject in this class
    teaches_subject = Subject.query.filter_by(class_id=cls.id, teacher_id=teacher.id).first()
    if teaches_subject:
        return True, None

    # Check active teacher delegation
    try:
        from app.services.teacher_delegation_service import get_active_teacher_delegations_for_user
        delgs = get_active_teacher_delegations_for_user(
            user, permission_code='ATTENDANCE_MARK', class_id=cls.id
        )
        if delgs:
            return True, None
    except Exception:
        pass

    return False, "You are not assigned to mark attendance for this class."


def validate_attendance_submission(
    user: User,
    class_id: int,
    att_date: date,
    records: List[Dict[str, Any]]
) -> Tuple[bool, Optional[str], int]:
    """
    Validates attendance submission inputs, date rules, teacher assignment, and student enrollment.
    Returns (is_valid, error_message, http_status_code).
    """
    if not class_id or not att_date:
        return False, "class_id and date are required.", 400

    if not records or not isinstance(records, list):
        return False, "records list is required and cannot be empty.", 400

    # 1. Verify class exists in user's school
    cls = Class.query.filter_by(id=class_id, school_id=user.school_id).first()
    if not cls:
        return False, "Class not found or unauthorized.", 403

    # 2. Verify teacher authorization
    is_auth, auth_err = validate_teacher_class_assignment(user, cls)
    if not is_auth:
        return False, auth_err or "Unauthorized to mark attendance for this class.", 403

    # 3. Verify date (prevent future attendance)
    today = date.today()
    if att_date > today:
        return False, f"Attendance cannot be marked for future dates (requested: {att_date}, today: {today}).", 400

    # 4. Validate each record's student enrollment & status
    seen_student_ids = set()
    for rec in records:
        s_id = rec.get('student_id')
        if not s_id:
            return False, "Every record must have a valid student_id.", 400

        if s_id in seen_student_ids:
            return False, f"Duplicate entry for student ID {s_id} in submission.", 400
        seen_student_ids.add(s_id)

        raw_status = (rec.get('status') or 'PRESENT').strip().upper()
        if raw_status not in ALLOWED_STATUSES:
            return False, f"Invalid status '{raw_status}' for student ID {s_id}. Allowed: {', '.join(sorted(ALLOWED_STATUSES))}.", 400

        # Multi-tenant student ownership check
        student = Student.query.filter_by(id=s_id, school_id=user.school_id).first()
        if not student:
            return False, f"Student ID {s_id} does not belong to this school.", 400

        # Check student lifecycle status (inactive/withdrawn/graduated/transferred cannot be marked)
        if getattr(student, 'is_deleted', False):
            return False, f"Student {student.admission_no or s_id} is deleted and cannot be marked.", 400

        stu_status = (getattr(student, 'status', 'ACTIVE') or 'ACTIVE').upper()
        if stu_status in ('WITHDRAWN', 'LEFT', 'GRADUATED', 'TRANSFERRED', 'ARCHIVED'):
            return False, f"Student {student.admission_no or s_id} is {stu_status} and cannot be marked in active attendance.", 400

        # Check class enrollment (either primary class_id matches or active StudentEnrollment for session)
        is_enrolled = (student.class_id == class_id)
        if not is_enrolled:
            enrollment = StudentEnrollment.query.filter_by(
                student_id=s_id,
                class_id=class_id,
                school_id=user.school_id,
                enrollment_status='ACTIVE'
            ).first()
            if enrollment:
                is_enrolled = True

        if not is_enrolled:
            return False, f"Student ID {s_id} ({student.admission_no or ''}) is not enrolled in class {cls.name}-{cls.section or ''}.", 400

    return True, None, 200


def process_attendance_submission(
    user: User,
    class_id: int,
    att_date: date,
    records: List[Dict[str, Any]],
    default_reason: Optional[str] = None
) -> Tuple[Dict[str, Any], int]:
    """
    Processes attendance marking with idempotency and correction tracking.
    """
    is_valid, err_msg, status_code = validate_attendance_submission(user, class_id, att_date, records)
    if not is_valid:
        return {'error': err_msg}, status_code

    cls = Class.query.filter_by(id=class_id, school_id=user.school_id).first()

    created_count = 0
    corrected_count = 0
    unchanged_count = 0
    newly_absent_students = []
    corrections_logged = []

    for rec in records:
        s_id = rec.get('student_id')
        new_status = (rec.get('status') or 'PRESENT').strip().upper()
        remarks = rec.get('remarks') or ''
        reason = rec.get('reason') or default_reason or 'Attendance updated'

        student = Student.query.get(s_id)
        existing = Attendance.query.filter_by(student_id=s_id, date=att_date).first()

        if existing:
            if existing.status != new_status:
                prev_status = existing.status
                # Record correction in audit table
                corr = AttendanceCorrection(
                    attendance_id=existing.id,
                    student_id=s_id,
                    school_id=user.school_id,
                    date=att_date,
                    previous_status=prev_status,
                    new_status=new_status,
                    reason=reason,
                    corrected_by=user.id,
                    corrected_at=utc_now()
                )
                db.session.add(corr)
                corrections_logged.append(corr)

                # Update existing record
                existing.status = new_status
                existing.marked_by = user.id
                if remarks:
                    existing.remarks = remarks
                corrected_count += 1

                # If changed to ABSENT from another status, trigger absent alert
                if new_status == 'ABSENT' and prev_status != 'ABSENT':
                    newly_absent_students.append(student)
            else:
                # Idempotent re-submission with same status: no correction, update remarks if given
                if remarks:
                    existing.remarks = remarks
                unchanged_count += 1
        else:
            # Brand new attendance entry
            new_att = Attendance(
                student_id=s_id,
                class_id=class_id,
                date=att_date,
                status=new_status,
                marked_by=user.id,
                remarks=remarks
            )
            db.session.add(new_att)
            created_count += 1

            if new_status == 'ABSENT':
                newly_absent_students.append(student)

    db.session.commit()

    # 5. Audit Logging
    try:
        from app.services.audit_service import record_audit_event
        action_name = 'ATTENDANCE_CORRECTED' if (corrected_count > 0 and created_count == 0) else 'ATTENDANCE_MARKED'
        record_audit_event(
            school_id=user.school_id,
            actor_user_id=user.id,
            action=action_name,
            module='attendance',
            entity_type='Attendance',
            class_id=class_id,
            remarks=f"Attendance processed for {cls.name}-{cls.section or ''} on {att_date}: {created_count} created, {corrected_count} corrected, {unchanged_count} unchanged",
            status='SUCCESS',
            severity='LOW' if corrected_count == 0 else 'MEDIUM'
        )
    except Exception as audit_err:
        print(f"[AUDIT] Attendance event logging failed: {audit_err}")

    # 6. Deduplicated Absent Notifications (only for students newly marked absent)
    if newly_absent_students:
        try:
            from app.services.notification import emit_notification_event
            for s in newly_absent_students:
                emit_notification_event(
                    event_name='attendance.absent',
                    school_id=user.school_id,
                    payload={
                        'student_name': s.user.name if s.user else f"Student #{s.id}",
                        'student_id': s.id,
                        'user_id': s.user_id,
                        'class_name': f"{cls.name} {cls.section or ''}".strip(),
                        'date': str(att_date),
                        'created_by': user.id
                    }
                )
        except Exception as notif_err:
            print(f"[NOTIF] Absent student notification trigger warning: {notif_err}")

    # 7. Attendance Correction Notification (if any corrections made)
    if corrections_logged:
        try:
            from app.services.notification import emit_notification_event
            emit_notification_event(
                event_name='attendance.corrected',
                school_id=user.school_id,
                payload={
                    'class_name': f"{cls.name} {cls.section or ''}".strip(),
                    'class_id': class_id,
                    'date': str(att_date),
                    'corrections_count': corrected_count,
                    'corrected_by': user.id
                }
            )
        except Exception as notif_err:
            print(f"[NOTIF] Attendance correction notification trigger warning: {notif_err}")

    return {
        'success': True,
        'message': f"Attendance saved: {created_count} created, {corrected_count} corrected, {unchanged_count} unchanged.",
        'created': created_count,
        'corrected': corrected_count,
        'unchanged': unchanged_count,
        'total': len(records),
        'date': str(att_date),
        'class_id': class_id
    }, 200


def calculate_attendance_metrics(records: List[Attendance]) -> Dict[str, Any]:
    """
    Calculates detailed status breakdown and percentage with division-by-zero protection.
    Standard formula:
    - total_days = total marked days
    - present = sum(PRESENT)
    - late = sum(LATE)
    - half_day = sum(HALF_DAY)
    - on_leave = sum(ON_LEAVE, EXCUSED)
    - absent = sum(ABSENT)
    - percentage = round(((present + 0.5 * half_day + late) / total_days) * 100, 1) if total_days else 0.0
    """
    total = len(records)
    present = sum(1 for r in records if r.status == 'PRESENT')
    late = sum(1 for r in records if r.status == 'LATE')
    half_day = sum(1 for r in records if r.status == 'HALF_DAY')
    on_leave = sum(1 for r in records if r.status in ('ON_LEAVE', 'EXCUSED'))
    absent = sum(1 for r in records if r.status == 'ABSENT')

    effective_present = present + (0.5 * half_day) + late
    percentage = round((effective_present / total) * 100, 1) if total > 0 else 0.0

    return {
        'total_days': total,
        'present': present,
        'absent': absent,
        'late': late,
        'half_day': half_day,
        'on_leave': on_leave,
        'percentage': percentage,
    }


def get_low_attendance_students(
    school_id: int,
    class_id: Optional[int] = None,
    session_str: Optional[str] = None,
    threshold: float = 75.0
) -> List[Dict[str, Any]]:
    """
    Identifies all actively enrolled students in the school/class whose attendance percentage
    is strictly below the specified threshold (default 75.0%).
    """
    q_students = Student.query.options(
        joinedload(Student.user),
        joinedload(Student.class_ref)
    ).filter_by(school_id=school_id, is_deleted=False).filter(
        Student.status.notin_(['WITHDRAWN', 'LEFT', 'GRADUATED', 'TRANSFERRED', 'ARCHIVED'])
    )

    if class_id:
        q_students = q_students.filter_by(class_id=class_id)
    if session_str:
        q_students = q_students.filter_by(session=session_str)

    students = q_students.all()
    if not students:
        return []

    student_ids = [s.id for s in students]

    # Batch query all attendance records for these students
    att_records = Attendance.query.filter(
        Attendance.student_id.in_(student_ids)
    ).all()

    att_by_student = {}
    for a in att_records:
        att_by_student.setdefault(a.student_id, []).append(a)

    low_attendance_list = []
    for s in students:
        s_records = att_by_student.get(s.id, [])
        metrics = calculate_attendance_metrics(s_records)

        # Only evaluate if student has at least 1 attendance record
        if metrics['total_days'] > 0 and metrics['percentage'] < threshold:
            low_attendance_list.append({
                'student_id': s.id,
                'name': s.user.name if s.user else '',
                'admission_no': s.admission_no or '',
                'roll_number': s.roll_number or '',
                'class_id': s.class_id,
                'class_display': f"{s.class_ref.name} - {s.class_ref.section}".strip(' -') if s.class_ref else '',
                'total_days': metrics['total_days'],
                'present': metrics['present'],
                'absent': metrics['absent'],
                'late': metrics['late'],
                'half_day': metrics['half_day'],
                'on_leave': metrics['on_leave'],
                'percentage': metrics['percentage'],
                'parent_name': s.parent_name or s.father_name or '',
                'parent_phone': s.parent_phone or '',
            })

    # Sort critical first (lowest percentage first)
    low_attendance_list.sort(key=lambda x: x['percentage'])
    return low_attendance_list


def get_missing_attendance_classes(school_id: int, target_date: date) -> List[Dict[str, Any]]:
    """
    Identifies all classes in the school that have NOT submitted any attendance records for the given date.
    """
    classes = Class.query.filter_by(school_id=school_id).all()
    if not classes:
        return []

    # Classes that have at least one attendance marked for target_date
    marked_class_ids = set(
        r[0] for r in db.session.query(Attendance.class_id)
        .join(Class, Attendance.class_id == Class.id)
        .filter(Class.school_id == school_id, Attendance.date == target_date)
        .distinct().all()
    )

    missing = []
    for c in classes:
        if c.id not in marked_class_ids:
            # Get class teacher info if assigned
            teacher_name = ''
            teacher_phone = ''
            if c.teacher_id:
                t = Teacher.query.get(c.teacher_id)
                if t and t.user:
                    teacher_name = t.user.name
                    teacher_phone = t.user.phone or ''

            student_count = Student.query.filter_by(
                school_id=school_id, class_id=c.id, is_deleted=False
            ).count()

            missing.append({
                'class_id': c.id,
                'class_name': c.name,
                'section': c.section or '',
                'class_display': f"{c.name} - {c.section}".strip(' -') if c.section else c.name,
                'total_enrolled': student_count,
                'teacher_id': c.teacher_id,
                'teacher_name': teacher_name,
                'teacher_phone': teacher_phone,
            })

    return missing


def get_attendance_corrections_log(
    school_id: int,
    class_id: Optional[int] = None,
    student_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Fetches the audit log of attendance corrections for the given school.
    """
    q = AttendanceCorrection.query.options(
        joinedload(AttendanceCorrection.student_ref).joinedload(Student.user),
        joinedload(AttendanceCorrection.corrector_ref)
    ).filter_by(school_id=school_id)

    if student_id:
        q = q.filter_by(student_id=student_id)
    if start_date:
        q = q.filter(AttendanceCorrection.date >= start_date)
    if end_date:
        q = q.filter(AttendanceCorrection.date <= end_date)

    if class_id:
        q = q.join(Student, AttendanceCorrection.student_id == Student.id).filter(Student.class_id == class_id)

    corrections = q.order_by(AttendanceCorrection.corrected_at.desc()).limit(limit).all()
    return [c.to_dict() for c in corrections]
