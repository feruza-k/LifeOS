"""Security utilities for authentication."""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import os

IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    domain: Optional[str] = None
):
    """
    Set httpOnly, secure cookies for access and refresh tokens.
    
    Args:
        response: FastAPI Response object
        access_token: JWT access token
        refresh_token: JWT refresh token
        domain: Cookie domain (optional)
    """
    # Cookie settings for security
    # SameSite=Lax works in development with Vite proxy (makes frontend/backend same-origin)
    # In production, Secure=True requires HTTPS
    cookie_kwargs = {
        "httponly": True,
        "samesite": "lax",
        "secure": IS_PRODUCTION,
        "path": "/",
    }
    
    if domain and IS_PRODUCTION:
        cookie_kwargs["domain"] = domain
    
    # Access token: 30 minutes
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=30 * 60,
        **cookie_kwargs
    )
    
    # Refresh token: 30 days
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=30 * 24 * 60 * 60,
        **cookie_kwargs
    )

def clear_auth_cookies(response: Response, domain: Optional[str] = None):
    """Clear authentication cookies."""
    cookie_kwargs = {
        "httponly": True,
        "samesite": "lax",
        "secure": IS_PRODUCTION,
        "path": "/",  # Match the path used when setting cookies
    }
    
    if domain and IS_PRODUCTION:
        cookie_kwargs["domain"] = domain
    
    response.set_cookie(key="access_token", value="", max_age=0, **cookie_kwargs)
    response.set_cookie(key="refresh_token", value="", max_age=0, **cookie_kwargs)

def get_token_from_cookie(request: Request, token_type: str = "access") -> Optional[str]:
    """
    Get token from httpOnly cookie.
    
    Args:
        request: FastAPI Request object
        token_type: "access" or "refresh"
    
    Returns:
        Token string or None
    """
    cookie_name = f"{token_type}_token"
    return request.cookies.get(cookie_name)

def is_account_locked(user: dict) -> bool:
    """
    Check if user account is locked.
    
    Returns:
        True if account is locked, False otherwise
    """
    locked_until = user.get("locked_until")
    if not locked_until:
        return False
    
    try:
        locked_dt = datetime.fromisoformat(locked_until)
        if datetime.utcnow() < locked_dt:
            return True
        # Lock expired - clear it
        return False
    except:
        return False

def lock_account(user_id: str, minutes: int = 30):
    """Lock user account for specified minutes."""
    from app.storage.repo import repo
    
    locked_until = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()
    repo.update_user(user_id, {
        "locked_until": locked_until,
        "failed_login_attempts": 5
    })

def handle_failed_login(user: dict) -> bool:
    """
    Handle failed login attempt. Returns True if account should be locked.
    
    Returns:
        True if account should be locked, False otherwise
    """
    from app.storage.repo import repo
    
    attempts = user.get("failed_login_attempts", 0) + 1
    
    if attempts >= 5:
        lock_account(user["id"], minutes=30)
        return True
    
    repo.update_user(user["id"], {"failed_login_attempts": attempts})
    return False

def clear_failed_attempts(user_id: str):
    """Clear failed login attempts on successful login."""
    from app.storage.repo import repo
    repo.update_user(user_id, {
        "failed_login_attempts": 0,
        "locked_until": None
    })

