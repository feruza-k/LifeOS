# app/logic/task_engine.py

from datetime import datetime, date, timedelta
from app.logging import logger
from db.repo import db_repo

import pytz

tz = pytz.timezone("Europe/London")

# Helper: parse datetime
def parse_datetime(task):
    dt_str = task.get("datetime")

    # Build datetime if missing
    if not dt_str and task.get("date") and task.get("time"):
        dt_str = f"{task['date']} {task['time']}"

    if not dt_str:
        return None

    try:
        if isinstance(dt_str, str):
            # Handle ISO format (with T) or space-separated format
            if "T" in dt_str:
                # ISO format: "2025-12-21T15:00:00" or "2025-12-21T15:00:00.000Z"
                # Parse ISO format directly
                try:
                    # Remove timezone if present
                    dt_str_clean = dt_str.split("+")[0].split("Z")[0]
                    # Remove microseconds if present
                    if "." in dt_str_clean:
                        dt_str_clean = dt_str_clean.split(".")[0]
                    # Parse ISO format
                    dt = datetime.fromisoformat(dt_str_clean)
                    return tz.localize(dt)
                except ValueError:
                    # Fallback: try to convert to space-separated format
                    date_part = dt_str.split("T")[0]
                    time_part = dt_str.split("T")[1].split("+")[0].split("Z")[0]
                    if "." in time_part:
                        time_part = time_part.split(".")[0]
                    # Take only HH:MM:SS or HH:MM
                    time_parts = time_part.split(":")
                    if len(time_parts) >= 2:
                        time_part = f"{time_parts[0]}:{time_parts[1]}"
                    dt_str = f"{date_part} {time_part}"
                    return tz.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M"))
            else:
                # Space-separated format: "2025-12-21 15:00"
                return tz.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M"))
        return dt_str
    except Exception as e:
        task["error"] = f"Invalid datetime format: {dt_str}. Error: {str(e)}"
        return None

# Get ALL tasks (async, user-scoped)
async def get_all_tasks(user_id: str = None):
    if user_id:
        tasks = await db_repo.get_tasks_by_user(user_id)
    else:
        # Fallback: return empty if no user_id (shouldn't happen in production)
        tasks = []
    
    now = datetime.now(tz)

    for t in tasks:
        dt = parse_datetime(t)
        logger.debug(f"Parsed datetime for task {t.get('id')}: {dt}")

        if not dt:
            t["status"] = "unscheduled"
        elif isinstance(dt, datetime) and dt.date() == now.date():
            t["status"] = "today"
        elif isinstance(dt, datetime) and dt < now:
            t["status"] = "overdue"
        else:
            t["status"] = "upcoming"

        if dt and isinstance(dt, datetime):
            t["datetime"] = dt.strftime("%Y-%m-%d %H:%M")

    tasks.sort(key=lambda t: t.get("datetime") or "")
    return tasks

# Today, Upcoming, Overdue (async)
async def get_tasks_today(user_id: str = None):
    today = date.today().strftime("%Y-%m-%d")
    tasks = await get_all_tasks(user_id)
    return [t for t in tasks if t.get("date") == today]

async def get_upcoming_tasks(user_id: str = None):
    now = datetime.now(tz)
    tasks = await get_all_tasks(user_id)
    return [t for t in tasks if parse_datetime(t) and isinstance(parse_datetime(t), datetime) and parse_datetime(t) > now]

async def get_overdue_tasks(user_id: str = None):
    now = datetime.now(tz)
    tasks = await get_all_tasks(user_id)
    return [t for t in tasks if parse_datetime(t) and isinstance(parse_datetime(t), datetime) and parse_datetime(t) < now]

async def get_next_task(user_id: str = None):
    up = await get_upcoming_tasks(user_id)
    return up[0] if up else None

# Grouping (async)
async def group_tasks_by_date(user_id: str = None):
    tasks = await get_all_tasks(user_id)
    grouped = {}

    for t in tasks:
        day = t.get("date")
        if not day:
            continue
        grouped.setdefault(day, []).append(t)

    for day in grouped:
        grouped[day].sort(key=lambda x: x.get("time") or "")

    return grouped

async def group_tasks_pretty(user_id: str = None):
    g = await group_tasks_by_date(user_id)
    return [{"date": d, "tasks": g[d]} for d in sorted(g.keys())]

# Today timeline (async)
async def get_today_timeline(user_id: str = None):
    today = await get_tasks_today(user_id)
    today.sort(key=lambda x: x.get("time") or "")
    return today

# Reschedule, edit, delete (async)
async def apply_reschedule(task_id: str, new_datetime: str, user_id: str):
    # Parse new datetime
    date_str, time_str = new_datetime.split(" ")
    
    # Get task to check duration
    task = await db_repo.get_task(task_id, user_id)
    if not task:
        return None
    
    updates = {
        "datetime": new_datetime,
        "date": date_str,
        "time": time_str,
    }
    
    # Recompute end time if duration exists
    if task.get("duration_minutes"):
        start_dt = datetime.strptime(new_datetime, "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=task["duration_minutes"])
        updates["end_datetime"] = end_dt.strftime("%Y-%m-%d %H:%M")
    
    updated = await db_repo.update_task(task_id, updates, user_id)
    return updated

async def delete_task_async(task_id: str, user_id: str):
    return await db_repo.delete_task(task_id, user_id)

async def edit_task_async(task_id: str, fields: dict, user_id: str):
    updated = await db_repo.update_task(task_id, fields, user_id)
    return updated

# CREATE TASK (async, uses database)
async def create_task_async(fields: dict, user_id: str):
    # Ensure user_id is set
    if "user_id" not in fields:
        fields["user_id"] = user_id
    
    # Auto-fill datetime if missing
    if fields.get("date") and fields.get("time") and not fields.get("datetime"):
        fields["datetime"] = f"{fields['date']} {fields['time']}"
    
    # Default duration if none exists
    if fields.get("duration_minutes") is None:
        task_type = fields.get("type", "event")
        fields["duration_minutes"] = 60 if task_type == "event" else 15
    
    # Auto-calculate end_datetime
    if fields.get("datetime") and fields.get("duration_minutes"):
        try:
            start_dt = datetime.strptime(fields["datetime"], "%Y-%m-%d %H:%M")
            end_dt = start_dt + timedelta(minutes=fields["duration_minutes"])
            fields["end_datetime"] = end_dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass
    
    # Create task via database
    created = await db_repo.add_task_dict(fields)
    return created

def find_next_free_slot(date: str, time: str, all_tasks: list) -> str | None:
    """Given a date & time, find the nearest free 1-hour slot that does NOT overlap."""
    from datetime import datetime, timedelta

    # desired start time
    fmt = "%Y-%m-%d %H:%M"
    current = datetime.strptime(f"{date} {time}", fmt)

    # Loop through the day in 30-minute increments
    for _ in range(48):  # 24 hours * 2 increments
        candidate_start = current
        candidate_end   = current + timedelta(hours=1)

        # Check overlap with any existing task
        overlap = False
        for t in all_tasks:
            if t.get("date") != date:
                continue

            t_start = datetime.strptime(f"{t['date']} {t['time']}", fmt)
            t_end   = datetime.strptime(t['end_datetime'], fmt) if t.get("end_datetime") else t_start + timedelta(minutes=t.get("duration_minutes", 60))

            # Overlap rule: intervals intersect if they cross
            if not (candidate_end <= t_start or candidate_start >= t_end):
                overlap = True
                break

        if not overlap:
            return candidate_start.strftime("%H:%M")

        current += timedelta(minutes=30)

    return None

