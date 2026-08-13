import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type StockRow = {
  key: string;
  itemType: "product" | "material" | "consumable";
  itemId: string;
  name: string;
  article: string;
  colorName: string;
  avgPrice: number;
};

export type BulkEditChange = {
  id: string;
  itemType: "product" | "material" | "consumable";
  itemTypeLabel: string;
  currentName: string;
  newName: string;
  currentArticle: string;
  newArticle: string;
  currentColor: string;
  newColor: string;
  currentPrice: number;
  newPrice: number;
  changes: string[];
};

type Props = {
  open: boolean;
  stockRows: StockRow[];
  onClose: () => void;
  onApply: (changes: BulkEditChange[]) => Promise<void>;
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

export default function BulkEditModal({ open, stockRows, onClose, onApply, saving }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const changes = useMemo<BulkEditChange[]>(() => {
    const byId = new Map(stockRows.map((row) => [row.itemId, row]));
    const result: BulkEditChange[] = [];

    rows.forEach((excelRow) => {
      const id = normalize(excelRow["ID"]);
      if (!id) return;

      const current = byId.get(id);
      if (!current) return;

      const newName = normalize(excelRow["Номенклатура"]);
      const newArticle = normalize(excelRow["Артикул"]);
      const newColor = normalize(excelRow["Цвет"]);
      const parsedPrice = numberValue(excelRow["Цена"]);
      const newPrice = parsedPrice ?? current.avgPrice;

      const changeList: string[] = [];

      if (newName !== current.name) changeList.push("Название");
      if (newArticle !== current.article) changeList.push("Артикул");
      if (current.itemType === "material" && newColor !== current.colorName) {
        changeList.push("Цвет");
      }
      if (
        (current.itemType === "material" || current.itemType === "consumable") &&
        Math.abs(newPrice - current.avgPrice) > 0.000001
      ) {
        changeList.push("Цена");
      }

      if (changeList.length > 0) {
        result.push({
          id,
          itemType: current.itemType,
          itemTypeLabel: getItemTypeLabel(current.itemType),
          currentName: current.name,
          newName,
          currentArticle: current.article,
          newArticle,
          currentColor: current.colorName,
          newColor,
          currentPrice: current.avgPrice,
          newPrice,
          changes: changeList,
        });
      }
    });

    return result;
  }, [rows, stockRows]);

  function reset() {
    setRows([]);
    setFileName("");
    setError("");
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

      if (!("ID" in parsed[0])) {
        setError("В файле нет колонки «ID». Используй Excel, выгруженный из раздела «Остатки».");
        return;
      }

      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать Excel.");
    }
  }

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>✏️ Массовое редактирование</div>
            <div style={subtitleStyle}>
              Загрузи Excel, отредактированный на основе выгрузки из «Остатков».
              После проверки изменения можно применить к базе.
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
              <Summary label="Изменений" value={String(changes.length)} />
            </div>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Тип</th>
                    <th style={thStyle}>Номенклатура</th>
                    <th style={thStyle}>Артикул</th>
                    <th style={thStyle}>Цена</th>
                    <th style={thStyle}>Изменения</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.length === 0 ? (
                    <tr><td colSpan={5} style={emptyStyle}>Изменений не обнаружено.</td></tr>
                  ) : (
                    changes.map((row) => (
                      <tr key={row.id}>
                        <td style={tdStyle}>{row.itemTypeLabel}</td>
                        <td style={tdStyle}>
                          <div style={strongStyle}>{row.newName || row.currentName}</div>
                          {row.newName !== row.currentName && (
                            <div style={mutedStyle}>Было: {row.currentName}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={strongStyle}>{row.newArticle || "—"}</div>
                          {row.newArticle !== row.currentArticle && (
                            <div style={mutedStyle}>Было: {row.currentArticle || "—"}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {row.newPrice.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                        </td>
                        <td style={tdStyle}>{row.changes.join(", ")}</td>
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
            onClick={() => onApply(changes)}
            disabled={saving || changes.length === 0}
            style={changes.length > 0 && !saving ? applyButtonStyle : disabledButtonStyle}
          >
            {saving
              ? "Сохраняю..."
              : `Применить изменения (${changes.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div style={summaryStyle}><div style={summaryLabel}>{label}</div><div style={summaryValue}>{value}</div></div>;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 12000, background: "rgba(15,23,42,.48)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
};
const modalStyle: React.CSSProperties = {
  width: "min(1100px, 96vw)", maxHeight: "90vh", overflowY: "auto",
  background: "#fff", borderRadius: 22, border: "1px solid #dbe4f0",
  boxShadow: "0 28px 70px rgba(15,23,42,.35)", padding: 22, display: "grid", gap: 16,
};
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" };
const titleStyle: React.CSSProperties = { fontSize: 24, fontWeight: 900, color: "#0f172a" };
const subtitleStyle: React.CSSProperties = { marginTop: 7, color: "#64748b", lineHeight: 1.5 };
const closeStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 14, border: "1px solid #cbd5e1", background: "#fff", fontSize: 26, cursor: "pointer" };
const fileLabelStyle: React.CSSProperties = { border: "1px dashed #a78bfa", background: "#f5f3ff", color: "#6d28d9", borderRadius: 14, padding: 16, cursor: "pointer", fontWeight: 900, textAlign: "center" };
const fileInfoStyle: React.CSSProperties = { color: "#475569", fontSize: 13 };
const errorStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, fontWeight: 800 };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 };
const summaryStyle: React.CSSProperties = { border: "1px solid #dbe4f0", background: "#f8fafc", borderRadius: 16, padding: 14 };
const summaryLabel: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800 };
const summaryValue: React.CSSProperties = { marginTop: 5, color: "#0f172a", fontSize: 22, fontWeight: 900 };
const tableWrapStyle: React.CSSProperties = { overflow: "auto", border: "1px solid #dbe4f0", borderRadius: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 850 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: 900 };
const tdStyle: React.CSSProperties = { padding: "11px 12px", borderBottom: "1px solid #eef2f7", verticalAlign: "top", color: "#334155" };
const strongStyle: React.CSSProperties = { color: "#0f172a", fontWeight: 900 };
const mutedStyle: React.CSSProperties = { color: "#94a3b8", fontSize: 12, marginTop: 3 };
const emptyStyle: React.CSSProperties = { padding: 22, textAlign: "center", color: "#64748b" };
const footerStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontWeight: 900 };
const applyButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const disabledButtonStyle: React.CSSProperties = { ...secondaryButtonStyle, opacity: 0.5, cursor: "not-allowed" };
