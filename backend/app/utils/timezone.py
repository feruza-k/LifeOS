"""
Timezone utility functions
Automatically detects timezone from request headers or falls back to UTC
"""
import pytz
from typing import Optional
from fastapi import Request

def get_timezone_from_request(request: Request) -> pytz.BaseTzInfo:
    """
    Get timezone from request header X-Timezone, or fall back to UTC.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        pytz timezone object
    """
    timezone_str = request.headers.get("X-Timezone")
    if timezone_str:
        try:
            return pytz.timezone(timezone_str)
        except pytz.exceptions.UnknownTimeZoneError:
            # Invalid timezone, fall back to UTC
            pass
    
    # Fall back to UTC if no timezone header or invalid timezone
    return pytz.UTC

def get_timezone_string_from_request(request: Request) -> str:
    """
    Get timezone string from request header X-Timezone, or fall back to UTC.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Timezone string (e.g., "America/New_York", "UTC")
    """
    timezone_str = request.headers.get("X-Timezone")
    if timezone_str:
        try:
            # Validate it's a valid timezone
            pytz.timezone(timezone_str)
            return timezone_str
        except pytz.exceptions.UnknownTimeZoneError:
            pass
    
    return "UTC"
