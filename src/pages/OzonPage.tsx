import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Operation = {
  id: string;
  operation_date: string;
  operation_type_name: string | null;
  posting_number: string | null;
  amount: number | string;
  accruals_for_sale: number | string;
  sale_commission: number | string;
  services_total: number | string;
  cost_of_goods: number | string;
  profit: number | string;
  matched: boolean;
};

type SyncRun = {
  id: string;
  started_at: string;
  status: string;
  operations_loaded: number;
  error_message: string | null;
};

const inputStyle = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 12px" };

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(value: number | string) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function SummaryCard({ title, value, color = "#0f172a" }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 8 }}>{title}</div>
      <div style={{ color, fontSize: 24, fontWeight: 800, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

export default function OzonPage() {
  const today = new Date();
  const [from, setFrom] = useState(dateInput(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateInput(today));
  const [operations, setOperations] = useState<Operation[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [instructionOpen, setInstructionOpen] = useState(false);

  const summary = useMemo(() => operations.reduce(
    (sum, row) => ({
      gross: sum.gross + Number(row.accruals_for_sale || 0),
      ozon: sum.ozon + Number(row.sale_commission || 0) + Number(row.services_total || 0),
      net: sum.net + Number(row.amount || 0),
      cost: sum.cost + Number(row.cost_of_goods || 0),
      profit: sum.profit + Number(row.profit || 0),
      unmatched: sum.unmatched + (row.matched ? 0 : 1),
    }),
    { gross: 0, ozon: 0, net: 0, cost: 0, profit: 0, unmatched: 0 }
  ), [operations]);

  useEffect(() => { void loadData(); }, [from, to]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [operationResult, runResult] = await Promise.all([
        supabase.from("ozon_operations")
          .select("id,operation_date,operation_type_name,posting_number,amount,accruals_for_sale,sale_commission,services_total,cost_of_goods,profit,matched")
          .gte("operation_date", `${from}T00:00:00.000Z`)
          .lte("operation_date", `${to}T23:59:59.999Z`)
          .order("operation_date", { ascending: false }).limit(1000),
        supabase.from("ozon_sync_runs")
          .select("id,started_at,status,operations_loaded,error_message")
          .order("started_at", { ascending: false }).limit(10),
      ]);
      if (operationResult.error) throw operationResult.error;
      if (runResult.error) throw runResult.error;
      setOperations((operationResult.data as Operation[]) || []);
      setRuns((runResult.data as SyncRun[]) || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные Ozon");
    } finally {
      setLoading(false);
    }
  }

  async function syncOzon() {
    try {
      setSyncing(true);
      setError("");
      setMessage("");
      const { data, error: invokeError } = await supabase.functions.invoke("ozon-sync", { body: { from, to } });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setMessage(`Готово: получено ${data?.loaded || 0}, обновлено ${data?.updated || 0} операций.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка синхронизации с Ozon");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <header style={{ background: "linear-gradient(135deg,#005bff,#0046c7)", color: "#fff", borderRadius: 20, padding: 22 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "end", justifyContent: "space-between" }}>
          <div><div style={{ fontSize: 24, fontWeight: 900 }}>Финансы Ozon</div><div style={{ marginTop: 7, opacity: 0.86 }}>Начисления — по дате операции, выплата — отдельное движение денег.</div></div>
          <button onClick={() => setInstructionOpen((value) => !value)} style={{ border: "1px solid rgba(255,255,255,.55)", background: "rgba(255,255,255,.12)", color: "#fff", borderRadius: 12, padding: "11px 15px", fontWeight: 800, cursor: "pointer" }}>
            {instructionOpen ? "Скрыть инструкцию" : "Как подключить Ozon"}
          </button>
        </div>
      </header>

      {instructionOpen && (
        <section style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 18, padding: 20, color: "#172554" }}>
          <h3 style={{ margin: "0 0 12px" }}>Подключение Seller API</h3>
          <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 10, lineHeight: 1.5 }}>
            <li>В Ozon Seller открой «Настройки» → «API ключи» и создай отдельный ключ Seller API для ERP.</li>
            <li>Дай доступ к финансам и товарам. Изменение цен и управление заказами модулю не нужны.</li>
            <li>Скопируй Client ID и API Key. API Key не отправляй в чат и не вставляй в код сайта.</li>
            <li>В Supabase проекта <b>erp-web</b> открой Edge Functions → Secrets и добавь <code>OZON_CLIENT_ID</code> и <code>OZON_API_KEY</code>.</li>
            <li>Вернись сюда, выбери период и нажми «Забрать данные из Ozon».</li>
          </ol>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fff", fontSize: 13 }}>Повторный запуск безопасен: операции обновляются по идентификаторам Ozon и не задваиваются.</div>
        </section>
      )}

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>С даты<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#475569" }}>По дату<input type="date" value={to} min={from} max={dateInput(today)} onChange={(event) => setTo(event.target.value)} style={inputStyle} /></label>
          <button disabled={syncing || !from || !to} onClick={syncOzon} style={{ border: 0, background: syncing ? "#94a3b8" : "#005bff", color: "#fff", borderRadius: 11, padding: "11px 17px", fontWeight: 800, cursor: syncing ? "wait" : "pointer" }}>{syncing ? "Забираю данные…" : "Забрать данные из Ozon"}</button>
        </div>
        {error && <div style={{ marginTop: 14, color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 10 }}>{error}</div>}
        {message && <div style={{ marginTop: 14, color: "#166534", background: "#f0fdf4", padding: 12, borderRadius: 10 }}>{message}</div>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <SummaryCard title="Продажи до удержаний" value={money(summary.gross)} />
        <SummaryCard title="Комиссии и услуги Ozon" value={money(summary.ozon)} color={summary.ozon < 0 ? "#b91c1c" : "#0f172a"} />
        <SummaryCard title="Начислено к выплате" value={money(summary.net)} color="#005bff" />
        <SummaryCard title="Себестоимость" value={money(summary.cost)} />
        <SummaryCard title="Прибыль до налога" value={money(summary.profit)} color={summary.profit >= 0 ? "#15803d" : "#b91c1c"} />
        <SummaryCard title="Не сопоставлено" value={String(summary.unmatched)} color={summary.unmatched ? "#c2410c" : "#15803d"} />
      </div>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: 18, fontWeight: 850, fontSize: 18 }}>Операции</div>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead><tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>{["Дата", "Операция", "Отправление", "Продажа", "Ozon", "Начислено", "Себестоимость", "Прибыль", "Связь"].map((title) => <th key={title} style={{ padding: 12, fontSize: 12 }}>{title}</th>)}</tr></thead>
          <tbody>
            {!loading && operations.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #eef2f7" }}>
              <td style={{ padding: 12, whiteSpace: "nowrap" }}>{new Date(row.operation_date).toLocaleDateString("ru-RU")}</td><td style={{ padding: 12 }}>{row.operation_type_name || "Операция Ozon"}</td><td style={{ padding: 12 }}>{row.posting_number || "—"}</td><td style={{ padding: 12 }}>{money(row.accruals_for_sale)}</td><td style={{ padding: 12 }}>{money(Number(row.sale_commission) + Number(row.services_total))}</td><td style={{ padding: 12, fontWeight: 700 }}>{money(row.amount)}</td><td style={{ padding: 12 }}>{money(row.cost_of_goods)}</td><td style={{ padding: 12, fontWeight: 800, color: Number(row.profit) >= 0 ? "#15803d" : "#b91c1c" }}>{money(row.profit)}</td><td style={{ padding: 12 }}>{row.matched ? "✓" : "Проверить"}</td>
            </tr>)}
            {!loading && operations.length === 0 && <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>За выбранный период данных пока нет.</td></tr>}
            {loading && <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "#64748b" }}>Загрузка…</td></tr>}
          </tbody>
        </table></div>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, padding: 18 }}>
        <div style={{ fontWeight: 850, fontSize: 18, marginBottom: 12 }}>Последние синхронизации</div>
        {runs.length === 0 ? <div style={{ color: "#64748b" }}>Синхронизаций ещё не было.</div> : runs.map((run) => <div key={run.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, padding: "10px 0", borderTop: "1px solid #eef2f7" }}><span>{new Date(run.started_at).toLocaleString("ru-RU")}</span><span>{run.status === "completed" ? "Готово" : run.status === "failed" ? "Ошибка" : "Выполняется"} · {run.operations_loaded || 0} операций</span>{run.error_message && <span style={{ color: "#b91c1c", width: "100%" }}>{run.error_message}</span>}</div>)}
      </section>
    </div>
  );
}
