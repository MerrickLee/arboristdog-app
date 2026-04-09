import { supabase } from './supabase';

/**
 * Add credits to a user's account in Supabase
 * @param userId The ID of the authenticated user
 * @param amount Number of credits to add
 */
export const syncPurchasedCredits = async (userId: string, amount: number) => {
  try {
    const { data, error } = await supabase.rpc('add_credits', {
      user_id: userId,
      amount: amount
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("[Credits] Failed to sync credits with database:", error);
    return { success: false, error };
  }
};

/**
 * Fetch the latest credit balance from Supabase
 */
export const getLatestBalance = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return { success: true, balance: data.balance };
  } catch (error) {
    console.error("[Credits] Failed to fetch balance:", error);
    return { success: false, error };
  }
};
