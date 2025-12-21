# app/ai/intelligent_assistant.py
# Day 21: Assistant Intelligence Foundation
# Conversational, context-aware assistant with natural responses

import os
import json
from datetime import datetime, timedelta
import pytz
from typing import List, Dict, Optional, Any
from openai import OpenAI
from dotenv import load_dotenv

from app.logic.task_engine import get_all_tasks, group_tasks_by_date
from app.logic.today_engine import get_today_view
from app.logic.conflict_engine import find_conflicts
from app.logic.week_engine import get_week_stats
from db.repo import db_repo
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
- Provide contextual advice
- Help achieve goals
- Answer questions about the user's schedule

Current context:
- Today's date: {today_str}
- Current time: {current_time}
- Timezone: Europe/London

User's current state:
- Tasks today ({len(tasks_today)}): {chr(10).join(today_tasks_summary) if today_tasks_summary else "No tasks scheduled"}
- Upcoming tasks: {chr(10).join(upcoming_summary) if upcoming_summary else "None"}
- Conflicts: {chr(10).join(conflicts_summary) if conflicts_summary else "No conflicts detected"}
- Energy level: {energy.get('status', 'unknown')} (effective load: {energy.get('effectiveLoad', 0)})
- Categories: {', '.join([c.get('label', '') for c in categories[:5]]) if categories else "None"}

When responding:
- Be natural and conversational
- Use the user's context to give relevant advice
- If you need to perform an action (create task, reschedule, etc.), clearly state what you'll do
- For confirmations, ask naturally but clearly
- Keep responses concise but helpful
- Match the calm, intentional tone of LifeOS

IMPORTANT: You must respond in JSON format with this structure:
{{
  "response": "Your natural, conversational response text",
  "action": "create_task" | "reschedule" | "confirm_create" | "apply_reschedule" | "suggest" | null,
  "action_data": {{
    // Only include if action is not null
    // For create_task: {{"title": "...", "date": "...", "time": "...", ...}}
    // For reschedule: {{"task_id": "...", "new_datetime": "..."}}
    // For confirm_create: {{"task_preview": {{...}}}}
    // For apply_reschedule: {{"task_id": "...", "new_time": "..."}}
  }}
}}

Always respond with valid JSON. No markdown, no code blocks."""

    return system_prompt


async def get_user_context(user_id: str) -> Dict[str, Any]:
    """
    Gather comprehensive user context for the assistant.
    """
    now = datetime.now(tz)
    today_str = now.strftime("%Y-%m-%d")
    
    # Get today's tasks
    today_tasks_raw = await db_repo.get_tasks_by_date_and_user(today_str, user_id)
    # Convert to frontend format for consistency
    from app.logic.frontend_adapter import backend_task_to_frontend
    today_tasks = [backend_task_to_frontend(t) for t in today_tasks_raw]
    
    # Get upcoming tasks (next 7 days)
    upcoming_tasks = []
    for i in range(1, 8):
        date_str = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        tasks_raw = await db_repo.get_tasks_by_date_and_user(date_str, user_id)
        tasks = [backend_task_to_frontend(t) for t in tasks_raw[:3]]  # Limit per day
        upcoming_tasks.extend(tasks)
    
    # Get conflicts
    conflicts = await find_conflicts(user_id=user_id)
    
    # Get today's energy/load
    try:
        from app.logic.today_engine import calculate_energy
        # Convert tasks to format expected by calculate_energy (needs backend format)
        formatted_tasks = []
        for task in today_tasks_raw:
            formatted_task = {
                "time": task.get("time") or (task.get("datetime") and task["datetime"].split(" ")[1] if isinstance(task.get("datetime"), str) else None),
                "duration_minutes": task.get("duration_minutes", 60),
                "completed": task.get("completed", False)
            }
            formatted_tasks.append(formatted_task)
        energy = calculate_energy(formatted_tasks)
    except Exception as e:
        logger.error(f"Error calculating energy: {e}")
        energy = {"status": "unknown", "effectiveLoad": 0}
    
    # Get categories
    categories = await db_repo.get_categories(user_id)
    
    return {
        "tasks_today": today_tasks,
        "upcoming_tasks": upcoming_tasks,
        "conflicts": conflicts,
        "energy": energy,
        "categories": categories
    }


async def generate_intelligent_response(
    user_message: str,
    user_id: str,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """
    Generate an intelligent, context-aware response using LLM.
    
    Args:
        user_message: The user's message
        user_id: User ID for context
        conversation_history: List of previous messages [{"role": "user|assistant", "content": "..."}]
    
    Returns:
        Dict with "assistant_response" and "ui" keys
    """
    try:
        # Get user context
        user_context = await get_user_context(user_id)
        
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
        except json.JSONDecodeError:
            # Fallback: try to extract JSON from markdown
            cleaned = raw_output.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned)
        
        # Extract response and action
        assistant_response = data.get("response", "I'm not sure how to help with that.")
        action = data.get("action")
        action_data = data.get("action_data", {})
        
        # Build UI object based on action
        ui = None
        if action:
            if action == "create_task":
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
                ui = {
                    "action": "suggest",
                    "suggestions": action_data.get("suggestions", [])
                }
        
        return {
            "assistant_response": assistant_response,
            "ui": ui
        }
        
    except Exception as e:
        logger.error(f"Error in intelligent assistant: {e}", exc_info=True)
        # Fallback to simple response
        return {
            "assistant_response": "I'm having trouble processing that. Could you try rephrasing?",
            "ui": None
        }

