// ============================================================
// api/auth.ts — Auth endpoint functions
// ============================================================
// All calls to /auth/* live here.
// Components call these functions — they never call apiClient
// directly. This is the same thin-route / fat-service pattern
// from the backend, applied to the frontend.
// ============================================================

import apiClient from './client';
import type { LoginRequest, TokenResponse } from '@/types';

// POST /auth/login
// Returns the JWT token + role on success.
// Throws a normalized Error (from the interceptor) on failure.
export async function loginApi(data: LoginRequest): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>('/auth/login', data);
  return response.data;
}
