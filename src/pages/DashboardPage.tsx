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
  alerts: string[];
  alertsOpen: boolean;
  setAlertsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  employeesOpen: boolean;
  setEmployeesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  employees: Employee[];
  employeesLoading: boolean;
  employeesError: string;
};

export default function DashboardPage({
  alerts,
  alertsOpen,
  setAlertsOpen,
  employeesOpen,
  setEmployeesOpen,
  employees,
  employeesLoading,
  employeesError,
}: DashboardPageProps) {
  return (
    <>
      {alerts.length > 0 && (
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
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 700,
              color: "#1d4ed8",
            }}
          >
            <span>Требует внимания: {alerts.length}</span>
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
              {alerts.map((item) => (
                <div
                  key={item}
                  style={{
                    background: "#ffffff",
                    borderRadius: 12,
                    padding: 12,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setEmployeesOpen((prev) => !prev)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            padding: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            fontWeight: 700,
            color: "#111827",
          }}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 16, color: "#6b7280" }}>Заданий в работе</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#111827",
              marginTop: 8,
            }}
          >
            14
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 16, color: "#6b7280" }}>Готово сегодня</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#111827",
              marginTop: 8,
            }}
          >
            86
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 16, color: "#6b7280" }}>
            Просроченные заказы
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: "#111827",
              marginTop: 8,
            }}
          >
            2
          </div>
        </div>
      </div>
    </>
  );
}