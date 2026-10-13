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

function publicState(state: any) {
  if (!state) {
    return {
      configured: false,
      connected: false,
      expiresAt: null,
      apiVersion: null,
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

  return {
    configured: Boolean(state?.oms_id && state?.oms_connection),
    connected,
    expiresAt,
    apiVersion: state?.api_version || null,
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

    if (action === "challenge") {
      const errors: string[] = [];

      for (const apiVersion of ["v3", "v4"] as const) {
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
          errors.push(`${apiVersion}: ${cause instanceof Error ? cause.message : "ошибка запроса"}`);
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


    if (action === "catalog") {
      const state = await readState();
      if (!state?.client_token) {
        throw new Error("Сначала авторизуйтесь в Честном ЗНАКе.");
      }
      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Серверная сессия Честного ЗНАКа истекла. Авторизуйтесь заново.");
      }

      const [goods, products, mappings] = await Promise.all([
        getNationalCatalogGoods(String(state.client_token)),
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
      if (!state?.client_token) throw new Error("Сначала авторизуйтесь в Честном ЗНАКе.");
      const expiresAt = state?.expires_at ? new Date(state.expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) {
        throw new Error("Серверная сессия Честного ЗНАКа истекла. Авторизуйтесь заново.");
      }

      const productId = String(body?.productId || "").trim();
      const gtin = String(body?.gtin || "").trim();
      if (!productId) throw new Error("Не выбран товар ERP.");
      if (!gtin) throw new Error("Не выбран GTIN.");

      const products = await serviceSelect(`products?id=eq.${encodeURIComponent(productId)}&select=id,name,article&limit=1`);
      if (!products?.[0]) throw new Error("Товар ERP не найден.");

      const card = await getNationalCatalogCard(String(state.client_token), gtin);
      if (!card) throw new Error("Карточка GTIN не найдена среди собственных карточек Национального каталога.");

      const mapping = await saveProductMapping(productId, card);
      return json({ mapping });
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
