# intent_handler.py

from app.storage.repo import repo
from app.models.task import Task
from app.models.diary import DiaryEntry
from app.models.memory import Memory
from app.models.intent import Intent

def handle_intent(intent: Intent):
    """
    Routes parsed intent to the correct storage action.
    """

    # -------------------
    # EVENT
    # -------------------
    if intent.intent_type == "event":
        task = Task(
            type="event",
            title=intent.title,
            date=intent.date,
            time=intent.time,
            datetime=intent.datetime,
            category=intent.category,
            notes=intent.notes
        )
        repo.add_task(task)
        return {"message": "Event saved", "event": task}

    # -------------------
    # REMINDER
    # -------------------
    elif intent.intent_type == "reminder":
        task = Task(
            type="reminder",
            title=intent.title,
            date=intent.date,
            time=intent.time,
            datetime=intent.datetime,
            category=intent.category,
            notes=intent.notes
        )
        repo.add_task(task)
        return {"message": "Reminder saved", "reminder": task}

    # -------------------
    # DIARY ENTRY
    # -------------------
    elif intent.intent_type == "diary":
        entry = DiaryEntry(
            text=intent.notes,
            category=intent.category
        )
        repo.add_diary(entry)
        return {"message": "Diary saved", "diary": entry}

    # -------------------
    # MEMORY
    # -------------------
    elif intent.intent_type == "memory":
        mem = Memory(
            text=intent.notes,
            category=intent.category
        )
        repo.add_memory(mem)
        return {"message": "Memory saved", "memory": mem}

    # -------------------
    # UNKNOWN
    # -------------------
    else:
        return {"message": "Unknown intent type", "raw": intent}
