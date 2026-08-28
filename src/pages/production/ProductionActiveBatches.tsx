import type { ActiveBatchItem } from "./productionTypes";
import {
  formatTimer,
  getElapsedSeconds,
  getProgress,
  getStatusLabel,
} from "./productionUtils";
import {
  InfoBox,
  ProgressBar,
  emptyStyle,
  primaryGreenButtonStyle,
} from "./ProductionUi";

type Props = {
  items: ActiveBatchItem[];
  nowTick: number;
  actionLoading: boolean;
  onOpenFinishBatch: (item: ActiveBatchItem) => void;
};

export default function ProductionActiveBatches({
  items,
  nowTick,
  actionLoading,
  onOpenFinishBatch,
}: Props) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
          В работе
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Пачки, которые сейчас находятся в работе у сотрудника
        </div>
      </div>

      {items.length === 0 && (
        <div style={emptyStyle}>Сейчас нет пачек в работе</div>
      )}

      {items.map((item) => {
        const batch = item.batch;
        const order = item.order;
        const operation = item.operation;

        const total = Number(batch.quantity || 0);
        const completed = Number(batch.completed_quantity || 0);
        const left = Math.max(0, total - completed);

        return (
          <div
            key={batch.id}
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 16,
              padding: 14,
              background: "#ffffff",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                  Пачка {batch.batch_number}
                </div>
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
                  {operation
                    ? `${operation.sort_order}. ${operation.operation_name}`
                    : "Операция не найдена"}
                </div>
              </div>

              <div
                style={{
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 800,
                  height: "fit-content",
                }}
              >
                {getStatusLabel(batch.status)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <InfoBox
                label="Изделие"
                value={batch.product_name || order?.product?.name || "Без названия"}
              />
              <InfoBox
                label="Заказ"
                value={order?.order_number || order?.id.slice(0, 8) || "—"}
              />
              <InfoBox label="Всего в пачке" value={`${total} шт`} />
              <InfoBox label="Уже сделано" value={`${completed} шт`} />
              <InfoBox label="Осталось" value={`${left} шт`} />
              <InfoBox
                label="В работе"
                value={formatTimer(getElapsedSeconds(batch.started_at, nowTick))}
              />
            </div>

            <ProgressBar value={getProgress(completed, total)} />

            <div>
              <button
                onClick={() => onOpenFinishBatch(item)}
                disabled={actionLoading || !operation}
                style={primaryGreenButtonStyle}
              >
                Закончить работу
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
