from sqlalchemy import Column, String, Boolean, Date, Time, Text, TIMESTAMP, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    due_date = Column(Date)
    time = Column(Time)
    type = Column(String(20))
    recurring = Column(String(20))
    visible = Column(Boolean, default=True, nullable=False)
    note = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

    __table_args__ = (
        CheckConstraint("type IN ('notify', 'show')", name="reminders_type_check"),
        CheckConstraint("recurring IN ('daily', 'weekly', 'monthly', 'yearly')", name="reminders_recurring_check"),
    )

