from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.session import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    label = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "label", name="categories_user_id_label_key"),
    )

