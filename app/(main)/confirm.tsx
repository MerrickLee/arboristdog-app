import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, CheckIcon, TreeIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/authStore';
import { useDiagnosisStore } from '../../stores/diagnosisStore';

export default function ConfirmScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { resetSession } = useDiagnosisStore();
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState('');
  const [preferredTime, setPreferredTime] = useState('morning');

  const TIMES = ['Morning', 'Afternoon', 'Evening'];

  const handleSubmit = () => {
    // In real app: submit lead to Supabase
    setSubmitted(true);
  };

  const handleRestart = () => {
    resetSession();
    router.replace('/(main)/capture');
  };

  if (submitted) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }]}>
        <View style={styles.successIcon}>
          <Text style={{ fontSize: 24 }}>✓</Text>
        </View>
        <Text style={styles.titleCenter}>You're all set!</Text>
        <Text style={styles.subtitleCenter}>
          A certified arborist from Almstead will reach out within 24 hours to discuss your diagnosis.
        </Text>
        <Text style={styles.noteCenter}>
          Your diagnosis report has been saved and will be shared with the arborist before they contact you.
        </Text>
        <View style={{ width: '100%', marginTop: 24 }}>
          <Button variant="secondary" onPress={handleRestart}>Diagnose Another Issue</Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Get expert help</Text>
        <Text style={styles.subtitle}>
          We already have your contact info from sign-in. Just confirm you'd like an ISA-certified arborist to review your diagnosis and follow up.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>YOUR INFO</Text>
            <CheckIcon />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue}>{user?.email || 'email@example.com'}</Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>{user?.phone || '(Not provided)'}</Text>
          </View>
        </View>

        <Text style={styles.label}>BEST TIME TO REACH YOU</Text>
        <View style={styles.toggleRow}>
          {TIMES.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.toggleBtn, 
                preferredTime === time.toLowerCase() ? styles.toggleActive : styles.toggleInactive
              ]}
              onPress={() => setPreferredTime(time.toLowerCase())}
            >
              <Text style={[
                styles.toggleText, 
                preferredTime === time.toLowerCase() ? styles.toggleTextActive : styles.toggleTextInactive
              ]}>{time}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>ANYTHING ELSE? (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          placeholder="E.g., best entrance, gate code, specific concerns..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />

        <View style={styles.infoBox}>
          <TreeIcon size={20} color="rgba(255,255,255,0.4)" />
          <Text style={styles.infoText}>
            Almstead has been caring for landscapes across the NY/NJ/CT tri-state area since 1964. All consultations are complimentary.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleSubmit}>Request Free Consultation</Button>
        <TouchableOpacity style={styles.noThanksBtn} onPress={handleRestart}>
          <Text style={styles.noThanksText}>No thanks, just the diagnosis</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 21,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  rowValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    borderColor: COLORS.leafAccent,
    backgroundColor: 'rgba(123,201,80,0.12)',
  },
  toggleInactive: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: COLORS.leafAccent,
  },
  toggleTextInactive: {
    color: 'rgba(255,255,255,0.6)',
  },
  input: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    padding: 14,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  noThanksBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  noThanksText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(123,201,80,0.15)',
    borderWidth: 2,
    borderColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  titleCenter: {
    fontSize: 26,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitleCenter: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  noteCenter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 32,
    lineHeight: 20,
    textAlign: 'center',
  },
});
