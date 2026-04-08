import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, AlertIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useAuthStore } from '../../stores/authStore';
import { useCreditStore } from '../../stores/creditStore';

export default function ResultsScreen() {
  const router = useRouter();
  const { result } = useDiagnosisStore();
  const { user } = useAuthStore();
  const { creditsRemaining } = useCreditStore();

  if (!result) return null; // Or Loading indicator

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(main)/capture')}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerLabel}>DIAGNOSIS</Text>
        </View>
        <View style={styles.headerContent}>
          <AlertIcon size={24} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.conditionName}>{result.condition_name}</Text>
            <Text style={styles.severityLabel}>Fungal infection - {result.severity} severity</Text>
          </View>
        </View>
      </View>

      <View style={styles.creditsBanner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.creditsBadge}>
            <Text style={styles.creditsNum}>{creditsRemaining}</Text>
          </View>
          <Text style={styles.creditsText}>{creditsRemaining} scans remaining this month</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(main)/credits')} style={styles.getMoreBtn}>
          <Text style={styles.getMoreText}>Get more</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Confidence</Text>
            <Text style={styles.confidenceScore}>{result.confidence}%</Text>
          </View>
          <View style={styles.barBackground}>
            <View style={[styles.barFill, { width: `${result.confidence}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What's happening</Text>
          <Text style={styles.explanationText}>{result.explanation}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommended actions</Text>
          {result.actions.map((action, i) => (
            <View key={i} style={styles.actionItem}>
              <View style={[styles.priorityBadge, { backgroundColor: `${action.color}15` }]}>
                <Text style={[styles.priorityText, { color: action.color }]}>{action.priority}</Text>
              </View>
              <Text style={styles.actionText}>{action.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            This AI diagnosis is a starting point. For treatment recommendations that follow ANSI A300 standards, a certified arborist should evaluate your tree in person.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={() => router.push('/(main)/confirm')} variant="dark">
          Get Expert Help Free
        </Button>
        <Text style={styles.footerNote}>A certified arborist will review your case</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  header: {
    backgroundColor: COLORS.canopyDark,
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight: '600',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  conditionName: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  severityLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  creditsBanner: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  creditsBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(123,201,80,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.leafAccent,
  },
  creditsNum: {
    color: COLORS.leafAccent,
    fontSize: 10,
    fontWeight: '700',
  },
  creditsText: {
    fontSize: 12,
    color: '#888',
  },
  getMoreBtn: {
    backgroundColor: COLORS.leafAccent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  getMoreText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.barkBrown,
    marginBottom: 12,
  },
  confidenceScore: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.almsteadGreen,
  },
  barBackground: {
    height: 6,
    backgroundColor: COLORS.warmGray,
    borderRadius: 3,
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.almsteadGreen, // Ideally gradient
    borderRadius: 3,
  },
  explanationText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  priorityBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 10,
    marginTop: 2,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    flex: 1,
  },
  disclaimerBox: {
    backgroundColor: 'rgba(45,90,39,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(45,90,39,0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  footerNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 12,
  },
});
