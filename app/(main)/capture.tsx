import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { CameraIcon, TreeIcon, BackArrow } from '../../components/ui/Icons';
import { useDiagnosisStore } from '../../stores/diagnosisStore';
import { useTrackScreen } from '../../hooks/useTrackScreen';
import { trackEvent } from '../../services/analytics';

export default function CaptureScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { setCapturedImage } = useDiagnosisStore();
  const [isReady, setIsReady] = useState(false);

  useTrackScreen('Capture');

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleCapture = async () => {
    trackEvent('photo_captured', { method: 'camera' });
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.8,
        });
        if (photo?.uri) {
          setCapturedImage(photo.uri);
          router.push('/(main)/context');
        }
      } catch (error) {
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
      setCapturedImage(result.assets[0].uri);
      router.push('/(main)/context');
    }
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff' }}>We need your permission to show the camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} onCameraReady={() => setIsReady(true)}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        
        {/* Viewfinder Frame */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
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
          <View style={styles.scanReadyBadge}>
            <Text style={styles.scanReadyText}>SCAN READY</Text>
          </View>
        )}
      </CameraView>

      <View style={styles.controls}>
        <Text style={styles.instruction}>Capture the affected area clearly</Text>
        
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.galleryButton} onPress={handleGallery}>
            <View style={styles.galleryIcon}>
              <View style={styles.galleryInner} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButtonOuter} onPress={handleCapture}>
            <View style={styles.captureButtonInner}>
              <CameraIcon />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashButton}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>⚡️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
