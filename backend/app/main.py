from datetime import datetime, timedelta
import os
import sys
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Depends, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr

from app.ai.parser import test_ai_connection, parse_intent
from app.ai.assistant import generate_assistant_response
from app.storage.repo import repo, load_data, save_data
from app.storage.photo_storage import save_photo, delete_photo, get_photo_path, photo_exists
from app.logic.intent_handler import handle_intent
from app.logic.today_engine import get_today_view
from app.logic.suggestion_engine import get_suggestions
from app.logic.categories import get_category_colors
from app.logic.week_engine import get_tasks_in_range, get_week_stats
from app.logic.reschedule_engine import generate_reschedule_suggestions
from app.logic.conflict_engine import find_conflicts
from app.logic.task_engine import get_all_tasks
from app.logic.frontend_adapter import backend_task_to_frontend, frontend_task_to_backend
from app.models.ui import AssistantReply
from app.services.email_service import send_email
from app.templates.email.auth import render_password_reset_email, render_verification_email
from app.logging import logger
from app.auth.rate_limiter import limiter, rate_limit_error_handler, get_ip_rate_limit_key
from app.auth.audit_log import log_auth_event, get_client_info
from app.auth.middleware import SecurityHeadersMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

load_dotenv()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Allow localhost and common network IPs for development
default_origins = "http://localhost:5173,http://localhost:8080,http://192.168.1.5:8080,http://192.168.1.5:5173"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", default_origins).split(",")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS]
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

try:
    from app.auth.auth import (
        create_access_token,
        get_password_hash,
        verify_password,
        get_current_user,
        ACCESS_TOKEN_EXPIRE_MINUTES
    )
except ValueError as e:
    print(f"\n❌ Authentication setup error: {e}\n", file=sys.stderr)
    sys.exit(1)

app = FastAPI(
    title="LifeOS Backend",
    description="AI-powered personal planning assistant backend",
    version="0.1"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_error_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
app.add_middleware(SecurityHeadersMiddleware)

class ChatRequest(BaseModel):
    message: str

class RepeatConfig(BaseModel):
    type: str  # "weekly", "period", "custom"
    weekDays: Optional[List[int]] = None  # 0-6 for Sun-Sat
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    customDates: Optional[List[str]] = None

class TaskCreateRequest(BaseModel):
    title: str
    time: str | None = None
    endTime: str | None = None
    completed: bool = False
    value: str = "work"
    date: str
    createdAt: str | None = None
    movedFrom: str | None = None
    repeat: Optional[RepeatConfig] = None

class TaskUpdateRequest(BaseModel):
    title: str | None = None
    time: str | None = None
    endTime: str | None = None
    completed: bool | None = None
    value: str | None = None
    date: str | None = None
    movedFrom: str | None = None

class NoteRequest(BaseModel):
    date: str
    content: str
    id: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None

class CheckInRequest(BaseModel):
    date: str
    completedTaskIds: list[str]
    incompleteTaskIds: list[str]
    movedTasks: list[dict]
    note: str | None = None
    mood: str | None = None

# Auth models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    username: str  # Required field

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: str
    username: str | None = None
    email_verified: bool = False
    avatar_path: str | None = None

class ReminderRequest(BaseModel):
    title: str
    description: str | None = None
    dueDate: str | None = None
    time: str | None = None
    type: str | None = None
    note: str | None = None
    recurring: str | None = None
    visible: bool = True
    id: str | None = None
    createdAt: str | None = None

class MonthlyFocusRequest(BaseModel):
    month: str
    title: str
    description: str | None = None
    progress: int | None = None
    id: str | None = None
    createdAt: str | None = None

@app.options("/{full_path:path}")
async def catch_all_options(request: Request, full_path: str):
    """Catch-all OPTIONS handler for CORS preflight - must be registered early"""
    origin = request.headers.get("Origin")
    allowed_origin = "*"
    if origin:
        if origin in ALLOWED_ORIGINS:
            allowed_origin = origin
        elif "*" in ALLOWED_ORIGINS:
            allowed_origin = "*"
    
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allowed_origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
        }
    )

@app.get("/")
def home():
    """Basic API health check."""
    return {"message": "LifeOS API is running 🚀"}

@app.get("/ai-test")
def ai_test():
    return {"response": test_ai_connection()}

@app.post("/parse")
def parse_endpoint(user_input: str):
    return parse_intent(user_input)

@app.get("/process")
def process(text: str):
    intent = parse_intent(text)
    result = handle_intent(intent)
    return {"intent": intent, "result": result}

@app.get("/tasks")
def get_tasks():
    return get_all_tasks()

@app.get("/all")
def get_all():
    return load_data()

@app.post("/clear")
def clear_data():
    empty = {"tasks": [], "diary": [], "memories": [], "pending": {}, "notes": [], "checkins": [], "reminders": [], "monthly_focus": []}
    save_data(empty)
    repo.data = empty
    return {"status": "cleared"}

@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    result = repo.toggle_task_complete(task_id, current_user["id"])
    if result:
        return {"status": "completed" if result.get("completed") else "incomplete", "task": result}
    return {"error": "Task not found"}

@app.post("/auth/signup", response_model=Token)
@limiter.limit("5/15minutes", key_func=get_ip_rate_limit_key)
def signup(request: Request, response: Response, user_data: UserCreate):
    from app.auth.password_validator import validate_password_strength
    
    # Validate passwords match
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    email_normalized = user_data.email.lower().strip()
    existing_user = repo.get_user_by_email(email_normalized)
    
    if existing_user:
        existing_user = repo.get_user_by_id(existing_user["id"])
        email_verified = existing_user.get("email_verified", False) if existing_user else False
        
        if email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered and verified. Please log in instead."
            )
    
    from app.auth.auth import generate_verification_token
    verification_token = generate_verification_token()
    verification_expires = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    
    if existing_user:
        final_check_user = repo.get_user_by_id(existing_user["id"])
        if final_check_user and not final_check_user.get("email_verified", False):
            hashed_password = get_password_hash(user_data.password)
            repo.update_user(existing_user["id"], {
                "password": hashed_password,
                "username": user_data.username or existing_user.get("username"),
                "verification_token": verification_token,
                "verification_token_expires": verification_expires
            })
            user = repo.get_user_by_id(existing_user["id"])
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update user"
                )
        elif final_check_user and final_check_user.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered and verified. Please log in instead."
            )
        else:
            existing_user = None
    
    if not existing_user:
        hashed_password = get_password_hash(user_data.password)
        user = repo.create_user(
            email=email_normalized,
            hashed_password=hashed_password,
            username=user_data.username,
            verification_token=verification_token
        )
        repo.update_user(user["id"], {
            "verification_token_expires": verification_expires
        })
    
    verification_url = f"{FRONTEND_URL.rstrip('/')}/verify-email?token={verification_token}"
    
    try:
        username = user.get("username") if user else user_data.username
        subject, html, text = render_verification_email(
            user_data.email,
            verification_token,
            FRONTEND_URL,
            username=username
        )
        logger.info(f"Calling send_email for {user_data.email}...")
        send_email(user_data.email, subject, html, text)
        logger.info(f"✅ Verification email sent successfully to {user_data.email}")
    except ValueError as e:
        # Configuration error - log and fail loudly
        logger.error(f"❌ Email configuration error: {e}", exc_info=True)
        logger.error(f"   Verification URL for manual use: {verification_url}")
    except Exception as e:
        # Other email errors - log but don't fail signup
        from app.services.email_service import EmailDeliveryError
        error_type = type(e).__name__
        logger.error(f"❌ Failed to send verification email to {user_data.email}: {error_type}: {e}", exc_info=True)
        
        # For development: log the verification link to console
        logger.error("=" * 70)
        logger.error("⚠️  EMAIL NOT SENT - DEVELOPMENT MODE")
        logger.error(f"   Email: {user_data.email}")
        logger.error(f"   Verification URL: {verification_url}")
        logger.error(f"   Token: {verification_token}")
        logger.error("")
        logger.error("   To verify manually, use:")
        logger.error(f"   curl -X POST http://localhost:8000/auth/verify-email-by-token \\")
        logger.error(f"        -H 'Content-Type: application/json' \\")
        logger.error(f"        -d '{{\"token\": \"{verification_token}\"}}'")
        logger.error("=" * 70)
        
        if isinstance(e, EmailDeliveryError):
            logger.error("   This is likely due to Resend domain verification requirements.")
            logger.error("   See backend logs above for details.")
        
        # User account is still created, they can use resend-verification endpoint
    
    # Create tokens and set cookies
    from app.auth.auth import create_refresh_token
    from app.auth.security import set_auth_cookies
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(user["id"])
    
    refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    repo.update_user(user["id"], {
        "refresh_token": refresh_token,
        "refresh_token_expires": refresh_token_expires
    })
    
    ip, user_agent = get_client_info(request)
    log_auth_event(
        "signup_success",
        user_id=user["id"],
        email=user_data.email,
        ip=ip,
        user_agent=user_agent,
        success=True
    )
    
    # Create JSONResponse and set cookies on it
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, refresh_token)
    return json_response

@app.post("/auth/login")
@limiter.limit("6/15minutes", key_func=get_ip_rate_limit_key)  # 6 attempts allows account lockout at 5 to trigger first
def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    from app.auth.security import is_account_locked, handle_failed_login, clear_failed_attempts
    from slowapi.util import get_remote_address
    
    email_normalized = form_data.username.lower().strip()
    ip, user_agent = get_client_info(request)
    
    user = repo.get_user_by_email(email_normalized)
    
    # Check account lockout (but don't reveal user existence if no user)
    if user and is_account_locked(user):
        log_auth_event(
            "account_locked_login_attempt",
            user_id=user["id"],
            email=email_normalized,
            ip=ip,
            user_agent=user_agent,
            success=False,
            details={"reason": "account_locked"}
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed login attempts. Please try again later or use the unlock link sent to your email.",
        )
    
    # Verify credentials (don't reveal user existence)
    if not user or not verify_password(form_data.password, user.get("password", "")):
        if user:
            should_lock = handle_failed_login(user)
            if should_lock:
                log_auth_event(
                    "account_locked",
                    user_id=user["id"],
                    email=email_normalized,
                    ip=ip,
                    user_agent=user_agent,
                    success=False
                )
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail="Account temporarily locked due to too many failed login attempts. Please try again later.",
                )
        
        log_auth_event(
            "login_failure",
            email=email_normalized,
            ip=ip,
            user_agent=user_agent,
            success=False
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Clear failed attempts on successful login
    clear_failed_attempts(user["id"])
    
    # Create tokens
    from app.auth.auth import create_refresh_token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(user["id"])
    
    # Store refresh token
    refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    repo.update_user(user["id"], {
        "refresh_token": refresh_token,
        "refresh_token_expires": refresh_token_expires
    })
    
    # Set httpOnly cookies
    from app.auth.security import set_auth_cookies
    
    log_auth_event(
        "login_success",
        user_id=user["id"],
        email=email_normalized,
        ip=ip,
        user_agent=user_agent,
        success=True
    )
    
    # Create JSONResponse and set cookies on it
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, refresh_token)
    return json_response

class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None

@app.post("/auth/refresh")
def refresh_token(request: Request, response: Response, req: RefreshTokenRequest | None = None):
    """Refresh access token using refresh token from cookie or request body."""
    from app.auth.security import get_token_from_cookie, set_auth_cookies
    from app.auth.auth import verify_refresh_token
    
    # Try to get refresh token from cookie first
    refresh_token_value = get_token_from_cookie(request, "refresh")
    
    # Fallback to request body if not in cookie
    if not refresh_token_value and req and req.refresh_token:
        refresh_token_value = req.refresh_token
    
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )
    
    # Verify refresh token
    user_id = verify_refresh_token(refresh_token_value)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    # Verify refresh token matches stored token (rotation check)
    user = repo.get_user_by_id(user_id)
    if not user or user.get("refresh_token") != refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Check if refresh token expired
    refresh_token_expires = user.get("refresh_token_expires")
    if refresh_token_expires:
        try:
            expires_dt = datetime.fromisoformat(refresh_token_expires)
            if datetime.utcnow() > expires_dt:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Refresh token expired"
                )
        except:
            pass
    
    # Generate new tokens (rotation: invalidate old refresh token)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(user_id)
    
    # Store new refresh token (old one is invalidated)
    new_refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    repo.update_user(user_id, {
        "refresh_token": new_refresh_token,
        "refresh_token_expires": new_refresh_token_expires
    })
    
    # Create JSONResponse and set cookies on it
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, new_refresh_token)
    return json_response

@app.post("/auth/logout")
def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user)):
    """Logout user and revoke refresh token."""
    from app.auth.security import clear_auth_cookies, get_token_from_cookie
    from app.auth.auth import verify_refresh_token
    
    # Revoke refresh token
    refresh_token_value = get_token_from_cookie(request, "refresh")
    if refresh_token_value:
        user_id = verify_refresh_token(refresh_token_value)
        if user_id:
            repo.update_user(user_id, {
                "refresh_token": None,
                "refresh_token_expires": None
            })
    
    ip, user_agent = get_client_info(request)
    log_auth_event(
        "logout",
        user_id=current_user["id"],
        email=current_user.get("email"),
        ip=ip,
        user_agent=user_agent,
        success=True
    )
    
    # Clear cookies and return response
    json_response = JSONResponse(content={"message": "Logged out successfully"})
    clear_auth_cookies(json_response)
    return json_response

@app.options("/auth/me")
async def options_auth_me(request: Request):
    """Handle OPTIONS preflight for /auth/me"""
    origin = request.headers.get("Origin", "*")
    if origin in ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        return Response(status_code=200, headers={
            "Access-Control-Allow-Origin": origin if origin != "*" else "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Credentials": "true",
        })
    return Response(status_code=200)

@app.get("/auth/me", response_model=UserResponse)
def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "created_at": current_user["created_at"],
        "username": current_user.get("username"),
        "email_verified": current_user.get("email_verified", False),
        "avatar_path": current_user.get("avatar_path")
    }

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

@app.post("/auth/verify-email")
def verify_email(verify_data: VerifyEmailRequest, current_user: dict = Depends(get_current_user)):
    user = repo.get_user_by_id(current_user["id"])
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.get("email_verified"):
        return {"message": "Email already verified", "verified": True}
    
    if user.get("verification_token") != verify_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    # Verify email
    repo.update_user(user["id"], {
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None
    })
    
    return {"message": "Email verified successfully", "verified": True}

@app.post("/auth/verify-email-by-token")
def verify_email_by_token(request: Request, verify_data: VerifyEmailRequest):
    """Verify user's email with token directly (DEVELOPMENT ONLY).
    
    ⚠️  WARNING: This endpoint bypasses email verification and should only be used
    for development/testing when emails cannot be sent (e.g., Resend domain not verified).
    
    In production, users should verify via the email link, not this endpoint.
    
    This endpoint doesn't require authentication and can be used when:
    - Email sending fails due to Resend restrictions (domain not verified)
    - Testing verification flow in development
    """
    # Find user by verification token
    user = repo.get_user_by_verification_token(verify_data.token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    if user.get("email_verified"):
        return {"message": "Email already verified", "verified": True}
    
    repo.update_user(user["id"], {
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None
    })
    
    return {"message": "Email verified successfully", "verified": True}

@app.post("/auth/resend-verification")
def resend_verification(req: ResendVerificationRequest):
    email_normalized = req.email.lower().strip()
    user = repo.get_user_by_email(email_normalized)
    
    if not user:
        return {"message": "If the email exists, a verification token has been sent"}
    
    if user.get("email_verified"):
        return {"message": "Email already verified"}
    
    from app.auth.auth import generate_verification_token
    verification_token = generate_verification_token()
    verification_expires = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    
    repo.update_user(user["id"], {
        "verification_token": verification_token,
        "verification_token_expires": verification_expires
    })
    
    try:
        username = user.get("username")
        subject, html, text = render_verification_email(
            req.email,
            verification_token,
            FRONTEND_URL,
            username=username
        )
        send_email(req.email, subject, html, text)
        logger.info(f"Verification email sent to {req.email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {req.email}: {e}", exc_info=True)
        # Still return success message for security (don't reveal if email exists)
    
    return {"message": "If the email exists, a verification token has been sent"}

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    email_normalized = req.email.lower().strip()
    user = repo.get_user_by_email(email_normalized)
    
    if not user:
        return {"message": "If the email exists, a password reset token has been sent"}
    
    if not user.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is registered but not yet verified. Please verify your email first, then you can reset your password."
        )
    
    from app.auth.auth import generate_reset_token
    reset_token = generate_reset_token()
    reset_expires = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
    
    repo.update_user(user["id"], {
        "reset_token": reset_token,
        "reset_token_expires": reset_expires
    })
    
    try:
        username = user.get("username")
        subject, html, text = render_password_reset_email(
            req.email,
            reset_token,
            FRONTEND_URL,
            username=username
        )
        send_email(req.email, subject, html, text)
        logger.info(f"Password reset email sent to {req.email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {req.email}: {e}", exc_info=True)
    
    return {"message": "If the email exists, a password reset token has been sent"}

@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    """Reset password using reset token."""
    from app.auth.password_validator import validate_password_strength
    
    # Validate passwords match
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(req.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Find user by reset token
    user = repo.get_user_by_reset_token(req.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password
    hashed_password = get_password_hash(req.new_password)
    repo.update_user(user["id"], {
        "password": hashed_password,
        "reset_token": None,
        "reset_token_expires": None
    })
    
    return {"message": "Password reset successfully"}

@app.post("/auth/change-password")
def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password (requires current password)."""
    from app.auth.password_validator import validate_password_strength
    
    user = repo.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify current password
    if not verify_password(req.current_password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Validate passwords match
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(req.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Update password
    hashed_password = get_password_hash(req.new_password)
    repo.update_user(user["id"], {
        "password": hashed_password
    })
    
    return {"message": "Password changed successfully"}

class UpdateProfileRequest(BaseModel):
    username: str | None = None

@app.patch("/auth/profile")
def update_profile(updates: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """Update user profile (username, etc.)."""
    user = repo.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_dict = {}
    if updates.username is not None:
        if not updates.username.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username cannot be empty"
            )
        update_dict["username"] = updates.username.strip()
    
    if not update_dict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updates provided"
        )
    
    updated_user = repo.update_user(user["id"], update_dict)
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "username": updated_user.get("username"),
        "email_verified": updated_user.get("email_verified", False),
        "avatar_path": updated_user.get("avatar_path"),
        "created_at": updated_user["created_at"]
    }

@app.delete("/auth/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data."""
    user_id = current_user["id"]
    
    # Delete all user data
    data = load_data()
    
    # Delete user's tasks
    data["tasks"] = [t for t in data.get("tasks", []) if t.get("user_id") != user_id]
    
    # Delete user's notes
    data["notes"] = [n for n in data.get("notes", []) if n.get("user_id") != user_id]
    
    # Delete user's check-ins
    data["checkins"] = [c for c in data.get("checkins", []) if c.get("user_id") != user_id]
    
    # Delete user's reminders
    data["reminders"] = [r for r in data.get("reminders", []) if r.get("user_id") != user_id]
    
    # Delete user's monthly focus
    data["monthly_focus"] = [f for f in data.get("monthly_focus", []) if f.get("user_id") != user_id]
    
    # Delete user's pending actions
    if user_id in data.get("pending", {}):
        del data["pending"][user_id]
    
    # Delete user account
    data["users"] = [u for u in data.get("users", []) if u.get("id") != user_id]
    
    save_data(data)
    
    return {"message": "Account deleted successfully"}

@app.post("/auth/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user avatar."""
    user = repo.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Delete old avatar if exists
    old_avatar_path = user.get("avatar_path")
    if old_avatar_path:
        try:
            # Extract filename from path
            import os
            old_filename = os.path.basename(old_avatar_path)
            delete_photo(old_filename)
        except:
            pass  # Ignore errors if file doesn't exist
    
    # Save new avatar with user-specific prefix
    # Use user ID as "date" parameter for filename organization
    saved_filename = save_photo(file, f"avatar_{current_user['id']}")
    
    # Update user record with avatar path
    avatar_url = f"/photos/{saved_filename}"
    repo.update_user(user["id"], {"avatar_path": avatar_url})
    
    return {"avatar_path": avatar_url, "message": "Avatar uploaded successfully"}

@app.delete("/auth/avatar")
def delete_avatar(current_user: dict = Depends(get_current_user)):
    """Delete user avatar."""
    user = repo.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    avatar_path = user.get("avatar_path")
    if not avatar_path:
        return {"message": "No avatar to delete"}
    
    # Extract filename from path
    import os
    filename = os.path.basename(avatar_path)
    try:
        delete_photo(filename)
    except:
        pass  # Ignore errors if file doesn't exist
    
    repo.update_user(user["id"], {"avatar_path": None})
    
    return {"message": "Avatar deleted successfully"}

# Frontend-Compatible Task Endpoints (Protected)

@app.get("/tasks/by-date")
def get_tasks_by_date(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a specific date in frontend format (user-scoped)."""
    tasks = repo.get_tasks_by_date_and_user(date, current_user["id"])
    return [backend_task_to_frontend(t) for t in tasks]

@app.post("/tasks")
def create_task(
    task_data: TaskCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task from frontend format. Handles recurring tasks (user-scoped)."""
    task_dict = task_data.model_dump(exclude_none=True)
    repeat_config = task_dict.pop("repeat", None)
    
    # Add user_id to all tasks
    task_dict["user_id"] = current_user["id"]
    
    # If no repeat config, create single task
    if not repeat_config:
        backend_task = frontend_task_to_backend(task_dict)
        # Ensure user_id is preserved (frontend_task_to_backend might not include it)
        backend_task["user_id"] = current_user["id"]
        result = repo.add_task_dict(backend_task)
        return backend_task_to_frontend(result)
    
    # Handle recurring tasks - create all instances
    created_tasks = []
    base_date = datetime.strptime(task_data.date, "%Y-%m-%d")
    
    if repeat_config["type"] == "weekly":
        # Create tasks for selected weekdays (next 52 weeks)
        if repeat_config.get("weekDays"):
            current_date = base_date
            weeks_created = 0
            while weeks_created < 52:  # Limit to 1 year
                if current_date.weekday() in repeat_config["weekDays"]:
                    task_dict["date"] = current_date.strftime("%Y-%m-%d")
                    backend_task = frontend_task_to_backend(task_dict)
                    backend_task["user_id"] = current_user["id"]
                    result = repo.add_task_dict(backend_task)
                    created_tasks.append(backend_task_to_frontend(result))
                    # Check if we've completed a full week cycle
                    if current_date.weekday() == max(repeat_config["weekDays"]):
                        weeks_created += 1
                current_date += timedelta(days=1)
                # Safety limit
                if (current_date - base_date).days > 365:
                    break
    
    elif repeat_config["type"] == "period":
        # Create tasks for date range
        if repeat_config.get("startDate") and repeat_config.get("endDate"):
            start = datetime.strptime(repeat_config["startDate"], "%Y-%m-%d")
            end = datetime.strptime(repeat_config["endDate"], "%Y-%m-%d")
            current_date = start
            while current_date <= end:
                task_dict["date"] = current_date.strftime("%Y-%m-%d")
                backend_task = frontend_task_to_backend(task_dict)
                result = repo.add_task_dict(backend_task)
                created_tasks.append(backend_task_to_frontend(result))
                current_date += timedelta(days=1)
    
    elif repeat_config["type"] == "custom":
        # Create tasks for custom dates
        if repeat_config.get("customDates"):
            for date_str in repeat_config["customDates"]:
                task_dict["date"] = date_str
                backend_task = frontend_task_to_backend(task_dict)
                result = repo.add_task_dict(backend_task)
                created_tasks.append(backend_task_to_frontend(result))
    
    # Return the first created task (for compatibility)
    return created_tasks[0] if created_tasks else backend_task_to_frontend(result)

@app.patch("/tasks/{task_id}")
def update_task(
    task_id: str,
    updates: TaskUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a task (user-scoped)."""
    updates_dict = updates.model_dump(exclude_none=True)
    # Convert frontend updates to backend format if needed
    backend_updates = {}
    if "value" in updates_dict:
        backend_updates["category"] = updates_dict["value"]
    if "endTime" in updates_dict and updates_dict.get("time") and updates_dict.get("date"):
        # Calculate duration
        try:
            start_hour, start_min = map(int, updates_dict["time"].split(":"))
            end_hour, end_min = map(int, updates_dict["endTime"].split(":"))
            start_total = start_hour * 60 + start_min
            end_total = end_hour * 60 + end_min
            duration = end_total - start_total
            if duration > 0:
                backend_updates["duration_minutes"] = duration
                backend_updates["end_datetime"] = f"{updates_dict['date']} {updates_dict['endTime']}"
        except:
            pass
    
    # Copy other fields directly
    for key in ["title", "date", "time", "completed"]:
        if key in updates_dict:
            backend_updates[key] = updates_dict[key]
    
    result = repo.update_task(task_id, backend_updates, current_user["id"])
    if result:
        return backend_task_to_frontend(result)
    return {"error": "Task not found"}

@app.delete("/tasks/{task_id}")
def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a task (user-scoped)."""
    success = repo.delete_task(task_id, current_user["id"])
    if success:
        return {"status": "deleted", "id": task_id}
    return {"error": "Task not found"}

@app.post("/tasks/{task_id}/move")
def move_task(
    task_id: str,
    new_date: str = Query(..., description="New date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Move a task to a new date (user-scoped)."""
    task = repo.get_task(task_id, current_user["id"])
    if not task:
        return {"error": "Task not found"}
    
    # Store original date as movedFrom
    updates = {
        "date": new_date,
        "moved_from": task.get("date")
    }
    result = repo.update_task(task_id, updates, current_user["id"])
    if result:
        return backend_task_to_frontend(result)
    return {"error": "Failed to move task"}

# Notes Endpoints

@app.get("/notes")
def get_note(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get note for a specific date (user-scoped)."""
    note = repo.get_note(date, current_user["id"])
    if note:
        return note
    return None

@app.post("/notes")
@app.put("/notes")
def save_note(
    note_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save or update a note (user-scoped)."""
    result = repo.save_note(note_data, current_user["id"])
    return result

# Photo Endpoints

@app.post("/photos/upload")
async def upload_photo(
    file: UploadFile = File(...),
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Upload or replace a photo for a specific date (only one photo per date, user-scoped)."""
    try:
        # Get existing note
        note = repo.get_note(date, current_user["id"])
        if not note:
            note = {"date": date, "content": "", "photo": None, "user_id": current_user["id"]}
        
        # Delete old photo if exists (handle both new format and old photos array format)
        if note.get("photo") and note["photo"] is not None and isinstance(note["photo"], dict) and note["photo"].get("filename"):
            old_filename = note["photo"]["filename"]
            delete_photo(old_filename)
        # Also handle old photos array format for backward compatibility
        elif note.get("photos") and isinstance(note["photos"], list) and len(note["photos"]) > 0:
            # Delete all old photos from array
            for old_photo in note["photos"]:
                if old_photo and isinstance(old_photo, dict) and old_photo.get("filename"):
                    delete_photo(old_photo["filename"])
        
        # Save new photo
        filename = save_photo(file, date)
        
        # Update note with single photo
        note["photo"] = {
            "filename": filename,
            "uploadedAt": datetime.now().isoformat()
        }
        repo.save_note(note, current_user["id"])
        
        return {"filename": filename, "uploadedAt": note["photo"]["uploadedAt"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload photo: {str(e)}")

@app.get("/photos/{filename}")
def get_photo(filename: str):
    """Get a photo file by filename."""
    if not photo_exists(filename):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo_path = get_photo_path(filename)
    return FileResponse(
        photo_path,
        media_type="image/jpeg"  # Default, could be improved with proper MIME type detection
    )

@app.delete("/photos/{filename}")
def delete_photo_endpoint(
    filename: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Delete a photo file and remove its reference from the note (user-scoped)."""
    if not photo_exists(filename):
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get note to verify ownership
    note = repo.get_note(date, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Verify the photo belongs to this note
    photo_matches = False
    if note.get("photo") and note["photo"] and isinstance(note["photo"], dict) and note["photo"].get("filename") == filename:
        photo_matches = True
    elif note.get("photos") and isinstance(note["photos"], list):
        photo_matches = any(p.get("filename") == filename for p in note["photos"])
    
    if not photo_matches:
        raise HTTPException(status_code=403, detail="Photo not found in your notes")
    
    # Delete the file
    delete_photo(filename)
    
    # Remove photo reference from note
    if "photo" in note and note["photo"] and note["photo"].get("filename") == filename:
        note["photo"] = None
        repo.save_note(note, current_user["id"])
    # Also handle old "photos" array format for backward compatibility
    elif "photos" in note:
        note["photos"] = [p for p in note["photos"] if p.get("filename") != filename]
        repo.save_note(note, current_user["id"])
    
    return {"success": True, "message": "Photo deleted"}

# Check-ins Endpoints

@app.get("/checkins")
def get_checkin(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get check-in for a specific date (user-scoped)."""
    checkin = repo.get_checkin(date, current_user["id"])
    if checkin:
        return checkin
    return None

@app.post("/checkins")
def save_checkin(
    checkin_data: CheckInRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save or update a check-in (user-scoped)."""
    result = repo.save_checkin(checkin_data.model_dump(exclude_none=True), current_user["id"])
    return result

# Reminders Endpoints (separate from task reminders)

@app.get("/reminders")
def get_all_reminders(current_user: dict = Depends(get_current_user)):
    """Get all reminders for the current user (separate from task reminders)."""
    return repo.get_reminders(current_user["id"])

@app.post("/reminders")
def create_reminder(reminder_data: ReminderRequest, current_user: dict = Depends(get_current_user)):
    """Create a new reminder (user-scoped)."""
    result = repo.add_reminder(reminder_data.model_dump(exclude_none=True), current_user["id"])
    return result

class ReminderUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    dueDate: str | None = None
    time: str | None = None
    type: str | None = None
    note: str | None = None
    recurring: str | None = None
    visible: bool | None = None

@app.patch("/reminders/{reminder_id}")
def update_reminder(reminder_id: str, updates: ReminderUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update a reminder (user-scoped)."""
    updates_dict = updates.model_dump(exclude_none=True)
    result = repo.update_reminder(reminder_id, updates_dict, current_user["id"])
    if result:
        return result
    return {"error": "Reminder not found"}

@app.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reminder (user-scoped)."""
    success = repo.delete_reminder(reminder_id, current_user["id"])
    if success:
        return {"status": "deleted", "id": reminder_id}
    return {"error": "Reminder not found"}

# Monthly Focus Endpoints

@app.get("/monthly-focus")
def get_monthly_focus(
    month: str = Query(..., description="Month in YYYY-MM format"),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly focus for a specific month (user-scoped)."""
    focus = repo.get_monthly_focus(month, current_user["id"])
    if focus:
        return focus
    return None

@app.post("/monthly-focus")
def save_monthly_focus(focus_data: MonthlyFocusRequest, current_user: dict = Depends(get_current_user)):
    """Save or update monthly focus (user-scoped)."""
    result = repo.save_monthly_focus(focus_data.model_dump(exclude_none=True), current_user["id"])
    return result

# Categories Endpoints

class CategoryRequest(BaseModel):
    label: str
    color: str
    id: str | None = None

class CategoryUpdateRequest(BaseModel):
    label: str | None = None
    color: str | None = None

@app.get("/categories")
def get_all_categories():
    """Get all categories."""
    return repo.get_categories()

@app.get("/categories/{category_id}")
def get_category(category_id: str):
    """Get a specific category by ID."""
    category = repo.get_category(category_id)
    if category:
        return category
    return {"error": "Category not found"}

@app.post("/categories")
def create_category(category_data: CategoryRequest):
    """Create a new category."""
    category_dict = category_data.model_dump(exclude_none=True)
    result = repo.add_category(category_dict)
    return result

@app.patch("/categories/{category_id}")
def update_category(category_id: str, updates: CategoryUpdateRequest):
    """Update a category."""
    updates_dict = updates.model_dump(exclude_none=True)
    result = repo.update_category(category_id, updates_dict)
    if result:
        return result
    return {"error": "Category not found"}

@app.delete("/categories/{category_id}")
def delete_category(category_id: str):
    """Delete a category."""
    success = repo.delete_category(category_id)
    if success:
        return {"status": "deleted", "id": category_id}
    return {"error": "Category not found"}

# Weekly & Calendar Views (Used by Frontend)

@app.get("/tasks/calendar")
def tasks_calendar(
    start: str = Query(...),
    end: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a date range, returned as flat array in frontend format (user-scoped)."""
    try:
        # Get user's tasks first
        user_tasks = repo.get_tasks_by_user(current_user["id"])
        # Filter by date range
        all_tasks = [
            backend_task_to_frontend(t) 
            for t in user_tasks 
            if start <= t.get("date", "") <= end
        ]
        return all_tasks
    except ValueError as e:
        return {"error": str(e)}

@app.get("/tasks/conflicts")
def tasks_conflicts(
    start: str | None = Query(None),
    end: str | None = Query(None),
):
    return find_conflicts(start, end)

# Assistant Endpoints (SolAI)

@app.post("/assistant/chat", response_model=AssistantReply)
def assistant_chat(payload: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Main SolAI chat endpoint (user-scoped)."""
    reply = generate_assistant_response(payload.message, current_user["id"])
    return {
        "assistant_response": reply.get("assistant_response", "Something went wrong."),
        "ui": reply.get("ui")
    }

@app.post("/assistant/confirm")
def assistant_confirm(current_user: dict = Depends(get_current_user)):
    """Confirm pending action (equivalent to user saying 'yes', user-scoped)."""
    return generate_assistant_response("yes", current_user["id"])

@app.get("/assistant/bootstrap")
def assistant_bootstrap(current_user: dict = Depends(get_current_user)):
    """Bootstrap endpoint: returns all initial data needed by frontend (user-scoped)."""
    # Get user's tasks only
    user_tasks = repo.get_tasks_by_user(current_user["id"])
    # Filter today view to user's tasks only
    from datetime import datetime
    import pytz
    tz = pytz.timezone("Europe/London")
    today = datetime.now(tz).strftime("%Y-%m-%d")
    today_tasks = [t for t in user_tasks if t.get("date") == today]
    from app.logic.today_engine import calculate_energy
    energy = calculate_energy(today_tasks)
    
    today_view = {
        "date": today,
        "tasks": today_tasks,
        "load": "light" if len(today_tasks) <= 2 else ("medium" if len(today_tasks) <= 5 else "heavy"),
        "energy": energy
    }
    
    return {
        "today": {
            "date": today_view["date"],
            "tasks": [backend_task_to_frontend(t) for t in today_view["tasks"]],
            "load": today_view["load"],  # Deprecated
            "energy": today_view["energy"]
        },
        "week": get_week_stats(),
        "suggestions": get_suggestions().get("suggestions", []),
        "conflicts": find_conflicts(),
        "categories": get_category_colors(),
        "pending": load_data().get("pending", {}).get(current_user["id"], {})
    }

@app.get("/assistant/today")
def assistant_today(
    date: str | None = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a specific date or today, with energy calculation (user-scoped)."""
    from datetime import datetime
    import pytz
    from app.logic.today_engine import calculate_energy
    
    tz = pytz.timezone("Europe/London")
    
    # Get user's tasks only
    user_tasks = repo.get_tasks_by_user(current_user["id"])
    
    # If date provided, filter tasks for that date
    if date:
        date_tasks = [t for t in user_tasks if t.get("date") == date]
    else:
        # Default: use today
        today = datetime.now(tz).strftime("%Y-%m-%d")
        date = today
        date_tasks = [t for t in user_tasks if t.get("date") == date]
    
    # Sort: tasks with time first (by time), then tasks without time
    tasks_with_time = sorted(
        [t for t in date_tasks if t.get("time")],
        key=lambda x: x.get("time", "")
    )
    tasks_without_time = [t for t in date_tasks if not t.get("time")]
    sorted_tasks = tasks_with_time + tasks_without_time
    
    # Calculate energy using weighted task load model
    energy = calculate_energy(sorted_tasks)
    
    # Legacy load calculation (deprecated)
    total_tasks = len(sorted_tasks)
    if total_tasks == 0:
        load = "empty"
    elif total_tasks <= 2:
        load = "light"
    elif total_tasks <= 5:
        load = "medium"
    else:
        load = "heavy"
    
    return {
        "date": date,
        "tasks": [backend_task_to_frontend(t) for t in sorted_tasks],
        "load": load,  # Deprecated, use energy.status instead
        "energy": energy
    }

@app.get("/assistant/suggestions")
def assistant_suggestions(current_user: dict = Depends(get_current_user)):
    """Get suggestions for the user (user-scoped)."""
    # Filter suggestions to user's tasks only
    user_tasks = repo.get_tasks_by_user(current_user["id"])
    return get_suggestions()

@app.get("/assistant/reschedule-options")
def assistant_reschedule_options(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get rescheduling suggestions for a specific task (user-scoped)."""
    task = repo.get_task(task_id, current_user["id"])

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task_id)
    return {"task": task, "suggestions": suggestions.get("suggestions", [])}

# Meta Endpoints

@app.get("/meta/categories")
def meta_categories():
    """Get category color mapping."""
    return get_category_colors()

