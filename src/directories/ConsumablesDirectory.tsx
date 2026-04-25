import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type ConsumableItem = {
  id: string;
  name: string;
  article: string | null;
  category_id: string | null;
  color_id: string | null;
  unit_id: string;
  composition: string | null;
  size: string | null;
  supplier_name: string | null;
  default_price: number | null;
  min_stock: number | null;
  comment: string | null;
  is_active: boolean;
  created_at: string | null;
};

type CategoryItem = {
  id: string;
  name: string;
};

type ColorItem = {
  id: string;
  name: string;
  hex: string | null;
};

type UnitItem = {
  id: string;
  name: string;
  short_name: string;
};

export default function ConsumablesDirectory() {
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [colors, setColors] = useState<ColorItem[]>([]);
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
  const [categoryId, setCategoryId] = useState("");
  const [colorId, setColorId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [composition, setComposition] = useState("");
  const [size, setSize] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [comment, setComment] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editName, setEditName] = useState("");
  const [editArticle, setEditArticle] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editColorId, setEditColorId] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editComposition, setEditComposition] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadItems(), loadCategories(), loadColors(), loadUnits()]);
  }

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("consumables")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const safeItems = (data as ConsumableItem[]) || [];
      setItems(safeItems);

      if (safeItems.length > 0 && !selectedItemId) {
        setSelectedItemId(safeItems[0].id);
      }

      if (selectedItemId && !safeItems.find((item) => item.id === selectedItemId)) {
        setSelectedItemId(safeItems[0]?.id || null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки расходников");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("material_categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) throw error;
    setCategories((data as CategoryItem[]) || []);
  }

  async function loadColors() {
    const { data, error } = await supabase
      .from("colors")
      .select("id, name, hex")
      .order("name", { ascending: true });

    if (error) throw error;
    setColors((data as ColorItem[]) || []);
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
    setCategoryId("");
    setColorId("");
    setUnitId(units[0]?.id || "");
    setComposition("");
    setSize("");
    setSupplierName("");
    setDefaultPrice("");
    setMinStock("");
    setComment("");
    setIsActive(true);
  }

  function fillEditForm(item: ConsumableItem) {
    setEditName(item.name || "");
    setEditArticle(item.article || "");
    setEditCategoryId(item.category_id || "");
    setEditColorId(item.color_id || "");
    setEditUnitId(item.unit_id || "");
    setEditComposition(item.composition || "");
    setEditSize(item.size || "");
    setEditSupplierName(item.supplier_name || "");
    setEditDefaultPrice(item.default_price !== null ? String(item.default_price) : "");
    setEditMinStock(item.min_stock !== null ? String(item.min_stock) : "");
    setEditComment(item.comment || "");
    setEditIsActive(item.is_active);
  }

  function openItemCard(item: ConsumableItem) {
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
      setError("Заполни название расходника");
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
        .from("consumables")
        .insert({
          name: name.trim(),
          article: article.trim() || null,
          category_id: categoryId || null,
          color_id: colorId || null,
          unit_id: unitId,
          composition: composition.trim() || null,
          size: size.trim() || null,
          supplier_name: supplierName.trim() || null,
          default_price: defaultPrice ? Number(defaultPrice) : null,
          min_stock: minStock ? Number(minStock) : null,
          comment: comment.trim() || null,
          is_active: isActive,
        })
        .select()
        .single();

      if (error) throw error;

      setMessage("Расходник добавлен.");
      resetForm();
      setIsCreateOpen(false);
      await loadItems();

      if (data?.id) {
        setSelectedItemId(data.id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить расходник");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateItem(e: React.FormEvent) {
    e.preventDefault();

    if (!viewItemId) return;

    if (!editName.trim()) {
      setError("Заполни название расходника");
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
        .from("consumables")
        .update({
          name: editName.trim(),
          article: editArticle.trim() || null,
          category_id: editCategoryId || null,
          color_id: editColorId || null,
          unit_id: editUnitId,
          composition: editComposition.trim() || null,
          size: editSize.trim() || null,
          supplier_name: editSupplierName.trim() || null,
          default_price: editDefaultPrice ? Number(editDefaultPrice) : null,
          min_stock: editMinStock ? Number(editMinStock) : null,
          comment: editComment.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", viewItemId)
        .select()
        .single();

      if (error) throw error;

      const updatedItem = data as ConsumableItem;

      setItems((prev) =>
        prev.map((item) => (item.id === viewItemId ? updatedItem : item))
      );

      fillEditForm(updatedItem);
      setIsEditMode(false);
      setMessage("Карточка расходника обновлена.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить расходник");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteItem(item: ConsumableItem) {
    const confirmed = window.confirm(`Удалить расходник "${item.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("consumables")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      const nextItems = items.filter((row) => row.id !== item.id);
      setItems(nextItems);
      setMessage(`Расходник "${item.name}" удалён.`);

      if (selectedItemId === item.id) {
        setSelectedItemId(nextItems[0]?.id || null);
      }

      if (viewItemId === item.id) {
        closeItemCard();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить расходник");
    } finally {
      setDeletingId(null);
    }
  }

  function getCategoryName(categoryIdValue: string | null) {
    if (!categoryIdValue) return "—";
    return categories.find((item) => item.id === categoryIdValue)?.name || "—";
  }

  function getColorName(colorIdValue: string | null) {
    if (!colorIdValue) return "—";
    return colors.find((item) => item.id === colorIdValue)?.name || "—";
  }

  function getUnitLabel(unitIdValue: string) {
    const unit = units.find((item) => item.id === unitIdValue);
    if (!unit) return "—";
    return `${unit.name} (${unit.short_name})`;
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const categoryName = getCategoryName(item.category_id);
      const colorName = getColorName(item.color_id);
      const unitName = getUnitLabel(item.unit_id);

      return (
        item.name.toLowerCase().includes(query) ||
        (item.article || "").toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query) ||
        colorName.toLowerCase().includes(query) ||
        unitName.toLowerCase().includes(query) ||
        (item.composition || "").toLowerCase().includes(query) ||
        (item.size || "").toLowerCase().includes(query) ||
        (item.supplier_name || "").toLowerCase().includes(query) ||
        (item.comment || "").toLowerCase().includes(query)
      );
    });
  }, [items, search, categories, colors, units]);

  const viewItem = items.find((item) => item.id === viewItemId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={sectionStyle}>
        <div style={pageTitleStyle}>Расходники</div>

        <div style={{ color: "#64748b", lineHeight: 1.6 }}>
          Здесь хранится реестр упаковки, бирок, ниток, лент, наклеек и других
          расходных материалов, которые используются в производстве.
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
              Добавить новый расходник
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по расходникам"
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
          Реестр расходников
        </div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка расходников...
          </div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Расходники не найдены
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
                    "Категория",
                    "Цвет",
                    "Ед. изм.",
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
                      <td
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid #eef2f7",
                          verticalAlign: "middle",
                        }}
                      >
                        <button
                          onClick={() => openItemCard(item)}
                          style={linkButtonStyle}
                        >
                          {item.name}
                        </button>
                      </td>

                      <td style={cellStyle}>{item.article || "—"}</td>
                      <td style={cellStyle}>{getCategoryName(item.category_id)}</td>
                      <td style={cellStyle}>{getColorName(item.color_id)}</td>
                      <td style={cellStyle}>{getUnitLabel(item.unit_id)}</td>
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

      {viewItem && (
        <div onClick={closeItemCard} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка расходника</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {viewItem.name}
                </div>
              </div>

              <button onClick={closeItemCard} style={closeButtonStyle}>
                ×
              </button>
            </div>

            {!isEditMode && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <Info label="Название" value={viewItem.name} />
                  <Info label="Артикул" value={viewItem.article || "—"} />
                  <Info label="Категория" value={getCategoryName(viewItem.category_id)} />
                  <Info label="Цвет" value={getColorName(viewItem.color_id)} />
                  <Info label="Единица измерения" value={getUnitLabel(viewItem.unit_id)} />
                  <Info label="Состав" value={viewItem.composition || "—"} />
                  <Info label="Размер" value={viewItem.size || "—"} />
                  <Info label="Поставщик" value={viewItem.supplier_name || "—"} />
                  <Info
                    label="Цена по умолчанию"
                    value={
                      viewItem.default_price !== null
                        ? String(viewItem.default_price)
                        : "—"
                    }
                  />
                  <Info
                    label="Минимальный остаток"
                    value={
                      viewItem.min_stock !== null ? String(viewItem.min_stock) : "—"
                    }
                  />
                  <Info
                    label="Активность"
                    value={viewItem.is_active ? "Активен" : "Неактивен"}
                  />
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    background: "#f8fbff",
                    border: "1px solid #dbe4f0",
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    Комментарий:
                  </span>{" "}
                  {viewItem.comment || "—"}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => {
                      fillEditForm(viewItem);
                      setIsEditMode(true);
                    }}
                    style={primaryButtonStyle}
                  >
                    Редактировать
                  </button>
                </div>
              </>
            )}

            {isEditMode && (
              <form
                onSubmit={handleUpdateItem}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <Field label="Название">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Артикул">
                  <input
                    value={editArticle}
                    onChange={(e) => setEditArticle(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Категория">
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Не выбрано</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Цвет">
                  <select
                    value={editColorId}
                    onChange={(e) => setEditColorId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Не выбрано</option>
                    {colors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Единица измерения">
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Выбери единицу</option>
                    {units.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.short_name})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Состав">
                  <input
                    value={editComposition}
                    onChange={(e) => setEditComposition(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Размер">
                  <input
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Поставщик">
                  <input
                    value={editSupplierName}
                    onChange={(e) => setEditSupplierName(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Цена по умолчанию">
                  <input
                    value={editDefaultPrice}
                    onChange={(e) => setEditDefaultPrice(e.target.value)}
                    type="number"
                    step="0.01"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Минимальный остаток">
                  <input
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
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
                    <option value="true">Активен</option>
                    <option value="false">Неактивен</option>
                  </select>
                </Field>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <label
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Комментарий
                  </label>

                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    style={{
                      ...inputStyle,
                      height: 90,
                      paddingTop: 10,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
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
                    style={{
                      ...primaryButtonStyle,
                      minWidth: 190,
                      background: updating ? "#a5b4fc" : "#4f46e5",
                    }}
                  >
                    {updating ? "Сохранение..." : "Сохранить изменения"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div onClick={() => setIsCreateOpen(false)} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Новый расходник</div>
                <div style={{ color: "#64748b", lineHeight: 1.5 }}>
                  Заполни карточку нового расходника и сохрани её в реестр.
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleAddItem}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <Field label="Название">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Пакет ПВД"
                  style={inputStyle}
                />
              </Field>

              <Field label="Артикул">
                <input
                  value={article}
                  onChange={(e) => setArticle(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>

              <Field label="Категория">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Не выбрано</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Цвет">
                <select
                  value={colorId}
                  onChange={(e) => setColorId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Не выбрано</option>
                  {colors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Единица измерения">
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выбери единицу</option>
                  {units.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.short_name})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Состав">
                <input
                  value={composition}
                  onChange={(e) => setComposition(e.target.value)}
                  placeholder="Например: ПВД"
                  style={inputStyle}
                />
              </Field>

              <Field label="Размер">
                <input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="Например: 25×35"
                  style={inputStyle}
                />
              </Field>

              <Field label="Поставщик">
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>

              <Field label="Цена по умолчанию">
                <input
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="Например: 2.5"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />
              </Field>

              <Field label="Минимальный остаток">
                <input
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="Например: 100"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />
              </Field>

              <Field label="Комментарий">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Необязательно"
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

              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...primaryButtonStyle,
                    minWidth: 200,
                    background: saving ? "#a5b4fc" : "#4f46e5",
                  }}
                >
                  {saving ? "Сохранение..." : "Сохранить расходник"}
                </button>
              </div>
            </form>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#0f172a",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fbff",
        border: "1px solid #dbe4f0",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#64748b",
          marginBottom: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 8,
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
  boxShadow: "0 8px 18px rgba(79, 70, 229, 0.18)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  color: "#1d4ed8",
  fontWeight: 700,
  fontSize: 14,
  textAlign: "left",
};

const headCellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  borderBottom: "1px solid #e5edf7",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #eef2f7",
  color: "#475569",
  fontSize: 14,
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 9999,
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