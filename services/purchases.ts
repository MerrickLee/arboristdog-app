import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';

export const initPurchases = async () => {
  if (!REVENUECAT_API_KEY) {
    console.warn("RevenueCat API Key not found. Purchases will not be initialized.");
    return;
  }

  try {
    // In a real app, you might have different keys for iOS and Android
    // For now, we use the provided key for both or as a fallback
    await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    console.log("[Purchases] RevenueCat initialized successfully");
  } catch (error) {
    console.error("[Purchases] Failed to initialize RevenueCat:", error);
  }
};

/**
 * Fetch the current offerings from RevenueCat
 */
export const getAvailableOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error("[Purchases] Error fetching offerings:", error);
    return null;
  }
};

/**
 * Perform a purchase of a specific package
 */
export const purchasePackage = async (pack: any) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pack);
    return { success: true, customerInfo };
  } catch (error: any) {
    if (!error.userCancelled) {
      console.error("[Purchases] Error during purchase:", error);
    }
    return { success: false, error: error.message, cancelled: error.userCancelled };
  }
};

/**
 * Restore previous purchases
 */
export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, customerInfo };
  } catch (error) {
    console.error("[Purchases] Error restoring purchases:", error);
    return { success: false, error };
  }
};

