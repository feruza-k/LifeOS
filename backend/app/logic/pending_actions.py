# app/logic/pending_actions.py


from app.storage.repo import get_pending, set_pending, clear_pending

"""
Handles storing, retrieving, and clearing pending assistant actions.
Pending actions let the assistant ask:
“Should I move this task to 6pm?”
and wait for a yes/no answer.
"""

def create_pending_action(action_type: str, payload: dict):
    """
    action_type: "reschedule" | "edit" | "delete" | "complete"
    payload: dict with any required fields
    """
    return set_pending({
        "type": action_type,
        "payload": payload
    })


def get_current_pending():
    return get_pending()


def clear_current_pending():
    clear_pending()
