# intent.py
# This file defines the structure of the "intent" that the AI will return.
# Every time the user types something (e.g., "Gym tomorrow at 6pm"),
# the parser will convert it into this consistent format.

from pydantic import BaseModel
from typing import Optional

class Intent(BaseModel):
    """
    This model represents the structured information extracted from
    the user's natural language input.

    For example:
    "Add gym on Tuesday at 6pm"
    becomes:
    {
        intent_type: "event",
        title: "gym",
        date: "2025-12-02",
        time: "18:00",
        datetime: "2025-12-02 18:00",
        category: "health",
        notes: null,
    }
    """

    intent_type: str                 # event | reminder | diary | memory | unknown
    title: Optional[str] = None      # name of the task/event/reminder
    date: Optional[str] = None       # parsed date (YYYY-MM-DD)
    time: Optional[str] = None       # parsed time (HH:MM)
    datetime: Optional[str] = None   # combined date and time, if available
    category: Optional[str] = None   # personal, work, fitness, social, etc.
    notes: Optional[str] = None      # any additional information
