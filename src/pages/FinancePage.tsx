import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

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

type AccountForm = {
  name: string;
  type: string;
  currency: string;
  openingBalance: string;
  comment: string;
};

type TopUpForm = {
  accountId: string;
  amount: string;
  operationDate: string;
  description: string;
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

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinancePage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [accountForm, setAccountForm] = useState<AccountForm>({
    name: "",
    type: "cash",
    currency: "RUB",
    openingBalance: "0",
    comment: "",
  });

  const [topUpForm, setTopUpForm] = useState<TopUpForm>({
    accountId: "",
    amount: "",
    operationDate: todayDate(),
    description: "Пополнение счета",
  });

  const totalBalance = useMemo(() => {
    return accounts.reduce(
      (sum, account) => sum + Number(account.current_balance || 0),
      0
    );
  }, [accounts]);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("finance_accounts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setAccounts((data as FinanceAccount[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки счетов");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount(event: React.FormEvent) {
    event.preventDefault();

    const name = accountForm.name.trim();
    const openingBalance = Number(accountForm.openingBalance || 0);

    if (!name) {
      setError("Укажи название счета");
      return;
    }

    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      setError("Начальный остаток должен быть числом не меньше 0");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const { data: account, error: accountError } = await supabase
        .from("finance_accounts")
        .insert({
          name,
          type: accountForm.type,
          currency: accountForm.currency.trim() || "RUB",
          opening_balance: openingBalance,
          current_balance: openingBalance,
          comment: accountForm.comment.trim() || null,
        })
        .select("*")
        .single();

      if (accountError) throw accountError;

      if (openingBalance > 0 && account?.id) {
        const { error: transactionError } = await supabase
          .from("finance_transactions")
          .insert({
            account_id: account.id,
            type: "income",
            amount: openingBalance,
            operation_date: todayDate(),
            description: "Начальный остаток",
          });

        if (transactionError) throw transactionError;
      }

      setAccountForm({
        name: "",
        type: "cash",
        currency: "RUB",
        openingBalance: "0",
        comment: "",
      });

      await loadAccounts();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка создания счета");
    } finally {
      setSaving(false);
    }
  }

  async function handleTopUp(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(topUpForm.amount || 0);
    const account = accounts.find((item) => item.id === topUpForm.accountId);

    if (!account) {
      setError("Выбери счет для пополнения");
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Сумма пополнения должна быть больше 0");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const { error: transactionError } = await supabase
        .from("finance_transactions")
        .insert({
          account_id: account.id,
          type: "income",
          amount,
          operation_date: topUpForm.operationDate || todayDate(),
          description: topUpForm.description.trim() || "Пополнение счета",
        });

      if (transactionError) throw transactionError;

      const nextBalance = Number(account.current_balance || 0) + amount;

      const { error: accountError } = await supabase
        .from("finance_accounts")
        .update({ current_balance: nextBalance })
        .eq("id", account.id);

      if (accountError) throw accountError;

      setTopUpForm({
        accountId: account.id,
        amount: "",
        operationDate: todayDate(),
        description: "Пополнение счета",
      });

      await loadAccounts();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка пополнения счета");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: 22,
          border: "1px solid #dbe4f0",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
              Счета
            </div>
            <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.5 }}>
              Базовая точка учета денежных средств. Позже сюда привяжем оплаты поставщикам.
            </div>
          </div>

          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 16,
              padding: "12px 16px",
              minWidth: 180,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
              Общий баланс
            </div>
            <div style={{ marginTop: 4, color: "#1d4ed8", fontSize: 22, fontWeight: 900 }}>
              {toMoney(totalBalance, "RUB")}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 14,
              padding: 12,
              color: "#991b1b",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <form
          onSubmit={handleCreateAccount}
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 20,
            border: "1px solid #dbe4f0",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
            Создать счет
          </div>

          <input
            value={accountForm.name}
            onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
            placeholder="Название, например Касса"
            style={inputStyle}
          />

          <select
            value={accountForm.type}
            onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })}
            style={inputStyle}
          >
            {accountTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <input
            value={accountForm.currency}
            onChange={(event) => setAccountForm({ ...accountForm, currency: event.target.value.toUpperCase() })}
            placeholder="Валюта"
            style={inputStyle}
          />

          <input
            value={accountForm.openingBalance}
            onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })}
            placeholder="Начальный остаток"
            type="number"
            min="0"
            step="0.01"
            style={inputStyle}
          />

          <textarea
            value={accountForm.comment}
            onChange={(event) => setAccountForm({ ...accountForm, comment: event.target.value })}
            placeholder="Комментарий"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <button type="submit" disabled={saving} style={primaryButtonStyle}>
            {saving ? "Сохраняю..." : "Создать счет"}
          </button>
        </form>

        <form
          onSubmit={handleTopUp}
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 20,
            border: "1px solid #dbe4f0",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
            Пополнить счет
          </div>

          <select
            value={topUpForm.accountId}
            onChange={(event) => setTopUpForm({ ...topUpForm, accountId: event.target.value })}
            style={inputStyle}
          >
            <option value="">Выбери счет</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} — {toMoney(account.current_balance, account.currency)}
              </option>
            ))}
          </select>

          <input
            value={topUpForm.amount}
            onChange={(event) => setTopUpForm({ ...topUpForm, amount: event.target.value })}
            placeholder="Сумма"
            type="number"
            min="0"
            step="0.01"
            style={inputStyle}
          />

          <input
            value={topUpForm.operationDate}
            onChange={(event) => setTopUpForm({ ...topUpForm, operationDate: event.target.value })}
            type="date"
            style={inputStyle}
          />

          <textarea
            value={topUpForm.description}
            onChange={(event) => setTopUpForm({ ...topUpForm, description: event.target.value })}
            placeholder="Описание операции"
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          <button type="submit" disabled={saving || accounts.length === 0} style={primaryButtonStyle}>
            {saving ? "Сохраняю..." : "Пополнить"}
          </button>
        </form>
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: 20,
          border: "1px solid #dbe4f0",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>
          Текущие счета
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>Загрузка счетов...</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Счетов пока нет. Создай первый счет, например “Касса”.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {accounts.map((account) => (
              <div
                key={account.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 17 }}>
                    {account.name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    {accountTypes.find((type) => type.value === account.type)?.label || account.type} · {account.currency}
                  </div>
                  {account.comment && (
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
                      {account.comment}
                    </div>
                  )}
                </div>

                <div style={{ color: "#16a34a", fontSize: 20, fontWeight: 900 }}>
                  {toMoney(account.current_balance, account.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
