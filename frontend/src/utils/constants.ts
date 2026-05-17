// ============================================================
// utils/constants.ts — App-wide constants
// ============================================================
// All magic strings live here. Never hardcode "student" in
// a comparison — use ROLES.STUDENT. One place to change,
// every consumer updates automatically.
// ============================================================

import type { UserRole } from '@/types';

// User role constants
// Using `as const` instead of enum — erasableSyntaxOnly is
// enabled in tsconfig, which disallows TypeScript enums.
export const ROLES = {
  STUDENT: 'student' as UserRole,
  FACULTY: 'faculty' as UserRole,
  ADMIN:   'admin'   as UserRole,
} as const;

// Route path constants
// Centralised here so if we ever restructure routes,
// it's one file change, not a grep-and-replace across 30 files.
export const ROUTES = {
  LOGIN:             '/login',
  STUDENT_DASHBOARD: '/student/dashboard',
  FACULTY_DASHBOARD: '/faculty/dashboard',
  ADMIN_DASHBOARD:   '/admin/dashboard',
} as const;

// LocalStorage keys — prefixed with 'sce_' to avoid clashes
// with other apps on the same domain during development.
export const STORAGE_KEYS = {
  TOKEN: 'sce_token',
  USER:  'sce_user',
} as const;

// Returns the default dashboard route for a given role.
// Used after login and in ProtectedRoute wrong-role redirects.
export function getDashboardRoute(role: UserRole): string {
  const map: Record<UserRole, string> = {
    student: ROUTES.STUDENT_DASHBOARD,
    faculty: ROUTES.FACULTY_DASHBOARD,
    admin:   ROUTES.ADMIN_DASHBOARD,
  };
  return map[role];
}
