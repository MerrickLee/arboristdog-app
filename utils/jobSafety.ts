// Pure job-safety rules shared by the UI and tests. The database is the source of truth
// (see supabase/migrations/20261014000000_job_communication.sql); these mirror it so the
// app can explain *why* something is blocked without a round trip.

export type TeamRole = 'office' | 'arborist' | 'crew';
export type AppointmentRole = TeamRole | 'customer';
export type AppointmentStatus = 'scheduled' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type MessageCategory =
  | 'general' | 'reschedule' | 'pet_alert' | 'do_not_start' | 'cancellation' | 'scope_change' | 'status';
export type BlockingCategory = 'do_not_start' | 'cancellation' | 'scope_change';
export type Visibility = 'shared' | 'team';

export interface Hold {
  id: string;
  appointment_id: string;
  message_id: string;
  kind: BlockingCategory;
  summary: string;
  status: 'open' | 'resolved';
  opened_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
}
export interface HoldAck { hold_id: string; user_id: string; assignment_role: string; acknowledged_at: string }
export interface Assignment {
  id?: string;
  user_id: string;
  assignment_role: 'arborist' | 'crew';
  display_name: string;
  crew_name?: string | null;
  location_sharing: boolean;
  active: boolean;
}
export interface ChangeRequest {
  id: string;
  kind: 'reschedule' | 'cancellation' | 'scope_change';
  status: 'pending' | 'approved' | 'declined';
  hold_id?: string | null;
  details: string;
  decision_note?: string | null;
  created_at: string;
}

export const BLOCKING_CATEGORIES: readonly BlockingCategory[] = ['do_not_start', 'cancellation', 'scope_change'];
export const isBlockingCategory = (c: string): c is BlockingCategory => (BLOCKING_CATEGORIES as readonly string[]).includes(c);

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  en_route: 'Crew on the way',
  arrived: 'Crew arrived',
  in_progress: 'Work in progress',
  completed: 'Complete',
  cancelled: 'Cancelled',
};

export const CATEGORY_LABELS: Record<MessageCategory, string> = {
  general: 'Message',
  reschedule: 'Different day requested',
  pet_alert: 'Pet on property',
  do_not_start: 'Do not start work',
  cancellation: 'Cancellation request',
  scope_change: 'Scope change',
  status: 'Update',
};

// Keep these patterns identical to public.classify_message_text (Postgres \m/\M == \b here).
const DO_NOT_START = /\b(do not|don'?t|dont|stop|hold off( on)?|halt|pause|wait( to| before)?|no)\s+(start|starting|begin|beginning|work|working|any work)\b/;
const CANCEL = /\bcancel/;
const DO_NOT_CUT = /\b(do not|don'?t|dont|never|not to|no|stop)\s+(cut|cutting|remove|removing|take down|taking down|prune|pruning|trim|trimming|touch|touching|fell|felling|grind|grinding)\b/;
const PET = /\b(dog|dogs|puppy|pet|pets)\b/;

export function classifyMessageText(body: string): MessageCategory {
  const t = (body || '').toLowerCase().replace(/[‘’`]/g, "'").replace(/\s+/g, ' ');
  if (DO_NOT_START.test(t)) return 'do_not_start';
  if (CANCEL.test(t)) return 'cancellation';
  if (DO_NOT_CUT.test(t)) return 'scope_change';
  if (PET.test(t)) return 'pet_alert';
  return 'general';
}

/** The category the server will store: free text can upgrade a message, never downgrade it. */
export function effectiveCategory(requested: MessageCategory, body: string): MessageCategory {
  const detected = classifyMessageText(body);
  if (!isBlockingCategory(requested) && isBlockingCategory(detected)) return detected;
  if (requested === 'general' && detected === 'pet_alert') return detected;
  return requested;
}

export function isUrgentMessage(category: MessageCategory, windowStart: string | Date, now = new Date()): boolean {
  if (category === 'pet_alert' || isBlockingCategory(category)) return true;
  if (category === 'reschedule') return new Date(windowStart).getTime() < now.getTime() + 24 * 3600 * 1000;
  return false;
}

/** Customers always post to the shared thread; crew post team notes; office/arborist choose. */
export function messageVisibility(role: AppointmentRole, requested: Visibility = 'shared'): Visibility {
  if (role === 'customer') return 'shared';
  if (role === 'crew') return 'team';
  return requested;
}

export function canChooseVisibility(role: AppointmentRole | null): boolean {
  return role === 'office' || role === 'arborist';
}

export type Blocker =
  | { type: 'open_hold'; holdId: string }
  | { type: 'unacknowledged'; holdId: string; userId: string; name: string; role: string }
  | { type: 'pending_change'; requestId: string; kind: ChangeRequest['kind'] }
  | { type: 'no_crew_assigned' };

interface SafetyInput {
  holds: Hold[];
  acks: HoldAck[];
  assignments: Assignment[];
  changeRequests: ChangeRequest[];
}

export function pendingAcknowledgements({ holds, acks, assignments }: Omit<SafetyInput, 'changeRequests'>) {
  const active = assignments.filter(a => a.active);
  return holds.map(hold => {
    const ackedBy = new Set(acks.filter(k => k.hold_id === hold.id).map(k => k.user_id));
    return {
      hold,
      acknowledged: active.filter(a => ackedBy.has(a.user_id)),
      pending: active.filter(a => !ackedBy.has(a.user_id)),
    };
  });
}

/** Mirrors private.work_start_blockers. An empty list means work may start. */
export function workStartBlockers(input: SafetyInput): Blocker[] {
  const blockers: Blocker[] = [];
  for (const hold of input.holds) if (hold.status === 'open') blockers.push({ type: 'open_hold', holdId: hold.id });
  for (const { hold, pending } of pendingAcknowledgements(input)) {
    for (const a of pending) {
      blockers.push({ type: 'unacknowledged', holdId: hold.id, userId: a.user_id, name: a.display_name, role: a.assignment_role });
    }
  }
  for (const c of input.changeRequests) if (c.status === 'pending') blockers.push({ type: 'pending_change', requestId: c.id, kind: c.kind });
  if (!input.assignments.some(a => a.active && a.assignment_role === 'crew')) blockers.push({ type: 'no_crew_assigned' });
  return blockers;
}

export function describeBlocker(b: Blocker): string {
  switch (b.type) {
    case 'open_hold': return 'A customer instruction is still open — the office must resolve it.';
    case 'unacknowledged': return `${b.name} (${b.role}) has not acknowledged an instruction.`;
    case 'pending_change': return `A ${b.kind.replace('_', ' ')} request is waiting for an office decision.`;
    case 'no_crew_assigned': return 'No crew is assigned to this job.';
  }
}

/** Status changes the server will accept from this role (mirrors set_appointment_status). */
export function statusActions(role: AppointmentRole | null, status: AppointmentStatus, isOffice = role === 'office') {
  if (!role || role === 'customer') return [] as { to: AppointmentStatus; label: string }[];
  const map: Record<AppointmentStatus, { to: AppointmentStatus; label: string }[]> = {
    scheduled: [{ to: 'en_route', label: 'Start trip' }],
    en_route: [{ to: 'arrived', label: 'Arrived on site' }, { to: 'scheduled', label: 'Pause trip' }],
    arrived: [{ to: 'in_progress', label: 'Start work' }],
    in_progress: [{ to: 'completed', label: 'Mark job complete' }],
    completed: [],
    cancelled: [],
  };
  const actions = [...map[status]];
  if (isOffice && !['in_progress', 'completed', 'cancelled'].includes(status)) actions.push({ to: 'cancelled', label: 'Cancel appointment' });
  return actions;
}

export function canAcknowledge(role: AppointmentRole | null): boolean {
  return role === 'arborist' || role === 'crew';
}

export function canResolveHold(role: AppointmentRole | null, isOffice: boolean): boolean {
  return isOffice || role === 'arborist';
}

export function canDecideChange(role: AppointmentRole | null, isOffice: boolean, kind: ChangeRequest['kind']): boolean {
  return isOffice || (role === 'arborist' && kind === 'scope_change');
}
