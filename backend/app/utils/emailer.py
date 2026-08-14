# backend/app/utils/emailer.py
"""
Brevo Transactional Email API (HTTPS) se lead notification email bhejta hai.
SMTP nahi use karta — Render free tier SMTP ports (587/465/2525) block karta
hai, isliye HTTPS API use kar rahe hain jo kisi bhi network pe kaam karta hai.

Zaroori env vars (Render -> backend service -> Environment):
  BREVO_API_KEY       Brevo dashboard -> SMTP & API -> API Keys -> Generate a new API key
  SMTP_FROM_EMAIL     verified sender email, e.g. oneplatform360@gmail.com
  LEADS_NOTIFY_EMAIL  jis personal email pe alert chahiye (default: SMTP_FROM_EMAIL wahi)
"""

import os
import requests

BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'


def send_lead_notification_email(lead):
    """
    lead: WebsiteLead instance (already committed).
    """
    api_key   = os.environ.get('BREVO_API_KEY')
    from_email = os.environ.get('SMTP_FROM_EMAIL')
    notify_to  = os.environ.get('LEADS_NOTIFY_EMAIL', from_email)

    if not all([api_key, from_email, notify_to]):
        print('⚠️  BREVO_API_KEY / SMTP_FROM_EMAIL / LEADS_NOTIFY_EMAIL missing — lead notification email skipped')
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
    body_text = '\n'.join(lines)
    body_html = '<br>'.join(lines)

    payload = {
        'sender': {'email': from_email, 'name': 'OnePlatform360 Leads'},
        'to': [{'email': notify_to}],
        'subject': subject,
        'textContent': body_text,
        'htmlContent': f'<pre style="font-family:inherit">{body_html}</pre>',
    }

    headers = {
        'accept': 'application/json',
        'api-key': api_key,
        'content-type': 'application/json',
    }

    try:
        resp = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            return True
        print(f'⚠️  Brevo API email failed: {resp.status_code} {resp.text}')
        return False
    except Exception as e:
        print(f'⚠️  Failed to send lead notification email: {e}')
        return False
