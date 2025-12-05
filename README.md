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
  - [Day 4: Weekly View, Conflict Detection & Assistant Insights](#day-4-weekly-view-conflict-detection--assistant-insights-dec-4-2025)
  - [Day 5: Today View, Suggestions Engine & Smart Rescheduling](#day-5-today-view-suggestions-engine--smart-rescheduling-dec-5-2025)
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

#### ⭐ Engine Enhancements & Intelligence Prep

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

#### Reflection

Day 3 was the moment LifeOS stopped being just an LLM wrapper and became a **system** with memory, structure, behaviour, and time awareness.

Building this reminded me why I started this challenge - to create something I would personally use every day, and to sharpen my engineering skills through real, hands-on work.

### **Day 4:** Weekly View, Conflict Detection & Assistant Insights (Dec 4, 2025)

Today I moved from looking at tasks “one day at a time” to something closer to how I actually think: weeks, patterns, and gentle insights about my schedule. LifeOS is starting to feel less like a list API and more like a small planning brain.

---

#### Weekly View & Calendar Range

I added a proper **week engine** that understands a Monday–Sunday week in `Europe/London` time.

**New logic (`week_engine.py`):**

- `get_current_week_boundaries()` → finds this week’s **Monday–Sunday**
- `get_week_view()` → groups tasks by day for the current week
- `get_tasks_in_range(start, end)` → generic **calendar range helper** for any date window

**New endpoints:**

| Endpoint | Description |
|----------|-------------|
| `GET /tasks/week` | Current week view (Mon–Sun), tasks grouped by day |
| `GET /tasks/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` | Generic calendar range (day/week/month) |

These will power the future weekly and monthly calendar views in the mobile app (e.g. “show me this week”, “show me my holiday week”, etc.).

---

#### Conflict Detection Engine (v1)

To prepare for more intelligent planning, I built a **light conflict detection engine**.

**New module:** `app/logic/conflict_engine.py`

What it does:

- Builds **time blocks** for each scheduled task using:
  - `datetime`
  - `duration_minutes`
  - `end_datetime`
- If duration isn’t set, it uses default assumptions:
  - events → **60 minutes**
  - reminders → **15 minutes**
- Detects overlapping blocks and returns conflict pairs.

**New endpoint:**

| Endpoint | Description |
|----------|-------------|
| `GET /tasks/conflicts` | All overlaps across scheduled tasks |
| `GET /tasks/conflicts?start=...&end=...` | Conflicts only within a specific date range |

Example shape of a conflict:

```json
{
  "task_a": { "...": "..." },
  "task_b": { "...": "..." },
  "overlap_start": "2025-12-05 18:00",
  "overlap_end": "2025-12-05 18:30"
}
```

Later this will allow LifeOS to say things like:

> “Your 6pm gym overlaps with dinner at 6:30pm on Friday.”

…without me having to manually spot it.

---

### **3️⃣ Week Statistics & Human Overview**

I also added a **week summary engine** so LifeOS can see the *shape of my week*, not just individual tasks.

#### **New helpers (`week_engine.py`):**

- `get_week_stats()` → JSON stats for the current week:
  - total tasks  
  - total events / reminders  
  - tasks per day  
  - evening tasks (after 18:00)  
  - busiest day  
  - fully free days  
- `get_week_summary_text()` → short, natural-language overview

---

#### **New endpoints:**

| Endpoint | Description |
|----------|-------------|
| **GET /tasks/week-summary** | JSON statistics for the current week (Mon–Sun) |
| **GET /assistant/week-overview** | Week stats + human-readable summary |

---

#### **Example summary**

> “This week (2025-12-01 → 2025-12-07) you have 7 tasks in total (4 events and 3 reminders).  
> Your busiest day is Sunday with 3 task(s).  
> There are 3 task(s) scheduled for the evening (after 18:00).  
> You still have fully free days on: Monday, Wednesday, Thursday, Saturday.”

This is exactly the kind of thing a future **LifeOS avatar** could show during a weekly check-in.

---

### **4️⃣ Assistant Insights (v0 — First Real Logic)**

Today I created the first version of the **Insight Engine** — a lightweight but meaningful intelligence layer.

This is the earliest form of “assistant-like” behaviour:  
LifeOS looks at the week and gives small, helpful observations.

#### **New module:**  
`app/logic/insight_engine.py`

#### **For now, it generates insights such as:**  
- “You have no tasks scheduled for today.”  
- “Your next upcoming task is ‘gym’ at 2025-12-05 18:00.”  
- “This week you have 7 tasks (4 events and 3 reminders).”  
- “You have 3 evening task(s). Evenings might get busy.”  
- “Your busiest day is Sunday with 3 task(s).”  
- “You still have fully free days on: Monday, Wednesday, Thursday, Saturday.”  
- “You have 1 scheduling conflict(s) that may need attention.”

These are pulled from **real data** — not templates.

---

#### Reflection (Day 4)

Day 3 was about understanding **time**.
Day 4 was about understanding **weeks** and **patterns**.

Today made me realise how much clarity comes from stepping back and looking at patterns, not individual tasks. Implementing the weekly logic and insights taught me how assistants evaluate load, detect conflicts and form summaries. It still isn’t “planning” yet, but the groundwork for actual decision support is now there.

---

### **Day 5:** Today View, Suggestions Engine & Smart Rescheduling (Dec 5, 2025)

Today’s focus was on moving beyond static insights and giving LifeOS the ability to interpret the day, surface actionable suggestions, and offer rescheduling options. These are the first features that start to feel genuinely “assistant-like” — the system now reacts to what it sees instead of simply reporting facts.

---

#### **Today Engine - Structured View of the Day**

I added a dedicated module for understanding *today* with more nuance.  
This includes:

- grouping tasks into **morning / afternoon / evening**
- detecting **free time blocks** between tasks
- estimating **load** (`empty`, `light`, `medium`, `heavy`)
- preparing data for the future Today screen in the UI

**New module:** `app/logic/today_engine.py`

**New endpoint:**

| Endpoint | Description |
|----------|-------------|
| `GET /assistant/today` | Returns today’s tasks, free blocks, and load level |

Example output:

```json
{
  "date": "2025-12-04",
  "tasks": [],
  "free_blocks": [{"start": "06:00", "end": "22:00"}],
  "load": "empty"
}
```

Even this simple structure is extremely useful for building intelligent behaviour later.

---

### **2️⃣ Assistant Suggestions (v1)**

The assistant can now scan the schedule and offer **light, non-intrusive suggestions**, nothing pushy, just helpful observations when they make sense.

Suggestions are based on:

- conflicts  
- heavy days  
- completely free days  
- large free blocks  

**New endpoint:**

| Endpoint | Description |
|----------|-------------|
| `GET /assistant/suggestions` | Returns conflict, overload, and free-time suggestions |

**Example suggestion:**

```json
{
  "reason": "conflict",
  "message": "'meeting with flatmates' overlaps with 'video call with relatives'."
}
```

This sets the foundation for future:  
**“Would you like me to move it?”** flows.

---

### **3️⃣ Rescheduling Engine (v1)**

I added the first version of a **rescheduling helper**.  
Given a specific task, the assistant now looks for:

- free time blocks  
- lighter days in the week  
- reasonable alternative times  

**New endpoint:**

| Endpoint | Description |
|----------|-------------|
| `GET /assistant/reschedule-options?task_id=...` | Suggests new times or days for the selected task |

Even at this early stage, it shows that LifeOS can reason about **where a task belongs**, not just that it exists.

---

### **4️⃣ Category → Colour Map for the UI**

To prepare for the UI layer, LifeOS now exposes a simple category → colour map for consistent visual styling.

**New endpoint:**

| Endpoint | Description |
|----------|-------------|
| `GET /meta/categories` | Returns colour codes for each category |

---

### **Reflection (Day 5)**

Day 5 shifted LifeOS from *storing* schedules to *interpreting* them.  
Building the Today view, suggestions, and early rescheduling logic made me think more about how assistants spot friction and surface small, meaningful insights.  
It’s still simple, but the system is now reacting to the shape of my day rather than just listing tasks — much closer to the behaviour I originally envisioned.

---

### **Next Steps (Day 6)**

- Strengthen the suggestion engine with smarter, cleaner rules  
- Finalise the data shapes for the **Today**, **Week**, and **Calendar** UI screens  
- Add the first confirmation flow: *“Move this task to a better time?”*  
- Improve prioritisation logic  
- Start connecting backend structures to UI-friendly outputs  
