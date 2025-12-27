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
    # For cross-domain (mylifeos.dev -> railway.app), use SameSite=None
    # Once subdomain (api.mylifeos.dev) is set up, we can switch to SameSite=Lax with domain=.mylifeos.dev
    # For now, use SameSite=None to work with current cross-domain setup
    cookie_kwargs = {
        "httponly": True,
        "samesite": "none" if IS_PRODUCTION else "lax",  # None for cross-domain, Lax for same-origin
        "secure": True,  # Always True (required for SameSite=None and HTTPS)
        "path": "/",
        # Do NOT set domain attribute for cross-domain cookies
        # Setting domain prevents cookies from being sent cross-domain
        # Once subdomain is set up, we can add domain=".mylifeos.dev"
    }
    
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
        "samesite": "none" if IS_PRODUCTION else "lax",  # Match the setting used when setting cookies
        "secure": True,  # Always True (required for HTTPS)
        "path": "/",  # Match the path used when setting cookies
        # Do NOT set domain - match the setting used when setting cookies
    }
    
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

async def lock_account(user_id: str, minutes: int = 30):
    """Lock user account for specified minutes."""
    from db.repo import db_repo
    
    locked_until = (datetime.utcnow() + timedelta(minutes=minutes)).isoformat()
    await db_repo.update_user(user_id, {
        "locked_until": locked_until,
        "failed_login_attempts": 5
    })

async def handle_failed_login(user: dict) -> bool:
    """
    Handle failed login attempt. Returns True if account should be locked.
    
    Returns:
        True if account should be locked, False otherwise
    """
    from db.repo import db_repo
    
    attempts = user.get("failed_login_attempts", 0) + 1
    
    if attempts >= 5:
        await lock_account(user["id"], minutes=30)
        return True
    
    await db_repo.update_user(user["id"], {"failed_login_attempts": attempts})
    return False

async def clear_failed_attempts(user_id: str):
    """Clear failed login attempts on successful login."""
    from db.repo import db_repo
    await db_repo.update_user(user_id, {
        "failed_login_attempts": 0,
        "locked_until": None
    })

