# frontend_adapter.py
# Transforms backend data structures to match frontend expectations

from datetime import datetime
from typing import Optional, Dict, Any, List

def backend_task_to_frontend(backend_task: Dict[str, Any], category_label_to_id: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Transform backend task format to frontend Task format.
    
    Backend: {id, type, title, date, time, duration_minutes, end_datetime, category, notes, completed, energy, context}
    Frontend: {id, title, time?, endTime?, completed, value, date, createdAt, movedFrom?}
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Calculate endTime from duration_minutes or end_datetime
    end_time = None
    if backend_task.get("end_datetime"):
        # Extract time from end_datetime - handle both ISO format (with T) and space-separated format
        try:
            end_dt_str = backend_task["end_datetime"]
            if isinstance(end_dt_str, str):
                # Handle ISO format: "2025-12-20T14:30:00" or "2025-12-20T14:30:00.000000" or "2025-12-20T14:30:00.000Z"
                if "T" in end_dt_str:
                    # Remove timezone info if present (Z or +HH:MM)
                    end_dt_str = end_dt_str.split("+")[0].split("Z")[0]
                    # Handle microseconds - remove if present
                    if "." in end_dt_str:
                        # Keep only up to seconds: "2025-12-20T14:30:00"
                        parts = end_dt_str.split(".")
                        end_dt_str = parts[0]
                    try:
                        end_dt = datetime.fromisoformat(end_dt_str)
                    except ValueError:
                        # Fallback: try parsing with strptime
                        end_dt = datetime.strptime(end_dt_str, "%Y-%m-%dT%H:%M:%S")
                # Handle space-separated format: "2025-12-20 14:30"
                elif " " in end_dt_str:
                    # Try with seconds first, then without
                    try:
                        end_dt = datetime.strptime(end_dt_str, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        end_dt = datetime.strptime(end_dt_str, "%Y-%m-%d %H:%M")
                else:
                    # Try ISO format without T
                    end_dt = datetime.fromisoformat(end_dt_str)
                end_time = end_dt.strftime("%H:%M")
            elif hasattr(end_dt_str, 'strftime'):
                # Already a datetime object
                end_time = end_dt_str.strftime("%H:%M")
        except Exception as e:
            logger.warning(f"Failed to parse end_datetime '{backend_task.get('end_datetime')}': {e}")
            pass
    elif backend_task.get("time") and backend_task.get("duration_minutes"):
        # Calculate end time from start time + duration
        try:
            start_hour, start_min = map(int, backend_task["time"].split(":"))
            duration = backend_task["duration_minutes"]
            total_minutes = start_hour * 60 + start_min + duration
            end_hour = (total_minutes // 60) % 24
            end_min = total_minutes % 60
            end_time = f"{end_hour:02d}:{end_min:02d}"
        except:
            pass
    elif backend_task.get("time") and not end_time:
        # If task has time but no endTime, use default 1-hour duration
        try:
            start_hour, start_min = map(int, backend_task["time"].split(":"))
            total_minutes = start_hour * 60 + start_min + 60  # Default 1 hour
            end_hour = (total_minutes // 60) % 24
            end_min = total_minutes % 60
            end_time = f"{end_hour:02d}:{end_min:02d}"
        except:
            pass
    
    # Map backend category to frontend ValueType
    # Frontend expects category ID as the value
    # Backend provides category_id (UUID string) and category (label string)
    # Use category_id if available (database categories use UUIDs), otherwise look up by label
    category_id = backend_task.get("category_id")
    category = backend_task.get("category", "other")
    
    if category_id:
        value = category_id
    elif category_label_to_id and category:
        # Look up category UUID by label (case-insensitive)
        category_lower = category.lower()
        if category_lower in category_label_to_id:
            value = category_label_to_id[category_lower]
        else:
            # Category label not found in database categories - use fallback mapping
            # This handles legacy category names that don't match database labels
            available_labels = list(category_label_to_id.keys())
            logger.warning(f"Category label '{category}' not found in mapping")
            
            # Map legacy category labels to database category labels, then look up UUID
            category_label_mapping = {
                "personal": "growth",  # Personal development -> Growth
                "social": "family",    # Social -> Family
                "travel": "growth",    # Travel -> Growth
                "errands": "work",     # Errands -> Work
                "study": "growth",     # Study -> Growth
                "other": "growth",     # Other -> Growth
            }
            
            # Try to map to a known database label
            mapped_label = category_label_mapping.get(category_lower, category_lower)
            if mapped_label in category_label_to_id:
                value = category_label_to_id[mapped_label]
            else:
                # Last resort: use label as value (frontend will try to match by label)
                value = mapped_label
                logger.warning(f"Could not map '{category}' to any database category")
    else:
        # Fallback: Map category label to frontend ValueType (for backward compatibility with old data)
        # This mapping ensures tasks show the correct category color bar when category_id is missing
        category_to_value = {
            "health": "health",
            "work": "work",
            "personal": "growth",  # Personal development -> growth
            "social": "family",    # Social -> family
            "family": "family",
            "travel": "growth",    # Travel -> growth
            "errands": "work",     # Errands -> work
            "study": "growth",     # Study -> growth
            "creativity": "creativity",
            "growth": "growth",
            "other": "growth",     # Default fallback
        }
        value = category_to_value.get(category.lower() if category else "other", "growth")
    
    # Get createdAt - use current time if not present (for backward compatibility)
    created_at = backend_task.get("created_at") or backend_task.get("createdAt")
    if not created_at:
        # Try to infer from id if it's a timestamp
        created_at = datetime.now().isoformat()
    
    # Extract date from backend_task - prioritize date field, fallback to datetime
    task_date = backend_task.get("date")
    if not task_date:
        # Try to extract from datetime if date is not available
        if backend_task.get("datetime"):
            dt_str = backend_task["datetime"]
            if isinstance(dt_str, str):
                # Handle ISO format datetime strings
                if "T" in dt_str:
                    task_date = dt_str.split("T")[0]
                elif " " in dt_str:
                    task_date = dt_str.split(" ")[0]
                else:
                    task_date = dt_str
            else:
                # datetime object
                task_date = dt_str.strftime("%Y-%m-%d")
        else:
            task_date = datetime.now().strftime("%Y-%m-%d")
    elif isinstance(task_date, str) and "T" in task_date:
        # Handle ISO date strings
        task_date = task_date.split("T")[0]
    elif isinstance(task_date, str) and len(task_date) > 10:
        # Handle other date formats - take first 10 characters (YYYY-MM-DD)
        task_date = task_date[:10]
    
    # Extract time - only if it's not midnight (00:00), which indicates an "anytime" task
    task_time = backend_task.get("time")
    
    # If time is missing or is "00:00", try to extract from datetime
    if task_time == "00:00" or (not task_time and backend_task.get("datetime")):
        dt_str = backend_task.get("datetime")
        if dt_str:
            try:
                if isinstance(dt_str, str):
                    # Extract time from datetime string
                    if "T" in dt_str:
                        # ISO format: "2025-01-15T14:30:00" or "2025-01-15T14:30:00.000Z"
                        time_str = dt_str.split("T")[1]
                        # Remove timezone info if present (Z or +HH:MM)
                        time_str = time_str.split("+")[0].split("Z")[0]
                        # Remove microseconds if present
                        if "." in time_str:
                            time_str = time_str.split(".")[0]
                        # Extract HH:MM (first two parts)
                        time_parts = time_str.split(":")[:2]
                        extracted_time = ":".join(time_parts)
                        if extracted_time == "00:00":
                            task_time = None
                        else:
                            task_time = extracted_time
                    elif " " in dt_str:
                        # Space-separated format: "2025-01-15 14:30:00" or "2025-01-15 14:30"
                        time_str = dt_str.split(" ")[1]
                        # Extract HH:MM (first two parts)
                        time_parts = time_str.split(":")[:2]
                        extracted_time = ":".join(time_parts)
                        if extracted_time == "00:00":
                            task_time = None
                        else:
                            task_time = extracted_time
                else:
                    # datetime object
                    extracted_time = dt_str.strftime("%H:%M")
                    if extracted_time == "00:00":
                        task_time = None
                    else:
                        task_time = extracted_time
            except Exception as e:
                logger.warning(f"Failed to extract time from datetime '{dt_str}': {e}")
                pass
    
    result = {
        "id": backend_task["id"],
        "title": backend_task["title"],
        "time": task_time if task_time and task_time != "00:00" else None,
        "endTime": end_time,
        "completed": backend_task.get("completed", False),
        "value": value,
        "date": task_date,
        "createdAt": created_at,
        "movedFrom": backend_task.get("moved_from") or backend_task.get("movedFrom"),
    }
    
    if not result.get("date"):
        logger.warning(f"Task {result['id']} missing date field")
    if not result.get("endTime") and backend_task.get("end_datetime"):
        logger.warning(f"Task {result['id']} has end_datetime but endTime is None")
    if not result.get("value"):
        logger.warning(f"Task {result['id']} missing value field")
    
    return result

def frontend_task_to_backend(frontend_task: Dict[str, Any], task_type: str = "event") -> Dict[str, Any]:
    """
    Transform frontend task format to backend Task format.
    
    Frontend: {id?, title, time?, endTime?, completed, value, date, createdAt?, movedFrom?}
    Backend: {id, type, title, date, time, duration_minutes?, end_datetime?, category, completed, ...}
    """
    # Map frontend ValueType to backend category
    # Frontend: "health" | "growth" | "family" | "work" | "creativity"
    # Backend: "health", "work", "personal", "social", etc.
    frontend_value = frontend_task.get("value", "growth")
    value_to_category = {
        "health": "health",
        "work": "work",
        "family": "family",
        "growth": "personal",  # Growth -> personal development
        "creativity": "creativity",
    }
    category = value_to_category.get(frontend_value, "personal")
    
    datetime_str = None
    if frontend_task.get("date") and frontend_task.get("time"):
        datetime_str = f"{frontend_task['date']} {frontend_task['time']}"
    # Do NOT set datetime to 00:00 for anytime tasks - leave it as None

    # Extract time explicitly
    task_time = frontend_task.get("time")
    if not task_time and datetime_str:
        # fallback from datetime
        try:
            task_time = datetime_str.split(" ")[1][:5]
        except:
            task_time = None

    backend_task = {
        "type": task_type,
        "title": frontend_task["title"],
        "date": frontend_task.get("date"),
        "time": task_time,
        "datetime": datetime_str,
        "completed": frontend_task.get("completed", False),
        "category": category,
    }

    backend_task["date"] = frontend_task["date"][:10]
    
    # Add id if provided
    if frontend_task.get("id"):
        backend_task["id"] = frontend_task["id"]
    
    # Preserve user_id if provided (required for user-scoped tasks)
    if "user_id" in frontend_task:
        backend_task["user_id"] = frontend_task["user_id"]
    
    # Calculate duration from time and endTime
    # This handles both same-day tasks (e.g., 09:00-23:00) and cross-day tasks
    if frontend_task.get("time") and frontend_task.get("endTime"):
        try:
            start_hour, start_min = map(int, frontend_task["time"].split(":"))
            end_hour, end_min = map(int, frontend_task["endTime"].split(":"))
            start_total = start_hour * 60 + start_min
            end_total = end_hour * 60 + end_min
            duration = end_total - start_total
            
            # Handle cross-day tasks (e.g., 23:00 to 01:00 = 2 hours, not -22 hours)
            if duration < 0:
                duration += 24 * 60  # Add 24 hours
            
            # Set duration if valid (positive)
            if duration > 0:
                backend_task["duration_minutes"] = duration
                # Create end_datetime
                if frontend_task.get("date"):
                    backend_task["end_datetime"] = f"{frontend_task['date']} {frontend_task['endTime']}"
                    # If task spans midnight, adjust end_datetime to next day
                    if end_total < start_total:
                        from datetime import datetime, timedelta
                        try:
                            date_obj = datetime.strptime(frontend_task['date'], "%Y-%m-%d")
                            date_obj += timedelta(days=1)
                            backend_task["end_datetime"] = f"{date_obj.strftime('%Y-%m-%d')} {frontend_task['endTime']}"
                        except:
                            pass
        except:
            pass
    
    # Add metadata
    if frontend_task.get("createdAt"):
        backend_task["created_at"] = frontend_task["createdAt"]
    
    if frontend_task.get("movedFrom"):
        backend_task["moved_from"] = frontend_task["movedFrom"]
    
    return backend_task
