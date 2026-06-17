import { useEffect, useState } from "react";
import { supabase } from "../../supabase";
import RelatedDocumentModal from "./RelatedDocumentModal";
import LinkedDocumentsModal from "./LinkedDocumentsModal";
import ReceiptModal, { type SupplierReceipt } from "../warehouse/ReceiptModal";
import SupplierPaymentModal from "./SupplierPaymentModal";

export type PurchaseItemType = "material" | "consumable" | "product";

export type SupplierOrder = {
  id: string;
  order_number: string | null;
  order_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  status: string;
  comment: string | null;
  total_amount: number;
  created_at: string | null;
};

export type SupplierOrderItem = {
  id: string;
  item_type: PurchaseItemType;
  material_id: string | null;
  consumable_id: string | null;
  product_id: string | null;
  item_id: string | null;
  quantity: number;
  price: number;
  amount: number;
  materials?: {
    name: string | null;
    article: string | null;
    color_id: string | null;
  } | null;
  consumables?: {
    name: string | null;
    article: string | null;
  } | null;
  products?: {
    name: string | null;
    article: string | null;
  } | null;
  items?: {
    name: string | null;
    article: string | null;
  } | null;
};

export type Material = {
  id: string;
  name: string;
  article: string | null;
  color_id: string | null;
  default_price: number | null;
};

export type Consumable = {
  id: string;
  name: string;
  article: string | null;
  default_price: number | null;
};

export type Product = {
  id: string;
  name: string;
  article: string | null;
  default_price: number | null;
  item_type?: string | null;
  is_active?: boolean | null;
  inventory_number?: string | null;
};

type OrderItemLookup = {
  id: string;
  name: string | null;
  article: string | null;
  item_type: string | null;
};

type ProductPickerFilterType = "all" | "material" | "consumable" | "product" | "asset";
type ProductPickerSpecificFilter = Exclude<ProductPickerFilterType, "all">;

const productPickerFilterOptions: {
  value: ProductPickerSpecificFilter;
  label: string;
}[] = [
  { value: "material", label: "Материалы" },
  { value: "consumable", label: "Расходники" },
  { value: "product", label: "Товары на перепродажу" },
  { value: "asset", label: "Имущество" },
];

export type Color = {
  id: string;
  name: string;
  hex: string | null;
};

export type Counterparty = {
  id: string;
  name: string;
  type: string | null;
};

type FinanceAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  current_balance: number | string;
};

type FinanceTransaction = {
  id: string;
  account_id: string;
  type: "income" | "expense" | string;
  amount: number | string;
  operation_date: string | null;
  description: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  created_at: string | null;
};

type SupplierPayment = {
  id: string;
  supplier_order_id: string;
  finance_account_id: string | null;
  finance_transaction_id: string | null;
  payment_number: string | null;
  payment_date: string | null;
  amount: number | string;
  comment: string | null;
  created_at: string | null;
  finance_accounts?: {
    name: string | null;
  } | null;
};

type SupplierReceiptStatus = {
  id: string;
  receipt_number: string | null;
  receipt_date: string | null;
  status: string;
  total_amount: number | string;
  supplier_name?: string | null;
};

type OrderItemDraft = {
  id: string;
  item_type: PurchaseItemType;
  material_id: string;
  consumable_id: string;
  product_id: string;
  item_id: string;
  quantity: string;
  price: string;
};

type SupplierOrderModalProps = {
  mode: "create" | "view";
  order: SupplierOrder | null;
  orderItems: SupplierOrderItem[];
  orderLoading: boolean;
  materials: Material[];
  consumables: Consumable[];
  colors: Color[];
  counterparties: Counterparty[];
  directoriesLoading: boolean;
  onClose: () => void;
  onSaved: (createdOrderId?: string) => void;
};

const emptyItem = (): OrderItemDraft => ({
  id: crypto.randomUUID(),
  item_type: "material",
  material_id: "",
  consumable_id: "",
  product_id: "",
  item_id: "",
  quantity: "1",
  price: "",
});

function orderItemToDraft(item: SupplierOrderItem): OrderItemDraft {
  return {
    id: item.id || crypto.randomUUID(),
    item_type: item.item_type,
    material_id: item.material_id || "",
    consumable_id: item.consumable_id || "",
    product_id: item.product_id || "",
    item_id: item.item_id || item.product_id || "",
    quantity: String(item.quantity ?? 0),
    price: String(item.price ?? 0),
  };
}

export default function SupplierOrderModal({
  mode,
  order,
  orderItems,
  orderLoading,
  materials,
  consumables,
  colors,
  counterparties,
  directoriesLoading,
  onClose,
  onSaved,
}: SupplierOrderModalProps) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [isRelatedDocumentModalOpen, setIsRelatedDocumentModalOpen] =
    useState(false);
  const [initialRelatedDocumentType, setInitialRelatedDocumentType] =
    useState<"receipt" | "payment" | "invoice">("receipt");
  const [isLinkedDocumentsModalOpen, setIsLinkedDocumentsModalOpen] =
    useState(false);
  const [linkedDocumentsSourceType, setLinkedDocumentsSourceType] =
    useState<"supplier_order" | "supplier_receipt" | "supplier_payment">("supplier_order");
  const [linkedDocumentsSourceId, setLinkedDocumentsSourceId] = useState(order?.id || "");
  const [linkedReceipt, setLinkedReceipt] = useState<SupplierReceipt | null>(
    null,
  );
  const [linkedPaymentId, setLinkedPaymentId] = useState<string | null>(null);
  const [linkedReceiptLoading, setLinkedReceiptLoading] = useState(false);
  const [error, setError] = useState("");
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [supplierReceipts, setSupplierReceipts] = useState<SupplierReceiptStatus[]>([]);
  const [currentOrderStatus, setCurrentOrderStatus] = useState(order?.status || "draft");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeSaving, setFinanceSaving] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentComment, setPaymentComment] = useState("");

  const [orderDate, setOrderDate] = useState(
    order?.order_date || new Date().toISOString().slice(0, 10),
  );
  const [supplierId, setSupplierId] = useState(order?.supplier_id || "");
  const [supplierName, setSupplierName] = useState(order?.supplier_name || "");
  const [supplierSearch, setSupplierSearch] = useState(order?.supplier_name || "");
  const [isSupplierPickerOpen, setIsSupplierPickerOpen] = useState(false);
  const [supplierPickerSearch, setSupplierPickerSearch] = useState("");
  const [supplierPickerType, setSupplierPickerType] = useState("all");

  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [productPickerItemId, setProductPickerItemId] = useState("");
  const [productPickerFilters, setProductPickerFilters] =
    useState<ProductPickerFilterType[]>(["all"]);
  const [isProductTypeDropdownOpen, setIsProductTypeDropdownOpen] = useState(false);
  const [productPickerSearch, setProductPickerSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItemLookup, setOrderItemLookup] = useState<Record<string, OrderItemLookup>>({});

  const [comment, setComment] = useState(order?.comment || "");
  const [items, setItems] = useState<OrderItemDraft[]>([emptyItem()]);

  useEffect(() => {
    if (mode === "create") {
      resetForm();
      setIsEditingOrder(false);
    }
  }, [mode]);

  useEffect(() => {
    setCurrentOrderStatus(order?.status || "draft");
    setLinkedDocumentsSourceType("supplier_order");
    setLinkedDocumentsSourceId(order?.id || "");
  }, [order?.id, order?.status]);

  useEffect(() => {
    loadFinanceData();
  }, [order?.id]);

  useEffect(() => {
    loadProductsForPicker();
  }, []);

  useEffect(() => {
    loadOrderItemLookup();
  }, [orderItems]);


  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatCurrency(value: number | string, currency = "RUB") {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }


  async function loadProductsForPicker() {
    try {
      const [resaleResult, assetsResult] = await Promise.all([
        supabase
          .from("items")
          .select("id, name, article, default_price, item_type, is_active")
          .eq("item_type", "resale_product")
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("assets")
          .select(
            "id, item_id, inventory_number, purchase_price, is_active, items (id, name, article, item_type, is_active)",
          )
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      if (resaleResult.error) throw resaleResult.error;
      if (assetsResult.error) throw assetsResult.error;

      const resaleItems = ((resaleResult.data as Product[]) || []).map((item) => ({
        ...item,
        item_type: "resale_product",
      }));

      const assetItems = ((assetsResult.data as any[]) || [])
        .filter((asset) => asset.items?.id && asset.items?.is_active !== false)
        .map((asset) => ({
          id: asset.item_id,
          name: asset.items?.name || asset.inventory_number || "Имущество",
          article: asset.items?.article || null,
          default_price: asset.purchase_price !== null ? Number(asset.purchase_price) : null,
          item_type: "asset",
          is_active: asset.is_active,
          inventory_number: asset.inventory_number || null,
        }));

      const mergedItems = [...resaleItems, ...assetItems];
      const uniqueItems = Array.from(
        new Map(mergedItems.map((item) => [item.id, item])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "ru"));

      setProducts(uniqueItems);
    } catch (error) {
      console.error("Ошибка загрузки товаров и имущества", error);
    }
  }

  async function loadOrderItemLookup() {
    const itemIds = Array.from(
      new Set(orderItems.map((item) => item.item_id || "").filter(Boolean)),
    );

    const productIds = Array.from(
      new Set(orderItems.map((item) => item.product_id || "").filter(Boolean)),
    );

    const allIds = Array.from(new Set([...itemIds, ...productIds]));

    if (allIds.length === 0) {
      setOrderItemLookup({});
      return;
    }

    try {
      const [itemsResult, productsResult] = await Promise.all([
        allIds.length > 0
          ? supabase
              .from("items")
              .select("id, name, article, item_type")
              .in("id", allIds)
          : Promise.resolve({ data: [], error: null }),

        productIds.length > 0
          ? supabase
              .from("products")
              .select("id, name, article")
              .in("id", productIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (productsResult.error) throw productsResult.error;

      const lookup: Record<string, OrderItemLookup> = {};

      ((itemsResult.data as OrderItemLookup[]) || []).forEach((item) => {
        lookup[item.id] = item;
      });

      ((productsResult.data as { id: string; name: string | null; article: string | null }[]) || []).forEach(
        (product) => {
          lookup[product.id] = {
            id: product.id,
            name: product.name,
            article: product.article,
            item_type: "product",
          };
        },
      );

      setOrderItemLookup(lookup);
    } catch (error) {
      console.error("Ошибка загрузки номенклатуры заказа", error);
      setOrderItemLookup({});
    }
  }

  async function loadFinanceData() {
    try {
      setFinanceLoading(true);

      const accountsQuery = supabase
        .from("finance_accounts")
        .select("id, name, type, currency, current_balance")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      const transactionsQuery = order?.id
        ? supabase
            .from("finance_transactions")
            .select(
              "id, account_id, type, amount, operation_date, description, source_document_type, source_document_id, created_at",
            )
            .eq("source_document_type", "supplier_order")
            .eq("source_document_id", order.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const paymentsQuery = order?.id
        ? supabase
            .from("supplier_payments")
            .select(
              "id, supplier_order_id, finance_account_id, finance_transaction_id, payment_number, payment_date, amount, comment, created_at, finance_accounts(name)",
            )
            .eq("supplier_order_id", order.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const receiptsQuery = order?.id
        ? supabase
            .from("supplier_receipts")
            .select("id, receipt_number, receipt_date, supplier_name, status, total_amount")
            .eq("supplier_order_id", order.id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null });

      const [
        accountsResult,
        transactionsResult,
        paymentsResult,
        receiptsResult,
      ] = await Promise.all([
        accountsQuery,
        transactionsQuery,
        paymentsQuery,
        receiptsQuery,
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (receiptsResult.error) throw receiptsResult.error;

      const nextAccounts = (accountsResult.data as FinanceAccount[]) || [];
      const nextTransactions =
        (transactionsResult.data as FinanceTransaction[]) || [];
      const nextPayments = (paymentsResult.data as SupplierPayment[]) || [];
      const nextReceipts = (receiptsResult.data as SupplierReceiptStatus[]) || [];

      setFinanceAccounts(nextAccounts);
      setFinanceTransactions(nextTransactions);
      setSupplierPayments(nextPayments);
      setSupplierReceipts(nextReceipts);

      await syncSupplierOrderStatus({
        transactions: nextTransactions,
        receipts: nextReceipts,
      });

      if (!paymentAccountId && nextAccounts.length > 0) {
        setPaymentAccountId(nextAccounts[0].id);
      }

      if (order?.id) {
        const paidAmount = nextTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const restAmount = Math.max(0, Number(order.total_amount || 0) - paidAmount);
        setPaymentAmount(restAmount > 0 ? String(restAmount.toFixed(2)) : "");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки финансов по заказу",
      );
    } finally {
      setFinanceLoading(false);
    }
  }


  function getAutoOrderStatus({
    transactions,
    receipts,
  }: {
    transactions: FinanceTransaction[];
    receipts: SupplierReceiptStatus[];
  }) {
    if (!order) return "draft";
    if (currentOrderStatus === "cancelled" || order.status === "cancelled") {
      return "cancelled";
    }

    const paidAmount = transactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalAmount = Number(order.total_amount || 0);
    const hasAnyReceipt = receipts.length > 0;
    const hasPostedReceipt = receipts.some((receipt) => receipt.status === "posted");
    const isFullyPaid = totalAmount > 0 && paidAmount >= totalAmount;

    if (hasPostedReceipt && isFullyPaid) return "received";
    if (hasPostedReceipt) return "received";
    if (hasAnyReceipt || paidAmount > 0) return "ordered";

    return "draft";
  }

  async function syncSupplierOrderStatus({
    transactions = financeTransactions,
    receipts = supplierReceipts,
  }: {
    transactions?: FinanceTransaction[];
    receipts?: SupplierReceiptStatus[];
  } = {}) {
    if (!order) return;
    if (currentOrderStatus === "cancelled" || order.status === "cancelled") return;

    const nextStatus = getAutoOrderStatus({ transactions, receipts });

    if (!nextStatus || nextStatus === currentOrderStatus || nextStatus === order.status) {
      setCurrentOrderStatus(nextStatus || currentOrderStatus);
      return;
    }

    const { error: statusError } = await supabase
      .from("supplier_orders")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (statusError) throw statusError;

    setCurrentOrderStatus(nextStatus);
  }

  async function changeSupplierOrderStatus(nextStatus: string) {
    if (!order) return;

    try {
      setStatusUpdating(true);
      setError("");

      const { error: statusError } = await supabase
        .from("supplier_orders")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (statusError) throw statusError;

      setCurrentOrderStatus(nextStatus);
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось изменить статус заказа",
      );
    } finally {
      setStatusUpdating(false);
    }
  }

  function getPaidAmount() {
    const paymentsAmount = supplierPayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    if (paymentsAmount > 0) {
      return paymentsAmount;
    }

    return financeTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

  function getPaymentDebt() {
    return Math.max(0, Number(order?.total_amount || 0) - getPaidAmount());
  }

  async function createFinanceTransaction({
    accountId,
    type,
    amount,
    description,
    sourceDocumentType,
    sourceDocumentId,
    category,
    counterpartyId,
    comment,
  }: {
    accountId: string;
    type: "income" | "expense";
    amount: number;
    description: string;
    sourceDocumentType: string;
    sourceDocumentId: string;
    category: string;
    counterpartyId: string | null;
    comment: string | null;
  }) {
    const account = financeAccounts.find((item) => item.id === accountId);

    if (!account) {
      throw new Error("Выбери финансовый счёт");
    }

    const currentBalance = Number(account.current_balance || 0);

    if (type === "expense" && amount > currentBalance) {
      throw new Error("Недостаточно средств на выбранном счёте");
    }

    const { data: transaction, error: transactionError } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: accountId,
        type,
        amount,
        operation_date: getTodayDate(),
        description,
        source_document_type: sourceDocumentType,
        source_document_id: sourceDocumentId,
        category,
        counterparty_id: counterpartyId,
        comment,
      })
      .select("id")
      .single();

    if (transactionError) throw transactionError;

    const nextBalance =
      type === "expense" ? currentBalance - amount : currentBalance + amount;

    const { error: accountError } = await supabase
      .from("finance_accounts")
      .update({
        current_balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    if (accountError) throw accountError;

    return transaction.id as string;
  }

  async function paySupplierOrder() {
    if (!order) return;

    const amount = Number(paymentAmount.replace(",", "."));

    if (!paymentAccountId) {
      setError("Выбери счёт оплаты");
      return;
    }

    if (!paymentAmount || Number.isNaN(amount) || amount <= 0) {
      setError("Сумма оплаты должна быть больше 0");
      return;
    }

    const debt = getPaymentDebt();

    if (amount > debt) {
      setError(`Сумма оплаты больше долга. Осталось оплатить ${formatCurrency(debt)}.`);
      return;
    }

    try {
      setFinanceSaving(true);
      setError("");

      const financeTransactionId = await createFinanceTransaction({
        accountId: paymentAccountId,
        type: "expense",
        amount,
        description: `Оплата поставщику по заказу ${order.order_number || order.id.slice(0, 8)}`,
        sourceDocumentType: "supplier_order",
        sourceDocumentId: order.id,
        category: "supplier_payment",
        counterpartyId: order.supplier_id || null,
        comment: paymentComment.trim() || null,
      });

      const { error: paymentError } = await supabase
        .from("supplier_payments")
        .insert({
          supplier_order_id: order.id,
          finance_account_id: paymentAccountId,
          finance_transaction_id: financeTransactionId,
          payment_date: getTodayDate(),
          amount,
          comment: paymentComment.trim() || null,
        });

      if (paymentError) throw paymentError;

      setPaymentComment("");
      await loadFinanceData();
      onSaved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось провести оплату поставщику",
      );
    } finally {
      setFinanceSaving(false);
    }
  }

  function resetForm() {
    setOrderDate(new Date().toISOString().slice(0, 10));
    setSupplierId("");
    setSupplierName("");
    setSupplierSearch("");
    setSupplierPickerSearch("");
    setSupplierPickerType("all");
    setIsProductPickerOpen(false);
    setProductPickerItemId("");
    setProductPickerFilters(["all"]);
    setIsProductTypeDropdownOpen(false);
    setProductPickerSearch("");
    setComment("");
    setItems([emptyItem()]);
    setPaymentAccountId("");
    setPaymentAmount("");
    setPaymentComment("");
    setFinanceTransactions([]);
    setSupplierPayments([]);
    setSupplierReceipts([]);
    setCurrentOrderStatus("draft");
    setError("");
  }

  function fillFormFromOrder(sourceOrder: SupplierOrder, sourceItems: SupplierOrderItem[]) {
    setOrderDate(sourceOrder.order_date || new Date().toISOString().slice(0, 10));
    setSupplierId(sourceOrder.supplier_id || "");
    setSupplierName(sourceOrder.supplier_name || "");
    setSupplierSearch(sourceOrder.supplier_name || "");
    setComment(sourceOrder.comment || "");
    setItems(sourceItems.length > 0 ? sourceItems.map(orderItemToDraft) : [emptyItem()]);
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

  function getAvailableSuppliers() {
    const supplierList = counterparties.filter(
      (counterparty) =>
        !counterparty.type ||
        counterparty.type === "supplier" ||
        counterparty.type === "поставщик",
    );

    return supplierList.length > 0 ? supplierList : counterparties;
  }

  function selectSupplier(counterparty: Counterparty) {
    setSupplierId(counterparty.id);
    setSupplierName(counterparty.name);
    setSupplierSearch(counterparty.name);
    setIsSupplierPickerOpen(false);
  }

  function getFilteredSuppliers() {
    const query = supplierPickerSearch.trim().toLowerCase();

    return getAvailableSuppliers().filter((counterparty) => {
      const matchesSearch =
        !query ||
        counterparty.name.toLowerCase().includes(query) ||
        (counterparty.type || "").toLowerCase().includes(query);

      const matchesType =
        supplierPickerType === "all" ||
        !counterparty.type ||
        counterparty.type === supplierPickerType;

      return matchesSearch && matchesType;
    });
  }

  function getSupplierTypes() {
    const types = Array.from(
      new Set(
        getAvailableSuppliers()
          .map((counterparty) => counterparty.type)
          .filter(Boolean) as string[],
      ),
    );

    return types;
  }

  function getSelectedSupplierName() {
    if (!supplierId) return supplierSearch.trim();
    return (
      counterparties.find((counterparty) => counterparty.id === supplierId)
        ?.name || supplierSearch.trim()
    );
  }

  function getColorById(colorId: string | null | undefined) {
    if (!colorId) return null;
    return colors.find((color) => color.id === colorId) || null;
  }

  function getMaterialById(materialId: string | null | undefined) {
    if (!materialId) return null;
    return materials.find((material) => material.id === materialId) || null;
  }

  function getMaterialColor(materialId: string | null | undefined) {
    const material = getMaterialById(materialId);
    return getColorById(material?.color_id);
  }

  function getOrderItemColor(item: SupplierOrderItem) {
    if (item.item_type !== "material") return null;
    return getColorById(item.materials?.color_id || null);
  }

  function renderColorChip(color: Color | null) {
    if (!color) {
      return <span style={emptyColorChipStyle}>Цвет не указан</span>;
    }

    return (
      <span style={colorChipStyle}>
        <span
          style={{
            ...colorDotStyle,
            background: color.hex || "#e2e8f0",
          }}
        />
        {color.name}
      </span>
    );
  }

  function updateItem(id: string, patch: Partial<OrderItemDraft>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function handleItemTypeChange(id: string, itemType: PurchaseItemType) {
    updateItem(id, {
      item_type: itemType,
      material_id: "",
      consumable_id: "",
      product_id: "",
      item_id: "",
      price: "",
    });
  }

  function handleNomenclatureChange(item: OrderItemDraft, value: string) {
    if (item.item_type === "material") {
      const material = materials.find((material) => material.id === value);

      updateItem(item.id, {
        material_id: value,
        consumable_id: "",
        price:
          material?.default_price !== null && material?.default_price !== undefined
            ? String(material.default_price)
            : item.price,
      });

      return;
    }

    const consumable = consumables.find((consumable) => consumable.id === value);

    updateItem(item.id, {
      consumable_id: value,
      material_id: "",
      price:
        consumable?.default_price !== null &&
        consumable?.default_price !== undefined
          ? String(consumable.default_price)
          : item.price,
    });
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

  function getItemAmount(item: OrderItemDraft) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    return quantity * price;
  }

  function getTotalAmount() {
    return items.reduce((sum, item) => sum + getItemAmount(item), 0);
  }

  function prepareItemsForSave() {
    return items
      .filter((item) => {
        const itemId =
          item.item_type === "material"
            ? item.material_id
            : item.item_type === "consumable"
              ? item.consumable_id
              : item.item_id;

        return itemId && Number(item.quantity) > 0;
      })
      .map((item) => ({
        item_type: item.item_type,
        material_id: item.item_type === "material" ? item.material_id : null,
        consumable_id:
          item.item_type === "consumable" ? item.consumable_id : null,
        product_id: null,
        item_id: item.item_type === "product" ? item.item_id : null,
        quantity: Number(item.quantity),
        price: Number(item.price) || 0,
      }));
  }

  async function createSupplierOrder() {
    try {
      setSaving(true);
      setError("");

      const preparedItems = prepareItemsForSave();

      if (preparedItems.length === 0) {
        throw new Error("Добавь хотя бы одну позицию заказа");
      }

      const selectedSupplierName = getSelectedSupplierName();

      const { data: createdOrder, error: orderError } = await supabase
        .from("supplier_orders")
        .insert({
          order_date: orderDate,
          supplier_id: supplierId || null,
          supplier_name: selectedSupplierName || null,
          status: "draft",
          comment: comment.trim() || null,
          total_amount: getTotalAmount(),
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase
        .from("supplier_order_items")
        .insert(
          preparedItems.map((item) => ({
            ...item,
            supplier_order_id: createdOrder.id,
          })),
        );

      if (itemsError) throw itemsError;

      onSaved(createdOrder.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка создания заказа поставщику",
      );
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

      if (preparedItems.length === 0) {
        throw new Error("Добавь хотя бы одну позицию заказа");
      }

      const selectedSupplierName = getSelectedSupplierName();

      const { error: orderError } = await supabase
        .from("supplier_orders")
        .update({
          order_date: orderDate,
          supplier_id: supplierId || null,
          supplier_name: selectedSupplierName || null,
          comment: comment.trim() || null,
          total_amount: getTotalAmount(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      const { error: deleteItemsError } = await supabase
        .from("supplier_order_items")
        .delete()
        .eq("supplier_order_id", order.id);

      if (deleteItemsError) throw deleteItemsError;

      const { error: itemsError } = await supabase
        .from("supplier_order_items")
        .insert(
          preparedItems.map((item) => ({
            ...item,
            supplier_order_id: order.id,
          })),
        );

      if (itemsError) throw itemsError;

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка сохранения заказа",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOrder() {
    if (!order) return;

    try {
      setDeleting(true);
      setError("");

      const [receiptsResult, paymentsResult] = await Promise.all([
        supabase
          .from("supplier_receipts")
          .select("id, receipt_number, status")
          .eq("supplier_order_id", order.id),

        supabase
          .from("supplier_payments")
          .select(
            "id, payment_number, finance_account_id, finance_transaction_id, amount",
          )
          .eq("supplier_order_id", order.id),
      ]);

      if (receiptsResult.error) throw receiptsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const linkedReceipts =
        (receiptsResult.data as {
          id: string;
          receipt_number: string | null;
          status: string | null;
        }[]) || [];

      const linkedPayments =
        (paymentsResult.data as {
          id: string;
          payment_number: string | null;
          finance_account_id: string | null;
          finance_transaction_id: string | null;
          amount: number | string;
        }[]) || [];

      const hasLinkedDocuments =
        linkedReceipts.length > 0 || linkedPayments.length > 0;

      const confirmText = hasLinkedDocuments
        ? [
            `У заказа ${order.order_number || "Без номера"} есть связанные документы:`,
            linkedReceipts.length
              ? `• приёмок: ${linkedReceipts.length}`
              : "",
            linkedPayments.length
              ? `• оплат: ${linkedPayments.length}`
              : "",
            "",
            "Удалить заказ вместе со связанными документами?",
            "",
            "Будет выполнен откат:",
            "• складские движения приёмок будут удалены;",
            "• деньги по оплатам вернутся на финансовые счета;",
            "• документы оплат и приёмок будут удалены;",
            "• заказ поставщику будет удалён.",
          ]
            .filter(Boolean)
            .join("\n")
        : `Удалить заказ ${order.order_number || "Без номера"}?`;

      const confirmed = window.confirm(confirmText);

      if (!confirmed) {
        setDeleting(false);
        return;
      }

      const receiptIds = linkedReceipts.map((receipt) => receipt.id);
      const paymentIds = linkedPayments.map((payment) => payment.id);
      const financeTransactionIds = linkedPayments
        .map((payment) => payment.finance_transaction_id)
        .filter(Boolean) as string[];

      if (receiptIds.length > 0) {
        const { error: movementsError } = await supabase
          .from("stock_movements")
          .delete()
          .eq("source_document_type", "supplier_receipt")
          .in("source_document_id", receiptIds);

        if (movementsError) throw movementsError;

        const { error: receiptItemsError } = await supabase
          .from("supplier_receipt_items")
          .delete()
          .in("supplier_receipt_id", receiptIds);

        if (receiptItemsError) throw receiptItemsError;

        const { error: receiptsError } = await supabase
          .from("supplier_receipts")
          .delete()
          .in("id", receiptIds);

        if (receiptsError) throw receiptsError;
      }

      if (linkedPayments.length > 0) {
        const accountIds = Array.from(
          new Set(
            linkedPayments
              .map((payment) => payment.finance_account_id)
              .filter(Boolean) as string[],
          ),
        );

        if (accountIds.length > 0) {
          const { data: accountsData, error: accountsError } = await supabase
            .from("finance_accounts")
            .select("id, current_balance")
            .in("id", accountIds);

          if (accountsError) throw accountsError;

          const accountBalanceMap = new Map(
            ((accountsData as { id: string; current_balance: number | string }[]) ||
              []).map((account) => [
              account.id,
              Number(account.current_balance || 0),
            ]),
          );

          for (const payment of linkedPayments) {
            if (!payment.finance_account_id) continue;

            const currentBalance =
              accountBalanceMap.get(payment.finance_account_id) || 0;
            const nextBalance = currentBalance + Number(payment.amount || 0);

            const { error: accountError } = await supabase
              .from("finance_accounts")
              .update({
                current_balance: nextBalance,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payment.finance_account_id);

            if (accountError) throw accountError;

            accountBalanceMap.set(payment.finance_account_id, nextBalance);
          }
        }

        if (paymentIds.length > 0) {
          const { error: paymentsDeleteError } = await supabase
            .from("supplier_payments")
            .delete()
            .in("id", paymentIds);

          if (paymentsDeleteError) throw paymentsDeleteError;
        }

        if (financeTransactionIds.length > 0) {
          const { error: transactionsDeleteError } = await supabase
            .from("finance_transactions")
            .delete()
            .in("id", financeTransactionIds);

          if (transactionsDeleteError) throw transactionsDeleteError;
        }
      }

      const { error: itemsError } = await supabase
        .from("supplier_order_items")
        .delete()
        .eq("supplier_order_id", order.id);

      if (itemsError) throw itemsError;

      const { error: orderError } = await supabase
        .from("supplier_orders")
        .delete()
        .eq("id", order.id);

      if (orderError) throw orderError;

      onSaved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка удаления заказа",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function openLinkedReceipt(receiptId: string) {
    try {
      setLinkedReceiptLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("supplier_receipts")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (error) throw error;

      setIsLinkedDocumentsModalOpen(false);
      setLinkedReceipt(data as SupplierReceipt);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка открытия приёмки",
      );
    } finally {
      setLinkedReceiptLoading(false);
    }
  }

  function handleOpenLinkedDocument(
    type: "supplier_order" | "supplier_receipt" | "supplier_payment",
    id: string,
  ) {
    setIsLinkedDocumentsModalOpen(false);
    setIsRelatedDocumentModalOpen(false);

    if (type === "supplier_order") {
      setLinkedReceipt(null);
      setLinkedPaymentId(null);
      return;
    }

    if (type === "supplier_payment") {
      setLinkedReceipt(null);
      setLinkedPaymentId(id);
      return;
    }

    setLinkedPaymentId(null);
    openLinkedReceipt(id);
  }

  function openRelatedDocumentModal(
    type: "receipt" | "payment" | "invoice" = "receipt",
  ) {
    setInitialRelatedDocumentType(type);
    setIsRelatedDocumentModalOpen(true);
  }

  function getStatusLabel(status: string) {
    if (status === "draft") return "Черновик";
    if (status === "ordered") return "Заказан";
    if (status === "received") return "Поступил";
    if (status === "cancelled") return "Отменён";
    return status;
  }

  function getDocumentStatusLabel(status: string | null | undefined) {
    if (status === "draft") return "Черновик";
    if (status === "ordered") return "Заказан";
    if (status === "received") return "Поступил";
    if (status === "posted") return "Проведён";
    if (status === "cancelled") return "Отменён";
    if (status === "paid") return "Оплачен";
    return status || "—";
  }

  function getDocumentStatusStyle(status: string | null | undefined) {
    const isPositive =
      status === "posted" || status === "received" || status === "paid";

    if (isPositive) {
      return {
        ...inlineDocumentStatusStyle,
        background: "#dcfce7",
        color: "#166534",
        borderColor: "#86efac",
      };
    }

    if (status === "cancelled") {
      return {
        ...inlineDocumentStatusStyle,
        background: "#fef2f2",
        color: "#991b1b",
        borderColor: "#fecaca",
      };
    }

    return inlineDocumentStatusStyle;
  }

  function getInlineLinkedDocuments() {
    const docs = [
      ...supplierReceipts.map((receipt) => ({
        id: receipt.id,
        type: "supplier_receipt" as const,
        icon: "📦",
        label: "Поступление товаров",
        number: receipt.receipt_number || "Черновик приёмки",
        date: receipt.receipt_date || "—",
        status: receipt.status,
        amount: Number(receipt.total_amount || 0),
        responsible: receipt.supplier_name || order?.supplier_name || "—",
      })),
      ...supplierPayments.map((payment) => ({
        id: payment.id,
        type: "supplier_payment" as const,
        icon: "💸",
        label: "Оплата поставщику",
        number: payment.payment_number || "Оплата без номера",
        date: payment.payment_date || "—",
        status: "paid",
        amount: Number(payment.amount || 0),
        responsible: payment.finance_accounts?.name || "—",
      })),
    ];

    return docs.sort((a, b) => {
      const dateA = a.date === "—" ? "" : a.date;
      const dateB = b.date === "—" ? "" : b.date;
      return dateA.localeCompare(dateB);
    });
  }

  function openInlineLinkedDocument(
    type: "supplier_receipt" | "supplier_payment",
    id: string,
  ) {
    if (type === "supplier_receipt") {
      setLinkedPaymentId(null);
      openLinkedReceipt(id);
      return;
    }

    setLinkedReceipt(null);
    setLinkedPaymentId(id);
  }

  function getItemName(item: SupplierOrderItem) {
    if (item.item_type === "material") {
      return item.materials?.name || "Материал";
    }

    if (item.item_type === "consumable") {
      return item.consumables?.name || "Расходник";
    }

    const lookupId = item.item_id || item.product_id || "";
    const lookupItem = lookupId ? orderItemLookup[lookupId] : null;

    return (
      item.items?.name ||
      item.products?.name ||
      lookupItem?.name ||
      "Товар не найден"
    );
  }

  function getItemArticle(item: SupplierOrderItem) {
    if (item.item_type === "material") {
      return item.materials?.article || "";
    }

    if (item.item_type === "consumable") {
      return item.consumables?.article || "";
    }

    const lookupId = item.item_id || item.product_id || "";
    const lookupItem = lookupId ? orderItemLookup[lookupId] : null;

    return item.items?.article || item.products?.article || lookupItem?.article || "";
  }

  function getSelectedDraftItemName(item: OrderItemDraft) {
    if (item.item_type === "material") {
      return (
        materials.find((material) => material.id === item.material_id)?.name ||
        ""
      );
    }

    if (item.item_type === "consumable") {
      return (
        consumables.find((consumable) => consumable.id === item.consumable_id)
          ?.name || ""
      );
    }

    return products.find((product) => product.id === item.item_id)?.name || "";
  }

  function getSelectedDraftItemArticle(item: OrderItemDraft) {
    if (item.item_type === "material") {
      return (
        materials.find((material) => material.id === item.material_id)?.article ||
        ""
      );
    }

    if (item.item_type === "consumable") {
      return (
        consumables.find((consumable) => consumable.id === item.consumable_id)
          ?.article || ""
      );
    }

    return products.find((product) => product.id === item.item_id)?.article || "";
  }

  function openProductPicker(itemId: string) {
    setProductPickerItemId(itemId);
    setProductPickerFilters(["all"]);
    setIsProductTypeDropdownOpen(false);
    setProductPickerSearch("");
    setIsProductPickerOpen(true);
  }

  function getProductPickerType(product: Material | Consumable | Product) {
    const maybeProduct = product as Product;

    if (maybeProduct.item_type === "asset") {
      return "asset";
    }

    if (maybeProduct.item_type === "resale_product") {
      return "product";
    }

    if (materials.some((material) => material.id === product.id)) {
      return "material";
    }

    if (consumables.some((consumable) => consumable.id === product.id)) {
      return "consumable";
    }

    return "product";
  }

  function getProductPickerLabel(type: ProductPickerSpecificFilter) {
    if (type === "material") return "Материал";
    if (type === "consumable") return "Расходник";
    if (type === "asset") return "Имущество";
    return "Товар на перепродажу";
  }

  function getProductPickerBadgeIcon(type: ProductPickerSpecificFilter) {
    if (type === "material") return "📦";
    if (type === "consumable") return "🧵";
    if (type === "asset") return "🏭";
    return "🛒";
  }

  function getProductPickerBadgeColor(type: ProductPickerSpecificFilter) {
    if (type === "material") {
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        borderColor: "#bfdbfe",
      };
    }

    if (type === "consumable") {
      return {
        background: "#f0fdf4",
        color: "#166534",
        borderColor: "#bbf7d0",
      };
    }

    if (type === "asset") {
      return {
        background: "#f0f9ff",
        color: "#0369a1",
        borderColor: "#bae6fd",
      };
    }

    return {
      background: "#f5f3ff",
      color: "#6d28d9",
      borderColor: "#ddd6fe",
    };
  }

  function toggleProductPickerFilter(type: ProductPickerFilterType) {
    setProductPickerFilters((prev) => {
      if (type === "all") {
        return ["all"];
      }

      const withoutAll = prev.filter((item) => item !== "all");
      const nextValues = withoutAll.includes(type)
        ? withoutAll.filter((item) => item !== type)
        : [...withoutAll, type];

      return nextValues.length === 0 ? ["all"] : nextValues;
    });
  }

  function isProductPickerFilterChecked(type: ProductPickerFilterType) {
    return productPickerFilters.includes(type);
  }

  function getProductPickerFilterSummary() {
    if (productPickerFilters.includes("all")) {
      return "Все типы";
    }

    const labels = productPickerFilterOptions
      .filter((option) => productPickerFilters.includes(option.value))
      .map((option) => option.label);

    return labels.length > 0 ? labels.join(", ") : "Все типы";
  }

  function getUnifiedPickerProducts() {
    return [
      ...materials.map((material) => ({
        ...material,
        picker_type: "material" as ProductPickerSpecificFilter,
      })),
      ...consumables.map((consumable) => ({
        ...consumable,
        picker_type: "consumable" as ProductPickerSpecificFilter,
      })),
      ...products.map((product) => ({
        ...product,
        picker_type: getProductPickerType(product),
      })),
    ];
  }

  function getFilteredProducts() {
    const query = productPickerSearch.trim().toLowerCase();
    const activeFilters = productPickerFilters.includes("all")
      ? productPickerFilterOptions.map((item) => item.value)
      : (productPickerFilters as ProductPickerSpecificFilter[]);

    return getUnifiedPickerProducts().filter((product) => {
      const pickerType = product.picker_type as ProductPickerSpecificFilter;
      const color =
        pickerType === "material"
          ? getColorById((product as Material).color_id)
          : null;
      const inventoryNumber =
        pickerType === "asset" ? (product as Product).inventory_number || "" : "";

      const matchesType = activeFilters.includes(pickerType);
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.article || "").toLowerCase().includes(query) ||
        (color?.name || "").toLowerCase().includes(query) ||
        inventoryNumber.toLowerCase().includes(query);

      return matchesType && matchesSearch;
    });
  }

  function selectProduct(product: Material | Consumable | Product) {
    if (!productPickerItemId) return;

    const pickerType = getProductPickerType(product);

    if (pickerType === "material") {
      const material = materials.find((item) => item.id === product.id);

      updateItem(productPickerItemId, {
        item_type: "material",
        material_id: product.id,
        consumable_id: "",
        product_id: "",
        item_id: "",
        price:
          material?.default_price !== null &&
          material?.default_price !== undefined
            ? String(material.default_price)
            : "",
      });
    } else if (pickerType === "consumable") {
      const consumable = consumables.find((item) => item.id === product.id);

      updateItem(productPickerItemId, {
        item_type: "consumable",
        material_id: "",
        consumable_id: product.id,
        product_id: "",
        item_id: "",
        price:
          consumable?.default_price !== null &&
          consumable?.default_price !== undefined
            ? String(consumable.default_price)
            : "",
      });
    } else {
      const selectedProduct = products.find((item) => item.id === product.id);

      updateItem(productPickerItemId, {
        item_type: "product",
        material_id: "",
        consumable_id: "",
        product_id: "",
        item_id: product.id,
        price:
          selectedProduct?.default_price !== null &&
          selectedProduct?.default_price !== undefined
            ? String(selectedProduct.default_price)
            : "",
      });
    }

    setIsProductPickerOpen(false);
    setProductPickerItemId("");
  }

  function renderItemsEditor() {
    return (
      <div style={itemsBlockStyle}>
        <div style={itemsHeaderStyle}>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Позиции заказа
            </div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              Добавь материалы, расходники или товары на перепродажу через карточку выбора.
            </div>
          </div>

          <button type="button" onClick={addItem} style={secondaryButtonStyle}>
            + Добавить позицию
          </button>
        </div>

        {directoriesLoading && (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            Загружаю справочники...
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => {
            const selectedName = getSelectedDraftItemName(item);
            const selectedArticle = getSelectedDraftItemArticle(item);
            const selectedColor =
              item.item_type === "material"
                ? getMaterialColor(item.material_id)
                : null;

            return (
              <div key={item.id} style={compactItemRowStyle}>
                <div style={{ fontWeight: 900, color: "#64748b" }}>
                  #{index + 1}
                </div>

                <button
                  type="button"
                  onClick={() => openProductPicker(item.id)}
                  style={chooseProductButtonStyle}
                >
                  + Позиция
                </button>

                <div style={selectedProductBoxStyle}>
                  {selectedName ? (
                    <>
                      {selectedColor?.hex && (
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 999,
                            background: selectedColor.hex,
                            border: "1px solid #cbd5e1",
                            flexShrink: 0,
                          }}
                        />
                      )}

                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={selectedProductTitleStyle}>
                          {selectedName}
                        </div>

                        <div style={selectedProductMetaStyle}>
                          {item.item_type === "material"
                            ? "Материал"
                            : item.item_type === "consumable"
                              ? "Расходник"
                              : products.find((product) => product.id === item.item_id)
                                  ?.item_type === "asset"
                                ? "Имущество"
                                : "Товар на перепродажу"}
                          {selectedArticle ? ` · ${selectedArticle}` : ""}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={selectedProductEmptyStyle}>
                      Позиция не выбрана
                    </div>
                  )}
                </div>

                <label style={labelStyle}>
                  <span style={labelTextStyle}>Количество</span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(item.id, { quantity: event.target.value })
                    }
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
                    onChange={(event) =>
                      updateItem(item.id, { price: event.target.value })
                    }
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
          Итого:{" "}
          {getTotalAmount().toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          ₽
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(event) => event.stopPropagation()} style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              {mode === "create"
                ? "Новый заказ поставщику"
                : isEditingOrder
                  ? `Редактирование заказа ${order?.order_number || "Без номера"}`
                  : `Заказ поставщику ${order?.order_number || "Без номера"}`}
            </div>

            <div style={{ color: "#64748b", marginTop: 4 }}>
              {mode === "create"
                ? "Номер присвоится автоматически."
                : isEditingOrder
                  ? "Внеси изменения и сохрани заказ."
                  : `Дата: ${order?.order_date || "—"} · Поставщик: ${
                      order?.supplier_name || "—"
                    }`}
            </div>
          </div>

          <div style={modalActionsStyle}>
            {mode === "view" && !isEditingOrder && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (order?.id) {
                      setLinkedDocumentsSourceType("supplier_order");
                      setLinkedDocumentsSourceId(order.id);
                    }
                    setIsLinkedDocumentsModalOpen(true);
                  }}
                  style={linkedDocumentsButtonStyle}
                >
                  🔗 Связанные документы
                </button>

                <button
                  type="button"
                  onClick={openRelatedDocumentModal}
                  style={createDocumentButtonStyle}
                >
                  + Создать документ
                </button>

                <button
                  type="button"
                  onClick={startEditOrder}
                  style={editOrderButtonStyle}
                >
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

            <button onClick={onClose} style={modalCloseButtonStyle}>
              ×
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {linkedReceiptLoading && (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            Открываю связанный документ...
          </div>
        )}

        {(mode === "create" || isEditingOrder) && (
          <div style={formCardStyle}>
            <div style={grid3Style}>
              <div style={autoNumberBoxStyle}>
                <span style={labelTextStyle}>Номер заказа</span>
                <div style={autoNumberValueStyle}>
                  Будет присвоен автоматически
                </div>
              </div>

              <label style={labelStyle}>
                <span style={labelTextStyle}>Дата</span>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <span style={labelTextStyle}>Поставщик</span>
                <div style={supplierSelectRowStyle}>
                  <input
                    value={supplierSearch}
                    readOnly
                    placeholder="Выбери поставщика"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setIsSupplierPickerOpen(true)}
                    style={searchSupplierButtonStyle}
                    title="Выбрать поставщика"
                  >
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
                placeholder="Что закупаем, условия, примечания"
                rows={2}
                style={{ ...inputStyle, minHeight: 58, resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={mode === "create" ? createSupplierOrder : saveOrderChanges}
                disabled={saving}
                style={saveButtonStyle(saving)}
              >
                {saving
                  ? "Сохраняю..."
                  : mode === "create"
                    ? "Сохранить"
                    : "Сохранить изменения"}
              </button>

              <button
                onClick={mode === "create" ? onClose : cancelEditOrder}
                disabled={saving}
                style={cancelButtonStyle}
              >
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
                <select
                  value={currentOrderStatus}
                  onChange={(event) => changeSupplierOrderStatus(event.target.value)}
                  disabled={statusUpdating}
                  style={statusSelectStyle}
                >
                  <option value="draft">Черновик</option>
                  <option value="ordered">Заказан</option>
                  <option value="received">Поступил</option>
                  <option value="cancelled">Отменён</option>
                </select>
              </div>

              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Поставщик</div>
                <div style={modalInfoValueStyle}>
                  {order?.supplier_name || "—"}
                </div>
              </div>

              <div style={modalInfoCardStyle}>
                <div style={modalInfoLabelStyle}>Сумма заказа</div>
                <div style={modalInfoValueStyle}>
                  {Number(order?.total_amount || 0).toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ₽
                </div>
              </div>
            </div>

            {getPaymentDebt() > 0 && (
              <div style={paymentWarningStyle}>
                <div>
                  <div style={paymentWarningTitleStyle}>
                    Заказ не оплачен
                  </div>
                  <div style={paymentWarningTextStyle}>
                    Осталось оплатить {formatCurrency(getPaymentDebt())}.
                    Создай документ оплаты поставщику, чтобы закрыть долг и
                    списать деньги со счёта.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openRelatedDocumentModal("payment")}
                  style={paymentWarningButtonStyle}
                >
                  Создать оплату
                </button>
              </div>
            )}

            {order?.comment && <div style={commentBoxStyle}>{order.comment}</div>}

            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#0f172a",
                  marginBottom: 10,
                }}
              >
                Позиции заказа
              </div>

              {orderLoading ? (
                <div style={{ color: "#64748b", fontWeight: 700 }}>
                  Загружаю позиции...
                </div>
              ) : orderItems.length === 0 ? (
                <div style={emptyStyle}>В заказе нет позиций.</div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={{ ...tableStyle, minWidth: 980 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>№</th>
                        <th style={thStyle}>Тип</th>
                        <th style={thStyle}>Номенклатура</th>
                        <th style={thStyle}>Артикул</th>
                        <th style={thStyle}>Цвет</th>
                        <th style={thStyle}>Кол-во</th>
                        <th style={thStyle}>Цена</th>
                        <th style={thStyle}>Сумма</th>
                      </tr>
                    </thead>

                    <tbody>
                      {orderItems.map((item, index) => (
                        <tr key={item.id}>
                          <td style={tdStyle}>{index + 1}</td>
                          <td style={tdStyle}>
                            <span style={orderItemTypeBadgeStyle}>
                              {item.item_type === "material"
                                ? "Материал"
                                : item.item_type === "consumable"
                                  ? "Расходник"
                                  : "Товар"}
                            </span>
                          </td>
                          <td style={tdStyle}>{getItemName(item)}</td>
                          <td style={tdStyle}>{getItemArticle(item) || "—"}</td>
                          <td style={tdStyle}>
                            {item.item_type === "material"
                              ? renderColorChip(getOrderItemColor(item))
                              : "—"}
                          </td>
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

                  <div style={orderItemsTotalRowStyle}>
                    <button
                      type="button"
                      onClick={startEditOrder}
                      style={addPositionButtonStyle}
                    >
                      + Добавить позицию
                    </button>

                    <div>
                      Итого:{" "}
                      {Number(order?.total_amount || 0).toLocaleString("ru-RU", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      ₽
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={inlineLinkedHeaderStyle}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  Связанные документы
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (order?.id) {
                      setLinkedDocumentsSourceType("supplier_order");
                      setLinkedDocumentsSourceId(order.id);
                    }
                    setIsLinkedDocumentsModalOpen(true);
                  }}
                  style={smallLinkButtonStyle}
                >
                  Показать цепочку
                </button>
              </div>

              {getInlineLinkedDocuments().length === 0 ? (
                <div style={inlineLinkedEmptyStyle}>
                  Связанные документы пока не созданы.
                </div>
              ) : (
                <div style={inlineLinkedTableWrapStyle}>
                  <table style={{ ...tableStyle, minWidth: 1040 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Тип документа</th>
                        <th style={thStyle}>Номер</th>
                        <th style={thStyle}>Дата</th>
                        <th style={thStyle}>Статус</th>
                        <th style={thStyle}>Сумма</th>
                        <th style={thStyle}>Ответственный / счёт</th>
                        <th style={thStyle}>Действия</th>
                      </tr>
                    </thead>

                    <tbody>
                      {getInlineLinkedDocuments().map((document) => (
                        <tr key={`${document.type}-${document.id}`}>
                          <td style={tdStyle}>
                            <span style={inlineDocumentTypeStyle}>
                              <span style={inlineDocumentIconStyle}>
                                {document.icon}
                              </span>
                              {document.label}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                openInlineLinkedDocument(document.type, document.id)
                              }
                              style={inlineDocumentNumberButtonStyle}
                            >
                              {document.number}
                            </button>
                          </td>
                          <td style={tdStyle}>{document.date}</td>
                          <td style={tdStyle}>
                            <span style={getDocumentStatusStyle(document.status)}>
                              {getDocumentStatusLabel(document.status)}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {document.amount.toLocaleString("ru-RU", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            ₽
                          </td>
                          <td style={tdStyle}>{document.responsible}</td>
                          <td style={tdStyle}>
                            <div style={inlineDocumentActionsStyle}>
                              <button
                                type="button"
                                onClick={() =>
                                  openInlineLinkedDocument(document.type, document.id)
                                }
                                style={iconActionButtonStyle}
                                title="Открыть документ"
                              >
                                👁
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openInlineLinkedDocument(document.type, document.id)
                                }
                                style={iconActionButtonStyle}
                                title="Перейти к документу"
                              >
                                ↗
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={inlineLinkedFooterStyle}>
                    <button
                      type="button"
                      onClick={() => {
                        if (order?.id) {
                          setLinkedDocumentsSourceType("supplier_order");
                          setLinkedDocumentsSourceId(order.id);
                        }
                        setIsLinkedDocumentsModalOpen(true);
                      }}
                      style={showAllDocumentsButtonStyle}
                    >
                      Показать все связанные документы ↓
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isLinkedDocumentsModalOpen && order && (
          <LinkedDocumentsModal
            sourceType={linkedDocumentsSourceType}
            sourceId={linkedDocumentsSourceId || order.id}
            supplierOrderId={order.id}
            onClose={() => setIsLinkedDocumentsModalOpen(false)}
            onOpenDocument={handleOpenLinkedDocument}
          />
        )}

        {isRelatedDocumentModalOpen && order && (
          <RelatedDocumentModal
            order={order}
            orderItems={orderItems}
            initialType={initialRelatedDocumentType}
            onCreatedDocument={(type, id) => {
              setIsRelatedDocumentModalOpen(false);
              setIsLinkedDocumentsModalOpen(false);

              if (type === "supplier_receipt") {
                setLinkedPaymentId(null);
                openLinkedReceipt(id);
                loadFinanceData();
                return;
              }

              if (type === "supplier_payment") {
                setLinkedReceipt(null);
                setLinkedPaymentId(id);
                loadFinanceData();
                return;
              }

              setLinkedDocumentsSourceType(type);
              setLinkedDocumentsSourceId(id);
              setIsLinkedDocumentsModalOpen(true);
              loadFinanceData();
            }}
            onClose={() => {
              setIsRelatedDocumentModalOpen(false);
              loadFinanceData();
            }}
          />
        )}

        {linkedReceipt && (
          <ReceiptModal
            receipt={linkedReceipt}
            colors={colors}
            onClose={() => setLinkedReceipt(null)}
            onSaved={() => {
              setLinkedReceipt(null);
              loadFinanceData();
            }}
            onOpenDocument={handleOpenLinkedDocument}
          />
        )}

        {linkedPaymentId && (
          <SupplierPaymentModal
            paymentId={linkedPaymentId}
            onClose={() => setLinkedPaymentId(null)}
            onSaved={() => {
              setLinkedPaymentId(null);
              loadFinanceData();
            }}
            onOpenDocument={handleOpenLinkedDocument}
          />
        )}

        {isProductPickerOpen && (
          <div
            onClick={() => {
              setIsProductPickerOpen(false);
              setIsProductTypeDropdownOpen(false);
            }}
            style={supplierPickerOverlayStyle}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={productPickerModalStyle}
            >
              <div style={supplierPickerHeaderStyle}>
                <div>
                  <div style={supplierPickerTitleStyle}>Выбор позиции</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    Выберите нужные типы и найдите позицию в общем списке.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProductPickerOpen(false);
                    setIsProductTypeDropdownOpen(false);
                  }}
                  style={modalCloseButtonStyle}
                >
                  ×
                </button>
              </div>

              <div style={productPickerUnifiedTopStyle}>
                <div style={productPickerTypeSelectWrapStyle}>
                  <div style={productStepTitleStyle}>Типы позиций</div>

                  <button
                    type="button"
                    onClick={() =>
                      setIsProductTypeDropdownOpen((prev) => !prev)
                    }
                    style={productPickerTypeSelectButtonStyle}
                  >
                    <span>{getProductPickerFilterSummary()}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>▼</span>
                  </button>

                  {isProductTypeDropdownOpen && (
                    <div
                      style={productPickerTypeDropdownStyle}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <label style={productPickerDropdownOptionStyle}>
                        <input
                          type="checkbox"
                          checked={isProductPickerFilterChecked("all")}
                          onChange={() => toggleProductPickerFilter("all")}
                        />
                        <span>Все</span>
                      </label>

                      {productPickerFilterOptions.map((filter) => (
                        <label
                          key={filter.value}
                          style={productPickerDropdownOptionStyle}
                        >
                          <input
                            type="checkbox"
                            checked={
                              isProductPickerFilterChecked("all") ||
                              isProductPickerFilterChecked(filter.value)
                            }
                            onChange={() => toggleProductPickerFilter(filter.value)}
                          />
                          <span>{filter.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={productPickerSearchBlockStyle}>
                  <div style={productStepTitleStyle}>Поиск</div>
                  <input
                    value={productPickerSearch}
                    onChange={(event) => setProductPickerSearch(event.target.value)}
                    placeholder="Название, артикул, цвет или инвентарный номер"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={productPickerListStyle}>
                {getFilteredProducts().length === 0 ? (
                  <div style={emptyStyle}>Позиции не найдены.</div>
                ) : (
                  getFilteredProducts().map((product) => {
                    const pickerType = product.picker_type as ProductPickerSpecificFilter;
                    const isMaterial = pickerType === "material";
                    const color = isMaterial
                      ? getColorById((product as Material).color_id)
                      : null;
                    const badgeColors = getProductPickerBadgeColor(pickerType);
                    const inventoryNumber =
                      pickerType === "asset"
                        ? (product as Product).inventory_number || ""
                        : "";

                    return (
                      <button
                        key={`${pickerType}-${product.id}`}
                        type="button"
                        onClick={() => selectProduct(product)}
                        style={productCardStyle}
                      >
                        <div style={productCardMainStyle}>
                          <div>
                            <div style={productCardTitleStyle}>{product.name}</div>

                            <div style={productCardSubStyle}>
                              {product.article || "без артикула"}
                              {inventoryNumber ? ` · ${inventoryNumber}` : ""}
                            </div>
                          </div>

                          <span
                            style={{
                              ...productPickerTypeBadgeStyle,
                              ...badgeColors,
                            }}
                          >
                            {getProductPickerBadgeIcon(pickerType)}{" "}
                            {getProductPickerLabel(pickerType)}
                          </span>
                        </div>

                        <div style={productCardParamsStyle}>
                          {isMaterial && (
                            color ? (
                              <span style={productParamStyle}>
                                <span
                                  style={{
                                    ...colorDotStyle,
                                    background: color.hex || "#e2e8f0",
                                  }}
                                />
                                {color.name}
                              </span>
                            ) : (
                              <span style={productParamStyle}>
                                Цвет не указан
                              </span>
                            )
                          )}

                          {pickerType === "asset" && inventoryNumber && (
                            <span style={productParamStyle}>
                              Инв. № {inventoryNumber}
                            </span>
                          )}

                          <span style={productParamStyle}>
                            Цена:{" "}
                            {Number(product.default_price || 0).toLocaleString(
                              "ru-RU",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}{" "}
                            ₽
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

        {isSupplierPickerOpen && (
          <div
            onClick={() => setIsSupplierPickerOpen(false)}
            style={supplierPickerOverlayStyle}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={supplierPickerModalStyle}
            >
              <div style={supplierPickerHeaderStyle}>
                <div>
                  <div style={supplierPickerTitleStyle}>Выбор поставщика</div>
                  <div style={{ color: "#64748b", marginTop: 4 }}>
                    Найди поставщика в базе контрагентов.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSupplierPickerOpen(false)}
                  style={modalCloseButtonStyle}
                >
                  ×
                </button>
              </div>

              <div style={supplierFiltersStyle}>
                <input
                  value={supplierPickerSearch}
                  onChange={(event) =>
                    setSupplierPickerSearch(event.target.value)
                  }
                  placeholder="Поиск по названию или типу"
                  style={inputStyle}
                />

                <select
                  value={supplierPickerType}
                  onChange={(event) =>
                    setSupplierPickerType(event.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="all">Все типы</option>
                  {getSupplierTypes().map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div style={supplierListStyle}>
                {getFilteredSuppliers().length === 0 ? (
                  <div style={emptyStyle}>Поставщики не найдены.</div>
                ) : (
                  getFilteredSuppliers().map((counterparty) => (
                    <button
                      key={counterparty.id}
                      type="button"
                      onClick={() => selectSupplier(counterparty)}
                      style={supplierRowStyle(
                        counterparty.id === supplierId,
                      )}
                    >
                      <span style={{ fontWeight: 900 }}>
                        {counterparty.name}
                      </span>
                      <span style={{ color: "#64748b" }}>
                        {counterparty.type || "тип не указан"}
                      </span>
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

const colorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  width: "fit-content",
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const emptyColorChipStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#94a3b8",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const colorDotStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  flexShrink: 0,
};

const autoNumberBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const autoNumberValueStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 13,
  background: "#f8fafc",
  color: "#64748b",
  minHeight: 38,
};

const formCardStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
};

const grid3Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "190px 190px minmax(240px, 1fr)",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const labelTextStyle: React.CSSProperties = {
  fontWeight: 800,
  color: "#334155",
  fontSize: 13,
};

const supplierSelectRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 44px",
  gap: 8,
};

const searchSupplierButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 18,
  fontWeight: 900,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 11px",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
};

const itemsBlockStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 14,
  padding: 12,
  background: "#ffffff",
  display: "grid",
  gap: 10,
};

const itemsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const itemRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px 118px minmax(220px, 1fr) 105px 105px 118px 88px",
  gap: 8,
  alignItems: "end",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 9,
  background: "#f8fafc",
  overflowX: "auto",
};

const amountStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 10px",
  background: "#ffffff",
  fontWeight: 800,
  color: "#0f172a",
  minHeight: 38,
  boxSizing: "border-box",
  fontSize: 14,
};

const totalStyle: React.CSSProperties = {
  textAlign: "right",
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const deleteButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff",
  color: "#991b1b",
  borderRadius: 10,
  padding: "9px 8px",
  fontWeight: 800,
  fontSize: 13,
};

const saveButtonStyle = (saving: boolean): React.CSSProperties => ({
  border: "none",
  background: saving ? "#94a3b8" : "#16a34a",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 15px",
  cursor: saving ? "not-allowed" : "pointer",
  fontWeight: 800,
});

const cancelButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "10px 15px",
  cursor: "pointer",
  fontWeight: 800,
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

const compactItemRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "42px 110px minmax(220px, 1fr) 120px 115px 125px 90px",
  gap: 8,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 10,
  background: "#f8fafc",
  overflowX: "auto",
};

const selectedProductBoxStyle: React.CSSProperties = {
  minHeight: 44,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#ffffff",
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
  boxSizing: "border-box",
};

const selectedProductTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.2,
};

const selectedProductMetaStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
};

const selectedProductEmptyStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 800,
  alignSelf: "center",
};

const chooseProductButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 10,
  padding: "9px 10px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const productPickerModalStyle: React.CSSProperties = {
  width: "min(920px, 94vw)",
  maxHeight: "78vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 16,
  border: "1px solid #dbe4f0",
  boxShadow: "0 20px 48px rgba(15, 23, 42, 0.28)",
  display: "grid",
  gap: 14,
};

const productPickerUnifiedTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: 12,
  alignItems: "start",
};

const productPickerFilterBlockStyle: React.CSSProperties = {
  display: "none",
};

const productPickerSearchBlockStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const productPickerCheckboxStyle: React.CSSProperties = {
  display: "none",
};

const productPickerTypeSelectWrapStyle: React.CSSProperties = {
  position: "relative",
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const productPickerTypeSelectButtonStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  cursor: "pointer",
  fontWeight: 800,
  textAlign: "left",
};

const productPickerTypeDropdownStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  top: 84,
  zIndex: 30,
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.18)",
  padding: 8,
  display: "grid",
  gap: 4,
};

const productPickerDropdownOptionStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "22px 1fr",
  alignItems: "center",
  gap: 8,
  padding: "9px 10px",
  borderRadius: 10,
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 800,
};



const productPickerStepsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const productStepCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px 1fr",
  gap: 10,
  alignItems: "start",
  border: "1px solid #dbe4f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
};

const productStepNumberStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const productStepTitleStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 6,
};

const productTypeTabsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

function productTypeTabStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    borderRadius: 10,
    padding: "9px 10px",
    cursor: "pointer",
    fontWeight: 900,
  };
}

const productPickerListStyle: React.CSSProperties = {
  display: "grid",
  gap: 9,
  maxHeight: "46vh",
  overflowY: "auto",
  paddingRight: 4,
};

const productCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: 13,
  cursor: "pointer",
  textAlign: "left",
  display: "grid",
  gap: 9,
};

const productCardMainStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const productCardTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#0f172a",
};

const productCardSubStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 3,
};

const productCardParamsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const productParamStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 800,
};

const productPickerTypeBadgeStyle: React.CSSProperties = {
  border: "1px solid #ddd6fe",
  background: "#f5f3ff",
  color: "#7c3aed",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const supplierPickerOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.28)",
  zIndex: 10020,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const supplierPickerModalStyle: React.CSSProperties = {
  width: "min(620px, 94vw)",
  maxHeight: "76vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 16,
  border: "1px solid #dbe4f0",
  boxShadow: "0 20px 48px rgba(15, 23, 42, 0.28)",
  display: "grid",
  gap: 14,
};

const supplierPickerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const supplierPickerTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const supplierFiltersStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 10,
};

const supplierListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

function supplierRowStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: "#0f172a",
    borderRadius: 12,
    padding: "12px 14px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
  };
}




const paymentWarningStyle: React.CSSProperties = {
  border: "1px solid #fdba74",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const paymentWarningTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  marginBottom: 4,
};

const paymentWarningTextStyle: React.CSSProperties = {
  color: "#9a3412",
  lineHeight: 1.45,
  fontWeight: 700,
};

const paymentWarningButtonStyle: React.CSSProperties = {
  border: "1px solid #f97316",
  background: "#f97316",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 15px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const statusSelectStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 900,
  outline: "none",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: "min(1380px, 96vw)",
  maxHeight: "88vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.32)",
  display: "grid",
  gap: 14,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

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

const createDocumentButtonStyle: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

const editOrderButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const deleteOrderButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 13px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
};

const modalCloseButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 24,
  fontWeight: 700,
  color: "#0f172a",
};

const modalInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.15fr 0.85fr 0.85fr",
  gap: 12,
};

const modalInfoCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
};

const modalInfoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 4,
};

const modalInfoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const commentBoxStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
  color: "#334155",
  lineHeight: 1.5,
};


const orderItemTypeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #ddd6fe",
  background: "#f5f3ff",
  color: "#7c3aed",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const orderItemsTotalRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderTop: "1px solid #e2e8f0",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const addPositionButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const inlineLinkedHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 10,
};

const smallLinkButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#ffffff",
  color: "#2563eb",
  borderRadius: 12,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 900,
};

const inlineLinkedEmptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 700,
};

const inlineLinkedTableWrapStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  background: "#ffffff",
};

const inlineDocumentTypeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  color: "#334155",
  fontWeight: 800,
};

const inlineDocumentIconStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
  border: "1px solid #dbe4f0",
};

const inlineDocumentNumberButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  padding: 0,
  cursor: "pointer",
  fontWeight: 900,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const inlineDocumentStatusStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  borderRadius: 999,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 900,
};

const inlineDocumentActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const iconActionButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#334155",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 900,
};

const inlineLinkedFooterStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: 12,
  borderTop: "1px solid #e2e8f0",
};

const showAllDocumentsButtonStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#2563eb",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

