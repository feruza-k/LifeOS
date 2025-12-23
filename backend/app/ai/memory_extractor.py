"""Extract memory candidates from conversations (not persisted)."""

from typing import List, Optional, Dict, Any
from uuid import UUID
from app.ai.memory_candidate import MemoryCandidate, create_memory_candidate
from app.ai.memory_taxonomy import MemoryType
from app.ai.memory_policy import memory_guardrails, validate_memory_candidate


class MemoryExtractor:
    """Extracts potential memories from conversations."""
    
    def extract_candidates(
        self,
        user_message: str,
        assistant_response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[MemoryCandidate]:
        """Extract memory candidates (not persisted). Placeholder for Day 24."""
        # Placeholder - extraction logic will be added in Day 24
        return []
    
    def extract_from_explicit_statement(
        self,
        user_message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[MemoryCandidate]:
        """Extract from explicit statements. Placeholder for Day 24."""
        return None
    
    def validate_and_prepare_candidate(
        self,
        candidate: MemoryCandidate
    ) -> tuple[bool, Optional[MemoryCandidate]]:
        is_valid, errors = validate_memory_candidate(candidate)
        
        if is_valid:
            candidate.should_store = True
            return True, candidate
        else:
            candidate.should_store = False
            candidate.validation_errors = errors
            return False, None
    
    def extract_from_pattern_analysis(
        self,
        pattern_data: Dict[str, Any],
        confidence: float
    ) -> Optional[MemoryCandidate]:
        """Extract from pattern analysis. Placeholder for Day 24."""
        return None


memory_extractor = MemoryExtractor()


def extract_memory_candidates(
    user_message: str,
    assistant_response: str,
    context: Optional[Dict[str, Any]] = None
) -> List[MemoryCandidate]:
    return memory_extractor.extract_candidates(
        user_message=user_message,
        assistant_response=assistant_response,
        context=context
    )


def create_memory_candidate_manual(
    content: str,
    memory_type: MemoryType,
    confidence: float,
    source: str = "explicit",
    metadata: Optional[Dict[str, Any]] = None,
    user_message: Optional[str] = None,
    assistant_response: Optional[str] = None,
) -> MemoryCandidate:
    return create_memory_candidate(
        content=content,
        memory_type=memory_type,
        confidence=confidence,
        source=source,
        metadata=metadata,
        user_message=user_message,
        assistant_response=assistant_response,
    )

