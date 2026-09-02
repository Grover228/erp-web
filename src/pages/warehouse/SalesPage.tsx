import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";
import CustomerOrderModal, {
  type Counterparty,
  type CustomerOrder,
  type CustomerOrderItem,
  type Product,
  type Material,
  type Consumable,
} from "./CustomerOrderModal";
import CustomerShipmentModal, {
  type CustomerShipment,
  type CustomerShipmentItem,
} from "./CustomerShipmentModal";

type SalesTab = "orders" | "shipments";
type ModalMode = "create" | "view";

type Status = {
  id: string;
  code: string;
  name: string;
  color: string | null;
};

type ResaleProduct = {
  id: string;
  name: string | null;
  article: string | null;
  default_price: number | null;
  source_id: string | null;
};

type ImportPreviewRow = {
  rowNumber: number;
  article: string;
  quantity: number;
  price: number;
  itemId?: string;
  itemSourceId?: string;
  itemType?: CustomerOrderItem["item_type"];
  name?: string;
  status: "pending" | "ready" | "error";
  message: string;
};

type ImportPreview = {
  fileName: string;
  rows: ImportPreviewRow[];
};

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("orders");

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [shipments, setShipments] = useState<CustomerShipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [directoriesLoading, setDirectoriesLoading] = useState(false);
  const [error, setError] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<CustomerOrderItem[]>([]);
  const [selectedOrderLoading, setSelectedOrderLoading] = useState(false);

  const [selectedShipment, setSelectedShipment] = useState<CustomerShipment | null>(null);
  const [selectedShipmentItems, setSelectedShipmentItems] = useState<CustomerShipmentItem[]>([]);

  useEffect(() => {
    loadOrders();
    loadShipments();
    loadDirectories();
  }, []);

  async function loadOrders() {
    try {
      setOrdersLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customer_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders((data as CustomerOrder[]) || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки заказов покупателей",
      );
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadShipments() {
    try {
      setShipmentsLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("customer_shipments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setShipments((data as CustomerShipment[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки отгрузок",
      );
    } finally {
      setShipmentsLoading(false);
    }
  }

  async function loadDirectories() {
    try {
      setDirectoriesLoading(true);
      setError("");

      const [
        productsResult,
        materialsResult,
        consumablesResult,
        resaleProductsResult,
        counterpartiesResult,
        statusesResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase.from("materials").select("*").order("name", { ascending: true }),
        supabase.from("consumables").select("*").order("name", { ascending: true }),
        supabase
          .from("items")
          .select("id, name, article, default_price, source_id")
          .eq("item_type", "resale_product")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("counterparties")
          .select("id, name, type")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("statuses")
          .select("id, code, name, color, status_categories(code)"),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (consumablesResult.error) throw consumablesResult.error;
      if (resaleProductsResult.error) throw resaleProductsResult.error;
      if (counterpartiesResult.error) throw counterpartiesResult.error;
      if (statusesResult.error) throw statusesResult.error;

      setProducts((productsResult.data as Product[]) || []);
      setMaterials((materialsResult.data as Material[]) || []);
      setConsumables((consumablesResult.data as Consumable[]) || []);
      setResaleProducts((resaleProductsResult.data as ResaleProduct[]) || []);
      setCounterparties((counterpartiesResult.data as Counterparty[]) || []);
      setStatuses((statusesResult.data as Status[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки справочников продаж",
      );
    } finally {
      setDirectoriesLoading(false);
    }
  }

  function normalizeExcelHeader(value: unknown) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е");
  }

  function parseExcelNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const normalized = String(value ?? "")
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  async function prepareExcelImport(file: File) {
    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      if (!firstSheet) throw new Error("В Excel не найден лист с данными.");

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: true,
      });

      if (rawRows.length === 0) {
        throw new Error("Excel-файл не содержит строк с данными.");
      }

      const headerMap = new Map<string, string>();
      Object.keys(rawRows[0]).forEach((header) => {
        headerMap.set(normalizeExcelHeader(header), header);
      });

      const articleHeader =
        headerMap.get("артикул") ||
        headerMap.get("article") ||
        headerMap.get("sku");

      const quantityHeader =
        headerMap.get("количество") ||
        headerMap.get("кол-во") ||
        headerMap.get("колво") ||
        headerMap.get("quantity") ||
        headerMap.get("qty");

      const priceHeader =
        headerMap.get("цена") ||
        headerMap.get("цена продажи") ||
        headerMap.get("price");

      if (!articleHeader || !quantityHeader || !priceHeader) {
        throw new Error(
          "Не удалось определить обязательные колонки. Нужны: «Артикул», «Количество», «Цена».",
        );
      }

      const rows: ImportPreviewRow[] = [];

      for (let index = 0; index < rawRows.length; index += 1) {
        const rawRow = rawRows[index];
        const excelRowNumber = index + 2;
        const article = String(rawRow[articleHeader] ?? "").trim();
        const quantity = parseExcelNumber(rawRow[quantityHeader]);
        const price = parseExcelNumber(rawRow[priceHeader]);

        if (!article && quantity === null && price === null) continue;

        if (!article) {
          rows.push({
            rowNumber: excelRowNumber,
            article: "",
            quantity: quantity ?? 0,
            price: price ?? 0,
            status: "error",
            message: "Не указан артикул.",
          });
          continue;
        }

        if (quantity === null || quantity <= 0) {
          rows.push({
            rowNumber: excelRowNumber,
            article,
            quantity: quantity ?? 0,
            price: price ?? 0,
            status: "error",
            message: "Количество должно быть больше нуля.",
          });
          continue;
        }

        if (price === null || price < 0) {
          rows.push({
            rowNumber: excelRowNumber,
            article,
            quantity,
            price: price ?? 0,
            status: "error",
            message: "Цена должна быть числом не меньше нуля.",
          });
          continue;
        }

        rows.push({
          rowNumber: excelRowNumber,
          article,
          quantity,
          price,
          status: "pending",
          message: "",
        });
      }

      if (rows.length === 0) {
        throw new Error("После чтения Excel не найдено ни одной заполненной строки.");
      }

      const articles = Array.from(new Set(rows.filter((row) => row.status !== "error").map((row) => row.article)));

      if (articles.length > 0) {
        const { data, error: itemsError } = await supabase
          .from("items")
          .select("id, item_type, name, article, is_active, source_table, source_id")
          .eq("is_active", true)
          .in("article", articles);

        if (itemsError) throw itemsError;

        const foundByArticle = new Map<string, any[]>();
        ((data || []) as any[]).forEach((item) => {
          const key = String(item.article ?? "").trim().toLowerCase();
          const list = foundByArticle.get(key) || [];
          list.push(item);
          foundByArticle.set(key, list);
        });

        rows.forEach((row) => {
          if (row.status === "error") return;

          const matches = foundByArticle.get(row.article.toLowerCase()) || [];

          if (matches.length === 0) {
            row.status = "error";
            row.message = "Артикул не найден в активной номенклатуре.";
            return;
          }

          if (matches.length > 1) {
            row.status = "error";
            row.message = `Артикул найден ${matches.length} раза. Импорт остановлен.`;
            return;
          }

          const item = matches[0];
          row.itemId = item.id;
          row.itemSourceId = item.source_id || undefined;
          row.itemType = item.item_type;
          row.name = item.name || "Без названия";

          if (
            item.item_type !== "resale_product" &&
            !row.itemSourceId
          ) {
            row.status = "error";
            row.message = "Для этой номенклатуры не указан source_id.";
            return;
          }

          row.status = "ready";
          row.message = "";
        });
      }

      setImportPreview({
        fileName: file.name,
        rows,
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось прочитать Excel-файл.");
    } finally {
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    }
  }

  async function importPreparedOrder() {
    if (!importPreview) return;

    const invalidRows = importPreview.rows.filter((row) => row.status !== "ready");
    if (invalidRows.length > 0) {
      setError("Импорт невозможен: сначала исправь строки с ошибками в Excel.");
      return;
    }

    try {
      setError("");

      const totalAmount = importPreview.rows.reduce(
        (sum, row) => sum + row.quantity * row.price,
        0,
      );

      const draftStatus = statuses.find((status) => status.code === "draft");

      if (!draftStatus) {
        throw new Error("Не найден статус заказа «draft» в справочнике statuses.");
      }

      const { data: createdOrder, error: orderError } = await supabase
        .from("customer_orders")
        .insert({
          order_date: new Date().toISOString().slice(0, 10),
          customer_name: "Импорт из Excel",
          total_amount: totalAmount,
          status: "draft",
          status_id: draftStatus.id,
        })
        .select("*")
        .single();

      if (orderError) {
        throw new Error(
          `Ошибка создания customer_orders: ${orderError.code || "без кода"} — ${orderError.message}` +
            (orderError.details ? ` | details: ${orderError.details}` : "") +
            (orderError.hint ? ` | hint: ${orderError.hint}` : ""),
        );
      }

      const orderItems = importPreview.rows.map((row) => ({
        customer_order_id: createdOrder.id,
        item_type: row.itemType,
        item_id: row.itemType === "resale_product" ? row.itemId : null,
        product_id: row.itemType === "product" ? row.itemSourceId : null,
        material_id: row.itemType === "material" ? row.itemSourceId : null,
        consumable_id: row.itemType === "consumable" ? row.itemSourceId : null,
        quantity: row.quantity,
        price: row.price,
      }));

      for (let index = 0; index < orderItems.length; index += 1) {
        const item = orderItems[index];
        const row = importPreview.rows[index];

        const { error: itemError } = await supabase
          .from("customer_order_items")
          .insert(item);

        if (itemError) {
          await supabase.from("customer_orders").delete().eq("id", createdOrder.id);

          throw new Error(
            `Ошибка позиции Excel, строка ${row.rowNumber}, артикул «${row.article}»: ` +
              `${itemError.code || "без кода"} — ${itemError.message}` +
              (itemError.details ? ` | details: ${itemError.details}` : "") +
              (itemError.hint ? ` | hint: ${itemError.hint}` : ""),
          );
        }
      }

      setImportPreview(null);
      await loadOrders();
      await openOrderById(createdOrder.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось импортировать заказ.",
      );
    }
  }

  async function openOrder(order: CustomerOrder) {
    try {
      setSelectedOrder(order);
      setSelectedOrderItems([]);
      setSelectedOrderLoading(true);
      setModalMode("view");
      setError("");

      const { data, error } = await supabase
        .from("customer_order_items")
        .select(
          `
          *,
          products(name, article),
          materials(name, article, color_id),
          consumables(name, article)
        `,
        )
        .eq("customer_order_id", order.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setSelectedOrderItems((data as CustomerOrderItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки заказа покупателя",
      );
    } finally {
      setSelectedOrderLoading(false);
    }
  }

  async function openOrderById(orderId: string) {
    const { data, error } = await supabase
      .from("customer_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) throw error;

    await openOrder(data as CustomerOrder);
  }

  async function openShipment(shipment: CustomerShipment) {
    try {
      setSelectedShipment(shipment);
      setSelectedShipmentItems([]);
      setError("");

      const { data, error } = await supabase
        .from("customer_shipment_items")
        .select(
          `
          *,
          products(name, article),
          materials(name, article, color_id),
          consumables(name, article)
        `,
        )
        .eq("customer_shipment_id", shipment.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setSelectedShipmentItems((data as CustomerShipmentItem[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки отгрузки",
      );
    }
  }

  function openCreateOrder() {
    setSelectedOrder(null);
    setSelectedOrderItems([]);
    setModalMode("create");
    setError("");
  }

  function closeModal() {
    setModalMode(null);
    setSelectedOrder(null);
    setSelectedOrderItems([]);
  }

  async function handleOrderSaved(createdOrderId?: string) {
    await loadOrders();
    await loadShipments();

    if (!createdOrderId) {
      closeModal();
      return;
    }

    try {
      await openOrderById(createdOrderId);
    } catch (error) {
      closeModal();
      setError(
        error instanceof Error
          ? error.message
          : "Заказ создан, но открыть его не удалось",
      );
    }
  }

  async function handleShipmentSaved() {
    setSelectedShipment(null);
    await loadOrders();
    await loadShipments();
  }

  function refreshCurrentTab() {
    if (activeTab === "orders") {
      loadOrders();
      return;
    }

    loadShipments();
  }

  function getStatusName(statusCode: string, statusId?: string | null) {
    const status =
      statuses.find((item) => item.id === statusId) ||
      statuses.find((item) => item.code === statusCode);

    return status?.name || statusCode || "—";
  }

  function getStatusColor(statusCode: string, statusId?: string | null) {
    const status =
      statuses.find((item) => item.id === statusId) ||
      statuses.find((item) => item.code === statusCode);

    return status?.color || "#64748b";
  }

  function renderStatusBadge(statusCode: string, statusId?: string | null) {
    const color = getStatusColor(statusCode, statusId);

    return (
      <span
        style={{
          ...statusBadgeStyle,
          color,
          borderColor: `${color}55`,
          background: `${color}12`,
        }}
      >
        {getStatusName(statusCode, statusId)}
      </span>
    );
  }

  return (
    <div style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            Продажи / Отгрузки
          </div>
          <div style={{ color: "#64748b", marginTop: 4 }}>
            Заказы покупателей, отгрузки и оплаты.
          </div>
        </div>

        <div style={actionsStyle}>
          <button type="button" onClick={refreshCurrentTab} style={secondaryButtonStyle}>
            Обновить
          </button>

          {activeTab === "orders" ? (
            <>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void prepareExcelImport(file);
                }}
              />
              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                style={secondaryButtonStyle}
              >
                📥 Загрузить Excel
              </button>
              <button type="button" onClick={openCreateOrder} style={primaryButtonStyle}>
                + Новый заказ покупателя
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                window.alert("Отгрузку создаём из карточки заказа покупателя через кнопку “+ Создать документ”.")
              }
              style={primaryButtonStyle}
            >
              + Новая отгрузка
            </button>
          )}
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      {directoriesLoading && (
        <div style={{ color: "#64748b", fontWeight: 700 }}>
          Загружаю справочники...
        </div>
      )}

      <div style={tabsWrapStyle}>
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          style={tabButtonStyle(activeTab === "orders")}
        >
          📄 Заказы покупателей
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shipments")}
          style={tabButtonStyle(activeTab === "shipments")}
        >
          🚚 Отгрузки
        </button>
      </div>

      {activeTab === "orders" && (
        <>
          {ordersLoading ? (
            <div style={emptyStyle}>Загружаю заказы покупателей...</div>
          ) : orders.length === 0 ? (
            <div style={emptyStyle}>
              Заказов покупателей пока нет. Создай первый заказ.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Номер</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Покупатель</th>
                    <th style={thStyle}>Сумма</th>
                    <th style={thStyle}>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => openOrder(order)}
                          style={linkButtonStyle}
                        >
                          {order.order_number || "Без номера"}
                        </button>
                      </td>
                      <td style={tdStyle}>{order.order_date || "—"}</td>
                      <td style={tdStyle}>{order.customer_name || "—"}</td>
                      <td style={tdStyle}>
                        {Number(order.total_amount || 0).toLocaleString(
                          "ru-RU",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}{" "}
                        ₽
                      </td>
                      <td style={tdStyle}>
                        {renderStatusBadge(order.status, order.status_id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "shipments" && (
        <>
          {shipmentsLoading ? (
            <div style={emptyStyle}>Загружаю отгрузки...</div>
          ) : shipments.length === 0 ? (
            <div style={emptyStyle}>
              Отгрузок пока нет. Создай отгрузку из карточки заказа покупателя.
            </div>
          ) : (
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Номер</th>
                    <th style={thStyle}>Дата</th>
                    <th style={thStyle}>Покупатель</th>
                    <th style={thStyle}>Сумма</th>
                    <th style={thStyle}>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => openShipment(shipment)}
                          style={linkButtonStyle}
                        >
                          {shipment.shipment_number || "Черновик отгрузки"}
                        </button>
                      </td>
                      <td style={tdStyle}>{shipment.shipment_date || "—"}</td>
                      <td style={tdStyle}>{shipment.customer_name || "—"}</td>
                      <td style={tdStyle}>
                        {Number(shipment.total_amount || 0).toLocaleString(
                          "ru-RU",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}{" "}
                        ₽
                      </td>
                      <td style={tdStyle}>
                        {renderStatusBadge(shipment.status, shipment.status_id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalMode && (
        <CustomerOrderModal
          mode={modalMode}
          order={selectedOrder}
          orderItems={selectedOrderItems}
          orderLoading={selectedOrderLoading}
          products={products}
          materials={materials}
          consumables={consumables}
          resaleProducts={resaleProducts}
          counterparties={counterparties}
          directoriesLoading={directoriesLoading}
          onClose={closeModal}
          onSaved={handleOrderSaved}
        />
      )}

      {importPreview && (
        <div style={overlayStyle}>
          <div style={importPreviewModalStyle}>
            <div style={importPreviewHeaderStyle}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Предпросмотр импорта</div>
                <div style={{ color: "#64748b", marginTop: 4 }}>{importPreview.fileName}</div>
              </div>
              <button type="button" onClick={() => setImportPreview(null)} style={modalCloseButtonStyle}>
                ×
              </button>
            </div>

            <div style={importSummaryStyle}>
              <strong>{importPreview.rows.filter((row) => row.status === "ready").length}</strong> готово к импорту
              {" · "}
              <strong>{importPreview.rows.filter((row) => row.status === "error").length}</strong> ошибок
            </div>

            <div style={importTableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Строка</th>
                    <th style={thStyle}>Артикул</th>
                    <th style={thStyle}>Номенклатура</th>
                    <th style={thStyle}>Тип</th>
                    <th style={thStyle}>Количество</th>
                    <th style={thStyle}>Цена</th>
                    <th style={thStyle}>Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.article}`}>
                      <td style={tdStyle}>{row.rowNumber}</td>
                      <td style={tdStyle}>{row.article || "—"}</td>
                      <td style={tdStyle}>{row.name || "—"}</td>
                      <td style={tdStyle}>{row.itemType || "—"}</td>
                      <td style={tdStyle}>{row.quantity}</td>
                      <td style={tdStyle}>{row.price.toLocaleString("ru-RU")} ₽</td>
                      <td style={{ ...tdStyle, color: row.status === "error" ? "#b91c1c" : "#15803d", fontWeight: 800 }}>
                        {row.status === "error" ? row.message : "✓ Найдено"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={importActionsStyle}>
              <button type="button" onClick={() => setImportPreview(null)} style={secondaryButtonStyle}>
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void importPreparedOrder()}
                style={primaryButtonStyle}
                disabled={importPreview.rows.some((row) => row.status !== "ready")}
              >
                Импортировать заказ
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedShipment && (
        <CustomerShipmentModal
          shipment={selectedShipment}
          shipmentItems={selectedShipmentItems}
          onClose={() => setSelectedShipment(null)}
          onSaved={handleShipmentSaved}
          onOpenDocument={async (type, id) => {
            setSelectedShipment(null);

            if (type === "customer_order") {
              await openOrderById(id);
            }
          }}
        />
      )}
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 20,
  border: "1px solid #dbe4f0",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const tabsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    border: active ? "1px solid #93c5fd" : "1px solid #dbe4f0",
    background: active ? "#eff6ff" : "#ffffff",
    color: active ? "#1d4ed8" : "#475569",
    borderRadius: 14,
    padding: "10px 13px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 14,
  };
}

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
  color: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 8px 18px rgba(37, 99, 235, 0.25)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
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
  padding: 24,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
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

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#2563eb",
  padding: 0,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 14,
  textDecoration: "underline",
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const importPreviewModalStyle: React.CSSProperties = {
  width: "min(1180px, 96vw)",
  maxHeight: "90vh",
  background: "#ffffff",
  borderRadius: 20,
  border: "1px solid #dbe4f0",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const importPreviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "18px 20px",
  borderBottom: "1px solid #e2e8f0",
};

const modalCloseButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 10,
  width: 36,
  height: 36,
  fontSize: 24,
  cursor: "pointer",
  lineHeight: 1,
};

const importSummaryStyle: React.CSSProperties = {
  padding: "12px 20px",
  color: "#475569",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const importTableWrapStyle: React.CSSProperties = {
  overflow: "auto",
  padding: 16,
  flex: 1,
};

const importActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: 16,
  borderTop: "1px solid #e2e8f0",
};
