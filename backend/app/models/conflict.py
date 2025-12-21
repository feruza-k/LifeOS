# app/models/conflict.py
from pydantic import BaseModel

class ConflictResolutionRequest(BaseModel):
    """Request to resolve a task conflict by moving it to a new time."""
    new_date: str  # YYYY-MM-DD
    new_time: str  # HH:MM
    new_datetime: str | None = None  # Optional: full datetime string

