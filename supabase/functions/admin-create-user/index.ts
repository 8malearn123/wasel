import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { corsHeaders } from "../_shared/cors.ts";

function generateLoginCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await supabaseUser
      .from("merchant_users")
      .select("role, merchant_id")
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!callerRole || !["owner", "admin"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, role, branch_id, custom_role_id } = await req.json();

    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, password, full_name, and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "branch_manager", "cashier", "inventory_manager", "custom"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A custom role must be one this shop made. Read as the caller, so RLS
    // only shows system roles and the caller's own merchant's roles.
    if (role === "custom") {
      const { data: customRole } = custom_role_id
        ? await supabaseUser
            .from("roles")
            .select("id")
            .eq("id", custom_role_id)
            .eq("merchant_id", callerRole.merchant_id)
            .eq("is_system", false)
            .maybeSingle()
        : { data: null };
      if (!customRole) {
        return new Response(JSON.stringify({ error: "الدور المخصص غير موجود" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subscription } = await supabaseUser
      .from("subscriptions")
      .select("max_users")
      .eq("merchant_id", callerRole.merchant_id)
      .maybeSingle();

    const { count: currentUsers } = await supabaseUser
      .from("merchant_users")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", callerRole.merchant_id)
      .eq("is_active", true);

    if (subscription?.max_users && currentUsers !== null && currentUsers >= subscription.max_users) {
      return new Response(JSON.stringify({ error: "تم الوصول للحد الأقصى من المستخدمين في باقتك الحالية. يرجى ترقية الباقة." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "هذا البريد الإلكتروني مسجل مسبقاً" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newUser.user) {
      return new Response(JSON.stringify({ error: "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a unique login code
    let loginCode = generateLoginCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabaseAdmin
        .from("merchant_users")
        .select("id")
        .eq("login_code", loginCode)
        .maybeSingle();
      if (!existing) break;
      loginCode = generateLoginCode();
      attempts++;
    }

    const { data: member, error: muError } = await supabaseAdmin
      .from("merchant_users")
      .insert({
        merchant_id: callerRole.merchant_id,
        user_id: newUser.user.id,
        role,
        branch_id: branch_id || null,
        is_active: true,
        login_code: loginCode,
      })
      .select("id")
      .single();

    // The custom role's grant; without it the member would sign in to nothing
    const { error: grantError } = !muError && role === "custom"
      ? await supabaseAdmin
          .from("user_roles")
          .insert({ merchant_user_id: member.id, role_id: custom_role_id, granted_by: caller.id })
      : { error: null };

    if (muError || grantError) {
      if (member) await supabaseAdmin.from("merchant_users").delete().eq("id", member.id);
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: (muError ?? grantError)!.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin
      .from("activity_logs")
      .insert({
        merchant_id: callerRole.merchant_id,
        user_id: caller.id,
        action: "create_user",
        entity_type: "merchant_users",
        entity_id: newUser.user.id,
        new_data: { email, full_name, role, branch_id, custom_role_id: role === "custom" ? custom_role_id : undefined },
      });

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUser.user.id,
      login_code: loginCode,
      message: "تم إنشاء المستخدم بنجاح"
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
