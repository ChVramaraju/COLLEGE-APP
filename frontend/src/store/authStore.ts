// ============================================================
// store/authStore.ts — Authentication State
// ============================================================
// Manages the global auth state using React Context + useReducer.
//
// WHY Context + useReducer instead of useState?
//   → useReducer enforces a strict state machine.
//     Only explicit action types can change state.
//     Impossible to accidentally set isAuthenticated=true
//     without also setting user and token.
//
// WHY Context instead of prop drilling?
//   → Auth state is needed in: ProtectedRoute, Sidebar,
//     Navbar, every API call via the Axios interceptor.
//     Passing it through props across 20+ components = chaos.
//     Context makes it available anywhere in the tree.
//
// STATE LIFECYCLE:
//   1. App mounts → isLoading = true
//   2. Check localStorage for saved token
//   3a. Token valid  → RESTORE action → isLoading = false, isAuthenticated = true
//   3b. Token missing/expired → LOGOUT action → isLoading = false, isAuthenticated = false
//   4. User logs in → LOGIN action → isAuthenticated = true, redirect
//   5. User logs out → LOGOUT action → clear storage, redirect to /login
// ============================================================

import { createContext, useContext } from 'react';
import type { AuthUser, UserRole, JwtPayload } from '@/types';

// ---------------------------------------------------------------
// STATE SHAPE
// ---------------------------------------------------------------
export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;     // true only during initial session restoration
}

// ---------------------------------------------------------------
// ACTIONS — the only valid state transitions
// ---------------------------------------------------------------
type AuthAction =
  | { type: 'LOGIN';   payload: { user: AuthUser; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE'; payload: { user: AuthUser; token: string } }
  | { type: 'DONE_LOADING' };

// ---------------------------------------------------------------
// REDUCER — pure function, no side effects
// ---------------------------------------------------------------
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
    case 'RESTORE':
      return {
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'DONE_LOADING':
      return { ...state, isLoading: false };
  }
}

export const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,    // start as true — we haven't checked localStorage yet
};

// ---------------------------------------------------------------
// CONTEXT — exposes state + actions to the component tree
// ---------------------------------------------------------------
export interface AuthContextValue extends AuthState {
  login: (token: string, role: UserRole) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------
// JWT UTILITIES
// ---------------------------------------------------------------

// Decode JWT payload without a library.
// JWTs are base64url(header).base64url(payload).signature
// We only need the payload — no verification needed here
// (the backend verifies on every API request).
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

// Returns true if the token's exp claim is in the future.
export function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  // exp is Unix seconds; Date.now() is milliseconds
  return payload.exp * 1000 > Date.now();
}

// Extract user_id from JWT sub claim.
export function getUserIdFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  return payload?.sub ?? '';
}

// ---------------------------------------------------------------
// HOOK — the only way components should access auth state
// ---------------------------------------------------------------
// Throws if used outside AuthProvider — catches configuration
// mistakes immediately at development time.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
