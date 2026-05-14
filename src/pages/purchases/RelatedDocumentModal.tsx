import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import type { SupplierOrder, SupplierOrderItem } from "./SupplierOrderModal";

type RelatedDocumentType = "receipt" | "payment" | "invoice";

type FinanceAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  current_balance: number | string;
};

type SupplierPayment = {
  id: string;
  supplier_order_id: string;
  finance_account_id: string | null;
  finance_transaction_id: string | null;
  payment_number: string | null;
  payment_date: string | null;
  amount: number | string;
  comment: string | null;
  created_at: string | null;
};

type RelatedDocumentModalProps = {
  order: SupplierOrder;
  orderItems: SupplierOrderItem[];
  initialType?: RelatedDocumentType;
  onClose: () => void;
  onCreatedDocument?: (type: "supplier_receipt" | "supplier_payment", id: string) => void;
};

const documentTypes: {
  type: RelatedDocumentType;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    type: "receipt",
    title: "Приёмка на склад",
    subtitle: "Зафиксировать приход и увеличить остатки материалов",
    icon: "📦",
  },
  {
    type: "payment",
    title: "Оплата поставщику",
    subtitle: "Создать исходящий платёж по заказу поставщику",
    icon: "💸",
  },
  {
    type: "invoice",
    title: "Накладная поставщика",
    subtitle: "Зарегистрировать документ, полученный от поставщика",
    icon: "📄",
  },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number | string, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function RelatedDocumentModal({
  order,
  orderItems,
  initialType = "receipt",
  onClose,
  onCreatedDocument,
}: RelatedDocumentModalProps) {
  const [selectedType, setSelectedType] =
    useState<RelatedDocumentType>(initialType);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDate());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentComment, setPaymentComment] = useState("");

  const selectedDocument = documentTypes.find(
    (document) => document.type === selectedType,
  );

  const paidAmount = useMemo(() => {
    return supplierPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
  }, [supplierPayments]);

  const paymentDebt = Math.max(0, Number(order.total_amount || 0) - paidAmount);

  useEffect(() => {
    setSelectedType(initialType);
  }, [initialType]);

  useEffect(() => {
    loadFinanceData();
  }, [order.id]);

  useEffect(() => {
    if (selectedType === "payment" && !paymentAmount && paymentDebt > 0) {
      setPaymentAmount(paymentDebt.toFixed(2));
    }
  }, [selectedType, paymentDebt, paymentAmount]);

  async function loadFinanceData() {
    try {
      setFinanceLoading(true);
      setError("");

      const [accountsResult, paymentsResult] = await Promise.all([
        supabase
          .from("finance_accounts")
          .select("id, name, type, currency, current_balance")
          .eq("is_active", true)
          .order("created_at", { ascending: true }),

        supabase
          .from("supplier_payments")
          .select(
            "id, supplier_order_id, finance_account_id, finance_transaction_id, payment_number, payment_date, amount, comment, created_at",
          )
          .eq("supplier_order_id", order.id)
          .order("created_at", { ascending: false }),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const nextAccounts = (accountsResult.data as FinanceAccount[]) || [];
      const nextPayments = (paymentsResult.data as SupplierPayment[]) || [];

      setFinanceAccounts(nextAccounts);
      setSupplierPayments(nextPayments);

      if (!paymentAccountId && nextAccounts.length > 0) {
        setPaymentAccountId(nextAccounts[0].id);
      }

      const nextPaid = nextPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );
      const nextDebt = Math.max(0, Number(order.total_amount || 0) - nextPaid);

      setPaymentAmount(nextDebt > 0 ? nextDebt.toFixed(2) : "");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки финансовых данных",
      );
    } finally {
      setFinanceLoading(false);
    }
  }

  function getDocumentDescription() {
    if (selectedType === "receipt") {
      return "Приёмка создаст складской документ на основании позиций заказа. После проведения документа остатки материалов увеличатся.";
    }

    if (selectedType === "payment") {
      return "Оплата создаст отдельный финансовый документ, спишет деньги с выбранного счёта и появится в связанных документах заказа.";
    }

    return "Накладная поставщика позволит зафиксировать номер и дату входящего документа поставщика.";
  }

  async function createReceiptDraft() {
    if (orderItems.length === 0) {
      throw new Error("В заказе нет позиций для приёмки");
    }

    const { data: receipt, error: receiptError } = await supabase
      .from("supplier_receipts")
      .insert({
        supplier_order_id: order.id,
        receipt_date: new Date().toISOString().slice(0, 10),
        supplier_id: order.supplier_id || null,
        supplier_name: order.supplier_name || null,
        status: "draft",
        comment: `Создано из заказа ${order.order_number || "без номера"}`,
        total_amount: order.total_amount || 0,
      })
      .select("id")
      .single();

    if (receiptError) throw receiptError;

    const { error: itemsError } = await supabase
      .from("supplier_receipt_items")
      .insert(
        orderItems.map((item) => ({
          supplier_receipt_id: receipt.id,
          item_type: item.item_type,
          material_id: item.item_type === "material" ? item.material_id : null,
          consumable_id:
            item.item_type === "consumable" ? item.consumable_id : null,
          quantity: item.quantity,
          price: item.price || 0,
        })),
      );

    if (itemsError) throw itemsError;

    return receipt.id as string;
  }

  async function createSupplierPaymentDocument() {
    const amount = Number(paymentAmount.replace(",", "."));
    const account = financeAccounts.find((item) => item.id === paymentAccountId);

    if (!account) {
      throw new Error("Выбери счёт оплаты");
    }

    if (!paymentAmount || Number.isNaN(amount) || amount <= 0) {
      throw new Error("Сумма оплаты должна быть больше 0");
    }

    if (amount > paymentDebt) {
      throw new Error(
        `Сумма оплаты больше долга. Осталось оплатить ${formatMoney(paymentDebt)}.`,
      );
    }

    const currentBalance = Number(account.current_balance || 0);

    if (amount > currentBalance) {
      throw new Error("Недостаточно средств на выбранном счёте");
    }

    const description = `Оплата поставщику по заказу ${
      order.order_number || order.id.slice(0, 8)
    }`;

    const { data: transaction, error: transactionError } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: account.id,
        type: "expense",
        amount,
        operation_date: paymentDate || todayDate(),
        description,
        source_document_type: "supplier_order",
        source_document_id: order.id,
        category: "supplier_payment",
        counterparty_id: order.supplier_id || null,
        comment: paymentComment.trim() || null,
      })
      .select("id")
      .single();

    if (transactionError) throw transactionError;

    const nextBalance = currentBalance - amount;

    const { error: accountError } = await supabase
      .from("finance_accounts")
      .update({
        current_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (accountError) throw accountError;

    const { data: payment, error: paymentError } = await supabase
      .from("supplier_payments")
      .insert({
        supplier_order_id: order.id,
        finance_account_id: account.id,
        finance_transaction_id: transaction.id,
        payment_date: paymentDate || todayDate(),
        amount,
        comment: paymentComment.trim() || null,
      })
      .select("id")
      .single();

    if (paymentError) throw paymentError;

    return payment.id as string;
  }

  async function handleCreateDocument() {
    try {
      setCreating(true);
      setError("");

      if (selectedType === "receipt") {
        const receiptId = await createReceiptDraft();
        window.alert("Черновик приёмки создан");
        onCreatedDocument?.("supplier_receipt", receiptId);
        onClose();
        return;
      }

      if (selectedType === "payment") {
        const paymentId = await createSupplierPaymentDocument();
        window.alert("Оплата поставщику создана");
        onCreatedDocument?.("supplier_payment", paymentId);
        onClose();
        return;
      }

      window.alert("Создание накладной поставщика будет следующим шагом.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка создания связанного документа",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Создать связанный документ</div>
            <div style={modalSubtitleStyle}>
              Заказ {order.order_number || "Без номера"} ·{" "}
              {order.supplier_name || "Поставщик не указан"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={contentGridStyle}>
          <div style={documentListStyle}>
            {documentTypes.map((document) => (
              <button
                key={document.type}
                type="button"
                onClick={() => setSelectedType(document.type)}
                style={documentTypeButtonStyle(
                  selectedType === document.type,
                )}
              >
                <span style={documentIconStyle}>{document.icon}</span>

                <span style={{ display: "grid", gap: 3 }}>
                  <span style={documentTitleStyle}>{document.title}</span>
                  <span style={documentSubtitleStyle}>{document.subtitle}</span>
                </span>
              </button>
            ))}
          </div>

          <div style={detailsCardStyle}>
            <div style={detailsHeaderStyle}>
              <div style={detailsIconStyle}>{selectedDocument?.icon}</div>

              <div>
                <div style={detailsTitleStyle}>{selectedDocument?.title}</div>
                <div style={detailsSubtitleStyle}>
                  {selectedDocument?.subtitle}
                </div>
              </div>
            </div>

            <div style={descriptionStyle}>{getDocumentDescription()}</div>

            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Заказ</div>
                <div style={summaryValueStyle}>
                  {order.order_number || "Без номера"}
                </div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Дата заказа</div>
                <div style={summaryValueStyle}>{order.order_date || "—"}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Сумма</div>
                <div style={summaryValueStyle}>
                  {Number(order.total_amount || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₽
                </div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Позиций</div>
                <div style={summaryValueStyle}>{orderItems.length}</div>
              </div>
            </div>

            {selectedType === "receipt" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Что попадёт в приёмку</div>

                {orderItems.length === 0 ? (
                  <div style={emptyStyle}>В заказе нет позиций.</div>
                ) : (
                  <div style={miniTableStyle}>
                    {orderItems.map((item) => (
                      <div key={item.id} style={miniTableRowStyle}>
                        <span>
                          {item.item_type === "material"
                            ? item.materials?.name || "Материал"
                            : item.consumables?.name || "Расходник"}
                        </span>
                        <strong>{item.quantity}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedType === "payment" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Параметры оплаты</div>

                {financeLoading ? (
                  <div style={emptyStyle}>Загружаю счета...</div>
                ) : paymentDebt <= 0 ? (
                  <div style={paidBoxStyle}>Заказ уже полностью оплачен.</div>
                ) : (
                  <div style={paymentFormStyle}>
                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Счёт списания</span>
                      <select
                        value={paymentAccountId}
                        onChange={(event) =>
                          setPaymentAccountId(event.target.value)
                        }
                        style={inputStyle}
                      >
                        <option value="">Выбери счёт</option>
                        {financeAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} ·{" "}
                            {formatMoney(account.current_balance, account.currency)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Дата оплаты</span>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelStyle}>
                      <span style={labelTextStyle}>Сумма оплаты</span>
                      <input
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                        placeholder="0.00"
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                      <span style={labelTextStyle}>Комментарий</span>
                      <textarea
                        value={paymentComment}
                        onChange={(event) =>
                          setPaymentComment(event.target.value)
                        }
                        placeholder="Необязательно"
                        rows={2}
                        style={{ ...inputStyle, resize: "vertical" }}
                      />
                    </label>

                    <div style={paymentHintStyle}>
                      Оплачено: <strong>{formatMoney(paidAmount)}</strong> ·
                      Осталось: <strong>{formatMoney(paymentDebt)}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedType === "invoice" && (
              <div style={itemsPreviewStyle}>
                <div style={sectionTitleStyle}>Данные накладной</div>
                <div style={emptyStyle}>
                  Следующим шагом добавим номер документа поставщика, дату,
                  файл/скан и комментарий.
                </div>
              </div>
            )}

            <div style={actionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>
                Отмена
              </button>

              <button
                type="button"
                onClick={handleCreateDocument}
                disabled={
                  creating ||
                  (selectedType === "payment" &&
                    (financeAccounts.length === 0 || paymentDebt <= 0))
                }
                style={{
                  ...createButtonStyle,
                  opacity:
                    creating ||
                    (selectedType === "payment" &&
                      (financeAccounts.length === 0 || paymentDebt <= 0))
                      ? 0.65
                      : 1,
                  cursor:
                    creating ||
                    (selectedType === "payment" &&
                      (financeAccounts.length === 0 || paymentDebt <= 0))
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {creating ? "Создаю..." : "Создать документ"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10060,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(980px, 96vw)",
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

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
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

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: 14,
};

const documentListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  alignContent: "start",
};

function documentTypeButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: "#0f172a",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: 10,
    textAlign: "left",
    boxShadow: active ? "0 8px 18px rgba(37, 99, 235, 0.12)" : "none",
  };
}

const documentIconStyle: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.2,
};

const documentTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
};

const documentSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  lineHeight: 1.35,
};

const detailsCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 14,
};

const detailsHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr",
  gap: 12,
  alignItems: "center",
};

const detailsIconStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const detailsTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#0f172a",
};

const detailsSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 3,
  lineHeight: 1.4,
};

const descriptionStyle: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.6,
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const itemsPreviewStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
};

const miniTableStyle: React.CSSProperties = {
  display: "grid",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  overflow: "hidden",
  background: "#ffffff",
};

const miniTableRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 14,
  color: "#64748b",
  background: "#ffffff",
  lineHeight: 1.5,
};

const paymentFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
  fontSize: 14,
};

const paymentHintStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 12,
  lineHeight: 1.5,
};

const paidBoxStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#15803d",
  borderRadius: 14,
  padding: 14,
  fontWeight: 900,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: 900,
};

const createButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: 900,
};
