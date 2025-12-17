# suggestion_engine.py

from app.logic.conflict_engine import find_conflicts
from app.logic.week_engine import get_week_stats
from app.logic.today_engine import get_today_view

def get_suggestions():
    suggestions = []

    # 1) Conflict-based suggestions
    conflicts = find_conflicts()
    if conflicts:
        c = conflicts[0]
        task_a = c["task_a"]["title"]
        task_b = c["task_b"]["title"]
        suggestions.append({
            "reason": "conflict",
            "message": f"'{task_a}' overlaps with '{task_b}'. You may want to move one of them."
        })

    # 2) Overload suggestion (weekly)
    stats = get_week_stats()
    if stats["busiest_day"] and stats["busiest_day"]["count"] >= 3:
        wd = stats["busiest_day"]["weekday"]
        suggestions.append({
            "reason": "overload",
            "message": f"{wd} looks heavy — consider spreading tasks across the week."
        })

    return {"suggestions": suggestions}
