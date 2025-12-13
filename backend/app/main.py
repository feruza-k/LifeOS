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
from app.logic.today_engine import get_today_view
from app.logic.suggestion_engine import get_suggestions
from app.logic.categories import get_category_colors
from app.logic.week_engine import (
    get_tasks_in_range,
    get_week_stats,
)
from app.logic.reschedule_engine import generate_reschedule_suggestions
from app.logic.conflict_engine import find_conflicts
from app.logic.task_engine import get_all_tasks
from app.logic.frontend_adapter import backend_task_to_frontend, frontend_task_to_backend
from app.models.ui import AssistantReply

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


class TaskCreateRequest(BaseModel):
    title: str
    time: str | None = None
    endTime: str | None = None
    completed: bool = False
    value: str = "work"
    date: str
    createdAt: str | None = None
    movedFrom: str | None = None


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    time: str | None = None
    endTime: str | None = None
    completed: bool | None = None
    value: str | None = None
    date: str | None = None
    movedFrom: str | None = None


class NoteRequest(BaseModel):
    date: str
    content: str
    id: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None


class CheckInRequest(BaseModel):
    date: str
    completedTaskIds: list[str]
    incompleteTaskIds: list[str]
    movedTasks: list[dict]
    note: str | None = None
    mood: str | None = None  # Emoji mood from reflection step
    id: str | None = None
    timestamp: str | None = None


class ReminderRequest(BaseModel):
    title: str
    description: str | None = None
    dueDate: str | None = None
    time: str | None = None
    type: str | None = None
    note: str | None = None
    recurring: str | None = None
    visible: bool = True
    id: str | None = None
    createdAt: str | None = None


class MonthlyFocusRequest(BaseModel):
    month: str
    title: str
    description: str | None = None
    progress: int | None = None
    id: str | None = None
    createdAt: str | None = None


# -----------------------------------------------------
# ROOT
# -----------------------------------------------------

@app.get("/")
def home():
    """Basic API health check."""
    return {"message": "LifeOS API is running 🚀"}


# -----------------------------------------------------
# Development & Debug Endpoints
# -----------------------------------------------------

@app.get("/ai-test")
def ai_test():
    """Verify OpenAI API connectivity (dev only)."""
    return {"response": test_ai_connection()}


@app.post("/parse")
def parse_endpoint(user_input: str):
    """Parse natural language to intent (dev/debug)."""
    return parse_intent(user_input)


@app.get("/process")
def process(text: str):
    """Full loop: natural language → intent → storage/action (dev/debug)."""
    intent = parse_intent(text)
    result = handle_intent(intent)
    return {"intent": intent, "result": result}


@app.get("/tasks")
def get_tasks():
    """Get all tasks (backend format, for debugging)."""
    return get_all_tasks()


@app.get("/all")
def get_all():
    """Get all data (dev/debug endpoint)."""
    return load_data()


@app.post("/clear")
def clear_data():
    """Clear all stored data (dev only)."""
    empty = {"tasks": [], "diary": [], "memories": [], "pending": {}, "notes": [], "checkins": [], "reminders": [], "monthly_focus": []}
    save_data(empty)
    repo.data = empty
    return {"status": "cleared"}


@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str):
    """Toggle task completion status (for frontend compatibility)."""
    result = repo.toggle_task_complete(task_id)
    if result:
        return {"status": "completed" if result.get("completed") else "incomplete", "task": result}
    return {"error": "Task not found"}


# -----------------------------------------------------
# Frontend-Compatible Task Endpoints
# -----------------------------------------------------

@app.get("/tasks/by-date")
def get_tasks_by_date(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """Get tasks for a specific date in frontend format."""
    tasks = load_data().get("tasks", [])
    date_tasks = [t for t in tasks if t.get("date") == date]
    return [backend_task_to_frontend(t) for t in date_tasks]


@app.post("/tasks")
def create_task(task_data: TaskCreateRequest):
    """Create a new task from frontend format."""
    task_dict = task_data.model_dump(exclude_none=True)
    backend_task = frontend_task_to_backend(task_dict)
    result = repo.add_task_dict(backend_task)
    return backend_task_to_frontend(result)


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, updates: TaskUpdateRequest):
    """Update a task."""
    updates_dict = updates.model_dump(exclude_none=True)
    # Convert frontend updates to backend format if needed
    backend_updates = {}
    if "value" in updates_dict:
        backend_updates["category"] = updates_dict["value"]
    if "endTime" in updates_dict and updates_dict.get("time") and updates_dict.get("date"):
        # Calculate duration
        try:
            start_hour, start_min = map(int, updates_dict["time"].split(":"))
            end_hour, end_min = map(int, updates_dict["endTime"].split(":"))
            start_total = start_hour * 60 + start_min
            end_total = end_hour * 60 + end_min
            duration = end_total - start_total
            if duration > 0:
                backend_updates["duration_minutes"] = duration
                backend_updates["end_datetime"] = f"{updates_dict['date']} {updates_dict['endTime']}"
        except:
            pass
    
    # Copy other fields directly
    for key in ["title", "date", "time", "completed"]:
        if key in updates_dict:
            backend_updates[key] = updates_dict[key]
    
    result = repo.update_task(task_id, backend_updates)
    if result:
        return backend_task_to_frontend(result)
    return {"error": "Task not found"}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: str):
    """Delete a task."""
    success = repo.delete_task(task_id)
    if success:
        return {"status": "deleted", "id": task_id}
    return {"error": "Task not found"}


@app.post("/tasks/{task_id}/move")
def move_task(task_id: str, new_date: str = Query(..., description="New date in YYYY-MM-DD format")):
    """Move a task to a new date."""
    task = repo.get_task(task_id)
    if not task:
        return {"error": "Task not found"}
    
    # Store original date as movedFrom
    updates = {
        "date": new_date,
        "moved_from": task.get("date")
    }
    result = repo.update_task(task_id, updates)
    if result:
        return backend_task_to_frontend(result)
    return {"error": "Failed to move task"}


# -----------------------------------------------------
# Notes Endpoints
# -----------------------------------------------------

@app.get("/notes")
def get_note(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """Get note for a specific date."""
    note = repo.get_note(date)
    if note:
        return note
    return None


@app.post("/notes")
@app.put("/notes")
def save_note(note_data: dict):
    """Save or update a note."""
    result = repo.save_note(note_data)
    return result


# -----------------------------------------------------
# Check-ins Endpoints
# -----------------------------------------------------

@app.get("/checkins")
def get_checkin(date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """Get check-in for a specific date."""
    checkin = repo.get_checkin(date)
    if checkin:
        return checkin
    return None


@app.post("/checkins")
def save_checkin(checkin_data: CheckInRequest):
    """Save or update a check-in."""
    result = repo.save_checkin(checkin_data.model_dump(exclude_none=True))
    return result


# -----------------------------------------------------
# Reminders Endpoints (separate from task reminders)
# -----------------------------------------------------

@app.get("/reminders")
def get_all_reminders():
    """Get all reminders (separate from task reminders)."""
    return repo.get_reminders()


@app.post("/reminders")
def create_reminder(reminder_data: ReminderRequest):
    """Create a new reminder."""
    result = repo.add_reminder(reminder_data.model_dump(exclude_none=True))
    return result


class ReminderUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    dueDate: str | None = None
    time: str | None = None
    type: str | None = None
    note: str | None = None
    recurring: str | None = None
    visible: bool | None = None


@app.patch("/reminders/{reminder_id}")
def update_reminder(reminder_id: str, updates: ReminderUpdateRequest):
    """Update a reminder."""
    updates_dict = updates.model_dump(exclude_none=True)
    result = repo.update_reminder(reminder_id, updates_dict)
    if result:
        return result
    return {"error": "Reminder not found"}


@app.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str):
    """Delete a reminder."""
    success = repo.delete_reminder(reminder_id)
    if success:
        return {"status": "deleted", "id": reminder_id}
    return {"error": "Reminder not found"}


# -----------------------------------------------------
# Monthly Focus Endpoints
# -----------------------------------------------------

@app.get("/monthly-focus")
def get_monthly_focus(month: str = Query(..., description="Month in YYYY-MM format")):
    """Get monthly focus for a specific month."""
    focus = repo.get_monthly_focus(month)
    if focus:
        return focus
    return None


@app.post("/monthly-focus")
def save_monthly_focus(focus_data: MonthlyFocusRequest):
    """Save or update monthly focus."""
    result = repo.save_monthly_focus(focus_data.model_dump(exclude_none=True))
    return result


# -----------------------------------------------------
# Categories Endpoints
# -----------------------------------------------------

class CategoryRequest(BaseModel):
    label: str
    color: str
    id: str | None = None


class CategoryUpdateRequest(BaseModel):
    label: str | None = None
    color: str | None = None


@app.get("/categories")
def get_all_categories():
    """Get all categories."""
    return repo.get_categories()


@app.get("/categories/{category_id}")
def get_category(category_id: str):
    """Get a specific category by ID."""
    category = repo.get_category(category_id)
    if category:
        return category
    return {"error": "Category not found"}


@app.post("/categories")
def create_category(category_data: CategoryRequest):
    """Create a new category."""
    category_dict = category_data.model_dump(exclude_none=True)
    result = repo.add_category(category_dict)
    return result


@app.patch("/categories/{category_id}")
def update_category(category_id: str, updates: CategoryUpdateRequest):
    """Update a category."""
    updates_dict = updates.model_dump(exclude_none=True)
    result = repo.update_category(category_id, updates_dict)
    if result:
        return result
    return {"error": "Category not found"}


@app.delete("/categories/{category_id}")
def delete_category(category_id: str):
    """Delete a category."""
    success = repo.delete_category(category_id)
    if success:
        return {"status": "deleted", "id": category_id}
    return {"error": "Category not found"}


# -----------------------------------------------------
# Weekly & Calendar Views (Used by Frontend)
# -----------------------------------------------------

@app.get("/tasks/calendar")
def tasks_calendar(
    start: str = Query(...),
    end: str = Query(...),
):
    """Get tasks for a date range, returned as flat array in frontend format."""
    try:
        range_data = get_tasks_in_range(start, end)
        # Extract all tasks from all days and convert to frontend format
        all_tasks = []
        for day in range_data.get("days", []):
            for task in day.get("tasks", []):
                all_tasks.append(backend_task_to_frontend(task))
        return all_tasks
    except ValueError as e:
        return {"error": str(e)}


@app.get("/tasks/conflicts")
def tasks_conflicts(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    return find_conflicts(start, end)


# -----------------------------------------------------
# Assistant Endpoints (SolAI)
# -----------------------------------------------------

@app.post("/assistant/chat", response_model=AssistantReply)
def assistant_chat(payload: ChatRequest):
    """Main SolAI chat endpoint."""
    reply = generate_assistant_response(payload.message)
    return {
        "assistant_response": reply.get("assistant_response", "Something went wrong."),
        "ui": reply.get("ui")
    }


@app.post("/assistant/confirm")
def assistant_confirm():
    """Confirm pending action (equivalent to user saying 'yes')."""
    return generate_assistant_response("yes")


@app.get("/assistant/bootstrap")
def assistant_bootstrap():
    """Bootstrap endpoint: returns all initial data needed by frontend."""
    today_view = get_today_view()
    
    return {
        "today": {
            "date": today_view["date"],
            "tasks": [backend_task_to_frontend(t) for t in today_view["tasks"]],
            "load": today_view["load"],  # Deprecated
            "energy": today_view["energy"]
        },
        "week": get_week_stats(),
        "suggestions": get_suggestions().get("suggestions", []),
        "conflicts": find_conflicts(),
        "categories": get_category_colors(),
        "pending": load_data().get("pending", {})
    }


@app.get("/assistant/today")
def assistant_today(date: str | None = Query(None, description="Date in YYYY-MM-DD format (defaults to today)")):
    """Get tasks for a specific date or today, with energy calculation."""
    from datetime import datetime
    import pytz
    from app.logic.today_engine import calculate_energy
    
    tz = pytz.timezone("Europe/London")
    
    # If date provided, filter tasks for that date
    if date:
        tasks = load_data().get("tasks", [])
        date_tasks = [t for t in tasks if t.get("date") == date]
        
        # Sort: tasks with time first (by time), then tasks without time
        tasks_with_time = sorted(
            [t for t in date_tasks if t.get("time")],
            key=lambda x: x.get("time", "")
        )
        tasks_without_time = [t for t in date_tasks if not t.get("time")]
        sorted_tasks = tasks_with_time + tasks_without_time
        
        # Calculate energy using weighted task load model
        energy = calculate_energy(sorted_tasks)
        
        # Legacy load calculation (deprecated)
        total_tasks = len(sorted_tasks)
        if total_tasks == 0:
            load = "empty"
        elif total_tasks <= 2:
            load = "light"
        elif total_tasks <= 5:
            load = "medium"
        else:
            load = "heavy"
        
        return {
            "date": date,
            "tasks": [backend_task_to_frontend(t) for t in sorted_tasks],
            "load": load,  # Deprecated, use energy.status instead
            "energy": energy
        }
    
    # Default: use today
    today_view = get_today_view()
    return {
        "date": today_view["date"],
        "tasks": [backend_task_to_frontend(t) for t in today_view["tasks"]],
        "load": today_view["load"],  # Deprecated
        "energy": today_view["energy"]
    }


@app.get("/assistant/suggestions")
def assistant_suggestions():
    """Get suggestions for the user."""
    return get_suggestions()


@app.get("/assistant/reschedule-options")
def assistant_reschedule_options(task_id: str):
    """Get rescheduling suggestions for a specific task."""
    tasks = load_data().get("tasks", [])
    task = next((t for t in tasks if t["id"] == task_id), None)

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task_id)
    return {"task": task, "suggestions": suggestions.get("suggestions", [])}


@app.get("/assistant/suggestions")
def assistant_suggestions():
    """Get suggestions for the user."""
    return get_suggestions()


# -----------------------------------------------------
# Meta Endpoints
# -----------------------------------------------------

@app.get("/meta/categories")
def meta_categories():
    """Get category color mapping."""
    return get_category_colors()

