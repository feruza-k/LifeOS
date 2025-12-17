# app/logic/ui_builder.py

from datetime import datetime
import pytz

from app.logic.today_engine import get_today_view
from app.logic.week_engine import get_week_stats, get_week_view
from app.logic.task_engine import get_all_tasks
from app.logic.categories import CATEGORY_COLORS

tz = pytz.timezone("Europe/London")

def _format_task_ui(t):
    return {
        "id": t.get("id"),
        "title": t.get("title"),
        "time": t.get("time"),
        "time_label": t.get("time") or "",
        "date": t.get("date"),
        "datetime": t.get("datetime"),
        "type": t.get("type"),
        "category": t.get("category"),
        "color": CATEGORY_COLORS.get(t.get("category"), CATEGORY_COLORS["default"]),
        "is_completed": t.get("completed", False),
    }

# TODAY UI SHAPE
def build_today_ui():
    raw = get_today_view()

    return {
        "screen": "today",
        "date": raw["date"],
        "load": raw["load"],
        "sections": {
            "morning": [_format_task_ui(t) for t in raw["morning_tasks"]],
            "afternoon": [_format_task_ui(t) for t in raw["afternoon_tasks"]],
            "evening": [_format_task_ui(t) for t in raw["evening_tasks"]],
            "free_blocks": raw["free_blocks"],
        }
    }

# WEEK UI SHAPE
def build_week_ui():
    stats = get_week_stats()
    raw = get_week_view()

    days_ui = []
    for day in raw["days"]:
        tasks = [_format_task_ui(t) for t in day["tasks"]]
        date_obj = datetime.strptime(day["date"], "%Y-%m-%d")

        days_ui.append({
            "date": day["date"],
            "weekday": date_obj.strftime("%A"),
            "weekday_short": date_obj.strftime("%a"),
            "date_label": date_obj.strftime("%a, %d %b"),
            "tasks": tasks,
            "task_count": len(tasks),
        })

    return {
        "screen": "week",
        "week_start": stats["week_start"],
        "week_end": stats["week_end"],
        "total_tasks": stats["total_tasks"],
        "busiest_day": stats["busiest_day"],
        "days": days_ui,
    }

# CALENDAR (GENERIC RANGE) UI SHAPE
def build_calendar_ui(start: str, end: str):
    from app.logic.week_engine import get_tasks_in_range
    raw = get_tasks_in_range(start, end)

    days_ui = []
    for day in raw["days"]:
        date_obj = datetime.strptime(day["date"], "%Y-%m-%d")
        days_ui.append({
            "date": day["date"],
            "weekday": date_obj.strftime("%A"),
            "weekday_short": date_obj.strftime("%a"),
            "date_label": date_obj.strftime("%a, %d %b"),
            "tasks": [_format_task_ui(t) for t in day["tasks"]]
        })

    return {
        "screen": "calendar",
        "range_start": start,
        "range_end": end,
        "days": days_ui,
    }
