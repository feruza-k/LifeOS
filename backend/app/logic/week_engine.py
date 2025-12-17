# app/logic/week_engine.py

from datetime import datetime, timedelta
import pytz
from app.logic.task_engine import get_all_tasks 
tz = pytz.timezone("Europe/London")

def get_current_week_boundaries():
    """
    Return (week_start_date, week_end_date) as date objects.
    Week is Monday–Sunday, based on Europe/London time.
    """
    today = datetime.now(tz).date()
    # Monday = 0, Sunday = 6
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end

def get_week_view():
    """
    Return tasks grouped by day for the current week (Mon–Sun).

    Shape:

    {
      "week_start": "2025-12-01",
      "week_end": "2025-12-07",
      "days": [
        {
          "date": "2025-12-01",
          "weekday": "Monday",
          "tasks": [ ... ]
        },
        ...
      ]
    }
    """
    week_start, week_end = get_current_week_boundaries()
    tasks = get_all_tasks()  # already sorted + status from task_engine

    days = []
    for offset in range(7):
        day = week_start + timedelta(days=offset)
        day_str = day.strftime("%Y-%m-%d")
        weekday_name = day.strftime("%A")

        day_tasks = [t for t in tasks if t.get("date") == day_str]

        days.append(
            {
                "date": day_str,
                "weekday": weekday_name,
                "tasks": day_tasks,
            }
        )

    return {
        "week_start": week_start.strftime("%Y-%m-%d"),
        "week_end": week_end.strftime("%Y-%m-%d"),
        "days": days,
    }

def get_tasks_in_range(start_date_str: str, end_date_str: str):
    """
    Generic calendar range helper.

    Inputs are date strings: 'YYYY-MM-DD'
    Returns tasks grouped by day between start and end (inclusive).

    Shape:
    {
      "start": "...",
      "end": "...",
      "days": [
        { "date": "...", "weekday": "...", "tasks": [...] },
        ...
      ]
    }
    """
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")

    tasks = get_all_tasks()
    days = []

    current = start_date
    while current <= end_date:
        day_str = current.strftime("%Y-%m-%d")
        weekday_name = current.strftime("%A")

        day_tasks = [t for t in tasks if t.get("date") == day_str]

        days.append(
            {
                "date": day_str,
                "weekday": weekday_name,
                "tasks": day_tasks,
            }
        )
        current += timedelta(days=1)

    return {
        "start": start_date_str,
        "end": end_date_str,
        "days": days,
    }

# Week statistics

def get_week_stats():
    """
    Return simple statistics for the current week (Mon–Sun).
    Uses get_week_view() under the hood.
    """
    week = get_week_view()
    days = week["days"]

    total_tasks = 0
    total_events = 0
    total_reminders = 0
    total_evening_tasks = 0  # tasks at or after 18:00

    day_summaries = []

    for day in days:
        tasks = day.get("tasks", [])
        count = len(tasks)
        total_tasks += count

        events = sum(1 for t in tasks if t.get("type") == "event")
        reminders = sum(1 for t in tasks if t.get("type") == "reminder")

        total_events += events
        total_reminders += reminders

        evening = sum(
            1
            for t in tasks
            if t.get("time") and t["time"] >= "18:00"  # "HH:MM" string compare works
        )
        total_evening_tasks += evening

        day_summaries.append(
            {
                "date": day["date"],
                "weekday": day["weekday"],
                "count": count,
                "events": events,
                "reminders": reminders,
                "evening_tasks": evening,
            }
        )

    # Find busiest and free days
    busiest_day = None
    if day_summaries:
        busiest_day = max(day_summaries, key=lambda d: d["count"])
        if busiest_day["count"] == 0:
            busiest_day = None

    free_days = [
        {"date": d["date"], "weekday": d["weekday"]}
        for d in day_summaries
        if d["count"] == 0
    ]

    return {
        "week_start": week["week_start"],
        "week_end": week["week_end"],
        "total_tasks": total_tasks,
        "total_events": total_events,
        "total_reminders": total_reminders,
        "total_evening_tasks": total_evening_tasks,
        "days": day_summaries,
        "busiest_day": busiest_day,
        "free_days": free_days,
    }

# Human-readable week overview

def get_week_summary_text() -> str:
    """
    Create a short, human-readable summary of the current week.
    This is what the assistant could 'say' to you.
    """
    stats = get_week_stats()

    week_start = stats["week_start"]
    week_end = stats["week_end"]
    total_tasks = stats["total_tasks"]
    total_events = stats["total_events"]
    total_reminders = stats["total_reminders"]
    total_evening = stats["total_evening_tasks"]
    busiest = stats["busiest_day"]
    free_days = stats["free_days"]

    parts = []

    # Overall workload
    if total_tasks == 0:
        parts.append("You don't have anything scheduled this week yet.")
    else:
        parts.append(
            f"This week ({week_start} → {week_end}) you have {total_tasks} tasks in total "
            f"({total_events} events and {total_reminders} reminders)."
        )

    # Busiest day
    if busiest:
        parts.append(
            f"Your busiest day is {busiest['weekday']} with {busiest['count']} task(s)."
        )

    # Evening load
    if total_evening > 0:
        parts.append(
            f"There are {total_evening} task(s) scheduled for the evening (after 18:00)."
        )

    # Free days
    if free_days:
        names = ", ".join(d["weekday"] for d in free_days)
        parts.append(f"You still have fully free days on: {names}.")

    # If somehow nothing got added (edge case), fall back
    if not parts:
        parts.append("Your week looks very light at the moment.")

    return " ".join(parts)
