import { useEffect, useState } from "react";
import Production from "./Production";
import QRScanner from "./QRScanner";

type Screen = "dashboard" | "production" | "scanner";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");

  const alerts = [
    "Пачка №124 зависла",
    "Заказ ORD-018 просрочен",
    "Сообщение от сотрудника",
  ];

  const employees = [
    { name: "Айгуль", status: "Шьёт", done: 18, pay: "900 ₽" },
    { name: "Марина", status: "Крой", done: 32, pay: "640 ₽" },
    { name: "Ольга", status: "Упаковка", done: 24, pay: "240 ₽" },
    { name: "Света", status: "Свободна", done: 0, pay: "0 ₽" },
  ];

  const menuItems = [
    { key: "dashboard", label: "Дашборд" },
    { key: "production", label: "Производство" },
    { key: "warehouse", label: "Склад" },
    { key: "purchase", label: "Закупка" },
    { key: "sales", label: "Продажи" },
    { key: "directories", label: "Справочники" },
    { key: "finance", label: "Финансы" },
    { key: "scanner", label: "Сканер QR" },
  ];

  const pageTitle =
    currentScreen === "dashboard"
      ? "Дашборд"
      : currentScreen === "production"
      ? "Производство"
      : "Сканер QR";

  const pageSubtitle =
    currentScreen === "dashboard"
      ? "Главный экран ERP"
      : currentScreen === "production"
      ? "Управление производством"
      : "Сканирование кодов";

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen]);

  function renderDashboard() {
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
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              {employees.map((emp) => (
                <div
                  key={emp.name}
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
                    {emp.name}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      marginBottom: 4,
                    }}
                  >
                    {emp.status}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: "#6b7280",
                      marginBottom: 6,
                    }}
                  >
                    {emp.done} шт
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#111827",
                    }}
                  >
                    {emp.pay}
                  </div>
                </div>
              ))}
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

  function renderContent() {
    if (currentScreen === "dashboard") return renderDashboard();
    if (currentScreen === "production") return <Production />;
    if (currentScreen === "scanner") return <QRScanner />;
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "stretch",
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              maxWidth: "82vw",
              height: "100%",
              background: "#111827",
              color: "#fff",
              padding: 20,
              boxSizing: "border-box",
              overflowY: "auto",
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}>ERP</div>

              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "#1f2937",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {menuItems.map((item) => {
                const isActive = item.key === currentScreen;

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      switch (item.key) {
                        case "dashboard":
                          setCurrentScreen("dashboard");
                          break;
                        case "production":
                          setCurrentScreen("production");
                          break;
                        case "scanner":
                          setCurrentScreen("scanner");
                          break;
                        default:
                          break;
                      }

                      setMenuOpen(false);
                    }}
                    style={{
                      background: isActive ? "#2563eb" : "#1f2937",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      <main
        style={{
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setMenuOpen(true)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#111827",
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#111827",
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#111827",
                    borderRadius: 2,
                  }}
                />
              </button>

              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
                  {pageTitle}
                </div>

                <div
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    marginTop: 4,
                  }}
                >
                  {pageSubtitle}
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 14,
                color: "#1d4ed8",
                whiteSpace: "nowrap",
              }}
            >
              Сегодня
            </div>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;