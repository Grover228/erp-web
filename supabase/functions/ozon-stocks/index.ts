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

function normalizeWarehouse(row: any) {
  const warehouse =
    row?.storage_warehouse ||
    row?.warehouse ||
    row;

  const id = String(
    warehouse?.warehouse_id ||
    warehouse?.id ||
    row?.warehouse_id ||
    row?.id ||
    "",
  );

  const name = String(
    warehouse?.name ||
    row?.name ||
    row?.warehouse_name ||
    row?.title ||
    "",
  );

  const address = String(
    warehouse?.address?.address ||
    warehouse?.address ||
    row?.address?.address ||
    row?.address ||
    "",
  );

  return { id, name, address, raw: row };
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
    return json({ error: "Остатки Ozon доступны только администратору." }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  async function ozon(path: string, payload: unknown, allowNon2xx = false) {
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
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = { raw: text };
    }

    if (!response.ok && !allowNon2xx) {
      throw new Error(
        `Ozon API ${path}: HTTP ${response.status}. ${String(
          result?.message || result?.raw || "Ошибка",
        ).slice(0, 800)}`,
      );
    }

    return { ok: response.ok, status: response.status, data: result };
  }

  try {
    const body = await req.json().catch(() => ({}));
    const warehouseSearch = String(body?.warehouseSearch || "").trim();
    const saveSnapshot = body?.saveSnapshot !== false;

    const rows: any[] = [];
    let lastId = "";
    let guard = 0;

    do {
      const response = await ozon("/v4/product/info/stocks", {
        filter: { visibility: "ALL" },
        last_id: lastId,
        limit: 1000,
      });

      const items = response.data?.items || response.data?.result?.items || [];
      rows.push(...items);

      const nextLastId = String(
        response.data?.last_id ||
        response.data?.result?.last_id ||
        "",
      );

      if (!nextLastId || nextLastId === lastId) break;
      lastId = nextLastId;
      guard += 1;
    } while (guard < 100);

    const articles = [...new Set(
      rows
        .map((row) => String(row?.offer_id || "").toLowerCase())
        .filter(Boolean),
    )];

    const nameByArticle = new Map<string, string>();

    if (articles.length) {
      const [{ data: items }, { data: products }] = await Promise.all([
        admin.from("items").select("article,name").in("article", articles),
        admin.from("products").select("article,name").in("article", articles),
      ]);

      for (const row of products || []) {
        nameByArticle.set(
          String(row.article || "").toLowerCase(),
          row.name || row.article,
        );
      }

      for (const row of items || []) {
        nameByArticle.set(
          String(row.article || "").toLowerCase(),
          row.name || row.article,
        );
      }
    }

    const stocks = rows
      .map((row) => {
        const article = String(row?.offer_id || "");
        const articleKey = article.toLowerCase();
        const stockEntries = Array.isArray(row?.stocks)
          ? row.stocks
          : Object.values(row?.stocks || {});

        const fboEntries = stockEntries.filter(
          (stock: any) => String(stock?.type || "").toLowerCase() === "fbo",
        );

        const fbsEntries = stockEntries.filter(
          (stock: any) => String(stock?.type || "").toLowerCase() === "fbs",
        );

        const fboPresent = fboEntries.reduce(
          (sum: number, stock: any) => sum + Number(stock?.present || 0),
          0,
        );

        const fboReserved = fboEntries.reduce(
          (sum: number, stock: any) => sum + Number(stock?.reserved || 0),
          0,
        );

        const fbsPresent = fbsEntries.reduce(
          (sum: number, stock: any) => sum + Number(stock?.present || 0),
          0,
        );

        const fbsReserved = fbsEntries.reduce(
          (sum: number, stock: any) => sum + Number(stock?.reserved || 0),
          0,
        );

        const fboWarehouseIds = [...new Set(
          fboEntries.flatMap((stock: any) =>
            Array.isArray(stock?.warehouse_ids)
              ? stock.warehouse_ids.map(String)
              : [],
          ),
        )];

        return {
          productId: String(row?.product_id || ""),
          article,
          name: nameByArticle.get(articleKey) || article,
          fboPresent,
          fboReserved,
          fboSku: fboEntries[0]?.sku ? String(fboEntries[0].sku) : "",
          fboWarehouseIds,
          fbsPresent,
          fbsReserved,
          fbsSku: fbsEntries[0]?.sku ? String(fbsEntries[0].sku) : "",
          totalPresent: fboPresent + fbsPresent,
          totalReserved: fboReserved + fbsReserved,
        };
      })
      .sort((a, b) => {
        if (b.fboPresent !== a.fboPresent) return b.fboPresent - a.fboPresent;
        return a.article.localeCompare(b.article, "ru");
      });

    const summary = stocks.reduce(
      (sum, row) => ({
        products:
          sum.products +
          (row.totalPresent > 0 || row.totalReserved > 0 ? 1 : 0),
        fboPresent: sum.fboPresent + row.fboPresent,
        fboReserved: sum.fboReserved + row.fboReserved,
        fbsPresent: sum.fbsPresent + row.fbsPresent,
        fbsReserved: sum.fbsReserved + row.fbsReserved,
      }),
      {
        products: 0,
        fboPresent: 0,
        fboReserved: 0,
        fbsPresent: 0,
        fbsReserved: 0,
      },
    );

    let snapshotBatchId = "";
    let snapshotSaved = 0;

    if (saveSnapshot) {
      snapshotBatchId = crypto.randomUUID();
      const snapshotAt = new Date().toISOString();

      const snapshotRows = stocks
        .filter((row) => row.fboWarehouseIds.length > 0)
        .map((row) => ({
          snapshot_batch_id: snapshotBatchId,
          snapshot_at: snapshotAt,
          product_id: row.productId || null,
          offer_id: row.article,
          product_name: row.name || null,
          fbo_sku: row.fboSku || null,
          fbo_present: row.fboPresent,
          fbo_reserved: row.fboReserved,
          warehouse_ids: row.fboWarehouseIds,
        }));

      if (snapshotRows.length) {
        const { error: snapshotError } = await admin
          .from("ozon_fbo_stock_snapshots")
          .insert(snapshotRows);

        if (snapshotError) {
          console.error("ozon stock snapshot failed", snapshotError.message);
        } else {
          snapshotSaved = snapshotRows.length;
        }
      }
    }

    let warehouseMatches: Array<{
      id: string;
      name: string;
      address: string;
    }> = [];
    let warehouseStocks: typeof stocks = [];
    let warehouseSearchWarning = "";

    if (warehouseSearch.length >= 2) {
      const searchResult = await ozon(
        "/v1/warehouse/fbo/list",
        {
          filter_by_supply_type: ["CREATE_TYPE_CROSSDOCK"],
          search: warehouseSearch,
        },
        true,
      );

      if (searchResult.ok) {
        const raw = searchResult.data || {};
        const sourceRows =
          (Array.isArray(raw?.search) && raw.search) ||
          (Array.isArray(raw?.result?.search) && raw.result.search) ||
          (Array.isArray(raw?.warehouses) && raw.warehouses) ||
          (Array.isArray(raw?.result?.warehouses) && raw.result.warehouses) ||
          (Array.isArray(raw?.result) && raw.result) ||
          [];

        warehouseMatches = sourceRows
          .map(normalizeWarehouse)
          .filter((row) => row.id)
          .map(({ id, name, address }) => ({ id, name, address }));

        const wantedIds = new Set(warehouseMatches.map((row) => row.id));
        warehouseStocks = stocks.filter((row) =>
          row.fboWarehouseIds.some((id) => wantedIds.has(String(id))),
        );
      } else {
        warehouseSearchWarning =
          String(
            searchResult.data?.message ||
            searchResult.data?.error?.message ||
            "Ozon не вернул справочник складов.",
          );
      }
    }

    return json({
      fetchedAt: new Date().toISOString(),
      summary,
      stocks,
      warehouseSearch: warehouseSearch || null,
      warehouseMatches,
      warehouseStocks,
      warehouseSearchWarning,
      snapshot: {
        batchId: snapshotBatchId || null,
        savedRows: snapshotSaved,
      },
    });
  } catch (cause: any) {
    const message =
      cause instanceof Error
        ? cause.message
        : cause?.message || "Ошибка загрузки остатков Ozon";

    console.error("ozon-stocks failed", message);
    return json({ error: message }, 500);
  }
});
