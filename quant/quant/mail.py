"""Outbound mail over direct SMTP (SSL).

Env: SMTP_HOST (smtp.163.com), SMTP_PORT (465), SMTP_USER, SMTP_PASS,
     MAIL_FROM (defaults to SMTP_USER), MAIL_TO (comma separated).
163 rejects mail whose From does not match the authenticated account
(554 DT:SPM), so leave MAIL_FROM unset unless you know the alias is allowed.
"""
import html as _html
import re
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

from .config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO


def mail_ready() -> bool:
    return bool(SMTP_HOST and SMTP_PORT and SMTP_USER and SMTP_PASS and MAIL_FROM and MAIL_TO)


def _plain(html: str) -> str:
    """Rough text fallback: strip tags, unescape entities, collapse whitespace."""
    t = re.sub(r"(?i)</(tr|div|p|h\d|table)>", "\n", html)
    t = re.sub(r"<[^>]+>", " ", t)
    t = _html.unescape(t)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def build_message(subject: str, html: str) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject            # policy.default RFC2047-encodes non-ASCII as UTF-8
    msg["From"] = f"QUANT <{MAIL_FROM}>"
    msg["To"] = ", ".join(MAIL_TO)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    msg.set_content(_plain(html), charset="utf-8")
    msg.add_alternative(html, subtype="html", charset="utf-8")
    return msg


def send_mail(subject: str, html: str) -> dict:
    if not mail_ready():
        raise RuntimeError("mail channel not configured")
    msg = build_message(subject, html)
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg, from_addr=MAIL_FROM, to_addrs=MAIL_TO)
    return {"to": list(MAIL_TO), "ok": True}
