// ============================================================
// types/facultyNotes.ts — Faculty Notes Management Type Contracts
// ============================================================
//
// DESIGN PRINCIPLE: STRICT ROLE SEPARATION
// ─────────────────────────────────────────
// Students use: types/notes.ts → NoteItem (no publish state)
// Faculty uses: types/facultyNotes.ts → FacultyNoteItem (full state)
//
// WHY TWO SEPARATE TYPE FILES?
//   → Information hiding: students never see `is_published` in a
//     TypeScript type, so they cannot accidentally render or depend
//     on a field that the backend intentionally omits from their API response.
//   → Single Responsibility: each type file owns one role's view of the world.
//   → Adding faculty-only fields later (e.g. download_count) requires
//     touching only this file, never the student types.
//
// SHARED UTILITIES
// ─────────────────
// getMimeConfig(), formatBytes(), formatUploadDate() live in types/notes.ts.
// They are re-exported here so faculty components import from ONE place
// and we have zero logic duplication.
// ============================================================

// Re-export shared display utilities from student module.
// Faculty components should import from here — not from types/notes.ts —
// so that if we ever split the modules, consumers only need one import change.
export { getMimeConfig, formatBytes, formatUploadDate } from '@/types/notes';
export type { FileTypeGroup }                           from '@/types/notes';
import type { FileTypeGroup }                           from '@/types/notes';


// ============================================================
// SECTION 1: API CONTRACTS
// Mirrors the backend FacultyNoteResponse schema (defined in Phase 1,
// implemented in backend/schemas/notes.py).
// ============================================================

// Mirrors: schemas/notes.py → FacultyNoteResponse
//
// Differences from student NoteItem:
//   + is_published: whether students can see this note
//   + updated_at:   when metadata or file was last changed
//
// Security note: file_path and file_name are STILL intentionally absent.
// Faculty have no more reason to know the server path than students do.
export interface FacultyNoteItem {
  id:                 number;
  faculty_id:         number;
  section_id:         number;
  subject:            string;
  title:              string;
  description:        string | null;
  original_file_name: string;
  file_size:          number;         // bytes — use formatBytes() for display
  mime_type:          string;         // e.g. "application/pdf"
  is_active:          boolean;        // soft-delete flag; false = deleted
  is_published:       boolean;        // false = draft; true = visible to students
  uploaded_at:        string | null;  // ISO 8601 datetime string
  updated_at:         string | null;  // ISO 8601 datetime; null = never updated
}

// Mirrors: schemas/notes.py → NotePublishToggle
// Sent as JSON body to PATCH /notes/{id}/publish
export interface PublishStatePayload {
  is_published: boolean;
}

// Mirrors: schemas/notes.py → NoteUpdate (existing)
// All fields are optional — PATCH semantics (send only changed fields).
export interface UpdateNotePayload {
  title?:       string;
  description?: string;
  subject?:     string;
}

// Pagination-ready response shape.
// Phase 1 fetches all notes (limit=200) for client-side filtering.
// Phase 6 can activate server-side pagination by hooking into skip/limit/has_more.
export interface PaginatedFacultyNotes {
  items:    FacultyNoteItem[];
  total:    number;
  skip:     number;
  limit:    number;
  has_more: boolean;
}


// ============================================================
// SECTION 2: UPLOAD TYPES
// ============================================================

// What the upload form produces.
// Sent as multipart/form-data to POST /notes/upload.
// Every field maps to a Form() parameter in the FastAPI route.
export interface UploadNotePayload {
  title:         string;
  subject:       string;
  section_id:    number;
  description?:  string;
  auto_publish:  boolean;   // if true → backend sets is_published=True immediately
  file:          File;      // the actual browser File object
}

// Replaces the file bytes only. Metadata stays unchanged.
// Sent as multipart/form-data to PUT /notes/{id}/replace-file.
export interface ReplaceFilePayload {
  file: File;
}

// Upload progress lifecycle state.
// Owned by the upload form component (not the list hook).
// Transitions: idle → validating → uploading → success | error
export type UploadPhase = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export interface UploadProgressState {
  phase:        UploadPhase;
  percent:      number;               // 0–100 (from XHR progress event)
  error:        string | null;        // human-readable message on failure
  uploadedNote: FacultyNoteItem | null; // populated on success
}

export const INITIAL_UPLOAD_STATE: UploadProgressState = {
  phase:        'idle',
  percent:      0,
  error:        null,
  uploadedNote: null,
};


// ============================================================
// SECTION 3: FILTER + SEARCH STATE
// ============================================================

// Faculty notes dashboard filter state.
// NOTE: `publishState` is the key difference from student NotesFilters.
// Students cannot filter by publish state because they only see published notes.
export interface FacultyNotesFilters {
  search:       string;              // fuzzy matches title AND subject
  subject:      string;              // '' = all subjects
  fileType:     FileTypeGroup | '';  // '' = all file types; from types/notes.ts
  publishState: 'all' | 'published' | 'draft';
}

// Re-exported as FileTypeGroup is used in the filters above.
// This re-export is intentional — already declared above from notes.ts.

export const DEFAULT_FACULTY_NOTES_FILTERS: FacultyNotesFilters = {
  search:       '',
  subject:      '',
  fileType:     '',
  publishState: 'all',
};


// ============================================================
// SECTION 4: DERIVED / COMPUTED TYPES
// ============================================================

// Computed once from the full notes list in the hook.
// Drives the dashboard stats cards (total, published, drafts)
// and populates the subject dropdown from real data.
export interface FacultyNotesStats {
  total:       number;
  published:   number;
  drafts:      number;
  totalSizeBytes: number;   // sum of all file sizes; display with formatBytes()
  subjects:    string[];    // unique subject names, sorted alphabetically
}

// Query params sent to GET /faculty/notes
// Designed to match the backend's Query() parameters exactly.
export interface FacultyNotesQueryParams {
  search?:       string;
  subject?:      string;
  is_published?: boolean;
  skip?:         number;
  limit?:        number;
}


// ============================================================
// SECTION 5: VALIDATION CONSTANTS (mirrors backend exactly)
// These are referenced by fileValidation.ts but defined here
// so they can be used in UI copy ("Accepted: PDF, DOCX…").
// ============================================================

// Max upload size: 20 MB — same as backend MAX_FILE_SIZE_BYTES
export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = '20 MB';

// Min upload size: 1 KB — same as backend MIN_FILE_SIZE_BYTES
export const MIN_UPLOAD_SIZE_BYTES = 1024;

// Allowed extensions — same set as backend ALLOWED_EXTENSIONS
export const ALLOWED_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.doc', '.docx',
  '.ppt', '.pptx',
  '.odt', '.odp', '.ods',
  '.jpg', '.jpeg', '.png',
]);

// Human-readable label for error messages
export const ALLOWED_TYPES_DISPLAY = 'PDF, DOC, DOCX, PPT, PPTX, ODT, ODP, ODS, JPG, PNG';

// MIME → allowed extensions mapping (mirrors backend EXTENSION_MIME_COMPATIBILITY)
// Used for client-side MIME-extension consistency check.
// ODF types accept application/zip because ODF files ARE ZIP containers.
export const EXTENSION_MIME_COMPATIBILITY: Readonly<Record<string, ReadonlySet<string>>> = {
  '.pdf':  new Set(['application/pdf']),
  '.doc':  new Set(['application/msword']),
  '.docx': new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  '.ppt':  new Set(['application/vnd.ms-powerpoint']),
  '.pptx': new Set(['application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  '.odt':  new Set(['application/vnd.oasis.opendocument.text',         'application/zip', 'application/octet-stream']),
  '.odp':  new Set(['application/vnd.oasis.opendocument.presentation', 'application/zip', 'application/octet-stream']),
  '.ods':  new Set(['application/vnd.oasis.opendocument.spreadsheet',  'application/zip', 'application/octet-stream']),
  '.jpg':  new Set(['image/jpeg', 'image/jpg']),
  '.jpeg': new Set(['image/jpeg', 'image/jpg']),
  '.png':  new Set(['image/png']),
};

// All allowed MIME types (union of all values above + image subtypes)
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
