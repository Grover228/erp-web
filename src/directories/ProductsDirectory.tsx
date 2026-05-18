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

export default function ProductsDirectory() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
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

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter((product) => {
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
  }, [products, search, units]);

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
                  {[
                    "Название",
                    "Артикул",
                    "Категория",
                    "Сезон",
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