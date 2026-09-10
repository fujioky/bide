"""Environment configuration + tiny shared helpers (stdlib only)."""
import os
from datetime import datetime

DATA_DIR = os.environ.get("DATA_DIR", "/data")
DB_PATH = os.path.join(DATA_DIR, "quant.duckdb")
PORT = int(os.environ.get("PORT", "8080"))
API_KEY = os.environ.get("QUANT_API_KEY", "")
AUTO_JOBS = os.environ.get("AUTO_JOBS", "1") == "1"

# ---- mail (direct SMTP; 163 by default, SSL on 465) ----
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.163.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "") or SMTP_USER
MAIL_TO = [x.strip() for x in os.environ.get("MAIL_TO", "").split(",") if x.strip()]


def log(*a):
    print("[quant]", datetime.utcnow().strftime("%H:%M:%S"), *a, flush=True)
