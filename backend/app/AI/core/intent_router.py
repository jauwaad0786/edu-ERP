"""
Intent Router
High-speed regex + pattern matching to classify school ERP queries.
Avoids a full LLM call for every known query type.

Flow:
  Message → normalize → pattern match → Intent + Parameters
  If no match → LLM classification → approved intent
"""
import re
from datetime import datetime, date
import calendar


# ─── All supported intents ──────────────────────────────────────────────────
class Intent:
    # Financial
    FEE_COLLECTION       = 'FEE_COLLECTION'
    FEE_OUTSTANDING      = 'FEE_OUTSTANDING'
    FEE_COMPARISON       = 'FEE_COMPARISON'
    FEE_PENDING_STUDENTS = 'FEE_PENDING_STUDENTS'
    TRANSPORT_FEE        = 'TRANSPORT_FEE'
    HOSTEL_FEE           = 'HOSTEL_FEE'
    LIBRARY_FINES        = 'LIBRARY_FINES'

    # Attendance
    ATTENDANCE_TODAY     = 'ATTENDANCE_TODAY'
    ATTENDANCE_CLASSWISE = 'ATTENDANCE_CLASSWISE'
    ATTENDANCE_TREND     = 'ATTENDANCE_TREND'
    LOW_ATTENDANCE_STUDENTS = 'LOW_ATTENDANCE_STUDENTS'

    # Academic
    TOP_STUDENTS         = 'TOP_STUDENTS'
    WEAK_STUDENTS        = 'WEAK_STUDENTS'
    CLASS_PERFORMANCE    = 'CLASS_PERFORMANCE'
    EXAM_RESULTS         = 'EXAM_RESULTS'

    # Infrastructure
    TRANSPORT_SUMMARY    = 'TRANSPORT_SUMMARY'
    HOSTEL_SUMMARY       = 'HOSTEL_SUMMARY'
    LIBRARY_SUMMARY      = 'LIBRARY_SUMMARY'

    # School Overview
    SCHOOL_SUMMARY       = 'SCHOOL_SUMMARY'
    STUDENT_COUNT        = 'STUDENT_COUNT'
    TEACHER_COUNT        = 'TEACHER_COUNT'

    # Teacher-specific
    TEACHER_LESSON_PLAN  = 'TEACHER_LESSON_PLAN'
    TEACHER_PRACTICE_QA  = 'TEACHER_PRACTICE_QA'
    TEACHER_CLASS_PERF   = 'TEACHER_CLASS_PERF'
    DOCUMENT_QA          = 'DOCUMENT_QA'

    GENERAL              = 'GENERAL'
    CLARIFICATION_NEEDED = 'CLARIFICATION_NEEDED'


# ─── Month name → number mapping (Hindi + English) ──────────────────────────
MONTH_MAP = {
    'jan': 1, 'january': 1, 'janvari': 1,
    'feb': 2, 'february': 2, 'farvari': 2,
    'mar': 3, 'march': 3,
    'apr': 4, 'april': 4,
    'may': 5, 'mei': 5,
    'jun': 6, 'june': 6,
    'jul': 7, 'july': 7,
    'aug': 8, 'august': 8,
    'sep': 9, 'september': 9,
    'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dec': 12, 'december': 12,
}

CURRENT_MONTH    = date.today().month
CURRENT_YEAR     = date.today().year
CURRENT_SESSION  = f"{CURRENT_YEAR}-{str(CURRENT_YEAR+1)[-2:]}"


def _normalize(text: str) -> str:
    """Lowercase, strip extra whitespace, normalize Hindi shortcuts."""
    t = text.lower().strip()
    t = re.sub(r'\s+', ' ', t)
    # Common Hindi/Hinglish shortcuts
    t = t.replace('kitna', 'how much').replace('kitni', 'how many')
    t = t.replace('hua', 'today').replace('hai', 'is')
    t = t.replace('aaj', 'today').replace('kal', 'yesterday')
    t = t.replace('pichle', 'last').replace('mahine', 'month')
    t = t.replace('is month', 'this month').replace('is mahine', 'this month')
    t = t.replace('sabse', 'most').replace('zyada', 'more')
    t = t.replace('kam', 'low').replace('jyada', 'high')
    return t


def _extract_month(text: str) -> tuple:
    """
    Extract (month_number, year) from text.
    Supports: 'February', 'Feb', 'last month', 'this month', 'pichle mahine'
    Returns (None, None) if not found.
    """
    text_lower = text.lower()

    # Direct month names
    for name, num in MONTH_MAP.items():
        if name in text_lower:
            # Try to find a year near the month name
            year_match = re.search(r'\b(202[0-9])\b', text_lower)
            year = int(year_match.group(1)) if year_match else CURRENT_YEAR
            return num, year

    # 'last month' / 'pichle mahine'
    if any(p in text_lower for p in ['last month', 'pichle mahine', 'pichle month', 'previous month']):
        last = CURRENT_MONTH - 1
        year = CURRENT_YEAR
        if last < 1:
            last = 12
            year -= 1
        return last, year

    # 'this month' / 'is month'
    if any(p in text_lower for p in ['this month', 'is month', 'is mahine', 'current month']):
        return CURRENT_MONTH, CURRENT_YEAR

    return None, None


def _extract_class(text: str) -> str:
    """Extract class number like 'Class 8', 'class 10', '8th class'."""
    m = re.search(r'class\s*(\d+|[ivx]+)', text.lower())
    if m:
        return m.group(1)
    m = re.search(r'(\d+)(st|nd|rd|th)?\s*class', text.lower())
    if m:
        return m.group(1)
    return None


def classify_intent(message: str) -> dict:
    """
    Fast rule-based intent classification.
    Returns: {
        'intent': str,
        'params': dict,
        'confidence': float,  # 0-1, 1 = rule match
        'normalized': str,
    }
    """
    norm = _normalize(message)
    low  = message.lower()

    month, year  = _extract_month(message)
    class_filter = _extract_class(message)

    # ── DOCUMENT QA (must check before other intents) ──
    if any(p in low for p in ['pdf', 'document', 'upload', 'is file', 'ye file', 'is pdf', 'uploaded']):
        return _result(Intent.DOCUMENT_QA, {}, 0.9, norm)

    # ── LESSON PLAN (Teacher) ──
    if any(p in low for p in ['lesson plan', 'lesson banao', 'kya padhau', 'kya padhna', 'padhaun',
                                'aaj padhao', 'padhaao', 'syllabus', 'topic banao', 'padhana hai']):
        return _result(Intent.TEACHER_LESSON_PLAN, {'class': class_filter}, 0.95, norm)

    # ── PRACTICE QUESTIONS (Teacher) ──
    if any(p in low for p in ['practice question', 'mcq', 'quiz', 'questions banao', 'test paper',
                                'worksheet', 'practice ke liye', 'weak students ke liye question']):
        return _result(Intent.TEACHER_PRACTICE_QA, {'class': class_filter}, 0.92, norm)

    # ── FEE COLLECTION ──
    if any(p in low for p in ['fee collect', 'kitni fees aayi', 'fees aayi', 'collection hua',
                                'paise aaye', 'fees aaye', 'fee aaya', 'kitna collect',
                                'fee jama', 'kitna revenue', 'fees collect']):
        if any(p in low for p in ['transport', 'bus']):
            return _result(Intent.TRANSPORT_FEE, {'month': month, 'year': year}, 0.95, norm)
        if any(p in low for p in ['hostel']):
            return _result(Intent.HOSTEL_FEE, {'month': month, 'year': year}, 0.95, norm)
        return _result(Intent.FEE_COLLECTION, {'month': month, 'year': year}, 0.95, norm)

    # ── FEE OUTSTANDING / PENDING ──
    if any(p in low for p in ['outstanding', 'pending fee', 'baaki fee', 'due fee',
                                'nahi bhari', 'fee nahi di', 'unpaid', 'baki hai', 'dues']):
        if any(p in low for p in ['student', 'kaun', 'kaunse', 'list', 'naam']):
            return _result(Intent.FEE_PENDING_STUDENTS, {'month': month, 'year': year}, 0.9, norm)
        return _result(Intent.FEE_OUTSTANDING, {'month': month, 'year': year}, 0.92, norm)

    # ── FEE COMPARISON ──
    if any(p in low for p in ['compare', 'comparison', 'aur', 'vs', 'pichle se', 'difference',
                                'badha', 'ghata', 'increase', 'decrease']):
        if any(p in low for p in ['fee', 'collection', 'paise', 'revenue']):
            return _result(Intent.FEE_COMPARISON, {'month': month, 'year': year}, 0.88, norm)

    # ── LIBRARY FINES ──
    if any(p in low for p in ['library fine', 'book fine', 'fine outstanding', 'overdue fine',
                                'library outstanding', 'kitni fine']):
        return _result(Intent.LIBRARY_FINES, {}, 0.93, norm)

    # ── ATTENDANCE TODAY ──
    if any(p in low for p in ['aaj attendance', 'today attendance', 'aaj kitne student', 'aaj haaziri',
                                'attendance today', 'kitne aaye aaj', 'present today', 'absent today',
                                'aaj ka attendance', 'attendance hua']):
        return _result(Intent.ATTENDANCE_TODAY, {'class': class_filter}, 0.95, norm)

    # ── ATTENDANCE CLASSWISE / CLASSWISE ABSENTEE ──
    if any(p in low for p in ['classwise attendance', 'class attendance', 'kis class me', 'sabse jyada absent',
                                'sabse zyada absent', 'lowest attendance', 'attendance classwise', 'haaziri classwise']):
        return _result(Intent.ATTENDANCE_CLASSWISE, {}, 0.92, norm)

    # ── ATTENDANCE TREND ──
    if any(p in low for p in ['attendance trend', 'last week attendance', '7 days attendance', 'monthly attendance',
                                'pichle hafte', 'trend attendance', '6 month attendance', 'attendance pattern']):
        return _result(Intent.ATTENDANCE_TREND, {'month': month, 'year': year}, 0.88, norm)

    # ── LOW ATTENDANCE STUDENTS ──
    if any(p in low for p in ['low attendance student', 'kam attendance wale', 'poor attendance',
                                'attendance problem', 'frequent absent', 'zyada absent student']):
        return _result(Intent.LOW_ATTENDANCE_STUDENTS, {'class': class_filter}, 0.88, norm)

    # ── TOP STUDENTS ──
    if any(p in low for p in ['top student', 'best student', 'topper', 'highest marks', 'sabse acche student',
                                'rank 1', 'merit list', 'sabse zyada marks', 'brightest']):
        return _result(Intent.TOP_STUDENTS, {'class': class_filter}, 0.93, norm)

    # ── WEAK STUDENTS ──
    if any(p in low for p in ['weak student', 'fail student', 'low marks student', 'bacche fail',
                                'sabse kam marks', 'consistently weak', 'poor performance', 'failing student',
                                'nahi padhte', 'mehnat nahi karte']):
        return _result(Intent.WEAK_STUDENTS, {'class': class_filter}, 0.92, norm)

    # ── CLASS PERFORMANCE ──
    if any(p in low for p in ['class performance', 'class average', 'class marks', 'kaisi hai class',
                                'lowest class', 'worst class', 'class ka result', 'class ka average',
                                'class 8', 'class 9', 'class 10', 'pass percentage', 'pass rate']):
        return _result(Intent.CLASS_PERFORMANCE, {'class': class_filter}, 0.88, norm)

    # ── EXAM RESULTS ──
    if any(p in low for p in ['exam result', 'result kab aayega', 'result published', 'kitne pass',
                                'kitne fail', 'pass fail', 'result aaya', 'exam kaisa raha']):
        return _result(Intent.EXAM_RESULTS, {'class': class_filter}, 0.88, norm)

    # ── TRANSPORT ──
    if any(p in low for p in ['transport', 'bus', 'vehicle', 'kitne student bus', 'bus me kitne',
                                'transport student', 'driver', 'route']):
        return _result(Intent.TRANSPORT_SUMMARY, {}, 0.92, norm)

    # ── HOSTEL ──
    if any(p in low for p in ['hostel', 'hostel me kitne', 'hostel student', 'boarding', 'hostel occupancy',
                                'hostel bed', 'warden']):
        return _result(Intent.HOSTEL_SUMMARY, {}, 0.92, norm)

    # ── LIBRARY ──
    if any(p in low for p in ['library', 'book issue', 'kitni book', 'issued book', 'overdue book',
                                'library me', 'book return', 'library summary']):
        return _result(Intent.LIBRARY_SUMMARY, {}, 0.92, norm)

    # ── SCHOOL OVERVIEW ──
    if any(p in low for p in ['school me kitne', 'total student', 'school overview', 'school summary',
                                'overall', 'school stats', 'school ka overview', 'how many student',
                                'student count', 'kitne student hain']):
        return _result(Intent.SCHOOL_SUMMARY, {}, 0.85, norm)

    # ── No confident match → fallback to GENERAL (LLM will handle) ──
    return _result(Intent.GENERAL, {'month': month, 'year': year, 'class': class_filter}, 0.0, norm)


def _result(intent: str, params: dict, confidence: float, normalized: str) -> dict:
    # Clean None values from params
    clean_params = {k: v for k, v in params.items() if v is not None}
    return {
        'intent':     intent,
        'params':     clean_params,
        'confidence': confidence,
        'normalized': normalized,
    }
