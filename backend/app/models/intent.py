# intent.py
# Pydantic model for parsed intents from natural language

from typing import Optional
from pydantic import BaseModel

class Intent(BaseModel):
    """Structured intent parsed from natural language input."""
    intent_type: str  # event, reminder, diary, memory
    title: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD
    time: Optional[str] = None  # HH:MM
    datetime: Optional[str] = None  # YYYY-MM-DD HH:MM
    category: Optional[str] = None
    notes: Optional[str] = None

