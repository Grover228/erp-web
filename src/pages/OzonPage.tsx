import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Tab = "overview" | "analytics" | "stocks" | "matching" | "fbo" | "transfer";

type Operation = {
  id: string;
  operation_date: string;
  operation_type_name: string | null;
  posting_number: string | null;
  amount: number | string;
  accruals_for_sale: number | string;
  sale_commission: number | string;
  services_total: number | string;
  cost_of_goods: number | string;
  profit: number | string;
  matched: boolean;
};

type SyncRun = {
  id: string;
  started_at: string;
  status: string;
  operations_loaded: number;
  error_message: string | null;
};

type ArticleAnalytics = {
  article: string;
  name: string;
  soldQty: number;
  returnQty: number;
  gross: number;
  ozon: number;
  net: number;
  cost: number;
  profit: number;
  margin: number;
  missingCostQty: number;
};

type PeriodSummary = {
  gross: number;
  ozon: number;
  net: number;
  cost: number;
  profit: number;
  unmatched: number;
};

type OzonStock = {
  productId: string;
  article: string;
  name: string;
  fboPresent: number;
  fboReserved: number;
  fboSku: string;
  fboWarehouseIds: string[];
  fbsPresent: number;
  fbsReserved: number;
  fbsSku: string;
  totalPresent: number;
  totalReserved: number;
};

type OzonStockSummary = {
  products: number;
  fboPresent: number;
  fboReserved: number;
  fbsPresent: number;
  fbsReserved: number;
};

type SavedFboDraft = {
  draft_id: number;
  macrolocal_cluster_id: number;
  sku: number;
  offer_id: string | null;
  quantity: number;
  status: string;
  ozon_response: any;
  diagnostics: string[] | null;
  supply_type?: string | null;
  drop_off_warehouse_id?: number | null;
  drop_off_warehouse_name?: string | null;
  drop_off_warehouse_type?: string | null;
  seller_warehouse_id?: number | null;
  created_at: string;
  updated_at: string;
};

type FboCluster = {
  id: number;
  name: string;
  country: string;
  fulfillments: Array<{ warehouse_id: number; name: string }>;
};

type ComparisonRow = {
  article: string;
  name: string;
  erp: number;
  fbo: number;
  fbs: number;
  ozonTotal: number;
  difference: number;
};

const inputStyle = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px" };
const panelStyle = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18 };

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(value: number | string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function number(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value || 0);
}

function SummaryCard({ title, value, color = "#0f172a", hint }: { title: string; value: string; color?: string; hint?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18, minWidth: 0 }}>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 24, fontWeight: 850, overflowWrap: "anywhere" }}>{value}</div>
      {hint && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
      <div style={{ fontWeight: 800, color: "#334155", marginBottom: 6 }}>{title}</div>
      <div>{text}</div>
    </div>
  );
}

export default function OzonPage() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateInput(today));

  const [operations, setOperations] = useState<Operation[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [articleAnalytics, setArticleAnalytics] = useState<ArticleAnalytics[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<PeriodSummary | null>(null);
  const [operationCount, setOperationCount] = useState(0);

  const [stocks, setStocks] = useState<OzonStock[]>([]);
  const [stockSummary, setStockSummary] = useState<OzonStockSummary | null>(null);
  const [stocksFetchedAt, setStocksFetchedAt] = useState("");
  const [erpStockByArticle, setErpStockByArticle] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [erpLoading, setErpLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reportCreating, setReportCreating] = useState(false);
  const [error, setError] = useState("");
  const [stocksError, setStocksError] = useState("");
  const [message, setMessage] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [transferDraft, setTransferDraft] = useState<Record<string, number>>({});
  const [fboClusters, setFboClusters] = useState<FboCluster[]>([]);
  const [fboClusterId, setFboClusterId] = useState("");
  const [fboLoading, setFboLoading] = useState(false);
  const [fboDraftId, setFboDraftId] = useState<number | null>(null);
  const [fboResolvedSku, setFboResolvedSku] = useState<number | null>(null);
  const [fboDraftInfo, setFboDraftInfo] = useState<any>(null);
  const [fboDiagnostics, setFboDiagnostics] = useState<string[]>([]);
  const [fboError, setFboError] = useState("");
  const [fboMessage, setFboMessage] = useState("");
  const [fboWarehouseId, setFboWarehouseId] = useState("");
  const [fboTimeslotFrom, setFboTimeslotFrom] = useState(dateInput(new Date()));
  const [fboTimeslotTo, setFboTimeslotTo] = useState(dateInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));
  const [fboTimeslots, setFboTimeslots] = useState<any[]>([]);
  const [fboTimeslotIndex, setFboTimeslotIndex] = useState("");
  const [fboSupplyResult, setFboSupplyResult] = useState<any>(null);
  const [fboSellerWarehouses, setFboSellerWarehouses] = useState<any[]>([]);
  const [fboSellerWarehouseId, setFboSellerWarehouseId] = useState("");
  const [fboGeneralWarehouses, setFboGeneralWarehouses] = useState<any[]>([]);
  const [fboDropoffSearch, setFboDropoffSearch] = useState("");
  const [fboDropoffPoints, setFboDropoffPoints] = useState<any[]>([]);
  const [fboDropoffWarehouseId, setFboDropoffWarehouseId] = useState("");

  const localSummary = useMemo(() => operations.reduce(
    (sum, row) => ({
      gross: sum.gross + Number(row.accruals_for_sale || 0),
      ozon: sum.ozon + Number(row.sale_commission || 0) + Number(row.services_total || 0),
      net: sum.net + Number(row.amount || 0),
      cost: sum.cost + Number(row.cost_of_goods || 0),
      profit: sum.profit + Number(row.profit || 0),
      unmatched: sum.unmatched + (row.matched ? 0 : 1),
    }),
    { gross: 0, ozon: 0, net: 0, cost: 0, profit: 0, unmatched: 0 }
  ), [operations]);

  const summary = analyticsSummary || localSummary;

  const visibleStocks = useMemo(
    () => stocks.filter((row) => row.totalPresent > 0 || row.totalReserved > 0),
    [stocks]
  );

  const comparisons = useMemo<ComparisonRow[]>(() => {
    const byArticle = new Map<string, ComparisonRow>();

    for (const stock of visibleStocks) {
      const key = stock.article.toLowerCase();
      byArticle.set(key, {
        article: stock.article,
        name: stock.name,
        erp: Number(erpStockByArticle[key] || 0),
        fbo: stock.fboPresent,
        fbs: stock.fbsPresent,
        ozonTotal: stock.totalPresent,
        difference: stock.totalPresent - Number(erpStockByArticle[key] || 0),
      });
    }

    for (const [key, erp] of Object.entries(erpStockByArticle)) {
      if (!byArticle.has(key) && Math.abs(erp) > 0.000001) {
        byArticle.set(key, {
          article: key,
          name: key,
          erp,
          fbo: 0,
          fbs: 0,
          ozonTotal: 0,
          difference: -erp,
        });
      }
    }

    return Array.from(byArticle.values()).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [visibleStocks, erpStockByArticle]);

  const comparisonSummary = useMemo(() => {
    let same = 0;
    let different = 0;
    let erpExtra = 0;
    let ozonExtra = 0;
    for (const row of comparisons) {
      if (Math.abs(row.difference) < 0.000001) same += 1;
      else {
        different += 1;
        if (row.difference > 0) ozonExtra += row.difference;
        else erpExtra += Math.abs(row.difference);
      }
    }
    return { same, different, erpExtra, ozonExtra };
  }, [comparisons]);

  const transferTotal = useMemo(
    () => Object.values(transferDraft).reduce((sum, qty) => sum + Math.max(0, Number(qty || 0)), 0),
    [transferDraft]
  );

  useEffect(() => { void loadData(); }, [from, to]);
  useEffect(() => { void Promise.all([loadStocks(), loadErpStock()]); }, []);
  useEffect(() => {
    if (activeTab === "fbo") {
      if (fboClusters.length === 0) void loadFboClusters();
      if (fboSellerWarehouses.length === 0) void loadFboSellerWarehouses();
      void loadSavedFboDraft();
    }
  }, [activeTab]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [operationResult, runResult, analyticsResult] = await Promise.all([
        supabase.from("ozon_operations")
          .select("id,operation_date,operation_type_name,posting_number,amount,accruals_for_sale,sale_commission,services_total,cost_of_goods,profit,matched")
          .gte("operation_date", `${from}T00:00:00.000Z`)
          .lte("operation_date", `${to}T23:59:59.999Z`)
          .order("operation_date", { ascending: false }).limit(1000),
        supabase.from("ozon_sync_runs")
          .select("id,started_at,status,operations_loaded,error_message")
          .order("started_at", { ascending: false }).limit(10),
        supabase.functions.invoke("ozon-analytics", { body: { from, to } }),
      ]);
      if (operationResult.error) throw operationResult.error;
      if (runResult.error) throw runResult.error;
      if (analyticsResult.error) throw analyticsResult.error;
      if (analyticsResult.data?.error) throw new Error(analyticsResult.data.error);
      setOperations((operationResult.data as Operation[]) || []);
      setRuns((runResult.data as SyncRun[]) || []);
      setArticleAnalytics((analyticsResult.data?.articles as ArticleAnalytics[]) || []);
      setAnalyticsSummary((analyticsResult.data?.summary as PeriodSummary) || null);
      setOperationCount(Number(analyticsResult.data?.operationCount || 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные Ozon");
    } finally {
      setLoading(false);
    }
  }

  async function loadStocks() {
    try {
      setStocksLoading(true);
      setStocksError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-stocks", { body: {} });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setStocks((data?.stocks as OzonStock[]) || []);
      setStockSummary((data?.summary as OzonStockSummary) || null);
      setStocksFetchedAt(String(data?.fetchedAt || ""));
    } catch (cause) {
      setStocksError(cause instanceof Error ? cause.message : "Не удалось загрузить остатки Ozon");
    } finally {
      setStocksLoading(false);
    }
  }

  async function loadErpStock() {
    try {
      setErpLoading(true);
      const { data: stockRows, error: stockError } = await supabase
        .from("stock_available")
        .select("item_type,product_id,item_id,quantity_on_hand")
        .in("item_type", ["product", "resale_product"]);
      if (stockError) throw stockError;

      const productIds = [...new Set((stockRows || []).map((row) => row.product_id).filter(Boolean))] as string[];
      const itemIds = [...new Set((stockRows || []).map((row) => row.item_id).filter(Boolean))] as string[];

      const [productsResult, itemsResult] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id,article").in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
        itemIds.length
          ? supabase.from("items").select("id,article").in("id", itemIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (itemsResult.error) throw itemsResult.error;

      const articleByProduct = new Map((productsResult.data || []).map((row) => [row.id, String(row.article || "").toLowerCase()]));
      const articleByItem = new Map((itemsResult.data || []).map((row) => [row.id, String(row.article || "").toLowerCase()]));

      const next: Record<string, number> = {};
      for (const row of stockRows || []) {
        const article = row.item_id
          ? articleByItem.get(row.item_id)
          : row.product_id
            ? articleByProduct.get(row.product_id)
            : undefined;
        if (!article) continue;
        next[article] = (next[article] || 0) + Number(row.quantity_on_hand || 0);
      }
      setErpStockByArticle(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить остатки ERP");
    } finally {
      setErpLoading(false);
    }
  }

  async function createErpReport() {
    try {
      setReportCreating(true);
      setError("");
      setMessage("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-erp-report", { body: { from, to } });
      if (data?.error) throw new Error(data.error);
      if (invokeError) {
        const context = (invokeError as any)?.context;
        if (context && typeof context.json === "function") {
          try {
            const payload = await context.json();
            if (payload?.error) throw new Error(payload.error);
          } catch (contextError) {
            if (contextError instanceof Error && contextError.message !== "Unexpected end of JSON input") throw contextError;
          }
        }
        throw invokeError;
      }
      setMessage(
        `Отчёт ERP сформирован: ${data.orderNumber} → ${data.shipmentNumber}, ${number(Number(data.totalQuantity || 0))} шт., ${money(Number(data.totalAmount || 0))}.`
      );
      await Promise.all([loadData(), loadErpStock()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сформировать отчёт для ERP");
    } finally {
      setReportCreating(false);
    }
  }

  async function loadSavedFboDraft() {
    try {
      const { data, error: loadError } = await supabase
        .from("ozon_fbo_drafts")
        .select("draft_id,macrolocal_cluster_id,sku,offer_id,quantity,status,ozon_response,diagnostics,supply_type,drop_off_warehouse_id,drop_off_warehouse_name,drop_off_warehouse_type,seller_warehouse_id,created_at,updated_at")
        .eq("supply_type", "CROSSDOCK")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (loadError) throw loadError;
      const row = data as SavedFboDraft | null;
      if (!row) {
        setFboDraftId(null);
        setFboResolvedSku(null);
        setFboDraftInfo(null);
        setFboDiagnostics([]);
        return;
      }

      setFboDraftId(Number(row.draft_id));
      setFboResolvedSku(Number(row.sku || 0) || null);
      setFboClusterId(String(row.macrolocal_cluster_id));
      if (row.seller_warehouse_id) setFboSellerWarehouseId(String(row.seller_warehouse_id));
      if (row.drop_off_warehouse_id) {
        setFboDropoffWarehouseId(String(row.drop_off_warehouse_id));
        if (row.drop_off_warehouse_name) {
          setFboDropoffPoints([{
            warehouse_id: row.drop_off_warehouse_id,
            name: row.drop_off_warehouse_name,
            warehouse_type: row.drop_off_warehouse_type || "",
            address: "",
          }]);
        }
      }
      setFboDraftInfo(
        row.ozon_response && typeof row.ozon_response === "object"
          ? { ...row.ozon_response, status: row.status || row.ozon_response?.status }
          : { status: row.status || "CREATED" },
      );
      setFboDiagnostics(Array.isArray(row.diagnostics) ? row.diagnostics : []);
      setFboMessage(
        `Восстановлен сохранённый черновик №${row.draft_id}: ${row.offer_id || "SKU " + row.sku}, ${number(Number(row.quantity || 0))} шт.`,
      );
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось восстановить сохранённый черновик");
    }
  }

  async function loadFboSellerWarehouses() {
    try {
      setFboError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "seller_warehouses" },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const rows = Array.isArray(data?.data?.warehouses) ? data.data.warehouses : [];
      const active = rows.filter((row: any) => row?.is_active !== false);
      const general = Array.isArray(data?.data?.generalWarehouses) ? data.data.generalWarehouses : [];
      setFboSellerWarehouses(active);
      setFboGeneralWarehouses(general);

      if (!active.length) {
        const generalText = general.length
          ? ` При этом общий API Ozon видит складов: ${general.length}.`
          : "";
        setFboMessage(`Ozon вернул 0 активных FBO-складов продавца.${generalText}`);
      } else if (!fboSellerWarehouseId && active.length === 1) {
        setFboSellerWarehouseId(String(active[0].seller_warehouse_id || ""));
      }
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось загрузить склады продавца Ozon");
    }
  }

  async function searchFboDropoffPoints() {
    try {
      setFboLoading(true);
      setFboError("");
      setFboDropoffPoints([]);
      setFboDropoffWarehouseId("");

      const search = fboDropoffSearch.trim();
      if (search.length < 4) throw new Error("Введите минимум 4 символа для поиска точки отгрузки.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "dropoff_search", search },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const rows = Array.isArray(data?.data?.search) ? data.data.search : [];
      setFboDropoffPoints(rows);
      if (!rows.length) setFboMessage("По этому запросу Ozon не нашёл точек отгрузки.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось найти точки отгрузки Ozon");
    } finally {
      setFboLoading(false);
    }
  }

  async function loadFboClusters() {
    try {
      setFboLoading(true);
      setFboError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "clusters" },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const payload = data?.data || {};
      const rows = Array.isArray(payload?.clusters)
        ? payload.clusters
        : Array.isArray(payload?.result)
          ? payload.result
          : [];

      const next: FboCluster[] = rows.map((row: any) => {
        const legacyData = row?.data || {};
        const logisticWarehouses = Array.isArray(row?.logistic_clusters)
          ? row.logistic_clusters.flatMap((cluster: any) =>
              Array.isArray(cluster?.warehouses) ? cluster.warehouses : [],
            )
          : [];
        const legacyWarehouses = Array.isArray(legacyData?.fulfillments)
          ? legacyData.fulfillments
          : [];
        const warehouses = logisticWarehouses.length
          ? logisticWarehouses
          : legacyWarehouses;

        const clusterId = Number(
          row?.macrolocal_cluster_id ||
          legacyData?.macrolocal_cluster_id ||
          row?.id ||
          0,
        );

        const clusterName = String(
          row?.name ||
          legacyData?.macrolocal_cluster?.name ||
          `Кластер ${clusterId}`,
        );

        const country = String(
          legacyData?.macrolocal_cluster?.country?.name ||
          (row?.type === "CLUSTER_TYPE_OZON" ? "Россия" : ""),
        );

        return {
          id: clusterId,
          name: clusterName,
          country,
          fulfillments: warehouses.map((warehouse: any) => ({
            warehouse_id: Number(warehouse?.warehouse_id || 0),
            name: String(warehouse?.name || warehouse?.warehouse_id || ""),
          })),
        };
      }).filter((row: FboCluster) => row.id > 0);

      if (!next.length) {
        throw new Error("Ozon не вернул список FBO-кластеров.");
      }

      setFboClusters(next);
      if (!fboClusterId && next.length) setFboClusterId(String(next[0].id));
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось загрузить кластеры Ozon");
    } finally {
      setFboLoading(false);
    }
  }

  async function createTestFboDraft() {
    try {
      setFboLoading(true);
      setFboError("");
      setFboMessage("");
      setFboDraftId(null);
      setFboResolvedSku(null);
      setFboDraftInfo(null);
      setFboDiagnostics([]);

      const clusterId = Number(fboClusterId);
      if (!clusterId) throw new Error("Выберите кластер размещения Ozon.");

      const sellerWarehouseId = Number(fboSellerWarehouseId || 0);

      const dropoff = fboDropoffPoints.find(
        (row: any) => String(row?.warehouse_id || "") === fboDropoffWarehouseId,
      );
      if (!dropoff) throw new Error("Найдите и выберите точку отгрузки Ozon.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "create_crossdock_draft",
          macrolocalClusterId: clusterId,
          quantity: 42,
          offerId: "bini-black-56",
          sellerWarehouseId,
          dropOffWarehouseId: Number(dropoff.warehouse_id),
          dropOffWarehouseName: String(dropoff.name || ""),
          dropOffWarehouseType: String(dropoff.warehouse_type || ""),
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const draftId = Number(data?.data?.draft_id || 0);
      const resolvedSku = Number(data?.resolvedSku || 0);
      const errors = data?.data?.errors || [];
      if (errors.length) {
        throw new Error(
          errors.map((item: any) => item?.message || item?.error_message || (item?.error_reasons || []).join(", ")).filter(Boolean).join(" | ")
          || "Ozon вернул ошибку при создании черновика."
        );
      }
      if (!draftId) throw new Error("Ozon не вернул draft_id.");

      setFboDraftId(draftId);
      setFboResolvedSku(resolvedSku || null);
      setFboDraftInfo({ status: "CREATED" });
      setFboDiagnostics([]);
      setFboMessage(
        `Черновик CROSSDOCK №${draftId} создан: bini-black-56, 42 шт. Подождите 5–10 секунд и нажмите «Обновить статус».`,
      );
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось создать тестовый черновик FBO");
    } finally {
      setFboLoading(false);
    }
  }

  async function refreshFboDraftInfo() {
    if (!fboDraftId) return;
    try {
      setFboLoading(true);
      setFboError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "draft_info", draftId: fboDraftId },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;
      setFboDraftInfo(data?.data || null);
      setFboDiagnostics(Array.isArray(data?.diagnostics) ? data.diagnostics : []);
    } catch (cause) {
      const currentStatus = String(fboDraftInfo?.status || "");
      if (currentStatus === "IN_PROGRESS") {
        setFboError("");
        setFboMessage(
          `Черновик №${fboDraftId} создан. Ozon ещё рассчитывает варианты поставки — повторите обновление статуса через несколько секунд.`,
        );
      } else {
        setFboError(cause instanceof Error ? cause.message : "Не удалось обновить черновик");
      }
    } finally {
      setFboLoading(false);
    }
  }

  async function loadFboTimeslots() {
    if (!fboDraftId) return;

    try {
      setFboLoading(true);
      setFboError("");
      setFboSupplyResult(null);
      setFboTimeslots([]);
      setFboTimeslotIndex("");

      const cluster = Array.isArray(fboDraftInfo?.clusters)
        ? fboDraftInfo.clusters.find((row: any) =>
            Number(row?.macrolocal_cluster_id || 0) === Number(fboClusterId)
          ) || fboDraftInfo.clusters[0]
        : null;

      const clusterId = Number(cluster?.macrolocal_cluster_id || fboClusterId || 0);
      const warehouseId = Number(fboWarehouseId || 0);

      if (!clusterId) throw new Error("Не удалось определить кластер черновика.");
      if (!warehouseId) throw new Error("Выберите доступный склад Ozon.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "timeslots",
          draftId: fboDraftId,
          macrolocalClusterId: clusterId,
          storageWarehouseId: warehouseId,
          dateFrom: fboTimeslotFrom,
          dateTo: fboTimeslotTo,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const payload = data?.data || {};
      const dropoffTimeslots =
        payload?.result?.drop_off_warehouse_timeslots ||
        payload?.drop_off_warehouse_timeslots ||
        null;
      const days = Array.isArray(dropoffTimeslots?.days) ? dropoffTimeslots.days : [];
      const slots = days.flatMap((day: any) =>
        Array.isArray(day?.timeslots)
          ? day.timeslots.map((slot: any) => ({
              ...slot,
              date_in_timezone: day?.date_in_timezone || "",
            }))
          : [],
      );

      setFboTimeslots(slots);

      if (!slots.length) {
        setFboMessage("Ozon не вернул свободных таймслотов для выбранного склада и периода.");
      } else {
        setFboMessage(`Получено таймслотов: ${slots.length}. Выберите время для поставки.`);
      }
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось получить таймслоты Ozon");
    } finally {
      setFboLoading(false);
    }
  }

  async function createRealFboSupply() {
    if (!fboDraftId) return;

    try {
      setFboLoading(true);
      setFboError("");
      setFboSupplyResult(null);

      const slotIndex = Number(fboTimeslotIndex);
      const timeslot = Number.isInteger(slotIndex) ? fboTimeslots[slotIndex] : null;
      if (!timeslot) throw new Error("Выберите таймслот.");
      if (!fboWarehouseId) throw new Error("Выберите склад Ozon.");

      const cluster = Array.isArray(fboDraftInfo?.clusters)
        ? fboDraftInfo.clusters.find((row: any) =>
            Number(row?.macrolocal_cluster_id || 0) === Number(fboClusterId)
          ) || fboDraftInfo.clusters[0]
        : null;

      const clusterId = Number(cluster?.macrolocal_cluster_id || fboClusterId || 0);
      if (!clusterId) throw new Error("Не удалось определить кластер черновика.");

      const confirmed = window.confirm(
        `Создать реальную CROSSDOCK-заявку Ozon по черновику №${fboDraftId}?\n\nТовар: bini-black-56\nКоличество: 42 шт.\nПосле подтверждения заявка будет создана в Ozon.`,
      );
      if (!confirmed) return;

      const normalizedTimeslot = {
        from_in_timezone:
          timeslot?.from_in_timezone ||
          timeslot?.from ||
          timeslot?.start_at ||
          timeslot?.date_from,
        to_in_timezone:
          timeslot?.to_in_timezone ||
          timeslot?.to ||
          timeslot?.end_at ||
          timeslot?.date_to,
      };

      if (!normalizedTimeslot.from_in_timezone || !normalizedTimeslot.to_in_timezone) {
        throw new Error("Ozon вернул таймслот в неизвестном формате.");
      }

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "create_supply",
          draftId: fboDraftId,
          macrolocalClusterId: clusterId,
          storageWarehouseId: Number(fboWarehouseId),
          timeslot: normalizedTimeslot,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      setFboSupplyResult(data?.data || data);
      setFboMessage("Команда на создание реальной поставки отправлена в Ozon. Проверяем результат.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось создать поставку Ozon");
    } finally {
      setFboLoading(false);
    }
  }

  async function syncOzon() {
    try {
      setSyncing(true);
      setError("");
      setMessage("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-sync", { body: { from, to } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setMessage(`Готово: получено ${data?.loaded || 0}, обновлено ${data?.updated || 0} операций.`);
      await Promise.all([loadData(), loadStocks(), loadErpStock()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка синхронизации с Ozon");
    } finally {
      setSyncing(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "overview", label: "Обзор", icon: "⌂" },
    { id: "analytics", label: "Аналитика", icon: "▥" },
    { id: "stocks", label: "Остатки", icon: "◫" },
    { id: "matching", label: "Сопоставление", icon: "↔" },
    { id: "fbo", label: "Поставки FBO", icon: "▣" },
    { id: "transfer", label: "Перенос (тест)", icon: "⇄" },
  ];

  function PeriodControls() {
    return (
      <section style={{ ...panelStyle, padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
              С даты
              <input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
              По дату
              <input type="date" value={to} min={from} max={dateInput(today)} onChange={(event) => setTo(event.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button disabled={syncing || !from || !to} onClick={syncOzon}
              style={{ border: 0, background: syncing ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 11, padding: "11px 17px", fontWeight: 800, cursor: syncing ? "wait" : "pointer" }}>
              {syncing ? "Загружаю…" : "Загрузить данные Ozon"}
            </button>
            <button disabled={reportCreating || syncing || loading || !from || !to} onClick={createErpReport}
              style={{ border: 0, background: reportCreating ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 11, padding: "11px 17px", fontWeight: 850, cursor: reportCreating ? "wait" : "pointer" }}>
              {reportCreating ? "Формирую…" : "Сформировать отчёт для ERP"}
            </button>
          </div>
        </div>
        {error && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{error}</div>}
        <div style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
          Сначала загрузите данные Ozon за выбранный период и проверьте цифры. «Сформировать отчёт для ERP» создаёт заказ, отгрузку и списание по текущей складской схеме. Пересекающийся период повторно провести нельзя.
        </div>
        {message && <div style={{ marginTop: 14, color: "#166534", background: "#f0fdf4", padding: 12, borderRadius: 10 }}>{message}</div>}
      </section>
    );
  }

  function Overview() {
    const topAnalytics = articleAnalytics.slice(0, 5);
    const topStocks = visibleStocks.slice(0, 5);
    return (
      <>
        <PeriodControls />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <SummaryCard title="Продажи" value={money(summary.gross)} />
          <SummaryCard title="Комиссии Ozon" value={money(summary.ozon)} color={summary.ozon < 0 ? "#b91c1c" : "#0f172a"} />
          <SummaryCard title="К выплате" value={money(summary.net)} color="#005bff" />
          <SummaryCard title="Себестоимость" value={money(summary.cost)} />
          <SummaryCard title="Прибыль" value={money(summary.profit)} color={summary.profit >= 0 ? "#15803d" : "#b91c1c"} />
          <SummaryCard title="Неподключенные товары" value={String(summary.unmatched)} color={summary.unmatched ? "#c2410c" : "#15803d"} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 14 }}>
          <section style={{ ...panelStyle, overflow: "hidden" }}>
            <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div><div style={{ fontWeight: 850, fontSize: 18 }}>Аналитика товаров</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Бестселлеры, комиссии и прибыль.</div></div>
              <button onClick={() => setActiveTab("analytics")} style={{ border: 0, background: "#eff6ff", color: "#005bff", borderRadius: 10, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Открыть аналитику →</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "Продажи", "Выручка", "Прибыль"].map((title) => <th key={title} style={{ padding: 11, fontSize: 12 }}>{title}</th>)}</tr></thead>
                <tbody>{topAnalytics.map((row) => <tr key={row.article} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ padding: 11, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 11 }}>{row.name}</td><td style={{ padding: 11 }}>{row.soldQty}</td><td style={{ padding: 11 }}>{money(row.gross)}</td><td style={{ padding: 11, fontWeight: 800, color: row.profit >= 0 ? "#15803d" : "#b91c1c" }}>{money(row.profit)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          <section style={{ ...panelStyle, overflow: "hidden" }}>
            <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div><div style={{ fontWeight: 850, fontSize: 18 }}>Остатки на Ozon</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Актуальные остатки FBO и FBS.</div></div>
              <button onClick={() => setActiveTab("stocks")} style={{ border: 0, background: "#eff6ff", color: "#005bff", borderRadius: 10, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Открыть остатки →</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "FBO", "Резерв", "FBS", "Всего"].map((title) => <th key={title} style={{ padding: 11, fontSize: 12 }}>{title}</th>)}</tr></thead>
                <tbody>{topStocks.map((row) => <tr key={row.productId || row.article} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ padding: 11, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 11 }}>{row.name}</td><td style={{ padding: 11, fontWeight: 800, color: "#005bff" }}>{row.fboPresent}</td><td style={{ padding: 11 }}>{row.fboReserved}</td><td style={{ padding: 11 }}>{row.fbsPresent}</td><td style={{ padding: 11, fontWeight: 800 }}>{row.totalPresent}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>

        <section style={{ border: "1px solid #ddd6fe", background: "linear-gradient(90deg,#f5f3ff,#faf5ff)", borderRadius: 16, padding: 16, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div><div style={{ color: "#5b21b6", fontWeight: 850 }}>⇄ Тестовый экран переноса товаров</div><div style={{ color: "#7c3aed", fontSize: 13, marginTop: 4 }}>Без записи в склад и без изменений в Ozon.</div></div>
          <button onClick={() => setActiveTab("transfer")} style={{ border: 0, background: "#6d28d9", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Открыть «Перенос (тест)» →</button>
        </section>
      </>
    );
  }

  function Analytics() {
    return (
      <>
        <PeriodControls />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <SummaryCard title="Продажи" value={money(summary.gross)} />
          <SummaryCard title="Ozon" value={money(summary.ozon)} />
          <SummaryCard title="Себестоимость" value={money(summary.cost)} />
          <SummaryCard title="Прибыль" value={money(summary.profit)} color={summary.profit >= 0 ? "#15803d" : "#b91c1c"} />
        </div>
        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div><div style={{ fontWeight: 850, fontSize: 18 }}>Аналитика по артикулам</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Расчёт по всем {operationCount} операциям выбранного периода.</div></div>
            <div style={{ color: "#64748b", fontSize: 13 }}>Сортировка: по прибыли</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
              <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "Продажи", "Возвраты", "Выручка", "Ozon", "Себестоимость", "Прибыль", "Маржа", "Без себест."].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
              <tbody>
                {!loading && articleAnalytics.map((row) => <tr key={row.article} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ padding: 12, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 12 }}>{row.name}</td><td style={{ padding: 12 }}>{row.soldQty}</td><td style={{ padding: 12 }}>{row.returnQty || "—"}</td><td style={{ padding: 12 }}>{money(row.gross)}</td><td style={{ padding: 12 }}>{money(row.ozon)}</td><td style={{ padding: 12 }}>{money(row.cost)}</td><td style={{ padding: 12, fontWeight: 800, color: row.profit >= 0 ? "#15803d" : "#b91c1c" }}>{money(row.profit)}</td><td style={{ padding: 12, color: row.margin >= 0 ? "#15803d" : "#b91c1c" }}>{row.margin.toFixed(1)}%</td><td style={{ padding: 12, color: row.missingCostQty ? "#c2410c" : "#15803d" }}>{row.missingCostQty || 0}</td>
                </tr>)}
                {!loading && articleAnalytics.length === 0 && <tr><td colSpan={10}><EmptyState title="Нет аналитики" text="За выбранный период данных пока нет." /></td></tr>}
                {loading && <tr><td colSpan={10}><EmptyState title="Считаю аналитику" text="Загрузка данных Ozon…" /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18 }}><div style={{ fontWeight: 850, fontSize: 18 }}>Операции</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Показаны последние {Math.min(operationCount, 1000)} из {operationCount} операций.</div></div>
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Дата", "Операция", "Отправление", "Продажа", "Ozon", "Начислено", "Себестоимость", "Прибыль", "Связь"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
            <tbody>{operations.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #eef2f7" }}><td style={{ padding: 12 }}>{new Date(row.operation_date).toLocaleDateString("ru-RU")}</td><td style={{ padding: 12 }}>{row.operation_type_name || "Операция Ozon"}</td><td style={{ padding: 12 }}>{row.posting_number || "—"}</td><td style={{ padding: 12 }}>{money(row.accruals_for_sale)}</td><td style={{ padding: 12 }}>{money(Number(row.sale_commission) + Number(row.services_total))}</td><td style={{ padding: 12 }}>{money(row.amount)}</td><td style={{ padding: 12 }}>{money(row.cost_of_goods)}</td><td style={{ padding: 12, color: Number(row.profit) >= 0 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>{money(row.profit)}</td><td style={{ padding: 12 }}>{row.matched ? "✓" : "Проверить"}</td></tr>)}</tbody>
          </table></div>
        </section>

        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 12 }}>Последние синхронизации</div>
          {runs.length === 0 ? <div style={{ color: "#64748b" }}>Синхронизаций ещё не было.</div> : runs.map((run) => <div key={run.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, padding: "10px 0", borderTop: "1px solid #eef2f7" }}><span>{new Date(run.started_at).toLocaleString("ru-RU")}</span><span>{run.status === "completed" ? "Готово" : run.status === "failed" ? "Ошибка" : "Выполняется"} · {run.operations_loaded || 0} операций</span>{run.error_message && <span style={{ color: "#b91c1c", width: "100%" }}>{run.error_message}</span>}</div>)}
        </section>
      </>
    );
  }

  function Stocks() {
    return (
      <>
        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div><div style={{ fontWeight: 850, fontSize: 20 }}>Остатки Ozon</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Только чтение из Ozon API. ERP не изменяется.{stocksFetchedAt ? ` Обновлено: ${new Date(stocksFetchedAt).toLocaleString("ru-RU")}.` : ""}</div></div>
            <button disabled={stocksLoading} onClick={() => void loadStocks()} style={{ border: 0, background: stocksLoading ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 11, padding: "10px 14px", fontWeight: 800, cursor: stocksLoading ? "wait" : "pointer" }}>{stocksLoading ? "Обновляю…" : "Обновить остатки"}</button>
          </div>
          {stocksError && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{stocksError}</div>}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
          <SummaryCard title="FBO в наличии" value={String(stockSummary?.fboPresent || 0)} color="#005bff" />
          <SummaryCard title="FBO в резерве" value={String(stockSummary?.fboReserved || 0)} />
          <SummaryCard title="FBS в наличии" value={String(stockSummary?.fbsPresent || 0)} />
          <SummaryCard title="FBS в резерве" value={String(stockSummary?.fbsReserved || 0)} />
          <SummaryCard title="Позиций с остатком" value={String(stockSummary?.products || 0)} />
        </div>

        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, fontWeight: 850, fontSize: 18 }}>Остатки товаров на Ozon</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "FBO в наличии", "FBO резерв", "FBS в наличии", "FBS резерв", "Всего"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
              <tbody>
                {!stocksLoading && visibleStocks.map((row) => <tr key={row.productId || row.article} style={{ borderTop: "1px solid #eef2f7" }}><td style={{ padding: 12, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 12 }}>{row.name}</td><td style={{ padding: 12, color: "#005bff", fontWeight: 800 }}>{row.fboPresent}</td><td style={{ padding: 12 }}>{row.fboReserved}</td><td style={{ padding: 12 }}>{row.fbsPresent}</td><td style={{ padding: 12 }}>{row.fbsReserved}</td><td style={{ padding: 12, fontWeight: 800 }}>{row.totalPresent}</td></tr>)}
                {!stocksLoading && visibleStocks.length === 0 && <tr><td colSpan={7}><EmptyState title="Нет остатков" text="Ozon не вернул товаров с остатком." /></td></tr>}
                {stocksLoading && <tr><td colSpan={7}><EmptyState title="Обновляю остатки" text="Загружаю актуальные данные Ozon…" /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function Matching() {
    return (
      <>
        <section style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 16, padding: 16 }}>
          <div style={{ fontWeight: 850, color: "#92400e" }}>⚠ Режим сравнения только для проверки данных</div>
          <div style={{ color: "#a16207", fontSize: 13, marginTop: 5 }}>Никаких автоматических корректировок ERP или Ozon на этой вкладке не выполняется.</div>
        </section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <SummaryCard title="Совпало" value={String(comparisonSummary.same)} color="#15803d" />
          <SummaryCard title="Расхождения" value={String(comparisonSummary.different)} color="#b91c1c" />
          <SummaryCard title="Излишек в ERP" value={number(comparisonSummary.erpExtra)} />
          <SummaryCard title="Излишек на Ozon" value={number(comparisonSummary.ozonExtra)} color="#6d28d9" />
        </div>
        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div><div style={{ fontWeight: 850, fontSize: 18 }}>Сопоставление ERP ↔ Ozon</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Это диагностическая таблица. Весеннюю партию пока не переносим.</div></div>
            <button disabled={erpLoading || stocksLoading} onClick={() => void Promise.all([loadStocks(), loadErpStock()])} style={{ border: 0, background: "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Обновить сравнение</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 850 }}>
              <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "ERP сейчас", "Ozon FBO", "Ozon FBS", "Разница", "Статус"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
              <tbody>{comparisons.map((row) => {
                const same = Math.abs(row.difference) < 0.000001;
                const status = same ? "Совпадает" : row.difference > 0 ? "Больше на Ozon" : "Больше в ERP";
                return <tr key={row.article} style={{ borderTop: "1px solid #eef2f7" }}><td style={{ padding: 12, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 12 }}>{row.name}</td><td style={{ padding: 12 }}>{number(row.erp)}</td><td style={{ padding: 12 }}>{row.fbo}</td><td style={{ padding: 12 }}>{row.fbs}</td><td style={{ padding: 12, fontWeight: 800, color: same ? "#64748b" : "#b91c1c" }}>{row.difference > 0 ? "+" : ""}{number(row.difference)}</td><td style={{ padding: 12 }}><span style={{ display: "inline-block", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800, background: same ? "#dcfce7" : row.difference > 0 ? "#f3e8ff" : "#dbeafe", color: same ? "#166534" : row.difference > 0 ? "#6b21a8" : "#1d4ed8" }}>{status}</span></td></tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      </>
    );
  }

  function FboSupply() {
    const selected = fboClusters.find((row) => String(row.id) === fboClusterId);
    const draftStatus = String(fboDraftInfo?.status || "");
    const noPlacementWarehouses =
      draftStatus === "FAILED" &&
      Array.isArray(fboDraftInfo?.clusters) &&
      fboDraftInfo.clusters.length === 0 &&
      Array.isArray(fboDraftInfo?.errors) &&
      fboDraftInfo.errors.length === 0;
    const draftClusters = Array.isArray(fboDraftInfo?.clusters) ? fboDraftInfo.clusters : [];
    const availableWarehouses = draftClusters.flatMap((cluster: any) =>
      Array.isArray(cluster?.warehouses)
        ? cluster.warehouses.filter((warehouse: any) =>
            String(warehouse?.availability_status?.state || "") === "FULL_AVAILABLE"
          )
        : []
    );

    return (
      <>
        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Тестовая поставка FBO · CROSSDOCK</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
                Товар: <b>bini-black-56</b> · FBO SKU <b>{fboResolvedSku || "определится при создании"}</b> · количество <b>42 шт.</b>
              </div>
            </div>
            <span style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 850 }}>
              Сначала только черновик
            </span>
          </div>

          {fboError && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{fboError}</div>}
          {fboMessage && <div style={{ marginTop: 14, color: "#166534", background: "#f0fdf4", padding: 12, borderRadius: 10 }}>{fboMessage}</div>}

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto", gap: 12, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
              Кластер размещения Ozon
              <select value={fboClusterId} onChange={(event) => setFboClusterId(event.target.value)} style={inputStyle} disabled={fboLoading}>
                {fboClusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.name}{cluster.country ? ` · ${cluster.country}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadFboClusters()}
              disabled={fboLoading}
              style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 800, cursor: "pointer" }}
            >
              Обновить кластеры
            </button>
          </div>

          {selected && selected.fulfillments.length > 0 && (
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
              Склады размещения в кластере: {selected.fulfillments.slice(0, 8).map((row) => row.name).join(", ")}
              {selected.fulfillments.length > 8 ? "…" : ""}
            </div>
          )}

          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                Склад продавца Ozon
                <select
                value={fboSellerWarehouseId}
                onChange={(event) => setFboSellerWarehouseId(event.target.value)}
                style={inputStyle}
                disabled={fboLoading}
              >
                <option value="">Выберите склад продавца</option>
                {fboSellerWarehouses.map((warehouse: any) => (
                  <option
                    key={warehouse.seller_warehouse_id}
                    value={String(warehouse.seller_warehouse_id)}
                  >
                    {warehouse?.seller_warehouse_name || warehouse?.address?.address || warehouse?.name || `Склад продавца ${warehouse.seller_warehouse_id}`}
                  </option>
                ))}
                </select>
              </label>
              {fboSellerWarehouses.length === 0 && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 10, padding: 10, fontSize: 12 }}>
                  FBO seller warehouse у этого кабинета не зарегистрирован. Для схемы DROPOFF попробуем создать только черновик с seller_warehouse_id = 0. Это безопасный тест: реальная поставка не создаётся.
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => void loadFboSellerWarehouses()}
                  disabled={fboLoading}
                  style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "8px 11px", fontWeight: 800, cursor: "pointer" }}
                >
                  Обновить склады продавца
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) auto", gap: 10, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                Найти точку отгрузки CROSSDOCK
                <input
                  value={fboDropoffSearch}
                  onChange={(event) => setFboDropoffSearch(event.target.value)}
                  placeholder="Например: Казань, Воронеж, название ПВЗ"
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                onClick={() => void searchFboDropoffPoints()}
                disabled={fboLoading || fboDropoffSearch.trim().length < 4}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 800, cursor: "pointer" }}
              >
                Найти точки
              </button>
            </div>

            <div style={{ color: "#64748b", fontSize: 12 }}>
              Ozon не отдаёт весь список точек сразу: введите минимум 4 символа города или названия точки и нажмите «Найти точки».
            </div>

            {fboDropoffPoints.length > 0 && (
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                Точка отгрузки
                <select
                  value={fboDropoffWarehouseId}
                  onChange={(event) => setFboDropoffWarehouseId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выберите точку</option>
                  {fboDropoffPoints.map((point: any) => (
                    <option key={point.warehouse_id} value={String(point.warehouse_id)}>
                      {point.name}{point.address ? ` · ${point.address}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => void createTestFboDraft()}
              disabled={fboLoading || !fboClusterId || !fboDropoffWarehouseId}
              style={{ border: 0, background: fboLoading ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 11, padding: "11px 17px", fontWeight: 900, cursor: fboLoading ? "wait" : "pointer" }}
            >
              {fboLoading ? "Работаю…" : "Создать CROSSDOCK-черновик на 42 шт."}
            </button>
          </div>
        </section>

        {fboDraftId && (
          <section style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Черновик Ozon №{fboDraftId}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  Статус расчёта: <b>{draftStatus || "ожидаем ответ"}</b>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshFboDraftInfo()}
                disabled={fboLoading}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}
              >
                Обновить статус
              </button>
            </div>

            {noPlacementWarehouses && (
              <div style={{ marginTop: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 900, color: "#991b1b", marginBottom: 6 }}>Ozon не предложил склад размещения</div>
                <div style={{ color: "#b91c1c", fontSize: 13 }}>
                  Для этого товара и выбранного кластера Ozon вернул FAILED без ошибок и без доступных складов. Выберите другой FBO-кластер и создайте новый черновик.
                </div>
              </div>
            )}

            {fboDiagnostics.length > 0 && (
              <div style={{ marginTop: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 900, color: "#991b1b", marginBottom: 6 }}>Причина ответа Ozon</div>
                {fboDiagnostics.map((reason, index) => (
                  <div key={index} style={{ color: "#b91c1c", fontSize: 13, marginTop: index ? 5 : 0 }}>
                    {reason}
                  </div>
                ))}
              </div>
            )}

            {draftClusters.length > 0 && (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {draftClusters.map((cluster: any, index: number) => (
                  <div key={cluster.macrolocal_cluster_id || index} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                    <div style={{ fontWeight: 850 }}>{cluster.cluster_name || `Кластер ${cluster.macrolocal_cluster_id}`}</div>
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                      Доступных складов: {Array.isArray(cluster.warehouses) ? cluster.warehouses.length : 0}
                    </div>
                    {Array.isArray(cluster.warehouses) && cluster.warehouses.slice(0, 10).map((warehouse: any) => (
                      <div key={warehouse.storage_warehouse?.warehouse_id || warehouse.bundle_id} style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid #f1f5f9", fontSize: 13 }}>
                        <b>{warehouse.storage_warehouse?.name || warehouse.storage_warehouse?.warehouse_id || "Склад"}</b>
                        {warehouse.storage_warehouse?.address ? <span style={{ color: "#64748b" }}> · {warehouse.storage_warehouse.address}</span> : null}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {draftStatus === "SUCCESS" && availableWarehouses.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16, display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>2. Выберите склад размещения и время сдачи</div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    Склад размещения выбирается из расчёта Ozon, а таймслот относится к выбранной точке отгрузки CROSSDOCK.
                  </div>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                  Доступный склад
                  <select
                    value={fboWarehouseId}
                    onChange={(event) => {
                      setFboWarehouseId(event.target.value);
                      setFboTimeslots([]);
                      setFboTimeslotIndex("");
                    }}
                    style={inputStyle}
                  >
                    <option value="">Выберите склад</option>
                    {availableWarehouses.map((warehouse: any) => (
                      <option
                        key={warehouse.storage_warehouse?.warehouse_id || warehouse.bundle_id}
                        value={String(warehouse.storage_warehouse?.warehouse_id || "")}
                      >
                        {warehouse.storage_warehouse?.name || warehouse.storage_warehouse?.warehouse_id}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                    Таймслоты с даты
                    <input
                      type="date"
                      value={fboTimeslotFrom}
                      onChange={(event) => setFboTimeslotFrom(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                    По дату
                    <input
                      type="date"
                      value={fboTimeslotTo}
                      min={fboTimeslotFrom}
                      onChange={(event) => setFboTimeslotTo(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => void loadFboTimeslots()}
                    disabled={fboLoading || !fboWarehouseId}
                    style={{ border: 0, background: fboLoading || !fboWarehouseId ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 850, cursor: fboLoading ? "wait" : "pointer" }}
                  >
                    Получить свободные таймслоты
                  </button>
                </div>

                {fboTimeslots.length > 0 && (
                  <>
                    <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>
                      Время поставки
                      <select value={fboTimeslotIndex} onChange={(event) => setFboTimeslotIndex(event.target.value)} style={inputStyle}>
                        <option value="">Выберите таймслот</option>
                        {fboTimeslots.map((slot: any, index: number) => {
                          const fromValue = slot?.from_in_timezone || slot?.from || slot?.start_at || slot?.date_from || "";
                          const toValue = slot?.to_in_timezone || slot?.to || slot?.end_at || slot?.date_to || "";
                          const fromText = fromValue ? new Date(fromValue).toLocaleString("ru-RU") : "Начало";
                          const toText = toValue ? new Date(toValue).toLocaleString("ru-RU") : "конец";
                          return <option key={index} value={String(index)}>{fromText} — {toText}</option>;
                        })}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => void createRealFboSupply()}
                      disabled={fboLoading || fboTimeslotIndex === ""}
                      style={{ border: 0, background: fboLoading || fboTimeslotIndex === "" ? "#94a3b8" : "#16a34a", color: "#fff", borderRadius: 11, padding: "12px 17px", fontWeight: 900, cursor: fboLoading ? "wait" : "pointer" }}
                    >
                      Создать реальную поставку в Ozon
                    </button>
                  </>
                )}

                {fboSupplyResult && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 12, padding: 12, fontSize: 13 }}>
                    Ozon принял команду создания поставки. Ответ: <b>{JSON.stringify(fboSupplyResult)}</b>
                  </div>
                )}
              </div>
            )}

            {draftStatus !== "SUCCESS" && (
              <div style={{ marginTop: 14, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 12, fontSize: 13 }}>
                Сначала нужно получить статус SUCCESS и доступный склад.
              </div>
            )}
          </section>
        )}
      </>
    );
  }

  function TransferTest() {
    const rows = comparisons.filter((row) => row.erp > 0 || row.ozonTotal > 0).slice(0, 80);
    return (
      <>
        <section style={{ border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 16, padding: 17, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div><div style={{ fontWeight: 900, color: "#9a3412" }}>⚠ Тестовый режим — никаких складских движений не создаётся</div><div style={{ color: "#c2410c", fontSize: 13, marginTop: 4 }}>Экран нужен только для подготовки будущей схемы переноса Основной склад → Ozon FBO.</div></div>
          <span style={{ border: "1px solid #fb923c", color: "#c2410c", borderRadius: 999, padding: "7px 11px", fontWeight: 850, fontSize: 12 }}>ТЕСТОВЫЙ РЕЖИМ</span>
        </section>

        <section style={{ ...panelStyle, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            {[
              ["1", "Загрузить Ozon", "Фактические FBO/FBS"],
              ["2", "Сравнить с ERP", "Без изменений"],
              ["3", "Проверить весеннюю партию", "Отделить новый товар"],
              ["4", "Подготовить перенос", "Черновые количества"],
              ["5", "Подтвердить позже", "После проверки"],
            ].map(([n, title, sub]) => <div key={n} style={{ display: "flex", gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: "50%", background: n === "5" ? "#e2e8f0" : "#005bff", color: n === "5" ? "#64748b" : "#fff", display: "grid", placeItems: "center", fontWeight: 900, flex: "0 0 auto" }}>{n}</div><div><div style={{ fontWeight: 800 }}>{title}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{sub}</div></div></div>)}
          </div>
        </section>

        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 850, fontSize: 18 }}>Подготовить перенос (тест)</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Укажите предполагаемое количество. Значения остаются только на экране и никуда не записываются.</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Артикул", "Товар", "ERP сейчас", "Ozon сейчас", "К переносу (тест)", "Комментарий"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
              <tbody>{rows.map((row) => {
                const draft = transferDraft[row.article] ?? 0;
                return <tr key={row.article} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={{ padding: 12, fontWeight: 800 }}>{row.article}</td><td style={{ padding: 12 }}>{row.name}</td><td style={{ padding: 12, color: "#005bff", fontWeight: 800 }}>{number(row.erp)}</td><td style={{ padding: 12 }}>{row.ozonTotal}</td>
                  <td style={{ padding: 12 }}><input type="number" min={0} value={draft} onChange={(event) => setTransferDraft((prev) => ({ ...prev, [row.article]: Math.max(0, Number(event.target.value || 0)) }))} style={{ ...inputStyle, width: 110 }} /></td>
                  <td style={{ padding: 12, color: "#64748b" }}>{row.erp > 0 && row.ozonTotal > 0 ? "Проверить вручную" : row.erp > 0 ? "Есть только в ERP" : "Есть только на Ozon"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div style={{ padding: 18, borderTop: "1px solid #eef2f7", display: "flex", justifyContent: "flex-end", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>Итого к переносу (тест): <b style={{ color: "#005bff", fontSize: 22 }}>{number(transferTotal)}</b> шт.</div>
            <button disabled style={{ border: 0, background: "#cbd5e1", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>Сохранение будет позже</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 18, background: "#f6f9ff", minHeight: "100%" }}>
      <header style={{ ...panelStyle, padding: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 30, fontWeight: 950, color: "#0f172a" }}>Ozon</div>
              <span style={{ background: "#ecfdf5", color: "#059669", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800 }}>● Подключен</span>
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>Управление продажами, остатками и товарами на маркетплейсе Ozon.</div>
          </div>
          <button onClick={() => setInstructionOpen((value) => !value)} style={{ border: "1px solid #cbd5e1", background: "#fff", color: "#334155", borderRadius: 10, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>{instructionOpen ? "Скрыть подключение" : "Подключение API"}</button>
        </div>

        <div style={{ display: "flex", gap: 0, marginTop: 18, overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14, background: "#f8fafc" }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: "1 0 150px", border: 0, borderBottom: active ? "3px solid #005bff" : "3px solid transparent", background: active ? "#fff" : "transparent", color: active ? "#005bff" : "#475569", padding: "14px 12px", fontWeight: 850, cursor: "pointer" }}><span style={{ marginRight: 7 }}>{tab.icon}</span>{tab.label}{tab.id === "transfer" && <span style={{ marginLeft: 7, background: "#ede9fe", color: "#6d28d9", borderRadius: 999, padding: "3px 7px", fontSize: 10 }}>Тест</span>}</button>;
          })}
        </div>
      </header>

      {instructionOpen && (
        <section style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 18, padding: 18, color: "#172554" }}>
          <b>Seller API подключён.</b> Client ID и API Key хранятся в секретах Supabase. Повторная синхронизация финансовых операций безопасна и обновляет существующие записи по идентификаторам Ozon.
        </section>
      )}

      {activeTab === "overview" && <Overview />}
      {activeTab === "analytics" && <Analytics />}
      {activeTab === "stocks" && <Stocks />}
      {activeTab === "matching" && <Matching />}
      {activeTab === "fbo" && <FboSupply />}
      {activeTab === "transfer" && <TransferTest />}
    </div>
  );
}
