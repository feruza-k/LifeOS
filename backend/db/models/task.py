from sqlalchemy import Column, String, Boolean, Integer, Text, TIMESTAMP, Date, CheckConstraint, Computed, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func, text
from sqlalchemy.orm import relationship
from db.session import Base

class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)
    title = Column(String(500), nullable=False)
    datetime = Column(TIMESTAMP, nullable=False)
    end_datetime = Column(TIMESTAMP)
    duration_minutes = Column(Integer)
    date = Column(Date, Computed("DATE(datetime)", persisted=True), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(100))
    notes = Column(Text)
    completed = Column(Boolean, default=False, nullable=False)
    energy = Column(String(20))
    context = Column(String(50))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)
    moved_from = Column(TIMESTAMP)
    recurring = Column(String(50))
    repeat_config = Column(JSONB)

    __table_args__ = (
        CheckConstraint("type IN ('event', 'reminder')", name="tasks_type_check"),
        CheckConstraint("energy IN ('low', 'medium', 'high')", name="tasks_energy_check"),
        CheckConstraint("end_datetime IS NULL OR end_datetime >= datetime", name="check_end_after_start"),
        CheckConstraint("duration_minutes IS NULL OR duration_minutes > 0", name="check_duration_positive"),
    )

