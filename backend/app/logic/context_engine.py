# app/logic/context_engine.py
"""
Context-aware action engine for SolAI assistant.

Generates contextual actions based on:
- Current view (today, calendar, task detail)
- User's current state (conflicts, load, patterns)
- Selected task (if any)
"""

from typing import List, Dict, Optional
from datetime import date, datetime
import pytz

from app.logic.conflict_engine import find_conflicts
from db.repo import db_repo

tz = pytz.timezone("Europe/London")

async def get_contextual_actions(
    user_id: str,
    current_view: str = "today",
    selected_task_id: Optional[str] = None,
    selected_date: Optional[str] = None
) -> List[Dict]:
    """
    Get actions relevant to current context.
    
    Args:
        user_id: User ID
        current_view: Current view ("today", "calendar", "task", "week", "month")
        selected_task_id: ID of currently selected task (if any)
        selected_date: Currently selected date (YYYY-MM-DD format)
    
    Returns:
        List of action dictionaries with id, label, description, priority
    """
    actions = []
    
    # 1. Check for conflicts (high priority)
    conflicts = await find_conflicts(user_id=user_id)
    if conflicts:
        actions.append({
            "id": "resolve_conflicts",
            "label": "Resolve conflicts",
            "description": f"You have {len(conflicts)} scheduling conflict(s) that need attention",
            "priority": "high",
            "type": "conflict",
            "count": len(conflicts)
        })
    
    # 2. If viewing a specific task
    if selected_task_id:
        task = await db_repo.get_task(selected_task_id, user_id)
        if task:
            actions.append({
                "id": "reschedule_task",
                "label": "Reschedule this",
                "description": f"Move '{task.get('title')}' to a different time",
                "priority": "medium",
                "type": "task_action",
                "task_id": selected_task_id
            })
    
    # 3. Context-specific actions based on view
    if current_view == "today":
        # Get today's load
        today_str = date.today().strftime("%Y-%m-%d")
        # Get tasks directly from database for the user and date
        today_tasks = await db_repo.get_tasks_by_date_and_user(today_str, user_id)
        task_count = len(today_tasks) if today_tasks else 0
        
        if task_count == 0:
            actions.append({
                "id": "focus_today",
                "label": "What should I focus on today?",
                "description": "Get suggestions for today",
                "priority": "low",
                "type": "suggestion"
            })
        elif task_count >= 5:
            actions.append({
                "id": "lighten_day",
                "label": "This day looks full",
                "description": "Consider moving some tasks to balance your schedule",
                "priority": "medium",
                "type": "suggestion"
            })
    
    elif current_view == "calendar":
        # If a date is selected, offer date-specific actions
        if selected_date:
            # Check if date has conflicts
            date_conflicts = await find_conflicts(
                start=selected_date,
                end=selected_date,
                user_id=user_id
            )
            if date_conflicts:
                actions.append({
                    "id": "resolve_date_conflicts",
                    "label": f"Resolve conflicts on {selected_date}",
                    "description": f"{len(date_conflicts)} conflict(s) on this date",
                    "priority": "high",
                    "type": "conflict",
                    "date": selected_date
                })
    
    # 4. End of day reflection (if it's evening)
    now = datetime.now(tz)
    if now.hour >= 18:  # After 6 PM
        today_str = now.strftime("%Y-%m-%d")
        # Get tasks directly from database for the user and date
        today_tasks = await db_repo.get_tasks_by_date_and_user(today_str, user_id)
        if today_tasks:
            completed = sum(1 for t in today_tasks if t.get("completed"))
            total = len(today_tasks)
            
            if total > 0:
                actions.append({
                    "id": "reflect_today",
                    "label": "How did today go?",
                    "description": f"Reflect on today ({completed}/{total} tasks completed)",
                    "priority": "low",
                    "type": "reflection"
                })
    
    # Sort by priority (high > medium > low)
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda a: priority_order.get(a.get("priority", "low"), 2))
    
    return actions

async def get_today_load(user_id: str, date_str: Optional[str] = None) -> Dict:
    """Get load information for a specific date (defaults to today)."""
    if not date_str:
        date_str = date.today().strftime("%Y-%m-%d")
    
    # Get tasks directly from database for the user and date
    tasks = await db_repo.get_tasks_by_date_and_user(date_str, user_id)
    if not tasks:
        tasks = []
    
    # Calculate load based on task count
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
        "date": date_str,
        "count": len(tasks),
        "scheduled": sum(1 for t in tasks if t.get("time")),
        "anytime": sum(1 for t in tasks if not t.get("time")),
        "completed": sum(1 for t in tasks if t.get("completed")),
        "load": load
    }

