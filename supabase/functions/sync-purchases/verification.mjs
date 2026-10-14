export const PACK_ID = 'com.almstead.arboristdog.3credits';
export const MONTHLY_ID = 'com.almstead.arboristdog.monthly';

export function verifiedGrants(subscriber, allowSandbox, entitlementId, now = Date.now()) {
  const grants = [];
  for (const purchase of subscriber.non_subscriptions?.[PACK_ID] || []) {
    if (purchase.store !== 'app_store' || (purchase.is_sandbox && !allowSandbox) || purchase.refunded_at || !purchase.id) continue;
    grants.push({ transaction: `app_store:${purchase.id}`, product: PACK_ID, amount: 3 });
  }
  const subscription = subscriber.subscriptions?.[MONTHLY_ID];
  const entitlement = subscriber.entitlements?.[entitlementId];
  const expiry = Math.max(Date.parse(subscription?.expires_date || '') || 0, Date.parse(subscription?.grace_period_expires_date || '') || 0);
  const subscriptionActive = Boolean(subscription && entitlement && subscription.store === 'app_store' && !subscription.refunded_at && (!subscription.is_sandbox || allowSandbox) && expiry > now);
  if (subscriptionActive && subscription.purchase_date && subscription.original_purchase_date) {
    grants.push({ transaction: `subscription:${MONTHLY_ID}:${subscription.original_purchase_date}:${subscription.purchase_date}`, product: MONTHLY_ID, amount: 10 });
  }
  return { grants, subscriptionActive };
}
