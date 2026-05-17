// ============================================================
// components/common/SkeletonCard.tsx — Loading Skeleton
// ============================================================
// Shown while API data is loading.
//
// WHY skeletons instead of a spinner?
//   A spinner tells the user "something is loading."
//   A skeleton tells the user "a card with content is loading."
//   Skeletons reduce perceived wait time because the user already
//   knows where data will appear — the layout doesn't shift.
//   This is why Gmail, LinkedIn, and Slack all use skeletons.
//
// The pulse animation creates the "shimmer" effect via
// Tailwind's animate-pulse utility (CSS keyframe opacity oscillation).
// ============================================================

interface SkeletonCardProps {
  rows?: number;
  height?: string;
  className?: string;
}

export default function SkeletonCard({
  rows = 3,
  height = 'h-4',
  className = '',
}: SkeletonCardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse ${className}`}>
      {/* Title skeleton */}
      <div className="mb-4 h-4 w-32 rounded bg-gray-200" />
      {/* Row skeletons */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`${height} rounded bg-gray-200`}
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Compact skeleton for smaller areas
export function SkeletonRow({ count = 1 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 rounded bg-gray-200" />
            <div className="h-2.5 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
