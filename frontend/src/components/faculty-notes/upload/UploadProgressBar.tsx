import { CheckCircle2, XCircle } from 'lucide-react';
import type { JSX } from 'react';
import type { UploadPhase } from '@/types/facultyNotes';

interface Props {
  percent: number;
  phase:   UploadPhase;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  idle:       '',
  validating: 'Validating…',
  uploading:  'Uploading…',
  success:    'Upload complete!',
  error:      'Upload failed',
};

export default function UploadProgressBar({ percent, phase }: Props): JSX.Element | null {
  if (phase === 'idle') return null;

  const isSuccess  = phase === 'success';
  const isError    = phase === 'error';
  const isActive   = phase === 'uploading' || phase === 'validating';

  const barColor = isSuccess
    ? 'bg-emerald-500'
    : isError
      ? 'bg-rose-500'
      : 'bg-indigo-500';

  const fill = isSuccess ? 100 : isError ? 0 : percent;

  return (
    <div aria-label={`Upload progress: ${PHASE_LABEL[phase]}`}>
      {/* Status row */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isSuccess && (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
          )}
          {isError && (
            <XCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
          )}
          {isActive && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
              aria-hidden="true"
            />
          )}
          <span
            className={`text-sm font-semibold ${
              isSuccess ? 'text-emerald-700' : isError ? 'text-rose-700' : 'text-gray-700'
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
        </div>

        {isActive && (
          <span className="text-xs font-medium tabular-nums text-gray-500">
            {percent}%
          </span>
        )}
      </div>

      {/* Progress track */}
      {(isActive || isSuccess) && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            role="progressbar"
            aria-valuenow={fill}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ width: `${fill}%` }}
            className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
          />
        </div>
      )}
    </div>
  );
}
