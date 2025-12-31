# app/ai/intelligent_assistant.py
# Conversational, context-aware assistant with natural responses

import os
import json
from datetime import datetime, timedelta
import pytz
from typing import List, Dict, Optional, Any
from openai import OpenAI
from dotenv import load_dotenv

from app.logic.conflict_engine import find_conflicts
from db.repo import db_repo
from db.session import AsyncSessionLocal
from app.logging import logger

load_dotenv()
tz = pytz.timezone("Europe/London")

def get_client():
    """Lazy initialization of OpenAI client."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)


def build_system_prompt(user_context: Dict[str, Any]) -> str:
    """
    Build the system prompt with SolAI's personality and user context.
    """
    today = datetime.now(tz)
    today_str = today.strftime("%Y-%m-%d")
    current_time = today.strftime("%H:%M")
    
    # Build context summary
    tasks_today = user_context.get("tasks_today", [])
    upcoming_tasks = user_context.get("upcoming_tasks", [])
    conflicts = user_context.get("conflicts", [])
    energy = user_context.get("energy", {})
    categories = user_context.get("categories", [])
    
    # Format tasks for context
    today_tasks_summary = []
    if tasks_today:
        for task in tasks_today[:10]:  # Limit to 10 most relevant
            if task.get("time"):
                today_tasks_summary.append(f"- {task['title']} at {task['time']}")
            else:
                today_tasks_summary.append(f"- {task['title']} (anytime)")
    
    upcoming_summary = []
    if upcoming_tasks:
        for task in upcoming_tasks[:5]:
            date_str = task.get("date", "unknown")
            time_str = f" at {task['time']}" if task.get("time") else ""
            upcoming_summary.append(f"- {task['title']} on {date_str}{time_str}")
    
    conflicts_summary = []
    if conflicts:
        for conflict in conflicts[:3]:
            # Handle both old format (task_a/task_b) and new format
            if isinstance(conflict, dict):
                task_a = conflict.get("task_a", {})
                task_b = conflict.get("task_b", {})
                if isinstance(task_a, dict) and "task" in task_a:
                    task_a = task_a["task"]
                if isinstance(task_b, dict) and "task" in task_b:
                    task_b = task_b["task"]
                conflicts_summary.append(f"- '{task_a.get('title', 'Task')}' conflicts with '{task_b.get('title', 'Task')}'")
    
    # Include patterns and historical insights
    patterns = user_context.get("patterns", {})
    pattern_summary = patterns.get("summary", "")
    task_patterns = patterns.get("tasks", {})
    checkin_patterns = patterns.get("checkins", {})
    historical = user_context.get("historical", {})
    
    # Build historical summary
    historical_summary = []
    if historical and historical.get("all_tasks"):
        total_historical = len(historical["all_tasks"])
        completed_historical = sum(1 for t in historical["all_tasks"] if t.get("completed"))
        if total_historical > 0:
            historical_summary.append(f"Past 30 days: {completed_historical}/{total_historical} tasks completed")
    
    if historical and historical.get("checkins"):
        checkin_count = len(historical["checkins"])
        if checkin_count > 0:
            historical_summary.append(f"{checkin_count} check-in(s) in past 30 days")
    
    if historical and historical.get("notes"):
        note_count = len(historical["notes"])
        if note_count > 0:
            historical_summary.append(f"{note_count} note(s)")
    
    if historical and historical.get("diary_entries"):
        diary_count = len(historical["diary_entries"])
        if diary_count > 0:
            historical_summary.append(f"{diary_count} diary entry/entries")
    
    if historical and historical.get("reminders"):
        reminder_count = len(historical["reminders"])
        if reminder_count > 0:
            historical_summary.append(f"{reminder_count} active reminder(s)")
    
    # If no historical data but we have today's tasks, mention that
    if not historical_summary and tasks_today:
        historical_summary.append(f"You have {len(tasks_today)} task(s) scheduled today")
    
    # Build last week summary (for "how did my last week go" queries)
    # Include today's tasks if historical data is sparse
    has_historical_tasks = historical and historical.get("all_tasks") and len(historical.get("all_tasks", [])) > 0
    last_week_summary = _build_weekly_summary(historical, today, tasks_today if not has_historical_tasks else None)
    
    system_prompt = f"""You are SolAI, a calm and intentional personal assistant for LifeOS.

Your personality:
- Calm, gentle, and aesthetic
- Highly intelligent and understanding
- Proactive but not pushy
- Respectful of user's autonomy
- Natural and conversational, not robotic

Your capabilities:
- Manage tasks and schedule
- Understand user's patterns and preferences
- Provide contextual advice based on historical data
- Help achieve goals
- Answer questions about the user's schedule and patterns
- Provide insights that aren't obvious from just today's view

Current context:
- Today's date: {today_str} ({today.strftime('%A')})
- Current time: {current_time}
- Timezone: Europe/London
- Calendar Guidance: 
  * "this week" = week of {today_str}
  * "next week" = week starting {(today + timedelta(days=(7-today.weekday()))).strftime('%Y-%m-%d')}
  * "Wednesday next week" = {(today + timedelta(days=(7-today.weekday()) + 2)).strftime('%Y-%m-%d')}

User's current state:
- Tasks today ({len(tasks_today)}): {chr(10).join(today_tasks_summary) if today_tasks_summary else "No tasks scheduled"}
- Upcoming tasks: {chr(10).join(upcoming_summary) if upcoming_summary else "None"}
- Conflicts: {chr(10).join(conflicts_summary) if conflicts_summary else "No conflicts detected"}
- Energy level: {energy.get('status', 'unknown')} (effective load: {energy.get('effectiveLoad', 0)})
- Available Categories: {', '.join([c.get('label', '') for c in categories]) if categories else "Health, Work, Family, Growth, Creativity"}

Historical context (past 30 days):
{chr(10).join(historical_summary) if historical_summary else "Just getting started - limited historical data available"}

Recent notes and reflections:
{_build_notes_summary(historical, today) if historical else "None"}

Patterns and insights:
{pattern_summary if pattern_summary else "Building patterns as you use LifeOS more"}

Last week summary (for "how did my last week go" queries):
{last_week_summary if last_week_summary else "No data available for last week"}

Context awareness (for behavior adaptation - use subtly, never mention):
{_format_context_signals_for_prompt(user_context.get("context_signals", {}))}

Monthly goals (user's focus areas for this month - reference naturally when relevant, but don't be pushy):
{_format_goals_for_prompt(user_context.get("monthly_goals", []))}

User context (shape your behavior based on these - preferences bias suggestions, constraints limit proposals, values influence tone):
{_format_memories_for_prompt(user_context.get("relevant_memories", []))}

Behavioral guidance from memories:
- PREFERENCES: When making suggestions (times, approaches, defaults), bias toward these preferences. If user says "schedule a workout" and you know they prefer mornings, suggest morning times naturally.
- CONSTRAINTS: Never propose anything that violates these hard boundaries. If user cannot work after 6pm, never suggest evening tasks. If user says "schedule a meeting at 7pm", gently suggest an earlier time that respects the constraint.
- VALUES: Let these influence your tone and assertiveness. If user values work-life balance, be gentler about overload. If user values discipline, you can be slightly more direct (but still calm). Values shape HOW you communicate, not WHAT you say.
- PATTERNS: Use these to inform defaults, but user's explicit intent always overrides patterns. Patterns are hints, not rules.

When responding:
- Be BRIEF and concise - aim for 1-2 sentences for most responses.
- Mobile-friendly: scannable and short.
- CATEGORIES: Every task MUST have a category. If the user doesn't specify one, GUESS based on the title and categories list, but then ASK the user if that category is correct or if they'd like to change it.
- PROMPTING: If a task request is vague (no time, no category), ask the user for the missing details in a helpful way.
- GOAL AWARENESS: When the user creates a task that relates to one of their monthly goals, ALWAYS acknowledge it concisely in your response. For example: "Scheduled! This aligns with your goal to [goal title]." or "Done! This relates to your goal: [goal title]." Keep it brief (1 sentence max) and natural. Only mention goals when there's a clear match - don't force it.
- For task creation/scheduling: Resolve relative dates (e.g., "next Wednesday") accurately based on the Guidance above.
- Resolve "next week" relative to {today_str}.
- Match the calm, intentional tone of LifeOS.

You must respond in JSON format with this structure:
{{
  "response": "Your natural, conversational response text. If creating a task, confirm the date/time/category you've chosen and ask if it looks right.",
  "action": "create_task" | "reschedule" | "confirm_create" | "apply_reschedule" | "suggest" | null,
  "action_data": {{
    // Only include if action is not null
    // For create_task: {{"title": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "value": "category_label", "notes": "..."}}
    // For reschedule: {{"task_id": "...", "new_datetime": "..."}}
    // For confirm_create: {{"task_preview": {{...}}}}
    // For apply_reschedule: {{"task_id": "...", "new_time": "..."}}
  }}
}}

Always respond with valid JSON. No markdown, no code blocks.

Always respond with valid JSON. No markdown, no code blocks."""

    return system_prompt


def _build_notes_summary(historical: Dict[str, Any], today: datetime) -> str:
    """
    Build a concise summary of recent notes and diary entries with their content.
    """
    from datetime import date, timedelta
    
    if not historical:
        return "None"
    
    # Get notes from the past 7 days (most recent)
    week_ago = today.date() - timedelta(days=7)
    recent_notes = []
    if historical.get("notes"):
        for note in historical["notes"][:5]:  # Limit to 5 most recent
            note_date_str = note.get("date")
            if note_date_str:
                try:
                    if len(note_date_str) > 10:
                        note_date_str = note_date_str[:10]
                    note_date = date.fromisoformat(note_date_str)
                    if note_date >= week_ago:
                        content = note.get("content", "").strip()
                        if content:
                            # Truncate long content
                            content_preview = content[:80] + "..." if len(content) > 80 else content
                            photo_info = " 📷" if note.get("has_photo") else ""
                            recent_notes.append(f"{note_date_str}: {content_preview}{photo_info}")
                except (ValueError, TypeError):
                    continue
    
    # Also include check-in notes (they often have reflections)
    if historical.get("checkins"):
        for checkin in historical["checkins"][:3]:  # Limit to 3 most recent
            checkin_date_str = checkin.get("date")
            checkin_note = checkin.get("note", "").strip()
            if checkin_note and checkin_date_str:
                try:
                    if len(checkin_date_str) > 10:
                        checkin_date_str = checkin_date_str[:10]
                    checkin_date = date.fromisoformat(checkin_date_str)
                    if checkin_date >= week_ago:
                        note_preview = checkin_note[:80] + "..." if len(checkin_note) > 80 else checkin_note
                        mood = f" [{checkin.get('mood')}]" if checkin.get("mood") else ""
                        recent_notes.append(f"{checkin_date_str}{mood}: {note_preview}")
                except (ValueError, TypeError):
                    continue
    
    # Get diary entries from the past 7 days
    recent_diary = []
    if historical.get("diary_entries"):
        for entry in historical["diary_entries"][:3]:  # Limit to 3 most recent
            created_at_str = entry.get("created_at")
            if created_at_str:
                try:
                    # Parse datetime and check if within last 7 days
                    entry_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    entry_date = entry_dt.date()
                    if entry_date >= week_ago:
                        text = entry.get("text", "").strip()
                        if text:
                            # Truncate long text
                            text_preview = text[:100] + "..." if len(text) > 100 else text
                            category = f" [{entry.get('category')}]" if entry.get("category") else ""
                            recent_diary.append(f"{entry_date.isoformat()}{category}: {text_preview}")
                except (ValueError, TypeError):
                    continue
    
    parts = []
    if recent_notes:
        # Show up to 4 items (notes + check-ins combined)
        parts.append(f"Notes & reflections ({len(recent_notes)}): {' | '.join(recent_notes[:4])}")
    
    if recent_diary:
        parts.append(f"Diary ({len(recent_diary)}): {' | '.join(recent_diary[:2])}")  # Max 2 entries
    
    if not parts:
        # Check if there are any notes/diary at all (just not recent)
        total_notes = len(historical.get("notes", []))
        total_diary = len(historical.get("diary_entries", []))
        if total_notes > 0 or total_diary > 0:
            return f"{total_notes} note(s), {total_diary} diary entry/entries (older than 7 days)"
        return "None"
    
    return " | ".join(parts)


def _format_context_signals_for_prompt(context_signals: Dict[str, Any]) -> str:
    """
    Format context signals for system prompt.
    Returns 2-3 sentences max - background context only, never mentioned to user.
    """
    from app.ai.context_service import format_context_signals_for_prompt
    return format_context_signals_for_prompt(context_signals)


def _format_memories_for_prompt(memories: List[Dict[str, Any]]) -> str:
    """
    Format relevant memories for system prompt with behavioral guidance.
    Memories are categorized by type to shape behavior:
    - Preferences: bias suggestions toward these
    - Constraints: limit what you propose (hard boundaries)
    - Values: influence tone and assertiveness
    - Patterns: inform defaults but don't override explicit intent
    """
    if not memories:
        return "None"
    
    # Categorize memories by type
    preferences = []
    constraints = []
    values = []
    patterns = []
    
    for mem in memories[:5]:
        content = mem.get("content", "").strip()
        memory_type = mem.get("memory_type", "").lower()
        if not content:
            continue
            
        if memory_type == "preference":
            preferences.append(content)
        elif memory_type == "constraint":
            constraints.append(content)
        elif memory_type == "value":
            values.append(content)
        elif memory_type == "pattern":
            patterns.append(content)
        else:
            # Fallback: treat as preference if type unknown
            preferences.append(content)
    
    parts = []
    
    if preferences:
        parts.append(f"Preferences (bias suggestions toward these): {', '.join(preferences)}")
    
    if constraints:
        parts.append(f"Constraints (do not propose anything that violates these): {', '.join(constraints)}")
    
    if values:
        parts.append(f"Values (let these influence your tone and how assertive/gentle you are): {', '.join(values)}")
    
    if patterns:
        parts.append(f"Patterns (inform defaults, but user intent always overrides): {', '.join(patterns)}")
    
    return "\n".join(parts) if parts else "None"


def _format_goals_for_prompt(goals: List[Dict[str, Any]]) -> str:
    """
    Format monthly goals for system prompt.
    Only includes active goals with meaningful titles.
    """
    if not goals:
        return "None"
    
    active_goals = [g for g in goals if g.get('title')]
    if not active_goals:
        return "None"
    
    goal_lines = []
    for goal in active_goals[:5]:  # Max 5 goals
        title = goal.get('title', '')
        description = goal.get('description', '') or ''
        progress = goal.get('progress', 0) or 0
        
        goal_line = f"- {title}"
        if description:
            goal_line += f" ({description})"
        if progress > 0:
            goal_line += f" [Progress: {progress}%]"
        
        goal_lines.append(goal_line)
    
    return "\n".join(goal_lines) if goal_lines else "None"


def _build_weekly_summary(historical: Dict[str, Any], today: datetime, today_tasks: Optional[List[Dict]] = None) -> str:
    """
    Build a detailed summary of the last 7 days for "how did my last week go" queries.
    Includes tasks scheduled for last week (even if created today), with dates, times, and details.
    """
    from datetime import date, timedelta
    from collections import defaultdict
    
    # Calculate last week's date range (7 days ago to yesterday)
    week_end = today.date() - timedelta(days=1)  # Yesterday
    week_start = week_end - timedelta(days=6)  # 7 days ago
    
    # Format date range for context
    week_start_str = week_start.strftime("%B %d")
    week_end_str = week_end.strftime("%B %d")
    
    # Filter tasks from last week (scheduled for last week, regardless of when created)
    last_week_tasks = []
    if historical and historical.get("all_tasks"):
        for task in historical["all_tasks"]:
            task_date_str = task.get("date")
            if task_date_str:
                try:
                    # Handle both YYYY-MM-DD and longer formats
                    if len(task_date_str) > 10:
                        task_date_str = task_date_str[:10]
                    task_date = date.fromisoformat(task_date_str)
                    if week_start <= task_date <= week_end:
                        last_week_tasks.append(task)
                except (ValueError, TypeError):
                    continue
    
    # Filter check-ins from last week
    last_week_checkins = []
    if historical and historical.get("checkins"):
        for checkin in historical["checkins"]:
            checkin_date_str = checkin.get("date")
            if checkin_date_str:
                try:
                    checkin_date = date.fromisoformat(checkin_date_str)
                    if week_start <= checkin_date <= week_end:
                        last_week_checkins.append(checkin)
                except (ValueError, TypeError):
                    continue
    
    # Always build a summary, even if limited
    # If we have no tasks or check-ins, we'll still provide context about the period
    
    # Build detailed summary
    parts = []
    
    # Add date range context
    parts.append(f"Period: {week_start_str} - {week_end_str} ({week_start.strftime('%A')} to {week_end.strftime('%A')})")
    
    if last_week_tasks:
        total = len(last_week_tasks)
        completed = sum(1 for t in last_week_tasks if t.get("completed"))
        completion_rate = (completed / total * 100) if total > 0 else 0
        
        # More concise format
        parts.append(f"{completed}/{total} completed ({completion_rate:.0f}%)")
        
        # Group by day
        tasks_by_day = defaultdict(lambda: {"total": 0, "completed": 0})
        for task in last_week_tasks:
            task_date_str = task.get("date")
            if task_date_str:
                try:
                    if len(task_date_str) > 10:
                        task_date_str = task_date_str[:10]
                    task_date = date.fromisoformat(task_date_str)
                    day_name = task_date.strftime("%A")
                    day_key = f"{day_name} ({task_date.strftime('%b %d')})"
                    
                    tasks_by_day[day_key]["total"] += 1
                    if task.get("completed"):
                        tasks_by_day[day_key]["completed"] += 1
                except (ValueError, TypeError):
                    continue
        
        if tasks_by_day:
            # Sort by date
            sorted_days = sorted(tasks_by_day.items(), key=lambda x: x[0])
            # Only show days with significant activity or interesting patterns
            day_summaries = []
            for day_key, stats in sorted_days:
                if stats['total'] > 0:
                    day_summaries.append(f"{day_key}: {stats['completed']}/{stats['total']}")
            if day_summaries:
                # Only include if there are multiple days or interesting variance
                if len(day_summaries) > 1:
                    parts.append(f"Days: {' | '.join(day_summaries[:4])}")  # Max 4 days
    
    if last_week_checkins:
        parts.append(f"Check-ins: {len(last_week_checkins)} days")
        
        # Mood distribution
        moods = [c.get("mood") for c in last_week_checkins if c.get("mood")]
        if moods:
            from collections import Counter
            mood_counts = Counter(moods)
            top_mood = mood_counts.most_common(1)[0]
            parts.append(f"Most common mood: {top_mood[0]} ({top_mood[1]} days)")
    
    # If we have no data, provide context about the period
    if not parts or (not last_week_tasks and not last_week_checkins):
        # Check if we have tasks in the system at all
        total_tasks_in_system = len(historical.get("all_tasks", [])) if historical else 0
        if total_tasks_in_system > 0:
            return f"Last week ({week_start_str} - {week_end_str}): No tasks scheduled for this period. You have {total_tasks_in_system} task(s) in your system, but none are scheduled for last week."
        else:
            return f"Last week ({week_start_str} - {week_end_str}): No data available for this period."
    
    return " | ".join(parts) if parts else f"Last week ({week_start_str} - {week_end_str}): No data available."


async def get_user_context(user_id: str, conversation_context: Optional[str] = None) -> Dict[str, Any]:
    """
    Gather comprehensive user context for the assistant.
    Now includes historical data and pattern analysis.
    """
    from datetime import date
    
    now = datetime.now(tz)
    today_str = now.strftime("%Y-%m-%d")
    
    today_tasks_raw = await db_repo.get_tasks_by_date_and_user(today_str, user_id)
    
    # Get categories for mapping
    categories_list = await db_repo.get_categories(user_id)
    category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories_list}
    
    from app.logic.frontend_adapter import backend_task_to_frontend
    today_tasks = [backend_task_to_frontend(t, category_label_to_id) for t in today_tasks_raw]
    
    # Optimize: Fetch all upcoming tasks in one DB call instead of 7
    week_start_upcoming = now.date() + timedelta(days=1)
    week_end_upcoming = now.date() + timedelta(days=7)
    all_upcoming_raw = await db_repo.get_tasks_by_date_range(user_id, week_start_upcoming, week_end_upcoming)
    
    upcoming_tasks = []
    # Group by date to maintain the "limit per day" logic
    from collections import defaultdict
    upcoming_by_date = defaultdict(list)
    for t in all_upcoming_raw:
        task_date = t.get("date")
        if task_date:
            upcoming_by_date[task_date].append(backend_task_to_frontend(t, category_label_to_id))
            
    for i in range(1, 8):
        date_str = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        tasks = upcoming_by_date[date_str][:3]  # Limit per day
        upcoming_tasks.extend(tasks)
    
    conflicts = await find_conflicts(user_id=user_id)
    
    try:
        from app.logic.today_engine import calculate_energy
        formatted_tasks = []
        for task in today_tasks_raw:
            # Safely extract time from datetime string
            time_value = task.get("time")
            if not time_value and task.get("datetime"):
                datetime_str = task.get("datetime")
                if isinstance(datetime_str, str) and " " in datetime_str:
                    parts = datetime_str.split(" ")
                    if len(parts) > 1:
                        time_value = parts[1]
            
            formatted_task = {
                "time": time_value,
                "duration_minutes": task.get("duration_minutes", 60),
                "completed": task.get("completed", False)
            }
            formatted_tasks.append(formatted_task)
        energy = calculate_energy(formatted_tasks)
    except Exception as e:
        logger.error(f"Error calculating energy: {e}")
        energy = {"status": "unknown", "effectiveLoad": 0}
    
    categories = categories_list
    
    try:
        historical_context = await _get_historical_context(user_id)
        
        from datetime import date
        week_end = now.date() - timedelta(days=1)
        week_start = week_end - timedelta(days=6)
        
        last_week_tasks_raw = await db_repo.get_tasks_by_date_range(
            user_id, 
            week_start, 
            week_end
        )
        
        last_week_tasks = [backend_task_to_frontend(t, category_label_to_id) for t in last_week_tasks_raw]
        
        if "all_tasks" not in historical_context:
            historical_context["all_tasks"] = []
        
        existing_task_ids = {t.get("id") for t in historical_context.get("all_tasks", []) if t.get("id")}
        for task in last_week_tasks:
            task_id = task.get("id")
            if task_id and task_id not in existing_task_ids:
                historical_context["all_tasks"].append(task)
                existing_task_ids.add(task_id)
        
    except Exception as e:
        logger.error(f"Error gathering historical context: {e}", exc_info=True)
        historical_context = {
            "all_tasks": [],
            "checkins": [],
            "notes": [],
            "diary_entries": [],
            "reminders": []
        }
    
    try:
        from app.ai.pattern_analyzer import (
            analyze_task_patterns,
            analyze_checkin_patterns,
            analyze_notes_and_diary,
            generate_pattern_summary
        )
        
        task_patterns = analyze_task_patterns(historical_context.get("all_tasks", []))
        checkin_patterns = analyze_checkin_patterns(historical_context.get("checkins", []))
        notes_diary = analyze_notes_and_diary(
            historical_context.get("notes", []),
            historical_context.get("diary_entries", [])
        )
        
        pattern_summary = generate_pattern_summary(task_patterns, checkin_patterns, notes_diary)
    except Exception as e:
        logger.error(f"Error analyzing patterns: {e}", exc_info=True)
        task_patterns = {}
        checkin_patterns = {}
        notes_diary = {}
        pattern_summary = ""
    
    # Get context signals (weekly cached, foundation only)
    try:
        from app.ai.context_service import get_or_compute_context_signals
        context_signals = await get_or_compute_context_signals(user_id, force_refresh=False)
    except Exception as e:
        logger.error(f"Error getting context signals: {e}", exc_info=True)
        context_signals = {
            "signals": {"sentiment": "neutral", "themes": []},
            "drift": {"overload": False, "disengagement": False, "avoidance": False}
        }
    
    # Get relevant memories for conversation context
    relevant_memories = []
    if conversation_context:
        try:
            from uuid import UUID
            from db.repositories.memory import MemoryRepository
            async with AsyncSessionLocal() as session:
                memory_repo = MemoryRepository(session)
                memories = await memory_repo.get_relevant_memories(
                    UUID(user_id),
                    conversation_context,
                    limit=5
                )
                relevant_memories = [
                    {
                        "content": m.content,
                        "memory_type": m.memory_type,
                        "confidence": float(m.confidence)
                    }
                    for m in memories
                ]
                if relevant_memories:
                    logger.info(
                        f"[Memory Injection] Retrieved {len(relevant_memories)} relevant memories for context: "
                        f"{conversation_context[:50]}..."
                    )
        except Exception as e:
            logger.error(f"Error getting relevant memories: {e}", exc_info=True)
    
    # Get monthly goals for goal-aware suggestions
    monthly_goals = []
    try:
        current_month = now.strftime("%Y-%m")
        monthly_goals = await db_repo.get_monthly_goals(current_month, user_id)
    except Exception as e:
        logger.error(f"Error getting monthly goals: {e}", exc_info=True)
        monthly_goals = []
    
    return {
        "tasks_today": today_tasks,
        "upcoming_tasks": upcoming_tasks,
        "conflicts": conflicts,
        "energy": energy,
        "categories": categories,
        "historical": historical_context,
        "patterns": {
            "tasks": task_patterns,
            "checkins": checkin_patterns,
            "notes_diary": notes_diary,
            "summary": pattern_summary
        },
        "context_signals": context_signals,
        "relevant_memories": relevant_memories,
        "monthly_goals": monthly_goals
    }


async def _get_historical_context(user_id: str, days_back: int = 30) -> Dict[str, Any]:
    """
    Gather historical data for pattern analysis.
    """
    from datetime import date
    from uuid import UUID
    from db.session import AsyncSessionLocal
    from sqlalchemy import select, and_, or_
    from db.models import Task, Checkin, Note, DiaryEntry, Reminder
    
    cutoff_date = date.today() - timedelta(days=days_back)
    
    # Also get last week's date range to ensure we include those tasks
    today = date.today()
    week_end = today - timedelta(days=1)  # Yesterday
    week_start = week_end - timedelta(days=6)  # 7 days ago
    # Use the earlier of cutoff_date or week_start to ensure we get last week
    effective_start = min(cutoff_date, week_start) if week_start < cutoff_date else cutoff_date
    
    async with AsyncSessionLocal() as session:
        # Get all tasks from the past N days OR scheduled for last week
        # This ensures we get tasks scheduled for last week even if created recently
        tasks_query = select(Task).where(
            and_(
                Task.user_id == UUID(user_id),
                or_(
                    Task.date >= cutoff_date,  # Tasks from past 30 days
                    and_(Task.date >= week_start, Task.date <= week_end)  # OR tasks scheduled for last week
                )
            )
        ).order_by(Task.date.desc())
        tasks_result = await session.execute(tasks_query)
        all_tasks_raw = tasks_result.scalars().all()
        
        # Convert tasks to dict format
        from app.logic.frontend_adapter import backend_task_to_frontend
        all_tasks = []
        for task in all_tasks_raw:
            task_dict = {
                "id": str(task.id),
                "title": task.title,
                "date": task.date.isoformat() if task.date else None,
                "time": task.datetime.strftime("%H:%M") if task.datetime else None,
                "datetime": task.datetime.isoformat() if task.datetime else None,
                "completed": task.completed,
                "category_id": str(task.category_id) if task.category_id else None,
                "category": task.category,
                "energy": task.energy,
                "notes": task.notes,
            }
            all_tasks.append(backend_task_to_frontend(task_dict))
        
        # Get check-ins from the past N days
        checkins_query = select(Checkin).where(
            and_(
                Checkin.user_id == UUID(user_id),
                Checkin.date >= cutoff_date
            )
        ).order_by(Checkin.date.desc())
        checkins_result = await session.execute(checkins_query)
        checkins_raw = checkins_result.scalars().all()
        
        checkins = []
        for checkin in checkins_raw:
            checkins.append({
                "id": str(checkin.id),
                "date": checkin.date.isoformat() if checkin.date else None,
                "completedTaskIds": [str(tid) for tid in (checkin.completed_task_ids or [])],
                "incompleteTaskIds": [str(tid) for tid in (checkin.incomplete_task_ids or [])],
                "mood": checkin.mood,
                "note": checkin.note,
            })
        
        # Get notes from the past N days
        notes_query = select(Note).where(
            and_(
                Note.user_id == UUID(user_id),
                Note.date >= cutoff_date
            )
        ).order_by(Note.date.desc())
        notes_result = await session.execute(notes_query)
        notes_raw = notes_result.scalars().all()
        
        notes = []
        for note in notes_raw:
            notes.append({
                "id": str(note.id),
                "date": note.date.isoformat() if note.date else None,
                "content": note.content,
                "photo_filename": note.photo_filename,
                "has_photo": bool(note.photo_filename),
            })
        
        # Get diary entries from the past N days
        # Use naive datetime for TIMESTAMP WITHOUT TIME ZONE column
        # datetime is already imported at module level, but we need naive version
        from datetime import datetime as dt_naive
        cutoff_datetime = dt_naive.combine(cutoff_date, dt_naive.min.time())
        diary_query = select(DiaryEntry).where(
            and_(
                DiaryEntry.user_id == UUID(user_id),
                DiaryEntry.created_at >= cutoff_datetime
            )
        ).order_by(DiaryEntry.created_at.desc())
        diary_result = await session.execute(diary_query)
        diary_raw = diary_result.scalars().all()
        
        diary_entries = []
        for entry in diary_raw:
            diary_entries.append({
                "id": str(entry.id),
                "text": entry.text,
                "category": entry.category,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            })
        
        # Get all reminders (not time-limited)
        reminders_query = select(Reminder).where(
            Reminder.user_id == UUID(user_id)
        ).order_by(Reminder.created_at.desc())
        reminders_result = await session.execute(reminders_query)
        reminders_raw = reminders_result.scalars().all()
        
        reminders = []
        for reminder in reminders_raw:
            reminders.append({
                "id": str(reminder.id),
                "title": reminder.title,
                "description": reminder.description,
                "dueDate": reminder.due_date.isoformat() if reminder.due_date else None,
                "time": reminder.time.strftime("%H:%M") if reminder.time else None,
                "type": reminder.type,
                "recurring": reminder.recurring,
                "note": reminder.note,
            })
        
        return {
            "all_tasks": all_tasks,
            "checkins": checkins,
            "notes": notes,
            "diary_entries": diary_entries,
            "reminders": reminders,
        }


async def generate_intelligent_response(
    user_message: str,
    user_id: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    background_tasks: Any = None
) -> Dict[str, Any]:
    """
    Generate an intelligent, context-aware response using LLM.
    
    Args:
        user_message: The user's message
        user_id: User ID for context
        conversation_history: List of previous messages [{"role": "user|assistant", "content": "..."}]
        background_tasks: Optional FastAPI BackgroundTasks for offloading heavy work
    
    Returns:
        Dict with "assistant_response" and "ui" keys
    """
    try:
        # Get user context
        user_context = await get_user_context(user_id, conversation_context=user_message)
        
        # Build system prompt
        system_prompt = build_system_prompt(user_context)
        
        # Prepare messages
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 10 messages to manage token usage)
        if conversation_history:
            recent_history = conversation_history[-10:]
            for msg in recent_history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current user message
        messages.append({"role": "user", "content": user_message})
        
        # Call LLM
        client = get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,  # Slightly creative for natural responses
            response_format={"type": "json_object"}  # Force JSON output
        )
        
        # Parse response
        raw_output = response.choices[0].message.content.strip()
        try:
            data = json.loads(raw_output)
        except json.JSONDecodeError as e:
            # Fallback: try to extract JSON from markdown
            cleaned = raw_output.replace("```json", "").replace("```", "").strip()
            try:
                data = json.loads(cleaned)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse LLM response as JSON. Raw output: {raw_output[:500]}")
                # Return a helpful response even if JSON parsing fails
                return {
                    "assistant_response": "I understand you're asking about your schedule. Let me help you with that. Could you try asking in a slightly different way?",
                    "ui": None
                }
        
        # Extract response and action
        assistant_response = data.get("response", "I'm not sure how to help with that.")
        if not assistant_response or len(assistant_response.strip()) == 0:
            assistant_response = "I understand your question, but I'm having trouble formulating a response. Could you try rephrasing?"
        
        action = data.get("action")
        action_data = data.get("action_data", {})
        
        # Build UI object based on action
        ui = None
        if action:
            if action == "create_task":
                # Create pending action so confirmation works
                from app.logic.pending_actions import create_pending_action
                await create_pending_action("create", {"task_fields": action_data}, user_id)
                
                ui = {
                    "action": "confirm_create",
                    "task_preview": action_data
                }
            elif action == "reschedule":
                ui = {
                    "action": "apply_reschedule",
                    "task_id": action_data.get("task_id"),
                    "new_time": action_data.get("new_time")
                }
            elif action == "confirm_create":
                ui = {
                    "action": "confirm_create",
                    "task_preview": action_data.get("task_preview", {})
                }
            elif action == "apply_reschedule":
                ui = {
                    "action": "apply_reschedule",
                    "task_id": action_data.get("task_id"),
                    "new_time": action_data.get("new_time")
                }
            elif action == "suggest":
                # "suggest" is just conversational - no UI action needed
                ui = None
        
        # Memory extraction (fails silently, now backgrounded if possible)
        try:
            if background_tasks:
                background_tasks.add_task(
                    _extract_and_store_memory,
                    user_message=user_message,
                    assistant_response=assistant_response,
                    user_id=user_id,
                    user_context=user_context
                )
                logger.info(f"[Memory Extraction] Background task added for user {user_id}")
            else:
                # Fallback to non-blocking async call (won't wait for it)
                import asyncio
                asyncio.create_task(_extract_and_store_memory(
                    user_message=user_message,
                    assistant_response=assistant_response,
                    user_id=user_id,
                    user_context=user_context
                ))
                logger.info(f"[Memory Extraction] Async task created for user {user_id}")
        except Exception as e:
            # Fail silently - never block assistant responses
            logger.debug(f"Memory extraction scheduling failed (silent): {e}")
        
        return {
            "assistant_response": assistant_response,
            "ui": ui
        }
        
    except ValueError as e:
        if "OPENAI_API_KEY" in str(e):
            logger.error(f"OpenAI API key not configured: {e}")
            raise  # Re-raise to be handled by endpoint
        logger.error(f"ValueError in intelligent assistant: {e}", exc_info=True)
        return {
            "assistant_response": "I'm having trouble connecting to the AI service right now. Please try again in a moment.",
            "ui": None
        }
    except Exception as e:
        logger.error(f"Error in intelligent assistant: {e}", exc_info=True)
        # Provide a more helpful error message
        error_msg = str(e).lower()
        if "timeout" in error_msg or "connection" in error_msg:
            return {
                "assistant_response": "I'm having trouble connecting right now. Please try again in a moment.",
                "ui": None
            }
        elif "rate limit" in error_msg:
            return {
                "assistant_response": "I'm processing a lot of requests right now. Please try again in a moment.",
                "ui": None
            }
        else:
            # Fallback to simple response
            return {
                "assistant_response": "I'm having trouble processing that. Could you try rephrasing your question?",
                "ui": None
            }


async def _extract_and_store_memory(
    user_message: str,
    assistant_response: str,
    user_id: str,
    user_context: Dict[str, Any]
) -> None:
    """Extract and store memory from conversation. Fails silently."""
    from uuid import UUID
    from db.session import AsyncSessionLocal
    from db.repositories.memory import MemoryRepository
    from app.ai.memory_extractor import extract_memory_candidates
    
    try:
        logger.info(f"[Memory Extraction] Starting extraction for user {user_id}")
        candidates = extract_memory_candidates(
            user_message=user_message,
            assistant_response=assistant_response,
            context=user_context
        )
        
        if not candidates:
            logger.info(f"[Memory Extraction] No candidate extracted from: '{user_message[:50]}...'")
            return  # No candidate extracted
        
        candidate = candidates[0]
        logger.info(f"[Memory Extraction] Candidate extracted: {candidate.memory_type.value} - '{candidate.content[:50]}...' (confidence: {candidate.confidence:.2f})")
        
        from app.ai.memory_policy import validate_memory_candidate
        is_valid, errors = validate_memory_candidate(candidate)
        
        if not is_valid:
            logger.info(
                f"[Memory Extraction] Candidate REJECTED for user {user_id}: "
                f"'{candidate.content[:50]}...' "
                f"Errors: {', '.join(errors)}"
            )
            return
        async with AsyncSessionLocal() as session:
            repo = MemoryRepository(session)
            memory = await repo.create_from_candidate(
                user_id=UUID(user_id),
                candidate=candidate
            )
            await session.commit()
            
            logger.info(
                f"[Memory Extraction] ✅ Memory STORED for user {user_id}: "
                f"{candidate.memory_type.value} - '{candidate.content[:50]}...' "
                f"(confidence: {candidate.confidence:.2f})"
            )
    
    except Exception as e:
        logger.error(f"[Memory Extraction] ❌ Extraction/storage failed: {e}", exc_info=True)

