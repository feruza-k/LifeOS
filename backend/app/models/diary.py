# Diary entry model.
# For now just stores the date and whatever I write.
# "mood" is optional can be used later for insights.

from typing import Optional
from .base import BaseItem

class DiaryEntry(BaseItem):
    text: str                 # what I wrote
    category: Optional[str] = "personal"
