// ============================================================
// pages/admin/AnnouncementsPage.tsx — Create & Send Announcements
// ============================================================

import { useState, type JSX, type FormEvent } from 'react';
import {
  Megaphone, Users, GraduationCap, Send, CheckCircle,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import { sendAnnouncement } from '@/services/adminService';
import type { AnnouncementAudience } from '@/types/admin';

interface AudienceOption {
  value:  AnnouncementAudience;
  label:  string;
  sub:    string;
  Icon:   typeof Users;
  color:  string;
  bg:     string;
}

const AUDIENCES: AudienceOption[] = [
  { value: 'all',     label: 'Everyone',      sub: 'All active users on the platform',  Icon: Users,         color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
  { value: 'student', label: 'Students Only',  sub: 'All active student accounts',       Icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { value: 'faculty', label: 'Faculty Only',   sub: 'All active faculty accounts',       Icon: Users,         color: 'text-amber-600',   bg: 'bg-amber-50'   },
];

const NOTIF_TYPES = [
  { value: 'announcement',    label: '📣 Announcement' },
  { value: 'general',         label: '💬 General'      },
  { value: 'placement_update',label: '💼 Placement'    },
] as const;

export default function AnnouncementsPage(): JSX.Element {
  const [title,        setTitle]        = useState('');
  const [message,      setMessage]      = useState('');
  const [audience,     setAudience]     = useState<AnnouncementAudience>('all');
  const [notifType,    setNotifType]    = useState<string>('announcement');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<{ count: number; msg: string } | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const resp = await sendAnnouncement({
        title:             title.trim(),
        message:           message.trim(),
        audience,
        notification_type: notifType,
      });
      setResult({ count: resp.recipients_count, msg: resp.message });
      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send announcement.');
    } finally {
      setLoading(false);
    }
  }

  const selectedAudience = AUDIENCES.find(a => a.value === audience)!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Announcements</h2>
        <p className="mt-1 text-sm text-gray-500">
          Send real-time notifications to all users, students, or faculty
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Compose panel */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-gray-800">Compose Announcement</h3>
            </div>

            {/* Success */}
            {result && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Announcement Sent!</p>
                  <p className="mt-0.5 text-sm text-emerald-600">{result.msg}</p>
                  <p className="mt-0.5 text-xs text-emerald-500">{result.count} recipient{result.count !== 1 ? 's' : ''} notified in real-time</p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-xl bg-rose-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Title *</label>
                <input
                  required
                  maxLength={100}
                  placeholder="e.g. Campus closed on Monday"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{title.length}/100</p>
              </div>

              {/* Message */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Message *</label>
                <textarea
                  required
                  maxLength={500}
                  rows={5}
                  placeholder="Write your announcement here…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
                />
                <p className="mt-1 text-right text-xs text-gray-400">{message.length}/500</p>
              </div>

              {/* Notification type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-700">Category</label>
                <div className="relative">
                  <select
                    value={notifType}
                    onChange={e => setNotifType(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    {NOTIF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <selectedAudience.Icon className="h-3.5 w-3.5" />
                  Sending to: <span className="font-semibold text-gray-600">{selectedAudience.label}</span>
                </div>
                <button
                  type="submit"
                  disabled={loading || !title.trim() || !message.trim()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {loading
                    ? 'Sending…'
                    : <><Send className="h-4 w-4" /> Send Announcement</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Audience selector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-800">Target Audience</h3>
            <div className="space-y-2">
              {AUDIENCES.map(a => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    audience === a.value
                      ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex-shrink-0 rounded-lg p-1.5 ${a.bg}`}>
                    <a.Icon className={`h-4 w-4 ${a.color}`} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${audience === a.value ? 'text-indigo-800' : 'text-gray-800'}`}>
                      {a.label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{a.sub}</p>
                  </div>
                  {audience === a.value && (
                    <CheckCircle className="ml-auto h-4 w-4 flex-shrink-0 text-indigo-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Info card */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Real-time delivery</p>
                <p className="mt-1 text-xs text-amber-700">
                  Recipients with active browser tabs will see the notification instantly via WebSocket.
                  Offline users will receive it the next time they open the app.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
