import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

type DocumentType = "supplier_order" | "supplier_receipt";

type SupplierOrderLink = {
  id: string;
  order_number: string | null;
  order_date: string;
  supplier_name: string | null;
  status: string;
  total_amount: number;
};

type SupplierReceiptLink = {
  id: string;
  supplier_order_id: string | null;
  receipt_number: string | null;
  receipt_date: string;
  supplier_name: string | null;
  status: string;
  total_amount: number;
};

type LinkedDocumentsModalProps = {
  sourceType: DocumentType;
  sourceId: string;
  supplierOrderId?: string | null;
  onClose: () => void;
};

export default function LinkedDocumentsModal({
  sourceType,
  sourceId,
  supplierOrderId,
  onClose,
}: LinkedDocumentsModalProps) {
  const [order, setOrder] = useState<SupplierOrderLink | null>(null);
  const [receipts, setReceipts] = useState<SupplierReceiptLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLinkedDocuments();
  }, [sourceType, sourceId, supplierOrderId]);

  async function loadLinkedDocuments() {
    try {
      setLoading(true);
      setError("");

      let resolvedOrderId = supplierOrderId || null;

      if (sourceType === "supplier_order") {
        resolvedOrderId = sourceId;
      }

      if (sourceType === "supplier_receipt" && !resolvedOrderId) {
        const { data: receiptData, error: receiptError } = await supabase
          .from("supplier_receipts")
          .select("supplier_order_id")
          .eq("id", sourceId)
          .single();

        if (receiptError) throw receiptError;

        resolvedOrderId = receiptData?.supplier_order_id || null;
      }

      if (!resolvedOrderId) {
        setOrder(null);
        setReceipts([]);
        return;
      }

      const [orderResult, receiptsResult] = await Promise.all([
        supabase
          .from("supplier_orders")
          .select("id, order_number, order_date, supplier_name, status, total_amount")
          .eq("id", resolvedOrderId)
          .single(),
        supabase
          .from("supplier_receipts")
          .select("id, supplier_order_id, receipt_number, receipt_date, supplier_name, status, total_amount")
          .eq("supplier_order_id", resolvedOrderId)
          .order("created_at", { ascending: true }),
      ]);

      if (orderResult.error) throw orderResult.error;
      if (receiptsResult.error) throw receiptsResult.error;

      setOrder(orderResult.data as SupplierOrderLink);
      setReceipts((receiptsResult.data as SupplierReceiptLink[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки связанных документов",
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "ordered") return "Заказан";
    if (status === "received") return "Поступил";
    if (status === "posted") return "Проведён";
    if (status === "cancelled") return "Отменён";
    return status || "—";
  }

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function handleOpenDocument(type: DocumentType, id: string) {
    const label = type === "supplier_order" ? "заказа поставщику" : "приёмки";

    window.alert(
      `Открытие ${label} будет следующим шагом. ID документа: ${id}`,
    );
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>Связанные документы</div>
            <div style={subtitleStyle}>
              Цепочка документов по закупке и поступлению
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading ? (
          <div style={emptyStyle}>Загружаю связанные документы...</div>
        ) : !order ? (
          <div style={emptyStyle}>
            Связанные документы пока не найдены.
          </div>
        ) : (
          <div style={chainWrapStyle}>
            <div style={documentNodeStyle(sourceType === "supplier_order")}>
              <div style={nodeHeaderStyle}>
                <span style={nodeIconStyle}>📄</span>
                <span style={nodeTitleStyle}>Заказ поставщику</span>
              </div>

              <button
                type="button"
                onClick={() => handleOpenDocument("supplier_order", order.id)}
                style={documentButtonStyle}
              >
                <div style={documentNumberStyle}>
                  {order.order_number || "Без номера"}
                </div>
                <div style={documentMetaStyle}>
                  {order.order_date || "—"} · {order.supplier_name || "—"}
                </div>
                <div style={documentFooterStyle}>
                  <span style={statusBadgeStyle}>{getStatusLabel(order.status)}</span>
                  <strong>{formatMoney(order.total_amount)} ₽</strong>
                </div>
              </button>
            </div>

            <div style={connectorStyle} />

            <div style={childDocumentsStyle}>
              {receipts.length === 0 ? (
                <div style={emptyChildStyle}>
                  Приёмок по этому заказу пока нет.
                </div>
              ) : (
                receipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    style={documentNodeStyle(
                      sourceType === "supplier_receipt" &&
                        sourceId === receipt.id,
                    )}
                  >
                    <div style={nodeHeaderStyle}>
                      <span style={nodeIconStyle}>📦</span>
                      <span style={nodeTitleStyle}>Приёмка</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleOpenDocument("supplier_receipt", receipt.id)
                      }
                      style={documentButtonStyle}
                    >
                      <div style={documentNumberStyle}>
                        {receipt.receipt_number || "Черновик приёмки"}
                      </div>
                      <div style={documentMetaStyle}>
                        {receipt.receipt_date || "—"} ·{" "}
                        {receipt.supplier_name || "—"}
                      </div>
                      <div style={documentFooterStyle}>
                        <span style={statusBadgeStyle}>
                          {getStatusLabel(receipt.status)}
                        </span>
                        <strong>{formatMoney(receipt.total_amount)} ₽</strong>
                      </div>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10080,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  lineHeight: 1.45,
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 700,
};

const chainWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 340px) 46px 1fr",
  gap: 0,
  alignItems: "center",
};

function documentNodeStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    borderRadius: 16,
    padding: 12,
    boxShadow: active ? "0 10px 22px rgba(37, 99, 235, 0.14)" : "none",
  };
}

const nodeHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const nodeIconStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 10,
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const nodeTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
};

const documentButtonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  color: "#0f172a",
  display: "grid",
  gap: 6,
};

const documentNumberStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const documentMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 600,
};

const documentFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginTop: 4,
};

const statusBadgeStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const connectorStyle: React.CSSProperties = {
  height: 2,
  background: "#cbd5e1",
};

const childDocumentsStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const emptyChildStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 700,
};
