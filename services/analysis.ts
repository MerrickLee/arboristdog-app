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

    if (edgeError) throw edgeError;

    // 3. Save diagnosis to Database
    const { data: savedDiagnosis, error: dbError } = await supabase
      .from('diagnoses')
      .insert({
        user_id: userId,
        image_url: uploadResult.url,
        symptoms: context.symptoms,
        description: context.description,
        condition_name: analysisResult.condition_name,
        confidence: analysisResult.confidence,
        severity: analysisResult.severity,
        diagnosis_json: analysisResult,
        location_json: context.location,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 4. Deduct credit (Simplified - in prod use a database transaction/trigger)
    await supabase.rpc('deduct_credit', { user_id: userId });

    return { 
      success: true, 
      result: analysisResult, 
      diagnosisId: savedDiagnosis.id,
      imageUrl: uploadResult.url 
    };
  } catch (error) {
    console.error("[Analysis] Error:", error);
    return { success: false, error: error.message };
  }
};
