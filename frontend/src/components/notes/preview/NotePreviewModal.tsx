// ============================================================
// components/notes/preview/NotePreviewModal.tsx
// ============================================================
// Full-screen modal for previewing a note file in-browser.
//
// THE PREVIEW RENDERING STRATEGY:
//
//   PDF → <iframe src={blobUrl} />
//     Chrome and Firefox have built-in PDF renderers.
//     When you point an iframe at a blob URL with MIME type
//     "application/pdf", the browser renders it directly.
//     No PDF library needed.
//
//   Image → <img src={blobUrl} />
//     All browsers render images natively.
//     No library needed.
//
//   Unsupported → Download prompt
//     For .docx, .xlsx, etc., browser can't render inline.
//     Show a helpful message + download button instead.
//     Never show a blank white space — always explain WHY.
//
// MODAL BEHAVIOUR:
//   - Overlay: fixed full-screen dark background
//   - Click outside modal → close (standard UX expectation)
//   - ESC key → close (keyboard accessibility)
//   - Close button (×) in top-right corner
//   - Loading spinner while blob is fetching
//
// MEMORY MANAGEMENT:
//   This component does NOT manage the blob URL.
//   The HOOK creates and revokes it.
//   This component just renders what the hook gives it.
//   → Clean separation of concern.
// ============================================================

import { useEffect } from 'react';
import { X, Download, Loader2, AlertCircle, FileX } from 'lucide-react';
import type { NoteItem } from '@/types/notes';
import { getMimeConfig, formatBytes } from '@/types/notes';
import type { JSX } from 'react';

interface NotePreviewModalProps {
  note:           NoteItem | null;
  blobUrl:        string | null;
  isLoading:      boolean;
  error:          string | null;
  onClose:        () => void;
  onDownload:     (note: NoteItem) => void;
  isDownloading:  boolean;
}

export default function NotePreviewModal({
  note,
  blobUrl,
  isLoading,
  error,
  onClose,
  onDownload,
  isDownloading,
}: NotePreviewModalProps): JSX.Element | null {
  // Mount guard: don't render if no note selected
  if (!note) return null;

  const mime = getMimeConfig(note.mime_type);

  // ESC key to close
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal container — stops propagation so clicks inside don't close */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${mime.iconBg}`}>
            <span className={`text-xs font-bold ${mime.iconColor}`}>{mime.label}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-gray-900">{note.title}</h3>
            <p className="text-xs text-gray-500">{note.subject} · {formatBytes(note.file_size)}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Download from modal */}
            <button
              onClick={() => onDownload(note)}
              disabled={isDownloading}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {isDownloading
                ? <><Loader2 className="h-3 w-3 animate-spin" />Downloading…</>
                : <><Download className="h-3 w-3" />Download</>
              }
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Modal Body: preview area ── */}
        <div className="relative flex-1 overflow-hidden rounded-b-2xl bg-gray-50">
          {/* Loading state */}
          {isLoading && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-500">Loading preview…</p>
              <p className="text-xs text-gray-400">Fetching {formatBytes(note.file_size)} securely</p>
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center p-8">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm font-medium text-red-600">Preview failed</p>
              <p className="text-xs text-gray-500">{error}</p>
              <button
                onClick={() => onDownload(note)}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-4 w-4" /> Download Instead
              </button>
            </div>
          )}

          {/* PDF Preview */}
          {!isLoading && !error && blobUrl && note.mime_type === 'application/pdf' && (
            <iframe
              src={blobUrl}
              title={note.title}
              className="h-[70vh] w-full rounded-b-2xl border-0"
            />
          )}

          {/* Image Preview */}
          {!isLoading && !error && blobUrl && note.mime_type.startsWith('image/') && (
            <div className="flex h-[70vh] items-center justify-center overflow-auto p-4">
              <img
                src={blobUrl}
                alt={note.title}
                className="max-h-full max-w-full rounded-lg object-contain shadow-md"
              />
            </div>
          )}

          {/* Text Preview */}
          {!isLoading && !error && blobUrl && note.mime_type === 'text/plain' && (
            <iframe
              src={blobUrl}
              title={note.title}
              className="h-[70vh] w-full rounded-b-2xl border-0 bg-white p-4 font-mono text-sm"
            />
          )}

          {/* Unsupported format */}
          {!isLoading && !error && blobUrl && !mime.canPreview && (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center p-8">
              <FileX className="h-12 w-12 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Preview not available</p>
              <p className="text-xs text-gray-400 max-w-xs">
                {mime.label} files cannot be previewed in the browser.
                Download the file to view it in the appropriate app.
              </p>
              <button
                onClick={() => onDownload(note)}
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-4 w-4" /> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
