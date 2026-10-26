import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function amount(value: any) {
  const raw = value && typeof value === "object" ? value.amount : value;
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("OZON_CLIENT_ID");
  const apiKey = Deno.env.get("OZON_API_KEY");
  const authHeader = req.headers.get("Authorization") || "";

  if (!clientId || !apiKey) return json({ error: "Не заданы ключи Ozon API." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Требуется вход в ERP." }, 401);

  const { data: employee } = await userClient
    .from("employees")
    .select("app_role,role")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  if ((employee?.app_role || employee?.role) !== "admin") {
    return json({ error: "Формирование отчёта Ozon доступно только администратору." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return json({ error: "Укажите корректный период." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  async function ozon(path: string, payload: unknown) {
    const response = await fetch(`https://api-seller.ozon.ru${path}`, {
      method: "POST",
      headers: {
        "Client-Id": clientId!,
        "Api-Key": apiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let result: any = {};
    try { result = text ? JSON.parse(text) : {}; } catch { result = { raw: text }; }
    if (!response.ok) {
      throw new Error(`Ozon API ${path}: HTTP ${response.status}. ${String(result?.message || result?.raw || "Ошибка").slice(0, 500)}`);
    }
    return result;
  }

  try {
    const operations: any[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin
        .from("ozon_operations")
        .select("operation_date,posting_number,raw_data")
        .gte("operation_date", `${from}T00:00:00.000Z`)
        .lte("operation_date", `${to}T23:59:59.999Z`)
        .order("operation_date", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      operations.push(...rows);
      if (rows.length < pageSize) break;
    }

    const { data: mappings, error: mappingError } = await admin
      .from("ozon_products")
      .select("ozon_product_id,offer_id");
    if (mappingError) throw mappingError;

    const productIds = [...new Set((mappings || []).map((row: any) => String(row.ozon_product_id || "")).filter(Boolean))];
    const skuToArticle = new Map<string, string>();

    for (let offset = 0; offset < productIds.length; offset += 1000) {
      const chunk = productIds.slice(offset, offset + 1000);
      const details = await ozon("/v3/product/info/list", { product_id: chunk });
      const detailItems = details?.items || details?.result?.items || [];
      for (const detail of detailItems) {
        const article = String(detail?.offer_id || "").toLowerCase();
        if (!article) continue;
        if (detail?.sku !== undefined && detail?.sku !== null) {
          skuToArticle.set(String(detail.sku), article);
        }
        for (const source of detail?.sources || []) {
          if (source?.sku !== undefined && source?.sku !== null) {
            skuToArticle.set(String(source.sku), article);
          }
        }
      }
    }

    type Agg = { article: string; quantity: number; revenue: number };
    const byArticle = new Map<string, Agg>();
    const unknownSkus = new Set<string>();

    for (const operation of operations) {
      const productsRaw: any[] = operation?.raw_data?.posting?.products || [];
      for (const product of productsRaw) {
        const commission = product?.commission;
        if (!commission || typeof commission !== "object") continue;

        const salePrice = amount(commission?.sale_price);
        if (!(salePrice > 0)) continue;

        const qty = Number(product?.quantity || 0);
        if (!(qty > 0)) continue;

        const sku = String(product?.sku || "");
        const article = skuToArticle.get(sku);
        if (!article) {
          if (sku) unknownSkus.add(sku);
          continue;
        }

        const current = byArticle.get(article) || { article, quantity: 0, revenue: 0 };
        current.quantity += qty;
        current.revenue += salePrice;
        byArticle.set(article, current);
      }
    }

    if (!byArticle.size) {
      return json({ error: "За выбранный период нет товарных продаж для проведения." }, 400);
    }

    if (unknownSkus.size) {
      return json({
        error: `Не удалось сопоставить SKU Ozon: ${Array.from(unknownSkus).slice(0, 10).join(", ")}${unknownSkus.size > 10 ? "…" : ""}`,
      }, 409);
    }

    const articleSet = new Set(Array.from(byArticle.keys()));
    const [{ data: products, error: productError }, { data: items, error: itemError }] = await Promise.all([
      admin.from("products").select("id,article,name"),
      admin.from("items").select("id,article,name,item_type"),
    ]);
    if (productError) throw productError;
    if (itemError) throw itemError;

    const targetByArticle = new Map<string, { item_type: string; product_id: string | null; item_id: string | null }>();

    for (const row of products || []) {
      const article = String(row.article || "").toLowerCase();
      if (article && articleSet.has(article)) {
        targetByArticle.set(article, { item_type: "product", product_id: row.id, item_id: null });
      }
    }

    for (const row of items || []) {
      const article = String(row.article || "").toLowerCase();
      if (article && articleSet.has(article) && row.item_type === "resale_product") {
        targetByArticle.set(article, { item_type: "resale_product", product_id: null, item_id: row.id });
      }
    }

    const missing: string[] = [];
    const lines = Array.from(byArticle.values()).map((row) => {
      const target = targetByArticle.get(row.article);
      if (!target) {
        missing.push(row.article);
        return null;
      }
      const price = row.quantity > 0 ? Math.round((row.revenue / row.quantity) * 100) / 100 : 0;
      if (!(price > 0)) {
        missing.push(`${row.article} (некорректная цена)`);
        return null;
      }
      return {
        article: row.article,
        ...target,
        quantity: row.quantity,
        price,
      };
    }).filter(Boolean);

    if (missing.length) {
      return json({
        error: `Нельзя сформировать отчёт: не сопоставлены товары: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? "…" : ""}`,
        missing,
      }, 409);
    }

    const previewQuantity = Array.from(byArticle.values()).reduce((sum, row) => sum + row.quantity, 0);
    const previewRevenue = Array.from(byArticle.values()).reduce((sum, row) => sum + row.revenue, 0);

    const { data: result, error: createError } = await admin.rpc("create_ozon_erp_report", {
      p_from: from,
      p_to: to,
      p_lines: lines,
    });

    if (createError) throw createError;

    return json({
      ok: true,
      from,
      to,
      articleCount: lines.length,
      apiQuantity: previewQuantity,
      apiRevenue: Math.round(previewRevenue * 100) / 100,
      ...result,
    });
  } catch (cause: any) {
    const message = cause instanceof Error ? cause.message : cause?.message || "Не удалось сформировать отчёт для ERP.";
    console.error("ozon-erp-report failed", message);
    return json({ error: message }, 500);
  }
});
