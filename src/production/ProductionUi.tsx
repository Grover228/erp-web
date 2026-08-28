import type { CSSProperties, ReactNode } from "react";
import type { GeneratedQr } from "./productionTypes";

export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#dcfce7",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: "#16a34a",
          borderRadius: 999,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

export function QrCard({
  item,
  onPrint,
}: {
  item: GeneratedQr;
  onPrint?: (item: GeneratedQr) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <img
        src={item.dataUrl}
        alt="QR-код пачки"
        style={{
          width: 180,
          height: 180,
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #dbeafe",
        }}
      />

      <div style={{ color: "#374151", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 800, color: "#111827" }}>
          Пачка: {item.batchNumber}
        </div>

        <div>Заказ: {item.payload.order_number}</div>
        <div>Изделие: {item.payload.product_name}</div>
        <div>Артикул: {item.payload.product_article || "—"}</div>
        <div>Цвет: {item.payload.color_name || "—"}</div>
        <div>Количество в пачке: {item.payload.quantity} шт</div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <a
            href={item.dataUrl}
            download={`${item.batchNumber}.png`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Скачать QR
          </a>

          {onPrint && (
            <button
              onClick={() => onPrint(item)}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Печать QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

export function tabButtonStyle(active: boolean): CSSProperties {
  return {
    background: active ? "#2563eb" : "#eff6ff",
    color: active ? "#fff" : "#1d4ed8",
    border: active ? "1px solid #2563eb" : "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

export function secondaryBlueButtonStyle(): CSSProperties {
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

export const primaryBlueButtonStyle: CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

export const primaryGreenButtonStyle: CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

export const dangerButtonStyle: CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

export const emptyStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 16,
  color: "#64748b",
  background: "#f8fbff",
  fontWeight: 600,
};

export const emptySmallStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 600,
};

export const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

export const stackedModalOverlayStyle: CSSProperties = {
  ...modalOverlayStyle,
  zIndex: 12000,
  background: "rgba(15, 23, 42, 0.58)",
};

export const modalBoxStyle: CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbeafe",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  padding: 20,
};

export const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 16,
};

export const modalTitleStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#111827",
};

export const closeButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 20,
  color: "#0f172a",
};

export const inputStyle: CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
};
