import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Employee = {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  telegram: string | null;
  payment_type: string | null;
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

type RecentAction = {
  id: string;
  text: string;
  time: string;
};

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

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

  const alertsOpen = externalAlertsOpen ?? localAlertsOpen;
  const setAlertsOpen = externalSetAlertsOpen ?? setLocalAlertsOpen;
  const employeesOpen = externalEmployeesOpen ?? localEmployeesOpen;
  const setEmployeesOpen = externalSetEmployeesOpen ?? setLocalEmployeesOpen;
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);

  const [loading, setLoading] = useState(false);
  const [payingUserId, setPayingUserId] = useState<string | null>(null);
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

      const [ordersResult, batchesResult, operationsResult, logsResult, shiftsResult] =
        await Promise.all([
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
        ]);

      if (ordersResult.error) throw ordersResult.error;
      if (batchesResult.error) throw batchesResult.error;
      if (operationsResult.error) throw operationsResult.error;
      if (logsResult.error) throw logsResult.error;
      if (shiftsResult.error) throw shiftsResult.error;

      setOrders((ordersResult.data as ProductionOrder[]) || []);
      setBatches((batchesResult.data as ProductionBatch[]) || []);
      setOperations((operationsResult.data as ProductionOperation[]) || []);
      setLogs((logsResult.data as ProductionLog[]) || []);
      setShifts((shiftsResult.data as EmployeeShift[]) || []);
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Ошибка загрузки дашборда"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePayEmployeeShifts(item: PayableEmployeeStats) {
    if (item.unpaidShiftIds.length === 0) return;

    const confirmed = window.confirm(
      `Отметить как выплачено: ${item.name}, ${item.unpaidShiftsCount} смен(ы), сумма ${formatMoney(item.payableAmount)}?`
    );

    if (!confirmed) return;

    try {
      setPayingUserId(item.userId);
      setDashboardError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Администратор не найден");

      const { error } = await supabase
        .from("employee_shifts")
        .update({
          is_paid: true,
          paid_at: new Date().toISOString(),
          paid_by: user.id,
        })
        .in("id", item.unpaidShiftIds);

      if (error) throw error;

      await loadDashboardData();
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Не удалось отметить выплату"
      );
    } finally {
      setPayingUserId(null);
    }
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

  const recentActions: RecentAction[] = useMemo(() => {
    return logs.slice(0, 8).map((log) => ({
      id: log.id,
      time: formatDateTime(log.finished_at),
      text: `${log.operation_name || "Операция"} · ${Number(
        log.quantity || 0
      )} шт · ${formatMoney(log.earned_amount || 0)}`,
    }));
  }, [logs]);

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
                      <TableCell text={item.name} strong />
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
                          onPay={handlePayEmployeeShifts}
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
              <StatCard label="Готово сегодня" value={`${doneTodayQuantity} шт`} />
              <StatCard label="Заработано сегодня" value={formatMoney(earnedToday)} />
            </div>
          </div>
        )}
      </div>

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
    </>
  );
}

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