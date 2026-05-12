import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import CustomerOrderModal, {
  type Counterparty,
  type CustomerOrder,
  type CustomerOrderItem,
  type Product,
  type Material,
  type Consumable,
  type Color,
} from "./CustomerOrderModal";

type SalesTab = "orders" | "shipments";
type ModalMode = "create" | "view";

type CustomerShipment = {
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

type Status = {
  id: string;
  code: string;
  name: string;
  color: string | null;
};

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("orders");

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [shipments, setShipments] = useState<CustomerShipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [error, setError] = useState("");

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<CustomerOrderItem[]>([]);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    loadShipments();
    loadDirectories();
  }, []);

  async function loadOrders() {
    try {
      setOrdersLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data as CustomerOrder[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки заказов покупателей");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadShipments() {
    try {
      setShipmentsLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customer_shipments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setShipments((data as CustomerShipment[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки отгрузок");
    } finally {
      setShipmentsLoading(false);
    }
  }

  async function loadDirectories() {
    try {
      setDirectoriesLoading(true);
      setError("");

      const [
        productsResult,
        materialsResult,
        consumablesResult,
        colorsResult,
        counterpartiesResult,
        statusesResult,
      ] = await Promise.all([
        supabase.from("products").select("*").order("name", { ascending: true }),
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
        supabase.from("statuses").select("id, code, name, color, status_categories(code)"),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (consumablesResult.error) throw consumablesResult.error;
      if (colorsResult.error) throw colorsResult.error;
      if (counterpartiesResult.error) throw counterpartiesResult.error;
      if (statusesResult.error) throw statusesResult.error;

      setProducts((productsResult.data as Product[]) || []);
      setMaterials((materialsResult.data as Material[]) || []);
      setConsumables((consumablesResult.data as Consumable[]) || []);
      setColors((colorsResult.data as Color[]) || []);
      setCounterparties((counterpartiesResult.data as Counterparty[]) || []);
      setStatuses((statusesResult.data as Status[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки справочников продаж");
    } finally {
      setDirectoriesLoading(false);
    }
  }

  async function openOrder(order: CustomerOrder) {
    try {
      setSelectedOrder(order);
      setSelectedOrderItems([]);
      setSelectedOrderLoading(true);
      setModalMode("view");
      setError("");

      const { data, error } = await supabase
        .from("customer_order_items")
        .select(
          `
          *,
          products(name, article),
          materials(name, article, color_id),
          consumables(name, article)
        `,
        )
        .eq("customer_order_id", order.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSelectedOrderItems((data as CustomerOrderItem[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки заказа покупателя");
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

  async function handleOrderSaved() {
    closeModal();
    await loadOrders();
  }

  function refreshCurrentTab() {
    if (activeTab === "orders") {
      loadOrders();
      return;
    }

    loadShipments();
  }

  function getStatusName(statusCode: string, statusId?: string | null) {
    const status =
      statuses.find((item) => item.id === statusId) ||
      statuses.find((item) => item.code === statusCode);

    return status?.name || statusCode || "—";
  }

  function getStatusColor(statusCode: string, statusId?: string | null) {
    const status =
      statuses.find((item) => item.id === statusId) ||
      statuses.find((item) => item.code === statusCode);

    return status?.color || "#64748b";
  }

  function renderStatusBadge(statusCode: string, statusId?: string | null) {
    const color = getStatusColor(statusCode, statusId);

    return (
      <span
        style={{
          ...statusBadgeStyle,
          color,
          borderColor: `${color}55`,
          background: `${color}12`,
        }}
      >
        {getStatusName(statusCode, statusId)}
      </span>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            Продажи / Отгрузки
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Заказы покупателей и складские отгрузки.
          </div>
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={refreshCurrentTab} style={secondaryButtonStyle}>
            Обновить
          </button>

          {activeTab === "orders" ? (
            <button type="button" onClick={openCreateOrder} style={primaryButtonStyle}>
              + Новый заказ покупателя
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.alert("Создание отгрузки добавим следующим шагом.")}
              style={primaryButtonStyle}
            >
              + Новая отгрузка
            </button>
          )}
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={tabsWrapStyle}>
        <button type="button" onClick={() => setActiveTab("orders")} style={tabButtonStyle(activeTab === "orders")}>
          📄 Заказы покупателей
        </button>

        <button type="button" onClick={() => setActiveTab("shipments")} style={tabButtonStyle(activeTab === "shipments")}>
          🚚 Отгрузки
        </button>
      </div>

      {activeTab === "orders" && (
        <>
          {ordersLoading ? (
            <div style={emptyStyle}>Загружаю заказы покупателей...</div>
          ) : orders.length === 0 ? (
            <div style={emptyStyle}>Заказов покупателей пока нет. Создай первый заказ.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Номер</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Покупатель</th>
                    <th style={thStyle}>Сумма</th>
                    <th style={thStyle}>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={tdStyle}>
                        <button type="button" onClick={() => openOrder(order)} style={linkButtonStyle}>
                          {order.order_number || "Без номера"}
                        </button>
                      </td>
                      <td style={tdStyle}>{order.order_date || "—"}</td>
                      <td style={tdStyle}>{order.customer_name || "—"}</td>
                      <td style={tdStyle}>
                        {Number(order.total_amount || 0).toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </td>
                      <td style={tdStyle}>{renderStatusBadge(order.status, order.status_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "shipments" && (
        <>
          {shipmentsLoading ? (
            <div style={emptyStyle}>Загружаю отгрузки...</div>
          ) : shipments.length === 0 ? (
            <div style={emptyStyle}>Отгрузок пока нет. Следующим шагом добавим создание из заказа покупателя.</div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Номер</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Покупатель</th>
                    <th style={thStyle}>Сумма</th>
                    <th style={thStyle}>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => window.alert("Карточку отгрузки добавим следующим шагом.")}
                          style={linkButtonStyle}
                        >
                          {shipment.shipment_number || "Черновик отгрузки"}
                        </button>
                      </td>
                      <td style={tdStyle}>{shipment.shipment_date || "—"}</td>
                      <td style={tdStyle}>{shipment.customer_name || "—"}</td>
                      <td style={tdStyle}>
                        {Number(shipment.total_amount || 0).toLocaleString("ru-RU", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ₽
                      </td>
                      <td style={tdStyle}>{renderStatusBadge(shipment.status, shipment.status_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalMode && (
        <CustomerOrderModal
          mode={modalMode}
          order={selectedOrder}
          orderItems={selectedOrderItems}
          orderLoading={selectedOrderLoading}
          products={products}
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

const sectionStyle: React.CSSProperties = { background: "#ffffff", borderRadius: 20, padding: 20, border: "1px solid #dbe4f0", display: "flex", flexDirection: "column", gap: 16 };
const sectionHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const actionsStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" };
const tabsWrapStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap" };

function tabButtonStyle(active: boolean): React.CSSProperties {
  return { border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0", background: active ? "#eff6ff" : "#ffffff", color: active ? "#1d4ed8" : "#475569", borderRadius: 14, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 14 };
}

const primaryButtonStyle: React.CSSProperties = { border: "none", background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)", color: "#ffffff", borderRadius: 14, padding: "12px 16px", cursor: "pointer", fontWeight: 900, fontSize: 14, boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 14, padding: "12px 16px", cursor: "pointer", fontWeight: 900, fontSize: 14 };
const errorStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 700 };
const emptyStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: 16, padding: 24, textAlign: "center", color: "#64748b", fontWeight: 700 };
const tableWrapStyle: React.CSSProperties = { width: "100%", overflowX: "auto", border: "1px solid #dbe4f0", borderRadius: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "#ffffff", minWidth: 760 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "14px 12px", background: "#f8fafc", color: "#334155", fontSize: 14, fontWeight: 900, borderBottom: "1px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "13px 12px", color: "#334155", borderBottom: "1px solid #eef2f7", fontSize: 14, verticalAlign: "middle" };
const linkButtonStyle: React.CSSProperties = { border: "none", background: "transparent", color: "#2563eb", padding: 0, cursor: "pointer", fontWeight: 900, fontSize: 14, textDecoration: "underline" };
const statusBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", width: "fit-content", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "5px 10px", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" };
