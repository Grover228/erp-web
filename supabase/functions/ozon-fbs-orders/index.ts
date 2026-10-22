import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const statuses = new Set([
  "awaiting_packaging", "awaiting_deliver", "delivering", "delivered", "cancelled",
]);

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function dateParam(value: unknown): string | null {
  const valueText = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valueText)) return null;
  const parsed = new Date(valueText + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === valueText
    ? valueText : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается." }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Требуется вход в ERP." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Не настроена авторизация ERP." }, 503);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: "Требуется вход в ERP." }, 401);

    const { data: employee, error: employeeError } = await userClient
      .from("employees")
      .select("app_role,role")
      .eq("auth_user_id", auth.user.id)
      .maybeSingle();
    if (employeeError || (employee?.app_role || employee?.role) !== "admin") {
      return json({ error: "Заказы FBS доступны только администратору ERP." }, 403);
    }

    const clientId = Deno.env.get("OZON_CLIENT_ID");
    const apiKey = Deno.env.get("OZON_API_KEY");
    if (!clientId || !apiKey) {
      return json({ error: "Не настроены OZON_CLIENT_ID или OZON_API_KEY." }, 503);
    }

    const body = await req.json().catch(() => ({}));
    if (body?.action !== "list") return json({ error: "Неизвестное действие." }, 400);

    const from = dateParam(body?.from);
    const to = dateParam(body?.to);
    if (!from || !to || from > to) {
      return json({ error: "Укажите корректный период FBS." }, 400);
    }
    const span = Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z");
    if (span > 365 * 86400000) {
      return json({ error: "Период не должен превышать один год." }, 400);
    }

    const status = text(body?.status || "all");
    if (status !== "all" && !statuses.has(status)) {
      return json({ error: "Неизвестный статус FBS." }, 400);
    }
    const cursor = text(body?.cursor || "");
    if (cursor.length > 4096) return json({ error: "Некорректный курсор списка." }, 400);
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(body?.limit) || 50)));

    const filter: Record<string, unknown> = {
      since: from + "T00:00:00.000Z",
      to: to + "T23:59:59.999Z",
    };
    if (status !== "all") filter.status = [status];

    const response = await fetch("https://api-seller.ozon.ru/v4/posting/fbs/list", {
      method: "POST",
      headers: {
        "Client-Id": clientId,
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter,
        limit,
        cursor,
        sort_dir: "desc",
        with: { analytics_data: false, financial_data: false, barcodes: false },
      }),
      signal: AbortSignal.timeout(25000),
    });

    const responseText = await response.text();
    let result: any = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      return json({ error: "Ozon вернул ответ в неизвестном формате." }, 502);
    }
    if (!response.ok) {
      const detail = text(result?.message || result?.error || "Ошибка запроса");
      return json({ error: "Ozon API: HTTP " + response.status + ". " + detail.slice(0, 350) }, 502);
    }

    if (!Array.isArray(result?.postings)) {
      return json({ error: "Ozon вернул неожиданный формат списка FBS (v4)." }, 502);
    }

    const postings = result.postings.map((posting: any) => ({
      postingNumber: text(posting?.posting_number),
      status: text(posting?.status),
      substatus: text(posting?.substatus),
      inProcessAt: text(posting?.in_process_at),
      shipmentDate: text(posting?.shipment_date),
      warehouse: text(posting?.delivery_method?.warehouse),
      deliveryMethod: text(posting?.delivery_method?.name),
      products: Array.isArray(posting?.products)
        ? posting.products.map((product: any) => ({
            offerId: text(product?.offer_id),
            name: text(product?.name),
            sku: text(product?.sku),
            quantity: Number(product?.quantity || 0),
            price: text(product?.price),
          }))
        : [],
    }));

    return json({
      postings,
      hasNext: result?.has_next === true,
      nextCursor: result?.has_next === true ? text(result?.cursor) : "",
      fetchedAt: new Date().toISOString(),
      readOnly: true,
    });
  } catch (cause) {
    console.error("ozon-fbs-orders failed", cause);
    const isTimeout = cause instanceof Error && cause.name === "TimeoutError";
    return json({ error: isTimeout ? "Ozon не ответил за 25 секунд." : "Не удалось получить список FBS. Проверьте журналы Edge Function." }, 502);
  }
});
