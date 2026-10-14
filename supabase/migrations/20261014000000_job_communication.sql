-- =====================================================================================
-- Customer communication, crew tracking and job-safety holds
--
--  * Team roles are server-assigned (team_members). Clients never write these tables
--    directly: every write goes through a SECURITY DEFINER function that checks the
--    caller's role for that specific appointment.
--  * A message never changes the schedule or scope by itself. Blocking messages open a
--    hold; reschedule / cancellation / scope messages open a change request that the
--    office (or assigned arborist, for scope) must decide.
--  * Work cannot move to in_progress while a hold is open, an active assignee has not
--    acknowledged a hold, a change request is pending, or no crew is assigned. This is a
--    trigger, so it also applies to service-role and dashboard edits.
--  * Crew location is accepted only while the appointment is en_route and that crew member
--    opted in for that job. It is deleted when the trip ends or the member is unassigned.
--  * Messages, acknowledgements and audit events are append-only.
-- =====================================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- -------------------------------------------------------------------------------------
-- 1. Tables
-- -------------------------------------------------------------------------------------
CREATE TABLE public.team_members (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_role TEXT NOT NULL CHECK (team_role IN ('office', 'arborist', 'crew')),
  display_name TEXT NOT NULL,
  crew_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  title TEXT NOT NULL,
  scope TEXT,
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),   -- copied from job by trigger
  property_id UUID NOT NULL REFERENCES public.properties(id), -- copied from job by trigger
  service TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/New_York',
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled')),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (window_end > window_start)
);
CREATE INDEX appointments_customer_idx ON public.appointments(customer_id, window_start);

CREATE TABLE public.appointment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  user_id UUID NOT NULL REFERENCES public.team_members(user_id),
  assignment_role TEXT NOT NULL CHECK (assignment_role IN ('arborist', 'crew')),
  display_name TEXT NOT NULL DEFAULT '',  -- filled from team_members by trigger
  crew_name TEXT,
  location_sharing BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  UNIQUE (appointment_id, user_id)
);
CREATE INDEX appointment_assignments_user_idx ON public.appointment_assignments(user_id) WHERE active;

CREATE TABLE public.appointment_messages (
  id UUID PRIMARY KEY,  -- generated on the device so offline retries are idempotent
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  sender_id UUID REFERENCES public.profiles(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'office', 'arborist', 'crew', 'system')),
  sender_name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'team')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN
    ('general', 'reschedule', 'pet_alert', 'do_not_start', 'cancellation', 'scope_change', 'status')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  on_behalf_of_customer BOOLEAN NOT NULL DEFAULT false,
  client_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX appointment_messages_appt_idx ON public.appointment_messages(appointment_id, created_at);

CREATE TABLE public.message_receipts (
  message_id UUID NOT NULL REFERENCES public.appointment_messages(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE public.appointment_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  message_id UUID NOT NULL UNIQUE REFERENCES public.appointment_messages(id),
  kind TEXT NOT NULL CHECK (kind IN ('do_not_start', 'cancellation', 'scope_change')),
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  opened_by UUID REFERENCES public.profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE INDEX appointment_holds_appt_idx ON public.appointment_holds(appointment_id);

CREATE TABLE public.hold_acknowledgements (
  hold_id UUID NOT NULL REFERENCES public.appointment_holds(id),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  assignment_role TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (hold_id, user_id)
);

CREATE TABLE public.appointment_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  message_id UUID REFERENCES public.appointment_messages(id),
  hold_id UUID REFERENCES public.appointment_holds(id),
  kind TEXT NOT NULL CHECK (kind IN ('reschedule', 'cancellation', 'scope_change')),
  requested_by UUID REFERENCES public.profiles(id),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_by UUID REFERENCES public.profiles(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.crew_locations (
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, user_id)
);

CREATE TABLE public.appointment_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  actor_id UUID,
  actor_role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX appointment_events_appt_idx ON public.appointment_events(appointment_id, id);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  read_at TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- Rows here are delivered to the existing Zapier channel by the dispatch-notifications
-- function, with retries. In-app notifications above never depend on this succeeding.
CREATE TABLE public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'zapier',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox(next_attempt_at) WHERE status = 'pending';

-- -------------------------------------------------------------------------------------
-- 2. Role helpers (used by RLS policies, so they live in public)
-- -------------------------------------------------------------------------------------
CREATE FUNCTION public.current_team_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_role FROM team_members WHERE user_id = auth.uid() AND active;
$$;

CREATE FUNCTION public.is_office() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.current_team_role() = 'office', false);
$$;

-- The caller's role on one appointment: their active assignment first, then office,
-- then the appointment's customer. NULL means no access.
CREATE FUNCTION public.appointment_role(p_appointment UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT a.assignment_role FROM appointment_assignments a
       JOIN team_members t ON t.user_id = a.user_id AND t.active
      WHERE a.appointment_id = p_appointment AND a.user_id = auth.uid() AND a.active),
    (SELECT 'office' FROM appointments ap WHERE ap.id = p_appointment AND public.is_office()),
    (SELECT 'customer' FROM appointments ap WHERE ap.id = p_appointment AND ap.customer_id = auth.uid())
  );
$$;

CREATE FUNCTION public.can_view_appointment(p_appointment UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.appointment_role(p_appointment) IS NOT NULL;
$$;

CREATE FUNCTION public.can_view_job(p_job UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_office()
      OR EXISTS (SELECT 1 FROM jobs j WHERE j.id = p_job AND j.customer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM appointments ap
                   JOIN appointment_assignments a ON a.appointment_id = ap.id AND a.active
                  WHERE ap.job_id = p_job AND a.user_id = auth.uid());
$$;

CREATE FUNCTION public.can_view_property(p_property UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_office()
      OR EXISTS (SELECT 1 FROM properties p WHERE p.id = p_property AND p.customer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM appointments ap
                   JOIN appointment_assignments a ON a.appointment_id = ap.id AND a.active
                  WHERE ap.property_id = p_property AND a.user_id = auth.uid());
$$;

CREATE FUNCTION public.can_view_message(p_appointment UUID, p_visibility TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(CASE public.appointment_role(p_appointment)
    WHEN 'customer' THEN p_visibility = 'shared'
    WHEN 'office' THEN true
    WHEN 'arborist' THEN true
    WHEN 'crew' THEN true
  END, false);
$$;

-- Customers see a crew member's position only during that job's trip, only if that
-- member opted in, and only while the fix is recent.
CREATE FUNCTION public.can_view_crew_location(p_appointment UUID, p_user UUID, p_recorded_at TIMESTAMPTZ) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT := public.appointment_role(p_appointment);
BEGIN
  IF v_role IN ('office', 'arborist', 'crew') THEN RETURN true; END IF;
  IF v_role = 'customer' THEN
    RETURN p_recorded_at > now() - interval '10 minutes' AND EXISTS (
      SELECT 1 FROM appointments ap
        JOIN appointment_assignments a ON a.appointment_id = ap.id
       WHERE ap.id = p_appointment AND ap.status = 'en_route'
         AND a.user_id = p_user AND a.active AND a.location_sharing);
  END IF;
  RETURN false;
END $$;

-- Keyword safety net for free-text messages. Mirrored in utils/jobSafety.ts; the
-- database tests check that both give the same answer.
CREATE FUNCTION public.classify_message_text(p_body TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t TEXT := regexp_replace(regexp_replace(lower(coalesce(p_body, '')), '[‘’`]', '''', 'g'), '\s+', ' ', 'g');
BEGIN
  IF t ~ '\m(do not|don''?t|dont|stop|hold off( on)?|halt|pause|wait( to| before)?|no)\s+(start|starting|begin|beginning|work|working|any work)\M' THEN
    RETURN 'do_not_start';
  END IF;
  IF t ~ '\mcancel' THEN RETURN 'cancellation'; END IF;
  IF t ~ '\m(do not|don''?t|dont|never|not to|no|stop)\s+(cut|cutting|remove|removing|take down|taking down|prune|pruning|trim|trimming|touch|touching|fell|felling|grind|grinding)\M' THEN
    RETURN 'scope_change';
  END IF;
  IF t ~ '\m(dog|dogs|puppy|pet|pets)\M' THEN RETURN 'pet_alert'; END IF;
  RETURN 'general';
END $$;

-- -------------------------------------------------------------------------------------
-- 3. Internal helpers (not callable by clients)
-- -------------------------------------------------------------------------------------
CREATE FUNCTION private.actor_role(p_appointment UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.appointment_role(p_appointment), CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'unknown' END);
$$;

CREATE FUNCTION private.log_event(p_appointment UUID, p_type TEXT, p_details JSONB DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO appointment_events(appointment_id, actor_id, actor_role, event_type, details)
  VALUES (p_appointment, auth.uid(), private.actor_role(p_appointment), p_type, coalesce(p_details, '{}'::jsonb));
$$;

CREATE FUNCTION private.window_label(p_appointment UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_char(window_start AT TIME ZONE time_zone, 'Dy Mon FMDD, FMHH12:MI AM') || '–' ||
         to_char(window_end AT TIME ZONE time_zone, 'FMHH12:MI AM')
    FROM appointments WHERE id = p_appointment;
$$;

CREATE FUNCTION private.notify_user(p_user UUID, p_appointment UUID, p_kind TEXT, p_title TEXT, p_body TEXT,
                                    p_urgent BOOLEAN DEFAULT false, p_external BOOLEAN DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_user IS NULL OR p_user IS NOT DISTINCT FROM auth.uid() THEN RETURN; END IF;
  INSERT INTO notifications(user_id, appointment_id, kind, title, body, is_urgent)
  VALUES (p_user, p_appointment, p_kind, p_title, p_body, p_urgent) RETURNING id INTO v_id;
  IF p_external THEN INSERT INTO notification_outbox(notification_id) VALUES (v_id); END IF;
END $$;

-- Notifies active assignees with the given roles and, optionally, every active office user.
CREATE FUNCTION private.notify_team(p_appointment UUID, p_kind TEXT, p_title TEXT, p_body TEXT,
                                    p_urgent BOOLEAN, p_external BOOLEAN, p_include_office BOOLEAN,
                                    p_roles TEXT[] DEFAULT ARRAY['arborist', 'crew']) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT a.user_id FROM appointment_assignments a JOIN team_members t ON t.user_id = a.user_id AND t.active
     WHERE a.appointment_id = p_appointment AND a.active AND a.assignment_role = ANY(p_roles)
    UNION
    SELECT t.user_id FROM team_members t WHERE p_include_office AND t.active AND t.team_role = 'office'
  LOOP
    PERFORM private.notify_user(r.user_id, p_appointment, p_kind, p_title, p_body, p_urgent, p_external);
  END LOOP;
END $$;

CREATE FUNCTION private.post_system_message(p_appointment UUID, p_body TEXT, p_visibility TEXT DEFAULT 'shared') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO appointment_messages(id, appointment_id, job_id, sender_id, sender_role, sender_name, visibility, category, body)
  SELECT gen_random_uuid(), id, job_id, NULL, 'system', 'Arborist Dog', p_visibility, 'status', p_body
    FROM appointments WHERE id = p_appointment;
$$;

-- Everything that must be true before work may start. Empty array = clear to start.
CREATE FUNCTION private.work_start_blockers(p_appointment UUID) RETURNS TEXT[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(reason ORDER BY reason), '{}') FROM (
    SELECT 'open_hold:' || h.id AS reason
      FROM appointment_holds h WHERE h.appointment_id = p_appointment AND h.status = 'open'
    UNION ALL
    SELECT 'unacknowledged:' || h.id || ':' || a.user_id
      FROM appointment_holds h
      JOIN appointment_assignments a ON a.appointment_id = h.appointment_id AND a.active
     WHERE h.appointment_id = p_appointment
       AND NOT EXISTS (SELECT 1 FROM hold_acknowledgements k WHERE k.hold_id = h.id AND k.user_id = a.user_id)
    UNION ALL
    SELECT 'pending_change:' || c.id
      FROM appointment_change_requests c WHERE c.appointment_id = p_appointment AND c.status = 'pending'
    UNION ALL
    SELECT 'no_crew_assigned' WHERE NOT EXISTS (
      SELECT 1 FROM appointment_assignments a WHERE a.appointment_id = p_appointment AND a.active AND a.assignment_role = 'crew')
  ) r;
$$;

CREATE FUNCTION private.forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

-- -------------------------------------------------------------------------------------
-- 4. Triggers
-- -------------------------------------------------------------------------------------
CREATE FUNCTION private.appointments_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_blockers TEXT[];
BEGIN
  SELECT customer_id, property_id INTO NEW.customer_id, NEW.property_id FROM jobs WHERE id = NEW.job_id;
  IF NEW.customer_id IS NULL THEN RAISE EXCEPTION 'Unknown job %', NEW.job_id; END IF;
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('en_route', 'arrived', 'in_progress') THEN
      RAISE EXCEPTION 'New appointments cannot start as %', NEW.status;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
    IF OLD.status IN ('completed', 'cancelled') THEN
      RAISE EXCEPTION 'Appointment is already %', OLD.status;
    END IF;
    IF NEW.status = 'completed' AND OLD.status <> 'in_progress' THEN
      RAISE EXCEPTION 'Work must be started before it can be completed';
    END IF;
    IF NEW.status = 'in_progress' THEN
      v_blockers := private.work_start_blockers(NEW.id);
      IF cardinality(v_blockers) > 0 THEN
        RAISE EXCEPTION 'WORK_BLOCKED'
          USING DETAIL = array_to_string(v_blockers, ','),
                HINT = 'Resolve open instructions and collect every acknowledgement before starting work.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appointments_10_before BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION private.appointments_before();

CREATE FUNCTION private.appointments_after() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window TEXT := private.window_label(NEW.id);
  v_crew TEXT;
  v_address TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.log_event(NEW.id, 'booked', jsonb_build_object('window_start', NEW.window_start, 'window_end', NEW.window_end, 'status', NEW.status));
    PERFORM private.notify_user(NEW.customer_id, NEW.id, 'booked', 'Appointment booked', NEW.service || ' · ' || v_window, false, true);
    RETURN NEW;
  END IF;

  IF NEW.window_start IS DISTINCT FROM OLD.window_start OR NEW.window_end IS DISTINCT FROM OLD.window_end THEN
    PERFORM private.log_event(NEW.id, 'rescheduled', jsonb_build_object(
      'from_start', OLD.window_start, 'from_end', OLD.window_end, 'to_start', NEW.window_start, 'to_end', NEW.window_end));
    PERFORM private.notify_user(NEW.customer_id, NEW.id, 'changed', 'Appointment changed', NEW.service || ' · new arrival window ' || v_window, false, true);
    PERFORM private.notify_team(NEW.id, 'changed', 'Appointment rescheduled', NEW.service || ' · ' || v_window, true, true, true);
    PERFORM private.post_system_message(NEW.id, 'Appointment moved to ' || v_window || '.');
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM private.log_event(NEW.id, 'status_changed', jsonb_build_object('from', OLD.status, 'to', NEW.status));

    IF OLD.status = 'en_route' THEN
      DELETE FROM crew_locations WHERE appointment_id = NEW.id;
      UPDATE appointment_assignments SET location_sharing = false WHERE appointment_id = NEW.id AND location_sharing;
      PERFORM private.log_event(NEW.id, 'location_sharing_ended', jsonb_build_object('reason', 'trip_ended', 'status', NEW.status));
    END IF;

    SELECT string_agg(DISTINCT coalesce(crew_name, display_name), ', ') INTO v_crew
      FROM appointment_assignments WHERE appointment_id = NEW.id AND active AND assignment_role = 'crew';
    SELECT address INTO v_address FROM properties WHERE id = NEW.property_id;

    CASE NEW.status
      WHEN 'en_route' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'en_route', 'Your crew is on the way',
          coalesce(v_crew, 'Your Almstead crew') || ' is heading to ' || v_address || '.', false, true);
        PERFORM private.post_system_message(NEW.id, 'Crew is on the way.');
      WHEN 'arrived' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'arrived', 'Your crew has arrived',
          coalesce(v_crew, 'Your Almstead crew') || ' has arrived at ' || v_address || '.', false, true);
        PERFORM private.post_system_message(NEW.id, 'Crew has arrived.');
      WHEN 'in_progress' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'in_progress', 'Work has started', NEW.service, false, false);
        PERFORM private.post_system_message(NEW.id, 'Work has started.');
      WHEN 'completed' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'completed', 'Job complete', NEW.service || ' is complete.', false, true);
        PERFORM private.post_system_message(NEW.id, 'Job complete.');
      WHEN 'cancelled' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'cancelled', 'Appointment cancelled', NEW.service || ' · ' || v_window, false, true);
        PERFORM private.notify_team(NEW.id, 'cancelled', 'Appointment cancelled', NEW.service || ' · ' || v_window, true, true, true);
        PERFORM private.post_system_message(NEW.id, 'Appointment cancelled.');
      WHEN 'scheduled' THEN
        PERFORM private.notify_user(NEW.customer_id, NEW.id, 'trip_paused', 'Crew trip paused',
          'Your crew is no longer en route. We will update you shortly.', false, false);
        PERFORM private.post_system_message(NEW.id, 'Crew trip paused.');
      ELSE NULL;
    END CASE;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER appointments_20_after AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION private.appointments_after();

CREATE FUNCTION private.assignments_before() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_member team_members;
BEGIN
  SELECT * INTO v_member FROM team_members WHERE user_id = NEW.user_id;
  IF v_member.team_role IS DISTINCT FROM NEW.assignment_role THEN
    RAISE EXCEPTION 'Team member % is not a %', NEW.user_id, NEW.assignment_role;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.display_name = '' THEN
    NEW.display_name := v_member.display_name;
    NEW.crew_name := coalesce(NEW.crew_name, v_member.crew_name);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.active AND NOT NEW.active THEN
    NEW.location_sharing := false;
    NEW.unassigned_at := now();
  ELSIF TG_OP = 'UPDATE' AND NOT OLD.active AND NEW.active THEN
    NEW.assigned_at := now();
    NEW.unassigned_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER assignments_10_before BEFORE INSERT OR UPDATE ON public.appointment_assignments
FOR EACH ROW EXECUTE FUNCTION private.assignments_before();

CREATE FUNCTION private.assignments_after() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pending INTEGER; v_service TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.active AND NOT OLD.active) THEN
    PERFORM private.log_event(NEW.appointment_id, 'assigned',
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.assignment_role, 'name', NEW.display_name));
    SELECT count(*) INTO v_pending FROM appointment_holds h
     WHERE h.appointment_id = NEW.appointment_id
       AND NOT EXISTS (SELECT 1 FROM hold_acknowledgements k WHERE k.hold_id = h.id AND k.user_id = NEW.user_id);
    SELECT service INTO v_service FROM appointments WHERE id = NEW.appointment_id;
    PERFORM private.notify_user(NEW.user_id, NEW.appointment_id, 'assigned', 'New job assignment',
      v_service || ' · ' || private.window_label(NEW.appointment_id) ||
      CASE WHEN v_pending > 0 THEN ' · ' || v_pending || ' customer instruction(s) need your acknowledgement' ELSE '' END,
      v_pending > 0, v_pending > 0);
  ELSIF OLD.active AND NOT NEW.active THEN
    DELETE FROM crew_locations WHERE appointment_id = NEW.appointment_id AND user_id = NEW.user_id;
    PERFORM private.log_event(NEW.appointment_id, 'unassigned',
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.assignment_role, 'name', NEW.display_name));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER assignments_20_after AFTER INSERT OR UPDATE ON public.appointment_assignments
FOR EACH ROW EXECUTE FUNCTION private.assignments_after();

CREATE TRIGGER appointment_messages_append_only BEFORE UPDATE OR DELETE ON public.appointment_messages
FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
CREATE TRIGGER hold_acknowledgements_append_only BEFORE UPDATE OR DELETE ON public.hold_acknowledgements
FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();
CREATE TRIGGER appointment_events_append_only BEFORE UPDATE OR DELETE ON public.appointment_events
FOR EACH ROW EXECUTE FUNCTION private.forbid_mutation();

-- -------------------------------------------------------------------------------------
-- 5. Client RPCs
-- -------------------------------------------------------------------------------------
CREATE FUNCTION public.send_appointment_message(
  p_id UUID,
  p_appointment UUID,
  p_body TEXT,
  p_category TEXT DEFAULT 'general',
  p_visibility TEXT DEFAULT 'shared',
  p_on_behalf_of_customer BOOLEAN DEFAULT false,
  p_client_created_at TIMESTAMPTZ DEFAULT NULL
) RETURNS public.appointment_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.appointment_role(p_appointment);
  v_appt appointments;
  v_msg appointment_messages;
  v_body TEXT := btrim(coalesce(p_body, ''));
  v_cat TEXT := coalesce(nullif(p_category, ''), 'general');
  v_detected TEXT;
  v_vis TEXT;
  v_urgent BOOLEAN;
  v_hold UUID;
  v_name TEXT;
  v_title TEXT;
  v_preview TEXT;
BEGIN
  IF auth.uid() IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized for this appointment' USING ERRCODE = '42501';
  END IF;

  -- Idempotent retry from the device outbox.
  SELECT * INTO v_msg FROM appointment_messages WHERE id = p_id;
  IF FOUND THEN
    IF v_msg.sender_id = auth.uid() THEN RETURN v_msg; END IF;
    RAISE EXCEPTION 'Message id already used';
  END IF;

  IF v_body = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF v_cat NOT IN ('general', 'reschedule', 'pet_alert', 'do_not_start', 'cancellation', 'scope_change') THEN
    RAISE EXCEPTION 'Unknown message category %', v_cat;
  END IF;

  -- Never downgrade: free text that reads like a stop instruction is treated as one.
  v_detected := public.classify_message_text(v_body);
  IF v_cat NOT IN ('do_not_start', 'cancellation', 'scope_change')
     AND v_detected IN ('do_not_start', 'cancellation', 'scope_change') THEN
    v_cat := v_detected;
  ELSIF v_cat = 'general' AND v_detected = 'pet_alert' THEN
    v_cat := v_detected;
  END IF;

  v_vis := CASE v_role WHEN 'customer' THEN 'shared' WHEN 'crew' THEN 'team' ELSE coalesce(p_visibility, 'shared') END;
  IF v_vis NOT IN ('shared', 'team') THEN RAISE EXCEPTION 'Unknown visibility %', v_vis; END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment;
  v_urgent := v_cat IN ('pet_alert', 'do_not_start', 'cancellation', 'scope_change')
           OR (v_cat = 'reschedule' AND v_appt.window_start < now() + interval '24 hours');

  SELECT coalesce(t.display_name, p.full_name) INTO v_name
    FROM profiles p LEFT JOIN team_members t ON t.user_id = p.id WHERE p.id = auth.uid();
  v_name := coalesce(nullif(v_name, ''), CASE v_role WHEN 'customer' THEN 'Customer' ELSE initcap(v_role) END);

  INSERT INTO appointment_messages(id, appointment_id, job_id, sender_id, sender_role, sender_name, visibility,
                                   category, body, is_urgent, on_behalf_of_customer, client_created_at)
  VALUES (p_id, p_appointment, v_appt.job_id, auth.uid(), v_role, v_name, v_vis,
          v_cat, v_body, v_urgent, v_role <> 'customer' AND coalesce(p_on_behalf_of_customer, false), p_client_created_at)
  RETURNING * INTO v_msg;

  IF v_cat IN ('do_not_start', 'cancellation', 'scope_change') THEN
    INSERT INTO appointment_holds(appointment_id, message_id, kind, summary, opened_by)
    VALUES (p_appointment, v_msg.id, v_cat, left(v_body, 280), auth.uid()) RETURNING id INTO v_hold;
    PERFORM private.log_event(p_appointment, 'hold_opened',
      jsonb_build_object('hold_id', v_hold, 'kind', v_cat, 'message_id', v_msg.id, 'on_behalf_of_customer', v_msg.on_behalf_of_customer));
  END IF;

  IF v_cat IN ('reschedule', 'cancellation', 'scope_change') THEN
    INSERT INTO appointment_change_requests(appointment_id, message_id, hold_id, kind, requested_by, details)
    VALUES (p_appointment, v_msg.id, v_hold, v_cat, auth.uid(), v_body);
    PERFORM private.log_event(p_appointment, 'change_requested', jsonb_build_object('kind', v_cat, 'message_id', v_msg.id));
  END IF;

  v_preview := v_name || ': ' || left(v_body, 140);
  IF v_urgent THEN
    v_title := CASE v_cat
      WHEN 'do_not_start' THEN 'URGENT: Do not start work'
      WHEN 'cancellation' THEN 'URGENT: Cancellation request'
      WHEN 'scope_change' THEN 'URGENT: Scope change — do not proceed'
      WHEN 'pet_alert' THEN 'Pet on property'
      ELSE 'Reschedule request (within 24 hours)' END;
    PERFORM private.notify_team(p_appointment, 'urgent_message', v_title, v_preview, true, true, true);
    IF v_vis = 'shared' AND v_role <> 'customer' THEN
      PERFORM private.notify_user(v_appt.customer_id, p_appointment, 'message', 'New message about your appointment', v_preview, false, false);
    END IF;
  ELSIF v_role = 'customer' THEN
    PERFORM private.notify_team(p_appointment, 'message', 'New customer message', v_preview, false, false, true, ARRAY['arborist']);
  ELSIF v_vis = 'shared' THEN
    PERFORM private.notify_user(v_appt.customer_id, p_appointment, 'message', 'New message about your appointment', v_preview, false, false);
  ELSE
    PERFORM private.notify_team(p_appointment, 'team_message', 'New team note', v_preview, false, false, false);
  END IF;

  RETURN v_msg;
END $$;

CREATE FUNCTION public.acknowledge_hold(p_hold UUID) RETURNS public.hold_acknowledgements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hold appointment_holds;
  v_role TEXT;
  v_ack hold_acknowledgements;
  v_remaining INTEGER;
BEGIN
  SELECT * INTO v_hold FROM appointment_holds WHERE id = p_hold;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown instruction'; END IF;

  SELECT a.assignment_role INTO v_role FROM appointment_assignments a
    JOIN team_members t ON t.user_id = a.user_id AND t.active
   WHERE a.appointment_id = v_hold.appointment_id AND a.user_id = auth.uid() AND a.active;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Only the assigned arborist or crew can acknowledge this instruction' USING ERRCODE = '42501';
  END IF;

  INSERT INTO hold_acknowledgements(hold_id, user_id, assignment_role) VALUES (p_hold, auth.uid(), v_role)
  ON CONFLICT DO NOTHING RETURNING * INTO v_ack;
  IF v_ack.hold_id IS NULL THEN
    SELECT * INTO v_ack FROM hold_acknowledgements WHERE hold_id = p_hold AND user_id = auth.uid();
    RETURN v_ack;
  END IF;

  PERFORM private.log_event(v_hold.appointment_id, 'hold_acknowledged', jsonb_build_object('hold_id', p_hold, 'kind', v_hold.kind));

  SELECT count(*) INTO v_remaining FROM appointment_assignments a
   WHERE a.appointment_id = v_hold.appointment_id AND a.active
     AND NOT EXISTS (SELECT 1 FROM hold_acknowledgements k WHERE k.hold_id = p_hold AND k.user_id = a.user_id);
  IF v_remaining = 0 THEN
    PERFORM private.notify_team(v_hold.appointment_id, 'hold_acknowledged', 'Instruction acknowledged',
      'Every assigned arborist and crew member has acknowledged: ' || left(v_hold.summary, 120), false, false, true, ARRAY[]::TEXT[]);
  END IF;
  RETURN v_ack;
END $$;

CREATE FUNCTION public.resolve_hold(p_hold UUID, p_note TEXT) RETURNS public.appointment_holds
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hold appointment_holds;
BEGIN
  SELECT * INTO v_hold FROM appointment_holds WHERE id = p_hold FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown instruction'; END IF;
  IF NOT (public.is_office() OR public.appointment_role(v_hold.appointment_id) = 'arborist') THEN
    RAISE EXCEPTION 'Only the office or assigned arborist can resolve instructions' USING ERRCODE = '42501';
  END IF;
  IF v_hold.status = 'resolved' THEN RETURN v_hold; END IF;
  IF EXISTS (SELECT 1 FROM appointment_change_requests WHERE hold_id = p_hold AND status = 'pending') THEN
    RAISE EXCEPTION 'Approve or decline the linked change request instead';
  END IF;
  IF btrim(coalesce(p_note, '')) = '' THEN RAISE EXCEPTION 'A resolution note is required'; END IF;

  UPDATE appointment_holds SET status = 'resolved', resolved_by = auth.uid(), resolved_at = clock_timestamp(), resolution_note = btrim(p_note)
   WHERE id = p_hold RETURNING * INTO v_hold;
  PERFORM private.log_event(v_hold.appointment_id, 'hold_resolved', jsonb_build_object('hold_id', p_hold, 'note', v_hold.resolution_note));
  PERFORM private.post_system_message(v_hold.appointment_id, 'Instruction resolved: ' || v_hold.resolution_note, 'team');
  PERFORM private.notify_team(v_hold.appointment_id, 'hold_resolved', 'Instruction resolved', v_hold.resolution_note, false, false, true);
  RETURN v_hold;
END $$;

CREATE FUNCTION public.decide_change_request(
  p_request UUID,
  p_approve BOOLEAN,
  p_note TEXT,
  p_window_start TIMESTAMPTZ DEFAULT NULL,
  p_window_end TIMESTAMPTZ DEFAULT NULL
) RETURNS public.appointment_change_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req appointment_change_requests;
  v_appt appointments;
  v_note TEXT := btrim(coalesce(p_note, ''));
  v_label TEXT;
BEGIN
  SELECT * INTO v_req FROM appointment_change_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown change request'; END IF;
  IF NOT (public.is_office() OR (v_req.kind = 'scope_change' AND public.appointment_role(v_req.appointment_id) = 'arborist')) THEN
    RAISE EXCEPTION 'Not authorized to decide this change' USING ERRCODE = '42501';
  END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'This change request was already %', v_req.status; END IF;
  IF v_note = '' THEN RAISE EXCEPTION 'A decision note is required'; END IF;
  SELECT * INTO v_appt FROM appointments WHERE id = v_req.appointment_id FOR UPDATE;

  IF p_approve THEN
    IF v_req.kind = 'reschedule' THEN
      IF p_window_start IS NULL OR p_window_end IS NULL OR p_window_end <= p_window_start THEN
        RAISE EXCEPTION 'A new arrival window is required';
      END IF;
      IF v_appt.status IN ('in_progress', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot reschedule an appointment that is %', v_appt.status;
      END IF;
      UPDATE appointments SET window_start = p_window_start, window_end = p_window_end,
             status = CASE WHEN status IN ('en_route', 'arrived') THEN 'scheduled' ELSE status END
       WHERE id = v_appt.id;
    ELSIF v_req.kind = 'cancellation' THEN
      IF v_appt.status NOT IN ('completed', 'cancelled') THEN
        UPDATE appointments SET status = 'cancelled' WHERE id = v_appt.id;
      END IF;
    ELSE
      UPDATE jobs SET scope = concat_ws(E'\n', scope, '[Approved change ' || to_char(now(), 'YYYY-MM-DD') || '] ' || v_note)
       WHERE id = v_appt.job_id;
    END IF;
  END IF;

  UPDATE appointment_change_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
         decided_by = auth.uid(), decided_at = clock_timestamp(), decision_note = v_note
   WHERE id = p_request RETURNING * INTO v_req;
  PERFORM private.log_event(v_req.appointment_id, 'change_request_decided',
    jsonb_build_object('request_id', p_request, 'kind', v_req.kind, 'status', v_req.status, 'note', v_note));

  IF v_req.hold_id IS NOT NULL THEN
    UPDATE appointment_holds SET status = 'resolved', resolved_by = auth.uid(), resolved_at = clock_timestamp(),
           resolution_note = initcap(v_req.status) || ': ' || v_note
     WHERE id = v_req.hold_id AND status = 'open';
    PERFORM private.log_event(v_req.appointment_id, 'hold_resolved', jsonb_build_object('hold_id', v_req.hold_id, 'via_request', p_request));
  END IF;

  v_label := CASE v_req.kind WHEN 'reschedule' THEN 'reschedule' WHEN 'cancellation' THEN 'cancellation' ELSE 'scope change' END;
  PERFORM private.post_system_message(v_req.appointment_id, 'Your ' || v_label || ' request was ' || v_req.status || ': ' || v_note);
  PERFORM private.notify_user(v_appt.customer_id, v_req.appointment_id, 'change_' || v_req.status,
    'Request ' || v_req.status, 'Your ' || v_label || ' request was ' || v_req.status || ': ' || v_note, false, true);
  PERFORM private.notify_team(v_req.appointment_id, 'change_' || v_req.status, initcap(v_label) || ' ' || v_req.status, v_note, false, false, true);
  RETURN v_req;
END $$;

CREATE FUNCTION public.set_appointment_status(p_appointment UUID, p_status TEXT) RETURNS public.appointments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.appointment_role(p_appointment);
  v_appt appointments;
BEGIN
  IF v_role IS NULL OR v_role = 'customer' THEN
    RAISE EXCEPTION 'Only the office or assigned team can update job status' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment FOR UPDATE;
  IF v_appt.status = p_status THEN RETURN v_appt; END IF;
  IF p_status = 'cancelled' AND NOT public.is_office() THEN
    RAISE EXCEPTION 'Only the office can cancel an appointment' USING ERRCODE = '42501';
  END IF;
  IF NOT (
       (v_appt.status = 'scheduled'   AND p_status IN ('en_route', 'cancelled'))
    OR (v_appt.status = 'en_route'    AND p_status IN ('arrived', 'scheduled', 'cancelled'))
    OR (v_appt.status = 'arrived'     AND p_status IN ('in_progress', 'cancelled'))
    OR (v_appt.status = 'in_progress' AND p_status = 'completed')
  ) THEN
    RAISE EXCEPTION 'Cannot change status from % to %', v_appt.status, p_status;
  END IF;
  UPDATE appointments SET status = p_status WHERE id = p_appointment RETURNING * INTO v_appt;
  RETURN v_appt;
END $$;

CREATE FUNCTION public.assign_team_member(p_appointment UUID, p_user UUID, p_active BOOLEAN DEFAULT true)
RETURNS public.appointment_assignments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row appointment_assignments; v_role TEXT;
BEGIN
  IF NOT public.is_office() THEN RAISE EXCEPTION 'Only the office can change assignments' USING ERRCODE = '42501'; END IF;
  SELECT team_role INTO v_role FROM team_members WHERE user_id = p_user AND active;
  IF v_role NOT IN ('arborist', 'crew') THEN RAISE EXCEPTION 'Only active arborists and crew can be assigned'; END IF;
  INSERT INTO appointment_assignments(appointment_id, user_id, assignment_role, active)
  VALUES (p_appointment, p_user, v_role, p_active)
  ON CONFLICT (appointment_id, user_id) DO UPDATE SET active = EXCLUDED.active
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE FUNCTION public.set_location_sharing(p_appointment UUID, p_enabled BOOLEAN) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE appointment_assignments a SET location_sharing = p_enabled
    FROM team_members t
   WHERE a.appointment_id = p_appointment AND a.user_id = auth.uid() AND a.active
     AND t.user_id = a.user_id AND t.active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only assigned team members can share location for this job' USING ERRCODE = '42501';
  END IF;
  IF NOT p_enabled THEN
    DELETE FROM crew_locations WHERE appointment_id = p_appointment AND user_id = auth.uid();
  END IF;
  PERFORM private.log_event(p_appointment, CASE WHEN p_enabled THEN 'location_sharing_enabled' ELSE 'location_sharing_disabled' END);
  RETURN p_enabled;
END $$;

-- Returns false (and stores nothing) unless this member opted in and the job is en route.
-- The device stops reporting as soon as it sees false.
CREATE FUNCTION public.update_crew_location(p_appointment UUID, p_latitude DOUBLE PRECISION, p_longitude DOUBLE PRECISION,
                                            p_accuracy_m REAL DEFAULT NULL) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM appointment_assignments a
      JOIN appointments ap ON ap.id = a.appointment_id
      JOIN team_members t ON t.user_id = a.user_id AND t.active
     WHERE a.appointment_id = p_appointment AND a.user_id = auth.uid()
       AND a.active AND a.location_sharing AND ap.status = 'en_route'
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO crew_locations(appointment_id, user_id, latitude, longitude, accuracy_m, recorded_at)
  VALUES (p_appointment, auth.uid(), p_latitude, p_longitude, p_accuracy_m, now())
  ON CONFLICT (appointment_id, user_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        accuracy_m = EXCLUDED.accuracy_m, recorded_at = EXCLUDED.recorded_at;
  RETURN true;
END $$;

CREATE FUNCTION public.mark_appointment_read(p_appointment UUID, p_read BOOLEAN DEFAULT true) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role TEXT := public.appointment_role(p_appointment); v_count INTEGER;
BEGIN
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized for this appointment' USING ERRCODE = '42501'; END IF;
  INSERT INTO message_receipts(message_id, user_id, delivered_at, read_at)
  SELECT m.id, auth.uid(), now(), CASE WHEN p_read THEN now() END
    FROM appointment_messages m
   WHERE m.appointment_id = p_appointment
     AND m.sender_id IS DISTINCT FROM auth.uid()
     AND (m.visibility = 'shared' OR v_role <> 'customer')
  ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = EXCLUDED.read_at
   WHERE message_receipts.read_at IS NULL AND EXCLUDED.read_at IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF p_read THEN
    UPDATE notifications SET read_at = now()
     WHERE user_id = auth.uid() AND appointment_id = p_appointment AND read_at IS NULL;
  END IF;
  RETURN v_count;
END $$;

CREATE FUNCTION public.mark_notifications_read(p_ids UUID[]) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND id = ANY(p_ids) AND read_at IS NULL;
$$;

-- Used by the dispatch-notifications edge function (service role only).
CREATE FUNCTION public.claim_notification_outbox(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (outbox_id UUID, attempts INTEGER, notification_id UUID, user_id UUID, appointment_id UUID,
               kind TEXT, title TEXT, body TEXT, is_urgent BOOLEAN, email TEXT, phone TEXT, full_name TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH claimed AS (
    UPDATE notification_outbox o SET next_attempt_at = now() + interval '5 minutes', attempts = o.attempts + 1
     WHERE o.id IN (SELECT id FROM notification_outbox
                     WHERE status = 'pending' AND next_attempt_at <= now()
                     ORDER BY next_attempt_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
    RETURNING o.*
  )
  SELECT c.id, c.attempts, n.id, n.user_id, n.appointment_id, n.kind, n.title, n.body, n.is_urgent, p.email, p.phone, p.full_name
    FROM claimed c JOIN notifications n ON n.id = c.notification_id JOIN profiles p ON p.id = n.user_id;
$$;

CREATE FUNCTION public.complete_notification_outbox(p_id UUID, p_success BOOLEAN, p_error TEXT DEFAULT NULL,
                                                    p_retry_at TIMESTAMPTZ DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notification_outbox SET
    status = CASE WHEN p_success THEN 'sent' WHEN p_retry_at IS NULL THEN 'failed' ELSE 'pending' END,
    sent_at = CASE WHEN p_success THEN now() END,
    last_error = CASE WHEN p_success THEN NULL ELSE left(p_error, 500) END,
    next_attempt_at = coalesce(p_retry_at, next_attempt_at)
  WHERE id = p_id;
$$;

-- -------------------------------------------------------------------------------------
-- 6. Row level security (read-only for clients; writes only through the RPCs above)
-- -------------------------------------------------------------------------------------
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hold_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_read ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_team_role() IS NOT NULL);
CREATE POLICY properties_read ON public.properties FOR SELECT TO authenticated
  USING (public.can_view_property(id));
CREATE POLICY jobs_read ON public.jobs FOR SELECT TO authenticated
  USING (public.can_view_job(id));
CREATE POLICY appointments_read ON public.appointments FOR SELECT TO authenticated
  USING (public.can_view_appointment(id));
CREATE POLICY assignments_read ON public.appointment_assignments FOR SELECT TO authenticated
  USING (public.can_view_appointment(appointment_id));
CREATE POLICY messages_read ON public.appointment_messages FOR SELECT TO authenticated
  USING (public.can_view_message(appointment_id, visibility));
CREATE POLICY receipts_read ON public.message_receipts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.appointment_messages m WHERE m.id = message_id));
CREATE POLICY holds_read ON public.appointment_holds FOR SELECT TO authenticated
  USING (public.can_view_appointment(appointment_id));
CREATE POLICY acks_read ON public.hold_acknowledgements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointment_holds h WHERE h.id = hold_id));
CREATE POLICY change_requests_read ON public.appointment_change_requests FOR SELECT TO authenticated
  USING (public.can_view_appointment(appointment_id));
CREATE POLICY crew_locations_read ON public.crew_locations FOR SELECT TO authenticated
  USING (public.can_view_crew_location(appointment_id, user_id, recorded_at));
CREATE POLICY events_read ON public.appointment_events FOR SELECT TO authenticated
  USING (public.appointment_role(appointment_id) IN ('office', 'arborist', 'crew'));
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------------------------------------
-- 7. Privileges
-- -------------------------------------------------------------------------------------
REVOKE ALL ON public.team_members, public.properties, public.jobs, public.appointments,
  public.appointment_assignments, public.appointment_messages, public.message_receipts,
  public.appointment_holds, public.hold_acknowledgements, public.appointment_change_requests,
  public.crew_locations, public.appointment_events, public.notifications, public.notification_outbox
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.team_members, public.properties, public.jobs, public.appointments,
  public.appointment_assignments, public.appointment_messages, public.message_receipts,
  public.appointment_holds, public.hold_acknowledgements, public.appointment_change_requests,
  public.crew_locations, public.appointment_events, public.notifications
  TO authenticated;
GRANT ALL ON public.team_members, public.properties, public.jobs, public.appointments,
  public.appointment_assignments, public.appointment_messages, public.message_receipts,
  public.appointment_holds, public.hold_acknowledgements, public.appointment_change_requests,
  public.crew_locations, public.appointment_events, public.notifications, public.notification_outbox
  TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

DO $$
DECLARE f REGPROCEDURE;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN (
              'current_team_role', 'is_office', 'appointment_role', 'can_view_appointment', 'can_view_job',
              'can_view_property', 'can_view_message', 'can_view_crew_location', 'classify_message_text',
              'send_appointment_message', 'acknowledge_hold', 'resolve_hold', 'decide_change_request',
              'set_appointment_status', 'assign_team_member', 'set_location_sharing', 'update_crew_location',
              'mark_appointment_read', 'mark_notifications_read')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname IN ('claim_notification_outbox', 'complete_notification_outbox')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- 8. Realtime (Supabase applies the RLS policies above to change events)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['appointments', 'appointment_assignments', 'appointment_messages', 'message_receipts',
                             'appointment_holds', 'hold_acknowledgements', 'appointment_change_requests',
                             'crew_locations', 'notifications']
    LOOP
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
