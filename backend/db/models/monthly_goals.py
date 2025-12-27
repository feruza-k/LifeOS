from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class MonthlyGoal(Base):
    __tablename__ = "monthly_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month = Column(String(7), nullable=False)  # YYYY-MM format
    title = Column(String(500), nullable=False)
    description = Column(Text)
    progress = Column(Integer, default=0)
    order_index = Column(Integer, nullable=False, default=0)  # For ordering goals (0-4)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="monthly_goals_progress_check"),
        CheckConstraint("order_index >= 0 AND order_index < 5", name="monthly_goals_order_check"),
    )

