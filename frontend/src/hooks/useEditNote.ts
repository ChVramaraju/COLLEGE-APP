// ============================================================
// hooks/useEditNote.ts — Edit Faculty Note State Machine
// ============================================================
//
// RESPONSIBILITIES
// ─────────────────
// 1. Load existing note by ID (fetches all notes, filters by ID)
// 2. Manage metadata form state (title, subject, description)
// 3. Track form dirtiness vs. original note values
// 4. Optional file replacement: validate + upload via PUT /replace-file
// 5. Publish/Unpublish toggle via PATCH /notes/{id}/publish
// 6. Delete note via DELETE /notes/{id}
// 7. Unsaved-changes beforeunload guard
// 8. AbortController for in-flight file replacement (cleanup on unmount)
//
// SAVE SEQUENCE (submit() triggers)
// ──────────────────────────────────
//   isMetaDirty → PATCH /notes/{id}  → update local `note` snapshot
//   hasReplacement && fileValidation.valid
//              → PUT  /notes/{id}/replace-file  (with progress)
//              → update local `note` snapshot
//   Both ops complete → navigate('/faculty/notes', replace: true)
//
// ATOMICITY NOTE
// ──────────────
// The backend has no combined "update meta + replace file" endpoint.
// We run the two calls sequentially: meta PATCH first, then file PUT.
// If meta PATCH succeeds but file PUT fails, meta change is kept
// (it's already persisted). The user can retry the file replacement.
// This matches the backend's own isolation — each endpoint is atomic
// at the DB + filesystem level independently.
//
// ROLLBACK STRATEGY (server-side, not client)
// ────────────────────────────────────────────
// replaceNoteFile() backend flow:
//   1. Validate new file
//   2. Write new file to disk (new UUID filename)
//   3. BEGIN DB transaction: UPDATE note record (file fields)
//   4. If DB transaction commits → DELETE old file
//   5. If DB transaction fails → DELETE newly-written file (cleanup)
// Result: no orphan files, no inconsistent DB state.
// The frontend only sees success (step 4) or error (step 5 cleaned up).
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import type { FacultyNoteItem } from '@/types/facultyNotes';
import type { FileValidationResult } from '@/utils/fileValidation';
import { validateFileForUpload } from '@/utils/fileValidation';
import {
  getFacultyNotes,
  updateNoteMeta,
  toggleNotePublish,
  deleteNote as deleteNoteService,
  replaceNoteFile,
} from '@/services/facultyNotesService';


// ============================================================
// PUBLIC TYPES
// ============================================================

export interface EditFormState {
  title:       string;
  subject:     string;
  description: string;
}

export interface EditFormErrors {
  title?:   string;
  subject?: string;
}

export type EditSavePhase = 'idle' | 'saving' | 'success' | 'error';

export interface UseEditNoteReturn {
  // ── Note loading ─────────────────────────────────────────
  note:        FacultyNoteItem | null;
  isLoading:   boolean;
  loadError:   string | null;

  // ── Edit form ────────────────────────────────────────────
  form:        EditFormState;
  formErrors:  EditFormErrors;
  isDirty:     boolean;
  setField:    <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => void;

  // ── File replacement ─────────────────────────────────────
  replacementFile:       File | null;
  fileValidation:        FileValidationResult;
  replacePercent:        number;
  selectReplacementFile: (file: File) => void;
  clearReplacementFile:  () => void;

  // ── Save (meta + optional file) ──────────────────────────
  savePhase:  EditSavePhase;
  saveLabel:  string;
  saveError:  string | null;
  canSave:    boolean;
  save:       () => Promise<void>;

  // ── Publish toggle ───────────────────────────────────────
  isPublishing:  boolean;
  publishError:  string | null;
  togglePublish: () => Promise<void>;

  // ── Delete ───────────────────────────────────────────────
  isDeleting:  boolean;
  deleteError: string | null;
  deleteNote:  () => Promise<void>;
}


// ============================================================
// PRIVATE HELPERS
// ============================================================

const INITIAL_FILE_VALIDATION: FileValidationResult = { valid: false, error: null };

function validateEditForm(form: EditFormState): EditFormErrors {
  const errors: EditFormErrors = {};

  const title = form.title.trim();
  if (!title) {
    errors.title = 'Title is required.';
  } else if (title.length > 200) {
    errors.title = 'Title must be 200 characters or fewer.';
  }

  const subject = form.subject.trim();
  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length > 100) {
    errors.subject = 'Subject must be 100 characters or fewer.';
  }

  return errors;
}

function formFromNote(note: FacultyNoteItem): EditFormState {
  return {
    title:       note.title,
    subject:     note.subject,
    description: note.description ?? '',
  };
}

function isFormDirty(form: EditFormState, note: FacultyNoteItem): boolean {
  return (
    form.title.trim()       !== note.title.trim()       ||
    form.subject.trim()     !== note.subject.trim()      ||
    (form.description ?? '') !== (note.description ?? '')
  );
}


// ============================================================
// HOOK
// ============================================================

export function useEditNote(noteId: number): UseEditNoteReturn {
  const navigate = useNavigate();

  // ── Note load ────────────────────────────────────────────────
  const [note,      setNote]      = useState<FacultyNoteItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Form ─────────────────────────────────────────────────────
  const [form,       setFormState] = useState<EditFormState>({ title: '', subject: '', description: '' });
  const [formErrors, setFormErrors] = useState<EditFormErrors>({});

  // ── File replacement ─────────────────────────────────────────
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [fileValidation,  setFileValidation]  = useState<FileValidationResult>(INITIAL_FILE_VALIDATION);
  const [replacePercent,  setReplacePercent]  = useState(0);

  // ── Save state ───────────────────────────────────────────────
  const [savePhase, setSavePhase] = useState<EditSavePhase>('idle');
  const [saveLabel, setSaveLabel] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Publish state ────────────────────────────────────────────
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // ── Delete state ─────────────────────────────────────────────
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── AbortController ref for file replace ─────────────────────
  const abortRef = useRef<AbortController | null>(null);

  // ── Abort on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);


  // ── Load note ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    getFacultyNotes()
      .then(notes => {
        if (cancelled) return;
        const found = notes.find(n => n.id === noteId) ?? null;
        if (!found) {
          setLoadError('Note not found or you do not have permission to edit it.');
        } else {
          setNote(found);
          setFormState(formFromNote(found));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load note.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [noteId]);


  // ── Unsaved-changes guard ─────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!note) return false;
    return isFormDirty(form, note) || replacementFile !== null;
  }, [form, note, replacementFile]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Leave anyway?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);


  // ── Form field update ─────────────────────────────────────────
  const setField = useCallback(<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K],
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => {
      const key = field as keyof EditFormErrors;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // Clear save success so the button becomes active again
    setSavePhase(p => p === 'success' ? 'idle' : p);
  }, []);


  // ── File replacement selection ────────────────────────────────
  const selectReplacementFile = useCallback((file: File) => {
    const result = validateFileForUpload(file);
    setReplacementFile(file);
    setFileValidation(result);
    setReplacePercent(0);
    setSavePhase(p => p === 'success' ? 'idle' : p);
  }, []);

  const clearReplacementFile = useCallback(() => {
    abortRef.current?.abort();
    setReplacementFile(null);
    setFileValidation(INITIAL_FILE_VALIDATION);
    setReplacePercent(0);
  }, []);


  // ── Save (meta + optional file) ───────────────────────────────
  const save = useCallback(async (): Promise<void> => {
    if (!note) return;

    const errors = validateEditForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const isMetaDirty   = isFormDirty(form, note);
    const hasReplacement = replacementFile !== null && fileValidation.valid;

    if (!isMetaDirty && !hasReplacement) return;

    setSavePhase('saving');
    setSaveError(null);

    let currentNote = note;

    try {
      // ── Step 1: Patch metadata if changed ───────────────────
      if (isMetaDirty) {
        setSaveLabel('Saving metadata…');
        const updated = await updateNoteMeta(note.id, {
          title:       form.title.trim(),
          subject:     form.subject.trim(),
          description: form.description.trim() || undefined,
        });
        currentNote = updated;
        setNote(updated);
        setFormState(formFromNote(updated));
      }

      // ── Step 2: Replace file if a valid replacement exists ──
      if (hasReplacement && replacementFile) {
        setSaveLabel('Replacing file…');
        setReplacePercent(0);
        abortRef.current = new AbortController();

        const updated = await replaceNoteFile(
          note.id,
          replacementFile,
          (pct) => setReplacePercent(pct),
          abortRef.current.signal,
        );
        currentNote = updated;
        setNote(updated);
        setFormState(formFromNote(updated));
        setReplacementFile(null);
        setFileValidation(INITIAL_FILE_VALIDATION);
        setReplacePercent(0);
        abortRef.current = null;
      }

      void currentNote;  // silence unused var
      setSavePhase('success');
      setSaveLabel('');

      // Brief success flash, then redirect
      setTimeout(() => {
        navigate('/faculty/notes', { replace: true });
      }, 1200);

    } catch (err) {
      if (axios.isCancel(err)) {
        // User cancelled the file replace — reset to idle
        setSavePhase('idle');
        setSaveLabel('');
        setReplacePercent(0);
      } else {
        setSavePhase('error');
        setSaveLabel('');
        setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
      }
      abortRef.current = null;
    }
  }, [note, form, replacementFile, fileValidation.valid, navigate]);


  // ── Publish toggle ────────────────────────────────────────────
  const togglePublish = useCallback(async (): Promise<void> => {
    if (!note || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    const target = !note.is_published;
    // Optimistic update
    setNote(prev => prev ? { ...prev, is_published: target } : prev);

    try {
      const updated = await toggleNotePublish(note.id, { is_published: target });
      setNote(updated);
    } catch (err) {
      // Roll back optimistic update
      setNote(prev => prev ? { ...prev, is_published: !target } : prev);
      setPublishError(err instanceof Error ? err.message : 'Failed to update publish state.');
    } finally {
      setIsPublishing(false);
    }
  }, [note, isPublishing]);


  // ── Delete ────────────────────────────────────────────────────
  const deleteNote = useCallback(async (): Promise<void> => {
    if (!note || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteNoteService(note.id);
      navigate('/faculty/notes', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete note.');
      setIsDeleting(false);
    }
  }, [note, isDeleting, navigate]);


  // ── canSave derivation ────────────────────────────────────────
  const canSave =
    isDirty &&
    savePhase !== 'saving' &&
    savePhase !== 'success' &&
    (replacementFile === null || fileValidation.valid);


  return {
    note,
    isLoading,
    loadError,
    form,
    formErrors,
    isDirty,
    setField,
    replacementFile,
    fileValidation,
    replacePercent,
    selectReplacementFile,
    clearReplacementFile,
    savePhase,
    saveLabel,
    saveError,
    canSave,
    save,
    isPublishing,
    publishError,
    togglePublish,
    isDeleting,
    deleteError,
    deleteNote,
  };
}
