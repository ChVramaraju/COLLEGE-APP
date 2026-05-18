# =============================================================
# routes/notes.py — Notes API Endpoints
# =============================================================
# FILE UPLOAD ROUTES ARE DIFFERENT:
#
# Normal JSON route:
#   Content-Type: application/json
#   Body: {"title": "...", "subject": "..."}
#   → Use Pydantic model as request body
#
# File upload route:
#   Content-Type: multipart/form-data
#   Body: form fields + file bytes (binary, not JSON)
#   → Use Form() for text fields, File() for file
#   → CANNOT mix Pydantic body model with File() in same route
#
# WHY multipart/form-data for files?
#   JSON is text-only (UTF-8 encoded).
#   Files are binary (any bytes).
#   multipart/form-data handles both text fields AND binary
#   data in a single HTTP request by splitting the body
#   into "parts" separated by a boundary string.
#
# IMPORTANT: The upload route is `async def` because we need
#   `await file.read()` to read the file bytes asynchronously.
#   All other routes are sync (`def`) — consistent with rest of codebase.
# =============================================================

import logging

from fastapi import APIRouter, Depends, Form, File, UploadFile, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

logger = logging.getLogger("smart_college")

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_faculty,
    get_current_admin,
    get_current_user,
)
from backend.models.user import User, UserRole
from backend.schemas.notes import (
    NoteResponse, NoteDetailResponse, NoteUpdate,
    FacultyNoteResponse, NotePublishToggle,
)
from backend.services.notes_service import (
    upload_note,
    get_note_by_id,
    list_notes_by_section,
    get_note_file_path,
    update_note,
    deactivate_note,
    publish_note,
    replace_note_file,
)

router = APIRouter(
    prefix="/notes",
    tags=["Notes"],
)


# ---------------------------------------------------------------
# POST /notes/upload — Faculty uploads a note file
# ---------------------------------------------------------------
# async def: needed for `await file.read()`
#
# Form() parameters: FastAPI reads these from multipart form data
# File(): FastAPI reads this as a binary file upload
#
# HOW TO TEST IN SWAGGER:
#   1. Click "Try it out" on this endpoint
#   2. Fill in title, subject, section_id as text fields
#   3. Click "Choose File" for the file parameter
#   4. Select a PDF from your computer
#   5. Click Execute
# ---------------------------------------------------------------
@router.post(
    "/upload",
    response_model=FacultyNoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a note file for a section (Faculty only)",
)
async def upload_note_route(
    title: str = Form(..., min_length=2, max_length=200),
    subject: str = Form(..., min_length=2, max_length=100),
    section_id: int = Form(...),
    description: Optional[str] = Form(None),
    auto_publish: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    content = await file.read()   # Read bytes ONCE here, pass to sync service

    from backend.utils.file_utils import MIN_FILE_SIZE_BYTES
    logger.debug(
        f"[upload] filename='{file.filename}' "
        f"content_type='{file.content_type}' "
        f"bytes_received={len(content):,}  "
        f"min_required={MIN_FILE_SIZE_BYTES}"
    )

    note = upload_note(
        db, current_user.id,
        title, subject, section_id,
        file, content, description,
        auto_publish=auto_publish,
    )

    logger.info(
        f"[upload] '{file.filename}' → note_id={note.id} "
        f"stored_size={note.file_size:,} bytes "
        f"match={note.file_size == len(content)}"
    )

    return note


# ---------------------------------------------------------------
# GET /notes/section/{section_id} — List notes for a section
# ---------------------------------------------------------------
@router.get(
    "/section/{section_id}",
    response_model=List[NoteResponse],
    summary="List notes for a section (Admin, Faculty, or Student in section)",
)
def list_section_notes(
    section_id: int,
    subject: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search in title"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    from backend.models.student import Student

    # Student can only see notes for their own section
    if current_user.role == UserRole.student:
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        if not student or student.section_id != section_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view notes for your own section."
            )

    return list_notes_by_section(db, section_id, subject, search, skip, limit)


# ---------------------------------------------------------------
# GET /notes/{note_id} — Get note metadata
# ---------------------------------------------------------------
@router.get(
    "/{note_id}",
    response_model=NoteDetailResponse,
    summary="Get note details by ID (Admin, Faculty, or Student)",
)
def get_note_route(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    note = get_note_by_id(db, note_id)

    # Students must not see draft note metadata.
    # Use 404 (not 403) to avoid revealing the draft exists.
    if current_user.role == UserRole.student and not note.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note ID {note_id} not found.",
        )

    # Build NoteDetailResponse with faculty brief
    from backend.schemas.notes import FacultyBriefForNote
    faculty_brief = None
    if note.faculty:
        faculty_brief = FacultyBriefForNote.model_validate(note.faculty)

    return NoteDetailResponse.model_validate({
        **note.__dict__,
        "faculty": faculty_brief,
    })


# ---------------------------------------------------------------
# GET /notes/{note_id}/download — Stream file to client
# ---------------------------------------------------------------
# Returns a FileResponse (binary stream), not JSON.
#
# FileResponse tells FastAPI to:
#   1. Read the file from `path`
#   2. Set Content-Type header to `media_type`
#   3. Set Content-Disposition header to suggest `filename`
#      → Browser uses this as the "Save As" filename
#   4. Stream the bytes to the client
#
# The client never sees the actual server path.
# They receive bytes with a filename header — that's it.
# ---------------------------------------------------------------
@router.get(
    "/{note_id}/download",
    summary="Download a note file (Admin, Faculty, or Student in section)",
    response_class=FileResponse,
)
def download_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import os
    from fastapi import HTTPException

    file_path, original_filename, mime_type = get_note_file_path(
        db, note_id,
        requesting_user_id=current_user.id,
        requesting_user_role=current_user.role.value,
    )

    # ── Physical file integrity check ───────────────────────────
    # The DB record is authoritative for metadata, but the file
    # must exist on disk. If it was deleted (orphaned record, disk
    # cleanup, migration error), return 410 Gone — not 500.
    # 410 (Gone) signals the frontend that this resource existed
    # but is permanently unavailable, so it can show a clean error.
    if not os.path.exists(file_path):
        logger.warning(
            f"[download] ORPHANED note_id={note_id} "
            f"file='{original_filename}' path='{file_path}' NOT FOUND on disk. "
            f"user_id={current_user.id}"
        )
        raise HTTPException(
            status_code=410,
            detail=(
                f"The file for note '{original_filename}' is no longer available on disk. "
                f"It may have been deleted during a system migration. "
                f"Please ask your faculty to re-upload the file."
            ),
        )

    disk_size = os.path.getsize(file_path)
    logger.debug(
        f"[download] note_id={note_id} file='{original_filename}' "
        f"mime='{mime_type}' disk_size={disk_size:,} bytes "
        f"user_id={current_user.id}"
    )

    return FileResponse(
        path=file_path,
        filename=original_filename,    # Browser "Save As" name
        media_type=mime_type,
        # Content-Length is set automatically by FileResponse from disk_size.
        # Content-Disposition is set to: attachment; filename="original_filename"
        # Both headers are verified in the frontend fetch() response.
    )


# ---------------------------------------------------------------
# PATCH /notes/{note_id} — Update note metadata (Faculty/Admin)
# ---------------------------------------------------------------
@router.patch(
    "/{note_id}",
    response_model=NoteResponse,
    summary="Update note title/description/subject (uploader or Admin)",
)
def update_note_route(
    note_id: int,
    data: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Faculty or Admin required.")

    if current_user.role == UserRole.admin:
        # Admin bypasses ownership check — pass faculty_user_id=None
        note = get_note_by_id(db, note_id)
        update_data = data.model_dump(exclude_unset=True)
        if "subject" in update_data:
            update_data["subject"] = update_data["subject"].strip().title()
        for field, value in update_data.items():
            setattr(note, field, value)
        db.commit()
        db.refresh(note)
        return note

    return update_note(db, note_id, current_user.id, data)


# ---------------------------------------------------------------
# PATCH /notes/{note_id}/publish — Publish or unpublish a note
# ---------------------------------------------------------------
# Separated from PATCH /notes/{id} (metadata update) intentionally.
# Publish is a lifecycle action with a side effect (student notification).
# Keeping it at its own sub-path makes the intent explicit at the HTTP level.
@router.patch(
    "/{note_id}/publish",
    response_model=FacultyNoteResponse,
    summary="Publish or unpublish a note (uploader Faculty only)",
)
def publish_note_route(
    note_id: int,
    data: NotePublishToggle,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    return publish_note(db, note_id, current_user.id, data.is_published)


# ---------------------------------------------------------------
# PUT /notes/{note_id}/replace-file — Swap the binary file
# ---------------------------------------------------------------
# async def: needed for `await file.read()`
# PUT (not PATCH) because it fully replaces the file resource.
# The note record's file metadata is wholly replaced by the new file.
#
# CONSTRAINT (enforced in service): note must be UNPUBLISHED.
# Faculty must: unpublish → replace → republish.
@router.put(
    "/{note_id}/replace-file",
    response_model=FacultyNoteResponse,
    summary="Replace the uploaded file for an unpublished note (uploader only)",
)
async def replace_note_file_route(
    note_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    content = await file.read()

    logger.debug(
        f"[replace-file] note_id={note_id} "
        f"filename='{file.filename}' "
        f"content_type='{file.content_type}' "
        f"bytes={len(content):,}"
    )

    note = replace_note_file(db, note_id, current_user.id, file, content)

    logger.info(
        f"[replace-file] note_id={note_id} replaced → "
        f"new file='{file.filename}' size={note.file_size:,} bytes"
    )

    return note


# ---------------------------------------------------------------
# DELETE /notes/{note_id} — Deactivate + delete file
# ---------------------------------------------------------------
@router.delete(
    "/{note_id}",
    summary="Delete a note and remove the file (uploader or Admin)",
)
def delete_note_route(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    if current_user.role not in (UserRole.admin, UserRole.faculty):
        raise HTTPException(status_code=403, detail="Faculty or Admin required.")

    if current_user.role == UserRole.admin:
        from backend.utils.file_utils import delete_upload
        note = get_note_by_id(db, note_id)
        file_path = note.file_path
        note.is_active = False
        db.commit()
        delete_upload(file_path)
        return {"message": f"Note '{note.title}' deleted.", "note_id": note_id}

    return deactivate_note(db, note_id, current_user.id)
