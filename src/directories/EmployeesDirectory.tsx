import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Employee = {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  telegram: string | null;
  payment_type: string | null;
  bank_name?: string | null;
  weekly_salary_amount?: number | null;
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

const paymentOptions = [
  { value: "salary", label: "Оклад" },
  { value: "piece", label: "Сдельно" },
  { value: "percent", label: "Процент" },
];

const bankOptions = [
  { value: "", label: "Не выбран" },
  { value: "sber", label: "Сбер" },
  { value: "alfa", label: "Альфа" },
  { value: "tbank", label: "ТБанк" },
  { value: "ozon", label: "Озон" },
];

function parseMultiValue(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatPaymentType(value: string | null | undefined) {
  const selected = parseMultiValue(value);

  if (selected.length === 0) return "—";

  return selected
    .map(
      (item) =>
        paymentOptions.find((option) => option.value === item)?.label || item
    )
    .join(", ");
}

function getBankLabel(value: string | null | undefined) {
  if (!value) return "—";
  return bankOptions.find((option) => option.value === value)?.label || value;
}

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

  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [viewEmployeeId, setViewEmployeeId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

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

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const { error: updateError } = await supabase
        .from("registration_requests")
        .update({ status: "approved" })
        .eq("id", request.id);

      if (updateError) throw updateError;

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
            ? { ...profile, role_code: selectedRoleCode, role: selectedRoleCode }
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

      setActionMessage(`Сотрудник "${employeeName}" удалён из employees и user_profiles.`);
      setViewEmployeeId(null);
      setSelectedEmployeeId(null);
    } catch (error) {
      setEmployeesError(
        error instanceof Error ? error.message : "Ошибка удаления сотрудника"
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteRequest(requestId: string, fullName: string) {
    const confirmed = window.confirm(`Удалить заявку "${fullName}" из базы полностью?`);
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
    roles.forEach((role) => map.set(role.code, role));
    return map;
  }, [roles]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    profiles.forEach((profile) => map.set(profile.id, profile));
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

  function openEmployeeCard(employee: Employee) {
    setSelectedEmployeeId(employee.id);
    setViewEmployeeId(employee.id);
  }


  function startEditEmployee() {
    if (!viewEmployee) return;

    setEditingEmployee({
      ...viewEmployee,
    });

    setIsEditMode(true);
  }

  async function saveEmployeeChanges() {
    if (!editingEmployee) return;

    setEmployeesError("");
    setActionMessage("");

    const payload = {
      full_name: editingEmployee.full_name?.trim() || null,
      phone: editingEmployee.phone?.trim() || null,
      telegram: editingEmployee.telegram?.trim() || null,
      payment_type: editingEmployee.payment_type?.trim() || null,
      bank_name: editingEmployee.bank_name?.trim() || null,
      notes: editingEmployee.notes?.trim() || null,
      weekly_salary_amount: editingEmployee.weekly_salary_amount || 0,
      is_active: editingEmployee.is_active,
    };

    const { error } = await supabase
      .from("employees")
      .update(payload)
      .eq("id", editingEmployee.id);

    if (error) {
      setEmployeesError(error.message);
      return;
    }

    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === editingEmployee.id
          ? { ...employee, ...payload }
          : employee
      )
    );

    setEditingEmployee((prev) => (prev ? { ...prev, ...payload } : prev));
    setIsEditMode(false);
    setActionMessage("Карточка сотрудника обновлена.");
    await loadEmployees();
  }

  function closeEmployeeCard() {
    setSelectedEmployeeId(null);
    setViewEmployeeId(null);
    setIsEditMode(false);
    setEditingEmployee(null);
  }

  const commonDataError = rolesError || profilesError;
  const commonDataLoading = rolesLoading || profilesLoading;

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return employees;

    return employees.filter((emp) => {
      const profile = profilesMap.get(emp.id);
      return (
        (emp.full_name || "").toLowerCase().includes(normalizedSearch) ||
        (emp.phone || "").toLowerCase().includes(normalizedSearch) ||
        (emp.telegram || "").toLowerCase().includes(normalizedSearch) ||
        (profile?.email || "").toLowerCase().includes(normalizedSearch) ||
        getEmployeeRoleLabel(emp).toLowerCase().includes(normalizedSearch)
      );
    });
  }, [employees, search, profilesMap, rolesMap]);

  const viewEmployee = useMemo(() => {
    return employees.find((item) => item.id === viewEmployeeId) || null;
  }, [employees, viewEmployeeId]);

  return (
    <div style={pageStyle}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Справочник сотрудников</div>
        <div style={sectionTextStyle}>
          Здесь хранятся действующие сотрудники, роли доступа и входящие заявки на подключение к ERP.
        </div>

        <div style={tabsStyle}>
          <button
            onClick={() => setTab("employees")}
            style={tab === "employees" ? activeTabStyle : tabButtonStyle}
          >
            Действующие сотрудники
          </button>

          <button
            onClick={() => setTab("requests")}
            style={tab === "requests" ? activeTabStyle : tabButtonStyle}
          >
            Входящие заявки
          </button>
        </div>
      </div>

      {(actionMessage || commonDataError || employeesError) && tab === "employees" && (
        <div style={actionMessage ? successBoxStyle : errorBoxStyle}>
          {actionMessage || commonDataError || employeesError}
        </div>
      )}

      {tab === "employees" && (
        <div style={tableWrapStyle}>
          <div style={tableTopStyle}>
            <div>
              <div style={tableTitleStyle}>Реестр сотрудников</div>
              <div style={tableSubtitleStyle}>Компактный список сотрудников, их ролей и контактов.</div>
            </div>

            <div style={toolbarStyle}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по сотрудникам"
                style={{ ...inputStyle, width: 280, maxWidth: "100%" }}
              />

              <button onClick={loadRoles} style={secondaryButtonStyle}>Обновить роли</button>
              <button
                onClick={() => {
                  loadProfiles();
                  loadEmployees();
                }}
                style={secondaryButtonStyle}
              >
                Обновить сотрудников
              </button>
            </div>
          </div>

          {commonDataLoading && <div style={emptyStyle}>Загрузка справочников ролей и профилей...</div>}
          {employeesLoading && <div style={emptyStyle}>Загрузка сотрудников...</div>}

          {!employeesLoading && !employeesError && filteredEmployees.length === 0 && (
            <div style={emptyStyle}>Сотрудники не найдены</div>
          )}

          {!employeesLoading && !employeesError && filteredEmployees.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f8fbff" }}>
                    {["Сотрудник", "Роль", "Телефон", "Telegram", "Оплата", "Банк", "Статус", "Действия"].map((title) => (
                      <th key={title} style={headCellStyle}>{title}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((emp) => {
                    const currentRoleCode = roleDrafts[emp.id] || getEmployeeRoleCode(emp);
                    const isSavingRole = actionLoadingId === emp.id;
                    const employeeName = emp.full_name || "Без имени";
                    const isSelected = selectedEmployeeId === emp.id;

                    return (
                      <tr key={emp.id} style={{ background: isSelected ? "#eef4ff" : "#ffffff" }}>
                        <td style={firstCellStyle}>
                          <button onClick={() => openEmployeeCard(emp)} style={linkButtonStyle}>
                            {employeeName}
                          </button>
                        </td>
                        <td style={cellStyle}>{getEmployeeRoleLabel(emp)}</td>
                        <td style={cellStyle}>{emp.phone || "—"}</td>
                        <td style={cellStyle}>{emp.telegram || "—"}</td>
                        <td style={cellStyle}>{formatPaymentType(emp.payment_type)}</td>
                        <td style={cellStyle}>{getBankLabel(emp.bank_name)}</td>
                        <td style={cellStyle}>
                          <span style={{ color: emp.is_active ? "#166534" : "#991b1b", fontWeight: 700 }}>
                            {emp.is_active ? "Активен" : "Неактивен"}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <select
                              value={currentRoleCode}
                              onChange={(e) =>
                                setRoleDrafts((prev) => ({ ...prev, [emp.id]: e.target.value }))
                              }
                              style={{ ...inputStyle, width: 180, padding: "8px 10px" }}
                            >
                              {roles.filter((role) => role.is_active).map((role) => (
                                <option key={role.code} value={role.code}>{role.name}</option>
                              ))}
                            </select>

                            <button
                              onClick={() => updateRole(emp.id)}
                              disabled={isSavingRole}
                              style={{ ...primaryButtonStyle, padding: "9px 12px", opacity: isSavingRole ? 0.7 : 1 }}
                            >
                              {isSavingRole ? "..." : "Сохранить"}
                            </button>

                            <button
                              onClick={() => deleteEmployee(emp.id, employeeName)}
                              disabled={isSavingRole}
                              style={{ ...dangerButtonStyle, opacity: isSavingRole ? 0.7 : 1 }}
                            >
                              Удалить
                            </button>
                          </div>
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

      {tab === "requests" && (
        <div style={tableWrapStyle}>
          <div style={tableTopStyle}>
            <div>
              <div style={tableTitleStyle}>Входящие заявки</div>
              <div style={tableSubtitleStyle}>Заявки пользователей на доступ к ERP.</div>
            </div>

            <button onClick={loadRequests} style={secondaryButtonStyle}>Обновить</button>
          </div>

          {(actionMessage || requestsError) && (
            <div style={actionMessage ? successBoxStyle : errorBoxStyle}>{actionMessage || requestsError}</div>
          )}

          {requestsLoading && <div style={emptyStyle}>Загрузка заявок...</div>}
          {!requestsLoading && !requestsError && requests.length === 0 && <div style={emptyStyle}>Заявок пока нет</div>}

          {!requestsLoading && !requestsError && requests.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f8fbff" }}>
                    {["ФИО", "Email", "Телефон", "Комментарий", "Статус", "Действия"].map((title) => (
                      <th key={title} style={headCellStyle}>{title}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => {
                    const isPending = request.status === "pending";
                    const isLoading = actionLoadingId === request.id;

                    return (
                      <tr key={request.id}>
                        <td style={firstCellStyle}>{request.full_name}</td>
                        <td style={cellStyle}>{request.email}</td>
                        <td style={cellStyle}>{request.phone || "—"}</td>
                        <td style={cellStyle}>{request.comment || "—"}</td>
                        <td style={cellStyle}>
                          <span style={{ color: getStatusColor(request.status), fontWeight: 700 }}>
                            {getStatusLabel(request.status)}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => approveRequest(request)}
                              disabled={!isPending || isLoading}
                              style={{ ...successButtonStyle, opacity: !isPending || isLoading ? 0.65 : 1 }}
                            >
                              {isLoading ? "..." : "Принять"}
                            </button>

                            <button
                              onClick={() => rejectRequest(request.id)}
                              disabled={!isPending || isLoading}
                              style={{ ...dangerButtonStyle, opacity: !isPending || isLoading ? 0.65 : 1 }}
                            >
                              Отклонить
                            </button>

                            <button
                              onClick={() => deleteRequest(request.id, request.full_name)}
                              disabled={isLoading}
                              style={outlineDangerButtonStyle}
                            >
                              Удалить
                            </button>
                          </div>
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

      {viewEmployee && (
        <div onClick={closeEmployeeCard} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка сотрудника</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>{viewEmployee.full_name || "Без имени"}</div>
              </div>

              <button onClick={closeEmployeeCard} style={closeButtonStyle}>×</button>
            </div>

            {!isEditMode && (
              <>
                <div style={infoGridStyle}>
                  <Info label="ФИО" value={viewEmployee.full_name || "—"} />
                  <Info label="Роль" value={getEmployeeRoleLabel(viewEmployee)} />
                  <Info label="Телефон" value={viewEmployee.phone || "—"} />
                  <Info label="Telegram" value={viewEmployee.telegram || "—"} />
                  <Info label="Тип оплаты" value={formatPaymentType(viewEmployee.payment_type)} />
                  <Info label="Банк" value={getBankLabel(viewEmployee.bank_name)} />
                  <Info label="Оклад в неделю" value={viewEmployee.weekly_salary_amount ? `${viewEmployee.weekly_salary_amount} ₽` : "—"} />
                  <Info label="Активность" value={viewEmployee.is_active ? "Активен" : "Неактивен"} />
                </div>

                <div style={commentBoxStyle}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>Заметки:</span>{" "}
                  {viewEmployee.notes || "—"}
                </div>

                <div style={modalActionsStyle}>
                  <button onClick={startEditEmployee} style={primaryButtonStyle}>
                    Редактировать
                  </button>

                  <button onClick={closeEmployeeCard} style={secondaryButtonStyle}>
                    Закрыть
                  </button>
                </div>
              </>
            )}

            {isEditMode && editingEmployee && (
              <>
                <div style={formGridStyle}>
                  <Field label="ФИО">
                    <input
                      style={inputStyle}
                      value={editingEmployee.full_name || ""}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          full_name: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Телефон">
                    <input
                      style={inputStyle}
                      value={editingEmployee.phone || ""}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          phone: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Telegram">
                    <input
                      style={inputStyle}
                      value={editingEmployee.telegram || ""}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          telegram: e.target.value,
                        })
                      }
                    />
                  </Field>

                  <Field label="Тип оплаты">
                    <div style={checkboxGroupStyle}>
                      {paymentOptions.map((option) => {
                        const selectedValues = parseMultiValue(
                          editingEmployee.payment_type
                        );
                        const checked = selectedValues.includes(option.value);

                        return (
                          <label key={option.value} style={checkboxLabelStyle}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const nextValues = e.target.checked
                                  ? [...selectedValues, option.value]
                                  : selectedValues.filter(
                                      (value) => value !== option.value
                                    );

                                setEditingEmployee({
                                  ...editingEmployee,
                                  payment_type: nextValues.join(","),
                                });
                              }}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Банк">
                    <select
                      style={inputStyle}
                      value={editingEmployee.bank_name || ""}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          bank_name: e.target.value || null,
                        })
                      }
                    >
                      {bankOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {parseMultiValue(editingEmployee.payment_type).includes("salary") && (
                    <Field label="Оклад в неделю">
                      <input
                        type="number"
                        style={inputStyle}
                        value={editingEmployee.weekly_salary_amount || 0}
                        onChange={(e) =>
                          setEditingEmployee({
                            ...editingEmployee,
                            weekly_salary_amount: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </Field>
                  )}

                  <Field label="Активность">
                    <select
                      style={inputStyle}
                      value={editingEmployee.is_active ? "true" : "false"}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          is_active: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">Активен</option>
                      <option value="false">Неактивен</option>
                    </select>
                  </Field>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Field label="Заметки">
                    <textarea
                      style={textareaStyle}
                      value={editingEmployee.notes || ""}
                      onChange={(e) =>
                        setEditingEmployee({
                          ...editingEmployee,
                          notes: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>

                <div style={modalActionsStyle}>
                  <button
                    onClick={() => setIsEditMode(false)}
                    style={secondaryButtonStyle}
                  >
                    Отмена
                  </button>

                  <button onClick={saveEmployeeChanges} style={primaryButtonStyle}>
                    Сохранить
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBoxStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 24,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: "#0f172a", textAlign: "center" };
const sectionTextStyle: React.CSSProperties = { marginTop: 10, color: "#64748b", fontSize: 16, lineHeight: 1.6, textAlign: "center" };
const tabsStyle: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 18 };

const tabButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
};

const activeTabStyle: React.CSSProperties = {
  ...tabButtonStyle,
  border: "none",
  color: "#ffffff",
  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
  boxShadow: "0 10px 22px rgba(37, 99, 235, 0.22)",
};

const tableWrapStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  overflow: "hidden",
};

const tableTopStyle: React.CSSProperties = {
  padding: 18,
  borderBottom: "1px solid #e5edf7",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const tableTitleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "#0f172a" };
const tableSubtitleStyle: React.CSSProperties = { marginTop: 4, color: "#64748b", lineHeight: 1.5 };
const toolbarStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 980 };
const headCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #e5edf7",
  textAlign: "left",
  color: "#475569",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const firstCellStyle: React.CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #eef2f7", verticalAlign: "middle" };
const cellStyle: React.CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #eef2f7", color: "#334155", verticalAlign: "middle" };
const emptyStyle: React.CSSProperties = { padding: 18, color: "#64748b" };

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  background: "#ffffff",
  boxSizing: "border-box",
  width: "100%",
};

const linkButtonStyle: React.CSSProperties = { border: "none", background: "transparent", padding: 0, color: "#1d4ed8", cursor: "pointer", fontWeight: 700, fontSize: 15 };
const primaryButtonStyle: React.CSSProperties = { border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontWeight: 700, color: "#ffffff", background: "#2563eb" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 700, color: "#0f172a" };
const dangerButtonStyle: React.CSSProperties = { border: "none", borderRadius: 10, padding: "9px 12px", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer" };
const successButtonStyle: React.CSSProperties = { border: "none", borderRadius: 10, padding: "9px 12px", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer" };
const outlineDangerButtonStyle: React.CSSProperties = { border: "1px solid #dc2626", borderRadius: 10, padding: "9px 12px", background: "#fff", color: "#dc2626", fontWeight: 700, cursor: "pointer" };

const successBoxStyle: React.CSSProperties = { background: "#dcfce7", border: "1px solid #86efac", color: "#166534", borderRadius: 14, padding: 14, fontWeight: 600 };
const errorBoxStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 600 };

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(4px)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};
const modalBoxStyle: React.CSSProperties = { width: "min(900px, 96vw)", maxHeight: "90vh", overflowY: "auto", background: "#ffffff", borderRadius: 22, padding: 22, border: "1px solid #dbe4f0", boxShadow: "0 26px 70px rgba(15, 23, 42, 0.28)" };
const modalHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 };
const modalTitleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 800, color: "#0f172a" };
const closeButtonStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontWeight: 800, fontSize: 20, color: "#0f172a" };
const infoGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };
const infoBoxStyle: React.CSSProperties = { background: "#f8fbff", border: "1px solid #dbe4f0", borderRadius: 14, padding: 14, minHeight: 72 };
const infoLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: 13, marginBottom: 8 };
const infoValueStyle: React.CSSProperties = { color: "#0f172a", fontWeight: 700, fontSize: 15 };
const commentBoxStyle: React.CSSProperties = { marginTop: 14, padding: 12, borderRadius: 12, background: "#f8fbff", border: "1px solid #dbe4f0", color: "#475569", lineHeight: 1.6 };
const modalActionsStyle: React.CSSProperties = { marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 10 };


const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  color: "#475569",
  fontWeight: 700,
  marginBottom: 6,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};


const checkboxGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  minHeight: 46,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};
