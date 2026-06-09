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

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return productsWithActiveTechCards;

    return productsWithActiveTechCards.filter((product) =>
      [product.name, product.article || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [productsWithActiveTechCards, search]);

  const selectedProduct =
    productsWithActiveTechCards.find((item) => item.id === selectedProductId) ||
    null;

  const selectedTechCard =
    techCards.find(
      (item) => item.product_id === selectedProductId && item.is_active,
    ) || null;

  function selectOnlyFoundProduct() {
    if (filteredProducts.length === 1) {
      onProductChange(filteredProducts[0].id);
    }
  }

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

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <Field label="Поиск изделия">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    selectOnlyFoundProduct();
                  }
                }}
                placeholder="Название или артикул"
                style={{ ...inputStyle, flex: 1 }}
              />

              <button
                type="button"
                onClick={selectOnlyFoundProduct}
                style={secondaryBlueButtonStyle()}
              >
                Найти
              </button>
            </div>
          </Field>

          <Field label="Изделие с активной техкартой">
            <select
              value={selectedProductId}
              onChange={(event) => onProductChange(event.target.value)}
              style={inputStyle}
            >
              <option value="">
                {filteredProducts.length === 0
                  ? "Ничего не найдено"
                  : "Выбери изделие"}
              </option>

              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.article
                    ? `${product.name} · ${product.article}`
                    : product.name}
                </option>
              ))}
            </select>

            <div style={hintStyle}>
              Показаны только изделия с активной техкартой:{" "}
              {filteredProducts.length} из {productsWithActiveTechCards.length}
            </div>
          </Field>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #dbeafe",
              background: selectedTechCard ? "#f0fdf4" : "#fef2f2",
              color: selectedTechCard ? "#166534" : "#991b1b",
              fontWeight: 700,
            }}
          >
            {selectedProduct
              ? selectedTechCard
                ? `Активная техкарта найдена: ${selectedTechCard.name}`
                : "У этого изделия нет активной техкарты"
              : "Сначала выбери изделие"}
          </div>

          <Field label="Количество изделий">
            <input
              value={quantity}
              onChange={(event) => onQuantityChange(event.target.value)}
              type="number"
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={onClose} style={secondaryBlueButtonStyle()}>
              Отмена
            </button>

            <button
              type="submit"
              disabled={creating}
              style={{
                ...primaryBlueButtonStyle,
                opacity: creating ? 0.7 : 1,
                cursor: creating ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Создание..." : "Создать задание"}
            </button>
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
  maxWidth: 620,
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
