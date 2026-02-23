import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

export type AuthErrorCode =
  | 'err_invalid_credentials'
  | 'err_email_not_confirmed'
  | 'err_rate_limit'
  | 'err_already_registered'
  | 'err_no_user_id'
  | 'err_auto_login_failed'
  | 'err_register_failed'
  | 'err_login_failed';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, fallback?: string) {
    super(fallback || code);
    this.code = code;
  }
}

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  showLogoutConfirm: boolean;
  setShowLogoutConfirm: (show: boolean) => void;
  adjustCoins: (delta: number) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  showLogoutConfirm: false,

  setShowLogoutConfirm: (show) => set({ showLogoutConfirm: show }),

  adjustCoins: (delta) => {
    const u = get().user;
    if (u) set({ user: { ...u, coins_balance: Math.max(0, u.coins_balance + delta) } });
  },

  initialize: async () => {
    if (!import.meta.env.VITE_SUPABASE_URL) {
      set({ isLoading: false });
      return;
    }

    const timeout = setTimeout(() => {
      console.warn('[PT] init timeout');
      set({ isLoading: false });
    }, 5000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await get().fetchProfile();
    } catch (e) {
      console.error('[PT] init:', e);
    } finally {
      clearTimeout(timeout);
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') await get().fetchProfile();
      else if (event === 'SIGNED_OUT') set({ user: null, isAuthenticated: false });
    });
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login')) throw new AuthError('err_invalid_credentials');
      if (error.message.includes('Email not confirmed')) throw new AuthError('err_email_not_confirmed');
      throw new AuthError('err_login_failed', error.message);
    }
    await get().fetchProfile();
  },

  register: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } },
    });
    if (error) {
      if (error.message.includes('rate limit')) throw new AuthError('err_rate_limit');
      if (error.message.includes('already registered')) throw new AuthError('err_already_registered');
      throw new AuthError('err_register_failed', error.message);
    }

    if (data.user?.identities?.length === 0) {
      throw new AuthError('err_already_registered');
    }

    const userId = data.user?.id;
    if (!userId) throw new AuthError('err_no_user_id');

    if (!data.session) {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        if (loginErr.message.includes('Email not confirmed')) throw new AuthError('err_email_not_confirmed');
        throw new AuthError('err_auto_login_failed');
      }
    }

    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 500));
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (profile) {
        set({ user: profile as Profile, isAuthenticated: true });
        return;
      }
    }

    throw new AuthError('err_register_failed', 'Profile creation timeout');
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, showLogoutConfirm: false });
  },

  fetchProfile: async () => {
    try {
      const { data: { user: au } } = await supabase.auth.getUser();
      if (!au) { set({ user: null, isAuthenticated: false }); return; }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', au.id).single();
      if (profile) {
        set({ user: profile as Profile, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
