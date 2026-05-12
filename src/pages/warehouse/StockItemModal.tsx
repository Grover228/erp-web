import type { CSSProperties } from "react";

export type PurchaseItemType = "material" | "consumable";

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

type StockItemModalProps = {
  stockRow: StockRow;
  movements: StockReceiptItem[];
  onClose: () => void;
};

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

function getReceiptStatusName(item: StockReceiptItem) {
  return item.supplier_receipts?.statuses?.name || item.supplier_receipts?.status || "—";
}

function getReceiptStatusColor(item: StockReceiptItem) {
  return item.supplier_receipts?.statuses?.color || "#2563eb";
}

export default function StockItemModal({
  stockRow,
  movements,
  onClose,
}: StockItemModalProps) {
  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleRowStyle}>
              <span style={iconStyle}>{stockRow.itemType === "material" ? "🧵" : "🧰"}</span>
              <div>
                <div style={titleStyle}>{stockRow.name}</div>
                <div style={subtitleStyle}>
                  {stockRow.itemType === "material" ? "Материал" : "Расходник"}
                  {stockRow.article ? ` · Артикул: ${stockRow.article}` : " · Без артикула"}
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        <div style={summaryGridStyle}>
          <InfoCard label="Текущий остаток" value={formatQuantity(stockRow.quantity)} />
          <InfoCard label="Средняя цена" value={`${formatMoney(stockRow.avgPrice)} ₽`} />
          <InfoCard label="Стоимость" value={`${formatMoney(stockRow.amount)} ₽`} />
          <InfoCard label="Приёмок" value={String(stockRow.receiptsCount)} />
        </div>

        <div style={detailsGridStyle}>
          <div style={detailsCardStyle}>
            <div style={cardTitleStyle}>Параметры товара</div>

            <div style={paramsGridStyle}>
              <ParamRow label="Тип" value={stockRow.itemType === "material" ? "Материал" : "Расходник"} />
              <ParamRow label="Номенклатура" value={stockRow.name} />
              <ParamRow label="Артикул" value={stockRow.article || "—"} />
              <div style={paramRowStyle}>
                <div style={paramLabelStyle}>Цвет</div>
                <div style={paramValueStyle}>{renderColor(stockRow)}</div>
              </div>
            </div>
          </div>

          <div style={detailsCardStyle}>
            <div style={cardTitleStyle}>Последнее поступление</div>

            <div style={paramsGridStyle}>
              <ParamRow label="Дата" value={stockRow.lastReceiptDate || "—"} />
              <ParamRow label="Поставщик" value={stockRow.lastSupplierName || "—"} />
              <ParamRow label="Источник" value="Проведённые приёмки" />
              <ParamRow label="Правило" value="Остаток меняется только после проведения" />
            </div>
          </div>
        </div>

        <div style={movementsCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={cardTitleStyle}>История движений</div>
              <div style={sectionSubtitleStyle}>
                Пока показываем проведённые приёмки. Позже сюда добавим списания, резервы и отгрузки.
              </div>
            </div>
          </div>

          {movements.length === 0 ? (
            <div style={emptyStyle}>Движений по этой позиции пока нет.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Документ</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Поставщик</th>
                    <th style={thStyle}>Статус</th>
                    <th style={thStyle}>Кол-во</th>
                    <th style={thStyle}>Цена</th>
                    <th style={thStyle}>Сумма</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStrongStyle}>
                        {item.supplier_receipts?.receipt_number || "Черновик приёмки"}
                      </td>
                      <td style={tdStyle}>{item.supplier_receipts?.receipt_date || "—"}</td>
                      <td style={tdStyle}>{item.supplier_receipts?.supplier_name || "—"}</td>
                      <td style={tdStyle}>
                        <span
                          style={statusBadgeStyle(getReceiptStatusColor(item))}
                        >
                          {getReceiptStatusName(item)}
                        </span>
                      </td>
                      <td style={tdStrongStyle}>{formatQuantity(Number(item.quantity || 0))}</td>
                      <td style={tdStyle}>{formatMoney(Number(item.price || 0))} ₽</td>
                      <td style={tdStrongStyle}>{formatMoney(Number(item.amount || 0))} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
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

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={paramRowStyle}>
      <div style={paramLabelStyle}>{label}</div>
      <div style={paramValueStyle}>{value}</div>
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

function statusBadgeStyle(color: string): CSSProperties {
  return {
    display: "inline-flex",
    width: "fit-content",
    border: `1px solid ${color}`,
    background: "#ffffff",
    color,
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 14,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const titleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconStyle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 26,
  fontWeight: 900,
};

const subtitleStyle: CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 15,
};

const closeButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 800,
  color: "#0f172a",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const infoCardStyle: CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  background: "#f8fafc",
  padding: 14,
};

const infoLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 6,
};

const infoValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const detailsCardStyle: CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  background: "#ffffff",
  padding: 14,
};

const cardTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const paramsGridStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 12,
};

const paramRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "150px 1fr",
  gap: 10,
  alignItems: "center",
};

const paramLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const paramValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
};

const movementsCardStyle: CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  background: "#ffffff",
  padding: 14,
  display: "grid",
  gap: 12,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const sectionSubtitleStyle: CSSProperties = {
  color: "#64748b",
  marginTop: 4,
  fontSize: 14,
  lineHeight: 1.5,
};

const tableWrapStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
  minWidth: 860,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "14px 12px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "13px 12px",
  color: "#334155",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdStrongStyle: CSSProperties = {
  ...tdStyle,
  color: "#0f172a",
  fontWeight: 900,
};

const colorChipStyle: CSSProperties = {
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

const emptyColorChipStyle: CSSProperties = {
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

const colorDotStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  flexShrink: 0,
};

const emptyStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  lineHeight: 1.5,
};
