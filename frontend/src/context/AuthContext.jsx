import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/config';

const AuthContext = createContext(null);
const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const timeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const axiosAuth = useCallback(() => {
    const t = token || localStorage.getItem('athe_token');
    return axios.create({
      baseURL: API,
      headers: { Authorization: `Bearer ${t}` }
    });
  }, [token]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (token) {
      timeoutRef.current = setTimeout(() => {
        setSessionExpired(true);
      }, SESSION_TIMEOUT);
    }
  }, [token]);

  const logout = useCallback(async () => {
    try {
      const t = token || localStorage.getItem('athe_token');
      if (t) {
        await axios.post(`${API}/auth/logout`, {}, { headers: { Authorization: `Bearer ${t}` } });
      }
    } catch (e) { /* ignore */ }
    setUser(null);
    setToken(null);
    setSessionExpired(false);
    localStorage.removeItem('athe_token');
    localStorage.removeItem('athe_user');
    localStorage.removeItem('athe_view');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [token]);

  const login = useCallback((userData, tokenStr) => {
    setUser(userData);
    setToken(tokenStr);
    setSessionExpired(false);
    localStorage.setItem('athe_token', tokenStr);
    localStorage.setItem('athe_user', JSON.stringify(userData));
    resetTimer();
  }, [resetTimer]);

  const reconnect = useCallback(() => {
    setSessionExpired(false);
    resetTimer();
    // Send heartbeat
    const t = token || localStorage.getItem('athe_token');
    if (t) {
      axios.post(`${API}/heartbeat`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    }
  }, [token, resetTimer]);

  // Restore session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('athe_token');
    const savedUser = localStorage.getItem('athe_user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);
        // Verify token is still valid
        axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
          .then(res => {
            setUser(res.data.user);
            localStorage.setItem('athe_user', JSON.stringify(res.data.user));
          })
          .catch(() => {
            logout();
          });
      } catch (e) {
        logout();
      }
    }
    setLoading(false);
  }, []);

  // Activity listeners
  useEffect(() => {
    if (!token) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetTimer();
    events.forEach(e => window.addEventListener(e, handler));
    resetTimer();

    // Heartbeat every 60s
    const heartbeat = setInterval(() => {
      if (Date.now() - lastActivityRef.current < SESSION_TIMEOUT) {
        const t = token || localStorage.getItem('athe_token');
        if (t) {
          axios.post(`${API}/heartbeat`, {}, { headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
        }
      }
    }, 60000);

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearInterval(heartbeat);
    };
  }, [token, resetTimer]);

  return (
    <AuthContext.Provider value={{
      user, token, loading, sessionExpired,
      login, logout, reconnect, axiosAuth,
      API, BACKEND_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
