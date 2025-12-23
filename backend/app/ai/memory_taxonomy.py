"""Memory types and definitions for SolAI."""

from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass


class MemoryType(str, Enum):
    """Types of memories SolAI can learn."""
    PREFERENCE = "preference"
    CONSTRAINT = "constraint"
    PATTERN = "pattern"
    VALUE = "value"


@dataclass
class MemoryTypeDefinition:
    """Definition and guidelines for a memory type."""
    type: MemoryType
    description: str
    examples: List[str]
    confidence_threshold: float  # Minimum confidence (0-1) to store
    signals: List[str]  # What indicates this type might be present
    what_not_to_store: List[str]  # What should NOT be stored


MEMORY_TYPE_DEFINITIONS: Dict[MemoryType, MemoryTypeDefinition] = {
    MemoryType.PREFERENCE: MemoryTypeDefinition(
        type=MemoryType.PREFERENCE,
        description="User's stated or demonstrated preferences for how they like things done.",
        examples=[
            "Prefers morning workouts",
            "Likes detailed task descriptions",
            "Prefers to batch similar tasks",
            "Likes reminders 15 minutes before events"
        ],
        confidence_threshold=0.75,
        signals=[
            "User explicitly states 'I prefer...' or 'I like...'",
            "User consistently chooses one option over another",
            "User expresses satisfaction with a particular approach"
        ],
        what_not_to_store=[
            "One-time choices without repetition",
            "Temporary preferences (e.g., 'today I want...')",
            "Preferences inferred from single data point"
        ]
    ),
    
    MemoryType.CONSTRAINT: MemoryTypeDefinition(
        type=MemoryType.CONSTRAINT,
        description="Hard boundaries, limitations, or non-negotiable rules.",
        examples=[
            "Cannot work after 6 PM",
            "No meetings on Fridays",
            "Requires 1 hour buffer before important events",
            "Never schedules tasks during lunch break"
        ],
        confidence_threshold=0.85,
        signals=[
            "User explicitly states 'I cannot...' or 'I never...'",
            "User consistently avoids certain times/activities",
            "User expresses strong negative reaction to suggestions"
        ],
        what_not_to_store=[
            "Temporary constraints (e.g., 'this week I can't...')",
            "Constraints that might change",
            "Soft preferences mislabeled as constraints"
        ]
    ),
    
    MemoryType.PATTERN: MemoryTypeDefinition(
        type=MemoryType.PATTERN,
        description="Observed patterns in user behavior over time, based on data analysis.",
        examples=[
            "Completes 80% of tasks scheduled before noon",
            "Tends to reschedule high-energy tasks to mornings",
            "Creates most tasks on Sunday evenings",
            "Usually completes workout tasks on weekdays"
        ],
        confidence_threshold=0.70,
        signals=[
            "Consistent behavior across multiple instances (5+ occurrences)",
            "Statistical significance in task completion patterns",
            "Time-of-day or day-of-week preferences in data"
        ],
        what_not_to_store=[
            "Patterns based on fewer than 5 data points",
            "Coincidental patterns without statistical basis",
            "Patterns that contradict explicit user preferences"
        ]
    ),
    
    MemoryType.VALUE: MemoryTypeDefinition(
        type=MemoryType.VALUE,
        description="Core values or principles that guide user decisions and priorities.",
        examples=[
            "Prioritizes family time over work",
            "Values flexibility over strict scheduling",
            "Prefers quality over speed",
            "Values work-life balance"
        ],
        confidence_threshold=0.80,
        signals=[
            "User explicitly states core values",
            "Consistent decision-making aligned with a principle",
            "User expresses strong emotional connection to a principle"
        ],
        what_not_to_store=[
            "Temporary priorities",
            "Values inferred from single actions",
            "Conflicting values without resolution"
        ]
    ),
}


def get_memory_type_definition(memory_type: MemoryType) -> MemoryTypeDefinition:
    """Get the definition for a memory type."""
    return MEMORY_TYPE_DEFINITIONS[memory_type]


def get_confidence_threshold(memory_type: MemoryType) -> float:
    """Get the minimum confidence threshold for a memory type."""
    return MEMORY_TYPE_DEFINITIONS[memory_type].confidence_threshold


def is_valid_memory_type(value: str) -> bool:
    """Check if a string is a valid memory type."""
    try:
        MemoryType(value)
        return True
    except ValueError:
        return False


def get_all_memory_types() -> List[MemoryType]:
    """Get all valid memory types."""
    return list(MemoryType)


def get_memory_type_description(memory_type: MemoryType) -> str:
    """Get a human-readable description of a memory type."""
    return MEMORY_TYPE_DEFINITIONS[memory_type].description

