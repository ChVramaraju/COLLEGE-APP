# =============================================================
# services/notes_service.py — Notes Business Logic
# =============================================================
# KEY DIFFERENCE from other services:
#   This service handles TWO resources simultaneously:
#     1. The database record (note metadata)
#     2. The filesystem file (actual bytes)
#
# TRANSACTION SAFETY CHALLENGE:
#   DB transaction = automatic rollback on failure (SQLAlchemy)
#   Filesystem = NO automatic rollback
#
#   If we save the file THEN the DB insert fails:
#     → File is on disk (orphaned)
#     → No DB record pointing to it
#     → Disk space leak, unreachable file
#
#   SOLUTION: Save file first, insert DB second.
#   If DB insert fails → manually delete the file (compensating action).
#   This is called a "compensating transaction" in distributed systems.
# =============================================================

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, UploadFile, status
from typing import Optional

from backend.models.notes import Note
from backend.models.faculty import Faculty
from backend.models.section import Section
from backend.models.student import Student
from backend.models.user import User
from backend.schemas.notes import NoteUpdate
from backend.utils.file_utils import (
    validate_upload, save_upload, delete_upload, is_safe_path
)


# ---------------------------------------------------------------
# UPLOAD NOTE — Core operation
# ---------------------------------------------------------------
def upload_note(
    db: Session,
    faculty_user_id: int,
    title: str,
    subject: str,
    section_id: int,
    file: UploadFile,
    content: bytes,
    description: Optional[str] = None,
    auto_publish: bool = False,
) -> Note:
    """
    Saves a note file and its metadata atomically.

    STEP-BY-STEP FLOW:
      1. Resolve faculty from JWT user_id
      2. Validate section exists
      3. Check department permission
      4. Validate file (MIME, extension, size)
      5. Save file to disk → get UUID filename + path
      6. Try INSERT metadata into DB
      7. If INSERT fails → DELETE the file (compensating action)
      8. Return Note object

    THE COMPENSATING TRANSACTION PATTERN:
      This is how distributed systems handle partial failures.
      When you have two separate systems (DB + filesystem) that
      don't share a transaction boundary, you implement cleanup
      manually. This keeps both systems consistent.
    """
    # --- Resolve faculty ---
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found."
        )

    # --- Validate section ---
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    # --- Permission: same department ---
    if faculty.department != section.department:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Permission denied. You belong to '{faculty.department.value}' "
                f"but section is in '{section.department.value}'."
            )
        )

    # --- Validate file (raises immediately on violation) ---
    validate_upload(file, content)

    # --- Save file to disk ---
    stored_filename, file_path = save_upload(file, content)

    # --- Insert metadata into DB ---
    try:
        note = Note(
            faculty_id=faculty.id,
            section_id=section_id,
            subject=subject.strip().title(),
            title=title.strip(),
            description=description,
            original_file_name=file.filename,
            file_name=stored_filename,
            file_path=file_path,
            file_size=len(content),
            mime_type=file.content_type,
            is_published=auto_publish,
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        # FIRE-AND-FORGET: Notify all students in the section
        # Only when auto_publish=True — draft uploads must not notify
        # students about a note they cannot yet see.
        # Notification on explicit publish is handled by publish_note().
        if auto_publish:
            try:
                from backend.services.notification_service import create_system_notification
                from backend.models.enums import NotificationType
                students_in_section = (
                    db.query(Student)
                    .join(User, Student.user_id == User.id)
                    .filter(Student.section_id == section_id, User.is_active == True)
                    .all()
                )
                for stu in students_in_section:
                    create_system_notification(
                        db,
                        recipient_user_id=stu.user_id,
                        title=f"New Notes: {title}",
                        message=f"{subject} notes uploaded by faculty: '{title}'",
                        notification_type=NotificationType.notes_uploaded,
                        section_id=section_id,
                    )
                db.commit()
            except Exception:
                pass   # Never block note upload for notification failure

        return note

    except Exception as e:
        # COMPENSATING ACTION: undo the file save
        # Without this, the file would be orphaned on disk forever.
        delete_upload(file_path)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Note upload failed: {str(e)}"
        )


# ---------------------------------------------------------------
# GET NOTE BY ID — With security check
# ---------------------------------------------------------------
def get_note_by_id(db: Session, note_id: int) -> Note:
    note = (
        db.query(Note)
        .options(joinedload(Note.faculty))
        .filter(Note.id == note_id, Note.is_active == True)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note ID {note_id} not found."
        )
    return note


# ---------------------------------------------------------------
# LIST NOTES BY SECTION — For students and faculty
# ---------------------------------------------------------------
def list_notes_by_section(
    db: Session,
    section_id: int,
    subject: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Note]:
    """
    Lists active notes for a section with optional filters.

    FILTERS:
      subject → show only notes for "Data Structures"
      search  → search in title (ILIKE = case-insensitive LIKE)
      skip/limit → pagination
    """
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section ID {section_id} not found."
        )

    query = db.query(Note).filter(
        Note.section_id == section_id,
        Note.is_active == True,
        Note.is_published == True,   # students only see published notes
    )

    if subject:
        query = query.filter(Note.subject == subject.strip().title())

    if search:
        query = query.filter(Note.title.ilike(f"%{search.strip()}%"))

    return (
        query
        .order_by(Note.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------
# GET FILE PATH FOR DOWNLOAD — Secure serving
# ---------------------------------------------------------------
def get_note_file_path(
    db: Session,
    note_id: int,
    requesting_user_id: int,
    requesting_user_role: str,
) -> tuple[str, str, str]:
    """
    Resolves the filesystem path for a note download.

    Returns: (file_path, original_filename, mime_type)

    SECURITY CHECKS:
      1. Note must exist and be active
      2. If student: their section must match note's section
      3. File path must be inside upload directory (path traversal guard)

    WHY check path safety even from DB?
    → If DB is compromised or a record is manually edited,
      an attacker could set file_path = "/etc/passwd"
    → The is_safe_path() check ensures even a tampered DB
      cannot cause file disclosure outside the upload directory.
    """
    note = (
        db.query(Note)
        .filter(Note.id == note_id, Note.is_active == True)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Note ID {note_id} not found."
        )

    # --- Student: can only download notes for their own section ---
    # --- and cannot download unpublished (draft) notes -------------
    if requesting_user_role == "student":
        student = (
            db.query(Student)
            .filter(Student.user_id == requesting_user_id)
            .first()
        )
        if not student or student.section_id != note.section_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only download notes for your own section."
            )
        # BUG FIX: Draft notes must not be downloadable by students.
        # A student who knows a note_id (e.g. from a previous URL) could
        # directly fetch a draft. Return 404 (not 403) to avoid revealing
        # the note exists in draft state.
        if not note.is_published:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Note ID {note_id} not found."
            )

    # --- Path traversal guard ---
    if not is_safe_path(note.file_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File path is invalid. Contact administrator."
        )

    # NOTE: Physical file existence is NOT checked here.
    # The download route owns that check and correctly returns 410 (Gone)
    # vs 404 (Not Found). Checking here would preempt that 410 with a 404.

    return note.file_path, note.original_file_name, note.mime_type


# ---------------------------------------------------------------
# UPDATE NOTE METADATA — Partial update
# ---------------------------------------------------------------
def update_note(
    db: Session,
    note_id: int,
    faculty_user_id: int,
    data: NoteUpdate,
) -> Note:
    """
    Faculty can update title/description/subject of their own notes.
    File itself is immutable — must delete + re-upload to replace.
    """
    note = get_note_by_id(db, note_id)

    # Ownership check: only the uploader can update.
    # BUG FIX: was `if faculty and ...` which SKIPPED the check when
    # faculty profile was not found (faculty=None). Changed to
    # `if not faculty or ...` so a missing profile is a rejection.
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty or note.faculty_id != faculty.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update notes you uploaded."
        )

    update_data = data.model_dump(exclude_unset=True)
    if "subject" in update_data:
        update_data["subject"] = update_data["subject"].strip().title()

    for field, value in update_data.items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


# ---------------------------------------------------------------
# DEACTIVATE NOTE — Soft delete + file removal
# ---------------------------------------------------------------
def deactivate_note(
    db: Session,
    note_id: int,
    faculty_user_id: int,
) -> dict:
    """
    Soft-deactivates the DB record AND deletes the file from disk.

    WHY delete the actual file on deactivation?
    → Notes module files serve no purpose when deactivated
    → Keeping them wastes disk space
    → Unlike student records (audit trail), files have no long-term value
    → File can be re-uploaded if needed

    ORDER: deactivate DB first, then delete file.
    If file deletion fails, DB is still consistent (note is inactive).
    The orphaned file is a minor cleanup issue, not a data integrity issue.
    """
    note = get_note_by_id(db, note_id)

    # BUG FIX: same ownership check fix as update_note (was `if faculty and ...`)
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty or note.faculty_id != faculty.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete notes you uploaded."
        )

    file_path = note.file_path
    note.is_active = False
    db.commit()

    # File cleanup after DB update is committed
    delete_upload(file_path)

    return {"message": f"Note '{note.title}' has been deleted.", "note_id": note_id}


# ---------------------------------------------------------------
# LIST FACULTY'S OWN NOTES — Management view (includes drafts)
# ---------------------------------------------------------------
def list_faculty_notes(
    db: Session,
    faculty_user_id: int,
    search: Optional[str] = None,
    subject: Optional[str] = None,
    is_published: Optional[bool] = None,
    skip: int = 0,
    limit: int = 200,
) -> list[Note]:
    """
    Returns all notes uploaded by this faculty member, including drafts.

    KEY DIFFERENCE from list_notes_by_section():
      → No is_published=True filter. Faculty must see ALL their notes
        (published + drafts) to manage them effectively.
      → Scoped to this faculty's uploads only, not the whole section.
        Faculty A cannot see Faculty B's drafts.
      → is_published param is optional: None = all, True/False = filtered.
    """
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Faculty profile not found."
        )

    query = db.query(Note).filter(
        Note.faculty_id == faculty.id,
        Note.is_active == True,
    )

    if is_published is not None:
        query = query.filter(Note.is_published == is_published)

    if subject:
        query = query.filter(Note.subject == subject.strip().title())

    if search:
        query = query.filter(Note.title.ilike(f"%{search.strip()}%"))

    return (
        query
        .order_by(Note.uploaded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------
# PUBLISH / UNPUBLISH NOTE
# ---------------------------------------------------------------
def publish_note(
    db: Session,
    note_id: int,
    faculty_user_id: int,
    is_published: bool,
) -> Note:
    """
    Sets the is_published flag on a note.

    OWNERSHIP: only the uploader can publish/unpublish their own notes.

    SIDE EFFECT on publish (is_published=True):
      → Notifies all students in the section — fire-and-forget.
      → Never blocks the publish action if notification fails.

    SIDE EFFECT on unpublish (is_published=False):
      → No notification needed — students simply lose access silently.
    """
    note = get_note_by_id(db, note_id)

    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty or note.faculty_id != faculty.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only publish or unpublish notes you uploaded."
        )

    note.is_published = is_published
    db.commit()
    db.refresh(note)

    # Notify students when publishing (not unpublishing)
    if is_published:
        try:
            from backend.services.notification_service import create_system_notification
            from backend.models.enums import NotificationType
            students_in_section = (
                db.query(Student)
                .join(User, Student.user_id == User.id)
                .filter(Student.section_id == note.section_id, User.is_active == True)
                .all()
            )
            for stu in students_in_section:
                create_system_notification(
                    db,
                    recipient_user_id=stu.user_id,
                    title=f"New Notes: {note.title}",
                    message=f"{note.subject} notes are now available: '{note.title}'",
                    notification_type=NotificationType.notes_uploaded,
                    section_id=note.section_id,
                )
            db.commit()
        except Exception:
            pass   # Never block the publish action for notification failure

    return note


# ---------------------------------------------------------------
# REPLACE NOTE FILE — Swap the binary file, keep all metadata
# ---------------------------------------------------------------
def replace_note_file(
    db: Session,
    note_id: int,
    faculty_user_id: int,
    file: UploadFile,
    content: bytes,
) -> Note:
    """
    Replaces the uploaded file for a note while preserving all metadata.

    CONSTRAINT: Can only replace files on UNPUBLISHED notes.
    WHY? Students may have already downloaded the published file.
    Silently swapping it would cause confusion ("where did my download go?").
    Faculty must unpublish → replace → republish. This makes the action
    explicit and auditable.

    TRANSACTION SAFETY:
      1. Validate new file (fail fast, no disk writes yet)
      2. Save new file to disk
      3. Update DB record
      4. On DB failure → delete new file (compensating action)
      5. On DB success → delete old file (cleanup after commit)

    WHY delete old file AFTER commit?
      If we deleted old first and DB update fails, the file is gone forever.
      Deleting after commit means the DB record and disk are always consistent:
      if commit failed, old file still exists and DB still points to it.
    """
    note = get_note_by_id(db, note_id)

    # Ownership check
    faculty = db.query(Faculty).filter(Faculty.user_id == faculty_user_id).first()
    if not faculty or note.faculty_id != faculty.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only replace files for notes you uploaded."
        )

    # Published notes cannot have their file replaced
    if note.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Cannot replace the file of a published note. "
                "Unpublish the note first, replace the file, then republish."
            )
        )

    # Validate new file (fail fast before any disk writes)
    validate_upload(file, content)

    # Save new file to disk
    new_filename, new_file_path = save_upload(file, content)

    # Update DB record — capture old path for cleanup
    old_file_path = note.file_path
    try:
        note.file_name          = new_filename
        note.file_path          = new_file_path
        note.file_size          = len(content)
        note.mime_type          = file.content_type
        note.original_file_name = file.filename
        db.commit()
        db.refresh(note)

        # Delete the old file ONLY after a successful commit
        delete_upload(old_file_path)

        return note

    except Exception as e:
        # Compensating action: delete the newly saved file
        delete_upload(new_file_path)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File replacement failed: {str(e)}"
        )
