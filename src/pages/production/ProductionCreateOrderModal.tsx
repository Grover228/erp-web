import { useMemo, useState } from "react";
import type { ProductItem, TechCardItem } from "../../Production";

type ProductionCreateOrderModalProps = {
  products: ProductItem[];
  techCards: TechCardItem[];
  selectedProductId: string;
  quantity: string;
  comment: string;
  creating: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onProductChange: (productId: string) => void;
  onQuantityChange: (value: string) => void;
  onCommentChange: (value: string) => void;
};

export default function ProductionCreateOrderModal({
  products,
  techCards,
  selectedProductId,
  quantity,
  comment,
  creating,
  onClose,
  onSubmit,
  onProductChange,
  onQuantityChange,
  onCommentChange,
}: ProductionCreateOrderModalProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const activeTechCardProductIds = useMemo(() => {
    return new Set(
      techCards
        .filter((card) => card.is_active)
        .map((card) => card.product_id),
    );
  }, [techCards]);

  const productsWithActiveTechCards = useMemo(() => {
    return products.filter((product) => activeTechCardProductIds.has(product.id));
  }, [products, activeTechCardProductIds]);

  const productCategories = useMemo(() => {
    const categories = new Set<string>();

    productsWithActiveTechCards.forEach((product) => {
      const name = product.name.trim();
      const firstWord = name.split(/\\s+/)[0];
      if (firstWord) categories.add(firstWord);
    });

    return Array.from(categories).sort((a, b) => a.localeCompare(b, "ru"));
  }, [productsWithActiveTechCards]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return productsWithActiveTechCards.filter((product) => {
      const matchesCategory =
        categoryFilter === "all" ||
        product.name.toLowerCase().startsWith(categoryFilter.toLowerCase());

      if (!matchesCategory) return false;
      if (!query) return true;

      return [product.name, product.article || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [productsWithActiveTechCards, search, categoryFilter]);

  const selectedProduct =
    productsWithActiveTechCards.find((item) => item.id === selectedProductId) ||
    null;

  const selectedTechCard =
    techCards.find(
      (item) => item.product_id === selectedProductId && item.is_active,
    ) || null;

  const visibleProducts = filteredProducts.slice(0, 12);


  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Создать производственное задание</div>
            <div style={{ marginTop: 4, color: "#64748b" }}>
              Выбери изделие с активной техкартой и укажи количество.
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14 }}>
          <Field label="Изделие">
            <div style={{ position: "relative" }}>
              <span style={searchIconStyle}>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название, артикул, цвет или размер..."
                autoFocus
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingLeft: 38 }}
              />
            </div>
          </Field>

          {productCategories.length > 1 && (
            <div style={categoryRowStyle}>
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                style={categoryButtonStyle(categoryFilter === "all")}
              >
                Все
              </button>
              {productCategories.slice(0, 7).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  style={categoryButtonStyle(categoryFilter === category)}
                >
                  {category}
                </button>
              ))}
            </div>
          )}

          <div style={productListStyle}>
            <div style={productListHeaderStyle}>
              <span>Изделия с активной техкартой</span>
              <span>{filteredProducts.length}</span>
            </div>

            {visibleProducts.length === 0 ? (
              <div style={emptyProductStyle}>
                По этому запросу изделий с активной техкартой не найдено.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {visibleProducts.map((product) => {
                  const active = product.id === selectedProductId;
                  const techCard =
                    techCards.find(
                      (card) => card.product_id === product.id && card.is_active,
                    ) || null;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onProductChange(product.id)}
                      style={productRowStyle(active)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={productNameStyle}>{product.name}</div>
                        <div style={productMetaStyle}>
                          {product.article || "Без артикула"}
                          {techCard ? ` · ${techCard.name}` : ""}
                        </div>
                      </div>
                      <div style={active ? selectedMarkStyle : chooseMarkStyle}>
                        {active ? "✓ Выбрано" : "Выбрать"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > visibleProducts.length && (
              <div style={moreHintStyle}>
                Показаны первые {visibleProducts.length}. Уточни поиск, чтобы быстрее найти изделие.
              </div>
            )}
          </div>

          {selectedProduct && (
            <div style={selectedProductStyle}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                  Выбрано
                </div>
                <div style={{ marginTop: 3, fontWeight: 850, color: "#0f172a" }}>
                  {selectedProduct.name}
                </div>
                <div style={{ marginTop: 3, color: "#64748b", fontSize: 13 }}>
                  {selectedProduct.article || "Без артикула"}
                </div>
              </div>
              <div style={techCardBadgeStyle}>
                ✓ {selectedTechCard ? selectedTechCard.name : "Активная техкарта"}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 0.7fr) minmax(240px, 1.3fr)",
              gap: 12,
            }}
          >
            <Field label="Количество изделий">
              <input
                value={quantity}
                onChange={(event) => onQuantityChange(event.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="Например: 50"
                style={inputStyle}
              />
            </Field>

            <Field label="Комментарий">
              <input
                value={comment}
                onChange={(event) => onCommentChange(event.target.value)}
                placeholder="Необязательно"
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={footerStyle}>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              Показаны только изделия с активной техкартой: {productsWithActiveTechCards.length}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={onClose} style={secondaryBlueButtonStyle()}>
                Отмена
              </button>

              <button
                type="submit"
                disabled={creating || !selectedProductId || !quantity}
                style={{
                  ...primaryBlueButtonStyle,
                  opacity: creating || !selectedProductId || !quantity ? 0.55 : 1,
                  cursor: creating || !selectedProductId || !quantity ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Создание..." : "Создать задание"}
              </button>
            </div>
          </div>
        </form>
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
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function secondaryBlueButtonStyle(): React.CSSProperties {
  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

const primaryBlueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 760,
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbeafe",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  padding: 20,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 16,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#111827",
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

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: 13,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#94a3b8",
  pointerEvents: "none",
};

const categoryRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

function categoryButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe3ef",
    borderRadius: 999,
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    padding: "7px 11px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 750,
  };
}

const productListStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 14,
  background: "#f8fbff",
  padding: 10,
  maxHeight: 330,
  overflowY: "auto",
};

const productListHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#64748b",
  fontSize: 12,
  fontWeight: 750,
  padding: "2px 3px 8px",
};

function productRowStyle(active: boolean): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    border: active ? "1px solid #60a5fa" : "1px solid #e2e8f0",
    borderRadius: 11,
    background: active ? "#eff6ff" : "#ffffff",
    padding: "10px 12px",
    cursor: "pointer",
    boxShadow: active ? "0 0 0 2px rgba(96, 165, 250, 0.10)" : "none",
  };
}

const productNameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const productMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chooseMarkStyle: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const selectedMarkStyle: React.CSSProperties = {
  color: "#15803d",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const emptyProductStyle: React.CSSProperties = {
  padding: 18,
  textAlign: "center",
  color: "#64748b",
  fontSize: 13,
};

const moreHintStyle: React.CSSProperties = {
  padding: "9px 4px 2px",
  color: "#64748b",
  fontSize: 12,
};

const selectedProductStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: 12,
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  background: "#f0fdf4",
};

const techCardBadgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: "7px 10px",
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};

const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  borderTop: "1px solid #e2e8f0",
  paddingTop: 14,
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

const hintStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 13,
};
