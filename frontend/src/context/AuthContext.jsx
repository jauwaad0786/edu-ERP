// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

export const AuthContext = createContext(null);  // ✅ ADDED export

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Single source of truth for (re)loading the current user from /auth/me.
  // Reused both on mount and by refreshUser() below.
  const fetchMe = () => {
    return api.get('/auth/me')
      .then(res => {
        if (res.data && res.data.id) {
          setUser(res.data);
        } else {
          localStorage.clear();
          setUser(null);
        }
      })
      .catch(err => {
        if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404) {
          localStorage.clear();
          setUser(null);
        }
      });
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe().finally(() => setLoading(false));
  }, []);

  // Fix: Principal ne Staff Access page se kisi ka permission grant/revoke
  // kiya, lekin us staff member ka tab pehle se khula hua tha -- user
  // object sirf mount pe fetch hota tha, isliye naya access dikhne ke liye
  // pehle full logout/login karna padta tha. Ab tab pe wapas aane par
  // silently /auth/me refetch ho jaata hai taaki permissions (aur unse
  // dynamic bana Sidebar) khud-ba-khud sync ho jaayein.
  useEffect(() => {
    const onFocus = () => {
      if (localStorage.getItem('access_token')) fetchMe();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const refreshUser = () => fetchMe();

  const login = async (identifier, password) => {
    const { data } = await api.post('/auth/login', { identifier, password });
    localStorage.setItem('access_token',  data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user;
  };

  const studentLogin = async (name, fatherName, phone, password) => {
    const { data } = await api.post('/auth/student-login', {
      name, father_name: fatherName, phone, password,
    });
    localStorage.setItem('access_token',  data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user;
  };

  const otpLogin = async (identifier, otp) => {
    const { data } = await api.post('/auth/verify-otp', { identifier, otp });
    localStorage.setItem('access_token',  data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, otpLogin, studentLogin, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
