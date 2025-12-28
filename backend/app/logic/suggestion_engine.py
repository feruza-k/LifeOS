# suggestion_engine.py

from app.logic.conflict_engine import find_conflicts
from app.logic.week_engine import get_week_stats
from app.logic.today_engine import get_today_view

async def get_suggestions(user_id: str = None, week_stats: dict = None):
    suggestions = []

    # 1) Conflict-based suggestions
    conflicts = await find_conflicts(user_id=user_id)
    if conflicts:
        c = conflicts[0]
        # Safety check for conflict structure
        task_a_data = c.get("task_a", {})
        task_b_data = c.get("task_b", {})
        
        # Handle both dict with "task" key and direct task dict
        task_a_title = task_a_data.get("title") or task_a_data.get("task", {}).get("title", "Task")
        task_b_title = task_b_data.get("title") or task_b_data.get("task", {}).get("title", "Task")
        
        suggestions.append({
            "reason": "conflict",
            "message": f"'{task_a_title}' overlaps with '{task_b_title}'. You may want to move one of them."
        })

    # 2) Overload suggestion (weekly)
    stats = week_stats or await get_week_stats(user_id)
    if stats.get("busiest_day") and stats["busiest_day"].get("count", 0) >= 3:
        wd = stats["busiest_day"]["weekday"]
        suggestions.append({
            "reason": "overload",
            "message": f"{wd} looks heavy — consider spreading tasks across the week."
        })

    return {"suggestions": suggestions}
