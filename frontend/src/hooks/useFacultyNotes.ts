// ============================================================
// hooks/useFacultyNotes.ts — Faculty Notes Dashboard State
// ============================================================
//
// RESPONSIBILITIES
// ─────────────────
// 1. Fetch all faculty notes from GET /faculty/notes (once, on mount)
// 2. Derive computed stats (total, published, drafts, unique subjects)
// 3. Manage client-side filters (search, subject, fileType, publishState)
// 4. Handle CRUD actions with OPTIMISTIC UPDATES:
//      - delete:          remove from local state, rollback on error
//      - publish/unpublish: toggle local state, rollback on error
// 5. Expose retry() for re-fetching after network errors
//
// WHAT THIS HOOK DOES NOT OWN
// ────────────────────────────
// Upload state → managed by the upload form component (or useUploadNote hook
// built in Phase 4). This separation keeps this hook focused on the LIST view.
// Edit/replace state → managed by the edit page component.
//
// OPTIMISTIC UPDATE PATTERN
// ─────────────────────────
// Instead of re-fetching after every mutation (slow), we:
//   1. Capture the current notes array as a "snapshot"
//   2. Apply the change to local state immediately
//   3. Send the API request in the background
//   4. On error: restore the snapshot and surface the error
//
// This gives instant UI response with rollback safety.
//
// FILTER ARCHITECTURE
// ───────────────────
// All filtering is client-side (notes fetched all at once, limit=200).
// filteredNotes is a useMemo — O(n) per keystroke, where n ≤ 200.
// For larger datasets (> 1000 notes), move filters to query params in Phase 6.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FacultyNoteItem, FacultyNotesFilters, FacultyNotesStats } from '@/types/facultyNotes';
import { DEFAULT_FACULTY_NOTES_FILTERS }                                  from '@/types/facultyNotes';
import { getMimeConfig }                                                   from '@/types/notes';
import {
  getFacultyNotes,
  toggleNotePublish,
  deleteNote,
} from '@/services/facultyNotesService';


// ============================================================
// PUBLIC INTERFACE
// ============================================================

export interface UseFacultyNotesReturn {
  // ── Data ──────────────────────────────────────────────────
  notes:         FacultyNoteItem[];          // raw unfiltered list from API
  filteredNotes: FacultyNoteItem[];          // after applying all active filters
  stats:         FacultyNotesStats;          // derived from `notes` (not filtered)

  // ── Fetch state ───────────────────────────────────────────
  isLoading:    boolean;
  isError:      boolean;
  errorMessage: string | null;
  retry:        () => void;

  // ── Filter state ──────────────────────────────────────────
  filter:    FacultyNotesFilters;
  setFilter: (partial: Partial<FacultyNotesFilters>) => void;
  clearFilters: () => void;

  // ── Action state ──────────────────────────────────────────
  // Which note ID is currently being acted on (delete / publish toggle).
  // Used to show a loading indicator on the specific row/card.
  actionNoteId:    number | null;
  actionError:     string | null;
  clearActionError: () => void;

  // ── Actions ───────────────────────────────────────────────
  handleDelete:        (noteId: number) => Promise<void>;
  handleTogglePublish: (noteId: number, currentState: boolean) => Promise<void>;

  // ── Optimistic insert (called after successful upload from other component) ──
  // Allows the upload page/modal to push a new note into this hook's state
  // without triggering a full refetch.
  addNoteToList: (note: FacultyNoteItem) => void;
}


// ============================================================
// HOOK IMPLEMENTATION
// ============================================================

export function useFacultyNotes(): UseFacultyNotesReturn {

  // ── Raw server data ───────────────────────────────────────
  const [notes,       setNotes]       = useState<FacultyNoteItem[]>([]);

  // ── Fetch lifecycle ───────────────────────────────────────
  const [isLoading,    setIsLoading]    = useState(true);
  const [isError,      setIsError]      = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fetchKey,     setFetchKey]     = useState(0);   // increment to refetch

  // ── Filter state ──────────────────────────────────────────
  const [filter, setFilterState] = useState<FacultyNotesFilters>(
    DEFAULT_FACULTY_NOTES_FILTERS,
  );

  // ── Action state ──────────────────────────────────────────
  const [actionNoteId, setActionNoteId] = useState<number | null>(null);
  const [actionError,  setActionError]  = useState<string | null>(null);


  // ── Data fetch ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    getFacultyNotes({ limit: 200, skip: 0 })
      .then(data => { if (!cancelled) setNotes(data); })
      .catch(err  => {
        if (!cancelled) {
          setIsError(true);
          setErrorMessage(
            err instanceof Error ? err.message : 'Failed to load notes.',
          );
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [fetchKey]);


  // ── Derived stats (from raw unfiltered list) ──────────────
  // Computed once per notes change — not per filter change.
  const stats = useMemo<FacultyNotesStats>(() => {
    const published = notes.filter(n => n.is_published).length;
    const subjects  = Array.from(new Set(notes.map(n => n.subject))).sort();
    const totalSize = notes.reduce((sum, n) => sum + n.file_size, 0);
    return {
      total:          notes.length,
      published,
      drafts:         notes.length - published,
      totalSizeBytes: totalSize,
      subjects,
    };
  }, [notes]);


  // ── Client-side filter ────────────────────────────────────
  const filteredNotes = useMemo<FacultyNoteItem[]>(() => {
    let result = notes;

    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.subject.toLowerCase().includes(q),
      );
    }

    if (filter.subject) {
      result = result.filter(n => n.subject === filter.subject);
    }

    if (filter.fileType) {
      result = result.filter(
        n => getMimeConfig(n.mime_type).group === filter.fileType,
      );
    }

    if (filter.publishState !== 'all') {
      const wantPublished = filter.publishState === 'published';
      result = result.filter(n => n.is_published === wantPublished);
    }

    return result;
  }, [notes, filter]);


  // ── Filter setters ────────────────────────────────────────
  const setFilter = useCallback(
    (partial: Partial<FacultyNotesFilters>) => {
      setFilterState(prev => ({ ...prev, ...partial }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_FACULTY_NOTES_FILTERS);
  }, []);


  // ── handleDelete (optimistic) ─────────────────────────────
  const handleDelete = useCallback(async (noteId: number) => {
    setActionNoteId(noteId);
    setActionError(null);

    // Snapshot for rollback
    const snapshot = notes;

    // Optimistic: remove from list immediately
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      await deleteNote(noteId);
    } catch (err) {
      // Rollback: restore the snapshot
      setNotes(snapshot);
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete note.',
      );
    } finally {
      setActionNoteId(null);
    }
  }, [notes]);


  // ── handleTogglePublish (optimistic) ──────────────────────
  const handleTogglePublish = useCallback(
    async (noteId: number, currentIsPublished: boolean) => {
      setActionNoteId(noteId);
      setActionError(null);

      const snapshot = notes;

      // Optimistic: flip the flag locally
      setNotes(prev =>
        prev.map(n =>
          n.id === noteId ? { ...n, is_published: !currentIsPublished } : n,
        ),
      );

      try {
        const updated = await toggleNotePublish(noteId, {
          is_published: !currentIsPublished,
        });
        // Reconcile: replace optimistic item with server-confirmed item
        setNotes(prev => prev.map(n => (n.id === noteId ? updated : n)));
      } catch (err) {
        setNotes(snapshot);
        setActionError(
          err instanceof Error
            ? err.message
            : `Failed to ${currentIsPublished ? 'unpublish' : 'publish'} note.`,
        );
      } finally {
        setActionNoteId(null);
      }
    },
    [notes],
  );


  // ── addNoteToList (called by upload form on success) ──────
  // Prepends the new note to the list so it appears at the top
  // without a refetch. Upload page uses this after a successful POST.
  const addNoteToList = useCallback((note: FacultyNoteItem) => {
    setNotes(prev => [note, ...prev]);
  }, []);


  const retry = useCallback(() => setFetchKey(k => k + 1), []);
  const clearActionError = useCallback(() => setActionError(null), []);


  return {
    notes,
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
    addNoteToList,
  };
}
