import { useState } from "react";
import { supabase } from "../../supabase";

type DocumentType = "customer_order" | "customer_shipment" | "customer_payment";

export type CustomerShipment = {
  id: string;
  shipment_number: string | null;
  shipment_date: string;
  customer_order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  status_id: string | null;
  comment: string | null;
  total_amount: number;
  created_at: string | null;
};

export type CustomerShipmentItem = {
  id: string;
  customer_shipment_id: string;
  item_type: "product" | "material" | "consumable";
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  quantity: number;
  price: number;
  amount: number;
  products?: { name: string | null; article: string | null } | null;
  materials?: { name: string | null; article: string | null; color_id?: string | null } | null;
  consumables?: { name: string | null; article: string | null } | null;
};

type CustomerShipmentModalProps = {
  shipment: CustomerShipment;
  shipmentItems: CustomerShipmentItem[];
  onClose: () => void;
  onSaved?: () => void;
  onOpenDocument?: (type: DocumentType, id: string) => void;
};

export default function CustomerShipmentModal({
  shipment,
  shipmentItems,
  onClose,
  onSaved,
  onOpenDocument,
}: CustomerShipmentModalProps) {
  const [currentShipment, setCurrentShipment] = useState(shipment);
  const [posting, setPosting] = useState(false);
  const [unposting, setUnposting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  function getItemTypeLabel(itemType: CustomerShipmentItem["item_type"]) {
    if (itemType === "product") return "Товар / продукция";
    if (itemType === "material") return "Материал";
    if (itemType === "consumable") return "Расходник";
    return "Товар";
  }

  function getItemName(item: CustomerShipmentItem) {
    if (item.item_type === "material") return item.materials?.name || "Материал";
    if (item.item_type === "consumable") return item.consumables?.name || "Расходник";
    return item.products?.name || "Товар";
  }

  function getItemArticle(item: CustomerShipmentItem) {
    if (item.item_type === "material") return item.materials?.article || "";
    if (item.item_type === "consumable") return item.consumables?.article || "";
    return item.products?.article || "";
  }

  function formatMoney(value: number | string | null | undefined) {
    return `${Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ₽`;
  }

  async function postShipment() {
    if (currentShipment.status === "posted") return;

    if (shipmentItems.length === 0) {
      setError("В отгрузке нет позиций для проведения");
      return;
    }

    try {
      setPosting(true);
      setError("");

      const now = new Date().toISOString();

      const { error: deleteOldMovementsError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("source_document_type", "customer_shipment")
        .eq("source_document_id", currentShipment.id);

      if (deleteOldMovementsError) throw deleteOldMovementsError;

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(
          shipmentItems.map((item) => ({
            movement_type: "outgoing",
            source_document_type: "customer_shipment",
            source_document_id: currentShipment.id,
            customer_order_id: currentShipment.customer_order_id,
            customer_shipment_id: currentShipment.id,
            item_type: item.item_type,
            product_id: item.product_id,
            material_id: item.material_id,
            consumable_id: item.consumable_id,
            quantity: -Math.abs(Number(item.quantity || 0)),
            created_at: now,
          })),
        );

      if (movementsError) throw movementsError;

      if (currentShipment.customer_order_id) {
        const { error: reservationsError } = await supabase
          .from("stock_reservations")
          .update({
            status: "released",
            updated_at: now,
          })
          .eq("source_document_type", "customer_order")
          .eq("source_document_id", currentShipment.customer_order_id)
          .eq("status", "active");

        if (reservationsError) throw reservationsError;
      }

      const { error: shipmentUpdateError } = await supabase
        .from("customer_shipments")
        .update({
          status: "posted",
          updated_at: now,
        })
        .eq("id", currentShipment.id);

      if (shipmentUpdateError) throw shipmentUpdateError;

      if (currentShipment.customer_order_id) {
        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "completed",
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }

      setCurrentShipment((prev) => ({ ...prev, status: "posted" }));
      onSaved?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка проведения отгрузки");
    } finally {
      setPosting(false);
    }
  }

  async function unpostShipment() {
    if (currentShipment.status !== "posted") return;

    const confirmed = window.confirm(
      [
        `Отменить проведение отгрузки ${currentShipment.shipment_number || "Без номера"}?`,
        "",
        "Складские движения по этой отгрузке будут удалены.",
        "После этого документ можно будет исправить или удалить.",
      ].join("\n"),
    );

    if (!confirmed) return;

    try {
      setUnposting(true);
      setError("");

      const now = new Date().toISOString();

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("source_document_type", "customer_shipment")
        .eq("source_document_id", currentShipment.id);

      if (movementsError) throw movementsError;

      const { error: shipmentUpdateError } = await supabase
        .from("customer_shipments")
        .update({
          status: "draft",
          updated_at: now,
        })
        .eq("id", currentShipment.id);

      if (shipmentUpdateError) throw shipmentUpdateError;

      if (currentShipment.customer_order_id) {
        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "ordered",
            updated_at: now,
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }

      setCurrentShipment((prev) => ({
        ...prev,
        status: "draft",
      }));

      onSaved?.();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка отмены проведения отгрузки",
      );
    } finally {
      setUnposting(false);
    }
  }

  async function deleteShipment() {
    if (currentShipment.status === "posted") {
      setError("Проведённую отгрузку пока нельзя удалить напрямую. Сначала нужно сделать отмену проведения.");
      return;
    }

    const confirmed = window.confirm(
      `Удалить отгрузку ${currentShipment.shipment_number || "Без номера"}?`,
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("source_document_type", "customer_shipment")
        .eq("source_document_id", currentShipment.id);

      if (movementsError) throw movementsError;

      const { error: itemsError } = await supabase
        .from("customer_shipment_items")
        .delete()
        .eq("customer_shipment_id", currentShipment.id);

      if (itemsError) throw itemsError;

      const { error: shipmentError } = await supabase
        .from("customer_shipments")
        .delete()
        .eq("id", currentShipment.id);

      if (shipmentError) throw shipmentError;

      onSaved?.();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка удаления отгрузки");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>
              Отгрузка {currentShipment.shipment_number || "Черновик"}
            </div>
            <div style={subtitleStyle}>
              Дата: {currentShipment.shipment_date || "—"} · Покупатель:{" "}
              {currentShipment.customer_name || "—"}
            </div>
          </div>

          <div style={actionsStyle}>
            {currentShipment.customer_order_id && (
              <button
                type="button"
                onClick={() =>
                  onOpenDocument?.("customer_order", currentShipment.customer_order_id || "")
                }
                style={secondaryButtonStyle}
              >
                🧾 Заказ
              </button>
            )}

            {currentShipment.status === "posted" ? (
              <button
                type="button"
                onClick={unpostShipment}
                disabled={unposting}
                style={{
                  ...unpostButtonStyle,
                  opacity: unposting ? 0.65 : 1,
                  cursor: unposting ? "not-allowed" : "pointer",
                }}
              >
                {unposting ? "Отменяю..." : "↩ Отменить проведение"}
              </button>
            ) : (
              <button
                type="button"
                onClick={postShipment}
                disabled={posting}
                style={{
                  ...postButtonStyle,
                  opacity: posting ? 0.65 : 1,
                  cursor: posting ? "not-allowed" : "pointer",
                }}
              >
                {posting ? "Провожу..." : "✓ Провести отгрузку"}
              </button>
            )}

            {currentShipment.status !== "posted" && (
              <button
                type="button"
                onClick={deleteShipment}
                disabled={deleting}
                style={{
                  ...deleteButtonStyle,
                  opacity: deleting ? 0.65 : 1,
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                {deleting ? "Удаляю..." : "Удалить"}
              </button>
            )}

            <button type="button" onClick={onClose} style={closeButtonStyle}>
              ×
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={infoGridStyle}>
          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Статус</div>
            <div style={statusBadgeStyle}>
              {currentShipment.status === "posted" ? "Проведена" : "Черновик"}
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Сумма</div>
            <div style={infoValueStyle}>{formatMoney(currentShipment.total_amount)}</div>
          </div>
        </div>

        <div style={noticeStyle}>
          {currentShipment.status === "posted"
            ? "Отгрузка проведена. Остатки списаны со склада. Если документ ошибочный, сначала отмените проведение."
            : "При проведении отгрузка спишет товары со склада и закроет резерв по заказу."}
        </div>

        <div>
          <div style={sectionTitleStyle}>Позиции отгрузки</div>

          {shipmentItems.length === 0 ? (
            <div style={emptyStyle}>В отгрузке нет позиций.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Тип</th>
                    <th style={thStyle}>Номенклатура</th>
                    <th style={thStyle}>Артикул</th>
                    <th style={thStyle}>Кол-во</th>
                    <th style={thStyle}>Цена</th>
                    <th style={thStyle}>Сумма</th>
                  </tr>
                </thead>

                <tbody>
                  {shipmentItems.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>{getItemTypeLabel(item.item_type)}</td>
                      <td style={tdStyle}>{getItemName(item)}</td>
                      <td style={tdStyle}>{getItemArticle(item) || "—"}</td>
                      <td style={tdStyle}>{item.quantity}</td>
                      <td style={tdStyle}>{formatMoney(item.price)}</td>
                      <td style={tdStyle}>{formatMoney(item.amount)}</td>
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

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.48)", zIndex: 10080, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalStyle: React.CSSProperties = { width: "min(1120px, 96vw)", maxHeight: "84vh", overflowY: "auto", background: "#ffffff", borderRadius: 18, padding: 18, border: "1px solid #dbe4f0", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.34)", display: "grid", gap: 14 };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" };
const titleStyle: React.CSSProperties = { color: "#0f172a", fontSize: 24, fontWeight: 900 };
const subtitleStyle: React.CSSProperties = { color: "#64748b", marginTop: 5, fontSize: 16 };
const actionsStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900 };
const postButtonStyle: React.CSSProperties = { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 14 };
const unpostButtonStyle: React.CSSProperties = { border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 14 };
const deleteButtonStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 14 };
const closeButtonStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: 24, fontWeight: 800, color: "#0f172a" };
const infoGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 };
const infoCardStyle: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 16, padding: 14, background: "#f8fafc" };
const infoLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: 13, fontWeight: 800, marginBottom: 6 };
const infoValueStyle: React.CSSProperties = { color: "#0f172a", fontSize: 18, fontWeight: 900 };
const statusBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", width: "fit-content", border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", borderRadius: 999, padding: "7px 12px", fontSize: 15, fontWeight: 900 };
const errorStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 800 };
const noticeStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e3a8a", borderRadius: 14, padding: 13, fontWeight: 700, lineHeight: 1.45 };
const sectionTitleStyle: React.CSSProperties = { color: "#0f172a", fontSize: 20, fontWeight: 900, marginBottom: 10 };
const emptyStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: 16, padding: 24, textAlign: "center", color: "#64748b" };
const tableWrapStyle: React.CSSProperties = { width: "100%", overflowX: "auto", border: "1px solid #dbe4f0", borderRadius: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "#ffffff", minWidth: 760 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "14px 12px", background: "#f8fafc", color: "#334155", fontSize: 14, fontWeight: 900, borderBottom: "1px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "13px 12px", color: "#334155", borderBottom: "1px solid #eef2f7", fontSize: 14, verticalAlign: "middle" };
