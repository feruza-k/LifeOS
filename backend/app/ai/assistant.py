# app/ai/assistant.py

import os
import json
from openai import OpenAI
import pytz

from app.logic.today_engine import get_today_view
from app.logic.week_engine import get_week_stats
from app.logic.insight_engine import get_insights
from app.logic.conflict_engine import find_conflicts
from app.storage.repo import load_data
from app.logic.reschedule_engine import generate_reschedule_suggestions_for_task

from app.ai.utils import try_extract_task_from_message

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
tz = pytz.timezone("Europe/London")


def safe_ui_block(block):
    if block is None or block == "null":
        return None
    if isinstance(block, dict):
        return block
    return None


def generate_assistant_response(user_message: str):

    today = get_today_view()
    week = get_week_stats()
    insights = get_insights()
    conflicts = find_conflicts()
    all_tasks = load_data().get("tasks", [])

    candidate_task = try_extract_task_from_message(user_message, all_tasks)

    system_prompt = f"""
    You are LifeOS — a calm, warm, concise personal assistant.
    Tone: slightly conversational, still professional. Natural, never cringe. No emojis.

    STRICT OUTPUT FORMAT (MANDATORY):
    You MUST output one VALID JSON object only.
    Nothing before it, nothing after it.
    No markdown. No commentary. No explanations.

    Allowed output structures:

    1) No UI action:
    {{
    "assistant_response": "text only, no JSON inside",
    "ui": null
    }}

    2) With UI action:
    {{
    "assistant_response": "text only",
    "ui": {{
        "action": "string",
        ...additional fields...
    }}
    }}

    RULES:
    - NEVER embed JSON inside strings.
    - NEVER return two responses.
    - NEVER use markdown.
    - ONE suggestion maximum.
    - If the user refers to a task → identify it.
    - If that task has a conflict → return a UI:
    {{
        "action": "confirm_reschedule",
        "task_id": "...",
        "options": [...]
    }}
    - If the user wants to move a task to a new time, return:
    {{
        "action": "apply_reschedule",
        "task_id": "...",
        "new_time": "HH:MM"
    }}

    CONTEXT:
    today: {today}
    week: {week}
    conflicts: {conflicts}
    insights: {insights}
    all_tasks: {all_tasks}

    Focus on planning, clarity, and helpful reasoning only.
    """

    # -----------------------------
    # SPECIAL CASE: task conflict
    # -----------------------------
    if candidate_task:
        task_conflicts = [
            c for c in conflicts
            if c["task_a"]["id"] == candidate_task["id"]
            or c["task_b"]["id"] == candidate_task["id"]
        ]

        if task_conflicts:
            suggestions = generate_reschedule_suggestions_for_task(candidate_task)
            return {
                "assistant_response":
                    f"The task '{candidate_task['title']}' has a timing conflict.",
                "ui": {
                    "action": "confirm_reschedule",
                    "task_id": candidate_task["id"],
                    "options": suggestions[:3] 
                }
            }

    # -----------------------------
    # DEFAULT LLM RESPONSE
    # -----------------------------
    try:
        chat = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=0.2,
        )

        raw_output = chat.choices[0].message.content.strip()

        try:
            parsed = json.loads(raw_output)
        except:
            parsed = {
                "assistant_response": raw_output,
                "ui": None
            }

        parsed["ui"] = safe_ui_block(parsed.get("ui"))
        return parsed

    except Exception as e:
        return {"error": str(e)}
