// ============================================================
// services/facultyNotesService.ts — Faculty Notes API Layer
// ============================================================
//
// TRANSPORT DECISION MATRIX:
// ─────────────────────────────────────────────────────────────
//  Operation              Transport    Reason
//  ─────────────────────  ───────────  ────────────────────────
//  List faculty notes     Axios        JSON response
//  Upload note (POST)     Axios        FormData + onUploadProgress
//  Update metadata (PATCH) Axios       JSON body
//  Publish/unpublish      Axios        JSON body
//  Delete note            Axios        JSON response
//  Replace file (PUT)     Axios        FormData + onUploadProgress
//  Download/preview       native fetch Binary — same as student module
//
// WHY Axios for uploads but native fetch for downloads?
//   Uploads: Axios uses XHR under the hood, which exposes the
//   `progress` event → we get real byte-level upload progress.
//   Native fetch has NO upload progress API in the current standard.
//
//   Downloads: Axios's response pipeline can corrupt binary data through
//   its transformResponse chain. native fetch().blob() reads raw bytes
//   at the browser C++ layer — zero JavaScript encoding risk.
//   (See notesService.ts for the full explanation.)
//
// IMPORTANT: This file is completely separate from notesService.ts.
//   notesService.ts = student operations (read-only, section-scoped)
//   facultyNotesService.ts = faculty operations (full CRUD, ownership-scoped)
//   No shared functions — any utility reuse goes through types/facultyNotes.ts
//   or utils/fileValidation.ts.
// ============================================================

import apiClient from '@/api/client';
import type { AxiosProgressEvent } from 'axios';
import { STORAGE_KEYS } from '@/utils/constants';
import type {
  FacultyNoteItem,
  FacultyNotesQueryParams,
  UpdateNotePayload,
  PublishStatePayload,
} from '@/types/facultyNotes';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';


// ============================================================
// SECTION 1: READ OPERATIONS
// ============================================================

// ── GET /faculty/notes ────────────────────────────────────────
// Returns ALL notes uploaded by the logged-in faculty member,
// including unpublished drafts. Students never call this route.
//
// Backend filters via Query() params so the server-side query is
// efficient. Client-side filtering in the hook handles derived
// display state (stats, search, fileType group).
export async function getFacultyNotes(
  params: FacultyNotesQueryParams = {},
): Promise<FacultyNoteItem[]> {
  const res = await apiClient.get<FacultyNoteItem[]>('/faculty/notes', { params });
  return res.data;
}


// ============================================================
// SECTION 2: WRITE OPERATIONS (JSON)
// ============================================================

// ── PATCH /notes/{id} ─────────────────────────────────────────
// Updates only metadata: title, description, subject.
// File is immutable — use replaceNoteFile() for file changes.
export async function updateNoteMeta(
  noteId:  number,
  payload: UpdateNotePayload,
): Promise<FacultyNoteItem> {
  const res = await apiClient.patch<FacultyNoteItem>(`/notes/${noteId}`, payload);
  return res.data;
}

// ── PATCH /notes/{id}/publish ─────────────────────────────────
// Toggles the is_published flag.
// { is_published: true }  → note becomes visible to students
// { is_published: false } → note is hidden from students (draft)
export async function toggleNotePublish(
  noteId:  number,
  payload: PublishStatePayload,
): Promise<FacultyNoteItem> {
  const res = await apiClient.patch<FacultyNoteItem>(
    `/notes/${noteId}/publish`,
    payload,
  );
  return res.data;
}

// ── DELETE /notes/{id} ────────────────────────────────────────
// Soft-deactivates the DB record AND deletes the file from disk.
// Returns the backend's confirmation message.
export async function deleteNote(
  noteId: number,
): Promise<{ message: string; note_id: number }> {
  const res = await apiClient.delete<{ message: string; note_id: number }>(
    `/notes/${noteId}`,
  );
  return res.data;
}


// ============================================================
// SECTION 3: FILE UPLOAD OPERATIONS (multipart/form-data)
// ============================================================

// Progress callback type — receives 0–100 integer percentage.
export type UploadProgressCallback = (percent: number) => void;

// ── POST /notes/upload ────────────────────────────────────────
// Uploads a new note file with metadata.
// `auto_publish` controls whether the note is immediately visible.
//
// FormData field mapping (must match FastAPI Form() parameters exactly):
//   title         → Form(...)
//   subject       → Form(...)
//   section_id    → Form(...)
//   description   → Form(None) optional
//   auto_publish  → Form(False) controls is_published on creation
//   file          → File(...)
export async function uploadNote(
  params: {
    title:        string;
    subject:      string;
    section_id:   number;
    description?: string;
    auto_publish: boolean;
    file:         File;
  },
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
): Promise<FacultyNoteItem> {
  const form = new FormData();
  form.append('title',        params.title);
  form.append('subject',      params.subject);
  form.append('section_id',   String(params.section_id));
  form.append('auto_publish', String(params.auto_publish));
  form.append('file',         params.file, params.file.name);
  if (params.description) {
    form.append('description', params.description);
  }

  const res = await apiClient.post<FacultyNoteItem>('/notes/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
    // Upload can take longer than the default 15s timeout for large files.
    // 5 minutes is generous even for slow connections and 20 MB files.
    timeout: 300_000,
    signal,
  });

  return res.data;
}

// ── PUT /notes/{id}/replace-file ─────────────────────────────
// Replaces the binary file for an existing note.
// Metadata (title, subject, description) is preserved unchanged.
//
// Backend flow (Phase 2 implementation):
//   1. Validate new file (same rules as upload)
//   2. Save new file to disk → get new UUID filename
//   3. Update DB record: file_name, file_path, file_size, mime_type
//   4. Delete old file from disk
//   5. Return updated FacultyNoteItem
//
// IMPORTANT: Only works on UNPUBLISHED notes. Published notes cannot have
// their file replaced because students may have already downloaded it.
export async function replaceNoteFile(
  noteId:      number,
  file:        File,
  onProgress?: UploadProgressCallback,
  signal?:     AbortSignal,
): Promise<FacultyNoteItem> {
  const form = new FormData();
  form.append('file', file, file.name);

  const res = await apiClient.put<FacultyNoteItem>(
    `/notes/${noteId}/replace-file`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event: AxiosProgressEvent) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
      timeout: 300_000,
      signal,
    },
  );

  return res.data;
}


// ============================================================
// SECTION 4: BINARY OPERATIONS (native fetch — same as student module)
// ============================================================
//
// Faculty may want to preview or re-download their own uploaded files
// to verify them before publishing. We reuse the exact same pattern
// from notesService.ts to preserve binary integrity.
//
// WHY duplicate the fetchBinaryBlob pattern instead of importing it?
//   fetchBinaryBlob is a PRIVATE function in notesService.ts (not exported).
//   Importing it would require making it public, which exposes
//   an implementation detail. Duplicating a 20-line helper is the
//   cleaner option. If this pattern grows, extract to utils/binaryFetch.ts.
// ───────────────────────────────────────────────────────────────

async function fetchBinaryBlobForFaculty(path: string): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  const response = await window.fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      window.location.href = '/login';
      throw new Error('Session expired.');
    }
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const text   = await response.text();
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === 'string') message = parsed.detail;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }

  return response;
}

// Preview a faculty note as a blob URL (for PDF/image inline viewer)
export async function previewFacultyNote(
  noteId: number,
): Promise<{ blobUrl: string; mimeType: string }> {
  const response = await fetchBinaryBlobForFaculty(`/notes/${noteId}/download`);
  const blob     = await response.blob();
  const mimeType = response.headers.get('content-type')
    ?? blob.type
    ?? 'application/octet-stream';
  return { blobUrl: URL.createObjectURL(blob), mimeType };
}

// Trigger a file download to the faculty member's disk
export async function downloadFacultyNote(
  noteId:   number,
  filename: string,
): Promise<void> {
  const { blobUrl } = await previewFacultyNote(noteId);
  const link        = document.createElement('a');
  link.href         = blobUrl;
  link.download     = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}
