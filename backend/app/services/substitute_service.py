"""
Substitute Management & Timetable Conflict Service
Handles:
1. Conflict detection (Teacher double-booking, room clash, period collision).
2. Absent teacher identification from StaffAttendance and LeaveRequest.
3. Affected period resolution for a given target date.
4. Intelligent substitute suggestion and workload ranking.
5. Substitution assignment and cancellation with audit logging and notifications.
"""
from datetime import date, datetime
from sqlalchemy import or_, and_

from app import db
from app.models.academic import Teacher, Subject, Class
from app.models.user import User
from app.models.financial import Timetable, TimetablePeriod, TimetableSubstitution
from app.models.staff_attendance import StaffAttendance
from app.models.hrms import LeaveRequest
from app.services.notification import emit_notification_event


def validate_timetable_conflict(school_id, timetable_id, day, period_no, teacher_id=None, room=None, exclude_period_id=None):
    """
    Validates whether a period assignment creates a conflict:
    1. Period slot collision in the same timetable
    2. Teacher double-booking across any timetable in the school
    3. Room collision across any timetable in the school
    """
    day = (day or '').upper()[:3]
    try:
        period_no = int(period_no)
    except (ValueError, TypeError):
        return {'conflict': True, 'type': 'INVALID_PERIOD', 'message': 'Invalid period number.'}

    # 1. Period collision in this timetable
    existing_slot = TimetablePeriod.query.filter(
        TimetablePeriod.timetable_id == timetable_id,
        TimetablePeriod.day == day,
        TimetablePeriod.period_no == period_no
    )
    if exclude_period_id:
        existing_slot = existing_slot.filter(TimetablePeriod.id != exclude_period_id)
    slot_match = existing_slot.first()
    if slot_match:
        return {
            'conflict': True,
            'type': 'PERIOD_COLLISION',
            'message': f"Period {period_no} is already assigned on {day} in this timetable."
        }

    # 2. Teacher double-booking across the school
    if teacher_id:
        teacher_query = TimetablePeriod.query.join(Timetable).filter(
            Timetable.school_id == school_id,
            TimetablePeriod.day == day,
            TimetablePeriod.period_no == period_no,
            TimetablePeriod.teacher_id == teacher_id
        )
        if exclude_period_id:
            teacher_query = teacher_query.filter(TimetablePeriod.id != exclude_period_id)
        teacher_clash = teacher_query.first()
        if teacher_clash:
            clash_class = ''
            if teacher_clash.timetable and teacher_clash.timetable.class_id:
                c = Class.query.get(teacher_clash.timetable.class_id)
                if c:
                    clash_class = f" ({c.name} {c.section})".strip()
            return {
                'conflict': True,
                'type': 'TEACHER_COLLISION',
                'message': f"Teacher is already assigned to a class{clash_class} on {day} during period {period_no}."
            }

    # 3. Room collision
    if room and room.strip():
        clean_room = room.strip().upper()
        room_query = TimetablePeriod.query.join(Timetable).filter(
            Timetable.school_id == school_id,
            TimetablePeriod.day == day,
            TimetablePeriod.period_no == period_no,
            db.func.upper(TimetablePeriod.room) == clean_room
        )
        if exclude_period_id:
            room_query = room_query.filter(TimetablePeriod.id != exclude_period_id)
        room_clash = room_query.first()
        if room_clash:
            return {
                'conflict': True,
                'type': 'ROOM_COLLISION',
                'message': f"Room '{room}' is already allocated on {day} during period {period_no}."
            }

    return {'conflict': False}


def get_absent_teacher_ids(school_id, target_date):
    """
    Collects teacher IDs who are absent or on approved leave on target_date.
    """
    absent_user_ids = set()

    # Staff attendance check
    attendance_records = StaffAttendance.query.filter(
        StaffAttendance.school_id == school_id,
        StaffAttendance.attendance_date == target_date,
        StaffAttendance.status.in_(['ABSENT', 'ON_LEAVE'])
    ).all()
    for rec in attendance_records:
        absent_user_ids.add(rec.user_id)

    # Approved leave requests check
    approved_leaves = LeaveRequest.query.filter(
        LeaveRequest.school_id == school_id,
        LeaveRequest.status == 'APPROVED',
        LeaveRequest.from_date <= target_date,
        LeaveRequest.to_date >= target_date
    ).all()
    for l in approved_leaves:
        absent_user_ids.add(l.user_id)

    if not absent_user_ids:
        return []

    teachers = Teacher.query.filter(
        Teacher.school_id == school_id,
        Teacher.user_id.in_(list(absent_user_ids)),
        Teacher.is_deleted == False
    ).all()
    return [t.id for t in teachers]


def get_affected_periods_for_date(school_id, target_date):
    """
    Returns all periods affected by absent teachers on target_date,
    along with any existing substitution record.
    """
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    day_code = target_date.strftime('%a').upper()[:3]
    absent_teacher_ids = get_absent_teacher_ids(school_id, target_date)

    # Also include teachers who have manual pending substitutions on this date
    manual_substs = TimetableSubstitution.query.filter(
        TimetableSubstitution.school_id == school_id,
        TimetableSubstitution.date == target_date
    ).all()
    manual_teacher_ids = [s.original_teacher_id for s in manual_substs]
    all_absent_or_reassigned_ids = list(set(absent_teacher_ids + manual_teacher_ids))

    if not all_absent_or_reassigned_ids:
        return []

    # Find affected timetable periods
    affected_periods = TimetablePeriod.query.join(Timetable).filter(
        Timetable.school_id == school_id,
        TimetablePeriod.day == day_code,
        TimetablePeriod.teacher_id.in_(all_absent_or_reassigned_ids),
        TimetablePeriod.is_break == False
    ).all()

    subst_map = {s.timetable_period_id: s for s in manual_substs}

    results = []
    for p in affected_periods:
        subst = subst_map.get(p.id)
        class_name = ''
        if p.timetable and p.timetable.class_id:
            c = Class.query.get(p.timetable.class_id)
            if c:
                class_name = f"{c.name} {c.section}".strip()

        orig_teacher = p.teacher
        orig_name = orig_teacher.user.name if (orig_teacher and orig_teacher.user) else ''

        results.append({
            'period_id': p.id,
            'timetable_id': p.timetable_id,
            'day': p.day,
            'period_no': p.period_no,
            'start_time': p.start_time or '',
            'end_time': p.end_time or '',
            'room': p.room or '',
            'class_id': p.timetable.class_id if p.timetable else None,
            'class_name': class_name,
            'subject_id': p.subject_id,
            'subject_name': p.subject.name if p.subject else '',
            'original_teacher_id': p.teacher_id,
            'original_teacher_name': orig_name,
            'substitution': subst.to_dict() if subst else None,
            'status': subst.status if subst else 'PENDING',
        })

    # Sort by period_no
    results.sort(key=lambda x: x['period_no'])
    return results


def get_eligible_substitutes(school_id, target_date, timetable_period_id):
    """
    Ranks available teachers for substitution in a specific period.
    Filters out:
    - Absent/on-leave teachers
    - Teachers teaching in the same period
    - Teachers already booked as a substitute for that period
    - The original teacher
    Ranks by:
    - Subject expertise (+15 points)
    - Department match (+10 points)
    - Low workload on the day (+1 to 5 points)
    """
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    period = TimetablePeriod.query.get(timetable_period_id)
    if not period:
        return []

    day_code = period.day
    period_no = period.period_no

    # 1. Absent teachers
    absent_teacher_ids = set(get_absent_teacher_ids(school_id, target_date))

    # 2. Busy teachers at this period in regular schedule
    busy_periods = TimetablePeriod.query.join(Timetable).filter(
        Timetable.school_id == school_id,
        TimetablePeriod.day == day_code,
        TimetablePeriod.period_no == period_no,
        TimetablePeriod.teacher_id.isnot(None),
        TimetablePeriod.is_break == False
    ).all()
    busy_teacher_ids = {p.teacher_id for p in busy_periods if p.teacher_id}

    # 3. Already substituted at this period on this date
    subst_busy = TimetableSubstitution.query.join(TimetablePeriod).filter(
        TimetableSubstitution.school_id == school_id,
        TimetableSubstitution.date == target_date,
        TimetableSubstitution.status == 'CONFIRMED',
        TimetablePeriod.period_no == period_no
    ).all()
    subst_busy_ids = {s.substitute_teacher_id for s in subst_busy}

    unavailable_ids = absent_teacher_ids | busy_teacher_ids | subst_busy_ids
    if period.teacher_id:
        unavailable_ids.add(period.teacher_id)

    # Candidate teachers
    candidates = Teacher.query.filter(
        Teacher.school_id == school_id,
        Teacher.is_deleted == False,
        ~Teacher.id.in_(list(unavailable_ids)) if unavailable_ids else True
    ).all()

    # Pre-fetch periods assigned on that day for candidates to gauge workload
    day_periods = TimetablePeriod.query.join(Timetable).filter(
        Timetable.school_id == school_id,
        TimetablePeriod.day == day_code,
        TimetablePeriod.teacher_id.isnot(None),
        TimetablePeriod.is_break == False
    ).all()

    workload_map = {}
    for dp in day_periods:
        workload_map[dp.teacher_id] = workload_map.get(dp.teacher_id, 0) + 1

    subject = period.subject
    subject_name = subject.name.lower() if subject else ''

    ranked = []
    for cand in candidates:
        user_name = cand.user.name if cand.user else 'Unknown Teacher'
        dept = (cand.department or '').lower()
        workload = workload_map.get(cand.id, 0)

        score = 0
        reasons = []

        # Check subject / department match
        if dept and (dept in subject_name or subject_name in dept):
            score += 15
            reasons.append(f"Subject Specialist ({cand.department})")

        # Check subjects taught by candidate
        subjects_taught = [s.name.lower() for s in cand.classes_taught.all()]
        if subject_name and subject_name in subjects_taught:
            score += 15
            if not any("Specialist" in r for r in reasons):
                reasons.append("Teaches this subject")

        # Workload bonus (lower workload = better)
        if workload <= 2:
            score += 5
            reasons.append(f"Light workload ({workload} periods today)")
        elif workload <= 4:
            score += 2
            reasons.append(f"Moderate workload ({workload} periods today)")
        else:
            reasons.append(f"Heavy workload ({workload} periods today)")

        reasons.append("Free in Period " + str(period_no))

        ranked.append({
            'teacher_id': cand.id,
            'name': user_name,
            'email': cand.user.email if cand.user else '',
            'department': cand.department or '',
            'workload_today': workload,
            'score': score,
            'eligibility_reasons': reasons,
            'is_recommended': score >= 10,
        })

    # Sort candidates by score desc, workload asc, name asc
    ranked.sort(key=lambda x: (-x['score'], x['workload_today'], x['name']))
    return ranked


def assign_substitute(school_id, target_date, timetable_period_id, substitute_teacher_id, assigned_by_user_id, reason="Teacher Absence", notes=""):
    """
    Assigns a substitute teacher for a period on target_date.
    Enforces uniqueness, prevents conflicts, and dispatches notification.
    """
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()

    period = TimetablePeriod.query.get_or_404(timetable_period_id)
    orig_teacher_id = period.teacher_id
    if not orig_teacher_id:
        raise ValueError("Cannot substitute a period without an assigned original teacher.")

    if substitute_teacher_id == orig_teacher_id:
        raise ValueError("Substitute teacher cannot be the same as the original teacher.")

    # Check if substitute has a conflict on that period
    conflict = validate_timetable_conflict(
        school_id=school_id,
        timetable_id=period.timetable_id,
        day=period.day,
        period_no=period.period_no,
        teacher_id=substitute_teacher_id,
        exclude_period_id=period.id
    )
    if conflict.get('conflict') and conflict.get('type') == 'TEACHER_COLLISION':
        raise ValueError(conflict['message'])

    # Find or create TimetableSubstitution
    existing = TimetableSubstitution.query.filter_by(
        school_id=school_id,
        date=target_date,
        timetable_period_id=timetable_period_id
    ).first()

    if existing:
        existing.substitute_teacher_id = substitute_teacher_id
        existing.status = 'CONFIRMED'
        existing.reason = reason
        existing.notes = notes
        existing.assigned_by = assigned_by_user_id
        subst = existing
    else:
        subst = TimetableSubstitution(
            school_id=school_id,
            date=target_date,
            timetable_period_id=timetable_period_id,
            original_teacher_id=orig_teacher_id,
            substitute_teacher_id=substitute_teacher_id,
            status='CONFIRMED',
            reason=reason,
            notes=notes,
            assigned_by=assigned_by_user_id
        )
        db.session.add(subst)

    db.session.commit()

    # Emit notification to substitute teacher
    sub_teacher = Teacher.query.get(substitute_teacher_id)
    if sub_teacher and sub_teacher.user_id:
        sub_name = sub_teacher.user.name if sub_teacher.user else 'Teacher'
        subject_name = period.subject.name if period.subject else 'Class'
        cls_name = f"Class {period.timetable.class_id}"
        if period.timetable and period.timetable.class_id:
            c = Class.query.get(period.timetable.class_id)
            if c:
                cls_name = f"{c.name} {c.section}".strip()

        try:
            emit_notification_event(
                event_name='timetable.substitution',
                school_id=school_id,
                payload={
                    'teacher_name': sub_name,
                    'class_name': cls_name,
                    'subject_name': subject_name,
                    'period_no': period.period_no,
                    'date': target_date.isoformat(),
                    'start_time': period.start_time or '',
                    'room': period.room or '',
                    'user_id': sub_teacher.user_id,
                }
            )
        except Exception:
            pass

    return subst


def cancel_substitute(school_id, substitution_id, cancelled_by_user_id):
    """
    Cancels a substitution assignment.
    """
    subst = TimetableSubstitution.query.filter_by(id=substitution_id, school_id=school_id).first_or_404()
    subst.status = 'CANCELLED'
    subst.notes = f"{subst.notes}\nCancelled by User {cancelled_by_user_id} on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}".strip()
    db.session.commit()
    return subst
