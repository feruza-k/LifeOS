from datetime import datetime, timedelta, date
import os
import sys
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Query, UploadFile, File, HTTPException, Depends, status, Request, Response, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
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
default_origins = "http://localhost:5173,http://localhost:8080,http://192.168.1.5:8080,http://192.168.1.5:5173,http://192.168.1.11:8080,http://192.168.1.11:5173,http://10.0.45.240:8080,http://10.0.45.240:5173,http://172.20.10.1:8080,http://172.20.10.1:5173,https://mylifeos.dev,https://www.mylifeos.dev,https://api.mylifeos.dev,https://lifeos-indol.vercel.app"
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

# Global exception handler to ensure CORS headers are added even on unhandled errors
# This only catches exceptions that aren't already handled by FastAPI (like HTTPException)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions and ensure CORS headers are present."""
    # Don't handle HTTPException - let FastAPI handle it
    from fastapi import HTTPException
    if isinstance(exc, HTTPException):
        # Re-raise to let FastAPI handle it normally
        raise
    
    origin = request.headers.get("Origin")
    allowed = False
    
    if origin:
        # Check if origin is allowed (same logic as DevelopmentCORSMiddleware)
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
        
        if origin in ALLOWED_ORIGINS:
            allowed = True
        elif IS_PRODUCTION:
            if ".vercel.app" in origin or "mylifeos.dev" in origin:
                allowed = True
    
    # Log the error
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    # Return error response with CORS headers if origin is allowed
    headers = {}
    if allowed and origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers
    )

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
                    # Allow mylifeos.dev domains (including subdomains like api.mylifeos.dev)
                    elif "mylifeos.dev" in origin:
                        allowed = True
                
                if allowed:
                    # Return 200 immediately for allowed OPTIONS requests
                    return Response(
                        status_code=200,
                        headers={
                            "Access-Control-Allow-Origin": origin,
                            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Timezone",
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
            # In production, allow Vercel domains and mylifeos.dev (including subdomains)
            elif IS_PRODUCTION:
                # Explicitly check for mylifeos.dev domains
                is_mylifeos_domain = (
                    origin == "https://mylifeos.dev" or
                    origin == "https://www.mylifeos.dev" or
                    origin.endswith(".mylifeos.dev") or  # Matches api.mylifeos.dev, etc.
                    "mylifeos.dev" in origin  # Fallback for any subdomain
                )
                if (origin.endswith(".vercel.app") or 
                    is_mylifeos_domain or
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
        
        try:
            response = await call_next(request)
        except Exception as e:
            # If an error occurs, create a response with CORS headers
            # This ensures 500 errors also have CORS headers
            if allowed and origin:
                error_response = JSONResponse(
                    status_code=500,
                    content={"detail": str(e)},
                    headers={
                        "Access-Control-Allow-Origin": origin,
                        "Access-Control-Allow-Credentials": "true",
                    }
                )
                return error_response
            raise
        
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
    month: str | None = None
    title: str
    description: str | None = None
    progress: int | None = None
    id: str | None = None
    order_index: int | None = None
    createdAt: str | None = None

class MonthlyGoalsRequest(BaseModel):
    month: str
    goals: List[MonthlyFocusRequest]  # Up to 5 goals

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
                "mylifeos.dev" in origin or  # Matches mylifeos.dev and any subdomain
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
    set_auth_cookies(json_response, access_token, refresh_token, request=request)
    return json_response

@app.post("/auth/signup-form")
async def signup_form(
    request: Request,
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    username: str = Form(None)
):
    """Handle signup via native HTML form for Safari/mobile compatibility."""
    from fastapi.responses import RedirectResponse
    from app.auth.password_validator import validate_password_strength
    
    # 1. Basic validation
    if password != confirm_password:
        return RedirectResponse(
            url=f"{get_frontend_url_from_request(request)}/auth?mode=signup&error=mismatch",
            status_code=303
        )
    
    is_valid, error_msg = validate_password_strength(password)
    if not is_valid:
        return RedirectResponse(
            url=f"{get_frontend_url_from_request(request)}/auth?mode=signup&error=weak_password",
            status_code=303
        )
        
    # 2. Check for existing user
    email_normalized = email.lower().strip()
    existing_user = await db_repo.get_user_by_email(email_normalized)
    
    if existing_user:
        existing_user_data = await db_repo.get_user_by_id(existing_user["id"])
        if existing_user_data and existing_user_data.get("email_verified", False):
            return RedirectResponse(
                url=f"{get_frontend_url_from_request(request)}/auth?mode=login&error=exists",
                status_code=303
            )

    # 3. Create or update user (logic from standard signup)
    from app.auth.auth import generate_verification_token
    verification_token = generate_verification_token()
    verification_expires = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    
    if existing_user:
        hashed_password = get_password_hash(password)
        await db_repo.update_user(existing_user["id"], {
            "password": hashed_password,
            "username": username or existing_user.get("username"),
            "verification_token": verification_token,
            "verification_token_expires": verification_expires
        })
        user = await db_repo.get_user_by_id(existing_user["id"])
    else:
        hashed_password = get_password_hash(password)
        user = await db_repo.create_user(
            email=email_normalized,
            hashed_password=hashed_password,
            username=username,
            verification_token=verification_token
        )
        await db_repo.update_user(user["id"], {
            "verification_token_expires": verification_expires
        })

    # 4. Send verification email (non-blocking)
    frontend_url = get_frontend_url_from_request(request)
    verification_url = f"{frontend_url}/verify-email?token={verification_token}"
    try:
        subject, html, text = render_verification_email(
            email_normalized,
            verification_token,
            frontend_url,
            username=username or user.get("username")
        )
        send_email(email_normalized, subject, html, text)
        logger.info(f"✅ Verification email sent to {email_normalized}")
    except Exception as e:
        logger.error(f"❌ Failed to send verification email during form signup: {e}")
        logger.error("=" * 70)
        logger.error(f"   Verification link for manual use: {verification_url}")
        logger.error("=" * 70)

    # 5. Create tokens and set cookies
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
    
    # 6. Redirect to verify-email page with success
    redirect_url = f"{frontend_url}/verify-email?signup=success"
    redirect_response = RedirectResponse(url=redirect_url, status_code=303)
    
    # Set cookies on the redirect response
    set_auth_cookies(redirect_response, access_token, refresh_token, request=request)
    
    ip, user_agent = get_client_info(request)
    log_auth_event(
        "signup_form_success",
        user_id=user["id"],
        email=email_normalized,
        ip=ip,
        user_agent=user_agent,
        success=True
    )
    
    return redirect_response

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
        # For form submission, redirect to login page with error
        frontend_url = get_frontend_url_from_request(request)
        error_url = f"{frontend_url}/auth?error=locked"
        redirect_response = RedirectResponse(url=error_url, status_code=302)
        return redirect_response
    
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
                # For form submission, redirect to login page with error
                frontend_url = get_frontend_url_from_request(request)
                error_url = f"{frontend_url}/auth?error=locked"
                redirect_response = RedirectResponse(url=error_url, status_code=302)
                return redirect_response
        
        log_auth_event(
            "login_failure",
            email=email_normalized,
            ip=ip,
            user_agent=user_agent,
            success=False
        )
        # For form submission, redirect to login page with error
        frontend_url = get_frontend_url_from_request(request)
        error_url = f"{frontend_url}/auth?error=invalid"
        redirect_response = RedirectResponse(url=error_url, status_code=302)
        return redirect_response
    
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
    
    # CRITICAL: For Safari/mobile browsers, cookies must be set during a top-level navigation
    # Return a redirect response so cookies are set during navigation (Safari requirement)
    # Get frontend URL from request origin or use default
    frontend_url = get_frontend_url_from_request(request)
    redirect_url = f"{frontend_url}/?login=success"
    
    # For form submissions, Origin header might not be set, so use Referer or infer from redirect URL
    # This ensures cookies are set with the correct domain
    form_origin = origin or request.headers.get("Referer", "")
    if not form_origin and IS_PRODUCTION:
        # Infer from redirect URL (should be mylifeos.dev or www.mylifeos.dev)
        try:
            from urllib.parse import urlparse
            parsed = urlparse(redirect_url)
            form_origin = f"{parsed.scheme}://{parsed.netloc}"
        except:
            form_origin = "https://mylifeos.dev"
    
    # Create redirect response and set cookies
    # In production, always use .mylifeos.dev domain for cookies (works for all subdomains)
    redirect_response = RedirectResponse(url=redirect_url, status_code=302)
    if IS_PRODUCTION:
        # Explicitly set domain to .mylifeos.dev for production
        set_auth_cookies(redirect_response, access_token, refresh_token, domain=".mylifeos.dev", request=request)
    else:
        set_auth_cookies(redirect_response, access_token, refresh_token, request=request)
    
    # CRITICAL: Set CORS headers on redirect response to prevent CORS errors
    # For form submissions, we need to infer the origin from the redirect URL
    if form_origin:
        # Only set CORS headers if origin is allowed (prevents wildcard issues)
        if form_origin in ALLOWED_ORIGINS or "mylifeos.dev" in form_origin or ".vercel.app" in form_origin:
            redirect_response.headers["Access-Control-Allow-Origin"] = form_origin
            redirect_response.headers["Access-Control-Allow-Credentials"] = "true"
    
    # Log cookie setting for debugging
    if IS_PRODUCTION:
        logger.info(f"[LOGIN] Success - cookies set for user {user['id']}, origin: {origin}, form_origin: {form_origin}")
        logger.info(f"[LOGIN] Cookie domain will be: .mylifeos.dev, SameSite: lax")
        logger.info(f"[LOGIN] Redirecting to: {redirect_url}")
        logger.info(f"[LOGIN] CORS headers set: Access-Control-Allow-Origin={redirect_response.headers.get('Access-Control-Allow-Origin')}")
    
    return redirect_response

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
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Timezone",
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
        logger.info(f"✅ Verification email sent to {req.email}")
    except Exception as e:
        verification_url = f"{frontend_url}/verify-email?token={verification_token}"
        logger.error(f"❌ Failed to send verification email to {req.email}: {e}")
        logger.error("=" * 70)
        logger.error(f"   Verification link for manual use: {verification_url}")
        logger.error("=" * 70)
    
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
                    "social": "social",
                    "self": "self",
                    "work": "work",
                    "growth": "growth",
                    "essentials": "essentials",
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
        # Clean up photo reference if file doesn't exist
        if note.get("photo") and note["photo"] and isinstance(note["photo"], dict):
            photo_filename = note["photo"].get("filename")
            if photo_filename and not photo_exists(photo_filename):
                # Photo file doesn't exist - remove reference from database
                logger.warning(f"Photo file {photo_filename} not found for note {date}, cleaning up reference")
                note["photo"] = None
                await db_repo.save_note(note, current_user["id"])
                # Reload note to get updated version
                note = await db_repo.get_note(date, current_user["id"])
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
    
    # Remove photo reference from note
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
    """Get monthly focus for a specific month (user-scoped) - backward compatibility, returns first goal."""
    focus = await db_repo.get_monthly_focus(month, current_user["id"])
    if focus:
        return focus
    return None

@app.get("/monthly-goals")
async def get_monthly_goals(
    month: str = Query(..., description="Month in YYYY-MM format"),
    current_user: dict = Depends(get_current_user)
):
    """Get all monthly goals for a specific month (up to 5)."""
    goals = await db_repo.get_monthly_goals(month, current_user["id"])
    return goals

@app.post("/monthly-focus")
async def save_monthly_focus(focus_data: MonthlyFocusRequest, current_user: dict = Depends(get_current_user)):
    """Save or update a single monthly focus (user-scoped)."""
    result = await db_repo.save_monthly_focus(focus_data.model_dump(exclude_none=True), current_user["id"])
    return result

@app.post("/monthly-goals")
async def save_monthly_goals(goals_data: MonthlyGoalsRequest, current_user: dict = Depends(get_current_user)):
    """Save multiple monthly goals (replaces all goals for the month, up to 5)."""
    if len(goals_data.goals) > 5:
        raise HTTPException(status_code=400, detail="Maximum of 5 monthly goals allowed")
    result = await db_repo.save_monthly_goals(
        [goal.model_dump(exclude_none=True) for goal in goals_data.goals],
        goals_data.month,
        current_user["id"]
    )
    return result

@app.delete("/monthly-focus/{focus_id}")
async def delete_monthly_focus(focus_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a monthly focus by id."""
    success = await db_repo.delete_monthly_focus(focus_id, current_user["id"])
    if success:
        return {"success": True}
    raise HTTPException(status_code=404, detail="Monthly focus not found")

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
async def get_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific category by ID."""
    category = await db_repo.get_category(category_id, current_user["id"])
    if category:
        return category
    raise HTTPException(status_code=404, detail="Category not found")

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
    category = await db_repo.get_category(category_id, current_user["id"])
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Use the real UUID from the retrieved category (in case category_id was a label)
    real_category_id = category["id"]
    
    # If it's a global category (user_id = NULL), create or update a user-specific copy
    if not category.get("user_id"):
        import logging
        from sqlalchemy import select
        from db.models import Category
        from uuid import UUID
        
        logger = logging.getLogger(__name__)
        
        # Query database directly for user-specific categories (bypassing get_categories deduplication)
        # Check for categories matching either the original label or the new label (if being changed)
        original_label = category.get("label", "")
        target_label = updates_dict.get("label") if updates_dict.get("label") else original_label
        
        async with db_repo._get_session() as session:
            # Build query conditions - check for categories with either original or target label
            from sqlalchemy import and_, or_
            label_conditions = [Category.label.ilike(original_label)]
            if target_label != original_label:
                label_conditions.append(Category.label.ilike(target_label))
            
            result = await session.execute(
                select(Category).where(
                    and_(
                        Category.user_id == UUID(current_user["id"]),
                        or_(*label_conditions)
                    )
                )
            )
            user_categories = result.scalars().all()
        
        # Try to find existing user category by original label first (prefer original label match)
        existing_user_category = None
        for cat in user_categories:
            if cat.label.lower() == original_label.lower():
                existing_user_category = {
                    "id": str(cat.id),
                    "label": cat.label,
                    "color": cat.color,
                    "user_id": str(cat.user_id) if cat.user_id else None,
                }
                break
        
        # If not found by original label, try target label (if label is being changed)
        if not existing_user_category and updates_dict.get("label"):
            target_label = updates_dict.get("label")
            for cat in user_categories:
                if cat.label.lower() == target_label.lower():
                    existing_user_category = {
                        "id": str(cat.id),
                        "label": cat.label,
                        "color": cat.color,
                        "user_id": str(cat.user_id) if cat.user_id else None,
                    }
                    break
        
        if existing_user_category:
            # User already has a custom version, update it
            result = await db_repo.update_category(existing_user_category["id"], updates_dict)
            # Update tasks that reference the global category to use the user-specific one
            updated_count = await db_repo.update_tasks_category(real_category_id, existing_user_category["id"], current_user["id"])
            logger.info(f"Updated existing user category '{result.get('label')}' and updated {updated_count} tasks")
        else:
            # Create new user-specific category with updated values
            new_category = {
                "label": updates_dict.get("label") if "label" in updates_dict else category["label"],
                "color": updates_dict.get("color") if "color" in updates_dict else category["color"],
                "user_id": current_user["id"]
            }
            result = await db_repo.add_category(new_category)
            
            # Update tasks that reference the global category to use the new user-specific one
            updated_count = await db_repo.update_tasks_category(real_category_id, result["id"], current_user["id"])
            logger.info(f"Created new user category '{result['label']}' and updated {updated_count} tasks")
        
        return result
    
    if category.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Cannot update other users' categories")
    
    result = await db_repo.update_category(real_category_id, updates_dict)
    if result:
        return result
    raise HTTPException(status_code=404, detail="Category not found")

@app.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a category (user-scoped - can only delete own categories)."""
    # Verify category belongs to user before deleting
    category = await db_repo.get_category(category_id, current_user["id"])
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Use the real UUID
    real_category_id = category["id"]
    
    if category.get("user_id") and category["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Cannot delete other users' categories")
    # Global categories (user_id is None) cannot be deleted by users
    if not category.get("user_id"):
        raise HTTPException(status_code=400, detail="Cannot delete global categories")
    success = await db_repo.delete_category(real_category_id)
    if success:
        return {"status": "deleted", "id": real_category_id}
    raise HTTPException(status_code=404, detail="Category not found")

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
async def assistant_chat(
    payload: ChatRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Main SolAI chat endpoint (user-scoped)."""
    try:
        # Day 21: Use intelligent assistant with conversation history
        from app.ai.intelligent_assistant import generate_intelligent_response
        from app.ai.assistant import generate_assistant_response as generate_rule_based
        
        # First, try intelligent assistant for natural responses
        intelligent_reply = await generate_intelligent_response(
            payload.message,
            current_user["id"],
            payload.conversation_history,
            background_tasks=background_tasks
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
async def assistant_bootstrap(request: Request, current_user: dict = Depends(get_current_user)):
    """Bootstrap endpoint: returns all initial data needed by frontend (user-scoped)."""
    from datetime import datetime
    from app.utils.timezone import get_timezone_from_request
    from app.logic.today_engine import calculate_energy
    
    tz = get_timezone_from_request(request)
    today = datetime.now(tz).strftime("%Y-%m-%d")
    
    # Get today's tasks using the database query (more efficient)
    today_tasks = await db_repo.get_tasks_by_date_and_user(today, current_user["id"])
    
    # Calculate energy using backend format
    energy = calculate_energy(today_tasks)
    
    # Get categories for mapping
    categories_list = await db_repo.get_categories(current_user["id"])
    category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories_list}
    
    # Convert to frontend format
    frontend_tasks = [backend_task_to_frontend(t, category_label_to_id) for t in today_tasks]
    
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
    
    # Return bootstrap data
    week_stats = await get_week_stats(current_user["id"])
    suggestions_res = await get_suggestions(current_user["id"], week_stats=week_stats)
    
    return {
        "today": today_view,
        "week": week_stats,
        "suggestions": suggestions_res.get("suggestions", []),
        "conflicts": await find_conflicts(user_id=current_user["id"]),
        "categories": await get_category_colors(current_user["id"]),
    }

@app.get("/assistant/today")
async def assistant_today(
    request: Request,
    date: str | None = Query(None, description="Date in YYYY-MM-DD format (defaults to today)"),
    current_user: dict = Depends(get_current_user)
):
    """Get tasks for a specific date or today, with energy calculation (user-scoped)."""
    from datetime import datetime
    from app.utils.timezone import get_timezone_from_request
    from app.logic.today_engine import calculate_energy
    
    tz = get_timezone_from_request(request)
    
    # If date provided, use it; otherwise use today
    if not date:
        today = datetime.now(tz).strftime("%Y-%m-%d")
        date = today
    
    # Get tasks for the specific date using the database query (more efficient)
    date_tasks = await db_repo.get_tasks_by_date_and_user(date, current_user["id"])
    
    # Get categories for mapping
    categories_list = await db_repo.get_categories(current_user["id"])
    category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories_list}
    
    # Convert to frontend format first
    frontend_tasks = [backend_task_to_frontend(t, category_label_to_id) for t in date_tasks]
    
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

@app.get("/assistant/morning-briefing")
async def morning_briefing(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Get proactive morning briefing from SolAI (user-scoped)."""
    from app.ai.morning_briefing import generate_morning_briefing
    
    # Get user's language preference (default to English)
    user_language = request.headers.get("Accept-Language", "en")
    # Extract language code (e.g., "en-US" -> "en")
    if "-" in user_language:
        user_language = user_language.split("-")[0]
    if "," in user_language:
        user_language = user_language.split(",")[0]
    
    # Get from user settings if available (future enhancement)
    # For now, use header or default to English
    
    briefing = await generate_morning_briefing(current_user["id"], user_language)
    return briefing

@app.get("/assistant/reschedule-options")
async def assistant_reschedule_options(task_id: str, current_user: dict = Depends(get_current_user)):
    """Get rescheduling suggestions for a specific task (user-scoped)."""
    task = await db_repo.get_task(task_id, current_user["id"])

    if not task:
        return {"error": "Task not found"}

    suggestions = generate_reschedule_suggestions(task_id)
    return {"task": task, "suggestions": suggestions.get("suggestions", [])}

# Align Endpoint - Strategic Reflection Layer
@app.get("/align/summary")
async def align_summary(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Get comprehensive alignment summary for the Align page.
    Returns: Direction narrative, goals hierarchy, patterns, value alignment, progress, and gentle nudge.
    """
    from datetime import datetime, timedelta, date
    from app.utils.timezone import get_timezone_from_request
    from app.ai.pattern_analyzer import analyze_task_patterns, analyze_checkin_patterns, generate_pattern_summary
    from app.ai.intelligent_assistant import get_user_context, _build_weekly_summary
    from app.logic.week_engine import get_week_stats
    from collections import defaultdict
    
    tz = get_timezone_from_request(request)
    today = datetime.now(tz)
    current_month = today.strftime("%Y-%m")
    
    # Get user's historical data
    user_context = await get_user_context(current_user["id"])
    historical = user_context.get("historical", {})
    
    # Get current month's goals (all of them, up to 5)
    monthly_goals = await db_repo.get_monthly_goals(current_month, current_user["id"])
    monthly_focus = monthly_goals[0] if monthly_goals else None  # For backward compatibility
    
    # Get all tasks for goal matching (from historical context)
    all_tasks = historical.get("all_tasks", [])
    
    # Calculate goal-task alignment and update progress automatically
    from app.ai.goal_engine import match_tasks_to_goals, generate_goal_aware_suggestion
    completed_tasks = [t for t in all_tasks if t.get("completed", False)]
    
    # Debug logging
    logger.info(f"[Goal Matching] Found {len(completed_tasks)} completed tasks out of {len(all_tasks)} total tasks")
    logger.info(f"[Goal Matching] Goals to match: {[g.get('title') for g in monthly_goals]}")
    
    goal_matches = match_tasks_to_goals(monthly_goals, completed_tasks, days_back=30)
    
    # Debug logging
    for goal_id, match_data in goal_matches.items():
        goal_title = next((g.get('title') for g in monthly_goals if g.get('id') == goal_id), 'Unknown')
        logger.info(f"[Goal Matching] Goal '{goal_title}': {match_data.get('total_matches', 0)} matches, progress: {match_data.get('progress_score', 0):.1f}%")
    
    # Update goal progress in database
    for goal in monthly_goals:
        goal_id = goal.get("id")
        if goal_id and goal_id in goal_matches:
            matches = goal_matches[goal_id]
            new_progress = int(matches.get("progress_score", 0))
            current_progress = goal.get("progress", 0) or 0
            
            # Update if progress changed (removed threshold for initial updates, or if going from 0)
            should_update = (current_progress == 0 and new_progress > 0) or abs(new_progress - current_progress) >= 3
            
            if should_update:
                try:
                    logger.info(f"[Goal Progress] Updating goal '{goal.get('title')}' from {current_progress}% to {new_progress}%")
                    await db_repo.update_monthly_focus(goal_id, {"progress": new_progress}, current_user["id"])
                    goal["progress"] = new_progress
                except Exception as e:
                    logger.error(f"Error updating goal progress: {e}", exc_info=True)
        elif goal_id:
            # Goal has no matches - log for debugging
            logger.info(f"[Goal Matching] Goal '{goal.get('title')}' has no matches")
    
    # Get tasks for pattern analysis (last 30 days)
    all_tasks = historical.get("all_tasks", [])
    task_patterns = analyze_task_patterns(all_tasks, days_back=30)
    
    # Get check-ins for pattern analysis
    checkins = historical.get("checkins", [])
    checkin_patterns = analyze_checkin_patterns(checkins, days_back=30)
    
    # Get week stats (current week)
    week_stats = await get_week_stats(current_user["id"])
    
    # Calculate value alignment from task categories (current week from week_stats)
    week_tasks_from_stats = []
    for day in week_stats.get("days", []):
        day_tasks = day.get("tasks", [])
        if day_tasks:
            week_tasks_from_stats.extend(day_tasks)
    
    # Also get tasks from historical for category analysis
    week_start = today.date() - timedelta(days=7)
    week_tasks = [
        t for t in all_tasks
        if t.get("date") and date.fromisoformat(t["date"][:10]) >= week_start
    ]
    
    category_distribution = defaultdict(int)
    for task in week_tasks:
        category = task.get("category")
        if category:
            category_distribution[category] += 1
    
    total_week_tasks = len(week_tasks)
    value_alignment = {}
    if total_week_tasks > 0:
        for cat, count in category_distribution.items():
            value_alignment[cat] = {
                "count": count,
                "percentage": round((count / total_week_tasks) * 100)
            }
    
    # Build direction narrative from patterns and week data
    direction_parts = []
    
    # Week overview
    if week_stats.get("total_tasks", 0) > 0:
        direction_parts.append(f"You planned {week_stats.get('total_tasks', 0)} task(s) this week.")
    
    # Completion pattern from check-ins
    if checkin_patterns.get("average_completion", 0) > 0:
        completion = checkin_patterns["average_completion"]
        if completion >= 0.7:
            direction_parts.append("You stayed consistent with planned work.")
        elif completion < 0.5:
            direction_parts.append("Some tasks were postponed, suggesting mild drift.")
    
    # Category drift pattern
    if task_patterns.get("category_usage"):
        # Check if certain categories were postponed more
        health_tasks = [t for t in week_tasks if t.get("category") == "health" and not t.get("completed", False)]
        if len(health_tasks) > 2:
            direction_parts.append("Tasks related to Health were postponed more often.")
    
    # Build final direction narrative
    if direction_parts:
        direction_narrative = " ".join(direction_parts[:3])  # Max 3 insights
    else:
        direction_narrative = "Building patterns as you use LifeOS more. Set a monthly focus to begin aligning your actions."
    
    # Get categories for proper label mapping
    categories = await db_repo.get_categories(current_user["id"])
    category_id_to_label = {cat["id"]: cat["label"] for cat in categories if cat.get("id")}
    
    # Generate patterns & insights (max 3, real only)
    patterns = []
    if task_patterns.get("preferred_times"):
        times = task_patterns["preferred_times"][:2]
        if times and len(times) > 0:
            # Filter out invalid times and format properly
            valid_times = [t for t in times if t and ":" in t]
            if valid_times:
                time_str = " and ".join(valid_times)
                patterns.append(f"Peak focus window: {time_str}")
    
    if task_patterns.get("category_usage"):
        # Filter out "uncategorized" and map category IDs to labels
        category_usage = task_patterns["category_usage"]
        # Remove uncategorized and None values
        filtered_usage = {k: v for k, v in category_usage.items() if k and k.lower() != "uncategorized" and k.lower() != "none"}
        
        if filtered_usage:
            top_category = max(filtered_usage.items(), key=lambda x: x[1], default=None)
            if top_category and top_category[1] > 0:
                category_key = top_category[0]
                # Try to map category ID to label, or use the key if it's already a label
                category_label = category_id_to_label.get(category_key, category_key)
                # Capitalize properly (handle multi-word labels)
                if category_label:
                    category_label = category_label.title()
                    patterns.append(f"Most active area: {category_label}")
    
    if checkin_patterns.get("average_completion", 0) > 0:
        completion = checkin_patterns["average_completion"]
        # Only show if completion is meaningful (at least 0.5 or higher)
        if completion >= 0.5:
            patterns.append(f"Strong daily completion: {completion:.0%}")
    
    # Progress snapshot (minimal) - use check-in data if available
    completed_tasks = sum(1 for t in week_tasks if t.get("completed", False))
    if completed_tasks == 0 and checkin_patterns.get("average_completion", 0) > 0:
        # Estimate from check-in patterns
        avg_completion = checkin_patterns["average_completion"]
        estimated_completed = int(total_week_tasks * avg_completion)
        progress_snapshot = f"You completed approximately {estimated_completed} of {total_week_tasks} planned tasks this week." if total_week_tasks > 0 else "No tasks planned this week yet."
    else:
        progress_snapshot = f"You completed {completed_tasks} of {total_week_tasks} planned tasks this week." if total_week_tasks > 0 else "No tasks planned this week yet."
    
    # Smart nudge generation - more contextual and actionable
    nudge = None
    
    # Try goal-aware suggestion first (only if contextually relevant)
    goal_suggestion = generate_goal_aware_suggestion(
        monthly_goals,
        goal_matches,
        user_context.get("tasks_today", []),
        user_context.get("upcoming_tasks", [])
    )
    
    # Calculate completion rate for this week
    week_completion_rate = completed_tasks / total_week_tasks if total_week_tasks > 0 else 0
    
    # Simple reschedule count (for nudge logic)
    rescheduled_count = 0 
    
    # Check for category drift (tasks being postponed)
    drifted_categories = []
    for cat, count in category_distribution.items():
        cat_tasks = [t for t in week_tasks if t.get("category") == cat]
        cat_completed = sum(1 for t in cat_tasks if t.get("completed", False))
        if len(cat_tasks) > 0:
            cat_completion_rate = cat_completed / len(cat_tasks)
            if cat_completion_rate < 0.5 and len(cat_tasks) >= 2:
                drifted_categories.append((cat, cat_completion_rate))
    
    # Priority 0: Goal-aware suggestion (only if goal is neglected and contextually relevant)
    if goal_suggestion and not nudge:
        nudge = {
            "message": goal_suggestion.get("message", ""),
            "action": goal_suggestion.get("action", "review")
        }
    # Priority 1: Low completion rate + specific category drift
    elif week_completion_rate < 0.6 and drifted_categories:
        top_drifted = max(drifted_categories, key=lambda x: x[1])
        cat_name = top_drifted[0].capitalize()
        nudge = {
            "message": f"Your {cat_name} tasks had a lower completion rate this week. Consider scheduling them during your peak focus times or breaking them into smaller steps.",
            "action": "apply"
        }
    # Priority 2: Low overall completion rate
    elif week_completion_rate < 0.6 and total_week_tasks > 5:
        nudge = {
            "message": f"You completed {completed_tasks} of {total_week_tasks} tasks this week ({int(week_completion_rate * 100)}%). Consider planning fewer tasks or scheduling more buffer time between commitments.",
            "action": "apply"
        }
    # Priority 3: High reschedule rate
    elif rescheduled_count > 3:
        nudge = {
            "message": f"{rescheduled_count} tasks were moved this week. Consider reviewing your weekly planning to better match your actual capacity.",
            "action": "apply"
        }
    # Priority 4: Time-based optimization (only if completion is good)
    elif week_completion_rate >= 0.7 and task_patterns.get("preferred_times"):
        preferred_time = task_patterns["preferred_times"][0] if task_patterns["preferred_times"] else None
        if preferred_time:
            # Extract hour for better messaging
            hour = preferred_time.split(":")[0]
            hour_int = int(hour)
            time_label = f"{hour_int}:00" if hour_int < 12 else f"{hour_int}:00"
            if hour_int < 12:
                time_label = f"{hour_int} AM" if hour_int > 0 else "midnight"
            elif hour_int == 12:
                time_label = "noon"
            else:
                time_label = f"{hour_int - 12} PM"
            
            nudge = {
                "message": f"You're most productive around {time_label}. Consider scheduling your most important tasks during this window next week.",
                "action": "apply"
            }
    # Priority 5: Category balance
    elif len(category_distribution) > 0:
        top_category = max(category_distribution.items(), key=lambda x: x[1])
        if top_category[1] / total_week_tasks > 0.6:  # More than 60% in one category
            cat_name = top_category[0].capitalize()
            nudge = {
                "message": f"This week was heavily focused on {cat_name} ({top_category[1]} tasks). Consider balancing your time across different areas next week.",
                "action": "apply"
            }
    
    # Goals hierarchy - return all goals
    goals_list = [
        {
            "title": goal.get("title"),
            "description": goal.get("description"),
            "progress": goal.get("progress"),
            "id": goal.get("id"),
            "order_index": goal.get("order_index", 0)
        }
        for goal in monthly_goals
    ]
    
    goals = {
        "year_theme": None,  # Future feature
        "month_goals": goals_list,  # All goals (up to 5)
        "month_focus": {  # Backward compatibility - first goal
            "title": monthly_focus.get("title") if monthly_focus else None,
            "description": monthly_focus.get("description") if monthly_focus else None,
            "progress": monthly_focus.get("progress") if monthly_focus else None,
            "month": current_month
        },
        "week_intent": None  # Could be derived from monthly focus
    }
    
    # Determine if new user (no data)
    is_new_user = (
        len(all_tasks) == 0 and
        len(checkins) == 0 and
        len(monthly_goals) == 0
    )
    
    return {
        "direction": {
            "narrative": direction_narrative,
            "has_data": not is_new_user
        },
        "goals": goals,
        "patterns": patterns[:3],  # Max 3
        "value_alignment": value_alignment,
        "progress": progress_snapshot,
        "nudge": nudge,
        "is_new_user": is_new_user,
        "week_stats": {
            "total_tasks": week_stats.get("total_tasks", 0),
            "completed": completed_tasks,
            "total": total_week_tasks
        }
    }

# Comprehensive Align Analytics Endpoint
@app.get("/align/analytics")
async def align_analytics(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Get comprehensive analytics for Align page.
    Returns: historical trends, week/month comparisons, completion rates, category analysis, energy patterns.
    """
    from datetime import datetime, timedelta, date
    from app.utils.timezone import get_timezone_from_request
    
    # Get timezone and current month outside try block for error handling
    tz = get_timezone_from_request(request)
    today = datetime.now(tz)
    current_month = today.strftime("%Y-%m")
    
    try:
        from app.ai.analytics import (
            calculate_completion_trends,
            calculate_monthly_trends,
            compare_weeks,
            compare_months,
            detect_category_drift,
            calculate_consistency_metrics,
            calculate_energy_patterns,
            get_week_boundaries
        )
        from app.ai.intelligent_assistant import get_user_context
        from app.logic.week_engine import get_week_stats
        from collections import defaultdict
        
        # Get user's historical data
        user_context = await get_user_context(current_user["id"])
        historical = user_context.get("historical", {})
        
        all_tasks = historical.get("all_tasks", [])
        checkins = historical.get("checkins", [])
        
        # Calculate completion trends (last 4 weeks)
        weekly_trends = calculate_completion_trends(all_tasks, checkins, weeks=4)
        
        # Calculate monthly trends (last 2 months)
        monthly_trends = calculate_monthly_trends(all_tasks, checkins, months=2)
        
        # Week-over-week comparison
        current_week_start, current_week_end = get_week_boundaries(today.date())
        current_week_metrics = None
        previous_week_metrics = None
        
        if len(weekly_trends) >= 2:
            current_week_metrics = weekly_trends[-1]  # Most recent week
            previous_week_metrics = weekly_trends[-2]  # Previous week
        
        week_comparison = compare_weeks(current_week_metrics or {}, previous_week_metrics or {}) if current_week_metrics else {}
        
        # Month-over-month comparison
        month_comparison = {}
        if len(monthly_trends) >= 2:
            current_month_metrics = monthly_trends[-1]
            previous_month_metrics = monthly_trends[-2]
            month_comparison = compare_months(current_month_metrics, previous_month_metrics)
        
        # Category drift detection
        drift_analysis = detect_category_drift(all_tasks, checkins, weeks=4)
        
        # Consistency metrics
        consistency = calculate_consistency_metrics(checkins, days_back=30)
        
        # Energy patterns
        energy_patterns = calculate_energy_patterns(all_tasks, checkins, weeks=4)
        
        # Current week stats (from week_engine for consistency)
        week_stats = await get_week_stats(current_user["id"])
        
        # Calculate category distribution trends (last 4 weeks)
        category_trends = defaultdict(list)
        for week_data in weekly_trends:
            week_cats = week_data.get("categories", {})
            for cat, count in week_cats.items():
                category_trends[cat].append({
                    "week": week_data.get("week_start"),
                    "count": count
                })
        
        # Get current month focus
        monthly_goals = await db_repo.get_monthly_goals(current_month, current_user["id"])
        monthly_focus = monthly_goals[0] if monthly_goals else None  # For backward compatibility
        
        # Calculate category balance (past month - aggregate from monthly trends)
        category_balance = None
        if monthly_trends and len(monthly_trends) > 0:
            # Aggregate categories from all monthly trends
            monthly_categories_aggregated = defaultdict(int)
            for month_data in monthly_trends:
                month_cats = month_data.get("categories", {})
                for cat_key, count in month_cats.items():
                    if count > 0 and cat_key:
                        monthly_categories_aggregated[cat_key] += count
            
            logger.info(f"[Category Balance] Raw monthly_categories: {dict(monthly_categories_aggregated)}")
            
            # Get categories mapping to convert labels to IDs
            categories_list = await db_repo.get_categories(current_user["id"])
            category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories_list}
            category_id_to_label = {cat["id"]: cat["label"] for cat in categories_list}
            
            # Convert category labels to IDs if needed
            monthly_categories_by_id = {}
            for cat_key, count in monthly_categories_aggregated.items():
                if count > 0 and cat_key:
                    # Check if it's already an ID (UUID format)
                    if isinstance(cat_key, str) and len(cat_key) == 36 and cat_key.count("-") == 4:
                        # It's already an ID
                        monthly_categories_by_id[cat_key] = monthly_categories_by_id.get(cat_key, 0) + count
                    else:
                        # It's a label or frontend value, convert to ID
                        cat_id = category_label_to_id.get(str(cat_key).lower())
                        if cat_id:
                            monthly_categories_by_id[cat_id] = monthly_categories_by_id.get(cat_id, 0) + count
                        else:
                            # Try to find by matching any category ID that might match
                            # This handles edge cases where the key might be a partial match
                            logger.warning(f"[Category Balance] Could not convert category key '{cat_key}' to ID")
            
            monthly_categories = monthly_categories_by_id
            logger.info(f"[Category Balance] Converted to IDs: {monthly_categories}, total={sum(monthly_categories.values())}")
            
            # Filter out empty categories and ensure we have valid data
            monthly_categories = {k: v for k, v in monthly_categories.items() if v > 0 and k}
            total_cat_tasks = sum(monthly_categories.values())
            logger.info(f"[Category Balance] Filtered: {monthly_categories}, total={total_cat_tasks}")
            if total_cat_tasks > 0 and len(monthly_categories) > 0:
                # Calculate balance score (0-1, where 1 is perfectly balanced)
                # Use coefficient of variation (lower = more balanced)
                category_counts = list(monthly_categories.values())
                if len(category_counts) > 1:
                    mean_count = sum(category_counts) / len(category_counts)
                    variance = sum((x - mean_count) ** 2 for x in category_counts) / len(category_counts)
                    std_dev = variance ** 0.5
                    cv = std_dev / mean_count if mean_count > 0 else 1.0
                    balance_score = max(0, 1 - min(cv, 1.0))  # Invert CV, cap at 1
                else:
                    balance_score = 0.5  # Only one category, not balanced
                
                category_balance = {
                    "distribution": monthly_categories,
                    "score": round(balance_score, 2),
                    "status": "balanced" if balance_score > 0.7 else "imbalanced" if balance_score < 0.4 else "moderate"
                }
                logger.info(f"[Category Balance] Final result (monthly): {category_balance}")
            else:
                logger.info(f"[Category Balance] No valid data: total={total_cat_tasks}, categories={len(monthly_categories)}")
        else:
            logger.info(f"[Category Balance] No monthly trends available")
        
        # Get goal-task connections (from align_summary logic)
        from app.ai.goal_engine import match_tasks_to_goals
        completed_tasks = [t for t in all_tasks if t.get("completed", False)]
        goal_matches = match_tasks_to_goals(monthly_goals, completed_tasks, days_back=30)
        
        # Build goal-task connections for display
        goal_task_connections = []
        for goal in monthly_goals:
            goal_id = goal.get("id")
            if goal_id and goal_id in goal_matches:
                matches = goal_matches[goal_id]
                recent_tasks = matches.get("matched_tasks", [])[:5]  # Top 5 recent tasks
                goal_task_connections.append({
                    "goal_id": goal_id,
                    "goal_title": goal.get("title", ""),
                    "recent_tasks": [
                        {
                            "title": t.get("title", ""),
                            "date": t.get("date", ""),
                            "similarity": round(t.get("similarity", 0) * 100, 0)
                        }
                        for t in recent_tasks
                    ],
                    "total_matches": matches.get("total_matches", 0)
                })
        
        # Calculate productivity insights (best day/time)
        from app.ai.pattern_analyzer import analyze_task_patterns
        task_patterns = analyze_task_patterns(all_tasks, days_back=30)
        productivity_insights = {
            "best_times": task_patterns.get("preferred_times", [])[:3],
            "best_day": None,  # Will calculate from check-ins
            "completion_rate": task_patterns.get("completion_rate", 0)
        }
        
        # Calculate best day of week from check-ins
        if checkins:
            day_completion = defaultdict(lambda: {"completed": 0, "total": 0})
            for checkin in checkins:
                checkin_date_str = checkin.get("date")
                if checkin_date_str:
                    try:
                        checkin_date = date.fromisoformat(checkin_date_str[:10])
                        day_name = checkin_date.strftime("%A")
                        completed = len(checkin.get("completedTaskIds", []))
                        incomplete = len(checkin.get("incompleteTaskIds", []))
                        day_completion[day_name]["completed"] += completed
                        day_completion[day_name]["total"] += (completed + incomplete)
                    except:
                        pass
            
            if day_completion:
                best_day = max(day_completion.items(), key=lambda x: x[1]["completed"] / x[1]["total"] if x[1]["total"] > 0 else 0)
                productivity_insights["best_day"] = {
                    "day": best_day[0],
                    "completion_rate": round(best_day[1]["completed"] / best_day[1]["total"], 2) if best_day[1]["total"] > 0 else 0
                }
        
        # Get upcoming week preview (next Monday to Sunday)
        # Calculate days until next Monday (0 = Monday, 6 = Sunday)
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7  # If today is Monday, show next week
        next_week_start = today.date() + timedelta(days=days_until_monday)
        next_week_end = next_week_start + timedelta(days=6)
        # Safely parse dates - skip invalid dates
        upcoming_tasks = []
        for t in all_tasks:
            task_date_str = t.get("date")
            if task_date_str:
                try:
                    task_date = date.fromisoformat(task_date_str[:10])
                    if next_week_start <= task_date <= next_week_end:
                        upcoming_tasks.append(t)
                except (ValueError, TypeError):
                    # Skip invalid dates
                    continue
        
        # Calculate upcoming week load
        upcoming_load_by_day = defaultdict(int)
        for task in upcoming_tasks:
            task_date_str = task.get("date", "")
            if task_date_str:
                try:
                    task_date = date.fromisoformat(task_date_str[:10])
                    day_name = task_date.strftime("%A")
                    upcoming_load_by_day[day_name] += 1
                except:
                    pass
        
        upcoming_week_preview = {
            "week_start": next_week_start.isoformat(),
            "week_end": next_week_end.isoformat(),
            "total_tasks": len(upcoming_tasks),
            "load_by_day": dict(upcoming_load_by_day),
            "heaviest_day": max(upcoming_load_by_day.items(), key=lambda x: x[1])[0] if upcoming_load_by_day else None
        }
        
        # Generate quick actions based on insights
        quick_actions = []
        
        # Action 1: Category balance
        if category_balance and category_balance.get("status") == "imbalanced":
            top_category = max(category_balance["distribution"].items(), key=lambda x: x[1])[0] if category_balance["distribution"] else None
            if top_category:
                quick_actions.append({
                    "type": "balance_category",
                    "label": f"Add more {top_category} tasks",
                    "message": f"Your week is heavy on {top_category}. Consider adding tasks from other categories.",
                    "action": "schedule_category"
                })
        
        # Action 2: Neglected goals
        for goal_conn in goal_task_connections:
            if goal_conn["total_matches"] == 0:
                quick_actions.append({
                    "type": "neglected_goal",
                    "label": f"Work on {goal_conn['goal_title']}",
                    "message": f"Your goal '{goal_conn['goal_title']}' needs attention.",
                    "action": "schedule_goal_task",
                    "goal_id": goal_conn["goal_id"]
                })
                break  # Only suggest one at a time
        
        # Action 3: Energy/load
        if energy_patterns and energy_patterns.get("weekly_patterns"):
            recent_energy = energy_patterns["weekly_patterns"][-1] if energy_patterns["weekly_patterns"] else None
            if recent_energy and recent_energy.get("energy_level") == "heavy":
                quick_actions.append({
                    "type": "reduce_load",
                    "label": "Plan lighter days",
                    "message": "Your recent load has been heavy. Consider scheduling fewer tasks.",
                    "action": "review_schedule"
                })
        
        return {
            "weekly_trends": weekly_trends,
            "monthly_trends": monthly_trends,
            "week_comparison": week_comparison,
            "month_comparison": month_comparison,
            "category_trends": dict(category_trends),
            "drift_analysis": drift_analysis,
            "consistency": consistency,
            "energy_patterns": energy_patterns,
            "category_balance": category_balance,
            "goal_task_connections": goal_task_connections,
            "productivity_insights": productivity_insights,
            "upcoming_week_preview": upcoming_week_preview,
            "quick_actions": quick_actions[:3],  # Max 3 actions
            "current_week": {
                "total_tasks": week_stats.get("total_tasks", 0),
                "week_start": week_stats.get("week_start"),
                "week_end": week_stats.get("week_end")
            },
            "monthly_focus": {
                "title": monthly_focus.get("title") if monthly_focus else None,
                "progress": monthly_focus.get("progress") if monthly_focus else None,
                "month": current_month
            }
        }
    except ValueError as e:
        # Handle date parsing errors specifically
        error_msg = str(e)
        if "day is out of range" in error_msg.lower():
            logger.error(f"[Analytics] Date parsing error: {error_msg}. This may indicate invalid date data in tasks or check-ins.")
            # Return empty analytics instead of crashing
            return {
                "weekly_trends": [],
                "monthly_trends": [],
                "week_comparison": {"has_comparison": False},
                "month_comparison": {"has_comparison": False},
                "category_trends": {},
                "drift_analysis": {"drift_indicators": {}},
                "consistency": {
                    "checkin_frequency": 0.0,
                    "days_with_checkins": 0,
                    "total_days": 30,
                    "consistency_rate": 0.0,
                    "current_streak": 0
                },
                "energy_patterns": None,
                "category_balance": None,
                "goal_task_connections": [],
                "productivity_insights": None,
                "upcoming_week_preview": None,
                "quick_actions": [],
                "current_week": {
                    "total_tasks": 0,
                    "week_start": None,
                    "week_end": None
                },
                "monthly_focus": {
                    "title": None,
                    "progress": None,
                    "month": current_month
                }
            }
        else:
            raise
    except Exception as e:
        # Log and re-raise other errors
        logger.error(f"[Analytics] Unexpected error: {e}", exc_info=True)
        raise

@app.get("/align/habit-reinforcement")
async def get_habit_reinforcement(current_user: dict = Depends(get_current_user)):
    """
    Get AI-powered habit reinforcement analysis.
    Returns: habit strengths, risk indicators, micro-suggestions, and encouragement.
    """
    from datetime import datetime, timedelta, date
    from app.ai.habit_reinforcement import analyze_habit_health
    from app.ai.intelligent_assistant import get_user_context
    
    # Get user's historical data
    user_context = await get_user_context(current_user["id"])
    historical = user_context.get("historical", {})
    
    # Get tasks and check-ins
    tasks = historical.get("all_tasks", [])
    checkins = historical.get("checkins", [])
    
    # Analyze habit health
    analysis = analyze_habit_health(tasks, checkins, days_back=30)
    
    return analysis

@app.get("/align/weekly-reflection")
async def get_weekly_reflection_summary(request: Request, current_user: dict = Depends(get_current_user)):
    """
    Generate an intelligent 1-2 sentence summary of weekly reflections, considering tasks, completion, and goals.
    Returns: A concise, contextual summary that either cheers up or suggests improvements.
    """
    from datetime import datetime, timedelta, date
    from app.utils.timezone import get_timezone_from_request
    from app.ai.intelligent_assistant import get_user_context
    
    tz = get_timezone_from_request(request)
    today = datetime.now(tz)
    
    # Get week start (last 7 days, including today)
    week_start = today.date() - timedelta(days=6)
    
    # Get user context
    user_context = await get_user_context(current_user["id"])
    historical = user_context.get("historical", {})
    
    # Get notes from this week
    notes = historical.get("notes", [])
    week_notes = [
        n for n in notes
        if n.get("date") and date.fromisoformat(n["date"][:10]) >= week_start
    ]
    
    # Get tasks from this week
    all_tasks = historical.get("all_tasks", [])
    week_tasks = [
        t for t in all_tasks
        if t.get("date") and date.fromisoformat(t["date"][:10]) >= week_start
    ]
    completed_tasks = [t for t in week_tasks if t.get("completed", False)]
    completion_rate = len(completed_tasks) / len(week_tasks) if week_tasks else 0
    
    # Get goals
    current_month = today.strftime("%Y-%m")
    monthly_goals = await db_repo.get_monthly_goals(current_month, current_user["id"])
    
    # Collect reflection texts
    reflection_texts = [n.get("content", "").strip() for n in week_notes if n.get("content", "").strip()]
    
    # Build context for AI - even if no reflections, we can still analyze tasks and goals
    reflections_combined = "\n\n".join([f"Day {i+1}: {text}" for i, text in enumerate(reflection_texts)]) if reflection_texts else ""
    
    goals_text = "No goals set"
    if monthly_goals:
        goals_list = [g.get('title', '') for g in monthly_goals[:3]]
        goals_text = f"{', '.join(goals_list)}"
    
    # If no reflections and no tasks, return empty
    if not reflection_texts and not week_tasks:
        return {"summary": ""}
    
    # Generate AI summary
    try:
        from app.ai.intelligent_assistant import get_client
        import asyncio
        
        client = get_client()
        
        system_prompt = """You are a supportive life coach. Generate a single, valuable sentence that analyzes the user's week holistically.
        Consider their tasks, completion rate, reflections, and goals. Provide insight that helps them understand their progress and patterns.
        Be warm, insightful, and actionable. One sentence only, under 25 words."""
        
        # Get task completion stats for context
        week_tasks = [
            t for t in all_tasks
            if t.get("date") and date.fromisoformat(t["date"][:10]) >= week_start
        ]
        completed_week_tasks = [t for t in week_tasks if t.get("completed", False)]
        week_completion_rate = len(completed_week_tasks) / len(week_tasks) if week_tasks else 0
        
        user_prompt = f"""Analyze this week holistically and provide ONE valuable sentence:

Tasks: {len(completed_week_tasks)} of {len(week_tasks)} completed ({int(week_completion_rate * 100)}%)
Reflections: {len(reflection_texts)} day{'s' if len(reflection_texts) != 1 else ''} with notes
Goals: {goals_text}
Reflection content: {reflections_combined[:500] if reflections_combined else 'None'}

Generate ONE sentence that synthesizes these insights - what patterns do you see? What's working? What could improve? Be specific and actionable."""
        
        # Run synchronous OpenAI call in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=40,
                temperature=0.7
            )
        )
        
        summary = response.choices[0].message.content.strip()
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Error generating reflection summary: {e}", exc_info=True)
        # Fallback to simple summary based on what data we have
        if week_tasks:
            completion_pct = int((len(completed_week_tasks) / len(week_tasks)) * 100) if week_tasks else 0
            if reflection_texts:
                return {"summary": f"Completed {len(completed_week_tasks)} of {len(week_tasks)} tasks ({completion_pct}%) and reflected on {len(reflection_texts)} day{'s' if len(reflection_texts) > 1 else ''} this week."}
            else:
                return {"summary": f"Completed {len(completed_week_tasks)} of {len(week_tasks)} tasks ({completion_pct}%) this week."}
        return {"summary": ""}

# Task Suggestions Endpoint
@app.get("/tasks/suggestions")
async def get_task_suggestions(
    limit: int = Query(6, ge=1, le=10),
    current_user: dict = Depends(get_current_user)
):
    """
    Get intelligent task suggestions based on:
    - Frequently scheduled tasks (last 30 days)
    - Goal-related tasks
    - Returns: List of suggestions with title, default time, and category
    """
    from collections import defaultdict, Counter
    from app.ai.intelligent_assistant import get_user_context
    from app.ai.goal_engine import match_tasks_to_goals
    
    # Get user's historical data
    user_context = await get_user_context(current_user["id"])
    historical = user_context.get("historical", {})
    all_tasks = historical.get("all_tasks", [])
    
    # Get current month's goals
    current_month = datetime.now().strftime("%Y-%m")
    monthly_goals = await db_repo.get_monthly_goals(current_month, current_user["id"])
    
    # Analyze frequently scheduled tasks (last 30 days)
    thirty_days_ago = (datetime.now() - timedelta(days=30)).date()
    recent_tasks = [
        t for t in all_tasks
        if t.get("date") and date.fromisoformat(t["date"][:10]) >= thirty_days_ago
    ]
    
    # Group by task title (normalized)
    task_patterns = defaultdict(lambda: {
        "count": 0,
        "times": [],
        "categories": [],
        "title": ""
    })
    
    # Get categories mapping for ID conversion
    categories = await db_repo.get_categories(current_user["id"])
    category_label_to_id = {cat["label"].lower(): cat["id"] for cat in categories}
    
    for task in recent_tasks:
        title = task.get("title", "").strip().lower()
        if not title:
            continue
        
        # Normalize title (remove common variations)
        normalized = title
        if task_patterns[normalized]["title"] == "":
            task_patterns[normalized]["title"] = task.get("title", "").strip()
        
        task_patterns[normalized]["count"] += 1
        if task.get("time"):
            task_patterns[normalized]["times"].append(task.get("time"))
        
        # Get category ID (prefer category_id, fallback to category label lookup)
        category_id = task.get("category_id")
        if not category_id and task.get("category"):
            category_label = task.get("category").lower()
            category_id = category_label_to_id.get(category_label)
        
        if category_id:
            task_patterns[normalized]["categories"].append(category_id)
    
    # Get most frequent tasks
    frequent_tasks = sorted(
        task_patterns.items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )[:limit]
    
    # Get goal-related suggestions
    goal_suggestions = []
    if monthly_goals:
        completed_tasks = [t for t in all_tasks if t.get("completed", False)]
        goal_matches = match_tasks_to_goals(monthly_goals, completed_tasks, days_back=60)
        
        for goal in monthly_goals:
            goal_id = goal.get("id")
            if goal_id and goal_id in goal_matches:
                matches = goal_matches[goal_id]
                matched_tasks = matches.get("matched_tasks", [])
                if matched_tasks:
                    # Get most common task pattern for this goal
                    goal_task_titles = [t.get("title", "").strip().lower() for t in matched_tasks if t.get("title")]
                    if goal_task_titles:
                        most_common = Counter(goal_task_titles).most_common(1)[0]
                        goal_suggestions.append({
                            "title": most_common[0].title(),  # Capitalize
                            "goal_id": goal_id,
                            "goal_title": goal.get("title", ""),
                            "priority": "goal"
                        })
    
    # Build suggestions list
    suggestions = []
    
    # Add frequent tasks
    for normalized_title, pattern in frequent_tasks:
        # Get most common time
        most_common_time = None
        if pattern["times"]:
            time_counter = Counter(pattern["times"])
            most_common_time = time_counter.most_common(1)[0][0]
        
        # Get most common category
        most_common_category = None
        if pattern["categories"]:
            cat_counter = Counter(pattern["categories"])
            most_common_category = cat_counter.most_common(1)[0][0]
        
        suggestions.append({
            "title": pattern["title"],
            "time": most_common_time,
            "category": most_common_category,
            "frequency": pattern["count"],
            "priority": "frequent"
        })
    
    # Add goal-related suggestions (if not already in frequent)
    existing_titles = {s["title"].lower() for s in suggestions}
    for goal_suggestion in goal_suggestions:
        if goal_suggestion["title"].lower() not in existing_titles and len(suggestions) < limit:
            # Find a similar task to get time/category pattern
            similar_task = next(
                (t for t in recent_tasks if t.get("title", "").strip().lower() == goal_suggestion["title"].lower()),
                None
            )
            # Get category ID from similar task
            category_id = None
            if similar_task:
                category_id = similar_task.get("category_id")
                if not category_id and similar_task.get("category"):
                    category_label = similar_task.get("category").lower()
                    category_id = category_label_to_id.get(category_label)
            
            suggestions.append({
                "title": goal_suggestion["title"],
                "time": similar_task.get("time") if similar_task else None,
                "category": category_id,
                "goal_id": goal_suggestion["goal_id"],
                "goal_title": goal_suggestion["goal_title"],
                "priority": "goal"
            })
    
    # Limit to requested number
    return {"suggestions": suggestions[:limit]}

# Meta Endpoints

@app.get("/meta/categories")
async def meta_categories(current_user: dict = Depends(get_current_user)):
    """Get category color mapping."""
    return await get_category_colors(current_user["id"])




