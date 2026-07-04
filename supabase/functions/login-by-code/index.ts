import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code } = await req.json();

    if (!code || code.trim().length < 4) {
      return new Response(JSON.stringify({ error: "كود الدخول مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the login code
    const { data: merchantUser, error: lookupError } = await supabaseAdmin
      .from("merchant_users")
      .select("user_id, merchant_id, role, is_active")
      .eq("login_code", code.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();

    if (lookupError || !merchantUser) {
      return new Response(JSON.stringify({ error: "كود الدخول غير صحيح" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user's email to sign them in
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(merchantUser.user_id);

    if (authError || !authUser?.user?.email) {
      return new Response(JSON.stringify({ error: "حدث خطأ في الحصول على بيانات المستخدم" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a magic link token by creating a temporary password-like session
    // We'll use generateLink to create a magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: authUser.user.email,
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: "حدث خطأ في تسجيل الدخول" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the token from the link properties
    const token = linkData.properties?.hashed_token;
    
    if (!token) {
      return new Response(JSON.stringify({ error: "حدث خطأ في إنشاء رمز الدخول" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the OTP to get a session
    const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
      type: "magiclink",
      token_hash: token,
    });

    if (verifyError || !sessionData?.session) {
      return new Response(JSON.stringify({ error: "حدث خطأ في إنشاء الجلسة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session: sessionData.session,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
