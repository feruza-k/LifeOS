# today_engine.py

from datetime import datetime, timedelta, time as time_obj
import pytz
from typing import List, Dict, Optional

from app.logic.task_engine import get_tasks_today, parse_datetime

tz = pytz.timezone("Europe/London")

DAY_START = time_obj(6, 0)   # 06:00
DAY_END = time_obj(22, 0)    # 22:00


def _default_duration(task):
    """Return default duration in minutes when none is defined."""
    if task.get("duration_minutes"):
        return task["duration_minutes"]

    return 60 if task.get("type") == "event" else 15


def _compute_end(task, start_dt):
    """Compute end datetime based on duration or default rules."""
    duration = _default_duration(task)
    return start_dt + timedelta(minutes=duration)


def _get_free_blocks(sorted_tasks: List[dict]) -> List[Dict]:
    """Detect free time blocks between tasks within DAY_START → DAY_END."""

    free = []

    # Convert day start/end into today's datetime
    today = datetime.now(tz).date()
    day_start_dt = tz.localize(datetime.combine(today, DAY_START))
    day_end_dt = tz.localize(datetime.combine(today, DAY_END))

    # If no tasks → entire day is free
    if not sorted_tasks:
        return [{"start": DAY_START.strftime("%H:%M"), "end": DAY_END.strftime("%H:%M")}]

    # 1) Block before first task
    first = sorted_tasks[0]
    first_dt = parse_datetime(first)
    if first_dt and first_dt > day_start_dt:
        free.append({
            "start": DAY_START.strftime("%H:%M"),
            "end": first_dt.strftime("%H:%M")
        })

    # 2) Blocks between tasks
    for i in range(len(sorted_tasks) - 1):
        current = sorted_tasks[i]
        nxt = sorted_tasks[i + 1]

        start_dt = parse_datetime(current)
        end_dt = _compute_end(current, start_dt)

        next_start = parse_datetime(nxt)

        if next_start > end_dt:
            free.append({
                "start": end_dt.strftime("%H:%M"),
                "end": next_start.strftime("%H:%M")
            })

    # 3) Block after last task
    last = sorted_tasks[-1]
    last_start = parse_datetime(last)
    last_end = _compute_end(last, last_start)

    if last_end < day_end_dt:
        free.append({
            "start": last_end.strftime("%H:%M"),
            "end": DAY_END.strftime("%H:%M")
        })

    return free


def _categorize_tasks(tasks: List[dict]):
    """Split tasks into morning/afternoon/evening buckets."""
    morning, afternoon, evening = [], [], []

    for t in tasks:
        if not t.get("time"):
            continue
        hour = int(t["time"][:2])
        if hour < 12:
            morning.append(t)
        elif hour < 18:
            afternoon.append(t)
        else:
            evening.append(t)

    return morning, afternoon, evening


def get_today_view() -> dict:
    """Return a structured picture of today."""
    tasks = sorted(get_tasks_today(), key=lambda x: x.get("time") or "")
    morning, afternoon, evening = _categorize_tasks(tasks)
    free_blocks = _get_free_blocks(tasks)

    # Determine load (very naive v1)
    total_tasks = len(tasks)
    if total_tasks == 0:
        load = "empty"
    elif total_tasks <= 2:
        load = "light"
    elif total_tasks <= 5:
        load = "medium"
    else:
        load = "heavy"

    return {
        "date": datetime.now(tz).strftime("%Y-%m-%d"),
        "tasks": tasks,
        "morning_tasks": morning,
        "afternoon_tasks": afternoon,
        "evening_tasks": evening,
        "free_blocks": free_blocks,
        "load": load
    }
