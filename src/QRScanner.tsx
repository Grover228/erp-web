import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { supabase } from "./supabase";

type QrPayload = {
  batch_number?: string;
  order_number?: string;
  product_name?: string;
  product_article?: string | null;
  color_name?: string | null;
  quantity?: number;
};

type BatchInfo = {
  id: string;
  production_order_id: string;
  source_operation_id: string | null;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  current_operation_order: number | null;
  status: string | null;
  qr_code: string | null;
  product_name: string | null;
  product_article: string | null;
  color_name: string | null;
  qr_payload: QrPayload | null;
  comment: string | null;
  assigned_user_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type ProductionOrderInfo = {
  id: string;
  order_number: string | null;
  quantity: number;
  status: string;
  product?: {
    name: string;
    article: string | null;
  } | null;
};

type OperationInfo = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  assigned_user_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_quantity: number;
  price_per_unit: number | null;
};

type ScannedBatchData = {
  batch: BatchInfo;
  order: ProductionOrderInfo | null;
  operation: OperationInfo | null;
};

function parseQrText(text: string): QrPayload {
  try {
    return JSON.parse(text) as QrPayload;
  } catch {
    return {
      batch_number: text.trim(),
    };
  }
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
    default:
      return status || "—";
  }
}

export default function QRScanner({
  onTakenToWork,
}: {
  onTakenToWork?: () => void;
}) {
  const scannerRegionId = useMemo(
    () => `qr-reader-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef("");
  const isStartingRef = useRef(false);

  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [loadingBatch, setLoadingBatch] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannedBatchData, setScannedBatchData] =
    useState<ScannedBatchData | null>(null);

  async function ensureScannerInstance() {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(scannerRegionId);
    }

    return scannerRef.current;
  }

  async function stopAndClearScanner() {
    if (!scannerRef.current) return;

    try {
      const state = scannerRef.current.getState();

      if (
        state === Html5QrcodeScannerState.SCANNING ||
        state === Html5QrcodeScannerState.PAUSED
      ) {
        await scannerRef.current.stop();
      }
    } catch {
      // игнорируем
    }

    try {
      await scannerRef.current.clear();
    } catch {
      // игнорируем
    }

    scannerRef.current = null;
    setIsScanning(false);
  }

  async function pauseScannerAfterScan() {
    try {
      if (!scannerRef.current) return;

      const state = scannerRef.current.getState();

      if (state === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.pause(true);
      }

      setIsScanning(false);
    } catch {
      await stopAndClearScanner();
    }
  }

  async function resumeScanner() {
    try {
      if (!scannerRef.current) {
        await startScanner();
        return;
      }

      const state = scannerRef.current.getState();

      if (state === Html5QrcodeScannerState.PAUSED) {
        scannerRef.current.resume();
        setIsScanning(true);
        lastScannedRef.current = "";
      }
    } catch {
      await startScanner();
    }
  }

  async function findBatchByQr(decodedText: string) {
    try {
      setLoadingBatch(true);
      setActionLoading(false);
      setErrorMessage("");
      setSuccessMessage("");
      setScannedBatchData(null);

      const payload = parseQrText(decodedText);
      const batchNumber = payload.batch_number?.trim();

      if (!batchNumber) {
        throw new Error("В QR-коде не найден номер пачки batch_number");
      }

      const { data: batchData, error: batchError } = await supabase
        .from("production_batches")
        .select("*")
        .eq("batch_number", batchNumber)
        .maybeSingle();

      if (batchError) throw batchError;

      if (!batchData) {
        throw new Error(`Пачка ${batchNumber} не найдена в базе`);
      }

      const batch = batchData as BatchInfo;

      const [orderResult, operationsResult] = await Promise.all([
        supabase
          .from("production_orders")
          .select(
            `
            id,
            order_number,
            quantity,
            status,
            product:products (
              name,
              article
            )
          `
          )
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

      const order = (orderResult.data as ProductionOrderInfo | null) || null;
      const operations = (operationsResult.data as OperationInfo[]) || [];

      const currentOperationOrder = Number(batch.current_operation_order || 0);

      const operation =
        operations.find((item) => item.sort_order === currentOperationOrder) ||
        null;

      setScannedBatchData({
        batch,
        order,
        operation,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось обработать QR-код";

      setErrorMessage(message);
    } finally {
      setLoadingBatch(false);
    }
  }

  async function handleDecodedText(decodedText: string) {
    if (!decodedText.trim()) return;

    if (lastScannedRef.current === decodedText) return;
    lastScannedRef.current = decodedText;

    await pauseScannerAfterScan();
    await findBatchByQr(decodedText);
  }

  async function startScanner() {
    if (isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      setErrorMessage("");
      setSuccessMessage("");
      setScannedBatchData(null);
      setIsStarting(true);
      lastScannedRef.current = "";

      await stopAndClearScanner();

      const scanner = await ensureScannerInstance();

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // промежуточные ошибки чтения игнорируем
        }
      );

      setIsScanning(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запустить камеру";

      setErrorMessage(`Ошибка камеры: ${message}`);
      setIsScanning(false);
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  }

  async function handleCloseModal() {
    setScannedBatchData(null);
    setErrorMessage("");
    setSuccessMessage("");
    await resumeScanner();
  }

  async function handleTakeBatchToWork() {
    if (!scannedBatchData) return;

    const { batch, order, operation } = scannedBatchData;

    if (!operation) {
      setErrorMessage(
        "Не найдена операция для этой пачки. Проверь current_operation_order в production_batches."
      );
      return;
    }

    if (batch.status === "in_progress") {
      setErrorMessage("Эта пачка уже находится в работе.");
      return;
    }

    if (batch.status === "done") {
      setErrorMessage("Эта пачка уже завершена на текущей операции.");
      return;
    }

    try {
      setActionLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const now = new Date().toISOString();

      const { error: batchError } = await supabase
        .from("production_batches")
        .update({
          status: "in_progress",
          assigned_user_id: user?.id || null,
          assigned_at: now,
          started_at: now,
        })
        .eq("id", batch.id);

      if (batchError) throw batchError;

      if (operation.status !== "in_progress") {
        const { error: operationError } = await supabase
          .from("production_order_operations")
          .update({
            status: "in_progress",
            assigned_user_id: user?.id || null,
            assigned_at: now,
            started_at: now,
          })
          .eq("id", operation.id);

        if (operationError) throw operationError;
      }

      if (order?.status === "draft") {
        const { error: orderError } = await supabase
          .from("production_orders")
          .update({
            status: "in_progress",
          })
          .eq("id", order.id);

        if (orderError) throw orderError;
      }

      setSuccessMessage(
        `Пачка ${batch.batch_number} взята в работу: ${operation.operation_name}`
      );

      window.setTimeout(() => {
        onTakenToWork?.();
      }, 500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось взять пачку в работу";

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  const modalBatch = scannedBatchData?.batch || null;
  const modalOperation = scannedBatchData?.operation || null;

  const batchQuantity = Number(modalBatch?.quantity || 0);
  const batchCompleted = Number(modalBatch?.completed_quantity || 0);
  const batchLeft = Math.max(0, batchQuantity - batchCompleted);

  useEffect(() => {
    startScanner();

    return () => {
      stopAndClearScanner().catch(() => {});
    };
  }, []);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: 20,
        border: "1px solid #e5e7eb",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 8,
          fontSize: 28,
          color: "#111827",
        }}
      >
        Сканер QR
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: 16,
          color: "#6b7280",
          lineHeight: 1.5,
        }}
      >
        Наведи камеру на QR-код пачки. Камера запускается автоматически.
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          marginBottom: 16,
        }}
      >
        <div
          id={scannerRegionId}
          style={{
            width: "100%",
            minHeight: 360,
            borderRadius: 18,
            border: "2px solid #cbd5e1",
            background: "#0f172a",
            overflow: "hidden",
            position: "relative",
          }}
        />

        <div
          style={{
            marginTop: 10,
            color: isScanning ? "#166534" : "#64748b",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {isStarting
            ? "Запускаю камеру..."
            : isScanning
            ? "Камера активна. Наведи на QR-код."
            : "Камера временно остановлена."}
        </div>
      </div>

      {loadingBatch && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1d4ed8",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          Ищу пачку в базе...
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "#dcfce7",
            border: "1px solid #86efac",
            color: "#166534",
            fontWeight: 700,
            wordBreak: "break-word",
            marginBottom: 12,
          }}
        >
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            wordBreak: "break-word",
            lineHeight: 1.5,
          }}
        >
          {errorMessage}
        </div>
      )}

      {scannedBatchData && modalBatch && (
        <div
          onClick={handleCloseModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: 22,
              padding: 20,
              border: "1px solid #bfdbfe",
              boxShadow: "0 22px 50px rgba(15, 23, 42, 0.25)",
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  Пачка {modalBatch.batch_number}
                </div>

                <div style={{ marginTop: 4, color: "#64748b" }}>
                  QR успешно прочитан
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontSize: 20,
                  color: "#0f172a",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <InfoBox
                label="Заказ"
                value={scannedBatchData.order?.order_number || "—"}
              />

              <InfoBox
                label="Изделие"
                value={
                  modalBatch.product_name ||
                  scannedBatchData.order?.product?.name ||
                  "—"
                }
              />

              <InfoBox
                label="Артикул"
                value={
                  modalBatch.product_article ||
                  scannedBatchData.order?.product?.article ||
                  "—"
                }
              />

              <InfoBox label="Цвет" value={modalBatch.color_name || "—"} />

              <InfoBox label="Всего в пачке" value={`${batchQuantity} шт`} />

              <InfoBox label="Уже сделано" value={`${batchCompleted} шт`} />

              <InfoBox label="Осталось" value={`${batchLeft} шт`} />

              <InfoBox
                label="Статус пачки"
                value={getStatusLabel(modalBatch.status)}
              />

              <InfoBox
                label="Операция"
                value={
                  modalOperation
                    ? `${modalOperation.sort_order}. ${modalOperation.operation_name}`
                    : "операция не найдена"
                }
              />
            </div>

            {modalBatch.status !== "in_progress" &&
              modalBatch.status !== "done" &&
              modalOperation && (
                <button
                  onClick={handleTakeBatchToWork}
                  disabled={actionLoading}
                  style={{
                    border: "none",
                    borderRadius: 14,
                    padding: "16px 18px",
                    background: actionLoading ? "#93c5fd" : "#2563eb",
                    color: "#ffffff",
                    fontWeight: 900,
                    cursor: actionLoading ? "default" : "pointer",
                    width: "100%",
                    fontSize: 17,
                  }}
                >
                  {actionLoading ? "Сохраняю..." : "Взять пачку в работу"}
                </button>
              )}

            {modalBatch.status === "in_progress" && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  fontWeight: 700,
                }}
              >
                Эта пачка уже находится в работе.
              </div>
            )}

            {modalBatch.status === "done" && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#166534",
                  fontWeight: 700,
                }}
              >
                Эта пачка уже завершена на текущей операции.
              </div>
            )}

            {!modalOperation && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  fontWeight: 700,
                }}
              >
                Не найдена операция для этой пачки.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 800, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}