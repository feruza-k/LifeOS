# app/logic/conflict_engine.py

from datetime import timedelta, datetime
from typing import List, Dict, Optional
import pytz

from app.logic.task_engine import parse_datetime, get_all_tasks

tz = pytz.timezone("Europe/London")

def _parse_end_datetime(task, start_dt: datetime) -> datetime:
    """
    Determine the end datetime for a task.

    Priority:
    1. If end_datetime is set, use it
    2. Else if duration_minutes is set, add that to start
    3. Else use sensible defaults:
       - events: 60 minutes
       - reminders: 15 minutes
    """
    end_str = task.get("end_datetime")
    if end_str:
        try:
            return tz.localize(datetime.strptime(end_str, "%Y-%m-%d %H:%M"))
        except Exception:
            pass

    duration = task.get("duration_minutes")
    if duration is not None:
        return start_dt + timedelta(minutes=duration)

    # Default durations
    if task.get("type") == "event":
        return start_dt + timedelta(minutes=60)
    else:
        return start_dt + timedelta(minutes=15)

def get_scheduled_blocks(
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None
) -> List[Dict]:
    """
    Build a list of scheduled time blocks for tasks that have a datetime.
    """
    tasks = get_all_tasks()
    blocks = []

    start_date = (
        datetime.strptime(start_date_str, "%Y-%m-%d").date()
        if start_date_str else None
    )
    end_date = (
        datetime.strptime(end_date_str, "%Y-%m-%d").date()
        if end_date_str else None
    )

    for t in tasks:
        start_dt = parse_datetime(t)
        if not start_dt:
            continue

        # Filter by optional date range
        if start_date and start_dt.date() < start_date:
            continue
        if end_date and start_dt.date() > end_date:
            continue

        end_dt = _parse_end_datetime(t, start_dt)

        blocks.append(
            {
                "task": t,
                "start": start_dt,
                "end": end_dt,
            }
        )

    blocks.sort(key=lambda b: b["start"])
    return blocks

def find_conflicts(
    start: Optional[str] = None,
    end: Optional[str] = None
) -> List[Dict]:
    """
    Find conflicts between scheduled tasks *on the same date*.
    """
    blocks = get_scheduled_blocks(start, end)
    conflicts = []

    for i in range(len(blocks) - 1):
        a = blocks[i]
        b = blocks[i + 1]

        # -----------------------------------------------------
        # NEW RULE: Must be SAME DATE to count as conflict
        # -----------------------------------------------------
        if a["start"].date() != b["start"].date():
            continue

        # Overlap detection
        if b["start"] < a["end"]:
            overlap_start = max(a["start"], b["start"])
            overlap_end = min(a["end"], b["end"])

            conflicts.append(
                {
                    "task_a": a["task"],
                    "task_b": b["task"],
                    "overlap_start": overlap_start.strftime("%Y-%m-%d %H:%M"),
                    "overlap_end": overlap_end.strftime("%Y-%m-%d %H:%M"),
                }
            )

    return conflicts
