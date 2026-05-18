// ============================================================
// services/notesService.ts — Notes API Layer
// ============================================================
// THREE distinct API operations, each with different handling:
//
//  1. getStudentSectionId() / getSectionNotes()
//     → JSON endpoints → use Axios (interceptors + auth injection)
//
//  2. fetchNoteBlob() / downloadNoteFile()
//     → Binary file endpoint → use native window.fetch ONLY
//
// WHY native fetch instead of Axios for binary files?
// ─────────────────────────────────────────────────────
// Axios runs every response through a transformResponse chain.
// Even with responseType:'blob', the Axios interceptor pipeline
// can coerce binary data through string encoding in edge cases,
// corrupting bytes > 127 via UTF-8 replacement sequences.
//
// Native fetch().blob() is a browser primitive specifically
// designed for binary data. The browser handles the byte stream
// at the C++ layer — no JavaScript string encoding is ever
// involved. This is the W3C-specified way to handle file downloads.
//
// Authentication is attached manually (same token from localStorage
// that the Axios request interceptor would have attached).
//
// PIPELINE COMPARISON:
//
//   Axios path:  XHR → responseType:'blob' → transformResponse[]
//                → response interceptors → res.data (Blob)
//                [transformResponse CAN touch data before returning]
//
//   fetch path:  fetch() → Response.blob()
//                [browser reads raw bytes directly into Blob,
//                 zero JavaScript transformation possible]
// ============================================================

import apiClient from '@/api/client';
import type { NoteItem } from '@/types/notes';
import { STORAGE_KEYS } from '@/utils/constants';

// ---------------------------------------------------------------
// Base URL — same source as the Axios client uses
// ---------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// ---------------------------------------------------------------
// Get the current student's section ID
// Required before fetching notes (section-scoped endpoint)
// ---------------------------------------------------------------
export async function getStudentSectionId(): Promise<number | null> {
  const res = await apiClient.get<{ section: { id: number } | null }>('/students/me');
  return res.data.section?.id ?? null;
}

// ---------------------------------------------------------------
// Fetch all notes for a section (limit=100 for full client-side filter)
// ---------------------------------------------------------------
export async function getSectionNotes(sectionId: number): Promise<NoteItem[]> {
  const res = await apiClient.get<NoteItem[]>(`/notes/section/${sectionId}`, {
    params: { limit: 100, skip: 0 },
  });
  return res.data;
}

// ---------------------------------------------------------------
// INTERNAL HELPER: authenticated binary fetch via native fetch API
//
// Why manually attach the token instead of using Axios?
//   → Axios interceptors run for ALL requests — including the
//     error interceptor that tries to parse response.data as JSON.
//     For binary responses, that causes corruption.
//   → Native fetch bypasses ALL Axios logic. We attach the
//     Authorization header manually — same value Axios would use.
//
// Error handling:
//   → Non-2xx responses: read body as text, attempt JSON parse
//     to extract FastAPI's { detail: "..." } error message.
//   → If body isn't JSON (e.g., nginx 502 HTML page): use status.
// ---------------------------------------------------------------
async function fetchBinaryBlob(path: string): Promise<Response> {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

  const response = await window.fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    // Handle 401: mirror the Axios interceptor's redirect behaviour
    if (response.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      window.location.href = '/login';
      throw new Error('Session expired. Redirecting to login.');
    }

    // Try to extract FastAPI's detail message from the error body
    let message = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const text = await response.text();
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === 'string') message = parsed.detail;
    } catch {
      // Body was not valid JSON — keep the HTTP status message
    }
    throw new Error(message);
  }

  return response;
}

// ---------------------------------------------------------------
// Fetch note as Blob → used for BOTH download and preview
//
// Returns { blobUrl, mimeType }:
//   blobUrl  → blob:http://... — a temporary in-memory URL
//              CALLER MUST revoke with URL.revokeObjectURL()
//   mimeType → from Content-Type header (browser-controlled,
//              reflects what the server actually sent)
// ---------------------------------------------------------------
export async function fetchNoteBlob(noteId: number): Promise<{ blobUrl: string; mimeType: string }> {
  const response = await fetchBinaryBlob(`/notes/${noteId}/download`);

  // .blob() reads raw bytes directly — no encoding conversion
  const blob     = await response.blob();
  const mimeType = response.headers.get('content-type')
    ?? blob.type
    ?? 'application/octet-stream';

  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, mimeType };
}

// ---------------------------------------------------------------
// Trigger a file download to the user's disk
// Blob URL → synthetic <a> click → browser saves → revoke URL
// ---------------------------------------------------------------
export async function downloadNoteFile(
  noteId:   number,
  filename: string,
): Promise<void> {
  const { blobUrl } = await fetchNoteBlob(noteId);

  const link    = document.createElement('a');
  link.href     = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Revoke after the browser has queued the download.
  // 100ms is sufficient — the browser reads blob data synchronously
  // during the click handler, before the download dialog appears.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
}
