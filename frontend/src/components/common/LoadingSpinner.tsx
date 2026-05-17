// ============================================================
// components/common/LoadingSpinner.tsx
// ============================================================
// Shown during two scenarios:
//   1. Initial auth state restoration (isLoading = true)
//   2. Any async operation (API calls, navigation)
//
// Kept as a pure visual component — no logic, no state.
// The parent decides when to show it.
// ============================================================

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

export default function LoadingSpinner({
  fullScreen = false,
  size = 'md',
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={`${sizeClasses[size]} animate-spin rounded-full border-indigo-600 border-t-transparent`}
      role="status"
      aria-label="Loading"
    />
  );

  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {spinner}
    </div>
  );
}
