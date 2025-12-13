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
# Default categories matching frontend defaults
DEFAULT_CATEGORIES = [
    {"id": "health", "label": "Health", "color": "#C7DED5"},  # Muted Sage
    {"id": "growth", "label": "Growth", "color": "#C9DCEB"},  # Pale Sky
    {"id": "family", "label": "Family", "color": "#F4D6E4"},  # Dusty Rose
    {"id": "work", "label": "Work", "color": "#DCD0E6"},  # Lavender Mist
    {"id": "creativity", "label": "Creativity", "color": "#FFF5E0"},  # Creamy Yellow
]

if not DATA_FILE.exists():
    DATA_FILE.write_text(json.dumps(
        {
            "tasks": [],
            "diary": [],
            "memories": [],
            "pending": {},
            "notes": [],
            "checkins": [],
            "reminders": [],
            "monthly_focus": [],
            "categories": DEFAULT_CATEGORIES
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
        # Ensure new fields exist (migration for existing data)
        if "notes" not in self.data:
            self.data["notes"] = []
        if "checkins" not in self.data:
            self.data["checkins"] = []
        if "reminders" not in self.data:
            self.data["reminders"] = []
        if "monthly_focus" not in self.data:
            self.data["monthly_focus"] = []
        if "categories" not in self.data:
            # Migrate existing data: add default categories
            self.data["categories"] = DEFAULT_CATEGORIES
        # Save if we added new fields
        if any(key not in load_data() for key in ["notes", "checkins", "reminders", "monthly_focus", "categories"]):
            save_data(self.data)

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

    def toggle_task_complete(self, task_id: str):
        """
        Toggle a task's completed status by ID.
        """
        for t in self.data["tasks"]:
            if t["id"] == task_id:
                t["completed"] = not t.get("completed", False)
                save_data(self.data)
                logger.info(f"Task toggled: {t['id']} -> completed={t['completed']}")
                return t
        return None

    def update_task(self, task_id: str, updates: dict):
        """Update a task by ID."""
        for t in self.data["tasks"]:
            if t["id"] == task_id:
                t.update(updates)
                save_data(self.data)
                logger.info(f"Task updated: {task_id}")
                return t
        return None

    def delete_task(self, task_id: str):
        """Delete a task by ID."""
        original_len = len(self.data["tasks"])
        self.data["tasks"] = [t for t in self.data["tasks"] if t["id"] != task_id]
        if len(self.data["tasks"]) < original_len:
            save_data(self.data)
            logger.info(f"Task deleted: {task_id}")
            return True
        return False

    def get_task(self, task_id: str):
        """Get a task by ID."""
        for t in self.data["tasks"]:
            if t["id"] == task_id:
                return t
        return None

    def add_task_dict(self, task_dict: dict):
        """Add a task from a dictionary (for frontend compatibility)."""
        if "id" not in task_dict:
            task_dict["id"] = str(uuid.uuid4())
        if "created_at" not in task_dict and "createdAt" not in task_dict:
            from datetime import datetime
            task_dict["created_at"] = datetime.now().isoformat()
        self.data["tasks"].append(task_dict)
        save_data(self.data)
        logger.info(f"Task added: {task_dict['id']}")
        return task_dict

    # -----------------------------
    # Notes operations
    # -----------------------------
    def get_note(self, date: str):
        """Get note for a specific date."""
        notes = self.data.get("notes", [])
        return next((n for n in notes if n.get("date") == date), None)

    def save_note(self, note_dict: dict):
        """Save or update a note."""
        if "id" not in note_dict:
            note_dict["id"] = str(uuid.uuid4())
        if "createdAt" not in note_dict:
            from datetime import datetime
            note_dict["createdAt"] = datetime.now().isoformat()
        if "updatedAt" not in note_dict:
            from datetime import datetime
            note_dict["updatedAt"] = datetime.now().isoformat()

        notes = self.data.get("notes", [])
        existing_idx = next((i for i, n in enumerate(notes) if n.get("date") == note_dict.get("date")), None)
        
        if existing_idx is not None:
            notes[existing_idx] = note_dict
        else:
            notes.append(note_dict)
        
        self.data["notes"] = notes
        save_data(self.data)
        logger.info(f"Note saved: {note_dict.get('date')}")
        return note_dict

    # -----------------------------
    # Check-ins operations
    # -----------------------------
    def get_checkin(self, date: str):
        """Get check-in for a specific date."""
        checkins = self.data.get("checkins", [])
        return next((c for c in checkins if c.get("date") == date), None)

    def save_checkin(self, checkin_dict: dict):
        """Save or update a check-in."""
        if "id" not in checkin_dict:
            checkin_dict["id"] = str(uuid.uuid4())
        if "timestamp" not in checkin_dict:
            from datetime import datetime
            checkin_dict["timestamp"] = datetime.now().isoformat()

        checkins = self.data.get("checkins", [])
        existing_idx = next((i for i, c in enumerate(checkins) if c.get("date") == checkin_dict.get("date")), None)
        
        if existing_idx is not None:
            checkins[existing_idx] = checkin_dict
        else:
            checkins.append(checkin_dict)
        
        self.data["checkins"] = checkins
        save_data(self.data)
        logger.info(f"Check-in saved: {checkin_dict.get('date')}")
        return checkin_dict

    # -----------------------------
    # Reminders operations
    # -----------------------------
    def get_reminders(self):
        """Get all reminders."""
        return self.data.get("reminders", [])

    def add_reminder(self, reminder_dict: dict):
        """Add a reminder."""
        if "id" not in reminder_dict:
            reminder_dict["id"] = str(uuid.uuid4())
        if "createdAt" not in reminder_dict:
            from datetime import datetime
            reminder_dict["createdAt"] = datetime.now().isoformat()
        
        reminders = self.data.get("reminders", [])
        reminders.append(reminder_dict)
        self.data["reminders"] = reminders
        save_data(self.data)
        logger.info(f"Reminder added: {reminder_dict['id']}")
        return reminder_dict

    def update_reminder(self, reminder_id: str, updates: dict):
        """Update a reminder by ID."""
        reminders = self.data.get("reminders", [])
        for i, reminder in enumerate(reminders):
            if reminder.get("id") == reminder_id:
                reminders[i] = {**reminder, **updates}
                self.data["reminders"] = reminders
                save_data(self.data)
                logger.info(f"Reminder updated: {reminder_id}")
                return reminders[i]
        return None

    def delete_reminder(self, reminder_id: str):
        """Delete a reminder by ID."""
        reminders = self.data.get("reminders", [])
        original_len = len(reminders)
        self.data["reminders"] = [r for r in reminders if r.get("id") != reminder_id]
        if len(self.data["reminders"]) < original_len:
            save_data(self.data)
            logger.info(f"Reminder deleted: {reminder_id}")
            return True
        return False

    # -----------------------------
    # Monthly Focus operations
    # -----------------------------
    def get_monthly_focus(self, month: str):
        """Get monthly focus for a specific month (YYYY-MM format)."""
        focuses = self.data.get("monthly_focus", [])
        return next((f for f in focuses if f.get("month") == month), None)

    def save_monthly_focus(self, focus_dict: dict):
        """Save or update monthly focus."""
        if "id" not in focus_dict:
            focus_dict["id"] = str(uuid.uuid4())
        if "createdAt" not in focus_dict:
            from datetime import datetime
            focus_dict["createdAt"] = datetime.now().isoformat()

        focuses = self.data.get("monthly_focus", [])
        existing_idx = next((i for i, f in enumerate(focuses) if f.get("month") == focus_dict.get("month")), None)
        
        if existing_idx is not None:
            focuses[existing_idx] = focus_dict
        else:
            focuses.append(focus_dict)
        
        self.data["monthly_focus"] = focuses
        save_data(self.data)
        logger.info(f"Monthly focus saved: {focus_dict.get('month')}")
        return focus_dict

    # -----------------------------
    # Categories operations
    # -----------------------------
    def get_categories(self):
        """Get all categories."""
        return self.data.get("categories", [])

    def get_category(self, category_id: str):
        """Get a category by ID."""
        categories = self.data.get("categories", [])
        return next((c for c in categories if c.get("id") == category_id), None)

    def add_category(self, category_dict: dict):
        """Add a new category."""
        if "id" not in category_dict:
            category_dict["id"] = str(uuid.uuid4())
        
        categories = self.data.get("categories", [])
        categories.append(category_dict)
        self.data["categories"] = categories
        save_data(self.data)
        logger.info(f"Category added: {category_dict.get('id')}")
        return category_dict

    def update_category(self, category_id: str, updates: dict):
        """Update a category by ID."""
        categories = self.data.get("categories", [])
        for i, cat in enumerate(categories):
            if cat.get("id") == category_id:
                categories[i] = {**cat, **updates}
                self.data["categories"] = categories
                save_data(self.data)
                logger.info(f"Category updated: {category_id}")
                return categories[i]
        return None

    def delete_category(self, category_id: str):
        """Delete a category by ID."""
        categories = self.data.get("categories", [])
        original_len = len(categories)
        self.data["categories"] = [c for c in categories if c.get("id") != category_id]
        if len(self.data["categories"]) < original_len:
            save_data(self.data)
            logger.info(f"Category deleted: {category_id}")
            return True
        return False


# Instance
repo = Repo()
