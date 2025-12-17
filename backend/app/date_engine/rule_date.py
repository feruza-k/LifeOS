# app/date_engine/rule_date.py
# Pure rule-based deterministic parsing.
# Handles: tomorrow, next week, next month, weekdays,
# explicit times, “morning/evening”, durations.

import re
from datetime import datetime, timedelta
import pytz

tz = pytz.timezone("Europe/London")

def parse_rule_based(message: str):
    text = message.lower()
    now = datetime.now(tz)

    # --- numeric time ---
    time_match = re.findall(r"\b(\d{1,2}(?::\d{2})?\s?(am|pm)?)\b", text)
    raw_time = time_match[-1][0] if time_match else None

    def normalize_time(raw):
        if not raw:
            return None

        raw = raw.replace(".", ":").strip().lower()
        if re.match(r"^\d{1,2}(am|pm)$", raw):
            hour = int(raw[:-2])
            suffix = raw[-2:]
            if suffix == "pm" and hour != 12:
                hour += 12
            if suffix == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:00"

        if ":" in raw:
            h, m = raw.split(":")
            return f"{int(h):02d}:{m}"

        if raw.isdigit():
            return f"{int(raw):02d}:00"

        return None

    norm_time = normalize_time(raw_time) if raw_time else None

    # --- day keywords ---
    if "tomorrow" in text:
        d = now + timedelta(days=1)
        return {
            "date": d.strftime("%Y-%m-%d"),
            "time": norm_time or "09:00"
        }

    if "day after tomorrow" in text:
        d = now + timedelta(days=2)
        return {
            "date": d.strftime("%Y-%m-%d"),
            "time": norm_time or "09:00"
        }

    # --- morning/afternoon/evening ---
    if "morning" in text:
        return {
            "date": now.strftime("%Y-%m-%d"),
            "time": "09:00"
        }
    if "afternoon" in text:
        return {"date": now.strftime("%Y-%m-%d"), "time": "15:00"}
    if "evening" in text:
        return {"date": now.strftime("%Y-%m-%d"), "time": "18:00"}

    # next week
    if "next week" in text:
        next_mon = now + timedelta(days=(7 - now.weekday()))
        return {
            "date": next_mon.strftime("%Y-%m-%d"),
            "time": norm_time or "09:00"
        }

    # weekday names
    weekdays = {
        "monday": 0, "tuesday": 1, "wednesday": 2,
        "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
    }

    for day, idx in weekdays.items():
        if day in text:
            days_ahead = (idx - now.weekday()) % 7
            if days_ahead == 0:
                days_ahead = 7
            d = now + timedelta(days=days_ahead)
            return {
                "date": d.strftime("%Y-%m-%d"),
                "time": norm_time or "09:00"
            }

    # “in 2 hours”
    match_hours = re.search(r"in (\d+) hours?", text)
    if match_hours:
        hours = int(match_hours.group(1))
        dt = now + timedelta(hours=hours)
        return {
            "date": dt.strftime("%Y-%m-%d"),
            "time": dt.strftime("%H:%M")
        }

    return None
