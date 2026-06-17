import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import ProductTechCardModal from "./ProductTechCardModal";

type ProductItem = {
  id: string;
  name: string;
  article: string | null;
  unit_id: string;
  category: string | null;
  gender: string | null;
  season: string | null;
  description: string | null;
  default_price: number | null;
  min_stock: number | null;
  comment: string | null;
  is_active: boolean;
  created_at: string | null;
};

type UnitItem = {
  id: string;
  name: string;
  short_name: string;
};

type ColumnFilterKey = "name" | "article" | "category" | "season" | "unit" | "activity";

type ColumnFilters = Record<ColumnFilterKey, string[]>;

const emptyColumnFilters: ColumnFilters = {
  name: [],
  article: [],
  category: [],
  season: [],
  unit: [],
  activity: [],
};

export default function ProductsDirectory() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [openColumnFilter, setOpenColumnFilter] =
    useState<ColumnFilterKey | null>(null);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFilters>(emptyColumnFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [viewProductId, setViewProductId] = useState<string | null>(null);
  const [techCardProduct, setTechCardProduct] = useState<ProductItem | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [name, setName] = useState("");
  const [article, setArticle] = useState("");
  const [unitId, setUnitId] = useState("");
  const [category, setCategory] = useState("");
  const [gender, setGender] = useState("");
  const [season, setSeason] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("");
  const [minStock, setMinStock] = useState("");
  const [comment, setComment] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [editName, setEditName] = useState("");
  const [editArticle, setEditArticle] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editSeason, setEditSeason] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDefaultPrice, setEditDefaultPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    await Promise.all([loadProducts(), loadUnits()]);
  }

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const safeProducts = (data as ProductItem[]) || [];
      setProducts(safeProducts);

      if (safeProducts.length > 0 && !selectedProductId) {
        setSelectedProductId(safeProducts[0].id);
      }

      if (
        selectedProductId &&
        !safeProducts.find((item) => item.id === selectedProductId)
      ) {
        setSelectedProductId(safeProducts[0]?.id || null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки изделий");
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
    setUnitId(units[0]?.id || "");
    setCategory("");
    setGender("");
    setSeason("");
    setDescription("");
    setDefaultPrice("");
    setMinStock("");
    setComment("");
    setIsActive(true);
  }

  function fillEditForm(product: ProductItem) {
    setEditName(product.name || "");
    setEditArticle(product.article || "");
    setEditUnitId(product.unit_id || "");
    setEditCategory(product.category || "");
    setEditGender(product.gender || "");
    setEditSeason(product.season || "");
    setEditDescription(product.description || "");
    setEditDefaultPrice(
      product.default_price !== null ? String(product.default_price) : ""
    );
    setEditMinStock(product.min_stock !== null ? String(product.min_stock) : "");
    setEditComment(product.comment || "");
    setEditIsActive(product.is_active);
  }

  function getUnitLabel(unitIdValue: string) {
    const unit = units.find((item) => item.id === unitIdValue);
    if (!unit) return "—";
    return `${unit.name} (${unit.short_name})`;
  }

  function openProductCard(product: ProductItem) {
    setSelectedProductId(product.id);
    setViewProductId(product.id);
    setIsEditMode(false);
    fillEditForm(product);
    setError("");
    setMessage("");
  }

  function closeProductCard() {
    setViewProductId(null);
    setIsEditMode(false);
  }

  function handleOpenTechCard(product: ProductItem) {
    setTechCardProduct(product);
  }

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Заполни название изделия");
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
        .from("products")
        .insert({
          name: name.trim(),
          article: article.trim() || null,
          unit_id: unitId,
          category: category.trim() || null,
          gender: gender.trim() || null,
          season: season.trim() || null,
          description: description.trim() || null,
          default_price: defaultPrice ? Number(defaultPrice) : null,
          min_stock: minStock ? Number(minStock) : null,
          comment: comment.trim() || null,
          is_active: isActive,
        })
        .select()
        .single();

      if (error) throw error;

      setMessage("Изделие добавлено.");
      resetForm();
      setIsCreateOpen(false);
      await loadProducts();

      if (data?.id) {
        setSelectedProductId(data.id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить изделие");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();

    if (!viewProductId) return;

    if (!editName.trim()) {
      setError("Заполни название изделия");
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
        .from("products")
        .update({
          name: editName.trim(),
          article: editArticle.trim() || null,
          unit_id: editUnitId,
          category: editCategory.trim() || null,
          gender: editGender.trim() || null,
          season: editSeason.trim() || null,
          description: editDescription.trim() || null,
          default_price: editDefaultPrice ? Number(editDefaultPrice) : null,
          min_stock: editMinStock ? Number(editMinStock) : null,
          comment: editComment.trim() || null,
          is_active: editIsActive,
        })
        .eq("id", viewProductId)
        .select()
        .single();

      if (error) throw error;

      const updatedProduct = data as ProductItem;

      setProducts((prev) =>
        prev.map((item) => (item.id === viewProductId ? updatedProduct : item))
      );

      fillEditForm(updatedProduct);
      setIsEditMode(false);
      setMessage("Карточка изделия обновлена.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить изделие");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteProduct(product: ProductItem) {
    const confirmed = window.confirm(`Удалить изделие "${product.name}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(product.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;

      const nextProducts = products.filter((item) => item.id !== product.id);
      setProducts(nextProducts);
      setMessage(`Изделие "${product.name}" удалено.`);

      if (selectedProductId === product.id) {
        setSelectedProductId(nextProducts[0]?.id || null);
      }

      if (viewProductId === product.id) {
        closeProductCard();
      }

      if (techCardProduct?.id === product.id) {
        setTechCardProduct(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить изделие");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMoveToResaleProduct(product: ProductItem) {
    const confirmed = window.confirm(
      [
        `Перенести изделие "${product.name}" в товары на перепродажу?`,
        "",
        "Будет создана или обновлена карточка товара на перепродажу.",
        "Старое изделие останется в базе, но станет неактивным.",
        "",
        "Дубли по артикулу создаваться не будут.",
      ].join("\n"),
    );

    if (!confirmed) return;

    try {
      setMovingId(product.id);
      setError("");
      setMessage("");

      const itemPayload = {
        item_type: "resale_product",
        name: product.name.trim(),
        article: product.article || null,
        unit_id: product.unit_id,
        default_price: product.default_price,
        min_stock: product.min_stock,
        is_active: true,
        source_table: "products",
        source_id: product.id,
      };

      const { data: sourceItems, error: sourceError } = await supabase
        .from("items")
        .select("id, item_type, is_active, name, article")
        .eq("source_table", "products")
        .eq("source_id", product.id)
        .limit(1);

      if (sourceError) throw sourceError;

      let targetItem = sourceItems?.[0] || null;
      let targetWasFoundByArticle = false;

      if (!targetItem && product.article) {
        const { data: articleItems, error: articleError } = await supabase
          .from("items")
          .select("id, item_type, is_active, name, article")
          .eq("item_type", "resale_product")
          .eq("article", product.article)
          .limit(1);

        if (articleError) throw articleError;

        targetItem = articleItems?.[0] || null;
        targetWasFoundByArticle = Boolean(targetItem);
      }

      if (targetItem?.id) {
        const confirmUpdateText = targetWasFoundByArticle
          ? [
              `В товарах на перепродажу уже есть товар с артикулом "${product.article}".`,
              "",
              `Существующий товар: "${targetItem.name}"`,
              `Изделие: "${product.name}"`,
              "",
              "Дубль создан не будет.",
              "Обновить существующий товар и отключить изделие?",
            ].join("\n")
          : [
              `Товар на перепродажу для "${product.name}" уже существует.`,
              "",
              "Обновить существующую карточку и отключить изделие?",
            ].join("\n");

        const shouldUpdateExisting = window.confirm(confirmUpdateText);

        if (!shouldUpdateExisting) {
          setMessage("Перенос отменён. Дубль не создан.");
          return;
        }

        const { error: itemUpdateError } = await supabase
          .from("items")
          .update(itemPayload)
          .eq("id", targetItem.id);

        if (itemUpdateError) throw itemUpdateError;
      } else {
        const { error: itemInsertError } = await supabase
          .from("items")
          .insert(itemPayload);

        if (itemInsertError) throw itemInsertError;
      }

      const { data: updatedProduct, error: productError } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", product.id)
        .select()
        .single();

      if (productError) throw productError;

      const safeUpdatedProduct = updatedProduct as ProductItem;

      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? safeUpdatedProduct : item)),
      );

      fillEditForm(safeUpdatedProduct);
      setSelectedProductId(product.id);
      setMessage(
        targetItem?.id
          ? `Существующая карточка товара на перепродажу для "${product.name}" обновлена. Дубль не создан. Изделие отключено.`
          : `Изделие "${product.name}" перенесено в товары на перепродажу.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось перенести изделие в товары на перепродажу",
      );
    } finally {
      setMovingId(null);
    }
  }

  function getProductColumnValue(
    product: ProductItem,
    key: ColumnFilterKey,
  ) {
    if (key === "name") return product.name || "—";
    if (key === "article") return product.article || "—";
    if (key === "category") return product.category || "—";
    if (key === "season") return product.season || "—";
    if (key === "unit") return getUnitLabel(product.unit_id);
    if (key === "activity") return product.is_active ? "Активен" : "Неактивен";

    return "—";
  }

  function getColumnFilterOptions(key: ColumnFilterKey) {
    const values = products.map((product) => getProductColumnValue(product, key));
    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b, "ru"),
    );
  }

  function toggleColumnFilterValue(key: ColumnFilterKey, value: string) {
    setColumnFilters((prev) => {
      const currentValues = prev[key];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...prev,
        [key]: nextValues,
      };
    });
  }

  function clearColumnFilter(key: ColumnFilterKey) {
    setColumnFilters((prev) => ({
      ...prev,
      [key]: [],
    }));
  }

  function clearAllColumnFilters() {
    setColumnFilters(emptyColumnFilters);
    setOpenColumnFilter(null);
  }

  function isColumnFilterActive(key: ColumnFilterKey) {
    return columnFilters[key].length > 0;
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (showOnlyActive && !product.is_active) {
        return false;
      }

      const matchesColumnFilters = (
        Object.keys(columnFilters) as ColumnFilterKey[]
      ).every((key) => {
        const selectedValues = columnFilters[key];

        if (selectedValues.length === 0) {
          return true;
        }

        return selectedValues.includes(getProductColumnValue(product, key));
      });

      if (!matchesColumnFilters) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        product.name.toLowerCase().includes(query) ||
        (product.article || "").toLowerCase().includes(query) ||
        (product.category || "").toLowerCase().includes(query) ||
        (product.gender || "").toLowerCase().includes(query) ||
        (product.season || "").toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query) ||
        (product.comment || "").toLowerCase().includes(query) ||
        getUnitLabel(product.unit_id).toLowerCase().includes(query)
      );
    });
  }, [products, search, units, showOnlyActive, columnFilters]);

  const viewProduct =
    products.find((item) => item.id === viewProductId) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={sectionStyle}>
        <div style={pageTitleStyle}>Изделия</div>

        <div style={{ color: "#64748b", lineHeight: 1.6 }}>
          Здесь хранится общий реестр производимых изделий.
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
              Добавить новое изделие
            </button>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по изделиям"
              style={{
                ...inputStyle,
                width: 280,
                maxWidth: "100%",
              }}
            />

            {(Object.keys(columnFilters) as ColumnFilterKey[]).some(
              (key) => columnFilters[key].length > 0,
            ) && (
              <button
                type="button"
                onClick={clearAllColumnFilters}
                style={secondaryButtonStyle}
              >
                Сбросить фильтры
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span>Только активные</span>
              <button
                type="button"
                onClick={() => setShowOnlyActive((prev) => !prev)}
                aria-pressed={showOnlyActive}
                style={{
                  width: 50,
                  height: 28,
                  border: "none",
                  borderRadius: 999,
                  background: showOnlyActive ? "#22c55e" : "#cbd5e1",
                  padding: 3,
                  cursor: "pointer",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "#ffffff",
                    transform: showOnlyActive
                      ? "translateX(22px)"
                      : "translateX(0)",
                    transition: "transform 0.2s ease",
                    boxShadow: "0 2px 5px rgba(15, 23, 42, 0.25)",
                  }}
                />
              </button>
            </label>

            <button onClick={loadAll} style={secondaryButtonStyle}>
              Обновить
            </button>
          </div>
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
          Реестр изделий
        </div>

        {loading && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Загрузка изделий...
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div style={{ padding: 18, color: "#64748b" }}>
            Изделия не найдены
          </div>
        )}

        {!loading && filteredProducts.length > 0 && (
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
                  <FilterableHeadCell
                    title="Название"
                    filterKey="name"
                    options={getColumnFilterOptions("name")}
                    selectedValues={columnFilters.name}
                    isOpen={openColumnFilter === "name"}
                    isActive={isColumnFilterActive("name")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "name" ? null : "name",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("name", value)
                    }
                    onClear={() => clearColumnFilter("name")}
                  />

                  <FilterableHeadCell
                    title="Артикул"
                    filterKey="article"
                    options={getColumnFilterOptions("article")}
                    selectedValues={columnFilters.article}
                    isOpen={openColumnFilter === "article"}
                    isActive={isColumnFilterActive("article")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "article" ? null : "article",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("article", value)
                    }
                    onClear={() => clearColumnFilter("article")}
                  />

                  <FilterableHeadCell
                    title="Категория"
                    filterKey="category"
                    options={getColumnFilterOptions("category")}
                    selectedValues={columnFilters.category}
                    isOpen={openColumnFilter === "category"}
                    isActive={isColumnFilterActive("category")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "category" ? null : "category",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("category", value)
                    }
                    onClear={() => clearColumnFilter("category")}
                  />

                  <FilterableHeadCell
                    title="Сезон"
                    filterKey="season"
                    options={getColumnFilterOptions("season")}
                    selectedValues={columnFilters.season}
                    isOpen={openColumnFilter === "season"}
                    isActive={isColumnFilterActive("season")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "season" ? null : "season",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("season", value)
                    }
                    onClear={() => clearColumnFilter("season")}
                  />

                  <FilterableHeadCell
                    title="Ед. изм."
                    filterKey="unit"
                    options={getColumnFilterOptions("unit")}
                    selectedValues={columnFilters.unit}
                    isOpen={openColumnFilter === "unit"}
                    isActive={isColumnFilterActive("unit")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "unit" ? null : "unit",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("unit", value)
                    }
                    onClear={() => clearColumnFilter("unit")}
                  />

                  <FilterableHeadCell
                    title="Активность"
                    filterKey="activity"
                    options={getColumnFilterOptions("activity")}
                    selectedValues={columnFilters.activity}
                    isOpen={openColumnFilter === "activity"}
                    isActive={isColumnFilterActive("activity")}
                    onToggleOpen={() =>
                      setOpenColumnFilter((prev) =>
                        prev === "activity" ? null : "activity",
                      )
                    }
                    onToggleValue={(value) =>
                      toggleColumnFilterValue("activity", value)
                    }
                    onClear={() => clearColumnFilter("activity")}
                  />

                  <th style={headCellStyle}>Действия</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const isSelected = selectedProductId === product.id;
                  const isDeleting = deletingId === product.id;

                  return (
                    <tr
                      key={product.id}
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
                          onClick={() => openProductCard(product)}
                          style={linkButtonStyle}
                        >
                          {product.name}
                        </button>
                      </td>

                      <td style={cellStyle}>{product.article || "—"}</td>
                      <td style={cellStyle}>{product.category || "—"}</td>
                      <td style={cellStyle}>{product.season || "—"}</td>
                      <td style={cellStyle}>{getUnitLabel(product.unit_id)}</td>
                      <td style={cellStyle}>
                        <span
                          style={{
                            color: product.is_active ? "#166534" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
                          {product.is_active ? "Активен" : "Неактивен"}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <button
                          onClick={() => handleDeleteProduct(product)}
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

      {viewProduct && (
        <div onClick={closeProductCard} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Карточка изделия</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {viewProduct.name}
                </div>
              </div>

              <button onClick={closeProductCard} style={closeButtonStyle}>
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
                  <Info label="Название" value={viewProduct.name} />
                  <Info label="Артикул" value={viewProduct.article || "—"} />
                  <Info
                    label="Единица измерения"
                    value={getUnitLabel(viewProduct.unit_id)}
                  />
                  <Info label="Категория" value={viewProduct.category || "—"} />
                  <Info
                    label="Пол / назначение"
                    value={viewProduct.gender || "—"}
                  />
                  <Info label="Сезон" value={viewProduct.season || "—"} />
                  <Info
                    label="Цена по умолчанию"
                    value={
                      viewProduct.default_price !== null
                        ? String(viewProduct.default_price)
                        : "—"
                    }
                  />
                  <Info
                    label="Минимальный остаток"
                    value={
                      viewProduct.min_stock !== null
                        ? String(viewProduct.min_stock)
                        : "—"
                    }
                  />
                  <Info
                    label="Активность"
                    value={viewProduct.is_active ? "Активен" : "Неактивен"}
                  />
                </div>

                <TextBlock label="Описание" value={viewProduct.description || "—"} />
                <TextBlock label="Комментарий" value={viewProduct.comment || "—"} />

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
                    onClick={() => handleOpenTechCard(viewProduct)}
                    style={{
                      ...secondaryButtonStyle,
                      borderColor: "#4f46e5",
                      color: "#4338ca",
                    }}
                  >
                    Техкарта изделия
                  </button>

                  <button
                    onClick={() => handleMoveToResaleProduct(viewProduct)}
                    disabled={movingId === viewProduct.id}
                    style={{
                      ...secondaryButtonStyle,
                      borderColor: "#f59e0b",
                      color: "#92400e",
                      background: movingId === viewProduct.id ? "#fef3c7" : "#fff",
                      cursor: movingId === viewProduct.id ? "default" : "pointer",
                    }}
                  >
                    {movingId === viewProduct.id
                      ? "Перенос..."
                      : "Перенести в товары на перепродажу"}
                  </button>

                  <button
                    onClick={() => {
                      fillEditForm(viewProduct);
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
                onSubmit={handleUpdateProduct}
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

                <Field label="Категория">
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Например: Шапки"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Пол / назначение">
                  <input
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value)}
                    placeholder="Например: Унисекс"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Сезон">
                  <input
                    value={editSeason}
                    onChange={(e) => setEditSeason(e.target.value)}
                    placeholder="Например: Осень/весна"
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

                <div style={wideFieldStyle}>
                  <label style={labelStyle}>Описание</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    style={{
                      ...inputStyle,
                      height: 90,
                      paddingTop: 10,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={wideFieldStyle}>
                  <label style={labelStyle}>Комментарий</label>
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
                      fillEditForm(viewProduct);
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
                <div style={modalTitleStyle}>Новое изделие</div>
                <div style={{ color: "#64748b", lineHeight: 1.5 }}>
                  Заполни карточку нового изделия и сохрани её в реестр.
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
              onSubmit={handleAddProduct}
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
                  placeholder="Например: Шапка бини"
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

              <Field label="Категория">
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Например: Шапки"
                  style={inputStyle}
                />
              </Field>

              <Field label="Пол / назначение">
                <input
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="Например: Унисекс"
                  style={inputStyle}
                />
              </Field>

              <Field label="Сезон">
                <input
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="Например: Осень/весна"
                  style={inputStyle}
                />
              </Field>

              <Field label="Цена по умолчанию">
                <input
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                  placeholder="Например: 590"
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

              <div style={wideFieldStyle}>
                <label style={labelStyle}>Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание изделия"
                  style={{
                    ...inputStyle,
                    height: 90,
                    paddingTop: 10,
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={wideFieldStyle}>
                <label style={labelStyle}>Комментарий</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Необязательно"
                  style={{
                    ...inputStyle,
                    height: 90,
                    paddingTop: 10,
                    resize: "vertical",
                  }}
                />
              </div>

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
                  {saving ? "Сохранение..." : "Сохранить изделие"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {techCardProduct && (
        <ProductTechCardModal
          product={{
            id: techCardProduct.id,
            name: techCardProduct.name,
            article: techCardProduct.article,
          }}
          onClose={() => setTechCardProduct(null)}
        />
      )}
    </div>
  );
}


function FilterableHeadCell({
  title,
  options,
  selectedValues,
  isOpen,
  isActive,
  onToggleOpen,
  onToggleValue,
  onClear,
}: {
  title: string;
  filterKey: ColumnFilterKey;
  options: string[];
  selectedValues: string[];
  isOpen: boolean;
  isActive: boolean;
  onToggleOpen: () => void;
  onToggleValue: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <th style={{ ...headCellStyle, position: "relative", overflow: "visible" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span>{title}</span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          title="Фильтр"
          style={{
            width: 24,
            height: 24,
            border: isActive ? "1px solid #4f46e5" : "1px solid transparent",
            borderRadius: 8,
            background: isActive ? "#eef2ff" : "transparent",
            color: isActive ? "#4f46e5" : "#64748b",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ▼
        </button>
      </div>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 100,
            width: 520,
            minWidth: 420,
            maxWidth: "90vw",
            minHeight: 220,
            maxHeight: 420,
            overflow: "auto",
            resize: "both",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: 14,
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
            padding: 12,
            boxSizing: "border-box",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ color: "#0f172a", fontWeight: 800 }}>
              {title}
            </div>

            <button
              type="button"
              onClick={onClear}
              style={{
                border: "none",
                background: "transparent",
                color: "#2563eb",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              Сбросить
            </button>
          </div>

          <div
            style={{
              color: "#64748b",
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 8,
              lineHeight: 1.4,
            }}
          >
            Можно потянуть за правый нижний угол, чтобы расширить окно.
          </div>

          {options.length === 0 ? (
            <div style={{ color: "#64748b", padding: 8 }}>
              Нет значений
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {options.map((option) => {
                const checked = selectedValues.includes(option);

                return (
                  <label
                    key={option}
                    title={option}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px minmax(0, 1fr)",
                      alignItems: "start",
                      columnGap: 10,
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: checked ? "#eef2ff" : "#ffffff",
                      color: "#0f172a",
                      cursor: "pointer",
                      fontWeight: 600,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleValue(option)}
                      style={{
                        margin: 0,
                        marginTop: 2,
                        justifySelf: "start",
                        width: 16,
                        height: 16,
                      }}
                    />

                    <span
                      style={{
                        display: "block",
                        minWidth: 0,
                        color: "#0f172a",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        lineHeight: 1.35,
                        textAlign: "left",
                      }}
                    >
                      {option}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </th>
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
      <label style={labelStyle}>{label}</label>
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

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
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
      <span style={{ fontWeight: 700, color: "#0f172a" }}>{label}:</span>{" "}
      {value}
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

const wideFieldStyle: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  flexDirection: "column",
  gap: 6,
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