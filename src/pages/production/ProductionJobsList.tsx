import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import ProductionOrderModal from "./ProductionOrderModal";
import type {
  Job,
  ProductionBatch,
  ProductionOperationLog,
  ProductionOrder,
  ProductionOrderOperation,
} from "./productionTypes";
import {
  formatTime,
  formatTimer,
} from "./productionUtils";
import {
  ProgressBar,
  emptyStyle,
  primaryBlueButtonStyle,
  secondaryBlueButtonStyle,
} from "./ProductionUi";

type Props = {
  items: Job[];
  variant: "active" | "history";
  selectedJobId: string | null;
  loading: boolean;
  orders: ProductionOrder[];
  batches: ProductionBatch[];
  operationLogs: ProductionOperationLog[];
  qrPrintLogs: Array<{
    id: string;
    batch_id: string;
    production_order_id: string;
    printed_at: string;
    printed_by: string | null;
    printer_name: string;
    batch_number: string | null;
    quantity: number | null;
  }>;
  defects: Array<{ production_order_id: string; production_order_operation_id: string | null; quantity: number }>;
  nowTick: number;
  actionLoading: boolean;
  deletingOrderId: string;
  onSelectJob: (jobId: string | null) => void;
  onReload: () => void;
  onOpenCreate: () => void;
  onOpenQrHistory: (order: ProductionOrder) => void;
  onPrintBatchQr: (batch: ProductionBatch) => void;
  onDeleteOrder: (order: ProductionOrder) => void;
  onStartOperation: (
    order: ProductionOrder,
    operation: ProductionOrderOperation,
  ) => void;
  onOpenFinishOperation: (operation: ProductionOrderOperation) => void;
  onWriteOffDefect: (batch: ProductionBatch) => void;
  getOperationLimit: (
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation,
  ) => number;
  canStartOperation: (
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation,
  ) => boolean;
  getJobOperationProgress: (job: Job) => number;
  getJobCurrentOperation: (job: Job) => ProductionOrderOperation | null;
  getJobFactStats: (job: Job) => {
    totalDurationSeconds: number;
    totalQuantity: number;
    averageSeconds: number;
  };
  getJobBatchesStats: (job: Job) => {
    total: number;
    inProgress: number;
    done: number;
  };
};

const numberCellStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

export default function ProductionJobsList({
  items,
  variant,
  selectedJobId,
  loading,
  orders,
  batches,
  operationLogs,
  qrPrintLogs,
  defects,
  nowTick,
  actionLoading,
  deletingOrderId,
  onSelectJob,
  onReload,
  onOpenCreate,
  onOpenQrHistory,
  onPrintBatchQr,
  onDeleteOrder,
  onStartOperation,
  onOpenFinishOperation,
  onWriteOffDefect,
  getOperationLimit,
  canStartOperation,
  getJobOperationProgress,
  getJobCurrentOperation,
  getJobFactStats,
  getJobBatchesStats,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "waiting" | "in_progress" | "done" | "problems"
  >("all");
  const [historyPeriod, setHistoryPeriod] = useState<
    "today" | "7d" | "30d" | "month" | "year" | "custom" | "all"
  >("30d");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyProduct, setHistoryProduct] = useState("all");
  const [historyOnlyDefects, setHistoryOnlyDefects] = useState(false);

  const selectedJob = selectedJobId
    ? items.find((job) => job.realId === selectedJobId) || null
    : null;

  const defectQuantityByOrder = useMemo(() => {
    const map = new Map<string, number>();

    defects.forEach((defect) => {
      map.set(
        defect.production_order_id,
        (map.get(defect.production_order_id) || 0) +
          Number(defect.quantity || 0),
      );
    });

    return map;
  }, [defects]);

  const counts = useMemo(() => {
    const result = {
      all: items.length,
      draft: 0,
      waiting: 0,
      in_progress: 0,
      done: 0,
      problems: 0,
    };

    items.forEach((job) => {
      if (job.rawStatus === "draft") result.draft += 1;
      if (job.rawStatus === "done") result.done += 1;

      const currentOperation = getJobCurrentOperation(job);
      if (currentOperation?.status === "in_progress") {
        result.in_progress += 1;
      } else if (
        job.rawStatus !== "draft" &&
        job.rawStatus !== "done" &&
        currentOperation
      ) {
        result.waiting += 1;
      }

      if ((defectQuantityByOrder.get(job.realId) || 0) > 0) {
        result.problems += 1;
      }
    });

    return result;
  }, [items, defectQuantityByOrder, getJobCurrentOperation]);

  const historyProducts = useMemo(
    () => Array.from(new Set(items.map((job) => job.product))).sort((a, b) => a.localeCompare(b, "ru")),
    [items],
  );

  function parseJobDate(job: Job) {
    const sourceOrder = orders.find((order) => order.id === job.realId);
    const rawDate = sourceOrder?.created_at;
    if (!rawDate) return null;

    const date = new Date(rawDate);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getHistoryPeriodRange() {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (historyPeriod === "all") return { start: null, end: null };

    if (historyPeriod === "custom") {
      const start = historyDateFrom ? new Date(`${historyDateFrom}T00:00:00`) : null;
      const customEnd = historyDateTo ? new Date(`${historyDateTo}T23:59:59.999`) : null;
      return { start, end: customEnd };
    }

    const start = new Date(now);

    if (historyPeriod === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (historyPeriod === "7d") {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (historyPeriod === "30d") {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (historyPeriod === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return items.filter((job) => {
      const defectQty = defectQuantityByOrder.get(job.realId) || 0;
      const currentOperation = getJobCurrentOperation(job);

      let statusMatch = true;

      if (statusFilter === "draft") {
        statusMatch = job.rawStatus === "draft";
      } else if (statusFilter === "done") {
        statusMatch = job.rawStatus === "done";
      } else if (statusFilter === "in_progress") {
        statusMatch = currentOperation?.status === "in_progress";
      } else if (statusFilter === "waiting") {
        statusMatch =
          job.rawStatus !== "draft" &&
          job.rawStatus !== "done" &&
          currentOperation?.status !== "in_progress";
      } else if (statusFilter === "problems") {
        statusMatch = defectQty > 0;
      }

      if (!statusMatch) return false;

      if (variant === "history") {
        if (historyOnlyDefects && defectQty <= 0) return false;
        if (historyProduct !== "all" && job.product !== historyProduct) return false;

        const { start, end } = getHistoryPeriodRange();
        const jobDate = parseJobDate(job);

        if ((start || end) && !jobDate) return false;
        if (start && jobDate && jobDate < start) return false;
        if (end && jobDate && jobDate > end) return false;
      }

      if (!normalizedQuery) return true;

      return (
        job.product.toLowerCase().includes(normalizedQuery) ||
        job.id.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [
    items,
    searchQuery,
    statusFilter,
    defectQuantityByOrder,
    getJobCurrentOperation,
    variant,
    historyPeriod,
    historyDateFrom,
    historyDateTo,
    historyProduct,
    historyOnlyDefects,
    orders,
  ]);

  function getStatusChip(job: Job) {
    const currentOperation = getJobCurrentOperation(job);
    const defectQty = defectQuantityByOrder.get(job.realId) || 0;

    if (defectQty > 0 && job.rawStatus !== "done") {
      return { label: "Проблема", background: "#fee2e2", color: "#dc2626" };
    }

    if (job.rawStatus === "done") {
      return { label: "Готово", background: "#dcfce7", color: "#15803d" };
    }

    if (job.rawStatus === "draft") {
      return { label: "Черновик", background: "#f1f5f9", color: "#64748b" };
    }

    if (currentOperation?.status === "in_progress") {
      return { label: "В работе", background: "#ffedd5", color: "#ea580c" };
    }

    return { label: "Ожидает", background: "#fef3c7", color: "#d97706" };
  }

  function getStageLabel(job: Job) {
    const operation = getJobCurrentOperation(job);

    if (!operation) return job.rawStatus === "done" ? "Готово" : "—";

    return operation.operation_name;
  }

  function getGoodQuantity(job: Job) {
    if (job.rawStatus === "done") return Number(job.completed || 0);

    const currentOperation = getJobCurrentOperation(job);
    if (!currentOperation) return Number(job.completed || 0);

    const sorted = [...job.operations].sort((a, b) => a.sort_order - b.sort_order);
    const previousOperation = [...sorted]
      .reverse()
      .find((operation) => operation.sort_order < currentOperation.sort_order);

    if (currentOperation.sort_order === 1) {
      return Number(currentOperation.completed_quantity || 0);
    }

    return Number(previousOperation?.completed_quantity || 0);
  }

  function getRemainingQuantity(job: Job) {
    const good = getGoodQuantity(job);
    const defectQty = defectQuantityByOrder.get(job.realId) || 0;

    return Math.max(0, Number(job.qty || 0) - good - defectQty);
  }

  function renderFilterButton(
    id: "all" | "draft" | "waiting" | "in_progress" | "done" | "problems",
    label: string,
    count: number,
  ) {
    const active = statusFilter === id;

    return (
      <button
        type="button"
        onClick={() => setStatusFilter(id)}
        style={{
          border: active ? "1px solid #93c5fd" : "1px solid #e2e8f0",
          borderRadius: 10,
          background: active ? "#eff6ff" : "#ffffff",
          color: active ? "#1d4ed8" : "#334155",
          padding: "8px 12px",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          whiteSpace: "nowrap",
        }}
      >
        {label} <span style={{ marginLeft: 5, opacity: 0.8 }}>{count}</span>
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
            {variant === "active" ? "Задания в производство" : "История заданий"}
          </div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
            {variant === "active"
              ? "Активные производственные заказы"
              : "Завершённые, отменённые и архивные заказы"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onReload} style={secondaryBlueButtonStyle()}>
            Обновить
          </button>

          {variant === "active" && (
            <button onClick={onOpenCreate} style={primaryBlueButtonStyle}>
              + Создать задание
            </button>
          )}
        </div>
      </div>

      {variant === "active" ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {renderFilterButton("all", "Все", counts.all)}
          {renderFilterButton("draft", "Черновики", counts.draft)}
          {renderFilterButton("waiting", "Ожидают", counts.waiting)}
          {renderFilterButton("in_progress", "В работе", counts.in_progress)}
          {renderFilterButton("problems", "Проблемы", counts.problems)}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 12,
            border: "1px solid #dbeafe",
            borderRadius: 14,
            background: "#f8fbff",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["today", "Сегодня"],
              ["7d", "7 дней"],
              ["30d", "30 дней"],
              ["month", "Этот месяц"],
              ["year", "Этот год"],
              ["all", "Всё время"],
            ].map(([id, label]) => {
              const active = historyPeriod === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHistoryPeriod(id as typeof historyPeriod)}
                  style={{
                    border: active ? "1px solid #93c5fd" : "1px solid #dbe3ef",
                    borderRadius: 10,
                    background: active ? "#eff6ff" : "#ffffff",
                    color: active ? "#1d4ed8" : "#334155",
                    padding: "8px 11px",
                    cursor: "pointer",
                    fontWeight: 750,
                    fontSize: 13,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Дата от
              <input
                type="date"
                value={historyDateFrom}
                onChange={(event) => {
                  setHistoryDateFrom(event.target.value);
                  setHistoryPeriod("custom");
                }}
                style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13, background: "#fff" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Дата до
              <input
                type="date"
                value={historyDateTo}
                onChange={(event) => {
                  setHistoryDateTo(event.target.value);
                  setHistoryPeriod("custom");
                }}
                style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13, background: "#fff" }}
              />
            </label>

            <label style={{ display: "grid", gap: 5, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              Изделие
              <select
                value={historyProduct}
                onChange={(event) => setHistoryProduct(event.target.value)}
                style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", fontSize: 13, background: "#fff" }}
              >
                <option value="all">Все изделия</option>
                {historyProducts.map((product) => (
                  <option key={product} value={product}>{product}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setHistoryOnlyDefects((value) => !value)}
                style={{
                  border: historyOnlyDefects ? "1px solid #fca5a5" : "1px solid #dbe3ef",
                  borderRadius: 10,
                  background: historyOnlyDefects ? "#fef2f2" : "#ffffff",
                  color: historyOnlyDefects ? "#b91c1c" : "#334155",
                  padding: "9px 11px",
                  cursor: "pointer",
                  fontWeight: 750,
                  fontSize: 13,
                }}
              >
                Только с браком
              </button>
              <button
                type="button"
                onClick={() => {
                  setHistoryPeriod("30d");
                  setHistoryDateFrom("");
                  setHistoryDateTo("");
                  setHistoryProduct("all");
                  setHistoryOnlyDefects(false);
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                style={secondaryBlueButtonStyle()}
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 320px" }}>
          <span
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
              pointerEvents: "none",
            }}
          >
            ⌕
          </span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по заказу или изделию..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "10px 12px 10px 36px",
              fontSize: 14,
              outline: "none",
              background: "#ffffff",
              color: "#0f172a",
            }}
          />
        </div>
      </div>

      {loading && (
        <div style={emptyStyle}>Загрузка производственных заказов...</div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div style={emptyStyle}>
          {searchQuery || statusFilter !== "all" || (variant === "history" && (historyPeriod !== "all" || historyProduct !== "all" || historyOnlyDefects))
            ? "По выбранным условиям заказов нет."
            : variant === "active"
              ? "Активных производственных заданий пока нет."
              : "История производственных заданий пока пустая."}
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div
          style={{
            border: "1px solid #dbeafe",
            borderRadius: 14,
            overflowX: "auto",
            background: "#ffffff",
          }}
        >
          <div style={{ minWidth: 1180 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  variant === "history" ? "2.4fr 1.05fr 1fr .72fr .72fr .62fr .9fr .75fr 1.1fr 38px" : "2.4fr 1fr 1.2fr .72fr .72fr .62fr .82fr .75fr 1.15fr .95fr 38px",
                gap: 10,
                padding: "11px 14px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#64748b",
                fontSize: 12,
                fontWeight: 800,
                alignItems: "center",
              }}
            >
              <div>Изделие / Заказ</div>
              {variant === "history" ? (
                <>
                  <div>Дата</div>
                  <div>Статус</div>
                  <div>Заказано</div>
                  <div>Годно</div>
                  <div>Брак</div>
                  <div>Выход годного</div>
                  <div>Пачки</div>
                  <div>Факт времени</div>
                  <div />
                </>
              ) : (
                <>
                  <div>Статус</div>
                  <div>Этап</div>
                  <div>Заказано</div>
                  <div>Годно</div>
                  <div>Брак</div>
                  <div>Осталось</div>
                  <div>Пачки</div>
                  <div>Прогресс</div>
                  <div>План</div>
                  <div />
                </>
              )}
            </div>

            {filteredItems.map((job) => {
              const progress = getJobOperationProgress(job);
              const batchStats = getJobBatchesStats(job);
              const statusChip = getStatusChip(job);
              const defectQty = defectQuantityByOrder.get(job.realId) || 0;
              const goodQty = getGoodQuantity(job);
              const remainingQty = getRemainingQuantity(job);
              const factStats = getJobFactStats(job);
              const goodYield = Number(job.qty || 0) > 0
                ? Math.round((goodQty / Number(job.qty || 0)) * 100)
                : 0;

              return (
                <button
                  key={job.realId}
                  type="button"
                  onClick={() => onSelectJob(job.realId)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns:
                      variant === "history" ? "2.4fr 1.05fr 1fr .72fr .72fr .62fr .9fr .75fr 1.1fr 38px" : "2.4fr 1fr 1.2fr .72fr .72fr .62fr .82fr .75fr 1.15fr .95fr 38px",
                    gap: 10,
                    padding: "12px 14px",
                    border: "none",
                    borderBottom: "1px solid #eef2f7",
                    background: "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    alignItems: "center",
                    color: "#0f172a",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 850,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.product}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {job.id}
                    </div>
                  </div>

                  {variant === "history" ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {job.issuedAt || "—"}
                      </div>

                      <div>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 7,
                            padding: "5px 8px",
                            background: statusChip.background,
                            color: statusChip.color,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {statusChip.label}
                        </span>
                      </div>

                      <div style={numberCellStyle}>{job.qty}</div>
                      <div style={numberCellStyle}>{goodQty}</div>
                      <div
                        style={{
                          ...numberCellStyle,
                          color: defectQty > 0 ? "#dc2626" : "#0f172a",
                        }}
                      >
                        {defectQty}
                      </div>
                      <div style={{ ...numberCellStyle, color: goodYield < 100 ? "#b45309" : "#15803d" }}>
                        {goodYield}%
                      </div>
                      <div style={numberCellStyle}>
                        {batchStats.done}/{batchStats.total}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 750 }}>
                        {formatTimer(factStats.totalDurationSeconds)}
                      </div>
                    </>
                  ) : (
                    <>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        borderRadius: 7,
                        padding: "5px 8px",
                        background: statusChip.background,
                        color: statusChip.color,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {statusChip.label}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {getStageLabel(job)}
                  </div>

                  <div style={numberCellStyle}>{job.qty}</div>
                  <div style={numberCellStyle}>{goodQty}</div>
                  <div
                    style={{
                      ...numberCellStyle,
                      color: defectQty > 0 ? "#dc2626" : "#0f172a",
                    }}
                  >
                    {defectQty}
                  </div>
                  <div style={numberCellStyle}>{remainingQty}</div>

                  <div style={numberCellStyle}>
                    {batchStats.done}/{batchStats.total}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        height: 7,
                        background: "#e2e8f0",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, progress))}%`,
                          height: "100%",
                          background:
                            defectQty > 0 && job.rawStatus !== "done"
                              ? "#f59e0b"
                              : "#16a34a",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <strong style={{ fontSize: 12 }}>{progress}%</strong>
                  </div>

                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    {formatTime(job.timeMin)}
                  </div>

                    </>
                  )}

                  <div
                    style={{
                      color: "#2563eb",
                      fontSize: 18,
                      fontWeight: 900,
                      textAlign: "right",
                    }}
                  >
                    ›
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedJob && (
        <ProductionOrderModal
          job={selectedJob}
          variant={variant}
          sourceOrder={orders.find((order) => order.id === selectedJob.realId) || null}
          jobBatches={batches.filter((batch) => batch.production_order_id === selectedJob.realId)}
          operationLogs={operationLogs.filter((log) => log.production_order_id === selectedJob.realId)}
          qrPrintLogs={qrPrintLogs.filter((log) => log.production_order_id === selectedJob.realId)}
          nowTick={nowTick}
          actionLoading={actionLoading}
          deletingOrderId={deletingOrderId}
          onClose={() => onSelectJob(null)}
          onOpenQrHistory={onOpenQrHistory}
          onPrintBatchQr={onPrintBatchQr}
          onDeleteOrder={onDeleteOrder}
          onStartOperation={onStartOperation}
          onOpenFinishOperation={onOpenFinishOperation}
          onWriteOffDefect={onWriteOffDefect}
          getOperationLimit={getOperationLimit}
          canStartOperation={canStartOperation}
        />
      )}
    </div>
  );
}
