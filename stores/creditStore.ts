import { create } from 'zustand';

interface CreditState {
  creditsRemaining: number;
  setCreditsRemaining: (credits: number) => void;
  decrementCredits: () => void;
  addCredits: (amount: number) => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  creditsRemaining: 3, // Default for new users
  setCreditsRemaining: (credits) => set({ creditsRemaining: credits }),
  decrementCredits: () => set((state) => ({ creditsRemaining: Math.max(0, state.creditsRemaining - 1) })),
  addCredits: (amount) => set((state) => ({ creditsRemaining: state.creditsRemaining + amount })),
}));
