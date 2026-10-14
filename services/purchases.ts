import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

let initialization: Promise<void> | undefined;
export const initPurchases = (): Promise<void> => {
  if (initialization) return initialization;
  initialization = (async () => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('Purchases require a native app build.');
    const apiKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    if (!apiKey || /placeholder|your_.*_here/.test(apiKey)) throw new Error('Purchases are temporarily unavailable. Please try again later.');
    Purchases.configure({ apiKey });
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
};

export const identifyPurchases = async (userId: string) => {
  await initPurchases();
  if (await Purchases.getAppUserID() !== userId) await Purchases.logIn(userId);
};

export const clearPurchaseIdentity = async () => {
  if (!initialization) return;
  await initialization;
  if (!(await Purchases.isAnonymous())) await Purchases.logOut();
};

export const hasActiveSubscription = (info: CustomerInfo) =>
  Boolean(info.entitlements.active[process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'premium_access']) &&
  info.activeSubscriptions.includes('com.almstead.arboristdog.monthly');

export const getAvailableOfferings = async (userId: string) => {
  await identifyPurchases(userId);
  return (await Purchases.getOfferings()).current;
};

export const getPurchaseStatus = async (userId: string) => {
  await identifyPurchases(userId);
  await Purchases.invalidateCustomerInfoCache();
  return Purchases.getCustomerInfo();
};

export const purchasePackage = async (pack: PurchasesPackage, userId: string) => {
  try {
    await identifyPurchases(userId);
    const { customerInfo } = await Purchases.purchasePackage(pack);
    return { success: true, customerInfo };
  } catch (error: unknown) {
    const purchaseError = error as { message?: string; userCancelled?: boolean };
    return { success: false, error: purchaseError.message, cancelled: purchaseError.userCancelled };
  }
};

export const restorePurchases = async (userId: string) => {
  await identifyPurchases(userId);
  return Purchases.restorePurchases();
};
