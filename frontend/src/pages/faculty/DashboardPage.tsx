// ============================================================
// pages/faculty/DashboardPage.tsx — Faculty Home
// ============================================================

import { Users, CalendarCheck, ClipboardList, FileText } from 'lucide-react';
import { useAuth } from '@/store/authStore';

const quickStats = [
  { label: 'Sections',    value: '—', sub: 'Assigned',      Icon: Users,         color: 'text-indigo-600', bg: 'bg-indigo-50'  },
  { label: 'Attendance',  value: '—', sub: 'Sessions today', Icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Tests',       value: '—', sub: 'Active',         Icon: ClipboardList, color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { label: 'Notes',       value: '—', sub: 'Uploaded',       Icon: FileText,      color: 'text-rose-600',    bg: 'bg-rose-50'    },
];

export default function FacultyDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Faculty Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">
          Employee ID: <span className="font-mono font-medium text-gray-700">{user?.userId}</span>
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
        <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Faculty dashboard content</p>
        <p className="mt-1 text-xs text-gray-400">Sections, attendance management, and test creation will appear here</p>
      </div>
    </div>
  );
}
