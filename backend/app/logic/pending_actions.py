# app/logic/pending_actions.py

from db.repo import db_repo

"""
Handles storing, retrieving, and clearing pending assistant actions.
Pending actions let the assistant ask:
"Should I move this task to 6pm?"
and wait for a yes/no answer.

Now user-scoped to support multiple users and uses PostgreSQL.
"""

async def create_pending_action(action_type: str, payload: dict, user_id: str):
    """
    action_type: "reschedule" | "edit" | "delete" | "complete" | "create"
    payload: dict with any required fields
    user_id: user identifier for scoping pending actions
    """
    result = await db_repo.create_pending_action(action_type, payload, user_id)
    return {
        "type": result["type"],
        "payload": result["payload"]
    }

async def get_current_pending(user_id: str = None):
    """Get pending action for a specific user."""
    if not user_id:
        # For backward compatibility, return empty if no user_id
        return {}
    
    result = await db_repo.get_pending_action(user_id)
    if result:
        return {
            "type": result["type"],
            "payload": result["payload"]
        }
    return {}

async def clear_current_pending(user_id: str = None):
    """Clear pending action for a specific user."""
    if not user_id:
        return
    
    await db_repo.clear_pending_action(user_id)
