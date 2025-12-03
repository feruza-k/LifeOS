# parser.py
# Converts natural language input into a structured Intent object.

from openai import OpenAI
from app.models.intent import Intent
from app.logging import logger
import os
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta
import pytz

# Timezone + current time
tz = pytz.timezone("Europe/London")
now = datetime.now(tz)
current_date = now.strftime("%Y-%m-%d")
current_time = now.strftime("%H:%M")


# ---------------------------------------------------------
# SYSTEM PROMPT
# ---------------------------------------------------------
system_prompt = f"""
You are an intent parser for a personal AI planning assistant.
Your job is to convert free-form natural language into a structured JSON intent.

TODAY'S DATE: {current_date}
CURRENT TIME: {current_time}
TIMEZONE: Europe/London

You MUST resolve all relative time expressions into actual date/time values.

Examples:
- "in an hour" → now + 1 hour
- "in 30 minutes" → now + 30 mins
- "tomorrow" → today + 1 day
- "next Monday" → next week’s Monday
- "this evening" → set time = 19:00 unless user specifies a different time
- "after work" → set notes="after work", leave time=None unless known
- "by Friday" → convert to a deadline (date only)

OUTPUT RULES:
- Always output valid JSON
- No comments, no markdown
- Always fill fields: intent_type, title, date, time, datetime, category, notes
"""


# ---------------------------------------------------------
# SETUP LLM CLIENT
# ---------------------------------------------------------
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))



# ---------------------------------------------------------
# PARSER FUNCTION
# ---------------------------------------------------------
def parse_intent(user_input: str) -> Intent:
    """
    Convert natural language input into a structured Intent.
    """

    # -----------------------------------------------------
    # FEW-SHOT EXAMPLES
    # -----------------------------------------------------
    examples = [

        # Event example
        {
            "role": "user",
            "content": "Add gym on Tuesday at 6pm"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "event",
                "title": "gym",
                "date": "2025-12-02",
                "time": "18:00",
                "datetime": "2025-12-02 18:00",
                "category": "health",
                "notes": None
            })
        },

        # Reminder: after work
        {
            "role": "user",
            "content": "Remind me to call my mom after work"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "reminder",
                "title": "call mom",
                "date": None,
                "time": None,
                "datetime": None,
                "category": "personal",
                "notes": "after work"
            })
        },

        # Diary
        {
            "role": "user",
            "content": "I felt exhausted today in the gym"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "diary",
                "title": None,
                "date": None,
                "time": None,
                "datetime": None,
                "category": "health",
                "notes": "I felt exhausted today in the gym"
            })
        },

        # Memory
        {
            "role": "user",
            "content": "Remember this: I prefer working out in the evening"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "memory",
                "title": "preference: workout time",
                "date": None,
                "time": None,
                "datetime": None,
                "category": "personal",
                "notes": "prefers working out in the evening"
            })
        },

        # Deadline example
        {
            "role": "user",
            "content": "Submit the report by Friday"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "reminder",
                "title": "submit report",
                "date": "2025-12-05",
                "time": None,
                "datetime": None,
                "category": "work",
                "notes": "deadline"
            })
        },

        # Relative time (in an hour)
        {
            "role": "user",
            "content": "remind me to stretch in an hour"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "reminder",
                "title": "stretch",
                "date": now.strftime("%Y-%m-%d"),
                "time": (now + timedelta(hours=1)).strftime("%H:%M"),
                "datetime": (now + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M"),
                "category": "health",
                "notes": None
            })
        },

        # Relative time (in 30 minutes)
        {
            "role": "user",
            "content": "remind me to drink water in 30 minutes"
        },
        {
            "role": "assistant",
            "content": json.dumps({
                "intent_type": "reminder",
                "title": "drink water",
                "date": now.strftime("%Y-%m-%d"),
                "time": (now + timedelta(minutes=30)).strftime("%H:%M"),
                "datetime": (now + timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M"),
                "category": "health",
                "notes": None
            })
        }
    ]


    # -----------------------------------------------------
    # LLM CALL
    # -----------------------------------------------------
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(examples)
    messages.append({"role": "user", "content": user_input})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0
    )

    raw_output = response.choices[0].message.content.strip()

    # Log raw output
    logger.debug(f"LLM raw output: {raw_output}")

    # Clean JSON if needed
    try:
        data = json.loads(raw_output)
    except json.JSONDecodeError:
        cleaned = raw_output.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)

    # Log parsed JSON
    logger.debug(f"Parsed intent JSON: {data}")

    # Convert to Pydantic model
    return Intent(**data)
