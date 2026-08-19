import { create } from 'zustand';
import { supabase } from '../services/supabase';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  zip_code?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  property_type?: 'residential' | 'commercial';
  coordinates?: { lat: number; lng: number };
  in_target_area?: boolean;
  is_almstead_customer: boolean;
  has_onboarded: boolean;
  onboarding_answers?: any;
}

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setHasOnboarded: (status: boolean) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setHasOnboarded: (status) =>
    set((state) => ({ user: state.user ? { ...state.user, has_onboarded: status } : null })),
  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) {
        console.error('[AuthStore] Failed to update profile:', error.message);
        return false;
      }
      set({ user: { ...user, ...updates } });
      return true;
    } catch (err) {
      console.error('[AuthStore] Update profile error:', err);
      return false;
    }
  },
}));
