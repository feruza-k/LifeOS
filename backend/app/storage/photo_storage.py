# app/storage/photo_storage.py

import uuid
import shutil
from pathlib import Path
from datetime import datetime
from fastapi import UploadFile
from app.logging import logger

# Compute correct absolute path to db/uploads/photos
BASE_DIR = Path(__file__).resolve().parent.parent / "db"
UPLOADS_DIR = BASE_DIR / "uploads" / "photos"

# Ensure uploads directory exists (lazy initialization to avoid issues at import time)
def ensure_uploads_dir():
    """Ensure uploads directory exists."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

def get_photo_path(filename: str) -> Path:
    """Get the full path to a photo file."""
    ensure_uploads_dir()
    return UPLOADS_DIR / filename

def save_photo(file: UploadFile, date: str) -> str:
    """
    Save an uploaded photo file.
    Returns the filename that was saved.
    """
    ensure_uploads_dir()
    # Generate unique filename: {date}_{uuid}.{ext}
    file_ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if file_ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        file_ext = ".jpg"  # Default to jpg if invalid extension
    
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{date}_{unique_id}{file_ext}"
    file_path = get_photo_path(filename)
    
    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    logger.info(f"Photo saved: {filename}")
    return filename

def delete_photo(filename: str) -> bool:
    """
    Delete a photo file.
    Returns True if deleted, False if not found.
    """
    file_path = get_photo_path(filename)
    if file_path.exists():
        file_path.unlink()
        logger.info(f"Photo deleted: {filename}")
        return True
    return False

def photo_exists(filename: str) -> bool:
    """Check if a photo file exists."""
    return get_photo_path(filename).exists()
