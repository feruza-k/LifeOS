"""Production-ready email service using Resend."""

import os
from typing import Optional

import requests

from app.logging import logger

def _env_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "LifeOS <noreply@mylifeos.dev>").strip().strip("'\"")
EMAIL_ENABLED = _env_bool("EMAIL_ENABLED", True)

RESEND_URL = "https://api.resend.com/emails"

class EmailDeliveryError(Exception):
    """Raised when email delivery fails."""

def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    """
    Send an email using Resend.

    Raises:
        EmailDeliveryError: if sending fails.
        ValueError: if configuration is missing while EMAIL_ENABLED is True.
    """
    if not EMAIL_ENABLED:
        logger.info("Email disabled via EMAIL_ENABLED. Skipping send to %s", to)
        return

    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is not configured.")

    if not EMAIL_FROM:
        raise ValueError("EMAIL_FROM is not configured.")

    payload = {
        "from": EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }

    if text:
        payload["text"] = text

    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info("Sending email to %s with subject '%s'", to, subject)
    logger.info("Email config - From: %s, Enabled: %s, Has API Key: %s", EMAIL_FROM, EMAIL_ENABLED, bool(RESEND_API_KEY))

    try:
        response = requests.post(RESEND_URL, json=payload, headers=headers, timeout=10)
    except Exception as e:
        logger.error("Network error sending email: %s", e, exc_info=True)
        raise EmailDeliveryError(f"Network error sending email: {e}")

    if response.status_code >= 400:
        error_body = response.text
        logger.error("Email send failed: status=%s body=%s", response.status_code, error_body)
        
        # Parse error response to provide helpful message
        try:
            error_data = response.json()
            error_message = error_data.get("message", "")
            logger.error("Resend error message: %s", error_message)
            
            # Check if it's a domain verification issue
            if "verify a domain" in error_message.lower() or "testing emails" in error_message.lower() or response.status_code == 403:
                logger.error("⚠️  RESEND DOMAIN VERIFICATION REQUIRED:")
                logger.error("   Resend only allows sending to verified emails without a domain.")
                logger.error("   Current EMAIL_FROM: %s", EMAIL_FROM)
                logger.error("   To send to all emails, verify a domain at: https://resend.com/domains")
                logger.error("   Or use a verified email address for testing (e.g., onboarding@resend.dev)")
                
        except Exception as e:
            logger.error("Could not parse error response: %s", e)
        
        raise EmailDeliveryError(f"Failed to send email: {response.status_code} - {error_body}")

    logger.info("✅ Email sent successfully to %s", to)

