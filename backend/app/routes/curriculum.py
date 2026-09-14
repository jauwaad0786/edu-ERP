from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import date, datetime
from app import db
from app.utils.decorators import role_required, get_current_user
from app.models.academic import Teacher, Class, Subject
from app.models.curriculum import (
    Curriculum, CurriculumChapter, CurriculumTopic,
    TeachingLog, TeachingWorksheet
)
from app.services.curriculum_service import (
    get_or_create_curriculum, batch_generate_chapters,
    copy_curriculum_to_session, get_teacher_today_schedule,
    record_teaching_log, calculate_curriculum_coverage,
    get_subject_wise_coverage, get_class_wise_coverage,
    get_teacher_activity_summary, get_curriculum_drilldown,
    get_academic_dashboard_summary
)

curriculum_bp = Blueprint('curriculum', __name__, url_prefix='/api')


def _get_active_school_id(user):
    if user.role in ['TEACHER', 'STAFF']:
        t = Teacher.query.filter_by(user_id=user.id).first()
        if t and t.school_id:
            return t.school_id
    return getattr(user, 'school_id', None)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. CURRICULUM SETUP & MANAGEMENT ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@curriculum_bp.route('/curriculum', methods=['GET'])
@jwt_required()
def list_curriculums():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    if not school_id:
        return jsonify({'error': 'School context required'}), 400

    session    = request.args.get('session', '2026-27')
    class_id   = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    status     = request.args.get('status', 'ACTIVE')

    q = Curriculum.query.filter_by(school_id=school_id, session=session)
    if status and status.upper() != 'ALL':
        q = q.filter_by(status=status.upper())
    if class_id:
        q = q.filter_by(class_id=class_id)
    if subject_id:
        q = q.filter_by(subject_id=subject_id)

    # If teacher, only list their assigned classes/subjects unless admin/principal
    if user.role == 'TEACHER':
        teacher = Teacher.query.filter_by(user_id=user.id).first()
        if teacher:
            assigned_sub_ids = [s.id for s in Subject.query.filter_by(teacher_id=teacher.id).all()]
            assigned_cls_ids = [c.id for c in Class.query.filter_by(teacher_id=teacher.id).all()]
            q = q.filter(or_(Curriculum.subject_id.in_(assigned_sub_ids), Curriculum.class_id.in_(assigned_cls_ids)))

    currs = q.all()
    return jsonify([c.to_dict(include_chapters=False, include_progress=True) for c in currs]), 200


@curriculum_bp.route('/curriculum', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def create_curriculum():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    if not school_id:
        return jsonify({'error': 'School context required'}), 400

    data = request.get_json() or {}
    session    = data.get('session', '2026-27')
    class_id   = data.get('class_id')
    subject_id = data.get('subject_id')

    if not class_id or not subject_id:
        return jsonify({'error': 'class_id and subject_id are required.'}), 400

    curriculum = get_or_create_curriculum(
        school_id=school_id,
        session=session,
        class_id=int(class_id),
        subject_id=int(subject_id),
        data=data,
        user_id=user.id
    )

    # Optional fast batch chapter generation
    chapters = data.get('chapters')
    if chapters and isinstance(chapters, list):
        batch_generate_chapters(curriculum.id, chapters, school_id)

    return jsonify(curriculum.to_dict(include_chapters=True, include_progress=True)), 201


@curriculum_bp.route('/curriculum/<int:curriculum_id>', methods=['GET'])
@jwt_required()
def get_curriculum_detail(curriculum_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    curriculum = Curriculum.query.filter_by(id=curriculum_id, school_id=school_id).first_or_404()
    return jsonify(curriculum.to_dict(include_chapters=True, include_progress=True)), 200


@curriculum_bp.route('/curriculum/<int:curriculum_id>', methods=['PUT'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def update_curriculum(curriculum_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    curriculum = Curriculum.query.filter_by(id=curriculum_id, school_id=school_id).first_or_404()

    data = request.get_json() or {}
    if 'book_name' in data: curriculum.book_name = data['book_name']
    if 'publisher' in data: curriculum.publisher = data['publisher']
    if 'book_code' in data: curriculum.book_code = data['book_code']
    if 'estimated_periods' in data: curriculum.estimated_periods = int(data['estimated_periods'])
    if 'description' in data: curriculum.description = data['description']
    if 'status' in data: curriculum.status = data['status']

    db.session.commit()
    return jsonify(curriculum.to_dict(include_chapters=False, include_progress=True)), 200


@curriculum_bp.route('/curriculum/<int:curriculum_id>/copy-session', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR')
def copy_curriculum_endpoint(curriculum_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    data = request.get_json() or {}
    target_session = data.get('target_session')

    if not target_session:
        return jsonify({'error': 'target_session is required (e.g. 2027-28)'}), 400

    try:
        new_curr = copy_curriculum_to_session(
            curriculum_id=curriculum_id,
            target_session=target_session,
            school_id=school_id,
            user_id=user.id
        )
        return jsonify({
            'message': f"Curriculum copied to session {target_session} successfully.",
            'curriculum': new_curr.to_dict(include_chapters=True)
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


# ─── Chapter Endpoints ─────────────────────────────────────────────────────────

@curriculum_bp.route('/curriculum/<int:curriculum_id>/chapters', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def add_chapter(curriculum_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    curriculum = Curriculum.query.filter_by(id=curriculum_id, school_id=school_id).first_or_404()

    data = request.get_json() or {}
    ch_no = data.get('chapter_no') or (curriculum.chapters.count() + 1)

    chapter = CurriculumChapter(
        school_id=school_id,
        curriculum_id=curriculum.id,
        chapter_no=ch_no,
        title=data.get('title', f"Chapter {ch_no}"),
        description=data.get('description', ''),
        estimated_periods=int(data.get('estimated_periods', 1)),
        weightage=float(data.get('weightage', 0.0)),
        learning_outcomes=data.get('learning_outcomes', ''),
        sort_order=int(data.get('sort_order', ch_no)),
        status='NOT_STARTED',
        is_active=True
    )
    db.session.add(chapter)
    curriculum.total_chapters = curriculum.chapters.count() + 1
    db.session.commit()

    return jsonify(chapter.to_dict(include_topics=True)), 201


@curriculum_bp.route('/curriculum/chapters/<int:chapter_id>', methods=['PUT'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def edit_chapter(chapter_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    chapter = CurriculumChapter.query.filter_by(id=chapter_id, school_id=school_id).first_or_404()

    data = request.get_json() or {}
    if 'title' in data: chapter.title = data['title']
    if 'chapter_no' in data: chapter.chapter_no = int(data['chapter_no'])
    if 'description' in data: chapter.description = data['description']
    if 'estimated_periods' in data: chapter.estimated_periods = int(data['estimated_periods'])
    if 'weightage' in data: chapter.weightage = float(data['weightage'])
    if 'learning_outcomes' in data: chapter.learning_outcomes = data['learning_outcomes']
    if 'status' in data: chapter.status = data['status']
    if 'sort_order' in data: chapter.sort_order = int(data['sort_order'])

    def parse_d(val):
        if not val: return None
        if isinstance(val, date): return val
        try: return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception: return None

    if 'planned_start_date' in data: chapter.planned_start_date = parse_d(data['planned_start_date'])
    if 'planned_completion_date' in data: chapter.planned_completion_date = parse_d(data['planned_completion_date'])

    db.session.commit()
    return jsonify(chapter.to_dict(include_topics=True)), 200


@curriculum_bp.route('/curriculum/chapters/<int:chapter_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR')
def delete_chapter(chapter_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    chapter = CurriculumChapter.query.filter_by(id=chapter_id, school_id=school_id).first_or_404()
    curriculum = chapter.curriculum

    db.session.delete(chapter)
    db.session.commit()
    if curriculum:
        curriculum.total_chapters = curriculum.chapters.count()
        db.session.commit()

    return jsonify({'message': 'Chapter deleted successfully.'}), 200


# ─── Topic Endpoints ───────────────────────────────────────────────────────────

@curriculum_bp.route('/curriculum/chapters/<int:chapter_id>/topics', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def add_topic(chapter_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    chapter = CurriculumChapter.query.filter_by(id=chapter_id, school_id=school_id).first_or_404()

    data = request.get_json() or {}
    t_no = data.get('topic_no') or (chapter.topics.count() + 1)

    topic = CurriculumTopic(
        school_id=school_id,
        chapter_id=chapter.id,
        topic_no=t_no,
        title=data.get('title', f"Topic {t_no}"),
        description=data.get('description', ''),
        sub_topics=data.get('sub_topics', ''),
        estimated_periods=int(data.get('estimated_periods', 1)),
        learning_objectives=data.get('learning_objectives', ''),
        sort_order=int(data.get('sort_order', t_no)),
        status='NOT_STARTED',
        is_active=True
    )
    db.session.add(topic)
    db.session.commit()

    return jsonify(topic.to_dict()), 201


@curriculum_bp.route('/curriculum/topics/<int:topic_id>', methods=['PUT'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR', 'TEACHER')
def edit_topic(topic_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    topic = CurriculumTopic.query.filter_by(id=topic_id, school_id=school_id).first_or_404()

    data = request.get_json() or {}
    if 'title' in data: topic.title = data['title']
    if 'topic_no' in data: topic.topic_no = int(data['topic_no'])
    if 'description' in data: topic.description = data['description']
    if 'sub_topics' in data: topic.sub_topics = data['sub_topics']
    if 'estimated_periods' in data: topic.estimated_periods = int(data['estimated_periods'])
    if 'learning_objectives' in data: topic.learning_objectives = data['learning_objectives']
    if 'status' in data: topic.status = data['status']
    if 'sort_order' in data: topic.sort_order = int(data['sort_order'])

    def parse_d(val):
        if not val: return None
        if isinstance(val, date): return val
        try: return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception: return None

    if 'planned_start_date' in data: topic.planned_start_date = parse_d(data['planned_start_date'])
    if 'planned_completion_date' in data: topic.planned_completion_date = parse_d(data['planned_completion_date'])

    db.session.commit()
    return jsonify(topic.to_dict()), 200


@curriculum_bp.route('/curriculum/topics/<int:topic_id>', methods=['DELETE'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL', 'DIRECTOR')
def delete_topic(topic_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    topic = CurriculumTopic.query.filter_by(id=topic_id, school_id=school_id).first_or_404()

    db.session.delete(topic)
    db.session.commit()
    return jsonify({'message': 'Topic deleted successfully.'}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# 2. TEACHING DIARY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@curriculum_bp.route('/teaching-diary/today', methods=['GET'])
@jwt_required()
def get_today_schedule():
    """
    Returns the teacher's schedule for today with live status:
    - ✓ Teaching Recorded
    - ⚠ Update Required
    """
    user = get_current_user()
    school_id = _get_active_school_id(user)

    teacher_id = request.args.get('teacher_id', type=int)
    if not teacher_id:
        if user.role == 'TEACHER':
            t = Teacher.query.filter_by(user_id=user.id).first()
            if not t:
                return jsonify({'error': 'Teacher profile not found'}), 404
            teacher_id = t.id
        else:
            return jsonify({'error': 'teacher_id parameter is required for administrators'}), 400

    target_date = request.args.get('date', str(date.today()))
    session     = request.args.get('session', '2026-27')

    schedule_data = get_teacher_today_schedule(
        teacher_id=teacher_id,
        school_id=school_id,
        target_date=target_date,
        session=session
    )
    return jsonify(schedule_data), 200


@curriculum_bp.route('/teaching-diary/entry', methods=['POST'])
@role_required('TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL')
def save_teaching_log_endpoint():
    """
    Saves a daily teaching log entry.
    Fast 1-2 min record submission with auto-topic status updating.
    """
    user = get_current_user()
    school_id = _get_active_school_id(user)
    data = request.get_json() or {}

    teacher_id = data.get('teacher_id')
    if not teacher_id:
        if user.role == 'TEACHER':
            t = Teacher.query.filter_by(user_id=user.id).first()
            if not t:
                return jsonify({'error': 'Teacher profile not found'}), 404
            teacher_id = t.id
        else:
            return jsonify({'error': 'teacher_id is required'}), 400

    try:
        log = record_teaching_log(
            school_id=school_id,
            teacher_id=int(teacher_id),
            user_id=user.id,
            data=data
        )
        return jsonify({
            'message': 'Teaching log saved successfully.',
            'log': log.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400


@curriculum_bp.route('/teaching-diary/history', methods=['GET'])
@jwt_required()
def list_teaching_history():
    user = get_current_user()
    school_id = _get_active_school_id(user)

    teacher_id = request.args.get('teacher_id', type=int)
    class_id   = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    date_from  = request.args.get('date_from')
    date_to    = request.args.get('date_to')
    session    = request.args.get('session', '2026-27')
    status     = request.args.get('status')
    search     = request.args.get('search', '').strip()

    q = TeachingLog.query.filter_by(school_id=school_id, session=session)

    if user.role == 'TEACHER':
        t = Teacher.query.filter_by(user_id=user.id).first()
        if t:
            q = q.filter_by(teacher_id=t.id)
    elif teacher_id:
        q = q.filter_by(teacher_id=teacher_id)

    if class_id:
        q = q.filter_by(class_id=class_id)
    if subject_id:
        q = q.filter_by(subject_id=subject_id)

    if date_from:
        try:
            d_from = datetime.strptime(date_from[:10], '%Y-%m-%d').date()
            q = q.filter(TeachingLog.date >= d_from)
        except Exception: pass
    if date_to:
        try:
            d_to = datetime.strptime(date_to[:10], '%Y-%m-%d').date()
            q = q.filter(TeachingLog.date <= d_to)
        except Exception: pass

    if status and status.upper() != 'ALL':
        q = q.filter_by(teaching_status=status.upper())

    if search:
        q = q.filter(TeachingLog.what_was_taught.ilike(f"%{search}%"))

    logs = q.order_by(TeachingLog.date.desc(), TeachingLog.period_no.asc()).limit(150).all()
    return jsonify([l.to_dict() for l in logs]), 200


@curriculum_bp.route('/teaching-diary/<int:log_id>', methods=['GET'])
@jwt_required()
def get_teaching_log_detail(log_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    log = TeachingLog.query.filter_by(id=log_id, school_id=school_id).first_or_404()
    return jsonify(log.to_dict()), 200


@curriculum_bp.route('/teaching-diary/<int:log_id>', methods=['DELETE'])
@role_required('TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN', 'VICE_PRINCIPAL')
def delete_teaching_log(log_id):
    user = get_current_user()
    school_id = _get_active_school_id(user)
    log = TeachingLog.query.filter_by(id=log_id, school_id=school_id).first_or_404()

    # If teacher, verify ownership
    if user.role == 'TEACHER':
        t = Teacher.query.filter_by(user_id=user.id).first()
        if not t or log.teacher_id != t.id:
            return jsonify({'error': 'Unauthorized to delete this log'}), 403

    db.session.delete(log)
    db.session.commit()
    return jsonify({'message': 'Teaching log deleted successfully.'}), 200


# ═══════════════════════════════════════════════════════════════════════════════
# 3. WORKSHEETS & CLASS ACTIVITIES ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@curriculum_bp.route('/teaching-diary/worksheets', methods=['GET'])
@jwt_required()
def list_worksheets():
    user = get_current_user()
    school_id = _get_active_school_id(user)

    session    = request.args.get('session', '2026-27')
    class_id   = request.args.get('class_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    chapter_id = request.args.get('chapter_id', type=int)
    topic_id   = request.args.get('topic_id', type=int)

    q = TeachingWorksheet.query.filter_by(school_id=school_id, session=session)
    if class_id: q = q.filter_by(class_id=class_id)
    if subject_id: q = q.filter_by(subject_id=subject_id)
    if chapter_id: q = q.filter_by(chapter_id=chapter_id)
    if topic_id: q = q.filter_by(topic_id=topic_id)

    worksheets = q.order_by(TeachingWorksheet.given_date.desc()).all()
    return jsonify([w.to_dict() for w in worksheets]), 200


@curriculum_bp.route('/teaching-diary/worksheets', methods=['POST'])
@role_required('TEACHER', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN')
def create_standalone_worksheet():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    data = request.get_json() or {}

    def parse_d(val):
        if not val: return None
        if isinstance(val, date): return val
        try: return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()
        except Exception: return None

    ws = TeachingWorksheet(
        school_id=school_id,
        session=data.get('session', '2026-27'),
        class_id=int(data['class_id']),
        subject_id=int(data['subject_id']),
        chapter_id=int(data['chapter_id']) if data.get('chapter_id') else None,
        topic_id=int(data['topic_id']) if data.get('topic_id') else None,
        title=data.get('title', 'Class Worksheet'),
        worksheet_type=data.get('worksheet_type', 'PRACTICE_WORKSHEET'),
        description=data.get('description', ''),
        instructions=data.get('instructions', ''),
        given_date=parse_d(data.get('given_date')) or date.today(),
        due_date=parse_d(data.get('due_date')),
        attachment_url=data.get('attachment_url', ''),
        attachment_name=data.get('attachment_name', ''),
        max_marks=float(data['max_marks']) if data.get('max_marks') else None,
        completion_status='GIVEN',
        created_by=user.id
    )
    db.session.add(ws)
    db.session.commit()
    return jsonify(ws.to_dict()), 201


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PRINCIPAL ACADEMIC MONITORING & ANALYTICS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@curriculum_bp.route('/curriculum/analytics/summary', methods=['GET'])
@jwt_required()
def get_analytics_summary():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    session = request.args.get('session', '2026-27')

    summary = get_academic_dashboard_summary(school_id=school_id, session=session)
    return jsonify(summary), 200


@curriculum_bp.route('/curriculum/analytics/subjects', methods=['GET'])
@jwt_required()
def get_analytics_subjects():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    session  = request.args.get('session', '2026-27')
    class_id = request.args.get('class_id', type=int)

    subjects_data = get_subject_wise_coverage(school_id=school_id, session=session, class_id=class_id)
    return jsonify(subjects_data), 200


@curriculum_bp.route('/curriculum/analytics/classes', methods=['GET'])
@jwt_required()
def get_analytics_classes():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    session = request.args.get('session', '2026-27')

    classes_data = get_class_wise_coverage(school_id=school_id, session=session)
    return jsonify(classes_data), 200


@curriculum_bp.route('/curriculum/analytics/teachers', methods=['GET'])
@jwt_required()
def get_analytics_teachers():
    user = get_current_user()
    school_id = _get_active_school_id(user)
    session = request.args.get('session', '2026-27')

    teachers_data = get_teacher_activity_summary(school_id=school_id, session=session)
    return jsonify(teachers_data), 200


@curriculum_bp.route('/curriculum/analytics/drill-down/<int:curriculum_id>', methods=['GET'])
@jwt_required()
def get_analytics_drilldown(curriculum_id):
    drilldown = get_curriculum_drilldown(curriculum_id=curriculum_id)
    return jsonify(drilldown), 200
