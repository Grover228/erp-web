const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRUE_API_BASES = {
  v3: "https://markirovka.crpt.ru/api/v3/true-api",
  v4: "https://markirovka.crpt.ru/api/v4/true-api",
} as const;

const SUZ_API_BASE = "https://suzgrid.crpt.ru/api/v3";
const NK_API_BASE = "https://xn--80aqu.xn----7sbabas4ajkhfocclk9d3cvfsa.xn--p1ai";
const STATE_KEY = "default";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  let payload: any = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const upstreamMessage =
      payload?.error_message ||
      payload?.description ||
      payload?.message ||
      payload?.error ||
      payload?.raw ||
      "";
    const suffix = upstreamMessage ? `: ${String(upstreamMessage).slice(0, 500)}` : "";
    throw new Error(`Честный ЗНАК вернул HTTP ${response.status}${suffix}`);
  }

  return payload;
}

function getSupabaseEnv() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error("Не настроены системные переменные Supabase.");
  }

  return { url, serviceRoleKey, anonKey };
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Error("Нет авторизации ERP.");
  }

  const { url, serviceRoleKey, anonKey } = getSupabaseEnv();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });

  if (!userResponse.ok) {
    throw new Error("Не удалось подтвердить пользователя ERP.");
  }

  const user = await userResponse.json();
  const userId = String(user?.id || "");
  if (!userId) throw new Error("Не удалось определить пользователя ERP.");

  const employeeResponse = await fetch(
    `${url}/rest/v1/employees?auth_user_id=eq.${encodeURIComponent(userId)}&select=app_role&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );

  if (!employeeResponse.ok) throw new Error("Не удалось проверить права пользователя.");

  const employees = await employeeResponse.json();
  const role = String(employees?.[0]?.app_role || "").toLowerCase();
  if (role !== "admin") throw new Error("Доступ к интеграции Честного ЗНАКа разрешён только администратору.");
}

async function readState() {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(
    `${url}/rest/v1/chz_integration_state?key=eq.${STATE_KEY}&select=*&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    },
  );

  if (!response.ok) throw new Error("Не удалось прочитать состояние интеграции ЧЗ.");
  const rows = await response.json();
  return rows?.[0] || null;
}

async function upsertState(values: Record<string, unknown>) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(
    `${url}/rest/v1/chz_integration_state?on_conflict=key`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([
        {
          key: STATE_KEY,
          updated_at: new Date().toISOString(),
          ...values,
        },
      ]),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Не удалось сохранить состояние интеграции ЧЗ: ${text.slice(0, 300)}`);
  }

  const rows = await response.json();
  return rows?.[0] || null;
}


async function serviceSelect(path: string) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка чтения ERP: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function getNationalCatalogGoods(token: string) {
  const goods: any[] = [];
  let offset = 0;
  const limit = 1000;
  const fromDate = "2015-01-01 00:00:00";
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const toDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  while (offset < 10000) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      from_date: fromDate,
      to_date: toDate,
      format: "json",
    });

    const response = await fetch(`${NK_API_BASE}/v4/product-list?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = await parseJsonResponse(response);
    const page = Array.isArray(payload?.result?.goods) ? payload.result.goods : [];
    goods.push(...page);

    const total = Math.min(10000, Math.max(0, Number(payload?.result?.total || goods.length)));
    if (!page.length || goods.length >= total || page.length < limit) break;
    offset += limit;
  }

  return goods;
}

async function getNationalCatalogCard(token: string, gtin: string) {
  const params = new URLSearchParams({ gtin, format: "json" });
  const response = await fetch(`${NK_API_BASE}/v3/feed-product?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await parseJsonResponse(response);
  const rows = Array.isArray(payload?.result) ? payload.result : [];
  return rows[0] || null;
}

function getCardGtin(card: any) {
  const identifiers = Array.isArray(card?.identified_by) ? card.identified_by : [];
  const gtin = identifiers.find((item: any) => String(item?.type || "").toLowerCase() === "gtin");
  return String(gtin?.value || "");
}

function getCardTnved(card: any) {
  const attrs = Array.isArray(card?.good_attrs) ? card.good_attrs : [];
  const exact = attrs.find((item: any) => Number(item?.attr_id) === 13933);
  if (exact?.attr_value) return String(exact.attr_value);
  const group = attrs.find((item: any) => Number(item?.attr_id) === 3959);
  return group?.attr_value ? String(group.attr_value) : "";
}

async function saveProductMapping(productId: string, card: any) {
  const gtin = getCardGtin(card);
  if (!gtin) throw new Error("В карточке Национального каталога не найден GTIN.");

  const { url, serviceRoleKey } = getSupabaseEnv();
  const body = [{
    product_id: productId,
    gtin,
    good_id: card?.good_id ? Number(card.good_id) : null,
    good_name: card?.good_name ? String(card.good_name) : null,
    good_status: card?.good_status ? String(card.good_status) : null,
    good_mark_flag: typeof card?.good_mark_flag === "boolean" ? card.good_mark_flag : null,
    good_turn_flag: typeof card?.good_turn_flag === "boolean" ? card.good_turn_flag : null,
    brand_name: card?.brand_name ? String(card.brand_name) : null,
    tnved: getCardTnved(card) || null,
    raw_data: card,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }];

  const response = await fetch(
    `${url}/rest/v1/chz_product_mappings?on_conflict=product_id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Не удалось сохранить соответствие GTIN: ${text.slice(0, 300)}`);
  }

  const rows = await response.json();
  return rows?.[0] || body[0];
}


async function buildCodeOrderPreview() {
  const state = await readState();
  const codeOrderFromAt = state?.code_order_from_at ? new Date(state.code_order_from_at).getTime() : Date.now();

  const [mappings, products, orders, batches, codeOrders, codeItems, sources] = await Promise.all([
    serviceSelect("chz_product_mappings?select=product_id,gtin,good_name,good_status&order=gtin.asc"),
    serviceSelect("products?select=id,name,article,is_active&is_active=eq.true"),
    serviceSelect("production_orders?select=id,order_number,product_id,status,quantity,created_at"),
    serviceSelect("production_batches?select=id,production_order_id,batch_number,quantity,completed_quantity,status,completed_at&completed_quantity=gt.0"),
    serviceSelect("chz_code_orders?select=id,status"),
    serviceSelect("chz_code_order_items?select=id,order_id,gtin,requested_quantity,received_quantity,status"),
    serviceSelect("chz_code_order_sources?select=id,order_item_id,product_id,production_order_id,production_batch_id,completed_quantity_snapshot,allocated_quantity"),
  ]);

  const mappingByProduct = new Map<string, any>();
  for (const row of mappings) mappingByProduct.set(String(row.product_id), row);

  const productById = new Map<string, any>();
  for (const row of products) productById.set(String(row.id), row);

  const orderById = new Map<string, any>();
  for (const row of orders) orderById.set(String(row.id), row);

  const codeOrderStatusById = new Map<string, string>();
  for (const row of codeOrders) codeOrderStatusById.set(String(row.id), String(row.status || ""));

  const codeItemById = new Map<string, any>();
  for (const row of codeItems) codeItemById.set(String(row.id), row);

  const allocatedByBatch = new Map<string, number>();
  for (const source of sources) {
    const item = codeItemById.get(String(source.order_item_id));
    if (!item) continue;
    const parentStatus = codeOrderStatusById.get(String(item.order_id)) || "";
    if (["cancelled", "canceled", "failed", "error"].includes(parentStatus.toLowerCase())) continue;

    const batchId = String(source.production_batch_id);
    allocatedByBatch.set(
      batchId,
      (allocatedByBatch.get(batchId) || 0) + Math.max(0, Number(source.allocated_quantity || 0)),
    );
  }

  const byGtin = new Map<string, any>();

  for (const batch of batches) {
    const completedAt = batch?.completed_at ? new Date(batch.completed_at).getTime() : 0;
    if (!completedAt || completedAt < codeOrderFromAt) continue;

    const productionOrder = orderById.get(String(batch.production_order_id));
    if (!productionOrder) continue;

    const productId = String(productionOrder.product_id || "");
    const mapping = mappingByProduct.get(productId);
    if (!mapping?.gtin) continue;

    const completed = Math.max(0, Number(batch.completed_quantity || 0));
    const allocated = Math.max(0, allocatedByBatch.get(String(batch.id)) || 0);
    const available = Math.max(0, completed - allocated);
    if (available <= 0) continue;

    const gtin = String(mapping.gtin);
    const product = productById.get(productId);
    let group = byGtin.get(gtin);

    if (!group) {
      group = {
        gtin,
        goodName: mapping.good_name || null,
        goodStatus: mapping.good_status || null,
        completedQuantity: 0,
        alreadyAllocated: 0,
        toOrder: 0,
        products: [],
        sources: [],
      };
      byGtin.set(gtin, group);
    }

    group.completedQuantity += completed;
    group.alreadyAllocated += allocated;
    group.toOrder += available;
    group.products.push({
      productId,
      article: product?.article || null,
      name: product?.name || productId,
      available,
    });
    group.sources.push({
      productionBatchId: String(batch.id),
      productionOrderId: String(productionOrder.id),
      orderNumber: productionOrder.order_number || null,
      batchNumber: batch.batch_number || null,
      productId,
      completedQuantity: completed,
      allocatedQuantity: allocated,
      availableQuantity: available,
    });
  }

  const rows = Array.from(byGtin.values())
    .map((group) => {
      const productMap = new Map<string, any>();
      for (const product of group.products) {
        const existing = productMap.get(product.productId);
        if (existing) existing.available += product.available;
        else productMap.set(product.productId, { ...product });
      }
      return {
        ...group,
        products: Array.from(productMap.values()).sort((a, b) =>
          String(a.article || a.name).localeCompare(String(b.article || b.name), "ru"),
        ),
      };
    })
    .sort((a, b) => String(a.gtin).localeCompare(String(b.gtin)));

  return {
    rows,
    totalToOrder: rows.reduce((sum, row) => sum + Number(row.toOrder || 0), 0),
    totalGtins: rows.length,
    codeOrderFromAt: new Date(codeOrderFromAt).toISOString(),
  };
}

function publicState(state: any) {
  if (!state) {
    return {
      configured: false,
      connected: false,
      expiresAt: null,
      apiVersion: null,
      gisConnected: false,
      gisExpiresAt: null,
      lastPingAt: null,
      lastPingOk: null,
      lastPingMessage: null,
    };
  }

  const expiresAt = state?.expires_at ? String(state.expires_at) : null;
  const connected = Boolean(
    state?.client_token &&
    expiresAt &&
    new Date(expiresAt).getTime() > Date.now(),
  );

  const gisExpiresAt = state?.gis_expires_at ? String(state.gis_expires_at) : null;
  const gisConnected = Boolean(
    state?.gis_token &&
    gisExpiresAt &&
    new Date(gisExpiresAt).getTime() > Date.now(),
  );

  return {
    configured: Boolean(state?.oms_id && state?.oms_connection),
    connected,
    expiresAt,
    apiVersion: state?.api_version || null,
    gisConnected,
    gisExpiresAt,
    lastPingAt: state?.last_ping_at || null,
    lastPingOk: state?.last_ping_ok ?? null,
    lastPingMessage: state?.last_ping_message || null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "status") {
      return json(publicState(await readState()));
    }

    if (action === "challenge" || action === "gis_challenge") {
      const errors: string[] = [];

      for (const apiVersion of ["v4", "v3"] as const) {
        try {
          const response = await fetch(`${TRUE_API_BASES[apiVersion]}/auth/key`, {
            method: "GET",
            headers: { Accept: "application/json" },
          });

          const payload = await parseJsonResponse(response);
          const uuid = String(payload?.uuid || "");
          const data = String(payload?.data || "");

          if (!uuid || !data) {
            throw new Error("Честный ЗНАК не вернул uuid/data для подписи.");
          }

          return json({ uuid, data, apiVersion });
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : "ошибка запроса";
          console.warn("chz_auth_challenge_fallback", JSON.stringify({ apiVersion, reason }));
          errors.push(`${apiVersion}: ${reason}`);
        }
      }

      throw new Error(`Не удалось получить данные для подписи. ${errors.join(" | ")}`);
    }

    if (action === "signin") {
      const omsId = String(body?.omsId || "").trim();
      const omsConnection = String(body?.omsConnection || "").trim();
      const uuid = String(body?.uuid || "").trim();
      const signature = String(body?.signature || "").replace(/\s+/g, "");
      const inn = String(body?.inn || "").trim();
      const requestedVersion = String(body?.apiVersion || "v3");
      const apiVersion: keyof typeof TRUE_API_BASES = requestedVersion === "v4" ? "v4" : "v3";
      const trueApiBase = TRUE_API_BASES[apiVersion];

      if (!omsId) throw new Error("Не указан OMS ID.");
      if (!omsConnection) throw new Error("Не указан omsConnection.");
      if (!uuid) throw new Error("Не указан UUID авторизации.");
      if (!signature) throw new Error("Не передана подпись УКЭП.");

      const requestBody: Record<string, string> = { uuid, data: signature };
      if (inn) requestBody.inn = inn;

      const response = await fetch(
        `${trueApiBase}/auth/simpleSignIn/${encodeURIComponent(omsConnection)}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      console.info("chz_suz_signin_diagnostic", JSON.stringify({
        apiVersion,
        endpoint: "/auth/simpleSignIn/{omsConnection}",
        omsConnectionProvided: Boolean(omsConnection),
        innProvided: Boolean(inn),
        httpStatus: response.status,
        contentType: response.headers.get("content-type") || "missing",
        upstreamRequestId: response.headers.get("x-request-id") || response.headers.get("x-correlation-id") || null,
      }));

      const payload = await parseJsonResponse(response);
      const token = String(payload?.token || "");
      if (!token) throw new Error("Честный ЗНАК не вернул clientToken.");

      const expiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

      await upsertState({
        oms_id: omsId,
        oms_connection: omsConnection,
        client_token: token,
        api_version: apiVersion,
        expires_at: expiresAt,
        last_ping_at: null,
        last_ping_ok: null,
        last_ping_message: null,
      });

      return json({
        connected: true,
        apiVersion,
        expiresAt,
      });
    }

    if (action === "gis_signin") {
      const uuid = String(body?.uuid || "").trim();
      const signature = String(body?.signature || "").replace(/\s+/g, "");
      const inn = String(body?.inn || "").trim();
      const requestedVersion = String(body?.apiVersion || "v3");
      const apiVersion: keyof typeof TRUE_API_BASES = requestedVersion === "v4" ? "v4" : "v3";
      const trueApiBase = TRUE_API_BASES[apiVersion];

      if (!uuid) throw new Error("Не указан UUID авторизации ГИС МТ.");
      if (!signature) throw new Error("Не передана подпись УКЭП для ГИС МТ.");

      const requestBody: Record<string, string> = { uuid, data: signature };
      if (inn) requestBody.inn = inn;

      const response = await fetch(
        `${trueApiBase}/auth/simpleSignIn`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      const payload = await parseJsonResponse(response);
      const token = String(payload?.token || "");
      if (!token) throw new Error("Честный ЗНАК не вернул токен ГИС МТ.");

      const state = await readState();
      if (!state?.oms_id || !state?.oms_connection) {
        throw new Error("Сначала сохраните серверную сессию СУЗ.");
      }

      const gisExpiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

      await upsertState({
        oms_id: state.oms_id,
        oms_connection: state.oms_connection,
        client_token: state.client_token || null,
        api_version: state.api_version || apiVersion,
        expires_at: state.expires_at || null,
        gis_token: token,
        gis_expires_at: gisExpiresAt,
        last_ping_at: state.last_ping_at || null,
        last_ping_ok: state.last_ping_ok ?? null,
        last_ping_message: state.last_ping_message || null,
      });

      return json({
        gisConnected: true,
        apiVersion,
        gisExpiresAt,
      });
    }

    if (action === "catalog") {
      const state = await readState();
      if (!state?.gis_token) {
        throw new Error("Для Национального каталога нужен отдельный токен ГИС МТ. Выполните авторизацию ГИС МТ.");
      }
      const gisExpiresAt = state?.gis_expires_at ? new Date(state.gis_expires_at).getTime() : 0;
      if (!gisExpiresAt || gisExpiresAt <= Date.now()) {
        throw new Error("Токен ГИС МТ истёк. Выполните авторизацию ГИС МТ заново.");
      }

      const [goods, products, mappings] = await Promise.all([
        getNationalCatalogGoods(String(state.gis_token)),
        serviceSelect("products?select=id,name,article,is_active,item_id&is_active=eq.true&order=name.asc"),
        serviceSelect("chz_product_mappings?select=id,product_id,gtin,good_id,good_name,good_status,good_mark_flag,good_turn_flag,brand_name,tnved,last_checked_at&order=updated_at.desc"),
      ]);

      return json({
        goods,
        total: goods.length,
        products,
        mappings,
      });
    }

    if (action === "save_mapping") {
      const state = await readState();
      if (!state?.gis_token) throw new Error("Для Национального каталога нужен токен ГИС МТ.");
      const gisExpiresAt = state?.gis_expires_at ? new Date(state.gis_expires_at).getTime() : 0;
      if (!gisExpiresAt || gisExpiresAt <= Date.now()) {
        throw new Error("Токен ГИС МТ истёк. Выполните авторизацию ГИС МТ заново.");
      }

      const productId = String(body?.productId || "").trim();
      const gtin = String(body?.gtin || "").trim();
      if (!productId) throw new Error("Не выбран товар ERP.");
      if (!gtin) throw new Error("Не выбран GTIN.");

      const products = await serviceSelect(`products?id=eq.${encodeURIComponent(productId)}&select=id,name,article&limit=1`);
      if (!products?.[0]) throw new Error("Товар ERP не найден.");

      const card = await getNationalCatalogCard(String(state.gis_token), gtin);
      if (!card) throw new Error("Карточка GTIN не найдена среди собственных карточек Национального каталога.");

      const mapping = await saveProductMapping(productId, card);
      return json({ mapping });
    }


function buildSuzOrderPayload(gtin: string, quantity: number) {
  const normalizedGtin = String(gtin || "").trim().padStart(14, "0");

  if (!/^\d{14}$/.test(normalizedGtin)) {
    throw new Error("GTIN для СУЗ должен содержать 14 цифр.");
  }

  return JSON.stringify({
    productGroup: "lp",
    products: [
      {
        gtin: normalizedGtin,
        quantity,
        serialNumberType: "OPERATOR",
        templateId: 10,
        cisType: "UNIT",
      },
    ],
    attributes: {
      releaseMethodType: "PRODUCTION",
      createMethodType: "SELF_MADE",
    },
  });
}

async function getProductionCodeOrder(productionOrderId: string) {
  const orders = await serviceSelect(
    `production_orders?id=eq.${encodeURIComponent(productionOrderId)}&select=id,order_number,product_id,quantity,status&limit=1`,
  );
  const productionOrder = orders?.[0];
  if (!productionOrder) throw new Error("Производственный заказ не найден.");

  const codeOrders = await serviceSelect(
    `chz_code_orders?internal_number=eq.${encodeURIComponent(String(productionOrder.order_number || productionOrder.id))}&select=id,internal_number,external_order_id,status,source,total_requested,total_received,created_at,updated_at&limit=1`,
  );
  const codeOrder = codeOrders?.[0] || null;

  let codeItem = null;
  if (codeOrder?.id) {
    const items = await serviceSelect(
      `chz_code_order_items?order_id=eq.${encodeURIComponent(String(codeOrder.id))}&select=id,order_id,gtin,requested_quantity,received_quantity,status&limit=1`,
    );
    codeItem = items?.[0] || null;
  }

  return { productionOrder, codeOrder, codeItem };
}

async function saveMarkingCodes(
  orderId: string,
  orderItemId: string,
  codes: string[],
  blockId: string | null,
) {
  if (!codes.length) return [];

  const { url, serviceRoleKey } = getSupabaseEnv();
  const now = new Date().toISOString();
  const rows = codes.map((code) => ({
    order_id: orderId,
    order_item_id: orderItemId,
    code,
    block_id: blockId,
    status: "received",
    received_at: now,
    updated_at: now,
  }));

  const response = await fetch(
    `${url}/rest/v1/chz_marking_codes?on_conflict=order_item_id,code`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(rows),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Не удалось сохранить коды маркировки: ${text.slice(0, 300)}`);
  }

  return response.json();
}

async function getStoredMarkingCodes(orderItemId: string) {
  if (!orderItemId) return [];
  return serviceSelect(
    `chz_marking_codes?order_item_id=eq.${encodeURIComponent(orderItemId)}&select=id,code,block_id,status,received_at,printed_at,applied_at&order=received_at.asc`,
  );
}

async function patchServiceRow(path: string, values: Record<string, unknown>) {
  const { url, serviceRoleKey } = getSupabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(values),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Не удалось обновить данные ЧЗ: ${text.slice(0, 300)}`);
  }
  return response.json();
}

    if (action === "production_code_order_status") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");

      const { productionOrder, codeOrder, codeItem } = await getProductionCodeOrder(productionOrderId);
      const markingCodes = codeItem?.id
        ? await getStoredMarkingCodes(String(codeItem.id))
        : [];
      return json({
        productionOrder,
        codeOrder,
        codeItem,
        markingCodes,
      });
    }

    if (action === "prepare_suz_order_submission") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");

      const { productionOrder, codeOrder, codeItem } = await getProductionCodeOrder(productionOrderId);
      if (!codeOrder || !codeItem) {
        throw new Error("Для этого производственного задания нет подготовленного заказа ЧЗ.");
      }
      if (codeOrder.external_order_id) {
        throw new Error("Этот заказ уже отправлен в СУЗ.");
      }

      const gtin = String(codeItem.gtin || "");
      const quantity = Math.trunc(Number(codeItem.requested_quantity || 0));
      if (!gtin || quantity <= 0) throw new Error("В черновике ЧЗ нет корректного GTIN/количества.");

      const payloadString = buildSuzOrderPayload(gtin, quantity);

      return json({
        productionOrder,
        codeOrder,
        codeItem,
        payloadString,
        payload: JSON.parse(payloadString),
      });
    }

    if (action === "submit_suz_order") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      const signature = String(body?.signature || "").replace(/\s+/g, "");
      const payloadString = String(body?.payloadString || "");
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");
      if (!signature) throw new Error("Не передана откреплённая подпись X-Signature.");
      if (!payloadString) throw new Error("Не передано подписанное тело заказа.");

      const state = await readState();
      if (!state?.client_token || !state?.oms_id) {
        throw new Error("Нет активной серверной сессии СУЗ. Авторизуйтесь в Честном ЗНАКе.");
      }
      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Сессия СУЗ истекла. Авторизуйтесь заново.");
      }

      const { productionOrder, codeOrder, codeItem } = await getProductionCodeOrder(productionOrderId);
      if (!codeOrder || !codeItem) throw new Error("Черновик заказа ЧЗ не найден.");
      if (codeOrder.external_order_id) {
        return json({
          submitted: true,
          alreadySubmitted: true,
          orderId: codeOrder.external_order_id,
          status: codeOrder.status,
        });
      }

      const expectedPayload = buildSuzOrderPayload(
        String(codeItem.gtin || ""),
        Math.trunc(Number(codeItem.requested_quantity || 0)),
      );
      if (payloadString !== expectedPayload) {
        throw new Error("Подписанное тело заказа изменилось. Подготовьте подпись заново.");
      }

      const response = await fetch(
        `${SUZ_API_BASE}/order?omsId=${encodeURIComponent(String(state.oms_id))}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            clientToken: String(state.client_token),
            "X-Signature": signature,
          },
          body: payloadString,
        },
      );

      const responseText = await response.text();
      let payload: any = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { raw: responseText };
      }

      if (!response.ok) {
        const message =
          payload?.error_message ||
          payload?.description ||
          payload?.message ||
          payload?.error ||
          payload?.raw ||
          "";
        const exactError = `СУЗ вернул HTTP ${response.status}${message ? `: ${String(message).slice(0, 500)}` : ""}`;

        try {
          await patchServiceRow(
            `chz_code_orders?id=eq.${encodeURIComponent(String(codeOrder.id))}`,
            {
              error_message: exactError,
              updated_at: new Date().toISOString(),
            },
          );
        } catch {
          // Диагностическая запись не должна скрывать исходную ошибку СУЗ.
        }

        return json({
          error: exactError,
          upstreamStatus: response.status,
          upstream: payload,
        });
      }

      const externalOrderId = String(payload?.orderId || "");
      if (!externalOrderId) {
        throw new Error("СУЗ ответил успешно, но не вернул orderId.");
      }

      const upstreamStatus = String(payload?.orderStatus || "submitted");
      await patchServiceRow(
        `chz_code_orders?id=eq.${encodeURIComponent(String(codeOrder.id))}`,
        {
          external_order_id: externalOrderId,
          status: upstreamStatus.toLowerCase(),
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: payload?.declineReason ? String(payload.declineReason) : null,
        },
      );
      await patchServiceRow(
        `chz_code_order_items?id=eq.${encodeURIComponent(String(codeItem.id))}`,
        {
          status: upstreamStatus.toLowerCase(),
          updated_at: new Date().toISOString(),
        },
      );

      return json({
        submitted: true,
        orderId: externalOrderId,
        orderStatus: upstreamStatus,
        response: payload,
        productionOrder,
      });
    }

    if (action === "fetch_suz_codes") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");

      const state = await readState();
      if (!state?.client_token || !state?.oms_id) {
        throw new Error("Нет активной серверной сессии СУЗ.");
      }
      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Сессия СУЗ истекла. Авторизуйтесь заново.");
      }

      const { codeOrder, codeItem } = await getProductionCodeOrder(productionOrderId);
      if (!codeOrder?.external_order_id || !codeItem?.gtin) {
        throw new Error("Заказ ещё не отправлен в СУЗ.");
      }

      const requested = Math.max(0, Math.trunc(Number(codeItem.requested_quantity || 0)));
      const storedCodes = await getStoredMarkingCodes(String(codeItem.id));
      const storedCount = storedCodes.length;

      if (storedCount >= requested && requested > 0) {
        return json({
          received: 0,
          totalReceived: storedCount,
          requested,
          codes: storedCodes.map((row: any) => String(row.code || "")).filter(Boolean),
          blockId: storedCodes.find((row: any) => row.block_id)?.block_id || null,
          status: codeOrder.status || "codes_received",
          restoredFromStorage: true,
        });
      }

      const alreadyReceived = Math.max(0, Math.trunc(Number(codeItem.received_quantity || 0)));
      const remaining = Math.max(0, requested - storedCount);
      if (remaining <= 0) {
        throw new Error("Все заказанные коды уже сохранены.");
      }

      const normalizedGtin = String(codeItem.gtin || "").trim().padStart(14, "0");
      if (!/^\d{14}$/.test(normalizedGtin)) {
        throw new Error("GTIN для получения кодов СУЗ должен содержать 14 цифр.");
      }

      let codes: string[] = [];
      let blockId: string | null = null;

      const recoverAlreadyIssued =
        alreadyReceived >= requested &&
        storedCount < requested &&
        requested > 0;

      if (recoverAlreadyIssued) {
        const blocksParams = new URLSearchParams({
          omsId: String(state.oms_id),
          orderId: String(codeOrder.external_order_id),
          gtin: normalizedGtin,
        });

        const blocksResponse = await fetch(
          `${SUZ_API_BASE}/order/codes/blocks?${blocksParams.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              clientToken: String(state.client_token),
            },
          },
        );
        const blocksPayload = await parseJsonResponse(blocksResponse);
        const blocks = Array.isArray(blocksPayload?.blocks) ? blocksPayload.blocks : [];

        for (const block of blocks) {
          const currentBlockId = String(block?.blockId || "").trim();
          if (!currentBlockId) continue;

          const retryParams = new URLSearchParams({
            omsId: String(state.oms_id),
            blockId: currentBlockId,
          });
          const retryResponse = await fetch(
            `${SUZ_API_BASE}/order/codes/retry?${retryParams.toString()}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
                clientToken: String(state.client_token),
              },
            },
          );
          const retryPayload = await parseJsonResponse(retryResponse);
          const retryCodes = Array.isArray(retryPayload?.codes)
            ? retryPayload.codes.map((code: unknown) => String(code || "")).filter(Boolean)
            : [];

          if (retryCodes.length) {
            blockId = currentBlockId;
            codes.push(...retryCodes);
          }
          if (codes.length >= remaining) break;
        }

        codes = codes.slice(0, remaining);
      } else {
        const params = new URLSearchParams({
          orderId: String(codeOrder.external_order_id),
          gtin: normalizedGtin,
          quantity: String(remaining),
          omsId: String(state.oms_id),
        });

        const response = await fetch(`${SUZ_API_BASE}/codes?${params.toString()}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            clientToken: String(state.client_token),
          },
        });

        const payload = await parseJsonResponse(response);
        codes = Array.isArray(payload?.codes)
          ? payload.codes.map((code: unknown) => String(code || "")).filter(Boolean)
          : [];
        blockId = payload?.blockId ? String(payload.blockId) : null;
      }

      if (!codes.length) {
        return json({
          received: 0,
          codes: [],
          blockId,
          message: "СУЗ пока не вернул готовые коды.",
        });
      }

      await saveMarkingCodes(
        String(codeOrder.id),
        String(codeItem.id),
        codes,
        blockId,
      );

      const savedCodes = await getStoredMarkingCodes(String(codeItem.id));
      const totalReceived = Math.min(requested, savedCodes.length);
      const nextStatus = totalReceived >= requested ? "codes_received" : "partially_received";

      await patchServiceRow(
        `chz_code_orders?id=eq.${encodeURIComponent(String(codeOrder.id))}`,
        {
          status: nextStatus,
          total_received: totalReceived,
          updated_at: new Date().toISOString(),
          completed_at: totalReceived >= requested ? new Date().toISOString() : null,
          error_message: null,
        },
      );
      await patchServiceRow(
        `chz_code_order_items?id=eq.${encodeURIComponent(String(codeItem.id))}`,
        {
          status: nextStatus,
          received_quantity: totalReceived,
          updated_at: new Date().toISOString(),
        },
      );

      return json({
        received: codes.length,
        totalReceived,
        requested,
        codes: savedCodes.map((row: any) => String(row.code || "")).filter(Boolean),
        blockId:
          savedCodes.find((row: any) => row.block_id)?.block_id ||
          blockId,
        status: nextStatus,
      });
    }

    if (action === "refresh_suz_order_status") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");

      const state = await readState();
      if (!state?.client_token || !state?.oms_id) {
        throw new Error("Нет активной серверной сессии СУЗ.");
      }

      const { codeOrder, codeItem } = await getProductionCodeOrder(productionOrderId);
      if (!codeOrder?.external_order_id || !codeItem?.gtin) {
        throw new Error("Заказ ещё не отправлен в СУЗ.");
      }

      const normalizedGtin = String(codeItem.gtin || "").trim().padStart(14, "0");
      if (!/^\d{14}$/.test(normalizedGtin)) {
        throw new Error("GTIN для проверки статуса СУЗ должен содержать 14 цифр.");
      }

      const params = new URLSearchParams({
        omsId: String(state.oms_id),
        orderId: String(codeOrder.external_order_id),
        gtin: normalizedGtin,
      });
      const response = await fetch(`${SUZ_API_BASE}/order/status?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          clientToken: String(state.client_token),
        },
      });
      const payload = await parseJsonResponse(response);
      const status = String(payload?.orderStatus || payload?.status || codeOrder.status || "submitted");
      const received = Math.max(
        0,
        Number(
          payload?.totalObtainedCodesCnt ??
          payload?.totalCodes ??
          payload?.buffers?.[0]?.totalPassed ??
          codeOrder.total_received ??
          0,
        ),
      );

      await patchServiceRow(
        `chz_code_orders?id=eq.${encodeURIComponent(String(codeOrder.id))}`,
        {
          status: status.toLowerCase(),
          total_received: received,
          updated_at: new Date().toISOString(),
          error_message: payload?.declineReason ? String(payload.declineReason) : null,
        },
      );
      await patchServiceRow(
        `chz_code_order_items?id=eq.${encodeURIComponent(String(codeItem.id))}`,
        {
          status: status.toLowerCase(),
          received_quantity: received,
          updated_at: new Date().toISOString(),
        },
      );

      return json({
        orderId: codeOrder.external_order_id,
        status,
        received,
        response: payload,
      });
    }

    if (action === "production_chz_info") {
      const productId = String(body?.productId || "").trim();
      if (!productId) throw new Error("Не выбран товар ERP.");

      const mappings = await serviceSelect(
        `chz_product_mappings?product_id=eq.${encodeURIComponent(productId)}&select=product_id,gtin,good_name,good_status&limit=1`,
      );

      const mapping = mappings?.[0] || null;
      return json({
        mapped: Boolean(mapping?.gtin),
        mapping,
      });
    }

    if (action === "prepare_production_code_order") {
      const productionOrderId = String(body?.productionOrderId || "").trim();
      if (!productionOrderId) throw new Error("Не указан производственный заказ.");

      const orders = await serviceSelect(
        `production_orders?id=eq.${encodeURIComponent(productionOrderId)}&select=id,order_number,product_id,quantity,status&limit=1`,
      );
      const productionOrder = orders?.[0];
      if (!productionOrder) throw new Error("Производственный заказ не найден.");

      const mappings = await serviceSelect(
        `chz_product_mappings?product_id=eq.${encodeURIComponent(String(productionOrder.product_id))}&select=product_id,gtin,good_name,good_status&limit=1`,
      );
      const mapping = mappings?.[0];
      if (!mapping?.gtin) {
        throw new Error("У выбранного изделия нет связи с GTIN Честного ЗНАКа.");
      }

      const requestedQuantity = Math.trunc(Number(productionOrder.quantity || 0));
      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        throw new Error("Количество производственного заказа должно быть больше 0.");
      }

      const { url, serviceRoleKey } = getSupabaseEnv();
      const internalNumber = String(productionOrder.order_number || productionOrder.id);

      const orderResponse = await fetch(
        `${url}/rest/v1/chz_code_orders?on_conflict=internal_number`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{
            internal_number: internalNumber,
            status: "draft",
            source: "production",
            total_requested: requestedQuantity,
            total_received: 0,
            updated_at: new Date().toISOString(),
          }]),
        },
      );
      if (!orderResponse.ok) {
        const text = await orderResponse.text();
        throw new Error(`Не удалось создать связанный заказ ЧЗ: ${text.slice(0, 300)}`);
      }

      const orderRows = await orderResponse.json();
      const codeOrder = orderRows?.[0];
      if (!codeOrder?.id) throw new Error("Не удалось получить идентификатор заказа ЧЗ.");

      const itemResponse = await fetch(
        `${url}/rest/v1/chz_code_order_items?on_conflict=order_id,gtin`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify([{
            order_id: codeOrder.id,
            gtin: String(mapping.gtin),
            requested_quantity: requestedQuantity,
            received_quantity: 0,
            status: "draft",
            updated_at: new Date().toISOString(),
          }]),
        },
      );
      if (!itemResponse.ok) {
        const text = await itemResponse.text();
        throw new Error(`Не удалось сохранить позицию заказа ЧЗ: ${text.slice(0, 300)}`);
      }

      const itemRows = await itemResponse.json();

      return json({
        prepared: true,
        codeOrder,
        item: itemRows?.[0] || null,
        productionOrder: {
          id: productionOrder.id,
          orderNumber: productionOrder.order_number,
          quantity: requestedQuantity,
        },
        mapping,
      });
    }

    if (action === "code_order_preview") {
      const preview = await buildCodeOrderPreview();
      return json(preview);
    }

    if (action === "ping") {
      const state = await readState();
      if (!state?.client_token || !state?.oms_id) {
        throw new Error("Серверная сессия Честного ЗНАКа ещё не сохранена. Выполните авторизацию.");
      }

      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Серверная сессия Честного ЗНАКа истекла. Выполните авторизацию заново.");
      }

      const response = await fetch(
        `${SUZ_API_BASE}/ping?omsId=${encodeURIComponent(String(state.oms_id))}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            clientToken: String(state.client_token),
          },
        },
      );

      const responseText = await response.text();
      const pingAt = new Date().toISOString();
      const pingOk = response.ok;
      const pingMessage = pingOk
        ? (responseText.trim() || `HTTP ${response.status}`)
        : `HTTP ${response.status}: ${responseText.slice(0, 500)}`;

      await upsertState({
        oms_id: state.oms_id,
        oms_connection: state.oms_connection,
        client_token: state.client_token,
        api_version: state.api_version || "v3",
        expires_at: state.expires_at,
        last_ping_at: pingAt,
        last_ping_ok: pingOk,
        last_ping_message: pingMessage,
      });

      if (!pingOk) {
        throw new Error(`СУЗ API 3.0 не подтвердил соединение: ${pingMessage}`);
      }

      return json({
        ok: true,
        checkedAt: pingAt,
        message: pingMessage,
      });
    }

    return json({ error: "Неизвестное действие." }, 400);
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Не удалось выполнить операцию Честного ЗНАКа.";
    console.error("chestny-znak-auth:", message);
    return json({ error: message }, 400);
  }
});
