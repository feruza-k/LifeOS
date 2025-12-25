# app/storage/audio_storage.py

import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile
from app.logging import logger

# Compute correct absolute path to db/uploads/audio
BASE_DIR = Path(__file__).resolve().parent.parent / "db"
UPLOADS_DIR = BASE_DIR / "uploads" / "audio"

# Ensure uploads directory exists
def ensure_uploads_dir():
    """Ensure uploads directory exists."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

def get_audio_path(filename: str) -> Path:
    """Get the full path to an audio file."""
    ensure_uploads_dir()
    return UPLOADS_DIR / filename

def save_audio(file: UploadFile, note_id: str) -> str:
    """
    Save an uploaded audio file.
    Returns the filename that was saved.
    """
    ensure_uploads_dir()
    # Generate unique filename: note_{note_id}_{uuid}.{ext}
    file_ext = Path(file.filename).suffix.lower() if file.filename else ".m4a"
    if file_ext not in [".m4a", ".mp3", ".wav", ".ogg", ".webm"]:
        file_ext = ".m4a"  # Default to m4a if invalid extension
    
    unique_id = str(uuid.uuid4())[:8]
    filename = f"note_{note_id}_{unique_id}{file_ext}"
    file_path = get_audio_path(filename)
    
    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    logger.info(f"Audio saved: {filename}")
    return filename

def delete_audio(filename: str) -> bool:
    """
    Delete an audio file.
    Returns True if deleted, False if not found.
    """
    file_path = get_audio_path(filename)
    if file_path.exists():
        file_path.unlink()
        logger.info(f"Audio deleted: {filename}")
        return True
    return False

def audio_exists(filename: str) -> bool:
    """Check if an audio file exists."""
    return get_audio_path(filename).exists()

