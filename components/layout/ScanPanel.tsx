import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';
import { TreeIcon, LocationIcon } from '../ui/Icons';
import { useDiagnosisStore } from '../../stores/diagnosisStore';

export function ScanPanel() {
  const { capturedImage, remoteImageUrl, selectedTags, description, location } = useDiagnosisStore();
  return (
    <View>
      <Text style={styles.label}>YOUR SCAN</Text>
      <ScanPhoto uri={capturedImage || remoteImageUrl} />
      <Text style={styles.title}>Your landscape, in focus.</Text>
      <View style={styles.tags}>{selectedTags.map(tag => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
      {!!description && <Text style={styles.description}>{description}</Text>}
      {!!location?.address && (
        <View style={styles.location}><LocationIcon size={20} color={COLORS.leafAccent} /><View style={{ flex: 1 }}><Text style={styles.description}>{location.address}</Text><Text style={styles.detail}>{location.propertyType === 'commercial' ? 'Commercial' : 'Residential'}</Text></View></View>
      )}
    </View>
  );
}

export function ScanPhoto({ uri }: { uri: string | null | undefined }) {
  return uri ? (
    <Image source={{ uri }} style={styles.photo} resizeMode="contain" accessibilityLabel="Photo of the landscape issue" />
  ) : (
    <View style={[styles.photo, styles.empty]}><TreeIcon size={56} color={COLORS.leafAccent} /><Text style={styles.detail}>Your scan photo will appear here</Text></View>
  );
}

const styles = StyleSheet.create({
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 1.5, marginBottom: 16, fontWeight: '600' },
  photo: { width: '100%', aspectRatio: 1, maxHeight: 380, backgroundColor: '#142C11', borderRadius: 18, marginBottom: 24 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: { color: COLORS.leafAccent, fontSize: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(123,201,80,0.35)', backgroundColor: 'rgba(123,201,80,0.1)' },
  description: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21 },
  detail: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 6 },
  location: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, marginTop: 20 },
});
