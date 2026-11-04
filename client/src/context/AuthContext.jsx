import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hometech_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const notify = useCallback((message, type = 'info') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refreshServices = useCallback(async () => {
    try {
      const { data } = await api.get('/services');
      if (Array.isArray(data)) setServices(data);
    } catch (err) {
      console.warn('Could not load services from API:', err.message);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/categories');
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.warn('Could not load categories:', err.message);
    }
  }, []);

  // Fetch current user from server on load to keep roles and status fresh
  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('hometech_token');
      if (!token) {
        setLoadingUser(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data);
        localStorage.setItem('hometech_user', JSON.stringify(data));
      } catch (err) {
        console.warn('Auth check failed:', err.message);
        localStorage.removeItem('hometech_token');
        localStorage.removeItem('hometech_user');
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    }
    checkAuth();
    refreshServices();
    refreshCategories();
  }, [refreshServices, refreshCategories]);

  const login = (payload) => {
    localStorage.setItem('hometech_token', payload.token);
    localStorage.setItem('hometech_user', JSON.stringify(payload.user));
    setUser(payload.user);
    notify(`Welcome back, ${payload.user.name}!`, 'success');
  };

  const logout = () => {
    localStorage.removeItem('hometech_token');
    localStorage.removeItem('hometech_user');
    setUser(null);
    notify('Logged out successfully.');
  };

  // Switch Active Dashboard Role (Single Account, Dual Dashboard)
  const switchRole = async (targetRole) => {
    try {
      const { data } = await api.put('/auth/switch-role', { role: targetRole });
      localStorage.setItem('hometech_token', data.token);
      localStorage.setItem('hometech_user', JSON.stringify(data.user));
      setUser(data.user);
      notify(data.message, 'success');
      return true;
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to switch dashboard view.', 'danger');
      return false;
    }
  };

  const updateUser = (updated) => {
    setUser(updated);
    localStorage.setItem('hometech_user', JSON.stringify(updated));
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      switchRole,
      updateUser,
      services,
      categories,
      refreshServices,
      refreshCategories,
      notice,
      notify,
      loadingUser
    }),
    [user, services, categories, refreshServices, refreshCategories, notice, notify, loadingUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
