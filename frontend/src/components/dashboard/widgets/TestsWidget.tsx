// ============================================================
// components/dashboard/widgets/TestsWidget.tsx
// ============================================================
// Shows: tests currently open for the student to attempt.
// Highlights: deadline countdown, already-attempted status.
//
// The deadline countdown is computed in the COMPONENT (UI concern),
// not in the hook (data concern). Formatting is a presentation detail.
// ============================================================

import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import type { AvailableTest } from '@/types/dashboard';
import { SkeletonRow } from '@/components/common/SkeletonCard';
import type { JSX } from 'react';

function formatDeadline(endTime: string): { label: string; isUrgent: boolean } {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return { label: 'Expired', isUrgent: true };
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  if (hours < 1) return { label: `${mins}m left`, isUrgent: true };
  if (hours < 24) return { label: `${hours}h ${mins}m left`, isUrgent: hours < 3 };
  const days = Math.floor(hours / 24);
  return { label: `${days}d left`, isUrgent: false };
}

function TestRow({ test, onAttempt }: { test: AvailableTest; onAttempt: () => void }): JSX.Element {
  const { label: deadline, isUrgent } = formatDeadline(test.end_time);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:border-indigo-100 hover:bg-indigo-50/20 transition-colors">
      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
        test.already_attempted ? 'bg-emerald-50' : 'bg-amber-50'
      }`}>
        {test.already_attempted
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          : <ClipboardList className="h-3.5 w-3.5 text-amber-600" />
        }
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{test.title}</p>
        <p className="text-xs text-gray-500">{test.subject} · {test.question_count}Q · {test.total_marks}M</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-rose-600' : 'text-gray-500'}`}>
            <Clock className="h-3 w-3" />
            {deadline}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{test.duration_minutes} min</span>
        </div>
      </div>

      {!test.already_attempted && (
        <button
          onClick={onAttempt}
          className="flex-shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Start
        </button>
      )}
    </div>
  );
}

interface TestsWidgetProps {
  data:      AvailableTest[] | undefined;
  isLoading: boolean;
  error:     string | undefined;
}

export default function TestsWidget({ data, isLoading, error }: TestsWidgetProps): JSX.Element {
  const navigate = useNavigate();

  const pendingCount = data?.filter(t => !t.already_attempted).length ?? 0;

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <ClipboardList className="h-4 w-4 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">Upcoming Tests</h3>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <SkeletonRow count={3} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-xs text-gray-400">Tests unavailable</p>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ClipboardList className="mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No active tests</p>
            <p className="text-xs text-gray-400">Check back later</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.slice(0, 4).map(test => (
              <TestRow
                key={test.id}
                test={test}
                onAttempt={() => navigate(`/student/tests/${test.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/student/tests')}
        className="flex items-center justify-center gap-1.5 border-t border-gray-100 py-3 text-xs font-medium text-indigo-600 hover:bg-gray-50 transition-colors rounded-b-xl"
      >
        View all tests <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
