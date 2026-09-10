"""直连 SMTP 发信。失败只记日志不抛（调用方决定要不要关心返回值）。"""
import logging
import smtplib
from email.message import EmailMessage

from ..config import settings

log = logging.getLogger("mailer")


def ready() -> bool:
    return bool(settings.smtp_user and settings.smtp_pass)


def send(subject: str, html: str, to: list[str] | None = None, sender_name: str = "BIDE") -> dict:
    to = [x for x in (to or settings.notify_to) if x]
    if not to:
        return {"ok": False, "why": "NOTIFY_TO 未设置"}
    if not ready():
        return {"ok": False, "why": "SMTP 未配置"}
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{settings.mail_from}>"
    msg["To"] = ", ".join(to)
    msg.set_content("此邮件需要支持 HTML 的客户端查看。")
    msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=20) as s:
            s.login(settings.smtp_user, settings.smtp_pass)
            s.send_message(msg)
        return {"ok": True, "to": to}
    except Exception as e:  # noqa: BLE001
        log.warning("mail send failed: %s", e)
        return {"ok": False, "why": str(e)[:200]}
