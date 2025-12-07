# app/ai/assistant.py
# ------------------------------------------------------------
# LifeOS Assistant Core
# FIXED VERSION — Rescheduling now updates the correct task
# and removes the old time/date assignment properly.
# ------------------------------------------------------------

import os
import json
import re
from datetime import datetime, timedelta
import pytz
from openai import OpenAI

from app.logic.today_engine import get_today_view
from app.logic.week_engine import get_week_stats
from app.logic.insight_engine import get_insights
from app.logic.conflict_engine import find_conflicts
from app.logic.reschedule_engine import generate_reschedule_suggestions_for_task
from app.logic.task_engine import apply_reschedule, delete_task, edit_task, group_tasks_by_date

from app.storage.repo import load_data, save_data
from app.ai.utils import try_extract_task_from_message

from app.logic.pending_actions import (
    get_current_pending,
    create_pending_action,
    clear_current_pending,
)

from app.date_engine.interpret import interpret_datetime

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
tz = pytz.timezone("Europe/London")

last_referenced_task_id: str | None = None

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
}

YES_WORDS = {"yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "do it"}
NO_WORDS = {"no", "nah", "cancel", "stop", "ignore"}


def safe_ui_block(block):
    if block in (None, "null"):
        return None
    return block if isinstance(block, dict) else None


# ------------------------------------------------------------
# IMPORTANT FIX:
# Make apply_reschedule update the correct task instance ONLY
# ------------------------------------------------------------
def apply_reschedule_update(task_id, new_datetime):
    data = load_data()
    updated_task = None

    for t in data["tasks"]:
        if t["id"] == task_id:
            date, time = new_datetime.split(" ")
            t["datetime"] = new_datetime
            t["date"] = date
            t["time"] = time
            updated_task = t
            break

    if updated_task:
        save_data(data)
    return updated_task


# ------------------------------------------------------------
# Conflict detection
# ------------------------------------------------------------
def check_future_conflict(task, new_date, new_time):
    tasks = load_data().get("tasks", [])
    duration = task.get("duration_minutes") or 60

    new_start = datetime.strptime(f"{new_date} {new_time}", "%Y-%m-%d %H:%M")
    new_end = new_start + timedelta(minutes=duration)

    conflicts = []
    for t in tasks:
        if t["id"] == task["id"]:
            continue
        if not t.get("date") or not t.get("time"):
            continue

        other_start = datetime.strptime(f"{t['date']} {t['time']}", "%Y-%m-%d %H:%M")
        other_end = other_start + timedelta(minutes=t.get("duration_minutes") or 60)

        if new_start < other_end and other_start < new_end:
            conflicts.append(t)

    return conflicts


def resolve_schedule_date(cleaned, now):
    if "tomorrow" in cleaned:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    if "today" in cleaned:
        return now.strftime("%Y-%m-%d")

    for day, idx in WEEKDAYS.items():
        if day in cleaned:
            offset = (idx - now.weekday()) % 7
            if offset == 0:
                offset = 7
            return (now + timedelta(days=offset)).strftime("%Y-%m-%d")
    return None


def generate_assistant_response(user_message: str):
    global last_referenced_task_id

    cleaned = user_message.lower().strip()
    now = datetime.now(tz)
    data = load_data()
    all_tasks = data.get("tasks", [])

    pending = get_current_pending()

    # --------------------------------------------------------
    # 1) YES / NO for pending
    # --------------------------------------------------------
    if pending and cleaned in YES_WORDS:
        if pending["type"] == "reschedule":
            task = apply_reschedule_update(
                pending["payload"]["task_id"],
                pending["payload"]["new_datetime"]
            )
            clear_current_pending()
            last_referenced_task_id = task["id"]
            return {
                "assistant_response": f"Okay, I moved '{task['title']}'.",
                "ui": {"action": "update_task", "task_id": task["id"]},
            }

    if pending and cleaned in NO_WORDS:
        clear_current_pending()
        return {"assistant_response": "Okay, no changes made.", "ui": None}

    # --------------------------------------------------------
    # 2) Schedule queries
    # --------------------------------------------------------
    if "schedule" in cleaned or cleaned.startswith("what"):
        date = resolve_schedule_date(cleaned, now)
        if not date:
            return {"assistant_response": "Which day do you mean?", "ui": None}

        tasks_by_day = group_tasks_by_date()
        tasks = tasks_by_day.get(date, [])
        if not tasks:
            return {"assistant_response": "You have no tasks on that day.", "ui": None}

        tasks.sort(key=lambda x: x["time"])
        resp = f"Here is your schedule for {date}:\n" + "\n".join(
            f"• {t['title']} at {t['time']}" for t in tasks
        )
        return {"assistant_response": resp, "ui": None}

    # --------------------------------------------------------
    # 3) Task extraction with date+time ID precision
    # --------------------------------------------------------
    task = try_extract_task_from_message(user_message, all_tasks)
    if task:
        last_referenced_task_id = task["id"]

    # --------------------------------------------------------
    # 4) Rescheduling request
    # --------------------------------------------------------
    if task:
        dt = interpret_datetime(user_message, base_dt=now, existing_date=task["date"])
        if dt:
            target_date = dt.get("date") or task["date"]
            target_time = dt.get("time") or task["time"]
            new_dt = f"{target_date} {target_time}"

            create_pending_action("reschedule", {
                "task_id": task["id"],  # ← CORRECT ID STORED HERE
                "new_datetime": new_dt
            })

            return {
                "assistant_response":
                    f"Should I move '{task['title']}' to {target_time} on {target_date}?",
                "ui": {"action": "apply_reschedule", "task_id": task["id"], "new_time": target_time},
            }

    # --------------------------------------------------------
    # 5) LLM fallback
    # --------------------------------------------------------
    return {"assistant_response": "I'm not sure how to help with that.", "ui": None}
