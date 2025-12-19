from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from db.session import AsyncSessionLocal
from db.repositories.task import TaskRepository
from db.repositories.note import NoteRepository
from db.repositories.checkin import CheckinRepository
from db.repositories.memory import MemoryRepository
from db.models import (
    User, Category, Task, Note, Checkin, Reminder,
    DiaryEntry, Memory, MonthlyFocus, AuditLog, PendingAction
)

class DatabaseRepo:
    """Database repository adapter - provides similar interface to old JSON repo."""
    
    async def _get_session(self) -> AsyncSession:
        return AsyncSessionLocal()
    
    def _user_to_dict(self, user: User) -> Dict:
        """Convert User model to dict format."""
        return {
            "id": str(user.id),
            "email": user.email,
            "password": user.password_hash,
            "username": user.username,
            "avatar_path": user.avatar_path,
            "email_verified": user.email_verified,
            "verification_token": user.verification_token,
            "verification_token_expires": user.verification_token_expires.isoformat() if user.verification_token_expires else None,
            "reset_token": user.reset_token,
            "reset_token_expires": user.reset_token_expires.isoformat() if user.reset_token_expires else None,
            "failed_login_attempts": user.failed_login_attempts,
            "locked_until": user.locked_until.isoformat() if user.locked_until else None,
            "refresh_token": user.refresh_token,
            "refresh_token_expires": user.refresh_token_expires.isoformat() if user.refresh_token_expires else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    
    def _task_to_dict(self, task: Task) -> Dict:
        """Convert Task model to dict format."""
        return {
            "id": str(task.id),
            "user_id": str(task.user_id),
            "type": task.type,
            "title": task.title,
            "datetime": task.datetime.isoformat() if task.datetime else None,
            "date": task.date.isoformat() if task.date else None,
            "time": task.datetime.strftime("%H:%M") if task.datetime else None,
            "end_datetime": task.end_datetime.isoformat() if task.end_datetime else None,
            "duration_minutes": task.duration_minutes,
            "category_id": str(task.category_id) if task.category_id else None,
            "category": task.category,
            "notes": task.notes,
            "completed": task.completed,
            "energy": task.energy,
            "context": task.context,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "updated_at": task.updated_at.isoformat() if task.updated_at else None,
            "moved_from": task.moved_from.isoformat() if task.moved_from else None,
            "recurring": task.recurring,
            "repeat_config": task.repeat_config,
        }
    
    def _note_to_dict(self, note: Note) -> Dict:
        """Convert Note model to dict format."""
        photo = None
        if note.photo_filename:
            photo = {
                "filename": note.photo_filename,
                "uploadedAt": note.photo_uploaded_at.isoformat() if note.photo_uploaded_at else None
            }
        return {
            "id": str(note.id),
            "user_id": str(note.user_id),
            "date": note.date.isoformat() if note.date else None,
            "content": note.content,
            "photo": photo,
            "createdAt": note.created_at.isoformat() if note.created_at else None,
            "updatedAt": note.updated_at.isoformat() if note.updated_at else None,
        }
    
    def _checkin_to_dict(self, checkin: Checkin) -> Dict:
        """Convert Checkin model to dict format."""
        return {
            "id": str(checkin.id),
            "user_id": str(checkin.user_id),
            "date": checkin.date.isoformat() if checkin.date else None,
            "completedTaskIds": [str(uid) for uid in checkin.completed_task_ids] if checkin.completed_task_ids else [],
            "incompleteTaskIds": [str(uid) for uid in checkin.incomplete_task_ids] if checkin.incomplete_task_ids else [],
            "movedTasks": checkin.moved_tasks if checkin.moved_tasks else [],
            "note": checkin.note,
            "mood": checkin.mood,
            "timestamp": checkin.timestamp.isoformat() if checkin.timestamp else None,
        }
    
    async def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email address (case-insensitive)."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.email == email.lower().strip())
            )
            user = result.scalar_one_or_none()
            if user:
                return self._user_to_dict(user)
            return None
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by ID."""
        async with AsyncSessionLocal() as session:
            user = await session.get(User, UUID(user_id))
            if user:
                return self._user_to_dict(user)
            return None
    
    async def create_user(self, email: str, hashed_password: str, username: str = None, verification_token: str = None) -> Dict:
        """Create a new user."""
        async with AsyncSessionLocal() as session:
            user = User(
                email=email.lower().strip(),
                password_hash=hashed_password,
                username=username or email.split("@")[0],
                email_verified=False,
                verification_token=verification_token,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return self._user_to_dict(user)
    
    async def update_user(self, user_id: str, updates: dict) -> Optional[Dict]:
        """Update user fields."""
        async with AsyncSessionLocal() as session:
            user = await session.get(User, UUID(user_id))
            if not user:
                return None
            
            # Fields that should be converted from ISO strings to datetime
            datetime_fields = {
                "verification_token_expires",
                "reset_token_expires",
                "locked_until",
                "refresh_token_expires",
                "created_at",
                "updated_at",
            }
            
            for key, value in updates.items():
                if hasattr(user, key):
                    # Convert ISO string to datetime for timestamp fields
                    if key in datetime_fields and value is not None:
                        if isinstance(value, str):
                            try:
                                # Handle timezone-aware strings (Z or +00:00)
                                if value.endswith('Z'):
                                    value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                                else:
                                    value = datetime.fromisoformat(value)
                            except (ValueError, AttributeError):
                                pass  # If parsing fails, use value as-is
                        # If value is already a datetime, use it as-is
                    setattr(user, key, value)
            
            await session.commit()
            await session.refresh(user)
            return self._user_to_dict(user)
    
    async def get_user_by_verification_token(self, token: str) -> Optional[Dict]:
        """Get user by verification token."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.verification_token == token)
            )
            user = result.scalar_one_or_none()
            if user:
                if user.verification_token_expires and user.verification_token_expires < datetime.utcnow():
                    return None
                return self._user_to_dict(user)
            return None
    
    async def get_user_by_reset_token(self, token: str) -> Optional[Dict]:
        """Get user by password reset token."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.reset_token == token)
            )
            user = result.scalar_one_or_none()
            if user:
                if user.reset_token_expires and user.reset_token_expires < datetime.utcnow():
                    return None
                return self._user_to_dict(user)
            return None
    
    async def get_tasks_by_user(self, user_id: str) -> List[Dict]:
        """Get all tasks for a user."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            tasks = await repo.list_by_user(UUID(user_id))
            return [self._task_to_dict(t) for t in tasks]
    
    async def get_tasks_by_date_and_user(self, date_str: str, user_id: str) -> List[Dict]:
        """Get tasks for a specific date and user."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            task_date = date.fromisoformat(date_str)
            tasks = await repo.get_by_user_and_date(UUID(user_id), task_date)
            return [self._task_to_dict(t) for t in tasks]
    
    async def get_task(self, task_id: str, user_id: str) -> Optional[Dict]:
        """Get a task by ID (user-scoped)."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            task = await repo.get_by_id(UUID(task_id), UUID(user_id))
            if task:
                return self._task_to_dict(task)
            return None
    
    async def add_task_dict(self, task_dict: dict) -> Dict:
        """Add a task from a dictionary."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            
            datetime_str = task_dict.get("datetime")
            if not datetime_str and task_dict.get("date") and task_dict.get("time"):
                datetime_str = f"{task_dict['date']} {task_dict['time']}"
            
            if not datetime_str:
                raise ValueError("Task must have datetime")
            
            task_datetime = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            
            task_data = {
                "user_id": UUID(task_dict["user_id"]),
                "type": task_dict.get("type", "event"),
                "title": task_dict.get("title", ""),
                "datetime": task_datetime,
                "end_datetime": datetime.fromisoformat(task_dict["end_datetime"].replace('Z', '+00:00')) if task_dict.get("end_datetime") else None,
                "duration_minutes": task_dict.get("duration_minutes"),
                "category_id": UUID(task_dict["category_id"]) if task_dict.get("category_id") else None,
                "category": task_dict.get("category"),
                "notes": task_dict.get("notes"),
                "completed": task_dict.get("completed", False),
                "energy": task_dict.get("energy"),
                "context": task_dict.get("context"),
                "moved_from": datetime.fromisoformat(task_dict["moved_from"].replace('Z', '+00:00')) if task_dict.get("moved_from") else None,
                "recurring": task_dict.get("recurring"),
                "repeat_config": task_dict.get("repeat_config"),
            }
            
            task = await repo.create(**task_data)
            await session.commit()
            await session.refresh(task)
            return self._task_to_dict(task)
    
    async def update_task(self, task_id: str, updates: dict, user_id: str) -> Optional[Dict]:
        """Update a task by ID (user-scoped)."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            
            db_updates = {}
            
            # Handle datetime updates - can come as "datetime" or as "date" + "time"
            if "datetime" in updates:
                if isinstance(updates["datetime"], str):
                    db_updates["datetime"] = datetime.fromisoformat(updates["datetime"].replace('Z', '+00:00'))
                else:
                    db_updates["datetime"] = updates["datetime"]
            elif "date" in updates and "time" in updates:
                datetime_str = f"{updates['date']} {updates['time']}"
                db_updates["datetime"] = datetime.fromisoformat(datetime_str)
            elif "date" in updates:
                # If only date is provided, use existing time or default to start of day
                existing_task = await repo.get_by_id(UUID(task_id), UUID(user_id))
                if existing_task:
                    existing_datetime = existing_task.datetime
                    if existing_datetime:
                        new_datetime = datetime.combine(date.fromisoformat(updates["date"]), existing_datetime.time())
                        db_updates["datetime"] = new_datetime
                    else:
                        db_updates["datetime"] = datetime.combine(date.fromisoformat(updates["date"]), datetime.min.time())
            
            if "end_datetime" in updates and updates["end_datetime"]:
                db_updates["end_datetime"] = datetime.fromisoformat(updates["end_datetime"].replace('Z', '+00:00'))
            elif "endTime" in updates and updates.get("date") and updates.get("time"):
                end_datetime_str = f"{updates['date']} {updates['endTime']}"
                db_updates["end_datetime"] = datetime.fromisoformat(end_datetime_str)
            
            if "moved_from" in updates and updates["moved_from"]:
                if isinstance(updates["moved_from"], str):
                    db_updates["moved_from"] = datetime.fromisoformat(updates["moved_from"].replace('Z', '+00:00'))
                else:
                    db_updates["moved_from"] = updates["moved_from"]
            elif "movedFrom" in updates and updates["movedFrom"]:
                if isinstance(updates["movedFrom"], str):
                    db_updates["moved_from"] = datetime.fromisoformat(updates["movedFrom"].replace('Z', '+00:00'))
                else:
                    db_updates["moved_from"] = updates["movedFrom"]
            
            if "category_id" in updates and updates["category_id"]:
                db_updates["category_id"] = UUID(updates["category_id"])
            
            for key in ["title", "duration_minutes", "category", "notes", "completed", "energy", "context", "recurring", "repeat_config"]:
                if key in updates:
                    db_updates[key] = updates[key]
            
            task = await repo.update(UUID(task_id), UUID(user_id), **db_updates)
            if task:
                await session.commit()
                await session.refresh(task)
                return self._task_to_dict(task)
            return None
    
    async def delete_task(self, task_id: str, user_id: str) -> bool:
        """Delete a task by ID (user-scoped)."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            success = await repo.delete(UUID(task_id), UUID(user_id))
            if success:
                await session.commit()
            return success
    
    async def toggle_task_complete(self, task_id: str, user_id: str) -> Optional[Dict]:
        """Toggle a task's completed status."""
        async with AsyncSessionLocal() as session:
            repo = TaskRepository(session)
            task = await repo.get_by_id(UUID(task_id), UUID(user_id))
            if task:
                task.completed = not task.completed
                await session.commit()
                await session.refresh(task)
                return self._task_to_dict(task)
            return None
    
    async def get_note(self, date_str: str, user_id: str) -> Optional[Dict]:
        """Get note for a specific date (user-scoped)."""
        async with AsyncSessionLocal() as session:
            repo = NoteRepository(session)
            note_date = date.fromisoformat(date_str)
            note = await repo.get_by_user_and_date(UUID(user_id), note_date)
            if note:
                return self._note_to_dict(note)
            return None
    
    async def save_note(self, note_dict: dict, user_id: str) -> Dict:
        """Save or update a note (requires user_id)."""
        async with AsyncSessionLocal() as session:
            repo = NoteRepository(session)
            note_date = date.fromisoformat(note_dict.get("date"))
            
            existing = await repo.get_by_user_and_date(UUID(user_id), note_date)
            
            photo_filename = None
            photo_uploaded_at = None
            if note_dict.get("photo"):
                if isinstance(note_dict["photo"], dict):
                    photo_filename = note_dict["photo"].get("filename")
                    if note_dict["photo"].get("uploadedAt"):
                        photo_uploaded_at = datetime.fromisoformat(note_dict["photo"]["uploadedAt"].replace('Z', '+00:00'))
                elif isinstance(note_dict["photo"], str):
                    photo_filename = note_dict["photo"]
            
            note_data = {
                "user_id": UUID(user_id),
                "date": note_date,
                "content": note_dict.get("content", ""),
                "photo_filename": photo_filename,
                "photo_uploaded_at": photo_uploaded_at,
            }
            
            if existing:
                note = await repo.update(existing.id, UUID(user_id), **note_data)
            else:
                note = await repo.create(**note_data)
            
            await session.commit()
            await session.refresh(note)
            return self._note_to_dict(note)
    
    async def get_checkin(self, date_str: str, user_id: str) -> Optional[Dict]:
        """Get check-in for a specific date (user-scoped)."""
        async with AsyncSessionLocal() as session:
            repo = CheckinRepository(session)
            checkin_date = date.fromisoformat(date_str)
            checkin = await repo.get_by_user_and_date(UUID(user_id), checkin_date)
            if checkin:
                return self._checkin_to_dict(checkin)
            return None
    
    async def save_checkin(self, checkin_dict: dict, user_id: str) -> Dict:
        """Save or update a check-in."""
        async with AsyncSessionLocal() as session:
            repo = CheckinRepository(session)
            checkin_date = date.fromisoformat(checkin_dict.get("date"))
            
            existing = await repo.get_by_user_and_date(UUID(user_id), checkin_date)
            
            completed_ids = [UUID(uid) for uid in checkin_dict.get("completedTaskIds", []) if uid]
            incomplete_ids = [UUID(uid) for uid in checkin_dict.get("incompleteTaskIds", []) if uid]
            
            checkin_data = {
                "user_id": UUID(user_id),
                "date": checkin_date,
                "completed_task_ids": completed_ids,
                "incomplete_task_ids": incomplete_ids,
                "moved_tasks": checkin_dict.get("movedTasks", checkin_dict.get("moved_tasks", [])),
                "note": checkin_dict.get("note"),
                "mood": checkin_dict.get("mood"),
            }
            
            if existing:
                checkin = await repo.update(existing.id, UUID(user_id), **checkin_data)
            else:
                checkin = await repo.create(**checkin_data)
            
            await session.commit()
            await session.refresh(checkin)
            return self._checkin_to_dict(checkin)
    
    async def get_reminders(self, user_id: str) -> List[Dict]:
        """Get all reminders for a user."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Reminder).where(Reminder.user_id == UUID(user_id))
            )
            reminders = result.scalars().all()
            return [{
                "id": str(r.id),
                "user_id": str(r.user_id),
                "title": r.title,
                "description": r.description,
                "dueDate": r.due_date.isoformat() if r.due_date else None,
                "time": r.time.strftime("%H:%M") if r.time else None,
                "type": r.type,
                "recurring": r.recurring,
                "visible": r.visible,
                "note": r.note,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
                "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
            } for r in reminders]
    
    async def add_reminder(self, reminder_dict: dict, user_id: str) -> Dict:
        """Add a reminder."""
        async with AsyncSessionLocal() as session:
            reminder = Reminder(
                user_id=UUID(user_id),
                title=reminder_dict.get("title", ""),
                description=reminder_dict.get("description"),
                due_date=date.fromisoformat(reminder_dict["dueDate"]) if reminder_dict.get("dueDate") else None,
                time=datetime.strptime(reminder_dict["time"], "%H:%M").time() if reminder_dict.get("time") else None,
                type=reminder_dict.get("type"),
                recurring=reminder_dict.get("recurring"),
                visible=reminder_dict.get("visible", True),
                note=reminder_dict.get("note"),
            )
            session.add(reminder)
            await session.commit()
            await session.refresh(reminder)
            return {
                "id": str(reminder.id),
                "user_id": str(reminder.user_id),
                "title": reminder.title,
                "description": reminder.description,
                "dueDate": reminder.due_date.isoformat() if reminder.due_date else None,
                "time": reminder.time.strftime("%H:%M") if reminder.time else None,
                "type": reminder.type,
                "recurring": reminder.recurring,
                "visible": reminder.visible,
                "note": reminder.note,
                "createdAt": reminder.created_at.isoformat() if reminder.created_at else None,
            }
    
    async def update_reminder(self, reminder_id: str, updates: dict, user_id: str) -> Optional[Dict]:
        """Update a reminder."""
        async with AsyncSessionLocal() as session:
            reminder = await session.get(Reminder, UUID(reminder_id))
            if not reminder or str(reminder.user_id) != user_id:
                return None
            
            for key, value in updates.items():
                if hasattr(reminder, key):
                    if key == "dueDate":
                        setattr(reminder, "due_date", date.fromisoformat(value) if value else None)
                    elif key == "time" and value:
                        setattr(reminder, "time", datetime.strptime(value, "%H:%M").time())
                    else:
                        setattr(reminder, key, value)
            
            await session.commit()
            await session.refresh(reminder)
            return {
                "id": str(reminder.id),
                "user_id": str(reminder.user_id),
                "title": reminder.title,
                "description": reminder.description,
                "dueDate": reminder.due_date.isoformat() if reminder.due_date else None,
                "time": reminder.time.strftime("%H:%M") if reminder.time else None,
                "type": reminder.type,
                "recurring": reminder.recurring,
                "visible": reminder.visible,
                "note": reminder.note,
                "createdAt": reminder.created_at.isoformat() if reminder.created_at else None,
            }
    
    async def delete_reminder(self, reminder_id: str, user_id: str) -> bool:
        """Delete a reminder."""
        async with AsyncSessionLocal() as session:
            reminder = await session.get(Reminder, UUID(reminder_id))
            if not reminder or str(reminder.user_id) != user_id:
                return False
            await session.delete(reminder)
            await session.commit()
            return True
    
    async def get_monthly_focus(self, month: str, user_id: str) -> Optional[Dict]:
        """Get monthly focus for a specific month."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(MonthlyFocus).where(
                    and_(MonthlyFocus.user_id == UUID(user_id), MonthlyFocus.month == month)
                )
            )
            focus = result.scalar_one_or_none()
            if focus:
                return {
                    "id": str(focus.id),
                    "user_id": str(focus.user_id),
                    "month": focus.month,
                    "title": focus.title,
                    "description": focus.description,
                    "progress": focus.progress,
                    "createdAt": focus.created_at.isoformat() if focus.created_at else None,
                }
            return None
    
    async def save_monthly_focus(self, focus_dict: dict, user_id: str) -> Dict:
        """Save or update monthly focus."""
        async with AsyncSessionLocal() as session:
            existing = await session.execute(
                select(MonthlyFocus).where(
                    and_(MonthlyFocus.user_id == UUID(user_id), MonthlyFocus.month == focus_dict.get("month"))
                )
            )
            focus = existing.scalar_one_or_none()
            
            focus_data = {
                "user_id": UUID(user_id),
                "month": focus_dict.get("month", ""),
                "title": focus_dict.get("title", ""),
                "description": focus_dict.get("description"),
                "progress": focus_dict.get("progress"),
            }
            
            if focus:
                for key, value in focus_data.items():
                    setattr(focus, key, value)
            else:
                focus = MonthlyFocus(**focus_data)
                session.add(focus)
            
            await session.commit()
            await session.refresh(focus)
            return {
                "id": str(focus.id),
                "user_id": str(focus.user_id),
                "month": focus.month,
                "title": focus.title,
                "description": focus.description,
                "progress": focus.progress,
                "createdAt": focus.created_at.isoformat() if focus.created_at else None,
            }
    
    async def get_categories(self, user_id: Optional[str] = None) -> List[Dict]:
        """Get categories: global (user_id IS NULL) + user-specific if user_id provided."""
        async with AsyncSessionLocal() as session:
            if user_id:
                # Return global categories (user_id IS NULL) + user's specific categories
                result = await session.execute(
                    select(Category).where(
                        or_(
                            Category.user_id.is_(None),
                            Category.user_id == UUID(user_id)
                        )
                    ).order_by(Category.user_id, Category.label)
                )
            else:
                # If no user_id, return only global categories
                result = await session.execute(
                    select(Category).where(Category.user_id.is_(None)).order_by(Category.label)
                )
            categories = result.scalars().all()
            
            # Convert to dict and deduplicate by (user_id, label) to avoid duplicates
            seen = set()
            unique_categories = []
            for c in categories:
                # Use (user_id, label) as unique key to prevent duplicates
                key = (str(c.user_id) if c.user_id else None, c.label.lower())
                if key not in seen:
                    seen.add(key)
                    unique_categories.append({
                        "id": str(c.id),
                        "label": c.label,
                        "color": c.color,
                        "user_id": str(c.user_id) if c.user_id else None,
                    })
            
            return unique_categories
    
    async def get_category(self, category_id: str) -> Optional[Dict]:
        """Get a category by ID."""
        async with AsyncSessionLocal() as session:
            category = await session.get(Category, UUID(category_id))
            if category:
                return {
                    "id": str(category.id),
                    "label": category.label,
                    "color": category.color,
                    "user_id": str(category.user_id) if category.user_id else None,
                }
            return None
    
    async def add_category(self, category_dict: dict) -> Dict:
        """Add a new category."""
        async with AsyncSessionLocal() as session:
            category = Category(
                label=category_dict.get("label", ""),
                color=category_dict.get("color", ""),
                user_id=UUID(category_dict["user_id"]) if category_dict.get("user_id") else None,
            )
            session.add(category)
            await session.commit()
            await session.refresh(category)
            return {
                "id": str(category.id),
                "label": category.label,
                "color": category.color,
                "user_id": str(category.user_id) if category.user_id else None,
            }
    
    async def update_category(self, category_id: str, updates: dict) -> Optional[Dict]:
        """Update a category."""
        async with AsyncSessionLocal() as session:
            category = await session.get(Category, UUID(category_id))
            if not category:
                return None
            
            for key, value in updates.items():
                if hasattr(category, key):
                    if key == "user_id" and value:
                        setattr(category, key, UUID(value))
                    else:
                        setattr(category, key, value)
            
            await session.commit()
            await session.refresh(category)
            return {
                "id": str(category.id),
                "label": category.label,
                "color": category.color,
                "user_id": str(category.user_id) if category.user_id else None,
            }
    
    async def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        async with AsyncSessionLocal() as session:
            category = await session.get(Category, UUID(category_id))
            if not category:
                return False
            await session.delete(category)
            await session.commit()
            return True

db_repo = DatabaseRepo()

