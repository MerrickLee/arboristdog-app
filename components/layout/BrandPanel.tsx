import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TreeRingPaw } from '../ui/Icons';

export function BrandPanel() {
  return (
    <View style={styles.content} accessibilityLabel="ArboristDog, powered by Almstead Tree, Shrub & Lawn Care">
      <View style={styles.logo}><TreeRingPaw size={80} /></View>
      <Text style={styles.title}>ArboristDog</Text>
      <Text style={styles.powered}>POWERED BY</Text>
      <Text style={styles.company}>Almstead</Text>
      <Text style={styles.description}>Tree, Shrub &amp; Lawn Care</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', width: '100%' },
  logo: { width: 100, height: 100, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  powered: { color: 'rgba(255,255,255,0.6)', fontSize: 13, letterSpacing: 1.5, marginBottom: 6 },
  company: { color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '500', marginBottom: 4 },
  description: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center' },
});
