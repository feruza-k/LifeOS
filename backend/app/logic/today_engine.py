# today_engine.py
# Returns tasks for a date, sorted by time, with energy/balance calculation.
# Frontend handles grouping (Scheduled vs Anytime).

from datetime import datetime
import pytz
from typing import Dict, List, Literal

from app.logic.task_engine import get_tasks_today

tz = pytz.timezone("Europe/London")

# Daily capacity constants for overload detection
# Capacity guardrail prevents single extreme-duration tasks (e.g., 13 hours) from being
# misclassified by the weighted load model, which caps individual task weights at 2.0
DAILY_CAPACITY_MINUTES = 480  # 8 hours - sustainable daily scheduled time
OVERLOAD_THRESHOLD = 1.3      # 130% of capacity - triggers hard overload rule


def calculate_energy(tasks: List[dict]) -> Dict[str, any]:
    """
    Calculate energy status using weighted task load model.
    
    Energy status represents the PLANNED LOAD for the day - how demanding the schedule is overall.
    This status is FIXED for the day and does NOT change based on task completion.
    Task completion affects progress visuals only, not the energy classification.
    
    Task weights:
    - Anytime task (no time) → weight = 0.5
    - Scheduled task ≤ 30 min → weight = 1
    - Scheduled task 30–90 min → weight = 1.5
    - Scheduled task > 90 min → weight = 2
    
    Status mapping (based on planned load only):
    - Effective Load ≤ 3 → space_available
    - Effective Load > 3 and ≤ 6 → balanced_pacing
    - Effective Load > 6 → prioritize_rest
    
    The status reflects demand vs capacity, helping users understand their planned load
    without judgment. Completion data is tracked separately for progress visualization.
    """
    effective_load = 0.0
    completed_load = 0.0
    total_scheduled_minutes = 0.0  # Track absolute scheduled time for capacity guardrail
    
    for task in tasks:
        # Determine task weight based on scheduling and duration
        if not task.get("time"):
            # Anytime task → weight = 0.5
            weight = 0.5
        else:
            # Scheduled task → weight based on duration
            duration_minutes = task.get("duration_minutes")
            
            # If duration not set, calculate from time/endTime/end_datetime if available
            # Priority: end_datetime (most accurate, handles cross-day) > duration_minutes > time/endTime
            if duration_minutes is None or duration_minutes <= 0:
                time = task.get("time")
                end_datetime = task.get("end_datetime")
                datetime_str = task.get("datetime")
                
                # Prefer end_datetime as it handles cross-day tasks correctly
                if datetime_str and end_datetime:
                    try:
                        start_dt = datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
                        end_dt = datetime.strptime(end_datetime, "%Y-%m-%d %H:%M")
                        duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
                    except (ValueError, TypeError, AttributeError):
                        pass
                
                # Fallback: calculate from time/endTime if end_datetime not available
                if duration_minutes is None or duration_minutes <= 0:
                    end_time = task.get("end_time") or task.get("endTime")
                    
                    # Extract time from end_datetime if available (format: "YYYY-MM-DD HH:MM")
                    if end_datetime and not end_time:
                        try:
                            end_dt = datetime.strptime(end_datetime, "%Y-%m-%d %H:%M")
                            end_time = end_dt.strftime("%H:%M")
                        except (ValueError, TypeError):
                            pass
                    
                    if time and end_time:
                        try:
                            # Parse time strings (format: "HH:MM")
                            start_h, start_m = map(int, time.split(":"))
                            end_h, end_m = map(int, end_time.split(":"))
                            start_total = start_h * 60 + start_m
                            end_total = end_h * 60 + end_m
                            duration_minutes = end_total - start_total
                            # Handle case where end time is next day (e.g., 23:00 to 01:00)
                            if duration_minutes < 0:
                                duration_minutes += 24 * 60
                        except (ValueError, AttributeError):
                            # Default to 60 minutes if parsing fails
                            duration_minutes = 60
                    else:
                        # Default to 60 minutes if no end time
                        duration_minutes = 60
            
            # Ensure duration_minutes is valid (should be positive)
            if duration_minutes is None or duration_minutes <= 0:
                duration_minutes = 60
            
            # Assign weight based on duration
            if duration_minutes <= 30:
                weight = 1.0
            elif duration_minutes <= 90:
                weight = 1.5
            else:  # > 90 minutes
                weight = 2.0
            
            # Track absolute scheduled minutes for capacity guardrail
            # This ensures extreme-duration days (e.g., single 13-hour task) are caught
            # Note: This uses the actual calculated duration_minutes, not the weight
            total_scheduled_minutes += duration_minutes
        
        # Add to effective load
        effective_load += weight
        
        # If task is completed, add to completed load
        if task.get("completed", False):
            completed_load += weight
    
    # Calculate completion ratio (for adjustment logic)
    completed_load_ratio = completed_load / effective_load if effective_load > 0 else 0.0
    
    # Capacity guardrail: Check if absolute scheduled time exceeds sustainable daily capacity
    # This prevents single extreme-duration tasks (e.g., 13 hours) from being misclassified.
    # The weighted load model caps individual task weights at 2.0, which could allow a
    # 13-hour task (780 minutes = 520% of capacity) to only contribute 2.0 to effective load.
    load_ratio = total_scheduled_minutes / DAILY_CAPACITY_MINUTES if DAILY_CAPACITY_MINUTES > 0 else 0.0
    
    # Hard overload rule: Force prioritize_rest if scheduled time exceeds threshold
    # This runs BEFORE the weighted load mapping to catch extreme cases
    # Example: 14-hour task (840 min) / 480 min = 1.75 >= 1.3 → prioritize_rest
    if load_ratio >= OVERLOAD_THRESHOLD:
        status: Literal["space_available", "balanced_pacing", "prioritize_rest"] = "prioritize_rest"
    else:
        # Standard weighted load mapping (existing logic)
        if effective_load <= 3:
            status = "space_available"
        elif effective_load <= 6:
            status = "balanced_pacing"
        else:
            status = "prioritize_rest"
    
    # Energy status is based on PLANNED LOAD only, not completion
    # The status represents how demanding today's plan is overall and remains fixed for the day
    # Task completion affects progress visuals only, not the energy classification
    
    return {
        "status": status,
        "effectiveLoad": round(effective_load, 2),
        "completedLoadRatio": round(completed_load_ratio, 3)
    }


def get_today_view() -> dict:
    """
    Return tasks for today, sorted by time, with energy calculation.
    Tasks without time come after tasks with time.
    """
    tasks = get_tasks_today()
    
    # Sort: tasks with time first (by time), then tasks without time
    tasks_with_time = sorted(
        [t for t in tasks if t.get("time")],
        key=lambda x: x.get("time", "")
    )
    tasks_without_time = [t for t in tasks if not t.get("time")]
    
    sorted_tasks = tasks_with_time + tasks_without_time

    # Calculate energy using weighted task load model
    energy = calculate_energy(sorted_tasks)

    # Legacy load field (kept for backward compatibility, but deprecated)
    total_tasks = len(sorted_tasks)
    if total_tasks == 0:
        load = "empty"
    elif total_tasks <= 2:
        load = "light"
    elif total_tasks <= 5:
        load = "medium"
    else:
        load = "heavy"

    return {
        "date": datetime.now(tz).strftime("%Y-%m-%d"),
        "tasks": sorted_tasks,
        "load": load,  # Deprecated, use energy.status instead
        "energy": energy
    }
