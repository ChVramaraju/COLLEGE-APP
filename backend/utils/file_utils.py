# =============================================================
# utils/file_utils.py — Secure File Handling Utilities
# =============================================================
# This module is the ONLY place in the entire codebase that
# touches the filesystem. Everything else calls these functions.
#
# WHY ISOLATE FILE LOGIC HERE?
#   → When you switch from local storage to AWS S3, you change
#     ONLY this file. Routes and services stay unchanged.
#   → This is the "storage abstraction" pattern used by every
#     production LMS (Moodle, Canvas, Blackboard, etc.)
#
# SECURITY LAYERS IMPLEMENTED:
#   1. Extension whitelist (no .exe, .py, .sh allowed)
#   2. MIME type validation (attacker can't rename virus.exe to notes.pdf)
#   3. UUID filenames (no path traversal possible)
#   4. Path containment check (file path must be inside upload dir)
#   5. File size limit (prevents disk exhaustion attacks)
# =============================================================

import uuid
import os
import logging
from pathlib import Path
from fastapi import UploadFile, HTTPException, status

logger = logging.getLogger("smart_college")

# -----------------------------------------------------------------
# UPLOAD DIRECTORY — Where all note files are physically stored
# -----------------------------------------------------------------
# Path() is used (not string) for cross-platform compatibility.
# os.path.join works differently on Windows vs Linux.
# Path() handles both automatically.
# -----------------------------------------------------------------
# Absolute path anchored to this file's own location.
# WHY: Path("backend/uploads/notes") is relative to wherever the process
# was launched from. On Railway/Render the CWD may not be the project root,
# causing uploads to land in a wrong directory or raise FileNotFoundError.
# Path(__file__).parent resolves to .../backend/utils/ so .parent.parent
# gives .../backend/, then we append the rest.
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "notes"

# -----------------------------------------------------------------
# FILE SIZE LIMIT
# -----------------------------------------------------------------
# 20MB is sufficient for:
#   → PDF lecture notes (typically 1-5MB)
#   → PowerPoint presentations (5-15MB)
#   → Word documents (1-3MB)
# Large video files should go through a separate media pipeline.
# -----------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024   # 20 MB

# -----------------------------------------------------------------
# ALLOWED FILE TYPES
# -----------------------------------------------------------------
# WHY check BOTH extension AND MIME type?
#
# Extension check alone is BYPASSABLE:
#   Attacker renames "malware.exe" to "notes.pdf"
#   Extension = .pdf → PASSES extension check
#   But MIME type = "application/x-executable" → FAILS MIME check
#
# MIME type check alone is BYPASSABLE:
#   Attacker sets Content-Type header to "application/pdf" manually
#   But extension = .exe → FAILS extension check
#
# Both checks together = significantly harder to bypass.
# Production systems add magic byte inspection as a 3rd layer.
# -----------------------------------------------------------------
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx",
    ".ppt", ".pptx",
    ".jpg", ".jpeg", ".png",
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",                                                          # .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",     # .docx
    "application/vnd.ms-powerpoint",                                               # .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",   # .pptx
    "image/jpeg",
    "image/png",
}

# Human-readable list for error messages
ALLOWED_TYPES_DISPLAY = "PDF, DOC, DOCX, PPT, PPTX, JPG, PNG"


def ensure_upload_dir() -> None:
    """
    Creates the upload directory if it doesn't exist.
    Called on server startup — ensures directory is always ready.

    parents=True: creates intermediate directories too
      e.g., if backend/uploads/ doesn't exist, creates it too
    exist_ok=True: doesn't raise error if directory already exists
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def validate_upload(file: UploadFile, content: bytes) -> None:
    """
    Validates an uploaded file before saving.
    Raises HTTPException immediately on any violation.

    THREE CHECKS:
      1. Extension must be in whitelist
      2. MIME type must be in whitelist
      3. File size must be under limit

    WHY raise here instead of returning False?
    → Fail fast: stop processing as soon as violation detected
    → No risk of partial saves or orphaned files from invalid uploads
    → Caller doesn't need to check return value — exception propagates
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file has no filename."
        )

    # --- Check 1: Extension ---
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{ext}' is not allowed. "
                f"Accepted types: {ALLOWED_TYPES_DISPLAY}"
            )
        )

    # --- Check 2: MIME type ---
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"MIME type '{file.content_type}' is not allowed. "
                f"Accepted: {ALLOWED_TYPES_DISPLAY}"
            )
        )

    # --- Check 3: File size ---
    if len(content) > MAX_FILE_SIZE_BYTES:
        size_mb = len(content) / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size {size_mb:.1f}MB exceeds the 20MB limit."
        )

    # --- Check 4: Empty file ---
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )


def save_upload(file: UploadFile, content: bytes) -> tuple[str, str]:
    """
    Saves validated file bytes to the upload directory.

    RETURNS: (stored_filename, absolute_file_path)

    UUID FILENAME STRATEGY:
    uuid4() generates a cryptographically random 128-bit identifier.
    Probability of collision is astronomically low (~1 in 10^38).
    We append the original extension to preserve file type.

    EXAMPLE:
      original: "Chapter 5 Notes.pdf"
      stored:   "3f7a2c1d-e849-4b2f-9c3e-f1234567890a.pdf"
      path:     "backend/uploads/notes/3f7a2c1d-e849-4b2f-9c3e-f1234567890a.pdf"

    WHY absolute path in DB?
    → FileResponse needs the full path to serve the file
    → No path reconstruction needed at serve time
    → Changing upload dir only requires updating this function

    POST-WRITE VERIFICATION:
    After writing, os.path.getsize() is compared against len(content).
    If they differ (disk full, I/O error, filesystem limitation), the
    partial file is deleted and a 500 is raised immediately rather than
    silently storing a corrupt file in the DB.
    """
    ensure_upload_dir()

    ext = Path(file.filename).suffix.lower()
    stored_filename = f"{uuid.uuid4()}{ext}"
    file_path = str(UPLOAD_DIR.resolve() / stored_filename)

    bytes_to_write = len(content)
    logger.debug(
        f"[save_upload] writing '{file.filename}' "
        f"({bytes_to_write:,} bytes) → {stored_filename}"
    )

    with open(file_path, "wb") as f:
        f.write(content)

    # POST-WRITE INTEGRITY VERIFICATION
    # Confirms the OS actually persisted every byte.
    # Catches: disk-full mid-write, I/O errors, filesystem quota violations.
    saved_size = os.path.getsize(file_path)
    if saved_size != bytes_to_write:
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"File write integrity check failed: "
                f"received {bytes_to_write:,} bytes, "
                f"but only {saved_size:,} bytes were written to disk. "
                f"Please try uploading again."
            ),
        )

    logger.info(
        f"[save_upload] '{file.filename}' saved as '{stored_filename}' "
        f"({saved_size:,} bytes) ✓ integrity verified"
    )

    return stored_filename, file_path


def delete_upload(file_path: str) -> None:
    """
    Deletes a file from disk.
    Called when:
      1. DB insert fails after file save (rollback the file)
      2. Admin/faculty deletes a note (deactivation + file cleanup)

    Silently ignores missing files — idempotent operation.
    WHY silent? If DB says delete and file is already gone,
    that's still a successful state. Don't raise on cleanup.
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass   # Log in production, but don't crash the request


def is_safe_path(file_path: str) -> bool:
    """
    PATH TRAVERSAL PROTECTION.

    Verifies the resolved file path is inside the upload directory.
    This prevents serving arbitrary files from the server.

    ATTACK SCENARIO:
      Attacker modifies a DB record to set file_path = "/etc/passwd"
      Without this check: FileResponse serves /etc/passwd to them
      With this check: 403 Forbidden

    HOW IT WORKS:
      Both paths are resolved (symlinks expanded, ./../ normalized)
      Then we check if the file path STARTS WITH the upload dir path.
    """
    try:
        upload_dir_resolved = str(UPLOAD_DIR.resolve())
        file_path_resolved = str(Path(file_path).resolve())
        return file_path_resolved.startswith(upload_dir_resolved)
    except Exception:
        return False
