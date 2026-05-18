// ============================================================
// components/tests/states/TestsLoadingSkeleton.tsx
// ============================================================
// Renders N skeleton cards that match TestCard's layout exactly.
// Prevents layout shift when real cards load in.
// ============================================================

interface SkeletonCardProps {
  index: number;
}

function SkeletonCard({ index }: SkeletonCardProps) {
  return (
    <div
      className="
        flex flex-col rounded-2xl overflow-hidden
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-gray-700
        shadow-sm
      "
      aria-hidden="true"
    >
      {/* Top colour strip */}
      <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 animate-pulse" />

      <div className="flex flex-col gap-4 p-5">
        {/* Header row: subject badge + status badge */}
        <div className="flex items-center justify-between gap-3">
          <div
            className="h-5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
            style={{ width: `${60 + (index % 3) * 20}px` }}
          />
          <div className="h-5 w-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="h-4 w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div
            className="h-4 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
            style={{ width: `${50 + (index % 2) * 30}%` }}
          />
        </div>

        {/* Stats box */}
        <div className="
          flex items-center justify-around
          bg-gray-50 dark:bg-gray-700/50
          rounded-xl py-3 px-2
        ">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse" />
              <div className="h-4 w-8 rounded bg-gray-200 dark:bg-gray-600 animate-pulse" />
              <div className="h-3 w-12 rounded bg-gray-200 dark:bg-gray-600 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Deadline */}
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />

        {/* CTA button */}
        <div className="h-10 w-full rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}


interface TestsLoadingSkeletonProps {
  count?: number;
}

export default function TestsLoadingSkeleton({ count = 6 }: TestsLoadingSkeletonProps) {
  return (
    <div
      className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Loading tests…"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </div>
  );
}
