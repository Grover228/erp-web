import { useEffect, useMemo, useState } from "react";
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

type RegistrationRequest = {
  id: string;
  full_name: string;
  email: string;
  password: string;
  phone: string | null;
  comment: string | null;
  status: string;
  created_at: string | null;
};

type RoleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string | null;
};

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  role_code: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

export default function EmployeesDirectory() {
  const [tab, setTab] = useState<"employees" | "requests">("employees");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");

  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState("");

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadEmployees();
    loadRequests();
    loadRoles();
    loadProfiles();
  }, []);

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);
      setEmployeesError("");

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setEmployees((data as Employee[]) || []);
    } catch (error) {
      setEmployeesError(
        error instanceof Error ? error.message : "Ошибка загрузки сотрудников"
      );
    } finally {
      setEmployeesLoading(false);
    }
  }

  async function loadRequests() {
    try {
      setRequestsLoading(true);
      setRequestsError("");

      const { data, error } = await supabase
        .from("registration_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests((data as RegistrationRequest[]) || []);
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : "Ошибка загрузки заявок"
      );
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadRoles() {
    try {
      setRolesLoading(true);
      setRolesError("");

      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setRoles((data as RoleItem[]) || []);
    } catch (error) {
      setRolesError(
        error instanceof Error ? error.message : "Ошибка загрузки ролей"
      );
    } finally {
      setRolesLoading(false);
    }
  }

  async function loadProfiles() {
    try {
      setProfilesLoading(true);
      setProfilesError("");

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const safeProfiles = (data as UserProfile[]) || [];
      setProfiles(safeProfiles);

      const draftMap: Record<string, string> = {};
      safeProfiles.forEach((profile) => {
        draftMap[profile.id] = profile.role_code || "employee";
      });
      setRoleDrafts(draftMap);
    } catch (error) {
      setProfilesError(
        error instanceof Error ? error.message : "Ошибка загрузки профилей"
      );
    } finally {
      setProfilesLoading(false);
    }
  }

  async function rejectRequest(requestId: string) {
    try {
      setActionLoadingId(requestId);
      setActionMessage("");
      setRequestsError("");

      const { error } = await supabase
        .from("registration_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId ? { ...item, status: "rejected" } : item
        )
      );

      setActionMessage("Заявка отклонена.");
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : "Не удалось отклонить заявку"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function approveRequest(request: RegistrationRequest) {
    try {
      setActionLoadingId(request.id);
      setActionMessage("");
      setRequestsError("");

      const { data, error } = await supabase.functions.invoke("approve-user", {
        body: {
          email: request.email,
          password: request.password,
          full_name: request.full_name,
          phone: request.phone,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const { error: updateError } = await supabase
        .from("registration_requests")
        .update({ status: "approved" })
        .eq("id", request.id);

      if (updateError) {
        throw updateError;
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id ? { ...item, status: "approved" } : item
        )
      );

      setActionMessage("Пользователь создан и заявка принята.");

      await Promise.all([loadEmployees(), loadProfiles(), loadRequests()]);
      setTab("employees");
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : "Не удалось принять заявку"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function updateRole(userId: string) {
    try {
      setActionLoadingId(userId);
      setActionMessage("");
      setEmployeesError("");

      const selectedRoleCode = roleDrafts[userId] || "employee";

      const { error } = await supabase
        .from("user_profiles")
        .update({ role_code: selectedRoleCode, role: selectedRoleCode })
        .eq("id", userId);

      if (error) throw error;

      setProfiles((prev) =>
        prev.map((profile) =>
          profile.id === userId
            ? {
                ...profile,
                role_code: selectedRoleCode,
                role: selectedRoleCode,
              }
            : profile
        )
      );

      setActionMessage("Роль сотрудника обновлена.");
    } catch (error) {
      setEmployeesError(
        error instanceof Error ? error.message : "Ошибка обновления роли"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteEmployee(userId: string, employeeName: string) {
    const confirmed = window.confirm(
      `Удалить сотрудника "${employeeName}" из ERP? Это удалит записи из employees и user_profiles.`
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(userId);
      setActionMessage("");
      setEmployeesError("");

      const { error: employeeError } = await supabase
        .from("employees")
        .delete()
        .eq("id", userId);

      if (employeeError) throw employeeError;

      const { error: profileError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      setEmployees((prev) => prev.filter((item) => item.id !== userId));
      setProfiles((prev) => prev.filter((item) => item.id !== userId));

      setActionMessage(
        `Сотрудник "${employeeName}" удалён из employees и user_profiles.`
      );
    } catch (error) {
      setEmployeesError(
        error instanceof Error ? error.message : "Ошибка удаления сотрудника"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteRequest(requestId: string, fullName: string) {
    const confirmed = window.confirm(
      `Удалить заявку "${fullName}" из базы полностью?`
    );

    if (!confirmed) return;

    try {
      setActionLoadingId(requestId);
      setActionMessage("");
      setRequestsError("");

      const { error } = await supabase
        .from("registration_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setRequests((prev) => prev.filter((item) => item.id !== requestId));
      setActionMessage(`Заявка "${fullName}" удалена.`);
    } catch (error) {
      setRequestsError(
        error instanceof Error ? error.message : "Ошибка удаления заявки"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  function getStatusColor(status: string) {
    if (status === "pending") return "#b45309";
    if (status === "approved") return "#166534";
    if (status === "rejected") return "#991b1b";
    return "#475569";
  }

  function getStatusLabel(status: string) {
    if (status === "pending") return "Ожидает решения";
    if (status === "approved") return "Принята";
    if (status === "rejected") return "Отклонена";
    return status;
  }

  const rolesMap = useMemo(() => {
    const map = new Map<string, RoleItem>();
    roles.forEach((role) => {
      map.set(role.code, role);
    });
    return map;
  }, [roles]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    profiles.forEach((profile) => {
      map.set(profile.id, profile);
    });
    return map;
  }, [profiles]);

  function getEmployeeRoleCode(employee: Employee) {
    const profile = profilesMap.get(employee.id);
    if (profile?.role_code) return profile.role_code;
    if (profile?.role) return profile.role;
    if (employee.role) return employee.role;
    return "employee";
  }

  function getEmployeeRoleLabel(employee: Employee) {
    const roleCode = getEmployeeRoleCode(employee);
    const role = rolesMap.get(roleCode);
    if (role?.name) return role.name;
    return roleCode || "—";
  }

  const commonDataError = rolesError || profilesError;
  const commonDataLoading = rolesLoading || profilesLoading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 18,
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Справочник сотрудников
        </div>

        <div
          style={{
            color: "#6b7280",
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          Здесь будут действующие сотрудники и входящие заявки на доступ в ERP.
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setTab("employees")}
            style={{
              height: 42,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: tab === "employees" ? "#2563eb" : "#fff",
              color: tab === "employees" ? "#fff" : "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Действующие сотрудники
          </button>

          <button
            onClick={() => setTab("requests")}
            style={{
              height: 42,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: tab === "requests" ? "#2563eb" : "#fff",
              color: tab === "requests" ? "#fff" : "#111827",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Входящие заявки
          </button>
        </div>
      </div>

      {tab === "employees" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 18,
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Действующие сотрудники
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={loadRoles}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Обновить роли
              </button>

              <button
                onClick={() => {
                  loadProfiles();
                  loadEmployees();
                }}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Обновить сотрудников
              </button>
            </div>
          </div>

          {actionMessage && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: "#dcfce7",
                border: "1px solid #86efac",
                color: "#166534",
              }}
            >
              {actionMessage}
            </div>
          )}

          {commonDataLoading && (
            <div style={{ color: "#6b7280", marginBottom: 12 }}>
              Загрузка справочников ролей и профилей...
            </div>
          )}

          {commonDataError && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                marginBottom: 12,
              }}
            >
              Ошибка: {commonDataError}
            </div>
          )}

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
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 14,
              }}
            >
              {employees.map((emp) => {
                const currentRoleCode =
                  roleDrafts[emp.id] || getEmployeeRoleCode(emp);
                const isSavingRole = actionLoadingId === emp.id;
                const employeeName = emp.full_name || "Без имени";

                return (
                  <div
                    key={emp.id}
                    style={{
                      border: "1px solid #dbe4f0",
                      borderRadius: 14,
                      padding: 16,
                      background: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: 8,
                        }}
                      >
                        {employeeName}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          color: "#6b7280",
                          marginBottom: 4,
                        }}
                      >
                        Текущая роль:{" "}
                        <span style={{ fontWeight: 700, color: "#111827" }}>
                          {getEmployeeRoleLabel(emp)}
                        </span>
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                        Телефон: {emp.phone || "—"}
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                        Telegram: {emp.telegram || "—"}
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 6 }}>
                        Оплата: {emp.payment_type || "—"}
                      </div>

                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: emp.is_active ? "#166534" : "#991b1b",
                        }}
                      >
                        {emp.is_active ? "Активен" : "Неактивен"}
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: 12,
                        background: "#f8fafc",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        Управление ролью
                      </div>

                      <select
                        value={currentRoleCode}
                        onChange={(e) =>
                          setRoleDrafts((prev) => ({
                            ...prev,
                            [emp.id]: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          height: 44,
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          padding: "0 12px",
                          background: "#fff",
                          fontSize: 15,
                        }}
                      >
                        {roles
                          .filter((role) => role.is_active)
                          .map((role) => (
                            <option key={role.code} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                      </select>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => updateRole(emp.id)}
                          disabled={isSavingRole}
                          style={{
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 14px",
                            background: isSavingRole ? "#93c5fd" : "#2563eb",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: isSavingRole ? "default" : "pointer",
                          }}
                        >
                          {isSavingRole ? "Сохранение..." : "Сохранить роль"}
                        </button>

                        <button
                          onClick={() => deleteEmployee(emp.id, employeeName)}
                          disabled={isSavingRole}
                          style={{
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 14px",
                            background: isSavingRole ? "#fecaca" : "#dc2626",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: isSavingRole ? "default" : "pointer",
                          }}
                        >
                          Удалить сотрудника
                        </button>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          lineHeight: 1.5,
                        }}
                      >
                        Удаление сейчас очищает записи из employees и user_profiles.
                        Учетную запись в Auth позже добавим отдельной серверной функцией.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 18,
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Входящие заявки
            </div>

            <button
              onClick={loadRequests}
              style={{
                border: "1px solid #d1d5db",
                background: "#fff",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Обновить
            </button>
          </div>

          {requestsLoading && (
            <div style={{ color: "#6b7280" }}>Загрузка заявок...</div>
          )}

          {requestsError && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                marginBottom: 12,
              }}
            >
              Ошибка: {requestsError}
            </div>
          )}

          {!requestsLoading && !requestsError && requests.length === 0 && (
            <div style={{ color: "#6b7280" }}>Заявок пока нет</div>
          )}

          {!requestsLoading && !requestsError && requests.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {requests.map((request) => {
                const isPending = request.status === "pending";
                const isLoading = actionLoadingId === request.id;

                return (
                  <div
                    key={request.id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: 14,
                      background: "#fff",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: 8,
                        }}
                      >
                        {request.full_name}
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                        Email: {request.email}
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>
                        Телефон: {request.phone || "—"}
                      </div>

                      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
                        Комментарий: {request.comment || "—"}
                      </div>

                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: getStatusColor(request.status),
                        }}
                      >
                        Статус: {getStatusLabel(request.status)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() => approveRequest(request)}
                        disabled={!isPending || isLoading}
                        style={{
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          background:
                            !isPending || isLoading ? "#bbf7d0" : "#16a34a",
                          color: "#fff",
                          fontWeight: 700,
                          cursor:
                            !isPending || isLoading ? "default" : "pointer",
                        }}
                      >
                        {isLoading ? "Обработка..." : "Принять"}
                      </button>

                      <button
                        onClick={() => rejectRequest(request.id)}
                        disabled={!isPending || isLoading}
                        style={{
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          background:
                            !isPending || isLoading ? "#fecaca" : "#dc2626",
                          color: "#fff",
                          fontWeight: 700,
                          cursor:
                            !isPending || isLoading ? "default" : "pointer",
                        }}
                      >
                        {isLoading ? "Обработка..." : "Отклонить"}
                      </button>

                      <button
                        onClick={() =>
                          deleteRequest(request.id, request.full_name)
                        }
                        disabled={isLoading}
                        style={{
                          border: "1px solid #dc2626",
                          borderRadius: 10,
                          padding: "10px 14px",
                          background: "#fff",
                          color: "#dc2626",
                          fontWeight: 700,
                          cursor: isLoading ? "default" : "pointer",
                        }}
                      >
                        Удалить заявку
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}