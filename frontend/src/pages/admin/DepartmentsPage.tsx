// ============================================================
// pages/admin/DepartmentsPage.tsx — Department Analytics View
// ============================================================
// Departments are enum values (not DB entities), so no CRUD.
// This page is a read-only performance view per department.

import { type JSX } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Building2, Users, BarChart3 } from 'lucide-react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { ChartCard } from '@/components/admin/ChartCard';

const DEPT_LABELS: Record<string, string> = {
  cse:   'Computer Science',
  ece:   'Electronics & Comm.',
  mech:  'Mechanical',
  civil: 'Civil',
  eee:   'Electrical & Electronics',
  it:    'Information Technology',
  aids:  'AI & Data Science',
};

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];

export default function DepartmentsPage(): JSX.Element {
  const { dashboard, analytics, trends, isLoading } = useAdminDashboard();

  const deptPerfMap = Object.fromEntries(
    (analytics?.department_performance ?? []).map(d => [d.department, d])
  );

  const deptKeys = Object.keys(dashboard?.students.by_department ?? {});

  const barData = trends?.dept_student_distribution.map(x => ({
    name:     x.dept.toUpperCase(),
    students: x.count,
    label:    DEPT_LABELS[x.dept] ?? x.dept.toUpperCase(),
  })) ?? [];

  const cgpaData = (analytics?.department_performance ?? [])
    .filter(d => d.avg_cgpa != null)
    .map(d => ({ name: d.department.toUpperCase(), cgpa: d.avg_cgpa! }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Departments</h2>
        <p className="mt-1 text-sm text-gray-500">
          Institution-wide analytics broken down by academic department
        </p>
      </div>

      {/* Department cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-3 h-5 w-5 animate-pulse rounded-full bg-gray-100" />
                <div className="mb-2 h-7 w-20 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-36 animate-pulse rounded bg-gray-100" />
              </div>
            ))
          : deptKeys.map((dept, i) => {
              const count = dashboard!.students.by_department[dept] ?? 0;
              const perf  = deptPerfMap[dept];
              return (
                <div
                  key={dept}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex rounded-xl p-2" style={{ background: `${COLORS[i % COLORS.length]}15` }}>
                      <Building2 className="h-5 w-5" style={{ color: COLORS[i % COLORS.length] }} />
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 uppercase">
                      {dept}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                  <p className="text-sm font-semibold text-gray-700">{DEPT_LABELS[dept] ?? dept}</p>
                  <div className="mt-2 space-y-0.5">
                    {perf?.avg_cgpa != null && (
                      <p className="text-xs text-gray-400">Avg CGPA: <span className="font-medium text-gray-600">{perf.avg_cgpa.toFixed(2)}</span></p>
                    )}
                    {perf?.avg_attendance_pct != null && (
                      <p className="text-xs text-gray-400">Avg Attendance: <span className="font-medium text-gray-600">{perf.avg_attendance_pct.toFixed(1)}%</span></p>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Students per Department" subtitle="Total enrolled students">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  formatter={(v, _n, props) => [v, props?.payload?.label ?? '']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="students" radius={[6,6,0,0]}>
                  {barData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">No data</div>
          )}
        </ChartCard>

        <ChartCard title="Average CGPA by Department" subtitle="From published semester results">
          {cgpaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cgpaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="cgpa" radius={[6,6,0,0]}>
                  {cgpaData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">No CGPA data yet</div>
          )}
        </ChartCard>
      </div>

      {/* Faculty distribution */}
      {dashboard && Object.keys(dashboard.faculty.by_department).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Faculty Distribution</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(dashboard.faculty.by_department).map(([dept, count], i) => (
              <div key={dept} className="flex items-center gap-2.5 rounded-xl bg-gray-50 p-3">
                <Users className="h-4 w-4 flex-shrink-0" style={{ color: COLORS[i % COLORS.length] }} />
                <div>
                  <p className="text-sm font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 uppercase">{dept}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
