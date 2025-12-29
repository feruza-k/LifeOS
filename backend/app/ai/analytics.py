# app/ai/analytics.py
"""
Sophisticated analytics for Align page.
Provides historical trends, comparisons, and accurate progress tracking.
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta, date
from collections import defaultdict
import pytz
import logging

logger = logging.getLogger(__name__)
tz = pytz.timezone("Europe/London")


def get_week_boundaries(target_date: date) -> Tuple[date, date]:
    """Get Monday-Sunday boundaries for a given date."""
    # Find Monday of the week
    days_since_monday = target_date.weekday()  # 0 = Monday, 6 = Sunday
    week_start = target_date - timedelta(days=days_since_monday)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def get_month_boundaries(target_date: date) -> Tuple[date, date]:
    """Get first and last day of month for a given date."""
    month_start = date(target_date.year, target_date.month, 1)
    # Get last day of month
    if target_date.month == 12:
        month_end = date(target_date.year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(target_date.year, target_date.month + 1, 1) - timedelta(days=1)
    return month_start, month_end


def calculate_week_metrics(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], week_start: date, week_end: date) -> Dict[str, Any]:
    """
    Calculate comprehensive metrics for a specific week.
    Returns: tasks_planned, tasks_completed, completion_rate, categories, energy_distribution
    """
    week_tasks = []
    for task in tasks:
        task_date_str = task.get("date")
        if task_date_str:
            try:
                if len(task_date_str) > 10:
                    task_date_str = task_date_str[:10]
                task_date = date.fromisoformat(task_date_str)
                if week_start <= task_date <= week_end:
                    week_tasks.append(task)
            except (ValueError, TypeError):
                continue
    
    # Count planned vs completed
    tasks_planned = len(week_tasks)
    tasks_completed = sum(1 for t in week_tasks if t.get("completed", False))
    
    # Also use check-ins for more accurate completion tracking
    week_checkins = []
    for checkin in checkins:
        checkin_date_str = checkin.get("date")
        if checkin_date_str:
            try:
                checkin_date = date.fromisoformat(checkin_date_str[:10])
                if week_start <= checkin_date <= week_end:
                    week_checkins.append(checkin)
            except (ValueError, TypeError):
                continue
    
    # Calculate completion from check-ins (more accurate)
    total_completed_from_checkins = 0
    total_planned_from_checkins = 0
    for checkin in week_checkins:
        completed_ids = checkin.get("completedTaskIds", [])
        incomplete_ids = checkin.get("incompleteTaskIds", [])
        total_planned_from_checkins += len(completed_ids) + len(incomplete_ids)
        total_completed_from_checkins += len(completed_ids)
    
    # Use check-in data if available (more accurate), otherwise use task completion flags
    if total_planned_from_checkins > 0:
        tasks_completed = total_completed_from_checkins
        tasks_planned = total_planned_from_checkins
    
    completion_rate = tasks_completed / tasks_planned if tasks_planned > 0 else 0.0
    
    # Category distribution
    category_dist = defaultdict(int)
    for task in week_tasks:
        cat = task.get("category")
        if cat:
            category_dist[cat] += 1
    
    # Energy distribution (from check-ins if available)
    energy_dist = defaultdict(int)
    for checkin in week_checkins:
        # Energy would come from task load calculation, but for now we'll infer from task count
        day_tasks = len(checkin.get("completedTaskIds", [])) + len(checkin.get("incompleteTaskIds", []))
        if day_tasks == 0:
            energy_dist["empty"] += 1
        elif day_tasks <= 3:
            energy_dist["light"] += 1
        elif day_tasks <= 6:
            energy_dist["balanced"] += 1
        else:
            energy_dist["heavy"] += 1
    
    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "tasks_planned": tasks_planned,
        "tasks_completed": tasks_completed,
        "completion_rate": completion_rate,
        "categories": dict(category_dist),
        "energy_distribution": dict(energy_dist),
        "checkins_count": len(week_checkins)
    }


def calculate_month_metrics(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], month_start: date, month_end: date) -> Dict[str, Any]:
    """Calculate comprehensive metrics for a specific month."""
    month_tasks = []
    for task in tasks:
        task_date_str = task.get("date")
        if task_date_str:
            try:
                if len(task_date_str) > 10:
                    task_date_str = task_date_str[:10]
                task_date = date.fromisoformat(task_date_str)
                if month_start <= task_date <= month_end:
                    month_tasks.append(task)
            except (ValueError, TypeError):
                continue
    
    tasks_planned = len(month_tasks)
    tasks_completed = sum(1 for t in month_tasks if t.get("completed", False))
    
    # Use check-ins for accuracy
    month_checkins = []
    for checkin in checkins:
        checkin_date_str = checkin.get("date")
        if checkin_date_str:
            try:
                checkin_date = date.fromisoformat(checkin_date_str[:10])
                if month_start <= checkin_date <= month_end:
                    month_checkins.append(checkin)
            except (ValueError, TypeError):
                continue
    
    total_completed_from_checkins = 0
    total_planned_from_checkins = 0
    for checkin in month_checkins:
        completed_ids = checkin.get("completedTaskIds", [])
        incomplete_ids = checkin.get("incompleteTaskIds", [])
        total_planned_from_checkins += len(completed_ids) + len(incomplete_ids)
        total_completed_from_checkins += len(completed_ids)
    
    if total_planned_from_checkins > 0:
        tasks_completed = total_completed_from_checkins
        tasks_planned = total_planned_from_checkins
    
    completion_rate = tasks_completed / tasks_planned if tasks_planned > 0 else 0.0
    
    # Category distribution
    category_dist = defaultdict(int)
    for task in month_tasks:
        cat = task.get("category")
        if cat:
            category_dist[cat] += 1
    
    return {
        "month": month_start.strftime("%Y-%m"),
        "month_start": month_start.isoformat(),
        "month_end": month_end.isoformat(),
        "tasks_planned": tasks_planned,
        "tasks_completed": tasks_completed,
        "completion_rate": completion_rate,
        "categories": dict(category_dist),
        "checkins_count": len(month_checkins)
    }


def calculate_completion_trends(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], weeks: int = 4) -> List[Dict[str, Any]]:
    """
    Calculate completion rate trends for the last N weeks.
    Returns list of week metrics in chronological order (oldest first).
    """
    today = datetime.now(tz).date()
    trends = []
    
    for i in range(weeks - 1, -1, -1):  # Go back N weeks, starting from oldest
        week_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(week_date)
        week_metrics = calculate_week_metrics(tasks, checkins, week_start, week_end)
        trends.append(week_metrics)
    
    return trends


def calculate_monthly_trends(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], months: int = 2) -> List[Dict[str, Any]]:
    """
    Calculate metrics for the last N months.
    Returns list of month metrics in chronological order (oldest first).
    """
    today = datetime.now(tz).date()
    trends = []
    
    for i in range(months - 1, -1, -1):  # Go back N months, starting from oldest
        # Calculate month date by going back i months from today
        month_date = today
        for _ in range(i):
            # Go back one month
            if month_date.month == 1:
                month_date = date(month_date.year - 1, 12, month_date.day)
            else:
                month_date = date(month_date.year, month_date.month - 1, month_date.day)
        
        month_start, month_end = get_month_boundaries(month_date)
        month_metrics = calculate_month_metrics(tasks, checkins, month_start, month_end)
        trends.append(month_metrics)
    
    return trends


def compare_weeks(current_week: Dict[str, Any], previous_week: Dict[str, Any]) -> Dict[str, Any]:
    """Compare two weeks and return delta metrics."""
    if not previous_week or previous_week.get("tasks_planned", 0) == 0:
        return {
            "tasks_delta": current_week.get("tasks_planned", 0),
            "completion_delta": current_week.get("completion_rate", 0),
            "has_comparison": False
        }
    
    tasks_delta = current_week.get("tasks_planned", 0) - previous_week.get("tasks_planned", 0)
    completion_delta = current_week.get("completion_rate", 0) - previous_week.get("completion_rate", 0)
    
    # Category shifts
    current_cats = current_week.get("categories", {})
    prev_cats = previous_week.get("categories", {})
    category_shifts = {}
    all_categories = set(list(current_cats.keys()) + list(prev_cats.keys()))
    
    for cat in all_categories:
        current_count = current_cats.get(cat, 0)
        prev_count = prev_cats.get(cat, 0)
        if current_count != prev_count:
            category_shifts[cat] = {
                "current": current_count,
                "previous": prev_count,
                "delta": current_count - prev_count
            }
    
    return {
        "tasks_delta": tasks_delta,
        "completion_delta": completion_delta,
        "completion_delta_percentage": completion_delta * 100,
        "category_shifts": category_shifts,
        "has_comparison": True
    }


def compare_months(current_month: Dict[str, Any], previous_month: Dict[str, Any]) -> Dict[str, Any]:
    """Compare two months and return delta metrics."""
    if not previous_month or previous_month.get("tasks_planned", 0) == 0:
        return {
            "tasks_delta": current_month.get("tasks_planned", 0),
            "completion_delta": current_month.get("completion_rate", 0),
            "has_comparison": False
        }
    
    tasks_delta = current_month.get("tasks_planned", 0) - previous_month.get("tasks_planned", 0)
    completion_delta = current_month.get("completion_rate", 0) - previous_month.get("completion_rate", 0)
    
    # Category shifts
    current_cats = current_month.get("categories", {})
    prev_cats = previous_month.get("categories", {})
    category_shifts = {}
    all_categories = set(list(current_cats.keys()) + list(prev_cats.keys()))
    
    for cat in all_categories:
        current_count = current_cats.get(cat, 0)
        prev_count = prev_cats.get(cat, 0)
        if current_count != prev_count:
            category_shifts[cat] = {
                "current": current_count,
                "previous": prev_count,
                "delta": current_count - prev_count
            }
    
    return {
        "tasks_delta": tasks_delta,
        "completion_delta": completion_delta,
        "completion_delta_percentage": completion_delta * 100,
        "category_shifts": category_shifts,
        "has_comparison": True
    }


def detect_category_drift(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], weeks: int = 4) -> Dict[str, Any]:
    """
    Detect if certain categories are being consistently avoided or postponed.
    Returns drift indicators for each category.
    """
    today = datetime.now(tz).date()
    category_stats = defaultdict(lambda: {"planned": 0, "completed": 0, "postponed": 0})
    
    # Analyze last N weeks
    for i in range(weeks):
        week_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(week_date)
        
        week_tasks = []
        for task in tasks:
            task_date_str = task.get("date")
            if task_date_str:
                try:
                    if len(task_date_str) > 10:
                        task_date_str = task_date_str[:10]
                    task_date = date.fromisoformat(task_date_str)
                    if week_start <= task_date <= week_end:
                        week_tasks.append(task)
                except (ValueError, TypeError):
                    continue
        
        # Count by category
        for task in week_tasks:
            cat = task.get("category")
            if cat:
                category_stats[cat]["planned"] += 1
                if task.get("completed", False):
                    category_stats[cat]["completed"] += 1
                else:
                    # Check if it was moved/rescheduled
                    if task.get("moved_from") or task.get("rescheduled"):
                        category_stats[cat]["postponed"] += 1
    
    # Calculate drift indicators
    drift_indicators = {}
    for cat, stats in category_stats.items():
        if stats["planned"] > 0:
            completion_rate = stats["completed"] / stats["planned"]
            postpone_rate = stats["postponed"] / stats["planned"] if stats["planned"] > 0 else 0
            
            # Flag if completion is low AND postpone rate is high
            if completion_rate < 0.5 and postpone_rate > 0.3:
                drift_indicators[cat] = {
                    "severity": "high",
                    "completion_rate": completion_rate,
                    "postpone_rate": postpone_rate,
                    "message": f"{cat.capitalize()} tasks are being postponed frequently"
                }
            elif completion_rate < 0.6 and postpone_rate > 0.2:
                drift_indicators[cat] = {
                    "severity": "medium",
                    "completion_rate": completion_rate,
                    "postpone_rate": postpone_rate,
                    "message": f"{cat.capitalize()} tasks show some drift"
                }
    
    return {
        "drift_indicators": drift_indicators,
        "category_stats": dict(category_stats)
    }


def calculate_consistency_metrics(checkins: List[Dict[str, Any]], days_back: int = 30) -> Dict[str, Any]:
    """
    Calculate consistency metrics: check-in frequency, streaks, etc.
    Not gamified - just data.
    """
    today = datetime.now(tz).date()
    cutoff_date = today - timedelta(days=days_back)
    
    recent_checkins = [
        c for c in checkins
        if c.get("date") and date.fromisoformat(c["date"][:10]) >= cutoff_date
    ]
    
    if not recent_checkins:
        return {
            "checkin_frequency": 0.0,
            "days_with_checkins": 0,
            "total_days": days_back,
            "consistency_rate": 0.0,
            "current_streak": 0
        }
    
    # Count unique days with check-ins
    checkin_dates = set()
    for checkin in recent_checkins:
        checkin_date_str = checkin.get("date")
        if checkin_date_str:
            try:
                checkin_date = date.fromisoformat(checkin_date_str[:10])
                checkin_dates.add(checkin_date)
            except (ValueError, TypeError):
                continue
    
    days_with_checkins = len(checkin_dates)
    consistency_rate = days_with_checkins / days_back if days_back > 0 else 0.0
    
    # Calculate current streak (consecutive days with check-ins, ending today)
    current_streak = 0
    check_date = today
    while check_date >= cutoff_date:
        if check_date in checkin_dates:
            current_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    return {
        "checkin_frequency": consistency_rate,
        "days_with_checkins": days_with_checkins,
        "total_days": days_back,
        "consistency_rate": consistency_rate,
        "current_streak": current_streak
    }


def calculate_energy_patterns(tasks: List[Dict[str, Any]], checkins: List[Dict[str, Any]], weeks: int = 4) -> Dict[str, Any]:
    """
    Analyze energy patterns over time with detailed insights.
    Energy is inferred from task load, completion rates, and check-in data.
    """
    from datetime import datetime, timedelta, date
    from collections import defaultdict
    
    today = datetime.now(tz).date()
    energy_by_week = []
    daily_patterns = []
    
    # Get tasks by date for better analysis
    tasks_by_date = defaultdict(list)
    for task in tasks:
        task_date_str = task.get("date")
        if task_date_str:
            try:
                task_date = date.fromisoformat(task_date_str[:10])
                tasks_by_date[task_date].append(task)
            except (ValueError, TypeError):
                continue
    
    for i in range(weeks):
        week_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(week_date)
        
        week_checkins = []
        week_tasks = []
        for checkin in checkins:
            checkin_date_str = checkin.get("date")
            if checkin_date_str:
                try:
                    checkin_date = date.fromisoformat(checkin_date_str[:10])
                    if week_start <= checkin_date <= week_end:
                        week_checkins.append(checkin)
                except (ValueError, TypeError):
                    continue
        
        # Get tasks for this week
        for d in range(7):
            day_date = week_start + timedelta(days=d)
            if day_date in tasks_by_date:
                week_tasks.extend(tasks_by_date[day_date])
        
        # Calculate detailed metrics
        daily_loads = []
        daily_completions = []
        daily_energy_scores = []
        
        for checkin in week_checkins:
            completed = len(checkin.get("completedTaskIds", []))
            incomplete = len(checkin.get("incompleteTaskIds", []))
            total = completed + incomplete
            daily_loads.append(total)
            
            completion_rate = completed / total if total > 0 else 0
            daily_completions.append(completion_rate)
            
            # Energy score: combination of load and completion (0-100)
            # Higher load with good completion = high energy
            # Low load = low energy (unless very high completion)
            if total == 0:
                energy_score = 0
            elif total <= 3:
                energy_score = 30 + (completion_rate * 20)  # 30-50
            elif total <= 6:
                energy_score = 50 + (completion_rate * 30)  # 50-80
            else:
                energy_score = 70 + (completion_rate * 20)  # 70-90
            daily_energy_scores.append(min(100, energy_score))
        
        # Also analyze tasks directly if check-ins are sparse
        if len(week_checkins) < 3 and week_tasks:
            for day_date in [week_start + timedelta(days=d) for d in range(7)]:
                day_tasks = tasks_by_date.get(day_date, [])
                if day_tasks:
                    total = len(day_tasks)
                    completed = sum(1 for t in day_tasks if t.get("completed", False))
                    daily_loads.append(total)
                    completion_rate = completed / total if total > 0 else 0
                    daily_completions.append(completion_rate)
                    # Calculate energy score for tasks too
                    if total == 0:
                        energy_score = 0
                    elif total <= 3:
                        energy_score = 30 + (completion_rate * 20)
                    elif total <= 6:
                        energy_score = 50 + (completion_rate * 30)
                    else:
                        energy_score = 70 + (completion_rate * 20)
                    daily_energy_scores.append(min(100, energy_score))
        
        avg_daily_load = sum(daily_loads) / len(daily_loads) if daily_loads else 0
        avg_completion_rate = sum(daily_completions) / len(daily_completions) if daily_completions else 0
        avg_energy_score = sum(daily_energy_scores) / len(daily_energy_scores) if daily_energy_scores else 0
        
        # Classify energy level with more nuance
        if avg_daily_load == 0:
            energy_level = "empty"
        elif avg_daily_load <= 2:
            energy_level = "very_light"
        elif avg_daily_load <= 4:
            energy_level = "light"
        elif avg_daily_load <= 6:
            energy_level = "balanced"
        elif avg_daily_load <= 8:
            energy_level = "moderate"
        else:
            energy_level = "heavy"
        
        # Determine trend
        trend = "stable"
        if i < weeks - 1 and len(energy_by_week) > 0:
            prev_load = energy_by_week[-1].get("average_daily_load", 0)
            if avg_daily_load > prev_load * 1.2:
                trend = "increasing"
            elif avg_daily_load < prev_load * 0.8:
                trend = "decreasing"
        
        energy_by_week.append({
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "average_daily_load": round(avg_daily_load, 1),
            "average_completion_rate": round(avg_completion_rate, 2),
            "average_energy_score": round(avg_energy_score, 1),
            "energy_level": energy_level,
            "days_tracked": len(week_checkins),
            "total_tasks": len(week_tasks),
            "completed_tasks": sum(1 for t in week_tasks if t.get("completed", False))
        })
    
    # Calculate overall trend
    overall_trend = "stable"
    if len(energy_by_week) >= 2:
        recent_load = energy_by_week[0].get("average_daily_load", 0)
        older_load = energy_by_week[-1].get("average_daily_load", 0)
        if recent_load > older_load * 1.15:
            overall_trend = "increasing"
        elif recent_load < older_load * 0.85:
            overall_trend = "decreasing"
    
    # Daily breakdown for current week
    current_week_start, current_week_end = get_week_boundaries(today)
    for d in range(7):
        day_date = current_week_start + timedelta(days=d)
        day_tasks = tasks_by_date.get(day_date, [])
        day_checkins = [c for c in checkins if c.get("date", "")[:10] == day_date.isoformat()]
        
        total = len(day_tasks)
        completed = sum(1 for t in day_tasks if t.get("completed", False))
        completion_rate = completed / total if total > 0 else 0
        
        # Get energy from check-in if available
        energy_level = "unknown"
        if day_checkins:
            checkin = day_checkins[0]
            completed_count = len(checkin.get("completedTaskIds", []))
            incomplete_count = len(checkin.get("incompleteTaskIds", []))
            checkin_total = completed_count + incomplete_count
            
            if checkin_total == 0:
                energy_level = "empty"
            elif checkin_total <= 2:
                energy_level = "very_light"
            elif checkin_total <= 4:
                energy_level = "light"
            elif checkin_total <= 6:
                energy_level = "balanced"
            elif checkin_total <= 8:
                energy_level = "moderate"
            else:
                energy_level = "heavy"
        elif total > 0:
            if total <= 2:
                energy_level = "very_light"
            elif total <= 4:
                energy_level = "light"
            elif total <= 6:
                energy_level = "balanced"
            elif total <= 8:
                energy_level = "moderate"
            else:
                energy_level = "heavy"
        
        daily_patterns.append({
            "date": day_date.isoformat(),
            "day_name": day_date.strftime("%A"),
            "total_tasks": total,
            "completed_tasks": completed,
            "completion_rate": round(completion_rate, 2),
            "energy_level": energy_level
        })
    
    return {
        "weekly_patterns": list(reversed(energy_by_week)),  # Oldest first
        "daily_patterns": daily_patterns,
        "trend": overall_trend,
        "insights": _generate_energy_insights(energy_by_week, daily_patterns)
    }

def _generate_energy_insights(weekly_patterns: List[Dict], daily_patterns: List[Dict]) -> List[str]:
    """Generate actionable insights from energy patterns."""
    insights = []
    
    if not weekly_patterns:
        return ["Not enough data to analyze energy patterns yet."]
    
    # Check for burnout risk
    recent_weeks = weekly_patterns[-2:] if len(weekly_patterns) >= 2 else weekly_patterns
    heavy_weeks = sum(1 for w in recent_weeks if w.get("energy_level") in ["heavy", "moderate"])
    if heavy_weeks == len(recent_weeks) and len(recent_weeks) >= 2:
        insights.append("You've been maintaining a high load consistently. Consider scheduling lighter days.")
    
    # Check for low energy
    light_weeks = sum(1 for w in recent_weeks if w.get("energy_level") in ["very_light", "light", "empty"])
    if light_weeks == len(recent_weeks):
        insights.append("Your load has been lighter recently. You might have capacity for more.")
    
    # Check completion rate vs load
    for week in recent_weeks:
        load = week.get("average_daily_load", 0)
        completion = week.get("average_completion_rate", 0)
        if load > 6 and completion < 0.6:
            insights.append("High task load with lower completion suggests you might be overcommitting.")
            break
    
    # Daily pattern insights
    if daily_patterns:
        weekday_loads = [d["total_tasks"] for d in daily_patterns if d["day_name"] not in ["Saturday", "Sunday"]]
        weekend_loads = [d["total_tasks"] for d in daily_patterns if d["day_name"] in ["Saturday", "Sunday"]]
        
        if weekday_loads and weekend_loads:
            avg_weekday = sum(weekday_loads) / len(weekday_loads)
            avg_weekend = sum(weekend_loads) / len(weekend_loads)
            if avg_weekend > avg_weekday * 0.8:
                insights.append("You're maintaining similar load on weekends. Consider lighter weekends for recovery.")
    
    if not insights:
        insights.append("Your energy patterns look balanced. Keep up the good work!")
    
    return insights[:3]  # Max 3 insights

