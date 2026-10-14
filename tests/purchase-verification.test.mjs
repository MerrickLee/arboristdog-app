import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedGrants, PACK_ID, MONTHLY_ID } from '../supabase/functions/sync-purchases/verification.mjs';
const now = Date.parse('2026-10-05');
const subscription = { store: 'app_store', is_sandbox: false, purchase_date: '2026-10-01', original_purchase_date: '2026-09-01', expires_date: '2026-11-01' };
const customer = (sub = subscription) => ({ subscriptions: { [MONTHLY_ID]: sub }, entitlements: { monthly_scans: { product_identifier: MONTHLY_ID } } });
test('expired, refunded and wrong-store subscriptions cannot grant scans', () => {
  for (const patch of [{expires_date:'2026-10-01'}, {refunded_at:'2026-10-02'}, {store:'promotional'}]) {
    assert.equal(verifiedGrants(customer({...subscription,...patch}), false, 'monthly_scans', now).grants.length, 0);
  }
});
test('sandbox requires explicit server opt-in for TestFlight', () => {
  const info = customer({...subscription,is_sandbox:true});
  assert.equal(verifiedGrants(info,false,'monthly_scans',now).subscriptionActive,false);
  assert.equal(verifiedGrants(info,true,'monthly_scans',now).grants[0].amount,10);
});
test('cancellation preserves access until expiry; grace period remains active', () => {
  assert.equal(verifiedGrants(customer({...subscription,unsubscribe_detected_at:'2026-10-03'}),false,'monthly_scans',now).subscriptionActive,true);
  assert.equal(verifiedGrants(customer({...subscription,expires_date:'2026-10-01',grace_period_expires_date:'2026-10-08'}),false,'monthly_scans',now).subscriptionActive,true);
});
test('repeated syncs use stable ledger keys; renewal changes key', () => {
  const first = verifiedGrants(customer(),false,'monthly_scans',now).grants[0];
  assert.deepEqual(first,verifiedGrants(customer(),false,'monthly_scans',now).grants[0]);
  assert.notEqual(first.transaction,verifiedGrants(customer({...subscription,purchase_date:'2026-10-04'}),false,'monthly_scans',now).grants[0].transaction);
});
test('unknown products and invalid consumables are ignored', () => {
  const info = { non_subscriptions: { unknown:[{id:'other',store:'app_store'}], [PACK_ID]: [{id:'paid',store:'app_store'}, {id:'fake',store:'promotional'}, {store:'app_store'}, {id:'test',store:'app_store',is_sandbox:true}] } };
  assert.deepEqual(verifiedGrants(info,false,'monthly_scans',now).grants,[{transaction:'app_store:paid',product:PACK_ID,amount:3}]);
});

test('a consumable entitlement alone cannot count as a subscription', () => {
  assert.equal(verifiedGrants({entitlements:{monthly_scans:{product_identifier:PACK_ID}}},false,'monthly_scans',now).subscriptionActive,false);
});
