const ZAPIER_WEBHOOK_URL = process.env.EXPO_PUBLIC_ZAPIER_WEBHOOK_URL || "";

export interface LeadData {
  user: {
    name: string;
    email: string;
    phone?: string;
  };
  location: {
    address: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    propertyType: string;
    coordinates?: { lat: number; lng: number };
  };
  diagnosis: {
    condition_name: string;
    confidence: number;
    severity: string;
    explanation: string;
  };
  context: {
    tags: string[];
    description: string;
    image_uri?: string | null;
  };
  notes?: string;
  preferredTime?: string;
}

export const sendLead = async (data: LeadData) => {
  if (!ZAPIER_WEBHOOK_URL) {
    console.warn("Zapier Webhook URL not found. Lead will not be sent.");
    return { success: false, error: "Missing configuration" };
  }

  try {
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data.user,
        // Flattened location fields for easier Zapier mapping
        address_full: data.location.address,
        address_street: data.location.street,
        address_city: data.location.city,
        address_state: data.location.state,
        address_zip: data.location.zip,
        property_type: data.location.propertyType,
        lat: data.location.coordinates?.lat,
        lng: data.location.coordinates?.lng,
        // Diagnosis info
        condition: data.diagnosis.condition_name,
        confidence: `${data.diagnosis.confidence}%`,
        severity: data.diagnosis.severity,
        explanation: data.diagnosis.explanation,
        // Context
        tags: data.context.tags.join(", "),
        user_description: data.context.description,
        image_url: data.context.image_uri,
        // Preferences
        additional_notes: data.notes,
        preferred_contact_time: data.preferredTime,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log("[Zapier] Lead sent successfully");
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error("[Zapier] Failed to send lead:", errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error("[Zapier] Network error while sending lead:", error);
    return { success: false, error: "Network error" };
  }
};
