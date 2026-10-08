import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OzonOperation = {
  operation_id: number | string;
  operation_date: string;
  operation_type?: string;
  operation_type_name?: string;
  amount?: number;
  accruals_for_sale?: number;
  sale_commission?: number;
  posting?: { posting_number?: string };
  services?: Array<{ price?: number }>;
  items?: Array<{ sku?: number | string; name?: string }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isoStart(date: string) { return `${date}T00:00:00.000Z`; }
function isoEnd(date: string) { return `${date}T23:59:59.999Z`; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("OZON_CLIENT_ID");
  const apiKey = Deno.env.get("OZON_API_KEY");
  if (!clientId || !apiKey) return json({ error: "Не заданы секреты OZON_CLIENT_ID и OZON_API_KEY." }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Требуется вход в ERP." }, 401);

  const { data: employee } = await userClient.from("employees").select("app_role,role").eq("auth_user_id", authData.user.id).maybeSingle();
  if ((employee?.app_role || employee?.role) !== "admin") return json({ error: "Синхронизация Ozon доступна только администратору." }, 403);

  const body = await req.json().catch(() => ({}));
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return json({ error: "Укажите корректный период синхронизации." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: run, error: runError } = await admin.from("ozon_sync_runs").insert({ date_from: from, date_to: to }).select("id").single();
  if (runError) return json({ error: runError.message }, 500);

  async function ozon(path: string, payload: unknown) {
    const response = await fetch(`https://api-seller.ozon.ru${path}`, {
      method: "POST",
      headers: { "Client-Id": clientId!, "Api-Key": apiKey!, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.message || result?.error?.message || `Ozon API: HTTP ${response.status}`);
    return result;
  }

  try {
    let lastId = "";
    do {
      const catalog = await ozon("/v3/product/list", { filter: { visibility: "ALL" }, last_id: lastId, limit: 1000 });
      const items = catalog?.result?.items || [];
      if (items.length) {
        const offers = items.map((item: { product_id: number; offer_id: string }) => ({ ozon_product_id: item.product_id, offer_id: item.offer_id, updated_at: new Date().toISOString() }));
        const { error } = await admin.from("ozon_products").upsert(offers, { onConflict: "ozon_product_id" });
        if (error) throw error;
      }
      lastId = catalog?.result?.last_id || "";
      if (!items.length) lastId = "";
    } while (lastId);

    const { data: mappings, error: mapError } = await admin.from("ozon_products").select("ozon_product_id,offer_id");
    if (mapError) throw mapError;
    const offerIds = [...new Set((mappings || []).map((row) => String(row.offer_id).toLowerCase()).filter(Boolean))];
    const { data: products, error: productError } = await admin.from("products").select("id,article,default_price").in("article", offerIds);
    if (productError) throw productError;
    const erpByArticle = new Map((products || []).map((row) => [String(row.article).toLowerCase(), row]));
    const ozonBySku = new Map((mappings || []).map((row) => [String(row.ozon_product_id), String(row.offer_id).toLowerCase()]));
    const linkedProducts = (mappings || []).map((row) => ({ ozon_product_id: row.ozon_product_id, product_id: erpByArticle.get(String(row.offer_id).toLowerCase())?.id || null }));
    if (linkedProducts.length) await admin.from("ozon_products").upsert(linkedProducts, { onConflict: "ozon_product_id" });

    let page = 1;
    let pageCount = 1;
    let loaded = 0;
    let updated = 0;
    do {
      const finance = await ozon("/v3/finance/transaction/list", {
        filter: { date: { from: isoStart(from), to: isoEnd(to) }, operation_type: [], posting_number: "", transaction_type: "all" },
        page,
        page_size: 1000,
      });
      const operations: OzonOperation[] = finance?.result?.operations || [];
      pageCount = Math.max(1, Number(finance?.result?.page_count || 1));
      const rows = operations.map((operation) => {
        const operationItems = operation.items || [];
        let cost = 0;
        let matched = operationItems.length === 0;
        if (operationItems.length) {
          matched = true;
          for (const item of operationItems) {
            const article = ozonBySku.get(String(item.sku || ""));
            const product = article ? erpByArticle.get(article) : undefined;
            if (!product) matched = false;
            else cost += Number(product.default_price || 0);
          }
        }
        return {
          operation_id: String(operation.operation_id), operation_date: operation.operation_date,
          operation_type: operation.operation_type || null, operation_type_name: operation.operation_type_name || null,
          posting_number: operation.posting?.posting_number || null, amount: Number(operation.amount || 0),
          accruals_for_sale: Number(operation.accruals_for_sale || 0), sale_commission: Number(operation.sale_commission || 0),
          services_total: (operation.services || []).reduce((sum, service) => sum + Number(service.price || 0), 0),
          cost_of_goods: cost, matched, raw_data: operation, sync_run_id: run.id, updated_at: new Date().toISOString(),
        };
      });
      if (rows.length) {
        const { error } = await admin.from("ozon_operations").upsert(rows, { onConflict: "operation_id" });
        if (error) throw error;
      }
      loaded += operations.length;
      updated += rows.length;
      page += 1;
    } while (page <= pageCount);

    await admin.from("ozon_sync_runs").update({ status: "completed", finished_at: new Date().toISOString(), operations_loaded: loaded, operations_updated: updated }).eq("id", run.id);
    return json({ loaded, updated });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Неизвестная ошибка синхронизации";
    await admin.from("ozon_sync_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", run.id);
    return json({ error: message }, 500);
  }
});
