// Pure delivery helpers for dispatch-notifications (tested in tests/job-communication.test.cjs).
export const MAX_ATTEMPTS = 8;

/** Exponential backoff: 1, 2, 4 … minutes, capped at 60. Returns null when we should give up. */
export function nextRetryAt(attempts, now = Date.now()) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const minutes = Math.min(60, 2 ** Math.max(0, attempts - 1));
  return new Date(now + minutes * 60_000).toISOString();
}

/** Flat payload for the existing Zapier webhook (same style as services/zapier.ts). */
export function zapierPayload(row, appUrlScheme = 'arboristdogapp') {
  return {
    event: 'appointment_notification',
    notification_id: row.notification_id,
    kind: row.kind,
    urgent: row.is_urgent,
    title: row.title,
    body: row.body,
    recipient_name: row.full_name,
    recipient_email: row.email,
    recipient_phone: row.phone,
    appointment_id: row.appointment_id,
    deep_link: row.appointment_id ? `${appUrlScheme}://appointment/${row.appointment_id}` : null,
    timestamp: new Date().toISOString(),
  };
}
