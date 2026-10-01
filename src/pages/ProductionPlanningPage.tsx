import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type ProductionSeason = {
  id: string;
  code: string;
  name: string;
  total_plan: number;
  start_date: string;
  end_date: string | null;
  status: "planned" | "active" | "closed";
  comment: string | null;
};

type Product = {
  id: string;
  name: string;
  article: string | null;
};

type PlanItem = {
  id: string;
  season_id: string;
  product_id: string;
  plan_quantity: number;
  sort_order: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  comment: string | null;
  product: Product | null;
};

type ProductionOrder = {
  id: string;
  product_id: string;
  order_number: string;
  quantity: number;
  status: string;
  created_at: string;
};

type ProductionOperation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  completed_quantity: number;
  status: string;
};

type ItemStats = {
  ordered: number;
  completed: number;
  stages: Array<{
    name: string;
    sortOrder: number;
    completed: number;
  }>;
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.05)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  color: "#0f172a",
  background: "#ffffff",
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 750,
  cursor: "pointer",
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function formatQty(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 3,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Не задано";

  return new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function statusLabel(value: string) {
  switch (value) {
    case "planned":
      return "Планируется";
    case "active":
      return "Активный";
    case "closed":
      return "Закрыт";
    default:
      return value;
  }
}

function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const progress = percent(value, total);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 13,
          color: "#475569",
        }}
      >
        <span>{label}</span>
        <strong style={{ color: "#0f172a" }}>
          {formatQty(value)} / {formatQty(total)} · {progress.toFixed(1)}%
        </strong>
      </div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
            transition: "width 180ms ease",
          }}
        />
      </div>
    </div>
  );
}

export default function ProductionPlanningPage() {
  const [seasons, setSeasons] = useState<ProductionSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [operations, setOperations] = useState<ProductionOperation[]>([]);

  const [loading, setLoading] = useState(false);
  const [savingSeason, setSavingSeason] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [seasonPlanInput, setSeasonPlanInput] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newPlanQuantity, setNewPlanQuantity] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedSeasonId) return;
    loadSeasonData(selectedSeasonId);
  }, [selectedSeasonId]);

  const selectedSeason =
    seasons.find((season) => season.id === selectedSeasonId) || null;

  useEffect(() => {
    setSeasonPlanInput(
      selectedSeason ? String(toNumber(selectedSeason.total_plan)) : "",
    );
  }, [selectedSeason?.id, selectedSeason?.total_plan]);

  async function loadInitial() {
    try {
      setLoading(true);
      setError("");

      const [seasonsResult, productsResult] = await Promise.all([
        supabase
          .from("production_seasons")
          .select("*")
          .order("start_date", { ascending: false }),

        supabase
          .from("products")
          .select("id, name, article")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (seasonsResult.error) throw seasonsResult.error;
      if (productsResult.error) throw productsResult.error;

      const safeSeasons = (seasonsResult.data as ProductionSeason[]) || [];
      setSeasons(safeSeasons);
      setProducts((productsResult.data as Product[]) || []);

      if (safeSeasons.length > 0) {
        setSelectedSeasonId((current) => current || safeSeasons[0].id);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить план производства",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSeasonData(seasonId: string) {
    const season = seasons.find((item) => item.id === seasonId);
    if (!season) return;

    try {
      setLoading(true);
      setError("");

      let ordersQuery = supabase
        .from("production_orders")
        .select("id, product_id, order_number, quantity, status, created_at")
        .gte("created_at", `${season.start_date}T00:00:00`)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });

      if (season.end_date) {
        ordersQuery = ordersQuery.lte(
          "created_at",
          `${season.end_date}T23:59:59.999`,
        );
      }

      const [itemsResult, ordersResult] = await Promise.all([
        supabase
          .from("production_plan_items")
          .select(
            "id, season_id, product_id, plan_quantity, sort_order, planned_start_date, planned_end_date, comment, product:products(id, name, article)",
          )
          .eq("season_id", seasonId)
          .order("sort_order", { ascending: true }),

        ordersQuery,
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const safeItems = ((itemsResult.data || []) as unknown as PlanItem[]) || [];
      const safeOrders = (ordersResult.data as ProductionOrder[]) || [];

      setPlanItems(safeItems);
      setOrders(safeOrders);

      const orderIds = safeOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        setOperations([]);
        return;
      }

      const { data: operationsData, error: operationsError } = await supabase
        .from("production_order_operations")
        .select(
          "id, production_order_id, operation_name, sort_order, completed_quantity, status",
        )
        .in("production_order_id", orderIds)
        .order("sort_order", { ascending: true });

      if (operationsError) throw operationsError;

      setOperations((operationsData as ProductionOperation[]) || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить данные сезона",
      );
    } finally {
      setLoading(false);
    }
  }

  const orderMap = useMemo(() => {
    return new Map(orders.map((order) => [order.id, order]));
  }, [orders]);

  const statsByProduct = useMemo(() => {
    const map = new Map<string, ItemStats>();

    for (const order of orders) {
      const current = map.get(order.product_id) || {
        ordered: 0,
        completed: 0,
        stages: [],
      };

      current.ordered += toNumber(order.quantity);
      map.set(order.product_id, current);
    }

    const operationTotals = new Map<
      string,
      Map<string, { name: string; sortOrder: number; completed: number }>
    >();
    const finalOperationByOrder = new Map<string, ProductionOperation>();

    for (const operation of operations) {
      const order = orderMap.get(operation.production_order_id);
      if (!order) continue;

      const byStage =
        operationTotals.get(order.product_id) ||
        new Map<
          string,
          { name: string; sortOrder: number; completed: number }
        >();

      const key = `${operation.sort_order}:${operation.operation_name}`;
      const stage = byStage.get(key) || {
        name: operation.operation_name,
        sortOrder: operation.sort_order,
        completed: 0,
      };

      stage.completed += toNumber(operation.completed_quantity);
      byStage.set(key, stage);
      operationTotals.set(order.product_id, byStage);

      const finalOperation = finalOperationByOrder.get(order.id);
      if (!finalOperation || operation.sort_order > finalOperation.sort_order) {
        finalOperationByOrder.set(order.id, operation);
      }
    }

    for (const operation of finalOperationByOrder.values()) {
      const order = orderMap.get(operation.production_order_id);
      if (!order) continue;

      const current = map.get(order.product_id) || {
        ordered: 0,
        completed: 0,
        stages: [],
      };

      current.completed += toNumber(operation.completed_quantity);
      map.set(order.product_id, current);
    }

    for (const [productId, stages] of operationTotals.entries()) {
      const current = map.get(productId) || {
        ordered: 0,
        completed: 0,
        stages: [],
      };

      current.stages = Array.from(stages.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );

      map.set(productId, current);
    }

    return map;
  }, [orders, operations, orderMap]);

  const allocatedPlan = useMemo(
    () => planItems.reduce((sum, item) => sum + toNumber(item.plan_quantity), 0),
    [planItems],
  );

  const seasonPlan = toNumber(selectedSeason?.total_plan);
  const seasonOrdered = useMemo(
    () => orders.reduce((sum, order) => sum + toNumber(order.quantity), 0),
    [orders],
  );
  const seasonCompleted = useMemo(
    () =>
      planItems.reduce(
        (sum, item) =>
          sum + (statsByProduct.get(item.product_id)?.completed || 0),
        0,
      ),
    [planItems, statsByProduct],
  );
  const unallocatedPlan = Math.max(0, seasonPlan - allocatedPlan);

  const availableProducts = useMemo(() => {
    const usedProductIds = new Set(planItems.map((item) => item.product_id));
    return products.filter((product) => !usedProductIds.has(product.id));
  }, [products, planItems]);

  const calendarItems = useMemo(() => {
    return [...planItems].sort((a, b) => {
      if (!a.planned_start_date && !b.planned_start_date) {
        return a.sort_order - b.sort_order;
      }
      if (!a.planned_start_date) return 1;
      if (!b.planned_start_date) return -1;
      return a.planned_start_date.localeCompare(b.planned_start_date);
    });
  }, [planItems]);

  async function saveSeasonPlan() {
    if (!selectedSeason) return;

    const nextPlan = Number(seasonPlanInput);
    if (!Number.isFinite(nextPlan) || nextPlan < 0) {
      setError("Общий план сезона должен быть числом не меньше 0");
      return;
    }

    try {
      setSavingSeason(true);
      setError("");
      setMessage("");

      const { error: updateError } = await supabase
        .from("production_seasons")
        .update({
          total_plan: nextPlan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedSeason.id);

      if (updateError) throw updateError;

      setSeasons((current) =>
        current.map((season) =>
          season.id === selectedSeason.id
            ? { ...season, total_plan: nextPlan }
            : season,
        ),
      );

      setMessage("Общий план сезона сохранён.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить план сезона",
      );
    } finally {
      setSavingSeason(false);
    }
  }

  async function savePlanItem(item: PlanItem) {
    try {
      setSavingItemId(item.id);
      setError("");
      setMessage("");

      const { error: updateError } = await supabase
        .from("production_plan_items")
        .update({
          plan_quantity: toNumber(item.plan_quantity),
          planned_start_date: item.planned_start_date || null,
          planned_end_date: item.planned_end_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      setMessage(
        `План по ${item.product?.article || item.product?.name || "изделию"} сохранён.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить строку плана",
      );
    } finally {
      setSavingItemId(null);
    }
  }

  async function addPlanItem() {
    if (!selectedSeason) return;

    const quantity = Number(newPlanQuantity);
    if (!newProductId) {
      setError("Выбери изделие");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Укажи плановое количество больше 0");
      return;
    }

    if (newStartDate && newEndDate && newEndDate < newStartDate) {
      setError("Дата окончания не может быть раньше даты начала");
      return;
    }

    try {
      setAddingItem(true);
      setError("");
      setMessage("");

      const nextSortOrder =
        planItems.reduce(
          (maxValue, item) => Math.max(maxValue, item.sort_order || 0),
          0,
        ) + 10;

      const { error: insertError } = await supabase
        .from("production_plan_items")
        .insert({
          season_id: selectedSeason.id,
          product_id: newProductId,
          plan_quantity: quantity,
          sort_order: nextSortOrder,
          planned_start_date: newStartDate || null,
          planned_end_date: newEndDate || null,
        });

      if (insertError) throw insertError;

      setNewProductId("");
      setNewPlanQuantity("");
      setNewStartDate("");
      setNewEndDate("");
      setMessage("Изделие добавлено в план.");

      await loadSeasonData(selectedSeason.id);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось добавить изделие в план",
      );
    } finally {
      setAddingItem(false);
    }
  }

  async function removePlanItem(item: PlanItem) {
    const title = item.product?.article || item.product?.name || "изделие";
    if (!window.confirm(`Убрать ${title} из плана сезона?`)) return;

    try {
      setSavingItemId(item.id);
      setError("");
      setMessage("");

      const { error: deleteError } = await supabase
        .from("production_plan_items")
        .delete()
        .eq("id", item.id);

      if (deleteError) throw deleteError;

      setPlanItems((current) =>
        current.filter((currentItem) => currentItem.id !== item.id),
      );
      setMessage("Строка удалена из плана.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось удалить строку плана",
      );
    } finally {
      setSavingItemId(null);
    }
  }

  function updateLocalItem(
    itemId: string,
    patch: Partial<Pick<PlanItem, "plan_quantity" | "planned_start_date" | "planned_end_date">>,
  ) {
    setPlanItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
  }

  if (loading && seasons.length === 0) {
    return <div style={cardStyle}>Загружаю план производства...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {error && (
        <div
          style={{
            ...cardStyle,
            borderColor: "#fecaca",
            background: "#fff7f7",
            color: "#991b1b",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            ...cardStyle,
            borderColor: "#bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          ...cardStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240, flex: "1 1 360px" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
            Сезон
          </div>
          <select
            value={selectedSeasonId}
            onChange={(event) => setSelectedSeasonId(event.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.code} · {season.name}
              </option>
            ))}
          </select>

          {selectedSeason && (
            <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
              С {formatDate(selectedSeason.start_date)}
              {selectedSeason.end_date
                ? ` по ${formatDate(selectedSeason.end_date)}`
                : " · без даты закрытия"}{" "}
              · {statusLabel(selectedSeason.status)}
            </div>
          )}
        </div>

        {selectedSeason && (
          <div style={{ width: 260, maxWidth: "100%" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
              Общий план, шт.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                type="number"
                min="0"
                step="1"
                value={seasonPlanInput}
                onChange={(event) => setSeasonPlanInput(event.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={saveSeasonPlan}
                disabled={savingSeason}
                style={{
                  ...primaryButtonStyle,
                  opacity: savingSeason ? 0.55 : 1,
                }}
              >
                {savingSeason ? "..." : "Сохранить"}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedSeason && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <KpiCard
              title="План сезона"
              value={seasonPlan}
              hint={selectedSeason.code}
            />
            <KpiCard
              title="Распределено"
              value={allocatedPlan}
              hint={`${percent(allocatedPlan, seasonPlan).toFixed(1)}% плана`}
            />
            <KpiCard
              title="Запущено"
              value={seasonOrdered}
              hint={`${percent(seasonOrdered, seasonPlan).toFixed(1)}% плана`}
            />
            <KpiCard
              title="Готово"
              value={seasonCompleted}
              hint={`${percent(seasonCompleted, seasonPlan).toFixed(1)}% плана`}
            />
            <KpiCard
              title="Не распределено"
              value={unallocatedPlan}
              hint="Нужно разнести по артикулам"
            />
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#0f172a",
                marginBottom: 14,
              }}
            >
              Выполнение сезона
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <ProgressBar
                label="Запущено в производство"
                value={seasonOrdered}
                total={seasonPlan}
              />
              <ProgressBar
                label="Фактически готово"
                value={seasonCompleted}
                total={seasonPlan}
              />
              <ProgressBar
                label="Распределено по артикулам"
                value={allocatedPlan}
                total={seasonPlan}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {planItems.map((item) => {
              const stats = statsByProduct.get(item.product_id) || {
                ordered: 0,
                completed: 0,
                stages: [],
              };
              const itemPlan = toNumber(item.plan_quantity);
              const remainingToOrder = Math.max(0, itemPlan - stats.ordered);

              return (
                <div key={item.id} style={cardStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#0f172a",
                        }}
                      >
                        {item.product?.name || "Изделие"}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#64748b",
                        }}
                      >
                        {item.product?.article || "Без артикула"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        flexWrap: "wrap",
                        fontSize: 13,
                        color: "#475569",
                      }}
                    >
                      <span>
                        План: <strong>{formatQty(itemPlan)}</strong>
                      </span>
                      <span>
                        Запущено: <strong>{formatQty(stats.ordered)}</strong>
                      </span>
                      <span>
                        Готово: <strong>{formatQty(stats.completed)}</strong>
                      </span>
                      <span>
                        К запуску: <strong>{formatQty(remainingToOrder)}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                    <ProgressBar
                      label="Заказы"
                      value={stats.ordered}
                      total={itemPlan}
                    />

                    {stats.stages.map((stage) => (
                      <ProgressBar
                        key={`${item.id}-${stage.sortOrder}-${stage.name}`}
                        label={stage.name}
                        value={stage.completed}
                        total={itemPlan}
                      />
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(130px, 0.6fr) minmax(150px, 1fr) minmax(150px, 1fr) auto",
                      gap: 10,
                      marginTop: 18,
                      alignItems: "end",
                    }}
                  >
                    <Field label="План, шт.">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.plan_quantity}
                        onChange={(event) =>
                          updateLocalItem(item.id, {
                            plan_quantity: Number(event.target.value),
                          })
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Плановый старт">
                      <input
                        type="date"
                        value={item.planned_start_date || ""}
                        onChange={(event) =>
                          updateLocalItem(item.id, {
                            planned_start_date: event.target.value || null,
                          })
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Плановое окончание">
                      <input
                        type="date"
                        value={item.planned_end_date || ""}
                        onChange={(event) =>
                          updateLocalItem(item.id, {
                            planned_end_date: event.target.value || null,
                          })
                        }
                        style={inputStyle}
                      />
                    </Field>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => savePlanItem(item)}
                        disabled={savingItemId === item.id}
                        style={{
                          ...primaryButtonStyle,
                          opacity: savingItemId === item.id ? 0.55 : 1,
                        }}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => removePlanItem(item)}
                        disabled={savingItemId === item.id}
                        style={{
                          ...secondaryButtonStyle,
                          color: "#b91c1c",
                          borderColor: "#fecaca",
                        }}
                      >
                        Убрать
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#0f172a",
                marginBottom: 14,
              }}
            >
              Добавить изделие в план
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(220px, 1.5fr) minmax(120px, 0.6fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr) auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <Field label="Изделие">
                <select
                  value={newProductId}
                  onChange={(event) => setNewProductId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Выбрать...</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.article ? `${product.article} · ` : ""}
                      {product.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="План, шт.">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newPlanQuantity}
                  onChange={(event) => setNewPlanQuantity(event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Старт">
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(event) => setNewStartDate(event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Окончание">
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(event) => setNewEndDate(event.target.value)}
                  style={inputStyle}
                />
              </Field>

              <button
                type="button"
                onClick={addPlanItem}
                disabled={addingItem}
                style={{
                  ...primaryButtonStyle,
                  opacity: addingItem ? 0.55 : 1,
                }}
              >
                {addingItem ? "Добавляю..." : "Добавить"}
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "#0f172a",
                marginBottom: 14,
              }}
            >
              Календарь производства
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 760,
                }}
              >
                <thead>
                  <tr>
                    {[
                      "Изделие",
                      "План",
                      "Старт",
                      "Окончание",
                      "Запущено",
                      "Готово",
                      "Осталось",
                    ].map((title) => (
                      <th
                        key={title}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#64748b",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarItems.map((item) => {
                    const stats = statsByProduct.get(item.product_id) || {
                      ordered: 0,
                      completed: 0,
                      stages: [],
                    };
                    const itemPlan = toNumber(item.plan_quantity);

                    return (
                      <tr key={item.id}>
                        <td
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #eef2f7",
                          }}
                        >
                          <div style={{ fontWeight: 850, color: "#0f172a" }}>
                            {item.product?.name || "Изделие"}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              marginTop: 3,
                            }}
                          >
                            {item.product?.article || "—"}
                          </div>
                        </td>
                        <td style={tableCellStyle}>{formatQty(itemPlan)}</td>
                        <td style={tableCellStyle}>
                          {formatDate(item.planned_start_date)}
                        </td>
                        <td style={tableCellStyle}>
                          {formatDate(item.planned_end_date)}
                        </td>
                        <td style={tableCellStyle}>
                          {formatQty(stats.ordered)}
                        </td>
                        <td style={tableCellStyle}>
                          {formatQty(stats.completed)}
                        </td>
                        <td style={tableCellStyle}>
                          {formatQty(Math.max(0, itemPlan - stats.ordered))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {calendarItems.length === 0 && (
              <div style={{ color: "#64748b", padding: "10px 0" }}>
                В сезоне пока нет строк плана.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b" }}>
        {title}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 950,
          color: "#0f172a",
        }}
      >
        {formatQty(value)}
      </div>
      <div style={{ marginTop: 7, fontSize: 12, color: "#64748b" }}>{hint}</div>
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
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const tableCellStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  fontSize: 13,
};
