import type { CSSProperties } from "react";
import type { FabricSource } from "./createProductionOrder";

type ProductLike = { name: string; article?: string | null } | null | undefined;

export function hasAlternativeRoll(product: ProductLike): boolean {
  if (!product) return false;
  return /^bini-black(?:-|$)/i.test(product.article || "") ||
    /шапка\s+бини.*черн/i.test(product.name);
}

export default function FabricSourcePicker({
  product,
  source,
  rollMetersPerItem,
  onSourceChange,
  onRollMetersChange,
}: {
  product: ProductLike;
  source: FabricSource;
  rollMetersPerItem: string;
  onSourceChange: (source: FabricSource) => void;
  onRollMetersChange: (value: string) => void;
}) {
  if (!hasAlternativeRoll(product)) return null;

  const box: CSSProperties = {
    display: "grid",
    gap: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    color: "#0f172a",
  };
  const option: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  };
  return (
    <fieldset style={box}>
      <legend style={{ fontSize: 14, fontWeight: 800, padding: "0 5px" }}>
        Из какой ткани шить?
      </legend>
      <label style={option}>
        <input
          type="radio"
          name="fabric-source"
          checked={source === "sleeve"}
          onChange={() => onSourceChange("sleeve")}
        />
        Пачка / рукав (по умолчанию)
      </label>
      <label style={option}>
        <input
          type="radio"
          name="fabric-source"
          checked={source === "roll"}
          onChange={() => onSourceChange("roll")}
        />
        Рулон — чёрная кулирка 185 см, 190 г/м²
      </label>
      {source === "roll" && (
        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="roll-metres-per-item" style={{ fontSize: 13, fontWeight: 700 }}>
            Расход рулона на одну шапку, пог. м
          </label>
          <input
            id="roll-metres-per-item"
            type="number"
            min="0.001"
            step="0.001"
            required
            value={rollMetersPerItem}
            placeholder="Замерьте по первой раскладке"
            onChange={(event) => onRollMetersChange(event.target.value)}
            style={{ border: "1px solid #94a3b8", borderRadius: 8, padding: 10, fontSize: 16 }}
          />
          <div style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.5 }}>
            Рулон шире и плотнее рукава. Не переносим расход из старой техкарты автоматически:
            укажи измеренный расход. ERP проверит отдельный остаток рулона в кг,
            зарезервирует его и рассчитает себестоимость.
          </div>
        </div>
      )}
    </fieldset>
  );
}
