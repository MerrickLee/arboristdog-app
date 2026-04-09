import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image_url, symptoms, description, location } = await req.json();

    const prompt = `
      You are an ISA-certified arborist with 30 years of experience in the Northeast United States.
      Analyze the provided image and context to diagnose a landscape health issue.
      
      CONTEXT:
      - Location: ${location?.address || "Unknown"} (Lat: ${location?.coordinates?.lat}, Lng: ${location?.coordinates?.lng})
      - Selected Symptoms: ${symptoms.join(", ")}
      - User Description: ${description}
      
      INSTRUCTIONS:
      1. Be precise but use plain language for the property owner.
      2. Factor in regional pests and climate of the Northeast (Almstead's service area).
      3. Return ONLY a JSON object in the following format:
      {
        "condition_name": "Common Name of Condition",
        "confidence": 85,
        "severity": "low | moderate | high",
        "explanation": "Brief explanation of what is happening and why.",
        "actions": [
          { "priority": "Now | Soon | Seasonal", "text": "Specific action to take", "color": "Hex color code based on urgency" }
        ]
      }
    `;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: await fetch(image_url).then(res => res.arrayBuffer()).then(buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)))),
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const resultText = data.content[0].text;
    const resultJson = JSON.parse(resultText);

    return new Response(JSON.stringify(resultJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
