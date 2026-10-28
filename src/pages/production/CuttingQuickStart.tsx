import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import QRCode from "qrcode";
import { supabase } from "../../supabase";

type QuickOrder = {
  id: string;
  order_number: string | null;
  quantity: number;
  status: string;
  product: { name: string; article: string | null } | null;
};

type QuickOperation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  completed_quantity: number;
  price_per_unit: number | null;
  planned_time_min_per_unit: number | null;
  started_at: string | null;
  assigned_user_id: string | null;
};

export type ActiveCutting = {
  id: string;
  name: string;
  orderNumber: string;
};

type Job = {
  order: QuickOrder;
  operation: QuickOperation;
  available: number;
};

type CreatedBatch = {
  id: string;
  productionOrderId: string;
  number: string;
  quantity: number;
  qrDataUrl: string;
  payload: {
    batch_number: string;
    order_number: string;
    product_name: string;
    product_article: string | null;
    color_name: null;
    quantity: number;
  };
};

type PrintJob = {
  id: string;
  status: "pending" | "claimed" | "printed" | "failed";
  created_at: string;
  printed_at: string | null;
  error: string | null;
};

async function findBatchPrintJob(batchId: string): Promise<PrintJob | null> {
  const query = () => supabase
    .from("print_jobs")
    .select("id,status,created_at,printed_at,error")
    .eq("printer_code", "xprinter-main")
    .eq("job_type", "qr")
    .filter("payload->>batchId", "eq", batchId);

  const { data: activeJobs, error: activeError } = await query()
    .in("status", ["pending", "claimed"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (activeError) throw activeError;

  const active = activeJobs?.[0] as PrintJob | undefined;
  if (active) return active;

  const { data: terminalJobs, error: terminalError } = await query()
    .in("status", ["printed", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (terminalError) throw terminalError;

  const rows = (terminalJobs || []) as PrintJob[];
  const printed = rows.find((job) => job.status === "printed");
  const failed = rows.find((job) =>
    job.status === "failed" &&
    !String(job.error || "").startsWith("Дубликат QR-задания для пачки")
  );

  if (failed && (!printed || Date.parse(failed.created_at) > Date.parse(printed.created_at))) {
    return failed;
  }
  return printed || failed || null;
}

type Filter = "Все" | "Раскрой" | "Заготовка" | "Стачивание";

const card: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 16,
  background: "#fff",
  padding: 14,
};
const primary: CSSProperties = {
  border: 0,
  borderRadius: 11,
  background: "#2563eb",
  color: "#fff",
  fontSize: 15,
  fontWeight: 900,
  padding: "14px 12px",
  cursor: "pointer",
};
const secondary: CSSProperties = {
  ...primary,
  border: "1px solid #bfdbfe",
  background: "#f8fbff",
  color: "#2563eb",
};
const muted: CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 700 };
const money = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const initialCutQuantity = (job: Job) =>
  /шапка бини/i.test(job.order.product?.name || "") ? String(Math.min(21, job.available)) : "";
const humanTime = (minutes: number) => {
  const n = Math.max(0, Math.round(minutes));
  return Math.floor(n / 60) + " ч " + (n % 60) + " мин";
};

export default function CuttingQuickStart({
  userId,
  shiftId,
  hasActiveBatch,
  onActiveChange,
  onRefreshShift,
  onOpenScanner,
}: {
  userId: string | null;
  shiftId: string;
  hasActiveBatch: boolean;
  onActiveChange: (operation: ActiveCutting | null) => void;
  onRefreshShift: () => Promise<unknown>;
  onOpenScanner: () => void;
}) {
  const [orders, setOrders] = useState<QuickOrder[]>([]);
  const [operations, setOperations] = useState<QuickOperation[]>([]);
  const [filter, setFilter] = useState<Filter>("Все");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [finishId, setFinishId] = useState<string | null>(null);
  const [finishQuantity, setFinishQuantity] = useState("21");
  const [createdBatch, setCreatedBatch] = useState<CreatedBatch | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [printStatusError, setPrintStatusError] = useState("");
  const printSubmittingRef = useRef(false);
  const createdBatchId = createdBatch?.id ?? null;

  const loadJobs = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError("");
      const { data: rawOrders, error: ordersError } = await supabase
        .from("production_orders")
        .select("id,order_number,quantity,status,product:products(name,article)")
        .in("status", ["draft", "ordered", "in_progress"])
        .order("created_at", { ascending: false });
      if (ordersError) throw ordersError;
      const safeOrders = (rawOrders || []) as QuickOrder[];
      const ids = safeOrders.map((order) => order.id);
      let safeOperations: QuickOperation[] = [];
      if (ids.length) {
        const { data, error: operationsError } = await supabase
          .from("production_order_operations")
          .select("id,production_order_id,operation_name,sort_order,status,completed_quantity,price_per_unit,planned_time_min_per_unit,started_at,assigned_user_id")
          .in("production_order_id", ids)
          .order("sort_order", { ascending: true });
        if (operationsError) throw operationsError;
        safeOperations = (data || []) as QuickOperation[];
      }
      setOrders(safeOrders);
      setOperations(safeOperations);
      const active = safeOperations.find((op) =>
        op.operation_name.toLowerCase().includes("раскро") &&
        op.status === "in_progress" && op.assigned_user_id === userId
      );
      const activeOrder = safeOrders.find((order) => order.id === active?.production_order_id);
      onActiveChange(active && activeOrder ? {
        id: active.id,
        name: activeOrder.product?.name || "Изделие",
        orderNumber: activeOrder.order_number || "",
      } : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить задания");
    } finally {
      setLoading(false);
    }
  }, [userId, onActiveChange]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs, shiftId]);

  useEffect(() => {
    if (!createdBatchId) return;

    let cancelled = false;
    let checking = false;
    const refreshPrintStatus = async () => {
      if (checking) return;
      checking = true;
      try {
        const latest = await findBatchPrintJob(createdBatchId);
        if (!cancelled) {
          setPrintJob(latest);
          setPrintStatusError("");
        }
      } catch (cause) {
        if (!cancelled) {
          setPrintStatusError(cause instanceof Error ? cause.message : "Не удалось проверить статус печати.");
        }
      } finally {
        checking = false;
      }
    };

    void refreshPrintStatus();
    const intervalId = window.setInterval(() => void refreshPrintStatus(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [createdBatchId]);

  const jobs = useMemo((): Job[] => orders.flatMap((order) => {
    const list = operations
      .filter((operation) => operation.production_order_id === order.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const active = list.find((operation) => operation.status === "in_progress");
    const current = active || list.find((operation) =>
      !["done", "cancelled", "archived"].includes(operation.status)
    );
    if (!current) return [];
    const preceding = [...list].reverse().find((op) => op.sort_order < current.sort_order);
    const target = current.sort_order === 1
      ? Number(order.quantity || 0)
      : Number(preceding?.completed_quantity || 0);
    const available = Math.max(0, target - Number(current.completed_quantity || 0));
    return available > 0 ? [{ order, operation: current, available }] : [];
  }), [orders, operations]);

  const running = jobs.find((job) =>
    job.operation.operation_name.toLowerCase().includes("раскро") &&
    job.operation.status === "in_progress" &&
    job.operation.assigned_user_id === userId
  );
  const someOperationRunning = operations.some((operation) =>
    operation.status === "in_progress" && operation.assigned_user_id === userId
  );
  const visible = jobs.filter((job) =>
    filter === "Все" || job.operation.operation_name.toLowerCase().includes(filter.toLowerCase())
  );

  async function startCutting(job: Job) {
    if (!userId || busy) return;
    if (hasActiveBatch || someOperationRunning) {
      setError("Сначала заверши текущую операцию или пачку. Одновременно можно работать только над одним заданием.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      setNotice("");
      const { data: shift, error: shiftError } = await supabase
        .from("employee_shifts")
        .select("id,status,is_paused")
        .eq("id", shiftId)
        .eq("user_id", userId)
        .single();
      if (shiftError) throw shiftError;
      if (shift.status !== "open" || shift.is_paused) {
        throw new Error("Открой смену и выйди из паузы перед началом работы.");
      }
      const { data: current, error: readError } = await supabase
        .from("production_order_operations")
        .select("id,status,completed_quantity,assigned_user_id")
        .eq("id", job.operation.id)
        .single();
      if (readError) throw readError;
      if (current.status === "in_progress" || current.status === "done") {
        throw new Error("Статус операции изменился. Обнови задания.");
      }
      const actualAvailable = Number(job.order.quantity) - Number(current.completed_quantity || 0);
      if (actualAvailable <= 0) throw new Error("Раскрой по этому заказу уже завершён.");
      const now = new Date().toISOString();
      const { data: started, error: updateError } = await supabase
        .from("production_order_operations")
        .update({ status: "in_progress", assigned_user_id: userId, assigned_at: now, started_at: now })
        .eq("id", job.operation.id)
        .eq("status", current.status)
        .eq("completed_quantity", current.completed_quantity)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!started) throw new Error("Операция уже взята другим сотрудником. Обнови задания.");
      if (job.order.status === "draft") {
        const { error: orderError } = await supabase.from("production_orders")
          .update({ status: "in_progress" }).eq("id", job.order.id);
        if (orderError) throw orderError;
      }
      setFinishQuantity(initialCutQuantity({ ...job, available: actualAvailable }));
      setExpandedId(job.operation.id);
      setFinishId(job.operation.id);
      setNotice("Раскрой начат. Время работы учитывается с момента запуска.");
      await loadJobs();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось запустить раскрой");
      await loadJobs();
    } finally {
      setBusy(false);
    }
  }

  async function finishCutting(job: Job) {
    if (!userId || busy) return;
    const qty = Number(finishQuantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > job.available) {
      setError("Укажи целое количество от 1 до " + job.available + " шт.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      setNotice("");
      const { data: shift, error: shiftError } = await supabase
        .from("employee_shifts")
        .select("id,status,is_paused,total_quantity,total_earned")
        .eq("id", shiftId).eq("user_id", userId).single();
      if (shiftError) throw shiftError;
      if (shift.status !== "open" || shift.is_paused) {
        throw new Error("Для завершения раскроя смена должна быть открыта и не на паузе.");
      }
      const { data: op, error: opError } = await supabase
        .from("production_order_operations")
        .select("*").eq("id", job.operation.id).single();
      if (opError) throw opError;
      if (op.status !== "in_progress" || op.assigned_user_id !== userId) {
        throw new Error("Операция больше не закреплена за тобой. Обнови задания.");
      }
      const availableNow = Number(job.order.quantity) - Number(op.completed_quantity || 0);
      if (qty > availableNow) throw new Error("Осталось раскроить только " + availableNow + " шт.");
      const finishedAt = new Date().toISOString();
      const nextCompleted = Number(op.completed_quantity || 0) + qty;
      const nextStatus = nextCompleted >= Number(job.order.quantity) ? "done" : "pending";
      const earned = qty * Number(op.price_per_unit || 0);
      const duration = op.started_at
        ? Math.max(0, Math.floor((Date.now() - new Date(op.started_at).getTime()) / 1000))
        : 0;
      const batchNumber = "PK-" + String(Date.now()).slice(-6);
      const payload: CreatedBatch["payload"] = {
        batch_number: batchNumber,
        order_number: job.order.order_number || job.order.id.slice(0, 8),
        product_name: job.order.product?.name || "Без названия",
        product_article: job.order.product?.article || null,
        color_name: null,
        quantity: qty,
      };
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), { width: 600, margin: 2 });

      // Follow the existing completion order from Production.tsx: operation, log, shift, QR batch, CHZ.
      const { data: updated, error: updateError } = await supabase
        .from("production_order_operations")
        .update({
          status: nextStatus,
          completed_quantity: nextCompleted,
          completed_at: nextStatus === "done" ? finishedAt : null,
          comment: op.operation_name,
        })
        .eq("id", op.id)
        .eq("status", "in_progress")
        .eq("assigned_user_id", userId)
        .eq("completed_quantity", op.completed_quantity)
        .select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Операция уже изменилась. Обнови задания.");

      const { error: logError } = await supabase.from("production_operation_logs").insert({
        production_order_id: job.order.id,
        production_order_operation_id: op.id,
        user_id: userId,
        operation_name: op.operation_name,
        quantity: qty,
        price_per_unit: Number(op.price_per_unit || 0),
        earned_amount: earned,
        started_at: op.started_at,
        finished_at: finishedAt,
        duration_seconds: duration,
      });
      if (logError) throw logError;

      const { error: shiftUpdateError } = await supabase.from("employee_shifts").update({
        total_quantity: Number(shift.total_quantity || 0) + qty,
        total_earned: Number(shift.total_earned || 0) + earned,
      }).eq("id", shiftId);
      if (shiftUpdateError) throw shiftUpdateError;

      const { data: batch, error: batchError } = await supabase.from("production_batches")
        .insert({
          production_order_id: job.order.id,
          source_operation_id: op.id,
          batch_number: batchNumber,
          quantity: qty,
          completed_quantity: 0,
          current_operation_order: 2,
          status: "waiting",
          qr_code: batchNumber,
          product_name: payload.product_name,
          product_article: payload.product_article,
          color_name: payload.color_name,
          qr_payload: payload,
        })
        .select("id").single();
      if (batchError) throw batchError;
      if (!batch?.id) throw new Error("Пачка создана без идентификатора.");

      let chzWarning = "";
      try {
        const { error: chzError } = await supabase.rpc("allocate_chz_codes_to_batch", {
          p_batch_id: batch.id, p_quantity: qty,
        });
        if (chzError) throw chzError;
      } catch (cause) {
        chzWarning = " Коды ЧЗ не выделены: " +
          (cause instanceof Error ? cause.message : "ошибка распределения") + ".";
      }
      setPrintJob(null);
      setPrintStatusError("");
      setCreatedBatch({ id: batch.id, productionOrderId: job.order.id, number: batchNumber, quantity: qty, payload, qrDataUrl });
      setFinishId(null);
      setExpandedId(null);
      setNotice("Раскрой сохранён: " + qty + " шт. Пачка " + batchNumber +
        " создана. Заработано: " + money(earned) + " ₽." + chzWarning);
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "Ошибка завершения раскроя") +
        " Если сохранение прервалось, проверь данные перед повтором.");
    } finally {
      await Promise.allSettled([loadJobs(), onRefreshShift()]);
      setBusy(false);
    }
  }

  async function printBatchQr(forceReprint = false) {
    if (!createdBatch || busy || printSubmittingRef.current) return;
    printSubmittingRef.current = true;
    try {
      setBusy(true);
      setError("");
      setPrintStatusError("");

      // Reuse an existing active job instead of adding duplicate QR jobs.
      const existing = await findBatchPrintJob(createdBatch.id);
      if (existing?.status === "pending" || existing?.status === "claimed") {
        setPrintJob(existing);
        setNotice(existing.status === "claimed"
          ? "Принтер уже забрал QR пачки " + createdBatch.number + ". Дождись результата."
          : "QR пачки " + createdBatch.number + " уже стоит в очереди. Повторное задание не создано.");
        return;
      }
      if (existing?.status === "printed" && !forceReprint) {
        setPrintJob(existing);
        setNotice("Сервер уже подтвердил печать QR пачки " + createdBatch.number +
          ". Если этикетка физически не вышла, нажми «Печать повторно».");
        return;
      }

      const { data: queued, error: queueError } = await supabase.from("print_jobs").insert({
        printer_code: "xprinter-main",
        job_type: "qr",
        payload: {
          printerName: "Xprinter XP-365B",
          batchNumber: createdBatch.number,
          productName: createdBatch.payload.product_name,
          article: createdBatch.payload.product_article || "",
          quantity: createdBatch.quantity,
          qrDataUrl: createdBatch.qrDataUrl,
          batchId: createdBatch.id,
          productionOrderId: createdBatch.productionOrderId,
        },
      }).select("id,status,created_at,printed_at,error").single();
      if (queueError) throw queueError;
      setPrintJob(queued as PrintJob);
      setNotice("QR пачки " + createdBatch.number + " поставлен в очередь. Статус обновляется автоматически.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось поставить QR в очередь.");
    } finally {
      printSubmittingRef.current = false;
      setBusy(false);
    }
  }

  const filterOptions: Filter[] = ["Все", "Раскрой", "Заготовка", "Стачивание"];
  const selectedId = visible.some((job) => job.operation.id === expandedId)
    ? expandedId
    : (running && visible.some((job) => job.operation.id === running.operation.id)
      ? running.operation.id : visible[0]?.operation.id);
  return (
    <section style={{ ...card, marginTop: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 19, fontWeight: 900, color: "#0f172a" }}>Доступные задания</div>
        <button type="button" style={{ ...secondary, padding: "8px 10px" }}
          onClick={() => void loadJobs()} disabled={busy || loading} aria-label="Обновить задания">↻</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "12px 0" }}>
        {filterOptions.map((item) => (
          <button key={item} type="button" onClick={() => { setFilter(item); setExpandedId(null); }} style={{
            ...secondary, flexShrink: 0, padding: "10px 9px", fontSize: 12,
            background: filter === item ? "#2563eb" : "#fff",
            borderColor: filter === item ? "#2563eb" : "#dbeafe",
            color: filter === item ? "#fff" : "#1d4ed8",
          }}>{item} <span style={{ opacity: 0.85 }}>{
            item === "Все" ? jobs.length : jobs.filter((job) =>
              job.operation.operation_name.toLowerCase().includes(item.toLowerCase())).length
          }</span></button>
        ))}
      </div>
      {loading && <div style={muted}>Обновление заданий...</div>}
      {error && <div role="alert" style={{ ...card, marginBottom: 10, color: "#991b1b", background: "#fef2f2", borderColor: "#fecaca" }}>{error}</div>}
      {notice && <div role="status" style={{ ...card, marginBottom: 10, color: "#166534", background: "#f0fdf4", borderColor: "#bbf7d0" }}>{notice}</div>}
      {createdBatch && <div style={{ ...card, marginBottom: 10, background: "#f8fbff" }}>
        <b>Пачка {createdBatch.number} · {createdBatch.quantity} шт.</b>
        <button type="button"
          disabled={busy || printJob?.status === "pending" || printJob?.status === "claimed"}
          style={{ ...primary, display: "block", width: "100%", marginTop: 10,
            opacity: busy || printJob?.status === "pending" || printJob?.status === "claimed" ? 0.7 : 1 }}
          onClick={() => void printBatchQr(printJob?.status === "printed")}>
          {printJob?.status === "pending" ? "QR в очереди печати…" :
            printJob?.status === "claimed" ? "Принтер печатает…" :
              printJob?.status === "printed" ? "Печать повторно" :
                printJob?.status === "failed" ? "Повторить печать QR" : "Печать QR пачки"}
        </button>
        {printJob && <div role="status" style={{ ...muted, marginTop: 8,
          color: printJob.status === "failed" ? "#991b1b" : "#334155" }}>
          {printJob.status === "pending" ? "В очереди. Если статус не меняется, проверь, что локальный сервер печати запущен." :
            printJob.status === "claimed" ? "Сервер принтера забрал задание. Ожидаем подтверждение." :
              printJob.status === "printed" ? "Локальный сервер подтвердил отправку этикетки на принтер." :
                "Ошибка печати: " + (printJob.error || "причина не указана")}
        </div>}
        {printStatusError && <div role="alert" style={{ ...muted, marginTop: 8, color: "#991b1b" }}>
          Не удалось проверить статус печати: {printStatusError}
        </div>}
      </div>}
      {!loading && visible.length === 0 && <div style={{ ...muted, padding: "12px 0" }}>
        Нет доступных заданий в этой категории.
      </div>}
      <div style={{ display: "grid", gap: 10 }}>
        {visible.map((job) => {
          const cutting = job.operation.operation_name.toLowerCase().includes("раскро");
          const mine = job.operation.status === "in_progress" && job.operation.assigned_user_id === userId;
          const blocked = job.operation.status === "in_progress" && !mine;
          const done = Number(job.operation.completed_quantity || 0);
          const progress = Math.round(100 * done / Math.max(1, Number(job.order.quantity)));
          const name = job.order.product?.name || "Изделие";
          if (job.operation.id !== selectedId) {
            return <button key={job.operation.id} type="button"
              onClick={() => { setExpandedId(job.operation.id); setFinishId(null); }}
              style={{
                ...card, width: "100%", textAlign: "left", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                color: "#0f172a",
              }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14 }}>{name}</div>
                <div style={{ ...muted, marginTop: 4 }}>{job.order.order_number || "Заказ"} · {job.operation.operation_name}</div>
                <div style={{ ...muted, marginTop: 5 }}>Осталось: {job.available} шт. · Выполнено: {progress}%</div>
              </div>
              <span style={{ color: "#2563eb", fontSize: 22, flexShrink: 0 }}>›</span>
            </button>;
          }
          return <div key={job.operation.id} style={{ ...card, background: cutting ? "#f8fbff" : "#fff" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
              <div>
                <div style={{ fontSize: 16, color: "#0f172a", fontWeight: 900 }}>{name}</div>
                <div style={{ ...muted, marginTop: 3 }}>{job.order.order_number || "Заказ"}</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 800, borderRadius: 8, padding: "6px 8px", flexShrink: 0,
                background: blocked ? "#fef3c7" : mine ? "#dbeafe" : "#dcfce7",
                color: blocked ? "#92400e" : mine ? "#1d4ed8" : "#166534",
              }}>{blocked ? "Занято" : mine ? "В работе" : "Доступно"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontWeight: 800, fontSize: 14 }}>
              <span style={{ background: "#eff6ff", padding: 7, borderRadius: 10 }}>{cutting ? "✂" : "▣"}</span>
              <div><span style={muted}>Этап</span><div>{job.operation.operation_name}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6, marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
              {[
                ["Заказано", Number(job.order.quantity || 0)],
                ["Готово", done],
                ["Осталось", job.available],
              ].map(([label, value]) => <div key={String(label)}>
                <div style={muted}>{label}</div>
                <div style={{ fontWeight: 900, color: label === "Готово" ? "#16a34a" : "#0f172a", marginTop: 4 }}>
                  {value} шт
                </div>
              </div>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 9 }}>
              <span style={muted}>План: {humanTime(job.available * Number(job.operation.planned_time_min_per_unit || 0))}</span>
              <span style={muted}>Выполнено: {progress}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 6, background: "#dbeafe", marginTop: 7, overflow: "hidden" }}>
              <div style={{ width: progress + "%", height: "100%", background: "#16a34a" }} />
            </div>
            {cutting && !mine && <button type="button" style={{ ...primary, width: "100%", marginTop: 12 }}
              disabled={busy || blocked || hasActiveBatch || someOperationRunning}
              onClick={() => void startCutting(job)}>▶ Начать раскрой</button>}
            {cutting && mine && <button type="button" style={{ ...primary, width: "100%", marginTop: 12 }}
              disabled={busy} onClick={() => {
                setFinishId(finishId === job.operation.id ? null : job.operation.id);
                setFinishQuantity(initialCutQuantity(job));
              }}>✓ Закончить раскрой</button>}
            {cutting && mine && finishId === job.operation.id && <div style={{ ...card, marginTop: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Сколько раскроено?</div>
              <div style={{ ...muted, margin: "6px 0" }}>{/шапка бини/i.test(name) ? "Для бини одна линия обычно 21 шт. " : ""}Доступно: {job.available} шт.</div>
              <input type="number" min={1} max={job.available} step={1} value={finishQuantity}
                onChange={(event) => setFinishQuantity(event.target.value)} style={{
                  boxSizing: "border-box", width: "100%", padding: 12, fontSize: 24,
                  fontWeight: 900, borderRadius: 10, border: "1px solid #bfdbfe",
                  textAlign: "center",
                }} />
              <button type="button" disabled={busy} style={{ ...primary, width: "100%", marginTop: 10 }}
                onClick={() => void finishCutting(job)}>Сохранить раскрой и создать пачку</button>
            </div>}
            {!cutting && <button type="button" style={{ ...secondary, width: "100%", marginTop: 12 }}
              disabled={busy || hasActiveBatch || someOperationRunning}
              onClick={onOpenScanner}>Сканировать QR пачки</button>}
            <div style={{ ...muted, marginTop: 8, textAlign: "center" }}>
              {cutting ? "Раскрой доступен без QR. На следующих этапах используется сканер." :
                "Для этого этапа нужно отсканировать QR пачки и при необходимости корзину."}
            </div>
          </div>;
        })}
      </div>
    </section>
  );
}
