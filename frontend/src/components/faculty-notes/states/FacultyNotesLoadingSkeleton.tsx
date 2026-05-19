import type { JSX } from 'react';

function Pulse({ className }: { className: string }): JSX.Element {
  return <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;
}

export default function FacultyNotesLoadingSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
        <Pulse className="h-24" />
      </div>

      {/* Filter bar */}
      <Pulse className="h-16" />

      {/* Table skeleton (desktop) */}
      <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white lg:block">
        {/* Header */}
        <div className="h-11 animate-pulse border-b border-gray-200 bg-gray-50" />
        {/* Rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0"
          >
            <div className="h-4 w-5/12 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-4 w-2/12 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-5 w-1/12 animate-pulse rounded-full bg-gray-100" />
            <div className="h-5 w-1.5/12 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-1.5/12 animate-pulse rounded-lg bg-gray-100" />
            <div className="ml-auto h-8 w-20 animate-pulse rounded-xl bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Card skeleton (mobile) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}
