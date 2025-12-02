# Memory item: used for long-term personal preferences.
# Example: "I prefer working out in the evening".

from typing import Optional
from .base import BaseItem

class Memory(BaseItem):
    text: str                 # long-term preference
    category: Optional[str] = "personal"
