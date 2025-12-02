from app.ai.parser import parse_intent
from app.models.task import Task
from app.storage.repo import repo

def process_natural_text(text: str):
    # Step 1: parse user input
    intent = parse_intent(text)

    # Step 2: only create a Task for event/reminder
    if intent.intent_type in ["event", "reminder"]:
        task = Task(
            type=intent.intent_type,   # <--- IMPORTANT
            title=intent.title,
            date=intent.date,
            time=intent.time,
            datetime=intent.datetime,
            category=intent.category,
            notes=intent.notes,
        )
        repo.add_task(task)
        return {"status": "saved", "task": task}

    # For now, ignore diary/memory in this flow
    return {"status": "ignored", "reason": f"intent_type={intent.intent_type}"}
