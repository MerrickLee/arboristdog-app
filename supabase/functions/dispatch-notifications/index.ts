// Delivers queued appointment notifications (public.notification_outbox) to the existing
// Zapier channel, which routes them to email/SMS. Invoke on a schedule (e.g. every minute
// via Supabase Cron) and/or from a Database Webhook on notification_outbox inserts.
// In-app notifications never depend on this function; it only adds the external channel.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";
import { nextRetryAt, zapierPayload } from "./delivery.mjs";

serve(async (req) => {
  const secret = Deno.env.get("DISPATCH_NOTIFICATIONS_SECRET");
  if (!secret || req.headers.get("x-dispatch-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const webhook = Deno.env.get("ZAPIER_NOTIFICATIONS_WEBHOOK_URL");
  if (!webhook) return new Response("Missing ZAPIER_NOTIFICATIONS_WEBHOOK_URL", { status: 500 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows, error } = await admin.rpc("claim_notification_outbox", { p_limit: 25 });
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(zapierPayload(row)),
      });
      if (!res.ok) throw new Error(`Zapier responded ${res.status}`);
      await admin.rpc("complete_notification_outbox", { p_id: row.outbox_id, p_success: true });
      sent++;
    } catch (e) {
      // Claimed rows already had attempts incremented; null retry time marks it failed for the office to review.
      await admin.rpc("complete_notification_outbox", {
        p_id: row.outbox_id, p_success: false, p_error: String(e), p_retry_at: nextRetryAt(row.attempts),
      });
      failed++;
    }
  }
  return new Response(JSON.stringify({ claimed: rows?.length ?? 0, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
