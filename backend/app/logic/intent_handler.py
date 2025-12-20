# intent_handler.py

from db.repo import db_repo
from app.logic.frontend_adapter import frontend_task_to_backend
from app.models.intent import Intent

async def handle_intent(intent: Intent, user_id: str):
    """
    Routes parsed intent to the correct storage action.
    Requires user_id for database operations.
    """

    # Event

    if intent.intent_type == "event":
        # Convert intent to task dict format
        task_dict = {
            "title": intent.title,
            "date": intent.date,
            "time": intent.time,
            "datetime": intent.datetime,
            "category": intent.category,
            "notes": intent.notes,
            "type": "event",
            "user_id": user_id
        }
        # Convert to backend format
        backend_task = frontend_task_to_backend(task_dict, task_type="event")
        backend_task["user_id"] = user_id
        
        # Get categories for mapping
        categories = await db_repo.get_categories(user_id)
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        
        # Look up category_id if category label is provided
        if backend_task.get("category"):
            category_label = backend_task["category"].lower()
            if category_label in category_label_to_id:
                backend_task["category_id"] = category_label_to_id[category_label]
        
        result = await db_repo.add_task_dict(backend_task)
        return {"message": "Event saved", "event": result}

    # Reminder

    elif intent.intent_type == "reminder":
        # Convert intent to task dict format
        task_dict = {
            "title": intent.title,
            "date": intent.date,
            "time": intent.time,
            "datetime": intent.datetime,
            "category": intent.category,
            "notes": intent.notes,
            "type": "reminder",
            "user_id": user_id
        }
        # Convert to backend format
        backend_task = frontend_task_to_backend(task_dict, task_type="reminder")
        backend_task["user_id"] = user_id
        
        # Get categories for mapping
        categories = await db_repo.get_categories(user_id)
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        
        # Look up category_id if category label is provided
        if backend_task.get("category"):
            category_label = backend_task["category"].lower()
            if category_label in category_label_to_id:
                backend_task["category_id"] = category_label_to_id[category_label]
        
        result = await db_repo.add_task_dict(backend_task)
        return {"message": "Reminder saved", "reminder": result}

    # -------------------
    # DIARY ENTRY
    # -------------------
    elif intent.intent_type == "diary":
        diary_dict = {
            "text": intent.notes or "",
            "category": intent.category
        }
        result = await db_repo.add_diary_entry(diary_dict, user_id)
        return {"message": "Diary saved", "diary": result}

    # -------------------
    # MEMORY
    # -------------------
    elif intent.intent_type == "memory":
        memory_dict = {
            "text": intent.notes or "",
            "category": intent.category
        }
        result = await db_repo.add_memory(memory_dict, user_id)
        return {"message": "Memory saved", "memory": result}

    # -------------------
    # UNKNOWN
    # -------------------
    else:
        return {"message": "Unknown intent type", "raw": intent}
