// ============================================================
// types/api.ts — Shared API response types
// ============================================================
// Generic envelope types that wrap any API response.
// Used by the Axios interceptor and service functions.
// ============================================================

// Shape of FastAPI's HTTPException response body
export interface ApiError {
  detail: string;
}

// Generic paginated response (for future list endpoints)
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
