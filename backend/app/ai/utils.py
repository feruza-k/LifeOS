# app/ai/utils.py

import re

def try_extract_task_from_message(user_message: str, all_tasks: list):
    msg = user_message.lower().strip()
    words = re.findall(r"\b\w+\b", msg)

    # 1) Exact title match
    for t in all_tasks:
        title = t.get("title", "").lower().strip()
        if msg == title:
            return t

    # 2) Whole-word match (avoids run→brunch)
    for t in all_tasks:
        title = t.get("title", "").lower().strip()
        if title in words:
            return t

    # 3) Fallback contains match
    for t in all_tasks:
        title = t.get("title", "").lower().strip()
        if title and title in msg:
            return t

    return None
