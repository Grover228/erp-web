import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type ProductionBatch = {
  id: string;
  production_order_id: string;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  status: string | null;
  product_name: string | null;
  product_article: string | null;
  color_name: string | null;
  current_operation_order: number | null;
  started_at: string | null;
};

type ProductionOperation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  completed_quantity: number;
  price_per_unit: number | null;
  started_at: string | null;
};

type ProductionOrder = {
  id: string;
  quantity: number;
};

export default function EmployeeMobilePage({
  onOpenScanner,
}: {
  onOpenScanner: () => void;
}) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [closingBatch, setClosingBatch] = useState<ProductionBatch | null>(null);
  const [partialMode, setPartialMode] = useState(false);
  const [partialQty, setPartialQty] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingError, setClosingError] = useState("");

  useEffect(() => {
    loadMyBatches();
  }, []);

  async function loadMyBatches() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Пользователь не найден");

      const { data, error } = await supabase
        .from("production_batches")
        .select("*")
        .eq("assigned_user_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false });

      if (error) throw error;

      setBatches((data as ProductionBatch[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки пачек");
    } finally {
      setLoading(false);
    }
  }

  function openCloseModal(batch: ProductionBatch) {
    setClosingBatch(batch);
    setPartialMode(false);
    setPartialQty("");
    setClosingError("");
  }

  function closeModal() {
    if (closingLoading) return;
    setClosingBatch(null);
    setPartialMode(false);
    setPartialQty("");
    setClosingError("");
  }

  async function finishBatch(batch: ProductionBatch, mode: "all" | "partial") {
    try {
      setClosingLoading(true);
      setClosingError("");

      const total = Number(batch.quantity || 0);
      const completed = Number(batch.completed_quantity || 0);
      const left = Math.max(0, total - completed);

      const finishQty =
        mode === "all" ? left : Number(String(partialQty).replace(",", "."));

      if (!finishQty || finishQty <= 0) {
        throw new Error("Укажи количество больше 0");
      }

      if (!Number.isInteger(finishQty)) {
        throw new Error("Количество должно быть целым числом");
      }

      if (finishQty > left) {
        throw new Error(`Нельзя закрыть ${finishQty} шт. Осталось только ${left} шт.`);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Пользователь не найден");

      const [orderResult, operationsResult] = await Promise.all([
        supabase
          .from("production_orders")
          .select("id, quantity")
          .eq("id", batch.production_order_id)
          .maybeSingle(),

        supabase
          .from("production_order_operations")
          .select("*")
          .eq("production_order_id", batch.production_order_id)
          .order("sort_order", { ascending: true }),
      ]);

      if (orderResult.error) throw orderResult.error;
      if (operationsResult.error) throw operationsResult.error;

      const order = orderResult.data as ProductionOrder | null;
      const operations = (operationsResult.data as ProductionOperation[]) || [];

      if (!order) throw new Error("Производственный заказ не найден");

      const currentOperationOrder = Number(batch.current_operation_order || 0);
      const operation =
        operations.find((item) => item.sort_order === currentOperationOrder) ||
        null;

      if (!operation) {
        throw new Error("Операция для пачки не найдена");
      }

      const finishedAt = new Date().toISOString();
      const startedAt = batch.started_at || operation.started_at;
      const durationSeconds = startedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) /
                1000
            )
          )
        : 0;

      const newBatchCompleted = completed + finishQty;
      const isCurrentBatchOperationDone = newBatchCompleted >= total;

      const newOperationCompleted =
        Number(operation.completed_quantity || 0) + finishQty;

      const previousOperation = [...operations]
        .sort((a, b) => b.sort_order - a.sort_order)
        .find((item) => item.sort_order < operation.sort_order);

      const operationTarget =
        operation.sort_order === 1
          ? Number(order.quantity || 0)
          : Number(previousOperation?.completed_quantity || 0);

      const operationNextStatus =
        newOperationCompleted >= operationTarget ? "done" : "pending";

      const { error: operationError } = await supabase
        .from("production_order_operations")
        .update({
          status: operationNextStatus,
          completed_quantity: newOperationCompleted,
          completed_at: operationNextStatus === "done" ? finishedAt : null,
        })
        .eq("id", operation.id);

      if (operationError) throw operationError;

      const nextOperation = operations.find(
        (item) => item.sort_order > currentOperationOrder
      );

      let nextBatchData: Record<string, unknown>;

      if (isCurrentBatchOperationDone && nextOperation) {
        nextBatchData = {
          status: "waiting",
          completed_quantity: 0,
          current_operation_order: nextOperation.sort_order,
          assigned_user_id: null,
          assigned_at: null,
          started_at: null,
          completed_at: null,
        };
      } else if (isCurrentBatchOperationDone && !nextOperation) {
        nextBatchData = {
          status: "done",
          completed_quantity: total,
          assigned_user_id: null,
          assigned_at: null,
          completed_at: finishedAt,
        };
      } else {
        nextBatchData = {
          status: "partial",
          completed_quantity: newBatchCompleted,
          assigned_user_id: null,
          assigned_at: null,
          started_at: null,
          completed_at: null,
        };
      }

      const { error: batchError } = await supabase
        .from("production_batches")
        .update(nextBatchData)
        .eq("id", batch.id);

      if (batchError) throw batchError;

      const pricePerUnit = Number(operation.price_per_unit || 0);

      await supabase.from("production_operation_logs").insert({
        production_order_id: batch.production_order_id,
        production_order_operation_id: operation.id,
        user_id: user.id,
        operation_name: operation.operation_name,
        quantity: finishQty,
        price_per_unit: pricePerUnit,
        earned_amount: finishQty * pricePerUnit,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_seconds: durationSeconds,
        comment: mode === "all" ? "Всё готово" : "Готово частично",
      });

      closeModal();
      await loadMyBatches();
    } catch (error) {
      setClosingError(
        error instanceof Error ? error.message : "Не удалось закрыть пачку"
      );
    } finally {
      setClosingLoading(false);
    }
  }

  const totalDone = batches.reduce(
    (sum, batch) => sum + Number(batch.completed_quantity || 0),
    0
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
        padding: 14,
        display: "grid",
        gap: 14,
        alignContent: "start",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 24,
          padding: 18,
          border: "1px solid #dbeafe",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>
          Рабочий экран
        </div>

        <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.5 }}>
          Сканируй QR-код пачки, бери её в работу и закрывай выполненное
          количество.
        </div>
      </div>

      <button
        onClick={onOpenScanner}
        style={{
          width: "100%",
          minHeight: 84,
          border: "none",
          borderRadius: 24,
          background: "#2563eb",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 14px 28px rgba(37, 99, 235, 0.28)",
        }}
      >
        Сканировать QR
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="Сделано сегодня" value={`${totalDone} шт`} />
        <StatCard label="Пачек в работе" value={`${batches.length} шт`} />
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: 24,
          padding: 16,
          border: "1px solid #dbeafe",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
            Мои пачки в работе
          </div>

          <button
            onClick={loadMyBatches}
            style={{
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 12,
              padding: "8px 10px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>

        {loading && <div style={emptyBoxStyle}>Загружаю пачки...</div>}

        {error && (
          <div
            style={{
              ...emptyBoxStyle,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && batches.length === 0 && (
          <div style={emptyBoxStyle}>
            Пока нет пачек в работе. Нажми «Сканировать QR», чтобы взять пачку.
          </div>
        )}

        {!loading && !error && batches.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {batches.map((batch) => {
              const total = Number(batch.quantity || 0);
              const completed = Number(batch.completed_quantity || 0);
              const left = Math.max(0, total - completed);

              return (
                <div
                  key={batch.id}
                  style={{
                    border: "1px solid #dbeafe",
                    borderRadius: 20,
                    padding: 14,
                    background: "#f8fbff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#111827",
                    }}
                  >
                    Пачка {batch.batch_number}
                  </div>

                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    {batch.product_name || "Изделие не указано"}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <MiniBox label="Всего" value={`${total}`} />
                    <MiniBox label="Сделано" value={`${completed}`} />
                    <MiniBox label="Осталось" value={`${left}`} />
                  </div>

                  <button
                    onClick={() => openCloseModal(batch)}
                    style={{
                      width: "100%",
                      minHeight: 58,
                      border: "none",
                      borderRadius: 16,
                      background: "#16a34a",
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Закончить работу
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {closingBatch && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 10000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#ffffff",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 18,
              display: "grid",
              gap: 12,
              boxShadow: "0 -18px 40px rgba(15, 23, 42, 0.22)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
              Что сделано?
            </div>

            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Пачка {closingBatch.batch_number}
            </div>

            {closingError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontWeight: 800,
                }}
              >
                {closingError}
              </div>
            )}

            {!partialMode && (
              <>
                <button
                  onClick={() => finishBatch(closingBatch, "all")}
                  disabled={closingLoading}
                  style={bigGreenButtonStyle}
                >
                  Всё готово
                </button>

                <button
                  onClick={() => setPartialMode(true)}
                  disabled={closingLoading}
                  style={bigYellowButtonStyle}
                >
                  Готово, но не всё
                </button>
              </>
            )}

            {partialMode && (
              <>
                <input
                  value={partialQty}
                  onChange={(e) => setPartialQty(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  placeholder="Сколько штук готово?"
                  style={{
                    height: 58,
                    borderRadius: 16,
                    border: "1px solid #cbd5e1",
                    padding: "0 14px",
                    fontSize: 18,
                    fontWeight: 800,
                    outline: "none",
                  }}
                />

                <button
                  onClick={() => finishBatch(closingBatch, "partial")}
                  disabled={closingLoading}
                  style={bigYellowButtonStyle}
                >
                  {closingLoading ? "Сохраняю..." : "Сохранить частично"}
                </button>
              </>
            )}

            <button
              onClick={closeModal}
              disabled={closingLoading}
              style={{
                minHeight: 52,
                border: "none",
                borderRadius: 16,
                background: "#f1f5f9",
                color: "#0f172a",
                fontSize: 17,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: 14,
        border: "1px solid #dbeafe",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.3 }}>
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 900,
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 14,
        padding: 10,
        textAlign: "center",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const emptyBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontWeight: 700,
  lineHeight: 1.5,
};

const bigGreenButtonStyle: React.CSSProperties = {
  minHeight: 72,
  border: "none",
  borderRadius: 20,
  background: "#16a34a",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};

const bigYellowButtonStyle: React.CSSProperties = {
  minHeight: 72,
  border: "none",
  borderRadius: 20,
  background: "#f59e0b",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};