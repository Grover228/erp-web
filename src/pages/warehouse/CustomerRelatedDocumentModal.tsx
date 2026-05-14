import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import CustomerShipmentModal, { type CustomerShipment, type CustomerShipmentItem } from "./CustomerShipmentModal";
import CustomerInvoiceModal, { type CustomerInvoice } from "./CustomerInvoiceModal";
import CustomerPaymentModal, { type CustomerPayment } from "./CustomerPaymentModal";
import type { CustomerOrder, CustomerOrderItem } from "./CustomerOrderModal";

type CustomerRelatedDocumentModalProps = {
  order: CustomerOrder;
  orderItems: CustomerOrderItem[];
  onClose: () => void;
  onCreatedDocument?: (type: "customer_shipment" | "customer_invoice" | "incoming_payment", id: string) => void;
};

type RelatedDocumentType =
  | "shipment"
  | "customer_invoice"
  | "incoming_payment"
  | "production_order"
  | "supplier_order";

type FinanceAccount = {
  id: string;
  name: string;
  currency?: string | null;
  current_balance?: number | string | null;
};


export default function CustomerRelatedDocumentModal({
  order,
  orderItems,
  onClose,
  onCreatedDocument,
}: CustomerRelatedDocumentModalProps) {
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [createdShipment, setCreatedShipment] = useState<CustomerShipment | null>(null);
  const [createdShipmentItems, setCreatedShipmentItems] = useState<CustomerShipmentItem[]>([]);
  const [createdInvoice, setCreatedInvoice] = useState<CustomerInvoice | null>(null);
  const [createdPayment, setCreatedPayment] = useState<CustomerPayment | null>(null);
  const [creatingFinanceDocument, setCreatingFinanceDocument] = useState(false);
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [selectedFinanceAccountId, setSelectedFinanceAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(String(Number(order.total_amount || 0)));
  const [paymentComment, setPaymentComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadFinanceAccounts();
  }, []);

  async function loadFinanceAccounts() {
    try {
      const { data, error } = await supabase
        .from("finance_accounts")
        .select("id, name, currency, current_balance")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const accounts = (data as FinanceAccount[]) || [];
      setFinanceAccounts(accounts);
      setSelectedFinanceAccountId((prev) => prev || accounts[0]?.id || "");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки финансовых счетов");
    }
  }

  function formatMoney(value: number | string | null | undefined) {
    return `${Number(value || 0).toLocaleString("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ₽`;
  }

  async function createShipmentFromOrder() {
    try {
      setCreatingShipment(true);
      setError("");

      if (orderItems.length === 0) {
        throw new Error("В заказе нет позиций для отгрузки");
      }

      const { data: draftStatus } = await supabase
        .from("statuses")
        .select("id, code, status_categories(code)")
        .eq("code", "draft")
        .eq("status_categories.code", "customer_shipments")
        .maybeSingle();

      const { data: shipment, error: shipmentError } = await supabase
        .from("customer_shipments")
        .insert({
          shipment_date: new Date().toISOString().slice(0, 10),
          customer_order_id: order.id,
          customer_id: order.customer_id || null,
          customer_name: order.customer_name || null,
          status: "draft",
          status_id: draftStatus?.id || null,
          total_amount: order.total_amount || 0,
          comment: `Создана из заказа покупателя ${order.order_number || order.id}`,
        })
        .select("*")
        .single();

      if (shipmentError) throw shipmentError;

      const { data: savedItems, error: itemsError } = await supabase
        .from("customer_shipment_items")
        .insert(
          orderItems.map((item) => ({
            customer_shipment_id: shipment.id,
            item_type: item.item_type,
            product_id: item.product_id,
            material_id: item.material_id,
            consumable_id: item.consumable_id,
            quantity: item.quantity,
            price: item.price,
          })),
        )
        .select("id, customer_shipment_id, item_type, product_id, material_id, consumable_id, quantity, price, amount");

      if (itemsError) throw itemsError;

      const enrichedItems = ((savedItems as CustomerShipmentItem[]) || []).map((savedItem) => {
        const sourceItem = orderItems.find((orderItem) => {
          if (orderItem.item_type !== savedItem.item_type) return false;
          if (savedItem.item_type === "product") return orderItem.product_id === savedItem.product_id;
          if (savedItem.item_type === "material") return orderItem.material_id === savedItem.material_id;
          if (savedItem.item_type === "consumable") return orderItem.consumable_id === savedItem.consumable_id;
          return false;
        });

        return {
          ...savedItem,
          products: sourceItem?.products || null,
          materials: sourceItem?.materials || null,
          consumables: sourceItem?.consumables || null,
        };
      });

      setCreatedShipment(shipment as CustomerShipment);
      setCreatedShipmentItems(enrichedItems);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка создания отгрузки",
      );
    } finally {
      setCreatingShipment(false);
    }
  }

  
  async function createInvoiceFromOrder() {
    try {
      setCreatingFinanceDocument(true);
      setError("");

      const { data: draftStatus } = await supabase
        .from("statuses")
        .select("id, code, status_categories(code)")
        .eq("code", "draft")
        .eq("status_categories.code", "customer_invoices")
        .maybeSingle();

      const { data: invoice, error: invoiceError } = await supabase
        .from("customer_invoices")
        .insert({
          invoice_date: new Date().toISOString().slice(0, 10),
          customer_order_id: order.id,
          customer_id: order.customer_id || null,
          customer_name: order.customer_name || null,
          status: "draft",
          status_id: draftStatus?.id || null,
          total_amount: order.total_amount || 0,
          paid_amount: 0,
          comment: `Создан из заказа покупателя ${order.order_number || order.id}`,
        })
        .select("*")
        .single();

      if (invoiceError) throw invoiceError;

      setCreatedInvoice(invoice as CustomerInvoice);
      onCreatedDocument?.("customer_invoice", invoice.id);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка создания счёта",
      );
    } finally {
      setCreatingFinanceDocument(false);
    }
  }

  async function createPaymentFromOrder() {
    try {
      setCreatingFinanceDocument(true);
      setError("");

      const amount = Number(paymentAmount || 0);

      if (!selectedFinanceAccountId) {
        throw new Error("Выбери счёт поступления денег");
      }

      if (amount <= 0) {
        throw new Error("Сумма оплаты должна быть больше 0");
      }

      const account = financeAccounts.find(
        (item) => item.id === selectedFinanceAccountId,
      );

      if (!account) {
        throw new Error("Финансовый счёт не найден");
      }

      const { data: postedStatus } = await supabase
        .from("statuses")
        .select("id, code, status_categories(code)")
        .eq("code", "posted")
        .eq("status_categories.code", "customer_payments")
        .maybeSingle();

      const now = new Date().toISOString();

      const { data: payment, error: paymentError } = await supabase
        .from("customer_payments")
        .insert({
          payment_date: now.slice(0, 10),
          customer_order_id: order.id,
          customer_invoice_id: null,
          customer_id: order.customer_id || null,
          customer_name: order.customer_name || null,
          finance_account_id: selectedFinanceAccountId,
          status: "posted",
          status_id: postedStatus?.id || null,
          amount,
          comment:
            paymentComment.trim() ||
            `Оплата по заказу покупателя ${order.order_number || order.id}`,
        })
        .select("*")
        .single();

      if (paymentError) throw paymentError;

      const { data: transaction, error: transactionError } = await supabase
        .from("finance_transactions")
        .insert({
          account_id: selectedFinanceAccountId,
          type: "income",
          amount,
          operation_date: now.slice(0, 10),
          description: `Оплата покупателя по заказу ${order.order_number || ""}`.trim(),
          source_document_type: "customer_payment",
          source_document_id: payment.id,
          category: "customer_payment",
          counterparty_id: order.customer_id || null,
          comment: paymentComment.trim() || null,
          created_at: now,
        })
        .select("id")
        .single();

      if (transactionError) throw transactionError;

      const { error: updatePaymentError } = await supabase
        .from("customer_payments")
        .update({
          finance_transaction_id: transaction.id,
        })
        .eq("id", payment.id);

      if (updatePaymentError) throw updatePaymentError;

      const { error: accountError } = await supabase
        .from("finance_accounts")
        .update({
          current_balance: Number(account.current_balance || 0) + amount,
          updated_at: now,
        })
        .eq("id", selectedFinanceAccountId);

      if (accountError) throw accountError;

      setCreatedPayment({
        ...(payment as CustomerPayment),
        finance_transaction_id: transaction.id,
        finance_account_id: selectedFinanceAccountId,
      } as CustomerPayment);
      onCreatedDocument?.("incoming_payment", payment.id);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка создания платежа",
      );
    } finally {
      setCreatingFinanceDocument(false);
    }
  }

function handleCreateDocument(type: RelatedDocumentType) {
    const orderNumber = order.order_number || order.id;

    if (type === "shipment") {
      createShipmentFromOrder();
      return;
    }

    if (type === "customer_invoice") {
      createInvoiceFromOrder();
      return;
    }

    if (type === "incoming_payment") {
      createPaymentFromOrder();
      return;
    }

    if (type === "production_order") {
      window.alert(`Производственное задание по заказу ${orderNumber} подключим через техкарты.`);
      return;
    }

    if (type === "supplier_order") {
      window.alert(`Заказ поставщику по заказу ${orderNumber} подключим через закупки.`);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={headerStyle}>
          <div>
            <div style={titleStyle}>Создать связанный документ</div>
            <div style={subtitleStyle}>
              Заказ {order.order_number || "Без номера"} · Покупатель:{" "}
              {order.customer_name || "не указан"}
            </div>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={contentStyle}>
          <div style={documentTypesStyle}>
            <button
              type="button"
              onClick={() => handleCreateDocument("shipment")}
              style={documentTypeButtonStyle(true)}
            >
              <span style={documentIconStyle}>🚚</span>
              <span>
                <span style={documentTitleStyle}>Отгрузка</span>
                <span style={documentTextStyle}>
                  Списать товары со склада и передать покупателю
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument("customer_invoice")}
              style={documentTypeButtonStyle(false)}
            >
              <span style={documentIconStyle}>🧾</span>
              <span>
                <span style={documentTitleStyle}>Счёт покупателю</span>
                <span style={documentTextStyle}>
                  Выставить счёт на оплату по заказу
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument("incoming_payment")}
              style={documentTypeButtonStyle(false)}
            >
              <span style={documentIconStyle}>💳</span>
              <span>
                <span style={documentTitleStyle}>Входящий платёж</span>
                <span style={documentTextStyle}>
                  Зафиксировать оплату от покупателя
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument("production_order")}
              style={documentTypeButtonStyle(false)}
            >
              <span style={documentIconStyle}>🏭</span>
              <span>
                <span style={documentTitleStyle}>Производственное задание</span>
                <span style={documentTextStyle}>
                  Создать выпуск продукции через техкарты
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument("supplier_order")}
              style={documentTypeButtonStyle(false)}
            >
              <span style={documentIconStyle}>📄</span>
              <span>
                <span style={documentTitleStyle}>Заказ поставщику</span>
                <span style={documentTextStyle}>
                  Докупить товар, материал или расходник под заказ покупателя
                </span>
              </span>
            </button>
          </div>

          <div style={previewStyle}>
            <div style={previewHeaderStyle}>
              <span style={previewIconStyle}>🚚</span>
              <div>
                <div style={previewTitleStyle}>Отгрузка</div>
                <div style={previewSubTitleStyle}>
                  Первый документ, который будем подключать функционально
                </div>
              </div>
            </div>

            <div style={previewDescriptionStyle}>
              Отгрузка будет создаваться на основании позиций заказа покупателя.
              При проведении она спишет остатки со склада и закроет резерв.
            </div>

            <div style={statsGridStyle}>
              <div style={statCardStyle}>
                <div style={statLabelStyle}>Заказ</div>
                <div style={statValueStyle}>{order.order_number || "—"}</div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Дата заказа</div>
                <div style={statValueStyle}>{order.order_date || "—"}</div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Сумма</div>
                <div style={statValueStyle}>
                  {Number(order.total_amount || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₽
                </div>
              </div>

              <div style={statCardStyle}>
                <div style={statLabelStyle}>Позиций</div>
                <div style={statValueStyle}>{orderItems.length}</div>
              </div>
            </div>

            <div style={paymentSettingsStyle}>
              <div style={positionsTitleStyle}>Параметры входящего платежа</div>
              <div style={paymentGridStyle}>
                <label style={paymentLabelStyle}>
                  <span>Счёт поступления</span>
                  <select
                    value={selectedFinanceAccountId}
                    onChange={(event) => setSelectedFinanceAccountId(event.target.value)}
                    style={paymentInputStyle}
                  >
                    <option value="">Выбери счёт</option>
                    {financeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {formatMoney(account.current_balance || 0)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={paymentLabelStyle}>
                  <span>Сумма оплаты</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(event) => setPaymentAmount(event.target.value)}
                    style={paymentInputStyle}
                  />
                </label>
              </div>

              <label style={paymentLabelStyle}>
                <span>Комментарий к оплате</span>
                <input
                  value={paymentComment}
                  onChange={(event) => setPaymentComment(event.target.value)}
                  placeholder="Необязательно"
                  style={paymentInputStyle}
                />
              </label>
            </div>

            <div style={positionsTitleStyle}>Что попадёт в документ</div>

            <div style={positionsListStyle}>
              {orderItems.length === 0 ? (
                <div style={emptyStyle}>В заказе нет позиций.</div>
              ) : (
                orderItems.map((item) => (
                  <div key={item.id} style={positionRowStyle}>
                    <span>{getItemName(item)}</span>
                    <strong>{item.quantity}</strong>
                  </div>
                ))
              )}
            </div>

            <div style={footerActionsStyle}>
              <button type="button" onClick={onClose} style={cancelButtonStyle}>
                Отмена
              </button>

              <button
                type="button"
                onClick={() => handleCreateDocument("incoming_payment")}
                style={financeButtonStyle}
              >
                {creatingFinanceDocument ? "Создаю..." : "Создать оплату"}
              </button>

              <button
                type="button"
                onClick={() => handleCreateDocument("shipment")}
                style={createButtonStyle}
              >
                {creatingShipment ? "Создаю..." : "Создать отгрузку"}
              </button>
            </div>
          </div>
        </div>

        {createdShipment && (
          <CustomerShipmentModal
            shipment={createdShipment}
            shipmentItems={createdShipmentItems}
            onClose={() => {
              setCreatedShipment(null);
              onClose();
            }}
          />
        )}

        {createdInvoice && (
          <CustomerInvoiceModal
            invoice={createdInvoice}
            onClose={() => {
              setCreatedInvoice(null);
              onClose();
            }}
          />
        )}

        {createdPayment && (
          <CustomerPaymentModal
            payment={createdPayment}
            onClose={() => {
              setCreatedPayment(null);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

function getItemName(item: CustomerOrderItem) {
  if (item.item_type === "material") {
    return item.materials?.name || "Материал";
  }

  if (item.item_type === "consumable") {
    return item.consumables?.name || "Расходник";
  }

  return item.products?.name || "Товар";
}

const paymentSettingsStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
};

const paymentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 10,
};

const paymentLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const paymentInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 11px",
  background: "#ffffff",
  color: "#0f172a",
};

const financeButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#15803d",
  borderRadius: 12,
  padding: "12px 16px",
  cursor: "pointer",
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

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10030,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1080px, 96vw)",
  maxHeight: "84vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 20,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 18,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 6,
  fontSize: 16,
};

const closeButtonStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 26,
  fontWeight: 800,
  color: "#0f172a",
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: 18,
};

const documentTypesStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
};

function documentTypeButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: "#0f172a",
    borderRadius: 14,
    padding: 14,
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 12,
    alignItems: "start",
    textAlign: "left",
  };
}

const documentIconStyle: React.CSSProperties = {
  fontSize: 22,
  lineHeight: 1.2,
};

const documentTitleStyle: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const documentTextStyle: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.35,
  marginTop: 4,
  fontWeight: 700,
};

const previewStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 14,
};

const previewHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "46px 1fr",
  gap: 14,
  alignItems: "center",
};

const previewIconStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const previewTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const previewSubTitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 3,
};

const previewDescriptionStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 14,
  padding: 13,
  color: "#475569",
  lineHeight: 1.5,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const statCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 12,
  padding: 12,
};

const statLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const statValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 17,
  fontWeight: 900,
  marginTop: 6,
};

const positionsTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
};

const positionsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const positionRowStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 12,
  padding: "11px 13px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#334155",
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 12,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
};

const footerActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
};

const createButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 12,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
};
