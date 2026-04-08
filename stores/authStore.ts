import { create } from 'zustand';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  auth_method: string;
  is_almstead_customer: boolean;
  has_onboarded: boolean;
}

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  setHasOnboarded: (status: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  setHasOnboarded: (status) =>
    set((state) => ({ user: state.user ? { ...state.user, has_onboarded: status } : null })),
}));
