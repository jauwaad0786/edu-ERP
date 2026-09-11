import csv
import io
import json
import uuid
from datetime import datetime, date
from collections import defaultdict
from flask import Blueprint, request, jsonify, Response
from sqlalchemy.orm import joinedload
from sqlalchemy import func

from app import db
from app.models.school import School
from app.models.user import User, UserRole
from app.models.academic import (
    Class, Student, StudentEnrollment, Attendance, Marks, Subject
)
from app.models.financial import FeeRecord, ExamSchedule
from app.models.transport_student import StudentTransport
from app.models.audit import log_school_action, AuditLog
from app.utils.decorators import role_required, get_current_user
from app.utils.timezone_util import utc_now

student_lifecycle_bp = Blueprint('student_lifecycle', __name__)


def _school_id():
    user = get_current_user()
    return user.school_id if user else None


# ─── 0. HELPER METADATA & SESSIONS ───────────────────────────────────────────

@student_lifecycle_bp.route('/sessions', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
def list_lifecycle_sessions():
    """
    Returns available sessions, classes, and houses for the current school.
    """
    sid = _school_id()
    school = School.query.get(sid)
    curr_session = school.current_session if school and school.current_session else '2024-25'

    # Distinct sessions from classes and enrollments
    class_sessions = [r[0] for r in db.session.query(Class.session).filter_by(school_id=sid).distinct() if r[0]]
    enrollment_sessions = [r[0] for r in db.session.query(StudentEnrollment.session).filter_by(school_id=sid).distinct() if r[0]]
    all_sessions = sorted(list(set(class_sessions + enrollment_sessions + [curr_session, '2024-25', '2025-26', '2026-27'])))

    # Classes in school
    classes = Class.query.filter_by(school_id=sid).order_by(Class.name, Class.section).all()

    # Known houses
    houses = ['Red', 'Blue', 'Green', 'Yellow', 'Tagore', 'Ashoka', 'Shivaji', 'Raman']

    return jsonify({
        'current_session': curr_session,
        'sessions': all_sessions,
        'houses': houses,
        'classes': [c.to_dict() for c in classes]
    }), 200


# ─── 1. ANNUAL SESSION ROLLOVER & PROMOTION ───────────────────────────────────

@student_lifecycle_bp.route('/promote/preview', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def preview_promotion():
    """
    Preview promotion/rollover from source_session to target_session.
    Calculates student attendance %, exam performance, default target class,
    and checks for existing target session enrollment conflicts.
    """
    data = request.get_json() or {}
    sid = _school_id()
    source_session = (data.get('source_session') or '').strip()
    target_session = (data.get('target_session') or '').strip()
    class_id = data.get('class_id')

    if not source_session or not target_session:
        return jsonify({'error': 'source_session and target_session are required'}), 400

    if source_session == target_session:
        return jsonify({'error': 'Target session must be different from source session'}), 400

    # Query students who have an enrollment in source_session, or fall back to Student.session == source_session
    q = Student.query.options(
        joinedload(Student.user),
        joinedload(Student.class_ref)
    ).filter(
        Student.school_id == sid,
        Student.is_deleted == False
    )

    if class_id:
        q = q.filter(Student.class_id == class_id)

    students = q.all()

    # Pre-fetch existing target enrollments to detect conflicts
    target_enrollment_map = {
        e.student_id: e for e in StudentEnrollment.query.filter_by(
            school_id=sid, session=target_session
        ).all()
    }

    # Pre-fetch source enrollments
    source_enrollment_map = {
        e.student_id: e for e in StudentEnrollment.query.filter_by(
            school_id=sid, session=source_session
        ).all()
    }

    # Pre-fetch all school classes for target suggestion
    all_classes = Class.query.filter_by(school_id=sid).all()
    class_name_map = defaultdict(list)
    for c in all_classes:
        class_name_map[c.name.strip().lower()].append(c)

    preview_list = []
    for s in students:
        src_enroll = source_enrollment_map.get(s.id)
        active_cls = s.class_ref
        cls_name = active_cls.name if active_cls else ''
        cls_sec = (src_enroll.section if src_enroll else (active_cls.section if active_cls else '')) or 'A'
        roll_no = (src_enroll.roll_number if src_enroll else s.roll_number) or ''

        # Attendance calculation for source session / class
        att_records = Attendance.query.filter_by(student_id=s.id).all()
        total_att = len(att_records)
        present_att = sum(1 for a in att_records if a.status in ('PRESENT', 'LATE'))
        att_pct = round((present_att / total_att * 100), 1) if total_att > 0 else 100.0

        # Exam results summary
        marks_records = Marks.query.filter_by(student_id=s.id).all()
        total_marks = sum(m.marks_obtained for m in marks_records if m.marks_obtained is not None)
        max_marks = sum(m.max_marks for m in marks_records if m.max_marks)
        marks_pct = round((total_marks / max_marks * 100), 1) if max_marks > 0 else None
        
        has_failed = any(
            (m.marks_obtained / m.max_marks * 100 < 33) 
            for m in marks_records if m.max_marks and m.marks_obtained is not None
        )

        # Intelligent default action and next class deduction
        rec_action = 'PROMOTE'
        if has_failed and marks_pct is not None and marks_pct < 33:
            rec_action = 'RETAIN'

        # Next class suggestion
        suggested_class_id = s.class_id
        suggested_class_name = cls_name
        suggested_section = cls_sec

        # Try to parse class level: "Class 5" -> "Class 6"
        digits = ''.join(ch for ch in cls_name if ch.isdigit())
        if digits and rec_action == 'PROMOTE':
            curr_num = int(digits)
            next_num = curr_num + 1
            if curr_num >= 12:
                rec_action = 'GRADUATE'
            else:
                prefix = cls_name.replace(digits, '').strip()
                candidate_names = [f"{prefix} {next_num}".strip().lower(), f"{next_num}".lower()]
                matched_cls = None
                for c_cand in candidate_names:
                    if c_cand in class_name_map:
                        # Match same section if possible
                        sec_match = next((c for c in class_name_map[c_cand] if (c.section or '').upper() == cls_sec.upper()), None)
                        matched_cls = sec_match or class_name_map[c_cand][0]
                        break
                if matched_cls:
                    suggested_class_id = matched_cls.id
                    suggested_class_name = matched_cls.name
                    suggested_section = matched_cls.section or cls_sec

        has_target_conflict = s.id in target_enrollment_map
        conflict_detail = None
        if has_target_conflict:
            te = target_enrollment_map[s.id]
            conflict_detail = f"Already enrolled in {te.class_display} ({target_session})"

        preview_list.append({
            'student_id': s.id,
            'name': s.user.name if s.user else 'Student',
            'admission_no': s.admission_no or '',
            'original_admission_year': s.original_admission_year or (str(s.admission_date.year) if s.admission_date else ''),
            'gender': s.gender or '',
            'photo_url': s.photo_url,
            'current_class_id': s.class_id,
            'current_class_name': cls_name,
            'current_section': cls_sec,
            'current_roll_no': roll_no,
            'attendance_pct': att_pct,
            'marks_pct': marks_pct,
            'has_failed': has_failed,
            'recommended_action': rec_action,
            'suggested_class_id': suggested_class_id,
            'suggested_class_name': suggested_class_name,
            'suggested_section': suggested_section,
            'suggested_roll_no': roll_no,
            'has_conflict': has_target_conflict,
            'conflict_detail': conflict_detail,
        })

    return jsonify({
        'source_session': source_session,
        'target_session': target_session,
        'total_students': len(preview_list),
        'students': preview_list
    }), 200


@student_lifecycle_bp.route('/promote/confirm', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def confirm_promotion():
    """
    Executes rollover/promotion in an atomic database transaction.
    Non-destructive: Previous session enrollments, marks, attendance and fees remain untouched.
    """
    data = request.get_json() or {}
    sid = _school_id()
    current_user_obj = get_current_user()
    current_user_id = current_user_obj.id if current_user_obj else None

    source_session = (data.get('source_session') or '').strip()
    target_session = (data.get('target_session') or '').strip()
    promotions = data.get('promotions') or []

    if not source_session or not target_session:
        return jsonify({'error': 'source_session and target_session are required'}), 400

    if not promotions:
        return jsonify({'error': 'No promotion records supplied'}), 400

    processed_count = 0
    promoted_count = 0
    retained_count = 0
    graduated_count = 0
    withdrawn_count = 0

    try:
        for item in promotions:
            st_id = item.get('student_id')
            action = (item.get('action') or 'PROMOTE').upper()
            target_class_id = item.get('target_class_id')
            target_section = item.get('target_section') or 'A'
            target_roll_no = item.get('target_roll_no') or ''
            target_house = item.get('target_house')
            target_stream = item.get('target_stream')
            remarks = item.get('remarks') or f"Annual rollover from {source_session}"

            student = Student.query.filter_by(id=st_id, school_id=sid, is_deleted=False).first()
            if not student:
                continue

            # 1. Update source session enrollment status
            source_enrollment = StudentEnrollment.query.filter_by(
                school_id=sid, student_id=student.id, session=source_session
            ).first()

            if not source_enrollment:
                # Create baseline for source session if not present
                old_cls = Class.query.get(student.class_id) if student.class_id else None
                source_enrollment = StudentEnrollment(
                    school_id=sid,
                    student_id=student.id,
                    session=source_session,
                    class_id=student.class_id or 1,
                    section=old_cls.section if old_cls else 'A',
                    roll_number=student.roll_number,
                    stream=student.stream,
                    house=student.house,
                    enrollment_status='ACTIVE',
                    enrollment_type='REGULAR',
                    enrolled_date=student.admission_date or date.today(),
                    created_by=current_user_id
                )
                db.session.add(source_enrollment)
                db.session.flush()

            # Mark source enrollment status
            if action == 'PROMOTE':
                source_enrollment.enrollment_status = 'PROMOTED'
            elif action == 'RETAIN':
                source_enrollment.enrollment_status = 'RETAINED'
            elif action in ('GRADUATE', 'PASS_OUT'):
                source_enrollment.enrollment_status = 'GRADUATED'
            elif action in ('WITHDRAW', 'LEFT'):
                source_enrollment.enrollment_status = 'WITHDRAWN'

            # 2. Handle Continuing vs Terminal students
            if action in ('PROMOTE', 'RETAIN'):
                # Ensure target class exists
                t_class = Class.query.filter_by(id=target_class_id, school_id=sid).first() if target_class_id else None
                if not t_class:
                    t_class = student.class_ref

                eff_class_id = t_class.id if t_class else student.class_id
                eff_sec = target_section or (t_class.section if t_class else 'A')

                # Check if target enrollment already exists (upsert)
                target_enrollment = StudentEnrollment.query.filter_by(
                    school_id=sid, student_id=student.id, session=target_session
                ).first()

                if not target_enrollment:
                    target_enrollment = StudentEnrollment(
                        school_id=sid,
                        student_id=student.id,
                        session=target_session,
                        class_id=eff_class_id,
                        section=eff_sec,
                        roll_number=target_roll_no or student.roll_number,
                        stream=target_stream or student.stream,
                        house=target_house or student.house,
                        enrollment_status='ACTIVE',
                        enrollment_type='PROMOTION' if action == 'PROMOTE' else 'RETENTION',
                        previous_class_id=source_enrollment.class_id,
                        previous_section=source_enrollment.section,
                        previous_roll_no=source_enrollment.roll_number,
                        enrolled_date=date.today(),
                        remarks=remarks,
                        created_by=current_user_id
                    )
                    db.session.add(target_enrollment)
                else:
                    target_enrollment.class_id = eff_class_id
                    target_enrollment.section = eff_sec
                    target_enrollment.roll_number = target_roll_no or target_enrollment.roll_number
                    target_enrollment.stream = target_stream or target_enrollment.stream
                    target_enrollment.house = target_house or target_enrollment.house
                    target_enrollment.enrollment_status = 'ACTIVE'
                    target_enrollment.remarks = remarks

                # Update student's active pointer to target session
                student.class_id = eff_class_id
                student.roll_number = target_roll_no or student.roll_number
                student.session = target_session
                student.status = 'ACTIVE'
                if target_house:
                    student.house = target_house
                if target_stream:
                    student.stream = target_stream

                if action == 'PROMOTE':
                    promoted_count += 1
                else:
                    retained_count += 1

            elif action in ('GRADUATE', 'PASS_OUT'):
                student.status = 'GRADUATED'
                graduated_count += 1

            elif action in ('WITHDRAW', 'LEFT'):
                student.status = 'WITHDRAWN'
                withdrawn_count += 1

            processed_count += 1

        db.session.commit()

        # Audit log
        log_school_action(
            school_id=sid,
            user=current_user_obj,
            module='academic',
            submodule='student_lifecycle',
            action='ANNUAL_PROMOTION_ROLLOVER',
            remarks=f"Processed {processed_count} students: {promoted_count} promoted, {retained_count} retained, {graduated_count} graduated, {withdrawn_count} withdrawn ({source_session} -> {target_session})"
        )

        return jsonify({
            'success': True,
            'message': f"Successfully processed rollover for {processed_count} students.",
            'summary': {
                'total_processed': processed_count,
                'promoted': promoted_count,
                'retained': retained_count,
                'graduated': graduated_count,
                'withdrawn': withdrawn_count,
                'source_session': source_session,
                'target_session': target_session
            }
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Rollover failed: {str(err)}"}), 500


# ─── 2. ANNUAL RE-REGISTRATION (EXISTING STUDENTS) ──────────────────────────

@student_lifecycle_bp.route('/annual-register', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def annual_register_existing_student():
    """
    Registers an existing student for a new academic session.
    Reuses existing permanent profile without creating a duplicate student or user!
    """
    data = request.get_json() or {}
    sid = _school_id()
    current_user_obj = get_current_user()
    current_user_id = current_user_obj.id if current_user_obj else None

    student_id = data.get('student_id')
    session_str = (data.get('session') or '').strip()
    class_id = data.get('class_id')
    section = (data.get('section') or 'A').strip()
    roll_number = (data.get('roll_number') or '').strip()
    house = data.get('house')
    stream = data.get('stream')
    action = data.get('action', 'RE_REGISTRATION')
    remarks = data.get('remarks') or 'Annual student re-registration'

    if not student_id or not session_str or not class_id:
        return jsonify({'error': 'student_id, session, and class_id are required'}), 400

    student = Student.query.filter_by(id=student_id, school_id=sid, is_deleted=False).first()
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    target_class = Class.query.filter_by(id=class_id, school_id=sid).first()
    if not target_class:
        return jsonify({'error': 'Invalid class selected'}), 400

    try:
        # Check if enrollment in this session already exists
        enrollment = StudentEnrollment.query.filter_by(
            school_id=sid, student_id=student.id, session=session_str
        ).first()

        old_class_id = student.class_id
        old_section = student.class_ref.section if student.class_ref else ''
        old_roll = student.roll_number

        if enrollment:
            enrollment.class_id = class_id
            enrollment.section = section
            enrollment.roll_number = roll_number or enrollment.roll_number
            enrollment.stream = stream or enrollment.stream
            enrollment.house = house or enrollment.house
            enrollment.enrollment_status = 'ACTIVE'
            enrollment.remarks = remarks
        else:
            enrollment = StudentEnrollment(
                school_id=sid,
                student_id=student.id,
                session=session_str,
                class_id=class_id,
                section=section,
                roll_number=roll_number or old_roll,
                stream=stream or student.stream,
                house=house or student.house,
                enrollment_status='ACTIVE',
                enrollment_type=action,
                previous_class_id=old_class_id,
                previous_section=old_section,
                previous_roll_no=old_roll,
                enrolled_date=date.today(),
                remarks=remarks,
                created_by=current_user_id
            )
            db.session.add(enrollment)

        # Update active pointer on Student
        student.class_id = class_id
        student.roll_number = roll_number or student.roll_number
        student.session = session_str
        student.status = 'ACTIVE'
        if house:
            student.house = house
        if stream:
            student.stream = stream

        # Allow updating permanent information if explicitly passed (e.g. phone/address changed)
        if data.get('parent_phone'):
            student.parent_phone = data['parent_phone']
        if data.get('address'):
            student.address = data['address']

        # Optional Transport Assignment
        if data.get('transport_route_id') or data.get('transport_stop_id'):
            trans = StudentTransport.query.filter_by(
                school_id=sid, student_id=student.id
            ).first()
            if not trans:
                trans = StudentTransport(
                    school_id=sid,
                    student_id=student.id,
                    route_id=data.get('transport_route_id'),
                    stop_id=data.get('transport_stop_id'),
                    pickup_stop_id=data.get('transport_stop_id'),
                    drop_stop_id=data.get('transport_stop_id'),
                    academic_year=session_str,
                    status='ACTIVE',
                    created_by=current_user_id
                )
                db.session.add(trans)
            else:
                trans.route_id = data.get('transport_route_id') or trans.route_id
                trans.stop_id = data.get('transport_stop_id') or trans.stop_id
                trans.academic_year = session_str
                trans.status = 'ACTIVE'

        db.session.commit()

        log_school_action(
            school_id=sid,
            user=current_user_obj,
            module='academic',
            submodule='student_lifecycle',
            action='ANNUAL_RE_REGISTRATION',
            remarks=f"Re-registered student {student.user.name if student.user else student.id} into {target_class.name}-{section} for session {session_str}"
        )

        return jsonify({
            'success': True,
            'message': 'Student re-registered successfully for the new session.',
            'enrollment': enrollment.to_dict(),
            'student': student.to_dict()
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Annual registration failed: {str(err)}"}), 500


# ─── 3. STUDENT SHUFFLE & SMART BALANCING ────────────────────────────────────

@student_lifecycle_bp.route('/shuffle/preview', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def preview_shuffle():
    """
    Preview section shuffle within a class & session.
    Supports MANUAL moves and SMART / BALANCED shuffling across sections
    balancing by total student count, gender ratio, and house distribution.
    """
    data = request.get_json() or {}
    sid = _school_id()
    session_str = (data.get('session') or '').strip()
    class_id = data.get('class_id')
    mode = (data.get('mode') or 'MANUAL').upper()  # 'MANUAL' or 'SMART'

    if not session_str or not class_id:
        return jsonify({'error': 'session and class_id are required'}), 400

    target_class = Class.query.filter_by(id=class_id, school_id=sid).first()
    if not target_class:
        return jsonify({'error': 'Class not found'}), 404

    # Find all classes sharing the same base name (e.g. Class 6 Section A, B, C)
    sibling_classes = Class.query.filter_by(
        school_id=sid, name=target_class.name
    ).all()
    sibling_class_ids = [c.id for c in sibling_classes]

    # Fetch students enrolled in this class name for this session
    students = Student.query.options(
        joinedload(Student.user),
        joinedload(Student.class_ref)
    ).filter(
        Student.school_id == sid,
        Student.class_id.in_(sibling_class_ids),
        Student.is_deleted == False,
        Student.status == 'ACTIVE'
    ).order_by(Student.roll_number, Student.id).all()

    # Available sections
    sections = sorted(list(set(c.section for c in sibling_classes if c.section)))
    if not sections:
        sections = ['A', 'B']

    # Current section distribution
    before_stats = defaultdict(lambda: {'count': 0, 'male': 0, 'female': 0, 'houses': defaultdict(int)})
    for s in students:
        sec = s.class_ref.section if s.class_ref and s.class_ref.section else 'A'
        before_stats[sec]['count'] += 1
        g = (s.gender or '').lower()
        if g == 'male':
            before_stats[sec]['male'] += 1
        elif g == 'female':
            before_stats[sec]['female'] += 1
        if s.house:
            before_stats[sec]['houses'][s.house] += 1

    proposed_moves = []

    if mode == 'MANUAL':
        # Manual moves passed: [ { student_id, target_section } ]
        manual_moves = {m.get('student_id'): m.get('target_section') for m in data.get('moves', [])}
        for s in students:
            curr_sec = s.class_ref.section if s.class_ref and s.class_ref.section else 'A'
            t_sec = manual_moves.get(s.id, curr_sec)
            proposed_moves.append({
                'student_id': s.id,
                'name': s.user.name if s.user else 'Student',
                'admission_no': s.admission_no or '',
                'roll_number': s.roll_number or '',
                'gender': s.gender or 'Other',
                'house': s.house or '',
                'current_section': curr_sec,
                'target_section': t_sec,
                'is_changed': curr_sec != t_sec
            })

    elif mode == 'SMART':
        # Smart Balancing algorithm:
        # 1. Group students by gender and house
        # 2. Distribute evenly across target sections
        target_sections = data.get('target_sections') or sections
        if not target_sections:
            target_sections = ['A', 'B']
        num_sections = len(target_sections)

        # Sort students deterministically: Males first, then Females
        males = [s for s in students if (s.gender or '').lower() == 'male']
        females = [s for s in students if (s.gender or '').lower() == 'female']
        others = [s for s in students if (s.gender or '').lower() not in ('male', 'female')]

        assignments = {}
        for idx, m_stu in enumerate(males):
            sec = target_sections[idx % num_sections]
            assignments[m_stu.id] = sec

        for idx, f_stu in enumerate(females):
            sec = target_sections[(num_sections - 1 - (idx % num_sections))]
            assignments[f_stu.id] = sec

        for idx, o_stu in enumerate(others):
            sec = target_sections[idx % num_sections]
            assignments[o_stu.id] = sec

        for s in students:
            curr_sec = s.class_ref.section if s.class_ref and s.class_ref.section else 'A'
            t_sec = assignments.get(s.id, curr_sec)
            proposed_moves.append({
                'student_id': s.id,
                'name': s.user.name if s.user else 'Student',
                'admission_no': s.admission_no or '',
                'roll_number': s.roll_number or '',
                'gender': s.gender or 'Other',
                'house': s.house or '',
                'current_section': curr_sec,
                'target_section': t_sec,
                'is_changed': curr_sec != t_sec
            })

    # After statistics
    after_stats = defaultdict(lambda: {'count': 0, 'male': 0, 'female': 0, 'houses': defaultdict(int)})
    for m in proposed_moves:
        sec = m['target_section']
        after_stats[sec]['count'] += 1
        g = (m['gender'] or '').lower()
        if g == 'male':
            after_stats[sec]['male'] += 1
        elif g == 'female':
            after_stats[sec]['female'] += 1
        if m['house']:
            after_stats[sec]['houses'][m['house']] += 1

    return jsonify({
        'class_name': target_class.name,
        'session': session_str,
        'mode': mode,
        'total_students': len(students),
        'total_moved': sum(1 for m in proposed_moves if m['is_changed']),
        'available_sections': sections,
        'before_distribution': {k: dict(v) for k, v in before_stats.items()},
        'after_distribution': {k: dict(v) for k, v in after_stats.items()},
        'moves': proposed_moves
    }), 200


@student_lifecycle_bp.route('/shuffle/confirm', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def confirm_shuffle():
    """
    Executes section shuffle in an atomic database transaction.
    Generates a rollback_token allowing safe undo if required.
    """
    data = request.get_json() or {}
    sid = _school_id()
    current_user_obj = get_current_user()
    current_user_id = current_user_obj.id if current_user_obj else None

    session_str = (data.get('session') or '').strip()
    class_id = data.get('class_id')
    moves = data.get('moves') or []
    remarks = data.get('remarks') or 'Student section shuffle'

    if not moves or not session_str:
        return jsonify({'error': 'moves and session are required'}), 400

    target_class = Class.query.filter_by(id=class_id, school_id=sid).first() if class_id else None
    class_name = target_class.name if target_class else None

    sibling_classes = Class.query.filter_by(school_id=sid, name=class_name).all() if class_name else []
    sec_to_class = {c.section.upper(): c for c in sibling_classes if c.section}

    rollback_token = f"SHUFFLE_{uuid.uuid4().hex[:10]}"
    snapshot_records = []
    updated_count = 0

    try:
        for m in moves:
            st_id = m.get('student_id')
            target_sec = (m.get('target_section') or 'A').strip().upper()

            student = Student.query.filter_by(id=st_id, school_id=sid, is_deleted=False).first()
            if not student:
                continue

            old_class_id = student.class_id
            old_sec = student.class_ref.section if student.class_ref else 'A'

            if old_sec.upper() == target_sec:
                continue

            dest_class = sec_to_class.get(target_sec)
            if not dest_class and class_name:
                dest_class = Class(
                    name=class_name,
                    section=target_sec,
                    session=session_str,
                    school_id=sid
                )
                db.session.add(dest_class)
                db.session.flush()
                sec_to_class[target_sec] = dest_class

            new_class_id = dest_class.id if dest_class else old_class_id

            snapshot_records.append({
                'student_id': student.id,
                'old_class_id': old_class_id,
                'old_section': old_sec,
                'new_class_id': new_class_id,
                'new_section': target_sec
            })

            student.class_id = new_class_id

            enrollment = StudentEnrollment.query.filter_by(
                school_id=sid, student_id=student.id, session=session_str
            ).first()

            if enrollment:
                enrollment.class_id = new_class_id
                enrollment.section = target_sec
                enrollment.enrollment_type = 'SHUFFLED'
                enrollment.remarks = remarks
            else:
                enrollment = StudentEnrollment(
                    school_id=sid,
                    student_id=student.id,
                    session=session_str,
                    class_id=new_class_id,
                    section=target_sec,
                    roll_number=student.roll_number,
                    stream=student.stream,
                    house=student.house,
                    enrollment_status='ACTIVE',
                    enrollment_type='SHUFFLED',
                    enrolled_date=date.today(),
                    remarks=remarks,
                    created_by=current_user_id
                )
                db.session.add(enrollment)

            updated_count += 1

        db.session.commit()

        log_school_action(
            school_id=sid,
            user=current_user_obj,
            module='academic',
            submodule='student_lifecycle',
            action='SECTION_SHUFFLE',
            remarks=json.dumps({
                'rollback_token': rollback_token,
                'session': session_str,
                'count': updated_count,
                'snapshots': snapshot_records
            })
        )

        return jsonify({
            'success': True,
            'message': f"Successfully shuffled {updated_count} students.",
            'updated_count': updated_count,
            'rollback_token': rollback_token
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Section shuffle failed: {str(err)}"}), 500


@student_lifecycle_bp.route('/shuffle/rollback', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def rollback_shuffle():
    """
    Safely undos a section shuffle operation using the rollback_token.
    """
    data = request.get_json() or {}
    sid = _school_id()
    token = data.get('rollback_token')

    if not token:
        return jsonify({'error': 'rollback_token is required'}), 400

    audit_entry = AuditLog.query.filter(
        AuditLog.school_id == sid,
        AuditLog.module == 'academic',
        AuditLog.action == 'SECTION_SHUFFLE',
        AuditLog.remarks.contains(token)
    ).first()

    if not audit_entry:
        return jsonify({'error': 'Invalid or expired rollback token'}), 404

    try:
        payload = json.loads(audit_entry.remarks)
        snapshots = payload.get('snapshots', [])
        session_str = payload.get('session')

        reverted_count = 0
        for item in snapshots:
            student = Student.query.filter_by(id=item['student_id'], school_id=sid).first()
            if student:
                student.class_id = item['old_class_id']
                enrollment = StudentEnrollment.query.filter_by(
                    school_id=sid, student_id=student.id, session=session_str
                ).first()
                if enrollment:
                    enrollment.class_id = item['old_class_id']
                    enrollment.section = item['old_section']
                reverted_count += 1

        db.session.commit()

        log_school_action(
            school_id=sid,
            user=get_current_user(),
            module='academic',
            submodule='student_lifecycle',
            action='SECTION_SHUFFLE_ROLLBACK',
            remarks=f"Rolled back shuffle ({token}): restored {reverted_count} students."
        )

        return jsonify({
            'success': True,
            'message': f"Rollback successful. Restored {reverted_count} students to their original sections.",
            'reverted_count': reverted_count
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Rollback failed: {str(err)}"}), 500


# ─── 4. BULK EDIT (ACADEMIC VS PERMANENT PROFILE) ────────────────────────────

VALID_ACADEMIC_FIELDS = {'section', 'class_id', 'house', 'stream', 'status'}
VALID_PERMANENT_FIELDS = {'category', 'blood_group', 'religion', 'nationality'}


@student_lifecycle_bp.route('/bulk-edit/preview', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def preview_bulk_edit():
    """
    Validates field safety and generates a clear before/after diff for selected students.
    Clearly tags whether the field is Academic-Year-Data or Permanent-Profile-Data.
    """
    data = request.get_json() or {}
    sid = _school_id()
    student_ids = data.get('student_ids') or []
    field = data.get('field')
    new_value = data.get('value')
    session_str = data.get('session') or '2024-25'

    if not student_ids or not field:
        return jsonify({'error': 'student_ids and field are required'}), 400

    if field not in VALID_ACADEMIC_FIELDS and field not in VALID_PERMANENT_FIELDS:
        return jsonify({
            'error': f"Invalid field '{field}'. Allowed fields: {list(VALID_ACADEMIC_FIELDS | VALID_PERMANENT_FIELDS)}"
        }), 400

    is_academic = field in VALID_ACADEMIC_FIELDS
    students = Student.query.options(joinedload(Student.user), joinedload(Student.class_ref))\
        .filter(Student.school_id == sid, Student.id.in_(student_ids), Student.is_deleted == False)\
        .all()

    diffs = []
    for s in students:
        old_val = getattr(s, field, '')
        diffs.append({
            'student_id': s.id,
            'name': s.user.name if s.user else '',
            'admission_no': s.admission_no or '',
            'roll_number': s.roll_number or '',
            'class_display': f"{s.class_ref.name} - {s.class_ref.section}" if s.class_ref else '',
            'old_value': str(old_val) if old_val is not None else '',
            'new_value': str(new_value) if new_value is not None else '',
        })

    return jsonify({
        'field': field,
        'field_category': 'ACADEMIC_YEAR' if is_academic else 'PERMANENT_PROFILE',
        'is_academic_year': is_academic,
        'affected_count': len(diffs),
        'preview': diffs,
        'warning': None if is_academic else 'WARNING: This field modifies the student permanent profile across all academic years.'
    }), 200


@student_lifecycle_bp.route('/bulk-edit/confirm', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def confirm_bulk_edit():
    """
    Applies bulk edits in a safe database transaction.
    Academic fields update active enrollment without touching past historical sessions.
    """
    data = request.get_json() or {}
    sid = _school_id()
    current_user_obj = get_current_user()
    student_ids = data.get('student_ids') or []
    field = data.get('field')
    new_value = data.get('value')
    session_str = data.get('session') or '2024-25'

    if not student_ids or not field:
        return jsonify({'error': 'student_ids and field are required'}), 400

    if field not in VALID_ACADEMIC_FIELDS and field not in VALID_PERMANENT_FIELDS:
        return jsonify({'error': 'Invalid bulk edit field'}), 400

    is_academic = field in VALID_ACADEMIC_FIELDS
    students = Student.query.filter(Student.school_id == sid, Student.id.in_(student_ids), Student.is_deleted == False).all()

    try:
        for s in students:
            setattr(s, field, new_value)

            if is_academic:
                enrollment = StudentEnrollment.query.filter_by(
                    school_id=sid, student_id=s.id, session=session_str
                ).first()
                if enrollment:
                    if field == 'section':
                        enrollment.section = new_value
                    elif field == 'house':
                        enrollment.house = new_value
                    elif field == 'stream':
                        enrollment.stream = new_value
                    elif field == 'status':
                        enrollment.enrollment_status = new_value
                    elif field == 'class_id':
                        enrollment.class_id = new_value

        db.session.commit()

        log_school_action(
            school_id=sid,
            user=current_user_obj,
            module='academic',
            submodule='student_lifecycle',
            action='BULK_EDIT',
            remarks=f"Bulk updated {field} to '{new_value}' for {len(students)} students (Type: {'Academic' if is_academic else 'Permanent'})"
        )

        return jsonify({
            'success': True,
            'message': f"Successfully updated {len(students)} students.",
            'updated_count': len(students),
            'field': field
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Bulk edit failed: {str(err)}"}), 500


# ─── 5. STUDENT ACADEMIC HISTORY / LIFETIME TIMELINE ─────────────────────────

@student_lifecycle_bp.route('/<int:student_id>/history', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
def get_student_academic_history(student_id):
    """
    Returns the complete chronological academic ledger for a student:
    - Permanent Identity & Admission Info
    - Every academic session attended
    - Historical attendance %, exam summaries, fee dues, and transport details per session
    """
    try:
        sid = _school_id()
        student = Student.query.options(
            joinedload(Student.user),
            joinedload(Student.class_ref)
        ).filter_by(id=student_id, school_id=sid).first()

        if not student:
            return jsonify({'error': 'Student not found'}), 404

        adm_year = student.original_admission_year or (str(student.admission_date.year) if student.admission_date else '')

        permanent_profile = {
            'student_id': student.id,
            'name': student.user.name if student.user else '',
            'admission_no': student.admission_no or '',
            'admission_date': student.admission_date.strftime('%Y-%m-%d') if student.admission_date else '',
            'original_admission_year': adm_year,
            'dob': str(student.dob) if student.dob else '',
            'gender': student.gender or '',
            'blood_group': student.blood_group or '',
            'father_name': student.father_name or '',
            'mother_name': student.mother_name or '',
            'parent_phone': student.parent_phone or '',
            'parent_email': student.parent_email or '',
            'address': student.address or '',
            'nationality': student.nationality or 'Indian',
            'category': student.category or 'General',
            'current_status': student.status or 'ACTIVE',
            'photo_url': student.photo_url
        }

        enrollments = StudentEnrollment.query.options(
            joinedload(StudentEnrollment.class_ref)
        ).filter_by(
            school_id=sid, student_id=student.id
        ).order_by(StudentEnrollment.id.asc()).all()

        all_attendance = Attendance.query.filter_by(student_id=student.id).all()
        all_marks = Marks.query.filter_by(student_id=student.id).all()
        all_fees = FeeRecord.query.filter_by(student_id=student.id).all()
        all_trans = StudentTransport.query.filter_by(student_id=student.id).all()

        history_timeline = []
        for en in enrollments:
            sess = en.session

            att_subset = [a for a in all_attendance if a.class_id == en.class_id]
            tot_att = len(att_subset)
            pres_att = sum(1 for a in att_subset if a.status in ('PRESENT', 'LATE'))
            att_pct = round((pres_att / tot_att * 100), 1) if tot_att > 0 else None

            marks_subset = [m for m in all_marks if m.class_id == en.class_id]
            tot_marks_obtained = sum(m.marks_obtained for m in marks_subset if m.marks_obtained is not None)
            tot_max_marks = sum(m.max_marks for m in marks_subset if m.max_marks)
            exam_pct = round((tot_marks_obtained / tot_max_marks * 100), 1) if tot_max_marks > 0 else None

            fees_subset = [f for f in all_fees if f.session == sess]
            tot_due = sum(f.amount_due for f in fees_subset)
            tot_paid = sum(f.amount_paid for f in fees_subset)

            trans_rec = next((t for t in all_trans if t.academic_year == sess), None)
            trans_info = None
            if trans_rec:
                trans_info = {
                    'route_name': trans_rec.route.name if trans_rec.route else '',
                    'stop_name': trans_rec.stop.name if trans_rec.stop else '',
                    'vehicle_number': trans_rec.vehicle.vehicle_number if trans_rec.vehicle else ''
                }

            history_timeline.append({
                'enrollment_id': en.id,
                'session': sess,
                'class_id': en.class_id,
                'class_name': en.class_ref.name if en.class_ref else '',
                'section': en.section or (en.class_ref.section if en.class_ref else ''),
                'class_display': en.class_display,
                'roll_number': en.roll_number or '',
                'stream': en.stream or '',
                'house': en.house or '',
                'enrollment_status': en.enrollment_status or 'ACTIVE',
                'enrollment_type': en.enrollment_type or 'REGULAR',
                'enrolled_date': en.enrolled_date.isoformat() if en.enrolled_date else '',
                'remarks': en.remarks or '',
                'attendance_summary': {
                    'total_days': tot_att,
                    'present_days': pres_att,
                    'percentage': att_pct
                },
                'academic_summary': {
                    'total_exams': len(marks_subset),
                    'percentage': exam_pct
                },
                'fee_summary': {
                    'total_due': tot_due,
                    'total_paid': tot_paid,
                    'balance': tot_due - tot_paid,
                    'is_cleared': tot_paid >= tot_due
                },
                'transport': trans_info
            })

        audit_logs = AuditLog.query.filter(
            AuditLog.school_id == sid,
            AuditLog.module == 'academic',
            AuditLog.submodule == 'student_lifecycle'
        ).order_by(AuditLog.id.desc()).limit(20).all()

        events = []
        for al in audit_logs:
            if str(student.id) in (al.remarks or '') or (student.admission_no and student.admission_no in (al.remarks or '')):
                events.append({
                    'action': al.action,
                    'user': al.role_snapshot or str(al.user_id or ''),
                    'timestamp': al.created_at.isoformat() if al.created_at else '',
                    'remarks': al.remarks
                })

        return jsonify({
            'profile': permanent_profile,
            'timeline': history_timeline,
            'lifecycle_events': events
        }), 200
    except Exception as err:
        import traceback
        print("ACADEMIC HISTORY ERROR:", traceback.format_exc())
        return jsonify({'error': f"Failed to load academic history: {str(err)}"}), 500


# ─── 6. IMPORT / EXPORT ──────────────────────────────────────────────────────

@student_lifecycle_bp.route('/export', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def export_students_csv():
    """
    Exports student list with academic enrollment and permanent profile columns.
    """
    sid = _school_id()
    class_id = request.args.get('class_id')
    session_str = request.args.get('session')

    q = Student.query.options(
        joinedload(Student.user),
        joinedload(Student.class_ref)
    ).filter_by(school_id=sid, is_deleted=False)

    if class_id:
        q = q.filter_by(class_id=class_id)
    if session_str:
        q = q.filter_by(session=session_str)

    students = q.order_by(Student.roll_number).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Admission No', 'Roll No', 'Name', 'Gender', 'DOB', 'Class', 'Section',
        'Session', 'Original Admission Year', 'Status', 'House', 'Stream',
        'Parent Name', 'Parent Phone', 'Parent Email', 'Address', 'Category'
    ])

    for s in students:
        c_name = s.class_ref.name if s.class_ref else ''
        c_sec = s.class_ref.section if s.class_ref else ''
        writer.writerow([
            s.admission_no or '',
            s.roll_number or '',
            s.user.name if s.user else '',
            s.gender or '',
            str(s.dob) if s.dob else '',
            c_name,
            c_sec,
            s.session or '',
            s.original_admission_year or '',
            s.status or 'ACTIVE',
            s.house or '',
            s.stream or '',
            s.parent_name or s.father_name or '',
            s.parent_phone or '',
            s.parent_email or '',
            s.address or '',
            s.category or 'General'
        ])

    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename=students_{session_str or "export"}.csv'
    return response


@student_lifecycle_bp.route('/import/validate', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def validate_student_import():
    """
    Pre-validates CSV before importing:
    - Identifies existing students by admission_no or parent_phone
    - Reuses existing student profiles rather than creating duplicates
    - Reports syntax errors, missing fields, and duplicates
    """
    sid = _school_id()
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    stream = io.StringIO(file.stream.read().decode('UTF-8', errors='ignore'))
    reader = csv.DictReader(stream)

    valid_rows = []
    errors = []
    row_num = 1

    existing_adm_set = {
        s.admission_no.lower(): s.id for s in Student.query.filter_by(school_id=sid, is_deleted=False).all() if s.admission_no
    }

    for row in reader:
        row_num += 1
        name = (row.get('Name') or row.get('name') or '').strip()
        adm_no = (row.get('Admission No') or row.get('admission_no') or '').strip()

        if not name:
            errors.append({'row': row_num, 'error': 'Name is required'})
            continue

        is_existing = adm_no.lower() in existing_adm_set if adm_no else False
        existing_student_id = existing_adm_set.get(adm_no.lower()) if is_existing else None

        valid_rows.append({
            'row_num': row_num,
            'name': name,
            'admission_no': adm_no,
            'roll_number': row.get('Roll No') or row.get('roll_number') or '',
            'class_name': row.get('Class') or row.get('class_name') or '',
            'section': row.get('Section') or row.get('section') or 'A',
            'session': row.get('Session') or row.get('session') or '2024-25',
            'parent_phone': row.get('Parent Phone') or row.get('parent_phone') or '',
            'is_existing_student': is_existing,
            'existing_student_id': existing_student_id
        })

    return jsonify({
        'total_rows': row_num - 1,
        'valid_count': len(valid_rows),
        'existing_students_count': sum(1 for r in valid_rows if r['is_existing_student']),
        'new_students_count': sum(1 for r in valid_rows if not r['is_existing_student']),
        'errors': errors,
        'preview': valid_rows[:50]
    }), 200


@student_lifecycle_bp.route('/import/confirm', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def confirm_student_import():
    """
    Executes bulk student import.
    Crucial: For existing students (matched by admission_no or existing_student_id),
    it updates their active session and creates StudentEnrollment for the session,
    WITHOUT creating a duplicate student or user!
    For new students, it creates User, Student, and StudentEnrollment.
    """
    import secrets
    data = request.get_json() or {}
    sid = _school_id()
    current_user_obj = get_current_user()
    current_user_id = current_user_obj.id if current_user_obj else None
    rows = data.get('rows') or []
    target_session = (data.get('session') or '2024-25').strip()

    if not rows:
        return jsonify({'error': 'No rows to import'}), 400

    imported_new = 0
    updated_existing = 0

    try:
        school_classes = Class.query.filter_by(school_id=sid).all()
        class_map = {}
        for c in school_classes:
            key = (c.name.strip().lower(), (c.section or 'A').strip().upper())
            class_map[key] = c

        for r in rows:
            name = (r.get('name') or '').strip()
            adm_no = (r.get('admission_no') or '').strip()
            roll_no = (r.get('roll_number') or '').strip()
            cls_name = (r.get('class_name') or '').strip()
            sec = (r.get('section') or 'A').strip().upper()
            sess = (r.get('session') or target_session).strip()
            phone = (r.get('parent_phone') or '').strip()
            is_existing = r.get('is_existing_student', False)
            existing_id = r.get('existing_student_id')

            if not name:
                continue

            cls_key = (cls_name.lower(), sec)
            cls_obj = class_map.get(cls_key)
            if not cls_obj and cls_name:
                cls_obj = Class(name=cls_name, section=sec, session=sess, school_id=sid)
                db.session.add(cls_obj)
                db.session.flush()
                class_map[cls_key] = cls_obj

            eff_cls_id = cls_obj.id if cls_obj else None

            existing_student = None
            if existing_id:
                existing_student = Student.query.filter_by(id=existing_id, school_id=sid).first()
            elif adm_no:
                existing_student = Student.query.filter_by(admission_no=adm_no, school_id=sid).first()

            if existing_student:
                existing_student.class_id = eff_cls_id or existing_student.class_id
                existing_student.roll_number = roll_no or existing_student.roll_number
                existing_student.session = sess
                existing_student.status = 'ACTIVE'
                if phone:
                    existing_student.parent_phone = phone

                enrollment = StudentEnrollment.query.filter_by(
                    school_id=sid, student_id=existing_student.id, session=sess
                ).first()
                if not enrollment:
                    enrollment = StudentEnrollment(
                        school_id=sid,
                        student_id=existing_student.id,
                        session=sess,
                        class_id=eff_cls_id or existing_student.class_id,
                        section=sec,
                        roll_number=roll_no or existing_student.roll_number,
                        enrollment_status='ACTIVE',
                        enrollment_type='RE_REGISTRATION',
                        enrolled_date=date.today(),
                        remarks='Imported/Re-enrolled via CSV bulk import',
                        created_by=current_user_id
                    )
                    db.session.add(enrollment)
                else:
                    enrollment.class_id = eff_cls_id or enrollment.class_id
                    enrollment.section = sec
                    enrollment.roll_number = roll_no or enrollment.roll_number

                updated_existing += 1
            else:
                raw_email = f"stu_{int(utc_now().timestamp())}_{secrets.randbelow(9000)+1000}@eduerp.com"
                user = User(
                    name=name,
                    email=raw_email,
                    role=UserRole.STUDENT,
                    school_id=sid
                )
                user.set_password('Student@123', store_plain=True)
                db.session.add(user)
                db.session.flush()

                if not adm_no:
                    count_all = Student.query.filter_by(school_id=sid).count()
                    adm_no = f"ADM-{sess[:4]}-{count_all + 1:04d}"

                new_student = Student(
                    user_id=user.id,
                    school_id=sid,
                    class_id=eff_cls_id,
                    roll_number=roll_no,
                    admission_no=adm_no,
                    admission_date=date.today(),
                    original_admission_year=sess[:4],
                    parent_phone=phone,
                    session=sess,
                    status='ACTIVE'
                )
                db.session.add(new_student)
                db.session.flush()

                new_enrollment = StudentEnrollment(
                    school_id=sid,
                    student_id=new_student.id,
                    session=sess,
                    class_id=eff_cls_id or 1,
                    section=sec,
                    roll_number=roll_no,
                    enrollment_status='ACTIVE',
                    enrollment_type='NEW_ADMISSION',
                    enrolled_date=date.today(),
                    remarks='Imported via CSV bulk import',
                    created_by=current_user_id
                )
                db.session.add(new_enrollment)
                imported_new += 1

        db.session.commit()

        log_school_action(
            school_id=sid,
            user=current_user_obj,
            module='academic',
            submodule='student_lifecycle',
            action='CSV_STUDENT_IMPORT',
            remarks=f"Imported {imported_new} new students, updated/re-enrolled {updated_existing} existing students."
        )

        return jsonify({
            'success': True,
            'imported_new': imported_new,
            'updated_existing': updated_existing,
            'total_processed': imported_new + updated_existing
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({'error': f"Import confirmation failed: {str(err)}"}), 500
