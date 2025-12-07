# app/storage/repo.py

import json
import uuid
from pathlib import Path
from app.logging import logger


# Compute correct absolute path to db/data.json
BASE_DIR = Path(__file__).resolve().parent.parent / "db"
DATA_FILE = BASE_DIR / "data.json"

# Ensure db folder exists
BASE_DIR.mkdir(parents=True, exist_ok=True)

# If file doesn't exist, create it
if not DATA_FILE.exists():
    DATA_FILE.write_text(json.dumps(
        {
            "tasks": [],
            "diary": [],
            "memories": [],
            "pending": {}     # NEW
        },
        indent=4
    ))


def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

def get_pending():
    data = load_data()
    return data.get("pending", {})

def set_pending(pending_dict):
    data = load_data()
    data["pending"] = pending_dict
    save_data(data)
    return pending_dict

def clear_pending():
    data = load_data()
    data["pending"] = {}
    save_data(data)


class Repo:
    def __init__(self):
        self.data = load_data()

    # -----------------------------
    # Add items
    # -----------------------------
    def add_task(self, task):
        task.id = str(uuid.uuid4())
        self.data["tasks"].append(task.model_dump())
        save_data(self.data)
        logger.info(f"Task added: {task.model_dump()}")

    def add_diary(self, entry):
        entry.id = str(uuid.uuid4())
        self.data["diary"].append(entry.model_dump())
        save_data(self.data)
        logger.info(f"Diary entry added: {entry.model_dump()}")

    def add_memory(self, mem):
        mem.id = str(uuid.uuid4())
        self.data["memories"].append(mem.model_dump())
        save_data(self.data)
        logger.info(f"Memory added: {mem.model_dump()}")

    # -----------------------------
    # Mark task complete
    # -----------------------------
    def mark_task_complete(self, task_id: str):
        """
        Mark a task as completed by ID.
        """
        for t in self.data["tasks"]:
            if t["id"] == task_id:
                t["completed"] = True
                save_data(self.data)
                logger.info(f"Task completed: {t['id']}")
                return t
        return None


# Instance
repo = Repo()
