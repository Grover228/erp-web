import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

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

  async function startScanner() {
    try {
      setErrorMessage("");
      setResult("");
      setIsStarting(true);

      await stopAndClearScanner();

      const scanner = await ensureScannerInstance();

      await scanner.start(
        {
          facingMode: { ideal: "environment" },
        },
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        (decodedText) => {
          setResult(decodedText);
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

      setErrorMessage(message);
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
      setResult("");
      setSelectedFileName(file.name);

      await stopAndClearScanner();

      const tempScanner = new Html5Qrcode(scannerRegionId);
      const decoded = await tempScanner.scanFile(file, true);
      setResult(decoded);

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

      setErrorMessage(message);
    }
  }

  useEffect(() => {
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
        Сканер QR 1,1
      </h2>

      <p
        style={{
          marginTop: 0,
          marginBottom: 16,
          color: "#6b7280",
          lineHeight: 1.5,
        }}
      >
        Нажми «Включить камеру». Если камера не покажет изображение или не
        запустится, можно проверить чтение через фото QR-кода.
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