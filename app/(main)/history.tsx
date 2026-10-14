import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, AlertIcon, TreeIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../stores/authStore';
import { SavedDiagnosis, useDiagnosisStore } from '../../stores/diagnosisStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#4CAF50',
  moderate: COLORS.alertAmber,
  high: '#E53935',
};

export default function HistoryScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const { user } = useAuthStore();
  const { restoreDiagnosis, historyPreview, setHistoryPreview } = useDiagnosisStore();
  const [diagnoses, setDiagnoses] = useState<SavedDiagnosis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useTrackScreen('History');

  const fetchDiagnoses = useCallback(async () => {
    if (!user?.id) { setLoading(false); setRefreshing(false); setHistoryPreview(null); return; }
    try {
      const { data, error } = await supabase
        .from('diagnoses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[History] Supabase error:', error.message);
        setDiagnoses([]);
        setHistoryPreview(null);
      } else if (data) {
        setDiagnoses(data);
        const previousId = useDiagnosisStore.getState().historyPreview?.id;
        setHistoryPreview(data.find(item => item.id === previousId) || null);
      }
    } catch (err) {
      console.error('[History] Failed to fetch diagnoses:', err);
      setDiagnoses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, setHistoryPreview]);

  useFocusEffect(
    useCallback(() => {
      fetchDiagnoses();
    }, [fetchDiagnoses])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDiagnoses();
  };

  const handleViewDiagnosis = (diagnosis: SavedDiagnosis) => {
    if (diagnosis.diagnosis_json) {
      setHistoryPreview(diagnosis);
      if (!layout.expanded) {
        restoreDiagnosis(diagnosis);
        router.push('/(main)/results');
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Empty state
  if (!loading && diagnoses.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <BackArrow />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan History</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <TreeIcon size={48} color="rgba(123,201,80,0.3)" />
          </View>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySub}>
            Your AI diagnosis history will appear here after your first scan.
          </Text>
          <View style={{ width: 200, marginTop: 24 }}>
            <Button onPress={() => router.replace('/(main)/capture')}>
              Start First Scan
            </Button>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: layout.headerPaddingTop }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan History</Text>
        <Text style={styles.headerCount}>{diagnoses.length} scan{diagnoses.length !== 1 ? 's' : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.leafAccent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.leafAccent}
            />
          }
        >
          {diagnoses.map(diagnosis => (
            <TouchableOpacity
              key={diagnosis.id}
              style={[styles.card, historyPreview?.id === diagnosis.id && styles.selectedCard]}
              accessibilityRole="button"
              accessibilityState={{ selected: historyPreview?.id === diagnosis.id }}
              onPress={() => handleViewDiagnosis(diagnosis)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIconWrap}>
                  <AlertIcon size={18} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardCondition} numberOfLines={1}>
                    {diagnosis.condition_name || 'Unknown Condition'}
                  </Text>
                  <Text style={styles.cardDate}>{formatDate(diagnosis.created_at)}</Text>
                </View>
                <View style={styles.cardArrow}>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>›</Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={[
                  styles.severityBadge,
                  { backgroundColor: `${SEVERITY_COLORS[diagnosis.severity] || '#888'}15` }
                ]}>
                  <View style={[
                    styles.severityDot,
                    { backgroundColor: SEVERITY_COLORS[diagnosis.severity] || '#888' }
                  ]} />
                  <Text style={[
                    styles.severityText,
                    { color: SEVERITY_COLORS[diagnosis.severity] || '#888' }
                  ]}>
                    {diagnosis.severity}
                  </Text>
                </View>

                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>
                    {diagnosis.confidence}% confidence
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
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
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  headerCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  selectedCard: { borderColor: COLORS.leafAccent },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212,160,23,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardCondition: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  cardArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBottom: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  severityText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  confidencePill: {
    backgroundColor: 'rgba(123,201,80,0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    color: COLORS.leafAccent,
    fontWeight: '600',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
