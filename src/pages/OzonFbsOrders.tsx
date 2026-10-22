import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type FbsProduct = {
  offerId: string;
  name: string;
  sku: string;
  quantity: number;
};

type FbsPosting = {
  postingNumber: string;
  status: string;
  substatus: string;
  inProcessAt: string;
  shipmentDate: string;
  warehouse: string;
  deliveryMethod: string;
  products: FbsProduct[];
};

const statusLabels: Record<string, string> = {
  awaiting_packaging: "Ожидает сборки",
  awaiting_deliver: "Ожидает отгрузки",
  delivering: "Доставляется",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const fieldStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
  color: "#0f172a",
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function displayDate(value: string) {
  if (!value) return "—";
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? new Date(time).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
    : "—";
}

export default function OzonFbsOrders() {
  const [from, setFrom] = useState(() => localDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => localDate(new Date()));
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<FbsPosting[]>([]);
  const [cursor, setCursor] = useState("");
  const [hasNext, setHasNext] = useState(false);
  const [loadedAt, setLoadedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setRows([]);
    setCursor("");
    setHasNext(false);
    setLoadedAt("");
    setError("");
  }

  async function load(nextCursor = "", firstPage = true) {
    if (loading) return;
    if (!from || !to || from > to) {
      setError("Проверьте выбранный период.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (firstPage) {
        setRows([]);
        setHasNext(false);
      }

      const { data, error: invokeError } = await supabase.functions.invoke("ozon-fbs-orders", {
        body: { action: "list", from, to, status, cursor: nextCursor, limit: 50 },
      });
      if (invokeError) {
        const response = (invokeError as { context?: Response }).context;
        let errorDetails = "";
        if (response && typeof response.json === "function") {
          const body = await response.json().catch(() => null);
          errorDetails = String(body?.error || "");
        }
        throw new Error(errorDetails || invokeError.message);
      }
      if (data?.error) throw new Error(String(data.error));
      if (!Array.isArray(data?.postings)) throw new Error("Сервер вернул неверный формат заказов.");

      const nextRows = data.postings as FbsPosting[];
      setRows((current) => {
        if (firstPage) return nextRows;
        const seen = new Set(current.map((row) => row.postingNumber));
        return [...current, ...nextRows.filter((row) => !seen.has(row.postingNumber))];
      });
      setCursor(String(data?.nextCursor || ""));
      setHasNext(data?.hasNext === true && Boolean(data?.nextCursor));
      setLoadedAt(String(data?.fetchedAt || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось получить заказы FBS.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Первую страницу загружаем однократно при открытии вкладки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const units = rows.reduce(
    (sum, posting) => sum + posting.products.reduce((subtotal, item) => subtotal + Number(item.quantity || 0), 0),
    0,
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18, display: "grid", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Заказы Ozon FBS</h2>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 5 }}>
            Первый этап — безопасный просмотр заказов Ozon. Сборка, статусы на Ozon и остатки ERP не изменяются.
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 5, fontSize: 13, color: "#475569" }}>
            С даты
            <input type="date" value={from} max={to} onChange={(event) => { setFrom(event.target.value); reset(); }} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 13, color: "#475569" }}>
            По дату
            <input type="date" value={to} min={from} onChange={(event) => { setTo(event.target.value); reset(); }} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 13, color: "#475569" }}>
            Статус
            <select value={status} onChange={(event) => { setStatus(event.target.value); reset(); }} style={fieldStyle}>
              <option value="all">Все статусы</option>
              <option value="awaiting_packaging">Ожидает сборки</option>
              <option value="awaiting_deliver">Ожидает отгрузки</option>
              <option value="delivering">Доставляется</option>
              <option value="delivered">Доставлен</option>
              <option value="cancelled">Отменён</option>
            </select>
          </label>
          <button type="button" onClick={() => void load("", true)} disabled={loading || !from || !to || from > to}
            style={{ border: 0, background: loading ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 10, padding: "11px 16px", fontWeight: 850, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "Загружаю…" : "Получить заказы"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#475569" }}>
          <span>Загружено отправлений: <b>{rows.length}</b></span>
          <span>Товаров: <b>{units} шт.</b></span>
          {loadedAt && <span>Обновлено: {displayDate(loadedAt)}</span>}
          {hasNext && <span>Есть следующая страница</span>}
        </div>
        {error && <div role="alert" style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: 12, color: "#9a3412" }}>{error}</div>}
      </section>

      {rows.map((row) => (
        <section key={row.postingNumber} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{row.postingNumber}</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{row.warehouse || row.deliveryMethod || "Склад не указан"}</div>
            </div>
            <span style={{ borderRadius: 999, background: row.status === "cancelled" ? "#fee2e2" : "#eff6ff", color: row.status === "cancelled" ? "#991b1b" : "#1d4ed8", padding: "6px 11px", fontSize: 12, fontWeight: 800 }}>
              {statusLabels[row.status] || row.status || "Статус неизвестен"}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12, color: "#475569" }}>
            <span>Поступил: {displayDate(row.inProcessAt)}</span>
            <span>Плановая отгрузка: {displayDate(row.shipmentDate)}</span>
            <span>Позиций: {row.products.length}</span>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {row.products.map((item, index) => (
              <div key={item.sku + ":" + index} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 9, display: "flex", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 750, color: "#0f172a" }}>{item.name || item.offerId || "Без названия"}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Артикул: {item.offerId || "—"} · SKU: {item.sku || "—"}</div>
                </div>
                <div style={{ fontWeight: 900, whiteSpace: "nowrap", color: "#0f172a" }}>{item.quantity} шт.</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!loading && !error && rows.length === 0 && (
        <section style={{ padding: 28, color: "#64748b", textAlign: "center", background: "#fff", borderRadius: 16 }}>
          Заказов за выбранный период пока нет.
        </section>
      )}
      {hasNext && (
        <button type="button" onClick={() => void load(cursor, false)} disabled={loading}
          style={{ justifySelf: "center", border: "1px solid #bfdbfe", borderRadius: 11, background: "#eff6ff", color: "#1d4ed8", padding: "12px 18px", fontWeight: 850, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Загружаю…" : "Загрузить ещё 50 отправлений"}
        </button>
      )}
    </div>
  );
}
