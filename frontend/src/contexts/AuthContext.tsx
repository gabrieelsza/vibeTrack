import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiService, getStoredToken, setStoredToken } from '../services/api.service';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_CACHE_KEY = 'vibetrack_cached_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY);
      return cached ? (JSON.parse(cached) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(true);

  const persistSession = useCallback((u: UserProfile | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiService
      .getMe()
      .then((res) => {
        persistSession(res.user);
      })
      .catch((err) => {
        // Se estiver offline, preserva a sessão local cacheada para leitura do histórico (RF-010)
        if (navigator.onLine && !String(err.message).includes('servidor')) {
          setStoredToken(null);
          persistSession(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [persistSession]);

  const login = async (email: string, password: string) => {
    const res = await apiService.login({ email, password });
    setStoredToken(res.token);
    persistSession({
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
    });
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await apiService.register({ name, email, password });
    setStoredToken(res.token);
    persistSession({
      id: res.user.id,
      name: res.user.name,
      email: res.user.email,
    });
  };

  const logout = () => {
    setStoredToken(null);
    persistSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return ctx;
}
