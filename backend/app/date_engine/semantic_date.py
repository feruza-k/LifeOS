# app/date_engine/semantic_date.py
# ------------------------------------------------------------
# Handles ambiguous expressions using the LLM:
# - “early next month”
# - “when I get home”
# - “towards the evening”
# ------------------------------------------------------------

import os
from datetime import datetime
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def semantic_interpret(message: str):
    prompt = f"""
    Extract a natural-language date and time from the text.
    Respond with strictly JSON like:
    {{"date": "YYYY-MM-DD", "time": "HH:MM"}}

    If impossible, return null.

    Text: "{message}"
    """

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )

        raw = resp.choices[0].message.content.strip()

        import json
        return json.loads(raw)
    except:
        return None
