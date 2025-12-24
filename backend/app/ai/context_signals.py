"""Context signals extraction for SolAI behavior adaptation."""
from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from collections import Counter
import re
import logging

logger = logging.getLogger(__name__)

# Theme keywords for detection
THEME_KEYWORDS = {
    "work_pressure": [
        "work", "deadline", "busy", "overwhelmed", "stress", "pressure",
        "meeting", "project", "urgent", "crunch", "exhausted", "burnout"
    ],
    "health_energy": [
        "tired", "energy", "sleep", "rest", "health", "wellness", "exercise",
        "workout", "fatigue", "exhausted", "recharge", "recovery", "sick"
    ],
    "focus_distraction": [
        "focus", "distracted", "concentration", "productive", "procrastinate",
        "motivation", "mindful", "present", "scattered", "clarity"
    ],
    "relationships_personal": [
        "family", "friend", "relationship", "personal", "love", "social",
        "together", "alone", "connection", "support", "care"
    ]
}

# Sentiment indicators
POSITIVE_INDICATORS = [
    "good", "great", "happy", "grateful", "excited", "proud", "accomplished",
    "satisfied", "content", "peaceful", "joy", "love", "wonderful", "amazing",
    "progress", "achieved", "success", "better", "improved"
]

NEGATIVE_INDICATORS = [
    "bad", "sad", "frustrated", "anxious", "worried", "stressed", "overwhelmed",
    "tired", "exhausted", "difficult", "hard", "struggle", "challenging",
    "disappointed", "upset", "concerned", "pressure", "burnout"
]

NEUTRAL_INDICATORS = [
    "okay", "fine", "normal", "usual", "routine", "standard", "regular"
]


def extract_sentiment(text: str) -> str:
    """Extract sentiment from text: positive, neutral, or strained."""
    if not text:
        return "neutral"
    
    text_lower = text.lower()
    
    positive_count = sum(1 for word in POSITIVE_INDICATORS if word in text_lower)
    negative_count = sum(1 for word in NEGATIVE_INDICATORS if word in text_lower)
    neutral_count = sum(1 for word in NEUTRAL_INDICATORS if word in text_lower)
    
    # Weighted scoring
    if negative_count > positive_count * 1.5:
        return "strained"
    elif positive_count > negative_count * 1.5:
        return "positive"
    elif neutral_count > 0 and negative_count == 0 and positive_count == 0:
        return "neutral"
    elif positive_count > negative_count:
        return "positive"
    elif negative_count > 0:
        return "strained"
    else:
        return "neutral"


def extract_themes(text: str) -> List[str]:
    """Extract recurring themes from text using keyword matching."""
    if not text:
        return []
    
    text_lower = text.lower()
    themes = []
    
    for theme_name, keywords in THEME_KEYWORDS.items():
        matches = sum(1 for keyword in keywords if keyword in text_lower)
        if matches >= 2:  # Require at least 2 keyword matches
            themes.append(theme_name)
    
    return themes


def get_week_start(date_obj: date) -> date:
    """Get the Monday of the week for the given date."""
    days_since_monday = date_obj.weekday()
    return date_obj - timedelta(days=days_since_monday)


class ContextSignalExtractor:
    """Extracts context signals from Notes + Reflections. Weekly cached."""
    
    def __init__(self, notes: List[Dict], checkins: List[Dict], tasks: List[Dict]):
        """Initialize with data from past 30 days."""
        self.notes = notes or []
        self.checkins = checkins or []
        self.tasks = tasks or []
    
    def extract_signals(self, week_start: date) -> Dict[str, Any]:
        """Extract all context signals for a given week."""
        # Filter data for this week
        week_end = week_start + timedelta(days=6)
        week_checkins = []
        for c in self.checkins:
            checkin_date = c.get("date")
            if checkin_date:
                # Handle both date objects and ISO strings
                if isinstance(checkin_date, str):
                    try:
                        checkin_date = datetime.strptime(checkin_date, "%Y-%m-%d").date()
                    except:
                        continue
                elif isinstance(checkin_date, datetime):
                    checkin_date = checkin_date.date()
                
                if week_start <= checkin_date <= week_end:
                    week_checkins.append(c)
        
        recent_notes = self.notes
        
        checkin_sentiments = []
        checkin_themes = []
        
        for checkin in week_checkins:
            note_text = checkin.get("note") or ""
            mood = checkin.get("mood", "")
            
            if note_text:
                sentiment = extract_sentiment(note_text)
                checkin_sentiments.append(sentiment)
                themes = extract_themes(note_text)
                checkin_themes.extend(themes)
            
            if mood:
                positive_emojis = ["😊", "😄", "😃", "🙂", "😁", "😍", "🥰", "😎", "🤗"]
                negative_emojis = ["😢", "😞", "😟", "😔", "😕", "😰", "😓", "😤", "😫"]
                
                if any(emoji in mood for emoji in positive_emojis):
                    checkin_sentiments.append("positive")
                elif any(emoji in mood for emoji in negative_emojis):
                    checkin_sentiments.append("strained")
        
        note_sentiments = []
        note_themes = []
        
        for note in recent_notes:
            content = note.get("content") or ""
            if content:
                sentiment = extract_sentiment(content)
                note_sentiments.append(sentiment)
                themes = extract_themes(content)
                note_themes.extend(themes)
        
        all_sentiments = checkin_sentiments + note_sentiments
        if all_sentiments:
            sentiment_counter = Counter(all_sentiments)
            dominant_sentiment = sentiment_counter.most_common(1)[0][0]
        else:
            dominant_sentiment = "neutral"
        
        all_themes = checkin_themes + note_themes
        theme_counter = Counter(all_themes)
        recurring_themes = [
            theme for theme, count in theme_counter.items()
            if count >= 2
        ]
        
        return {
            "sentiment": dominant_sentiment,
            "themes": recurring_themes,
            "checkin_count": len(week_checkins),
            "note_count": len(recent_notes),
            "week_start": week_start.isoformat()
        }


class DriftDetector:
    """Detects drift between plans and reality. Silent flags only."""
    
    def __init__(self, signals: List[Dict], tasks: List[Dict], checkins: List[Dict]):
        """Initialize with signals from past 4 weeks and task/checkin data."""
        self.signals = signals  # Weekly signals
        self.tasks = tasks
        self.checkins = checkins
    
    def detect_drift(self) -> Dict[str, Any]:
        """Detect overload, disengagement, and avoidance patterns."""
        flags = {
            "overload": False,
            "disengagement": False,
            "avoidance": False
        }
        
        if not self.signals or len(self.signals) < 2:
            return flags
        
        # Get most recent signals
        recent_signals = sorted(self.signals, key=lambda x: x.get("week_start", ""), reverse=True)[:2]
        if len(recent_signals) < 2:
            return flags
        
        current_week = recent_signals[0]
        previous_week = recent_signals[1]
        
        # Overload detection: strained sentiment + high task load
        current_sentiment = current_week.get("sentiment", "neutral")
        current_tasks = [t for t in self.tasks if self._is_in_week(t, current_week.get("week_start"))]
        incomplete_tasks = [t for t in current_tasks if not t.get("completed", False)]
        
        if current_sentiment == "strained" and len(incomplete_tasks) > 5:
            flags["overload"] = True
        
        # Disengagement detection: low completion + neutral/flat tone
        completion_rate = self._calculate_completion_rate(current_tasks)
        if completion_rate < 0.5 and current_sentiment in ["neutral", "strained"]:
            flags["disengagement"] = True
        
        # Avoidance detection: repeated reschedules + negative tone
        rescheduled_tasks = [t for t in current_tasks if t.get("moved_from")]
        if len(rescheduled_tasks) > 3 and current_sentiment == "strained":
            flags["avoidance"] = True
        
        return flags
    
    def _is_in_week(self, task: Dict, week_start_str: str) -> bool:
        """Check if task is in the given week."""
        try:
            task_date = task.get("date")
            if not task_date:
                return False
            
            if isinstance(task_date, str):
                task_date = datetime.strptime(task_date, "%Y-%m-%d").date()
            elif isinstance(task_date, datetime):
                task_date = task_date.date()
            
            week_start = datetime.strptime(week_start_str, "%Y-%m-%d").date()
            week_end = week_start + timedelta(days=6)
            
            return week_start <= task_date <= week_end
        except Exception:
            return False
    
    def _calculate_completion_rate(self, tasks: List[Dict]) -> float:
        """Calculate task completion rate."""
        if not tasks:
            return 0.0
        
        completed = sum(1 for t in tasks if t.get("completed", False))
        return completed / len(tasks)


def extract_photo_context(checkins: List[Dict], notes: List[Dict]) -> Dict[str, Any]:
    """Extract photo context signals (existence only, no content analysis)."""
    photo_days = []
    
    for note in notes:
        photo = note.get("photo")
        if photo:
            if isinstance(photo, dict) and photo.get("filename"):
                created_at = note.get("created_at") or note.get("updated_at")
                if created_at:
                    try:
                        if isinstance(created_at, str):
                            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        if isinstance(created_at, datetime):
                            photo_days.append(created_at.weekday())
                    except:
                        pass
        elif note.get("photo_filename"):
            created_at = note.get("created_at") or note.get("updated_at")
            if created_at:
                try:
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    if isinstance(created_at, datetime):
                        photo_days.append(created_at.weekday())
                except:
                    pass
    
    if photo_days:
        weekend_photos = sum(1 for day in photo_days if day >= 5)
        weekend_ratio = weekend_photos / len(photo_days)
        
        return {
            "frequent_weekend_photos": weekend_ratio > 0.4,
            "photo_heavy_days": len(photo_days) > 10,
            "total_photos": len(photo_days)
        }
    
    return {
        "frequent_weekend_photos": False,
        "photo_heavy_days": False,
        "total_photos": 0
    }

