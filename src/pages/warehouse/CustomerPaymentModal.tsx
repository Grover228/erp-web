import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export type CustomerPayment = {
  id: string;
  payment_number: string | null;
  payment_date: string;
  customer_order_id: string | null;
  customer_invoice_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  finance_account_id?: string | null;
  finance_transaction_id?: string | null;
  status: string;
  status_id: string | null;
  amount: number;
  comment: string | null;
  created_at: string | null;
};

type FinanceAccount = {
  id: string;
  name: string;
  current_balance: number | string | null;
};

type FinanceTransaction = {
  id: string;
  description: string | null;
  operation_date: string | null;
  amount: number | string;
  type: string;
};

type CustomerPaymentModalProps = {
  payment: CustomerPayment;
  onClose: () => void;
  onSaved?: () => void;
};

export default function CustomerPaymentModal({
  payment,
  onClose,
  onSaved,
}: CustomerPaymentModalProps) {
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [transaction, setTransaction] = useState<FinanceTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFinanceLinks();
  }, [payment.id]);

  async function loadFinanceLinks() {
    try {
      setError("");

      const [accountResult, transactionResult] = await Promise.all([
        payment.finance_account_id
          ? supabase
              .from("finance_accounts")
              .select("id, name, current_balance")
              .eq("id", payment.finance_account_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        payment.finance_transaction_id
          ? supabase
              .from("finance_transactions")
              .select("id, description, operation_date, amount, type")
              .eq("id", payment.finance_transaction_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (transactionResult.error) throw transactionResult.error;

      setAccount((accountResult.data as FinanceAccount | null) || null);
      setTransaction((transactionResult.data as FinanceTransaction | null) || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки финансовой связи");
    }
  }

  function getStatusLabel(status: string) {
    if (status === "posted") return "Проведён";
    if (status === "cancelled") return "Отменён";
    return status;
  }

  function formatMoney(value: number | string | null | undefined) {
    return `${Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ₽`;
  }

  async function deletePayment() {
    const confirmed = window.confirm(
      `Удалить входящий платёж ${payment.payment_number || "Без номера"}? Деньги будут списаны обратно со счёта.`,
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      if (payment.finance_account_id) {
        const { data: accountData, error: accountError } = await supabase
          .from("finance_accounts")
          .select("id, current_balance")
          .eq("id", payment.finance_account_id)
          .single();

        if (accountError) throw accountError;

        const { error: updateAccountError } = await supabase
          .from("finance_accounts")
          .update({
            current_balance:
              Number(accountData.current_balance || 0) - Number(payment.amount || 0),
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.finance_account_id);

        if (updateAccountError) throw updateAccountError;
      }

      const { error: paymentError } = await supabase
        .from("customer_payments")
        .delete()
        .eq("id", payment.id);

      if (paymentError) throw paymentError;

      if (payment.finance_transaction_id) {
        const { error: transactionError } = await supabase
          .from("finance_transactions")
          .delete()
          .eq("id", payment.finance_transaction_id);

        if (transactionError) throw transactionError;
      }

      onSaved?.();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка удаления платежа");
    } finally {
      setDeleting(false);
    }
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

          <div style={actionsStyle}>
            <button
              type="button"
              onClick={deletePayment}
              disabled={deleting}
              style={{
                ...deleteButtonStyle,
                opacity: deleting ? 0.65 : 1,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "Удаляю..." : "Удалить"}
            </button>

            <button type="button" onClick={onClose} style={closeButtonStyle}>
              ×
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Статус</div>
            <div style={statusBadgeStyle}>{getStatusLabel(payment.status)}</div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Сумма оплаты</div>
            <div style={infoValueStyle}>{formatMoney(payment.amount)}</div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Счёт поступления</div>
            <div style={infoValueStyle}>{account?.name || "—"}</div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Баланс счёта</div>
            <div style={infoValueStyle}>{formatMoney(account?.current_balance || 0)}</div>
          </div>
        </div>

        {transaction && (
          <div style={noticeStyle}>
            Финансовая операция: {transaction.description || "Оплата покупателя"} ·{" "}
            {transaction.operation_date || "—"} · {formatMoney(transaction.amount)}
          </div>
        )}

        {!transaction && (
          <div style={noticeStyle}>
            Платёж создан, но финансовая операция не найдена. Проверь связь
            finance_transaction_id.
          </div>
        )}

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

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  alignItems: "center",
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

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
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
