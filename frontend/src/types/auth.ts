// ============================================================
// types/auth.ts — Auth domain types
// ============================================================
// These mirror backend schemas/auth.py exactly.
// If backend TokenResponse changes, update here first —
// TypeScript will surface every affected component immediately.
// ============================================================

export type UserRole = 'student' | 'faculty' | 'admin';

// What the frontend sends to POST /auth/login
export interface LoginRequest {
  username: string;
  password: string;
}

// What the backend returns on successful login
// Mirrors backend TokenResponse schema
export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
}

// Decoded JWT payload (standard JWT claims + our custom sub)
export interface JwtPayload {
  sub: string;       // user_id as string
  exp: number;       // expiry timestamp (Unix seconds)
}

// The user object we store in auth context after login
export interface AuthUser {
  userId: string;    // decoded from JWT sub
  role: UserRole;    // from TokenResponse.role
}
