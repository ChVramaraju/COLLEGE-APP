// ============================================================
// pages/admin/DashboardPage.tsx — Super Admin Control Center
// ============================================================

import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, GraduationCap, Briefcase, BarChart3, Building2,
  ClipboardList, Bell, CalendarCheck, Megaphone, Plus,
  Activity, UserCheck,
} from 'lucide-react';
import { useAuth } from '@/store/authStore';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useNotifications } from '@/hooks/useNotifications';
import { StatCard } from '@/components/admin/StatCard';
import { ChartCard } from '@/components/admin/ChartCard';

const DEPT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
const GPA_COLORS  = ['#10b981','#6366f1','#f59e0b','#ef4444','#94a3b8'];

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60); if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AdminDashboardPage() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const { dashboard, analytics, trends, activity, isLoading } = useAdminDashboard();
  const { notifications, unreadCount } = useNotifications();

  const d = dashboard;

  // ── Stat card values ────────────────────────────────────────
  const stats = [
    { title: 'Total Students',  value: d?.students.total_students   ?? '—', sub: `${d?.students.active_students ?? '—'} active`,     Icon: GraduationCap, color: 'indigo'  as const },
    { title: 'Total Faculty',   value: d?.faculty.total_faculty     ?? '—', sub: `${d?.faculty.active_faculty  ?? '—'} active`,     Icon: Users,         color: 'emerald' as const },
    { title: 'Total Users',     value: d?.users.total_users         ?? '—', sub: `${d?.users.inactive_users    ?? '—'} inactive`,   Icon: UserCheck,     color: 'blue'    as const },
    { title: 'Sections',        value: d?.sections.total            ?? '—', sub: 'Active academic units',                           Icon: Building2,     color: 'purple'  as const },
    { title: 'Tests Published', value: d?.tests.published_tests     ?? '—', sub: `${d?.tests.total_attempts    ?? '—'} attempts`,   Icon: ClipboardList, color: 'amber'   as const },
    { title: 'Avg Attendance',  value: d ? `${d.attendance.institution_avg_percentage.toFixed(1)}%` : '—', sub: `${d?.attendance.below_75_count ?? '—'} below threshold`, Icon: CalendarCheck, color: 'cyan' as const },
    { title: 'Notifications',   value: d?.notifications.total_sent  ?? '—', sub: `${d?.notifications.unread_count ?? '—'} unread`, Icon: Bell,          color: 'rose'    as const },
    { title: 'Avg Test Score',  value: d ? `${d.tests.avg_score_percentage.toFixed(1)}%` : '—', sub: `${d?.tests.total_tests ?? '—'} total tests`,     Icon: BarChart3,  color: 'slate'   as const },
  ];

  // ── Chart data ──────────────────────────────────────────────
  const deptData     = trends?.dept_student_distribution.map(x => ({ name: x.dept.toUpperCase(), students: x.count })) ?? [];
  const monthlyData  = trends?.monthly_data ?? [];
  const gpaData      = trends ? Object.entries(trends.gpa_distribution).map(([k, v]) => ({ name: k, value: v })) : [];

  // Activity feed = recent WS notifications (admin receives) + system activity
  const feedItems = [
    ...notifications.slice(0, 5).map(n => ({ id: n.id, title: n.title, message: n.message, created_at: n.created_at, type: n.notification_type })),
    ...activity.slice(0, 5).map(a => ({ id: a.id * -1, title: a.title, message: a.message, created_at: a.created_at, type: a.notification_type })),
  ].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()).slice(0, 8);

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Console</h2>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, <span className="font-medium text-gray-700">{user?.userId}</span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {unreadCount} new
              </span>
            )}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/admin/announcements')}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Megaphone className="h-4 w-4" /> Announce
          </button>
          <button
            onClick={() => navigate('/admin/placement/create-job')}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Briefcase className="h-4 w-4" /> Post Job
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Users className="h-4 w-4" /> Manage Users
          </button>
          <button
            onClick={() => navigate('/admin/sections')}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add Section
          </button>
        </div>
      </div>

      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <StatCard key={s.title} {...s} loading={isLoading} />
        ))}
      </div>

      {/* ── Charts row ────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Monthly trends line chart */}
        <ChartCard
          title="6-Month Activity Trends"
          subtitle="Notifications · Attendance · Test attempts"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="notifications_count"      name="Notifications" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="attendance_records_count" name="Attendance"    stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="test_attempts_count"      name="Test Attempts" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* GPA distribution pie */}
        <ChartCard title="GPA Distribution" subtitle="All published semester results">
          {gpaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={gpaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {gpaData.map((_, i) => (
                    <Cell key={i} fill={GPA_COLORS[i % GPA_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">No result data yet</div>
          )}
        </ChartCard>
      </div>

      {/* ── Department bar + Activity feed ────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* Department student distribution */}
        <ChartCard title="Students by Department" subtitle="All enrolled students" className="lg:col-span-2">
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="students" radius={[6,6,0,0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">No department data yet</div>
          )}
        </ChartCard>

        {/* Live activity feed */}
        <ChartCard title="Live Activity" subtitle="Recent system events" action={
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
        }>
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
            {feedItems.length === 0 ? (
              <div className="flex h-full items-center justify-center py-8 text-sm text-gray-400">No activity yet</div>
            ) : feedItems.map((item, i) => (
              <div key={`${item.id}-${i}`} className="flex items-start gap-2 rounded-xl bg-gray-50 p-2.5">
                <Activity className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-400">{timeAgo(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── Top performers + Low attendance ───────────────────── */}
      {analytics && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Top performers */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Top Performers</h3>
            {analytics.top_performers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No results published yet</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {analytics.top_performers.slice(0, 5).map((p, i) => (
                  <div key={p.student_id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-100 text-slate-600' :
                        i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                      }`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.full_name || p.roll_number}</p>
                        <p className="text-xs text-gray-400">{p.department.toUpperCase()}</p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      CGPA {p.cgpa?.toFixed(2) ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low attendance */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
              Low Attendance Alert
              {analytics.low_attendance_students.length > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-bold text-rose-700">
                  {analytics.low_attendance_students.length}
                </span>
              )}
            </h3>
            {analytics.low_attendance_students.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">All students above threshold 🎉</p>
            ) : (
              <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: 200 }}>
                {analytics.low_attendance_students.slice(0, 8).map(s => (
                  <div key={s.student_id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{s.roll_number}</span>
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                      s.attendance_pct < 60
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {s.attendance_pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
