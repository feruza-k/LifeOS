# parser.py
# Converts natural language input into a structured Intent object.

from openai import OpenAI
from app.models.intent import Intent
import os
import json
from dotenv import load_dotenv
from datetime import datetime
import pytz

# Determine current date with timezone (e.g., London)
tz = pytz.timezone("Europe/London")
current_date = datetime.now(tz).strftime("%Y-%m-%d")

system_prompt = f"""
You are an intent parser for a personal planning assistant.

TODAY'S DATE: {current_date}
TIMEZONE: Europe/London

When the user says:
- "tomorrow"
- "next week"
- "in two hours"
- "this evening"

you MUST calculate the actual date/time using today's date.

Output only valid JSON with:
intent_type, title, date, time, datetime, category, notes.
"""


def test_ai_connection():
    """
    Simple test to verify the AI API key works.
    """
    return "AI connection works."

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def parse_intent(user_input: str) -> Intent:
    """
    Convert natural language input into a structured Intent.
    """

    # --- FEW-SHOT EXAMPLES (teach the model how to parse) ---

    examples = [
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
        }
    ]

    # --- Build messages list ---
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(examples)
    messages.append({"role": "user", "content": user_input})

    # --- LLM Call ---
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0
    )

    raw_output = response.choices[0].message.content.strip()

    # Convert JSON string → Python dict
    try:
        data = json.loads(raw_output)
    except json.JSONDecodeError:
        cleaned = raw_output.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)

    return Intent(**data)
