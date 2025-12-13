# memory.py
# Memory model for long-term personal preferences

from typing import Optional
from .base import BaseItem

class Memory(BaseItem):
    """Memory for storing long-term personal preferences."""
    text: str
    category: Optional[str] = None

