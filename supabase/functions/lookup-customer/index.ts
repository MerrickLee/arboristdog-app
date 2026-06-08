import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.102.1";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Create standard client to verify the user
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get ACORN credentials
    const acornUsername = Deno.env.get('ACORN_USERNAME') || '';
    const acornPassword = Deno.env.get('ACORN_PASSWORD') || '';
    const acornClientSecret = Deno.env.get('ACORN_CLIENT_SECRET') || '';
    const acornClientId = Number(Deno.env.get('ACORN_CLIENT_ID') || 1);

    // 1. Get ACORN Token
    const tokenRes = await fetch("https://acorn.almstead.com/api/v1/employees/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "referer": "https://acorn.almstead.com"
      },
      body: JSON.stringify({
        Username: acornUsername,
        Password: acornPassword,
        AuthClientSecret: acornClientSecret,
        AuthClientID: acornClientId
      })
    });

    if (!tokenRes.ok) {
      throw new Error("Failed to authenticate with ACORN API");
    }
    const tokenData = await tokenRes.json();
    const jwtToken = tokenData.LoginResult?.Jwt;
    const xsrfToken = tokenData.LoginResult?.CsrfToken;

    if (!jwtToken || !xsrfToken) {
      throw new Error("Invalid ACORN API tokens received");
    }

    // 2. Lookup Customer by Email
    const lookupRes = await fetch("https://acorn.almstead.com/api/v1/customerinfo/get-customer-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`,
        "x-xsrf-token": xsrfToken,
        "referer": "https://acorn.almstead.com"
      },
      body: JSON.stringify({ email: user.email })
    });

    if (!lookupRes.ok && lookupRes.status !== 404) {
      throw new Error(`ACORN API Lookup failed with status ${lookupRes.status}`);
    }

    let isCustomer = false;
    let customerData = null;

    if (lookupRes.ok) {
      const data = await lookupRes.json();
      if (data.Status === true && data.Customer) {
        isCustomer = true;
        customerData = data.Customer;
      }
    }

    // 3. Update Supabase Profile if they are a customer
    if (isCustomer) {
      // Use service role client to bypass RLS or update fields that might be restricted
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_almstead_customer: true })
        .eq('id', user.id);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      isAlmsteadCustomer: isCustomer,
      // Avoid returning sensitive PII if not necessary, or return partial info
      customerFound: isCustomer
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Lookup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
