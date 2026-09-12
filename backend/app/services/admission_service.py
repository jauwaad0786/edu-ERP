import secrets
from app import db
from app.models.academic import Student, StudentEnrollment


def generate_provisional_admission_no(school_id: int, session_str: str = '2026-27') -> str:
    """
    Generates a unique monotonic provisional admission number (e.g., PROV-2026-0001).
    """
    year_prefix = session_str[:4] if session_str else '2026'
    count_prov = Student.query.filter_by(school_id=school_id).filter(
        Student.admission_no.like(f"PROV-{year_prefix}-%")
    ).count()
    seq = count_prov + 1
    candidate = f"PROV-{year_prefix}-{seq:04d}"
    while Student.query.filter_by(school_id=school_id, admission_no=candidate).first():
        seq += 1
        candidate = f"PROV-{year_prefix}-{seq:04d}"
    return candidate


def generate_official_admission_no(school_id: int, session_str: str = '2026-27') -> str:
    """
    Generates a unique monotonic official admission number (e.g., ADM-2026-0001).
    """
    year_prefix = session_str[:4] if session_str else '2026'
    count_active = Student.query.filter_by(school_id=school_id).filter(
        Student.status != 'PROVISIONAL'
    ).count()
    seq = count_active + 1
    candidate = f"ADM-{year_prefix}-{seq:04d}"
    while Student.query.filter_by(school_id=school_id, admission_no=candidate).first():
        seq += 1
        candidate = f"ADM-{year_prefix}-{seq:04d}"
    return candidate


def promote_provisional_student(student) -> str:
    """
    Promotes an unconfirmed (PROVISIONAL) student to confirmed (ACTIVE):
    1. If student.pending_admission_no is saved and free, assigns it as official admission_no.
    2. Otherwise, auto-generates official next ADM-YYYY-XXXX admission number.
    3. Retains student.provisional_no for historic record.
    4. Sets student.status = 'ACTIVE'.
    5. Promotes associated StudentEnrollment rows to 'ACTIVE'.
    """
    if not student or student.status != 'PROVISIONAL':
        return getattr(student, 'admission_no', None)

    sid = student.school_id
    session_str = getattr(student, 'session', None) or '2026-27'

    new_adm_no = getattr(student, 'pending_admission_no', None)
    if new_adm_no:
        existing = Student.query.filter(
            Student.school_id == sid,
            Student.admission_no == new_adm_no,
            Student.id != student.id
        ).first()
        if existing:
            new_adm_no = None  # Conflict, fallback to generated official ADM

    if not new_adm_no:
        new_adm_no = generate_official_admission_no(sid, session_str)

    student.admission_no = new_adm_no
    student.pending_admission_no = None
    student.status = 'ACTIVE'

    try:
        enrollments = StudentEnrollment.query.filter_by(
            student_id=student.id, school_id=student.school_id
        ).all()
        for enr in enrollments:
            if enr.enrollment_status == 'PROVISIONAL':
                enr.enrollment_status = 'ACTIVE'
    except Exception as e:
        print(f"[WARN] Error updating enrollment status on confirmation: {e}")

    return new_adm_no
