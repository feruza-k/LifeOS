# app/ai/utils.py
# ------------------------------------------------------------
# Task extraction helper (improved)
# - Date-aware + time-aware task matching
# - Avoids picking the wrong instance when multiple tasks share a title
# ------------------------------------------------------------

import re
from datetime import datetime, timedelta
import pytz

tz = pytz.timezone("Europe/London")


# ------------------------------------------------------------
# STRICTER SIMILARITY RULE
# ------------------------------------------------------------
def _similar(a: str, b: str) -> bool:
    """
    Conservative similarity check:
    - exact lowercase equality
    - minor typo tolerance only for words >= 5 chars
    - NO plural stripping
    """
    a = a.lower().strip()
    b = b.lower().strip()

    if a == b:
        return True

    if len(a) >= 5 and len(b) >= 5:
        mismatches = sum(c1 != c2 for c1, c2 in zip(a, b))
        if mismatches == 1:
            return True

    return False


# ------------------------------------------------------------
# Extract a time like "8am", "8 am", "08:00", "7pm" → "HH:MM"
# ------------------------------------------------------------
def _extract_time_hint(text: str) -> str | None:
    t = text.lower()

    # e.g. "8am", "8 am", "7:30pm"
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

    # e.g. "08:00"
    hhmm = re.findall(r"\b(\d{1,2}):(\d{2})\b", t)
    if hhmm:
        h_str, m_str = hhmm[-1]
        return f"{int(h_str):02d}:{m_str}"

    # e.g. plain "8" (very ambiguous; we skip this to avoid over-matching)
    return None


def try_extract_task_from_message(message: str, tasks: list):
    """
    Robust task extractor.

    Order of priority:
    1) Find the task title mentioned in the message
    2) If multiple tasks share that title:
         a) If a time is mentioned → prefer tasks with that time
         b) If a date is mentioned (today / tomorrow / weekday) → prefer that date
         c) Otherwise → pick the nearest in the future by date
    """

    msg = message.lower()
    now = datetime.now(tz)

    # -----------------------------
    # 1. Date intent
    # -----------------------------
    target_date = None

    if "tomorrow" in msg:
        target_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "today" in msg:
        target_date = now.strftime("%Y-%m-%d")
    else:
        weekdays = {
            "monday": 0, "tuesday": 1, "wednesday": 2,
            "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
        }
        for name, idx in weekdays.items():
            if name in msg:
                offset = (idx - now.weekday()) % 7
                if offset == 0:
                    offset = 7
                target_date = (now + timedelta(days=offset)).strftime("%Y-%m-%d")
                break

    # -----------------------------
    # 2. Time intent (e.g. "8 am run")
    # -----------------------------
    time_hint = _extract_time_hint(msg)

    # -----------------------------
    # 3. Extract possible task title
    # -----------------------------
    possible_titles = [t["title"].lower() for t in tasks]
    words = re.findall(r"\b[a-z0-9']+\b", msg)
    matched_title = None

    # exact word match first
    for w in words:
        if w in possible_titles:
            matched_title = w
            break

    # substring match ("have a run", "run in the park")
    if not matched_title:
        for t in possible_titles:
            if f" {t} " in f" {msg} ":
                matched_title = t
                break

    # conservative fuzzy fallback
    if not matched_title:
        for w in words:
            for t in possible_titles:
                if _similar(w, t):
                    matched_title = t
                    break
            if matched_title:
                break

    if not matched_title:
        return None

    # -----------------------------
    # 4. Filter tasks by that title
    # -----------------------------
    same_title = [t for t in tasks if t["title"].lower() == matched_title]
    if not same_title:
        return None
    if len(same_title) == 1:
        return same_title[0]

    # -----------------------------
    # 5. If a time is mentioned → prefer that time
    #    This is what fixes "move my 8am run..."
    # -----------------------------
    if time_hint:
        same_title_at_time = [t for t in same_title if t.get("time") == time_hint]
        if same_title_at_time:
            same_title = same_title_at_time

    # If after time-filtering we have exactly one, we're done
    if len(same_title) == 1:
        return same_title[0]

    # -----------------------------
    # 6. If user mentioned a date → prefer that date
    # -----------------------------
    if target_date:
        dated = [t for t in same_title if t.get("date") == target_date]
        if dated:
            return dated[0]

    # -----------------------------
    # 7. Otherwise → pick nearest in the future by date
    # -----------------------------
    candidates = []
    today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for t in same_title:
        try:
            d = datetime.strptime(t["date"], "%Y-%m-%d")
            delta_days = (d - today_midnight).days
            candidates.append((delta_days, t))
        except Exception:
            continue

    # prefer tasks today or in the future; if none, fall back to closest by abs
    future = [pair for pair in candidates if pair[0] >= 0]
    if future:
        future.sort(key=lambda x: x[0])
        return future[0][1]

    # no future ones, just pick the least-negative (closest in the past)
    if candidates:
        candidates.sort(key=lambda x: abs(x[0]))
        return candidates[0][1]

    # final fallback
    return same_title[0]
