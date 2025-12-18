"""Rate limiting for authentication endpoints."""

from fastapi import Request, HTTPException, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

def get_ip_rate_limit_key(request: Request) -> str:
    """Get rate limit key based on IP only."""
    return get_remote_address(request)

def rate_limit_error_handler(request: Request, exc: RateLimitExceeded):
    """Custom error handler for rate limit exceeded."""
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many login attempts. Please try again in 15 minutes.",
    )

