from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.models.task import Task
import os

# AI
from app.ai.parser import test_ai_connection, parse_intent

# Storage
from app.storage.repo import repo, load_data, save_data

# Logic
from app.logic.intent_handler import handle_intent
from app.logic.task_engine import (
    get_tasks_today,
    get_upcoming_tasks,
    get_overdue_tasks,
    get_next_task,
    group_tasks_by_date,
    group_tasks_pretty,
    get_today_timeline
)

from pydantic import BaseModel


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
