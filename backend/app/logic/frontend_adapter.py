# frontend_adapter.py
# Transforms backend data structures to match frontend expectations

from datetime import datetime
from typing import Optional, Dict, Any, List


def backend_task_to_frontend(backend_task: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform backend task format to frontend Task format.
    
    Backend: {id, type, title, date, time, duration_minutes, end_datetime, category, notes, completed, energy, context}
    Frontend: {id, title, time?, endTime?, completed, value, date, createdAt, movedFrom?}
    """
    # Calculate endTime from duration_minutes or end_datetime
    end_time = None
    if backend_task.get("end_datetime"):
        # Extract time from end_datetime (format: "YYYY-MM-DD HH:MM")
        try:
            end_dt = datetime.strptime(backend_task["end_datetime"], "%Y-%m-%d %H:%M")
            end_time = end_dt.strftime("%H:%M")
        except:
            pass
    elif backend_task.get("time") and backend_task.get("duration_minutes"):
        # Calculate end time from start time + duration
        try:
            start_hour, start_min = map(int, backend_task["time"].split(":"))
            duration = backend_task["duration_minutes"]
            total_minutes = start_hour * 60 + start_min + duration
            end_hour = (total_minutes // 60) % 24
            end_min = total_minutes % 60
            end_time = f"{end_hour:02d}:{end_min:02d}"
        except:
            pass
    
    # Map backend category to frontend ValueType
    # Frontend expects: "health" | "growth" | "family" | "work" | "creativity"
    # Backend uses: "health", "work", "personal", "social", "travel", "errands", "study", etc.
    category = backend_task.get("category", "other")
    category_to_value = {
        "health": "health",
        "work": "work",
        "personal": "growth",  # Personal development -> growth
        "social": "family",    # Social -> family
        "family": "family",
        "travel": "growth",    # Travel -> growth
        "errands": "work",     # Errands -> work
        "study": "growth",     # Study -> growth
        "creativity": "creativity",
        "growth": "growth",
    }
    value = category_to_value.get(category, "growth")  # Default to "growth"
    
    # Get createdAt - use current time if not present (for backward compatibility)
    created_at = backend_task.get("created_at") or backend_task.get("createdAt")
    if not created_at:
        # Try to infer from id if it's a timestamp
        created_at = datetime.now().isoformat()
    
    return {
        "id": backend_task["id"],
        "title": backend_task["title"],
        "time": backend_task.get("time"),
        "endTime": end_time,
        "completed": backend_task.get("completed", False),
        "value": value,
        "date": backend_task.get("date") or datetime.now().strftime("%Y-%m-%d"),
        "createdAt": created_at,
        "movedFrom": backend_task.get("moved_from") or backend_task.get("movedFrom"),
    }


def frontend_task_to_backend(frontend_task: Dict[str, Any], task_type: str = "event") -> Dict[str, Any]:
    """
    Transform frontend task format to backend Task format.
    
    Frontend: {id?, title, time?, endTime?, completed, value, date, createdAt?, movedFrom?}
    Backend: {id, type, title, date, time, duration_minutes?, end_datetime?, category, completed, ...}
    """
    # Map frontend ValueType to backend category
    # Frontend: "health" | "growth" | "family" | "work" | "creativity"
    # Backend: "health", "work", "personal", "social", etc.
    frontend_value = frontend_task.get("value", "growth")
    value_to_category = {
        "health": "health",
        "work": "work",
        "family": "family",
        "growth": "personal",  # Growth -> personal development
        "creativity": "creativity",
    }
    category = value_to_category.get(frontend_value, "personal")
    
    backend_task = {
        "type": task_type,
        "title": frontend_task["title"],
        "date": frontend_task.get("date"),
        "time": frontend_task.get("time"),
        "completed": frontend_task.get("completed", False),
        "category": category,
    }
    
    # Add id if provided
    if frontend_task.get("id"):
        backend_task["id"] = frontend_task["id"]
    
    # Calculate duration from time and endTime
    if frontend_task.get("time") and frontend_task.get("endTime"):
        try:
            start_hour, start_min = map(int, frontend_task["time"].split(":"))
            end_hour, end_min = map(int, frontend_task["endTime"].split(":"))
            start_total = start_hour * 60 + start_min
            end_total = end_hour * 60 + end_min
            duration = end_total - start_total
            if duration > 0:
                backend_task["duration_minutes"] = duration
                # Create end_datetime
                if frontend_task.get("date"):
                    backend_task["end_datetime"] = f"{frontend_task['date']} {frontend_task['endTime']}"
        except:
            pass
    
    # Add metadata
    if frontend_task.get("createdAt"):
        backend_task["created_at"] = frontend_task["createdAt"]
    
    if frontend_task.get("movedFrom"):
        backend_task["moved_from"] = frontend_task["movedFrom"]
    
    return backend_task
