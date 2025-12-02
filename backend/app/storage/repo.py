# app/storage/repo.py

import json
import uuid
from pathlib import Path

# Compute correct absolute path to db/data.json
BASE_DIR = Path(__file__).resolve().parent.parent / "db"
DATA_FILE = BASE_DIR / "data.json"

# Ensure db folder exists
BASE_DIR.mkdir(parents=True, exist_ok=True)


# If file doesn't exist, create it
if not DATA_FILE.exists():
    DATA_FILE.write_text(json.dumps({"tasks": [], "diary": [], "memories": []}, indent=4))

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

class Repo:
    def __init__(self):
        self.data = load_data()

    def add_task(self, task):
        task.id = str(uuid.uuid4())
        self.data["tasks"].append(task.model_dump())
        save_data(self.data)

    def add_diary(self, entry):
        entry.id = str(uuid.uuid4())
        self.data["diary"].append(entry.model_dump())
        save_data(self.data)

    def add_memory(self, mem):
        mem.id = str(uuid.uuid4())
        self.data["memories"].append(mem.model_dump())
        save_data(self.data)

# Singleton instance
repo = Repo()
