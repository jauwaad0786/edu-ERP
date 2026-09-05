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
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        # Timeout reduced to 2s for faster PDF generation
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = resp.read()
        
        # Compress: scale down + save as JPEG for minimal file size
        from PIL import Image as PILImage
        img = PILImage.open(io.BytesIO(data))
        if img.mode in ('RGBA', 'P', 'LA'):
            img = img.convert('RGB')
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Cap at 200x200 — enough for a thumbnail in a PDF card
        img.thumbnail((200, 200), getattr(PILImage, 'Resampling', PILImage).LANCZOS)
        
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=75, optimize=True)
        buf.seek(0)
        
        return RLImage(buf, width=width, height=height)
    except Exception:
        return None


def _make_qr_code(data_str, size_cm=1.8):
    """Generate in-memory QR code image for ReportLab (JPEG, small box_size)."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=2,   # smaller = fewer pixels = smaller file
            border=1
        )
        qr.add_data(data_str or 'EduERP Verified Document')
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white').convert('RGB')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85, optimize=True)
        buf.seek(0)
        return RLImage(buf, width=size_cm * cm, height=size_cm * cm)
    except Exception:
        return None


def _make_seal_stamp(text="ADMISSION\nCONFIRMED", width_cm=2.4, height_cm=2.4):
    """Generates a circular official seal as a JPEG (smaller file than RGBA PNG)."""
    try:
        from PIL import Image as PILImage, ImageDraw
        # Use RGB with white background — saves as JPEG, much smaller than RGBA PNG
        img = PILImage.new('RGB', (160, 160), (255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.ellipse([4, 4, 156, 156], outline='#1E3A8A', width=4)
        draw.ellipse([12, 12, 148, 148], outline='#1E3A8A', width=2)
        draw.text((80, 65),  "ADMISSION", fill='#1E3A8A', anchor='mm')
        draw.text((80, 90),  "CONFIRMED", fill='#1E3A8A', anchor='mm')
        draw.text((80, 42),  "★ ★ ★",    fill='#1E3A8A', anchor='mm')
        draw.text((80, 115), "★ ★ ★",    fill='#1E3A8A', anchor='mm')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80, optimize=True)
        buf.seek(0)
        return RLImage(buf, width=width_cm * cm, height=height_cm * cm)
    except Exception:
        return None


def _draw_admission_page_frame(canvas, doc):
    canvas.saveState()
    # Outer navy double frame with rounded corners
    canvas.setStrokeColor(colors.HexColor('#0B3B7B'))
    canvas.setLineWidth(1.8)
    canvas.roundRect(0.7 * cm, 0.7 * cm, doc.pagesize[0] - 1.4 * cm, doc.pagesize[1] - 1.4 * cm, 8, stroke=1, fill=0)
    canvas.setLineWidth(0.6)
    canvas.roundRect(0.85 * cm, 0.85 * cm, doc.pagesize[0] - 1.7 * cm, doc.pagesize[1] - 1.7 * cm, 6, stroke=1, fill=0)
    canvas.restoreState()


def _build_admission_confirmation_elements(student, school):
    elements = []
    
    NAVY_THEME = colors.HexColor('#0B3B7B')
    BORDER_BLUE = colors.HexColor('#93C5FD')

    school_name = _esc(getattr(school, 'name', None) or 'School Name').upper()
    school_code = _esc(getattr(school, 'code', None) or getattr(school, 'school_code', None) or f"SCH{getattr(school, 'id', 101)}")
    affiliation_str = _esc(getattr(school, 'affiliation', None) or 'AFFILIATED TO CBSE, NEW DELHI')
    addr_parts = [p for p in [getattr(school, 'address', None), getattr(school, 'city', None), getattr(school, 'pincode', None)] if p]
    addr_line = _esc(', '.join(addr_parts))
    phone_line = _esc(getattr(school, 'phone', None) or '')
    email_line = _esc(getattr(school, 'email', None) or '')
    session_str = _esc(student.session or '2024-25')

    cls = Class.query.get(student.class_id) if student.class_id else None
    cls_name = cls.name if cls else '—'
    sec_name = cls.section if cls and cls.section else (getattr(student, 'section', None) or '—')

    std_name = student.user.name if student.user else (getattr(student, 'name', '') or '—')
    adm_no = _esc(student.admission_no or f"ADM-{session_str}-001")
    adm_date_str = student.admission_date.strftime('%d-%m-%Y') if hasattr(student, 'admission_date') and student.admission_date else date.today().strftime('%d-%m-%Y')
    roll_no = _esc(student.roll_number or '—')
    dob_str = student.dob.strftime('%d-%m-%Y') if hasattr(student, 'dob') and student.dob else '—'
    gender_str = _esc(student.gender or '—')
    blood_str = _esc(getattr(student, 'blood_group', None) or '—')
    category_str = _esc(getattr(student, 'category', None) or 'General')
    nationality_str = _esc(getattr(student, 'nationality', None) or 'Indian')
    religion_str = _esc(getattr(student, 'religion', None) or '—')
    aadhar_str = _esc(getattr(student, 'aadhar_no', None) or '—')
    addr_str = _esc(student.address or '—')
    mob_str = _esc(student.parent_phone or getattr(student.user, 'phone', None) or '—')

    father_name = _esc(student.father_name or student.parent_name or '—')
    father_occ = _esc(getattr(student, 'father_occupation', None) or '—')
    mother_name = _esc(getattr(student, 'mother_name', None) or '—')
    mother_occ = _esc(getattr(student, 'mother_occupation', None) or '—')
    guardian_name = _esc(getattr(student, 'guardian_name', None) or '—')
    guardian_rel = _esc(getattr(student, 'guardian_relation', None) or '—')
    guardian_mob = _esc(getattr(student, 'guardian_phone', None) or '—')

    is_first_school = bool(getattr(student, 'is_first_school', False))
    prev_school = _esc(getattr(student, 'previous_school_name', None) or '—')
    prev_class = _esc(getattr(student, 'previous_class', None) or '—')
    prev_tc = _esc(getattr(student, 'previous_tc_no', None) or '—')
    prev_tc_date = getattr(student, 'previous_tc_date', None)
    prev_tc_date_str = prev_tc_date.strftime('%d-%m-%Y') if prev_tc_date and hasattr(prev_tc_date, 'strftime') else (str(prev_tc_date) if prev_tc_date else '—')
    prev_reason = _esc(getattr(student, 'previous_reason', None) or '—')

    # Common Header Builder
    def _create_page_header(page_badge_text):
        logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.2 * cm, 2.2 * cm)
        if not logo_img:
            logo_box = Drawing(2.2 * cm, 2.2 * cm)
            logo_box.add(Rect(0, 0, 2.2 * cm, 2.2 * cm, rx=4, ry=4, fillColor=NAVY_THEME, strokeColor=None))
            logo_box.add(String(1.1 * cm, 1.3 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=6.5, fontName='Helvetica-Bold', fillColor=colors.white))
            logo_box.add(String(1.1 * cm, 0.7 * cm, "KNOWLEDGE", textAnchor='middle', fontSize=5.5, fontName='Helvetica', fillColor=colors.white))
            logo_img = logo_box

        title_p = Paragraph(f"<b><font size='16' color='#0B3B7B'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER, leading=18))
        affil_p = Paragraph(f"<font size='8' color='#1E293B'><b>{affiliation_str} | SCHOOL CODE: {school_code}</b></font>", ParagraphStyle('sf', alignment=TA_CENTER, leading=10.5))
        
        contacts = []
        if addr_line: contacts.append(f"📍 {addr_line}")
        if phone_line: contacts.append(f"📞 {phone_line}")
        if email_line: contacts.append(f"✉ {email_line}")
        contact_p = Paragraph(f"<font size='7' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', alignment=TA_CENTER, leading=9)) if contacts else Paragraph("", ParagraphStyle('sc'))

        page_tag = Table([[page_badge_text]], colWidths=[2.0 * cm], rowHeights=[0.45 * cm])
        page_tag.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), NAVY_THEME),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        h_rows = [
            [logo_img, title_p, page_tag],
            ['', affil_p, ''],
            ['', contact_p, '']
        ]
        h_table = Table(h_rows, colWidths=[2.2 * cm, 13.1 * cm, 2.0 * cm])
        h_table.setStyle(TableStyle([
            ('SPAN', (0, 0), (0, 2)),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 0.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
        ]))
        return h_table

    # ═══════════════════════════════════════════════════════════════════════════
    # ── PAGE 1 ─────────────────────────────────────────────────────────────────
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(_create_page_header('Page 1 of 2'))
    elements.append(Spacer(1, 0.15 * cm))

    # Page 1 Ribbon Banner
    p1_banner = Table([
        ['NEW ADMISSION FORM'],
        [f"ACADEMIC SESSION: {session_str}"]
    ], colWidths=[17.3 * cm], rowHeights=[0.55 * cm, 0.42 * cm])
    p1_banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 10.5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (0, 1), 8),
        ('TEXTCOLOR', (0, 1), (0, 1), NAVY_THEME),
    ]))
    elements.append(p1_banner)
    elements.append(Spacer(1, 0.15 * cm))

    # 1. ADMISSION DETAILS Box
    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.5 * cm, 3.1 * cm)
    if not photo_img:
        photo_box = Drawing(2.5 * cm, 3.1 * cm)
        photo_box.add(Rect(0, 0, 2.5 * cm, 3.1 * cm, rx=3, ry=3, fillColor=colors.HexColor('#F1F5F9'), strokeColor=colors.HexColor('#CBD5E1'), strokeWidth=0.5))
        photo_box.add(String(1.25 * cm, 1.7 * cm, "PHOTO", textAnchor='middle', fontSize=7.5, fontName='Helvetica-Bold', fillColor=colors.HexColor('#94A3B8')))
        photo_box.add(String(1.25 * cm, 0.9 * cm, "Passport Size", textAnchor='middle', fontSize=5.5, fontName='Helvetica', fillColor=colors.HexColor('#94A3B8')))
        photo_img = photo_box

    adm_hdr = Table([['ADMISSION DETAILS']], colWidths=[17.3 * cm], rowHeights=[0.42 * cm])
    adm_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(adm_hdr)

    adm_rows = [
        ['Admission No.', ':', adm_no, 'Date of Birth', ':', dob_str, photo_img],
        ['Admission Date', ':', adm_date_str, 'Gender', ':', gender_str, ''],
        ['Class Applying For', ':', cls_name, 'Blood Group', ':', blood_str, ''],
        ['Section', ':', sec_name, 'Category', ':', category_str, ''],
        ['Roll No. (On Admission)', ':', roll_no, '', '', '', ''],
    ]
    adm_table = Table(adm_rows, colWidths=[3.2 * cm, 0.3 * cm, 4.2 * cm, 2.6 * cm, 0.3 * cm, 3.9 * cm, 2.8 * cm], rowHeights=[0.55 * cm] * 5)
    adm_table.setStyle(TableStyle([
        ('SPAN', (6, 0), (6, -1)),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.8),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#475569')),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(adm_table)
    elements.append(Spacer(1, 0.2 * cm))

    # 2. STUDENT DETAILS Box
    std_hdr = Table([['STUDENT DETAILS']], colWidths=[17.3 * cm], rowHeights=[0.42 * cm])
    std_hdr.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(std_hdr)

    std_rows = [
        ['Student Name (As per Aadhar)', ':', std_name, 'Nationality', ':', nationality_str],
        ['Aadhar No.', ':', aadhar_str, 'Religion', ':', religion_str],
        ['Address', ':', addr_str, 'Mobile No.', ':', mob_str],
    ]
    std_table = Table(std_rows, colWidths=[4.2 * cm, 0.3 * cm, 6.2 * cm, 2.0 * cm, 0.3 * cm, 4.3 * cm], rowHeights=[0.55 * cm] * 3)
    std_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.8),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#475569')),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(std_table)
    elements.append(Spacer(1, 0.2 * cm))

    # 3. Lower Section: Side-by-Side Parent Details & Previous School Details
    parent_rows = [
        ['PARENT / GUARDIAN DETAILS', ''],
        ["Father's Name", f": {father_name}"],
        ["Father's Occupation", f": {father_occ}"],
        ["Mobile No.", f": {mob_str}"],
        ["Mother's Name", f": {mother_name}"],
        ["Mother's Occupation", f": {mother_occ}"],
        ["Mobile No.", f": {mob_str}"],
        ["Guardian Name (If Any)", f": {guardian_name}"],
        ["Relation", f": {guardian_rel}"],
        ["Guardian Mobile No.", f": {guardian_mob}"],
    ]
    parent_box = Table(parent_rows, colWidths=[3.8 * cm, 4.6 * cm], rowHeights=[0.42 * cm] + [0.46 * cm] * 9)
    parent_box.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 7.5),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.5),
        ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#475569')),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, 1), (1, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))

    if is_first_school:
        prev_p = Paragraph(
            "<div align='center'><br/><br/>"
            "<b><font size='9' color='#0B3B7B'>First School Admission</font></b><br/><br/>"
            "<i><font size='8' color='#475569'>This is the student's 1st school.<br/>No previous school details applicable.</font></i>"
            "</div>",
            ParagraphStyle('fs', alignment=TA_CENTER, leading=12)
        )
        prev_rows = [
            ['PREVIOUS SCHOOL DETAILS (IF APPLICABLE)'],
            [prev_p]
        ]
        prev_box = Table(prev_rows, colWidths=[8.5 * cm], rowHeights=[0.42 * cm, 4.14 * cm])
        prev_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
            ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (0, 0), 7.5),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
            ('VALIGN', (0, 1), (0, 1), 'MIDDLE'),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#F8FAFC')),
        ]))
    else:
        prev_rows = [
            ['PREVIOUS SCHOOL DETAILS (IF APPLICABLE)', ''],
            ['Previous School Name', f": {prev_school}"],
            ['Last Class', f": {prev_class}"],
            ['TC No.', f": {prev_tc}"],
            ['TC Issuing Date', f": {prev_tc_date_str}"],
            ['Reason for Leaving', f": {prev_reason}"],
            ['', ''],
            ['', ''],
            ['', ''],
            ['', ''],
        ]
        prev_box = Table(prev_rows, colWidths=[3.7 * cm, 4.8 * cm], rowHeights=[0.42 * cm] + [0.46 * cm] * 9)
        prev_box.setStyle(TableStyle([
            ('SPAN', (0, 0), (1, 0)),
            ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (1, 0), 7.5),
            ('ALIGN', (0, 0), (1, 0), 'CENTER'),
            ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7.5),
            ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#475569')),
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
            ('TEXTCOLOR', (1, 1), (1, -1), TEXT_MAIN),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 0.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ]))

    side_split = Table([[parent_box, '', prev_box]], colWidths=[8.4 * cm, 0.4 * cm, 8.5 * cm])
    side_split.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(side_split)

    # ═══════════════════════════════════════════════════════════════════════════
    # ── PAGE BREAK TO PAGE 2 ───────────────────────────────────────────────────
    # ═══════════════════════════════════════════════════════════════════════════
    elements.append(PageBreak())

    elements.append(_create_page_header('Page 2 of 2'))
    elements.append(Spacer(1, 0.15 * cm))

    # Page 2 Ribbon Banner
    p2_banner = Table([
        ['NEW ADMISSION FORM (CONTINUED)']
    ], colWidths=[17.3 * cm], rowHeights=[0.55 * cm])
    p2_banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 10.5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(p2_banner)
    elements.append(Spacer(1, 0.2 * cm))

    # 4. Side-by-Side: Documents Submitted Checklist & Fee Details
    # Query student docs for dynamic check
    uploaded_doc_types = set()
    try:
        if student.id:
            s_docs = StudentDocument.query.filter_by(student_id=student.id).all()
            for sd in s_docs:
                uploaded_doc_types.add(sd.doc_type)
    except Exception:
        pass

    doc_list = [
        ('1.', 'Birth Certificate', ('BIRTH_CERTIFICATE' in uploaded_doc_types)),
        ('2.', 'Aadhar Card (Student)', ('AADHAR' in uploaded_doc_types or 'AADHAR_STUDENT' in uploaded_doc_types or bool(student.aadhar_no))),
        ('3.', 'Aadhar Card (Parents)', ('AADHAR_PARENT' in uploaded_doc_types or bool(student.parent_aadhar_no))),
        ('4.', 'Passport Size Photograph (2 Nos.)', bool(student.photo_url)),
        ('5.', 'Transfer Certificate (TC)', ('TRANSFER_CERTIFICATE' in uploaded_doc_types or bool(student.previous_tc_no))),
        ('6.', 'Previous Class Report Card', ('REPORT_CARD' in uploaded_doc_types)),
        ('7.', 'Address Proof', ('ADDRESS_PROOF' in uploaded_doc_types or bool(student.address))),
        ('8.', 'Caste / Category Certificate (If Applicable)', ('CASTE_CERTIFICATE' in uploaded_doc_types)),
        ('9.', 'Medical Fitness Certificate', ('MEDICAL_CERTIFICATE' in uploaded_doc_types)),
        ('10.', 'Any Other Document', ('OTHER' in uploaded_doc_types)),
    ]

    doc_rows = [
        ['DOCUMENTS SUBMITTED', '', 'Yes', 'No']
    ]
    for sno, dname, is_submitted in doc_list:
        yes_chk = '[✓]' if is_submitted else '[  ]'
        no_chk  = '[  ]' if is_submitted else '[✓]'
        doc_rows.append([f"{sno} {dname}", '', yes_chk, no_chk])

    doc_table = Table(doc_rows, colWidths=[5.4 * cm, 0.2 * cm, 1.2 * cm, 1.2 * cm], rowHeights=[0.42 * cm] + [0.46 * cm] * 10)
    doc_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#E2E8F0')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.2),
        ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#1E293B')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))

    # Dynamic Fee Items
    fee_records = []
    try:
        if student.id:
            fee_records = FeeRecord.query.filter_by(student_id=student.id).all()
    except Exception:
        pass

    default_fee_items = [
        ('1', 'Admission Fee', 5000),
        ('2', 'Registration Fee', 1000),
        ('3', 'Tuition Fee (1st Quarter)', 12000),
        ('4', 'Activity Fee', 1000),
        ('5', 'Development Fee', 2000),
        ('6', 'Smart Class Fee', 1500),
        ('7', 'Library Fee', 800),
        ('8', 'Examination Fee', 1200),
        ('9', 'Security Deposit (Refundable)', 3000),
        ('10', 'Other Charges (If Any)', 500),
    ]

    total_fee_amt = 0
    fee_rows = [
        ['S.No.', 'Particulars', 'Amount (₹)']
    ]
    if fee_records:
        for idx, fr in enumerate(fee_records[:10], 1):
            f_amt = float(fr.amount_due or fr.amount_paid or 0)
            total_fee_amt += f_amt
            f_name = fr.fee_type.replace('_', ' ').title() if fr.fee_type else 'Fee'
            fee_rows.append([str(idx), f_name, f"₹ {f_amt:,.2f}"])
        # Fill remaining up to 10 rows
        for idx in range(len(fee_records) + 1, 11):
            fee_rows.append([str(idx), '—', '—'])
    else:
        for sno, fname, famt in default_fee_items:
            total_fee_amt += famt
            fee_rows.append([sno, fname, f"₹ {famt:,.2f}"])

    fee_rows.append(['TOTAL AMOUNT', '', f"₹ {total_fee_amt:,.2f}"])

    fee_box = Table(fee_rows, colWidths=[1.1 * cm, 5.4 * cm, 2.7 * cm], rowHeights=[0.42 * cm] + [0.46 * cm] * 10 + [0.5 * cm])
    fee_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 7.5),
        ('ALIGN', (0, 0), (0, -2), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('GRID', (0, 0), (-1, -2), 0.3, colors.HexColor('#E2E8F0')),
        ('FONTNAME', (1, 1), (1, -2), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.2),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 0.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0.5),
        ('SPAN', (0, -1), (1, -1)),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF6FF')),
        ('TEXTCOLOR', (0, -1), (-1, -1), NAVY_THEME),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, -1), (1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))

    fee_doc_split = Table([[doc_table, '', fee_box]], colWidths=[8.0 * cm, 0.1 * cm, 9.2 * cm])
    fee_doc_split.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(fee_doc_split)
    elements.append(Spacer(1, 0.2 * cm))

    # 5. Bottom Row: Declaration, School Seal Stamp, and For School Use Only
    decl_p = Paragraph(
        "<div align='justify'>"
        "I / We declare that the above information provided by me / us is true and correct to the best of my / our knowledge and belief. "
        "I / We shall abide by the rules and regulations of the school."
        "<br/><br/><br/>"
        "______________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>Date :</b> " + adm_date_str + "<br/>"
        "<b>Signature of Parent / Guardian</b>"
        "</div>",
        ParagraphStyle('dcl', leading=8.5, fontSize=6.8, textColor=colors.HexColor('#1E293B'))
    )
    decl_box = Table([
        ['DECLARATION'],
        [decl_p]
    ], colWidths=[6.8 * cm], rowHeights=[0.42 * cm, 2.5 * cm])
    decl_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 7.5),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('VALIGN', (0, 1), (0, 1), 'MIDDLE'),
        ('LEFTPADDING', (0, 1), (0, 1), 4),
        ('RIGHTPADDING', (0, 1), (0, 1), 4),
    ]))

    seal_img = _make_seal_stamp("SCHOOL\nSEAL", 2.2, 2.2)

    office_rows = [
        ['FOR SCHOOL USE ONLY', ''],
        ['Verified By', ': ____________________'],
        ['Approved By', ': ____________________'],
        ['Admission Date', f": {adm_date_str}"],
        ['Remarks', ': ____________________'],
    ]
    office_box = Table(office_rows, colWidths=[2.6 * cm, 4.4 * cm], rowHeights=[0.42 * cm] + [0.55 * cm] * 4)
    office_box.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 7.5),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_BLUE),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7.2),
        ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#475569')),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, 1), (1, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))

    bottom_block = Table([[decl_box, seal_img, office_box]], colWidths=[6.8 * cm, 3.5 * cm, 7.0 * cm])
    bottom_block.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(bottom_block)

    return elements


def generate_admission_card(student, school):
    """Generate 2-Page Admission Form PDF matching exact reference layout."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.0 * cm, leftMargin=1.0 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = _build_admission_confirmation_elements(student, school)
    doc.build(elements, onFirstPage=_draw_admission_page_frame, onLaterPages=_draw_admission_page_frame)
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════════
#  2. ADMIT CARD PDF (Exact Image 2 Top-Right Replica)
# ═══════════════════════════════════════════════════════════════════════════

def _draw_admit_card_frame(canvas, doc):
    canvas.saveState()
    # Outer navy double frame with rounded corners
    canvas.setStrokeColor(colors.HexColor('#0B3B7B'))
    canvas.setLineWidth(1.8)
    canvas.roundRect(0.7 * cm, 0.7 * cm, doc.pagesize[0] - 1.4 * cm, doc.pagesize[1] - 1.4 * cm, 8, stroke=1, fill=0)
    canvas.setLineWidth(0.6)
    canvas.roundRect(0.85 * cm, 0.85 * cm, doc.pagesize[0] - 1.7 * cm, doc.pagesize[1] - 1.7 * cm, 6, stroke=1, fill=0)
    canvas.restoreState()


def _build_admit_card_elements(student, school, exam, timetable_items):
    elements = []
    
    NAVY_THEME = colors.HexColor('#0B3B7B')
    BORDER_BLUE = colors.HexColor('#93C5FD')

    school_name = _esc(getattr(school, 'name', None) or 'School Name').upper()
    school_code = _esc(getattr(school, 'code', None) or getattr(school, 'school_code', None) or f"SCH{getattr(school, 'id', 101)}")
    affiliation_str = _esc(getattr(school, 'affiliation', None) or 'AFFILIATED TO CBSE, NEW DELHI')
    addr_parts = [p for p in [getattr(school, 'address', None), getattr(school, 'city', None), getattr(school, 'pincode', None)] if p]
    addr_line = _esc(', '.join(addr_parts))
    phone_line = _esc(getattr(school, 'phone', None) or '')
    email_line = _esc(getattr(school, 'email', None) or '')
    exam_title = _esc(exam.exam_name if exam else 'ANNUAL EXAMINATION').upper()
    session_str = _esc(exam.session if exam else (getattr(student, 'session', None) or '2024-25'))

    cls = Class.query.get(student.class_id) if student.class_id else None
    cls_name = f"{cls.name} / {cls.section}".strip(' /') if cls else '—'
    cls_only = cls.name if cls else 'All Classes'
    class_banner_str = cls_only if cls_only.lower().startswith('class') else f"Class {cls_only}"
    if cls and cls.section:
        class_banner_str += f" - {cls.section}"

    # 1. School Logo
    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.5 * cm, 2.5 * cm)
    if not logo_img:
        logo_box = Drawing(2.5 * cm, 2.5 * cm)
        logo_box.add(Rect(0, 0, 2.5 * cm, 2.5 * cm, rx=4, ry=4, fillColor=NAVY_THEME, strokeColor=None))
        logo_box.add(String(1.25 * cm, 1.5 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=7.5, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_box.add(String(1.25 * cm, 0.8 * cm, "KNOWLEDGE", textAnchor='middle', fontSize=6.5, fontName='Helvetica', fillColor=colors.white))
        logo_img = logo_box

    # 2. Header Information
    title_p = Paragraph(f"<b><font size='18' color='#0B3B7B'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER, leading=21))
    affil_p = Paragraph(f"<font size='9.5' color='#1E293B'><b>{affiliation_str} | SCHOOL CODE: {school_code}</b></font>", ParagraphStyle('sf', alignment=TA_CENTER, leading=12))
    
    contacts = []
    if addr_line: contacts.append(f"📍 {addr_line}")
    if phone_line: contacts.append(f"📞 {phone_line}")
    if email_line: contacts.append(f"✉ {email_line}")
    contact_p = Paragraph(f"<font size='8.5' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', alignment=TA_CENTER, leading=11)) if contacts else Paragraph("", ParagraphStyle('sc'))

    head_rows = [
        [logo_img, title_p],
        ['', affil_p],
        ['', contact_p]
    ]
    head_table = Table(head_rows, colWidths=[2.6 * cm, 15.4 * cm])
    head_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 2)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(head_table)
    elements.append(Spacer(1, 0.2 * cm))

    # 3. ADMIT CARD Banner
    banner_table = Table([
        ['ADMIT CARD'],
        [f"{exam_title}  {session_str}"],
        [f"({class_banner_str})"]
    ], colWidths=[18.0 * cm], rowHeights=[0.68 * cm, 0.52 * cm, 0.46 * cm])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (0, 1), 10),
        ('TEXTCOLOR', (0, 1), (0, 1), NAVY_THEME),
        ('FONTNAME', (0, 2), (0, 2), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 2), (0, 2), 9),
        ('TEXTCOLOR', (0, 2), (0, 2), colors.HexColor('#475569')),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 4. Student Details Box
    std_user = getattr(student, 'user', None)
    std_name = std_user.name if std_user else (getattr(student, 'name', '') or '—')
    father_name = getattr(student, 'father_name', None) or getattr(student, 'parent_name', None) or '—'
    mother_name = getattr(student, 'mother_name', None) or '—'
    s_dob = getattr(student, 'dob', None)
    dob_str = s_dob.strftime('%d-%m-%Y') if s_dob and hasattr(s_dob, 'strftime') else (str(s_dob) if s_dob else '—')
    adm_no = getattr(student, 'admission_no', None) or getattr(student, 'admission_number', None) or '—'
    roll_no = str(getattr(student, 'roll_number', '') or '—')
    issue_date_str = date.today().strftime('%d-%m-%Y')

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.8 * cm, 3.4 * cm)
    if not photo_img:
        photo_box = Drawing(2.8 * cm, 3.4 * cm)
        photo_box.add(Rect(0, 0, 2.8 * cm, 3.4 * cm, rx=3, ry=3, fillColor=colors.HexColor('#F1F5F9'), strokeColor=colors.HexColor('#CBD5E1'), strokeWidth=0.5))
        photo_box.add(String(1.4 * cm, 1.7 * cm, "PHOTO", textAnchor='middle', fontSize=9, fontName='Helvetica-Bold', fillColor=colors.HexColor('#94A3B8')))
        photo_img = photo_box

    info_rows = [
        ['Student Name', ':', std_name, 'Date of Birth', ':', dob_str, photo_img],
        ["Father's Name", ':', father_name, 'Exam Type', ':', exam_title, ''],
        ["Mother's Name", ':', mother_name, 'School Code', ':', school_code, ''],
        ['Admission No.', ':', adm_no, 'Date of Issue', ':', issue_date_str, ''],
        ['Roll No.', ':', roll_no, '', '', '', ''],
        ['Class / Section', ':', cls_name, '', '', '', ''],
    ]
    info_table = Table(info_rows, colWidths=[3.2 * cm, 0.3 * cm, 4.5 * cm, 2.8 * cm, 0.3 * cm, 4.1 * cm, 2.8 * cm], rowHeights=[0.65 * cm] * 6)
    info_table.setStyle(TableStyle([
        ('SPAN', (6, 0), (6, -1)),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#475569')),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (2, 0), (2, -1), 9.5),
        ('FONTSIZE', (5, 0), (5, -1), 9.5),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 5. Examination Timetable Header & Table
    tt_header = Table([['EXAMINATION TIMETABLE']], colWidths=[18.0 * cm], rowHeights=[0.58 * cm])
    tt_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9.5),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(tt_header)

    tt_rows = [
        ['S.No.', 'Subject', 'Date', 'Day', 'Time', 'Venue', 'Max. Marks']
    ]

    has_tt = bool(timetable_items and len(timetable_items) > 0)
    if has_tt:
        for idx, it in enumerate(timetable_items, 1):
            sub_name = it.subject.name if hasattr(it, 'subject') and it.subject else (getattr(it, 'subject_name', '') or 'Subject')
            d_obj = it.exam_date if hasattr(it, 'exam_date') else None
            date_str = d_obj.strftime('%d-%m-%Y') if d_obj and hasattr(d_obj, 'strftime') else str(d_obj or '—')
            day_str  = d_obj.strftime('%A') if d_obj and hasattr(d_obj, 'strftime') else (getattr(it, 'day', '') or '—')
            time_str = f"{getattr(it, 'start_time', '') or '10:00 AM'} - {getattr(it, 'end_time', '') or '01:00 PM'}".strip(' -')
            max_m    = str(getattr(it, 'max_marks', 100))
            venue    = _esc(getattr(it, 'venue', '') or getattr(it, 'room', '') or getattr(it, 'room_no', '') or 'Main Hall')
            tt_rows.append([str(idx), sub_name, date_str, day_str, time_str, venue, max_m])
    else:
        tt_rows.append(['No examination timetable scheduled for this class.', '', '', '', '', '', ''])

    tt_table = Table(tt_rows, colWidths=[1.2 * cm, 4.6 * cm, 2.6 * cm, 2.4 * cm, 3.4 * cm, 2.2 * cm, 1.6 * cm])
    tt_style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if has_tt:
        tt_style.extend([
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ])
    else:
        tt_style.extend([
            ('SPAN', (0, 1), (-1, 1)),
            ('TEXTCOLOR', (0, 1), (-1, 1), GREY_TEXT),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Oblique'),
        ])
    tt_table.setStyle(TableStyle(tt_style))
    elements.append(tt_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 6. Lower Section: Side-by-Side Instructions & Principal Signature Box
    inst_p_style = ParagraphStyle(
        'ips',
        fontName='Helvetica',
        fontSize=8.0,
        leading=10.5,
        textColor=colors.HexColor('#1E293B')
    )
    inst_head_p = Paragraph("<b><font size='9' color='white'>EXAMINATION INSTRUCTIONS</font></b>", ParagraphStyle('ihs', alignment=TA_CENTER, leading=11))

    inst_rows = [
        [inst_head_p],
        [Paragraph("<b>1.</b> Bring this Admit Card along with a valid school ID to the examination centre.", inst_p_style)],
        [Paragraph("<b>2.</b> Reach the examination centre at least 30 minutes before the reporting time.", inst_p_style)],
        [Paragraph("<b>3.</b> Use only blue/black ballpoint pen for answering the paper.", inst_p_style)],
        [Paragraph("<b>4.</b> Mobile phones, smart watches, calculators and electronic gadgets are strictly prohibited.", inst_p_style)],
        [Paragraph("<b>5.</b> Do not carry any study material, notes or written/printed chits.", inst_p_style)],
        [Paragraph("<b>6.</b> Follow all instructions given by the invigilator and maintain strict discipline.", inst_p_style)]
    ]
    inst_table = Table(inst_rows, colWidths=[10.8 * cm], rowHeights=[0.55 * cm] + [0.52 * cm] * 6)
    inst_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 1), (-1, -1), 6),
        ('RIGHTPADDING', (0, 1), (-1, -1), 6),
    ]))

    principal_name = _esc(getattr(school, 'principal_name', None) or '')
    p_name_line = f"<br/><font size='8' color='#64748B'>({principal_name})</font>" if principal_name else ""
    
    principal_sig_p = Paragraph(
        "<div align='center'>"
        "<br/><br/><br/><br/>"
        "____________________________<br/>"
        f"<b><font size='9.5' color='#0B3B7B'>Principal Signature</font></b>{p_name_line}"
        "</div>",
        ParagraphStyle('ps', alignment=TA_CENTER, leading=12)
    )

    right_box = Table([[principal_sig_p]], colWidths=[6.8 * cm], rowHeights=[3.67 * cm])
    right_box.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))

    side_block = Table([[inst_table, '', right_box]], colWidths=[10.8 * cm, 0.4 * cm, 6.8 * cm])
    side_block.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(side_block)
    elements.append(Spacer(1, 0.35 * cm))

    # 7. Footer: Date, Place & Candidate Sign
    place_str = _esc(getattr(school, 'city', None) or 'School Campus')
    foot_date_p = Paragraph(
        f"<b><font size='9' color='#0F172A'>Date :</font></b> <font size='9' color='#334155'>{issue_date_str}</font><br/>"
        f"<b><font size='9' color='#0F172A'>Place :</font></b> <font size='9' color='#334155'>{place_str}</font>",
        ParagraphStyle('fl', leading=13)
    )
    foot_cand_p = Paragraph(
        "____________________________<br/>"
        "<b><font size='9' color='#0F172A'>Student Signature</font></b>",
        ParagraphStyle('cs', alignment=TA_CENTER, leading=13)
    )
    foot_invig_p = Paragraph(
        "____________________________<br/>"
        "<b><font size='9' color='#0F172A'>Center Superintendent</font></b>",
        ParagraphStyle('is', alignment=TA_RIGHT, leading=13)
    )

    foot_table = Table([[foot_date_p, foot_cand_p, foot_invig_p]], colWidths=[5.4 * cm, 6.3 * cm, 6.3 * cm])
    foot_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(foot_table)

    return elements


def generate_admit_card(student, school, exam, timetable_items):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=0.9 * cm, leftMargin=0.9 * cm,
        topMargin=0.9 * cm, bottomMargin=0.9 * cm
    )
    elements = _build_admit_card_elements(student, school, exam, timetable_items)
    doc.build(elements, onFirstPage=_draw_admit_card_frame)
    buffer.seek(0)
    return buffer


def generate_bulk_admit_cards(student_timetable_pairs, school, exam):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=0.9 * cm, leftMargin=0.9 * cm,
        topMargin=0.9 * cm, bottomMargin=0.9 * cm
    )
    all_elements = []
    for i, (student, timetable) in enumerate(student_timetable_pairs):
        elems = _build_admit_card_elements(student, school, exam, timetable)
        all_elements.extend(elems)
        if i < len(student_timetable_pairs) - 1:
            all_elements.append(PageBreak())
    if not all_elements:
        all_elements = [Paragraph('No students found for admit cards.', ParagraphStyle('none', fontSize=12))]
    doc.build(all_elements, onFirstPage=_draw_admit_card_frame, onLaterPages=_draw_admit_card_frame)
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
    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 2.5 * cm, 2.5 * cm)
    if not logo_img:
        logo_box = Drawing(2.5 * cm, 2.5 * cm)
        logo_box.add(Rect(0, 0, 2.5 * cm, 2.5 * cm, rx=4, ry=4, fillColor=NAVY_THEME, strokeColor=None))
        logo_box.add(String(1.25 * cm, 1.5 * cm, "★ SCHOOL ★", textAnchor='middle', fontSize=7.5, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_box.add(String(1.25 * cm, 0.8 * cm, "KNOWLEDGE", textAnchor='middle', fontSize=6.5, fontName='Helvetica', fillColor=colors.white))
        logo_img = logo_box

    # 2. Header Information
    title_p = Paragraph(f"<b><font size='18' color='#0B3B7B'>{school_name}</font></b>", ParagraphStyle('sn', alignment=TA_CENTER, leading=21))
    affil_p = Paragraph(f"<font size='9.5' color='#1E293B'><b>{affiliation_str} | SCHOOL CODE: {school_code}</b></font>", ParagraphStyle('sf', alignment=TA_CENTER, leading=12))
    addr_p = Paragraph(f"<font size='8.5' color='#475569'>📍 {addr_line}</font>", ParagraphStyle('sa', alignment=TA_CENTER, leading=11)) if addr_line else Paragraph("", ParagraphStyle('sa'))
    
    contacts = []
    if phone_line: contacts.append(f"📞 {phone_line}")
    if email_line: contacts.append(f"✉ {email_line}")
    contact_p = Paragraph(f"<font size='8.5' color='#334155'>{'   |   '.join(contacts)}</font>", ParagraphStyle('sc', alignment=TA_CENTER, leading=11)) if contacts else Paragraph("", ParagraphStyle('sc'))

    head_rows = [
        [logo_img, title_p],
        ['', affil_p],
        ['', addr_p],
        ['', contact_p]
    ]
    head_table = Table(head_rows, colWidths=[2.6 * cm, 15.4 * cm])
    head_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (0, 3)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))
    elements.append(head_table)
    elements.append(Spacer(1, 0.3 * cm))

    # 3. MARK SHEET Banner with decorative bar
    banner_table = Table([
        ['MARK SHEET'],
        [f"{exam_title}  {session_str}"]
    ], colWidths=[18.0 * cm], rowHeights=[0.68 * cm, 0.52 * cm])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (0, 0), 12),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (0, 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 1), (0, 1), 10),
        ('TEXTCOLOR', (0, 1), (0, 1), NAVY_THEME),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 0.35 * cm))

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

    photo_img = _fetch_remote_image(getattr(student, 'photo_url', None), 2.8 * cm, 3.4 * cm)
    if not photo_img:
        photo_box = Drawing(2.8 * cm, 3.4 * cm)
        photo_box.add(Rect(0, 0, 2.8 * cm, 3.4 * cm, rx=3, ry=3, fillColor=colors.HexColor('#F1F5F9'), strokeColor=colors.HexColor('#CBD5E1'), strokeWidth=0.5))
        photo_box.add(String(1.4 * cm, 1.7 * cm, "PHOTO", textAnchor='middle', fontSize=9, fontName='Helvetica-Bold', fillColor=colors.HexColor('#94A3B8')))
        photo_img = photo_box

    info_rows = [
        ['Student Name', ':', std_name, 'Date of Birth', ':', dob_str, photo_img],
        ["Father's Name", ':', father_name, 'Session', ':', session_str, ''],
        ["Mother's Name", ':', mother_name, 'Exam Type', ':', exam_title, ''],
        ['Admission No.', ':', adm_no, 'School Code', ':', school_code, ''],
        ['Roll No.', ':', roll_no, 'Date of Result', ':', result_date_str, ''],
        ['Class / Section', ':', cls_name, '', '', '', ''],
    ]
    info_table = Table(info_rows, colWidths=[3.0 * cm, 0.3 * cm, 4.6 * cm, 2.9 * cm, 0.3 * cm, 4.1 * cm, 2.8 * cm], rowHeights=[0.65 * cm] * 6)
    info_table.setStyle(TableStyle([
        ('SPAN', (6, 0), (6, -1)),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#475569')),
        ('TEXTCOLOR', (3, 0), (3, -1), colors.HexColor('#475569')),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTNAME', (5, 0), (5, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (2, 0), (2, -1), 9.5),
        ('FONTSIZE', (5, 0), (5, -1), 9.5),
        ('TEXTCOLOR', (2, 0), (2, -1), TEXT_MAIN),
        ('TEXTCOLOR', (5, 0), (5, -1), TEXT_MAIN),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (6, 0), (6, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.35 * cm))

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

    marks_table = Table(marks_rows, colWidths=[1.3 * cm, 5.7 * cm, 2.7 * cm, 2.9 * cm, 3.0 * cm, 2.4 * cm])
    m_style = [
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    if has_marks:
        m_style.extend([
            ('SPAN', (0, -1), (1, -1)),
            ('BACKGROUND', (0, -1), (-1, -1), LIGHT_BG),
            ('TEXTCOLOR', (0, -1), (-1, -1), NAVY_THEME),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 9.5),
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
    elements.append(Spacer(1, 0.4 * cm))

    # 6. Side-by-Side Lower Cards: PERFORMANCE SUMMARY & GRADE SCALE
    tot_obt_display = str(int(tot_obt)) if isinstance(tot_obt, float) and tot_obt.is_integer() else (f"{tot_obt:.1f}" if has_marks else '0')
    perf_rows = [
        ['PERFORMANCE SUMMARY', ''],
        ['Total Marks', f":  {tot_max}"],
        ['Marks Obtained', f":  {tot_obt_display}"],
        ['Percentage', f":  {overall_pct:.2f} %" if has_marks else ':  —'],
        ['Overall Grade', f":  {overall_grade}"],
        ['Result', f":  {overall_status}"],
    ]
    perf_table = Table(perf_rows, colWidths=[4.6 * cm, 4.2 * cm], rowHeights=[0.6 * cm, 0.55 * cm, 0.55 * cm, 0.55 * cm, 0.55 * cm, 0.55 * cm])
    perf_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 9.5),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#0F172A')),
        ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (1, 1), (1, -1), 9.5),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#16A34A') if overall_status == 'PASS' else (colors.HexColor('#DC2626') if overall_status == 'FAIL' else TEXT_MAIN)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
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
    scale_table = Table(scale_rows, colWidths=[5.6 * cm, 3.2 * cm], rowHeights=[0.58 * cm, 0.44 * cm] + [0.38 * cm] * 7)
    scale_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), NAVY_THEME),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (1, 0), 9.5),
        ('ALIGN', (0, 0), (1, 0), 'CENTER'),
        ('BACKGROUND', (0, 1), (1, 1), LIGHT_BG),
        ('FONTNAME', (0, 1), (1, 1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (0, 1), (1, 1), NAVY_THEME),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('BOX', (0, 0), (-1, -1), 0.9, BORDER_BLUE),
        ('GRID', (0, 1), (-1, -1), 0.3, colors.HexColor('#E2E8F0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
    ]))

    side_cards = Table([[perf_table, '', scale_table]], colWidths=[8.8 * cm, 0.4 * cm, 8.8 * cm])
    side_cards.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(side_cards)
    elements.append(Spacer(1, 0.6 * cm))

    # 7. Footer: Date, Place & Dual Signatures (Class Teacher + Principal)
    place_str = _esc(getattr(school, 'city', None) or 'School Campus')
    foot_para_left = Paragraph(
        f"<font size='9' color='#0F172A'>"
        f"<b>Date :</b> {result_date_str}<br/>"
        f"<b>Place :</b> {place_str}"
        f"</font>",
        ParagraphStyle('fl', leading=13)
    )

    teacher_sig = Paragraph(
        "<font size='9' color='#475569'>"
        "____________________________<br/>"
        "<b>Class Teacher</b>"
        "</font>",
        ParagraphStyle('ts', alignment=TA_CENTER, leading=12)
    )

    principal_name = _esc(getattr(school, 'principal_name', None) or '')
    p_name_line = f"<br/>({principal_name})" if principal_name else ""
    principal_sig = Paragraph(
        f"<font size='9' color='#0B3B7B'>"
        f"____________________________<br/>"
        f"<b>Principal Signature</b>{p_name_line}"
        f"</font>",
        ParagraphStyle('ps', alignment=TA_CENTER, leading=12)
    )

    foot_table = Table([[foot_para_left, teacher_sig, principal_sig]], colWidths=[5.6 * cm, 6.2 * cm, 6.2 * cm])
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
        rightMargin=0.9 * cm, leftMargin=0.9 * cm,
        topMargin=0.9 * cm, bottomMargin=0.9 * cm
    )
    elements = _build_result_card_elements(student, school, exam, marks_data, prev_marks_data=prev_marks_data, version_number=version_number)
    doc.build(elements, onFirstPage=_draw_marksheet_frame)
    buffer.seek(0)
    return buffer


def generate_bulk_result_cards(student_marks_tuples, school, exam, version_number=1):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=0.9 * cm, leftMargin=0.9 * cm,
        topMargin=0.9 * cm, bottomMargin=0.9 * cm
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
            cov_lbl = getattr(r, 'coverage_label', None) if r else None
            freq = getattr(r, 'billing_frequency', None) if r else None
            if cov_lbl:
                freq_str = f" • {freq.replace('_', ' ').title()}" if freq and freq != 'MONTHLY' else ""
                name = f"{name} ({cov_lbl}{freq_str})"
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
        # Compute attendance count via SQL count instead of loading all historic records into RAM
        total_m = AttendanceModel.query.filter_by(student_id=student.id).count()
        present = AttendanceModel.query.filter_by(student_id=student.id, status='PRESENT').count()
        att_summary = {'present': present, 'total': total_m, 'percentage': round(present / total_m * 100, 1) if total_m else 0}
        
        # Single page elements
        buf_single = generate_student_notice_pdf(student, school, fee_records, att_summary, month)
        # Append logic
        if idx < len(students) - 1:
            all_elements.append(PageBreak())
    doc.build(all_elements if all_elements else [Paragraph('No students found.', ParagraphStyle('n', fontSize=12))])
    buffer.seek(0)
    return buffer


def generate_fee_collection_report_pdf(school, summary, transactions_or_records, report_title="Fee Collection & Revenue Report", subtitle=""):
    """
    Generates an executive-ready Fee Collection Report PDF with metrics,
    payment mode distribution, and transaction statement table.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm
    )
    elements = []

    # 1. School Header & Logo
    logo_img = _fetch_remote_image(getattr(school, 'logo_url', None), 1.8 * cm, 1.8 * cm)
    if not logo_img:
        logo_box = Drawing(1.8 * cm, 1.8 * cm)
        logo_box.add(Rect(0, 0, 1.8 * cm, 1.8 * cm, rx=4, ry=4, fillColor=NAVY_HEADER, strokeColor=None))
        logo_box.add(String(0.9 * cm, 0.9 * cm, "★ ERP ★", textAnchor='middle', fontSize=7, fontName='Helvetica-Bold', fillColor=colors.white))
        logo_img = logo_box

    school_name = _esc(getattr(school, 'name', 'Educational Institution'))
    school_address = _esc(getattr(school, 'address', '') or getattr(school, 'city', '') or '')
    contact_str = f"Phone: {_esc(getattr(school, 'phone', '—'))} | Email: {_esc(getattr(school, 'email', '—'))}"

    header_table = Table([
        [
            logo_img,
            [
                Paragraph(f"<b><font size='13' color='{NAVY_PRIMARY.hexval()}'>{school_name}</font></b>", ParagraphStyle('sh', leading=15)),
                Paragraph(f"<font size='8' color='#64748B'>{school_address}</font>", ParagraphStyle('sa', leading=10)),
                Paragraph(f"<font size='7.5' color='#64748B'>{contact_str}</font>", ParagraphStyle('sc', leading=10)),
            ],
            [
                Paragraph(f"<b><font size='11' color='{NAVY_HEADER.hexval()}'>FINANCIAL REPORT</font></b>", ParagraphStyle('rh', alignment=TA_RIGHT, leading=13)),
                Paragraph(f"<font size='8' color='#475569'><b>Generated:</b> {datetime.now().strftime('%d %b %Y, %I:%M %p')}</font>", ParagraphStyle('rg', alignment=TA_RIGHT, leading=10)),
                Paragraph(f"<font size='8' color='#16A34A'><b>Status:</b> Verified Ledger</font>", ParagraphStyle('rv', alignment=TA_RIGHT, leading=10)),
            ]
        ]
    ], colWidths=[2.0 * cm, 10.5 * cm, 6.0 * cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 0.2 * cm))

    # Divider bar
    divider = Drawing(18.5 * cm, 2)
    divider.add(Line(0, 1, 18.5 * cm, 1, strokeColor=NAVY_HEADER, strokeWidth=1.5))
    elements.append(divider)
    elements.append(Spacer(1, 0.25 * cm))

    # 2. Report Title Bar
    title_text = _esc(report_title)
    sub_text = _esc(subtitle or f"Academic Period: {getattr(school, 'session', '2024-25')}")
    title_bar = Table([
        [
            Paragraph(f"<b><font size='12' color='#0F172A'>{title_text}</font></b><br/><font size='8.5' color='#64748B'>{sub_text}</font>", ParagraphStyle('rtb', leading=13))
        ]
    ], colWidths=[18.5 * cm])
    title_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), PRIMARY_SOFT),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#BFDBFE')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(title_bar)
    elements.append(Spacer(1, 0.35 * cm))

    # 3. Financial KPI Metric Summary Cards
    tot_billed = float(summary.get('total_billed', summary.get('total_due', 0)) or 0)
    tot_collected = float(summary.get('total_collected', summary.get('total_paid', 0)) or 0)
    tot_pending = float(summary.get('total_pending', max(0, tot_billed - tot_collected)) or 0)
    col_rate = round((tot_collected / tot_billed * 100), 1) if tot_billed > 0 else 100.0

    kpi_table = Table([
        [
            Paragraph(f"<font size='8' color='#64748B'><b>TOTAL BILLED / DUE</b></font><br/><b><font size='13' color='{NAVY_HEADER.hexval()}'>₹{tot_billed:,.2f}</font></b>", ParagraphStyle('k1', leading=15, alignment=TA_CENTER)),
            Paragraph(f"<font size='8' color='#16A34A'><b>TOTAL COLLECTED</b></font><br/><b><font size='13' color='#16A34A'>₹{tot_collected:,.2f}</font></b>", ParagraphStyle('k2', leading=15, alignment=TA_CENTER)),
            Paragraph(f"<font size='8' color='#DC2626'><b>OUTSTANDING DUES</b></font><br/><b><font size='13' color='#DC2626'>₹{tot_pending:,.2f}</font></b>", ParagraphStyle('k3', leading=15, alignment=TA_CENTER)),
            Paragraph(f"<font size='8' color='#0891B2'><b>COLLECTION RATE</b></font><br/><b><font size='13' color='#0891B2'>{col_rate}%</font></b>", ParagraphStyle('k4', leading=15, alignment=TA_CENTER)),
        ]
    ], colWidths=[4.625 * cm, 4.625 * cm, 4.625 * cm, 4.625 * cm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 0.4 * cm))

    # 4. Detailed Collection Statement Table
    table_headers = [
        Paragraph("<b>#</b>", ParagraphStyle('th0', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Receipt #</b>", ParagraphStyle('th1', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph("<b>Student Name</b>", ParagraphStyle('th2', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph("<b>Class / Roll</b>", ParagraphStyle('th3', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph("<b>Fee Category</b>", ParagraphStyle('th4', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white)),
        Paragraph("<b>Mode</b>", ParagraphStyle('th5', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Date</b>", ParagraphStyle('th6', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Amount (₹)</b>", ParagraphStyle('th7', fontSize=8, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_RIGHT)),
    ]

    rows = [table_headers]
    for idx, r in enumerate(transactions_or_records[:350], 1):
        amt = float(r.get('amount', r.get('amount_paid', 0)) or 0)
        mode = _esc(r.get('payment_mode', r.get('mode', 'CASH')) or 'CASH')
        rcpt = _esc(r.get('receipt_no', f"RCPT-{idx:04d}") or '—')
        st_name = _esc(r.get('student_name', r.get('name', 'Student')))
        cls_info = _esc(r.get('class_name', r.get('roll_number', '—')) or '—')
        fee_type = _esc(r.get('fee_type', r.get('category', 'TUITION')) or 'TUITION')
        dt_str = _esc(r.get('paid_date', r.get('date', r.get('transaction_date', '—'))) or '—')

        rows.append([
            Paragraph(f"<font size='7.5'>{idx}</font>", ParagraphStyle('td0', alignment=TA_CENTER)),
            Paragraph(f"<font size='7.5' color='#0F172A'><b>{rcpt}</b></font>", ParagraphStyle('td1')),
            Paragraph(f"<font size='7.5' color='#0F172A'>{st_name}</font>", ParagraphStyle('td2')),
            Paragraph(f"<font size='7.5' color='#64748B'>{cls_info}</font>", ParagraphStyle('td3')),
            Paragraph(f"<font size='7.5'>{fee_type}</font>", ParagraphStyle('td4')),
            Paragraph(f"<font size='7.5' color='#2563EB'>{mode}</font>", ParagraphStyle('td5', alignment=TA_CENTER)),
            Paragraph(f"<font size='7.5' color='#64748B'>{dt_str}</font>", ParagraphStyle('td6', alignment=TA_CENTER)),
            Paragraph(f"<b><font size='7.5' color='#16A34A'>₹{amt:,.2f}</font></b>", ParagraphStyle('td7', alignment=TA_RIGHT)),
        ])

    if len(rows) == 1:
        rows.append([Paragraph("<font size='8' color='#94A3B8'>No fee transactions recorded for this period</font>", ParagraphStyle('nd', alignment=TA_CENTER))] + [''] * 7)

    item_table = Table(rows, colWidths=[0.8 * cm, 2.7 * cm, 4.0 * cm, 2.5 * cm, 2.5 * cm, 1.8 * cm, 2.2 * cm, 2.0 * cm])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, GREY_LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
    ]))
    elements.append(item_table)
    elements.append(Spacer(1, 0.6 * cm))

    # 5. Signatures & Audit Stamp
    sig_table = Table([
        [
            Paragraph("<font size='7.5' color='#64748B'>Generated via Central Finance Module<br/>System Audit Verified: OK</font>", ParagraphStyle('s1')),
            Paragraph("<b><font size='8' color='#0F172A'>Prepared by: Accounts Officer</font></b><br/><font size='7.5' color='#64748B'>Signature: __________________</font>", ParagraphStyle('s2', alignment=TA_CENTER)),
            Paragraph("<b><font size='8' color='#0F172A'>Authorized: Principal / Director</font></b><br/><font size='7.5' color='#64748B'>Official Stamp &amp; Sign</font>", ParagraphStyle('s3', alignment=TA_RIGHT)),
        ]
    ], colWidths=[6.0 * cm, 6.5 * cm, 6.0 * cm])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(sig_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
