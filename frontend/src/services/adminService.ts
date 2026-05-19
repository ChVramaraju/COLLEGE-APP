// ============================================================
// services/adminService.ts — Admin API Layer
// ============================================================
// Uses shared Axios client at @/api/client — never duplicated.
// Covers all admin-only endpoints plus section CRUD.
// ============================================================

import apiClient from '@/api/client';
import type {
  AdminDashboardData, InstitutionAnalytics, SystemHealth,
  TrendsData, ActivityItem, AdminUser, AnnouncementRequest,
  AnnouncementResponse, SectionItem, SectionCreateRequest,
  UserRole, CreateUserPayload, UpdateUserPayload,
  DeleteUserResponse, DepartmentsData,
} from '@/types/admin';

// ── Dashboard ─────────────────────────────────────────────────
export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const res = await apiClient.get<AdminDashboardData>('/admin/dashboard');
  return res.data;
}

// ── Analytics ─────────────────────────────────────────────────
export async function getInstitutionAnalytics(): Promise<InstitutionAnalytics> {
  const res = await apiClient.get<InstitutionAnalytics>('/admin/analytics');
  return res.data;
}

export async function getAnalyticsTrends(): Promise<TrendsData> {
  const res = await apiClient.get<TrendsData>('/admin/analytics/trends');
  return res.data;
}

// ── Activity feed ─────────────────────────────────────────────
export async function getActivityFeed(limit = 20): Promise<ActivityItem[]> {
  const res = await apiClient.get<ActivityItem[]>('/admin/activity', {
    params: { limit },
  });
  return res.data;
}

// ── System health ─────────────────────────────────────────────
export async function getSystemHealth(): Promise<SystemHealth> {
  const res = await apiClient.get<SystemHealth>('/admin/system-health');
  return res.data;
}

// ── User management ───────────────────────────────────────────
export async function listUsers(params: {
  role?:      UserRole | 'all';
  is_active?: boolean;
  skip?:      number;
  limit?:     number;
}): Promise<AdminUser[]> {
  const { role, is_active, skip = 0, limit = 50 } = params;
  const res = await apiClient.get<AdminUser[]>('/admin/users', {
    params: {
      ...(role && role !== 'all'     ? { role }      : {}),
      ...(is_active !== undefined    ? { is_active }  : {}),
      skip,
      limit,
    },
  });
  return res.data;
}

export async function toggleUserStatus(
  userId: number,
  isActive: boolean,
): Promise<AdminUser> {
  const res = await apiClient.patch<AdminUser>(`/admin/users/${userId}/status`, {
    is_active: isActive,
  });
  return res.data;
}

// ── Announcements ─────────────────────────────────────────────
export async function sendAnnouncement(
  data: AnnouncementRequest,
): Promise<AnnouncementResponse> {
  const res = await apiClient.post<AnnouncementResponse>('/admin/announcements', data);
  return res.data;
}

// ── Sections ──────────────────────────────────────────────────
export async function listSections(params?: {
  department?: string;
  semester?:   number;
}): Promise<SectionItem[]> {
  const res = await apiClient.get<SectionItem[]>('/sections/', { params });
  return res.data;
}

export async function createSection(
  data: SectionCreateRequest,
): Promise<SectionItem> {
  const res = await apiClient.post<SectionItem>('/sections/', data);
  return res.data;
}

export async function updateSection(
  id:   number,
  data: { incharge_faculty_id?: number | null; max_strength?: number },
): Promise<SectionItem> {
  const res = await apiClient.patch<SectionItem>(`/sections/${id}`, data);
  return res.data;
}

// ── User CRUD ──────────────────────────────────────────────────
export async function adminCreateUser(payload: CreateUserPayload): Promise<AdminUser> {
  const res = await apiClient.post<AdminUser>('/admin/users', payload);
  return res.data;
}

export async function adminUpdateUser(
  userId:  number,
  payload: UpdateUserPayload,
): Promise<AdminUser> {
  const res = await apiClient.put<AdminUser>(`/admin/users/${userId}`, payload);
  return res.data;
}

export async function adminResetPassword(
  userId:      number,
  newPassword: string,
): Promise<AdminUser> {
  const res = await apiClient.post<AdminUser>(`/admin/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return res.data;
}

export async function adminDeleteUser(userId: number): Promise<DeleteUserResponse> {
  const res = await apiClient.delete<DeleteUserResponse>(`/admin/users/${userId}`);
  return res.data;
}

// ── Departments & designations ─────────────────────────────────
export async function getDepartmentsData(): Promise<DepartmentsData> {
  const res = await apiClient.get<DepartmentsData>('/admin/departments');
  return res.data;
}
