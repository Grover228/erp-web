import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../supabase";

type Shift = {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  total_quantity: number;
  total_earned: number;
  is_paused: boolean | null;
  paused_at: string | null;
};

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
  const [userId, setUserId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("Сотрудник");

  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [shiftError, setShiftError] = useState("");

  const [closingResult, setClosingResult] = useState<{
    quantity: number;
    earned: number;
    hours: number;
    operations: Record<string, number>;
  } | null>(null);

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [batchOperations, setBatchOperations] = useState<
    Record<string, ProductionOperation | null>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [closingBatch, setClosingBatch] = useState<ProductionBatch | null>(null);
  const [partialMode, setPartialMode] = useState(false);
  const [confirmNextOperation, setConfirmNextOperation] = useState(false);
  const [nextOperationPreview, setNextOperationPreview] = useState<ProductionOperation | null>(null);
  const [lastOperationReady, setLastOperationReady] = useState(false);
  const [finishedFinalBatch, setFinishedFinalBatch] = useState<{ batchNumber: string } | null>(null);
  const [partialQty, setPartialQty] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingError, setClosingError] = useState("");

  useEffect(() => {
    initEmployeePage();
  }, []);

  async function initEmployeePage() {
    try {
      setShiftLoading(true);
      setShiftError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Пользователь не найден");

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setEmployeeName(profile?.full_name || "Сотрудник");

      const currentShift = await loadCurrentShift(user.id);

      if (currentShift) {
        await loadMyBatches(user.id);
      }
    } catch (error) {
      setShiftError(
        error instanceof Error ? error.message : "Ошибка загрузки экрана"
      );
    } finally {
      setShiftLoading(false);
    }
  }

  async function loadCurrentShift(uid: string) {
    const { data, error } = await supabase
      .from("employee_shifts")
      .select("*")
      .eq("user_id", uid)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const currentShift = (data as Shift | null) || null;
    setShift(currentShift);

    return currentShift;
  }

  async function openShift() {
    try {
      if (!userId) throw new Error("Пользователь не найден");

      setShiftLoading(true);
      setShiftError("");
      setClosingResult(null);

      const { data, error } = await supabase
        .from("employee_shifts")
        .insert({
          user_id: userId,
          opened_at: new Date().toISOString(),
          status: "open",
          total_quantity: 0,
          total_earned: 0,
          is_paused: false,
          paused_at: null,
        })
        .select("*")
        .single();

      if (error) throw error;

      setShift(data as Shift);
      await loadMyBatches(userId);
    } catch (error) {
      setShiftError(
        error instanceof Error ? error.message : "Не удалось открыть смену"
      );
    } finally {
      setShiftLoading(false);
    }
  }

  async function closeShift() {
    try {
      if (!shift) return;

      setShiftLoading(true);
      setShiftError("");

      const opened = new Date(shift.opened_at).getTime();
      const closed = Date.now();
      const closedAt = new Date().toISOString();
      const hours = Math.max((closed - opened) / 1000 / 60 / 60, 0);

      const { data: shiftLogs, error: logsError } = await supabase
        .from("production_operation_logs")
        .select("operation_name, quantity, finished_at")
        .eq("user_id", userId || shift.user_id)
        .gte("finished_at", shift.opened_at)
        .lte("finished_at", closedAt);

      if (logsError) throw logsError;

      const operationsSummary = ((shiftLogs || []) as Array<{
        operation_name: string | null;
        quantity: number | string | null;
      }>).reduce((acc, log) => {
        const name = log.operation_name || "Операция";
        acc[name] = (acc[name] || 0) + Number(log.quantity || 0);
        return acc;
      }, {} as Record<string, number>);

      const { data, error } = await supabase
        .from("employee_shifts")
        .update({
          closed_at: closedAt,
          status: "closed",
        })
        .eq("id", shift.id)
        .select("*")
        .single();

      if (error) throw error;

      const closedShift = data as Shift;

      setClosingResult({
        quantity: Number(closedShift.total_quantity || 0),
        earned: Number(closedShift.total_earned || 0),
        hours,
        operations: operationsSummary,
      });

      setShift(null);
      setBatches([]);
      setBatchOperations({});
    } catch (error) {
      setShiftError(
        error instanceof Error ? error.message : "Не удалось закрыть смену"
      );
    } finally {
      setShiftLoading(false);
    }
  }

  async function togglePause() {
    try {
      if (!shift) return;

      setShiftError("");

      const isPaused = !shift.is_paused;
      const pausedAt = isPaused ? new Date().toISOString() : null;

      const { error } = await supabase
        .from("employee_shifts")
        .update({
          is_paused: isPaused,
          paused_at: pausedAt,
        })
        .eq("id", shift.id);

      if (error) throw error;

      setShift({
        ...shift,
        is_paused: isPaused,
        paused_at: pausedAt,
      });
    } catch (error) {
      setShiftError(
        error instanceof Error ? error.message : "Не удалось изменить паузу"
      );
    }
  }

  async function loadMyBatches(uidFromArg?: string) {
    try {
      setLoading(true);
      setError("");

      let uid = uidFromArg || userId;

      if (!uid) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Пользователь не найден");

        uid = user.id;
        setUserId(user.id);
      }

      const { data, error } = await supabase
        .from("production_batches")
        .select("*")
        .eq("assigned_user_id", uid)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false });

      if (error) throw error;

      const list = (data as ProductionBatch[]) || [];
      setBatches(list);

      const operationsMap: Record<string, ProductionOperation | null> = {};

      await Promise.all(
        list.map(async (batch) => {
          if (!batch.production_order_id || !batch.current_operation_order) {
            operationsMap[batch.id] = null;
            return;
          }

          const { data: operation, error: operationError } = await supabase
            .from("production_order_operations")
            .select("*")
            .eq("production_order_id", batch.production_order_id)
            .eq("sort_order", batch.current_operation_order)
            .maybeSingle();

          if (operationError) {
            operationsMap[batch.id] = null;
            return;
          }

          operationsMap[batch.id] =
            (operation as ProductionOperation | null) || null;
        })
      );

      setBatchOperations(operationsMap);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки пачек");
    } finally {
      setLoading(false);
    }
  }

  function openCloseModal(batch: ProductionBatch) {
    setClosingBatch(batch);
    setPartialMode(false);
    setConfirmNextOperation(false);
    setNextOperationPreview(null);
    setLastOperationReady(false);
    setPartialQty("");
    setClosingError("");
  }

  function closeModal() {
    if (closingLoading) return;

    setClosingBatch(null);
    setPartialMode(false);
    setConfirmNextOperation(false);
    setNextOperationPreview(null);
    setLastOperationReady(false);
    setPartialQty("");
    setClosingError("");
  }

  async function prepareCompleteCurrentOperation(batch: ProductionBatch) {
    try {
      setClosingLoading(true);
      setClosingError("");

      const currentOperationOrder = Number(batch.current_operation_order || 0);

      const { data, error } = await supabase
        .from("production_order_operations")
        .select("*")
        .eq("production_order_id", batch.production_order_id)
        .gt("sort_order", currentOperationOrder)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const nextOperation = (data as ProductionOperation | null) || null;
      setNextOperationPreview(nextOperation);

      if (nextOperation) {
        setConfirmNextOperation(true);
        setLastOperationReady(false);
      } else {
        setConfirmNextOperation(false);
        setLastOperationReady(true);
      }
    } catch (error) {
      setClosingError(
        error instanceof Error
          ? error.message
          : "Не удалось проверить следующую операцию"
      );
    } finally {
      setClosingLoading(false);
    }
  }

  async function finishBatch(
    batch: ProductionBatch,
    mode: "all" | "partial",
    nextAction: "self" | "waiting" = "waiting"
  ) {
    try {
      setClosingLoading(true);
      setClosingError("");

      if (!shift) {
        throw new Error("Сначала нужно открыть смену");
      }

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

      if (!operation) throw new Error("Операция для пачки не найдена");

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
        const takeNextBySelf = nextAction === "self";

        nextBatchData = {
          status: takeNextBySelf ? "in_progress" : "waiting",
          completed_quantity: 0,
          current_operation_order: nextOperation.sort_order,
          assigned_user_id: takeNextBySelf ? user.id : null,
          assigned_at: takeNextBySelf ? finishedAt : null,
          started_at: takeNextBySelf ? finishedAt : null,
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
      const earnedAmount = finishQty * pricePerUnit;

      const { error: logError } = await supabase
        .from("production_operation_logs")
        .insert({
          production_order_id: batch.production_order_id,
          production_order_operation_id: operation.id,
          user_id: user.id,
          operation_name: operation.operation_name,
          quantity: finishQty,
          price_per_unit: pricePerUnit,
          earned_amount: earnedAmount,
          started_at: startedAt,
          finished_at: finishedAt,
          duration_seconds: durationSeconds,
          comment: mode === "all" ? "Всё готово" : "Готово частично",
        });

      if (logError) throw logError;

      const newShiftQuantity = Number(shift.total_quantity || 0) + finishQty;
      const newShiftEarned = Number(shift.total_earned || 0) + earnedAmount;

      const { error: shiftUpdateError } = await supabase
        .from("employee_shifts")
        .update({
          total_quantity: newShiftQuantity,
          total_earned: newShiftEarned,
        })
        .eq("id", shift.id);

      if (shiftUpdateError) throw shiftUpdateError;

      setShift({
        ...shift,
        total_quantity: newShiftQuantity,
        total_earned: newShiftEarned,
      });

      const shouldAskTakeAnother =
        mode === "all" && isCurrentBatchOperationDone && !nextOperation;

      closeModal();
      await loadMyBatches(user.id);

      if (shouldAskTakeAnother) {
        setFinishedFinalBatch({ batchNumber: batch.batch_number });
      }
    } catch (error) {
      setClosingError(
        error instanceof Error ? error.message : "Не удалось закрыть пачку"
      );
    } finally {
      setClosingLoading(false);
    }
  }

  function handleOpenScanner() {
    if (batches.length > 0) {
      setError(
        "Сначала завершите текущую операцию. Нельзя взять новую пачку, пока старая находится в работе."
      );
      return;
    }

    onOpenScanner();
  }

  function handleCloseShift() {
    if (batches.length > 0) {
      setError(
        "Сначала завершите текущую операцию. Нельзя закрыть смену, пока есть пачка в работе."
      );
      return;
    }

    closeShift();
  }

  const activeBatch =
    batches.find((batch) => batch.status === "in_progress") || batches[0] || null;

  const activeOperation = activeBatch
    ? batchOperations[activeBatch.id] || null
    : null;

  const currentOperationText = activeBatch
    ? activeOperation?.operation_name ||
      `Операция №${activeBatch.current_operation_order || "?"}`
    : "Нет операции в работе";

  const shiftDuration = getShiftDuration(shift?.opened_at || null);

  if (shiftLoading) {
    return (
      <div style={pageStyle}>
        <div style={emptyBoxStyle}>Загрузка...</div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div style={closedShiftPageStyle}>
        <div style={closedShiftBoxStyle}>
          <div style={{ fontSize: 16, color: "#64748b", fontWeight: 800 }}>
            {employeeName}
          </div>

          {closingResult && (
            <div style={shiftResultStyle}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#14532d" }}>
                Итог смены
              </div>

              <div style={{ marginTop: 8 }}>Выполнено операций:</div>

              {Object.entries(closingResult.operations).length === 0 ? (
                <div style={{ fontSize: 16, color: "#166534" }}>
                  Нет данных по операциям
                </div>
              ) : (
                <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                  {Object.entries(closingResult.operations).map(([name, qty]) => (
                    <div key={name}>
                      {name}: <b>{qty} шт</b>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10 }}>Заработано: <b>{closingResult.earned.toFixed(2)} ₽</b></div>
              <div>Время: <b>{closingResult.hours.toFixed(1)} ч</b></div>
            </div>
          )}

          {shiftError && <div style={errorBoxStyle}>{shiftError}</div>}

          <button onClick={openShift} style={openShiftButtonStyle}>
            Открыть смену
          </button>
        </div>
      </div>
    );
  }

  if (shift.is_paused) {
    return (
      <div style={pausedPageStyle}>
        <div style={pausedBoxStyle}>
          <div style={{ fontSize: 18, color: "#64748b", fontWeight: 800 }}>
            Смена на паузе
          </div>

          <div style={{ fontSize: 30, fontWeight: 900, color: "#111827" }}>
            {employeeName}
          </div>

          <div style={pauseInfoStyle}>
            Работа остановлена. Сканер и пачки временно недоступны.
          </div>

          {shiftError && <div style={errorBoxStyle}>{shiftError}</div>}

          <button onClick={togglePause} style={resumeButtonStyle}>
            Продолжить работу
          </button>

          <button onClick={handleCloseShift} style={closeShiftButtonStyle}>
            Закрыть смену
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shiftSummaryCardStyle}>
        <div style={shiftSummaryLeftStyle}>
          <div style={{ fontSize: 16, color: "#64748b", fontWeight: 900 }}>
            Смена открыта
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 26,
              fontWeight: 900,
              color: "#111827",
              lineHeight: 1.1,
            }}
          >
            {employeeName}
          </div>

          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 900 }}>
            В работе: {shiftDuration}
          </div>
        </div>

        <div style={shiftSummaryRightStyle}>
          <div style={{ fontSize: 14, color: "#64748b", fontWeight: 900 }}>
            Текущая операция
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: 900,
              color: activeBatch ? "#1d4ed8" : "#94a3b8",
              lineHeight: 1.2,
            }}
          >
            {currentOperationText}
          </div>

          {activeBatch && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#64748b", fontWeight: 800 }}>
              Пачка {activeBatch.batch_number}
            </div>
          )}
        </div>
      </div>

      <button onClick={handleOpenScanner} style={scanButtonStyle}>
        Сканировать QR
      </button>

      <button onClick={togglePause} style={pauseButtonStyle}>
        Пауза / перерыв
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard label="Сделано за смену" value={`${shift.total_quantity || 0} шт`} />
        <StatCard label="Заработано" value={`${Number(shift.total_earned || 0).toFixed(0)} ₽`} />
      </div>

      <div style={sectionCardStyle}>
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

          <button onClick={() => loadMyBatches()} style={refreshButtonStyle}>
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
                <div key={batch.id} style={batchCardStyle}>
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
                    style={finishButtonStyle}
                  >
                    Закончить работу
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={handleCloseShift} style={closeShiftButtonStyle}>
        Закрыть смену
      </button>

      {closingBatch && (
        <div onClick={closeModal} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
              {lastOperationReady
                ? "Пачка готова"
                : confirmNextOperation
                  ? "Следующая операция"
                  : "Что сделано?"}
            </div>

            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Пачка {closingBatch.batch_number}
            </div>

            {closingError && <div style={errorBoxStyle}>{closingError}</div>}

            {!partialMode && !confirmNextOperation && !lastOperationReady && (
              <>
                <button
                  onClick={() => prepareCompleteCurrentOperation(closingBatch)}
                  disabled={closingLoading}
                  style={bigGreenButtonStyle}
                >
                  {closingLoading ? "Проверяю..." : "Всё готово"}
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

            {confirmNextOperation && nextOperationPreview && (
              <>
                <div style={infoBoxStyle}>
                  Текущая операция завершена полностью. Следующая операция:
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>
                    {nextOperationPreview.operation_name}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    Будете выполнять следующую операцию самостоятельно?
                  </div>
                </div>

                <button
                  onClick={() => finishBatch(closingBatch, "all", "self")}
                  disabled={closingLoading}
                  style={bigGreenButtonStyle}
                >
                  {closingLoading
                    ? "Сохраняю..."
                    : "Да, я буду делать эту операцию"}
                </button>

                <button
                  onClick={() => finishBatch(closingBatch, "all", "waiting")}
                  disabled={closingLoading}
                  style={bigYellowButtonStyle}
                >
                  {closingLoading ? "Сохраняю..." : "Нет, я не буду делать эту операцию"}
                </button>

                <button
                  onClick={() => {
                    setConfirmNextOperation(false);
                    setNextOperationPreview(null);
                    setPartialMode(true);
                  }}
                  disabled={closingLoading}
                  style={cancelButtonStyle}
                >
                  Вернуться: готово не всё
                </button>
              </>
            )}

            {lastOperationReady && (
              <>
                <div style={infoBoxStyle}>
                  Это последняя операция по техкарте. После сохранения пачка
                  будет полностью готова.
                </div>

                <button
                  onClick={() => finishBatch(closingBatch, "all", "waiting")}
                  disabled={closingLoading}
                  style={bigGreenButtonStyle}
                >
                  {closingLoading ? "Сохраняю..." : "Да, пачка готова"}
                </button>

                <button
                  onClick={() => {
                    setLastOperationReady(false);
                    setPartialMode(true);
                  }}
                  disabled={closingLoading}
                  style={bigYellowButtonStyle}
                >
                  Нет, готово не всё
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
                  style={inputStyle}
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
              style={cancelButtonStyle}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {finishedFinalBatch && (
        <div style={modalOverlayStyle}>
          <div style={modalBoxStyle}>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>
              Пачка готова
            </div>

            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Пачка {finishedFinalBatch.batchNumber} полностью завершена.
            </div>

            <div style={infoBoxStyle}>
              Будете брать другую пачку в работу?
            </div>

            <button
              onClick={() => {
                setFinishedFinalBatch(null);
                handleOpenScanner();
              }}
              style={bigGreenButtonStyle}
            >
              Да, сканировать QR
            </button>

            <button
              onClick={() => setFinishedFinalBatch(null)}
              style={bigYellowButtonStyle}
            >
              Нет, пока не буду
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getShiftDuration(openedAt: string | null) {
  if (!openedAt) return "0 мин";

  const opened = new Date(openedAt).getTime();
  const now = Date.now();
  const minutes = Math.max(Math.floor((now - opened) / 1000 / 60), 0);

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
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
    <div style={miniBoxStyle}>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
  padding: 14,
  display: "grid",
  gap: 14,
  alignContent: "start",
};

const closedShiftPageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
  padding: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const closedShiftBoxStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  display: "grid",
  gap: 18,
  textAlign: "center",
};

const shiftResultStyle: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  background: "#dcfce7",
  border: "1px solid #86efac",
  color: "#14532d",
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.7,
};

const openShiftButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 120,
  border: "none",
  borderRadius: 28,
  background: "#16a34a",
  color: "#ffffff",
  fontSize: 30,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 32px rgba(22, 163, 74, 0.28)",
};

const headerCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: 18,
  border: "1px solid #dbeafe",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const shiftSummaryCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: 16,
  border: "1px solid #dbeafe",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  alignItems: "stretch",
};

const shiftSummaryLeftStyle: CSSProperties = {
  minHeight: 104,
  borderRadius: 20,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const shiftSummaryRightStyle: CSSProperties = {
  minHeight: 104,
  borderRadius: 20,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  textAlign: "right",
};

const scanButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 84,
  border: "none",
  borderRadius: 24,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.18)",
};

const pauseButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 70,
  border: "none",
  borderRadius: 22,
  background: "#f59e0b",
  color: "#ffffff",
  fontSize: 21,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(245, 158, 11, 0.22)",
};

const pausedPageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #fffbeb 0%, #f8fafc 100%)",
  padding: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const pausedBoxStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  display: "grid",
  gap: 16,
  textAlign: "center",
};

const pauseInfoStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  background: "#fef3c7",
  border: "1px solid #fcd34d",
  color: "#92400e",
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.5,
};

const resumeButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 96,
  border: "none",
  borderRadius: 26,
  background: "#16a34a",
  color: "#ffffff",
  fontSize: 26,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 16px 32px rgba(22, 163, 74, 0.28)",
};

const closeShiftButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 76,
  border: "none",
  borderRadius: 24,
  background: "#dc2626",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 28px rgba(220, 38, 38, 0.22)",
};

const sectionCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 24,
  padding: 16,
  border: "1px solid #dbeafe",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const refreshButtonStyle: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "8px 10px",
  fontWeight: 800,
  cursor: "pointer",
};

const batchCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 20,
  padding: 14,
  background: "#f8fbff",
  display: "grid",
  gap: 10,
};

const finishButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 58,
  border: "none",
  borderRadius: 16,
  background: "#16a34a",
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
};

const emptyBoxStyle: CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontWeight: 700,
  lineHeight: 1.5,
};

const statCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 14,
  border: "1px solid #dbeafe",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
};

const miniBoxStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  padding: 10,
  textAlign: "center",
  border: "1px solid #e5e7eb",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
};

const modalBoxStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  background: "#ffffff",
  borderTopLeftRadius: 28,
  borderTopRightRadius: 28,
  padding: 18,
  display: "grid",
  gap: 12,
  boxShadow: "0 -18px 40px rgba(15, 23, 42, 0.22)",
};

const errorBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  fontWeight: 800,
};

const infoBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#334155",
  fontWeight: 800,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  height: 58,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  padding: "0 14px",
  fontSize: 18,
  fontWeight: 800,
  outline: "none",
};

const bigGreenButtonStyle: CSSProperties = {
  minHeight: 72,
  border: "none",
  borderRadius: 20,
  background: "#16a34a",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};

const bigYellowButtonStyle: CSSProperties = {
  minHeight: 72,
  border: "none",
  borderRadius: 20,
  background: "#f59e0b",
  color: "#ffffff",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
};

const cancelButtonStyle: CSSProperties = {
  minHeight: 52,
  border: "none",
  borderRadius: 16,
  background: "#f1f5f9",
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};