// ============================================================
// store/AuthProvider.tsx — React Context Provider (JSX)
// ============================================================
// This file is .tsx because it contains JSX.
// authStore.ts stays .ts for the pure logic (types, reducer,
// utilities, hook). This separation keeps .ts files JSX-free.
// ============================================================

import { useReducer, useEffect } from 'react';
import type { ReactNode, JSX } from 'react';
import {
  AuthContext,
  authReducer,
  initialState,
  isTokenValid,
  getUserIdFromToken,
} from '@/store/authStore';
import { STORAGE_KEYS } from '@/utils/constants';
import type { AuthUser, UserRole } from '@/types';

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // On mount: attempt to restore session from localStorage.
  // Runs ONCE. Prevents the logged-in-user flash-to-login.
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const savedUser  = localStorage.getItem(STORAGE_KEYS.USER);

    if (savedToken && savedUser && isTokenValid(savedToken)) {
      const user = JSON.parse(savedUser) as AuthUser;
      dispatch({ type: 'RESTORE', payload: { user, token: savedToken } });
    } else {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      dispatch({ type: 'DONE_LOADING' });
    }
  }, []);

  const login = (token: string, role: UserRole) => {
    const user: AuthUser = { userId: getUserIdFromToken(token), role };
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    dispatch({ type: 'LOGIN', payload: { user, token } });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
