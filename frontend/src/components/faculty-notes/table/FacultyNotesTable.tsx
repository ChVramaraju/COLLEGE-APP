import { useEffect, useRef, useState } from 'react';
import { EyeOff, Globe, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import type { FacultyNoteItem } from '@/types/facultyNotes';
import { formatBytes, formatUploadDate, getMimeConfig } from '@/types/facultyNotes';

// ── Table-level props ────────────────────────────────────────────────────────

interface Props {
  notes:           FacultyNoteItem[];
  actionNoteId:    number | null;
  onTogglePublish: (noteId: number, currentState: boolean) => void;
  onEdit:          (noteId: number) => void;
  onDeleteRequest: (note: FacultyNoteItem) => void;
}

// ── Column header ────────────────────────────────────────────────────────────

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }): JSX.Element {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${className}`}
    >
      {children}
    </th>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  note:            FacultyNoteItem;
  isActing:        boolean;
  onTogglePublish: () => void;
  onEdit:          () => void;
  onDeleteRequest: () => void;
}

function NoteRow({ note, isActing, onTogglePublish, onEdit, onDeleteRequest }: RowProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mime    = getMimeConfig(note.mime_type);

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
    <tr className="group transition-colors hover:bg-gray-50">
      {/* Title + filename */}
      <td className="max-w-xs px-4 py-4">
        <p className="truncate text-sm font-medium text-gray-900">{note.title}</p>
        <p className="truncate text-xs text-gray-400">{note.original_file_name}</p>
      </td>

      {/* Subject */}
      <td className="px-4 py-4">
        <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {note.subject}
        </span>
      </td>

      {/* File type badge */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${mime.iconBg} ${mime.iconColor}`}
        >
          {mime.label}
        </span>
      </td>

      {/* Publish status */}
      <td className="px-4 py-4">
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
      </td>

      {/* File size */}
      <td className="px-4 py-4 text-xs text-gray-500">
        {formatBytes(note.file_size)}
      </td>

      {/* Upload date */}
      <td className="px-4 py-4 text-xs text-gray-500">
        {formatUploadDate(note.uploaded_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {/* Inline publish toggle */}
          <button
            onClick={onTogglePublish}
            disabled={isActing}
            aria-label={note.is_published ? 'Unpublish note' : 'Publish note'}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
              note.is_published
                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 focus-visible:ring-amber-400'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400'
            }`}
          >
            {isActing ? (
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-current/30 border-t-current"
                aria-hidden="true"
              />
            ) : note.is_published ? (
              <EyeOff className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Globe className="h-3 w-3" aria-hidden="true" />
            )}
            {note.is_published ? 'Unpublish' : 'Publish'}
          </button>

          {/* More menu */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(m => !m)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
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
      </td>
    </tr>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export default function FacultyNotesTable({
  notes,
  actionNoteId,
  onTogglePublish,
  onEdit,
  onDeleteRequest,
}: Props): JSX.Element {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse" aria-label="Faculty notes">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <Th className="w-72">Note</Th>
              <Th>Subject</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>Size</Th>
              <Th>Uploaded</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {notes.map(note => (
              <NoteRow
                key={note.id}
                note={note}
                isActing={actionNoteId === note.id}
                onTogglePublish={() => onTogglePublish(note.id, note.is_published)}
                onEdit={() => onEdit(note.id)}
                onDeleteRequest={() => onDeleteRequest(note)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Row count footer */}
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-2.5">
        <p className="text-xs text-gray-400">
          Showing {notes.length} note{notes.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
