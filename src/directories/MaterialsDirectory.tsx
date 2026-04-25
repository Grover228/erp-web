import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type MaterialItem = {
  id: string;
  name: string;
  article: string | null;
  category_id: string | null;
  color_id: string | null;
  unit_id: string;
  composition: string | null;
  width_cm: number | null;
  density_gsm: number | null;
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

export default function MaterialsDirectory() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
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
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [viewMaterialId, setViewMaterialId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [colorId, setColorId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [composition, setComposition] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [densityGsm, setDensityGsm] = useState("");
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
  const [editWidthCm, setEditWidthCm] = useState("");
  const [editDensityGsm, setEditDensityGsm] = useState("");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([
      loadMaterials(),
      loadCategories(),
      loadColors(),
      loadUnits(),
    ]);
  }

  async function loadMaterials() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const safeMaterials = (data as MaterialItem[]) || [];
      setMaterials(safeMaterials);

      if (safeMaterials.length > 0 && !selectedMaterialId) {
        setSelectedMaterialId(safeMaterials[0].id);
      }

      if (
        selectedMaterialId &&
        !safeMaterials.find((item) => item.id === selectedMaterialId)
      ) {
        setSelectedMaterialId(safeMaterials[0]?.id || null);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки материалов"
      );
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
    setWidthCm("");
    setDensityGsm("");
    setSupplierName("");
    setDefaultPrice("");
    setMinStock("");
    setComment("");
    setIsActive(true);
  }

  function fillEditForm(material: MaterialItem) {
    setEditName(material.name || "");
    setEditArticle(material.article || "");
    setEditCategoryId(material.category_id || "");
    setEditColorId(material.color_id || "");
    setEditUnitId(material.unit_id || "");
    setEditComposition(material.composition || "");
    setEditWidthCm(material.width_cm !== null ? String(material.width_cm) : "");
    setEditDensityGsm(
      material.density_gsm !== null ? String(material.density_gsm) : ""
    );
    setEditSupplierName(material.supplier_name || "");
    setEditDefaultPrice(
      material.default_price !== null ? String(material.default_price) : ""
    );
    setEditMinStock(material.min_stock !== null ? String(material.min_stock) : "");
    setEditComment(material.comment || "");
    setEditIsActive(material.is_active);
  }

  function openMaterialCard(material: MaterialItem) {
    setSelectedMaterialId(material.id);
    setViewMaterialId(material.id);
    setIsEditMode(false);
    fillEditForm(material);
    setError("");
    setMessage("");
  }

  function closeMaterialCard() {
    setViewMaterialId(null);
    setIsEditMode(false);
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Заполни название материала");
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
        .from("materials")
        .insert({
          name: name.trim(),
          article: article.trim() || null,
          category_id: categoryId || null,
          color_id: colorId || null,
          unit_id: unitId,
          composition: composition.trim() || null,
          width_cm: widthCm ? Number(widthCm) : null,
          density_gsm: densityGsm ? Number(densityGsm) : null,
          supplier_name: supplierName.trim() || null,
          default_price: defaultPrice ? Number(defaultPrice) : null,
          min_stock: minStock ? Number(minStock) : null,
          comment: comment.trim() || null,
          is_active: isActive,
        })
        .select()
        .single();

      if (error) throw error;

      setMessage("Материал добавлен.");
      resetForm();
      setIsCreateOpen(false);
      await loadMaterials();

      if (data?.id) {
        setSelectedMaterialId(data.id);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось добавить материал"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateMaterial(e: React.FormEvent) {
    e.preventDefault();

    if (!viewMaterialId) return;

    if (!editName.trim()) {
      setError("Заполни название материала");
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
        .from("materials")
        .update({
          name: editName.trim(),
          article: editArticle.trim() || null,
          category_id: editCategoryId || null,
          color_id: editColorId || null,
          unit_id: editUnitId,
          composition: editComposition.trim() || null,
          width_cm: editWidthCm ? Number(editWidthCm) : null,
          density_gsm: editDensityGsm ? Number(editDensityGsm) : null,
          supplier_name: editSupplierName.trim() || null,
          default_price: editDefaultPrice ? Number(editDefaultPrice) : null,
          min_stock: editMinStock ? Number(editMinStock) : null,
          comment: editComment.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", viewMaterialId)
        .select()
        .single();

      if (error) throw error;

      const updatedMaterial = data as MaterialItem;

      setMaterials((prev) =>
        prev.map((item) => (item.id === viewMaterialId ? updatedMaterial : item))
      );

      fillEditForm(updatedMaterial);
      setIsEditMode(false);
      setMessage("Карточка материала обновлена.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось обновить материал"
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteMaterial(material: MaterialItem) {
    const confirmed = window.confirm(`Удалить материал "${material.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(material.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("materials")
        .delete()
        .eq("id", material.id);

      if (error) throw error;

      const nextMaterials = materials.filter((item) => item.id !== material.id);
      setMaterials(nextMaterials);
      setMessage(`Материал "${material.name}" удалён.`);

      if (selectedMaterialId === material.id) {
        setSelectedMaterialId(nextMaterials[0]?.id || null);
      }

      if (viewMaterialId === material.id) {
        closeMaterialCard();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось удалить материал"
      );
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

  const filteredMaterials = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return materials;

    return materials.filter((material) => {
      const categoryName = getCategoryName(material.category_id);
      const colorName = getColorName(material.color_id);
      const unitName = getUnitLabel(material.unit_id);

      return (
        material.name.toLowerCase().includes(query) ||
        (material.article || "").toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query) ||
        colorName.toLowerCase().includes(query) ||
        unitName.toLowerCase().includes(query) ||
        (material.composition || "").toLowerCase().includes(query) ||
        (material.supplier_name || "").toLowerCase().includes(query) ||
        (material.comment || "").toLowerCase().includes(query)
      );
    });
  }, [materials, search, categories, colors, units]);

  const viewMaterial =
    materials.find((item) => item.id === viewMaterialId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={sectionStyle}>
        <div style={pageTitleStyle}>Материалы</div>

        <div style={{ color: "#64748b", lineHeight: 1.6 }}>
          Здесь хранится общий реестр тканей, ниток, фурнитуры, упаковки и
          других материалов, используемых в производстве.
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
              Добавить новый материал
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по материалам"
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
          Реестр материалов
        </div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка материалов...
          </div>
        )}

        {!loading && filteredMaterials.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Материалы не найдены
          </div>
        )}

        {!loading && filteredMaterials.length > 0 && (
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
                {filteredMaterials.map((material) => {
                  const isSelected = selectedMaterialId === material.id;
                  const isDeleting = deletingId === material.id;

                  return (
                    <tr
                      key={material.id}
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
                          onClick={() => openMaterialCard(material)}
                          style={linkButtonStyle}
                        >
                          {material.name}
                        </button>
                      </td>

                      <td style={cellStyle}>{material.article || "—"}</td>
                      <td style={cellStyle}>
                        {getCategoryName(material.category_id)}
                      </td>
                      <td style={cellStyle}>
                        {getColorName(material.color_id)}
                      </td>
                      <td style={cellStyle}>{getUnitLabel(material.unit_id)}</td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            color: material.is_active ? "#166534" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
                          {material.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <button
                          onClick={() => handleDeleteMaterial(material)}
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

      {viewMaterial && (
        <div onClick={closeMaterialCard} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка материала</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {viewMaterial.name}
                </div>
              </div>

              <button onClick={closeMaterialCard} style={closeButtonStyle}>
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
                  <Info label="Название" value={viewMaterial.name} />
                  <Info label="Артикул" value={viewMaterial.article || "—"} />
                  <Info
                    label="Категория"
                    value={getCategoryName(viewMaterial.category_id)}
                  />
                  <Info label="Цвет" value={getColorName(viewMaterial.color_id)} />
                  <Info
                    label="Единица измерения"
                    value={getUnitLabel(viewMaterial.unit_id)}
                  />
                  <Info label="Состав" value={viewMaterial.composition || "—"} />
                  <Info
                    label="Ширина, см"
                    value={
                      viewMaterial.width_cm !== null
                        ? String(viewMaterial.width_cm)
                        : "—"
                    }
                  />
                  <Info
                    label="Плотность, г/м²"
                    value={
                      viewMaterial.density_gsm !== null
                        ? String(viewMaterial.density_gsm)
                        : "—"
                    }
                  />
                  <Info
                    label="Поставщик"
                    value={viewMaterial.supplier_name || "—"}
                  />
                  <Info
                    label="Цена по умолчанию"
                    value={
                      viewMaterial.default_price !== null
                        ? String(viewMaterial.default_price)
                        : "—"
                    }
                  />
                  <Info
                    label="Минимальный остаток"
                    value={
                      viewMaterial.min_stock !== null
                        ? String(viewMaterial.min_stock)
                        : "—"
                    }
                  />
                  <Info
                    label="Активность"
                    value={viewMaterial.is_active ? "Активен" : "Неактивен"}
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
                  {viewMaterial.comment || "—"}
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
                      fillEditForm(viewMaterial);
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
                onSubmit={handleUpdateMaterial}
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

                <Field label="Ширина, см">
                  <input
                    value={editWidthCm}
                    onChange={(e) => setEditWidthCm(e.target.value)}
                    type="number"
                    step="0.01"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Плотность, г/м²">
                  <input
                    value={editDensityGsm}
                    onChange={(e) => setEditDensityGsm(e.target.value)}
                    type="number"
                    step="0.01"
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
                      fillEditForm(viewMaterial);
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
                <div style={modalTitleStyle}>Новый материал</div>
                <div style={{ color: "#64748b", lineHeight: 1.5 }}>
                  Заполни карточку нового материала и сохрани её в реестр.
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
              onSubmit={handleAddMaterial}
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
                  placeholder="Например: Кулирка 180"
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
                  placeholder="Например: 100% хлопок"
                  style={inputStyle}
                />
              </Field>

              <Field label="Ширина, см">
                <input
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="Например: 180"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />
              </Field>

              <Field label="Плотность, г/м²">
                <input
                  value={densityGsm}
                  onChange={(e) => setDensityGsm(e.target.value)}
                  placeholder="Например: 180"
                  type="number"
                  step="0.01"
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
                  placeholder="Например: 320"
                  type="number"
                  step="0.01"
                  style={inputStyle}
                />
              </Field>

              <Field label="Минимальный остаток">
                <input
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  placeholder="Например: 10"
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
                  {saving ? "Сохранение..." : "Сохранить материал"}
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