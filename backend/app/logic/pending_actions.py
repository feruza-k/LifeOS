# app/logic/pending_actions.py


from app.storage.repo import load_data, save_data

"""
Handles storing, retrieving, and clearing pending assistant actions.
Pending actions let the assistant ask:
"Should I move this task to 6pm?"
and wait for a yes/no answer.

Now user-scoped to support multiple users.
"""

def create_pending_action(action_type: str, payload: dict, user_id: str):
    """
    action_type: "reschedule" | "edit" | "delete" | "complete"
    payload: dict with any required fields
    user_id: user identifier for scoping pending actions
    """
    data = load_data()
    if "pending" not in data:
        data["pending"] = {}
    data["pending"][user_id] = {
        "type": action_type,
        "payload": payload
    }
    save_data(data)
    return data["pending"][user_id]


def get_current_pending(user_id: str = None):
    """Get pending action for a specific user."""
    data = load_data()
    pending = data.get("pending", {})
    if user_id:
        return pending.get(user_id, {})
    # For backward compatibility, return first user's pending if no user_id provided
    if pending:
        return next(iter(pending.values()), {})
    return {}


def clear_current_pending(user_id: str = None):
    """Clear pending action for a specific user."""
    data = load_data()
    if "pending" not in data:
        data["pending"] = {}
    if user_id:
        if user_id in data["pending"]:
            del data["pending"][user_id]
            save_data(data)
    else:
        # For backward compatibility, clear all if no user_id
        data["pending"] = {}
        save_data(data)
