from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from app.ai.parser import test_ai_connection
from app.ai.parser import parse_intent


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
