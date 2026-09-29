// mob_app/src/context/AuthContext.js
// Authentication state manager — mirrors frontend/src/context/AuthContext.jsx
// Uses SecureStore for persistent JWT storage across app restarts with fail-safe startup timeouts.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);  // true = checking stored token on startup

  // Safe SecureStore helpers
  const safeGetToken = async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn(`[AuthContext] Error reading ${key} from SecureStore:`, e?.message);
      return null;
    }
  };

  const safeSetToken = async (key, val) => {
    try {
      await SecureStore.setItemAsync(key, val);
    } catch (e) {
      console.warn(`[AuthContext] Error saving ${key} to SecureStore:`, e?.message);
    }
  };

  const safeDeleteToken = async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn(`[AuthContext] Error deleting ${key} from SecureStore:`, e?.message);
    }
  };

  // ── Fetch current user profile with fail-safe timeout ─────────────────────
  const fetchMe = useCallback(async () => {
    try {
      const token = await safeGetToken('access_token');
      if (!token) {
        setUser(null);
        await safeDeleteToken('cached_user');
        return null;
      }

      // 15-second timeout for verification against cloud backend
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth check timeout')), 15000)
      );

      const res = await Promise.race([
        client.get('/auth/me'),
        timeoutPromise,
      ]);

      if (res?.data && res.data.id) {
        setUser(res.data);
        await safeSetToken('cached_user', JSON.stringify(res.data));
        return res.data;
      } else {
        setUser(null);
        await safeDeleteToken('access_token');
        await safeDeleteToken('refresh_token');
        await safeDeleteToken('cached_user');
        return null;
      }
    } catch (err) {
      console.warn('[AuthContext] Session verification skipped/failed:', err?.message);
      // Only reset user and delete tokens if explicitly unauthorized (401/403)
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setUser(null);
        await safeDeleteToken('access_token');
        await safeDeleteToken('refresh_token');
        await safeDeleteToken('cached_user');
      }
      return null;
    }
  }, []);

  // ── Unified Login ────────────────────────────────────────────────────────
  const login = useCallback(async ({ identifier, password, school_slug }) => {
    const res = await client.post('/auth/login', {
      identifier,
      password,
      school_slug: school_slug || undefined,
    });
    const { access_token, refresh_token, user: userData } = res.data;
    if (access_token) {
      await safeSetToken('access_token', access_token);
    }
    if (refresh_token) {
      await safeSetToken('refresh_token', refresh_token);
    }
    if (userData) {
      await safeSetToken('cached_user', JSON.stringify(userData));
    }
    setUser(userData);
    return userData;
  }, []);

  // ── Student Direct Portal Login ──────────────────────────────────────────
  const studentLogin = useCallback(async ({ phone, name, password, father_name }) => {
    const payload = { phone, name, password };
    if (father_name) payload.father_name = father_name;
    const res = await client.post('/auth/student-login', payload);
    const { access_token, refresh_token, user: userData } = res.data;
    if (access_token) {
      await safeSetToken('access_token', access_token);
    }
    if (refresh_token) {
      await safeSetToken('refresh_token', refresh_token);
    }
    if (userData) {
      await safeSetToken('cached_user', JSON.stringify(userData));
    }
    setUser(userData);
    return userData;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch { /* best-effort */ }
    await safeDeleteToken('access_token');
    await safeDeleteToken('refresh_token');
    await safeDeleteToken('cached_user');
    setUser(null);
  }, []);

  // ── On mount: restore session safely ──────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const [token, cachedUserStr] = await Promise.all([
          safeGetToken('access_token'),
          safeGetToken('cached_user'),
        ]);
        if (token && cachedUserStr && mounted) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            if (cachedUser && cachedUser.id) {
              setUser(cachedUser);
              setLoading(false);
            }
          } catch { /* ignore parse errors */ }
        }
      } finally {
        fetchMe().finally(() => {
          if (mounted) setLoading(false);
        });
      }
    };
    initAuth();
    return () => { mounted = false; };
  }, [fetchMe]);

  const value = {
    user,
    role: user?.role ? String(user.role).toUpperCase() : null,
    loading,
    login,
    studentLogin,
    logout,
    fetchMe,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
