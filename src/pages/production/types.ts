export type ProductionTab = "jobs" | "active" | "history" | "techcards";

export type ProductionOrder = {
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

export type ProductionOrderOperation = {
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

export type GeneratedQr = {
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

export type ProductionBatch = {
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

export type ProductItem = {
  id: string;
  name: string;
  article: string | null;
};

export type TechCardItem = {
  id: string;
  product_id: string;
  name: string;
  version: number;
  is_active: boolean;
};

export type TechCardMaterial = {
  id: string;
  tech_card_id: string;
  material_id: string;
  quantity: number;
  comment: string | null;
};

export type TechCardConsumable = {
  id: string;
  tech_card_id: string;
  consumable_id: string;
  quantity: number;
  comment: string | null;
};

export type TechCardOperation = {
  id: string;
  tech_card_id: string;
  operation_name: string;
  sort_order: number;
  planned_time_min: number | null;
  price: number | null;
  comment: string | null;
};

export type MaterialPrice = {
  id: string;
  default_price: number | null;
};

export type ConsumablePrice = {
  id: string;
  default_price: number | null;
};

export type Job = {
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

export type ShiftStats = {
  operationsCount: number;
  totalQuantity: number;
  totalEarned: number;
  totalDurationSeconds: number;
};

export type ActiveBatchItem = {
  batch: ProductionBatch;
  order: ProductionOrder | null;
  operation: ProductionOrderOperation | null;
};