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

type InventoryRow = {
  id: string;
  name: string;
  article: string;
  itemType: string;
  currentQuantity: number;
  actualQuantity: number;
  difference: number;
  action: string;
};

type Props = {
  open: boolean;
  stockRows: StockRow[];
  onClose: () => void;
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

export default function InventoryImportModal({ open, stockRows, onClose }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const result = useMemo(() => {
    const byId = new Map(stockRows.map((row) => [row.itemId, row]));
    const byArticle = new Map<string, StockRow[]>();

    stockRows.forEach((row) => {
      const article = row.article.trim();
      if (!article) return;
      const list = byArticle.get(article) || [];
      list.push(row);
      byArticle.set(article, list);
    });

    const inventory: InventoryRow[] = [];
    let errors = 0;

    rows.forEach((excelRow) => {
      const id = normalize(excelRow["ID"]);
      const article = normalize(excelRow["Артикул"]);
      const actual = numberValue(excelRow["Фактический остаток"]);

      if (!id && !article) {
        errors++;
        return;
      }

      if (actual === null || actual < 0) {
        errors++;
        return;
      }

      let current = id ? byId.get(id) : undefined;

      if (!current && article) {
        const matches = byArticle.get(article) || [];
        if (matches.length === 1) current = matches[0];
        else if (matches.length > 1) {
          errors++;
          return;
        }
      }

      if (!current) {
        errors++;
        return;
      }

      const difference = actual - current.quantityOnHand;

      inventory.push({
        id: current.itemId,
        name: current.name,
        article: current.article,
        itemType: getItemTypeLabel(current.itemType),
        currentQuantity: current.quantityOnHand,
        actualQuantity: actual,
        difference,
        action:
          difference > 0
            ? "Оприходование"
            : difference < 0
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
  }, [rows, stockRows]);

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
              <Summary label="Ошибок" value={String(result.errors)} />
            </div>

            <div style={toggleRowStyle}>
              <button type="button" onClick={() => setShowAll(false)} style={filterButtonStyle(!showAll)}>
                Только расхождения
              </button>
              <button type="button" onClick={() => setShowAll(true)} style={filterButtonStyle(showAll)}>
                Все строки
              </button>
            </div>

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
          <button type="button" disabled style={disabledButtonStyle}>
            Применить корректировки — следующий этап
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
const disabledButtonStyle: React.CSSProperties = { ...secondaryButtonStyle, opacity: 0.5, cursor: "not-allowed" };
