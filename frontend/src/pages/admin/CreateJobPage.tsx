// ============================================================
// pages/admin/CreateJobPage.tsx
// routes: /admin/placement/create-job   (create mode)
//         /admin/placement/:jobId/edit  (edit mode)
// ============================================================
// Single-page form for creating or editing a job posting.
// Eligibility section: CGPA, attendance, department checkboxes.
// ============================================================

import { useState, useEffect, type JSX, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  createJobPosting, updateJobPosting, getJobPosting,
} from '@/services/placementService';
import { DEPARTMENTS } from '@/types/placement';
import type { JobPostingCreate } from '@/types/placement';

const INPUT_CLS =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 ' +
  'placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200 transition-colors';

const LABEL_CLS = 'block text-xs font-semibold text-gray-600 mb-1';

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">{title}</h2>
      {children}
    </div>
  );
}

const EMPTY_FORM: JobPostingCreate = {
  company_name: '',
  role_title: '',
  description: '',
  location: '',
  package_lpa: null,
  allowed_departments: null,
  min_cgpa: 0,
  min_attendance_pct: 0,
  application_deadline: null,
};

export default function CreateJobPage(): JSX.Element {
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId?: string }>();
  const isEdit = !!jobId;

  const [form,        setForm]        = useState<JobPostingCreate>(EMPTY_FORM);
  const [deptChecked, setDeptChecked] = useState<Set<string>>(new Set());
  const [isLoading,   setIsLoading]   = useState(isEdit);
  const [isSaving,    setIsSaving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  // Load existing posting in edit mode
  useEffect(() => {
    if (!isEdit || !jobId) return;
    setIsLoading(true);
    getJobPosting(Number(jobId))
      .then(posting => {
        setForm({
          company_name:         posting.company_name,
          role_title:           posting.role_title,
          description:          posting.description ?? '',
          location:             posting.location ?? '',
          package_lpa:          posting.package_lpa,
          allowed_departments:  posting.allowed_departments,
          min_cgpa:             posting.min_cgpa,
          min_attendance_pct:   posting.min_attendance_pct,
          application_deadline: posting.application_deadline,
        });
        if (posting.allowed_departments) {
          setDeptChecked(new Set(posting.allowed_departments.split(',').map(d => d.trim())));
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setIsLoading(false));
  }, [isEdit, jobId]);

  const setField = <K extends keyof JobPostingCreate>(k: K, v: JobPostingCreate[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const toggleDept = (dept: string) => {
    setDeptChecked(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.company_name.trim()) { setError('Company name is required.'); return; }
    if (!form.role_title.trim())   { setError('Role title is required.'); return; }

    const payload: JobPostingCreate = {
      ...form,
      allowed_departments: deptChecked.size > 0 ? Array.from(deptChecked).join(',') : null,
    };

    setIsSaving(true);
    try {
      if (isEdit && jobId) {
        await updateJobPosting(Number(jobId), payload);
      } else {
        await createJobPosting(payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/admin/placement'), 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message
        : (typeof e === 'object' && e !== null && 'response' in e)
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Failed to save.'
          : 'Failed to save.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/placement')}
          className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-rose-600" />
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Job Posting' : 'Create Job Posting'}
          </h1>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {isEdit ? 'Posting updated!' : 'Job posting created!'} Redirecting…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company + Role */}
        <FormSection title="Company & Role">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Company Name *</label>
              <input
                type="text" required
                value={form.company_name}
                onChange={e => setField('company_name', e.target.value)}
                placeholder="e.g. Infosys, TCS, Google"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Role Title *</label>
              <input
                type="text" required
                value={form.role_title}
                onChange={e => setField('role_title', e.target.value)}
                placeholder="e.g. Software Engineer"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                placeholder="e.g. Bangalore, Remote"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Package (LPA)</label>
              <input
                type="number" min={0} step={0.5}
                value={form.package_lpa ?? ''}
                onChange={e => setField('package_lpa', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 6.5"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Role responsibilities, skills required, perks…"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Application Deadline</label>
            <input
              type="datetime-local"
              value={form.application_deadline
                ? new Date(form.application_deadline).toISOString().slice(0, 16)
                : ''}
              onChange={e => setField('application_deadline', e.target.value ? new Date(e.target.value).toISOString() : null)}
              className={INPUT_CLS}
            />
          </div>
        </FormSection>

        {/* Eligibility */}
        <FormSection title="Eligibility Criteria">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL_CLS}>Minimum CGPA (0 = no minimum)</label>
              <input
                type="number" min={0} max={10} step={0.1}
                value={form.min_cgpa}
                onChange={e => setField('min_cgpa', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Minimum Attendance % (0 = no minimum)</label>
              <input
                type="number" min={0} max={100} step={1}
                value={form.min_attendance_pct}
                onChange={e => setField('min_attendance_pct', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>
              Eligible Departments
              <span className="ml-1 font-normal text-gray-400">(leave empty = all departments)</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEPARTMENTS.map(d => {
                const checked = deptChecked.has(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDept(d.value)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none ${
                      checked
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {deptChecked.size > 0 && (
              <p className="mt-1 text-xs text-gray-400">
                Selected: {Array.from(deptChecked).join(', ')}
              </p>
            )}
          </div>
        </FormSection>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/placement')}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || success}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors focus:outline-none"
          >
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              : isEdit ? 'Update Posting' : 'Create Posting'
            }
          </button>
        </div>
      </form>
    </div>
  );
}
