// ============================================================
// components/dashboard/widgets/NotesWidget.tsx
// ============================================================
// Shows: recently uploaded notes for the student's section.
// Each note shows: title, subject, file type icon, file size.
// Download button uses the /notes/{id}/download endpoint.
//
// WHY construct the download URL in the component?
//   The apiClient adds the Authorization header automatically.
//   Navigating window.location = download_url bypasses headers.
//   The correct pattern: fetch the file via Axios → create a
//   Blob URL → click a synthetic link → revoke the Blob URL.
//   This is the standard frontend file download pattern.
// ============================================================

import { useNavigate } from 'react-router-dom';
import { FileText, Download, File, AlertCircle, ArrowRight, BookOpen } from 'lucide-react';
import type { NoteItem } from '@/types/dashboard';
import apiClient from '@/api/client';
import { SkeletonRow } from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf'))   return { bg: 'bg-rose-50',    color: 'text-rose-600'  };
  if (mimeType.includes('word'))  return { bg: 'bg-blue-50',    color: 'text-blue-600'  };
  if (mimeType.includes('sheet')) return { bg: 'bg-emerald-50', color: 'text-emerald-600' };
  if (mimeType.includes('image')) return { bg: 'bg-purple-50',  color: 'text-purple-600' };
  return { bg: 'bg-gray-50', color: 'text-gray-500' };
}

async function downloadNote(noteId: number, filename: string) {
  try {
    const res = await apiClient.get(`/notes/${noteId}/download`, {
      responseType: 'blob',
    });
    const url  = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    console.error('Download failed');
  }
}

function NoteRow({ note }: { note: NoteItem }): JSX.Element {
  const fileStyle = getFileIcon(note.mime_type);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${fileStyle.bg}`}>
        <File className={`h-4 w-4 ${fileStyle.color}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{note.title}</p>
        <p className="text-xs text-gray-500">{note.subject} · {formatBytes(note.file_size)}</p>
      </div>

      <button
        onClick={() => void downloadNote(note.id, note.original_file_name)}
        className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}

interface NotesWidgetProps {
  data:      NoteItem[] | undefined;
  isLoading: boolean;
  error:     string | undefined;
}

export default function NotesWidget({ data, isLoading, error }: NotesWidgetProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Recent Notes</h3>
        </div>
        {data && data.length > 0 && (
          <span className="text-xs text-gray-400">{data.length} files</span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <SkeletonRow count={4} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-xs text-gray-400">Notes unavailable</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No notes yet</p>
            <p className="text-xs text-gray-400">Notes from your faculty will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map(note => (
              <NoteRow key={note.id} note={note} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/student/notes')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View all notes <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
