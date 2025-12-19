#!/usr/bin/env python3
import asyncio
import json
import logging
import os
import sys
from datetime import datetime, date, time
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text, select, and_

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.models import (
    User, Category, Task, Checkin, Note, Reminder,
    DiaryEntry, Memory, MonthlyFocus, AuditLog, PendingAction
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

JSON_DATA_PATH = Path(__file__).parent.parent / "app" / "db" / "data.json"

def parse_datetime(dt_str: str) -> datetime:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except:
        try:
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        except:
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")

def parse_date(d_str: str) -> date:
    if not d_str:
        return None
    return date.fromisoformat(d_str)

def parse_time(t_str: str) -> time:
    if not t_str:
        return None
    if ':' in t_str:
        parts = t_str.split(':')
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        return time(hour, minute)
    return None

def safe_uuid(uuid_str: str, generate_new: bool = True) -> UUID:
    """Safely parse UUID, generating new one if invalid."""
    if not uuid_str:
        from uuid import uuid4
        return uuid4() if generate_new else None
    try:
        return UUID(uuid_str)
    except (ValueError, TypeError):
        if generate_new:
            from uuid import uuid4
            return uuid4()
        return None

async def migrate_users(session: AsyncSession, data: dict, dry_run: bool) -> dict:
    logger.info("Migrating users...")
    user_map = {}
    users_data = data.get("users", [])
    
    for user_json in users_data:
        original_id = user_json.get("id", "")
        user_id = safe_uuid(original_id)
        if original_id and str(user_id) != original_id:
            logger.warning(f"  Invalid UUID '{original_id}' for user {user_json.get('email')}, generating new UUID: {user_id}")
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate user: {user_json.get('email')} (ID: {user_id})")
            user_map[user_json["id"]] = user_id
            continue
        
        existing = await session.execute(
            select(User).where(User.id == user_id)
        )
        if existing.scalar_one_or_none():
            logger.info(f"  User {user_id} already exists, skipping")
            user_map[user_json["id"]] = user_id
            continue
        
        user = User(
            id=user_id,
            email=user_json.get("email", "").lower().strip(),
            password_hash=user_json.get("password", ""),
            username=user_json.get("username"),
            avatar_path=user_json.get("avatar_path"),
            email_verified=user_json.get("email_verified", False),
            verification_token=user_json.get("verification_token"),
            verification_token_expires=parse_datetime(user_json.get("verification_token_expires")) if user_json.get("verification_token_expires") else None,
            reset_token=user_json.get("reset_token"),
            reset_token_expires=parse_datetime(user_json.get("reset_token_expires")) if user_json.get("reset_token_expires") else None,
            failed_login_attempts=user_json.get("failed_login_attempts", 0),
            locked_until=parse_datetime(user_json.get("locked_until")) if user_json.get("locked_until") else None,
            refresh_token=user_json.get("refresh_token"),
            refresh_token_expires=parse_datetime(user_json.get("refresh_token_expires")) if user_json.get("refresh_token_expires") else None,
            created_at=parse_datetime(user_json.get("created_at")) if user_json.get("created_at") else datetime.utcnow(),
        )
        session.add(user)
        user_map[user_json["id"]] = user_id
        logger.info(f"  Migrated user: {user_json.get('email')}")
    
    await session.flush()
    logger.info(f"Migrated {len(user_map)} users")
    return user_map

async def migrate_categories(session: AsyncSession, data: dict, user_map: dict, dry_run: bool) -> dict:
    logger.info("Migrating categories...")
    category_map = {}
    categories_data = data.get("categories", [])
    
    for cat_json in categories_data:
        cat_id = safe_uuid(cat_json.get("id", ""))
        
        user_id = None
        if cat_json.get("user_id"):
            user_id = user_map.get(cat_json["user_id"])
            if not user_id:
                logger.warning(f"  Category {cat_json.get('label')} references unknown user_id, skipping")
                continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate category: {cat_json.get('label')}")
            category_map[cat_json.get("id", str(cat_id))] = cat_id
            continue
        
        existing = await session.execute(
            select(Category).where(Category.id == cat_id)
        )
        if existing.scalar_one_or_none():
            category_map[cat_json.get("id", str(cat_id))] = cat_id
            continue
        
        category = Category(
            id=cat_id,
            label=cat_json.get("label", ""),
            color=cat_json.get("color", ""),
            user_id=user_id,
            created_at=parse_datetime(cat_json.get("createdAt")) if cat_json.get("createdAt") else datetime.utcnow(),
        )
        session.add(category)
        category_map[cat_json.get("id", str(cat_id))] = cat_id
    
    await session.flush()
    logger.info(f"Migrated {len(category_map)} categories")
    return category_map

async def migrate_tasks(session: AsyncSession, data: dict, user_map: dict, category_map: dict, dry_run: bool):
    logger.info("Migrating tasks...")
    tasks_data = data.get("tasks", [])
    migrated = 0
    
    for task_json in tasks_data:
        task_id = safe_uuid(task_json.get("id", ""))
        user_id = user_map.get(task_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Task {task_json.get('title')} references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate task: {task_json.get('title')}")
            migrated += 1
            continue
        
        existing = await session.execute(
            select(Task).where(Task.id == task_id)
        )
        if existing.scalar_one_or_none():
            continue
        
        datetime_str = task_json.get("datetime")
        if not datetime_str and task_json.get("date") and task_json.get("time"):
            datetime_str = f"{task_json['date']} {task_json['time']}"
        if not datetime_str:
            logger.warning(f"  Task {task_json.get('title')} has no datetime, skipping")
            continue
        
        task_datetime = parse_datetime(datetime_str)
        if not task_datetime:
            logger.warning(f"  Task {task_json.get('title')} has invalid datetime, skipping")
            continue
        
        category_id = None
        if task_json.get("category_id"):
            category_id = category_map.get(task_json["category_id"])
        
        end_datetime = None
        if task_json.get("end_datetime"):
            end_datetime = parse_datetime(task_json["end_datetime"])
        
        moved_from = None
        if task_json.get("moved_from"):
            moved_from = parse_datetime(task_json["moved_from"])
        elif task_json.get("movedFrom"):
            moved_from = parse_datetime(task_json["movedFrom"])
        
        repeat_config = None
        if task_json.get("repeat_config"):
            repeat_config = task_json["repeat_config"]
        elif task_json.get("repeat"):
            repeat_config = task_json["repeat"]
        
        task = Task(
            id=task_id,
            user_id=user_id,
            type=task_json.get("type", "event"),
            title=task_json.get("title", ""),
            datetime=task_datetime,
            end_datetime=end_datetime,
            duration_minutes=task_json.get("duration_minutes"),
            category_id=category_id,
            category=task_json.get("category"),
            notes=task_json.get("notes"),
            completed=task_json.get("completed", False),
            energy=task_json.get("energy"),
            context=task_json.get("context"),
            created_at=parse_datetime(task_json.get("created_at")) if task_json.get("created_at") else datetime.utcnow(),
            moved_from=moved_from,
            recurring=task_json.get("recurring"),
            repeat_config=repeat_config,
        )
        session.add(task)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} tasks")

async def migrate_checkins(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating checkins...")
    checkins_data = data.get("checkins", [])
    migrated = 0
    
    for checkin_json in checkins_data:
        checkin_id = safe_uuid(checkin_json.get("id", ""))
        
        user_id = user_map.get(checkin_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Checkin for date {checkin_json.get('date')} references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate checkin for date: {checkin_json.get('date')}")
            migrated += 1
            continue
        
        checkin_date = parse_date(checkin_json.get("date"))
        if not checkin_date:
            logger.warning(f"  Checkin has invalid date, skipping")
            continue
        
        existing = await session.execute(
            select(Checkin).where(
                and_(Checkin.user_id == user_id, Checkin.date == checkin_date)
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        completed_ids = [UUID(uid) for uid in checkin_json.get("completedTaskIds", checkin_json.get("completed_task_ids", [])) if uid]
        incomplete_ids = [UUID(uid) for uid in checkin_json.get("incompleteTaskIds", checkin_json.get("incomplete_task_ids", [])) if uid]
        
        checkin = Checkin(
            id=checkin_id,
            user_id=user_id,
            date=checkin_date,
            completed_task_ids=completed_ids,
            incomplete_task_ids=incomplete_ids,
            moved_tasks=checkin_json.get("movedTasks", checkin_json.get("moved_tasks", [])),
            note=checkin_json.get("note"),
            mood=checkin_json.get("mood"),
            timestamp=parse_datetime(checkin_json.get("timestamp")) if checkin_json.get("timestamp") else datetime.utcnow(),
        )
        session.add(checkin)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} checkins")

async def migrate_notes(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating notes...")
    notes_data = data.get("notes", [])
    migrated = 0
    
    for note_json in notes_data:
        note_id = safe_uuid(note_json.get("id", ""))
        
        user_id = user_map.get(note_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Note for date {note_json.get('date')} references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate note for date: {note_json.get('date')}")
            migrated += 1
            continue
        
        note_date = parse_date(note_json.get("date"))
        if not note_date:
            logger.warning(f"  Note has invalid date, skipping")
            continue
        
        existing = await session.execute(
            select(Note).where(
                and_(Note.user_id == user_id, Note.date == note_date)
            )
        )
        if existing.scalar_one_or_none():
            continue
        
        photo = note_json.get("photo")
        photo_filename = None
        photo_uploaded_at = None
        if photo:
            if isinstance(photo, dict):
                photo_filename = photo.get("filename")
                photo_uploaded_at = parse_datetime(photo.get("uploadedAt")) if photo.get("uploadedAt") else None
            elif isinstance(photo, str):
                photo_filename = photo
        
        note = Note(
            id=note_id,
            user_id=user_id,
            date=note_date,
            content=note_json.get("content", ""),
            photo_filename=photo_filename,
            photo_uploaded_at=photo_uploaded_at,
            created_at=parse_datetime(note_json.get("createdAt")) if note_json.get("createdAt") else datetime.utcnow(),
            updated_at=parse_datetime(note_json.get("updatedAt")) if note_json.get("updatedAt") else datetime.utcnow(),
        )
        session.add(note)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} notes")

async def migrate_reminders(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating reminders...")
    reminders_data = data.get("reminders", [])
    migrated = 0
    
    for rem_json in reminders_data:
        rem_id = safe_uuid(rem_json.get("id", ""))
        
        user_id = user_map.get(rem_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Reminder {rem_json.get('title')} references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate reminder: {rem_json.get('title')}")
            migrated += 1
            continue
        
        reminder = Reminder(
            id=rem_id,
            user_id=user_id,
            title=rem_json.get("title", ""),
            description=rem_json.get("description"),
            due_date=parse_date(rem_json.get("dueDate", rem_json.get("due_date"))) if rem_json.get("dueDate") or rem_json.get("due_date") else None,
            time=parse_time(rem_json.get("time")) if rem_json.get("time") else None,
            type=rem_json.get("type"),
            recurring=rem_json.get("recurring"),
            visible=rem_json.get("visible", True),
            note=rem_json.get("note"),
            created_at=parse_datetime(rem_json.get("createdAt")) if rem_json.get("createdAt") else datetime.utcnow(),
            updated_at=parse_datetime(rem_json.get("updatedAt")) if rem_json.get("updatedAt") else datetime.utcnow(),
        )
        session.add(reminder)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} reminders")

async def migrate_diary_entries(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating diary entries...")
    diary_data = data.get("diary", [])
    migrated = 0
    
    for diary_json in diary_data:
        diary_id = safe_uuid(diary_json.get("id", ""))
        
        user_id = user_map.get(diary_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Diary entry references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate diary entry")
            migrated += 1
            continue
        
        diary = DiaryEntry(
            id=diary_id,
            user_id=user_id,
            text=diary_json.get("text", ""),
            category=diary_json.get("category"),
            created_at=parse_datetime(diary_json.get("created_at")) if diary_json.get("created_at") else datetime.utcnow(),
        )
        session.add(diary)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} diary entries")

async def migrate_memories(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating memories...")
    memories_data = data.get("memories", [])
    migrated = 0
    
    for mem_json in memories_data:
        mem_id = safe_uuid(mem_json.get("id", ""))
        
        user_id = user_map.get(mem_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Memory references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate memory")
            migrated += 1
            continue
        
        memory = Memory(
            id=mem_id,
            user_id=user_id,
            text=mem_json.get("text", ""),
            category=mem_json.get("category"),
            created_at=parse_datetime(mem_json.get("created_at")) if mem_json.get("created_at") else datetime.utcnow(),
            updated_at=parse_datetime(mem_json.get("updated_at")) if mem_json.get("updated_at") else datetime.utcnow(),
        )
        session.add(memory)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} memories")

async def migrate_monthly_focus(session: AsyncSession, data: dict, user_map: dict, dry_run: bool):
    logger.info("Migrating monthly focus...")
    focus_data = data.get("monthly_focus", [])
    migrated = 0
    
    for focus_json in focus_data:
        focus_id = safe_uuid(focus_json.get("id", ""))
        
        user_id = user_map.get(focus_json.get("user_id"))
        if not user_id:
            logger.warning(f"  Monthly focus references unknown user_id, skipping")
            continue
        
        if dry_run:
            logger.info(f"  [DRY RUN] Would migrate monthly focus for month: {focus_json.get('month')}")
            migrated += 1
            continue
        
        focus = MonthlyFocus(
            id=focus_id,
            user_id=user_id,
            month=focus_json.get("month", ""),
            title=focus_json.get("title", ""),
            description=focus_json.get("description"),
            progress=focus_json.get("progress"),
            created_at=parse_datetime(focus_json.get("createdAt")) if focus_json.get("createdAt") else datetime.utcnow(),
            updated_at=parse_datetime(focus_json.get("updatedAt")) if focus_json.get("updatedAt") else datetime.utcnow(),
        )
        session.add(focus)
        migrated += 1
    
    await session.flush()
    logger.info(f"Migrated {migrated} monthly focus entries")

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Migrate JSON data to PostgreSQL")
    parser.add_argument("--dry-run", action="store_true", help="Perform a dry run without committing")
    parser.add_argument("--data-file", type=str, help="Path to JSON data file", default=str(JSON_DATA_PATH))
    args = parser.parse_args()
    
    if not Path(args.data_file).exists():
        logger.error(f"Data file not found: {args.data_file}")
        sys.exit(1)
    
    logger.info(f"Loading data from {args.data_file}")
    with open(args.data_file, "r") as f:
        data = json.load(f)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            async with session.begin():
                user_map = await migrate_users(session, data, args.dry_run)
                category_map = await migrate_categories(session, data, user_map, args.dry_run)
                await migrate_tasks(session, data, user_map, category_map, args.dry_run)
                await migrate_checkins(session, data, user_map, args.dry_run)
                await migrate_notes(session, data, user_map, args.dry_run)
                await migrate_reminders(session, data, user_map, args.dry_run)
                await migrate_diary_entries(session, data, user_map, args.dry_run)
                await migrate_memories(session, data, user_map, args.dry_run)
                await migrate_monthly_focus(session, data, user_map, args.dry_run)
                
                if args.dry_run:
                    logger.info("DRY RUN: Rolling back transaction")
                    await session.rollback()
                else:
                    logger.info("Migration completed successfully")
        except Exception as e:
            logger.error(f"Migration failed: {e}", exc_info=True)
            await session.rollback()
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())

