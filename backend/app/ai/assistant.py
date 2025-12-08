# app/ai/assistant.py
# ------------------------------------------------------------
# LifeOS Assistant Core — Stable Edition (Day 8)
# Natural-language task control with:
# - Smart weekday date resolution (next Friday, etc.)
# - Accurate rescheduling (no duplicate tasks)
# - Intent-aware parsing to avoid accidental task creation
# - Pending actions workflow
# - Time range detection (e.g., "9am to 11am")
# ------------------------------------------------------------

import os
import re
from datetime import datetime, timedelta
import pytz
from openai import OpenAI

from app.logic.task_engine import (
    apply_reschedule,
    create_task,
    group_tasks_by_date,
    find_next_free_slot,  
)

from app.storage.repo import load_data
from app.ai.utils import try_extract_task_from_message
from app.logic.pending_actions import (
    get_current_pending,
    create_pending_action,
    clear_current_pending,
)
from app.date_engine.interpret import interpret_datetime
from app.ai.parser import parse_intent

# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
tz = pytz.timezone("Europe/London")
last_referenced_task_id = None

YES_WORDS = {"yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "do it"}
NO_WORDS  = {"no", "nah", "cancel", "stop", "ignore"}

WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2,
    "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
}

# ------------------------------------------------------------
# Natural Language Date Helpers
# ------------------------------------------------------------
def contains_new_date_phrase(text: str) -> bool:
    text = text.lower()
    if any(day in text for day in WEEKDAYS):   # weekdays always override date
        return True
    return any(k in text for k in ["tomorrow", "next ", "on "])

def resolve_weekday_date(now, weekday_str: str) -> str:
    idx_target = WEEKDAYS[weekday_str]
    idx_today  = now.weekday()
    offset = (idx_target - idx_today) % 7
    if offset == 0: offset = 7
    return (now + timedelta(days=offset)).strftime("%Y-%m-%d")

def detect_time_range(text):
    text = text.replace("–", "-").replace("—", "-")
    time_pat = r"(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)"
    patterns = [
        rf"from\s+{time_pat}\s+to\s+{time_pat}",
        rf"between\s+{time_pat}\s+and\s+{time_pat}",
        rf"{time_pat}\s*-\s*{time_pat}",
        rf"{time_pat}\s+to\s+{time_pat}",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m: return m.group(1), m.group(2)
    return None, None

def convert_to_24h(raw):
    if not raw: return None
    raw = raw.strip().replace(" ", "")
    for fmt in ("%I%p", "%H:%M"):
        try: return datetime.strptime(raw, fmt).strftime("%H:%M")
        except: pass
    return None

# ------------------------------------------------------------
# Schedule Queries
# ------------------------------------------------------------
def resolve_schedule_date(cleaned, now):
    if "tomorrow" in cleaned: return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    if "today"    in cleaned: return now.strftime("%Y-%m-%d")
    for day, idx in WEEKDAYS.items():
        if day in cleaned:
            offset = (idx - now.weekday()) % 7
            if offset == 0: offset = 7
            return (now + timedelta(days=offset)).strftime("%Y-%m-%d")
    return None

# =====================================================================
# MAIN ASSISTANT LOGIC
# =====================================================================
def generate_assistant_response(user_message: str):
    global last_referenced_task_id

    cleaned = user_message.lower().strip()
    now     = datetime.now(tz)
    all_tasks = load_data().get("tasks", [])
    pending   = get_current_pending()

    # --------------------------------------------------------
    # Time ranges (e.g., "9am to 11am")
    # --------------------------------------------------------
    start_raw, end_raw = detect_time_range(cleaned)
    start_24 = convert_to_24h(start_raw) if start_raw else None
    end_24   = convert_to_24h(end_raw)   if end_raw   else None
    has_range = bool(start_24 and end_24)

    # --------------------------------------------------------
    # 1. Pending Action Responses
    # --------------------------------------------------------
    if pending and cleaned in YES_WORDS:
        action  = pending["type"]
        payload = pending["payload"]

        if action == "reschedule":
            task = apply_reschedule(payload["task_id"], payload["new_datetime"])
            clear_current_pending()
            last_referenced_task_id = task["id"]
            return {"assistant_response": f"Okay, I moved '{task['title']}'.",
                    "ui": {"action": "update_task", "task_id": task["id"]}}

        if action == "create":
            task = create_task(payload["task_fields"])
            clear_current_pending()
            last_referenced_task_id = task["id"]
            return {"assistant_response": f"Added '{task['title']}'.",
                    "ui": {"action": "add_task", "task": task}}
       
        if action == "suggest-slot":
            fields = payload["original_fields"]
            fields["time"] = payload["suggested_time"]
            fields["datetime"] = f"{fields['date']} {fields['time']}"

            task = create_task(fields)
            clear_current_pending()
            last_referenced_task_id = task["id"]

            return {
                "assistant_response": f"Scheduled '{task['title']}' at {fields['time']}.",
                "ui": {"action": "add_task", "task": task}
            }

    if pending and cleaned in NO_WORDS:
        clear_current_pending()
        return {"assistant_response": "Okay, no changes made.", "ui": None}

    # --------------------------------------------------------
    # 2. Schedule Queries
    # --------------------------------------------------------
    if "schedule" in cleaned or cleaned.startswith("what is") or cleaned.startswith("what's"):
        date = resolve_schedule_date(cleaned, now)
        if not date:
            return {"assistant_response": "Which day do you mean?", "ui": None}

        tasks = group_tasks_by_date().get(date, [])
        if not tasks:
            return {"assistant_response": "You have no tasks on that day.", "ui": None}

        lines = []
        for t in tasks:
            if t.get("duration_minutes") and t.get("end_datetime"):
                end = t["end_datetime"].split(" ")[1]
                lines.append(f"• {t['title']} {t['time']}–{end}")
            else:
                lines.append(f"• {t['title']} at {t['time']}")

        return {"assistant_response": f"Here is your schedule for {date}:\n" + "\n".join(lines), "ui": None}

    # --------------------------------------------------------
    # 3. Task Creation (guarded, NO OVERLAPS ALLOWED)
    # --------------------------------------------------------
    parsed = None
    try: parsed = parse_intent(user_message).model_dump()
    except: pass

    edit_verbs = ["move", "reschedule", "shift", "change", "postpone", "edit", "update"]
    is_edit_request = any(cleaned.startswith(v) or f" {v} " in cleaned for v in edit_verbs)
    task_mentioned  = try_extract_task_from_message(user_message, all_tasks) is not None

    if parsed and parsed.get("intent_type") in ("event", "reminder") and not (is_edit_request and task_mentioned):

        # Force weekday mapping
        if parsed.get("date") and any(day in cleaned for day in WEEKDAYS):
            weekday_str = next((d for d in WEEKDAYS if d in cleaned), None)
            if weekday_str:
                parsed["date"] = resolve_weekday_date(now, weekday_str)

        # Apply range if present
        if has_range:
            start_dt = f"{parsed['date']} {start_24}"
            end_dt   = f"{parsed['date']} {end_24}"
            duration = int((datetime.strptime(end_dt, "%Y-%m-%d %H:%M") -
                            datetime.strptime(start_dt, "%Y-%m-%d %H:%M")).total_seconds()/60)
            parsed["time"] = start_24
            parsed["datetime"] = start_dt
            parsed["duration_minutes"] = duration
            parsed["end_datetime"] = end_dt

        fields = {
            "title": parsed["title"],
            "date":  parsed.get("date"),
            "time":  parsed.get("time"),
            "datetime": parsed.get("datetime"),
            "type": parsed.get("intent_type"),
            "category": parsed.get("category"),
            "notes": parsed.get("notes"),
            "duration_minutes": parsed.get("duration_minutes"),
            "end_datetime": parsed.get("end_datetime"),
        }

        # NO OVERLAPS ALLOWED
        new_date = fields.get("date")
        new_time = fields.get("time")
        # Prevent overlaps — but suggest nearest free slot
        if new_date and new_time:
            conflict = next((t for t in all_tasks if t.get("date") == new_date and t.get("time") == new_time), None)

            if conflict:
                # Find next available slot
                suggested = find_next_free_slot(new_date, new_time, all_tasks)

                if suggested:
                    # Store suggestion as a pending action
                    create_pending_action("suggest-slot", {
                        "original_fields": fields,
                        "suggested_time": suggested
                    })

                    return {
                        "assistant_response": (
                            f"'{conflict['title']}' already occupies {new_time}.\n"
                            f"Shall I schedule '{fields['title']}' at {suggested} instead?"
                        ),
                        "ui": {"action": "confirm_create", "task_preview": {**fields, "time": suggested}}
                    }

                # No space available this day
                return {
                    "assistant_response": (
                        f"I couldn't find a free slot for '{fields['title']}' on {new_date}."
                    ),
                    "ui": None
                }


        readable = f"{fields['title']} on {fields['date']} at {fields['time']}"
        create_pending_action("create", {"task_fields": fields})

        return {
            "assistant_response": f"Should I add '{readable}'?",
            "ui": {"action": "confirm_create", "task_preview": fields}
        }

    # --------------------------------------------------------
    # 4. Task Identification
    # --------------------------------------------------------
    task = try_extract_task_from_message(user_message, all_tasks)

    if not task and any(w in cleaned for w in ["move", "change", "shift", "reschedule", "it", "that"]) and last_referenced_task_id:
        task = next((t for t in all_tasks if t["id"] == last_referenced_task_id), None)

    if task: last_referenced_task_id = task["id"]

    # --------------------------------------------------------
    # 5. Rescheduling
    # --------------------------------------------------------
    if task:
        new_date_mentioned = contains_new_date_phrase(cleaned)

        if new_date_mentioned:
            weekday_str = next((d for d in WEEKDAYS if d in cleaned), None)
            if weekday_str:
                target_date = resolve_weekday_date(now, weekday_str)
                dt = interpret_datetime(user_message, base_dt=now, existing_date=None)
                target_time = dt.get("time") or task["time"]
            else:
                dt = interpret_datetime(user_message, base_dt=now, existing_date=None)
                target_date = dt.get("date") or task["date"]
                target_time = dt.get("time") or task["time"]
        else:
            dt = interpret_datetime(user_message, base_dt=now, existing_date=task["date"])
            target_date = dt.get("date") or task["date"]
            target_time = dt.get("time") or task["time"]

        # ----------------------------------------
        # 🚨 CONFLICT CHECK FOR RESCHEDULING
        # ----------------------------------------
        duration = task.get("duration_minutes") or 60
        new_start = datetime.strptime(f"{target_date} {target_time}", "%Y-%m-%d %H:%M")
        new_end = new_start + timedelta(minutes=duration)

        conflict = None
        for t in all_tasks:
            if t["id"] == task["id"]:
                continue
            if not t.get("date") or not t.get("time"):
                continue

            other_start = datetime.strptime(f"{t['date']} {t['time']}", "%Y-%m-%d %H:%M")
            other_end = other_start + timedelta(minutes=t.get("duration_minutes") or 60)

            if new_start < other_end and other_start < new_end:
                conflict = t
                break

        if conflict:
            suggested = find_next_free_slot(target_date, target_time, all_tasks)
            if suggested:
                create_pending_action("suggest-slot", {
                    "original_fields": {
                        "title": task["title"],
                        "date": target_date,
                        "time": target_time,
                    },
                    "suggested_time": suggested
                })

                return {
                    "assistant_response": (
                        f"'{conflict['title']}' already occupies {target_time}.\n"
                        f"Shall I move '{task['title']}' to {suggested} instead?"
                    ),
                    "ui": {
                        "action": "apply_reschedule",   # MUST match your response models
                        "task_id": task["id"],
                        "new_time": suggested
                    }
                }


            return {
                "assistant_response": (
                    f"I couldn't find a free slot for '{task['title']}' on {target_date}."
                ),
                "ui": None,
            }

        # No conflict — proceed as normal
        new_dt = f"{target_date} {target_time}"

        create_pending_action("reschedule", {
            "task_id": task["id"],
            "new_datetime": new_dt
        })
        return {
            "assistant_response": f"Should I move '{task['title']}' to {target_time} on {target_date}?",
            "ui": {"action": "apply_reschedule", "task_id": task["id"], "new_time": target_time},
        }

    # --------------------------------------------------------
    # 6. Fallback
    # --------------------------------------------------------
    return {"assistant_response": "I'm not sure how to help with that.", "ui": None}
