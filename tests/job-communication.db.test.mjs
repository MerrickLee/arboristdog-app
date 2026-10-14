// Database tests for supabase/migrations/20261014000000_job_communication.sql.
// Runs the real migration in PGlite (Postgres in WASM) with a minimal stand-in for
// Supabase's auth schema and roles, then exercises it as each user under RLS.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';

const require = createRequire(import.meta.url);
const { loadTypeScript } = require('./helpers/load-ts.cjs');
const safety = loadTypeScript('utils/jobSafety.ts');

const migration = fs.readFileSync(new URL('../supabase/migrations/20261014000000_job_communication.sql', import.meta.url), 'utf8');

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = {
  customer: id(1), office: id(2), arborist: id(3), crew: id(4), crew2: id(5), otherCustomer: id(6), outsiderCrew: id(7),
};
let db;
let seq = 1000;
const newId = () => id(++seq);

async function as(userId, fn) {
  return db.transaction(async tx => {
    await tx.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec('SET LOCAL ROLE authenticated');
    return fn(tx);
  });
}
const rows = async (userId, sql, params = []) => (await as(userId, tx => tx.query(sql, params))).rows;
const rpc = async (userId, sql, params = []) => (await rows(userId, sql, params))[0];
const admin = async (sql, params = []) => (await db.query(sql, params)).rows;

const send = (userId, appt, body, category = 'general', visibility = 'shared', onBehalf = false, msgId = newId()) =>
  rpc(userId, 'SELECT * FROM send_appointment_message($1, $2, $3, $4, $5, $6)', [msgId, appt, body, category, visibility, onBehalf]);
const setStatus = (userId, appt, status) => rpc(userId, 'SELECT * FROM set_appointment_status($1, $2)', [appt, status]);
const ack = (userId, hold) => rpc(userId, 'SELECT * FROM acknowledge_hold($1)', [hold]);
const blockers = async appt => (await admin('SELECT private.work_start_blockers($1) AS b', [appt]))[0].b;

/** Everything the office screen loads, fetched as the office user under RLS. */
async function officeSafetyView(appt) {
  const [holds, acks, assignments, changeRequests] = await Promise.all([
    rows(U.office, 'SELECT * FROM appointment_holds WHERE appointment_id = $1', [appt]),
    rows(U.office, 'SELECT k.* FROM hold_acknowledgements k JOIN appointment_holds h ON h.id = k.hold_id WHERE h.appointment_id = $1', [appt]),
    rows(U.office, 'SELECT * FROM appointment_assignments WHERE appointment_id = $1', [appt]),
    rows(U.office, 'SELECT * FROM appointment_change_requests WHERE appointment_id = $1', [appt]),
  ]);
  return { holds, acks, assignments, changeRequests };
}

/** Creates a fresh job + appointment tomorrow, assigned to the arborist and first crew member. */
async function createAppointment({ crew = [U.crew] } = {}) {
  const property = newId(); const job = newId(); const appt = newId();
  await admin(`INSERT INTO properties(id, customer_id, address, latitude, longitude) VALUES ($1, $2, '12 Oak Lane, Rye NY', 40.98, -73.68)`, [property, U.customer]);
  await admin(`INSERT INTO jobs(id, customer_id, property_id, title, scope) VALUES ($1, $2, $3, 'Tree pruning', 'Prune oak and maple')`, [job, U.customer, property]);
  await admin(`INSERT INTO appointments(id, job_id, service, window_start, window_end)
               VALUES ($1, $2, 'Tree pruning', now() + interval '1 day', now() + interval '1 day 2 hours')`, [appt, job]);
  await admin(`INSERT INTO appointment_assignments(appointment_id, user_id, assignment_role) VALUES ($1, $2, 'arborist')`, [appt, U.arborist]);
  for (const c of crew) await admin(`INSERT INTO appointment_assignments(appointment_id, user_id, assignment_role) VALUES ($1, $2, 'crew')`, [appt, c]);
  return appt;
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, full_name text, email text, phone text);
    GRANT SELECT ON public.profiles TO authenticated;
  `);
  await db.exec(migration);
  await admin(`INSERT INTO profiles(id, full_name, email) VALUES
    ('${U.customer}', 'Casey Customer', 'casey@example.com'), ('${U.office}', 'Olivia Office', 'o@almstead.com'),
    ('${U.arborist}', 'Ari Arborist', 'a@almstead.com'), ('${U.crew}', 'Cam Crew', 'c@almstead.com'),
    ('${U.crew2}', 'Dee Crew', 'd@almstead.com'), ('${U.otherCustomer}', 'Other Customer', 'x@example.com'),
    ('${U.outsiderCrew}', 'Una Unassigned', 'u@almstead.com')`);
  await admin(`INSERT INTO team_members(user_id, team_role, display_name, crew_name) VALUES
    ('${U.office}', 'office', 'Olivia (Office)', NULL), ('${U.arborist}', 'arborist', 'Ari', NULL),
    ('${U.crew}', 'crew', 'Cam', 'Crew 7'), ('${U.crew2}', 'crew', 'Dee', 'Crew 9'), ('${U.outsiderCrew}', 'crew', 'Una', 'Crew 2')`);
});

test('CRITICAL: "do not cut the tree" blocks work until arborist and crew acknowledge and the office resolves it', async () => {
  const appt = await createAppointment();

  // Customer writes free text without picking a category; the server still treats it as a stop instruction.
  const msg = await send(U.customer, appt, 'Please do not cut the big oak by the driveway.');
  assert.equal(msg.category, 'scope_change');
  assert.equal(msg.is_urgent, true);

  const [hold] = await rows(U.office, 'SELECT * FROM appointment_holds WHERE appointment_id = $1', [appt]);
  assert.equal(hold.kind, 'scope_change');
  assert.equal(hold.status, 'open');

  // Everyone responsible is told immediately; the customer is not notified about their own message.
  for (const user of [U.office, U.arborist, U.crew]) {
    const n = await rows(user, `SELECT * FROM notifications WHERE appointment_id = $1 AND kind = 'urgent_message'`, [appt]);
    assert.equal(n.length, 1, `urgent notification for ${user}`);
    assert.equal(n[0].is_urgent, true);
    const seen = await rows(user, 'SELECT id FROM appointment_messages WHERE id = $1', [msg.id]);
    assert.equal(seen.length, 1, `message visible to ${user}`);
  }
  assert.equal((await rows(U.customer, `SELECT * FROM notifications WHERE kind = 'urgent_message' AND appointment_id = $1`, [appt])).length, 0);
  const outbox = await admin(`SELECT o.* FROM notification_outbox o JOIN notifications n ON n.id = o.notification_id
                              WHERE n.appointment_id = $1 AND n.kind = 'urgent_message'`, [appt]);
  assert.equal(outbox.length, 3, 'urgent alerts are queued for the external channel too');

  // The message did not change the job: scope is untouched and a change request awaits a decision.
  const [job] = await rows(U.office, 'SELECT j.scope FROM jobs j JOIN appointments a ON a.job_id = j.id WHERE a.id = $1', [appt]);
  assert.equal(job.scope, 'Prune oak and maple');
  const [request] = await rows(U.office, 'SELECT * FROM appointment_change_requests WHERE appointment_id = $1', [appt]);
  assert.equal(request.status, 'pending');

  // Crew can drive there and arrive, but cannot start.
  await setStatus(U.crew, appt, 'en_route');
  await setStatus(U.crew, appt, 'arrived');
  await assert.rejects(setStatus(U.crew, appt, 'in_progress'), /WORK_BLOCKED/);

  // Office sees exactly who still has to acknowledge.
  let view = await officeSafetyView(appt);
  assert.deepEqual(safety.pendingAcknowledgements(view)[0].pending.map(a => a.user_id).sort(), [U.arborist, U.crew].sort());

  // Only the assigned team can acknowledge — not the office, not another crew.
  await assert.rejects(ack(U.office, hold.id), /Only the assigned arborist or crew/);
  await assert.rejects(ack(U.outsiderCrew, hold.id), /Only the assigned arborist or crew/);

  await ack(U.crew, hold.id);
  await ack(U.crew, hold.id); // idempotent (e.g. outbox retry)
  view = await officeSafetyView(appt);
  assert.deepEqual(safety.pendingAcknowledgements(view)[0].pending.map(a => a.user_id), [U.arborist]);
  await assert.rejects(setStatus(U.crew, appt, 'in_progress'), /WORK_BLOCKED/);

  await ack(U.arborist, hold.id);
  // Acknowledged is not the same as approved: the hold and change request are still open.
  assert.deepEqual((await blockers(appt)).map(b => b.split(':')[0]).sort(), ['open_hold', 'pending_change']);
  await assert.rejects(setStatus(U.crew, appt, 'in_progress'), /WORK_BLOCKED/);

  // Office routes it through the approval workflow.
  await assert.rejects(rpc(U.crew, 'SELECT * FROM decide_change_request($1, true, $2)', [request.id, 'ok']), /Not authorized/);
  await rpc(U.office, 'SELECT * FROM decide_change_request($1, true, $2)', [request.id, 'Oak by the driveway removed from scope.']);
  const [resolved] = await rows(U.crew, 'SELECT * FROM appointment_holds WHERE id = $1', [hold.id]);
  assert.equal(resolved.status, 'resolved');
  assert.match((await rows(U.office, 'SELECT scope FROM jobs WHERE id = (SELECT job_id FROM appointments WHERE id = $1)', [appt]))[0].scope, /Oak by the driveway removed/);

  // Client and server agree that work may now start, and it can.
  view = await officeSafetyView(appt);
  assert.deepEqual(safety.workStartBlockers(view), []);
  assert.deepEqual(await blockers(appt), []);
  const started = await setStatus(U.crew, appt, 'in_progress');
  assert.equal(started.status, 'in_progress');

  // Audit trail records who acknowledged and who changed the job.
  const events = await rows(U.office, 'SELECT event_type, actor_id, actor_role FROM appointment_events WHERE appointment_id = $1 ORDER BY id', [appt]);
  const acks = events.filter(e => e.event_type === 'hold_acknowledged');
  assert.deepEqual(acks.map(e => e.actor_id).sort(), [U.arborist, U.crew].sort());
  assert.ok(events.some(e => e.event_type === 'hold_opened' && e.actor_id === U.customer && e.actor_role === 'customer'));
  assert.ok(events.some(e => e.event_type === 'change_request_decided' && e.actor_id === U.office));
  assert.ok(events.some(e => e.event_type === 'status_changed' && e.actor_id === U.crew));
  const ackTimes = await rows(U.office, 'SELECT user_id, acknowledged_at FROM hold_acknowledgements WHERE hold_id = $1', [hold.id]);
  assert.equal(ackTimes.length, 2);
  assert.ok(ackTimes.every(a => a.acknowledged_at instanceof Date));

  // History cannot be rewritten.
  await assert.rejects(admin(`UPDATE appointment_messages SET body = 'edited' WHERE id = $1`, [msg.id]), /append-only/);
  await assert.rejects(admin(`DELETE FROM hold_acknowledgements WHERE hold_id = $1`, [hold.id]), /append-only/);
});

test('customer phones the office: office logs "don\'t cut" on their behalf and the same gate applies', async () => {
  const appt = await createAppointment();
  const msg = await send(U.office, appt, "Customer called: don't cut down the maple in back.", 'general', 'team', true);
  assert.equal(msg.category, 'scope_change');
  assert.equal(msg.on_behalf_of_customer, true);
  assert.equal(msg.visibility, 'team');
  assert.equal((await rows(U.crew, `SELECT * FROM notifications WHERE appointment_id = $1 AND is_urgent`, [appt])).length, 1);
  await setStatus(U.crew, appt, 'en_route');
  await setStatus(U.crew, appt, 'arrived');
  await assert.rejects(setStatus(U.crew, appt, 'in_progress'), /WORK_BLOCKED/);
});

test('reassignment: a newly assigned crew must acknowledge existing instructions before work starts', async () => {
  const appt = await createAppointment();
  await send(U.customer, appt, 'Do not start work until I move my car.', 'do_not_start');
  const [hold] = await rows(U.office, 'SELECT * FROM appointment_holds WHERE appointment_id = $1', [appt]);
  await ack(U.crew, hold.id);
  await ack(U.arborist, hold.id);
  await assert.rejects(rpc(U.office, 'SELECT * FROM resolve_hold($1, $2)', [hold.id, '  ']), /resolution note is required/);
  await rpc(U.office, 'SELECT * FROM resolve_hold($1, $2)', [hold.id, 'Customer moved the car; OK to start.']);

  // Swap crews.
  await rpc(U.office, 'SELECT * FROM assign_team_member($1, $2, false)', [appt, U.crew]);
  await rpc(U.office, 'SELECT * FROM assign_team_member($1, $2, true)', [appt, U.crew2]);
  const [assigned] = await rows(U.crew2, `SELECT * FROM notifications WHERE appointment_id = $1 AND kind = 'assigned'`, [appt]);
  assert.equal(assigned.is_urgent, true);
  assert.match(assigned.body, /need your acknowledgement/);
  assert.equal((await rows(U.crew, 'SELECT id FROM appointments WHERE id = $1', [appt])).length, 0, 'unassigned crew loses access');

  await setStatus(U.crew2, appt, 'en_route');
  await setStatus(U.crew2, appt, 'arrived');
  await assert.rejects(setStatus(U.crew2, appt, 'in_progress'), /WORK_BLOCKED/);
  assert.deepEqual(await blockers(appt), [`unacknowledged:${hold.id}:${U.crew2}`]);
  await ack(U.crew2, hold.id);
  assert.equal((await setStatus(U.crew2, appt, 'in_progress')).status, 'in_progress');
});

test('multiple crews: every assigned crew must acknowledge', async () => {
  const appt = await createAppointment({ crew: [U.crew, U.crew2] });
  await send(U.customer, appt, 'Cancel please, we are selling the house.', 'general');
  const [hold] = await rows(U.office, 'SELECT * FROM appointment_holds WHERE appointment_id = $1', [appt]);
  assert.equal(hold.kind, 'cancellation');
  await ack(U.crew, hold.id);
  await ack(U.arborist, hold.id);
  assert.ok((await blockers(appt)).includes(`unacknowledged:${hold.id}:${U.crew2}`));
});

test('roles and privacy: reply permissions, team-only notes, and other customers', async () => {
  const appt = await createAppointment();
  const crewNote = await send(U.crew, appt, 'Gate code is 4412', 'general', 'shared');
  assert.equal(crewNote.visibility, 'team', 'crew notes are always team-only');
  const officeReply = await send(U.office, appt, 'Thanks — see you tomorrow!');
  assert.equal(officeReply.visibility, 'shared');

  const customerSees = (await rows(U.customer, 'SELECT id FROM appointment_messages WHERE appointment_id = $1', [appt])).map(r => r.id);
  assert.ok(customerSees.includes(officeReply.id));
  assert.ok(!customerSees.includes(crewNote.id));

  assert.equal((await rows(U.otherCustomer, 'SELECT id FROM appointments WHERE id = $1', [appt])).length, 0);
  assert.equal((await rows(U.otherCustomer, 'SELECT id FROM appointment_messages WHERE appointment_id = $1', [appt])).length, 0);
  await assert.rejects(send(U.otherCustomer, appt, 'hi'), /Not authorized/);
  await assert.rejects(setStatus(U.customer, appt, 'cancelled'), /Only the office or assigned team/);
  await assert.rejects(setStatus(U.crew, appt, 'cancelled'), /Only the office can cancel/);
  await assert.rejects(as(U.customer, tx => tx.query(
    `INSERT INTO appointment_messages(id, appointment_id, job_id, sender_role, sender_name, body)
     SELECT $1, id, job_id, 'office', 'Fake', 'x' FROM appointments WHERE id = $2`, [newId(), appt])), /permission denied/);
  await assert.rejects(as(U.crew, tx => tx.query(`UPDATE appointments SET status = 'in_progress' WHERE id = $1`, [appt])), /permission denied/);
});

test('messages: idempotent retries, delivery and read receipts', async () => {
  const appt = await createAppointment();
  const msgId = newId();
  await send(U.customer, appt, 'Is 9am still OK?', 'general', 'shared', false, msgId);
  await send(U.customer, appt, 'Is 9am still OK?', 'general', 'shared', false, msgId);
  assert.equal((await rows(U.customer, 'SELECT id FROM appointment_messages WHERE id = $1', [msgId])).length, 1);

  await rpc(U.office, 'SELECT mark_appointment_read($1, false)', [appt]);
  let [receipt] = await rows(U.customer, 'SELECT * FROM message_receipts WHERE message_id = $1', [msgId]);
  assert.ok(receipt.delivered_at);
  assert.equal(receipt.read_at, null);
  await rpc(U.office, 'SELECT mark_appointment_read($1, true)', [appt]);
  [receipt] = await rows(U.customer, 'SELECT * FROM message_receipts WHERE message_id = $1', [msgId]);
  assert.ok(receipt.read_at);
});

test('reschedule request does not move the appointment until the office approves', async () => {
  const appt = await createAppointment();
  const [before] = await admin('SELECT window_start FROM appointments WHERE id = $1', [appt]);
  await send(U.customer, appt, 'Could we do Thursday instead?', 'reschedule');
  const [req] = await rows(U.office, 'SELECT * FROM appointment_change_requests WHERE appointment_id = $1', [appt]);
  assert.equal(req.kind, 'reschedule');
  assert.equal((await admin('SELECT window_start FROM appointments WHERE id = $1', [appt]))[0].window_start.getTime(), before.window_start.getTime());
  await assert.rejects(rpc(U.office, 'SELECT * FROM decide_change_request($1, true, $2)', [req.id, 'Moved']), /new arrival window is required/);
  await rpc(U.office, `SELECT * FROM decide_change_request($1, true, $2, now() + interval '3 days', now() + interval '3 days 2 hours')`, [req.id, 'Moved to Thursday.']);
  const changed = await rows(U.customer, `SELECT * FROM notifications WHERE appointment_id = $1 AND kind = 'changed'`, [appt]);
  assert.equal(changed.length, 1);
});

test('status notifications: booked, en route, arrived, complete', async () => {
  const appt = await createAppointment();
  await setStatus(U.crew, appt, 'en_route');
  await setStatus(U.crew, appt, 'arrived');
  await setStatus(U.crew, appt, 'in_progress');
  await setStatus(U.crew, appt, 'completed');
  const kinds = (await rows(U.customer, 'SELECT kind FROM notifications WHERE appointment_id = $1 ORDER BY created_at', [appt])).map(r => r.kind);
  assert.deepEqual(kinds, ['booked', 'en_route', 'arrived', 'in_progress', 'completed']);
  const external = await admin(`SELECT n.kind FROM notification_outbox o JOIN notifications n ON n.id = o.notification_id
                                WHERE n.appointment_id = $1 AND n.user_id = $2 ORDER BY n.created_at`, [appt, U.customer]);
  assert.deepEqual(external.map(r => r.kind), ['booked', 'en_route', 'arrived', 'completed']);
  await assert.rejects(setStatus(U.crew, appt, 'en_route'), /Cannot change status|already completed/);
});

test('status guard cannot be bypassed by skipping steps or by admin edits', async () => {
  const appt = await createAppointment();
  await send(U.customer, appt, 'Do not start', 'do_not_start');
  await assert.rejects(admin(`UPDATE appointments SET status = 'in_progress' WHERE id = $1`, [appt]), /WORK_BLOCKED/);
  await assert.rejects(admin(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [appt]), /must be started/);
  const job = (await admin('SELECT job_id FROM appointments WHERE id = $1', [appt]))[0].job_id;
  await assert.rejects(admin(`INSERT INTO appointments(job_id, service, window_start, window_end, status)
                              VALUES ($1, 'x', now(), now() + interval '1 hour', 'in_progress')`, [job]), /cannot start as in_progress/);
});

test('crew location is shared only during the opted-in trip and removed afterwards', async () => {
  const appt = await createAppointment();
  const update = user => rpc(user, 'SELECT update_crew_location($1, 40.95, -73.70, 12) AS ok', [appt]);
  const customerSees = async () => rows(U.customer, 'SELECT * FROM crew_locations WHERE appointment_id = $1', [appt]);

  assert.equal((await update(U.crew)).ok, false, 'not opted in');
  await rpc(U.crew, 'SELECT set_location_sharing($1, true)', [appt]);
  assert.equal((await update(U.crew)).ok, false, 'opted in but not en route (off-duty / before trip)');
  await assert.rejects(rpc(U.outsiderCrew, 'SELECT set_location_sharing($1, true)', [appt]), /Only assigned team members/);

  await setStatus(U.crew, appt, 'en_route');
  assert.equal((await update(U.crew)).ok, true);
  assert.equal((await update(U.outsiderCrew)).ok, false);
  assert.equal((await customerSees()).length, 1);
  assert.equal((await rows(U.otherCustomer, 'SELECT * FROM crew_locations WHERE appointment_id = $1', [appt])).length, 0);

  // Stale fixes are hidden from the customer (the app falls back to the arrival window).
  await admin(`UPDATE crew_locations SET recorded_at = now() - interval '15 minutes' WHERE appointment_id = $1`, [appt]);
  assert.equal((await customerSees()).length, 0);
  assert.equal((await rows(U.office, 'SELECT * FROM crew_locations WHERE appointment_id = $1', [appt])).length, 1);
  await update(U.crew);

  await setStatus(U.crew, appt, 'arrived');
  assert.equal((await admin('SELECT * FROM crew_locations WHERE appointment_id = $1', [appt])).length, 0, 'trip location deleted');
  assert.equal((await admin('SELECT location_sharing FROM appointment_assignments WHERE appointment_id = $1 AND user_id = $2', [appt, U.crew]))[0].location_sharing, false);
  assert.equal((await update(U.crew)).ok, false);
});

test('server and app classify free text the same way', async () => {
  const phrases = [
    'Please do not cut the big oak', "Don't cut down the maple", 'tell the crew not to cut the tree',
    'DO NOT START until I am home', 'Please hold off on starting', 'stop work', 'I need to cancel',
    'There is a dog in the yard', 'Can you come Thursday instead?', 'Thanks!', 'don’t trim the hedge',
    'wait before starting please', 'no cutting near the fence',
  ];
  for (const p of phrases) {
    const [{ c }] = await admin('SELECT classify_message_text($1) AS c', [p]);
    assert.equal(safety.classifyMessageText(p), c, p);
  }
});
