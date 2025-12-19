from sqlalchemy import Column, String, Date, Text, TIMESTAMP, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.sql import func
from db.session import Base

class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    completed_task_ids = Column(ARRAY(UUID(as_uuid=True)), default=[], nullable=False)
    incomplete_task_ids = Column(ARRAY(UUID(as_uuid=True)), default=[], nullable=False)
    moved_tasks = Column(JSONB, default=[], nullable=False)
    note = Column(Text)
    mood = Column(String(10))
    timestamp = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="checkins_user_id_date_key"),
    )

