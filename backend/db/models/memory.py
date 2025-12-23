from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from db.session import Base

class Memory(Base):
    __tablename__ = "memories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    memory_type = Column(String(20), nullable=False)
    confidence = Column(Numeric(3, 2), nullable=False)
    source = Column(String(50), default="conversation", nullable=False)
    extra_data = Column(JSONB)
    category = Column(String(100))
    
    # Timestamps
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)
    
    # Legacy compatibility: map 'text' to 'content'
    @property
    def text(self) -> str:
        """Legacy property for backward compatibility."""
        return self.content
    
    __table_args__ = (
        CheckConstraint(
            "memory_type IN ('preference', 'constraint', 'pattern', 'value')",
            name="memories_type_check"
        ),
        CheckConstraint(
            "confidence >= 0.00 AND confidence <= 1.00",
            name="memories_confidence_check"
        ),
        CheckConstraint(
            "source IN ('conversation', 'pattern_analysis', 'explicit', 'user_import')",
            name="memories_source_check"
        ),
    )

