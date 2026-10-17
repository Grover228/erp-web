import { supabase } from "../../supabase";
import type {
  ConsumablePrice,
  MaterialPrice,
  ProductItem,
  ProductionConsumableRequirement,
  ProductionMaterialRequirement,
  ProductionStockCheckResult,
  TechCardConsumable,
  TechCardItem,
  TechCardMaterial,
  TechCardOperation,
} from "./productionTypes";
import {
  convertProductionUnitsToStockUnits,
  formatQuantity,
} from "./productionUtils";

export type CreateProductionOrderInput = {
  product: ProductItem;
  techCard: TechCardItem;
  quantity: number;
  comment?: string | null;
  productionPlanItemId?: string | null;
};

export type CreateProductionOrderResult = {
  orderId: string;
  orderNumber: string;
};

export async function createProductionOrder({
  product,
  techCard,
  quantity,
  comment,
  productionPlanItemId = null,
}: CreateProductionOrderInput): Promise<CreateProductionOrderResult> {
  const orderQuantity = Number(quantity);

  if (!Number.isFinite(orderQuantity) || orderQuantity <= 0) {
    throw new Error("Укажи количество больше 0");
  }

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

  const { data: stockCheckData, error: stockCheckError } = await supabase.rpc(
    "check_production_stock",
    {
      p_tech_card_id: techCard.id,
      p_order_quantity: orderQuantity,
    },
  );

  if (stockCheckError) throw stockCheckError;

  const stockShortages = (
    (stockCheckData as ProductionStockCheckResult[]) || []
  ).filter((item) => Number(item.missing_quantity || 0) > 0);

  if (stockShortages.length > 0) {
    throw new Error(
      `Недостаточно остатков для запуска производства: ${stockShortages
        .map(
          (item) =>
            `${item.item_name}: нужно ${formatQuantity(
              Number(item.required_quantity || 0),
            )}, доступно ${formatQuantity(
              Number(item.available_quantity || 0),
            )}`,
        )
        .join("; ")}`,
    );
  }

  const materialIds = techMaterials.map((item) => item.material_id);
  const consumableIds = techConsumables.map((item) => item.consumable_id);

  const [materialsPricesResult, consumablesPricesResult] = await Promise.all([
    materialIds.length > 0
      ? supabase
          .from("materials")
          .select("id, name, default_price, production_units_per_purchase_unit")
          .in("id", materialIds)
      : Promise.resolve({ data: [], error: null }),

    consumableIds.length > 0
      ? supabase
          .from("consumables")
          .select("id, name, default_price")
          .in("id", consumableIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (materialsPricesResult.error) throw materialsPricesResult.error;
  if (consumablesPricesResult.error) throw consumablesPricesResult.error;

  const materialPrices = (materialsPricesResult.data as MaterialPrice[]) || [];
  const consumablePrices =
    (consumablesPricesResult.data as ConsumablePrice[]) || [];

  const materialPriceMap = new Map(
    materialPrices.map((item) => [item.id, Number(item.default_price || 0)]),
  );
  const consumablePriceMap = new Map(
    consumablePrices.map((item) => [
      item.id,
      Number(item.default_price || 0),
    ]),
  );
  const materialInfoMap = new Map(
    materialPrices.map((item) => [item.id, item]),
  );
  const consumableInfoMap = new Map(
    consumablePrices.map((item) => [item.id, item]),
  );

  const materialStockRequirements: ProductionMaterialRequirement[] =
    techMaterials.map((item) => {
      const materialInfo = materialInfoMap.get(item.material_id);
      const requiredProductionQuantity =
        Number(item.quantity || 0) * orderQuantity;
      const requiredStockQuantity = convertProductionUnitsToStockUnits(
        requiredProductionQuantity,
        materialInfo?.production_units_per_purchase_unit,
      );

      return {
        item_type: "material",
        material_id: item.material_id,
        quantity: requiredStockQuantity,
        name: materialInfo?.name || "Материал",
      };
    });

  const consumableStockRequirements: ProductionConsumableRequirement[] =
    techConsumables.map((item) => {
      const consumableInfo = consumableInfoMap.get(item.consumable_id);

      return {
        item_type: "consumable",
        consumable_id: item.consumable_id,
        quantity: Number(item.quantity || 0) * orderQuantity,
        name: consumableInfo?.name || "Расходник",
      };
    });

  const plannedMaterialsCost = techMaterials.reduce((sum, item) => {
    const price = materialPriceMap.get(item.material_id) || 0;
    const materialInfo = materialInfoMap.get(item.material_id);
    const productionUnitsPerPurchaseUnit = Number(
      materialInfo?.production_units_per_purchase_unit || 0,
    );
    const totalProductionQuantity = Number(item.quantity || 0) * orderQuantity;
    const totalPurchaseQuantity =
      productionUnitsPerPurchaseUnit > 0
        ? totalProductionQuantity / productionUnitsPerPurchaseUnit
        : totalProductionQuantity;

    return sum + totalPurchaseQuantity * price;
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
      production_plan_item_id: productionPlanItemId,
      order_number: orderNumber,
      quantity: orderQuantity,
      status: "draft",
      comment: comment?.trim() || null,
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
      planned_total:
        (Number(item.quantity || 0) * orderQuantity) /
          Number(
            materialInfoMap.get(item.material_id)
              ?.production_units_per_purchase_unit || 1,
          ) *
        price,
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

  const stockReservationRows = [
    ...materialStockRequirements.map((item) => ({
      source_document_type: "production_order",
      source_document_id: orderId,
      production_order_id: orderId,
      item_type: "material",
      material_id: item.material_id,
      product_id: null,
      consumable_id: null,
      quantity: item.quantity,
      status: "active",
      created_at: new Date().toISOString(),
    })),
    ...consumableStockRequirements.map((item) => ({
      source_document_type: "production_order",
      source_document_id: orderId,
      production_order_id: orderId,
      item_type: "consumable",
      material_id: null,
      product_id: null,
      consumable_id: item.consumable_id,
      quantity: item.quantity,
      status: "active",
      created_at: new Date().toISOString(),
    })),
  ].filter((item) => Number(item.quantity || 0) > 0);

  if (stockReservationRows.length > 0) {
    const { error: reservationError } = await supabase
      .from("stock_reservations")
      .insert(stockReservationRows);

    if (reservationError) throw reservationError;

    const { error: reserveOrderError } = await supabase
      .from("production_orders")
      .update({
        materials_reserved_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (reserveOrderError) throw reserveOrderError;
  }

  return { orderId, orderNumber };
}
