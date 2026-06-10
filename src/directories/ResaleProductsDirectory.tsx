import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type ResaleProductItem = {
  id: string;
  item_type: string;
  name: string;
  article: string | null;
  barcode: string | null;
  unit_id: string | null;
  default_price: number | null;
  min_stock: number | null;
  is_active: boolean;
  created_at: string | null;
};

type UnitItem = {
  id: string;
  name: string;
  short_name: string;
};

export default function ResaleProductsDirectory() {
  const [items, setItems] = useState<ResaleProductItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unitId, setUnitId] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editName, setEditName] = useState("");
  const [editArticle, setEditArticle] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadItems(), loadUnits()]);
  }

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("item_type", "resale_product")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const safeItems = (data as ResaleProductItem[]) || [];
      setItems(safeItems);

      if (safeItems.length > 0 && !selectedItemId) {
        setSelectedItemId(safeItems[0].id);
      }

      if (
        selectedItemId &&
        !safeItems.find((item) => item.id === selectedItemId)
      ) {
        setSelectedItemId(safeItems[0]?.id || null);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки товаров на перепродажу"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadUnits() {
    const { data, error } = await supabase
      .from("units")
      .select("id, name, short_name")
      .order("name", { ascending: true });

    if (error) throw error;

    const safeUnits = (data as UnitItem[]) || [];
    setUnits(safeUnits);

    if (!unitId && safeUnits.length > 0) {
      setUnitId(safeUnits[0].id);
    }
  }

  function resetForm() {
    setName("");
    setArticle("");
    setBarcode("");
    setUnitId(units[0]?.id || "");
    setDefaultPrice("");
    setMinStock("");
    setIsActive(true);
  }

  function fillEditForm(item: ResaleProductItem) {
    setEditName(item.name || "");
    setEditArticle(item.article || "");
    setEditBarcode(item.barcode || "");
    setEditUnitId(item.unit_id || "");
    setEditDefaultPrice(
      item.default_price !== null ? String(item.default_price) : ""
    );
    setEditMinStock(item.min_stock !== null ? String(item.min_stock) : "");
    setEditIsActive(item.is_active);
  }

  function getUnitLabel(unitIdValue: string | null) {
    if (!unitIdValue) return "—";
    const unit = units.find((item) => item.id === unitIdValue);
    if (!unit) return "—";
    return `${unit.name} (${unit.short_name})`;
  }

  function openItemCard(item: ResaleProductItem) {
    setSelectedItemId(item.id);
    setViewItemId(item.id);
    setIsEditMode(false);
    fillEditForm(item);
    setError("");
    setMessage("");
  }

  function closeItemCard() {
    setViewItemId(null);
    setIsEditMode(false);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Заполни название товара");
      return;
    }

    if (!unitId) {
      setError("Выбери единицу измерения");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase
        .from("items")
        .insert({
          item_type: "resale_product",
          name: name.trim(),
          article: article.trim() || null,
          barcode: barcode.trim() || null,
          unit_id: unitId,
          default_price: defaultPrice ? Number(defaultPrice) : null,
          min_stock: minStock ? Number(minStock) : null,
          is_active: isActive,
        })
        .select()
        .single();

      if (error) throw error;

      setMessage("Товар на перепродажу добавлен.");
      resetForm();
      setIsCreateOpen(false);
      await loadItems();

      if (data?.id) {
        setSelectedItemId(data.id);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось добавить товар на перепродажу"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem(e: React.FormEvent) {
    e.preventDefault();

    if (!viewItemId) return;

    if (!editName.trim()) {
      setError("Заполни название товара");
      return;
    }

    if (!editUnitId) {
      setError("Выбери единицу измерения");
      return;
    }

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase
        .from("items")
        .update({
          name: editName.trim(),
          article: editArticle.trim() || null,
          barcode: editBarcode.trim() || null,
          unit_id: editUnitId,
          default_price: editDefaultPrice ? Number(editDefaultPrice) : null,
          min_stock: editMinStock ? Number(editMinStock) : null,
          is_active: editIsActive,
        })
        .eq("id", viewItemId)
        .eq("item_type", "resale_product")
        .select()
        .single();

      if (error) throw error;

      const updatedItem = data as ResaleProductItem;

      setItems((prev) =>
        prev.map((item) => (item.id === viewItemId ? updatedItem : item))
      );

      fillEditForm(updatedItem);
      setIsEditMode(false);
      setMessage("Карточка товара обновлена.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось обновить товар на перепродажу"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteItem(item: ResaleProductItem) {
    const confirmed = window.confirm(`Удалить товар "${item.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", item.id)
        .eq("item_type", "resale_product");

      if (error) throw error;

      const nextItems = items.filter((currentItem) => currentItem.id !== item.id);
      setItems(nextItems);
      setMessage(`Товар "${item.name}" удалён.`);

      if (selectedItemId === item.id) {
        setSelectedItemId(nextItems[0]?.id || null);
      }

      if (viewItemId === item.id) {
        closeItemCard();
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить товар на перепродажу"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        (item.article || "").toLowerCase().includes(query) ||
        (item.barcode || "").toLowerCase().includes(query) ||
        getUnitLabel(item.unit_id).toLowerCase().includes(query)
      );
    });
  }, [items, search, units]);

  const viewItem = items.find((item) => item.id === viewItemId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={sectionStyle}>
        <div style={pageTitleStyle}>Товары на перепродажу</div>

        <div style={{ color: "#64748b", lineHeight: 1.6 }}>
          Здесь хранятся покупные товары, которые продаются без производства и
          техкарт.
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
              Добавить новый товар
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по товарам"
              style={{
                ...inputStyle,
                width: 280,
                maxWidth: "100%",
              }}
            />
          </div>

          <button onClick={loadAll} style={secondaryButtonStyle}>
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

      <div
        style={{
          background: "#ffffff",
          borderRadius: 18,
          border: "1px solid #dbe4f0",
          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid #e5edf7",
            fontSize: 20,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Реестр товаров на перепродажу
        </div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка товаров...
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Товары на перепродажу не найдены
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
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
                    "Артикул",
                    "Штрихкод",
                    "Ед. изм.",
                    "Цена",
                    "Мин. остаток",
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
                {filteredItems.map((item) => {
                  const isSelected = selectedItemId === item.id;
                  const isDeleting = deletingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      style={{
                        background: isSelected ? "#eef4ff" : "#ffffff",
                      }}
                    >
                      <td style={cellStyle}>
                        <button
                          onClick={() => openItemCard(item)}
                          style={linkButtonStyle}
                        >
                          {item.name}
                        </button>
                      </td>

                      <td style={cellStyle}>{item.article || "—"}</td>
                      <td style={cellStyle}>{item.barcode || "—"}</td>
                      <td style={cellStyle}>{getUnitLabel(item.unit_id)}</td>
                      <td style={cellStyle}>
                        {item.default_price !== null ? item.default_price : "—"}
                      </td>
                      <td style={cellStyle}>
                        {item.min_stock !== null ? item.min_stock : "—"}
                      </td>
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
                          onClick={() => handleDeleteItem(item)}
                          disabled={isDeleting}
                          style={dangerButtonStyle}
                        >
                          {isDeleting ? "Удаляю..." : "Удалить"}
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

      {isCreateOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsCreateOpen(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Новый товар на перепродажу</div>
                <div style={modalSubtitleStyle}>
                  Покупной товар, который продаётся без производства
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddItem}>
              <div style={formGridStyle}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название"
                  style={inputStyle}
                />

                <input
                  value={article}
                  onChange={(e) => setArticle(e.target.value)}
                  placeholder="Артикул"
                  style={inputStyle}
                />

                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Штрихкод"
                  style={inputStyle}
                />

                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выбери единицу измерения</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.short_name})
                    </option>
                  ))}
                </select>

                <input
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="Цена по умолчанию"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />

                <input
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="Минимальный остаток"
                  type="number"
                  step="0.001"
                  style={inputStyle}
                />

                <label style={checkboxLabelStyle}>
                  <input
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    type="checkbox"
                  />
                  Активен
                </label>
              </div>

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={secondaryButtonStyle}
                >
                  Отмена
                </button>

                <button type="submit" disabled={saving} style={primaryButtonStyle}>
                  {saving ? "Сохраняю..." : "Добавить товар"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewItem && (
        <div style={modalOverlayStyle} onClick={closeItemCard}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка товара</div>
                <div style={modalSubtitleStyle}>{viewItem.name}</div>
              </div>

              <button type="button" onClick={closeItemCard} style={closeButtonStyle}>
                ×
              </button>
            </div>

            {!isEditMode && (
              <>
                <div style={cardGridStyle}>
                  <InfoCard label="Название" value={viewItem.name} />
                  <InfoCard label="Артикул" value={viewItem.article || "—"} />
                  <InfoCard label="Штрихкод" value={viewItem.barcode || "—"} />
                  <InfoCard
                    label="Единица измерения"
                    value={getUnitLabel(viewItem.unit_id)}
                  />
                  <InfoCard
                    label="Цена по умолчанию"
                    value={
                      viewItem.default_price !== null
                        ? String(viewItem.default_price)
                        : "—"
                    }
                  />
                  <InfoCard
                    label="Минимальный остаток"
                    value={
                      viewItem.min_stock !== null ? String(viewItem.min_stock) : "—"
                    }
                  />
                  <InfoCard
                    label="Активность"
                    value={viewItem.is_active ? "Активен" : "Неактивен"}
                  />
                </div>

                <div style={infoBannerStyle}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Товар на перепродажу
                  </div>
                  <div>
                    Этот товар закупается готовым и продаётся без техкарты,
                    производственного заказа и операций.
                  </div>
                </div>

                <div style={modalFooterStyle}>
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    style={primaryButtonStyle}
                  >
                    Редактировать
                  </button>
                </div>
              </>
            )}

            {isEditMode && (
              <form onSubmit={handleUpdateItem}>
                <div style={formGridStyle}>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Название"
                    style={inputStyle}
                  />

                  <input
                    value={editArticle}
                    onChange={(e) => setEditArticle(e.target.value)}
                    placeholder="Артикул"
                    style={inputStyle}
                  />

                  <input
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    placeholder="Штрихкод"
                    style={inputStyle}
                  />

                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Выбери единицу измерения</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name} ({unit.short_name})
                      </option>
                    ))}
                  </select>

                  <input
                    value={editDefaultPrice}
                    onChange={(e) => setEditDefaultPrice(e.target.value)}
                    placeholder="Цена по умолчанию"
                    type="number"
                    step="0.01"
                    style={inputStyle}
                  />

                  <input
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    placeholder="Минимальный остаток"
                    type="number"
                    step="0.001"
                    style={inputStyle}
                  />

                  <label style={checkboxLabelStyle}>
                    <input
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      type="checkbox"
                    />
                    Активен
                  </label>
                </div>

                <div style={modalFooterStyle}>
                  <button
                    type="button"
                    onClick={() => {
                      fillEditForm(viewItem);
                      setIsEditMode(false);
                    }}
                    style={secondaryButtonStyle}
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    disabled={updating}
                    style={primaryButtonStyle}
                  >
                    {updating ? "Сохраняю..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
  padding: 18,
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  color: "#0f172a",
  background: "#ffffff",
  fontWeight: 600,
  boxSizing: "border-box",
  minWidth: 0,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 12,
  background: "#4f46e5",
  color: "#ffffff",
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 10px 20px rgba(79, 70, 229, 0.2)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  padding: "11px 15px",
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  background: "#dc2626",
  color: "#ffffff",
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 800,
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 800,
  padding: 0,
  textAlign: "left",
};

const headCellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e5edf7",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  fontSize: 14,
  verticalAlign: "middle",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.42)",
  backdropFilter: "blur(4px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  width: "min(1080px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
  padding: 22,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 6,
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 22,
  fontWeight: 800,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  minHeight: 64,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginBottom: 8,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
};

const infoBannerStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #c4b5fd",
  background: "#f5f3ff",
  color: "#4c1d95",
  borderRadius: 14,
  padding: 14,
  lineHeight: 1.5,
};

const modalFooterStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
  fontWeight: 800,
  minHeight: 44,
};
