-- =====================================================================================
-- Demo data for customer communication & crew tracking (NOT a migration).
--
-- Run once in the Supabase SQL editor after the 20261014000000 migration.
-- Each email must already belong to a signed-in app user (a row in public.profiles).
-- Use four different accounts so you can see each role's view.
-- =====================================================================================
DO $$
DECLARE
  customer_email TEXT := 'customer@example.com';  -- <- change these
  office_email   TEXT := 'office@example.com';
  arborist_email TEXT := 'arborist@example.com';
  crew_email     TEXT := 'crew@example.com';

  v_customer UUID; v_office UUID; v_arborist UUID; v_crew UUID;
  v_property UUID; v_job UUID; v_appt UUID;
BEGIN
  SELECT id INTO v_customer FROM public.profiles WHERE email = customer_email;
  SELECT id INTO v_office   FROM public.profiles WHERE email = office_email;
  SELECT id INTO v_arborist FROM public.profiles WHERE email = arborist_email;
  SELECT id INTO v_crew     FROM public.profiles WHERE email = crew_email;
  IF v_customer IS NULL OR v_office IS NULL OR v_arborist IS NULL OR v_crew IS NULL THEN
    RAISE EXCEPTION 'Sign in once with all four accounts first (missing profile rows).';
  END IF;

  -- Roles are server-assigned. This is the only way to give someone a team role.
  INSERT INTO public.team_members(user_id, team_role, display_name, crew_name) VALUES
    (v_office,   'office',   'Office',      NULL),
    (v_arborist, 'arborist', 'Ari (ISA)',   NULL),
    (v_crew,     'crew',     'Cam',         'Crew 2')
  ON CONFLICT (user_id) DO UPDATE
    SET team_role = EXCLUDED.team_role, display_name = EXCLUDED.display_name,
        crew_name = EXCLUDED.crew_name, active = true;

  INSERT INTO public.properties(customer_id, address, latitude, longitude)
    VALUES (v_customer, '12 Oak Lane, Rye NY', 40.98, -73.68) RETURNING id INTO v_property;
  INSERT INTO public.jobs(customer_id, property_id, title, scope)
    VALUES (v_customer, v_property, 'Tree pruning', 'Prune front oak; remove dead maple limb over driveway')
    RETURNING id INTO v_job;

  -- Tomorrow 9–11am local time. Triggers copy customer/property from the job,
  -- write the audit event and queue the "booked" notification.
  INSERT INTO public.appointments(job_id, service, window_start, window_end)
    VALUES (v_job, 'Tree pruning',
            ((current_date + 1) + time '09:00') AT TIME ZONE 'America/New_York',
            ((current_date + 1) + time '11:00') AT TIME ZONE 'America/New_York')
    RETURNING id INTO v_appt;

  INSERT INTO public.appointment_assignments(appointment_id, user_id, assignment_role) VALUES
    (v_appt, v_arborist, 'arborist'),
    (v_appt, v_crew,     'crew');

  RAISE NOTICE 'Demo appointment %', v_appt;
END $$;
