# category.py
# Category model for task categorization

from .base import BaseItem

class Category(BaseItem):
    """Category for organizing tasks."""
    label: str
    color: str

