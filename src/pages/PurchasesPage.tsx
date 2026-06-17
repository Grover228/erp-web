import { useEffect, useState } from "react";
import { supabase } from "../supabase";

import SupplierOrderModal, {
  type Color,
  type Consumable,
  type Counterparty,
  type Material,
  type SupplierOrder,
  type SupplierOrderItem,
} from "./purchases/SupplierOrderModal";

type Tab = "orders" | "receipts";
type ModalMode = "create" | "view";

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);

  const [loading, setLoading] = useState(false);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SupplierOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<
    SupplierOrderItem[]
  >([]);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    loadDirectories();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("supplier_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders((data as SupplierOrder[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки заказов поставщикам",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDirectories() {
    try {
      setDirectoriesLoading(true);

      const [
        materialsResult,
        consumablesResult,
        colorsResult,
        counterpartiesResult,
      ] = await Promise.all([
        supabase
          .from("materials")
          .select("id, name, article, color_id, default_price")
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("consumables")
          .select("id, name, article, default_price")
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("colors")
          .select("id, name, hex")
          .order("name", { ascending: true }),

        supabase
          .from("counterparties")
          .select("id, name, type")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (materialsResult.error) throw materialsResult.error;
      if (consumablesResult.error) throw consumablesResult.error;
      if (colorsResult.error) throw colorsResult.error;
      if (counterpartiesResult.error) throw counterpartiesResult.error;

      setMaterials((materialsResult.data as Material[]) || []);
      setConsumables((consumablesResult.data as Consumable[]) || []);
      setColors((colorsResult.data as Color[]) || []);
      setCounterparties((counterpartiesResult.data as Counterparty[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки материалов, расходников, цветов и поставщиков",
      );
    } finally {
      setDirectoriesLoading(false);
    }
  }

  async function openOrder(order: SupplierOrder) {
    try {
      setSelectedOrder(order);
      setSelectedOrderItems([]);
      setSelectedOrderLoading(true);
      setModalMode("view");
      setError("");

      const { data, error } = await supabase
        .from("supplier_order_items")
        .select(
          `
          *,
          materials(name, article, color_id),
          consumables(name, article),
          items(name, article)
        `,
        )
        .eq("supplier_order_id", order.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setSelectedOrderItems((data as SupplierOrderItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки заказа",
      );
    } finally {
      setSelectedOrderLoading(false);
    }
  }

  function openCreateOrder() {
    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setModalMode("create");
    setError("");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedOrder(null);
    setSelectedOrderItems([]);
  }

  async function handleOrderSaved(createdOrderId?: string) {
    await loadOrders();

    if (!createdOrderId) {
      closeModal();
      return;
    }

    try {
      setSelectedOrderLoading(true);
      setError("");

      const { data: createdOrder, error: orderError } = await supabase
        .from("supplier_orders")
        .select("*")
        .eq("id", createdOrderId)
        .single();

      if (orderError) throw orderError;

      const { data: createdItems, error: itemsError } = await supabase
        .from("supplier_order_items")
        .select(
          `
          *,
          materials(name, article, color_id),
          consumables(name, article),
          items(name, article)
        `,
        )
        .eq("supplier_order_id", createdOrderId)
        .order("created_at", { ascending: true });

      if (itemsError) throw itemsError;

      setSelectedOrder(createdOrder as SupplierOrder);
      setSelectedOrderItems((createdItems as SupplierOrderItem[]) || []);
      setModalMode("view");
    } catch (error) {
      closeModal();
      setError(
        error instanceof Error
          ? error.message
          : "Заказ создан, но открыть его не удалось",
      );
    } finally {
      setSelectedOrderLoading(false);
    }
  }

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "ordered") return "Заказан";
    if (status === "received") return "Поступил";
    if (status === "cancelled") return "Отменён";
    return status;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
{error && <div style={errorStyle}>{error}</div>}

      {activeTab === "orders" && (
        <div style={sectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
                Заказы поставщикам
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                Планируем закупку тканей, расходников и услуг.
              </div>
            </div>

            <button onClick={openCreateOrder} style={primaryButtonStyle}>
              + Новый заказ поставщику
            </button>
          </div>

          {loading ? (
            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Загружаю заказы...
            </div>
          ) : orders.length === 0 ? (
            <div style={emptyStyle}>
              Заказов поставщикам пока нет. Создай первый заказ.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Номер</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Поставщик</th>
                    <th style={thStyle}>Сумма</th>
                    <th style={thStyle}>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={tdStyle}>
                        <button
                          onClick={() => openOrder(order)}
                          style={linkButtonStyle}
                        >
                          {order.order_number || "Без номера"}
                        </button>
                      </td>

                      <td style={tdStyle}>{order.order_date || "—"}</td>

                      <td style={tdStyle}>{order.supplier_name || "—"}</td>

                      <td style={tdStyle}>
                        {Number(order.total_amount || 0).toLocaleString(
                          "ru-RU",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}{" "}
                        ₽
                      </td>

                      <td style={tdStyle}>
                        <span style={statusStyle}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "receipts" && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
            Поступления
          </div>

          <div style={{ color: "#64748b", marginTop: 8 }}>
            Здесь будем фиксировать фактический приход материалов на склад.
          </div>
        </div>
      )}

      {modalMode && (
        <SupplierOrderModal
          mode={modalMode}
          order={selectedOrder}
          orderItems={selectedOrderItems}
          orderLoading={selectedOrderLoading}
          materials={materials}
          consumables={consumables}
          colors={colors}
          counterparties={counterparties}
          directoriesLoading={directoriesLoading}
          onClose={closeModal}
          onSaved={handleOrderSaved}
        />
      )}
    </div>
  );
}




const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 20,
  border: "1px solid #dbe4f0",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
  color: "#ffffff",
  borderRadius: 14,
  padding: "13px 18px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 15,
  boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)",
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 22,
  textAlign: "center",
  color: "#64748b",
};

const statusStyle: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
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

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  padding: 0,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  textDecoration: "underline",
};
