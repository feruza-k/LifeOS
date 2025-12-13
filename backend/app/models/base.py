# base.py
# Base model that provides unique IDs for all items

from pydantic import BaseModel
from typing import Optional

class BaseItem(BaseModel):
    """Base class for all data models with unique ID."""
    id: Optional[str] = None

