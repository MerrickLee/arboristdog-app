import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { BackArrow, CheckIcon, TreeIcon } from '../../components/ui/Icons';
import { Button } from '../../components/ui/Button';
import { ProgressDots } from '../../components/ui/ProgressDots';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

const ISSUES = [
  "Discoloration", "Wilting", "Spots/Lesions", "Dead branches", 
  "Bark damage", "Pest activity", "Fungal growth", "Thinning canopy", 
  "Brown patches", "Bare spots", "Weed takeover", "Moss/algae"
];

export default function ContextScreen() {
  const router = useRouter();
  const { setContext } = useDiagnosisStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState("");

  useTrackScreen('Context');

  const toggle = (item: string) => {
    const nowSelected = selected.includes(item)
      ? selected.filter(x => x !== item)
      : [...selected, item];
    setSelected(nowSelected);
    trackEvent('issue_tag_toggled', { tag: item, selected: !selected.includes(item) });
  };

  const handleNext = () => {
    setContext(selected, text);
    trackEvent('context_submitted', { tag_count: selected.length, has_description: text.length > 0 });
    router.push('/(main)/location');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.stepText}>STEP 2 OF 4</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Mock thumbnail since we don't have the real image URI easily renderable without caching logic here, 
            but in a real app, it would be an Image component with uri = useDiagnosisStore().capturedImage */}
        <View style={styles.thumbnail}>
          <TreeIcon size={32} color="rgba(123,201,80,0.5)" />
          <View style={styles.checkBadge}>
            <CheckIcon />
          </View>
        </View>

        <Text style={styles.title}>Describe the issue</Text>
        <Text style={styles.subtitle}>Select all that apply, then add any extra details.</Text>

        <View style={styles.tagsContainer}>
          {ISSUES.map(issue => {
            const isSelected = selected.includes(issue);
            return (
              <TouchableOpacity
                key={issue}
                style={[
                  styles.tag,
                  isSelected ? styles.tagSelected : styles.tagUnselected
                ]}
                onPress={() => toggle(issue)}
              >
                <Text style={[
                  styles.tagText,
                  isSelected ? styles.tagTextSelected : styles.tagTextUnselected
                ]}>
                  {issue}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="When did this start? Any recent changes to the area? Other details..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={styles.footer}>
        <ProgressDots current={1} total={4} />
        <View style={{ marginTop: 16 }}>
          <Button onPress={handleNext}>Continue</Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canopyDark, // Using base color for gradient mock
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
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
  stepText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    marginTop: 24,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#2a3a22',
    borderWidth: 2,
    borderColor: 'rgba(123,201,80,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
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
    marginBottom: 20,
    lineHeight: 21,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  tagSelected: {
    borderColor: COLORS.leafAccent,
    backgroundColor: 'rgba(123,201,80,0.15)',
  },
  tagUnselected: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: COLORS.leafAccent,
  },
  tagTextUnselected: {
    color: 'rgba(255,255,255,0.7)',
  },
  input: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    padding: 16,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 16,
  },
});
