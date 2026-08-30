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
    STUDENT_FEE_STATUS   = 'STUDENT_FEE_STATUS'
    EXPENSE_SUMMARY      = 'EXPENSE_SUMMARY'
    STAFF_SALARY_STATUS  = 'STAFF_SALARY_STATUS'
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
    HOSTEL_VISITORS      = 'HOSTEL_VISITORS'
    LIBRARY_SUMMARY      = 'LIBRARY_SUMMARY'
    ASSIGNMENTS_SUMMARY  = 'ASSIGNMENTS_SUMMARY'


    # School Overview
    SCHOOL_SUMMARY       = 'SCHOOL_SUMMARY'
    STUDENT_COUNT        = 'STUDENT_COUNT'
    TEACHER_COUNT        = 'TEACHER_COUNT'

    # Teacher-specific
    TEACHER_LESSON_PLAN  = 'TEACHER_LESSON_PLAN'
    TEACHER_PRACTICE_QA  = 'TEACHER_PRACTICE_QA'
    TEACHER_CLASS_PERF   = 'TEACHER_CLASS_PERF'
    DOCUMENT_QA          = 'DOCUMENT_QA'

    # Super Admin / Platform
    PLATFORM_SCHOOLS_COUNT = 'PLATFORM_SCHOOLS_COUNT'
    PLATFORM_PAID_SCHOOLS  = 'PLATFORM_PAID_SCHOOLS'
    PLATFORM_USER_STATS    = 'PLATFORM_USER_STATS'
    PLATFORM_HEALTH        = 'PLATFORM_HEALTH'

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
    """Lowercase, strip punctuation/apostrophes, normalize Hindi shortcuts."""
    t = text.lower().strip()
    t = t.replace("’", "'").replace("'", "").replace("-", " ")
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
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


def _extract_person_name(text: str) -> str:
    """Extract person/student name from queries like 'Mudassir ka fees...', 'sana ki salary...'."""
    # Pattern: '<name> ka/ki/ke/ka fees/salary/attendance/marks'
    m = re.search(r'\b([a-zA-Z]{3,20})\s+(?:ka|ki|ke)\s+(?:fees?|salary|paid|due|baki|marks|attendance)\b', text, re.IGNORECASE)
    if m:
        candidate = m.group(1).strip()
        if candidate.lower() not in ['student', 'teacher', 'school', 'class', 'today', 'aaj', 'kal', 'month', 'total', 'abhi']:
            return candidate

    # Pattern: 'salary of <name>' or 'fees of <name>'
    m = re.search(r'\b(?:salary|fees?|dues?|record)\s+of\s+([a-zA-Z]{3,20})\b', text, re.IGNORECASE)
    if m:
        candidate = m.group(1).strip()
        if candidate.lower() not in ['student', 'teacher', 'school', 'class', 'today', 'aaj', 'month']:
            return candidate

    # Pattern: '<name> ki salary btana/batao'
    m = re.search(r'\b([a-zA-Z]{3,20})\s+(?:ki|ka)\s+salary\b', text, re.IGNORECASE)
    if m:
        candidate = m.group(1).strip()
        if candidate.lower() not in ['staff', 'teacher', 'employee', 'all']:
            return candidate

    return None


def classify_intent(message: str) -> dict:
    """
    Fast rule-based intent classification for both School & Platform Super Admin queries.
    """
    norm = _normalize(message)
    low  = message.lower().replace("’", "'").replace("'", "")

    month, year  = _extract_month(message)
    class_filter = _extract_class(message)
    person_name  = _extract_person_name(message)

    # ── 1. DOCUMENT QA (must check first) ──
    if any(p in low for p in ['pdf', 'document', 'upload', 'is file', 'ye file', 'is pdf', 'uploaded']):
        return _result(Intent.DOCUMENT_QA, {}, 0.9, norm)

    # ── 2. LESSON PLAN & PRACTICE QUESTIONS (Teacher) ──
    if any(p in low for p in ['lesson plan', 'lesson banao', 'kya padhau', 'kya padhna', 'padhaun',
                              'aaj padhao', 'padhaao', 'syllabus', 'topic banao', 'padhana hai']):
        return _result(Intent.TEACHER_LESSON_PLAN, {'class': class_filter}, 0.95, norm)

    if any(p in low for p in ['practice question', 'mcq', 'quiz', 'questions banao', 'test paper',
                              'worksheet', 'practice ke liye', 'weak students ke liye question']):
        return _result(Intent.TEACHER_PRACTICE_QA, {'class': class_filter}, 0.92, norm)

    # ── 3. SPECIFIC STUDENT / STAFF LOOKUPS ──
    if person_name and any(p in low for p in ['fee', 'fees', 'pay', 'bacha', 'due', 'baki', 'paid', 'kitna diya']):
        return _result(Intent.STUDENT_FEE_STATUS, {'student_name': person_name, 'month': month, 'year': year}, 0.96, norm)

    if person_name and any(p in low for p in ['salary', 'vetan', 'tankhwah', 'tanvaah', 'salaries']):
        return _result(Intent.STAFF_SALARY_STATUS, {'staff_name': person_name, 'month': month, 'year': year}, 0.95, norm)

    # ── 4. SUPER ADMIN PLATFORM QUERIES ──
    if any(p in low for p in [
        'how many schools', 'schools are enrolled', 'enrolled schools', 'total schools',
        'kitne school', 'total school', 'enrolled school', 'schools enroll', 'active school',
        'kitni school', 'schools count', 'all schools', 'saare school'
    ]):
        return _result(Intent.PLATFORM_SCHOOLS_COUNT, {}, 0.95, norm)

    if any(p in low for p in [
        'paid plan', 'paid subscription', 'paid school', 'paid service',
        'which schools have active paid', 'active paid subscriptions', 'active paid plans',
        'pay kiya', 'subscription', 'kis school ne pay', 'kaunse school ne pay',
        'service pay', 'enterprise school'
    ]):
        return _result(Intent.PLATFORM_PAID_SCHOOLS, {}, 0.95, norm)

    if any(p in low for p in [
        'active users', 'platform active users', 'users by role', 'total users',
        'kitne user', 'total user', 'user stats', 'users use kar rahe',
        'system users', 'all users'
    ]):
        return _result(Intent.PLATFORM_USER_STATS, {}, 0.95, norm)

    if any(p in low for p in [
        'system health', 'server status', 'error status', 'health status', 'system status'
    ]):
        return _result(Intent.PLATFORM_HEALTH, {}, 0.95, norm)

    # ── 5. HOSTEL DOMAIN (Check visitors, fee, occupancy, beds) ──
    if any(p in low for p in ['hostel', 'boarding', 'bed', 'beds', 'warden', 'hostels']):
        if any(p in low for p in ['visitor', 'mehman', 'guest', 'milne aaya', 'aaya tha', 'aaye the', 'who visited']):
            return _result(Intent.HOSTEL_VISITORS, {}, 0.96, norm)
        if any(p in low for p in ['fee', 'fees', 'collection', 'dues', 'fine', 'pending']):
            return _result(Intent.HOSTEL_FEE, {'month': month, 'year': year}, 0.95, norm)
        return _result(Intent.HOSTEL_SUMMARY, {}, 0.92, norm)


    if any(p in low for p in ['visitor arrive', 'hostel visitor', 'who visited the hostel', 'hostel me visitor']):
        return _result(Intent.HOSTEL_VISITORS, {}, 0.96, norm)

    # ── 6. TRANSPORT DOMAIN ──
    if any(p in low for p in ['transport', 'bus', 'vehicle', 'van', 'driver', 'route']):
        if any(p in low for p in ['fee', 'collection', 'paise']):
            return _result(Intent.TRANSPORT_FEE, {'month': month, 'year': year}, 0.95, norm)
        return _result(Intent.TRANSPORT_SUMMARY, {}, 0.92, norm)

    # ── 7. LIBRARY DOMAIN ──
    if any(p in low for p in ['library', 'book', 'books', 'kitab', 'kitabein']):
        if any(p in low for p in ['fine', 'fines', 'dues']):
            return _result(Intent.LIBRARY_FINES, {}, 0.95, norm)
        return _result(Intent.LIBRARY_SUMMARY, {}, 0.92, norm)

    # ── 8. FEE COMPARISON & EXPENSES & STAFF SALARY ──
    if any(p in low for p in ['compare', 'comparison', 'vs', 'pichle se', 'difference', 'badha', 'ghata', 'increase', 'decrease']):
        if any(p in low for p in ['fee', 'collection', 'paise', 'revenue', 'last month']):
            return _result(Intent.FEE_COMPARISON, {'month': month, 'year': year}, 0.95, norm)

    if any(p in low for p in [
        'expense', 'expenses', 'expensess', 'kharcha', 'kharch', 'total expenditure', 'kitna kharcha',
        'spending', 'kitna spend', 'kitna expense', 'school expenses', 'spent so far'
    ]):
        return _result(Intent.EXPENSE_SUMMARY, {'month': month, 'year': year}, 0.95, norm)

    if any(p in low for p in ['salary', 'vetan', 'tankhwah', 'tanvaah', 'salaries', 'teaching staff salary']):
        return _result(Intent.STAFF_SALARY_STATUS, {'staff_name': person_name, 'month': month, 'year': year}, 0.95, norm)

    # ── 9. FEE COLLECTION & OUTSTANDING ──
    if any(p in low for p in [
        'fee collect', 'how much fee was collected', 'fees collect', 'kitni fees aayi',
        'fees aayi', 'collection hua', 'paise aaye', 'fees aaye', 'fee aaya',
        'kitna collect', 'fee jama', 'kitna revenue', 'total collection', 'fee revenue',
        'total fees collection', 'fee status'
    ]):
        return _result(Intent.FEE_COLLECTION, {'month': month, 'year': year}, 0.95, norm)

    if any(p in low for p in [
        'outstanding', 'pending fee', 'baaki fee', 'due fee', 'total outstanding',
        'nahi bhari', 'fee nahi di', 'unpaid', 'baki hai', 'dues', 'unpaid fee',
        'kitni fees baki', 'pending balance'
    ]):
        if any(p in low for p in ['student', 'kaun', 'kaunse', 'list', 'naam']):
            return _result(Intent.FEE_PENDING_STUDENTS, {'month': month, 'year': year}, 0.9, norm)
        return _result(Intent.FEE_OUTSTANDING, {'month': month, 'year': year}, 0.92, norm)

    # ── 10. ATTENDANCE ──
    if any(p in low for p in [
        'today attendance', 'todays attendance', 'attendance status', 'aaj attendance',
        'aaj kitne student', 'aaj haaziri', 'attendance today', 'kitne aaye aaj',
        'present today', 'absent today', 'aaj ka attendance', 'attendance hua'
    ]):
        return _result(Intent.ATTENDANCE_TODAY, {'class': class_filter}, 0.95, norm)

    if any(p in low for p in [
        'class wise attendance', 'classwise attendance', 'class attendance', 'kis class me',
        'sabse jyada absent', 'sabse zyada absent', 'lowest attendance', 'attendance breakdown',
        'attendance classwise', 'haaziri classwise'
    ]):
        return _result(Intent.ATTENDANCE_CLASSWISE, {}, 0.92, norm)

    # ── 11. ACADEMIC & ASSIGNMENTS ──
    if any(p in low for p in ['top 10', 'top student', 'best student', 'topper', 'highest marks', 'academic students']):
        return _result(Intent.TOP_STUDENTS, {'class': class_filter}, 0.93, norm)

    if any(p in low for p in ['weak student', 'weak in academic', 'weak in academics', 'fail student', 'low marks student']):
        return _result(Intent.WEAK_STUDENTS, {'class': class_filter}, 0.92, norm)

    if any(p in low for p in ['assignment', 'homework', 'submission', 'assignments given']):
        return _result(Intent.ASSIGNMENTS_SUMMARY, {'class': class_filter}, 0.92, norm)

    # ── 12. TEACHER COUNT ──
    if any(p in low for p in [
        'how many teacher', 'how many teachers', 'total teacher', 'total teachers',
        'teacher count', 'teachers in my school', 'teachers in school', 'teaching staff',
        'kitne teacher', 'kitne teachers', 'total shikshak'
    ]):
        return _result(Intent.TEACHER_COUNT, {}, 0.95, norm)

    # ── 13. STUDENT COUNT ──
    if any(p in low for p in [
        'how many student', 'how many students', 'total student', 'total students',
        'student count', 'students in my school', 'students in school', 'students are in my school',
        'how many students do we have', 'how many students are enrolled', 'kitne student',
        'kitne students', 'kitne bacche', 'total bacche', 'students enrolled',
        'total number of students', 'number of students', 'student strength', 'baccho ki sankhya',
        'students count', 'student enrollment'
    ]):
        return _result(Intent.STUDENT_COUNT, {'class': class_filter}, 0.95, norm)

    # ── 14. SCHOOL OVERVIEW ──
    if any(p in low for p in [
        'school me kitne', 'school overview', 'school summary', 'overall', 'school stats',
        'school ka overview', 'total strength', 'school details'
    ]):
        return _result(Intent.SCHOOL_SUMMARY, {}, 0.9, norm)

    # ── Fallback to GENERAL ──
    return _result(Intent.GENERAL, {'month': month, 'year': year, 'class': class_filter}, 0.0, norm)





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
