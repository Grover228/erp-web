export type CustomerPayment = {
  id: string;
  payment_number: string | null;
  payment_date: string;
  customer_order_id: string | null;
  customer_invoice_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  status_id: string | null;
  amount: number;
  comment: string | null;
  created_at: string | null;
};

type CustomerPaymentModalProps = {
  payment: CustomerPayment;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CustomerPaymentModal({
  payment,
  onClose,
}: CustomerPaymentModalProps) {
  function getStatusLabel(status: string) {
    if (status === "posted") return "Проведён";
    if (status === "cancelled") return "Отменён";
    return status;
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>
              Входящий платёж {payment.payment_number || "Без номера"}
            </div>
            <div style={subtitleStyle}>
              Дата: {payment.payment_date || "—"} · Покупатель:{" "}
              {payment.customer_name || "—"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Статус</div>
            <div style={statusBadgeStyle}>{getStatusLabel(payment.status)}</div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Сумма оплаты</div>
            <div style={infoValueStyle}>
              {Number(payment.amount || 0).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₽
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Основание</div>
            <div style={infoValueStyle}>
              {payment.customer_invoice_id
                ? "Счёт покупателю"
                : payment.customer_order_id
                  ? "Заказ покупателя"
                  : "—"}
            </div>
          </div>
        </div>

        <div style={noticeStyle}>
          Платёж пока фиксируется как входящий финансовый документ. Следующим
          шагом добавим отмену оплаты, кассу/банк и автоматический расчёт
          задолженности.
        </div>

        {payment.comment && <div style={commentStyle}>{payment.comment}</div>}
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
  width: "min(820px, 96vw)",
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

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#15803d",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 15,
  fontWeight: 900,
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #bae6fd",
  background: "#f0f9ff",
  color: "#075985",
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
