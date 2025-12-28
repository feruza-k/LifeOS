"""
Quick test script for goal-task matching
Run this to verify the matching algorithm works correctly
"""
import sys
sys.path.append('.')

from app.ai.goal_engine import calculate_goal_task_similarity, match_tasks_to_goals

# Test cases
test_cases = [
    {
        "goal": "Build a consistent gym routine",
        "tasks": [
            ("Morning workout", 0.7),  # Expected similarity
            ("Gym session", 0.8),
            ("Evening run", 0.6),
            ("Exercise", 0.5),
            ("Buy groceries", 0.0),
            ("Work meeting", 0.0),
        ]
    },
    {
        "goal": "Read 2 books this month",
        "tasks": [
            ("Read chapter 1", 0.7),
            ("Reading time", 0.6),
            ("Book club discussion", 0.5),
            ("Write essay", 0.2),
            ("Watch TV", 0.0),
        ]
    },
    {
        "goal": "Learn Spanish basics",
        "tasks": [
            ("Spanish lesson", 0.8),
            ("Practice Spanish", 0.7),
            ("Watch Spanish video", 0.6),
            ("Learn French", 0.3),
            ("Study math", 0.0),
        ]
    }
]

print("Testing Goal-Task Similarity Matching\n")
print("=" * 60)

for test_case in test_cases:
    goal_title = test_case["goal"]
    print(f"\nGoal: '{goal_title}'")
    print("-" * 60)
    
    for task_title, expected_min_similarity in test_case["tasks"]:
        similarity = calculate_goal_task_similarity(goal_title, task_title)
        match_status = "✓ MATCH" if similarity > 0.3 else "✗ NO MATCH"
        expected_status = "✓" if similarity >= expected_min_similarity * 0.8 else "✗"
        
        print(f"  Task: '{task_title}'")
        print(f"    Similarity: {similarity:.2f} | {match_status} | Expected: {expected_status}")
    
    print()

# Test full matching function
print("\n" + "=" * 60)
print("Testing Full Matching Function\n")

goals = [
    {"id": "goal-1", "title": "Build a consistent gym routine", "description": None},
    {"id": "goal-2", "title": "Read 2 books this month", "description": None},
]

completed_tasks = [
    {"id": "task-1", "title": "Morning workout", "date": "2025-12-28", "completed": True},
    {"id": "task-2", "title": "Gym session", "date": "2025-12-27", "completed": True},
    {"id": "task-3", "title": "Read chapter 1", "date": "2025-12-26", "completed": True},
    {"id": "task-4", "title": "Buy groceries", "date": "2025-12-25", "completed": True},
]

matches = match_tasks_to_goals(goals, completed_tasks, days_back=30)

print("Goal Matches:")
for goal in goals:
    goal_id = goal["id"]
    if goal_id in matches:
        match_data = matches[goal_id]
        print(f"\n  Goal: '{goal['title']}'")
        print(f"    Progress: {match_data['progress_score']:.1f}%")
        print(f"    Matched Tasks: {match_data['total_matches']}")
        print(f"    Recent Activity (7 days): {match_data['recent_activity']}")
        if match_data['matched_tasks']:
            print(f"    Tasks:")
            for task in match_data['matched_tasks'][:3]:
                print(f"      - {task['title']} (similarity: {task.get('similarity', 0):.2f})")

print("\n" + "=" * 60)
print("Test Complete!")

