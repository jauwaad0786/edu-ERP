from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
)
from reportlab.lib.enums import TA_CENTER
from xml.sax.saxutils import escape as _xml_escape
import io
import urllib.request, tempfile
from app.models.academic import Class

# ═══════════════════════════════════════════════════════════════════════════
#  BRAND PALETTE — premium blue theme
# ═══════════════════════════════════════════════════════════════════════════

PRIMARY      = colors.HexColor('#1D4ED8')   # main blue
PRIMARY_DARK = colors.HexColor('#0B1F4E')   # deep navy for headings
PRIMARY_SOFT = colors.HexColor('#EFF6FF')   # light blue background
ACCENT       = colors.HexColor('#F59E0B')   # amber accent
SUCCESS      = colors.HexColor('#16A34A')
SUCCESS_BG   = colors.HexColor('#F0FDF4')
DANGER       = colors.HexColor('#DC2626')
DANGER_BG    = colors.HexColor('#FEF2F2')
WARNING      = colors.HexColor('#D97706')
WARNING_BG   = colors.HexColor('#FFFBEB')
GREY_LINE    = colors.HexColor('#E2E8F0')
GREY_TEXT    = colors.HexColor('#64748B')
ZEBRA        = colors.HexColor('#F8FAFC')

# backward-compat aliases (agar kahin aur old names use ho rahe hon)
SCHOOL_BLUE = PRIMARY
DARK_BLUE   = PRIMARY_DARK

COMPANY_TAGLINE = 'Powered by OnePlatform360'


def _esc(text):
    """Names/addresses mein '&', '<' jaisa special char aaye to PDF crash na ho."""
    return _xml_escape(str(text or ''))


def _get_grade(percentage):
    pct = float(percentage or 0)
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B+'
    if pct >= 60: return 'B'
    if pct >= 50: return 'C'
    if pct >= 33: return 'D'
    return 'F'


# ═══════════════════════════════════════════════════════════════════════════
#  SHARED — Letterhead (logo + school name from backend) + Footer branding
# ═══════════════════════════════════════════════════════════════════════════

def _fetch_remote_image(url, width, height):
    if not url:
        return None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
            urllib.request.urlretrieve(url, tmp.name)
            return RLImage(tmp.name, width=width, height=height)
    except Exception:
        return None


def _accent_stripe():
    """Thin multi-tone stripe — brand signature bar at top of every document."""
    tones = [PRIMARY_DARK, PRIMARY, colors.HexColor('#3B82F6'), ACCENT, colors.HexColor('#FBBF24')]
    row = [['' for _ in tones]]
    t = Table(row, colWidths=[3.4 * cm] * len(tones), rowHeights=[0.18 * cm])
    style = [('BACKGROUND', (i, 0), (i, 0), tones[i]) for i in range(len(tones))]
    style += [
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]
    t.setStyle(TableStyle(style))
    return t


def _letterhead(school, doc_title, doc_subtitle=''):
    """
    School logo + name backend (school.logo_url / school.name) se automatic aata hai.
    Returns: [accent stripe, logo+name band, colored title badge, subtitle].
    """
    elements = [_accent_stripe(), Spacer(1, 0.35 * cm)]

    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.1 * cm, 2.1 * cm)

    name_style = ParagraphStyle('sn', fontSize=17, textColor=PRIMARY_DARK,
                                 fontName='Helvetica-Bold', leading=20)
    addr_style = ParagraphStyle('sa', fontSize=9, textColor=GREY_TEXT, fontName='Helvetica', leading=12)

    school_name = _esc(school.name.upper()) if school and school.name else 'SCHOOL NAME'
    name_para = Paragraph(school_name, name_style)

    addr_bits = []
    if school:
        if school.address: addr_bits.append(_esc(school.address))
        if school.city:    addr_bits.append(_esc(school.city))
        if school.phone:   addr_bits.append(f'Ph: {_esc(school.phone)}')
        if school.email:   addr_bits.append(_esc(school.email))
    addr_para = Paragraph(' | '.join(addr_bits), addr_style)

    name_block = [name_para, Spacer(1, 0.08 * cm), addr_para]

    if logo_img:
        header_table = Table([[logo_img, name_block]], colWidths=[2.6 * cm, 15.1 * cm])
    else:
        header_table = Table([[name_block]], colWidths=[17.7 * cm])

    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.3 * cm))

    title_style = ParagraphStyle('dt', fontSize=13, textColor=colors.white,
                                  fontName='Helvetica-Bold', alignment=TA_CENTER)
    badge = Table([[Paragraph(doc_title, title_style)]], colWidths=[17.7 * cm])
    badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(badge)

    if doc_subtitle:
        sub_style = ParagraphStyle('dsub', fontSize=10, textColor=PRIMARY,
                                    fontName='Helvetica-Bold', alignment=TA_CENTER)
        elements.append(Spacer(1, 0.15 * cm))
        elements.append(Paragraph(doc_subtitle, sub_style))

    elements.append(Spacer(1, 0.35 * cm))
    return elements


def _footer(canvas_obj, doc):
    """Har page ke bottom pe automatically render hota hai — koi extra call nahi chahiye."""
    canvas_obj.saveState()
    canvas_obj.setStrokeColor(GREY_LINE)
    canvas_obj.setLineWidth(0.6)
    canvas_obj.line(1.5 * cm, 1.5 * cm, A4[0] - 1.5 * cm, 1.5 * cm)
    canvas_obj.setFont('Helvetica-Bold', 8)
    canvas_obj.setFillColor(PRIMARY)
    canvas_obj.drawCentredString(A4[0] / 2, 1.05 * cm, 'OnePlatform360')
    canvas_obj.setFont('Helvetica', 7)
    canvas_obj.setFillColor(GREY_TEXT)
    canvas_obj.drawCentredString(A4[0] / 2, 0.72 * cm, 'Powered by OnePlatform360 — Complete School ERP Suite')
    canvas_obj.restoreState()


# ═══════════════════════════════════════════════════════════════════════════
#  ADMIT CARD (SINGLE & BULK)
# ═══════════════════════════════════════════════════════════════════════════

def _build_admit_card_elements(student, school, exam, timetable_items):
    elements = _letterhead(school, 'ADMIT CARD', f'{_esc(exam.exam_name)}  |  Session: {_esc(exam.session)}')

    label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
    value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica', textColor=colors.HexColor('#0F172A'))

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.8 * cm, 3.2 * cm)
    if not photo_img:
        photo_img = Table(
            [[Paragraph('PHOTO', ParagraphStyle('ph', fontSize=8, alignment=TA_CENTER, textColor=GREY_TEXT))]],
            colWidths=[2.8 * cm], rowHeights=[3.2 * cm])
        photo_img.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_SOFT),
        ]))

    cls = Class.query.get(student.class_id) if student.class_id else None
    info_rows = [
        [Paragraph('Student Name', label_style), Paragraph(_esc(student.user.name if student.user else ''), value_style),
         Paragraph('Roll No', label_style), Paragraph(_esc(student.roll_number or 'N/A'), value_style)],
        [Paragraph('Admission No', label_style), Paragraph(_esc(student.admission_no or ''), value_style),
         Paragraph('Class', label_style), Paragraph(_esc(cls.name if cls else ''), value_style)],
        [Paragraph('Father Name', label_style),
         Paragraph(_esc(getattr(student, 'father_name', None) or student.parent_name or ''), value_style),
         Paragraph('Mother Name', label_style), Paragraph(_esc(getattr(student, 'mother_name', None) or ''), value_style)],
        [Paragraph('Session', label_style), Paragraph(_esc(exam.session), value_style),
         Paragraph('Gender', label_style), Paragraph(_esc(student.gender or ''), value_style)],
    ]
    info_table = Table(info_rows, colWidths=[3 * cm, 5.2 * cm, 2.6 * cm, 4.5 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
    ]))

    combined = Table([[info_table, photo_img]], colWidths=[15.3 * cm, 3 * cm])
    combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (1, 0), (1, 0), 10)]))
    elements.append(combined)
    elements.append(Spacer(1, 0.45 * cm))

    elements.append(Paragraph('EXAMINATION TIMETABLE', ParagraphStyle(
        'tt', fontSize=11, textColor=PRIMARY_DARK, fontName='Helvetica-Bold', spaceAfter=6)))

    tt_data = [['#', 'Subject', 'Date', 'Time', 'Venue', 'Max Marks']]
    for i, item in enumerate(timetable_items, 1):
        tt_data.append([
            str(i), _esc(item.subject.name if item.subject else ''), str(item.exam_date),
            f"{item.start_time} - {item.end_time}", _esc(item.venue or getattr(item, 'room', None) or 'Main Hall'), str(item.max_marks)
        ])

    tt_table = Table(tt_data, colWidths=[0.9 * cm, 5 * cm, 2.6 * cm, 4 * cm, 3 * cm, 2 * cm])
    tt_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ZEBRA]),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]))
    elements.append(tt_table)
    elements.append(Spacer(1, 1.2 * cm))

    sig_table = Table([[Paragraph(
        "_____________________<br/><b>Principal's Signature</b>",
        ParagraphStyle('sig', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER))]],
        colWidths=[6 * cm])
    wrap = Table([[sig_table]], colWidths=[17.7 * cm])
    wrap.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT')]))
    elements.append(wrap)
    return elements


def generate_admit_card(student, school, exam, timetable_items):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)
    elements = _build_admit_card_elements(student, school, exam, timetable_items)
    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


def generate_bulk_admit_cards(student_timetable_pairs, school, exam):
    """Generate multi-page admit cards in one PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)
    all_elements = []
    for i, (student, timetable) in enumerate(student_timetable_pairs):
        elems = _build_admit_card_elements(student, school, exam, timetable)
        all_elements.extend(elems)
        if i < len(student_timetable_pairs) - 1:
            all_elements.append(PageBreak())
    if not all_elements:
        all_elements = [Paragraph('No students found for admit cards.', ParagraphStyle('none', fontSize=12))]
    doc.build(all_elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  RESULT CARD (SINGLE & BULK)
# ═══════════════════════════════════════════════════════════════════════════

def _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=None, version_number=1):
    elements = _letterhead(school, 'PROGRESS REPORT / RESULT CARD',
                            f'{_esc(exam.exam_name)}  |  Session: {_esc(exam.session)}')

    label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
    value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica')

    cls = Class.query.get(student.class_id) if student.class_id else None
    info_rows = [
        [Paragraph('Student Name', label_style),
         Paragraph(_esc(student.user.name if student.user else ''), value_style),
         Paragraph('Roll No', label_style),
         Paragraph(_esc(student.roll_number or 'N/A'), value_style)],
        [Paragraph('Admission No', label_style),
         Paragraph(_esc(student.admission_no or ''), value_style),
         Paragraph('Class / Section', label_style),
         Paragraph(_esc((cls.name + (' - ' + cls.section if cls and cls.section else '')) if cls else ''), value_style)],
        [Paragraph('Father / Guardian', label_style),
         Paragraph(_esc(student.parent_name or getattr(student, 'father_name', '') or ''), value_style),
         Paragraph('Session', label_style),
         Paragraph(_esc(exam.session), value_style)],
        [Paragraph('Exam Type', label_style),
         Paragraph(_esc(exam.exam_type or 'Annual'), value_style),
         Paragraph('Exam Name', label_style),
         Paragraph(_esc(exam.exam_name), value_style)],
    ]
    info_table = Table(info_rows, colWidths=[3.2 * cm, 5.6 * cm, 2.6 * cm, 5.6 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
        ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5 * cm))

    # ─── Table layout: simple or cumulative ───────────────────────────────────
    is_final = (exam.exam_type or '').upper() in ('FINAL', 'ANNUAL', 'FINAL_TERM', 'PRE_BOARD')
    has_prev = bool(prev_marks_data) and is_final

    if has_prev:
        prev_map = {m['subject_name']: m for m in prev_marks_data}
        header = ['Subject', 'Mid-Term\nMax', 'Mid-Term\nObt.', 'Final\nMax', 'Final\nObt.',
                  'Grand\nMax', 'Grand\nObt.', 'Total\n%', 'Grade', 'Result']
        col_widths = [3.8*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.5*cm, 1.4*cm, 1.2*cm, 1.5*cm]
    else:
        header = ['Subject', 'Max Marks', 'Obtained', 'Percentage', 'Grade', 'Result']
        col_widths = [5*cm, 2.4*cm, 2.6*cm, 2.4*cm, 1.8*cm, 2.8*cm]

    marks_rows = [header]
    total_max = total_obtained = prev_total_max = prev_total_obt = 0

    for m in marks_data:
        pct = round((m['marks_obtained'] / m['max_marks'] * 100), 1) if m['max_marks'] else 0
        status = 'PASS' if m['marks_obtained'] >= (m['max_marks'] * 0.33) else 'FAIL'
        if has_prev:
            pm = prev_map.get(m['subject_name'], {})
            p_max = float(pm.get('max_marks', 0))
            p_obt = float(pm.get('marks_obtained', 0))
            t_max = m['max_marks'] + p_max
            t_obt = m['marks_obtained'] + p_obt
            t_pct = round((t_obt / t_max * 100), 1) if t_max else 0
            t_status = 'PASS' if t_pct >= 33 else 'FAIL'
            marks_rows.append([
                _esc(m['subject_name']),
                str(int(p_max)), str(int(p_obt)),
                str(int(m['max_marks'])), str(int(m['marks_obtained'])),
                str(int(t_max)), str(int(t_obt)),
                f"{t_pct}%", m.get('grade', _get_grade(t_pct)), t_status
            ])
            total_max += m['max_marks']
            total_obtained += m['marks_obtained']
            prev_total_max += p_max
            prev_total_obt += p_obt
        else:
            marks_rows.append([
                _esc(m['subject_name']), str(m['max_marks']), str(m['marks_obtained']),
                f"{pct}%", m.get('grade', _get_grade(pct)), status
            ])
            total_max += m['max_marks']
            total_obtained += m['marks_obtained']

    overall_pct = round(total_obtained / total_max * 100, 1) if total_max else 0
    overall_result = 'PASS' if overall_pct >= 33 else 'FAIL'

    if has_prev:
        grand_max = total_max + prev_total_max
        grand_obt = total_obtained + prev_total_obt
        grand_pct = round(grand_obt / grand_max * 100, 1) if grand_max else 0
        grand_result = 'PASS' if grand_pct >= 33 else 'FAIL'
        marks_rows.append([
            'TOTAL',
            str(int(prev_total_max)), str(int(prev_total_obt)),
            str(int(total_max)), str(int(total_obtained)),
            str(int(grand_max)), str(int(grand_obt)),
            f"{grand_pct}%", _get_grade(grand_pct), grand_result
        ])
        overall_pct = grand_pct
        overall_result = grand_result
    else:
        marks_rows.append(['TOTAL', str(total_max), str(total_obtained), f"{overall_pct}%",
                            _get_grade(overall_pct), overall_result])

    pass_col = len(header) - 1
    marks_table = Table(marks_rows, colWidths=col_widths)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), PRIMARY_SOFT),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ZEBRA]),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]
    for idx, row in enumerate(marks_rows[1:], start=1):
        color = SUCCESS if row[pass_col] == 'PASS' else DANGER
        style_cmds.append(('TEXTCOLOR', (pass_col, idx), (pass_col, idx), color))
        style_cmds.append(('FONTNAME', (pass_col, idx), (pass_col, idx), 'Helvetica-Bold'))
    marks_table.setStyle(TableStyle(style_cmds))
    elements.append(marks_table)
    elements.append(Spacer(1, 0.55 * cm))

    # ─── Overall Result Badge ─────────────────────────────────────────────────
    result_color = SUCCESS if overall_result == 'PASS' else DANGER
    result_bg = SUCCESS_BG if overall_result == 'PASS' else DANGER_BG
    result_badge = Table([[Paragraph(
        f'Overall Result: <b>{overall_result}</b>  |  Percentage: <b>{overall_pct}%</b>  |  Grade: <b>{_get_grade(overall_pct)}</b>',
        ParagraphStyle('res', fontSize=12, textColor=result_color, fontName='Helvetica-Bold', alignment=TA_CENTER)
    )]], colWidths=[17.4 * cm])
    result_badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), result_bg), ('BOX', (0, 0), (-1, -1), 1.5, result_color),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    elements.append(result_badge)
    elements.append(Spacer(1, 0.5 * cm))

    # ─── Grade Legend ─────────────────────────────────────────────────────────
    elements.append(Paragraph(
        'Grade Scale:  A+ (>=90%)  |  A (>=80%)  |  B+ (>=70%)  |  B (>=60%)  |  C (>=50%)  |  D (>=33%)  |  F (<33%)',
        ParagraphStyle('gl', fontSize=7.5, textColor=GREY_TEXT, alignment=TA_CENTER)
    ))
    elements.append(Spacer(1, 0.9 * cm))

    # ─── Signature + Stamp Block ──────────────────────────────────────────────
    stamp_box = Table(
        [[Paragraph('OFFICIAL\nSTAMP', ParagraphStyle('stmp', fontSize=7.5, fontName='Helvetica',
                                                       textColor=GREY_TEXT, alignment=TA_CENTER))]],
        colWidths=[3.5 * cm], rowHeights=[2.8 * cm]
    )
    stamp_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_SOFT),
    ]))
    sig_data = [[
        Paragraph("___________________________<br/><b>Class Teacher's Signature</b>",
                  ParagraphStyle('s1', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER)),
        stamp_box,
        Paragraph("___________________________<br/><b>Principal's Signature</b>",
                  ParagraphStyle('s3', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER)),
    ]]
    sig_table = Table(sig_data, colWidths=[6.2 * cm, 4.5 * cm, 6.5 * cm])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph(
        f'* Computer generated document (Version {version_number}). Valid only with official stamp and authorized signature.',
        ParagraphStyle('disc', fontSize=7, textColor=GREY_TEXT, alignment=TA_CENTER)
    ))
    return elements


def generate_result_card(student, school, exam, marks_data, prev_marks_data=None, version_number=1):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)
    elements = _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=prev_marks_data, version_number=version_number)
    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


def generate_bulk_result_cards(student_marks_tuples, school, exam, version_number=1):
    """
    Generate multiple result cards combined in a single PDF.
    student_marks_tuples: list of (student, marks_data, prev_marks_data)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)
    all_elements = []
    for i, item in enumerate(student_marks_tuples):
        student = item[0]
        marks_data = item[1]
        prev_marks_data = item[2] if len(item) > 2 else None
        elems = _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=prev_marks_data, version_number=version_number)
        all_elements.extend(elems)
        if i < len(student_marks_tuples) - 1:
            all_elements.append(PageBreak())
    if not all_elements:
        all_elements = [Paragraph('No student results available to print.', ParagraphStyle('none', fontSize=12))]
    doc.build(all_elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer

def generate_admission_card(student, school):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)

    elements = _letterhead(school, 'ADMISSION REGISTRATION CARD')

    label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
    value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica')

    cls = Class.query.get(student.class_id) if student.class_id else None
    info = [
        ('Admission No.', student.admission_no or 'N/A'),
        ('Student Name', student.user.name if student.user else ''),
        ('Father / Guardian', student.parent_name or ''),
        ('Mobile No.', student.parent_phone or ''),
        ('Class / Section', f"{cls.name} — {cls.section}" if cls else ''),
        ('Roll Number', student.roll_number or ''),
        ('Gender', student.gender or ''),
        ('Session', student.session or ''),
        ('Date of Admission', student.created_at.strftime('%d-%m-%Y')
         if hasattr(student, 'created_at') and student.created_at else ''),
    ]
    info_rows = [[Paragraph(l, label_style), Paragraph(_esc(v), value_style)] for l, v in info]
    info_table = Table(info_rows, colWidths=[4.7 * cm, 9.3 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
    ]))

    photo_box = Table(
        [[Paragraph('PHOTO', ParagraphStyle('ph', fontSize=9, alignment=TA_CENTER, textColor=GREY_TEXT))]],
        colWidths=[3 * cm], rowHeights=[3.5 * cm])
    photo_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, GREY_LINE), ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_SOFT),
    ]))

    combined = Table([[info_table, photo_box]], colWidths=[14 * cm, 3.7 * cm])
    combined.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (1, 0), (1, 0), 10)]))
    elements.append(combined)
    elements.append(Spacer(1, 0.6 * cm))

    elements.append(Paragraph('IMPORTANT INSTRUCTIONS', ParagraphStyle(
        'inst', fontSize=10, fontName='Helvetica-Bold', textColor=PRIMARY_DARK, spaceAfter=6)))

    inst_lines = [
        '1. Ye card school premises mein hamesha saath rakhein.',
        '2. Fee har mahine 10 tarikh tak jama karein.',
        '3. Koi bhi changes ke liye school office se sampark karein.',
        '4. Is card ko kho jane par turant principal ko soochit karein.',
    ]
    inst_para = Paragraph('<br/>'.join(inst_lines), ParagraphStyle(
        'il', fontSize=8.5, fontName='Helvetica', textColor=colors.HexColor('#334155'), leading=15))
    inst_box = Table([[inst_para]], colWidths=[17.7 * cm])
    inst_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), WARNING_BG), ('BOX', (0, 0), (-1, -1), 1, WARNING),
        ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(inst_box)
    elements.append(Spacer(1, 1.3 * cm))

    sig_data = [[
        Paragraph("_____________________<br/>Parent's Signature",
                  ParagraphStyle('s1', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER)),
        Paragraph("_____________________<br/>Class Teacher's Signature",
                  ParagraphStyle('s2', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER)),
        Paragraph("_____________________<br/>Principal's Signature",
                  ParagraphStyle('s3', fontSize=8.5, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER)),
    ]]
    sig_table = Table(sig_data, colWidths=[5.9 * cm, 5.9 * cm, 5.9 * cm])
    sig_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'BOTTOM')]))
    elements.append(sig_table)

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  FEE RECEIPT
# ═══════════════════════════════════════════════════════════════════════════

def generate_fee_receipt_pdf(student, school, transactions, receipt_no):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)

    elements = _letterhead(school, 'FEE RECEIPT')

    receipt_badge = Table([[Paragraph(f'Receipt No: {_esc(receipt_no)}', ParagraphStyle(
        'rn', fontSize=11, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER
    ))]], colWidths=[8 * cm])
    receipt_badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), ACCENT),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    centered = Table([[receipt_badge]], colWidths=[17.7 * cm])
    centered.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    elements.append(centered)
    elements.append(Spacer(1, 0.5 * cm))

    label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
    value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica')

    cls = Class.query.get(student.class_id) if student.class_id else None
    first_txn = transactions[0]
    info_rows = [
        [Paragraph('Student Name', label_style), Paragraph(_esc(student.user.name if student.user else ''), value_style),
         Paragraph('Admission No', label_style), Paragraph(_esc(student.admission_no or ''), value_style)],
        [Paragraph('Class', label_style), Paragraph(_esc(f"{cls.name} - {cls.section}" if cls else ''), value_style),
         Paragraph('Roll No', label_style), Paragraph(_esc(student.roll_number or ''), value_style)],
        [Paragraph('Parent Name', label_style), Paragraph(_esc(student.parent_name or ''), value_style),
         Paragraph('Payment Date', label_style), Paragraph(str(first_txn.transaction_date), value_style)],
        [Paragraph('Payment Mode', label_style), Paragraph(_esc(first_txn.payment_mode or ''), value_style),
         Paragraph('Collected By', label_style), Paragraph('Admin', value_style)],
    ]
    info_table = Table(info_rows, colWidths=[3.2 * cm, 5.8 * cm, 3 * cm, 4 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
        ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.55 * cm))

    elements.append(Paragraph('PAYMENT BREAKDOWN', ParagraphStyle(
        'pb', fontSize=11, textColor=PRIMARY_DARK, fontName='Helvetica-Bold', spaceAfter=6)))

    breakdown_rows = [['#', 'Fee Type', 'Month', 'Amount Paid (Rs.)']]
    total = 0
    for i, txn in enumerate(transactions, 1):
        rec = txn.fee_record
        breakdown_rows.append([str(i), _esc(rec.fee_type if rec else 'FEE'), _esc(rec.month if rec else ''),
                                f'{txn.amount:,.2f}'])
        total += txn.amount
    breakdown_rows.append(['', '', 'TOTAL PAID', f'{total:,.2f}'])

    breakdown_table = Table(breakdown_rows, colWidths=[1 * cm, 6 * cm, 5 * cm, 4 * cm])
    breakdown_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), SUCCESS_BG),
        ('TEXTCOLOR', (2, -1), (-1, -1), SUCCESS),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, ZEBRA]),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]))
    elements.append(breakdown_table)
    elements.append(Spacer(1, 1 * cm))

    paid_stamp = Table([[Paragraph('✓ PAYMENT RECEIVED', ParagraphStyle(
        'paid', fontSize=13, textColor=SUCCESS, fontName='Helvetica-Bold', alignment=TA_CENTER
    ))]], colWidths=[8 * cm])
    paid_stamp.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, SUCCESS), ('BACKGROUND', (0, 0), (-1, -1), SUCCESS_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    centered2 = Table([[paid_stamp]], colWidths=[17.7 * cm])
    centered2.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    elements.append(centered2)
    elements.append(Spacer(1, 0.4 * cm))

    # NEW — hostel-source payments ke liye warden signature line (physical sign ke liye),
    # baaki fee types ke liye purani computer-generated note hi rahegi
    is_hostel_payment = any(
        getattr(txn.fee_record, 'source', None) == 'HOSTEL' for txn in transactions if txn.fee_record
    )

    if is_hostel_payment:
        elements.append(Spacer(1, 1 * cm))
        sig_table = Table([[Paragraph(
            "_____________________<br/><b>Warden's Signature</b>",
            ParagraphStyle('sig', fontSize=9, fontName='Helvetica', textColor=GREY_TEXT, alignment=TA_CENTER))]],
            colWidths=[6 * cm])
        wrap = Table([[sig_table]], colWidths=[17.7 * cm])
        wrap.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT')]))
        elements.append(wrap)
    else:
        elements.append(Paragraph(
            'This is a computer-generated receipt and does not require a physical signature.',
            ParagraphStyle('foot', fontSize=8, fontName='Helvetica-Oblique', textColor=GREY_TEXT, alignment=TA_CENTER)))

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  MONTHLY NOTICE (consolidated — sab fee types + attendance ek PDF mein)
# ═══════════════════════════════════════════════════════════════════════════

def generate_student_notice_pdf(student, school, fee_records, attendance_summary, month):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)

    elements = _letterhead(school, f'MONTHLY NOTICE — {_esc(month)}')

    label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
    value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica')

    cls = Class.query.get(student.class_id) if student.class_id else None
    info_rows = [
        [Paragraph('Student Name', label_style), Paragraph(_esc(student.user.name if student.user else ''), value_style),
         Paragraph('Admission No', label_style), Paragraph(_esc(student.admission_no or ''), value_style)],
        [Paragraph('Class', label_style), Paragraph(_esc(f"{cls.name} - {cls.section}" if cls else ''), value_style),
         Paragraph('Parent Name', label_style), Paragraph(_esc(student.parent_name or ''), value_style)],
    ]
    info_table = Table(info_rows, colWidths=[3.2 * cm, 5.8 * cm, 3 * cm, 4 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
        ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.55 * cm))

    elements.append(Paragraph('FEE DUES — ALL TYPES', ParagraphStyle(
        'fd', fontSize=11, textColor=PRIMARY_DARK, fontName='Helvetica-Bold', spaceAfter=6)))

    status_color = {
        'PAID': (SUCCESS, SUCCESS_BG), 'PARTIAL': (WARNING, WARNING_BG),
        'OVERDUE': (DANGER, DANGER_BG), 'PENDING': (PRIMARY, PRIMARY_SOFT),
    }
    fee_rows = [['Fee Type', 'Due (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)', 'Status']]
    total_due = total_paid = 0
    for r in fee_records:
        balance = (r.amount_due or 0) - (r.amount_paid or 0)
        fee_rows.append([_esc(r.fee_type or ''), f'{r.amount_due:,.0f}', f'{r.amount_paid:,.0f}',
                          f'{balance:,.0f}', r.status])
        total_due += r.amount_due or 0
        total_paid += r.amount_paid or 0
    if not fee_records:
        fee_rows.append(['No pending dues this month', '', '', '', ''])

    fee_table = Table(fee_rows, colWidths=[5 * cm, 3 * cm, 3 * cm, 3 * cm, 3.7 * cm])
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ZEBRA]),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]
    for idx, row in enumerate(fee_rows[1:], start=1):
        if row[-1] in status_color:
            fg, bg = status_color[row[-1]]
            style_cmds.append(('TEXTCOLOR', (4, idx), (4, idx), fg))
            style_cmds.append(('FONTNAME', (4, idx), (4, idx), 'Helvetica-Bold'))
    fee_table.setStyle(TableStyle(style_cmds))
    elements.append(fee_table)
    elements.append(Spacer(1, 0.4 * cm))

    total_pending = total_due - total_paid
    pend_color = DANGER if total_pending > 0 else SUCCESS
    pend_bg = DANGER_BG if total_pending > 0 else SUCCESS_BG
    pend_badge = Table([[Paragraph(f'Total Pending: Rs. {total_pending:,.2f}', ParagraphStyle(
        'tot', fontSize=12, fontName='Helvetica-Bold', textColor=pend_color, alignment=TA_CENTER
    ))]], colWidths=[17.7 * cm])
    pend_badge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), pend_bg), ('BOX', (0, 0), (-1, -1), 1, pend_color),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(pend_badge)
    elements.append(Spacer(1, 0.7 * cm))

    elements.append(Paragraph('ATTENDANCE SUMMARY', ParagraphStyle(
        'as', fontSize=11, textColor=PRIMARY_DARK, fontName='Helvetica-Bold', spaceAfter=6)))

    att_pct = attendance_summary['percentage']
    att_color = SUCCESS if att_pct >= 75 else (WARNING if att_pct >= 60 else DANGER)
    att_bg = SUCCESS_BG if att_pct >= 75 else (WARNING_BG if att_pct >= 60 else DANGER_BG)
    att_box = Table([[Paragraph(
        f"Present: {attendance_summary['present']} / {attendance_summary['total']} days  |  {att_pct}%",
        ParagraphStyle('attv', fontSize=10.5, fontName='Helvetica-Bold', textColor=att_color)
    )]], colWidths=[17.7 * cm])
    att_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), att_bg), ('BOX', (0, 0), (-1, -1), 1, att_color),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
    ]))
    elements.append(att_box)
    elements.append(Spacer(1, 0.9 * cm))

    elements.append(Paragraph(
        'Please clear pending dues before the due date to avoid late fine.',
        ParagraphStyle('note', fontSize=9.5, fontName='Helvetica-Bold', textColor=DANGER, alignment=TA_CENTER)))

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer

# ═══════════════════════════════════════════════════════════════════════════
#  BULK CLASS NOTICE — ek hi PDF, har student ek page (roll-number order)
# ═══════════════════════════════════════════════════════════════════════════

def generate_bulk_notice_pdf(students, school, month, FeeRecordModel, AttendanceModel):
    """
    students   : roll_number order mein Student list
    month      : "2026-07"
    FeeRecordModel / AttendanceModel : query ke liye pass kiye gaye models
                 (circular import avoid karne ke liye function args se aate hain)
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)

    all_elements = []

    for idx, student in enumerate(students):
        fee_records = FeeRecordModel.query.filter_by(
            student_id=student.id, month=month
        ).filter(FeeRecordModel.status != 'DRAFT').all()

        att_records  = AttendanceModel.query.filter_by(student_id=student.id).all()
        present      = sum(1 for a in att_records if a.status == 'PRESENT')
        total_marked = len(att_records)
        attendance_summary = {
            'present': present, 'total': total_marked,
            'percentage': round(present / total_marked * 100, 1) if total_marked else 0,
        }

        # ── letterhead + student info (same layout as single notice) ──
        page_elements = _letterhead(school, f'MONTHLY NOTICE — {_esc(month)}')

        label_style = ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold', textColor=PRIMARY_DARK)
        value_style = ParagraphStyle('v', fontSize=9.5, fontName='Helvetica')

        cls = Class.query.get(student.class_id) if student.class_id else None
        info_rows = [
            [Paragraph('Student Name', label_style), Paragraph(_esc(student.user.name if student.user else ''), value_style),
             Paragraph('Roll No', label_style), Paragraph(_esc(student.roll_number or ''), value_style)],
            [Paragraph('Class', label_style), Paragraph(_esc(f"{cls.name} - {cls.section}" if cls else ''), value_style),
             Paragraph('Parent Name', label_style), Paragraph(_esc(student.parent_name or ''), value_style)],
        ]
        info_table = Table(info_rows, colWidths=[3.2 * cm, 5.8 * cm, 3 * cm, 4 * cm])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('LINEBELOW', (0, 0), (-1, -1), 0.4, GREY_LINE),
            ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
            ('BOX', (0, 0), (-1, -1), 1, GREY_LINE),
        ]))
        page_elements.append(info_table)
        page_elements.append(Spacer(1, 0.55 * cm))

        # ── fee dues table (sab source: tuition+hostel+library+sports+exam) ──
        page_elements.append(Paragraph('FEE DUES — ALL TYPES', ParagraphStyle(
            'fd', fontSize=11, textColor=PRIMARY_DARK, fontName='Helvetica-Bold', spaceAfter=6)))

        status_color = {
            'PAID': (SUCCESS, SUCCESS_BG), 'PARTIAL': (WARNING, WARNING_BG),
            'OVERDUE': (DANGER, DANGER_BG), 'PENDING': (PRIMARY, PRIMARY_SOFT),
        }
        fee_rows = [['Fee Type', 'Due (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)', 'Status']]
        total_due = total_paid = 0
        for r in fee_records:
            balance = (r.amount_due or 0) - (r.amount_paid or 0)
            fee_rows.append([_esc(r.fee_type or ''), f'{r.amount_due:,.0f}', f'{r.amount_paid:,.0f}',
                              f'{balance:,.0f}', r.status])
            total_due += r.amount_due or 0
            total_paid += r.amount_paid or 0
        if not fee_records:
            fee_rows.append(['No dues this month', '', '', '', ''])

        fee_table = Table(fee_rows, colWidths=[5 * cm, 3 * cm, 3 * cm, 3 * cm, 3.7 * cm])
        style_cmds = [
            ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_DARK),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ZEBRA]),
            ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 7),
        ]
        for idx2, row in enumerate(fee_rows[1:], start=1):
            if row[-1] in status_color:
                fg, bg = status_color[row[-1]]
                style_cmds.append(('TEXTCOLOR', (4, idx2), (4, idx2), fg))
                style_cmds.append(('FONTNAME', (4, idx2), (4, idx2), 'Helvetica-Bold'))
        fee_table.setStyle(TableStyle(style_cmds))
        page_elements.append(fee_table)
        page_elements.append(Spacer(1, 0.4 * cm))

        total_pending = total_due - total_paid
        pend_color = DANGER if total_pending > 0 else SUCCESS
        pend_bg = DANGER_BG if total_pending > 0 else SUCCESS_BG
        pend_badge = Table([[Paragraph(f'Total Pending: Rs. {total_pending:,.2f}', ParagraphStyle(
            'tot', fontSize=12, fontName='Helvetica-Bold', textColor=pend_color, alignment=TA_CENTER
        ))]], colWidths=[17.7 * cm])
        pend_badge.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), pend_bg), ('BOX', (0, 0), (-1, -1), 1, pend_color),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        page_elements.append(pend_badge)
        page_elements.append(Spacer(1, 0.5 * cm))

        att_pct = attendance_summary['percentage']
        att_color = SUCCESS if att_pct >= 75 else (WARNING if att_pct >= 60 else DANGER)
        att_bg = SUCCESS_BG if att_pct >= 75 else (WARNING_BG if att_pct >= 60 else DANGER_BG)
        att_box = Table([[Paragraph(
            f"Attendance — Present: {attendance_summary['present']} / {attendance_summary['total']} days  |  {att_pct}%",
            ParagraphStyle('attv', fontSize=10, fontName='Helvetica-Bold', textColor=att_color)
        )]], colWidths=[17.7 * cm])
        att_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), att_bg), ('BOX', (0, 0), (-1, -1), 1, att_color),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        page_elements.append(att_box)
        page_elements.append(Spacer(1, 0.7 * cm))
        page_elements.append(Paragraph(
            'Please clear pending dues before the due date to avoid late fine.',
            ParagraphStyle('note', fontSize=9, fontName='Helvetica-Bold', textColor=DANGER, alignment=TA_CENTER)))

        all_elements.extend(page_elements)

        # ── next student naye page pe (last student ke baad PageBreak nahi chahiye) ──
        if idx < len(students) - 1:
            from reportlab.platypus import PageBreak
            all_elements.append(PageBreak())

    doc.build(all_elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════

def _get_grade(pct):
    if pct >= 90: return 'A+'
    if pct >= 80: return 'A'
    if pct >= 70: return 'B+'
    if pct >= 60: return 'B'
    if pct >= 50: return 'C'
    if pct >= 33: return 'D'
    return 'F'
