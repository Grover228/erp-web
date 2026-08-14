import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";
import * as XLSX from "xlsx";
import BulkEditModal from "./BulkEditModal";
import InventoryImportModal from "./InventoryImportModal";

type StockItemType = "product" | "resale_product" | "material" | "consumable";
type StockTab = "all" | StockItemType;
type AdjustmentMode = "receipt" | "write_off";

type BulkEditChange = {
  id: string;
  itemType: StockItemType;
  currentName: string;
  newName: string;
  currentArticle: string;
  newArticle: string;
  currentColor: string;
  newColor: string;
  currentPrice: number;
  newPrice: number;
  changes: string[];
};

type StockAvailableRow = {
  item_type: StockItemType | string;
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  item_id: string | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
  quantity_available: number | null;
};

type ProductCatalogItem = {
  id: string;
  name: string | null;
  article: string | null;
};

type ResaleCatalogItem = {
  id: string;
  name: string | null;
  article: string | null;
  default_price: number | null;
  source_id: string | null;
  is_active: boolean | null;
};

type MaterialCatalogItem = {
  id: string;
  name: string | null;
  article: string | null;
  color_id: string | null;
  default_price: number | null;
};

type ConsumableCatalogItem = {
  id: string;
  name: string | null;
  article: string | null;
  default_price: number | null;
};

type ColorCatalogItem = {
  id: string;
  name: string | null;
  hex: string | null;
};

type StockMovementRow = {
  id?: string;
  item_type: StockItemType | string;
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  item_id: string | null;
  movement_type: string | null;
  source_document_type: string | null;
  source_document_id?: string | null;
  production_order_id?: string | null;
  quantity?: number | null;
  created_at: string | null;
};

type ProductionOrderCostRow = {
  product_id: string | null;
  quantity: number | null;
  planned_total_cost: number | null;
};

type StockRow = {
  key: string;
  itemType: StockItemType;
  itemId: string;
  name: string;
  article: string;
  colorName: string;
  colorHex: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  avgPrice: number;
  amount: number;
  lastMovementDate: string;
  lastMovementType: string;
  lastDocumentType: string;
};

function formatMoney(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number) {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function getStockKey(itemType: string, itemId: string | null) {
  return `${itemType}-${itemId || ""}`;
}

function getStockRowId(row: StockAvailableRow) {
  if (row.item_type === "resale_product") return row.item_id;
  if (row.item_type === "product") return row.product_id;
  if (row.item_type === "material") return row.material_id;
  if (row.item_type === "consumable") return row.consumable_id;
  return null;
}

function getMovementLabel(type: string) {
  if (type === "receipt") return "Поступление";
  if (type === "incoming") return "Приход";
  if (type === "outgoing") return "Расход";
  if (type === "production_receipt") return "Выпуск продукции";
  if (type === "production_write_off") return "Списание в производство";
  if (type === "manual_receipt") return "Оприходование";
  if (type === "manual_write_off") return "Списание";
  if (type === "reservation") return "Резерв";
  if (type === "release") return "Снятие резерва";
  return type || "—";
}

function getDocumentLabel(type: string) {
  if (type === "supplier_receipt") return "Приёмка поставщика";
  if (type === "production_order") return "Производство";
  if (type === "customer_shipment") return "Отгрузка покупателю";
  if (type === "customer_order") return "Заказ покупателя";
  if (type === "stock_adjustment") return "Корректировка склада";
  return type || "—";
}

export default function StockPage() {
  const [stockAvailable, setStockAvailable] = useState<StockAvailableRow[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [resaleProducts, setResaleProducts] = useState<ResaleCatalogItem[]>([]);
  const [materials, setMaterials] = useState<MaterialCatalogItem[]>([]);
  const [consumables, setConsumables] = useState<ConsumableCatalogItem[]>([]);
  const [colors, setColors] = useState<ColorCatalogItem[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [productionCosts, setProductionCosts] = useState<ProductionOrderCostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<StockTab>("all");
  const [search, setSearch] = useState("");
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode | null>(null);
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentComment, setAdjustmentComment] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [inventoryImportOpen, setInventoryImportOpen] = useState(false);
  const [bulkEditSaving, setBulkEditSaving] = useState(false);
  const [inventoryImportSaving, setInventoryImportSaving] = useState(false);

  useEffect(() => {
    loadStockItems();
  }, []);

  async function loadStockItems() {
    try {
      setLoading(true);
      setError("");

      const [
        stockResult,
        productsResult,
        resaleProductsResult,
        materialsResult,
        consumablesResult,
        colorsResult,
        movementsResult,
        productionCostsResult,
      ] = await Promise.all([
        supabase
          .from("stock_available")
          .select(
            "item_type, product_id, material_id, consumable_id, item_id, quantity_on_hand, quantity_reserved, quantity_available",
          ),

        supabase
          .from("products")
          .select("id, name, article")
          .order("name", { ascending: true }),

        supabase
          .from("items")
          .select("id, name, article, default_price, source_id, is_active")
          .eq("item_type", "resale_product")
          .order("name", { ascending: true }),

        supabase
          .from("materials")
          .select("id, name, article, color_id, default_price")
          .order("name", { ascending: true }),

        supabase
          .from("consumables")
          .select("id, name, article, default_price")
          .order("name", { ascending: true }),

        supabase
          .from("colors")
          .select("id, name, hex")
          .order("name", { ascending: true }),

        supabase
          .from("stock_movements")
          .select(
            "id, item_type, product_id, material_id, consumable_id, item_id, movement_type, source_document_type, source_document_id, production_order_id, quantity, created_at",
          )
          .order("created_at", { ascending: false }),

        supabase
          .from("production_orders")
          .select("product_id, quantity, planned_total_cost")
          .eq("status", "done"),
      ]);

      if (stockResult.error) throw stockResult.error;
      if (productsResult.error) throw productsResult.error;
      if (resaleProductsResult.error) throw resaleProductsResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (consumablesResult.error) throw consumablesResult.error;
      if (colorsResult.error) throw colorsResult.error;
      if (movementsResult.error) throw movementsResult.error;
      if (productionCostsResult.error) throw productionCostsResult.error;

      setStockAvailable((stockResult.data as StockAvailableRow[]) || []);
      setProducts((productsResult.data as ProductCatalogItem[]) || []);
      setResaleProducts((resaleProductsResult.data as ResaleCatalogItem[]) || []);
      setMaterials((materialsResult.data as MaterialCatalogItem[]) || []);
      setConsumables((consumablesResult.data as ConsumableCatalogItem[]) || []);
      setColors((colorsResult.data as ColorCatalogItem[]) || []);
      setMovements((movementsResult.data as StockMovementRow[]) || []);
      setProductionCosts((productionCostsResult.data as ProductionOrderCostRow[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки остатков",
      );
    } finally {
      setLoading(false);
    }
  }


  function openAdjustment(mode: AdjustmentMode) {
    setAdjustmentMode(mode);
    setAdjustmentQuantity("");
    setAdjustmentReason("");
    setAdjustmentComment("");
    setAdjustmentError("");
  }

  function closeAdjustmentForm() {
    setAdjustmentMode(null);
    setAdjustmentQuantity("");
    setAdjustmentReason("");
    setAdjustmentComment("");
    setAdjustmentError("");
  }

  async function handleSaveAdjustment(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedRow || !adjustmentMode) return;

    const quantityValue = Number(adjustmentQuantity.replace(",", "."));

    if (!adjustmentQuantity || Number.isNaN(quantityValue) || quantityValue <= 0) {
      setAdjustmentError("Укажи количество больше 0.");
      return;
    }

    if (
      adjustmentMode === "write_off" &&
      quantityValue > Number(selectedRow.quantityAvailable || 0)
    ) {
      setAdjustmentError(
        `Нельзя списать ${formatQuantity(quantityValue)}. Доступно только ${formatQuantity(
          selectedRow.quantityAvailable,
        )}.`,
      );
      return;
    }

    try {
      setAdjustmentSaving(true);
      setAdjustmentError("");
      setError("");

      const signedQuantity =
        adjustmentMode === "receipt" ? quantityValue : -Math.abs(quantityValue);

      const movementRow = {
        movement_type:
          adjustmentMode === "receipt" ? "manual_receipt" : "manual_write_off",
        source_document_type: "stock_adjustment",
        source_document_id: null,
        production_order_id: null,
        item_type: selectedRow.itemType,
        product_id: selectedRow.itemType === "product" ? selectedRow.itemId : null,
        material_id:
          selectedRow.itemType === "material" ? selectedRow.itemId : null,
        consumable_id:
          selectedRow.itemType === "consumable" ? selectedRow.itemId : null,
        item_id: selectedRow.itemType === "resale_product" ? selectedRow.itemId : null,
        quantity: signedQuantity,
        created_at: new Date().toISOString(),
};

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movementRow);

      if (movementError) throw movementError;

      closeAdjustmentForm();
      await loadStockItems();
    } catch (error) {
      setAdjustmentError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить складское движение.",
      );
    } finally {
      setAdjustmentSaving(false);
    }
  }

  const stockRows = useMemo(() => {
    const productMap = new Map(products.map((item) => [item.id, item]));
    const resaleProductMap = new Map(resaleProducts.map((item) => [item.id, item]));
    const productToResaleMap = new Map(
      resaleProducts
        .filter((item) => item.source_id)
        .map((item) => [item.source_id as string, item]),
    );
    const materialMap = new Map(materials.map((item) => [item.id, item]));
    const consumableMap = new Map(consumables.map((item) => [item.id, item]));
    const colorMap = new Map(colors.map((item) => [item.id, item]));
    const productCostMap = new Map<string, { quantity: number; cost: number }>();

    productionCosts.forEach((order) => {
      if (!order.product_id) return;

      const quantity = Number(order.quantity || 0);
      const cost = Number(order.planned_total_cost || 0);

      if (quantity <= 0 || cost <= 0) return;

      const current = productCostMap.get(order.product_id) || {
        quantity: 0,
        cost: 0,
      };

      productCostMap.set(order.product_id, {
        quantity: current.quantity + quantity,
        cost: current.cost + cost,
      });
    });

    const lastMovementMap = new Map<string, StockMovementRow>();

    movements.forEach((movement) => {
      let movementItemType: StockItemType = movement.item_type as StockItemType;
      let itemId =
        movement.item_type === "resale_product"
          ? movement.item_id
          : movement.item_type === "product"
            ? movement.product_id
            : movement.item_type === "material"
              ? movement.material_id
              : movement.consumable_id;

      if (movement.item_type === "product" && movement.product_id) {
        const resaleItem = productToResaleMap.get(movement.product_id);
        if (resaleItem) {
          movementItemType = "resale_product";
          itemId = resaleItem.id;
        }
      }

      if (!itemId) return;

      const key = getStockKey(movementItemType, itemId);
      if (!lastMovementMap.has(key)) {
        lastMovementMap.set(key, movement);
      }
    });

    const movementRows = stockAvailable
      .map((row) => {
        const legacyProductId = row.item_type === "product" ? row.product_id : null;
        const legacyResaleItem = legacyProductId
          ? productToResaleMap.get(legacyProductId)
          : null;

        const rawItemId = getStockRowId(row);
        if (!rawItemId) return null;

        const itemType: StockItemType =
          row.item_type === "product" && legacyResaleItem
            ? "resale_product"
            : (row.item_type as StockItemType);

        const itemId =
          itemType === "resale_product" && legacyResaleItem
            ? legacyResaleItem.id
            : rawItemId;

        const key = getStockKey(itemType, itemId);
        const quantityOnHand = Number(row.quantity_on_hand || 0);
        const quantityReserved = Number(row.quantity_reserved || 0);
        const quantityAvailable = Number(row.quantity_available || 0);
        const lastMovement = lastMovementMap.get(key);

        if (itemType === "product") {
          const product = productMap.get(itemId);
          const productCost = productCostMap.get(itemId);
          const price =
            productCost && productCost.quantity > 0
              ? productCost.cost / productCost.quantity
              : 0;

          return {
            key,
            itemType,
            itemId,
            name: product?.name || "Готовая продукция / товар",
            article: product?.article || "",
            colorName: "",
            colorHex: "",
            quantityOnHand,
            quantityReserved,
            quantityAvailable,
            avgPrice: price,
            amount: quantityOnHand * price,
            lastMovementDate: lastMovement?.created_at || "",
            lastMovementType: getMovementLabel(lastMovement?.movement_type || ""),
            lastDocumentType: getDocumentLabel(lastMovement?.source_document_type || ""),
          } as StockRow;
        }

        if (itemType === "resale_product") {
          const resaleProduct = resaleProductMap.get(itemId);
          const price = Number(resaleProduct?.default_price || 0);

          return {
            key,
            itemType,
            itemId,
            name: resaleProduct?.name || "Товар на перепродажу",
            article: resaleProduct?.article || "",
            colorName: "",
            colorHex: "",
            quantityOnHand,
            quantityReserved,
            quantityAvailable,
            avgPrice: price,
            amount: quantityOnHand * price,
            lastMovementDate: lastMovement?.created_at || "",
            lastMovementType: getMovementLabel(lastMovement?.movement_type || ""),
            lastDocumentType: getDocumentLabel(lastMovement?.source_document_type || ""),
          } as StockRow;
        }

        if (itemType === "material") {
          const material = materialMap.get(itemId);
          const color = material?.color_id ? colorMap.get(material.color_id) : null;
          const price = Number(material?.default_price || 0);

          return {
            key,
            itemType,
            itemId,
            name: material?.name || "Материал",
            article: material?.article || "",
            colorName: color?.name || "",
            colorHex: color?.hex || "",
            quantityOnHand,
            quantityReserved,
            quantityAvailable,
            avgPrice: price,
            amount: quantityOnHand * price,
            lastMovementDate: lastMovement?.created_at || "",
            lastMovementType: getMovementLabel(lastMovement?.movement_type || ""),
            lastDocumentType: getDocumentLabel(lastMovement?.source_document_type || ""),
          } as StockRow;
        }

        const consumable = consumableMap.get(itemId);
        const price = Number(consumable?.default_price || 0);

        return {
          key,
          itemType,
          itemId,
          name: consumable?.name || "Расходник",
          article: consumable?.article || "",
          colorName: "",
          colorHex: "",
          quantityOnHand,
          quantityReserved,
          quantityAvailable,
          avgPrice: price,
          amount: quantityOnHand * price,
          lastMovementDate: lastMovement?.created_at || "",
          lastMovementType: getMovementLabel(lastMovement?.movement_type || ""),
          lastDocumentType: getDocumentLabel(lastMovement?.source_document_type || ""),
        } as StockRow;
      })
      .filter(Boolean) as StockRow[];

    const resaleStockIds = new Set(
      movementRows
        .filter((row) => row?.itemType === "resale_product")
        .map((row) => row!.itemId),
    );

    const zeroStockResaleRows: StockRow[] = resaleProducts
      .filter((item) => item.is_active !== false && !resaleStockIds.has(item.id))
      .map((item) => ({
        key: getStockKey("resale_product", item.id),
        itemType: "resale_product",
        itemId: item.id,
        name: item.name || "Товар на перепродажу",
        article: item.article || "",
        colorName: "",
        colorHex: "",
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        avgPrice: Number(item.default_price || 0),
        amount: 0,
        lastMovementDate: "",
        lastMovementType: "—",
        lastDocumentType: "—",
      }));

    return [...movementRows, ...zeroStockResaleRows]
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [stockAvailable, products, resaleProducts, materials, consumables, colors, movements, productionCosts]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stockRows.filter((row) => {
      const matchesTab = activeTab === "all" || row.itemType === activeTab;
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.article.toLowerCase().includes(query) ||
        row.colorName.toLowerCase().includes(query) ||
        row.lastMovementType.toLowerCase().includes(query) ||
        row.lastDocumentType.toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });
  }, [stockRows, activeTab, search]);

              
  const selectedRow =
    stockRows.find((row) => row.key === selectedRowKey) || null;

  function exportStockToExcel() {
    if (filteredRows.length === 0) {
      setError("Нет данных для выгрузки в Excel.");
      return;
    }

    const exportRows = filteredRows.map((row) => ({
      "ID": row.itemId,
      "Тип": getItemTypeLabel(row.itemType),
      "Номенклатура": row.name,
      "Артикул": row.article || "",
      "Цвет": row.colorName || "",
      "Остаток": row.quantityOnHand,
      "Резерв": row.quantityReserved,
      "Доступно": row.quantityAvailable,
      "Цена": row.avgPrice,
      "Стоимость": row.amount,
      "Фактический остаток": "",
      "Последнее движение": row.lastMovementType || "",
      "Документ": row.lastDocumentType || "",
      "Дата последнего движения": row.lastMovementDate
        ? new Date(row.lastMovementDate).toLocaleString("ru-RU")
        : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    worksheet["!cols"] = [
      { wch: 38 },
      { wch: 20 },
      { wch: 34 },
      { wch: 18 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
    ];

    worksheet["!autofilter"] = {
      ref: worksheet["!ref"] || "A1:L1",
    };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Остатки");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Остатки_${date}.xlsx`);
  }

  async function handleBulkEditApply(changes: BulkEditChange[]) {
    if (changes.length === 0 || bulkEditSaving) return;

    try {
      setBulkEditSaving(true);
      setError("");

      const errors: string[] = [];
      let updated = 0;

      for (const change of changes) {
        let result;

        if (change.itemType === "product") {
          result = await supabase
            .from("products")
            .update({
              name: change.newName,
              article: change.newArticle || null,
            })
            .eq("id", change.id)
            .select("id")
            .maybeSingle();
        } else if (change.itemType === "resale_product") {
          result = await supabase
            .from("items")
            .update({
              name: change.newName,
              article: change.newArticle || null,
              default_price: change.newPrice,
            })
            .eq("id", change.id)
            .eq("item_type", "resale_product")
            .select("id")
            .maybeSingle();
        } else if (change.itemType === "material") {
          const materialPayload: Record<string, unknown> = {
            name: change.newName,
            article: change.newArticle || null,
            default_price: change.newPrice,
          };

          // Цвет пока не изменяем автоматически: для него нужен безопасный
          // поиск color_id. Остальные поля применяем независимо.
          result = await supabase
            .from("materials")
            .update(materialPayload)
            .eq("id", change.id)
            .select("id")
            .maybeSingle();
        } else {
          result = await supabase
            .from("consumables")
            .update({
              name: change.newName,
              article: change.newArticle || null,
              default_price: change.newPrice,
            })
            .eq("id", change.id)
            .select("id")
            .maybeSingle();
        }

        if (result.error) {
          errors.push(`${change.newName || change.id}: ${result.error.message}`);
        } else if (!result.data) {
          errors.push(
            `${change.newName || change.id}: запись с ID ${change.id} не найдена, изменение не применено.`,
          );
        } else {
          updated += 1;
        }
      }

      await loadStockItems();

      if (errors.length > 0) {
        setError(
          `Обновлено: ${updated}. Ошибок: ${errors.length}. ${errors.join(" | ")}`,
        );
      } else {
        setBulkEditOpen(false);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось применить массовые изменения.",
      );
    } finally {
      setBulkEditSaving(false);
    }
  }

  async function handleInventoryApply(changes: Array<{
    id: string;
    name: string;
    article: string;
    itemType: StockItemType;
    currentQuantity: number;
    actualQuantity: number;
    difference: number;
    action: string;
  }>) {
    if (changes.length === 0 || inventoryImportSaving) return;

    try {
      setInventoryImportSaving(true);
      setError("");

      const invalidType = changes.find(
        (change) =>
          change.itemType !== "product" &&
          change.itemType !== "resale_product" &&
          change.itemType !== "material" &&
          change.itemType !== "consumable",
      );

      if (invalidType) {
        throw new Error(`Неизвестный тип номенклатуры у «${invalidType.name}».`);
      }

      const movementRows = changes.map((change) => ({
        movement_type: change.difference > 0 ? "manual_receipt" : "manual_write_off",
        source_document_type: "stock_adjustment",
        source_document_id: null,
        production_order_id: null,
        item_type: change.itemType,
        product_id: change.itemType === "product" ? change.id : null,
        material_id: change.itemType === "material" ? change.id : null,
        consumable_id: change.itemType === "consumable" ? change.id : null,
        item_id: change.itemType === "resale_product" ? change.id : null,
        quantity:
          change.difference > 0
            ? Math.abs(change.difference)
            : -Math.abs(change.difference),
        created_at: new Date().toISOString(),
      }));

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movementRows);

      if (movementError) throw movementError;

      await loadStockItems();
      setInventoryImportOpen(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось применить корректировки инвентаризации.",
      );
    } finally {
      setInventoryImportSaving(false);
    }
  }

  const selectedMovements = selectedRow
    ? movements
        .filter((movement) => {
          if (movement.item_type !== selectedRow.itemType) return false;
          if (selectedRow.itemType === "resale_product") return movement.item_id === selectedRow.itemId;
          if (selectedRow.itemType === "product") return movement.product_id === selectedRow.itemId;
          if (selectedRow.itemType === "material") return movement.material_id === selectedRow.itemId;
          return movement.consumable_id === selectedRow.itemId;
        })
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        )
    : [];

  return (
    <div style={pageStyle}>
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={sectionTitleRowStyle}>
              <span style={sectionIconStyle}>📊</span>
              <span style={sectionTitleStyle}>Остатки</span>
            </div>
            <div style={sectionSubtitleStyle}>
              Остатки считаются по всем складским движениям: приёмки, производство,
              списания, выпуск продукции, отгрузки и активные резервы.
            </div>
          </div>

          <div style={headerActionsStyle}>
            <button
              type="button"
              onClick={() => setBulkEditOpen(true)}
              style={bulkEditButtonStyle}
              disabled={loading || stockRows.length === 0}
            >
              ✏️ Массовое редактирование
            </button>

            <button
              type="button"
              onClick={() => setInventoryImportOpen(true)}
              style={inventoryButtonStyle}
              disabled={loading || stockRows.length === 0}
            >
              📦 Инвентаризация
            </button>

            <button
              type="button"
              onClick={exportStockToExcel}
              style={exportButtonStyle}
              disabled={loading || filteredRows.length === 0}
            >
              📤 Выгрузить Excel
            </button>

            <button type="button" onClick={loadStockItems} style={secondaryButtonStyle}>
              Обновить
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        

        <div style={toolbarStyle}>
          <div style={filterTabsStyle}>
            <button type="button" onClick={() => setActiveTab("all")} style={filterTabStyle(activeTab === "all")}>
              Все
            </button>
            <button type="button" onClick={() => setActiveTab("product")} style={filterTabStyle(activeTab === "product")}>
              Товары / продукция
            </button>
            <button type="button" onClick={() => setActiveTab("resale_product")} style={filterTabStyle(activeTab === "resale_product")}>
              Перепродажа
            </button>
            <button type="button" onClick={() => setActiveTab("material")} style={filterTabStyle(activeTab === "material")}>
              Материалы
            </button>
            <button type="button" onClick={() => setActiveTab("consumable")} style={filterTabStyle(activeTab === "consumable")}>
              Расходники
            </button>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию, артикулу, цвету или движению"
            style={searchInputStyle}
          />
        </div>

        {loading ? (
          <div style={loadingStyle}>Загружаю остатки...</div>
        ) : filteredRows.length === 0 ? (
          <div style={emptyStyle}>
            Остатков пока нет. Создай складское движение: приёмку, выпуск продукции
            или другой документ движения склада.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Тип</th>
                  <th style={thStyle}>Номенклатура</th>
                  <th style={thStyle}>Артикул</th>
                  <th style={thStyle}>Цвет</th>
                  <th style={thStyle}>Остаток</th>
                  <th style={thStyle}>Резерв</th>
                  <th style={thStyle}>Доступно</th>
                  <th style={thStyle}>Цена</th>
                  <th style={thStyle}>Стоимость</th>
                  <th style={thStyle}>Последнее движение</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.key}
                    onClick={() => setSelectedRowKey(row.key)}
                    style={clickableRowStyle}
                  >
                    <td style={tdStyle}>
                      <span style={typeBadgeStyle(row.itemType)}>
                        {getItemTypeLabel(row.itemType)}
                      </span>
                    </td>
                    <td style={tdStrongStyle}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRowKey(row.key);
                        }}
                        style={rowNameButtonStyle}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td style={tdStyle}>{row.article || "—"}</td>
                    <td style={tdStyle}>{renderColor(row)}</td>
                    <td style={tdStrongStyle}>{formatQuantity(row.quantityOnHand)}</td>
                    <td style={tdStyle}>{formatQuantity(row.quantityReserved)}</td>
                    <td style={row.quantityAvailable < 0 ? tdDangerStyle : tdStrongStyle}>
                      {formatQuantity(row.quantityAvailable)}
                    </td>
                    <td style={tdStyle}>{formatMoney(row.avgPrice)} ₽</td>
                    <td style={tdStrongStyle}>{formatMoney(row.amount)} ₽</td>
                    <td style={tdStyle}>
                      <div style={{ display: "grid", gap: 3 }}>
                        <span>{row.lastMovementType || "—"}</span>
                        <span style={supplierTextStyle}>{row.lastDocumentType || "—"}</span>
                        <span style={supplierTextStyle}>{row.lastMovementDate ? new Date(row.lastMovementDate).toLocaleString("ru-RU") : "—"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRow && (
        <div
          onClick={() => {
            closeAdjustmentForm();
            setSelectedRowKey(null);
          }}
          style={modalOverlayStyle}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={stockCardModalStyle}
          >
            <div style={modalHeaderStyle}>
              <div>
                <div style={modalTitleStyle}>{selectedRow.name}</div>
                <div style={modalSubtitleStyle}>
                  {getItemTypeLabel(selectedRow.itemType)}
                  {selectedRow.article ? ` · ${selectedRow.article}` : ""}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeAdjustmentForm();
                  setSelectedRowKey(null);
                }}
                style={modalCloseButtonStyle}
              >
                ×
              </button>
            </div>

            <div style={modalSummaryGridStyle}>
              <SummaryCard label="Остаток" value={formatQuantity(selectedRow.quantityOnHand)} />
              <SummaryCard label="Резерв" value={formatQuantity(selectedRow.quantityReserved)} />
              <SummaryCard label="Доступно" value={formatQuantity(selectedRow.quantityAvailable)} />
              <SummaryCard label="Цена" value={`${formatMoney(selectedRow.avgPrice)} ₽`} />
              <SummaryCard label="Стоимость" value={`${formatMoney(selectedRow.amount)} ₽`} />
            </div>

            <div style={modalActionRowStyle}>
              <button
                type="button"
                onClick={() => openAdjustment("receipt")}
                style={receiptActionButtonStyle}
              >
                + Оприходовать
              </button>

              <button
                type="button"
                onClick={() => openAdjustment("write_off")}
                style={writeOffActionButtonStyle}
              >
                − Списать
              </button>
            </div>

            {adjustmentMode && (
              <form onSubmit={handleSaveAdjustment} style={adjustmentFormStyle}>
                <div>
                  <div style={adjustmentTitleStyle}>
                    {adjustmentMode === "receipt"
                      ? "Оприходование товара"
                      : "Списание товара"}
                  </div>
                  <div style={supplierTextStyle}>
                    Документ будет сохранён как складская корректировка и сразу
                    попадёт в историю движений.
                  </div>
                </div>

                {adjustmentError && (
                  <div style={adjustmentErrorStyle}>{adjustmentError}</div>
                )}

                <div style={adjustmentGridStyle}>
                  <label style={adjustmentFieldStyle}>
                    <span style={adjustmentLabelStyle}>Количество</span>
                    <input
                      value={adjustmentQuantity}
                      onChange={(event) =>
                        setAdjustmentQuantity(event.target.value)
                      }
                      placeholder="Например: 1"
                      style={adjustmentInputStyle}
                    />
                  </label>

                  <label style={adjustmentFieldStyle}>
                    <span style={adjustmentLabelStyle}>Причина</span>
                    <input
                      value={adjustmentReason}
                      onChange={(event) =>
                        setAdjustmentReason(event.target.value)
                      }
                      placeholder={
                        adjustmentMode === "receipt"
                          ? "Например: инвентаризация"
                          : "Например: брак / порча"
                      }
                      style={adjustmentInputStyle}
                    />
                  </label>

                  <label style={{ ...adjustmentFieldStyle, gridColumn: "1 / -1" }}>
                    <span style={adjustmentLabelStyle}>Комментарий</span>
                    <textarea
                      value={adjustmentComment}
                      onChange={(event) =>
                        setAdjustmentComment(event.target.value)
                      }
                      placeholder="Необязательно"
                      style={adjustmentTextareaStyle}
                    />
                  </label>
                </div>

                <div style={adjustmentButtonsStyle}>
                  <button
                    type="button"
                    onClick={closeAdjustmentForm}
                    style={cancelAdjustmentButtonStyle}
                    disabled={adjustmentSaving}
                  >
                    Отмена
                  </button>

                  <button
                    type="submit"
                    style={
                      adjustmentMode === "receipt"
                        ? saveReceiptButtonStyle
                        : saveWriteOffButtonStyle
                    }
                    disabled={adjustmentSaving}
                  >
                    {adjustmentSaving
                      ? "Сохраняю..."
                      : adjustmentMode === "receipt"
                        ? "Оприходовать"
                        : "Списать"}
                  </button>
                </div>
              </form>
            )}

            <div style={cardInfoGridStyle}>
              <div style={cardInfoBlockStyle}>
                <div style={cardInfoLabelStyle}>Цвет</div>
                <div style={cardInfoValueStyle}>{renderColor(selectedRow)}</div>
              </div>

              <div style={cardInfoBlockStyle}>
                <div style={cardInfoLabelStyle}>Последнее движение</div>
                <div style={cardInfoValueStyle}>{selectedRow.lastMovementType || "—"}</div>
                <div style={supplierTextStyle}>{selectedRow.lastMovementDate ? new Date(selectedRow.lastMovementDate).toLocaleString("ru-RU") : "—"}</div>
              </div>
            </div>

            <div style={historyHeaderStyle}>
              <div style={historyTitleStyle}>История движений</div>
              <div style={supplierTextStyle}>
                Последние операции по этой номенклатуре
              </div>
            </div>

            {selectedMovements.length === 0 ? (
              <div style={emptyStyle}>Движений по этой позиции пока нет.</div>
            ) : (
              <div style={movementHistoryStyle}>
                {selectedMovements.map((movement, index) => {
                  const quantity = Number(movement.quantity || 0);

                  return (
                    <div key={movement.id || `${movement.created_at}-${index}`} style={movementItemStyle}>
                      <div style={movementTopLineStyle}>
                        <span style={movementTitleStyle}>
                          {getMovementLabel(movement.movement_type || "")}
                        </span>
                        <span style={quantity >= 0 ? movementQtyPlusStyle : movementQtyMinusStyle}>
                          {quantity >= 0 ? "+" : ""}
                          {formatQuantity(quantity)}
                        </span>
                      </div>

                      <div style={movementMetaStyle}>
                        <span>{getDocumentLabel(movement.source_document_type || "")}</span>
                        <span>·</span>
                        <span>{movement.created_at ? new Date(movement.created_at).toLocaleString("ru-RU") : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <BulkEditModal
        open={bulkEditOpen}
        stockRows={stockRows}
        onClose={() => setBulkEditOpen(false)}
        onApply={handleBulkEditApply}
        saving={bulkEditSaving}
      />

      <InventoryImportModal
        open={inventoryImportOpen}
        stockRows={stockRows}
        onClose={() => setInventoryImportOpen(false)}
        onApply={handleInventoryApply}
        saving={inventoryImportSaving}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

function getItemTypeLabel(itemType: StockItemType) {
  if (itemType === "product") return "Товар / продукция";
  if (itemType === "resale_product") return "Перепродажа";
  if (itemType === "material") return "Материал";
  return "Расходник";
}

function renderColor(row: StockRow) {
  if (row.itemType !== "material") return "—";

  if (!row.colorName) {
    return <span style={emptyColorChipStyle}>Цвет не указан</span>;
  }

  return (
    <span style={colorChipStyle}>
      <span
        style={{
          ...colorDotStyle,
          background: row.colorHex || "#e2e8f0",
        }}
      />
      {row.colorName}
    </span>
  );
}



const modalActionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const receiptActionButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#dcfce7",
  color: "#15803d",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const writeOffActionButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const adjustmentFormStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 14,
};

const adjustmentTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const adjustmentErrorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 14,
  padding: "10px 12px",
  fontWeight: 800,
};

const adjustmentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const adjustmentFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const adjustmentLabelStyle: React.CSSProperties = {
  color: "#334155",
  fontWeight: 900,
};

const adjustmentInputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 15,
  outline: "none",
};

const adjustmentTextareaStyle: React.CSSProperties = {
  ...adjustmentInputStyle,
  minHeight: 76,
  resize: "vertical",
};

const adjustmentButtonsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const cancelAdjustmentButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const saveReceiptButtonStyle: React.CSSProperties = {
  border: "1px solid #16a34a",
  background: "#16a34a",
  color: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const saveWriteOffButtonStyle: React.CSSProperties = {
  border: "1px solid #dc2626",
  background: "#dc2626",
  color: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const clickableRowStyle: React.CSSProperties = {
  cursor: "pointer",
};

const rowNameButtonStyle: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
  font: "inherit",
  textAlign: "left",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10070,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
};

const stockCardModalStyle: React.CSSProperties = {
  width: "min(980px, 96vw)",
  maxHeight: "88vh",
  overflowY: "auto",
  background: "#ffffff",
  border: "1px solid #dbe4f0",
  borderRadius: 22,
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.35)",
  padding: 22,
  display: "grid",
  gap: 16,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const modalSubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 6,
  fontSize: 15,
};

const modalCloseButtonStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: 26,
  fontWeight: 900,
};

const modalSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const cardInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const cardInfoBlockStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
};

const cardInfoLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginBottom: 8,
};

const cardInfoValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const historyHeaderStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const historyTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const movementHistoryStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const movementItemStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  borderRadius: 16,
  padding: 13,
  display: "grid",
  gap: 7,
};

const movementTopLineStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const movementTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const movementQtyPlusStyle: React.CSSProperties = {
  color: "#15803d",
  fontWeight: 900,
};

const movementQtyMinusStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontWeight: 900,
};

const movementMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 13,
};

const pageStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 22,
  border: "1px solid #dbe4f0",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const sectionIconStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionSubtitleStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.5,
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const bulkEditButtonStyle: React.CSSProperties = {
  border: "1px solid #c4b5fd",
  background: "#f5f3ff",
  color: "#6d28d9",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const inventoryButtonStyle: React.CSSProperties = {
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#b45309",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const exportButtonStyle: React.CSSProperties = {
  border: "1px solid #86efac",
  background: "#f0fdf4",
  color: "#15803d",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "11px 14px",
  cursor: "pointer",
  fontWeight: 900,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const summaryCardStyle: React.CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  borderRadius: 16,
  padding: 14,
};

const summaryLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 6,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const filterTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

function filterTabStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    borderRadius: 999,
    padding: "9px 12px",
    cursor: "pointer",
    fontWeight: 900,
  };
}

const searchInputStyle: React.CSSProperties = {
  width: "min(420px, 100%)",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  background: "#ffffff",
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
  minWidth: 980,
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

const tdStrongStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#0f172a",
  fontWeight: 900,
};

const tdDangerStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#991b1b",
  fontWeight: 900,
};

function typeBadgeStyle(itemType: StockItemType): React.CSSProperties {
  const palette =
    itemType === "product"
      ? { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#15803d" }
      : itemType === "resale_product"
        ? { border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c" }
        : itemType === "material"
        ? { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" }
        : { border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#7c3aed" };

  return {
    display: "inline-flex",
    width: "fit-content",
    border: palette.border,
    background: palette.background,
    color: palette.color,
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
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

const supplierTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const loadingStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  padding: 18,
};

const emptyStyle: React.CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  lineHeight: 1.5,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 14,
  padding: 14,
  fontWeight: 700,
};
