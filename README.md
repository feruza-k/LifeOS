# "LifeOS" - AI-Powered Personal Operating System

**Status:** Building in Public (31-Day AI Challenge)  
**Current Date:** December 1, 2025

LifeOS is a personal project I’m building throughout December as part of a 31-day AI challenge.

My goal is to create a mobile-first AI assistant that helps with planning, organisation, discipline, and self-reflection — something I would actually use every day. I also see this project as a way to build consistency and deepen my skills in AI engineering.

---

## MVP Architecture (v0.1 - Early Stage)

| Component | Technology | Role |
|----------|------------|------|
| **Backend API** | FastAPI (Python) | Core server handling AI logic |
| **AI Engine** | OpenAI (gpt-4o-mini) | Intent parsing & natural language understanding |
| **Data Models** | Pydantic | Defines structured intents |
| **Storage** | JSON / SQLite (planned) | Will store tasks, reminders, and diary entries |
| **Mobile UI** | React Native (planned) | Future mobile-first interface |

---

## Day 1: Intent Parser (Dec 1, 2025)

Today I implemented the first foundational feature:  
**the Intent Parser** — the component that translates natural language into structured data the app can act on.

This is the “language brain” of LifeOS.

### What It Does

| Capability | Description |
|-----------|-------------|
| **Intent Detection** | Identifies `event`, `reminder`, `diary`, and `memory` messages |
| **Date Understanding** | Handles “today”, “tomorrow”, weekdays, and relative phrases |
| **Time Extraction** | Converts natural language time into standard formats |
| **Category Inference** | Detects simple categories (health, work, personal, social) |
| **Timezone Handling** | Uses `Europe/London` as default |

---

## Example: Natural Language → Structured Intent

**Input:**  
> “Add gym tomorrow at 6pm”

**Output (JSON):**

```json
{
  "intent_type": "event",
  "title": "gym",
  "date": "2025-12-02",
  "time": "18:00",
  "datetime": "2025-12-02 18:00",
  "category": "health",
  "notes": null
}
```


This will serve as the foundation for scheduling, reminders, journaling, and future agentic behaviour.

---

## Tech Stack (Day 1)

- Python + FastAPI  
- OpenAI (gpt-4o-mini)  
- Pydantic  
- pytz  

---

## Project Structure

backend/
  app/
    ai/
      parser.py         # Intent parsing logic
    models/
      intent.py         # Pydantic schema for Intent
    main.py             # FastAPI server
  requirements.txt
  .env

---

## Next Step (Day 2)

Tomorrow’s goal is to improve intent classification and begin building the internal task model (event objects, reminder objects, diary entries, etc.).

More updates tomorrow.
