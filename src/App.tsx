import { useEffect, useMemo, useRef, useState } from "react";
import Production, { type ProductionTab } from "./Production";
import QRScanner from "./QRScanner";
import AuthPage from "./AuthPage";
import DashboardPage from "./pages/DashboardPage";
import DirectoriesPage from "./pages/DirectoriesPage";
import EmployeeMobilePage from "./pages/EmployeeMobilePage";
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
  | "employee-home"
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
  auth_user_id?: string | null;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  telegram: string | null;
  payment_type: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_at: string | null;
  app_role?: string | null;
  can_use_scanner?: boolean | null;
  can_manage_production?: boolean | null;
  can_manage_directories?: boolean | null;
  can_view_dashboard?: boolean | null;
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

  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [currentEmployeeLoading, setCurrentEmployeeLoading] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const alerts = [
    "Пачка №124 зависла",
    "Заказ ORD-018 просрочен",
    "Сообщение от сотрудника",
  ];

  const isAdmin = currentEmployee?.app_role === "admin";
  const canViewDashboard =
    isAdmin || currentEmployee?.can_view_dashboard === true;
  const canManageProduction =
    isAdmin || currentEmployee?.can_manage_production === true;
  const canManageDirectories =
    isAdmin || currentEmployee?.can_manage_directories === true;
  const canUseScanner = isAdmin || currentEmployee?.can_use_scanner !== false;

  const menuItems = isAdmin
    ? [
        { key: "dashboard", label: "Дашборд" },
        { key: "production", label: "Производство" },
        { key: "directories", label: "Справочники" },
        { key: "scanner", label: "Сканер QR" },
      ]
    : [
        { key: "scanner", label: "Сканер QR" },
        { key: "employee-home", label: "Моя смена" },
      ];

  const pageTitle =
    currentScreen === "employee-home"
      ? "Моя смена"
      : currentScreen === "dashboard"
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
    currentScreen === "employee-home"
      ? "Рабочий экран сотрудника"
      : currentScreen === "dashboard"
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
    return currentScreen !== getDefaultScreen() && currentScreen !== "scanner";
  }, [currentScreen, isAdmin]);

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
      loadCurrentEmployee();
      return;
    }

    setEmployees([]);
    setCurrentEmployee(null);
  }, [session]);

  useEffect(() => {
    if (!session || currentEmployeeLoading) return;
    if (!currentEmployee) return;
    if (currentEmployee.app_role === "admin") return;

    if (currentScreen === "employee-home" || currentScreen === "scanner") {
      return;
    }

    if (
      currentScreen === "dashboard" &&
      currentEmployee.can_view_dashboard !== true
    ) {
      setCurrentScreen("employee-home");
      return;
    }

    if (
      currentScreen === "production" &&
      currentEmployee.can_manage_production !== true
    ) {
      setCurrentScreen("employee-home");
      return;
    }

    if (
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
        currentScreen === "directory-statuses") &&
      currentEmployee.can_manage_directories !== true
    ) {
      setCurrentScreen("employee-home");
    }
  }, [session, currentEmployee, currentEmployeeLoading, currentScreen]);

  async function loadCurrentEmployee() {
    try {
      setCurrentEmployeeLoading(true);

      const userId = session?.user?.id;

      if (!userId) {
        setCurrentEmployee(null);
        return;
      }

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Ошибка получения текущего сотрудника", error);
        setCurrentEmployee(null);
        return;
      }

      setCurrentEmployee((data as Employee | null) || null);
    } catch (error) {
      console.error("Ошибка получения текущего сотрудника", error);
      setCurrentEmployee(null);
    } finally {
      setCurrentEmployeeLoading(false);
    }
  }

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
    setCurrentEmployee(null);
    await supabase.auth.signOut();
  }

  function handleOpenDirectory(directoryKey: string) {
    if (!canManageDirectories) {
      setCurrentScreen("scanner");
      return;
    }

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

  function getDefaultScreen(): Screen {
    if (isAdmin) return "dashboard";
    return "employee-home";
  }

  function handleGoBack() {
    if (currentScreen === "production") {
      setProductionInitialTab("jobs");
      setCurrentScreen(getDefaultScreen());
      return;
    }

    if (currentScreen === "scanner") {
      setCurrentScreen(getDefaultScreen());
      return;
    }

    if (currentScreen === "directories") {
      setCurrentScreen(getDefaultScreen());
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

    setCurrentScreen(getDefaultScreen());
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

  function renderAccessDenied() {
    return (
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          padding: 24,
          border: "1px solid #fecaca",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#991b1b",
          }}
        >
          Нет доступа
        </div>

        <div
          style={{
            marginTop: 8,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          Для этого раздела у пользователя нет прав. Обратись к администратору.
        </div>
      </div>
    );
  }

  function renderContent() {
    if (currentEmployeeLoading) {
      return (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 24,
            border: "1px solid #dbe4f0",
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          Загружаю профиль сотрудника...
        </div>
      );
    }

    if (!currentEmployee) {
      return (
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: 24,
            border: "1px solid #fde68a",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#92400e",
            }}
          >
            Пользователь не привязан к сотруднику
          </div>

          <div
            style={{
              marginTop: 8,
              color: "#64748b",
              lineHeight: 1.6,
            }}
          >
            В Supabase Auth пользователь есть, но в таблице employees не найден
            сотрудник с таким auth_user_id.
          </div>
        </div>
      );
    }

    if (currentScreen === "employee-home") {
      return (
        <EmployeeMobilePage
          onOpenScanner={() => setCurrentScreen("scanner")}
        />
      );
    }

    if (currentScreen === "dashboard") {
      if (!canViewDashboard) return renderAccessDenied();

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
      if (!canManageProduction) return renderAccessDenied();

      return <Production initialTab={productionInitialTab} />;
    }

    if (currentScreen === "directories") {
      if (!canManageDirectories) return renderAccessDenied();

      return <DirectoriesPage onOpenDirectory={handleOpenDirectory} />;
    }

    if (currentScreen === "directory-employees") {
      if (!canManageDirectories) return renderAccessDenied();

      return <EmployeesDirectory />;
    }

    if (currentScreen === "directory-units") {
      if (!canManageDirectories) return renderAccessDenied();

      return <UnitsDirectory />;
    }

    if (currentScreen === "directory-materials") {
      if (!canManageDirectories) return renderAccessDenied();

      return <MaterialsDirectory />;
    }

    if (currentScreen === "directory-consumables") {
      if (!canManageDirectories) return renderAccessDenied();

      return <ConsumablesDirectory />;
    }

    if (currentScreen === "directory-suppliers") {
      if (!canManageDirectories) return renderAccessDenied();

      return renderStubDirectory("Поставщики");
    }

    if (currentScreen === "directory-counterparties") {
      if (!canManageDirectories) return renderAccessDenied();

      return renderStubDirectory("Контрагенты");
    }

    if (currentScreen === "directory-products") {
      if (!canManageDirectories) return renderAccessDenied();

      return <ProductsDirectory />;
    }

    if (currentScreen === "directory-operations") {
      if (!canManageDirectories) return renderAccessDenied();

      return renderStubDirectory("Операции");
    }

    if (currentScreen === "directory-variants") {
      if (!canManageDirectories) return renderAccessDenied();

      return renderStubDirectory("Цвета и размеры");
    }

    if (currentScreen === "directory-statuses") {
      if (!canManageDirectories) return renderAccessDenied();

      return renderStubDirectory("Статусы");
    }

    if (currentScreen === "scanner") {
      if (!canUseScanner) return renderAccessDenied();

      return (
        <QRScanner
          onTakenToWork={() => {
            if (canManageProduction) {
              setProductionInitialTab("active");
              setCurrentScreen("production");
              return;
            }

            setCurrentScreen("employee-home");
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
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  ERP-система
                </div>

                {currentEmployee && (
                  <div
                    style={{
                      marginTop: 4,
                      color: "rgba(255,255,255,0.72)",
                      fontSize: 13,
                    }}
                  >
                    {currentEmployee.app_role === "admin"
                      ? "Администратор"
                      : "Сотрудник"}
                  </div>
                )}
              </div>

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
              {menuItems.length === 0 && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: 14,
                    padding: 14,
                    color: "rgba(255,255,255,0.78)",
                    lineHeight: 1.5,
                  }}
                >
                  Для пользователя не настроены права доступа.
                </div>
              )}

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
                  (item.key === "scanner" && currentScreen === "scanner") ||
                  (item.key === "employee-home" &&
                    currentScreen === "employee-home");

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
                        case "employee-home":
                          setCurrentScreen("employee-home");
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
          padding: isAdmin ? 16 : 0,
        }}
      >
        <div
          style={{
            maxWidth: isAdmin ? 1200 : "none",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: isAdmin ? 16 : 0,
          }}
        >
          {isAdmin && (
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
                      minWidth: 220,
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

                      {currentEmployee && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: "#64748b",
                            lineHeight: 1.4,
                          }}
                        >
                          {currentEmployee.full_name || "Без имени"} ·{" "}
                          {currentEmployee.app_role === "admin"
                            ? "Администратор"
                            : "Сотрудник"}
                        </div>
                      )}
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
          )}

          {!isAdmin && currentEmployee && (
            <div
              style={{
                background: "#ffffff",
                borderRadius: 18,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1px solid #dbeafe",
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
                margin: "10px 10px 0 10px",
              }}
            >
              <button
                onClick={() => setMenuOpen(true)}
                style={{
                  width: 42,
                  height: 42,
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
                }}
              >
                <span style={{ width: 18, height: 2, background: "#0f172a", borderRadius: 2 }} />
                <span style={{ width: 18, height: 2, background: "#0f172a", borderRadius: 2 }} />
                <span style={{ width: 18, height: 2, background: "#0f172a", borderRadius: 2 }} />
              </button>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#0f172a",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pageTitle}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {pageSubtitle}
                </div>
              </div>

              <button
                title={userEmail}
                onClick={() => setUserMenuOpen((prev) => !prev)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  border: "1px solid #bfdbfe",
                  background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
                  color: "#1d4ed8",
                  fontSize: 18,
                  fontWeight: 900,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {userInitial}
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: "fixed",
                    top: 66,
                    right: 10,
                    minWidth: 220,
                    background: "#ffffff",
                    border: "1px solid #dbe4f0",
                    borderRadius: 14,
                    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
                    padding: 8,
                    zIndex: 1000,
                  }}
                >
                  <div style={{ padding: "8px 10px 10px 10px", borderBottom: "1px solid #eef2f7", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Пользователь</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", wordBreak: "break-word" }}>{userEmail}</div>
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
                      fontWeight: 800,
                      color: "#dc2626",
                      textAlign: "left",
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          )}

          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
