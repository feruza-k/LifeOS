# Task model: used for both events and reminders.
# Parsed intent will be converted into this before saving.
# Dates and times stay as strings for now (easier for JSON storage).

from typing import Optional
from .base import BaseItem

class Task(BaseItem):
    type: str                 # event, reminder
    title: str
    date: Optional[str] = None      # YYYY-MM-DD
    time: Optional[str] = None      # HH:MM
    datetime: Optional[str] = None  # full combined string
    duration_minutes: Optional[int] = None
    end_datetime: Optional[str] = None
    category: Optional[str] = "other"
    notes: Optional[str] = None     # extra details
    completed: bool = False
    energy: Optional[str] = None   # low / medium / high
    context: Optional[str] = None

   

