"""
RESULT MANAGEMENT SYSTEM
════════════════════════
NEW module, additive only. Does NOT touch app/routes/marks.py, ExamsPage.jsx,
or MarksPage.jsx — those keep working exactly as before (quick grid entry +
toppers). This module adds the full Draft → Submit → Review → Approve/Return →
Publish workflow with a permanent, append-only audit trail, on top of the
SAME Marks / Class / Subject / Student / ExamSchedule tables that already
exist (see app/models/academic.py, app/models/financial.py).

Reused, not rebuilt:
  - Marks, Class, Subject, Student, Teacher      (app.models.academic)
  - ExamSchedule, ExamTimetable                  (app.models.financial)
  - role_required / get_current_user             (app.utils.decorators)
  - SupportNotification                          (app.models.communication) — bell icon
  - _grade()                                      (app.routes.marks)

New (all brand-new tables — created automatically by db.create_all(), no
ALTER TABLE needed for these; only Marks got 2 new columns, see academic.py):
  - ResultSubjectStatus     one row per (exam, class, subject) — the workflow state
  - ResultReturnItem        which specific students a "return" targeted (optional)
  - MarksAuditLog           permanent, append-only history of every mark change
  - ClassResultPublication  publish / reopen / republish state per (exam, class)
"""
from datetime import datetime
import json
from flask import Blueprint, request, jsonify
from app import db
from app.models.academic import Class, Subject, Student, Teacher, Marks
from app.models.financial import ExamSchedule, ExamTimetable, ExamTeacherDelegation, ResultVersion, ExamClass, ExamSubject
from app.models.communication import SupportNotification
from app.models.user import User, UserRole
from app.utils.decorators import role_required, get_current_user
from app.routes.marks import _grade

result_bp = Blueprint('result_management', __name__)

SUBJECT_STATUSES = [
    'DRAFT', 'SUBMITTED', 'RETURNED_FOR_CORRECTION', 'RESUBMITTED', 'APPROVED', 'PUBLISHED'
]
STUDENT_STATUS_CHOICES = ['PASS', 'FAIL', 'ABSENT', 'MEDICAL_LEAVE', 'NOT_EVALUATED']


# ═══════════════════════════════════════════════════════════════════════════
#  MODELS
# ═══════════════════════════════════════════════════════════════════════════

class ResultSubjectStatus(db.Model):
    """One row per (exam, class, subject) — tracks where this subject's
    marks are in the Draft→Submit→Review→Approve workflow."""
    __tablename__ = 'result_subject_status'

    id            = db.Column(db.Integer, primary_key=True)
    school_id     = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id       = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id      = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)
    subject_id    = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=False, index=True)
    teacher_id    = db.Column(db.Integer, db.ForeignKey('teachers.id'), nullable=True)

    status        = db.Column(db.String(30), default='DRAFT', index=True)

    submitted_at  = db.Column(db.DateTime, nullable=True)
    submitted_by  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    reviewed_at   = db.Column(db.DateTime, nullable=True)
    reviewed_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    return_reason = db.Column(db.String(500), nullable=True)

    approved_at   = db.Column(db.DateTime, nullable=True)
    approved_by   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Optimistic lock for the STATUS row itself (separate from Marks.version) —
    # stops "teacher double-clicks Submit" from double-processing.
    version       = db.Column(db.Integer, default=0)

    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at    = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('exam_id', 'class_id', 'subject_id', name='uq_result_subject_status'),
    )

    def to_dict(self):
        subject = Subject.query.get(self.subject_id)
        teacher = Teacher.query.get(self.teacher_id) if self.teacher_id else None
        return {
            'id':            self.id,
            'exam_id':       self.exam_id,
            'class_id':      self.class_id,
            'subject_id':    self.subject_id,
            'subject_name':  subject.name if subject else '',
            'teacher_id':    self.teacher_id,
            'teacher_name':  (teacher.user.name if teacher and teacher.user else '—'),
            'status':        self.status,
            'submitted_at':  self.submitted_at.isoformat() if self.submitted_at else None,
            'reviewed_at':   self.reviewed_at.isoformat()  if self.reviewed_at  else None,
            'return_reason': self.return_reason,
            'approved_at':   self.approved_at.isoformat()  if self.approved_at  else None,
            'updated_at':    self.updated_at.isoformat()   if self.updated_at   else None,
            'version':       self.version or 0,
        }


class ResultReturnItem(db.Model):
    """Optional list of specific students a 'return for correction' targeted.
    Empty for this subject_status_id = the WHOLE subject was returned."""
    __tablename__ = 'result_return_items'

    id                 = db.Column(db.Integer, primary_key=True)
    subject_status_id  = db.Column(db.Integer, db.ForeignKey('result_subject_status.id'), nullable=False, index=True)
    student_id         = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    resolved           = db.Column(db.Boolean, default=False)
    created_at         = db.Column(db.DateTime, default=datetime.utcnow)


class MarksAuditLog(db.Model):
    """Permanent, append-only audit trail — spec section 14. Never updated
    or deleted by application code; only ever inserted."""
    __tablename__ = 'marks_audit_logs'

    id                  = db.Column(db.Integer, primary_key=True)
    school_id           = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    academic_year       = db.Column(db.String(20))

    exam_id             = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=True, index=True)
    exam_name           = db.Column(db.String(100))

    student_id          = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=True, index=True)
    student_name        = db.Column(db.String(120))
    roll_number         = db.Column(db.String(20))

    class_id            = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=True)
    class_name          = db.Column(db.String(50))
    section             = db.Column(db.String(10))

    subject_id          = db.Column(db.Integer, db.ForeignKey('subjects.id'), nullable=True, index=True)
    subject_name        = db.Column(db.String(100))

    marks_record_id     = db.Column(db.Integer, db.ForeignKey('marks.id'), nullable=True)

    old_marks           = db.Column(db.Float, nullable=True)
    new_marks           = db.Column(db.Float, nullable=True)
    old_status          = db.Column(db.String(30), nullable=True)
    new_status          = db.Column(db.String(30), nullable=True)
    old_remarks         = db.Column(db.String(300), nullable=True)
    new_remarks         = db.Column(db.String(300), nullable=True)

    changed_by_user_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    changed_by_name     = db.Column(db.String(120))
    changed_by_role     = db.Column(db.String(30))
    change_reason       = db.Column(db.String(300))

    # MARK_CREATED / MARK_UPDATED / STATUS_CHANGED / SUBMITTED / RETURNED /
    # RESUBMITTED / APPROVED / RESULT_PUBLISHED / RESULT_REOPENED / RESULT_REPUBLISHED
    action_type         = db.Column(db.String(30), index=True)

    created_at          = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        db.Index('ix_marks_audit_student_subject_exam', 'student_id', 'subject_id', 'exam_id'),
    )

    def to_dict(self):
        return {
            'id':                 self.id,
            'exam_id':            self.exam_id,
            'exam_name':          self.exam_name,
            'student_id':         self.student_id,
            'student_name':       self.student_name,
            'roll_number':        self.roll_number,
            'class_id':           self.class_id,
            'class_name':         self.class_name,
            'section':            self.section,
            'subject_id':         self.subject_id,
            'subject_name':       self.subject_name,
            'old_marks':          self.old_marks,
            'new_marks':          self.new_marks,
            'old_status':         self.old_status,
            'new_status':         self.new_status,
            'old_remarks':        self.old_remarks,
            'new_remarks':        self.new_remarks,
            'changed_by_user_id': self.changed_by_user_id,
            'changed_by_name':    self.changed_by_name,
            'changed_by_role':    self.changed_by_role,
            'change_reason':      self.change_reason or '',
            'action_type':        self.action_type,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


class ClassResultPublication(db.Model):
    """Publish / Reopen / Republish state for one (exam, class). ExamSchedule
    already has a global is_published flag used by the older /marks/publish
    route — kept untouched for back-compat. This table is the source of
    truth the RMS workflow (and the student-visibility gate) actually reads,
    because one ExamSchedule can span several classes that publish at
    different times."""
    __tablename__ = 'class_result_publication'

    id               = db.Column(db.Integer, primary_key=True)
    school_id        = db.Column(db.Integer, db.ForeignKey('schools.id'), nullable=False, index=True)
    exam_id          = db.Column(db.Integer, db.ForeignKey('exam_schedules.id'), nullable=False, index=True)
    class_id         = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False, index=True)

    status           = db.Column(db.String(20), default='NOT_PUBLISHED')  # NOT_PUBLISHED / PUBLISHED / REOPENED

    published_at     = db.Column(db.DateTime, nullable=True)
    published_by     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    reopened_at      = db.Column(db.DateTime, nullable=True)
    reopened_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reopen_reason    = db.Column(db.String(500), nullable=True)

    republish_count  = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.UniqueConstraint('exam_id', 'class_id', name='uq_class_result_publication'),
    )

    def to_dict(self):
        return {
            'status':          self.status,
            'published_at':    self.published_at.isoformat() if self.published_at else None,
            'reopened_at':     self.reopened_at.isoformat()  if self.reopened_at  else None,
            'reopen_reason':   self.reopen_reason,
            'republish_count': self.republish_count or 0,
        }


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _school_id():
    return get_current_user().school_id


def _is_principal(user):
    role_val = getattr(user.role, 'value', str(user.role))
    return role_val in ('PRINCIPAL', 'DIRECTOR', 'VICE_PRINCIPAL', 'SUPER_ADMIN')


def _school_principals(sid):
    return User.query.filter_by(school_id=sid, is_active=True).filter(
        User.role.in_([UserRole.PRINCIPAL, UserRole.DIRECTOR, UserRole.VICE_PRINCIPAL])
    ).all()


def _teacher_record(user):
    return Teacher.query.filter_by(user_id=user.id).first()


def _teacher_subject_ids(user, exam_id=None, class_id=None):
    """Subject IDs this teacher is assigned to (including active temporary delegations).
    None = no restriction (Principal/Director/SuperAdmin)."""
    if _is_principal(user):
        return None
    t = _teacher_record(user)
    if not t:
        return set()
    
    # 1. Permanent assignments
    assigned = {s.id for s in Subject.query.filter_by(teacher_id=t.id).all()}

    # 2. Active temporary delegations for this teacher
    now = datetime.utcnow()
    q_del = ExamTeacherDelegation.query.filter_by(
        delegated_teacher_id=t.id, status='ACTIVE'
    ).filter(ExamTeacherDelegation.end_date >= now)
    if exam_id:
        q_del = q_del.filter_by(exam_id=exam_id)
    if class_id:
        q_del = q_del.filter_by(class_id=class_id)
    delegated = {d.subject_id for d in q_del.all()}

    return assigned | delegated


def _get_or_create_status(sid, exam_id, class_id, subject_id):
    row = ResultSubjectStatus.query.filter_by(
        exam_id=exam_id, class_id=class_id, subject_id=subject_id
    ).first()
    if not row:
        subject = Subject.query.get(subject_id)
        row = ResultSubjectStatus(
            school_id=sid, exam_id=exam_id, class_id=class_id, subject_id=subject_id,
            teacher_id=subject.teacher_id if subject else None, status='DRAFT',
        )
        db.session.add(row)
        db.session.flush()
    return row


def _log_audit(user, student, subject, exam, cls, marks_record_id=None,
                old_marks=None, new_marks=None, old_status=None, new_status=None,
                old_remarks=None, new_remarks=None, action_type='MARK_UPDATED', reason=None):
    db.session.add(MarksAuditLog(
        school_id=_school_id(),
        academic_year=exam.session if exam else None,
        exam_id=exam.id if exam else None,
        exam_name=exam.exam_name if exam else None,
        student_id=student.id if student else None,
        student_name=(student.user.name if student and student.user else None),
        roll_number=student.roll_number if student else None,
        class_id=cls.id if cls else None,
        class_name=cls.name if cls else None,
        section=cls.section if cls else None,
        subject_id=subject.id if subject else None,
        subject_name=subject.name if subject else None,
        marks_record_id=marks_record_id,
        old_marks=old_marks, new_marks=new_marks,
        old_status=old_status, new_status=new_status,
        old_remarks=old_remarks, new_remarks=new_remarks,
        changed_by_user_id=user.id,
        changed_by_name=user.name,
        changed_by_role=getattr(user.role, 'value', str(user.role)),
        change_reason=reason,
        action_type=action_type,
    ))


def _notify(user_id, title, message, school_id=None):
    db.session.add(SupportNotification(
        user_id=user_id, school_id=school_id, title=title,
        message=message, notif_type='RESULT',
    ))


def _derive_student_status(m):
    """Fallback for rows saved before student_status existed."""
    if m.student_status:
        return m.student_status
    if m.is_absent:
        return 'ABSENT'
    if m.marks_obtained is None:
        return 'NOT_EVALUATED'
    return 'PASS' if m.marks_obtained >= (m.max_marks * 0.33) else 'FAIL'


def _validate_tenant(cls, exam, subject, sid):
    if cls.school_id != sid:
        return 'Unauthorized class'
    if exam.school_id != sid:
        return 'Unauthorized exam'
    if subject.school_id and subject.school_id != sid:
        return 'Unauthorized subject'
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  1. TEACHER — assigned classes/subjects (for Mark Entry dropdowns)
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/my-assignments', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def my_assignments():
    user = get_current_user()
    sid = _school_id()
    allowed_ids = _teacher_subject_ids(user)

    q = Subject.query.join(Class, Subject.class_id == Class.id).filter(Class.school_id == sid)
    if allowed_ids is not None:
        if not allowed_ids:
            return jsonify([]), 200
        q = q.filter(Subject.id.in_(allowed_ids))

    out, seen_classes = [], {}
    for s in q.all():
        c = s.class_ref
        if not c:
            continue
        if c.id not in seen_classes:
            seen_classes[c.id] = {'id': c.id, 'name': c.name, 'section': c.section, 'subjects': []}
            out.append(seen_classes[c.id])
        seen_classes[c.id]['subjects'].append({'id': s.id, 'name': s.name, 'max_marks': s.max_marks, 'pass_marks': s.pass_marks})
    return jsonify(out), 200


# ═══════════════════════════════════════════════════════════════════════════
#  2. ROSTER — student list + marks + workflow status for Class+Exam+Subject
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/roster', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def get_roster():
    user = get_current_user()
    sid = _school_id()
    class_id   = request.args.get('class_id', type=int)
    exam_id    = request.args.get('exam_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id, subject_id required'}), 400

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    err = _validate_tenant(cls, exam, subject, sid)
    if err:
        return jsonify({'error': err}), 403

    allowed_ids = _teacher_subject_ids(user)
    if allowed_ids is not None and subject_id not in allowed_ids:
        return jsonify({'error': 'Aapko is subject ke marks dekhne/edit karne ki permission nahi hai'}), 403

    status_row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    db.session.commit()

    tt = ExamTimetable.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=subject_id).first()
    max_marks  = tt.max_marks  if tt else (subject.max_marks  or 100)
    pass_marks = tt.pass_marks if tt else (subject.pass_marks or 33)

    students = Student.query.filter_by(class_id=class_id, school_id=sid).order_by(Student.roll_number).all()
    existing = {m.student_id: m for m in Marks.query.filter_by(exam_id=exam_id, subject_id=subject_id, class_id=class_id).all()}
    returned_ids = {
        ri.student_id for ri in ResultReturnItem.query.filter_by(subject_status_id=status_row.id, resolved=False).all()
    }

    # editability rules (spec section 6 + 9)
    is_teacher = not _is_principal(user)
    if is_teacher:
        can_edit = status_row.status in ('DRAFT', 'RETURNED_FOR_CORRECTION')
    else:
        # Principal — DRAFT se APPROVED tak har stage pe edit access.
        # PUBLISHED locked rehta hai — wahan pehle Reopen Result use karna
        # padega (wahi "unpublish karke edit karo" wala flow, already bana hua hai).
        can_edit = status_row.status in ('DRAFT', 'SUBMITTED', 'RESUBMITTED', 'APPROVED')

    roster = []
    for s in students:
        m = existing.get(s.id)
        history_count = MarksAuditLog.query.filter_by(student_id=s.id, subject_id=subject_id, exam_id=exam_id).count()
        roster.append({
            'student_id':     s.id,
            'admission_no':   s.admission_no,
            'name':           s.user.name if s.user else '',
            'roll_number':    s.roll_number or '',
            'max_marks':      float(max_marks),
            'pass_marks':     float(pass_marks),
            'marks_obtained': float(m.marks_obtained) if m and m.marks_obtained is not None else None,
            'is_absent':      bool(m.is_absent) if m else False,
            'student_status': _derive_student_status(m) if m else 'NOT_EVALUATED',
            'grade':          m.grade if m else None,
            'remarks':        m.remarks if m else '',
            'version':        (m.version or 0) if m else 0,
            'marks_record_id': m.id if m else None,
            'was_modified':   history_count > 1,
            'history_count':  history_count,
            'flagged_for_correction': s.id in returned_ids,
        })

    return jsonify({
        'class':        cls.to_dict(),
        'exam':         exam.to_dict(),
        'subject':      subject.to_dict(),
        'status':       status_row.to_dict(),
        'can_edit':      can_edit,
        'is_principal': _is_principal(user),
        'roster':       roster,
    }), 200

# ═══════════════════════════════════════════════════════════════════════════
#  3. SAVE DRAFT (teacher or principal, only while editable)
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/save-draft', methods=['POST'])
@role_required('TEACHER', 'PRINCIPAL')
def save_draft():
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id, subject_id = data.get('class_id'), data.get('exam_id'), data.get('subject_id')
    entries = data.get('entries', [])
    reason  = (data.get('reason') or '').strip()  # required when editing after SUBMITTED/RESUBMITTED (a correction)

    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id, subject_id required'}), 400

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    err = _validate_tenant(cls, exam, subject, sid)
    if err:
        return jsonify({'error': err}), 403

    allowed_ids = _teacher_subject_ids(user)
    if allowed_ids is not None and subject_id not in allowed_ids:
        return jsonify({'error': 'Unauthorized: subject not assigned to you'}), 403

    status_row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    is_teacher = not _is_principal(user)

    if is_teacher and status_row.status not in ('DRAFT', 'RETURNED_FOR_CORRECTION'):
        return jsonify({'error': f'Marks are {status_row.status} — cannot edit. Ask Principal to return them for correction.'}), 409
    if not is_teacher and status_row.status not in ('DRAFT', 'SUBMITTED', 'RESUBMITTED', 'APPROVED'):
        return jsonify({'error': f'Marks are {status_row.status}. Use Reopen Result to edit a published result.'}), 409

    editing_after_submit = status_row.status in ('SUBMITTED', 'RESUBMITTED', 'APPROVED')
    if editing_after_submit and not reason:
        return jsonify({'error': 'A reason is required when correcting already-submitted marks'}), 400

    saved, conflicts = 0, []
    for entry in entries:
        student = Student.query.get(entry.get('student_id'))
        if not student or student.school_id != sid or int(student.class_id or 0) != class_id:
            continue

        record = Marks.query.filter_by(student_id=student.id, subject_id=subject_id, exam_id=exam_id).first()

        expected_version = entry.get('version', 0) or 0
        if record and (record.version or 0) != expected_version:
            conflicts.append({'student_id': student.id, 'current_version': record.version or 0})
            continue
        if record and record.is_locked:
            continue  # published + locked — must go through Reopen

        old_marks, old_status, old_remarks = (
            (record.marks_obtained if record else None),
            (_derive_student_status(record) if record else None),
            (record.remarks if record else None),
        )

        is_absent      = bool(entry.get('is_absent'))
        student_status = entry.get('student_status') or ('ABSENT' if is_absent else None)
        raw_marks      = entry.get('marks_obtained')
        max_marks      = float(entry.get('max_marks') or subject.max_marks or 100)

        if raw_marks is None and not is_absent and student_status not in ('MEDICAL_LEAVE',):
            continue  # empty cell — teacher hasn't entered this one yet, skip silently

        marks_obtained = 0.0 if (is_absent or student_status == 'MEDICAL_LEAVE') else float(raw_marks or 0)
        marks_obtained = max(0, min(marks_obtained, max_marks))

        if not record:
            record = Marks(student_id=student.id, subject_id=subject_id, exam_id=exam_id,
                            class_id=class_id, school_id=sid, version=0)
            db.session.add(record)
            db.session.flush()
            action = 'MARK_CREATED'
        else:
            action = 'MARK_UPDATED'

        record.marks_obtained = marks_obtained
        record.max_marks       = max_marks
        record.is_absent       = is_absent
        record.student_status  = student_status if not is_absent else 'ABSENT'
        record.remarks         = entry.get('remarks', '') or ''
        record.grade            = 'AB' if is_absent else _grade(marks_obtained, max_marks)
        record.entered_by      = user.id
        record.exam_type        = exam.exam_name
        record.version          = (record.version or 0) + 1

        new_status = _derive_student_status(record)
        # Only log when something actually changed — avoids noise from re-saving identical values.
        if old_marks != record.marks_obtained or old_status != new_status or (old_remarks or '') != (record.remarks or ''):
            _log_audit(user, student, subject, exam, cls, marks_record_id=record.id,
                       old_marks=old_marks, new_marks=record.marks_obtained,
                       old_status=old_status, new_status=new_status,
                       old_remarks=old_remarks, new_remarks=record.remarks,
                       action_type=action, reason=reason or None)
        saved += 1

    # If Principal corrects a value while an item was flagged returned, mark it resolved
    if not is_teacher:
        touched_ids = {e.get('student_id') for e in entries}
        for ri in ResultReturnItem.query.filter_by(subject_status_id=status_row.id, resolved=False).all():
            if ri.student_id in touched_ids:
                ri.resolved = True

    db.session.commit()

    if conflicts:
        return jsonify({
            'message': f'{saved} marks saved, {len(conflicts)} skipped due to a conflicting edit',
            'conflicts': conflicts,
        }), 409 if saved == 0 else 200
    return jsonify({'message': f'{saved} marks saved as draft'}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  4. TEACHER SUBMITS TO PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/submit', methods=['POST'])
@role_required('TEACHER')
def submit_to_principal():
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id, subject_id = data.get('class_id'), data.get('exam_id'), data.get('subject_id')
    if not all([class_id, exam_id, subject_id]):
        return jsonify({'error': 'class_id, exam_id, subject_id required'}), 400

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    err = _validate_tenant(cls, exam, subject, sid)
    if err:
        return jsonify({'error': err}), 403

    allowed_ids = _teacher_subject_ids(user)
    if allowed_ids is not None and subject_id not in allowed_ids:
        return jsonify({'error': 'Unauthorized: subject not assigned to you'}), 403

    status_row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    if status_row.status not in ('DRAFT', 'RETURNED_FOR_CORRECTION'):
        return jsonify({'error': f'Cannot submit — current status is {status_row.status}'}), 409

    total_students = Student.query.filter_by(class_id=class_id, school_id=sid).count()
    marks_count = Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=subject_id).count()
    if marks_count == 0:
        return jsonify({'error': 'Enter marks for at least one student before submitting'}), 400
    if marks_count < total_students:
        return jsonify({'error': f'Only {marks_count}/{total_students} students have marks entered. '
                                  f'Mark the rest Absent/Not Evaluated or fill them in before submitting.'}), 400

    was_return = status_row.status == 'RETURNED_FOR_CORRECTION'
    status_row.status       = 'RESUBMITTED' if was_return else 'SUBMITTED'
    status_row.submitted_at = datetime.utcnow()
    status_row.submitted_by = user.id
    status_row.version      = (status_row.version or 0) + 1

    try:
        _log_audit(user, None, subject, exam, cls, action_type='RESUBMITTED' if was_return else 'SUBMITTED')
    except Exception:
        pass

    try:
        for principal in _school_principals(sid):
            _notify(principal.id, 'Marks submitted for review',
                    f'{subject.name} marks for {cls.name} - {cls.section} ({exam.exam_name}) '
                    f'have been {"resubmitted" if was_return else "submitted"} by {user.name}.',
                    school_id=sid)
    except Exception:
        pass

    db.session.commit()
    return jsonify({'message': 'Submitted to Principal', 'status': status_row.to_dict()}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  5. PRINCIPAL — submission-progress dashboard for Class + Exam
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/principal/dashboard', methods=['GET'])
@role_required('PRINCIPAL')
def principal_dashboard():
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id  = request.args.get('exam_id', type=int)
    if not all([class_id, exam_id]):
        return jsonify({'error': 'class_id and exam_id required'}), 400

    cls  = Class.query.get_or_404(class_id)
    exam = ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    total_students = Student.query.filter_by(class_id=class_id, school_id=sid).count()

    subjects = Subject.query.filter_by(class_id=class_id).all()
    rows = []
    counts = {'submitted': 0, 'pending': 0, 'returned': 0, 'approved': 0}
    total_marks_entered = 0
    for s in subjects:
        row = _get_or_create_status(sid, exam_id, class_id, s.id)
        d = row.to_dict()
        entered = Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).count()
        d['total_students'] = total_students
        d['marks_entered']  = entered
        total_marks_entered += entered
        rows.append(d)
        if row.status in ('DRAFT',):
            counts['pending'] += 1
        elif row.status in ('SUBMITTED', 'RESUBMITTED'):
            counts['submitted'] += 1
        elif row.status == 'RETURNED_FOR_CORRECTION':
            counts['returned'] += 1
        elif row.status in ('APPROVED', 'PUBLISHED'):
            counts['approved'] += 1
    db.session.commit()

    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first()

    return jsonify({
        'class': cls.to_dict(), 'exam': exam.to_dict(),
        'subjects': rows,
        'total_subjects': len(subjects),
        'total_students': total_students,
        'total_marks_entered': total_marks_entered,
        'total_marks_expected': total_students * len(subjects),
        'counts': counts,
        'publication': pub.to_dict() if pub else {'status': 'NOT_PUBLISHED'},
        'can_publish': len(subjects) > 0 and all(r['status'] in ('APPROVED', 'PUBLISHED') for r in rows),
    }), 200


# ═══════════════════════════════════════════════════════════════════════════
#  6. PRINCIPAL — approve / return
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/principal/approve', methods=['POST'])
@role_required('PRINCIPAL')
def approve_subject():
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id, subject_id = data.get('class_id'), data.get('exam_id'), data.get('subject_id')

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    if row.status in ('APPROVED', 'PUBLISHED'):
        return jsonify({'message': f'Subject is already {row.status}', 'status': row.to_dict()}), 200

    row.status      = 'APPROVED'
    row.approved_at = datetime.utcnow()
    row.approved_by = user.id
    row.reviewed_at = datetime.utcnow()
    row.reviewed_by = user.id
    row.version     = (row.version or 0) + 1
    _log_audit(user, None, subject, exam, cls, action_type='APPROVED')
    db.session.commit()
    return jsonify({'message': 'Subject approved', 'status': row.to_dict()}), 200


@result_bp.route('/principal/return', methods=['POST'])
@role_required('PRINCIPAL')
def return_subject():
    """Return whole subject, or specific students (data.student_ids)."""
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id, subject_id = data.get('class_id'), data.get('exam_id'), data.get('subject_id')
    reason = (data.get('reason') or '').strip()
    student_ids = data.get('student_ids') or []

    if not reason:
        return jsonify({'error': 'A reason is required to return marks for correction'}), 400

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    if row.status in ('PUBLISHED',):
        return jsonify({'error': 'Cannot return a published subject — please Reopen the class result first'}), 409

    row.status        = 'RETURNED_FOR_CORRECTION'
    row.return_reason = reason
    row.reviewed_at    = datetime.utcnow()
    row.reviewed_by    = user.id
    row.version        = (row.version or 0) + 1

    for sid_ in student_ids:
        db.session.add(ResultReturnItem(subject_status_id=row.id, student_id=sid_))

    _log_audit(user, None, subject, exam, cls, action_type='RETURNED', reason=reason)

    teacher = Teacher.query.get(row.teacher_id) if row.teacher_id else None
    if teacher and teacher.user_id:
        scope = f'{len(student_ids)} student(s)' if student_ids else 'the whole subject'
        _notify(teacher.user_id, 'Marks returned for correction',
                f'{subject.name} marks for {cls.name} - {cls.section} ({exam.exam_name}) were returned '
                f'for {scope}. Reason: {reason}', school_id=sid)

    db.session.commit()
    return jsonify({'message': 'Returned for correction', 'status': row.to_dict()}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  7. PUBLISH WORKFLOW — precheck / preview / publish / reopen
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/publish/precheck', methods=['GET'])
@role_required('PRINCIPAL')
def publish_precheck():
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id  = request.args.get('exam_id', type=int)
    cls, exam = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    subjects = Subject.query.filter_by(class_id=class_id).all()
    blockers = []
    if not subjects:
        blockers.append('No subjects configured for this class.')
    for s in subjects:
        row = _get_or_create_status(sid, exam_id, class_id, s.id)
        if row.status == 'DRAFT':
            blockers.append(f'{s.name} marks have not been submitted yet.')
        elif row.status in ('SUBMITTED', 'RESUBMITTED'):
            blockers.append(f'{s.name} marks are awaiting your review.')
        elif row.status == 'RETURNED_FOR_CORRECTION':
            blockers.append(f'{s.name} marks have been returned for correction.')
    db.session.commit()

    total_students = Student.query.filter_by(class_id=class_id, school_id=sid).count()
    for s in subjects:
        entered = Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).count()
        if entered < total_students:
            blockers.append(f'{s.name}: {total_students - entered} student(s) still missing marks.')

    return jsonify({'can_publish': len(blockers) == 0, 'blockers': blockers}), 200


@result_bp.route('/publish/preview', methods=['GET'])
@role_required('PRINCIPAL')
def publish_preview():
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id  = request.args.get('exam_id', type=int)
    cls, exam = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    subjects = Subject.query.filter_by(class_id=class_id).all()
    students = Student.query.filter_by(class_id=class_id, school_id=sid).order_by(Student.roll_number).all()
    all_marks = {(m.student_id, m.subject_id): m for m in
                 Marks.query.filter_by(exam_id=exam_id, class_id=class_id).all()}

    cards = []
    for s in students:
        subj_rows, total_obt, total_max = [], 0, 0
        for subj in subjects:
            m = all_marks.get((s.id, subj.id))
            obt = m.marks_obtained if m else 0
            mx  = m.max_marks if m else (subj.max_marks or 100)
            if not (m and m.is_absent):
                total_obt += obt
                total_max += mx
            subj_rows.append({
                'subject_name': subj.name, 'max_marks': mx,
                'marks_obtained': obt if m else None,
                'grade': m.grade if m else '—',
                'status': _derive_student_status(m) if m else 'NOT_EVALUATED',
            })
        pct = round(total_obt / total_max * 100, 2) if total_max else 0
        cards.append({
            'student_id': s.id, 'name': s.user.name if s.user else '', 'roll_number': s.roll_number,
            'admission_no': s.admission_no, 'subjects': subj_rows,
            'total_max': total_max, 'total_obtained': total_obt, 'percentage': pct,
            'overall_grade': _grade(total_obt, total_max) if total_max else '—',
            'result': 'PASS' if pct >= 33 else 'FAIL',
        })

    return jsonify({'class': cls.to_dict(), 'exam': exam.to_dict(), 'students': cards}), 200


@result_bp.route('/publish', methods=['POST'])
@role_required('PRINCIPAL')
def publish_result():
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id = data.get('class_id'), data.get('exam_id')
    force  = bool(data.get('force'))
    reason = (data.get('reason') or '').strip()
    cls, exam = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    subjects = Subject.query.filter_by(class_id=class_id).all()
    rows = [_get_or_create_status(sid, exam_id, class_id, s.id) for s in subjects]
    if not rows:
        return jsonify({'error': 'No subjects configured for this class.'}), 400

    blocked = [r for r in rows if r.status not in ('APPROVED', 'PUBLISHED')]
    if blocked and not force:
        return jsonify({'error': 'Cannot publish — one or more subjects are not yet approved. Check the Publish tab for details.'}), 400
    if blocked and force:
        if not reason:
            return jsonify({'error': 'A reason is required to force-publish with pending subjects'}), 400
        for r in blocked:
            old = r.status
            r.status, r.approved_at, r.approved_by = 'APPROVED', datetime.utcnow(), user.id
            _log_audit(user, None, Subject.query.get(r.subject_id), exam, cls, action_type='APPROVED',
                       old_status=old, new_status='APPROVED', reason=f'FORCE-APPROVED at publish: {reason}')

    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first()
    if not pub:
        pub = ClassResultPublication(school_id=sid, exam_id=exam_id, class_id=class_id)
        db.session.add(pub)

    pub.status       = 'PUBLISHED'
    pub.published_at = datetime.utcnow()
    pub.published_by  = user.id

    for r in rows:
        r.status = 'PUBLISHED'
        Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=r.subject_id).update({'is_locked': True})

    # Archive snapshot into ResultVersion
    marks_list = Marks.query.filter_by(exam_id=exam_id, class_id=class_id).all()
    snapshot_data = [
        {
            'student_id': m.student_id,
            'subject_id': m.subject_id,
            'marks_obtained': m.marks_obtained,
            'max_marks': m.max_marks,
            'is_absent': m.is_absent,
            'grade': m.grade,
            'status': m.student_status,
        }
        for m in marks_list
    ]
    ver_entry = ResultVersion(
        school_id=sid, exam_id=exam_id, class_id=class_id,
        version_number=1, published_by=user.id, published_at=datetime.utcnow(),
        reason='Initial publication', snapshot_json=json.dumps(snapshot_data)
    )
    db.session.add(ver_entry)

    _log_audit(user, None, None, exam, cls, action_type='RESULT_PUBLISHED')

    for s in Student.query.filter_by(class_id=class_id, school_id=sid).all():
        if s.user_id:
            _notify(s.user_id, 'Result Published',
                    f'{exam.exam_name} result for {cls.name} - {cls.section} has been published.', school_id=sid)

    db.session.commit()
    return jsonify({'message': 'Result published', 'publication': pub.to_dict()}), 200


@result_bp.route('/reopen', methods=['POST'])
@role_required('PRINCIPAL')
def reopen_result():
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id = data.get('class_id'), data.get('exam_id')
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'A reason is required to reopen a published result'}), 400

    cls, exam = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first()
    if not pub or pub.status != 'PUBLISHED':
        return jsonify({'error': 'Result is not currently published'}), 409

    pub.status        = 'REOPENED'
    pub.reopened_at    = datetime.utcnow()
    pub.reopened_by    = user.id
    pub.reopen_reason  = reason

    subjects = Subject.query.filter_by(class_id=class_id).all()
    for s in subjects:
        row = ResultSubjectStatus.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).first()
        if row:
            row.status = 'APPROVED'  # stays approved — principal can now correct + republish directly
        Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).update({'is_locked': False})

    # Update latest ResultVersion record with reopen details
    last_ver = ResultVersion.query.filter_by(exam_id=exam_id, class_id=class_id).order_by(ResultVersion.version_number.desc()).first()
    if last_ver:
        last_ver.reopened_by = user.id
        last_ver.reopened_at = datetime.utcnow()
        last_ver.reason = reason

    _log_audit(user, None, None, exam, cls, action_type='RESULT_REOPENED', reason=reason)
    db.session.commit()
    return jsonify({'message': 'Result reopened for correction', 'publication': pub.to_dict()}), 200


@result_bp.route('/republish', methods=['POST'])
@role_required('PRINCIPAL')
def republish_result():
    """After a Reopen + corrections, Principal reviews again and republishes."""
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id = data.get('class_id'), data.get('exam_id')
    cls, exam = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    pub = ClassResultPublication.query.filter_by(exam_id=exam_id, class_id=class_id).first()
    if not pub or pub.status != 'REOPENED':
        return jsonify({'error': 'Result is not currently reopened'}), 409

    pub.status          = 'PUBLISHED'
    pub.published_at     = datetime.utcnow()
    pub.published_by     = user.id
    pub.republish_count  = (pub.republish_count or 0) + 1

    subjects = Subject.query.filter_by(class_id=class_id).all()
    for s in subjects:
        row = ResultSubjectStatus.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).first()
        if row:
            row.status = 'PUBLISHED'
        Marks.query.filter_by(exam_id=exam_id, class_id=class_id, subject_id=s.id).update({'is_locked': True})

    # Archive new version snapshot into ResultVersion
    marks_list = Marks.query.filter_by(exam_id=exam_id, class_id=class_id).all()
    snapshot_data = [
        {
            'student_id': m.student_id,
            'subject_id': m.subject_id,
            'marks_obtained': m.marks_obtained,
            'max_marks': m.max_marks,
            'is_absent': m.is_absent,
            'grade': m.grade,
            'status': m.student_status,
        }
        for m in marks_list
    ]
    new_ver = ResultVersion(
        school_id=sid, exam_id=exam_id, class_id=class_id,
        version_number=pub.republish_count + 1, published_by=user.id, published_at=datetime.utcnow(),
        reason='Republished after correction', snapshot_json=json.dumps(snapshot_data)
    )
    db.session.add(new_ver)

    _log_audit(user, None, None, exam, cls, action_type='RESULT_REPUBLISHED')

    for s in Student.query.filter_by(class_id=class_id, school_id=sid).all():
        if s.user_id:
            _notify(s.user_id, 'Result Updated',
                    f'{exam.exam_name} result for {cls.name} - {cls.section} has been corrected and republished.',
                    school_id=sid)

    db.session.commit()
    return jsonify({'message': 'Result republished', 'publication': pub.to_dict()}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  7. TEACHER DELEGATIONS & NOTIFICATIONS & SEARCH
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/delegations', methods=['GET', 'POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def manage_delegations():
    sid = _school_id()
    user = get_current_user()

    if request.method == 'GET':
        exam_id = request.args.get('exam_id', type=int)
        class_id = request.args.get('class_id', type=int)
        q = ExamTeacherDelegation.query.filter_by(school_id=sid)
        if exam_id:
            q = q.filter_by(exam_id=exam_id)
        if class_id:
            q = q.filter_by(class_id=class_id)
        delegations = q.order_by(ExamTeacherDelegation.created_at.desc()).all()
        return jsonify([d.to_dict() for d in delegations]), 200

    # POST — create delegation
    data = request.get_json() or {}
    exam_id              = data.get('exam_id')
    class_id             = data.get('class_id')
    subject_id           = data.get('subject_id')
    delegated_teacher_id = data.get('delegated_teacher_id')
    end_date_str         = data.get('end_date')
    reason               = (data.get('reason') or '').strip()

    if not all([exam_id, class_id, subject_id, delegated_teacher_id, end_date_str, reason]):
        return jsonify({'error': 'exam_id, class_id, subject_id, delegated_teacher_id, end_date, and reason are required'}), 400

    subject = Subject.query.get_or_404(subject_id)
    if subject.school_id and subject.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        end_dt = datetime.fromisoformat(str(end_date_str).replace('Z', '+00:00')).replace(tzinfo=None)
    except Exception:
        return jsonify({'error': 'Invalid end_date format'}), 400

    if end_dt <= datetime.utcnow():
        return jsonify({'error': 'End date must be in the future'}), 400

    delegation = ExamTeacherDelegation(
        school_id=sid,
        exam_id=exam_id,
        class_id=class_id,
        subject_id=subject_id,
        original_teacher_id=subject.teacher_id,
        delegated_teacher_id=delegated_teacher_id,
        start_date=datetime.utcnow(),
        end_date=end_dt,
        reason=reason,
        status='ACTIVE',
        created_by=user.id
    )
    db.session.add(delegation)

    # Notify replacement teacher
    del_teacher = Teacher.query.get(delegated_teacher_id)
    if del_teacher and del_teacher.user_id:
        exam = ExamSchedule.query.get(exam_id)
        cls = Class.query.get(class_id)
        _notify(
            del_teacher.user_id,
            'Mark Entry Delegated',
            f'You have been temporarily delegated mark entry for {subject.name} ({cls.name}-{cls.section}) for {exam.exam_name}. Reason: {reason}',
            school_id=sid
        )

    db.session.commit()
    return jsonify(delegation.to_dict()), 201


@result_bp.route('/delegations/<int:delegation_id>/revoke', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def revoke_delegation(delegation_id):
    sid = _school_id()
    del_rec = ExamTeacherDelegation.query.get_or_404(delegation_id)
    if del_rec.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    del_rec.status = 'REVOKED'
    del_rec.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Delegation revoked successfully'}), 200


@result_bp.route('/notify-teacher', methods=['POST'])
@role_required('PRINCIPAL', 'SUPER_ADMIN')
def notify_teacher_pending():
    """Principal clicks 'Notify Teacher' to remind them to submit marks."""
    sid = _school_id()
    data = request.get_json() or {}
    exam_id = data.get('exam_id')
    class_id = data.get('class_id')
    subject_id = data.get('subject_id')

    if not all([exam_id, class_id, subject_id]):
        return jsonify({'error': 'exam_id, class_id, subject_id required'}), 400

    exam = ExamSchedule.query.get_or_404(exam_id)
    cls = Class.query.get_or_404(class_id)
    subject = Subject.query.get_or_404(subject_id)
    if exam.school_id != sid or cls.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    # Find recipient: check active delegation first, fallback to subject teacher
    now = datetime.utcnow()
    delegation = ExamTeacherDelegation.query.filter_by(
        exam_id=exam_id, class_id=class_id, subject_id=subject_id, status='ACTIVE'
    ).filter(ExamTeacherDelegation.end_date >= now).first()

    teacher_id = delegation.delegated_teacher_id if delegation else subject.teacher_id
    if not teacher_id:
        return jsonify({'error': 'No teacher currently assigned to this subject'}), 400

    teacher = Teacher.query.get(teacher_id)
    if not teacher or not teacher.user_id:
        return jsonify({'error': 'Teacher user account not found'}), 404

    msg = f"Reminder: Please complete and submit marks for {subject.name} ({cls.name} - {cls.section}) for {exam.exam_name}."
    _notify(teacher.user_id, 'Marks Submission Reminder', msg, school_id=sid)
    db.session.commit()

    return jsonify({'message': f'Notification sent to {teacher.user.name if teacher.user else "teacher"}'}), 200


@result_bp.route('/search', methods=['GET'])
@role_required('PRINCIPAL', 'SUPER_ADMIN', 'TEACHER')
def search_student_results():
    """Search for students by name, roll number, or admission number and view their published results."""
    sid = _school_id()
    query_str = (request.args.get('q') or '').strip()
    if not query_str or len(query_str) < 2:
        return jsonify({'error': 'Search query must be at least 2 characters'}), 400

    students = Student.query.join(User, Student.user_id == User.id).filter(
        Student.school_id == sid,
        (User.name.ilike(f'%{query_str}%')) |
        (Student.roll_number.ilike(f'%{query_str}%')) |
        (Student.admission_no.ilike(f'%{query_str}%'))
    ).limit(20).all()

    out = []
    for s in students:
        marks = Marks.query.filter_by(student_id=s.id).all()
        exam_ids = list({m.exam_id for m in marks if m.exam_id})
        exams = ExamSchedule.query.filter(ExamSchedule.id.in_(exam_ids)).all() if exam_ids else []
        
        cls = s.class_ref
        out.append({
            'student_id':   s.id,
            'name':         s.user.name if s.user else '',
            'roll_number':  s.roll_number or '—',
            'admission_no': s.admission_no or '—',
            'class_name':   f"{cls.name} - {cls.section}" if cls else '',
            'exams':        [{'id': e.id, 'exam_name': e.exam_name, 'session': e.session, 'status': e.status, 'is_published': e.is_published} for e in exams]
        })

    return jsonify({'results': out}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  8. HISTORY + ACTIVITY FEED
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/history', methods=['GET'])
@role_required('TEACHER', 'PRINCIPAL')
def mark_history():
    student_id = request.args.get('student_id', type=int)
    subject_id = request.args.get('subject_id', type=int)
    exam_id    = request.args.get('exam_id', type=int)
    if not all([student_id, subject_id, exam_id]):
        return jsonify({'error': 'student_id, subject_id, exam_id required'}), 400

    student = Student.query.get_or_404(student_id)
    if student.school_id != _school_id():
        return jsonify({'error': 'Unauthorized'}), 403

    logs = MarksAuditLog.query.filter_by(
        student_id=student_id, subject_id=subject_id, exam_id=exam_id
    ).order_by(MarksAuditLog.created_at.asc()).all()
    return jsonify([l.to_dict() for l in logs]), 200


@result_bp.route('/activity', methods=['GET'])
@role_required('PRINCIPAL')
def recent_activity():
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id  = request.args.get('exam_id', type=int)
    limit    = min(request.args.get('limit', 20, type=int), 100)

    q = MarksAuditLog.query.filter_by(school_id=sid)
    if class_id:
        q = q.filter_by(class_id=class_id)
    if exam_id:
        q = q.filter_by(exam_id=exam_id)
    logs = q.order_by(MarksAuditLog.created_at.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs]), 200


@result_bp.route('/principal/delete-mark', methods=['POST'])
@role_required('PRINCIPAL')
def delete_mark():
    """Permanently remove one student's mark entry. Published/locked
    records must be Reopened first — same rule as editing."""
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    student_id, subject_id, exam_id = data.get('student_id'), data.get('subject_id'), data.get('exam_id')
    reason = (data.get('reason') or '').strip()
    if not all([student_id, subject_id, exam_id]):
        return jsonify({'error': 'student_id, subject_id, exam_id required'}), 400
    if not reason:
        return jsonify({'error': 'A reason is required to delete a mark entry'}), 400

    student = Student.query.get_or_404(student_id)
    subject = Subject.query.get_or_404(subject_id)
    exam    = ExamSchedule.query.get_or_404(exam_id)
    if student.school_id != sid or (subject.school_id and subject.school_id != sid) or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    record = Marks.query.filter_by(student_id=student_id, subject_id=subject_id, exam_id=exam_id).first()
    if not record:
        return jsonify({'error': 'No mark entry found'}), 404
    if record.is_locked:
        return jsonify({'error': 'Marks are published/locked. Reopen the result before deleting.'}), 409

    cls = Class.query.get(student.class_id)
    _log_audit(user, student, subject, exam, cls, marks_record_id=record.id,
               old_marks=record.marks_obtained, new_marks=None,
               old_status=_derive_student_status(record), new_status='NOT_EVALUATED',
               old_remarks=record.remarks, new_remarks=None,
               action_type='MARK_UPDATED', reason=f'DELETED: {reason}')

    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Mark entry deleted'}), 200


@result_bp.route('/principal/reset-status', methods=['POST'])
@role_required('PRINCIPAL')
def reset_status():
    """Force a subject's workflow back to DRAFT from any state (except
    PUBLISHED — reopen it first). Full undo, use sparingly."""
    user = get_current_user()
    sid  = _school_id()
    data = request.get_json() or {}
    class_id, exam_id, subject_id = data.get('class_id'), data.get('exam_id'), data.get('subject_id')
    reason = (data.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'A reason is required to reset a subject to Draft'}), 400

    cls, exam, subject = Class.query.get_or_404(class_id), ExamSchedule.query.get_or_404(exam_id), Subject.query.get_or_404(subject_id)
    if cls.school_id != sid or exam.school_id != sid:
        return jsonify({'error': 'Unauthorized'}), 403

    row = _get_or_create_status(sid, exam_id, class_id, subject_id)
    if row.status == 'PUBLISHED':
        return jsonify({'error': 'Subject is published — reopen the result first'}), 409

    old_status = row.status
    row.status = 'DRAFT'
    row.version = (row.version or 0) + 1
    _log_audit(user, None, subject, exam, cls, action_type='STATUS_CHANGED',
               old_status=old_status, new_status='DRAFT', reason=reason)
    db.session.commit()
    return jsonify({'message': 'Subject reset to Draft', 'status': row.to_dict()}), 200


# ═══════════════════════════════════════════════════════════════════════════
#  9. EXAM ANALYTICS & OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════

@result_bp.route('/analytics/filters', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
def analytics_filters():
    sid = _school_id()
    exams = ExamSchedule.query.filter_by(school_id=sid).all()
    
    exam_types = sorted(list({e.exam_type for e in exams if getattr(e, 'exam_type', None)}))
    if not exam_types:
        exam_types = ['UNIT_TEST', 'MID_TERM', 'FINAL', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CLASS_TEST']
        
    sessions = sorted(list({e.session for e in exams if getattr(e, 'session', None)}), reverse=True)
    if not sessions:
        sessions = ['2026-27', '2025-26', '2024-25']
        
    years = sorted(list({str(e.start_date.year) for e in exams if getattr(e, 'start_date', None)}), reverse=True)
    if not years:
        years = ['2026', '2025', '2024']

    return jsonify({
        'exam_types': exam_types,
        'sessions': sessions,
        'years': years
    }), 200


@result_bp.route('/analytics/overview', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
def analytics_overview():
    sid = _school_id()
    exam_type = request.args.get('exam_type')
    year = request.args.get('year')
    session = request.args.get('session')

    q = ExamSchedule.query.filter_by(school_id=sid)
    if exam_type:
        q = q.filter(ExamSchedule.exam_type == exam_type)
    if session:
        q = q.filter(ExamSchedule.session == session)
    if year:
        try:
            y_int = int(year)
            q = q.filter(db.extract('year', ExamSchedule.start_date) == y_int)
        except Exception:
            pass

    exams = q.order_by(ExamSchedule.id.desc()).all()
    
    total_appeared_all = 0
    total_passed_all = 0
    total_failed_all = 0
    plus80_all = 0
    plus90_all = 0
    percentages_list = []

    b_90_plus = 0
    b_80_89 = 0
    b_70_79 = 0
    b_60_69 = 0
    b_under_60 = 0

    class_wise_stats = []
    exams_summary_list = []

    classes_all = Class.query.filter_by(school_id=sid).order_by(Class.name, Class.section).all()

    for ex in exams:
        ex_year = str(ex.start_date.year) if ex.start_date else (ex.session.split('-')[0] if ex.session else '2026')
        ex_students = 0
        ex_appeared = 0
        ex_passed = 0
        ex_80plus = 0

        for c in classes_all:
            c_students = c.students.all()
            c_total = len(c_students)
            if c_total == 0:
                continue

            c_marks = Marks.query.filter_by(exam_id=ex.id, class_id=c.id).all()
            c_pub = ClassResultPublication.query.filter_by(exam_id=ex.id, class_id=c.id).first()
            is_published = (c_pub and c_pub.status == 'PUBLISHED') or bool(ex.is_published)

            student_totals = {}
            for m in c_marks:
                st_id = m.student_id
                if st_id not in student_totals:
                    student_totals[st_id] = {'obt': 0, 'max': 0, 'is_absent': False}
                if m.is_absent:
                    student_totals[st_id]['is_absent'] = True
                else:
                    student_totals[st_id]['obt'] += (m.marks_obtained or 0)
                    student_totals[st_id]['max'] += (m.max_marks or 100)

            c_appeared_cnt = len(student_totals)
            c_passed_cnt = 0
            c_failed_cnt = 0
            c_80plus_cnt = 0

            for st_id, data in student_totals.items():
                if data['max'] > 0:
                    pct = round((data['obt'] / data['max']) * 100, 1)
                    percentages_list.append(pct)
                    if pct >= 33:
                        c_passed_cnt += 1
                    else:
                        c_failed_cnt += 1
                    
                    if pct >= 90:
                        b_90_plus += 1
                        plus90_all += 1
                    elif pct >= 80:
                        b_80_89 += 1
                    elif pct >= 70:
                        b_70_79 += 1
                    elif pct >= 60:
                        b_60_69 += 1
                    else:
                        b_under_60 += 1

                    if pct >= 80:
                        c_80plus_cnt += 1
                        plus80_all += 1

            total_appeared_all += c_appeared_cnt
            total_passed_all += c_passed_cnt
            total_failed_all += c_failed_cnt

            ex_students += c_total
            ex_appeared += c_appeared_cnt
            ex_passed += c_passed_cnt
            ex_80plus += c_80plus_cnt

            if c_appeared_cnt > 0:
                c_pass_pct = round((c_passed_cnt / c_appeared_cnt) * 100, 1)
                c_80_pct = round((c_80plus_cnt / c_appeared_cnt) * 100, 1)
                class_wise_stats.append({
                    'class_id': c.id,
                    'class_name': c.name,
                    'section': c.section or '',
                    'exam_id': ex.id,
                    'total_students': c_total,
                    'appeared': c_appeared_cnt,
                    'passed': c_passed_cnt,
                    'failed': c_failed_cnt,
                    'marks_80plus': c_80plus_cnt,
                    'plus80_pct': c_80_pct,
                    'pass_pct': c_pass_pct,
                    'published': is_published
                })

        ex_pass_pct = round((ex_passed / ex_appeared * 100), 1) if ex_appeared > 0 else 0
        ex_80_pct = round((ex_80plus / ex_appeared * 100), 1) if ex_appeared > 0 else 0

        exams_summary_list.append({
            'exam_id': ex.id,
            'year': ex_year,
            'session': ex.session or '2024-25',
            'exam_name': ex.exam_name,
            'start_date': ex.start_date.isoformat() if ex.start_date else None,
            'end_date': ex.end_date.isoformat() if ex.end_date else None,
            'total_students': ex_students,
            'appeared': ex_appeared,
            'pass_pct': ex_pass_pct,
            'plus80': ex_80plus,
            'plus80_pct': ex_80_pct
        })

    avg_pct = round(sum(percentages_list) / len(percentages_list), 1) if percentages_list else 0

    return jsonify({
        'summary': {
            'total_appeared': total_appeared_all,
            'total_passed': total_passed_all,
            'total_failed': total_failed_all,
            'plus80': plus80_all,
            'plus90': plus90_all,
            'avg_pct': avg_pct
        },
        'distribution': [
            {'label': '90+', 'count': b_90_plus},
            {'label': '80-89', 'count': b_80_89},
            {'label': '70-79', 'count': b_70_79},
            {'label': '60-69', 'count': b_60_69},
            {'label': '<60', 'count': b_under_60},
        ],
        'class_wise': class_wise_stats,
        'exams': exams_summary_list
    }), 200


@result_bp.route('/analytics/class-students', methods=['GET'])
@role_required('PRINCIPAL', 'TEACHER', 'SUPER_ADMIN')
def analytics_class_students():
    sid = _school_id()
    class_id = request.args.get('class_id', type=int)
    exam_id = request.args.get('exam_id', type=int)
    bucket = request.args.get('bucket', '80plus')

    if not class_id or not exam_id:
        return jsonify({'error': 'class_id and exam_id required'}), 400

    students = Student.query.filter_by(class_id=class_id, school_id=sid).all()
    marks = Marks.query.filter_by(class_id=class_id, exam_id=exam_id).all()

    student_totals = {}
    for m in marks:
        st_id = m.student_id
        if st_id not in student_totals:
            student_totals[st_id] = {'obt': 0, 'max': 0}
        if not m.is_absent:
            student_totals[st_id]['obt'] += (m.marks_obtained or 0)
            student_totals[st_id]['max'] += (m.max_marks or 100)

    result_students = []
    for s in students:
        if s.id in student_totals and student_totals[s.id]['max'] > 0:
            obt = student_totals[s.id]['obt']
            mx = student_totals[s.id]['max']
            pct = round((obt / mx) * 100, 1)

            include = False
            if bucket == '80plus' and pct >= 80:
                include = True
            elif bucket == '90plus' and pct >= 90:
                include = True
            elif bucket == 'failed' and pct < 33:
                include = True
            elif bucket == 'all':
                include = True
            elif pct >= 80:
                include = True

            if include:
                result_students.append({
                    'student_id': s.id,
                    'roll_number': s.roll_number or '—',
                    'name': s.user.name if s.user else '',
                    'total_obtained': obt,
                    'total_max': mx,
                    'percentage': pct
                })

    result_students.sort(key=lambda x: x['percentage'], reverse=True)
    return jsonify({'students': result_students}), 200
