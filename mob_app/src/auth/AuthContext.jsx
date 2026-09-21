import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../api/services/authService';
import { storage } from './storage';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on app launch
  const restoreSession = async () => {
    try {
      const token = await storage.get('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // First hydrate from cached user for instant UX
      const cached = await storage.get('cached_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {}
      }

      // Fetch fresh /auth/me from live backend
      const freshUser = await authService.getMe();
      if (freshUser && freshUser.id) {
        setUser(freshUser);
      } else {
        await storage.clear();
        setUser(null);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        await storage.clear();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    restoreSession();

    const handleForceLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth-logout', handleForceLogout);
    return () => window.removeEventListener('auth-logout', handleForceLogout);
  }, []);

  const login = async (identifier, password) => {
    const data = await authService.login(identifier, password);
    setUser(data.user);
    return data.user;
  };

  const studentLogin = async (phone, name, password, fatherName = '') => {
    const data = await authService.studentLogin(phone, name, password, fatherName);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const fresh = await authService.getMe();
      if (fresh && fresh.id) {
        setUser(fresh);
      }
    } catch (e) {
      // keep existing
    }
  };

  // Determine role string cleanly
  const role = user?.role || user?.active_role?.name || user?.active_role?.role || 'STUDENT';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: String(role).toUpperCase(),
        loading,
        login,
        studentLogin,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
