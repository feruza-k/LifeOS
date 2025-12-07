# app/date_engine/free_slot_engine.py
# ------------------------------------------------------------
# Finds next free slot, free mornings, afternoons, etc.
# ------------------------------------------------------------

from datetime import datetime, timedelta


def resolve_free_slot(message: str, tasks: list):
    text = message.lower()

    # Example: “next free morning”
    if "free morning" in text:
        # Look 7 days ahead
        for i in range(1, 8):
            d = (datetime.today() + timedelta(days=i)).strftime("%Y-%m-%d")
            # morning = 09:00
            return {"date": d, "time": "09:00"}

    # “next available slot”
    if "next available" in text or "free slot" in text:
        now = datetime.now()
        for hour in range(now.hour + 1, 22):
            return {
                "date": now.strftime("%Y-%m-%d"),
                "time": f"{hour:02d}:00"
            }

    return None
