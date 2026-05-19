// ============================================================
// components/admin/ResetPasswordModal.tsx
// ============================================================
// Admin-initiated password reset flow.
// Validates min length + confirmation match, shows/hides pw,
// shows API errors inline.
// ============================================================

import { useState, type FormEvent } from 'react';
import { X, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import type { AdminUser } from '@/types/admin';

interface Props {
  user:     AdminUser;
  onClose:  () => void;
  onSubmit: (id: number, newPassword: string) => Promise<void>;
}

export function ResetPasswordModal({ user, onClose, onSubmit }: Props) {
  const [newPw,    setNewPw]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [pwErr,    setPwErr]    = useState('');
  const [confErr,  setConfErr]  = useState('');
  const [apiError, setApiError] = useState('');
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  const validate = (): boolean => {
    let ok = true;
    if (newPw.length < 8)             { setPwErr('Minimum 8 characters.');       ok = false; }
    else                               setPwErr('');
    if (newPw !== confirmPw)          { setConfErr('Passwords do not match.');    ok = false; }
    else                               setConfErr('');
    return ok;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit(user.id, newPw);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to reset password.');
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Success state ────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <KeyRound className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-gray-900">Password Reset!</p>
          <p className="mt-1 text-sm text-gray-500">
            Password for <span className="font-medium">@{user.username}</span> has been updated.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
              <KeyRound className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Reset Password</p>
              <p className="text-xs text-gray-400">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
          {apiError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">New Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className={`w-full rounded-xl border pr-9 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
                  pwErr ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50'
                }`}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwErr && <span className="text-xs text-rose-600">{pwErr}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600">Confirm Password *</label>
            <input
              type={showPw ? 'text' : 'password'}
              className={`rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
                confErr ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50'
              }`}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat password"
            />
            {confErr && <span className="text-xs text-rose-600">{confErr}</span>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
