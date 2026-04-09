import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

/**
 * Upload an image from a local URI to Supabase Storage
 * @param uri Local file URI from camera or library
 * @param userId User ID for folder structure
 * @returns Object including the public URL of the uploaded image
 */
export const uploadDiagnosisImage = async (uri: string, userId: string) => {
  try {
    const fileName = `${userId}/${Date.now()}.jpg`;
    
    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload to 'diagnosis-images' bucket
    const { data, error } = await supabase.storage
      .from('diagnosis-images')
      .upload(fileName, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('diagnosis-images')
      .getPublicUrl(fileName);

    return { success: true, url: publicUrl, path: fileName };
  } catch (error) {
    console.error("[Storage] Failed to upload image:", error);
    return { success: false, error };
  }
};
