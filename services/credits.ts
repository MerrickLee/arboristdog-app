import { supabase } from './supabase';

/** The server verifies RevenueCat transactions and grants each purchase only once. */
export const syncPurchasedCredits = async () => {
  const { data, error } = await supabase.functions.invoke('sync-purchases');
  if (error || !data?.success) throw new Error('Your payment is saved, but your scan balance could not be refreshed. Please try Restore Purchases shortly.');
  return data as { success: true; balance: number; creditsAdded: number; subscriptionActive: boolean };
};

export const getLatestBalance = async (userId: string) => {
  const { data, error } = await supabase.from('user_credits').select('balance').eq('user_id', userId).single();
  if (error) throw error;
  return data.balance as number;
};
