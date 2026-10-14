import { useAdaptiveLayout } from '../../hooks/useAdaptiveLayout';
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { CameraIcon, TreeIcon, TreeRingPaw, ClockIcon, GearIcon, FlashIcon, GalleryIcon } from '../../components/ui/Icons';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';
import { ActiveTripPill, AppointmentsButton } from '../../components/appointments/EntryPoints';

export default function CaptureScreen() {
  const layout = useAdaptiveLayout();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { setCapturedImage, resetSession } = useDiagnosisStore();
  const permissionRequested = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');

  useTrackScreen('Capture');

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !permissionRequested.current) {
      permissionRequested.current = true;
      requestPermission().catch(() => Alert.alert('Camera unavailable', 'You can choose a photo from your library instead.'));
    }
  }, [permission, requestPermission]);

  const handleCapture = async () => {
    trackEvent('photo_captured', { method: 'camera' });
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.8,
        });
        if (photo?.uri) {
          resetSession();
          setCapturedImage(photo.uri);
          router.push('/(main)/context');
        }
      } catch {
        Alert.alert('Error', 'Failed to capture photo.');
      }
    }
  };

  const handleGallery = async () => {
    trackEvent('photo_captured', { method: 'gallery' });
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      resetSession();
      setCapturedImage(result.assets[0].uri);
      router.push('/(main)/context');
    }
  };

  const frameSize = Math.max(100, Math.min(260, (layout.expanded ? layout.supportWidth : layout.mainWidth) - 48, layout.height - 230));

  if (!permission?.granted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.permissionContent, { paddingTop: layout.headerPaddingTop, paddingBottom: layout.footerPaddingBottom }]}>
        <TreeRingPaw size={80} />
        <Text style={styles.permissionTitle}>Enable your camera</Text>
        <Text style={styles.instruction}>We need your permission to show the camera.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.permissionButton} onPress={() => permission?.canAskAgain ? requestPermission() : Linking.openSettings()}>
          <Text style={styles.permissionButtonText}>{permission?.canAskAgain ? 'Allow Camera Access' : 'Open Settings'}</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.permissionButton} onPress={handleGallery}><Text style={styles.permissionButtonText}>Choose from photos</Text></TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, layout.expanded && styles.expandedContainer]}>
      <View style={[styles.cameraPane, layout.expanded && { flexBasis: layout.supportWidth, flexGrow: 0, flexShrink: 0 }]}>
      <CameraView style={styles.camera} ref={cameraRef} flash={flashMode} onCameraReady={() => setIsReady(true)}>
        <View style={[styles.header, { paddingTop: layout.headerPaddingTop }, layout.expanded && { display: 'none' }]}>
          <View style={styles.headerLeft}>
            <ActiveTripPill />
          </View>
          <View style={styles.headerRight}>
            <AppointmentsButton />
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan History" style={styles.headerBtn} onPress={() => router.push('/(main)/history')}>
              <ClockIcon size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Settings" style={styles.headerBtn} onPress={() => router.push('/(main)/settings')}>
              <GearIcon size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Viewfinder Frame */}
        <View style={styles.viewfinderContainer}>
          <View style={[styles.viewfinder, { width: frameSize, height: frameSize }]}>
            {/* Corners would be CSS borders in web, here we use absolute positioned views */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            <View style={styles.viewfinderCenter}>
              <TreeIcon size={40} color="rgba(123,201,80,0.4)" />
              <Text style={styles.viewfinderText}>Point at the issue</Text>
            </View>
          </View>
        </View>

        {/* Scan Ready Badge */}
        {isReady && (
          <View style={[styles.scanReadyBadge, { top: layout.headerPaddingTop + 48 }]}>
            <Text style={styles.scanReadyText}>SCAN READY</Text>
          </View>
        )}
      </CameraView>
      </View>
      <ScrollView style={[styles.controlsPane, layout.expanded ? styles.expandedControlsPane : { height: 160 + layout.footerPaddingBottom }]} contentContainerStyle={[styles.controls, { paddingBottom: layout.footerPaddingBottom }, layout.expanded && styles.expandedControls]}>
        {layout.expanded && <View style={styles.captureIntro}>
          <TreeRingPaw size={72} />
          <Text style={styles.permissionTitle}>Snap a photo</Text>
          <Text style={styles.instruction}>Point at the tree, shrub, or lawn issue.</Text>
        </View>}
        <Text style={styles.instruction}>Capture the affected area clearly</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose from photos" style={styles.galleryButton} onPress={handleGallery}>
            <GalleryIcon size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Capture landscape photo" disabled={!isReady} style={[styles.captureButtonOuter, !isReady && { opacity: 0.5 }]} onPress={handleCapture}>
            <View style={styles.captureButtonInner}>
              <CameraIcon />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Toggle flash"
            accessibilityState={{ selected: flashMode === 'on' }}
            style={[styles.flashButton, flashMode === 'on' && styles.flashButtonActive]}
            onPress={() => setFlashMode(prev => prev === 'off' ? 'on' : 'off')}
          >
            <FlashIcon size={20} color={flashMode === 'on' ? COLORS.leafAccent : '#fff'} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraPane: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 150 },
  controlsPane: { flexGrow: 0, flexShrink: 0 },
  expandedContainer: { flexDirection: 'row' },
  expandedControlsPane: { flexGrow: 1, flexShrink: 1, flexBasis: 0, backgroundColor: COLORS.canopyDark },
  expandedControls: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: COLORS.canopyDark },
  captureIntro: { alignItems: 'center', marginBottom: 30 },
  permissionContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  permissionTitle: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center', marginVertical: 20 },
  permissionButton: { backgroundColor: COLORS.almsteadGreen, padding: 16, borderRadius: 14, marginTop: 12, width: '100%', maxWidth: 360, alignItems: 'center' },
  permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  camera: {
    flex: 1,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnIcon: {
    fontSize: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: 'rgba(123,201,80,0.5)',
    borderRadius: 20,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: COLORS.leafAccent,
  },
  topLeft: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  viewfinderCenter: {
    alignItems: 'center',
  },
  viewfinderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 8,
  },
  scanReadyBadge: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scanReadyText: {
    color: COLORS.leafAccent,
    fontSize: 11,
    fontWeight: '600',
  },
  controls: {
    backgroundColor: '#111',
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  instruction: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryIcon: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    opacity: 0.5,
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(123,201,80,0.2)',
    borderColor: COLORS.leafAccent,
  },
  captureButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.leafAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
