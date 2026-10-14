import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.102.1';
import { verifiedGrants } from './verification.mjs';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    const key = Deno.env.get('REVENUECAT_API_KEY') || Deno.env.get('REVENUECAT_SECRET_API_KEY');
    if (!key) throw new Error('Purchase verification is not configured');
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error('Purchase verification unavailable');
    const { subscriber } = await response.json();
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const allowSandbox = Deno.env.get('REVENUECAT_ALLOW_SANDBOX') === 'true';
    let creditsAdded = 0;
    const grant = async (transaction: string, product: string, amount: number) => {
      const { data, error } = await admin.rpc('grant_verified_purchase', { p_user_id: user.id, p_transaction: transaction, p_product: product, p_amount: amount });
      if (error) throw error;
      creditsAdded += data;
    };
    const { grants, subscriptionActive } = verifiedGrants(subscriber, allowSandbox, Deno.env.get('REVENUECAT_ENTITLEMENT_ID') || 'premium_access');
    for (const purchase of grants) await grant(purchase.transaction, purchase.product, purchase.amount);
    const { data: balance, error: balanceError } = await admin.from('user_credits').select('balance').eq('user_id', user.id).single();
    if (balanceError) throw balanceError;
    return new Response(JSON.stringify({ success: true, balance: balance.balance, creditsAdded, subscriptionActive }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Unable to verify purchases. Please try again shortly.' }), { status: 503, headers });
  }
});
