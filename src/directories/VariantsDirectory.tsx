import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../supabase";

type TabKey = "colors" | "sizeGroups" | "sizes";

type ColorItem = {
  id: string;
  name: string;
  hex: string | null;
  is_active: boolean | null;
  created_at?: string | null;
};

type SizeGroupItem = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

type SizeItem = {
  id: string;
  name: string;
  international_code: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

const tabs = [
  { key: "colors" as TabKey, title: "Цвета", icon: "🎨" },
  { key: "sizeGroups" as TabKey, title: "Размерные группы", icon: "📏" },
  { key: "sizes" as TabKey, title: "Размеры", icon: "🏷️" },
];

const emptyColor: ColorItem = {
  id: "",
  name: "",
  hex: "#2563eb",
  is_active: true,
};

const emptySizeGroup: SizeGroupItem = {
  id: "",
  name: "",
  code: "",
  sort_order: 0,
  is_active: true,
};

const emptySize: SizeItem = {
  id: "",
  name: "",
  international_code: "",
  sort_order: 0,
  is_active: true,
};

export default function VariantsDirectory() {
  const [activeTab, setActiveTab] = useState<TabKey>("colors");

  const [colors, setColors] = useState<ColorItem[]>([]);
  const [sizeGroups, setSizeGroups] = useState<SizeGroupItem[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [colorModal, setColorModal] = useState<ColorItem | null>(null);
  const [sizeGroupModal, setSizeGroupModal] = useState<SizeGroupItem | null>(null);
  const [sizeModal, setSizeModal] = useState<SizeItem | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    setMessage("");

    await Promise.all([loadColors(), loadSizeGroups(), loadSizes()]);

    setLoading(false);
  }

async function loadColors() {
  const { data, error } = await supabase
    .from("colors")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    return;
  }

  setColors(data || []);
}

  async function loadSizeGroups() {
    const { data, error } = await supabase
      .from("size_groups")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      return;
    }

    setSizeGroups((data as SizeGroupItem[]) || []);
  }

async function loadSizes() {
  const { data, error } = await supabase
    .from("sizes")
    .select("*")
    .order("name");

  if (error) {
    console.error(error);
    return;
  }

  setSizes(data || []);
}

  const filteredColors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return colors.filter((item) =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.hex || "").toLowerCase().includes(query)
    );
  }, [colors, search]);

  const filteredSizeGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sizeGroups.filter((item) =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.code || "").toLowerCase().includes(query)
    );
  }, [sizeGroups, search]);

  const filteredSizes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sizes.filter((item) =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.international_code || "").toLowerCase().includes(query)
    );
  }, [sizes, search]);

  async function saveColor() {
    if (!colorModal) return;

    if (!colorModal.name.trim()) {
      setError("Введите название цвета");
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      name: colorModal.name.trim(),
      hex: colorModal.hex || "#000000",
      is_active: colorModal.is_active !== false,
    };

    const response = colorModal.id
      ? await supabase.from("colors").update(payload).eq("id", colorModal.id)
      : await supabase.from("colors").insert(payload);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setColorModal(null);
    setMessage("Цвет сохранён");
    await loadColors();
  }

  async function saveSizeGroup() {
    if (!sizeGroupModal) return;

    if (!sizeGroupModal.name.trim()) {
      setError("Введите название размерной группы");
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      name: sizeGroupModal.name.trim(),
      code: sizeGroupModal.code?.trim() || null,
      sort_order: Number(sizeGroupModal.sort_order || 0),
      is_active: sizeGroupModal.is_active !== false,
    };

    const response = sizeGroupModal.id
      ? await supabase.from("size_groups").update(payload).eq("id", sizeGroupModal.id)
      : await supabase.from("size_groups").insert(payload);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setSizeGroupModal(null);
    setMessage("Размерная группа сохранена");
    await loadSizeGroups();
  }

  async function saveSize() {
    if (!sizeModal) return;

    if (!sizeModal.name.trim()) {
      setError("Введите размер");
      return;
    }

    setError("");
    setMessage("");

    const payload = {
      name: sizeModal.name.trim(),
      international_code: sizeModal.international_code?.trim() || null,
      sort_order: Number(sizeModal.sort_order || 0),
      is_active: sizeModal.is_active !== false,
    };

    const response = sizeModal.id
      ? await supabase.from("sizes").update(payload).eq("id", sizeModal.id)
      : await supabase.from("sizes").insert(payload);

    if (response.error) {
      setError(response.error.message);
      return;
    }

    setSizeModal(null);
    setMessage("Размер сохранён");
    await loadSizes();
  }

  async function deleteColor(item: ColorItem) {
    if (!window.confirm(`Удалить цвет "${item.name}"?`)) return;

    const { error } = await supabase.from("colors").delete().eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadColors();
  }

  async function deleteSizeGroup(item: SizeGroupItem) {
    if (!window.confirm(`Удалить размерную группу "${item.name}"?`)) return;

    const { error } = await supabase.from("size_groups").delete().eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadSizeGroups();
  }

  async function deleteSize(item: SizeItem) {
    if (!window.confirm(`Удалить размер "${item.name}"?`)) return;

    const { error } = await supabase.from("sizes").delete().eq("id", item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadSizes();
  }

  const activeTitle =
    tabs.find((tab) => tab.key === activeTab)?.title || "Справочник";

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Цвета и размеры</h1>
        <div style={styles.heroText}>
          Базовые варианты номенклатуры: цвета, размерные группы и размеры. Эти данные подтягиваются в изделия, материалы и производственные документы.
        </div>
      </div>

      <div style={styles.tabsCard}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab.key ? styles.activeTabButton : {}),
            }}
            onClick={() => {
              setActiveTab(tab.key);
              setSearch("");
              setError("");
              setMessage("");
            }}
          >
            <span>{tab.icon}</span>
            {tab.title}
          </button>
        ))}
      </div>

      <div style={styles.toolbar}>
        <button
          style={styles.primaryButton}
          onClick={() => {
            if (activeTab === "colors") setColorModal({ ...emptyColor });
            if (activeTab === "sizeGroups") setSizeGroupModal({ ...emptySizeGroup });
            if (activeTab === "sizes") setSizeModal({ ...emptySize });
          }}
        >
          + Добавить
        </button>

        <input
          style={styles.search}
          value={search}
          placeholder={`Поиск: ${activeTitle.toLowerCase()}`}
          onChange={(event) => setSearch(event.target.value)}
        />

        <button style={styles.secondaryButton} onClick={loadAll}>
          Обновить
        </button>
      </div>

      {(message || error) && (
        <div
          style={{
            ...styles.notice,
            background: error ? "#fef2f2" : "#dcfce7",
            borderColor: error ? "#fecaca" : "#86efac",
            color: error ? "#991b1b" : "#166534",
          }}
        >
          {error || message}
        </div>
      )}

      {loading && <div style={styles.notice}>Загрузка...</div>}

      {activeTab === "colors" && (
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>Реестр: Цвета</div>

          <div style={styles.grid}>
            {filteredColors.map((item) => (
              <button
                key={item.id}
                style={styles.itemCard}
                onClick={() => setColorModal(item)}
              >
                <span
                  style={{
                    ...styles.colorPreview,
                    background: item.hex || "#000000",
                  }}
                />

                <div>
                  <div style={styles.itemTitle}>{item.name}</div>
                  <div style={styles.itemSub}>{item.hex || "—"}</div>
                </div>

                <span style={item.is_active === false ? styles.badgeMuted : styles.badge}>
                  {item.is_active === false ? "Выключен" : "Активен"}
                </span>
              </button>
            ))}

            {filteredColors.length === 0 && (
              <div style={styles.empty}>Цвета не найдены</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "sizeGroups" && (
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>Реестр: Размерные группы</div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Название</th>
                <th style={styles.th}>Код</th>
                <th style={styles.th}>Порядок</th>
                <th style={styles.th}>Активность</th>
              </tr>
            </thead>

            <tbody>
              {filteredSizeGroups.map((item) => (
                <tr key={item.id} style={styles.row} onClick={() => setSizeGroupModal(item)}>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.code || "—"}</td>
                  <td style={styles.td}>{item.sort_order || 0}</td>
                  <td style={styles.td}>{item.is_active === false ? "Выключена" : "Активна"}</td>
                </tr>
              ))}

              {filteredSizeGroups.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.empty}>Размерные группы не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "sizes" && (
        <div style={styles.tableCard}>
          <div style={styles.tableTitle}>Реестр: Размеры</div>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Название</th>
                <th style={styles.th}>Международный код</th>
                <th style={styles.th}>Порядок</th>
                <th style={styles.th}>Активность</th>
              </tr>
            </thead>

            <tbody>
              {filteredSizes.map((item) => (
                <tr key={item.id} style={styles.row} onClick={() => setSizeModal(item)}>
                  <td style={styles.td}>{item.name}</td>
                  <td style={styles.td}>{item.international_code || "—"}</td>
                  <td style={styles.td}>{item.sort_order || 0}</td>
                  <td style={styles.td}>{item.is_active === false ? "Выключен" : "Активен"}</td>
                </tr>
              ))}

              {filteredSizes.length === 0 && (
                <tr>
                  <td colSpan={4} style={styles.empty}>Размеры не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {colorModal && (
        <Modal title={colorModal.id ? "Карточка цвета" : "Новый цвет"} onClose={() => setColorModal(null)}>
          <div style={styles.formGrid}>
            <Field label="Название">
              <input
                style={styles.input}
                value={colorModal.name}
                onChange={(event) =>
                  setColorModal({ ...colorModal, name: event.target.value })
                }
              />
            </Field>

            <Field label="Цвет">
              <input
                type="color"
                style={styles.input}
                value={colorModal.hex || "#000000"}
                onChange={(event) =>
                  setColorModal({ ...colorModal, hex: event.target.value })
                }
              />
            </Field>

            <Field label="Активность">
              <select
                style={styles.input}
                value={colorModal.is_active === false ? "false" : "true"}
                onChange={(event) =>
                  setColorModal({
                    ...colorModal,
                    is_active: event.target.value === "true",
                  })
                }
              >
                <option value="true">Активен</option>
                <option value="false">Выключен</option>
              </select>
            </Field>
          </div>

          <div style={styles.modalActions}>
            {colorModal.id && (
              <button style={styles.dangerButton} onClick={() => deleteColor(colorModal)}>
                Удалить
              </button>
            )}
            <button style={styles.secondaryButton} onClick={() => setColorModal(null)}>
              Отмена
            </button>
            <button style={styles.primaryButton} onClick={saveColor}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}

      {sizeGroupModal && (
        <Modal title={sizeGroupModal.id ? "Размерная группа" : "Новая размерная группа"} onClose={() => setSizeGroupModal(null)}>
          <div style={styles.formGrid}>
            <Field label="Название">
              <input
                style={styles.input}
                value={sizeGroupModal.name}
                onChange={(event) =>
                  setSizeGroupModal({ ...sizeGroupModal, name: event.target.value })
                }
              />
            </Field>

            <Field label="Код">
              <input
                style={styles.input}
                value={sizeGroupModal.code || ""}
                onChange={(event) =>
                  setSizeGroupModal({ ...sizeGroupModal, code: event.target.value })
                }
              />
            </Field>

            <Field label="Порядок">
              <input
                type="number"
                style={styles.input}
                value={sizeGroupModal.sort_order || 0}
                onChange={(event) =>
                  setSizeGroupModal({
                    ...sizeGroupModal,
                    sort_order: Number(event.target.value),
                  })
                }
              />
            </Field>

            <Field label="Активность">
              <select
                style={styles.input}
                value={sizeGroupModal.is_active === false ? "false" : "true"}
                onChange={(event) =>
                  setSizeGroupModal({
                    ...sizeGroupModal,
                    is_active: event.target.value === "true",
                  })
                }
              >
                <option value="true">Активна</option>
                <option value="false">Выключена</option>
              </select>
            </Field>
          </div>

          <div style={styles.modalActions}>
            {sizeGroupModal.id && (
              <button style={styles.dangerButton} onClick={() => deleteSizeGroup(sizeGroupModal)}>
                Удалить
              </button>
            )}
            <button style={styles.secondaryButton} onClick={() => setSizeGroupModal(null)}>
              Отмена
            </button>
            <button style={styles.primaryButton} onClick={saveSizeGroup}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}

      {sizeModal && (
        <Modal title={sizeModal.id ? "Карточка размера" : "Новый размер"} onClose={() => setSizeModal(null)}>
          <div style={styles.formGrid}>
            <Field label="Название">
              <input
                style={styles.input}
                value={sizeModal.name}
                onChange={(event) =>
                  setSizeModal({ ...sizeModal, name: event.target.value })
                }
              />
            </Field>

            <Field label="Международный код">
              <input
                style={styles.input}
                value={sizeModal.international_code || ""}
                onChange={(event) =>
                  setSizeModal({
                    ...sizeModal,
                    international_code: event.target.value,
                  })
                }
              />
            </Field>

            <Field label="Порядок">
              <input
                type="number"
                style={styles.input}
                value={sizeModal.sort_order || 0}
                onChange={(event) =>
                  setSizeModal({
                    ...sizeModal,
                    sort_order: Number(event.target.value),
                  })
                }
              />
            </Field>

            <Field label="Активность">
              <select
                style={styles.input}
                value={sizeModal.is_active === false ? "false" : "true"}
                onChange={(event) =>
                  setSizeModal({
                    ...sizeModal,
                    is_active: event.target.value === "true",
                  })
                }
              >
                <option value="true">Активен</option>
                <option value="false">Выключен</option>
              </select>
            </Field>
          </div>

          <div style={styles.modalActions}>
            {sizeModal.id && (
              <button style={styles.dangerButton} onClick={() => deleteSize(sizeModal)}>
                Удалить
              </button>
            )}
            <button style={styles.secondaryButton} onClick={() => setSizeModal(null)}>
              Отмена
            </button>
            <button style={styles.primaryButton} onClick={saveSize}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>{title}</div>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {children}
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
    <label>
      <div style={styles.label}>{label}</div>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  hero: {
    background: "#ffffff",
    borderRadius: 24,
    border: "1px solid #dbe4f0",
    padding: 28,
  },

  heroTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
    color: "#0f172a",
  },

  heroText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 17,
    lineHeight: 1.6,
  },

  tabsCard: {
    display: "flex",
    gap: 12,
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 22,
    padding: 14,
  },

  tabButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    background: "#ffffff",
    color: "#0f172a",
    padding: "14px 18px",
    fontWeight: 900,
    fontSize: 17,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  },

  activeTabButton: {
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#4f46e5)",
    color: "#ffffff",
    boxShadow: "0 10px 22px rgba(37,99,235,0.22)",
  },

  toolbar: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #dbe4f0",
    borderRadius: 22,
    padding: 16,
  },

  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    background: "linear-gradient(135deg,#2563eb,#4f46e5)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 16px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  dangerButton: {
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  search: {
    flex: 1,
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 16px",
    fontSize: 15,
  },

  notice: {
    border: "1px solid #dbe4f0",
    borderRadius: 18,
    padding: 16,
    background: "#ffffff",
    color: "#475569",
    fontWeight: 800,
  },

  tableCard: {
    background: "#ffffff",
    borderRadius: 24,
    border: "1px solid #dbe4f0",
    overflow: "hidden",
  },

  tableTitle: {
    padding: 20,
    borderBottom: "1px solid #e2e8f0",
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },

  grid: {
    padding: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },

  itemCard: {
    border: "1px solid #dbe4f0",
    borderRadius: 18,
    padding: 16,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 14,
    textAlign: "left",
    cursor: "pointer",
  },

  colorPreview: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    flexShrink: 0,
  },

  itemTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },

  itemSub: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
  },

  badge: {
    marginLeft: "auto",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    padding: "7px 10px",
    fontWeight: 800,
    fontSize: 13,
  },

  badgeMuted: {
    marginLeft: "auto",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#64748b",
    padding: "7px 10px",
    fontWeight: 800,
    fontSize: 13,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "16px 18px",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "16px 18px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
  },

  row: {
    cursor: "pointer",
  },

  empty: {
    padding: 30,
    color: "#64748b",
    textAlign: "center",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    backdropFilter: "blur(4px)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "min(780px, 96vw)",
    background: "#ffffff",
    borderRadius: 26,
    padding: 24,
    border: "1px solid #dbe4f0",
    boxShadow: "0 26px 70px rgba(15,23,42,0.28)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
  },

  modalTitle: {
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
  },

  closeButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },

  label: {
    color: "#475569",
    fontWeight: 900,
    marginBottom: 7,
  },

  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "13px 14px",
    fontSize: 15,
    boxSizing: "border-box",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 22,
  },
};
