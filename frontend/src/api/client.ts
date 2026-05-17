// ============================================================
// api/client.ts — Centralized Axios HTTP Client
// ============================================================
// ONE Axios instance used by every API function.
//
// WHY centralized?
//   → Base URL defined once. Change backend URL = 1 line.
//   → Auth header injected automatically on every request.
//     No component ever writes Authorization: Bearer manually.
//   → Error handling normalized before components see it.
//   → Request/response logging in development, auto-disabled
//     in production.
//
// INTERCEPTOR LIFECYCLE:
//   Request  → inject Authorization header from localStorage
//   Response → on 401, clear auth + redirect to /login
//            → normalize error shape to ApiError
// ============================================================

import axios from 'axios';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';
import { STORAGE_KEYS } from '@/utils/constants';

// ---------------------------------------------------------------
// BASE URL
//
// In development (npm run dev):
//   Vite's proxy forwards /api/* to http://localhost:8000/*
//   So we set baseURL = '/api' — no CORS issues in dev.
//
// In production:
//   Set VITE_API_URL env var to your backend URL.
//   e.g. VITE_API_URL=https://my-backend.railway.app
//
// import.meta.env is Vite's way of reading .env variables.
// Vite only exposes variables prefixed with VITE_.
// ---------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// ---------------------------------------------------------------
// AXIOS INSTANCE
// ---------------------------------------------------------------
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,  // 15 seconds — fail fast, don't hang
});

// ---------------------------------------------------------------
// REQUEST INTERCEPTOR — inject auth token
//
// Runs BEFORE every request is sent.
// Reads the token from localStorage and attaches it.
//
// Why localStorage here instead of the auth context?
//   Axios interceptors run outside React's component lifecycle.
//   They cannot call useAuth() or any hook.
//   localStorage is the bridge between the React world and
//   the Axios world.
// ---------------------------------------------------------------
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------
// RESPONSE INTERCEPTOR — normalize errors + handle 401
//
// Runs AFTER every response (including errors).
//
// 401 Unauthorized:
//   Token expired or invalid. Clear auth state and redirect
//   to login. Using window.location.href (not React Router)
//   because this code runs outside the component tree.
//   A full page reload is acceptable here — it cleanly resets
//   all in-memory state.
//
// Other errors:
//   FastAPI returns { detail: "..." } on errors.
//   We extract that detail message so components get a
//   human-readable string, not a raw AxiosError object.
// ---------------------------------------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Extract FastAPI's detail message for clean error display
    const detail = error.response?.data?.detail;
    const message = typeof detail === 'string'
      ? detail
      : error.message ?? 'An unexpected error occurred';

    // Attach clean message to the error for components to use
    const normalizedError = new Error(message);
    return Promise.reject(normalizedError);
  }
);

export default apiClient;
