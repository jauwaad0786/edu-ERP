from datetime import date, datetime, timedelta
from sqlalchemy import func, or_, and_
from app import db
from app.models.curriculum import (
    Curriculum, CurriculumChapter, CurriculumTopic,
    TeachingLog, TeachingWorksheet
)
from app.models.academic import Class, Subject, Teacher
from app.models.financial import Timetable, TimetablePeriod
from app.models.user import User


# ─── Configurable Gap Thresholds ──────────────────────────────────────────────
GAP_THRESHOLD_AHEAD    = 5.0     # > +5%
GAP_THRESHOLD_BEHIND   = -5.0    # < -5%
GAP_THRESHOLD_CRITICAL = -20.0   # < -20%


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CURRICULUM SETUP & BATCH CREATION
# ═══════════════════════════════════════════════════════════════════════════════

def get_or_create_curriculum(school_id, session, class_id, subject_id, data, user_id):
    """
    Creates or updates the curriculum container for a subject in a session.
    """
    curriculum = Curriculum.query.filter_by(
        school_id=school_id, session=session,
        class_id=class_id, subject_id=subject_id
    ).first()

    if not curriculum:
        curriculum = Curriculum(
            school_id=school_id,
            session=session,
            class_id=class_id,
            subject_id=subject_id,
            book_name=data.get('book_name', 'Textbook'),
            publisher=data.get('publisher', ''),
            book_code=data.get('book_code', ''),
            total_chapters=data.get('total_chapters', 0),
            estimated_periods=data.get('estimated_periods', 0),
            description=data.get('description', ''),
            status=data.get('status', 'ACTIVE'),
            created_by=user_id
        )
        db.session.add(curriculum)
    else:
        if 'book_name' in data: curriculum.book_name = data['book_name']
        if 'publisher' in data: curriculum.publisher = data['publisher']
        if 'book_code' in data: curriculum.book_code = data['book_code']
        if 'total_chapters' in data: curriculum.total_chapters = data['total_chapters']
        if 'estimated_periods' in data: curriculum.estimated_periods = data['estimated_periods']
        if 'description' in data: curriculum.description = data['description']
        if 'status' in data: curriculum.status = data['status']

    db.session.commit()
    return curriculum


def batch_generate_chapters(curriculum_id, chapters_data, school_id):
    """
    Fast chapter generation workflow:
    Accepts an array of chapter definitions and creates or updates them.
    """
    curriculum = Curriculum.query.filter_by(id=curriculum_id, school_id=school_id).first_or_404()
    created_count = 0
    updated_count = 0

    for idx, ch in enumerate(chapters_data, start=1):
        ch_no = ch.get('chapter_no', idx)
        existing = CurriculumChapter.query.filter_by(
            curriculum_id=curriculum.id, chapter_no=ch_no
        ).first()

        def parse_d(val):
            if not val: return None
            if isinstance(val, date): return val
            try: return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
            except Exception: return None

        p_start = parse_d(ch.get('planned_start_date'))
        p_end   = parse_d(ch.get('planned_completion_date'))

        if existing:
            existing.title = ch.get('title', existing.title)
            existing.description = ch.get('description', existing.description)
            existing.estimated_periods = int(ch.get('estimated_periods', existing.estimated_periods or 1))
            existing.weightage = float(ch.get('weightage', existing.weightage or 0.0))
            existing.planned_start_date = p_start or existing.planned_start_date
            existing.planned_completion_date = p_end or existing.planned_completion_date
            existing.learning_outcomes = ch.get('learning_outcomes', existing.learning_outcomes)
            existing.sort_order = int(ch.get('sort_order', ch_no))
            updated_count += 1
        else:
            new_ch = CurriculumChapter(
                school_id=school_id,
                curriculum_id=curriculum.id,
                chapter_no=ch_no,
                title=ch.get('title', f"Chapter {ch_no}"),
                description=ch.get('description', ''),
                estimated_periods=int(ch.get('estimated_periods', 1)),
                weightage=float(ch.get('weightage', 0.0)),
                planned_start_date=p_start,
                planned_completion_date=p_end,
                status=ch.get('status', 'NOT_STARTED'),
                learning_outcomes=ch.get('learning_outcomes', ''),
                sort_order=int(ch.get('sort_order', ch_no)),
                is_active=True
            )
            db.session.add(new_ch)
            created_count += 1

    curriculum.total_chapters = curriculum.chapters.count() + created_count
    db.session.commit()

    return {
        'curriculum_id': curriculum.id,
        'created_count': created_count,
        'updated_count': updated_count,
        'total_chapters': curriculum.total_chapters
    }


def copy_curriculum_to_session(curriculum_id, target_session, school_id, user_id):
    """
    Copies Book, Chapters, Topics, and Estimated Periods to a new academic session.
    NEVER copies historical teaching logs, actual completion dates, homework, or worksheets.
    """
    source = Curriculum.query.filter_by(id=curriculum_id, school_id=school_id).first_or_404()

    # Check if curriculum already exists in target session
    existing = Curriculum.query.filter_by(
        school_id=school_id, session=target_session,
        class_id=source.class_id, subject_id=source.subject_id
    ).first()

    if existing:
        raise ValueError(f"Curriculum for {target_session} already exists for this Class & Subject.")

    new_curr = Curriculum(
        school_id=school_id,
        session=target_session,
        class_id=source.class_id,
        subject_id=source.subject_id,
        book_name=source.book_name,
        publisher=source.publisher,
        book_code=source.book_code,
        total_chapters=source.total_chapters,
        estimated_periods=source.estimated_periods,
        description=f"Copied from session {source.session}. {source.description or ''}",
        status='ACTIVE',
        created_by=user_id
    )
    db.session.add(new_curr)
    db.session.flush()

    for ch in source.chapters.order_by(CurriculumChapter.chapter_no.asc()).all():
        new_ch = CurriculumChapter(
            school_id=school_id,
            curriculum_id=new_curr.id,
            chapter_no=ch.chapter_no,
            title=ch.title,
            description=ch.description,
            estimated_periods=ch.estimated_periods,
            weightage=ch.weightage,
            planned_start_date=None,        # Reset dates for new academic year
            planned_completion_date=None,
            actual_start_date=None,
            actual_completion_date=None,
            status='NOT_STARTED',           # Clean start
            learning_outcomes=ch.learning_outcomes,
            sort_order=ch.sort_order,
            is_active=True
        )
        db.session.add(new_ch)
        db.session.flush()

        for tp in ch.topics.order_by(CurriculumTopic.topic_no.asc()).all():
            new_tp = CurriculumTopic(
                school_id=school_id,
                chapter_id=new_ch.id,
                topic_no=tp.topic_no,
                title=tp.title,
                description=tp.description,
                sub_topics=tp.sub_topics,
                estimated_periods=tp.estimated_periods,
                planned_start_date=None,
                planned_completion_date=None,
                actual_start_date=None,
                actual_completion_date=None,
                learning_objectives=tp.learning_objectives,
                status='NOT_STARTED',
                sort_order=tp.sort_order,
                is_active=True
            )
            db.session.add(new_tp)

    db.session.commit()
    return new_curr


# ═══════════════════════════════════════════════════════════════════════════════
# 2. TEACHER DAILY TEACHING DIARY ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def get_teacher_today_schedule(teacher_id, school_id, target_date=None, session=None):
    """
    Retrieves today's timetable periods for the teacher, matches them with
    any recorded TeachingLog for target_date, and provides fast action states:
    - ✓ Teaching Recorded (status: RECORDED)
    - ⚠ Update Required  (status: PENDING)
    If timetable is not configured, provides slots from assigned classes & subjects.
    """
    if not target_date:
        target_date = date.today()
    elif isinstance(target_date, str):
        target_date = datetime.strptime(target_date[:10], '%Y-%m-%d').date()

    day_code = target_date.strftime('%a').upper()  # MON, TUE, WED, THU, FRI, SAT, SUN
    day_map = {
        'MON': 'MON', 'TUE': 'TUE', 'WED': 'WED',
        'THU': 'THU', 'FRI': 'FRI', 'SAT': 'SAT', 'SUN': 'SUN'
    }
    cur_day = day_map.get(day_code[:3], 'MON')

    teacher = Teacher.query.filter_by(id=teacher_id, school_id=school_id).first_or_404()

    # 1. Fetch published timetable periods for this teacher today
    tt_q = TimetablePeriod.query.join(
        Timetable, TimetablePeriod.timetable_id == Timetable.id
    ).filter(
        Timetable.school_id == school_id,
        Timetable.status == 'PUBLISHED',
        TimetablePeriod.teacher_id == teacher_id,
        TimetablePeriod.day == cur_day,
        TimetablePeriod.is_break == False
    )
    if session:
        tt_q = tt_q.filter(Timetable.session == session)

    periods = tt_q.order_by(TimetablePeriod.period_no.asc()).all()

    # 2. Fetch all teaching logs recorded by this teacher on target_date
    logs = TeachingLog.query.filter_by(
        school_id=school_id, teacher_id=teacher_id, date=target_date
    ).all()
    log_map = {}
    for l in logs:
        # Map by period_no + class_id + subject_id
        key = f"{l.period_no}_{l.class_id}_{l.subject_id}"
        log_map[key] = l
        if l.timetable_period_id:
            log_map[f"tp_{l.timetable_period_id}"] = l

    schedule_items = []
    has_timetable = len(periods) > 0

    if has_timetable:
        for p in periods:
            cls = Class.query.get(p.timetable.class_id) if p.timetable else None
            cls_name = f"{cls.name} - {cls.section}" if cls else ''
            sub_name = p.subject.name if p.subject else ''
            sub_code = p.subject.code if p.subject else ''

            matched_log = log_map.get(f"tp_{p.id}") or log_map.get(f"{p.period_no}_{p.timetable.class_id}_{p.subject_id}")

            schedule_items.append({
                'source':               'TIMETABLE',
                'timetable_period_id':  p.id,
                'period_no':            p.period_no,
                'start_time':           p.start_time or '',
                'end_time':             p.end_time or '',
                'room':                 p.room or '',
                'class_id':             p.timetable.class_id,
                'class_name':           cls_name,
                'subject_id':           p.subject_id,
                'subject_name':         sub_name,
                'subject_code':         sub_code,
                'status':               'RECORDED' if matched_log else 'PENDING',
                'teaching_log':         matched_log.to_dict() if matched_log else None,
            })
    else:
        # Fallback: list all subjects assigned to this teacher
        assigned_subs = Subject.query.filter_by(teacher_id=teacher.id).all()
        for s in assigned_subs:
            cls = s.class_ref
            cls_name = f"{cls.name} - {cls.section}" if cls else ''

            # Check if any log recorded today for this subject
            sub_logs = [l for l in logs if l.subject_id == s.id]

            schedule_items.append({
                'source':               'ASSIGNED_SUBJECT',
                'timetable_period_id':  None,
                'period_no':            sub_logs[0].period_no if sub_logs else 1,
                'start_time':           '',
                'end_time':             '',
                'room':                 '',
                'class_id':             s.class_id,
                'class_name':           cls_name,
                'subject_id':           s.id,
                'subject_name':         s.name,
                'subject_code':         s.code or '',
                'status':               'RECORDED' if sub_logs else 'PENDING',
                'teaching_log':         sub_logs[0].to_dict() if sub_logs else None,
            })

    # Summary counts
    total_slots = len(schedule_items)
    recorded_count = sum(1 for item in schedule_items if item['status'] == 'RECORDED')
    pending_count = total_slots - recorded_count

    return {
        'teacher_id':     teacher.id,
        'teacher_name':   teacher.user.name if teacher.user else '',
        'date':           target_date.isoformat(),
        'day':            cur_day,
        'has_timetable':  has_timetable,
        'total_slots':    total_slots,
        'recorded_count': recorded_count,
        'pending_count':  pending_count,
        'schedule':       schedule_items,
    }


def record_teaching_log(school_id, teacher_id, user_id, data):
    """
    Creates or edits a daily teaching log entry.
    Validates permissions, updates topic & chapter completion status,
    and creates optional linked homework and worksheet.
    """
    log_id = data.get('id')

    def parse_d(val):
        if not val: return None
        if isinstance(val, date): return val
        try: return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception: return None

    entry_date = parse_d(data.get('date')) or date.today()
    class_id   = int(data.get('class_id'))
    subject_id = int(data.get('subject_id'))
    period_no  = int(data.get('period_no', 1))
    session    = data.get('session', '2026-27')

    chapter_id = int(data['chapter_id']) if data.get('chapter_id') else None
    topic_id   = int(data['topic_id']) if data.get('topic_id') else None

    # Validate Teacher Assignment to Class / Subject
    sub = Subject.query.filter_by(id=subject_id, class_id=class_id).first()
    if not sub:
        raise ValueError(f"Subject #{subject_id} is not part of Class #{class_id}.")

    if log_id:
        log = TeachingLog.query.filter_by(id=log_id, school_id=school_id).first_or_404()
        log.updated_by = user_id
    else:
        # Check for existing log in same slot to prevent duplicates
        existing = TeachingLog.query.filter_by(
            school_id=school_id, teacher_id=teacher_id,
            date=entry_date, period_no=period_no,
            class_id=class_id, subject_id=subject_id
        ).first()
        if existing:
            log = existing
            log.updated_by = user_id
        else:
            log = TeachingLog(
                school_id=school_id,
                session=session,
                teacher_id=teacher_id,
                class_id=class_id,
                subject_id=subject_id,
                date=entry_date,
                period_no=period_no,
                created_by=user_id
            )
            db.session.add(log)

    log.chapter_id = chapter_id
    log.topic_id = topic_id
    log.sub_topic = data.get('sub_topic', '')
    log.timetable_period_id = data.get('timetable_period_id')
    log.periods_used = int(data.get('periods_used', 1))
    log.teaching_status = data.get('teaching_status', 'IN_PROGRESS')
    log.topic_completion_status = data.get('topic_completion_status', 'IN_PROGRESS')
    log.what_was_taught = data.get('what_was_taught', '').strip()
    log.learning_objectives = data.get('learning_objectives', '')
    log.teaching_pedagogy = data.get('teaching_pedagogy', 'Explanation / Lecture')
    log.classwork_done = data.get('classwork_done', '')

    # Homework fields
    log.homework_given = bool(data.get('homework_given', False))
    log.homework_description = data.get('homework_description', '')
    log.homework_due_date = parse_d(data.get('homework_due_date'))
    log.homework_attachment_url = data.get('homework_attachment_url', '')

    # Worksheet field
    log.worksheet_given = bool(data.get('worksheet_given', False))

    # Assessment fields
    log.quick_assessment_done = bool(data.get('quick_assessment_done', False))
    log.assessment_type = data.get('assessment_type', '')
    log.assessment_remarks = data.get('assessment_remarks', '')
    log.student_understanding_level = data.get('student_understanding_level', 'GOOD')
    log.students_needing_support = data.get('students_needing_support', '')

    # Attachments
    log.attachment_url = data.get('attachment_url', '')
    log.attachment_name = data.get('attachment_name', '')
    log.attachment_type = data.get('attachment_type', '')

    db.session.flush()

    # Update Topic Status if explicitly marked complete or in progress
    if topic_id:
        topic = CurriculumTopic.query.get(topic_id)
        if topic:
            if not topic.actual_start_date:
                topic.actual_start_date = entry_date

            if log.topic_completion_status == 'COMPLETED':
                topic.status = 'COMPLETED'
                topic.actual_completion_date = entry_date
            elif topic.status == 'NOT_STARTED':
                topic.status = 'IN_PROGRESS'

    # Check Chapter Status: if all topics complete -> Chapter is COMPLETED
    if chapter_id:
        chapter = CurriculumChapter.query.get(chapter_id)
        if chapter:
            if not chapter.actual_start_date:
                chapter.actual_start_date = entry_date

            total_t = chapter.topics.count()
            comp_t = chapter.topics.filter_by(status='COMPLETED').count()

            if total_t > 0 and comp_t >= total_t:
                chapter.status = 'COMPLETED'
                chapter.actual_completion_date = entry_date
            elif comp_t > 0 or chapter.status == 'NOT_STARTED':
                chapter.status = 'IN_PROGRESS'

    # Optional Worksheet Creation
    ws_data = data.get('worksheet')
    if log.worksheet_given and ws_data:
        ws = TeachingWorksheet(
            school_id=school_id,
            session=session,
            teaching_log_id=log.id,
            class_id=class_id,
            subject_id=subject_id,
            chapter_id=chapter_id,
            topic_id=topic_id,
            title=ws_data.get('title', f"Worksheet - {log.what_was_taught[:40]}"),
            worksheet_type=ws_data.get('worksheet_type', 'PRACTICE_WORKSHEET'),
            description=ws_data.get('description', ''),
            instructions=ws_data.get('instructions', ''),
            given_date=entry_date,
            due_date=parse_d(ws_data.get('due_date')),
            attachment_url=ws_data.get('attachment_url', ''),
            attachment_name=ws_data.get('attachment_name', ''),
            max_marks=float(ws_data['max_marks']) if ws_data.get('max_marks') else None,
            completion_status='GIVEN',
            created_by=user_id
        )
        db.session.add(ws)

    db.session.commit()
    return log


# ═══════════════════════════════════════════════════════════════════════════════
# 3. SYLLABUS COVERAGE & GAP ANALYSIS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_curriculum_coverage(curriculum_id):
    """
    Calculates weighted syllabus coverage based on planned/estimated periods.
    Formula:
        Total Planned Periods = sum of chapter estimated_periods
        Completed Periods = sum of estimated_periods of completed topics
        Coverage % = (Completed Periods / Total Planned Periods) * 100
    Also computes Expected Progress % based on planned calendar dates to find Gap.
    """
    curriculum = Curriculum.query.get(curriculum_id)
    if not curriculum:
        return {}

    chapters = curriculum.chapters.all()
    total_chapters = len(chapters)
    completed_chapters = sum(1 for ch in chapters if ch.status == 'COMPLETED')
    in_progress_chapters = sum(1 for ch in chapters if ch.status == 'IN_PROGRESS')
    not_started_chapters = total_chapters - completed_chapters - in_progress_chapters
    remaining_chapters = total_chapters - completed_chapters

    # Topic-level rollups
    all_topics = []
    total_planned_periods = 0
    completed_periods = 0
    actual_periods_taught = 0

    earliest_planned_start = None
    latest_planned_end = None

    for ch in chapters:
        ch_planned = ch.estimated_periods or 1
        total_planned_periods += ch_planned

        if ch.planned_start_date:
            if not earliest_planned_start or ch.planned_start_date < earliest_planned_start:
                earliest_planned_start = ch.planned_start_date
        if ch.planned_completion_date:
            if not latest_planned_end or ch.planned_completion_date > latest_planned_end:
                latest_planned_end = ch.planned_completion_date

        ch_topics = ch.topics.all()
        all_topics.extend(ch_topics)

        # Topic-level completed periods
        if ch.status == 'COMPLETED':
            completed_periods += ch_planned
        else:
            # Add pro-rata for completed topics
            t_total = len(ch_topics)
            t_comp = sum(1 for t in ch_topics if t.status == 'COMPLETED')
            if t_total > 0:
                completed_periods += (t_comp / t_total) * ch_planned

    # Count actual teaching periods logged from TeachingLog
    taught_periods_sum = db.session.query(func.coalesce(func.sum(TeachingLog.periods_used), 0)).filter_by(
        school_id=curriculum.school_id,
        session=curriculum.session,
        class_id=curriculum.class_id,
        subject_id=curriculum.subject_id
    ).scalar() or 0
    actual_periods_taught = int(taught_periods_sum)

    total_topics = len(all_topics)
    completed_topics = sum(1 for t in all_topics if t.status == 'COMPLETED')
    remaining_topics = total_topics - completed_topics

    # Coverage percentage
    if total_planned_periods > 0:
        coverage_pct = round((completed_periods / total_planned_periods * 100), 1)
    elif total_topics > 0:
        coverage_pct = round((completed_topics / total_topics * 100), 1)
    else:
        coverage_pct = 0.0

    # Ensure max 100%
    coverage_pct = min(100.0, max(0.0, coverage_pct))

    # Expected Progress calculation based on today vs planned timeline
    today = date.today()
    expected_pct = 50.0  # default midterm assumption if dates not specified

    if earliest_planned_start and latest_planned_end and latest_planned_end > earliest_planned_start:
        total_days = (latest_planned_end - earliest_planned_start).days
        elapsed_days = (today - earliest_planned_start).days
        if total_days > 0:
            expected_pct = round((elapsed_days / total_days * 100), 1)
            expected_pct = min(100.0, max(0.0, expected_pct))

    gap = round(coverage_pct - expected_pct, 1)

    # Status determination
    if gap > GAP_THRESHOLD_AHEAD:
        progress_status = 'AHEAD'
    elif gap >= GAP_THRESHOLD_BEHIND:
        progress_status = 'ON_TRACK'
    elif gap >= GAP_THRESHOLD_CRITICAL:
        progress_status = 'BEHIND'
    else:
        progress_status = 'CRITICAL'

    return {
        'curriculum_id':         curriculum.id,
        'session':               curriculum.session,
        'class_id':              curriculum.class_id,
        'subject_id':            curriculum.subject_id,
        'book_name':             curriculum.book_name,
        'total_chapters':        total_chapters,
        'completed_chapters':    completed_chapters,
        'in_progress_chapters':  in_progress_chapters,
        'remaining_chapters':    remaining_chapters,
        'total_topics':          total_topics,
        'completed_topics':      completed_topics,
        'remaining_topics':      remaining_topics,
        'total_planned_periods': total_planned_periods,
        'completed_periods':     round(completed_periods, 1),
        'remaining_periods':     round(max(0.0, total_planned_periods - completed_periods), 1),
        'actual_periods_taught': actual_periods_taught,
        'coverage_pct':          coverage_pct,
        'expected_pct':          expected_pct,
        'gap':                   gap,
        'status':                progress_status,
        'planned_start_date':    earliest_planned_start.isoformat() if earliest_planned_start else None,
        'planned_end_date':      latest_planned_end.isoformat() if latest_planned_end else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. AGGREGATED ANALYTICS & MONITORING
# ═══════════════════════════════════════════════════════════════════════════════

def get_subject_wise_coverage(school_id, session, class_id=None):
    """
    Returns syllabus coverage, expected target, gap, and on-track status
    for all subjects in a class or school.
    """
    q = Curriculum.query.filter_by(school_id=school_id, session=session, status='ACTIVE')
    if class_id:
        q = q.filter_by(class_id=class_id)

    curriculums = q.all()
    results = []

    for c in curriculums:
        cov = calculate_curriculum_coverage(c.id)
        sub = c.subject_ref
        cls = c.class_ref

        results.append({
            'curriculum_id': c.id,
            'class_id':      c.class_id,
            'class_name':    f"{cls.name} - {cls.section}" if cls else '',
            'subject_id':    c.subject_id,
            'subject_name':  sub.name if sub else '',
            'subject_code':  sub.code if sub else '',
            'book_name':     c.book_name,
            'teacher_name':  sub.assigned_teacher.user.name if (sub and sub.assigned_teacher and sub.assigned_teacher.user) else 'Unassigned',
            **cov
        })

    # Sort so lagging / critical subjects show on top
    results.sort(key=lambda x: x['gap'])
    return results


def get_class_wise_coverage(school_id, session):
    """
    Groups subjects by Class to provide Principal with a clear overview of
    which classes are ahead vs. behind schedule.
    """
    classes = Class.query.filter_by(school_id=school_id).all()
    class_results = []

    for cls in classes:
        currs = Curriculum.query.filter_by(
            school_id=school_id, session=session, class_id=cls.id, status='ACTIVE'
        ).all()

        if not currs:
            continue

        subj_metrics = [calculate_curriculum_coverage(c.id) for c in currs]
        total_subjs = len(subj_metrics)
        avg_cov = round(sum(m['coverage_pct'] for m in subj_metrics) / total_subjs, 1) if total_subjs else 0.0
        avg_exp = round(sum(m['expected_pct'] for m in subj_metrics) / total_subjs, 1) if total_subjs else 0.0
        avg_gap = round(avg_cov - avg_exp, 1)

        ahead_count    = sum(1 for m in subj_metrics if m['status'] == 'AHEAD')
        on_track_count = sum(1 for m in subj_metrics if m['status'] == 'ON_TRACK')
        behind_count   = sum(1 for m in subj_metrics if m['status'] in ('BEHIND', 'CRITICAL'))

        status = 'ON_TRACK'
        if avg_gap > GAP_THRESHOLD_AHEAD: status = 'AHEAD'
        elif avg_gap < GAP_THRESHOLD_CRITICAL: status = 'CRITICAL'
        elif avg_gap < GAP_THRESHOLD_BEHIND: status = 'BEHIND'

        class_results.append({
            'class_id':       cls.id,
            'class_name':     f"{cls.name} - {cls.section}",
            'total_subjects': total_subjs,
            'avg_coverage':   avg_cov,
            'avg_expected':   avg_exp,
            'avg_gap':        avg_gap,
            'status':         status,
            'ahead_count':    ahead_count,
            'on_track_count': on_track_count,
            'behind_count':   behind_count,
            'subjects': [
                {
                    'subject_id':   c.subject_id,
                    'subject_name': c.subject_ref.name if c.subject_ref else '',
                    **m
                }
                for c, m in zip(currs, subj_metrics)
            ]
        })

    class_results.sort(key=lambda x: x['avg_gap'])
    return class_results


def get_teacher_activity_summary(school_id, session, teacher_id=None):
    """
    Provides objective metrics on teacher teaching activity:
    - Assigned classes and subjects
    - Periods taught in session
    - Diary entries logged this month
    - Pending timetable entries
    - Homework & worksheets conducted
    """
    q = Teacher.query.filter_by(school_id=school_id, is_deleted=False)
    if teacher_id:
        q = q.filter_by(id=teacher_id)

    teachers = q.all()
    results = []

    first_of_month = date.today().replace(day=1)

    for t in teachers:
        t_user = t.user
        assigned_subs = Subject.query.filter_by(teacher_id=t.id).all()

        # Count logs
        total_logs = TeachingLog.query.filter_by(
            school_id=school_id, teacher_id=t.id, session=session
        ).count()

        periods_taught = db.session.query(func.coalesce(func.sum(TeachingLog.periods_used), 0)).filter_by(
            school_id=school_id, teacher_id=t.id, session=session
        ).scalar() or 0

        logs_this_month = TeachingLog.query.filter(
            TeachingLog.school_id == school_id,
            TeachingLog.teacher_id == t.id,
            TeachingLog.session == session,
            TeachingLog.date >= first_of_month
        ).count()

        hw_count = TeachingLog.query.filter_by(
            school_id=school_id, teacher_id=t.id, session=session, homework_given=True
        ).count()

        ws_count = TeachingWorksheet.query.filter_by(
            school_id=school_id, session=session, created_by=t_user.id if t_user else 0
        ).count()

        # Average syllabus coverage for teacher's subjects
        currs = Curriculum.query.filter(
            Curriculum.school_id == school_id,
            Curriculum.session == session,
            Curriculum.subject_id.in_([s.id for s in assigned_subs]) if assigned_subs else False
        ).all()

        if currs:
            avg_cov = round(sum(calculate_curriculum_coverage(c.id)['coverage_pct'] for c in currs) / len(currs), 1)
        else:
            avg_cov = 0.0

        results.append({
            'teacher_id':        t.id,
            'name':              t_user.name if t_user else f"Teacher #{t.id}",
            'email':             t_user.email if t_user else '',
            'department':        t.department or 'Academic',
            'assigned_subjects': len(assigned_subs),
            'total_logs':        total_logs,
            'periods_taught':    int(periods_taught),
            'logs_this_month':   logs_this_month,
            'homework_given':    hw_count,
            'worksheets_given':  ws_count,
            'avg_coverage':      avg_cov,
            'subjects_list':     [s.name for s in assigned_subs]
        })

    results.sort(key=lambda x: x['total_logs'], reverse=True)
    return results


def get_curriculum_drilldown(curriculum_id):
    """
    Mandatory drill-down:
    Curriculum -> Chapters -> Topics -> Daily Teaching Logs.
    """
    curriculum = Curriculum.query.get_or_404(curriculum_id)
    cov = calculate_curriculum_coverage(curriculum.id)

    chapters_data = []
    for ch in curriculum.chapters.order_by(CurriculumChapter.chapter_no.asc()).all():
        topics_data = []
        for tp in ch.topics.order_by(CurriculumTopic.topic_no.asc()).all():
            logs = tp.teaching_logs.order_by(TeachingLog.date.desc()).all()
            topics_data.append({
                **tp.to_dict(),
                'logs': [l.to_dict() for l in logs]
            })

        ch_logs = ch.teaching_logs.order_by(TeachingLog.date.desc()).all()

        chapters_data.append({
            **ch.to_dict(),
            'topics': topics_data,
            'logs_count': len(ch_logs)
        })

    return {
        'curriculum': curriculum.to_dict(include_chapters=False),
        'metrics':    cov,
        'chapters':   chapters_data
    }


def get_academic_dashboard_summary(school_id, session):
    """
    Generates high-level management KPI cards and alerts for Principal Academic Dashboard.
    """
    curriculums = Curriculum.query.filter_by(school_id=school_id, session=session, status='ACTIVE').all()
    total_currs = len(curriculums)

    if total_currs > 0:
        covs = [calculate_curriculum_coverage(c.id) for c in curriculums]
        avg_overall = round(sum(m['coverage_pct'] for m in covs) / total_currs, 1)
        ahead_currs = sum(1 for m in covs if m['status'] == 'AHEAD')
        on_track_currs = sum(1 for m in covs if m['status'] == 'ON_TRACK')
        behind_currs = sum(1 for m in covs if m['status'] == 'BEHIND')
        critical_currs = sum(1 for m in covs if m['status'] == 'CRITICAL')
    else:
        avg_overall = 0.0
        ahead_currs = on_track_currs = behind_currs = critical_currs = 0

    # Teaching logs this month
    first_of_month = date.today().replace(day=1)
    logs_month_count = TeachingLog.query.filter(
        TeachingLog.school_id == school_id,
        TeachingLog.session == session,
        TeachingLog.date >= first_of_month
    ).count()

    total_teachers = Teacher.query.filter_by(school_id=school_id, is_deleted=False).count()
    active_curriculums_count = total_currs

    # Alerts & Exceptions
    alerts = []
    # 1. Critical subjects
    if total_currs > 0:
        for c, m in zip(curriculums, covs):
            if m['status'] == 'CRITICAL':
                cls = c.class_ref
                sub = c.subject_ref
                alerts.append({
                    'type':     'CRITICAL_LAG',
                    'severity': 'CRITICAL',
                    'title':    f"{cls.name if cls else 'Class'} • {sub.name if sub else 'Subject'} is critically behind",
                    'message':  f"Actual coverage {m['coverage_pct']}% vs expected {m['expected_pct']}% (Gap: {m['gap']}%)",
                    'curriculum_id': c.id
                })

    # 2. Subjects with no curriculum configured
    all_subjects = Subject.query.filter_by(school_id=school_id).all()
    configured_sub_ids = {c.subject_id for c in curriculums}
    unconfigured_count = sum(1 for s in all_subjects if s.id not in configured_sub_ids)
    if unconfigured_count > 0:
        alerts.append({
            'type':     'MISSING_CURRICULUM',
            'severity': 'WARNING',
            'title':    f"{unconfigured_count} subjects have no curriculum set up",
            'message':  "Configure book chapters to enable syllabus tracking.",
            'curriculum_id': None
        })

    return {
        'overall_coverage':        avg_overall,
        'total_curriculums':       total_currs,
        'active_curriculums':      active_curriculums_count,
        'ahead_count':             ahead_currs,
        'on_track_count':          on_track_currs,
        'behind_count':            behind_currs,
        'critical_count':          critical_currs,
        'logs_this_month':         logs_month_count,
        'total_teachers':          total_teachers,
        'alerts':                  alerts[:10]
    }
