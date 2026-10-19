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

function money(value: any) {
  const amount = value && typeof value === "object" ? value.amount : value;
  const parsed = Number(amount || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const FEE_LABELS: Record<number, string> = {
  1: "Эквайринг",
  12: "Кросс-докинг FBO",
  15: "Утилизация",
  29: "Последняя миля",
  32: "Логистика",
  38: "Стоимость упаковки",
  39: "Упаковка",
  41: "Реклама CPC",
  45: "Приём возврата в ПВЗ",
  46: "Размещение",
  48: "Premium Cashback",
  54: "Продвижение",
  59: "Обратная логистика",
  77: "Приёмка поставки FBO",
  78: "Временное размещение",
  84: "Упаковка товара",
  96: "Ускоренный сбор отзывов",
  98: "Доставка до точки выдачи",
};

function addFee(
  target: Map<number, { typeId: number; label: string; amount: number; count: number }>,
  typeIdRaw: unknown,
  accrued: unknown,
) {
  const typeId = Number(typeIdRaw || 0);
  if (!Number.isFinite(typeId) || typeId <= 0) return;
  const amount = money(accrued);
  const current = target.get(typeId) || {
    typeId,
    label: FEE_LABELS[typeId] || `Начисление Ozon #${typeId}`,
    amount: 0,
    count: 0,
  };
  current.amount += amount;
  current.count += 1;
  target.set(typeId, current);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("OZON_CLIENT_ID");
  const apiKey = Deno.env.get("OZON_API_KEY");

  if (!clientId || !apiKey) {
    return json({ error: "Не заданы секреты OZON_CLIENT_ID и OZON_API_KEY." }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
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
    return json({ error: "Аналитика Ozon доступна только администратору." }, 403);
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
      throw new Error(`Ozon API ${path}: HTTP ${response.status}. ${String(result?.message || result?.raw || "Ошибка").slice(0, 800)}`);
    }
    return result;
  }

  try {
    const operations: any[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin
        .from("ozon_operations")
        .select("id,operation_date,amount,accruals_for_sale,sale_commission,services_total,cost_of_goods,profit,matched,raw_data")
        .gte("operation_date", `${from}T00:00:00.000Z`)
        .lte("operation_date", `${to}T23:59:59.999Z`)
        .order("operation_date", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      operations.push(...rows);
      if (rows.length < pageSize) break;
    }

    const summary = operations.reduce((sum, row) => ({
      gross: sum.gross + Number(row.accruals_for_sale || 0),
      ozon: sum.ozon + Number(row.sale_commission || 0) + Number(row.services_total || 0),
      net: sum.net + Number(row.amount || 0),
      cost: sum.cost + Number(row.cost_of_goods || 0),
      profit: sum.profit + Number(row.profit || 0),
      unmatched: sum.unmatched + (row.matched ? 0 : 1),
    }), { gross: 0, ozon: 0, net: 0, cost: 0, profit: 0, unmatched: 0 });

    const dailyMap = new Map<string, { date: string; gross: number; ozon: number; cost: number; profit: number }>();
    for (const row of operations) {
      const date = String(row.operation_date || "").slice(0, 10);
      if (!date) continue;
      const current = dailyMap.get(date) || { date, gross: 0, ozon: 0, cost: 0, profit: 0 };
      current.gross += Number(row.accruals_for_sale || 0);
      current.ozon += Number(row.sale_commission || 0) + Number(row.services_total || 0);
      current.cost += Number(row.cost_of_goods || 0);
      current.profit += Number(row.profit || 0);
      dailyMap.set(date, current);
    }

    const dailyFinance = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((row) => ({
        ...row,
        gross: Math.round(row.gross * 100) / 100,
        ozon: Math.round(row.ozon * 100) / 100,
        cost: Math.round(row.cost * 100) / 100,
        profit: Math.round(row.profit * 100) / 100,
      }));

    const feeByType = new Map<number, { typeId: number; label: string; amount: number; count: number }>();
    feeByType.set(12, { typeId: 12, label: FEE_LABELS[12], amount: 0, count: 0 });
    feeByType.set(77, { typeId: 77, label: FEE_LABELS[77], amount: 0, count: 0 });

    for (const operation of operations) {
      const raw = operation?.raw_data || {};

      for (const product of raw?.posting?.products || []) {
        for (const service of product?.delivery?.services || []) {
          addFee(feeByType, service?.type_id, service?.accrued);
        }
      }

      for (const group of raw?.item_fees?.fees || []) {
        for (const fee of group?.fees || []) {
          addFee(feeByType, fee?.type_id, fee?.accrued);
        }
      }

      if (raw?.non_item_fee) {
        addFee(feeByType, raw.non_item_fee?.type_id, raw.non_item_fee?.accrued);
      }
    }

    const feeBreakdown = Array.from(feeByType.values())
      .map((row) => ({ ...row, amount: Math.round(row.amount * 100) / 100 }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    const { data: mappings, error: mappingError } = await admin
      .from("ozon_products")
      .select("ozon_product_id,offer_id");
    if (mappingError) throw mappingError;

    const productIds = [...new Set((mappings || []).map((row) => String(row.ozon_product_id || "")).filter(Boolean))];
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

    const articles = [...new Set(Array.from(skuToArticle.values()))];
    const [{ data: products }, { data: items }] = await Promise.all([
      articles.length ? admin.from("products").select("article,name").in("article", articles) : Promise.resolve({ data: [] as any[] }),
      articles.length ? admin.from("items").select("article,name,item_type").in("article", articles) : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameByArticle = new Map<string, string>();
    for (const row of products || []) nameByArticle.set(String(row.article).toLowerCase(), row.name || row.article);
    for (const row of items || []) nameByArticle.set(String(row.article).toLowerCase(), row.name || row.article);

    type Agg = {
      article: string;
      name: string;
      soldQty: number;
      returnQty: number;
      gross: number;
      ozon: number;
      net: number;
      cost: number;
      profit: number;
      missingCostQty: number;
    };

    const byArticle = new Map<string, Agg>();

    function getAgg(article: string) {
      let agg = byArticle.get(article);
      if (!agg) {
        agg = {
          article,
          name: nameByArticle.get(article) || article,
          soldQty: 0,
          returnQty: 0,
          gross: 0,
          ozon: 0,
          net: 0,
          cost: 0,
          profit: 0,
          missingCostQty: 0,
        };
        byArticle.set(article, agg);
      }
      return agg;
    }

    for (const operation of operations) {
      const productsRaw: any[] = operation?.raw_data?.posting?.products || [];
      if (!productsRaw.length) continue;

      const mapped = productsRaw
        .map((product) => {
          const article = skuToArticle.get(String(product?.sku || ""));
          const qty = Math.max(0, Number(product?.quantity || 0));
          const sellerPrice = money(product?.commission?.seller_price);
          return { product, article, qty, sellerPrice };
        })
        .filter((row) => row.article);

      if (!mapped.length) continue;

      const weights = mapped.map((row) => Math.abs(row.sellerPrice) > 0 ? Math.abs(row.sellerPrice) : Math.max(row.qty, 1));
      const weightTotal = weights.reduce((a, b) => a + b, 0) || mapped.length;

      mapped.forEach((row, index) => {
        const article = row.article!;
        const agg = getAgg(article);
        const share = weights[index] / weightTotal;

        if (row.sellerPrice > 0) agg.soldQty += row.qty;
        if (row.sellerPrice < 0) agg.returnQty += row.qty;

        agg.gross += Number(operation.accruals_for_sale || 0) * share;
        agg.ozon += (Number(operation.sale_commission || 0) + Number(operation.services_total || 0)) * share;
        agg.net += Number(operation.amount || 0) * share;
        agg.cost += Number(operation.cost_of_goods || 0) * share;
        agg.profit += Number(operation.profit || 0) * share;

        if (row.sellerPrice !== 0 && Number(operation.cost_of_goods || 0) === 0) {
          agg.missingCostQty += row.qty;
        }
      });
    }

    const result = Array.from(byArticle.values())
      .map((row) => ({
        ...row,
        margin: row.gross !== 0 ? (row.profit / row.gross) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    return json({ summary, articles: result, feeBreakdown, dailyFinance, operationCount: operations.length });
  } catch (cause: any) {
    const message = cause instanceof Error ? cause.message : cause?.message || "Ошибка аналитики Ozon";
    console.error("ozon-analytics failed", message);
    return json({ error: message }, 500);
  }
});
