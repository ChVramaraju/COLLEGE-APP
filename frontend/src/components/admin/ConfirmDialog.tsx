// ============================================================
// components/admin/ConfirmDialog.tsx — Confirmation Modal
// ============================================================

import type { JSX } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open:      boolean;
  title:     string;
  message:   string;
  confirmLabel?: string;
  danger?:   boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false,
  onConfirm, onCancel,
}: Props): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 rounded-xl p-2.5 ${danger ? 'bg-rose-50' : 'bg-amber-50'}`}>
            <AlertTriangle className={`h-5 w-5 ${danger ? 'text-rose-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
