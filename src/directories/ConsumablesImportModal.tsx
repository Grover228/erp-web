import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ExistingConsumable = {
  id: string;
  name: string;
  article: string | null;
};

type LookupItem = {
  id: string;
  name: string;
};

type UnitItem = LookupItem & {
  short_name: string;
};

export type ConsumableImportPayload = {
  name: string;
  article: string | null;
  category_id: string | null;
  color_id: string | null;
  unit_id: string;
  composition: string | null;
  size: string | null;
  supplier_name: string | null;
  default_price: number | null;
  min_stock: number | null;
  comment: string | null;
  is_active: boolean;
};

type PreparedRow = ConsumableImportPayload & {
  rowNumber: number;
  categoryName: string;
  colorName: string;
  unitName: string;
};

type SkippedRow = {
  rowNumber: number;
  id: string;
  name: string;
  article: string;
};

type ImportError = {
  rowNumber: number;
  name: string;
  article: string;
  reason: string;
};

type Props = {
  open: boolean;
  items: ExistingConsumable[];
  categories: LookupItem[];
  colors: LookupItem[];
  units: UnitItem[];
  saving: boolean;
  onClose: () => void;
  onApply: (rows: ConsumableImportPayload[]) => Promise<void> | void;
};

function normalize(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeKey(value: unknown) {
  return normalize(value).toLocaleLowerCase("ru-RU");
}

function normalizeExcelRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), value]),
  );
}

function getCell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) return row[key];
  }

  return "";
}

function hasAnyColumn(rows: Record<string, unknown>[], keys: string[]) {
  return rows.some((row) => keys.some((key) => key in row));
}

function parseOptionalNumber(value: unknown) {
  const text = normalize(value).replace(/\s/g, "").replace(",", ".");
  if (!text) return { value: null, valid: true };

  const number = Number(text);
  return {
    value: Number.isFinite(number) ? number : null,
    valid: Number.isFinite(number),
  };
}

function parseActivity(value: unknown) {
  const text = normalizeKey(value);

  if (!text) return { value: true, valid: true };
  if (["активен", "активный", "да", "true", "1"].includes(text)) {
    return { value: true, valid: true };
  }
  if (["неактивен", "неактивный", "нет", "false", "0"].includes(text)) {
    return { value: false, valid: true };
  }

  return { value: true, valid: false };
}

export default function ConsumablesImportModal({
  open,
  items,
  categories,
  colors,
  units,
  saving,
  onClose,
  onApply,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const result = useMemo(() => {
    const newRows: PreparedRow[] = [];
    const skippedRows: SkippedRow[] = [];
    const errors: ImportError[] = [];

    const existingIds = new Set(items.map((item) => item.id));
    const existingArticles = new Map(
      items
        .filter((item) => normalize(item.article))
        .map((item) => [normalizeKey(item.article), item]),
    );
    const categoryMap = new Map(
      categories.map((item) => [normalizeKey(item.name), item]),
    );
    const colorMap = new Map(
      colors.map((item) => [normalizeKey(item.name), item]),
    );
    const unitMap = new Map<string, UnitItem>();

    units.forEach((unit) => {
      unitMap.set(normalizeKey(unit.name), unit);
      unitMap.set(normalizeKey(unit.short_name), unit);
      unitMap.set(normalizeKey(`${unit.name} (${unit.short_name})`), unit);
    });

    const newArticles = new Set<string>();

    rows.forEach((excelRow, index) => {
      const rowNumber = index + 2;
      const id = normalize(getCell(excelRow, "ID", "Id", "id"));
      const name = normalize(getCell(excelRow, "Название", "Наименование"));
      const article = normalize(getCell(excelRow, "Артикул"));

      if (id) {
        if (existingIds.has(id)) {
          skippedRows.push({ rowNumber, id, name, article });
        } else {
          errors.push({
            rowNumber,
            name,
            article,
            reason: "У новой позиции поле ID должно быть пустым.",
          });
        }
        return;
      }

      if (!name) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Не заполнено обязательное поле «Название».",
        });
        return;
      }

      const unitNameValue = normalize(
        getCell(excelRow, "Единица измерения", "Ед. изм.", "Единица"),
      );
      const unitShortValue = normalize(
        getCell(
          excelRow,
          "Сокращение единицы",
          "Сокращение",
          "Код единицы",
        ),
      );
      const unitByName = unitNameValue
        ? unitMap.get(normalizeKey(unitNameValue))
        : null;
      const unitByShort = unitShortValue
        ? unitMap.get(normalizeKey(unitShortValue))
        : null;

      if (!unitNameValue && !unitShortValue) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Не заполнена обязательная единица измерения.",
        });
        return;
      }

      if ((unitNameValue && !unitByName) || (unitShortValue && !unitByShort)) {
        const unknownValue = unitByName ? unitShortValue : unitNameValue;
        errors.push({
          rowNumber,
          name,
          article,
          reason: `Единица измерения «${unknownValue}» не найдена в справочнике.`,
        });
        return;
      }

      if (unitByName && unitByShort && unitByName.id !== unitByShort.id) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Название и сокращение единицы относятся к разным значениям.",
        });
        return;
      }

      const unit = unitByName || unitByShort;
      if (!unit) return;

      const categoryName = normalize(getCell(excelRow, "Категория"));
      const category = categoryName
        ? categoryMap.get(normalizeKey(categoryName))
        : null;

      if (categoryName && !category) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: `Категория «${categoryName}» не найдена в справочнике.`,
        });
        return;
      }

      const colorName = normalize(getCell(excelRow, "Цвет"));
      const color = colorName ? colorMap.get(normalizeKey(colorName)) : null;

      if (colorName && !color) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: `Цвет «${colorName}» не найден в справочнике.`,
        });
        return;
      }

      const price = parseOptionalNumber(
        getCell(excelRow, "Цена по умолчанию", "Цена"),
      );
      const minStock = parseOptionalNumber(
        getCell(excelRow, "Минимальный остаток", "Мин. остаток"),
      );

      if (!price.valid || (price.value !== null && price.value < 0)) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Цена должна быть пустой или неотрицательным числом.",
        });
        return;
      }

      if (!minStock.valid || (minStock.value !== null && minStock.value < 0)) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Минимальный остаток должен быть пустым или неотрицательным числом.",
        });
        return;
      }

      const activity = parseActivity(getCell(excelRow, "Активность"));
      if (!activity.valid) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Активность должна быть «Активен» или «Неактивен».",
        });
        return;
      }

      const normalizedArticle = normalizeKey(article);
      if (normalizedArticle && existingArticles.has(normalizedArticle)) {
        const existingItem = existingArticles.get(normalizedArticle);
        errors.push({
          rowNumber,
          name,
          article,
          reason: `Артикул уже используется: «${existingItem?.name || article}».`,
        });
        return;
      }

      if (normalizedArticle && newArticles.has(normalizedArticle)) {
        errors.push({
          rowNumber,
          name,
          article,
          reason: "Артикул повторяется среди новых строк файла.",
        });
        return;
      }

      if (normalizedArticle) newArticles.add(normalizedArticle);

      newRows.push({
        rowNumber,
        name,
        article: article || null,
        category_id: category?.id || null,
        categoryName,
        color_id: color?.id || null,
        colorName,
        unit_id: unit.id,
        unitName: `${unit.name} (${unit.short_name})`,
        composition: normalize(getCell(excelRow, "Состав")) || null,
        size: normalize(getCell(excelRow, "Размер")) || null,
        supplier_name: normalize(getCell(excelRow, "Поставщик")) || null,
        default_price: price.value,
        min_stock: minStock.value,
        comment: normalize(getCell(excelRow, "Комментарий")) || null,
        is_active: activity.value,
      });
    });

    return { newRows, skippedRows, errors };
  }, [rows, items, categories, colors, units]);

  function reset() {
    setRows([]);
    setFileName("");
    setError("");
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setError("");
      setRows([]);
      setFileName("");

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) {
        setError("В Excel не найден лист с данными.");
        return;
      }

      const parsed = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })
        .map(normalizeExcelRow);

      if (parsed.length === 0) {
        setError("В Excel нет строк для обработки.");
        return;
      }

      if (!hasAnyColumn(parsed, ["Название", "Наименование"])) {
        setError("В файле нет колонки «Название».");
        return;
      }

      if (
        !hasAnyColumn(parsed, [
          "Единица измерения",
          "Ед. изм.",
          "Единица",
          "Сокращение единицы",
          "Сокращение",
          "Код единицы",
        ])
      ) {
        setError("В файле нет колонки с единицей измерения.");
        return;
      }

      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать Excel.");
    }
  }

  const payload = result.newRows.map(({ rowNumber, categoryName, colorName, unitName, ...row }) => row);
  const canApply = result.errors.length === 0 && payload.length > 0 && !saving;

  async function handleApply() {
    if (!canApply) return;

    try {
      await onApply(payload);
      reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось добавить расходники",
      );
    }
  }

  if (!open) return null;

  return (
    <div onClick={handleClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>📥 Импорт расходников</div>
            <div style={subtitleStyle}>
              Добавь новые строки без ID в ранее выгруженный Excel. До подтверждения
              база данных не изменяется.
            </div>
          </div>
          <button type="button" onClick={handleClose} style={closeStyle}>×</button>
        </div>

        <div style={noticeStyle}>
          Существующие строки с ID будут пропущены. Импорт добавляет только новые
          карточки и не меняет остатки, движения или ранее созданные расходники.
        </div>

        <label style={fileLabelStyle}>
          <span>Выбрать Excel-файл</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </label>

        {fileName && <div style={fileInfoStyle}>Файл: {fileName}</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {rows.length > 0 && (
          <>
            <div style={summaryGridStyle}>
              <Summary label="Строк в файле" value={String(rows.length)} />
              <Summary label="Будет добавлено" value={String(result.newRows.length)} />
              <Summary label="Существующих пропущено" value={String(result.skippedRows.length)} />
              <Summary label="Ошибок" value={String(result.errors.length)} />
            </div>

            {result.errors.length > 0 && (
              <section style={errorSectionStyle}>
                <div style={errorTitleStyle}>Ошибки — импорт заблокирован</div>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Строка</th>
                        <th style={thStyle}>Название</th>
                        <th style={thStyle}>Артикул</th>
                        <th style={thStyle}>Причина</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((row) => (
                        <tr key={`${row.rowNumber}-${row.reason}`}>
                          <td style={tdStyle}>{row.rowNumber}</td>
                          <td style={strongStyle}>{row.name || "—"}</td>
                          <td style={tdStyle}>{row.article || "—"}</td>
                          <td style={dangerStyle}>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section style={sectionStyle}>
              <div style={sectionTitleStyle}>Новые позиции</div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Строка</th>
                      <th style={thStyle}>Название</th>
                      <th style={thStyle}>Артикул</th>
                      <th style={thStyle}>Категория</th>
                      <th style={thStyle}>Цвет</th>
                      <th style={thStyle}>Единица</th>
                      <th style={thStyle}>Цена</th>
                      <th style={thStyle}>Мин. остаток</th>
                      <th style={thStyle}>Активность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.newRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={emptyStyle}>
                          Новых корректных строк пока нет.
                        </td>
                      </tr>
                    ) : (
                      result.newRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td style={tdStyle}>{row.rowNumber}</td>
                          <td style={strongStyle}>{row.name}</td>
                          <td style={tdStyle}>{row.article || "—"}</td>
                          <td style={tdStyle}>{row.categoryName || "—"}</td>
                          <td style={tdStyle}>{row.colorName || "—"}</td>
                          <td style={tdStyle}>{row.unitName}</td>
                          <td style={tdStyle}>{row.default_price ?? "—"}</td>
                          <td style={tdStyle}>{row.min_stock ?? "—"}</td>
                          <td style={tdStyle}>{row.is_active ? "Активен" : "Неактивен"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {result.skippedRows.length > 0 && (
              <details style={skippedStyle}>
                <summary style={skippedSummaryStyle}>
                  Показать существующие строки ({result.skippedRows.length})
                </summary>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Строка</th>
                        <th style={thStyle}>Название</th>
                        <th style={thStyle}>Артикул</th>
                        <th style={thStyle}>ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skippedRows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.id}`}>
                          <td style={tdStyle}>{row.rowNumber}</td>
                          <td style={strongStyle}>{row.name || "—"}</td>
                          <td style={tdStyle}>{row.article || "—"}</td>
                          <td style={tdStyle}>{row.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}

        <div style={footerStyle}>
          <button type="button" onClick={handleClose} disabled={saving} style={secondaryButtonStyle}>
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            style={canApply ? applyButtonStyle : disabledButtonStyle}
          >
            {saving
              ? "Добавляем..."
              : result.errors.length > 0
                ? `Исправьте ошибки (${result.errors.length})`
                : payload.length > 0
                  ? `Добавить позиции (${payload.length})`
                  : "Нет новых позиций"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 12000,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
};

const modalStyle: React.CSSProperties = {
  width: "min(1240px, 96vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.35)",
  padding: 22,
  display: "grid",
  gap: 16,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 7,
  color: "#64748b",
  lineHeight: 1.5,
};

const closeStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: 26,
  cursor: "pointer",
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: 14,
  padding: 13,
  lineHeight: 1.5,
  fontWeight: 700,
};

const fileLabelStyle: React.CSSProperties = {
  border: "1px dashed #60a5fa",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 14,
  padding: 16,
  cursor: "pointer",
  fontWeight: 900,
  textAlign: "center",
};

const fileInfoStyle: React.CSSProperties = { color: "#475569", fontSize: 13 };
const errorStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 14, padding: 12, fontWeight: 800 };
const errorSectionStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff7f7", borderRadius: 16, padding: 14, display: "grid", gap: 10 };
const errorTitleStyle: React.CSSProperties = { color: "#991b1b", fontWeight: 900, fontSize: 16 };
const summaryGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 };
const summaryStyle: React.CSSProperties = { border: "1px solid #dbe4f0", background: "#f8fafc", borderRadius: 16, padding: 14 };
const summaryLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800 };
const summaryValueStyle: React.CSSProperties = { marginTop: 5, color: "#0f172a", fontSize: 22, fontWeight: 900 };
const sectionStyle: React.CSSProperties = { display: "grid", gap: 9 };
const sectionTitleStyle: React.CSSProperties = { color: "#0f172a", fontWeight: 900, fontSize: 17 };
const tableWrapStyle: React.CSSProperties = { overflow: "auto", border: "1px solid #dbe4f0", borderRadius: 14, maxHeight: 360 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 980 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: 12, background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: 900, whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "11px 12px", borderBottom: "1px solid #eef2f7", verticalAlign: "top", color: "#334155" };
const strongStyle: React.CSSProperties = { ...tdStyle, color: "#0f172a", fontWeight: 900 };
const dangerStyle: React.CSSProperties = { ...tdStyle, color: "#b91c1c", fontWeight: 800 };
const emptyStyle: React.CSSProperties = { padding: 22, textAlign: "center", color: "#64748b" };
const skippedStyle: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 14, padding: 12 };
const skippedSummaryStyle: React.CSSProperties = { cursor: "pointer", color: "#475569", fontWeight: 800, marginBottom: 10 };
const footerStyle: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontWeight: 900 };
const applyButtonStyle: React.CSSProperties = { border: "1px solid #86efac", background: "#f0fdf4", color: "#15803d", borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontWeight: 900 };
const disabledButtonStyle: React.CSSProperties = { ...secondaryButtonStyle, opacity: 0.5, cursor: "not-allowed" };
