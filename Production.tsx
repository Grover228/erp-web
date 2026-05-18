import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "./supabase";

export type ProductionTab = "jobs" | "active" | "history" | "techcards";

type ProductionOrder = {
  id: string;
  product_id: string;
  tech_card_id: string | null;
  order_number: string | null;
  quantity: number;
  status: string;
  comment: string | null;
  planned_total_cost: number | null;
  planned_time_min: number | null;
  created_at: string | null;
  product?: {
    name: string;
    article: string | null;
  } | null;
};

type ProductionOrderOperation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  planned_total_time_min: number | null;
  planned_total_price: number | null;
  price_per_unit: number | null;
  status: string;
  assigned_user_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_quantity: number;
  completed_at: string | null;
};

type ProductionBatch = {
  id: string;
  production_order_id: string;
  source_operation_id: string | null;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  current_operation_order: number | null;
  status: string | null;
  qr_code: string | null;
  product_name: string | null;
  product_article: string | null;
  color_name: string | null;
  qr_payload: GeneratedQr["payload"] | null;
  comment: string | null;
  assigned_user_id: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type ProductItem = {
  id: string;
  name: string;
  article: string | null;
};

type TechCardItem = {
  id: string;
  product_id: string;
  name: string;
  version: number;
  is_active: boolean;
};

type TechCardMaterial = {
  id: string;
  tech_card_id: string;
  material_id: string;
  quantity: number;
  comment: string | null;
};

type TechCardConsumable = {
  id: string;
  tech_card_id: string;
  consumable_id: string;
  quantity: number;
  comment: string | null;
};

type TechCardOperation = {
  id: string;
  tech_card_id: string;
  operation_name: string;
  sort_order: number;
  planned_time_min: number | null;
  price: number | null;
  comment: string | null;
};

type MaterialPrice = {
  id: string;
  default_price: number | null;
};

type ConsumablePrice = {
  id: string;
  default_price: number | null;
};

type Job = {
  id: string;
  realId: string;
  product: string;
  issuedAt: string;
  qty: number;
  completed: number;
  status: string;
  rawStatus: string;
  cost: number;
  timeMin: number;
  operations: ProductionOrderOperation[];
};

type GeneratedQr = {
  batchNumber: string;
  dataUrl: string;
  payload: {
    batch_number: string;
    order_number: string;
    product_name: string;
    product_article: string | null;
    color_name: string | null;
    quantity: number;
  };
};

type ShiftStats = {
  operationsCount: number;
  totalQuantity: number;
  totalEarned: number;
  totalDurationSeconds: number;
};

type ActiveBatchItem = {
  batch: ProductionBatch;
  order: ProductionOrder | null;
  operation: ProductionOrderOperation | null;
};

function getProgress(completed: number, total: number) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

function formatTime(minutes: number | null | undefined) {
  const totalMinutes = Math.round(Number(minutes || 0));

  if (totalMinutes <= 0) return "0 мин";

  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  if (hours === 0) return `${restMinutes} мин`;
  if (restMinutes === 0) return `${hours} ч`;

  return `${hours} ч ${restMinutes} мин`;
}

function formatTimer(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  return [hours, minutes, restSeconds]
    .map((item) => String(item).padStart(2, "0"))
    .join(":");
}

function getElapsedSeconds(startedAt: string | null, nowTick: number) {
  if (!startedAt) return 0;
  return Math.floor((nowTick - new Date(startedAt).getTime()) / 1000);
}

function getStatusLabel(status: string | null | undefined) {
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

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 10,
        background: "#dcfce7",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: "100%",
          background: "#16a34a",
          borderRadius: 999,
          transition: "width 0.2s ease",
        }}
      />
    </div>
  );
}

export default function Production({
  initialTab = "jobs",
}: {
  initialTab?: ProductionTab;
}) {
  const [tab, setTab] = useState<ProductionTab>(initialTab);

  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [operations, setOperations] = useState<ProductionOrderOperation[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [shiftStats, setShiftStats] = useState<ShiftStats>({
    operationsCount: 0,
    totalQuantity: 0,
    totalEarned: 0,
    totalDurationSeconds: 0,
  });

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [techCards, setTechCards] = useState<TechCardItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({});

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");

  const [finishOperation, setFinishOperation] =
    useState<ProductionOrderOperation | null>(null);
  const [finishQuantity, setFinishQuantity] = useState("");
  const [finishComment, setFinishComment] = useState("");
  const [finishError, setFinishError] = useState("");

  const [finishBatchItem, setFinishBatchItem] =
    useState<ActiveBatchItem | null>(null);
  const [finishBatchQuantity, setFinishBatchQuantity] = useState("");
  const [finishBatchComment, setFinishBatchComment] = useState("");
  const [finishBatchError, setFinishBatchError] = useState("");

  const [generatedQr, setGeneratedQr] = useState<GeneratedQr | null>(null);
  const [qrHistoryOrder, setQrHistoryOrder] =
    useState<ProductionOrder | null>(null);
  const [qrHistoryItems, setQrHistoryItems] = useState<GeneratedQr[]>([]);
  const [qrHistoryLoading, setQrHistoryLoading] = useState(false);

  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  async function loadAll() {
    await Promise.all([
      loadCurrentUser(),
      loadProductionOrders(),
      loadProductsAndTechCards(),
      loadTodayShiftStats(),
    ]);
  }

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);
  }

  async function loadTodayShiftStats() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setShiftStats({
          operationsCount: 0,
          totalQuantity: 0,
          totalEarned: 0,
          totalDurationSeconds: 0,
        });
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("production_operation_logs")
        .select("quantity, earned_amount, duration_seconds")
        .eq("user_id", user.id)
        .gte("finished_at", startOfDay.toISOString());

      if (error) throw error;

      const logs = data || [];

      setShiftStats({
        operationsCount: logs.length,
        totalQuantity: logs.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),
        totalEarned: logs.reduce(
          (sum, item) => sum + Number(item.earned_amount || 0),
          0
        ),
        totalDurationSeconds: logs.reduce(
          (sum, item) => sum + Number(item.duration_seconds || 0),
          0
        ),
      });
    } catch (error) {
      console.error("Ошибка загрузки статистики смены", error);
    }
  }

  async function loadProductsAndTechCards() {
    const [productsResult, techCardsResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, article")
        .eq("is_active", true)
        .order("name", { ascending: true }),

      supabase
        .from("tech_cards")
        .select("id, product_id, name, version, is_active")
        .eq("is_active", true)
        .order("version", { ascending: false }),
    ]);

    if (productsResult.error) {
      setError(productsResult.error.message);
      return;
    }

    if (techCardsResult.error) {
      setError(techCardsResult.error.message);
      return;
    }

    const safeProducts = (productsResult.data as ProductItem[]) || [];
    const safeTechCards = (techCardsResult.data as TechCardItem[]) || [];

    setProducts(safeProducts);
    setTechCards(safeTechCards);

    if (!selectedProductId && safeProducts.length > 0) {
      setSelectedProductId(safeProducts[0].id);
    }
  }

  async function loadProductionOrders() {
    try {
      setLoading(true);
      setError("");

      const { data: ordersData, error: ordersError } = await supabase
        .from("production_orders")
        .select(
          `
          *,
          product:products (
            name,
            article
          )
        `
        )
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const safeOrders = (ordersData as ProductionOrder[]) || [];
      setOrders(safeOrders);

      const orderIds = safeOrders.map((item) => item.id);

      if (orderIds.length === 0) {
        setOperations([]);
        setBatches([]);
        return;
      }

      const [operationsResult, batchesResult] = await Promise.all([
        supabase
          .from("production_order_operations")
          .select("*")
          .in("production_order_id", orderIds)
          .order("sort_order", { ascending: true }),

        supabase
          .from("production_batches")
          .select("*")
          .in("production_order_id", orderIds)
          .order("created_at", { ascending: false }),
      ]);

      if (operationsResult.error) throw operationsResult.error;
      if (batchesResult.error) throw batchesResult.error;

      setOperations((operationsResult.data as ProductionOrderOperation[]) || []);
      setBatches((batchesResult.data as ProductionBatch[]) || []);

      setOpenJobs((prev) => {
        const next = { ...prev };

        safeOrders.forEach((order, index) => {
          if (next[order.id] === undefined) {
            next[order.id] = index === 0;
          }
        });

        return next;
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки производственных заказов"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProductionOrder(e: React.FormEvent) {
    e.preventDefault();

    const product = products.find((item) => item.id === selectedProductId);
    const techCard = techCards.find(
      (item) => item.product_id === selectedProductId
    );

    if (!product) {
      setError("Выбери изделие");
      return;
    }

    if (!techCard) {
      setError("У выбранного изделия нет активной техкарты");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setError("Укажи количество больше 0");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setMessage("");

      const orderQuantity = Number(quantity);
      const orderNumber = `PR-${String(Date.now()).slice(-6)}`;

      const [
        techMaterialsResult,
        techConsumablesResult,
        techOperationsResult,
      ] = await Promise.all([
        supabase
          .from("tech_card_materials")
          .select("*")
          .eq("tech_card_id", techCard.id),

        supabase
          .from("tech_card_consumables")
          .select("*")
          .eq("tech_card_id", techCard.id),

        supabase
          .from("tech_card_operations")
          .select("*")
          .eq("tech_card_id", techCard.id)
          .order("sort_order", { ascending: true }),
      ]);

      if (techMaterialsResult.error) throw techMaterialsResult.error;
      if (techConsumablesResult.error) throw techConsumablesResult.error;
      if (techOperationsResult.error) throw techOperationsResult.error;

      const techMaterials = (techMaterialsResult.data as TechCardMaterial[]) || [];
      const techConsumables =
        (techConsumablesResult.data as TechCardConsumable[]) || [];
      const techOperations =
        (techOperationsResult.data as TechCardOperation[]) || [];

      const materialIds = techMaterials.map((item) => item.material_id);
      const consumableIds = techConsumables.map((item) => item.consumable_id);

      const [materialsPricesResult, consumablesPricesResult] =
        await Promise.all([
          materialIds.length > 0
            ? supabase
                .from("materials")
                .select("id, default_price")
                .in("id", materialIds)
            : Promise.resolve({ data: [], error: null }),

          consumableIds.length > 0
            ? supabase
                .from("consumables")
                .select("id, default_price")
                .in("id", consumableIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (materialsPricesResult.error) throw materialsPricesResult.error;
      if (consumablesPricesResult.error) throw consumablesPricesResult.error;

      const materialPrices = (materialsPricesResult.data as MaterialPrice[]) || [];
      const consumablePrices =
        (consumablesPricesResult.data as ConsumablePrice[]) || [];

      const materialPriceMap = new Map(
        materialPrices.map((item) => [item.id, Number(item.default_price || 0)])
      );

      const consumablePriceMap = new Map(
        consumablePrices.map((item) => [
          item.id,
          Number(item.default_price || 0),
        ])
      );

      const plannedMaterialsCost = techMaterials.reduce((sum, item) => {
        const price = materialPriceMap.get(item.material_id) || 0;
        return sum + Number(item.quantity || 0) * orderQuantity * price;
      }, 0);

      const plannedConsumablesCost = techConsumables.reduce((sum, item) => {
        const price = consumablePriceMap.get(item.consumable_id) || 0;
        return sum + Number(item.quantity || 0) * orderQuantity * price;
      }, 0);

      const plannedOperationsCost = techOperations.reduce((sum, item) => {
        return sum + Number(item.price || 0) * orderQuantity;
      }, 0);

      const plannedTimeMin = techOperations.reduce((sum, item) => {
        return sum + Number(item.planned_time_min || 0) * orderQuantity;
      }, 0);

      const plannedTotalCost =
        plannedMaterialsCost + plannedConsumablesCost + plannedOperationsCost;

      const { data: createdOrder, error: createOrderError } = await supabase
        .from("production_orders")
        .insert({
          product_id: product.id,
          tech_card_id: techCard.id,
          order_number: orderNumber,
          quantity: orderQuantity,
          status: "draft",
          comment: comment.trim() || null,
          planned_materials_cost: plannedMaterialsCost,
          planned_consumables_cost: plannedConsumablesCost,
          planned_operations_cost: plannedOperationsCost,
          planned_total_cost: plannedTotalCost,
          planned_time_min: plannedTimeMin,
        })
        .select()
        .single();

      if (createOrderError) throw createOrderError;

      const orderId = createdOrder.id as string;

      const orderMaterials = techMaterials.map((item) => {
        const price = materialPriceMap.get(item.material_id) || 0;
        const totalQuantity = Number(item.quantity || 0) * orderQuantity;

        return {
          production_order_id: orderId,
          material_id: item.material_id,
          quantity_per_unit: item.quantity,
          total_quantity: totalQuantity,
          planned_price: price,
          planned_total: totalQuantity * price,
          comment: item.comment,
        };
      });

      const orderConsumables = techConsumables.map((item) => {
        const price = consumablePriceMap.get(item.consumable_id) || 0;
        const totalQuantity = Number(item.quantity || 0) * orderQuantity;

        return {
          production_order_id: orderId,
          consumable_id: item.consumable_id,
          quantity_per_unit: item.quantity,
          total_quantity: totalQuantity,
          planned_price: price,
          planned_total: totalQuantity * price,
          comment: item.comment,
        };
      });

      const orderOperations = techOperations.map((item) => {
        const timePerUnit = Number(item.planned_time_min || 0);
        const pricePerUnit = Number(item.price || 0);

        return {
          production_order_id: orderId,
          operation_name: item.operation_name,
          sort_order: item.sort_order,
          planned_time_min_per_unit: timePerUnit,
          planned_total_time_min: timePerUnit * orderQuantity,
          price_per_unit: pricePerUnit,
          planned_total_price: pricePerUnit * orderQuantity,
          status: "pending",
          completed_quantity: 0,
          comment: item.comment,
        };
      });

      if (orderMaterials.length > 0) {
        const { error } = await supabase
          .from("production_order_materials")
          .insert(orderMaterials);

        if (error) throw error;
      }

      if (orderConsumables.length > 0) {
        const { error } = await supabase
          .from("production_order_consumables")
          .insert(orderConsumables);

        if (error) throw error;
      }

      if (orderOperations.length > 0) {
        const { error } = await supabase
          .from("production_order_operations")
          .insert(orderOperations);

        if (error) throw error;
      }

      setMessage(`Производственный заказ ${orderNumber} создан.`);
      setIsCreateOpen(false);
      setQuantity("");
      setComment("");

      await loadProductionOrders();
      setTab("jobs");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось создать производственный заказ"
      );
    } finally {
      setCreating(false);
    }
  }

  function getOperationLimit(
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation
  ) {
    const sortedOperations = [...orderOperations].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const currentCompleted = Number(operation.completed_quantity || 0);

    if (operation.sort_order === 1) {
      return Math.max(0, Number(order.quantity || 0) - currentCompleted);
    }

    const previousOperation = [...sortedOperations]
      .reverse()
      .find((item) => item.sort_order < operation.sort_order);

    if (!previousOperation) return 0;

    return Math.max(
      0,
      Number(previousOperation.completed_quantity || 0) - currentCompleted
    );
  }

  function getOperationTarget(
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation
  ) {
    if (operation.sort_order === 1) {
      return Number(order.quantity || 0);
    }

    const previousOperation = [...orderOperations]
      .sort((a, b) => b.sort_order - a.sort_order)
      .find((item) => item.sort_order < operation.sort_order);

    return Number(previousOperation?.completed_quantity || 0);
  }

  function canStartOperation(
    order: ProductionOrder,
    orderOperations: ProductionOrderOperation[],
    operation: ProductionOrderOperation
  ) {
    if (operation.status === "in_progress") {
      return false;
    }

    return getOperationLimit(order, orderOperations, operation) > 0;
  }

  async function handleStartOperation(
    order: ProductionOrder,
    operation: ProductionOrderOperation
  ) {
    try {
      setActionLoading(true);
      setError("");
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const now = new Date().toISOString();

      const { error: operationError } = await supabase
        .from("production_order_operations")
        .update({
          status: "in_progress",
          assigned_user_id: user?.id || null,
          assigned_at: now,
          started_at: now,
        })
        .eq("id", operation.id);

      if (operationError) throw operationError;

      if (order.status === "draft") {
        const { error: orderError } = await supabase
          .from("production_orders")
          .update({
            status: "in_progress",
          })
          .eq("id", order.id);

        if (orderError) throw orderError;
      }

      setMessage(`Операция "${operation.operation_name}" взята в работу.`);
      await loadProductionOrders();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось взять операцию в работу"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteOrder(order: ProductionOrder) {
    const title = order.order_number || order.id.slice(0, 8);
    const productName = order.product?.name || "Без названия";

    const confirmed = window.confirm(
      `Удалить производственное задание ${title}?\n\nИзделие: ${productName}\n\nБудут удалены операции, пачки, материалы, расходники и статистика по этому заданию. Это действие нельзя отменить.`
    );

    if (!confirmed) return;

    try {
      setDeletingOrderId(order.id);
      setError("");
      setMessage("");

      const deleteSteps = [
        supabase
          .from("production_operation_logs")
          .delete()
          .eq("production_order_id", order.id),

        supabase
          .from("production_batches")
          .delete()
          .eq("production_order_id", order.id),

        supabase
          .from("production_order_operations")
          .delete()
          .eq("production_order_id", order.id),

        supabase
          .from("production_order_materials")
          .delete()
          .eq("production_order_id", order.id),

        supabase
          .from("production_order_consumables")
          .delete()
          .eq("production_order_id", order.id),
      ];

      for (const step of deleteSteps) {
        const { error } = await step;
        if (error) throw error;
      }

      const { error: orderError } = await supabase
        .from("production_orders")
        .delete()
        .eq("id", order.id);

      if (orderError) throw orderError;

      setMessage(`Задание ${title} удалено.`);
      await loadAll();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось удалить задание"
      );
    } finally {
      setDeletingOrderId("");
    }
  }

  function openFinishOperation(operation: ProductionOrderOperation) {
    setFinishOperation(operation);
    setFinishQuantity("");
    setFinishComment("");
    setFinishError("");
    setError("");
    setMessage("");
    setGeneratedQr(null);
  }

  function openFinishBatch(item: ActiveBatchItem) {
    setFinishBatchItem(item);
    setFinishBatchQuantity("");
    setFinishBatchComment("");
    setFinishBatchError("");
    setError("");
    setMessage("");
  }

  async function printQrLabel(item: GeneratedQr) {
    try {
      setMessage("");
      setError("");

      const response = await fetch("http://localhost:3001/print-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          printerName: "Xprinter XP-365B",
          batchNumber: item.batchNumber,
          productName: item.payload.product_name,
          article: item.payload.product_article || "",
          quantity: item.payload.quantity,
          qrDataUrl: item.dataUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка печати QR");
      }

      setMessage(`QR пачки ${item.batchNumber} отправлен на печать`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка печати QR"
      );
    }
  }

  async function handleTestPrint() {
    try {
    setMessage("");
    setError("");

    const response = await fetch("http://localhost:3001/print-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerName: "Xprinter XP-365B",
        batchNumber: "PK-TEST-001",
        productName: "Шапка бини",
        article: "bini-black-52",
        quantity: 15,
        operation: "Стачивание",
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Ошибка печати");
    }

    setMessage("Тестовая этикетка отправлена на принтер");
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Ошибка тестовой печати"
    );
  }
}
  async function makeQrFromPayload(payload: GeneratedQr["payload"]) {
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
      width: 600,
      margin: 2,
    });

    return {
      batchNumber: payload.batch_number,
      dataUrl: qrDataUrl,
      payload,
    };
  }

  async function openQrHistory(order: ProductionOrder) {
    try {
      setQrHistoryLoading(true);
      setQrHistoryOrder(order);
      setQrHistoryItems([]);
      setError("");
      setMessage("");

      const orderBatches = batches
        .filter((batch) => batch.production_order_id === order.id)
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        );

      const qrItems = await Promise.all(
        orderBatches.map(async (batch) => {
          const fallbackPayload: GeneratedQr["payload"] = {
            batch_number: batch.batch_number,
            order_number: order.order_number || order.id.slice(0, 8),
            product_name:
              batch.product_name || order.product?.name || "Без названия",
            product_article:
              batch.product_article || order.product?.article || null,
            color_name: batch.color_name || null,
            quantity: Number(batch.quantity || 0),
          };

          return makeQrFromPayload(batch.qr_payload || fallbackPayload);
        })
      );

      setQrHistoryItems(qrItems);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось открыть историю QR"
      );
    } finally {
      setQrHistoryLoading(false);
    }
  }

  async function handleFinishOperation(e: React.FormEvent) {
    e.preventDefault();

    if (!finishOperation) return;

    const order = orders.find(
      (item) => item.id === finishOperation.production_order_id
    );

    if (!order) {
      setFinishError("Не найден производственный заказ");
      return;
    }

    const orderOperations = operations.filter(
      (item) => item.production_order_id === order.id
    );

    const availableQuantity = getOperationLimit(
      order,
      orderOperations,
      finishOperation
    );

    const finishQuantityNumber = Number(finishQuantity);

    if (!finishQuantity || finishQuantityNumber <= 0) {
      setFinishError("Укажи количество выполненных изделий больше 0");
      return;
    }

    if (!Number.isInteger(finishQuantityNumber)) {
      setFinishError("Количество должно быть целым числом");
      return;
    }

    if (finishQuantityNumber > availableQuantity) {
      setFinishError(
        `Нельзя выполнить ${finishQuantityNumber} шт. Доступно только ${availableQuantity} шт с предыдущего этапа.`
      );
      return;
    }

    try {
      setActionLoading(true);
      setFinishError("");
      setError("");
      setMessage("");

      const addedQuantity = finishQuantityNumber;
      const newCompletedQuantity =
        Number(finishOperation.completed_quantity || 0) + addedQuantity;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const finishedAt = new Date().toISOString();
      const durationSeconds = finishOperation.started_at
        ? Math.max(
            0,
            Math.floor(
              (new Date(finishedAt).getTime() -
                new Date(finishOperation.started_at).getTime()) /
                1000
            )
          )
        : 0;

      const operationTarget = getOperationTarget(
        order,
        orderOperations,
        finishOperation
      );

      const nextStatus =
        newCompletedQuantity >= operationTarget ? "done" : "pending";

      const earned = addedQuantity * Number(finishOperation.price_per_unit || 0);

      const { error: operationError } = await supabase
        .from("production_order_operations")
        .update({
          status: nextStatus,
          completed_quantity: newCompletedQuantity,
          completed_at: nextStatus === "done" ? finishedAt : null,
          comment: finishComment.trim() || finishOperation.operation_name,
        })
        .eq("id", finishOperation.id);

      if (operationError) throw operationError;

      const { error: logError } = await supabase
        .from("production_operation_logs")
        .insert({
          production_order_id: order.id,
          production_order_operation_id: finishOperation.id,
          user_id: user?.id || null,
          operation_name: finishOperation.operation_name,
          quantity: addedQuantity,
          price_per_unit: Number(finishOperation.price_per_unit || 0),
          earned_amount: earned,
          started_at: finishOperation.started_at,
          finished_at: finishedAt,
          duration_seconds: durationSeconds,
          comment: finishComment.trim() || null,
        });

      if (logError) throw logError;

      const refreshedOperations = orderOperations.map((item) =>
        item.id === finishOperation.id
          ? {
              ...item,
              status: nextStatus,
              completed_quantity: newCompletedQuantity,
            }
          : item
      );

      const allDone = refreshedOperations.every(
        (item) =>
          Number(item.completed_quantity || 0) >= Number(order.quantity || 0)
      );

      if (allDone) {
        const { error: orderError } = await supabase
          .from("production_orders")
          .update({
            status: "done",
          })
          .eq("id", order.id);

        if (orderError) throw orderError;
      }

      if (finishOperation.sort_order === 1) {
        const batchNumber = `PK-${String(Date.now()).slice(-6)}`;

        const payload: GeneratedQr["payload"] = {
          batch_number: batchNumber,
          order_number: order.order_number || order.id.slice(0, 8),
          product_name: order.product?.name || "Без названия",
          product_article: order.product?.article || null,
          color_name: null,
          quantity: addedQuantity,
        };

        const qrItem = await makeQrFromPayload(payload);

        const { error: batchError } = await supabase
          .from("production_batches")
          .insert({
            production_order_id: order.id,
            source_operation_id: finishOperation.id,
            batch_number: batchNumber,
            quantity: addedQuantity,
            completed_quantity: 0,
            current_operation_order: 2,
            status: "waiting",
            qr_code: batchNumber,
            product_name: payload.product_name,
            product_article: payload.product_article,
            color_name: payload.color_name,
            qr_payload: payload,
            comment: finishComment.trim() || null,
          });

        if (batchError) throw batchError;

        setGeneratedQr(qrItem);
      }

      setMessage(
        `Операция сохранена. Выполнено: ${addedQuantity} шт. Заработано: ${formatMoney(earned)}.`
      );
      setFinishOperation(null);
      setFinishQuantity("");
      setFinishComment("");

      await loadProductionOrders();
      await loadTodayShiftStats();
    } catch (error) {
      setFinishError(
        error instanceof Error ? error.message : "Не удалось завершить операцию"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFinishBatch(e: React.FormEvent) {
    e.preventDefault();

    if (!finishBatchItem) return;

    const { batch, order, operation } = finishBatchItem;

    if (!order) {
      setFinishBatchError("Не найден производственный заказ");
      return;
    }

    if (!operation) {
      setFinishBatchError("Не найдена операция для пачки");
      return;
    }

    const batchQuantity = Number(batch.quantity || 0);
    const batchCompleted = Number(batch.completed_quantity || 0);
    const batchLeft = Math.max(0, batchQuantity - batchCompleted);
    const finishQuantityNumber = Number(finishBatchQuantity);

    if (!finishBatchQuantity || finishQuantityNumber <= 0) {
      setFinishBatchError("Укажи количество больше 0");
      return;
    }

    if (!Number.isInteger(finishQuantityNumber)) {
      setFinishBatchError("Количество должно быть целым числом");
      return;
    }

    if (finishQuantityNumber > batchLeft) {
      setFinishBatchError(
        `Нельзя закрыть ${finishQuantityNumber} шт. В пачке осталось только ${batchLeft} шт.`
      );
      return;
    }

    try {
      setActionLoading(true);
      setFinishBatchError("");
      setError("");
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      const finishedAt = new Date().toISOString();
      const startedAt = batch.started_at || operation.started_at;
      const durationSeconds = startedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(finishedAt).getTime() -
                new Date(startedAt).getTime()) /
                1000
            )
          )
        : 0;

      const pricePerUnit = Number(operation.price_per_unit || 0);
      const earned = finishQuantityNumber * pricePerUnit;
      const newBatchCompleted = batchCompleted + finishQuantityNumber;
      const isBatchOperationDone = newBatchCompleted >= batchQuantity;

      const orderOperations = operations
        .filter((item) => item.production_order_id === order.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const newOperationCompleted =
        Number(operation.completed_quantity || 0) + finishQuantityNumber;

      const operationTarget = getOperationTarget(
        order,
        orderOperations,
        operation
      );

      const operationNextStatus =
        newOperationCompleted >= operationTarget ? "done" : "pending";

      const { error: operationError } = await supabase
        .from("production_order_operations")
        .update({
          status: operationNextStatus,
          completed_quantity: newOperationCompleted,
          completed_at:
            operationNextStatus === "done" ? finishedAt : operation.completed_at,
        })
        .eq("id", operation.id);

      if (operationError) throw operationError;

      const nextOperation = orderOperations.find(
        (item) => item.sort_order > Number(batch.current_operation_order || 0)
      );

      let nextBatchData: Record<string, unknown> = {};
      let nextBatchStatusMessage = "";

      /*
        ВАЖНО ДЛЯ QR-СЦЕНАРИЯ
        Если сотрудник закрыл не всю пачку, пачка НЕ должна оставаться in_progress.
        Она должна перейти в статус partial, чтобы при повторном сканировании QR
        система предложила продолжить работу над остатком.

        Пример:
        quantity = 15
        completed_quantity было 0
        сотрудник сделал 10

        После сохранения в production_batches должно быть:
        status = partial
        completed_quantity = 10
        current_operation_order = текущая операция
      */

      if (isBatchOperationDone && nextOperation) {
        nextBatchData = {
          status: "waiting",
          completed_quantity: 0,
          current_operation_order: nextOperation.sort_order,
          assigned_user_id: null,
          assigned_at: null,
          started_at: null,
          completed_at: null,
        };

        nextBatchStatusMessage = `Пачка полностью закрыта на текущей операции и передана на операцию ${nextOperation.sort_order}. ${nextOperation.operation_name}.`;
      } else if (isBatchOperationDone && !nextOperation) {
        nextBatchData = {
          status: "done",
          completed_quantity: batchQuantity,
          assigned_user_id: null,
          assigned_at: null,
          started_at: null,
          completed_at: finishedAt,
        };

        nextBatchStatusMessage = "Пачка полностью завершена.";
      } else {
        nextBatchData = {
          status: "partial",
          completed_quantity: newBatchCompleted,
          current_operation_order: Number(batch.current_operation_order || operation.sort_order),
          assigned_user_id: null,
          assigned_at: null,
          started_at: null,
          completed_at: null,
        };

        nextBatchStatusMessage = `Пачка выполнена частично. Осталось: ${Math.max(
          0,
          batchQuantity - newBatchCompleted
        )} шт.`;
      }

      const { data: updatedBatch, error: batchError } = await supabase
        .from("production_batches")
        .update(nextBatchData)
        .eq("id", batch.id)
        .select("id, batch_number, quantity, completed_quantity, status, current_operation_order")
        .maybeSingle();

      if (batchError) throw batchError;

      if (!updatedBatch) {
        throw new Error(
          "Пачка не обновилась в базе. Проверь RLS/права доступа к production_batches."
        );
      }

      const { error: logError } = await supabase
        .from("production_operation_logs")
        .insert({
          production_order_id: order.id,
          production_order_operation_id: operation.id,
          user_id: user?.id || null,
          operation_name: operation.operation_name,
          quantity: finishQuantityNumber,
          price_per_unit: pricePerUnit,
          earned_amount: earned,
          started_at: startedAt,
          finished_at: finishedAt,
          duration_seconds: durationSeconds,
          comment: finishBatchComment.trim() || null,
        });

      if (logError) throw logError;

      const refreshedOperations = orderOperations.map((item) =>
        item.id === operation.id
          ? {
              ...item,
              status: operationNextStatus,
              completed_quantity: newOperationCompleted,
            }
          : item
      );

      const allOperationsDone = refreshedOperations.every(
        (item) =>
          Number(item.completed_quantity || 0) >= Number(order.quantity || 0)
      );

      const orderBatches = batches.filter(
        (item) => item.production_order_id === order.id
      );

      const refreshedBatches = orderBatches.map((item) =>
        item.id === batch.id
          ? {
              ...item,
              ...nextBatchData,
            }
          : item
      );

      const allBatchesDone =
        refreshedBatches.length > 0 &&
        refreshedBatches.every((item) => item.status === "done");

      if (allOperationsDone && allBatchesDone) {
        const { error: orderError } = await supabase
          .from("production_orders")
          .update({
            status: "done",
          })
          .eq("id", order.id);

        if (orderError) throw orderError;
      }

      setMessage(
        `Пачка ${batch.batch_number} сохранена. Сделано: ${finishQuantityNumber} шт. Заработано: ${formatMoney(earned)} ${nextBatchStatusMessage}`
      );

      setFinishBatchItem(null);
      setFinishBatchQuantity("");
      setFinishBatchComment("");

      await loadAll();
    } catch (error) {
      setFinishBatchError(
        error instanceof Error ? error.message : "Не удалось завершить пачку"
      );
    } finally {
      setActionLoading(false);
    }
  }

  const jobs: Job[] = useMemo(() => {
    return orders.map((order) => {
      const orderOperations = operations
        .filter((operation) => operation.production_order_id === order.id)
        .sort((a, b) => a.sort_order - b.sort_order);

      const completedQuantity =
        orderOperations.length > 0
          ? Math.min(
              ...orderOperations.map((operation) =>
                Number(operation.completed_quantity || 0)
              )
            )
          : order.status === "done"
          ? Number(order.quantity || 0)
          : 0;

      return {
        id: order.order_number || order.id.slice(0, 8),
        realId: order.id,
        product: order.product?.name || "Без названия",
        issuedAt: formatDate(order.created_at),
        qty: Number(order.quantity || 0),
        completed: completedQuantity,
        status: getStatusLabel(order.status),
        rawStatus: order.status,
        cost: Number(order.planned_total_cost || 0),
        timeMin: Number(order.planned_time_min || 0),
        operations: orderOperations,
      };
    });
  }, [orders, operations]);

  const activeJobs = jobs.filter((job) => {
    return !["done", "cancelled", "archived"].includes(job.rawStatus);
  });

  const historyJobs = jobs.filter((job) => {
    return ["done", "cancelled", "archived"].includes(job.rawStatus);
  });

  const activeBatchItems: ActiveBatchItem[] = useMemo(() => {
    return batches
      .filter((batch) => {
        if (batch.status !== "in_progress") return false;

        if (currentUserId && batch.assigned_user_id) {
          return batch.assigned_user_id === currentUserId;
        }

        return true;
      })
      .map((batch) => {
        const order =
          orders.find((item) => item.id === batch.production_order_id) || null;

        const operation =
          operations.find(
            (item) =>
              item.production_order_id === batch.production_order_id &&
              item.sort_order === Number(batch.current_operation_order || 0)
          ) || null;

        return {
          batch,
          order,
          operation,
        };
      })
      .sort((a, b) => {
        return (
          new Date(b.batch.started_at || b.batch.assigned_at || 0).getTime() -
          new Date(a.batch.started_at || a.batch.assigned_at || 0).getTime()
        );
      });
  }, [batches, operations, orders, currentUserId]);

  const techcards = useMemo(() => {
    return techCards.map((card) => {
      const product = products.find((item) => item.id === card.product_id);

      return {
        id: card.id,
        name: product?.name || card.name,
        version: card.version,
      };
    });
  }, [products, techCards]);

  function toggleJob(jobId: string) {
    setOpenJobs((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  }

  function collapseAllJobs() {
    const next: Record<string, boolean> = {};
    orders.forEach((order) => {
      next[order.id] = false;
    });
    setOpenJobs(next);
  }

  function expandAllJobs() {
    const next: Record<string, boolean> = {};
    orders.forEach((order) => {
      next[order.id] = true;
    });
    setOpenJobs(next);
  }

  const selectedProduct = products.find((item) => item.id === selectedProductId);
  const selectedTechCard = techCards.find(
    (item) => item.product_id === selectedProductId
  );

  const finishOrder = finishOperation
    ? orders.find((item) => item.id === finishOperation.production_order_id)
    : null;

  const finishOrderOperations = finishOrder
    ? operations.filter((item) => item.production_order_id === finishOrder.id)
    : [];

  const finishAvailableQuantity =
    finishOrder && finishOperation
      ? getOperationLimit(finishOrder, finishOrderOperations, finishOperation)
      : 0;

  const finishBatchTotal = Number(finishBatchItem?.batch.quantity || 0);
  const finishBatchCompleted = Number(
    finishBatchItem?.batch.completed_quantity || 0
  );
  const finishBatchLeft = Math.max(0, finishBatchTotal - finishBatchCompleted);
  const finishBatchEarned =
    Number(finishBatchQuantity || 0) *
    Number(finishBatchItem?.operation?.price_per_unit || 0);

  function renderJobsList(items: Job[], variant: "active" | "history") {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              {variant === "active"
                ? "Задания в производство"
                : "История заданий"}
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              {variant === "active"
                ? "Активные производственные заказы"
                : "Завершённые, отменённые и архивные заказы"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={expandAllJobs} style={secondaryBlueButtonStyle()}>
              Развернуть все
            </button>

            <button onClick={collapseAllJobs} style={secondaryBlueButtonStyle()}>
              Свернуть все
            </button>

            <button onClick={loadAll} style={secondaryBlueButtonStyle()}>
              Обновить
            </button>

            {variant === "active" && (
              <>
                <button
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setIsCreateOpen(true);
                  }}
                  style={primaryBlueButtonStyle}
                >
                  + Создать задание
                </button>

                <button
                  onClick={handleTestPrint}
                  style={secondaryBlueButtonStyle()}
                >
                  Тест печати
                </button>
              </>
            )}
          </div>
        </div>

        {loading && (
          <div style={emptyStyle}>Загрузка производственных заказов...</div>
        )}

        {!loading && items.length === 0 && (
          <div style={emptyStyle}>
            {variant === "active"
              ? "Активных производственных заданий пока нет."
              : "История производственных заданий пока пустая."}
          </div>
        )}

        {!loading &&
          items.map((job) => {
            const progress = getProgress(job.completed, job.qty);
            const isOpen = !!openJobs[job.realId];
            const sourceOrder = orders.find((order) => order.id === job.realId);
            const jobBatches = batches.filter(
              (batch) => batch.production_order_id === job.realId
            );

            return (
              <div
                key={job.realId}
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 16,
                  background: "#ffffff",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => toggleJob(job.realId)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: 16,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    textAlign: "left",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {job.product}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 4,
                      }}
                    >
                      {job.id} · {job.status} · {progress}%
                    </div>
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 18,
                      color: "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    {isOpen ? "▲" : "▼"}
                  </div>
                </button>

                {isOpen && sourceOrder && (
                  <div style={{ padding: "0 16px 16px 16px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <InfoBox label="Создано" value={job.issuedAt} />
                      <InfoBox
                        label="Плановое время"
                        value={formatTime(job.timeMin)}
                      />
                      <InfoBox label="Количество" value={`${job.qty} шт`} />
                      <InfoBox
                        label="Себестоимость"
                        value={formatMoney(job.cost)}
                      />
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                          fontSize: 14,
                          color: "#374151",
                        }}
                      >
                        <span>Общий прогресс задания</span>
                        <span>{progress}%</span>
                      </div>

                      <ProgressBar value={progress} />
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#111827",
                          }}
                        >
                          Пачки после раскроя
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          Распечатано QR: {jobBatches.length} шт.
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => openQrHistory(sourceOrder)}
                          style={secondaryBlueButtonStyle()}
                        >
                          История QR / пачки
                        </button>

                        {variant === "active" && (
                          <button
                            onClick={() => handleDeleteOrder(sourceOrder)}
                            disabled={deletingOrderId === sourceOrder.id}
                            style={{
                              ...dangerButtonStyle,
                              opacity:
                                deletingOrderId === sourceOrder.id ? 0.7 : 1,
                            }}
                          >
                            {deletingOrderId === sourceOrder.id
                              ? "Удаление..."
                              : "Удалить"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#111827",
                          marginBottom: 10,
                        }}
                      >
                        Операции
                      </div>

                      {job.operations.length === 0 ? (
                        <div style={emptySmallStyle}>
                          Операции пока не добавлены
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {job.operations.map((operation) => {
                            const operationProgress = getProgress(
                              Number(operation.completed_quantity || 0),
                              job.qty
                            );

                            const availableQuantity = getOperationLimit(
                              sourceOrder,
                              job.operations,
                              operation
                            );

                            const canStart = canStartOperation(
                              sourceOrder,
                              job.operations,
                              operation
                            );

                            const isInProgress =
                              operation.status === "in_progress";
                            const isDone = operation.status === "done";
                            const earned =
                              Number(operation.completed_quantity || 0) *
                              Number(operation.price_per_unit || 0);

                            return (
                              <div
                                key={operation.id}
                                style={{
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 12,
                                  padding: 12,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    marginBottom: 8,
                                    fontSize: 14,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        color: "#111827",
                                      }}
                                    >
                                      {operation.sort_order}.{" "}
                                      {operation.operation_name}
                                    </div>

                                    <div
                                      style={{
                                        color: "#6b7280",
                                        marginTop: 4,
                                      }}
                                    >
                                      Статус: {getStatusLabel(operation.status)}
                                    </div>

                                    {!isDone && (
                                      <div
                                        style={{
                                          color: "#64748b",
                                          marginTop: 4,
                                        }}
                                      >
                                        Доступно к выполнению сейчас:{" "}
                                        {availableQuantity} шт
                                      </div>
                                    )}

                                    {isInProgress && (
                                      <div
                                        style={{
                                          color: "#2563eb",
                                          marginTop: 4,
                                          fontWeight: 700,
                                        }}
                                      >
                                        В работе:{" "}
                                        {formatTimer(
                                          getElapsedSeconds(
                                            operation.started_at,
                                            nowTick
                                          )
                                        )}
                                      </div>
                                    )}

                                    {isDone && (
                                      <div
                                        style={{
                                          color: "#166534",
                                          marginTop: 4,
                                        }}
                                      >
                                        Выполнено:{" "}
                                        {operation.completed_quantity} шт ·
                                        Заработано: {formatMoney(earned)}
                                      </div>
                                    )}
                                  </div>

                                  <span style={{ color: "#4b5563" }}>
                                    {operation.completed_quantity || 0} /{" "}
                                    {job.qty}
                                  </span>
                                </div>

                                <ProgressBar value={operationProgress} />

                                {variant === "active" && (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      marginTop: 12,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {canStart && (
                                      <button
                                        onClick={() =>
                                          handleStartOperation(
                                            sourceOrder,
                                            operation
                                          )
                                        }
                                        disabled={actionLoading}
                                        style={primaryBlueButtonStyle}
                                      >
                                        Взять в работу
                                      </button>
                                    )}

                                    {isInProgress && (
                                      <button
                                        onClick={() =>
                                          openFinishOperation(operation)
                                        }
                                        disabled={actionLoading}
                                        style={primaryGreenButtonStyle}
                                      >
                                        Закончить работу
                                      </button>
                                    )}

                                    {!canStart && !isInProgress && !isDone && (
                                      <div
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: 10,
                                          background: "#f8fafc",
                                          border: "1px solid #e5e7eb",
                                          color: "#64748b",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Ждёт доступное количество с предыдущей
                                        операции
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setTab("jobs")}
          style={tabButtonStyle(tab === "jobs")}
        >
          Задания
        </button>

        <button
          onClick={() => setTab("active")}
          style={tabButtonStyle(tab === "active")}
        >
          В работе
        </button>

        <button
          onClick={() => setTab("history")}
          style={tabButtonStyle(tab === "history")}
        >
          История
        </button>

        <button
          onClick={() => setTab("techcards")}
          style={tabButtonStyle(tab === "techcards")}
        >
          Техкарты
        </button>
      </div>

      {(message || error) && (
        <div
          style={{
            background: message ? "#dcfce7" : "#fef2f2",
            border: message ? "1px solid #86efac" : "1px solid #fecaca",
            color: message ? "#166534" : "#991b1b",
            borderRadius: 14,
            padding: 14,
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          {message || error}
        </div>
      )}

      {generatedQr && (
        <div
          style={{
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            borderRadius: 16,
            padding: 16,
            marginBottom: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            QR-код для пачки {generatedQr.batchNumber}
          </div>

          <QrCard item={generatedQr} onPrint={printQrLabel} />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <InfoBox
          label="Моя смена: заработано"
          value={formatMoney(shiftStats.totalEarned)}
        />
        <InfoBox
          label="Операций закрыто"
          value={`${shiftStats.operationsCount} шт`}
        />
        <InfoBox
          label="Количество сделано"
          value={`${shiftStats.totalQuantity} шт`}
        />
        <InfoBox
          label="Время в работе"
          value={formatTimer(shiftStats.totalDurationSeconds)}
        />
      </div>

      {tab === "jobs" && renderJobsList(activeJobs, "active")}

      {tab === "history" && renderJobsList(historyJobs, "history")}

      {tab === "active" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              В работе
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              Пачки, которые сейчас находятся в работе у сотрудника
            </div>
          </div>

          {activeBatchItems.length === 0 && (
            <div style={emptyStyle}>Сейчас нет пачек в работе</div>
          )}

          {activeBatchItems.map((item) => {
            const batch = item.batch;
            const order = item.order;
            const operation = item.operation;

            const total = Number(batch.quantity || 0);
            const completed = Number(batch.completed_quantity || 0);
            const left = Math.max(0, total - completed);

            return (
              <div
                key={batch.id}
                style={{
                  border: "1px solid #dbeafe",
                  borderRadius: 16,
                  padding: 14,
                  background: "#ffffff",
                  display: "grid",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      Пачка {batch.batch_number}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        color: "#64748b",
                        marginTop: 4,
                      }}
                    >
                      {operation
                        ? `${operation.sort_order}. ${operation.operation_name}`
                        : "Операция не найдена"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontWeight: 800,
                      height: "fit-content",
                    }}
                  >
                    {getStatusLabel(batch.status)}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                  }}
                >
                  <InfoBox
                    label="Изделие"
                    value={
                      batch.product_name ||
                      order?.product?.name ||
                      "Без названия"
                    }
                  />
                  <InfoBox
                    label="Заказ"
                    value={order?.order_number || order?.id.slice(0, 8) || "—"}
                  />
                  <InfoBox label="Всего в пачке" value={`${total} шт`} />
                  <InfoBox label="Уже сделано" value={`${completed} шт`} />
                  <InfoBox label="Осталось" value={`${left} шт`} />
                  <InfoBox
                    label="В работе"
                    value={formatTimer(
                      getElapsedSeconds(batch.started_at, nowTick)
                    )}
                  />
                </div>

                <ProgressBar value={getProgress(completed, total)} />

                <div>
                  <button
                    onClick={() => openFinishBatch(item)}
                    disabled={actionLoading || !operation}
                    style={primaryGreenButtonStyle}
                  >
                    Закончить работу
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "techcards" && (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>
              Технологические карты
            </div>
            <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
              Активные техкарты изделий
            </div>
          </div>

          {techcards.length === 0 && (
            <div style={emptyStyle}>Активных техкарт пока нет</div>
          )}

          {techcards.map((card) => (
            <div
              key={card.id}
              style={{
                border: "1px solid #dbeafe",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                {card.name}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                Версия: {card.version}
              </div>
            </div>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <div onClick={() => setIsCreateOpen(false)} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>
                  Создать производственное задание
                </div>
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  Выбери изделие, количество и система подтянет активную
                  техкарту.
                </div>
              </div>

              <button
                onClick={() => setIsCreateOpen(false)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateProductionOrder}
              style={{ display: "grid", gap: 12 }}
            >
              <Field label="Изделие">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выбери изделие</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.article
                        ? `${product.name} · ${product.article}`
                        : product.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #dbeafe",
                  background: selectedTechCard ? "#f0fdf4" : "#fef2f2",
                  color: selectedTechCard ? "#166534" : "#991b1b",
                  fontWeight: 700,
                }}
              >
                {selectedProduct
                  ? selectedTechCard
                    ? `Активная техкарта найдена: ${selectedTechCard.name}`
                    : "У этого изделия нет активной техкарты"
                  : "Сначала выбери изделие"}
              </div>

              <Field label="Количество изделий">
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  step="1"
                  placeholder="Например: 50"
                  style={inputStyle}
                />
              </Field>

              <Field label="Комментарий">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  style={secondaryBlueButtonStyle()}
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    ...primaryBlueButtonStyle,
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? "Создание..." : "Создать задание"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {finishOperation && (
        <div onClick={() => setFinishOperation(null)} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Закончить работу</div>
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  {finishOperation.operation_name}
                </div>
              </div>

              <button
                onClick={() => setFinishOperation(null)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleFinishOperation}
              style={{ display: "grid", gap: 12 }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontWeight: 700,
                }}
              >
                Можно закрыть сейчас: {finishAvailableQuantity} шт
              </div>

              {finishError && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  {finishError}
                </div>
              )}

              <Field label="Сколько изделий выполнено?">
                <input
                  value={finishQuantity}
                  onChange={(e) => {
                    setFinishQuantity(e.target.value);
                    setFinishError("");
                  }}
                  type="number"
                  step="1"
                  min="1"
                  max={finishAvailableQuantity || undefined}
                  placeholder="Например: 12"
                  style={inputStyle}
                />
              </Field>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #dbeafe",
                  background: "#f8fbff",
                  color: "#0f172a",
                  fontWeight: 700,
                }}
              >
                Ставка: {formatMoney(finishOperation.price_per_unit || 0)} / шт
                <br />
                Заработано:{" "}
                {formatMoney(
                  Number(finishQuantity || 0) *
                    Number(finishOperation.price_per_unit || 0)
                )}
              </div>

              <Field label="Комментарий">
                <input
                  value={finishComment}
                  onChange={(e) => setFinishComment(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  type="button"
                  onClick={() => setFinishOperation(null)}
                  style={secondaryBlueButtonStyle()}
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    ...primaryGreenButtonStyle,
                    opacity: actionLoading ? 0.7 : 1,
                  }}
                >
                  {actionLoading ? "Сохранение..." : "Завершить операцию"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {finishBatchItem && (
        <div onClick={() => setFinishBatchItem(null)} style={modalOverlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>Закончить работу по пачке</div>
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  Пачка {finishBatchItem.batch.batch_number} ·{" "}
                  {finishBatchItem.operation?.operation_name || "Операция"}
                </div>
              </div>

              <button
                onClick={() => setFinishBatchItem(null)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleFinishBatch}
              style={{ display: "grid", gap: 12 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 10,
                }}
              >
                <InfoBox label="Всего в пачке" value={`${finishBatchTotal} шт`} />
                <InfoBox
                  label="Уже сделано"
                  value={`${finishBatchCompleted} шт`}
                />
                <InfoBox label="Осталось" value={`${finishBatchLeft} шт`} />
              </div>

              {finishBatchError && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  {finishBatchError}
                </div>
              )}

              <Field label="Сколько изделий сделал сейчас?">
                <input
                  value={finishBatchQuantity}
                  onChange={(e) => {
                    setFinishBatchQuantity(e.target.value);
                    setFinishBatchError("");
                  }}
                  type="number"
                  step="1"
                  min="1"
                  max={finishBatchLeft || undefined}
                  placeholder="Например: 20"
                  style={inputStyle}
                />
              </Field>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #dbeafe",
                  background: "#f8fbff",
                  color: "#0f172a",
                  fontWeight: 700,
                }}
              >
                Ставка:{" "}
                {formatMoney(finishBatchItem.operation?.price_per_unit || 0)} /
                шт
                <br />
                Заработано: {formatMoney(finishBatchEarned)}
              </div>

              <Field label="Комментарий">
                <input
                  value={finishBatchComment}
                  onChange={(e) => setFinishBatchComment(e.target.value)}
                  placeholder="Необязательно"
                  style={inputStyle}
                />
              </Field>

              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
              >
                <button
                  type="button"
                  onClick={() => setFinishBatchItem(null)}
                  style={secondaryBlueButtonStyle()}
                >
                  Отмена
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    ...primaryGreenButtonStyle,
                    opacity: actionLoading ? 0.7 : 1,
                  }}
                >
                  {actionLoading ? "Сохранение..." : "Сохранить результат"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrHistoryOrder && (
        <div onClick={() => setQrHistoryOrder(null)} style={modalOverlayStyle}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...modalBoxStyle, maxWidth: 760 }}
          >
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>История QR / пачки</div>
                <div style={{ marginTop: 4, color: "#64748b" }}>
                  Заказ:{" "}
                  {qrHistoryOrder.order_number ||
                    qrHistoryOrder.id.slice(0, 8)}{" "}
                  · {qrHistoryOrder.product?.name || "Без названия"}
                </div>
              </div>

              <button
                onClick={() => setQrHistoryOrder(null)}
                style={closeButtonStyle}
              >
                ×
              </button>
            </div>

            {qrHistoryLoading && (
              <div style={emptyStyle}>Загрузка QR-кодов...</div>
            )}

            {!qrHistoryLoading && qrHistoryItems.length === 0 && (
              <div style={emptyStyle}>
                По этому заказу пока нет распечатанных QR-пачек.
              </div>
            )}

            {!qrHistoryLoading && qrHistoryItems.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  maxHeight: "70vh",
                  overflow: "auto",
                }}
              >
                {qrHistoryItems.map((item) => (
                  <div
                    key={item.batchNumber}
                    style={{
                      border: "1px solid #dbeafe",
                      borderRadius: 14,
                      padding: 12,
                      background: "#f8fbff",
                    }}
                  >
                    <QrCard item={item} onPrint={printQrLabel} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QrCard({
  item,
  onPrint,
}: {
  item: GeneratedQr;
  onPrint?: (item: GeneratedQr) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <img
        src={item.dataUrl}
        alt="QR-код пачки"
        style={{
          width: 180,
          height: 180,
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #dbeafe",
        }}
      />

      <div style={{ color: "#374151", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 800, color: "#111827" }}>
          Пачка: {item.batchNumber}
        </div>

        <div>Заказ: {item.payload.order_number}</div>
        <div>Изделие: {item.payload.product_name}</div>
        <div>Артикул: {item.payload.product_article || "—"}</div>
        <div>Цвет: {item.payload.color_name || "—"}</div>
        <div>Количество в пачке: {item.payload.quantity} шт</div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <a
            href={item.dataUrl}
            download={`${item.batchNumber}.png`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#2563eb",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Скачать QR
          </a>

          {onPrint && (
            <button
              onClick={() => onPrint(item)}
              style={{
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Печать QR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 700, color: "#111827" }}>
        {value}
      </div>
    </div>
  );
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "#2563eb" : "#eff6ff",
    color: active ? "#fff" : "#1d4ed8",
    border: active ? "1px solid #2563eb" : "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

function secondaryBlueButtonStyle(): React.CSSProperties {
  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 10,
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

const primaryBlueButtonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const primaryGreenButtonStyle: React.CSSProperties = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fef2f2",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 16,
  color: "#64748b",
  background: "#f8fbff",
  fontWeight: 600,
};

const emptySmallStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 600,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalBoxStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbeafe",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  padding: 20,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 16,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#111827",
};

const closeButtonStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: 20,
  color: "#0f172a",
};

const inputStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  padding: "0 12px",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
};

/*
  CHANGELOG ERP PRODUCTION FIX
  1. Частично выполненная пачка теперь сохраняется как status = "partial".
  2. completed_quantity у пачки обновляется сразу после закрытия части пачки.
  3. current_operation_order сохраняется на текущей операции при частичном выполнении.
  4. После update production_batches выполняется select, чтобы увидеть ошибку RLS/доступа.
  5. Это нужно для повторного сканирования QR и кнопки продолжения работы.
*/
