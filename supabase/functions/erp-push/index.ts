import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
type StoredSubscription = SubscriptionInput["keys"] & {
  id: string;
  user_id: string;
  endpoint: string;
};
const allowedOrigins = new Set([
  "https://streetstream.ru",
  "https://www.streetstream.ru",
  "https://erp-web-alpha.vercel.app",
  "https://erp-web-alex-erp.vercel.app",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://streetstream.ru",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-erp-cron",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function reply(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), { status, headers: cors(origin) });
}
function urlB64ToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - text.length % 4) % 4);
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
}
function bytesToUrlB64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function vapidJwk(pub: string, priv: string) {
  const point = urlB64ToBytes(pub);
  if (point.length !== 65 || point[0] !== 4 || urlB64ToBytes(priv).length !== 32) {
    throw new Error("Invalid VAPID key pair");
  }
  const x = bytesToUrlB64(point.slice(1, 33));
  const y = bytesToUrlB64(point.slice(33, 65));
  return {
    publicKey: { kty: "EC", crv: "P-256", alg: "ES256", x, y, key_ops: ["verify"], ext: true },
    privateKey: { kty: "EC", crv: "P-256", alg: "ES256", x, y, d: priv, key_ops: ["sign"], ext: true },
  };
}
function validSubscription(value: unknown): value is SubscriptionInput {
  if (!value || typeof value !== "object") return false;
  const sub = value as Record<string, unknown>;
  if (typeof sub.endpoint !== "string" || sub.endpoint.length > 2100) return false;
  let host = "";
  try {
    const url = new URL(sub.endpoint);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    host = url.hostname.toLowerCase();
  } catch { return false; }
  if (!(host === "fcm.googleapis.com" || host === "fcm-xm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" || host.endsWith(".push.services.mozilla.com") ||
    host === "web.push.apple.com" || host.endsWith(".push.apple.com"))) return false;
  const keys = sub.keys as Record<string, unknown> | undefined;
  return !!keys && typeof keys.p256dh === "string" && keys.p256dh.length > 25 && keys.p256dh.length < 200 &&
    typeof keys.auth === "string" && keys.auth.length > 8 && keys.auth.length < 100;
}
function moscowDateTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { day: `${v.year}-${v.month}-${v.day}`, hour: Number(v.hour), minute: Number(v.minute) };
}
function bearer(req: Request): string | null {
  const value = req.headers.get("authorization");
  return value?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "Origin not allowed" }, 403, origin);

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const projectUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !projectUrl) throw new Error("Backend credentials unavailable");
    const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: secretRows, error: secretError } = await db.rpc("erp_push_read_secrets");
    if (secretError) throw new Error("Push credentials unavailable");
    const secret = secretRows?.[0];
    if (!secret?.vapid_public || !secret?.vapid_private || !secret?.cron_secret) {
      throw new Error("Push credentials not configured");
    }

    const input = await req.json().catch(() => ({}));
    const action = typeof input?.action === "string" ? input.action : "";

    if (action === "config") {
      return reply({ publicKey: secret.vapid_public }, 200, origin);
    }

    let appServer: Awaited<ReturnType<typeof webpush.ApplicationServer.new>> | null = null;
    async function pushTo(subscriptions: StoredSubscription[], payload: Record<string, unknown>) {
      if (!appServer) {
        const vapidKeys = await webpush.importVapidKeys(
          vapidJwk(secret.vapid_public, secret.vapid_private),
          { extractable: false },
        );
        appServer = await webpush.ApplicationServer.new({
          contactInformation: "https://streetstream.ru",
          vapidKeys,
        });
      }
      let succeeded = 0, failed = 0;
      for (const sub of subscriptions) {
        try {
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          });
          await subscriber.pushTextMessage(JSON.stringify(payload), {});
          succeeded++;
          await db.from("erp_push_subscriptions")
            .update({ last_sent_at: new Date().toISOString() })
            .eq("id", sub.id);
        } catch (error) {
          failed++;
          const status = (error as { status?: number; statusCode?: number })?.status ??
            (error as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await db.from("erp_push_subscriptions").update({ enabled: false }).eq("id", sub.id);
          }
          console.error("ERP push delivery failure", {
            subscriptionId: sub.id,
            status: status ?? "unknown",
            message: error instanceof Error ? error.message.slice(0, 150) : "unknown",
          });
        }
      }
      return { succeeded, failed };
    }

    if (action === "run-shift-check") {
      const cronKey = req.headers.get("x-erp-cron");
      if (!cronKey || cronKey !== secret.cron_secret) {
        return reply({ error: "Forbidden" }, 403, origin);
      }
      const local = moscowDateTime();
      if (local.hour !== 19 || local.minute < 30 || local.minute > 59) {
        return reply({ skipped: "Outside Moscow reminder window", localDay: local.day }, 200, origin);
      }

      const { data: openShifts, error: shiftError } = await db.from("employee_shifts")
        .select("id,user_id,opened_at").eq("status", "open").is("closed_at", null);
      if (shiftError) throw shiftError;
      let sentToUsers = 0, pushAccepted = 0, failures = 0;
      for (const shift of openShifts || []) {
        const { data: already, error: checkError } = await db.from("erp_push_delivery_log")
          .select("id").eq("shift_id", shift.id)
          .eq("kind", "shift_close_1930").eq("local_day", local.day).maybeSingle();
        if (checkError || already) continue;
        const { data: devices, error: devicesError } = await db.from("erp_push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth").eq("user_id", shift.user_id).eq("enabled", true);
        if (devicesError || !devices?.length) continue;

        const delivery = await pushTo(devices, {
          title: "Стритстрим ERP · Смена открыта",
          body: "Вы ещё работаете? Если рабочий день закончился, не забудьте закрыть смену.",
          url: "/?erp_screen=employee-home",
          tag: `shift-${shift.id}-${local.day}`,
        });
        pushAccepted += delivery.succeeded;
        failures += delivery.failed;
        if (delivery.succeeded > 0) {
          sentToUsers++;
          await db.from("erp_push_delivery_log").insert({
            user_id: shift.user_id, kind: "shift_close_1930",
            shift_id: shift.id, local_day: local.day,
            succeeded: delivery.succeeded, failed: delivery.failed,
          });
        }
      }
      return reply({ checked: openShifts?.length || 0, sentToUsers, pushAccepted, failures }, 200, origin);
    }

    const token = bearer(req);
    if (!token) return reply({ error: "Login required" }, 401, origin);
    const { data: auth, error: userError } = await db.auth.getUser(token);
    if (userError || !auth.user) return reply({ error: "Session expired" }, 401, origin);
    const userId = auth.user.id;

    if (action === "status") {
      const { count, error } = await db.from("erp_push_subscriptions")
        .select("id", { head: true, count: "exact" }).eq("user_id", userId).eq("enabled", true);
      if (error) throw error;
      return reply({ enabledDevices: count || 0 }, 200, origin);
    }
    if (action === "subscribe") {
      if (!validSubscription(input.subscription)) return reply({ error: "Invalid push subscription" }, 400, origin);
      const sub = input.subscription as SubscriptionInput;
      const { data: existing, error: existingError } = await db.from("erp_push_subscriptions")
        .select("user_id").eq("endpoint", sub.endpoint).maybeSingle();
      if (existingError) throw existingError;
      if (existing && existing.user_id !== userId) return reply({ error: "Subscription belongs to another user" }, 409, origin);
      const { error } = await db.from("erp_push_subscriptions").upsert({
        user_id: userId,
        endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
        enabled: true, updated_at: new Date().toISOString(),
        device_label: "ERP PWA",
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return reply({ subscribed: true }, 200, origin);
    }
    if (action === "unsubscribe") {
      const endpoint = typeof input.endpoint === "string" ? input.endpoint : "";
      if (!endpoint) return reply({ error: "Missing endpoint" }, 400, origin);
      const { error } = await db.from("erp_push_subscriptions")
        .delete().eq("endpoint", endpoint).eq("user_id", userId);
      if (error) throw error;
      return reply({ subscribed: false }, 200, origin);
    }
    if (action === "test") {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { data: recent, error: recentError } = await db.from("erp_push_delivery_log")
        .select("id").eq("user_id", userId).eq("kind", "test")
        .gte("created_at", since).limit(1);
      if (recentError) throw recentError;
      if (recent?.length) return reply({ error: "Подожди минуту перед повторным тестом" }, 429, origin);
      const { data: devices, error: devicesError } = await db.from("erp_push_subscriptions")
        .select("id,user_id,endpoint,p256dh,auth").eq("user_id", userId).eq("enabled", true);
      if (devicesError) throw devicesError;
      if (!devices?.length) return reply({ error: "Сначала включи уведомления на телефоне" }, 400, origin);

      const delivery = await pushTo(devices, {
        title: "Стритстрим ERP · Проверка связи",
        body: "Тестовое push-уведомление. Уведомления ERP подключены!",
        url: "/?erp_screen=employee-home",
        tag: "erp-push-test",
      });
      await db.from("erp_push_delivery_log").insert({
        user_id: userId, kind: "test", succeeded: delivery.succeeded,
        failed: delivery.failed,
      });
      return reply({
        sent: delivery.succeeded > 0,
        accepted: delivery.succeeded,
        failed: delivery.failed,
        message: delivery.succeeded > 0
          ? "Push принят сервисом доставки. Проверь уведомления Android."
          : "Сервис отправки не принял push. Попробуй ещё раз позднее.",
      }, delivery.succeeded > 0 ? 200 : 502, origin);
    }
    return reply({ error: "Unknown action" }, 400, origin);
  } catch (error) {
    console.error("ERP push error:", error instanceof Error ? error.message : String(error));
    return reply({ error: "Ошибка сервера уведомлений" }, 500, origin);
  }
});
