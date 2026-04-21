import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner() {
  const scannerRegionId = useMemo(
    () => `qr-reader-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  async function startScanner() {
    try {
      setErrorMessage("");
      setResult("");
      setIsStarting(true);

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerRegionId);
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        (decodedText) => {
          setResult(decodedText);
        },
        () => {
          // Ошибки промежуточного чтения игнорируем
        }
      );

      setIsScanning(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось запустить камеру";

      setErrorMessage(message);
    } finally {
      setIsStarting(false);
    }
  }

  async function stopScanner() {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }
    } catch {
      // молча игнорируем
    } finally {
      setIsScanning(false);
    }
  }

  async function handleFileScan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage("");
      setResult("");
      setSelectedFileName(file.name);

      const tempScanner = new Html5Qrcode(scannerRegionId);
      const decoded = await tempScanner.scanFile(file, true);
      setResult(decoded);
      await tempScanner.clear();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось прочитать QR с изображения";

      setErrorMessage(message);
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {});
      }
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
        Сначала попробуй кнопку запуска камеры. Если браузер на телефоне не даст
        доступ к камере по локальному IP, ниже можно загрузить фото QR-кода.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
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
          {isStarting ? "Запуск..." : isScanning ? "Камера активна" : "Включить камеру"}
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
        id={scannerRegionId}
        style={{
          width: "100%",
          maxWidth: 420,
          minHeight: 280,
          borderRadius: 16,
          border: "1px dashed #cbd5e1",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        {!isScanning && (
          <div
            style={{
              color: "#64748b",
              textAlign: "center",
              padding: 16,
              lineHeight: 1.5,
            }}
          >
            Область камеры появится здесь
          </div>
        )}
      </div>

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

      {result && (
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
          Результат: {result}
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
          Ошибка: {errorMessage}
        </div>
      )}
    </div>
  );
}