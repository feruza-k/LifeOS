# app/ai/habit_reinforcement.py
"""
AI-Powered Habit Reinforcement Engine
Analyzes user patterns to detect habit risks and provide personalized reinforcement.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta, date
from collections import defaultdict, Counter
import logging

logger = logging.getLogger(__name__)


def analyze_habit_health(
    tasks: List[Dict[str, Any]],
    checkins: List[Dict[str, Any]],
    days_back: int = 30
) -> Dict[str, Any]:
    """
    Analyze overall habit health and identify risks.
    
    Returns:
        - habit_strengths: Dictionary of habit dimensions and their strength scores
        - risk_indicators: List of detected risks with severity and context
        - micro_suggestions: Personalized action suggestions
        - encouragement: Context-aware motivational message
    """
    today = date.today()
    start_date = today - timedelta(days=days_back)
    
    # Filter data to relevant period
    recent_tasks = [
        t for t in tasks
        if t.get("date") and date.fromisoformat(str(t.get("date"))[:10]) >= start_date
    ]
    recent_checkins = [
        c for c in checkins
        if c.get("date") and date.fromisoformat(str(c.get("date"))[:10]) >= start_date
    ]
    
    # Calculate habit strengths
    habit_strengths = calculate_habit_strengths(recent_tasks, recent_checkins, start_date, today)
    
    # Detect risks
    risk_indicators = detect_habit_risks(recent_tasks, recent_checkins, start_date, today, habit_strengths)
    
    # Generate micro-suggestions
    micro_suggestions = generate_micro_suggestions(habit_strengths, risk_indicators, recent_tasks, recent_checkins)
    
    # Generate encouragement
    encouragement = generate_encouragement(habit_strengths, risk_indicators)
    
    return {
        "habit_strengths": habit_strengths,
        "risk_indicators": risk_indicators,
        "micro_suggestions": micro_suggestions,
        "encouragement": encouragement,
        "analysis_date": today.isoformat()
    }


def calculate_habit_strengths(
    tasks: List[Dict[str, Any]],
    checkins: List[Dict[str, Any]],
    start_date: date,
    end_date: date
) -> Dict[str, Any]:
    """Calculate strength scores for different habit dimensions."""
    total_days = (end_date - start_date).days + 1
    
    # 1. Check-in Consistency
    checkin_days = len(checkins)
    checkin_consistency = (checkin_days / total_days) * 100 if total_days > 0 else 0
    
    # 2. Task Completion Rate
    completed_tasks = sum(1 for t in tasks if t.get("completed", False))
    total_tasks = len(tasks)
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # 3. Daily Activity Consistency (days with at least one task)
    days_with_tasks = set()
    for task in tasks:
        task_date_str = task.get("date")
        if task_date_str:
            try:
                task_date = date.fromisoformat(str(task_date_str)[:10])
                if start_date <= task_date <= end_date:
                    days_with_tasks.add(task_date)
            except:
                pass
    activity_consistency = (len(days_with_tasks) / total_days * 100) if total_days > 0 else 0
    
    # 4. Streak Analysis
    checkin_streak = calculate_checkin_streak(checkins, end_date)
    completion_streak = calculate_completion_streak(tasks, end_date)
    
    # 5. Category Balance (variety in task categories)
    category_counts = Counter()
    for task in tasks:
        cat_id = task.get("category_id") or task.get("category") or task.get("value")
        if cat_id:
            category_counts[str(cat_id)] += 1
    
    category_variety = len(category_counts)
    category_balance_score = min(100, (len(category_counts) / 5) * 100) if category_counts else 0
    
    # 6. Energy Management (completion rate vs load)
    if tasks:
        high_energy_days = 0
        total_days_with_tasks = len(days_with_tasks)
        for day in days_with_tasks:
            day_tasks = [t for t in tasks if str(t.get("date", ""))[:10] == day.isoformat()]
            if day_tasks:
                day_completion = sum(1 for t in day_tasks if t.get("completed", False)) / len(day_tasks)
                # High energy = good completion rate (>= 70%)
                if day_completion >= 0.7:
                    high_energy_days += 1
        energy_management = (high_energy_days / total_days_with_tasks * 100) if total_days_with_tasks > 0 else 0
    else:
        energy_management = 0
    
    return {
        "checkin_consistency": round(checkin_consistency, 1),
        "completion_rate": round(completion_rate, 1),
        "activity_consistency": round(activity_consistency, 1),
        "category_balance": round(category_balance_score, 1),
        "energy_management": round(energy_management, 1),
        "checkin_streak": checkin_streak,
        "completion_streak": completion_streak,
        "overall_score": round(
            (checkin_consistency * 0.25 + 
             completion_rate * 0.25 + 
             activity_consistency * 0.20 + 
             category_balance_score * 0.15 + 
             energy_management * 0.15) / 100 * 100, 1
        )
    }


def calculate_checkin_streak(checkins: List[Dict[str, Any]], end_date: date) -> int:
    """Calculate current check-in streak."""
    if not checkins:
        return 0
    
    # Sort checkins by date
    checkin_dates = sorted([
        date.fromisoformat(str(c.get("date"))[:10])
        for c in checkins
        if c.get("date")
    ], reverse=True)
    
    if not checkin_dates:
        return 0
    
    # Check if streak is still active (most recent check-in is today or yesterday)
    most_recent = checkin_dates[0]
    if (end_date - most_recent).days > 1:
        return 0  # Streak broken
    
    # Count consecutive days
    streak = 1
    current_date = most_recent
    for checkin_date in checkin_dates[1:]:
        if (current_date - checkin_date).days == 1:
            streak += 1
            current_date = checkin_date
        else:
            break
    
    return streak


def calculate_completion_streak(tasks: List[Dict[str, Any]], end_date: date) -> int:
    """Calculate current completion streak (consecutive days with >= 70% completion)."""
    if not tasks:
        return 0
    
    # Group tasks by date
    tasks_by_date = defaultdict(list)
    for task in tasks:
        task_date_str = task.get("date")
        if task_date_str:
            try:
                task_date = date.fromisoformat(str(task_date_str)[:10])
                tasks_by_date[task_date].append(task)
            except:
                pass
    
    if not tasks_by_date:
        return 0
    
    # Sort dates
    sorted_dates = sorted(tasks_by_date.keys(), reverse=True)
    
    # Check if streak is active
    most_recent = sorted_dates[0]
    if (end_date - most_recent).days > 1:
        return 0
    
    # Count consecutive days with good completion
    streak = 0
    current_date = most_recent
    
    for task_date in sorted_dates:
        if task_date > current_date:
            continue
        if (current_date - task_date).days > 1:
            break
        
        day_tasks = tasks_by_date[task_date]
        if day_tasks:
            completion_rate = sum(1 for t in day_tasks if t.get("completed", False)) / len(day_tasks)
            if completion_rate >= 0.7:
                streak += 1
                current_date = task_date - timedelta(days=1)
            else:
                break
    
    return streak


def detect_habit_risks(
    tasks: List[Dict[str, Any]],
    checkins: List[Dict[str, Any]],
    start_date: date,
    end_date: date,
    habit_strengths: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Detect potential habit risks based on patterns."""
    risks = []
    
    # Risk 1: Declining check-in frequency
    if habit_strengths["checkin_consistency"] < 50:
        recent_checkins = [c for c in checkins if date.fromisoformat(str(c.get("date"))[:10]) >= start_date + timedelta(days=(end_date - start_date).days * 0.7)]
        early_checkins = [c for c in checkins if start_date <= date.fromisoformat(str(c.get("date"))[:10]) < start_date + timedelta(days=(end_date - start_date).days * 0.3)]
        
        if len(recent_checkins) < len(early_checkins) * 0.7:
            risks.append({
                "type": "declining_checkins",
                "severity": "high" if habit_strengths["checkin_consistency"] < 30 else "medium",
                "message": "Your check-in frequency has been declining",
                "context": f"Only {len(recent_checkins)} check-ins in recent period vs {len(early_checkins)} earlier"
            })
    
    # Risk 2: Low completion rate
    if habit_strengths["completion_rate"] < 60:
        risks.append({
            "type": "low_completion",
            "severity": "high" if habit_strengths["completion_rate"] < 40 else "medium",
            "message": "Task completion rate is below optimal",
            "context": f"Current completion rate: {habit_strengths['completion_rate']:.1f}%"
        })
    
    # Risk 3: Broken streak
    if habit_strengths["checkin_streak"] == 0 and len(checkins) > 0:
        risks.append({
            "type": "broken_streak",
            "severity": "medium",
            "message": "Your check-in streak has been interrupted",
            "context": "Consider restarting your daily check-in habit"
        })
    
    # Risk 4: Low activity consistency
    if habit_strengths["activity_consistency"] < 50:
        risks.append({
            "type": "low_activity",
            "severity": "medium",
            "message": "Inconsistent daily activity",
            "context": f"Active on only {habit_strengths['activity_consistency']:.1f}% of days"
        })
    
    # Risk 5: Category imbalance
    if habit_strengths["category_balance"] < 40:
        risks.append({
            "type": "category_imbalance",
            "severity": "low",
            "message": "Tasks are concentrated in few categories",
            "context": "Consider diversifying your activities"
        })
    
    # Risk 6: Energy management issues
    if habit_strengths["energy_management"] < 50:
        risks.append({
            "type": "energy_issues",
            "severity": "medium",
            "message": "Completion rate drops on busy days",
            "context": "Consider adjusting task load for better energy management"
        })
    
    return risks


def generate_micro_suggestions(
    habit_strengths: Dict[str, Any],
    risk_indicators: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
    checkins: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Generate personalized micro-action suggestions."""
    suggestions = []
    
    # Prioritize suggestions based on risks
    risk_types = {r["type"] for r in risk_indicators}
    
    # Suggestion 1: Check-in reminder
    if "declining_checkins" in risk_types or habit_strengths["checkin_consistency"] < 70:
        suggestions.append({
            "action": "schedule_checkin",
            "title": "Set a daily check-in reminder",
            "description": "Consistent check-ins help maintain awareness and momentum",
            "priority": "high" if "declining_checkins" in risk_types else "medium",
            "icon": "check-in"
        })
    
    # Suggestion 2: Task planning
    if "low_completion" in risk_types or habit_strengths["completion_rate"] < 70:
        suggestions.append({
            "action": "plan_tasks",
            "title": "Plan 2-3 tasks for today",
            "description": "Start with smaller, achievable tasks to build momentum",
            "priority": "high" if "low_completion" in risk_types else "medium",
            "icon": "plan"
        })
    
    # Suggestion 3: Streak recovery
    if "broken_streak" in risk_types:
        suggestions.append({
            "action": "restart_streak",
            "title": "Restart your check-in streak today",
            "description": "Every streak starts with a single day",
            "priority": "high",
            "icon": "streak"
        })
    
    # Suggestion 4: Category diversification
    if "category_imbalance" in risk_types:
        suggestions.append({
            "action": "diversify_categories",
            "title": "Add a task from a different category",
            "description": "Balance across life areas improves overall well-being",
            "priority": "low",
            "icon": "balance"
        })
    
    # Suggestion 5: Energy management
    if "energy_issues" in risk_types:
        suggestions.append({
            "action": "adjust_load",
            "title": "Review your task load for today",
            "description": "Consider moving non-essential tasks to lighter days",
            "priority": "medium",
            "icon": "energy"
        })
    
    # Positive reinforcement suggestions
    if not risk_indicators and habit_strengths["overall_score"] >= 75:
        suggestions.append({
            "action": "maintain_momentum",
            "title": "Keep up the great work!",
            "description": "Your habits are strong. Consider setting a new challenge",
            "priority": "low",
            "icon": "celebrate"
        })
    
    # Default suggestion if no specific risks
    if not suggestions:
        suggestions.append({
            "action": "maintain_consistency",
            "title": "Maintain your current momentum",
            "description": "Continue with your daily check-ins and task planning",
            "priority": "low",
            "icon": "maintain"
        })
    
    return suggestions[:5]  # Limit to 5 suggestions


def generate_encouragement(
    habit_strengths: Dict[str, Any],
    risk_indicators: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Generate context-aware encouragement message."""
    overall_score = habit_strengths.get("overall_score", 0)
    checkin_streak = habit_strengths.get("checkin_streak", 0)
    completion_streak = habit_strengths.get("completion_streak", 0)
    
    # High performance
    if overall_score >= 80 and not risk_indicators:
        return {
            "message": f"Your habits are thriving! You're maintaining {checkin_streak} day check-in streak and showing excellent consistency.",
            "tone": "celebratory",
            "emoji": "🌟"
        }
    
    # Good performance with minor risks
    if overall_score >= 60:
        if checkin_streak > 0:
            return {
                "message": f"You're on a {checkin_streak} day streak! Keep the momentum going with small, consistent actions.",
                "tone": "supportive",
                "emoji": "💪"
            }
        else:
            return {
                "message": "You're making good progress. A small step today can restart your momentum.",
                "tone": "encouraging",
                "emoji": "✨"
            }
    
    # Needs attention
    if risk_indicators:
        high_risks = [r for r in risk_indicators if r["severity"] == "high"]
        if high_risks:
            return {
                "message": "Every habit starts with awareness. Take one small action today to get back on track.",
                "tone": "gentle",
                "emoji": "🌱"
            }
        else:
            return {
                "message": "You're building your habits. Focus on consistency over perfection.",
                "tone": "supportive",
                "emoji": "🌿"
            }
    
    # Default
    return {
        "message": "Every day is a fresh start. Small, consistent actions build lasting habits.",
        "tone": "motivational",
        "emoji": "🌅"
    }

