// mob_app/src/context/AuthContext.js
// Authentication state manager — mirrors frontend/src/context/AuthContext.jsx
// Uses SecureStore for persistent JWT storage across app restarts.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);  // true = checking stored token on startup

  // ── Fetch current user profile ───────────────────────────────────────────
  const fetchMe = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        setUser(null);
        return null;
      }
      const res = await client.get('/auth/me');
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
      return null;
    }
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async ({ identifier, password, school_slug }) => {
    const res = await client.post('/auth/login', {
      identifier,
      password,
      school_slug: school_slug || undefined,
    });
    const { access_token, refresh_token, user: userData } = res.data;
    await SecureStore.setItemAsync('access_token', access_token);
    if (refresh_token) {
      await SecureStore.setItemAsync('refresh_token', refresh_token);
    }
    setUser(userData);
    return userData;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch { /* best-effort */ }
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    setUser(null);
  }, []);

  // ── On mount: restore session ─────────────────────────────────────────────
  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, [fetchMe]);

  const value = {
    user,
    loading,
    login,
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
