"""Scheduled jobs (APScheduler, UTC) — times unchanged from the single-file version."""
import time

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import AUTO_JOBS, log
from .db import universe_symbols
from .tasks import task_backfill_bars, task_cboe_chain, task_fundamentals
from .signals import scan_signals, signal_html, signal_subject
from .mail import send_mail


def job_signals():
    try:
        sc = scan_signals()
        if not sc["watch"]:
            log("signal scan: no data"); return
        subj = signal_subject(sc)
        r = send_mail(subj, signal_html(sc))
        log("signal mail sent", subj, r)
    except Exception as e:
        log("signal mail fail", e)


def job_daily():
    syms = universe_symbols()
    for s in syms:
        try:
            r = task_backfill_bars(s, period="5d")
            log("job bars", s, r.get("inserted"))
        except Exception as e:
            log("job bars fail", s, e)
    for s in syms:
        try:
            r = task_cboe_chain(s, 2)
            log("job cboe", s, r.get("inserted"))
        except Exception as e:
            log("job cboe fail", s, e)
        time.sleep(0.5)


def job_weekly():
    for s in universe_symbols():
        try:
            task_fundamentals(s)
            log("job fundamentals", s)
        except Exception as e:
            log("job fundamentals fail", s, e)


sched = BackgroundScheduler(timezone="UTC")


def start_scheduler() -> bool:
    """Register + start the cron jobs when AUTO_JOBS=1. Idempotent."""
    if not AUTO_JOBS or sched.running:
        return False
    sched.add_job(job_daily, CronTrigger(day_of_week="mon-fri", hour=21, minute=15))
    sched.add_job(job_weekly, CronTrigger(day_of_week="sun", hour=3, minute=0))
    # 北京时间 18:00 = UTC 10:00，报的是当天凌晨美股收盘那根 K 线
    sched.add_job(job_signals, CronTrigger(day_of_week="tue-sat", hour=10, minute=0))
    sched.start()
    log("scheduler on: bars+chain 21:15 UTC weekdays, fundamentals Sun 03:00 UTC")
    return True
