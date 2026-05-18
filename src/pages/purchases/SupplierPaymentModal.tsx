import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import LinkedDocumentsModal from "./LinkedDocumentsModal";

type DocumentType = "supplier_order" | "supplier_receipt" | "supplier_payment";

type SupplierPayment = {
  id: string;
  supplier_order_id: string | null;
  finance_account_id: string | null;
  finance_transaction_id: string | null;
  payment_number: string | null;
  payment_date: string | null;
  amount: number | string;
  comment: string | null;
  created_at: string | null;
};

type FinanceAccount = {
  id: string;
  name: string;
  currency: string;
  current_balance: number | string;
};

type FinanceTransaction = {
  id: string;
  description: string | null;
  operation_date: string | null;
  amount: number | string;
  type: string;
};

type SupplierOrder = {
  id: string;
  order_number: string | null;
  supplier_name: string | null;
  total_amount: number | string;
  status: string | null;
};

type SupplierPaymentModalProps = {
  paymentId: string;
  onClose: () => void;
  onSaved?: () => void;
  onOpenDocument?: (type: DocumentType, id: string) => void;
};

export default function SupplierPaymentModal({
  paymentId,
  onClose,
  onSaved,
  onOpenDocument,
}: SupplierPaymentModalProps) {
  const [payment, setPayment] = useState<SupplierPayment | null>(null);
  const [account, setAccount] = useState<FinanceAccount | null>(null);
  const [transaction, setTransaction] = useState<FinanceTransaction | null>(null);
  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [isLinkedDocumentsModalOpen, setIsLinkedDocumentsModalOpen] =
    useState(false);

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  async function loadPayment() {
    try {
      setLoading(true);
      setError("");

      const { data: paymentData, error: paymentError } = await supabase
        .from("supplier_payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (paymentError) throw paymentError;

      const loadedPayment = paymentData as SupplierPayment;
      setPayment(loadedPayment);

      const [accountResult, transactionResult, orderResult] = await Promise.all([
        loadedPayment.finance_account_id
          ? supabase
              .from("finance_accounts")
              .select("id, name, currency, current_balance")
              .eq("id", loadedPayment.finance_account_id)
              .single()
          : Promise.resolve({ data: null, error: null }),

        loadedPayment.finance_transaction_id
          ? supabase
              .from("finance_transactions")
              .select("id, description, operation_date, amount, type")
              .eq("id", loadedPayment.finance_transaction_id)
              .single()
          : Promise.resolve({ data: null, error: null }),

        loadedPayment.supplier_order_id
          ? supabase
              .from("supplier_orders")
              .select("id, order_number, supplier_name, total_amount, status")
              .eq("id", loadedPayment.supplier_order_id)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (transactionResult.error) throw transactionResult.error;
      if (orderResult.error) throw orderResult.error;

      setAccount(accountResult.data as FinanceAccount | null);
      setTransaction(transactionResult.data as FinanceTransaction | null);
      setOrder(orderResult.data as SupplierOrder | null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки оплаты",
      );
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(value: number | string, currency = "RUB") {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  async function deletePayment() {
    if (!payment) return;

    const confirmed = window.confirm(
      `Удалить оплату ${payment.payment_number || "без номера"}? Деньги вернутся на финансовый счёт.`,
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

        const nextBalance =
          Number(accountData.current_balance || 0) + Number(payment.amount || 0);

        const { error: updateAccountError } = await supabase
          .from("finance_accounts")
          .update({
            current_balance: nextBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.finance_account_id);

        if (updateAccountError) throw updateAccountError;
      }

      const { error: paymentDeleteError } = await supabase
        .from("supplier_payments")
        .delete()
        .eq("id", payment.id);

      if (paymentDeleteError) throw paymentDeleteError;

      if (payment.finance_transaction_id) {
        const { error: transactionDeleteError } = await supabase
          .from("finance_transactions")
          .delete()
          .eq("id", payment.finance_transaction_id);

        if (transactionDeleteError) throw transactionDeleteError;
      }

      onSaved?.();
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка удаления оплаты",
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenLinkedDocument(type: DocumentType, id: string) {
    setIsLinkedDocumentsModalOpen(false);

    if (type === "supplier_payment" && id === paymentId) return;

    onOpenDocument?.(type, id);
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>
              Оплата поставщику {payment?.payment_number || ""}
            </div>
            <div style={subtitleStyle}>
              Дата: {payment?.payment_date || "—"} · Счёт:{" "}
              {account?.name || "—"}
            </div>
          </div>

          <div style={actionsStyle}>
            {payment && (
              <button
                type="button"
                onClick={() => setIsLinkedDocumentsModalOpen(true)}
                style={linkedButtonStyle}
              >
                🔗 Связанные документы
              </button>
            )}

            {payment && (
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
            )}

            <button type="button" onClick={onClose} style={closeButtonStyle}>
              ×
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {loading ? (
          <div style={emptyStyle}>Загружаю оплату...</div>
        ) : !payment ? (
          <div style={emptyStyle}>Оплата не найдена.</div>
        ) : (
          <>
            <div style={infoGridStyle}>
              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>Статус</div>
                <div style={paidBadgeStyle}>Оплачено</div>
              </div>

              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>Сумма</div>
                <div style={infoValueStyle}>
                  {formatMoney(payment.amount, account?.currency || "RUB")}
                </div>
              </div>

              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>Счёт</div>
                <div style={infoValueStyle}>{account?.name || "—"}</div>
              </div>

              <div style={infoCardStyle}>
                <div style={infoLabelStyle}>Баланс счёта</div>
                <div style={infoValueStyle}>
                  {account
                    ? formatMoney(account.current_balance, account.currency)
                    : "—"}
                </div>
              </div>
            </div>

            {order && (
              <div style={orderBoxStyle}>
                <div style={sectionTitleStyle}>Основание</div>
                <button
                  type="button"
                  onClick={() => onOpenDocument?.("supplier_order", order.id)}
                  style={orderButtonStyle}
                >
                  <span>{order.order_number || "Заказ поставщику"}</span>
                  <strong>{formatMoney(order.total_amount)}</strong>
                </button>
              </div>
            )}

            {transaction && (
              <div style={orderBoxStyle}>
                <div style={sectionTitleStyle}>Финансовая операция</div>
                <div style={plainBoxStyle}>
                  <strong>{transaction.description || "Оплата поставщику"}</strong>
                  <span>
                    {transaction.operation_date || "—"} ·{" "}
                    {formatMoney(transaction.amount, account?.currency || "RUB")}
                  </span>
                </div>
              </div>
            )}

            {payment.comment && (
              <div style={commentBoxStyle}>{payment.comment}</div>
            )}
          </>
        )}

        {isLinkedDocumentsModalOpen && payment && (
          <LinkedDocumentsModal
            sourceType="supplier_payment"
            sourceId={payment.id}
            supplierOrderId={payment.supplier_order_id}
            onClose={() => setIsLinkedDocumentsModalOpen(false)}
            onOpenDocument={handleOpenLinkedDocument}
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
  zIndex: 10090,
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
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const linkedButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
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
  padding: 12,
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  color: "#64748b",
  background: "#ffffff",
  fontWeight: 700,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 14,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 7,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
};

const paidBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  background: "#dcfce7",
  border: "1px solid #86efac",
  color: "#15803d",
  borderRadius: 999,
  padding: "7px 11px",
  fontWeight: 900,
};

const orderBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const orderButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontWeight: 900,
};

const plainBoxStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 4,
};

const commentBoxStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 14,
  padding: 14,
};
