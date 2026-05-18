// ============================================================
// types/notes.ts — Notes Module Type Contracts
// ============================================================
// THREE CATEGORIES:
//   1. API TYPES  — mirrors NoteResponse from backend
//   2. FILTER TYPES — user filter state shapes
//   3. MIME UTILITIES — maps MIME strings to UI presentation
//      (icon color, badge label, preview capability)
//      These are constants/functions, not runtime types —
//      they live here because they're pure data-to-display
//      mappings that belong with the type definitions.
// ============================================================

// ---------------------------------------------------------------
// CATEGORY 1: API TYPES (mirror schemas/notes.py exactly)
// ---------------------------------------------------------------

// Mirrors: schemas/notes.py → NoteResponse
export interface NoteItem {
  id: number;
  faculty_id: number;
  section_id: number;
  subject: string;
  title: string;
  description: string | null;
  original_file_name: string;
  file_size: number;                 // bytes
  mime_type: string;                 // e.g. "application/pdf"
  is_active: boolean;
  uploaded_at: string | null;        // ISO datetime string from backend
}

// ---------------------------------------------------------------
// CATEGORY 2: FILTER / STATE TYPES
// ---------------------------------------------------------------
export interface NotesFilters {
  search:      string;               // searches title AND subject
  subject:     string;               // '' = all subjects
  fileType:    FileTypeGroup | '';   // '' = all types
}

export const DEFAULT_NOTES_FILTERS: NotesFilters = {
  search:   '',
  subject:  '',
  fileType: '',
};

// ---------------------------------------------------------------
// CATEGORY 3: MIME TYPE UTILITIES
// ---------------------------------------------------------------
// WHY define these in the types file?
//   Every component that renders a note needs to know:
//   "What icon do I show? What label? Can I preview this?"
//   Centralizing here means ONE change updates ALL consumers.
//   This is the "single source of truth" principle.
// ---------------------------------------------------------------

export type FileTypeGroup = 'pdf' | 'image' | 'document' | 'other';

interface MimeConfig {
  group:       FileTypeGroup;
  label:       string;               // badge text: "PDF", "Image", etc.
  iconBg:      string;               // Tailwind bg class
  iconColor:   string;               // Tailwind text class
  canPreview:  boolean;              // can we render in browser?
}

// Map specific MIME types to UI config
const MIME_MAP: Record<string, MimeConfig> = {
  'application/pdf':          { group: 'pdf',      label: 'PDF',   iconBg: 'bg-rose-50',    iconColor: 'text-rose-600',    canPreview: true  },
  'image/jpeg':               { group: 'image',    label: 'Image', iconBg: 'bg-purple-50',  iconColor: 'text-purple-600',  canPreview: true  },
  'image/jpg':                { group: 'image',    label: 'Image', iconBg: 'bg-purple-50',  iconColor: 'text-purple-600',  canPreview: true  },
  'image/png':                { group: 'image',    label: 'Image', iconBg: 'bg-purple-50',  iconColor: 'text-purple-600',  canPreview: true  },
  'image/gif':                { group: 'image',    label: 'GIF',   iconBg: 'bg-purple-50',  iconColor: 'text-purple-600',  canPreview: true  },
  'image/webp':               { group: 'image',    label: 'Image', iconBg: 'bg-purple-50',  iconColor: 'text-purple-600',  canPreview: true  },
  'text/plain':               { group: 'document', label: 'Text',  iconBg: 'bg-gray-50',    iconColor: 'text-gray-600',    canPreview: true  },
  'application/msword':       { group: 'document', label: 'Word',  iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    canPreview: false },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                              { group: 'document', label: 'Word',  iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    canPreview: false },
  'application/vnd.ms-excel': { group: 'document', label: 'Excel', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', canPreview: false },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                              { group: 'document', label: 'Excel', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', canPreview: false },
  'application/vnd.ms-powerpoint':
                              { group: 'document', label: 'PPT',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',   canPreview: false },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                              { group: 'document', label: 'PPT',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',   canPreview: false },
  'application/zip':          { group: 'other',    label: 'ZIP',   iconBg: 'bg-gray-50',    iconColor: 'text-gray-500',    canPreview: false },
};

const FALLBACK_CONFIG: MimeConfig = {
  group: 'other', label: 'File', iconBg: 'bg-gray-50', iconColor: 'text-gray-500', canPreview: false,
};

export function getMimeConfig(mimeType: string): MimeConfig {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  // Check prefix for uncovered image/* types
  if (mimeType.startsWith('image/')) {
    return { group: 'image', label: 'Image', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', canPreview: true };
  }
  return FALLBACK_CONFIG;
}

// Human-readable file size (mirrors the backend property)
export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// Format upload date for display
export function formatUploadDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
