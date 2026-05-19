// ============================================================
// pages/faculty/AttendanceHistoryPage.tsx
// ============================================================
// Shows all attendance sessions marked by the current faculty.
// Grouped by session metadata (section, date, subject, period).
// Each row has an "Edit" action linking to the edit page.
//
// FILTERING (client-side):
//   Subject search, section filter, date range, period
//
// SORTING: newest-first (backend already returns this order)
// ============================================================

import { useState, useEffect, useMemo, type JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, X, AlertTriangle, CalendarCheck,
  ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react';

import { getFacultyAttendanceHistory } from '@/services/attendanceService';
import { getFacultySections }          from '@/services/testService';
import type { AttendanceSessionSummary } from '@/types/attendance';
import type { SectionBrief }            from '@/types/test';

const PAGE_SIZE = 20;
const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

export default function AttendanceHistoryPage(): JSX.Element {
  const navigate = useNavigate();

  const [history,   setHistory]   = useState<AttendanceSessionSummary[]>([]);
  const [sections,  setSections]  = useState<SectionBrief[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [search,      setSearch]      = useState('');
  const [sectionId,   setSectionId]   = useState<number | ''>('');
  const [fromDate,    setFromDate]    = useState('');
  const [toDate,      setToDate]      = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFacultyAttendanceHistory(), getFacultySections()])
      .then(([hist, secs]) => {
        if (cancelled) return;
        setHistory(hist);
        setSections(secs);
      })
      .catch(e => { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(s => {
      if (q && !s.subject.toLowerCase().includes(q) && !s.section_name.toLowerCase().includes(q)) return false;
      if (sectionId !== '' && s.section_id !== sectionId) return false;
      if (fromDate && s.attendance_date < fromDate) return false;
      if (toDate   && s.attendance_date > toDate)   return false;
      return true;
    });
  }, [history, search, sectionId, fromDate, toDate]);

  // Reset page on filter change
  useEffect(() => { setCurrentPage(1); }, [search, sectionId, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const clearFilters = () => {
    setSearch(''); setSectionId(''); setFromDate(''); setToDate('');
  };
  const hasFilters = search !== '' || sectionId !== '' || fromDate !== '' || toDate !== '';

  const editUrl = (s: AttendanceSessionSummary) =>
    `/faculty/attendance/edit?sectionId=${s.section_id}&date=${s.attendance_date}&subject=${encodeURIComponent(s.subject)}&period=${s.period_number}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">

      {/* ── Back nav ───────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/faculty/attendance"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Attendance
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">History</span>
      </div>

      {/* ── Page header ────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance History</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            All sessions you have marked · {loading ? '…' : `${history.length} total`}
          </p>
        </div>
        <button
          onClick={() => navigate('/faculty/attendance/mark')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          Mark New Session
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────── */}
      <div className={`${CARD} mb-4 flex flex-wrap items-center gap-3 p-4`}>
        {/* Subject search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            placeholder="Search subject or section…"
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
          />
        </div>

        {/* Section filter */}
        <select
          value={sectionId}
          onChange={e => setSectionId(e.target.value === '' ? '' : Number(e.target.value))}
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        >
          <option value="">All Sections</option>
          {sections.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          title="From date"
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        />
        <span className="text-xs text-gray-400">to</span>
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={e => setToDate(e.target.value)}
          title="To date"
          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────── */}
      <div className={CARD}>
        {loading ? (
          <div className="animate-pulse space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 p-5 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" /> {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-gray-400">
            <CalendarCheck className="h-10 w-10 opacity-25" />
            <p className="text-sm">{hasFilters ? 'No sessions match your filters.' : 'No sessions marked yet.'}</p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-1 text-xs text-indigo-600 hover:underline focus:outline-none">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">Section</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Period</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">Absent</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">Late</th>
                    <th className="px-4 py-3 text-center">Total</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map((s, i) => {
                    const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                    const low = pct < 75;
                    return (
                      <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 text-xs font-medium text-gray-700 whitespace-nowrap">
                          {new Date(s.attendance_date + 'T00:00:00').toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[160px] truncate">
                          {s.subject}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell">
                          {s.section_name}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500 hidden md:table-cell">
                          P{s.period_number}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-semibold text-emerald-700">
                            {s.present}
                            <span className={`ml-1 text-xs font-normal ${low ? 'text-rose-500' : 'text-gray-400'}`}>
                              ({pct}%)
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-rose-600">
                          {s.absent}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-semibold text-amber-600 hidden sm:table-cell">
                          {s.late}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {s.total}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate(editUrl(s))}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-300 ml-auto"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-500">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 focus:outline-none"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs text-gray-600">{safePage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40 focus:outline-none"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
