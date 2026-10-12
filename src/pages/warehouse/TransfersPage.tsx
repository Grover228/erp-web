import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabase";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  warehouse_type: string;
  is_active: boolean;
};

type StockRow = {
  warehouse_id: string;
  item_type: "product" | "resale_product" | "material" | "consumable";
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  item_id: string | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
  quantity_available: number | null;
};

type CatalogRow = {
  id: string;
  name: string;
  article: string;
  item_type: "product" | "resale_product" | "material" | "consumable";
};

type Transfer = {
  id: string;
  transfer_number: string;
  transfer_date: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  comment: string | null;
  created_at: string;
};

type TransferLineDraft = {
  key: string;
  item_type: "product" | "resale_product" | "material" | "consumable";
  product_id: string | null;
  material_id: string | null;
  consumable_id: string | null;
  item_id: string | null;
  name: string;
  article: string;
  available: number;
  quantity: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
}

function itemKey(row: Pick<StockRow, "item_type" | "product_id" | "material_id" | "consumable_id" | "item_id">) {
  const id =
    row.item_type === "product" ? row.product_id :
    row.item_type === "resale_product" ? row.item_id :
    row.item_type === "material" ? row.material_id :
    row.consumable_id;
  return `${row.item_type}:${id || ""}`;
}

function itemTypeLabel(type: string) {
  if (type === "product") return "Продукция";
  if (type === "resale_product") return "Перепродажа";
  if (type === "material") return "Материал";
  if (type === "consumable") return "Расходник";
  return type;
}

export default function TransfersPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [transferDate, setTransferDate] = useState(today());
  const [comment, setComment] = useState("");
  const [drafts, setDrafts] = useState<Record<string, TransferLineDraft>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        warehousesResult,
        stockResult,
        productsResult,
        resaleResult,
        materialsResult,
        consumablesResult,
        transfersResult,
      ] = await Promise.all([
        supabase.from("warehouses").select("id,code,name,warehouse_type,is_active").eq("is_active", true).order("name"),
        supabase.from("stock_available_by_warehouse").select("warehouse_id,item_type,product_id,material_id,consumable_id,item_id,quantity_on_hand,quantity_reserved,quantity_available"),
        supabase.from("products").select("id,name,article").order("name"),
        supabase.from("items").select("id,name,article,item_type").eq("item_type", "resale_product").order("name"),
        supabase.from("materials").select("id,name,article").order("name"),
        supabase.from("consumables").select("id,name,article").order("name"),
        supabase.from("stock_transfers").select("id,transfer_number,transfer_date,from_warehouse_id,to_warehouse_id,status,comment,created_at").order("created_at", { ascending: false }).limit(20),
      ]);

      if (warehousesResult.error) throw warehousesResult.error;
      if (stockResult.error) throw stockResult.error;
      if (productsResult.error) throw productsResult.error;
      if (resaleResult.error) throw resaleResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (consumablesResult.error) throw consumablesResult.error;
      if (transfersResult.error) throw transfersResult.error;

      const nextWarehouses = (warehousesResult.data as Warehouse[]) || [];
      setWarehouses(nextWarehouses);
      setStock((stockResult.data as StockRow[]) || []);
      setTransfers((transfersResult.data as Transfer[]) || []);

      const nextCatalog: CatalogRow[] = [
        ...((productsResult.data || []).map((row: any) => ({ ...row, item_type: "product" as const }))),
        ...((resaleResult.data || []).map((row: any) => ({ ...row, item_type: "resale_product" as const }))),
        ...((materialsResult.data || []).map((row: any) => ({ ...row, item_type: "material" as const }))),
        ...((consumablesResult.data || []).map((row: any) => ({ ...row, item_type: "consumable" as const }))),
      ];
      setCatalog(nextCatalog);

      if (!fromWarehouseId) {
        const primary = nextWarehouses.find((row) => row.code === "PRIMARY") || nextWarehouses[0];
        setFromWarehouseId(primary?.id || "");
      }
      if (!toWarehouseId) {
        const ozon = nextWarehouses.find((row) => row.code === "OZON_FBO") || nextWarehouses.find((row) => row.id !== fromWarehouseId);
        setToWarehouseId(ozon?.id || "");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить перемещения.");
    } finally {
      setLoading(false);
    }
  }

  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogRow>();
    for (const row of catalog) map.set(`${row.item_type}:${row.id}`, row);
    return map;
  }, [catalog]);

  const sourceRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stock
      .filter((row) => row.warehouse_id === fromWarehouseId && Number(row.quantity_available || 0) > 0)
      .map((row) => {
        const key = itemKey(row);
        const item = catalogMap.get(key);
        return {
          ...row,
          key,
          name: item?.name || key,
          article: item?.article || "",
          available: Number(row.quantity_available || 0),
        };
      })
      .filter((row) => !term || row.name.toLowerCase().includes(term) || row.article.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [stock, fromWarehouseId, catalogMap, search]);

  const selectedLines = useMemo(
    () => Object.values(drafts).filter((row) => Number(row.quantity.replace(",", ".")) > 0),
    [drafts],
  );

  const totalQty = useMemo(
    () => selectedLines.reduce((sum, row) => sum + Number(row.quantity.replace(",", ".") || 0), 0),
    [selectedLines],
  );

  function updateQuantity(row: (typeof sourceRows)[number], value: string) {
    const clean = value.replace(",", ".");
    setDrafts((prev) => ({
      ...prev,
      [row.key]: {
        key: row.key,
        item_type: row.item_type,
        product_id: row.product_id,
        material_id: row.material_id,
        consumable_id: row.consumable_id,
        item_id: row.item_id,
        name: row.name,
        article: row.article,
        available: row.available,
        quantity: clean,
      },
    }));
  }

  async function handlePostTransfer() {
    try {
      setError("");
      setMessage("");

      if (!fromWarehouseId || !toWarehouseId) throw new Error("Выберите оба склада.");
      if (fromWarehouseId === toWarehouseId) throw new Error("Склад отправитель и получатель должны отличаться.");
      if (!selectedLines.length) throw new Error("Укажите количество хотя бы у одной позиции.");

      for (const line of selectedLines) {
        const qty = Number(line.quantity.replace(",", "."));
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Некорректное количество: ${line.article || line.name}`);
        if (qty > line.available) throw new Error(`Недостаточно остатка: ${line.article || line.name}. Доступно ${formatQty(line.available)}.`);
      }

      setSaving(true);

      const lines = selectedLines.map((line) => ({
        item_type: line.item_type,
        product_id: line.product_id,
        material_id: line.material_id,
        consumable_id: line.consumable_id,
        item_id: line.item_id,
        quantity: Number(line.quantity.replace(",", ".")),
      }));

      const { data, error: invokeError } = await supabase.functions.invoke("stock-transfer", {
        body: {
          fromWarehouseId,
          toWarehouseId,
          transferDate,
          comment,
          lines,
        },
      });

      if (data?.error) throw new Error(data.error);
      if (invokeError) throw invokeError;

      setMessage(`Перемещение ${data?.transferNumber || ""} проведено. Позиций: ${data?.lineCount || selectedLines.length}, количество: ${formatQty(totalQty)}.`);
      setDrafts({});
      setComment("");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось провести перемещение.");
    } finally {
      setSaving(false);
    }
  }

  const warehouseName = (id: string) => warehouses.find((row) => row.id === id)?.name || "—";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Перемещение между складами</div>
            <div style={{ color: "#64748b", marginTop: 6, lineHeight: 1.5 }}>
              Внутреннее движение товара. Общий остаток ERP не меняется: количество списывается со склада-источника и приходуется на склад-получатель.
            </div>
          </div>
          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 12, padding: "9px 12px", fontWeight: 800 }}>
            Новая схема складов
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        {message && <div style={successStyle}>{message}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Откуда</span>
            <select value={fromWarehouseId} onChange={(e) => { setFromWarehouseId(e.target.value); setDrafts({}); }} style={inputStyle}>
              {warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Куда</span>
            <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} style={inputStyle}>
              {warehouses.filter((row) => row.id !== fromWarehouseId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Дата</span>
            <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Комментарий</span>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Необязательно" style={inputStyle} />
          </label>
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 900 }}>Товары на складе «{warehouseName(fromWarehouseId)}»</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Показываются только позиции с доступным остатком.</div>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по товару или артикулу" style={{ ...inputStyle, width: "min(360px,100%)" }} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                {["Артикул", "Наименование", "Тип", "Доступно", "Переместить"].map((title) => <th key={title} style={thStyle}>{title}</th>)}
              </tr>
            </thead>
            <tbody>
              {!loading && sourceRows.map((row) => (
                <tr key={row.key} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td style={tdStrongStyle}>{row.article || "—"}</td>
                  <td style={tdStyle}>{row.name}</td>
                  <td style={tdStyle}>{itemTypeLabel(row.item_type)}</td>
                  <td style={{ ...tdStyle, fontWeight: 850 }}>{formatQty(row.available)}</td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      min={0}
                      max={row.available}
                      step="any"
                      value={drafts[row.key]?.quantity || ""}
                      onChange={(e) => updateQuantity(row, e.target.value)}
                      placeholder="0"
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </td>
                </tr>
              ))}
              {!loading && sourceRows.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>На выбранном складе нет доступных позиций.</td></tr>
              )}
              {loading && <tr><td colSpan={5} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>Загрузка…</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 18, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ color: "#475569" }}>
            Выбрано позиций: <b>{selectedLines.length}</b> · Всего: <b style={{ color: "#005bff", fontSize: 20 }}>{formatQty(totalQty)}</b>
          </div>
          <button
            onClick={handlePostTransfer}
            disabled={saving || selectedLines.length === 0 || fromWarehouseId === toWarehouseId}
            style={{
              border: 0,
              background: saving || selectedLines.length === 0 ? "#94a3b8" : "#005bff",
              color: "#fff",
              borderRadius: 12,
              padding: "12px 18px",
              fontWeight: 900,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Провожу…" : "Провести перемещение"}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>Последние перемещения</div>
        {transfers.length === 0 ? (
          <div style={{ color: "#64748b" }}>Перемещений ещё не было.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {transfers.map((row) => (
              <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 13, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{row.transfer_number}</div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                    {new Date(row.transfer_date + "T00:00:00").toLocaleDateString("ru-RU")} · {warehouseName(row.from_warehouse_id)} → {warehouseName(row.to_warehouse_id)}
                  </div>
                  {row.comment && <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>{row.comment}</div>}
                </div>
                <span style={{ alignSelf: "center", background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "5px 9px", fontWeight: 800, fontSize: 12 }}>Проведено</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe4f0",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 10px 24px rgba(15,23,42,.05)",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  color: "#334155",
  fontWeight: 850,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "10px 12px",
  background: "#fff",
  color: "#0f172a",
  fontSize: 14,
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  color: "#334155",
  fontSize: 14,
};

const tdStrongStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#0f172a",
  fontWeight: 900,
};

const errorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 700,
};

const successStyle: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 12,
  padding: 12,
  fontWeight: 700,
};
