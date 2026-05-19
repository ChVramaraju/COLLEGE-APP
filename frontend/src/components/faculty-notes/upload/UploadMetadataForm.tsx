import { useEffect, useState } from 'react';
import type { ChangeEvent, JSX } from 'react';
import type { SectionBrief } from '@/types/test';
import { getFacultySections } from '@/services/testService';
import type { UploadFormState, UploadFormErrors } from '@/hooks/useFacultyNoteUpload';

interface Props {
  form:          UploadFormState;
  formErrors:    UploadFormErrors;
  isDisabled:    boolean;
  onFieldChange: <K extends keyof UploadFormState>(field: K, value: UploadFormState[K]) => void;
}

// ── Shared input/textarea class ─────────────────────────────
const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 ' +
  'placeholder-gray-400 transition-colors focus:border-indigo-400 focus:bg-white ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60';

function sectionLabel(s: SectionBrief): string {
  return `${s.department.toUpperCase()} · Sem ${s.semester} · Section ${s.name} (${s.academic_year})`;
}

// ── Field wrapper ──────────────────────────────────────────
function Field({
  label,
  required = false,
  error,
  hint,
  children,
}: {
  label:     string;
  required?: boolean;
  error?:    string;
  hint?:     string;
  children:  React.ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-1 text-rose-500" aria-hidden="true">*</span>
        )}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600">{error}</p>
      )}
      {!error && hint && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────
export default function UploadMetadataForm({
  form,
  formErrors,
  isDisabled,
  onFieldChange,
}: Props): JSX.Element {
  const [sections,    setSections]    = useState<SectionBrief[]>([]);
  const [loadingSec,  setLoadingSec]  = useState(true);
  const [sectionErr,  setSectionErr]  = useState<string | null>(null);

  useEffect(() => {
    getFacultySections()
      .then(setSections)
      .catch(() => setSectionErr('Failed to load sections. Please refresh the page.'))
      .finally(() => setLoadingSec(false));
  }, []);

  return (
    <div className="flex flex-col gap-5">

      {/* ── Title ─────────────────────────────────────────── */}
      <Field label="Note Title" required error={formErrors.title}>
        <input
          type="text"
          value={form.title}
          disabled={isDisabled}
          maxLength={200}
          placeholder="e.g. Unit 3 — Linked Lists Revision Notes"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onFieldChange('title', e.target.value)
          }
          className={INPUT_CLS}
        />
      </Field>

      {/* ── Subject ───────────────────────────────────────── */}
      <Field label="Subject" required error={formErrors.subject}>
        <input
          type="text"
          value={form.subject}
          disabled={isDisabled}
          maxLength={100}
          placeholder="e.g. Data Structures and Algorithms"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onFieldChange('subject', e.target.value)
          }
          className={INPUT_CLS}
        />
      </Field>

      {/* ── Section ───────────────────────────────────────── */}
      <Field label="Section" required error={formErrors.section_id ?? sectionErr ?? undefined}>
        {loadingSec ? (
          <div className="h-11 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
        ) : sections.length === 0 && !sectionErr ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            No sections are assigned to your profile. Contact an administrator.
          </p>
        ) : (
          <select
            value={form.section_id === '' ? '' : String(form.section_id)}
            disabled={isDisabled || sections.length === 0}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onFieldChange(
                'section_id',
                e.target.value === '' ? '' : Number(e.target.value),
              )
            }
            className={INPUT_CLS}
          >
            <option value="">Select a section…</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {sectionLabel(s)}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* ── Description ───────────────────────────────────── */}
      <Field
        label="Description"
        hint="Optional — topics covered, chapter reference, intended audience…"
      >
        <textarea
          rows={3}
          value={form.description}
          disabled={isDisabled}
          maxLength={2000}
          placeholder="Optional description or notes for students…"
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onFieldChange('description', e.target.value)
          }
          className={`${INPUT_CLS} resize-none`}
        />
        <p className="self-end text-xs text-gray-400">
          {form.description.length} / 2000
        </p>
      </Field>
    </div>
  );
}
