import { useEffect, useMemo, useState } from "react";

type FinanceAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  opening_balance: number | string;
  current_balance: number | string;
  is_active: boolean;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

type FinanceCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
  is_active: boolean;
  created_at: string;
};

type FinanceTransaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  type: string;
  amount: number | string;
  operation_date: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
};

type TransactionUpdatePayload = {
  accountId: string;
  categoryId: string | null;
  type: string;
  amount: number;
  operationDate: string;
  description: string | null;
};

type FinanceTransactionDetailsModalProps = {
  transaction: FinanceTransaction;
  account: FinanceAccount | null;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  allCategories: FinanceCategory[];
  operatorName: string;
  onClose: () => void;
  onSave: (
    transaction: FinanceTransaction,
    payload: TransactionUpdatePayload
  ) => Promise<void>;
};

const accountTypes = [
  { value: "cash", label: "Наличные" },
  { value: "bank", label: "Банк" },
  { value: "card", label: "Карта" },
  { value: "crypto", label: "Крипто" },
];

function toMoney(value: number | string, currency = "RUB") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getOperationLabel(type: string) {
  if (type === "income") return "Приход";
  if (type === "expense") return "Расход";
  return type;
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU").format(date);
}

function formatDateTime(value: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function FinanceTransactionDetailsModal({
  transaction,
  account,
  accounts,
  categories,
  allCategories,
  operatorName,
  onClose,
  onSave,
}: FinanceTransactionDetailsModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editAccountId, setEditAccountId] = useState(transaction.account_id);
  const [editType, setEditType] = useState(transaction.type);
  const [editCategoryId, setEditCategoryId] = useState(transaction.category_id || "");
  const [editAmount, setEditAmount] = useState(String(transaction.amount || ""));
  const [editOperationDate, setEditOperationDate] = useState(
    transaction.operation_date || new Date().toISOString().slice(0, 10)
  );
  const [editDescription, setEditDescription] = useState(
    transaction.description || ""
  );

  useEffect(() => {
    setIsEditMode(false);
    setError("");
    setEditAccountId(transaction.account_id);
    setEditType(transaction.type);
    setEditCategoryId(transaction.category_id || "");
    setEditAmount(String(transaction.amount || ""));
    setEditOperationDate(
      transaction.operation_date || new Date().toISOString().slice(0, 10)
    );
    setEditDescription(transaction.description || "");
  }, [transaction]);

  const isIncome = transaction.type === "income";
  const currency = account?.currency || "RUB";

  const currentCategory = allCategories.find(
    (item) => item.id === transaction.category_id
  );

  const editCategories = useMemo(() => {
    return allCategories.filter(
      (item) => item.type === editType && item.is_active
    );
  }, [allCategories, editType]);

  useEffect(() => {
    const category = allCategories.find((item) => item.id === editCategoryId);
    if (category && category.type !== editType) {
      setEditCategoryId("");
    }
  }, [editType, editCategoryId, allCategories]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(editAmount || 0);

    if (!editAccountId) {
      setError("Выбери счет");
      return;
    }

    if (!editType) {
      setError("Выбери тип операции");
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Сумма должна быть больше 0");
      return;
    }

    if (!editOperationDate) {
      setError("Укажи дату операции");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await onSave(transaction, {
        accountId: editAccountId,
        categoryId: editCategoryId || null,
        type: editType,
        amount,
        operationDate: editOperationDate,
        description: editDescription.trim() || null,
      });

      setIsEditMode(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось сохранить изменения"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 22,
          border: "1px solid #dbe4f0",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ color: "#0f172a", fontSize: 24, fontWeight: 900 }}>
              Карточка операции
            </div>
            <div style={{ color: "#64748b", marginTop: 5, fontSize: 14 }}>
              Подробности движения денежных средств
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {!isEditMode && (
          <>
            <div
              style={{
                background: isIncome ? "#f0fdf4" : "#fef2f2",
                border: isIncome ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 18,
                padding: 18,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: isIncome ? "#166534" : "#991b1b",
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {getOperationLabel(transaction.type)}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: isIncome ? "#16a34a" : "#dc2626",
                  fontSize: 30,
                  fontWeight: 900,
                }}
              >
                {isIncome ? "+" : "-"}
                {toMoney(transaction.amount, currency)}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <InfoCard label="Счёт" value={account?.name || "Счёт удалён"} />
              <InfoCard
                label="Статья"
                value={currentCategory?.name || "Без статьи"}
              />
              <InfoCard
                label="Тип счёта"
                value={
                  account
                    ? accountTypes.find((type) => type.value === account.type)
                        ?.label || account.type
                    : "—"
                }
              />
              <InfoCard label="Валюта" value={currency} />
              <InfoCard
                label="Дата операции"
                value={formatDate(transaction.operation_date)}
              />
              <InfoCard
                label="Создано в системе"
                value={formatDateTime(transaction.created_at)}
              />
              <InfoCard label="Операцию провёл" value={operatorName || "—"} />
            </div>

            <div
              style={{
                marginTop: 14,
                border: "1px solid #dbe4f0",
                background: "#f8fbff",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
                Описание
              </div>
              <div style={{ color: "#0f172a", fontWeight: 800, lineHeight: 1.5 }}>
                {transaction.description || "—"}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                style={primaryButtonStyle}
              >
                Редактировать
              </button>

              <button type="button" onClick={onClose} style={secondaryButtonStyle}>
                Закрыть
              </button>
            </div>
          </>
        )}

        {isEditMode && (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 14,
                  padding: 12,
                  color: "#991b1b",
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <label style={fieldStyle}>
                <span style={labelStyle}>Счёт</span>
                <select
                  value={editAccountId}
                  onChange={(event) => setEditAccountId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выбери счет</option>
                  {accounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {toMoney(item.current_balance, item.currency)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Тип операции</span>
                <select
                  value={editType}
                  onChange={(event) => setEditType(event.target.value)}
                  style={inputStyle}
                >
                  <option value="income">Приход</option>
                  <option value="expense">Расход</option>
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Статья</span>
                <select
                  value={editCategoryId}
                  onChange={(event) => setEditCategoryId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Без статьи</option>
                  {editCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Сумма</span>
                <input
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                />
              </label>

              <label style={fieldStyle}>
                <span style={labelStyle}>Дата операции</span>
                <input
                  value={editOperationDate}
                  onChange={(event) => setEditOperationDate(event.target.value)}
                  type="date"
                  style={inputStyle}
                />
              </label>

              <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <span style={labelStyle}>Описание</span>
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </label>
            </div>

            <div
              style={{
                marginTop: 16,
                border: "1px solid #dbe4f0",
                background: "#f8fbff",
                borderRadius: 16,
                padding: 14,
                color: "#64748b",
                lineHeight: 1.5,
              }}
            >
              Автор операции и время создания не редактируются. При изменении
              суммы, типа или счёта баланс будет пересчитан автоматически.
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false);
                  setError("");
                }}
                disabled={saving}
                style={secondaryButtonStyle}
              >
                Отмена
              </button>

              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #dbe4f0",
        background: "#f8fbff",
        borderRadius: 16,
        padding: 14,
        minHeight: 72,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 14px",
  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 800,
  boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 800,
};

const closeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 800,
};
