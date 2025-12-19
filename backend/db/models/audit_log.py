from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from db.session import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    details = Column(JSONB)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

