// ============================================================
// hooks/useNotes.ts — Notes Data & Interaction Orchestration
// ============================================================
// This hook manages FOUR independent state domains:
//
//  1. FETCH STATE    — notes list from API
//  2. FILTER STATE   — search/subject/fileType from user
//  3. DOWNLOAD STATE — which notes are currently downloading
//  4. PREVIEW STATE  — which note is being previewed + its blob URL
//
// SEQUENCED FETCH (two API calls in order):
//   Step 1: GET /students/me → section_id
//   Step 2: GET /notes/section/{id} → NoteItem[]
//
//   Unlike useDashboard which uses Promise.allSettled (parallel),
//   here we MUST sequence: you can't fetch notes without knowing
//   the section_id first. This is a WATERFALL fetch — step 2
//   depends on the result of step 1.
//
// PREVIEW MEMORY MANAGEMENT:
//   When a user opens a preview, we create a Blob URL.
//   When they close it, we MUST revoke that URL.
//   The hook manages this lifecycle in closePreview().
//   Missing this would leak memory on every preview open.
//
// DOWNLOAD STATE (Set<number>):
//   Tracks which notes are currently being downloaded.
//   Allows multiple concurrent downloads with independent
//   loading indicators per note card.
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { NoteItem, NotesFilters, FileTypeGroup } from '@/types/notes';
import { DEFAULT_NOTES_FILTERS, getMimeConfig } from '@/types/notes';
import {
  getStudentSectionId,
  getSectionNotes,
  downloadNoteFile,
  fetchNoteBlob,
} from '@/services/notesService';

// ---------------------------------------------------------------
// DERIVED STAT TYPES (computed from notes list)
// ---------------------------------------------------------------
export interface NotesStats {
  total:        number;
  subjects:     string[];            // unique subject names
  pdfCount:     number;
  imageCount:   number;
  docCount:     number;
  latestNote:   NoteItem | null;
}

// ---------------------------------------------------------------
// HOOK RETURN TYPE
// ---------------------------------------------------------------
export interface UseNotesReturn {
  // Raw + filtered data
  notes:          NoteItem[];
  filteredNotes:  NoteItem[];
  allSubjects:    string[];
  stats:          NotesStats;

  // Loading / error
  isLoading:      boolean;
  error:          string | null;
  sectionId:      number | null;

  // Filters
  filters:        NotesFilters;
  setFilter:      <K extends keyof NotesFilters>(key: K, value: NotesFilters[K]) => void;
  resetFilters:   () => void;

  // Download
  downloadingIds: Set<number>;
  downloadError:  string | null;
  handleDownload: (note: NoteItem) => void;

  // Preview
  previewNote:     NoteItem | null;
  previewBlobUrl:  string | null;
  isLoadingPreview: boolean;
  previewError:    string | null;
  openPreview:     (note: NoteItem) => void;
  closePreview:    () => void;

  // Actions
  refetch: () => void;
}

// ---------------------------------------------------------------
// PURE UTILITY: compute stats from notes array
// ---------------------------------------------------------------
function computeStats(notes: NoteItem[]): NotesStats {
  const subjects = [...new Set(notes.map(n => n.subject))].sort();
  let pdfs = 0, images = 0, docs = 0;
  for (const n of notes) {
    const g = getMimeConfig(n.mime_type).group;
    if (g === 'pdf')   pdfs++;
    else if (g === 'image') images++;
    else if (g === 'document') docs++;
  }
  const sorted = [...notes].sort((a, b) =>
    (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''),
  );
  return {
    total:      notes.length,
    subjects,
    pdfCount:   pdfs,
    imageCount: images,
    docCount:   docs,
    latestNote: sorted[0] ?? null,
  };
}

// ---------------------------------------------------------------
// THE HOOK
// ---------------------------------------------------------------
export function useNotes(): UseNotesReturn {
  // -----------------------------------------------------------
  // FETCH STATE
  // -----------------------------------------------------------
  const [notes,     setNotes]     = useState<NoteItem[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // -----------------------------------------------------------
  // FILTER STATE
  // -----------------------------------------------------------
  const [filters, setFilters] = useState<NotesFilters>(DEFAULT_NOTES_FILTERS);

  // -----------------------------------------------------------
  // DOWNLOAD STATE
  // -----------------------------------------------------------
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  const [downloadError,  setDownloadError]  = useState<string | null>(null);

  // -----------------------------------------------------------
  // PREVIEW STATE
  // -----------------------------------------------------------
  const [previewNote,      setPreviewNote]      = useState<NoteItem | null>(null);
  const [previewBlobUrl,   setPreviewBlobUrl]   = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError,     setPreviewError]     = useState<string | null>(null);

  // -----------------------------------------------------------
  // SEQUENCED FETCH: section_id → notes
  // -----------------------------------------------------------
  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const id = await getStudentSectionId();
      setSectionId(id);

      if (!id) {
        setError('No section assigned. Please contact admin.');
        setNotes([]);
        return;
      }

      const data = await getSectionNotes(id);
      // Only show active notes
      setNotes(data.filter(n => n.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNotes(); }, [fetchNotes]);

  // -----------------------------------------------------------
  // CLIENT-SIDE FILTERING
  // Runs in <1ms for typical note counts (≤100)
  // -----------------------------------------------------------
  const filteredNotes = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return notes.filter(n => {
      // Search: title OR subject
      if (q && !n.title.toLowerCase().includes(q) && !n.subject.toLowerCase().includes(q)) {
        return false;
      }
      // Subject filter
      if (filters.subject && n.subject !== filters.subject) return false;
      // File type filter
      if (filters.fileType) {
        const group = getMimeConfig(n.mime_type).group;
        if (group !== (filters.fileType as FileTypeGroup)) return false;
      }
      return true;
    });
  }, [notes, filters]);

  // Unique subject names (for dropdown)
  const allSubjects = useMemo(
    () => [...new Set(notes.map(n => n.subject))].sort(),
    [notes],
  );

  // Stats (memoized — only recompute when full notes list changes)
  const stats = useMemo(() => computeStats(notes), [notes]);

  // -----------------------------------------------------------
  // FILTER HELPERS
  // -----------------------------------------------------------
  const setFilter = useCallback(<K extends keyof NotesFilters>(
    key: K,
    value: NotesFilters[K],
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_NOTES_FILTERS);
  }, []);

  // -----------------------------------------------------------
  // DOWNLOAD HANDLER
  // Per-note loading state using Set<number>
  // -----------------------------------------------------------
  const handleDownload = useCallback((note: NoteItem) => {
    setDownloadError(null);
    setDownloadingIds(prev => new Set(prev).add(note.id));

    void downloadNoteFile(note.id, note.original_file_name)
      .catch(err => {
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
      })
      .finally(() => {
        setDownloadingIds(prev => {
          const next = new Set(prev);
          next.delete(note.id);
          return next;
        });
      });
  }, []);

  // -----------------------------------------------------------
  // PREVIEW HANDLERS
  // openPreview: fetch blob → create URL → show modal
  // closePreview: revoke URL → clear state
  // -----------------------------------------------------------
  const openPreview = useCallback((note: NoteItem) => {
    setPreviewNote(note);
    setPreviewBlobUrl(null);
    setPreviewError(null);
    setIsLoadingPreview(true);

    void fetchNoteBlob(note.id)
      .then(({ blobUrl }) => {
        setPreviewBlobUrl(blobUrl);
      })
      .catch(err => {
        setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      })
      .finally(() => {
        setIsLoadingPreview(false);
      });
  }, []);

  const closePreview = useCallback(() => {
    // ALWAYS revoke before clearing — prevents memory leak
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewNote(null);
    setPreviewBlobUrl(null);
    setPreviewError(null);
    setIsLoadingPreview(false);
  }, [previewBlobUrl]);

  return {
    notes,
    filteredNotes,
    allSubjects,
    stats,
    isLoading,
    error,
    sectionId,
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
    refetch: fetchNotes,
  };
}
