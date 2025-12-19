from sqlalchemy import Column, String, Date, Text, TIMESTAMP, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    content = Column(Text, default="", nullable=False)
    photo_filename = Column(String(500))
    photo_uploaded_at = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="notes_user_id_date_key"),
    )

