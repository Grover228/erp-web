import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Shift = {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  total_quantity: number;
  total_earned: number;
};

type Batch = {
  id: string;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  current_operation_order: number;
  status: string;
  assigned_user_id: string | null;
  production_order_id: string;
  product_name?: string | null;
  product_article?: string | null;
  color_name?: string | null;
};

type Operation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  completed_quantity: number;
  planned_total_price: number | null;
  price_per_unit: number | null;
};

type FinishMode = "all" | "partial" | null;

export default function EmployeeMobilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [operations, setOperations] = useState<Record<string, Operation | null>>(
    {}
  );

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [finishMode, setFinishMode] = useState<FinishMode>(null);
  const [partialQty, setPartialQty] = useState("");
  const [askNextOperation, setAskNextOperation] = useState(false);

  const [closingResult, setClosingResult] = useState<{
    quantity: number;
    earned: number;
    hours: number;
  } | null>(null);

  const [message, setMessage] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setMessage("Пользователь не найден. Нужно войти в систему.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setEmployeeName(profile?.full_name || "Сотрудник");

    await loadCurrentShift(user.id);
    await loadMyBatches(user.id);

    setLoading(false);
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

    if (error) {
      setMessage("Ошибка загрузки смены.");
      return;
    }

    setShift(data || null);
  }

  async function loadMyBatches(uid: string) {
    const { data, error } = await supabase
      .from("production_batches")
      .select("*")
      .eq("assigned_user_id", uid)
      .neq("status", "done")
      .order("batch_number", { ascending: true });

    if (error) {
      setMessage("Ошибка загрузки пачек.");
      return;
    }

    const list = data || [];
    setBatches(list);

    const opsMap: Record<string, Operation | null> = {};

    for (const batch of list) {
      const { data: operation } = await supabase
        .from("production_order_operations")
        .select("*")
        .eq("production_order_id", batch.production_order_id)
        .eq("sort_order", batch.current_operation_order)
        .maybeSingle();

      opsMap[batch.id] = operation || null;
    }

    setOperations(opsMap);
  }

  async function openShift() {
    if (!userId) return;

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("employee_shifts")
      .insert({
        user_id: userId,
        opened_at: new Date().toISOString(),
        status: "open",
        total_quantity: 0,
        total_earned: 0,
      })
      .select("*")
      .single();

    if (error) {
      setMessage("Не удалось открыть смену.");
      setLoading(false);
      return;
    }

    setShift(data);
    setLoading(false);
  }

  async function closeShift() {
    if (!shift || !userId) return;

    setLoading(true);
    setMessage("");

    const opened = new Date(shift.opened_at).getTime();
    const closed = new Date().getTime();
    const hours = Math.max((closed - opened) / 1000 / 60 / 60, 0);

    const { data, error } = await supabase
      .from("employee_shifts")
      .update({
        closed_at: new Date().toISOString(),
        status: "closed",
      })
      .eq("id", shift.id)
      .select("*")
      .single();

    if (error) {
      setMessage("Не удалось закрыть смену.");
      setLoading(false);
      return;
    }

    setClosingResult({
      quantity: data.total_quantity || 0,
      earned: data.total_earned || 0,
      hours,
    });

    setShift(null);
    setBatches([]);
    setOperations({});
    setLoading(false);
  }

  async function scanQr() {
    setMessage(
      "Сканер QR подключим следующим шагом. Сейчас пачки отображаются в списке «Мои пачки»."
    );
  }

  function openFinishModal(batch: Batch) {
    setSelectedBatch(batch);
    setFinishMode(null);
    setPartialQty("");
    setAskNextOperation(false);
    setMessage("");
  }

  function closeFinishModal() {
    setSelectedBatch(null);
    setFinishMode(null);
    setPartialQty("");
    setAskNextOperation(false);
  }

  function handleAllDoneClick() {
    setFinishMode("all");
    setAskNextOperation(true);
  }

  function handlePartialClick() {
    setFinishMode("partial");
    setAskNextOperation(false);
  }

  async function finishBatch(moveNext: boolean) {
    if (!selectedBatch || !userId || !shift) return;

    const operation = operations[selectedBatch.id];

    if (!operation) {
      setMessage("Операция для пачки не найдена.");
      return;
    }

    let doneQty = 0;

    if (finishMode === "all") {
      const alreadyDone = selectedBatch.completed_quantity || 0;
      doneQty = Math.max(selectedBatch.quantity - alreadyDone, 0);
    }

    if (finishMode === "partial") {
      doneQty = Number(partialQty);

      if (!doneQty || doneQty <= 0) {
        setMessage("Введите количество.");
        return;
      }
    }

    const oldBatchCompleted = selectedBatch.completed_quantity || 0;
    const newBatchCompleted = Math.min(
      oldBatchCompleted + doneQty,
      selectedBatch.quantity
    );

    const pricePerUnit = operation.price_per_unit || 0;
    const earned = doneQty * pricePerUnit;

    const isBatchOperationCompleted =
      newBatchCompleted >= selectedBatch.quantity && moveNext;

    const nextOperationOrder = selectedBatch.current_operation_order + 1;

    const { data: nextOperation } = await supabase
      .from("production_order_operations")
      .select("*")
      .eq("production_order_id", selectedBatch.production_order_id)
      .eq("sort_order", nextOperationOrder)
      .maybeSingle();

    const isLastOperation = !nextOperation;

    const nextBatchStatus = isBatchOperationCompleted
      ? isLastOperation
        ? "done"
        : "waiting"
      : "in_progress";

    const nextAssignedUserId = isBatchOperationCompleted ? null : userId;

    const batchUpdate = {
      completed_quantity: isBatchOperationCompleted ? 0 : newBatchCompleted,
      current_operation_order: isBatchOperationCompleted
        ? isLastOperation
          ? selectedBatch.current_operation_order
          : nextOperationOrder
        : selectedBatch.current_operation_order,
      status: nextBatchStatus,
      assigned_user_id: nextAssignedUserId,
    };

    const { error: batchError } = await supabase
      .from("production_batches")
      .update(batchUpdate)
      .eq("id", selectedBatch.id);

    if (batchError) {
      setMessage("Не удалось обновить пачку.");
      return;
    }

    const newOperationCompleted =
      (operation.completed_quantity || 0) + doneQty;

    await supabase
      .from("production_order_operations")
      .update({
        completed_quantity: newOperationCompleted,
        status:
          newOperationCompleted >= selectedBatch.quantity
            ? "done"
            : "in_progress",
      })
      .eq("id", operation.id);

    await supabase.from("production_operation_logs").insert({
      production_order_id: selectedBatch.production_order_id,
      production_batch_id: selectedBatch.id,
      production_order_operation_id: operation.id,
      user_id: userId,
      quantity: doneQty,
      earned_amount: earned,
      created_at: new Date().toISOString(),
    });

    await supabase
      .from("employee_shifts")
      .update({
        total_quantity: (shift.total_quantity || 0) + doneQty,
        total_earned: (shift.total_earned || 0) + earned,
      })
      .eq("id", shift.id);

    const updatedShift = {
      ...shift,
      total_quantity: (shift.total_quantity || 0) + doneQty,
      total_earned: (shift.total_earned || 0) + earned,
    };

    setShift(updatedShift);

    await loadMyBatches(userId);

    closeFinishModal();

    if (isBatchOperationCompleted && isLastOperation) {
      setMessage("Пачка полностью готова.");
    } else if (isBatchOperationCompleted) {
      setMessage("Операция закрыта. Пачка передана дальше.");
    } else {
      setMessage("Частичное выполнение сохранено.");
    }
  }

  const shiftDuration = useMemo(() => {
    if (!shift) return "0 ч";

    const opened = new Date(shift.opened_at).getTime();
    const now = Date.now();
    const minutes = Math.max(Math.floor((now - opened) / 1000 / 60), 0);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h <= 0) return `${m} мин`;
    return `${h} ч ${m} мин`;
  }, [shift]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <div className="text-xl font-semibold text-neutral-700">
          Загрузка...
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="min-h-screen bg-neutral-100 p-4 flex flex-col justify-center">
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="text-sm text-neutral-500 mb-2">Сотрудник</div>

          <h1 className="text-2xl font-bold text-neutral-900 mb-6">
            {employeeName}
          </h1>

          {closingResult && (
            <div className="mb-6 rounded-2xl bg-green-50 border border-green-200 p-4">
              <div className="text-lg font-bold text-green-900 mb-3">
                Итог смены
              </div>

              <div className="text-base text-green-900">
                Сделано: <b>{closingResult.quantity} шт</b>
              </div>

              <div className="text-base text-green-900">
                Заработано: <b>{closingResult.earned.toFixed(2)} ₽</b>
              </div>

              <div className="text-base text-green-900">
                Время работы: <b>{closingResult.hours.toFixed(1)} ч</b>
              </div>
            </div>
          )}

          <button
            onClick={openShift}
            className="w-full h-20 rounded-3xl bg-black text-white text-2xl font-bold active:scale-[0.98]"
          >
            Открыть смену
          </button>

          {message && (
            <div className="mt-4 text-center text-sm text-neutral-600">
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 pb-28">
      <div className="mb-4">
        <div className="text-sm text-neutral-500">Смена открыта</div>
        <h1 className="text-2xl font-bold text-neutral-900">
          {employeeName}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-neutral-500">Сделано</div>
          <div className="text-2xl font-bold">{shift.total_quantity}</div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-neutral-500">Заработано</div>
          <div className="text-2xl font-bold">
            {shift.total_earned.toFixed(0)} ₽
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-neutral-500">Время</div>
          <div className="text-xl font-bold">{shiftDuration}</div>
        </div>
      </div>

      <button
        onClick={scanQr}
        className="w-full h-20 rounded-3xl bg-black text-white text-2xl font-bold mb-5 active:scale-[0.98]"
      >
        Сканировать QR
      </button>

      {message && (
        <div className="mb-4 rounded-2xl bg-white p-4 text-center text-sm text-neutral-700">
          {message}
        </div>
      )}

      <div className="mb-3 text-lg font-bold text-neutral-900">Мои пачки</div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-3xl p-6 text-center text-neutral-500">
          Нет пачек в работе
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const operation = operations[batch.id];
            const completed = batch.completed_quantity || 0;
            const left = Math.max(batch.quantity - completed, 0);

            return (
              <div
                key={batch.id}
                className="bg-white rounded-3xl p-4 shadow-sm"
              >
                <div className="flex justify-between gap-3 mb-2">
                  <div>
                    <div className="text-xl font-bold text-neutral-900">
                      Пачка № {batch.batch_number}
                    </div>

                    <div className="text-sm text-neutral-500">
                      {batch.product_name || "Изделие"}
                      {batch.product_article
                        ? ` · ${batch.product_article}`
                        : ""}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-neutral-500">Осталось</div>
                    <div className="text-2xl font-bold">{left}</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-neutral-100 p-3 mb-4">
                  <div className="text-sm text-neutral-500">Операция</div>
                  <div className="text-lg font-semibold">
                    {operation?.operation_name || "Не найдена"}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-2xl bg-neutral-100 p-3 text-center">
                    <div className="text-xs text-neutral-500">Всего</div>
                    <div className="text-xl font-bold">{batch.quantity}</div>
                  </div>

                  <div className="rounded-2xl bg-neutral-100 p-3 text-center">
                    <div className="text-xs text-neutral-500">Сделано</div>
                    <div className="text-xl font-bold">{completed}</div>
                  </div>

                  <div className="rounded-2xl bg-neutral-100 p-3 text-center">
                    <div className="text-xs text-neutral-500">Осталось</div>
                    <div className="text-xl font-bold">{left}</div>
                  </div>
                </div>

                <button
                  onClick={() => openFinishModal(batch)}
                  className="w-full h-16 rounded-2xl bg-green-600 text-white text-xl font-bold active:scale-[0.98]"
                >
                  Закончить работу
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed left-0 right-0 bottom-0 bg-white border-t border-neutral-200 p-4">
        <button
          onClick={closeShift}
          className="w-full h-16 rounded-2xl bg-red-600 text-white text-xl font-bold active:scale-[0.98]"
        >
          Закрыть смену
        </button>
      </div>

      {selectedBatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-5">
            <div className="text-2xl font-bold mb-2">
              Пачка № {selectedBatch.batch_number}
            </div>

            <div className="text-neutral-500 mb-5">
              Что сделано по этой операции?
            </div>

            {!finishMode && (
              <div className="space-y-3">
                <button
                  onClick={handleAllDoneClick}
                  className="w-full h-16 rounded-2xl bg-green-600 text-white text-xl font-bold"
                >
                  Всё готово
                </button>

                <button
                  onClick={handlePartialClick}
                  className="w-full h-16 rounded-2xl bg-neutral-900 text-white text-xl font-bold"
                >
                  Готово, но не всё
                </button>

                <button
                  onClick={closeFinishModal}
                  className="w-full h-14 rounded-2xl bg-neutral-100 text-neutral-700 text-lg font-semibold"
                >
                  Отмена
                </button>
              </div>
            )}

            {askNextOperation && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-neutral-100 p-4 text-lg font-semibold text-center">
                  Готовы перейти к следующей операции?
                </div>

                <button
                  onClick={() => finishBatch(true)}
                  className="w-full h-16 rounded-2xl bg-green-600 text-white text-xl font-bold"
                >
                  Да
                </button>

                <button
                  onClick={() => {
                    setFinishMode("partial");
                    setAskNextOperation(false);
                  }}
                  className="w-full h-16 rounded-2xl bg-neutral-900 text-white text-xl font-bold"
                >
                  Нет
                </button>

                <button
                  onClick={closeFinishModal}
                  className="w-full h-14 rounded-2xl bg-neutral-100 text-neutral-700 text-lg font-semibold"
                >
                  Отмена
                </button>
              </div>
            )}

            {finishMode === "partial" && !askNextOperation && (
              <div className="space-y-3">
                <input
                  value={partialQty}
                  onChange={(e) => setPartialQty(e.target.value)}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="Сколько штук готово?"
                  className="w-full h-16 rounded-2xl bg-neutral-100 px-5 text-2xl font-bold outline-none"
                />

                <button
                  onClick={() => finishBatch(false)}
                  className="w-full h-16 rounded-2xl bg-green-600 text-white text-xl font-bold"
                >
                  Сохранить
                </button>

                <button
                  onClick={closeFinishModal}
                  className="w-full h-14 rounded-2xl bg-neutral-100 text-neutral-700 text-lg font-semibold"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}