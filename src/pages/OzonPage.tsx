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

type FeeBreakdown = {
  typeId: number;
  label: string;
  amount: number;
  count: number;
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
  order_id?: number | null;
  supply_id?: number | null;
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

const DEFAULT_FBO_DROPOFF = {
  warehouse_id: 1020005011665480,
  name: "САРАНСК_ДО_ВОСТОЧНОЕ_ШОССЕ",
  warehouse_type: "WAREHOUSE_TYPE_SORTING_CENTER",
  address: "Россия, Республика Мордовия, Саранск, Северо-Восточное шоссе, 15Б/5",
};

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
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown[]>([]);
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
  const [fboManualStorage, setFboManualStorage] = useState(false);
  const [fboStep, setFboStep] = useState(1);
  const [fboTimeslotFrom, setFboTimeslotFrom] = useState(dateInput(new Date()));
  const [fboTimeslotTo, setFboTimeslotTo] = useState(dateInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)));
  const [fboTimeslots, setFboTimeslots] = useState<any[]>([]);
  const [fboTimeslotIndex, setFboTimeslotIndex] = useState("");
  const [fboSupplyResult, setFboSupplyResult] = useState<any>(null);
  const [fboSellerWarehouses, setFboSellerWarehouses] = useState<any[]>([]);
  const [fboSellerWarehouseId, setFboSellerWarehouseId] = useState("");
  const [fboGeneralWarehouses, setFboGeneralWarehouses] = useState<any[]>([]);
  const [fboDropoffSearch, setFboDropoffSearch] = useState("");
  const [fboDropoffPoints, setFboDropoffPoints] = useState<any[]>([DEFAULT_FBO_DROPOFF]);
  const [fboDropoffWarehouseId, setFboDropoffWarehouseId] = useState(String(DEFAULT_FBO_DROPOFF.warehouse_id));
  const [fboOrderId, setFboOrderId] = useState<number | null>(null);
  const [fboSupplyId, setFboSupplyId] = useState<number | null>(null);
  const [fboSupplyItem, setFboSupplyItem] = useState<any>(null);
  const [fboBoxes, setFboBoxes] = useState<number[]>([42]);
  const [fboCargoResult, setFboCargoResult] = useState<any>(null);
  const [fboCargoOperationId, setFboCargoOperationId] = useState("");
  const [fboCargoes, setFboCargoes] = useState<any[]>([]);
  const [fboLabelOperationId, setFboLabelOperationId] = useState("");
  const [fboLabelUrl, setFboLabelUrl] = useState("");

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
      setFboError("");
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
      setFeeBreakdown((analyticsResult.data?.feeBreakdown as FeeBreakdown[]) || []);
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
      const selectFields = "draft_id,macrolocal_cluster_id,sku,offer_id,quantity,status,ozon_response,diagnostics,supply_type,drop_off_warehouse_id,drop_off_warehouse_name,drop_off_warehouse_type,seller_warehouse_id,order_id,supply_id,created_at,updated_at";

      const createdOrderResult = await supabase
        .from("ozon_fbo_drafts")
        .select(selectFields)
        .eq("supply_type", "CROSSDOCK")
        .not("order_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (createdOrderResult.error) throw createdOrderResult.error;

      let row = createdOrderResult.data as SavedFboDraft | null;

      if (!row) {
        const latestDraftResult = await supabase
          .from("ozon_fbo_drafts")
          .select(selectFields)
          .eq("supply_type", "CROSSDOCK")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestDraftResult.error) throw latestDraftResult.error;
        row = latestDraftResult.data as SavedFboDraft | null;
      }
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
            address:
              Number(row.drop_off_warehouse_id) === DEFAULT_FBO_DROPOFF.warehouse_id
                ? DEFAULT_FBO_DROPOFF.address
                : "",
          }]);
        }
      } else {
        setFboDropoffWarehouseId(String(DEFAULT_FBO_DROPOFF.warehouse_id));
        setFboDropoffPoints([DEFAULT_FBO_DROPOFF]);
      }
      setFboDraftInfo(
        row.ozon_response && typeof row.ozon_response === "object"
          ? { ...row.ozon_response, status: row.status || row.ozon_response?.status }
          : { status: row.status || "CREATED" },
      );
      setFboDiagnostics(Array.isArray(row.diagnostics) ? row.diagnostics : []);
      setFboError("");
      setFboMessage(
        `Восстановлен сохранённый черновик №${row.draft_id}: ${row.offer_id || "SKU " + row.sku}, ${number(Number(row.quantity || 0))} шт.`,
      );
      if (row.order_id) {
        setFboOrderId(Number(row.order_id));
        if (row.supply_id) setFboSupplyId(Number(row.supply_id));
        setFboStep(6);
      } else if (String(row.status || "") === "SUCCESS") {
        setFboStep(4);
      } else {
        setFboStep(3);
      }
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
      setFboDropoffPoints(rows.length ? rows : [DEFAULT_FBO_DROPOFF]);
      if (rows.length) {
        setFboDropoffWarehouseId(String(rows[0]?.warehouse_id || ""));
      } else {
        setFboDropoffWarehouseId(String(DEFAULT_FBO_DROPOFF.warehouse_id));
        setFboMessage("По этому запросу Ozon не нашёл точек отгрузки. Оставлена точка по умолчанию в Саранске.");
      }
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
        `Черновик CROSSDOCK №${draftId} создан: bini-black-56, 42 шт. Подождите несколько секунд и обновите статус.`,
      );
      setFboStep(3);
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
      const nextDraftInfo = data?.data || null;
      setFboDraftInfo(nextDraftInfo);
      setFboDiagnostics(Array.isArray(data?.diagnostics) ? data.diagnostics : []);
      if (String(nextDraftInfo?.status || "") === "SUCCESS") setFboStep(4);
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
      const warehouseId = fboManualStorage ? Number(fboWarehouseId || 0) : 0;

      if (!clusterId) throw new Error("Не удалось определить кластер черновика.");
      if (fboManualStorage && !warehouseId) throw new Error("Выберите доступный склад Ozon.");

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

      const cluster = Array.isArray(fboDraftInfo?.clusters)
        ? fboDraftInfo.clusters.find((row: any) =>
            Number(row?.macrolocal_cluster_id || 0) === Number(fboClusterId)
          ) || fboDraftInfo.clusters[0]
        : null;

      const clusterId = Number(cluster?.macrolocal_cluster_id || fboClusterId || 0);
      const storageWarehouseId = fboManualStorage ? Number(fboWarehouseId || 0) : 0;

      if (!clusterId) throw new Error("Не удалось определить кластер черновика.");
      if (fboManualStorage && !storageWarehouseId) throw new Error("Выберите склад Ozon.");

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
          storageWarehouseId,
          timeslot: normalizedTimeslot,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      setFboSupplyResult(data?.data || data);
      setFboMessage("Команда на создание реальной поставки отправлена в Ozon. Проверяем результат.");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await refreshCreatedFboSupply();
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось создать поставку Ozon");
    } finally {
      setFboLoading(false);
    }
  }


  async function loadCreatedFboOrder(orderId: number) {
    try {
      setFboLoading(true);
      setFboError("");

      const visibleOrderNumber = String(orderId || "");
      if (!visibleOrderNumber) throw new Error("Не указан номер созданной заявки Ozon.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "resolve_order_number",
          orderNumber: visibleOrderNumber,
          draftId: fboDraftId,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) {
        const context = (invokeError as any)?.context;
        if (context && typeof context.json === "function") {
          try {
            const payload = await context.json();
            if (payload?.error) throw new Error(payload.error);
          } catch (contextError) {
            if (contextError instanceof Error && contextError.message !== invokeError.message) {
              throw contextError;
            }
          }
        }
        throw invokeError;
      }

      const internalOrderId = Number(data?.data?.order_id || 0);
      const supplyId = Number(data?.data?.supply_id || 0);
      const items = Array.isArray(data?.data?.items) ? data.data.items : [];
      const item =
        items.find((row: any) => String(row?.contractor_item_code || row?.offer_id || "").toLowerCase() === "bini-black-56") ||
        items[0] ||
        null;

      if (!internalOrderId) throw new Error("Ozon не вернул внутренний order_id заявки.");
      if (!supplyId) throw new Error("Ozon не вернул supply_id для созданной поставки.");
      if (!item) throw new Error("Ozon не вернул товарный состав поставки.");

      setFboOrderId(internalOrderId);
      setFboSupplyId(supplyId);
      setFboSupplyItem(item);
      setFboBoxes([42]);
      setFboStep(6);
      setFboMessage(`Заявка №${visibleOrderNumber} загружена. Теперь распределите 42 шт. по коробкам.`);
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось загрузить данные созданной поставки");
    } finally {
      setFboLoading(false);
    }
  }

  async function refreshCreatedFboSupply() {
    if (!fboDraftId) return;
    try {
      setFboLoading(true);
      setFboError("");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "create_supply_status", draftId: fboDraftId },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const status = String(data?.data?.status || "");
      const orderId = Number(data?.data?.order_id || 0);

      if (status === "SUCCESS" && orderId > 0) {
        await loadCreatedFboOrder(orderId);
        return;
      }

      if (status === "FAILED") {
        const reasons = Array.isArray(data?.data?.error_reasons) ? data.data.error_reasons.join(", ") : "";
        throw new Error(reasons || "Ozon не создал заявку.");
      }

      setFboMessage("Ozon ещё создаёт заявку. Нажмите «Проверить созданную заявку» через несколько секунд.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось проверить созданную заявку");
    } finally {
      setFboLoading(false);
    }
  }

  async function submitFboCargoes() {
    if (!fboSupplyId || !fboSupplyItem) return;

    try {
      setFboLoading(true);
      setFboError("");
      setFboCargoResult(null);

      const total = fboBoxes.reduce((sum, quantity) => sum + Number(quantity || 0), 0);
      if (total !== 42) throw new Error(`По коробкам распределено ${total} шт., а в поставке должно быть ровно 42 шт.`);
      if (fboBoxes.some((quantity) => Number(quantity || 0) <= 0)) {
        throw new Error("В каждой коробке должно быть больше 0 штук.");
      }
      if (fboBoxes.length > 30) throw new Error("Ozon разрешает не больше 30 коробок в одном запросе.");

      const item = {
        barcode: String(fboSupplyItem?.barcode || ""),
        offer_id: String(fboSupplyItem?.contractor_item_code || fboSupplyItem?.offer_id || "bini-black-56"),
        quant: Number(fboSupplyItem?.quant || 1),
      };

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "cargoes_create",
          supplyId: fboSupplyId,
          boxes: fboBoxes.map((quantity) => ({ quantity })),
          item,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const result = data?.data || data;
      setFboCargoResult(result);
      const operationId = String(result?.operation_id || "");
      setFboCargoOperationId(operationId);
      setFboMessage(
        operationId
          ? `Коробки отправлены в Ozon. Операция ${operationId} формируется.`
          : `Грузоместа отправлены в Ozon: ${fboBoxes.length} коробок, 42 шт.`,
      );
      setFboStep(7);
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось передать коробки в Ozon");
    } finally {
      setFboLoading(false);
    }
  }


  async function checkFboCargoes() {
    if (!fboCargoOperationId) return;
    try {
      setFboLoading(true);
      setFboError("");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "cargoes_create_info", operationId: fboCargoOperationId },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const payload = data?.data || {};
      const status = String(payload?.status || "");
      const cargoes = Array.isArray(payload?.result?.cargoes) ? payload.result.cargoes : [];

      if (status === "SUCCESS") {
        setFboCargoes(cargoes);
        setFboMessage(`Коробки зарегистрированы в Ozon: ${cargoes.length}.`);
        setFboStep(8);
      } else if (status === "FAILED") {
        const reasons = payload?.errors?.error_reasons;
        throw new Error(Array.isArray(reasons) && reasons.length ? reasons.join(", ") : "Ozon не зарегистрировал грузоместа.");
      } else {
        setFboMessage("Ozon ещё формирует грузоместа. Проверьте статус через несколько секунд.");
      }
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось проверить грузоместа");
    } finally {
      setFboLoading(false);
    }
  }

  async function createFboCargoLabels() {
    if (!fboSupplyId || !fboCargoes.length) return;
    try {
      setFboLoading(true);
      setFboError("");
      setFboLabelUrl("");

      const cargoIds = fboCargoes
        .map((row: any) => Number(row?.value?.cargo_id || row?.cargo_id || 0))
        .filter((value: number) => value > 0);

      if (!cargoIds.length) throw new Error("Не удалось получить cargo_id коробок.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "cargo_labels_create",
          supplyId: fboSupplyId,
          cargoIds,
        },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const operationId = String(data?.data?.operation_id || "");
      if (!operationId) throw new Error("Ozon не вернул operation_id для этикеток.");

      setFboLabelOperationId(operationId);
      setFboMessage("Ozon формирует PDF с этикетками.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось запустить генерацию этикеток");
    } finally {
      setFboLoading(false);
    }
  }

  async function checkFboCargoLabels() {
    if (!fboLabelOperationId) return;
    try {
      setFboLoading(true);
      setFboError("");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "cargo_labels_get", operationId: fboLabelOperationId },
      });
      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const payload = data?.data || {};
      const status = String(payload?.status || "");
      const fileUrl = String(payload?.result?.file_url || "");

      if (status === "SUCCESS" && fileUrl) {
        setFboLabelUrl(fileUrl);
        setFboMessage("PDF с этикетками готов.");
        setFboStep(9);
      } else if (status === "FAILED") {
        const reasons = payload?.errors?.error_reasons;
        throw new Error(Array.isArray(reasons) && reasons.length ? reasons.join(", ") : "Ozon не сформировал этикетки.");
      } else {
        setFboMessage("PDF ещё формируется. Проверьте ещё раз через несколько секунд.");
      }
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось получить PDF с этикетками");
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
          <div style={{ padding: 18 }}>
            <div style={{ fontWeight: 850, fontSize: 18 }}>Расходы Ozon по видам услуг</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              Кросс-докинг, приёмка FBO, логистика, возвраты, упаковка и другие начисления за выбранный период.
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                  {["Услуга", "Type ID", "Начислений", "Сумма"].map((title) => (
                    <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feeBreakdown.map((row) => (
                  <tr key={row.typeId} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: 12, fontWeight: row.typeId === 12 || row.typeId === 77 ? 850 : 600 }}>
                      {row.label}
                    </td>
                    <td style={{ padding: 12 }}>{row.typeId}</td>
                    <td style={{ padding: 12 }}>{row.count}</td>
                    <td style={{ padding: 12, fontWeight: 800, color: row.amount < 0 ? "#b91c1c" : "#15803d" }}>
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
                {!loading && feeBreakdown.length === 0 && (
                  <tr><td colSpan={4}><EmptyState title="Нет расходов" text="За выбранный период начисления Ozon не найдены." /></td></tr>
                )}
                {loading && (
                  <tr><td colSpan={4}><EmptyState title="Считаю расходы" text="Разбираю финансовые начисления Ozon…" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

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
    const selectedCluster = fboClusters.find((row) => String(row.id) === fboClusterId);
    const selectedDropoff = fboDropoffPoints.find(
      (row: any) => String(row?.warehouse_id || "") === fboDropoffWarehouseId,
    );
    const draftStatus = String(fboDraftInfo?.status || "");
    const draftClusters = Array.isArray(fboDraftInfo?.clusters) ? fboDraftInfo.clusters : [];
    const availableWarehouses = draftClusters.flatMap((cluster: any) =>
      Array.isArray(cluster?.warehouses)
        ? cluster.warehouses.filter((warehouse: any) =>
            String(warehouse?.availability_status?.state || "") === "FULL_AVAILABLE"
          )
        : []
    );
    const selectedSlot =
      fboTimeslotIndex !== "" && fboTimeslots[Number(fboTimeslotIndex)]
        ? fboTimeslots[Number(fboTimeslotIndex)]
        : null;

    const stepNames = ["Кластер", "Точка сдачи", "Черновик", "Таймслот", "Подтверждение", "Коробки", "Грузоместа", "Наклейки", "Готово"];

    return (
      <section style={{ ...panelStyle, padding: 18, maxWidth: 980, width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Новая поставка FBO · CROSSDOCK</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
              <b>bini-black-56</b> · 42 шт. · конкретный склад внутри кластера определяет Ozon
            </div>
          </div>
          <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 850 }}>
            Шаг {fboStep} из 9
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(9,minmax(82px,1fr))", gap: 6, marginTop: 16, overflowX: "auto" }}>
          {stepNames.map((name, index) => {
            const step = index + 1;
            const active = step === fboStep;
            const done = step < fboStep;
            return (
              <div key={name} style={{ minWidth: 90, textAlign: "center" }}>
                <div style={{
                  height: 5,
                  borderRadius: 999,
                  background: active || done ? "#005bff" : "#e2e8f0",
                  marginBottom: 7,
                }} />
                <div style={{ fontSize: 11, fontWeight: active ? 900 : 700, color: active ? "#005bff" : "#64748b" }}>
                  {name}
                </div>
              </div>
            );
          })}
        </div>

        {fboError && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{fboError}</div>}
        {fboMessage && <div style={{ marginTop: 14, color: "#166534", background: "#f0fdf4", padding: 12, borderRadius: 10 }}>{fboMessage}</div>}

        <div style={{ marginTop: 18, minHeight: 330 }}>
          {fboStep === 1 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Куда размещаем товар?</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Выберите только кластер. Конкретный склад внутри него Ozon назначит сам.</div>
              </div>
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ fontWeight: 800 }}>Кластер размещения</span>
                <select value={fboClusterId} onChange={(event) => setFboClusterId(event.target.value)} style={inputStyle}>
                  {fboClusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>{cluster.name}{cluster.country ? ` · ${cluster.country}` : ""}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void loadFboClusters()} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 800 }}>
                  Обновить кластеры
                </button>
                <button type="button" onClick={() => setFboStep(2)} disabled={!fboClusterId} style={{ border: 0, background: fboClusterId ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}>
                  Далее →
                </button>
              </div>
            </div>
          )}

          {fboStep === 2 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Точка сдачи CROSSDOCK</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>По умолчанию выбрана ваша точка в Саранске. При необходимости её можно заменить.</div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Выбранная точка</div>
                <div style={{ fontWeight: 900, marginTop: 4 }}>{selectedDropoff?.name || DEFAULT_FBO_DROPOFF.name}</div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{selectedDropoff?.address || DEFAULT_FBO_DROPOFF.address}</div>
              </div>

              <details>
                <summary style={{ cursor: "pointer", fontWeight: 800, color: "#475569" }}>Выбрать другую точку</summary>
                <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 10 }}>
                    <input value={fboDropoffSearch} onChange={(event) => setFboDropoffSearch(event.target.value)} placeholder="Город или название точки" style={inputStyle} />
                    <button type="button" onClick={() => void searchFboDropoffPoints()} disabled={fboDropoffSearch.trim().length < 4 || fboLoading} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 800 }}>
                      Найти
                    </button>
                  </div>
                  {fboDropoffPoints.length > 0 && (
                    <select value={fboDropoffWarehouseId} onChange={(event) => setFboDropoffWarehouseId(event.target.value)} style={inputStyle}>
                      {fboDropoffPoints.map((point: any) => (
                        <option key={point.warehouse_id} value={String(point.warehouse_id)}>
                          {point.name}{point.address ? ` · ${point.address}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </details>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button type="button" onClick={() => setFboStep(1)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                <button type="button" onClick={() => void createTestFboDraft()} disabled={!fboDropoffWarehouseId || fboLoading} style={{ border: 0, background: !fboDropoffWarehouseId || fboLoading ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}>
                  {fboLoading ? "Создаю…" : "Создать черновик →"}
                </button>
              </div>
            </div>
          )}

          {fboStep === 3 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Проверка черновика</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Ozon рассчитывает возможность поставки.</div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Черновик</div>
                <div style={{ fontWeight: 900, fontSize: 20, marginTop: 3 }}>№{fboDraftId || "—"}</div>
                <div style={{ marginTop: 8 }}>Статус: <b>{draftStatus || "CREATED"}</b></div>
              </div>
              {fboDiagnostics.length > 0 && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: 12 }}>
                  {fboDiagnostics.join(" · ")}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button type="button" onClick={() => setFboStep(2)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                <button type="button" onClick={() => void refreshFboDraftInfo()} disabled={fboLoading} style={{ border: 0, background: "#005bff", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}>
                  {fboLoading ? "Проверяю…" : draftStatus === "SUCCESS" ? "Продолжить →" : "Обновить статус"}
                </button>
              </div>
            </div>
          )}

          {fboStep === 4 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Выберите время сдачи</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  Кластер: <b>{selectedCluster?.name || "—"}</b> · точка: <b>{selectedDropoff?.name || DEFAULT_FBO_DROPOFF.name}</b>
                </div>
              </div>

              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>
                Конкретный склад размещения внутри кластера определит Ozon автоматически.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>С даты<input type="date" value={fboTimeslotFrom} onChange={(event) => setFboTimeslotFrom(event.target.value)} style={inputStyle} /></label>
                <label style={{ display: "grid", gap: 6 }}>По дату<input type="date" value={fboTimeslotTo} min={fboTimeslotFrom} onChange={(event) => setFboTimeslotTo(event.target.value)} style={inputStyle} /></label>
              </div>

              <button type="button" onClick={() => void loadFboTimeslots()} disabled={fboLoading} style={{ justifySelf: "start", border: 0, background: fboLoading ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 850 }}>
                {fboLoading ? "Загружаю…" : "Получить свободные таймслоты"}
              </button>

              {fboTimeslots.length > 0 && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontWeight: 800 }}>Время сдачи</span>
                  <select value={fboTimeslotIndex} onChange={(event) => setFboTimeslotIndex(event.target.value)} style={inputStyle}>
                    <option value="">Выберите время</option>
                    {fboTimeslots.map((slot: any, index: number) => {
                      const fromValue = slot?.from_in_timezone || slot?.from || slot?.start_at || slot?.date_from || "";
                      const toValue = slot?.to_in_timezone || slot?.to || slot?.end_at || slot?.date_to || "";
                      return <option key={index} value={String(index)}>{fromValue ? new Date(fromValue).toLocaleString("ru-RU") : "Начало"} — {toValue ? new Date(toValue).toLocaleString("ru-RU") : "конец"}</option>;
                    })}
                  </select>
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button type="button" onClick={() => setFboStep(3)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                <button type="button" onClick={() => setFboStep(5)} disabled={!selectedSlot} style={{ border: 0, background: selectedSlot ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}>Далее →</button>
              </div>
            </div>
          )}

          {fboStep === 5 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Подтверждение поставки</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Проверьте всё перед созданием заявки в Ozon.</div>
              </div>

              <div style={{ display: "grid", gap: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                <div><span style={{ color: "#64748b" }}>Товар:</span> <b>bini-black-56</b></div>
                <div><span style={{ color: "#64748b" }}>Количество:</span> <b>42 шт.</b></div>
                <div><span style={{ color: "#64748b" }}>Кластер:</span> <b>{selectedCluster?.name || "—"}</b></div>
                <div><span style={{ color: "#64748b" }}>Точка сдачи:</span> <b>{selectedDropoff?.name || DEFAULT_FBO_DROPOFF.name}</b></div>
                <div><span style={{ color: "#64748b" }}>Склад размещения:</span> <b>определяет Ozon</b></div>
                <div><span style={{ color: "#64748b" }}>Время:</span> <b>{selectedSlot ? JSON.stringify(selectedSlot) : "—"}</b></div>
              </div>

              {fboSupplyResult && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 12, padding: 12 }}>
                  Ozon принял команду создания поставки.
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <button type="button" onClick={() => setFboStep(4)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                <button type="button" onClick={() => void createRealFboSupply()} disabled={fboLoading || !selectedSlot} style={{ border: 0, background: fboLoading || !selectedSlot ? "#94a3b8" : "#16a34a", color: "#fff", borderRadius: 11, padding: "12px 18px", fontWeight: 900 }}>
                  {fboLoading ? "Создаю…" : "Создать поставку в Ozon"}
                </button>
              </div>
            </div>
          )}

          {fboStep === 6 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Разложите товар по коробкам</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  Заявка <b>№2000070131119</b>. Один SKU в одной коробке. Всего: <b>42 шт.</b>
                </div>
              </div>

              {!fboSupplyId && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>
                    Сначала ERP должна получить внутренние данные уже созданной поставки Ozon.
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadCreatedFboOrder(fboOrderId || 2000070131119)}
                    disabled={fboLoading}
                    style={{ justifySelf: "start", border: 0, background: fboLoading ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
                  >
                    {fboLoading ? "Загружаю…" : "Загрузить данные поставки"}
                  </button>
                </div>
              )}

              {fboSupplyId && (
                <>
                  <div style={{ display: "grid", gap: 10, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
                    {fboBoxes.map((quantity, index) => (
                      <div key={index} style={{ display: "grid", gridTemplateColumns: "120px minmax(120px,1fr) auto", gap: 10, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
                        <div style={{ fontWeight: 900 }}>Коробка {index + 1}</div>
                        <input
                          type="number"
                          min={1}
                          max={42}
                          value={quantity}
                          onChange={(event) => {
                            const next = [...fboBoxes];
                            next[index] = Math.max(0, Number(event.target.value || 0));
                            setFboBoxes(next);
                          }}
                          style={inputStyle}
                        />
                        <button
                          type="button"
                          disabled={fboBoxes.length <= 1}
                          onClick={() => setFboBoxes(fboBoxes.filter((_, rowIndex) => rowIndex !== index))}
                          style={{ border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", borderRadius: 9, padding: "8px 10px", fontWeight: 800 }}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setFboBoxes([...fboBoxes, 0])}
                      disabled={fboBoxes.length >= 30}
                      style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "9px 12px", fontWeight: 800 }}
                    >
                      + Добавить коробку
                    </button>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      Итого: {fboBoxes.reduce((sum, value) => sum + Number(value || 0), 0)} / 42 шт.
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <button type="button" onClick={() => setFboStep(5)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                    <button
                      type="button"
                      onClick={() => void submitFboCargoes()}
                      disabled={
                        fboLoading ||
                        fboBoxes.some((value) => Number(value || 0) <= 0) ||
                        fboBoxes.reduce((sum, value) => sum + Number(value || 0), 0) !== 42
                      }
                      style={{ border: 0, background: fboBoxes.reduce((sum, value) => sum + Number(value || 0), 0) === 42 ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}
                    >
                      Передать коробки в Ozon →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {fboStep === 7 && (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Регистрация грузомест</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Ozon регистрирует каждую переданную коробку и присваивает ей cargo_id.</div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                <div style={{ color: "#64748b", fontSize: 12 }}>Коробок передано</div>
                <div style={{ fontWeight: 900, fontSize: 28, marginTop: 3 }}>{fboBoxes.length}</div>
                <div style={{ color: "#64748b", marginTop: 6 }}>Операция: {fboCargoOperationId || "ожидаем ID операции"}</div>
              </div>

              <button
                type="button"
                onClick={() => void checkFboCargoes()}
                disabled={fboLoading || !fboCargoOperationId}
                style={{ justifySelf: "start", border: 0, background: !fboCargoOperationId || fboLoading ? "#94a3b8" : "#0f172a", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
              >
                {fboLoading ? "Проверяю…" : "Проверить регистрацию коробок"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setFboStep(6)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Коробки</button>
                <button type="button" onClick={() => setFboStep(8)} disabled={!fboCargoes.length} style={{ border: 0, background: fboCargoes.length ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 10, padding: "10px 15px", fontWeight: 900 }}>Далее →</button>
              </div>
            </div>
          )}

          {fboStep === 8 && (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Наклейки на коробки</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  Зарегистрировано коробок: <b>{fboCargoes.length}</b>. Теперь Ozon должен сформировать этикетки для каждой коробки.
                </div>
              </div>

              {!fboLabelOperationId && (
                <button
                  type="button"
                  onClick={() => void createFboCargoLabels()}
                  disabled={fboLoading || !fboCargoes.length}
                  style={{ justifySelf: "start", border: 0, background: fboCargoes.length ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
                >
                  {fboLoading ? "Запускаю…" : "Сформировать наклейки PDF"}
                </button>
              )}

              {fboLabelOperationId && !fboLabelUrl && (
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>
                    Ozon формирует PDF. Операция: {fboLabelOperationId}
                  </div>
                  <button
                    type="button"
                    onClick={() => void checkFboCargoLabels()}
                    disabled={fboLoading}
                    style={{ justifySelf: "start", border: 0, background: "#0f172a", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
                  >
                    {fboLoading ? "Проверяю…" : "Проверить готовность PDF"}
                  </button>
                </div>
              )}

              <div>
                <button type="button" onClick={() => setFboStep(7)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Грузоместа</button>
              </div>
            </div>
          )}

          {fboStep === 9 && (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Поставка подготовлена</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Коробки зарегистрированы, этикетки сформированы. Осталось распечатать PDF и наклеить этикетки на коробки.</div>
              </div>

              <div style={{ display: "grid", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 14, padding: 16 }}>
                <div><b>Заявка:</b> №2000070131119</div>
                <div><b>Товар:</b> bini-black-56 · 42 шт.</div>
                <div><b>Коробок:</b> {fboBoxes.length}</div>
                <div><b>Точка сдачи:</b> {selectedDropoff?.name || DEFAULT_FBO_DROPOFF.name}</div>
              </div>

              {fboLabelUrl ? (
                <a
                  href={fboLabelUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ justifySelf: "start", display: "inline-block", background: "#16a34a", color: "#fff", textDecoration: "none", borderRadius: 11, padding: "13px 18px", fontWeight: 900, fontSize: 17 }}
                >
                  Открыть PDF с наклейками
                </a>
              ) : (
                <button type="button" onClick={() => setFboStep(8)} style={{ justifySelf: "start", border: 0, background: "#005bff", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}>
                  Вернуться к формированию PDF
                </button>
              )}
            </div>
          )}
        </div>
      </section>
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
