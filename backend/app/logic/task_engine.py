# app/logic/task_engine.py

from datetime import datetime, date, timedelta
from app.storage.repo import load_data, save_data
from app.logging import logger
import pytz

tz = pytz.timezone("Europe/London")

# ---------------------------------------------------------
# Helper: parse datetime
# ---------------------------------------------------------
def parse_datetime(task):
    dt_str = task.get("datetime")

    # Build datetime if missing
    if not dt_str and task.get("date") and task.get("time"):
        dt_str = f"{task['date']} {task['time']}"

    if not dt_str:
        return None

    try:
        return tz.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M"))
    except Exception as e:
        task["error"] = f"Invalid datetime format: {dt_str}. Error: {str(e)}"
        return None


# ---------------------------------------------------------
# Get ALL tasks
# ---------------------------------------------------------
def get_all_tasks():
    tasks = load_data().get("tasks", [])
    now = datetime.now(tz)

    for t in tasks:
        dt = parse_datetime(t)
        logger.debug(f"Parsed datetime for task {t.get('id')}: {dt}")

        if not dt:
            t["status"] = "unscheduled"
        elif dt.date() == now.date():
            t["status"] = "today"
        elif dt < now:
            t["status"] = "overdue"
        else:
            t["status"] = "upcoming"

        if dt:
            t["datetime"] = dt.strftime("%Y-%m-%d %H:%M")

    tasks.sort(key=lambda t: t.get("datetime") or "")
    return tasks


# ---------------------------------------------------------
# Today, Upcoming, Overdue
# ---------------------------------------------------------
def get_tasks_today():
    today = date.today().strftime("%Y-%m-%d")
    tasks = get_all_tasks()
    return [t for t in tasks if t.get("date") == today]


def get_upcoming_tasks():
    now = datetime.now(tz)
    tasks = get_all_tasks()
    return [t for t in tasks if parse_datetime(t) and parse_datetime(t) > now]


def get_overdue_tasks():
    now = datetime.now(tz)
    tasks = get_all_tasks()
    return [t for t in tasks if parse_datetime(t) and parse_datetime(t) < now]


def get_next_task():
    up = get_upcoming_tasks()
    return up[0] if up else None


# ---------------------------------------------------------
# Grouping
# ---------------------------------------------------------
def group_tasks_by_date():
    tasks = get_all_tasks()
    grouped = {}

    for t in tasks:
        day = t.get("date")
        if not day:
            continue
        grouped.setdefault(day, []).append(t)

    for day in grouped:
        grouped[day].sort(key=lambda x: x.get("time") or "")

    return grouped


def group_tasks_pretty():
    g = group_tasks_by_date()
    return [{"date": d, "tasks": g[d]} for d in sorted(g.keys())]


# ---------------------------------------------------------
# Today timeline
# ---------------------------------------------------------
def get_today_timeline():
    today = get_tasks_today()
    today.sort(key=lambda x: x.get("time") or "")
    return today


# ---------------------------------------------------------
# Mutations: reschedule, edit, delete
# ---------------------------------------------------------
def apply_reschedule(task_id: str, new_datetime: str):
    data = load_data()
    for task in data["tasks"]:
        if task["id"] == task_id:
            task["datetime"] = new_datetime
            date, time = new_datetime.split(" ")
            task["date"] = date
            task["time"] = time

            # recompute end time if duration exists
            if task.get("duration_minutes"):
                start_dt = datetime.strptime(new_datetime, "%Y-%m-%d %H:%M")
                end_dt = start_dt + timedelta(minutes=task["duration_minutes"])
                task["end_datetime"] = end_dt.strftime("%Y-%m-%d %H:%M")

            save_data(data)
            return task
    return None


def delete_task(task_id: str):
    data = load_data()
    data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
    save_data(data)
    return True


def edit_task(task_id: str, fields: dict):
    data = load_data()
    for task in data["tasks"]:
        if task["id"] == task_id:
            for k, v in fields.items():
                task[k] = v
            save_data(data)
            return task
    return None


# ---------------------------------------------------------
# CREATE TASK (UPDATED)
# ---------------------------------------------------------
def create_task(fields: dict):
    from uuid import uuid4
    data = load_data()

    task = {
        "id": str(uuid4()),
        "type": fields.get("type", "event"),
        "title": fields["title"],
        "date": fields.get("date"),
        "time": fields.get("time"),
        "datetime": fields.get("datetime"),
        "duration_minutes": fields.get("duration_minutes"),   # NEW
        "end_datetime": fields.get("end_datetime"),           # NEW
        "category": fields.get("category"),
        "notes": fields.get("notes"),
        "completed": False,
        "energy": None,
        "context": None
    }

    # ---------------------------------------------------------
    # 1) Auto-fill datetime if missing
    # ---------------------------------------------------------
    if task["date"] and task["time"] and not task["datetime"]:
        task["datetime"] = f"{task['date']} {task['time']}"

    # ---------------------------------------------------------
    # 2) Default duration if none exists
    # ---------------------------------------------------------
    if task["duration_minutes"] is None:
        if task["type"] == "event":
            task["duration_minutes"] = 60
        else:
            task["duration_minutes"] = 15

    # ---------------------------------------------------------
    # 3) Auto-calculate end_datetime
    # ---------------------------------------------------------
    try:
        start_dt = datetime.strptime(task["datetime"], "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=task["duration_minutes"])
        task["end_datetime"] = end_dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        # If the datetime is malformed, skip end calculation
        pass

    # Add to storage
    data["tasks"].append(task)

    # Normalize all datetime strings for consistency
    for t in data["tasks"]:
        parse_datetime(t)

    save_data(data)
    return task


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

