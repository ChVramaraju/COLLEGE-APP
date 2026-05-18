// ============================================================
// OptionEditor.tsx — Four MCQ option inputs + correct answer radio
// ============================================================

import type { JSX, ChangeEvent } from 'react';
import type { CorrectOption } from '@/types/test';

interface OptionEditorProps {
  option_a:       string;
  option_b:       string;
  option_c:       string;
  option_d:       string;
  correct_option: CorrectOption;
  onChange: (field: 'option_a' | 'option_b' | 'option_c' | 'option_d', value: string) => void;
  onCorrectChange: (key: CorrectOption) => void;
}

const OPTS: Array<{ key: CorrectOption; field: 'option_a' | 'option_b' | 'option_c' | 'option_d'; label: string }> = [
  { key: 'a', field: 'option_a', label: 'A' },
  { key: 'b', field: 'option_b', label: 'B' },
  { key: 'c', field: 'option_c', label: 'C' },
  { key: 'd', field: 'option_d', label: 'D' },
];

export default function OptionEditor({
  option_a, option_b, option_c, option_d,
  correct_option,
  onChange,
  onCorrectChange,
}: OptionEditorProps): JSX.Element {
  type OptionField = 'option_a' | 'option_b' | 'option_c' | 'option_d';
  const values: Record<OptionField, string> = { option_a, option_b, option_c, option_d };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Options &amp; Correct Answer
      </p>
      {OPTS.map(({ key, field, label }) => {
        const isCorrect = correct_option === key;
        return (
          <label
            key={key}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 transition-colors ${
              isCorrect
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name={`correct_${field}`}
              checked={isCorrect}
              onChange={() => onCorrectChange(key)}
              className="h-4 w-4 accent-emerald-500 focus:ring-emerald-400"
            />
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {label}
            </span>
            <input
              type="text"
              value={values[field]}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(field, e.target.value)}
              placeholder={`Option ${label}`}
              maxLength={500}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            {isCorrect && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Correct
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
