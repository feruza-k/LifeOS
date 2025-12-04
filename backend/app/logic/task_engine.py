from datetime import datetime, date
from app.storage.repo import load_data
from app.logging import logger
import pytz

tz = pytz.timezone("Europe/London")

# ---------------------------------------------------------
# Helper: parse datetime
# ---------------------------------------------------------
def parse_datetime(task):
    """
    Convert task datetime string into a Python datetime object.
    If parsing fails, stores an error field in the task.
    """

    dt_str = task.get("datetime")

    # If datetime missing but date+time exist, rebuild datetime string
    if not dt_str and task.get("date") and task.get("time"):
        dt_str = f"{task['date']} {task['time']}"

    if not dt_str:
        # No datetime info at all — not an error
        return None

    try:
        return tz.localize(datetime.strptime(dt_str, "%Y-%m-%d %H:%M"))
    except Exception as e:
        # Attach error info to task for transparency
        task["error"] = f"Invalid datetime format: {dt_str}. Error: {str(e)}"
        return None



# ---------------------------------------------------------
# Get ALL tasks (with status + global sorting + error handling)
# ---------------------------------------------------------
def get_all_tasks():
    tasks = load_data().get("tasks", [])
    now = datetime.now(tz)

    for t in tasks:
        dt = parse_datetime(t)

        # Log the parsed datetime for debugging
        logger.debug(f"Parsed datetime for task {t.get('id')}: {dt}")

        # Assign status
        if not dt:
            t["status"] = "unscheduled"
        elif dt.date() == now.date():
            t["status"] = "today"
        elif dt < now:
            t["status"] = "overdue"
        else:
            t["status"] = "upcoming"

        # Normalize datetime string if valid
        if dt:
            t["datetime"] = dt.strftime("%Y-%m-%d %H:%M")

    # Sort globally by datetime (unscheduled last)
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

    upcoming = []
    for t in tasks:
        dt = parse_datetime(t)
        if dt and dt > now:
            upcoming.append(t)

    upcoming.sort(key=lambda x: x.get("datetime") or "")
    return upcoming


def get_overdue_tasks():
    now = datetime.now(tz)
    tasks = get_all_tasks()

    overdue = []
    for t in tasks:
        dt = parse_datetime(t)
        if dt and dt < now:
            overdue.append(t)

    overdue.sort(key=lambda x: x.get("datetime") or "")
    return overdue


def get_next_task():
    upcoming = get_upcoming_tasks()
    return upcoming[0] if upcoming else None



# ---------------------------------------------------------
# Grouping (calendar structure)
# ---------------------------------------------------------

def group_tasks_by_date():
    tasks = get_all_tasks()
    grouped = {}

    for t in tasks:
        day = t.get("date")
        if not day:
            continue

        grouped.setdefault(day, []).append(t)

    # Sort tasks inside each day by time
    for day in grouped:
        grouped[day].sort(key=lambda x: x.get("time") or "")

    return grouped


def group_tasks_pretty():
    """Return grouped tasks in an array format (UI-friendly)."""
    g = group_tasks_by_date()
    return [{"date": d, "tasks": g[d]} for d in sorted(g.keys())]



# ---------------------------------------------------------
# Today timeline (sorted tasks for today)
# ---------------------------------------------------------

def get_today_timeline():
    today = get_tasks_today()
    today.sort(key=lambda x: x.get("time") or "")
    return today

