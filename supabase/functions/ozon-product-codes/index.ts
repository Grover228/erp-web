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

function normalizeArticle(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function firstNonEmpty(values: unknown[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
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
    return json({ error: "Синхронизация кодов Ozon доступна только администратору." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "preview");
  if (!["preview", "apply"].includes(action)) {
    return json({ error: "Неизвестное действие." }, 400);
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
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message = String(
        data?.message || data?.error?.message || data?.error || data?.raw || `HTTP ${response.status}`
      ).slice(0, 1200);
      throw new Error(`Ozon API ${path}: ${message}`);
    }

    return data;
  }

  try {
    const catalogRows: any[] = [];
    let catalogLastId = "";
    let catalogGuard = 0;

    do {
      const response = await ozon("/v3/product/list", {
        filter: { visibility: "ALL" },
        last_id: catalogLastId,
        limit: 1000,
      });

      const rows = Array.isArray(response?.result?.items) ? response.result.items : [];
      catalogRows.push(...rows);

      const nextLastId = String(response?.result?.last_id || "");
      catalogGuard += 1;
      if (!nextLastId || nextLastId === catalogLastId || !rows.length || catalogGuard >= 100) break;
      catalogLastId = nextLastId;
    } while (true);

    const productIds = [...new Set(
      catalogRows
        .map((row: any) => String(row?.product_id || row?.id || ""))
        .filter(Boolean)
    )];

    const ozonProducts: any[] = [];
    const infoByArticle = new Map<string, any>();

    for (let offset = 0; offset < productIds.length; offset += 1000) {
      const chunk = productIds.slice(offset, offset + 1000);

      const [attributesResponse, infoResponse] = await Promise.all([
        ozon("/v4/product/info/attributes", {
          filter: { product_id: chunk },
          limit: 1000,
        }),
        ozon("/v3/product/info/list", {
          product_id: chunk,
        }),
      ]);

      const attributeRows = Array.isArray(attributesResponse?.result)
        ? attributesResponse.result
        : Array.isArray(attributesResponse?.items)
        ? attributesResponse.items
        : Array.isArray(attributesResponse?.result?.items)
        ? attributesResponse.result.items
        : [];

      ozonProducts.push(...attributeRows);

      const infoRows = Array.isArray(infoResponse?.items)
        ? infoResponse.items
        : Array.isArray(infoResponse?.result?.items)
        ? infoResponse.result.items
        : [];

      for (const info of infoRows) {
        const article = normalizeArticle(info?.offer_id);
        if (article) infoByArticle.set(article, info);
      }
    }

    const categoryPairs = new Map<string, { descriptionCategoryId: number; typeId: number }>();
    for (const product of ozonProducts) {
      const descriptionCategoryId = Number(product?.description_category_id || 0);
      const typeId = Number(product?.type_id || 0);
      if (!descriptionCategoryId || !typeId) continue;
      categoryPairs.set(`${descriptionCategoryId}:${typeId}`, { descriptionCategoryId, typeId });
    }

    const codeAttributeIds = new Map<string, { gtinIds: number[]; tnvedIds: number[] }>();

    for (const [key, pair] of categoryPairs.entries()) {
      try {
        const response = await ozon("/v1/description-category/attribute", {
          description_category_id: pair.descriptionCategoryId,
          type_id: pair.typeId,
          language: "RU",
        });

        const definitions = Array.isArray(response?.result) ? response.result : [];
        const gtinIds: number[] = [];
        const tnvedIds: number[] = [];

        for (const definition of definitions) {
          const name = normalizeText(definition?.name).toLowerCase().replace(/ё/g, "е");
          const id = Number(definition?.id || 0);
          if (!id || !name) continue;

          if (
            name === "gtin" ||
            name.includes("gtin") ||
            (name.includes("глобаль") && name.includes("товар"))
          ) {
            gtinIds.push(id);
          }

          if (
            name.includes("тн вэд") ||
            name.includes("тнвэд") ||
            (name.includes("товар") && name.includes("внешнеэконом"))
          ) {
            tnvedIds.push(id);
          }
        }

        codeAttributeIds.set(key, { gtinIds, tnvedIds });
      } catch (cause) {
        console.warn("Не удалось получить описание атрибутов категории", key, cause);
        codeAttributeIds.set(key, { gtinIds: [], tnvedIds: [] });
      }
    }

    const ozonByArticle = new Map<string, any>();
    for (const product of ozonProducts) {
      const article = normalizeArticle(product?.offer_id);
      if (!article) continue;

      const descriptionCategoryId = Number(product?.description_category_id || 0);
      const typeId = Number(product?.type_id || 0);
      const attributeIds = codeAttributeIds.get(`${descriptionCategoryId}:${typeId}`) || {
        gtinIds: [],
        tnvedIds: [],
      };

      const attributes = Array.isArray(product?.attributes) ? product.attributes : [];
      const valueForIds = (ids: number[]) => {
        for (const attribute of attributes) {
          if (!ids.includes(Number(attribute?.id || 0))) continue;
          const values = Array.isArray(attribute?.values) ? attribute.values : [];
          const value = firstNonEmpty(values.map((row: any) => row?.value));
          if (value) return value;
        }
        return "";
      };

      const info = infoByArticle.get(article) || {};
      const attributeBarcodes = Array.isArray(product?.barcodes)
        ? product.barcodes.map((value: unknown) => normalizeText(value)).filter(Boolean)
        : [];
      const infoBarcodes = Array.isArray(info?.barcodes)
        ? info.barcodes.map((value: unknown) => normalizeText(value)).filter(Boolean)
        : [];
      const barcodes = [...new Set([...infoBarcodes, ...attributeBarcodes])];
      const barcode = firstNonEmpty([info?.barcode, product?.barcode, ...barcodes]);

      ozonByArticle.set(article, {
        offerId: String(product?.offer_id || info?.offer_id || ""),
        productId: String(product?.id || product?.product_id || info?.id || info?.product_id || ""),
        sku: String(info?.sku || product?.sku || ""),
        barcode,
        barcodes,
        gtin: valueForIds(attributeIds.gtinIds),
        tnved: valueForIds(attributeIds.tnvedIds),
      });
    }

    const [{ data: products, error: productsError }, { data: resaleItems, error: resaleError }] =
      await Promise.all([
        admin
          .from("products")
          .select("id,name,article,barcode,gtin,tnved,is_active")
          .order("name", { ascending: true }),
        admin
          .from("items")
          .select("id,name,article,barcode,gtin,tnved,is_active,item_type")
          .eq("item_type", "resale_product")
          .order("name", { ascending: true }),
      ]);

    if (productsError) throw productsError;
    if (resaleError) throw resaleError;

    const erpByArticle = new Map<string, any[]>();
    for (const row of products || []) {
      const article = normalizeArticle(row.article);
      if (!article) continue;
      const list = erpByArticle.get(article) || [];
      list.push({ entity: "product", ...row });
      erpByArticle.set(article, list);
    }
    for (const row of resaleItems || []) {
      const article = normalizeArticle(row.article);
      if (!article) continue;
      const list = erpByArticle.get(article) || [];
      list.push({ entity: "resale_product", ...row });
      erpByArticle.set(article, list);
    }

    const preview: any[] = [];
    const usedOzonArticles = new Set<string>();

    for (const [article, targets] of erpByArticle.entries()) {
      const ozonProduct = ozonByArticle.get(article) || null;
      if (ozonProduct) usedOzonArticles.add(article);

      for (const target of targets) {
        const duplicateErpArticle = targets.length > 1;
        const hasAnyOzonCode = Boolean(
          ozonProduct?.barcode || ozonProduct?.gtin || ozonProduct?.tnved
        );

        preview.push({
          entity: target.entity,
          id: target.id,
          name: target.name,
          article: target.article,
          current: {
            barcode: target.barcode || "",
            gtin: target.gtin || "",
            tnved: target.tnved || "",
          },
          ozon: ozonProduct
            ? {
                productId: ozonProduct.productId,
                sku: ozonProduct.sku,
                barcode: ozonProduct.barcode || "",
                barcodes: ozonProduct.barcodes || [],
                gtin: ozonProduct.gtin || "",
                tnved: ozonProduct.tnved || "",
              }
            : null,
          status: duplicateErpArticle
            ? "duplicate_erp_article"
            : !ozonProduct
            ? "not_found_on_ozon"
            : !hasAnyOzonCode
            ? "ozon_codes_empty"
            : "matched",
        });
      }
    }

    for (const [article, ozonProduct] of ozonByArticle.entries()) {
      if (usedOzonArticles.has(article)) continue;
      preview.push({
        entity: null,
        id: null,
        name: "",
        article: ozonProduct.offerId,
        current: { barcode: "", gtin: "", tnved: "" },
        ozon: {
          productId: ozonProduct.productId,
          sku: ozonProduct.sku,
          barcode: ozonProduct.barcode || "",
          barcodes: ozonProduct.barcodes || [],
          gtin: ozonProduct.gtin || "",
          tnved: ozonProduct.tnved || "",
        },
        status: "not_found_in_erp",
      });
    }

    preview.sort((a, b) =>
      String(a.article || "").localeCompare(String(b.article || ""), "ru")
    );

    let updated = 0;
    let skipped = 0;

    if (action === "apply") {
      for (const row of preview) {
        if (row.status !== "matched" || !row.id || !row.entity || !row.ozon) {
          skipped += 1;
          continue;
        }

        const patch = {
          barcode: normalizeText(row.ozon.barcode) || null,
          gtin: normalizeText(row.ozon.gtin) || null,
          tnved: normalizeText(row.ozon.tnved) || null,
        };

        const table = row.entity === "product" ? "products" : "items";
        const query = admin.from(table).update(patch).eq("id", row.id);
        const { error } = row.entity === "resale_product"
          ? await query.eq("item_type", "resale_product")
          : await query;

        if (error) throw error;
        updated += 1;
      }
    }

    const summary = preview.reduce(
      (sum, row) => {
        sum.total += 1;
        sum[row.status] = (sum[row.status] || 0) + 1;
        return sum;
      },
      { total: 0 } as Record<string, number>,
    );

    return json({
      action,
      fetchedFromOzon: catalogRows.length,
      updated,
      skipped,
      summary,
      preview,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось синхронизировать коды Ozon";
    console.error("ozon-product-codes failed", message);
    return json({ error: message }, 500);
  }
});
