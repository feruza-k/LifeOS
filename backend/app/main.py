from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from app.ai.parser import test_ai_connection
from app.ai.parser import parse_intent
from app.storage.repo import repo
from app.ai.processor import process_natural_text
from pydantic import BaseModel
from app.logic.intent_handler import handle_intent
from app.storage.repo import repo, load_data, save_data




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
    return load_data().get("tasks", [])


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
