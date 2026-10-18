import { createClient } from "npm:@supabase/supabase-js@2.49.8";

type QueueAction = "claim" | "complete" | "fail";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

  let secret = legacySecret || "";

  if (secretKeysRaw) {
    try {
      const keys = JSON.parse(secretKeysRaw);
      secret = keys.default || secret;
    } catch {
      // Legacy service role remains a supported fallback.
    }
  }

  if (!url || !secret) {
    throw new Error("Supabase admin credentials are unavailable");
  }

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const token = req.headers.get("x-printer-token") || "";
    if (!token) {
      return json({ ok: false, error: "Printer token is required" }, 401);
    }

    const admin = getAdminClient();
    const tokenHash = await sha256(token);

    const { data: agent, error: agentError } = await admin
      .from("printer_agents")
      .select("id, code, name, is_active")
      .eq("token_hash", tokenHash)
      .eq("is_active", true)
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) {
      return json({ ok: false, error: "Invalid printer token" }, 401);
    }

    await admin
      .from("printer_agents")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", agent.id);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "claim") as QueueAction;

    if (action === "claim") {
      const { data: pending, error: pendingError } = await admin
        .from("print_jobs")
        .select("*")
        .eq("printer_code", agent.code)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (pendingError) throw pendingError;
      if (!pending) return json({ ok: true, job: null });

      const { data: claimed, error: claimError } = await admin
        .from("print_jobs")
        .update({
          status: "claimed",
          claimed_at: new Date().toISOString(),
          attempts: Number(pending.attempts || 0) + 1,
          error: null,
        })
        .eq("id", pending.id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();

      if (claimError) throw claimError;
      return json({ ok: true, job: claimed || null });
    }

    const jobId = String(body?.jobId || "");
    if (!jobId) {
      return json({ ok: false, error: "jobId is required" }, 400);
    }

    const { data: job, error: jobError } = await admin
      .from("print_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("printer_code", agent.code)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) return json({ ok: false, error: "Print job not found" }, 404);

    if (action === "complete") {
      if (job.status === "printed") {
        return json({ ok: true, alreadyPrinted: true });
      }

      const printedAt = new Date().toISOString();
      const { error: updateError } = await admin
        .from("print_jobs")
        .update({ status: "printed", printed_at: printedAt, error: null })
        .eq("id", job.id);

      if (updateError) throw updateError;

      if (job.job_type === "qr") {
        const payload = job.payload || {};
        if (payload.batchId && payload.productionOrderId) {
          const { error: logError } = await admin
            .from("production_qr_print_logs")
            .insert({
              batch_id: payload.batchId,
              production_order_id: payload.productionOrderId,
              printed_at: printedAt,
              printed_by: job.created_by || null,
              printer_name: payload.printerName || agent.name,
              batch_number: payload.batchNumber || null,
              quantity: Number(payload.quantity || 0),
            });

          if (logError) throw logError;
        }
      }

      let completionWarning = "";

      if (job.job_type === "chz_labels") {
        const payload = job.payload || {};
        const codeIds = Array.isArray(payload.codeIds)
          ? payload.codeIds.map((value: unknown) => String(value || "")).filter(Boolean)
          : [];

        if (codeIds.length > 0) {
          const { error: codesError } = await admin
            .from("chz_marking_codes")
            .update({
              status: "printed",
              printed_at: printedAt,
              updated_at: printedAt,
            })
            .in("id", codeIds);

          if (codesError) {
            completionWarning = `Этикетки физически напечатаны, но не удалось отметить коды ЧЗ: ${codesError.message}`;
            console.error(completionWarning);
          }
        }

        if (payload.batchId && !completionWarning) {
          const { error: batchError } = await admin
            .from("production_batches")
            .update({
              chz_labels_printed_at: printedAt,
              chz_codes_allocated: codeIds.length,
            })
            .eq("id", payload.batchId);

          if (batchError) {
            completionWarning = `Этикетки физически напечатаны, но не удалось отметить пачку: ${batchError.message}`;
            console.error(completionWarning);
          }
        }
      }

      return json({ ok: true, warning: completionWarning || null });
    }

    if (action === "fail") {
      if (job.status === "printed") {
        return json({ ok: true, alreadyPrinted: true });
      }

      const message = String(body?.error || "Printer error").slice(0, 1000);
      const retry = Number(job.attempts || 0) < 5;

      const { error: updateError } = await admin
        .from("print_jobs")
        .update({
          status: retry ? "pending" : "failed",
          claimed_at: retry ? null : job.claimed_at,
          error: message,
        })
        .eq("id", job.id);

      if (updateError) throw updateError;

      return json({ ok: true, retry });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    console.error("printer-queue", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Printer queue error",
      },
      500,
    );
  }
});
