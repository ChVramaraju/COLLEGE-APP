// ============================================================
// pages/auth/LoginPage.tsx — Universal Login
// ============================================================
// One login page for all roles (student, faculty, admin).
// The backend determines the role from the username — the
// frontend just redirects based on what comes back.
//
// Form state: controlled inputs + loading + error.
// On success: call auth.login() → ProtectedRoute redirects.
// On failure: show the error message from the API.
// ============================================================

import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { loginApi } from '@/api/auth';
import { useAuth } from '@/store/authStore';
import { getDashboardRoute } from '@/utils/constants';

export default function LoginPage() {
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Where to go after login — respects the `from` state set by ProtectedRoute
  const from = (location.state as { from?: { pathname: string } } | null)
    ?.from?.pathname;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError(null);
    setIsLoading(true);

    try {
      const response = await loginApi({ username: username.trim(), password });
      login(response.access_token, response.role);
      // Navigate to: where they were trying to go, or default dashboard
      navigate(from ?? getDashboardRoute(response.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: Branding ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-sm text-center">
          {/* Logo */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>

          <h1 className="mb-3 text-4xl font-bold tracking-tight">
            Smart College<br />Ecosystem
          </h1>
          <p className="mb-10 text-lg text-white/70">
            Empowering campus life through unified digital management
          </p>

          {/* Feature list */}
          <div className="space-y-3 text-left">
            {[
              { icon: '🎓', label: 'Student Portal', desc: 'Attendance, results & placement' },
              { icon: '👨‍🏫', label: 'Faculty Portal', desc: 'Classes, assessments & notes' },
              { icon: '⚙️', label: 'Admin Console', desc: 'Manage users, analytics & more' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-white/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: Login Form ───────────────────────────── */}
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Smart College Ecosystem</span>
          </div>

          {/* Card */}
          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sign in with your student roll number, employee ID, or admin username
              </p>
            </div>

            {/* Error alert */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. 21CSE001 / FAC2024001 / admin"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 rounded-lg bg-gray-50 p-3.5">
              <p className="text-xs font-medium text-gray-600 mb-1.5">Demo Credentials</p>
              <div className="space-y-1 text-xs text-gray-500 font-mono">
                <div>Admin: <span className="text-gray-700">admin / Admin@1234</span></div>
                <div>Faculty: <span className="text-gray-700">FAC2024001 / Faculty@1234</span></div>
                <div>Student: <span className="text-gray-700">21CSE001 / Student@1234</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
