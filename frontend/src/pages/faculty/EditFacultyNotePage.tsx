// ============================================================
// pages/faculty/EditFacultyNotePage.tsx — Edit Note Page
// ============================================================
// Composition root for the note edit flow.
//
// LAYOUT (responsive, identical shell to UploadFacultyNotePage):
//   Left col (lg:2/3):
//     Card "Edit Details"     — title, subject, description form
//     Card "Replace File"     — optional new file (dropzone)
//   Right col (lg:1/3, sticky):
//     Card "Actions"          — publish toggle, save, delete
//
// STATE MACHINE (useEditNote):
//   load → form dirty-tracking → save (meta + optional file replace)
//   publish toggle (optimistic) → delete (navigate on success)
//
// UNSAVED CHANGES:
//   beforeunload guard in useEditNote activates whenever isDirty.
//   The Actions panel also shows a "Unsaved changes" badge so the
//   faculty member is always visually aware before navigating away.
// ============================================================

import { useState, type JSX, type ChangeEvent } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2,
  Globe, EyeOff, Trash2, Loader2, AlertCircle,
  Save, RefreshCw,
} from 'lucide-react';

import { useEditNote }        from '@/hooks/useEditNote';
import type { EditFormState } from '@/hooks/useEditNote';
import { formatBytes, getMimeConfig } from '@/types/facultyNotes';

import UploadDropzone        from '@/components/faculty-notes/upload/UploadDropzone';
import UploadFilePreview     from '@/components/faculty-notes/upload/UploadFilePreview';
import UploadValidationAlert from '@/components/faculty-notes/upload/UploadValidationAlert';
import UploadProgressBar     from '@/components/faculty-notes/upload/UploadProgressBar';

// ── Shared style constants ────────────────────────────────────
const CARD      = 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm';
const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 ' +
  'placeholder-gray-400 transition-colors focus:border-indigo-400 focus:bg-white ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60';


// ============================================================
// ROOT — guards noteId, delegates to inner editor
// ============================================================

export default function EditFacultyNotePage(): JSX.Element {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate   = useNavigate();
  const id         = parseInt(noteId ?? '', 10);

  if (!noteId || isNaN(id)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
        <p className="text-sm font-semibold text-rose-700">Invalid note ID in URL.</p>
        <Link to="/faculty/notes" className="mt-4 text-sm text-indigo-600 underline">
          Back to My Notes
        </Link>
      </div>
    );
  }

  return <EditNoteEditor noteId={id} onBack={() => navigate('/faculty/notes')} />;
}


// ============================================================
// INNER EDITOR  (safe — noteId is a valid integer)
// ============================================================

function EditNoteEditor({
  noteId,
  onBack,
}: {
  noteId: number;
  onBack: () => void;
}): JSX.Element {
  const engine = useEditNote(noteId);
  const {
    note, isLoading, loadError,
    form, formErrors, isDirty, setField,
    replacementFile, fileValidation, replacePercent,
    selectReplacementFile, clearReplacementFile,
    savePhase, saveLabel, saveError, canSave, save,
    isPublishing, publishError, togglePublish,
    isDeleting, deleteError, deleteNote,
  } = engine;

  // ── Delete confirmation state (local — pure UI) ──────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSaving = savePhase === 'saving';

  // ── Skeleton (loading) ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse px-4 py-8">
        <div className="mb-6 h-5 w-40 rounded-full bg-gray-200" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="h-64 rounded-2xl bg-gray-200" />
            <div className="h-48 rounded-2xl bg-gray-200" />
          </div>
          <div className="h-80 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  // ── Load error ────────────────────────────────────────────
  if (loadError || !note) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-rose-400" />
        <p className="text-sm font-semibold text-rose-700">
          {loadError ?? 'Note not found.'}
        </p>
        <Link to="/faculty/notes" className="mt-4 text-sm text-indigo-600 underline">
          Back to My Notes
        </Link>
      </div>
    );
  }

  const mime = getMimeConfig(note.mime_type);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">

      {/* ── Breadcrumb nav ──────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/faculty/notes"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My Notes
        </Link>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="max-w-xs truncate text-sm font-semibold text-gray-900" title={note.title}>
          Edit: {note.title}
        </span>
        {isDirty && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Unsaved changes
          </span>
        )}
      </div>

      {/* ── Two-column layout ───────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left: form + file replacement ─────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* ── Edit Details card ─────────────────────── */}
          <div className={CARD}>
            <h2 className="mb-5 text-base font-semibold text-gray-800">Edit Details</h2>

            {/* Inline form-level errors */}
            {Object.values(formErrors).some(Boolean) && (
              <div className="mb-5">
                <UploadValidationAlert
                  formErrors={Object.values(formErrors).filter(Boolean) as string[]}
                />
              </div>
            )}

            <EditMetadataForm
              form={form}
              formErrors={formErrors}
              isDisabled={isSaving}
              onFieldChange={setField}
            />
          </div>

          {/* ── Replace File card ────────────────────────── */}
          <div className={CARD}>
            <h2 className="mb-1 text-base font-semibold text-gray-800">Replace File</h2>
            <p className="mb-4 text-xs text-gray-500">
              Optional. Leave empty to keep the existing file.
            </p>

            {/* Existing file strip */}
            <ExistingFileStrip
              name={note.original_file_name}
              size={note.file_size}
              mimeType={note.mime_type}
              mimeLabel={mime.label}
              mimeBg={mime.iconBg}
              mimeColor={mime.iconColor}
            />

            {/* Replacement drop zone */}
            <div className="mt-4">
              <UploadDropzone
                isUploading={isSaving}
                onFileDrop={selectReplacementFile}
              />
            </div>

            {/* Selected replacement file preview */}
            {replacementFile && (
              <div className="mt-3">
                <UploadFilePreview
                  file={replacementFile}
                  isUploading={isSaving}
                  onClear={clearReplacementFile}
                />
              </div>
            )}

            {/* File validation error */}
            {fileValidation.error && (
              <div className="mt-3">
                <UploadValidationAlert fileError={fileValidation.error} />
              </div>
            )}

            {/* File replace progress */}
            {isSaving && replacementFile && (
              <div className="mt-3">
                <UploadProgressBar percent={replacePercent} phase="uploading" />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: actions (sticky) ─────────────────────── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className={`${CARD} flex flex-col gap-5`}>
            <h2 className="text-base font-semibold text-gray-800">Actions</h2>

            {/* ── Save progress / success ──────────────── */}
            {savePhase === 'saving' && (
              <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
                <span className="text-sm font-medium text-indigo-700">
                  {saveLabel || 'Saving…'}
                </span>
              </div>
            )}

            {savePhase === 'success' && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span className="text-sm font-medium text-emerald-700">
                  Saved! Redirecting…
                </span>
              </div>
            )}

            {/* Save error */}
            {savePhase === 'error' && saveError && (
              <UploadValidationAlert uploadError={saveError} />
            )}

            {/* ── Publish toggle ───────────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Visibility
              </p>
              <button
                onClick={() => void togglePublish()}
                disabled={isPublishing || isSaving}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                  note.is_published
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400'
                }`}
              >
                {isPublishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : note.is_published ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Globe className="h-4 w-4" aria-hidden="true" />
                )}
                {isPublishing
                  ? 'Updating…'
                  : note.is_published
                    ? 'Unpublish (make draft)'
                    : 'Publish to students'
                }
              </button>

              {publishError && (
                <p className="mt-1.5 text-xs text-rose-600">{publishError}</p>
              )}

              <p className="mt-1.5 text-xs text-gray-400">
                {note.is_published
                  ? 'Students in your section can currently see this note.'
                  : 'This note is currently hidden from students.'}
              </p>
            </div>

            {/* ── Save Changes button ──────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Save Changes
              </p>
              <button
                onClick={() => void save()}
                disabled={!canSave}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {isSaving ? saveLabel || 'Saving…' : 'Save Changes'}
              </button>

              {!isDirty && savePhase === 'idle' && (
                <p className="mt-1.5 text-center text-xs text-gray-400">
                  No changes to save yet.
                </p>
              )}
            </div>

            {/* ── Delete section ───────────────────────── */}
            <div className="border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Danger Zone
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || isDeleting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete This Note
                </button>
              ) : (
                <DeleteConfirmPanel
                  isDeleting={isDeleting}
                  deleteError={deleteError}
                  onConfirm={() => void deleteNote()}
                  onCancel={() => setShowDeleteConfirm(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// SUB-COMPONENTS
// ============================================================

// ── Edit Metadata Form ──────────────────────────────────────
function FieldRow({
  label,
  required = false,
  error,
  hint,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  hint?:     string;
  children:  React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>
      )}
      {!error && hint && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

function EditMetadataForm({
  form,
  formErrors,
  isDisabled,
  onFieldChange,
}: {
  form:          EditFormState;
  formErrors:    { title?: string; subject?: string };
  isDisabled:    boolean;
  onFieldChange: <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      <FieldRow label="Note Title" required error={formErrors.title}>
        <input
          type="text"
          value={form.title}
          disabled={isDisabled}
          maxLength={200}
          placeholder="e.g. Unit 3 — Linked Lists Revision Notes"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('title', e.target.value)}
          className={INPUT_CLS}
        />
      </FieldRow>

      <FieldRow label="Subject" required error={formErrors.subject}>
        <input
          type="text"
          value={form.subject}
          disabled={isDisabled}
          maxLength={100}
          placeholder="e.g. Data Structures and Algorithms"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onFieldChange('subject', e.target.value)}
          className={INPUT_CLS}
        />
      </FieldRow>

      <FieldRow
        label="Description"
        hint="Optional — topics covered, chapter reference, intended audience…"
      >
        <textarea
          rows={3}
          value={form.description}
          disabled={isDisabled}
          maxLength={2000}
          placeholder="Optional description or notes for students…"
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onFieldChange('description', e.target.value)}
          className={`${INPUT_CLS} resize-none`}
        />
        <p className="self-end text-xs text-gray-400">
          {form.description.length} / 2000
        </p>
      </FieldRow>
    </div>
  );
}


// ── Existing File Strip ─────────────────────────────────────
function ExistingFileStrip({
  name,
  size,
  mimeLabel,
  mimeBg,
  mimeColor,
}: {
  name:      string;
  size:      number;
  mimeType:  string;
  mimeLabel: string;
  mimeBg:    string;
  mimeColor: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${mimeBg} ${mimeColor}`}
        aria-hidden="true"
      >
        {mimeLabel}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{name}</p>
        <p className="text-xs text-gray-500">{formatBytes(size)} · Current file</p>
      </div>
      <RefreshCw className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
    </div>
  );
}


// ── Delete Confirm Panel ────────────────────────────────────
function DeleteConfirmPanel({
  isDeleting,
  deleteError,
  onConfirm,
  onCancel,
}: {
  isDeleting:  boolean;
  deleteError: string | null;
  onConfirm:   () => void;
  onCancel:    () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden="true" />
        <p className="text-xs text-rose-700">
          <strong>This cannot be undone.</strong> The note and its file will be permanently removed.
          Students will immediately lose access.
        </p>
      </div>

      {deleteError && (
        <p className="text-xs font-medium text-rose-700">{deleteError}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="flex-1 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isDeleting ? 'Deleting…' : 'Yes, delete'}
        </button>
      </div>
    </div>
  );
}
