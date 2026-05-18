import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Employee = {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  telegram: string | null;
  payment_type: string | null;
<<<<<<< HEAD
  bank_name?: string | null;
  weekly_salary_amount?: number | null;
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
  is_active: boolean | null;
  notes: string | null;
  created_at: string | null;
};

type DashboardPageProps = {
  alerts?: string[];
  alertsOpen?: boolean;
  setAlertsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  employeesOpen?: boolean;
  setEmployeesOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  employees?: Employee[];
  employeesLoading?: boolean;
  employeesError?: string;
};

type ProductionOrder = {
  id: string;
  status: string;
  quantity: number;
  created_at: string | null;
};

type ProductionBatch = {
  id: string;
  batch_number: string;
  production_order_id: string;
  quantity: number;
  completed_quantity: number | null;
  status: string | null;
  current_operation_order: number | null;
  product_name: string | null;
  product_article: string | null;
  assigned_user_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  created_at: string | null;
};

type ProductionOperation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  completed_quantity: number;
};

type ProductionLog = {
  id: string;
  user_id: string | null;
  operation_name: string | null;
  quantity: number | null;
  earned_amount: number | null;
  duration_seconds: number | null;
  finished_at: string | null;
};

type EmployeeShift = {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: string;
  total_quantity: number | null;
  total_earned: number | null;
  is_paid: boolean | null;
  paid_at: string | null;
  paid_by: string | null;
};

type OperationQueueItem = {
  operationName: string;
  waiting: number;
  partial: number;
  inProgress: number;
};

type FinanceAccount = {
  id: string;
  name: string;
  type: string | null;
  currency: string | null;
  current_balance: number | string;
};


type EmployeeTodayStats = {
  userId: string;
  name: string;
  operationsCount: number;
  quantity: number;
  earned: number;
  durationSeconds: number;
};

type PayableEmployeeStats = {
  userId: string;
  name: string;
  unpaidShiftIds: string[];
  unpaidShiftsCount: number;
  totalQuantity: number;
  payableAmount: number;
  firstOpenedAt: string | null;
  lastClosedAt: string | null;
};

type EmployeePaymentRow = {
  userId: string;
  name: string;
  operationsCount: number;
  todayQuantity: number;
  todayEarned: number;
  durationSeconds: number;
  unpaidShiftIds: string[];
  unpaidShiftsCount: number;
  payableQuantity: number;
  payableAmount: number;
  firstOpenedAt: string | null;
  lastClosedAt: string | null;
};

<<<<<<< HEAD
type EmployeeOnShiftCard = {
  userId: string;
  name: string;
  employee: Employee | null;
  shift: EmployeeShift;
  operationsCount: number;
  quantity: number;
  earned: number;
  shiftDurationSeconds: number;
};


=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
type RecentAction = {
  id: string;
  text: string;
  time: string;
};

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

<<<<<<< HEAD

function getNextThursdayLabel() {
  const today = new Date();
  const day = today.getDay();
  const diff = day <= 4 ? 4 - day : 7 - day + 4;

  const nextThursday = new Date(today);
  nextThursday.setDate(today.getDate() + diff);

  return nextThursday.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}


function formatPaymentType(value: string | null | undefined) {
  switch (value) {
    case "salary":
      return "Оклад";
    case "piece":
      return "Сдельно";
    case "percent":
      return "Процент";
    default:
      return value || "—";
  }
}

function formatBankName(value: string | null | undefined) {
  switch (value) {
    case "sber":
      return "Сбер";
    case "alfa":
      return "Альфа";
    case "tbank":
      return "ТБанк";
    case "ozon":
      return "Озон";
    default:
      return value || "—";
  }
}

function formatWeeklySalary(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (amount <= 0) return "—";
  return `${amount.toFixed(2)} ₽`;
}

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "pending":
      return "Ожидает";
    case "waiting":
      return "Ожидает";
    case "partial":
      return "Пауза";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    case "cancelled":
      return "Отменён";
    case "archived":
      return "Архив";
    default:
      return status || "—";
  }
}

function getHoursFromNow(value: string | null) {
  if (!value) return 0;
  return (Date.now() - new Date(value).getTime()) / 1000 / 60 / 60;
}

export default function DashboardPage({
  alerts = [],
  alertsOpen: externalAlertsOpen,
  setAlertsOpen: externalSetAlertsOpen,
  employeesOpen: externalEmployeesOpen,
  setEmployeesOpen: externalSetEmployeesOpen,
  employees = [],
  employeesLoading = false,
  employeesError = "",
}: DashboardPageProps) {
  const [localAlertsOpen, setLocalAlertsOpen] = useState(false);
  const [localEmployeesOpen, setLocalEmployeesOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(true);
<<<<<<< HEAD
  const [recentActionsOpen, setRecentActionsOpen] = useState(true);
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa

  const alertsOpen = externalAlertsOpen ?? localAlertsOpen;
  const setAlertsOpen = externalSetAlertsOpen ?? setLocalAlertsOpen;
  const employeesOpen = externalEmployeesOpen ?? localEmployeesOpen;
  const setEmployeesOpen = externalSetEmployeesOpen ?? setLocalEmployeesOpen;
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
<<<<<<< HEAD
  const [openShifts, setOpenShifts] = useState<EmployeeShift[]>([]);
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa

  const [loading, setLoading] = useState(false);
  const [payingUserId, setPayingUserId] = useState<string | null>(null);
  const [selectedPayoutEmployee, setSelectedPayoutEmployee] =
    useState<PayableEmployeeStats | null>(null);
<<<<<<< HEAD
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedShiftEmployee, setSelectedShiftEmployee] = useState<EmployeeOnShiftCard | null>(null);
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [selectedFinanceAccountId, setSelectedFinanceAccountId] = useState("");
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setDashboardError("");

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [
        ordersResult,
        batchesResult,
        operationsResult,
        logsResult,
        shiftsResult,
<<<<<<< HEAD
        openShiftsResult,
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
        financeAccountsResult,
      ] = await Promise.all([
          supabase
            .from("production_orders")
            .select("id, status, quantity, created_at")
            .order("created_at", { ascending: false }),

          supabase
            .from("production_batches")
            .select(
              "id, batch_number, production_order_id, quantity, completed_quantity, status, current_operation_order, product_name, product_article, assigned_user_id, assigned_at, started_at, created_at"
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("production_order_operations")
            .select(
              "id, production_order_id, operation_name, sort_order, status, completed_quantity"
            )
            .order("sort_order", { ascending: true }),

          supabase
            .from("production_operation_logs")
            .select(
              "id, user_id, operation_name, quantity, earned_amount, duration_seconds, finished_at"
            )
            .gte("finished_at", startOfDay.toISOString())
            .order("finished_at", { ascending: false }),

          supabase
            .from("employee_shifts")
            .select(
              "id, user_id, opened_at, closed_at, status, total_quantity, total_earned, is_paid, paid_at, paid_by"
            )
            .eq("status", "closed")
            .or("is_paid.eq.false,is_paid.is.null")
            .order("closed_at", { ascending: false }),

          supabase
<<<<<<< HEAD
            .from("employee_shifts")
            .select(
              "id, user_id, opened_at, closed_at, status, total_quantity, total_earned, is_paid, paid_at, paid_by"
            )
            .eq("status", "open")
            .order("opened_at", { ascending: true }),

          supabase
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
            .from("finance_accounts")
            .select("id, name, type, currency, current_balance")
            .eq("is_active", true)
            .order("created_at", { ascending: true }),
        ]);

      if (ordersResult.error) throw ordersResult.error;
      if (batchesResult.error) throw batchesResult.error;
      if (operationsResult.error) throw operationsResult.error;
      if (logsResult.error) throw logsResult.error;
      if (shiftsResult.error) throw shiftsResult.error;
<<<<<<< HEAD
      if (openShiftsResult.error) throw openShiftsResult.error;
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
      if (financeAccountsResult.error) throw financeAccountsResult.error;

      setFinanceAccounts((financeAccountsResult.data as FinanceAccount[]) || []);

      setOrders((ordersResult.data as ProductionOrder[]) || []);
      setBatches((batchesResult.data as ProductionBatch[]) || []);
      setOperations((operationsResult.data as ProductionOperation[]) || []);
      setLogs((logsResult.data as ProductionLog[]) || []);
      setShifts((shiftsResult.data as EmployeeShift[]) || []);
<<<<<<< HEAD
      setOpenShifts((openShiftsResult.data as EmployeeShift[]) || []);
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Ошибка загрузки дашборда"
      );
    } finally {
      setLoading(false);
    }
  }

  function openEmployeePayoutModal(item: PayableEmployeeStats) {
    if (item.unpaidShiftIds.length === 0) return;

    setSelectedPayoutEmployee(item);
    setSelectedFinanceAccountId(financeAccounts[0]?.id || "");
  }

<<<<<<< HEAD
  function openEmployeeCard(userId: string) {
    const employee = employees.find((item) => item.id === userId);
    if (!employee) return;

    setSelectedEmployee(employee);
  }

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
  async function handlePayEmployeeShifts(
    item: PayableEmployeeStats,
    financeAccountId: string,
  ) {
    if (item.unpaidShiftIds.length === 0) return;

    try {
      setPayingUserId(item.userId);
      setDashboardError("");

      const account = financeAccounts.find(
        (financeAccount) => financeAccount.id === financeAccountId,
      );

      if (!account) {
        throw new Error("Выбери финансовый счёт для выплаты");
      }

      const amount = Number(item.payableAmount || 0);

      if (amount <= 0) {
        throw new Error("Сумма выплаты должна быть больше 0");
      }

      const currentBalance = Number(account.current_balance || 0);

      if (amount > currentBalance) {
        throw new Error("Недостаточно средств на выбранном счёте");
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Администратор не найден");

      const now = new Date().toISOString();

      const { error: transactionError } = await supabase
        .from("finance_transactions")
        .insert({
          account_id: financeAccountId,
          type: "expense",
          amount,
          operation_date: now.slice(0, 10),
          description: `Выплата сотруднику ${item.name}`,
          source_document_type: "employee_payout",
          source_document_id: item.unpaidShiftIds[0],
          category: "employee_salary",
          counterparty_id: item.userId,
          comment: `Смен к оплате: ${item.unpaidShiftsCount}; смены: ${item.unpaidShiftIds.join(", ")}`,
        });

      if (transactionError) throw transactionError;

      const { error: accountError } = await supabase
        .from("finance_accounts")
        .update({
          current_balance: currentBalance - amount,
          updated_at: now,
        })
        .eq("id", financeAccountId);

      if (accountError) throw accountError;

      const { error } = await supabase
        .from("employee_shifts")
        .update({
          is_paid: true,
          paid_at: now,
          paid_by: user.id,
        })
        .in("id", item.unpaidShiftIds);

      if (error) throw error;

      setSelectedPayoutEmployee(null);
      await loadDashboardData();
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Не удалось отметить выплату"
      );
    } finally {
      setPayingUserId(null);
    }
  }

  async function confirmEmployeePayout() {
    if (!selectedPayoutEmployee) return;

    await handlePayEmployeeShifts(
      selectedPayoutEmployee,
      selectedFinanceAccountId,
    );
  }

  const activeOrders = orders.filter(
    (order) => !["done", "cancelled", "archived"].includes(order.status)
  );

  const waitingBatches = batches.filter(
    (batch) => batch.status === "waiting" || batch.status === "pending"
  );

  const partialBatches = batches.filter((batch) => batch.status === "partial");

  const inProgressBatches = batches.filter(
    (batch) => batch.status === "in_progress"
  );

  const doneTodayQuantity = logs.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const earnedToday = logs.reduce(
    (sum, item) => sum + Number(item.earned_amount || 0),
    0
  );

  const operationQueue: OperationQueueItem[] = useMemo(() => {
    const map = new Map<string, OperationQueueItem>();

    batches.forEach((batch) => {
      const operation = operations.find(
        (item) =>
          item.production_order_id === batch.production_order_id &&
          item.sort_order === Number(batch.current_operation_order || 0)
      );

      const operationName = operation?.operation_name || "Операция не найдена";

      if (!map.has(operationName)) {
        map.set(operationName, {
          operationName,
          waiting: 0,
          partial: 0,
          inProgress: 0,
        });
      }

      const item = map.get(operationName);
      if (!item) return;

      if (batch.status === "waiting" || batch.status === "pending") {
        item.waiting += 1;
      }

      if (batch.status === "partial") {
        item.partial += 1;
      }

      if (batch.status === "in_progress") {
        item.inProgress += 1;
      }
    });

    return Array.from(map.values()).filter(
      (item) => item.waiting > 0 || item.partial > 0 || item.inProgress > 0
    );
  }, [batches, operations]);

  const employeeStats: EmployeeTodayStats[] = useMemo(() => {
    const map = new Map<string, EmployeeTodayStats>();

    logs.forEach((log) => {
      const userId = log.user_id || "unknown";
      const employee = employees.find((item) => item.id === userId);

      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          name: employee?.full_name || "Сотрудник",
          operationsCount: 0,
          quantity: 0,
          earned: 0,
          durationSeconds: 0,
        });
      }

      const item = map.get(userId);
      if (!item) return;

      item.operationsCount += 1;
      item.quantity += Number(log.quantity || 0);
      item.earned += Number(log.earned_amount || 0);
      item.durationSeconds += Number(log.duration_seconds || 0);
    });

    return Array.from(map.values()).sort((a, b) => b.earned - a.earned);
  }, [logs, employees]);

  const payableEmployees: PayableEmployeeStats[] = useMemo(() => {
    const map = new Map<string, PayableEmployeeStats>();

    shifts.forEach((shift) => {
      if (shift.is_paid) return;

      const userId = shift.user_id;
      const employee = employees.find((item) => item.id === userId);

      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          name: employee?.full_name || "Сотрудник",
          unpaidShiftIds: [],
          unpaidShiftsCount: 0,
          totalQuantity: 0,
          payableAmount: 0,
          firstOpenedAt: shift.opened_at || null,
          lastClosedAt: shift.closed_at || null,
        });
      }

      const item = map.get(userId);
      if (!item) return;

      item.unpaidShiftIds.push(shift.id);
      item.unpaidShiftsCount += 1;
      item.totalQuantity += Number(shift.total_quantity || 0);
      item.payableAmount += Number(shift.total_earned || 0);

      if (
        shift.opened_at &&
        (!item.firstOpenedAt || new Date(shift.opened_at) < new Date(item.firstOpenedAt))
      ) {
        item.firstOpenedAt = shift.opened_at;
      }

      if (
        shift.closed_at &&
        (!item.lastClosedAt || new Date(shift.closed_at) > new Date(item.lastClosedAt))
      ) {
        item.lastClosedAt = shift.closed_at;
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.payableAmount - a.payableAmount
    );
  }, [shifts, employees]);

  const employeePaymentRows: EmployeePaymentRow[] = useMemo(() => {
    const map = new Map<string, EmployeePaymentRow>();

    function ensureRow(userId: string, name: string) {
      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          name,
          operationsCount: 0,
          todayQuantity: 0,
          todayEarned: 0,
          durationSeconds: 0,
          unpaidShiftIds: [],
          unpaidShiftsCount: 0,
          payableQuantity: 0,
          payableAmount: 0,
          firstOpenedAt: null,
          lastClosedAt: null,
        });
      }

      return map.get(userId)!;
    }

    employeeStats.forEach((item) => {
      const row = ensureRow(item.userId, item.name);

      row.operationsCount = item.operationsCount;
      row.todayQuantity = item.quantity;
      row.todayEarned = item.earned;
      row.durationSeconds = item.durationSeconds;
    });

    payableEmployees.forEach((item) => {
      const row = ensureRow(item.userId, item.name);

      row.unpaidShiftIds = item.unpaidShiftIds;
      row.unpaidShiftsCount = item.unpaidShiftsCount;
      row.payableQuantity = item.totalQuantity;
      row.payableAmount = item.payableAmount;
      row.firstOpenedAt = item.firstOpenedAt;
      row.lastClosedAt = item.lastClosedAt;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.payableAmount !== a.payableAmount) {
        return b.payableAmount - a.payableAmount;
      }

      return b.todayEarned - a.todayEarned;
    });
  }, [employeeStats, payableEmployees]);

<<<<<<< HEAD

  const salaryEmployees = useMemo(() => {
    return employees
      .filter((employee) => {
        return (
          employee.is_active !== false &&
          employee.payment_type?.includes("salary") &&
          Number(employee.weekly_salary_amount || 0) > 0
        );
      })
      .sort((a, b) => {
        return (a.full_name || "").localeCompare(b.full_name || "", "ru");
      });
  }, [employees]);

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
  const problemBatches = useMemo(() => {
    return batches
      .filter((batch) => {
        if (batch.status === "in_progress") {
          return getHoursFromNow(batch.started_at || batch.assigned_at) >= 2;
        }

        if (batch.status === "partial") {
          return getHoursFromNow(batch.started_at || batch.assigned_at) >= 8;
        }

        if (batch.status === "waiting") {
          return getHoursFromNow(batch.created_at) >= 24;
        }

        return false;
      })
      .slice(0, 8);
  }, [batches]);

<<<<<<< HEAD

  const employeesOnShift: EmployeeOnShiftCard[] = useMemo(() => {
    return openShifts.map((shift) => {
      const employee = employees.find((item) => item.id === shift.user_id) || null;
      const todayStats = employeeStats.find((item) => item.userId === shift.user_id);
      const openedAt = shift.opened_at ? new Date(shift.opened_at).getTime() : Date.now();

      return {
        userId: shift.user_id,
        name: employee?.full_name || "Без имени",
        employee,
        shift,
        operationsCount: todayStats?.operationsCount || 0,
        quantity: todayStats?.quantity || 0,
        earned: todayStats?.earned || 0,
        shiftDurationSeconds: Math.max(0, Math.floor((Date.now() - openedAt) / 1000)),
      };
    });
  }, [openShifts, employees, employeeStats]);

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
  const recentActions: RecentAction[] = useMemo(() => {
    return logs.slice(0, 8).map((log) => ({
      id: log.id,
      time: formatDateTime(log.finished_at),
      text: `${log.operation_name || "Операция"} · ${Number(
        log.quantity || 0
      )} шт · ${formatMoney(log.earned_amount || 0)}`,
    }));
  }, [logs]);

<<<<<<< HEAD
  return (
    <>
=======
  const dynamicAlerts = [
    ...alerts,
    ...problemBatches.map(
      (batch) =>
        `Пачка ${batch.batch_number} требует внимания: ${getStatusLabel(
          batch.status
        )}`
    ),
  ];

  return (
    <>
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #93c5fd",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setAlertsOpen((prev) => !prev)}
          style={sectionButtonStyle("#1d4ed8", 16)}
        >
          <span>Требует внимания: {dynamicAlerts.length}</span>
          <span>{alertsOpen ? "▲" : "▼"}</span>
        </button>

        {alertsOpen && (
          <div
            style={{
              padding: "0 16px 16px 16px",
              display: "grid",
              gap: 10,
            }}
          >
            {dynamicAlerts.length === 0 && (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: 12,
                  border: "1px solid #bfdbfe",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                Сейчас нет уведомлений.
              </div>
            )}

            {dynamicAlerts.map((item) => (
              <div
                key={item}
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: 12,
                  border: "1px solid #bfdbfe",
                  color: "#1e3a8a",
                  fontWeight: 700,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
      {dashboardError && (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          Ошибка дашборда: {dashboardError}
        </div>
      )}

<<<<<<< HEAD

      <Panel title="Сегодня на смене">
        {employeesOnShift.length === 0 && (
          <EmptyText text="Сейчас нет сотрудников с открытой сменой" />
        )}

        {employeesOnShift.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {employeesOnShift.map((item) => (
              <button
                key={item.shift.id}
                type="button"
                onClick={() => setSelectedShiftEmployee(item)}
                style={shiftEmployeeCardStyle}
              >
                <div style={shiftEmployeeNameStyle}>{item.name}</div>
                <div style={shiftEmployeeMetaStyle}>
                  Смена открыта: {formatDateTime(item.shift.opened_at)}
                </div>
                <div style={shiftEmployeeStatsStyle}>
                  <span>{item.operationsCount} опер.</span>
                  <span>{item.quantity} шт</span>
                  <span>{formatMoney(item.earned)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
      <Panel title="Сотрудники сегодня и к выплате">        {employeesLoading && <EmptyText text="Загрузка сотрудников..." />}

        {employeesError && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            Ошибка: {employeesError}
          </div>
        )}

        {!employeesLoading &&
          !employeesError &&
          employeePaymentRows.length === 0 && (
            <EmptyText text="Сегодня пока нет закрытых операций и неоплаченных смен" />
          )}

        {employeePaymentRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 980,
              }}
            >
              <thead>
                <tr>
                  <TableHead text="Сотрудник" />
                  <TableHead text="Операций сегодня" />
                  <TableHead text="Кол-во сегодня" />
                  <TableHead text="Заработано сегодня" />
                  <TableHead text="Время" />
                  <TableHead text="Смен к оплате" />
                  <TableHead text="Кол-во к оплате" />
                  <TableHead text="К выплате" />
                  <TableHead text="Действие" />
                </tr>
              </thead>

              <tbody>
                {employeePaymentRows.map((item) => {
                  const payableItem: PayableEmployeeStats = {
                    userId: item.userId,
                    name: item.name,
                    unpaidShiftIds: item.unpaidShiftIds,
                    unpaidShiftsCount: item.unpaidShiftsCount,
                    totalQuantity: item.payableQuantity,
                    payableAmount: item.payableAmount,
                    firstOpenedAt: item.firstOpenedAt,
                    lastClosedAt: item.lastClosedAt,
                  };

                  return (
                    <tr key={item.userId}>
<<<<<<< HEAD
                      <EmployeeNameCell
                        name={item.name}
                        onClick={() => openEmployeeCard(item.userId)}
                      />
=======
                      <TableCell text={item.name} strong />
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
                      <TableCell text={`${item.operationsCount}`} />
                      <TableCell text={`${item.todayQuantity} шт`} />
                      <TableCell text={formatMoney(item.todayEarned)} strong />
                      <TableCell text={formatTimer(item.durationSeconds)} />
                      <TableCell text={`${item.unpaidShiftsCount}`} />
                      <TableCell text={`${item.payableQuantity} шт`} />
                      <TableCell text={formatMoney(item.payableAmount)} strong />
                      {item.unpaidShiftIds.length > 0 ? (
                        <PayableActionCell
                          item={payableItem}
                          disabled={payingUserId === item.userId || loading}
                          onPay={openEmployeePayoutModal}
                        />
                      ) : (
                        <td style={tableCellStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              borderRadius: 999,
                              padding: "8px 12px",
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}
                          >
                            Нет к выплате
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

<<<<<<< HEAD

      {salaryEmployees.length > 0 && (
        <Panel title="Предстоящие выплаты по окладу">
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 760,
              }}
            >
              <thead>
                <tr>
                  <TableHead text="Сотрудник" />
                  <TableHead text="Банк" />
                  <TableHead text="Оклад в неделю" />
                  <TableHead text="Ближайшая выплата" />
                  <TableHead text="Статус" />
                </tr>
              </thead>

              <tbody>
                {salaryEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td style={tableCellStyle}>
                      <button
                        type="button"
                        onClick={() => openEmployeeCard(employee.id)}
                        style={employeeNameButtonStyle}
                      >
                        {employee.full_name || "Без имени"}
                      </button>
                    </td>
                    <TableCell text={formatBankName(employee.bank_name)} />
                    <TableCell
                      text={formatMoney(Number(employee.weekly_salary_amount || 0))}
                      strong
                    />
                    <TableCell text={getNextThursdayLabel()} />
                    <td style={tableCellStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          borderRadius: 999,
                          padding: "8px 12px",
                          background: "#fff7ed",
                          color: "#b45309",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Ожидает выплаты
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5edf7",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setProductionOpen((prev) => !prev)}
          style={sectionButtonStyle("#111827", 22)}
        >
          <span>Дашборд производства</span>
          <span style={{ fontSize: 16 }}>{productionOpen ? "▲" : "▼"}</span>
        </button>

        {productionOpen && (
          <div style={{ padding: "0 16px 16px 16px", display: "grid", gap: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#64748b" }}>
                Контроль заказов, пачек, сотрудников и узких мест
              </div>

              <button onClick={loadDashboardData} style={secondaryButtonStyle}>
                {loading ? "Обновление..." : "Обновить"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              <StatCard label="Активных заказов" value={`${activeOrders.length}`} />
              <StatCard label="Пачек ждёт" value={`${waitingBatches.length}`} />
              <StatCard label="Пачек в работе" value={`${inProgressBatches.length}`} />
              <StatCard label="Пачек на паузе" value={`${partialBatches.length}`} />
<<<<<<< HEAD
=======
              <StatCard label="Готово сегодня" value={`${doneTodayQuantity} шт`} />
              <StatCard label="Заработано сегодня" value={formatMoney(earnedToday)} />
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
            </div>
          </div>
        )}
      </div>
<<<<<<< HEAD
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5edf7",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setRecentActionsOpen((prev) => !prev)}
          style={sectionButtonStyle("#111827", 22)}
        >
          <span>Последние действия</span>
          <span style={{ fontSize: 16 }}>{recentActionsOpen ? "▲" : "▼"}</span>
        </button>

        {recentActionsOpen && (
          <div style={{ padding: "0 16px 16px 16px" }}>
            {recentActions.length === 0 && (
              <EmptyText text="Сегодня пока нет действий" />
            )}

            {recentActions.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {recentActions.map((item) => (
                  <div key={item.id} style={recentRowStyle}>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      {item.time}
                    </div>
                    <div style={{ fontWeight: 700, color: "#111827" }}>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa

      <Panel title="Очередь по операциям">
        {operationQueue.length === 0 && (
          <EmptyText text="Очередь по операциям пока пустая" />
        )}

        {operationQueue.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {operationQueue.map((item) => (
              <div key={item.operationName} style={queueRowStyle}>
                <div style={{ fontWeight: 800, color: "#111827" }}>
                  {item.operationName}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <Badge label={`Ждёт: ${item.waiting}`} />
                  <Badge label={`Пауза: ${item.partial}`} />
                  <Badge label={`В работе: ${item.inProgress}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

<<<<<<< HEAD



      {selectedShiftEmployee && (
        <div
          onClick={() => setSelectedShiftEmployee(null)}
          style={employeeModalOverlayStyle}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={employeeModalStyle}
          >
            <div style={employeeModalHeaderStyle}>
              <div>
                <div style={employeeModalTitleStyle}>Сотрудник на смене</div>
                <div style={employeeModalSubtitleStyle}>
                  {selectedShiftEmployee.name}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftEmployee(null)}
                style={payoutCloseButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={employeeCardGridStyle}>
              <EmployeeInfoRow label="ФИО" value={selectedShiftEmployee.name} />
              <EmployeeInfoRow
                label="Смена открыта"
                value={formatDateTime(selectedShiftEmployee.shift.opened_at)}
              />
              <EmployeeInfoRow
                label="Время на смене"
                value={formatTimer(selectedShiftEmployee.shiftDurationSeconds)}
              />
              <EmployeeInfoRow
                label="Операций сегодня"
                value={`${selectedShiftEmployee.operationsCount}`}
              />
              <EmployeeInfoRow
                label="Кол-во сегодня"
                value={`${selectedShiftEmployee.quantity} шт`}
              />
              <EmployeeInfoRow
                label="Заработано сегодня"
                value={formatMoney(selectedShiftEmployee.earned)}
              />
              <EmployeeInfoRow
                label="Телефон"
                value={selectedShiftEmployee.employee?.phone}
              />
              <EmployeeInfoRow
                label="Банк"
                value={formatBankName(selectedShiftEmployee.employee?.bank_name)}
              />
            </div>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div
          onClick={() => setSelectedEmployee(null)}
          style={employeeModalOverlayStyle}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={employeeModalStyle}
          >
            <div style={employeeModalHeaderStyle}>
              <div>
                <div style={employeeModalTitleStyle}>Карточка сотрудника</div>
                <div style={employeeModalSubtitleStyle}>
                  {selectedEmployee.full_name || "Без имени"}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                style={payoutCloseButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={employeeCardGridStyle}>
              <EmployeeInfoRow label="ФИО" value={selectedEmployee.full_name} />
              <EmployeeInfoRow label="Роль" value={selectedEmployee.role} />
              <EmployeeInfoRow label="Телефон" value={selectedEmployee.phone} />
              <EmployeeInfoRow label="Telegram" value={selectedEmployee.telegram} />
              <EmployeeInfoRow
                label="Тип оплаты"
                value={formatPaymentType(selectedEmployee.payment_type)}
              />
              <EmployeeInfoRow
                label="Банк"
                value={formatBankName(selectedEmployee.bank_name)}
              />
              <EmployeeInfoRow
                label="Оклад в неделю"
                value={formatWeeklySalary(selectedEmployee.weekly_salary_amount)}
              />
              <EmployeeInfoRow
                label="Статус"
                value={selectedEmployee.is_active ? "Активен" : "Неактивен"}
              />
              <EmployeeInfoRow
                label="Создан"
                value={formatDateTime(selectedEmployee.created_at)}
              />
              <EmployeeInfoRow label="Заметки" value={selectedEmployee.notes} wide />
            </div>
          </div>
        </div>
      )}

=======
      <Panel title="Последние действия">
        {recentActions.length === 0 && (
          <EmptyText text="Сегодня пока нет действий" />
        )}

        {recentActions.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {recentActions.map((item) => (
              <div key={item.id} style={recentRowStyle}>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {item.time}
                </div>
                <div style={{ fontWeight: 700, color: "#111827" }}>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setEmployeesOpen((prev) => !prev)}
          style={sectionButtonStyle("#111827", 22)}
        >
          <span>Сотрудники</span>
          <span style={{ fontSize: 16 }}>{employeesOpen ? "▲" : "▼"}</span>
        </button>

        {employeesOpen && (
          <div
            style={{
              padding: "0 16px 16px 16px",
            }}
          >
            {employeesLoading && (
              <div style={{ color: "#6b7280" }}>Загрузка сотрудников...</div>
            )}

            {employeesError && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                Ошибка: {employeesError}
              </div>
            )}

            {!employeesLoading && !employeesError && employees.length === 0 && (
              <div style={{ color: "#6b7280" }}>Сотрудников пока нет</div>
            )}

            {!employeesLoading && !employeesError && employees.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                {employees.map((emp) => (
                  <div
                    key={emp.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 12,
                      background: "#fff",
                      minHeight: 120,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: 6,
                      }}
                    >
                      {emp.full_name || "Без имени"}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      {emp.role || "Без роли"}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginBottom: 4,
                      }}
                    >
                      Оплата: {emp.payment_type || "—"}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: emp.is_active ? "#166534" : "#991b1b",
                        fontWeight: 600,
                      }}
                    >
                      {emp.is_active ? "Активен" : "Неактивен"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
      {selectedPayoutEmployee && (
        <div
          onClick={() => setSelectedPayoutEmployee(null)}
          style={payoutModalOverlayStyle}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={payoutModalStyle}
          >
            <div style={payoutModalHeaderStyle}>
              <div>
                <div style={payoutModalTitleStyle}>Выплата сотруднику</div>
                <div style={payoutModalSubtitleStyle}>
                  {selectedPayoutEmployee.name} ·{" "}
                  {selectedPayoutEmployee.unpaidShiftsCount} смен(ы)
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayoutEmployee(null)}
                style={payoutCloseButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={payoutInfoGridStyle}>
              <div style={payoutInfoCardStyle}>
                <div style={payoutInfoLabelStyle}>Количество</div>
                <div style={payoutInfoValueStyle}>
                  {selectedPayoutEmployee.payableQuantity} шт
                </div>
              </div>

              <div style={payoutInfoCardStyle}>
                <div style={payoutInfoLabelStyle}>К выплате</div>
                <div style={payoutInfoValueStyle}>
                  {formatMoney(selectedPayoutEmployee.payableAmount)}
                </div>
              </div>
            </div>

            <label style={payoutLabelStyle}>
              <span style={payoutLabelTextStyle}>Счёт списания</span>
              <select
                value={selectedFinanceAccountId}
                onChange={(event) =>
                  setSelectedFinanceAccountId(event.target.value)
                }
                style={payoutSelectStyle}
              >
                <option value="">Выбери счёт</option>
                {financeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {formatMoney(Number(account.current_balance || 0))}
                  </option>
                ))}
              </select>
            </label>

            <div style={payoutHintStyle}>
              Будет создана финансовая операция “Выплата сотруднику”, деньги
              спишутся с выбранного счёта, а смены будут отмечены как
              выплаченные.
            </div>

            <div style={payoutActionsStyle}>
              <button
                type="button"
                onClick={() => setSelectedPayoutEmployee(null)}
                style={payoutCancelButtonStyle}
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={confirmEmployeePayout}
                disabled={
                  !selectedFinanceAccountId ||
                  payingUserId === selectedPayoutEmployee.userId
                }
                style={{
                  ...payoutConfirmButtonStyle,
                  opacity:
                    !selectedFinanceAccountId ||
                    payingUserId === selectedPayoutEmployee.userId
                      ? 0.65
                      : 1,
                  cursor:
                    !selectedFinanceAccountId ||
                    payingUserId === selectedPayoutEmployee.userId
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {payingUserId === selectedPayoutEmployee.userId
                  ? "Провожу..."
                  : "Выплатить"}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

<<<<<<< HEAD

const shiftEmployeeCardStyle: React.CSSProperties = {
  textAlign: "left",
  border: "1px solid #dbeafe",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 14,
  cursor: "pointer",
};

const shiftEmployeeNameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
  marginBottom: 8,
};

const shiftEmployeeMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 12,
};

const shiftEmployeeStatsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 800,
};

const employeeNameButtonStyle: React.CSSProperties = {
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const employeeModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10080,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const employeeModalStyle: React.CSSProperties = {
  width: "min(620px, 96vw)",
  background: "#ffffff",
  borderRadius: 22,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
  padding: 20,
};

const employeeModalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const employeeModalTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const employeeModalSubtitleStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748b",
  fontWeight: 700,
};

const employeeCardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const employeeInfoRowStyle: React.CSSProperties = {
  border: "1px solid #e5edf7",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
};

const employeeInfoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 5,
};

const employeeInfoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 800,
  whiteSpace: "pre-wrap",
};

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
const payoutModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10090,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const payoutModalStyle: React.CSSProperties = {
  width: "min(560px, 96vw)",
  background: "#ffffff",
  borderRadius: 22,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 14,
};

const payoutModalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const payoutModalTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const payoutModalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 4,
};

const payoutCloseButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 22,
  fontWeight: 900,
};

const payoutInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const payoutInfoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 12,
};

const payoutInfoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 5,
};

const payoutInfoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const payoutLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const payoutLabelTextStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const payoutSelectStyle: React.CSSProperties = {
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

const payoutHintStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 12,
  lineHeight: 1.5,
  fontWeight: 700,
};

const payoutActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const payoutCancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: 900,
};

const payoutConfirmButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: 900,
};


function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 18,
        border: "1px solid #e5edf7",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 14, color: "#6b7280" }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#111827",
          marginTop: 8,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 16,
        border: "1px solid #e5edf7",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "#111827",
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {label}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: "#f8fbff",
        borderRadius: 12,
        border: "1px solid #e5edf7",
        color: "#64748b",
        fontWeight: 600,
      }}
    >
      {text}
    </div>
  );
}

<<<<<<< HEAD
function EmployeeNameCell({
  name,
  onClick,
}: {
  name: string;
  onClick: () => void;
}) {
  return (
    <td style={tableCellStyle}>
      <button type="button" onClick={onClick} style={employeeNameButtonStyle}>
        {name}
      </button>
    </td>
  );
}

function EmployeeInfoRow({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        ...employeeInfoRowStyle,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={employeeInfoLabelStyle}>{label}</div>
      <div style={employeeInfoValueStyle}>{value || "—"}</div>
    </div>
  );
}

=======
>>>>>>> 1e104071b1a47b574d078017426f52b5701ddeaa
function TableHead({ text }: { text: string }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 8px",
        borderBottom: "1px solid #e5e7eb",
        color: "#64748b",
        fontSize: 13,
      }}
    >
      {text}
    </th>
  );
}

function TableCell({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <td
      style={{
        padding: "10px 8px",
        borderBottom: "1px solid #f1f5f9",
        color: "#111827",
        fontWeight: strong ? 800 : 500,
      }}
    >
      {text}
    </td>
  );
}

function PayableActionCell({
  item,
  disabled,
  onPay,
}: {
  item: PayableEmployeeStats;
  disabled: boolean;
  onPay: (item: PayableEmployeeStats) => void;
}) {
  return (
    <td
      style={{
        padding: "10px 8px",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <button
        onClick={() => onPay(item)}
        disabled={disabled}
        style={{
          border: "none",
          borderRadius: 10,
          padding: "8px 10px",
          background: disabled ? "#94a3b8" : "#16a34a",
          color: "#ffffff",
          fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {disabled ? "Сохраняю..." : "Отметить выплаченным"}
      </button>
    </td>
  );
}


function sectionButtonStyle(
  color: string,
  fontSize: number
): React.CSSProperties {
  return {
    width: "100%",
    background: "transparent",
    border: "none",
    padding: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize,
    fontWeight: 700,
    color,
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 800,
};

const gridTwoColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const queueRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5edf7",
  background: "#f8fbff",
};

const problemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fde68a",
  background: "#fffbeb",
};

const recentRowStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5edf7",
  background: "#f8fbff",
};
// --- ДОБАВЬ ЭТО ---
const tableHeaderStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #e5e7eb",
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "left",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 8px",
  borderBottom: "1px solid #e5e7eb",
  color: "#0f172a",
  fontWeight: 700,
};