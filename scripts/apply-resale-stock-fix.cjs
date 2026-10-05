const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function write(rel, text) {
  fs.writeFileSync(path.join(process.cwd(), rel), text, 'utf8');
}

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return text.replace(oldText, newText);
}

function patch(rel, fn) {
  const before = read(rel);
  const after = fn(before);
  if (after === before) throw new Error(`${rel}: no changes produced`);
  write(rel, after);
  console.log(`${rel}: ${before.split('\n').length} -> ${after.split('\n').length} lines`);
}

patch('src/pages/warehouse/SalesPage.tsx', (text) => {
  text = replaceOnce(text,
`type ResaleProduct = {
  id: string;
  name: string | null;
  article: string | null;
  default_price: number | null;
};`,
`type ResaleProduct = {
  id: string;
  name: string | null;
  article: string | null;
  default_price: number | null;
  source_id: string | null;
};`, 'SalesPage ResaleProduct');

  text = replaceOnce(text,
`        supabase.from("products").select("*").order("name", { ascending: true }),`,
`        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),`, 'SalesPage active products');

  text = replaceOnce(text,
`        supabase
          .from("items")
          .select("id, name, article, default_price")
          .eq("item_type", "resale_product")
          .order("name", { ascending: true }),`,
`        supabase
          .from("items")
          .select("id, name, article, default_price, source_id")
          .eq("item_type", "resale_product")
          .eq("is_active", true)
          .order("name", { ascending: true }),`, 'SalesPage resale items');
  return text;
});

patch('src/pages/warehouse/CustomerOrderModal.tsx', (text) => {
  text = replaceOnce(text,
`export type ResaleProduct = {
  id: string;
  name: string;
  article?: string | null;
  default_price?: number | null;
  price?: number | null;
  sale_price?: number | null;
};`,
`export type ResaleProduct = {
  id: string;
  name: string;
  article?: string | null;
  default_price?: number | null;
  price?: number | null;
  sale_price?: number | null;
  source_id?: string | null;
};`, 'CustomerOrderModal ResaleProduct');

  text = replaceOnce(text,
`  function getPickerDirectoryItems(): PickerDirectoryItem[] {
    const query = productPickerSearch.trim().toLowerCase();
    const allItems: PickerDirectoryItem[] = [
      ...products.map((item) => ({ ...item, item_type: "product" as const })),
      ...resaleProducts.map((item) => ({ ...item, item_type: "resale_product" as const })),
      ...materials.map((item) => ({ ...item, item_type: "material" as const })),
      ...consumables.map((item) => ({ ...item, item_type: "consumable" as const })),
    ];`,
`  function getPickerDirectoryItems(): PickerDirectoryItem[] {
    const query = productPickerSearch.trim().toLowerCase();
    const resaleSourceProductIds = new Set(
      resaleProducts
        .map((item) => item.source_id)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    );

    const allItems: PickerDirectoryItem[] = [
      ...products
        .filter((item) => !resaleSourceProductIds.has(item.id))
        .map((item) => ({ ...item, item_type: "product" as const })),
      ...resaleProducts.map((item) => ({ ...item, item_type: "resale_product" as const })),
      ...materials.map((item) => ({ ...item, item_type: "material" as const })),
      ...consumables.map((item) => ({ ...item, item_type: "consumable" as const })),
    ];`, 'CustomerOrderModal picker');
  return text;
});

patch('src/pages/warehouse/CustomerRelatedDocumentModal.tsx', (text) => {
  text = replaceOnce(text,
`      const { data: savedItems, error: itemsError } = await supabase
        .from("customer_shipment_items")
        .insert(
          orderItems.map((item) => ({
            customer_shipment_id: shipment.id,
            item_type: item.item_type,
            item_id: item.item_type === "resale_product" ? item.item_id : null,
            product_id: item.product_id,
            material_id: item.material_id,
            consumable_id: item.consumable_id,
            quantity: item.quantity,
            price: item.price,
          })),
        )`,
`      const legacyProductIds = Array.from(
        new Set(
          orderItems
            .filter((item) => item.item_type === "product" && item.product_id)
            .map((item) => item.product_id as string),
        ),
      );
      const resaleBySourceId = new Map<string, string>();

      if (legacyProductIds.length > 0) {
        const { data: migratedItems, error: migratedItemsError } = await supabase
          .from("items")
          .select("id, source_id")
          .eq("item_type", "resale_product")
          .eq("is_active", true)
          .in("source_id", legacyProductIds);

        if (migratedItemsError) throw migratedItemsError;
        ((migratedItems || []) as Array<{ id: string; source_id: string | null }>).forEach((item) => {
          if (item.source_id) resaleBySourceId.set(item.source_id, item.id);
        });
      }

      const { data: savedItems, error: itemsError } = await supabase
        .from("customer_shipment_items")
        .insert(
          orderItems.map((item) => {
            const migratedResaleItemId =
              item.item_type === "product" && item.product_id
                ? resaleBySourceId.get(item.product_id) || null
                : null;
            const itemType = migratedResaleItemId ? "resale_product" : item.item_type;

            return {
              customer_shipment_id: shipment.id,
              item_type: itemType,
              item_id: itemType === "resale_product" ? migratedResaleItemId || item.item_id : null,
              product_id: migratedResaleItemId ? null : item.product_id,
              material_id: item.material_id,
              consumable_id: item.consumable_id,
              quantity: item.quantity,
              price: item.price,
            };
          }),
        )`, 'CustomerRelatedDocumentModal normalize');
  return text;
});

patch('src/pages/warehouse/CustomerShipmentModal.tsx', (text) => {
  text = replaceOnce(text,
`      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(
          shipmentItems.map((item) => ({
            movement_type: "outgoing",
            source_document_type: "customer_shipment",
            source_document_id: currentShipment.id,
            customer_order_id: currentShipment.customer_order_id,
            customer_shipment_id: currentShipment.id,
            item_type: item.item_type,
            item_id: item.item_type === "resale_product" ? item.item_id : null,
            product_id: item.product_id,
            material_id: item.material_id,
            consumable_id: item.consumable_id,
            quantity: -Math.abs(Number(item.quantity || 0)),
            created_at: now,
          })),
        );`,
`      const legacyProductIds = Array.from(
        new Set(
          shipmentItems
            .filter((item) => item.item_type === "product" && item.product_id)
            .map((item) => item.product_id as string),
        ),
      );
      const resaleBySourceId = new Map<string, string>();

      if (legacyProductIds.length > 0) {
        const { data: migratedItems, error: migratedItemsError } = await supabase
          .from("items")
          .select("id, source_id")
          .eq("item_type", "resale_product")
          .eq("is_active", true)
          .in("source_id", legacyProductIds);

        if (migratedItemsError) throw migratedItemsError;
        ((migratedItems || []) as Array<{ id: string; source_id: string | null }>).forEach((item) => {
          if (item.source_id) resaleBySourceId.set(item.source_id, item.id);
        });
      }

      const { error: movementsError } = await supabase
        .from("stock_movements")
        .insert(
          shipmentItems.map((item) => {
            const migratedResaleItemId =
              item.item_type === "product" && item.product_id
                ? resaleBySourceId.get(item.product_id) || null
                : null;
            const itemType = migratedResaleItemId ? "resale_product" : item.item_type;

            return {
              movement_type: "outgoing",
              source_document_type: "customer_shipment",
              source_document_id: currentShipment.id,
              customer_order_id: currentShipment.customer_order_id,
              customer_shipment_id: currentShipment.id,
              item_type: itemType,
              item_id: itemType === "resale_product" ? migratedResaleItemId || item.item_id : null,
              product_id: migratedResaleItemId ? null : item.product_id,
              material_id: item.material_id,
              consumable_id: item.consumable_id,
              quantity: -Math.abs(Number(item.quantity || 0)),
              created_at: now,
            };
          }),
        );`, 'CustomerShipmentModal normalize');
  return text;
});

patch('src/pages/warehouse/StockPage.tsx', (text) => {
  text = replaceOnce(text,
`    const stockIdsByType = new Map<StockItemType, Set<string>>([
      ["product", new Set()],
      ["resale_product", new Set()],
      ["material", new Set()],
      ["consumable", new Set()],
    ]);

    movementRows.forEach((row) => {
      stockIdsByType.get(row.itemType)?.add(row.itemId);
    });`,
`    const aggregatedMovementRows = Array.from(
      movementRows
        .reduce((rowsByKey, row) => {
          const existing = rowsByKey.get(row.key);
          if (!existing) {
            rowsByKey.set(row.key, { ...row });
            return rowsByKey;
          }

          const quantityOnHand = existing.quantityOnHand + row.quantityOnHand;
          const quantityReserved = existing.quantityReserved + row.quantityReserved;
          const quantityAvailable = existing.quantityAvailable + row.quantityAvailable;

          rowsByKey.set(row.key, {
            ...existing,
            quantityOnHand,
            quantityReserved,
            quantityAvailable,
            amount: quantityOnHand * existing.avgPrice,
          });
          return rowsByKey;
        }, new Map<string, StockRow>())
        .values(),
    );

    const stockIdsByType = new Map<StockItemType, Set<string>>([
      ["product", new Set()],
      ["resale_product", new Set()],
      ["material", new Set()],
      ["consumable", new Set()],
    ]);

    aggregatedMovementRows.forEach((row) => {
      stockIdsByType.get(row.itemType)?.add(row.itemId);
    });`, 'StockPage aggregate');

  text = replaceOnce(text,
`      ...movementRows,
      ...zeroStockProductRows,`,
`      ...aggregatedMovementRows,
      ...zeroStockProductRows,`, 'StockPage final rows');
  return text;
});

console.log('All resale stock fixes applied successfully.');
