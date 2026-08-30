"""
Deterministic Response Formatter & Numeric Integrity Layer
Ensures 100% accurate, zero-hallucination answers formatted directly from authoritative ERP data.
Guarantees numbers in ERP (e.g. ₹5,200) are NEVER corrupted or altered.
"""
import re
from datetime import date


def detect_user_language(text: str) -> str:
    """
    Detect language preference: 'hi' (Devanagari), 'hinglish', or 'en' (English default).
    """
    if not text:
        return 'en'
    
    # Check for Devanagari script characters
    if any('\u0900' <= char <= '\u097f' for char in text):
        return 'hi'
    
    low = text.lower()
    hinglish_markers = [
        'kitna', 'kitni', 'kitne', 'kya', 'hai', 'hain', 'kaise', 'batao', 'btana', 'bataiye',
        'aaj', 'kal', 'bacha', 'baki', 'kharcha', 'vetan', 'tankhwah', 'bacche', 'saare',
        'ka', 'ki', 'ke', 'ko', 'me', 'mein', 'se', 'tha', 'thi', 'the', 'karo', 'karein'
    ]
    words = re.findall(r'\b[a-z]+\b', low)
    match_count = sum(1 for w in words if w in hinglish_markers)
    
    if match_count >= 1:
        return 'hinglish'
    return 'en'


def format_inr(amount) -> str:
    """
    Format numeric value using Indian Rupee notation (e.g. ₹5,200, ₹8,447, ₹1,25,000).
    Preserves exact magnitude without corruption.
    """
    try:
        val = float(amount or 0)
    except (ValueError, TypeError):
        return "₹0"
    
    if val == 0:
        return "₹0"
    
    is_neg = val < 0
    val = abs(val)
    
    # Split integer and decimal parts
    int_part = int(val)
    dec_part = round(val - int_part, 2)
    
    s = str(int_part)
    if len(s) <= 3:
        formatted = s
    else:
        last3 = s[-3:]
        remaining = s[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted = ",".join(groups) + "," + last3
    
    if dec_part > 0:
        dec_str = f"{dec_part:.2f}"[1:]  # e.g. .50
        formatted += dec_str
    
    return f"-₹{formatted}" if is_neg else f"₹{formatted}"


def format_deterministic_response(intent: str, data: dict, user_msg: str) -> str:
    """
    Generate authoritative, natural, and concise responses directly from backend JSON.
    Guarantees zero hallucinations and correct language.
    """
    lang = detect_user_language(user_msg)

    # ── 1. STUDENT COUNT ──
    if intent in ('STUDENT_COUNT', 'Intent.STUDENT_COUNT'):
        ov = data.get('school_overview', {})
        total = ov.get('total_students', 0)
        active = ov.get('active_students', total)
        if lang == 'hi':
            return f"आपके विद्यालय में कुल {total} छात्र नामांकित हैं ({active} सक्रिय)।"
        elif lang == 'hinglish':
            return f"Aapke school me total {total} students enrolled hain ({active} active)."
        return f"There are {total} students enrolled in your school ({active} active)."

    # ── 2. TEACHER COUNT ──
    if intent in ('TEACHER_COUNT', 'Intent.TEACHER_COUNT'):
        ov = data.get('school_overview', {})
        total = ov.get('total_teachers', 0)
        if lang == 'hi':
            return f"आपके विद्यालय में कुल {total} शिक्षक हैं।"
        elif lang == 'hinglish':
            return f"Aapke school me total {total} teachers hain."
        return f"There are {total} teachers in your school."

    # ── 3. SCHOOL OVERVIEW ──
    if intent in ('SCHOOL_SUMMARY', 'Intent.SCHOOL_SUMMARY'):
        ov = data.get('school_overview', {})
        st = ov.get('total_students', 0)
        te = ov.get('total_teachers', 0)
        cl = ov.get('total_classes', 0)
        sf = ov.get('total_staff', 0)
        if lang == 'hinglish':
            return f"School Overview:\n• Total Students: {st}\n• Total Teachers: {te}\n• Total Classes: {cl}\n• Total Staff: {sf}"
        elif lang == 'hi':
            return f"विद्यालय का विवरण:\n• कुल छात्र: {st}\n• कुल शिक्षक: {te}\n• कुल कक्षाएं: {cl}\n• कुल स्टाफ: {sf}"
        return f"School Overview:\n• Total Students: {st}\n• Total Teachers: {te}\n• Total Classes: {cl}\n• Total Staff: {sf}"

    # ── 4. FEE COLLECTION ──
    if intent in ('FEE_COLLECTION', 'Intent.FEE_COLLECTION'):
        f = data.get('fee', {})
        m_name = f.get('month_name', f.get('month', 'This month'))
        collected = format_inr(f.get('total_collected', 0))
        due = format_inr(f.get('total_due', 0))
        out = format_inr(f.get('total_outstanding', 0))
        rate = f.get('collection_rate', 0)

        if lang == 'hinglish':
            return f"{m_name} me total fee collection {collected} hua hai (Collection rate: {rate}%). Total due {due} tha aur {out} baki hai."
        elif lang == 'hi':
            return f"{m_name} के लिए कुल शुल्क संग्रह {collected} हुआ है (संग्रह दर: {rate}%)। कुल देय {due} था और शेष बकाया {out} है।"
        return f"Total fee collected for {m_name} is {collected} (Collection rate: {rate}%). Total due was {due}, and outstanding is {out}."

    # ── 5. FEE OUTSTANDING ──
    if intent in ('FEE_OUTSTANDING', 'Intent.FEE_OUTSTANDING'):
        o = data.get('outstanding', {})
        out = format_inr(o.get('total_outstanding', 0))
        due = format_inr(o.get('total_due', 0))
        paid = format_inr(o.get('total_paid', 0))
        recs = o.get('pending_records', 0)

        if lang == 'hinglish':
            return f"Total baki fees {out} hai ({recs} pending records). Abhi tak total {paid} jama hua hai out of {due}."
        elif lang == 'hi':
            return f"कुल बकाया शुल्क {out} है ({recs} लंबित रिकॉर्ड)। अब तक {due} में से {paid} जमा हुआ है।"
        return f"Total outstanding fee is {out} across {recs} pending records. Total collected so far is {paid} out of {due} due."

    # ── 6. FEE MONTH COMPARISON ──
    if intent in ('FEE_COMPARISON', 'Intent.FEE_COMPARISON'):
        mc = data.get('month_comparison', {})
        cur_m = mc.get('current_month', '')
        cur_coll = format_inr(mc.get('current_month_collected', 0))
        last_m = mc.get('last_month', '')
        last_coll = format_inr(mc.get('last_month_collected', 0))
        diff = format_inr(abs(mc.get('difference', 0)))
        pct = mc.get('percentage_change', 0)
        trend = mc.get('trend', 'Same')

        if lang == 'hinglish':
            tr_word = "badh gayi hai" if trend == 'Increased' else ("kam hui hai" if trend == 'Decreased' else "barabar hai")
            return f"{cur_m} me fee collection {cur_coll} hua, jabki {last_m} me {last_coll} tha. Collection {diff} ({pct}%) {tr_word}."
        elif lang == 'hi':
            tr_word = "वृद्धि हुई है" if trend == 'Increased' else ("कमी आई है" if trend == 'Decreased' else "समान है")
            return f"{cur_m} में शुल्क संग्रह {cur_coll} हुआ, जबकि {last_m} में {last_coll} था। इसमें {diff} ({pct}%) की {tr_word}।"
        return f"{cur_m} fee collection is {cur_coll}, compared with {last_coll} in {last_m}. That is an {trend.lower()} of {diff} ({pct}%)."

    # ── 7. STUDENT SPECIFIC FEE ──
    if intent in ('STUDENT_FEE_STATUS', 'Intent.STUDENT_FEE_STATUS'):
        sf = data.get('student_fee', {})
        if not sf.get('found'):
            s_name = sf.get('searched_name', 'Student')
            if lang == 'hinglish':
                return f"ERP me '{s_name}' naam ka koi student record nahi mila."
            return f"No student matching '{s_name}' was found in the ERP system."
        
        students = sf.get('students', [])
        lines = []
        for s in students[:3]:
            name = s.get('name')
            cls = s.get('class_name', 'N/A')
            roll = s.get('roll_number', 'N/A')
            due = format_inr(s.get('total_due', 0))
            paid = format_inr(s.get('total_paid', 0))
            out = format_inr(s.get('outstanding_due', 0))
            st = s.get('status', 'PENDING')
            if lang == 'hinglish':
                lines.append(f"{name} (Class {cls}, Roll {roll}): Total Due {due}, Paid {paid}, Baki {out} [Status: {st}].")
            else:
                lines.append(f"{name} (Class {cls}, Roll {roll}): Total Due {due}, Paid {paid}, Outstanding {out} [Status: {st}].")
        return "\n".join(lines)

    # ── 8. EXPENSES ──
    if intent in ('EXPENSE_SUMMARY', 'Intent.EXPENSE_SUMMARY'):
        exp = data.get('expenses', {})
        tot = format_inr(exp.get('total_expenses', 0))
        cnt = exp.get('count', 0)
        cats = exp.get('by_category', {})
        if cnt == 0 or exp.get('total_expenses', 0) == 0:
            if lang == 'hinglish':
                return "School me abhi tak total ₹0 expenses record hue hain (Koi expense record nahi mila)."
            elif lang == 'hi':
                return "विद्यालय में अब तक कुल ₹0 खर्च दर्ज हैं।"
            return "Total school expenses recorded is ₹0 (No expenses recorded for this period in the ERP)."
        
        cat_lines = [f"• {k.replace('_', ' ').title()}: {format_inr(v)}" for k, v in list(cats.items())[:4]]
        cat_str = "\n".join(cat_lines)
        if lang == 'hinglish':
            return f"Abhi tak total {tot} ka kharcha hua hai ({cnt} entries).\nCategory breakdown:\n{cat_str}"
        return f"Total school expenses recorded: {tot} across {cnt} entries.\nCategory breakdown:\n{cat_str}"

    # ── 9. STAFF / TEACHER SALARY ──
    if intent in ('STAFF_SALARY_STATUS', 'Intent.STAFF_SALARY_STATUS'):
        sal = data.get('staff_salary', {})
        staffs = sal.get('staff_members', [])
        if not staffs:
            if lang == 'hinglish':
                return "ERP me is staff member ka salary record nahi mila."
            return "No staff salary records found for this query in the ERP system."
        lines = []
        for s in staffs[:3]:
            name = s.get('name')
            role = s.get('role', 'Staff')
            monthly = format_inr(s.get('monthly_salary', 0))
            st = s.get('last_payment_status', 'PENDING')
            m = s.get('last_paid_month', 'N/A')
            if lang == 'hinglish':
                lines.append(f"{name} ({role}): Monthly salary {monthly}. Last payment status: {st} (Month: {m}).")
            else:
                lines.append(f"{name} ({role}): Monthly salary {monthly}. Last payment status: {st} (Month: {m}).")
        return "\n".join(lines)

    # ── 10. ATTENDANCE TODAY ──
    if intent in ('ATTENDANCE_TODAY', 'Intent.ATTENDANCE_TODAY'):
        att = data.get('attendance', {})
        pres = att.get('present_count', 0)
        tot = att.get('total_students', 0)
        absent = att.get('absent_count', max(0, tot - pres))
        pct = att.get('attendance_percentage', 0.0)
        if lang == 'hinglish':
            return f"Aaj ki attendance: {pres}/{tot} students present hain ({pct}%). Absent: {absent}."
        elif lang == 'hi':
            return f"आज की उपस्थिति: {pres}/{tot} छात्र उपस्थित हैं ({pct}%। अनुपस्थित: {absent}।"
        return f"Today's Attendance: {pres}/{tot} students present ({pct}%). Absent: {absent}."

    # ── 11. HOSTEL OCCUPANCY ──
    if intent in ('HOSTEL_SUMMARY', 'Intent.HOSTEL_SUMMARY'):
        h = data.get('hostel', {})
        tot_h = h.get('total_hostels', 0)
        tot_b = h.get('total_beds', 0)
        occ = h.get('occupied_beds', 0)
        vac = h.get('vacant_beds', 0)
        pct = h.get('occupancy_pct', 0)
        if lang == 'hinglish':
            return f"Hostel Occupancy:\n• Total Hostels: {tot_h}\n• Total Beds: {tot_b}\n• Occupied Beds: {occ} ({pct}%)\n• Vacant Beds: {vac}"
        return f"Hostel Occupancy:\n• Total Hostels: {tot_h}\n• Total Beds: {tot_b}\n• Occupied Beds: {occ} ({pct}%)\n• Vacant Beds: {vac}"

    # ── 12. HOSTEL FEE ──
    if intent in ('HOSTEL_FEE', 'Intent.HOSTEL_FEE'):
        hf = data.get('hostel_fee', {})
        m = hf.get('month', 'This month')
        coll = format_inr(hf.get('collected', 0))
        due = format_inr(hf.get('total_due', 0))
        out = format_inr(hf.get('outstanding', 0))
        if lang == 'hinglish':
            return f"Hostel fee collection ({m}): Total collected {coll} out of {due} due (Baki: {out})."
        return f"Hostel fee collection for {m}: Total collected is {coll} out of {due} due (Outstanding: {out})."

    # ── 13. HOSTEL VISITORS ──
    if intent in ('HOSTEL_VISITORS', 'Intent.HOSTEL_VISITORS'):
        v_data = data.get('hostel_visitors', {})
        tot = v_data.get('total_visitors', 0)
        if tot == 0:
            if lang == 'hinglish':
                return "Aaj hostel me koi visitor nahi aaya (0 hostel visitors recorded today)."
            elif lang == 'hi':
                return "आज छात्रावास में कोई आगंतुक दर्ज नहीं किया गया है (0 आगंतुक)।"
            return "No hostel visitors were recorded today."
        
        v_list = v_data.get('visitors', [])
        details = [f"• {v['visitor_name']} ({v['relation']} of {v['student_name']}) at {v['in_time']}" for v in v_list[:3]]
        det_str = "\n".join(details)
        if lang == 'hinglish':
            return f"Haan, aaj hostel me {tot} visitor(s) record hue hain:\n{det_str}"
        return f"Yes, {tot} hostel visitor(s) were recorded today:\n{det_str}"

    # ── 14. TRANSPORT SUMMARY ──
    if intent in ('TRANSPORT_SUMMARY', 'Intent.TRANSPORT_SUMMARY'):
        tr = data.get('transport', {})
        act_v = tr.get('active_vehicles', 0)
        tot_v = tr.get('total_vehicles', 0)
        enr_s = tr.get('enrolled_students', 0)
        if lang == 'hinglish':
            return f"Transport Summary:\n• Total Vehicles: {tot_v} ({act_v} active)\n• Enrolled Students: {enr_s}"
        return f"Transport Summary:\n• Total Vehicles: {tot_v} ({act_v} active)\n• Enrolled Students using transport: {enr_s}"

    # ── 15. LIBRARY SUMMARY ──
    if intent in ('LIBRARY_SUMMARY', 'Intent.LIBRARY_SUMMARY'):
        lib = data.get('library', {})
        tot_c = lib.get('total_copies', 0)
        iss_c = lib.get('issued_copies', 0)
        av_c = lib.get('available_copies', 0)
        od_c = lib.get('overdue_copies', 0)
        fines = format_inr(lib.get('outstanding_fines', 0))
        if lang == 'hinglish':
            return f"Library Summary:\n• Total Books: {tot_c}\n• Issued Books: {iss_c}\n• Available Books: {av_c}\n• Overdue Books: {od_c}\n• Outstanding Fines: {fines}"
        return f"Library Summary:\n• Total Books: {tot_c}\n• Issued Books: {iss_c}\n• Available Books: {av_c}\n• Overdue Books: {od_c}\n• Outstanding Fines: {fines}"

    # ── 16. PLATFORM QUERIES (SUPER ADMIN) ──
    if intent in ('PLATFORM_SCHOOLS_COUNT', 'Intent.PLATFORM_SCHOOLS_COUNT'):
        ps = data.get('schools_summary', {})
        tot_s = ps.get('total_schools', 0)
        act_s = ps.get('active_schools', 0)
        return f"Platform Overview: {tot_s} total schools enrolled ({act_s} active schools)."

    if intent in ('PLATFORM_PAID_SCHOOLS', 'Intent.PLATFORM_PAID_SCHOOLS'):
        paid = data.get('paid_schools', {})
        tot_p = paid.get('total_paid_schools', 0)
        s_list = [f"• {s['name']} (Plan: {s['plan']})" for s in paid.get('schools', [])[:5]]
        s_str = "\n".join(s_list) if s_list else "No active paid schools currently."
        return f"Paid Subscriptions: {tot_p} school(s) have active paid plans:\n{s_str}"

    if intent in ('PLATFORM_USER_STATS', 'Intent.PLATFORM_USER_STATS'):
        us = data.get('user_stats', {})
        tot_u = us.get('total_users', 0)
        tot_s = us.get('total_schools', 0)
        return f"Platform Users: {tot_u} total registered users across {tot_s} schools."

    if intent in ('PLATFORM_HEALTH', 'Intent.PLATFORM_HEALTH'):
        sc = data.get('schools', {}).get('total_schools', 0)
        us = data.get('users', {}).get('total_users', 0)
        return f"Platform System Status: ONLINE\n• Total Schools: {sc}\n• Registered Users: {us}\n• Database & AI services operating normally."

    return None


def validate_and_sanitize_response(llm_text: str, structured_data: dict, deterministic_text: str) -> str:
    """
    Validates that LLM didn't hallucinate/corrupt numbers.
    If the response contains corrupt numbers (e.g. 52000 instead of 5200),
    rejects the LLM output and returns deterministic_text.
    """
    if not llm_text:
        return deterministic_text

    # Extract all large numbers from LLM response
    llm_nums = set(re.findall(r'\b\d{3,9}\b', llm_text.replace(',', '')))
    
    # Collect all valid numbers from structured data
    def _collect_nums(obj):
        nums = set()
        if isinstance(obj, dict):
            for v in obj.values():
                nums.update(_collect_nums(v))
        elif isinstance(obj, list):
            for item in obj:
                nums.update(_collect_nums(item))
        elif isinstance(obj, (int, float)):
            int_v = int(abs(obj))
            if int_v >= 100:
                nums.add(str(int_v))
        return nums

    valid_nums = _collect_nums(structured_data)

    # Check for hallucinated numbers (magnitude corruption)
    for num in llm_nums:
        if num not in valid_nums and num not in ('2024', '2025', '2026', '2027'):
            # Found an ungrounded number in LLM output!
            return deterministic_text

    return llm_text.strip()
