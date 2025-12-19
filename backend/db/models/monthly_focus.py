from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, UniqueConstraint, CheckConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class MonthlyFocus(Base):
    __tablename__ = "monthly_focus"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month = Column(String(7), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    progress = Column(Integer)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "month", name="monthly_focus_user_id_month_key"),
        CheckConstraint("progress >= 0 AND progress <= 100", name="monthly_focus_progress_check"),
    )

