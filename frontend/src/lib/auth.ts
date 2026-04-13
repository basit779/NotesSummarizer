import { create } from 'zustand';
import { api } from './api';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'FREE' | 'PRO';
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,
  init: async () => {
    const token = localStorage.getItem('ss_token');
    const userRaw = localStorage.getItem('ss_user');
    if (token && userRaw) {
      set({ token, user: JSON.parse(userRaw) });
      try {
        const { data } = await api.get('/auth/me');
        set({ user: data.user });
        localStorage.setItem('ss_user', JSON.stringify(data.user));
      } catch {
        get().logout();
      }
    }
    set({ loading: false });
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('ss_token', data.token);
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },
  signup: async (name, email, password) => {
    const { data } = await api.post('/auth/signup', { name, email, password });
    localStorage.setItem('ss_token', data.token);
    localStorage.setItem('ss_user', JSON.stringify(data.user));
    set({ token: data.token, user: data.user });
  },
  logout: () => {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
    set({ token: null, user: null });
  },
  refresh: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user });
      localStorage.setItem('ss_user', JSON.stringify(data.user));
    } catch {
      /* ignore */
    }
  },
}));
