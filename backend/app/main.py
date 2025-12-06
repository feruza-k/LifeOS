# main.py

from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.models.task import Task
import os
from fastapi import Query

# AI
from app.ai.parser import test_ai_connection, parse_intent
from pydantic import BaseModel
from app.ai.assistant import generate_assistant_response
class ChatRequest(BaseModel):
    message: str

# Storage
from app.storage.repo import repo, load_data, save_data

# Logic
from app.logic.intent_handler import handle_intent
from app.logic.insight_engine import get_insights
from app.logic.today_engine import get_today_view
from app.logic.suggestion_engine import get_suggestions
from app.logic.categories import get_category_colors
from app.logic.ui_builder import build_today_ui, build_week_ui, build_calendar_ui
from app.logic.week_engine import (
    get_week_view,
    get_tasks_in_range,
    get_week_stats,
    get_week_summary_text,
)
from app.logic.reschedule_engine import generate_reschedule_suggestions
from app.logic.conflict_engine import find_conflicts
from app.logic.task_engine import (
    get_tasks_today,
    get_upcoming_tasks,
    get_overdue_tasks,
    get_next_task,
    group_tasks_by_date,
    group_tasks_pretty,
    get_today_timeline,
    get_all_tasks
)



# Load environment variables (.env file)
load_dotenv()

app = FastAPI(
    title="LifeOS Backend",
    description="AI-powered personal planning assistant backend",
    version="0.1"
)

# Allow your mobile app + localhost to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Main homepage route
# -------------------------------

@app.get("/")
def home():
    return {"message": "LifeOS API is running 🚀"}


# -------------------------------
# AI Test Route
# -------------------------------
@app.get("/ai-test")
def ai_test():
    response = test_ai_connection()
    return {"response": response}

# -------------------------------
# Intent Parser
# -------------------------------

@app.post("/parse")
def parse_endpoint(user_input: str):
    """
    Accept raw user input and return a parsed Intent.
    """
    intent = parse_intent(user_input)
    return intent



class UserMessage(BaseModel):
    text: str

@app.get("/process")
def process(text: str):
    """
    Accept natural language and route it to the correct handler.
    """
    intent = parse_intent(text)
    result = handle_intent(intent)
    return {
        "intent": intent,
        "result": result
    }
# -------------------------------
# CRUD Endpoints
# -------------------------------

from app.storage.repo import load_data, save_data

@app.get("/tasks")
def get_tasks():
    tasks = get_all_tasks()  # sorted + with status
    return tasks


@app.get("/diary")
def get_diary():
    return load_data().get("diary", [])


@app.get("/memories")
def get_memories():
    return load_data().get("memories", [])


@app.get("/all")
def get_all():
    return load_data()


@app.post("/clear")
def clear_data():
    empty = {"tasks": [], "diary": [], "memories": []}
    save_data(empty)
    repo.data = empty  # sync in-memory copy
    return {"status": "cleared"}


# ---------------------------------------------------------
# TASK ENGINE
# ---------------------------------------------------------

@app.get("/tasks/today")
def today_tasks():
    return get_tasks_today()

@app.get("/tasks/today/timeline")
def today_timeline():
    return get_today_timeline()

@app.get("/tasks/upcoming")
def upcoming_tasks():
    return get_upcoming_tasks()

@app.get("/tasks/overdue")
def overdue_tasks():
    return get_overdue_tasks()

@app.get("/tasks/next")
def next_task():
    return get_next_task()

@app.get("/tasks/grouped")
def grouped_tasks():
    return group_tasks_by_date()

@app.get("/tasks/grouped-pretty")
def grouped_tasks_pretty():
    return group_tasks_pretty()


@app.get("/tasks/summary")
def task_summary():
    upcoming = get_upcoming_tasks()
    overdue = get_overdue_tasks()
    today = get_tasks_today()

    return {
        "today": today,
        "next": get_next_task(),
        "counts": {
            "today": len(today),
            "upcoming": len(upcoming),
            "overdue": len(overdue),
        },
        "grouped": group_tasks_by_date()
    }

@app.get("/tasks/events")
def get_events():
    return [t for t in load_data().get("tasks", []) if t["type"] == "event"]

@app.get("/tasks/reminders")
def get_reminders():
    return [t for t in load_data().get("tasks", []) if t["type"] == "reminder"]

@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str):
    result = repo.mark_task_complete(task_id)   # <-- call method ON repo
    if result:
        return {"status": "completed", "task": result}
    return {"error": "Task not found"}


@app.get("/stats")
def stats():
    data = load_data()
    tasks = data.get("tasks", [])
    return {
        "tasks": len(tasks),
        "events": len([t for t in tasks if t["type"] == "event"]),
        "reminders": len([t for t in tasks if t["type"] == "reminder"]),
        "diary": len(data.get("diary", [])),
        "memories": len(data.get("memories", [])),
    }

@app.post("/tasks/add")
def add_task(task: Task):
    repo.add_task(task)
    return {"status": "saved", "task": task}


@app.get("/tasks/week")
def tasks_week():
    """
    Return tasks grouped by calendar week (Mon–Sun),
    including both events and reminders. Frontend can style
    reminders differently using the `type` field.
    """
    return get_week_view()


@app.get("/reminders/today")
def reminders_today():
    data = load_data()
    tasks = data.get("tasks", [])
    today_str = datetime.now(tz).strftime("%Y-%m-%d")
    return [
        t for t in tasks
        if t.get("type") == "reminder" and t.get("date") == today_str
    ]


@app.get("/tasks/calendar")
def tasks_calendar(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """
    Generic calendar endpoint.
    Returns tasks grouped by day between start and end (inclusive).
    Can be used for day/week/month views in the UI.
    """
    try:
        return get_tasks_in_range(start, end)
    except ValueError as e:
        return {"error": str(e)}


@app.get("/tasks/conflicts")
def tasks_conflicts(
    start: str | None = Query(
        None, description="Optional start date YYYY-MM-DD (filter range)"
    ),
    end: str | None = Query(
        None, description="Optional end date YYYY-MM-DD (filter range)"
    ),
):
    """
    Return overlapping tasks within an optional date range.

    If no range is provided, checks all scheduled tasks.
    """
    return find_conflicts(start, end)

@app.get("/tasks/week-summary")
def tasks_week_summary():
    """
    JSON statistics for the current week (Mon–Sun).
    Useful for dashboards and UI.
    """
    return get_week_stats()


@app.get("/assistant/week-overview")
def assistant_week_overview():
    """
    Human-readable overview of the current week.
    This is what the future avatar/assistant could show in the UI.
    """
    return {
        "stats": get_week_stats(),
        "summary": get_week_summary_text(),
    }


@app.get("/assistant/insights")
def assistant_insights():
    """
    Insight Engine v0 — produces small helpful insights about the user's
    current schedule, weekly load, conflicts, free time, etc.
    """
    return {
        "insights": get_insights()
    }


@app.get("/assistant/today")
def assistant_today():
    """
    Return a structured view of today: tasks, free blocks, and load level.
    """
    return get_today_view()


@app.get("/assistant/suggestions")
def assistant_suggestions():
    return get_suggestions()


@app.get("/assistant/reschedule-options")
def assistant_reschedule_options(task_id: str):
    """
    Suggest rescheduling options for a specific task.
    Uses new generate_reschedule_suggestions(task) API.
    """
    tasks = load_data().get("tasks", [])
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task)

    return {
        "task": task,
        "suggestions": suggestions
    }


@app.get("/meta/categories")
def meta_categories():
    """
    Return category → color map for consistent UI coloring.
    """
    return get_category_colors()


@app.post("/assistant/chat")
def assistant_chat(payload: ChatRequest):
    """
    LLM-powered assistant chat.
    Expects: { "message": "..." }
    """
    result = generate_assistant_response(payload.message)
    return result
    



@app.get("/ui/today")
def ui_today():
    return build_today_ui()


@app.get("/ui/week")
def ui_week():
    return build_week_ui()


@app.get("/ui/calendar")
def ui_calendar(start: str, end: str):
    return build_calendar_ui(start, end)
