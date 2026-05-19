// ============================================================
// hooks/useUserManagement.ts — Full User CRUD + Filter State
// ============================================================
// Manages: list, search/filter, pagination, optimistic CRUD.
// All mutating operations throw on failure so callers can
// show per-form error messages without crashing the hook.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listUsers, toggleUserStatus,
  adminCreateUser, adminUpdateUser,
  adminResetPassword, adminDeleteUser,
} from '@/services/adminService';
import type {
  AdminUser, UserManagementState, UserRole,
  CreateUserPayload, UpdateUserPayload,
} from '@/types/admin';

const PAGE_SIZE = 50;

export function useUserManagement(): UserManagementState {
  const [users,        setUsers]        = useState<AdminUser[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [page,         setPage]         = useState(0);
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // ── Fetch list from backend ──────────────────────────────────
  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isActive =
        statusFilter === 'active'   ? true  :
        statusFilter === 'inactive' ? false : undefined;

      const data = await listUsers({
        role:      roleFilter,
        is_active: isActive,
        skip:      page * PAGE_SIZE,
        limit:     PAGE_SIZE,
      });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [page, roleFilter, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Client-side search (avoids extra API round-trips) ────────
  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      u.username.toLowerCase().includes(q)  ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q)
    );
  }, [users, search]);

  // ── Toggle active/inactive (optimistic + rollback) ───────────
  const toggleStatus = useCallback((id: number, current: boolean) => {
    const next = !current;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: next } : u));
    toggleUserStatus(id, next).catch(() => {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: current } : u));
    });
  }, []);

  // ── Create user — prepends to list on success ─────────────────
  const createUser = useCallback(async (payload: CreateUserPayload): Promise<AdminUser> => {
    const created = await adminCreateUser(payload);   // throws on failure
    setUsers(prev => [created, ...prev]);
    return created;
  }, []);

  // ── Update user — optimistic name/email update ────────────────
  const updateUser = useCallback(async (
    id:      number,
    payload: UpdateUserPayload,
  ): Promise<AdminUser> => {
    const snapshot = users.find(u => u.id === id);
    // Optimistic
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...payload } : u));
    try {
      const updated = await adminUpdateUser(id, payload);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
      return updated;
    } catch (err) {
      // Rollback
      if (snapshot) setUsers(prev => prev.map(u => u.id === id ? snapshot : u));
      throw err;
    }
  }, [users]);

  // ── Reset password — no optimistic UI needed ──────────────────
  const resetPassword = useCallback(async (
    id:          number,
    newPassword: string,
  ): Promise<void> => {
    await adminResetPassword(id, newPassword);   // throws on failure
  }, []);

  // ── Delete (soft) user — removes from list optimistically ─────
  const deleteUser = useCallback(async (id: number): Promise<void> => {
    const snapshot = users;
    setUsers(prev => prev.filter(u => u.id !== id));
    try {
      await adminDeleteUser(id);
    } catch (err) {
      setUsers(snapshot);   // rollback
      throw err;
    }
  }, [users]);

  return {
    users:         filtered,
    isLoading,
    error,
    total:         users.length,
    page,
    search,
    roleFilter,
    statusFilter,
    setPage,
    setSearch,
    setRoleFilter,
    setStatusFilter,
    toggleStatus,
    createUser,
    updateUser,
    resetPassword,
    deleteUser,
    refetch:       fetch,
  };
}
