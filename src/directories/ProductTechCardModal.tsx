import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import OperationsCatalogModal from "./OperationsCatalogModal";

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
  comment: string | null;
  is_active: boolean;
  created_at: string | null;
};

type MaterialCatalogItem = {
  id: string;
  name: string;
  article: string | null;
  unit_id: string;
  default_price: number | null;
};

type ConsumableCatalogItem = {
  id: string;
  name: string;
  article: string | null;
  unit_id: string;
  default_price: number | null;
};

type OperationCatalogItem = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  default_time_min: number | null;
  default_price: number | null;
  is_active: boolean;
};

type MaterialRow = {
  id: string;
  tech_card_id: string;
  material_id: string;
  quantity: number;
  comment: string | null;
};

type ConsumableRow = {
  id: string;
  tech_card_id: string;
  consumable_id: string;
  quantity: number;
  comment: string | null;
};

type OperationRow = {
  id: string;
  tech_card_id: string;
  operation_name: string;
  sort_order: number;
  planned_time_min: number | null;
  price: number | null;
  comment: string | null;
};

type Props = {
  product: ProductItem;
  onClose: () => void;
};

export default function ProductTechCardModal({ product, onClose }: Props) {
  const [techCard, setTechCard] = useState<TechCardItem | null>(null);

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [consumables, setConsumables] = useState<ConsumableRow[]>([]);
  const [operations, setOperations] = useState<OperationRow[]>([]);

  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [consumableCatalog, setConsumableCatalog] = useState<ConsumableCatalogItem[]>([]);
  const [operationCatalog, setOperationCatalog] = useState<OperationCatalogItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingConsumable, setAddingConsumable] = useState(false);
  const [addingOperation, setAddingOperation] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialComment, setMaterialComment] = useState("");

  const [isAddConsumableOpen, setIsAddConsumableOpen] = useState(false);
  const [selectedConsumableId, setSelectedConsumableId] = useState("");
  const [consumableQuantity, setConsumableQuantity] = useState("");
  const [consumableComment, setConsumableComment] = useState("");

  const [isAddOperationOpen, setIsAddOperationOpen] = useState(false);
  const [isOperationsCatalogOpen, setIsOperationsCatalogOpen] = useState(false);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [operationTimeSec, setOperationTimeSec] = useState("");
  const [operationPrice, setOperationPrice] = useState("");
  const [operationComment, setOperationComment] = useState("");

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialQuantity, setEditMaterialQuantity] = useState("");
  const [editMaterialComment, setEditMaterialComment] = useState("");

  const [editingConsumableId, setEditingConsumableId] = useState<string | null>(null);
  const [editConsumableQuantity, setEditConsumableQuantity] = useState("");
  const [editConsumableComment, setEditConsumableComment] = useState("");

  const [editingOperationId, setEditingOperationId] = useState<string | null>(null);
  const [editOperationSortOrder, setEditOperationSortOrder] = useState("");
  const [editOperationTimeSec, setEditOperationTimeSec] = useState("");
  const [editOperationPrice, setEditOperationPrice] = useState("");
  const [editOperationComment, setEditOperationComment] = useState("");

  useEffect(() => {
    loadTechCard();
    loadMaterialCatalog();
    loadConsumableCatalog();
    loadOperationCatalog();
  }, [product.id]);

  const totals = useMemo(() => {
    const materialsTotal = materials.reduce((sum, row) => {
      const material = materialCatalog.find((item) => item.id === row.material_id);
      return sum + row.quantity * (material?.default_price || 0);
    }, 0);

    const consumablesTotal = consumables.reduce((sum, row) => {
      const consumable = consumableCatalog.find((item) => item.id === row.consumable_id);
      return sum + row.quantity * (consumable?.default_price || 0);
    }, 0);

    const operationsTotal = operations.reduce((sum, row) => {
      return sum + (row.price || 0);
    }, 0);

    const totalTimeSec = operations.reduce((sum, row) => {
      return sum + minutesToSeconds(row.planned_time_min);
    }, 0);

    return {
      materialsTotal,
      consumablesTotal,
      operationsTotal,
      totalCost: materialsTotal + consumablesTotal + operationsTotal,
      totalTimeSec,
    };
  }, [materials, consumables, operations, materialCatalog, consumableCatalog]);

  async function loadTechCard() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase
        .from("tech_cards")
        .select("*")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const card = data as TechCardItem | null;
      setTechCard(card);

      if (card) {
        await loadTechCardRows(card.id);
      } else {
        setMaterials([]);
        setConsumables([]);
        setOperations([]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка загрузки техкарты");
    } finally {
      setLoading(false);
    }
  }

  async function loadMaterialCatalog() {
    const { data, error } = await supabase
      .from("materials")
      .select("id, name, article, unit_id, default_price")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const safeMaterials = (data as MaterialCatalogItem[]) || [];
    setMaterialCatalog(safeMaterials);

    if (!selectedMaterialId && safeMaterials.length > 0) {
      setSelectedMaterialId(safeMaterials[0].id);
    }
  }

  async function loadConsumableCatalog() {
    const { data, error } = await supabase
      .from("consumables")
      .select("id, name, article, unit_id, default_price")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const safeConsumables = (data as ConsumableCatalogItem[]) || [];
    setConsumableCatalog(safeConsumables);

    if (!selectedConsumableId && safeConsumables.length > 0) {
      setSelectedConsumableId(safeConsumables[0].id);
    }
  }

  async function loadOperationCatalog() {
    const { data, error } = await supabase
      .from("operations")
      .select("id, name, code, description, default_time_min, default_price, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const safeOperations = (data as OperationCatalogItem[]) || [];
    setOperationCatalog(safeOperations);

    if (!selectedOperationId && safeOperations.length > 0) {
      setSelectedOperationId(safeOperations[0].id);
      setOperationTimeSec(
        safeOperations[0].default_time_min !== null
          ? String(minutesToSeconds(safeOperations[0].default_time_min))
          : ""
      );
      setOperationPrice(
        safeOperations[0].default_price !== null
          ? String(safeOperations[0].default_price)
          : ""
      );
    }
  }

  async function loadTechCardRows(techCardId: string) {
    const [materialsResult, consumablesResult, operationsResult] =
      await Promise.all([
        supabase
          .from("tech_card_materials")
          .select("*")
          .eq("tech_card_id", techCardId)
          .order("created_at", { ascending: true }),

        supabase
          .from("tech_card_consumables")
          .select("*")
          .eq("tech_card_id", techCardId)
          .order("created_at", { ascending: true }),

        supabase
          .from("tech_card_operations")
          .select("*")
          .eq("tech_card_id", techCardId)
          .order("sort_order", { ascending: true }),
      ]);

    if (materialsResult.error) throw materialsResult.error;
    if (consumablesResult.error) throw consumablesResult.error;
    if (operationsResult.error) throw operationsResult.error;

    setMaterials((materialsResult.data as MaterialRow[]) || []);
    setConsumables((consumablesResult.data as ConsumableRow[]) || []);
    setOperations((operationsResult.data as OperationRow[]) || []);
  }

  async function createTechCard() {
    try {
      setCreating(true);
      setError("");
      setMessage("");

      const { data, error } = await supabase
        .from("tech_cards")
        .insert({
          product_id: product.id,
          name: `Техкарта: ${product.name}`,
          version: 1,
          comment: null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setTechCard(data as TechCardItem);
      setMessage("Техкарта создана.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось создать техкарту");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();

    if (!techCard) return setError("Сначала создай техкарту");
    if (!selectedMaterialId) return setError("Выбери материал");
    if (!materialQuantity || Number(materialQuantity) <= 0) {
      return setError("Укажи расход материала больше 0");
    }

    try {
      setAddingMaterial(true);
      setError("");
      setMessage("");

      const { error } = await supabase.from("tech_card_materials").insert({
        tech_card_id: techCard.id,
        material_id: selectedMaterialId,
        quantity: Number(materialQuantity),
        comment: materialComment.trim() || null,
      });

      if (error) throw error;

      setMessage("Материал добавлен в техкарту.");
      setMaterialQuantity("");
      setMaterialComment("");
      setIsAddMaterialOpen(false);

      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить материал");
    } finally {
      setAddingMaterial(false);
    }
  }

  async function handleAddConsumable(e: React.FormEvent) {
    e.preventDefault();

    if (!techCard) return setError("Сначала создай техкарту");
    if (!selectedConsumableId) return setError("Выбери расходник");
    if (!consumableQuantity || Number(consumableQuantity) <= 0) {
      return setError("Укажи расход больше 0");
    }

    try {
      setAddingConsumable(true);
      setError("");
      setMessage("");

      const { error } = await supabase.from("tech_card_consumables").insert({
        tech_card_id: techCard.id,
        consumable_id: selectedConsumableId,
        quantity: Number(consumableQuantity),
        comment: consumableComment.trim() || null,
      });

      if (error) throw error;

      setMessage("Расходник добавлен в техкарту.");
      setConsumableQuantity("");
      setConsumableComment("");
      setIsAddConsumableOpen(false);

      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить расходник");
    } finally {
      setAddingConsumable(false);
    }
  }

  async function handleAddOperation(e: React.FormEvent) {
    e.preventDefault();

    if (!techCard) return setError("Сначала создай техкарту");

    const operation = operationCatalog.find((item) => item.id === selectedOperationId);
    if (!operation) return setError("Выбери операцию");

    try {
      setAddingOperation(true);
      setError("");
      setMessage("");

      const nextSortOrder = operations.length + 1;

      const { error } = await supabase.from("tech_card_operations").insert({
        tech_card_id: techCard.id,
        operation_name: operation.name,
        sort_order: nextSortOrder,
        planned_time_min: operationTimeSec ? Number(operationTimeSec) / 60 : null,
        price: operationPrice ? Number(operationPrice) : null,
        comment: operationComment.trim() || null,
      });

      if (error) throw error;

      setMessage("Операция добавлена в техкарту.");
      setOperationTimeSec("");
      setOperationPrice("");
      setOperationComment("");
      setIsAddOperationOpen(false);

      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось добавить операцию");
    } finally {
      setAddingOperation(false);
    }
  }

  async function handleUpdateMaterial(row: MaterialRow) {
    if (!techCard) return;

    if (!editMaterialQuantity || Number(editMaterialQuantity) <= 0) {
      return setError("Укажи расход материала больше 0");
    }

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_materials")
        .update({
          quantity: Number(editMaterialQuantity),
          comment: editMaterialComment.trim() || null,
        })
        .eq("id", row.id);

      if (error) throw error;

      setEditingMaterialId(null);
      setMessage("Материал обновлён.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить материал");
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateConsumable(row: ConsumableRow) {
    if (!techCard) return;

    if (!editConsumableQuantity || Number(editConsumableQuantity) <= 0) {
      return setError("Укажи расход больше 0");
    }

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_consumables")
        .update({
          quantity: Number(editConsumableQuantity),
          comment: editConsumableComment.trim() || null,
        })
        .eq("id", row.id);

      if (error) throw error;

      setEditingConsumableId(null);
      setMessage("Расходник обновлён.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить расходник");
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdateOperation(row: OperationRow) {
    if (!techCard) return;

    try {
      setUpdating(true);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_operations")
        .update({
          sort_order: editOperationSortOrder
            ? Number(editOperationSortOrder)
            : row.sort_order,
          planned_time_min: editOperationTimeSec
            ? Number(editOperationTimeSec) / 60
            : null,
          price: editOperationPrice ? Number(editOperationPrice) : null,
          comment: editOperationComment.trim() || null,
        })
        .eq("id", row.id);

      if (error) throw error;

      setEditingOperationId(null);
      setMessage("Операция обновлена.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось обновить операцию");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteMaterial(row: MaterialRow) {
    if (!techCard) return;

    const confirmed = window.confirm(
      `Удалить материал "${getMaterialName(row.material_id)}" из техкарты?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(row.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_materials")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setMessage("Материал удалён из техкарты.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить материал");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteConsumable(row: ConsumableRow) {
    if (!techCard) return;

    const confirmed = window.confirm(
      `Удалить расходник "${getConsumableName(row.consumable_id)}" из техкарты?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(row.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_consumables")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setMessage("Расходник удалён из техкарты.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить расходник");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteOperation(row: OperationRow) {
    if (!techCard) return;

    const confirmed = window.confirm(
      `Удалить операцию "${row.operation_name}" из техкарты?`
    );
    if (!confirmed) return;

    try {
      setDeletingId(row.id);
      setError("");
      setMessage("");

      const { error } = await supabase
        .from("tech_card_operations")
        .delete()
        .eq("id", row.id);

      if (error) throw error;

      setMessage("Операция удалена из техкарты.");
      await loadTechCardRows(techCard.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось удалить операцию");
    } finally {
      setDeletingId(null);
    }
  }

  function startEditMaterial(row: MaterialRow) {
    setEditingMaterialId(row.id);
    setEditMaterialQuantity(String(row.quantity));
    setEditMaterialComment(row.comment || "");
  }

  function startEditConsumable(row: ConsumableRow) {
    setEditingConsumableId(row.id);
    setEditConsumableQuantity(String(row.quantity));
    setEditConsumableComment(row.comment || "");
  }

  function startEditOperation(row: OperationRow) {
    setEditingOperationId(row.id);
    setEditOperationSortOrder(String(row.sort_order));
    setEditOperationTimeSec(String(minutesToSeconds(row.planned_time_min)));
    setEditOperationPrice(row.price !== null ? String(row.price) : "");
    setEditOperationComment(row.comment || "");
  }

  function handleSelectOperation(operationId: string) {
    setSelectedOperationId(operationId);

    const operation = operationCatalog.find((item) => item.id === operationId);

    if (operation) {
      setOperationTimeSec(
        operation.default_time_min !== null
          ? String(minutesToSeconds(operation.default_time_min))
          : ""
      );
      setOperationPrice(
        operation.default_price !== null ? String(operation.default_price) : ""
      );
    }
  }

  function getMaterialName(materialId: string) {
    const material = materialCatalog.find((item) => item.id === materialId);
    if (!material) return materialId;
    return material.article ? `${material.name} · ${material.article}` : material.name;
  }

  function getMaterialPrice(materialId: string) {
    const material = materialCatalog.find((item) => item.id === materialId);
    return material?.default_price || 0;
  }

  function getConsumableName(consumableId: string) {
    const consumable = consumableCatalog.find((item) => item.id === consumableId);
    if (!consumable) return consumableId;
    return consumable.article
      ? `${consumable.name} · ${consumable.article}`
      : consumable.name;
  }

  function getConsumablePrice(consumableId: string) {
    const consumable = consumableCatalog.find((item) => item.id === consumableId);
    return consumable?.default_price || 0;
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalBoxStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>Техкарта изделия</div>
            <div style={{ color: "#64748b", marginTop: 4 }}>
              {product.name}
              {product.article ? ` · ${product.article}` : ""}
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            ×
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

        {loading && <div style={emptyBlockStyle}>Загрузка техкарты...</div>}

        {!loading && !techCard && (
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Техкарта ещё не создана</div>

            <div style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 14 }}>
              Для этого изделия пока нет активной техкарты. Создай её, чтобы
              дальше добавить материалы, расходники и операции.
            </div>

            <button
              onClick={createTechCard}
              disabled={creating}
              style={{
                ...primaryButtonStyle,
                background: creating ? "#a5b4fc" : "#4f46e5",
              }}
            >
              {creating ? "Создание..." : "Создать техкарту"}
            </button>
          </div>
        )}

        {!loading && techCard && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>{techCard.name}</div>

              <div style={summaryGridStyle}>
                <Info label="Версия" value={String(techCard.version)} />
                <Info
                  label="Материалы"
                  value={formatMoney(totals.materialsTotal)}
                />
                <Info
                  label="Расходники"
                  value={formatMoney(totals.consumablesTotal)}
                />
                <Info
                  label="Операции"
                  value={formatMoney(totals.operationsTotal)}
                />
                <Info
                  label="Плановое время"
                  value={formatSeconds(totals.totalTimeSec)}
                />
                <Info
                  label="Себестоимость"
                  value={formatMoney(totals.totalCost)}
                />
              </div>
            </div>

            <TechBlockHeader
              title="Материалы"
              buttonText={isAddMaterialOpen ? "Закрыть" : "Добавить материал"}
              onClick={() => {
                setError("");
                setMessage("");
                setIsAddMaterialOpen((prev) => !prev);
              }}
            />

            {isAddMaterialOpen && (
              <form onSubmit={handleAddMaterial} style={addFormStyle}>
                <Field label="Материал">
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Выбери материал</option>
                    {materialCatalog.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.article
                          ? `${material.name} · ${material.article}`
                          : material.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Расход на 1 изделие">
                  <input
                    value={materialQuantity}
                    onChange={(e) => setMaterialQuantity(e.target.value)}
                    type="number"
                    step="0.001"
                    placeholder="Например: 0.25"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Комментарий">
                  <input
                    value={materialComment}
                    onChange={(e) => setMaterialComment(e.target.value)}
                    placeholder="Необязательно"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={addingMaterial}
                    style={{
                      ...primaryButtonStyle,
                      background: addingMaterial ? "#a5b4fc" : "#4f46e5",
                    }}
                  >
                    {addingMaterial ? "Добавление..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}

            <div style={rowsBoxStyle}>
              {materials.length === 0 ? (
                <div style={emptyBlockStyle}>Материалы пока не добавлены</div>
              ) : (
                materials.map((row) => (
                  <div key={row.id} style={compactRowStyle}>
                    {editingMaterialId === row.id ? (
                      <div style={editRowStyle}>
                        <Field label="Количество">
                          <input
                            value={editMaterialQuantity}
                            onChange={(e) => setEditMaterialQuantity(e.target.value)}
                            type="number"
                            step="0.001"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Комментарий">
                          <input
                            value={editMaterialComment}
                            onChange={(e) => setEditMaterialComment(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => handleUpdateMaterial(row)}
                            disabled={updating}
                            style={primarySmallButtonStyle}
                          >
                            Сохранить
                          </button>

                          <button
                            onClick={() => setEditingMaterialId(null)}
                            style={secondarySmallButtonStyle}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={rowMainStyle}>
                          <div style={rowTitleStyle}>{getMaterialName(row.material_id)}</div>
                          <div style={rowMetaStyle}>
                            Расход: {row.quantity} · Цена:{" "}
                            {formatMoney(getMaterialPrice(row.material_id))} · Итого:{" "}
                            {formatMoney(row.quantity * getMaterialPrice(row.material_id))}
                          </div>
                          <div style={rowMetaStyle}>
                            Комментарий: {row.comment || "—"}
                          </div>
                        </div>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => startEditMaterial(row)}
                            style={secondarySmallButtonStyle}
                          >
                            Редактировать
                          </button>

                          <button
                            onClick={() => handleDeleteMaterial(row)}
                            disabled={deletingId === row.id}
                            style={dangerSmallButtonStyle}
                          >
                            {deletingId === row.id ? "Удаление..." : "Удалить"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <TechBlockHeader
              title="Расходники"
              buttonText={isAddConsumableOpen ? "Закрыть" : "Добавить расходник"}
              onClick={() => {
                setError("");
                setMessage("");
                setIsAddConsumableOpen((prev) => !prev);
              }}
            />

            {isAddConsumableOpen && (
              <form onSubmit={handleAddConsumable} style={addFormStyle}>
                <Field label="Расходник">
                  <select
                    value={selectedConsumableId}
                    onChange={(e) => setSelectedConsumableId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Выбери расходник</option>
                    {consumableCatalog.map((consumable) => (
                      <option key={consumable.id} value={consumable.id}>
                        {consumable.article
                          ? `${consumable.name} · ${consumable.article}`
                          : consumable.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Расход на 1 изделие">
                  <input
                    value={consumableQuantity}
                    onChange={(e) => setConsumableQuantity(e.target.value)}
                    type="number"
                    step="0.001"
                    placeholder="Например: 1"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Комментарий">
                  <input
                    value={consumableComment}
                    onChange={(e) => setConsumableComment(e.target.value)}
                    placeholder="Необязательно"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={addingConsumable}
                    style={{
                      ...primaryButtonStyle,
                      background: addingConsumable ? "#a5b4fc" : "#4f46e5",
                    }}
                  >
                    {addingConsumable ? "Добавление..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}

            <div style={rowsBoxStyle}>
              {consumables.length === 0 ? (
                <div style={emptyBlockStyle}>Расходники пока не добавлены</div>
              ) : (
                consumables.map((row) => (
                  <div key={row.id} style={compactRowStyle}>
                    {editingConsumableId === row.id ? (
                      <div style={editRowStyle}>
                        <Field label="Количество">
                          <input
                            value={editConsumableQuantity}
                            onChange={(e) => setEditConsumableQuantity(e.target.value)}
                            type="number"
                            step="0.001"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Комментарий">
                          <input
                            value={editConsumableComment}
                            onChange={(e) => setEditConsumableComment(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => handleUpdateConsumable(row)}
                            disabled={updating}
                            style={primarySmallButtonStyle}
                          >
                            Сохранить
                          </button>

                          <button
                            onClick={() => setEditingConsumableId(null)}
                            style={secondarySmallButtonStyle}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={rowMainStyle}>
                          <div style={rowTitleStyle}>
                            {getConsumableName(row.consumable_id)}
                          </div>
                          <div style={rowMetaStyle}>
                            Расход: {row.quantity} · Цена:{" "}
                            {formatMoney(getConsumablePrice(row.consumable_id))} · Итого:{" "}
                            {formatMoney(
                              row.quantity * getConsumablePrice(row.consumable_id)
                            )}
                          </div>
                          <div style={rowMetaStyle}>
                            Комментарий: {row.comment || "—"}
                          </div>
                        </div>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => startEditConsumable(row)}
                            style={secondarySmallButtonStyle}
                          >
                            Редактировать
                          </button>

                          <button
                            onClick={() => handleDeleteConsumable(row)}
                            disabled={deletingId === row.id}
                            style={dangerSmallButtonStyle}
                          >
                            {deletingId === row.id ? "Удаление..." : "Удалить"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={blockHeaderStyle}>
              <div style={sectionTitleStyle}>Операции</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setIsOperationsCatalogOpen(true)}
                  style={secondaryButtonStyle}
                >
                  Редактировать список операций
                </button>

                <button
                  onClick={() => {
                    setError("");
                    setMessage("");
                    setIsAddOperationOpen((prev) => !prev);
                  }}
                  style={secondaryButtonStyle}
                >
                  {isAddOperationOpen ? "Закрыть" : "Добавить операцию"}
                </button>
              </div>
            </div>

            {isAddOperationOpen && (
              <form onSubmit={handleAddOperation} style={addFormStyle}>
                <Field label="Операция">
                  <select
                    value={selectedOperationId}
                    onChange={(e) => handleSelectOperation(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Выбери операцию</option>
                    {operationCatalog.map((operation) => (
                      <option key={operation.id} value={operation.id}>
                        {operation.code
                          ? `${operation.name} · ${operation.code}`
                          : operation.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Время, секунд">
                  <input
                    value={operationTimeSec}
                    onChange={(e) => setOperationTimeSec(e.target.value)}
                    type="number"
                    step="1"
                    placeholder="Например: 45"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Цена операции">
                  <input
                    value={operationPrice}
                    onChange={(e) => setOperationPrice(e.target.value)}
                    type="number"
                    step="0.01"
                    placeholder="Например: 15"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Комментарий">
                  <input
                    value={operationComment}
                    onChange={(e) => setOperationComment(e.target.value)}
                    placeholder="Необязательно"
                    style={inputStyle}
                  />
                </Field>

                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    type="submit"
                    disabled={addingOperation}
                    style={{
                      ...primaryButtonStyle,
                      background: addingOperation ? "#a5b4fc" : "#4f46e5",
                    }}
                  >
                    {addingOperation ? "Добавление..." : "Сохранить"}
                  </button>
                </div>
              </form>
            )}

            <div style={rowsBoxStyle}>
              {operations.length === 0 ? (
                <div style={emptyBlockStyle}>Операции пока не добавлены</div>
              ) : (
                operations.map((row) => (
                  <div key={row.id} style={compactRowStyle}>
                    {editingOperationId === row.id ? (
                      <div style={editRowStyle}>
                        <Field label="Порядок">
                          <input
                            value={editOperationSortOrder}
                            onChange={(e) => setEditOperationSortOrder(e.target.value)}
                            type="number"
                            step="1"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Время, секунд">
                          <input
                            value={editOperationTimeSec}
                            onChange={(e) => setEditOperationTimeSec(e.target.value)}
                            type="number"
                            step="1"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Цена">
                          <input
                            value={editOperationPrice}
                            onChange={(e) => setEditOperationPrice(e.target.value)}
                            type="number"
                            step="0.01"
                            style={inputStyle}
                          />
                        </Field>

                        <Field label="Комментарий">
                          <input
                            value={editOperationComment}
                            onChange={(e) => setEditOperationComment(e.target.value)}
                            style={inputStyle}
                          />
                        </Field>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => handleUpdateOperation(row)}
                            disabled={updating}
                            style={primarySmallButtonStyle}
                          >
                            Сохранить
                          </button>

                          <button
                            onClick={() => setEditingOperationId(null)}
                            style={secondarySmallButtonStyle}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={rowMainStyle}>
                          <div style={rowTitleStyle}>
                            {row.sort_order}. {row.operation_name}
                          </div>
                          <div style={rowMetaStyle}>
                            Время: {formatSeconds(minutesToSeconds(row.planned_time_min))} · Цена:{" "}
                            {formatMoney(row.price || 0)}
                          </div>
                          <div style={rowMetaStyle}>
                            Комментарий: {row.comment || "—"}
                          </div>
                        </div>

                        <div style={rowActionsStyle}>
                          <button
                            onClick={() => startEditOperation(row)}
                            style={secondarySmallButtonStyle}
                          >
                            Редактировать
                          </button>

                          <button
                            onClick={() => handleDeleteOperation(row)}
                            disabled={deletingId === row.id}
                            style={dangerSmallButtonStyle}
                          >
                            {deletingId === row.id ? "Удаление..." : "Удалить"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isOperationsCatalogOpen && (
          <OperationsCatalogModal
            onClose={() => setIsOperationsCatalogOpen(false)}
            onChanged={loadOperationCatalog}
          />
        )}
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
    <div style={fieldStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fbff",
        border: "1px solid #dbe4f0",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
        {label}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TechBlockHeader({
  title,
  buttonText,
  onClick,
}: {
  title: string;
  buttonText: string;
  onClick: () => void;
}) {
  return (
    <div style={blockHeaderStyle}>
      <div style={sectionTitleStyle}>{title}</div>

      <button onClick={onClick} style={secondaryButtonStyle}>
        {buttonText}
      </button>
    </div>
  );
}

function minutesToSeconds(minutes: number | null) {
  if (minutes === null) return 0;
  return Math.round(minutes * 60);
}

function formatSeconds(seconds: number) {
  if (!seconds) return "0 сек";

  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  if (minutes === 0) return `${restSeconds} сек`;
  if (restSeconds === 0) return `${minutes} мин`;

  return `${minutes} мин ${restSeconds} сек`;
}

function formatMoney(value: number) {
  return `${Number(value || 0).toFixed(2)} ₽`;
}

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
  maxWidth: 1180,
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbe4f0",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
  padding: 20,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  color: "#0f172a",
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

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#0f172a",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const blockHeaderStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const rowsBoxStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 16,
  overflow: "hidden",
};

const compactRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid #eef2f7",
  flexWrap: "wrap",
};

const rowMainStyle: React.CSSProperties = {
  minWidth: 220,
  flex: "1 1 420px",
};

const rowTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  marginBottom: 4,
};

const rowMetaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.45,
};

const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const editRowStyle: React.CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const emptyBlockStyle: React.CSSProperties = {
  padding: 14,
  color: "#64748b",
  fontWeight: 600,
};

const addFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  padding: 14,
  borderRadius: 14,
  background: "#f8fbff",
  border: "1px solid #dbe4f0",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
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

const primaryButtonStyle: React.CSSProperties = {
  height: 44,
  border: "none",
  borderRadius: 12,
  background: "#4f46e5",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  padding: "0 16px",
  boxShadow: "0 8px 18px rgba(79, 70, 229, 0.18)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

const primarySmallButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#4f46e5",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondarySmallButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerSmallButtonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#dc2626",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
};