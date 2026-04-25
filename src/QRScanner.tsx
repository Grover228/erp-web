import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { supabase } from "./supabase";

type CameraItem = {
  id: string;
  label: string;
};

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
  current_operation_order: number | null;
  status: string | null;
  qr_code: string | null;
  product_name: string | null;
  product_article: string | null;
  color_name: string | null;
  qr_payload: QrPayload | null;
  comment: string | null;
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
    const parsed = JSON.parse(text) as QrPayload;
    return parsed;
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

export default function QRScanner() {
  const scannerRegionId = useMemo(
    () => `qr-reader-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef("");

  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");

  const [loadingBatch, setLoadingBatch] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [scannedBatchData, setScannedBatchData] =
    useState<ScannedBatchData | null>(null);

  async function loadCameras() {
    try {
      const devices = await Html5Qrcode.getCameras();

      const mapped = devices.map((cam) => ({
        id: cam.id,
        label: cam.label || `Камера ${cam.id}`,
      }));

      setCameras(mapped);

      if (mapped.length > 0 && !selectedCameraId) {
        const backCamera =
          mapped.find((cam) => cam.label.toLowerCase().includes("back")) ||
          mapped.find((cam) => cam.label.toLowerCase().includes("rear")) ||
          mapped.find((cam) =>
            cam.label.toLowerCase().includes("environment")
          ) ||
          mapped[0];

        setSelectedCameraId(backCamera.id);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось получить список камер";

      setErrorMessage(`Ошибка получения камер: ${message}`);
    }
  }

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

    setResult(decodedText);
    await stopScanner();
    await findBatchByQr(decodedText);
  }

  async function startScanner() {
    try {
      setErrorMessage("");
      setSuccessMessage("");
      setResult("");
      setScannedBatchData(null);
      setIsStarting(true);
      lastScannedRef.current = "";

      await stopAndClearScanner();

      if (!selectedCameraId) {
        await loadCameras();
      }

      const cameraIdToUse = selectedCameraId || cameras[0]?.id;

      if (!cameraIdToUse) {
        throw new Error(
          "Камеры не найдены. Проверь разрешение на камеру в браузере."
        );
      }

      const scanner = await ensureScannerInstance();

      await scanner.start(
        cameraIdToUse,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
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
      setIsStarting(false);
    }
  }

  async function stopScanner() {
    await stopAndClearScanner();
    setIsScanning(false);
  }

  async function handleFileScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage("");
      setSuccessMessage("");
      setResult("");
      setScannedBatchData(null);
      setSelectedFileName(file.name);
      lastScannedRef.current = "";

      await stopAndClearScanner();

      const tempScanner = new Html5Qrcode(scannerRegionId);
      const decoded = await tempScanner.scanFile(file, true);
      setResult(decoded);
      await findBatchByQr(decoded);

      try {
        await tempScanner.clear();
      } catch {
        // игнорируем
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось прочитать QR с изображения";

      setErrorMessage(`Ошибка файла: ${message}`);
    }
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

    if (operation.status === "in_progress") {
      setErrorMessage("Эта операция уже находится в работе.");
      return;
    }

    if (operation.status === "done") {
      setErrorMessage("Эта операция уже завершена.");
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

      const { error: batchError } = await supabase
        .from("production_batches")
        .update({
          status: "in_progress",
        })
        .eq("id", batch.id);

      if (batchError) throw batchError;

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

      setScannedBatchData({
        ...scannedBatchData,
        batch: {
          ...batch,
          status: "in_progress",
        },
        operation: {
          ...operation,
          status: "in_progress",
          assigned_user_id: user?.id || null,
          assigned_at: now,
          started_at: now,
        },
        order: order
          ? {
              ...order,
              status: order.status === "draft" ? "in_progress" : order.status,
            }
          : order,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось взять пачку в работу";

      setErrorMessage(message);
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadCameras();

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
        Сканируй QR-код пачки. После чтения система найдёт пачку и предложит
        взять её в работу.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <select
          value={selectedCameraId}
          onChange={(e) => setSelectedCameraId(e.target.value)}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: "12px 14px",
            background: "#fff",
            color: "#111827",
            minWidth: 220,
          }}
        >
          <option value="">Выбери камеру</option>
          {cameras.map((camera) => (
            <option key={camera.id} value={camera.id}>
              {camera.label}
            </option>
          ))}
        </select>

        <button
          onClick={startScanner}
          disabled={isStarting || isScanning}
          style={{
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            background: isStarting || isScanning ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: isStarting || isScanning ? "default" : "pointer",
          }}
        >
          {isStarting
            ? "Запуск..."
            : isScanning
            ? "Камера активна"
            : "Включить камеру"}
        </button>

        <button
          onClick={stopScanner}
          disabled={!isScanning}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: "12px 16px",
            background: !isScanning ? "#f3f4f6" : "#fff",
            color: "#111827",
            fontWeight: 700,
            cursor: !isScanning ? "default" : "pointer",
          }}
        >
          Остановить
        </button>

        <button
          onClick={loadCameras}
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: "12px 16px",
            background: "#fff",
            color: "#111827",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Обновить камеры
        </button>

        <label
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 12,
            padding: "12px 16px",
            background: "#fff",
            color: "#111827",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Загрузить фото QR
          <input
            type="file"
            accept="image/*"
            onChange={handleFileScan}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          marginBottom: 16,
        }}
      >
        <div
          id={scannerRegionId}
          style={{
            width: "100%",
            minHeight: 320,
            borderRadius: 16,
            border: "2px solid #cbd5e1",
            background: "#0f172a",
            overflow: "hidden",
            position: "relative",
          }}
        />

        {!isScanning && (
          <div
            style={{
              marginTop: 10,
              color: "#64748b",
              fontSize: 14,
            }}
          >
            После запуска здесь должно появиться изображение с камеры.
          </div>
        )}
      </div>

      {cameras.length > 0 && (
        <div
          style={{
            marginBottom: 12,
            color: "#475569",
            fontSize: 14,
          }}
        >
          Найдено камер: {cameras.length}
        </div>
      )}

      {selectedFileName && (
        <div
          style={{
            marginBottom: 12,
            color: "#475569",
            fontSize: 14,
          }}
        >
          Загружен файл: {selectedFileName}
        </div>
      )}

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

      {scannedBatchData && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "#f8fbff",
            border: "1px solid #bfdbfe",
            marginBottom: 12,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
            Пачка {scannedBatchData.batch.batch_number}
          </div>

          <div style={{ color: "#334155", lineHeight: 1.7 }}>
            <div>
              Заказ: {scannedBatchData.order?.order_number || "—"}
            </div>
            <div>
              Изделие:{" "}
              {scannedBatchData.batch.product_name ||
                scannedBatchData.order?.product?.name ||
                "—"}
            </div>
            <div>
              Артикул:{" "}
              {scannedBatchData.batch.product_article ||
                scannedBatchData.order?.product?.article ||
                "—"}
            </div>
            <div>Цвет: {scannedBatchData.batch.color_name || "—"}</div>
            <div>Количество в пачке: {scannedBatchData.batch.quantity} шт</div>
            <div>Статус пачки: {getStatusLabel(scannedBatchData.batch.status)}</div>
            <div>
              Следующая операция:{" "}
              {scannedBatchData.operation
                ? `${scannedBatchData.operation.sort_order}. ${scannedBatchData.operation.operation_name}`
                : "операция не найдена"}
            </div>
            <div>
              Статус операции: {getStatusLabel(scannedBatchData.operation?.status)}
            </div>
          </div>

          {scannedBatchData.operation &&
            scannedBatchData.operation.status !== "in_progress" &&
            scannedBatchData.operation.status !== "done" && (
              <button
                onClick={handleTakeBatchToWork}
                disabled={actionLoading}
                style={{
                  border: "none",
                  borderRadius: 12,
                  padding: "14px 18px",
                  background: actionLoading ? "#93c5fd" : "#2563eb",
                  color: "#ffffff",
                  fontWeight: 800,
                  cursor: actionLoading ? "default" : "pointer",
                  width: "fit-content",
                }}
              >
                {actionLoading ? "Сохраняю..." : "Взять пачку в работу"}
              </button>
            )}
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

      {result && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            color: "#475569",
            fontWeight: 600,
            wordBreak: "break-word",
            marginBottom: 12,
          }}
        >
          Прочитанный QR: {result}
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
    </div>
  );
}