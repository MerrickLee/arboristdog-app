import { create } from 'zustand';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  zip_code?: string;
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
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  setHasOnboarded: (status) =>
    set((state) => ({ user: state.user ? { ...state.user, has_onboarded: status } : null })),
}));
