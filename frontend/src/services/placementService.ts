// ============================================================
// services/placementService.ts — Placement API Layer
// ============================================================
// All calls prefix to /placement — matches backend router.
// ============================================================

import apiClient from '@/api/client';
import type {
  JobPosting, PlacementApplication, PlacementAnalytics,
  JobPostingCreate, ApplicationStatus,
} from '@/types/placement';

// ── Student API ───────────────────────────────────────────────

export async function getJobPostings(activeOnly = true): Promise<JobPosting[]> {
  const res = await apiClient.get<JobPosting[]>('/placement/postings/', {
    params: { active_only: activeOnly, limit: 100 },
  });
  return res.data;
}

export async function getJobPosting(id: number): Promise<JobPosting> {
  const res = await apiClient.get<JobPosting>(`/placement/postings/${id}`);
  return res.data;
}

export async function applyToJob(jobPostingId: number): Promise<PlacementApplication> {
  const res = await apiClient.post<PlacementApplication>('/placement/apply', { job_posting_id: jobPostingId });
  return res.data;
}

export async function withdrawApplication(applicationId: number): Promise<PlacementApplication> {
  const res = await apiClient.delete<PlacementApplication>(
    `/placement/applications/${applicationId}/withdraw`,
  );
  return res.data;
}

export async function getMyApplications(): Promise<PlacementApplication[]> {
  const res = await apiClient.get<PlacementApplication[]>('/placement/applications/me');
  return res.data;
}

// ── Admin API ─────────────────────────────────────────────────

export async function createJobPosting(data: JobPostingCreate): Promise<JobPosting> {
  const res = await apiClient.post<JobPosting>('/placement/postings/', data);
  return res.data;
}

export async function updateJobPosting(id: number, data: Partial<JobPostingCreate> & { is_open?: boolean; is_active?: boolean }): Promise<JobPosting> {
  const res = await apiClient.patch<JobPosting>(`/placement/postings/${id}`, data);
  return res.data;
}

export async function deleteJobPosting(id: number): Promise<{ message: string; id: number }> {
  const res = await apiClient.delete<{ message: string; id: number }>(`/placement/postings/${id}`);
  return res.data;
}

export async function getJobApplications(
  jobId: number,
  statusFilter?: ApplicationStatus,
): Promise<PlacementApplication[]> {
  const res = await apiClient.get<PlacementApplication[]>(
    `/placement/postings/${jobId}/applications`,
    { params: statusFilter ? { status_filter: statusFilter } : {} },
  );
  return res.data;
}

export async function updateApplicationStatus(
  applicationId: number,
  status: ApplicationStatus,
  remarks: string | null = null,
): Promise<PlacementApplication> {
  const res = await apiClient.patch<PlacementApplication>(
    `/placement/applications/${applicationId}/status`,
    { status, remarks },
  );
  return res.data;
}

export async function deleteApplication(applicationId: number): Promise<void> {
  await apiClient.delete(`/placement/applications/${applicationId}`);
}

export async function getPlacementAnalytics(): Promise<PlacementAnalytics> {
  const res = await apiClient.get<PlacementAnalytics>('/placement/analytics');
  return res.data;
}
