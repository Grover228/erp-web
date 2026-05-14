import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import type { CustomerOrder } from "./CustomerOrderModal";
import CustomerShipmentModal, {
  type CustomerShipment,
  type CustomerShipmentItem,
} from "./CustomerShipmentModal";
import CustomerInvoiceModal, { type CustomerInvoice } from "./CustomerInvoiceModal";
import CustomerPaymentModal, { type CustomerPayment } from "./CustomerPaymentModal";

type CustomerLinkedDocumentsModalProps = {
  order: CustomerOrder;
  onClose: () => void;
  onUpdated?: () => void;
};

type LinkedDocumentKind =
  | "customer_order"
  | "customer_shipment"
  | "customer_invoice"
  | "incoming_payment"
  | "production_order"
  | "supplier_order";

type LinkedDocumentCard = {
  id: string;
  kind: LinkedDocumentKind;
  title: string;
  number: string;
  date: string | null;
  status: string;
  amount: number;
  description: string;
};

export default function CustomerLinkedDocumentsModal({
  order,
  onClose,
  onUpdated,
}: CustomerLinkedDocumentsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState<LinkedDocumentCard[]>([]);
  const [selectedShipment, setSelectedShipment] =
    useState<CustomerShipment | null>(null);
  const [selectedShipmentItems, setSelectedShipmentItems] = useState<
    CustomerShipmentItem[]
  >([]);
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<CustomerPayment | null>(null);

  useEffect(() => {
    loadLinkedDocuments();
  }, [order.id]);

  async function loadLinkedDocuments() {
    try {
      setLoading(true);
      setError("");

      const baseDocuments: LinkedDocumentCard[] = [
        {
          id: order.id,
          kind: "customer_order",
          title: "Заказ покупателя",
          number: order.order_number || "Без номера",
          date: order.order_date,
          status: order.status || "draft",
          amount: Number(order.total_amount || 0),
          description: "Исходный документ продажи",
        },
      ];

      const { data: shipments, error: shipmentsError } = await supabase
        .from("customer_shipments")
        .select("*")
        .eq("customer_order_id", order.id)
        .order("created_at", { ascending: true });

      if (shipmentsError) throw shipmentsError;

      const shipmentDocuments = ((shipments || []) as CustomerShipment[]).map(
        (shipment) => ({
          id: shipment.id,
          kind: "customer_shipment" as const,
          title: "Отгрузка",
          number: shipment.shipment_number || "Черновик отгрузки",
          date: shipment.shipment_date,
          status: shipment.status || "draft",
          amount: Number(shipment.total_amount || 0),
          description:
            shipment.status === "posted"
              ? "Проведена, остатки списаны"
              : shipment.status === "cancelled"
                ? "Отменена"
                : "Черновик, ожидает проведения",
        }),
      );

      const { data: invoices, error: invoicesError } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("customer_order_id", order.id)
        .order("created_at", { ascending: true });

      if (invoicesError) throw invoicesError;

      const invoiceDocuments = ((invoices || []) as CustomerInvoice[]).map(
        (invoice) => ({
          id: invoice.id,
          kind: "customer_invoice" as const,
          title: "Счёт покупателю",
          number: invoice.invoice_number || "Без номера",
          date: invoice.invoice_date,
          status: invoice.status || "draft",
          amount: Number(invoice.total_amount || 0),
          description:
            Number(invoice.paid_amount || 0) >= Number(invoice.total_amount || 0)
              ? "Счёт оплачен"
              : `Оплачено ${Number(invoice.paid_amount || 0).toLocaleString("ru-RU", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ₽`,
        }),
      );

      const { data: payments, error: paymentsError } = await supabase
        .from("customer_payments")
        .select("*")
        .eq("customer_order_id", order.id)
        .order("created_at", { ascending: true });

      if (paymentsError) throw paymentsError;

      const paymentDocuments = ((payments || []) as CustomerPayment[]).map(
        (payment) => ({
          id: payment.id,
          kind: "incoming_payment" as const,
          title: "Входящий платёж",
          number: payment.payment_number || "Без номера",
          date: payment.payment_date,
          status: payment.status || "posted",
          amount: Number(payment.amount || 0),
          description: "Оплата от покупателя",
        }),
      );

      setDocuments([
        ...baseDocuments,
        ...invoiceDocuments,
        ...paymentDocuments,
        ...shipmentDocuments,
      ]);
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

  async function openShipment(shipmentId: string) {
    try {
      setLoading(true);
      setError("");

      const { data: shipment, error: shipmentError } = await supabase
        .from("customer_shipments")
        .select("*")
        .eq("id", shipmentId)
        .single();

      if (shipmentError) throw shipmentError;

      const { data: shipmentItems, error: itemsError } = await supabase
        .from("customer_shipment_items")
        .select(
          `
          *,
          products(name, article),
          materials(name, article, color_id),
          consumables(name, article)
        `,
        )
        .eq("customer_shipment_id", shipmentId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      setSelectedShipment(shipment as CustomerShipment);
      setSelectedShipmentItems((shipmentItems as CustomerShipmentItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка открытия отгрузки",
      );
    } finally {
      setLoading(false);
    }
  }


  async function openInvoice(invoiceId: string) {
    try {
      setLoading(true);
      setError("");

      const { data: invoice, error: invoiceError } = await supabase
        .from("customer_invoices")
        .select("*")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      setSelectedInvoice(invoice as CustomerInvoice);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка открытия счёта",
      );
    } finally {
      setLoading(false);
    }
  }

  async function openPayment(paymentId: string) {
    try {
      setLoading(true);
      setError("");

      const { data: payment, error: paymentError } = await supabase
        .from("customer_payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (paymentError) throw paymentError;

      setSelectedPayment(payment as CustomerPayment);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка открытия оплаты",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenDocument(document: LinkedDocumentCard) {
    if (document.kind === "customer_order") return;

    if (document.kind === "customer_shipment") {
      openShipment(document.id);
      return;
    }

    if (document.kind === "customer_invoice") {
      openInvoice(document.id);
      return;
    }

    if (document.kind === "incoming_payment") {
      openPayment(document.id);
      return;
    }

    window.alert("Этот тип связанного документа подключим следующим этапом.");
  }

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "posted") return "Проведена";
    if (status === "completed") return "Завершён";
    if (status === "issued") return "Выставлен";
    if (status === "partially_paid") return "Частично оплачен";
    if (status === "paid") return "Оплачен";
    if (status === "cancelled") return "Отменён";
    if (status === "confirmed") return "Подтверждён";
    if (status === "in_progress") return "В работе";
    return status;
  }

  function getDocumentIcon(kind: LinkedDocumentKind) {
    if (kind === "customer_order") return "🧾";
    if (kind === "customer_shipment") return "🚚";
    if (kind === "customer_invoice") return "📄";
    if (kind === "incoming_payment") return "💳";
    if (kind === "production_order") return "🏭";
    if (kind === "supplier_order") return "📦";
    return "📎";
  }

  function getDocumentCardStyle(document: LinkedDocumentCard): React.CSSProperties {
    if (document.kind === "customer_order") {
      return {
        ...documentCardStyle,
        borderColor: "#93c5fd",
        background: "#eff6ff",
      };
    }

    if (document.status === "posted" || document.status === "completed") {
      return {
        ...documentCardStyle,
        borderColor: "#86efac",
        background: "#f0fdf4",
      };
    }

    return documentCardStyle;
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>Связанные документы</div>
            <div style={subtitleStyle}>
              Цепочка документов по заказу {order.order_number || "Без номера"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading && (
          <div style={loadingStyle}>Загружаю связанные документы...</div>
        )}

        <div style={timelineStyle}>
          {documents.map((document, index) => (
            <div key={`${document.kind}-${document.id}`} style={timelineItemStyle}>
              <button
                type="button"
                onClick={() => handleOpenDocument(document)}
                style={getDocumentCardStyle(document)}
              >
                <div style={documentHeaderStyle}>
                  <div style={documentTitleWrapStyle}>
                    <span style={documentIconStyle}>
                      {getDocumentIcon(document.kind)}
                    </span>
                    <div>
                      <div style={documentTitleStyle}>{document.title}</div>
                      <div style={documentNumberStyle}>{document.number}</div>
                    </div>
                  </div>

                  <span style={statusBadgeStyle(document.status)}>
                    {getStatusLabel(document.status)}
                  </span>
                </div>

                <div style={documentMetaStyle}>
                  <span>{document.date || "Дата не указана"}</span>
                  <strong>
                    {Number(document.amount || 0).toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ₽
                  </strong>
                </div>

                <div style={documentDescriptionStyle}>
                  {document.description}
                </div>
              </button>

              {index < documents.length - 1 && <div style={connectorStyle} />}
            </div>
          ))}
        </div>

        {documents.length === 1 && !loading && (
          <div style={emptyLinkedStyle}>
            Пока связан только сам заказ покупателя. Следующий документ появится
            здесь после создания отгрузки, оплаты, производства или закупки.
          </div>
        )}

        <div style={futureBlockStyle}>
          <div style={futureTitleStyle}>Будущие связи</div>
          <div style={futureGridStyle}>
            <div style={futureItemStyle}>📄 Счёт покупателю</div>
            <div style={futureItemStyle}>💳 Входящий платёж</div>
            <div style={futureItemStyle}>🏭 Производственное задание</div>
            <div style={futureItemStyle}>📦 Заказ поставщику</div>
          </div>
        </div>

        {selectedShipment && (
          <CustomerShipmentModal
            shipment={selectedShipment}
            shipmentItems={selectedShipmentItems}
            onClose={() => setSelectedShipment(null)}
            onSaved={() => {
              setSelectedShipment(null);
              loadLinkedDocuments();
              onUpdated?.();
            }}
          />
        )}

        {selectedInvoice && (
          <CustomerInvoiceModal
            invoice={selectedInvoice}
            onClose={() => setSelectedInvoice(null)}
            onSaved={() => {
              setSelectedInvoice(null);
              loadLinkedDocuments();
              onUpdated?.();
            }}
          />
        )}

        {selectedPayment && (
          <CustomerPaymentModal
            payment={selectedPayment}
            onClose={() => setSelectedPayment(null)}
            onSaved={() => {
              setSelectedPayment(null);
              loadLinkedDocuments();
              onUpdated?.();
            }}
          />
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10040,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1040px, 96vw)",
  maxHeight: "84vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 5,
  fontSize: 16,
};

const closeButtonStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};

const loadingStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  color: "#64748b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};

const timelineStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
};

const timelineItemStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
};

const documentCardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 16,
  padding: 14,
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gap: 10,
  color: "#0f172a",
};

const documentHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const documentTitleWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: 10,
  alignItems: "center",
};

const documentIconStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 13,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const documentTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const documentNumberStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 16,
  fontWeight: 900,
  marginTop: 3,
};

function statusBadgeStyle(status: string): React.CSSProperties {
  const isDone = status === "posted" || status === "completed";

  return {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    border: isDone ? "1px solid #86efac" : "1px solid #cbd5e1",
    background: isDone ? "#dcfce7" : "#f8fafc",
    color: isDone ? "#15803d" : "#64748b",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

const documentMetaStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#64748b",
  fontSize: 14,
};

const documentDescriptionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.4,
};

const connectorStyle: React.CSSProperties = {
  width: 2,
  height: 24,
  background: "#cbd5e1",
};

const emptyLinkedStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const futureBlockStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
  display: "grid",
  gap: 10,
};

const futureTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const futureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
};

const futureItemStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "9px 11px",
  background: "#ffffff",
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};
