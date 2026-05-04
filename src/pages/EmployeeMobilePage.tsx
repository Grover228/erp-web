import { useEffect, useState } from "react";
import { supabase } from "../supabase";

type ProductionBatch = {
  id: string;
  batch_number: string;
  quantity: number;
  completed_quantity: number | null;
  status: string | null;
  product_name: string | null;
  product_article: string | null;
  color_name: string | null;
  current_operation_order: number | null;
  started_at: string | null;
};

export default function EmployeeMobilePage({
  onOpenScanner,
}: {
  onOpenScanner: () => void;
}) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMyBatches();
  }, []);

  async function loadMyBatches() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Пользователь не найден");

      const { data, error } = await supabase
        .from("production_batches")
        .select("*")
        .eq("assigned_user_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false });

      if (error) throw error;

      setBatches((data as ProductionBatch[]) || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Ошибка загрузки пачек"
      );
    } finally {
      setLoading(false);
    }
  }

  const totalDone = batches.reduce(
    (sum, batch) => sum + Number(batch.completed_quantity || 0),
    0
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eff6ff 0%, #f8fafc 100%)",
        padding: 14,
        display: "grid",
        gap: 14,
        alignContent: "start",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 24,
          padding: 18,
          border: "1px solid #dbeafe",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>
          Рабочий экран
        </div>

        <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.5 }}>
          Сканируй QR-код пачки, бери её в работу и закрывай выполненное
          количество.
        </div>
      </div>

      <button
        onClick={onOpenScanner}
        style={{
          width: "100%",
          minHeight: 84,
          border: "none",
          borderRadius: 24,
          background: "#2563eb",
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 14px 28px rgba(37, 99, 235, 0.28)",
        }}
      >
        Сканировать QR
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <StatCard label="Сделано сегодня" value={`${totalDone} шт`} />
        <StatCard label="Пачек в работе" value={`${batches.length} шт`} />
      </div>

      <div
        style={{
          background: "#ffffff",
          borderRadius: 24,
          padding: 16,
          border: "1px solid #dbeafe",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
            Мои пачки в работе
          </div>

          <button
            onClick={loadMyBatches}
            style={{
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 12,
              padding: "8px 10px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>

        {loading && (
          <div style={emptyBoxStyle}>Загружаю пачки...</div>
        )}

        {error && (
          <div
            style={{
              ...emptyBoxStyle,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && batches.length === 0 && (
          <div style={emptyBoxStyle}>
            Пока нет пачек в работе. Нажми «Сканировать QR», чтобы взять пачку.
          </div>
        )}

        {!loading && !error && batches.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {batches.map((batch) => {
              const total = Number(batch.quantity || 0);
              const completed = Number(batch.completed_quantity || 0);
              const left = Math.max(0, total - completed);

              return (
                <div
                  key={batch.id}
                  style={{
                    border: "1px solid #dbeafe",
                    borderRadius: 20,
                    padding: 14,
                    background: "#f8fbff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#111827",
                    }}
                  >
                    Пачка {batch.batch_number}
                  </div>

                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    {batch.product_name || "Изделие не указано"}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <MiniBox label="Всего" value={`${total}`} />
                    <MiniBox label="Сделано" value={`${completed}`} />
                    <MiniBox label="Осталось" value={`${left}`} />
                  </div>

                  <button
                    style={{
                      width: "100%",
                      minHeight: 58,
                      border: "none",
                      borderRadius: 16,
                      background: "#16a34a",
                      color: "#ffffff",
                      fontSize: 18,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Закончить работу
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: 14,
        border: "1px solid #dbeafe",
        boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.3 }}>
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 900,
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 14,
        padding: 10,
        textAlign: "center",
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>
        {value}
      </div>
    </div>
  );
}

const emptyBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#64748b",
  fontWeight: 700,
  lineHeight: 1.5,
};