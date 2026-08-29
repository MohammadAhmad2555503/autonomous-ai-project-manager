import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth as authAPI } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      sessionStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (credentials) => {
    const response = await authAPI.login(credentials);
    sessionStorage.removeItem('token');
    setUser(response.data.user);
    return response.data;
  };

  const signup = async (data) => {
    const response = await authAPI.signup(data);
    sessionStorage.removeItem('token');
    setUser(response.data.user);
    return response.data;
  };

  const logout = useCallback(() => {
    authAPI.logout().catch(() => {});
    sessionStorage.removeItem('token');
    setUser(null);
  }, []);

  const value = useCallback(() => ({ user, loading, login, signup, logout }), [user, loading, logout]);

  return (
    <AuthContext.Provider value={value()}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

