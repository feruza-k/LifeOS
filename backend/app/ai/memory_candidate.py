"""MemoryCandidate: potential memory before persistence."""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID

from app.ai.memory_taxonomy import MemoryType, get_confidence_threshold


@dataclass
class MemoryCandidate:
    """Potential memory extracted but not yet persisted."""
    
    content: str
    memory_type: MemoryType
    confidence: float  # 0.0-1.0
    source: str = "conversation"
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    should_store: bool = False
    validation_errors: list[str] = field(default_factory=list)
    
    user_message: Optional[str] = None
    assistant_response: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def __post_init__(self):
        if not (0.0 <= self.confidence <= 1.0):
            raise ValueError(f"Confidence must be 0.0-1.0, got {self.confidence}")
        if not self.content or not self.content.strip():
            raise ValueError("Content cannot be empty")
    
    def meets_confidence_threshold(self) -> bool:
        threshold = get_confidence_threshold(self.memory_type)
        return self.confidence >= threshold
    
    def is_valid(self) -> bool:
        return (
            bool(self.content and self.content.strip()) and
            0.0 <= self.confidence <= 1.0 and
            self.memory_type in MemoryType
        )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "memory_type": self.memory_type.value,
            "confidence": float(self.confidence),
            "source": self.source,
            "metadata": self.metadata,
            "should_store": self.should_store,
            "validation_errors": self.validation_errors,
            "user_message": self.user_message,
            "assistant_response": self.assistant_response,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryCandidate":
        return cls(
            content=data["content"],
            memory_type=MemoryType(data["memory_type"]),
            confidence=float(data["confidence"]),
            source=data.get("source", "conversation"),
            metadata=data.get("metadata", {}),
            should_store=data.get("should_store", False),
            validation_errors=data.get("validation_errors", []),
            user_message=data.get("user_message"),
            assistant_response=data.get("assistant_response"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
        )
    
    def __str__(self) -> str:
        return f"MemoryCandidate({self.memory_type.value}: {self.content[:50]}..., confidence={self.confidence:.2f})"


def create_memory_candidate(
    content: str,
    memory_type: MemoryType,
    confidence: float,
    source: str = "conversation",
    metadata: Optional[Dict[str, Any]] = None,
    user_message: Optional[str] = None,
    assistant_response: Optional[str] = None,
) -> MemoryCandidate:
    return MemoryCandidate(
        content=content,
        memory_type=memory_type,
        confidence=confidence,
        source=source,
        metadata=metadata or {},
        user_message=user_message,
        assistant_response=assistant_response,
    )

