from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class DiaryEntry(Base):
    __tablename__ = "diary_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    category = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

