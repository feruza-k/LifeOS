from sqlalchemy import Column, String, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from db.session import Base

class PendingAction(Base):
    __tablename__ = "pending_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action_type = Column(String(50), nullable=False)
    action_data = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    expires_at = Column(TIMESTAMP)

