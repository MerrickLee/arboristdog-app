import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, ScrollView } from 'react-native';
import { COLORS } from '../../constants/theme';
import { AppointmentMessage, MessageReceipt } from '../../services/appointments';
import { OutboxItem, OutboxMessage } from '../../utils/messageOutbox';
import {
  AppointmentRole, CATEGORY_LABELS, MessageCategory, Visibility, canChooseVisibility, effectiveCategory, isBlockingCategory,
} from '../../utils/jobSafety';
import { PALETTE } from './StatusBits';

const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function MessageList({ messages, receipts, queued, userId, onRetry, onDiscard }: {
  messages: AppointmentMessage[];
  receipts: MessageReceipt[];
  queued: OutboxItem[];
  userId: string;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const sentIds = new Set(messages.map(m => m.id));
  const pending = queued.filter((q): q is OutboxMessage => q.kind === 'message' && !sentIds.has(q.id));
  if (!messages.length && !pending.length) {
    return <Text style={styles.empty}>No messages yet. Use the box below for anything about this visit — the office, your arborist and crew all see it here.</Text>;
  }
  return (
    <View style={styles.list}>
      {messages.map(m => {
        if (m.sender_role === 'system') {
          return <Text key={m.id} style={styles.system}>{m.body} · {time(m.created_at)}</Text>;
        }
        const mine = m.sender_id === userId;
        const mineReceipts = receipts.filter(r => r.message_id === m.id && r.user_id !== userId);
        const delivery = mineReceipts.some(r => r.read_at) ? 'Read' : mineReceipts.length ? 'Delivered' : 'Sent';
        const blocking = isBlockingCategory(m.category);
        return (
          <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs, m.is_urgent && styles.urgent]}>
            <View style={styles.metaRow}>
              <Text style={styles.sender}>{mine ? 'You' : m.sender_name}</Text>
              {m.sender_role !== 'customer' && <Text style={styles.role}>{m.sender_role}</Text>}
              {m.visibility === 'team' && <Text style={styles.teamTag}>TEAM ONLY</Text>}
            </View>
            {m.category !== 'general' && (
              <Text style={[styles.category, blocking && { color: PALETTE.danger }]}>{blocking ? '⛔ ' : ''}{CATEGORY_LABELS[m.category]}</Text>
            )}
            {m.on_behalf_of_customer && <Text style={styles.onBehalf}>Logged on behalf of the customer</Text>}
            <Text style={styles.body}>{m.body}</Text>
            <Text style={styles.time}>{time(m.created_at)}{mine ? ` · ${delivery}` : ''}</Text>
          </View>
        );
      })}
      {pending.map(q => (
        <View key={q.id} style={[styles.bubble, styles.mine, styles.queued]}>
          <Text style={styles.body}>{q.body}</Text>
          {q.failed ? (
            <View style={styles.failedRow}>
              <Text style={styles.failedText}>Not sent: {q.lastError}</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => onRetry(q.id)}><Text style={styles.link}>Retry</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => onDiscard(q.id)}><Text style={styles.linkMuted}>Discard</Text></TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.time}>{q.attempts > 0 ? 'Waiting for connection — will send automatically' : 'Sending…'}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const QUICK_ACTIONS: { category: MessageCategory; label: string; prefill: string }[] = [
  { category: 'do_not_start', label: '⛔ Do not start work', prefill: 'Please do not start work until I confirm.' },
  { category: 'scope_change', label: "Don't cut a tree", prefill: 'Please do not cut ' },
  { category: 'pet_alert', label: '🐕 Dog in the yard', prefill: "Heads up: there's a dog in the yard." },
  { category: 'reschedule', label: 'Different day', prefill: 'Could we move this to ' },
  { category: 'cancellation', label: 'Cancel visit', prefill: 'Please cancel this appointment.' },
];

export function Composer({ role, onSend }: {
  role: AppointmentRole | null;
  onSend: (input: { body: string; category: MessageCategory; visibility: Visibility; onBehalfOfCustomer: boolean }) => void;
}) {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<MessageCategory>('general');
  const [visibility, setVisibility] = useState<Visibility>('shared');
  const [onBehalf, setOnBehalf] = useState(false);
  if (!role) return null;

  const resolved = effectiveCategory(category, body);
  const willStop = isBlockingCategory(resolved);
  const send = () => {
    const text = body.trim();
    if (!text) return;
    onSend({ body: text, category, visibility, onBehalfOfCustomer: onBehalf });
    setBody('');
    setCategory('general');
    setOnBehalf(false);
  };

  return (
    <View style={styles.composer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {QUICK_ACTIONS.filter(a => role !== 'crew' || a.category !== 'reschedule').map(a => (
          <TouchableOpacity key={a.category} accessibilityRole="button" accessibilityState={{ selected: category === a.category }}
            style={[styles.chip, category === a.category && styles.chipOn, a.category === 'do_not_start' && styles.chipStop]}
            onPress={() => { setCategory(a.category); if (!body.trim() || QUICK_ACTIONS.some(q => q.prefill === body)) setBody(a.prefill); }}>
            <Text style={[styles.chipText, a.category === 'do_not_start' && { color: PALETTE.danger }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {willStop && (
        <Text style={styles.stopNote} accessibilityLiveRegion="polite">
          This will be sent as an urgent “{CATEGORY_LABELS[resolved]}” instruction. Work stays blocked until the crew acknowledges it and the office confirms.
        </Text>
      )}

      {canChooseVisibility(role) && (
        <View style={styles.toggles}>
          <View style={styles.toggle}>
            <Switch value={visibility === 'team'} onValueChange={v => setVisibility(v ? 'team' : 'shared')} accessibilityLabel="Team only" />
            <Text style={styles.toggleText}>{visibility === 'team' ? 'Team only' : 'Customer can see'}</Text>
          </View>
          {role === 'office' && (
            <View style={styles.toggle}>
              <Switch value={onBehalf} onValueChange={setOnBehalf} accessibilityLabel="Logged from a customer call" />
              <Text style={styles.toggleText}>From customer call</Text>
            </View>
          )}
        </View>
      )}
      {role === 'crew' && <Text style={styles.crewNote}>Crew notes go to the office and assigned team only.</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder={role === 'customer' ? 'Message about this appointment…' : 'Message…'}
          placeholderTextColor={PALETTE.faint}
          multiline
          maxLength={4000}
          accessibilityLabel="Message"
        />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" disabled={!body.trim()}
          style={[styles.send, willStop && { backgroundColor: PALETTE.danger }, !body.trim() && { opacity: 0.4 }]} onPress={send}>
          <Text style={styles.sendText}>{willStop ? 'Send stop' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { color: PALETTE.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', paddingVertical: 12 },
  system: { color: PALETTE.faint, fontSize: 12, textAlign: 'center', paddingVertical: 2 },
  bubble: { maxWidth: '88%', borderRadius: 16, padding: 12, gap: 3 },
  mine: { alignSelf: 'flex-end', backgroundColor: 'rgba(123,201,80,0.18)', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: PALETTE.card, borderBottomLeftRadius: 4 },
  urgent: { borderWidth: 1.5, borderColor: PALETTE.dangerBorder },
  queued: { opacity: 0.75, borderWidth: 1, borderStyle: 'dashed', borderColor: PALETTE.border },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sender: { color: '#fff', fontWeight: '700', fontSize: 13 },
  role: { color: PALETTE.faint, fontSize: 11, textTransform: 'capitalize' },
  teamTag: { color: COLORS.alertAmber, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  category: { color: COLORS.alertAmber, fontSize: 12, fontWeight: '700' },
  onBehalf: { color: PALETTE.muted, fontSize: 11, fontStyle: 'italic' },
  body: { color: '#fff', fontSize: 15, lineHeight: 21 },
  time: { color: PALETTE.faint, fontSize: 11, marginTop: 2 },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  failedText: { color: PALETTE.danger, fontSize: 12, flexShrink: 1 },
  link: { color: COLORS.leafAccent, fontWeight: '700', fontSize: 13 },
  linkMuted: { color: PALETTE.muted, fontSize: 13 },
  composer: { borderTopWidth: 1, borderTopColor: PALETTE.border, backgroundColor: '#15300F', paddingTop: 10, paddingHorizontal: 16, gap: 8 },
  chips: { gap: 8, paddingRight: 16 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: PALETTE.card, borderWidth: 1, borderColor: PALETTE.border },
  chipOn: { borderColor: COLORS.leafAccent, backgroundColor: 'rgba(123,201,80,0.15)' },
  chipStop: { borderColor: PALETTE.dangerBorder },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  stopNote: { color: PALETTE.danger, fontSize: 12, lineHeight: 17 },
  toggles: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleText: { color: PALETTE.muted, fontSize: 12 },
  crewNote: { color: PALETTE.faint, fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, color: '#fff', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 14, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: 120, fontSize: 15 },
  send: { backgroundColor: COLORS.almsteadLight, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  sendText: { color: '#fff', fontWeight: '800' },
});
