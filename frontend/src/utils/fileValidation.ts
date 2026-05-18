// ============================================================
// utils/fileValidation.ts — Client-side File Validation
// ============================================================
//
// PURPOSE
// ───────
// Mirrors the backend's validate_upload() function in
// backend/utils/file_utils.py EXACTLY.
//
// WHY duplicate validation on the client?
//   → Instant feedback: no round-trip needed to tell the user
//     "this file is 25 MB, limit is 20 MB".
//   → Better UX: validation fires on file selection, not on submit.
//   → Reduced server load: only valid files hit the network.
//
// WHY not ONLY client-side?
//   → Never trust the client. The backend always validates too.
//   → This is defense-in-depth: two independent validation layers.
//
// SYNC CONTRACT
// ─────────────
// Whenever the backend's ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES,
// MAX_FILE_SIZE_BYTES, or EXTENSION_MIME_COMPATIBILITY change,
// facultyNotes.ts constants (which this file imports) must be
// updated to match. There is intentionally no automated sync —
// this is flagged in code review.
// ============================================================

import {
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  EXTENSION_MIME_COMPATIBILITY,
  MAX_UPLOAD_SIZE_BYTES,
  MIN_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_LABEL,
  ALLOWED_TYPES_DISPLAY,
} from '@/types/facultyNotes';


// ============================================================
// PRIMARY VALIDATION FUNCTION
// ============================================================

export interface FileValidationResult {
  valid:   boolean;
  error:   string | null;
}

/**
 * Validates a browser File object against the same rules as the backend.
 *
 * VALIDATION ORDER (mirrors backend validate_upload):
 *   1. Extension whitelist
 *   2. MIME type whitelist
 *   3. MIME-extension consistency (cross-category rename attack protection)
 *   4. File size maximum
 *   5. File size minimum
 *
 * Returns { valid: true, error: null } if all checks pass.
 * Returns { valid: false, error: "..." } on the FIRST failing check.
 */
export function validateFileForUpload(file: File): FileValidationResult {
  const filename = file.name;
  const mimeType = file.type;
  const sizeBytes = file.size;

  // ── Guard: must have a filename ───────────────────────────────
  if (!filename) {
    return err('File has no name. Please re-select the file.');
  }

  // ── Check 1: Extension whitelist ─────────────────────────────
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return err(`File has no extension. Accepted types: ${ALLOWED_TYPES_DISPLAY}`);
  }
  const ext = filename.slice(lastDot).toLowerCase();

  if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return err(
      `Extension "${ext}" is not allowed. Accepted types: ${ALLOWED_TYPES_DISPLAY}`
    );
  }

  // ── Check 2: MIME type whitelist ──────────────────────────────
  // ODF carve-out: some browsers report ODF as application/zip or
  // application/octet-stream because ODF IS a ZIP container.
  const ODF_EXTENSIONS = new Set(['.odt', '.odp', '.ods']);
  const ODF_ZIP_MIMES  = new Set(['application/zip', 'application/octet-stream']);
  const isOdfZip = ODF_EXTENSIONS.has(ext) && ODF_ZIP_MIMES.has(mimeType);

  if (!isOdfZip && mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return err(
      `File type "${mimeType}" is not allowed. Accepted types: ${ALLOWED_TYPES_DISPLAY}`
    );
  }

  // ── Check 3: MIME-extension consistency ──────────────────────
  // Guards against cross-category rename attacks:
  //   malicious.exe renamed to notes.pdf
  //   → ext .pdf PASSES check 1
  //   → MIME application/x-executable FAILS check 3
  if (!isOdfZip && mimeType) {
    const allowedMimesForExt = EXTENSION_MIME_COMPATIBILITY[ext];
    if (allowedMimesForExt && !allowedMimesForExt.has(mimeType)) {
      return err(
        `MIME type "${mimeType}" does not match extension "${ext}". ` +
        `Please upload the file without renaming it.`
      );
    }
  }

  // ── Check 4: Maximum file size ────────────────────────────────
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    return err(
      `File size ${sizeMB} MB exceeds the ${MAX_UPLOAD_SIZE_LABEL} limit.`
    );
  }

  // ── Check 5: Minimum file size ────────────────────────────────
  // Catches empty files and skeleton stubs from corrupted browser state.
  if (sizeBytes < MIN_UPLOAD_SIZE_BYTES) {
    return err(
      `File is too small (${sizeBytes} bytes). ` +
      `Minimum size is 1 KB. The file may be empty or corrupted — ` +
      `please re-select it.`
    );
  }

  return { valid: true, error: null };
}

// ── Helper ────────────────────────────────────────────────────
function err(message: string): FileValidationResult {
  return { valid: false, error: message };
}


// ============================================================
// DISPLAY HELPERS
// ============================================================

/**
 * Returns an accept="" attribute string for <input type="file">.
 * Includes both MIME types and extensions so the browser's file picker
 * filters correctly across operating systems.
 *
 * WHY both MIME and extension?
 *   On Windows, OS file pickers use extensions.
 *   On macOS/Linux, browsers often use MIME types.
 *   Providing both ensures the picker works everywhere.
 */
export const FILE_INPUT_ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'image/jpeg',
  'image/png',
  '.pdf',
  '.doc', '.docx',
  '.ppt', '.pptx',
  '.odt', '.odp', '.ods',
  '.jpg', '.jpeg', '.png',
].join(',');
