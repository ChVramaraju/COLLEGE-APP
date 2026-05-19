// ============================================================
// components/admin/ChartCard.tsx — Chart Container Wrapper
// ============================================================

import type { ReactNode, JSX } from 'react';

interface Props {
  title:     string;
  subtitle?: string;
  children:  ReactNode;
  className?: string;
  action?:   ReactNode;
}

export function ChartCard({ title, subtitle, children, className = '', action }: Props): JSX.Element {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export default ChartCard;
