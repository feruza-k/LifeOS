# app/date_engine/relative_event_logic.py
# Handles expressions like:
# - “after gym”
# - “before my exam”
# - “the day after my flight”

from datetime import datetime, timedelta

def resolve_relative_event(message: str, tasks: list):
    text = message.lower()

    # Find referenced task
    relevant = None
    for t in tasks:
        if t["title"].lower() in text:
            relevant = t
            break

    if not relevant:
        return None

    # base datetime
    base = datetime.strptime(
        f"{relevant['date']} {relevant['time']}", "%Y-%m-%d %H:%M"
    )

    # after X
    if "after" in text:
        new = base + timedelta(minutes= relevant.get("duration_minutes") or 60)
        return {"date": new.strftime("%Y-%m-%d"), "time": new.strftime("%H:%M")}

    # before X
    if "before" in text:
        new = base - timedelta(minutes= relevant.get("duration_minutes") or 60)
        return {"date": new.strftime("%Y-%m-%d"), "time": new.strftime("%H:%M")}

    # “2 days after X”
    import re
    days_after = re.search(r"(\d+) days after", text)
    if days_after:
        d = int(days_after.group(1))
        new = base + timedelta(days=d)
        return {"date": new.strftime("%Y-%m-%d"), "time": "09:00"}

    return None
