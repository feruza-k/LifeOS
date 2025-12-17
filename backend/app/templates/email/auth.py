from __future__ import annotations

from textwrap import dedent

def _build_verification_url(frontend_url: str, token: str) -> str:
    base = frontend_url.rstrip("/")
    return f"{base}/verify-email?token={token}"

def _build_reset_url(frontend_url: str, token: str) -> str:
    base = frontend_url.rstrip("/")
    return f"{base}/auth?mode=reset-password&token={token}"

def render_verification_email(email: str, token: str, frontend_url: str, username: str | None = None) -> tuple[str, str, str]:
    """Return (subject, html, text) for email verification."""
    verification_url = _build_verification_url(frontend_url, token)
    subject = "Verify your LifeOS email"
    greeting = f"Hi {username}," if username else "Hi,"

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
          <h1 style="color: #8f5774; margin-bottom: 12px;">Verify your email</h1>
          <p style="margin: 0 0 16px 0;">{greeting}</p>
          <p style="margin: 0 0 16px 0;">Thanks for signing up for LifeOS. Please verify your email address to activate your account.</p>
          <p style="margin: 24px 0;">
            <a href="{verification_url}"
               style="background-color: #8f5774; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Verify Email
            </a>
          </p>
          <p style="margin: 0 0 12px 0;">Or copy and paste this link into your browser:</p>
          <p style="margin: 0 0 20px 0; word-break: break-all; color: #334155; font-size: 14px;">{verification_url}</p>
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px 0;">This link will expire in 24 hours.</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">If you did not create an account, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """

    text = dedent(
        f"""
        Verify your email

        {greeting}

        Thanks for signing up for LifeOS. Please verify your email address:

        {verification_url}

        This link will expire in 24 hours.
        If you did not create an account, you can ignore this message.
        """
    ).strip()

    return subject, html, text

def render_password_reset_email(email: str, token: str, frontend_url: str, username: str | None = None) -> tuple[str, str, str]:
    """Return (subject, html, text) for password reset."""
    reset_url = _build_reset_url(frontend_url, token)
    subject = "Reset your LifeOS password"
    greeting = f"Hi {username}," if username else "Hi,"

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px; background-color: #ffffff;">
          <h1 style="color: #8f5774; margin-bottom: 12px;">Reset your password</h1>
          <p style="margin: 0 0 16px 0;">{greeting}</p>
          <p style="margin: 0 0 16px 0;">We received a request to reset your password. Click the button below to continue.</p>
          <p style="margin: 24px 0;">
            <a href="{reset_url}"
               style="background-color: #8f5774; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Reset Password
            </a>
          </p>
          <p style="margin: 0 0 12px 0;">Or copy and paste this link into your browser:</p>
          <p style="margin: 0 0 12px 0; word-break: break-all; color: #334155; font-size: 14px;">{reset_url}</p>
          <p style="margin: 0 0 8px 0; color: #334155;">This link expires in 15 minutes.</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">If you did not request a reset, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """

    text = dedent(
        f"""
        Reset your password

        {greeting}

        We received a request to reset your LifeOS password. Use this link:

        {reset_url}

        This link expires in 15 minutes.
        If you didn't request this, you can ignore this email.
        """
    ).strip()

    return subject, html, text

