// ============================================================
// components/notes/cards/NoteCard.tsx — Individual Note Card
// ============================================================
// Renders ONE note in the grid. The most reused component
// in the notes module.
//
// CARD ANATOMY:
//   ┌──────────────────────────────────┐
//   │  [File Icon]   [Type Badge]      │  ← MIME-driven
//   │  Title (truncated)               │
//   │  Subject badge                   │
//   │  ─────────────────────────────   │
//   │  📅 Jan 2025   📦 1.2 MB         │
//   │  ─────────────────────────────   │
//   │  [👁 Preview]    [↓ Download]    │  ← action row
//   └──────────────────────────────────┘
//
// THREE STATES for the Download button:
//   1. Default: shows Download icon + "Download" text
//   2. Loading: shows spinner + "Downloading..." text
//   3. Done: immediately returns to Default (download starts in bg)
//
// The Preview button is conditionally disabled for MIME types
// that the browser cannot render (e.g., .docx, .xlsx).
// Disabled state shows tooltip: "Preview not available for this file type"
// ============================================================

import { Eye, Download, Loader2, File, EyeOff } from 'lucide-react';
import type { NoteItem } from '@/types/notes';
import { getMimeConfig, formatBytes, formatUploadDate } from '@/types/notes';
import type { JSX } from 'react';

interface NoteCardProps {
  note:           NoteItem;
  isDownloading:  boolean;
  onDownload:     (note: NoteItem) => void;
  onPreview:      (note: NoteItem) => void;
}

export default function NoteCard({
  note,
  isDownloading,
  onDownload,
  onPreview,
}: NoteCardProps): JSX.Element {
  const mime = getMimeConfig(note.mime_type);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
      {/* ── TOP SECTION: icon + type badge ── */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${mime.iconBg}`}>
          <File className={`h-5 w-5 ${mime.iconColor}`} />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${mime.iconBg} ${mime.iconColor}`}>
          {mime.label}
        </span>
      </div>

      {/* ── MIDDLE SECTION: title + subject ── */}
      <div className="flex-1 px-4 pb-3">
        <h3
          className="mb-1.5 text-sm font-semibold text-gray-900 line-clamp-2 leading-snug"
          title={note.title}
        >
          {note.title}
        </h3>
        <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
          {note.subject}
        </span>
        {note.description && (
          <p className="mt-1.5 text-xs text-gray-400 line-clamp-2">{note.description}</p>
        )}
      </div>

      {/* ── META STRIP: date + size ── */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
        <span className="text-xs text-gray-400">{formatUploadDate(note.uploaded_at)}</span>
        <span className="text-xs font-medium text-gray-500">{formatBytes(note.file_size)}</span>
      </div>

      {/* ── ACTION ROW: preview + download ── */}
      <div className="flex gap-2 border-t border-gray-100 p-3">
        {/* Preview button */}
        <button
          onClick={() => onPreview(note)}
          disabled={!mime.canPreview}
          title={mime.canPreview ? 'Preview' : 'Preview not available for this file type'}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            mime.canPreview
              ? 'bg-gray-50 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
              : 'cursor-not-allowed bg-gray-50 text-gray-300'
          }`}
        >
          {mime.canPreview
            ? <Eye className="h-3.5 w-3.5" />
            : <EyeOff className="h-3.5 w-3.5" />
          }
          Preview
        </button>

        {/* Download button */}
        <button
          onClick={() => !isDownloading && onDownload(note)}
          disabled={isDownloading}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
            isDownloading
              ? 'cursor-wait bg-indigo-50 text-indigo-400'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isDownloading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Downloading…</>
            : <><Download className="h-3.5 w-3.5" />Download</>
          }
        </button>
      </div>
    </div>
  );
}
