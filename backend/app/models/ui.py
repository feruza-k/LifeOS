# app/models/ui.py

from typing import Literal, Optional, List, Union
from pydantic import BaseModel


# UI Actions

class ConfirmRescheduleUI(BaseModel):
    action: Literal["confirm_reschedule"]
    task_id: str
    options: List[str]


class ApplyRescheduleUI(BaseModel):
    action: Literal["apply_reschedule"]
    task_id: str
    new_time: str  # HH:MM


class UpdateTaskUI(BaseModel):
    action: Literal["update_task"]
    task_id: str


class RefreshUI(BaseModel):
    action: Literal["refresh"]


# Union of all possible UI actions
UIAction = Union[
    ConfirmRescheduleUI,
    ApplyRescheduleUI,
    UpdateTaskUI,
    RefreshUI,
]



# Top-level assistant reply 

class AssistantReply(BaseModel):
    assistant_response: str
    ui: Optional[UIAction] = None
