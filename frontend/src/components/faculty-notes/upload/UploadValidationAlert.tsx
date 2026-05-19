import { AlertTriangle } from 'lucide-react';
import type { JSX } from 'react';

interface Props {
  fileError?:   string | null;
  formErrors?:  string[];
  uploadError?: string | null;
}

export default function UploadValidationAlert({
  fileError,
  formErrors = [],
  uploadError,
}: Props): JSX.Element | null {
  const hasFileError   = Boolean(fileError);
  const hasFormErrors  = formErrors.length > 0;
  const hasUploadError = Boolean(uploadError);

  if (!hasFileError && !hasFormErrors && !hasUploadError) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500"
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        {hasFileError && (
          <p className="text-sm font-semibold text-rose-700">{fileError}</p>
        )}

        {hasUploadError && (
          <p className="text-sm font-semibold text-rose-700">{uploadError}</p>
        )}

        {hasFormErrors && (
          <>
            <p className="text-sm font-semibold text-rose-700">
              Please fix the following before uploading:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {formErrors.map(e => (
                <li key={e} className="text-xs text-rose-600">{e}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
