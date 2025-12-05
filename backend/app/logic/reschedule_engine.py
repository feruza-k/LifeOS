# app/logic/reschedule_engine.py

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import pytz

from app.logic.today_engine import get_today_view
from app.logic.week_engine import get_week_view, get_week_stats
from app.logic.task_engine import get_all_tasks, parse_datetime
from app.logic.conflict_engine import find_conflicts

tz = pytz.timezone("Europe/London")


def _format_block(start: datetime, end: datetime) -> str:
    """Return a human-readable time block."""
    return f"{start.strftime('%H:%M')}–{end.strftime('%H:%M')}"


def _block_to_suggestion(block: dict, task_title: str) -> str:
    """Convert a free block to a user-friendly suggestion string."""
    return f"Move '{task_title}' to {block['start']}–{block['end']}"


def _find_free_blocks_for_week():
    """Combine free blocks across all days of the week."""
    week = get_week_view()
    suggestions = []

    for day in week["days"]:
        date = day["date"]
        tasks = sorted(day["tasks"], key=lambda x: x.get("time") or "")
        
        free_blocks = []
        from app.logic.today_engine import _get_free_blocks
        
        # Trick: reuse the same free block engine by pretending today = target day
        free_blocks = _get_free_blocks(tasks)

        for fb in free_blocks:
            suggestions.append({
                "date": date,
                "start": fb["start"],
                "end": fb["end"],
            })

    return suggestions


def get_reschedule_options(task_id: str) -> Dict:
    """
    Suggest alternative time slots based on:
    - Free blocks today
    - Free blocks this week
    - Lighter days of the week
    """
    tasks = get_all_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return {"error": "Task not found"}

    task_dt = parse_datetime(task)
    title = task.get("title", "task")

    # -------------------------------------------------------
    # 1) TODAY free blocks
    # -------------------------------------------------------
    today_view = get_today_view()
    today_blocks = today_view["free_blocks"]

    today_suggestions = [
        _block_to_suggestion(fb, title) 
        for fb in today_blocks
    ]

    # -------------------------------------------------------
    # 2) WEEK free blocks
    # -------------------------------------------------------
    week_free = _find_free_blocks_for_week()
    week_suggestions = [
        f"Move '{title}' to {b['date']} at {b['start']}"
        for b in week_free
    ]

    # -------------------------------------------------------
    # 3) Suggest lighter days
    # -------------------------------------------------------
    stats = get_week_stats()
    lighter = [
        d["weekday"] for d in stats["days"] 
        if d["count"] < stats["busiest_day"]["count"]
    ]

    lighter_suggestions = [
        f"Consider moving '{title}' to a lighter day: {', '.join(lighter)}"
    ] if lighter else []

    return {
        "task": task,
        "suggestions": today_suggestions[:3]    # limit noise
                      + week_suggestions[:3] 
                      + lighter_suggestions
    }
