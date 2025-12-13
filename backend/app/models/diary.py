# diary.py
# Diary entry model for daily reflections

from typing import Optional
from .base import BaseItem

class DiaryEntry(BaseItem):
    """Diary entry for daily reflections."""
    text: str
    category: Optional[str] = None

