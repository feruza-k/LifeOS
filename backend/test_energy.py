#!/usr/bin/env python3
"""Test energy calculation for the 14-hour task"""

import json
import sys
sys.path.insert(0, '.')

from app.logic.today_engine import calculate_energy

# Load the task from data.json
with open('app/db/data.json', 'r') as f:
    data = json.load(f)

# Find the Study task
study_task = None
for task in data['tasks']:
    if task.get('id') == '34da96ee-5bc2-477b-a205-27260b0b4055':
        study_task = task
        break

if study_task:
    print(f"Task: {study_task.get('title')}")
    print(f"Date: {study_task.get('date')}")
    print(f"Time: {study_task.get('time')}")
    print(f"Duration: {study_task.get('duration_minutes')} minutes")
    print(f"End datetime: {study_task.get('end_datetime')}")
    print()
    
    # Calculate energy for just this task
    result = calculate_energy([study_task])
    
    print("Energy calculation result:")
    print(f"  Status: {result['status']}")
    print(f"  Effective Load: {result['effectiveLoad']}")
    print(f"  Completed Load Ratio: {result['completedLoadRatio']}")
    print()
    print(f"Expected: prioritize_rest (14.88 hours = {study_task.get('duration_minutes')} min)")
    print(f"Got: {result['status']}")
    print()
    
    if result['status'] != 'prioritize_rest':
        print(f"❌ ERROR: Status should be 'prioritize_rest' but got '{result['status']}'")
        print(f"   Duration: {study_task.get('duration_minutes')} minutes")
        print(f"   Load ratio should be: {study_task.get('duration_minutes') / 480:.2f}")
    else:
        print("✅ Calculation is correct!")
else:
    print("Task not found")
