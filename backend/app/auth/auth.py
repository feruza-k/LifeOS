"""
Authentication utilities for LifeOS.
Handles JWT token creation, password hashing, and user verification.
"""

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

# Security configuration
# SECRET_KEY must be set in environment variables - fail fast if missing
try:
    SECRET_KEY = os.environ["SECRET_KEY"]
except KeyError:
    raise ValueError(
        "SECRET_KEY environment variable is required. "
        "Set it in your .env file or export it: "
        "export SECRET_KEY=$(openssl rand -hex 32)"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 minutes - short-lived
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

async def get_token_from_request(request: Request) -> Optional[str]:
    """Extract token from cookie or Authorization header."""
    from app.auth.security import get_token_from_cookie
    
    # Try cookie first (preferred for security)
    token = get_token_from_cookie(request, "access")
    
    # Fallback to Authorization header for backwards compatibility
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    return token

def create_refresh_token(user_id: str) -> str:
    """Create a refresh token valid for 30 days."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": user_id,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_refresh_token(token: str) -> Optional[str]:
    """Verify and extract user_id from refresh token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    # Truncate to 72 bytes if necessary (bcrypt limitation)
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt. Bcrypt has a 72 byte limit."""
    # Truncate password to 72 bytes if necessary (bcrypt limitation)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Dictionary containing token payload (must include 'sub' for user_id)
        expires_delta: Optional expiration time delta
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    # Set expiration time
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    # Add standard JWT claims
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "sub": data["sub"],
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_verification_token() -> str:
    """Generate a random verification token."""
    return secrets.token_urlsafe(32)

def generate_reset_token() -> str:
    """Generate a random password reset token."""
    return secrets.token_urlsafe(32)

async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
):
    """
    Dependency to get the current authenticated user from JWT token.
    Supports both cookie-based and header-based token extraction.
    
    Raises:
        HTTPException: If token is invalid or user doesn't exist
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Skip authentication for OPTIONS requests (CORS preflight)
    # Middleware handles this, but ensure we don't try to authenticate preflight requests
    if request.method == "OPTIONS":
        raise HTTPException(status_code=status.HTTP_200_OK, detail="OK")
    
    # Try to get token from cookie if not in header
    if not token:
        token = await get_token_from_request(request)
    
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Verify user exists
    from db.repo import db_repo
    user = await db_repo.get_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    
    return user
