"""
Goal-Task Alignment Engine
Automatically matches completed tasks to monthly goals and calculates progress
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import re
from app.logging import logger

def calculate_goal_task_similarity(goal_title: str, task_title: str) -> float:
    """
    Calculate semantic similarity between a goal and a task title.
    Uses keyword matching and semantic analysis.
    Returns a score between 0 and 1.
    """
    goal_lower = goal_title.lower()
    task_lower = task_title.lower()
    
    # Extract keywords from goal (remove common words)
    stop_words = {'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but'}
    goal_words = set(re.findall(r'\b\w+\b', goal_lower)) - stop_words
    task_words = set(re.findall(r'\b\w+\b', task_lower)) - stop_words
    
    if not goal_words:
        return 0.0
    
    # Direct word overlap
    overlap = len(goal_words & task_words)
    word_similarity = overlap / len(goal_words) if goal_words else 0.0
    
    # Check for substring matches (e.g., "gym" in "gym workout")
    substring_match = 0.0
    for goal_word in goal_words:
        if len(goal_word) > 3 and goal_word in task_lower:
            substring_match += 0.4  # Increased weight
    
    # Category-based matching (if we can infer category from goal)
    category_keywords = {
        'workout': ['gym', 'exercise', 'run', 'workout', 'fitness', 'training', 'cardio', 'strength'],
        'read': ['read', 'book', 'article', 'study', 'chapter', 'reading'],
        'meditate': ['meditate', 'meditation', 'mindfulness', 'yoga', 'breathing'],
        'learn': ['learn', 'study', 'course', 'practice', 'lesson', 'tutorial', 'class'],
        'connect': ['call', 'meet', 'lunch', 'dinner', 'coffee', 'friend', 'social', 'chat'],
        'create': ['write', 'create', 'design', 'build', 'make', 'draft', 'sketch'],
        'consistent': ['routine', 'daily', 'regular', 'habit', 'consistent'],
    }
    
    category_match = 0.0
    for category, keywords in category_keywords.items():
        goal_has_keyword = any(kw in goal_lower for kw in keywords)
        task_has_keyword = any(kw in task_lower for kw in keywords)
        if goal_has_keyword and task_has_keyword:
            category_match = 0.5  # Increased weight
    
    # Also check if goal contains action words that match task
    action_match = 0.0
    action_words = ['build', 'create', 'learn', 'read', 'practice', 'improve', 'develop']
    for action in action_words:
        if action in goal_lower and any(kw in task_lower for kw in [action, action + 'ing', action + 'ed']):
            action_match = 0.3
    
    # Combine scores (weighted, more generous)
    similarity = (
        word_similarity * 0.4 +
        min(substring_match, 0.5) * 0.3 +
        category_match * 0.2 +
        action_match * 0.1
    )
    
    # Boost similarity if any meaningful match found
    if word_similarity > 0 or substring_match > 0 or category_match > 0:
        similarity = max(similarity, 0.25)  # Minimum boost for any match
    
    return min(similarity, 1.0)


def match_tasks_to_goals(
    goals: List[Dict[str, Any]],
    completed_tasks: List[Dict[str, Any]],
    days_back: int = 30
) -> Dict[str, Dict[str, Any]]:
    """
    Match completed tasks to monthly goals and calculate progress.
    
    Args:
        goals: List of monthly goals with 'id', 'title', 'description'
        completed_tasks: List of completed tasks with 'title', 'date', 'category'
        days_back: Number of days to look back for task matching
    
    Returns:
        Dict mapping goal_id to {
            'matched_tasks': List of task dicts,
            'progress_score': float 0-100,
            'recent_activity': int (tasks in last 7 days)
        }
    """
    if not goals or not completed_tasks:
        return {}
    
    # Filter tasks to recent period
    cutoff_date = datetime.now().date() - timedelta(days=days_back)
    recent_tasks = []
    for t in completed_tasks:
        task_date = t.get('date')
        if not task_date:
            continue
        
        # Handle different date formats
        try:
            if isinstance(task_date, str):
                # Try parsing as ISO date (YYYY-MM-DD)
                if len(task_date) >= 10:
                    date_str = task_date[:10]  # Take first 10 chars (YYYY-MM-DD)
                    task_date_obj = datetime.fromisoformat(date_str).date()
                else:
                    continue
            elif hasattr(task_date, 'date'):
                task_date_obj = task_date.date() if hasattr(task_date, 'date') else task_date
            else:
                continue
            
            if task_date_obj >= cutoff_date:
                recent_tasks.append(t)
        except (ValueError, AttributeError) as e:
            logger.warning(f"Could not parse task date '{task_date}': {e}")
            continue
    
    goal_matches = {}
    
    for goal in goals:
        goal_id = goal.get('id')
        goal_title = goal.get('title', '')
        goal_description = goal.get('description', '') or ''
        
        if not goal_id or not goal_title:
            continue
        
        matched_tasks = []
        similarity_scores = []
        
        # Match tasks to this goal
        for task in recent_tasks:
            task_title = task.get('title', '')
            if not task_title:
                continue
            
            # Calculate similarity
            title_similarity = calculate_goal_task_similarity(goal_title, task_title)
            
            # Also check description if available
            desc_similarity = 0.0
            if goal_description:
                desc_similarity = calculate_goal_task_similarity(goal_description, task_title)
            
            similarity = max(title_similarity, desc_similarity * 0.7)
            
            # Threshold: only match if similarity > 0.25 (lowered for better matching)
            if similarity > 0.25:
                matched_tasks.append({
                    **task,
                    'similarity': similarity
                })
                similarity_scores.append(similarity)
        
        # Calculate progress score (0-100)
        # Based on: number of matched tasks, recency, and consistency
        if matched_tasks:
            # Count tasks in last 7 days (recent activity)
            week_ago = datetime.now().date() - timedelta(days=7)
            recent_count = 0
            for t in matched_tasks:
                task_date = t.get('date')
                if task_date:
                    try:
                        if isinstance(task_date, str) and len(task_date) >= 10:
                            date_str = task_date[:10]
                            task_date_obj = datetime.fromisoformat(date_str).date()
                        elif hasattr(task_date, 'date'):
                            task_date_obj = task_date.date()
                        else:
                            continue
                        if task_date_obj >= week_ago:
                            recent_count += 1
                    except (ValueError, AttributeError):
                        continue
            
            # Average similarity (quality of matches)
            avg_similarity = sum(similarity_scores) / len(similarity_scores) if similarity_scores else 0
            
            # Progress calculation:
            # - Base: number of tasks (capped at reasonable expectation)
            # - Quality: average similarity
            # - Recency: bonus for recent activity
            base_progress = min(len(matched_tasks) * 10, 60)  # Max 60 from task count
            quality_bonus = avg_similarity * 20  # Up to 20 from quality
            recency_bonus = min(recent_count * 5, 20)  # Up to 20 from recent activity
            
            progress_score = min(base_progress + quality_bonus + recency_bonus, 100)
        else:
            progress_score = 0
            recent_count = 0
        
        goal_matches[goal_id] = {
            'matched_tasks': matched_tasks,
            'progress_score': round(progress_score, 1),
            'recent_activity': recent_count,
            'total_matches': len(matched_tasks)
        }
    
    return goal_matches


def get_goal_context_for_ai(goals: List[Dict[str, Any]]) -> str:
    """
    Format monthly goals for AI system prompt.
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
    
    return "\n".join(goal_lines)


def generate_goal_aware_suggestion(
    goals: List[Dict[str, Any]],
    goal_matches: Dict[str, Dict[str, Any]],
    user_tasks_today: List[Dict[str, Any]],
    upcoming_tasks: List[Dict[str, Any]]
) -> Optional[Dict[str, str]]:
    """
    Generate a subtle, goal-aware suggestion.
    Only suggests if:
    1. There's a goal that's being neglected (low progress, no recent activity)
    2. OR there's a goal that could benefit from a task suggestion
    3. AND it's contextually relevant (not already scheduled)
    
    Returns None if no suggestion is appropriate.
    """
    if not goals or not goal_matches:
        return None
    
    # Find goals with low progress or no recent activity
    neglected_goals = []
    for goal in goals:
        goal_id = goal.get('id', '')
        if not goal_id:
            continue
        
        matches = goal_matches.get(goal_id, {})
        progress = matches.get('progress_score', 0)
        recent_activity = matches.get('recent_activity', 0)
        
        # Goal is neglected if: progress < 30% AND no activity in last 7 days
        if progress < 30 and recent_activity == 0:
            neglected_goals.append({
                'goal': goal,
                'progress': progress,
                'matches': matches
            })
    
    if not neglected_goals:
        return None
    
    # Pick the most relevant neglected goal
    # Prioritize goals that are more specific (longer titles often = more specific)
    best_goal = max(neglected_goals, key=lambda x: len(x['goal'].get('title', '')))
    goal = best_goal['goal']
    goal_title = goal.get('title', '')
    
    # Check if user already has tasks that might relate to this goal
    all_task_titles = [t.get('title', '').lower() for t in user_tasks_today + upcoming_tasks]
    goal_keywords = set(re.findall(r'\b\w+\b', goal_title.lower()))
    
    # If there's already a task with similar keywords, don't suggest
    has_similar_task = any(
        any(kw in task_title for kw in goal_keywords if len(kw) > 3)
        for task_title in all_task_titles
    )
    
    if has_similar_task:
        return None  # User is already working on it
    
    # Generate a subtle suggestion
    # Extract action verb or key concept from goal
    goal_words = goal_title.split()
    if len(goal_words) > 0:
        # Try to extract the main action/object
        suggestion_text = f"Your goal '{goal_title}' could use some attention. Would you like to schedule something related to it this week?"
    else:
        return None
    
    return {
        'message': suggestion_text,
        'action': 'schedule_goal_task',
        'goal_id': goal.get('id', ''),
        'goal_title': goal_title
    }

