// ============================================================
// components/dashboard/widgets/AcademicWidget.tsx
// ============================================================
// Shows: CGPA, latest semester SGPA, semester history table.
//
// current_cgpa comes from GET /results/transcript/me
// It's the most recent computed CGPA across all semesters.
//
// WHY show CGPA prominently?
//   CGPA is the single most important academic metric for:
//   - Placement eligibility (min_cgpa in job postings)
//   - Higher education applications
//   - Scholarship criteria
//   In ERP design: what matters most to the user goes first.
// ============================================================

import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, TrendingDown, ArrowRight, BookOpen, AlertCircle } from 'lucide-react';
import type { Transcript, SemesterTranscript } from '@/types/dashboard';
import SkeletonCard from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

const statusColors: Record<string, string> = {
  pass:     'text-emerald-600 bg-emerald-50',
  fail:     'text-rose-600 bg-rose-50',
  withheld: 'text-amber-600 bg-amber-50',
  pending:  'text-gray-500 bg-gray-100',
};

function SemesterRow({ sem }: { sem: SemesterTranscript }): JSX.Element {
  const statusClass = statusColors[sem.result_status ?? 'pending'];

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="py-2.5 pr-3 text-sm font-medium text-gray-800">Sem {sem.semester}</td>
      <td className="py-2.5 pr-3 text-xs text-gray-500">{sem.academic_year}</td>
      <td className="py-2.5 pr-3 text-sm font-semibold text-gray-800">
        {sem.sgpa?.toFixed(2) ?? '—'}
      </td>
      <td className="py-2.5 pr-3 text-sm text-gray-600">
        {sem.cgpa?.toFixed(2) ?? '—'}
      </td>
      <td className="py-2.5">
        {sem.result_status && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass}`}>
            {sem.result_status}
          </span>
        )}
      </td>
    </tr>
  );
}

interface AcademicWidgetProps {
  data:      Transcript | undefined;
  isLoading: boolean;
  error:     string | undefined;
}

export default function AcademicWidget({ data, isLoading, error }: AcademicWidgetProps): JSX.Element {
  const navigate = useNavigate();

  if (isLoading) return <SkeletonCard rows={5} className="h-full" />;

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mb-2 h-6 w-6 text-red-400" />
        <p className="text-sm font-medium text-red-600">Academic data unavailable</p>
      </div>
    );
  }

  const latestSem = data?.semesters?.length
    ? [...data.semesters].sort((a, b) => b.semester - a.semester)[0]
    : null;

  const cgpa = data?.current_cgpa;
  const sgpa = latestSem?.sgpa;

  const cgpaColor =
    !cgpa       ? 'text-gray-400'
    : cgpa >= 8 ? 'text-emerald-600'
    : cgpa >= 6 ? 'text-amber-600'
    : 'text-rose-600';

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Academic Summary</h3>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* CGPA + SGPA hero row */}
        {data ? (
          <>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className={`text-3xl font-bold leading-none ${cgpaColor}`}>
                  {cgpa?.toFixed(2) ?? '—'}
                </p>
                <p className="mt-1 text-xs text-gray-400">Current CGPA</p>
              </div>
              {sgpa !== undefined && sgpa !== null && (
                <>
                  <div className="h-10 w-px bg-gray-200" />
                  <div className="text-center">
                    <p className="text-2xl font-bold leading-none text-gray-700">
                      {sgpa.toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Sem {latestSem?.semester} SGPA
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {sgpa >= 7
                      ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                      : <TrendingDown className="h-4 w-4 text-rose-500" />
                    }
                  </div>
                </>
              )}
            </div>

            {/* Semester table */}
            {data.semesters.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Semester History
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="pb-1.5 text-xs font-medium text-gray-400">Sem</th>
                        <th className="pb-1.5 text-xs font-medium text-gray-400">Year</th>
                        <th className="pb-1.5 text-xs font-medium text-gray-400">SGPA</th>
                        <th className="pb-1.5 text-xs font-medium text-gray-400">CGPA</th>
                        <th className="pb-1.5 text-xs font-medium text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.semesters]
                        .sort((a, b) => b.semester - a.semester)
                        .slice(0, 4)
                        .map(sem => (
                          <SemesterRow key={sem.semester} sem={sem} />
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No results yet</p>
            <p className="text-xs text-gray-400">Results will appear after exams are graded</p>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/student/results')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View full transcript <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
