import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

type Shift = {
  id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  total_quantity: number;
  total_earned: number;
};

type Batch = {
  id: string;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  current_operation_order: number;
  status: string;
  assigned_user_id: string | null;
  production_order_id: string;
  product_name?: string | null;
  product_article?: string | null;
  color_name?: string | null;
};

type Operation = {
  id: string;
  production_order_id: string;
  operation_name: string;
  sort_order: number;
  status: string;
  completed_quantity: number;
  planned_total_price: number | null;
  price_per_unit: number | null;
};

type FinishMode = "all" | "partial" | null;

export default function EmployeeMobilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");

  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [operations, setOperations] = useState<Record<string, Operation | null>>({});

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [finishMode, setFinishMode] = useState<FinishMode>(null);
  const [partialQty, setPartialQty] = useState("");
  const [askNextOperation, setAskNextOperation] = useState(false);

  const [closingResult, setClosingResult] = useState<{
    quantity: number;
    earned: number;
    hours: number;
  } | null>(null);

  const [message, setMessage] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Пользователь не найден.");
      setLoading(false);
      return;
    }

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setEmployeeName(profile?.full_name || "Сотрудник");

    await loadCurrentShift(user.id);
    await loadMyBatches(user.id);

    setLoading(false);
  }

  async function loadCurrentShift(uid: string) {
    const { data } = await supabase
      .from("employee_shifts")
      .select("*")
      .eq("user_id", uid)
      .eq("status", "open")
      .maybeSingle();

    setShift(data || null);
  }

  async function loadMyBatches(uid: string) {
    const { data } = await supabase
      .from("production_batches")
      .select("*")
      .eq("assigned_user_id", uid)
      .neq("status", "done");

    const list = data || [];
    setBatches(list);

    const opsMap: Record<string, Operation | null> = {};

    for (const batch of list) {
      const { data: operation } = await supabase
        .from("production_order_operations")
        .select("*")
        .eq("production_order_id", batch.production_order_id)
        .eq("sort_order", batch.current_operation_order)
        .maybeSingle();

      opsMap[batch.id] = operation || null;
    }

    setOperations(opsMap);
  }

  async function openShift() {
    if (!userId) return;

    const { data } = await supabase
      .from("employee_shifts")
      .insert({
        user_id: userId,
        opened_at: new Date().toISOString(),
        status: "open",
        total_quantity: 0,
        total_earned: 0,
      })
      .select()
      .single();

    setShift(data);
  }

  async function closeShift() {
    if (!shift) return;

    const opened = new Date(shift.opened_at).getTime();
    const hours = (Date.now() - opened) / 1000 / 60 / 60;

    const { data } = await supabase
      .from("employee_shifts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", shift.id)
      .select()
      .single();

    setClosingResult({
      quantity: data.total_quantity || 0,
      earned: data.total_earned || 0,
      hours,
    });

    setShift(null);
  }

  const shiftDuration = useMemo(() => {
    if (!shift) return "";

    const opened = new Date(shift.opened_at).getTime();
    const minutes = Math.floor((Date.now() - opened) / 1000 / 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${h}ч ${m}м`;
  }, [shift]);

  if (loading) {
    return <div className="p-4">Загрузка...</div>;
  }

  // ===== ВОТ ЗДЕСЬ ИЗМЕНЕНИЕ =====
  if (!shift) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col justify-center items-center p-6">
        <h1 className="text-3xl font-bold mb-10 text-center">
            {employeeName}
        </h1>

        <h1 className="text-3xl font-bold mb-10 text-center">
          {employeeName}
        </h1>

        {closingResult && (
          <div className="w-full max-w-md mb-6 p-4 bg-green-50 rounded-2xl text-center">
            Сделано: {closingResult.quantity} <br />
            Заработано: {closingResult.earned} ₽ <br />
            Время: {closingResult.hours.toFixed(1)} ч
          </div>
        )}

        <button
          onClick={openShift}
          className="w-full max-w-md h-28 bg-green-600 text-white text-3xl font-bold rounded-3xl shadow-lg"
        >
          Открыть смену
        </button>
      </div>
    );
  }

  // ===== ВСЁ НИЖЕ НЕ ТРОГАЛ =====
  return (
    <div className="min-h-screen bg-neutral-100 p-4 pb-28">
      <div className="text-xl font-bold mb-4">{employeeName}</div>

      <div className="mb-4">Смена: {shiftDuration}</div>

      <button className="w-full h-20 bg-black text-white rounded-2xl mb-4">
        Сканировать QR
      </button>

      <div>
        {batches.map((b) => (
          <div key={b.id} className="bg-white p-4 rounded-2xl mb-3">
            Пачка {b.batch_number}
          </div>
        ))}
      </div>

      <button
        onClick={closeShift}
        className="fixed bottom-4 left-4 right-4 h-16 bg-red-600 text-white rounded-2xl"
      >
        Закрыть смену
      </button>
    </div>
  );
}