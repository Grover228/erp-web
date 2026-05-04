import { supabase } from "../supabase";

/* =========================
   ЗАКАЗЫ
========================= */

export async function fetchProductionOrders() {
  const { data, error } = await supabase
    .from("production_orders")
    .select(`
      *,
      product:products (
        name,
        article
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

/* =========================
   ОПЕРАЦИИ
========================= */

export async function fetchOperations(orderIds: string[]) {
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("production_order_operations")
    .select("*")
    .in("production_order_id", orderIds)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return data || [];
}

/* =========================
   ПАЧКИ
========================= */

export async function fetchBatches(orderIds: string[]) {
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase
    .from("production_batches")
    .select("*")
    .in("production_order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

/* =========================
   ПОЛЬЗОВАТЕЛЬ
========================= */

export async function fetchCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user || null;
}