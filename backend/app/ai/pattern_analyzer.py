# app/ai/pattern_analyzer.py
"""
Pattern analysis for SolAI assistant.

Analyzes user's historical data to identify patterns:
- Task completion rates
- Time preferences
- Mood/productivity correlations
- Category usage
- Scheduling patterns
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, date
from collections import defaultdict
import pytz
import logging

logger = logging.getLogger(__name__)
tz = pytz.timezone("Europe/London")


def analyze_task_patterns(tasks: List[Dict[str, Any]], days_back: int = 30) -> Dict[str, Any]:
    """
    Analyze patterns from historical tasks.
    
    Returns:
        Dict with completion rates, time preferences, category patterns, etc.
    """
    if not tasks:
        return {
            "completion_rate": 0.0,
            "preferred_times": [],
            "category_usage": {},
            "anytime_vs_scheduled": {"anytime": 0, "scheduled": 0},
            "insights": []
        }
    
    # Filter to recent tasks (last N days)
    cutoff_date = datetime.now(tz).date() - timedelta(days=days_back)
    recent_tasks = [
        t for t in tasks 
        if t.get("date") and date.fromisoformat(t["date"]) >= cutoff_date
    ]
    
    if not recent_tasks:
        return {
            "completion_rate": 0.0,
            "preferred_times": [],
            "category_usage": {},
            "anytime_vs_scheduled": {"anytime": 0, "scheduled": 0},
            "insights": []
        }
    
    # Completion rate
    completed = sum(1 for t in recent_tasks if t.get("completed", False))
    total = len(recent_tasks)
    completion_rate = completed / total if total > 0 else 0.0
    
    # Time preferences (hour of day)
    time_distribution = defaultdict(int)
    scheduled_count = 0
    anytime_count = 0
    
    for task in recent_tasks:
        if task.get("time"):
            scheduled_count += 1
            try:
                # Extract hour from time string (HH:MM)
                time_str = task.get("time", "")
                if ":" in time_str:
                    hour = int(time_str.split(":")[0])
                    time_distribution[hour] += 1
            except (ValueError, AttributeError):
                pass
        else:
            anytime_count += 1
    
    # Get top 3 preferred hours
    preferred_times = sorted(
        time_distribution.items(),
        key=lambda x: x[1],
        reverse=True
    )[:3]
    preferred_times = [f"{h:02d}:00" for h, _ in preferred_times]
    
    # Category usage
    category_usage = defaultdict(int)
    for task in recent_tasks:
        cat = task.get("category") or "uncategorized"
        category_usage[cat] += 1
    
    # Generate insights - focus on meaningful patterns
    insights = []
    
    # Completion rate insights with context
    if completion_rate >= 0.85:
        insights.append(f"Strong completion rate: {completion_rate:.0%}")
    elif completion_rate >= 0.7:
        insights.append(f"Good completion rate: {completion_rate:.0%}")
    elif completion_rate >= 0.5:
        insights.append(f"Moderate completion: {completion_rate:.0%}")
    else:
        insights.append(f"Completion rate: {completion_rate:.0%} - room for improvement")
    
    # Time preferences - only mention if there's a clear pattern
    if preferred_times and len(preferred_times) > 0:
        if len(preferred_times) == 1 or (len(preferred_times) == 2 and time_distribution[preferred_times[0].split(":")[0]] > time_distribution[preferred_times[1].split(":")[0]] * 1.5):
            insights.append(f"Peak productivity: {preferred_times[0]}")
        else:
            insights.append(f"Active hours: {', '.join(preferred_times[:2])}")
    
    # Scheduling style - only if there's a clear preference
    if total > 5:  # Only analyze if enough data
        if anytime_count > scheduled_count * 2:
            insights.append("Prefers flexible scheduling")
        elif scheduled_count > anytime_count * 2:
            insights.append("Prefers structured scheduling")
    
    # Top category - only if significant
    top_category = max(category_usage.items(), key=lambda x: x[1]) if category_usage else None
    if top_category and top_category[1] >= total * 0.3:  # At least 30% of tasks
        insights.append(f"Focus area: {top_category[0]}")
    
    return {
        "completion_rate": completion_rate,
        "preferred_times": preferred_times,
        "category_usage": dict(category_usage),
        "anytime_vs_scheduled": {
            "anytime": anytime_count,
            "scheduled": scheduled_count
        },
        "total_tasks_analyzed": total,
        "insights": insights
    }


def analyze_checkin_patterns(checkins: List[Dict[str, Any]], days_back: int = 30) -> Dict[str, Any]:
    """
    Analyze patterns from check-ins.
    
    Returns:
        Dict with mood patterns, productivity patterns, etc.
    """
    if not checkins:
        return {
            "mood_distribution": {},
            "average_completion": 0.0,
            "insights": []
        }
    
    # Filter to recent check-ins
    cutoff_date = datetime.now(tz).date() - timedelta(days=days_back)
    recent_checkins = [
        c for c in checkins
        if c.get("date") and date.fromisoformat(c["date"]) >= cutoff_date
    ]
    
    if not recent_checkins:
        return {
            "mood_distribution": {},
            "average_completion": 0.0,
            "insights": []
        }
    
    # Mood distribution
    mood_distribution = defaultdict(int)
    total_completed = 0
    total_tasks = 0
    
    for checkin in recent_checkins:
        mood = checkin.get("mood")
        if mood:
            mood_distribution[mood] += 1
        
        # Calculate completion rate from check-in
        completed_ids = checkin.get("completedTaskIds", [])
        incomplete_ids = checkin.get("incompleteTaskIds", [])
        day_total = len(completed_ids) + len(incomplete_ids)
        if day_total > 0:
            total_completed += len(completed_ids)
            total_tasks += day_total
    
    average_completion = total_completed / total_tasks if total_tasks > 0 else 0.0
    
    # Generate insights
    insights = []
    
    if mood_distribution:
        top_mood = max(mood_distribution.items(), key=lambda x: x[1])
        insights.append(f"Most common mood: {top_mood[0]} ({top_mood[1]} days)")
    
    if average_completion >= 0.8:
        insights.append(f"Strong daily completion rate: {average_completion:.0%}")
    elif average_completion < 0.5:
        insights.append(f"Lower daily completion: {average_completion:.0%} - consider lighter days")
    
    return {
        "mood_distribution": dict(mood_distribution),
        "average_completion": average_completion,
        "total_checkins": len(recent_checkins),
        "insights": insights
    }


def analyze_notes_and_diary(notes: List[Dict[str, Any]], diary_entries: List[Dict[str, Any]], days_back: int = 30) -> Dict[str, Any]:
    """
    Analyze patterns from notes and diary entries.
    
    Returns:
        Dict with themes, frequency, etc.
    """
    cutoff_date = datetime.now(tz).date() - timedelta(days=days_back)
    
    recent_notes = [
        n for n in notes
        if n.get("date") and date.fromisoformat(n["date"]) >= cutoff_date
    ]
    
    recent_diary = [
        d for d in diary_entries
        if d.get("created_at") and datetime.fromisoformat(d["created_at"].replace("Z", "+00:00")).date() >= cutoff_date
    ]
    
    insights = []
    
    if recent_notes:
        insights.append(f"{len(recent_notes)} note(s) in the past {days_back} days")
    
    if recent_diary:
        insights.append(f"{len(recent_diary)} diary entry/entries in the past {days_back} days")
    
    # Could add more sophisticated analysis here (sentiment, themes, etc.)
    # For now, just frequency
    
    return {
        "notes_count": len(recent_notes),
        "diary_count": len(recent_diary),
        "insights": insights
    }


def generate_pattern_summary(
    task_patterns: Dict[str, Any],
    checkin_patterns: Dict[str, Any],
    notes_diary: Dict[str, Any]
) -> str:
    """
    Generate a concise, meaningful summary of patterns and progress.
    Focus on insights, not just statistics.
    """
    parts = []
    
    # Task insights - prioritize most meaningful
    task_insights = task_patterns.get("insights", [])
    if task_insights:
        # Completion rate is most important, put it first
        completion_insights = [i for i in task_insights if "completion" in i.lower() or "rate" in i.lower()]
        other_insights = [i for i in task_insights if i not in completion_insights]
        parts.extend(completion_insights[:1])  # Only top completion insight
        parts.extend(other_insights[:2])  # Top 2 other insights
    
    # Check-in insights - only if meaningful
    checkin_insights = checkin_patterns.get("insights", [])
    if checkin_insights:
        # Prioritize completion rate over mood (more actionable)
        completion_checkin = [i for i in checkin_insights if "completion" in i.lower()]
        mood_insights = [i for i in checkin_insights if "mood" in i.lower()]
        if completion_checkin:
            parts.extend(completion_checkin[:1])
        elif mood_insights:
            parts.extend(mood_insights[:1])
    
    # Notes/diary - only mention if significant activity
    notes_insights = notes_diary.get("insights", [])
    if notes_insights and len(notes_insights) > 0:
        # Only include if there's meaningful activity (more than 3 items)
        note_count = notes_diary.get("notes_count", 0)
        diary_count = notes_diary.get("diary_count", 0)
        if note_count + diary_count >= 3:
            parts.append(f"Active reflection: {note_count + diary_count} entries")
    
    if not parts:
        return "Building patterns as you use LifeOS more"
    
    # Return concise summary (max 3-4 insights)
    return " | ".join(parts[:4])

