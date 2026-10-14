const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-ts.cjs');

const safety = loadTypeScript('utils/jobSafety.ts');
const tracking = loadTypeScript('utils/crewTracking.ts');
const { createOutbox, isPermanentServerError } = loadTypeScript('utils/messageOutbox.ts');

test('free text that says not to cut or start is upgraded to a blocking instruction', () => {
  assert.equal(safety.effectiveCategory('general', 'Please do NOT cut the oak'), 'scope_change');
  assert.equal(safety.effectiveCategory('pet_alert', "dog is out, don't start yet"), 'do_not_start');
  assert.equal(safety.effectiveCategory('reschedule', 'Actually please cancel'), 'cancellation');
  assert.equal(safety.effectiveCategory('do_not_start', 'thanks'), 'do_not_start', 'never downgraded');
  assert.equal(safety.effectiveCategory('general', 'Our dog will be inside'), 'pet_alert');
  assert.equal(safety.effectiveCategory('general', 'See you at 9'), 'general');
});

test('urgency and visibility follow role and category', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  assert.equal(safety.isUrgentMessage('reschedule', '2026-10-15T09:00:00Z', now), true);
  assert.equal(safety.isUrgentMessage('reschedule', '2026-10-20T09:00:00Z', now), false);
  assert.equal(safety.isUrgentMessage('scope_change', '2026-10-20T09:00:00Z', now), true);
  assert.equal(safety.messageVisibility('customer', 'team'), 'shared');
  assert.equal(safety.messageVisibility('crew', 'shared'), 'team');
  assert.equal(safety.messageVisibility('office', 'team'), 'team');
});

const crew = { user_id: 'crew', assignment_role: 'crew', display_name: 'Cam', location_sharing: false, active: true };
const arborist = { user_id: 'arb', assignment_role: 'arborist', display_name: 'Ari', location_sharing: false, active: true };
const hold = { id: 'h1', appointment_id: 'a', message_id: 'm', kind: 'scope_change', summary: "Don't cut the oak", status: 'open', opened_at: '' };

test('work start blockers: open hold, every acknowledgement, pending change, crew present', () => {
  const base = { holds: [hold], acks: [], assignments: [crew, arborist], changeRequests: [{ id: 'c1', kind: 'scope_change', status: 'pending', details: '', created_at: '' }] };
  assert.deepEqual(safety.workStartBlockers(base).map(b => b.type).sort(), ['open_hold', 'pending_change', 'unacknowledged', 'unacknowledged']);

  const acked = { ...base, acks: [{ hold_id: 'h1', user_id: 'crew' }, { hold_id: 'h1', user_id: 'arb' }] };
  assert.deepEqual(safety.workStartBlockers(acked).map(b => b.type).sort(), ['open_hold', 'pending_change']);

  const resolved = { ...acked, holds: [{ ...hold, status: 'resolved' }], changeRequests: [{ ...base.changeRequests[0], status: 'approved' }] };
  assert.deepEqual(safety.workStartBlockers(resolved), []);

  // Reassignment: a new crew member has not acknowledged yet.
  const reassigned = { ...resolved, assignments: [{ ...crew, active: false }, arborist, { ...crew, user_id: 'new', display_name: 'Dee' }] };
  assert.deepEqual(safety.workStartBlockers(reassigned).map(b => b.type === 'unacknowledged' && b.userId), ['new']);

  assert.deepEqual(safety.workStartBlockers({ holds: [], acks: [], assignments: [arborist], changeRequests: [] }).map(b => b.type), ['no_crew_assigned']);
});

test('only team roles get status actions; only office can cancel', () => {
  assert.deepEqual(safety.statusActions('customer', 'scheduled'), []);
  assert.deepEqual(safety.statusActions('crew', 'arrived').map(a => a.to), ['in_progress']);
  assert.ok(!safety.statusActions('crew', 'scheduled').some(a => a.to === 'cancelled'));
  assert.ok(safety.statusActions('office', 'scheduled').some(a => a.to === 'cancelled'));
});

test('tracking shows live ETA only for a fresh, shared fix during the trip', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const property = { latitude: 40.98, longitude: -73.68 };
  const fix = { user_id: 'crew', latitude: 40.95, longitude: -73.70, recorded_at: '2026-10-14T11:59:30Z' };
  const live = tracking.trackingView({ status: 'en_route', sharingEnabled: true, locations: [fix], property, now });
  assert.equal(live.mode, 'live');
  assert.ok(live.etaMinutes >= 1 && live.etaMinutes < 30);

  assert.deepEqual(tracking.trackingView({ status: 'scheduled', sharingEnabled: true, locations: [fix], property, now }), { mode: 'hidden' });
  assert.deepEqual(tracking.trackingView({ status: 'arrived', sharingEnabled: true, locations: [fix], property, now }), { mode: 'arrived' });
  assert.equal(tracking.trackingView({ status: 'en_route', sharingEnabled: false, locations: [], property, now }).reason, 'not_shared');
  assert.equal(tracking.trackingView({ status: 'en_route', sharingEnabled: true, locations: [], property, now }).reason, 'no_signal');
  const stale = { ...fix, recorded_at: '2026-10-14T11:50:00Z' };
  assert.equal(tracking.trackingView({ status: 'en_route', sharingEnabled: true, locations: [stale], property, now }).reason, 'stale');
  assert.equal(tracking.trackingView({ status: 'en_route', sharingEnabled: true, locations: [fix], property: null, now }).reason, 'no_property_location');
});

function memoryOutbox(send, initial = []) {
  let stored = initial;
  const outbox = createOutbox({ load: async () => stored, save: async items => { stored = items; }, send });
  return { outbox, stored: () => stored };
}
const message = (id, createdAt) => ({ kind: 'message', id, appointmentId: 'a', body: id, category: 'general', visibility: 'shared', onBehalfOfCustomer: false, createdAt, attempts: 0 });

test('outbox keeps messages through network failures and delivers them in order', async () => {
  let online = false;
  const delivered = [];
  const { outbox, stored } = memoryOutbox(async item => {
    if (!online) throw new Error('Network request failed');
    delivered.push(item.id);
  });
  await outbox.enqueue(message('first', '2026-10-14T12:00:00Z'));
  await outbox.enqueue(message('second', '2026-10-14T12:00:01Z'));
  assert.deepEqual(stored().map(i => i.id), ['first', 'second']);
  assert.equal(stored()[0].failed, false);
  assert.equal(stored()[1].attempts, 0, 'later items wait instead of jumping the queue');

  online = true;
  await outbox.flush();
  assert.deepEqual(delivered, ['first', 'second']);
  assert.deepEqual(stored(), []);
});

test('outbox never silently drops a rejected message or acknowledgement', async () => {
  const rejected = Object.assign(new Error('Not authorized for this appointment'), { code: '42501' });
  assert.equal(isPermanentServerError(rejected), true);
  assert.equal(isPermanentServerError(new Error('Failed to fetch')), false);

  let reject = true;
  const { outbox, stored } = memoryOutbox(async item => { if (reject && item.kind === 'ack') throw rejected; });
  await outbox.enqueue({ kind: 'ack', id: 'hold-1', appointmentId: 'a', createdAt: '2026-10-14T12:00:00Z', attempts: 0 });
  await outbox.enqueue(message('after', '2026-10-14T12:00:01Z'));
  assert.deepEqual(stored().map(i => [i.id, i.failed]), [['hold-1', true]], 'kept and flagged; later message still sent');
  await outbox.enqueue({ kind: 'ack', id: 'hold-1', appointmentId: 'a', createdAt: '2026-10-14T12:00:02Z', attempts: 0 });
  assert.equal(stored().length, 1, 'duplicate enqueue is ignored');

  reject = false;
  await outbox.retry('ack', 'hold-1');
  assert.deepEqual(stored(), []);
});

test('notification delivery retries with capped backoff, then gives up visibly', async () => {
  const { nextRetryAt, zapierPayload, MAX_ATTEMPTS } = await import('../supabase/functions/dispatch-notifications/delivery.mjs');
  const now = Date.parse('2026-10-14T12:00:00Z');
  const minutesUntil = attempts => (Date.parse(nextRetryAt(attempts, now)) - now) / 60_000;
  assert.deepEqual([1, 2, 3, 4].map(minutesUntil), [1, 2, 4, 8]);
  assert.equal(minutesUntil(MAX_ATTEMPTS - 1), 60, 'capped at an hour');
  assert.equal(nextRetryAt(MAX_ATTEMPTS, now), null, 'caller marks the row failed instead of looping forever');

  const payload = zapierPayload({ notification_id: 'n1', kind: 'hold_opened', is_urgent: true, title: 'Do not start', body: "Don't cut the oak", full_name: 'Pat', email: 'p@x.com', phone: null, appointment_id: 'appt-1' });
  assert.equal(payload.deep_link, 'arboristdogapp://appointment/appt-1');
  assert.equal(payload.urgent, true);
  assert.equal(zapierPayload({ notification_id: 'n2', appointment_id: null }).deep_link, null);
});
