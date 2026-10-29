import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabase";

type Charge = { id: string; stage: string; carrier: string | null; reference: string | null; amount: number; created_at: string };
type Payment = { id: string; charge_id: string; amount: number; finance_transaction_id: string };
type Account = { id: string; name: string; current_balance: number };
type Transaction = { id: string; amount: number; type: string; operation_date: string; description: string | null; source_document_type: string | null; source_document_id: string | null };
type Props = { orderId: string; onChanged: (total: number) => void | Promise<void>; onPaymentChanged?: () => void | Promise<void> };
const rub = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(n || 0);
const input: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 10, padding: "9px 11px", width: "100%", boxSizing: "border-box", background: "#fff" };
const button: React.CSSProperties = { border: "1px solid #93c5fd", background: "#eff6ff", borderRadius: 10, padding: "9px 13px", fontWeight: 750, cursor: "pointer", color: "#1d4ed8" };
const field: React.CSSProperties = { display: "grid", gap: 5, minWidth: 150, flex: "1 1 150px", fontSize: 13, color: "#475569" };
const parseRub = (s: string) => Number(s.replace(",", "."));
const today = () => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,10); };
export default function SupplierDeliveryStages({ orderId, onChanged, onPaymentChanged }: Props) {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState("Доставка по России");
  const [carrier, setCarrier] = useState("");
  const [reference, setReference] = useState("");
  const [cost, setCost] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payChargeId, setPayChargeId] = useState<string | null>(null);
  const [payAccount, setPayAccount] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(today);
  const [linkExisting, setLinkExisting] = useState(false);
  const [existingId, setExistingId] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chargeResult, paymentResult, accountResult, txResult] = await Promise.all([
        supabase.from("supplier_delivery_charges").select("*").eq("supplier_order_id", orderId).order("created_at"),
        supabase.from("supplier_delivery_payments").select("id,charge_id,amount,finance_transaction_id"),
        supabase.from("finance_accounts").select("id,name,current_balance").eq("is_active", true),
        supabase.from("finance_transactions").select("id,amount,type,operation_date,description,source_document_type,source_document_id")
          .eq("type", "expense").order("operation_date", { ascending: false }).limit(150),
      ]);
      if (chargeResult.error) throw chargeResult.error;
      if (paymentResult.error) throw paymentResult.error;
      if (accountResult.error) throw accountResult.error;
      if (txResult.error) throw txResult.error;
      setCharges((chargeResult.data || []) as Charge[]);
      setPayments((paymentResult.data || []) as Payment[]);
      setAccounts((accountResult.data || []) as Account[]);
      setTransactions((txResult.data || []) as Transaction[]);
      if (!payAccount && accountResult.data?.length) setPayAccount(accountResult.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить доставки");
    } finally { setLoading(false); }
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);
  const total = charges.reduce((s, c) => s + Number(c.amount), 0);
  const paid = payments.filter(p => charges.some(c => c.id === p.charge_id)).reduce((s,p) => s + Number(p.amount),0);
  const paidFor = (id: string) => payments.filter(p => p.charge_id === id).reduce((s,p) => s + Number(p.amount),0);
  function resetEditor() {
    setOpen(false); setEditingId(null); setCost(""); setCarrier(""); setReference(""); setStage("Доставка по России");
  }
  async function changed() {
    const { data, error } = await supabase.from("supplier_orders").select("delivery_cost").eq("id", orderId).single();
    if (error) throw error;
    await onChanged(Number(data.delivery_cost || 0));
  }
  async function saveCharge() {
    const amount = parseRub(cost);
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount*100)-amount*100)>0.00001) {
      setError("Укажи стоимость доставки больше нуля с точностью до копейки."); return;
    }
    if (!stage.trim()) { setError("Укажи этап доставки."); return; }
    try {
      setSaving(true); setError("");
      const row = { stage: stage.trim(), carrier: carrier.trim() || null, reference: reference.trim() || null, amount };
      const result = editingId
        ? await supabase.from("supplier_delivery_charges").update(row).eq("id", editingId)
        : await supabase.from("supplier_delivery_charges").insert({ ...row, supplier_order_id: orderId });
      if (result.error) throw result.error;
      resetEditor();
      await load();
      await changed();
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить доставку"); }
    finally { setSaving(false); }
  }
  async function removeCharge(c: Charge) {
    if (paidFor(c.id) > 0) { setError("Оплаченный этап нельзя удалить."); return; }
    if (!window.confirm(`Удалить этап «${c.stage}» на ${rub(Number(c.amount))}?`)) return;
    try {
      setSaving(true); setError("");
      const {error: e} = await supabase.from("supplier_delivery_charges").delete().eq("id", c.id);
      if (e) throw e;
      await load(); await changed();
    } catch(e) { setError(e instanceof Error ? e.message : "Ошибка удаления"); }
    finally { setSaving(false); }
  }
  function startPay(c: Charge) {
    setPayChargeId(c.id); setPayAmount((Number(c.amount)-paidFor(c.id)).toFixed(2)); setPayDate(today());
    setLinkExisting(false); setExistingId(""); setRequestId(crypto.randomUUID()); setError("");
  }
  const chosenCharge = charges.find(c => c.id === payChargeId);
  const linkedTxIds = new Set(payments.map(p => p.finance_transaction_id));
  const candidates = transactions.filter(t =>
    !linkedTxIds.has(t.id) &&
    (!t.source_document_type || (t.source_document_type === "supplier_delivery" && t.source_document_id === payChargeId)) &&
    (!chosenCharge || Number(t.amount) <= Number(chosenCharge.amount) - paidFor(chosenCharge.id) + 0.001)
  );
  async function savePayment() {
    if (!chosenCharge) return;
    try {
      setSaving(true); setError("");
      if (linkExisting) {
        const tx = candidates.find(t => t.id === existingId);
        if (!tx) throw new Error("Выбери расходную операцию из журнала ERP.");
        const {error: e} = await supabase.from("supplier_delivery_payments").insert({
          charge_id: chosenCharge.id, finance_transaction_id: tx.id, amount: Number(tx.amount),
        });
        if (e) throw e;
      } else {
        const amount = parseRub(payAmount);
        const left = Number(chosenCharge.amount) - paidFor(chosenCharge.id);
        if (!Number.isFinite(amount) || amount <= 0 || amount > left + 0.001 || Math.abs(Math.round(amount*100)-amount*100)>0.00001) throw new Error("Некорректная сумма оплаты.");
        if (!payAccount) throw new Error("Выбери счёт.");
        const {error: e} = await supabase.rpc("record_supplier_delivery_payment", {
          p_charge_id: chosenCharge.id, p_account_id: payAccount, p_amount: amount, p_date: payDate, p_request_id: requestId
        });
        if (e) throw e;
      }
      setPayChargeId(null); setRequestId(crypto.randomUUID());
      await load();
      await onPaymentChanged?.();
    } catch(e) { setError(e instanceof Error ? e.message : "Не удалось сохранить оплату"); }
    finally { setSaving(false); }
  }
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800 }}>Этапы доставки и оплаты</div>
        <div style={{ color: "#475569", fontSize: 13 }}>Начислено: <b>{rub(total)}</b> · Оплачено: <b>{rub(paid)}</b> · Осталось оплатить: <b>{rub(Math.max(0,total-paid))}</b></div>
      </div>
      <button type="button" style={button} onClick={() => { resetEditor(); setOpen(true); }}>+ Добавить этап</button>
    </div>
    <div style={{ color: "#64748b", fontSize: 12 }}>
      Стоимость доставки увеличивает себестоимость при поступлении. Деньги со счёта ERP списываются только при проведении оплаты. Привязка уже существующего расхода не списывает их повторно.
    </div>
    {error && <div role="alert" style={{ color: "#b91c1c", padding: 10, background: "#fef2f2", borderRadius: 10 }}>{error}</div>}
    {loading && <div style={{ color: "#64748b" }}>Загрузка этапов доставки…</div>}
    {!loading && charges.length === 0 && <div style={{ color: "#64748b" }}>Доставки ещё не добавлены.</div>}
    {charges.map(c => {
      const remaining = Math.max(0,Number(c.amount)-paidFor(c.id));
      return <div key={c.id} style={{ border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, display: "grid", gap: 7, background: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div><b>{c.stage}</b>{c.carrier ? ` · ${c.carrier}` : ""}{c.reference ? ` · ${c.reference}` : ""}</div>
          <b>{rub(Number(c.amount))}</b>
        </div>
        <div style={{ fontSize: 13, color: "#475569" }}>
          Оплачено: <b>{rub(paidFor(c.id))}</b> · {remaining <= 0 ? "Оплачено полностью" : `К оплате: ${rub(remaining)}`}
        </div>
        {payments.filter(p => p.charge_id === c.id).map(p => {
          const tx = transactions.find(t => t.id === p.finance_transaction_id);
          return <div key={p.id} style={{ color: "#64748b", fontSize: 12 }}>
            Расход ERP: {rub(Number(p.amount))} · {tx?.operation_date || "дата в журнале"} · операция {p.finance_transaction_id.slice(0, 8)}
          </div>;
        })}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {remaining > 0 && <button type="button" style={button} onClick={() => startPay(c)}>Учесть оплату</button>}
          {paidFor(c.id) === 0 && <>
            <button type="button" style={button} onClick={() => { setEditingId(c.id); setStage(c.stage); setCarrier(c.carrier || ""); setReference(c.reference || ""); setCost(String(c.amount)); setOpen(true); }}>Изменить</button>
            <button type="button" style={{ ...button, color: "#b91c1c", borderColor: "#fecaca", background: "#fff" }} disabled={saving} onClick={() => void removeCharge(c)}>Удалить</button>
          </>}
        </div>
        {payChargeId === c.id && <div style={{ display: "grid", gap: 10, background: "#f8fafc", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Оплата этапа «{c.stage}»</div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={linkExisting} onChange={e => { setLinkExisting(e.target.checked); setExistingId(""); }} />
            Расход уже внесён в журнал ERP (привязать без повторного списания)
          </label>
          {linkExisting ?
            <label style={field}>Существующая операция
              <select style={input} value={existingId} onChange={e=>setExistingId(e.target.value)}>
                <option value="">Выбрать расход</option>
                {candidates.map(tx => <option key={tx.id} value={tx.id}>{tx.operation_date} · {rub(Number(tx.amount))} · {tx.description || "Без описания"}</option>)}
              </select>
            </label> :
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <label style={field}>Счёт ERP
                <select value={payAccount} onChange={e=>setPayAccount(e.target.value)} style={input}>
                  <option value="">Выбери счёт</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (остаток {rub(Number(a.current_balance))})</option>)}
                </select>
              </label>
              <label style={field}>Сумма списания, ₽<input style={input} type="number" min="0.01" step="0.01" value={payAmount} onChange={e=>setPayAmount(e.target.value)} /></label>
              <label style={field}>Дата фактической оплаты<input style={input} type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} /></label>
            </div>}
          <div style={{ color: "#9a3412", fontSize: 12 }}>Если банк уже списал деньги, но в ERP расход не записан, выбери «Провести в ERP». Если операция уже есть в ERP, включи привязку.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" disabled={saving} style={button} onClick={() => void savePayment()}>{saving ? "Сохраняю…" : linkExisting ? "Привязать расход" : "Провести в ERP"}</button>
            <button type="button" style={button} onClick={() => setPayChargeId(null)}>Отмена</button>
          </div>
        </div>}
      </div>;
    })}
    {open && <div style={{ border: "1px solid #93c5fd", borderRadius: 12, padding: 12, background: "#fff", display: "grid", gap: 10 }}>
      <b>{editingId ? "Изменить этап" : "Новый этап доставки"}</b>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={field}>Маршрут
          <select style={input} value={stage} onChange={e=>setStage(e.target.value)}>
            <option>Доставка по России</option><option>Доставка из Китая</option><option>Международная доставка</option><option>Таможня и оформление</option><option>Доставка (ранее учтённая)</option><option>Другое</option>
          </select>
        </label>
        <label style={field}>Перевозчик (необязательно)<input style={input} value={carrier} onChange={e=>setCarrier(e.target.value)} /></label>
        <label style={field}>Номер отправления / примечание<input style={input} value={reference} onChange={e=>setReference(e.target.value)} /></label>
        <label style={field}>Стоимость, ₽<input style={input} type="number" min="0.01" step="0.01" value={cost} onChange={e=>setCost(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={button} disabled={saving} onClick={() => void saveCharge()}>{saving ? "Сохраняю…" : "Сохранить этап"}</button>
        <button type="button" style={button} onClick={resetEditor}>Отмена</button>
      </div>
    </div>}
  </div>;
}
