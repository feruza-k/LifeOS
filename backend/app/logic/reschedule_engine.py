# app/logic/reschedule_engine.py

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import pytz

from app.logic.week_engine import get_week_view, get_week_stats
from app.logic.task_engine import get_all_tasks, parse_datetime
from app.logic.conflict_engine import find_conflicts

tz = pytz.timezone("Europe/London")


def _format_block(start: datetime, end: datetime) -> str:
    return f"{start.strftime('%H:%M')}–{end.strftime('%H:%M')}"


def _block_to_suggestion(block: dict, task_title: str) -> str:
    return f"Move '{task_title}' to {block['start']}–{block['end']}"


def _find_lighter_days_for_week():
    """Find days in the week with fewer tasks."""
    stats = get_week_stats()
    lighter_days = [
        {"date": d["date"], "weekday": d["weekday"], "count": d["count"]}
        for d in stats["days"]
        if d["count"] < stats.get("busiest_day", {}).get("count", 999)
    ]
    return sorted(lighter_days, key=lambda x: x["count"])[:3]  # Top 3 lightest days


# ---------------------------------------------------------
# ORIGINAL API — used by /assistant/reschedule-options endpoint
# ---------------------------------------------------------
def generate_reschedule_suggestions(task_id: str) -> Dict:
    tasks = get_all_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return {"error": "Task not found"}

    title = task.get("title", "task")

    # Suggest lighter days in the week
    lighter_days = _find_lighter_days_for_week()
    lighter_suggestions = [
        f"Consider moving '{title}' to {day['weekday']} ({day['date']}) — only {day['count']} task(s) scheduled."
        for day in lighter_days
    ]

    return {
        "task": task,
        "suggestions": lighter_suggestions[:3]  # Top 3 lighter day suggestions
    }


# ---------------------------------------------------------
# NEW WRAPPER — used by assistant.py (accepts full task dict)
# ---------------------------------------------------------
def generate_reschedule_suggestions_for_task(task: dict) -> List[str]:
    """
    Accepts a task dict directly (used by LLM assistant),
    returns a LIST of suggestion STRINGS.
    """
    full = generate_reschedule_suggestions(task["id"])

    # Extract only list of strings
    return full.get("suggestions", [])
