import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import FinanceTransactionDetailsModal from "../components/FinanceTransactionDetailsModal";
import SupplierPaymentModal from "./purchases/SupplierPaymentModal";

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

type AccountForm = {
  name: string;
  type: string;
  currency: string;
  openingBalance: string;
  comment: string;
};

type MoneyOperationForm = {
  accountId: string;
  categoryId: string;
  amount: string;
  operationDate: string;
  description: string;
};

type CategoryForm = {
  name: string;
  type: "income" | "expense";
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
  source_document_type?: string | null;
  source_document_id?: string | null;
};

type EmployeeItem = {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
};

type TransactionUpdatePayload = {
  accountId: string;
  categoryId: string | null;
  type: string;
  amount: number;
  operationDate: string;
  description: string | null;
};

type ModalType = "account" | "income" | "expense" | "category" | null;
type FinanceTab = "operations" | "categories";
type FinancePeriod = "month" | "quarter" | "year";

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

const emptyAccountForm: AccountForm = {
  name: "",
  type: "cash",
  currency: "RUB",
  openingBalance: "0",
  comment: "",
};

const emptyOperationForm: MoneyOperationForm = {
  accountId: "",
  categoryId: "",
  amount: "",
  operationDate: todayDate(),
  description: "",
};

const emptyCategoryForm: CategoryForm = {
  name: "",
  type: "expense",
};

export default function FinancePage() {
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDeletingId, setCategoryDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryMessage, setCategoryMessage] = useState("");
  const [modalType, setModalType] = useState<ModalType>(null);
  const [activeTab, setActiveTab] = useState<FinanceTab>("operations");
  const [period, setPeriod] = useState<FinancePeriod>("month");
  const [periodAnchor, setPeriodAnchor] = useState(todayDate().slice(0, 7));
  const [selectedTransaction, setSelectedTransaction] =
    useState<FinanceTransaction | null>(null);
  const [linkedPaymentId, setLinkedPaymentId] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccountForm);
  const [operationForm, setOperationForm] =
    useState<MoneyOperationForm>(emptyOperationForm);
  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(emptyCategoryForm);

  const totalBalance = useMemo(() => {
    return accounts.reduce(
      (sum, account) => sum + Number(account.current_balance || 0),
      0
    );
  }, [accounts]);

  const incomeCategories = useMemo(
    () => categories.filter((item) => item.type === "income" && item.is_active),
    [categories]
  );

  const expenseCategories = useMemo(
    () => categories.filter((item) => item.type === "expense" && item.is_active),
    [categories]
  );

  useEffect(() => {
    loadAccounts();
    loadTransactions();
    loadCategories();
    loadEmployees();
  }, []);

  function openModal(type: ModalType) {
    setError("");
    setCategoryError("");
    setModalType(type);

    if (type === "account") {
      setAccountForm(emptyAccountForm);
      return;
    }

    if (type === "category") {
      setCategoryForm(emptyCategoryForm);
      return;
    }

    const categoryList = type === "income" ? incomeCategories : expenseCategories;

    setOperationForm({
      ...emptyOperationForm,
      accountId: accounts[0]?.id || "",
      categoryId: categoryList[0]?.id || "",
      description: type === "income" ? "Пополнение счета" : "Расход",
    });
  }

  function closeModal() {
    if (saving || categorySaving) return;
    setModalType(null);
    setError("");
    setCategoryError("");
  }

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

  async function loadTransactions() {
    try {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .order("operation_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions((data as FinanceTransaction[]) || []);
    } catch (error) {
      console.error("Ошибка загрузки операций", error);
    }
  }

  async function loadCategories() {
    try {
      const { data, error } = await supabase
        .from("finance_categories")
        .select("*")
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setCategories((data as FinanceCategory[]) || []);
    } catch (error) {
      console.error("Ошибка загрузки статей", error);
      setCategories([]);
    }
  }

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, auth_user_id, full_name")
        .order("full_name", { ascending: true });

      if (error) throw error;

      setEmployees((data as EmployeeItem[]) || []);
    } catch (error) {
      console.error("Ошибка загрузки сотрудников", error);
      setEmployees([]);
    }
  }

  function getTransactionOperatorName(transaction: FinanceTransaction) {
    if (!transaction.created_by) return "—";

    const employee = employees.find(
      (item) => item.auth_user_id === transaction.created_by
    );

    return employee?.full_name || "Пользователь системы";
  }

  function getCategoryName(categoryId: string | null) {
    if (!categoryId) return "Без статьи";

    return categories.find((item) => item.id === categoryId)?.name || "Без статьи";
  }

  function getCategoryTypeLabel(type: string) {
    if (type === "income") return "Доход";
    if (type === "expense") return "Расход";
    return type;
  }

  async function getCurrentUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
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

      const currentUserId = await getCurrentUserId();

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
            created_by: currentUserId,
          });

        if (transactionError) throw transactionError;
      }

      setAccountForm(emptyAccountForm);
      setModalType(null);
      await loadAccounts();
      await loadTransactions();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка создания счета");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory(event: React.FormEvent) {
    event.preventDefault();

    const name = categoryForm.name.trim();

    if (!name) {
      setCategoryError("Укажи название статьи");
      return;
    }

    try {
      setCategorySaving(true);
      setCategoryError("");
      setCategoryMessage("");

      const { error } = await supabase
        .from("finance_categories")
        .insert({
          name,
          type: categoryForm.type,
          is_active: true,
        });

      if (error) throw error;

      setCategoryForm(emptyCategoryForm);
      setModalType(null);
      setCategoryMessage("Статья добавлена.");
      await loadCategories();
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Ошибка создания статьи"
      );
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleToggleCategory(category: FinanceCategory) {
    try {
      setCategoryDeletingId(category.id);
      setCategoryError("");
      setCategoryMessage("");

      const { error } = await supabase
        .from("finance_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;

      setCategoryMessage(
        category.is_active ? "Статья отключена." : "Статья включена."
      );
      await loadCategories();
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Не удалось изменить статью"
      );
    } finally {
      setCategoryDeletingId(null);
    }
  }

  async function handleMoneyOperation(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(operationForm.amount || 0);
    const account = accounts.find((item) => item.id === operationForm.accountId);

    if (!account) {
      setError("Выбери счет");
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Сумма должна быть больше 0");
      return;
    }

    const currentBalance = Number(account.current_balance || 0);
    const isExpense = modalType === "expense";

    if (isExpense && amount > currentBalance) {
      setError("Недостаточно средств на счете");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const currentUserId = await getCurrentUserId();

      const { error: transactionError } = await supabase
        .from("finance_transactions")
        .insert({
          account_id: account.id,
          category_id: operationForm.categoryId || null,
          type: isExpense ? "expense" : "income",
          amount,
          operation_date: operationForm.operationDate || todayDate(),
          description:
            operationForm.description.trim() ||
            (isExpense ? "Расход" : "Пополнение счета"),
          created_by: currentUserId,
        });

      if (transactionError) throw transactionError;

      const nextBalance = isExpense
        ? currentBalance - amount
        : currentBalance + amount;

      const { error: accountError } = await supabase
        .from("finance_accounts")
        .update({ current_balance: nextBalance })
        .eq("id", account.id);

      if (accountError) throw accountError;

      setOperationForm(emptyOperationForm);
      setModalType(null);
      await loadAccounts();
      await loadTransactions();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка операции");
    } finally {
      setSaving(false);
    }
  }

  function applyTransactionToBalance(
    balance: number,
    transactionType: string,
    amount: number
  ) {
    if (transactionType === "income") return balance + amount;
    if (transactionType === "expense") return balance - amount;
    return balance;
  }

  function rollbackTransactionFromBalance(
    balance: number,
    transactionType: string,
    amount: number
  ) {
    if (transactionType === "income") return balance - amount;
    if (transactionType === "expense") return balance + amount;
    return balance;
  }

  async function handleUpdateTransaction(
    transaction: FinanceTransaction,
    payload: TransactionUpdatePayload
  ) {
    const oldAccount = accounts.find((item) => item.id === transaction.account_id);
    const newAccount = accounts.find((item) => item.id === payload.accountId);

    if (!oldAccount || !newAccount) {
      throw new Error("Счет операции не найден");
    }

    const oldAmount = Number(transaction.amount || 0);
    const oldAccountBalance = Number(oldAccount.current_balance || 0);
    const newAccountBalance = Number(newAccount.current_balance || 0);

    let nextOldAccountBalance = rollbackTransactionFromBalance(
      oldAccountBalance,
      transaction.type,
      oldAmount
    );

    let nextNewAccountBalance =
      oldAccount.id === newAccount.id ? nextOldAccountBalance : newAccountBalance;

    nextNewAccountBalance = applyTransactionToBalance(
      nextNewAccountBalance,
      payload.type,
      payload.amount
    );

    if (nextOldAccountBalance < 0 || nextNewAccountBalance < 0) {
      throw new Error("После редактирования баланс счета не может быть отрицательным");
    }

    const { error: transactionError } = await supabase
      .from("finance_transactions")
      .update({
        account_id: payload.accountId,
        category_id: payload.categoryId,
        type: payload.type,
        amount: payload.amount,
        operation_date: payload.operationDate,
        description: payload.description,
      })
      .eq("id", transaction.id);

    if (transactionError) throw transactionError;

    if (oldAccount.id === newAccount.id) {
      const { error: accountError } = await supabase
        .from("finance_accounts")
        .update({ current_balance: nextNewAccountBalance })
        .eq("id", oldAccount.id);

      if (accountError) throw accountError;
    } else {
      const { error: oldAccountError } = await supabase
        .from("finance_accounts")
        .update({ current_balance: nextOldAccountBalance })
        .eq("id", oldAccount.id);

      if (oldAccountError) throw oldAccountError;

      const { error: newAccountError } = await supabase
        .from("finance_accounts")
        .update({ current_balance: nextNewAccountBalance })
        .eq("id", newAccount.id);

      if (newAccountError) throw newAccountError;
    }

    await loadAccounts();
    await loadTransactions();

    setSelectedTransaction((prev) =>
      prev
        ? {
            ...prev,
            account_id: payload.accountId,
            category_id: payload.categoryId,
            type: payload.type,
            amount: payload.amount,
            operation_date: payload.operationDate,
            description: payload.description,
          }
        : prev
    );
  }

  const categoryTotals = useMemo(() => {
    return categories.map((category) => {
      const total = transactions
        .filter((transaction) => transaction.category_id === category.id)
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      return {
        ...category,
        total,
      };
    });
  }, [categories, transactions]);


  const periodRange = useMemo(() => {
    const [yearValue, monthValue] = periodAnchor.split("-").map(Number);
    const anchor = new Date(yearValue, Math.max(0, monthValue - 1), 1);

    let start = new Date(anchor);
    let end = new Date(anchor);

    if (period === "month") {
      end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    } else if (period === "quarter") {
      const quarterMonth = Math.floor(anchor.getMonth() / 3) * 3;
      start = new Date(anchor.getFullYear(), quarterMonth, 1);
      end = new Date(anchor.getFullYear(), quarterMonth + 3, 1);
    } else {
      start = new Date(anchor.getFullYear(), 0, 1);
      end = new Date(anchor.getFullYear() + 1, 0, 1);
    }

    return { start, end };
  }, [period, periodAnchor]);

  const periodTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const date = new Date(`${transaction.operation_date}T00:00:00`);
      return date >= periodRange.start && date < periodRange.end;
    });
  }, [transactions, periodRange]);

  const periodIncome = useMemo(
    () =>
      periodTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [periodTransactions]
  );

  const periodExpense = useMemo(
    () =>
      periodTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [periodTransactions]
  );

  const periodNet = periodIncome - periodExpense;

  const chartData = useMemo(() => {
    const endKey = periodRange.end.getTime();
    const netAfterPeriod = transactions.reduce((sum, item) => {
      const date = new Date(`${item.operation_date}T00:00:00`).getTime();
      if (date < endKey) return sum;
      const amount = Number(item.amount || 0);
      return sum + (item.type === "income" ? amount : item.type === "expense" ? -amount : 0);
    }, 0);

    const periodEndingBalance = totalBalance - netAfterPeriod;
    const openingBalance = periodEndingBalance - periodNet;
    const grouped = new Map<string, { income: number; expense: number }>();

    [...periodTransactions]
      .sort((a, b) => a.operation_date.localeCompare(b.operation_date))
      .forEach((item) => {
        const current = grouped.get(item.operation_date) || { income: 0, expense: 0 };
        const amount = Number(item.amount || 0);
        if (item.type === "income") current.income += amount;
        if (item.type === "expense") current.expense += amount;
        grouped.set(item.operation_date, current);
      });

    let balance = openingBalance;
    const points = [...grouped.entries()].map(([date, values]) => {
      balance += values.income - values.expense;
      return { date, ...values, balance };
    });

    return { openingBalance, endingBalance: periodEndingBalance, points };
  }, [transactions, periodTransactions, periodRange, totalBalance, periodNet]);

  const periodLabel = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    });

    if (period === "month") return formatter.format(periodRange.start);

    if (period === "quarter") {
      const quarter = Math.floor(periodRange.start.getMonth() / 3) + 1;
      return `${quarter} квартал ${periodRange.start.getFullYear()}`;
    }

    return String(periodRange.start.getFullYear());
  }, [period, periodRange]);

  function formatOperationDate(value: string) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
    }).format(date);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={heroCardStyle}>
        <div style={financeToolbarStyle}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Финансы
            </div>
            <div style={{ color: "#64748b", marginTop: 5 }}>
              Деньги, счета и движение средств в одном месте
            </div>
          </div>

          <div style={toolbarActionsStyle}>
            <input
              type="month"
              value={periodAnchor}
              onChange={(event) => setPeriodAnchor(event.target.value)}
              style={monthInputStyle}
            />
            <button type="button" onClick={() => openModal("income")} disabled={accounts.length === 0} style={incomeButtonStyle}>
              + Поступление
            </button>
            <button type="button" onClick={() => openModal("expense")} disabled={accounts.length === 0} style={expenseButtonStyle}>
              − Расход
            </button>
            <button
              type="button"
              disabled
              title="Переводы между счетами добавим следующим этапом"
              style={transferButtonStyle}
            >
              ⇄ Между счетами
            </button>
          </div>
        </div>

        <div style={balanceHeroStyle}>
          <div>
            <div style={eyebrowStyle}>Общий остаток</div>
            <div style={bigBalanceStyle}>{toMoney(totalBalance, "RUB")}</div>
            <div style={{ marginTop: 8, color: periodNet >= 0 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>
              {periodNet >= 0 ? "+" : ""}
              {toMoney(periodNet)} за {periodLabel}
            </div>
          </div>

          <div style={summaryPillsStyle}>
            <div style={summaryPillStyle("#ecfdf5", "#047857")}>
              <span>Поступления</span>
              <strong>+ {toMoney(periodIncome)}</strong>
            </div>
            <div style={summaryPillStyle("#fef2f2", "#b91c1c")}>
              <span>Расходы</span>
              <strong>− {toMoney(periodExpense)}</strong>
            </div>
            <div style={summaryPillStyle("#eff6ff", "#1d4ed8")}>
              <span>Разница</span>
              <strong>{periodNet >= 0 ? "+" : ""}{toMoney(periodNet)}</strong>
            </div>
          </div>
        </div>

        <div style={accountsStripStyle}>
          {accounts.map((account) => (
            <div key={account.id} style={accountMiniCardStyle}>
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                {accountTypes.find((item) => item.value === account.type)?.label || account.type}
              </div>
              <div style={{ color: "#0f172a", fontSize: 15, fontWeight: 900, marginTop: 4 }}>
                {account.name}
              </div>
              <div style={{ color: "#1d4ed8", fontSize: 18, fontWeight: 900, marginTop: 10 }}>
                {toMoney(account.current_balance, account.currency)}
              </div>
            </div>
          ))}

          <button type="button" onClick={() => openModal("account")} style={addAccountCardStyle}>
            <span style={{ fontSize: 22 }}>+</span>
            <span>Добавить счёт</span>
          </button>
        </div>

        {error && !modalType && <ErrorBox message={error} />}
      </div>

      <div style={cardStyle}>
        <div style={sectionHeaderCompactStyle}>
          <div>
            <div style={sectionTitleLargeStyle}>Движение денег</div>
            <div style={sectionSubtitleStyle}>Остаток, поступления и расходы за выбранный период</div>
          </div>

          <div style={periodTabsStyle}>
            {([
              ["month", "Месяц"],
              ["quarter", "Квартал"],
              ["year", "Год"],
            ] as [FinancePeriod, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                style={period === value ? periodTabActiveStyle : periodTabStyle}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <FinanceOverviewChart
          points={chartData.points}
          openingBalance={chartData.openingBalance}
          endingBalance={chartData.endingBalance}
        />
      </div>

      <div style={cardStyle}>
        <div style={tabsStyle}>
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            style={activeTab === "operations" ? activeTabStyle : tabStyle}
          >
            Операции
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            style={activeTab === "categories" ? activeTabStyle : tabStyle}
          >
            Статьи
          </button>
        </div>
      </div>

      {activeTab === "operations" && (
        <div style={cardStyle}>
          <div style={sectionHeaderCompactStyle}>
            <div>
              <div style={sectionTitleLargeStyle}>История операций</div>
              <div style={sectionSubtitleStyle}>
                Нажми на строку, чтобы открыть карточку операции и связанный документ
              </div>
            </div>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
              {periodTransactions.length} операций
            </div>
          </div>

          {periodTransactions.length === 0 ? (
            <div style={emptyOperationsStyle}>За выбранный период операций нет.</div>
          ) : (
            <div style={operationsTableWrapStyle}>
              <table style={operationsTableStyle}>
                <thead>
                  <tr>
                    <th style={operationsThStyle}>Дата</th>
                    <th style={operationsThStyle}>Операция</th>
                    <th style={operationsThStyle}>Статья</th>
                    <th style={operationsThStyle}>Счёт</th>
                    <th style={{ ...operationsThStyle, textAlign: "right" }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {periodTransactions.map((transaction) => {
                    const account = accounts.find((item) => item.id === transaction.account_id);
                    const isIncome = transaction.type === "income";

                    return (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        style={operationTrStyle}
                        title="Открыть карточку операции"
                      >
                        <td style={operationsTdStyle}>{formatOperationDate(transaction.operation_date)}</td>
                        <td style={operationsTdStyle}>
                          <div style={{ color: "#0f172a", fontWeight: 900 }}>
                            {transaction.description || (isIncome ? "Поступление" : "Расход")}
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
                            {transaction.source_document_type ? "Есть связанный документ" : isIncome ? "Приход" : "Расход"}
                          </div>
                        </td>
                        <td style={operationsTdStyle}>
                          <span style={categoryBadgeStyle}>{getCategoryName(transaction.category_id)}</span>
                        </td>
                        <td style={operationsTdStyle}>{account?.name || "Счёт удалён"}</td>
                        <td style={{ ...operationsTdStyle, textAlign: "right" }}>
                          <span style={{ color: isIncome ? "#15803d" : "#dc2626", fontWeight: 900, fontSize: 16 }}>
                            {isIncome ? "+" : "−"} {toMoney(transaction.amount, account?.currency || "RUB")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "categories" && (
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                Статьи доходов и расходов
              </div>
              <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
                Статьи помогают понимать, на что уходят деньги и откуда приходит доход.
              </div>
            </div>

            <button
              type="button"
              onClick={() => openModal("category")}
              style={primaryButtonStyle}
            >
              Добавить статью
            </button>
          </div>

          {categoryMessage && (
            <div style={successBoxStyle}>{categoryMessage}</div>
          )}

          {categoryError && (
            <div style={errorBoxStyle}>{categoryError}</div>
          )}

          <div style={categoryColumnsStyle}>
            <CategoryColumn
              title="Доходы"
              type="income"
              categories={categoryTotals.filter((item) => item.type === "income")}
              onToggle={handleToggleCategory}
              loadingId={categoryDeletingId}
            />

            <CategoryColumn
              title="Расходы"
              type="expense"
              categories={categoryTotals.filter((item) => item.type === "expense")}
              onToggle={handleToggleCategory}
              loadingId={categoryDeletingId}
            />
          </div>
        </div>
      )}

      {selectedTransaction && (
        <FinanceTransactionDetailsModal
          transaction={selectedTransaction}
          account={
            accounts.find((item) => item.id === selectedTransaction.account_id) ||
            null
          }
          accounts={accounts}
          categories={categories.filter(
            (item) => item.type === selectedTransaction.type && item.is_active
          )}
          allCategories={categories}
          operatorName={getTransactionOperatorName(selectedTransaction)}
          onClose={() => setSelectedTransaction(null)}
          onSave={handleUpdateTransaction}
          onOpenSupplierPayment={(paymentId) => {
            setSelectedTransaction(null);
            setLinkedPaymentId(paymentId);
          }}
        />
      )}

      {linkedPaymentId && (
        <SupplierPaymentModal
          paymentId={linkedPaymentId}
          onClose={() => setLinkedPaymentId(null)}
          onSaved={() => {
            setLinkedPaymentId(null);
            loadAccounts();
            loadTransactions();
          }}
        />
      )}

      {modalType === "account" && (
        <Modal title="Добавить счет" onClose={closeModal}>
          <form onSubmit={handleCreateAccount} style={{ display: "grid", gap: 12 }}>
            {error && <ErrorBox message={error} />}
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
        </Modal>
      )}

      {modalType === "category" && (
        <Modal title="Добавить статью" onClose={closeModal}>
          <form onSubmit={handleCreateCategory} style={{ display: "grid", gap: 12 }}>
            {categoryError && <ErrorBox message={categoryError} />}
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm({ ...categoryForm, name: event.target.value })
              }
              placeholder="Название статьи"
              style={inputStyle}
            />
            <select
              value={categoryForm.type}
              onChange={(event) =>
                setCategoryForm({
                  ...categoryForm,
                  type: event.target.value as "income" | "expense",
                })
              }
              style={inputStyle}
            >
              <option value="income">Доход</option>
              <option value="expense">Расход</option>
            </select>
            <button type="submit" disabled={categorySaving} style={primaryButtonStyle}>
              {categorySaving ? "Сохраняю..." : "Создать статью"}
            </button>
          </form>
        </Modal>
      )}

      {(modalType === "income" || modalType === "expense") && (
        <Modal
          title={modalType === "income" ? "Пополнить счет" : "Расход"}
          onClose={closeModal}
        >
          <form onSubmit={handleMoneyOperation} style={{ display: "grid", gap: 12 }}>
            {error && <ErrorBox message={error} />}
            <select
              value={operationForm.accountId}
              onChange={(event) =>
                setOperationForm({ ...operationForm, accountId: event.target.value })
              }
              style={inputStyle}
            >
              <option value="">Выбери счет</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {toMoney(account.current_balance, account.currency)}
                </option>
              ))}
            </select>

            <select
              value={operationForm.categoryId}
              onChange={(event) =>
                setOperationForm({ ...operationForm, categoryId: event.target.value })
              }
              style={inputStyle}
            >
              <option value="">Без статьи</option>
              {(modalType === "income" ? incomeCategories : expenseCategories).map(
                (category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                )
              )}
            </select>

            <input
              value={operationForm.amount}
              onChange={(event) => setOperationForm({ ...operationForm, amount: event.target.value })}
              placeholder="Сумма"
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
            />
            <input
              value={operationForm.operationDate}
              onChange={(event) => setOperationForm({ ...operationForm, operationDate: event.target.value })}
              type="date"
              style={inputStyle}
            />
            <textarea
              value={operationForm.description}
              onChange={(event) => setOperationForm({ ...operationForm, description: event.target.value })}
              placeholder="Описание операции"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button
              type="submit"
              disabled={saving || accounts.length === 0}
              style={modalType === "expense" ? dangerButtonStyle : primaryButtonStyle}
            >
              {saving ? "Сохраняю..." : modalType === "expense" ? "Списать расход" : "Пополнить"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}


function FinanceOverviewChart({
  points,
  openingBalance,
  endingBalance,
}: {
  points: { date: string; income: number; expense: number; balance: number }[];
  openingBalance: number;
  endingBalance: number;
}) {
  const width = 1000;
  const height = 280;
  const paddingX = 42;
  const paddingTop = 24;
  const paddingBottom = 42;
  const values = [openingBalance, endingBalance, ...points.map((item) => item.balance)];
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const range = Math.max(1, maxValue - minValue);
  const usableHeight = height - paddingTop - paddingBottom;

  const chartPoints = [
    { date: "", income: 0, expense: 0, balance: openingBalance },
    ...points,
  ];

  const xForIndex = (index: number) => {
    if (chartPoints.length <= 1) return width / 2;
    return paddingX + (index / (chartPoints.length - 1)) * (width - paddingX * 2);
  };

  const yForValue = (value: number) =>
    paddingTop + ((maxValue - value) / range) * usableHeight;

  const polyline = chartPoints
    .map((item, index) => `${xForIndex(index)},${yForValue(item.balance)}`)
    .join(" ");

  const maxFlow = Math.max(
    1,
    ...points.map((item) => Math.max(item.income, item.expense))
  );

  return (
    <div style={chartWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minHeight: 260, display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = paddingTop + step * usableHeight;
          return (
            <line
              key={step}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {points.map((item, index) => {
          const x = xForIndex(index + 1);
          const incomeHeight = (item.income / maxFlow) * 72;
          const expenseHeight = (item.expense / maxFlow) * 72;
          const zeroY = height - paddingBottom;

          return (
            <g key={item.date}>
              <rect x={x - 9} y={zeroY - incomeHeight} width="7" height={incomeHeight} rx="2" fill="#22c55e" opacity="0.75" />
              <rect x={x + 2} y={zeroY - expenseHeight} width="7" height={expenseHeight} rx="2" fill="#ef4444" opacity="0.75" />
            </g>
          );
        })}

        <polyline
          points={polyline}
          fill="none"
          stroke="#2563eb"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {chartPoints.map((item, index) => (
          <circle
            key={`${item.date}-${index}`}
            cx={xForIndex(index)}
            cy={yForValue(item.balance)}
            r={index === chartPoints.length - 1 ? 6 : 4}
            fill="#2563eb"
          />
        ))}
      </svg>

      <div style={chartLegendStyle}>
        <span><i style={{ ...legendDotStyle, background: "#2563eb" }} /> Остаток</span>
        <span><i style={{ ...legendDotStyle, background: "#22c55e" }} /> Поступления</span>
        <span><i style={{ ...legendDotStyle, background: "#ef4444" }} /> Расходы</span>
        <span style={{ marginLeft: "auto", color: "#334155", fontWeight: 900 }}>
          На конец периода: {toMoney(endingBalance)}
        </span>
      </div>
    </div>
  );
}

function CategoryColumn({
  title,
  type,
  categories,
  onToggle,
  loadingId,
}: {
  title: string;
  type: "income" | "expense";
  categories: (FinanceCategory & { total: number })[];
  onToggle: (category: FinanceCategory) => void;
  loadingId: string | null;
}) {
  const accent = type === "income" ? "#16a34a" : "#dc2626";

  return (
    <div style={categoryColumnStyle}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {categories.length === 0 ? (
        <div style={{ color: "#64748b", lineHeight: 1.5 }}>
          Статей пока нет
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {categories.map((category) => (
            <div
              key={category.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                opacity: category.is_active ? 1 : 0.55,
              }}
            >
              <div>
                <div style={{ color: accent, fontWeight: 900 }}>
                  {category.name}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
                  {category.is_active ? "Активна" : "Отключена"} ·{" "}
                  {toMoney(category.total)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggle(category)}
                disabled={loadingId === category.id}
                style={secondarySmallButtonStyle}
              >
                {loadingId === category.id
                  ? "..."
                  : category.is_active
                  ? "Отключить"
                  : "Включить"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
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
          width: "min(520px, 100%)",
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
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 900 }}>
            {title}
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div style={errorBoxStyle}>{message}</div>;
}

const heroCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 22,
  padding: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
};

const financeToolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const toolbarActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const monthInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 800,
};

const incomeButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 11,
  padding: "11px 14px",
  background: "#16a34a",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
};

const expenseButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 11,
  padding: "11px 14px",
  background: "#ef4444",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
};

const transferButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "10px 14px",
  background: "#f8fafc",
  color: "#64748b",
  cursor: "not-allowed",
  fontWeight: 900,
};

const balanceHeroStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 20,
  borderRadius: 18,
  background: "linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%)",
  border: "1px solid #dbeafe",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const bigBalanceStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: "clamp(30px, 5vw, 46px)",
  fontWeight: 950,
  marginTop: 5,
  letterSpacing: "-0.03em",
};

const summaryPillsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
  gap: 10,
  flex: "1 1 520px",
};

function summaryPillStyle(background: string, color: string): React.CSSProperties {
  return {
    background,
    color,
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 5,
    minWidth: 0,
  };
}

const accountsStripStyle: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
};

const accountMiniCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
};

const addAccountCardStyle: React.CSSProperties = {
  border: "1px dashed #93c5fd",
  borderRadius: 16,
  padding: 14,
  background: "#f8fbff",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 88,
};

const sectionHeaderCompactStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 14,
};

const sectionTitleLargeStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const sectionSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
};

const periodTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  padding: 4,
  borderRadius: 12,
  background: "#f1f5f9",
};

const periodTabStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 9,
  padding: "8px 11px",
  background: "transparent",
  color: "#64748b",
  cursor: "pointer",
  fontWeight: 800,
};

const periodTabActiveStyle: React.CSSProperties = {
  ...periodTabStyle,
  background: "#ffffff",
  color: "#2563eb",
  boxShadow: "0 3px 10px rgba(15, 23, 42, 0.08)",
};

const chartWrapStyle: React.CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 16,
  padding: 10,
  overflow: "hidden",
  background: "#ffffff",
};

const chartLegendStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "4px 8px 6px",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const legendDotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 99,
  display: "inline-block",
  marginRight: 5,
};

const operationsTableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const operationsTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 760,
};

const operationsThStyle: React.CSSProperties = {
  padding: "11px 12px",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  textAlign: "left",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const operationsTdStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  fontSize: 13,
  verticalAlign: "middle",
};

const operationTrStyle: React.CSSProperties = {
  cursor: "pointer",
  background: "#ffffff",
};

const categoryBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 800,
};

const emptyOperationsStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 20,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const balanceCardStyle: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  padding: "12px 16px",
  minWidth: 180,
};

const accountRowStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const tabStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 16px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 800,
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  border: "1px solid #bfdbfe",
  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
  color: "#ffffff",
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

const dangerButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
  boxShadow: "0 8px 18px rgba(220, 38, 38, 0.22)",
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

const categoryColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
};

const categoryColumnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#f8fbff",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 0,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 14,
  padding: 12,
  color: "#991b1b",
  fontWeight: 700,
};

const successBoxStyle: React.CSSProperties = {
  marginBottom: 12,
  background: "#dcfce7",
  border: "1px solid #86efac",
  borderRadius: 14,
  padding: 12,
  color: "#166534",
  fontWeight: 700,
};
