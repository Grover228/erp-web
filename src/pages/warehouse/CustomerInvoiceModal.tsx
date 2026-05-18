export type CustomerInvoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  customer_order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  status_id: string | null;
  total_amount: number;
  paid_amount: number;
  comment: string | null;
  created_at: string | null;
};

type CustomerInvoiceModalProps = {
  invoice: CustomerInvoice;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CustomerInvoiceModal({
  invoice,
  onClose,
}: CustomerInvoiceModalProps) {
  const debt = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0);

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "issued") return "Выставлен";
    if (status === "partially_paid") return "Частично оплачен";
    if (status === "paid") return "Оплачен";
    if (status === "cancelled") return "Отменён";
    return status;
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>
              Счёт покупателю {invoice.invoice_number || "Без номера"}
            </div>
            <div style={subtitleStyle}>
              Дата: {invoice.invoice_date || "—"} · Покупатель:{" "}
              {invoice.customer_name || "—"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Статус</div>
            <div style={statusBadgeStyle}>{getStatusLabel(invoice.status)}</div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Сумма счёта</div>
            <div style={infoValueStyle}>
              {Number(invoice.total_amount || 0).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₽
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Оплачено</div>
            <div style={infoValueStyle}>
              {Number(invoice.paid_amount || 0).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₽
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Долг</div>
            <div style={debt <= 0 ? paidValueStyle : debtValueStyle}>
              {debt.toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₽
            </div>
          </div>
        </div>

        <div style={noticeStyle}>
          Счёт пока работает как финансовый документ-заготовка. Следующим шагом
          привяжем печатную форму, оплату и закрытие задолженности.
        </div>

        {invoice.comment && <div style={commentStyle}>{invoice.comment}</div>}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.48)",
  zIndex: 10060,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(900px, 96vw)",
  maxHeight: "84vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.34)",
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
  fontSize: 24,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 5,
  fontSize: 16,
};

const closeButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 6,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const debtValueStyle: React.CSSProperties = {
  color: "#c2410c",
  fontSize: 18,
  fontWeight: 900,
};

const paidValueStyle: React.CSSProperties = {
  color: "#15803d",
  fontSize: 18,
  fontWeight: 900,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#c2410c",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 15,
  fontWeight: 900,
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 14,
  padding: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};

const commentStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 13,
  color: "#334155",
  background: "#ffffff",
};
