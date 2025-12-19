from sqlalchemy import Column, String, Boolean, Integer, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    username = Column(String(100))
    avatar_path = Column(String(500))
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255))
    verification_token_expires = Column(TIMESTAMP)
    reset_token = Column(String(255))
    reset_token_expires = Column(TIMESTAMP)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(TIMESTAMP)
    refresh_token = Column(Text)
    refresh_token_expires = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp(), nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), nullable=False)

