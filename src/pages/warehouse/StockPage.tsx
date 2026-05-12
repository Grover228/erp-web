import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import StockItemModal from "./StockItemModal";

type PurchaseItemType = "material" | "consumable";
type StockTab = "all" | "material" | "consumable";

type ReceiptStatus = {
  code: string | null;
  name: string | null;
  color: string | null;
};

type ReceiptForStock = {
  id: string;
  receipt_number: string | null;
  receipt_date: string | null;
  supplier_name: string | null;
  status: string | null;
  statuses?: ReceiptStatus | null;
};

type StockReceiptItem = {
  id: string;
  item_type: PurchaseItemType;
  material_id: string | null;
  consumable_id: string | null;
  quantity: number;
  price: number;
  amount: number;
  supplier_receipt_id: string | null;
  materials?: {
    name: string | null;
    article: string | null;
    color_id: string | null;
    colors?: {
      name: string | null;
      hex: string | null;
    } | null;
  } | null;
  consumables?: {
    name: string | null;
    article: string | null;
  } | null;
  supplier_receipts?: ReceiptForStock | null;
};

type StockRow = {
  key: string;
  itemType: PurchaseItemType;
  itemId: string;
  name: string;
  article: string;
  colorName: string;
  colorHex: string;
  quantity: number;
  amount: number;
  avgPrice: number;
  receiptsCount: number;
  lastReceiptDate: string;
  lastSupplierName: string;
};

function getReceiptStatusCode(item: StockReceiptItem) {
  return item.supplier_receipts?.statuses?.code || item.supplier_receipts?.status || "";
}

function isPostedReceiptItem(item: StockReceiptItem) {
  return getReceiptStatusCode(item) === "posted";
}

function formatMoney(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function StockPage() {
  const [items, setItems] = useState<StockReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<StockTab>("all");
  const [search, setSearch] = useState("");
  const [selectedStockRow, setSelectedStockRow] = useState<StockRow | null>(null);

  useEffect(() => {
    loadStockItems();
  }, []);

  async function loadStockItems() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("supplier_receipt_items")
        .select(
          `
          id,
          item_type,
          material_id,
          consumable_id,
          quantity,
          price,
          amount,
          supplier_receipt_id,
          materials(
            name,
            article,
            color_id,
            colors(name, hex)
          ),
          consumables(name, article),
          supplier_receipts(
            id,
            receipt_number,
            receipt_date,
            supplier_name,
            status,
            statuses(code, name, color)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data as StockReceiptItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки остатков",
      );
    } finally {
      setLoading(false);
    }
  }

  const postedItems = useMemo(() => items.filter(isPostedReceiptItem), [items]);

  const stockRows = useMemo(() => {
    const rows = new Map<string, StockRow>();

    postedItems.forEach((item) => {
      const isMaterial = item.item_type === "material";
      const itemId = isMaterial ? item.material_id : item.consumable_id;

      if (!itemId) return;

      const key = `${item.item_type}-${itemId}`;
      const existing = rows.get(key);
      const quantity = Number(item.quantity || 0);
      const amount = Number(item.amount || quantity * Number(item.price || 0));
      const receiptDate = item.supplier_receipts?.receipt_date || "";
      const supplierName = item.supplier_receipts?.supplier_name || "";

      const name = isMaterial
        ? item.materials?.name || "Материал"
        : item.consumables?.name || "Расходник";

      const article = isMaterial
        ? item.materials?.article || ""
        : item.consumables?.article || "";

      const colorName = isMaterial ? item.materials?.colors?.name || "" : "";
      const colorHex = isMaterial ? item.materials?.colors?.hex || "" : "";

      if (!existing) {
        rows.set(key, {
          key,
          itemType: item.item_type,
          itemId,
          name,
          article,
          colorName,
          colorHex,
          quantity,
          amount,
          avgPrice: quantity > 0 ? amount / quantity : 0,
          receiptsCount: 1,
          lastReceiptDate: receiptDate,
          lastSupplierName: supplierName,
        });

        return;
      }

      const nextQuantity = existing.quantity + quantity;
      const nextAmount = existing.amount + amount;
      const currentDate = existing.lastReceiptDate || "";
      const shouldUpdateLastReceipt = receiptDate && receiptDate >= currentDate;

      rows.set(key, {
        ...existing,
        quantity: nextQuantity,
        amount: nextAmount,
        avgPrice: nextQuantity > 0 ? nextAmount / nextQuantity : 0,
        receiptsCount: existing.receiptsCount + 1,
        lastReceiptDate: shouldUpdateLastReceipt ? receiptDate : existing.lastReceiptDate,
        lastSupplierName: shouldUpdateLastReceipt
          ? supplierName
          : existing.lastSupplierName,
      });
    });

    return Array.from(rows.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }, [postedItems]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stockRows.filter((row) => {
      const matchesTab = activeTab === "all" || row.itemType === activeTab;
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.article.toLowerCase().includes(query) ||
        row.colorName.toLowerCase().includes(query) ||
        row.lastSupplierName.toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });
  }, [stockRows, activeTab, search]);

  const selectedStockMovements = useMemo(() => {
    if (!selectedStockRow) return [];

    return postedItems
      .filter((item) => {
        const itemId =
          item.item_type === "material" ? item.material_id : item.consumable_id;

        return item.item_type === selectedStockRow.itemType && itemId === selectedStockRow.itemId;
      })
      .sort((a, b) => {
        const dateA = a.supplier_receipts?.receipt_date || "";
        const dateB = b.supplier_receipts?.receipt_date || "";

        return dateB.localeCompare(dateA);
      });
  }, [postedItems, selectedStockRow]);

  const totalAmount = stockRows.reduce((sum, row) => sum + row.amount, 0);
  const totalQuantity = stockRows.reduce((sum, row) => sum + row.quantity, 0);
  const materialRowsCount = stockRows.filter((row) => row.itemType === "material").length;
  const consumableRowsCount = stockRows.filter((row) => row.itemType === "consumable").length;

  return (
    <div style={pageStyle}>
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={sectionTitleRowStyle}>
              <span style={sectionIconStyle}>📊</span>
              <span style={sectionTitleStyle}>Остатки</span>
            </div>
            <div style={sectionSubtitleStyle}>
              Остатки считаются только по проведённым приёмкам со статусом posted.
            </div>
          </div>

          <button type="button" onClick={loadStockItems} style={secondaryButtonStyle}>
            Обновить
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={summaryGridStyle}>
          <SummaryCard label="Номенклатур" value={String(stockRows.length)} />
          <SummaryCard label="Материалов" value={String(materialRowsCount)} />
          <SummaryCard label="Расходников" value={String(consumableRowsCount)} />
          <SummaryCard label="Общее кол-во" value={formatQuantity(totalQuantity)} />
          <SummaryCard label="Стоимость" value={`${formatMoney(totalAmount)} ₽`} />
        </div>

        <div style={toolbarStyle}>
          <div style={filterTabsStyle}>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={filterTabStyle(activeTab === "all")}
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("material")}
              style={filterTabStyle(activeTab === "material")}
            >
              Материалы
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("consumable")}
              style={filterTabStyle(activeTab === "consumable")}
            >
              Расходники
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию, артикулу, цвету или поставщику"
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <div style={loadingStyle}>Загружаю остатки...</div>
        ) : filteredRows.length === 0 ? (
          <div style={emptyStyle}>
            Остатков пока нет. Проведи приёмку, чтобы товар появился здесь.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Тип</th>
                  <th style={thStyle}>Номенклатура</th>
                  <th style={thStyle}>Артикул</th>
                  <th style={thStyle}>Цвет</th>
                  <th style={thStyle}>Остаток</th>
                  <th style={thStyle}>Средняя цена</th>
                  <th style={thStyle}>Стоимость</th>
                  <th style={thStyle}>Приёмок</th>
                  <th style={thStyle}>Последнее поступление</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => setSelectedStockRow(row)}
                    style={clickableRowStyle}
                    title="Открыть карточку остатка"
                  >
                    <td style={tdStyle}>
                      <span style={typeBadgeStyle(row.itemType)}>
                        {row.itemType === "material" ? "Материал" : "Расходник"}
                      </span>
                    </td>
                    <td style={tdStrongStyle}>{row.name}</td>
                    <td style={tdStyle}>{row.article || "—"}</td>
                    <td style={tdStyle}>{renderColor(row)}</td>
                    <td style={tdStrongStyle}>{formatQuantity(row.quantity)}</td>
                    <td style={tdStyle}>{formatMoney(row.avgPrice)} ₽</td>
                    <td style={tdStrongStyle}>{formatMoney(row.amount)} ₽</td>
                    <td style={tdStyle}>{row.receiptsCount}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 3 }}>
                        <span>{row.lastReceiptDate || "—"}</span>
                        <span style={supplierTextStyle}>{row.lastSupplierName || "—"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStockRow && (
        <StockItemModal
          stockRow={selectedStockRow}
          movements={selectedStockMovements}
          onClose={() => setSelectedStockRow(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

function renderColor(row: StockRow) {
  if (row.itemType !== "material") return "—";

  if (!row.colorName) {
    return <span style={emptyColorChipStyle}>Цвет не указан</span>;
  }

  return (
    <span style={colorChipStyle}>
      <span
        style={{
          ...colorDotStyle,
          background: row.colorHex || "#e2e8f0",
        }}
      />
      {row.colorName}
    </span>
  );
}

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const sectionIconStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionSubtitleStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.5,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 6,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const filterTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

function filterTabStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    borderRadius: 999,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 900,
  };
}

const searchInputStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
};

const tableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  minWidth: 980,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const clickableRowStyle: React.CSSProperties = {
  cursor: "pointer",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  color: "#334155",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdStrongStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#0f172a",
  fontWeight: 900,
};

function typeBadgeStyle(itemType: PurchaseItemType): React.CSSProperties {
  return {
    display: "inline-flex",
    width: "fit-content",
    border: itemType === "material" ? "1px solid #bfdbfe" : "1px solid #ddd6fe",
    background: itemType === "material" ? "#eff6ff" : "#f5f3ff",
    color: itemType === "material" ? "#1d4ed8" : "#7c3aed",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

const colorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  width: "fit-content",
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const emptyColorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#94a3b8",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const colorDotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  flexShrink: 0,
};

const supplierTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const loadingStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  padding: 18,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  lineHeight: 1.5,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};
