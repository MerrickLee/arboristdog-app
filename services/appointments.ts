import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { createOutbox, Outbox, OutboxItem } from '../utils/messageOutbox';
import type {
  Assignment, AppointmentStatus, ChangeRequest, Hold, HoldAck, MessageCategory, TeamRole, Visibility,
} from '../utils/jobSafety';
import type { CrewLocation } from '../utils/crewTracking';

export interface AppointmentSummary {
  id: string;
  job_id: string;
  customer_id: string;
  property_id: string;
  service: string;
  window_start: string;
  window_end: string;
  time_zone: string;
  status: AppointmentStatus;
  status_changed_at: string;
  jobs: { title: string; scope: string | null } | null;
  properties: { address: string; latitude: number | null; longitude: number | null } | null;
  appointment_assignments: Assignment[];
  appointment_holds: { id: string; status: Hold['status'] }[];
}
export interface AppointmentMessage {
  id: string;
  appointment_id: string;
  sender_id: string | null;
  sender_role: 'customer' | 'office' | 'arborist' | 'crew' | 'system';
  sender_name: string;
  visibility: Visibility;
  category: MessageCategory;
  body: string;
  is_urgent: boolean;
  on_behalf_of_customer: boolean;
  created_at: string;
}
export interface MessageReceipt { message_id: string; user_id: string; delivered_at: string; read_at: string | null }
export interface AppNotification {
  id: string;
  appointment_id: string | null;
  kind: string;
  title: string;
  body: string;
  is_urgent: boolean;
  created_at: string;
  read_at: string | null;
}
export interface AppointmentDetail {
  appointment: AppointmentSummary;
  messages: AppointmentMessage[];
  receipts: MessageReceipt[];
  holds: Hold[];
  acks: HoldAck[];
  changeRequests: ChangeRequest[];
  locations: CrewLocation[];
}

const SUMMARY_SELECT = '*, jobs(title, scope), properties(address, latitude, longitude), appointment_assignments(*), appointment_holds(id, status)';

const unwrap = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

export async function fetchTeamRole(userId: string): Promise<TeamRole | null> {
  const { data } = await supabase.from('team_members').select('team_role, active').eq('user_id', userId).maybeSingle();
  return data?.active ? (data.team_role as TeamRole) : null;
}

/** Upcoming and recent appointments the caller may see (RLS scopes customers to their own). */
export async function fetchAppointments(): Promise<AppointmentSummary[]> {
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  return unwrap(await supabase.from('appointments').select(SUMMARY_SELECT)
    .gte('window_end', since).order('window_start', { ascending: true }).limit(100));
}

export async function fetchAppointmentDetail(id: string): Promise<AppointmentDetail> {
  const [appointment, messages, receipts, holds, acks, changeRequests, locations] = await Promise.all([
    supabase.from('appointments').select(SUMMARY_SELECT).eq('id', id).single(),
    supabase.from('appointment_messages').select('*').eq('appointment_id', id).order('created_at', { ascending: true }),
    supabase.from('message_receipts').select('message_id, user_id, delivered_at, read_at, appointment_messages!inner(appointment_id)')
      .eq('appointment_messages.appointment_id', id),
    supabase.from('appointment_holds').select('*').eq('appointment_id', id).order('opened_at', { ascending: true }),
    supabase.from('hold_acknowledgements').select('hold_id, user_id, assignment_role, acknowledged_at, appointment_holds!inner(appointment_id)')
      .eq('appointment_holds.appointment_id', id),
    supabase.from('appointment_change_requests').select('*').eq('appointment_id', id).order('created_at', { ascending: true }),
    supabase.from('crew_locations').select('*').eq('appointment_id', id),
  ]);
  return {
    appointment: unwrap(appointment) as AppointmentSummary,
    messages: unwrap(messages) as AppointmentMessage[],
    receipts: unwrap(receipts) as unknown as MessageReceipt[],
    holds: unwrap(holds) as Hold[],
    acks: unwrap(acks) as unknown as HoldAck[],
    changeRequests: unwrap(changeRequests) as ChangeRequest[],
    locations: unwrap(locations) as CrewLocation[],
  };
}

export async function acknowledgeHold(holdId: string) {
  return unwrap(await supabase.rpc('acknowledge_hold', { p_hold: holdId }));
}
export async function resolveHold(holdId: string, note: string) {
  return unwrap(await supabase.rpc('resolve_hold', { p_hold: holdId, p_note: note }));
}
export async function decideChangeRequest(id: string, approve: boolean, note: string, windowStart?: string, windowEnd?: string) {
  return unwrap(await supabase.rpc('decide_change_request', {
    p_request: id, p_approve: approve, p_note: note, p_window_start: windowStart ?? null, p_window_end: windowEnd ?? null,
  }));
}
export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  return unwrap(await supabase.rpc('set_appointment_status', { p_appointment: id, p_status: status }));
}
export async function setLocationSharing(id: string, enabled: boolean) {
  return unwrap(await supabase.rpc('set_location_sharing', { p_appointment: id, p_enabled: enabled }));
}
export async function updateCrewLocation(id: string, latitude: number, longitude: number, accuracy?: number | null): Promise<boolean> {
  return unwrap(await supabase.rpc('update_crew_location', {
    p_appointment: id, p_latitude: latitude, p_longitude: longitude, p_accuracy_m: accuracy ?? null,
  })) as boolean;
}
export async function markAppointmentRead(id: string, read = true) {
  await supabase.rpc('mark_appointment_read', { p_appointment: id, p_read: read });
}
export async function fetchNotifications(): Promise<AppNotification[]> {
  return unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
}
export async function markNotificationsRead(ids: string[]) {
  if (ids.length) await supabase.rpc('mark_notifications_read', { p_ids: ids });
}

/** Postgres error text for WORK_BLOCKED etc., in a form suitable for an alert. */
export function describeError(error: unknown): string {
  const e = error as { message?: string; hint?: string };
  if (e?.message === 'WORK_BLOCKED') return e.hint || 'Work is blocked until every instruction is resolved and acknowledged.';
  return e?.message || 'Something went wrong. Please try again.';
}

/** Re-fetch on any change to this appointment. Also fires once subscribed, to cover gaps. */
export function subscribeToAppointment(id: string, onChange: () => void) {
  const channel = supabase.channel(`appointment:${id}:${Date.now()}`);
  for (const table of ['appointment_messages', 'appointment_holds', 'appointment_change_requests', 'appointment_assignments', 'crew_locations']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `appointment_id=eq.${id}` }, onChange);
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `id=eq.${id}` }, onChange);
  // No appointment_id column on these; RLS limits events to rows the user may see.
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hold_acknowledgements' }, onChange);
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'message_receipts' }, onChange);
  channel.subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToNotifications(userId: string, onInsert: (n: AppNotification) => void, onResubscribe: () => void) {
  const channel = supabase.channel(`notifications:${userId}:${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      payload => onInsert(payload.new as AppNotification))
    .subscribe(status => { if (status === 'SUBSCRIBED') onResubscribe(); });
  return () => { supabase.removeChannel(channel); };
}

// ---- Offline outbox (per signed-in user, persisted in AsyncStorage) ----
let current: { userId: string; outbox: Outbox } | null = null;

async function deliver(item: OutboxItem) {
  if (item.kind === 'ack') { await acknowledgeHold(item.id); return; }
  unwrap(await supabase.rpc('send_appointment_message', {
    p_id: item.id,
    p_appointment: item.appointmentId,
    p_body: item.body,
    p_category: item.category,
    p_visibility: item.visibility,
    p_on_behalf_of_customer: item.onBehalfOfCustomer,
    p_client_created_at: item.createdAt,
  }));
}

export function getOutbox(userId: string): Outbox {
  if (current?.userId !== userId) {
    const key = `appointment-outbox:v1:${userId}`;
    current = {
      userId,
      outbox: createOutbox({
        load: async () => JSON.parse((await AsyncStorage.getItem(key)) || '[]'),
        save: items => AsyncStorage.setItem(key, JSON.stringify(items)),
        send: deliver,
      }),
    };
  }
  return current.outbox;
}

/** Called on sign-out. Queued items stay on disk for that user; they are never discarded here. */
export function releaseOutbox() { current = null; }
