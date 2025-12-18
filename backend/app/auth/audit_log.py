"""Audit logging for authentication events."""

import json
from datetime import datetime
from typing import Optional
from fastapi import Request
from app.logging import logger

def log_auth_event(
    event_type: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
    details: Optional[dict] = None
):
    """
    Log structured authentication events.
    
    Args:
        event_type: Type of event (login_success, login_failure, account_locked, etc.)
        user_id: User ID if available
        email: Email address if available (normalized)
        ip: IP address
        user_agent: User agent string
        success: Whether the operation was successful
        details: Additional event details
    """
    event = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "success": success,
    }
    
    if user_id:
        event["user_id"] = user_id
    if email:
        event["email"] = email.lower()
    if ip:
        event["ip"] = ip
    if user_agent:
        event["user_agent"] = user_agent
    if details:
        event["details"] = details
    
    logger.info(f"AUTH_EVENT: {json.dumps(event)}")

def get_client_info(request: Request) -> tuple[str, str]:
    """Extract IP and user agent from request."""
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    return ip, user_agent

