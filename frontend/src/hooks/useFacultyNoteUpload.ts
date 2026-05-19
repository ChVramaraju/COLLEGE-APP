// ============================================================
// hooks/useFacultyNoteUpload.ts — Upload Flow State Machine
// ============================================================
//
// RESPONSIBILITIES
// ─────────────────
// 1. File selection + immediate client-side validation
// 2. Form field management + field-level error tracking
// 3. Upload lifecycle: idle → uploading → success | error
// 4. AbortController-based cancellation (cancel in-flight XHR)
// 5. Cleanup on unmount (abort any pending upload)
// 6. Object URL lifecycle is NOT owned here — component handles it
//
// VALIDATION PIPELINE
// ───────────────────
// selectFile() → validateFileForUpload() (mirrors backend exactly)
//             → sets fileValidation.valid + fileValidation.error
//
// submit()     → validateForm() (required fields, max lengths)
//             → on pass: uploadNote() with AbortSignal + progress cb
//
// CANCELLATION STRATEGY
// ──────────────────────
// AbortController is created fresh for every upload attempt.
// signal is passed into uploadNote() → threaded into Axios config.
// Axios maps signal.abort() to a CanceledError (axios.isCancel()).
// On cancel: reset to idle (no error shown — user-initiated).
// abortRef is cleared in finally{} to prevent stale abort.
//
// WHY useRef for AbortController (not useState)?
//   abort() must be callable without triggering re-renders.
//   The controller is an imperative handle, not display data.
//
// OPTIMISTIC SUCCESS HANDLING
// ────────────────────────────
// On success, uploadedNote is stored in uploadState.
// UploadFacultyNotePage reads it to show a preview and
// auto-navigates to /faculty/notes after a short delay.
// useFacultyNotes hook will refetch on mount when page remounts.
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { UploadProgressState } from '@/types/facultyNotes';
import { INITIAL_UPLOAD_STATE } from '@/types/facultyNotes';
import type { FileValidationResult } from '@/utils/fileValidation';
import { validateFileForUpload } from '@/utils/fileValidation';
import { uploadNote } from '@/services/facultyNotesService';


// ============================================================
// TYPES — exported so form components can use them in props
// ============================================================

export interface UploadFormState {
  title:       string;
  subject:     string;
  section_id:  number | '';
  description: string;
}

export interface UploadFormErrors {
  title?:      string;
  subject?:    string;
  section_id?: string;
}

export interface UseFacultyNoteUploadReturn {
  // ── File selection ──────────────────────────────────────
  selectedFile:    File | null;
  fileValidation:  FileValidationResult;
  selectFile:      (file: File) => void;
  clearFile:       () => void;

  // ── Form state ───────────────────────────────────────────
  form:       UploadFormState;
  formErrors: UploadFormErrors;
  setField:   <K extends keyof UploadFormState>(
    field: K,
    value: UploadFormState[K],
  ) => void;

  // ── Upload lifecycle ─────────────────────────────────────
  uploadState: UploadProgressState;

  // ── Actions ──────────────────────────────────────────────
  submit:  (autoPublish: boolean) => Promise<void>;
  cancel:  () => void;
  reset:   () => void;

  // ── Derived ──────────────────────────────────────────────
  // true only when file is valid + all required form fields filled
  // + upload is not in-flight
  canSubmit: boolean;
}


// ============================================================
// CONSTANTS
// ============================================================

const INITIAL_FORM: UploadFormState = {
  title:       '',
  subject:     '',
  section_id:  '',
  description: '',
};

const INITIAL_FILE_VALIDATION: FileValidationResult = {
  valid: false,
  error: null,
};


// ============================================================
// FORM VALIDATION
// ============================================================

function validateForm(form: UploadFormState): UploadFormErrors {
  const errors: UploadFormErrors = {};

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

  if (form.section_id === '' || form.section_id === 0) {
    errors.section_id = 'Please select a section.';
  }

  return errors;
}


// ============================================================
// HOOK
// ============================================================

export function useFacultyNoteUpload(): UseFacultyNoteUploadReturn {
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidationResult>(INITIAL_FILE_VALIDATION);
  const [form,           setFormState]      = useState<UploadFormState>(INITIAL_FORM);
  const [formErrors,     setFormErrors]     = useState<UploadFormErrors>({});
  const [uploadState,    setUploadState]    = useState<UploadProgressState>(INITIAL_UPLOAD_STATE);

  // Imperative handle — NOT display state, must not trigger re-renders
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight upload on unmount to prevent memory leaks
  // and avoid setState on an unmounted component
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);


  // ── File selection ─────────────────────────────────────────

  const selectFile = useCallback((file: File) => {
    const result = validateFileForUpload(file);
    setSelectedFile(file);
    setFileValidation(result);
    // Reset any previous upload result when a new file is chosen
    setUploadState(INITIAL_UPLOAD_STATE);
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setFileValidation(INITIAL_FILE_VALIDATION);
    setUploadState(INITIAL_UPLOAD_STATE);
  }, []);


  // ── Form field update ──────────────────────────────────────

  const setField = useCallback(<K extends keyof UploadFormState>(
    field: K,
    value: UploadFormState[K],
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
    // Clear just this field's error so the user gets immediate
    // feedback that their correction was recognised
    setFormErrors(prev => {
      const key = field as keyof UploadFormErrors;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);


  // ── Submit ─────────────────────────────────────────────────

  const submit = useCallback(async (autoPublish: boolean): Promise<void> => {
    if (!selectedFile || !fileValidation.valid) return;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setUploadState({ phase: 'uploading', percent: 0, error: null, uploadedNote: null });

    abortRef.current = new AbortController();

    try {
      const note = await uploadNote(
        {
          title:        form.title.trim(),
          subject:      form.subject.trim(),
          section_id:   form.section_id as number,
          description:  form.description.trim() || undefined,
          auto_publish: autoPublish,
          file:         selectedFile,
        },
        (percent) => {
          setUploadState(prev => ({ ...prev, percent }));
        },
        abortRef.current.signal,
      );

      setUploadState({ phase: 'success', percent: 100, error: null, uploadedNote: note });
    } catch (err) {
      if (axios.isCancel(err)) {
        // User deliberately cancelled — reset silently to idle
        setUploadState(INITIAL_UPLOAD_STATE);
      } else {
        const message =
          err instanceof Error
            ? err.message
            : 'Upload failed. Please try again.';
        setUploadState({ phase: 'error', percent: 0, error: message, uploadedNote: null });
      }
    } finally {
      abortRef.current = null;
    }
  }, [selectedFile, fileValidation.valid, form]);


  // ── Cancel ─────────────────────────────────────────────────

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);


  // ── Full reset ─────────────────────────────────────────────
  // Called after upload success or when user explicitly clears everything

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSelectedFile(null);
    setFileValidation(INITIAL_FILE_VALIDATION);
    setFormState(INITIAL_FORM);
    setFormErrors({});
    setUploadState(INITIAL_UPLOAD_STATE);
  }, []);


  // ── canSubmit derivation ───────────────────────────────────

  const canSubmit =
    selectedFile !== null &&
    fileValidation.valid &&
    form.title.trim() !== '' &&
    form.subject.trim() !== '' &&
    form.section_id !== '' &&
    uploadState.phase !== 'uploading' &&
    uploadState.phase !== 'success';


  return {
    selectedFile,
    fileValidation,
    selectFile,
    clearFile,
    form,
    formErrors,
    setField,
    uploadState,
    submit,
    cancel,
    reset,
    canSubmit,
  };
}
