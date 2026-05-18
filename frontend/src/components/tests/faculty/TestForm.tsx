// ============================================================
// TestForm.tsx — Test metadata form fields
// ============================================================
// Fields: title, description, subject, section dropdown,
// duration, start_time, end_time.
// ============================================================

import { useEffect, useState } from 'react';
import type { JSX, ChangeEvent } from 'react';
import type { TestMetaFormState, SectionBrief } from '@/types/test';
import { getFacultySections } from '@/services/testService';

interface TestFormProps {
  meta:        TestMetaFormState;
  isReadonly:  boolean;
  onChange:    (field: keyof TestMetaFormState, value: TestMetaFormState[keyof TestMetaFormState]) => void;
}

function sectionLabel(s: SectionBrief): string {
  return `${s.department.toUpperCase()} · Sem ${s.semester} · Section ${s.name} (${s.academic_year})`;
}

export default function TestForm({ meta, isReadonly, onChange }: TestFormProps): JSX.Element {
  const [sections, setSections]   = useState<SectionBrief[]>([]);
  const [loadingSec, setLoadingSec] = useState(true);

  useEffect(() => {
    getFacultySections()
      .then(setSections)
      .finally(() => setLoadingSec(false));
  }, []);

  const disabled = isReadonly;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800">Test Details</h2>

      {/* ── Title ── */}
      <Field label="Test Title" required>
        <input
          type="text"
          value={meta.title}
          disabled={disabled}
          maxLength={200}
          placeholder="e.g. Unit 2 — Arrays and Strings"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('title', e.target.value)}
          className={INPUT_CLS}
        />
      </Field>

      {/* ── Subject ── */}
      <Field label="Subject" required>
        <input
          type="text"
          value={meta.subject}
          disabled={disabled}
          maxLength={100}
          placeholder="e.g. Data Structures"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('subject', e.target.value)}
          className={INPUT_CLS}
        />
      </Field>

      {/* ── Section ── */}
      <Field label="Section" required>
        {loadingSec ? (
          <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
        ) : sections.length === 0 ? (
          <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            No sections assigned to your profile. Contact admin.
          </p>
        ) : (
          <select
            value={meta.section_id === '' ? '' : String(meta.section_id)}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              onChange('section_id', e.target.value === '' ? '' : Number(e.target.value))
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

      {/* ── Description ── */}
      <Field label="Description / Instructions">
        <textarea
          rows={3}
          value={meta.description}
          disabled={disabled}
          maxLength={2000}
          placeholder="Optional: instructions, rules, topics covered…"
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange('description', e.target.value)}
          className={`${INPUT_CLS} resize-none`}
        />
      </Field>

      {/* ── Duration ── */}
      <Field label="Duration (minutes)" required>
        <input
          type="number"
          min={5}
          max={300}
          value={meta.duration_minutes}
          disabled={disabled}
          placeholder="e.g. 60"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('duration_minutes', e.target.value === '' ? '' : parseInt(e.target.value, 10))
          }
          className={INPUT_CLS}
        />
      </Field>

      {/* ── Date/Time row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start Date & Time" required>
          <input
            type="datetime-local"
            value={meta.start_time}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('start_time', e.target.value)}
            className={INPUT_CLS}
          />
        </Field>
        <Field label="End Date & Time" required>
          <input
            type="datetime-local"
            value={meta.end_time}
            disabled={disabled}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange('end_time', e.target.value)}
            className={INPUT_CLS}
          />
        </Field>
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 ' +
  'focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300 ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

function Field({
  label,
  required,
  children,
}: {
  label:    string;
  required?: boolean;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
        {label}{required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}
