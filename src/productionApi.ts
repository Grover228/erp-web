import { supabase } from "../supabase";

import type {
  ProductionBatch,
  ProductionOrder,
  ProductionOrderOperation,
} from "../production/types";

export async function fetchProductionOrders() {
  const { data, error } = await supabase
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

  if (error) throw error;

  return (data as ProductionOrder[]) || [];
}

export async function fetchProductionOrderOperations(orderIds: string[]) {
  if (orderIds.length === 0) return [] as ProductionOrderOperation[];

  const { data, error } = await supabase
    .from("production_order_operations")
    .select("*")
    .in("production_order_id", orderIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data as ProductionOrderOperation[]) || [];
}

export async function fetchProductionBatches(orderIds: string[]) {
  if (orderIds.length === 0) return [] as ProductionBatch[];

  const { data, error } = await supabase
    .from("production_batches")
    .select("*")
    .in("production_order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as ProductionBatch[]) || [];
}

export async function fetchProductionOrdersBundle() {
  const orders = await fetchProductionOrders();
  const orderIds = orders.map((item) => item.id);

  if (orderIds.length === 0) {
    return {
      orders,
      operations: [] as ProductionOrderOperation[],
      batches: [] as ProductionBatch[],
    };
  }

  const [operations, batches] = await Promise.all([
    fetchProductionOrderOperations(orderIds),
    fetchProductionBatches(orderIds),
  ]);

  return {
    orders,
    operations,
    batches,
  };
}

export async function fetchCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;

  return user || null;
}
