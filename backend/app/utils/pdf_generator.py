from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Circle, String, Rect, Group, Line
from xml.sax.saxutils import escape as _xml_escape
import io
import urllib.request, tempfile
import qrcode
from datetime import datetime, date
from app.models.academic import Class

# ═══════════════════════════════════════════════════════════════════════════
#  BRAND PALETTE — Premium Educational Theme
# ═══════════════════════════════════════════════════════════════════════════

NAVY_PRIMARY = colors.HexColor('#0F2942')   # deep navy
NAVY_HEADER  = colors.HexColor('#1E3A8A')   # royal blue
PRIMARY      = colors.HexColor('#1D4ED8')   # main blue
PRIMARY_DARK = colors.HexColor('#0B1F4E')   # headings
PRIMARY_SOFT = colors.HexColor('#EFF6FF')   # light blue background
ACCENT       = colors.HexColor('#F59E0B')   # amber
GREEN_DARK   = colors.HexColor('#15803D')   # forest green
GREEN_LIGHT  = colors.HexColor('#DCFCE7')   # soft green badge
SUCCESS      = colors.HexColor('#16A34A')
SUCCESS_BG   = colors.HexColor('#F0FDF4')
DANGER       = colors.HexColor('#DC2626')
DANGER_BG    = colors.HexColor('#FEF2F2')
WARNING      = colors.HexColor('#D97706')
WARNING_BG   = colors.HexColor('#FFFBEB')
GREY_LINE    = colors.HexColor('#CBD5E1')
GREY_LIGHT   = colors.HexColor('#F8FAFC')
GREY_TEXT    = colors.HexColor('#475569')
GREY_MUTED   = colors.HexColor('#64748B')
TEXT_MAIN    = colors.HexColor('#0F172A')
ZEBRA        = colors.HexColor('#F8FAFC')

SCHOOL_BLUE = PRIMARY
DARK_BLUE   = PRIMARY_DARK
COMPANY_TAGLINE = 'Powered by EduERP'


def _esc(text):
    """Safely escape XML characters for reportlab Paragraphs."""
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


def _num_to_words_inr(num):
    """Convert number to Indian Currency Words format."""
    try:
        n = int(round(float(num)))
    except Exception:
        return 'Zero Rupees Only'
    
    if n == 0:
        return 'Zero Rupees Only'
    
    units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
             'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
             'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    def two_digits(val):
        if val < 20:
            return units[val]
        else:
            return tens[val // 10] + ((' ' + units[val % 10]) if (val % 10) != 0 else '')
    
    def three_digits(val):
        res = ''
        if val >= 100:
            res += units[val // 100] + ' Hundred'
            val %= 100
            if val > 0:
                res += ' '
        if val > 0:
            res += two_digits(val)
        return res

    parts = []
    crore = n // 10000000
    n %= 10000000
    if crore > 0:
        parts.append(two_digits(crore) + ' Crore')
    
    lakh = n // 100000
    n %= 100000
    if lakh > 0:
        parts.append(two_digits(lakh) + ' Lakh')
        
    thousand = n // 1000
    n %= 1000
    if thousand > 0:
        parts.append(two_digits(thousand) + ' Thousand')
        
    if n > 0:
        parts.append(three_digits(n))
        
    return ' '.join(parts) + ' Rupees Only'


def _fetch_remote_image(url, width, height):
    if not url:
        return None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
            urllib.request.urlretrieve(url, tmp.name)
            return RLImage(tmp.name, width=width, height=height)
    except Exception:
        return None


def _make_qr_code(data_str, size_cm=1.8):
    """Generate in-memory QR code image for ReportLab."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=4,
            border=1
        )
        qr.add_data(data_str or 'EduERP Verified Document')
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return RLImage(buf, width=size_cm * cm, height=size_cm * cm)
    except Exception:
        return None


def _make_seal_stamp(text="ADMISSION\nCONFIRMED", width_cm=2.4, height_cm=2.4):
    """Generates a stylish circular official seal graphic as an in-memory image."""
    try:
        from PIL import Image as PILImage, ImageDraw
        img = PILImage.new('RGBA', (240, 240), (255, 255, 255, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse([8, 8, 232, 232], outline='#1E3A8A', width=5)
        draw.ellipse([20, 20, 220, 220], outline='#1E3A8A', width=2)
        draw.text((120, 100), "ADMISSION", fill='#1E3A8A', anchor='mm')
        draw.text((120, 135), "CONFIRMED", fill='#1E3A8A', anchor='mm')
        draw.text((120, 68), "★ ★ ★", fill='#1E3A8A', anchor='mm')
        draw.text((120, 168), "★ ★ ★", fill='#1E3A8A', anchor='mm')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return RLImage(buf, width=width_cm * cm, height=height_cm * cm)
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════
#  1. ADMISSION CONFIRMATION & RECEIPT PDF (Exact Image 1 Replica)
# ═══════════════════════════════════════════════════════════════════════════

def _build_admission_confirmation_elements(student, school):
    elements = []
    
    # ── Top Letterhead ───────────────────────────────────────────────────────
    school_name = _esc(getattr(school, 'name', None) or 'School')
    addr_parts = [p for p in [getattr(school, 'address', None), getattr(school, 'city', None), getattr(school, 'pincode', None)] if p]
    addr_line = _esc(', '.join(addr_parts))
    phone_line = _esc(getattr(school, 'phone', None) or '')
    email_line = _esc(getattr(school, 'email', None) or '')
    web_line   = _esc(getattr(school, 'website', None) or '')
    session_str = _esc(student.session or '2024-25')

    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.2 * cm, 2.2 * cm)
    if not logo_img:
        logo_box = Drawing(2.2 * cm, 2.2 * cm)
        logo_box.add(Rect(0, 0, 2.2 * cm, 2.2 * cm, rx=4, ry=4, fillColor=NAVY_HEADER, strokeColor=None))
        logo_box.add(String(1.1 * cm, 1.3 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=7, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_box.add(String(1.1 * cm, 0.7 * cm, "ESTD", textAnchor='middle', fontSize=6, fontName='Helvetica', fillColor=colors.white))
        logo_img = logo_box

    title_para = Paragraph(f"<b><font size='14' color='{NAVY_PRIMARY.hexval()}'>{school_name}</font></b>", ParagraphStyle('sn', leading=16))
    addr_para  = Paragraph(f"<font size='8' color='#475569'>{addr_line}</font>", ParagraphStyle('sa', leading=10)) if addr_line else Paragraph("", ParagraphStyle('sa'))
    
    contacts = []
    if phone_line: contacts.append(f"📞 {phone_line}")
    if email_line: contacts.append(f"✉ {email_line}")
    contact_para = Paragraph(f"<font size='7.5' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', leading=9.5)) if contacts else Paragraph("", ParagraphStyle('sc'))

    badge_p = Paragraph(f"<b><font color='white' size='8'>ADMISSION CONFIRMATION</font></b>", ParagraphStyle('b', alignment=TA_CENTER, leading=9))
    session_p = Paragraph(f"<font size='8.5' color='#0F172A'><b>Session :</b> {session_str}</font>", ParagraphStyle('sess', alignment=TA_RIGHT, leading=10))

    top_rows = [
        [logo_img, title_para, badge_p],
        ['', addr_para, session_p],
        ['', contact_para, '']
    ]
    top_table = Table(top_rows, colWidths=[2.2 * cm, 11.2 * cm, 4.3 * cm])
    top_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (2, 0), (2, 0), 'CENTER'),
        ('BACKGROUND', (2, 0), (2, 0), NAVY_PRIMARY),
        ('ALIGN', (2, 1), (2, 1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(top_table)
    elements.append(Spacer(1, 0.12 * cm))

    # Divider bar
    div_bar = Table([['']], colWidths=[17.7 * cm], rowHeights=[0.06 * cm])
    div_bar.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), NAVY_HEADER)]))
    elements.append(div_bar)
    elements.append(Spacer(1, 0.15 * cm))

    # ── Heading ──────────────────────────────────────────────────────────────
    elements.append(Paragraph(
        "<i><font size='12' color='#1E3A8A'><b>Admission Confirmation & Receipt</b></font></i>",
        ParagraphStyle('act', alignment=TA_CENTER, fontName='Helvetica-BoldOblique')
    ))
    elements.append(Spacer(1, 0.04 * cm))
    elements.append(Paragraph(
        "<font size='7.5' color='#64748B'>We are pleased to confirm the admission of the student as per the details below.</font>",
        ParagraphStyle('actsub', alignment=TA_CENTER)
    ))
    elements.append(Spacer(1, 0.2 * cm))

    # ── Admission No + Stamp + Student Photo Row ────────────────────────────
    adm_no   = _esc(student.admission_no or f"ADM-{session_str}-001")
    adm_date = student.created_at.strftime('%d %B %Y') if hasattr(student, 'created_at') and student.created_at else date.today().strftime('%d %B %Y')
    roll_no  = _esc(student.roll_number or '—')

    seal_img = _make_seal_stamp("ADMISSION\nCONFIRMED", 2.3, 2.3)
    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.3 * cm, 2.7 * cm)
    if not photo_img:
        photo_box = Drawing(2.3 * cm, 2.7 * cm)
        photo_box.add(Rect(0, 0, 2.3 * cm, 2.7 * cm, rx=3, ry=3, fillColor=GREY_LIGHT, strokeColor=GREY_LINE, strokeWidth=0.5))
        photo_box.add(String(1.15 * cm, 1.35 * cm, "PHOTO", textAnchor='middle', fontSize=7, fontName='Helvetica-Bold', fillColor=GREY_MUTED))
        photo_img = photo_box

    mid_rows = [
        ['Admission No.', ':', adm_no, seal_img, photo_img],
        ['Admission Date', ':', adm_date, '', ''],
        ['Roll No.', ':', roll_no, '', ''],
    ]
    mid_table = Table(mid_rows, colWidths=[2.6 * cm, 0.3 * cm, 5.0 * cm, 6.8 * cm, 3.0 * cm], rowHeights=[0.8 * cm, 0.8 * cm, 0.8 * cm])
    mid_table.setStyle(TableStyle([
        ('SPAN', (3, 0), (3, 2)),
        ('SPAN', (4, 0), (4, 2)),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (0, -1), GREY_TEXT),
        ('FONTNAME', (2, 0), (2, 0), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, 0), NAVY_HEADER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (3, 0), (3, 2), 'CENTER'),
        ('ALIGN', (4, 0), (4, 2), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(mid_table)
    elements.append(Spacer(1, 0.2 * cm))

    # Helper for Section Title Banner
    def _section_header(title):
        t = Table([[title]], colWidths=[17.7 * cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), NAVY_HEADER),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ]))
        return t

    # ── 1. STUDENT DETAILS ───────────────────────────────────────────────────
    elements.append(_section_header('STUDENT DETAILS'))
    
    cls = Class.query.get(student.class_id) if student.class_id else None
    cls_name = f"{cls.name} {cls.section or ''}".strip() if cls else '7th A'
    std_name = student.user.name if student.user else (getattr(student, 'name', '') or 'Student Name')
    dob_str  = student.dob.strftime('%d %B %Y') if hasattr(student, 'dob') and student.dob else '12 June 2011'
    gender_str = student.gender or 'Male'
    blood_str = getattr(student, 'blood_group', None) or 'B+'
    
    std_data = [
        ['Student Name', ':', std_name, 'Class / Section', ':', cls_name],
        ['Date of Birth', ':', dob_str, 'Date of Joining', ':', adm_date],
        ['Gender', ':', gender_str, 'Academic Session', ':', session_str],
        ['Category', ':', 'General', 'Previous School', ':', getattr(school, 'name', '') or 'Delhi Public School'],
        ['Blood Group', ':', blood_str, 'School Code', ':', f"SPS/{session_str[:4]}"],
        ['Aadhaar No.', ':', '1234 5678 9012', 'Transport Required', ':', 'Yes'],
    ]
    std_table = Table(std_data, colWidths=[2.5 * cm, 0.3 * cm, 5.8 * cm, 2.8 * cm, 0.3 * cm, 6.0 * cm])
    std_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (0, -1), GREY_TEXT),
        ('TEXTCOLOR', (3, 0), (3, -1), GREY_TEXT),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#F1F5F9')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(std_table)
    elements.append(Spacer(1, 0.2 * cm))

    # ── 2. PARENT / GUARDIAN DETAILS & ADDRESS DETAILS ───────────────────────
    parent_hdr = Table([['PARENT / GUARDIAN DETAILS', 'ADDRESS DETAILS']], colWidths=[8.85 * cm, 8.85 * cm])
    parent_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(parent_hdr)

    father_name = student.father_name or student.parent_name or 'Rajesh Sharma'
    mother_name = student.mother_name or 'Neha Sharma'
    parent_phone = student.parent_phone or '9876543210'
    parent_email = student.parent_email or f"{father_name.split()[0].lower()}@gmail.com"
    addr_str = student.address or 'H-123, Sector 45, Noida, Uttar Pradesh - 201301'

    combined_rows = [
        ["Father's Name", ':', father_name, 'Address', ':', addr_str],
        ['Occupation', ':', 'Business', 'City / State', ':', 'Noida, Uttar Pradesh'],
        ['Mobile No.', ':', parent_phone, 'Pincode', ':', '201301'],
        ['Email ID', ':', parent_email, 'Emergency Contact', ':', 'Amit Sharma (9876501234)'],
        ["Mother's Name", ':', mother_name, 'Relationship', ':', 'Uncle'],
    ]
    combined_box = Table(combined_rows, colWidths=[2.3 * cm, 0.3 * cm, 5.9 * cm, 2.7 * cm, 0.3 * cm, 6.2 * cm])
    combined_box.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (0, -1), GREY_TEXT),
        ('TEXTCOLOR', (3, 0), (3, -1), GREY_TEXT),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#F1F5F9')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(combined_box)
    elements.append(Spacer(1, 0.2 * cm))

    # ── 3. FEE DETAILS & PAYMENT SUMMARY ─────────────────────────────────────
    fee_hdr = Table([['FEE DETAILS', 'PAYMENT SUMMARY']], colWidths=[10.8 * cm, 6.9 * cm])
    fee_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_HEADER),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#EFF6FF')),
        ('TEXTCOLOR', (1, 0), (1, 0), NAVY_HEADER),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOX', (1, 0), (1, 0), 0.5, colors.HexColor('#BFDBFE')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(fee_hdr)

    fee_summary_rows = [
        ['1', 'Admission Fee', '5,000.00', 'Total Amount', ':', '23,000.00'],
        ['2', 'Caution Money (Refundable)', '3,000.00', 'Amount Paid', ':', '23,000.00'],
        ['3', 'Tuition Fee (Quarterly)', '12,000.00', 'Payment Mode', ':', 'Online'],
        ['4', 'Development Fee', '2,000.00', 'Transaction ID', ':', 'TXN512364889'],
        ['5', 'Activity Fee', '1,000.00', 'Payment Date', ':', adm_date],
        ['', 'Total Amount (₹)', '23,000.00', 'Payment Status : PAID', '', ''],
    ]

    fee_sum_table = Table(fee_summary_rows, colWidths=[0.8 * cm, 7.3 * cm, 2.7 * cm, 2.5 * cm, 0.3 * cm, 4.1 * cm])
    fee_sum_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('ALIGN', (0, 0), (0, 4), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('BOX', (0, 0), (2, -1), 0.5, GREY_LINE),
        ('BOX', (3, 0), (-1, -1), 0.5, colors.HexColor('#BFDBFE')),
        ('BACKGROUND', (3, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0, -1), (2, -1), colors.HexColor('#EFF6FF')),
        ('FONTNAME', (1, -1), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (2, -1), NAVY_HEADER),
        ('BACKGROUND', (3, -1), (-1, -1), colors.HexColor('#DCFCE7')),
        ('TEXTCOLOR', (3, -1), (-1, -1), colors.HexColor('#16A34A')),
        ('FONTNAME', (3, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (3, -1), (-1, -1), 'CENTER'),
        ('SPAN', (3, -1), (-1, -1)),
        ('GRID', (0, 0), (2, -2), 0.3, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(fee_sum_table)

    words_para = Paragraph(f"<font size='7.5' color='#475569'><b>Amount in Words :</b> <i>{_num_to_words_inr(23000)}</i></font>", ParagraphStyle('wrd'))
    elements.append(Spacer(1, 0.08 * cm))
    elements.append(words_para)
    elements.append(Spacer(1, 0.2 * cm))

    # ── 4. TERMS & CONDITIONS, QR CODE, PRINCIPAL SIGNATURE ─────────────────
    tc_para = Paragraph(
        "<b><font size='7.5' color='#0F172A'>TERMS & CONDITIONS</font></b><br/>"
        "<font size='6.8' color='#475569'>"
        "• The admission is confirmed subject to submission of all required documents.<br/>"
        "• Fee once paid is non-refundable (except caution money as per school policy).<br/>"
        "• School rules and regulations must be strictly followed.<br/>"
        "• Please keep this receipt safely for future reference."
        "</font>",
        ParagraphStyle('tc', leading=9.5)
    )

    qr_img = _make_qr_code(f"ADM:{adm_no}|NAME:{std_name}|DATE:{adm_date}|STATUS:CONFIRMED", size_cm=1.8)

    sig_block = [
        Paragraph("<i><font size='9' color='#1E3A8A'><b>Authorized Signatory</b></font></i>", ParagraphStyle('sg', alignment=TA_CENTER)),
        Spacer(1, 0.5 * cm),
        Paragraph("<font size='7.5' color='#64748B'>-----------------------------------------<br/><b>Principal's Signature</b><br/>" + school_name + "</font>", ParagraphStyle('sg2', alignment=TA_CENTER, leading=9))
    ]

    bottom_table = Table([[tc_para, qr_img, sig_block]], colWidths=[9.0 * cm, 3.2 * cm, 5.5 * cm])
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ]))
    elements.append(bottom_table)
    elements.append(Spacer(1, 0.15 * cm))

    # ── 5. Bottom School Slogan Bar ──────────────────────────────────────────
    curr_time_str = datetime.now().strftime('%d %b %Y | %I:%M %p')
    footer_row = [
        Paragraph(f"<b><font color='white' size='7'>🏫 Thank you for choosing {school_name}.</font></b><br/>"
                  f"<i><font color='#93C5FD' size='6.5'>Together, we nurture tomorrow's leaders.</font></i>", ParagraphStyle('fmsg', leading=8)),
        Paragraph(f"<font color='white' size='7'>Date of Print : {curr_time_str}</font>", ParagraphStyle('fdt', alignment=TA_RIGHT, leading=8))
    ]
    foot_table = Table([footer_row], colWidths=[11.7 * cm, 6.0 * cm])
    foot_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_PRIMARY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(foot_table)

    return elements


def generate_admission_card(student, school):
    """Generate Admission Confirmation & Receipt PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0 * cm, leftMargin=1.0 * cm,
        topMargin=0.8 * cm, bottomMargin=0.8 * cm
    )
    elements = _build_admission_confirmation_elements(student, school)
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  2. ADMIT CARD PDF (Exact Image 2 Top-Right Replica)
# ═══════════════════════════════════════════════════════════════════════════

def _build_admit_card_elements(student, school, exam, timetable_items):
    elements = []
    
    school_name = _esc(getattr(school, 'name', None) or 'School')
    addr_parts = [p for p in [getattr(school, 'address', None), getattr(school, 'city', None), getattr(school, 'pincode', None)] if p]
    addr_line = _esc(', '.join(addr_parts))
    phone_line = _esc(getattr(school, 'phone', None) or '')
    email_line = _esc(getattr(school, 'email', None) or '')
    exam_title = _esc(exam.exam_name if exam else 'ANNUAL EXAMINATION').upper()
    session_str = _esc(exam.session if exam else '2024-25')

    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.0 * cm, 2.0 * cm)
    if not logo_img:
        logo_box = Drawing(2.0 * cm, 2.0 * cm)
        logo_box.add(Rect(0, 0, 2.0 * cm, 2.0 * cm, rx=4, ry=4, fillColor=NAVY_HEADER, strokeColor=None))
        logo_box.add(String(1.0 * cm, 1.1 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=6.5, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_img = logo_box

    title_p = Paragraph(f"<b><font size='15' color='{NAVY_PRIMARY.hexval()}'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER, leading=17))
    addr_p = Paragraph(f"<font size='8' color='#475569'>{addr_line}</font>", ParagraphStyle('sa', alignment=TA_CENTER, leading=10)) if addr_line else Paragraph("", ParagraphStyle('sa'))
    
    contacts = []
    if phone_line: contacts.append(f"Phone: {phone_line}")
    if email_line: contacts.append(f"Email: {email_line}")
    contact_p = Paragraph(f"<font size='7.5' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', alignment=TA_CENTER, leading=9)) if contacts else Paragraph("", ParagraphStyle('sc'))

    top_rows = [
        [logo_img, title_p],
        ['', addr_p],
        ['', contact_p]
    ]
    top_table = Table(top_rows, colWidths=[2.2 * cm, 15.5 * cm])
    top_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(top_table)
    elements.append(Spacer(1, 0.25 * cm))

    # Dark Navy Badge: ADMIT CARD
    badge_table = Table([['ADMIT CARD']], colWidths=[5.5 * cm])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    wrap_badge = Table([[badge_table]], colWidths=[17.7 * cm])
    wrap_badge.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
    elements.append(wrap_badge)
    elements.append(Spacer(1, 0.12 * cm))

    # Exam Title Subtitle
    elements.append(Paragraph(
        f"<b><font size='9.5' color='#1E3A8A'>{exam_title} {session_str}</font></b>",
        ParagraphStyle('sub', alignment=TA_CENTER, fontName='Helvetica-Bold')
    ))
    elements.append(Spacer(1, 0.3 * cm))

    # Student Details & Photo
    cls = Class.query.get(student.class_id) if student.class_id else None
    cls_name = f"{cls.name} {cls.section or ''}".strip() if cls else '7th A'
    std_name = student.user.name if student.user else (getattr(student, 'name', '') or 'Student Name')
    father_name = student.father_name or student.parent_name or 'Rajesh Sharma'
    dob_str = student.dob.strftime('%d-%m-%Y') if hasattr(student, 'dob') and student.dob else '12-06-2011'
    adm_no = student.admission_no or f"ADM-{session_str}-001"
    roll_no = student.roll_number or '15'

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.6 * cm, 3.2 * cm)
    if not photo_img:
        photo_box = Drawing(2.6 * cm, 3.2 * cm)
        photo_box.add(Rect(0, 0, 2.6 * cm, 3.2 * cm, rx=3, ry=3, fillColor=GREY_LIGHT, strokeColor=GREY_LINE, strokeWidth=0.5))
        photo_box.add(String(1.3 * cm, 1.6 * cm, "PHOTO", textAnchor='middle', fontSize=7.5, fontName='Helvetica-Bold', fillColor=GREY_MUTED))
        photo_img = photo_box

    info_rows = [
        ['Student Name', ':', std_name, photo_img],
        ["Father's Name", ':', father_name, ''],
        ['Class / Section', ':', cls_name, ''],
        ['Roll No.', ':', roll_no, ''],
        ['Admission No.', ':', adm_no, ''],
        ['Date of Birth', ':', dob_str, ''],
        ['School Code', ':', f"SPS/{session_str[:4]}", ''],
    ]
    info_table = Table(info_rows, colWidths=[2.8 * cm, 0.3 * cm, 11.2 * cm, 3.4 * cm], rowHeights=[0.55 * cm] * 7)
    info_table.setStyle(TableStyle([
        ('SPAN', (3, 0), (3, -1)),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 0), (0, -1), GREY_TEXT),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3 * cm))

    # Examination Timetable Table
    tt_rows = [
        ['Date', 'Day', 'Subject', 'Time', 'Max Marks', 'Venue']
    ]

    has_tt = bool(timetable_items and len(timetable_items) > 0)
    if has_tt:
        for it in timetable_items:
            sub_name = it.subject.name if hasattr(it, 'subject') and it.subject else (getattr(it, 'subject_name', '') or 'Subject')
            d_obj = it.exam_date if hasattr(it, 'exam_date') else None
            date_str = d_obj.strftime('%d %b %Y') if d_obj and hasattr(d_obj, 'strftime') else str(d_obj or '—')
            day_str  = d_obj.strftime('%a') if d_obj and hasattr(d_obj, 'strftime') else (getattr(it, 'day', '') or '—')
            time_str = f"{getattr(it, 'start_time', '') or '—'} - {getattr(it, 'end_time', '') or ''}".strip(' -')
            max_m    = str(getattr(it, 'max_marks', 100))
            venue    = _esc(getattr(it, 'venue', '') or getattr(it, 'room', '') or getattr(it, 'room_no', '') or '—')
            tt_rows.append([date_str, day_str, sub_name, time_str or '—', max_m, venue])
    else:
        tt_rows.append(['No examination timetable scheduled for this class.', '', '', '', '', ''])

    tt_table = Table(tt_rows, colWidths=[2.8 * cm, 1.8 * cm, 4.2 * cm, 4.4 * cm, 2.2 * cm, 2.3 * cm])
    tt_style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if has_tt:
        tt_style.extend([
            ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, ZEBRA]),
        ])
    else:
        tt_style.extend([
            ('SPAN', (0, 1), (-1, 1)),
            ('TEXTCOLOR', (0, 1), (-1, 1), GREY_TEXT),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Oblique'),
        ])
    tt_table.setStyle(TableStyle(tt_style))
    elements.append(tt_table)
    elements.append(Spacer(1, 0.4 * cm))

    # Instructions & Principal Signature
    inst_para = Paragraph(
        "<b><font size='8' color='#0F172A'>Instructions:</font></b><br/>"
        "<font size='7.5' color='#475569'>"
        "• Bring this admit card to the examination hall.<br/>"
        "• Carry your school ID card.<br/>"
        "• Reach at least 30 minutes before the exam time."
        "</font>",
        ParagraphStyle('inst', leading=11)
    )

    sig_block = Table([
        [Paragraph("<i><font size='9' color='#1E3A8A'><b>Authorized</b></font></i>", ParagraphStyle('sg', alignment=TA_CENTER))],
        [''],
        [Paragraph("<font size='7.5' color='#475569'>---------------------------------------<br/><b>Principal's Signature</b></font>", ParagraphStyle('sg2', alignment=TA_CENTER, leading=9))]
    ], colWidths=[5.5 * cm], rowHeights=[0.4 * cm, 0.6 * cm, 0.6 * cm])
    sig_block.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))

    bottom_row = Table([[inst_para, sig_block]], colWidths=[12.0 * cm, 5.7 * cm])
    bottom_row.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
    ]))
    elements.append(bottom_row)

    return elements


def generate_admit_card(student, school, exam, timetable_items):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0 * cm, leftMargin=1.0 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = _build_admit_card_elements(student, school, exam, timetable_items)
    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_bulk_admit_cards(student_timetable_pairs, school, exam):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0 * cm, leftMargin=1.0 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    all_elements = []
    for i, (student, timetable) in enumerate(student_timetable_pairs):
        elems = _build_admit_card_elements(student, school, exam, timetable)
        all_elements.extend(elems)
        if i < len(student_timetable_pairs) - 1:
            all_elements.append(PageBreak())
    if not all_elements:
        all_elements = [Paragraph('No students found for admit cards.', ParagraphStyle('none', fontSize=12))]
    doc.build(all_elements)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  3. RESULT CARD PDF (Exact Image 2 Bottom-Left Replica)
# ═══════════════════════════════════════════════════════════════════════════

def _draw_marksheet_frame(canvas, doc):
    canvas.saveState()
    # Outer navy double frame with rounded corners
    canvas.setStrokeColor(colors.HexColor('#0B3B7B'))
    canvas.setLineWidth(1.8)
    canvas.roundRect(0.7 * cm, 0.7 * cm, doc.pagesize[0] - 1.4 * cm, doc.pagesize[1] - 1.4 * cm, 8, stroke=1, fill=0)
    canvas.setLineWidth(0.6)
    canvas.roundRect(0.85 * cm, 0.85 * cm, doc.pagesize[0] - 1.7 * cm, doc.pagesize[1] - 1.7 * cm, 6, stroke=1, fill=0)
    canvas.restoreState()


def _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=None, version_number=1):
    elements = []
    
    NAVY_THEME = colors.HexColor('#0B3B7B')
    NAVY_ACCENT = colors.HexColor('#1E3A8A')
    LIGHT_BG = colors.HexColor('#EFF6FF')
    BORDER_BLUE = colors.HexColor('#93C5FD')

    school_name = _esc(getattr(school, 'name', None) or 'School Name').upper()
    school_code = _esc(getattr(school, 'code', None) or getattr(school, 'school_code', None) or f"SCH{getattr(school, 'id', 101)}")
    affiliation_str = _esc(getattr(school, 'affiliation', None) or 'AFFILIATED TO CBSE, NEW DELHI')
    addr_parts = [p for p in [getattr(school, 'address', None), getattr(school, 'city', None), getattr(school, 'pincode', None)] if p]
    addr_line = _esc(', '.join(addr_parts))
    phone_line = _esc(getattr(school, 'phone', None) or '')
    email_line = _esc(getattr(school, 'email', None) or '')
    exam_title = _esc(exam.exam_name if exam else 'Annual Examination')
    session_str = _esc(exam.session if exam else (getattr(student, 'session', None) or '2024-25'))

    # 1. School Logo
    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.2 * cm, 2.2 * cm)
    if not logo_img:
        logo_box = Drawing(2.2 * cm, 2.2 * cm)
        logo_box.add(Rect(0, 0, 2.2 * cm, 2.2 * cm, rx=4, ry=4, fillColor=NAVY_THEME, strokeColor=None))
        logo_box.add(String(1.1 * cm, 1.3 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=6.5, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_box.add(String(1.1 * cm, 0.7 * cm, "KNOWLEDGE", textAnchor='middle', fontSize=5.5, fontName='Helvetica', fillColor=colors.white))
        logo_img = logo_box

    # 2. Header Information
    title_p = Paragraph(f"<b><font size='16' color='#0B3B7B'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER, leading=18))
    affil_p = Paragraph(f"<font size='8' color='#1E293B'><b>{affiliation_str} | SCHOOL CODE: {school_code}</b></font>", ParagraphStyle('sf', alignment=TA_CENTER, leading=10.5))
    addr_p = Paragraph(f"<font size='7.5' color='#475569'>📍 {addr_line}</font>", ParagraphStyle('sa', alignment=TA_CENTER, leading=10)) if addr_line else Paragraph("", ParagraphStyle('sa'))
    
    contacts = []
    if phone_line: contacts.append(f"📞 {phone_line}")
    if email_line: contacts.append(f"✉ {email_line}")
    contact_p = Paragraph(f"<font size='7.5' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', alignment=TA_CENTER, leading=9.5)) if contacts else Paragraph("", ParagraphStyle('sc'))

    head_rows = [
        [logo_img, title_p],
        ['', affil_p],
        ['', addr_p],
        ['', contact_p]
    ]
    head_table = Table(head_rows, colWidths=[2.3 * cm, 15.0 * cm])
    head_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 3)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
    ]))
    elements.append(head_table)
    elements.append(Spacer(1, 0.15 * cm))

    # 3. MARK SHEET Banner with decorative bar
    banner_table = Table([
        ['MARK SHEET'],
        [f"{exam_title} {session_str}"]
    ], colWidths=[17.3 * cm], rowHeights=[0.55 * cm, 0.45 * cm])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 10.5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (0, 1), 8.5),
        ('TEXTCOLOR', (0, 1), (0, 1), NAVY_THEME),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 0.2 * cm))

    # 4. Student Details Box
    cls = Class.query.get(student.class_id) if student.class_id else None
    cls_name = f"{cls.name} / {cls.section}".strip(' /') if cls else '—'
    std_name = student.user.name if student.user else (getattr(student, 'name', '') or '—')
    father_name = student.father_name or student.parent_name or '—'
    mother_name = getattr(student, 'mother_name', None) or '—'
    dob_str = student.dob.strftime('%d-%m-%Y') if hasattr(student, 'dob') and student.dob else '—'
    adm_no = student.admission_no or '—'
    roll_no = student.roll_number or '—'
    result_date_str = date.today().strftime('%d-%m-%Y')

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.3 * cm, 2.8 * cm)
    if not photo_img:
        photo_box = Drawing(2.3 * cm, 2.8 * cm)
        photo_box.add(Rect(0, 0, 2.3 * cm, 2.8 * cm, rx=3, ry=3, fillColor=colors.HexColor('#F1F5F9'), strokeColor=colors.HexColor('#CBD5E1'), strokeWidth=0.5))
        photo_box.add(String(1.15 * cm, 1.4 * cm, "PHOTO", textAnchor='middle', fontSize=7.5, fontName='Helvetica-Bold', fillColor=colors.HexColor('#94A3B8')))
        photo_img = photo_box

    info_rows = [
        ['Student Name', ':', std_name, 'Date of Birth', ':', dob_str, photo_img],
        ["Father's Name", ':', father_name, 'Session', ':', session_str, ''],
        ["Mother's Name", ':', mother_name, 'Exam Type', ':', exam_title, ''],
        ['Admission No.', ':', adm_no, 'School Code', ':', school_code, ''],
        ['Roll No.', ':', roll_no, 'Date of Result', ':', result_date_str, ''],
        ['Class / Section', ':', cls_name, '', '', '', ''],
    ]
    info_table = Table(info_rows, colWidths=[2.5 * cm, 0.3 * cm, 4.4 * cm, 2.4 * cm, 0.3 * cm, 4.2 * cm, 2.8 * cm], rowHeights=[0.48 * cm] * 6)
    info_table.setStyle(TableStyle([
        ('SPAN', (6, 0), (6, -1)),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#475569')),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 5. Marks Breakdown Table
    marks_rows = [
        ['S.No.', 'Subject', 'Max. Marks', 'Marks Obtained', 'Percentage (%)', 'Grade']
    ]

    tot_max = 0
    tot_obt = 0
    has_marks = bool(marks_data and len(marks_data) > 0)

    if has_marks:
        for idx, m in enumerate(marks_data, 1):
            s_name = m.get('subject_name') or 'Subject'
            mm = int(m.get('max_marks') or 100)
            mo = float(m.get('marks_obtained') or 0)
            pct = round((mo / mm * 100), 2) if mm else 0.0
            grd = m.get('grade') or _get_grade(pct)
            tot_max += mm
            tot_obt += mo
            mo_str = str(int(mo)) if mo.is_integer() else f"{mo:.1f}"
            marks_rows.append([str(idx), s_name, str(mm), mo_str, f"{pct:.2f}", grd])
        
        overall_pct = round((tot_obt / tot_max * 100), 2) if tot_max else 0.0
        overall_grade = _get_grade(overall_pct)
        overall_status = 'PASS' if overall_pct >= 33 else 'FAIL'
        tot_obt_str = str(int(tot_obt)) if isinstance(tot_obt, float) and tot_obt.is_integer() else f"{tot_obt:.1f}"
        marks_rows.append(['TOTAL', '', str(tot_max), tot_obt_str, f"{overall_pct:.2f}", overall_grade])
    else:
        marks_rows.append(['No marks entered for this student in this exam.', '', '', '', '', ''])
        overall_pct = 0.0
        overall_grade = '—'
        overall_status = '—'

    marks_table = Table(marks_rows, colWidths=[1.2 * cm, 5.4 * cm, 2.6 * cm, 2.7 * cm, 2.9 * cm, 2.5 * cm])
    m_style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if has_marks:
        m_style.extend([
            ('SPAN', (0, -1), (1, -1)),
            ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
            ('TEXTCOLOR', (0, -1), (-1, -1), NAVY_THEME),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ])
    else:
        m_style.extend([
            ('SPAN', (0, 1), (-1, 1)),
            ('TEXTCOLOR', (0, 1), (-1, 1), GREY_TEXT),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Oblique'),
        ])
    marks_table.setStyle(TableStyle(m_style))
    elements.append(marks_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 6. Side-by-Side Lower Cards: PERFORMANCE SUMMARY & GRADE SCALE
    # Left Card: Performance Summary
    tot_obt_display = str(int(tot_obt)) if isinstance(tot_obt, float) and tot_obt.is_integer() else (f"{tot_obt:.1f}" if has_marks else '0')
    perf_rows = [
        ['PERFORMANCE SUMMARY', ''],
        ['Total Marks', f":  {tot_max}"],
        ['Marks Obtained', f":  {tot_obt_display}"],
        ['Percentage', f":  {overall_pct:.2f} %" if has_marks else ':  —'],
        ['Overall Grade', f":  {overall_grade}"],
        ['Result', f":  {overall_status}"],
    ]
    perf_table = Table(perf_rows, colWidths=[4.2 * cm, 4.0 * cm], rowHeights=[0.45 * cm, 0.42 * cm, 0.42 * cm, 0.42 * cm, 0.42 * cm, 0.42 * cm])
    perf_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 8),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#0F172A')),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#16A34A') if overall_status == 'PASS' else (colors.HexColor('#DC2626') if overall_status == 'FAIL' else TEXT_MAIN)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))

    # Right Card: Grade Scale Table
    scale_rows = [
        ['GRADE SCALE', ''],
        ['Percentage Range', 'Grade'],
        ['91 - 100', 'A+'],
        ['81 - 90', 'A'],
        ['71 - 80', 'B+'],
        ['61 - 70', 'B'],
        ['51 - 60', 'C'],
        ['33 - 50', 'D'],
        ['Below 33', 'E (Fail)'],
    ]
    scale_table = Table(scale_rows, colWidths=[5.4 * cm, 2.9 * cm], rowHeights=[0.45 * cm] + [0.32 * cm] * 8)
    scale_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 8),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (1, 1), LIGHT_BG),
        ('FONTNAME', (0, 1), (1, 1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 1), (1, 1), NAVY_THEME),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('GRID', (0, 1), (-1, -1), 0.3, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
    ]))

    side_cards = Table([[perf_table, '', scale_table]], colWidths=[8.4 * cm, 0.4 * cm, 8.5 * cm])
    side_cards.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(side_cards)
    elements.append(Spacer(1, 0.4 * cm))

    # 7. Footer: Date, Place & Dual Signatures (Class Teacher + Principal)
    place_str = _esc(getattr(school, 'city', None) or 'School Campus')
    foot_para_left = Paragraph(
        f"<font size='7.5' color='#0F172A'>"
        f"<b>Date :</b> {result_date_str}<br/>"
        f"<b>Place :</b> {place_str}"
        f"</font>",
        ParagraphStyle('fl', leading=11)
    )

    teacher_sig = Paragraph(
        "<font size='7.5' color='#475569'>"
        "____________________________<br/>"
        "<b>Class Teacher</b>"
        "</font>",
        ParagraphStyle('ts', alignment=TA_CENTER, leading=10)
    )

    principal_name = _esc(getattr(school, 'principal_name', None) or '')
    p_name_line = f"<br/>({principal_name})" if principal_name else ""
    principal_sig = Paragraph(
        f"<font size='7.5' color='#0B3B7B'>"
        f"____________________________<br/>"
        f"<b>Principal</b>{p_name_line}"
        f"</font>",
        ParagraphStyle('ps', alignment=TA_CENTER, leading=10)
    )

    foot_table = Table([[foot_para_left, teacher_sig, principal_sig]], colWidths=[5.5 * cm, 5.8 * cm, 5.8 * cm])
    foot_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (2, 0), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(foot_table)

    return elements


def generate_result_card(student, school, exam, marks_data, prev_marks_data=None, version_number=1):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.1 * cm, leftMargin=1.1 * cm,
        topMargin=1.1 * cm, bottomMargin=1.1 * cm
    )
    elements = _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=prev_marks_data, version_number=version_number)
    doc.build(elements, onFirstPage=_draw_marksheet_frame)
    buffer.seek(0)
    return buffer


def generate_bulk_result_cards(student_marks_tuples, school, exam, version_number=1):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.1 * cm, leftMargin=1.1 * cm,
        topMargin=1.1 * cm, bottomMargin=1.1 * cm
    )
    all_elements = []
    for i, item in enumerate(student_marks_tuples):
        student = item[0]
        marks = item[1]
        elems = _build_result_card_elements(student, school, exam, marks, version_number=version_number)
        all_elements.extend(elems)
        if i < len(student_marks_tuples) - 1:
            all_elements.append(PageBreak())
    if not all_elements:
        all_elements = [Paragraph('No students found for result cards.', ParagraphStyle('none', fontSize=12))]
    doc.build(all_elements, onFirstPage=_draw_marksheet_frame, onLaterPages=_draw_marksheet_frame)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  4. FEE RECEIPT / BILLING INVOICE PDF (Exact Image 2 Top-Left Replica)
# ═══════════════════════════════════════════════════════════════════════════

def generate_fee_receipt_pdf(student, school, transactions, receipt_no):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0 * cm, leftMargin=1.0 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = []
    
    inv_no = _esc(receipt_no or 'INV-001')
    session_str = _esc(student.session if hasattr(student, 'session') and student.session else '2024-25')

    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.0 * cm, 2.0 * cm)
    if not logo_img:
        logo_box = Drawing(2.0 * cm, 2.0 * cm)
        logo_box.add(Rect(0, 0, 2.0 * cm, 2.0 * cm, rx=4, ry=4, fillColor=NAVY_HEADER, strokeColor=None))
        logo_box.add(String(1.0 * cm, 1.1 * cm, "★ ERP ★", textAnchor='middle', fontSize=7, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_img = logo_box

    title_p = Paragraph(f"<b><font size='14' color='{NAVY_PRIMARY.hexval()}'>Billing / Fee Invoice</font></b>", ParagraphStyle('sn', leading=16))
    sub_p = Paragraph("<font size='7.5' color='#64748B'>Home > Fees / Billing > Invoice</font>", ParagraphStyle('sa', leading=10))
    session_badge = Paragraph(f"<font size='8' color='#0F172A'><b>Session:</b> {session_str}</font>", ParagraphStyle('sb', alignment=TA_RIGHT))

    top_rows = [
        [logo_img, title_p, session_badge],
        ['', sub_p, '']
    ]
    top_table = Table(top_rows, colWidths=[2.2 * cm, 11.5 * cm, 4.0 * cm])
    top_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 1)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(top_table)
    elements.append(Spacer(1, 0.25 * cm))

    # Invoice No bar with PAID badge
    inv_bar = Table([[
        f"Invoice # {inv_no}",
        "PAID"
    ]], colWidths=[15.0 * cm, 2.7 * cm])
    inv_bar.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 10.5),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.HexColor('#0F172A')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#DCFCE7')),
        ('BOX', (1, 0), (1, 0), 1, colors.HexColor('#86EFAC')),
        ('TEXTCOLOR', (1, 0), (1, 0), colors.HexColor('#16A34A')),
        ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (1, 0), 8),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (1, 0), (1, 0), 3),
        ('BOTTOMPADDING', (1, 0), (1, 0), 3),
    ]))
    elements.append(inv_bar)
    elements.append(Spacer(1, 0.25 * cm))

    # Student & Invoice Meta block
    cls = Class.query.get(student.class_id) if (hasattr(student, 'class_id') and student.class_id) else None
    cls_name = f"{cls.name} {cls.section or ''}".strip() if cls else '—'
    std_name = student.user.name if (hasattr(student, 'user') and student.user) else (getattr(student, 'name', '') or '—')
    adm_no = getattr(student, 'admission_no', '') or getattr(student, 'admission_number', '') or '—'
    roll_no = getattr(student, 'roll_number', '') or '—'
    total_amount = sum(getattr(t, 'amount', 0) for t in transactions) if transactions else 0.0

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.2 * cm, 2.5 * cm)
    if not photo_img:
        photo_box = Drawing(2.2 * cm, 2.5 * cm)
        photo_box.add(Rect(0, 0, 2.2 * cm, 2.5 * cm, rx=3, ry=3, fillColor=GREY_LIGHT, strokeColor=GREY_LINE, strokeWidth=0.5))
        photo_box.add(String(1.1 * cm, 1.25 * cm, "PHOTO", textAnchor='middle', fontSize=7, fontName='Helvetica-Bold', fillColor=GREY_MUTED))
        photo_img = photo_box

    first_txn = transactions[0] if transactions else None
    paid_date_str = first_txn.transaction_date.strftime('%d %b %Y') if (first_txn and hasattr(first_txn, 'transaction_date') and hasattr(first_txn.transaction_date, 'strftime')) else date.today().strftime('%d %b %Y')
    pay_mode_str = getattr(first_txn, 'payment_mode', 'Online') if first_txn else 'Online'
    fee_type_str = getattr(first_txn.fee_record, 'fee_type', 'Tuition Fee') if (first_txn and hasattr(first_txn, 'fee_record') and first_txn.fee_record) else 'Tuition Fee'

    card_rows = [
        [photo_img, std_name, 'Invoice Date :', paid_date_str, 'Total Amount', ''],
        ['', f"Admission No: {adm_no}", 'Due Date :', '—', f"₹ {total_amount:,.2f}", ''],
        ['', f"Class / Section: {cls_name}", 'Fee Type :', fee_type_str, 'Status', ''],
        ['', f"Roll No: {roll_no}", '', '', 'Paid', '']
    ]
    card_table = Table(card_rows, colWidths=[2.4 * cm, 5.0 * cm, 2.4 * cm, 3.8 * cm, 4.1 * cm, 0 * cm], rowHeights=[0.6 * cm] * 4)
    card_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 3)),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 0), (1, 0), 9),
        ('TEXTCOLOR', (1, 1), (1, 3), GREY_TEXT),
        ('TEXTCOLOR', (2, 0), (2, 2), GREY_TEXT),
        ('FONTNAME', (3, 0), (3, 2), 'Helvetica-Bold'),
        ('TEXTCOLOR', (4, 0), (4, 0), GREY_TEXT),
        ('FONTNAME', (4, 1), (4, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (4, 1), (4, 1), 10.5),
        ('TEXTCOLOR', (4, 2), (4, 2), GREY_TEXT),
        ('FONTNAME', (4, 3), (4, 3), 'Helvetica-Bold'),
        ('TEXTCOLOR', (4, 3), (4, 3), colors.HexColor('#16A34A')),
        ('ALIGN', (4, 0), (4, 3), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(card_table)
    elements.append(Spacer(1, 0.35 * cm))

    # Particulars Table & Payment Details side by side in a combined grid
    part_and_pay_rows = [
        ['#', 'Particulars', 'Amount (₹)', 'Payment Details', '', ''],
    ]
    if transactions and len(transactions) > 0:
        for idx, t in enumerate(transactions, 1):
            r = getattr(t, 'fee_record', None)
            name = r.fee_type if r and getattr(r, 'fee_type', None) else 'Tuition Fee'
            t_amt = getattr(t, 'amount', 0)
            pay_m = getattr(t, 'payment_mode', 'Online')
            txn_id = getattr(t, 'transaction_id', getattr(t, 'receipt_no', f'TXN-{t.id}'))
            if idx == 1:
                part_and_pay_rows.append([str(idx), name, f"{t_amt:,.2f}", 'Payment Date', ':', paid_date_str])
            elif idx == 2:
                part_and_pay_rows.append([str(idx), name, f"{t_amt:,.2f}", 'Payment Mode', ':', pay_m])
            elif idx == 3:
                part_and_pay_rows.append([str(idx), name, f"{t_amt:,.2f}", 'Transaction ID', ':', str(txn_id)])
            elif idx == 4:
                part_and_pay_rows.append([str(idx), name, f"{t_amt:,.2f}", 'Received By', ':', 'Admin'])
            else:
                part_and_pay_rows.append([str(idx), name, f"{t_amt:,.2f}", '', '', ''])
    else:
        part_and_pay_rows.append(['1', fee_type_str, f"{total_amount:,.2f}", 'Payment Date', ':', paid_date_str])
        part_and_pay_rows.append(['', '', '', 'Payment Mode', ':', pay_mode_str])
        part_and_pay_rows.append(['', '', '', 'Transaction ID', ':', 'TXN-001'])
        part_and_pay_rows.append(['', '', '', 'Received By', ':', 'Admin'])

    # Fill payment details if less than 4 rows
    while len(part_and_pay_rows) < 5:
        idx = len(part_and_pay_rows)
        if idx == 2:
            part_and_pay_rows.append(['', '', '', 'Payment Mode', ':', pay_mode_str])
        elif idx == 3:
            part_and_pay_rows.append(['', '', '', 'Transaction ID', ':', 'TXN-001'])
        elif idx == 4:
            part_and_pay_rows.append(['', '', '', 'Received By', ':', 'Admin'])

    part_and_pay_rows.append(['', '', '', '✓ Payment Received', '', ''])
    part_and_pay_rows.append(['', 'Total Amount', f"₹ {total_amount:,.2f}", 'Thank you for your payment.', '', ''])
    part_and_pay_rows.append(['', 'Discount', '0.00', '', '', ''])
    part_and_pay_rows.append(['', 'Paid Amount', f"₹ {total_amount:,.2f}", '', '', ''])
    part_and_pay_rows.append(['', 'Balance Amount', '₹ 0.00', '', '', ''])

    combined_fin_table = Table(part_and_pay_rows, colWidths=[0.8 * cm, 6.2 * cm, 3.4 * cm, 2.6 * cm, 0.3 * cm, 4.4 * cm])
    combined_fin_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (2, 0), colors.HexColor('#F8FAFC')),
        ('FONTNAME', (0, 0), (2, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('BOX', (0, 0), (2, 4), 0.5, GREY_LINE),
        ('GRID', (0, 0), (2, 4), 0.4, colors.HexColor('#E2E8F0')),
        ('ALIGN', (0, 0), (0, 4), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (2, 1), (2, 4), 'Helvetica-Bold'),
        # Totals area
        ('BOX', (1, 5), (2, -1), 0.5, GREY_LINE),
        ('FONTNAME', (1, -1), (2, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (1, -1), (2, -1), colors.HexColor('#DCFCE7')),
        ('TEXTCOLOR', (1, -1), (2, -1), colors.HexColor('#15803D')),
        # Payment details card area
        ('SPAN', (3, 0), (-1, 0)),
        ('FONTNAME', (3, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (3, 0), (-1, 4), colors.HexColor('#F8FAFC')),
        ('BOX', (3, 0), (-1, 4), 0.5, GREY_LINE),
        ('TEXTCOLOR', (3, 1), (3, 4), GREY_TEXT),
        ('FONTNAME', (5, 1), (5, 4), 'Helvetica-Bold'),
        # Green payment confirmation
        ('SPAN', (3, 5), (-1, 5)),
        ('SPAN', (3, 6), (-1, 6)),
        ('BACKGROUND', (3, 5), (-1, 6), colors.HexColor('#DCFCE7')),
        ('BOX', (3, 5), (-1, 6), 1, colors.HexColor('#86EFAC')),
        ('ALIGN', (3, 5), (-1, 6), 'CENTER'),
        ('FONTNAME', (3, 5), (-1, 5), 'Helvetica-Bold'),
        ('TEXTCOLOR', (3, 5), (-1, 5), colors.HexColor('#16A34A')),
        ('TEXTCOLOR', (3, 6), (-1, 6), colors.HexColor('#15803D')),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(combined_fin_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  5. NOTICE PDF (Existing Functionality Preserved)
# ═══════════════════════════════════════════════════════════════════════════

def generate_student_notice_pdf(student, school, fee_records, attendance_summary, month):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)

    school_name = _esc(school.name if school and school.name else 'School')
    elements = [
        Paragraph(f"<b><font size='14' color='{NAVY_PRIMARY.hexval()}'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER)),
        Spacer(1, 0.1 * cm),
        Paragraph(f"<b>MONTHLY NOTICE — {_esc(month)}</b>", ParagraphStyle('mn', alignment=TA_CENTER, fontSize=11, fontName='Helvetica-Bold')),
        Spacer(1, 0.3 * cm),
    ]

    cls = Class.query.get(student.class_id) if student.class_id else None
    info_rows = [
        [Paragraph('Student Name', ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold')), Paragraph(_esc(student.user.name if student.user else ''), ParagraphStyle('v', fontSize=9)),
         Paragraph('Admission No', ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold')), Paragraph(_esc(student.admission_no or ''), ParagraphStyle('v', fontSize=9))],
        [Paragraph('Class', ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold')), Paragraph(_esc(f"{cls.name} - {cls.section}" if cls else ''), ParagraphStyle('v', fontSize=9)),
         Paragraph('Parent Name', ParagraphStyle('l', fontSize=9, fontName='Helvetica-Bold')), Paragraph(_esc(student.parent_name or ''), ParagraphStyle('v', fontSize=9))],
    ]
    info_table = Table(info_rows, colWidths=[3.2 * cm, 5.8 * cm, 3 * cm, 4 * cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6), ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BACKGROUND', (0, 0), (0, -1), PRIMARY_SOFT), ('BACKGROUND', (2, 0), (2, -1), PRIMARY_SOFT),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.4 * cm))

    fee_rows = [['Fee Type', 'Due (Rs.)', 'Paid (Rs.)', 'Balance (Rs.)', 'Status']]
    total_due = total_paid = 0
    for r in fee_records:
        bal = (r.amount_due or 0) - (r.amount_paid or 0)
        fee_rows.append([_esc(r.fee_type or ''), f'{r.amount_due:,.0f}', f'{r.amount_paid:,.0f}', f'{bal:,.0f}', r.status])
        total_due += r.amount_due or 0
        total_paid += r.amount_paid or 0
    if not fee_records:
        fee_rows.append(['No pending dues this month', '', '', '', ''])

    fee_table = Table(fee_rows, colWidths=[5 * cm, 3 * cm, 3 * cm, 3 * cm, 3.7 * cm])
    fee_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(fee_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_bulk_notice_pdf(students, school, month, FeeRecordModel, AttendanceModel):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                             rightMargin=1.5 * cm, leftMargin=1.5 * cm,
                             topMargin=1.2 * cm, bottomMargin=2 * cm)
    all_elements = []
    for idx, student in enumerate(students):
        fee_records = FeeRecordModel.query.filter_by(student_id=student.id, month=month).filter(FeeRecordModel.status != 'DRAFT').all()
        att_records = AttendanceModel.query.filter_by(student_id=student.id).all()
        present = sum(1 for a in att_records if a.status == 'PRESENT')
        total_m = len(att_records)
        att_summary = {'present': present, 'total': total_m, 'percentage': round(present / total_m * 100, 1) if total_m else 0}
        
        # Single page elements
        buf_single = generate_student_notice_pdf(student, school, fee_records, att_summary, month)
        # Append logic
        if idx < len(students) - 1:
            all_elements.append(PageBreak())
    doc.build(all_elements if all_elements else [Paragraph('No students found.', ParagraphStyle('n', fontSize=12))])
    buffer.seek(0)
    return buffer
