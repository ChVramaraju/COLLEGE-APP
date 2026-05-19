// ============================================================
// pages/admin/FacultyAssignmentsPage.tsx — Admin Assignment Manager
// ============================================================
// The CENTRAL admin control panel for faculty-section ownership.
//
// LAYOUT:
//   Top bar: stat chips + "New Assignment" button
//   Filter bar: faculty selector + section selector
//   Table: assignment rows with delete action
//   Panel: inline create form (slides in on button click)
//
// SECURITY: AdminErrorBoundary wraps this page in routes/index.tsx.
// All API calls require admin JWT (enforced server-side).
// ============================================================

import React, { useState, useEffect, type JSX } from 'react';
import {
  Plus, Trash2, Loader2, AlertTriangle,
  Search, Users, BookOpen, LayoutGrid, X, CheckCircle2,
} from 'lucide-react';
import { useFacultyAssignments } from '@/hooks/useFacultyAssignments';
import { listFacultyForAdmin, type FacultyBrief } from '@/services/facultyAssignmentService';
import { listSections } from '@/services/adminService';
import type { FacultyAssignment, FacultyAssignmentCreate } from '@/types/facultyAssignment';
import type { SectionItem } from '@/types/admin';

const CARD  = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
const INPUT = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200';


// ============================================================
// PAGE
// ============================================================
export default function FacultyAssignmentsPage(): JSX.Element {
  const {
    assignments, isLoading, isSubmitting, error,
    filters, setFilters,
    create, remove,
  } = useFacultyAssignments();

  const [showForm,  setShowForm]  = useState(false);
  const [search,    setSearch]    = useState('');
  const [deleteId,  setDeleteId]  = useState<number | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [faculties, setFaculties] = useState<FacultyBrief[]>([]);
  const [sections,  setSections]  = useState<SectionItem[]>([]);

  useEffect(() => {
    listFacultyForAdmin().then(setFaculties).catch(() => {});
    listSections().then(setSections).catch(() => {});
  }, []);

  // Client-side search on faculty name / employee id / section / subject
  const filtered = assignments.filter(a => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.faculty_name.toLowerCase().includes(q)    ||
      a.faculty_employee_id.toLowerCase().includes(q) ||
      a.section_name.toLowerCase().includes(q)    ||
      a.subject.toLowerCase().includes(q)         ||
      a.section_department.toLowerCase().includes(q)
    );
  });

  async function handleDelete(id: number) {
    setDeleteId(id);
    setDeleteErr(null);
    try {
      await remove(id);
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleteId(null);
    }
  }

  async function handleCreate(data: FacultyAssignmentCreate) {
    await create(data);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faculty Assignments</h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign faculty members to sections and subjects. This controls what each faculty can access.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Assignment'}
        </button>
      </div>

      {/* Stat chips */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatChip icon={Users}     label="Assignments" value={assignments.length} color="indigo" />
        <StatChip icon={LayoutGrid} label="Unique Sections" value={new Set(assignments.map(a => a.section_id)).size} color="violet" />
        <StatChip icon={BookOpen}  label="Unique Subjects" value={new Set(assignments.map(a => a.subject)).size} color="emerald" />
      </div>

      {/* Create form panel */}
      {showForm && (
        <div className={`${CARD} mb-6 p-6`}>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Create Assignment</h2>
          <CreateForm
            faculties={faculties}
            sections={sections}
            isSubmitting={isSubmitting}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Error banners */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {deleteErr && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {deleteErr}
        </div>
      )}

      {/* Filter + search bar */}
      <div className="mb-4 flex flex-wrap gap-3">
        {/* Faculty filter */}
        <select
          value={filters.facultyId ?? ''}
          onChange={e => setFilters({ ...filters, facultyId: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        >
          <option value="">All Faculty</option>
          {faculties.map(f => (
            <option key={f.id} value={f.id}>{f.employee_id} ({f.department.toUpperCase()})</option>
          ))}
        </select>

        {/* Section filter */}
        <select
          value={filters.sectionId ?? ''}
          onChange={e => setFilters({ ...filters, sectionId: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        >
          <option value="">All Sections</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} · Sem {s.semester} · {s.department.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, subject, section…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className={CARD}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <BookOpen className="mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">
              {assignments.length === 0 ? 'No assignments yet' : 'No results match your filters'}
            </p>
            {assignments.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                Click "New Assignment" to assign a faculty member.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <Th>Faculty</Th>
                  <Th>Section</Th>
                  <Th>Subject</Th>
                  <Th>Sem</Th>
                  <Th>Year</Th>
                  <Th>Assigned On</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(a => (
                  <AssignmentRow
                    key={a.id}
                    assignment={a}
                    isDeleting={deleteId === a.id}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// Assignment row
// ============================================================
function AssignmentRow({
  assignment, isDeleting, onDelete,
}: {
  assignment: FacultyAssignment;
  isDeleting: boolean;
  onDelete:   (id: number) => void;
}): JSX.Element {
  const deptLabel = assignment.section_department.toUpperCase();
  const date      = new Date(assignment.created_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{assignment.faculty_name}</p>
        <p className="text-xs text-gray-400">{assignment.faculty_employee_id}</p>
      </td>
      <td className="px-4 py-3">
        <span className="inline-block rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
          {assignment.section_name} · {deptLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700">{assignment.subject}</td>
      <td className="px-4 py-3 text-center text-gray-600">{assignment.semester}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">{assignment.section_academic_year}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{date}</td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={() => onDelete(assignment.id)}
          disabled={isDeleting}
          className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          Remove
        </button>
      </td>
    </tr>
  );
}


// ============================================================
// Create form
// ============================================================
interface FormState {
  faculty_id: number | '';
  section_id: number | '';
  subject:    string;
  semester:   number | '';
}

function CreateForm({
  faculties, sections, isSubmitting, onSubmit, onCancel,
}: {
  faculties:    FacultyBrief[];
  sections:     SectionItem[];
  isSubmitting: boolean;
  onSubmit:     (data: FacultyAssignmentCreate) => Promise<void>;
  onCancel:     () => void;
}): JSX.Element {
  const [form,     setForm]     = useState<FormState>({ faculty_id: '', section_id: '', subject: '', semester: '' });
  const [errors,   setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  }

  // Auto-fill semester when section changes
  function handleSectionChange(sectionId: number | '') {
    setField('section_id', sectionId);
    if (sectionId !== '') {
      const sec = sections.find(s => s.id === sectionId);
      if (sec) setField('semester', sec.semester);
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (form.faculty_id === '') e.faculty_id = 'Select a faculty member.';
    if (form.section_id === '') e.section_id = 'Select a section.';
    if (!form.subject.trim())  e.subject    = 'Subject is required.';
    if (form.semester === '' || Number(form.semester) < 1 || Number(form.semester) > 8)
      e.semester = 'Semester must be 1–8.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setApiError(null);
    try {
      await onSubmit({
        faculty_id: form.faculty_id as number,
        section_id: form.section_id as number,
        subject:    form.subject.trim(),
        semester:   form.semester as number,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setForm({ faculty_id: '', section_id: '', subject: '', semester: '' });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Creation failed. Please try again.');
    }
  }

  return (
    <form onSubmit={e => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* Faculty */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Faculty *</label>
        <select
          value={form.faculty_id}
          onChange={e => setField('faculty_id', e.target.value === '' ? '' : Number(e.target.value))}
          disabled={isSubmitting}
          className={INPUT}
        >
          <option value="">— Select faculty —</option>
          {faculties.map(f => (
            <option key={f.id} value={f.id}>
              {f.employee_id} ({f.department.toUpperCase()})
            </option>
          ))}
        </select>
        {errors.faculty_id && <p className="text-xs text-rose-500">{errors.faculty_id}</p>}
      </div>

      {/* Section */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Section *</label>
        <select
          value={form.section_id}
          onChange={e => handleSectionChange(e.target.value === '' ? '' : Number(e.target.value))}
          disabled={isSubmitting}
          className={INPUT}
        >
          <option value="">— Select section —</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} · Sem {s.semester} · {s.department.toUpperCase()} · {s.academic_year}
            </option>
          ))}
        </select>
        {errors.section_id && <p className="text-xs text-rose-500">{errors.section_id}</p>}
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Subject *</label>
        <input
          type="text"
          value={form.subject}
          onChange={e => setField('subject', e.target.value)}
          disabled={isSubmitting}
          maxLength={100}
          placeholder="e.g. Data Structures"
          className={INPUT}
        />
        {errors.subject && <p className="text-xs text-rose-500">{errors.subject}</p>}
      </div>

      {/* Semester */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-600">Semester *</label>
        <input
          type="number"
          min={1}
          max={8}
          value={form.semester}
          onChange={e => setField('semester', e.target.value === '' ? '' : Number(e.target.value))}
          disabled={isSubmitting}
          placeholder="1–8"
          className={INPUT}
        />
        {errors.semester && <p className="text-xs text-rose-500">{errors.semester}</p>}
      </div>

      {/* API error */}
      {apiError && (
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {apiError}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Assignment created successfully.
        </div>
      )}

      {/* Buttons */}
      <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSubmitting ? 'Creating…' : 'Create Assignment'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}


// ============================================================
// Helpers
// ============================================================
function Th({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </th>
  );
}

function StatChip({
  icon: Icon, label, value, color,
}: {
  icon:  React.ElementType;
  label: string;
  value: number;
  color: 'indigo' | 'violet' | 'emerald';
}): JSX.Element {
  const colors = {
    indigo:  'bg-indigo-50  text-indigo-600',
    violet:  'bg-violet-50  text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className={`${CARD} flex items-center gap-3 p-4`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
