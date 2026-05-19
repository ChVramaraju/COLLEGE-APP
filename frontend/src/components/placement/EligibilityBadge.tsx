// ============================================================
// components/placement/EligibilityBadge.tsx
// ============================================================
import type { JSX } from 'react';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

interface Props { eligible: boolean | null }

export default function EligibilityBadge({ eligible }: Props): JSX.Element {
  if (eligible === true) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Eligible
    </span>
  );
  if (eligible === false) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Not Eligible
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> Check Eligibility
    </span>
  );
}
