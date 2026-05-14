import { useState } from "react";
import { supabase } from "../../supabase";

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
  products?: {
    name: string | null;
    article: string | null;
  } | null;
  materials?: {
    name: string | null;
    article: string | null;
    color_id?: string | null;
  } | null;
  consumables?: {
    name: string | null;
    article: string | null;
  } | null;
};

type CustomerShipmentModalProps = {
  shipment: CustomerShipment;
  shipmentItems: CustomerShipmentItem[];
  onClose: () => void;
  onSaved?: () => void;
};

export default function CustomerShipmentModal({
  shipment,
  shipmentItems,
  onClose,
  onSaved,
}: CustomerShipmentModalProps) {
  const [currentShipment, setCurrentShipment] = useState(shipment);
  const [posting, setPosting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  function getItemTypeLabel(itemType: CustomerShipmentItem["item_type"]) {
    if (itemType === "product") return "Готовая продукция / товар";
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

  function getItemKey(item: {
    item_type: CustomerShipmentItem["item_type"];
    product_id: string | null;
    material_id: string | null;
    consumable_id: string | null;
  }) {
    if (item.item_type === "product") return `product:${item.product_id || ""}`;
    if (item.item_type === "material") return `material:${item.material_id || ""}`;
    if (item.item_type === "consumable") {
      return `consumable:${item.consumable_id || ""}`;
    }

    return "";
  }

  async function getStatusId(categoryCode: string, statusCode: string) {
    const { data: category, error: categoryError } = await supabase
      .from("status_categories")
      .select("id")
      .eq("code", categoryCode)
      .maybeSingle();

    if (categoryError) throw categoryError;
    if (!category?.id) return null;

    const { data: status, error: statusError } = await supabase
      .from("statuses")
      .select("id")
      .eq("category_id", category.id)
      .eq("code", statusCode)
      .maybeSingle();

    if (statusError) throw statusError;

    return status?.id || null;
  }

  async function postShipment() {
    if (currentShipment.status === "posted") {
      setError("Эта отгрузка уже проведена");
      return;
    }

    if (shipmentItems.length === 0) {
      setError("В отгрузке нет позиций для проведения");
      return;
    }

    try {
      setPosting(true);
      setError("");

      const { data: stockRows, error: stockError } = await supabase
        .from("stock_available")
        .select(
          "item_type, product_id, material_id, consumable_id, quantity_on_hand, quantity_reserved, quantity_available",
        );

      if (stockError) throw stockError;

      const { data: reservationRows, error: reservationError } = await supabase
        .from("stock_reservations")
        .select("item_type, product_id, material_id, consumable_id, quantity")
        .eq("source_document_type", "customer_order")
        .eq("source_document_id", currentShipment.customer_order_id || "")
        .eq("status", "active");

      if (reservationError) throw reservationError;

      const reservedByKey = new Map<string, number>();

      (reservationRows || []).forEach((reservation) => {
        const key = getItemKey({
          item_type: reservation.item_type,
          product_id: reservation.product_id,
          material_id: reservation.material_id,
          consumable_id: reservation.consumable_id,
        });

        reservedByKey.set(
          key,
          (reservedByKey.get(key) || 0) + Number(reservation.quantity || 0),
        );
      });

      const shortages = shipmentItems
        .map((item) => {
          const key = getItemKey(item);
          const stock = (stockRows || []).find(
            (row) => getItemKey(row) === key,
          );

          const available =
            Number(stock?.quantity_available || 0) + Number(reservedByKey.get(key) || 0);
          const requested = Number(item.quantity || 0);

          if (requested > available) {
            return `${getItemName(item)}: нужно ${requested}, доступно ${available}`;
          }

          return "";
        })
        .filter(Boolean);

      if (shortages.length > 0) {
        throw new Error(`Недостаточно остатка: ${shortages.join("; ")}`);
      }

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
            created_at: new Date().toISOString(),
          })),
        );

      if (movementsError) throw movementsError;

      if (currentShipment.customer_order_id) {
        const { error: reservationsError } = await supabase
          .from("stock_reservations")
          .update({
            status: "released",
            updated_at: new Date().toISOString(),
          })
          .eq("source_document_type", "customer_order")
          .eq("source_document_id", currentShipment.customer_order_id)
          .eq("status", "active");

        if (reservationsError) throw reservationsError;
      }

      const shipmentPostedStatusId = await getStatusId("customer_shipments", "posted");

      const { error: shipmentUpdateError } = await supabase
        .from("customer_shipments")
        .update({
          status: "posted",
          status_id: shipmentPostedStatusId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentShipment.id);

      if (shipmentUpdateError) throw shipmentUpdateError;

      if (currentShipment.customer_order_id) {
        const orderCompletedStatusId = await getStatusId(
          "customer_orders",
          "completed",
        );

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "completed",
            status_id: orderCompletedStatusId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }

      setCurrentShipment((prev) => ({
        ...prev,
        status: "posted",
        status_id: shipmentPostedStatusId,
      }));

      onSaved?.();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка проведения отгрузки",
      );
    } finally {
      setPosting(false);
    }
  }


  async function deleteDraftShipment() {
    if (currentShipment.status === "posted") {
      setError("Проведённую отгрузку нельзя удалить напрямую. Сначала отмени проведение.");
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
        .eq("customer_shipment_id", currentShipment.id);

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
      setError(
        error instanceof Error ? error.message : "Ошибка удаления отгрузки",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function cancelPostedShipment() {
    if (currentShipment.status !== "posted") {
      setError("Отменить проведение можно только у проведённой отгрузки");
      return;
    }

    const confirmed = window.confirm(
      `Отменить проведение отгрузки ${currentShipment.shipment_number || "Без номера"}? Остатки будут возвращены на склад.`,
    );

    if (!confirmed) return;

    try {
      setCancelling(true);
      setError("");

      const { error: reverseMovementsError } = await supabase
        .from("stock_movements")
        .insert(
          shipmentItems.map((item) => ({
            movement_type: "incoming",
            source_document_type: "customer_shipment_cancel",
            source_document_id: currentShipment.id,
            customer_order_id: currentShipment.customer_order_id,
            customer_shipment_id: currentShipment.id,
            item_type: item.item_type,
            product_id: item.product_id,
            material_id: item.material_id,
            consumable_id: item.consumable_id,
            quantity: Math.abs(Number(item.quantity || 0)),
            created_at: new Date().toISOString(),
          })),
        );

      if (reverseMovementsError) throw reverseMovementsError;

      const shipmentCancelledStatusId = await getStatusId(
        "customer_shipments",
        "cancelled",
      );

      const { error: shipmentUpdateError } = await supabase
        .from("customer_shipments")
        .update({
          status: "cancelled",
          status_id: shipmentCancelledStatusId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentShipment.id);

      if (shipmentUpdateError) throw shipmentUpdateError;

      if (currentShipment.customer_order_id) {
        const orderInProgressStatusId = await getStatusId(
          "customer_orders",
          "in_progress",
        );

        const { error: orderUpdateError } = await supabase
          .from("customer_orders")
          .update({
            status: "in_progress",
            status_id: orderInProgressStatusId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentShipment.customer_order_id);

        if (orderUpdateError) throw orderUpdateError;
      }

      setCurrentShipment((prev) => ({
        ...prev,
        status: "cancelled",
        status_id: shipmentCancelledStatusId,
      }));

      onSaved?.();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка отмены проведения отгрузки",
      );
    } finally {
      setCancelling(false);
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
            <button
              type="button"
              onClick={postShipment}
              disabled={
                posting ||
                currentShipment.status === "posted" ||
                currentShipment.status === "cancelled"
              }
              style={postButtonStyle(
                posting ||
                  currentShipment.status === "posted" ||
                  currentShipment.status === "cancelled",
              )}
            >
              {currentShipment.status === "posted"
                ? "✓ Проведена"
                : currentShipment.status === "cancelled"
                  ? "Отменена"
                  : posting
                    ? "Провожу..."
                    : "✓ Провести отгрузку"}
            </button>

            {currentShipment.status === "posted" && (
              <button
                type="button"
                onClick={cancelPostedShipment}
                disabled={cancelling}
                style={cancelPostingButtonStyle(cancelling)}
              >
                {cancelling ? "Отменяю..." : "↩ Отменить проведение"}
              </button>
            )}

            {currentShipment.status !== "posted" && (
              <button
                type="button"
                onClick={deleteDraftShipment}
                disabled={deleting}
                style={deleteShipmentButtonStyle(deleting)}
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
              {currentShipment.status === "draft"
                ? "Черновик"
                : currentShipment.status === "posted"
                  ? "Проведена"
                  : currentShipment.status === "cancelled"
                    ? "Отменена"
                    : currentShipment.status}
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Сумма</div>
            <div style={infoValueStyle}>
              {Number(currentShipment.total_amount || 0).toLocaleString("ru-RU", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              ₽
            </div>
          </div>

          <div style={infoCardStyle}>
            <div style={infoLabelStyle}>Основание</div>
            <div style={infoValueStyle}>
              {currentShipment.customer_order_id ? "Заказ покупателя" : "—"}
            </div>
          </div>
        </div>

        <div
          style={
            currentShipment.status === "posted"
              ? successNoticeStyle
              : currentShipment.status === "cancelled"
                ? cancelledNoticeStyle
                : noticeStyle
          }
        >
          {currentShipment.status === "posted"
            ? "Отгрузка проведена. Остатки списаны, резерв закрыт, статус заказа обновлён."
            : currentShipment.status === "cancelled"
              ? "Проведение отгрузки отменено. Остатки возвращены обратным движением."
              : "Отгрузка создана как черновик. При проведении документ спишет остатки со склада, закроет резерв и обновит статусы."}
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
                      <td style={tdStyle}>
                        {Number(item.price || 0).toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </td>
                      <td style={tdStyle}>
                        {Number(item.amount || 0).toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </td>
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

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.48)",
  zIndex: 10050,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1120px, 96vw)",
  maxHeight: "84vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.34)",
  display: "grid",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 24,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 5,
  fontSize: 16,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

function postButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #bbf7d0",
    background: disabled ? "#dcfce7" : "#f0fdf4",
    color: disabled ? "#86efac" : "#15803d",
    borderRadius: 12,
    padding: "10px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 14,
  };
}

function cancelPostingButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #fed7aa",
    background: disabled ? "#ffedd5" : "#fff7ed",
    color: disabled ? "#fdba74" : "#c2410c",
    borderRadius: 12,
    padding: "10px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 14,
  };
}

function deleteShipmentButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid #fecaca",
    background: disabled ? "#fee2e2" : "#fff1f2",
    color: disabled ? "#fca5a5" : "#991b1b",
    borderRadius: 12,
    padding: "10px 13px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 14,
  };
}


const closeButtonStyle: React.CSSProperties = {
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

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
};

const infoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 6,
};

const infoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 15,
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 800,
};

const noticeStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  borderRadius: 14,
  padding: 13,
  fontWeight: 700,
  lineHeight: 1.45,
};

const successNoticeStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 14,
  padding: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};

const cancelledNoticeStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 14,
  padding: 13,
  fontWeight: 800,
  lineHeight: 1.45,
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
  marginBottom: 10,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
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
  minWidth: 760,
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

const tdStyle: React.CSSProperties = {
  padding: "13px 12px",
  color: "#334155",
  borderBottom: "1px solid #eef2f7",
  fontSize: 14,
  verticalAlign: "middle",
};
