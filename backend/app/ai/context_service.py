"""Context service for signal extraction with weekly caching."""
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from uuid import UUID
import logging

from db.repo import db_repo
from app.ai.context_signals import (
    ContextSignalExtractor,
    DriftDetector,
    extract_photo_context,
    get_week_start
)

logger = logging.getLogger(__name__)


async def get_or_compute_context_signals(user_id: str, force_refresh: bool = False) -> Dict[str, Any]:
    """Get context signals for the current week, computing if needed."""
    today = date.today()
    current_week_start = get_week_start(today)
    
    try:
        cached_signal = await db_repo.get_context_signal(user_id, current_week_start)
    except Exception as e:
        logger.debug(f"Context signals table not available: {e}")
        cached_signal = None
    
    if cached_signal and not force_refresh:
        signals_json = cached_signal.get("signals_json", {})
        recent_signals = await db_repo.get_recent_context_signals(user_id, limit=4)
        drift_flags = _extract_drift_from_signals(recent_signals)
        
        return {
            "signals": signals_json,
            "drift": drift_flags,
            "week_start": current_week_start.isoformat(),
            "cached": True
        }
    
    try:
        global_notes = await db_repo.get_global_notes(user_id)
        thirty_days_ago = today - timedelta(days=30)
        checkins = await _get_checkins_since(user_id, thirty_days_ago)
        tasks = await _get_tasks_since(user_id, thirty_days_ago)
        
        extractor = ContextSignalExtractor(
            notes=global_notes,
            checkins=checkins,
            tasks=tasks
        )
        
        signals = extractor.extract_signals(current_week_start)
        photo_context = extract_photo_context(checkins, global_notes)
        signals["photo_context"] = photo_context
        
        try:
            await db_repo.upsert_context_signal(user_id, current_week_start, signals)
        except Exception as e:
            logger.debug(f"Could not save context signals to cache: {e}")
        
        try:
            recent_signals = await db_repo.get_recent_context_signals(user_id, limit=4)
            drift_detector = DriftDetector(
                signals=[s.get("signals_json", {}) for s in recent_signals],
                tasks=tasks,
                checkins=checkins
            )
            drift_flags = drift_detector.detect_drift()
        except Exception as e:
            logger.debug(f"Context signals table not available for drift detection: {e}")
            drift_flags = {"overload": False, "disengagement": False, "avoidance": False}
        
        return {
            "signals": signals,
            "drift": drift_flags,
            "week_start": current_week_start.isoformat(),
            "cached": False
        }
        
    except Exception as e:
        logger.error(f"Error computing context signals for user {user_id}: {e}", exc_info=True)
        # Return empty signals on error
        return {
            "signals": {
                "sentiment": "neutral",
                "themes": [],
                "checkin_count": 0,
                "note_count": 0
            },
            "drift": {
                "overload": False,
                "disengagement": False,
                "avoidance": False
            },
            "week_start": current_week_start.isoformat(),
            "cached": False
        }


async def _get_checkins_since(user_id: str, since_date: date) -> List[Dict]:
    """Get check-ins since a given date."""
    try:
        from uuid import UUID
        from db.session import AsyncSessionLocal
        from db.repositories.checkin import CheckinRepository
        
        today = date.today()
        async with AsyncSessionLocal() as session:
            repo = CheckinRepository(session)
            checkins = await repo.get_by_user_and_date_range(UUID(user_id), since_date, today)
            return [
                {
                    "date": c.date.isoformat() if c.date else None,
                    "note": c.note,
                    "mood": c.mood,
                    "photo_filename": None,  # Check-ins don't have photos directly
                    "photo": None
                }
                for c in checkins
            ]
    except Exception as e:
        logger.error(f"Error fetching check-ins: {e}")
        return []


async def _get_tasks_since(user_id: str, since_date: date) -> List[Dict]:
    """Get tasks since a given date."""
    try:
        tasks = []
        current_date = since_date
        today = date.today()
        
        while current_date <= today:
            date_str = current_date.strftime("%Y-%m-%d")
            day_tasks = await db_repo.get_tasks_by_date_and_user(date_str, user_id)
            tasks.extend(day_tasks)
            current_date += timedelta(days=1)
        
        return tasks
    except Exception as e:
        logger.error(f"Error fetching tasks: {e}")
        return []


def _extract_drift_from_signals(recent_signals: List[Dict]) -> Dict[str, bool]:
    """Extract drift flags from recent signals."""
    if not recent_signals or len(recent_signals) < 2:
        return {
            "overload": False,
            "disengagement": False,
            "avoidance": False
        }
    
    # Get most recent signal
    latest = recent_signals[0].get("signals_json", {})
    
    # Simple drift detection based on sentiment
    sentiment = latest.get("sentiment", "neutral")
    
    return {
        "overload": sentiment == "strained",
        "disengagement": sentiment == "neutral" and latest.get("checkin_count", 0) < 2,
        "avoidance": sentiment == "strained" and latest.get("checkin_count", 0) == 0
    }


def format_context_signals_for_prompt(signals_data: Dict[str, Any]) -> str:
    """Format context signals for SolAI system prompt (2-3 sentences max)."""
    signals = signals_data.get("signals", {})
    drift = signals_data.get("drift", {})
    photo_context = signals.get("photo_context", {})
    
    parts = []
    
    # Sentiment and themes
    sentiment = signals.get("sentiment", "neutral")
    themes = signals.get("themes", [])
    
    if sentiment != "neutral" or themes:
        sentiment_desc = {
            "positive": "feeling positive",
            "strained": "experiencing some strain",
            "neutral": "in a neutral state"
        }.get(sentiment, "in a neutral state")
        
        theme_names = {
            "work_pressure": "work pressure",
            "health_energy": "health and energy",
            "focus_distraction": "focus and productivity",
            "relationships_personal": "relationships and personal life"
        }
        
        theme_list = [theme_names.get(t, t) for t in themes[:2]]  # Max 2 themes
        
        if theme_list:
            parts.append(f"User is {sentiment_desc}, with themes around {', '.join(theme_list)}.")
        else:
            parts.append(f"User is {sentiment_desc}.")
    
    # Drift flags (subtle hints only)
    if drift.get("overload"):
        parts.append("User appears to be managing a high load.")
    elif drift.get("disengagement"):
        parts.append("User engagement has been lower recently.")
    
    # Photo context (subtle)
    if photo_context.get("frequent_weekend_photos"):
        parts.append("Weekends tend to be meaningful times for the user.")
    
    if not parts:
        return ""  # No signals to report
    
    return " ".join(parts)

