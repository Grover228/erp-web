import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "null",
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
  if (req.method === "OPTIONS") return json({ error: "Not supported" }, 405);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const clientId = Deno.env.get("OZON_CLIENT_ID");
  const apiKey = Deno.env.get("OZON_API_KEY");


  // Private server-to-server endpoint. Never put the scheduler secret in the browser.
  const secret = Deno.env.get("OZON_SYNC_CRON_SECRET");
  const supplied = req.headers.get("x-ozon-cron-secret");
  if (!secret || !supplied || supplied.length !== secret.length) return json({ error: "Unauthorized" }, 401);
  const expectedBytes = new TextEncoder().encode(secret);
  const actualBytes = new TextEncoder().encode(supplied);
  let mismatch = expectedBytes.length ^ actualBytes.length;
  for (let i = 0; i < Math.min(expectedBytes.length, actualBytes.length); i++) mismatch |= expectedBytes[i] ^ actualBytes[i];
  if (mismatch !== 0) return json({ error: "Unauthorized" }, 401);\n  if (!clientId || !apiKey) return json({ error: "Ozon API credentials unavailable" }, 503);

  // UTC dates, lagged by 14 days; refresh the last completed financial week.
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 14);
  const daysSinceSunday = end.getUTCDay();
  end.setUTCDate(end.getUTCDate() - daysSinceSunday);
  const begin = new Date(end);
  begin.setUTCDate(begin.getUTCDate() - 6);
  const from = begin.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);

  // Prevent accidental concurrent financial refreshes.
  const guard = createClient(supabaseUrl, serviceKey);
  const { data: activeRuns, error: guardError } = await guard.from("ozon_sync_runs")
    .select("id").eq("status", "running").gte("started_at", new Date(Date.now() - 45 * 60 * 1000).toISOString()).limit(1);
  if (guardError) return json({ error: "Cannot check sync state" }, 503);
  if (activeRuns?.length) return json({ skipped: true, reason: "sync_already_running" });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: run, error: runError } = await admin.from("ozon_sync_runs").insert({ date_from: from, date_to: to }).select("id").single();
  if (runError) return json({ error: runError.message }, 500);

  async function ozon(path: string, payload: unknown) {
    const url = `https://api-seller.ozon.ru${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Client-Id": clientId!, "Api-Key": apiKey!, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let result: any = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch {
      result = { raw: rawText };
    }

    if (!response.ok) {
      const details =
        result?.message ||
        result?.error?.message ||
        result?.error ||
        result?.raw ||
        "Без тела ответа";
      const safeDetails = String(details).slice(0, 1200);
      console.error("Ozon API request failed", {
        path,
        status: response.status,
        statusText: response.statusText,
        response: safeDetails,
      });
      throw new Error(
        `Ozon API ${path}: HTTP ${response.status} ${response.statusText || ""}. ${safeDetails}`.trim()
      );
    }

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

    const { data: mappings, error: mapError } = await admin
      .from("ozon_products")
      .select("ozon_product_id,offer_id");
    if (mapError) throw mapError;

    const offerIds = [...new Set(
      (mappings || [])
        .map((row) => String(row.offer_id || "").toLowerCase())
        .filter(Boolean)
    )];

    const [{ data: products, error: productError }, { data: resaleItems, error: itemError }] =
      await Promise.all([
        admin.from("products").select("id,article").in("article", offerIds),
        admin.from("items").select("id,article,item_type,source_table").in("article", offerIds),
      ]);
    if (productError) throw productError;
    if (itemError) throw itemError;

    const erpByArticle = new Map<string, any>();
    for (const row of products || []) {
      erpByArticle.set(String(row.article).toLowerCase(), {
        id: row.id,
        article: row.article,
        entity_type: "product",
      });
    }
    for (const row of resaleItems || []) {
      const key = String(row.article).toLowerCase();
      if (!erpByArticle.has(key)) {
        erpByArticle.set(key, {
          id: row.id,
          article: row.article,
          entity_type: "item",
          item_type: row.item_type,
          source_table: row.source_table,
        });
      }
    }

    const erpProductIds = [...new Set(
      Array.from(erpByArticle.values())
        .filter((row: any) => row.entity_type === "product" && row.id)
        .map((row: any) => String(row.id))
    )];
    const erpItemIds = [...new Set(
      Array.from(erpByArticle.values())
        .filter((row: any) => row.entity_type === "item" && row.id)
        .map((row: any) => String(row.id))
    )];

    const productionCostById = new Map<string, number>();
    if (erpProductIds.length) {
      const { data: productionRows, error: productionCostError } = await admin
        .from("production_orders")
        .select("product_id,quantity,planned_total_cost,status")
        .in("product_id", erpProductIds)
        .eq("status", "done");
      if (productionCostError) throw productionCostError;

      const totals = new Map<string, { cost: number; qty: number }>();
      for (const row of productionRows || []) {
        const qty = Number(row.quantity || 0);
        const totalCost = Number(row.planned_total_cost || 0);
        if (!(qty > 0) || !(totalCost > 0)) continue;
        const key = String(row.product_id);
        const currentTotal = totals.get(key) || { cost: 0, qty: 0 };
        currentTotal.cost += totalCost;
        currentTotal.qty += qty;
        totals.set(key, currentTotal);
      }
      for (const [key, total] of totals) {
        if (total.qty > 0) productionCostById.set(key, total.cost / total.qty);
      }
    }

    const resaleCostById = new Map<string, number>();
    if (erpItemIds.length) {
      const [{ data: receiptRows, error: receiptCostError }, { data: orderRows, error: orderCostError }] =
        await Promise.all([
          admin
            .from("supplier_receipt_items")
            .select("item_id,quantity,price,amount")
            .in("item_id", erpItemIds),
          admin
            .from("supplier_order_items")
            .select("item_id,quantity,price,amount")
            .in("item_id", erpItemIds),
        ]);
      if (receiptCostError) throw receiptCostError;
      if (orderCostError) throw orderCostError;

      const receiptTotals = new Map<string, { cost: number; qty: number }>();
      for (const row of receiptRows || []) {
        const qty = Number(row.quantity || 0);
        const price = Number(row.price || 0);
        const amount = Number(row.amount || 0);
        if (!(qty > 0) || !(price > 0) || !(amount > 0)) continue;
        const key = String(row.item_id);
        const total = receiptTotals.get(key) || { cost: 0, qty: 0 };
        total.cost += amount;
        total.qty += qty;
        receiptTotals.set(key, total);
      }

      const orderTotals = new Map<string, { cost: number; qty: number }>();
      for (const row of orderRows || []) {
        const qty = Number(row.quantity || 0);
        const price = Number(row.price || 0);
        const amount = Number(row.amount || 0);
        if (!(qty > 0) || !(price > 0) || !(amount > 0)) continue;
        const key = String(row.item_id);
        const total = orderTotals.get(key) || { cost: 0, qty: 0 };
        total.cost += amount;
        total.qty += qty;
        orderTotals.set(key, total);
      }

      for (const itemId of erpItemIds) {
        const receipt = receiptTotals.get(itemId);
        if (receipt && receipt.qty > 0) {
          resaleCostById.set(itemId, receipt.cost / receipt.qty);
          continue;
        }
        const order = orderTotals.get(itemId);
        if (order && order.qty > 0) {
          resaleCostById.set(itemId, order.cost / order.qty);
        }
      }
    }

    const unitCostByArticle = new Map<string, number>();
    for (const [article, entity] of erpByArticle.entries()) {
      if (entity.entity_type === "product") {
        const cost = productionCostById.get(String(entity.id));
        if (cost !== undefined) unitCostByArticle.set(article, cost);
      } else {
        const cost = resaleCostById.get(String(entity.id));
        if (cost !== undefined) unitCostByArticle.set(article, cost);
      }
    }

    const { data: costOverrides, error: costOverrideError } = await admin
      .from("ozon_cost_overrides")
      .select("article,unit_cost");
    if (costOverrideError) throw costOverrideError;

    for (const row of costOverrides || []) {
      const article = String(row.article || "").toLowerCase();
      const unitCost = Number(row.unit_cost);
      if (article && Number.isFinite(unitCost) && unitCost >= 0) {
        unitCostByArticle.set(article, unitCost);
      }
    }

    const productIds = [...new Set(
      (mappings || [])
        .map((row) => String(row.ozon_product_id || ""))
        .filter(Boolean)
    )];

    const ozonBySku = new Map<string, string>();
    for (let offset = 0; offset < productIds.length; offset += 1000) {
      const chunk = productIds.slice(offset, offset + 1000);
      const details = await ozon("/v3/product/info/list", { product_id: chunk });
      const detailItems = details?.items || details?.result?.items || [];

      for (const detail of detailItems) {
        const article = String(detail?.offer_id || "").toLowerCase();
        if (!article) continue;

        const candidateSkus = new Set<string>();
        if (detail?.sku !== undefined && detail?.sku !== null) {
          candidateSkus.add(String(detail.sku));
        }
        for (const source of detail?.sources || []) {
          if (source?.sku !== undefined && source?.sku !== null) {
            candidateSkus.add(String(source.sku));
          }
        }

        for (const sku of candidateSkus) {
          ozonBySku.set(sku, article);
        }
      }
    }


    const typesResponse = await ozon("/v1/finance/accrual/types", {});
    const typeNameById = new Map(
      (typesResponse?.accrual_types || []).map((row: any) => [
        String(row.id),
        row.description || row.name || `Начисление Ozon #${row.id}`,
      ])
    );

    function money(value: any) {
      const amount = value && typeof value === "object" ? value.amount : value;
      const parsed = Number(amount || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    async function operationIdFor(accrual: any) {
      if (accrual?.accrual_id) return String(accrual.accrual_id);
      const bytes = new TextEncoder().encode(JSON.stringify(accrual));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return `accrual:${hex}`;
    }

    function isoOperationDate(value: unknown, fallbackDay: string) {
      const raw = String(value || fallbackDay);
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)) {
        return `${raw}T12:00:00.000Z`;
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime())
        ? `${fallbackDay}T12:00:00.000Z`
        : parsed.toISOString();
    }

    function* daysInRange(dateFrom: string, dateTo: string) {
      const current = new Date(`${dateFrom}T00:00:00.000Z`);
      const finish = new Date(`${dateTo}T00:00:00.000Z`);
      while (current <= finish) {
        yield current.toISOString().slice(0, 10);
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    let loaded = 0;
    let updated = 0;

    for (const day of daysInRange(from, to)) {
      let lastId = "";
      let pageGuard = 0;

      do {
        pageGuard += 1;
        if (pageGuard > 200) {
          throw new Error(`Ozon API /v1/finance/accrual/by-day: превышен лимит 200 страниц за ${day}`);
        }

        const finance = await ozon("/v1/finance/accrual/by-day", {
          date: day,
          last_id: lastId,
        });

        const accruals: any[] = finance?.accruals || [];
        const rows = [];

        for (const accrual of accruals) {
          const postingProducts = accrual?.posting?.products || [];

          let sales = 0;
          let saleCommission = 0;
          let services = 0;
          let cost = 0;
          let matched = postingProducts.length === 0;

          if (postingProducts.length) {
            matched = true;

            for (const item of postingProducts) {
              const commission = item?.commission || {};
              sales += money(commission.seller_price);
              saleCommission += money(commission.sale_commission);

              const delivery = item?.delivery || {};
              if (Array.isArray(delivery.services) && delivery.services.length) {
                for (const service of delivery.services) {
                  services += money(service?.accrued);
                }
              } else {
                services += money(delivery.total_accrued);
              }

              const article = ozonBySku.get(String(item?.sku || ""));
              const erpEntity = article ? erpByArticle.get(article) : undefined;
              if (!erpEntity) {
                matched = false;
              } else {
                const unitCost = article ? unitCostByArticle.get(article) : undefined;
                const quantity = Math.max(0, Number(item?.quantity || 0));
                const sellerPrice = money(commission.seller_price);

                if (unitCost !== undefined && quantity > 0 && sellerPrice !== 0) {
                  cost += unitCost * quantity * (sellerPrice > 0 ? 1 : -1);
                }
              }
            }
          }

          for (const group of accrual?.item_fees?.fees || []) {
            for (const fee of group?.fees || []) {
              services += money(fee?.accrued);
            }
          }

          if (accrual?.non_item_fee) {
            services += money(accrual.non_item_fee.accrued);
          }

          const operationId = await operationIdFor(accrual);
          const typeId = String(accrual?.type_id ?? "");
          const totalAmount = money(accrual?.total_amount);

          rows.push({
            operation_id: operationId,
            operation_date: isoOperationDate(accrual?.date, day),
            operation_type: typeId || null,
            operation_type_name:
              typeNameById.get(typeId) ||
              (typeId ? `Начисление Ozon #${typeId}` : "Начисление Ozon"),
            posting_number: accrual?.unit_number || null,
            amount: totalAmount,
            accruals_for_sale: sales,
            sale_commission: saleCommission,
            services_total: services,
            cost_of_goods: cost,
            matched,
            raw_data: accrual,
            sync_run_id: run.id,
            updated_at: new Date().toISOString(),
          });
        }

        if (rows.length) {
          const { error } = await admin
            .from("ozon_operations")
            .upsert(rows, { onConflict: "operation_id" });
          if (error) throw error;
        }

        loaded += accruals.length;
        updated += rows.length;
        lastId = String(finance?.last_id || "");

        if (!accruals.length) lastId = "";
      } while (lastId);
    }

    await admin.from("ozon_sync_runs").update({ status: "completed", finished_at: new Date().toISOString(), operations_loaded: loaded, operations_updated: updated }).eq("id", run.id);
    return json({ loaded, updated });
  } catch (cause: any) {
    const message =
      cause instanceof Error
        ? cause.message
        : cause?.message
        ? String(cause.message)
        : cause?.details
        ? String(cause.details)
        : cause?.hint
        ? String(cause.hint)
        : typeof cause === "string"
        ? cause
        : JSON.stringify(cause || "Неизвестная ошибка синхронизации").slice(0, 1500);

    console.error("ozon-sync failed", message);
    await admin
      .from("ozon_sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", run.id);

    return json({ error: message }, 500);
  }
});
