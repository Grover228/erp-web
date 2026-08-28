export function getProgress(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

export function formatTime(minutes: number | null | undefined) {
  const totalMinutes = Math.round(Number(minutes || 0));

  if (totalMinutes <= 0) return "0 мин";

  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  if (hours === 0) return `${restMinutes} мин`;
  if (restMinutes === 0) return `${hours} ч`;

  return `${hours} ч ${restMinutes} мин`;
}

export function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
}

export function formatQuantity(value: number) {
  return Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function getConversionFactor(value: number | null | undefined) {
  const factor = Number(value || 1);
  return factor > 0 ? factor : 1;
}

export function convertProductionUnitsToStockUnits(
  productionQuantity: number,
  productionUnitsPerPurchaseUnit: number | null | undefined
) {
  return productionQuantity / getConversionFactor(productionUnitsPerPurchaseUnit);
}

export function getStockKey(row: {
  item_type: string;
  product_id?: string | null;
  material_id?: string | null;
  consumable_id?: string | null;
}) {
  if (row.item_type === "product") return `product:${row.product_id || ""}`;
  if (row.item_type === "material") return `material:${row.material_id || ""}`;
  if (row.item_type === "consumable") {
    return `consumable:${row.consumable_id || ""}`;
  }

  return "";
}

export function getElapsedSeconds(startedAt: string | null, nowTick: number) {
  if (!startedAt) return 0;
  return Math.floor((nowTick - new Date(startedAt).getTime()) / 1000);
}

export function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "draft":
      return "Черновик";
    case "pending":
      return "Ожидает";
    case "waiting":
      return "Ожидает";
    case "partial":
      return "Частично выполнено";
    case "in_progress":
      return "В работе";
    case "done":
      return "Готово";
    case "cancelled":
      return "Отменён";
    case "archived":
      return "Архив";
    default:
      return status || "Черновик";
  }
}
