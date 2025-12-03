# "LifeOS" - AI-Powered Personal Operating System

**Status:** Building in Public (31-Day AI Challenge)  
**Current Date:** December 2, 2025

## 📋 Table of Contents
- [Overview](#overview)
- [MVP Architecture](#mvp-architecture-v01---early-stage)
- [Daily Progress](#daily-progress)
  - [Day 1: Intent Parser](#day-1-intent-parser-dec-1-2025)
  - [Day 2: Data Models, Storage & CRUD API](#day-2-data-models-storage--crud-api-dec-2-2025)
  - [Day 3: Task Engine, Calendar Logic & Enhancements](#day-3-task-engine-calendar-logic--core-enhancements-dec-3-2025)
- [Next Steps](#next-steps)

---

## Overview

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

## Daily Progress

### **Day 1:** Intent Parser (Dec 1, 2025)

Today I implemented the first foundational feature:  
**the Intent Parser** — the component that translates natural language into structured data the app can act on.

This is the “language brain” of LifeOS.

#### What It Does

| Capability | Description |
|-----------|-------------|
| **Intent Detection** | Identifies `event`, `reminder`, `diary`, and `memory` messages |
| **Date Understanding** | Handles “today”, “tomorrow”, weekdays, and relative phrases |
| **Time Extraction** | Converts natural language time into standard formats |
| **Category Inference** | Detects simple categories (health, work, personal, social) |
| **Timezone Handling** | Uses `Europe/London` as default |

---

#### Example: Natural Language → Structured Intent

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

#### Tech Stack (Day 1)

- Python + FastAPI  
- OpenAI (gpt-4o-mini)  
- Pydantic  
- pytz  


#### Project Structure

```
📁 LifeOS/
├── 📁 backend/
│ ├── 📁 app/
│ │ ├── 📁 ai/
│ │ │ └── parser.py        # Intent parsing logic
│ │ ├── 📁 models/
│ │ │ └── intent.py        # Pydantic schema for Intent
│ │ └── main.py            # FastAPI server
│ ├── requirements.txt     # Python dependencies
│ └── .env                 # Environment variables
└── README.md              # Project documentation
```

---

### **Day 2:** Data Models, Storage & CRUD API (Dec 2, 2025)

Today I built the data foundation of LifeOS — giving the system a place to store structured information permanently.

Yesterday, the assistant could understand commands. Today, it can remember them.

#### What I Built

**1. Core Data Models (Pydantic)**

| Model | Purpose |
|-------|---------|
| **Task** | Stores events & reminders |
| **DiaryEntry** | Stores daily reflections |
| **Memory** | Stores long-term personal preferences |
| **BaseItem** | Provides unique IDs for all items |

**2. JSON Storage Layer**

A simple persistent storage file located at: `backend/app/db/data.json`


Initial schema:

```json
{
  "tasks": [],
  "diary": [],
  "memories": []
}
```

Lightweight now, easily replaced with SQLite later.

**3. Intent → Storage Pipeline**

LifeOS can now take a parsed intent and save it as:
- an event
- a reminder
- a diary entry
- a memory

This completes the first full loop:
`natural language → structured intent → persistent data`

**4. CRUD Endpoints (FastAPI)**

| Endpoint | Description |
|----------|-------------|
| `GET /tasks` | Return all tasks |
| `GET /diary` | Return diary entries |
| `GET /memories` | Return stored memories |
| `GET /all` | Return entire database |
| `POST /clear` | Reset everything (dev only) |


#### Example: Saved Data Snapshot

```json
{
  "tasks": [
    {
      "id": "cdf98f06-07db-4721-b868-40dc6b1faf61",
      "type": "reminder",
      "title": "buy milk",
      "date": "2025-12-02",
      "time": "09:00",
      "datetime": "2025-12-02 09:00",
      "category": "errands",
      "notes": null
    }
  ],
  "diary": [],
  "memories": []
}
```

LifeOS now has persistent memory, which is a major milestone.

#### Tech Stack (Day 2)
- FastAPI
- Python
- Pydantic
- JSON file storage
- Repository pattern

#### Project Structure (Day 2)

```
📁 LifeOS/
├── 📁 backend/
│ ├── 📁 app/
│ │ ├── 📁 ai/         # NLP layer
│ │ │ ├── parser.py
│ │ │ └── processor.py
│ │ ├── 📁 logic/      # Business logic
│ │ │ └── intent_handler.py
│ │ ├── 📁 models/     # Data models
│ │ │ ├── base.py
│ │ │ ├── diary.py
│ │ │ ├── intent.py
│ │ │ ├── memory.py
│ │ │ └── task.py
│ │ ├── 📁 routers/    # API layer
│ │ │ └── intent.py
│ │ ├── 📁 storage/    # Data layer
│ │ │ └── repo.py
│ │ └── main.py
│ ├── requirements.txt
│ └── .env
└── README.md
```

---


### **Day 3:** Task Engine, Calendar Logic & Core Enhancements (Dec 3, 2025)

Today was a big step. LifeOS moved from “storing data” to actually **understanding time**, organising it, and preparing for future intelligent behaviour.

This was the day LifeOS started behaving like a real personal operating system, not just a parser.

---

#### What I Built

**1. Task Engine (the heart of scheduling)**  
I created a full engine for organising tasks:

- **Datetime normalisation** - all tasks now have a unified `datetime` field  
- **Status detection** — `today`, `upcoming`, `overdue`, or `unscheduled`  
- **Sorting** - global chronological ordering  
- **Filtering functions**  
  - `get_tasks_today()`  
  - `get_upcoming_tasks()`  
  - `get_overdue_tasks()`  
  - `get_next_task()`  

This gives LifeOS the basic intelligence to understand *when* things happen and how to structure them.

---

**2. Calendar-Friendly Structure**  
Tasks can now be grouped by date:

```json
{
  "2025-12-02": [...],
  "2025-12-05": [...],
  "2025-12-20": [...]
}
```

I also added `group_tasks_pretty()` — a UI-friendly version for the future mobile app.

---

**3. New API Endpoints**

| Endpoint | Description |
|----------|-------------|
| `GET /tasks/today` | Tasks for today |
| `GET /tasks/upcoming` | Chronological future tasks |
| `GET /tasks/overdue` | Tasks whose time has passed |
| `GET /tasks/next` | The very next upcoming task |
| `GET /tasks/grouped` | Calendar-style grouped tasks |
| `GET /tasks/grouped-pretty` | UI-friendly grouping |
| `GET /tasks/summary` | Daily overview & stats |

LifeOS now has everything needed for a real schedule view.

---

#### ⭐Engine Enhancements & Intelligence Prep

Today I also added several foundational upgrades that will power future features.

**1. Duration & End Time**  
Added to the `Task` model:

```python
duration_minutes: Optional[int] = None
end_datetime: Optional[str] = None
```

This prepares LifeOS for:

- conflict detection  
- free-time blocks  
- timeline visualisation  

**2. Event/Reminder Filtering**

```
GET /tasks/events
GET /tasks/reminders
```

**3. Task Completion**

```
POST /tasks/{id}/complete
```

Allows marking tasks as done — needed for habit-tracking and stats.

---

#### Intelligence Preparation

Added to the `Task` model:

- `energy` (low/medium/high)  
- `context` (work/home/laptop/outside/errand)  

And improved the parser so it now handles:

- “by Friday”  
- “in an hour”  
- “in 30 minutes”  
- “after work”  
- “this evening”

These small pieces will become the core of LifeOS’s agentic intelligence later.

---

#### Architecture Improvements

- **Error handling** for malformed dates  
- **Logging** (`app/logging.py`) added across repo, parser, task engine  
- **Better `/tasks` sorting** (status → datetime)  
- **Stats endpoint** (`GET /stats`)  
- **Quick-add endpoint** (`POST /tasks/add`)

These upgrades make the backend much more stable and professional.

---

### Reflection

Day 3 was the moment LifeOS stopped being just an LLM wrapper and became a **real system** with memory, structure, behaviour, and time awareness.

Building this reminded me why I started this challenge — to create something I would personally use every day, and to sharpen my engineering skills through real, hands-on work.

#### Next Step (Day 4)

Tomorrow, I start moving toward **weekly logic, conflict detection, and intelligent suggestions**! LifeOS is slowly becoming the planner I always wanted for myself.
