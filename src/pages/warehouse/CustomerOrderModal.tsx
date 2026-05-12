import { useEffect, useState } from "react";
import { supabase } from "../../supabase";

export type SalesItemType = "product" | "material" | "consumable";

export type CustomerOrder = {
  id: string;
  order_number: string | null;
  order_date: string;
  customer_id: string | null;
  customer_name: string | null;
  status: string;
  status_id: string | null;
  comment: string | null;
  total_amount: number;
  created_at: string | null;
};

export type CustomerOrderItem = {
  id: string;
  customer_order_id: string;
  item_type: SalesItemType;
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

export type Product = {
  id: string;
  name: string;
  article: string | null;
  default_price?: number | null;
  price?: number | null;
  sale_price?: number | null;
};

export type Material = {
  id: string;
  name: string;
  article: string | null;
  default_price?: number | null;
};

export type Consumable = {
  id: string;
  name: string;
  article: string | null;
  default_price?: number | null;
};

export type Counterparty = {
  id: string;
  name: string;
  type: string | null;
};

type Status = {
  id: string;
  code: string;
  name: string;
  color: string | null;
};

type StockAvailability = {
  item_type: SalesItemType;
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
};

type CustomerOrderItemDraft = {
  id: string;
  item_type: SalesItemType;
  product_id: string;
  material_id: string;
  consumable_id: string;
  quantity: string;
  price: string;
};

type CustomerOrderModalProps = {
  mode: "create" | "view";
  order: CustomerOrder | null;
  orderItems: CustomerOrderItem[];
  orderLoading: boolean;
  products: Product[];
  materials?: Material[];
  consumables?: Consumable[];
  counterparties: Counterparty[];
  directoriesLoading: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const emptyItem = (): CustomerOrderItemDraft => ({
  id: crypto.randomUUID(),
  item_type: "product",
  product_id: "",
  material_id: "",
  consumable_id: "",
  quantity: "1",
  price: "",
});

function itemToDraft(item: CustomerOrderItem): CustomerOrderItemDraft {
  return {
    id: item.id || crypto.randomUUID(),
    item_type: item.item_type || "product",
    product_id: item.product_id || "",
    material_id: item.material_id || "",
    consumable_id: item.consumable_id || "",
    quantity: String(item.quantity ?? 0),
    price: String(item.price ?? 0),
  };
}

export default function CustomerOrderModal({
  mode,
  order,
  orderItems,
  orderLoading,
  products,
  materials = [],
  consumables = [],
  counterparties,
  directoriesLoading,
  onClose,
  onSaved,
}: CustomerOrderModalProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [error, setError] = useState("");

  const [statuses, setStatuses] = useState<Status[]>([]);
  const [stockAvailability, setStockAvailability] = useState<StockAvailability[]>([]);
  const [stockLoading, setStockLoading] = useState(false);

  const [orderDate, setOrderDate] = useState(
    order?.order_date || new Date().toISOString().slice(0, 10),
  );
  const [customerId, setCustomerId] = useState(order?.customer_id || "");
  const [customerSearch, setCustomerSearch] = useState(order?.customer_name || "");
  const [isCustomerPickerOpen, setIsCustomerPickerOpen] = useState(false);
  const [customerPickerSearch, setCustomerPickerSearch] = useState("");
  const [customerPickerType, setCustomerPickerType] = useState("all");

  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productPickerItemId, setProductPickerItemId] = useState("");
  const [productPickerType, setProductPickerType] = useState<SalesItemType>("product");
  const [productPickerSearch, setProductPickerSearch] = useState("");

  const [comment, setComment] = useState(order?.comment || "");
  const [items, setItems] = useState<CustomerOrderItemDraft[]>([emptyItem()]);

  useEffect(() => {
    loadStatuses();
    loadStockAvailability();
  }, []);

  useEffect(() => {
    if (mode === "create") {
      resetForm();
      setIsEditingOrder(false);
    }
  }, [mode]);

  async function loadStatuses() {
    try {
      const { data, error } = await supabase
        .from("statuses")
        .select("id, code, name, color, status_categories(code)");

      if (error) throw error;
      setStatuses((data as Status[]) || []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки статусов");
    }
  }

  async function loadStockAvailability() {
    try {
      setStockLoading(true);

      const { data, error } = await supabase
        .from("stock_available")
        .select("item_type, product_id, material_id, consumable_id, quantity_on_hand, quantity_reserved, quantity_available");

      if (error) throw error;

      setStockAvailability((data as StockAvailability[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки складских остатков",
      );
    } finally {
      setStockLoading(false);
    }
  }

  function resetForm() {
    setOrderDate(new Date().toISOString().slice(0, 10));
    setCustomerId("");
    setCustomerSearch("");
    setCustomerPickerSearch("");
    setCustomerPickerType("all");
    setIsProductPickerOpen(false);
    setProductPickerItemId("");
    setProductPickerType("product");
    setProductPickerSearch("");
    setComment("");
    setItems([emptyItem()]);
    setError("");
  }

  function fillFormFromOrder(sourceOrder: CustomerOrder, sourceItems: CustomerOrderItem[]) {
    setOrderDate(sourceOrder.order_date || new Date().toISOString().slice(0, 10));
    setCustomerId(sourceOrder.customer_id || "");
    setCustomerSearch(sourceOrder.customer_name || "");
    setComment(sourceOrder.comment || "");
    setItems(sourceItems.length > 0 ? sourceItems.map(itemToDraft) : [emptyItem()]);
    setError("");
  }

  function startEditOrder() {
    if (!order) return;
    fillFormFromOrder(order, orderItems);
    setIsEditingOrder(true);
  }

  function cancelEditOrder() {
    setIsEditingOrder(false);
    setError("");
  }

  function getAvailableCustomers() {
    const customers = counterparties.filter(
      (counterparty) =>
        !counterparty.type ||
        counterparty.type === "customer" ||
        counterparty.type === "client" ||
        counterparty.type === "покупатель" ||
        counterparty.type === "клиент",
    );

    return customers.length > 0 ? customers : counterparties;
  }

  function getCustomerTypes() {
    return Array.from(
      new Set(
        getAvailableCustomers()
          .map((counterparty) => counterparty.type)
          .filter(Boolean) as string[],
      ),
    );
  }

  function getFilteredCustomers() {
    const query = customerPickerSearch.trim().toLowerCase();

    return getAvailableCustomers().filter((counterparty) => {
      const matchesSearch =
        !query ||
        counterparty.name.toLowerCase().includes(query) ||
        (counterparty.type || "").toLowerCase().includes(query);

      const matchesType =
        customerPickerType === "all" ||
        !counterparty.type ||
        counterparty.type === customerPickerType;

      return matchesSearch && matchesType;
    });
  }

  function selectCustomer(counterparty: Counterparty) {
    setCustomerId(counterparty.id);
    setCustomerSearch(counterparty.name);
    setIsCustomerPickerOpen(false);
  }

  function getSelectedCustomerName() {
    if (!customerId) return customerSearch.trim();
    return (
      counterparties.find((counterparty) => counterparty.id === customerId)?.name ||
      customerSearch.trim()
    );
  }

  function getAnyItemPrice(item: Product | Material | Consumable | undefined | null) {
    if (!item) return "";

    if ("sale_price" in item && item.sale_price !== null && item.sale_price !== undefined) {
      return String(item.sale_price);
    }

    if (item.default_price !== null && item.default_price !== undefined) {
      return String(item.default_price);
    }

    if ("price" in item && item.price !== null && item.price !== undefined) {
      return String(item.price);
    }

    return "";
  }

  function getProductPrice(product: Product | undefined | null) {
    return getAnyItemPrice(product);
  }

  function getItemTypeLabel(itemType: SalesItemType | string | null | undefined) {
    if (itemType === "product") return "Готовая продукция / товар";
    if (itemType === "material") return "Материал";
    if (itemType === "consumable") return "Расходник";
    return "Товар";
  }

  function updateItem(id: string, patch: Partial<CustomerOrderItemDraft>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }

  function getItemAmount(item: CustomerOrderItemDraft) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return quantity * price;
  }

  function getTotalAmount() {
    return items.reduce((sum, item) => sum + getItemAmount(item), 0);
  }

  function getDraftItemSelectedId(item: CustomerOrderItemDraft) {
    if (item.item_type === "material") return item.material_id;
    if (item.item_type === "consumable") return item.consumable_id;
    return item.product_id;
  }

  function prepareItemsForSave() {
    return items
      .filter((item) => getDraftItemSelectedId(item) && Number(item.quantity) > 0)
      .map((item) => ({
        item_type: item.item_type,
        product_id: item.item_type === "product" ? item.product_id : null,
        material_id: item.item_type === "material" ? item.material_id : null,
        consumable_id: item.item_type === "consumable" ? item.consumable_id : null,
        quantity: Number(item.quantity),
        price: Number(item.price) || 0,
      }));
  }

  function getSelectedDraftProductName(item: CustomerOrderItemDraft) {
    if (item.item_type === "material") {
      return materials.find((material) => material.id === item.material_id)?.name || "";
    }

    if (item.item_type === "consumable") {
      return consumables.find((consumable) => consumable.id === item.consumable_id)?.name || "";
    }

    return products.find((product) => product.id === item.product_id)?.name || "";
  }

  function getSelectedDraftProductArticle(item: CustomerOrderItemDraft) {
    if (item.item_type === "material") {
      return materials.find((material) => material.id === item.material_id)?.article || "";
    }

    if (item.item_type === "consumable") {
      return consumables.find((consumable) => consumable.id === item.consumable_id)?.article || "";
    }

    return products.find((product) => product.id === item.product_id)?.article || "";
  }

  function getProductName(item: CustomerOrderItem) {
    if (item.item_type === "material") return item.materials?.name || "Материал";
    if (item.item_type === "consumable") return item.consumables?.name || "Расходник";
    return item.products?.name || "Товар";
  }

  function getProductArticle(item: CustomerOrderItem) {
    if (item.item_type === "material") return item.materials?.article || "";
    if (item.item_type === "consumable") return item.consumables?.article || "";
    return item.products?.article || "";
  }

  function getStockAvailabilityForDraftItem(item: CustomerOrderItemDraft) {
    const selectedId = getDraftItemSelectedId(item);

    if (!selectedId) return null;

    return (
      stockAvailability.find((stock) => {
        if (stock.item_type !== item.item_type) return false;
        if (item.item_type === "product") return stock.product_id === selectedId;
        if (item.item_type === "material") return stock.material_id === selectedId;
        if (item.item_type === "consumable") return stock.consumable_id === selectedId;
        return false;
      }) || null
    );
  }

  function getStockAvailabilityForPickerItem(itemType: SalesItemType, itemId: string) {
    return (
      stockAvailability.find((stock) => {
        if (stock.item_type !== itemType) return false;
        if (itemType === "product") return stock.product_id === itemId;
        if (itemType === "material") return stock.material_id === itemId;
        if (itemType === "consumable") return stock.consumable_id === itemId;
        return false;
      }) || null
    );
  }

  function getCurrentOrderQuantityForDraftItem(item: CustomerOrderItemDraft) {
    if (!order) return 0;

    return orderItems
      .filter((sourceItem) => {
        if (sourceItem.id === item.id) return true;
        if (sourceItem.item_type !== item.item_type) return false;
        if (item.item_type === "product") return sourceItem.product_id === item.product_id;
        if (item.item_type === "material") return sourceItem.material_id === item.material_id;
        if (item.item_type === "consumable") return sourceItem.consumable_id === item.consumable_id;
        return false;
      })
      .reduce((sum, sourceItem) => sum + Number(sourceItem.quantity || 0), 0);
  }

  function getAvailableQuantity(item: CustomerOrderItemDraft) {
    return (
      Number(getStockAvailabilityForDraftItem(item)?.quantity_available || 0) +
      getCurrentOrderQuantityForDraftItem(item)
    );
  }

  function getOnHandQuantity(item: CustomerOrderItemDraft) {
    return Number(getStockAvailabilityForDraftItem(item)?.quantity_on_hand || 0);
  }

  function getReservedQuantity(item: CustomerOrderItemDraft) {
    return Number(getStockAvailabilityForDraftItem(item)?.quantity_reserved || 0);
  }

  function isItemQuantityAboveAvailable(item: CustomerOrderItemDraft) {
    const selectedId = getDraftItemSelectedId(item);

    if (!selectedId) return false;

    return Number(item.quantity || 0) > getAvailableQuantity(item);
  }

  function getStockWarnings() {
    return items
      .filter(isItemQuantityAboveAvailable)
      .map((item) => {
        const name = getSelectedDraftProductName(item) || getItemTypeLabel(item.item_type);
        const requested = Number(item.quantity || 0);
        const available = getAvailableQuantity(item);

        return `${name}: нужно ${requested}, доступно ${available}`;
      });
  }

  function hasStockProblems() {
    return getStockWarnings().length > 0;
  }

  function getStockWarningText() {
    const warnings = getStockWarnings();

    if (warnings.length === 0) return "";

    return `Недостаточно остатка на складе: ${warnings.join("; ")}`;
  }

  function openLinkedDocumentsStub() {
    window.alert("Связанные документы по заказу покупателя подключим следующим шагом.");
  }

  function openPaymentStub() {
    window.alert("Связь с финансами: счёт, входящий платёж и задолженность подключим следующим этапом.");
  }

  function openProductionStub() {
    window.alert("Связь с производством: потребность, техкарта и производственное задание подключим после складских документов.");
  }

  function openProductPicker(itemId: string) {
    const currentItem = items.find((item) => item.id === itemId);

    setProductPickerItemId(itemId);
    setProductPickerType(currentItem?.item_type || "product");
    setProductPickerSearch("");
    setIsProductPickerOpen(true);
  }

  function getFilteredProducts() {
    const query = productPickerSearch.trim().toLowerCase();

    const list =
      productPickerType === "material"
        ? materials
        : productPickerType === "consumable"
          ? consumables
          : products;

    return list.filter(
      (item) =>
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.article || "").toLowerCase().includes(query),
    );
  }

  function selectProduct(itemId: string) {
    if (!productPickerItemId) return;

    if (productPickerType === "material") {
      const material = materials.find((item) => item.id === itemId);

      updateItem(productPickerItemId, {
        item_type: "material",
        product_id: "",
        material_id: itemId,
        consumable_id: "",
        price: getAnyItemPrice(material),
      });
    } else if (productPickerType === "consumable") {
      const consumable = consumables.find((item) => item.id === itemId);

      updateItem(productPickerItemId, {
        item_type: "consumable",
        product_id: "",
        material_id: "",
        consumable_id: itemId,
        price: getAnyItemPrice(consumable),
      });
    } else {
      const product = products.find((item) => item.id === itemId);

      updateItem(productPickerItemId, {
        item_type: "product",
        product_id: itemId,
        material_id: "",
        consumable_id: "",
        price: getAnyItemPrice(product),
      });
    }

    setIsProductPickerOpen(false);
    setProductPickerItemId("");
  }

  async function createStockReservations(customerOrderId: string, savedItems: CustomerOrderItem[]) {
    const reservations = savedItems.map((item) => ({
      source_document_type: "customer_order",
      source_document_id: customerOrderId,
      source_document_item_id: item.id,
      item_type: item.item_type,
      product_id: item.product_id,
      material_id: item.material_id,
      consumable_id: item.consumable_id,
      quantity: item.quantity,
      status: "active",
      updated_at: new Date().toISOString(),
    }));

    if (reservations.length === 0) return;

    const { error } = await supabase.from("stock_reservations").insert(reservations);

    if (error) throw error;
  }

  async function replaceStockReservations(customerOrderId: string, savedItems: CustomerOrderItem[]) {
    const { error: deleteReservationsError } = await supabase
      .from("stock_reservations")
      .delete()
      .eq("source_document_type", "customer_order")
      .eq("source_document_id", customerOrderId);

    if (deleteReservationsError) throw deleteReservationsError;

    await createStockReservations(customerOrderId, savedItems);
  }

  function getStatusByCode(statusCode: string) {
    return statuses.find((item) => item.code === statusCode) || null;
  }

  function getOrderStatus() {
    if (!order) return getStatusByCode("draft");
    return (
      statuses.find((status) => status.id === order.status_id) ||
      statuses.find((status) => status.code === order.status) ||
      null
    );
  }

  function renderStatusBadge(statusCode: string, statusId?: string | null) {
    const status =
      statuses.find((item) => item.id === statusId) ||
      statuses.find((item) => item.code === statusCode);

    const color = status?.color || "#2563eb";

    return (
      <span
        style={{
          ...statusBadgeStyle,
          color,
          borderColor: `${color}55`,
          background: `${color}12`,
        }}
      >
        {status?.name || statusCode || "—"}
      </span>
    );
  }

  async function createCustomerOrder() {
    try {
      setSaving(true);
      setError("");

      const preparedItems = prepareItemsForSave();
      if (preparedItems.length === 0) throw new Error("Добавь хотя бы одну позицию заказа");
      if (hasStockProblems()) throw new Error(getStockWarningText());

      const selectedCustomerName = getSelectedCustomerName();
      const draftStatus = getStatusByCode("draft");

      const { data: createdOrder, error: orderError } = await supabase
        .from("customer_orders")
        .insert({
          order_date: orderDate,
          customer_id: customerId || null,
          customer_name: selectedCustomerName || null,
          status: "draft",
          status_id: draftStatus?.id || null,
          comment: comment.trim() || null,
          total_amount: getTotalAmount(),
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { data: savedItems, error: itemsError } = await supabase
        .from("customer_order_items")
        .insert(
          preparedItems.map((item) => ({
            ...item,
            customer_order_id: createdOrder.id,
          })),
        )
        .select("id, customer_order_id, item_type, product_id, material_id, consumable_id, quantity, price, amount");

      if (itemsError) throw itemsError;

      await createStockReservations(createdOrder.id, (savedItems as CustomerOrderItem[]) || []);
      await loadStockAvailability();
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка создания заказа покупателя");
    } finally {
      setSaving(false);
    }
  }

  async function saveOrderChanges() {
    if (!order) return;

    try {
      setSaving(true);
      setError("");

      const preparedItems = prepareItemsForSave();
      if (preparedItems.length === 0) throw new Error("Добавь хотя бы одну позицию заказа");
      if (hasStockProblems()) throw new Error(getStockWarningText());

      const selectedCustomerName = getSelectedCustomerName();

      const { error: orderError } = await supabase
        .from("customer_orders")
        .update({
          order_date: orderDate,
          customer_id: customerId || null,
          customer_name: selectedCustomerName || null,
          comment: comment.trim() || null,
          total_amount: getTotalAmount(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      const { error: deleteItemsError } = await supabase
        .from("customer_order_items")
        .delete()
        .eq("customer_order_id", order.id);

      if (deleteItemsError) throw deleteItemsError;

      const { data: savedItems, error: itemsError } = await supabase
        .from("customer_order_items")
        .insert(
          preparedItems.map((item) => ({
            ...item,
            customer_order_id: order.id,
          })),
        )
        .select("id, customer_order_id, item_type, product_id, material_id, consumable_id, quantity, price, amount");

      if (itemsError) throw itemsError;

      await replaceStockReservations(order.id, (savedItems as CustomerOrderItem[]) || []);
      await loadStockAvailability();
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка сохранения заказа");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder() {
    if (!order) return;

    const confirmed = window.confirm(`Удалить заказ ${order.order_number || "Без номера"}?`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");

      const { error: reservationsError } = await supabase
        .from("stock_reservations")
        .delete()
        .eq("source_document_type", "customer_order")
        .eq("source_document_id", order.id);

      if (reservationsError) throw reservationsError;

      const { error } = await supabase.from("customer_orders").delete().eq("id", order.id);
      if (error) throw error;

      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка удаления заказа");
    } finally {
      setDeleting(false);
    }
  }

  function renderItemsEditor() {
    return (
      <div style={itemsBlockStyle}>
        <div style={itemsHeaderStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              Позиции заказа
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Добавь продукцию, товар, материал или расходник через карточку выбора.
            </div>
          </div>

          <button type="button" onClick={addItem} style={secondaryButtonStyle}>
            + Добавить позицию
          </button>
        </div>

        {directoriesLoading && <div style={{ color: "#64748b", fontWeight: 700 }}>Загружаю справочники...</div>}
        {stockLoading && <div style={{ color: "#64748b", fontWeight: 700 }}>Загружаю остатки склада...</div>}
        {stockWarningText && <div style={stockWarningStyle}>{stockWarningText}</div>}

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => {
            const selectedName = getSelectedDraftProductName(item);
            const selectedArticle = getSelectedDraftProductArticle(item);
            const aboveAvailable = isItemQuantityAboveAvailable(item);

            return (
              <div key={item.id} style={compactItemRowStyleWithStockWarning(aboveAvailable)}>
                <div style={{ fontWeight: 900, color: "#64748b" }}>#{index + 1}</div>

                <button type="button" onClick={() => openProductPicker(item.id)} style={chooseProductButtonStyle}>
                  + Товар
                </button>

                <div style={selectedProductBoxStyle}>
                  {selectedName ? (
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={selectedProductTitleStyle}>{selectedName}</div>
                      <div style={selectedProductMetaStyle}>
                        {getItemTypeLabel(item.item_type)}{selectedArticle ? ` · ${selectedArticle}` : ""}
                      </div>
                      <div style={aboveAvailable ? stockInfoDangerStyle : stockInfoStyle}>
                        Остаток: {getOnHandQuantity(item)} · Резерв: {getReservedQuantity(item)} · Доступно: {getAvailableQuantity(item)}
                      </div>
                    </div>
                  ) : (
                    <div style={selectedProductEmptyStyle}>Товар не выбран</div>
                  )}
                </div>

                <label style={labelStyle}>
                  <span style={labelTextStyle}>Количество</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.quantity}
                    onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  <span style={labelTextStyle}>Цена</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) => updateItem(item.id, { price: event.target.value })}
                    placeholder="0"
                    style={inputStyle}
                  />
                </label>

                <div style={{ display: "grid", gap: 4 }}>
                  <span style={labelTextStyle}>Сумма</span>
                  <div style={amountStyle}>
                    {getItemAmount(item).toLocaleString("ru-RU", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    ₽
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  style={{
                    ...deleteButtonStyle,
                    opacity: items.length === 1 ? 0.45 : 1,
                    cursor: items.length === 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Удалить
                </button>
              </div>
            );
          })}
        </div>

        <div style={totalStyle}>
          Итого: {getTotalAmount().toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
        </div>
      </div>
    );
  }

  const orderStatus = getOrderStatus();
  const stockWarningText = getStockWarningText();
  const saveDisabled = saving || hasStockProblems();

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              {mode === "create"
                ? "Новый заказ покупателя"
                : isEditingOrder
                  ? `Редактирование заказа ${order?.order_number || "Без номера"}`
                  : `Заказ покупателя ${order?.order_number || "Без номера"}`}
            </div>

            <div style={{ color: "#64748b", marginTop: 4 }}>
              {mode === "create"
                ? "Номер присвоится автоматически."
                : isEditingOrder
                  ? "Внеси изменения и сохрани заказ."
                  : `Дата: ${order?.order_date || "—"} · Покупатель: ${order?.customer_name || "—"}`}
            </div>
          </div>

          <div style={modalActionsStyle}>
            {mode === "view" && !isEditingOrder && (
              <>
                <button
                  type="button"
                  onClick={openLinkedDocumentsStub}
                  style={linkedDocumentsButtonStyle}
                >
                  🔗 Связанные документы
                </button>

                <button
                  type="button"
                  onClick={() => window.alert("Создание отгрузки из заказа добавим следующим шагом.")}
                  style={createShipmentButtonStyle}
                >
                  + Создать отгрузку
                </button>

                <button type="button" onClick={openPaymentStub} style={paymentButtonStyle}>
                  💳 Финансы
                </button>

                <button type="button" onClick={openProductionStub} style={productionButtonStyle}>
                  🏭 Производство
                </button>

                <button type="button" onClick={startEditOrder} style={editOrderButtonStyle}>
                  ✏️ Редактировать
                </button>

                <button
                  type="button"
                  onClick={deleteOrder}
                  disabled={deleting}
                  style={{
                    ...deleteOrderButtonStyle,
                    opacity: deleting ? 0.65 : 1,
                    cursor: deleting ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting ? "Удаляю..." : "Удалить"}
                </button>
              </>
            )}

            <button onClick={onClose} style={modalCloseButtonStyle}>×</button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {(mode === "create" || isEditingOrder) && (
          <div style={formCardStyle}>
            <div style={grid3Style}>
              <div style={autoNumberBoxStyle}>
                <span style={labelTextStyle}>Номер заказа</span>
                <div style={autoNumberValueStyle}>Будет присвоен автоматически</div>
              </div>

              <label style={labelStyle}>
                <span style={labelTextStyle}>Дата</span>
                <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} style={inputStyle} />
              </label>

              <label style={labelStyle}>
                <span style={labelTextStyle}>Покупатель</span>
                <div style={customerSelectRowStyle}>
                  <input value={customerSearch} readOnly placeholder="Выбери покупателя" style={inputStyle} />
                  <button type="button" onClick={() => setIsCustomerPickerOpen(true)} style={searchCustomerButtonStyle} title="Выбрать покупателя">
                    🔍
                  </button>
                </div>
              </label>
            </div>

            {renderItemsEditor()}

            <label style={labelStyle}>
              <span style={labelTextStyle}>Комментарий</span>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Условия, адрес доставки, примечания"
                rows={2}
                style={{ ...inputStyle, minHeight: 58, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={mode === "create" ? createCustomerOrder : saveOrderChanges} disabled={saveDisabled} style={saveButtonStyle(saveDisabled)}>
                {saving ? "Сохраняю..." : hasStockProblems() ? "Недостаточно остатка" : mode === "create" ? "Сохранить" : "Сохранить изменения"}
              </button>

              <button onClick={mode === "create" ? onClose : cancelEditOrder} disabled={saving} style={cancelButtonStyle}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {mode === "view" && !isEditingOrder && (
          <>
            <div style={modalInfoGridStyle}>
              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Статус</div>
                <div style={modalInfoValueStyle}>
                  {orderStatus ? renderStatusBadge(orderStatus.code, orderStatus.id) : renderStatusBadge(order?.status || "draft", order?.status_id)}
                </div>
              </div>

              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Сумма</div>
                <div style={modalInfoValueStyle}>
                  {Number(order?.total_amount || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                </div>
              </div>
            </div>

            {order?.comment && <div style={commentBoxStyle}>{order.comment}</div>}

            <div style={workflowGridStyle}>
              <div style={workflowCardStyle}>
                <div style={workflowIconStyle}>📦</div>
                <div>
                  <div style={workflowTitleStyle}>Склад</div>
                  <div style={workflowTextStyle}>Ожидает отгрузку. Остатки и резервы будут учитываться при проведении.</div>
                </div>
              </div>

              <div style={workflowCardStyle}>
                <div style={workflowIconStyle}>💳</div>
                <div>
                  <div style={workflowTitleStyle}>Финансы</div>
                  <div style={workflowTextStyle}>Здесь появятся счёт, оплата покупателя и задолженность.</div>
                </div>
              </div>

              <div style={workflowCardStyle}>
                <div style={workflowIconStyle}>🏭</div>
                <div>
                  <div style={workflowTitleStyle}>Производство</div>
                  <div style={workflowTextStyle}>Если товара не хватает, будет создаваться потребность на производство.</div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Позиции заказа</div>

              {orderLoading ? (
                <div style={{ color: "#64748b", fontWeight: 700 }}>Загружаю позиции...</div>
              ) : orderItems.length === 0 ? (
                <div style={emptyStyle}>В заказе нет позиций.</div>
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
                      {orderItems.map((item) => (
                        <tr key={item.id}>
                          <td style={tdStyle}>{getItemTypeLabel(item.item_type)}</td>
                          <td style={tdStyle}>{getProductName(item)}</td>
                          <td style={tdStyle}>{getProductArticle(item) || "—"}</td>
                          <td style={tdStyle}>{item.quantity}</td>
                          <td style={tdStyle}>{Number(item.price || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</td>
                          <td style={tdStyle}>{Number(item.amount || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {isProductPickerOpen && (
          <div onClick={() => setIsProductPickerOpen(false)} style={pickerOverlayStyle}>
            <div onClick={(event) => event.stopPropagation()} style={pickerModalStyle}>
              <div style={pickerHeaderStyle}>
                <div>
                  <div style={pickerTitleStyle}>Выбор товара</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    Выбери, что продаём: продукцию/товар, материал или расходник.
                  </div>
                </div>
                <button type="button" onClick={() => setIsProductPickerOpen(false)} style={modalCloseButtonStyle}>×</button>
              </div>

              <div style={productTypeTabsStyle}>
                <button type="button" onClick={() => setProductPickerType("product")} style={productTypeTabStyle(productPickerType === "product")}>
                  Готовая продукция / товары
                </button>
                <button type="button" onClick={() => setProductPickerType("material")} style={productTypeTabStyle(productPickerType === "material")}>
                  Материалы
                </button>
                <button type="button" onClick={() => setProductPickerType("consumable")} style={productTypeTabStyle(productPickerType === "consumable")}>
                  Расходники
                </button>
              </div>

              <input value={productPickerSearch} onChange={(event) => setProductPickerSearch(event.target.value)} placeholder="Название или артикул" style={inputStyle} />

              <div style={pickerListStyle}>
                {getFilteredProducts().length === 0 ? (
                  <div style={emptyStyle}>Товары не найдены.</div>
                ) : (
                  getFilteredProducts().map((item) => {
                    const stock = getStockAvailabilityForPickerItem(productPickerType, item.id);
                    const available = Number(stock?.quantity_available || 0);
                    const onHand = Number(stock?.quantity_on_hand || 0);
                    const reserved = Number(stock?.quantity_reserved || 0);

                    return (
                      <button key={`${productPickerType}-${item.id}`} type="button" onClick={() => selectProduct(item.id)} style={productCardStyle}>
                        <div style={productCardTitleStyle}>{item.name}</div>
                        <div style={productCardSubStyle}>
                          {getItemTypeLabel(productPickerType)} · {item.article || "без артикула"}
                        </div>
                        <div style={productPickerParamsStyle}>
                          <span style={productParamStyle}>
                            Цена: {Number(getAnyItemPrice(item) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                          </span>
                          <span style={available <= 0 ? productParamDangerStyle : productParamStyle}>
                            Остаток: {onHand} · Резерв: {reserved} · Доступно: {available}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {isCustomerPickerOpen && (
          <div onClick={() => setIsCustomerPickerOpen(false)} style={pickerOverlayStyle}>
            <div onClick={(event) => event.stopPropagation()} style={pickerModalStyle}>
              <div style={pickerHeaderStyle}>
                <div>
                  <div style={pickerTitleStyle}>Выбор покупателя</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>Найди покупателя в базе контрагентов.</div>
                </div>
                <button type="button" onClick={() => setIsCustomerPickerOpen(false)} style={modalCloseButtonStyle}>×</button>
              </div>

              <div style={customerFiltersStyle}>
                <input value={customerPickerSearch} onChange={(event) => setCustomerPickerSearch(event.target.value)} placeholder="Поиск по названию или типу" style={inputStyle} />
                <select value={customerPickerType} onChange={(event) => setCustomerPickerType(event.target.value)} style={inputStyle}>
                  <option value="all">Все типы</option>
                  {getCustomerTypes().map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div style={pickerListStyle}>
                {getFilteredCustomers().length === 0 ? (
                  <div style={emptyStyle}>Покупатели не найдены.</div>
                ) : (
                  getFilteredCustomers().map((counterparty) => (
                    <button key={counterparty.id} type="button" onClick={() => selectCustomer(counterparty)} style={customerRowStyle(counterparty.id === customerId)}>
                      <span style={{ fontWeight: 900 }}>{counterparty.name}</span>
                      <span style={{ color: "#64748b" }}>{counterparty.type || "тип не указан"}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalStyle: React.CSSProperties = { width: "min(1120px, 96vw)", maxHeight: "84vh", overflowY: "auto", background: "#ffffff", borderRadius: 18, padding: 14, border: "1px solid #dbe4f0", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)", display: "grid", gap: 10 };
const modalHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" };
const modalActionsStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" };
const linkedDocumentsButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const createShipmentButtonStyle: React.CSSProperties = { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" };
const editOrderButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" };
const deleteOrderButtonStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 12, padding: "10px 13px", cursor: "pointer", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" };
const modalCloseButtonStyle: React.CSSProperties = { width: 42, height: 42, borderRadius: 14, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: 24, fontWeight: 700, color: "#0f172a" };
const formCardStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#f8fbff", borderRadius: 14, padding: 12, display: "grid", gap: 10 };
const grid3Style: React.CSSProperties = { display: "grid", gridTemplateColumns: "190px 190px minmax(240px, 1fr)", gap: 10 };
const autoNumberBoxStyle: React.CSSProperties = { display: "grid", gap: 6 };
const autoNumberValueStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 11px", fontSize: 13, background: "#f8fafc", color: "#64748b", minHeight: 38 };
const labelStyle: React.CSSProperties = { display: "grid", gap: 4 };
const labelTextStyle: React.CSSProperties = { fontWeight: 800, color: "#334155", fontSize: 13 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 11px", fontSize: 14, outline: "none", background: "#ffffff" };
const customerSelectRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 44px", gap: 8 };
const searchCustomerButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 10, cursor: "pointer", fontSize: 18, fontWeight: 900 };
const itemsBlockStyle: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 14, padding: 12, background: "#ffffff", display: "grid", gap: 10 };
const itemsHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" };
const compactItemRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "42px 110px minmax(220px, 1fr) 120px 115px 125px 90px", gap: 8, alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 12, padding: 10, background: "#f8fafc", overflowX: "auto" };

function compactItemRowStyleWithStockWarning(hasWarning: boolean): React.CSSProperties {
  return {
    ...compactItemRowStyle,
    border: hasWarning ? "1px solid #fca5a5" : compactItemRowStyle.border,
    background: hasWarning ? "#fef2f2" : compactItemRowStyle.background,
  };
}
const chooseProductButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 10, padding: "9px 10px", cursor: "pointer", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 };
const selectedProductBoxStyle: React.CSSProperties = { minHeight: 44, border: "1px solid #cbd5e1", borderRadius: 10, background: "#ffffff", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, boxSizing: "border-box" };
const selectedProductTitleStyle: React.CSSProperties = { color: "#0f172a", fontSize: 14, fontWeight: 800, lineHeight: 1.2 };
const selectedProductMetaStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 600 };
const selectedProductEmptyStyle: React.CSSProperties = { color: "#94a3b8", fontSize: 14, fontWeight: 800, alignSelf: "center" };
const amountStyle: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 10px", background: "#ffffff", fontWeight: 800, color: "#0f172a", minHeight: 38, boxSizing: "border-box", fontSize: 14 };
const totalStyle: React.CSSProperties = { textAlign: "right", fontSize: 18, fontWeight: 900, color: "#0f172a" };
const secondaryButtonStyle: React.CSSProperties = { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontWeight: 800, fontSize: 14 };
const deleteButtonStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#fff", color: "#991b1b", borderRadius: 10, padding: "9px 8px", fontWeight: 800, fontSize: 13 };
const saveButtonStyle = (saving: boolean): React.CSSProperties => ({ border: "none", background: saving ? "#94a3b8" : "#16a34a", color: "#ffffff", borderRadius: 10, padding: "10px 15px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 800 });
const cancelButtonStyle: React.CSSProperties = { border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", borderRadius: 10, padding: "10px 15px", cursor: "pointer", fontWeight: 800 };
const errorStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 14, padding: 14, fontWeight: 700 };
const stockWarningStyle: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: 12, padding: 12, fontWeight: 800 };
const stockInfoStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 800 };
const stockInfoDangerStyle: React.CSSProperties = { color: "#991b1b", fontSize: 12, fontWeight: 900 };
const emptyStyle: React.CSSProperties = { border: "1px dashed #cbd5e1", borderRadius: 16, padding: 22, textAlign: "center", color: "#64748b" };
const modalInfoGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 };
const modalInfoCardStyle: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 16, padding: 14, background: "#f8fafc" };
const modalInfoLabelStyle: React.CSSProperties = { color: "#64748b", fontSize: 13, fontWeight: 800, marginBottom: 4 };
const modalInfoValueStyle: React.CSSProperties = { color: "#0f172a", fontSize: 18, fontWeight: 900 };
const statusBadgeStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", width: "fit-content", border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "7px 12px", fontSize: 15, fontWeight: 900, whiteSpace: "nowrap" };
const workflowGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const workflowCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 12,
  background: "#ffffff",
  display: "grid",
  gridTemplateColumns: "38px 1fr",
  gap: 10,
  alignItems: "start",
};

const workflowIconStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
};

const workflowTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
};

const workflowTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.35,
  marginTop: 3,
};

const commentBoxStyle: React.CSSProperties = { border: "1px solid #dbe4f0", borderRadius: 16, padding: 14, background: "#ffffff", color: "#334155", lineHeight: 1.5 };
const tableWrapStyle: React.CSSProperties = { width: "100%", overflowX: "auto", border: "1px solid #dbe4f0", borderRadius: 16 };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", background: "#ffffff", minWidth: 760 };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "14px 12px", background: "#f8fafc", color: "#334155", fontSize: 14, fontWeight: 900, borderBottom: "1px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "13px 12px", color: "#334155", borderBottom: "1px solid #eef2f7", fontSize: 14, verticalAlign: "middle" };
const pickerOverlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.28)", zIndex: 10020, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const pickerModalStyle: React.CSSProperties = { width: "min(720px, 94vw)", maxHeight: "78vh", overflowY: "auto", background: "#ffffff", borderRadius: 18, padding: 16, border: "1px solid #dbe4f0", boxShadow: "0 20px 48px rgba(15, 23, 42, 0.28)", display: "grid", gap: 14 };
const pickerHeaderStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" };
const pickerTitleStyle: React.CSSProperties = { fontSize: 22, fontWeight: 900, color: "#0f172a" };
const pickerListStyle: React.CSSProperties = { display: "grid", gap: 9, maxHeight: "46vh", overflowY: "auto", paddingRight: 4 };
const productCardStyle: React.CSSProperties = { border: "1px solid #dbe4f0", background: "#ffffff", color: "#0f172a", borderRadius: 14, padding: 13, cursor: "pointer", textAlign: "left", display: "grid", gap: 6 };
const productCardTitleStyle: React.CSSProperties = { fontSize: 17, fontWeight: 900, color: "#0f172a" };
const productCardSubStyle: React.CSSProperties = { color: "#64748b", fontSize: 13 };
const productParamStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 800, width: "fit-content" };
const productParamDangerStyle: React.CSSProperties = { ...productParamStyle, border: "1px solid #fca5a5", background: "#fef2f2", color: "#991b1b" };
const productPickerParamsStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const productTypeTabsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 };

function productTypeTabStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    borderRadius: 12,
    padding: "9px 10px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  };
}

const customerFiltersStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 };

function customerRowStyle(active: boolean): React.CSSProperties {
  return { border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0", background: active ? "#eff6ff" : "#ffffff", color: "#0f172a", borderRadius: 12, padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", textAlign: "left" };
}

const paymentButtonStyle: React.CSSProperties = {
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#c2410c",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const productionButtonStyle: React.CSSProperties = {
  border: "1px solid #ddd6fe",
  background: "#f5f3ff",
  color: "#6d28d9",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

