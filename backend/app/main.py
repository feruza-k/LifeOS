# main.py


from datetime import datetime
import os

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

# AI
from app.ai.parser import test_ai_connection, parse_intent
from app.ai.assistant import generate_assistant_response

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

# Load environment variables
load_dotenv()

# -----------------------------------------------------
# FastAPI App
# -----------------------------------------------------

app = FastAPI(
    title="LifeOS Backend",
    description="AI-powered personal planning assistant backend",
    version="0.1"
)

# Allow backend ↔ mobile app communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------
# Models
# -----------------------------------------------------

class ChatRequest(BaseModel):
    message: str


# -----------------------------------------------------
# ROOT
# -----------------------------------------------------

@app.get("/")
def home():
    """Basic API health check."""
    return {"message": "LifeOS API is running 🚀"}


# -----------------------------------------------------
# AI Test Routes
# -----------------------------------------------------

@app.get("/ai-test")
def ai_test():
    """Verify OpenAI API connectivity."""
    return {"response": test_ai_connection()}


# -----------------------------------------------------
# Intent Parser
# -----------------------------------------------------

@app.post("/parse")
def parse_endpoint(user_input: str):
    """Return structured Intent from raw natural language."""
    return parse_intent(user_input)


@app.get("/process")
def process(text: str):
    """
    Full loop: natural language → intent → storage/action.
    """
    intent = parse_intent(text)
    result = handle_intent(intent)
    return {"intent": intent, "result": result}


# -----------------------------------------------------
# CRUD & Data Access
# -----------------------------------------------------

@app.get("/tasks")
def get_tasks():
    return get_all_tasks()


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
    """
    Clear all stored data (dev only).
    Also clears pending actions.
    """
    empty = {"tasks": [], "diary": [], "memories": [], "pending": {}}
    save_data(empty)
    repo.data = empty
    return {"status": "cleared"}


# -----------------------------------------------------
# Task Engine Endpoints
# -----------------------------------------------------

@app.get("/tasks/today")
def tasks_today():
    return get_tasks_today()

@app.get("/tasks/today/timeline")
def tasks_today_timeline():
    return get_today_timeline()

@app.get("/tasks/upcoming")
def tasks_upcoming():
    return get_upcoming_tasks()

@app.get("/tasks/overdue")
def tasks_overdue():
    return get_overdue_tasks()

@app.get("/tasks/next")
def tasks_next():
    return get_next_task()

@app.get("/tasks/grouped")
def tasks_grouped():
    return group_tasks_by_date()

@app.get("/tasks/grouped-pretty")
def tasks_grouped_pretty():
    return group_tasks_pretty()

@app.get("/tasks/summary")
def task_summary():
    today = get_tasks_today()
    upcoming = get_upcoming_tasks()
    overdue = get_overdue_tasks()

    return {
        "today": today,
        "next": get_next_task(),
        "counts": {
            "today": len(today),
            "upcoming": len(upcoming),
            "overdue": len(overdue),
        },
        "grouped": group_tasks_by_date(),
    }


@app.get("/tasks/events")
def get_events():
    return [t for t in load_data().get("tasks", []) if t["type"] == "event"]


@app.get("/tasks/reminders")
def get_reminders():
    return [t for t in load_data().get("tasks", []) if t["type"] == "reminder"]


@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str):
    result = repo.mark_task_complete(task_id)
    if result:
        return {"status": "completed", "task": result}
    return {"error": "Task not found"}


# -----------------------------------------------------
# Weekly & Calendar Views
# -----------------------------------------------------

@app.get("/tasks/week")
def tasks_week():
    return get_week_view()


@app.get("/tasks/week-summary")
def tasks_week_summary():
    return get_week_stats()


@app.get("/assistant/week-overview")
def assistant_week_overview():
    return {
        "stats": get_week_stats(),
        "summary": get_week_summary_text(),
    }


@app.get("/tasks/calendar")
def tasks_calendar(
    start: str = Query(...),
    end: str = Query(...),
):
    try:
        return get_tasks_in_range(start, end)
    except ValueError as e:
        return {"error": str(e)}


@app.get("/tasks/conflicts")
def tasks_conflicts(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    return find_conflicts(start, end)


# -----------------------------------------------------
# Assistant Insights, Suggestions, Today View
# -----------------------------------------------------

@app.get("/assistant/insights")
def assistant_insights():
    return {"insights": get_insights()}


@app.get("/assistant/today")
def assistant_today():
    return get_today_view()


@app.get("/assistant/suggestions")
def assistant_suggestions():
    return get_suggestions()


@app.get("/assistant/reschedule-options")
def assistant_reschedule_options(task_id: str):
    tasks = load_data().get("tasks", [])
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task)
    return {"task": task, "suggestions": suggestions}


# -----------------------------------------------------
# META (Category Colors)
# -----------------------------------------------------

@app.get("/meta/categories")
def meta_categories():
    return get_category_colors()


# -----------------------------------------------------
# UI Builders
# -----------------------------------------------------

@app.get("/ui/today")
def ui_today():
    return build_today_ui()

@app.get("/ui/week")
def ui_week():
    return build_week_ui()

@app.get("/ui/calendar")
def ui_calendar(start: str, end: str):
    return build_calendar_ui(start, end)


# -----------------------------------------------------
# ASSISTANT CHAT (MAIN ENDPOINT)
# -----------------------------------------------------

from app.models.ui import AssistantReply

@app.post("/assistant/chat", response_model=AssistantReply)
def assistant_chat(payload: ChatRequest):
    reply = generate_assistant_response(payload.message)
    return reply


# -----------------------------------------------------
# ASSISTANT CONFIRM (UI Button Support)
# -----------------------------------------------------

@app.post("/assistant/confirm")
def assistant_confirm():
    """
    Equivalent to user saying “yes”.
    Used by UI confirmation buttons.
    """
    return generate_assistant_response("yes")

