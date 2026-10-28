import { useState } from "react";
import { supabase } from "../supabase";

type Audit = {
  generatedAt: string;
  totals: { operations: number; gross: number; commission: number; services: number; net: number; cost: number; contribution: number };
  reconciliation: { accountingDifference: number; feeDifference: number };
  categories: Array<{ category: string; count: number; amount: number }>;
  schemes: Array<{ scheme: string; count: number; amount: number }>;
  fees: Array<{ typeId: number; label: string; amount: number; count: number }>;
  byArticle: Array<{ article: string; amount: number; count: number; reverseLogistics: number; delivery: number; returnsHandling: number }>;
  allocation: { unmappedFees: number; missingSkuLines: number };
  notes: string[];
};
const rub = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(n || 0);
const number = (n: number) => new Intl.NumberFormat("ru-RU").format(n || 0);
const box: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 };
export default function OzonAudit({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke("ozon-audit", { body: { from, to } });
      if (invokeError) throw invokeError;
      if (response?.error) throw new Error(response.error);
      setData(response as Audit);
    } catch (e) { setError(e instanceof Error ? e.message : "Ошибка аудита"); }
    finally { setLoading(false); }
  }
  return <section style={{ display: "grid", gap: 16 }}>
    <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>Аудит финансов Ozon</h2><div style={{ color: "#64748b", marginTop: 5 }}>Период {from} — {to}. Только чтение, без изменений учёта.</div></div>
      <button type="button" disabled={loading} onClick={load} style={{ border: 0, borderRadius: 10, padding: "12px 18px", color: "#fff", background: "#005bff", cursor: "pointer", fontWeight: 700 }}>{loading ? "Анализируем…" : "Сформировать аудит"}</button>
    </div>
    {error && <div role="alert" style={{ ...box, color: "#b91c1c" }}>{error}</div>}
    {!data && !loading && <div style={{ ...box, color: "#64748b" }}>Нажмите «Сформировать аудит», чтобы сверить операции и расходы по SKU.</div>}
    {data && <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: 12 }}>
        {([["Операций", number(data.totals.operations)], ["Начисления", rub(data.totals.gross)], ["Комиссия", rub(data.totals.commission)], ["Услуги", rub(data.totals.services)], ["После Ozon", rub(data.totals.net)], ["Себестоимость", rub(data.totals.cost)], ["Вклад после себестоимости", rub(data.totals.contribution)]] as const).map(([label, value]) => <div key={label} style={box}><div style={{ color: "#64748b", fontSize: 13 }}>{label}</div><strong style={{ display: "block", marginTop: 8, fontSize: 20 }}>{value}</strong></div>)}
      </div>
      <div style={box}><h3>Контроль сверки</h3><p>Разница финансового уравнения: <b>{rub(data.reconciliation.accountingDifference)}</b> · Разница между услугами и расшифрованными сборами: <b>{rub(data.reconciliation.feeDifference)}</b></p><p>Без сопоставления с SKU: <b>{rub(data.allocation.unmappedFees)}</b> ({number(data.allocation.missingSkuLines)} строк). Не распределяются искусственно.</p></div>
      <div style={{ ...box, overflowX: "auto" }}><h3>Расходы по видам услуг</h3><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}><thead><tr><th align="left">Услуга</th><th align="right">Строк</th><th align="right">Сумма</th></tr></thead><tbody>{data.fees.map(f => <tr key={f.typeId}><td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{f.label} (#{f.typeId})</td><td align="right">{number(f.count)}</td><td align="right">{rub(f.amount)}</td></tr>)}</tbody></table></div>
      <div style={{ ...box, overflowX: "auto" }}><h3>Расходы по артикулам</h3><table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}><thead><tr><th align="left">Артикул</th><th align="right">Все услуги</th><th align="right">Логистика</th><th align="right">Обратная</th><th align="right">Приём возврата</th></tr></thead><tbody>{data.byArticle.map(r => <tr key={r.article}><td style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>{r.article}</td><td align="right">{rub(r.amount)}</td><td align="right">{rub(r.delivery)}</td><td align="right">{rub(r.reverseLogistics)}</td><td align="right">{rub(r.returnsHandling)}</td></tr>)}</tbody></table></div>
      <div style={{ ...box, color: "#64748b", fontSize: 13 }}>{data.notes.map(note => <p key={note}>{note}</p>)}<p>Сформировано: {new Date(data.generatedAt).toLocaleString("ru-RU")}</p></div>
    </>}
  </section>;
}
