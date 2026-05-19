import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, PlusCircle, X } from 'lucide-react';
import type { JSX } from 'react';

import { useFacultyNotes } from '@/hooks/useFacultyNotes';
import type { FacultyNoteItem } from '@/types/facultyNotes';

import FacultyNotesStats         from '@/components/faculty-notes/cards/FacultyNotesStats';
import FacultyNoteCard           from '@/components/faculty-notes/cards/FacultyNoteCard';
import FacultyNotesFilterBar     from '@/components/faculty-notes/filters/FacultyNotesFilterBar';
import FacultyNotesTable         from '@/components/faculty-notes/table/FacultyNotesTable';
import FacultyNotesLoadingSkeleton from '@/components/faculty-notes/states/FacultyNotesLoadingSkeleton';
import FacultyNotesErrorState    from '@/components/faculty-notes/states/FacultyNotesErrorState';
import FacultyNotesEmptyState    from '@/components/faculty-notes/states/FacultyNotesEmptyState';
import DeleteNoteConfirmModal    from '@/components/faculty-notes/dialogs/DeleteNoteConfirmModal';

export default function FacultyNotesPage(): JSX.Element {
  const navigate = useNavigate();

  const {
    filteredNotes,
    stats,
    isLoading,
    isError,
    errorMessage,
    retry,
    filter,
    setFilter,
    clearFilters,
    actionNoteId,
    actionError,
    clearActionError,
    handleDelete,
    handleTogglePublish,
  } = useFacultyNotes();

  // ── Delete confirmation state ────────────────────────────────
  const [pendingDeleteNote, setPendingDeleteNote] = useState<FacultyNoteItem | null>(null);

  const onDeleteRequest = (note: FacultyNoteItem) => setPendingDeleteNote(note);
  const onDeleteCancel  = () => setPendingDeleteNote(null);
  const onDeleteConfirm = async () => {
    if (!pendingDeleteNote) return;
    await handleDelete(pendingDeleteNote.id);
    setPendingDeleteNote(null);
  };

  // ── Derived helpers ─────────────────────────────────────────
  const hasActiveFilters =
    filter.search !== '' ||
    filter.subject !== '' ||
    filter.fileType !== '' ||
    filter.publishState !== 'all';

  const isDeletingId = pendingDeleteNote?.id === actionNoteId ? actionNoteId : null;

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader onUpload={() => navigate('/faculty/notes/upload')} />
        <div className="mt-6">
          <FacultyNotesLoadingSkeleton />
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader onUpload={() => navigate('/faculty/notes/upload')} />
        <FacultyNotesErrorState message={errorMessage} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ── Page header ──────────────────────────────────────── */}
      <PageHeader onUpload={() => navigate('/faculty/notes/upload')} />

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className="mt-6">
        <FacultyNotesStats stats={stats} />
      </div>

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="mt-5">
        <FacultyNotesFilterBar
          filter={filter}
          stats={stats}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
        />
      </div>

      {/* ── Action error banner ───────────────────────────────── */}
      {actionError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">{actionError}</span>
          <button
            onClick={clearActionError}
            aria-label="Dismiss error"
            className="flex-shrink-0 text-rose-400 hover:text-rose-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="mt-5">
        {filteredNotes.length === 0 ? (
          <FacultyNotesEmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        ) : (
          <>
            {/* Desktop table — hidden below lg */}
            <div className="hidden lg:block">
              <FacultyNotesTable
                notes={filteredNotes}
                actionNoteId={actionNoteId}
                onTogglePublish={handleTogglePublish}
                onEdit={id => navigate(`/faculty/notes/${id}/edit`)}
                onDeleteRequest={onDeleteRequest}
              />
            </div>

            {/* Mobile / tablet card grid — hidden at lg and above */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
              {filteredNotes.map(note => (
                <FacultyNoteCard
                  key={note.id}
                  note={note}
                  isActing={actionNoteId === note.id}
                  onTogglePublish={() => handleTogglePublish(note.id, note.is_published)}
                  onEdit={() => navigate(`/faculty/notes/${note.id}/edit`)}
                  onDeleteRequest={() => onDeleteRequest(note)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Delete confirmation modal ─────────────────────────── */}
      {pendingDeleteNote && (
        <DeleteNoteConfirmModal
          note={pendingDeleteNote}
          isDeleting={isDeletingId === pendingDeleteNote.id}
          onConfirm={onDeleteConfirm}
          onCancel={onDeleteCancel}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ onUpload }: { onUpload: () => void }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Notes</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage and publish study materials for your students.
        </p>
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
      >
        <PlusCircle className="h-4 w-4" aria-hidden="true" />
        Upload Note
      </button>
    </div>
  );
}
