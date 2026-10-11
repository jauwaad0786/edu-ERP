"""
Fee Bill (Demand Notice) & Fee Receipt ReportLab PDF Generators
OnePlatform360 / EduERP (Professional Indian School Branded)
"""

import io
import os
import tempfile
from datetime import datetime, date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Image, KeepTogether, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Rect, String
import qrcode


# ── Theme Palette ────────────────────────────────────────────────────────────
NAVY_PRIMARY = colors.HexColor('#0F2942')
NAVY_HEADER  = colors.HexColor('#1E3A8A')
BLUE_ACCENT  = colors.HexColor('#2563EB')
LIGHT_BG     = colors.HexColor('#F8FAFC')
BORDER_COLOR = colors.HexColor('#CBD5E1')
DARK_TEXT    = colors.HexColor('#0F172A')
MUTED_TEXT   = colors.HexColor('#64748B')
GREEN_ACCENT = colors.HexColor('#16A34A')
AMBER_ACCENT = colors.HexColor('#D97706')


def _num_to_words_inr(num):
    """Converts a float amount into Indian Rupees in words."""
    try:
        n = int(round(num))
        if n == 0:
            return "Zero Rupees Only"

        units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                 "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                 "Seventeen", "Eighteen", "Nineteen"]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def _two_digits(val):
            if val < 20:
                return units[val]
            return (tens[val // 10] + (" " + units[val % 10] if val % 10 != 0 else "")).strip()

        def _three_digits(val):
            h = val // 100
            rem = val % 100
            res = ""
            if h > 0:
                res += units[h] + " Hundred"
                if rem > 0:
                    res += " and "
            if rem > 0:
                res += _two_digits(rem)
            return res.strip()

        crore = n // 10000000
        n %= 10000000
        lakh = n // 100000
        n %= 100000
        thousand = n // 1000
        n %= 1000
        hundreds = n

        parts = []
        if crore > 0:
            parts.append(_three_digits(crore) + " Crore")
        if lakh > 0:
            parts.append(_three_digits(lakh) + " Lakh")
        if thousand > 0:
            parts.append(_three_digits(thousand) + " Thousand")
        if hundreds > 0:
            parts.append(_three_digits(hundreds))

        return "Rupees " + " ".join(parts) + " Only"
    except Exception:
        return f"Rupees {num:,.2f} Only"


def _generate_qr_code_image(data_str, size_cm=2.2):
    """Creates a temporary QR code image file for PDF embedding."""
    try:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=4,
            border=1,
        )
        qr.add_data(data_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        img.save(tmp.name)
        tmp.close()
        return tmp.name
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════
#  1. FEE BILL / DEMAND NOTICE PDF GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_fee_bill_pdf(bill, school, student=None):
    """
    Generates a formal Fee Bill / Demand Notice PDF for an upcoming fee period.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = []
    tmp_files = []

    std = student or bill.student
    cls_name = f"{std.class_ref.name} {std.class_ref.section or ''}".strip() if (std and std.class_ref) else '—'
    std_name = std.user.name if (std and std.user) else 'Student'
    adm_no   = std.admission_no if std else '—'
    parent_name = getattr(std, 'father_name', '') or getattr(std, 'guardian_name', '') or 'Parent / Guardian'

    sch_name = getattr(school, 'name', 'School Name')
    sch_addr = getattr(school, 'address', 'School Campus') or 'School Campus'
    sch_aff  = getattr(school, 'affiliation_no', '') or ''
    sch_phone= getattr(school, 'phone', '') or ''

    # ── Header Branding ───────────────────────────────────────────────────
    title_style = ParagraphStyle(
        'SchoolTitle', fontName='Helvetica-Bold', fontSize=15,
        leading=18, textColor=NAVY_PRIMARY, alignment=TA_CENTER
    )
    sub_style = ParagraphStyle(
        'SchoolSub', fontName='Helvetica', fontSize=8.5,
        leading=11, textColor=MUTED_TEXT, alignment=TA_CENTER
    )
    doc_type_style = ParagraphStyle(
        'DocType', fontName='Helvetica-Bold', fontSize=12,
        leading=14, textColor=BLUE_ACCENT, alignment=TA_CENTER
    )

    elements.append(Paragraph(f"<b>{sch_name.upper()}</b>", title_style))
    if sch_aff:
        elements.append(Paragraph(f"Affiliated to CBSE / State Board | Affiliation No: {sch_aff}", sub_style))
    elements.append(Paragraph(f"{sch_addr} {(' | Phone: ' + sch_phone) if sch_phone else ''}", sub_style))
    elements.append(Spacer(1, 0.25 * cm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=NAVY_HEADER, spaceBefore=2, spaceAfter=8))

    # Notice Badge Bar
    notice_table = Table([[
        Paragraph("<b>DEMAND BILL / PAYMENT REQUEST</b>", doc_type_style),
        Paragraph(f"<b>Billing Period:</b> {bill.bill_period_label}", ParagraphStyle('BP', fontName='Helvetica-Bold', fontSize=9, textColor=DARK_TEXT, alignment=TA_RIGHT))
    ]], colWidths=[11.0 * cm, 7.6 * cm])
    notice_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(notice_table)
    elements.append(Paragraph("<font color='#64748B'><i>Note: This document is a formal fee demand / payment request. It does NOT constitute proof of payment.</i></font>", ParagraphStyle('NOTE', fontName='Helvetica-Oblique', fontSize=7.5, textColor=MUTED_TEXT, alignment=TA_CENTER)))
    elements.append(Spacer(1, 0.20 * cm))

    # ── Meta Box: Student & Bill Dates ────────────────────────────────────
    meta_rows = [
        [
            Paragraph("<b>Bill No:</b>", ParagraphStyle('M1', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(bill.bill_no, ParagraphStyle('M2', fontName='Helvetica', fontSize=8, textColor=DARK_TEXT)),
            Paragraph("<b>Student Name:</b>", ParagraphStyle('M3', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(std_name, ParagraphStyle('M4', fontName='Helvetica-Bold', fontSize=8.5, textColor=NAVY_PRIMARY)),
        ],
        [
            Paragraph("<b>Issue Date:</b>", ParagraphStyle('M5', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(bill.generation_date.strftime('%d %B %Y') if bill.generation_date else str(date.today()), ParagraphStyle('M6', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Admission No:</b>", ParagraphStyle('M7', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(adm_no, ParagraphStyle('M8', fontName='Helvetica', fontSize=8)),
        ],
        [
            Paragraph("<b>Due Date:</b>", ParagraphStyle('M9', fontName='Helvetica-Bold', fontSize=8, textColor=AMBER_ACCENT)),
            Paragraph(f"<b>{bill.due_date.strftime('%d %B %Y')}</b>" if bill.due_date else '—', ParagraphStyle('M10', fontName='Helvetica-Bold', fontSize=8.5, textColor=AMBER_ACCENT)),
            Paragraph("<b>Class / Section:</b>", ParagraphStyle('M11', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(cls_name, ParagraphStyle('M12', fontName='Helvetica', fontSize=8)),
        ],
        [
            Paragraph("<b>Academic Session:</b>", ParagraphStyle('M13', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(bill.session or (bill.student.session if bill.student else '') or 'Active Session', ParagraphStyle('M14', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Parent / Guardian:</b>", ParagraphStyle('M15', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(parent_name, ParagraphStyle('M16', fontName='Helvetica', fontSize=8)),
        ],
    ]

    meta_table = Table(meta_rows, colWidths=[3.2 * cm, 5.5 * cm, 3.8 * cm, 6.1 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_COLOR),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 0.35 * cm))

    # ── Itemized Fee Breakdown Table ──────────────────────────────────────
    items_header = [
        Paragraph("<b>#</b>", ParagraphStyle('TH1', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Particulars / Fee Head</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Department</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Original (₹)</b>", ParagraphStyle('TH4', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("<b>Discount (₹)</b>", ParagraphStyle('TH5', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
        Paragraph("<b>Net Amount (₹)</b>", ParagraphStyle('TH6', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]

    item_rows = [items_header]
    for idx, itm in enumerate(bill.items, 1):
        h_name = itm.fee_head.name if itm.fee_head else 'Fee Item'
        cov_lbl = getattr(itm, 'coverage_label', None)
        freq_lbl = getattr(itm, 'billing_frequency', None)
        detail_p = f"<b>{h_name}</b>"
        if cov_lbl:
            freq_str = f" • {freq_lbl.replace('_', ' ').title()}" if freq_lbl and freq_lbl != 'MONTHLY' else ""
            detail_p += f"<br/><font size=6.5 color='#4B5563'>Coverage: {cov_lbl}{freq_str}</font>"

        item_rows.append([
            Paragraph(str(idx), ParagraphStyle('TD1', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
            Paragraph(detail_p, ParagraphStyle('TD2', fontName='Helvetica', fontSize=8)),
            Paragraph(itm.department or 'ACCOUNTS', ParagraphStyle('TD3', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=MUTED_TEXT)),
            Paragraph(f"{itm.original_amount:,.2f}", ParagraphStyle('TD4', fontName='Helvetica', fontSize=8, alignment=TA_RIGHT)),
            Paragraph(f"{itm.discount_amount:,.2f}" if itm.discount_amount else "0.00", ParagraphStyle('TD5', fontName='Helvetica', fontSize=8, alignment=TA_RIGHT, textColor=GREEN_ACCENT if itm.discount_amount else DARK_TEXT)),
            Paragraph(f"<b>{itm.net_amount:,.2f}</b>", ParagraphStyle('TD6', fontName='Helvetica-Bold', fontSize=8, alignment=TA_RIGHT)),
        ])

    # Summary Rows
    if bill.previous_dues and bill.previous_dues > 0:
        item_rows.append([
            '', Paragraph("<b>Previous Unpaid Dues / Arrears</b>", ParagraphStyle('P1', fontName='Helvetica-Bold', fontSize=8, textColor=AMBER_ACCENT)),
            '', '', '',
            Paragraph(f"<b>{bill.previous_dues:,.2f}</b>", ParagraphStyle('P2', fontName='Helvetica-Bold', fontSize=8, alignment=TA_RIGHT, textColor=AMBER_ACCENT))
        ])

    item_rows.append([
        '', Paragraph("<b>TOTAL PAYABLE AMOUNT</b>", ParagraphStyle('TOT1', fontName='Helvetica-Bold', fontSize=9, textColor=NAVY_PRIMARY)),
        '', '', '',
        Paragraph(f"<b>₹ {bill.total_payable:,.2f}</b>", ParagraphStyle('TOT2', fontName='Helvetica-Bold', fontSize=9.5, alignment=TA_RIGHT, textColor=NAVY_PRIMARY))
    ])

    items_table = Table(item_rows, colWidths=[1.0 * cm, 7.6 * cm, 2.6 * cm, 2.5 * cm, 2.4 * cm, 2.5 * cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_COLOR),
        ('GRID', (0, 0), (-1, -2), 0.4, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF6FF')),
        ('LINEABOVE', (0, -1), (-1, -1), 1.0, BLUE_ACCENT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.25 * cm))

    # Amount in words
    words_str = _num_to_words_inr(bill.total_payable)
    words_table = Table([[
        Paragraph(f"<b>Amount in Words:</b> {words_str}", ParagraphStyle('WRD', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT))
    ]], colWidths=[18.6 * cm])
    words_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(words_table)
    elements.append(Spacer(1, 0.35 * cm))

    # ── Payment Instructions & QR Code ────────────────────────────────────
    qr_data = f"upi://pay?pa=schoolfees@bank&pn={sch_name}&am={bill.total_payable:.2f}&tn={bill.bill_no}"
    qr_path = _generate_qr_code_image(qr_data)
    if qr_path:
        tmp_files.append(qr_path)
        qr_flowable = Image(qr_path, width=2.2 * cm, height=2.2 * cm)
    else:
        qr_flowable = Paragraph("Scan to Pay", ParagraphStyle('QRF', fontSize=8))

    instructions_text = (
        "<b>Important Payment Instructions:</b><br/>"
        "1. Please pay on or before the due date to avoid late fine charges.<br/>"
        "2. Payment modes accepted: UPI / QR Code, Online Portal, NetBanking, Cheque, or School Accounts Counter.<br/>"
        "3. Always quote the <b>Bill No</b> during bank transfer / counter collection.<br/>"
        "4. <i>Note: This document is a Demand Bill / Notice and does NOT serve as a payment receipt.</i>"
    )

    instruct_table = Table([[
        Paragraph(instructions_text, ParagraphStyle('INST', fontName='Helvetica', fontSize=7.5, leading=10, textColor=DARK_TEXT)),
        qr_flowable,
        Paragraph("<br/><br/>_______________________<br/><b>Accounts Officer</b><br/>(Authorized Signatory)", ParagraphStyle('SIG', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=DARK_TEXT))
    ]], colWidths=[10.5 * cm, 3.5 * cm, 4.6 * cm])
    instruct_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(instruct_table)

    # Build PDF
    doc.build(elements)

    # Cleanup temp files
    for f in tmp_files:
        try:
            os.remove(f)
        except Exception:
            pass

    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════
#  2. OFFICIAL FEE RECEIPT PDF GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_fee_receipt_pdf(payment, school, student=None, ledger_balance=0.0):
    """
    Generates an Official Payment Receipt PDF after money collection.
    Itemizes payment allocation across departments/fee heads.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = []
    tmp_files = []

    std = student or payment.student
    cls_name = f"{std.class_ref.name} {std.class_ref.section or ''}".strip() if (std and std.class_ref) else '—'
    std_name = std.user.name if (std and std.user) else 'Student'
    adm_no   = std.admission_no if std else '—'
    parent_name = getattr(std, 'father_name', '') or getattr(std, 'guardian_name', '') or 'Parent / Guardian'

    sch_name = getattr(school, 'name', 'School Name')
    sch_addr = getattr(school, 'address', 'School Campus') or 'School Campus'
    sch_aff  = getattr(school, 'affiliation_no', '') or ''
    sch_phone= getattr(school, 'phone', '') or ''

    # ── Header Branding ───────────────────────────────────────────────────
    title_style = ParagraphStyle(
        'SchoolTitle', fontName='Helvetica-Bold', fontSize=15,
        leading=18, textColor=NAVY_PRIMARY, alignment=TA_CENTER
    )
    sub_style = ParagraphStyle(
        'SchoolSub', fontName='Helvetica', fontSize=8.5,
        leading=11, textColor=MUTED_TEXT, alignment=TA_CENTER
    )
    doc_type_style = ParagraphStyle(
        'DocType', fontName='Helvetica-Bold', fontSize=12,
        leading=14, textColor=GREEN_ACCENT, alignment=TA_CENTER
    )

    elements.append(Paragraph(f"<b>{sch_name.upper()}</b>", title_style))
    if sch_aff:
        elements.append(Paragraph(f"Affiliated to CBSE / State Board | Affiliation No: {sch_aff}", sub_style))
    elements.append(Paragraph(f"{sch_addr} {(' | Phone: ' + sch_phone) if sch_phone else ''}", sub_style))
    elements.append(Spacer(1, 0.25 * cm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=NAVY_HEADER, spaceBefore=2, spaceAfter=8))

    # Receipt Title Bar
    rcpt_table = Table([[
        Paragraph("<b>OFFICIAL FEE PAYMENT RECEIPT</b>", doc_type_style),
        Paragraph(f"<b>Receipt No:</b> <font color='#1E3A8A'>{payment.receipt_no}</font>", ParagraphStyle('RN', fontName='Helvetica-Bold', fontSize=9.5, alignment=TA_RIGHT))
    ]], colWidths=[10.5 * cm, 8.1 * cm])
    rcpt_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(rcpt_table)
    elements.append(Spacer(1, 0.25 * cm))

    # ── Meta Box: Student & Payment Details ───────────────────────────────
    meta_rows = [
        [
            Paragraph("<b>Receipt Date:</b>", ParagraphStyle('R1', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(payment.payment_date.strftime('%d %B %Y') if payment.payment_date else str(date.today()), ParagraphStyle('R2', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Student Name:</b>", ParagraphStyle('R3', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(std_name, ParagraphStyle('R4', fontName='Helvetica-Bold', fontSize=8.5, textColor=NAVY_PRIMARY)),
        ],
        [
            Paragraph("<b>Payment Mode:</b>", ParagraphStyle('R5', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(f"<b>{payment.payment_mode}</b>", ParagraphStyle('R6', fontName='Helvetica-Bold', fontSize=8, textColor=BLUE_ACCENT)),
            Paragraph("<b>Admission No:</b>", ParagraphStyle('R7', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(adm_no, ParagraphStyle('R8', fontName='Helvetica', fontSize=8)),
        ],
        [
            Paragraph("<b>Transaction Ref:</b>", ParagraphStyle('R9', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(payment.transaction_ref or '—', ParagraphStyle('R10', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Class / Section:</b>", ParagraphStyle('R11', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(cls_name, ParagraphStyle('R12', fontName='Helvetica', fontSize=8)),
        ],
        [
            Paragraph("<b>Collected By:</b>", ParagraphStyle('R13', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(payment.collector.name if payment.collector else 'Accounts Officer', ParagraphStyle('R14', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Department:</b>", ParagraphStyle('R15', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(payment.department or 'ACCOUNTS', ParagraphStyle('R16', fontName='Helvetica', fontSize=8)),
        ],
    ]

    meta_table = Table(meta_rows, colWidths=[3.2 * cm, 5.5 * cm, 3.8 * cm, 6.1 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_COLOR),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 0.35 * cm))

    # ── Itemized Payment Allocation Table ─────────────────────────────────
    items_header = [
        Paragraph("<b>#</b>", ParagraphStyle('TH1', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Service / Fee Head</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Department</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Allocated Paid Amount (₹)</b>", ParagraphStyle('TH4', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]

    item_rows = [items_header]
    allocs = payment.allocations or []
    if allocs:
        for idx, alc in enumerate(allocs, 1):
            head_name = alc.fee_head.name if alc.fee_head else 'Fee Item'
            period_label = ''
            if getattr(alc, 'bill', None) and alc.bill.bill_period_label:
                period_label = f" — {alc.bill.bill_period_label}"
            elif getattr(alc, 'bill_item', None) and getattr(alc.bill_item, 'coverage_label', None):
                period_label = f" — {alc.bill_item.coverage_label}"
            display_name = f"<b>{head_name}</b><font color='#64748B'>{period_label}</font>"

            item_rows.append([
                Paragraph(str(idx), ParagraphStyle('TD1', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
                Paragraph(display_name, ParagraphStyle('TD2', fontName='Helvetica', fontSize=8)),
                Paragraph(alc.department or 'ACCOUNTS', ParagraphStyle('TD3', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=MUTED_TEXT)),
                Paragraph(f"<b>{alc.allocated_amount:,.2f}</b>", ParagraphStyle('TD4', fontName='Helvetica-Bold', fontSize=8, alignment=TA_RIGHT, textColor=DARK_TEXT)),
            ])
    else:
        item_rows.append([
            Paragraph("1", ParagraphStyle('TD1', fontName='Helvetica', fontSize=8, alignment=TA_CENTER)),
            Paragraph(f"Combined Fee Payment <font color='#64748B'>— {payment.session}</font>", ParagraphStyle('TD2', fontName='Helvetica', fontSize=8)),
            Paragraph(payment.department or 'ACCOUNTS', ParagraphStyle('TD3', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=MUTED_TEXT)),
            Paragraph(f"<b>{payment.total_paid:,.2f}</b>", ParagraphStyle('TD4', fontName='Helvetica-Bold', fontSize=8, alignment=TA_RIGHT, textColor=DARK_TEXT)),
        ])

    if getattr(payment, 'advance_credited', 0) and payment.advance_credited > 0:
        item_rows.append([
            '', Paragraph("<b>Advance Prepayment Credited (Future Periods)</b>", ParagraphStyle('ADV1', fontName='Helvetica-Bold', fontSize=8, textColor=BLUE_ACCENT)),
            Paragraph('ADVANCE', ParagraphStyle('ADV2', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=BLUE_ACCENT)),
            Paragraph(f"<b>{payment.advance_credited:,.2f}</b>", ParagraphStyle('ADV3', fontName='Helvetica-Bold', fontSize=8, alignment=TA_RIGHT, textColor=BLUE_ACCENT))
        ])

    # Total Paid Row
    item_rows.append([
        '', Paragraph("<b>TOTAL AMOUNT RECEIVED</b>", ParagraphStyle('TOT1', fontName='Helvetica-Bold', fontSize=9, textColor=GREEN_ACCENT)),
        '',
        Paragraph(f"<b>₹ {payment.total_paid:,.2f}</b>", ParagraphStyle('TOT2', fontName='Helvetica-Bold', fontSize=9.5, alignment=TA_RIGHT, textColor=GREEN_ACCENT))
    ])

    items_table = Table(item_rows, colWidths=[1.2 * cm, 9.8 * cm, 3.6 * cm, 4.0 * cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_COLOR),
        ('GRID', (0, 0), (-1, -2), 0.4, colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#DCFCE7')),
        ('LINEABOVE', (0, -1), (-1, -1), 1.0, GREEN_ACCENT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 0.25 * cm))

    # Amount in words
    words_str = _num_to_words_inr(payment.total_paid)
    words_table = Table([[
        Paragraph(f"<b>Amount in Words:</b> {words_str}", ParagraphStyle('WRD', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT))
    ]], colWidths=[18.6 * cm])
    words_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(words_table)
    elements.append(Spacer(1, 0.25 * cm))

    # ── Ledger Balance Rollup & Verification QR ───────────────────────────
    qr_data = f"RECEIPT:{payment.receipt_no}|STUDENT:{adm_no}|AMOUNT:{payment.total_paid:.2f}|DATE:{payment.payment_date}"
    qr_path = _generate_qr_code_image(qr_data)
    if qr_path:
        tmp_files.append(qr_path)
        qr_flowable = Image(qr_path, width=2.0 * cm, height=2.0 * cm)
    else:
        qr_flowable = Paragraph("Verified", ParagraphStyle('QRF', fontSize=8))

    rem_bal_str = f"₹ {ledger_balance:,.2f}" if ledger_balance > 0 else "₹ 0.00 (NIL)"
    balance_text = (
        f"<b>Remaining Student Balance:</b> {rem_bal_str}<br/>"
        "<i>Thank you for your payment. This is an electronically generated official receipt.</i>"
    )

    foot_table = Table([[
        Paragraph(balance_text, ParagraphStyle('BAL', fontName='Helvetica', fontSize=7.5, leading=11, textColor=DARK_TEXT)),
        qr_flowable,
        Paragraph("<br/><br/>_______________________<br/><b>Cashier / Accounts Officer</b><br/>(Official Signature)", ParagraphStyle('SIG', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=DARK_TEXT))
    ]], colWidths=[10.5 * cm, 3.5 * cm, 4.6 * cm])
    foot_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(foot_table)

    # Build PDF
    doc.build(elements)

    # Cleanup temp files
    for f in tmp_files:
        try:
            os.remove(f)
        except Exception:
            pass

    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════
#  3. STUDENT FINANCIAL STATEMENT / LEDGER PDF GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_student_ledger_pdf(ledger_data, school, student=None):
    """
    Generates an official Student Fee Statement / Account Ledger PDF
    showing complete chronological charges, payments, concessions, and outstanding balance.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = []
    tmp_files = []

    std = student or (ledger_data.get('student') if isinstance(ledger_data, dict) else None)
    std_name = ledger_data.get('student_name') if isinstance(ledger_data, dict) else ''
    if not std_name and std:
        std_name = std.user.name if (hasattr(std, 'user') and std.user) else (std.name if hasattr(std, 'name') else 'Student')
    adm_no = ledger_data.get('admission_no') if isinstance(ledger_data, dict) else ''
    if not adm_no and std:
        adm_no = getattr(std, 'admission_no', '—')
    cls_name = ledger_data.get('class_name') if isinstance(ledger_data, dict) else ''
    if not cls_name and std and hasattr(std, 'class_ref') and std.class_ref:
        cls_name = f"{std.class_ref.name} {std.class_ref.section or ''}".strip()
    session = ledger_data.get('session') or '2026-27'

    sch_name = getattr(school, 'name', 'School Name')
    sch_addr = getattr(school, 'address', 'School Campus') or 'School Campus'
    sch_aff  = getattr(school, 'affiliation_no', '') or ''
    sch_phone= getattr(school, 'phone', '') or ''

    # Header
    title_style = ParagraphStyle(
        'LTitle', fontName='Helvetica-Bold', fontSize=15,
        leading=18, textColor=NAVY_PRIMARY, alignment=TA_CENTER
    )
    sub_style = ParagraphStyle(
        'LSub', fontName='Helvetica', fontSize=8.5,
        leading=11, textColor=MUTED_TEXT, alignment=TA_CENTER
    )
    doc_type_style = ParagraphStyle(
        'LDocType', fontName='Helvetica-Bold', fontSize=12,
        leading=14, textColor=BLUE_ACCENT, alignment=TA_CENTER
    )

    elements.append(Paragraph(f"<b>{sch_name.upper()}</b>", title_style))
    if sch_aff:
        elements.append(Paragraph(f"Affiliated to CBSE / State Board | Affiliation No: {sch_aff}", sub_style))
    elements.append(Paragraph(f"{sch_addr} {(' | Phone: ' + sch_phone) if sch_phone else ''}", sub_style))
    elements.append(Spacer(1, 0.25 * cm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=NAVY_HEADER, spaceBefore=2, spaceAfter=8))

    # Statement Bar
    stmt_table = Table([[
        Paragraph("<b>STUDENT STATEMENT OF ACCOUNT / FEE LEDGER</b>", doc_type_style),
        Paragraph(f"<b>Session:</b> {session} | <b>As of:</b> {date.today().strftime('%d %b %Y')}", ParagraphStyle('SB', fontName='Helvetica-Bold', fontSize=9, textColor=DARK_TEXT, alignment=TA_RIGHT))
    ]], colWidths=[11.5 * cm, 7.1 * cm])
    stmt_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(stmt_table)
    elements.append(Spacer(1, 0.25 * cm))

    # Student Meta Box
    meta_rows = [
        [
            Paragraph("<b>Student Name:</b>", ParagraphStyle('M1', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(std_name, ParagraphStyle('M2', fontName='Helvetica-Bold', fontSize=8.5, textColor=NAVY_PRIMARY)),
            Paragraph("<b>Class / Section:</b>", ParagraphStyle('M3', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(cls_name or '—', ParagraphStyle('M4', fontName='Helvetica', fontSize=8)),
        ],
        [
            Paragraph("<b>Admission No:</b>", ParagraphStyle('M5', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(adm_no or '—', ParagraphStyle('M6', fontName='Helvetica', fontSize=8)),
            Paragraph("<b>Parent / Phone:</b>", ParagraphStyle('M7', fontName='Helvetica-Bold', fontSize=8, textColor=DARK_TEXT)),
            Paragraph(ledger_data.get('parent_phone') or getattr(std, 'parent_phone', '—') or '—', ParagraphStyle('M8', fontName='Helvetica', fontSize=8)),
        ]
    ]
    meta_table = Table(meta_rows, colWidths=[3.2 * cm, 6.0 * cm, 3.4 * cm, 6.0 * cm])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 0.8, BORDER_COLOR),
        ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 0.35 * cm))

    # Financial Summary KPI Box
    total_billed = float(ledger_data.get('total_billed', 0.0))
    total_paid = float(ledger_data.get('total_paid', 0.0))
    outstanding = float(ledger_data.get('outstanding', 0.0))
    advance_credit = float(ledger_data.get('advance_credit', 0.0))

    kpi_rows = [[
        Paragraph(f"<b>Total Billed:</b><br/><font size='10' color='#1E3A8A'>₹{total_billed:,.2f}</font>", ParagraphStyle('K1', fontName='Helvetica', alignment=TA_CENTER)),
        Paragraph(f"<b>Total Paid:</b><br/><font size='10' color='#16A34A'>₹{total_paid:,.2f}</font>", ParagraphStyle('K2', fontName='Helvetica', alignment=TA_CENTER)),
        Paragraph(f"<b>Outstanding Due:</b><br/><font size='10' color='#DC2626'>₹{outstanding:,.2f}</font>", ParagraphStyle('K3', fontName='Helvetica', alignment=TA_CENTER)),
        Paragraph(f"<b>Advance Balance:</b><br/><font size='10' color='#2563EB'>₹{advance_credit:,.2f}</font>", ParagraphStyle('K4', fontName='Helvetica', alignment=TA_CENTER)),
    ]]
    kpi_table = Table(kpi_rows, colWidths=[4.65 * cm, 4.65 * cm, 4.65 * cm, 4.65 * cm])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 1.0, BLUE_ACCENT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 0.35 * cm))

    # Ledger Transactions Table
    trans_header = [
        Paragraph("<b>Date</b>", ParagraphStyle('TH1', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Ref / Bill / Rec</b>", ParagraphStyle('TH2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Description / Period</b>", ParagraphStyle('TH3', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Type</b>", ParagraphStyle('TH4', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Amount (₹)</b>", ParagraphStyle('TH5', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    trans_rows = [trans_header]

    raw_entries = ledger_data.get('ledger_entries') or []
    if raw_entries:
        for it in raw_entries:
            entry_type = it.get('entry_type', 'DEBIT')
            is_credit = entry_type == 'CREDIT'
            amt_color = '#16A34A' if is_credit else '#0F172A'
            amt_prefix = "- " if is_credit else "+ "
            trans_rows.append([
                Paragraph(str(it.get('entry_date', '')), ParagraphStyle('TD1', fontName='Helvetica', fontSize=7.5)),
                Paragraph(str(it.get('reference_no', '') or '—'), ParagraphStyle('TD2', fontName='Helvetica-Bold', fontSize=7.5, textColor=NAVY_HEADER)),
                Paragraph(str(it.get('description', '')), ParagraphStyle('TD3', fontName='Helvetica', fontSize=7.5)),
                Paragraph(entry_type, ParagraphStyle('TD4', fontName='Helvetica-Bold', fontSize=7, alignment=TA_CENTER, textColor=colors.HexColor('#16A34A') if is_credit else colors.HexColor('#DC2626'))),
                Paragraph(f"<font color='{amt_color}'><b>{amt_prefix}₹{float(it.get('amount', 0)):,.2f}</b></font>", ParagraphStyle('TD5', fontName='Helvetica', fontSize=7.5, alignment=TA_RIGHT)),
            ])
    else:
        # Fallback to bills list
        bills = ledger_data.get('bills') or []
        for b in bills:
            trans_rows.append([
                Paragraph(str(b.get('generation_date', '')), ParagraphStyle('TD1', fontName='Helvetica', fontSize=7.5)),
                Paragraph(str(b.get('bill_no', '')), ParagraphStyle('TD2', fontName='Helvetica-Bold', fontSize=7.5, textColor=NAVY_HEADER)),
                Paragraph(f"Fee Bill — {b.get('bill_period_label', '')}", ParagraphStyle('TD3', fontName='Helvetica', fontSize=7.5)),
                Paragraph("DEBIT", ParagraphStyle('TD4', fontName='Helvetica-Bold', fontSize=7, alignment=TA_CENTER, textColor=colors.HexColor('#DC2626'))),
                Paragraph(f"<b>₹{float(b.get('total_payable', 0)):,.2f}</b>", ParagraphStyle('TD5', fontName='Helvetica', fontSize=7.5, alignment=TA_RIGHT)),
            ])

    trans_table = Table(trans_rows, colWidths=[2.3 * cm, 3.5 * cm, 7.8 * cm, 2.0 * cm, 3.0 * cm])
    trans_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(trans_table)
    elements.append(Spacer(1, 0.4 * cm))

    # QR and Signatory
    qr_data = f"EduERP-Statement|School:{school.id}|Student:{adm_no}|Outstanding:{outstanding}"
    qr_path = _generate_qr_code_image(qr_data, size_cm=1.8)
    if qr_path:
        tmp_files.append(qr_path)
        qr_flowable = Image(qr_path, width=1.8 * cm, height=1.8 * cm)
    else:
        qr_flowable = Paragraph("", ParagraphStyle('E'))

    foot_table = Table([[
        Paragraph("<i>Certified that the above statement reflects all debits and credits recorded in the institutional ledger. This is a computer-generated account statement.</i>", ParagraphStyle('FT', fontName='Helvetica-Oblique', fontSize=7.5, leading=10, textColor=MUTED_TEXT)),
        qr_flowable,
        Paragraph("<br/><br/>_______________________<br/><b>Accounts Officer</b><br/>(Authorized Signatory)", ParagraphStyle('SIG', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER, textColor=DARK_TEXT))
    ]], colWidths=[10.5 * cm, 3.5 * cm, 4.6 * cm])
    foot_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(foot_table)

    doc.build(elements)
    for f in tmp_files:
        try:
            os.remove(f)
        except Exception:
            pass
    buffer.seek(0)
    return buffer


# ═══════════════════════════════════════════════════════════════════════
#  4. OUTSTANDING DUES / DEFAULTERS REPORT PDF GENERATOR
# ═══════════════════════════════════════════════════════════════════════

def generate_outstanding_dues_report_pdf(outstanding_bills, school, session=None, month=None):
    """
    Generates a formal Outstanding Dues & Fee Defaulters summary report PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.2 * cm, leftMargin=1.2 * cm,
        topMargin=1.0 * cm, bottomMargin=1.0 * cm
    )
    elements = []

    sch_name = getattr(school, 'name', 'School Name')
    sch_addr = getattr(school, 'address', 'School Campus') or 'School Campus'

    # Header
    title_style = ParagraphStyle(
        'OTitle', fontName='Helvetica-Bold', fontSize=15,
        leading=18, textColor=NAVY_PRIMARY, alignment=TA_CENTER
    )
    sub_style = ParagraphStyle(
        'OSub', fontName='Helvetica', fontSize=8.5,
        leading=11, textColor=MUTED_TEXT, alignment=TA_CENTER
    )
    elements.append(Paragraph(f"<b>{sch_name.upper()}</b>", title_style))
    elements.append(Paragraph(f"{sch_addr}", sub_style))
    elements.append(Spacer(1, 0.25 * cm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=NAVY_HEADER, spaceBefore=2, spaceAfter=8))

    month_str = f" | Month: {month}" if month else ""
    hdr_table = Table([[
        Paragraph("<b>OUTSTANDING FEE DUES & DEFAULTERS REPORT</b>", ParagraphStyle('D1', fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#DC2626'))),
        Paragraph(f"<b>Session:</b> {session or 'Current'}{month_str}", ParagraphStyle('D2', fontName='Helvetica-Bold', fontSize=9, alignment=TA_RIGHT, textColor=DARK_TEXT))
    ]], colWidths=[12.0 * cm, 6.6 * cm])
    elements.append(hdr_table)
    elements.append(Spacer(1, 0.3 * cm))

    # Summary
    total_due = sum(float(getattr(b, 'balance_due', 0.0) if hasattr(b, 'balance_due') else b.get('balance_due', 0.0)) for b in outstanding_bills)
    summary_p = Paragraph(f"<b>Total Defaulters / Unpaid Bills:</b> {len(outstanding_bills)} &nbsp;|&nbsp; <b>Total Outstanding Dues:</b> <font color='#DC2626'><b>₹{total_due:,.2f}</b></font>", ParagraphStyle('SM', fontName='Helvetica', fontSize=9, textColor=DARK_TEXT))
    elements.append(summary_p)
    elements.append(Spacer(1, 0.3 * cm))

    # Defaulters Table
    cols = [
        Paragraph("<b>#</b>", ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Bill No</b>", ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Student Name</b>", ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Class</b>", ParagraphStyle('H4', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Period</b>", ParagraphStyle('H5', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white)),
        Paragraph("<b>Due Date</b>", ParagraphStyle('H6', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph("<b>Balance Due (₹)</b>", ParagraphStyle('H7', fontName='Helvetica-Bold', fontSize=8, textColor=colors.white, alignment=TA_RIGHT)),
    ]
    rows = [cols]

    for idx, b in enumerate(outstanding_bills, 1):
        if hasattr(b, 'bill_no'):
            b_no = b.bill_no
            s_name = b.student.user.name if (b.student and b.student.user) else 'Student'
            c_name = f"{b.student.class_ref.name} {b.student.class_ref.section or ''}".strip() if (b.student and b.student.class_ref) else '—'
            p_lbl = b.bill_period_label or b.bill_month
            d_date = b.due_date.strftime('%d %b %Y') if b.due_date else '—'
            b_due = float(b.balance_due or 0.0)
        else:
            b_no = b.get('bill_no', '')
            s_name = b.get('student_name', '')
            c_name = b.get('class_name', '—')
            p_lbl = b.get('bill_period_label') or b.get('bill_month', '')
            d_date = str(b.get('due_date', '—'))
            b_due = float(b.get('balance_due', 0.0))

        rows.append([
            Paragraph(str(idx), ParagraphStyle('T1', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER)),
            Paragraph(b_no, ParagraphStyle('T2', fontName='Helvetica-Bold', fontSize=7.5, textColor=NAVY_HEADER)),
            Paragraph(s_name, ParagraphStyle('T3', fontName='Helvetica-Bold', fontSize=7.5)),
            Paragraph(c_name, ParagraphStyle('T4', fontName='Helvetica', fontSize=7.5)),
            Paragraph(p_lbl, ParagraphStyle('T5', fontName='Helvetica', fontSize=7.5)),
            Paragraph(d_date, ParagraphStyle('T6', fontName='Helvetica', fontSize=7.5, alignment=TA_CENTER)),
            Paragraph(f"<font color='#DC2626'><b>₹{b_due:,.2f}</b></font>", ParagraphStyle('T7', fontName='Helvetica', fontSize=7.5, alignment=TA_RIGHT)),
        ])

    t = Table(rows, colWidths=[1.0 * cm, 3.2 * cm, 4.4 * cm, 2.5 * cm, 2.7 * cm, 2.3 * cm, 2.5 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_HEADER),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4 * cm))

    elements.append(Paragraph(f"<i>Report generated on {datetime.now().strftime('%d %B %Y at %I:%M %p')}. Confirmed against Central Fees Ledger.</i>", ParagraphStyle('GEN', fontName='Helvetica-Oblique', fontSize=7.5, textColor=MUTED_TEXT)))

    doc.build(elements)
    buffer.seek(0)
    return buffer

