// ============================================================
// components/admin/CreateUserModal.tsx
// ============================================================
// Dynamic role-aware form for creating students, faculty,
// or admins.  Loads department/designation options from the
// backend on mount.  Validates before submit, shows inline
// field errors, and a banner error for API rejections.
// ============================================================

import { useState, useEffect, type FormEvent } from 'react';
import { X, Loader2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { getDepartmentsData, listSections } from '@/services/adminService';
import type {
  CreateUserPayload, UserRole, DeptOption, SectionItem,
} from '@/types/admin';

// ── Types ─────────────────────────────────────────────────────
interface Props {
  onClose:  () => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
}

type FieldErrors = Partial<Record<keyof CreateUserPayload | 'confirm_password', string>>;

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'student', label: 'Student',  desc: 'Requires roll number, dept & semester' },
  { value: 'faculty', label: 'Faculty',  desc: 'Requires employee ID, dept & designation' },
  { value: 'admin',   label: 'Admin',    desc: 'Full system access' },
];

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

// ── Validation ────────────────────────────────────────────────
function validate(
  form: CreateUserPayload & { confirm_password: string },
): FieldErrors {
  const e: FieldErrors = {};
  if (!form.full_name.trim())            e.full_name        = 'Full name is required.';
  if (form.username.trim().length < 4)   e.username         = 'Minimum 4 characters.';
  if (form.password.length < 8)          e.password         = 'Minimum 8 characters.';
  if (form.password !== form.confirm_password)
                                          e.confirm_password = 'Passwords do not match.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                          e.email            = 'Invalid email address.';
  if (form.role === 'student') {
    if (!form.department)                 e.department = 'Department is required.';
    if (!form.semester)                   e.semester   = 'Semester is required.';
  }
  if (form.role === 'faculty') {
    if (!form.department)                 e.department  = 'Department is required.';
    if (!form.designation)                e.designation = 'Designation is required.';
  }
  return e;
}

// ── Component ─────────────────────────────────────────────────
export function CreateUserModal({ onClose, onSubmit }: Props) {
  // form state
  const [role, setRole]                     = useState<UserRole>('student');
  const [fullName, setFullName]             = useState('');
  const [username, setUsername]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPw, setConfirmPw]           = useState('');
  const [department, setDepartment]         = useState('');
  const [semester, setSemester]             = useState<number | ''>('');
  const [sectionId, setSectionId]           = useState<number | null>(null);
  const [admissionYear, setAdmissionYear]   = useState<number>(new Date().getFullYear());
  const [designation, setDesignation]       = useState('');
  const [showPw, setShowPw]                 = useState(false);

  // async options
  const [depts, setDepts]           = useState<DeptOption[]>([]);
  const [desigs, setDesigs]         = useState<DeptOption[]>([]);
  const [sections, setSections]     = useState<SectionItem[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  // submission
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError]       = useState('');
  const [submitting, setSubmitting]   = useState(false);

  // load dropdown options
  useEffect(() => {
    setLoadingOpts(true);
    Promise.all([getDepartmentsData(), listSections()])
      .then(([deptsData, sects]) => {
        setDepts(deptsData.departments);
        setDesigs(deptsData.designations);
        setSections(sects);
      })
      .catch(() => { /* options load fail — dropdowns stay empty */ })
      .finally(() => setLoadingOpts(false));
  }, []);

  // reset role-specific fields when role changes
  useEffect(() => {
    setDepartment('');
    setSemester('');
    setSectionId(null);
    setDesignation('');
  }, [role]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError('');

    const form = {
      full_name:      fullName,
      username:       username.trim(),
      email:          email.trim() || undefined,
      password,
      confirm_password: confirmPw,
      role,
      department:     department || undefined,
      semester:       semester !== '' ? Number(semester) : undefined,
      section_id:     sectionId,
      admission_year: admissionYear,
      designation:    designation || undefined,
    };

    const errors = validate(form as CreateUserPayload & { confirm_password: string });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const { confirm_password: _skip, ...payload } = form;
      await onSubmit(payload as CreateUserPayload);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to create user.');
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Input helper ────────────────────────────────────────────
  const field = (label: string, key: keyof FieldErrors, child: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      {child}
      {fieldErrors[key] && (
        <span className="text-xs text-rose-600">{fieldErrors[key]}</span>
      )}
    </div>
  );

  const inputCls = (key: keyof FieldErrors) =>
    `rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
      fieldErrors[key] ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-gray-50'
    }`;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
              <UserPlus className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Create User</p>
              <p className="text-xs text-gray-400">All fields marked * are required</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">

            {/* API error banner */}
            {apiError && (
              <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200">
                {apiError}
              </div>
            )}

            {/* Role selector */}
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-600">Role *</p>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      role === r.value
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-800">{r.label}</p>
                    <p className="mt-0.5 text-[10px] text-gray-400 leading-tight">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              {field('Full Name *', 'full_name',
                <input
                  className={inputCls('full_name')}
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                />
              )}
              {field(
                role === 'student' ? 'Roll Number *' :
                role === 'faculty' ? 'Employee ID *' : 'Admin Username *',
                'username',
                <input
                  className={inputCls('username')}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={
                    role === 'student' ? '21CSE001' :
                    role === 'faculty' ? 'FAC2024001' : 'ADMIN001'
                  }
                />
              )}
            </div>

            {field('Email (optional)', 'email',
              <input
                type="email"
                className={inputCls('email')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@college.edu"
              />
            )}

            {/* Password */}
            <div className="grid grid-cols-2 gap-4">
              {field('Password *', 'password',
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={inputCls('password') + ' pr-9 w-full'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
              {field('Confirm Password *', 'confirm_password',
                <input
                  type={showPw ? 'text' : 'password'}
                  className={inputCls('confirm_password')}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                />
              )}
            </div>

            {/* ── Student-specific ── */}
            {role === 'student' && (
              <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Student Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field('Department *', 'department',
                    <select
                      className={inputCls('department')}
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={loadingOpts}
                    >
                      <option value="">Select department</option>
                      {depts.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  )}
                  {field('Semester *', 'semester',
                    <select
                      className={inputCls('semester')}
                      value={semester}
                      onChange={e => setSemester(Number(e.target.value))}
                    >
                      <option value="">Select semester</option>
                      {SEMESTERS.map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Section (optional)</label>
                    <select
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={sectionId ?? ''}
                      onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)}
                      disabled={loadingOpts}
                    >
                      <option value="">No section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Admission Year</label>
                    <input
                      type="number"
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      value={admissionYear}
                      min={2000}
                      max={new Date().getFullYear()}
                      onChange={e => setAdmissionYear(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Faculty-specific ── */}
            {role === 'faculty' && (
              <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  Faculty Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field('Department *', 'department',
                    <select
                      className={inputCls('department')}
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={loadingOpts}
                    >
                      <option value="">Select department</option>
                      {depts.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  )}
                  {field('Designation *', 'designation',
                    <select
                      className={inputCls('designation')}
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      disabled={loadingOpts}
                    >
                      <option value="">Select designation</option>
                      {desigs.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
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
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
