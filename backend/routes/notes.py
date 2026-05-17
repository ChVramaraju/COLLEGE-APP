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

from fastapi import APIRouter, Depends, Form, File, UploadFile, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database.connection import get_db
from backend.auth.dependencies import (
    get_current_faculty,
    get_current_admin,
    get_current_user,
)
from backend.models.user import User, UserRole
from backend.schemas.notes import NoteResponse, NoteDetailResponse, NoteUpdate
from backend.services.notes_service import (
    upload_note,
    get_note_by_id,
    list_notes_by_section,
    get_note_file_path,
    update_note,
    deactivate_note,
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
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a note file for a section (Faculty only)",
)
async def upload_note_route(
    title: str = Form(..., min_length=2, max_length=200),
    subject: str = Form(..., min_length=2, max_length=100),
    section_id: int = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_faculty),
):
    content = await file.read()   # Read bytes ONCE here, pass to sync service
    return upload_note(
        db, current_user.id,
        title, subject, section_id,
        file, content, description
    )


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
    note = get_note_by_id(db, note_id)

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
    file_path, original_filename, mime_type = get_note_file_path(
        db, note_id,
        requesting_user_id=current_user.id,
        requesting_user_role=current_user.role.value,
    )
    return FileResponse(
        path=file_path,
        filename=original_filename,    # Browser "Save As" name
        media_type=mime_type,
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
