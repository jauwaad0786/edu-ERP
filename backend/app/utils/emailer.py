# backend/app/utils/emailer.py
"""
Chhota SMTP helper — sirf website-lead notifications ke liye (demo request /
contact message aaya to CEO ke personal email pe alert). Best-effort: agar
SMTP env vars set nahi hain ya bhejte waqt fail ho jaye, poora request 500
nahi hona chahiye — sirf console me warning aayegi. Caller
(routes/leads.py) is wajah se exception ko kabhi upar bubble nahi hone deta.
"""

import os
import smtplib
from email.mime.text import MIMEText


def send_lead_notification_email(lead):
    """
    lead: WebsiteLead instance (already committed).

    Zaroori env vars (Render → backend service → Environment):
      SMTP_HOST          e.g. smtp-relay.brevo.com
      SMTP_PORT          e.g. 587
      SMTP_USER          Brevo dashboard ke "SMTP" tab ka Login
      SMTP_PASSWORD      Brevo SMTP key
      SMTP_FROM_EMAIL    verified sender email (e.g. oneplatform360@gmail.com)
      LEADS_NOTIFY_EMAIL jis personal email pe alert chahiye
    """
    smtp_host     = os.environ.get('SMTP_HOST')
    smtp_port     = os.environ.get('SMTP_PORT', '587')
    smtp_user     = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    notify_to     = os.environ.get('LEADS_NOTIFY_EMAIL', smtp_user)
    from_email    = os.environ.get('SMTP_FROM_EMAIL', smtp_user)

    if not all([smtp_host, smtp_user, smtp_password, notify_to]):
        print('⚠️  SMTP env vars missing — lead notification email skipped')
        return False

    kind = 'Demo Request' if lead.lead_type == 'DEMO' else 'Contact Message'
    subject = f'🔔 New {kind} — {lead.name} ({lead.company or lead.source})'

    lines = [
        f'New {kind} received from {lead.source}',
        '',
        f'Name:    {lead.name}',
        f'Company: {lead.company or "-"}',
        f'Email:   {lead.email}',
        f'Phone:   {lead.phone or "-"}',
        f'City:    {lead.city or "-"}',
        f'Service: {lead.service or "-"}',
    ]
    if lead.org_size:
        lines.append(f'Size:    {lead.org_size}')
    lines += [
        '',
        'Message:',
        lead.message or '(no message)',
        '',
        f'View in CEO panel -> /developer/leads (Lead #{lead.id})',
    ]

    body = '\n'.join(lines)

    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = subject
    msg['From'] = from_email
    msg['To'] = notify_to

    try:
        with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [notify_to], msg.as_string())
        return True
    except Exception as e:
        print(f'⚠️  Failed to send lead notification email: {e}')
        return False
