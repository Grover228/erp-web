import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../supabase";

type CounterpartyItem = {
  id: string;
  name: string;
  type: string | null;
  group_name: string | null;
  inn: string | null;
  kpp: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  address: string | null;
  comment: string | null;
  is_active: boolean;
  created_at: string | null;
};

const groupOptions = [
  { value: "supplier", label: "Поставщик" },
  { value: "customer", label: "Покупатель" },
  { value: "landlord", label: "Арендодатель" },
  { value: "partner", label: "Партнёр" },
  { value: "other", label: "Прочее" },
];

function getGroupLabel(value: string | null) {
  return groupOptions.find((item) => item.value === value)?.label || "Прочее";
}

function getCounterpartyGroup(item: CounterpartyItem) {
  return item.group_name || item.type || "other";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

const emptyForm = {
  name: "",
  groupName: "supplier",
  inn: "",
  kpp: "",
  phone: "",
  email: "",
  contactPerson: "",
  address: "",
  comment: "",
  isActive: true,
};

export default function CounterpartiesDirectory() {
  const [counterparties, setCounterparties] = useState<CounterpartyItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null);
  const [viewCounterpartyId, setViewCounterpartyId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [name, setName] = useState(emptyForm.name);
  const [groupName, setGroupName] = useState(emptyForm.groupName);
  const [inn, setInn] = useState(emptyForm.inn);
  const [kpp, setKpp] = useState(emptyForm.kpp);
  const [phone, setPhone] = useState(emptyForm.phone);
  const [email, setEmail] = useState(emptyForm.email);
  const [contactPerson, setContactPerson] = useState(emptyForm.contactPerson);
  const [address, setAddress] = useState(emptyForm.address);
  const [comment, setComment] = useState(emptyForm.comment);
  const [isActive, setIsActive] = useState(emptyForm.isActive);

  useEffect(() => {
    loadCounterparties();
  }, []);

  const viewCounterparty = useMemo(() => {
    return counterparties.find((item) => item.id === viewCounterpartyId) || null;
  }, [counterparties, viewCounterpartyId]);

  const filteredCounterparties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return counterparties.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        (item.inn || "").toLowerCase().includes(normalizedSearch) ||
        (item.phone || "").toLowerCase().includes(normalizedSearch) ||
        (item.email || "").toLowerCase().includes(normalizedSearch) ||
        (item.contact_person || "").toLowerCase().includes(normalizedSearch);

      const itemGroup = getCounterpartyGroup(item);
      const matchesGroup = groupFilter === "all" || itemGroup === groupFilter;

      return matchesSearch && matchesGroup;
    });
  }, [counterparties, search, groupFilter]);

  async function loadCounterparties() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase
        .from("counterparties")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Ошибка загрузки контрагентов:", error);
        throw error;
      }

      setCounterparties((data as CounterpartyItem[]) || []);
    } catch (error) {
      console.error("Ошибка загрузки контрагентов:", error);
      setError(getErrorMessage(error, "Ошибка загрузки контрагентов"));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName(emptyForm.name);
    setGroupName(emptyForm.groupName);
    setInn(emptyForm.inn);
    setKpp(emptyForm.kpp);
    setPhone(emptyForm.phone);
    setEmail(emptyForm.email);
    setContactPerson(emptyForm.contactPerson);
    setAddress(emptyForm.address);
    setComment(emptyForm.comment);
    setIsActive(emptyForm.isActive);
  }

  function fillForm(item: CounterpartyItem) {
    setName(item.name || "");
    setGroupName(getCounterpartyGroup(item));
    setInn(item.inn || "");
    setKpp(item.kpp || "");
    setPhone(item.phone || "");
    setEmail(item.email || "");
    setContactPerson(item.contact_person || "");
    setAddress(item.address || "");
    setComment(item.comment || "");
    setIsActive(item.is_active !== false);
  }

  function openCounterpartyCard(item: CounterpartyItem) {
    setSelectedCounterpartyId(item.id);
    setViewCounterpartyId(item.id);
    setIsEditMode(false);
    fillForm(item);
  }

  function closeCounterpartyCard() {
    setViewCounterpartyId(null);
    setSelectedCounterpartyId(null);
    setIsEditMode(false);
    resetForm();
  }

  async function handleCreateCounterparty() {
    if (!name.trim()) {
      setError("Введите название контрагента");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: name.trim(),
        type: groupName || "supplier",
        group_name: groupName || "supplier",
        inn: inn.trim() || null,
        kpp: kpp.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        contact_person: contactPerson.trim() || null,
        address: address.trim() || null,
        comment: comment.trim() || null,
        is_active: isActive,
      };

      const { error } = await supabase.from("counterparties").insert(payload);

      if (error) {
        console.error("Supabase insert counterparties error:", error);
        throw error;
      }

      setMessage("Контрагент добавлен");
      setIsCreateOpen(false);
      resetForm();
      await loadCounterparties();
    } catch (error) {
      console.error("Ошибка добавления контрагента", error);
      setError(getErrorMessage(error, "Не удалось добавить контрагента"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCounterparty() {
    if (!viewCounterparty) return;

    if (!name.trim()) {
      setError("Введите название контрагента");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const payload = {
        name: name.trim(),
        type: groupName || "supplier",
        group_name: groupName || "supplier",
        inn: inn.trim() || null,
        kpp: kpp.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        contact_person: contactPerson.trim() || null,
        address: address.trim() || null,
        comment: comment.trim() || null,
        is_active: isActive,
      };

      const { error } = await supabase
        .from("counterparties")
        .update(payload)
        .eq("id", viewCounterparty.id);

      if (error) {
        console.error("Supabase update counterparties error:", error);
        throw error;
      }

      setMessage("Контрагент обновлён");
      setIsEditMode(false);
      await loadCounterparties();
    } catch (error) {
      console.error("Ошибка обновления контрагента", error);
      setError(getErrorMessage(error, "Не удалось обновить контрагента"));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteCounterparty(item: CounterpartyItem) {
    const confirmed = window.confirm(`Удалить контрагента "${item.name}"?`);

    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("counterparties")
        .delete()
        .eq("id", item.id);

      if (error) {
        console.error("Supabase delete counterparties error:", error);
        throw error;
      }

      setMessage("Контрагент удалён");

      if (viewCounterpartyId === item.id) {
        closeCounterpartyCard();
      }

      await loadCounterparties();
    } catch (error) {
      console.error("Ошибка удаления контрагента", error);
      setError(getErrorMessage(error, "Не удалось удалить контрагента"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Контрагенты</div>
        <div style={sectionTextStyle}>
          Единый справочник поставщиков, покупателей, арендодателей и партнёров.
        </div>
      </div>

      <div style={sectionStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setError("");
                setMessage("");
                resetForm();
                setIsCreateOpen(true);
              }}
              style={primaryButtonStyle}
            >
              Добавить нового контрагента
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по контрагентам"
              style={{
                ...inputStyle,
                width: 280,
                maxWidth: "100%",
              }}
            />

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{
                ...inputStyle,
                width: 220,
                maxWidth: "100%",
              }}
            >
              <option value="all">Все группы</option>
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button onClick={loadCounterparties} style={secondaryButtonStyle}>
            Обновить
          </button>
        </div>
      </div>

      {(message || error) && (
        <div
          style={{
            background: message ? "#dcfce7" : "#fef2f2",
            border: message ? "1px solid #86efac" : "1px solid #fecaca",
            color: message ? "#166534" : "#991b1b",
            borderRadius: 14,
            padding: 14,
            fontWeight: 600,
          }}
        >
          {message || error}
        </div>
      )}

      <div style={tableWrapStyle}>
        <div style={tableTitleStyle}>Реестр контрагентов</div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка контрагентов...
          </div>
        )}

        {!loading && filteredCounterparties.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Контрагенты не найдены
          </div>
        )}

        {!loading && filteredCounterparties.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: 920,
              }}
            >
              <thead>
                <tr style={{ background: "#f8fbff" }}>
                  {[
                    "Название",
                    "Группа",
                    "ИНН",
                    "Телефон",
                    "Email",
                    "Контактное лицо",
                    "Активность",
                    "Действия",
                  ].map((title) => (
                    <th key={title} style={headCellStyle}>
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredCounterparties.map((item) => {
                  const isSelected = selectedCounterpartyId === item.id;
                  const isDeleting = deletingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: isSelected ? "#eef4ff" : "#ffffff",
                      }}
                    >
                      <td style={firstCellStyle}>
                        <button
                          onClick={() => openCounterpartyCard(item)}
                          style={linkButtonStyle}
                        >
                          {item.name}
                        </button>
                      </td>

                      <td style={cellStyle}>{getGroupLabel(getCounterpartyGroup(item))}</td>
                      <td style={cellStyle}>{item.inn || "—"}</td>
                      <td style={cellStyle}>{item.phone || "—"}</td>
                      <td style={cellStyle}>{item.email || "—"}</td>
                      <td style={cellStyle}>{item.contact_person || "—"}</td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            color: item.is_active ? "#166534" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
                          {item.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <button
                          onClick={() => handleDeleteCounterparty(item)}
                          disabled={isDeleting}
                          style={{
                            border: "none",
                            borderRadius: 10,
                            padding: "8px 12px",
                            background: isDeleting ? "#fecaca" : "#dc2626",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: isDeleting ? "default" : "pointer",
                          }}
                        >
                          {isDeleting ? "Удаление..." : "Удалить"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewCounterparty && (
        <div onClick={closeCounterpartyCard} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка контрагента</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {viewCounterparty.name}
                </div>
              </div>

              <button onClick={closeCounterpartyCard} style={closeButtonStyle}>
                ×
              </button>
            </div>

            {!isEditMode && (
              <>
                <div style={infoGridStyle}>
                  <Info label="Название" value={viewCounterparty.name} />
                  <Info
                    label="Группа"
                    value={getGroupLabel(getCounterpartyGroup(viewCounterparty))}
                  />
                  <Info label="ИНН" value={viewCounterparty.inn || "—"} />
                  <Info label="КПП" value={viewCounterparty.kpp || "—"} />
                  <Info label="Телефон" value={viewCounterparty.phone || "—"} />
                  <Info label="Email" value={viewCounterparty.email || "—"} />
                  <Info
                    label="Контактное лицо"
                    value={viewCounterparty.contact_person || "—"}
                  />
                  <Info
                    label="Активность"
                    value={viewCounterparty.is_active ? "Активен" : "Неактивен"}
                  />
                </div>

                <div style={commentBoxStyle}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    Адрес:
                  </span>{" "}
                  {viewCounterparty.address || "—"}
                </div>

                <div style={commentBoxStyle}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    Комментарий:
                  </span>{" "}
                  {viewCounterparty.comment || "—"}
                </div>

                <div style={modalActionsStyle}>
                  <button
                    onClick={() => setIsEditMode(true)}
                    style={primaryButtonStyle}
                  >
                    Редактировать
                  </button>
                </div>
              </>
            )}

            {isEditMode && (
              <CounterpartyForm
                name={name}
                setName={setName}
                groupName={groupName}
                setGroupName={setGroupName}
                inn={inn}
                setInn={setInn}
                kpp={kpp}
                setKpp={setKpp}
                phone={phone}
                setPhone={setPhone}
                email={email}
                setEmail={setEmail}
                contactPerson={contactPerson}
                setContactPerson={setContactPerson}
                address={address}
                setAddress={setAddress}
                comment={comment}
                setComment={setComment}
                isActive={isActive}
                setIsActive={setIsActive}
                submitLabel={updating ? "Сохранение..." : "Сохранить изменения"}
                disabled={updating}
                onCancel={() => {
                  fillForm(viewCounterparty);
                  setIsEditMode(false);
                }}
                onSubmit={handleUpdateCounterparty}
              />
            )}
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div
          onClick={() => setIsCreateOpen(false)}
          style={modalOverlayStyle}
        >
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Новый контрагент</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  Добавь поставщика, покупателя, арендодателя или партнёра
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <CounterpartyForm
              name={name}
              setName={setName}
              groupName={groupName}
              setGroupName={setGroupName}
              inn={inn}
              setInn={setInn}
              kpp={kpp}
              setKpp={setKpp}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              contactPerson={contactPerson}
              setContactPerson={setContactPerson}
              address={address}
              setAddress={setAddress}
              comment={comment}
              setComment={setComment}
              isActive={isActive}
              setIsActive={setIsActive}
              submitLabel={saving ? "Добавление..." : "Добавить контрагента"}
              disabled={saving}
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={handleCreateCounterparty}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CounterpartyForm({
  name,
  setName,
  groupName,
  setGroupName,
  inn,
  setInn,
  kpp,
  setKpp,
  phone,
  setPhone,
  email,
  setEmail,
  contactPerson,
  setContactPerson,
  address,
  setAddress,
  comment,
  setComment,
  isActive,
  setIsActive,
  submitLabel,
  disabled,
  onCancel,
  onSubmit,
}: {
  name: string;
  setName: (value: string) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  inn: string;
  setInn: (value: string) => void;
  kpp: string;
  setKpp: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  contactPerson: string;
  setContactPerson: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  isActive: boolean;
  setIsActive: (value: boolean) => void;
  submitLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div style={formGridStyle}>
        <Field label="Название">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Группа">
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={inputStyle}
          >
            {groupOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ИНН">
          <input
            value={inn}
            onChange={(e) => setInn(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="КПП">
          <input
            value={kpp}
            onChange={(e) => setKpp(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Телефон">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Контактное лицо">
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="Активность">
          <select
            value={isActive ? "true" : "false"}
            onChange={(e) => setIsActive(e.target.value === "true")}
            style={inputStyle}
          >
            <option value="true">Активен</option>
            <option value="false">Неактивен</option>
          </select>
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Адрес">
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={textareaStyle}
          />
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Комментарий">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={textareaStyle}
          />
        </Field>
      </div>

      <div style={modalActionsStyle}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Отмена
        </button>

        <button
          onClick={onSubmit}
          disabled={disabled}
          style={{
            ...primaryButtonStyle,
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 24,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
  textAlign: "center",
};

const sectionTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#64748b",
  fontSize: 16,
  lineHeight: 1.6,
  textAlign: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
  color: "#ffffff",
  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
  boxShadow: "0 10px 22px rgba(37, 99, 235, 0.22)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0f172a",
};

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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 90,
  resize: "vertical",
};

const tableWrapStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  overflow: "hidden",
};

const tableTitleStyle: React.CSSProperties = {
  padding: 18,
  borderBottom: "1px solid #e5edf7",
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
};

const headCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #e5edf7",
  textAlign: "left",
  color: "#475569",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const firstCellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "middle",
};

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  verticalAlign: "middle",
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "#1d4ed8",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
};

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

const modalBoxStyle: React.CSSProperties = {
  width: "min(1180px, 96vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 22,
  padding: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 26px 70px rgba(15, 23, 42, 0.28)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 18,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const closeButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 20,
  color: "#0f172a",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const infoBoxStyle: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 14,
  minHeight: 72,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginBottom: 8,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 15,
};

const commentBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
  color: "#475569",
  lineHeight: 1.6,
};

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

const modalActionsStyle: React.CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};
