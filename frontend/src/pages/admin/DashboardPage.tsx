// ============================================================
// pages/admin/DashboardPage.tsx — Admin Home
// ============================================================

import { Users, GraduationCap, Briefcase, BarChart3 } from 'lucide-react';
import { useAuth } from '@/store/authStore';

const quickStats = [
  { label: 'Students',  value: '—', sub: 'Enrolled',    Icon: GraduationCap, color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
  { label: 'Faculty',   value: '—', sub: 'Active',      Icon: Users,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Placement', value: '—', sub: 'Placed',      Icon: Briefcase,     color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { label: 'Avg CGPA',  value: '—', sub: 'Institution', Icon: BarChart3,     color: 'text-rose-600',    bg: 'bg-rose-50'    },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Console</h2>
        <p className="mt-1 text-sm text-gray-500">
          Logged in as <span className="font-mono font-medium text-gray-700">{user?.userId}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {quickStats.map(({ label, value, sub, Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex rounded-lg p-2.5 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-700">{label}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Admin analytics</p>
        <p className="mt-1 text-xs text-gray-400">Institution-wide analytics, user management, and placement stats will appear here</p>
      </div>
    </div>
  );
}
