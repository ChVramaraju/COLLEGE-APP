// ============================================================
// pages/admin/SectionsPage.tsx — Section Management
// ============================================================

import { useState, useEffect, useCallback, type JSX, type FormEvent } from 'react';
import { Plus, Building2, Users, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { listSections, createSection } from '@/services/adminService';
import type { SectionItem } from '@/types/admin';

const DEPARTMENTS = ['cse','ece','mech','civil','eee','it','aids'] as const;
type Dept = typeof DEPARTMENTS[number];

const DEPT_LABELS: Record<Dept, string> = {
  cse:'CSE', ece:'ECE', mech:'MECH', civil:'CIVIL', eee:'EEE', it:'IT', aids:'AIDS',
};

const DEPT_COLORS: Record<Dept, string> = {
  cse:'#6366f1', ece:'#10b981', mech:'#f59e0b', civil:'#ef4444',
  eee:'#8b5cf6', it:'#06b6d4', aids:'#f97316',
};

function SectionCard({ sec }: { sec: SectionItem }): JSX.Element {
  const dept = sec.department as Dept;
  const color = DEPT_COLORS[dept] ?? '#6366f1';
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex rounded-xl p-2" style={{ background: `${color}15` }}>
          <Building2 className="h-5 w-5" style={{ color }} />
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
          {DEPT_LABELS[dept] ?? dept.toUpperCase()}-{sec.name}
        </span>
      </div>
      <p className="text-lg font-bold text-gray-900">Section {sec.name}</p>
      <p className="text-sm text-gray-500">{DEPT_LABELS[dept] ?? dept} · Sem {sec.semester}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
        <span>{sec.academic_year}</span>
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> Max {sec.max_strength}
        </span>
      </div>
      {sec.incharge_faculty_id && (
        <p className="mt-1 text-xs text-gray-400">Incharge ID: {sec.incharge_faculty_id}</p>
      )}
    </div>
  );
}

function CreateSectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: SectionItem) => void }): JSX.Element {
  const [form, setForm] = useState({
    name:          '',
    department:    'cse' as Dept,
    semester:      1,
    academic_year: '',
    max_strength:  60,
    incharge_faculty_id: null as number | null,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const created = await createSection({
        ...form,
        name: form.name.toUpperCase(),
      });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create section.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Create New Section</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Name *</label>
              <input
                required
                maxLength={5}
                placeholder="A, B, C…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Department *</label>
              <select
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value as Dept }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Semester *</label>
              <select
                value={form.semester}
                onChange={e => setForm(f => ({ ...f, semester: parseInt(e.target.value) }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">Max Strength</label>
              <input
                type="number"
                min={10}
                max={200}
                value={form.max_strength}
                onChange={e => setForm(f => ({ ...f, max_strength: parseInt(e.target.value) || 60 }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Academic Year *</label>
            <input
              required
              placeholder="2024-25"
              pattern="\d{4}-\d{2}"
              value={form.academic_year}
              onChange={e => setForm(f => ({ ...f, academic_year: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">Incharge Faculty ID (optional)</label>
            <input
              type="number"
              placeholder="Leave blank if not assigned"
              value={form.incharge_faculty_id ?? ''}
              onChange={e => setForm(f => ({
                ...f,
                incharge_faculty_id: e.target.value ? parseInt(e.target.value) : null,
              }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Creating…' : <><CheckCircle className="h-4 w-4" /> Create Section</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SectionsPage(): JSX.Element {
  const [sections,    setSections]    = useState<SectionItem[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [deptFilter,  setDeptFilter]  = useState<Dept | 'all'>('all');

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listSections();
      setSections(data);
      setError(null);
    } catch {
      setError('Failed to load sections.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = deptFilter === 'all'
    ? sections
    : sections.filter(s => s.department === deptFilter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sections</h2>
          <p className="mt-1 text-sm text-gray-500">{sections.length} total sections</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New Section
        </button>
      </div>

      {/* Dept filter */}
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...DEPARTMENTS] as const).map(d => (
          <button
            key={d}
            onClick={() => setDeptFilter(d as Dept | 'all')}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
              deptFilter === d
                ? 'border-indigo-300 bg-indigo-600 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {d === 'all' ? 'All' : DEPT_LABELS[d]}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
              <div className="mb-2 h-5 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-500">No sections found</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(s => <SectionCard key={s.id} sec={s} />)}
        </div>
      )}

      {showCreate && (
        <CreateSectionModal
          onClose={() => setShowCreate(false)}
          onCreated={s => setSections(prev => [s, ...prev])}
        />
      )}
    </div>
  );
}
