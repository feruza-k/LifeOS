# app/date_engine/interpret.py
# LifeOS Natural-Language Date/Time Interpreter
# Handles:
# - Explicit times ("5pm", "17:00", "6:30 pm")
# - Explicit dates ("on Tuesday", "next Wednesday")
# - Relative phrases ("tomorrow", "today")
# - Falls back to the task's existing date ONLY when user gives NO date

import re
from datetime import datetime, timedelta

# Weekday mapping
WEEKDAYS = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

def _next_weekday(base_dt: datetime, target_weekday: int) -> datetime:
    offset = (target_weekday - base_dt.weekday()) % 7
    if offset == 0:
        offset = 7
    return base_dt + timedelta(days=offset)

# Extract time  — we always choose the *last* time in the message.
def _extract_time(text: str) -> str | None:
    t = text.lower()

    # am/pm times → take last
    ampm = re.findall(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", t)
    if ampm:
        h_str, m_str, suf = ampm[-1]
        h = int(h_str)
        m = int(m_str) if m_str else 0

        if suf == "pm" and h != 12:
            h += 12
        if suf == "am" and h == 12:
            h = 0

        return f"{h:02d}:{m:02d}"

    # 24h times → last
    hhmm = re.findall(r"\b(\d{1,2}):(\d{2})\b", t)
    if hhmm:
        h_str, m_str = hhmm[-1]
        return f"{int(h_str):02d}:{m_str}"

    # Semantic fallback
    if "morning" in t:
        return "09:00"
    if "afternoon" in t:
        return "15:00"
    if "evening" in t:
        return "18:00"
    if "night" in t or "tonight" in t:
        return "20:00"

    return None

# Extract date — explicit date words NEVER overridden
def _extract_date(text: str, base_dt: datetime, existing_date: str | None) -> str | None:
    t = text.lower()

    # 1) Explicit date words
    if "tomorrow" in t:
        return (base_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    if "today" in t:
        return base_dt.strftime("%Y-%m-%d")

    # 2) Weekdays
    hits = []
    for name, idx in WEEKDAYS.items():
        pos = t.find(name)
        if pos != -1:
            hits.append((pos, idx))

    if hits:
        hits.sort(key=lambda x: x[0])
        weekday_index = hits[0][1]
        dt = _next_weekday(base_dt, weekday_index)
        return dt.strftime("%Y-%m-%d")

    # 3) Fallback: only use task's existing date if user gave NO date
    return existing_date

# Main public interpreter
def interpret_datetime(
    text: str,
    base_dt: datetime,
    existing_date: str | None = None,
):
    """
    Returns:
      {
        "date": "YYYY-MM-DD" or None,
        "time": "HH:MM" or None
      }
    """
    time_str = _extract_time(text)
    date_str = _extract_date(text, base_dt, existing_date)

    if not time_str and not date_str:
        return None

    return {
        "date": date_str,
        "time": time_str,
    }
