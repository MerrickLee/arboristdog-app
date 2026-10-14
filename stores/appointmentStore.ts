import { create } from 'zustand';
import type { TeamRole } from '../utils/jobSafety';
import type { OutboxItem } from '../utils/messageOutbox';
import type { AppNotification, AppointmentSummary } from '../services/appointments';

interface AppointmentState {
  teamRole: TeamRole | null;
  appointments: AppointmentSummary[];
  notifications: AppNotification[];
  toast: AppNotification | null;
  outbox: OutboxItem[];
  setTeamRole: (role: TeamRole | null) => void;
  setAppointments: (appointments: AppointmentSummary[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  addNotification: (notification: AppNotification) => void;
  markRead: (ids: string[]) => void;
  showToast: (notification: AppNotification | null) => void;
  setOutbox: (items: OutboxItem[]) => void;
  reset: () => void;
}

const initial = { teamRole: null, appointments: [], notifications: [], toast: null, outbox: [] };

export const useAppointmentStore = create<AppointmentState>(set => ({
  ...initial,
  setTeamRole: teamRole => set({ teamRole }),
  setAppointments: appointments => set({ appointments }),
  setNotifications: notifications => set({ notifications }),
  addNotification: n => set(state => (
    state.notifications.some(x => x.id === n.id) ? state : { notifications: [n, ...state.notifications] }
  )),
  markRead: ids => set(state => ({
    notifications: state.notifications.map(n => (ids.includes(n.id) && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
  })),
  showToast: toast => set({ toast }),
  setOutbox: outbox => set({ outbox }),
  reset: () => set(initial),
}));

export const unreadCount = (s: AppointmentState) => s.notifications.filter(n => !n.read_at).length;
export const urgentUnreadCount = (s: AppointmentState) => s.notifications.filter(n => !n.read_at && n.is_urgent).length;
