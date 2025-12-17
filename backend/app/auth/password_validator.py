"""
Password validation utilities for LifeOS.
Enforces strong password rules.
"""

import re
from typing import Tuple, Optional

def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password strength.
    
    Rules:
    - Minimum 8 characters
    - At least 1 letter
    - At least 1 number
    - At least 1 symbol
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if not re.search(r'[a-zA-Z]', password):
        return False, "Password must contain at least one letter"
    
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number"
    
    if not re.search(r'[^a-zA-Z0-9]', password):
        return False, "Password must contain at least one symbol"
    
    return True, None

def get_password_requirements() -> list[str]:
    """Get list of password requirements for UI display."""
    return [
        "Minimum 8 characters",
        "At least 1 letter",
        "At least 1 number",
        "At least 1 symbol"
    ]

