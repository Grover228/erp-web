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
  nowTick: number;
  actionLoading: boolean;
  deletingOrderId: string;
  onSelectJob: (jobId: string | null) => void;
  onReload: () => void;
  onOpenCreate: () => void;
  onOpenQrHistory: (order: ProductionOrder) => void;
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

export default function ProductionJobsList({
  items,
  variant,
  selectedJobId,
  loading,
  orders,
  batches,
  operationLogs,
  nowTick,
  actionLoading,
  deletingOrderId,
  onSelectJob,
  onReload,
  onOpenCreate,
  onOpenQrHistory,
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
  const selectedJob = selectedJobId
    ? items.find((job) => job.realId === selectedJobId) || null
    : null;

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
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
            {variant === "active" ? "Задания в производство" : "История заданий"}
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
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

      {loading && (
        <div style={emptyStyle}>Загрузка производственных заказов...</div>
      )}

      {!loading && items.length === 0 && (
        <div style={emptyStyle}>
          {variant === "active"
            ? "Активных производственных заданий пока нет."
            : "История производственных заданий пока пустая."}
        </div>
      )}

      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((job) => {
            const progress = getJobOperationProgress(job);
            const currentOperation = getJobCurrentOperation(job);
            const factStats = getJobFactStats(job);
            const batchStats = getJobBatchesStats(job);

            return (
              <button
                key={job.realId}
                type="button"
                onClick={() => onSelectJob(job.realId)}
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 16,
                  background: "#ffffff",
                  padding: 14,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "grid",
                  gap: 10,
                  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#111827",
                        lineHeight: 1.25,
                      }}
                    >
                      {job.product}
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                      {job.id} · {job.status}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      color: "#2563eb",
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    →
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    fontSize: 13,
                    color: "#334155",
                  }}
                >
                  <div><div style={{ color: "#64748b" }}>Кол-во</div><strong>{job.qty} шт</strong></div>
                  <div><div style={{ color: "#64748b" }}>Выполнено</div><strong>{job.completed} шт</strong></div>
                  <div><div style={{ color: "#64748b" }}>Прогресс</div><strong>{progress}%</strong></div>
                  <div><div style={{ color: "#64748b" }}>План</div><strong>{formatTime(job.timeMin)}</strong></div>
                  <div>
                    <div style={{ color: "#64748b" }}>Операция</div>
                    <strong>
                      {currentOperation
                        ? `${currentOperation.sort_order}. ${currentOperation.operation_name}`
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Пачки</div>
                    <strong>
                      {batchStats.done}/{batchStats.total}
                      {batchStats.inProgress > 0 ? ` · в работе ${batchStats.inProgress}` : ""}
                    </strong>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Факт времени</div>
                    <strong>
                      {factStats.totalDurationSeconds > 0
                        ? formatTimer(factStats.totalDurationSeconds)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <div style={{ color: "#64748b" }}>Среднее</div>
                    <strong>
                      {factStats.averageSeconds > 0
                        ? `${factStats.averageSeconds.toFixed(1)} сек`
                        : "—"}
                    </strong>
                  </div>
                </div>

                <ProgressBar value={progress} />
              </button>
            );
          })}
        </div>
      )}

      {selectedJob && (
        <ProductionOrderModal
          job={selectedJob}
          variant={variant}
          sourceOrder={orders.find((order) => order.id === selectedJob.realId) || null}
          jobBatches={batches.filter((batch) => batch.production_order_id === selectedJob.realId)}
          operationLogs={operationLogs.filter((log) => log.production_order_id === selectedJob.realId)}
          nowTick={nowTick}
          actionLoading={actionLoading}
          deletingOrderId={deletingOrderId}
          onClose={() => onSelectJob(null)}
          onOpenQrHistory={onOpenQrHistory}
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
