import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return respond(401, { error: "Authentication required" });

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !serviceKey) return respond(500, { error: "Server configuration error" });

  const callerClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: caller, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller.user) return respond(401, { error: "Invalid session" });

  // The user_profiles and employees tables are currently writable by anon.
  // Never use their role fields to authorize privileged actions.
  // Admin identities must first be provisioned with trusted auth.app_metadata.
  if (caller.user.app_metadata?.app_role !== "admin") {
    return respond(403, { error: "Administrator access required" });
  }

  let payload: unknown;
  try { payload = await req.json(); } catch { return respond(400, { error: "Invalid JSON" }); }
  const requestId = (payload as { request_id?: unknown } | null)?.request_id;
  if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) {
    return respond(400, { error: "Valid request_id required" });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: application, error: requestError } = await admin
    .from("registration_requests")
    .select("id,email,password,full_name,phone,status")
    .eq("id", requestId)
    .single();
  if (requestError || !application) return respond(404, { error: "Request not found" });
  if (application.status !== "pending") return respond(409, { error: "Request already processed" });
  if (!application.email || !application.password || !application.full_name) {
    return respond(422, { error: "Incomplete request" });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: application.email,
    password: application.password,
    email_confirm: true,
  });
  if (createError || !created.user) return respond(409, { error: createError?.message || "User creation failed" });
  const userId = created.user.id;

  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId, email: application.email, full_name: application.full_name,
    role: "employee", role_code: "employee", is_active: true,
  }, { onConflict: "id" });
  if (profileError) return respond(500, { error: "User created but profile provisioning failed; manual reconciliation required" });

  const { error: employeeError } = await admin.from("employees").upsert({
    id: userId, auth_user_id: userId, full_name: application.full_name,
    phone: application.phone || null, payment_type: "piece", is_active: true,
    app_role: "employee", can_use_scanner: true,
    can_manage_production: false, can_manage_directories: false, can_view_dashboard: false,
  }, { onConflict: "id" });
  if (employeeError) return respond(500, { error: "User created but employee provisioning failed; manual reconciliation required" });

  const { error: statusError } = await admin.from("registration_requests")
    .update({ status: "approved" }).eq("id", requestId).eq("status", "pending");
  if (statusError) return respond(500, { error: "User created but request status update failed; manual reconciliation required" });

  return respond(200, { success: true, user_id: userId });
});
