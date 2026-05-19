// ============================================================
// components/admin/EditUserModal.tsx
// ============================================================
// Role-aware edit modal.
//   • student  → section (dropdown), semester (dropdown)
//   • faculty  → department (dropdown), designation (dropdown)
// Pre-populates from AdminUser profile fields.
// Only sends fields that actually changed.
// Closes on Escape.  Rollback handled by the hook.
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { X, Loader2, Pencil } from 'lucide-react';
import { getDepartmentsData, listSections } from '@/services/adminService';
import type {
  AdminUser, UpdateUserPayload, DeptOption, SectionItem,
} from '@/types/admin';

interface Props {
  user:     AdminUser;
  onClose:  () => void;
  onSubmit: (id: number, payload: UpdateUserPayload) => Promise<void>;
}

const ROLE_BADGE: Record<string, string> = {
  student: 'bg-blue-100 text-blue-700',
  faculty: 'bg-violet-100 text-violet-700',
  admin:   'bg-rose-100 text-rose-700',
};

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const inputCls = (err: boolean) =>
  `w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
    err ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50'
  }`;

export function EditUserModal({ user, onClose, onSubmit }: Props) {
  // ── Core fields ────────────────────────────────────────────
  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [email,    setEmail]    = useState(user.email    ?? '');

  // ── Student profile fields ─────────────────────────────────
  const [sectionId, setSectionId] = useState<number | null>(user.section_id ?? null);
  const [semester,  setSemester]  = useState<number>(user.semester ?? 1);

  // ── Faculty profile fields ─────────────────────────────────
  const [department,  setDepartment]  = useState(user.department  ?? '');
  const [designation, setDesignation] = useState(user.designation ?? '');

  // ── Options ────────────────────────────────────────────────
  const [depts,    setDepts]    = useState<DeptOption[]>([]);
  const [desigs,   setDesigs]   = useState<DeptOption[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(user.role !== 'admin');

  // ── Error / state ──────────────────────────────────────────
  const [nameErr,  setNameErr]  = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [apiError, setApiError] = useState('');
  const [saving,   setSaving]   = useState(false);

  // ── Escape key ─────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // ── Load dropdown options (student / faculty only) ─────────
  useEffect(() => {
    if (user.role === 'admin') return;
    setLoadingOpts(true);
    Promise.all([getDepartmentsData(), listSections()])
      .then(([deptsData, sects]) => {
        setDepts(deptsData.departments);
        setDesigs(deptsData.designations);
        setSections(sects);
      })
      .catch(() => { /* dropdowns stay empty on error */ })
      .finally(() => setLoadingOpts(false));
  }, [user.role]);

  // ── Validation ─────────────────────────────────────────────
  const validate = (): boolean => {
    let ok = true;
    if (!fullName.trim()) {
      setNameErr('Full name cannot be blank.');
      ok = false;
    } else {
      setNameErr('');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailErr('Invalid email address.');
      ok = false;
    } else {
      setEmailErr('');
    }
    return ok;
  };

  // ── Build diff payload (only changed fields) ───────────────
  const buildPayload = (): UpdateUserPayload => {
    const p: UpdateUserPayload = {};

    if (fullName.trim() !== (user.full_name ?? ''))
      p.full_name = fullName.trim();

    const trimmedEmail = email.trim();
    if (trimmedEmail !== (user.email ?? ''))
      p.email = trimmedEmail || undefined;

    if (user.role === 'student') {
      if (sectionId !== (user.section_id ?? null))
        p.section_id = sectionId;   // null = unassign
      if (semester !== (user.semester ?? 0))
        p.semester = semester;
    }

    if (user.role === 'faculty') {
      if (department && department !== (user.department ?? ''))
        p.department = department;
      if (designation && designation !== (user.designation ?? ''))
        p.designation = designation;
    }

    return p;
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;

    const payload = buildPayload();
    if (Object.keys(payload).length === 0) { onClose(); return; }

    setSaving(true);
    try {
      await onSubmit(user.id, payload);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to save changes.');
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Pencil className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Edit User</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">@{user.username}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">

            {/* API error */}
            {apiError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {apiError}
              </div>
            )}

            {/* Full name */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Full Name *</label>
              <input
                className={inputCls(!!nameErr)}
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Full name"
                autoFocus
              />
              {nameErr && <span className="text-xs text-rose-600">{nameErr}</span>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Email</label>
              <input
                type="email"
                className={inputCls(!!emailErr)}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@college.edu"
              />
              {emailErr && <span className="text-xs text-rose-600">{emailErr}</span>}
            </div>

            {/* ── Student profile fields ────────────────────── */}
            {user.role === 'student' && (
              <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Student Details
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Semester */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Semester</label>
                    <select
                      className={inputCls(false)}
                      value={semester}
                      onChange={e => setSemester(Number(e.target.value))}
                    >
                      {SEMESTERS.map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Section */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Section</label>
                    <select
                      className={inputCls(false)}
                      value={sectionId ?? ''}
                      onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)}
                      disabled={loadingOpts}
                    >
                      <option value="">No section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {s.department.toUpperCase()} Sem {s.semester}
                        </option>
                      ))}
                    </select>
                    {loadingOpts && (
                      <span className="text-[10px] text-gray-400">Loading…</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Faculty profile fields ────────────────────── */}
            {user.role === 'faculty' && (
              <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                  Faculty Details
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Department */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Department</label>
                    <select
                      className={inputCls(false)}
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={loadingOpts}
                    >
                      <option value="">Select department</option>
                      {depts.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Designation */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Designation</label>
                    <select
                      className={inputCls(false)}
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      disabled={loadingOpts}
                    >
                      <option value="">Select designation</option>
                      {desigs.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    {loadingOpts && (
                      <span className="text-[10px] text-gray-400">Loading…</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Immutable fields notice */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">
                <span className="font-semibold text-gray-500">Username</span> and{' '}
                <span className="font-semibold text-gray-500">role</span> cannot be
                changed after creation.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
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
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
