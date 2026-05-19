// ============================================================
// components/admin/AdminErrorBoundary.tsx — Route Error Fence
// ============================================================
// Catches any render-time JS errors inside admin pages and
// shows an isolated recovery UI instead of a blank screen.
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props  { children: ReactNode }
interface State  { hasError: boolean; message: string }

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err?.message ?? 'Unknown error' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[AdminErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
            <AlertTriangle className="h-7 w-7 text-rose-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Page failed to render</p>
            <p className="mt-1 text-sm text-gray-500">{this.state.message}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
