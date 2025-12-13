# insight_engine.py

from typing import List, Optional
from datetime import datetime, timedelta
import pytz
from app.logic.today_engine import get_today_view


# Import your real existing functions
from app.logic.week_engine import (
    get_week_stats,
    get_week_view,
)
from app.logic.task_engine import (
    get_tasks_today,
    get_upcoming_tasks,
    get_overdue_tasks,
    get_next_task,
)
from app.logic.conflict_engine import find_conflicts

tz = pytz.timezone("Europe/London")


def _insight(text: str) -> dict:
    """Wrap insights in a clean structure."""
    return {"message": text}


def get_insights() -> List[dict]:
    """
    Generate Insight Engine:
    - Today load
    - Weekly load
    - Busiest/free days
    - Conflicts
    - Evening load
    - Next task
    """
    insights = []

    # -----------------------------------------------------
    # 1) TODAY OVERVIEW
    # -----------------------------------------------------
    today_tasks = get_tasks_today()
    if not today_tasks:
        insights.append(_insight("You have no tasks scheduled for today."))
    else:
        insights.append(
            _insight(f"You have {len(today_tasks)} task(s) scheduled today.")
        )

    # -----------------------------------------------------
    # 2) NEXT TASK
    # -----------------------------------------------------
    next_task = get_next_task()
    if next_task:
        insights.append(
            _insight(
                f"Your next upcoming task is '{next_task['title']}' at {next_task['datetime']}."
            )
        )

    # -----------------------------------------------------
    # 3) WEEK STATS
    # -----------------------------------------------------
    stats = get_week_stats()
    total = stats["total_tasks"]
    events = stats["total_events"]
    reminders = stats["total_reminders"]
    evening = stats["total_evening_tasks"]

    if total == 0:
        insights.append(_insight("Your week is currently empty — this is a good time to plan ahead."))
    else:
        insights.append(
            _insight(
                f"This week you have {total} tasks ({events} events and {reminders} reminders)."
            )
        )

    if evening > 0:
        insights.append(
            _insight(
                f"You have {evening} evening task(s). Evenings might get busy."
            )
        )

    # Busiest / free days
    busiest = stats["busiest_day"]
    free = stats["free_days"]

    if busiest:
        insights.append(
            _insight(
                f"Your busiest day is {busiest['weekday']} with {busiest['count']} task(s)."
            )
        )

    if free:
        names = ", ".join(d["weekday"] for d in free)
        insights.append(
            _insight(f"You still have fully free days on: {names}.")
        )

    # -----------------------------------------------------
    # 4) CONFLICT DETECTION
    # -----------------------------------------------------
    conflicts = find_conflicts()
    if conflicts:
        insights.append(
            _insight(
                f"You have {len(conflicts)} scheduling conflict(s) that may need attention."
            )
        )
    else:
        insights.append(_insight("No task conflicts detected."))

    # -----------------------------------------------------
    # 5) TODAY SUMMARY INSIGHT
    # -----------------------------------------------------
    today = get_today_view()

    if today["load"] == "empty":
        insights.append(_insight("Your day is completely free — good moment to reset or plan ahead."))
    elif today["load"] == "light":
        insights.append(_insight("Today looks light and manageable."))
    elif today["load"] == "heavy":
        insights.append(_insight("Today is quite full — try to keep some breathing room where possible."))


    return insights
