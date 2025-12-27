from datetime import datetime, timedelta, date
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
from db.repo import db_repo
from app.storage.photo_storage import save_photo, delete_photo, get_photo_path, photo_exists
from app.storage.audio_storage import save_audio, delete_audio, get_audio_path, audio_exists
from app.logic.intent_handler import handle_intent
from app.logic.today_engine import get_today_view
from app.logic.suggestion_engine import get_suggestions
from app.logic.categories import get_category_colors
from app.logic.week_engine import get_tasks_in_range, get_week_stats
from app.logic.reschedule_engine import generate_reschedule_suggestions
from app.logic.conflict_engine import find_conflicts, check_conflict_for_time, suggest_resolution
from app.logic.context_engine import get_contextual_actions
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
# Default to hotspot IP for mobile access (172.20.10.1 is common for iPhone hotspot)
# Can be overridden with FRONTEND_URL environment variable
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://172.20.10.1:8080")

def get_frontend_url_from_request(request: Request) -> str:
    """
    Get the frontend URL from the request Origin header or Referer header.
    Falls back to using the request client IP if headers don't provide a valid URL.
    """
    # Try Origin header first
    origin = request.headers.get("Origin")
    if origin:
        # Check if it's a local network origin (localhost, private IPs, hotspots)
        is_local = (
            origin.startswith("http://localhost") or
            origin.startswith("http://127.0.0.1") or
            origin.startswith("http://192.168.") or
            origin.startswith("http://10.") or
            (origin.startswith("http://172.") and any(origin.startswith(f"http://172.{i}.") for i in range(16, 32)))
        )
        
        if is_local:
            # Use the origin as the frontend URL
            return origin.rstrip("/")
    
    # Try Referer header as fallback
    referer = request.headers.get("Referer")
    if referer:
        # Extract the base URL from referer (remove path)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            # Check if it's a local network
            is_local = (
                base_url.startswith("http://localhost") or
                base_url.startswith("http://127.0.0.1") or
                base_url.startswith("http://192.168.") or
                base_url.startswith("http://10.") or
                (base_url.startswith("http://172.") and any(base_url.startswith(f"http://172.{i}.") for i in range(16, 32)))
            )
            if is_local:
                return base_url.rstrip("/")
        except Exception:
            pass
    
    # Fall back to using request client IP (most reliable for mobile/hotspot)
    if request.client and request.client.host:
        client_ip = request.client.host
        # Check if it's a local network IP
        is_local_ip = (
            client_ip.startswith("192.168.") or
            client_ip.startswith("10.") or
            client_ip.startswith("172.") or
            client_ip == "127.0.0.1" or
            client_ip == "localhost"
        )
        if is_local_ip:
            # Use port 8080 (frontend port) with the client IP
            return f"http://{client_ip}:8080"
    
    # Final fallback to configured FRONTEND_URL
    return FRONTEND_URL.rstrip("/")
# Allow localhost and common network IPs for development
# Include common hotspot IPs (172.20.10.x for iPhone hotspot, 192.168.43.x for Android)
# Production domains (Vercel)
default_origins = "http://localhost:5173,http://localhost:8080,http://192.168.1.5:8080,http://192.168.1.5:5173,http://192.168.1.11:8080,http://192.168.1.11:5173,http://10.0.45.240:8080,http://10.0.45.240:5173,http://172.20.10.1:8080,http://172.20.10.1:5173,https://mylifeos.dev,https://www.mylifeos.dev,https://lifeos-indol.vercel.app"
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", default_origins).split(",")
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS]
# Remove wildcard entries (CORSMiddleware doesn't support them)
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if "*" not in origin]
IS_PRODUCTION = os.getenv("ENVIRONMENT", "production") == "production"

# In development, be more permissive with CORS - allow any local network origin
# This handles dynamic IPs from hotspots and different network configurations
if not IS_PRODUCTION:
    # Allow any origin that looks like a local network (localhost, private IP ranges)
    # We'll handle this in the OPTIONS handler
    pass

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

# CORS middleware - MUST be registered FIRST (runs LAST) to handle all CORS properly
# This ensures OPTIONS preflight requests are handled correctly
# We use allow_methods=["*"] and allow_headers=["*"] to be permissive,
# then filter in custom middleware if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Explicit origins only (no wildcards)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods including OPTIONS
    allow_headers=["*"],  # Allow all headers for CORS preflight
)

# Pre-CORS middleware to handle OPTIONS for local networks in development
# This runs AFTER CORSMiddleware registration (so BEFORE it in execution order)
# to intercept OPTIONS requests before CORSMiddleware rejects them
class PreCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Handle OPTIONS requests (CORS preflight) for both dev and production
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin")
            if origin:
                allowed = False
                
                # In development, allow local network origins
                if not IS_PRODUCTION:
                    is_local = (
                        origin.startswith("http://localhost") or
                        origin.startswith("http://127.0.0.1") or
                        origin.startswith("http://192.168.") or
                        origin.startswith("http://10.") or
                        (origin.startswith("http://172.") and any(origin.startswith(f"http://172.{i}.") for i in range(16, 32)))
                    )
                    if is_local:
                        allowed = True
                
                # Check if origin is in allowed list
                if origin in ALLOWED_ORIGINS:
                    allowed = True
                # In production, allow Vercel domains (check more broadly)
                elif IS_PRODUCTION:
                    # Allow any Vercel subdomain
                    if ".vercel.app" in origin:
                        allowed = True
                    # Allow mylifeos.dev domains
                    elif origin.endswith("mylifeos.dev") or origin.endswith("www.mylifeos.dev"):
                        allowed = True
                
                if allowed:
                    # Return 200 immediately for allowed OPTIONS requests
                    return Response(
                        status_code=200,
                        headers={
                            "Access-Control-Allow-Origin": origin,
                            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type, Authorization",
                            "Access-Control-Allow-Credentials": "true",
                            "Access-Control-Max-Age": "3600",
                        }
                    )
        
        return await call_next(request)

# Add pre-CORS middleware AFTER CORSMiddleware (so it runs BEFORE in execution)
app.add_middleware(PreCORSMiddleware)

# Custom middleware to allow local network origins in development and Vercel domains in production
# This runs AFTER the CORS middleware to override headers and add credentials
class DevelopmentCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("Origin")
        allowed = False
        
        if origin:
            # In development, allow any local network origin
            if not IS_PRODUCTION:
                is_local = (
                    origin.startswith("http://localhost") or
                    origin.startswith("http://127.0.0.1") or
                    origin.startswith("http://192.168.") or
                    origin.startswith("http://10.") or
                    (origin.startswith("http://172.") and any(origin.startswith(f"http://172.{i}.") for i in range(16, 32)))
                )
                if is_local:
                    allowed = True
            # In production, allow Vercel domains and mylifeos.dev
            elif IS_PRODUCTION:
                if (origin.endswith(".vercel.app") or 
                    origin.endswith("mylifeos.dev") or 
                    origin.endswith("www.mylifeos.dev") or
                    origin in ALLOWED_ORIGINS):
                    allowed = True
        
        # For OPTIONS requests, handle CORS preflight
        if request.method == "OPTIONS" and allowed:
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Max-Age": "3600",
                }
            )
        
        response = await call_next(request)
        
        # Add CORS headers to response if origin is allowed (for all requests, not just OPTIONS)
        # This overrides CORSMiddleware's headers for dynamic origins (Vercel domains)
        if allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        elif IS_PRODUCTION and origin:
            # Log if origin wasn't allowed in production (for debugging 405 errors)
            logger.warning(f"CORS: Origin not allowed: {origin}, method: {request.method}, path: {request.url.path}")
        
        return response

# Add DevelopmentCORSMiddleware in both dev and production to handle dynamic origins
app.add_middleware(DevelopmentCORSMiddleware)

# Request logging middleware for debugging 405 errors
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Log ALL requests in production for debugging (not just /auth)
        if IS_PRODUCTION:
            origin = request.headers.get("Origin")
            logger.info(f"[REQUEST] {request.method} {request.url.path} - Origin: {origin}, Scheme: {request.url.scheme}, Full URL: {request.url}")
        
        response = await call_next(request)
        
        # Log response status for all requests in production
        if IS_PRODUCTION:
            logger.info(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code}")
        
        return response

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None  # [{"role": "user|assistant", "content": "..."}]

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
    allowed_origin = None
    
    # Log for debugging
    if IS_PRODUCTION:
        logger.debug(f"OPTIONS request for {full_path} from origin: {origin}")
    
    if origin:
        # In development, always allow local network origins
        if not IS_PRODUCTION:
            # Check if it's a local network origin (localhost, private IPs, hotspots)
            is_local = (
                origin.startswith("http://localhost") or
                origin.startswith("http://127.0.0.1") or
                origin.startswith("http://192.168.") or
                origin.startswith("http://10.") or
                (origin.startswith("http://172.") and any(origin.startswith(f"http://172.{i}.") for i in range(16, 32)))
            )
            if is_local:
                allowed_origin = origin
        
        # Check if origin is in allowed list
        if origin in ALLOWED_ORIGINS:
            allowed_origin = origin
        # Allow any Vercel domain in production (including subdomains)
        elif IS_PRODUCTION:
            if (origin.endswith(".vercel.app") or 
                origin.endswith("mylifeos.dev") or 
                origin.endswith("www.mylifeos.dev") or
                "vercel.app" in origin):
                allowed_origin = origin
    
    # If no origin matched, return 200 with no CORS headers (browser will block, but don't return 403)
    # Returning 403 causes issues - better to return 200 and let browser handle CORS
    if not allowed_origin:
        return Response(status_code=200, headers={})
    
    # Return 200 for OPTIONS (CORS preflight) with proper headers
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

@app.get("/health")
def health_check():
    """Health check endpoint for Railway/deployment monitoring."""
    return {"status": "healthy", "message": "LifeOS API is running"}

@app.get("/ai-test")
def ai_test():
    return {"response": test_ai_connection()}

@app.post("/parse")
def parse_endpoint(user_input: str):
    return parse_intent(user_input)

@app.get("/process")
async def process(text: str, current_user: dict = Depends(get_current_user)):
    """Process intent (requires authentication)."""
    intent = parse_intent(text)
    result = await handle_intent(intent, current_user["id"])
    return {"intent": intent, "result": result}

@app.get("/tasks")
async def get_tasks(current_user: dict = Depends(get_current_user)):
    return await get_all_tasks(current_user["id"])

@app.get("/all")
async def get_all(current_user: dict = Depends(get_current_user)):
    """Get all user data from database. Development use only."""
    user_id = current_user["id"]
    
    tasks = await db_repo.get_tasks_by_date_range(user_id, date(2000, 1, 1), date(2100, 12, 31))
    reminders = await db_repo.get_reminders(user_id)
    categories = await db_repo.get_categories(user_id)
    pending = await db_repo.get_pending_action(user_id)
    
    return {
        "tasks": tasks,
        "reminders": reminders,
        "categories": categories,
        "pending": pending if pending else {}
    }

@app.post("/clear")
async def clear_data(current_user: dict = Depends(get_current_user)):
    """Clear all user tasks and pending actions. Development use only."""
    user_id = current_user["id"]
    
    tasks = await db_repo.get_tasks_by_date_range(user_id, date(2000, 1, 1), date(2100, 12, 31))
    for task in tasks:
        await db_repo.delete_task(task["id"], user_id)
    
    await db_repo.clear_pending_action(user_id)
    
    return {"status": "cleared", "message": "User tasks and pending actions cleared"}

@app.post("/tasks/{task_id}/complete")
async def complete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    result = await db_repo.toggle_task_complete(task_id, current_user["id"])
    if result:
        return {"status": "completed" if result.get("completed") else "incomplete", "task": result}
    return {"error": "Task not found"}

@app.post("/auth/signup", response_model=Token)
@limiter.limit("5/15minutes", key_func=get_ip_rate_limit_key)
async def signup(request: Request, response: Response, user_data: UserCreate):
    from app.auth.password_validator import validate_password_strength
    
    if user_data.password != user_data.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    email_normalized = user_data.email.lower().strip()
    existing_user = await db_repo.get_user_by_email(email_normalized)
    
    if existing_user:
        existing_user = await db_repo.get_user_by_id(existing_user["id"])
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
        final_check_user = await db_repo.get_user_by_id(existing_user["id"])
        if final_check_user and not final_check_user.get("email_verified", False):
            hashed_password = get_password_hash(user_data.password)
            await db_repo.update_user(existing_user["id"], {
                "password": hashed_password,
                "username": user_data.username or existing_user.get("username"),
                "verification_token": verification_token,
                "verification_token_expires": verification_expires
            })
            user = await db_repo.get_user_by_id(existing_user["id"])
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
        user = await db_repo.create_user(
            email=email_normalized,
            hashed_password=hashed_password,
            username=user_data.username,
            verification_token=verification_token
        )
        await db_repo.update_user(user["id"], {
            "verification_token_expires": verification_expires
        })
    
    # Get frontend URL from request origin (detects user's current network)
    frontend_url = get_frontend_url_from_request(request)
    verification_url = f"{frontend_url}/verify-email?token={verification_token}"
    
    logger.info(f"Using frontend URL from request: {frontend_url}")
    
    try:
        username = user.get("username") if user else user_data.username
        subject, html, text = render_verification_email(
            user_data.email,
            verification_token,
            frontend_url,
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
    
    from app.auth.auth import create_refresh_token
    from app.auth.security import set_auth_cookies
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(user["id"])
    
    refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    await db_repo.update_user(user["id"], {
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
    
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, refresh_token)
    return json_response

@app.post("/auth/login")
@limiter.limit("6/15minutes", key_func=get_ip_rate_limit_key)  # 6 attempts allows account lockout at 5 to trigger first
async def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    # Debug logging for 405 errors
    origin = request.headers.get("Origin")
    logger.info(f"[LOGIN] Request received - origin: {origin}, method: {request.method}, path: {request.url.path}, scheme: {request.url.scheme}")
    from app.auth.security import is_account_locked, handle_failed_login, clear_failed_attempts
    from slowapi.util import get_remote_address
    
    email_normalized = form_data.username.lower().strip()
    ip, user_agent = get_client_info(request)
    
    user = await db_repo.get_user_by_email(email_normalized)
    
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
    
    if not user or not verify_password(form_data.password, user.get("password", "")):
        if user:
            should_lock = await handle_failed_login(user)
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
    await clear_failed_attempts(user["id"])
    
    # Create tokens
    from app.auth.auth import create_refresh_token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(user["id"])
    
    refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    await db_repo.update_user(user["id"], {
        "refresh_token": refresh_token,
        "refresh_token_expires": refresh_token_expires
    })
    
    from app.auth.security import set_auth_cookies
    
    log_auth_event(
        "login_success",
        user_id=user["id"],
        email=email_normalized,
        ip=ip,
        user_agent=user_agent,
        success=True
    )
    
    # Create response and set cookies
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, refresh_token)
    
    # Log cookie setting for debugging
    if IS_PRODUCTION:
        logger.info(f"[LOGIN] Success - cookies set for user {user['id']}, origin: {origin}")
    
    return json_response

class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None

@app.post("/auth/refresh")
async def refresh_token(request: Request, response: Response, req: RefreshTokenRequest | None = None):
    """Refresh access token using refresh token from cookie or request body."""
    from app.auth.security import get_token_from_cookie, set_auth_cookies
    from app.auth.auth import verify_refresh_token, create_refresh_token, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
    
    refresh_token_value = get_token_from_cookie(request, "refresh")
    
    if not refresh_token_value and req and req.refresh_token:
        refresh_token_value = req.refresh_token
    
    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )
    
    user_id = verify_refresh_token(refresh_token_value)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user = await db_repo.get_user_by_id(user_id)
    if not user or user.get("refresh_token") != refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
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
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    new_refresh_token = create_refresh_token(user_id)
    
    new_refresh_token_expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    await db_repo.update_user(user_id, {
        "refresh_token": new_refresh_token,
        "refresh_token_expires": new_refresh_token_expires
    })
    
    json_response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    set_auth_cookies(json_response, access_token, new_refresh_token)
    return json_response

@app.post("/auth/logout")
async def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user)):
    """Logout user and revoke refresh token."""
    from app.auth.security import clear_auth_cookies, get_token_from_cookie
    from app.auth.auth import verify_refresh_token
    
    refresh_token_value = get_token_from_cookie(request, "refresh")
    if refresh_token_value:
        user_id = verify_refresh_token(refresh_token_value)
        if user_id:
            await db_repo.update_user(user_id, {
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
async def get_current_user_info(request: Request, current_user: dict = Depends(get_current_user)):
    # Debug logging for cookie issues
    if IS_PRODUCTION:
        from app.auth.security import get_token_from_cookie
        cookie_token = get_token_from_cookie(request, "access")
        all_cookies = request.cookies
        logger.info(f"[AUTH/ME] Cookies received: {list(all_cookies.keys())}, access_token present: {bool(cookie_token)}, User ID: {current_user.get('id')}")
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
async def verify_email(verify_data: VerifyEmailRequest, current_user: dict = Depends(get_current_user)):
    user = await db_repo.get_user_by_id(current_user["id"])
    
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
    
    await db_repo.update_user(user["id"], {
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None
    })
    
    return {"message": "Email verified successfully", "verified": True}

@app.post("/auth/verify-email-by-token")
async def verify_email_by_token(request: Request, verify_data: VerifyEmailRequest):
    """Verify user's email with token directly (DEVELOPMENT ONLY).
    
    ⚠️  WARNING: This endpoint bypasses email verification and should only be used
    for development/testing when emails cannot be sent (e.g., Resend domain not verified).
    
    In production, users should verify via the email link, not this endpoint.
    
    This endpoint doesn't require authentication and can be used when:
    - Email sending fails due to Resend restrictions (domain not verified)
    - Testing verification flow in development
    """
    user = await db_repo.get_user_by_verification_token(verify_data.token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    if user.get("email_verified"):
        return {"message": "Email already verified", "verified": True}
    
    await db_repo.update_user(user["id"], {
        "email_verified": True,
        "verification_token": None,
        "verification_token_expires": None
    })
    
    return {"message": "Email verified successfully", "verified": True}

@app.post("/auth/resend-verification")
async def resend_verification(request: Request, req: ResendVerificationRequest):
    email_normalized = req.email.lower().strip()
    user = await db_repo.get_user_by_email(email_normalized)
    
    if not user:
        return {"message": "If the email exists, a verification token has been sent"}
    
    if user.get("email_verified"):
        return {"message": "Email already verified"}
    
    from app.auth.auth import generate_verification_token
    verification_token = generate_verification_token()
    verification_expires = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    
    await db_repo.update_user(user["id"], {
        "verification_token": verification_token,
        "verification_token_expires": verification_expires
    })
    
    # Get frontend URL from request origin (detects user's current network)
    frontend_url = get_frontend_url_from_request(request)
    logger.info(f"Resending verification email using frontend URL from request: {frontend_url}")
    
    try:
        username = user.get("username")
        subject, html, text = render_verification_email(
            req.email,
            verification_token,
            frontend_url,
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
async def forgot_password(request: Request, req: ForgotPasswordRequest):
    email_normalized = req.email.lower().strip()
    user = await db_repo.get_user_by_email(email_normalized)
    
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
    
    await db_repo.update_user(user["id"], {
        "reset_token": reset_token,
        "reset_token_expires": reset_expires
    })
    
    # Get frontend URL from request origin (detects user's current network)
    frontend_url = get_frontend_url_from_request(request)
    logger.info(f"Sending password reset email using frontend URL from request: {frontend_url}")
    
    try:
        username = user.get("username")
        subject, html, text = render_password_reset_email(
            req.email,
            reset_token,
            frontend_url,
            username=username
        )
        send_email(req.email, subject, html, text)
        logger.info(f"Password reset email sent to {req.email}")
    except Exception as e:
        logger.error(f"Failed to send password reset email to {req.email}: {e}", exc_info=True)
    
    return {"message": "If the email exists, a password reset token has been sent"}

@app.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset password using reset token."""
    from app.auth.password_validator import validate_password_strength
    
    # Validate passwords match
    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    is_valid, error_msg = validate_password_strength(req.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    user = await db_repo.get_user_by_reset_token(req.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    hashed_password = get_password_hash(req.new_password)
    await db_repo.update_user(user["id"], {
        "password": hashed_password,
        "reset_token": None,
        "reset_token_expires": None
    })
    
    return {"message": "Password reset successfully"}

@app.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    """Change password (requires current password)."""
    from app.auth.password_validator import validate_password_strength
    
    user = await db_repo.get_user_by_id(current_user["id"])
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
    
    is_valid, error_msg = validate_password_strength(req.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    hashed_password = get_password_hash(req.new_password)
    await db_repo.update_user(user["id"], {"password": hashed_password})
    
    return {"message": "Password changed successfully"}

class UpdateProfileRequest(BaseModel):
    username: str | None = None

@app.patch("/auth/profile")
async def update_profile(updates: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """Update user profile (username, etc.)."""
    user = await db_repo.get_user_by_id(current_user["id"])
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
    
    updated_user = await db_repo.update_user(user["id"], update_dict)
    return {
        "id": updated_user["id"],
        "email": updated_user["email"],
        "username": updated_user.get("username"),
        "email_verified": updated_user.get("email_verified", False),
        "avatar_path": updated_user.get("avatar_path"),
        "created_at": updated_user["created_at"]
    }

@app.delete("/auth/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account and all associated data.
    
    Note: Due to CASCADE foreign keys in the database, deleting the user
    will automatically delete all related data (tasks, notes, checkins,
    reminders, monthly focus, etc.). We just need to delete the user record.
    """
    user_id = current_user["id"]
    
    # Delete user account (CASCADE will handle all related data)
    success = await db_repo.delete_user_account(user_id)
    
    if success:
        return {"message": "Account deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="User not found")

@app.post("/auth/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user avatar."""
    user = await db_repo.get_user_by_id(current_user["id"])
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
            import os
            old_filename = os.path.basename(old_avatar_path)
            delete_photo(old_filename)
        except:
            pass  # Ignore errors if file doesn't exist
    
    saved_filename = save_photo(file, f"avatar_{current_user['id']}")
    
    avatar_url = f"/photos/{saved_filename}"
    await db_repo.update_user(user["id"], {"avatar_path": avatar_url})
    
    return {"avatar_path": avatar_url, "message": "Avatar uploaded successfully"}

@app.delete("/auth/avatar")
async def delete_avatar(current_user: dict = Depends(get_current_user)):
    """Delete user avatar."""
    user = await db_repo.get_user_by_id(current_user["id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    avatar_path = user.get("avatar_path")
    if not avatar_path:
        return {"message": "No avatar to delete"}
    
    import os
    filename = os.path.basename(avatar_path)
    try:
        delete_photo(filename)
    except:
        pass  # Ignore errors if file doesn't exist
    
    await db_repo.update_user(user["id"], {"avatar_path": None})
    
    return {"message": "Avatar deleted successfully"}

# Frontend-Compatible Task Endpoints (Protected)

@app.get("/tasks/by-date")
async def get_tasks_by_date(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a specific date in frontend format (user-scoped)."""
    tasks = await db_repo.get_tasks_by_date_and_user(date, current_user["id"])
    return [backend_task_to_frontend(t) for t in tasks]

@app.post("/tasks")
async def create_task(
    task_data: TaskCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new task from frontend format. Handles recurring tasks (user-scoped)."""
    import logging
    logger = logging.getLogger(__name__)
    
    task_dict = task_data.model_dump(exclude_none=True)
    repeat_config = task_dict.pop("repeat", None)
    
    task_dict["user_id"] = current_user["id"]
    
    if not repeat_config:
        backend_task = frontend_task_to_backend(task_dict)
        backend_task["user_id"] = current_user["id"]
        
        if "value" in task_dict:
            categories = await db_repo.get_categories(current_user["id"])
            category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
            
            frontend_value = task_dict["value"]
            if len(frontend_value) == 36 and frontend_value.count("-") == 4:
                backend_task["category_id"] = frontend_value
            elif frontend_value.lower() in category_label_to_id:
                backend_task["category_id"] = category_label_to_id[frontend_value.lower()]
            else:
                value_to_label = {
                    "health": "health",
                    "work": "work",
                    "family": "family",
                    "growth": "growth",
                    "creativity": "creativity",
                }
                mapped_label = value_to_label.get(frontend_value.lower(), "growth")
                if mapped_label in category_label_to_id:
                    backend_task["category_id"] = category_label_to_id[mapped_label]
                else:
                    logger.warning(f"Could not map value '{frontend_value}' to any category UUID")
        
        # Ensure end_datetime is set if endTime was provided (for proper conflict detection)
        if task_dict.get("endTime") and backend_task.get("date") and backend_task.get("time"):
            if not backend_task.get("end_datetime"):
                backend_task["end_datetime"] = f"{backend_task['date']} {task_dict['endTime']}"
        
        # Proactive conflict check before creating task
        if backend_task.get("date") and backend_task.get("time"):
            # Ensure duration is calculated from endTime if provided
            # frontend_task_to_backend should have calculated this, but double-check
            duration = backend_task.get("duration_minutes")
            if not duration and task_dict.get("endTime") and task_dict.get("time"):
                # Calculate duration from time and endTime
                try:
                    start_hour, start_min = map(int, task_dict["time"].split(":"))
                    end_hour, end_min = map(int, task_dict["endTime"].split(":"))
                    start_total = start_hour * 60 + start_min
                    end_total = end_hour * 60 + end_min
                    duration = end_total - start_total
                    if duration < 0:
                        duration += 24 * 60  # Handle cross-day tasks
                    # Update backend_task with calculated duration
                    backend_task["duration_minutes"] = duration
                except Exception as e:
                    logger.warning(f"Failed to calculate duration from endTime: {e}")
                    duration = 60  # Default fallback
            elif not duration:
                duration = 60  # Default duration
            
            # Only check conflicts for tasks with a specific time (not anytime tasks)
            conflicts = []
            if backend_task.get("time") and backend_task["time"] != "00:00":
                conflicts = await check_conflict_for_time(
                    date=backend_task["date"],
                    time=backend_task["time"],
                    duration_minutes=duration,
                    user_id=current_user["id"],
                    exclude_task_id=None  # New task, no ID yet
                )
            
            if conflicts:
                # Find alternative slot
                suggestion = await suggest_resolution(
                    date=backend_task["date"],
                    preferred_time=backend_task["time"],
                    duration_minutes=duration,
                    user_id=current_user["id"]
                )
                
                conflicting_task = conflicts[0]
                # Get end time for the conflicting task
                conflicting_end_time = conflicting_task.get("end_datetime")
                if conflicting_end_time:
                    # Extract time from datetime string
                    if isinstance(conflicting_end_time, str):
                        if "T" in conflicting_end_time:
                            conflicting_end_time = conflicting_end_time.split("T")[1][:5]
                        elif " " in conflicting_end_time:
                            conflicting_end_time = conflicting_end_time.split(" ")[1][:5]
                else:
                    # Calculate from duration if available
                    conflicting_duration = conflicting_task.get("duration_minutes", 60)
                    conflicting_start = conflicting_task.get("time", "00:00")
                    try:
                        start_hour, start_min = map(int, conflicting_start.split(":"))
                        end_total = (start_hour * 60 + start_min + conflicting_duration) % (24 * 60)
                        end_hour = end_total // 60
                        end_min = end_total % 60
                        conflicting_end_time = f"{end_hour:02d}:{end_min:02d}"
                    except:
                        conflicting_end_time = None
                
                if suggestion.get("suggested_time"):
                    return {
                        "conflict": True,
                        "conflicting_tasks": [{
                            "id": conflicting_task.get("id"),
                            "title": conflicting_task.get("title"),
                            "time": conflicting_task.get("time"),
                            "endTime": conflicting_end_time
                        }],
                        "suggested_alternative": {
                            "time": suggestion["suggested_time"],
                            "datetime": suggestion.get("suggested_datetime")
                        },
                        "message": f"This conflicts with '{conflicting_task.get('title')}'. I can schedule it at {suggestion['suggested_time']} instead.",
                        "task_preview": backend_task
                    }
                else:
                    return {
                        "conflict": True,
                        "conflicting_tasks": [{
                            "id": conflicting_task.get("id"),
                            "title": conflicting_task.get("title"),
                            "time": conflicting_task.get("time"),
                            "endTime": conflicting_end_time
                        }],
                        "suggested_alternative": None,
                        "message": f"This conflicts with '{conflicting_task.get('title')}'. No free slots available on this day.",
                        "task_preview": backend_task
                    }
        
        # No conflict - create the task
        result = await db_repo.add_task_dict(backend_task)
        categories = await db_repo.get_categories(current_user["id"])
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        frontend_result = backend_task_to_frontend(result, category_label_to_id)
        return frontend_result
    
    # Handle recurring tasks - create all instances
    created_tasks = []
    base_date = datetime.strptime(task_data.date, "%Y-%m-%d")
    
    # Get categories mapping for converting tasks to frontend format
    categories = await db_repo.get_categories(current_user["id"])
    category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
    
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
                    
                    # Set category_id if value is provided
                    if "value" in task_dict:
                        frontend_value = task_dict["value"]
                        if len(frontend_value) == 36 and frontend_value.count("-") == 4:
                            backend_task["category_id"] = frontend_value
                        elif frontend_value.lower() in category_label_to_id:
                            backend_task["category_id"] = category_label_to_id[frontend_value.lower()]
                    
                    result = await db_repo.add_task_dict(backend_task)
                    created_tasks.append(backend_task_to_frontend(result, category_label_to_id))
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
                backend_task["user_id"] = current_user["id"]
                
                # Set category_id if value is provided
                if "value" in task_dict:
                    frontend_value = task_dict["value"]
                    if len(frontend_value) == 36 and frontend_value.count("-") == 4:
                        backend_task["category_id"] = frontend_value
                    elif frontend_value.lower() in category_label_to_id:
                        backend_task["category_id"] = category_label_to_id[frontend_value.lower()]
                
                result = await db_repo.add_task_dict(backend_task)
                created_tasks.append(backend_task_to_frontend(result, category_label_to_id))
                current_date += timedelta(days=1)
    
    elif repeat_config["type"] == "custom":
        # Create tasks for custom dates
        if repeat_config.get("customDates"):
            for date_str in repeat_config["customDates"]:
                task_dict["date"] = date_str
                backend_task = frontend_task_to_backend(task_dict)
                backend_task["user_id"] = current_user["id"]
                
                # Set category_id if value is provided
                if "value" in task_dict:
                    frontend_value = task_dict["value"]
                    if len(frontend_value) == 36 and frontend_value.count("-") == 4:
                        backend_task["category_id"] = frontend_value
                    elif frontend_value.lower() in category_label_to_id:
                        backend_task["category_id"] = category_label_to_id[frontend_value.lower()]
                
                result = await db_repo.add_task_dict(backend_task)
                created_tasks.append(backend_task_to_frontend(result, category_label_to_id))
    
    # Return the first created task (for compatibility)
    return created_tasks[0] if created_tasks else backend_task_to_frontend(result)

@app.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    updates: TaskUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a task (user-scoped)."""
    updates_dict = updates.model_dump(exclude_none=True)
    # Convert frontend updates to backend format if needed
    backend_updates = {}
    if "value" in updates_dict:
        # Look up category UUID by value (which could be UUID or category label)
        categories = await db_repo.get_categories(current_user["id"])
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        
        frontend_value = updates_dict["value"]
        # Check if it's already a UUID
        if len(frontend_value) == 36 and frontend_value.count("-") == 4:
            # It's a UUID, use it directly
            backend_updates["category_id"] = frontend_value
        elif frontend_value.lower() in category_label_to_id:
            # It's a label, look up UUID
            backend_updates["category_id"] = category_label_to_id[frontend_value.lower()]
        else:
            # Fallback: try to map legacy values
            value_to_label = {
                "health": "health",
                "work": "work",
                "family": "family",
                "growth": "growth",
                "creativity": "creativity",
            }
            mapped_label = value_to_label.get(frontend_value.lower(), "growth")
            if mapped_label in category_label_to_id:
                backend_updates["category_id"] = category_label_to_id[mapped_label]
            else:
                # Last resort: set category label
                backend_updates["category"] = mapped_label
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
    
    result = await db_repo.update_task(task_id, backend_updates, current_user["id"])
    if result:
        # Get categories for mapping
        categories = await db_repo.get_categories(current_user["id"])
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        return backend_task_to_frontend(result, category_label_to_id)
    return {"error": "Task not found"}

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a task (user-scoped)."""
    success = await db_repo.delete_task(task_id, current_user["id"])
    if success:
        return {"status": "deleted", "id": task_id}
    return {"error": "Task not found"}

@app.post("/tasks/{task_id}/move")
async def move_task(
    task_id: str,
    new_date: str = Query(..., description="New date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Move a task to a new date (user-scoped)."""
    task = await db_repo.get_task(task_id, current_user["id"])
    if not task:
        return {"error": "Task not found"}
    
    # Store original date as movedFrom
    updates = {
        "date": new_date,
        "moved_from": task.get("date")
    }
    result = await db_repo.update_task(task_id, updates, current_user["id"])
    if result:
        return backend_task_to_frontend(result)
    return {"error": "Failed to move task"}

@app.post("/tasks/{task_id}/resolve-conflict")
async def resolve_task_conflict(
    task_id: str,
    resolution: dict,
    current_user: dict = Depends(get_current_user)
):
    """Resolve a task conflict by moving it to a new time (user-scoped)."""
    # Validate request - extract required fields
    new_date = resolution.get("new_date")
    new_time = resolution.get("new_time")
    new_datetime = resolution.get("new_datetime")
    
    if not new_date or not new_time:
        raise HTTPException(status_code=400, detail="new_date and new_time are required")
    
    # Verify task belongs to user
    task = await db_repo.get_task(task_id, current_user["id"])
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if new time has conflicts (excluding this task)
    duration = task.get("duration_minutes", 60)
    new_conflicts = await check_conflict_for_time(
        date=new_date,
        time=new_time,
        duration_minutes=duration,
        user_id=current_user["id"],
        exclude_task_id=task_id
    )
    
    if new_conflicts:
        conflicting_task = new_conflicts[0]
        return {
            "error": "New time also has conflicts",
            "conflicts": [{
                "id": conflicting_task.get("id"),
                "title": conflicting_task.get("title"),
                "time": conflicting_task.get("time")
            }],
            "message": f"New time conflicts with '{conflicting_task.get('title')}'"
        }
    
    # Update task with new time
    final_datetime = new_datetime or f"{new_date} {new_time}"
    updates = {
        "date": new_date,
        "time": new_time,
        "datetime": final_datetime
    }
    
    # Recalculate end_datetime if duration exists
    if task.get("duration_minutes"):
        from datetime import datetime, timedelta
        start_dt = datetime.strptime(final_datetime, "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=task["duration_minutes"])
        updates["end_datetime"] = end_dt.strftime("%Y-%m-%d %H:%M")
    
    result = await db_repo.update_task(task_id, updates, current_user["id"])
    if result:
        categories = await db_repo.get_categories(current_user["id"])
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        return {
            "success": True,
            "task": backend_task_to_frontend(result, category_label_to_id),
            "message": f"Task moved to {new_time}"
        }
    
    raise HTTPException(status_code=500, detail="Failed to resolve conflict")

# Notes Endpoints

@app.get("/notes")
async def get_note(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get note for a specific date (user-scoped)."""
    note = await db_repo.get_note(date, current_user["id"])
    if note:
        return note
    return None

@app.post("/notes")
@app.put("/notes")
async def save_note(
    note_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save or update a note (user-scoped)."""
    result = await db_repo.save_note(note_data, current_user["id"])
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
        note = await db_repo.get_note(date, current_user["id"])
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
        await db_repo.save_note(note, current_user["id"])
        
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
async def delete_photo_endpoint(
    filename: str,
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Delete a photo file and remove its reference from the note (user-scoped)."""
    # Get note to verify ownership
    note = await db_repo.get_note(date, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Verify the photo belongs to this note
    photo_matches = False
    if note.get("photo") and note["photo"] and isinstance(note["photo"], dict) and note["photo"].get("filename") == filename:
        photo_matches = True
    elif note.get("photos") and isinstance(note["photos"], list):
        photo_matches = any(p.get("filename") == filename for p in note["photos"])
    
    if not photo_matches:
        # Photo not in note - might already be deleted, return success anyway
        # Try to delete file if it exists, but don't fail if it doesn't
        try:
            if photo_exists(filename):
                delete_photo(filename)
        except:
            pass
        return {"message": "Photo reference removed"}
    
    # Delete the file (don't fail if file doesn't exist - might have been manually deleted)
    try:
        if photo_exists(filename):
            delete_photo(filename)
    except Exception as e:
        logger.warning(f"Photo file {filename} not found or already deleted: {e}")
    
    # Remove photo reference from note (always do this, even if file deletion failed)
    if "photo" in note and note["photo"] and note["photo"].get("filename") == filename:
        note["photo"] = None
        await db_repo.save_note(note, current_user["id"])
    # Also handle old "photos" array format for backward compatibility
    elif "photos" in note:
        note["photos"] = [p for p in note["photos"] if p.get("filename") != filename]
        await db_repo.save_note(note, current_user["id"])
    
    return {"message": "Photo deleted successfully"}

# Check-ins Endpoints

@app.get("/checkins")
async def get_checkin(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get check-in for a specific date (user-scoped)."""
    checkin = await db_repo.get_checkin(date, current_user["id"])
    if checkin:
        return checkin
    return None

@app.post("/checkins")
async def save_checkin(
    checkin_data: CheckInRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save or update a check-in (user-scoped)."""
    result = await db_repo.save_checkin(checkin_data.model_dump(exclude_none=True), current_user["id"])
    return result

# Global Notes Endpoints

@app.get("/global-notes")
async def get_global_notes(
    include_archived: bool = Query(False, description="Include archived notes"),
    sort_by: str = Query("updated_at", description="Sort by: updated_at, created_at, title"),
    pinned_only: bool = Query(False, description="Only return pinned notes"),
    current_user: dict = Depends(get_current_user)
):
    """Get all global notes for the current user with filtering and sorting."""
    notes = await db_repo.get_global_notes(
        current_user["id"],
        include_archived=include_archived,
        sort_by=sort_by,
        pinned_only=pinned_only
    )
    return notes

@app.get("/global-notes/{note_id}")
async def get_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific global note by ID."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@app.post("/global-notes")
async def create_global_note(
    note_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new global note."""
    result = await db_repo.create_global_note(note_data, current_user["id"])
    return result

@app.put("/global-notes/{note_id}")
async def update_global_note(
    note_id: str,
    note_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing global note."""
    result = await db_repo.update_global_note(note_id, note_data, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result

@app.delete("/global-notes/{note_id}")
async def delete_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a global note."""
    success = await db_repo.delete_global_note(note_id, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted successfully"}

@app.post("/global-notes/{note_id}/pin")
async def pin_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pin a global note to the top."""
    result = await db_repo.update_global_note(note_id, {"pinned": True}, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result

@app.post("/global-notes/{note_id}/unpin")
async def unpin_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unpin a global note."""
    result = await db_repo.update_global_note(note_id, {"pinned": False}, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result

@app.post("/global-notes/{note_id}/archive")
async def archive_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive a global note."""
    result = await db_repo.update_global_note(note_id, {"archived": True}, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result

@app.post("/global-notes/{note_id}/unarchive")
async def unarchive_global_note(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unarchive a global note."""
    result = await db_repo.update_global_note(note_id, {"archived": False}, current_user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    return result

@app.post("/global-notes/{note_id}/image")
async def upload_note_image(
    note_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image for a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.get("image_filename"):
        old_filename = note["image_filename"]
        if photo_exists(old_filename):
            delete_photo(old_filename)
    
    filename = save_photo(file, note_id)
    result = await db_repo.update_global_note(note_id, {"image_filename": filename}, current_user["id"])
    return result

@app.delete("/global-notes/{note_id}/image")
async def delete_note_image(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete the image from a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.get("image_filename"):
        filename = note["image_filename"]
        if photo_exists(filename):
            delete_photo(filename)
        await db_repo.update_global_note(note_id, {"image_filename": None}, current_user["id"])
    
    return {"message": "Image deleted successfully"}

@app.get("/global-notes/{note_id}/image")
async def get_note_image(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the image for a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note or not note.get("image_filename"):
        raise HTTPException(status_code=404, detail="Image not found")
    
    filename = note["image_filename"]
    if not photo_exists(filename):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    photo_path = get_photo_path(filename)
    return FileResponse(photo_path, media_type="image/jpeg")

@app.post("/global-notes/{note_id}/audio")
async def upload_note_audio(
    note_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an audio file (voice note) for a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.get("audio_filename"):
        old_filename = note["audio_filename"]
        if audio_exists(old_filename):
            delete_audio(old_filename)
    
    filename = save_audio(file, note_id)
    result = await db_repo.update_global_note(note_id, {"audio_filename": filename}, current_user["id"])
    return result

@app.delete("/global-notes/{note_id}/audio")
async def delete_note_audio(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete the audio from a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note.get("audio_filename"):
        filename = note["audio_filename"]
        if audio_exists(filename):
            delete_audio(filename)
        await db_repo.update_global_note(note_id, {"audio_filename": None}, current_user["id"])
    
    return {"message": "Audio deleted successfully"}

@app.get("/global-notes/{note_id}/audio")
async def get_note_audio(
    note_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the audio file for a global note."""
    note = await db_repo.get_global_note(note_id, current_user["id"])
    if not note or not note.get("audio_filename"):
        raise HTTPException(status_code=404, detail="Audio not found")
    
    filename = note["audio_filename"]
    if not audio_exists(filename):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    audio_path = get_audio_path(filename)
    return FileResponse(audio_path, media_type="audio/mpeg")

# Context Signals Endpoints (Foundation Only - No UI)
@app.post("/context-signals/refresh")
async def refresh_context_signals_endpoint(
    current_user: dict = Depends(get_current_user)
):
    """
    Force refresh context signals for current week.
    Signals are automatically computed weekly - this endpoint is for testing/debugging only.
    """
    try:
        from app.ai.context_service import get_or_compute_context_signals
        signals = await get_or_compute_context_signals(current_user["id"], force_refresh=True)
        return {
            "week_start": signals.get("week_start"),
            "cached": signals.get("cached", False),
            "message": "Context signals refreshed"
        }
    except Exception as e:
        logger.error(f"Error refreshing context signals: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to refresh context signals")

# Reminders Endpoints (separate from task reminders)

@app.get("/reminders")
async def get_all_reminders(current_user: dict = Depends(get_current_user)):
    """Get all reminders for the current user (separate from task reminders)."""
    reminders = await db_repo.get_reminders(current_user["id"])
    return reminders

@app.post("/reminders")
async def create_reminder(reminder_data: ReminderRequest, current_user: dict = Depends(get_current_user)):
    """Create a new reminder (user-scoped)."""
    data = reminder_data.model_dump(exclude_none=True)

    # Restore legacy behavior: "show" reminders default to today
    if data.get("type") == "show" and not data.get("dueDate"):
        data["dueDate"] = datetime.utcnow().date().isoformat()

    result = await db_repo.add_reminder(data, current_user["id"])
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
async def update_reminder(reminder_id: str, updates: ReminderUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update a reminder (user-scoped)."""
    updates_dict = updates.model_dump(exclude_none=True)
    result = await db_repo.update_reminder(reminder_id, updates_dict, current_user["id"])
    if result:
        return result
    return {"error": "Reminder not found"}

@app.delete("/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a reminder (user-scoped)."""
    success = await db_repo.delete_reminder(reminder_id, current_user["id"])
    if success:
        return {"status": "deleted", "id": reminder_id}
    return {"error": "Reminder not found"}

# Monthly Focus Endpoints

@app.get("/monthly-focus")
async def get_monthly_focus(
    month: str = Query(..., description="Month in YYYY-MM format"),
    current_user: dict = Depends(get_current_user)
):
    """Get monthly focus for a specific month (user-scoped)."""
    focus = await db_repo.get_monthly_focus(month, current_user["id"])
    if focus:
        return focus
    return None

@app.post("/monthly-focus")
async def save_monthly_focus(focus_data: MonthlyFocusRequest, current_user: dict = Depends(get_current_user)):
    """Save or update monthly focus (user-scoped)."""
    result = await db_repo.save_monthly_focus(focus_data.model_dump(exclude_none=True), current_user["id"])
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
async def get_all_categories(current_user: dict = Depends(get_current_user)):
    """Get categories for the current user (global + user-specific)."""
    return await db_repo.get_categories(current_user["id"])

@app.get("/categories/{category_id}")
async def get_category(category_id: str):
    """Get a specific category by ID."""
    category = await db_repo.get_category(category_id)
    if category:
        return category
    return {"error": "Category not found"}

@app.post("/categories")
async def create_category(category_data: CategoryRequest, current_user: dict = Depends(get_current_user)):
    """Create a new category (user-scoped)."""
    category_dict = category_data.model_dump(exclude_none=True)
    # Automatically set user_id from current user
    category_dict["user_id"] = current_user["id"]
    result = await db_repo.add_category(category_dict)
    return result

@app.patch("/categories/{category_id}")
async def update_category(category_id: str, updates: CategoryUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update a category (user-scoped - can only update own categories).
    
    If updating a global category (user_id = NULL), creates a user-specific copy instead.
    """
    updates_dict = updates.model_dump(exclude_none=True)
    # Verify category exists
    category = await db_repo.get_category(category_id)
    if not category:
        return {"error": "Category not found"}
    
    # If it's a global category (user_id = NULL), create or update a user-specific copy
    if not category.get("user_id"):
        import logging
        logger = logging.getLogger(__name__)
        
        # Check if user already has a user-specific category with this label
        user_categories = await db_repo.get_categories(current_user["id"])
        existing_user_category = next(
            (c for c in user_categories if c.get("user_id") == current_user["id"] and c.get("label", "").lower() == category.get("label", "").lower()),
            None
        )
        
        if existing_user_category:
            # User already has a custom version, update it instead
            result = await db_repo.update_category(existing_user_category["id"], updates_dict)
            # Also update tasks that reference the old global category
            updated_count = await db_repo.update_tasks_category(category_id, existing_user_category["id"], current_user["id"])
            logger.info(f"Updated existing user category and {updated_count} tasks")
        else:
            new_category = {
                "label": category["label"],
                "color": updates_dict.get("color", category["color"]),
                "user_id": current_user["id"]
            }
            result = await db_repo.add_category(new_category)
            
            updated_count = await db_repo.update_tasks_category(category_id, result["id"], current_user["id"])
            logger.info(f"Created new user category and updated {updated_count} tasks")
        
        return result
    
    if category.get("user_id") != current_user["id"]:
        return {"error": "Unauthorized: Cannot update other users' categories"}
    
    result = await db_repo.update_category(category_id, updates_dict)
    if result:
        return result
    return {"error": "Category not found"}

@app.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a category (user-scoped - can only delete own categories)."""
    # Verify category belongs to user before deleting
    category = await db_repo.get_category(category_id)
    if not category:
        return {"error": "Category not found"}
    if category.get("user_id") and category["user_id"] != current_user["id"]:
        return {"error": "Unauthorized: Cannot delete other users' categories"}
    # Global categories (user_id is None) cannot be deleted by users
    if not category.get("user_id"):
        return {"error": "Cannot delete global categories"}
    success = await db_repo.delete_category(category_id)
    if success:
        return {"status": "deleted", "id": category_id}
    return {"error": "Category not found"}

# Weekly & Calendar Views (Used by Frontend)

@app.get("/tasks/calendar")
async def tasks_calendar(
    start: str,
    end: str,
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a date range in frontend format (user-scoped). Uses database only."""
    from datetime import date as date_type
    from db.session import AsyncSessionLocal
    import logging
    logger = logging.getLogger(__name__)
    
    # Force database usage - fail if not configured
    if AsyncSessionLocal is None:
        raise HTTPException(
            status_code=500,
            detail="Database not configured. Please set DATABASE_URL environment variable."
        )
    
    try:
        # Parse date strings to date objects
        start_date = date_type.fromisoformat(start[:10])
        end_date = date_type.fromisoformat(end[:10])
        
        logger.info(f"[tasks/calendar] Querying database for tasks: user={current_user['id']}, range={start[:10]} to {end[:10]}")
        
        # Use database repo to get tasks in date range
        tasks = await db_repo.get_tasks_by_date_range(current_user["id"], start_date, end_date)
        
        logger.info(f"[tasks/calendar] Database returned {len(tasks)} tasks for range {start[:10]} to {end[:10]}")
        
        categories = await db_repo.get_categories(current_user["id"])
        category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
        
        frontend_tasks = [backend_task_to_frontend(t, category_label_to_id) for t in tasks]
        
        return frontend_tasks
    except ValueError as e:
        # Invalid date format
        logger.error(f"[tasks/calendar] Invalid date format: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        logger.error(f"Database query failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch tasks from database: {str(e)}"
        )


@app.get("/tasks/conflicts")
async def tasks_conflicts(
    start: str | None = Query(None),
    end: str | None = Query(None),
    current_user: dict = Depends(get_current_user)
):
    return await find_conflicts(start, end, current_user["id"])

# Assistant Endpoints (SolAI)

@app.post("/assistant/chat", response_model=AssistantReply)
async def assistant_chat(payload: ChatRequest, current_user: dict = Depends(get_current_user)):
    """Main SolAI chat endpoint (user-scoped)."""
    try:
        # Day 21: Use intelligent assistant with conversation history
        from app.ai.intelligent_assistant import generate_intelligent_response
        from app.ai.assistant import generate_assistant_response as generate_rule_based
        
        # First, try intelligent assistant for natural responses
        intelligent_reply = await generate_intelligent_response(
            payload.message,
            current_user["id"],
            payload.conversation_history
        )
        
        # Intelligent assistant now creates pending actions for task creation
        # So we can use its response directly - no need to call rule-based assistant
        # This prevents duplication and ensures consistency
        
        # Return intelligent assistant's response
        if intelligent_reply.get("assistant_response"):
            return {
                "assistant_response": intelligent_reply.get("assistant_response", "Something went wrong."),
                "ui": intelligent_reply.get("ui")
            }
        
        # Fallback to rule-based if intelligent assistant fails
        rule_based_reply = await generate_rule_based(payload.message, current_user["id"])
        return {
            "assistant_response": rule_based_reply.get("assistant_response", "Something went wrong."),
            "ui": rule_based_reply.get("ui")
        }
    except ValueError as e:
        if "OPENAI_API_KEY" in str(e):
            logger.error(f"OpenAI API key not configured: {e}")
            return {
                "assistant_response": "I'm having trouble connecting to the AI service. Please check that OPENAI_API_KEY is set in the backend configuration.",
                "ui": None
            }
        raise
    except Exception as e:
        logger.error(f"Error in assistant chat: {e}", exc_info=True)
        return {
            "assistant_response": "I'm having trouble processing that request. Please try again.",
            "ui": None
        }

@app.post("/assistant/confirm")
async def assistant_confirm(current_user: dict = Depends(get_current_user)):
    """Confirm pending action (equivalent to user saying 'yes', user-scoped)."""
    from app.ai.assistant import generate_assistant_response
    
    # Check if there's a pending action first
    from app.logic.pending_actions import get_current_pending
    pending = await get_current_pending(current_user["id"])
    
    if pending:
        # Use rule-based assistant to handle pending action confirmation
        return await generate_assistant_response("yes", current_user["id"])
    else:
        # No pending action - return helpful message
        return {
            "assistant_response": "There's nothing to confirm right now.",
            "ui": None
        }

@app.get("/assistant/context-actions")
async def get_context_actions(
    current_view: str = Query("today", description="Current view: today, calendar, task, week, month"),
    selected_task_id: str | None = Query(None, description="ID of selected task (if any)"),
    selected_date: str | None = Query(None, description="Selected date in YYYY-MM-DD format (if any)"),
    current_user: dict = Depends(get_current_user)
):
    """Get context-aware actions for the assistant (user-scoped)."""
    actions = await get_contextual_actions(
        user_id=current_user["id"],
        current_view=current_view,
        selected_task_id=selected_task_id,
        selected_date=selected_date
    )
    return {"actions": actions}

@app.get("/assistant/bootstrap")
async def assistant_bootstrap(current_user: dict = Depends(get_current_user)):
    """Bootstrap endpoint: returns all initial data needed by frontend (user-scoped)."""
    from datetime import datetime
    import pytz
    from app.logic.today_engine import calculate_energy
    
    tz = pytz.timezone("Europe/London")
    today = datetime.now(tz).strftime("%Y-%m-%d")
    
    # Get today's tasks using the database query (more efficient)
    today_tasks = await db_repo.get_tasks_by_date_and_user(today, current_user["id"])
    
    # Calculate energy using backend format
    energy = calculate_energy(today_tasks)
    
    # Convert to frontend format
    frontend_tasks = [backend_task_to_frontend(t) for t in today_tasks]
    
    # Calculate load
    total_tasks = len(frontend_tasks)
    if total_tasks == 0:
        load = "empty"
    elif total_tasks <= 2:
        load = "light"
    elif total_tasks <= 5:
        load = "medium"
    else:
        load = "heavy"
    
    today_view = {
        "date": today,
        "tasks": frontend_tasks,
        "load": load,  # Deprecated
        "energy": energy
    }
    
    return {
        "today": today_view,
        "week": await get_week_stats(current_user["id"]),
        "suggestions": (await get_suggestions(current_user["id"])).get("suggestions", []),
        "conflicts": await find_conflicts(user_id=current_user["id"]),
        "categories": await get_category_colors(current_user["id"]),
    }

@app.get("/assistant/today")
async def assistant_today(
    date: str | None = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a specific date or today, with energy calculation (user-scoped)."""
    from datetime import datetime
    import pytz
    from app.logic.today_engine import calculate_energy
    
    tz = pytz.timezone("Europe/London")
    
    # If date provided, use it; otherwise use today
    if not date:
        today = datetime.now(tz).strftime("%Y-%m-%d")
        date = today
    
    # Get tasks for the specific date using the database query (more efficient)
    date_tasks = await db_repo.get_tasks_by_date_and_user(date, current_user["id"])
    
    # Convert to frontend format first
    frontend_tasks = [backend_task_to_frontend(t) for t in date_tasks]
    
    # Sort: tasks with time first (by time), then tasks without time
    tasks_with_time = sorted(
        [t for t in frontend_tasks if t.get("time")],
        key=lambda x: x.get("time", "")
    )
    tasks_without_time = [t for t in frontend_tasks if not t.get("time")]
    sorted_tasks = tasks_with_time + tasks_without_time
    
    # Calculate energy using weighted task load model (needs backend format)
    # Convert back to backend format for energy calculation
    backend_tasks_for_energy = date_tasks  # Already in backend format
    energy = calculate_energy(backend_tasks_for_energy)
    
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
    
    if not sorted_tasks:
        logger.warning(f"No tasks found for date {date} for user {current_user['id']}")
    
    return {
        "date": date,
        "tasks": sorted_tasks,  # Already in frontend format
        "load": load,  # Deprecated, use energy.status instead
        "energy": energy
    }

@app.get("/assistant/suggestions")
async def assistant_suggestions(current_user: dict = Depends(get_current_user)):
    """Get suggestions for the user (user-scoped)."""
    return await get_suggestions(current_user["id"])

@app.get("/assistant/reschedule-options")
async def assistant_reschedule_options(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get rescheduling suggestions for a specific task (user-scoped)."""
    task = await db_repo.get_task(task_id, current_user["id"])

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task_id)
    return {"task": task, "suggestions": suggestions.get("suggestions", [])}

# Meta Endpoints

@app.get("/meta/categories")
async def meta_categories(current_user: dict = Depends(get_current_user)):
    """Get category color mapping."""
    return await get_category_colors(current_user["id"])


