export default function EmployeeMobilePage() {
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
        <StatCard label="Сделано сегодня" value="0 шт" />
        <StatCard label="Заработано" value="0 ₽" />
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
        <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
          Мои пачки в работе
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            color: "#64748b",
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          Пока нет пачек в работе. Нажми «Сканировать QR», чтобы взять пачку.
        </div>
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