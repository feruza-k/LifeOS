# app/storage/repo.py

import json
import uuid
from pathlib import Path
from datetime import datetime
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
            "users": [],
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
        if "users" not in self.data:
            self.data["users"] = []
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
        if any(key not in load_data() for key in ["users", "notes", "checkins", "reminders", "monthly_focus", "categories"]):
            save_data(self.data)

    # -----------------------------
    # User management
    # -----------------------------
    def get_user_by_email(self, email: str):
        """Get user by email address (case-insensitive)."""
        # Reload data to ensure we have the latest state
        self.data = load_data()
        email_lower = email.lower().strip()
        users = self.data.get("users", [])
        for user in users:
            user_email = user.get("email", "").lower().strip()
            if user_email == email_lower:
                return user
        return None

    def get_user_by_id(self, user_id: str):
        """Get user by ID."""
        # Reload data to ensure we have the latest state
        self.data = load_data()
        users = self.data.get("users", [])
        for user in users:
            if user.get("id") == user_id:
                return user
        return None

    def create_user(self, email: str, hashed_password: str, username: str = None, verification_token: str = None):
        """Create a new user with extended fields."""
        # Reload data to ensure we have the latest state
        self.data = load_data()
        # Normalize email to lowercase for storage
        email_normalized = email.lower().strip()
        
        # Check if user already exists (shouldn't happen if called correctly, but safety check)
        existing = self.get_user_by_email(email_normalized)
        if existing:
            raise ValueError(f"User with email {email_normalized} already exists")
        
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": email_normalized,
            "password": hashed_password,  # Already hashed
            "username": username or email_normalized.split("@")[0],  # Default to email prefix
            "avatar_path": None,
            "email_verified": False,
            "verification_token": verification_token,
            "verification_token_expires": None,  # Will be set if verification_token is provided
            "reset_token": None,
            "reset_token_expires": None,
            "created_at": datetime.now().isoformat(),
            "failed_login_attempts": 0,
            "locked_until": None,
            "refresh_token": None,
            "refresh_token_expires": None
        }
        if "users" not in self.data:
            self.data["users"] = []
        self.data["users"].append(user)
        save_data(self.data)
        logger.info(f"User created: {email_normalized}")
        return user
    
    def update_user(self, user_id: str, updates: dict):
        """Update user fields."""
        # Reload data to ensure we have the latest state
        self.data = load_data()
        for user in self.data.get("users", []):
            if user.get("id") == user_id:
                user.update(updates)
                save_data(self.data)
                logger.info(f"User updated: {user_id}")
                return user
        return None
    
    def get_user_by_verification_token(self, token: str):
        """Get user by verification token."""
        # Reload data to ensure we have the latest state
        self.data = load_data()
        users = self.data.get("users", [])
        for user in users:
            if user.get("verification_token") == token:
                # Check if token is expired
                expires = user.get("verification_token_expires")
                if expires:
                    from datetime import datetime
                    try:
                        expires_dt = datetime.fromisoformat(expires)
                        if datetime.now() > expires_dt:
                            return None  # Token expired
                    except:
                        pass
                return user
        return None
    
    def get_user_by_reset_token(self, token: str):
        """Get user by password reset token."""
        users = self.data.get("users", [])
        for user in users:
            if user.get("reset_token") == token:
                # Check if token is expired
                expires = user.get("reset_token_expires")
                if expires:
                    from datetime import datetime
                    try:
                        expires_dt = datetime.fromisoformat(expires)
                        if datetime.now() > expires_dt:
                            return None  # Token expired
                    except:
                        pass
                return user
        return None

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
    def mark_task_complete(self, task_id: str, user_id: str):
        """
        Mark a task as completed by ID (user-scoped).
        """
        for t in self.data["tasks"]:
            if t["id"] == task_id and t.get("user_id") == user_id:
                t["completed"] = True
                save_data(self.data)
                logger.info(f"Task completed: {t['id']}")
                return t
        return None

    def toggle_task_complete(self, task_id: str, user_id: str):
        """
        Toggle a task's completed status by ID (user-scoped).
        """
        for t in self.data["tasks"]:
            if t["id"] == task_id and t.get("user_id") == user_id:
                t["completed"] = not t.get("completed", False)
                save_data(self.data)
                logger.info(f"Task toggled: {t['id']} -> completed={t['completed']}")
                return t
        return None

    def update_task(self, task_id: str, updates: dict, user_id: str):
        """Update a task by ID (user-scoped)."""
        for t in self.data["tasks"]:
            if t["id"] == task_id and t.get("user_id") == user_id:
                t.update(updates)
                save_data(self.data)
                logger.info(f"Task updated: {task_id}")
                return t
        return None

    def delete_task(self, task_id: str, user_id: str):
        """Delete a task by ID (user-scoped)."""
        original_len = len(self.data["tasks"])
        self.data["tasks"] = [
            t for t in self.data["tasks"] 
            if not (t["id"] == task_id and t.get("user_id") == user_id)
        ]
        if len(self.data["tasks"]) < original_len:
            save_data(self.data)
            logger.info(f"Task deleted: {task_id}")
            return True
        return False

    def get_task(self, task_id: str, user_id: str):
        """Get a task by ID (user-scoped)."""
        for t in self.data["tasks"]:
            if t["id"] == task_id and t.get("user_id") == user_id:
                return t
        return None

    def get_tasks_by_user(self, user_id: str):
        """Get all tasks for a specific user."""
        return [t for t in self.data.get("tasks", []) if t.get("user_id") == user_id]

    def get_tasks_by_date_and_user(self, date: str, user_id: str):
        """Get tasks for a specific date and user."""
        return [
            t for t in self.data.get("tasks", [])
            if t.get("date") == date and t.get("user_id") == user_id
        ]

    def add_task_dict(self, task_dict: dict):
        """Add a task from a dictionary (for frontend compatibility). Requires user_id."""
        if "id" not in task_dict:
            task_dict["id"] = str(uuid.uuid4())
        if "user_id" not in task_dict:
            raise ValueError("user_id is required when adding a task")
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
    def get_note(self, date: str, user_id: str):
        """Get note for a specific date (user-scoped)."""
        notes = self.data.get("notes", [])
        return next(
            (n for n in notes if n.get("date") == date and n.get("user_id") == user_id),
            None
        )

    def save_note(self, note_dict: dict, user_id: str):
        """Save or update a note (requires user_id)."""
        if "user_id" not in note_dict:
            note_dict["user_id"] = user_id
        
        if "id" not in note_dict:
            note_dict["id"] = str(uuid.uuid4())
        if "createdAt" not in note_dict:
            from datetime import datetime
            note_dict["createdAt"] = datetime.now().isoformat()
        if "updatedAt" not in note_dict:
            from datetime import datetime
            note_dict["updatedAt"] = datetime.now().isoformat()

        notes = self.data.get("notes", [])
        existing_idx = next(
            (i for i, n in enumerate(notes) 
             if n.get("date") == note_dict.get("date") and n.get("user_id") == user_id),
            None
        )
        
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
    def get_checkin(self, date: str, user_id: str):
        """Get check-in for a specific date (user-scoped)."""
        checkins = self.data.get("checkins", [])
        return next(
            (c for c in checkins if c.get("date") == date and c.get("user_id") == user_id),
            None
        )

    def save_checkin(self, checkin_dict: dict, user_id: str):
        """Save or update a check-in (requires user_id)."""
        if "user_id" not in checkin_dict:
            checkin_dict["user_id"] = user_id
        
        if "id" not in checkin_dict:
            checkin_dict["id"] = str(uuid.uuid4())
        if "timestamp" not in checkin_dict:
            from datetime import datetime
            checkin_dict["timestamp"] = datetime.now().isoformat()

        checkins = self.data.get("checkins", [])
        existing_idx = next(
            (i for i, c in enumerate(checkins) 
             if c.get("date") == checkin_dict.get("date") and c.get("user_id") == user_id),
            None
        )
        
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
    def get_reminders(self, user_id: str):
        """Get all reminders for a specific user."""
        reminders = self.data.get("reminders", [])
        return [r for r in reminders if r.get("user_id") == user_id]

    def get_reminder(self, reminder_id: str, user_id: str):
        """Get a reminder by ID (user-scoped)."""
        reminders = self.data.get("reminders", [])
        return next((r for r in reminders if r.get("id") == reminder_id and r.get("user_id") == user_id), None)

    def add_reminder(self, reminder_dict: dict, user_id: str):
        """Add a reminder (requires user_id)."""
        if "id" not in reminder_dict:
            reminder_dict["id"] = str(uuid.uuid4())
        if "user_id" not in reminder_dict:
            reminder_dict["user_id"] = user_id
        if "createdAt" not in reminder_dict:
            from datetime import datetime
            reminder_dict["createdAt"] = datetime.now().isoformat()
        
        reminders = self.data.get("reminders", [])
        reminders.append(reminder_dict)
        self.data["reminders"] = reminders
        save_data(self.data)
        logger.info(f"Reminder added: {reminder_dict['id']}")
        return reminder_dict

    def update_reminder(self, reminder_id: str, updates: dict, user_id: str):
        """Update a reminder by ID (user-scoped)."""
        reminders = self.data.get("reminders", [])
        for i, reminder in enumerate(reminders):
            if reminder.get("id") == reminder_id and reminder.get("user_id") == user_id:
                reminders[i] = {**reminder, **updates}
                self.data["reminders"] = reminders
                save_data(self.data)
                logger.info(f"Reminder updated: {reminder_id}")
                return reminders[i]
        return None

    def delete_reminder(self, reminder_id: str, user_id: str):
        """Delete a reminder by ID (user-scoped)."""
        reminders = self.data.get("reminders", [])
        original_len = len(reminders)
        self.data["reminders"] = [
            r for r in reminders 
            if not (r.get("id") == reminder_id and r.get("user_id") == user_id)
        ]
        if len(self.data["reminders"]) < original_len:
            save_data(self.data)
            logger.info(f"Reminder deleted: {reminder_id}")
            return True
        return False

    # -----------------------------
    # Monthly Focus operations
    # -----------------------------
    def get_monthly_focus(self, month: str, user_id: str):
        """Get monthly focus for a specific month and user (YYYY-MM format, user-scoped)."""
        focuses = self.data.get("monthly_focus", [])
        return next(
            (f for f in focuses if f.get("month") == month and f.get("user_id") == user_id),
            None
        )

    def save_monthly_focus(self, focus_dict: dict, user_id: str):
        """Save or update monthly focus (requires user_id)."""
        if "id" not in focus_dict:
            focus_dict["id"] = str(uuid.uuid4())
        if "user_id" not in focus_dict:
            focus_dict["user_id"] = user_id
        if "createdAt" not in focus_dict:
            from datetime import datetime
            focus_dict["createdAt"] = datetime.now().isoformat()

        focuses = self.data.get("monthly_focus", [])
        existing_idx = next(
            (i for i, f in enumerate(focuses) 
             if f.get("month") == focus_dict.get("month") and f.get("user_id") == user_id),
            None
        )
        
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
