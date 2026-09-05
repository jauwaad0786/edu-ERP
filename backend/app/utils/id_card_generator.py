"""
id_card_generator.py — FIXED VERSION
Changes: 
1. Adm. No. REMOVED from front card
2. Name overlap fix — proper Y positioning + font fit
3. QR code — vCard/plain text format Google Lens can scan
4. Student photo properly loaded from URL
5. Proper column layout without overlap
"""

import io
import os
import json
import socket
import ipaddress
from urllib.parse import urlparse
from datetime import datetime
import requests

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

# ── Card dimensions (portrait CR80) ──────────────────────────────────────────
CW = 54.0 * mm
CH = 85.6 * mm

NAVY   = colors.HexColor('#032d60')
BLUE   = colors.HexColor('#0176d3')
LBLUE  = colors.HexColor('#e8f4fd')
ACCENT = colors.HexColor('#f0a500')
WHITE  = colors.white
GREY   = colors.HexColor('#64748b')
LGREY  = colors.HexColor('#f1f5f9')
DGREY  = colors.HexColor('#0f172a')


def _is_safe_public_url(url: str) -> bool:
    """Validate that the URL is public and does not point to internal networks or loopback (SSRF protection)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return False
        host = parsed.hostname
        if not host:
            return False
        host_lower = host.lower()
        if host_lower in ('localhost', 'metadata.google.internal') or host_lower.endswith('.internal') or host_lower.endswith('.local'):
            return False
        addr_info = socket.getaddrinfo(host, None)
        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


def _is_safe_local_path(path: str) -> bool:
    """Validate that the local path is strictly confined to allowed static/upload directories."""
    try:
        real_path = os.path.realpath(path)
        current_dir = os.path.realpath(os.path.dirname(__file__))
        allowed_dirs = [
            os.path.realpath(os.path.join(current_dir, '..', 'static')),
            os.path.realpath(os.path.join(current_dir, '..', 'uploads')),
        ]
        return any(real_path.startswith(d + os.path.sep) or real_path == d for d in allowed_dirs)
    except Exception:
        return False


def _load_image_bytes(url):
    if not url:
        return None
    try:
        if url.startswith(('http://', 'https://')):
            if not _is_safe_public_url(url):
                return None
            resp = requests.get(url, timeout=5, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}, stream=True)
            if resp.status_code == 200:
                content = b''
                for chunk in resp.iter_content(chunk_size=65536):
                    content += chunk
                    if len(content) > 10 * 1024 * 1024:
                        return None
                return content
        elif os.path.exists(url) and _is_safe_local_path(url):
            with open(url, 'rb') as f:
                return f.read()
    except Exception:
        pass
    return None


def _make_qr(student):
    """
    QR code in plain-text format — scannable by Google Lens.
    Includes student name, roll, phone so scanning gives useful info.
    """
    from reportlab.lib.utils import ImageReader
    # Plain vCard-style text (NOT JSON) — Google Lens reads this cleanly
    lines = [
        f"Name: {student.get('name', '')}",
        f"Roll No: {student.get('roll_number', '')}",
        f"School: {student.get('school_name', '')}",
        f"Phone: {student.get('parent_phone', '')}",
        f"Session: {student.get('session', '')}",
    ]
    text = "\n".join(l for l in lines if l.split(': ')[1])

    qr = qrcode.QRCode(
        version=3,
        box_size=8,
        border=2,
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # HIGH — better scan rate
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color='#032d60', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


def _draw_rounded_rect(c, x, y, w, h, r, fill_color=None, stroke_color=None, stroke_width=1):
    c.saveState()
    if fill_color:
        c.setFillColor(fill_color)
    if stroke_color:
        c.setStrokeColor(stroke_color)
        c.setLineWidth(stroke_width)
    else:
        c.setLineWidth(0)
    p = c.beginPath()
    p.roundRect(x, y, w, h, r)
    if fill_color and stroke_color:
        c.drawPath(p, fill=1, stroke=1)
    elif fill_color:
        c.drawPath(p, fill=1, stroke=0)
    else:
        c.drawPath(p, fill=0, stroke=1)
    c.restoreState()


def _draw_photo_circle(c, cx, cy, r, img_bytes):
    from reportlab.lib.utils import ImageReader
    c.saveState()
    p = c.beginPath()
    p.circle(cx, cy, r)
    c.clipPath(p, stroke=0)
    if img_bytes:
        try:
            ir = ImageReader(io.BytesIO(img_bytes))
            c.drawImage(ir, cx - r, cy - r, 2*r, 2*r, preserveAspectRatio=True, mask='auto')
        except Exception:
            _draw_photo_placeholder(c, cx, cy, r)
    else:
        _draw_photo_placeholder(c, cx, cy, r)
    c.restoreState()
    c.saveState()
    c.setStrokeColor(WHITE)
    c.setLineWidth(1.5)
    c.circle(cx, cy, r, stroke=1, fill=0)
    c.restoreState()


def _draw_photo_placeholder(c, cx, cy, r):
    c.setFillColor(colors.HexColor('#bfdbfe'))
    c.circle(cx, cy, r, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', r * 0.7)
    c.drawCentredString(cx, cy - r * 0.25, '?')


def _fit_text(c, text, font, max_size, min_size, max_width):
    """Shrink font until text fits max_width."""
    size = max_size
    while size >= min_size:
        if c.stringWidth(text, font, size) <= max_width:
            return size
        size -= 0.5
    return min_size


# ── FRONT SIDE ────────────────────────────────────────────────────────────────
def _draw_front(c, ox, oy, student, school, cls_name):
    from reportlab.lib.utils import ImageReader
    W, H = CW, CH

    # Card background
    _draw_rounded_rect(c, ox, oy, W, H, 4*mm, fill_color=WHITE, stroke_color=BLUE, stroke_width=0.5)

    # Header band
    _draw_rounded_rect(c, ox, oy + H - 20*mm, W, 20*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY)
    c.rect(ox, oy + H - 20*mm, W, 10*mm, fill=1, stroke=0)

    # Gold stripe
    c.setFillColor(ACCENT)
    c.rect(ox, oy + H - 21.5*mm, W, 1.5*mm, fill=1, stroke=0)

    # Logo
    logo_bytes = _load_image_bytes(school.get('logo_url'))
    if logo_bytes:
        try:
            ir = ImageReader(io.BytesIO(logo_bytes))
            c.drawImage(ir, ox + 3*mm, oy + H - 18*mm, 12*mm, 12*mm,
                        preserveAspectRatio=True, mask='auto')
            txt_x = ox + 17*mm
        except Exception:
            txt_x = ox + 4*mm
    else:
        c.setFillColor(colors.HexColor('#1e40af'))
        c.circle(ox + 8*mm, oy + H - 12*mm, 5*mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont('Helvetica-Bold', 5)
        c.drawCentredString(ox + 8*mm, oy + H - 13*mm, 'LOGO')
        txt_x = ox + 16*mm

    # School name — fit to available width
    sname = (school.get('name') or 'School Name').upper()
    avail_w = W - (txt_x - ox) - 16*mm   # leave room for "ID CARD" label
    fs = _fit_text(c, sname, 'Helvetica-Bold', 8, 5, avail_w)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', fs)
    c.drawString(txt_x, oy + H - 10*mm, sname)

    city = (school.get('city') or school.get('address') or '')[:32]
    c.setFont('Helvetica', 5.5)
    c.setFillColor(colors.HexColor('#bfdbfe'))
    c.drawString(txt_x, oy + H - 14.5*mm, city)

    c.setFillColor(ACCENT)
    c.setFont('Helvetica-Bold', 5)
    c.drawRightString(ox + W - 3*mm, oy + H - 17*mm, 'STUDENT ID CARD')

    # ── Student Photo ──
    photo_bytes = _load_image_bytes(student.get('photo_url'))
    photo_cx = ox + W / 2
    photo_cy = oy + H - 32*mm
    photo_r  = 9*mm

    _draw_rounded_rect(c, photo_cx - photo_r - 1*mm, photo_cy - photo_r - 1*mm,
                       (photo_r + 1*mm)*2, (photo_r + 1*mm)*2, photo_r + 1*mm,
                       fill_color=LBLUE)
    _draw_photo_circle(c, photo_cx, photo_cy, photo_r, photo_bytes)

    # ── Student Name — FIXED: proper font sizing, no overlap ──
    name = (student.get('name') or 'Student').upper()
    name_y = oy + H - 43.5*mm
    name_fs = _fit_text(c, name, 'Helvetica-Bold', 9, 6, W - 6*mm)
    c.setFont('Helvetica-Bold', name_fs)
    c.setFillColor(NAVY)
    c.drawCentredString(ox + W / 2, name_y, name)

    # Divider
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.5)
    c.line(ox + 6*mm, name_y - 2*mm, ox + W - 6*mm, name_y - 2*mm)

    # ── Info grid — 2 columns, NO Adm. No. ──
    # Rows: left col + right col side by side
    rows = [
        ('Roll No.', student.get('roll_number') or '—'),
        ('Blood Gr.', student.get('blood_group') or '—'),
        ('Father', (student.get('father_name') or student.get('parent_name') or '—')[:14]),
        ('Mobile', student.get('parent_phone') or '—'),
        ('Class', (cls_name or '—')[:14]),
        ('Session', student.get('session') or '—'),
        ('DOB', str(student.get('dob') or '—')[:10]),
        ('Gender', student.get('gender') or '—'),
    ]

    info_y  = name_y - 7*mm   # naam se zyada gap
    row_gap = 5.8*mm           # label + value + breathing room
    lx = ox + 3*mm
    rx = ox + W / 2 + 1*mm
    col_w = W / 2 - 4*mm

    for i, (label, val) in enumerate(rows):
        col_x = lx if i % 2 == 0 else rx
        row_y = info_y - (i // 2) * row_gap

        # Label
        c.setFont('Helvetica', 4.8)
        c.setFillColor(GREY)
        c.drawString(col_x, row_y, label)

        # Value — 3.2mm neeche label se
        val_fs = _fit_text(c, str(val), 'Helvetica-Bold', 6.2, 4.5, col_w)
        c.setFont('Helvetica-Bold', val_fs)
        c.setFillColor(DGREY)
        c.drawString(col_x, row_y - 3.2*mm, str(val))

    # Bottom bar
    _draw_rounded_rect(c, ox, oy, W, 7*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY)
    c.rect(ox, oy + 4*mm, W, 3*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 5.5)
    footer = 'If found, return to school | ' + (school.get('phone') or '')
    c.drawCentredString(ox + W / 2, oy + 2.5*mm, footer)


# ── BACK SIDE ─────────────────────────────────────────────────────────────────
def _draw_back(c, ox, oy, student, school):
    W, H = CW, CH

    _draw_rounded_rect(c, ox, oy, W, H, 4*mm, fill_color=WHITE, stroke_color=BLUE, stroke_width=0.5)

    # Header
    _draw_rounded_rect(c, ox, oy + H - 12*mm, W, 12*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY)
    c.rect(ox, oy + H - 12*mm, W, 6*mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(ox, oy + H - 13*mm, W, 1*mm, fill=1, stroke=0)

    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 7)
    c.drawCentredString(ox + W/2, oy + H - 8*mm, 'STUDENT IDENTITY CARD')
    c.setFont('Helvetica', 5)
    c.setFillColor(colors.HexColor('#bfdbfe'))
    c.drawCentredString(ox + W/2, oy + H - 11*mm, (school.get('name') or '')[:30])

    # ── QR Code — plain text, Google Lens scannable ──
    student_with_school = {**student, 'school_name': school.get('name', '')}
    qr_img  = _make_qr(student_with_school)
    qr_size = 22*mm
    qr_x    = ox + W/2 - qr_size/2
    qr_y    = oy + H - 38*mm

    _draw_rounded_rect(c, qr_x - 2*mm, qr_y - 2*mm, qr_size + 4*mm, qr_size + 4*mm,
                       2*mm, fill_color=LGREY, stroke_color=BLUE, stroke_width=0.5)
    c.drawImage(qr_img, qr_x, qr_y, qr_size, qr_size, mask='auto')

    c.setFont('Helvetica-Bold', 5.5)
    c.setFillColor(NAVY)
    c.drawCentredString(ox + W/2, oy + H - 40.5*mm, 'SCAN TO VERIFY')

    # School contact box
    cy = oy + H - 47*mm
    c.setFillColor(LGREY)
    c.roundRect(ox + 3*mm, cy - 8*mm, W - 6*mm, 9*mm, 2*mm, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 5.5)
    c.setFillColor(NAVY)
    c.drawString(ox + 5*mm, cy - 1*mm, (school.get('name') or '')[:28])
    c.setFont('Helvetica', 5)
    c.setFillColor(GREY)
    c.drawString(ox + 5*mm, cy - 3.5*mm, (school.get('address') or school.get('city') or '')[:40])
    c.drawString(ox + 5*mm, cy - 6*mm,
                 'Ph: ' + (school.get('phone') or '') + '  ' + (school.get('email') or '')[:20])

    # Terms
    tc_y = oy + H - 59*mm
    c.setFont('Helvetica-Bold', 5.5)
    c.setFillColor(BLUE)
    c.drawString(ox + 3.5*mm, tc_y, 'TERMS & CONDITIONS')
    c.setStrokeColor(BLUE)
    c.setLineWidth(0.4)
    c.line(ox + 3.5*mm, tc_y - 0.8*mm, ox + W - 3.5*mm, tc_y - 0.8*mm)

    for i, t in enumerate([
        '• Card must be carried at all times.',
        '• Lost card must be reported immediately.',
        '• This card is property of the school.',
        '• Misuse will lead to disciplinary action.',
    ]):
        c.setFont('Helvetica', 4.8)
        c.setFillColor(DGREY)
        c.drawString(ox + 3.5*mm, tc_y - 3.5*mm - i * 3.8*mm, t)

    # Signature
    # Signature — actual uploaded image, drawn above the line
    from reportlab.lib.utils import ImageReader
    sig_y = oy + 11*mm
    sig_bytes = _load_image_bytes(school.get('principal_signature_url'))
    if sig_bytes:
        try:
            ir = ImageReader(io.BytesIO(sig_bytes))
            c.drawImage(ir, ox + 5*mm, sig_y + 0.5*mm, 22*mm, 6*mm,
                        preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"[id_card] signature draw failed: {e}")
    c.setStrokeColor(colors.HexColor('#cbd5e1'))
    c.setLineWidth(0.5)
    c.line(ox + 5*mm, sig_y, ox + 28*mm, sig_y)
    c.setFont('Helvetica-Bold', 5)
    c.setFillColor(NAVY)
    c.drawString(ox + 5*mm, sig_y - 3.5*mm, 'Principal Signature')

    # Footer
    # Authorized signature — small, above bottom bar
    from reportlab.lib.utils import ImageReader
    fsig_y = oy + 9*mm
    fsig_bytes = _load_image_bytes(school.get('principal_signature_url'))
    if fsig_bytes:
        try:
            ir = ImageReader(io.BytesIO(fsig_bytes))
            c.drawImage(ir, ox + W - 22*mm, fsig_y + 0.5*mm, 18*mm, 5*mm,
                        preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"[id_card] front signature draw failed: {e}")
    c.setStrokeColor(colors.HexColor('#cbd5e1'))
    c.setLineWidth(0.4)
    c.line(ox + W - 22*mm, fsig_y, ox + W - 3*mm, fsig_y)
    c.setFont('Helvetica', 3.8)
    c.setFillColor(GREY)
    c.drawRightString(ox + W - 3*mm, fsig_y - 2.2*mm, 'Authorized Signatory')

    # Bottom bar
    _draw_rounded_rect(c, ox, oy, W, 7*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY)
    c.rect(ox, oy + 4*mm, W, 3*mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 5.5)
    footer = 'If found, return to school | ' + (school.get('phone') or '')
    c.drawCentredString(ox + W / 2, oy + 2.5*mm, footer)


# ── EMPLOYEE FRONT ────────────────────────────────────────────────────────────
def _draw_employee_front(c, ox, oy, employee, school):
    from reportlab.lib.utils import ImageReader
    W, H = CW, CH

    _draw_rounded_rect(c, ox, oy, W, H, 4*mm, fill_color=WHITE, stroke_color=BLUE, stroke_width=0.5)
    _draw_rounded_rect(c, ox, oy + H - 20*mm, W, 20*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY)
    c.rect(ox, oy + H - 20*mm, W, 10*mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(ox, oy + H - 21.5*mm, W, 1.5*mm, fill=1, stroke=0)

    logo_bytes = _load_image_bytes(school.get('logo_url'))
    if logo_bytes:
        try:
            ir = ImageReader(io.BytesIO(logo_bytes))
            c.drawImage(ir, ox + 3*mm, oy + H - 18*mm, 12*mm, 12*mm,
                        preserveAspectRatio=True, mask='auto')
            txt_x = ox + 17*mm
        except Exception:
            txt_x = ox + 4*mm
    else:
        c.setFillColor(colors.HexColor('#1e40af'))
        c.circle(ox + 8*mm, oy + H - 12*mm, 5*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 5)
        c.drawCentredString(ox + 8*mm, oy + H - 13*mm, 'LOGO')
        txt_x = ox + 16*mm

    sname = (school.get('name') or '').upper()
    avail_w = W - (txt_x - ox) - 18*mm
    fs = _fit_text(c, sname, 'Helvetica-Bold', 8, 5, avail_w)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', fs)
    c.drawString(txt_x, oy + H - 10*mm, sname)
    c.setFont('Helvetica', 5.5); c.setFillColor(colors.HexColor('#bfdbfe'))
    c.drawString(txt_x, oy + H - 14.5*mm, (school.get('city') or '')[:32])
    c.setFillColor(ACCENT); c.setFont('Helvetica-Bold', 5)
    c.drawRightString(ox + W - 3*mm, oy + H - 17*mm, 'EMPLOYEE ID CARD')

    # Photo
    photo_bytes = _load_image_bytes(employee.get('photo_url'))
    photo_cx = ox + W / 2
    photo_cy = oy + H - 32*mm
    photo_r  = 9*mm
    _draw_rounded_rect(c, photo_cx - photo_r - 1*mm, photo_cy - photo_r - 1*mm,
                       (photo_r + 1*mm)*2, (photo_r + 1*mm)*2, photo_r + 1*mm, fill_color=LBLUE)
    _draw_photo_circle(c, photo_cx, photo_cy, photo_r, photo_bytes)

    # Name
    name = (employee.get('name') or 'Employee').upper()
    name_y = oy + H - 43.5*mm
    name_fs = _fit_text(c, name, 'Helvetica-Bold', 9, 6, W - 6*mm)
    c.setFont('Helvetica-Bold', name_fs); c.setFillColor(NAVY)
    c.drawCentredString(ox + W/2, name_y, name)

    # Designation
    desig = employee.get('designation') or ''
    desig_fs = _fit_text(c, desig, 'Helvetica', 7, 5.5, W - 6*mm)
    c.setFont('Helvetica', desig_fs); c.setFillColor(BLUE)
    c.drawCentredString(ox + W/2, name_y - 3.5*mm, desig)

    c.setStrokeColor(BLUE); c.setLineWidth(0.5)
    c.line(ox + 6*mm, name_y - 5.5*mm, ox + W - 6*mm, name_y - 5.5*mm)

    # Info
    rows = [
        ('Emp. ID',  employee.get('employee_id') or '—'),
        ('Dept.',    (employee.get('department')  or '—')[:14]),
        ('Joining',  str(employee.get('joining_date') or '—')[:10]),
        ('Mobile',   employee.get('phone') or '—'),
    ]
    info_y  = name_y - 9*mm
    row_gap = 5*mm
    lx = ox + 3*mm
    rx = ox + W/2 + 1*mm
    col_w = W/2 - 4*mm

    for i, (label, val) in enumerate(rows):
        col_x = lx if i % 2 == 0 else rx
        row_y = info_y - (i // 2) * row_gap
        c.setFont('Helvetica', 5.2); c.setFillColor(GREY)
        c.drawString(col_x, row_y, label)
        val_fs = _fit_text(c, str(val), 'Helvetica-Bold', 6.5, 5, col_w)
        c.setFont('Helvetica-Bold', val_fs); c.setFillColor(DGREY)
        c.drawString(col_x, row_y - 3.2*mm, str(val))

    # Bottom
    _draw_rounded_rect(c, ox, oy, W, 7*mm, 4*mm, fill_color=NAVY)
    c.setFillColor(NAVY); c.rect(ox, oy + 4*mm, W, 3*mm, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 5.5)
    c.drawCentredString(ox + W/2, oy + 2.5*mm, (school.get('name') or '') + ' | ' + (school.get('phone') or ''))


# ── PUBLIC API ────────────────────────────────────────────────────────────────
def generate_id_card_pdf(student_dict, school_dict, class_name='', card_type='student'):
    buf = io.BytesIO()
    pw, ph = A4
    c = canvas.Canvas(buf, pagesize=A4)
    ox = (pw - CW) / 2
    oy = (ph - CH) / 2

    if card_type == 'employee':
        _draw_employee_front(c, ox, oy, student_dict, school_dict)
    else:
        _draw_front(c, ox, oy, student_dict, school_dict, class_name)

    c.saveState()
    c.setFillColor(colors.HexColor('#e8f4fd'))
    c.setFont('Helvetica', 7)
    c.drawCentredString(pw/2, oy - 8*mm, 'EduERP School Management System — ID Card')
    c.restoreState()
    c.showPage()

    _draw_back(c, ox, oy, student_dict, school_dict)

    c.saveState()
    c.setFillColor(colors.HexColor('#e8f4fd'))
    c.setFont('Helvetica', 7)
    c.drawCentredString(pw/2, oy - 8*mm, 'EduERP School Management System — ID Card')
    c.restoreState()
    c.save()
    buf.seek(0)
    return buf
