import { useEffect, useMemo, useRef, useState } from "react";
import Production, { type ProductionTab } from "./Production";
import QRScanner from "./QRScanner";
import AuthPage from "./AuthPage";
import DashboardPage from "./pages/DashboardPage";
import DirectoriesPage from "./pages/DirectoriesPage";
import EmployeesDirectory from "./directories/EmployeesDirectory";
import UnitsDirectory from "./directories/UnitsDirectory";
import MaterialsDirectory from "./directories/MaterialsDirectory";
import ConsumablesDirectory from "./directories/ConsumablesDirectory";
import ProductsDirectory from "./directories/ProductsDirectory";
import { supabase } from "./supabase";

type Screen =
  | "dashboard"
  | "production"
  | "scanner"
  | "directories"
  | "directory-employees"
  | "directory-suppliers"
  | "directory-counterparties"
  | "directory-products"
  | "directory-materials"
  | "directory-consumables"
  | "directory-operations"
  | "directory-variants"
  | "directory-units"
  | "directory-statuses";

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

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [employeesOpen, setEmployeesOpen] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [productionInitialTab, setProductionInitialTab] =
    useState<ProductionTab>("jobs");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const alerts = [
    "Пачка №124 зависла",
    "Заказ ORD-018 просрочен",
    "Сообщение от сотрудника",
  ];

  const menuItems = [
    { key: "dashboard", label: "Дашборд" },
    { key: "production", label: "Производство" },
    { key: "directories", label: "Справочники" },
    { key: "scanner", label: "Сканер QR" },
  ];

  const pageTitle =
    currentScreen === "dashboard"
      ? "Дашборд"
      : currentScreen === "production"
      ? "Производство"
      : currentScreen === "directories"
      ? "Справочники"
      : currentScreen === "directory-employees"
      ? "Сотрудники"
      : currentScreen === "directory-suppliers"
      ? "Поставщики"
      : currentScreen === "directory-counterparties"
      ? "Контрагенты"
      : currentScreen === "directory-products"
      ? "Изделия"
      : currentScreen === "directory-materials"
      ? "Материалы"
      : currentScreen === "directory-consumables"
      ? "Расходники"
      : currentScreen === "directory-operations"
      ? "Операции"
      : currentScreen === "directory-variants"
      ? "Цвета и размеры"
      : currentScreen === "directory-units"
      ? "Единицы измерения"
      : currentScreen === "directory-statuses"
      ? "Статусы"
      : "Сканер QR";

  const pageSubtitle =
    currentScreen === "dashboard"
      ? "Главный экран ERP"
      : currentScreen === "production"
      ? "Управление производством"
      : currentScreen === "directories"
      ? "Выбор нужного справочника"
      : currentScreen === "directory-employees"
      ? "Справочник сотрудников и входящие заявки"
      : currentScreen === "directory-suppliers"
      ? "Справочник поставщиков"
      : currentScreen === "directory-counterparties"
      ? "Справочник контрагентов"
      : currentScreen === "directory-products"
      ? "Справочник изделий"
      : currentScreen === "directory-materials"
      ? "Справочник материалов"
      : currentScreen === "directory-consumables"
      ? "Справочник расходников"
      : currentScreen === "directory-operations"
      ? "Справочник производственных операций"
      : currentScreen === "directory-variants"
      ? "Справочник цветов и размеров"
      : currentScreen === "directory-units"
      ? "Справочник единиц измерения"
      : currentScreen === "directory-statuses"
      ? "Справочник статусов"
      : "Сканирование кодов";

  const canGoBack = useMemo(() => {
    return currentScreen !== "dashboard";
  }, [currentScreen]);

  const userEmail = session?.user?.email || "";
  const userInitial = userEmail ? userEmail[0].toUpperCase() : "U";

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      loadEmployees();
    }
  }, [session]);

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);
      setEmployeesError("");

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      setEmployees((data as Employee[]) || []);
    } catch (error) {
      setEmployeesError(
        error instanceof Error ? error.message : "Ошибка загрузки сотрудников"
      );
    } finally {
      setEmployeesLoading(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    try {
      setLoginLoading(true);
      setLoginError("");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Ошибка входа");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    setUserMenuOpen(false);
    await supabase.auth.signOut();
  }

  function handleOpenDirectory(directoryKey: string) {
    switch (directoryKey) {
      case "employees":
        setCurrentScreen("directory-employees");
        break;
      case "suppliers":
        setCurrentScreen("directory-suppliers");
        break;
      case "counterparties":
        setCurrentScreen("directory-counterparties");
        break;
      case "products":
        setCurrentScreen("directory-products");
        break;
      case "materials":
        setCurrentScreen("directory-materials");
        break;
      case "consumables":
        setCurrentScreen("directory-consumables");
        break;
      case "operations":
        setCurrentScreen("directory-operations");
        break;
      case "variants":
        setCurrentScreen("directory-variants");
        break;
      case "units":
        setCurrentScreen("directory-units");
        break;
      case "statuses":
        setCurrentScreen("directory-statuses");
        break;
      default:
        setCurrentScreen("directories");
        break;
    }
  }

  function handleGoBack() {
    if (currentScreen === "production") {
      setProductionInitialTab("jobs");
      setCurrentScreen("dashboard");
      return;
    }

    if (currentScreen === "scanner") {
      setCurrentScreen("dashboard");
      return;
    }

    if (currentScreen === "directories") {
      setCurrentScreen("dashboard");
      return;
    }

    if (
      currentScreen === "directory-employees" ||
      currentScreen === "directory-suppliers" ||
      currentScreen === "directory-counterparties" ||
      currentScreen === "directory-products" ||
      currentScreen === "directory-materials" ||
      currentScreen === "directory-consumables" ||
      currentScreen === "directory-operations" ||
      currentScreen === "directory-variants" ||
      currentScreen === "directory-units" ||
      currentScreen === "directory-statuses"
    ) {
      setCurrentScreen("directories");
      return;
    }

    setCurrentScreen("dashboard");
  }

  function renderStubDirectory(title: string) {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: 24,
          border: "1px solid #dbe4f0",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {title}
        </div>

        <div
          style={{
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Этот справочник ещё не настроен. Дальше будем добавлять его отдельно.
        </div>

        <div>
          <button
            onClick={() => setCurrentScreen("directories")}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 600,
              color: "#0f172a",
            }}
          >
            Назад к справочникам
          </button>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (currentScreen === "dashboard") {
      return (
        <DashboardPage
          alerts={alerts}
          alertsOpen={alertsOpen}
          setAlertsOpen={setAlertsOpen}
          employeesOpen={employeesOpen}
          setEmployeesOpen={setEmployeesOpen}
          employees={employees}
          employeesLoading={employeesLoading}
          employeesError={employeesError}
        />
      );
    }

    if (currentScreen === "production") {
      return <Production initialTab={productionInitialTab} />;
    }

    if (currentScreen === "directories") {
      return <DirectoriesPage onOpenDirectory={handleOpenDirectory} />;
    }

    if (currentScreen === "directory-employees") {
      return <EmployeesDirectory />;
    }

    if (currentScreen === "directory-units") {
      return <UnitsDirectory />;
    }

    if (currentScreen === "directory-materials") {
      return <MaterialsDirectory />;
    }

    if (currentScreen === "directory-consumables") {
      return <ConsumablesDirectory />;
    }

    if (currentScreen === "directory-suppliers") {
      return renderStubDirectory("Поставщики");
    }

    if (currentScreen === "directory-counterparties") {
      return renderStubDirectory("Контрагенты");
    }

    if (currentScreen === "directory-products") {
      return <ProductsDirectory />;
    }

    if (currentScreen === "directory-operations") {
      return renderStubDirectory("Операции");
    }

    if (currentScreen === "directory-variants") {
      return renderStubDirectory("Цвета и размеры");
    }

    if (currentScreen === "directory-statuses") {
      return renderStubDirectory("Статусы");
    }

    if (currentScreen === "scanner") {
      return (
        <QRScanner
          onTakenToWork={() => {
            setProductionInitialTab("active");
            setCurrentScreen("production");
          }}
        />
      );
    }

    return null;
  }

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 18,
            border: "1px solid #dbe4f0",
            minWidth: 320,
            textAlign: "center",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
          }}
        >
          Загрузка...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <AuthPage
        onLogin={handleLogin}
        loginLoading={loginLoading}
        loginError={loginError}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.42)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "stretch",
            backdropFilter: "blur(2px)",
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 300,
              maxWidth: "84vw",
              height: "100%",
              background: "linear-gradient(180deg, #0f172a 0%, #172554 100%)",
              color: "#fff",
              padding: 20,
              boxSizing: "border-box",
              overflowY: "auto",
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
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
              <div style={{ fontSize: 22, fontWeight: 700 }}>ERP-система</div>

              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.08)",
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
                const isActive =
                  (item.key === "dashboard" && currentScreen === "dashboard") ||
                  (item.key === "production" &&
                    currentScreen === "production") ||
                  (item.key === "directories" &&
                    (currentScreen === "directories" ||
                      currentScreen === "directory-employees" ||
                      currentScreen === "directory-suppliers" ||
                      currentScreen === "directory-counterparties" ||
                      currentScreen === "directory-products" ||
                      currentScreen === "directory-materials" ||
                      currentScreen === "directory-consumables" ||
                      currentScreen === "directory-operations" ||
                      currentScreen === "directory-variants" ||
                      currentScreen === "directory-units" ||
                      currentScreen === "directory-statuses")) ||
                  (item.key === "scanner" && currentScreen === "scanner");

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      switch (item.key) {
                        case "dashboard":
                          setCurrentScreen("dashboard");
                          break;
                        case "production":
                          setProductionInitialTab("jobs");
                          setCurrentScreen("production");
                          break;
                        case "directories":
                          setCurrentScreen("directories");
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
                      background: isActive
                        ? "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)"
                        : "rgba(255,255,255,0.07)",
                      color: "#fff",
                      border: isActive
                        ? "1px solid rgba(147, 197, 253, 0.7)"
                        : "1px solid rgba(255,255,255,0.04)",
                      borderRadius: 14,
                      padding: "14px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: isActive ? 700 : 500,
                      boxShadow: isActive
                        ? "0 8px 18px rgba(37, 99, 235, 0.28)"
                        : "none",
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
              background: "#ffffff",
              borderRadius: 22,
              padding: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              border: "1px solid #dbe4f0",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                minWidth: 0,
                flex: "1 1 380px",
              }}
            >
              <button
                onClick={() => setMenuOpen(true)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: 0,
                  flexShrink: 0,
                  boxShadow: "0 6px 14px rgba(15, 23, 42, 0.06)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#0f172a",
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#0f172a",
                    borderRadius: 2,
                  }}
                />
                <span
                  style={{
                    display: "block",
                    width: 18,
                    height: 2,
                    background: "#0f172a",
                    borderRadius: 2,
                  }}
                />
              </button>

              {canGoBack && (
                <button
                  onClick={handleGoBack}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 6px 14px rgba(15, 23, 42, 0.06)",
                    fontSize: 22,
                    color: "#0f172a",
                    fontWeight: 700,
                  }}
                  title="Назад"
                >
                  ←
                </button>
              )}

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#0f172a",
                    lineHeight: 1.1,
                    wordBreak: "break-word",
                  }}
                >
                  {pageTitle}
                </div>

                <div
                  style={{
                    fontSize: 15,
                    color: "#64748b",
                    marginTop: 4,
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {pageSubtitle}
                </div>
              </div>
            </div>

            <div
              ref={userMenuRef}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                marginLeft: "auto",
              }}
            >
              <button
                title={userEmail}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  border: "1px solid #bfdbfe",
                  background:
                    "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
                  color: "#1d4ed8",
                  fontSize: 20,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 6px 14px rgba(37, 99, 235, 0.08)",
                  flexShrink: 0,
                }}
              >
                {userInitial}
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 58,
                    right: 0,
                    minWidth: 180,
                    background: "#ffffff",
                    border: "1px solid #dbe4f0",
                    borderRadius: 14,
                    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
                    padding: 8,
                    zIndex: 1000,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px 10px 10px",
                      borderBottom: "1px solid #eef2f7",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        marginBottom: 4,
                      }}
                    >
                      Пользователь
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0f172a",
                        wordBreak: "break-word",
                      }}
                    >
                      {userEmail}
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "#ffffff",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#dc2626",
                      textAlign: "left",
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;