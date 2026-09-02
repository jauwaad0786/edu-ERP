"""
ReportLab Professional Payslip Generator for School HRMS
OnePlatform360 / EduERP

Generates formal, printable, beautiful A4 PDF payslips with:
- School Branding (Logo, Name, Address, Affiliation, Session)
- Employee Details Grid (Employee ID, Name, Role, Department, Designation, PAN, UAN, Bank Account, Joining Date)
- Monthly Attendance Summary (Payable Days, Working Days, Present, LOP, Paid Leaves, Weekly Offs, Holidays)
- Side-by-side Earnings & Deductions Table
- Net Salary Calculation (in numeric INR and Currency in Words)
- Authentication Barcode/QR and Signatures
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage, KeepTogether, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Circle, String, Rect, Group, Line
from xml.sax.saxutils import escape as _xml_escape
import io
import urllib.request, tempfile
import qrcode
from datetime import datetime, date

# ── Color Palette ─────────────────────────────────────────────────────────────
NAVY_PRIMARY = colors.HexColor('#0F2942')   # Deep navy
NAVY_HEADER  = colors.HexColor('#1E3A8A')   # Royal blue
PRIMARY      = colors.HexColor('#1D4ED8')   # Main blue
PRIMARY_SOFT = colors.HexColor('#EFF6FF')   # Soft blue
SUCCESS_DARK = colors.HexColor('#15803D')   # Forest green
SUCCESS_SOFT = colors.HexColor('#DCFCE7')   # Soft green
DANGER_DARK  = colors.HexColor('#B91C1C')   # Deep red
DANGER_SOFT  = colors.HexColor('#FEF2F2')   # Soft red
GREY_LINE    = colors.HexColor('#CBD5E1')   # Border grey
GREY_LIGHT   = colors.HexColor('#F8FAFC')   # Light table bg
GREY_TEXT    = colors.HexColor('#475569')
TEXT_MAIN    = colors.HexColor('#0F172A')

def _esc(text):
    return _xml_escape(str(text or ''))

def _num_to_words_inr(num):
    try:
        n = int(round(float(num)))
    except Exception:
        return 'Zero Rupees Only'
    if n <= 0:
        return 'Zero Rupees Only'
    
    units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
             'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
             'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    def two_digits(val):
        if val < 20:
            return units[val]
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


def generate_payslip_pdf(payroll_slip, school, employee_profile=None):
    """
    Generates an in-memory PDF buffer for an employee payslip.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    story = []

    # ── Typography Styles ──
    title_style = ParagraphStyle(
        'SchoolTitle',
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=NAVY_PRIMARY,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        'SchoolSubtitle',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=GREY_TEXT,
        alignment=TA_CENTER,
    )
    badge_style = ParagraphStyle(
        'PayslipBadge',
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=PRIMARY,
        alignment=TA_CENTER,
    )
    label_style = ParagraphStyle(
        'FieldLabel',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=GREY_TEXT,
    )
    val_style = ParagraphStyle(
        'FieldValue',
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MAIN,
    )
    th_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    th_right_style = ParagraphStyle(
        'TableHeaderRight',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
        alignment=TA_RIGHT,
    )
    td_style = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=TEXT_MAIN,
    )
    td_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MAIN,
    )
    td_right = ParagraphStyle(
        'TableCellRight',
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=TEXT_MAIN,
        alignment=TA_RIGHT,
    )
    td_bold_right = ParagraphStyle(
        'TableCellBoldRight',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MAIN,
        alignment=TA_RIGHT,
    )

    # ── 1. HEADER SECTION ──
    logo_img = None
    if school and getattr(school, 'logo_url', None):
        try:
            with urllib.request.urlopen(school.logo_url, timeout=3) as resp:
                tf = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                tf.write(resp.read())
                tf.flush()
                logo_img = RLImage(tf.name, width=1.6 * cm, height=1.6 * cm)
        except Exception:
            logo_img = None

    school_name = school.name if school else 'School Name'
    school_addr = (
        f"{school.address or ''}, {school.city or ''}, {school.state or ''} - {school.pincode or ''}".strip(' ,-')
        if school else ''
    )
    school_contact = (
        f"Phone: {school.phone or 'N/A'} | Email: {school.email or 'N/A'}"
        if school else ''
    )

    header_text_cells = [
        Paragraph(f"<b>{_esc(school_name.upper())}</b>", title_style),
        Paragraph(_esc(school_addr), subtitle_style),
        Paragraph(_esc(school_contact), subtitle_style),
        Spacer(1, 2 * mm),
        Paragraph(f"<b>SALARY SLIP FOR THE MONTH OF {payroll_slip.payroll_run.month_name.upper()}</b>", badge_style),
    ]

    if logo_img:
        header_table = Table([[logo_img, header_text_cells]], colWidths=[2.2 * cm, 15.8 * cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,0), 'CENTER'),
        ]))
        story.append(header_table)
    else:
        for p in header_text_cells:
            story.append(p)

    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=1, spaceAfter=4))

    # ── 2. EMPLOYEE DETAILS & ATTENDANCE SUMMARY GRID ──
    u = payroll_slip.user
    emp_id = getattr(u, 'employee_id', '') or ''
    emp_name = u.name if u else ''
    designation = getattr(u, 'designation', '') or 'Staff'
    department = getattr(u, 'department', '') or 'General'
    joining_date = ''
    bank_acc = ''
    ifsc = ''
    pan = ''
    uan = ''

    if employee_profile:
        joining_date = employee_profile.joining_date.strftime('%d-%b-%Y') if employee_profile.joining_date else ''
        bank_acc = f"{employee_profile.bank_name or 'Bank'} - {employee_profile.account_number or 'N/A'}"
        ifsc = employee_profile.ifsc_code or 'N/A'
        pan = employee_profile.pan_number or 'N/A'
        uan = employee_profile.uan_number or 'N/A'

    emp_info_data = [
        [
            Paragraph("<b>Employee ID:</b>", label_style), Paragraph(_esc(emp_id), val_style),
            Paragraph("<b>Pay Period:</b>", label_style), Paragraph(_esc(payroll_slip.payroll_run.month_name), val_style),
        ],
        [
            Paragraph("<b>Employee Name:</b>", label_style), Paragraph(f"<b>{_esc(emp_name)}</b>", val_style),
            Paragraph("<b>Total Calendar Days:</b>", label_style), Paragraph(str(payroll_slip.calendar_days or 30), val_style),
        ],
        [
            Paragraph("<b>Designation:</b>", label_style), Paragraph(_esc(designation), val_style),
            Paragraph("<b>Payable Days:</b>", label_style), Paragraph(f"<b>{payroll_slip.payable_days}</b>", val_style),
        ],
        [
            Paragraph("<b>Department:</b>", label_style), Paragraph(_esc(department), val_style),
            Paragraph("<b>Present / Worked:</b>", label_style), Paragraph(f"{payroll_slip.present_days} Days ({payroll_slip.half_days} Half-Day)", val_style),
        ],
        [
            Paragraph("<b>Bank Account:</b>", label_style), Paragraph(_esc(bank_acc or 'N/A'), val_style),
            Paragraph("<b>Approved Paid Leaves:</b>", label_style), Paragraph(f"{payroll_slip.paid_leave_days} Days", val_style),
        ],
        [
            Paragraph("<b>IFSC Code:</b>", label_style), Paragraph(_esc(ifsc or 'N/A'), val_style),
            Paragraph("<b>Loss of Pay (Unpaid/Absent):</b>", label_style), Paragraph(f"<b>{round((payroll_slip.unpaid_leave_days or 0) + (payroll_slip.absent_days or 0), 1)} Days</b>", val_style),
        ],
        [
            Paragraph("<b>PAN / UAN:</b>", label_style), Paragraph(f"{pan} / {uan}", val_style),
            Paragraph("<b>Weekly Offs / Holidays:</b>", label_style), Paragraph(f"{payroll_slip.weekly_off_days} Offs / {payroll_slip.holiday_days} Holidays", val_style),
        ]
    ]

    emp_table = Table(emp_info_data, colWidths=[3.2 * cm, 5.8 * cm, 3.8 * cm, 5.2 * cm])
    emp_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GREY_LIGHT),
        ('BOX', (0,0), (-1,-1), 0.75, GREY_LINE),
        ('INNERGRID', (0,0), (-1,-1), 0.5, GREY_LINE),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(emp_table)
    story.append(Spacer(1, 4 * mm))

    # ── 3. EARNINGS & DEDUCTIONS BREAKDOWN ──
    # Construct rows side by side
    earnings_rows = [
        ("Basic Salary", payroll_slip.basic_pay or 0.0),
        ("House Rent Allowance (HRA)", payroll_slip.hra or 0.0),
        ("Dearness Allowance (DA)", payroll_slip.da or 0.0),
        ("Transport Allowance (TA)", payroll_slip.ta or 0.0),
        ("Special Allowance", payroll_slip.special_allowance or 0.0),
        ("Other Allowances", payroll_slip.other_allowances or 0.0),
    ]
    # Filter only positive allowances or basic
    earnings_rows = [(k, v) for (k, v) in earnings_rows if v > 0 or k == "Basic Salary"]

    deduction_rows = [
        ("Loss of Pay (LOP) Deduction", payroll_slip.lop_deduction or 0.0),
        ("Provident Fund (PF)", payroll_slip.pf_deduction or 0.0),
        ("Employee State Insurance (ESI)", payroll_slip.esi_deduction or 0.0),
        ("Professional Tax (PT)", payroll_slip.prof_tax or 0.0),
        ("Tax Deducted at Source (TDS)", payroll_slip.tds or 0.0),
        ("Other Deductions / Advances", payroll_slip.other_deductions or 0.0),
    ]
    deduction_rows = [(k, v) for (k, v) in deduction_rows if v > 0]

    max_rows = max(len(earnings_rows), len(deduction_rows), 4)

    # Pad with blanks if unbalanced
    while len(earnings_rows) < max_rows:
        earnings_rows.append(("", ""))
    while len(deduction_rows) < max_rows:
        deduction_rows.append(("", ""))

    table_data = [
        [
            Paragraph("<b>EARNINGS</b>", th_style),
            Paragraph("<b>AMOUNT (₹)</b>", th_right_style),
            Paragraph("<b>DEDUCTIONS</b>", th_style),
            Paragraph("<b>AMOUNT (₹)</b>", th_right_style),
        ]
    ]

    for i in range(max_rows):
        e_name, e_val = earnings_rows[i]
        d_name, d_val = deduction_rows[i]

        e_val_str = f"{e_val:,.2f}" if isinstance(e_val, (int, float)) else ""
        d_val_str = f"{d_val:,.2f}" if isinstance(d_val, (int, float)) else ""

        table_data.append([
            Paragraph(_esc(e_name), td_style),
            Paragraph(e_val_str, td_right),
            Paragraph(_esc(d_name), td_style),
            Paragraph(d_val_str, td_right),
        ])

    # Totals Row
    table_data.append([
        Paragraph("<b>Total Gross Earnings (A)</b>", td_bold),
        Paragraph(f"<b>₹ {payroll_slip.gross_salary:,.2f}</b>", td_bold_right),
        Paragraph("<b>Total Deductions (B)</b>", td_bold),
        Paragraph(f"<b>₹ {payroll_slip.total_deductions:,.2f}</b>", td_bold_right),
    ])

    salary_table = Table(table_data, colWidths=[5.5 * cm, 3.5 * cm, 5.5 * cm, 3.5 * cm])
    salary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (1,0), NAVY_HEADER),
        ('BACKGROUND', (2,0), (3,0), DANGER_DARK),
        ('BOX', (0,0), (-1,-1), 1, GREY_LINE),
        ('INNERGRID', (0,0), (-1,-1), 0.5, GREY_LINE),
        ('BACKGROUND', (0,-1), (1,-1), PRIMARY_SOFT),
        ('BACKGROUND', (2,-1), (3,-1), DANGER_SOFT),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(salary_table)
    story.append(Spacer(1, 4 * mm))

    # ── 4. NET PAY HIGHLIGHT BOX ──
    net_in_words = _num_to_words_inr(payroll_slip.net_salary)
    net_box_data = [
        [
            Paragraph("<b>NET PAYABLE SALARY (A - B):</b>", ParagraphStyle('NetLbl', fontName='Helvetica-Bold', fontSize=10, textColor=SUCCESS_DARK)),
            Paragraph(f"<b>₹ {payroll_slip.net_salary:,.2f}</b>", ParagraphStyle('NetVal', fontName='Helvetica-Bold', fontSize=14, textColor=SUCCESS_DARK, alignment=TA_RIGHT)),
        ],
        [
            Paragraph(f"<b>Amount in Words:</b> <i>{net_in_words}</i>", ParagraphStyle('Words', fontName='Helvetica', fontSize=8.5, textColor=TEXT_MAIN)),
            Paragraph(f"Status: <b>{payroll_slip.payment_status}</b>", ParagraphStyle('Stat', fontName='Helvetica-Bold', fontSize=8.5, textColor=SUCCESS_DARK if payroll_slip.payment_status == 'PAID' else NAVY_PRIMARY, alignment=TA_RIGHT)),
        ]
    ]
    net_table = Table(net_box_data, colWidths=[13.0 * cm, 5.0 * cm])
    net_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), SUCCESS_SOFT),
        ('BOX', (0,0), (-1,-1), 1.2, SUCCESS_DARK),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(net_table)
    story.append(Spacer(1, 8 * mm))

    # ── 5. SIGNATURE & AUTHENTICATION FOOTER ──
    # QR Code for verification
    qr_img = None
    try:
        qr_text = f"OP360-PAYSLIP|{school.id if school else 0}|{emp_id}|{payroll_slip.payroll_run.month_name}|NET:INR{payroll_slip.net_salary}"
        qr = qrcode.QRCode(box_size=2, border=1)
        qr.add_data(qr_text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        qrf = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        img.save(qrf.name)
        qr_img = RLImage(qrf.name, width=1.8 * cm, height=1.8 * cm)
    except Exception:
        qr_img = Paragraph("", td_style)

    sig_data = [
        [
            qr_img,
            Paragraph("<br/><br/>_______________________<br/><b>Employee Signature</b>", ParagraphStyle('EmpSig', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
            Paragraph("<br/><br/>_______________________<br/><b>Accountant / HR</b>", ParagraphStyle('AccSig', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
            Paragraph("<br/><br/>_______________________<br/><b>Principal / Director</b>", ParagraphStyle('PrinSig', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
        ]
    ]

    sig_table = Table(sig_data, colWidths=[2.5 * cm, 5.0 * cm, 5.0 * cm, 5.5 * cm])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(KeepTogether(sig_table))

    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("<i>This is a computer-generated official payslip issued by EduERP. For any payroll inquiries, contact the HR/Accounts department.</i>", ParagraphStyle('Discl', fontName='Helvetica-Oblique', fontSize=6.5, textColor=GREY_TEXT, alignment=TA_CENTER)))

    doc.build(story)
    buf.seek(0)
    return buf
