import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type StockRow = {
  key: string;
  itemType: "product" | "material" | "consumable";
  itemId: string;
  name: string;
  article: string;
  colorName: string;
  quantityOnHand: number;
};

type InventoryItemType = "product" | "material" | "consumable";

type InventoryRow = {
  id: string;
  name: string;
  article: string;
  itemType: InventoryItemType;
  currentQuantity: number;
  actualQuantity: number;
  difference: number;
  action: string;
};

type InventoryError = {
  rowNumber: number;
  name: string;
  article: string;
  id: string;
  actualValue: string;
  reason: string;
};

type Props = {
  open: boolean;
  stockRows: StockRow[];
  onClose: () => void;
  onApply: (changes: InventoryRow[]) => Promise<void> | void;
  saving: boolean;
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  const text = normalize(value).replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function getItemTypeLabel(itemType: string) {
  if (itemType === "product") return "Товар / продукция";
  if (itemType === "material") return "Материал";
  return "Расходник";
}

function normalizeItemType(value: string): InventoryItemType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "product" || normalized === "товар" || normalized === "товар / продукция") return "product";
  if (normalized === "material" || normalized === "материал") return "material";
  if (normalized === "consumable" || normalized === "расходник") return "consumable";
  return null;
}

export default function InventoryImportModal({ open, stockRows, onClose, onApply, saving }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const result = useMemo(() => {
    const inventory: InventoryRow[] = [];
    const errors: InventoryError[] = [];
    const seenIds = new Set<string>();

    rows.forEach((excelRow, index) => {
      const rowNumber = index + 2;
      const id = normalize(excelRow["ID"]);
      const name = normalize(excelRow["Номенклатура"]);
      const article = normalize(excelRow["Артикул"]);
      const itemTypeValue = normalize(excelRow["Тип"]);
      const itemType = normalizeItemType(itemTypeValue);
      const current = numberValue(excelRow["Остаток"]);
      const actual = numberValue(excelRow["Фактический остаток"]);
      const actualValue = normalize(excelRow["Фактический остаток"]);

      if (!id) {
        errors.push({ rowNumber, name, article, id: "", actualValue, reason: "В Excel отсутствует ID." });
        return;
      }

      if (!itemType) {
        errors.push({ rowNumber, name, article, id, actualValue, reason: `Неизвестный тип номенклатуры: «${itemTypeValue || "пусто"}».` });
        return;
      }

      if (seenIds.has(id)) {
        errors.push({ rowNumber, name, article, id, actualValue, reason: "ID повторяется в файле." });
        return;
      }
      seenIds.add(id);

      if (current === null) {
        errors.push({ rowNumber, name, article, id, actualValue, reason: "В Excel отсутствует или некорректен столбец «Остаток»." });
        return;
      }

      if (actual === null) {
        errors.push({ rowNumber, name, article, id, actualValue, reason: "«Фактический остаток» пустой или не является числом." });
        return;
      }

      if (actual < 0) {
        errors.push({ rowNumber, name, article, id, actualValue, reason: "Фактический остаток не может быть отрицательным." });
        return;
      }

      const difference = actual - current;

      inventory.push({
        id,
        name,
        article,
        itemType,
        currentQuantity: current,
        actualQuantity: actual,
        difference,
        action:
          difference > 0.000001
            ? "Оприходование"
            : difference < -0.000001
              ? "Списание"
              : "Без изменений",
      });
    });

    const changes = inventory.filter((row) => Math.abs(row.difference) > 0.000001);

    return {
      inventory,
      changes,
      errors,
      receipts: changes.filter((row) => row.difference > 0).length,
      writeOffs: changes.filter((row) => row.difference < 0).length,
    };
  }, [rows]);

  function reset() {
    setRows([]);
    setFileName("");
    setError("");
    setShowAll(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setError("");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        setError("В Excel не найден лист с данными.");
        return;
      }

      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
      });

      if (parsed.length === 0) {
        setError("В Excel нет строк для обработки.");
        return;
      }

      if (!("Фактический остаток" in parsed[0])) {
        setError("В файле нет колонки «Фактический остаток».");
        return;
      }

      if (!("ID" in parsed[0]) && !("Артикул" in parsed[0])) {
        setError("Нужна колонка «ID» или «Артикул» для сопоставления.");
        return;
      }

      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать Excel.");
    }
  }

  if (!open) return null;

  const visibleRows = showAll ? result.inventory : result.changes;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>📦 Проверка инвентаризации</div>
            <div style={subtitleStyle}>
              Загрузи Excel с колонкой «Фактический остаток». Сейчас склад не изменяется —
              мы только проверяем расхождения.
            </div>
          </div>
          <button type="button" onClick={handleClose} style={closeStyle}>×</button>
        </div>

        <label style={fileLabelStyle}>
          <span>Выбрать Excel-файл</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
        </label>

        {fileName && <div style={fileInfoStyle}>Файл: {fileName}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {rows.length > 0 && (
          <>
            <div style={summaryGridStyle}>
              <Summary label="Строк в файле" value={String(rows.length)} />
              <Summary label="Расхождений" value={String(result.changes.length)} />
              <Summary label="Оприходований" value={String(result.receipts)} />
              <Summary label="Списаний" value={String(result.writeOffs)} />
              <Summary label="Ошибок" value={String(result.errors.length)} />
            </div>

            <div style={toggleRowStyle}>
              <button type="button" onClick={() => setShowAll(false)} style={filterButtonStyle(!showAll)}>
                Только расхождения
              </button>
              <button type="button" onClick={() => setShowAll(true)} style={filterButtonStyle(showAll)}>
                Все строки
              </button>
            </div>

            {result.errors.length > 0 && (
              <div style={errorListStyle}>
                <div style={errorListTitleStyle}>Ошибки сопоставления</div>
                <div style={errorListSubtitleStyle}>Эти строки не будут допущены к применению, пока не исправлен Excel.</div>
                <div style={errorTableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Строка</th>
                        <th style={thStyle}>Номенклатура</th>
                        <th style={thStyle}>Артикул</th>
                        <th style={thStyle}>ID</th>
                        <th style={thStyle}>Факт</th>
                        <th style={thStyle}>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((row) => (
                        <tr key={`${row.rowNumber}-${row.id}`}>
                          <td style={tdStyle}>{row.rowNumber}</td>
                          <td style={strongStyle}>{row.name || "—"}</td>
                          <td style={tdStyle}>{row.article || "—"}</td>
                          <td style={tdStyle}>{row.id || "—"}</td>
                          <td style={tdStyle}>{row.actualValue || "—"}</td>
                          <td style={dangerStyle}>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Тип</th>
                    <th style={thStyle}>Номенклатура</th>
                    <th style={thStyle}>Артикул</th>
                    <th style={thStyle}>В ERP</th>
                    <th style={thStyle}>Факт</th>
                    <th style={thStyle}>Разница</th>
                    <th style={thStyle}>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr><td colSpan={7} style={emptyStyle}>Расхождений не обнаружено.</td></tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.itemType}</td>
                        <td style={strongStyle}>{row.name}</td>
                        <td style={tdStyle}>{row.article || "—"}</td>
                        <td style={tdStyle}>{row.currentQuantity.toLocaleString("ru-RU")}</td>
                        <td style={tdStyle}>{row.actualQuantity.toLocaleString("ru-RU")}</td>
                        <td style={row.difference < 0 ? dangerStyle : positiveStyle}>
                          {row.difference > 0 ? "+" : ""}
                          {row.difference.toLocaleString("ru-RU")}
                        </td>
                        <td style={tdStyle}>{row.action}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={footerStyle}>
          <button type="button" onClick={handleClose} style={secondaryButtonStyle}>Закрыть</button>
          <button
            type="button"
            onClick={() => onApply(result.changes)}
            disabled={saving || result.errors.length > 0 || result.changes.length === 0}
            style={
              !saving && result.errors.length === 0 && result.changes.length > 0
                ? applyButtonStyle
                : disabledButtonStyle
            }
          >
            {saving
              ? "Применяем..."
              : result.errors.length > 0
                ? `Исправьте ошибки (${result.errors.length})`
                : result.changes.length > 0
                  ? `Применить корректировки (${result.changes.length})`
                  : "Нет изменений для применения"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div style={summaryStyle}><div style={summaryLabel}>{label}</div><div style={summaryValue}>{value}</div></div>;
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 12000, background: "rgba(15,23,42,.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 };
const modalStyle: React.CSSProperties = { width: "min(1200px, 96vw)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 22, border: "1px solid #dbe4f0", boxShadow: "0 28px 70px rgba(15,23,42,.35)", padding: 22, display: "grid", gap: 16 };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" };
const titleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 900, color: "#0f172a" };
const subtitleStyle: React.CSSProperties = { marginTop: 7, color: "#64748b", lineHeight: 1.5 };
const closeStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", fontSize: 26, cursor: "pointer" };
const fileLabelStyle: React.CSSProperties = { border: "1px dashed #f59e0b", background: "#fffbeb", color: "#b45309", borderRadius: 14, padding: 16, cursor: "pointer", fontWeight: 900, textAlign: "center" };
const fileInfoStyle: React.CSSProperties = { color: "#475569", fontSize: 13 };
const errorStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, fontWeight: 800 };
const errorListStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff7f7", borderRadius: 16, padding: 14, display: "grid", gap: 8 };
const errorListTitleStyle: React.CSSProperties = { color: "#991b1b", fontWeight: 900, fontSize: 16 };
const errorListSubtitleStyle: React.CSSProperties = { color: "#7f1d1d", fontSize: 13 };
const errorTableWrapStyle: React.CSSProperties = { overflow: "auto", border: "1px solid #fecaca", borderRadius: 12, maxHeight: 320 };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 };
const summaryStyle: React.CSSProperties = { border: "1px solid #dbe4f0", background: "#f8fafc", borderRadius: 16, padding: 14 };
const summaryLabel: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800 };
const summaryValue: React.CSSProperties = { marginTop: 5, color: "#0f172a", fontSize: 22, fontWeight: 900 };
const toggleRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const filterButtonStyle = (active: boolean): React.CSSProperties => ({ border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0", background: active ? "#eff6ff" : "#fff", color: active ? "#1d4ed8" : "#475569", borderRadius: 999, padding: "9px 12px", cursor: "pointer", fontWeight: 900 });
const tableWrapStyle: React.CSSProperties = { overflow: "auto", border: "1px solid #dbe4f0", borderRadius: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 1000 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: 900 };
const tdStyle: React.CSSProperties = { padding: "11px 12px", borderBottom: "1px solid #eef2f7", verticalAlign: "top", color: "#334155" };
const strongStyle: React.CSSProperties = { ...tdStyle, color: "#0f172a", fontWeight: 900 };
const positiveStyle: React.CSSProperties = { ...tdStyle, color: "#15803d", fontWeight: 900 };
const dangerStyle: React.CSSProperties = { ...tdStyle, color: "#b91c1c", fontWeight: 900 };
const emptyStyle: React.CSSProperties = { padding: 22, textAlign: "center", color: "#64748b" };
const footerStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontWeight: 900 };
const applyButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};
const disabledButtonStyle: React.CSSProperties = { ...secondaryButtonStyle, opacity: 0.5, cursor: "not-allowed" };
