// ============================================================
// pages/admin/UsersPage.tsx — Full User Administration Console
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, UserCheck, UserX, Users,
  Filter, UserPlus, MoreVertical,
  Pencil, KeyRound, Trash2, CheckCircle,
} from 'lucide-react';
import { useUserManagement } from '@/hooks/useUserManagement';
import { ConfirmDialog }      from '@/components/admin/ConfirmDialog';
import { CreateUserModal }    from '@/components/admin/CreateUserModal';
import { EditUserModal }      from '@/components/admin/EditUserModal';
import { ResetPasswordModal } from '@/components/admin/ResetPasswordModal';
import type { AdminUser, UserRole, CreateUserPayload, UpdateUserPayload } from '@/types/admin';

// ── Constants ─────────────────────────────────────────────────
const ROLE_BADGE: Record<UserRole, string> = {
  student: 'bg-indigo-100 text-indigo-700',
  faculty: 'bg-emerald-100 text-emerald-700',
  admin:   'bg-rose-100   text-rose-700',
};

const AVATAR_BG: Record<UserRole, string> = {
  student: 'bg-indigo-500',
  faculty: 'bg-emerald-500',
  admin:   'bg-rose-500',
};

function initials(name: string | null, username: string): string {
  const src = name?.trim() || username;
  const parts = src.split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

// ── Row action menu ───────────────────────────────────────────
// Uses position:fixed for the dropdown so it is NEVER clipped
// by the table container's overflow:hidden.  A single openId at
// the page level guarantees only one menu is open at a time and
// prevents stale per-row state after list re-renders.
type RowAction = 'edit' | 'reset' | 'toggle' | 'delete';

interface ActionMenuProps {
  user:        AdminUser;
  onAction:    (u: AdminUser, a: RowAction) => void;
  openId:      number | null;
  dropdownPos: { top: number; right: number };
  onOpen:      (userId: number, pos: { top: number; right: number }) => void;
  onClose:     () => void;
}

function ActionMenu({ user, onAction, openId, dropdownPos, onOpen, onClose }: ActionMenuProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const isOpen = openId === user.id;

  function handleToggle() {
    if (isOpen) { onClose(); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      onOpen(user.id, { top: r.bottom + 4, right: window.innerWidth - r.right });
    }
  }

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleToggle}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        aria-label="User actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Full-screen dismiss layer — z-30 so it sits above table */}
          <div className="fixed inset-0 z-30" onClick={onClose} />

          {/* Dropdown — fixed, above dismiss layer */}
          <div
            className="fixed z-40 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            <button
              onClick={() => { onClose(); onAction(user, 'edit'); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5 text-gray-400" /> Edit Profile
            </button>
            <button
              onClick={() => { onClose(); onAction(user, 'reset'); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <KeyRound className="h-3.5 w-3.5 text-gray-400" /> Reset Password
            </button>
            <button
              onClick={() => { onClose(); onAction(user, 'toggle'); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {user.is_active
                ? <><UserX className="h-3.5 w-3.5 text-amber-500" /> Deactivate</>
                : <><UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Activate</>
              }
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              onClick={() => { onClose(); onAction(user, 'delete'); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete User
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function UsersPage() {
  const {
    users, isLoading, error, total,
    search, roleFilter, statusFilter,
    setSearch, setRoleFilter, setStatusFilter,
    toggleStatus, createUser, updateUser, resetPassword, deleteUser,
  } = useUserManagement();

  // ── Action menu — page-level (one open at a time, fixed-position) ──
  const [openMenuId,   setOpenMenuId]   = useState<number | null>(null);
  const [dropdownPos,  setDropdownPos]  = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const handleMenuOpen = useCallback((userId: number, pos: { top: number; right: number }) => {
    setDropdownPos(pos);
    setOpenMenuId(userId);
  }, []);

  const handleMenuClose = useCallback(() => setOpenMenuId(null), []);

  // Close menu on any scroll (prevents stale position)
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, []);

  // modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);

  // confirm dialogs
  const [toggleConfirm, setToggleConfirm] = useState<{ id: number; current: boolean } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const [deleteError, setDeleteError]     = useState('');

  // success banners
  const [successMsg, setSuccessMsg] = useState('');

  function flash(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  }

  // ── Action dispatcher ──────────────────────────────────────────
  function onAction(u: AdminUser, action: RowAction) {
    if (action === 'edit')   setEditTarget(u);
    if (action === 'reset')  setResetTarget(u);
    if (action === 'toggle') setToggleConfirm({ id: u.id, current: u.is_active });
    if (action === 'delete') { setDeleteError(''); setDeleteConfirm(u); }
  }

  // ── Create ────────────────────────────────────────────────────
  const handleCreate = async (payload: CreateUserPayload) => {
    await createUser(payload);
    flash(`User @${payload.username} created successfully.`);
  };

  // ── Edit ──────────────────────────────────────────────────────
  const handleEdit = async (id: number, payload: UpdateUserPayload) => {
    await updateUser(id, payload);
    flash('User profile updated.');
  };

  // ── Reset password ────────────────────────────────────────────
  const handleReset = async (id: number, pw: string) => {
    await resetPassword(id, pw);
    flash('Password reset successfully.');
  };

  // ── Toggle status ─────────────────────────────────────────────
  function handleToggleConfirm() {
    if (!toggleConfirm) return;
    toggleStatus(toggleConfirm.id, toggleConfirm.current);
    flash(toggleConfirm.current ? 'User deactivated.' : 'User activated.');
    setToggleConfirm(null);
  }

  // ── Delete ────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteUser(deleteConfirm.id);
      flash(`User @${deleteConfirm.username} removed.`);
      setDeleteConfirm(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Delete failed.');
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount   = users.filter(u => u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            {total} total · {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Create User
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, username, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-64"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {(['all', 'student', 'faculty', 'admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r as UserRole | 'all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                roleFilter === r ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
          <Filter className="h-3.5 w-3.5" />
          {users.length} shown
        </div>
      </div>

      {/* Fetch error */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-500">No users match your filters</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 text-sm font-medium text-indigo-600 hover:underline"
            >
              Create the first user →
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">User</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Email</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Role</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Joined</th>
                <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  {/* Avatar + name */}
                  <td className="py-3 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${AVATAR_BG[u.role]}`}>
                        {initials(u.full_name, u.username)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.full_name || u.username}</p>
                        <p className="text-xs text-gray-400">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500">{u.email ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-400">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right">
                    <ActionMenu
                      user={u}
                      onAction={onAction}
                      openId={openMenuId}
                      dropdownPos={dropdownPos}
                      onOpen={handleMenuOpen}
                      onClose={handleMenuClose}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEdit}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSubmit={handleReset}
        />
      )}

      {/* Toggle status confirm */}
      <ConfirmDialog
        open={toggleConfirm !== null}
        title={toggleConfirm?.current ? 'Deactivate User?' : 'Activate User?'}
        message={
          toggleConfirm?.current
            ? 'This user will no longer be able to log in. Their data is preserved.'
            : 'This user will regain access to the platform.'
        }
        confirmLabel={toggleConfirm?.current ? 'Deactivate' : 'Activate'}
        danger={toggleConfirm?.current}
        onConfirm={handleToggleConfirm}
        onCancel={() => setToggleConfirm(null)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Remove User?"
        message={
          deleteError
            ? deleteError
            : `@${deleteConfirm?.username ?? ''} will be deactivated and removed from view.`
        }
        confirmLabel={deleting ? 'Removing…' : 'Remove'}
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteConfirm(null); setDeleteError(''); }}
      />
    </div>
  );
}
