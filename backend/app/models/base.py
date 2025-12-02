# Base model for all items (task, diary entry, memory)
# Every item in LifeOS needs a unique ID so we generate it here.

from pydantic import BaseModel
import uuid

class BaseItem(BaseModel):
    id: str | None = None  # assigned by repo

    def assign_id(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        return self
