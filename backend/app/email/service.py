"""
Email service for LifeOS.
Supports development (console) and production (SMTP) modes.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Email configuration
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")  # Your email
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Your app password
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "LifeOS")

# Use development mode if SMTP credentials are not set
USE_DEVELOPMENT_MODE = not (SMTP_USER and SMTP_PASSWORD)


class EmailService:
    """Base email service interface."""
    
    def send_email(self, to: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Send an email. Returns True if successful."""
        raise NotImplementedError


class DevelopmentEmailService(EmailService):
    """Development email service - logs emails to console."""
    
    def send_email(self, to: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Log email to console instead of sending."""
        print(f"\n{'='*70}")
        print(f"📧 EMAIL (Development Mode)")
        print(f"{'='*70}")
        print(f"To: {to}")
        print(f"Subject: {subject}")
        print(f"{'-'*70}")
        if text_body:
            print(f"\n{text_body}")
        else:
            # Extract text from HTML (basic)
            import re
            text = re.sub(r'<[^>]+>', '', html_body)
            text = text.replace('&nbsp;', ' ')
            print(f"\n{text}")
        print(f"{'='*70}\n")
        return True


class SMTPEmailService(EmailService):
    """Production email service using SMTP."""
    
    def send_email(self, to: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
        """Send email via SMTP."""
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM}>"
            msg['To'] = to
            
            # Create text and HTML parts
            if text_body:
                text_part = MIMEText(text_body, 'plain')
                msg.attach(text_part)
            
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            
            return True
        except Exception as e:
            print(f"❌ Failed to send email: {e}")
            return False


# Create email service instance based on configuration
if USE_DEVELOPMENT_MODE:
    email_service = DevelopmentEmailService()
    print("📧 Email service: Development mode (logging to console)")
else:
    email_service = SMTPEmailService()
    print(f"📧 Email service: Production mode (SMTP: {SMTP_HOST})")


def send_verification_email(email: str, token: str) -> bool:
    """Send email verification email."""
    verification_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/verify-email?token={token}"
    
    subject = "Verify your LifeOS email"
    
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #8f5774;">Verify your email</h1>
          <p>Thanks for signing up for LifeOS! Please verify your email address by clicking the button below:</p>
          <p style="margin: 30px 0;">
            <a href="{verification_url}" 
               style="background-color: #8f5774; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 14px;">{verification_url}</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"""
Verify your email

Thanks for signing up for LifeOS! Please verify your email address by visiting this link:

{verification_url}

If you didn't create an account, you can safely ignore this email.

This link will expire in 24 hours.
    """
    
    return email_service.send_email(email, subject, html_body, text_body)


def send_password_reset_email(email: str, token: str) -> bool:
    """Send password reset email."""
    reset_url = f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/auth?mode=reset-password&token={token}"
    
    subject = "Reset your LifeOS password"
    
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #8f5774;">Reset your password</h1>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <p style="margin: 30px 0;">
            <a href="{reset_url}" 
               style="background-color: #8f5774; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or use this reset token:</p>
          <p style="background-color: #f5f5f5; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 2px; text-align: center; margin: 20px 0;">
            {token}
          </p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">This link will expire in 15 minutes.</p>
        </div>
      </body>
    </html>
    """
    
    text_body = f"""
Reset your password

We received a request to reset your password. Use this reset token:

{token}

Or visit this link:
{reset_url}

If you didn't request a password reset, you can safely ignore this email.

This token will expire in 15 minutes.
    """
    
    return email_service.send_email(email, subject, html_body, text_body)

