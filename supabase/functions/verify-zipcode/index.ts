import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { zipcode } = await req.json();
    if (!zipcode) {
      throw new Error("zipcode is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Verify user
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Query the native service_areas table for the zip code
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: validZip } = await supabaseAdmin
      .from('service_areas')
      .select('zip_code')
      .eq('zip_code', zipcode.trim())
      .single();

    const inTargetArea = !!validZip;

    // 1. Update Profile
    await supabaseAdmin
      .from('profiles')
      .update({ 
        zip_code: zipcode,
        in_target_area: inTargetArea
      })
      .eq('id', user.id);

    // 2. Fetch current credits
    const { data: creditsData } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (creditsData) {
      // 3. Update Credits Limit & Balance
      let newLimit = 1;
      let newBalance = creditsData.balance;

      if (inTargetArea) {
        newLimit = 5;
        // If they were at 1 (the default limit), we bump them to 5
        // If they had already used some, we just add the difference (+4)
        if (creditsData.monthly_limit === 1) {
          newBalance = creditsData.balance + 4;
        }
      }

      await supabaseAdmin
        .from('user_credits')
        .update({ 
          monthly_limit: newLimit,
          balance: newBalance
        })
        .eq('user_id', user.id);
    }

    return new Response(JSON.stringify({
      success: true,
      inTargetArea: inTargetArea,
      zipcode: zipcode
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
