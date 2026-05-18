import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type OperationItem = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_time_min: number | null;
  default_price: number | null;
  is_active: boolean;
  created_at: string | null;
};

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

export default function OperationsCatalogModal({ onClose, onChanged }: Props) {
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [defaultTimeMin, setDefaultTimeMin] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [description, setDescription] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDefaultTimeMin, setEditDefaultTimeMin] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadOperations();
  }, []);

  async function loadOperations() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("operations")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;

      setOperations((data as OperationItem[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки операций");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOperation(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Заполни название операции");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase.from("operations").insert({
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        default_time_min: defaultTimeMin ? Number(defaultTimeMin) : null,
        default_price: defaultPrice ? Number(defaultPrice) : null,
        is_active: true,
      });

      if (error) throw error;

      setName("");
      setCode("");
      setDefaultTimeMin("");
      setDefaultPrice("");
      setDescription("");
      setMessage("Операция добавлена.");

      await loadOperations();
      onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить операцию");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(operation: OperationItem) {
    setEditingId(operation.id);
    setEditName(operation.name);
    setEditCode(operation.code || "");
    setEditDefaultTimeMin(
      operation.default_time_min !== null ? String(operation.default_time_min) : ""
    );
    setEditDefaultPrice(
      operation.default_price !== null ? String(operation.default_price) : ""
    );
    setEditDescription(operation.description || "");
    setEditIsActive(operation.is_active);
  }

  async function handleUpdateOperation(operation: OperationItem) {
    if (!editName.trim()) {
      setError("Заполни название операции");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("operations")
        .update({
          name: editName.trim(),
          code: editCode.trim() || null,
          description: editDescription.trim() || null,
          default_time_min: editDefaultTimeMin ? Number(editDefaultTimeMin) : null,
          default_price: editDefaultPrice ? Number(editDefaultPrice) : null,
          is_active: editIsActive,
        })
        .eq("id", operation.id);

      if (error) throw error;

      setEditingId(null);
      setMessage("Операция обновлена.");

      await loadOperations();
      onChanged();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить операцию");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOperation(operation: OperationItem) {
    const confirmed = window.confirm(`Удалить операцию "${operation.name}"?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("operations")
        .delete()
        .eq("id", operation.id);

      if (error) throw error;

      setMessage("Операция удалена.");
      await loadOperations();
      onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить операцию. Возможно, она уже используется."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Справочник операций</div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Здесь настраиваются операции для техкарт изделий.
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
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
              marginBottom: 14,
            }}
          >
            {message || error}
          </div>
        )}

        <form onSubmit={handleCreateOperation} style={createBoxStyle}>
          <div style={boxTitleStyle}>Добавить операцию</div>

          <div style={formGridStyle}>
            <Field label="Название">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Пришить бирку"
                style={inputStyle}
              />
            </Field>

            <Field label="Код">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Например: LABEL"
                style={inputStyle}
              />
            </Field>

            <Field label="Время, мин">
              <input
                value={defaultTimeMin}
                onChange={(e) => setDefaultTimeMin(e.target.value)}
                type="number"
                step="0.01"
                placeholder="Например: 3"
                style={inputStyle}
              />
            </Field>

            <Field label="Цена">
              <input
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                type="number"
                step="0.01"
                placeholder="Например: 8"
                style={inputStyle}
              />
            </Field>

            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Описание">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button disabled={saving} type="submit" style={primaryButtonStyle}>
                {saving ? "Сохранение..." : "Добавить"}
              </button>
            </div>
          </div>
        </form>

        <div style={listBoxStyle}>
          <div style={boxTitleStyle}>Список операций</div>

          {loading && <div style={emptyStyle}>Загрузка...</div>}

          {!loading && operations.length === 0 && (
            <div style={emptyStyle}>Операции не найдены</div>
          )}

          {!loading && operations.length > 0 && (
            <div style={cardsGridStyle}>
              {operations.map((operation) => (
                <div key={operation.id} style={cardStyle}>
                  {editingId === operation.id ? (
                    <div style={editGridStyle}>
                      <Field label="Название">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Код">
                        <input
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Время, мин">
                        <input
                          value={editDefaultTimeMin}
                          onChange={(e) => setEditDefaultTimeMin(e.target.value)}
                          type="number"
                          step="0.01"
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Цена">
                        <input
                          value={editDefaultPrice}
                          onChange={(e) => setEditDefaultPrice(e.target.value)}
                          type="number"
                          step="0.01"
                          style={inputStyle}
                        />
                      </Field>

                      <Field label="Активность">
                        <select
                          value={editIsActive ? "true" : "false"}
                          onChange={(e) => setEditIsActive(e.target.value === "true")}
                          style={inputStyle}
                        >
                          <option value="true">Активна</option>
                          <option value="false">Неактивна</option>
                        </select>
                      </Field>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <Field label="Описание">
                          <input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>
                      </div>

                      <div style={actionsStyle}>
                        <button
                          onClick={() => handleUpdateOperation(operation)}
                          disabled={saving}
                          style={primarySmallButtonStyle}
                        >
                          Сохранить
                        </button>

                        <button
                          onClick={() => setEditingId(null)}
                          style={secondarySmallButtonStyle}
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={cardTitleStyle}>{operation.name}</div>
                      <div style={cardTextStyle}>Код: {operation.code || "—"}</div>
                      <div style={cardTextStyle}>
                        Время:{" "}
                        {operation.default_time_min !== null
                          ? `${operation.default_time_min} мин`
                          : "—"}
                      </div>
                      <div style={cardTextStyle}>
                        Цена:{" "}
                        {operation.default_price !== null
                          ? operation.default_price
                          : "—"}
                      </div>
                      <div style={cardTextStyle}>
                        Статус: {operation.is_active ? "Активна" : "Неактивна"}
                      </div>
                      <div style={cardTextStyle}>
                        Описание: {operation.description || "—"}
                      </div>

                      <div style={actionsStyle}>
                        <button
                          onClick={() => startEdit(operation)}
                          style={secondarySmallButtonStyle}
                        >
                          Редактировать
                        </button>

                        <button
                          onClick={() => handleDeleteOperation(operation)}
                          style={dangerSmallButtonStyle}
                        >
                          Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 11000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbe4f0",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  padding: 20,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#0f172a",
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 20,
  color: "#0f172a",
};

const createBoxStyle: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
};

const listBoxStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 16,
};

const boxTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 12,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardStyle: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 14,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 8,
};

const cardTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.5,
  marginTop: 4,
};

const editGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 44,
  border: "none",
  borderRadius: 12,
  background: "#4f46e5",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  padding: "0 16px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const primarySmallButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#4f46e5",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerSmallButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#dc2626",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
  color: "#64748b",
  fontWeight: 600,
};