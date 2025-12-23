from typing import List, Optional, Dict, Any
from app.ai.memory_candidate import MemoryCandidate
from app.ai.memory_taxonomy import MemoryType, get_memory_type_definition, get_confidence_threshold


class MemoryGuardrails:
    MIN_CONFIDENCE = 0.70
    MIN_CONTENT_LENGTH = 5
    MAX_CONTENT_LENGTH = 500
    
    FORBIDDEN_PATTERNS = [
        "password", "api key", "secret", "token",
        "credit card", "ssn", "social security", "bank account",
    ]
    
    TEMPORARY_INDICATORS = [
        "today", "this week", "this month", "right now",
        "for now", "temporarily", "just this once",
    ]
    
    def validate(self, candidate: MemoryCandidate) -> tuple[bool, List[str]]:
        errors: List[str] = []
        
        if not candidate.is_valid():
            errors.append("Candidate fails basic validation")
            return False, errors
        
        errors.extend(self._validate_content(candidate))
        errors.extend(self._validate_confidence(candidate))
        errors.extend(self._validate_memory_type(candidate))
        errors.extend(self._validate_security(candidate))
        errors.extend(self._validate_temporal(candidate))
        
        is_valid = len(errors) == 0
        
        if is_valid:
            candidate.should_store = True
        else:
            candidate.should_store = False
            candidate.validation_errors = errors
        
        return is_valid, errors
    
    def _validate_content(self, candidate: MemoryCandidate) -> List[str]:
        errors = []
        
        if len(candidate.content) < self.MIN_CONTENT_LENGTH:
            errors.append(f"Content too short (minimum {self.MIN_CONTENT_LENGTH} characters)")
        
        if len(candidate.content) > self.MAX_CONTENT_LENGTH:
            errors.append(f"Content too long (maximum {self.MAX_CONTENT_LENGTH} characters)")
        
        if not candidate.content.strip():
            errors.append("Content cannot be empty or whitespace only")
        
        return errors
    
    def _validate_confidence(self, candidate: MemoryCandidate) -> List[str]:
        errors = []
        
        if candidate.confidence < self.MIN_CONFIDENCE:
            errors.append(
                f"Confidence {candidate.confidence:.2f} below absolute minimum {self.MIN_CONFIDENCE}"
            )
        
        type_threshold = get_confidence_threshold(candidate.memory_type)
        if candidate.confidence < type_threshold:
            errors.append(
                f"Confidence {candidate.confidence:.2f} below type threshold {type_threshold} "
                f"for {candidate.memory_type.value}"
            )
        
        return errors
    
    def _validate_memory_type(self, candidate: MemoryCandidate) -> List[str]:
        errors = []
        definition = get_memory_type_definition(candidate.memory_type)
        content_lower = candidate.content.lower()
        for forbidden in definition.what_not_to_store:
            if forbidden.lower() in content_lower:
                errors.append(
                    f"Content matches forbidden pattern for {candidate.memory_type.value}: '{forbidden}'"
                )
        
        return errors
    
    def _validate_security(self, candidate: MemoryCandidate) -> List[str]:
        errors = []
        
        content_lower = candidate.content.lower()
        
        for pattern in self.FORBIDDEN_PATTERNS:
            if pattern in content_lower:
                errors.append(f"Content contains potentially sensitive information: '{pattern}'")
        
        return errors
    
    def _validate_temporal(self, candidate: MemoryCandidate) -> List[str]:
        errors = []
        
        content_lower = candidate.content.lower()
        
        for indicator in self.TEMPORARY_INDICATORS:
            if indicator in content_lower:
                errors.append(
                    f"Content indicates temporary preference, not permanent memory: '{indicator}'"
                )
        
        return errors
    
    def should_store_candidate(self, candidate: MemoryCandidate) -> bool:
        is_valid, _ = self.validate(candidate)
        return is_valid
    
    def get_storage_reason(self, candidate: MemoryCandidate) -> Optional[str]:
        is_valid, errors = self.validate(candidate)
        
        if is_valid:
            return f"Meets all policy requirements (confidence: {candidate.confidence:.2f}, type: {candidate.memory_type.value})"
        else:
            return f"Does not meet policy requirements: {', '.join(errors)}"


memory_guardrails = MemoryGuardrails()


def validate_memory_candidate(candidate: MemoryCandidate) -> tuple[bool, List[str]]:
    return memory_guardrails.validate(candidate)


def should_store_memory(candidate: MemoryCandidate) -> bool:
    return memory_guardrails.should_store_candidate(candidate)

