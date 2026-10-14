# Customer communication & crew tracking

Customers, office staff, arborists and crews share one conversation per appointment. That conversation also shows appointment status, safety holds that need acknowledgement, and a live ETA while the crew is on the way.

## How it fits together

| Layer | Files |
| --- | --- |
| Database (source of truth, every rule enforced here) | `supabase/migrations/20261014000000_job_communication.sql` |
| External delivery (email/SMS via the existing Zapier channel) | `supabase/functions/dispatch-notifications/` |
| Pure logic shared by UI and tests | `utils/jobSafety.ts`, `utils/crewTracking.ts`, `utils/messageOutbox.ts` |
| Data access and realtime | `services/appointments.ts`, `stores/appointmentStore.ts`, `hooks/useAppointment*.ts`, `hooks/useCrewLocationSharing.ts` |
| UI | `app/(main)/appointments.tsx`, `app/(main)/appointment/[id].tsx`, `components/appointments/*` |

Key rules (all enforced in Postgres, not the client):

- **Roles come from the server.** The `team_members` table defines office, arborist and crew. Anyone not in it is a customer and can only see their own appointments. Crew and arborists see only the appointments they are assigned to.
- **Every write goes through an RPC** that checks the caller's role for that appointment. Through RLS, the tables themselves are read-only.
- **A message never changes anything by itself.**
  - "Do not start", cancellation and scope-change messages open a **hold**. Messages like "don't cut the tree" are detected even when sent as general text.
  - Reschedule, cancellation and scope messages also open a **change request**. The office decides these; the assigned arborist can also decide scope changes.
- **Work-start gate.** A trigger raises `WORK_BLOCKED` when anyone tries to set `in_progress` while any of these is true:
  - a hold is still open
  - an active assigned arborist or crew member has not acknowledged a hold
  - a change request is pending
  - no crew is assigned

  The trigger also covers the service role and dashboard edits.
- **Reassignment:** a newly assigned person must acknowledge open holds before work can start.
- **Append-only** tables: messages, acknowledgements and `appointment_events` (the audit trail). `message_receipts` stores delivery and read status for each person.

## Setup

1. **Run the migration.** Use `supabase db push`, or paste the file into the SQL editor.
2. **Give people team roles.** Only the service role or the SQL editor can do this:
   ```sql
   insert into team_members (user_id, team_role, display_name, crew_name)
   values ('<profile uuid>', 'crew', 'Cam', 'Crew 2');
   ```
3. **Create appointments.** Insert rows into `properties`, `jobs`, `appointments` and `appointment_assignments` with the service role (for example, from an ACORN/Zapier sync). Triggers send the booked, changed and assigned notifications.
4. **Optional demo:** edit the four emails in `supabase/demo/job_communication_demo.sql`, then run it.
5. **Email/SMS delivery.** In-app notifications work without this step.
   ```bash
   supabase functions deploy dispatch-notifications --no-verify-jwt
   supabase secrets set DISPATCH_NOTIFICATIONS_SECRET=<random> ZAPIER_NOTIFICATIONS_WEBHOOK_URL=<zap hook>
   ```
   Then call it every minute. One option is Supabase Cron with `pg_net`:
   ```sql
   select cron.schedule('dispatch-notifications', '* * * * *', $$
     select net.http_post(
       url := 'https://<project>.supabase.co/functions/v1/dispatch-notifications',
       headers := jsonb_build_object('x-dispatch-secret', '<same secret>'));
   $$);
   ```
   Failed sends retry with backoff (1, 2, 4 … 60 min, 8 attempts) and are then marked `failed`. They are never deleted.
6. **Rebuild the native app** (`npx expo run:ios` / EAS). `app.json` now has updated location-permission text.

## Privacy

- Location is accepted only while the appointment is `en_route`, and only from an assigned crew member who turned sharing on for that job.
- When the trip ends or the member is unassigned, the location rows are deleted and sharing is reset.
- Customers never see team-only messages, other customers' jobs, or any location outside an active trip.
- The customer map is a coarse "radar" view, not a street map.

## Validation

```bash
node --test tests/job-communication.db.test.mjs tests/job-communication.test.cjs
node node_modules/typescript/bin/tsc --noEmit
```

The database tests run the real migration in PGlite (Postgres compiled to WASM), so Docker is not required. They log in as each role under RLS. They include the critical scenario: the customer says "don't cut the tree", and the assigned arborist and crew must acknowledge before work can start.

## Known limitations

- Location sharing works in the **foreground only**, and there are **no push notifications** (`expo-notifications` is not installed). Customers learn about changes from in-app banners, realtime updates and Zapier email/SMS.
- The ETA is a straight-line estimate (35 km/h × 1.35 road factor), not a routing result.
- The reschedule form reads dates in the device's time zone, not the appointment's.
- Appointments can't be deleted because their history is append-only. Cancel them instead.
- Supabase does not yet sync appointments from ACORN. That integration still needs to be built.
