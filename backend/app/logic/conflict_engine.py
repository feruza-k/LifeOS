# app/logic/conflict_engine.py

from datetime import timedelta, datetime
from typing import List, Dict, Optional
import pytz

from app.logic.task_engine import parse_datetime, get_all_tasks

tz = pytz.timezone("Europe/London")

def _parse_end_datetime(task, start_dt: datetime) -> datetime:
    """
    Determine the end datetime for a task.

    Priority:
    1. If end_datetime is set, use it
    2. Else if duration_minutes is set, add that to start
    3. Else use sensible defaults:
       - events: 60 minutes
       - reminders: 15 minutes
    """
    end_str = task.get("end_datetime")
    if end_str:
        try:
            if isinstance(end_str, str):
                # Handle ISO format (with T) or space-separated format
                if "T" in end_str:
                    # ISO format: "2025-12-21T20:00:00" or "2025-12-21T20:00:00.000Z"
                    date_part = end_str.split("T")[0]
                    time_part = end_str.split("T")[1]
                    # Remove timezone and microseconds
                    time_part = time_part.split("+")[0].split("Z")[0]
                    if "." in time_part:
                        time_part = time_part.split(".")[0]
                    # Take only HH:MM (first 5 chars of time part)
                    if ":" in time_part:
                        time_parts = time_part.split(":")
                        time_part = f"{time_parts[0]}:{time_parts[1]}"
                    end_str = f"{date_part} {time_part}"
                
                parsed = tz.localize(datetime.strptime(end_str, "%Y-%m-%d %H:%M"))
                return parsed
            return end_str
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to parse end_datetime '{end_str}' for task '{task.get('title', 'Unknown')}': {e}")

    duration = task.get("duration_minutes")
    if duration is not None:
        calculated = start_dt + timedelta(minutes=duration)
        return calculated

    # Default durations
    default_duration = 60 if task.get("type") == "event" else 15
    default_end = start_dt + timedelta(minutes=default_duration)
    return default_end

async def get_scheduled_blocks(
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
    user_id: str = None
) -> List[Dict]:
    """
    Build a list of scheduled time blocks for tasks that have a datetime.
    """
    tasks = await get_all_tasks(user_id)
    blocks = []

    start_date = (
        datetime.strptime(start_date_str, "%Y-%m-%d").date()
        if start_date_str else None
    )
    end_date = (
        datetime.strptime(end_date_str, "%Y-%m-%d").date()
        if end_date_str else None
    )

    for t in tasks:
        # Skip tasks without a time (anytime tasks) - they don't conflict with scheduled tasks
        # Anytime tasks have time=None or time="00:00" (legacy)
        task_time = t.get("time")
        if not task_time or task_time == "00:00":
            continue
        
        start_dt = parse_datetime(t)
        if not start_dt:
            continue

        task_date = start_dt.date()

        # Filter by optional date range
        if start_date and task_date < start_date:
            continue
        if end_date and task_date > end_date:
            continue

        end_dt = _parse_end_datetime(t, start_dt)

        blocks.append(
            {
                "task": t,
                "start": start_dt,
                "end": end_dt,
            }
        )

    blocks.sort(key=lambda b: b["start"])
    return blocks

async def find_conflicts(
    start: Optional[str] = None,
    end: Optional[str] = None,
    user_id: str = None
) -> List[Dict]:
    """
    Find conflicts between scheduled tasks *on the same date*.
    """
    blocks = await get_scheduled_blocks(start, end, user_id)
    conflicts = []

    for i in range(len(blocks) - 1):
        a = blocks[i]
        b = blocks[i + 1]

        # -----------------------------------------------------
        # NEW RULE: Must be SAME DATE to count as conflict
        # -----------------------------------------------------
        if a["start"].date() != b["start"].date():
            continue

        # Overlap detection
        if b["start"] < a["end"]:
            overlap_start = max(a["start"], b["start"])
            overlap_end = min(a["end"], b["end"])

            conflicts.append(
                {
                    "task_a": a["task"],
                    "task_b": b["task"],
                    "overlap_start": overlap_start.strftime("%Y-%m-%d %H:%M"),
                    "overlap_end": overlap_end.strftime("%Y-%m-%d %H:%M"),
                }
            )

    return conflicts

async def check_conflict_for_time(
    date: str,
    time: str,
    duration_minutes: int = 60,
    user_id: str = None,
    exclude_task_id: str = None
) -> List[Dict]:
    """
    Check if a specific time slot conflicts with existing tasks.
    
    Args:
        date: Date string (YYYY-MM-DD)
        time: Time string (HH:MM)
        duration_minutes: Duration of the new task in minutes
        user_id: User ID to check conflicts for
        exclude_task_id: Task ID to exclude from conflict check (for updates)
    
    Returns:
        List of conflicting tasks, empty if no conflicts
    """
    from datetime import datetime, timedelta
    import logging
    logger = logging.getLogger(__name__)
    
    # Parse the proposed start time
    try:
        start_dt = tz.localize(datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M"))
    except Exception as e:
        logger.warning(f"Failed to parse datetime '{date} {time}': {e}")
        return []
    
    # Calculate end time
    end_dt = start_dt + timedelta(minutes=duration_minutes)

    # Get all scheduled blocks for this date
    blocks = await get_scheduled_blocks(start_date_str=date, end_date_str=date, user_id=user_id)
    
    conflicts = []
    for block in blocks:
        # Skip the task we're updating
        if exclude_task_id and block["task"].get("id") == exclude_task_id:
            continue
        
        block_start = block["start"]
        block_end = block["end"]
        
        # Check for overlap
        # Two intervals overlap if: start1 < end2 AND start2 < end1
        if start_dt < block_end and block_start < end_dt:
            conflicts.append(block["task"])
    
    return conflicts

async def suggest_resolution(
    date: str,
    preferred_time: str,
    duration_minutes: int = 60,
    user_id: str = None
) -> Dict:
    """
    Suggest an alternative time slot when a conflict is detected.
    
    Returns:
        Dict with suggested_time (HH:MM) or None if no slot found
    """
    from datetime import datetime, timedelta
    
    # Parse preferred time
    try:
        preferred_dt = tz.localize(datetime.strptime(f"{date} {preferred_time}", "%Y-%m-%d %H:%M"))
    except Exception:
        return {"suggested_time": None}
    
    # Get all scheduled blocks for this date
    blocks = await get_scheduled_blocks(start_date_str=date, end_date_str=date, user_id=user_id)
    
    # Sort blocks by start time
    blocks.sort(key=lambda b: b["start"])
    
    # Try to find a free slot
    # Start from preferred time, then try 30-minute increments forward
    current_time = preferred_dt
    max_attempts = 48  # 24 hours * 2 (30-minute increments)
    
    for _ in range(max_attempts):
        candidate_start = current_time
        candidate_end = current_time + timedelta(minutes=duration_minutes)
        
        # Check if this slot overlaps with any existing task
        has_conflict = False
        for block in blocks:
            if candidate_start < block["end"] and block["start"] < candidate_end:
                has_conflict = True
                break
        
        if not has_conflict:
            return {
                "suggested_time": current_time.strftime("%H:%M"),
                "suggested_datetime": current_time.strftime("%Y-%m-%d %H:%M")
            }
        
        # Move forward 30 minutes
        current_time += timedelta(minutes=30)
        
        # Don't go past midnight
        if current_time.date() > preferred_dt.date():
            break
    
    return {"suggested_time": None}
