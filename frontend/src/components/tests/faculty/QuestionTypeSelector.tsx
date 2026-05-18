// ============================================================
// QuestionTypeSelector.tsx
// ============================================================
// Currently only MCQ is supported. True/False and descriptive
// are shown disabled with a "coming soon" label so the architecture
// is visible without breaking the form.
// ============================================================

import type { JSX } from 'react';
import { CheckSquare, AlignLeft, ToggleLeft } from 'lucide-react';

export type QuestionType = 'mcq';   // expand when backend supports more

interface QuestionTypeSelectorProps {
  value:    QuestionType;
  onChange: (t: QuestionType) => void;
}

const TYPES = [
  {
    id:      'mcq' as QuestionType,
    label:   'Multiple Choice',
    sub:     'One correct option (A–D)',
    icon:    CheckSquare,
    enabled: true,
  },
  {
    id:      'truefalse' as QuestionType,
    label:   'True / False',
    sub:     'Two options: True or False',
    icon:    ToggleLeft,
    enabled: false,
  },
  {
    id:      'descriptive' as QuestionType,
    label:   'Descriptive',
    sub:     'Open-ended text answer',
    icon:    AlignLeft,
    enabled: false,
  },
] as const;

export default function QuestionTypeSelector({
  value,
  onChange,
}: QuestionTypeSelectorProps): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      {TYPES.map(t => {
        const Icon      = t.icon;
        const isActive  = value === t.id;
        const disabled  = !t.enabled;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(t.id as QuestionType)}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-all
              ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
              ${isActive && !disabled
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/40'
              }`}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
            {disabled && (
              <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
