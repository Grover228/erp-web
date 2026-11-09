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
  onSourceChange,
}: {
  product: ProductLike;
  source: FabricSource;
  onSourceChange: (source: FabricSource) => void;
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
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
          Расход на шапку берётся автоматически из техкарты, без изменения норматива.
          ERP отдельно проверит остаток рулона и рассчитает его себестоимость.
        </div>
      )}
    </fieldset>
  );
}
