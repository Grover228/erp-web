import type {
  Job,
  ProductionBatch,
  ProductionOrder,
  ProductionOrderOperation,
} from "../Production";

type ProductionOrderModalProps = {
  job: Job;
  variant: "active" | "history";
  sourceOrder: ProductionOrder | null;
  jobBatches: ProductionBatch[];
  nowTick: number;
  actionLoading: boolean;
  deletingOrderId: string;
  onClose: () => void;
  onOpenQrHistory: (order: ProductionOrder) => void;
  onDeleteOrder: (order: ProductionOrder) => void;
  onStartOperation: (
    order: ProductionOrder,
    operation: ProductionOrderOperation,
  ) => void;
  onOpenFinishOperation: (operation: ProductionOrderOperation) => void;
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
};

export default function ProductionOrderModal({
  job,
  variant,
  sourceOrder,
  jobBatches,
  nowTick,
  actionLoading,
  deletingOrderId,
  onClose,
  onOpenQrHistory,
  onDeleteOrder,
  onStartOperation,
  onOpenFinishOperation,
  getOperationLimit,
  canStartOperation,
}: ProductionOrderModalProps) {
  const progress = getProgress(job.completed, job.qty);

  if (!sourceOrder) {
    return (
      <ModalShell job={job} progress={progress} onClose={onClose}>
        <div style={emptyStyle}>Производственный заказ не найден.</div>
      </ModalShell>
    );
  }

  return (
    <ModalShell job={job} progress={progress} onClose={onClose}>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <InfoBox label="Создано" value={job.issuedAt} />
          <InfoBox label="Плановое время" value={formatTime(job.timeMin)} />
          <InfoBox label="Количество" value={`${job.qty} шт`} />
          <InfoBox label="Себестоимость" value={formatMoney(job.cost)} />
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              fontSize: 14,
              color: "#374151",
            }}
          >
            <span>Общий прогресс задания</span>
            <span>{progress}%</span>
          </div>

          <ProgressBar value={progress} />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
              Пачки после раскроя
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              Распечатано QR: {jobBatches.length} шт.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onOpenQrHistory(sourceOrder)}
              style={secondaryBlueButtonStyle()}
            >
              История QR / пачки
            </button>

            {variant === "active" && (
              <button
                onClick={() => onDeleteOrder(sourceOrder)}
                disabled={deletingOrderId === sourceOrder.id}
                style={{
                  ...dangerButtonStyle,
                  opacity: deletingOrderId === sourceOrder.id ? 0.7 : 1,
                }}
              >
                {deletingOrderId === sourceOrder.id ? "Удаление..." : "Удалить"}
              </button>
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              marginBottom: 10,
            }}
          >
            Операции
          </div>

          {job.operations.length === 0 ? (
            <div style={emptySmallStyle}>Операции пока не добавлены</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {job.operations.map((operation) => {
                const operationProgress = getProgress(
                  Number(operation.completed_quantity || 0),
                  job.qty,
                );

                const availableQuantity = getOperationLimit(
                  sourceOrder,
                  job.operations,
                  operation,
                );

                const canStart = canStartOperation(
                  sourceOrder,
                  job.operations,
                  operation,
                );

                const isInProgress = operation.status === "in_progress";
                const isDone = operation.status === "done";
                const earned =
                  Number(operation.completed_quantity || 0) *
                  Number(operation.price_per_unit || 0);

                return (
                  <div
                    key={operation.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 8,
                        fontSize: 14,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: "#111827" }}>
                          {operation.sort_order}. {operation.operation_name}
                        </div>

                        <div style={{ color: "#6b7280", marginTop: 4 }}>
                          Статус: {getStatusLabel(operation.status)}
                        </div>

                        {!isDone && (
                          <div style={{ color: "#64748b", marginTop: 4 }}>
                            Доступно к выполнению сейчас: {availableQuantity} шт
                          </div>
                        )}

                        {isInProgress && (
                          <div
                            style={{
                              color: "#2563eb",
                              marginTop: 4,
                              fontWeight: 700,
                            }}
                          >
                            В работе:{" "}
                            {formatTimer(
                              getElapsedSeconds(operation.started_at, nowTick),
                            )}
                          </div>
                        )}

                        {isDone && (
                          <div style={{ color: "#166534", marginTop: 4 }}>
                            Выполнено: {operation.completed_quantity} шт ·
                            Заработано: {formatMoney(earned)}
                          </div>
                        )}
                      </div>

                      <span style={{ color: "#4b5563" }}>
                        {operation.completed_quantity || 0} / {job.qty}
                      </span>
                    </div>

                    <ProgressBar value={operationProgress} />

                    {variant === "active" && (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        {canStart && (
                          <button
                            onClick={() => onStartOperation(sourceOrder, operation)}
                            disabled={actionLoading}
                            style={primaryBlueButtonStyle}
                          >
                            Взять в работу
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            onClick={() => onOpenFinishOperation(operation)}
                            disabled={actionLoading}
                            style={primaryGreenButtonStyle}
                          >
                            Закончить работу
                          </button>
                        )}

                        {!canStart && !isInProgress && !isDone && (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            Ждёт доступное количество с предыдущей операции
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  job,
  progress,
  onClose,
  children,
}: {
  job: Job;
  progress: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
              {job.product}
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              {job.id} · {job.status} · {progress}%
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function getProgress(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

function formatTime(minutes: number | null | undefined) {
  const totalMinutes = Math.round(Number(minutes || 0));

  if (totalMinutes <= 0) return "0 мин";

  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  if (hours === 0) return `${restMinutes} мин`;
  if (restMinutes === 0) return `${hours} ч`;

  return `${hours} ч ${restMinutes} мин`;
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
}

function getElapsedSeconds(startedAt: string | null, nowTick: number) {
  if (!startedAt) return 0;
  return Math.floor((nowTick - new Date(startedAt).getTime()) / 1000);
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "pending":
      return "Ожидает";
    case "waiting":
      return "Ожидает";
    case "partial":
      return "Частично выполнено";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    case "cancelled":
      return "Отменён";
    case "archived":
      return "Архив";
    default:
      return status || "Черновик";
  }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#dbeafe",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: "100%",
          background: "#2563eb",
        }}
      />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #dbeafe",
        borderRadius: 14,
        padding: 12,
        background: "#f8fbff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, color: "#111827" }}>{value}</div>
    </div>
  );
}

function secondaryBlueButtonStyle(): React.CSSProperties {
  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

const primaryBlueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryGreenButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 16,
  color: "#64748b",
  background: "#f8fbff",
  fontWeight: 600,
};

const emptySmallStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 600,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10040,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.34)",
  padding: 18,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
};

const closeButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};
