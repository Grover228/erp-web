import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const amount = (v: any): number => {
  const n = Number(v && typeof v === "object" ? v.amount : v);
  return Number.isFinite(n) ? n : 0;
};
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const labels: Record<number, string> = { 12: "Кросс-докинг FBO", 16: "Услуга Ozon #16", 17: "Услуга Ozon #17", 29: "Последняя миля", 32: "Логистика", 41: "Реклама CPC", 45: "Приём возврата в ПВЗ", 46: "Размещение", 54: "Продвижение", 59: "Обратная логистика", 76: "Услуга Ozon #76", 77: "Приёмка FBO", 93: "Услуга Ozon #93", 94: "Услуга Ozon #94", 98: "Доставка до ПВЗ" };
type Fee = { typeId: number; label: string; amount: number; count: number };
type Sku = { article: string; amount: number; count: number; reverseLogistics: number; delivery: number; returnsHandling: number };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = req.headers.get("Authorization") || "";
    const userDb = createClient(url, anon, { global: { headers: { Authorization: token } } });
    const { data: { user }, error: authError } = await userDb.auth.getUser();
    if (authError || !user) return reply({ error: "Требуется авторизация" }, 401);
    const { data: employee, error: employeeError } = await userDb.from("employees").select("app_role,role").eq("auth_user_id", user.id).maybeSingle();
    if (employeeError || (employee?.app_role || employee?.role) !== "admin") return reply({ error: "Доступ только администратору" }, 403);
    const body = await req.json().catch(() => ({}));
    const from = String(body.from || "");
    const to = String(body.to || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return reply({ error: "Неверный период" }, 400);
    const db = createClient(url, service);
    const mapping = new Map<string, string>();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("ozon_sku_mappings").select("sku,article").range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || []) mapping.set(String(row.sku), String(row.article));
      if ((data || []).length < 1000) break;
    }
    const totals = { operations: 0, gross: 0, commission: 0, services: 0, net: 0, cost: 0, contribution: 0, classifiedFees: 0 };
    const categories = new Map<string, { category: string; count: number; amount: number }>();
    const schemes = new Map<string, { scheme: string; count: number; amount: number }>();
    const fees = new Map<number, Fee>();
    const skus = new Map<string, Sku>();
    let unmappedFees = 0, missingSkuLines = 0;
    function addFee(typeRaw: unknown, accrued: unknown, skuRaw?: unknown) {
      const id = Number(typeRaw || 0);
      if (!Number.isFinite(id) || id <= 0) return;
      const value = amount(accrued);
      const f = fees.get(id) || { typeId: id, label: labels[id] || `Услуга Ozon #${id}`, amount: 0, count: 0 };
      f.amount += value; f.count++; fees.set(id, f); totals.classifiedFees += value;
      const article = skuRaw == null ? "" : mapping.get(String(skuRaw)) || "";
      if (!article) { unmappedFees += value; missingSkuLines++; return; }
      const row = skus.get(article) || { article, amount: 0, count: 0, reverseLogistics: 0, delivery: 0, returnsHandling: 0 };
      row.amount += value; row.count++;
      if (id === 59) row.reverseLogistics += value;
      if (id === 32) row.delivery += value;
      if (id === 45) row.returnsHandling += value;
      skus.set(article, row);
    }
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("ozon_operations")
        .select("operation_date,amount,accruals_for_sale,sale_commission,services_total,cost_of_goods,profit,raw_data")
        .gte("operation_date", from + "T00:00:00.000Z").lte("operation_date", to + "T23:59:59.999Z")
        .order("operation_date", { ascending: true }).range(offset, offset + 999);
      if (error) throw error;
      for (const row of data || []) {
        totals.operations++;
        totals.gross += amount(row.accruals_for_sale);
        totals.commission += amount(row.sale_commission);
        totals.services += amount(row.services_total);
        totals.net += amount(row.amount);
        totals.cost += amount(row.cost_of_goods);
        totals.contribution += amount(row.profit);
        const raw = row.raw_data || {};
        const category = String(raw.accrued_category || "UNKNOWN");
        const cat = categories.get(category) || { category, count: 0, amount: 0 };
        cat.count++; cat.amount += amount(row.amount); categories.set(category, cat);
        const scheme = String(raw?.posting?.delivery_schema || "Не указана");
        const sc = schemes.get(scheme) || { scheme, count: 0, amount: 0 };
        sc.count++; sc.amount += amount(row.amount); schemes.set(scheme, sc);
        for (const product of Array.isArray(raw?.posting?.products) ? raw.posting.products : []) {
          for (const fee of Array.isArray(product?.delivery?.services) ? product.delivery.services : []) addFee(fee?.type_id, fee?.accrued, product?.sku);
        }
        for (const group of Array.isArray(raw?.item_fees?.fees) ? raw.item_fees.fees : []) {
          for (const fee of Array.isArray(group?.fees) ? group.fees : []) addFee(fee?.type_id, fee?.accrued, group?.sku);
        }
        if (raw.non_item_fee) addFee(raw.non_item_fee.type_id, raw.non_item_fee.accrued);
      }
      if ((data || []).length < 1000) break;
    }
    const clean = <T extends Record<string, any>>(o: T): T => Object.fromEntries(Object.entries(o).map(([k,v]) => [k, typeof v === "number" ? round(v) : v])) as T;
    return reply({
      period: { from, to }, generatedAt: new Date().toISOString(), readOnly: true,
      totals: clean(totals),
      reconciliation: clean({ accountingDifference: totals.net - totals.gross - totals.commission - totals.services, feeDifference: totals.services - totals.classifiedFees }),
      categories: [...categories.values()].map(clean).sort((a,b) => b.count - a.count),
      schemes: [...schemes.values()].map(clean).sort((a,b) => b.count - a.count),
      fees: [...fees.values()].map(clean).sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount)),
      byArticle: [...skus.values()].map(clean).sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount)),
      allocation: { unmappedFees: round(unmappedFees), missingSkuLines },
      notes: ["Прибыль = результат операций минус учтённая себестоимость; не чистая прибыль предприятия.", "Строки начислений за обратную логистику не равны количеству возвратов.", "Нераспределённые услуги не назначаются товарам произвольно."]
    });
  } catch (error) {
    console.error("ozon-audit failed", error);
    return reply({ error: "Ошибка формирования аудита" }, 500);
  }
});