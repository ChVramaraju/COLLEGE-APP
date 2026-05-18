// ============================================================
// pages/faculty/FacultyTestsPage.tsx — Faculty Test Dashboard
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle, Search, AlertCircle, RefreshCw,
  BarChart2, Pencil, Trash2, Globe, EyeOff, ChevronDown,
} from 'lucide-react';
import type { JSX } from 'react';
import type { TestDetail, FacultyTestStatus } from '@/types/test';
import { deriveFacultyTestStatus, FACULTY_STATUS_CONFIG } from '@/types/test';
import { useFacultyTests } from '@/hooks/useFacultyTests';

const STATUS_FILTERS: Array<{ value: FacultyTestStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active',    label: 'Active' },
  { value: 'expired',   label: 'Expired' },
];

export default function FacultyTestsPage(): JSX.Element {
  const navigate = useNavigate();
  const {
    filteredTests, isLoading, isError, errorMessage,
    filter, setFilter,
    handleDelete, handlePublish, handleUnpublish,
    retry, actionError, clearActionError, actionTestId,
  } = useFacultyTests();

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const onDelete = async (id: number) => {
    await handleDelete(id);
    setConfirmDeleteId(null);
  };

  // ── Loading skeleton ─────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <p className="mb-4 text-gray-600">{errorMessage ?? 'Failed to load tests.'}</p>
        <button
          onClick={retry}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* ── Page header ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tests</h1>
          <p className="text-sm text-gray-500">{filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} found</p>
        </div>
        <button
          onClick={() => navigate('/faculty/tests/create')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <PlusCircle className="h-4 w-4" />
          Create Test
        </button>
      </div>

      {/* ── Action error banner ── */}
      {actionError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={clearActionError} className="shrink-0 text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filter.search}
            onChange={e => setFilter({ search: e.target.value })}
            placeholder="Search by title or subject…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        </div>
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter({ status: f.value })}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                filter.status === f.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty filtered state ── */}
      {filteredTests.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center text-gray-500">
          <Search className="mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium">No tests match your filters.</p>
          <button
            onClick={() => setFilter({ search: '', status: 'all' })}
            className="mt-2 text-sm text-indigo-600 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Test grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTests.map(test => (
          <TestCard
            key={test.id}
            test={test}
            isActing={actionTestId === test.id}
            confirmingDelete={confirmDeleteId === test.id}
            onEdit={() => navigate(`/faculty/tests/${test.id}/edit`)}
            onAnalytics={() => navigate(`/faculty/tests/${test.id}/analytics`)}
            onPublish={() => handlePublish(test.id)}
            onUnpublish={() => handleUnpublish(test.id)}
            onDeleteRequest={() => setConfirmDeleteId(test.id)}
            onDeleteConfirm={() => onDelete(test.id)}
            onDeleteCancel={() => setConfirmDeleteId(null)}
          />
        ))}
      </div>
    </div>
  );
}

// ── TestCard ─────────────────────────────────────────────────

interface TestCardProps {
  test:             TestDetail;
  isActing:         boolean;
  confirmingDelete: boolean;
  onEdit:           () => void;
  onAnalytics:      () => void;
  onPublish:        () => void;
  onUnpublish:      () => void;
  onDeleteRequest:  () => void;
  onDeleteConfirm:  () => void;
  onDeleteCancel:   () => void;
}

function TestCard({
  test, isActing, confirmingDelete,
  onEdit, onAnalytics, onPublish, onUnpublish,
  onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: TestCardProps): JSX.Element {
  const status = deriveFacultyTestStatus(test);
  const cfg    = FACULTY_STATUS_CONFIG[status];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* ── Status + subject ── */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-gray-400">{test.subject}</span>
      </div>

      {/* ── Title ── */}
      <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-gray-900">{test.title}</h3>

      {/* ── Stats ── */}
      <div className="mb-4 flex gap-3 text-xs text-gray-500">
        <span>{test.question_count} Qs</span>
        <span>·</span>
        <span>{test.total_marks ?? '—'} marks</span>
        <span>·</span>
        <span>{test.duration_minutes} min</span>
      </div>

      {/* ── Confirm delete overlay ── */}
      {confirmingDelete ? (
        <div className="mt-auto rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
          <p className="mb-2 font-semibold">Delete this test?</p>
          <div className="flex gap-2">
            <button
              onClick={onDeleteConfirm}
              disabled={isActing}
              className="flex-1 rounded-lg bg-rose-600 py-1.5 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
            >
              {isActing ? '…' : 'Yes, Delete'}
            </button>
            <button
              onClick={onDeleteCancel}
              className="flex-1 rounded-lg border border-gray-200 py-1.5 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2">
          {/* Primary action */}
          {status === 'draft' ? (
            <button
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : (
            <button
              onClick={onAnalytics}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              <BarChart2 className="h-3.5 w-3.5" /> Analytics
            </button>
          )}

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
                onMouseLeave={() => setMenuOpen(false)}
              >
                {status === 'draft' && (
                  <MenuItem
                    icon={<Globe className="h-3.5 w-3.5" />}
                    label="Publish"
                    onClick={() => { setMenuOpen(false); onPublish(); }}
                    disabled={isActing}
                  />
                )}
                {test.is_published && (
                  <MenuItem
                    icon={<EyeOff className="h-3.5 w-3.5" />}
                    label="Unpublish"
                    onClick={() => { setMenuOpen(false); onUnpublish(); }}
                    disabled={isActing}
                  />
                )}
                {status !== 'draft' && (
                  <MenuItem
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    label="Edit"
                    onClick={() => { setMenuOpen(false); onEdit(); }}
                    disabled={false}
                  />
                )}
                <MenuItem
                  icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                  label="Delete"
                  labelClass="text-rose-600"
                  onClick={() => { setMenuOpen(false); onDeleteRequest(); }}
                  disabled={isActing}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon, label, labelClass = '', onClick, disabled,
}: {
  icon: JSX.Element; label: string; labelClass?: string;
  onClick: () => void; disabled: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-gray-50 disabled:opacity-50 ${labelClass || 'text-gray-700'}`}
    >
      {icon} {label}
    </button>
  );
}

function Skeleton(): JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}
