import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { JSX } from 'react';

import { useFacultyNoteUpload } from '@/hooks/useFacultyNoteUpload';
import { formatBytes, getMimeConfig } from '@/types/facultyNotes';

import UploadDropzone        from '@/components/faculty-notes/upload/UploadDropzone';
import UploadFilePreview     from '@/components/faculty-notes/upload/UploadFilePreview';
import UploadValidationAlert from '@/components/faculty-notes/upload/UploadValidationAlert';
import UploadMetadataForm    from '@/components/faculty-notes/upload/UploadMetadataForm';
import UploadProgressBar     from '@/components/faculty-notes/upload/UploadProgressBar';
import UploadActions         from '@/components/faculty-notes/upload/UploadActions';

// ── Shared card class ────────────────────────────────────────
const CARD = 'rounded-2xl border border-gray-200 bg-white p-6 shadow-sm';

export default function UploadFacultyNotePage(): JSX.Element {
  const navigate = useNavigate();

  const {
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
  } = useFacultyNoteUpload();

  const isUploading = uploadState.phase === 'uploading';

  // ── Auto-navigate to dashboard after success ─────────────
  // Give the faculty 3 s to read the success state, then redirect.
  // They can also click "View My Notes" immediately.
  useEffect(() => {
    if (uploadState.phase !== 'success') return;
    const timer = setTimeout(() => navigate('/faculty/notes', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [uploadState.phase, navigate]);

  // ── Collect form-level errors for the alert ──────────────
  const formErrorMessages = Object.values(formErrors).filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">

      {/* ── Back nav ──────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/faculty/notes"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My Notes
        </Link>
        <span className="text-gray-300" aria-hidden="true">/</span>
        <span className="text-sm font-semibold text-gray-900">Upload Note</span>
      </div>

      {/* ── Two-column layout ─────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left: file + form ─────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* File selection card */}
          <div className={CARD}>
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              Select File
            </h2>

            <UploadDropzone
              isUploading={isUploading}
              onFileDrop={selectFile}
            />

            {/* File preview — only shown when a file is selected */}
            {selectedFile && (
              <div className="mt-3">
                <UploadFilePreview
                  file={selectedFile}
                  isUploading={isUploading}
                  onClear={clearFile}
                />
              </div>
            )}

            {/* File validation error */}
            {fileValidation.error && (
              <div className="mt-3">
                <UploadValidationAlert fileError={fileValidation.error} />
              </div>
            )}
          </div>

          {/* Metadata form card */}
          <div className={CARD}>
            <h2 className="mb-5 text-base font-semibold text-gray-800">
              Note Details
            </h2>

            {/* Form-level errors */}
            {formErrorMessages.length > 0 && (
              <div className="mb-5">
                <UploadValidationAlert formErrors={formErrorMessages} />
              </div>
            )}

            <UploadMetadataForm
              form={form}
              formErrors={formErrors}
              isDisabled={isUploading}
              onFieldChange={setField}
            />
          </div>
        </div>

        {/* ── Right: actions panel (sticky on desktop) ──── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className={`${CARD} flex flex-col gap-5`}>
            <h2 className="text-base font-semibold text-gray-800">Upload</h2>

            {/* Success state — before auto-redirect */}
            {uploadState.phase === 'success' && uploadState.uploadedNote && (
              <SuccessSummary
                title={uploadState.uploadedNote.title}
                subject={uploadState.uploadedNote.subject}
                fileSize={uploadState.uploadedNote.file_size}
                mimeType={uploadState.uploadedNote.mime_type}
                isPublished={uploadState.uploadedNote.is_published}
              />
            )}

            {/* Progress bar (uploading + success) */}
            <UploadProgressBar
              percent={uploadState.percent}
              phase={uploadState.phase}
            />

            {/* Upload server error */}
            {uploadState.phase === 'error' && uploadState.error && (
              <UploadValidationAlert uploadError={uploadState.error} />
            )}

            {/* Action buttons */}
            <UploadActions
              canSubmit={canSubmit}
              phase={uploadState.phase}
              onSaveDraft={() => submit(false)}
              onPublishNow={() => submit(true)}
              onCancel={cancel}
              onReset={reset}
              onViewNotes={() => navigate('/faculty/notes', { replace: true })}
            />

            {/* Checklist — shown only when idle and not yet ready */}
            {uploadState.phase === 'idle' && (
              <ReadyChecklist
                hasFile={selectedFile !== null && fileValidation.valid}
                hasTitle={form.title.trim() !== ''}
                hasSubject={form.subject.trim() !== ''}
                hasSection={form.section_id !== ''}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Sub-components ───────────────────────────────────────────────────────────

function SuccessSummary({
  title,
  subject,
  fileSize,
  mimeType,
  isPublished,
}: {
  title:       string;
  subject:     string;
  fileSize:    number;
  mimeType:    string;
  isPublished: boolean;
}): JSX.Element {
  const mime = getMimeConfig(mimeType);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-emerald-800">Note uploaded!</span>
      </div>
      <p className="mb-0.5 text-sm font-medium text-emerald-900 line-clamp-1">{title}</p>
      <p className="text-xs text-emerald-700">{subject}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mime.iconBg} ${mime.iconColor}`}>
          {mime.label}
        </span>
        <span>{formatBytes(fileSize)}</span>
        <span aria-hidden="true">·</span>
        <span>{isPublished ? 'Published' : 'Saved as draft'}</span>
      </div>
      <p className="mt-2 text-xs text-emerald-600">
        Redirecting to My Notes in 3 s…
      </p>
    </div>
  );
}


function ReadyChecklist({
  hasFile,
  hasTitle,
  hasSubject,
  hasSection,
}: {
  hasFile:    boolean;
  hasTitle:   boolean;
  hasSubject: boolean;
  hasSection: boolean;
}): JSX.Element {
  const items = [
    { label: 'Valid file selected',   done: hasFile    },
    { label: 'Title entered',         done: hasTitle   },
    { label: 'Subject entered',       done: hasSubject },
    { label: 'Section selected',      done: hasSection },
  ];

  const allDone = items.every(i => i.done);
  if (allDone) return <></>;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Checklist
      </p>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                item.done
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
              aria-hidden="true"
            >
              {item.done ? '✓' : '○'}
            </span>
            <span className={item.done ? 'text-emerald-700' : 'text-gray-500'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
