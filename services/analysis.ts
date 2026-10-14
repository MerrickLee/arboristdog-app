import { supabase } from './supabase';
import { uploadDiagnosisImage } from './storage';

export const performAnalysis = async (userId: string, imageUri: string, context: { symptoms: string[], description: string, location: any }) => {
  try {
    // 1. Upload image to Storage
    const uploadResult = await uploadDiagnosisImage(imageUri, userId);
    if (!uploadResult.success || !uploadResult.url) {
      throw new Error("Image upload failed");
    }

    // 2. Call Edge Function
    const { data: analysisResult, error: edgeError } = await supabase.functions.invoke('analyze-plant', {
      body: {
        image_url: uploadResult.url,
        symptoms: context.symptoms,
        description: context.description,
        location: context.location,
      },
    });

    if (edgeError) {
      const response = (edgeError as { context?: Response }).context;
      const details = response ? await response.json().catch(() => null) : null;
      throw new Error(details?.error || edgeError.message);
    }

    return { 
      success: true, 
      result: analysisResult, 
      diagnosisId: analysisResult.diagnosisId,
      balance: analysisResult.balance,
      imageUrl: uploadResult.url 
    };
  } catch (error) {
    console.error("[Analysis] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Analysis failed' };
  }
};
