import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import OzonFbsOrders from "./OzonFbsOrders";

type Tab = "overview" | "analytics" | "stocks" | "matching" | "promotions" | "fbo" | "fbs" | "transfer";

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

type DailyFinance = {
  date: string;
  gross: number;
  ozon: number;
  cost: number;
  profit: number;
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

type OzonWarehouseMatch = {
  id: string;
  name: string;
  address: string;
};

type OzonPromoProduct = {
  product_id: number;
  offer_id: string;
  sku: string;
  name: string;
  current_price: number;
  auto_add_price: number;
  quantity_to_auto_add: number;
};

type OzonPromoWave = {
  action_id: number;
  title: string;
  auto_add_date: string;
  products: OzonPromoProduct[];
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
  workflow_step?: number | null;
  workflow_data?: Record<string, any> | null;
  archived?: boolean | null;
  kanban_stage?: string | null;
  ozon_state?: string | null;
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


const dashboardSeriesColors = {
  gross: "#2563eb",
  ozon: "#ef4444",
  cost: "#f59e0b",
  profit: "#10b981",
};

function svgPoints(values: number[], width: number, height: number, padding = 4) {
  if (!values.length) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
    const y = padding + ((max - value) * (height - padding * 2)) / range;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const width = 145;
  const height = 34;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="34" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={svgPoints(values, width, height, 3)} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FinanceLineChart({ rows }: { rows: DailyFinance[] }) {
  const width = 1000;
  const height = 230;
  const paddingX = 52;
  const paddingY = 22;
  const values = rows.flatMap((row) => [row.gross, row.ozon, row.cost, row.profit]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = (key: keyof Omit<DailyFinance, "date">) => rows.map((row, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(rows.length - 1, 1);
    const y = paddingY + ((max - row[key]) * (height - paddingY * 2)) / range;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  if (!rows.length) return <EmptyState title="Нет динамики" text="За выбранный период нет данных для графика." />;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: 720, height: 260 }}>
        {[0, 1, 2, 3, 4].map((step) => {
          const y = paddingY + (step * (height - paddingY * 2)) / 4;
          return <line key={step} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        <line x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="#cbd5e1" />
        <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="#cbd5e1" />
        <polyline points={points("gross")} fill="none" stroke={dashboardSeriesColors.gross} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points("ozon")} fill="none" stroke={dashboardSeriesColors.ozon} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points("cost")} fill="none" stroke={dashboardSeriesColors.cost} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points("profit")} fill="none" stroke={dashboardSeriesColors.profit} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((row, index) => {
          const x = paddingX + (index * (width - paddingX * 2)) / Math.max(rows.length - 1, 1);
          if (rows.length > 16 && index % Math.ceil(rows.length / 12) !== 0 && index !== rows.length - 1) return null;
          return <text key={row.date} x={x} y={height - 3} textAnchor="middle" fontSize="11" fill="#64748b">{new Date(row.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</text>;
        })}
      </svg>
    </div>
  );
}

function DonutExpenseChart({ rows }: { rows: FeeBreakdown[] }) {
  const colors = ["#3b82f6", "#fb923c", "#10b981", "#8b5cf6", "#ef4444", "#f59e0b", "#38bdf8", "#94a3b8"];
  const visible = rows.filter((row) => row.amount !== 0).slice(0, 8);
  const total = visible.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  let cursor = 0;
  const gradient = visible.length && total > 0
    ? `conic-gradient(${visible.map((row, index) => {
        const start = cursor;
        cursor += (Math.abs(row.amount) / total) * 100;
        return `${colors[index % colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
      }).join(", ")})`
    : "#e2e8f0";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px minmax(180px,1fr)", gap: 18, alignItems: "center" }}>
      <div style={{ width: 150, height: 150, borderRadius: "50%", background: gradient, position: "relative", margin: "0 auto" }}>
        <div style={{ position: "absolute", inset: 31, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", textAlign: "center", fontWeight: 900, color: "#0f172a", fontSize: 15 }}>
          <div>{money(-total)}<div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>100%</div></div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {visible.map((row, index) => (
          <div key={row.typeId} style={{ display: "grid", gridTemplateColumns: "10px 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors[index % colors.length] }} />
            <span style={{ color: "#475569" }}>{row.label}</span>
            <b>{total ? ((Math.abs(row.amount) / total) * 100).toFixed(1) : "0.0"}%</b>
          </div>
        ))}
      </div>
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
  const [dailyFinance, setDailyFinance] = useState<DailyFinance[]>([]);
  const [operationCount, setOperationCount] = useState(0);

  const [stocks, setStocks] = useState<OzonStock[]>([]);
  const [stockSummary, setStockSummary] = useState<OzonStockSummary | null>(null);
  const [stocksFetchedAt, setStocksFetchedAt] = useState("");
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseMatches, setWarehouseMatches] = useState<OzonWarehouseMatch[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<OzonStock[]>([]);
  const [warehouseSearchWarning, setWarehouseSearchWarning] = useState("");
  const [snapshotSavedRows, setSnapshotSavedRows] = useState(0);
  const [erpStockByArticle, setErpStockByArticle] = useState<Record<string, number>>({});
  const [productCodesLoading, setProductCodesLoading] = useState(false);
  const [productCodesApplying, setProductCodesApplying] = useState(false);
  const [productCodesRows, setProductCodesRows] = useState<any[]>([]);
  const [productCodesSummary, setProductCodesSummary] = useState<Record<string, number>>({});
  const [productCodesError, setProductCodesError] = useState("");
  const [productCodesMessage, setProductCodesMessage] = useState("");
  const [promoWaves, setPromoWaves] = useState<OzonPromoWave[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDeleting, setPromoDeleting] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [promoCheckedAt, setPromoCheckedAt] = useState("");

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
  const [fboSupplyItems, setFboSupplyItems] = useState<any[]>([]);
  const [fboBoxes, setFboBoxes] = useState<number[]>([42]);
  const [fboBoxAllocations, setFboBoxAllocations] = useState<Array<Record<string, number>>>([]);
  const [fboBoxLabels, setFboBoxLabels] = useState<Record<string, { operationId: string; fileUrl: string; status: string; error?: string }>>({});
  const [fboCargoResult, setFboCargoResult] = useState<any>(null);
  const [fboCargoOperationId, setFboCargoOperationId] = useState("");
  const [fboCargoes, setFboCargoes] = useState<any[]>([]);
  const [fboLabelOperationId, setFboLabelOperationId] = useState("");
  const [fboLabelUrl, setFboLabelUrl] = useState("");
  const [fboCards, setFboCards] = useState<SavedFboDraft[]>([]);
  const [fboView, setFboView] = useState<"board" | "picker" | "wizard">("board");
  const [fboStatusSyncing, setFboStatusSyncing] = useState(false);
  const [fboCancellingDraftId, setFboCancellingDraftId] = useState<number | null>(null);
  const [fboSelectedArticle, setFboSelectedArticle] = useState("");
  const [fboSelectedName, setFboSelectedName] = useState("");
  const [fboQuantity, setFboQuantity] = useState(1);
  const [fboProductSearch, setFboProductSearch] = useState("");
  const [fboSupplyDraft, setFboSupplyDraft] = useState<Record<string, number>>({});

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
      setFboView("board");
      void loadFboCards();
    }
    if (activeTab === "promotions") {
      void loadPromoAutoAdd();
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
      setDailyFinance((analyticsResult.data?.dailyFinance as DailyFinance[]) || []);
      setOperationCount(Number(analyticsResult.data?.operationCount || 0));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные Ozon");
    } finally {
      setLoading(false);
    }
  }

  async function loadStocks(searchValue = "") {
    try {
      setStocksLoading(true);
      setStocksError("");
      setWarehouseSearchWarning("");

      const normalizedSearch = searchValue.trim();
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-stocks", {
        body: {
          warehouseSearch: normalizedSearch || undefined,
          saveSnapshot: true,
        },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setStocks((data?.stocks as OzonStock[]) || []);
      setStockSummary((data?.summary as OzonStockSummary) || null);
      setStocksFetchedAt(String(data?.fetchedAt || ""));
      setSnapshotSavedRows(Number(data?.snapshot?.savedRows || 0));

      if (normalizedSearch) {
        setWarehouseMatches((data?.warehouseMatches as OzonWarehouseMatch[]) || []);
        setWarehouseStocks((data?.warehouseStocks as OzonStock[]) || []);
        setWarehouseSearchWarning(String(data?.warehouseSearchWarning || ""));
      }
    } catch (cause) {
      setStocksError(cause instanceof Error ? cause.message : "Не удалось загрузить остатки Ozon");
    } finally {
      setStocksLoading(false);
    }
  }

  async function syncOzonProductCodes(action: "preview" | "apply") {
    try {
      if (action === "apply") {
        const confirmed = window.confirm(
          "Записать штрихкоды, GTIN и ТН ВЭД из Ozon в сопоставленные товары ERP?\n\nСопоставление выполняется только по точному артикулу. Несопоставленные и неоднозначные позиции будут пропущены.",
        );
        if (!confirmed) return;
        setProductCodesApplying(true);
      } else {
        setProductCodesLoading(true);
      }

      setProductCodesError("");
      setProductCodesMessage("");

      const applyRows = action === "apply"
        ? productCodesRows
            .filter((row) => row.status === "matched" && row.id && row.entity && row.ozon)
            .map((row) => ({
              entity: row.entity,
              id: row.id,
              article: row.article,
              ozon: {
                barcode: row.ozon?.barcode || "",
                gtin: row.ozon?.gtin || "",
                tnved: row.ozon?.tnved || "",
              },
            }))
        : [];

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-product-codes", {
        body: action === "apply" ? { action, rows: applyRows } : { action },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      if (action === "apply") {
        setProductCodesRows((current) =>
          current.map((row) =>
            row.status === "matched" && row.ozon
              ? {
                  ...row,
                  current: {
                    barcode: row.ozon?.barcode || "",
                    gtin: row.ozon?.gtin || "",
                    tnved: row.ozon?.tnved || "",
                  },
                }
              : row,
          ),
        );
        setProductCodesMessage(
          `Записано позиций: ${Number(data?.updated || 0)}. Пропущено: ${Number(data?.skipped || 0)}.`,
        );
      } else {
        setProductCodesRows(Array.isArray(data?.preview) ? data.preview : []);
        setProductCodesSummary(data?.summary || {});
        setProductCodesMessage(
          `Ozon вернул товаров: ${Number(data?.fetchedFromOzon || 0)}. Проверьте сопоставление перед записью.`,
        );
      }
    } catch (cause) {
      setProductCodesError(
        cause instanceof Error ? cause.message : "Не удалось синхронизировать коды товаров Ozon",
      );
    } finally {
      setProductCodesLoading(false);
      setProductCodesApplying(false);
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

  const fboCardSelectFields = "draft_id,macrolocal_cluster_id,sku,offer_id,quantity,status,ozon_response,diagnostics,supply_type,drop_off_warehouse_id,drop_off_warehouse_name,drop_off_warehouse_type,seller_warehouse_id,order_id,supply_id,workflow_step,workflow_data,archived,kanban_stage,ozon_state,created_at,updated_at";

  async function loadFboCards() {
    try {
      const { data, error: cardsError } = await supabase
        .from("ozon_fbo_drafts")
        .select(fboCardSelectFields)
        .eq("supply_type", "CROSSDOCK")
        .eq("archived", false)
        .order("updated_at", { ascending: false });
      if (cardsError) throw cardsError;
      setFboCards((data as SavedFboDraft[]) || []);
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось загрузить список поставок");
    }
  }

  async function syncFboKanbanStatuses() {
    try {
      setFboStatusSyncing(true);
      setFboError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: { action: "sync_supply_states" },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      await loadFboCards();
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось обновить статусы поставок Ozon");
    } finally {
      setFboStatusSyncing(false);
    }
  }

  async function cancelFboSupplyOrder(row: SavedFboDraft) {
    const orderId = Number(row.order_id || 0);
    if (!orderId) {
      setFboError("Эта запись ещё не стала заявкой Ozon. Её можно только архивировать в ERP.");
      return;
    }

    const displayNumber = row.supply_id || row.order_id || row.draft_id;
    const confirmed = window.confirm(
      `Отменить заявку №${displayNumber} в Ozon?\n\nЭто реальная отмена на стороне Ozon. После подтверждения вернуть заявку обратно нельзя.`,
    );
    if (!confirmed) return;

    try {
      setFboCancellingDraftId(Number(row.draft_id));
      setFboError("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "cancel_supply_order",
          draftId: Number(row.draft_id),
          orderId,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      if (data?.cancelled) {
        setFboCards((rows) => rows.map((item) =>
          Number(item.draft_id) === Number(row.draft_id)
            ? { ...item, kanban_stage: "CANCELLED", ozon_state: "CANCELLED", updated_at: new Date().toISOString() }
            : item
        ));
        return;
      }

      setFboError("Ozon принял команду отмены, но операция ещё выполняется. Нажмите «Обновить статусы Ozon» через несколько секунд.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось отменить заявку в Ozon");
    } finally {
      setFboCancellingDraftId(null);
    }
  }

  function restoreFboCard(row: SavedFboDraft) {
    const workflow = row.workflow_data && typeof row.workflow_data === "object" ? row.workflow_data : {};
    setFboDraftId(Number(row.draft_id));
    setFboResolvedSku(Number(row.sku || 0) || null);
    setFboSelectedArticle(String(row.offer_id || ""));
    setFboSelectedName(
      stocks.find((stock) => stock.article.toLowerCase() === String(row.offer_id || "").toLowerCase())?.name
      || String(row.offer_id || "")
    );
    setFboQuantity(Math.max(1, Number(row.quantity || 1)));
    const savedItems = Array.isArray(row.workflow_data?.items) ? row.workflow_data?.items : [];
    setFboSupplyDraft(
      savedItems.length
        ? Object.fromEntries(savedItems.map((item: any) => [String(item.offerId || item.offer_id || ""), Number(item.quantity || 0)]).filter(([article, quantity]) => article && Number(quantity) > 0))
        : row.offer_id
          ? { [String(row.offer_id)]: Math.max(1, Number(row.quantity || 1)) }
          : {}
    );
    setFboClusterId(String(row.macrolocal_cluster_id || ""));
    setFboSellerWarehouseId(row.seller_warehouse_id ? String(row.seller_warehouse_id) : "");
    setFboOrderId(row.order_id ? Number(row.order_id) : null);
    setFboSupplyId(row.supply_id ? Number(row.supply_id) : null);
    setFboSupplyItem(null);
    setFboSupplyItems(Array.isArray(workflow.supplyItems) ? workflow.supplyItems : []);
    const restoredBoxes = Array.isArray(workflow.boxes) && workflow.boxes.length ? workflow.boxes.map((value: any) => Number(value || 0)) : [Number(row.quantity || 42)];
    setFboBoxes(restoredBoxes);
    if (Array.isArray(workflow.boxAllocations) && workflow.boxAllocations.length) {
      setFboBoxAllocations(workflow.boxAllocations.map((allocation: any) => allocation && typeof allocation === "object" ? allocation : {}));
    } else if (Array.isArray(workflow.boxSkuKeys) && workflow.boxSkuKeys.length) {
      setFboBoxAllocations(restoredBoxes.map((quantity: number, index: number) => ({ [String(workflow.boxSkuKeys[index] || "")]: quantity })));
    } else {
      setFboBoxAllocations([]);
    }
    setFboBoxLabels(workflow.boxLabels && typeof workflow.boxLabels === "object" ? workflow.boxLabels : {});
    setFboCargoOperationId(String(workflow.cargoOperationId || ""));
    setFboCargoes(Array.isArray(workflow.cargoes) ? workflow.cargoes : []);
    setFboLabelOperationId(String(workflow.labelOperationId || ""));
    setFboLabelUrl(String(workflow.labelUrl || ""));
    setFboSupplyResult(null);
    setFboTimeslots([]);
    setFboTimeslotIndex("");

    if (row.drop_off_warehouse_id) {
      setFboDropoffWarehouseId(String(row.drop_off_warehouse_id));
      setFboDropoffPoints([{
        warehouse_id: row.drop_off_warehouse_id,
        name: row.drop_off_warehouse_name || "Точка сдачи",
        warehouse_type: row.drop_off_warehouse_type || "",
        address: Number(row.drop_off_warehouse_id) === DEFAULT_FBO_DROPOFF.warehouse_id
          ? DEFAULT_FBO_DROPOFF.address
          : "",
      }]);
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
    const inferredStep = row.order_id ? 6 : String(row.status || "") === "SUCCESS" ? 4 : 3;
    setFboStep(Math.max(1, Math.min(9, Number(row.workflow_step || inferredStep))));
    setFboError("");
    setFboMessage("");
  }

  function openFboCard(row: SavedFboDraft) {
    restoreFboCard(row);
    setFboView("wizard");
  }

  function startNewFboSupply() {
    setFboDraftId(null);
    setFboResolvedSku(null);
    setFboDraftInfo(null);
    setFboDiagnostics([]);
    setFboClusterId("");
    setFboWarehouseId("");
    setFboOrderId(null);
    setFboSupplyId(null);
    setFboSupplyItem(null);
    setFboSupplyItems([]);
    setFboBoxes([42]);
    setFboBoxAllocations([]);
    setFboBoxLabels({});
    setFboCargoResult(null);
    setFboCargoOperationId("");
    setFboCargoes([]);
    setFboLabelOperationId("");
    setFboLabelUrl("");
    setFboSelectedArticle("");
    setFboSelectedName("");
    setFboQuantity(1);
    setFboProductSearch("");
    setFboSupplyDraft({});
    setFboTimeslots([]);
    setFboTimeslotIndex("");
    setFboDropoffWarehouseId(String(DEFAULT_FBO_DROPOFF.warehouse_id));
    setFboDropoffPoints([DEFAULT_FBO_DROPOFF]);
    setFboError("");
    setFboMessage("");
    setFboStep(1);
    setFboView("picker");
  }

  async function updateFboWorkflow(step?: number, workflowData?: Record<string, any>) {
    if (!fboDraftId) return;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "workflow_update",
          draftId: fboDraftId,
          ...(step ? { step } : {}),
          ...(workflowData ? { workflowData } : {}),
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setFboCards((rows) => rows.map((row) =>
        Number(row.draft_id) === Number(fboDraftId)
          ? {
              ...row,
              workflow_step: Math.max(Number(row.workflow_step || 1), Number(step || 1)),
              workflow_data: { ...(row.workflow_data || {}), ...(workflowData || {}) },
              updated_at: new Date().toISOString(),
            }
          : row
      ));
    } catch (cause) {
      console.error("Не удалось сохранить этап FBO", cause);
    }
  }

  function advanceFboStep(step: number, workflowData?: Record<string, any>) {
    setFboStep(step);
    void updateFboWorkflow(step, workflowData);
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

      const selectedItems = stocks
        .filter((row) => Number(fboSupplyDraft[row.article] || 0) > 0)
        .map((row) => ({
          offerId: row.article,
          quantity: Number(fboSupplyDraft[row.article] || 0),
        }));

      if (!selectedItems.length) throw new Error("Добавьте хотя бы один товар в поставку.");

      const sellerWarehouseId = Number(fboSellerWarehouseId || 0);

      const dropoff = fboDropoffPoints.find(
        (row: any) => String(row?.warehouse_id || "") === fboDropoffWarehouseId,
      );
      if (!dropoff) throw new Error("Найдите и выберите точку отгрузки Ozon.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
        body: {
          action: "create_crossdock_draft",
          macrolocalClusterId: clusterId,
          items: selectedItems,
          sellerWarehouseId,
          dropOffWarehouseId: Number(dropoff.warehouse_id),
          dropOffWarehouseName: String(dropoff.name || ""),
          dropOffWarehouseType: String(dropoff.warehouse_type || ""),
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const draftId = Number(data?.data?.draft_id || 0);
      const resolvedItems = Array.isArray(data?.items) ? data.items : [];
      const resolvedSku = Number(resolvedItems[0]?.sku || 0);
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
      const totalQuantity = selectedItems.reduce((sum, row) => sum + row.quantity, 0);
      setFboSelectedArticle(selectedItems[0]?.offerId || "");
      setFboSelectedName(selectedItems.length > 1 ? `${selectedItems.length} товаров` : selectedItems[0]?.offerId || "");
      setFboQuantity(totalQuantity);
      setFboMessage(
        `Черновик CROSSDOCK №${draftId} создан: ${selectedItems.length} поз., ${totalQuantity} шт. Подождите несколько секунд и обновите статус.`,
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
      if (String(nextDraftInfo?.status || "") === "SUCCESS") advanceFboStep(4);
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

    if (fboOrderId) {
      await loadCreatedFboOrder(fboOrderId);
      return;
    }

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
        `Создать реальную CROSSDOCK-заявку Ozon по черновику №${fboDraftId}?\n\nПозиций: ${Object.values(fboSupplyDraft).filter((qty) => Number(qty) > 0).length}\nКоличество: ${fboQuantity} шт.\nПосле подтверждения заявка будет создана в Ozon.`,
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

      const internalOrderIdInput = Number(orderId || 0);
      if (!internalOrderIdInput) throw new Error("Не указан внутренний order_id Ozon.");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-order", {
        body: {
          orderId: internalOrderIdInput,
          draftId: fboDraftId,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) {
        const context = (invokeError as any)?.context;
        if (context && typeof context.json === "function") {
          try {
            const errorPayload = await context.json();
            if (errorPayload?.error) throw new Error(errorPayload.error);
          } catch (contextError) {
            if (contextError instanceof Error && contextError.message !== invokeError.message) {
              throw contextError;
            }
          }
        }
        throw invokeError;
      }

      const payload = data?.data || null;
      const order = payload?.order || null;
      const internalOrderId = Number(payload?.order_id || order?.order_id || internalOrderIdInput || 0);
      const supplyId = Number(payload?.supply_id || payload?.supply?.supply_id || 0);
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const visibleOrderNumber = String(payload?.order_number || order?.order_number || supplyId || internalOrderId || "");

      if (!internalOrderId) throw new Error("Ozon не вернул внутренний order_id заявки.");
      if (!supplyId) throw new Error("Ozon не вернул supply_id для созданной поставки.");
      if (!items.length) throw new Error("Ozon не вернул товарный состав поставки.");

      setFboOrderId(internalOrderId);
      setFboSupplyId(supplyId);
      setFboSupplyItems(items);
      setFboSupplyItem(items[0] || null);

      const supplyItemKey = (item: any) => String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
      const initialAllocations = items
        .filter((item: any) => Number(item?.quantity || 0) > 0)
        .map((item: any) => ({ [supplyItemKey(item)]: Math.max(0, Number(item?.quantity || 0)) }));
      const initialBoxes = initialAllocations.map((allocation) =>
        Object.values(allocation).reduce((sum, quantity) => sum + Number(quantity || 0), 0),
      );

      const savedItems = stocks
        .filter((row) => Number(fboSupplyDraft[row.article] || 0) > 0)
        .map((row) => ({ offerId: row.article, quantity: Number(fboSupplyDraft[row.article] || 0) }));
      const totalQuantity = savedItems.reduce((sum, row) => sum + row.quantity, 0) || fboQuantity;
      setFboQuantity(totalQuantity);
      const resolvedAllocations = initialAllocations.length ? initialAllocations : [{ [supplyItemKey(items[0])]: totalQuantity }];
      const resolvedBoxes = initialBoxes.length ? initialBoxes : [totalQuantity];
      setFboBoxes(resolvedBoxes);
      setFboBoxAllocations(resolvedAllocations);
      setFboBoxLabels({});

      advanceFboStep(6, {
        boxes: resolvedBoxes,
        boxAllocations: resolvedAllocations,
        supplyItems: items,
        orderNumber: visibleOrderNumber,
        internalOrderLookup: true,
      });

      setFboMessage(
        `Заявка №${visibleOrderNumber || internalOrderId} загружена: ${items.length} поз., ${totalQuantity} шт. Теперь распределите товар по коробкам.`,
      );
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
    if (!fboSupplyId || !fboSupplyItems.length) return;

    try {
      setFboLoading(true);
      setFboError("");
      setFboCargoResult(null);

      const supplyItemKey = (item: any) => String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
      const itemByKey = new Map(fboSupplyItems.map((item: any) => [supplyItemKey(item), item]));
      const expectedByKey = new Map(
        fboSupplyItems.map((item: any) => [supplyItemKey(item), Math.max(0, Number(item?.quantity || 0))]),
      );

      if (!fboBoxAllocations.length) throw new Error("Добавьте хотя бы одну коробку.");
      if (fboBoxAllocations.length > 30) throw new Error("Ozon разрешает не больше 30 коробок в одном запросе.");

      const boxTotals = fboBoxAllocations.map((allocation) =>
        Object.values(allocation || {}).reduce((sum, quantity) => sum + Math.max(0, Number(quantity || 0)), 0),
      );
      const total = boxTotals.reduce((sum, quantity) => sum + quantity, 0);
      if (total !== fboQuantity) throw new Error(`По коробкам распределено ${total} шт., а в поставке должно быть ровно ${fboQuantity} шт.`);
      if (boxTotals.some((quantity) => quantity <= 0)) throw new Error("В каждой коробке должно быть больше 0 штук.");

      for (const [key, expected] of expectedByKey.entries()) {
        const actual = fboBoxAllocations.reduce(
          (sum, allocation) => sum + Math.max(0, Number(allocation?.[key] || 0)),
          0,
        );
        if (actual !== expected) {
          const item = itemByKey.get(key) as any;
          const label = String(item?.contractor_item_code || item?.offer_id || item?.sku || key);
          throw new Error(`По товару ${label} распределено ${actual} шт., а должно быть ровно ${expected} шт.`);
        }
      }

      const boxes = fboBoxAllocations.map((allocation, index) => {
        const items = Object.entries(allocation || {})
          .filter(([key, quantity]) => itemByKey.has(key) && Number(quantity || 0) > 0)
          .map(([key, quantity]) => {
            const item = itemByKey.get(key) as any;
            return {
              barcode: String(item?.barcode || ""),
              offer_id: String(item?.contractor_item_code || item?.offer_id || ""),
              quant: Number(item?.quant || 1),
              quantity: Number(quantity),
            };
          });
        if (!items.length) throw new Error(`Коробка ${index + 1} пустая.`);
        return { quantity: boxTotals[index], items };
      });

      setFboBoxes(boxTotals);

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-cargoes", {
        body: {
          supplyId: fboSupplyId,
          boxes,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      const result = data?.data || data;
      setFboCargoResult(result);
      const operationId = String(result?.operation_id || "");
      setFboCargoOperationId(operationId);
      setFboBoxLabels({});
      setFboMessage(
        operationId
          ? `Коробки отправлены в Ozon. Операция ${operationId} формируется.`
          : `Грузоместа отправлены в Ozon: ${boxes.length} коробок, ${fboQuantity} шт.`,
      );
      advanceFboStep(7, { boxes: boxTotals, boxAllocations: fboBoxAllocations, cargoOperationId: operationId });
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
        advanceFboStep(8, { cargoes });
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
      void updateFboWorkflow(8, { labelOperationId: operationId });
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
        advanceFboStep(9, { labelUrl: fileUrl });
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


  async function createFboBoxLabels() {
    if (!fboSupplyId || !fboCargoes.length) return;
    try {
      setFboLoading(true);
      setFboError("");

      const nextLabels: Record<string, { operationId: string; fileUrl: string; status: string; error?: string }> = { ...fboBoxLabels };
      for (const cargo of fboCargoes) {
        const cargoId = Number(cargo?.value?.cargo_id || cargo?.cargo_id || 0);
        if (!cargoId) continue;
        const key = String(cargoId);
        if (nextLabels[key]?.operationId || nextLabels[key]?.fileUrl) continue;

        try {
          const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
            body: {
              action: "cargo_labels_create",
              supplyId: fboSupplyId,
              cargoIds: [cargoId],
            },
          });
          if (data?.error) throw new Error(data.error);
          if (invokeError) throw invokeError;
          const operationId = String(data?.data?.operation_id || "");
          if (!operationId) throw new Error("Ozon не вернул operation_id.");
          nextLabels[key] = { operationId, fileUrl: "", status: "IN_PROGRESS" };
        } catch (cause) {
          nextLabels[key] = {
            operationId: "",
            fileUrl: "",
            status: "FAILED",
            error: cause instanceof Error ? cause.message : "Не удалось запросить этикетку",
          };
        }
      }

      setFboBoxLabels(nextLabels);
      void updateFboWorkflow(8, { boxLabels: nextLabels });
      setFboMessage("Запросы на этикетки отправлены отдельно для каждой коробки. Теперь проверьте готовность.");
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось запустить генерацию этикеток по коробкам");
    } finally {
      setFboLoading(false);
    }
  }

  async function checkFboBoxLabels() {
    if (!Object.keys(fboBoxLabels).length) return;
    try {
      setFboLoading(true);
      setFboError("");

      const nextLabels = { ...fboBoxLabels };
      for (const [cargoId, label] of Object.entries(nextLabels)) {
        if (!label.operationId || label.fileUrl) continue;
        try {
          const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbo-supply", {
            body: { action: "cargo_labels_get", operationId: label.operationId },
          });
          if (data?.error) throw new Error(data.error);
          if (invokeError) throw invokeError;

          const payload = data?.data || {};
          const status = String(payload?.status || "IN_PROGRESS");
          const fileUrl = String(payload?.result?.file_url || "");
          if (status === "SUCCESS" && fileUrl) {
            nextLabels[cargoId] = { ...label, status: "SUCCESS", fileUrl };
          } else if (status === "FAILED") {
            const reasons = payload?.errors?.error_reasons;
            nextLabels[cargoId] = {
              ...label,
              status: "FAILED",
              error: Array.isArray(reasons) && reasons.length ? reasons.join(", ") : "Ozon не сформировал этикетку",
            };
          } else {
            nextLabels[cargoId] = { ...label, status: status || "IN_PROGRESS" };
          }
        } catch (cause) {
          nextLabels[cargoId] = {
            ...label,
            status: "FAILED",
            error: cause instanceof Error ? cause.message : "Не удалось проверить этикетку",
          };
        }
      }

      setFboBoxLabels(nextLabels);
      void updateFboWorkflow(8, { boxLabels: nextLabels });
      const cargoIds = fboCargoes
        .map((cargo: any) => String(Number(cargo?.value?.cargo_id || cargo?.cargo_id || 0)))
        .filter((value: string) => value !== "0");
      const readyCount = cargoIds.filter((cargoId: string) => Boolean(nextLabels[cargoId]?.fileUrl)).length;
      const failedCount = cargoIds.filter((cargoId: string) => nextLabels[cargoId]?.status === "FAILED").length;

      if (cargoIds.length && readyCount === cargoIds.length) {
        setFboMessage(`Готовы этикетки для всех коробок: ${readyCount}.`);
        advanceFboStep(9, { boxLabels: nextLabels });
      } else {
        setFboMessage(`Готово этикеток: ${readyCount} из ${cargoIds.length}${failedCount ? `. Ошибок: ${failedCount}` : ""}.`);
      }
    } catch (cause) {
      setFboError(cause instanceof Error ? cause.message : "Не удалось проверить этикетки коробок");
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


  async function loadPromoAutoAdd() {
    try {
      setPromoLoading(true);
      setPromoError("");
      setPromoMessage("");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-promotions", {
        body: { action: "list_auto_add" },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));

      setPromoWaves((data?.waves as OzonPromoWave[]) || []);
      setPromoCheckedAt(String(data?.checked_at || ""));
    } catch (cause) {
      setPromoError(cause instanceof Error ? cause.message : "Не удалось загрузить автодобавление Ozon.");
    } finally {
      setPromoLoading(false);
    }
  }

  async function deleteAllPromoAutoAdd() {
    if (!promoWaves.length) return;

    const total = promoWaves.reduce((sum, wave) => sum + wave.products.length, 0);
    const confirmed = window.confirm(
      `Удалить из автодобавления все запланированные товары Ozon?\n\nПозиций в очередях: ${total}.\nЭто не удалит товары из каталога Ozon.`,
    );
    if (!confirmed) return;

    try {
      setPromoDeleting(true);
      setPromoError("");
      setPromoMessage("");

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-promotions", {
        body: { action: "delete_all_auto_add" },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));

      const remaining = Number(data?.remaining_products || 0);
      setPromoWaves((data?.remaining_waves as OzonPromoWave[]) || []);
      setPromoMessage(
        remaining === 0
          ? "Все товары удалены из очередей автодобавления Ozon."
          : `Очистка выполнена. В очередях осталось: ${remaining}.`,
      );
      setPromoCheckedAt(new Date().toISOString());
    } catch (cause) {
      setPromoError(cause instanceof Error ? cause.message : "Не удалось очистить автодобавление Ozon.");
    } finally {
      setPromoDeleting(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "overview", label: "Обзор", icon: "🏠" },
    { id: "analytics", label: "Аналитика", icon: "📊" },
    { id: "stocks", label: "Остатки", icon: "📦" },
    { id: "matching", label: "Сопоставление", icon: "🔗" },
    { id: "promotions", label: "Акции", icon: "🏷️" },
    { id: "fbo", label: "Поставки FBO", icon: "🚚" },
    { id: "fbs", label: "Заказы FBS", icon: "📦" },
    { id: "transfer", label: "Перенос (тест)", icon: "🧪" },
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
    const topProfit = articleAnalytics.slice(0, 10);
    const topSalesReturns = [...articleAnalytics]
      .sort((a, b) => (b.soldQty + b.returnQty) - (a.soldQty + a.returnQty))
      .slice(0, 10);
    const feeRows = feeBreakdown.filter((row) => row.amount !== 0);
    const maxFee = Math.max(...feeRows.map((row) => Math.abs(row.amount)), 1);
    const maxProfit = Math.max(...topProfit.map((row) => Math.abs(row.profit)), 1);
    const maxVolume = Math.max(...topSalesReturns.map((row) => Math.max(row.soldQty, row.returnQty)), 1);

    const kpis = [
      { title: "Продажи", value: summary.gross, values: dailyFinance.map((row) => row.gross), color: dashboardSeriesColors.gross },
      { title: "Расходы Ozon", value: summary.ozon, values: dailyFinance.map((row) => row.ozon), color: dashboardSeriesColors.ozon },
      { title: "Себестоимость", value: summary.cost, values: dailyFinance.map((row) => row.cost), color: "#94a3b8" },
      { title: "Прибыль", value: summary.profit, values: dailyFinance.map((row) => row.profit), color: dashboardSeriesColors.profit },
    ];

    return (
      <>
        <PeriodControls />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {kpis.map((kpi) => (
            <div key={kpi.title} style={{
              background: "linear-gradient(135deg,#10233f,#061425)",
              color: "#fff",
              borderRadius: 14,
              padding: "15px 16px 11px",
              minHeight: 112,
              boxShadow: "0 8px 24px rgba(15,23,42,.12)",
              border: "1px solid rgba(148,163,184,.16)",
            }}>
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>{kpi.title}</div>
              <div style={{ fontSize: 27, fontWeight: 900, marginTop: 4, color: kpi.title === "Прибыль" ? "#34d399" : "#fff" }}>
                {money(kpi.value)}
              </div>
              <div style={{ marginTop: 5, opacity: .95 }}><Sparkline values={kpi.values} color={kpi.color} /></div>
            </div>
          ))}
        </div>

        <section style={{ ...panelStyle, padding: 16, boxShadow: "0 8px 28px rgba(15,23,42,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Финансовый результат по дням</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Продажи, расходы Ozon, себестоимость и прибыль за выбранный период.</div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
              {[
                ["Продажи", dashboardSeriesColors.gross],
                ["Расходы Ozon", dashboardSeriesColors.ozon],
                ["Себестоимость", dashboardSeriesColors.cost],
                ["Прибыль", dashboardSeriesColors.profit],
              ].map(([label, color]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#475569" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />{label}
                </span>
              ))}
            </div>
          </div>
          <FinanceLineChart rows={dailyFinance} />
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          <section style={{ ...panelStyle, padding: 16, overflow: "hidden" }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Расходы Ozon по видам услуг</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, marginBottom: 14 }}>Чем длиннее полоса — тем дороже статья.</div>
            <div style={{ display: "grid", gap: 10 }}>
              {feeRows.slice(0, 9).map((row) => (
                <div key={row.typeId} style={{ display: "grid", gridTemplateColumns: "minmax(110px,1fr) minmax(100px,1.4fr) auto", gap: 9, alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
                  <div style={{ height: 10, background: "#eef2f7", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(2, (Math.abs(row.amount) / maxFee) * 100)}%`, height: "100%", background: row.typeId === 12 || row.typeId === 77 ? "#f59e0b" : "#3b82f6", borderRadius: 999 }} />
                  </div>
                  <b style={{ color: row.amount < 0 ? "#dc2626" : "#15803d", whiteSpace: "nowrap" }}>{money(row.amount)}</b>
                </div>
              ))}
            </div>
          </section>

          <section style={{ ...panelStyle, padding: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 16 }}>Структура расходов Ozon</div>
            <DonutExpenseChart rows={feeRows} />
          </section>

          <section style={{ ...panelStyle, padding: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>Топ-10 артикулов по прибыли</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, marginBottom: 14 }}>Самые прибыльные позиции выбранного периода.</div>
            <div style={{ display: "grid", gap: 8 }}>
              {topProfit.map((row) => (
                <div key={row.article} style={{ display: "grid", gridTemplateColumns: "110px 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}>
                  <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.article}</b>
                  <div style={{ height: 10, background: "#ecfdf5", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(2, (Math.abs(row.profit) / maxProfit) * 100)}%`, height: "100%", background: "#34d399", borderRadius: 999 }} />
                  </div>
                  <b style={{ color: row.profit >= 0 ? "#15803d" : "#b91c1c", whiteSpace: "nowrap" }}>{money(row.profit)}</b>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section style={{ ...panelStyle, padding: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 17 }}>Продажи и возвраты по артикулам</div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, marginBottom: 14 }}>Топ-10 по общему количеству продаж и возвратов.</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(topSalesReturns.length, 1)}, minmax(76px,1fr))`, gap: 10, alignItems: "end", minHeight: 220, overflowX: "auto" }}>
            {topSalesReturns.map((row) => (
              <div key={row.article} style={{ minWidth: 74, display: "grid", gap: 8, justifyItems: "center" }}>
                <div style={{ height: 160, width: 54, display: "flex", gap: 6, alignItems: "end" }}>
                  <div title={`Продажи: ${row.soldQty}`} style={{ width: 24, height: `${Math.max(4, (row.soldQty / maxVolume) * 150)}px`, background: "#3b82f6", borderRadius: "5px 5px 0 0" }} />
                  <div title={`Возвраты: ${row.returnQty}`} style={{ width: 24, height: `${Math.max(2, (row.returnQty / maxVolume) * 150)}px`, background: "#ef4444", borderRadius: "5px 5px 0 0" }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.article}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 8, fontSize: 12, color: "#64748b" }}>
            <span><b style={{ color: "#3b82f6" }}>■</b> Продажи</span>
            <span><b style={{ color: "#ef4444" }}>■</b> Возвраты</span>
          </div>
        </section>

        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div><div style={{ fontWeight: 900, fontSize: 18 }}>Аналитика по артикулам</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Расчёт по всем {operationCount} операциям выбранного периода.</div></div>
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

        <details style={{ ...panelStyle, overflow: "hidden" }}>
          <summary style={{ padding: 18, cursor: "pointer", fontWeight: 900 }}>Операции и последние синхронизации</summary>
          <div style={{ borderTop: "1px solid #e2e8f0" }}>
            <div style={{ padding: 18 }}><div style={{ fontWeight: 850, fontSize: 18 }}>Операции</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Показаны последние {Math.min(operationCount, 1000)} из {operationCount} операций.</div></div>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Дата", "Операция", "Отправление", "Продажа", "Ozon", "Начислено", "Себестоимость", "Прибыль", "Связь"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
              <tbody>{operations.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #eef2f7" }}><td style={{ padding: 12 }}>{new Date(row.operation_date).toLocaleDateString("ru-RU")}</td><td style={{ padding: 12 }}>{row.operation_type_name || "Операция Ozon"}</td><td style={{ padding: 12 }}>{row.posting_number || "—"}</td><td style={{ padding: 12 }}>{money(row.accruals_for_sale)}</td><td style={{ padding: 12 }}>{money(Number(row.sale_commission) + Number(row.services_total))}</td><td style={{ padding: 12 }}>{money(row.amount)}</td><td style={{ padding: 12 }}>{money(row.cost_of_goods)}</td><td style={{ padding: 12, color: Number(row.profit) >= 0 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>{money(row.profit)}</td><td style={{ padding: 12 }}>{row.matched ? "✓" : "Проверить"}</td></tr>)}</tbody>
            </table></div>
            <div style={{ padding: 18, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 12 }}>Последние синхронизации</div>
              {runs.length === 0 ? <div style={{ color: "#64748b" }}>Синхронизаций ещё не было.</div> : runs.map((run) => <div key={run.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, padding: "10px 0", borderTop: "1px solid #eef2f7" }}><span>{new Date(run.started_at).toLocaleString("ru-RU")}</span><span>{run.status === "completed" ? "Готово" : run.status === "failed" ? "Ошибка" : "Выполняется"} · {run.operations_loaded || 0} операций</span>{run.error_message && <span style={{ color: "#b91c1c", width: "100%" }}>{run.error_message}</span>}</div>)}
            </div>
          </div>
        </details>
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


        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 360px" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Остатки по складу Ozon</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                Введи город или название склада. Ozon вернёт склады, а ERP покажет товары, связанные с их warehouse_id.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "1 1 420px", justifyContent: "flex-end" }}>
              <input
                value={warehouseSearch}
                onChange={(event) => setWarehouseSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && warehouseSearch.trim().length >= 2) {
                    void loadStocks(warehouseSearch);
                  }
                }}
                placeholder="Например: Санкт-Петербург"
                style={{ ...inputStyle, minWidth: 240, flex: "1 1 280px" }}
              />
              <button
                type="button"
                disabled={stocksLoading || warehouseSearch.trim().length < 2}
                onClick={() => void loadStocks(warehouseSearch)}
                style={{
                  border: 0,
                  background: stocksLoading ? "#94a3b8" : "#2563eb",
                  color: "#fff",
                  borderRadius: 11,
                  padding: "10px 14px",
                  fontWeight: 850,
                  cursor: stocksLoading ? "wait" : "pointer",
                }}
              >
                {stocksLoading ? "Ищу…" : "Найти склад"}
              </button>
            </div>
          </div>

          {snapshotSavedRows > 0 && (
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 12 }}>
              Исторический снимок сохранён: {snapshotSavedRows} FBO-позиций.
            </div>
          )}

          {warehouseSearchWarning && (
            <div style={{ marginTop: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", padding: 12, borderRadius: 10 }}>
              {warehouseSearchWarning}
            </div>
          )}

          {warehouseMatches.length > 0 && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <div style={{ color: "#334155", fontWeight: 850 }}>Найденные склады</div>
              {warehouseMatches.map((warehouse) => (
                <div
                  key={warehouse.id}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}
                >
                  <div style={{ fontWeight: 850, color: "#0f172a" }}>
                    {warehouse.name || `Склад Ozon ${warehouse.id}`}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>
                    ID: {warehouse.id}{warehouse.address ? ` · ${warehouse.address}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

          {warehouseSearch.trim() && !stocksLoading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                Товары на найденных складах: {warehouseStocks.length}
              </div>

              {warehouseStocks.length === 0 ? (
                <EmptyState
                  title="Совпадений по текущему остатку нет"
                  text="Либо на найденном складе сейчас нет наших товаров, либо Ozon уже успел изменить распределение остатков."
                />
              ) : (
                <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                        {["Артикул", "Товар", "FBO SKU", "FBO всего", "Резерв", "warehouse_id"].map((title) => (
                          <th key={title} style={{ padding: 11, fontSize: 12 }}>{title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {warehouseStocks.map((row) => (
                        <tr key={row.productId || row.article} style={{ borderTop: "1px solid #eef2f7" }}>
                          <td style={{ padding: 11, fontWeight: 850 }}>{row.article}</td>
                          <td style={{ padding: 11 }}>{row.name}</td>
                          <td style={{ padding: 11 }}>{row.fboSku || "—"}</td>
                          <td style={{ padding: 11, color: "#005bff", fontWeight: 850 }}>{row.fboPresent}</td>
                          <td style={{ padding: 11 }}>{row.fboReserved}</td>
                          <td style={{ padding: 11, color: "#64748b", fontSize: 12 }}>{row.fboWarehouseIds.join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

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


        <section style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Коды товаров Ozon → ERP</div>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                Сопоставление только по точному артикулу. Загружаются ШК, GTIN и ТН ВЭД для изделий и товаров на перепродажу.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={productCodesLoading || productCodesApplying}
                onClick={() => void syncOzonProductCodes("preview")}
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 850, cursor: productCodesLoading ? "wait" : "pointer" }}
              >
                {productCodesLoading ? "Загружаю…" : "Проверить коды Ozon"}
              </button>
              <button
                type="button"
                disabled={productCodesApplying || productCodesLoading || !productCodesRows.some((row) => row.status === "matched")}
                onClick={() => void syncOzonProductCodes("apply")}
                style={{
                  border: 0,
                  background: !productCodesApplying && !productCodesLoading && productCodesRows.some((row) => row.status === "matched") ? "#16a34a" : "#94a3b8",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "10px 13px",
                  fontWeight: 900,
                  cursor: productCodesApplying ? "wait" : "pointer",
                }}
              >
                {productCodesApplying ? "Записываю…" : "Записать коды в ERP"}
              </button>
            </div>
          </div>

          {(productCodesMessage || productCodesError) && (
            <div style={{
              margin: "0 18px 14px",
              padding: 12,
              borderRadius: 10,
              background: productCodesError ? "#fef2f2" : "#f0fdf4",
              border: productCodesError ? "1px solid #fecaca" : "1px solid #bbf7d0",
              color: productCodesError ? "#b91c1c" : "#166534",
              fontWeight: 700,
            }}>
              {productCodesError || productCodesMessage}
            </div>
          )}

          {productCodesRows.length > 0 && (
            <>
              <div style={{ padding: "0 18px 14px", display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 12 }}>
                <span><b>Всего:</b> {productCodesSummary.total || 0}</span>
                <span><b>Совпало:</b> {productCodesSummary.matched || 0}</span>
                <span><b>Нет в Ozon:</b> {productCodesSummary.not_found_on_ozon || 0}</span>
                <span><b>Нет в ERP:</b> {productCodesSummary.not_found_in_erp || 0}</span>
                <span><b>Пустые коды Ozon:</b> {productCodesSummary.ozon_codes_empty || 0}</span>
                <span><b>Дубли ERP:</b> {productCodesSummary.duplicate_erp_article || 0}</span>
              </div>

              <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1250 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left", position: "sticky", top: 0, zIndex: 1 }}>
                      {["Тип", "Артикул", "Товар", "ШК ERP", "ШК Ozon", "GTIN ERP", "GTIN Ozon", "ТН ВЭД ERP", "ТН ВЭД Ozon", "Статус"].map((title) => (
                        <th key={title} style={{ padding: 11, fontSize: 12 }}>{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productCodesRows.map((row, index) => {
                      const statusLabel =
                        row.status === "matched" ? "Готово к записи" :
                        row.status === "not_found_on_ozon" ? "Нет на Ozon" :
                        row.status === "not_found_in_erp" ? "Нет в ERP" :
                        row.status === "ozon_codes_empty" ? "Коды Ozon пустые" :
                        row.status === "duplicate_erp_article" ? "Дубль артикула ERP" :
                        row.status;
                      const ok = row.status === "matched";
                      return (
                        <tr key={`${row.entity || "ozon"}:${row.id || row.article}:${index}`} style={{ borderTop: "1px solid #eef2f7" }}>
                          <td style={{ padding: 11 }}>{row.entity === "product" ? "Изделие" : row.entity === "resale_product" ? "Перепродажа" : "Ozon"}</td>
                          <td style={{ padding: 11, fontWeight: 850 }}>{row.article || "—"}</td>
                          <td style={{ padding: 11 }}>{row.name || "—"}</td>
                          <td style={{ padding: 11 }}>{row.current?.barcode || "—"}</td>
                          <td style={{ padding: 11, fontWeight: row.ozon?.barcode ? 800 : 400 }}>{row.ozon?.barcode || "—"}</td>
                          <td style={{ padding: 11 }}>{row.current?.gtin || "—"}</td>
                          <td style={{ padding: 11 }}>{row.ozon?.gtin || "—"}</td>
                          <td style={{ padding: 11 }}>{row.current?.tnved || "—"}</td>
                          <td style={{ padding: 11 }}>{row.ozon?.tnved || "—"}</td>
                          <td style={{ padding: 11 }}>
                            <span style={{
                              display: "inline-block",
                              borderRadius: 999,
                              padding: "5px 8px",
                              fontSize: 11,
                              fontWeight: 850,
                              background: ok ? "#dcfce7" : "#fef3c7",
                              color: ok ? "#166534" : "#92400e",
                            }}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
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


  function Promotions() {
    const totalProducts = promoWaves.reduce((sum, wave) => sum + wave.products.length, 0);

    return (
      <section style={{ display: "grid", gap: 14 }}>
        <section style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>🏷️ Акции Ozon</div>
              <div style={{ color: "#64748b", marginTop: 5, lineHeight: 1.45 }}>
                Здесь показываются товары, которые Ozon запланировал автоматически добавить в акции.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void loadPromoAutoAdd()}
                disabled={promoLoading || promoDeleting}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 850,
                  cursor: promoLoading || promoDeleting ? "wait" : "pointer",
                }}
              >
                {promoLoading ? "Обновляю…" : "Обновить"}
              </button>

              <button
                type="button"
                onClick={() => void deleteAllPromoAutoAdd()}
                disabled={promoDeleting || promoLoading || totalProducts === 0}
                style={{
                  border: 0,
                  background: promoDeleting || promoLoading || totalProducts === 0 ? "#cbd5e1" : "#dc2626",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontWeight: 900,
                  cursor: promoDeleting || promoLoading || totalProducts === 0 ? "default" : "pointer",
                }}
              >
                {promoDeleting ? "Удаляю…" : "Убрать всё автодобавление"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 13px", fontWeight: 850, color: "#1d4ed8" }}>
              Волн автодобавления: {promoWaves.length}
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 13px", fontWeight: 850, color: "#334155" }}>
              Товаров в очередях: {totalProducts}
            </div>
            {promoCheckedAt && (
              <div style={{ color: "#64748b", alignSelf: "center", fontSize: 12 }}>
                Проверено: {new Date(promoCheckedAt).toLocaleString("ru-RU")}
              </div>
            )}
          </div>
        </section>

        {promoError && (
          <div style={{ padding: 14, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontWeight: 700 }}>
            {promoError}
          </div>
        )}

        {promoMessage && (
          <div style={{ padding: 14, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", fontWeight: 700 }}>
            {promoMessage}
          </div>
        )}

        {!promoLoading && promoWaves.length === 0 && (
          <section style={{ ...panelStyle, padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Очередь автодобавления пустая</div>
            <div style={{ color: "#64748b", marginTop: 5 }}>Ozon сейчас не планирует автоматически добавлять ваши товары в акции.</div>
          </section>
        )}

        {promoWaves.map((wave) => (
          <section key={`${wave.action_id}:${wave.auto_add_date}`} style={{ ...panelStyle, overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", background: "#fffbeb" }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{wave.title}</div>
              <div style={{ color: "#92400e", marginTop: 4, fontSize: 13 }}>
                Автодобавление: {new Date(wave.auto_add_date).toLocaleString("ru-RU")} · товаров: {wave.products.length}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr>
                    {["Артикул", "Товар", "Текущая цена", "Цена автодобавления", "Изменение"].map((title) => (
                      <th key={title} style={{ textAlign: "left", padding: "11px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12 }}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wave.products.map((product) => {
                    const diff = Number(product.auto_add_price || 0) - Number(product.current_price || 0);
                    const pct = product.current_price > 0 ? (diff / product.current_price) * 100 : 0;
                    return (
                      <tr key={product.product_id}>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 800 }}>{product.offer_id || "—"}</td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f5f9" }}>{product.name || "—"}</td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f5f9" }}>{money(product.current_price)}</td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{money(product.auto_add_price)}</td>
                        <td style={{ padding: "11px 12px", borderBottom: "1px solid #f1f5f9", color: diff < 0 ? "#b91c1c" : "#166534", fontWeight: 800 }}>
                          {diff === 0 ? "0%" : `${pct.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </section>
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

    const stepNames = ["Кластер", "Точка сдачи", "Черновик", "Таймслот", "Подтверждение", "Коробки", "Грузоместа", "Наклейки", "Готово к отгрузке"];

    const kanbanColumns = [
      { id: "PREPARATION", title: "🛠️ Подготовка", hint: "Кластер, точка, таймслот" },
      { id: "BOXES", title: "📦 Коробки", hint: "Разложить товар" },
      { id: "LABELS", title: "🏷️ Наклейки", hint: "Грузоместа и PDF" },
      { id: "READY_TO_SUPPLY", title: "🚚 Готово к отгрузке", hint: "Можно везти" },
      { id: "ACCEPTED_DROPOFF", title: "✅ Принято в точке", hint: "Сдали Ozon" },
      { id: "IN_TRANSIT", title: "🛣️ В пути", hint: "Едет на склад" },
      { id: "OZON_ACCEPTANCE", title: "🏭 Приёмка Ozon", hint: "Принимают на складе" },
      { id: "REPORTS", title: "📄 Согласование", hint: "Акты и расхождения" },
      { id: "COMPLETED", title: "🏁 Завершено", hint: "Поставка закрыта" },
      { id: "CANCELLED", title: "🚫 Отменено", hint: "Отменено в Ozon" },
      { id: "PROBLEM", title: "⚠️ Проблема", hint: "Отказ или просрочка" },
    ] as const;

    const cardsByKanbanStage = (stage: string) =>
      fboCards.filter((row) => String(row.kanban_stage || "PREPARATION") === stage);

    if (fboView === "board") {
      return (
        <section style={{ display: "grid", gap: 14 }}>
          <div style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>🚚 Канбан поставок FBO</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  Подготовительные этапы ведёт ERP, после отгрузки статус приходит из Ozon.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void syncFboKanbanStatuses()}
                  disabled={fboStatusSyncing}
                  style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 11, padding: "10px 13px", fontWeight: 800, cursor: fboStatusSyncing ? "wait" : "pointer" }}
                >
                  {fboStatusSyncing ? "⏳ Проверяю Ozon…" : "🔄 Обновить статусы Ozon"}
                </button>
                <button type="button" onClick={startNewFboSupply} style={{ border: 0, background: "#005bff", color: "#fff", borderRadius: 11, padding: "11px 16px", fontWeight: 900, cursor: "pointer" }}>
                  ➕ Новая поставка
                </button>
              </div>
            </div>
          </div>

          {fboError && <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 12, padding: 13 }}>{fboError}</div>}

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 12,
            alignItems: "start",
            width: "100%",
          }}>
              {kanbanColumns.map((column) => {
                const cards = cardsByKanbanStage(column.id);
                return (
                  <div key={column.id} style={{
                    width: "100%",
                    minWidth: 0,
                    background: column.id === "PROBLEM" ? "#fff7ed" : "#f8fafc",
                    border: column.id === "PROBLEM" ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                    borderRadius: 16,
                    padding: 10,
                    minHeight: 220,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start", padding: "4px 4px 10px" }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{column.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{column.hint}</div>
                      </div>
                      <span style={{ minWidth: 25, height: 25, borderRadius: 999, display: "grid", placeItems: "center", background: "#e2e8f0", color: "#475569", fontSize: 12, fontWeight: 900 }}>
                        {cards.length}
                      </span>
                    </div>

                    <div style={{ display: "grid", gap: 9 }}>
                      {cards.map((row) => {
                        const step = Math.max(1, Math.min(9, Number(row.workflow_step || (row.order_id ? 6 : String(row.status || "") === "SUCCESS" ? 4 : 3))));
                        const displayNumber = row.supply_id || row.order_id || row.draft_id;
                        const canCancel = Boolean(row.order_id) && column.id !== "CANCELLED" && column.id !== "COMPLETED";
                        return (
                          <div key={row.draft_id} style={{
                            textAlign: "left",
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            borderRadius: 13,
                            padding: 13,
                            boxShadow: "0 4px 14px rgba(15,23,42,.05)",
                            width: "100%",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: "#64748b", fontSize: 10 }}>{row.supply_id ? "Заявка Ozon" : "Черновик"}</div>
                                <div style={{ fontWeight: 900, fontSize: 15, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>№{displayNumber}</div>
                              </div>
                              {column.id === "PREPARATION" || column.id === "BOXES" || column.id === "LABELS" ? (
                                <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "4px 7px", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap" }}>
                                  {step}/9
                                </span>
                              ) : row.ozon_state ? (
                                <span title={row.ozon_state} style={{ background: "#f1f5f9", color: "#475569", borderRadius: 999, padding: "4px 7px", fontSize: 9, fontWeight: 800, whiteSpace: "nowrap" }}>
                                  Ozon
                                </span>
                              ) : null}
                            </div>

                            <div style={{ marginTop: 10, fontSize: 12, color: "#334155", display: "grid", gap: 5 }}>
                              <div><b>{Array.isArray(row.workflow_data?.items) && row.workflow_data!.items.length > 1 ? `${row.workflow_data!.items.length} товара` : (row.offer_id || `SKU ${row.sku}`)}</b> · {number(Number(row.quantity || 0))} шт.</div>
                              <div style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {row.drop_off_warehouse_name || "Точка не выбрана"}</div>
                            </div>

                            {(column.id === "PREPARATION" || column.id === "BOXES" || column.id === "LABELS") && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(9,1fr)", gap: 3, marginTop: 10 }}>
                                {stepNames.map((_, index) => (
                                  <span key={index} style={{ height: 4, borderRadius: 999, background: index + 1 <= step ? "#005bff" : "#e2e8f0" }} />
                                ))}
                              </div>
                            )}

                            <div style={{ marginTop: 11, display: "flex", gap: 7, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => openFboCard(row)}
                                style={{ border: 0, background: "#eff6ff", color: "#005bff", borderRadius: 9, padding: "7px 9px", fontWeight: 900, fontSize: 11, cursor: "pointer" }}
                              >
                                Открыть →
                              </button>
                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => void cancelFboSupplyOrder(row)}
                                  disabled={fboCancellingDraftId === Number(row.draft_id)}
                                  style={{
                                    border: "1px solid #fecaca",
                                    background: "#fff",
                                    color: "#b91c1c",
                                    borderRadius: 9,
                                    padding: "7px 9px",
                                    fontWeight: 900,
                                    fontSize: 11,
                                    cursor: fboCancellingDraftId === Number(row.draft_id) ? "wait" : "pointer",
                                  }}
                                >
                                  {fboCancellingDraftId === Number(row.draft_id) ? "Отменяю…" : "🚫 Отменить в Ozon"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {!cards.length && (
                        <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: "22px 12px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                          Пусто
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      );
    }

    if (fboView === "picker") {
      const normalizedSearch = fboProductSearch.trim().toLowerCase();
      const supplyRows = stocks
        .filter((row) => row.fboSku)
        .filter((row) =>
          !normalizedSearch ||
          row.article.toLowerCase().includes(normalizedSearch) ||
          row.name.toLowerCase().includes(normalizedSearch)
        )
        .sort((a, b) => {
          const aQty = Number(fboSupplyDraft[a.article] || 0);
          const bQty = Number(fboSupplyDraft[b.article] || 0);
          if ((bQty > 0 ? 1 : 0) !== (aQty > 0 ? 1 : 0)) return (bQty > 0 ? 1 : 0) - (aQty > 0 ? 1 : 0);
          return b.fboPresent - a.fboPresent;
        });

      const selectedRows = stocks.filter((row) => Number(fboSupplyDraft[row.article] || 0) > 0);
      const selectedSkuCount = selectedRows.length;
      const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(fboSupplyDraft[row.article] || 0), 0);

      return (
        <section style={{ ...panelStyle, padding: 18, width: "100%", margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <button type="button" onClick={() => setFboView("board")} style={{ border: 0, background: "transparent", color: "#005bff", fontWeight: 900, padding: "0 0 8px", cursor: "pointer" }}>← К поставкам</button>
              <div style={{ fontWeight: 900, fontSize: 22 }}>📋 Комплектация поставки</div>
              <div style={{ color: "#64748b", marginTop: 5 }}>Укажите количество по всем товарам, которые хотите включить в одну FBO-поставку.</div>
            </div>
            <button type="button" onClick={() => void Promise.all([loadStocks(), loadErpStock()])} disabled={stocksLoading || erpLoading} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 13px", fontWeight: 800 }}>
              {stocksLoading || erpLoading ? "Обновляю…" : "🔄 Обновить остатки"}
            </button>
          </div>

          <input
            value={fboProductSearch}
            onChange={(event) => setFboProductSearch(event.target.value)}
            placeholder="Поиск по артикулу или названию…"
            style={{ ...inputStyle, width: "100%", fontSize: 15 }}
          />

          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                  {["Артикул", "Товар", "FBO SKU", "На Ozon", "На наших складах", "В поставку"].map((title) => (
                    <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplyRows.map((row) => {
                  const localStock = Number(erpStockByArticle[row.article.toLowerCase()] || 0);
                  const qty = Number(fboSupplyDraft[row.article] || 0);
                  return (
                    <tr key={row.productId || row.article} style={{ borderTop: "1px solid #eef2f7", background: qty > 0 ? "#f0f7ff" : "#fff" }}>
                      <td style={{ padding: 12, fontWeight: 900 }}>{row.article}</td>
                      <td style={{ padding: 12 }}>{row.name}</td>
                      <td style={{ padding: 12, color: "#475569" }}>{row.fboSku}</td>
                      <td style={{ padding: 12, fontWeight: 800 }}>{row.fboPresent}</td>
                      <td style={{ padding: 12, fontWeight: 800, color: localStock > 0 ? "#15803d" : "#94a3b8" }}>{number(localStock)}</td>
                      <td style={{ padding: 12 }}>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, localStock)}
                          value={qty || ""}
                          placeholder="0"
                          onChange={(event) => {
                            const nextQty = Math.max(0, Number(event.target.value || 0));
                            setFboSupplyDraft((prev) => ({
                              ...prev,
                              [row.article]: nextQty,
                            }));
                          }}
                          style={{
                            ...inputStyle,
                            width: 110,
                            fontWeight: 900,
                            borderColor: qty > localStock && localStock >= 0 ? "#fca5a5" : "#cbd5e1",
                            background: qty > localStock && localStock >= 0 ? "#fff1f2" : "#fff",
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{
            position: "sticky",
            bottom: 12,
            background: "#fff",
            border: "1px solid #dbeafe",
            boxShadow: "0 12px 30px rgba(15,23,42,.12)",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontWeight: 900 }}>Выбрано: {selectedSkuCount} поз. · {number(selectedTotal)} шт.</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Количество не должно превышать фактический остаток ERP.</div>
            </div>
            <button
              type="button"
              disabled={!selectedSkuCount || selectedRows.some((row) => Number(fboSupplyDraft[row.article] || 0) > Number(erpStockByArticle[row.article.toLowerCase()] || 0))}
              onClick={() => {
                const first = selectedRows[0];
                setFboSelectedArticle(first?.article || "");
                setFboSelectedName(selectedSkuCount > 1 ? `${selectedSkuCount} товаров` : first?.name || first?.article || "");
                setFboQuantity(selectedTotal);
                setFboBoxes([selectedTotal]);
                setFboStep(1);
                setFboView("wizard");
              }}
              style={{
                border: 0,
                background: !selectedSkuCount || selectedRows.some((row) => Number(fboSupplyDraft[row.article] || 0) > Number(erpStockByArticle[row.article.toLowerCase()] || 0)) ? "#94a3b8" : "#005bff",
                color: "#fff",
                borderRadius: 11,
                padding: "12px 18px",
                fontWeight: 900,
                cursor: selectedSkuCount ? "pointer" : "not-allowed",
              }}
            >
              Передать выбранное в поставку →
            </button>
          </div>
        </section>
      );
    }

    return (
      <section style={{ ...panelStyle, padding: 18, maxWidth: 980, width: "100%", margin: "0 auto" }}>
        <button type="button" onClick={() => { setFboView("board"); void loadFboCards(); }} style={{ border: 0, background: "transparent", color: "#005bff", fontWeight: 900, padding: "0 0 12px", cursor: "pointer" }}>← К поставкам</button>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Новая поставка FBO · CROSSDOCK</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
              <b>{Object.values(fboSupplyDraft).filter((qty) => Number(qty) > 0).length || 1} поз.</b> · {fboQuantity} шт. · конкретный склад внутри кластера определяет Ozon
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
                <button type="button" onClick={() => advanceFboStep(5)} disabled={!selectedSlot} style={{ border: 0, background: selectedSlot ? "#005bff" : "#94a3b8", color: "#fff", borderRadius: 11, padding: "11px 18px", fontWeight: 900 }}>Далее →</button>
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
                <div><span style={{ color: "#64748b" }}>Позиций:</span> <b>{Object.values(fboSupplyDraft).filter((qty) => Number(qty) > 0).length}</b></div>
                <div><span style={{ color: "#64748b" }}>Количество:</span> <b>{fboQuantity} шт.</b></div>
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
                {fboOrderId ? (
                  <button
                    type="button"
                    onClick={() => void loadCreatedFboOrder(fboOrderId)}
                    disabled={fboLoading}
                    style={{ border: 0, background: fboLoading ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 11, padding: "12px 18px", fontWeight: 900 }}
                  >
                    {fboLoading ? "Загружаю…" : "Продолжить уже созданную заявку →"}
                  </button>
                ) : (
                  <button type="button" onClick={() => void createRealFboSupply()} disabled={fboLoading || !selectedSlot} style={{ border: 0, background: fboLoading || !selectedSlot ? "#94a3b8" : "#16a34a", color: "#fff", borderRadius: 11, padding: "12px 18px", fontWeight: 900 }}>
                    {fboLoading ? "Создаю…" : "Создать поставку в Ozon"}
                  </button>
                )}
              </div>
            </div>
          )}

          {fboStep === 6 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Разложите товар по коробкам</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>
                  Заявка <b>№{fboSupplyId || fboOrderId || fboDraftId || "—"}</b>. Вводите фактическую раскладку вручную: сколько каждого товара лежит в каждой коробке. Всего: <b>{fboQuantity} шт.</b>
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
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: 12 }}>
                    Сейчас основной режим — ручная комплектация. В одной коробке можно указать один или несколько SKU. Сканирование QR добавим отдельно в мобильный интерфейс.
                  </div>

                  <div style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
                    {fboSupplyItems.map((item: any) => {
                      const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                      const expected = Math.max(0, Number(item?.quantity || 0));
                      const packed = fboBoxAllocations.reduce(
                        (sum, allocation) => sum + Math.max(0, Number(allocation?.[key] || 0)),
                        0,
                      );
                      return (
                        <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) auto", gap: 12, alignItems: "center" }}>
                          <span><b>{String(item?.contractor_item_code || item?.offer_id || item?.sku || "SKU")}</b></span>
                          <span style={{ color: packed === expected ? "#15803d" : "#b45309", fontWeight: 900 }}>{packed} / {expected} шт.</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "grid", gap: 12, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
                    {fboBoxAllocations.map((allocation, boxIndex) => {
                      const boxTotal = Object.values(allocation || {}).reduce((sum, quantity) => sum + Math.max(0, Number(quantity || 0)), 0);
                      return (
                        <div key={boxIndex} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 10, background: "#fff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 950, fontSize: 17 }}>Коробка {boxIndex + 1}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontWeight: 900 }}>{boxTotal} шт.</span>
                              <button
                                type="button"
                                disabled={fboBoxAllocations.length <= 1}
                                onClick={() => {
                                  const nextAllocations = fboBoxAllocations.filter((_, index) => index !== boxIndex);
                                  setFboBoxAllocations(nextAllocations);
                                  setFboBoxes(nextAllocations.map((row) => Object.values(row).reduce((sum, quantity) => sum + Math.max(0, Number(quantity || 0)), 0)));
                                }}
                                style={{ border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", borderRadius: 9, padding: "7px 10px", fontWeight: 800 }}
                              >
                                Удалить
                              </button>
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            {fboSupplyItems.map((item: any) => {
                              const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                              const label = String(item?.contractor_item_code || item?.offer_id || item?.sku || "SKU");
                              const value = Math.max(0, Number(allocation?.[key] || 0));
                              return (
                                <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 130px", gap: 10, alignItems: "center" }}>
                                  <div>
                                    <div style={{ fontWeight: 850 }}>{label}</div>
                                    <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{String(item?.barcode || "") ? `Штрихкод: ${String(item?.barcode || "")}` : "Товар поставки Ozon"}</div>
                                  </div>
                                  <input
                                    type="number"
                                    min={0}
                                    max={fboQuantity}
                                    value={value || ""}
                                    placeholder="0"
                                    onChange={(event) => {
                                      const quantity = Math.max(0, Number(event.target.value || 0));
                                      const nextAllocations = fboBoxAllocations.map((row, index) =>
                                        index === boxIndex ? { ...row, [key]: quantity } : row
                                      );
                                      setFboBoxAllocations(nextAllocations);
                                      setFboBoxes(nextAllocations.map((row) => Object.values(row).reduce((sum, qty) => sum + Math.max(0, Number(qty || 0)), 0)));
                                    }}
                                    style={{ ...inputStyle, textAlign: "right", fontWeight: 900 }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const nextAllocations = [...fboBoxAllocations, {}];
                        setFboBoxAllocations(nextAllocations);
                        setFboBoxes([...fboBoxes, 0]);
                      }}
                      disabled={fboBoxAllocations.length >= 30}
                      style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "9px 12px", fontWeight: 800 }}
                    >
                      + Добавить коробку
                    </button>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      Итого: {fboBoxAllocations.reduce((sum, allocation) => sum + Object.values(allocation || {}).reduce((boxSum, quantity) => boxSum + Math.max(0, Number(quantity || 0)), 0), 0)} / {fboQuantity} шт.
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <button type="button" onClick={() => setFboStep(5)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Назад</button>
                    <button
                      type="button"
                      onClick={() => void submitFboCargoes()}
                      disabled={
                        fboLoading ||
                        !fboBoxAllocations.length ||
                        fboBoxAllocations.some((allocation) => Object.values(allocation || {}).reduce((sum, quantity) => sum + Math.max(0, Number(quantity || 0)), 0) <= 0) ||
                        fboBoxAllocations.reduce((sum, allocation) => sum + Object.values(allocation || {}).reduce((boxSum, quantity) => boxSum + Math.max(0, Number(quantity || 0)), 0), 0) !== fboQuantity ||
                        fboSupplyItems.some((item: any) => {
                          const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                          const expected = Math.max(0, Number(item?.quantity || 0));
                          const packed = fboBoxAllocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation?.[key] || 0)), 0);
                          return packed !== expected;
                        })
                      }
                      style={{
                        border: 0,
                        background: (
                          !fboLoading &&
                          fboBoxAllocations.length > 0 &&
                          fboBoxAllocations.every((allocation) => Object.values(allocation || {}).reduce((sum, quantity) => sum + Math.max(0, Number(quantity || 0)), 0) > 0) &&
                          fboBoxAllocations.reduce((sum, allocation) => sum + Object.values(allocation || {}).reduce((boxSum, quantity) => boxSum + Math.max(0, Number(quantity || 0)), 0), 0) === fboQuantity &&
                          fboSupplyItems.every((item: any) => {
                            const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                            const expected = Math.max(0, Number(item?.quantity || 0));
                            const packed = fboBoxAllocations.reduce((sum, allocation) => sum + Math.max(0, Number(allocation?.[key] || 0)), 0);
                            return packed === expected;
                          })
                        ) ? "#005bff" : "#94a3b8",
                        color: "#fff",
                        borderRadius: 11,
                        padding: "11px 18px",
                        fontWeight: 900,
                      }}
                    >
                      Передать раскладку коробок в Ozon →
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
                  Каждая этикетка запрашивается отдельно по cargo_id, поэтому ERP точно знает, на какую физическую коробку её клеить.
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {fboBoxAllocations.map((allocation, boxIndex) => {
                  const expectedKey = `box-${String(boxIndex + 1).padStart(3, "0")}`;
                  const cargo = fboCargoes.find((row: any) => String(row?.key || row?.value?.key || "") === expectedKey) || fboCargoes[boxIndex];
                  const cargoId = Number(cargo?.value?.cargo_id || cargo?.cargo_id || 0);
                  const label = cargoId ? fboBoxLabels[String(cargoId)] : null;
                  const composition = fboSupplyItems
                    .map((item: any) => {
                      const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                      const quantity = Math.max(0, Number(allocation?.[key] || 0));
                      const name = String(item?.contractor_item_code || item?.offer_id || item?.sku || "SKU");
                      return quantity > 0 ? `${name} × ${quantity}` : "";
                    })
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={boxIndex} style={{ border: "1px solid #e2e8f0", borderRadius: 13, padding: 13, display: "grid", gridTemplateColumns: "110px minmax(220px,1fr) minmax(150px,auto)", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 950 }}>Коробка {boxIndex + 1}</div>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{cargoId ? `cargo_id ${cargoId}` : "cargo_id не найден"}</div>
                      </div>
                      <div style={{ color: "#334155", fontSize: 13 }}>{composition || "Состав не указан"}</div>
                      <div style={{ justifySelf: "end" }}>
                        {label?.fileUrl ? (
                          <a
                            href={label.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-block", background: "#16a34a", color: "#fff", textDecoration: "none", borderRadius: 9, padding: "9px 12px", fontWeight: 900 }}
                          >
                            Этикетка коробки {boxIndex + 1}
                          </a>
                        ) : (
                          <span style={{ color: label?.status === "FAILED" ? "#b91c1c" : "#64748b", fontSize: 12, fontWeight: 800 }}>
                            {!cargoId ? "Нет cargo_id" : label?.status === "FAILED" ? (label.error || "Ошибка этикетки") : label?.operationId ? "PDF формируется" : "Не запрошена"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void createFboBoxLabels()}
                  disabled={fboLoading || !fboCargoes.length}
                  style={{ border: 0, background: fboLoading || !fboCargoes.length ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
                >
                  {fboLoading ? "Запрашиваю…" : "Сформировать этикетки по коробкам"}
                </button>
                <button
                  type="button"
                  onClick={() => void checkFboBoxLabels()}
                  disabled={fboLoading || !Object.values(fboBoxLabels).some((label) => label.operationId && !label.fileUrl)}
                  style={{ border: 0, background: !fboLoading && Object.values(fboBoxLabels).some((label) => label.operationId && !label.fileUrl) ? "#0f172a" : "#94a3b8", color: "#fff", borderRadius: 10, padding: "11px 15px", fontWeight: 900 }}
                >
                  {fboLoading ? "Проверяю…" : "Проверить готовность этикеток"}
                </button>
              </div>

              <div>
                <button type="button" onClick={() => setFboStep(7)} style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}>← Грузоместа</button>
              </div>
            </div>
          )}

          {fboStep === 9 && (
            <div style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22 }}>Готово к отгрузке</div>
                <div style={{ color: "#64748b", marginTop: 5 }}>Раскладка сохранена, грузоместа зарегистрированы. Ниже каждая этикетка уже привязана к своей коробке.</div>
              </div>

              <div style={{ display: "grid", gap: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 14, padding: 16 }}>
                <div><b>Заявка:</b> №{fboSupplyId || fboOrderId || fboDraftId || "—"}</div>
                <div><b>Позиций:</b> {fboSupplyItems.length}</div>
                <div><b>Количество:</b> {fboQuantity} шт.</div>
                <div><b>Коробок:</b> {fboBoxAllocations.length}</div>
                <div><b>Точка сдачи:</b> {selectedDropoff?.name || DEFAULT_FBO_DROPOFF.name}</div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {fboBoxAllocations.map((allocation, boxIndex) => {
                  const expectedKey = `box-${String(boxIndex + 1).padStart(3, "0")}`;
                  const cargo = fboCargoes.find((row: any) => String(row?.key || row?.value?.key || "") === expectedKey) || fboCargoes[boxIndex];
                  const cargoId = Number(cargo?.value?.cargo_id || cargo?.cargo_id || 0);
                  const label = cargoId ? fboBoxLabels[String(cargoId)] : null;
                  const composition = fboSupplyItems
                    .map((item: any) => {
                      const key = String(item?.contractor_item_code || item?.offer_id || item?.sku || item?.barcode || "");
                      const quantity = Math.max(0, Number(allocation?.[key] || 0));
                      const name = String(item?.contractor_item_code || item?.offer_id || item?.sku || "SKU");
                      return quantity > 0 ? `${name} × ${quantity}` : "";
                    })
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={boxIndex} style={{ border: "1px solid #d1fae5", background: "#fff", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "110px minmax(220px,1fr) auto", gap: 12, alignItems: "center" }}>
                      <div style={{ fontWeight: 950 }}>Коробка {boxIndex + 1}</div>
                      <div>
                        <div style={{ color: "#334155", fontSize: 13 }}>{composition}</div>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 3 }}>{cargoId ? `cargo_id ${cargoId}` : "cargo_id не найден"}</div>
                      </div>
                      {label?.fileUrl ? (
                        <a href={label.fileUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#16a34a", color: "#fff", textDecoration: "none", borderRadius: 9, padding: "9px 12px", fontWeight: 900 }}>
                          Открыть этикетку
                        </a>
                      ) : (
                        <button type="button" onClick={() => setFboStep(8)} style={{ border: 0, background: "#005bff", color: "#fff", borderRadius: 9, padding: "9px 12px", fontWeight: 900 }}>
                          Получить этикетку
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
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
      {activeTab === "promotions" && <Promotions />}
      {activeTab === "fbo" && <FboSupply />}
      {activeTab === "fbs" && <OzonFbsOrders />}
      {activeTab === "transfer" && <TransferTest />}
    </div>
  );
}
