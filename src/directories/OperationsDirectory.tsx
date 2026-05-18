import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../supabase";

type Operation = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

const categoryOptions = [
  { value: "cutting", label: "Крой" },
  { value: "sewing", label: "Пошив" },
  { value: "vto", label: "ВТО" },
  { value: "control", label: "Контроль" },
  { value: "packing", label: "Упаковка" },
  { value: "other", label: "Прочее" },
];

const categoryMap: Record<string, string> = {
  cutting: "Крой",
  sewing: "Пошив",
  vto: "ВТО",
  control: "Контроль",
  packing: "Упаковка",
  other: "Прочее",
};

export default function OperationsDirectory() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Operation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");

  async function loadOperations() {
    setError("");

    const { data, error } = await supabase
      .from("operations")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setOperations(data || []);
  }

  useEffect(() => {
    loadOperations();
  }, []);

  const filteredOperations = useMemo(() => {
    return operations.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [operations, search]);

  async function handleSave() {
    if (!selected) return;

    setError("");

    const payload = {
      name: selected.name,
      category: selected.category,
      description: selected.description,
      sort_order: selected.sort_order,
      is_active: selected.is_active,
    };

    let response;

    if (selected.id) {
      response = await supabase
        .from("operations")
        .update(payload)
        .eq("id", selected.id);
    } else {
      response = await supabase.from("operations").insert(payload);
    }

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setIsModalOpen(false);
    setSelected(null);

    loadOperations();
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Операции</h1>

        <div style={styles.heroText}>
          Базовый справочник производственных операций для техкарт и
          производства.
        </div>
      </div>

      <div style={styles.toolbar}>
        <button
          style={styles.primaryButton}
          onClick={() => {
            setSelected({
              id: "",
              name: "",
              category: "other",
              description: "",
              sort_order: 0,
              is_active: true,
            });

            setIsModalOpen(true);
          }}
        >
          Добавить операцию
        </button>

        <input
          style={styles.search}
          placeholder="Поиск по операциям"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button style={styles.secondaryButton} onClick={loadOperations}>
          Обновить
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tableCard}>
        <div style={styles.tableTitle}>Реестр операций</div>

        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Название</th>
              <th style={styles.th}>Категория</th>
              <th style={styles.th}>Порядок</th>
              <th style={styles.th}>Статус</th>
            </tr>
          </thead>

          <tbody>
            {filteredOperations.length === 0 ? (
              <tr>
                <td colSpan={4} style={styles.empty}>
                  Операции не найдены
                </td>
              </tr>
            ) : (
              filteredOperations.map((item) => (
                <tr
                  key={item.id}
                  style={styles.row}
                  onClick={() => {
                    setSelected(item);
                    setIsModalOpen(true);
                  }}
                >
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>
                    {categoryMap[item.category] || item.category}
                  </td>
                  <td style={styles.td}>{item.sort_order}</td>
                  <td style={styles.td}>
                    {item.is_active ? "Активна" : "Не активна"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selected && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>
                  {selected.id
                    ? "Карточка операции"
                    : "Новая операция"}
                </div>
              </div>

              <button
                style={styles.closeButton}
                onClick={() => {
                  setIsModalOpen(false);
                  setSelected(null);
                }}
              >
                ×
              </button>
            </div>

            <div style={styles.formGrid}>
              <div>
                <div style={styles.label}>Название</div>

                <input
                  style={styles.input}
                  value={selected.name}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <div style={styles.label}>Категория</div>

                <select
                  style={styles.input}
                  value={selected.category}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      category: e.target.value,
                    })
                  }
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={styles.label}>Порядок сортировки</div>

                <input
                  type="number"
                  style={styles.input}
                  value={selected.sort_order}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      sort_order: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <div style={styles.label}>Активность</div>

                <select
                  style={styles.input}
                  value={selected.is_active ? "true" : "false"}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      is_active: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">Активна</option>
                  <option value="false">Не активна</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={styles.label}>Описание</div>

              <textarea
                style={styles.textarea}
                value={selected.description || ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.secondaryButton}
                onClick={() => {
                  setIsModalOpen(false);
                  setSelected(null);
                }}
              >
                Отмена
              </button>

              <button style={styles.primaryButton} onClick={handleSave}>
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  hero: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 28,
    border: "1px solid #dbe4f0",
  },

  heroTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
  },

  heroText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 16,
    lineHeight: 1.6,
    textAlign: "center",
  },

  toolbar: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 24,
    padding: 18,
  },

  primaryButton: {
    border: "none",
    borderRadius: 16,
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 15,
    padding: "14px 22px",
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 15,
    padding: "14px 20px",
    cursor: "pointer",
  },

  search: {
    flex: 1,
    minWidth: 220,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    padding: "14px 18px",
    fontSize: 15,
  },

  error: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 18,
    padding: 18,
    textAlign: "center",
    fontWeight: 700,
  },

  tableCard: {
    background: "#ffffff",
    borderRadius: 24,
    border: "1px solid #dbe4f0",
    overflow: "hidden",
  },

  tableTitle: {
    padding: 24,
    fontSize: 20,
    fontWeight: 800,
    textAlign: "center",
    borderBottom: "1px solid #e2e8f0",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "18px 20px",
    fontSize: 14,
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "18px 20px",
    borderBottom: "1px solid #f1f5f9",
  },

  row: {
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    padding: 40,
    color: "#64748b",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 100,
  },

  modal: {
    width: "min(760px, 100%)",
    background: "#ffffff",
    borderRadius: 28,
    padding: 24,
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 28,
    fontWeight: 800,
  },

  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    border: "1px solid #dbe4f0",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 24,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
  },

  label: {
    marginBottom: 8,
    fontSize: 14,
    color: "#64748b",
    fontWeight: 600,
  },

  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    padding: "14px 16px",
    fontSize: 15,
  },

  textarea: {
    width: "100%",
    minHeight: 120,
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    padding: 16,
    fontSize: 15,
    resize: "vertical",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
};