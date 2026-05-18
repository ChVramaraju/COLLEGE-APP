// ============================================================
// pages/student/NotesPage.tsx — Notes Document Portal
// ============================================================
// Composition root for the student notes module.
//
// This page calls useNotes() ONCE and distributes:
//   - stats → NotesStatsPanel
//   - filteredNotes → NoteCard grid
//   - filters → NotesFilterBar
//   - preview state → NotePreviewModal (portal-rendered)
//
// PAGE LAYOUT:
//   Header
//   NotesStatsPanel      ← 4 stat boxes
//   NotesFilterBar       ← search + subject + file type
//   NoteCard grid        ← responsive 1→2→3 column grid
//   NotePreviewModal     ← full-screen overlay (conditional)
// ============================================================

import type { JSX } from 'react';
import { BookOpen, AlertCircle, RefreshCw } from 'lucide-react';
import { useNotes } from '@/hooks/useNotes';

import NotesStatsPanel   from '@/components/notes/cards/NotesStatsPanel';
import NoteCard          from '@/components/notes/cards/NoteCard';
import NotesFilterBar    from '@/components/notes/filters/NotesFilterBar';
import NotePreviewModal  from '@/components/notes/preview/NotePreviewModal';

// ---------------------------------------------------------------
// SKELETON GRID — shown while notes are loading
// ---------------------------------------------------------------
function NoteCardSkeleton(): JSX.Element {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-gray-200" />
        <div className="h-5 w-12 rounded-full bg-gray-200" />
      </div>
      <div className="mb-2 h-4 w-4/5 rounded bg-gray-200" />
      <div className="mb-3 h-3 w-2/3 rounded bg-gray-200" />
      <div className="mb-3 h-5 w-16 rounded-full bg-gray-200" />
      <div className="flex gap-2 border-t border-gray-100 pt-3">
        <div className="h-7 flex-1 rounded-lg bg-gray-200" />
        <div className="h-7 flex-1 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

export default function NotesPage(): JSX.Element {
  const {
    filteredNotes,
    allSubjects,
    stats,
    isLoading,
    error,
    filters,
    setFilter,
    resetFilters,
    downloadingIds,
    downloadError,
    handleDownload,
    previewNote,
    previewBlobUrl,
    isLoadingPreview,
    previewError,
    openPreview,
    closePreview,
    notes,
    refetch,
  } = useNotes();

  return (
    <div className="space-y-5 pb-8">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-600" />
            <h1 className="text-xl font-bold text-gray-900">Study Notes</h1>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            Access, search, and download notes uploaded by your faculty
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── Download error toast ── */}
      {downloadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{downloadError}</p>
        </div>
      )}

      {/* ── Stats Panel ── */}
      <NotesStatsPanel stats={stats} isLoading={isLoading} />

      {/* ── Filter Bar ── */}
      <NotesFilterBar
        filters={filters}
        allSubjects={allSubjects}
        totalNotes={notes.length}
        totalFiltered={filteredNotes.length}
        setFilter={setFilter}
        resetFilters={resetFilters}
      />

      {/* ── Notes Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <NoteCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="text-sm font-medium text-red-600">Failed to load notes</p>
          <p className="mt-1 text-xs text-gray-500">{error}</p>
          <button
            onClick={refetch}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-gray-200" />
          {notes.length === 0 ? (
            <>
              <p className="text-sm font-medium text-gray-500">No notes uploaded yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Your faculty will upload notes here for your section
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-500">No notes match your filters</p>
              <button
                onClick={resetFilters}
                className="mt-3 rounded-lg bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                isDownloading={downloadingIds.has(note.id)}
                onDownload={handleDownload}
                onPreview={openPreview}
              />
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">
            Showing {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}
          </p>
        </>
      )}

      {/* ── Preview Modal (conditional full-screen overlay) ── */}
      <NotePreviewModal
        note={previewNote}
        blobUrl={previewBlobUrl}
        isLoading={isLoadingPreview}
        error={previewError}
        onClose={closePreview}
        onDownload={handleDownload}
        isDownloading={previewNote ? downloadingIds.has(previewNote.id) : false}
      />
    </div>
  );
}
