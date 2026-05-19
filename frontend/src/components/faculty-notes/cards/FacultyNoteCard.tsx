import { useEffect, useRef, useState } from 'react';
import { EyeOff, Globe, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import type { FacultyNoteItem } from '@/types/facultyNotes';
import { formatBytes, formatUploadDate, getMimeConfig } from '@/types/facultyNotes';

interface Props {
  note:            FacultyNoteItem;
  isActing:        boolean;
  onTogglePublish: () => void;
  onEdit:          () => void;
  onDeleteRequest: () => void;
}

export default function FacultyNoteCard({
  note,
  isActing,
  onTogglePublish,
  onEdit,
  onDeleteRequest,
}: Props): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef<HTMLDivElement>(null);
  const mime      = getMimeConfig(note.mime_type);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <article className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Top row: file-type badge + publish badge */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${mime.iconBg} ${mime.iconColor}`}
        >
          {mime.label}
        </span>

        {note.is_published ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <Globe className="h-3 w-3" aria-hidden="true" />
            Published
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            Draft
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-900">
        {note.title}
      </h3>

      {/* Subject */}
      <p className="mb-3 text-xs text-gray-500">{note.subject}</p>

      {/* Meta row */}
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
        <span>{formatBytes(note.file_size)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatUploadDate(note.uploaded_at)}</span>
      </div>

      {/* Action row */}
      <div className="mt-auto flex items-center gap-2">
        {/* Publish / Unpublish toggle */}
        <button
          onClick={onTogglePublish}
          disabled={isActing}
          aria-label={note.is_published ? 'Unpublish note' : 'Publish note'}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
            note.is_published
              ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400'
          }`}
        >
          {isActing ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
              aria-hidden="true"
            />
          ) : note.is_published ? (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {note.is_published ? 'Unpublish' : 'Publish'}
        </button>

        {/* More actions menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(m => !m)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="rounded-xl border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
            >
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit Metadata
              </button>
              <div className="my-1 border-t border-gray-100" aria-hidden="true" />
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); onDeleteRequest(); }}
                disabled={isActing}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 focus:outline-none focus-visible:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
